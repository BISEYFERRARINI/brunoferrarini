/* Bisey — motor "proposta → tarefas" e catálogo próprio da empresa (sem tela, sem banco; roda no app e nos testes em Node).
   O mesmo jeito do matlist-core.js: recebe dados, devolve dados.

   API (window.BiseyTasks / window.NV.ptasks / module.exports):
     norm(s)                         → minúsculas, sem acento, aspas retas (base de toda comparação)
     proposalLines(p)                → linhas da proposta que viram tarefa: bullets das seções + itens (não entram "não incluído" e esclarecimentos)
     fromProposal(p, trade, o)       → { tasks, unmatched } — tarefas sugeridas pela proposta
        trade = NV.tradeDef(id) (usa trade.tasks e trade.taskMatch); o = { tv, custom, extra }
          tv     → traduz o rótulo PT para o idioma da tela (padrão: igual)
          custom → catálogo próprio da empresa (catalogTasks) — também casa por palavras
          extra  → false: não cria tarefa "Outros" com as linhas de ação que nenhuma regra pegou (padrão: cria)
        cada tarefa: { group, tpl, label, qty, source: "proposal", ref, from }  (tpl = rótulo PT do modelo; label = tv(tpl) + " (qtd)")
     qtyNear(line, at)               → quantidade escrita perto da palavra-chave ("Install 12 recessed", "two (2)", "x 4") ou null
     dedupe(existing, incoming, tv)  → só as novas (mesmo modelo/rótulo no mesmo grupo = repetida); junta as repetidas entre si somando a quantidade
     sameTask(a, b, tv)              → true se a e b são a mesma tarefa
     baseLabel(label)                → rótulo sem a quantidade do fim ("Iluminação recessed (8)" → "Iluminação recessed")
     catalogTasks(list)              → { grupoPT: [rótuloPT…] } das entradas ativas/pendentes do tipo "task" do catálogo da empresa
     mergeTasks(tasks, list)         → trade.tasks + catálogo da empresa (cópia; o registro do ramo não muda)
     catalogVals(list, lang)         → { rótuloPT: rótulo no idioma } (para tv() mostrar a entrada no idioma de quem usa)
     cleanEntry(e) / makeEntry(o)    → entrada do catálogo validada { id, type, group:{pt,en,es}, label:{pt,en,es}, status, … } ou null */
(function (root) {
  "use strict";
  var M = (root && root.BiseyMat) || (typeof require === "function" ? (function () { try { return require("./matlist-core.js"); } catch (e) { return null; } })() : null);

  function norm(s) {
    var t = String(s == null ? "" : s).toLowerCase();
    try { t = t.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { }
    return t.replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  }
  function lines(t) { return String(t || "").split("\n").map(function (s) { return s.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "").trim(); }).filter(Boolean); }
  var NOT_OURS = /\bby others\b|\bnot included\b|\bexcluded\b|\bexclusions?\b|por outros|nao inclu|no inclu|\bn\/?a\b|supplied and installed by|(?:owner|gc|client) to (?:provide|install)/;

  // ═══════════ linhas da proposta ═══════════
  function proposalLines(p) {
    var out = [];
    (p && p.sections || []).forEach(function (s) {
      var title = String(s.title || "");
      lines(s.text).forEach(function (l) { out.push({ text: l, ctx: title, src: "section" }); });
    });
    (p && p.items || []).forEach(function (it) {
      var ls = lines(it.desc), q = /^\s*(\d{1,4})(?:\s*(?:ea|each|un|unid|pcs?|x))?\s*$/i.exec(String(it.qty || "")), iq = q ? Number(q[1]) : null;
      ls.forEach(function (l, i) { out.push({ text: l, ctx: ls[0] || "", src: "item", qty: i === 0 ? iq : null }); });
    });
    return out;
  }

  // ═══════════ quantidade ═══════════
  var NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    uno: 1, dos: 2, cuatro: 4, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  function tokNum(w) {
    var m = /^(?:(\d{1,4})|\((\d{1,4})\))[,:]?$/.exec(w); if (m) return Number(m[1] || m[2]); // "8", "(2)" — "(40" de "(40 spaces)" não
    m = /^([a-z]+)[,:]?$/.exec(w); if (m && NUMW[m[1]]) return NUMW[m[1]];
    return null;
  }
  // at = posição da palavra-chave na linha normalizada
  function qtyNear(line, at) {
    var s = norm(line), all = s.slice(0, at).split(" ").filter(Boolean), before = all.slice(-6), after = s.slice(at);
    var am = /^[^.;:,]{0,30}?(?:\(\s*(?:qty\s*|qtd\s*|cant\s*)?(\d{1,4})\s*\)|\bx\s*(\d{1,4})\b|\bqty\.?\s*(\d{1,4})\b|\bqtd\.?\s*(\d{1,4})\b)/.exec(after);
    var UNIT = /^(ft|feet|foot|in|inch|inches|a|amp|amps|v|volts?|w|watts?|"|'|mm|cm|m|lf|sf|sq|gal|btu|ton|tons|%)$/;
    for (var i = before.length - 1; i >= 0; i--) {
      var n = tokNum(before[i]);
      if (n != null) {
        if (i + 1 < before.length && UNIT.test(before[i + 1])) continue;          // "8 ft", "20 a": medida
        if (i > 0 && /^x$|\dx$/.test(before[i - 1])) continue;                     // 5/8" x 8
        return n > 0 ? n : null;                                                  // "two (2)": o mais perto ganha (mesmo número)
      }
      // "20a", 5/8", 6", 12/2: medida, não quantidade — segue procurando antes dela
    }
    if (am) { var v = Number(am[1] || am[2] || am[3] || am[4]); return v > 0 ? v : null; }
    return null;
  }

  // ═══════════ regras do ramo (trades.js → taskMatch) ═══════════
  var RX = {};
  function rx(src) { if (!src) return null; if (!RX[src]) { try { RX[src] = new RegExp(src, "i"); } catch (e) { RX[src] = /$^/; } } return RX[src]; }
  function hasTpl(trade, g, l) { var a = (trade.tasks || {})[g]; return !!a && a.indexOf(l) >= 0; }

  function words(s) { return M && M.words ? M.words(s) : norm(s).replace(/[^a-z0-9/]+/g, " ").split(" ").filter(function (w) { return w.length > 2; }); }
  function score(a, b) {
    if (M && M.matchScore) return M.matchScore(words(a), words(b));
    var A = words(a), B = words(b); if (!A.length || !B.length) return 0;
    return A.filter(function (w) { return B.indexOf(w) >= 0; }).length / Math.max(3, Math.min(A.length, B.length));
  }
  var ACTION = /^(install|furnish|provide|replace|relocate|run|mount|add|upgrade|remove|wire|connect|supply|set|hang|build|frame|paint|patch|repair|demo|demolish|instalar|trocar|substituir|colocar|ligar|passar|mover|montar|fazer|reemplazar|cambiar|conectar|construir|pintar|reparar|consertar|remover|retirar|quitar)\b/;
  function shortTask(l) {
    var s = String(l || "").replace(/\*\*/g, "").split(/(?<=[a-z0-9)])[.;](?:\s|$)| — | – /i)[0].replace(/\s*(?:,\s*)?(?:per|as per|according to|conforme|segun)\s+(?:the\s+)?(?:nec|code|plans?|cmr|ibc|irc)\b.*$/i, "").trim();
    if (s.length > 90) s = s.slice(0, 87).replace(/\s+\S*$/, "") + "…";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function fromProposal(p, trade, o) {
    o = o || {}; trade = trade || { tasks: {}, taskMatch: [] };
    var tv = o.tv || function (x) { return x; }, rules = trade.taskMatch || (trade.raw || {}).taskMatch || [], custom = o.custom || {};
    var found = {}, order = [], unmatched = [];
    // quantidade: soma dentro do escopo (cozinha 8 + sala 4 = 12) e dentro dos itens; entre escopo e itens fica a maior (o item costuma repetir o escopo)
    function add(g, tpl, qty, from, src) {
      var k = g + "|" + tpl;
      if (!found[k]) { found[k] = { group: g, tpl: tpl, qty: null, q: {}, from: [] }; order.push(k); }
      var f = found[k];
      if (qty) { f.q[src] = (f.q[src] || 0) + qty; f.qty = Math.max(f.q.section || 0, f.q.item || 0); }
      if (from && f.from.length < 3 && f.from.indexOf(from) < 0) f.from.push(from);
    }
    proposalLines(p).forEach(function (ln) {
      var s = norm(ln.text), cx = norm(ln.ctx + " " + ln.text);
      if (!s || NOT_OURS.test(s)) return;
      var hit = false;
      rules.forEach(function (r) {
        var g = r.t[0], l = r.t[1]; if (!hasTpl(trade, g, l)) return;
        var re = rx(r.re), m = re && re.exec(s); if (!m) return;
        if (r.ctx && !rx(r.ctx).test(cx)) return;
        if (r["not"] && rx(r["not"]).test(s)) return;
        hit = true;
        add(g, l, qtyNear(ln.text, m.index) || (ln.qty && ln.qty > 1 ? ln.qty : null), ln.text, ln.src);
      });
      // catálogo da empresa e, sem regra no ramo, os rótulos do próprio ramo: por palavras (motor do matlist-core)
      var pools = [custom].concat(rules.length ? [] : [trade.tasks || {}]);
      pools.forEach(function (pool) {
        Object.keys(pool).forEach(function (g) {
          (pool[g] || []).forEach(function (l) {
            var names = [l, tv(l)].filter(function (x, i, a) { return x && a.indexOf(x) === i; });
            if (names.some(function (n) { return score(n, ln.text) >= 0.6; })) { hit = true; add(g, l, ln.qty && ln.qty > 1 ? ln.qty : null, ln.text, ln.src); }
          });
        });
      });
      if (!hit && ln.src === "section" && ACTION.test(s)) unmatched.push(ln.text);
    });
    var tasks = order.map(function (k) { var f = found[k]; return mk(f.group, f.tpl, tv(f.tpl), f.qty, p, f.from); });
    if (o.extra !== false) {
      var seen = {};
      unmatched.forEach(function (l) {
        var lab = shortTask(l), k = norm(lab); if (!lab || seen[k]) return; seen[k] = 1;
        tasks.push(mk("Outros", null, lab, null, p, [l]));
      });
    }
    return { tasks: tasks, unmatched: unmatched };
  }
  function mk(group, tpl, label, qty, p, from) {
    var t = { id: null, group: group, label: qty ? label + " (" + qty + ")" : label, done: false, source: "proposal" };
    if (tpl) t.tpl = tpl; if (qty) t.qty = qty;
    if (p && p.id) t.ref = p.id; if (p && p.number) t.refNo = p.number;
    if (from && from.length) t.from = from.slice(0, 2).map(function (x) { return String(x).slice(0, 160); });
    return t;
  }

  // ═══════════ repetidas ═══════════
  function baseLabel(l) { return String(l || "").replace(/\s*\((?:\d{1,4})\)\s*$/, "").trim(); }
  function keysOf(t, tv) {
    tv = tv || function (x) { return x; };
    var k = [norm(baseLabel(t.label))]; if (t.tpl) { k.push(norm(t.tpl)); k.push(norm(tv(t.tpl))); }
    var tl = tv(baseLabel(t.label)); if (tl) k.push(norm(tl));
    return k.filter(Boolean);
  }
  function sameTask(a, b, tv) {
    if (!a || !b) return false;
    if (a.tpl && b.tpl) return a.tpl === b.tpl && (a.group === b.group || !a.group || !b.group);
    var ka = keysOf(a, tv), kb = keysOf(b, tv);
    return ka.some(function (x) { return kb.indexOf(x) >= 0; });
  }
  function dedupe(existing, incoming, tv) {
    var out = [];
    (incoming || []).forEach(function (t) {
      if ((existing || []).some(function (e) { return sameTask(e, t, tv); })) return;
      var dup = out.find(function (e) { return sameTask(e, t, tv); });
      if (dup) { if (t.qty) { dup.qty = (dup.qty || 0) + t.qty; dup.label = baseLabel(dup.label) + " (" + dup.qty + ")"; } return; }
      out.push(t);
    });
    return out;
  }

  // ═══════════ catálogo próprio da empresa ═══════════
  var TYPES = { task: 1, material: 1, service: 1 };
  function txt3(x, max) {
    if (x == null) return null;
    if (typeof x === "string") x = { pt: x, en: x, es: x };
    var o = {}; ["pt", "en", "es"].forEach(function (l) { o[l] = clean(x[l] != null ? x[l] : x.pt != null ? x.pt : x.en, max); });
    if (!o.pt) o.pt = o.en || o.es; if (!o.en) o.en = o.pt; if (!o.es) o.es = o.pt;
    return o.pt ? o : null;
  }
  // texto curto, sem marcação, sem link e sem caracteres de controle
  function clean(s, max) {
    s = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>`{}\[\]]/g, " ").replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "").replace(/\s+/g, " ").trim();
    return s.length > (max || 80) ? s.slice(0, max || 80).trim() : s;
  }
  function cleanEntry(e) {
    if (!e || !TYPES[e.type]) return null;
    var label = txt3(e.label, 80), group = txt3(e.group || (e.type === "task" ? "Outros" : e.type === "material" ? "Material" : "Serviços"), 40);
    if (!label || !group) return null;
    var o = { id: String(e.id || "").slice(0, 40) || ("cc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), type: e.type, group: group, label: label,
      status: e.status === "pending" ? "pending" : "active", at: e.at || new Date().toISOString() };
    ["trade", "by", "byName", "suggestionId", "unit", "note"].forEach(function (k) { if (e[k] != null && e[k] !== "") o[k] = clean(e[k], k === "note" ? 160 : 60); });
    return o;
  }
  function makeEntry(o) { return cleanEntry(o); }
  function catalogTasks(list) {
    var out = {};
    (list || []).forEach(function (e) { if (!e || e.type !== "task" || e.removed) return; var g = (e.group || {}).pt || "Outros", l = (e.label || {}).pt; if (!l) return; (out[g] = out[g] || []); if (out[g].indexOf(l) < 0) out[g].push(l); });
    return out;
  }
  function mergeTasks(tasks, list) {
    var out = {}; Object.keys(tasks || {}).forEach(function (g) { out[g] = (tasks[g] || []).slice(); });
    var c = catalogTasks(list); Object.keys(c).forEach(function (g) { out[g] = out[g] || []; c[g].forEach(function (l) { if (out[g].indexOf(l) < 0) out[g].push(l); }); });
    return out;
  }
  function catalogVals(list, lang) {
    var o = {}; if (!lang || lang === "pt") return o;
    (list || []).forEach(function (e) { if (!e) return; [e.label, e.group].forEach(function (x) { if (x && x.pt && x[lang] && x[lang] !== x.pt) o[x.pt] = x[lang]; }); });
    return o;
  }

  var API = { norm: norm, proposalLines: proposalLines, fromProposal: fromProposal, qtyNear: qtyNear, dedupe: dedupe, sameTask: sameTask, baseLabel: baseLabel,
    catalogTasks: catalogTasks, mergeTasks: mergeTasks, catalogVals: catalogVals, cleanEntry: cleanEntry, makeEntry: makeEntry, clean: clean, shortTask: shortTask, TYPES: TYPES };
  if (root) { root.BiseyTasks = API; if (root.NV) root.NV.ptasks = API; }
  if (typeof module === "object" && module && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
