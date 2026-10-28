/* Bisey — registro de ramos (trades) dirigido por dados.
   Carregado DEPOIS de i18n.js (e do dicionário do idioma ativo) e ANTES de config.js/data.js/app.js/proposals.js.
   Um ramo = um objeto de dados no formato de docs/ramos/ESQUEMA.md. Para ligar um ramo novo basta
   acrescentar o objeto em DEFS (ou chamar NV.defineTrade(json)) — nada de if (tr === "...") no resto do app.

   API (window.NV):
     NV.TRADES[id]          → definição normalizada (textos já no idioma ativo; valores gravados em PT)
     NV.tradeDef(id)        → definição (aceita aliases, ex.: "general" → gc; desconhecido → electrical)
     NV.tradeKey(id)        → id canônico ("general" → "gc"; desconhecido → "electrical")
     NV.tradeList()         → definições em ordem (order)
     NV.tradeLabel(id)      → nome curto do ramo no idioma ativo
     NV.tradeSuggest(id, d[, co]) → [[grupo, tarefa], …] a partir da ficha d (regras de suggest); co = opções da empresa ({ noGas: true })
     NV.tradeOpts(id, key, co, cur) → opções do campo da ficha para essa empresa (coHide; a opção já gravada cur nunca some)
     NV.tradeAiRules(id, co) → regras da IA do ramo + as das opções marcadas da empresa (companyFlags[].aiRule)
     NV.tradeIntro(id, ctx) → parágrafo de introdução da proposta ({ what, where, state })
     NV.tradeDefaults(id, ctx) → { includes, notIncluded, clarifications, warranty } ({ brand, state })
     NV.tradeMultiKeys(id)  → campos de lista (multi) da ficha
     NV.defineTrade(spec)   → registra/normaliza um ramo (usado pelos DEFS abaixo e por testes) */
(function () {
  "use strict";
  var NV = window.NV = window.NV || {}, I18N = window.I18N = window.I18N || {}, LANG = NV.lang || "pt", SENT = "\u0001";

  // ═══════════ textos ═══════════
  // Txt: "texto" | { pt, en, es } | { key, pt[, en] } (chave do i18n.<lang>.js — usada pelos ramos antigos). Idioma que falta → PT.
  function txt(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (x.key && NV.t) {
      if (LANG === "pt") return x.pt != null ? x.pt : NV.t(x.key);
      var s = NV.t(x.key, SENT); if (s !== SENT) return s;
    }
    return x[LANG] != null ? x[LANG] : (x.pt != null ? x.pt : "");
  }
  // Val: valor gravado no banco (sempre PT). { pt, en, es } registra a tradução em I18N.<lang>.val (para tv()) sem sobrescrever.
  var VALS = LANG !== "pt" && I18N[LANG] ? (I18N[LANG].val = I18N[LANG].val || {}) : null;
  function val(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (VALS && x[LANG] != null && x.pt != null && VALS[x.pt] == null) VALS[x.pt] = x[LANG];
    return x.pt != null ? x.pt : "";
  }
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ═══════════ lojas conhecidas (prices.stores por id) ═══════════
  var STORE_CAT = {
    homedepot: { name: "The Home Depot", short: "Home Depot", url: "https://www.homedepot.com/s/{q}" },
    lowes: { name: "Lowe's", short: "Lowe's", search: "site:lowes.com" },
    ies: { name: "Independent Electric Supply", short: "Independent", search: "site:iesbuy.com" },
    northeast: { name: "Northeast Electrical", short: "Northeast", search: "site:needco.com" },
    granite: { name: "Granite City Electric", short: "Granite City", search: "site:granitecityelectric.com" },
    standard: { name: "Standard Electric", short: "Standard", search: "Standard Electric Supply" },
    fwwebb: { name: "F.W. Webb", short: "F.W. Webb", search: "site:fwwebb.com" },
    ferguson: { name: "Ferguson", short: "Ferguson", search: "site:ferguson.com" },
    supplyhouse: { name: "SupplyHouse.com", short: "SupplyHouse", search: "site:supplyhouse.com" },
    lumber84: { name: "84 Lumber", short: "84 Lumber", search: "site:84lumber.com" },
    abcsupply: { name: "ABC Supply", short: "ABC Supply", search: "site:abcsupply.com" },
    lumberyard: { name: { key: "prices.localLumberYard", pt: "Madeireira local" }, short: { key: "prices.lumberYard", pt: "Madeireira" }, search: "lumber yard" }
  };
  function mkStore(s) {
    if (typeof s === "string") s = Object.assign({ id: s }, STORE_CAT[s] || { name: s, short: s, search: s });
    var o = { id: s.id, name: txt(s.name), short: txt(s.short || s.name) };
    o.url = s.url ? function (q) { return s.url.replace("{q}", encodeURIComponent(q)); }
      : function (q) { return "https://www.google.com/search?q=" + encodeURIComponent((s.search ? s.search + " " : "") + q); };
    return o;
  }

  // ═══════════ regras de "Sugerir pela ficha" ═══════════
  function filled(v) { return isArr(v) ? v.length > 0 : !!v; }
  // newish: obra nova / ampliação ou paredes abertas (disponível em todo ramo)
  var NEWISH = { any: [{ f: "workType", re: "New Construction|Addition|Sistema novo" }, { f: "walls", re: "Abertas|Parcial" }] };
  function cond(c, d, V) {
    if (!c) return true;
    var ok = true;
    if (c.any) ok = ok && c.any.some(function (x) { return cond(x, d, V); });
    if (c.all) ok = ok && c.all.every(function (x) { return cond(x, d, V); });
    if (c.not) ok = ok && !cond(c.not, d, V);
    if (c["var"]) ok = ok && V(c["var"]);
    if (c.co) ok = ok && !!V.co[c.co]; // opção da empresa (Configurações → Empresa), ex.: { "co": "noGas" }
    if (c.f) {
      var v = d[c.f];
      if (own(c, "re")) { var re = new RegExp(c.re); ok = ok && (isArr(v) ? v.some(function (x) { return re.test(x); }) : re.test(v == null || v === false ? "" : v)); }
      if (own(c, "eq")) ok = ok && v === c.eq;
      if (own(c, "ne")) ok = ok && !!v && v !== c.ne;
      if (own(c, "has")) { var a = v || []; ok = ok && typeof a.indexOf === "function" && a.indexOf(c.has) >= 0; }
      if (own(c, "filled")) ok = ok && (c.filled ? filled(v) : !filled(v));
      if (own(c, "gt")) ok = ok && Number(v) > c.gt;
    }
    return ok;
  }
  function suggestFor(def, d, co) {
    d = d || {};
    var sg = def.suggest || {}, vars = sg.vars || {}, memo = {}, out = [];
    function V(n) {
      if (own(memo, n)) return memo[n];
      memo[n] = false; // evita laço
      memo[n] = cond(own(vars, n) ? vars[n] : n === "newish" ? NEWISH : null, d, V) && (own(vars, n) || n === "newish");
      return memo[n];
    }
    V.co = co || {};
    (sg.rules || []).forEach(function (r) { if (!r["if"] || cond(r["if"], d, V)) (r.add || []).forEach(function (a) { out.push([a[0], a[1]]); }); });
    // ordem da OBRA, não a das regras: suggest.order = nomes das tarefas na sequência real (permit e fotos antes, retoque e limpeza no fim — B07).
    // Tarefa fora da lista fica no fim, na ordem das regras. Sem "order", a ordem das regras (como antes).
    var ord = sg.order;
    if (ord && ord.length) {
      var pos = {}; ord.forEach(function (n, i) { if (!own(pos, n)) pos[n] = i; });
      out = out.map(function (a, i) { return { a: a, k: own(pos, a[1]) ? pos[a[1]] : 1e6 + i }; }).sort(function (x, y) { return x.k - y.k; }).map(function (x) { return x.a; });
    }
    return out;
  }

  // ═══════════ normalização ═══════════
  var TRADES = {}, ALIAS = {}, LIST = [];
  function defineTrade(spec) {
    if (!spec || !spec.id) return null;
    var id = spec.id, p = spec.proposal || {}, pr = spec.prices || {}, units = {};
    (spec.units || []).forEach(function (u) { units[u.id] = txt(u.label); });
    // rótulo + unidade, sem repetir quando o rótulo já traz a unidade ("Área de pintura (sq ft)" — B12)
    var withUnit = function (label, u) {
      if (!u || !units[u]) return label;
      var un = String(units[u]).toLowerCase(), l = String(label).toLowerCase(), stem = un.replace(/[^a-zà-ÿ ]/g, "").trim().split(" ")[0].slice(0, 4);
      var par = (l.match(/\(([^()]+)\)/g) || []).map(function (x) { return x.slice(1, -1).trim(); });
      var dup = par.some(function (x) { return x === un || un.indexOf(x) >= 0 || x.indexOf(un) >= 0 || (x.split(" ")[0].length >= 4 && un.indexOf(x.split(" ")[0].slice(0, 5)) >= 0); }) ||
        (stem.length >= 4 && l.indexOf(stem) >= 0) || l.indexOf("(" + u + ")") >= 0;
      return dup ? label : label + " (" + units[u] + ")";
    };
    var fields = {}, sys = [];
    Object.keys(spec.fields || {}).forEach(function (k) {
      var f = spec.fields[k], o = { label: withUnit(txt(f.label), f.unit), opts: (f.opts || []).map(val) };
      if (f.multi) o.multi = true; if (f.unit) o.unit = f.unit;
      if (f.hint) o.hint = txt(f.hint);
      if (f.coHide) o.coHide = f.coHide; // { "noGas": ["Sim"] } → opção escondida para a empresa com essa opção marcada
      if (f.legacy) o.legacy = f.legacy.map(val); // opções antigas: só aparecem se já gravadas ou na empresa pré-configurada (co._preset)
      if (f.system) { o.system = true; sys.push(k); }
      fields[k] = o;
    });
    var tasks = {};
    Object.keys(spec.tasks || {}).forEach(function (g) { tasks[val(g)] = spec.tasks[g].map(val); });
    // nome dos grupos de tarefa em outros idiomas: "groupsI18n": { "en": { "Demolição": "Demo" }, "es": { "Demolição": "Demolición" } } (chave de objeto não pode ser { pt, en })
    var gi = (spec.groupsI18n || {})[LANG];
    if (gi && VALS) Object.keys(gi).forEach(function (g) { if (VALS[g] == null) VALS[g] = gi[g]; });
    var icon = typeof spec.icon === "string" ? spec.icon : "trade-" + id;
    var def = {
      id: id, raw: spec, aliases: (spec.aliases || []).slice(), order: spec.order || 999, category: spec.category || "general",
      label: txt(spec.label), companySuffix: spec.companySuffix || txt(spec.label),
      obLabel: txt((spec.onboarding || {}).label || spec.label), obDesc: txt((spec.onboarding || {}).desc),
      icon: icon, iconSvg: spec.icon && typeof spec.icon === "object" ? spec.icon.svg || "" : "",
      kind: txt(spec.kind), stepName: txt(spec.stepName || spec.label),
      group: [txt((spec.group || {}).label || spec.label), (spec.group || {}).icon || icon], sysKeys: sys,
      workType: (spec.workType || []).map(val), fields: fields,
      text: (spec.text || []).map(function (x) { var o = { key: x.key, label: withUnit(txt(x.label), x.unit) }; if (x.unit) o.unit = x.unit; if (x.type) o.type = x.type; return o; }),
      units: (spec.units || []).map(function (u) { return { id: u.id, label: units[u.id] }; }),
      tasks: tasks, suggest: spec.suggest || { rules: [] }, taskMatch: spec.taskMatch || [], // taskMatch: proposta → tarefas (tasks-core.js)
      // opções por empresa (Configurações → Empresa), ex.: "Não fazemos gás" no HVAC e no plumbing
      companyFlags: (spec.companyFlags || []).map(function (f) { return { key: f.key, label: txt(f.label), desc: txt(f.desc), aiRule: f.aiRule || "" }; }),
      inspections: (spec.inspections || []).map(function (x) { return { label: val(x.label), authority: txt(x.authority), when: txt(x.when) }; }),
      proposal: {
        title: p.title || "PROPOSAL", tagline: p.tagline || "", role: p.role || "", scopeName: p.scopeName || txt(spec.label), invoiceWork: p.invoiceWork || String(p.scopeName || txt(spec.label)).toLowerCase(),
        intro: p.intro || { text: "", code: {} }, defaults: p.defaults || {},
        sections: (p.sections || []).map(function (s) { return [s.title, factsFill(condLines(s.text, {}), p.facts, "")]; }), // [título, texto neutro] (lista do editor)
        keywords: (p.sections || []).map(function (s) { return new RegExp(s.keywords || ".", "i"); }),
        sectionsRaw: p.sections || [], facts: p.facts || {}, jobVariants: p.jobVariants || [],                 // NV.tradeSections / tradeSection usam estes
        payment: p.payment || null, hic: !!p.hic, clientRole: p.clientRole != null ? p.clientRole : null,
        itemNote: p.itemNote || "Labor, material and permit per the scope above.", // linha do item no modo sem IA (pintura/piso: sem "permit")
        adjustExample: p.adjustExample ? txt(p.adjustExample) : "",            // exemplo da caixa "Quer mudar alguma coisa?"
        speechExample: txt(p.speechExample), speechExampleInvoice: p.speechExampleInvoice ? txt(p.speechExampleInvoice) : txt(p.speechExample), aiRules: p.aiRules || ""
      },
      prices: {
        stores: (pr.stores && pr.stores.length ? pr.stores : ["homedepot", "lowes"]).map(mkStore),
        basic: (pr.basic || []).map(function (r) { return [txt(r[0]), txt(r[1]), txt(r[2])]; }),
        basicOffer: (pr.basicOffer || [{ list: id, label: { pt: "Adicionar lista básica", en: "Add basic list", es: "Agregar lista básica" } }]).map(function (b) { return { list: b.list, label: txt(b.label) }; }),
        promos: !!pr.promos,
        searchExample: pr.searchExample ? txt(pr.searchExample) : ""          // placeholder da busca em Preços (ex.: "Romex, GFCI, line set")
      },
      warnings: spec.warnings || []                                           // avisos da ficha ({ if: Cond, msg: Txt }) — ex.: pintura externa com tetos
    };
    TRADES[id] = def; ALIAS[id] = id; def.aliases.forEach(function (a) { ALIAS[a] = id; });
    LIST = Object.keys(TRADES).map(function (k) { return TRADES[k]; }).sort(function (a, b) { return a.order - b.order || (a.id < b.id ? -1 : 1); });
    return def;
  }
  function tradeKey(id) { return ALIAS[id] || (TRADES.electrical ? "electrical" : (LIST[0] || {}).id); }
  function tradeDef(id) { return TRADES[tradeKey(id)]; }
  function tradeList() { return LIST.slice(); }
  function tradeLabel(id) { return tradeDef(id).label; }
  function fill(s, ctx) { return String(s || "").replace(/\{(\w+)\}/g, function (m, k) { return ctx[k] != null ? ctx[k] : m; }); }
  var ST_CODE = { massachusetts: "MA", "new hampshire": "NH", "rhode island": "RI", connecticut: "CT", vermont: "VT", maine: "ME", "new york": "NY", delaware: "DE", montana: "MT", oregon: "OR", alaska: "AK" };
  function stCode(ctx) { var c = ctx.code || ctx.stateCode || ""; if (!c && ctx.state) c = /^[A-Z]{2}$/.test(ctx.state) ? ctx.state : ST_CODE[String(ctx.state).toLowerCase()] || ""; return c; }
  function tradeIntro(id, ctx) {
    ctx = ctx || {}; var it = tradeDef(id).proposal.intro || {}, st = stCode(ctx);
    if (ctx.preset && it.preset) it = it.preset; // empresas pré-configuradas (Eternity / Blue Star): texto de antes, pedido do dono
    var code = it.code || {};
    var c = own(code, st) ? code[st] : (code["*"] != null ? code["*"] : "");
    return fill(condLines(it.text, { state: st, co: ctx.co }), { what: ctx.what, where: ctx.where, code: c });
  }
  // sem imposto geral sobre vendas (NH…): tira "applicable <estado> sales tax" da frase de "includes"
  function noTax(s) { return String(s).replace(/,?\s*(?:and\s+)?applicable\s+(?:[A-Z][a-z]+\s+){1,2}sales tax(?=[,.;]|$)/g, "").replace(/,\s*,/g, ",").replace(/,\s*and\s*\./g, ".").replace(/^\s*,\s*/, ""); }
  // textos padrão: {brand} {state}; linhas "[MA] …" / "[!MA] …" / "[co:noGas] …" (em notIncluded, por item " · "); sales tax só onde existe
  function tradeDefaults(id, ctx) {
    ctx = ctx || {}; if (!ctx.state && !ctx.code) ctx = Object.assign({}, ctx, { state: "Massachusetts", code: "MA" }); // sem estado = MA (como proposals.js → stateOf)
    var d = tradeDef(id).proposal.defaults || {}, o = {}, st = stCode(ctx), cx = { state: st, co: ctx.co || {} };
    ["includes", "notIncluded", "clarifications", "warranty"].forEach(function (k) {
      var v = condLines(d[k] || "", cx, k === "notIncluded" ? " · " : "\n");
      v = fill(v, { brand: ctx.brand, state: ctx.state });
      if (k === "includes" && NO_SALES_TAX[st]) v = noTax(v);
      o[k] = v;
    });
    return o;
  }
  // seções padrão escolhidas pela fala (modo sem IA): keywords ("." = sempre) sem negação ("sem bomba", "no fire pump") nem "por outros",
  // exclude (ex.: "aproveitar os dutos"), variante por opção da empresa (section.co.noGas = { text, title, keywords, hide }),
  // linhas por estado / opção ("[MA] …") e fatos da fala ({layers}, {standard}…) — sem fonte, texto neutro (facts.<x>.fallback)
  function secVariant(s, co) { var v = s; Object.keys(s.co || {}).forEach(function (k) { if (co && co[k]) v = Object.assign({}, v, s.co[k]); }); return v; }
  function secText(pd, s, speech, cx) { return factsFill(condLines(s.text || "", cx), pd.facts, speech); }
  function tradeSections(id, speech, ctx) {
    ctx = ctx || {}; var t = tradeDef(id), pd = t.proposal, cx = { state: stCode(ctx), co: ctx.co || {} }, out = [];
    (pd.sectionsRaw || []).forEach(function (s0) {
      var s = secVariant(s0, cx.co); if (s.hide) return;
      var kw = new RegExp(s.keywords || ".", "i"), opt = { negate: s.negate, byOthers: s.byOthers };
      if (!speechHas(kw, speech, opt)) return;
      if (s.keywords !== "." && s.exclude && speechHas(new RegExp(s.exclude, "i"), speech, { negate: false })) return;
      // outra seção mais específica cobre o pedido (ex.: reparo × telhado inteiro); "unlessExcept" anula o unless (ex.: "vazamento… trocar o telhado inteiro")
      if (s.unless && speechHas(new RegExp(s.unless, "i"), speech) && !(s.unlessExcept && speechHas(new RegExp(s.unlessExcept, "i"), speech))) return;
      var text = secText(pd, s, speech, cx).split("\n").filter(function (l) { return l.trim(); }).join("\n");
      if (text) out.push({ title: s.title, text: text });
    });
    return out;
  }
  // textos padrão que dependem do serviço falado (proposal.jobVariants: [{ match, defaults: { warranty… } }]) — ex.: reparo de telhado → garantia de 1 ano
  function tradeJobDefaults(id, speech, ctx) {
    ctx = ctx || {}; var o = {}, st = stCode(ctx), cx = { state: st, co: ctx.co || {} };
    (tradeDef(id).proposal.jobVariants || []).forEach(function (v) {
      if (!speechHas(new RegExp(v.match, "i"), speech) || (v.unless && speechHas(new RegExp(v.unless, "i"), speech))) return;
      Object.keys(v.defaults || {}).forEach(function (k0) {
        var add = /\+$/.test(k0), k = k0.replace(/\+$/, ""), sep = k === "notIncluded" ? " · " : "\n";
        var x = fill(condLines(v.defaults[k0], cx, sep), { brand: ctx.brand, state: ctx.state });
        if (k === "includes" && NO_SALES_TAX[st]) x = noTax(x);
        if (add) { if (!x.trim()) return; var b = own(o, k) ? o[k] : tradeDefaults(id, ctx)[k] || ""; o[k] = k === "notIncluded" ? b.replace(/\.\s*$/, "") + " · " + x : b + "\n" + x; } // "clarifications+": acrescenta
        else if (!own(o, k)) o[k] = x;
      });
    });
    return o;
  }
  // uma seção pelo índice (editor: "+ Adicionar seção") — mesmos textos, fatos da fala salva da proposta
  function tradeSection(id, i, speech, ctx) {
    ctx = ctx || {}; var pd = tradeDef(id).proposal, cx = { state: stCode(ctx), co: ctx.co || {} }, s = secVariant(pd.sectionsRaw[i] || {}, cx.co);
    return { title: s.title || "", text: secText(pd, s, speech, cx).split("\n").filter(function (l) { return l.trim(); }).join("\n") };
  }
  // cronograma de pagamento: marcos do ramo (proposal.payment.milestones) ou os de sempre (Deposit / Rough-In / Final);
  // divisão falada ("30/40/30", "metade na entrada") ou pelo preço (< 8 mil: 50/50; senão 30/40/30);
  // capDeposit (contrato residencial de MA — M.G.L. c.142A §2): depósito ≤ 1/3 → 50/50 vira 33/67
  var PAY_STD = [["Deposit", "Upon signed acceptance, prior to mobilization."], ["Rough-In", "Upon completion of rough-in and rough inspection."], ["Final Payment", "Upon completion, final inspection and AHJ sign-off."]];
  var PAY_2 = [["Deposit", "Upon signed acceptance of this proposal."], ["Final Payment", "Upon completion and final inspection."]];
  function tradePayment(id, o) {
    o = o || {}; var pm = (tradeDef(id).proposal.payment || {}), ms = pm.milestones || PAY_STD, two = pm.milestones ? [ms[0], ms[ms.length - 1]] : PAY_2;
    var split = o.split || (o.price && o.price < 8000 ? [50, 50] : [30, 40, 30]);
    if (o.capDeposit && split[0] > 33) { var extra = split[0] - 33; split = split.slice(); split[0] = 33; split[split.length - 1] += extra; }
    var rows;
    if (split.length === 2) rows = two.map(function (m, i) { return [m[0], m[1], split[i]]; });
    else rows = split.map(function (p, i) {
      var m = i === 0 ? ms[0] : i === split.length - 1 ? ms[ms.length - 1] : (ms.length > 2 && i <= ms.length - 2 ? ms[i] : ["Progress Payment " + i, "Upon completion of the corresponding phase of work."]);
      return [m[0], m[1], p];
    });
    return rows;
  }
  // ── contrato residencial de MA (lei HIC, M.G.L. c.142A §2) ──
  // Itens que o contrato escrito precisa ter quando a empresa é de MA, o ramo é de "residential contracting" (proposal.hic) e o cliente é
  // o dono da casa (1–4 famílias). REDAÇÃO-MODELO: revisar com advogado antes de usar (docs/07-qa-ramos.md → Correções).
  var HIC_LINES = [
    "**Home Improvement Contract (M.G.L. c.142A, §2).** Once signed by both parties, this proposal is the complete agreement between the Owner and the Contractor for the work described above, including the scope, materials, price, and payment schedule; any change must be agreed in a written change order signed by both parties.",
    "**Contractor:** {brand}{addr}. Massachusetts Home Improvement Contractor Registration No. **{hic}**.",
    "**Owner:** {client}. **Job address:** {where}.",
    "**Dates:** Contract date: the date both parties sign below. Start date: **{start}**. Substantial completion date: **{end}**.",
    "**Price and payment:** Total contract price as stated in the Investment section, payable per the Payment Schedule above. The deposit does not exceed one-third (1/3) of the total contract price or the actual cost of any special-order materials, whichever is greater. No interest or finance charges are included in the price.",
    "**Building permit:** The Contractor will obtain the required building permit. Owners who obtain their own permits or deal with unregistered contractors will not have access to the arbitration program or the Residential Contractors' Guaranty Fund.",
    "**Registration notice:** All home improvement contractors and subcontractors shall be registered with the Office of Consumer Affairs and Business Regulation. Any inquiries about a contractor relating to a violation of M.G.L. c.142A should be directed to the Office of Consumer Affairs and Business Regulation, Home Improvement Contractor Program, Boston, Massachusetts (www.mass.gov/hic).",
    "**Owner's rights:** The Owner may be entitled to arbitration (M.G.L. c.142A, §4) and to compensation from the Residential Contractors' Guaranty Fund (M.G.L. c.142A, §19) under the conditions set by law.",
    "**Three-day right to cancel:** The Owner may cancel this contract, without penalty or obligation, by delivering written notice of cancellation to the Contractor at the address above before midnight of the third business day after the date it is signed (M.G.L. c.93, §48, where applicable). Payments made will be returned within ten (10) days after the notice of cancellation is received."
  ];
  function isResidentialClient(role) { return /home ?owner|propriet|\bdono\b|\bowner\b|resid/i.test(role || "") && !/property manager|developer|contractor/i.test(role || ""); }
  // texto do bloco HIC ("" quando não se aplica). ctx: { state, role, brand, hic, address, client, where, start, end }
  function tradeHic(id, ctx) {
    ctx = ctx || {}; var t = tradeDef(id);
    if (!t.proposal.hic || stCode(ctx) !== "MA" || !isResidentialClient(ctx.role)) return "";
    var blank = "____________";
    return HIC_LINES.map(function (l) {
      return fill(l, { brand: ctx.brand || "Contractor", addr: ctx.address ? ", " + ctx.address : "", hic: ctx.hic || blank, client: ctx.client || blank, where: ctx.where || blank, start: ctx.start || blank, end: ctx.end || blank });
    }).join("\n");
  }
  // avisos da ficha (spec.warnings: [{ if: Cond, msg: Txt }]) — ex.: pintura "Exterior" com "Tetos" marcados
  function tradeWarnings(id, d, co) {
    var t = tradeDef(id), out = [];
    (t.warnings || []).forEach(function (w) { if (suggestFor({ suggest: { vars: (t.suggest || {}).vars || {}, rules: [{ "if": w["if"], add: [["", ""]] }] } }, d || {}, co).length) out.push(txt(w.msg)); });
    return out;
  }
  // campos de lista (multi): os de todos os ramos + "access", menos os que o ramo deste projeto define como opção única
  function tradeOpts(id, key, co, cur) {
    var f = tradeDef(id).fields[key]; if (!f) return [];
    var hide = []; Object.keys(f.coHide || {}).forEach(function (k) { if (co && co[k]) hide = hide.concat(f.coHide[k]); });
    if (f.legacy && !(co && co._preset)) hide = hide.concat(f.legacy);
    var keep = isArr(cur) ? cur : [cur];
    return f.opts.filter(function (o) { return hide.indexOf(o) < 0 || keep.indexOf(o) >= 0; });
  }
  function tradeAiRules(id, co) {
    var t = tradeDef(id), r = t.proposal.aiRules || "";
    t.companyFlags.forEach(function (f) { if (co && co[f.key] && f.aiRule) r += (r ? "\n" : "") + f.aiRule; });
    return r;
  }
  function tradeMultiKeys(id) {
    var keys = ["access"], mine = id ? tradeDef(id).fields : {};
    LIST.forEach(function (t) { Object.keys(t.fields).forEach(function (k) { if (t.fields[k].multi && keys.indexOf(k) < 0 && !(mine[k] && !mine[k].multi)) keys.push(k); }); });
    return keys;
  }

  // ═══════════ fala (modo sem IA): preço, divisão do pagamento, seções e fatos ═══════════
  // Usado por proposals.js → localBuild() quando a IA não está ligada. Testes: tests/fala.js (sem navegador) e tests/qa-ramos.js.

  // números por extenso (PT e EN) → dígitos. Só sequências com multiplicador (mil, thousand, hundred, cem…) ou de 2+ palavras
  // viram número — "uma heat pump" / "one layer" ficam como estão (para o preço). nwords() devolve o valor de UMA expressão.
  var NW = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
    cinquenta: 50, "cinqüenta": 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
    quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800,
    oitocentas: 800, novecentos: 900, novecentas: 900,
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  var NW_MUL = { mil: 1e3, thousand: 1e3, "milhão": 1e6, milhao: 1e6, "milhões": 1e6, milhoes: 1e6, million: 1e6, hundred: 100 };
  var NW_JOIN = { e: 1, and: 1 };
  function nwTok(w) { return String(w).toLowerCase().replace(/[^a-zà-ÿ]/g, ""); }
  function nwords(words) { // ["setenta","e","oito","mil"] → 78000
    var total = 0, cur = 0, any = false;
    for (var i = 0; i < words.length; i++) {
      var w = nwTok(words[i]); if (NW_JOIN[w]) continue;
      if (own(NW, w)) { cur += NW[w]; any = true; }
      else if (w === "hundred") { cur = (cur || 1) * 100; any = true; }
      else if (own(NW_MUL, w)) { total += (cur || 1) * NW_MUL[w]; cur = 0; any = true; }
      else return null;
    }
    return any ? total + cur : null;
  }
  var NW_RE = new RegExp("(?:\\b(?:" + Object.keys(NW).concat(Object.keys(NW_MUL)).sort(function (a, b) { return b.length - a.length; }).join("|") + ")\\b(?:[\\s-]+(?:(?:e|and)[\\s-]+)?)?)+", "gi");
  // "doze mil e quinhentos" → "⟨12500⟩" (marca: veio de palavras com multiplicador)
  function wordsToDigits(s) {
    return String(s).replace(NW_RE, function (m, at, all) {
      if (/\d[\s.,]*$/.test(all.slice(Math.max(0, at - 4), at))) return m; // "48 mil", "16,9 mil": o número já está em dígitos
      var ws = m.trim().split(/[\s-]+/).filter(Boolean); while (ws.length && NW_JOIN[nwTok(ws[ws.length - 1])]) ws.pop();
      var hasMul = ws.some(function (w) { var k = nwTok(w); return own(NW_MUL, k) || k === "hundred" || /^(cem|cento|\w+entos|\w+entas)$/.test(k); });
      if (!hasMul || ws.length < 2 && !own(NW_MUL, nwTok(ws[0]))) return m;
      var v = nwords(ws); if (v == null) return m;
      var tail = /\s$/.test(m) ? " " : "";
      return "⟨" + v + "⟩" + tail;
    });
  }
  // contagem de 1 palavra ou dígitos: "duas" → 2, "12" → 12
  function countOf(w) { if (/^\d+$/.test(w)) return Number(w); var k = nwTok(w); return own(NW, k) && NW[k] > 0 ? NW[k] : null; }
  var EN_NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

  // número escrito com dígitos: "12.800" (PT), "12,800" (EN), "16,9" / "9.5" (decimal), "1.250,50", "$1,250.50"
  function parseNum(s) {
    s = String(s);
    var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
    if (dots && commas) { var dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ","; return Number(s.split(dec === "." ? "," : ".").join("").replace(dec, ".")); }
    var sep = dots ? "." : commas ? "," : "";
    if (!sep) return Number(s);
    var parts = s.split(sep);
    if (parts.length > 2 || parts.slice(1).every(function (p) { return p.length === 3; })) return Number(parts.join("")); // separador de milhar
    return Number(parts[0] + "." + parts[1]); // decimal
  }

  // unidades técnicas logo DEPOIS do número: nunca é preço (BTU, ton, psi, gpm, sq ft, squares, LF, CY, A, V, kW, gauge…)
  var UNIT_AFTER = new RegExp("^[\\s-]*(?:" + [
    "btu\\w*", "mbh", "tons?\\b", "toneladas?", "psi\\b", "psf\\b", "gpm\\b", "cfm\\b", "sq\\.?\\s?ft", "sqft", "sf\\b", "squares?\\b", "quadrad\\w*", "p[ée]s?\\b", "ft\\b", "feet\\b",
    "foot\\b", "lf\\b", "linear", "lineares", "cy\\b", "cubic", "c[uú]bic\\w*", "jardas?\\b", "yards?\\b", "yds?\\b", "amps?\\b", "amperes?\\b", "v\\b", "volts?\\b",
    "kw\\w*", "kva\\b", "ga\\b", "gauge\\b", "awg\\b", "mm\\b", "cm\\b", "m\\b(?!\\w)", "metros?\\b", "in\\.", "inch\\w*", "polegadas?\\b", "pol\\b", "\"", "'", "%", "por\\s?cento",
    "percent\\b", "anos?\\b", "years?\\b", "yrs?\\b", "dias?\\b", "days?\\b", "horas?\\b", "hours?\\b", "hrs?\\b", "h\\b", "semanas?\\b", "weeks?\\b", "meses\\b", "months?\\b",
    "unidades?\\b", "units?\\b", "apartamentos?\\b", "apts?\\b", "andares\\b", "andar\\b", "stor(?:y|ies)\\b", "floors?\\b", "quartos?\\b", "bedrooms?\\b", "banheiros?\\b",
    "bathrooms?\\b", "cabe[cç]as?\\b", "heads?\\b", "bicos?\\b", "folhas?\\b", "sheets?\\b", "placas?\\b", "boards?\\b", "gal[õo]es\\b", "gal(?:lons?)?\\b", "lbs?\\b", "libras?\\b",
    "°", "graus?\\b", "degrees?\\b", "zonas?\\b", "zones?\\b", "seer\\w*", "hspf\\w*", "micr[oô]ns?\\b", "watts?\\b", "w\\b", "hz\\b", "x\\s?\\d", "por\\s+\\d", "by\\s+\\d",
    "dem[ãa]os\\b", "coats?\\b", "camadas?\\b", "layers?\\b", "bundles?\\b", "fardos?\\b", "caixas?\\b", "boxes\\b", "rolos?\\b", "rolls?\\b", "pe[cç]as?\\b", "pieces?\\b",
    "pcs\\b", "ea\\b", "un\\b", "pontos?\\b", "tomadas?\\b", "outlets?\\b", "circuitos?\\b", "circuits?\\b", "luzes\\b", "lights?\\b", "janelas?\\b", "windows?\\b", "portas?\\b",
    "doors?\\b", "fam[ií]lias?\\b", "family\\b", "-?family\\b", "vagas?\\b", "pessoas\\b", "people\\b", "homens\\b", "men\\b", "/\\s?\\d", "th\\b", "st\\b", "nd\\b", "rd\\b",
    "º", "ª", "mil\\s+btu", "k\\s?btu", "mil\\s+(?:de\\s+)?espessura", "mil\\s+thick", "-?mil\\b(?=\\s+(?:epdm|tpo|pvc|membrane|membrana|vapor|poly|liner|barrier))",
    "(?:por|per|/|a)\\s*(?:jarda|yard|yd|cy|sq|sf|p[ée]|ft|foot|folha|sheet|cabe[cç]a|head|hora|hour|hr|dia|day|unidade|unit|square|metro|ponto|tomada|circuito)"
  ].join("|") + ")", "i");
  // logo ANTES do número: modelo, norma, endereço, fração… nunca é preço
  var BEFORE_TECH = /(?:\br-?|seer2?|hspf2?|eer2?|afue|schedule|sch\.?|nfpa|\bul|astm|aci|#|n[ºo°]\.?|model[o]?|cmr|c\.|§|se[cç][aã]o|section|tabela|table|r\d{3}\.|\bx|\/|-|×|nível|level|class(?:e)?|type|tipo|zona|zone|\bgrau|r-value|\bv|cat|ip|nema|gauge)\s*$/i;
  // contexto de preço ANTES do número (até 4 palavras, na mesma frase)
  var PRICE_STRONG = /(?:pre[cç]o|precio|cuesta|costo|valor|total|price|pricing|cost|custo|cobr\w*|quote|or[cç]amento|budget|investimento|investment|lump\s?sum|contrato|contract|fechad[oa]|fechamos|amount|vale|sai\s+(?:a|por)|fica(?:r)?(?:\s+(?:em|por))?|tudo\s+por|for\s+a\s+total\s+of|charge|cobramos)\b/i;
  var PRICE_WEAK = /(?:\bfor|\bpor|\bat|\bde|\bem|\bpara)\s*$/i;
  // valores que NÃO são o total do contrato (depósito, já pago, desconto, preço unitário, rebate…)
  var NOT_TOTAL = /(?:dep[oó]sito|deposit|entrada|sinal|anticipo|down\s?payment|\bdown|j[aá]\s+pag\w*|ya\s+pag\w*|paid|pagou|pago|desconto|discount|rebate|incentiv\w*|reembolso|cr[eé]dito|credit|allowance|verba|unit[aá]ri\w*|unit\s+price|each|cada|por\s+unidade|adicional|additional|extra)\b[^.;:!?\n]{0,12}$/i;
  var MONEY_AFTER = /^\s*(?:d[oó]lares|dollars|bucks|usd|reais)\b/i;

  // preço total falado (0 = não achou). Número só vale como preço com contexto de preço ($, "preço", "valor", "total", "price", "for", "mil/k"…);
  // nunca com unidade técnica (BTU, ton, psi, gpm, mil de membrana, sq ft, squares, LF, CY, A, V, kW, gauge…). Entende 78K, $78,000, 78 thousand,
  // setenta e oito mil, seventy-eight thousand, 16,9 mil, 1.2 million.
  function speechPrice(text) {
    var s = wordsToDigits(String(text || "").replace(/\s+/g, " "));
    var re = /(\$\s?)?(?:⟨(\d+)⟩|(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?))(\s?(?:k\b|mil\b|thousand\b|grand\b|milh[õo]es\b|milh[ãa]o\b|million\b|mm\b|m\b(?!\s*(?:²|2\b))))?/gi;
    var m, cands = [];
    while ((m = re.exec(s))) {
      var start = m.index, end = start + m[0].length, before = s.slice(Math.max(0, start - 60), start), after = s.slice(end, end + 40);
      var dollar = !!m[1], words = !!m[2], mul = (m[4] || "").trim().toLowerCase();
      if (/[\w.,]$/.test(before) && !dollar) continue; // meio de palavra / modelo (ex.: "XR16", "R454")
      if (mul === "m" && !dollar) continue;           // "m" sozinho = metro
      var v = words ? Number(m[2]) : parseNum(m[3]);
      if (!isFinite(v)) continue;
      if (mul === "k" || mul === "mil" || mul === "thousand" || mul === "grand") v *= 1e3;
      else if (/milh|million|mm|^m$/.test(mul)) v *= 1e6;
      // unidade técnica depois (para "60 mil" o resto vem depois de "mil"; "mil" de membrana / BTU)
      var tail = mul ? after : (m[4] || "") + after;
      if (UNIT_AFTER.test(tail)) continue;
      if (mul === "mil" && /(?:tpo|epdm|pvc|membran\w*|espessura|thick\w*|vapor|poly\w*|barreira|liner|lona)\W*(?:\w+\W+){0,1}$/i.test(before)) continue; // "TPO 60 mil" = espessura
      if (mul === "mil" && UNIT_AFTER.test(after)) continue;
      if (!mul && /^(?:a|v|w|kw|kva|ft|lf|sf|cy|gpm|psi|btu\w*|mm|cm|t|h|x|hp)\b/i.test(after)) continue; // unidade colada: 200A, 240V, 3T
      var clause = before.split(/[.;!?\n]/).pop();     // mesma frase
      if (!dollar && BEFORE_TECH.test(clause)) continue;
      if (/^\s*\/\s*\d/.test(after) || /\d\s*\/\s*$/.test(before)) continue;  // 30/40/30, 5/8
      if (!dollar && !mul && !words && v >= 1900 && v <= 2099 && /(?:de|from|em|in|built|constru\w*|ano|year|desde|since|casa|house|home)\s*$/i.test(clause)) continue; // ano
      if (/^\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Blvd|Rua|Av)\b/.test(after)) continue; // endereço
      if (NOT_TOTAL.test(clause)) continue;
      var near = clause.split(/\s+/).slice(-5).join(" ");
      var score = 0;
      if (PRICE_STRONG.test(near)) score = 3;
      else if (dollar || MONEY_AFTER.test(after)) score = 2;
      else if (mul || words) score = 1;
      else if (PRICE_WEAK.test(near) && /[.,]\d{3}\b/.test(m[3] || "")) score = 1; // "por 12.800"
      if (dollar && score < 2) score = 2;
      if (!score) continue;
      if (v < (score >= 2 ? 50 : 300) || v >= 5e7) continue;
      cands.push({ v: Math.round(v * 100) / 100, score: score, at: start });
    }
    if (!cands.length) return 0;
    cands.sort(function (a, b) { return b.score - a.score || b.v - a.v; });
    return cands[0].v;
  }

  // divisão do pagamento falada: "30/40/30", "50/50", "metade na entrada", "half down", "la mitad de depósito" → [30, 40, 30] (null = não falou)
  function speechSplit(text) {
    var s = String(text || ""), m = /(?:^|[^\d/])(\d{1,2})\s?\/\s?(\d{1,2})(?:\s?\/\s?(\d{1,2}))?(?:\s?\/\s?(\d{1,2}))?(?![\d/])/.exec(s);
    if (m) { var a = [m[1], m[2], m[3], m[4]].filter(Boolean).map(Number); if (a.reduce(function (x, y) { return x + y; }, 0) === 100) return a; }
    if (/metade (?:na|de) entrada|half (?:down|up ?front)|50\s?% (?:de |na )?entrada|50\s?% (?:down|deposit)|(?:la )?mitad (?:de|como|al) (?:dep[oó]sito|anticipo|entrada|inicio)|50\s?% (?:de )?(?:dep[oó]sito|anticipo)/i.test(s)) return [50, 50];
    return null;
  }

  // a fala parece inglês? (só para "no" como negação — em PT "no" = "em + o")
  function looksEnglish(s) {
    var en = (String(s).match(/\b(?:the|and|with|new|install|replace|price|of|to|for|at|existing|remove|is|by|we|need|a|an|on|in|house|building|system|heads?|units?|tear|old|all|our|this|it|don't|doesn't|no|not|without)\b/gi) || []).length;
    var pt = (String(s).match(/\b(?:de|da|do|das|dos|com|para|trocar|tirar|os|as|uma|um|pre[cç]o|nova|novo|casa|instalar|sem|n[aã]o|na|no|nos|nas|e|o|que|precisa|cabe[cç]as|sistema|pr[eé]dio|velho|tudo)\b/gi) || []).length;
    return en > pt;
  }
  var NEG_BEFORE = /(?:^|\s)(?:sem|n[aã]o|nenhum[a]?|nem|exceto|menos|without|not|except|excluding|never|nunca|w\/o|\w+n't|no)\s+(?:\S+\s+){0,2}$/i;
  var NEG_BEFORE_PT = /(?:^|\s)(?:sem|n[aã]o|nenhum[a]?|nem|exceto|menos|without|except|excluding)\s+(?:\S+\s+){0,2}$/i;
  var BY_OTHERS_AFTER = /^\S*(?:\s+\S+){0,3}?\s+(?:por outros|por terceiros|pelo (?:dono|cliente|propriet[aá]rio|gc)|by others|by (?:the )?(?:owner|gc|general contractor))\b/i;
  // a regex do ramo aparece na fala SEM estar negada ("sem bomba", "no fire pump", "não precisa de bomba") nem "por outros"
  function speechHas(re, speech, opt) {
    opt = opt || {};
    if (re.source === ".") return true;
    var s = String(speech || ""), en = looksEnglish(s), g = new RegExp(re.source, "gi"), m;
    while ((m = g.exec(s))) {
      if (!m[0]) { g.lastIndex++; continue; }
      var before = s.slice(Math.max(0, m.index - 50), m.index).split(/[.;:!?\n,]|\s(?:e|and|mas|but|com|with|plus|mais|porém|however)\s/i).pop() + " ";
      var after = s.slice(m.index, m.index + m[0].length + 40).split(/[.;:!?\n,]/)[0];
      var neg = opt.negate === false ? false : (en ? NEG_BEFORE : NEG_BEFORE_PT).test(before);
      if (!neg && opt.negate !== false && opt.byOthers !== true && BY_OTHERS_AFTER.test(after)) neg = true;
      if (!neg) return true;
    }
    return false;
  }

  // fatos lidos da fala para os textos padrão (proposal.facts): {layers}, {standard}… — sem fonte, texto neutro (fallback)
  function factValue(f, speech) {
    var s = String(speech || "");
    if (f.any) { for (var ai = 0; ai < f.any.length; ai++) { var av = factValue(f.any[ai], s); if (av != null) return av; } return null; }
    if (f.count) {
      var cre = new RegExp("(\\d+|[a-zà-ÿ]+)\\s+(?:(?:de|of|do|da)\\s+)?(?:[\\wà-ÿ-]+\\s+){0," + (f.gap == null ? 1 : f.gap) + "}(?:" + f.count + ")\\b", "gi"), cm;
      while ((cm = cre.exec(s))) {
        var n = countOf(cm[1]); if (n == null || n <= 0 || n > (f.max || 100000)) { cre.lastIndex = cm.index + cm[1].length + 1; continue; }
        var w = n <= 20 ? EN_NUM[n] : String(n), wn = n <= 20 ? w + " (" + n + ")" : String(n);
        return fill(n === 1 && f.one ? f.one : f.many || "{wn}", { n: String(n), w: w, wn: wn, W: w.charAt(0).toUpperCase() + w.slice(1), WN: wn.charAt(0).toUpperCase() + wn.slice(1) });
      }
    }
    if (f.pick) {
      var out = [];
      for (var i = 0; i < f.pick.length; i++) if (speechHas(new RegExp(f.pick[i][0], "i"), s)) { if (out.indexOf(f.pick[i][1]) < 0) out.push(f.pick[i][1]); if (!f.all) break; }
      if (out.length) return out.join(f.join || " and ");
    }
    if (f.match) { var mm = new RegExp(f.match, "i").exec(s); if (mm) return fill(f.fmt || "{m}", { m: mm[0].trim() }); }
    if (f.re) { // {1} = 1º grupo preenchido; {g1}…{g9} = cada grupo ("" se vazio); "cs": true = maiúsculas importam (marcas)
      var rm = new RegExp(f.re, f.cs ? "" : "i").exec(s);
      if (rm) {
        var g1 = rm.slice(1).filter(function (x) { return x != null && x !== ""; })[0] || rm[0], gx = { 1: g1 };
        for (var gi = 1; gi < 10; gi++) gx["g" + gi] = rm[gi] || "";
        return fill(f.fmt || "{1}", gx);
      }
    }
    return null;
  }
  function factsFill(text, facts, speech) {
    return String(text || "").replace(/\{([a-z]\w*)\}/gi, function (m0, k) {
      var f = facts && facts[k]; if (!f) return m0;
      var v = speech ? factValue(f, speech) : null;
      return v != null ? v : f.fallback || "";
    });
  }

  // linhas / itens condicionais nos textos padrão: "[MA] …" só para empresa de MA, "[!MA] …" para os outros estados,
  // "[co:noGas] …" só com a opção da empresa marcada, "[!co:noGas] …" só sem ela. Em "notIncluded" vale por item (" · ").
  function condOk(c, ctx) {
    var neg = c.charAt(0) === "!", k = neg ? c.slice(1) : c, ok;
    if (/^co:/.test(k)) ok = !!(ctx.co && ctx.co[k.slice(3)]);
    else ok = String(ctx.state || "").toUpperCase() === k.toUpperCase();
    return neg ? !ok : ok;
  }
  function condLines(text, ctx, sep) {
    var parts = String(text || "").split(sep || "\n"), out = [];
    parts.forEach(function (l) {
      var m = /^\s*\[([!\w:]+(?:\s*&\s*[!\w:]+)*)\]\s*/.exec(l);
      if (m) { if (!m[1].split(/\s*&\s*/).every(function (c) { return condOk(c, ctx); })) return; l = l.slice(m[0].length); }
      out.push(l);
    });
    return out.join(sep || "\n");
  }
  // estados sem imposto geral sobre vendas (sales tax) — NH, DE, MT, OR, AK
  var NO_SALES_TAX = { NH: 1, DE: 1, MT: 1, OR: 1, AK: 1 };

  // ═══════════ os ramos ═══════════
  // Formato: docs/ramos/ESQUEMA.md. Os 4 ramos de antes usam { key, pt } (o EN está em i18n.en.js); ramos novos usam { pt, en }.
  var DEFS = [
    {
      id: "electrical",
      aliases: [],
      order: 10,
      category: "mep",
      label: {"key":"catalog.electrical","pt":"Elétrica"},
      companySuffix: "Electric",
      onboarding: {"label":{"key":"ob.trade.electrical","pt":"Elétrica"},"desc":{"key":"ob.trade.electrical.d","pt":"Serviço, rough-in, acabamento, fire alarm"}},
      icon: "bolt",
      kind: {"key":"projects.electricalWork","pt":"trabalho elétrico"},
      stepName: {"key":"catalog.electrical","pt":"Elétrica"},
      group: {"label":{"key":"common.electricalService","pt":"Serviço elétrico"},"icon":"bolt"},
      workType: ["New Construction","Remodel / Renovação","Addition (ampliação)","Service upgrade","Reparo / service call","Fire alarm"],
      fields: {
        wiring: {
          label: {"key":"catalog.wiringMethod","pt":"Fiação / método"},
          multi: true,
          opts: ["Romex (NM-B)","MC Cable","EMT (conduíte)","PVC","Rigid / IMC","BX existente","Knob & tube existente"]
        },
        serviceType: {
          label: {"key":"catalog.service","pt":"Serviço (service)"},
          opts: ["Sem mudança no serviço","Novo serviço","Upgrade (100A → 200A)","Upgrade (outro)","Troca de painel apenas","Subpainel novo"]
        },
        serviceAmps: {"label":{"key":"catalog.amperage","pt":"Amperagem"},"opts":["60A","100A","150A","200A","320/400A","600A+"]},
        phase: {"label":{"key":"catalog.voltagePhase","pt":"Tensão / fase"},"opts":["Monofásico 120/240V","Trifásico 120/208V","Trifásico 277/480V"]},
        serviceFeed: {"label":{"key":"catalog.serviceEntrance","pt":"Entrada do serviço"},"opts":["Aéreo","Subterrâneo"]},
        utility: {"label":{"key":"catalog.utility","pt":"Concessionária"},"opts":["Eversource","National Grid","Unitil","Municipal (light dept.)","Outra"]},
        fireAlarm: {"label":"Fire alarm","system":true,"opts":["Sim","Não","Só detectores interligados"]},
        lowVoltage: {"label":{"key":"catalog.lowVoltageDataTv","pt":"Low voltage (dados/TV/câmeras)"},"system":true,"opts":["Sim","Não"]},
        extras: {
          label: {"key":"catalog.specialItems","pt":"Itens especiais"},
          multi: true,
          system: true,
          opts: [
            "Carregador EV", "Gerador / transfer switch", "Solar", "Piscina / spa", "Snow melt", "Aquecimento elétrico (baseboard)", "Circuitos de mini-split",
            "Iluminação externa / paisagismo"
          ]
        }
      },
      text: [
        {"key":"panel","label":{"key":"catalog.panelBrandModel","pt":"Painel (marca / modelo)"}},
        {"key":"unitsCount","label":{"key":"catalog.unitsMultifamily","pt":"Unidades (multifamily)"}}
      ],
      units: [{"id":"ea","label":{"key":"prices.unitEach","pt":"un"}},{"id":"ft","label":"ft"},{"id":"a","label":"A"}],
      tasks: {
        "Serviço": [
          "Upgrade / instalação de serviço", "Troca de painel", "Meter socket", "Aterramento (ground rods / bonding)", "Coordenação com a concessionária",
          "Subpainel"
        ],
        "Rough-in": [
          "Rough-in elétrico", "Caixas e furação", "Circuitos dedicados da cozinha", "Circuito do banheiro (GFCI)", "Circuitos AFCI dos quartos",
          "Detectores de fumaça / CO", "Iluminação recessed", "Ventilador de teto", "Exaustor de banheiro", "Circuito da condensadora (HVAC)",
          "Circuito 240V (secadora / fogão)", "Carregador EV", "Gerador / transfer switch", "Low voltage (dados / TV)", "Fire alarm — rough"
        ],
        Acabamento: [
          "Instalar tomadas e interruptores", "Trocar tomadas", "Trocar interruptores", "Instalar luminárias", "Tampas e placas",
          "Identificar circuitos do painel", "Fire alarm — dispositivos e teste"
        ],
        "Inspeções": ["Inspeção de serviço","Inspeção rough","Inspeção final","Inspeção de fire alarm"]
      },
      // proposta → tarefas (tasks-core.js): linha do escopo/itens (sem acento, minúsculas) → [grupo, tarefa]. ctx = título da seção + linha; not = não casa
      taskMatch: [
        { t: ["Serviço", "Upgrade / instalação de serviço"], re: "(service|servico|servicio)\\b.{0,30}(upgrade|entrance|change)|upgrade.{0,40}\\b(service|servico|servicio)\\b|new \\d{2,3} ?a(mp)? service|novo servico|servicio nuevo" },
        { t: ["Serviço", "Troca de painel"], re: "(?<!sub[- ]?)(panel|painel|load ?center|tablero)|main breaker", not: "label|identif|directory|schedule|rotul|at the panel|no painel|sub[- ]?panel|subpainel|subtablero|fire alarm|facp" },
        { t: ["Serviço", "Meter socket"], re: "meter (socket|base|pan)|medidor" },
        { t: ["Serviço", "Aterramento (ground rods / bonding)"], re: "ground(ing)? (rod|electrode)|bonding|aterramento|puesta a tierra|varilla" },
        { t: ["Serviço", "Coordenação com a concessionária"], re: "utility|eversource|national grid|unitil|concessionaria|compania electrica", not: "utility (room|sink|closet)" },
        { t: ["Serviço", "Subpainel"], re: "sub[- ]?panel|subpainel|subtablero" },
        { t: ["Rough-in", "Rough-in elétrico"], re: "rough[- ]?in (wiring|electrical)|complete rough|rough wiring|fiacao|cableado completo" },
        { t: ["Rough-in", "Circuitos dedicados da cozinha"], re: "dedicated|small[- ]appliance|countertop|dedicad", ctx: "kitchen|cozinha|cocina|refrigerator|dishwasher|disposal|microwave" },
        { t: ["Rough-in", "Circuito do banheiro (GFCI)"], re: "gfci|dedicated|circuit|dedicad|circuito", ctx: "bath|banheiro|bano" },
        { t: ["Rough-in", "Circuitos AFCI dos quartos"], re: "afci", ctx: "bedroom|quarto|dormitorio|habitacion", not: "dual function breakers for all" },
        { t: ["Rough-in", "Detectores de fumaça / CO"], re: "smoke|carbon monoxide|\\bco detector|fumaca|\\bhumo\\b" },
        { t: ["Rough-in", "Iluminação recessed"], re: "recessed|wafer|downlight|pot ?lights?|can lights?|embutid|empotrad" },
        { t: ["Rough-in", "Ventilador de teto"], re: "ceiling fan|ventilador de teto|ventilador de techo" },
        { t: ["Rough-in", "Exaustor de banheiro"], re: "exhaust fan|bath fan|exaustor|extractor" },
        { t: ["Rough-in", "Circuito da condensadora (HVAC)"], re: "condens|heat pump|mini[- ]?split|\\bhvac\\b|air handler|a/c unit|\\bac unit" },
        { t: ["Rough-in", "Circuito 240V (secadora / fogão)"], re: "240 ?v|dryer|\\brange\\b|stove|\\boven\\b|cooktop|secadora|fogao|estufa", not: "range hood|hood" },
        { t: ["Rough-in", "Carregador EV"], re: "\\bev\\b|electric vehicle|ev charger|level 2 charg|carregador|cargador" },
        { t: ["Rough-in", "Gerador / transfer switch"], re: "generator|transfer switch|interlock|gerador|generador" },
        { t: ["Rough-in", "Low voltage (dados / TV)"], re: "low[- ]?voltage|\\bdata\\b|cat ?[56]|coax|\\btv\\b|network|baixa tensao|bajo voltaje" },
        { t: ["Rough-in", "Fire alarm — rough"], re: "fire alarm|alarme de incendio|alarma contra incendio|\\bfacp\\b|pull station|horn|strobe" },
        { t: ["Acabamento", "Fire alarm — dispositivos e teste"], re: "fire alarm|alarme de incendio|alarma contra incendio", ctx: "device|test|dispositiv|teste|prueba|acceptance" },
        { t: ["Acabamento", "Instalar tomadas e interruptores"], re: "receptacle|outlet|switch|dimmer|tomada|interruptor|enchufe|tomacorriente", not: "transfer switch|replace|swap|trocar|substituir|reemplazar|cambiar" },
        { t: ["Acabamento", "Trocar tomadas"], re: "(replace|swap|trocar|substituir|reemplazar|cambiar).{0,50}(receptacle|outlet|device|tomada|enchufe|tomacorriente)" },
        { t: ["Acabamento", "Trocar interruptores"], re: "(replace|swap|trocar|substituir|reemplazar|cambiar).{0,60}(switch|interruptor)" },
        { t: ["Acabamento", "Instalar luminárias"], re: "light fixture|fixtures|luminaria|vanity light|pendant|sconce|chandelier|lampara", not: "plumbing fixture|remove|remover|retirar|quitar" },
        { t: ["Acabamento", "Tampas e placas"], re: "cover ?plates?|wall ?plates?|device plates?|tampas|placas|tapas" },
        { t: ["Acabamento", "Identificar circuitos do painel"], re: "label|identif|panel directory|panel schedule|rotul" },
        { t: ["Inspeções", "Inspeção de serviço"], re: "inspect|inspec", ctx: "service|servico|servicio" },
        { t: ["Inspeções", "Inspeção rough"], re: "rough.{0,20}inspect|inspect.{0,30}rough|inspec\\w* (do |de )?rough|\\binspections\\b|inspecoes|inspecciones" },
        { t: ["Inspeções", "Inspeção final"], re: "final.{0,20}inspect|inspect.{0,30}final|inspec\\w* final|sign[- ]?off|\\binspections\\b|inspecoes|inspecciones" },
        { t: ["Inspeções", "Inspeção de fire alarm"], re: "inspect|inspec|acceptance test", ctx: "fire alarm|alarme de incendio|alarma contra incendio" }
      ],
      suggest: {
        vars: {"svc":{"f":"serviceType","ne":"Sem mudança no serviço"}},
        rules: [
          {
            if: {"var":"svc"},
            add: [
              ["Serviço","Upgrade / instalação de serviço"], ["Serviço","Aterramento (ground rods / bonding)"], ["Serviço","Coordenação com a concessionária"]
            ]
          },
          {"if":{"all":[{"var":"svc"},{"f":"serviceType","re":"Novo|Upgrade"}]},"add":[["Serviço","Meter socket"],["Serviço","Troca de painel"]]},
          {"if":{"all":[{"var":"svc"},{"f":"serviceType","re":"Troca de painel"}]},"add":[["Serviço","Troca de painel"]]},
          {"if":{"all":[{"var":"svc"},{"f":"serviceType","re":"Subpainel"}]},"add":[["Serviço","Subpainel"]]},
          {"if":{"var":"svc"},"add":[["Inspeções","Inspeção de serviço"]]},
          {
            if: {"var":"newish"},
            add: [
              ["Rough-in","Rough-in elétrico"], ["Rough-in","Caixas e furação"], ["Rough-in","Detectores de fumaça / CO"],
              ["Acabamento","Instalar tomadas e interruptores"], ["Acabamento","Instalar luminárias"], ["Acabamento","Tampas e placas"],
              ["Acabamento","Identificar circuitos do painel"], ["Inspeções","Inspeção rough"]
            ]
          },
          {"if":{"all":[{"var":"newish"},{"f":"bedrooms","filled":true}]},"add":[["Rough-in","Circuitos AFCI dos quartos"]]},
          {
            if: {"all":[{"var":"newish"},{"f":"bathrooms","filled":true}]},
            add: [["Rough-in","Circuito do banheiro (GFCI)"],["Rough-in","Exaustor de banheiro"]]
          },
          {
            if: {"all":[{"var":"newish"},{"f":"sector","re":"Residencial|Multifamily"}]},
            add: [["Rough-in","Circuitos dedicados da cozinha"],["Rough-in","Circuito 240V (secadora / fogão)"]]
          },
          {
            if: {"all":[{"not":{"var":"newish"}},{"f":"workType","re":"Remodel|Reparo"}]},
            add: [["Acabamento","Trocar tomadas"],["Acabamento","Trocar interruptores"]]
          },
          {"if":{"f":"extras","has":"Carregador EV"},"add":[["Rough-in","Carregador EV"]]},
          {"if":{"f":"extras","has":"Gerador / transfer switch"},"add":[["Rough-in","Gerador / transfer switch"]]},
          {"if":{"f":"extras","has":"Circuitos de mini-split"},"add":[["Rough-in","Circuito da condensadora (HVAC)"]]},
          {"if":{"f":"lowVoltage","eq":"Sim"},"add":[["Rough-in","Low voltage (dados / TV)"]]},
          {
            if: {"f":"fireAlarm","eq":"Sim"},
            add: [["Rough-in","Fire alarm — rough"],["Acabamento","Fire alarm — dispositivos e teste"],["Inspeções","Inspeção de fire alarm"]]
          },
          {"if":{"f":"fireAlarm","eq":"Só detectores interligados"},"add":[["Rough-in","Detectores de fumaça / CO"]]},
          {"if":{"f":"permit","re":"Sim"},"add":[["Inspeções","Inspeção final"]]}
        ]
      },
      inspections: [
        {
          label: "Inspeção de serviço",
          authority: {"pt":"Inspetor elétrico da cidade + concessionária","en":"Town wiring inspector + utility","es":"Inspector eléctrico del municipio + compañía eléctrica"},
          when: {"pt":"Antes de a concessionária religar","en":"Before the utility reconnects","es":"Antes de que la compañía eléctrica reconecte"}
        },
        {
          label: "Inspeção rough",
          authority: {"pt":"Inspetor elétrico (527 CMR 12.00)","en":"Wiring inspector (527 CMR 12.00)","es":"Inspector eléctrico (527 CMR 12.00)"},
          when: {"pt":"Antes de fechar as paredes","en":"Before walls are closed","es":"Antes de cerrar las paredes"}
        },
        {
          label: "Inspeção de fire alarm",
          authority: {"pt":"Fire Department","en":"Fire Department","es":"Departamento de Bomberos"},
          when: {"pt":"Teste de aceitação","en":"Acceptance test","es":"Prueba de aceptación"}
        },
        {
          label: "Inspeção final",
          authority: {"pt":"Inspetor elétrico","en":"Wiring inspector","es":"Inspector eléctrico"},
          when: {"pt":"Acabamento pronto","en":"Finish complete","es":"Acabado completo"}
        }
      ],
      proposal: {
        title: "ELECTRICAL PROPOSAL",
        tagline: "LICENSED ELECTRICAL CONTRACTOR",
        role: "Licensed Electrical Contractor",
        scopeName: "Electrical",
        invoiceWork: "electrical",
        intro: {
          text: "This proposal covers the electrical scope of work for {what} at {where}. {code}",
          code: { // MA = texto de sempre (Eternity igual); NH / outros estados sem 527 CMR (QA 07, B10)
            MA: "Work will be performed in full compliance with the 2023 Massachusetts Electrical Code (527 CMR 12.00 / NEC 2023), the Massachusetts State Building Code 780 CMR (10th edition), and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed Massachusetts electricians under permit.",
            NH: "Work will be performed in full compliance with the National Electrical Code (NEC 2020) as adopted by the State of New Hampshire, the New Hampshire State Building Code, and the requirements of the local Authority Having Jurisdiction. All work will be performed by New Hampshire licensed electricians under permit.",
            "*": "Work will be performed in full compliance with the National Electrical Code (NEC) as adopted by the state, the applicable state building code, and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed electricians under permit."
          }
        },
        // fatos da fala (B04): amperagem e método de fiação vêm do que foi falado; sem fonte, texto neutro
        facts: {
          amps: { any: [
            { re: "(?:para|to|→|->|upgrade(?:\\s+(?:to|para))?|nov[oa]\\s+(?:de\\s+)?|new\\s+)\\s*(\\d{2,3})\\s?(?:a\\b|amps?\\b|amperes?\\b)", fmt: "**{1}A** " },
            { re: "\\b(\\d{3})\\s?(?:a\\b|amps?\\b|amperes?\\b)", fmt: "**{1}A** " } ], fallback: "" },
          wiring: { pick: [["\\bemt\\b|condu[ií]te|conduit", "**EMT conduit**"], ["\\bmc\\b|mc cable", "**MC cable**"], ["r[oô]mex|nm-?b", "**NM-B (Romex)** where permitted"], ["\\bpvc\\b", "**PVC conduit** where permitted"]], all: true, join: "; ",
            fallback: "**NM-B (Romex)** where permitted; **MC cable** where required" }
        },
        sections: [
          {
            title: "Service & Distribution",
            keywords: "servi[cç]o|service|\\b(100|150|200|400)\\s?(a|amp)|painel|panel|meter|medidor",
            text: "Furnish and install a new {amps}electrical service coordinated with the utility, including meter socket, service-entrance conductors, and grounding/bonding system per NEC Article 250.\nFurnish and install a new main panel with all required breakers, including AFCI/GFCI protection per NEC.\nBonding and grounding of the electrical system, including water and gas piping."
          },
          {
            title: "Rough-In & Wiring",
            keywords: "rough|fia[cç][aã]o|wiring|r[oô]mex|\\bmc\\b|rewire|refazer a fia",
            text: "Complete rough-in wiring per the plans and NEC, including all boxes, cable, supports, and fire-stopping at penetrations.\nWiring method: {wiring}.\nAll branch circuits labeled at the panel."
          },
          {
            title: "Devices & Lighting",
            keywords: "tomada|outlet|receptacle|interruptor|switch|recess|luz|luzes|light|dimmer|fixture|ilumina",
            text: "Install all required receptacles per NEC 210.52 — tamper-resistant (TR) throughout.\nWire and install all switching (single-pole, three-way, four-way and dimmers as required).\nFurnish and install LED recessed downlights per the reflected ceiling plan; quantity and trim to be confirmed at rough-in walk-through."
          },
          {
            title: "Kitchen & Bathrooms",
            keywords: "cozinha|kitchen|banheiro|bath",
            text: "Two (2) 20A small-appliance circuits with GFCI protection at all countertop receptacles.\nDedicated circuits for refrigerator, dishwasher, disposal, microwave / range hood.\nGFCI protection and dedicated 20A circuit for each bathroom; exhaust fan wiring (fan supplied by GC / Owner)."
          },
          {
            title: "Smoke / CO Detectors",
            keywords: "smoke|fuma[cç]a|detector",
            text: "[MA] Furnish and install hardwired, interconnected combination smoke / carbon-monoxide detectors per 527 CMR and the Massachusetts Smoke & CO Detector regulations.\n[!MA] Furnish and install hardwired, interconnected combination smoke / carbon-monoxide detectors per NFPA 72 and the state fire code as adopted."
          },
          {
            title: "HVAC & Equipment Connections",
            keywords: "hvac|condens|heat ?pump|mini.?split|ar.condicionado|air handler",
            text: "Provide power feed, disconnect, and whip for each condensing unit / heat pump.\nProvide power for air handler / furnace and thermostat low-voltage wiring as required."
          },
          {
            title: "Fire Alarm",
            keywords: "fire alarm|alarme de inc[eê]ndio",
            text: "Furnish and install the fire alarm system per the approved fire alarm drawings, NFPA 72 and local Fire Department requirements, including devices, wiring, testing, and Fire Department acceptance test coordination."
          },
          {
            title: "Low Voltage — Basic Rough-In",
            keywords: "low voltage|baixa tens[aã]o|\\bdata\\b|internet|\\btv\\b|cat ?6",
            text: "Provide low-voltage rough-in for **cable / TV** and **data / internet** at primary locations, and doorbell / intercom rough-in. Final termination by Owner / ISP."
          },
          {
            title: "Exterior & Garage",
            keywords: "exterior|externa|lado de fora|garage|garagem|outside",
            text: "Install weather-resistant GFCI receptacles with in-use covers at required exterior locations.\nWire exterior lighting at entries (fixtures supplied by Owner / GC)."
          },
          {
            title: "Permit & Inspections",
            keywords: ".",
            text: "Electrical permit will be pulled by us. Permit fees are included.\nCoordination of all required inspections (rough and final) with the Authority Having Jurisdiction."
          }
        ],
        defaults: {
          includes: "all labor, materials, supervision, project management, applicable {state} sales tax, and electrical permit fees and inspection coordination.",
          notIncluded: "Fire alarm system (unless listed above) · any engineering, stamped drawings, or design drawings · decorative light fixtures, pendants, sconces, chandeliers, and ceiling fans (supplied by Owner / GC; installation included where listed) · appliances · HVAC equipment supply (electrical connection only) · utility company charges and customer-contribution fees · trenching or excavation · drywall, patching, painting, framing, or carpentry · core drilling and structural penetrations.",
          clarifications: "Electrical permit will be pulled by {brand}. **Permit fees are included.**\n[MA] All work performed by licensed Massachusetts electricians under the direct supervision of our Master Electrician.\n[!MA] All work performed by licensed electricians under the direct supervision of our Master Electrician.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          warranty: "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, {state} Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        speechExample: {
          key: "proposals.eGTwoStory",
          pt: "Ex.: “Casa de dois andares. Trocar o serviço para 200 amp, 12 recessed na sala e cozinha, GFCI na cozinha e banheiros, detectores de fumaça interligados. Paredes abertas, Romex. Preço 9.500, 30/40/30.”"
        },
        speechExampleInvoice: {
          key: "proposals.eGInvoiceFor",
          pt: "Ex.: “Invoice da troca do painel para 200 amp e 6 tomadas GFCI na cozinha. Total 6.800, ele já pagou 3.400.”"
        },
        aiRules: "Trade: licensed ELECTRICAL contractor.\nCode references to use where relevant: 2023 Massachusetts Electrical Code (527 CMR 12.00 / NEC 2023), Massachusetts State Building Code 780 CMR (10th edition); in New Hampshire use \"NEC 2020 as adopted by the State of New Hampshire\".\nTypical section titles (pick only what the job needs, and prefer sections by AREA or SYSTEM such as \"Service Upgrade — 200A\", \"Kitchen\", \"Bathroom\", \"Basement\", \"Exterior\", \"Smoke / CO Detectors\", \"Permit & Inspections\").\nStyle of bullets: \"Furnish and install a new **200A** meter socket and main breaker panel, including service-entrance conductors and grounding/bonding per NEC Article 250.\"; \"Install all required receptacles per NEC 210.52 — tamper-resistant (TR) throughout.\"\nWiring: NM-B (Romex) where permitted, MC cable where required, EMT in commercial/exposed locations — follow what the speaker says."
      },
      prices: {
        stores: ["homedepot","ies","northeast","granite","standard"],
        basic: [
          ["Romex NM-B 14/2 — 250 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["Romex NM-B 12/2 — 250 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["Romex NM-B 14/3 — 250 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["Romex NM-B 12/3 — 250 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["Romex NM-B 10/3 — 125 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["MC 12/2 — 250 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["THHN 12 AWG — 500 ft",{"key":"prices.wireAndCable","pt":"Fio e cabo"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["EMT 1/2\" — 10 ft",{"key":"prices.conduit","pt":"Conduíte"},{"key":"prices.each","pt":"peça"}],
          ["EMT 3/4\" — 10 ft",{"key":"prices.conduit","pt":"Conduíte"},{"key":"prices.each","pt":"peça"}],
          [{"key":"prices.1GangNewWork","pt":"Caixa 1 gang new work"},{"key":"prices.boxes","pt":"Caixas"},{"key":"prices.unitEach","pt":"un"}],
          [{"key":"prices.2GangNewWork","pt":"Caixa 2 gang new work"},{"key":"prices.boxes","pt":"Caixas"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.octagonFanBox","pt":"Caixa octogonal / ventilador"}, {"key":"prices.boxes","pt":"Caixas"}, {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.15aTrReceptacleDecorator","pt":"Tomada TR 15A (decorator)"}, {"key":"prices.devices","pt":"Dispositivos"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.20aTrReceptacleDecorator","pt":"Tomada TR 20A (decorator)"}, {"key":"prices.devices","pt":"Dispositivos"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.20aGfciReceptacleTr","pt":"Tomada GFCI 20A TR/WR"}, {"key":"prices.devices","pt":"Dispositivos"}, {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.singlePoleDecoratorSwitch","pt":"Interruptor single-pole decorator"}, {"key":"prices.devices","pt":"Dispositivos"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.3WayDecoratorSwitch","pt":"Interruptor 3-way decorator"}, {"key":"prices.devices","pt":"Dispositivos"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          ["Dimmer LED",{"key":"prices.devices","pt":"Dispositivos"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.15aAfciGfciBreaker","pt":"Disjuntor 15A AFCI/GFCI (dual function)"}, {"key":"prices.panelAndBreakers","pt":"Painel e disjuntores"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.20aAfciGfciBreaker","pt":"Disjuntor 20A AFCI/GFCI (dual function)"}, {"key":"prices.panelAndBreakers","pt":"Painel e disjuntores"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.200aMainBreakerPanel","pt":"Painel 200A main breaker 40 espaços"}, {"key":"prices.panelAndBreakers","pt":"Painel e disjuntores"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          ["Meter socket 200A",{"key":"prices.panelAndBreakers","pt":"Painel e disjuntores"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.groundRod58","pt":"Haste de aterramento 5/8\" x 8 ft"}, {"key":"prices.grounding","pt":"Aterramento"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          ["Recessed LED 6\" wafer",{"key":"prices.lighting","pt":"Iluminação"},{"key":"prices.unitEach","pt":"un"}],
          ["Recessed LED 4\" wafer",{"key":"prices.lighting","pt":"Iluminação"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.hardwiredComboSmokeCo","pt":"Detector fumaça/CO combinado hardwired"}, {"key":"prices.lifeSafety","pt":"Segurança"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.wireNutsBox","pt":"Wire nuts (caixa)"}, {"key":"prices.consumables","pt":"Consumíveis"}, {"key":"prices.unitBox","pt":"caixa"}
          ],
          [
            {"key":"prices.romexStaplesBox","pt":"Grampos Romex (caixa)"}, {"key":"prices.consumables","pt":"Consumíveis"},
            {"key":"prices.unitBox","pt":"caixa"}
          ]
        ],
        basicOffer: [
          {"list":"electrical","label":{"key":"prices.basicElectrical","pt":"Adicionar lista básica elétrica","en":"Add basic electrical list","es":"Agregar lista básica eléctrica"}},
          {"list":"hvac","label":{"key":"prices.basicHvac","pt":"Lista básica HVAC","en":"Basic HVAC list","es":"Lista básica de HVAC"}}
        ],
        promos: true
      }
    },
    {
      id: "plumbing",
      aliases: [],
      order: 30,
      category: "mep",
      label: { "pt": "Plumbing", "en": "Plumbing", "es": "Plomería" },
      companySuffix: "Plumbing",
      onboarding: {"label":{"key":"ob.trade.plumbing","pt":"Plumbing"},"desc":{"key":"ob.trade.plumbing.d","pt":"Água, esgoto, aquecedor, gás"}},
      icon: "drop",
      kind: {"key":"proj.kind.plumbing","pt":"trabalho de plumbing"},
      stepName: { "pt": "Plumbing", "en": "Plumbing", "es": "Plomería" },
      group: {"label":{ "pt": "Plumbing", "en": "Plumbing", "es": "Plomería" },"icon":"drop"},
      workType: [
        "New Construction", "Remodel / Renovação", "Banheiro / cozinha", "Troca de aquecedor de água", "Reparo / service call", "Gás (gas fitting)", "Comercial"
      ],
      fields: {
        pipeMaterial: {
          label: {"key":"catalog.piping","pt":"Tubulação"},
          multi: true,
          opts: ["PEX","Cobre (copper)","CPVC","PVC (DWV)","ABS (DWV)","Ferro fundido existente","Galvanizado existente"]
        },
        waterSource: {"label":{"key":"catalog.water","pt":"Água"},"opts":["Rede da cidade (municipal)","Poço (well)"]},
        sewer: {"label":{"key":"catalog.sewer","pt":"Esgoto"},"opts":["Rede da cidade (sewer)","Fossa séptica (septic / Title 5)"]},
        waterHeater: {
          label: {"key":"catalog.waterHeater","pt":"Aquecedor de água"},
          opts: ["Sem mudança","Tanque a gás","Tanque elétrico","Tankless a gás","Heat pump water heater","Indireto (com caldeira)"]
        },
        fuel: {"label":{"key":"catalog.fuel","pt":"Combustível"},"opts":["Gás natural","Propano","Elétrico","Óleo"]},
        fixtures: {
          label: {"key":"catalog.fixtures","pt":"Peças (fixtures)"},
          multi: true,
          system: true,
          opts: [
            "Vaso sanitário", "Pia de banheiro", "Banheira", "Chuveiro", "Pia de cozinha", "Lava-louças", "Máquina de lavar roupa",
            "Torneira externa (sillcock)", "Linha da geladeira", "Sump pump", "Bomba de esgoto (ejector)"
          ]
        },
        gasPiping: {"label":{"key":"catalog.gasPiping","pt":"Tubulação de gás"},"opts":["Sim","Não",{"pt":"Por outros (gas fitter)","en":"By others (gas fitter)","es":"Por otros (gasista)"}],"coHide":{"noGas":["Sim"]}},
        waterMain: {
          label: {"key":"catalog.waterService","pt":"Entrada de água"},
          opts: ["Sem mudança","Trocar entrada (main)","Novo hidrômetro","Válvula redutora de pressão (PRV)"]
        },
        backflow: {"label":"Backflow","system":true,"opts":["Sim (comercial / irrigação)","Não"]}
      },
      text: [
        {"key":"fixtureCount","label":{"key":"catalog.noOfFixtures","pt":"Nº de peças (fixtures)"}},
        {"key":"heaterSize","label":{"key":"catalog.waterHeaterGallonsBtu","pt":"Aquecedor (galões / BTU)"}}
      ],
      units: [{"id":"ea","label":{"key":"prices.unitEach","pt":"un"}},{"id":"ft","label":"ft"},{"id":"gal","label":{"key":"prices.gallon","pt":"galão"}}],
      tasks: {
        "Demolição": ["Remover peças antigas","Cortar e tampar tubulação antiga"],
        "Esgoto (DWV)": ["Esgoto subterrâneo (underground)","Teste do underground","Tubulação de esgoto e ventilação (DWV)","Ventilação pelo telhado (vent)"],
        "Rough-in": [
          "Rough-in de água (supply)", "Manifold PEX", "Caixa da lavadora / geladeira", "Válvulas de chuveiro / banheira",
          "Instalar banheira / base do chuveiro", "Tubulação de gás", "Teste de pressão da água", "Teste de pressão do gás",
          {"pt":"Coordenar gás com o gas fitter","en":"Coordinate gas with the gas fitter","es":"Coordinar el gas con el gasista"}
        ],
        Equipamentos: ["Instalar aquecedor de água","Expansion tank","Ventilação do aquecedor","Bomba de recirculação","Sump pump / ejector","Backflow preventer"],
        Acabamento: [
          "Instalar vasos sanitários", "Instalar pias e torneiras", "Acabamento do chuveiro (trim)", "Ligar lava-louças / disposal", "Torneiras externas",
          "Teste final de vazamento"
        ],
        "Inspeções": ["Permit de plumbing","Permit de gás","Inspeção do underground","Inspeção rough","Inspeção de gás","Inspeção final"]
      },
      // proposta → tarefas (tasks-core.js): mesmo formato do electrical
      taskMatch: [
        { t: ["Demolição", "Remover peças antigas"], re: "(remove|removal|demo|demolish|remover|retirar|quitar).{0,40}(existing|old|fixture|antig|vanity|toilet|tub|sink|pia|vaso)" },
        { t: ["Demolição", "Cortar e tampar tubulação antiga"], re: "\\bcap\\b|cut and cap|tampar|taponar" },
        { t: ["Esgoto (DWV)", "Esgoto subterrâneo (underground)"], re: "underground|subterr|below slab|under ?slab" },
        { t: ["Esgoto (DWV)", "Teste do underground"], re: "test|teste|prueba", ctx: "underground|subterr|below slab" },
        { t: ["Esgoto (DWV)", "Tubulação de esgoto e ventilação (DWV)"], re: "\\bdwv\\b|drain|waste|sewer|esgoto|desague|drenaje", not: "condensate|shower drain|floor drain only" },
        { t: ["Esgoto (DWV)", "Ventilação pelo telhado (vent)"], re: "vent.{0,30}(roof|telhado|techo)|(roof|telhado|techo).{0,20}vent|vent stack|vent through" },
        { t: ["Rough-in", "Rough-in de água (supply)"], re: "water (supply|lines|piping|distribution)|supply lines|\\bpex\\b|copper|tubulacao de agua|agua fria|tuberia de agua", not: "manifold" },
        { t: ["Rough-in", "Manifold PEX"], re: "manifold" },
        { t: ["Rough-in", "Caixa da lavadora / geladeira"], re: "washer box|washing machine|ice ?maker|refrigerator|lavadora|geladeira|refrigerador|refri" },
        { t: ["Rough-in", "Válvulas de chuveiro / banheira"], re: "(shower|tub|bath)\\w*.{0,20}valve|mixing valve|valvula|valve.{0,20}(shower|tub)" },
        { t: ["Rough-in", "Instalar banheira / base do chuveiro"], re: "(install|set|instalar|colocar).{0,30}(tub|bathtub|shower base|shower pan|banheira|base do chuveiro|tina|plato de ducha)" },
        { t: ["Rough-in", "Tubulação de gás"], re: "gas (pipe|piping|line)|tubulacao de gas|tuberia de gas|black iron|\\bcsst\\b", not: "by others|gas fitter" },
        { t: ["Rough-in", "Teste de pressão da água"], re: "pressure test|teste de pressao|prueba de presion", not: "\\bgas\\b" },
        { t: ["Rough-in", "Teste de pressão do gás"], re: "pressure test|teste de pressao|prueba de presion", ctx: "\\bgas\\b" },
        { t: ["Equipamentos", "Instalar aquecedor de água"], re: "water heater|tankless|aquecedor|calentador|indirect tank", not: "remove|removal|existing|remover|retirar|quitar|demo\\b" },
        { t: ["Equipamentos", "Expansion tank"], re: "expansion tank|tanque de expans|vaso de expans" },
        { t: ["Equipamentos", "Ventilação do aquecedor"], re: "vent|exaust|flue", ctx: "water heater|tankless|aquecedor|calentador" },
        { t: ["Equipamentos", "Bomba de recirculação"], re: "recirc" },
        { t: ["Equipamentos", "Sump pump / ejector"], re: "sump|ejector|bomba de esgoto|sumidero" },
        { t: ["Equipamentos", "Backflow preventer"], re: "backflow|\\brpz\\b|double check|antirretorno" },
        { t: ["Acabamento", "Instalar vasos sanitários"], re: "toilet|water closet|\\bwc\\b|vaso sanit|inodoro", not: "remove|removal|existing|remover|retirar|quitar|demo\\b" },
        { t: ["Acabamento", "Instalar pias e torneiras"], re: "\\bsinks?\\b|faucet|lavatory|vanity|\\bpias?\\b|torneira|lavabo|lavamanos|grifo|fregadero", not: "outdoor faucet|exterior faucet|hose bib|torneira externa|remove|removal|existing|remover|retirar|quitar|demo\\b" },
        { t: ["Acabamento", "Acabamento do chuveiro (trim)"], re: "shower trim|trim kit|shower ?head|acabamento do chuveiro|regadera" },
        { t: ["Acabamento", "Ligar lava-louças / disposal"], re: "dishwasher|disposal|lava-?loucas?|lavavajillas|triturador" },
        { t: ["Acabamento", "Torneiras externas"], re: "hose bibb?|sillcock|outdoor faucet|exterior faucet|torneira externa|llave exterior" },
        { t: ["Acabamento", "Teste final de vazamento"], re: "leak test|final test|vazamento|prueba de fugas" },
        { t: ["Inspeções", "Permit de plumbing"], re: "permit|licenca|permiso", not: "\\bgas\\b" },
        { t: ["Inspeções", "Permit de gás"], re: "permit|licenca|permiso", ctx: "\\bgas\\b" },
        { t: ["Inspeções", "Inspeção rough"], re: "rough.{0,20}inspect|inspect.{0,30}rough|\\binspections\\b|inspecoes|inspecciones" },
        { t: ["Inspeções", "Inspeção de gás"], re: "inspect|inspec", ctx: "\\bgas\\b" },
        { t: ["Inspeções", "Inspeção final"], re: "final.{0,20}inspect|inspect.{0,30}final|sign[- ]?off|\\binspections\\b|inspecoes|inspecciones" }
      ],
      suggest: {
        vars: {"gut":{"any":[{"var":"newish"},{"f":"workType","re":"Remodel|Banheiro"}]}},
        rules: [
          {
            if: {"f":"workType","re":"Remodel|Banheiro|Troca"},
            add: [["Demolição","Remover peças antigas"],["Demolição","Cortar e tampar tubulação antiga"]]
          },
          {
            if: {"f":"workType","re":"New Construction"},
            add: [["Esgoto (DWV)","Esgoto subterrâneo (underground)"],["Esgoto (DWV)","Teste do underground"],["Inspeções","Inspeção do underground"]]
          },
          {
            if: {"var":"gut"},
            add: [
              ["Esgoto (DWV)","Tubulação de esgoto e ventilação (DWV)"], ["Esgoto (DWV)","Ventilação pelo telhado (vent)"],
              ["Rough-in","Rough-in de água (supply)"], ["Rough-in","Teste de pressão da água"], ["Inspeções","Inspeção rough"],
              ["Acabamento","Teste final de vazamento"]
            ]
          },
          {"if":{"all":[{"f":"pipeMaterial","has":"PEX"},{"var":"gut"}]},"add":[["Rough-in","Manifold PEX"]]},
          {
            if: {"any":[{"f":"fixtures","has":"Chuveiro"},{"f":"fixtures","has":"Banheira"}]},
            add: [["Rough-in","Válvulas de chuveiro / banheira"],["Acabamento","Acabamento do chuveiro (trim)"]]
          },
          {"if":{"f":"fixtures","has":"Banheira"},"add":[["Rough-in","Instalar banheira / base do chuveiro"]]},
          {"if":{"f":"fixtures","has":"Vaso sanitário"},"add":[["Acabamento","Instalar vasos sanitários"]]},
          {
            if: {"any":[{"f":"fixtures","has":"Pia de banheiro"},{"f":"fixtures","has":"Pia de cozinha"}]},
            add: [["Acabamento","Instalar pias e torneiras"]]
          },
          {"if":{"f":"fixtures","has":"Lava-louças"},"add":[["Acabamento","Ligar lava-louças / disposal"]]},
          {
            if: {"any":[{"f":"fixtures","has":"Máquina de lavar roupa"},{"f":"fixtures","has":"Linha da geladeira"}]},
            add: [["Rough-in","Caixa da lavadora / geladeira"]]
          },
          {"if":{"f":"fixtures","has":"Torneira externa (sillcock)"},"add":[["Acabamento","Torneiras externas"]]},
          {
            if: {"any":[{"f":"fixtures","has":"Sump pump"},{"f":"fixtures","has":"Bomba de esgoto (ejector)"}]},
            add: [["Equipamentos","Sump pump / ejector"]]
          },
          {"if":{"f":"waterHeater","ne":"Sem mudança"},"add":[["Equipamentos","Instalar aquecedor de água"],["Equipamentos","Expansion tank"]]},
          {"if":{"f":"waterHeater","ne":"Sem mudança","re":"gás|Tankless"},"add":[["Equipamentos","Ventilação do aquecedor"]]},
          {
            if: {"all":[{"f":"gasPiping","eq":"Sim"},{"not":{"co":"noGas"}}]},
            add: [["Rough-in","Tubulação de gás"],["Rough-in","Teste de pressão do gás"],["Inspeções","Permit de gás"],["Inspeções","Inspeção de gás"]]
          },
          // empresa que não faz gás (Configurações → Empresa → "Não fazemos gás"): coordena com o gas fitter
          {"if":{"any":[{"f":"gasPiping","re":"Por outros"},{"all":[{"f":"gasPiping","eq":"Sim"},{"co":"noGas"}]}]},"add":[["Rough-in","Coordenar gás com o gas fitter"]]},
          {"if":{"f":"backflow","re":"Sim"},"add":[["Equipamentos","Backflow preventer"]]},
          {"if":{"f":"permit","re":"Sim"},"add":[["Inspeções","Permit de plumbing"],["Inspeções","Inspeção final"]]}
        ]
      },
      companyFlags: [{
        key: "noGas", label: {"pt":"Não fazemos gás","en":"We don't do gas work","es":"No hacemos trabajos de gas"},
        desc: {"pt":"A ficha não oferece “Tubulação de gás: Sim” (usa “Por outros (gas fitter)”) e “Sugerir pela ficha” não sugere tubulação, teste nem permit de gás: sugere coordenar com o gas fitter.",
          "en":"The job sheet won't offer “Gas piping: Yes” (it uses “By others (gas fitter)”), and “Suggest from job sheet” won't suggest gas piping, tests or permits: it suggests coordinating with the gas fitter.",
          "es":"La ficha no ofrece “Tubería de gas: Sí” (usa “Por otros (gasista)”), y “Sugerir según la ficha” no sugiere tubería, pruebas ni permisos de gas: sugiere coordinar con el gasista."},
        aiRule: "This company does NOT do gas work: gas piping, gas permits and gas connections are by others (licensed gas fitter) — say so in the scope and in Not Included; never price gas work."
      }],
      inspections: [
        {
          label: "Permit de plumbing",
          authority: {"pt":"Inspetor de plumbing da cidade (248 CMR)","en":"Town plumbing inspector (248 CMR)","es":"Inspector de plomería del municipio (248 CMR)"},
          when: {"pt":"Antes de começar","en":"Before starting","es":"Antes de empezar"}
        },
        {
          label: "Inspeção do underground",
          authority: {"pt":"Inspetor de plumbing","en":"Plumbing inspector","es":"Inspector de plomería"},
          when: {"pt":"Antes de cobrir o esgoto subterrâneo","en":"Before backfilling underground piping","es":"Antes de rellenar la tubería subterránea"}
        },
        {
          label: "Inspeção rough",
          authority: {"pt":"Inspetor de plumbing","en":"Plumbing inspector","es":"Inspector de plomería"},
          when: {"pt":"Antes de fechar as paredes","en":"Before walls are closed","es":"Antes de cerrar las paredes"}
        },
        {
          label: "Inspeção de gás",
          authority: {"pt":"Inspetor de gás (gas fitter)","en":"Gas inspector","es":"Inspector de gas"},
          when: {"pt":"Teste de pressão do gás","en":"Gas pressure test","es":"Prueba de presión del gas"}
        },
        {
          label: "Inspeção final",
          authority: {"pt":"Inspetor de plumbing","en":"Plumbing inspector","es":"Inspector de plomería"},
          when: {"pt":"Peças instaladas e testadas","en":"Fixtures set and tested","es":"Aparatos instalados y probados"}
        }
      ],
      proposal: {
        title: "PLUMBING PROPOSAL",
        tagline: "LICENSED PLUMBING CONTRACTOR",
        role: "Licensed Plumbing Contractor",
        scopeName: "Plumbing",
        invoiceWork: "plumbing",
        intro: {
          text: "This proposal covers the plumbing scope of work for {what} at {where}. Work will be performed in accordance with {code} and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed plumbers under permit.",
          code: {
            MA: "the Massachusetts Uniform State Plumbing Code (248 CMR), the Massachusetts Fuel Gas Code where applicable,",
            "*": "the applicable state plumbing and fuel gas codes"
          }
        },
        facts: { // material falado (B04); sem fonte, o de sempre como "onde aplicável"
          dwv: { pick: [["\\bpvc\\b", "**PVC**"], ["\\babs\\b", "**ABS**"], ["ferro fundido|cast iron|no-?hub", "**cast iron**"]], all: true, join: " / ", fallback: "code-approved" },
          supply: { pick: [["\\bpex\\b", "**PEX**"], ["cobre|copper", "**copper (Type L)**"], ["\\bcpvc\\b", "**CPVC**"]], all: true, join: " / ", fallback: "code-approved" }
        },
        sections: [
          {
            title: "Demolition & Removal",
            keywords: "demol|remov|tirar|retirar|velh|antig|old",
            text: "Disconnect, cap, and remove existing plumbing fixtures and piping within the work area.\nProtect adjacent finished surfaces; removal of debris from our work."
          },
          {
            title: "Drain, Waste & Vent (DWV)",
            keywords: "esgoto|dreno|drain|dwv|vent|waste|ralo|sewer",
            text: "Furnish and install new {dwv} drain, waste, and vent piping sized per the plumbing code, including traps, cleanouts, and vent through the roof.\nConnection to the existing building drain / sewer."
          },
          {
            title: "Water Supply Piping",
            keywords: "[aá]gua|water line|pex|cobre|copper|supply|encanamento|tubula",
            text: "Furnish and install new {supply} hot and cold water distribution with manifold and shut-off valves at each fixture.\nInsulation on hot water lines and on piping in unconditioned spaces."
          },
          {
            title: "Fixtures & Trim",
            keywords: "vaso|toilet|pia|sink|lavat|chuveiro|shower|banheira|tub|torneira|faucet|fixture",
            text: "Set and connect toilets, lavatories, tub / shower valves and trim, kitchen sink, and faucets.\nFixtures and trim supplied by Owner / GC unless listed in the Investment section."
          },
          {
            title: "Water Heater",
            keywords: "aquecedor|water heater|tankless|boiler|caldeira",
            text: "Furnish and install a new water heater with expansion tank, T&P relief discharge, and venting per the manufacturer's instructions."
          },
          {
            title: "Gas Piping",
            keywords: "g[aá]s",
            text: "Furnish and install gas piping to the listed appliances, including shut-off valves, sediment traps, and pressure test.\nGas work performed by a licensed gas fitter under a separate gas permit.",
            co: { noGas: { hide: true } } // "Não fazemos gás": sem seção de gás na proposta
          },
          {
            title: "Appliance Connections",
            keywords: "lava.?lou|dishwasher|m[aá]quina de lavar|washer|disposal|geladeira|ice ?maker",
            text: "Connect dishwasher, disposal, washing machine box, and refrigerator ice-maker line as listed."
          },
          {
            title: "Testing",
            keywords: ".",
            text: "Pressure test of water supply and DWV piping at rough-in; final leak check of all fixtures and connections."
          },
          {
            title: "Permit & Inspections",
            keywords: ".",
            text: "[!co:noGas] Plumbing (and gas, where applicable) permits will be pulled by us. Permit fees are included.\n[co:noGas] Plumbing permit will be pulled by us. Permit fees are included.\n[co:noGas] Gas piping, connections and gas permits by a licensed gas fitter (by others).\nCoordination of all required inspections (rough and final) with the plumbing inspector."
          }
        ],
        defaults: {
          includes: "all labor, piping and materials listed above (fixtures supplied by others unless listed), supervision, applicable {state} sales tax, and plumbing permit fees and inspection coordination.",
          notIncluded: "Fixtures, faucets, and trim unless listed above · appliances · [co:noGas] Gas piping, connections and gas permits by a licensed gas fitter (by others) · electrical work and connections · drywall, patching, painting, tile, or carpentry · excavation or trenching outside the building · water / sewer utility connection fees · septic system work · asbestos or hazardous-material abatement.",
          clarifications: "Plumbing permit will be pulled by {brand}. **Permit fees are included.**\n[!co:noGas] All work performed by licensed plumbers; gas work by a licensed gas fitter.\n[co:noGas] All work performed by licensed plumbers. We do not perform gas work: gas piping, connections and gas permits by a licensed gas fitter (by others).\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          warranty: "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        speechExample: {
          key: "prop.ex.plumbing",
          pt: "Ex.: “Reforma de dois banheiros: tubulação nova em PEX, troca dos vasos e pias, válvula nova no chuveiro e aquecedor tankless a gás. Preço 12.800, 30/40/30.”"
        },
        aiRules: "Trade: licensed PLUMBING contractor.\nCode references: Massachusetts Uniform State Plumbing Code (248 CMR) and Massachusetts Fuel Gas Code (248 CMR 4.00–8.00) in MA; in other states \"the applicable state plumbing and fuel gas codes\".\nTypical sections: \"Demolition & Removal\", \"Drain, Waste & Vent (DWV)\", \"Water Supply Piping\", \"Fixtures & Trim\", \"Water Heater\", \"Gas Piping\", \"Appliance Connections\", \"Testing\", \"Permit & Inspections\".\nState pipe materials (PEX, copper type L, PVC DWV) and fixture counts exactly as spoken. Fixtures and trim are supplied by Owner/GC unless the speaker says otherwise.\nGas work is always by a licensed gas fitter under a separate gas permit. Never include electrical work, drywall patching, or tile."
      },
      prices: {
        stores: ["homedepot","fwwebb","ferguson","supplyhouse","lowes"],
        basic: [
          ["PEX-A 1/2\" — 100 ft",{"key":"prices.piping","pt":"Tubulação"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["PEX-A 3/4\" — 100 ft",{"key":"prices.piping","pt":"Tubulação"},{"key":"prices.unitRoll","pt":"rolo"}],
          [
            {"key":"prices.typeLCopper1","pt":"Cobre tipo L 1/2\" — 10 ft"}, {"key":"prices.piping","pt":"Tubulação"}, {"key":"prices.each","pt":"peça"}
          ],
          [
            {"key":"prices.typeLCopper3","pt":"Cobre tipo L 3/4\" — 10 ft"}, {"key":"prices.piping","pt":"Tubulação"}, {"key":"prices.each","pt":"peça"}
          ],
          ["PVC DWV 2\" — 10 ft",{"key":"prices.drainWasteVentDwv","pt":"Esgoto (DWV)"},{"key":"prices.each","pt":"peça"}],
          ["PVC DWV 3\" — 10 ft",{"key":"prices.drainWasteVentDwv","pt":"Esgoto (DWV)"},{"key":"prices.each","pt":"peça"}],
          [
            {"key":"prices.pTrap11","pt":"Sifão P-trap 1-1/2\""}, {"key":"prices.drainWasteVentDwv","pt":"Esgoto (DWV)"}, {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.pexExpansionRing1","pt":"Anel de expansão PEX 1/2\" (saco)"}, {"key":"prices.fittings","pt":"Conexões"},
            {"key":"prices.unitBag","pt":"saco"}
          ],
          [{"key":"prices.ballValve34","pt":"Válvula de esfera 3/4\""},{"key":"prices.valves","pt":"Válvulas"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.showerValvePressureBalance","pt":"Válvula de chuveiro (pressure balance)"}, {"key":"prices.valves","pt":"Válvulas"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.angleStop12","pt":"Registro angular 1/2\" x 3/8\""}, {"key":"prices.valves","pt":"Válvulas"}, {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.waterHeater50Gal","pt":"Aquecedor de água 50 gal a gás"}, {"key":"prices.waterHeater","pt":"Aquecedor"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          ["Expansion tank 2 gal",{"key":"prices.waterHeater","pt":"Aquecedor"},{"key":"prices.unitEach","pt":"un"}],
          [{"key":"prices.waxRingToilet","pt":"Anel de cera (vaso)"},{"key":"prices.finish","pt":"Acabamento"},{"key":"prices.unitEach","pt":"un"}],
          [
            {"key":"prices.supplyLine","pt":"Flexível de abastecimento (supply line)"}, {"key":"prices.finish","pt":"Acabamento"},
            {"key":"prices.unitEach","pt":"un"}
          ],
          [
            {"key":"prices.pvcCementAndPrimer","pt":"Cola e primer PVC"}, {"key":"prices.consumables","pt":"Consumíveis"}, {"key":"prices.unitKit","pt":"kit"}
          ],
          [
            {"key":"prices.threadTapePipeDope","pt":"Fita veda-rosca / pasta"}, {"key":"prices.consumables","pt":"Consumíveis"},
            {"key":"prices.unitEach","pt":"un"}
          ]
        ],
        basicOffer: [{"list":"plumbing","label":{"key":"prices.basicPlumbing","pt":"Adicionar lista básica de plumbing"}}],
        promos: false
      }
    },
    {
      id: "gc",
      aliases: ["general"],
      order: 40,
      category: "general",
      label: "General contractor",
      companySuffix: "Construction",
      onboarding: {"label":{"key":"ob.trade.gc","pt":"General Contractor"},"desc":{"key":"ob.trade.gc.d","pt":"Obra completa e subempreiteiros"}},
      icon: "hammer",
      kind: {"key":"proj.kind.gc","pt":"trabalho (obra)"},
      stepName: {"key":"catalog.jobGc","pt":"Obra (GC)"},
      group: {"label":{"key":"common.job","pt":"Obra"},"icon":"hammer"},
      workType: [
        "New Construction", "Reforma completa (gut)", "Cozinha", "Banheiro", "Addition (ampliação)", "Porão (basement finish)", "Telhado / siding",
        "Comercial (tenant fit-out)"
      ],
      fields: {
        structure: {"label":{"key":"catalog.structure","pt":"Estrutura"},"opts":["Wood frame","Steel frame","Concreto / alvenaria","Misto"]},
        foundation: {"label":{"key":"catalog.foundation","pt":"Fundação"},"opts":["Sem mudança","Nova fundação","Slab","Porão (full basement)","Crawl space"]},
        subs: {
          label: {"key":"catalog.subsOnTheJob","pt":"Subempreiteiros na obra"},
          multi: true,
          system: true,
          opts: [
            "Elétrica", "Plumbing", "HVAC", "Drywall", "Pintura", "Piso", "Telhado", "Siding", "Janelas e portas", "Armários / bancadas", "Isolamento",
            "Escavação"
          ]
        },
        roofing: {"label":{"key":"catalog.roofing","pt":"Telhado"},"opts":["Sem mudança","Shingles (asfalto)","EPDM / plano","Metal"]},
        siding: {"label":"Siding","opts":["Sem mudança","Vinil","Fiber cement","Madeira (cedar)"]},
        insulation: {"label":{"key":"catalog.insulation","pt":"Isolamento"},"opts":["Fiberglass","Spray foam","Cellulose","Mineral wool"]},
        drawings: {
          label: {"key":"catalog.designDrawings","pt":"Projeto / plantas"},
          opts: ["Arquiteto contratado","Plantas prontas","Design-build (nós desenhamos)","Sem plantas"]
        },
        energyCode: {"label":"Energy code","system":true,"opts":["Base","Stretch code","Specialized code","Verificar"]},
        dumpster: {"label":"Dumpster","system":true,"opts":["Sim","Não"]}
      },
      text: [
        {"key":"architect","label":{"key":"catalog.architectEngineer","pt":"Arquiteto / engenheiro"}},
        {"key":"hers","label":{"key":"catalog.hersBlowerDoorTarget","pt":"HERS / blower door (meta)"}}
      ],
      units: [
        {"id":"ea","label":{"key":"prices.unitEach","pt":"un"}}, {"id":"sqft","label":"sq ft"}, {"id":"lf","label":"LF"},
        {"id":"sheet","label":{"key":"prices.unitSheet","pt":"folha"}}
      ],
      tasks: {
        "Pré-obra": [
          "Permit de construção", "Contratos dos subempreiteiros", "Cronograma", "Pedido de itens demorados (janelas, armários)", "Dumpster e proteção do local"
        ],
        Estrutura: ["Demolição","Escavação / fundação","Framing (estrutura)","Telhado","Janelas e portas externas","Siding / acabamento externo"],
        "Rough-ins": ["Elétrica rough-in","Plumbing rough-in","HVAC rough-in","Inspeção de framing","Inspeção dos rough-ins"],
        Fechamento: ["Isolamento","Inspeção de isolamento","Drywall","Blower door / HERS"],
        Acabamento: ["Pintura","Piso","Armários e bancadas","Portas internas e trim","Azulejo / revestimento","Acabamentos de elétrica, plumbing e HVAC"],
        Entrega: ["Punch list","Limpeza final","Inspeção final / CO (habite-se)","Entrega ao cliente"]
      },
      suggest: {
        // ordem da obra (B07): permit e pré-obra primeiro, punch list / limpeza / entrega no fim
        order: ["Permit de construção", "Contratos dos subempreiteiros", "Cronograma", "Pedido de itens demorados (janelas, armários)", "Dumpster e proteção do local", "Demolição",
          "Escavação / fundação", "Framing (estrutura)", "Telhado", "Janelas e portas externas", "Siding / acabamento externo", "Elétrica rough-in", "Plumbing rough-in", "HVAC rough-in",
          "Inspeção de framing", "Inspeção dos rough-ins", "Isolamento", "Inspeção de isolamento", "Drywall", "Blower door / HERS", "Pintura", "Portas internas e trim", "Armários e bancadas",
          "Azulejo / revestimento", "Piso", "Acabamentos de elétrica, plumbing e HVAC", "Inspeção final / CO (habite-se)", "Punch list", "Limpeza final", "Entrega ao cliente"],
        vars: {"big":{"f":"workType","re":"New Construction|Addition|gut"}},
        rules: [
          {"add":[["Pré-obra","Cronograma"],["Entrega","Punch list"],["Entrega","Limpeza final"],["Entrega","Entrega ao cliente"]]},
          {"if":{"f":"permit","re":"Sim"},"add":[["Pré-obra","Permit de construção"],["Entrega","Inspeção final / CO (habite-se)"]]},
          {"if":{"f":"subs","filled":true},"add":[["Pré-obra","Contratos dos subempreiteiros"]]},
          {"if":{"f":"dumpster","eq":"Sim"},"add":[["Pré-obra","Dumpster e proteção do local"]]},
          {"if":{"not":{"f":"workType","re":"New Construction"}},"add":[["Estrutura","Demolição"]]},
          {"if":{"any":[{"var":"big"},{"f":"foundation","ne":"Sem mudança"}]},"add":[["Estrutura","Escavação / fundação"]]},
          {
            if: {"var":"big"},
            add: [["Estrutura","Framing (estrutura)"],["Rough-ins","Inspeção de framing"],["Pré-obra","Pedido de itens demorados (janelas, armários)"]]
          },
          {"if":{"f":"roofing","ne":"Sem mudança"},"add":[["Estrutura","Telhado"]]},
          {"if":{"f":"siding","ne":"Sem mudança"},"add":[["Estrutura","Siding / acabamento externo"]]},
          {"if":{"f":"subs","has":"Janelas e portas"},"add":[["Estrutura","Janelas e portas externas"]]},
          {"if":{"f":"subs","has":"Elétrica"},"add":[["Rough-ins","Elétrica rough-in"]]},
          {"if":{"f":"subs","has":"Plumbing"},"add":[["Rough-ins","Plumbing rough-in"]]}, {"if":{"f":"subs","has":"HVAC"},"add":[["Rough-ins","HVAC rough-in"]]},
          {
            if: {"any":[{"f":"subs","has":"Elétrica"},{"f":"subs","has":"Plumbing"},{"f":"subs","has":"HVAC"}]},
            add: [["Rough-ins","Inspeção dos rough-ins"],["Acabamento","Acabamentos de elétrica, plumbing e HVAC"]]
          },
          {
            if: {"any":[{"f":"subs","has":"Isolamento"},{"f":"insulation","filled":true}]},
            add: [["Fechamento","Isolamento"],["Fechamento","Inspeção de isolamento"]]
          },
          {"if":{"f":"subs","has":"Drywall"},"add":[["Fechamento","Drywall"]]},
          {"if":{"any":[{"f":"energyCode","re":"Stretch|Specialized"},{"f":"hers","filled":true}]},"add":[["Fechamento","Blower door / HERS"]]},
          {"if":{"f":"subs","has":"Pintura"},"add":[["Acabamento","Pintura"]]}, {"if":{"f":"subs","has":"Piso"},"add":[["Acabamento","Piso"]]},
          {"if":{"any":[{"f":"subs","has":"Armários / bancadas"},{"f":"workType","re":"Cozinha"}]},"add":[["Acabamento","Armários e bancadas"]]},
          {"if":{"f":"workType","re":"Banheiro|Cozinha"},"add":[["Acabamento","Azulejo / revestimento"]]}
        ]
      },
      inspections: [
        {
          label: "Permit de construção",
          authority: {"pt":"Building department (780 CMR)","en":"Building department (780 CMR)","es":"Departamento de construcción (780 CMR)"},
          when: {"pt":"Antes de começar","en":"Before starting","es":"Antes de empezar"}
        },
        {
          label: "Inspeção de framing",
          authority: {"pt":"Building inspector","en":"Building inspector","es":"Inspector de construcción"},
          when: {"pt":"Depois dos rough-ins","en":"After rough-ins","es":"Después de los rough-ins"}
        },
        {
          label: "Inspeção de isolamento",
          authority: {"pt":"Building inspector","en":"Building inspector","es":"Inspector de construcción"},
          when: {"pt":"Antes do drywall","en":"Before drywall","es":"Antes del drywall"}
        },
        {
          label: "Inspeção final / CO (habite-se)",
          authority: {"pt":"Building department","en":"Building department","es":"Departamento de construcción"},
          when: {"pt":"Entrega","en":"Closeout","es":"Cierre de obra"}
        }
      ],
      proposal: {
        title: "CONSTRUCTION PROPOSAL",
        tagline: "GENERAL CONTRACTOR",
        role: "General Contractor",
        scopeName: "Construction",
        invoiceWork: "construction",
        intro: {
          text: "This proposal covers the general construction scope of work for {what} at {where}. Work will be performed in accordance with {code}, the approved drawings, and the requirements of the local Authority Having Jurisdiction. Trade work will be performed by licensed and insured subcontractors under permit.",
          code: {"MA":"the Massachusetts State Building Code 780 CMR (10th edition)","*":"the applicable state building code"}
        },
        facts: { // B04: nível de acabamento e demãos só se falados
          dwLevel: { re: "(?:n[ií]vel|level)\\s*([0-5])\\b", fmt: "**Level {1}** (GA-214)", fallback: "the finish level listed (Level 4 unless stated)" },
          paintCoats: { count: "dem[ãa]os?|coats?", gap: 1, max: 5, one: "one (1) coat", many: "{wn} coats", fallback: "coats as listed" }
        },
        hic: true, clientRole: "Homeowner", // contrato residencial de MA (lei HIC) quando o cliente é o dono da casa
        sections: [
          {
            title: "General Conditions",
            keywords: ".",
            text: "Project management, supervision, scheduling, and coordination of all trades.\nSite protection, temporary facilities, dumpster, and daily cleanup."
          },
          {
            title: "Demolition",
            keywords: "demol|tirar|remov|gut",
            text: "Selective demolition of existing finishes and components within the work area, including disposal."
          },
          {
            title: "Sitework & Foundation",
            keywords: "funda[cç]|foundation|escava|excav|concreto|slab|footing",
            text: "Excavation, footings, and foundation walls per the structural drawings, including damp-proofing and backfill."
          },
          {
            title: "Framing & Carpentry",
            keywords: "framing|estrutura|parede|wall|carpent|madeira|addition|amplia",
            text: "Furnish and install framing lumber, sheathing, and structural members per the drawings and the building code.\nBlocking for cabinets, fixtures, and accessories."
          },
          {
            title: "Roofing & Exterior",
            keywords: "telhado|roof|siding|janela|window|porta externa|exterior|deck",
            text: "Furnish and install roofing, flashing, house wrap, siding, exterior trim, windows, and exterior doors as specified."
          },
          {
            title: "Mechanical, Electrical & Plumbing",
            keywords: "el[eé]tric|plumbing|hidr[aá]ulic|hvac|encanamento|ar.condicionado",
            text: "Electrical, plumbing, and HVAC by licensed subcontractors under their own permits, per the scope and the code."
          },
          {
            title: "Insulation & Drywall",
            keywords: "isola|insulation|drywall|gesso|sheetrock",
            text: "Insulation per the energy code; drywall hung, taped, and finished to {dwLevel}, ready for paint."
          },
          {
            title: "Interior Finishes",
            keywords: "piso|floor|azulejo|tile|arm[aá]rio|cabinet|bancada|countertop|pintura|paint|trim|acabamento|cozinha|kitchen|banheiro|bath",
            text: "Interior doors and trim, flooring, tile, cabinets and countertops, and paint ({paintCoats}) as specified."
          },
          {
            title: "Permit, Inspections & Closeout",
            keywords: ".",
            text: "Building permit will be pulled by us. Permit fees are included.\nCoordination of all inspections, final punch list, final cleaning, and certificate of occupancy where required."
          }
        ],
        defaults: {
          includes: "all labor, materials, supervision, project management, subcontractor coordination, dumpster and cleanup, applicable {state} sales tax, and building permit fees.",
          notIncluded: "Architectural or engineering design and stamped drawings (unless listed) · utility company charges and connection fees · Owner-selected allowances above the amounts listed · landscaping, paving, and site work outside the work area · asbestos, lead, or hazardous-material abatement · furniture, appliances, and window treatments.",
          clarifications: "Building permit will be pulled by {brand}. **Permit fees are included.**\nAll subcontracted trades are licensed and insured.\nAllowance items will be reconciled at actual cost.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          warranty: "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        speechExample: {
          key: "prop.ex.gc",
          pt: "Ex.: “Reforma completa da cozinha: demolição, drywall, piso, armários e bancada, elétrica e plumbing por subempreiteiros, pintura. Preço 68 mil, 30/40/30.”"
        },
        aiRules: "Trade: GENERAL CONTRACTOR coordinating the whole job and licensed subcontractors.\nCode references: Massachusetts State Building Code 780 CMR (10th edition) in MA; otherwise \"the applicable state building code\"; the approved drawings.\nTypical sections: \"General Conditions\", \"Demolition\", \"Sitework & Foundation\", \"Framing & Carpentry\", \"Roofing & Exterior\", \"Mechanical, Electrical & Plumbing\" (by licensed subcontractors under their own permits), \"Insulation & Drywall\", \"Interior Finishes\", \"Permit, Inspections & Closeout\".\nUse allowances for Owner selections (cabinets, tile, fixtures) when the speaker gives an amount; never invent allowance amounts."
      },
      prices: {
        stores: ["homedepot","lowes","lumber84","abcsupply","lumberyard"],
        basic: [
          ["2x4 x 8 ft SPF",{"key":"prices.lumber","pt":"Madeira"},{"key":"prices.each","pt":"peça"}],
          ["2x6 x 8 ft SPF",{"key":"prices.lumber","pt":"Madeira"},{"key":"prices.each","pt":"peça"}],
          ["OSB 7/16\" 4x8",{"key":"prices.lumber","pt":"Madeira"},{"key":"prices.unitSheet","pt":"folha"}],
          [{"key":"prices.plywood344x8","pt":"Compensado 3/4\" 4x8"},{"key":"prices.lumber","pt":"Madeira"},{"key":"prices.unitSheet","pt":"folha"}],
          ["Drywall 1/2\" 4x8","Drywall",{"key":"prices.unitSheet","pt":"folha"}],
          ["Drywall 5/8\" Type X 4x8","Drywall",{"key":"prices.unitSheet","pt":"folha"}],
          [{"key":"prices.jointCompound45","pt":"Massa (joint compound) 4,5 gal"},"Drywall",{"key":"prices.unitBucket","pt":"balde"}],
          [
            {"key":"prices.r21FiberglassInsulation","pt":"Isolamento R-21 fiberglass"}, {"key":"prices.insulation","pt":"Isolamento"},
            {"key":"prices.unitPack","pt":"pacote"}
          ],
          ["House wrap 9x100 ft",{"key":"prices.exterior","pt":"Exterior"},{"key":"prices.unitRoll","pt":"rolo"}],
          ["Shingles (bundle)",{"key":"prices.roofing","pt":"Telhado"},{"key":"prices.unitPack","pt":"pacote"}],
          [
            {"key":"prices.16dFramingNailsBox","pt":"Pregos de framing 16d (caixa)"}, {"key":"prices.fasteners","pt":"Fixação"},
            {"key":"prices.unitBox","pt":"caixa"}
          ],
          [
            {"key":"prices.drywallScrews15","pt":"Parafuso de drywall 1-5/8\" (caixa)"}, {"key":"prices.fasteners","pt":"Fixação"},
            {"key":"prices.unitBox","pt":"caixa"}
          ],
          [
            {"key":"prices.interiorPaintGallon","pt":"Tinta interior (galão)"}, {"key":"prices.painting","pt":"Pintura"}, {"key":"prices.gallon","pt":"galão"}
          ],
          [
            {"key":"prices.lvpVinylFlooringBox","pt":"Piso vinílico LVP (caixa)"}, {"key":"prices.flooring","pt":"Piso"}, {"key":"prices.unitBox","pt":"caixa"}
          ],
          ["Dumpster 20 yd",{"key":"prices.services","pt":"Serviços"},{"key":"prices.unitEach","pt":"un"}]
        ],
        basicOffer: [{"list":"gc","label":{"key":"prices.basicGc","pt":"Adicionar lista básica de obra (GC)"}}],
        promos: false
      }
    },
    // ═══ ramos gerados de docs/ramos/*.json (node tools/ramos.js) — não edite à mão: edite o JSON e rode o script ═══
    {
      id: "hvac",
      aliases: [],
      order: 20,
      category: "mep",
      label: "HVAC",
      companySuffix: "HVAC",
      onboarding: { "label": { "key": "ob.trade.hvac", "pt": "HVAC" }, "desc": { "key": "ob.trade.hvac.d", "pt": "Heat pump, mini-split, dutos, fornalha" } },
      icon: "flake",
      kind: { "key": "projects.hvacWork", "pt": "trabalho de HVAC" },
      stepName: "HVAC",
      group: { "label": { "key": "common.hvacSystem", "pt": "Sistema HVAC" }, "icon": "flake" },
      workType: [
        "New Construction",
        "Substituição de equipamento",
        "Sistema novo (casa existente)",
        "Ampliação",
        "Manutenção / service call",
        "Comercial (RTU)",
        {
          "pt": "Conversão para heat pump (sair de óleo / gás / propano)",
          "en": "Heat pump conversion (from oil / gas / propane)",
          "es": "Conversión a heat pump (de aceite / gas / propano)"
        },
        { "pt": "Só dutos (sheet metal)", "en": "Ductwork only (sheet metal)", "es": "Solo ductos (sheet metal)" },
        { "pt": "Ventilação (ERV / HRV)", "en": "Ventilation (ERV / HRV)", "es": "Ventilación (ERV / HRV)" }
      ],
      fields: {
        "equipment": {
          "label": { "key": "catalog.equipment", "pt": "Equipamento" },
          "multi": true,
          "opts": [
            "Heat pump ductless (mini-split)", "Mini-split multi-zona", "Heat pump ducted", "Air handler", "Fornalha a gás (furnace)", "Fornalha a óleo",
            "Caldeira (boiler)", "Central AC (condensadora)", "RTU (rooftop)", "ERV / HRV",
            { "pt": "Cassete de teto / slim duct", "en": "Ceiling cassette / slim duct", "es": "Cassette de techo / slim duct" },
            { "pt": "Heat pump ar-água (air-to-water)", "en": "Air-to-water heat pump", "es": "Heat pump aire-agua" }
          ]
        },
        "fuel": {
          "label": { "key": "catalog.fuel", "pt": "Combustível" },
          "opts": [
            "Elétrico (heat pump)", "Gás natural", "Propano", "Óleo",
            { "pt": "Dual fuel (heat pump + backup)", "en": "Dual fuel (heat pump + backup)", "es": "Dual fuel (heat pump + respaldo)" }
          ]
        },
        "brand": {
          "label": { "key": "catalog.brand", "pt": "Marca" },
          "opts": [
            "Mitsubishi", "Fujitsu", "Daikin", "Viessmann", "Carrier", "Lennox", "Bosch", "Trane", "Outra", { "pt": "LG", "en": "LG", "es": "LG" },
            { "pt": "Gree", "en": "Gree", "es": "Gree" }
          ]
        },
        "zones": { "label": { "key": "catalog.zones", "pt": "Zonas" }, "opts": ["1", "2", "3", "4", "5+"] },
        "ducts": { "label": { "key": "catalog.ductwork", "pt": "Dutos" }, "opts": ["Dutos novos (sheet metal)", "Aproveitar dutos existentes", "Sem dutos (ductless)", "Misto"] },
        "condensate": { "label": { "key": "catalog.condensate", "pt": "Condensado" }, "opts": ["Gravidade", "Bomba de condensado"] },
        "refrigerant": {
          "label": { "key": "catalog.refrigerant", "pt": "Refrigerante" },
          "opts": ["R-410A", "R-454B", "R-32"],
          "hint": {
            "pt": "R-454B e R-32 são A2L (levemente inflamáveis): ferramentas, flare e detecção conforme o fabricante. R-410A só em equipamento fabricado/importado antes de 01/01/2025 (regra EPA 2026).",
            "en": "R-454B and R-32 are A2L (mildly flammable): tools, flare fittings and leak detection per manufacturer. R-410A only for equipment made/imported before 01/01/2025 (EPA 2026 rule).",
            "es": "R-454B y R-32 son A2L (levemente inflamables): herramientas, conexiones flare y detección de fugas según el fabricante. R-410A solo para equipos fabricados/importados antes del 01/01/2025 (regla de la EPA de 2026)."
          }
        },
        "gasPiping": {
          "label": { "key": "catalog.gasPiping", "pt": "Tubulação de gás" },
          "opts": ["Sim", "Não", { "pt": "Por outros (plumber / gas fitter)", "en": "By others (plumber / gas fitter)", "es": "Por otros (plomero / gasista)" }],
          "coHide": { "noGas": ["Sim"] }
        },
        "manualJ": { "label": { "key": "catalog.manualJLoadCalc", "pt": "Manual J (cálculo de carga)" }, "opts": ["Sim, feito", "A fazer", "Não precisa"] },
        "rebate": { "label": "Rebate", "opts": ["Sim, Mass Save", "Sim, outro", "Não", "Verificar"] },
        "electricalBy": {
          "label": { "key": "catalog.electricalBy", "pt": "Elétrica feita por" },
          "opts": [
            "Eternity Electric", "Outro eletricista", "Cliente",
            { "pt": "Nossa equipe / empresa elétrica do grupo", "en": "Our electrical team / sister company", "es": "Nuestro equipo eléctrico / empresa hermana" }
          ],
          "legacy": ["Eternity Electric"]
        },
        "manualSD": {
          "label": { "pt": "Manual S / D (seleção e dutos)", "en": "Manual S / D (selection & ducts)", "es": "Manual S / D (selección y ductos)" },
          "opts": [
            { "pt": "Manual S feito", "en": "Manual S done", "es": "Manual S hecho" },
            { "pt": "Manual S + D feitos", "en": "Manual S + D done", "es": "Manual S + D hechos" }, { "pt": "A fazer", "en": "To do", "es": "Por hacer" },
            { "pt": "Não se aplica (ductless simples)", "en": "N/A (simple ductless)", "es": "N/A (ductless simple)" }
          ]
        },
        "coldClimate": {
          "label": { "pt": "Na lista Mass Save (cold climate)", "en": "On Mass Save qualified list (cold climate)", "es": "En la lista aprobada de Mass Save (clima frío)" },
          "opts": [
            { "pt": "Sim (AHRI conferido)", "en": "Yes (AHRI verified)", "es": "Sí (verificado en AHRI)" }, { "pt": "Não", "en": "No", "es": "No" },
            { "pt": "Verificar", "en": "To be checked", "es": "Por verificar" }
          ]
        },
        "massSaveTier": {
          "system": true,
          "label": { "pt": "Rebate Mass Save (tipo)", "en": "Mass Save rebate tier", "es": "Nivel de reembolso de Mass Save" },
          "opts": [
            { "pt": "Whole-home (casa inteira)", "en": "Whole-home", "es": "Whole-home (toda la casa)" }, "Partial-home", "Basic",
            { "pt": "Income-eligible (enhanced)", "en": "Income-eligible (enhanced)", "es": "Por ingresos (mejorado)" },
            { "pt": "Não se aplica", "en": "N/A", "es": "N/A" }
          ]
        },
        "decommission": {
          "system": true,
          "label": { "pt": "Sistema antigo (óleo / gás / propano)", "en": "Existing fossil system", "es": "Sistema fósil existente" },
          "opts": [
            { "pt": "Remover / desligar (documentar)", "en": "Remove / disconnect (documented)", "es": "Retirar / desconectar (documentado)" },
            { "pt": "Fica como backup (controle integrado)", "en": "Stays as backup (integrated controls)", "es": "Se queda de respaldo (controles integrados)" },
            { "pt": "Não tem", "en": "None", "es": "Ninguno" }
          ]
        },
        "outdoorMount": {
          "label": { "pt": "Unidade externa", "en": "Outdoor unit mounting", "es": "Montaje de la unidad exterior" },
          "opts": [
            { "pt": "Pad no chão", "en": "Ground pad", "es": "Pad en el suelo" },
            { "pt": "Stand elevado (neve)", "en": "Elevated stand (snow)", "es": "Base elevada (nieve)" },
            { "pt": "Suporte de parede", "en": "Wall bracket", "es": "Soporte de pared" }, { "pt": "No telhado", "en": "Roof", "es": "Techo" }
          ]
        },
        "lineSetCover": {
          "label": { "pt": "Line set (acabamento)", "en": "Line set finish", "es": "Acabado del line set" },
          "opts": [
            { "pt": "Line hide (canaleta)", "en": "Line hide cover", "es": "Cubierta line hide" },
            { "pt": "Dentro da parede / sótão", "en": "Concealed in wall / attic", "es": "Oculto en la pared / ático" },
            { "pt": "Exposto", "en": "Exposed", "es": "Expuesto" }
          ]
        },
        "testing": {
          "system": true,
          "multi": true,
          "label": { "pt": "Testes / comissionamento", "en": "Testing / commissioning", "es": "Pruebas / puesta en marcha" },
          "opts": [
            { "pt": "Micron decay (vácuo segura)", "en": "Micron decay test", "es": "Prueba de caída de micrones" }, "Superheat / subcooling",
            { "pt": "Pressão estática e CFM", "en": "Static pressure & airflow (CFM)", "es": "Presión estática y flujo de aire (CFM)" },
            { "pt": "Teste de vazamento de dutos (duct blaster)", "en": "Duct leakage test (duct blaster)", "es": "Prueba de fugas de ductos (duct blaster)" },
            "Blower door (HERS)"
          ]
        }
      },
      text: [
        { "key": "capacity", "label": { "key": "catalog.capacityBtuTons", "pt": "Capacidade (BTU / ton)" } },
        { "key": "lineSet", "label": { "key": "catalog.lineSetLength", "pt": "Line set (comprimento)" } },
        { "key": "thermostat", "label": { "key": "catalog.thermostatS", "pt": "Termostato(s)" } },
        { "key": "model", "label": { "pt": "Modelo / nº AHRI", "en": "Model / AHRI no.", "es": "Modelo / n.º AHRI" } },
        { "key": "efficiency", "label": { "pt": "Eficiência (SEER2 / HSPF2)", "en": "Efficiency (SEER2 / HSPF2)", "es": "Eficiencia (SEER2 / HSPF2)" } },
        {
          "key": "designLoad",
          "label": { "pt": "Carga de aquecimento de projeto", "en": "Design heating load", "es": "Carga de calefacción de diseño" },
          "unit": "btu",
          "type": "number"
        }
      ],
      units: [
        { "id": "ea", "label": { "key": "prices.unitEach", "pt": "un" } }, { "id": "btu", "label": "BTU" }, { "id": "ton", "label": "ton" },
        { "id": "ft", "label": "ft" }, { "id": "lf", "label": { "pt": "linear ft", "en": "linear ft", "es": "pie lineal" } }, { "id": "cfm", "label": "CFM" },
        { "id": "inwc", "label": "in. w.c." }, { "id": "micron", "label": "micron" }
      ],
      tasks: {
        "Remoção": [
          "Remover equipamento antigo",
          "Recuperar refrigerante",
          "Descarte de equipamento",
          {
            "pt": "Desligar / remover sistema a óleo ou gás (documentar p/ Mass Save)",
            "en": "Decommission oil / gas system (document for Mass Save)",
            "es": "Desactivar el sistema de aceite / gas (documentar para Mass Save)"
          }
        ],
        "Equipamento": [
          "Instalar condensadora / heat pump", "Pad / suporte da condensadora", "Instalar air handler", "Instalar evaporadoras (mini-split)",
          "Instalar fornalha (furnace)", "Instalar caldeira (boiler)",
          { "pt": "Stand elevado (acima da neve)", "en": "Elevated stand (above snow line)", "es": "Base elevada (sobre la línea de nieve)" },
          { "pt": "Instalar ERV / HRV", "en": "Install ERV / HRV", "es": "Instalar ERV / HRV" }
        ],
        "Distribuição": [
          "Dutos novos (sheet metal)", "Isolamento e vedação de dutos", "Registros supply / return", "Line set", "Dreno / bomba de condensado",
          "Tubulação de gás", "Ventilação / exaustão (flue)",
          { "pt": "Line hide / acabamento da linha", "en": "Line hide / line set cover", "es": "Line hide / cubierta del line set" },
          { "pt": "Selar furos na parede (air sealing)", "en": "Seal wall penetrations (air sealing)", "es": "Sellar las perforaciones en la pared (air sealing)" },
          { "pt": "Coordenar gás com o plumber / gas fitter", "en": "Coordinate gas with plumber / gas fitter", "es": "Coordinar el gas con el plomero / gasista" }
        ],
        "Controles": [
          "Termostatos",
          "Zoneamento",
          "Controles Wi-Fi",
          {
            "pt": "Controle integrado (switchover com o sistema antigo)",
            "en": "Integrated controls (switchover with existing system)",
            "es": "Controles integrados (cambio con el sistema existente)"
          }
        ],
        "Comissionamento": [
          "Teste de pressão (nitrogênio)", "Vácuo", "Carga de refrigerante", "Start-up e teste", "Manual J / cálculo de carga", "Documentação Mass Save",
          { "pt": "Manual S / D (seleção e dutos)", "en": "Manual S / D (selection & ducts)", "es": "Manual S / D (selección y ductos)" },
          { "pt": "Micron decay (vácuo segura)", "en": "Micron decay test", "es": "Prueba de caída de micrones" },
          { "pt": "Superheat / subcooling", "en": "Superheat / subcooling", "es": "Superheat / subcooling" },
          { "pt": "Pressão estática e CFM", "en": "Static pressure & airflow (CFM)", "es": "Presión estática y flujo de aire (CFM)" },
          { "pt": "Teste de vazamento de dutos", "en": "Duct leakage test", "es": "Prueba de fugas de ductos" },
          { "pt": "Fotos, nº de série e AHRI (Mass Save)", "en": "Photos, serial numbers and AHRI (Mass Save)", "es": "Fotos, números de serie y AHRI (Mass Save)" },
          { "pt": "Registrar garantia do fabricante", "en": "Register manufacturer warranty", "es": "Registrar la garantía del fabricante" }
        ],
        "Inspeções": [
          "Permit mecânico", "Inspeção de gás", "Inspeção final",
          { "pt": "Inspeção elétrica (pelo eletricista)", "en": "Electrical inspection (by electrician)", "es": "Inspección eléctrica (por el electricista)" }
        ],
        "Proteção e entrega": [
          { "pt": "Proteção do local (lonas / piso)", "en": "Site protection (drop cloths / floor)", "es": "Protección del lugar (lonas / piso)" },
          { "pt": "Limpeza", "en": "Cleanup", "es": "Limpieza" },
          { "pt": "Treinar o cliente (termostato / filtro)", "en": "Owner orientation (thermostat / filter)", "es": "Orientación al dueño (termostato / filtro)" },
          { "pt": "Punch list", "en": "Punch list", "es": "Punch list" }
        ]
      },
      taskMatch: [
        {
          "t": ["Remoção", "Remover equipamento antigo"],
          "re": "(remove|removal|remover|retirar|quitar|demolish|\\bdemo\\b|disconnect).{0,40}(existing|old|antig|equipment|equipamento|unit|system|furnace|boiler|condenser|air handler)"
        },
        { "t": ["Remoção", "Recuperar refrigerante"], "re": "recover|recovery|recuper" },
        { "t": ["Remoção", "Descarte de equipamento"], "re": "dispos(e|al) of|haul|descart|desech", "not": "garbage disposal" },
        {
          "t": ["Remoção", "Desligar / remover sistema a óleo ou gás (documentar p/ Mass Save)"],
          "re": "(oil|gas).{0,30}(decommission|abandon|remove|removal)|decommission|desativ|desactiv"
        },
        {
          "t": ["Equipamento", "Instalar condensadora / heat pump"],
          "re": "condenser|condensing unit|heat pump|outdoor unit|condensadora|bomba de calor|unidad exterior",
          "not": "line ?set|pad|bracket|circuit|remove|removal|dispose|existing|old |remover|retirar|quitar|descart"
        },
        { "t": ["Equipamento", "Pad / suporte da condensadora"], "re": "\\bpad\\b|wall bracket|bracket|suporte|soporte" },
        { "t": ["Equipamento", "Stand elevado (acima da neve)"], "re": "elevated|snow|\\bstand\\b|base elevada" },
        {
          "t": ["Equipamento", "Instalar air handler"],
          "re": "air[- ]handler|\\bahu\\b|fan coil|manejadora",
          "not": "remove|removal|dispose|existing|old |remover|retirar|quitar|descart"
        },
        {
          "t": ["Equipamento", "Instalar evaporadoras (mini-split)"],
          "re": "evaporat|(wall|ceiling|indoor) (unit|head|cassette)|\\bheads?\\b|cassette|ductless|evaporadora|cabezal",
          "not": "remove|removal|dispose|existing|old |remover|retirar|quitar|descart"
        },
        {
          "t": ["Equipamento", "Instalar fornalha (furnace)"],
          "re": "furnace|fornalha|calefactor|horno de gas",
          "not": "remove|removal|dispose|existing|old |remover|retirar|quitar|descart"
        },
        {
          "t": ["Equipamento", "Instalar caldeira (boiler)"],
          "re": "boiler|caldeira|caldera",
          "not": "remove|removal|dispose|existing|old |remover|retirar|quitar|descart"
        },
        { "t": ["Equipamento", "Instalar ERV / HRV"], "re": "\\berv\\b|\\bhrv\\b|energy recovery|heat recovery" },
        {
          "t": ["Distribuição", "Dutos novos (sheet metal)"],
          "re": "ductwork|\\bducts?\\b|sheet metal|plenum|trunk|\\bdutos?\\b|\\bductos?\\b",
          "not": "seal|insulat|leak|vedac|isolam|sellad|aislam|ductless"
        },
        {
          "t": ["Distribuição", "Isolamento e vedação de dutos"],
          "re": "(seal|insulat|mastic|vedac|isolam|sellad|aislam).{0,40}(duct|duto|ducto)|(duct|duto|ducto).{0,40}(seal|insulat|vedac|isol|sell|aisl)"
        },
        { "t": ["Distribuição", "Registros supply / return"], "re": "register|grille|diffuser|\\bsupplies\\b|supply and return|return air|registro|rejilla|difusor" },
        { "t": ["Distribuição", "Line set"], "re": "line ?sets?|refrigerant (line|pipe|piping)|linha de refrigera|tuberia de refrigerante" },
        { "t": ["Distribuição", "Dreno / bomba de condensado"], "re": "condensate|\\bdrain\\b|dreno|drenaje|condensado" },
        { "t": ["Distribuição", "Tubulação de gás"], "re": "gas (pipe|piping|line)|tubulacao de gas|tuberia de gas", "not": "by others|plumber|gas fitter|gasista" },
        { "t": ["Distribuição", "Coordenar gás com o plumber / gas fitter"], "re": "gas", "ctx": "by others|plumber|gas fitter|gasista|por outros" },
        { "t": ["Distribuição", "Ventilação / exaustão (flue)"], "re": "\\bflue\\b|venting|chimney|liner|exaustao|chimenea" },
        { "t": ["Distribuição", "Line hide / acabamento da linha"], "re": "line ?hide|line ?set cover|lineset cover" },
        { "t": ["Distribuição", "Selar furos na parede (air sealing)"], "re": "air[- ]?seal|seal.{0,20}penetration|penetration" },
        { "t": ["Controles", "Termostatos"], "re": "thermostat|termostato" },
        { "t": ["Controles", "Zoneamento"], "re": "\\bzones?\\b|zoning|zonas?\\b|zoneamento|zonific" },
        { "t": ["Controles", "Controles Wi-Fi"], "re": "wi-?fi|smart thermostat|ecobee|\\bnest\\b" },
        { "t": ["Comissionamento", "Teste de pressão (nitrogênio)"], "re": "nitrogen|pressure test|nitrogenio|nitrogeno" },
        { "t": ["Comissionamento", "Vácuo"], "re": "vacuum|evacuat|\\bvacuo\\b|\\bvacio\\b" },
        { "t": ["Comissionamento", "Carga de refrigerante"], "re": "refrigerant charge|charge the system|weigh[- ]in|carga de refrigerante|\\bcarga\\b" },
        { "t": ["Comissionamento", "Start-up e teste"], "re": "start[- ]?up|commission|arranque|partida" },
        { "t": ["Comissionamento", "Manual J / cálculo de carga"], "re": "manual j|load calc|calculo de carga" },
        { "t": ["Comissionamento", "Documentação Mass Save"], "re": "mass ?save|rebate|heat ?smart|incentiv" },
        { "t": ["Inspeções", "Permit mecânico"], "re": "permit|licenca|permiso" },
        { "t": ["Inspeções", "Inspeção de gás"], "re": "inspect|inspec", "ctx": "\\bgas\\b" },
        { "t": ["Inspeções", "Inspeção final"], "re": "inspect|inspec|sign[- ]?off" },
        { "t": ["Proteção e entrega", "Proteção do local (lonas / piso)"], "re": "drop cloth|floor protection|protect (the )?(floor|site|home)|protecao|proteccion" },
        { "t": ["Proteção e entrega", "Limpeza"], "re": "clean ?up|limpeza|limpieza" },
        { "t": ["Proteção e entrega", "Treinar o cliente (termostato / filtro)"], "re": "train|orientation|walk[- ]?through|demonstrat|instruct|treinar|orientacion" }
      ],
      suggest: {
        "vars": {},
        "rules": [
          {
            "if": { "f": "workType", "re": "Substituição" },
            "add": [["Remoção", "Remover equipamento antigo"], ["Remoção", "Recuperar refrigerante"], ["Remoção", "Descarte de equipamento"]]
          },
          {
            "if": { "f": "equipment", "re": "Heat pump|Mini-split|Central AC" },
            "add": [
              ["Equipamento", "Instalar condensadora / heat pump"], ["Equipamento", "Pad / suporte da condensadora"], ["Distribuição", "Line set"],
              ["Distribuição", "Dreno / bomba de condensado"], ["Comissionamento", "Teste de pressão (nitrogênio)"], ["Comissionamento", "Vácuo"],
              ["Comissionamento", "Carga de refrigerante"]
            ]
          },
          { "if": { "f": "equipment", "re": "ductless|Mini-split" }, "add": [["Equipamento", "Instalar evaporadoras (mini-split)"]] },
          { "if": { "any": [{ "f": "equipment", "has": "Air handler" }, { "f": "equipment", "has": "Heat pump ducted" }] }, "add": [["Equipamento", "Instalar air handler"]] },
          { "if": { "f": "equipment", "re": "Fornalha" }, "add": [["Equipamento", "Instalar fornalha (furnace)"], ["Distribuição", "Ventilação / exaustão (flue)"]] },
          {
            "if": { "f": "equipment", "has": "Caldeira (boiler)" },
            "add": [["Equipamento", "Instalar caldeira (boiler)"], ["Distribuição", "Ventilação / exaustão (flue)"]]
          },
          { "if": { "f": "ducts", "re": "novos" }, "add": [["Distribuição", "Dutos novos (sheet metal)"], ["Distribuição", "Registros supply / return"]] },
          { "if": { "f": "ducts", "re": "existentes" }, "add": [["Distribuição", "Isolamento e vedação de dutos"]] },
          { "if": { "all": [{ "f": "gasPiping", "eq": "Sim" }, { "not": { "co": "noGas" } }] }, "add": [["Distribuição", "Tubulação de gás"], ["Inspeções", "Inspeção de gás"]] },
          { "if": { "any": [{ "f": "zones", "gt": 1 }, { "f": "zones", "eq": "5+" }] }, "add": [["Controles", "Zoneamento"]] },
          { "add": [["Controles", "Termostatos"], ["Comissionamento", "Start-up e teste"]] },
          { "if": { "f": "manualJ", "eq": "A fazer" }, "add": [["Comissionamento", "Manual J / cálculo de carga"]] },
          { "if": { "f": "rebate", "re": "Mass Save" }, "add": [["Comissionamento", "Documentação Mass Save"]] },
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Inspeções", "Permit mecânico"], ["Inspeções", "Inspeção final"]] },
          {
            "if": { "any": [{ "f": "gasPiping", "re": "Por outros" }, { "all": [{ "f": "gasPiping", "eq": "Sim" }, { "co": "noGas" }] }] },
            "add": [["Distribuição", "Coordenar gás com o plumber / gas fitter"]]
          },
          { "if": { "f": "rebate", "re": "Mass Save" }, "add": [["Comissionamento", "Fotos, nº de série e AHRI (Mass Save)"]] },
          {
            "if": { "any": [{ "f": "decommission", "re": "Remover" }, { "f": "workType", "re": "Conversão" }] },
            "add": [["Remoção", "Desligar / remover sistema a óleo ou gás (documentar p/ Mass Save)"]]
          },
          {
            "if": { "any": [{ "f": "decommission", "re": "backup" }, { "f": "fuel", "re": "Dual fuel" }] },
            "add": [["Controles", "Controle integrado (switchover com o sistema antigo)"]]
          },
          { "if": { "any": [{ "f": "manualSD", "eq": "A fazer" }, { "f": "ducts", "re": "novos" }] }, "add": [["Comissionamento", "Manual S / D (seleção e dutos)"]] },
          {
            "if": { "f": "equipment", "re": "Heat pump|Mini-split|Central AC|Cassete" },
            "add": [
              ["Distribuição", "Selar furos na parede (air sealing)"], ["Comissionamento", "Micron decay (vácuo segura)"],
              ["Comissionamento", "Superheat / subcooling"], ["Comissionamento", "Registrar garantia do fabricante"]
            ]
          },
          { "if": { "all": [{ "f": "ducts", "filled": true }, { "not": { "f": "ducts", "re": "ductless" } }] }, "add": [["Comissionamento", "Pressão estática e CFM"]] },
          { "if": { "f": "testing", "has": "Teste de vazamento de dutos (duct blaster)" }, "add": [["Comissionamento", "Teste de vazamento de dutos"]] },
          { "if": { "f": "outdoorMount", "re": "Stand" }, "add": [["Equipamento", "Stand elevado (acima da neve)"]] },
          { "if": { "f": "lineSetCover", "re": "Line hide" }, "add": [["Distribuição", "Line hide / acabamento da linha"]] },
          { "if": { "any": [{ "f": "equipment", "has": "ERV / HRV" }, { "f": "workType", "re": "ERV" }] }, "add": [["Equipamento", "Instalar ERV / HRV"]] },
          { "if": { "f": "electricalBy", "re": "Eternity|Outro" }, "add": [["Inspeções", "Inspeção elétrica (pelo eletricista)"]] },
          {
            "add": [
              ["Proteção e entrega", "Proteção do local (lonas / piso)"], ["Proteção e entrega", "Limpeza"],
              ["Proteção e entrega", "Treinar o cliente (termostato / filtro)"], ["Proteção e entrega", "Punch list"]
            ]
          }
        ]
      },
      inspections: [
        {
          "label": "Permit mecânico",
          "authority": { "pt": "Building department (780 CMR)", "en": "Building department (780 CMR)", "es": "Departamento de construcción (780 CMR)" },
          "when": { "pt": "Antes de começar", "en": "Before starting", "es": "Antes de empezar" }
        },
        {
          "label": "Inspeção de gás",
          "authority": { "pt": "Inspetor de gás (248 CMR)", "en": "Gas inspector (248 CMR)", "es": "Inspector de gas (248 CMR)" },
          "when": { "pt": "Aparelhos a gás", "en": "Gas appliances", "es": "Aparatos de gas" }
        },
        {
          "label": "Inspeção final",
          "authority": { "pt": "Building department", "en": "Building department", "es": "Departamento de construcción" },
          "when": { "pt": "Sistema em operação", "en": "System running", "es": "Sistema funcionando" }
        },
        {
          "label": { "pt": "Inspeção elétrica (pelo eletricista)", "en": "Electrical inspection (by electrician)", "es": "Inspección eléctrica (por el electricista)" },
          "authority": {
            "pt": "Inspetor elétrico (527 CMR 12.00) — permit do eletricista",
            "en": "Wire inspector (527 CMR 12.00) — electrician's permit",
            "es": "Inspector eléctrico (527 CMR 12.00) — permiso del electricista"
          },
          "when": { "pt": "Circuito / disconnect da condensadora", "en": "Condenser circuit / disconnect", "es": "Circuito / desconectador del condensador" }
        },
        {
          "label": { "pt": "Documentação Mass Save", "en": "Mass Save paperwork", "es": "Papeleo de Mass Save" },
          "authority": { "pt": "Mass Save (Heat Pump Installer Network)", "en": "Mass Save (Heat Pump Installer Network)", "es": "Mass Save (Heat Pump Installer Network)" },
          "when": {
            "pt": "Até 28/02/2027 para instalações de 2026; nº de série obrigatório desde 01/10/2026",
            "en": "By 02/28/2027 for 2026 installs; serial numbers required since 10/01/2026",
            "es": "Hasta el 28/02/2027 para instalaciones de 2026; números de serie obligatorios desde el 01/10/2026"
          }
        }
      ],
      proposal: {
        "title": "HVAC PROPOSAL",
        "tagline": "HVAC CONTRACTOR",
        "role": "HVAC Contractor",
        "scopeName": "HVAC",
        "invoiceWork": "HVAC",
        "intro": {
          "text": "This proposal covers the HVAC scope of work for {what} at {where}. Work will be performed in accordance with {code}, ACCA Manuals J / S / D, EPA Section 608 refrigerant regulations, the manufacturer's installation instructions, and the requirements of the local Authority Having Jurisdiction.",
          "code": {
            "MA": "the Massachusetts State Building Code 780 CMR (10th edition) and the Massachusetts energy code, the Massachusetts Fuel Gas Code (248 CMR) where applicable",
            "*": "the applicable state mechanical and energy codes"
          },
          "preset": {
            "text": "This proposal covers the HVAC scope of work for {what} at {where}. Work will be performed in accordance with {code}, the manufacturer's installation instructions, and the requirements of the local Authority Having Jurisdiction.",
            "code": {
              "MA": "the Massachusetts State Building Code 780 CMR (10th edition), the Massachusetts Fuel Gas Code (248 CMR) where applicable",
              "*": "the applicable state mechanical and energy codes, ACCA Manuals J / S / D, EPA Section 608 refrigerant regulations"
            }
          }
        },
        "sections": [
          {
            "title": "Removal of Existing Equipment",
            "keywords": "remov|tirar|velh|antig|existing|old",
            "text": "Disconnect, remove, and properly dispose of the existing equipment.\nRecover existing refrigerant per EPA Section 608."
          },
          {
            "title": "Equipment Installation",
            "keywords": ".",
            "text": "Furnish and install a new {equipment}.\nAll equipment installed per manufacturer's installation instructions."
          },
          {
            "title": "Ductwork & Distribution",
            "keywords": "dutos?\\b|ducts?\\b|ductwork|sheet ?metal",
            "text": "[MA] Furnish and install new sheet-metal supply and return ductwork as required, sealed and insulated per the Massachusetts Energy Code.\n[!MA] Furnish and install new sheet-metal supply and return ductwork as required, sealed and insulated per the energy code as adopted.\nInstall supply registers and return grilles.",
            "exclude": "aproveitar|reaproveitar|reus(?:e|ar)|dutos? existentes?|existing duct|manter os dutos|keep the (?:existing )?ducts|ductless|sem dutos"
          },
          {
            "title": "Existing Ductwork",
            "keywords": "aproveitar (?:os |o )?dutos?|reaproveitar|reus(?:e|ar) (?:the )?(?:existing )?ducts?|dutos? existentes?|existing duct(?:work|s)?|manter os dutos|keep the (?:existing )?ducts",
            "text": "Connect the new equipment to the existing supply and return ductwork; inspect accessible ductwork and seal accessible joints at the equipment connections.\nAny new ductwork beyond the equipment connections will be quoted as a written change order."
          },
          {
            "title": "Refrigerant Piping & Condensate",
            "keywords": "line ?set|linha|refrigerant|condensa",
            "text": "Furnish and install insulated copper line sets, nitrogen pressure test, evacuation (micron verified), and refrigerant charge per manufacturer.\nCondensate drain piping with condensate pump where required."
          },
          {
            "title": "Controls & Thermostats",
            "keywords": "termostato|thermostat|zona|zone",
            "text": "Furnish and install programmable / Wi-Fi thermostat(s) and zoning controls as required."
          },
          {
            "title": "Venting & Gas (by others)",
            "keywords": "furnace|fornalha|g[aá]s|boiler|caldeira",
            "text": "Install venting / flue per manufacturer's instructions.\nGas piping and gas connection to the appliance by others (licensed plumber / gas fitter).",
            "byOthers": true
          },
          {
            "title": "Start-Up, Testing & Commissioning",
            "keywords": ".",
            "text": "Start-up, testing, and commissioning of the complete system; review of operation with the Owner."
          },
          {
            "title": "Rebates & Documentation",
            "keywords": "mass ?save|rebate",
            "text": "[MA] Provide documentation required for **Mass Save** rebates where applicable (rebate approval by the program).\n[!MA] Provide documentation required for utility / state rebate programs where applicable (e.g., NHSaves in New Hampshire; rebate approval by the program)."
          },
          {
            "title": "Permit & Inspections",
            "keywords": ".",
            "text": "Mechanical permit will be pulled by us. Permit fees are included.\n[MA & !co:noGas] Gas permit, where gas work is included, pulled by the licensed gas fitter performing the gas work (248 CMR).\n[!MA & !co:noGas] Gas permit, where gas work is included, pulled by the licensed gas fitter performing the gas work.\n[co:noGas] Gas piping, connections and gas permits by a licensed gas fitter (by others).\nCoordination of all required inspections."
          },
          {
            "title": "Load Calculation & Equipment Selection",
            "keywords": "manual ?[jsd]|c[aá]lculo de carga|load calc|ahri|dimension",
            "text": "Room-by-room **ACCA Manual J** heating and cooling load calculation; equipment selected per **Manual S** and ductwork sized per **Manual D**.\n[MA] Equipment is an **AHRI-matched**, ENERGY STAR Cold Climate system listed on the Mass Save qualified products list where a rebate is pursued.\n[!MA] Equipment is an **AHRI-matched**, ENERGY STAR Cold Climate system listed on the rebate program's qualified products list where a rebate is pursued."
          },
          {
            "title": "Decommissioning of Existing System",
            "keywords": "desligar|decomiss|decommission|convers|[oó]leo|\\boil\\b|propano|propane|backup",
            "text": "[MA] Disconnect and remove (or permanently disable) the existing **oil / propane / gas** heating system serving the converted zones, and document it on the invoice as required by Mass Save.\n[!MA] Disconnect and remove (or permanently disable) the existing **oil / propane / gas** heating system serving the converted zones, and document it on the invoice as required by the rebate program.\nOil tank removal and gas line capping by licensed others unless listed."
          },
          {
            "title": "Airflow & Duct Leakage Testing",
            "keywords": "est[aá]tica|static|cfm|vaz[aã]o|airflow|duct ?(blaster|leak)|vazamento de duto|blower door|hers",
            "text": "Measure total external static pressure and airflow (CFM) and adjust blower settings to the manufacturer's range.\nDuct leakage test (duct blaster) where ducts are outside the thermal envelope or where required by the energy code / HERS rater."
          },
          {
            "title": "Refrigerant & A2L Compliance",
            "keywords": "a2l|454|r-?32|r-?410|micron|superheat|subcool",
            "text": "System uses {refrigerant}; brazed / flare connections and any required refrigerant leak detection per the manufacturer and UL 60335-2-40.\nMicron decay test held below **500 microns** and superheat / subcooling verified at start-up."
          }
        ],
        "defaults": {
          "includes": "all labor, equipment and materials listed above, supervision, applicable {state} sales tax, and mechanical permit fees and inspection coordination.",
          "notIncluded": "[!co:noGas] Gas piping and gas connections (by a licensed plumber / gas fitter) · [co:noGas] Gas piping, connections and gas permits by a licensed gas fitter (by others) · electrical power feed and disconnect (by a licensed electrician unless listed above) · drywall, patching, painting, or carpentry · structural modifications · asbestos or hazardous-material abatement · oil tank removal · engineering or stamped drawings · utility company charges.",
          "clarifications": "Mechanical permit will be pulled by {brand}. **Permit fees are included.**\nAll work performed by licensed technicians.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, {state} Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "key": "proposals.eGReplaceThe",
          "pt": "Ex.: “Trocar o sistema antigo por uma heat pump Viessmann de 36 mil BTU, duas zonas, dois termostatos, linha nova. Preço 14.500, metade na entrada.”"
        },
        "aiRules": "Trade: licensed HVAC contractor.\nGas piping and gas connections are by others (licensed plumber / gas fitter) unless the speaker says the company does them; say so in the scope and in Not Included for any furnace/boiler/gas appliance.\nTypical sections: \"Removal of Existing Equipment\", \"Equipment Installation\" (state brand, model, BTU, SEER/HSPF if said), \"Ductwork & Distribution\", \"Refrigerant Piping & Condensate\", \"Controls & Thermostats\", \"Start-Up, Testing & Commissioning\", \"Rebates & Documentation\" (Mass Save when relevant), \"Permit & Inspections\".\nCode references: Massachusetts State Building Code 780 CMR (10th edition), manufacturer's installation instructions, EPA Section 608 for refrigerant.\nSpeech terms: 'mil BTU' = thousand BTU (36 mil = 36,000 BTU/h = 3 tons), 'tonelada' = ton, 'evaporadora'/'cabeça' = indoor head, 'condensadora' = outdoor unit, 'linha' = line set, 'canaleta' = line hide.\nCapacity in BTU/h and tons (12,000 BTU/h = 1 ton); SEER2 / HSPF2 and AHRI number only if spoken. Line sets in linear feet.\nMass Save: equipment on the Mass Save qualified list (ENERGY STAR Cold Climate), installed by a Heat Pump Installer Network contractor, Manual J submitted; the rebate is decided and paid by the program — never promise an amount or treat it as a discount unless the speaker says so.\nIf the old oil / propane / gas system is removed or disabled, add 'Decommissioning of Existing System'; if it stays as backup, mention integrated controls at the switchover temperature.\nRefrigerant: new split systems use A2L (R-454B or R-32); mention R-410A only if spoken (allowed only for equipment manufactured before 2025).\nCommissioning bullets (only when spoken or standard): nitrogen pressure test, micron decay ≤ 500 microns, superheat / subcooling, static pressure and CFM, duct leakage test.\nNever put gas piping, oil tank removal, or the electrical feed in the HVAC scope when the company does not do them; ductless systems get no ductwork section.",
        "facts": {
          "equipment": {
            "pick": [
              [
                "^(?![\\s\\S]*(?:desligar|remover|retirar|tirar|disconnect|remove|decommission|desativar)[^.,;]{0,25}(?:fornalha|furnace))[\\s\\S]*(?:fornalha|furnace)",
                "**gas furnace** sized per Manual J load calculation, with venting and controls per the manufacturer"
              ],
              [
                "^(?![\\s\\S]*(?:desligar|remover|retirar|tirar|disconnect|remove|decommission|desativar)[^.,;]{0,25}(?:caldeira|boiler))[\\s\\S]*(?:caldeira|boiler)",
                "**boiler** sized per a room-by-room heat-loss calculation, with near-boiler piping and controls per the manufacturer"
              ],
              [
                "mini.?split|ductless|sem dutos|cassete|cassette",
                "**ductless mini-split heat pump system** sized per Manual J load calculation, including outdoor unit on pad / brackets and indoor unit(s)"
              ],
              [
                "^(?![\\s\\S]*(?:mini.?split|ductless))[\\s\\S]*(?:heat ?pump|bomba de calor)",
                "**heat pump system** sized per Manual J load calculation, including outdoor unit on pad / brackets and indoor air handler"
              ],
              [
                "ar.condicionado|air.condition|\\bac\\b|\\ba/c\\b|condensadora|central air",
                "**central air conditioning system** sized per Manual J load calculation, including outdoor condensing unit on pad and indoor evaporator coil"
              ]
            ],
            "all": true,
            "join": "; and a new ",
            "fallback": "**HVAC equipment** listed in the Investment section, sized per Manual J load calculation"
          },
          "refrigerant": {
            "pick": [
              ["r-?454b?\\b", "**R-454B (A2L)** refrigerant"], ["r-?32\\b", "**R-32 (A2L)** refrigerant"],
              ["r-?410a?\\b", "**R-410A** refrigerant (equipment manufactured before 2025)"]
            ],
            "fallback": "the refrigerant specified by the manufacturer (**A2L** — R-454B / R-32 — on new split systems)"
          }
        },
        "adjustExample": {
          "pt": "Ex.: “Tira o line hide, muda o preço para 13 mil e acrescenta mais uma zona com termostato.”",
          "en": "e.g. “Remove the line hide, change the price to 13K and add one more zone with a thermostat.”",
          "es": "ej.: “Quita el line hide, cambia el precio a 13 mil y agrega una zona más con termostato.”"
        }
      },
      prices: {
        "stores": [
          "homedepot", { "id": "johnstone", "name": "Johnstone Supply", "short": "Johnstone", "search": "site:johnstonesupply.com" },
          { "id": "fwwebb", "name": "F.W. Webb", "short": "F.W. Webb", "search": "site:fwwebb.com" },
          { "id": "remichel", "name": "R.E. Michel", "short": "R.E. Michel", "search": "site:remichel.com" }
        ],
        "basic": [
          ["Line set 1/4\" x 3/8\" — 50 ft", { "key": "prices.piping", "pt": "Tubulação" }, { "key": "prices.unitEach", "pt": "un" }],
          ["Line set 3/8\" x 3/4\" — 50 ft", { "key": "prices.piping", "pt": "Tubulação" }, { "key": "prices.unitEach", "pt": "un" }],
          [{ "key": "prices.condensatePump", "pt": "Bomba de condensado" }, { "key": "prices.drain", "pt": "Dreno" }, { "key": "prices.unitEach", "pt": "un" }],
          [
            { "key": "prices.thermostatWire185", "pt": "Fio de termostato 18/5 — 250 ft" }, { "key": "prices.controls", "pt": "Controles" },
            { "key": "prices.unitRoll", "pt": "rolo" }
          ],
          ["Disconnect 60A non-fused", { "key": "prices.hvacElectrical", "pt": "Elétrica HVAC" }, { "key": "prices.unitEach", "pt": "un" }],
          ["Whip 3/4\" x 6 ft", { "key": "prices.hvacElectrical", "pt": "Elétrica HVAC" }, { "key": "prices.unitEach", "pt": "un" }],
          [{ "key": "prices.condenserPad", "pt": "Pad de condensadora" }, { "key": "prices.equipment", "pt": "Equipamento" }, { "key": "prices.unitEach", "pt": "un" }],
          [
            { "key": "prices.miniSplitWallBracket", "pt": "Suporte de parede mini-split" }, { "key": "prices.equipment", "pt": "Equipamento" },
            { "key": "prices.unitEach", "pt": "un" }
          ],
          ["Line hide kit", { "key": "prices.finish", "pt": "Acabamento" }, { "key": "prices.unitEach", "pt": "un" }],
          [{ "key": "prices.wiFiThermostat", "pt": "Termostato Wi-Fi" }, { "key": "prices.controls", "pt": "Controles" }, { "key": "prices.unitEach", "pt": "un" }],
          [{ "key": "prices.foilTapeMastic", "pt": "Fita aluminizada / mastic" }, { "key": "prices.ductwork", "pt": "Dutos" }, { "key": "prices.unitEach", "pt": "un" }],
          [
            { "key": "prices.6InsulatedFlexDuct", "pt": "Duto flexível 6\" isolado — 25 ft" }, { "key": "prices.ductwork", "pt": "Dutos" },
            { "key": "prices.unitEach", "pt": "un" }
          ],
          [
            { "pt": "Line set 3/8\" x 5/8\" — 50 ft", "en": "Line set 3/8\" x 5/8\" — 50 ft", "es": "Line set 3/8\" x 5/8\" — 50 ft" },
            { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Stand elevado de condensadora (neve)", "en": "Elevated condenser stand (snow)", "es": "Base elevada para el condensador (nieve)" },
            { "pt": "Equipamento", "en": "Equipment", "es": "Equipo" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Refrigerante R-454B (cilindro)", "en": "R-454B refrigerant (cylinder)", "es": "Refrigerante R-454B (cilindro)" },
            { "pt": "Refrigerante", "en": "Refrigerant", "es": "Refrigerante" }, { "pt": "cilindro", "en": "cylinder", "es": "cilindro" }
          ],
          [
            { "pt": "Nitrogênio (recarga do cilindro)", "en": "Nitrogen (cylinder refill)", "es": "Nitrógeno (recarga de cilindro)" },
            { "pt": "Refrigerante", "en": "Refrigerant", "es": "Refrigerante" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Porca flare / kit de conexão (A2L)", "en": "Flare nuts / connection kit (A2L-rated)", "es": "Tuercas flare / kit de conexión (para A2L)" },
            { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, "kit"
          ],
          [
            { "pt": "Mastic de duto (balde)", "en": "Duct mastic (bucket)", "es": "Mastic para ductos (cubeta)" },
            { "pt": "Dutos", "en": "Ductwork", "es": "Ductos" }, { "pt": "balde", "en": "bucket", "es": "cubeta" }
          ],
          [
            { "pt": "Chapa galvanizada / duto retangular", "en": "Galvanized sheet metal / rectangular duct", "es": "Lámina galvanizada / ducto rectangular" },
            { "pt": "Dutos", "en": "Ductwork", "es": "Ductos" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Registro supply (teto / parede)", "en": "Supply register (ceiling / wall)", "es": "Rejilla de suministro (techo / pared)" },
            { "pt": "Dutos", "en": "Ductwork", "es": "Ductos" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Filtro MERV 8 / 11", "en": "MERV 8 / 11 filter", "es": "Filtro MERV 8 / 11" }, { "pt": "Equipamento", "en": "Equipment", "es": "Equipo" },
            { "pt": "un", "en": "ea", "es": "c/u" }
          ]
        ],
        "basicOffer": [
          { "list": "hvac", "label": { "key": "prices.basicHvac", "pt": "Lista básica HVAC", "en": "Basic HVAC list", "es": "Lista básica de HVAC" } },
          {
            "list": "electrical",
            "label": { "key": "prices.basicElectrical", "pt": "Adicionar lista básica elétrica", "en": "Add basic electrical list", "es": "Agregar lista básica eléctrica" }
          }
        ],
        "promos": false,
        "storesNota": "As 5 lojas atuais (as da elétrica) ficam. As 3 novas são distribuidores de HVAC; 8 colunas não cabem bem no celular — sugerir ao engenheiro deixar escolher as colunas visíveis.",
        "searchExample": { "pt": "ex.: line set, disconnect, pad", "en": "e.g. line set, disconnect, condenser pad", "es": "ej.: line set, desconectador, pad del condensador" }
      },
      groupsI18n: { "en": { "Proteção e entrega": "Protection & closeout" }, "es": { "Proteção e entrega": "Protección y entrega" } },
      companyFlags: [
        {
          "key": "noGas",
          "label": { "pt": "Não fazemos gás", "en": "We don't do gas work", "es": "No hacemos trabajos de gas" },
          "desc": {
            "pt": "A ficha não oferece “Tubulação de gás: Sim” (usa “Por outros (plumber / gas fitter)”) e “Sugerir pela ficha” nunca sugere “Tubulação de gás”: sugere coordenar com o plumber / gas fitter.",
            "en": "The job sheet won't offer “Gas piping: Yes” (it uses “By others (plumber / gas fitter)”), and “Suggest from job sheet” never suggests gas piping: it suggests coordinating with the plumber / gas fitter.",
            "es": "La ficha no ofrece “Tubería de gas: Sí” (usa “Por otros (plomero / gasista)”), y “Sugerir según la ficha” nunca sugiere tubería de gas: sugiere coordinar con el plomero / gasista."
          },
          "aiRule": "This company does NOT do gas work: gas piping and gas connections are always by others (licensed plumber / gas fitter) — say so in the scope and in Not Included; never price gas work."
        }
      ]
    },
    {
      id: "sprinkler",
      aliases: [],
      order: 35,
      category: "mep",
      label: { "pt": "Sprinkler (incêndio)", "en": "Fire sprinkler", "es": "Rociadores contra incendios" },
      companySuffix: "Fire Protection",
      onboarding: {
        "label": { "pt": "Sprinkler (incêndio)", "en": "Fire sprinkler", "es": "Rociadores contra incendios" },
        "desc": {
          "pt": "NFPA 13/13R/13D, standpipe, fire pump",
          "en": "NFPA 13/13R/13D, standpipes, fire pumps",
          "es": "NFPA 13/13R/13D, standpipes, bombas contra incendios"
        }
      },
      icon: { "svg": "<path d=\"M12 3v4M8 7h8\"/><path d=\"M10 7l-1 4h6l-1-4\"/><path d=\"M12 14v2M7.5 13.5 6 16M16.5 13.5 18 16M9.5 18l-.5 2.5M14.5 18l.5 2.5\"/>" },
      kind: { "pt": "trabalho de sprinkler", "en": "sprinkler job", "es": "trabajo de rociadores" },
      stepName: "Sprinkler",
      group: { "label": { "pt": "Sistema de sprinkler", "en": "Sprinkler system", "es": "Sistema de rociadores" }, "icon": "trade-sprinkler" },
      workType: [
        { "pt": "Sistema novo residencial (NFPA 13D)", "en": "New residential system (NFPA 13D)", "es": "Sistema residencial nuevo (NFPA 13D)" },
        { "pt": "Sistema novo multifamily (NFPA 13R)", "en": "New multifamily system (NFPA 13R)", "es": "Sistema multifamiliar nuevo (NFPA 13R)" },
        { "pt": "Sistema novo comercial (NFPA 13)", "en": "New commercial system (NFPA 13)", "es": "Sistema comercial nuevo (NFPA 13)" },
        {
          "pt": "Reforma / tenant fit-out (mover cabeças)",
          "en": "Renovation / tenant fit-out (relocate heads)",
          "es": "Renovación / tenant fit-out (reubicar cabezas)"
        },
        { "pt": "Retrofit (prédio existente sem sprinkler)", "en": "Retrofit (existing unsprinklered building)", "es": "Retrofit (edificio existente sin rociadores)" },
        "Standpipe / fire pump",
        { "pt": "Inspeção, teste e manutenção (NFPA 25)", "en": "Inspection, testing & maintenance (NFPA 25)", "es": "Inspección, prueba y mantenimiento (NFPA 25)" },
        { "pt": "Reparo / service call", "en": "Repair / service call", "es": "Reparación / service call" }
      ],
      fields: {
        "standard": {
          "label": { "pt": "Norma", "en": "Standard", "es": "Norma" },
          "opts": [
            { "pt": "NFPA 13D (1–2 famílias)", "en": "NFPA 13D (one- and two-family)", "es": "NFPA 13D (una y dos familias)" },
            { "pt": "NFPA 13R (residencial até 4 andares)", "en": "NFPA 13R (low-rise residential)", "es": "NFPA 13R (residencial de poca altura)" }, "NFPA 13",
            "NFPA 13 + NFPA 14 (standpipe)"
          ]
        },
        "systemType": {
          "label": { "pt": "Tipo de sistema", "en": "System type", "es": "Tipo de sistema" },
          "multi": true,
          "opts": [
            { "pt": "Wet (molhado)", "en": "Wet pipe", "es": "Tubería húmeda (wet)" },
            { "pt": "Dry (seco — área sem aquecimento)", "en": "Dry pipe (unheated areas)", "es": "Tubería seca (áreas sin calefacción)" },
            "Pre-action",
            { "pt": "Antifreeze (listado)", "en": "Antifreeze (listed)", "es": "Anticongelante (listado)" },
            {
              "pt": "Multipurpose (junto com a água da casa — 13D)",
              "en": "Multipurpose (combined with domestic — 13D)",
              "es": "Multiuso (combinado con el agua doméstica — 13D)"
            }
          ]
        },
        "hazard": {
          "label": { "pt": "Classe de risco", "en": "Hazard classification", "es": "Clasificación de riesgo" },
          "opts": [
            { "pt": "Light hazard (residencial / escritório)", "en": "Light hazard", "es": "Riesgo ligero" },
            { "pt": "Ordinary hazard grupo 1 (garagem, mecânica)", "en": "Ordinary hazard group 1", "es": "Riesgo ordinario grupo 1" },
            { "pt": "Ordinary hazard grupo 2", "en": "Ordinary hazard group 2", "es": "Riesgo ordinario grupo 2" }, "Extra hazard",
            { "pt": "Armazenagem (storage)", "en": "Storage", "es": "Almacenamiento" }
          ]
        },
        "headType": {
          "label": { "pt": "Cabeças (heads)", "en": "Sprinkler heads", "es": "Cabezas de rociador" },
          "multi": true,
          "opts": [
            { "pt": "Residencial listada (pendente / sidewall)", "en": "Listed residential (pendent / sidewall)", "es": "Residencial listada (pendent / sidewall)" },
            { "pt": "Pendente concealed (com tampa)", "en": "Concealed pendent", "es": "Pendent oculta (concealed)" },
            { "pt": "Pendente recessed", "en": "Recessed pendent", "es": "Pendent empotrada (recessed)" }, "Sidewall", "Upright", "Dry pendent / dry sidewall",
            { "pt": "Quick response comercial", "en": "Commercial quick response", "es": "Comercial de respuesta rápida" }, "ESFR / storage"
          ]
        },
        "pipe": {
          "label": { "pt": "Tubulação", "en": "Piping", "es": "Tubería" },
          "opts": [
            "CPVC (BlazeMaster)", { "pt": "Aço Schedule 10 / 40 (black steel)", "en": "Schedule 10 / 40 black steel", "es": "Acero negro Schedule 10 / 40" },
            { "pt": "Aço galvanizado (dry)", "en": "Galvanized steel (dry)", "es": "Acero galvanizado (seco)" },
            { "pt": "PEX listado (13D)", "en": "Listed PEX (13D)", "es": "PEX listado (13D)" },
            { "pt": "Misto (aço nos mains, CPVC nos ramais)", "en": "Mixed (steel mains, CPVC branches)", "es": "Mixto (mains de acero, ramales de CPVC)" }
          ]
        },
        "waterSupply": {
          "label": { "pt": "Abastecimento", "en": "Water supply", "es": "Suministro de agua" },
          "opts": [
            { "pt": "Rede municipal", "en": "Municipal water", "es": "Agua municipal" }, { "pt": "Poço + tanque", "en": "Well + tank", "es": "Pozo + tanque" },
            { "pt": "Tanque + bomba", "en": "Tank + pump", "es": "Tanque + bomba" }
          ]
        },
        "service": {
          "label": { "pt": "Entrada de água (fire service)", "en": "Fire service entrance", "es": "Acometida contra incendios" },
          "opts": [
            { "pt": "Entrada existente", "en": "Existing service", "es": "Acometida existente" },
            { "pt": "Nova entrada — underground por outros", "en": "New service — underground by others", "es": "Acometida nueva — subterráneo por otros" },
            { "pt": "Nova entrada — underground incluído", "en": "New service — underground included", "es": "Acometida nueva — subterráneo incluido" },
            { "pt": "Combinada com a doméstica (13D)", "en": "Combined with domestic (13D)", "es": "Combinada con el agua doméstica (13D)" }
          ]
        },
        "backflow": {
          "label": "Backflow",
          "opts": [
            { "pt": "Não precisa", "en": "Not required", "es": "No hace falta" }, "Double check (DCVA)", "Double check detector (DCDA)",
            { "pt": "Reduced pressure (RPZ)", "en": "Reduced pressure zone (RPZ)", "es": "Zona de presión reducida (RPZ)" }
          ]
        },
        "flowTest": {
          "label": { "pt": "Teste de fluxo (hidrante)", "en": "Flow test (hydrant)", "es": "Prueba de flujo (hidrante)" },
          "opts": [
            { "pt": "Já tem (até 12 meses)", "en": "Available (within 12 months)", "es": "Disponible (de los últimos 12 meses)" },
            { "pt": "A fazer", "en": "To do", "es": "Por hacer" },
            { "pt": "Pedir dados ao water department", "en": "Request data from water department", "es": "Pedir datos al departamento de agua" }
          ]
        },
        "hydraulic": {
          "label": { "pt": "Projeto / cálculo", "en": "Design / calculations", "es": "Diseño / cálculos" },
          "opts": [
            {
              "pt": "Cálculo hidráulico por nós (projetista NICET)",
              "en": "Hydraulic calcs in-house (NICET designer)",
              "es": "Cálculo hidráulico propio (diseñador NICET)"
            },
            { "pt": "Engenheiro FPE (carimbado)", "en": "Fire protection engineer (stamped)", "es": "Ingeniero de protección contra incendios (sellado)" },
            { "pt": "Pipe schedule / pequena alteração", "en": "Pipe schedule / minor alteration", "es": "Pipe schedule / alteración menor" }
          ]
        },
        "monitoring": {
          "label": { "pt": "Alarmes e supervisão", "en": "Alarms & supervision", "es": "Alarmas y supervisión" },
          "multi": true,
          "system": true,
          "opts": [
            "Flow switch",
            "Tamper switches",
            { "pt": "Sino / horn-strobe externo", "en": "Exterior bell / horn-strobe", "es": "Campana / horn-strobe exterior" },
            "Low air (dry)",
            {
              "pt": "Monitoramento central (pelo fire alarm, outros)",
              "en": "Central station monitoring (by fire alarm, others)",
              "es": "Monitoreo central (por la alarma contra incendios, otros)"
            }
          ]
        },
        "standpipe": {
          "label": "Standpipe",
          "system": true,
          "opts": [{ "pt": "Não", "en": "No", "es": "No" }, { "pt": "Classe I", "en": "Class I", "es": "Clase I" }, { "pt": "Classe III", "en": "Class III", "es": "Clase III" }]
        },
        "firePump": {
          "label": "Fire pump",
          "system": true,
          "opts": [
            { "pt": "Não", "en": "No", "es": "No" }, { "pt": "Elétrica (motor)", "en": "Electric", "es": "Eléctrica" }, "Diesel",
            { "pt": "Booster residencial (13D)", "en": "Residential booster (13D)", "es": "Booster residencial (13D)" }
          ]
        },
        "fdc": {
          "label": { "pt": "FDC (conexão do bombeiro)", "en": "Fire department connection", "es": "Conexión del departamento de bomberos (FDC)" },
          "system": true,
          "opts": [
            { "pt": "Não", "en": "No", "es": "No" }, { "pt": "FDC 4\" Storz", "en": "4\" Storz FDC", "es": "FDC Storz de 4\"" },
            { "pt": "FDC siamesa 2-1/2\"", "en": "2-1/2\" Siamese FDC", "es": "FDC siamesa de 2-1/2\"" }
          ]
        }
      },
      text: [
        { "key": "heads", "label": { "pt": "Nº de cabeças (heads)", "en": "Number of heads", "es": "Número de cabezas" }, "unit": "head", "type": "number" },
        { "key": "area", "label": { "pt": "Área protegida (sq ft)", "en": "Protected area (sq ft)", "es": "Área protegida (sq ft)" }, "unit": "sqft", "type": "number" },
        {
          "key": "flowData",
          "label": {
            "pt": "Teste de fluxo (static / residual psi @ gpm)",
            "en": "Flow test (static / residual psi @ gpm)",
            "es": "Prueba de flujo (psi estática / residual @ gpm)"
          }
        },
        { "key": "demand", "label": { "pt": "Demanda do sistema (gpm @ psi)", "en": "System demand (gpm @ psi)", "es": "Demanda del sistema (gpm @ psi)" } },
        { "key": "engineer", "label": { "pt": "Engenheiro / projetista", "en": "Engineer / designer", "es": "Ingeniero / diseñador" } }
      ],
      units: [
        { "id": "head", "label": { "pt": "cabeças", "en": "heads", "es": "cabezas" } }, { "id": "sqft", "label": "sq ft" },
        { "id": "lf", "label": { "pt": "linear ft", "en": "linear ft", "es": "pie lineal" } }, { "id": "gpm", "label": "gpm" }, { "id": "psi", "label": "psi" },
        { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }
      ],
      tasks: {
        "Projeto e aprovação": [
          { "pt": "Teste de fluxo (hidrante)", "en": "Hydrant flow test", "es": "Prueba de flujo del hidrante" },
          "Layout / shop drawings",
          { "pt": "Cálculo hidráulico", "en": "Hydraulic calculations", "es": "Cálculos hidráulicos" },
          {
            "pt": "Enviar ao Fire Department (plan review)",
            "en": "Submit to Fire Department (plan review)",
            "es": "Enviar al Departamento de Bomberos (plan review)"
          },
          { "pt": "Permit de sprinkler", "en": "Sprinkler permit", "es": "Permiso de rociadores" },
          { "pt": "Pedido de material (cabeças, válvulas)", "en": "Material order (heads, valves)", "es": "Pedido de material (cabezas, válvulas)" }
        ],
        "Entrada e riser": [
          { "pt": "Coordenar com o water department", "en": "Coordinate with water department", "es": "Coordinar con el departamento de agua" },
          { "pt": "Riser / válvula de controle e dreno", "en": "Riser / control valve and drain", "es": "Riser / válvula de control y drenaje" },
          "Backflow preventer",
          { "pt": "Flush do underground (antes de ligar)", "en": "Underground flush (before connection)", "es": "Flush del subterráneo (antes de conectar)" }
        ],
        "Instalação": [
          { "pt": "Mains e branch lines", "en": "Mains and branch lines", "es": "Mains y ramales" },
          { "pt": "Hangers e suportes", "en": "Hangers and supports", "es": "Colgadores y soportes" },
          { "pt": "Cabeças — rough (drops)", "en": "Heads — rough-in (drops)", "es": "Cabezas — rough-in (drops)" },
          { "pt": "Proteção contra congelamento", "en": "Freeze protection", "es": "Protección contra congelamiento" },
          { "pt": "Válvula dry / compressor", "en": "Dry valve / air compressor", "es": "Válvula seca / compresor de aire" },
          { "pt": "Standpipe e válvulas de mangueira", "en": "Standpipe and hose valves", "es": "Standpipe y válvulas de manguera" }, "Fire pump",
          { "pt": "FDC (conexão do bombeiro)", "en": "Fire department connection", "es": "Conexión del departamento de bomberos (FDC)" }
        ],
        "Testes": [
          { "pt": "Teste hidrostático (200 psi / 2 h)", "en": "Hydrostatic test (200 psi / 2 hr)", "es": "Prueba hidrostática (200 psi / 2 h)" },
          {
            "pt": "Inspeção rough (acima do forro) com o Fire Department",
            "en": "Rough / above-ceiling inspection with Fire Department",
            "es": "Inspección de rough / sobre el cielo falso con el Departamento de Bomberos"
          },
          {
            "pt": "Teste de flow e tamper com o fire alarm",
            "en": "Flow and tamper test with fire alarm",
            "es": "Prueba de flow y tamper con la alarma contra incendios"
          },
          { "pt": "Trip test da válvula dry", "en": "Dry valve trip test", "es": "Prueba de disparo (trip test) de la válvula seca" },
          {
            "pt": "Teste hidrostático 13D (pressão normal de operação)",
            "en": "NFPA 13D hydrostatic test (normal operating pressure)",
            "es": "Prueba hidrostática NFPA 13D (presión normal de operación)"
          },
          { "pt": "Teste de ar do sistema dry (40 psi / 24 h)", "en": "Dry system air test (40 psi / 24 hr)", "es": "Prueba de aire del sistema seco (40 psi / 24 h)" }
        ],
        "Acabamento": [
          {
            "pt": "Cabeças finais / escutcheons depois do forro",
            "en": "Final heads / escutcheons after ceiling",
            "es": "Cabezas finales / escudos después del cielo falso"
          },
          { "pt": "Caixa de cabeças sobressalentes + chave", "en": "Spare head cabinet + wrench", "es": "Gabinete de cabezas de repuesto + llave" },
          { "pt": "Placa hidráulica e sinalização das válvulas", "en": "Hydraulic placard and valve signage", "es": "Placa hidráulica y señalización de válvulas" }
        ],
        "Aceitação e entrega": [
          { "pt": "Teste de aceitação com o Fire Department", "en": "Fire Department acceptance test", "es": "Prueba de aceptación con el Departamento de Bomberos" },
          {
            "pt": "Certificados (Material & Test Certificate)",
            "en": "Contractor's Material & Test Certificates",
            "es": "Certificados de material y prueba del contratista"
          },
          { "pt": "As-built", "en": "As-built drawings", "es": "Planos as-built" },
          { "pt": "Orientar o dono (NFPA 25)", "en": "Owner orientation (NFPA 25)", "es": "Orientación al dueño (NFPA 25)" },
          { "pt": "Limpeza e punch list", "en": "Cleanup and punch list", "es": "Limpieza y punch list" }
        ]
      },
      groupsI18n: {
        "en": {
          "Projeto e aprovação": "Design & approval",
          "Entrada e riser": "Service & riser",
          "Instalação": "Installation",
          "Testes": "Testing",
          "Acabamento": "Finish",
          "Aceitação e entrega": "Acceptance & closeout"
        },
        "es": {
          "Projeto e aprovação": "Diseño y aprobación",
          "Entrada e riser": "Acometida y riser",
          "Instalação": "Instalación",
          "Testes": "Pruebas",
          "Acabamento": "Acabado",
          "Aceitação e entrega": "Aceptación y entrega"
        }
      },
      suggest: {
        "vars": { "novo": { "f": "workType", "re": "novo|Retrofit" }, "d13": { "any": [{ "f": "standard", "re": "13D" }, { "f": "workType", "re": "13D" }] } },
        "rules": [
          { "if": { "f": "flowTest", "re": "A fazer" }, "add": [["Projeto e aprovação", "Teste de fluxo (hidrante)"]] },
          { "if": { "any": [{ "var": "novo" }, { "f": "workType", "re": "Reforma" }] }, "add": [["Projeto e aprovação", "Layout / shop drawings"]] },
          { "if": { "f": "hydraulic", "re": "Cálculo|Engenheiro" }, "add": [["Projeto e aprovação", "Cálculo hidráulico"]] },
          { "if": { "any": [{ "var": "novo" }, { "f": "workType", "re": "Reforma|Standpipe" }] }, "add": [["Projeto e aprovação", "Enviar ao Fire Department (plan review)"]] },
          { "add": [["Projeto e aprovação", "Permit de sprinkler"]] },
          { "if": { "var": "novo" }, "add": [["Projeto e aprovação", "Pedido de material (cabeças, válvulas)"]] },
          {
            "if": { "f": "service", "re": "Nova entrada" },
            "add": [["Entrada e riser", "Coordenar com o water department"], ["Entrada e riser", "Flush do underground (antes de ligar)"]]
          },
          { "if": { "var": "novo" }, "add": [["Entrada e riser", "Riser / válvula de controle e dreno"]] },
          { "if": { "f": "backflow", "ne": "Não precisa" }, "add": [["Entrada e riser", "Backflow preventer"]] },
          { "if": { "var": "novo" }, "add": [["Instalação", "Mains e branch lines"], ["Instalação", "Hangers e suportes"]] },
          { "if": { "any": [{ "var": "novo" }, { "f": "workType", "re": "Reforma" }] }, "add": [["Instalação", "Cabeças — rough (drops)"]] },
          {
            "if": { "any": [{ "f": "headType", "has": "Dry pendent / dry sidewall" }, { "f": "systemType", "re": "Antifreeze|Dry" }] },
            "add": [["Instalação", "Proteção contra congelamento"]]
          },
          { "if": { "f": "systemType", "re": "Dry|Pre-action" }, "add": [["Instalação", "Válvula dry / compressor"]] },
          { "if": { "f": "standpipe", "re": "Classe" }, "add": [["Instalação", "Standpipe e válvulas de mangueira"]] },
          { "if": { "f": "firePump", "ne": "Não" }, "add": [["Instalação", "Fire pump"]] },
          { "if": { "f": "fdc", "ne": "Não" }, "add": [["Instalação", "FDC (conexão do bombeiro)"]] },
          { "if": { "all": [{ "var": "novo" }, { "not": { "var": "d13" } }] }, "add": [["Testes", "Teste hidrostático (200 psi / 2 h)"]] },
          { "if": { "all": [{ "var": "novo" }, { "var": "d13" }] }, "add": [["Testes", "Teste hidrostático 13D (pressão normal de operação)"]] },
          { "if": { "var": "novo" }, "add": [["Testes", "Inspeção rough (acima do forro) com o Fire Department"]] },
          { "if": { "f": "monitoring", "re": "Flow|Tamper" }, "add": [["Testes", "Teste de flow e tamper com o fire alarm"]] },
          { "if": { "f": "systemType", "re": "Dry|Pre-action" }, "add": [["Testes", "Teste de ar do sistema dry (40 psi / 24 h)"], ["Testes", "Trip test da válvula dry"]] },
          { "if": { "any": [{ "var": "novo" }, { "f": "workType", "re": "Reforma" }] }, "add": [["Acabamento", "Cabeças finais / escutcheons depois do forro"]] },
          {
            "if": { "all": [{ "f": "standard", "filled": true }, { "not": { "f": "standard", "re": "13D" } }] },
            "add": [["Acabamento", "Caixa de cabeças sobressalentes + chave"], ["Acabamento", "Placa hidráulica e sinalização das válvulas"]]
          },
          { "add": [["Aceitação e entrega", "Teste de aceitação com o Fire Department"]] },
          {
            "if": { "var": "novo" },
            "add": [
              ["Aceitação e entrega", "Certificados (Material & Test Certificate)"], ["Aceitação e entrega", "As-built"],
              ["Aceitação e entrega", "Orientar o dono (NFPA 25)"]
            ]
          },
          { "add": [["Aceitação e entrega", "Limpeza e punch list"]] }
        ],
        "order": [
          "Teste de fluxo (hidrante)", "Layout / shop drawings", "Cálculo hidráulico", "Enviar ao Fire Department (plan review)", "Permit de sprinkler",
          "Pedido de material (cabeças, válvulas)", "Coordenar com o water department", "Flush do underground (antes de ligar)",
          "Riser / válvula de controle e dreno", "Backflow preventer", "Hangers e suportes", "Mains e branch lines", "Cabeças — rough (drops)",
          "Standpipe e válvulas de mangueira", "Fire pump", "FDC (conexão do bombeiro)", "Válvula dry / compressor", "Proteção contra congelamento",
          "Teste hidrostático (200 psi / 2 h)", "Teste hidrostático 13D (pressão normal de operação)", "Teste de ar do sistema dry (40 psi / 24 h)",
          "Inspeção rough (acima do forro) com o Fire Department", "Teste de flow e tamper com o fire alarm", "Trip test da válvula dry",
          "Cabeças finais / escutcheons depois do forro", "Caixa de cabeças sobressalentes + chave", "Placa hidráulica e sinalização das válvulas",
          "Teste de aceitação com o Fire Department", "Certificados (Material & Test Certificate)", "As-built", "Orientar o dono (NFPA 25)",
          "Limpeza e punch list"
        ]
      },
      inspections: [
        {
          "label": {
            "pt": "Enviar ao Fire Department (plan review)",
            "en": "Submit to Fire Department (plan review)",
            "es": "Enviar al Departamento de Bomberos (plan review)"
          },
          "authority": {
            "pt": "Fire Department (527 CMR 1.00; licença MA de sprinkler fitter — c.146 §§81–88)",
            "en": "Fire Department (527 CMR 1.00; MA sprinkler fitter license — c.146 §§81–88)",
            "es": "Departamento de Bomberos (527 CMR 1.00; licencia de sprinkler fitter de MA — c.146 §§81–88)"
          },
          "when": { "pt": "Antes de instalar", "en": "Before installation", "es": "Antes de la instalación" }
        },
        {
          "label": { "pt": "Permit de sprinkler", "en": "Sprinkler permit", "es": "Permiso de rociadores" },
          "authority": { "pt": "Fire Department / AHJ", "en": "Fire Department / AHJ", "es": "Departamento de Bomberos / AHJ" },
          "when": { "pt": "Antes de começar", "en": "Before starting", "es": "Antes de empezar" }
        },
        {
          "label": { "pt": "Teste hidrostático (200 psi / 2 h)", "en": "Hydrostatic test (200 psi / 2 hr)", "es": "Prueba hidrostática (200 psi / 2 h)" },
          "authority": { "pt": "Fire Department (NFPA 13)", "en": "Fire Department (NFPA 13)", "es": "Departamento de Bomberos (NFPA 13)" },
          "when": { "pt": "Antes de fechar forro e paredes", "en": "Before ceilings and walls are closed", "es": "Antes de cerrar techos y paredes" }
        },
        {
          "label": {
            "pt": "Inspeção rough (acima do forro) com o Fire Department",
            "en": "Rough / above-ceiling inspection with Fire Department",
            "es": "Inspección de rough / sobre el cielo falso con el Departamento de Bomberos"
          },
          "authority": {
            "pt": "Fire Department (+ FPE quando o cálculo é carimbado)",
            "en": "Fire Department (+ FPE when calcs are stamped)",
            "es": "Departamento de Bomberos (+ FPE cuando los cálculos van sellados)"
          },
          "when": { "pt": "Tubulação pronta, forro aberto", "en": "Piping complete, ceilings open", "es": "Tubería completa, techos abiertos" }
        },
        {
          "label": { "pt": "Teste de aceitação com o Fire Department", "en": "Fire Department acceptance test", "es": "Prueba de aceptación con el Departamento de Bomberos" },
          "authority": { "pt": "Fire Department", "en": "Fire Department", "es": "Departamento de Bomberos" },
          "when": {
            "pt": "Sistema pronto: flow, tamper, alarmes, válvulas",
            "en": "System complete: flow, tamper, alarms, valves",
            "es": "Sistema completo: flow, tamper, alarmas, válvulas"
          }
        },
        {
          "label": "Backflow preventer",
          "authority": { "pt": "Water department / testador certificado", "en": "Water department / certified tester", "es": "Departamento de agua / probador certificado" },
          "when": { "pt": "Na instalação e todo ano", "en": "At installation and annually", "es": "En la instalación y cada año" }
        },
        {
          "label": {
            "pt": "Teste hidrostático 13D (pressão normal de operação)",
            "en": "NFPA 13D hydrostatic test (normal operating pressure)",
            "es": "Prueba hidrostática NFPA 13D (presión normal de operación)"
          },
          "authority": {
            "pt": "Fire Department (NFPA 13D, cap. de testes de aceitação)",
            "en": "Fire Department (NFPA 13D, acceptance tests chapter)",
            "es": "Departamento de Bomberos (NFPA 13D, capítulo de pruebas de aceptación)"
          },
          "when": { "pt": "Antes de fechar paredes e forros", "en": "Before walls and ceilings are closed", "es": "Antes de cerrar paredes y techos" }
        },
        {
          "label": { "pt": "Teste de ar do sistema dry (40 psi / 24 h)", "en": "Dry system air test (40 psi / 24 hr)", "es": "Prueba de aire del sistema seco (40 psi / 24 h)" },
          "authority": {
            "pt": "Fire Department (NFPA 13 — dry pipe / double interlock pre-action)",
            "en": "Fire Department (NFPA 13 — dry pipe / double interlock pre-action)",
            "es": "Departamento de Bomberos (NFPA 13 — tubería seca / pre-action de doble interlock)"
          },
          "when": { "pt": "Sistema dry montado, antes da aceitação", "en": "Dry system complete, before acceptance", "es": "Sistema seco completo, antes de la aceptación" }
        }
      ],
      proposal: {
        "title": "FIRE SPRINKLER PROPOSAL",
        "tagline": "LICENSED FIRE PROTECTION SPRINKLER CONTRACTOR",
        "role": "Fire Protection Sprinkler Contractor",
        "scopeName": "Fire Sprinkler",
        "invoiceWork": "fire sprinkler",
        "intro": {
          "text": "This proposal covers the fire sprinkler scope of work for {what} at {where}. Work will be performed in accordance with NFPA 13 / 13R / 13D as applicable, {code}, and the requirements of the local Fire Department / Authority Having Jurisdiction.",
          "code": {
            "MA": "the Massachusetts Comprehensive Fire Safety Code (527 CMR 1.00), the Massachusetts State Building Code 780 CMR (10th edition), and M.G.L. c.148. All sprinkler work will be performed by Massachusetts licensed sprinkler fitters under permit",
            "*": "the state fire code and building code as adopted"
          }
        },
        "sections": [
          {
            "title": "Design, Hydraulic Calculations & Approvals",
            "text": "Prepare sprinkler layout / shop drawings and **hydraulic calculations** per {standard}, based on a current hydrant flow test or water supply data from the water department.\nSubmit drawings, calculations, and product data to the Fire Department for plan review; pull the sprinkler permit. Permit fees are included.",
            "keywords": "."
          },
          {
            "title": "Water Service, Riser & Backflow",
            "text": "Connect to the fire service at the point of connection shown on the drawings (typically 1 ft above the finished floor; underground by others unless listed) and furnish a {riser} with control valve, check valve, main drain, pressure gauge(s), and inspector's test connection.\nFurnish and install the {backflow}; initial backflow test by a certified tester.",
            "keywords": "entrada|service|riser|backflow|dcda|rpz|double check|water dep|v[aá]lvula de controle"
          },
          {
            "title": "Sprinkler Piping & Hangers",
            "text": "Furnish and install {pipe} with listed hangers and supports per {standard}.\nPiping concealed above ceilings and in soffits where the construction allows; exposed piping in unfinished areas.",
            "keywords": "tubo|tubula|pipe|piping|cpvc|blazemaster|a[cç]o|steel|schedule|main|branch|hanger|\\bpex\\b|multipurpose"
          },
          {
            "title": "Sprinkler Heads",
            "text": "Furnish and install {heads} — {headType} — with escutcheons / cover plates, located per the approved drawings.\nDry pendent / dry sidewall heads at attics, balconies, and areas subject to freezing where shown on the approved drawings.",
            "keywords": "cabe[cç]a|head|bico|pendent|pendente|sidewall|upright|concealed|dry pendent"
          },
          {
            "title": "Standpipe & Fire Department Connection",
            "text": "Furnish and install a {standpipeClass} with **2-1/2\" hose valves** at the locations required by NFPA 14 (each stair landing for Class I).\nFurnish and install a {fdc} with check valve, ball drip, and signage at the location approved by the Fire Department.",
            "keywords": "standpipe|fdc|storz|siames|hose valve|mangueira|conex[aã]o do bombeiro"
          },
          {
            "title": "Fire Pump",
            "text": "Furnish and install a {pumpType} with controller, test header, and jockey pump per NFPA 20; acceptance test with the pump manufacturer's representative.\nPower feed and transfer switch by the electrical contractor.",
            "keywords": "fire pump|bomba|jockey|booster"
          },
          {
            "title": "Alarms & Supervision Devices",
            "text": "Furnish and install **water-flow switches** and **valve tamper switches** on all control valves, and an exterior bell / horn-strobe.\nWiring to the fire alarm panel and central station monitoring by the fire alarm contractor.",
            "keywords": "flow switch|tamper|alarme|alarm|bell|sino|strobe|monitor"
          },
          {
            "title": "Testing & Acceptance",
            "text": "Hydrostatic test of new piping {hydro}; flush of underground piping before connection where applicable.\n{dryTest}\nRough (above-ceiling) inspection and final acceptance test with the Fire Department, including flow and tamper switch operation.",
            "keywords": "."
          },
          {
            "title": "Closeout",
            "text": "{spares}\nContractor's Material & Test Certificates, as-built drawings, and owner orientation on NFPA 25 inspection and maintenance.",
            "keywords": "."
          }
        ],
        "defaults": {
          "includes": "all labor, materials, and equipment listed above, design and hydraulic calculations, supervision, applicable {state} sales tax, and sprinkler permit fees, Fire Department plan review coordination, and acceptance testing.",
          "notIncluded": "Underground fire service from the street to 1 ft above the finished floor, excavation, and thrust blocks (unless listed) · Water department tap, meter, and connection fees · Fire alarm system, wiring of flow / tamper switches, and central station monitoring · Electrical power to fire pump, dry-system compressor, or heat trace · Heat in the building and freeze protection of wet piping in unheated areas · Cutting, patching, and painting of walls and ceilings; painting of sprinkler piping · Firestopping of penetrations through fire-rated assemblies (unless listed) · Fire protection engineer's stamp, if required by the Fire Department (unless listed) · Fire watch, impairment costs, or police details · Ongoing inspection, testing, and maintenance (NFPA 25) after acceptance.",
          "clarifications": "Sprinkler permit will be pulled by {brand}. **Permit fees are included.**\n[MA] All sprinkler work performed by Massachusetts licensed sprinkler fitters employed by a licensed Fire Protection Sprinkler Contractor (M.G.L. c.146).\n[!MA] All sprinkler work performed by licensed sprinkler fitters as required by the state and the Authority Having Jurisdiction.\nHead count and layout are based on the drawings provided and will be finalized on the approved shop drawings; added heads required by the Fire Department or by layout changes will be priced per head.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship & Materials Warranty:** One (1) year from the date of Fire Department acceptance. Manufacturer warranties on sprinkler heads, valves, and devices transferred to Owner.\n**Owner Responsibility:** Inspection, testing, and maintenance per NFPA 25 after acceptance; damage from freezing, painting of heads, or physical abuse is excluded.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Prédio novo de 6 unidades, NFPA 13R, sistema wet com CPVC, umas 90 cabeças concealed, dry pendent no sótão, riser de 4 com DCDA, flow e tamper ligados pelo fire alarm, FDC Storz. Underground por outros. Preço 78 mil, 30/40/30.”",
          "en": "e.g. “New 6-unit building, NFPA 13R, wet system in CPVC, about 90 concealed heads, dry pendents in the attic, 4-inch riser with DCDA, flow and tamper wired by fire alarm, Storz FDC. Underground by others. Price 78K, 30/40/30.”",
          "es": "ej.: “Edificio nuevo de 6 unidades, NFPA 13R, sistema húmedo en CPVC, unas 90 cabezas concealed, dry pendents en el ático, riser de 4 pulgadas con DCDA, flow y tamper conectados por la alarma contra incendios, FDC Storz. Subterráneo por otros. Precio 78 mil, 30/40/30.”"
        },
        "aiRules": "Trade: FIRE SPRINKLER / fire protection contractor (MA/NH). Speech terms: 'cabeça'/'bico' = sprinkler head, 'molhado' = wet pipe, 'seco' = dry pipe, 'riser' = system riser, 'bombeiro' = Fire Department, 'conexão do bombeiro' = FDC, 'teste de fluxo' = hydrant flow test.\nAlways name the governing standard (NFPA 13, 13R, or 13D) and the system type (wet, dry, pre-action, antifreeze); if not said, infer from the building (1–2 family = 13D, low-rise multifamily = 13R, commercial = 13) and flag it in notes_pt.\nQuantities: heads as a count, only when spoken ('approximately 90 heads'), area in sq ft, piping in linear ft, water supply as static / residual psi and gpm, design demand as gpm @ psi.\nState head types (concealed pendent, sidewall, upright, dry pendent, residential listed / quick response) and pipe material (CPVC BlazeMaster, Schedule 10/40 steel, listed PEX for 13D).\nAlways include design + hydraulic calculations, Fire Department plan review, hydrostatic test (200 psi for 2 hours for NFPA 13 / 13R; at normal system operating pressure for NFPA 13D), air test at 40 psi for 24 hours for dry-pipe / pre-action systems, and Fire Department acceptance test.\nMonitoring: the sprinkler contractor installs flow and tamper switches; wiring to the fire alarm panel and central station monitoring are by the fire alarm contractor unless the speaker says otherwise.\nUnderground fire service, water department fees, fire alarm wiring, electrical for pumps / compressors, building heat, ceiling patching, and painting are normally NOT included.\nIn MA say 'Massachusetts licensed sprinkler fitters' (licensed by the Bureau of Pipefitters, Refrigeration Technicians and Sprinkler Fitters); never say 'licensed plumbers' for NFPA 13 / 13R sprinkler work (13D multipurpose tied to the domestic water: installer licensing to be confirmed by the owner).\nAdd a per-head unit price line for added heads if the speaker gives one; otherwise mention in notes_pt that added heads should have a unit price.\nTypical sections: Design, Hydraulic Calculations & Approvals; Water Service, Riser & Backflow; Sprinkler Piping & Hangers; Sprinkler Heads; Standpipe & FDC; Fire Pump; Alarms & Supervision Devices; Testing & Acceptance; Closeout. Pitfalls: dry pendents / dry systems in unheated attics, garages, and balconies; antifreeze must be a listed solution; 13D multipurpose systems tie into domestic plumbing (coordinate with the plumber); never promise approval by the Fire Department.",
        "facts": {
          "standard": {
            "pick": [["13\\s?d\\b", "**NFPA 13D**"], ["13\\s?r\\b", "**NFPA 13R**"], ["nfpa\\s?13\\b", "**NFPA 13**"]],
            "fallback": "the applicable standard (**NFPA 13 / 13R / 13D**)"
          },
          "heads": {
            "count": "cabe[cç]as?|heads?|sprinklers?|bicos?",
            "gap": 2,
            "one": "one (1) sprinkler head",
            "many": "**{wn} sprinkler heads**",
            "fallback": "sprinkler heads as shown on the approved drawings"
          },
          "headType": {
            "pick": [["concealed", "concealed pendent"], ["recessed", "recessed pendent"], ["sidewall", "sidewall"], ["upright", "upright"]],
            "all": true,
            "join": " / ",
            "fallback": "listed residential / quick-response type as required"
          },
          "riser": {
            "re": "(\\d(?:[-\\s]?\\d/\\d)?)\\s*(?:\"|-?\\s?inch|polegadas?|pol\\.?)?\\s*riser|riser\\s+(?:de\\s+|of\\s+)?(\\d(?:[-\\s]?\\d/\\d)?)(?:\\s*(?:\"|-?\\s?inch|polegadas?))?",
            "fmt": "**{1}\" system riser**",
            "fallback": "system riser sized per the hydraulic calculations"
          },
          "backflow": {
            "pick": [
              ["dcda|double check detector", "**double check detector assembly (DCDA)**"], ["rpz|reduced pressure", "**reduced pressure zone assembly (RPZ)**"],
              ["dcva|double check", "**double check valve assembly (DCVA)**"]
            ],
            "fallback": "backflow prevention assembly required by the water department"
          },
          "pipe": {
            "pick": [
              ["\\bpex\\b", "listed **PEX** sprinkler piping (NFPA 13D multipurpose / stand-alone)"],
              ["cpvc|blazemaster", "listed **CPVC (BlazeMaster)** piping where permitted"],
              ["schedule\\s?40|sch\\.?\\s?40", "**Schedule 40 black steel** piping"],
              ["schedule\\s?10|sch\\.?\\s?10|\\ba[cç]o\\b|\\bsteel\\b", "**black steel** piping (Schedule 10 / 40 per the approved drawings)"],
              ["galvaniz", "**galvanized steel** piping (dry system)"]
            ],
            "all": true,
            "fallback": "listed sprinkler piping (steel and / or CPVC as shown on the approved drawings)"
          },
          "standpipeClass": {
            "pick": [["class(?:e)?\\s?(?:iii|3)\\b", "**Class III standpipe**"], ["class(?:e)?\\s?(?:i|1)\\b", "**Class I standpipe**"]],
            "fallback": "standpipe system (class per NFPA 14 and the approved drawings)"
          },
          "fdc": {
            "pick": [["storz", "**Storz-type fire department connection (FDC)**"], ["siam", "**siamese fire department connection (FDC)**"]],
            "fallback": "fire department connection (FDC) of the type required by the Fire Department"
          },
          "pumpType": {
            "pick": [["diesel", "listed **diesel fire pump**"], ["booster", "listed residential **booster pump**"], ["el[eé]tric", "listed **electric fire pump**"]],
            "fallback": "listed fire pump"
          },
          "hydro": {
            "pick": [
              ["13\\s?d\\b", "at the system's normal operating pressure per **NFPA 13D**"],
              ["13\\s?r\\b|nfpa\\s?13\\b", "at **200 psi for two (2) hours** per NFPA 13 / 13R"]
            ],
            "fallback": "per the applicable NFPA standard (200 psi for two (2) hours for NFPA 13 / 13R; normal operating pressure for NFPA 13D)"
          },
          "dryTest": {
            "pick": [
              [
                "\\bdry\\b|\\bseco\\b|pre-?action",
                "Air test of the dry-pipe / pre-action system at **40 psi for 24 hours** per NFPA 13 and trip test of the dry valve."
              ]
            ],
            "fallback": ""
          },
          "spares": { "pick": [["13\\s?d\\b", ""]], "fallback": "Spare sprinkler cabinet with spare heads and wrench, hydraulic placard, and valve signage." }
        },
        "adjustExample": {
          "pt": "Ex.: “Tira o fire pump, muda o preço para 72 mil e acrescenta 6 cabeças sidewall no corredor.”",
          "en": "e.g. “Remove the fire pump, change the price to 72K and add 6 sidewall heads in the corridor.”",
          "es": "ej.: “Quita la bomba contra incendios, cambia el precio a 72 mil y agrega 6 cabezas sidewall en el pasillo.”"
        }
      },
      prices: {
        "stores": [
          { "id": "fergusonfire", "name": "Ferguson Fire & Fabrication", "short": "Ferguson Fire", "search": "site:ferguson.com fire sprinkler" },
          { "id": "coremain", "name": "Core & Main (Fire Protection)", "short": "Core & Main", "search": "site:coreandmain.com" },
          { "id": "vikingsupplynet", "name": "Viking SupplyNet", "short": "Viking", "search": "site:vikingsupplynet.com" },
          { "id": "qrfs", "name": "QRFS (QuickResponse Fire Supply)", "short": "QRFS", "search": "site:qrfs.com" }
        ],
        "basic": [
          [
            { "pt": "Cabeça residencial pendente concealed", "en": "Residential concealed pendent head", "es": "Cabeza residencial pendent oculta" },
            { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Cabeça residencial sidewall", "en": "Residential sidewall head", "es": "Cabeza residencial sidewall" },
            { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            {
              "pt": "Cabeça pendente quick response (comercial)",
              "en": "Quick-response pendent head (commercial)",
              "es": "Cabeza pendent de respuesta rápida (comercial)"
            },
            { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" },
            { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [{ "pt": "Cabeça upright", "en": "Upright head", "es": "Cabeza upright" }, { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Dry pendent (comprimento sob medida)", "en": "Dry pendent head (custom length)", "es": "Cabeza dry pendent (largo a medida)" },
            { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          ["Cover plate / escutcheon", { "pt": "Cabeças", "en": "Heads", "es": "Cabezas" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          ["CPVC BlazeMaster 1\" — 15 ft", { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          ["CPVC BlazeMaster 1-1/2\" — 15 ft", { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          [
            { "pt": "Cola CPVC one-step (lata)", "en": "CPVC one-step cement (can)", "es": "Cemento CPVC de un paso (lata)" },
            { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Tubo aço Schedule 10 2\" — 21 ft", "en": "Schedule 10 steel pipe 2\" — 21 ft", "es": "Tubo de acero Schedule 10 de 2\" — 21 ft" },
            { "pt": "Tubulação", "en": "Piping", "es": "Tubería" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Acoplamento ranhurado (grooved) 2\"", "en": "Grooved coupling 2\"", "es": "Acople ranurado (grooved) de 2\"" },
            { "pt": "Conexões", "en": "Fittings", "es": "Conexiones (fittings)" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Hanger (ring / clevis) com tirante", "en": "Hanger (ring / clevis) with rod", "es": "Colgador (anillo / clevis) con varilla" },
            { "pt": "Suportes", "en": "Hangers", "es": "Colgadores" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Flow switch (vane)", "en": "Vane-type flow switch", "es": "Flow switch tipo paleta" },
            { "pt": "Alarmes", "en": "Alarm devices", "es": "Dispositivos de alarma" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          ["Tamper switch", { "pt": "Alarmes", "en": "Alarm devices", "es": "Dispositivos de alarma" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Válvula de controle 4\" (butterfly / OS&Y)", "en": "4\" control valve (butterfly / OS&Y)", "es": "Válvula de control de 4\" (mariposa / OS&Y)" },
            { "pt": "Válvulas", "en": "Valves", "es": "Válvulas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Backflow DCDA 4\"", "en": "4\" double check detector assembly", "es": "Ensamble de doble check con detector de 4\"" },
            { "pt": "Válvulas", "en": "Valves", "es": "Válvulas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Riser manifold 13D (1\")", "en": "13D riser manifold (1\")", "es": "Manifold de riser 13D (1\")" },
            { "pt": "Válvulas", "en": "Valves", "es": "Válvulas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [{ "pt": "FDC 4\" Storz", "en": "4\" Storz FDC", "es": "FDC Storz de 4\"" }, "Standpipe / FDC", { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Caixa de cabeças sobressalentes + chave", "en": "Spare head cabinet + wrench", "es": "Gabinete de cabezas de repuesto + llave" },
            { "pt": "Acabamento", "en": "Closeout", "es": "Cierre de obra" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ]
        ],
        "basicOffer": [{ "list": "sprinkler", "label": { "pt": "Adicionar lista básica de sprinkler", "en": "Add basic sprinkler list", "es": "Agregar lista básica de rociadores" } }],
        "promos": false,
        "searchExample": {
          "pt": "ex.: cabeça concealed, CPVC 1\", tamper",
          "en": "e.g. concealed head, 1\" CPVC, tamper switch",
          "es": "ej.: cabeza concealed, CPVC 1\", tamper switch"
        }
      }
    },
    {
      id: "drywall",
      aliases: [],
      order: 50,
      category: "finish",
      label: "Drywall",
      companySuffix: "Drywall",
      onboarding: {
        "label": "Drywall",
        "desc": {
          "pt": "Hang, tape, acabamento, forro, metal stud",
          "en": "Hang, tape, finish, ceilings, metal studs",
          "es": "Colgar, encintar, acabar, techos, perfiles metálicos"
        }
      },
      icon: {
        "svg": "<rect x=\"3.5\" y=\"3.5\" width=\"7.5\" height=\"17\" rx=\"1\"/><rect x=\"13\" y=\"3.5\" width=\"7.5\" height=\"17\" rx=\"1\"/><path d=\"M7.25 7v.01M7.25 12v.01M7.25 17v.01M16.75 7v.01M16.75 12v.01M16.75 17v.01\"/>"
      },
      kind: { "pt": "trabalho de drywall", "en": "drywall job", "es": "trabajo de drywall" },
      stepName: "Drywall",
      group: { "label": "Drywall", "icon": "trade-drywall" },
      workType: [
        "New Construction",
        { "pt": "Reforma / remodel", "en": "Remodel / renovation", "es": "Remodelación / renovación" },
        { "pt": "Porão (basement finish)", "en": "Basement finish", "es": "Acabado de sótano" },
        { "pt": "Addition (ampliação)", "en": "Addition", "es": "Ampliación (addition)" },
        { "pt": "Comercial (metal stud / ACT)", "en": "Commercial (metal stud / ACT)", "es": "Comercial (perfil metálico / ACT)" },
        {
          "pt": "Multifamily (separação rated entre unidades)",
          "en": "Multifamily (rated unit separations)",
          "es": "Multifamiliar (separaciones de unidades con clasificación)"
        },
        { "pt": "Reparo / remendo (patch)", "en": "Repair / patch", "es": "Reparación / parche" },
        { "pt": "Plaster (veneer / restauração)", "en": "Plaster (veneer / restoration)", "es": "Yeso (veneer / restauración)" }
      ],
      fields: {
        "dwScope": {
          "label": { "pt": "Serviço", "en": "Scope", "es": "Alcance" },
          "multi": true,
          "opts": [
            { "pt": "Hang (pendurar)", "en": "Hang", "es": "Colgar" }, "Tape & finish",
            { "pt": "Só acabamento (finish only)", "en": "Finish only", "es": "Solo acabado" }, "Skim coat",
            { "pt": "Metal framing (studs)", "en": "Metal framing (studs)", "es": "Estructura metálica (perfiles)" },
            { "pt": "Forro acústico (ACT)", "en": "Acoustical ceiling (ACT)", "es": "Cielo falso acústico (ACT)" },
            { "pt": "Reparo / remendo", "en": "Repair / patch", "es": "Reparación / parche" }, "Primer (PVA)",
            { "pt": "Textura", "en": "Texture", "es": "Textura" }
          ]
        },
        "board": {
          "label": { "pt": "Tipo de placa", "en": "Board type", "es": "Tipo de panel" },
          "multi": true,
          "opts": [
            "1/2\" regular", { "pt": "1/2\" leve (lightweight)", "en": "1/2\" lightweight", "es": "1/2\" liviano" },
            { "pt": "5/8\" Type X (fire-rated)", "en": "5/8\" Type X (fire-rated)", "es": "5/8\" Type X (resistente al fuego)" }, "5/8\" Type C",
            { "pt": "Resistente a umidade / mofo (roxo / XP)", "en": "Moisture / mold resistant (purple / XP)", "es": "Resistente a humedad / moho (morado / XP)" },
            { "pt": "Cement board / DensShield (área molhada)", "en": "Cement board / DensShield (wet area)", "es": "Cement board / DensShield (área húmeda)" },
            { "pt": "Abuse / impact resistant", "en": "Abuse / impact resistant", "es": "Resistente a golpes / impacto" },
            { "pt": "1/4\" ou 3/8\" (curvas / overlay)", "en": "1/4\" or 3/8\" (curves / overlay)", "es": "1/4\" o 3/8\" (curvas / sobrecapa)" },
            { "pt": "Acústica (QuietRock / soundboard)", "en": "Acoustic (QuietRock / soundboard)", "es": "Acústico (QuietRock / soundboard)" }
          ]
        },
        "finishLevel": {
          "label": { "pt": "Nível de acabamento (GA-214)", "en": "Finish level (GA-214)", "es": "Nivel de acabado (GA-214)" },
          "opts": [
            { "pt": "Level 0 (temporário)", "en": "Level 0 (temporary)", "es": "Nivel 0 (temporal)" },
            { "pt": "Level 1 (acima do forro / plenum)", "en": "Level 1 (above ceiling / plenum)", "es": "Nivel 1 (sobre el cielo falso / plenum)" },
            { "pt": "Level 2 (garagem / base de tile)", "en": "Level 2 (garage / tile substrate)", "es": "Nivel 2 (garaje / base para azulejo)" },
            { "pt": "Level 3 (textura pesada)", "en": "Level 3 (heavy texture)", "es": "Nivel 3 (textura gruesa)" },
            { "pt": "Level 4 (padrão residencial)", "en": "Level 4 (standard residential)", "es": "Nivel 4 (residencial estándar)" },
            {
              "pt": "Level 5 (skim total — luz rasante / brilho)",
              "en": "Level 5 (full skim — critical light / gloss)",
              "es": "Nivel 5 (skim completo — luz crítica / brillo)"
            }
          ]
        },
        "framing": {
          "label": { "pt": "Estrutura", "en": "Framing", "es": "Estructura" },
          "opts": [
            { "pt": "Madeira (wood studs)", "en": "Wood studs", "es": "Montantes de madera" }, "Metal stud 25 ga", "Metal stud 20 ga",
            { "pt": "Furring / resilient channel", "en": "Furring / resilient channel", "es": "Furring / canal resiliente" },
            { "pt": "Parede existente", "en": "Existing wall", "es": "Pared existente" }
          ]
        },
        "fireRating": {
          "label": { "pt": "Resistência ao fogo", "en": "Fire rating", "es": "Resistencia al fuego" },
          "opts": [
            { "pt": "Nenhuma", "en": "None", "es": "Ninguno" }, { "pt": "1 hora", "en": "1 hour", "es": "1 hora" },
            { "pt": "2 horas", "en": "2 hours", "es": "2 horas" }, { "pt": "Separação de garagem", "en": "Garage separation", "es": "Separación del garaje" },
            { "pt": "Separação entre unidades / corredor", "en": "Unit / corridor separation", "es": "Separación de unidades / pasillo" }, "Shaft wall"
          ]
        },
        "ceilingHeight": {
          "label": { "pt": "Altura do teto", "en": "Ceiling height", "es": "Altura del techo" },
          "opts": [
            { "pt": "Até 8 ft", "en": "Up to 8 ft", "es": "Hasta 8 ft" }, "9–10 ft",
            { "pt": "Teto alto / catedral (>10 ft)", "en": "High / cathedral (>10 ft)", "es": "Alto / catedral (>10 ft)" },
            { "pt": "Escadaria (stairwell)", "en": "Stairwell", "es": "Escalera (caja de escalera)" }
          ]
        },
        "ceilingType": {
          "label": { "pt": "Forro / teto", "en": "Ceiling", "es": "Techo" },
          "opts": [
            { "pt": "Drywall liso", "en": "Smooth drywall", "es": "Drywall liso" },
            { "pt": "Textura (knockdown / orange peel)", "en": "Texture (knockdown / orange peel)", "es": "Textura (knockdown / orange peel)" },
            { "pt": "Popcorn existente (remover)", "en": "Existing popcorn (remove)", "es": "Popcorn existente (quitar)" }, "Drop ceiling 2x2",
            "Drop ceiling 2x4", { "pt": "Plaster existente", "en": "Existing plaster", "es": "Yeso existente" }
          ]
        },
        "corners": {
          "label": { "pt": "Cantoneiras", "en": "Corner bead", "es": "Esquinero" },
          "multi": true,
          "opts": [
            { "pt": "Cantoneira metálica", "en": "Metal corner bead", "es": "Esquinero metálico" },
            { "pt": "Paper-faced (No-Coat / Strait-Flex)", "en": "Paper-faced (No-Coat / Strait-Flex)", "es": "Esquinero de papel (No-Coat / Strait-Flex)" },
            "Bullnose", { "pt": "L-bead / J-bead (reveal)", "en": "L-bead / J-bead (reveal)", "es": "L-bead / J-bead (reveal)" },
            { "pt": "Arco / curva", "en": "Arch / curve", "es": "Arco / curva" }
          ]
        },
        "compound": {
          "label": { "pt": "Massa (compound)", "en": "Joint compound", "es": "Compuesto para juntas" },
          "opts": [
            { "pt": "Massa pronta all-purpose", "en": "All-purpose ready-mix", "es": "Premezclado multiuso" },
            { "pt": "Setting compound (hot mud)", "en": "Setting compound (hot mud)", "es": "Compuesto de fraguado (hot mud)" },
            { "pt": "Massa leve (lightweight)", "en": "Lightweight", "es": "Liviano" },
            {
              "pt": "Mista (hot mud na fita + leve no acabamento)",
              "en": "Mixed (hot mud tape coat + lightweight topping)",
              "es": "Mixto (hot mud para encintar + liviano de acabado)"
            }
          ]
        },
        "insulation": {
          "label": { "pt": "Isolamento", "en": "Insulation", "es": "Aislamiento" },
          "system": true,
          "opts": [
            { "pt": "Por outros", "en": "By others", "es": "Por otros" },
            { "pt": "Sound batt (mineral wool) — nosso", "en": "Sound batt (mineral wool) — ours", "es": "Aislamiento acústico (lana mineral) — nuestro" },
            { "pt": "Fiberglass — nosso", "en": "Fiberglass — ours", "es": "Fibra de vidrio — nuestra" }, { "pt": "Não tem", "en": "None", "es": "Ninguno" }
          ]
        },
        "delivery": {
          "label": { "pt": "Entrega do material", "en": "Material delivery", "es": "Entrega del material" },
          "system": true,
          "opts": [
            { "pt": "Boom delivery (pela janela)", "en": "Boom delivery (through window)", "es": "Entrega con grúa (por la ventana)" },
            { "pt": "Entrega no chão", "en": "Ground drop", "es": "Descarga en el suelo" },
            { "pt": "Carregar por escada (stocking)", "en": "Hand-carry up stairs (stocking)", "es": "Subir a mano por la escalera (stocking)" }
          ]
        },
        "hazard": {
          "label": { "pt": "Casa antiga (chumbo / asbesto)", "en": "Older building (lead / asbestos)", "es": "Edificio antiguo (plomo / asbesto)" },
          "opts": [
            { "pt": "1978 ou depois", "en": "1978 or later", "es": "1978 o después" },
            { "pt": "Antes de 1978 (RRP)", "en": "Before 1978 (RRP)", "es": "Antes de 1978 (RRP)" },
            {
              "pt": "Popcorn / massa antiga — testar asbesto",
              "en": "Popcorn / old compound — test for asbestos",
              "es": "Popcorn / compuesto viejo — hacer prueba de asbesto"
            }
          ]
        }
      },
      text: [
        {
          "key": "sheets",
          "label": { "pt": "Folhas (quantidade estimada)", "en": "Sheets (estimated count)", "es": "Hojas (cantidad estimada)" },
          "unit": "sheet",
          "type": "number"
        },
        { "key": "boardArea", "label": { "pt": "Área de drywall (sq ft)", "en": "Drywall area (sq ft)", "es": "Área de drywall (sq ft)" }, "unit": "sqft", "type": "number" },
        {
          "key": "metalFraming",
          "label": { "pt": "Metal framing (linear ft)", "en": "Metal framing (linear ft)", "es": "Estructura metálica (pies lineales)" },
          "unit": "lf",
          "type": "number"
        },
        { "key": "ulDesign", "label": { "pt": "Assembly rated (ex.: UL U305)", "en": "Rated assembly (e.g. UL U305)", "es": "Ensamble clasificado (ej.: UL U305)" } }
      ],
      units: [
        { "id": "sheet", "label": { "pt": "folha", "en": "sheet", "es": "hoja" } }, { "id": "sqft", "label": "sq ft" },
        { "id": "lf", "label": { "pt": "pés lineares (lf)", "en": "linear ft", "es": "pie lineal" } },
        { "id": "box", "label": { "pt": "caixa", "en": "box", "es": "caja" } }, { "id": "pail", "label": { "pt": "balde", "en": "pail", "es": "cubeta" } },
        { "id": "bag", "label": { "pt": "saco", "en": "bag", "es": "bolsa" } }, { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }
      ],
      tasks: {
        "Preparação": [
          { "pt": "Medição e takeoff (folhas)", "en": "Measure & takeoff (sheets)", "es": "Medir y sacar cantidades (hojas)" },
          { "pt": "Proteção do local (pisos, janelas)", "en": "Site protection (floors, windows)", "es": "Protección del lugar (pisos, ventanas)" },
          { "pt": "Contenção lead-safe (RRP)", "en": "Lead-safe containment (RRP)", "es": "Contención segura contra plomo (RRP)" },
          { "pt": "Remover drywall / plaster existente", "en": "Remove existing drywall / plaster", "es": "Quitar drywall / yeso existente" },
          { "pt": "Entrega e distribuição do material (stocking)", "en": "Material delivery & stocking", "es": "Entrega y distribución del material" },
          { "pt": "Conferir blocking / backing", "en": "Verify blocking / backing", "es": "Verificar refuerzos (blocking / backing)" }
        ],
        "Framing leve e forro": [
          { "pt": "Metal studs e track", "en": "Metal studs & track", "es": "Perfiles y canales metálicos" }, "Furring / resilient channel",
          { "pt": "Isolamento acústico (sound batt)", "en": "Sound insulation (sound batts)", "es": "Aislamiento acústico (sound batts)" },
          { "pt": "Grid do forro acústico (ACT)", "en": "Acoustical ceiling grid (ACT)", "es": "Rejilla de cielo falso acústico (ACT)" },
          { "pt": "Placas do forro acústico", "en": "Acoustical ceiling tiles", "es": "Placas de cielo falso acústico" }
        ],
        "Hang": [
          { "pt": "Pendurar tetos", "en": "Hang ceilings", "es": "Colgar techos" },
          { "pt": "Pendurar paredes", "en": "Hang walls", "es": "Colgar paredes" },
          { "pt": "Drywall fire-rated (5/8\" Type X)", "en": "Fire-rated drywall (5/8\" Type X)", "es": "Drywall resistente al fuego (5/8\" Type X)" },
          {
            "pt": "Drywall resistente à umidade / cement board",
            "en": "Moisture-resistant drywall / cement board",
            "es": "Drywall resistente a humedad / cement board"
          },
          { "pt": "Cortes de caixas e aberturas", "en": "Cut out boxes & openings", "es": "Recortar cajas y aberturas" }
        ],
        "Tape & finish": [
          { "pt": "Fita (tape) e 1ª demão", "en": "Tape & 1st coat", "es": "Encintar y 1.ª mano" },
          { "pt": "Cantoneiras (corner bead)", "en": "Corner bead", "es": "Esquinero" }, { "pt": "2ª demão", "en": "2nd coat", "es": "2.ª mano" },
          { "pt": "3ª demão / acabamento", "en": "3rd coat / finish coat", "es": "3.ª mano / mano de acabado" }, "Skim coat (Level 5)",
          { "pt": "Lixamento", "en": "Sanding", "es": "Lijado" }, { "pt": "Textura", "en": "Texture", "es": "Textura" },
          { "pt": "Reparos / remendos", "en": "Repairs / patches", "es": "Reparaciones / parches" }
        ],
        "Acabamento": [
          "Primer (PVA)", { "pt": "Retoques após outros ofícios (pickup)", "en": "Pickup after other trades", "es": "Retoques después de otros oficios" },
          { "pt": "Limpeza e descarte", "en": "Cleanup & disposal", "es": "Limpieza y desecho" },
          { "pt": "Punch list com o cliente / GC", "en": "Punch list walkthrough with owner / GC", "es": "Recorrido de punch list con el dueño / GC" }
        ],
        "Inspeções": [
          { "pt": "Inspeção de framing / isolamento liberada", "en": "Framing / insulation inspection passed", "es": "Inspección de framing / aislamiento aprobada" },
          { "pt": "Teste de asbesto (popcorn / massa antiga)", "en": "Asbestos test (popcorn / old compound)", "es": "Prueba de asbesto (popcorn / compuesto viejo)" },
          {
            "pt": "Inspeção de fire-rated (parafusamento)",
            "en": "Fire-rated inspection (screw pattern)",
            "es": "Inspección de resistencia al fuego (patrón de tornillos)"
          },
          { "pt": "Inspeção com luz rasante (critical light)", "en": "Critical-light inspection", "es": "Inspección con luz crítica" },
          { "pt": "Inspeção final (building)", "en": "Final inspection (building)", "es": "Inspección final (construcción)" }
        ]
      },
      suggest: {
        "vars": {
          "hang": { "any": [{ "f": "dwScope", "has": "Hang (pendurar)" }, { "var": "newish" }] },
          "finish": { "any": [{ "f": "dwScope", "re": "Tape|acabamento" }, { "var": "newish" }] },
          "rated": { "any": [{ "f": "board", "re": "Type X|Type C" }, { "f": "fireRating", "ne": "Nenhuma" }, { "f": "workType", "re": "Multifamily" }] }
        },
        "rules": [
          {
            "add": [
              ["Preparação", "Medição e takeoff (folhas)"], ["Preparação", "Proteção do local (pisos, janelas)"], ["Acabamento", "Limpeza e descarte"],
              ["Acabamento", "Punch list com o cliente / GC"]
            ]
          },
          { "if": { "f": "hazard", "re": "Antes de 1978" }, "add": [["Preparação", "Contenção lead-safe (RRP)"]] },
          { "if": { "any": [{ "f": "hazard", "re": "asbesto" }, { "f": "ceilingType", "re": "Popcorn" }] }, "add": [["Inspeções", "Teste de asbesto (popcorn / massa antiga)"]] },
          {
            "if": { "any": [{ "f": "workType", "re": "Reforma|Plaster" }, { "f": "ceilingType", "re": "Popcorn" }] },
            "add": [["Preparação", "Remover drywall / plaster existente"]]
          },
          {
            "if": { "var": "hang" },
            "add": [
              ["Inspeções", "Inspeção de framing / isolamento liberada"], ["Preparação", "Entrega e distribuição do material (stocking)"],
              ["Preparação", "Conferir blocking / backing"], ["Hang", "Pendurar paredes"], ["Hang", "Cortes de caixas e aberturas"]
            ]
          },
          { "if": { "all": [{ "var": "hang" }, { "not": { "f": "ceilingType", "re": "Drop|Plaster" } }] }, "add": [["Hang", "Pendurar tetos"]] },
          { "if": { "f": "delivery", "re": "escada" }, "add": [["Preparação", "Entrega e distribuição do material (stocking)"]] },
          { "if": { "any": [{ "f": "framing", "re": "Metal" }, { "f": "dwScope", "has": "Metal framing (studs)" }] }, "add": [["Framing leve e forro", "Metal studs e track"]] },
          { "if": { "any": [{ "f": "framing", "re": "Furring" }, { "f": "board", "re": "Acústica" }] }, "add": [["Framing leve e forro", "Furring / resilient channel"]] },
          { "if": { "f": "insulation", "re": "nosso" }, "add": [["Framing leve e forro", "Isolamento acústico (sound batt)"]] },
          {
            "if": { "any": [{ "f": "dwScope", "has": "Forro acústico (ACT)" }, { "f": "ceilingType", "re": "Drop" }, { "f": "workType", "re": "ACT" }] },
            "add": [["Framing leve e forro", "Grid do forro acústico (ACT)"], ["Framing leve e forro", "Placas do forro acústico"]]
          },
          { "if": { "var": "rated" }, "add": [["Hang", "Drywall fire-rated (5/8\" Type X)"], ["Inspeções", "Inspeção de fire-rated (parafusamento)"]] },
          { "if": { "any": [{ "f": "board", "re": "umidade|Cement" }, { "f": "workType", "re": "Porão" }] }, "add": [["Hang", "Drywall resistente à umidade / cement board"]] },
          {
            "if": { "all": [{ "var": "finish" }, { "not": { "f": "finishLevel", "re": "Level 0" } }] },
            "add": [["Tape & finish", "Fita (tape) e 1ª demão"], ["Acabamento", "Retoques após outros ofícios (pickup)"]]
          },
          {
            "if": { "any": [{ "f": "finishLevel", "re": "Level [2345]" }, { "all": [{ "var": "finish" }, { "not": { "f": "finishLevel", "filled": true } }] }] },
            "add": [["Tape & finish", "Cantoneiras (corner bead)"], ["Tape & finish", "2ª demão"]]
          },
          {
            "if": { "any": [{ "f": "finishLevel", "re": "Level [345]" }, { "all": [{ "var": "finish" }, { "not": { "f": "finishLevel", "filled": true } }] }] },
            "add": [["Tape & finish", "3ª demão / acabamento"], ["Tape & finish", "Lixamento"]]
          },
          {
            "if": { "any": [{ "f": "finishLevel", "re": "Level 5" }, { "f": "dwScope", "has": "Skim coat" }] },
            "add": [["Tape & finish", "Skim coat (Level 5)"], ["Inspeções", "Inspeção com luz rasante (critical light)"]]
          },
          {
            "if": { "any": [{ "f": "dwScope", "has": "Textura" }, { "f": "ceilingType", "re": "Textura" }, { "f": "finishLevel", "re": "Level 3" }] },
            "add": [["Tape & finish", "Textura"]]
          },
          { "if": { "any": [{ "f": "dwScope", "has": "Reparo / remendo" }, { "f": "workType", "re": "Reparo|Plaster" }] }, "add": [["Tape & finish", "Reparos / remendos"]] },
          { "if": { "f": "dwScope", "has": "Primer (PVA)" }, "add": [["Acabamento", "Primer (PVA)"]] },
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Inspeções", "Inspeção final (building)"]] }
        ],
        "order": [
          "Teste de asbesto (popcorn / massa antiga)", "Medição e takeoff (folhas)", "Proteção do local (pisos, janelas)", "Contenção lead-safe (RRP)",
          "Remover drywall / plaster existente", "Conferir blocking / backing", "Metal studs e track", "Furring / resilient channel",
          "Isolamento acústico (sound batt)", "Inspeção de framing / isolamento liberada", "Entrega e distribuição do material (stocking)", "Pendurar tetos",
          "Pendurar paredes", "Drywall fire-rated (5/8\" Type X)", "Drywall resistente à umidade / cement board", "Cortes de caixas e aberturas",
          "Inspeção de fire-rated (parafusamento)", "Fita (tape) e 1ª demão", "Cantoneiras (corner bead)", "2ª demão", "3ª demão / acabamento",
          "Skim coat (Level 5)", "Lixamento", "Inspeção com luz rasante (critical light)", "Textura", "Reparos / remendos", "Primer (PVA)",
          "Grid do forro acústico (ACT)", "Placas do forro acústico", "Retoques após outros ofícios (pickup)", "Limpeza e descarte", "Inspeção final (building)",
          "Punch list com o cliente / GC"
        ]
      },
      inspections: [
        {
          "label": { "pt": "Inspeção de framing / isolamento liberada", "en": "Framing / insulation inspection passed", "es": "Inspección de framing / aislamiento aprobada" },
          "authority": {
            "pt": "Building inspector (780 CMR) + energy code (isolamento); rough de elétrica / plumbing / HVAC aprovados",
            "en": "Building inspector (780 CMR) + energy code (insulation); electrical / plumbing / HVAC rough approved",
            "es": "Inspector de construcción (780 CMR) + código de energía (aislamiento); rough de electricidad / plomería / HVAC aprobado"
          },
          "when": { "pt": "Antes de pendurar a primeira folha", "en": "Before hanging the first sheet", "es": "Antes de colgar la primera hoja" }
        },
        {
          "label": {
            "pt": "Inspeção de fire-rated (parafusamento)",
            "en": "Fire-rated inspection (screw pattern)",
            "es": "Inspección de resistencia al fuego (patrón de tornillos)"
          },
          "authority": {
            "pt": "Building inspector — assembly listada (UL / GA-600): camadas, tipo de placa e espaçamento de parafusos",
            "en": "Building inspector — listed assembly (UL / GA-600): layers, board type, and screw spacing",
            "es": "Inspector de construcción — ensamble listado (UL / GA-600): capas, tipo de panel y espaciado de tornillos"
          },
          "when": {
            "pt": "Paredes / tetos rated (garagem, entre unidades, corredor) antes de passar fita, quando a cidade exige",
            "en": "Rated walls / ceilings (garage, unit separation, corridor) before taping, where the town requires",
            "es": "Paredes / techos clasificados (garaje, separación de unidades, pasillo) antes de encintar, donde el municipio lo exija"
          }
        },
        {
          "label": { "pt": "Teste de asbesto (popcorn / massa antiga)", "en": "Asbestos test (popcorn / old compound)", "es": "Prueba de asbesto (popcorn / compuesto viejo)" },
          "authority": {
            "pt": "Inspetor de asbesto licenciado pelo DLS (MassDEP 310 CMR 7.15)",
            "en": "DLS-licensed asbestos inspector (MassDEP 310 CMR 7.15)",
            "es": "Inspector de asbesto con licencia DLS (MassDEP 310 CMR 7.15)"
          },
          "when": {
            "pt": "Antes de demolir popcorn, massa ou plaster antigos",
            "en": "Before demolishing old popcorn, joint compound, or plaster",
            "es": "Antes de demoler popcorn, compuesto de juntas o yeso viejos"
          }
        },
        {
          "label": "CSL + HIC (MA)",
          "authority": {
            "pt": "Board of Building Regulations and Standards (CSL) + OCABR (HIC)",
            "en": "Board of Building Regulations and Standards (CSL) + OCABR (HIC)",
            "es": "Board of Building Regulations and Standards (CSL) + OCABR (HIC)"
          },
          "when": {
            "pt": "Sheetrock / wallboard em casa de 1–4 famílias: CSL + HIC + building permit (normalmente do GC)",
            "en": "Sheetrock / wallboard on 1–4 family homes: CSL + HIC + building permit (usually the GC's)",
            "es": "Sheetrock / wallboard en casas de 1 a 4 familias: CSL + HIC + permiso de construcción (normalmente del GC)"
          }
        },
        {
          "label": { "pt": "Inspeção final (building)", "en": "Final inspection (building)", "es": "Inspección final (construcción)" },
          "authority": { "pt": "Building inspector", "en": "Building inspector", "es": "Inspector de construcción" },
          "when": { "pt": "Fim da obra (junto com o GC)", "en": "End of job (with the GC)", "es": "Final de la obra (con el GC)" }
        }
      ],
      proposal: {
        "title": "DRYWALL PROPOSAL",
        "tagline": "DRYWALL & INTERIOR SYSTEMS CONTRACTOR",
        "role": "Drywall Contractor",
        "scopeName": "Drywall",
        "invoiceWork": "drywall",
        "intro": {
          "text": "This proposal covers the drywall scope of work for {what} at {where}. Work will be performed in accordance with ASTM C840 and GA-216 (application and finishing of gypsum panel products), finish levels per GA-214, fire-resistance-rated assemblies per the listed UL / GA-600 designs, {code} and the requirements of the local Authority Having Jurisdiction.",
          "code": { "MA": "the Massachusetts State Building Code 780 CMR (10th edition),", "*": "the applicable state building code," }
        },
        "sections": [
          {
            "title": "Site Protection & Material Handling",
            "keywords": ".",
            "text": "Protect floors, windows, and finished surfaces in the work area.\nDelivery and stocking of all gypsum board to each floor (boom delivery where access allows)."
          },
          {
            "title": "Light-Gauge Metal Framing",
            "keywords": "metal stud|steel stud|stud de metal|metal framing|track|furring|channel|soffit",
            "text": "Furnish and install {gauge} steel studs and track{spacing} (gauge and spacing per the drawings and the manufacturer's limiting-height tables), including deflection head and blocking as shown.\nFurring / resilient channel where listed."
          },
          {
            "title": "Gypsum Board — Hanging",
            "keywords": "pendurar|hang|folha|sheet|board|drywall|sheetrock|gesso|5/8|1/2",
            "text": "Furnish and hang {board} on walls and ceilings, screw-attached per **ASTM C840 / GA-216** — ceilings first, sheets perpendicular to framing, end joints staggered.\n**5/8\" Type X** at garage separation and rated assemblies where required; **moisture / mold-resistant board** in bathrooms and laundry; **cement board** behind tile in wet areas (where listed).",
            "unless": "remendo|reparo|patch|repair|furo|buraco|\\bhole|conserto|consertar",
            "unlessExcept": "casa nova|new construction|pendurar|\\bhang|folhas|sheets|reforma completa|full remodel|gut|ampliação|addition|porão|basement"
          },
          {
            "title": "Fire-Rated Assemblies",
            "keywords": "fire|rated|type ?x|corta.?fogo|1 hora|2 horas|one.hour|separa[cç][aã]o|garagem|garage|shaft",
            "text": "Fire-resistance-rated walls and ceilings built per the **listed UL / GA-600 design** shown on the drawings (layers, board type, fastener spacing, and joint treatment).\nScrew inspection coordinated with the building inspector before taping; firestopping of penetrations by the trade making the penetration."
          },
          {
            "title": "Taping & Finishing",
            "keywords": "tape|fita|finish|acabamento|massa|mud|compound|level 4|n[ií]vel 4|lixa|sand",
            "text": "Tape all joints with paper tape embedded in setting-type compound; **metal or paper-faced corner bead** at all outside corners.\nFinish to {level} — sanded smooth and ready for primer."
          },
          {
            "title": "Level 5 Skim Coat",
            "keywords": "level 5|n[ií]vel 5|skim|luz rasante|critical light|gloss",
            "text": "Where listed (critical lighting, flat or gloss paints, high ceilings): skim coat of the entire surface over the Level 4 finish — **GA-214 Level 5**."
          },
          {
            "title": "Plaster & Drywall Repairs",
            "keywords": "plaster|reparo|repair|patch|remendo|furo|buraco|\\bhole|crack|trinca|conserto",
            "text": "Repair existing plaster and drywall where listed, using setting compound and fiberglass / paper tape; blend patches into the surrounding surface.\nTexture matching on existing surfaces is best effort."
          },
          {
            "title": "Acoustical Ceilings",
            "keywords": "drop ceiling|forro|acoustic|ac[uú]stic|\\bact\\b|grid|2x2|2x4",
            "text": "Furnish and install suspended **acoustical ceiling** grid and tile (2' x 2' or 2' x 4', product as listed or approved equal) per **ASTM C636**, with perimeter wall angle and hanger wires at **4' o.c.**\nCutting of tiles for light fixtures, diffusers, and sprinkler heads furnished by others."
          },
          {
            "title": "Cleanup & Touch-Up",
            "keywords": ".",
            "text": "Daily cleanup of drywall scraps and dust; debris to the on-site dumpster (dumpster by GC / Owner unless listed).\nOne (1) return visit for touch-ups after primer; repair of damage caused by other trades billed as extra work."
          }
        ],
        "defaults": {
          "includes": "all labor, gypsum board, framing and finishing materials listed above, delivery and stocking, supervision, daily cleanup, and applicable {state} sales tax.",
          "notIncluded": "Wood framing and blocking unless listed · insulation unless listed · primer and painting unless listed · firestopping of electrical, plumbing, and HVAC penetrations (by those trades) · testing or abatement of asbestos-containing joint compound, popcorn, or plaster · lead-safe containment for pre-1978 demolition unless listed · dumpster and debris hauling unless listed · repair of damage caused by other trades after our finish · moisture or mold remediation · engineering or selection of rated assemblies.",
          "clarifications": "Price is based on the sheet / square-foot count and finish level listed; added areas or layout changes will be priced per sheet.\nWork areas must be weather-tight and heated to at least 50°F (GA-216), with framing, MEP rough, and insulation inspections approved before hanging.\nFinish level per GA-214 as listed (Level 4 unless stated); Level 5 only where listed.\nMinor nail pops and hairline cracks caused by lumber shrinkage or settlement in the first heating season are not defects; one return visit is included.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** One (1) year on drywall workmanship from the date of completion, including one (1) return visit for nail pops and joint cracks. Not covered: cracks caused by structural movement, settlement, framing shrinkage, water damage, or humidity. Manufacturer warranties on materials pass through to the Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Casa nova de dois andares, mais ou menos 260 folhas: meia polegada nas paredes, 5/8 Type X na garagem e no teto, roxo nos banheiros. Fita e acabamento nível 4, primer incluído. Preço 31.500, 30/40/30.”",
          "en": "e.g. “New two-story house, about 260 sheets: half-inch on walls, 5/8 Type X in the garage and ceilings, purple board in the bathrooms. Tape and finish Level 4, primer included. Price 31,500, 30/40/30.”",
          "es": "ej.: “Casa nueva de dos pisos, unas 260 hojas: media pulgada en las paredes, 5/8 Type X en el garaje y los techos, panel morado en los baños. Encintado y acabado Nivel 4, primer incluido. Precio 31,500, 30/40/30.”"
        },
        "aiRules": "Trade: DRYWALL / interior systems contractor (hang, tape and finish, light-gauge metal framing, acoustical ceilings, plaster repair).\nStandards: ASTM C840, GA-216 (application), GA-214 (levels of finish), UL / GA-600 (rated assemblies), ASTM C636 (suspended ceilings), 780 CMR. In MA, wallboard work on 1–4 family homes is done under a CSL + HIC; the building permit is usually the GC's — only say \"permit fees included\" if spoken.\nTypical sections: \"Site Protection & Material Handling\", \"Light-Gauge Metal Framing\", \"Gypsum Board — Hanging\", \"Fire-Rated Assemblies\", \"Taping & Finishing\", \"Level 5 Skim Coat\", \"Plaster & Drywall Repairs\", \"Acoustical Ceilings\", \"Cleanup & Touch-Up\".\nAlways state board thickness and type per area (1/2\" regular or lightweight; 5/8\" Type X at garage separation and rated assemblies; moisture-resistant in baths; cement board behind tile) and the finish level (default GA-214 Level 4 unless spoken).\nQuantities: sheets (4x8 / 4x12 / 4x10) or sq ft of board, metal framing in linear feet, ACT in sq ft. If the speaker says \"X folhas\", write \"approx. X sheets\". Never list screws, tape, or compound quantities.\nRated assemblies: quote the UL design number only if spoken; never claim a fire rating without a listed design. Firestopping of MEP penetrations is by those trades.\nAlways exclude: wood framing / blocking unless listed, insulation unless listed, paint / primer unless listed, asbestos or lead abatement, damage by other trades after finish, dumpster unless listed.\nConditions: building closed in and heated (min 50°F), inspections approved before hanging; one return visit for nail pops.\nMA owner-occupied 1–4 family homes contracted directly with the Owner (HIC law, M.G.L. c.142A): deposit max one-third of the price unless for special-order materials.\nSpeech terms: \"folha\" = sheet, \"massa\" = joint compound, \"fita\" = tape, \"cantoneira\" = corner bead, \"hot mud / durabond\" = setting compound, \"gesso / sheetrock\" = gypsum board, \"roxo\" = purple moisture-resistant board, \"forro\" = ceiling / drop ceiling, \"corta-fogo\" = fire-rated, \"lixar\" = sand.",
        "facts": {
          "board": {
            "pick": [["1/2|meia polegada|half.?inch", "**1/2\" gypsum board**"], ["5/8|type ?x", "**5/8\" Type X gypsum board**"]],
            "all": true,
            "fallback": "**gypsum board** (thickness and type as listed)"
          },
          "gauge": { "pick": [["\\b20\\s?-?\\s?(?:ga|gauge)\\b", "**20-gauge**"], ["\\b25\\s?-?\\s?(?:ga|gauge)\\b", "**25-gauge**"]], "fallback": "" },
          "spacing": { "re": "(\\d{2})\\s*(?:\"|polegadas?|-?\\s?inch(?:es)?)?\\s*o\\.?\\s?c\\.?", "fmt": " at **{1}\" o.c.**", "fallback": "" },
          "level": { "re": "(?:n[ií]vel|level)\\s*([0-5])\\b", "fmt": "**GA-214 Level {1}**", "fallback": "the GA-214 finish level listed (**Level 4** unless stated)" }
        },
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to delivery of materials."],
            ["Board Hung", "Upon completion of hanging (and screw inspection where required)."],
            ["Final Payment", "Upon completion of finishing and final walkthrough."]
          ]
        },
        "hic": true,
        "clientRole": "",
        "jobVariants": [
          {
            "match": "remendo|reparo|patch|repair|furo|buraco|\\bhole|conserto",
            "unless": "casa nova|new construction|pendurar|\\bhang|folhas|sheets|reforma completa|gut",
            "defaults": {
              "clarifications": "Repair is limited to the area(s) described; texture and sheen matching on existing surfaces is best effort.\nAny work outside the scope above will be quoted as a written change order before it is performed."
            }
          }
        ],
        "adjustExample": {
          "pt": "Ex.: “Tira o primer, muda o preço para 29 mil e acrescenta o teto da garagem em 5/8 Type X.”",
          "en": "e.g. “Remove the primer, change the price to 29K and add the garage ceiling in 5/8 Type X.”",
          "es": "ej.: “Quita el primer, cambia el precio a 29 mil y agrega el techo del garaje en 5/8 Type X.”"
        }
      },
      prices: {
        "stores": [
          { "id": "lwsupply", "name": "L&W Supply", "short": "L&W", "search": "site:lwsupply.com" },
          { "id": "gms", "name": "GMS (Gypsum Management & Supply)", "short": "GMS", "search": "site:gms.com" }, "homedepot", "lowes", "lumberyard"
        ],
        "basic": [
          ["Drywall 1/2\" 4x8", "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          ["Drywall 1/2\" 4x12", "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [
            { "pt": "Drywall 1/2\" leve (lightweight) 4x8", "en": "Drywall 1/2\" lightweight 4x8", "es": "Drywall 1/2\" liviano 4x8" }, "Drywall",
            { "pt": "folha", "en": "sheet", "es": "hoja" }
          ],
          ["Drywall 5/8\" Type X 4x8", "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          ["Drywall 5/8\" Type X 4x12", "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [
            { "pt": "Drywall resistente a umidade 1/2\" 4x8", "en": "Moisture-resistant drywall 1/2\" 4x8", "es": "Drywall resistente a humedad 1/2\" 4x8" },
            "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }
          ],
          ["Cement board 1/2\" 3x5", "Drywall", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [
            { "pt": "Massa all-purpose 4,5 gal", "en": "All-purpose joint compound 4.5 gal", "es": "Compuesto para juntas multiuso 4.5 gal" },
            { "pt": "Massa", "en": "Compound", "es": "Compuesto" }, { "pt": "balde", "en": "pail", "es": "cubeta" }
          ],
          [
            { "pt": "Massa leve (lightweight) — caixa", "en": "Lightweight joint compound — carton", "es": "Compuesto para juntas liviano — caja" },
            { "pt": "Massa", "en": "Compound", "es": "Compuesto" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Setting compound 45/90 min (saco)", "en": "Setting compound 45/90 min (bag)", "es": "Compuesto de fraguado 45/90 min (bolsa)" },
            { "pt": "Massa", "en": "Compound", "es": "Compuesto" }, { "pt": "saco", "en": "bag", "es": "bolsa" }
          ],
          [
            { "pt": "Fita de papel 500 ft", "en": "Paper joint tape 500 ft", "es": "Cinta de papel para juntas 500 ft" },
            { "pt": "Fita e cantoneira", "en": "Tape & bead", "es": "Cinta y esquineros" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Cantoneira metálica 8 ft", "en": "Metal corner bead 8 ft", "es": "Esquinero metálico 8 ft" },
            { "pt": "Fita e cantoneira", "en": "Tape & bead", "es": "Cinta y esquineros" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Cantoneira paper-faced 10 ft", "en": "Paper-faced corner bead 10 ft", "es": "Esquinero de papel 10 ft" },
            { "pt": "Fita e cantoneira", "en": "Tape & bead", "es": "Cinta y esquineros" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Parafuso drywall 1-1/4\" (caixa)", "en": "Drywall screws 1-1/4\" (box)", "es": "Tornillos para drywall 1-1/4\" (caja)" },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Parafuso drywall 1-5/8\" (caixa)", "en": "Drywall screws 1-5/8\" (box)", "es": "Tornillos para drywall 1-5/8\" (caja)" },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          ["Metal stud 3-5/8\" 25 ga — 10 ft", { "pt": "Framing", "en": "Framing", "es": "Estructura metálica" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          ["Track 3-5/8\" 25 ga — 10 ft", { "pt": "Framing", "en": "Framing", "es": "Estructura metálica" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          ["Resilient channel — 12 ft", { "pt": "Framing", "en": "Framing", "es": "Estructura metálica" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          [
            { "pt": "Grid ACT main tee 12 ft", "en": "ACT grid main tee 12 ft", "es": "Main tee de rejilla ACT 12 ft" },
            { "pt": "Forro acústico", "en": "Acoustical ceiling", "es": "Cielo falso acústico" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Placa de forro acústico 2x2 (caixa)", "en": "Acoustical ceiling tile 2x2 (carton)", "es": "Placa de cielo falso acústico 2x2 (caja)" },
            { "pt": "Forro acústico", "en": "Acoustical ceiling", "es": "Cielo falso acústico" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ]
        ],
        "basicOffer": [{ "list": "drywall", "label": { "pt": "Adicionar lista básica de drywall", "en": "Add basic drywall list", "es": "Agregar lista básica de drywall" } }],
        "promos": false,
        "searchExample": { "pt": "ex.: 1/2\" regular, Type X, massa leve", "en": "e.g. 1/2\" regular, Type X, lightweight mud", "es": "ej.: 1/2\" regular, Type X, compuesto liviano" }
      },
      groupsI18n: {
        "en": {
          "Preparação": "Prep",
          "Framing leve e forro": "Light framing & ceilings",
          "Hang": "Hang",
          "Tape & finish": "Tape & finish",
          "Acabamento": "Finish",
          "Inspeções": "Inspections"
        },
        "es": {
          "Preparação": "Preparación",
          "Framing leve e forro": "Estructura liviana y techos",
          "Hang": "Colgar (hang)",
          "Tape & finish": "Encintado y acabado",
          "Acabamento": "Acabado",
          "Inspeções": "Inspecciones"
        }
      }
    },
    {
      id: "painting",
      aliases: [],
      order: 60,
      category: "finish",
      label: { "pt": "Pintura", "en": "Painting", "es": "Pintura" },
      companySuffix: "Painting",
      onboarding: {
        "label": { "pt": "Pintura", "en": "Painting", "es": "Pintura" },
        "desc": { "pt": "Interior, exterior, armários, stain", "en": "Interior, exterior, cabinets, stain", "es": "Interior, exterior, gabinetes, tinte" }
      },
      icon: {
        "svg": "<rect x=\"4\" y=\"3.5\" width=\"13\" height=\"5\" rx=\"1.5\"/><path d=\"M17 6h2.5v5H12v3.5\"/><rect x=\"10.5\" y=\"14.5\" width=\"3\" height=\"6\" rx=\"1\"/>"
      },
      kind: { "pt": "trabalho de pintura", "en": "painting job", "es": "trabajo de pintura" },
      stepName: { "pt": "Pintura", "en": "Painting", "es": "Pintura" },
      group: { "label": { "pt": "Pintura", "en": "Painting", "es": "Pintura" }, "icon": "trade-painting" },
      workType: [
        { "pt": "Interior residencial", "en": "Residential interior", "es": "Interior residencial" },
        { "pt": "Exterior residencial", "en": "Residential exterior", "es": "Exterior residencial" }, "Interior + exterior",
        { "pt": "Comercial / multifamily", "en": "Commercial / multifamily", "es": "Comercial / multifamiliar" }, "New Construction",
        { "pt": "Repintura de unidade (turnover)", "en": "Unit turnover repaint", "es": "Repintado de unidad (turnover)" },
        { "pt": "Armários (cabinet refinishing)", "en": "Cabinet refinishing", "es": "Renovación de gabinetes" },
        { "pt": "Deck / cerca (stain)", "en": "Deck / fence (stain)", "es": "Deck / cerca (tinte)" }
      ],
      fields: {
        "paintScope": {
          "label": { "pt": "O que pintar", "en": "Surfaces to paint", "es": "Superficies a pintar" },
          "multi": true,
          "opts": [
            { "pt": "Paredes", "en": "Walls", "es": "Paredes" }, { "pt": "Tetos", "en": "Ceilings", "es": "Techos" },
            { "pt": "Trim / rodapés", "en": "Trim & baseboards", "es": "Molduras y zócalos" }, { "pt": "Portas", "en": "Doors", "es": "Puertas" },
            { "pt": "Janelas", "en": "Windows", "es": "Ventanas" }, { "pt": "Armários", "en": "Cabinets", "es": "Gabinetes" },
            { "pt": "Escadas e corrimão", "en": "Stairs & railings", "es": "Escaleras y barandas" }, "Siding / clapboard", "Soffit / fascia",
            { "pt": "Deck / cerca", "en": "Deck / fence", "es": "Deck / cerca" },
            { "pt": "Piso de concreto (epóxi)", "en": "Concrete floor (epoxy)", "es": "Piso de concreto (epoxi)" }
          ]
        },
        "substrate": {
          "label": { "pt": "Superfície (substrato)", "en": "Substrate", "es": "Superficie base" },
          "multi": true,
          "opts": [
            { "pt": "Drywall novo", "en": "New drywall", "es": "Drywall nuevo" },
            { "pt": "Drywall já pintado", "en": "Previously painted drywall", "es": "Drywall ya pintado" }, "Plaster",
            { "pt": "Madeira", "en": "Wood", "es": "Madera" }, { "pt": "Vinil / alumínio", "en": "Vinyl / aluminum", "es": "Vinilo / aluminio" }, "Fiber cement",
            { "pt": "Alvenaria / estuque", "en": "Masonry / stucco", "es": "Mampostería / estuco" }, "Metal",
            { "pt": "Concreto", "en": "Concrete", "es": "Concreto" }
          ]
        },
        "leadAge": {
          "label": { "pt": "Ano da casa (chumbo)", "en": "Year built (lead)", "es": "Año de construcción (plomo)" },
          "opts": [
            { "pt": "Antes de 1978 (RRP lead-safe)", "en": "Before 1978 (RRP lead-safe)", "es": "Antes de 1978 (RRP, seguro contra plomo)" },
            { "pt": "1978 ou depois", "en": "1978 or later", "es": "1978 o después" },
            { "pt": "Não sei (testar)", "en": "Unknown (test)", "es": "Desconocido (hacer prueba)" }
          ]
        },
        "condition": {
          "label": { "pt": "Condição das superfícies", "en": "Surface condition", "es": "Estado de la superficie" },
          "opts": [
            { "pt": "Boa (só repintar)", "en": "Good (repaint only)", "es": "Bueno (solo repintar)" },
            { "pt": "Pequenos reparos (furos)", "en": "Minor repairs (nail holes)", "es": "Reparaciones menores (huecos de clavos)" },
            { "pt": "Reparos médios (trincas, massa)", "en": "Moderate repairs (cracks, patching)", "es": "Reparaciones moderadas (grietas, parches)" },
            { "pt": "Descascando / muito dano", "en": "Peeling / heavy damage", "es": "Pintura descascarada / daño grave" }
          ]
        },
        "prep": {
          "label": { "pt": "Preparação", "en": "Surface prep", "es": "Preparación de la superficie" },
          "multi": true,
          "opts": [
            { "pt": "Lavar (power wash)", "en": "Power wash", "es": "Lavado a presión" },
            { "pt": "Raspar e lixar", "en": "Scrape & sand", "es": "Raspar y lijar" },
            { "pt": "Massa (spackle)", "en": "Spackle & patch", "es": "Masillar y parchar" }, "Skim coat",
            { "pt": "Calafetar (caulk)", "en": "Caulking", "es": "Calafateo" }, { "pt": "Primer spot", "en": "Spot prime", "es": "Primer en puntos" },
            { "pt": "Primer total", "en": "Full prime", "es": "Primer completo" },
            { "pt": "Trocar madeira podre", "en": "Replace rotted wood", "es": "Cambiar madera podrida" },
            { "pt": "Remover papel de parede", "en": "Wallpaper removal", "es": "Quitar papel tapiz" },
            { "pt": "Tratar mofo", "en": "Mildew treatment", "es": "Tratamiento contra moho" }
          ]
        },
        "coats": {
          "label": { "pt": "Demãos", "en": "Coats", "es": "Manos" },
          "opts": [
            { "pt": "1 demão (refresh)", "en": "1 coat (refresh)", "es": "1 mano (refrescar)" }, { "pt": "2 demãos", "en": "2 coats", "es": "2 manos" },
            { "pt": "Primer + 2 demãos", "en": "Primer + 2 coats", "es": "Primer + 2 manos" },
            { "pt": "3+ demãos (troca forte de cor)", "en": "3+ coats (major color change)", "es": "3+ manos (gran cambio de color)" }
          ]
        },
        "sheen": { "label": { "pt": "Brilho (sheen)", "en": "Sheen", "es": "Acabado (brillo)" }, "multi": true, "opts": ["Flat / matte", "Eggshell", "Satin", "Semi-gloss", "Gloss"] },
        "paintBrand": {
          "label": { "pt": "Marca da tinta", "en": "Paint brand", "es": "Marca de pintura" },
          "opts": [
            "Sherwin-Williams", "Benjamin Moore", "Behr", "PPG", "Valspar",
            { "pt": "Fornecida pelo cliente", "en": "Supplied by owner", "es": "La pone el dueño" }, { "pt": "Outra", "en": "Other", "es": "Otra" }
          ]
        },
        "productLine": {
          "label": { "pt": "Linha da tinta", "en": "Product line", "es": "Línea de producto" },
          "opts": [
            { "pt": "Contractor (ProMar / Ultra Spec)", "en": "Contractor grade (ProMar / Ultra Spec)", "es": "Grado contratista (ProMar / Ultra Spec)" },
            { "pt": "Intermediária (SuperPaint / ben)", "en": "Mid-grade (SuperPaint / ben)", "es": "Grado medio (SuperPaint / ben)" },
            "Premium (Duration / Emerald / Aura / Regal)",
            {
              "pt": "Esmalte para armário (urethane / alkyd híbrido)",
              "en": "Cabinet enamel (urethane / hybrid alkyd)",
              "es": "Esmalte para gabinetes (uretano / alquídico híbrido)"
            },
            { "pt": "Stain (sólido / semi-transparente)", "en": "Stain (solid / semi-transparent)", "es": "Tinte (sólido / semitransparente)" }
          ]
        },
        "colorChange": {
          "label": { "pt": "Troca de cor", "en": "Color change", "es": "Cambio de color" },
          "opts": [
            { "pt": "Mesma cor", "en": "Same color", "es": "Mismo color" }, { "pt": "Cor parecida", "en": "Similar color", "es": "Color parecido" },
            { "pt": "Troca forte (claro ↔ escuro)", "en": "Major change (light ↔ dark)", "es": "Cambio grande (claro ↔ oscuro)" },
            { "pt": "Várias cores por cômodo", "en": "Multiple colors by room", "es": "Varios colores por cuarto" }
          ]
        },
        "height": {
          "label": { "pt": "Altura / acesso", "en": "Height / access", "es": "Altura / acceso" },
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Até 10 ft (escada comum)", "en": "Up to 10 ft (step ladder)", "es": "Hasta 10 ft (escalera de tijera)" },
            { "pt": "Teto alto / escadaria", "en": "High ceiling / stairwell", "es": "Techo alto / caja de escalera" },
            { "pt": "Escada extensível (2 andares)", "en": "Extension ladder (2 stories)", "es": "Escalera de extensión (2 pisos)" },
            { "pt": "Andaime / staging", "en": "Staging / scaffold", "es": "Andamio" },
            { "pt": "Lift (boom / tesoura)", "en": "Lift (boom / scissor)", "es": "Elevador (boom / tijera)" }
          ]
        },
        "method": {
          "label": { "pt": "Aplicação", "en": "Application", "es": "Aplicación" },
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Rolo e pincel", "en": "Brush & roll", "es": "Brocha y rodillo" }, "Spray airless", "Spray + back-roll",
            { "pt": "HVLP (armários)", "en": "HVLP (cabinets)", "es": "HVLP (gabinetes)" }
          ]
        }
      },
      text: [
        { "key": "paintArea", "label": { "pt": "Área de pintura (sq ft)", "en": "Paint area (sq ft)", "es": "Área de pintura (sq ft)" }, "unit": "sqft", "type": "number" },
        { "key": "rooms", "label": { "pt": "Cômodos / ambientes", "en": "Rooms / areas", "es": "Cuartos / áreas" } },
        { "key": "colors", "label": { "pt": "Cores (nome / código)", "en": "Colors (name / code)", "es": "Colores (nombre / código)" } },
        {
          "key": "gallons",
          "label": { "pt": "Tinta estimada (galões)", "en": "Estimated paint (gallons)", "es": "Pintura estimada (galones)" },
          "unit": "gal",
          "type": "number"
        }
      ],
      units: [
        { "id": "sqft", "label": "sq ft" }, { "id": "lf", "label": { "pt": "pés lineares (lf)", "en": "linear ft", "es": "pie lineal" } },
        { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }, { "id": "gal", "label": { "pt": "galões", "en": "gal", "es": "gal" } },
        { "id": "qt", "label": { "pt": "quart", "en": "qt", "es": "qt" } },
        { "id": "pail", "label": { "pt": "balde 5 gal", "en": "5-gal pail", "es": "cubeta de 5 gal" } },
        { "id": "room", "label": { "pt": "cômodo", "en": "room", "es": "cuarto" } }
      ],
      tasks: {
        "Preparação e proteção": [
          { "pt": "Mover / cobrir móveis", "en": "Move / cover furniture", "es": "Mover / cubrir los muebles" },
          { "pt": "Proteger pisos (drop cloth / Ram Board)", "en": "Protect floors (drop cloths / Ram Board)", "es": "Proteger los pisos (lonas / Ram Board)" },
          { "pt": "Mascarar janelas, trim e ferragens", "en": "Mask windows, trim & hardware", "es": "Enmascarar ventanas, molduras y herrajes" },
          { "pt": "Remover espelhos de tomada e ferragens", "en": "Remove cover plates & hardware", "es": "Quitar tapas y herrajes" },
          { "pt": "Contenção lead-safe (RRP)", "en": "Lead-safe containment (RRP)", "es": "Contención segura contra plomo (RRP)" },
          { "pt": "Lavar superfícies (power wash / TSP)", "en": "Wash surfaces (power wash / TSP)", "es": "Lavar las superficies (lavado a presión / TSP)" }
        ],
        "Reparos de superfície": [
          { "pt": "Raspar tinta solta", "en": "Scrape loose paint", "es": "Raspar la pintura suelta" },
          { "pt": "Lixar e desbastar", "en": "Sand & feather edges", "es": "Lijar y emparejar bordes" },
          { "pt": "Massa em furos e trincas", "en": "Patch holes & cracks", "es": "Parchar huecos y grietas" }, "Skim coat",
          { "pt": "Remover papel de parede", "en": "Wallpaper removal", "es": "Quitar papel tapiz" },
          { "pt": "Trocar madeira podre", "en": "Replace rotted wood", "es": "Cambiar madera podrida" },
          { "pt": "Calafetar juntas (caulk)", "en": "Caulk joints", "es": "Calafatear juntas" },
          { "pt": "Primer (spot / total)", "en": "Prime (spot / full)", "es": "Primer (en puntos / completo)" }
        ],
        "Pintura interior": [
          { "pt": "Tetos", "en": "Ceilings", "es": "Techos" }, { "pt": "Paredes — 1ª demão", "en": "Walls — 1st coat", "es": "Paredes — 1.ª mano" },
          { "pt": "Paredes — 2ª demão", "en": "Walls — 2nd coat", "es": "Paredes — 2.ª mano" },
          { "pt": "Trim e rodapés", "en": "Trim & baseboards", "es": "Molduras y zócalos" },
          { "pt": "Portas e batentes", "en": "Doors & jambs", "es": "Puertas y marcos" }, { "pt": "Armários (cabinets)", "en": "Cabinets", "es": "Gabinetes" }
        ],
        "Pintura exterior": [
          "Siding / clapboard", { "pt": "Trim, soffit e fascia", "en": "Trim, soffit & fascia", "es": "Molduras, soffit y fascia" },
          { "pt": "Janelas e portas externas", "en": "Exterior windows and doors", "es": "Ventanas y puertas exteriores" },
          { "pt": "Deck / cerca (stain)", "en": "Deck / fence (stain)", "es": "Deck / cerca (tinte)" }
        ],
        "Acabamento": [
          { "pt": "Recolocar espelhos e ferragens", "en": "Reinstall cover plates & hardware", "es": "Volver a poner tapas y herrajes" },
          { "pt": "Retoques (touch-up)", "en": "Touch-ups", "es": "Retoques" },
          { "pt": "Limpeza diária e final", "en": "Daily & final cleanup", "es": "Limpieza diaria y final" },
          { "pt": "Entregar sobra de tinta etiquetada", "en": "Leave labeled leftover paint", "es": "Dejar la pintura sobrante etiquetada" },
          { "pt": "Punch list com o cliente", "en": "Punch list walkthrough with owner", "es": "Recorrido de punch list con el dueño" }
        ],
        "Inspeções": [
          { "pt": "Registro de condições antes de começar (fotos)", "en": "Pre-job condition photos", "es": "Fotos del estado antes de la obra" },
          { "pt": "Teste de chumbo (casa pré-1978)", "en": "Lead test (pre-1978 home)", "es": "Prueba de plomo (casa de antes de 1978)" },
          { "pt": "Verificação de limpeza RRP (cleaning verification)", "en": "RRP cleaning verification", "es": "Verificación de limpieza RRP" }
        ]
      },
      suggest: {
        "vars": {
          "interior": {
            "any": [{ "f": "workType", "re": "Interior|Comercial|New Construction|turnover|Armários" }, { "f": "paintScope", "re": "Paredes|Tetos|Trim|Portas|Armários|Escadas" }]
          },
          "exterior": { "any": [{ "f": "workType", "re": "Exterior|exterior|Deck" }, { "f": "paintScope", "re": "Siding|Soffit|Deck" }] },
          "pre78": { "f": "leadAge", "re": "Antes de 1978" }
        },
        "rules": [
          {
            "add": [
              ["Inspeções", "Registro de condições antes de começar (fotos)"], ["Preparação e proteção", "Proteger pisos (drop cloth / Ram Board)"],
              ["Acabamento", "Retoques (touch-up)"], ["Acabamento", "Limpeza diária e final"], ["Acabamento", "Entregar sobra de tinta etiquetada"],
              ["Acabamento", "Punch list com o cliente"]
            ]
          },
          { "if": { "f": "leadAge", "re": "Antes de 1978|Não sei" }, "add": [["Inspeções", "Teste de chumbo (casa pré-1978)"]] },
          {
            "if": { "var": "pre78" },
            "add": [["Preparação e proteção", "Contenção lead-safe (RRP)"], ["Inspeções", "Verificação de limpeza RRP (cleaning verification)"]]
          },
          { "if": { "f": "occupied", "re": "Ocupado|funcionamento" }, "add": [["Preparação e proteção", "Mover / cobrir móveis"]] },
          {
            "if": { "var": "interior" },
            "add": [
              ["Preparação e proteção", "Mascarar janelas, trim e ferragens"], ["Preparação e proteção", "Remover espelhos de tomada e ferragens"],
              ["Acabamento", "Recolocar espelhos e ferragens"]
            ]
          },
          { "if": { "f": "paintScope", "has": "Tetos" }, "add": [["Pintura interior", "Tetos"]] },
          { "if": { "f": "paintScope", "has": "Paredes" }, "add": [["Pintura interior", "Paredes — 1ª demão"]] },
          { "if": { "all": [{ "f": "paintScope", "has": "Paredes" }, { "not": { "f": "coats", "re": "^1 demão" } }] }, "add": [["Pintura interior", "Paredes — 2ª demão"]] },
          {
            "if": { "any": [{ "f": "paintScope", "has": "Trim / rodapés" }, { "all": [{ "var": "interior" }, { "f": "paintScope", "has": "Janelas" }] }] },
            "add": [["Pintura interior", "Trim e rodapés"]]
          },
          { "if": { "all": [{ "var": "interior" }, { "f": "paintScope", "has": "Portas" }] }, "add": [["Pintura interior", "Portas e batentes"]] },
          {
            "if": { "any": [{ "f": "paintScope", "has": "Armários" }, { "f": "workType", "re": "Armários" }] },
            "add": [
              ["Preparação e proteção", "Remover espelhos de tomada e ferragens"], ["Pintura interior", "Armários (cabinets)"],
              ["Acabamento", "Recolocar espelhos e ferragens"]
            ]
          },
          {
            "if": { "var": "exterior" },
            "add": [["Preparação e proteção", "Lavar superfícies (power wash / TSP)"], ["Reparos de superfície", "Calafetar juntas (caulk)"]]
          },
          {
            "if": { "any": [{ "f": "paintScope", "has": "Siding / clapboard" }, { "all": [{ "f": "workType", "re": "Exterior|exterior" }, { "not": { "f": "paintScope", "filled": true } }] }] },
            "add": [["Pintura exterior", "Siding / clapboard"]]
          },
          {
            "if": { "any": [{ "f": "paintScope", "has": "Soffit / fascia" }, { "all": [{ "var": "exterior" }, { "f": "paintScope", "has": "Trim / rodapés" }] }] },
            "add": [["Pintura exterior", "Trim, soffit e fascia"]]
          },
          {
            "if": { "all": [{ "var": "exterior" }, { "any": [{ "f": "paintScope", "has": "Janelas" }, { "f": "paintScope", "has": "Portas" }] }] },
            "add": [["Pintura exterior", "Janelas e portas externas"]]
          },
          {
            "if": { "any": [{ "f": "paintScope", "has": "Deck / cerca" }, { "f": "workType", "re": "Deck" }] },
            "add": [["Preparação e proteção", "Lavar superfícies (power wash / TSP)"], ["Pintura exterior", "Deck / cerca (stain)"]]
          },
          {
            "if": { "any": [{ "f": "condition", "re": "Descascando" }, { "f": "prep", "has": "Raspar e lixar" }] },
            "add": [["Reparos de superfície", "Raspar tinta solta"], ["Reparos de superfície", "Lixar e desbastar"], ["Reparos de superfície", "Primer (spot / total)"]]
          },
          {
            "if": { "any": [{ "f": "condition", "re": "reparos|Reparos" }, { "f": "prep", "has": "Massa (spackle)" }] },
            "add": [["Reparos de superfície", "Massa em furos e trincas"]]
          },
          {
            "if": { "any": [{ "f": "prep", "has": "Lavar (power wash)" }, { "f": "prep", "has": "Tratar mofo" }] },
            "add": [["Preparação e proteção", "Lavar superfícies (power wash / TSP)"]]
          },
          { "if": { "f": "prep", "has": "Skim coat" }, "add": [["Reparos de superfície", "Skim coat"]] },
          { "if": { "f": "prep", "has": "Remover papel de parede" }, "add": [["Reparos de superfície", "Remover papel de parede"]] },
          { "if": { "f": "prep", "has": "Trocar madeira podre" }, "add": [["Reparos de superfície", "Trocar madeira podre"]] },
          { "if": { "f": "prep", "has": "Calafetar (caulk)" }, "add": [["Reparos de superfície", "Calafetar juntas (caulk)"]] },
          {
            "if": { "any": [{ "f": "prep", "re": "Primer" }, { "f": "coats", "re": "Primer" }, { "f": "colorChange", "re": "Troca forte" }, { "f": "substrate", "has": "Drywall novo" }] },
            "add": [["Reparos de superfície", "Primer (spot / total)"]]
          }
        ],
        "order": [
          "Registro de condições antes de começar (fotos)", "Teste de chumbo (casa pré-1978)", "Mover / cobrir móveis",
          "Proteger pisos (drop cloth / Ram Board)", "Contenção lead-safe (RRP)", "Remover espelhos de tomada e ferragens", "Mascarar janelas, trim e ferragens",
          "Lavar superfícies (power wash / TSP)", "Remover papel de parede", "Raspar tinta solta", "Lixar e desbastar", "Trocar madeira podre",
          "Massa em furos e trincas", "Skim coat", "Primer (spot / total)", "Calafetar juntas (caulk)", "Tetos", "Paredes — 1ª demão", "Paredes — 2ª demão",
          "Trim e rodapés", "Portas e batentes", "Armários (cabinets)", "Siding / clapboard", "Trim, soffit e fascia", "Janelas e portas externas",
          "Deck / cerca (stain)", "Recolocar espelhos e ferragens", "Retoques (touch-up)", "Limpeza diária e final",
          "Verificação de limpeza RRP (cleaning verification)", "Entregar sobra de tinta etiquetada", "Punch list com o cliente"
        ]
      },
      inspections: [
        {
          "label": { "pt": "Teste de chumbo (casa pré-1978)", "en": "Lead test (pre-1978 home)", "es": "Prueba de plomo (casa de antes de 1978)" },
          "authority": {
            "pt": "Certified renovator (EPA RRP); em MA, Lead-Safe Renovator licenciado pelo DLS (454 CMR 22)",
            "en": "Certified renovator (EPA RRP); in MA, DLS-licensed Lead-Safe Renovator (454 CMR 22)",
            "es": "Renovador certificado (EPA RRP); en MA, Lead-Safe Renovator con licencia DLS (454 CMR 22)"
          },
          "when": {
            "pt": "Antes de orçar/começar em casa construída antes de 1978 (ou presumir chumbo)",
            "en": "Before starting work in a home built before 1978 (or presume lead)",
            "es": "Antes de empezar en una casa construida antes de 1978 (o presumir plomo)"
          }
        },
        {
          "label": { "pt": "Contenção lead-safe (RRP)", "en": "Lead-safe containment (RRP)", "es": "Contención segura contra plomo (RRP)" },
          "authority": {
            "pt": "EPA RRP (40 CFR 745); em MA, DLS — Lead-Safe Renovation Contractor",
            "en": "EPA RRP (40 CFR 745); in MA, DLS Lead-Safe Renovation Contractor",
            "es": "EPA RRP (40 CFR 745); en MA, DLS Lead-Safe Renovation Contractor"
          },
          "when": {
            "pt": "Pré-1978 e perturbar mais de 6 sq ft por cômodo (interior) ou 20 sq ft (exterior)",
            "en": "Pre-1978 and disturbing more than 6 sq ft per room (interior) or 20 sq ft (exterior)",
            "es": "Antes de 1978 y alterando más de 6 sq ft por cuarto (interior) o 20 sq ft (exterior)"
          }
        },
        {
          "label": { "pt": "Verificação de limpeza RRP (cleaning verification)", "en": "RRP cleaning verification", "es": "Verificación de limpieza RRP" },
          "authority": { "pt": "Certified renovator da empresa", "en": "Firm's certified renovator", "es": "Renovador certificado de la empresa" },
          "when": {
            "pt": "No fim da obra, antes de liberar a área",
            "en": "At completion, before releasing the work area",
            "es": "Al terminar, antes de liberar el área de trabajo"
          }
        },
        {
          "label": { "pt": "Registro HIC (MA)", "en": "HIC registration (MA)", "es": "Registro HIC (MA)" },
          "authority": { "pt": "Office of Consumer Affairs (OCABR) — MA", "en": "Office of Consumer Affairs (OCABR) — MA", "es": "Office of Consumer Affairs (OCABR) — MA" },
          "when": {
            "pt": "Verificar o registro HIC com o OCABR (M.G.L. c.142A): reforma residencial em casa de 1–4 famílias ocupada pelo dono — interior ou exterior; contrato escrito acima de US$ 1.000",
            "en": "Check HIC registration with OCABR (M.G.L. c.142A): residential contracting on an owner-occupied 1–4 family home — interior or exterior; written contract over $1,000",
            "es": "Verificar el registro HIC en la OCABR (M.G.L. c.142A): trabajo residencial en casa de 1 a 4 familias ocupada por el dueño — interior o exterior; contrato escrito de más de $1,000"
          }
        },
        {
          "label": { "pt": "Building permit: não precisa", "en": "Building permit: not required", "es": "Permiso de construcción: no hace falta" },
          "authority": {
            "pt": "780 CMR 105.2 — pintura é trabalho de acabamento isento",
            "en": "780 CMR 105.2 — painting is exempt finish work",
            "es": "780 CMR 105.2 — la pintura es trabajo de acabado exento"
          },
          "when": {
            "pt": "Só precisa se houver troca de madeira estrutural ou carpintaria maior (aí é outro ramo)",
            "en": "Only if structural wood replacement or major carpentry is involved",
            "es": "Solo si hay cambio de madera estructural o carpintería mayor"
          }
        }
      ],
      proposal: {
        "title": "PAINTING PROPOSAL",
        "tagline": "PROFESSIONAL PAINTING CONTRACTOR",
        "role": "Painting Contractor",
        "scopeName": "Painting",
        "invoiceWork": "painting",
        "intro": {
          "text": "This proposal covers the painting scope of work for {what} at {where}. Work will be performed in accordance with the paint manufacturer's application instructions, PDCA industry standards, {code} and the requirements of the local Authority Having Jurisdiction.",
          "code": {
            "MA": "the EPA Renovation, Repair and Painting Rule (40 CFR Part 745) and the Massachusetts Lead Safe Renovation regulations (454 CMR 22.00) for buildings constructed before 1978, the Massachusetts VOC limits for architectural coatings (310 CMR 7.25),",
            "*": "the EPA Renovation, Repair and Painting Rule (40 CFR Part 745) for buildings constructed before 1978,"
          }
        },
        "sections": [
          {
            "title": "Surface Preparation",
            "keywords": "prep|prepara|raspar|scrape|lixar|sand|massa|spackle|caulk|calafet|primer|furo|trinca|crack",
            "text": "Clean all surfaces to be painted; scrape and sand loose or failing paint to a sound edge.\nFill nail holes, dents, and minor cracks with spackle; caulk open joints at trim with **paintable acrylic latex caulk**.\nSpot-prime bare wood, patched areas, and stains with a **bonding / stain-blocking primer**."
          },
          {
            "title": "Protection of the Work Area",
            "keywords": ".",
            "text": "Protect floors, furniture, fixtures, and landscaping with drop cloths, plastic sheeting, and masking.\nRemove and reinstall switch plates, outlet covers, and hardware within the work area."
          },
          {
            "title": "Lead-Safe Work Practices (Pre-1978)",
            "keywords": "chumbo|lead|1978|rrp|casa antiga|old house",
            "text": "[MA] Home built before 1978: work performed by an **EPA-certified / Massachusetts DLS-licensed lead-safe renovation firm** following RRP work practices (454 CMR 22.00) — containment, no open-flame burning or uncontained power sanding, and HEPA cleanup.\n[!MA] Home built before 1978: work performed by an **EPA-certified lead-safe renovation firm** following RRP work practices (40 CFR 745) — containment, no open-flame burning or uncontained power sanding, and HEPA cleanup.\nThe EPA “Renovate Right” pamphlet will be provided before work begins; cleaning verification at completion."
          },
          {
            "title": "Interior Walls & Ceilings",
            "keywords": "parede|wall|teto|ceiling|interior|dentro|c[oô]modo|quarto|sala|room|cozinha|kitchen",
            "text": "Ceilings: flat ceiling paint, coats as needed for uniform coverage.\nWalls: {coats} of {product} ({sheen}) over properly prepared surfaces.\nStraight cut-in lines at ceilings, trim, and color changes."
          },
          {
            "title": "Interior Trim, Doors & Cabinets",
            "keywords": "trim|rodap|baseboard|porta|door|batente|casing|arm[aá]rio|cabinet|janela|window|escada|stair|corrim",
            "text": "Baseboards, door and window casings, and doors: finish coats as listed of **semi-gloss acrylic enamel** (or the sheen listed), lightly sanded between coats.\nCabinets (where listed): remove doors and hardware, degrease, scuff-sand, **bonding primer**, and finish coats of **urethane-modified enamel**, spray-applied."
          },
          {
            "title": "Exterior Body & Trim",
            "keywords": "exterior|externa|lado de fora|outside|siding|clapboard|fachada|soffit|fascia",
            "text": "Power wash and allow to dry; scrape, sand, and spot-prime bare areas.\nBody (siding): {coats} of {product} exterior acrylic ({sheen}).\nTrim, soffits, fascia, windows, and doors: exterior acrylic trim paint, coats as listed."
          },
          {
            "title": "Carpentry & Rot Repair",
            "keywords": "podre|rot|madeira ruim|carpint|carpent|trocar t[aá]bua|board replace",
            "text": "Replace rotted trim / clapboards listed in the Investment section with **primed pine or PVC** stock matching the existing profile as closely as possible.\nAdditional rot found after scraping will be documented with photos and quoted as a change order."
          },
          {
            "title": "Stain & Clear Finishes",
            "keywords": "stain|deck|cerca|fence|verniz|varnish|poly|selador|sealer",
            "text": "Deck / fence / stained surfaces: clean and brighten, then apply penetrating **semi-transparent or solid stain**, coats as listed.\nHorizontal deck surfaces are not covered by the coating warranty (foot traffic and weather)."
          },
          {
            "title": "Cleanup & Final Walkthrough",
            "keywords": ".",
            "text": "Daily cleanup of the work area; paint waste disposed of per local regulations.\nFinal walkthrough with the Owner, touch-ups, and labeled leftover paint left on site."
          }
        ],
        "defaults": {
          "includes": "all labor, paint and materials listed above (product lines as specified), surface preparation, protection of the work area, supervision, daily cleanup, and applicable {state} sales tax.",
          "notIncluded": "Drywall or plaster repair beyond minor patching · carpentry or rot repair beyond what is listed · moving pianos, heavy furniture, or appliances · lead abatement / deleading (RRP lead-safe practices only — no Letter of Compliance) · asbestos testing or abatement · mold remediation · wallpaper removal unless listed · painting of floors, radiators, or HVAC equipment unless listed · window glazing or reglazing · colors or coats beyond those listed.",
          "clarifications": "Owner to approve all colors and sheens in writing before the start date; color changes after work begins will be quoted as a change order.\nPrice includes the number of coats listed; deep color changes or porous surfaces that need additional coats will be quoted before proceeding.\nExterior painting is weather-dependent: no application below the manufacturer's minimum temperature or when rain is expected before the coating sets.\nRot or substrate damage found after scraping will be shown to the Owner (photos) and quoted as a change order.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** Two (2) years on painting workmanship (peeling, blistering, or flaking caused by application) from the date of completion. Not covered: failures caused by moisture intrusion, rot, substrate movement, mildew, previously failing coatings beneath, or horizontal deck surfaces. Paint manufacturer warranties pass through to the Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Pintura interior da casa toda: quatro quartos, sala e cozinha, tetos e paredes, duas demãos Benjamin Moore Regal eggshell, trim e portas semi-gloss. Casa de 1950, então lead-safe. Preço 14.500, 30/40/30.”",
          "en": "e.g. “Whole-house interior: four bedrooms, living room and kitchen, ceilings and walls, two coats Benjamin Moore Regal eggshell, trim and doors semi-gloss. House from 1950, so lead-safe. Price 14,500, 30/40/30.”",
          "es": "ej.: “Interior de toda la casa: cuatro habitaciones, sala y cocina, techos y paredes, dos manos de Benjamin Moore Regal eggshell, molduras y puertas en semi-gloss. Casa de 1950, así que seguro contra plomo. Precio 14,500, 30/40/30.”"
        },
        "aiRules": "Trade: PAINTING contractor (interior / exterior, residential and commercial). Painting needs no building permit (780 CMR 105.2) — never write \"permit fees included\".\nStandards: EPA RRP Rule (40 CFR 745) for pre-1978 housing; in MA also Lead Safe Renovation 454 CMR 22.00 (DLS) and VOC limits 310 CMR 7.25; manufacturer application instructions; PDCA standards. Commercial jobs may reference the spec section (Division 09 91 00) and MPI products if the speaker mentions them.\nTypical sections: \"Surface Preparation\", \"Protection of the Work Area\", \"Lead-Safe Work Practices (Pre-1978)\", \"Interior Walls & Ceilings\", \"Interior Trim, Doors & Cabinets\", \"Exterior Body & Trim\", \"Carpentry & Rot Repair\", \"Stain & Clear Finishes\", \"Cleanup & Final Walkthrough\".\nFor every surface state product line, sheen, and number of coats exactly as spoken (e.g. \"**two (2) coats** of **Benjamin Moore Regal Select, eggshell**\"). If no brand is said write \"premium 100% acrylic\" — never invent a brand, color, or coat count.\nQuantities: describe by room/area and surface (walls, ceilings, trim in linear feet, doors and windows each); use sq ft only if spoken; never put gallons in the client document.\nPre-1978 house or \"chumbo/lead\": add the Lead-Safe section. RRP lead-safe practices are NOT deleading/abatement — never promise lead abatement or a Letter of Compliance.\nAlways in Not Included: drywall/plaster repair beyond minor patching, carpentry/rot beyond what is listed, asbestos, mold remediation, moving heavy furniture. Rot found after scraping = change order with photos.\nExterior jobs: keep the weather/temperature clause. Cabinets: degrease, scuff-sand, bonding primer, urethane enamel, spray-applied, doors removed.\nMA owner-occupied 1–4 family homes (HIC law, M.G.L. c.142A): the deposit may not exceed one-third of the price unless for special-order materials — prefer 30/40/30 or thirds over 50/50.\nSpeech terms: \"éguixel\" = eggshell, \"semi-glós\" = semi-gloss, \"Ben Moore\" = Benjamin Moore, \"Sherwin\" = Sherwin-Williams, \"massa\" = spackle / joint compound, \"calafetar\" = caulk, \"lixar\" = sand, \"raspar\" = scrape, \"demão\" = coat, \"rodapé\" = baseboard.\nNever write 'permit fees included' (painting needs no building permit); item line 'Labor and material per the scope above'. Coats, sheen, and product line only as spoken; otherwise 'as listed'. Payment: Deposit / Midpoint / Final (never 'Rough-In'). In MA pre-1978 homes add the Massachusetts Lead Law note (105 CMR 460: Owner's deleading obligation if a child under six lives there).",
        "facts": {
          "coats": {
            "count": "dem[ãa]os?|coats?|camadas? de tinta",
            "gap": 1,
            "max": 5,
            "one": "**one (1) finish coat**",
            "many": "**{wn} finish coats**",
            "fallback": "the number of finish coats listed"
          },
          "sheen": {
            "pick": [
              ["semi.?gloss", "semi-gloss"], ["eggshell|casca de ovo", "eggshell"], ["\\bsatin|acetinad", "satin"],
              ["\\bflat\\b|\\bmatte?\\b|fosc", "flat / matte"], ["\\bgloss|brilhante", "gloss"]
            ],
            "fallback": "sheen as approved by the Owner"
          },
          "product": {
            "re": "((?:Sherwin-Williams|Sherwin Williams|Benjamin Moore|Behr|PPG|Valspar|California Paints|Farrow & Ball))((?:\\s+(?!e\\b|and\\b|na\\b|no\\b|de\\b)[A-Z][\\w-]*){0,2})",
            "cs": true,
            "fmt": "**{g1}{g2}**",
            "fallback": "premium acrylic latex (product line as listed)"
          }
        },
        "itemNote": "Labor and material per the scope above.",
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to the start date."],
            ["Midpoint", "Upon completion of surface preparation and first coats (approximately 50% complete)."],
            ["Final Payment", "Upon completion and final walkthrough with the Owner."]
          ]
        },
        "hic": true,
        "clientRole": "Homeowner",
        "jobVariants": [
          {
            "match": "1978|chumbo|\\blead\\b|rrp|casa antiga|old house|\\b19[0-6]\\d\\b|\\b197[0-7]\\b",
            "defaults": {
              "clarifications+": "[MA] Massachusetts Lead Law (105 CMR 460): if a child under six lives in this pre-1978 home, the Owner remains responsible for deleading or interim control by a licensed deleader; the lead-safe renovation practices in this proposal do not satisfy that obligation and no Letter of Compliance is issued."
            }
          }
        ],
        "adjustExample": {
          "pt": "Ex.: “Tira os armários, muda o preço para 12 mil e acrescenta o corredor de cima.”",
          "en": "e.g. “Remove the cabinets, change the price to 12K and add the upstairs hallway.”",
          "es": "ej.: “Quita los gabinetes, cambia el precio a 12 mil y agrega el pasillo de arriba.”"
        }
      },
      prices: {
        "stores": [
          { "id": "sherwin", "name": "Sherwin-Williams", "short": "Sherwin-Williams", "search": "site:sherwin-williams.com" },
          {
            "id": "benjaminmoore",
            "name": { "pt": "Benjamin Moore (revendedor)", "en": "Benjamin Moore (dealer)", "es": "Benjamin Moore (distribuidor)" },
            "short": "Benjamin Moore",
            "search": "site:benjaminmoore.com"
          },
          { "id": "ppgpaints", "name": "PPG Paints", "short": "PPG", "search": "site:ppgpaints.com" },
          "homedepot",
          "lowes"
        ],
        "basic": [
          [
            { "pt": "Tinta interior premium — galão", "en": "Premium interior paint — gallon", "es": "Pintura interior premium — galón" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Tinta interior — balde 5 gal", "en": "Interior paint — 5-gal pail", "es": "Pintura interior — cubeta de 5 gal" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "balde", "en": "pail", "es": "cubeta" }
          ],
          [
            { "pt": "Tinta de teto flat — balde 5 gal", "en": "Flat ceiling paint — 5-gal pail", "es": "Pintura mate para techos — cubeta de 5 gal" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "balde", "en": "pail", "es": "cubeta" }
          ],
          [
            { "pt": "Esmalte semi-gloss para trim — galão", "en": "Semi-gloss trim enamel — gallon", "es": "Esmalte semi-gloss para molduras — galón" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Tinta exterior 100% acrílica — galão", "en": "100% acrylic exterior paint — gallon", "es": "Pintura exterior 100% acrílica — galón" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Stain sólido exterior — galão", "en": "Exterior solid stain — gallon", "es": "Tinte sólido exterior — galón" },
            { "pt": "Tinta", "en": "Paint", "es": "Pintura" }, { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Primer bloqueador (stain-blocking) — galão", "en": "Stain-blocking primer — gallon", "es": "Primer bloqueador de manchas — galón" },
            "Primer", { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Primer PVA para drywall novo — balde 5 gal", "en": "PVA drywall primer — 5-gal pail", "es": "Primer PVA para drywall — cubeta de 5 gal" },
            "Primer", { "pt": "balde", "en": "pail", "es": "cubeta" }
          ],
          [
            { "pt": "Caulk acrílico pintável (tubo)", "en": "Paintable acrylic caulk (tube)", "es": "Sellador acrílico pintable (tubo)" },
            { "pt": "Preparação", "en": "Prep", "es": "Preparación" }, { "pt": "tubo", "en": "tube", "es": "tubo" }
          ],
          [
            { "pt": "Massa spackle — quart", "en": "Spackling compound — quart", "es": "Masilla (spackle) — cuarto de galón" },
            { "pt": "Preparação", "en": "Prep", "es": "Preparación" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Lixa / esponja de lixa (pacote)", "en": "Sandpaper / sanding sponges (pack)", "es": "Lijas / esponjas de lija (paquete)" },
            { "pt": "Preparação", "en": "Prep", "es": "Preparación" }, { "pt": "pacote", "en": "pack", "es": "paquete" }
          ],
          [
            { "pt": "Fita crepe azul 1,5\" (rolo)", "en": "Blue painter's tape 1.5\" (roll)", "es": "Cinta azul de pintor 1.5\" (rollo)" },
            { "pt": "Proteção", "en": "Protection", "es": "Protección" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Plástico 9 x 400 ft", "en": "Plastic sheeting 9 x 400 ft", "es": "Plástico 9 x 400 ft" },
            { "pt": "Proteção", "en": "Protection", "es": "Protección" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Lona de pintor (drop cloth)", "en": "Canvas drop cloth", "es": "Lona de tela" },
            { "pt": "Proteção", "en": "Protection", "es": "Protección" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Capa de rolo 9\" — 3/8\"", "en": "Roller cover 9\" — 3/8\" nap", "es": "Rodillo 9\" — felpa de 3/8\"" },
            { "pt": "Ferramentas", "en": "Tools", "es": "Herramientas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Pincel angular 2,5\"", "en": "Angled sash brush 2.5\"", "es": "Brocha angular 2.5\"" },
            { "pt": "Ferramentas", "en": "Tools", "es": "Herramientas" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Kit de teste de chumbo (reconhecido pela EPA)", "en": "Lead test kit (EPA-recognized)", "es": "Kit de prueba de plomo (reconocido por la EPA)" },
            "Lead-safe", "kit"
          ],
          [
            { "pt": "Plástico 6 mil para contenção (RRP)", "en": "6-mil poly for containment (RRP)", "es": "Plástico de 6 mil para contención (RRP)" },
            "Lead-safe", { "pt": "rolo", "en": "roll", "es": "rollo" }
          ]
        ],
        "basicOffer": [{ "list": "painting", "label": { "pt": "Adicionar lista básica de pintura", "en": "Add basic painting list", "es": "Agregar lista básica de pintura" } }],
        "promos": false,
        "searchExample": { "pt": "ex.: Regal eggshell, primer, caulk", "en": "e.g. Regal eggshell, primer, caulk", "es": "ej.: Regal eggshell, primer, sellador" }
      },
      groupsI18n: {
        "en": {
          "Preparação e proteção": "Prep & protection",
          "Reparos de superfície": "Surface repairs",
          "Pintura interior": "Interior painting",
          "Pintura exterior": "Exterior painting",
          "Acabamento": "Finish",
          "Inspeções": "Inspections"
        },
        "es": {
          "Preparação e proteção": "Preparación y protección",
          "Reparos de superfície": "Reparación de superficies",
          "Pintura interior": "Pintura interior",
          "Pintura exterior": "Pintura exterior",
          "Acabamento": "Acabado",
          "Inspeções": "Inspecciones"
        }
      },
      warnings: [
        {
          "if": { "all": [{ "f": "workType", "re": "^Exterior" }, { "f": "paintScope", "re": "^(?:Paredes|Tetos|Armários|Escadas e corrimão)$" }] },
          "msg": {
            "pt": "Tipo “Exterior residencial” com escopo de interior (paredes, tetos, armários ou escadas). Confira: talvez seja “Interior + exterior”.",
            "en": "“Exterior residential” job with interior scope (walls, ceilings, cabinets, or stairs). Check: maybe it is “Interior + exterior”.",
            "es": "Trabajo “Exterior residencial” con alcance interior (paredes, techos, gabinetes o escaleras). Revisa: quizás es “Interior + exterior”."
          }
        },
        {
          "if": { "all": [{ "f": "workType", "re": "^Interior residencial" }, { "f": "paintScope", "re": "Siding" }] },
          "msg": {
            "pt": "Tipo “Interior residencial” com siding marcado. Confira: talvez seja “Interior + exterior”.",
            "en": "“Interior residential” job with siding selected. Check: maybe it is “Interior + exterior”.",
            "es": "Trabajo “Interior residencial” con siding seleccionado. Revisa: quizás es “Interior + exterior”."
          }
        }
      ]
    },
    {
      id: "flooring",
      aliases: [],
      order: 70,
      category: "finish",
      label: { "pt": "Piso", "en": "Flooring", "es": "Pisos" },
      companySuffix: "Flooring",
      onboarding: {
        "label": { "pt": "Piso", "en": "Flooring", "es": "Pisos" },
        "desc": { "pt": "Madeira, LVP, tile, carpete, refinish", "en": "Hardwood, LVP, tile, carpet, refinishing", "es": "Madera, LVP, azulejo, alfombra, refinish" }
      },
      icon: { "svg": "<rect x=\"3.5\" y=\"4\" width=\"17\" height=\"16\" rx=\"2\"/><path d=\"M3.5 9.3h17M3.5 14.7h17M10 4v5.3M15.5 9.3v5.4M8 14.7V20\"/>" },
      kind: { "pt": "trabalho de piso", "en": "flooring job", "es": "trabajo de pisos" },
      stepName: { "pt": "Piso", "en": "Flooring", "es": "Pisos" },
      group: { "label": { "pt": "Piso", "en": "Flooring", "es": "Pisos" }, "icon": "trade-flooring" },
      workType: [
        { "pt": "Instalação nova (casa nova)", "en": "New install (new construction)", "es": "Instalación nueva (construcción nueva)" },
        { "pt": "Troca de piso (remover + instalar)", "en": "Floor replacement (tear-out + install)", "es": "Cambio de piso (quitar + instalar)" },
        { "pt": "Refinish de madeira (lixar e envernizar)", "en": "Hardwood refinish (sand & finish)", "es": "Refinish de madera (lijar y acabar)" },
        { "pt": "Screen & recoat (sem lixar)", "en": "Screen & recoat", "es": "Screen & recoat (lijado ligero y nueva capa)" },
        { "pt": "Tile / porcelanato (banheiro, cozinha)", "en": "Tile / porcelain (bath, kitchen)", "es": "Azulejo / porcelanato (baño, cocina)" },
        { "pt": "Carpete", "en": "Carpet", "es": "Alfombra" },
        { "pt": "Comercial (LVT / VCT / carpet tile)", "en": "Commercial (LVT / VCT / carpet tile)", "es": "Comercial (LVT / VCT / alfombra en placas)" },
        { "pt": "Escada (degraus)", "en": "Stairs (treads & risers)", "es": "Escaleras (huellas y contrahuellas)" }
      ],
      fields: {
        "floorMaterial": {
          "label": { "pt": "Material do piso", "en": "Flooring material", "es": "Material del piso" },
          "multi": true,
          "opts": [
            { "pt": "Madeira maciça (solid hardwood)", "en": "Solid hardwood", "es": "Madera sólida" },
            { "pt": "Madeira engenheirada (engineered)", "en": "Engineered hardwood", "es": "Madera de ingeniería" },
            { "pt": "LVP / vinil click", "en": "LVP / click vinyl", "es": "LVP / vinilo click" },
            { "pt": "LVT / vinil colado", "en": "LVT / glue-down vinyl", "es": "LVT / vinilo pegado" }, { "pt": "Laminado", "en": "Laminate", "es": "Laminado" },
            { "pt": "Tile cerâmico", "en": "Ceramic tile", "es": "Azulejo cerámico" }, { "pt": "Porcelanato", "en": "Porcelain tile", "es": "Porcelanato" },
            { "pt": "Pedra natural", "en": "Natural stone", "es": "Piedra natural" }, { "pt": "Carpete", "en": "Carpet", "es": "Alfombra" }, "VCT",
            "Sheet vinyl"
          ]
        },
        "installMethod": {
          "label": { "pt": "Método de instalação", "en": "Installation method", "es": "Método de instalación" },
          "multi": true,
          "opts": [
            { "pt": "Pregado (nail-down)", "en": "Nail-down", "es": "Clavado" }, { "pt": "Colado (glue-down)", "en": "Glue-down", "es": "Pegado" },
            { "pt": "Flutuante (floating / click)", "en": "Floating (click)", "es": "Flotante (click)" },
            { "pt": "Argamassa (thinset)", "en": "Thinset mortar", "es": "Mortero thinset" },
            { "pt": "Tack strip + pad (carpete)", "en": "Tack strip + pad (carpet)", "es": "Tachuelas + bajoalfombra (alfombra)" }
          ]
        },
        "existingFloor": {
          "label": { "pt": "Piso existente", "en": "Existing floor", "es": "Piso existente" },
          "opts": [
            { "pt": "Contrapiso exposto", "en": "Bare subfloor", "es": "Contrapiso desnudo" }, { "pt": "Carpete", "en": "Carpet", "es": "Alfombra" },
            { "pt": "Madeira (hardwood)", "en": "Hardwood", "es": "Madera" },
            { "pt": "Vinil / linóleo antigo", "en": "Old vinyl / linoleum", "es": "Vinilo / linóleo viejo" }, "Tile",
            { "pt": "Laminado / LVP", "en": "Laminate / LVP", "es": "Laminado / LVP" },
            { "pt": "Tile 9x9 antigo (possível asbesto)", "en": "Old 9x9 tile (possible asbestos)", "es": "Azulejo viejo 9x9 (posible asbesto)" }
          ]
        },
        "removal": {
          "label": { "pt": "Remoção", "en": "Removal", "es": "Retiro" },
          "opts": [
            { "pt": "Não precisa remover", "en": "No removal", "es": "Sin retiro" }, { "pt": "Remover 1 camada", "en": "Remove 1 layer", "es": "Quitar 1 capa" },
            { "pt": "Remover várias camadas", "en": "Remove multiple layers", "es": "Quitar varias capas" },
            { "pt": "Remover tile (com argamassa)", "en": "Remove tile (with mortar bed)", "es": "Quitar azulejo (con cama de mortero)" },
            { "pt": "Instalar por cima (se o fabricante permitir)", "en": "Install over existing (if allowed)", "es": "Instalar sobre el existente (si se permite)" }
          ]
        },
        "subfloor": {
          "label": { "pt": "Contrapiso (subfloor)", "en": "Subfloor", "es": "Contrapiso" },
          "opts": [
            { "pt": "Compensado (plywood)", "en": "Plywood", "es": "Plywood" }, "OSB",
            { "pt": "Tábuas antigas (planks)", "en": "Old board planks", "es": "Tablones viejos" },
            { "pt": "Concreto no nível do solo", "en": "Concrete on grade", "es": "Concreto a nivel del suelo" },
            { "pt": "Concreto abaixo do solo (porão)", "en": "Concrete below grade (basement)", "es": "Concreto bajo nivel (sótano)" },
            { "pt": "Laje acima do solo", "en": "Suspended concrete slab", "es": "Losa de concreto suspendida" }
          ]
        },
        "subfloorPrep": {
          "label": { "pt": "Preparo do contrapiso", "en": "Subfloor prep", "es": "Preparación del contrapiso" },
          "multi": true,
          "opts": [
            { "pt": "Nivelar (self-leveler)", "en": "Self-leveler", "es": "Autonivelante" },
            { "pt": "Lixar pontos altos", "en": "Grind / sand high spots", "es": "Esmerilar / lijar puntos altos" },
            { "pt": "Trocar / reforçar contrapiso", "en": "Replace / reinforce subfloor", "es": "Cambiar / reforzar el contrapiso" },
            { "pt": "Parafusar contrapiso (rangidos)", "en": "Re-screw subfloor (squeaks)", "es": "Volver a atornillar el contrapiso (rechinidos)" },
            { "pt": "Underlayment plywood 1/4\"", "en": "1/4\" plywood underlayment", "es": "Base de plywood de 1/4\"" },
            { "pt": "Barreira de vapor", "en": "Vapor retarder", "es": "Barrera de vapor" },
            { "pt": "Membrana desacopladora (Ditra)", "en": "Uncoupling membrane (Ditra)", "es": "Membrana desacopladora (Ditra)" }, "Cement board"
          ]
        },
        "moistureTest": {
          "label": { "pt": "Teste de umidade", "en": "Moisture test", "es": "Prueba de humedad" },
          "opts": [
            { "pt": "Medidor de madeira (pin / pinless)", "en": "Wood meter (pin / pinless)", "es": "Medidor para madera (con / sin pines)" },
            { "pt": "RH no concreto (ASTM F2170)", "en": "Concrete in-situ RH (ASTM F2170)", "es": "HR in situ del concreto (ASTM F2170)" },
            { "pt": "Cloreto de cálcio (ASTM F1869)", "en": "Calcium chloride (ASTM F1869)", "es": "Cloruro de calcio (ASTM F1869)" },
            { "pt": "Não feito", "en": "Not done", "es": "No se hizo" }
          ]
        },
        "layout": {
          "label": { "pt": "Padrão / layout", "en": "Pattern / layout", "es": "Patrón / distribución" },
          "opts": [
            { "pt": "Reto (straight lay)", "en": "Straight lay", "es": "Recto" }, "Diagonal",
            { "pt": "Espinha de peixe (herringbone)", "en": "Herringbone", "es": "Espiga (herringbone)" }, "Chevron",
            { "pt": "Larguras mistas", "en": "Random widths", "es": "Anchos variados" },
            { "pt": "Tile alinhado / offset", "en": "Tile stacked / offset", "es": "Azulejo alineado / desfasado" }
          ]
        },
        "plankSize": {
          "label": { "pt": "Largura / tamanho", "en": "Width / size", "es": "Ancho / tamaño" },
          "opts": [
            { "pt": "Tábua 2-1/4\"", "en": "2-1/4\" strip", "es": "Tira de 2-1/4\"" },
            { "pt": "Tábua 3-1/4\"", "en": "3-1/4\" plank", "es": "Tablón de 3-1/4\"" },
            { "pt": "Tábua 5\"+ (wide plank)", "en": "5\"+ wide plank", "es": "Tablón ancho de 5\"+" },
            { "pt": "Tile até 12x12", "en": "Tile up to 12x12", "es": "Azulejo de hasta 12x12" }, "Tile 12x24",
            { "pt": "Grande formato (24x48+)", "en": "Large format (24x48+)", "es": "Formato grande (24x48+)" }
          ]
        },
        "woodFinish": {
          "label": { "pt": "Acabamento da madeira", "en": "Wood finish", "es": "Acabado de la madera" },
          "opts": [
            { "pt": "Pré-acabado de fábrica", "en": "Factory prefinished", "es": "Prefinished de fábrica" },
            { "pt": "Poliuretano à base de água", "en": "Waterborne polyurethane", "es": "Poliuretano a base de agua" },
            { "pt": "Poliuretano à base de óleo", "en": "Oil-based polyurethane", "es": "Poliuretano a base de aceite" }, "Hardwax oil",
            { "pt": "Stain + poliuretano", "en": "Stain + polyurethane", "es": "Tinte + poliuretano" }, { "pt": "Não se aplica", "en": "N/A", "es": "N/A" }
          ]
        },
        "trimTransitions": {
          "label": { "pt": "Rodapé e transições", "en": "Base & transitions", "es": "Zócalos y transiciones" },
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Remover e recolocar rodapé", "en": "Remove & reinstall baseboard", "es": "Quitar y reinstalar zócalos" },
            { "pt": "Rodapé novo", "en": "New baseboard", "es": "Zócalo nuevo" }, "Shoe / quarter round",
            { "pt": "Transições (T-mold, reducer)", "en": "Transitions (T-mold, reducer)", "es": "Transiciones (T-mold, reductor)" },
            { "pt": "Soleiras (thresholds)", "en": "Thresholds", "es": "Umbrales" }, "Stair nosing"
          ]
        },
        "furniture": {
          "label": { "pt": "Móveis / eletrodomésticos", "en": "Furniture / appliances", "es": "Muebles / electrodomésticos" },
          "system": true,
          "opts": [
            { "pt": "Área vazia", "en": "Empty area", "es": "Área vacía" },
            { "pt": "Nós movemos os móveis", "en": "We move furniture", "es": "Nosotros movemos los muebles" },
            { "pt": "Cliente move os móveis", "en": "Owner moves furniture", "es": "El dueño mueve los muebles" },
            { "pt": "Tirar e recolocar vaso / eletrodomésticos", "en": "Pull & reset toilet / appliances", "es": "Quitar y reinstalar inodoro / electrodomésticos" }
          ]
        }
      },
      text: [
        { "key": "floorArea", "label": { "pt": "Área de piso (sq ft)", "en": "Floor area (sq ft)", "es": "Área del piso (sq ft)" }, "unit": "sqft", "type": "number" },
        { "key": "rooms", "label": { "pt": "Cômodos", "en": "Rooms", "es": "Cuartos" } },
        { "key": "stairs", "label": { "pt": "Degraus (quantidade)", "en": "Stair treads (count)", "es": "Huellas de escalera (cantidad)" }, "unit": "ea", "type": "number" },
        { "key": "product", "label": { "pt": "Produto (marca / linha / cor)", "en": "Product (brand / line / color)", "es": "Producto (marca / línea / color)" } }
      ],
      units: [
        { "id": "sqft", "label": "sq ft" }, { "id": "sqyd", "label": { "pt": "jarda² (sq yd)", "en": "sq yd", "es": "yd²" } },
        { "id": "lf", "label": { "pt": "pés lineares (lf)", "en": "linear ft", "es": "pie lineal" } },
        { "id": "box", "label": { "pt": "caixa", "en": "box", "es": "caja" } }, { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } },
        { "id": "bag", "label": { "pt": "saco", "en": "bag", "es": "bolsa" } }, { "id": "sheet", "label": { "pt": "folha", "en": "sheet", "es": "hoja" } }
      ],
      tasks: {
        "Preparação e remoção": [
          { "pt": "Medição e layout", "en": "Measure & layout", "es": "Medir y distribuir" },
          { "pt": "Aclimatar material", "en": "Acclimate material", "es": "Aclimatar el material" },
          { "pt": "Mover móveis", "en": "Move furniture", "es": "Mover los muebles" },
          { "pt": "Proteger áreas e montar contenção de pó", "en": "Protect areas & set up dust containment", "es": "Proteger áreas y montar contención de polvo" },
          { "pt": "Remover rodapé / shoe", "en": "Remove baseboard / shoe molding", "es": "Quitar zócalos / cuarto de caña" },
          { "pt": "Remover piso existente", "en": "Remove existing flooring", "es": "Quitar el piso existente" },
          { "pt": "Remover vaso / eletrodomésticos", "en": "Pull toilet / appliances", "es": "Quitar inodoro / electrodomésticos" },
          { "pt": "Descarte do entulho", "en": "Debris disposal", "es": "Desecho de escombros" }
        ],
        "Contrapiso": [
          { "pt": "Parafusar contrapiso (rangidos)", "en": "Re-screw subfloor (squeaks)", "es": "Volver a atornillar el contrapiso (rechinidos)" },
          { "pt": "Trocar / reforçar contrapiso", "en": "Replace / reinforce subfloor", "es": "Cambiar / reforzar el contrapiso" },
          {
            "pt": "Nivelar (self-leveler / lixar pontos altos)",
            "en": "Flatten floor (self-leveler / grind high spots)",
            "es": "Nivelar el piso (autonivelante / esmerilar puntos altos)"
          },
          { "pt": "Underlayment / barreira de vapor", "en": "Underlayment / vapor barrier", "es": "Base / barrera de vapor" },
          { "pt": "Cement board / membrana (tile)", "en": "Cement board / membrane (tile)", "es": "Cement board / membrana (azulejo)" }
        ],
        "Instalação": [
          { "pt": "Instalar piso de madeira", "en": "Install hardwood floor", "es": "Instalar piso de madera" },
          { "pt": "Instalar LVP / laminado", "en": "Install LVP / laminate", "es": "Instalar LVP / laminado" },
          { "pt": "Instalar piso colado (LVT / VCT / sheet)", "en": "Install glue-down floor (LVT / VCT / sheet)", "es": "Instalar piso pegado (LVT / VCT / rollo)" },
          { "pt": "Assentar tile / porcelanato", "en": "Set tile / porcelain", "es": "Colocar azulejo / porcelanato" },
          { "pt": "Rejuntar (grout) e selar", "en": "Grout & seal", "es": "Fraguar y sellar" },
          { "pt": "Instalar carpete e pad", "en": "Install carpet & pad", "es": "Instalar alfombra y bajoalfombra" },
          { "pt": "Degraus e nosing", "en": "Stair treads & nosing", "es": "Huellas y narices de escalera" }
        ],
        "Refinish": [
          { "pt": "Lixamento (sanding)", "en": "Sanding", "es": "Lijado" }, { "pt": "Buffing / screen", "en": "Buff & screen", "es": "Pulir y screen" }, "Stain",
          { "pt": "Acabamento — 1ª demão", "en": "Finish — 1st coat", "es": "Acabado — 1.ª mano" },
          { "pt": "Acabamento — demãos finais", "en": "Finish — final coats", "es": "Acabado — manos finales" }
        ],
        "Acabamento": [
          { "pt": "Rodapé / shoe / quarter round", "en": "Baseboard / shoe / quarter round", "es": "Zócalo / shoe / cuarto de caña" },
          { "pt": "Transições e soleiras", "en": "Transitions & thresholds", "es": "Transiciones y umbrales" },
          { "pt": "Recolocar vaso e eletrodomésticos", "en": "Reset toilet & appliances", "es": "Reinstalar inodoro y electrodomésticos" },
          { "pt": "Limpeza final", "en": "Final cleaning", "es": "Limpieza final" },
          { "pt": "Orientar cuidados e tempo de cura", "en": "Review care & cure time with owner", "es": "Repasar cuidados y tiempo de curado con el dueño" },
          { "pt": "Punch list com o cliente", "en": "Punch list walkthrough with owner", "es": "Recorrido de punch list con el dueño" }
        ],
        "Inspeções": [
          { "pt": "Teste de umidade (madeira / concreto)", "en": "Moisture test (wood / concrete)", "es": "Prueba de humedad (madera / concreto)" },
          { "pt": "Verificar asbesto em piso antigo", "en": "Check old flooring for asbestos", "es": "Revisar el piso viejo por asbesto" },
          { "pt": "Verificar planicidade (flatness)", "en": "Check flatness", "es": "Revisar la planitud" },
          {
            "pt": "Inspeção de contrapiso estrutural (permit)",
            "en": "Structural subfloor inspection (permit)",
            "es": "Inspección estructural del contrapiso (permiso)"
          }
        ]
      },
      suggest: {
        "vars": {
          "wood": { "f": "floorMaterial", "re": "Madeira" },
          "tile": { "any": [{ "f": "floorMaterial", "re": "Tile|Porcelanato|Pedra" }, { "f": "workType", "re": "Tile" }] },
          "concrete": { "f": "subfloor", "re": "Concreto|Laje" },
          "tearout": { "any": [{ "f": "workType", "re": "Troca de piso" }, { "f": "removal", "re": "^Remover" }] },
          "refinish": { "f": "workType", "re": "Refinish" }
        },
        "rules": [
          {
            "add": [
              ["Preparação e remoção", "Medição e layout"], ["Preparação e remoção", "Proteger áreas e montar contenção de pó"], ["Acabamento", "Limpeza final"],
              ["Acabamento", "Orientar cuidados e tempo de cura"], ["Acabamento", "Punch list com o cliente"]
            ]
          },
          { "if": { "any": [{ "var": "wood" }, { "f": "floorMaterial", "re": "LVP|LVT|Laminado" }] }, "add": [["Preparação e remoção", "Aclimatar material"]] },
          {
            "if": { "any": [{ "var": "wood" }, { "var": "concrete" }, { "f": "moistureTest", "re": "Medidor|RH|Cloreto" }] },
            "add": [["Inspeções", "Teste de umidade (madeira / concreto)"]]
          },
          { "if": { "f": "existingFloor", "re": "9x9|Vinil" }, "add": [["Inspeções", "Verificar asbesto em piso antigo"]] },
          {
            "if": { "var": "tearout" },
            "add": [["Preparação e remoção", "Remover rodapé / shoe"], ["Preparação e remoção", "Remover piso existente"], ["Preparação e remoção", "Descarte do entulho"]]
          },
          { "if": { "f": "furniture", "re": "Nós movemos" }, "add": [["Preparação e remoção", "Mover móveis"]] },
          {
            "if": { "any": [{ "f": "furniture", "re": "vaso" }, { "all": [{ "var": "tile" }, { "var": "tearout" }] }] },
            "add": [["Preparação e remoção", "Remover vaso / eletrodomésticos"], ["Acabamento", "Recolocar vaso e eletrodomésticos"]]
          },
          { "if": { "f": "subfloorPrep", "has": "Parafusar contrapiso (rangidos)" }, "add": [["Contrapiso", "Parafusar contrapiso (rangidos)"]] },
          {
            "if": { "f": "subfloorPrep", "has": "Trocar / reforçar contrapiso" },
            "add": [["Contrapiso", "Trocar / reforçar contrapiso"], ["Inspeções", "Inspeção de contrapiso estrutural (permit)"]]
          },
          {
            "if": { "f": "subfloorPrep", "re": "Nivelar|Lixar" },
            "add": [["Contrapiso", "Nivelar (self-leveler / lixar pontos altos)"], ["Inspeções", "Verificar planicidade (flatness)"]]
          },
          { "if": { "any": [{ "f": "subfloorPrep", "re": "Underlayment|Barreira" }, { "var": "concrete" }] }, "add": [["Contrapiso", "Underlayment / barreira de vapor"]] },
          { "if": { "any": [{ "var": "tile" }, { "f": "subfloorPrep", "re": "Ditra|Cement" }] }, "add": [["Contrapiso", "Cement board / membrana (tile)"]] },
          {
            "if": { "var": "tile" },
            "add": [["Instalação", "Assentar tile / porcelanato"], ["Instalação", "Rejuntar (grout) e selar"], ["Inspeções", "Verificar planicidade (flatness)"]]
          },
          { "if": { "all": [{ "var": "wood" }, { "not": { "var": "refinish" } }, { "not": { "f": "workType", "re": "Screen" } }] }, "add": [["Instalação", "Instalar piso de madeira"]] },
          { "if": { "f": "floorMaterial", "re": "LVP|Laminado" }, "add": [["Instalação", "Instalar LVP / laminado"]] },
          { "if": { "f": "floorMaterial", "re": "LVT|VCT|Sheet" }, "add": [["Instalação", "Instalar piso colado (LVT / VCT / sheet)"]] },
          { "if": { "any": [{ "f": "floorMaterial", "has": "Carpete" }, { "f": "workType", "re": "Carpete" }] }, "add": [["Instalação", "Instalar carpete e pad"]] },
          {
            "if": { "any": [{ "f": "workType", "re": "Escada" }, { "f": "trimTransitions", "has": "Stair nosing" }, { "f": "stairs", "filled": true }] },
            "add": [["Instalação", "Degraus e nosing"]]
          },
          {
            "if": { "var": "refinish" },
            "add": [
              ["Preparação e remoção", "Mover móveis"], ["Refinish", "Lixamento (sanding)"], ["Refinish", "Acabamento — 1ª demão"],
              ["Refinish", "Acabamento — demãos finais"]
            ]
          },
          { "if": { "f": "workType", "re": "Screen" }, "add": [["Refinish", "Buffing / screen"], ["Refinish", "Acabamento — demãos finais"]] },
          { "if": { "f": "woodFinish", "re": "Stain" }, "add": [["Refinish", "Stain"]] },
          { "if": { "f": "trimTransitions", "re": "rodapé|Shoe" }, "add": [["Acabamento", "Rodapé / shoe / quarter round"]] },
          { "if": { "any": [{ "f": "trimTransitions", "re": "Transições|Soleiras" }, { "var": "tearout" }] }, "add": [["Acabamento", "Transições e soleiras"]] }
        ],
        "order": [
          "Medição e layout", "Verificar asbesto em piso antigo", "Teste de umidade (madeira / concreto)", "Aclimatar material", "Mover móveis",
          "Proteger áreas e montar contenção de pó", "Remover rodapé / shoe", "Remover vaso / eletrodomésticos", "Remover piso existente", "Descarte do entulho",
          "Parafusar contrapiso (rangidos)", "Trocar / reforçar contrapiso", "Inspeção de contrapiso estrutural (permit)",
          "Nivelar (self-leveler / lixar pontos altos)", "Verificar planicidade (flatness)", "Underlayment / barreira de vapor",
          "Cement board / membrana (tile)", "Instalar piso de madeira", "Instalar LVP / laminado", "Instalar piso colado (LVT / VCT / sheet)",
          "Assentar tile / porcelanato", "Rejuntar (grout) e selar", "Instalar carpete e pad", "Degraus e nosing", "Lixamento (sanding)", "Buffing / screen",
          "Stain", "Acabamento — 1ª demão", "Acabamento — demãos finais", "Rodapé / shoe / quarter round", "Transições e soleiras",
          "Recolocar vaso e eletrodomésticos", "Limpeza final", "Orientar cuidados e tempo de cura", "Punch list com o cliente"
        ]
      },
      inspections: [
        {
          "label": { "pt": "Teste de umidade (madeira / concreto)", "en": "Moisture test (wood / concrete)", "es": "Prueba de humedad (madera / concreto)" },
          "authority": {
            "pt": "NWFA (madeira: piso e contrapiso dentro de 2–4% entre si); concreto: ASTM F2170 (RH) / F1869 dentro do limite do fabricante",
            "en": "NWFA (wood: flooring and subfloor within 2–4% of each other); concrete: ASTM F2170 (RH) / F1869 within the manufacturer's limit",
            "es": "NWFA (madera: piso y contrapiso dentro de 2–4% entre sí); concreto: ASTM F2170 (HR) / F1869 dentro del límite del fabricante"
          },
          "when": {
            "pt": "Antes de instalar madeira ou qualquer piso sobre concreto — anotar leituras",
            "en": "Before installing wood or any flooring over concrete — record readings",
            "es": "Antes de instalar madera o cualquier piso sobre concreto — anotar las lecturas"
          }
        },
        {
          "label": { "pt": "Verificar asbesto em piso antigo", "en": "Check old flooring for asbestos", "es": "Revisar el piso viejo por asbesto" },
          "authority": {
            "pt": "MassDEP 310 CMR 7.15 + DLS: inspetor de asbesto licenciado antes de reformar; acima de 100 sq ft exige notificação e contratante licenciado",
            "en": "MassDEP 310 CMR 7.15 + DLS: licensed asbestos inspector before renovation; over 100 sq ft requires notification and a licensed contractor",
            "es": "MassDEP 310 CMR 7.15 + DLS: inspector de asbesto con licencia antes de la renovación; más de 100 sq ft exige notificación y contratista con licencia"
          },
          "when": {
            "pt": "Tile 9x9, vinil / linóleo antigo ou cola preta (mastic) — não lixar, não quebrar",
            "en": "9x9 tile, old sheet vinyl / linoleum, or black mastic — do not sand or break",
            "es": "Azulejo 9x9, vinilo en rollo / linóleo viejo o mastic negro — no lijar ni romper"
          }
        },
        {
          "label": "Lead-safe (RRP)",
          "authority": { "pt": "EPA RRP; em MA, DLS 454 CMR 22", "en": "EPA RRP; in MA, DLS 454 CMR 22", "es": "EPA RRP; en MA, DLS 454 CMR 22" },
          "when": {
            "pt": "Casa pré-1978: remover rodapé/trim pintado ou lixar piso pintado",
            "en": "Pre-1978 home: removing painted base/trim or sanding painted floors",
            "es": "Casa de antes de 1978: quitar zócalos/molduras pintados o lijar pisos pintados"
          }
        },
        {
          "label": {
            "pt": "Inspeção de contrapiso estrutural (permit)",
            "en": "Structural subfloor inspection (permit)",
            "es": "Inspección estructural del contrapiso (permiso)"
          },
          "authority": {
            "pt": "Building department — em MA, piso estrutural exige CSL + HIC + permit; piso de acabamento é isento (780 CMR 105.2)",
            "en": "Building department — in MA structural flooring requires CSL + HIC + permit; finish flooring is exempt (780 CMR 105.2)",
            "es": "Departamento de construcción — en MA el piso estructural exige CSL + HIC + permiso; el piso de acabado está exento (780 CMR 105.2)"
          },
          "when": {
            "pt": "Troca de contrapiso / vigas; em 3 e 4 famílias pode precisar de permit por fire-resistance",
            "en": "Subfloor / joist replacement; 3- and 4-family homes may need a permit for fire-resistance",
            "es": "Cambio de contrapiso / vigas; casas de 3 y 4 familias pueden necesitar permiso por la resistencia al fuego"
          }
        },
        {
          "label": { "pt": "Verificar planicidade (flatness)", "en": "Check flatness", "es": "Revisar la planitud" },
          "authority": {
            "pt": "Fabricante / TCNA (tile grande formato: 1/8\" em 10 ft)",
            "en": "Manufacturer / TCNA (large-format tile: 1/8\" in 10 ft)",
            "es": "Fabricante / TCNA (azulejo de formato grande: 1/8\" en 10 ft)"
          },
          "when": { "pt": "Antes de instalar — régua de 10 ft", "en": "Before installation — 10 ft straightedge", "es": "Antes de la instalación — regla de 10 ft" }
        }
      ],
      proposal: {
        "title": "FLOORING PROPOSAL",
        "tagline": "PROFESSIONAL FLOORING CONTRACTOR",
        "role": "Flooring Contractor",
        "scopeName": "Flooring",
        "invoiceWork": "flooring",
        "intro": {
          "text": "This proposal covers the flooring scope of work for {what} at {where}. Work will be performed in accordance with the flooring manufacturer's installation instructions, the NWFA Installation Guidelines (wood flooring), the TCNA Handbook and ANSI A108 standards (tile), CRI 105 (carpet), {code} and the requirements of the local Authority Having Jurisdiction.",
          "code": { "MA": "the Massachusetts State Building Code 780 CMR (10th edition),", "*": "the applicable state building code," }
        },
        "sections": [
          {
            "title": "Site Protection & Preparation",
            "keywords": ".",
            "text": "Protect adjacent finished areas; dust containment with plastic barriers where sanding or cutting.\nMove standard furniture out of the work area where listed (pianos, safes, and heavy items by others)."
          },
          {
            "title": "Removal of Existing Flooring",
            "keywords": "remov|tirar|arrancar|existente|velh|antig|old|tear",
            "text": "Remove and dispose of existing flooring, underlayment, and fasteners down to the subfloor; remove and reinstall (or replace) baseboard / shoe molding as listed.\nOld resilient flooring or black mastic suspected to contain asbestos will not be disturbed until tested; abatement, if required, is by a licensed asbestos contractor."
          },
          {
            "title": "Subfloor Preparation & Moisture Testing",
            "keywords": "contrapiso|subfloor|nivel|level|rangid|squeak|umidade|moisture|concreto|concrete|plywood|osb",
            "text": "Moisture-test the subfloor before installation — **wood: pin / pinless meter per NWFA**; **concrete: ASTM F2170 in-situ RH** — and confirm readings are within the manufacturer's limits.\nRe-fasten subfloor to eliminate squeaks; flatten to the manufacturer's tolerance (typically **3/16\" in 10 ft**) by grinding high spots and applying **self-leveling underlayment** at low spots as listed."
          },
          {
            "title": "Hardwood Flooring",
            "keywords": "madeira|hardwood|wood|oak|carvalho|engineered|engenheirad|maple",
            "text": "Acclimate flooring on site per the manufacturer / NWFA guidelines with heat or AC operating.\nInstall {hardwood} (species, width, and grade as listed) over **approved underlayment**, fastened (nailed, glued, or floated as approved for the product) per the NWFA / manufacturer instructions, with expansion space at all walls concealed by base / shoe.",
            "exclude": "screen|recoat|\\bbuff",
            "unless": "refinish|lix(?:a|ar|amento)|\\bsanding\\b|\\bsand(?:ed)? (?:and|&)",
            "unlessExcept": "instal|novo piso|new floor|colocar|assentar|pregar|nail.?down|piso novo"
          },
          {
            "title": "LVP, Laminate & Resilient Flooring",
            "keywords": "lvp|lvt|vinil|vinyl|laminad|laminate|vct|click|flutuante|floating",
            "text": "Install **floating click-lock LVP / laminate** over the manufacturer-approved underlayment, with expansion gaps at walls and transitions per the manufacturer.\nGlue-down LVT / VCT installed with the specified adhesive and rolled per the adhesive manufacturer (typically a 100 lb roller)."
          },
          {
            "title": "Tile & Stone",
            "keywords": "tile|azulejo|porcelanato|porcelain|cer[aâ]mica|pedra|stone|m[aá]rmore|marble|rejunte|grout|ditra",
            "text": "Install **cement backer board** or an **uncoupling membrane** (product as listed) over a code-compliant subfloor.\nSet tile with **polymer-modified thinset** per **ANSI A108 / TCNA Handbook** (minimum 80% coverage, 95% in wet areas), with movement joints at the perimeter per **TCNA EJ171**; grout and seal joints."
          },
          {
            "title": "Carpet",
            "keywords": "carpete|carpet|pad|tack|moquete",
            "text": "Install carpet over **rebond pad** (weight as listed) on tack strip, seamed and **power-stretched per CRI 105**.\nMetal or wood transitions at hard-surface edges."
          },
          {
            "title": "Sanding & Refinishing",
            "keywords": "refinish|lix(?:a|ar|amento)|\\bsanding\\b|\\bsand(?:ed)? (?:and|&)|stain|tingi|verniz|\\bvarnish|bona",
            "text": "Sand hardwood floors to bare wood with dust-containment equipment (grit sequence per the floor's condition); edge and hand-scrape corners.\nApply stain where listed (color approved on a sample on site) and {finishCoats} of {finishType} — light foot traffic and furniture / rugs per the manufacturer's cure times.",
            "exclude": "screen|recoat|\\bbuff"
          },
          {
            "title": "Screen & Recoat",
            "keywords": "screen|recoat|\\bbuff",
            "text": "Clean the floor and abrade (screen / buff) the existing finish without sanding to bare wood; vacuum and tack.\nApply {finishCoats} of {finishType} over the existing finish after an adhesion / compatibility check. No stain or color change; scratches or worn areas that go through the existing finish to bare wood are not removed by a recoat."
          },
          {
            "title": "Trim, Transitions & Final Cleanup",
            "keywords": ".",
            "text": "Install / reinstall baseboard, shoe or quarter round, thresholds, and transition strips (T-molding, reducers, stair nosing) as listed.\nFinal cleanup and walkthrough with the Owner; care and maintenance instructions provided."
          }
        ],
        "defaults": {
          "includes": "all labor, installation supplies, and flooring materials listed above (flooring supplied by Owner unless listed in the Investment section), subfloor preparation as listed, protection of the work area, supervision, debris removal, and applicable {state} sales tax.",
          "notIncluded": "Flooring material unless listed in the Investment section · asbestos testing or abatement of existing flooring or mastic (licensed asbestos contractor) · structural subfloor or joist repair beyond what is listed · self-leveler beyond the quantity listed · moving pianos, safes, heavy furniture, or appliances unless listed · disconnecting / reconnecting plumbing or gas appliances (licensed trades) · painting of baseboard, trim, or walls · moisture mitigation systems for concrete · door trimming beyond standard interior doors · stair rebuilding or railing work.",
          "clarifications": "Owner to approve product, color, and layout direction before installation. Material quantities include a standard waste allowance (typically 5–10%; up to 15% for diagonal or herringbone).\nThe building must be enclosed, with heat / AC operating and wet trades (drywall, plaster, paint) finished before wood flooring is delivered.\nInstallation proceeds only if moisture readings are within the manufacturer's limits; mitigation, if needed, will be quoted as a change order.\nWood is a natural product: color variation and minor seasonal gaps are normal and not defects.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** One (1) year on installation and finishing workmanship from the date of completion. Not covered: damage from water, moisture, pets, furniture without protective pads, or indoor humidity outside the manufacturer's range (typically 30–50% RH for hardwood). Manufacturer product warranties pass through to the Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Tirar o carpete dos três quartos e do corredor, uns 650 pés, parafusar o contrapiso e instalar LVP click com manta. Rodapé novo e transições. Material por nossa conta. Preço 9.800, 30/40/30.”",
          "en": "e.g. “Remove the carpet in three bedrooms and the hallway, about 650 sq ft, re-screw the subfloor and install click LVP with underlayment. New baseboard and transitions. We supply the material. Price 9,800, 30/40/30.”",
          "es": "ej.: “Quitar la alfombra de tres habitaciones y el pasillo, unos 650 pies, volver a atornillar el contrapiso e instalar LVP click con base. Zócalos nuevos y transiciones. El material lo ponemos nosotros. Precio 9,800, 30/40/30.”"
        },
        "aiRules": "Trade: FLOORING contractor (solid / engineered hardwood, LVP / laminate, resilient, tile and stone, carpet, refinishing). Finish flooring needs no building permit (780 CMR 105.2); structural subfloor / joist work does.\nStandards: NWFA Installation Guidelines (wood), TCNA Handbook + ANSI A108 / A118 (tile), CRI 105 (carpet), ASTM F2170 / F1869 (concrete moisture), manufacturer's instructions.\nTypical sections: \"Site Protection & Preparation\", \"Removal of Existing Flooring\", \"Subfloor Preparation & Moisture Testing\", \"Hardwood Flooring\", \"LVP, Laminate & Resilient Flooring\", \"Tile & Stone\", \"Carpet\", \"Sanding & Refinishing\", \"Trim, Transitions & Final Cleanup\".\nQuantities in sq ft (carpet may be in sq yd), base / shoe / transitions in linear feet, stairs per tread. State product details exactly as spoken (species, width, thickness, LVP wear layer in mil, tile size); never invent a brand or color. Waste factor only in Clarifications.\nAlways say who supplies the flooring material; if not spoken, write \"flooring material supplied by Owner\" and add a note asking to confirm.\nOld 9x9 tile, old sheet vinyl, or black mastic: never promise removal before asbestos testing; keep the asbestos exclusion. Solid hardwood is not installed below grade (use engineered or LVP).\nWood: include acclimation and moisture testing. Refinish: number of sanding passes, stain sample approval, number and type of finish coats, and cure times. Screen & recoat is not a full sanding — never call it that.\nAlways exclude: appliance or toilet plumbing disconnection (unless pulling / resetting a toilet is listed), painting trim, concrete moisture mitigation, heavy furniture, structural repairs.\nSpeech terms: \"piso de madeira\" = hardwood, \"taco\" = parquet, \"contrapiso\" = subfloor, \"rodapé\" = baseboard, \"rejunte\" = grout, \"argamassa\" = thinset, \"nivelador / massa niveladora\" = self-leveler, \"elvipí\" = LVP, \"manta\" = underlayment, \"verniz / poliuretano\" = polyurethane finish, \"lixar\" = sand, \"degrau\" = stair tread.\n'Screen & recoat' is NOT sanding: abrade and recoat only (section 'Screen & Recoat'), no stain, no new flooring. Hardwood: 'solid or engineered as listed'. Item line 'Labor and material per the scope above' (no permit unless structural subfloor work). Payment: Deposit / Midpoint / Final (never 'Rough-In').",
        "facts": {
          "hardwood": {
            "pick": [["engineered|engenheirad", "**engineered hardwood**"], ["solid|maci[cç]a|3/4", "**3/4\" solid hardwood**"]],
            "fallback": "**hardwood flooring** (solid or engineered, as listed)"
          },
          "finishCoats": { "count": "coats?|dem[ãa]os?", "gap": 1, "max": 6, "one": "**one (1) coat**", "many": "**{wn} coats**", "fallback": "finish coats as listed" },
          "finishType": {
            "pick": [["water|[aá]gua|waterborne", "**waterborne polyurethane**"], ["oil|[oó]leo", "**oil-modified polyurethane**"], ["hard ?wax", "**hardwax oil**"]],
            "fallback": "**polyurethane finish** (product as listed)"
          }
        },
        "itemNote": "Labor and material per the scope above.",
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to ordering materials."],
            ["Midpoint", "Upon completion of removal, subfloor preparation, and delivery of materials."],
            ["Final Payment", "Upon completion and final walkthrough."]
          ]
        },
        "hic": true,
        "clientRole": "Homeowner",
        "adjustExample": {
          "pt": "Ex.: “Tira o rodapé novo, muda o preço para 9 mil e acrescenta o closet.”",
          "en": "e.g. “Remove the new baseboard, change the price to 9K and add the closet.”",
          "es": "ej.: “Quita los zócalos nuevos, cambia el precio a 9 mil y agrega el clóset.”"
        }
      },
      prices: {
        "stores": [
          { "id": "flooranddecor", "name": "Floor & Decor", "short": "Floor & Decor", "search": "site:flooranddecor.com" },
          "homedepot",
          "lowes",
          { "id": "tileshop", "name": "The Tile Shop", "short": "Tile Shop", "search": "site:tileshop.com" },
          {
            "id": "hardwooddist",
            "name": { "pt": "Distribuidor de madeira (hardwood)", "en": "Hardwood flooring distributor", "es": "Distribuidor de pisos de madera" },
            "short": { "pt": "Hardwood", "en": "Hardwood", "es": "Pisos de madera" },
            "search": "hardwood flooring distributor Massachusetts"
          }
        ],
        "basic": [
          [
            { "pt": "LVP click 6–7 mm (caixa)", "en": "Click LVP 6–7 mm (box)", "es": "LVP click 6–7 mm (caja)" },
            { "pt": "Piso", "en": "Flooring", "es": "Pisos" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Laminado 12 mm (caixa)", "en": "Laminate 12 mm (box)", "es": "Laminado 12 mm (caja)" }, { "pt": "Piso", "en": "Flooring", "es": "Pisos" },
            { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Madeira maciça red oak 3-1/4\" (caixa)", "en": "Solid red oak 3-1/4\" (box)", "es": "Roble rojo sólido 3-1/4\" (caja)" },
            { "pt": "Piso", "en": "Flooring", "es": "Pisos" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Madeira engenheirada (caixa)", "en": "Engineered hardwood (box)", "es": "Madera de ingeniería (caja)" },
            { "pt": "Piso", "en": "Flooring", "es": "Pisos" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [{ "pt": "Porcelanato 12x24 (caixa)", "en": "Porcelain tile 12x24 (box)", "es": "Porcelanato 12x24 (caja)" }, "Tile", { "pt": "caixa", "en": "box", "es": "caja" }],
          [
            { "pt": "Argamassa modificada (thinset) 50 lb", "en": "Modified thinset 50 lb", "es": "Thinset modificado 50 lb" }, "Tile",
            { "pt": "saco", "en": "bag", "es": "bolsa" }
          ],
          [{ "pt": "Rejunte (grout) 25 lb", "en": "Grout 25 lb", "es": "Fragua (grout) 25 lb" }, "Tile", { "pt": "saco", "en": "bag", "es": "bolsa" }],
          [
            { "pt": "Membrana desacopladora (Ditra) — rolo", "en": "Uncoupling membrane (Ditra) — roll", "es": "Membrana desacopladora (Ditra) — rollo" },
            "Tile", { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          ["Cement board 1/2\" 3x5", "Tile", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [
            { "pt": "Nivelador (self-leveler) 50 lb", "en": "Self-leveling underlayment 50 lb", "es": "Autonivelante 50 lb" },
            { "pt": "Contrapiso", "en": "Subfloor", "es": "Contrapiso" }, { "pt": "saco", "en": "bag", "es": "bolsa" }
          ],
          [
            { "pt": "Manta / underlayment LVP (rolo)", "en": "LVP underlayment (roll)", "es": "Base para LVP (rollo)" },
            { "pt": "Contrapiso", "en": "Subfloor", "es": "Contrapiso" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            {
              "pt": "Papel / barreira para madeira (rosin / Aquabar)",
              "en": "Wood floor underlayment paper (rosin / Aquabar)",
              "es": "Papel base para piso de madera (rosin / Aquabar)"
            },
            { "pt": "Contrapiso", "en": "Subfloor", "es": "Contrapiso" },
            { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Underlayment plywood 1/4\" 4x8", "en": "Plywood underlayment 1/4\" 4x8", "es": "Plywood de base 1/4\" 4x8" },
            { "pt": "Contrapiso", "en": "Subfloor", "es": "Contrapiso" }, { "pt": "folha", "en": "sheet", "es": "hoja" }
          ],
          [
            { "pt": "Cleats / grampos de piso 2\" (caixa)", "en": "Flooring cleats / staples 2\" (box)", "es": "Clavos / grapas para piso 2\" (caja)" },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Cola de piso (urethane) — balde", "en": "Urethane flooring adhesive — pail", "es": "Adhesivo de uretano para pisos — cubeta" },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" }, { "pt": "balde", "en": "pail", "es": "cubeta" }
          ],
          [
            { "pt": "Poliuretano à base de água (galão)", "en": "Waterborne polyurethane (gallon)", "es": "Poliuretano a base de agua (galón)" },
            { "pt": "Acabamento", "en": "Finish", "es": "Acabado" }, { "pt": "galão", "en": "gal", "es": "gal" }
          ],
          [
            { "pt": "Lixas para refinish (pacote)", "en": "Floor sanding abrasives (pack)", "es": "Abrasivos para lijar pisos (paquete)" },
            { "pt": "Acabamento", "en": "Finish", "es": "Acabado" }, { "pt": "pacote", "en": "pack", "es": "paquete" }
          ],
          [
            { "pt": "Quarter round / shoe — 8 ft", "en": "Quarter round / shoe — 8 ft", "es": "Cuarto de caña / shoe — 8 ft" },
            { "pt": "Rodapé e transições", "en": "Base & transitions", "es": "Zócalos y transiciones" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Transição T-mold / reducer", "en": "T-molding / reducer", "es": "T-molding / reductor" },
            { "pt": "Rodapé e transições", "en": "Base & transitions", "es": "Zócalos y transiciones" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Carpete + pad (jarda²)", "en": "Carpet + pad (sq yd)", "es": "Alfombra + bajoalfombra (yd²)" },
            { "pt": "Carpete", "en": "Carpet", "es": "Alfombra" }, { "pt": "jarda²", "en": "sq yd", "es": "yd²" }
          ]
        ],
        "basicOffer": [{ "list": "flooring", "label": { "pt": "Adicionar lista básica de piso", "en": "Add basic flooring list", "es": "Agregar lista básica de pisos" } }],
        "promos": false,
        "searchExample": { "pt": "ex.: LVP click, underlayment, T-molding", "en": "e.g. click LVP, underlayment, T-molding", "es": "ej.: LVP click, base, T-molding" }
      },
      groupsI18n: {
        "en": {
          "Preparação e remoção": "Prep & tear-out",
          "Contrapiso": "Subfloor",
          "Instalação": "Installation",
          "Refinish": "Refinishing",
          "Acabamento": "Finish",
          "Inspeções": "Inspections"
        },
        "es": {
          "Preparação e remoção": "Preparación y retiro",
          "Contrapiso": "Contrapiso",
          "Instalação": "Instalación",
          "Refinish": "Refinish",
          "Acabamento": "Acabado",
          "Inspeções": "Inspecciones"
        }
      }
    },
    {
      id: "siding",
      aliases: [],
      order: 80,
      category: "envelope",
      label: "Siding",
      companySuffix: "Siding",
      onboarding: {
        "label": "Siding",
        "desc": { "pt": "Vinil, Hardie, cedar, trim, soffit", "en": "Vinyl, fiber cement, cedar, trim, soffit", "es": "Vinilo, fibrocemento, cedro, molduras, soffit" }
      },
      icon: { "svg": "<path d=\"M3.5 10.5 12 4l8.5 6.5\"/><path d=\"M5.5 9v11.5h13V9\"/><path d=\"M5.5 12.5h13M5.5 15.5h13M5.5 18.5h13\"/>" },
      kind: { "pt": "trabalho de siding", "en": "siding job", "es": "trabajo de siding" },
      stepName: "Siding",
      group: { "label": "Siding", "icon": "trade-siding" },
      workType: [
        { "pt": "Troca completa de siding (re-side)", "en": "Full re-side", "es": "Cambio completo de siding" }, "New Construction",
        { "pt": "Addition (ampliação)", "en": "Addition", "es": "Ampliación (addition)" },
        { "pt": "Reparo / troca parcial", "en": "Repair / partial replacement", "es": "Reparación / cambio parcial" },
        { "pt": "Trim, soffit e fascia", "en": "Trim, soffit & fascia", "es": "Molduras, soffit y fascia" },
        { "pt": "Janelas e portas (com flashing)", "en": "Windows & doors (with flashing)", "es": "Ventanas y puertas (con flashing)" },
        { "pt": "Comercial / multifamily", "en": "Commercial / multifamily", "es": "Comercial / multifamiliar" },
        { "pt": "Calhas e acabamento externo", "en": "Gutters & exterior finish", "es": "Canaletas y acabado exterior" }
      ],
      fields: {
        "sidingMaterial": {
          "label": { "pt": "Material do siding", "en": "Siding material", "es": "Material del siding" },
          "multi": true,
          "opts": [
            { "pt": "Vinil", "en": "Vinyl", "es": "Vinilo" }, { "pt": "Vinil insulado", "en": "Insulated vinyl", "es": "Vinilo aislado" },
            "Fiber cement (James Hardie)", "Engineered wood (LP SmartSide)", "Cedar clapboard", "Cedar shingles",
            { "pt": "Alumínio", "en": "Aluminum", "es": "Aluminio" }, "Board & batten",
            { "pt": "Pedra (stone veneer)", "en": "Stone veneer", "es": "Chapa de piedra" }
          ]
        },
        "profile": {
          "label": { "pt": "Perfil / exposição", "en": "Profile / exposure", "es": "Perfil / exposición" },
          "opts": [
            "Clapboard / lap 4\"", "Dutch lap", { "pt": "Lap 6–7\" de exposição", "en": "Lap 6–7\" exposure", "es": "Lap con exposición de 6–7\"" },
            "Shingles / shakes", { "pt": "Vertical (board & batten)", "en": "Vertical (board & batten)", "es": "Vertical (board & batten)" },
            { "pt": "Painéis", "en": "Panels", "es": "Paneles" }
          ]
        },
        "existingSiding": {
          "label": { "pt": "Siding existente", "en": "Existing siding", "es": "Siding existente" },
          "opts": [
            { "pt": "Sem siding (casa nova)", "en": "None (new construction)", "es": "Ninguno (construcción nueva)" },
            { "pt": "Vinil", "en": "Vinyl", "es": "Vinilo" }, { "pt": "Alumínio", "en": "Aluminum", "es": "Aluminio" },
            { "pt": "Madeira (clapboard / shingle)", "en": "Wood (clapboard / shingle)", "es": "Madera (clapboard / shingle)" },
            { "pt": "Asbesto-cimento (transite) — cuidado", "en": "Asbestos-cement (transite) — caution", "es": "Asbesto-cemento (transite) — cuidado" },
            "Fiber cement"
          ]
        },
        "removalType": {
          "label": { "pt": "Remoção", "en": "Removal", "es": "Retiro" },
          "opts": [
            { "pt": "Remover tudo até o sheathing", "en": "Full tear-off to sheathing", "es": "Retiro completo hasta el sheathing" },
            { "pt": "Instalar por cima (over existing)", "en": "Install over existing", "es": "Instalar sobre el existente" },
            { "pt": "Remoção parcial", "en": "Partial removal", "es": "Retiro parcial" },
            { "pt": "Não se aplica (casa nova)", "en": "N/A (new construction)", "es": "N/A (construcción nueva)" }
          ]
        },
        "sheathing": {
          "label": { "pt": "Sheathing (chapeamento)", "en": "Sheathing", "es": "Sheathing (forro)" },
          "opts": [
            { "pt": "OK — só inspecionar", "en": "OK — inspect only", "es": "OK — solo inspeccionar" },
            { "pt": "Trocar áreas podres", "en": "Replace rotted areas", "es": "Cambiar las partes podridas" },
            { "pt": "Sheathing novo (OSB / plywood)", "en": "New sheathing (OSB / plywood)", "es": "Sheathing nuevo (OSB / plywood)" },
            { "pt": "Isolamento rígido contínuo (foam)", "en": "Continuous rigid insulation (foam)", "es": "Aislamiento rígido continuo (espuma)" },
            "Zip System"
          ]
        },
        "wrb": {
          "label": { "pt": "Barreira (WRB)", "en": "Water-resistive barrier (WRB)", "es": "Barrera resistente al agua (WRB)" },
          "opts": [
            "House wrap (Tyvek / Typar)", "Drainable wrap (DrainWrap)",
            { "pt": "Zip System (barreira no sheathing)", "en": "Zip System (integrated WRB)", "es": "Zip System (WRB integrado)" },
            { "pt": "Rainscreen com furring", "en": "Rainscreen with furring strips", "es": "Rainscreen con listones (furring)" },
            { "pt": "Feltro asfáltico #15", "en": "#15 asphalt felt", "es": "Fieltro asfáltico #15" }
          ]
        },
        "trimMaterial": {
          "label": "Trim",
          "multi": true,
          "opts": [
            "PVC (AZEK / Royal)", "Fiber cement (HardieTrim)", { "pt": "Madeira (pine / cedar)", "en": "Wood (pine / cedar)", "es": "Madera (pino / cedro)" },
            { "pt": "Capeamento de alumínio (coil)", "en": "Aluminum coil capping", "es": "Forrado con lámina de aluminio (coil)" }, "LP SmartSide trim"
          ]
        },
        "eaves": {
          "label": { "pt": "Beiral (soffit, fascia, calhas)", "en": "Eaves (soffit, fascia, gutters)", "es": "Aleros (soffit, fascia, canaletas)" },
          "multi": true,
          "opts": [
            { "pt": "Soffit vinil ventilado", "en": "Vented vinyl soffit", "es": "Soffit de vinilo ventilado" },
            { "pt": "Soffit alumínio", "en": "Aluminum soffit", "es": "Soffit de aluminio" },
            { "pt": "Soffit fiber cement", "en": "Fiber cement soffit", "es": "Soffit de fibrocemento" },
            { "pt": "Fascia alumínio (wrap)", "en": "Aluminum fascia wrap", "es": "Forrado de fascia en aluminio" },
            { "pt": "Fascia PVC", "en": "PVC fascia", "es": "Fascia de PVC" },
            { "pt": "Remover e recolocar calhas", "en": "Remove & reinstall gutters", "es": "Quitar y reinstalar canaletas" },
            { "pt": "Calhas novas (seamless)", "en": "New seamless gutters", "es": "Canaletas nuevas sin costura" },
            { "pt": "Manter existente", "en": "Keep existing", "es": "Mantener las existentes" }
          ]
        },
        "windows": {
          "label": { "pt": "Janelas e portas", "en": "Windows & doors", "es": "Ventanas y puertas" },
          "opts": [
            { "pt": "Sem mudança", "en": "No change", "es": "Sin cambio" },
            { "pt": "Só capeamento do trim", "en": "Trim capping only", "es": "Solo forrar las molduras" },
            { "pt": "Reflash das existentes", "en": "Reflash existing", "es": "Rehacer el flashing existente" },
            { "pt": "Trocar janelas (replacement)", "en": "Replacement windows", "es": "Ventanas de reemplazo" },
            { "pt": "Janelas novas (nail fin)", "en": "New-construction windows (nail fin)", "es": "Ventanas de construcción nueva (nail fin)" }
          ]
        },
        "flashing": {
          "label": "Flashing",
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Fita de flashing nas janelas", "en": "Window flashing tape", "es": "Cinta de flashing para ventanas" }, "Z-flashing / drip cap",
            "Kick-out flashing", "Step flashing", { "pt": "Head flashing de portas", "en": "Door head flashing", "es": "Flashing superior de puertas" },
            "Sill pan"
          ]
        },
        "finishType": {
          "label": { "pt": "Acabamento / cor", "en": "Finish / color", "es": "Acabado / color" },
          "opts": [
            { "pt": "Cor de fábrica (vinil)", "en": "Factory color (vinyl)", "es": "Color de fábrica (vinilo)" },
            { "pt": "Pré-pintado de fábrica (ColorPlus)", "en": "Factory prefinished (ColorPlus)", "es": "Prefinished de fábrica (ColorPlus)" },
            { "pt": "Primed — pintar no local", "en": "Primed — field paint", "es": "Con primer — pintar en obra" },
            { "pt": "Cedar natural / stain", "en": "Natural cedar / stain", "es": "Cedro natural / tinte" },
            { "pt": "Pintura por outros", "en": "Painting by others", "es": "Pintura por otros" }
          ]
        },
        "leadAge": {
          "label": { "pt": "Ano da casa (chumbo)", "en": "Year built (lead)", "es": "Año de construcción (plomo)" },
          "opts": [
            { "pt": "Antes de 1978 (RRP lead-safe)", "en": "Before 1978 (RRP lead-safe)", "es": "Antes de 1978 (RRP, seguro contra plomo)" },
            { "pt": "1978 ou depois", "en": "1978 or later", "es": "1978 o después" },
            { "pt": "Não sei (testar)", "en": "Unknown (test)", "es": "Desconocido (hacer prueba)" }
          ]
        }
      },
      text: [
        { "key": "wallArea", "label": { "pt": "Área de parede (squares)", "en": "Wall area (squares)", "es": "Área de paredes (squares)" }, "unit": "sq", "type": "number" },
        {
          "key": "trimLf",
          "label": { "pt": "Trim e cantos (linear ft)", "en": "Trim & corners (linear ft)", "es": "Molduras y esquinas (pies lineales)" },
          "unit": "lf",
          "type": "number"
        },
        {
          "key": "openings",
          "label": { "pt": "Janelas e portas (quantidade)", "en": "Windows & doors (count)", "es": "Ventanas y puertas (cantidad)" },
          "unit": "ea",
          "type": "number"
        },
        {
          "key": "productColor",
          "label": { "pt": "Produto / cor (ex.: Hardie Arctic White)", "en": "Product / color (e.g. Hardie Arctic White)", "es": "Producto / color (ej.: Hardie Arctic White)" }
        }
      ],
      units: [
        { "id": "sq", "label": { "pt": "square (100 sq ft)", "en": "square (100 sq ft)", "es": "square (100 sq ft)" } }, { "id": "sqft", "label": "sq ft" },
        { "id": "lf", "label": { "pt": "pés lineares (lf)", "en": "linear ft", "es": "pie lineal" } },
        { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }, { "id": "pc", "label": { "pt": "peça", "en": "piece", "es": "pieza" } },
        { "id": "box", "label": { "pt": "caixa", "en": "box", "es": "caja" } }, { "id": "roll", "label": { "pt": "rolo", "en": "roll", "es": "rollo" } },
        { "id": "bundle", "label": { "pt": "fardo (bundle)", "en": "bundle", "es": "paquete" } }
      ],
      tasks: {
        "Preparação": [
          { "pt": "Proteção de paisagismo, janelas e AC", "en": "Protect landscaping, windows & AC unit", "es": "Proteger jardines, ventanas y la unidad de AC" },
          { "pt": "Contenção lead-safe (RRP)", "en": "Lead-safe containment (RRP)", "es": "Contención segura contra plomo (RRP)" },
          { "pt": "Remover calhas, luzes e obstáculos", "en": "Remove gutters, lights & obstructions", "es": "Quitar canaletas, lámparas y obstáculos" },
          { "pt": "Staging / andaime", "en": "Staging / scaffolding", "es": "Andamios" }
        ],
        "Remoção e sheathing": [
          { "pt": "Remover siding existente", "en": "Remove existing siding", "es": "Quitar el siding existente" },
          { "pt": "Descarte / dumpster", "en": "Disposal / dumpster", "es": "Desecho / dumpster" },
          { "pt": "Inspecionar sheathing", "en": "Inspect sheathing", "es": "Inspeccionar el sheathing" },
          { "pt": "Trocar / instalar sheathing", "en": "Replace / install sheathing", "es": "Cambiar / instalar sheathing" },
          { "pt": "Isolamento rígido contínuo", "en": "Continuous rigid insulation", "es": "Aislamiento rígido continuo" }
        ],
        "Barreira e flashing": [
          "House wrap / WRB", { "pt": "Flashing de janelas e portas", "en": "Window & door flashing", "es": "Flashing de ventanas y puertas" },
          "Kick-out flashing", "Z-flashing / drip cap", "Starter strip"
        ],
        "Instalação": [
          { "pt": "Cantos (outside / inside corners)", "en": "Outside / inside corners", "es": "Esquinas exteriores / interiores" },
          { "pt": "Trim de janelas e portas", "en": "Window & door trim", "es": "Molduras de ventanas y puertas" },
          { "pt": "Instalar siding", "en": "Install siding", "es": "Instalar el siding" },
          "Soffit",
          "Fascia",
          {
            "pt": "Mounting blocks (luzes, tomadas, torneiras)",
            "en": "Mounting blocks (lights, outlets, hose bibs)",
            "es": "Bloques de montaje (lámparas, tomacorrientes, llaves de manguera)"
          },
          { "pt": "Trocar janelas / portas", "en": "Replace windows / doors", "es": "Cambiar ventanas / puertas" }
        ],
        "Acabamento": [
          { "pt": "Calafetar juntas (caulk)", "en": "Caulk joints", "es": "Calafatear juntas" },
          { "pt": "Pintura / retoque de corte (fiber cement)", "en": "Paint / touch up cut edges (fiber cement)", "es": "Pintar / retocar los cortes (fibrocemento)" },
          { "pt": "Recolocar calhas, luzes e itens", "en": "Reinstall gutters, lights & fixtures", "es": "Reinstalar canaletas, lámparas y accesorios" },
          { "pt": "Calhas novas (gutters)", "en": "New gutters", "es": "Canaletas nuevas" },
          { "pt": "Limpeza (ímã de pregos)", "en": "Cleanup (magnetic nail sweep)", "es": "Limpieza (barrido magnético de clavos)" },
          { "pt": "Punch list com o cliente", "en": "Punch list walkthrough with owner", "es": "Recorrido de punch list con el dueño" }
        ],
        "Inspeções": [
          { "pt": "Permit de building", "en": "Building permit", "es": "Permiso de construcción" },
          { "pt": "Teste de chumbo / asbesto (casa antiga)", "en": "Lead / asbestos test (older home)", "es": "Prueba de plomo / asbesto (casa antigua)" },
          { "pt": "Inspeção de house wrap / flashing", "en": "House wrap / flashing inspection", "es": "Inspección de house wrap / flashing" },
          { "pt": "Verificação de limpeza RRP", "en": "RRP cleaning verification", "es": "Verificación de limpieza RRP" },
          { "pt": "Inspeção final", "en": "Final inspection", "es": "Inspección final" }
        ]
      },
      suggest: {
        "vars": {
          "tearoff": { "any": [{ "f": "removalType", "re": "Remover tudo|parcial" }, { "f": "workType", "re": "Troca completa" }] },
          "newWall": { "any": [{ "var": "newish" }, { "f": "removalType", "re": "Remover tudo" }, { "f": "workType", "re": "Troca completa" }] },
          "pre78": { "f": "leadAge", "re": "Antes de 1978" }
        },
        "rules": [
          {
            "add": [
              ["Preparação", "Proteção de paisagismo, janelas e AC"], ["Acabamento", "Calafetar juntas (caulk)"], ["Acabamento", "Limpeza (ímã de pregos)"],
              ["Acabamento", "Punch list com o cliente"]
            ]
          },
          {
            "if": { "not": { "f": "workType", "re": "^Trim|Calhas|^Janelas" } },
            "add": [["Barreira e flashing", "Starter strip"], ["Instalação", "Cantos (outside / inside corners)"], ["Instalação", "Instalar siding"]]
          },
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Inspeções", "Permit de building"], ["Inspeções", "Inspeção final"]] },
          {
            "if": { "any": [{ "f": "leadAge", "re": "Antes de 1978|Não sei" }, { "f": "existingSiding", "re": "Asbesto" }] },
            "add": [["Inspeções", "Teste de chumbo / asbesto (casa antiga)"]]
          },
          { "if": { "var": "pre78" }, "add": [["Preparação", "Contenção lead-safe (RRP)"], ["Inspeções", "Verificação de limpeza RRP"]] },
          {
            "if": { "var": "tearoff" },
            "add": [
              ["Preparação", "Remover calhas, luzes e obstáculos"], ["Remoção e sheathing", "Remover siding existente"],
              ["Remoção e sheathing", "Descarte / dumpster"], ["Remoção e sheathing", "Inspecionar sheathing"],
              ["Acabamento", "Recolocar calhas, luzes e itens"]
            ]
          },
          {
            "if": { "all": [{ "var": "newWall" }, { "not": { "f": "wrb", "re": "Zip" } }, { "not": { "f": "sheathing", "re": "Zip" } }] },
            "add": [["Barreira e flashing", "House wrap / WRB"]]
          },
          {
            "if": { "var": "newWall" },
            "add": [
              ["Barreira e flashing", "Flashing de janelas e portas"], ["Barreira e flashing", "Z-flashing / drip cap"],
              ["Instalação", "Mounting blocks (luzes, tomadas, torneiras)"]
            ]
          },
          { "if": { "all": [{ "var": "newWall" }, { "f": "permit", "re": "Sim" }] }, "add": [["Inspeções", "Inspeção de house wrap / flashing"]] },
          { "if": { "f": "sheathing", "re": "Trocar|novo|Zip" }, "add": [["Remoção e sheathing", "Trocar / instalar sheathing"]] },
          { "if": { "f": "sheathing", "re": "rígido" }, "add": [["Remoção e sheathing", "Isolamento rígido contínuo"]] },
          {
            "if": { "any": [{ "f": "windows", "re": "Reflash|Trocar|novas" }, { "f": "flashing", "re": "janelas|Head|Sill" }] },
            "add": [["Barreira e flashing", "Flashing de janelas e portas"]]
          },
          { "if": { "f": "windows", "re": "Trocar|novas" }, "add": [["Instalação", "Trocar janelas / portas"]] },
          {
            "if": { "any": [{ "f": "trimMaterial", "filled": true }, { "f": "windows", "re": "capeamento|Reflash|Trocar|novas" }] },
            "add": [["Instalação", "Trim de janelas e portas"]]
          },
          { "if": { "f": "flashing", "has": "Kick-out flashing" }, "add": [["Barreira e flashing", "Kick-out flashing"]] },
          { "if": { "f": "flashing", "has": "Z-flashing / drip cap" }, "add": [["Barreira e flashing", "Z-flashing / drip cap"]] },
          { "if": { "f": "eaves", "re": "Soffit" }, "add": [["Instalação", "Soffit"]] },
          { "if": { "f": "eaves", "re": "Fascia" }, "add": [["Instalação", "Fascia"]] },
          {
            "if": { "f": "eaves", "re": "Remover e recolocar" },
            "add": [["Preparação", "Remover calhas, luzes e obstáculos"], ["Acabamento", "Recolocar calhas, luzes e itens"]]
          },
          {
            "if": { "any": [{ "f": "eaves", "re": "Calhas novas" }, { "f": "workType", "re": "Calhas" }] },
            "add": [["Preparação", "Remover calhas, luzes e obstáculos"], ["Acabamento", "Calhas novas (gutters)"]]
          },
          { "if": { "any": [{ "f": "floors", "re": "^[2-5]" }, { "f": "access", "has": "Precisa de elevador / andaime" }] }, "add": [["Preparação", "Staging / andaime"]] },
          {
            "if": { "any": [{ "f": "finishType", "re": "Primed" }, { "f": "sidingMaterial", "re": "Fiber cement|Engineered" }] },
            "add": [["Acabamento", "Pintura / retoque de corte (fiber cement)"]]
          }
        ],
        "order": [
          "Permit de building", "Teste de chumbo / asbesto (casa antiga)", "Proteção de paisagismo, janelas e AC", "Contenção lead-safe (RRP)",
          "Staging / andaime", "Remover calhas, luzes e obstáculos", "Remover siding existente", "Descarte / dumpster", "Inspecionar sheathing",
          "Trocar / instalar sheathing", "Isolamento rígido contínuo", "House wrap / WRB", "Trocar janelas / portas", "Flashing de janelas e portas",
          "Kick-out flashing", "Z-flashing / drip cap", "Inspeção de house wrap / flashing", "Starter strip", "Cantos (outside / inside corners)",
          "Trim de janelas e portas", "Soffit", "Fascia", "Mounting blocks (luzes, tomadas, torneiras)", "Instalar siding", "Calafetar juntas (caulk)",
          "Pintura / retoque de corte (fiber cement)", "Recolocar calhas, luzes e itens", "Calhas novas (gutters)", "Limpeza (ímã de pregos)",
          "Verificação de limpeza RRP", "Inspeção final", "Punch list com o cliente"
        ]
      },
      inspections: [
        {
          "label": { "pt": "Permit de building", "en": "Building permit", "es": "Permiso de construcción" },
          "authority": {
            "pt": "Building department (780 CMR) — em MA, siding exige CSL + HIC + permit; em NH, a prefeitura local",
            "en": "Building department (780 CMR) — in MA siding requires CSL + HIC + permit; in NH, the local town",
            "es": "Departamento de construcción (780 CMR) — en MA el siding exige CSL + HIC + permiso; en NH, el municipio"
          },
          "when": {
            "pt": "Antes de começar; o permit em MA pede onde o entulho será descartado (debris affidavit)",
            "en": "Before starting; MA permits ask where debris will be disposed of (debris affidavit)",
            "es": "Antes de empezar; los permisos de MA preguntan dónde se van a desechar los escombros (debris affidavit)"
          }
        },
        {
          "label": { "pt": "Teste de chumbo / asbesto (casa antiga)", "en": "Lead / asbestos test (older home)", "es": "Prueba de plomo / asbesto (casa antigua)" },
          "authority": {
            "pt": "Chumbo: EPA RRP / DLS 454 CMR 22. Asbesto-cimento (transite): MassDEP — notificação ANF-001 10 dias úteis antes da remoção",
            "en": "Lead: EPA RRP / DLS 454 CMR 22. Asbestos-cement (transite): MassDEP — ANF-001 notification 10 working days before removal",
            "es": "Plomo: EPA RRP / DLS 454 CMR 22. Asbesto-cemento (transite): MassDEP — notificación ANF-001 10 días hábiles antes del retiro"
          },
          "when": {
            "pt": "Antes de orçar a remoção em casa pré-1978 ou com shingle de transite",
            "en": "Before pricing removal on a pre-1978 home or one with transite shingles",
            "es": "Antes de cotizar el retiro en una casa de antes de 1978 o con shingles de transite"
          }
        },
        {
          "label": { "pt": "Inspeção de house wrap / flashing", "en": "House wrap / flashing inspection", "es": "Inspección de house wrap / flashing" },
          "authority": {
            "pt": "Building inspector (alguns municípios pedem antes de cobrir)",
            "en": "Building inspector (some towns require it before cover-up)",
            "es": "Inspector de construcción (algunos municipios lo exigen antes de cubrir)"
          },
          "when": {
            "pt": "Wrap e flashing instalados, antes do siding",
            "en": "Wrap and flashing installed, before siding",
            "es": "Wrap y flashing instalados, antes del siding"
          }
        },
        {
          "label": { "pt": "Verificação de limpeza RRP", "en": "RRP cleaning verification", "es": "Verificación de limpieza RRP" },
          "authority": { "pt": "Certified renovator da empresa", "en": "Firm's certified renovator", "es": "Renovador certificado de la empresa" },
          "when": {
            "pt": "Fim da obra em casa pré-1978 (mais de 20 sq ft de exterior perturbado)",
            "en": "End of job on a pre-1978 home (more than 20 sq ft of exterior disturbed)",
            "es": "Final de la obra en casa de antes de 1978 (más de 20 sq ft de exterior alterado)"
          }
        },
        {
          "label": { "pt": "Inspeção final", "en": "Final inspection", "es": "Inspección final" },
          "authority": { "pt": "Building inspector", "en": "Building inspector", "es": "Inspector de construcción" },
          "when": {
            "pt": "Siding, trim, flashing e calhas concluídos",
            "en": "Siding, trim, flashing, and gutters complete",
            "es": "Siding, molduras, flashing y canaletas completos"
          }
        }
      ],
      proposal: {
        "title": "SIDING PROPOSAL",
        "tagline": "SIDING & EXTERIOR CONTRACTOR",
        "role": "Siding Contractor",
        "scopeName": "Siding",
        "invoiceWork": "siding",
        "intro": {
          "text": "This proposal covers the siding and exterior trim scope of work for {what} at {where}. Work will be performed in accordance with the manufacturer's installation instructions (ASTM D4756 and the VSI installation manual for vinyl siding; James Hardie HZ5 instructions for fiber cement), {code} and the requirements of the local Authority Having Jurisdiction.",
          "code": {
            "MA": "the Massachusetts State Building Code 780 CMR (10th edition) for wall coverings, water-resistive barriers, and flashing, and — for buildings constructed before 1978 — the EPA RRP Rule (40 CFR 745) and 454 CMR 22.00,",
            "*": "the applicable state building code for wall coverings, water-resistive barriers, and flashing, the EPA RRP Rule (40 CFR 745) for buildings constructed before 1978,"
          }
        },
        "sections": [
          {
            "title": "Site Protection & Staging",
            "keywords": ".",
            "text": "Protect landscaping, walkways, windows, and HVAC equipment; staging and ladders as required.\nRemove and reinstall gutters, downspouts, exterior lights, shutters, and attachments as needed for the work."
          },
          {
            "title": "Removal of Existing Siding",
            "keywords": "remov|tirar|arrancar|velh|antig|existing|old|tear.?off",
            "text": "Remove existing siding and trim down to the sheathing; all debris removed from site (dumpster included).\nInspect sheathing with the Owner; replacement of rotted sheathing is priced per sheet in the Investment section.\n[MA] Asbestos-cement (transite) siding, if present, is removed only by a licensed contractor after MassDEP notification (not included unless listed).\n[!MA] Asbestos-cement (transite) siding, if present, is removed only by a licensed contractor after notification to the state environmental agency (not included unless listed)."
          },
          {
            "title": "Weather-Resistive Barrier & Flashing",
            "keywords": "house ?wrap|tyvek|typar|wrap|barreira|flash|fita|tape|kick.?out|z.?flash|drip",
            "text": "Install {wrap} lapped shingle-style, with seams taped per the manufacturer.\nFlash all windows and doors with **flexible flashing tape** (sill, jambs, head — shingle-lapped); **kick-out flashing** at roof-to-wall intersections and **Z-flashing / drip cap** over trim and at horizontal joints."
          },
          {
            "title": "Siding Installation",
            "keywords": ".",
            "text": "Furnish and install new lap siding (product, profile, exposure, and color as listed in the Investment section) per the manufacturer's instructions, with starter strip and outside / inside corners.\nVinyl: fastened in the center of the nailing slots and hung loose (approx. **1/32\"** under the nail head) with expansion gaps at corners and trim. Fiber cement: fastened per **James Hardie HZ5** instructions, **1/8\"** gaps at trim sealed, **6\"** clearance above grade and **2\"** above roofs and decks, cut edges sealed."
          },
          {
            "title": "Trim, Corners & Window Casings",
            "keywords": "trim|canto|corner|azek|pvc|capping|capeamento|coil|casing|moldura",
            "text": "Furnish and install {trim} at corners, windows, doors, frieze, and rake as listed.\nMounting blocks for exterior lights, receptacles, hose bibs, and vents."
          },
          {
            "title": "Soffit & Fascia",
            "keywords": "soffit|sofite|fascia|f[aá]scia|beiral|eave",
            "text": "Install **vented vinyl / aluminum soffit** and **aluminum fascia wrap** (or PVC fascia) to match the siding; maintain or improve soffit ventilation."
          },
          {
            "title": "Windows & Doors",
            "keywords": "janela|window|porta|door",
            "text": "Remove and replace the windows / doors listed in the Investment section, installed, shimmed, insulated, and flashed per the manufacturer and **ASTM E2112**.\nInterior trim and finish around replaced units are not included unless listed."
          },
          {
            "title": "Caulking, Paint & Gutters",
            "keywords": "calafet|caulk|pint|paint|gutter|calha|retoque|touch",
            "text": "Seal joints at trim and penetrations with **high-performance sealant** compatible with the siding.\nFiber cement: touch up cut edges and nail heads with the manufacturer's touch-up kit (prefinished) or field paint where listed.\nReinstall existing gutters, or install new **seamless aluminum gutters** where listed."
          },
          {
            "title": "Permit, Inspections & Cleanup",
            "keywords": ".",
            "text": "Building permit will be pulled by us. Permit fees are included.\nDaily cleanup, magnetic nail sweep of the yard and driveway, and final walkthrough with the Owner."
          }
        ],
        "defaults": {
          "includes": "all labor, siding, trim, house wrap, flashing, and materials listed above, staging, dumpster and debris removal, supervision, applicable {state} sales tax, and building permit fees.",
          "notIncluded": "Rotted sheathing, framing, or structural repairs beyond the unit prices listed · window or door replacement unless listed · painting of primed products unless listed · gutters unless listed · electrical work (relocating lights, receptacles, or the meter — by a licensed electrician) · utility coordination (electric service, gas meter, cable) · asbestos-cement siding removal or abatement · lead abatement (RRP lead-safe practices only) · interior repairs or trim · landscaping repair beyond reasonable care.",
          "clarifications": "Building permit will be pulled by {brand}. **Permit fees are included.**\n[MA] In Massachusetts, siding work on 1–4 family homes is performed under a Construction Supervisor License (CSL) and Home Improvement Contractor (HIC) registration.\nHidden conditions (rotted sheathing, framing, or trim) will be shown to the Owner before closing up and billed at the unit prices listed or as a change order.\nOwner to approve product, profile, and color in writing before materials are ordered; special-order materials are non-returnable.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** Five (5) years on installation workmanship (fastening, flashing, and water-tightness at our work) from the date of completion. Manufacturer product warranties (e.g., lifetime limited for vinyl, 30-year for James Hardie siding) pass through to the Owner, subject to registration with the manufacturer.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Tirar o vinil velho da casa toda, umas 22 squares, Tyvek novo, flashing nas janelas, Hardie Plank ColorPlus cor Arctic White, trim de AZEK, soffit ventilado e fascia de alumínio. Casa de 1965. Preço 48 mil, 30/40/30.”",
          "en": "e.g. “Tear off the old vinyl on the whole house, about 22 squares, new Tyvek, window flashing, Hardie Plank ColorPlus in Arctic White, AZEK trim, vented soffit and aluminum fascia. House from 1965. Price 48,000, 30/40/30.”",
          "es": "ej.: “Quitar el vinilo viejo de toda la casa, unos 22 squares, Tyvek nuevo, flashing en las ventanas, Hardie Plank ColorPlus color Arctic White, molduras AZEK, soffit ventilado y fascia de aluminio. Casa de 1965. Precio 48,000, 30/40/30.”"
        },
        "aiRules": "Trade: SIDING / exterior envelope contractor (vinyl, fiber cement, engineered wood, cedar, PVC trim, soffit / fascia, windows and flashing, house wrap, gutters).\nCodes: 780 CMR in MA (IRC Ch. 7 — WRB and flashing at openings; kick-out flashing at roof-wall intersections), ASTM D4756 / VSI manual for vinyl, James Hardie HZ5 for fiber cement, ASTM E2112 for windows; EPA RRP for pre-1978 homes. In MA siding requires a building permit, CSL, and HIC.\nTypical sections: \"Site Protection & Staging\", \"Removal of Existing Siding\", \"Weather-Resistive Barrier & Flashing\", \"Siding Installation\", \"Trim, Corners & Window Casings\", \"Soffit & Fascia\", \"Windows & Doors\", \"Caulking, Paint & Gutters\", \"Permit, Inspections & Cleanup\".\nQuantities: wall area in squares (1 square = 100 sq ft) — e.g. \"approx. 22 squares\"; trim, corners, fascia, and gutters in linear feet; windows and doors each. Never show a waste percentage in the client document.\nState product, profile / exposure, color, and trim material exactly as spoken; never invent a brand or color.\nAlways add a hidden-conditions clause: rotted sheathing priced per sheet (4x8) and framing / trim per linear foot, or as a change order.\nAsbestos-cement (transite) siding: never include removal unless spoken; it needs a licensed contractor and MassDEP notification.\nAlways exclude: electrical (moving lights, receptacles, meter), utility coordination, painting of primed products unless listed, gutters unless listed, window replacement unless listed, interior repairs.\nMA owner-occupied 1–4 family homes (HIC law, M.G.L. c.142A): deposit max one-third of the price unless for special-order materials — prefer 30/40/30 or thirds.\nSpeech terms: \"réidi / hardi\" = James Hardie fiber cement, \"taivéc\" = Tyvek house wrap, \"sófit\" = soffit, \"fáscia\" = fascia, \"capeamento / coil\" = aluminum coil capping, \"jota\" = J-channel, \"canto\" = corner post, \"calha\" = gutter, \"beiral\" = eave, \"square / quadrado\" = 100 sq ft, \"chapa / compensado\" = sheathing.\nPayment milestones: Deposit / Tear-Off & Wrap / Final (never 'Rough-In'). Cite the CSL / HIC requirement and MassDEP only for Massachusetts companies. When the product is James Hardie ColorPlus, mention the 15-year ColorPlus finish warranty.",
        "facts": {
          "wrap": {
            "pick": [
              ["drain ?wrap", "**Tyvek DrainWrap**"], ["tyvek", "**Tyvek HomeWrap**"], ["typar", "**Typar** house wrap"],
              ["\\bzip\\b", "**ZIP System** sheathing with taped seams (integrated WRB)"],
              ["rain ?screen|furring", "house wrap over a **rainscreen** furring gap"]
            ],
            "fallback": "**house wrap** (product as listed)"
          },
          "trim": {
            "pick": [
              ["azek", "**PVC trim (AZEK)**"], ["royal", "**PVC trim (Royal)**"], ["hardie ?trim|fiber cement trim", "**fiber cement trim (HardieTrim)**"],
              ["smart ?side", "**LP SmartSide trim**"], ["\\bpvc\\b", "**PVC trim**"],
              ["coil|capeamento|capping|capear", "**aluminum coil capping** of existing trim"]
            ],
            "fallback": "trim (material as listed)"
          }
        },
        "jobVariants": [
          {
            "match": "color ?plus",
            "defaults": {
              "warranty": "**Workmanship Warranty:** Five (5) years on installation workmanship (fastening, flashing, and water-tightness at our work) from the date of completion. Manufacturer product warranties (e.g., lifetime limited for vinyl, 30-year for James Hardie siding) pass through to the Owner, subject to registration with the manufacturer.\n**ColorPlus Finish:** James Hardie ColorPlus Technology prefinished boards carry a 15-year limited finish warranty (paint / finish), in addition to the siding product warranty, subject to the manufacturer's terms.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
            }
          }
        ],
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to ordering materials."],
            ["Tear-Off & Wrap", "Upon completion of removal, sheathing repairs, house wrap, and window flashing."],
            ["Final Payment", "Upon completion, final inspection, and cleanup."]
          ]
        },
        "hic": true,
        "clientRole": "Homeowner",
        "adjustExample": {
          "pt": "Ex.: “Tira os gutters, muda o preço para 45 mil e acrescenta trocar 3 janelas.”",
          "en": "e.g. “Remove the gutters, change the price to 45K and add 3 window replacements.”",
          "es": "ej.: “Quita las canaletas, cambia el precio a 45 mil y agrega 3 ventanas de reemplazo.”"
        }
      },
      prices: {
        "stores": ["abcsupply", { "id": "beacon", "name": "Beacon (QXO)", "short": "Beacon", "search": "site:becn.com" }, "homedepot", "lowes", "lumberyard"],
        "basic": [
          [{ "pt": "Siding vinil D4 (square)", "en": "Vinyl siding D4 (square)", "es": "Siding de vinilo D4 (square)" }, "Siding", "square"],
          [
            {
              "pt": "Hardie Plank lap 8,25\" x 12 ft (primed)",
              "en": "Hardie Plank lap 8.25\" x 12 ft (primed)",
              "es": "Hardie Plank lap 8.25\" x 12 ft (con primer)"
            },
            "Siding",
            { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "Hardie Plank ColorPlus 8,25\" x 12 ft", "en": "Hardie Plank ColorPlus 8.25\" x 12 ft", "es": "Hardie Plank ColorPlus 8.25\" x 12 ft" },
            "Siding", { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          ["LP SmartSide lap 8\" x 16 ft", "Siding", { "pt": "peça", "en": "piece", "es": "pieza" }],
          [
            { "pt": "Cedar shingles (fardo)", "en": "Cedar shingles (bundle)", "es": "Shingles de cedro (paquete)" }, "Siding",
            { "pt": "fardo", "en": "bundle", "es": "paquete" }
          ],
          ["House wrap Tyvek 9 x 150 ft", { "pt": "Barreira e flashing", "en": "WRB & flashing", "es": "WRB y flashing" }, { "pt": "rolo", "en": "roll", "es": "rollo" }],
          [
            { "pt": "Fita de flashing 6\" (rolo)", "en": "Flashing tape 6\" (roll)", "es": "Cinta de flashing 6\" (rollo)" },
            { "pt": "Barreira e flashing", "en": "WRB & flashing", "es": "WRB y flashing" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Fita de costura do house wrap", "en": "House wrap seam tape", "es": "Cinta para uniones de house wrap" },
            { "pt": "Barreira e flashing", "en": "WRB & flashing", "es": "WRB y flashing" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          ["Kick-out flashing", { "pt": "Barreira e flashing", "en": "WRB & flashing", "es": "WRB y flashing" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          ["Z-flashing / drip cap 10 ft", { "pt": "Barreira e flashing", "en": "WRB & flashing", "es": "WRB y flashing" }, { "pt": "peça", "en": "piece", "es": "pieza" }],
          [
            { "pt": "Starter strip 12 ft", "en": "Starter strip 12 ft", "es": "Tira de arranque 12 ft" },
            { "pt": "Acessórios", "en": "Accessories", "es": "Accesorios" }, { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "Outside corner post (vinil)", "en": "Outside corner post (vinyl)", "es": "Poste de esquina exterior (vinilo)" },
            { "pt": "Acessórios", "en": "Accessories", "es": "Accesorios" }, { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "J-channel 12,5 ft", "en": "J-channel 12.5 ft", "es": "J-channel 12.5 ft" }, { "pt": "Acessórios", "en": "Accessories", "es": "Accesorios" },
            { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "Mounting block", "en": "Mounting block", "es": "Bloque de montaje" }, { "pt": "Acessórios", "en": "Accessories", "es": "Accesorios" },
            { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Trim PVC 1x4 — 18 ft (AZEK)", "en": "PVC trim 1x4 — 18 ft (AZEK)", "es": "Moldura de PVC 1x4 — 18 ft (AZEK)" }, "Trim",
            { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "Coil de alumínio 24\" x 50 ft", "en": "Aluminum trim coil 24\" x 50 ft", "es": "Rollo de aluminio para molduras 24\" x 50 ft" }, "Trim",
            { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Soffit vinil ventilado 12 ft", "en": "Vented vinyl soffit 12 ft", "es": "Soffit de vinilo ventilado 12 ft" },
            { "pt": "Soffit / fascia", "en": "Soffit / fascia", "es": "Soffit / fascia" }, { "pt": "peça", "en": "piece", "es": "pieza" }
          ],
          [
            { "pt": "OSB 7/16\" 4x8 (sheathing)", "en": "OSB 7/16\" 4x8 (sheathing)", "es": "OSB 7/16\" 4x8 (sheathing)" },
            { "pt": "Sheathing", "en": "Sheathing", "es": "Sheathing (forro)" }, { "pt": "folha", "en": "sheet", "es": "hoja" }
          ],
          [
            {
              "pt": "Pregos de siding galvanizados / inox (caixa)",
              "en": "Galvanized / stainless siding nails (box)",
              "es": "Clavos para siding galvanizados / inoxidables (caja)"
            },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" },
            { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [
            { "pt": "Selante para siding (tubo)", "en": "Siding sealant (tube)", "es": "Sellador para siding (tubo)" },
            { "pt": "Acabamento", "en": "Finish", "es": "Acabado" }, { "pt": "tubo", "en": "tube", "es": "tubo" }
          ]
        ],
        "basicOffer": [{ "list": "siding", "label": { "pt": "Adicionar lista básica de siding", "en": "Add basic siding list", "es": "Agregar lista básica de siding" } }],
        "promos": false,
        "searchExample": { "pt": "ex.: Hardie Plank, Tyvek, AZEK", "en": "e.g. Hardie Plank, Tyvek, AZEK", "es": "ej.: Hardie Plank, Tyvek, AZEK" }
      },
      groupsI18n: {
        "en": {
          "Preparação": "Prep",
          "Remoção e sheathing": "Tear-off & sheathing",
          "Barreira e flashing": "WRB & flashing",
          "Instalação": "Installation",
          "Acabamento": "Finish",
          "Inspeções": "Inspections"
        },
        "es": {
          "Preparação": "Preparación",
          "Remoção e sheathing": "Retiro y sheathing",
          "Barreira e flashing": "Barrera y flashing",
          "Instalação": "Instalación",
          "Acabamento": "Acabado",
          "Inspeções": "Inspecciones"
        }
      }
    },
    {
      id: "roofing",
      aliases: [],
      order: 85,
      category: "envelope",
      label: { "pt": "Telhado (roofing)", "en": "Roofing", "es": "Techos" },
      companySuffix: "Roofing",
      onboarding: {
        "label": { "pt": "Telhado (roofing)", "en": "Roofing", "es": "Techos" },
        "desc": { "pt": "Shingle, membrana, metal, gutters", "en": "Shingles, membrane, metal, gutters", "es": "Shingles, membrana, metal, canaletas" }
      },
      icon: { "svg": "<path d=\"M2 13 12 5l10 8\"/><path d=\"M5.5 10.5V20h13v-9.5\"/><path d=\"M8.5 14h7M8.5 17h7\"/>" },
      kind: { "pt": "trabalho de telhado", "en": "roofing job", "es": "trabajo de techo" },
      stepName: { "pt": "Telhado", "en": "Roofing", "es": "Techos" },
      group: { "label": { "pt": "Telhado", "en": "Roof", "es": "Techo" }, "icon": "trade-roofing" },
      workType: [
        { "pt": "Telhado novo (new construction)", "en": "New construction roof", "es": "Techo de construcción nueva" },
        { "pt": "Troca completa (tear-off e re-roof)", "en": "Full tear-off & re-roof", "es": "Retiro completo y techo nuevo" },
        { "pt": "Overlay (camada por cima)", "en": "Roof-over (overlay)", "es": "Techo encima del existente (overlay)" },
        { "pt": "Reparo / vazamento", "en": "Repair / leak", "es": "Reparación / filtración" },
        { "pt": "Telhado plano (membrana)", "en": "Flat / low-slope roof (membrane)", "es": "Techo plano / de poca pendiente (membrana)" },
        { "pt": "Metal standing seam", "en": "Standing seam metal", "es": "Metal standing seam" },
        { "pt": "Cedar / slate (telhado especial)", "en": "Cedar / slate (specialty roof)", "es": "Cedro / pizarra (techo especial)" },
        { "pt": "Gutters (calhas)", "en": "Gutters", "es": "Canaletas" }, { "pt": "Comercial", "en": "Commercial", "es": "Comercial" }
      ],
      fields: {
        "roofType": {
          "label": { "pt": "Tipo de telhado", "en": "Roof type", "es": "Tipo de techo" },
          "multi": true,
          "opts": [
            { "pt": "Shingle arquitetônico (asfalto)", "en": "Architectural asphalt shingles", "es": "Shingles de asfalto arquitectónicos" },
            { "pt": "Shingle 3-tab", "en": "3-tab shingles", "es": "Shingles 3-tab" }, { "pt": "EPDM (borracha)", "en": "EPDM (rubber)", "es": "EPDM (caucho)" },
            "TPO", "PVC", "Modified bitumen", { "pt": "Metal standing seam", "en": "Standing seam metal", "es": "Metal standing seam" },
            { "pt": "Metal exposed fastener", "en": "Exposed-fastener metal", "es": "Metal de tornillo expuesto" }, "Cedar shingles / shakes",
            { "pt": "Slate (ardósia)", "en": "Slate", "es": "Pizarra" }, { "pt": "Telha sintética", "en": "Synthetic shingles", "es": "Shingles sintéticos" }
          ]
        },
        "pitch": {
          "label": { "pt": "Inclinação (pitch)", "en": "Pitch", "es": "Pendiente" },
          "opts": [
            { "pt": "Plano (até 2/12)", "en": "Flat (up to 2/12)", "es": "Plano (hasta 2/12)" },
            { "pt": "Baixo (2/12 a 4/12)", "en": "Low (2/12 to 4/12)", "es": "Baja (2/12 a 4/12)" },
            { "pt": "Médio (4/12 a 8/12)", "en": "Medium (4/12 to 8/12)", "es": "Media (4/12 a 8/12)" },
            { "pt": "Íngreme (8/12 a 12/12)", "en": "Steep (8/12 to 12/12)", "es": "Empinada (8/12 a 12/12)" },
            { "pt": "Muito íngreme (acima de 12/12)", "en": "Very steep (over 12/12)", "es": "Muy empinada (más de 12/12)" }
          ]
        },
        "stories": {
          "label": { "pt": "Andares / altura do beiral", "en": "Stories / eave height", "es": "Pisos / altura del alero" },
          "opts": [
            { "pt": "1 andar", "en": "1 story", "es": "1 piso" }, { "pt": "2 andares", "en": "2 stories", "es": "2 pisos" },
            { "pt": "3 andares ou mais", "en": "3+ stories", "es": "3+ pisos" },
            { "pt": "Garagem / anexo baixo", "en": "Garage / low addition", "es": "Garaje / ampliación baja" }
          ]
        },
        "chimney": {
          "label": { "pt": "Chaminé / paredes (step flashing)", "en": "Chimney / sidewalls (step flashing)", "es": "Chimenea / paredes laterales (step flashing)" },
          "multi": true,
          "opts": [
            { "pt": "Sem chaminé", "en": "No chimney", "es": "Sin chimenea" },
            { "pt": "Chaminé — reflash (step + counter)", "en": "Chimney — reflash (step + counter)", "es": "Chimenea — rehacer el flashing (step + counter)" },
            { "pt": "Chaminé larga — cricket", "en": "Wide chimney — cricket", "es": "Chimenea ancha — cricket" },
            { "pt": "Parede lateral (step flashing)", "en": "Sidewall (step flashing)", "es": "Pared lateral (step flashing)" },
            { "pt": "Parede frontal (headwall)", "en": "Headwall flashing", "es": "Flashing de pared frontal (headwall)" }
          ]
        },
        "layers": {
          "label": { "pt": "Camadas a remover", "en": "Layers to remove", "es": "Capas a quitar" },
          "opts": [
            { "pt": "Nenhuma (telhado novo)", "en": "None (new roof)", "es": "Ninguna (techo nuevo)" }, { "pt": "1 camada", "en": "1 layer", "es": "1 capa" },
            { "pt": "2 camadas", "en": "2 layers", "es": "2 capas" }, { "pt": "3 ou mais camadas", "en": "3 or more layers", "es": "3 o más capas" },
            { "pt": "Overlay (sem remoção)", "en": "Overlay (no tear-off)", "es": "Overlay (sin retiro)" }
          ]
        },
        "deck": {
          "label": { "pt": "Deck (sheathing)", "en": "Roof deck (sheathing)", "es": "Deck del techo (sheathing)" },
          "opts": [
            { "pt": "Deck bom (só inspecionar)", "en": "Sound deck (inspect only)", "es": "Deck sano (solo inspeccionar)" },
            { "pt": "Trocar algumas folhas", "en": "Replace some sheets", "es": "Cambiar algunas hojas" },
            { "pt": "Trocar deck inteiro", "en": "Replace entire deck", "es": "Cambiar todo el deck" },
            { "pt": "Tábuas (plank / skip sheathing)", "en": "Plank / skip sheathing", "es": "Tablas / skip sheathing" },
            { "pt": "Só se sabe depois do tear-off", "en": "Unknown until tear-off", "es": "No se sabe hasta el retiro" }
          ]
        },
        "iceWater": {
          "label": "Ice & water shield",
          "opts": [
            {
              "pt": "Padrão (beirais + valleys + penetrações)",
              "en": "Code minimum (eaves + valleys + penetrations)",
              "es": "Mínimo del código (aleros + valleys + penetraciones)"
            },
            { "pt": "Telhado inteiro", "en": "Full roof", "es": "Todo el techo" },
            { "pt": "Só beirais", "en": "Eaves only", "es": "Solo los aleros" },
            { "pt": "Não se aplica (membrana / plano)", "en": "N/A (membrane / flat)", "es": "N/A (membrana / plano)" }
          ]
        },
        "underlayment": {
          "label": "Underlayment",
          "opts": [
            { "pt": "Sintético", "en": "Synthetic", "es": "Sintético" }, { "pt": "Feltro #15", "en": "#15 felt", "es": "Fieltro #15" },
            { "pt": "Feltro #30", "en": "#30 felt", "es": "Fieltro #30" },
            { "pt": "Isolamento + cover board (plano)", "en": "Insulation + cover board (low-slope)", "es": "Aislamiento + cover board (poca pendiente)" }
          ]
        },
        "ventilation": {
          "label": { "pt": "Ventilação", "en": "Ventilation", "es": "Ventilación" },
          "multi": true,
          "system": true,
          "opts": [
            "Ridge vent", { "pt": "Soffit vents (entrada de ar)", "en": "Soffit vents (intake)", "es": "Ventilas del soffit (entrada)" }, "Box vents",
            "Gable vents", "Power vent / attic fan",
            { "pt": "Sem ventilação (cathedral / unvented)", "en": "Unvented (cathedral / spray foam)", "es": "Sin ventilación (catedral / spray foam)" }
          ]
        },
        "flashing": {
          "label": "Flashing",
          "multi": true,
          "system": true,
          "opts": [
            "Drip edge", { "pt": "Step flashing nas paredes", "en": "Step flashing at walls", "es": "Step flashing en las paredes" },
            { "pt": "Chaminé (step + counter / cricket)", "en": "Chimney (step + counter / cricket)", "es": "Chimenea (step + counter / cricket)" }, "Valleys",
            "Pipe boots", "Skylights"
          ]
        },
        "skylights": {
          "label": "Skylights",
          "opts": [
            { "pt": "Não tem", "en": "None", "es": "Ninguno" },
            { "pt": "Reflash dos existentes", "en": "Reflash existing", "es": "Rehacer el flashing existente" },
            { "pt": "Trocar skylights", "en": "Replace skylights", "es": "Cambiar los tragaluces" },
            { "pt": "Skylights novos", "en": "New skylights", "es": "Tragaluces nuevos" }
          ]
        },
        "gutters": {
          "label": { "pt": "Gutters (calhas)", "en": "Gutters", "es": "Canaletas" },
          "system": true,
          "opts": [
            { "pt": "Sem mudança", "en": "No change", "es": "Sin cambio" },
            { "pt": "Novos alumínio 5\"", "en": "New 5\" aluminum", "es": "Aluminio nuevo de 5\"" },
            { "pt": "Novos alumínio 6\"", "en": "New 6\" aluminum", "es": "Aluminio nuevo de 6\"" }, { "pt": "Cobre", "en": "Copper", "es": "Cobre" },
            { "pt": "Só limpar / reparar", "en": "Clean / repair only", "es": "Solo limpiar / reparar" }
          ]
        },
        "manufacturer": {
          "label": { "pt": "Fabricante", "en": "Manufacturer", "es": "Fabricante" },
          "opts": ["GAF", "CertainTeed", "Owens Corning", "IKO", "Carlisle", "Holcim Elevate (Firestone)", "Johns Manville", { "pt": "Outro", "en": "Other", "es": "Otra" }]
        },
        "warranty": {
          "label": { "pt": "Garantia do fabricante", "en": "Manufacturer warranty", "es": "Garantía del fabricante" },
          "system": true,
          "opts": [
            { "pt": "Padrão do fabricante", "en": "Standard manufacturer warranty", "es": "Garantía estándar del fabricante" },
            {
              "pt": "Garantia de sistema estendida (contratante certificado)",
              "en": "Enhanced system warranty (certified contractor)",
              "es": "Garantía extendida del sistema (contratista certificado)"
            },
            { "pt": "Sem garantia do fabricante (reparo)", "en": "No manufacturer warranty (repair)", "es": "Sin garantía del fabricante (reparación)" }
          ]
        },
        "roofAccess": {
          "label": { "pt": "Acesso / segurança", "en": "Access / safety", "es": "Acceso / seguridad" },
          "opts": [
            { "pt": "Escada + ancoragens (harness)", "en": "Ladder + roof anchors (harness)", "es": "Escalera + anclajes de techo (arnés)" },
            { "pt": "Andaime / pump jacks", "en": "Staging / pump jacks", "es": "Andamios / pump jacks" },
            { "pt": "Elevador de material (ladder lift / boom)", "en": "Material hoist (ladder lift / boom)", "es": "Elevador de material (ladder lift / grúa)" },
            { "pt": "Guarda-corpo / warning line (plano)", "en": "Guardrail / warning line (low-slope)", "es": "Baranda / línea de advertencia (poca pendiente)" }
          ]
        },
        "debris": {
          "label": { "pt": "Entulho", "en": "Debris", "es": "Escombros" },
          "opts": [
            "Dumpster", { "pt": "Trailer / caminhão próprio", "en": "Own dump trailer / truck", "es": "Tráiler / camión de volteo propio" },
            { "pt": "Pouco (reparo)", "en": "Minimal (repair)", "es": "Mínimo (reparación)" }
          ]
        }
      },
      text: [
        { "key": "squares", "label": { "pt": "Área (squares)", "en": "Area (squares)", "es": "Área (squares)" }, "unit": "sq", "type": "number" },
        { "key": "ridgeLength", "label": { "pt": "Cumeeira / ridge (linear ft)", "en": "Ridge (linear ft)", "es": "Cumbrera (pies lineales)" }, "unit": "lf", "type": "number" },
        { "key": "eaveLength", "label": { "pt": "Beirais / eaves (linear ft)", "en": "Eaves (linear ft)", "es": "Aleros (pies lineales)" }, "unit": "lf", "type": "number" },
        { "key": "deckSheets", "label": { "pt": "Folhas de deck incluídas", "en": "Deck sheets included", "es": "Hojas de deck incluidas" }, "unit": "sheet", "type": "number" },
        { "key": "shingleLine", "label": { "pt": "Linha / cor do material", "en": "Product line / color", "es": "Línea de producto / color" } }
      ],
      units: [
        { "id": "sq", "label": { "pt": "squares", "en": "squares", "es": "squares" } }, { "id": "sqft", "label": "sq ft" },
        { "id": "lf", "label": { "pt": "linear ft", "en": "linear ft", "es": "pie lineal" } },
        { "id": "bundle", "label": { "pt": "bundle", "en": "bundle", "es": "paquete" } },
        { "id": "roll", "label": { "pt": "rolo", "en": "roll", "es": "rollo" } },
        { "id": "sheet", "label": { "pt": "folha 4x8", "en": "sheet (4x8)", "es": "hoja (4x8)" } },
        { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }
      ],
      tasks: {
        "Pré-obra e segurança": [
          { "pt": "Permit de building (re-roof)", "en": "Building permit (re-roof)", "es": "Permiso de construcción (techo nuevo)" },
          { "pt": "Confirmar material e cor com o cliente", "en": "Confirm product and color with the client", "es": "Confirmar producto y color con el cliente" },
          { "pt": "Entrega do material (no telhado)", "en": "Material delivery (rooftop)", "es": "Entrega del material (en el techo)" },
          {
            "pt": "Proteção do local (lonas, plywood, arbustos)",
            "en": "Site protection (tarps, plywood, shrubs)",
            "es": "Protección del lugar (lonas, plywood, arbustos)"
          },
          {
            "pt": "Proteção contra queda (ancoragens / harness / guarda-corpo)",
            "en": "Fall protection (anchors / harness / guardrail)",
            "es": "Protección contra caídas (anclajes / arnés / baranda)"
          },
          { "pt": "Dumpster / entulho", "en": "Dumpster / debris", "es": "Dumpster / escombros" }
        ],
        "Remoção e deck": [
          { "pt": "Tear-off (remover camadas)", "en": "Tear-off (remove layers)", "es": "Retiro (quitar las capas)" },
          { "pt": "Inspecionar o deck", "en": "Inspect the deck", "es": "Inspeccionar el deck" },
          { "pt": "Trocar deck danificado (folhas)", "en": "Replace damaged sheathing", "es": "Cambiar el sheathing dañado" },
          { "pt": "Cobrir no fim do dia (dry-in)", "en": "Dry-in at end of day", "es": "Dejar seco (dry-in) al final del día" }
        ],
        "Underlayment e flashing": [
          "Drip edge", "Ice & water shield", "Underlayment", "Valleys", "Step flashing / counterflashing",
          { "pt": "Flashing da chaminé (cricket)", "en": "Chimney flashing (cricket)", "es": "Flashing de la chimenea (cricket)" }, "Pipe boots",
          { "pt": "Flashing / troca de skylights", "en": "Skylight flashing / replacement", "es": "Flashing / cambio de tragaluces" }
        ],
        "Cobertura": [
          "Starter strip", { "pt": "Instalar shingles", "en": "Install shingles", "es": "Instalar los shingles" },
          { "pt": "Instalar membrana (EPDM / TPO / PVC)", "en": "Install membrane (EPDM / TPO / PVC)", "es": "Instalar la membrana (EPDM / TPO / PVC)" },
          { "pt": "Instalar painéis de metal", "en": "Install metal panels", "es": "Instalar los paneles de metal" }, "Ridge vent",
          { "pt": "Ridge cap / hip", "en": "Ridge / hip cap", "es": "Cumbrera / cap de hip" },
          { "pt": "Ventilação (soffit / box vents)", "en": "Ventilation (soffit / box vents)", "es": "Ventilación (soffit / box vents)" }
        ],
        "Gutters e acabamento": [
          { "pt": "Gutters e downspouts", "en": "Gutters and downspouts", "es": "Canaletas y bajantes" },
          { "pt": "Fascia / trim (alumínio)", "en": "Fascia / aluminum trim", "es": "Fascia / moldura de aluminio" },
          { "pt": "Selar penetrações", "en": "Seal penetrations", "es": "Sellar las penetraciones" }
        ],
        "Inspeções e entrega": [
          {
            "pt": "Inspeção do ice & water (se o município exigir)",
            "en": "Ice & water shield inspection (where required)",
            "es": "Inspección del ice & water shield (donde se exija)"
          },
          { "pt": "Inspeção final", "en": "Final inspection", "es": "Inspección final" },
          { "pt": "Limpeza e ímã para pregos (magnet sweep)", "en": "Cleanup and magnetic nail sweep", "es": "Limpieza y barrido magnético de clavos" },
          "Punch list",
          { "pt": "Fotos antes / depois", "en": "Before / after photos", "es": "Fotos de antes / después" },
          { "pt": "Registrar a garantia do fabricante", "en": "Register manufacturer warranty", "es": "Registrar la garantía del fabricante" }
        ]
      },
      groupsI18n: {
        "en": {
          "Pré-obra e segurança": "Pre-job & safety",
          "Remoção e deck": "Tear-off & deck",
          "Underlayment e flashing": "Underlayment & flashing",
          "Cobertura": "Roof covering",
          "Gutters e acabamento": "Gutters & trim",
          "Inspeções e entrega": "Inspections & closeout"
        },
        "es": {
          "Pré-obra e segurança": "Preobra y seguridad",
          "Remoção e deck": "Retiro y deck",
          "Underlayment e flashing": "Underlayment y flashing",
          "Cobertura": "Cubierta del techo",
          "Gutters e acabamento": "Canaletas y molduras",
          "Inspeções e entrega": "Inspecciones y entrega"
        }
      },
      suggest: {
        "vars": {},
        "rules": [
          {
            "add": [
              ["Pré-obra e segurança", "Confirmar material e cor com o cliente"], ["Pré-obra e segurança", "Proteção do local (lonas, plywood, arbustos)"],
              ["Pré-obra e segurança", "Proteção contra queda (ancoragens / harness / guarda-corpo)"]
            ]
          },
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Pré-obra e segurança", "Permit de building (re-roof)"]] },
          { "if": { "f": "workType", "re": "^(?!Reparo|Gutters)", "filled": true }, "add": [["Pré-obra e segurança", "Entrega do material (no telhado)"]] },
          {
            "if": { "f": "layers", "re": "camada" },
            "add": [
              ["Pré-obra e segurança", "Dumpster / entulho"], ["Remoção e deck", "Tear-off (remover camadas)"], ["Remoção e deck", "Inspecionar o deck"],
              ["Remoção e deck", "Cobrir no fim do dia (dry-in)"]
            ]
          },
          { "if": { "f": "debris", "eq": "Dumpster" }, "add": [["Pré-obra e segurança", "Dumpster / entulho"]] },
          { "if": { "f": "deck", "re": "Trocar|Tábuas" }, "add": [["Remoção e deck", "Trocar deck danificado (folhas)"]] },
          {
            "if": { "any": [{ "f": "flashing", "has": "Drip edge" }, { "f": "workType", "re": "^(?!Reparo|Gutters)", "filled": true }] },
            "add": [["Underlayment e flashing", "Drip edge"]]
          },
          { "if": { "f": "iceWater", "ne": "Não se aplica (membrana / plano)" }, "add": [["Underlayment e flashing", "Ice & water shield"]] },
          { "if": { "f": "workType", "re": "^(?!Reparo|Gutters)", "filled": true }, "add": [["Underlayment e flashing", "Underlayment"]] },
          { "if": { "f": "flashing", "has": "Valleys" }, "add": [["Underlayment e flashing", "Valleys"]] },
          { "if": { "f": "flashing", "has": "Step flashing nas paredes" }, "add": [["Underlayment e flashing", "Step flashing / counterflashing"]] },
          { "if": { "f": "flashing", "has": "Chaminé (step + counter / cricket)" }, "add": [["Underlayment e flashing", "Flashing da chaminé (cricket)"]] },
          { "if": { "f": "flashing", "has": "Pipe boots" }, "add": [["Underlayment e flashing", "Pipe boots"]] },
          {
            "if": { "any": [{ "f": "skylights", "ne": "Não tem" }, { "f": "flashing", "has": "Skylights" }] },
            "add": [["Underlayment e flashing", "Flashing / troca de skylights"]]
          },
          {
            "if": { "f": "roofType", "re": "Shingle|sintética|Cedar|Slate" },
            "add": [["Cobertura", "Starter strip"], ["Cobertura", "Instalar shingles"], ["Cobertura", "Ridge cap / hip"]]
          },
          {
            "if": { "any": [{ "f": "roofType", "re": "EPDM|TPO|PVC|Modified" }, { "f": "workType", "re": "plano" }] },
            "add": [["Cobertura", "Instalar membrana (EPDM / TPO / PVC)"]]
          },
          { "if": { "any": [{ "f": "roofType", "re": "Metal" }, { "f": "workType", "re": "Metal" }] }, "add": [["Cobertura", "Instalar painéis de metal"]] },
          { "if": { "f": "ventilation", "has": "Ridge vent" }, "add": [["Cobertura", "Ridge vent"]] },
          { "if": { "f": "ventilation", "re": "Soffit|Box|Gable" }, "add": [["Cobertura", "Ventilação (soffit / box vents)"]] },
          { "if": { "any": [{ "f": "gutters", "ne": "Sem mudança" }, { "f": "workType", "re": "Gutters" }] }, "add": [["Gutters e acabamento", "Gutters e downspouts"]] },
          { "if": { "f": "workType", "re": "Reparo" }, "add": [["Gutters e acabamento", "Selar penetrações"]] },
          { "if": { "f": "iceWater", "ne": "Não se aplica (membrana / plano)" }, "add": [["Inspeções e entrega", "Inspeção do ice & water (se o município exigir)"]] },
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Inspeções e entrega", "Inspeção final"]] },
          {
            "add": [
              ["Inspeções e entrega", "Limpeza e ímã para pregos (magnet sweep)"], ["Inspeções e entrega", "Punch list"],
              ["Inspeções e entrega", "Fotos antes / depois"]
            ]
          },
          { "if": { "f": "warranty", "re": "estendida" }, "add": [["Inspeções e entrega", "Registrar a garantia do fabricante"]] },
          { "if": { "f": "chimney", "re": "Chaminé" }, "add": [["Underlayment e flashing", "Flashing da chaminé (cricket)"]] },
          { "if": { "f": "chimney", "re": "Parede" }, "add": [["Underlayment e flashing", "Step flashing / counterflashing"]] },
          { "if": { "f": "stories", "re": "2|3" }, "add": [["Pré-obra e segurança", "Proteção contra queda (ancoragens / harness / guarda-corpo)"]] }
        ],
        "order": [
          "Permit de building (re-roof)", "Confirmar material e cor com o cliente", "Fotos antes / depois", "Entrega do material (no telhado)",
          "Dumpster / entulho", "Proteção do local (lonas, plywood, arbustos)", "Proteção contra queda (ancoragens / harness / guarda-corpo)",
          "Tear-off (remover camadas)", "Inspecionar o deck", "Trocar deck danificado (folhas)", "Cobrir no fim do dia (dry-in)", "Drip edge",
          "Ice & water shield", "Inspeção do ice & water (se o município exigir)", "Underlayment", "Valleys", "Step flashing / counterflashing",
          "Flashing da chaminé (cricket)", "Pipe boots", "Flashing / troca de skylights", "Starter strip", "Instalar shingles",
          "Instalar membrana (EPDM / TPO / PVC)", "Instalar painéis de metal", "Ventilação (soffit / box vents)", "Ridge vent", "Ridge cap / hip",
          "Selar penetrações", "Fascia / trim (alumínio)", "Gutters e downspouts", "Limpeza e ímã para pregos (magnet sweep)", "Inspeção final", "Punch list",
          "Registrar a garantia do fabricante"
        ]
      },
      inspections: [
        {
          "label": { "pt": "Permit de building (re-roof)", "en": "Building permit (re-roof)", "es": "Permiso de construcción (techo nuevo)" },
          "authority": {
            "pt": "Building department (780 CMR; CSL Roof Covering + HIC)",
            "en": "Building department (780 CMR; CSL Roof Covering + HIC)",
            "es": "Departamento de construcción (780 CMR; CSL Roof Covering + HIC)"
          },
          "when": { "pt": "Antes de começar", "en": "Before starting", "es": "Antes de empezar" }
        },
        {
          "label": {
            "pt": "Inspeção do ice & water (se o município exigir)",
            "en": "Ice & water shield inspection (where required)",
            "es": "Inspección del ice & water shield (donde se exija)"
          },
          "authority": { "pt": "Building inspector (780 CMR R905.1.2)", "en": "Building inspector (780 CMR R905.1.2)", "es": "Inspector de construcción (780 CMR R905.1.2)" },
          "when": {
            "pt": "Depois do ice & water, antes de cobrir",
            "en": "After ice & water shield, before covering",
            "es": "Después del ice & water shield, antes de cubrir"
          }
        },
        {
          "label": { "pt": "Inspeção final", "en": "Final inspection", "es": "Inspección final" },
          "authority": { "pt": "Building department", "en": "Building department", "es": "Departamento de construcción" },
          "when": { "pt": "Telhado pronto e limpo", "en": "Roof complete and cleaned up", "es": "Techo completo y limpio" }
        },
        {
          "label": {
            "pt": "Proteção contra queda (ancoragens / harness / guarda-corpo)",
            "en": "Fall protection (anchors / harness / guardrail)",
            "es": "Protección contra caídas (anclajes / arnés / baranda)"
          },
          "authority": { "pt": "OSHA 29 CFR 1926.501(b)(13) / (b)(10)", "en": "OSHA 29 CFR 1926.501(b)(13) / (b)(10)", "es": "OSHA 29 CFR 1926.501(b)(13) / (b)(10)" },
          "when": { "pt": "Todo dia, a partir de 6 ft", "en": "Every day, at 6 ft or more", "es": "Todos los días, a 6 ft o más" }
        }
      ],
      proposal: {
        "title": "ROOFING PROPOSAL",
        "tagline": "LICENSED ROOFING CONTRACTOR",
        "role": "Roofing Contractor",
        "scopeName": "Roofing",
        "invoiceWork": "roofing",
        "intro": {
          "text": "This proposal covers the roofing scope of work for {what} at {where}. Work will be performed in accordance with {code}, the manufacturer's installation instructions, OSHA fall-protection requirements (29 CFR 1926 Subpart M), and the requirements of the local Authority Having Jurisdiction.",
          "code": {
            "MA": "the Massachusetts State Building Code 780 CMR (10th edition), including the ice barrier requirements of R905.1.2 and the reroofing provisions",
            "*": "the applicable state building code (IRC / IBC as adopted)"
          }
        },
        "sections": [
          {
            "title": "Leak Repair",
            "keywords": "vazamento|leak|reparo|repair|consert|infiltra",
            "text": "Locate the source of the leak at the area described and remove only the roofing materials needed to access it.\nReplace damaged flashing, underlayment, and roofing at the repair area with materials matching the existing as closely as available; seal penetrations.\nPhotos of the repair provided. The repair is limited to the area described; other areas of the roof are not included.",
            "unless": "troca completa|re-?roof|tear.?off|telhado (?:novo|inteiro|todo)|new roof|whole roof|entire roof|trocar o telhado|replace the roof|squares"
          },
          {
            "title": "Tear-Off & Disposal",
            "text": "Remove existing roofing down to the deck — {layers}, underlayment, and deteriorated flashing — and dispose of all debris.\nProtect landscaping, siding, windows, and driveway with tarps and plywood during tear-off.\nRoof will be dried-in at the end of each work day.",
            "keywords": "tear.?off|remov|tirar|arrancar|camada|layer|velh|antig|old",
            "unless": "vazamento|leak|reparo|repair|consert|infiltra",
            "unlessExcept": "troca completa|re-?roof|tear.?off|telhado (?:novo|inteiro|todo)|new roof|whole roof|entire roof|trocar o telhado|replace the roof|squares"
          },
          {
            "title": "Roof Deck",
            "text": "Inspect the entire roof deck after tear-off and re-nail sheathing as required.\nReplace damaged or rotted sheathing with new sheathing of matching thickness (OSB or plywood); {sheets}, additional sheets at the unit price listed.",
            "keywords": "deck|sheathing|plywood|compensado|osb|madeira podre|rot"
          },
          {
            "title": "Ice & Water Shield & Underlayment",
            "text": "[MA] Install self-adhered **ice & water shield** at all eaves from the edge to at least 24\" inside the exterior wall line, in all valleys, and around all penetrations, per 780 CMR R905.1.2.\n[!MA] Install self-adhered **ice & water shield** at all eaves from the edge to at least 24\" inside the exterior wall line, in all valleys, and around all penetrations, per IRC R905.1.2 as adopted.\nInstall **synthetic underlayment** over the remainder of the roof deck.",
            "keywords": "ice|gelo|underlayment|feltro|felt|sint[eé]tico"
          },
          {
            "title": "Flashing & Drip Edge",
            "text": "Furnish and install new **aluminum drip edge** at all eaves and rakes.\nNew **step flashing** at sidewalls and new counterflashing / cricket at the chimney as required.\nNew **pipe boots** at all plumbing vent penetrations; open or woven valleys per manufacturer.",
            "keywords": "flashing|drip|chamin[eé]|chimney|valley|pipe boot|bota|skylight|claraboia",
            "unless": "vazamento|leak|reparo|repair|consert|infiltra",
            "unlessExcept": "troca completa|re-?roof|tear.?off|telhado (?:novo|inteiro|todo)|new roof|whole roof|entire roof|trocar o telhado|replace the roof|squares"
          },
          {
            "title": "Roofing System — Asphalt Shingles",
            "text": "Furnish and install {shingle}{shingleColor} with starter strip at eaves and rakes and matching hip & ridge cap.\nShingles fastened per the manufacturer's instructions (nail count and placement for the roof's wind exposure) to qualify for the manufacturer's warranty.",
            "keywords": "shingle|asfalto|asphalt|arquitet|architectural|\\btelhas?\\b|3.?tab|timberline|landmark|duration|\\bhdz\\b",
            "exclude": "telhado plano|flat roof|low.?slope"
          },
          {
            "title": "Low-Slope / Membrane Roofing",
            "text": "Furnish and install a {mil}{membrane} membrane roof system over new insulation / cover board on the low-slope areas, adhered or mechanically attached per the membrane manufacturer.\nNew terminations, edge metal, and flashing at walls, curbs, and penetrations per the membrane manufacturer.",
            "keywords": "epdm|\\btpo\\b|\\bpvc\\b|membrana|membrane|plano|flat|low.?slope|borracha|rubber|modified|mod\\.? ?bit"
          },
          {
            "title": "Metal Roofing",
            "keywords": "\\bmetal\\b|standing seam|snap.?lock|zinco",
            "exclude": "metal (?:drip|edge|flashing)",
            "text": "Furnish and install {metalPanel} metal roof panels over high-temperature underlayment rated for metal roofing, with trims, closures, and flashing per the panel manufacturer.\nPanel profile, gauge, and finish color as listed in the Investment section."
          },
          {
            "title": "Ventilation",
            "text": "Cut in and install **continuous ridge vent** and verify adequate intake at the soffits to balance attic ventilation per code.\nRemove and close abandoned box vents where replaced by ridge vent.",
            "keywords": "ventila|vent|ridge|soffit|cumeeira|s[oó]t[aã]o|attic"
          },
          {
            "title": "Gutters & Downspouts",
            "text": "Furnish and install new seamless {gutterSize}K-style aluminum gutters and downspouts with hidden hangers, in the color listed (or chosen by the Owner before ordering).\nDownspouts discharge to splash blocks or existing drains.",
            "keywords": "gutter|calha|downspout|condutor"
          },
          {
            "title": "Permit, Inspections & Cleanup",
            "text": "Building permit will be pulled by us. Permit fees are included.\nCoordination of required inspections; daily cleanup and magnetic nail sweep of the yard and driveway at completion.",
            "keywords": "."
          }
        ],
        "defaults": {
          "includes": "all labor, materials listed above, supervision, dumpster and debris disposal, daily cleanup and magnetic nail sweep, applicable {state} sales tax, and building permit fees and inspection coordination.",
          "notIncluded": "Replacement of roof sheathing beyond the quantity included (billed at the unit price per sheet) · Rafter, framing, or structural repairs · Chimney masonry, repointing, or chimney cap / crown work · Skylight replacement unless listed above · Removal of asbestos-containing or hazardous roofing materials · Interior drywall, ceiling, or paint repairs · Attic insulation and air sealing · Removal and reinstallation of solar panels, satellite dishes, or antennas · Electrical work for power vents or heat cables · Siding or trim replacement beyond flashing details.",
          "clarifications": "Building permit will be pulled by {brand}. **Permit fees are included.**\n[MA] Work supervised by a Massachusetts licensed Construction Supervisor (Roof Covering) and performed by a registered Home Improvement Contractor.\nRe-cover (roof-over) is not permitted where two or more roof coverings already exist (IRC R908.3.1.1 as adopted); in that case all existing layers are removed.\nDamaged sheathing discovered after tear-off will be replaced at the unit price listed and documented with photos.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** Five (5) years on roofing workmanship (leaks caused by installation) from the date of completion.\n**Manufacturer Warranty:** Manufacturer's limited warranty on shingles / membrane, registered in the Owner's name; enhanced system warranty where the manufacturer's certified-installer requirements are met.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Casa de dois andares, 28 squares. Tirar duas camadas de shingle, trocar até 3 folhas de deck, ice and water nos beirais e valleys, sintético no resto, shingle GAF Timberline cor Charcoal, ridge vent e gutters novos de 5 polegadas. Preço 24.500, 30/40/30.”",
          "en": "e.g. “Two-story house, 28 squares. Tear off two layers, replace up to 3 deck sheets, ice and water at eaves and valleys, synthetic elsewhere, GAF Timberline in Charcoal, ridge vent and new 5-inch gutters. Price 24,500, 30/40/30.”",
          "es": "ej.: “Casa de dos pisos, 28 squares. Quitar dos capas de shingle, cambiar hasta 3 hojas de deck, ice and water en los aleros y valleys, sintético en el resto, GAF Timberline color Charcoal, ridge vent y canaletas nuevas de 5 pulgadas. Precio 24,500, 30/40/30.”"
        },
        "aiRules": "Trade: ROOFING contractor (MA/NH). Speech mixes Portuguese and English roofing terms: 'ice and water' = ice & water shield, 'quadrado'/'squares' = roofing squares (100 sq ft), 'beiral' = eave, 'cumeeira' = ridge, 'calha' = gutter, 'chaminé' = chimney, 'deck'/'compensado' = sheathing.\nState quantities in roofing units: area in **squares**, ridge/eaves/gutters/drip edge in **linear feet**, deck in **sheets**. Never convert squares to sq ft unless asked.\nAlways say how many layers are removed (tear-off) or that it is a roof-over; never propose an overlay over two existing layers (code allows max two layers) — add a note in notes_pt if the speaker asks for it.\nName the product line and color only if spoken (e.g. GAF Timberline HDZ, CertainTeed Landmark, Owens Corning Duration); otherwise write 'manufacturer, line and color selected by Owner'.\nDeck replacement: include the quantity of sheets in the price and put a per-sheet unit price for extra sheets; if no unit price was said, mention it in notes_pt.\nIce & water shield: in MA cite 780 CMR R905.1.2 (eaves to 24\" inside the exterior wall); valleys and penetrations always.\nLow-slope roofs: specify membrane type and thickness (e.g. 60-mil EPDM / TPO), attachment (fully adhered / mechanically attached), insulation / cover board, and edge metal. Metal roofs: panel profile (standing seam, snap-lock / mechanical seam), gauge (24/26 ga), finish, and underlayment rated for metal (high-temp).\nTypical sections: Tear-Off & Disposal, Roof Deck, Ice & Water Shield & Underlayment, Flashing & Drip Edge, Roofing System, Ventilation, Gutters & Downspouts, Permit, Inspections & Cleanup.\nNot included typically: extra sheathing beyond allowance, structural/rafter repairs, chimney masonry, asbestos roofing removal, interior repairs, solar panel removal, attic insulation. Repairs ('reparo'/'vazamento'): a short 'Leak Repair' section only — no drip edge at all eaves, no full tear-off — and a one-year workmanship warranty on the repaired area. Payment milestones: Deposit / Tear-Off & Dry-In / Final (never 'Rough-In'). Pitfalls: do not include gutters, skylights, or chimney work unless mentioned; 'reparo'/'vazamento' = repair proposal (no manufacturer warranty, short workmanship warranty).\nWarranty: workmanship years as spoken (default 5) plus manufacturer warranty; never promise a manufacturer's enhanced warranty unless the speaker says the company is certified.",
        "facts": {
          "layers": {
            "count": "camadas?|layers?",
            "gap": 0,
            "max": 6,
            "one": "**one (1) layer** of existing roofing",
            "many": "**{wn} layers** of existing roofing",
            "fallback": "all existing roofing layers (quantity as listed)"
          },
          "sheets": {
            "count": "folhas?|sheets?|chapas?|placas?",
            "gap": 2,
            "max": 500,
            "one": "up to **one (1) sheet** included",
            "many": "up to **{wn} sheets** included",
            "fallback": "replacement quantity included as listed in the Investment section"
          },
          "shingle": {
            "re": "((?:GAF|Gaf|gaf|Owens Corning|Owens|CertainTeed|Certainteed|certainteed|IKO|Atlas|Tamko|TAMKO|Malarkey))((?:\\s+(?!cor\\b|color\\b|in\\b|na\\b|de\\b|e\\b|and\\b)[A-Z][\\w-]*){0,2})",
            "cs": true,
            "fmt": "**{g1}{g2}** architectural asphalt shingles",
            "fallback": "architectural asphalt shingles (manufacturer, product line, and color as listed or as chosen by the Owner before ordering)"
          },
          "shingleColor": {
            "re": "(?:GAF|Gaf|gaf|Owens Corning|CertainTeed|Certainteed|IKO|Atlas|Tamko|TAMKO|Malarkey)[^,.;]*?\\s(?:cor|color|na cor|in)\\s+([A-Z][\\w-]+(?:\\s[A-Z][\\w-]+)?)",
            "cs": true,
            "fmt": ", color **{1}**,",
            "fallback": ""
          },
          "membrane": {
            "pick": [["\\btpo\\b", "**TPO**"], ["\\bepdm\\b|borracha|rubber", "**EPDM**"], ["\\bpvc\\b", "**PVC**"], ["modified|mod\\.? ?bit|betum", "**modified bitumen**"]],
            "fallback": "single-ply"
          },
          "mil": { "re": "(\\d{2,3})\\s*-?\\s*mil\\b(?!\\s*(?:btu|d[oó]lares|dollars|reais))", "fmt": "**{1}-mil** ", "fallback": "" },
          "gutterSize": {
            "re": "(\\d)\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?|pol\\.?)\\s*(?:k-?style\\s*)?(?:aluminum\\s*)?(?:gutters?|calhas?)|(?:gutters?|calhas?)[^.;,]{0,30}?(\\d)\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)",
            "fmt": "**{1}\"** ",
            "fallback": ""
          },
          "metalPanel": {
            "pick": [
              ["snap.?lock", "**snap-lock standing seam**"], ["mechanical|mec[aâ]nic", "**mechanically seamed standing seam**"],
              ["standing seam", "**standing seam**"], ["exposed|parafuso aparente|r-?panel", "**exposed-fastener**"]
            ],
            "fallback": "metal"
          }
        },
        "jobVariants": [
          {
            "match": "vazamento|leak|reparo|repair|consert|infiltra",
            "defaults": {
              "warranty": "**Workmanship Warranty:** One (1) year on the repaired area (leaks caused by our workmanship) from the date of completion. No manufacturer warranty applies to repairs.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
            },
            "unless": "troca completa|re-?roof|tear.?off|telhado (?:novo|inteiro|todo)|new roof|whole roof|entire roof|trocar o telhado|replace the roof|squares"
          }
        ],
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to ordering materials."],
            ["Tear-Off & Dry-In", "Upon completion of tear-off, deck repairs, and dry-in (underlayment installed)."],
            ["Final Payment", "Upon completion, final inspection, and cleanup."]
          ]
        },
        "hic": true,
        "clientRole": "Homeowner",
        "adjustExample": {
          "pt": "Ex.: “Tira os gutters, muda o preço para 22 mil e acrescenta 5 folhas de deck.”",
          "en": "e.g. “Remove the gutters, change the price to 22K and add 5 deck sheets.”",
          "es": "ej.: “Quita las canaletas, cambia el precio a 22 mil y agrega 5 hojas de deck.”"
        }
      },
      prices: {
        "stores": [
          "abcsupply", { "id": "beacon", "name": "Beacon (QXO)", "short": "Beacon", "search": "site:becn.com" },
          { "id": "srs", "name": "SRS Distribution", "short": "SRS", "search": "SRS Distribution roofing" }, "homedepot", "lowes"
        ],
        "basic": [
          [
            { "pt": "Shingle arquitetônico (bundle)", "en": "Architectural shingles (bundle)", "es": "Shingles arquitectónicos (paquete)" },
            { "pt": "Cobertura", "en": "Roof covering", "es": "Cubierta del techo" }, { "pt": "bundle", "en": "bundle", "es": "paquete" }
          ],
          ["Starter strip (bundle)", { "pt": "Cobertura", "en": "Roof covering", "es": "Cubierta del techo" }, { "pt": "bundle", "en": "bundle", "es": "paquete" }],
          ["Hip & ridge cap (bundle)", { "pt": "Cobertura", "en": "Roof covering", "es": "Cubierta del techo" }, { "pt": "bundle", "en": "bundle", "es": "paquete" }],
          [
            { "pt": "Ice & water shield (rolo 2 sq)", "en": "Ice & water shield (2-sq roll)", "es": "Ice & water shield (rollo de 2 squares)" }, "Underlayment",
            { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Underlayment sintético (rolo 10 sq)", "en": "Synthetic underlayment (10-sq roll)", "es": "Underlayment sintético (rollo de 10 squares)" },
            "Underlayment", { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Drip edge alumínio — 10 ft", "en": "Aluminum drip edge — 10 ft", "es": "Drip edge de aluminio — 10 ft" }, "Flashing",
            { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Step flashing (caixa 100)", "en": "Step flashing (box of 100)", "es": "Step flashing (caja de 100)" }, "Flashing",
            { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [{ "pt": "Pipe boot 1-1/2\" a 3\"", "en": "Pipe boot 1-1/2\" to 3\"", "es": "Bota para tubo de 1-1/2\" a 3\"" }, "Flashing", { "pt": "un", "en": "ea", "es": "c/u" }],
          ["Ridge vent — 4 ft", { "pt": "Ventilação", "en": "Ventilation", "es": "Ventilación" }, { "pt": "peça", "en": "each", "es": "c/u" }],
          [
            { "pt": "Prego coil 1-1/4\" (caixa)", "en": "Coil roofing nails 1-1/4\" (box)", "es": "Clavos de techo en rollo 1-1/4\" (caja)" },
            { "pt": "Fixação", "en": "Fasteners", "es": "Fijaciones" }, { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          ["OSB 7/16\" 4x8", "Deck", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [{ "pt": "Compensado 1/2\" CDX 4x8", "en": "1/2\" CDX plywood 4x8", "es": "Plywood CDX 1/2\" 4x8" }, "Deck", { "pt": "folha", "en": "sheet", "es": "hoja" }],
          [
            { "pt": "Membrana EPDM 60 mil (sq ft)", "en": "60-mil EPDM membrane (sq ft)", "es": "Membrana EPDM de 60 mil (sq ft)" },
            { "pt": "Membrana", "en": "Membrane", "es": "Membrana" }, "sq ft"
          ],
          [
            { "pt": "Membrana TPO 60 mil (rolo)", "en": "60-mil TPO membrane (roll)", "es": "Membrana TPO de 60 mil (rollo)" },
            { "pt": "Membrana", "en": "Membrane", "es": "Membrana" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Adesivo de membrana (balde 5 gal)", "en": "Membrane bonding adhesive (5 gal)", "es": "Adhesivo para membrana (5 gal)" },
            { "pt": "Membrana", "en": "Membrane", "es": "Membrana" }, { "pt": "balde", "en": "bucket", "es": "cubeta" }
          ],
          [
            { "pt": "Selante de telhado (tubo)", "en": "Roof sealant (tube)", "es": "Sellador para techo (tubo)" },
            { "pt": "Consumíveis", "en": "Consumables", "es": "Consumibles" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            {
              "pt": "Gutter alumínio 5\" K-style (linear ft)",
              "en": "5\" K-style aluminum gutter (linear ft)",
              "es": "Canaleta de aluminio K-style de 5\" (pie lineal)"
            },
            { "pt": "Gutters", "en": "Gutters", "es": "Canaletas" },
            { "pt": "linear ft", "en": "linear ft", "es": "pie lineal" }
          ],
          [
            { "pt": "Downspout 2x3 — 10 ft", "en": "2x3 downspout — 10 ft", "es": "Bajante 2x3 — 10 ft" },
            { "pt": "Gutters", "en": "Gutters", "es": "Canaletas" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Coil de alumínio para trim (rolo)", "en": "Aluminum trim coil (roll)", "es": "Rollo de aluminio para molduras" },
            { "pt": "Acabamento", "en": "Trim", "es": "Molduras" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ]
        ],
        "basicOffer": [{ "list": "roofing", "label": { "pt": "Adicionar lista básica de telhado", "en": "Add basic roofing list", "es": "Agregar lista básica de techos" } }],
        "promos": false,
        "searchExample": {
          "pt": "ex.: shingle Timberline, ice & water, drip edge",
          "en": "e.g. Timberline shingles, ice & water, drip edge",
          "es": "ej.: shingles Timberline, ice & water, drip edge"
        }
      }
    },
    {
      id: "foundation",
      aliases: [],
      order: 90,
      category: "structure",
      label: { "pt": "Fundação e escavação", "en": "Foundation & excavation", "es": "Cimientos y excavación" },
      companySuffix: "Foundations",
      onboarding: {
        "label": { "pt": "Fundação e escavação", "en": "Foundation & excavation", "es": "Cimientos y excavación" },
        "desc": {
          "pt": "Escavação, footing, paredes, slab, drenagem",
          "en": "Excavation, footings, walls, slabs, drainage",
          "es": "Excavación, zapatas, muros, losas, drenaje"
        }
      },
      icon: { "svg": "<path d=\"M3 20h18\"/><path d=\"M5 20v-6h14v6\"/><path d=\"M9.5 14v6M14.5 14v6\"/><path d=\"M12 3v7M9 7.5l3 3 3-3\"/>" },
      kind: { "pt": "trabalho de fundação", "en": "foundation job", "es": "trabajo de cimientos" },
      stepName: { "pt": "Fundação", "en": "Foundation", "es": "Cimientos" },
      group: { "label": { "pt": "Fundação e escavação", "en": "Foundation & excavation", "es": "Cimientos y excavación" }, "icon": "trade-foundation" },
      workType: [
        { "pt": "Fundação de casa nova", "en": "New home foundation", "es": "Cimientos de casa nueva" },
        { "pt": "Addition (ampliação)", "en": "Addition", "es": "Ampliación (addition)" },
        { "pt": "Garagem / slab", "en": "Garage / slab", "es": "Garaje / losa" },
        {
          "pt": "Waterproofing / drenagem de porão existente",
          "en": "Existing basement waterproofing / drainage",
          "es": "Impermeabilización / drenaje de sótano existente"
        },
        {
          "pt": "Escavação e sitework (utilities, grading)",
          "en": "Excavation & sitework (utilities, grading)",
          "es": "Excavación y trabajo de sitio (servicios, nivelación)"
        },
        { "pt": "Muro de arrimo (retaining wall)", "en": "Retaining wall", "es": "Muro de contención" },
        { "pt": "Underpinning / reforço", "en": "Underpinning / repair", "es": "Recalce (underpinning) / reparación" },
        { "pt": "Multifamily / comercial", "en": "Multifamily / commercial", "es": "Multifamiliar / comercial" }
      ],
      fields: {
        "foundationType": {
          "label": { "pt": "Tipo de fundação", "en": "Foundation type", "es": "Tipo de cimiento" },
          "opts": [
            { "pt": "Porão completo (full basement)", "en": "Full basement", "es": "Sótano completo" }, "Crawl space", "Frost wall + slab",
            { "pt": "Slab-on-grade (monolítico)", "en": "Monolithic slab-on-grade", "es": "Losa monolítica a nivel del suelo" }, "Piers / sonotubes"
          ]
        },
        "wallSystem": {
          "label": { "pt": "Paredes", "en": "Wall system", "es": "Sistema de muros" },
          "opts": [
            { "pt": "Concreto moldado (poured)", "en": "Poured concrete", "es": "Concreto vaciado" }, "ICF",
            { "pt": "Bloco de concreto (CMU)", "en": "Concrete block (CMU)", "es": "Bloque de concreto (CMU)" },
            { "pt": "Pré-moldado (precast)", "en": "Precast", "es": "Prefabricado" }, { "pt": "Não se aplica", "en": "N/A", "es": "N/A" }
          ]
        },
        "wallHeight": {
          "label": { "pt": "Altura da parede", "en": "Wall height", "es": "Altura del muro" },
          "opts": ["4 ft (frost wall)", "8 ft", "9 ft", "10 ft", { "pt": "Outra", "en": "Other", "es": "Otra" }]
        },
        "soil": {
          "label": { "pt": "Solo", "en": "Soil", "es": "Suelo" },
          "opts": [
            { "pt": "Areia / cascalho", "en": "Sand / gravel", "es": "Arena / grava" }, { "pt": "Argila (clay)", "en": "Clay", "es": "Arcilla" },
            { "pt": "Lençol alto (água no buraco)", "en": "High water table", "es": "Nivel freático alto" },
            { "pt": "Desconhecido (fazer test pit)", "en": "Unknown (test pit)", "es": "Desconocido (calicata)" }
          ]
        },
        "ledge": {
          "label": { "pt": "Ledge / rocha", "en": "Ledge / rock", "es": "Roca (ledge)" },
          "opts": [
            { "pt": "Não", "en": "No", "es": "No" },
            { "pt": "Possível — preço por cubic yard", "en": "Possible — priced per cubic yard", "es": "Posible — se cobra por yarda cúbica" },
            { "pt": "Sim — rompedor (hammer)", "en": "Yes — hydraulic hammer", "es": "Sí — martillo hidráulico" },
            {
              "pt": "Sim — explosivo (blasting, por licenciado)",
              "en": "Yes — blasting (by licensed blaster)",
              "es": "Sí — voladura (por un dinamitero con licencia)"
            }
          ]
        },
        "excavationScope": {
          "label": { "pt": "Escavação inclui", "en": "Excavation includes", "es": "La excavación incluye" },
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Limpar terreno (árvores / tocos)", "en": "Clearing (trees / stumps)", "es": "Desmonte (árboles / tocones)" },
            { "pt": "Escavação da fundação", "en": "Foundation excavation", "es": "Excavación de los cimientos" },
            { "pt": "Tirar terra (export)", "en": "Export excess material", "es": "Sacar el material sobrante" },
            { "pt": "Trazer material (fill / gravel)", "en": "Import fill / gravel", "es": "Traer relleno / grava" },
            {
              "pt": "Trincheira de utilities (água / esgoto / elétrica)",
              "en": "Utility trenches (water / sewer / electric)",
              "es": "Zanjas de servicios (agua / alcantarillado / electricidad)"
            },
            { "pt": "Base de driveway", "en": "Driveway base", "es": "Base de la entrada de autos" },
            { "pt": "Grading final", "en": "Final grading", "es": "Nivelación final" }
          ]
        },
        "waterproofing": {
          "label": { "pt": "Impermeabilização", "en": "Waterproofing", "es": "Impermeabilización" },
          "opts": [
            { "pt": "Damp-proofing (asfalto spray)", "en": "Damp-proofing (spray asphalt)", "es": "Damp-proofing (asfalto en spray)" },
            { "pt": "Waterproofing (membrana)", "en": "Waterproofing membrane", "es": "Membrana impermeabilizante" },
            { "pt": "Membrana + drainage board", "en": "Membrane + drainage board", "es": "Membrana + placa de drenaje" },
            { "pt": "Não", "en": "No", "es": "No" }
          ]
        },
        "drainage": {
          "label": { "pt": "Drenagem", "en": "Drainage", "es": "Drenaje" },
          "multi": true,
          "system": true,
          "opts": [
            { "pt": "Perimeter drain para daylight", "en": "Perimeter drain to daylight", "es": "Drenaje perimetral con salida libre" },
            { "pt": "Perimeter drain para sump pit", "en": "Perimeter drain to sump pit", "es": "Drenaje perimetral al pozo de bomba (sump)" },
            { "pt": "Drenagem interna (porão existente)", "en": "Interior drain (existing basement)", "es": "Drenaje interior (sótano existente)" },
            { "pt": "Drywell / infiltração", "en": "Drywell / infiltration", "es": "Pozo seco / infiltración" },
            { "pt": "Sem drenagem", "en": "No drainage", "es": "Sin drenaje" }
          ]
        },
        "insulation": {
          "label": { "pt": "Isolamento", "en": "Insulation", "es": "Aislamiento" },
          "system": true,
          "opts": [
            { "pt": "Por outros / não incluso", "en": "By others / not included", "es": "Por otros / no incluido" },
            { "pt": "Rigid foam por fora (XPS / EPS)", "en": "Exterior rigid foam (XPS / EPS)", "es": "Espuma rígida exterior (XPS / EPS)" },
            { "pt": "Foam embaixo do slab", "en": "Under-slab foam", "es": "Espuma bajo la losa" },
            { "pt": "ICF (já isolado)", "en": "ICF (insulated)", "es": "ICF (aislado)" }
          ]
        },
        "slab": {
          "label": { "pt": "Slab (laje de piso)", "en": "Slab", "es": "Losa" },
          "opts": [
            { "pt": "Sem slab", "en": "No slab", "es": "Sin losa" }, { "pt": "Slab do porão 4\"", "en": "4\" basement slab", "es": "Losa de sótano de 4\"" },
            { "pt": "Slab de garagem", "en": "Garage slab", "es": "Losa del garaje" },
            { "pt": "Slab estrutural / engenheiro", "en": "Structural slab (engineered)", "es": "Losa estructural (con ingeniería)" },
            { "pt": "Slab com radiant (tubos por outros)", "en": "Radiant slab (tubing by others)", "es": "Losa radiante (tubería por otros)" }
          ]
        },
        "reinforcement": {
          "label": { "pt": "Armação", "en": "Reinforcement", "es": "Refuerzo" },
          "opts": [
            { "pt": "Rebar conforme projeto", "en": "Rebar per drawings", "es": "Varilla según los planos" },
            { "pt": "Rebar mínimo do código (#4)", "en": "Code-minimum rebar (#4)", "es": "Varilla mínima del código (#4)" },
            { "pt": "Tela / fibra (slab)", "en": "Mesh / fiber (slab)", "es": "Malla / fibra (losa)" }
          ]
        },
        "pump": {
          "label": { "pt": "Concretagem", "en": "Concrete placement", "es": "Colocación del concreto" },
          "opts": [
            { "pt": "Direto da bica (chute)", "en": "Direct chute", "es": "Canal directo" },
            { "pt": "Bomba de linha (line pump)", "en": "Line pump", "es": "Bomba de línea" },
            { "pt": "Bomba de lança (boom pump)", "en": "Boom pump", "es": "Bomba pluma (boom)" }
          ]
        },
        "digSafe": {
          "label": "Dig Safe (811)",
          "system": true,
          "opts": [
            { "pt": "A pedir", "en": "To be requested", "es": "Por pedir" }, { "pt": "Ticket ativo", "en": "Active ticket", "es": "Ticket activo" },
            { "pt": "Linhas particulares (marcar por conta)", "en": "Private lines (locate privately)", "es": "Líneas privadas (localizar por cuenta privada)" }
          ]
        },
        "asBuilt": {
          "label": "As-built / plot plan",
          "system": true,
          "opts": [
            { "pt": "Precisa (agrimensor)", "en": "Required (surveyor)", "es": "Obligatorio (agrimensor)" },
            { "pt": "Não precisa", "en": "Not required", "es": "No hace falta" }
          ]
        }
      },
      text: [
        { "key": "footprint", "label": { "pt": "Área da fundação (sq ft)", "en": "Footprint (sq ft)", "es": "Huella (sq ft)" }, "unit": "sqft", "type": "number" },
        { "key": "perimeter", "label": { "pt": "Perímetro (linear ft)", "en": "Perimeter (linear ft)", "es": "Perímetro (pies lineales)" }, "unit": "lf", "type": "number" },
        {
          "key": "concreteYards",
          "label": { "pt": "Concreto estimado (cubic yards)", "en": "Concrete (cubic yards)", "es": "Concreto (yardas cúbicas)" },
          "unit": "cy",
          "type": "number"
        },
        { "key": "footingSize", "label": { "pt": "Footing / parede (dimensões)", "en": "Footing / wall size", "es": "Tamaño de zapata / muro" } },
        { "key": "engineer", "label": { "pt": "Engenheiro / plantas estruturais", "en": "Engineer / structural drawings", "es": "Ingeniero / planos estructurales" } }
      ],
      units: [
        { "id": "cy", "label": { "pt": "cubic yards", "en": "cubic yards", "es": "yardas cúbicas" } },
        { "id": "lf", "label": { "pt": "linear ft", "en": "linear ft", "es": "pie lineal" } }, { "id": "sqft", "label": "sq ft" },
        { "id": "ton", "label": { "pt": "tonelada", "en": "ton", "es": "tonelada" } },
        { "id": "hr", "label": { "pt": "hora de máquina", "en": "machine hour", "es": "hora de máquina" } },
        { "id": "ea", "label": { "pt": "un", "en": "ea", "es": "c/u" } }
      ],
      tasks: {
        "Pré-obra e segurança": [
          { "pt": "Permit de building / fundação", "en": "Building / foundation permit", "es": "Permiso de construcción / de cimientos" },
          {
            "pt": "Dig Safe (811) — pré-marcar em branco e ticket",
            "en": "Dig Safe (811) — white premark and ticket",
            "es": "Dig Safe (811) — marcado previo en blanco y ticket"
          },
          { "pt": "Trench permit (trincheira com mais de 3 ft)", "en": "Trench permit (trench over 3 ft)", "es": "Permiso de zanja (zanja de más de 3 ft)" },
          { "pt": "Stakeout da casa (agrimensor)", "en": "House stakeout (surveyor)", "es": "Replanteo de la casa (agrimensor)" },
          {
            "pt": "Controle de erosão (silt fence / hay bales)",
            "en": "Erosion control (silt fence / hay bales)",
            "es": "Control de erosión (silt fence / pacas de heno)"
          },
          {
            "pt": "Proteção da escavação (talude / trench box / cerca)",
            "en": "Excavation protection (sloping / trench box / fencing)",
            "es": "Protección de la excavación (talud / trench box / cerca)"
          }
        ],
        "Escavação": [
          { "pt": "Limpar terreno (árvores / tocos)", "en": "Clearing (trees / stumps)", "es": "Desmonte (árboles / tocones)" },
          { "pt": "Escavação da fundação", "en": "Foundation excavation", "es": "Excavación de los cimientos" },
          { "pt": "Remover ledge / rocha", "en": "Ledge / rock removal", "es": "Retiro de roca (ledge)" },
          { "pt": "Trincheiras de utilities", "en": "Utility trenches", "es": "Zanjas de servicios" },
          { "pt": "Estocar / tirar terra", "en": "Stockpile / export soil", "es": "Acopiar / sacar la tierra" }
        ],
        "Footings": [
          { "pt": "Formas e rebar dos footings", "en": "Footing forms and rebar", "es": "Formaletas y varilla de las zapatas" },
          { "pt": "Inspeção de footing (antes do concreto)", "en": "Footing inspection (before pour)", "es": "Inspección de zapatas (antes de vaciar)" },
          { "pt": "Concretar footings", "en": "Pour footings", "es": "Vaciar las zapatas" }, "Keyway / dowels"
        ],
        "Paredes": [
          { "pt": "Formar paredes / montar ICF", "en": "Set wall forms / stack ICF", "es": "Armar formaletas de muro / apilar ICF" },
          { "pt": "Rebar e anchor bolts", "en": "Rebar and anchor bolts", "es": "Varilla y pernos de anclaje" },
          { "pt": "Concretar paredes", "en": "Pour walls", "es": "Vaciar los muros" },
          { "pt": "Desformar e quebrar ties", "en": "Strip forms and snap ties", "es": "Quitar formaletas y snap ties" },
          { "pt": "As-built / plot plan da fundação", "en": "Foundation as-built / plot plan", "es": "As-built del cimiento / plot plan" }
        ],
        "Impermeabilização e drenagem": [
          "Damp-proofing / waterproofing", { "pt": "Isolamento rígido por fora", "en": "Exterior rigid insulation", "es": "Aislamiento rígido exterior" },
          { "pt": "Perimeter drain (tubo, pedra e tecido)", "en": "Perimeter drain (pipe, stone, fabric)", "es": "Drenaje perimetral (tubo, piedra, tela)" },
          "Sump pit",
          { "pt": "Inspeção da fundação (antes do backfill)", "en": "Foundation inspection (before backfill)", "es": "Inspección de cimientos (antes de rellenar)" },
          { "pt": "Backfill e compactação", "en": "Backfill and compaction", "es": "Relleno y compactación" }
        ],
        "Slab e entrega": [
          { "pt": "Base de pedra compactada", "en": "Compacted stone base", "es": "Base de piedra compactada" },
          {
            "pt": "Vapor barrier (10 mil) e foam embaixo do slab",
            "en": "Vapor barrier (10 mil) and under-slab foam",
            "es": "Barrera de vapor (10 mil) y espuma bajo la losa"
          },
          { "pt": "Concretar slab", "en": "Pour slab", "es": "Vaciar la losa" },
          { "pt": "Grading final", "en": "Final grading", "es": "Nivelación final" },
          { "pt": "Limpeza e retirada de material", "en": "Cleanup and material removal", "es": "Limpieza y retiro de material" },
          "Punch list"
        ]
      },
      groupsI18n: {
        "en": {
          "Pré-obra e segurança": "Pre-job & safety",
          "Escavação": "Excavation",
          "Paredes": "Walls",
          "Impermeabilização e drenagem": "Waterproofing & drainage",
          "Slab e entrega": "Slab & closeout",
          "Footings": "Footings"
        },
        "es": {
          "Pré-obra e segurança": "Preobra y seguridad",
          "Escavação": "Excavación",
          "Paredes": "Muros",
          "Impermeabilização e drenagem": "Impermeabilización y drenaje",
          "Slab e entrega": "Losa y entrega",
          "Footings": "Zapatas (footings)"
        }
      },
      suggest: {
        "vars": {
          "nova": { "f": "workType", "re": "nova|Addition|Garagem|Multifamily" },
          "paredes": { "all": [{ "f": "wallSystem", "ne": "Não se aplica" }, { "not": { "f": "foundationType", "re": "monolítico|Piers" } }] }
        },
        "rules": [
          { "if": { "f": "permit", "re": "Sim" }, "add": [["Pré-obra e segurança", "Permit de building / fundação"]] },
          { "add": [["Pré-obra e segurança", "Dig Safe (811) — pré-marcar em branco e ticket"]] },
          {
            "if": { "f": "excavationScope", "has": "Trincheira de utilities (água / esgoto / elétrica)" },
            "add": [["Pré-obra e segurança", "Trench permit (trincheira com mais de 3 ft)"]]
          },
          { "if": { "f": "workType", "re": "casa nova|Multifamily" }, "add": [["Pré-obra e segurança", "Stakeout da casa (agrimensor)"]] },
          { "if": { "var": "nova" }, "add": [["Pré-obra e segurança", "Controle de erosão (silt fence / hay bales)"]] },
          { "add": [["Pré-obra e segurança", "Proteção da escavação (talude / trench box / cerca)"]] },
          { "if": { "f": "excavationScope", "has": "Limpar terreno (árvores / tocos)" }, "add": [["Escavação", "Limpar terreno (árvores / tocos)"]] },
          { "if": { "any": [{ "var": "nova" }, { "f": "excavationScope", "has": "Escavação da fundação" }] }, "add": [["Escavação", "Escavação da fundação"]] },
          { "if": { "f": "ledge", "ne": "Não" }, "add": [["Escavação", "Remover ledge / rocha"]] },
          { "if": { "f": "excavationScope", "has": "Trincheira de utilities (água / esgoto / elétrica)" }, "add": [["Escavação", "Trincheiras de utilities"]] },
          {
            "if": { "any": [{ "f": "excavationScope", "has": "Tirar terra (export)" }, { "f": "excavationScope", "has": "Trazer material (fill / gravel)" }] },
            "add": [["Escavação", "Estocar / tirar terra"]]
          },
          {
            "if": { "var": "nova" },
            "add": [["Footings", "Formas e rebar dos footings"], ["Footings", "Inspeção de footing (antes do concreto)"], ["Footings", "Concretar footings"]]
          },
          {
            "if": { "all": [{ "var": "nova" }, { "var": "paredes" }] },
            "add": [
              ["Footings", "Keyway / dowels"], ["Paredes", "Formar paredes / montar ICF"], ["Paredes", "Rebar e anchor bolts"], ["Paredes", "Concretar paredes"],
              ["Paredes", "Desformar e quebrar ties"]
            ]
          },
          { "if": { "f": "asBuilt", "re": "Precisa" }, "add": [["Paredes", "As-built / plot plan da fundação"]] },
          { "if": { "f": "waterproofing", "ne": "Não" }, "add": [["Impermeabilização e drenagem", "Damp-proofing / waterproofing"]] },
          { "if": { "f": "insulation", "re": "Rigid" }, "add": [["Impermeabilização e drenagem", "Isolamento rígido por fora"]] },
          { "if": { "f": "drainage", "re": "Perimeter|interna" }, "add": [["Impermeabilização e drenagem", "Perimeter drain (tubo, pedra e tecido)"]] },
          { "if": { "f": "drainage", "re": "sump|interna" }, "add": [["Impermeabilização e drenagem", "Sump pit"]] },
          { "if": { "f": "waterproofing", "ne": "Não" }, "add": [["Impermeabilização e drenagem", "Inspeção da fundação (antes do backfill)"]] },
          { "if": { "var": "nova" }, "add": [["Impermeabilização e drenagem", "Backfill e compactação"]] },
          {
            "if": { "any": [{ "f": "slab", "ne": "Sem slab" }, { "f": "foundationType", "re": "[Ss]lab" }] },
            "add": [
              ["Slab e entrega", "Base de pedra compactada"], ["Slab e entrega", "Vapor barrier (10 mil) e foam embaixo do slab"],
              ["Slab e entrega", "Concretar slab"]
            ]
          },
          { "if": { "f": "excavationScope", "has": "Grading final" }, "add": [["Slab e entrega", "Grading final"]] },
          { "add": [["Slab e entrega", "Limpeza e retirada de material"], ["Slab e entrega", "Punch list"]] }
        ],
        "order": [
          "Permit de building / fundação", "Stakeout da casa (agrimensor)", "Dig Safe (811) — pré-marcar em branco e ticket",
          "Trench permit (trincheira com mais de 3 ft)", "Controle de erosão (silt fence / hay bales)", "Limpar terreno (árvores / tocos)",
          "Proteção da escavação (talude / trench box / cerca)", "Escavação da fundação", "Remover ledge / rocha", "Estocar / tirar terra",
          "Formas e rebar dos footings", "Keyway / dowels", "Inspeção de footing (antes do concreto)", "Concretar footings", "Formar paredes / montar ICF",
          "Rebar e anchor bolts", "Concretar paredes", "Desformar e quebrar ties", "As-built / plot plan da fundação", "Damp-proofing / waterproofing",
          "Isolamento rígido por fora", "Perimeter drain (tubo, pedra e tecido)", "Sump pit", "Inspeção da fundação (antes do backfill)",
          "Backfill e compactação", "Trincheiras de utilities", "Base de pedra compactada", "Vapor barrier (10 mil) e foam embaixo do slab", "Concretar slab",
          "Grading final", "Limpeza e retirada de material", "Punch list"
        ]
      },
      inspections: [
        {
          "label": {
            "pt": "Dig Safe (811) — pré-marcar em branco e ticket",
            "en": "Dig Safe (811) — white premark and ticket",
            "es": "Dig Safe (811) — marcado previo en blanco y ticket"
          },
          "authority": {
            "pt": "Dig Safe — MA: DPU (M.G.L. c.82 §40, 220 CMR 99); NH: RSA 374:51",
            "en": "Dig Safe — MA: DPU (M.G.L. c.82 §40, 220 CMR 99); NH: RSA 374:51",
            "es": "Dig Safe — MA: DPU (M.G.L. c.82 §40, 220 CMR 99); NH: RSA 374:51"
          },
          "when": {
            "pt": "72 h úteis antes de escavar; ticket vale 30 dias",
            "en": "72 business hours before digging; ticket valid 30 days",
            "es": "72 horas hábiles antes de excavar; el ticket vale 30 días"
          }
        },
        {
          "label": { "pt": "Trench permit (trincheira com mais de 3 ft)", "en": "Trench permit (trench over 3 ft)", "es": "Permiso de zanja (zanja de más de 3 ft)" },
          "authority": { "pt": "Município (M.G.L. c.82A / 520 CMR 14.00)", "en": "Municipality (M.G.L. c.82A / 520 CMR 14.00)", "es": "Municipio (M.G.L. c.82A / 520 CMR 14.00)" },
          "when": {
            "pt": "Antes de abrir trincheira > 3 ft",
            "en": "Before opening a trench deeper than 3 ft",
            "es": "Antes de abrir una zanja de más de 3 ft de profundidad"
          }
        },
        {
          "label": { "pt": "Inspeção de footing (antes do concreto)", "en": "Footing inspection (before pour)", "es": "Inspección de zapatas (antes de vaciar)" },
          "authority": { "pt": "Building inspector (780 CMR R110.3.1)", "en": "Building inspector (780 CMR R110.3.1)", "es": "Inspector de construcción (780 CMR R110.3.1)" },
          "when": { "pt": "Formas e rebar prontos, antes de concretar", "en": "Forms and rebar set, before the pour", "es": "Formaletas y varilla puestas, antes de vaciar" }
        },
        {
          "label": { "pt": "Inspeção da fundação (antes do backfill)", "en": "Foundation inspection (before backfill)", "es": "Inspección de cimientos (antes de rellenar)" },
          "authority": { "pt": "Building inspector (780 CMR R110.3.1)", "en": "Building inspector (780 CMR R110.3.1)", "es": "Inspector de construcción (780 CMR R110.3.1)" },
          "when": { "pt": "Depois do damp-proofing e do dreno", "en": "After damp-proofing and drain", "es": "Después del damp-proofing y el drenaje" }
        },
        {
          "label": { "pt": "As-built / plot plan da fundação", "en": "Foundation as-built / plot plan", "es": "As-built del cimiento / plot plan" },
          "authority": {
            "pt": "Agrimensor licenciado → building department",
            "en": "Licensed surveyor → building department",
            "es": "Agrimensor con licencia → departamento de construcción"
          },
          "when": {
            "pt": "Antes do framing ou do CO (varia por município)",
            "en": "Before framing or CO (varies by town)",
            "es": "Antes del framing o del CO (varía según el municipio)"
          }
        }
      ],
      proposal: {
        "title": "FOUNDATION PROPOSAL",
        "tagline": "FOUNDATION & SITEWORK CONTRACTOR",
        "role": "Foundation & Excavation Contractor",
        "scopeName": "Foundation & Sitework",
        "invoiceWork": "foundation and sitework",
        "intro": {
          "text": "This proposal covers the foundation and excavation scope of work for {what} at {where}. Work will be performed in accordance with {code}, the approved structural drawings, ACI 318 / ACI 332 for residential concrete, OSHA 29 CFR 1926 Subpart P, and the requirements of the local Authority Having Jurisdiction.",
          "code": {
            "MA": "the Massachusetts State Building Code 780 CMR (10th edition), the Dig Safe law (M.G.L. c.82 §40) and trench safety regulations (520 CMR 14.00)",
            "NH": "the New Hampshire State Building Code (RSA 155-A) and the underground damage prevention law (RSA 374:48–56)",
            "*": "the applicable state building code (IRC / IBC as adopted) and the state underground damage prevention (Dig Safe) law"
          }
        },
        "sections": [
          {
            "title": "Site Preparation & Erosion Control",
            "text": "Notify **Dig Safe (811)** and premark the work area in white at least 72 business hours before excavation; obtain a trench permit where required.\nInstall silt fence / erosion control along the downhill side of the work area where required and maintain it for the duration of our work.\n{clearing}",
            "keywords": "."
          },
          {
            "title": "Excavation",
            "text": "[MA] Excavate for the foundation to the depth required for frost protection (**minimum 48\" below finished grade** per 780 CMR, or deeper as shown on the drawings).\n[!MA] Excavate for the foundation to the frost depth set by the local building official, or deeper as shown on the drawings.\nStockpile suitable material on site for backfill; export excess material as listed.",
            "keywords": "escava|excav|buraco|cavar|terra|dirt|export|frost"
          },
          {
            "title": "Ledge & Rock",
            "text": "Ledge or boulders that cannot be removed with a standard excavator will be removed by **hydraulic hammer at the unit price per cubic yard** listed.\nBlasting, if required, by a licensed blasting contractor under permit and is not included unless listed.",
            "keywords": "ledge|rocha|rock|pedra grande|boulder|blast|explos|martelo|hammer|rompedor"
          },
          {
            "title": "Footings",
            "text": "Form and pour {footing} with reinforcement per the drawings (or the code minimum), including keyway / dowels to the walls.\nFooting inspection by the building department **before concrete is placed**.",
            "keywords": "footing|sapata|funda[cç][aã]o|foundation"
          },
          {
            "title": "Foundation Walls",
            "text": "Form and pour {wall} with concrete per IRC Table R402.2 as adopted (**3,000 psi** minimum for walls exposed to weather) and rebar per the drawings, including window / door bucks and beam pockets as shown.\nInstall **1/2\" anchor bolts** at a maximum of 6' on center and within 12\" of each sill-plate end, with **minimum 7\" embedment** into the concrete (IRC R403.1.6).\nStrip forms and break ties.",
            "keywords": "parede|wall|poured|concreto|concrete|icf|bloco|forma|form"
          },
          {
            "title": "Damp-Proofing, Waterproofing & Drainage",
            "text": "Apply **damp-proofing** to the exterior of foundation walls from footing to finished grade (membrane waterproofing only where listed).\nInstall a perforated perimeter drain in crushed stone wrapped in filter fabric, discharging to daylight or a sump pit (IRC R405).\nFoundation inspection prior to backfill where required.",
            "keywords": "damp|water.?proof|impermeab|dreno|drain|drenagem|sump|perimeter"
          },
          {
            "title": "Backfill & Compaction",
            "text": "Backfill foundation walls in lifts with suitable material, compacting each lift; first-floor framing or bracing must be in place before backfilling above the height allowed for unbraced walls (IRC R404.1.7 / the drawings).\nRough grade sloped away from the foundation.",
            "keywords": "backfill|aterro|reaterr|compact|grading|nivelar"
          },
          {
            "title": "Concrete Slab",
            "text": "Install compacted crushed stone base, vapor retarder (minimum 6-mil polyethylene per IRC R506.2.3; 10-mil where listed), and under-slab insulation where listed.\nPour a {slabThick}concrete slab with {slabSpec}; steel trowel finish inside (broom finish outdoors) and saw-cut control joints.",
            "keywords": "slab|laje|piso de concreto|garag|basement floor|concrete floor"
          },
          {
            "title": "Permit, Inspections & Layout",
            "text": "Building / foundation permit coordination; footing and foundation inspections with the Authority Having Jurisdiction.\nFoundation as-built / plot plan by a licensed surveyor where listed.",
            "keywords": "."
          }
        ],
        "defaults": {
          "includes": "all labor, equipment, concrete, rebar, and materials listed above, supervision, Dig Safe notification, applicable {state} sales tax, and foundation permit coordination and inspections.",
          "notIncluded": "Ledge or rock removal beyond the allowance / unit price listed, and blasting · Septic system design or installation (Title 5) · Engineering, structural design, soil testing, and stamped drawings · Surveying, stakeout, and as-built plot plans unless listed · Dewatering beyond normal pumping, and removal of unsuitable or contaminated soils · Utility company tap, connection, and impact fees · Under-slab plumbing, radiant tubing, and radon systems · Winter protection (ground heaters, blankets, heated concrete) unless listed · Loam, seed, landscaping, and paving · Framing, sill plates, and anything above the top of the foundation.",
          "clarifications": "Building / foundation permit coordinated by {brand}. **Permit fees are included** unless noted otherwise.\nDig Safe will be notified at least 72 business hours before excavation. Private utility lines (irrigation, private electric, septic) must be located by the Owner.\nHairline shrinkage cracks in concrete are normal and are not considered a defect.\nAny work outside the scope above, including unforeseen ledge or groundwater, will be quoted as a written change order before it is performed.",
          "warranty": "**Workmanship Warranty:** One (1) year on all workmanship from the date of completion; water infiltration through foundation walls with waterproofing installed by us is covered for one (1) year (damp-proofing alone is not a waterproofing system).\n**Materials:** Manufacturer warranties on waterproofing membranes and drainage products transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
        },
        "speechExample": {
          "pt": "Ex.: “Fundação de casa nova, porão completo de 28 por 40. Escavação, footing 20 por 10, parede de 8 polegadas por 8 pés, damp-proofing, dreno perimetral para o sump, backfill e slab de 4 polegadas. Se der ledge, cobro 185 por jarda. Preço 48 mil, 30/40/30.”",
          "en": "e.g. “New home foundation, full basement 28 by 40. Excavation, 20 by 10 footing, 8-inch by 8-foot walls, damp-proofing, perimeter drain to sump, backfill and 4-inch slab. Ledge at 185 per yard. Price 48K, 30/40/30.”",
          "es": "ej.: “Cimientos de casa nueva, sótano completo de 28 por 40. Excavación, zapata de 20 por 10, muros de 8 pulgadas por 8 pies, damp-proofing, drenaje perimetral al sump, relleno y losa de 4 pulgadas. Roca a 185 por yarda. Precio 48 mil, 30/40/30.”"
        },
        "aiRules": "Trade: FOUNDATION & EXCAVATION / sitework contractor (MA/NH). Speech mixes Portuguese and English: 'sapata'/'footing' = footing, 'parede' = foundation wall, 'jarda' = cubic yard, 'laje'/'slab' = slab, 'dreno' = perimeter drain, 'reaterro'/'backfill' = backfill, 'ledge'/'rocha' = ledge.\nQuantities: concrete and excavation in **cubic yards**, footings / walls / drains / trenches in **linear feet**, slabs and waterproofing in **square feet**, stone in **tons**; footing and wall sizes as width x depth / thickness x height (e.g. 20\" x 10\" footing, 8\" x 8' wall).\nSpecify concrete strength: 3,000 PSI for foundation walls and basement slabs; garage slabs, porches, steps, and any concrete exposed to weather: 3,500 PSI air-entrained (5–7% air) per IRC Table R402.2 (MA / NH = severe weathering) — flag in notes_pt if not said, rebar size and count, anchor bolt size, spacing, and minimum 7\" embedment (IRC R403.1.6).\nAlways include Dig Safe (811) notification before excavation; in MA mention trench permit (520 CMR 14.00) when there are trenches over 3 ft.\nAlways state that the footing inspection happens BEFORE the concrete pour, and the foundation / damp-proofing inspection before backfill where required.\nLedge: never include unlimited ledge removal in a lump sum — use an allowance or a unit price per cubic yard; if the speaker gave none, add a note in notes_pt.\nDistinguish damp-proofing (coating) from waterproofing (membrane); do not call damp-proofing 'waterproof'.\nSeptic systems (Title 5), blasting, engineering, surveying / as-built, dewatering, and winter concrete protection are excluded unless the speaker includes them.\nTypical sections: Site Preparation & Erosion Control, Excavation, Ledge & Rock, Footings, Foundation Walls, Damp-Proofing / Waterproofing & Drainage, Backfill & Compaction, Concrete Slab, Permit, Inspections & Layout.\nPayment default for foundations: deposit / after footings / after walls and backfill, unless spoken otherwise. Pitfalls: frost depth is set by the local building department (commonly 48\" in MA/NH) — write 'per local frost depth' if unsure; ICF walls need bracing and a specific pour sequence; do not promise crack-free concrete.",
        "facts": {
          "clearing": {
            "pick": [["[aá]rvore|toco|stump|clear|limpar o terreno|limpeza do terreno|desmat", "Clear and grub the foundation area, including stump removal."]],
            "fallback": ""
          },
          "footing": {
            "re": "(?:footing|sapata)s?\\D{0,12}?(\\d{2})\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)?\\s*(?:x|por|by)\\s*(\\d{1,2})|(\\d{2})\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)?\\s*(?:x|por|by)\\s*(\\d{1,2})\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)?\\s*(?:footing|sapata)",
            "fmt": "**{g1}{g3}\" x {g2}{g4}\"** continuous concrete footings",
            "fallback": "continuous concrete footings sized per the drawings (or per IRC Table R403.1 as adopted)"
          },
          "wall": {
            "re": "(\\d{1,2})\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)\\s*(?:x|por|by)\\s*(\\d{1,2})\\s*(?:'|-?\\s?(?:foot|feet|ft|p[ée]s))",
            "fmt": "**{g1}\" x {g2}'** poured concrete foundation walls",
            "fallback": "poured concrete foundation walls (thickness and height per the drawings)"
          },
          "slabSpec": {
            "pick": [
              [
                "garag|exterior|externa|porch|varanda|degraus?|\\bsteps?\\b|p[aá]tio|patio|cal[cç]ada|walkway|sidewalk|driveway",
                "**3,500 psi air-entrained concrete (5–7% air)** — slab exposed to weather (IRC Table R402.2 as adopted in MA / NH: severe weathering)"
              ]
            ],
            "fallback": "**3,000 psi** concrete (interior / basement slab; slabs exposed to weather — garage, porch, steps — get 3,500 psi air-entrained concrete per IRC Table R402.2)"
          },
          "slabThick": {
            "re": "(\\d)\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)\\s*(?:de\\s+)?(?:slab|laje|concrete slab)|(?:slab|laje)[^.;,]{0,30}?\\b(\\d)\\s*(?:\"|-?\\s?inch(?:es)?|polegadas?)",
            "fmt": "**{1}\"** ",
            "fallback": ""
          }
        },
        "payment": {
          "milestones": [
            ["Deposit", "Upon signed acceptance, prior to excavation."], ["Footings Poured", "Upon footing inspection and footing pour."],
            ["Walls & Backfill", "Upon completion of foundation walls, damp-proofing, drainage, and backfill."]
          ]
        },
        "hic": true,
        "clientRole": "",
        "adjustExample": {
          "pt": "Ex.: “Tira o slab, muda o preço para 44 mil e acrescenta 60 pés de dreno.”",
          "en": "e.g. “Remove the slab, change the price to 44K and add 60 ft of drain.”",
          "es": "ej.: “Quita la losa, cambia el precio a 44 mil y agrega 60 pies de drenaje.”"
        }
      },
      prices: {
        "stores": [
          {
            "id": "readymix",
            "name": { "pt": "Concreteira local (ready-mix)", "en": "Local ready-mix concrete supplier", "es": "Proveedor local de concreto premezclado" },
            "short": { "pt": "Concreteira", "en": "Ready-mix", "es": "Concretera" },
            "search": "ready mix concrete"
          },
          {
            "id": "gravelpit",
            "name": { "pt": "Pedreira / cascalho local", "en": "Local quarry / gravel supplier", "es": "Cantera / proveedor local de grava" },
            "short": { "pt": "Pedreira", "en": "Quarry", "es": "Cantera" },
            "search": "gravel crushed stone supplier"
          },
          { "id": "whitecap", "name": "White Cap", "short": "White Cap", "search": "site:whitecap.com" },
          "homedepot",
          "lowes"
        ],
        "basic": [
          [
            { "pt": "Concreto 3000 psi (cubic yard)", "en": "3000 psi concrete (cubic yard)", "es": "Concreto de 3000 psi (yarda cúbica)" },
            { "pt": "Concreto", "en": "Concrete", "es": "Concreto" }, "cubic yard"
          ],
          [
            {
              "pt": "Concreto 3500 psi com ar incorporado (cubic yard) — slab de garagem / externo",
              "en": "3500 psi air-entrained concrete (cubic yard) — garage / exterior slab",
              "es": "Concreto de 3500 psi con aire incluido (yarda cúbica) — garaje / losa exterior"
            },
            { "pt": "Concreto", "en": "Concrete", "es": "Concreto" },
            "cubic yard"
          ],
          [
            { "pt": "Concreto 4000 psi (cubic yard)", "en": "4000 psi concrete (cubic yard)", "es": "Concreto de 4000 psi (yarda cúbica)" },
            { "pt": "Concreto", "en": "Concrete", "es": "Concreto" }, "cubic yard"
          ],
          [
            { "pt": "Bomba de concreto (por concretagem)", "en": "Concrete pump (per pour)", "es": "Bomba de concreto (por vaciado)" },
            { "pt": "Concreto", "en": "Concrete", "es": "Concreto" }, { "pt": "un", "en": "ea", "es": "c/u" }
          ],
          [
            { "pt": "Rebar #4 — 20 ft", "en": "#4 rebar — 20 ft", "es": "Varilla #4 — 20 ft" }, { "pt": "Armação", "en": "Reinforcement", "es": "Refuerzo" },
            { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Rebar #5 — 20 ft", "en": "#5 rebar — 20 ft", "es": "Varilla #5 — 20 ft" }, { "pt": "Armação", "en": "Reinforcement", "es": "Refuerzo" },
            { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          ["Anchor bolt 1/2\" x 10\"", { "pt": "Armação", "en": "Reinforcement", "es": "Refuerzo" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Form ties (caixa)", "en": "Form ties (box)", "es": "Amarres de formaleta (caja)" }, { "pt": "Formas", "en": "Forming", "es": "Formaletas" },
            { "pt": "caixa", "en": "box", "es": "caja" }
          ],
          [{ "pt": "Bloco ICF", "en": "ICF block", "es": "Bloque ICF" }, { "pt": "Formas", "en": "Forming", "es": "Formaletas" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Damp-proofing (balde 5 gal)", "en": "Damp-proofing (5 gal)", "es": "Damp-proofing (5 gal)" },
            { "pt": "Impermeabilização", "en": "Waterproofing", "es": "Impermeabilización" }, { "pt": "balde", "en": "bucket", "es": "cubeta" }
          ],
          [
            { "pt": "Membrana waterproofing (rolo)", "en": "Waterproofing membrane (roll)", "es": "Membrana impermeabilizante (rollo)" },
            { "pt": "Impermeabilização", "en": "Waterproofing", "es": "Impermeabilización" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [
            { "pt": "Tubo perfurado 4\" (10 ft)", "en": "4\" perforated pipe (10 ft)", "es": "Tubo perforado de 4\" (10 ft)" },
            { "pt": "Drenagem", "en": "Drainage", "es": "Drenaje" }, { "pt": "peça", "en": "each", "es": "c/u" }
          ],
          [
            { "pt": "Tecido filtrante (rolo)", "en": "Filter fabric (roll)", "es": "Tela filtrante (rollo)" },
            { "pt": "Drenagem", "en": "Drainage", "es": "Drenaje" }, { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          ["Sump pit / basin", { "pt": "Drenagem", "en": "Drainage", "es": "Drenaje" }, { "pt": "un", "en": "ea", "es": "c/u" }],
          [
            { "pt": "Pedra britada 3/4\" (ton)", "en": "3/4\" crushed stone (ton)", "es": "Piedra triturada de 3/4\" (tonelada)" },
            { "pt": "Agregados", "en": "Aggregates", "es": "Agregados" }, "ton"
          ],
          [
            { "pt": "Gravel / processed (ton)", "en": "Processed gravel (ton)", "es": "Grava procesada (tonelada)" },
            { "pt": "Agregados", "en": "Aggregates", "es": "Agregados" }, "ton"
          ],
          [
            { "pt": "Foam rígido XPS 2\" 4x8", "en": "2\" XPS rigid foam 4x8", "es": "Espuma rígida XPS de 2\" 4x8" },
            { "pt": "Isolamento", "en": "Insulation", "es": "Aislamiento" }, { "pt": "folha", "en": "sheet", "es": "hoja" }
          ],
          [
            { "pt": "Vapor barrier 10 mil (rolo)", "en": "10-mil vapor barrier (roll)", "es": "Barrera de vapor de 10 mil (rollo)" }, "Slab",
            { "pt": "rolo", "en": "roll", "es": "rollo" }
          ],
          [{ "pt": "Silt fence (rolo)", "en": "Silt fence (roll)", "es": "Silt fence (rollo)" }, "Sitework", { "pt": "rolo", "en": "roll", "es": "rollo" }],
          [
            { "pt": "Aluguel de escavadeira (dia)", "en": "Excavator rental (day)", "es": "Alquiler de excavadora (día)" },
            { "pt": "Equipamento", "en": "Equipment", "es": "Equipo" }, { "pt": "dia", "en": "day", "es": "día" }
          ]
        ],
        "basicOffer": [{ "list": "foundation", "label": { "pt": "Adicionar lista básica de fundação", "en": "Add basic foundation list", "es": "Agregar lista básica de cimientos" } }],
        "promos": false,
        "searchExample": {
          "pt": "ex.: concreto 3500 psi, rebar #4, anchor bolt",
          "en": "e.g. 3500 psi concrete, #4 rebar, anchor bolt",
          "es": "ej.: concreto de 3500 psi, varilla #4, perno de anclaje"
        }
      }
    }
    // ═══ fim dos ramos gerados ═══
  ];

  DEFS.forEach(defineTrade);
  // ramos extras antes do app carregar (testes / prévia de um docs/ramos/<id>.json): window.NV_EXTRA_TRADES = [json, …]
  (window.NV_EXTRA_TRADES || []).forEach(function (spec) { if (spec && spec.id && (!TRADES[spec.id] || window.NV_EXTRA_TRADES_OVERRIDE)) defineTrade(spec); });

  NV.TRADES = TRADES; NV.defineTrade = defineTrade; NV.tradeKey = tradeKey; NV.tradeDef = tradeDef; NV.tradeList = tradeList; NV.tradeLabel = tradeLabel;
  NV.tradeSuggest = function (id, d, co) { return suggestFor(tradeDef(id), d, co); };
  // mesmas regras aplicadas a um ramo em formato JSON (docs/ramos/<id>.json) sem registrar — os testes comparam com a fonte, não com a cópia gerada
  NV.tradeSuggestSpec = function (spec, d, co) { var tasks = {}; Object.keys(spec.tasks || {}).forEach(function (g) { tasks[g] = (spec.tasks[g] || []).map(function (x) { return typeof x === "string" ? x : x.pt; }); }); return suggestFor({ suggest: spec.suggest || {}, tasks: tasks }, d, co); };
  NV.tradeOpts = tradeOpts; NV.tradeAiRules = tradeAiRules;
  NV.tradeIntro = tradeIntro; NV.tradeDefaults = tradeDefaults; NV.tradeMultiKeys = tradeMultiKeys;
  NV.tradeStoreCatalog = STORE_CAT; NV.tradeTxt = txt;
  NV.tradeSections = tradeSections; NV.tradeSection = tradeSection; NV.tradeJobDefaults = tradeJobDefaults; NV.tradePayment = tradePayment; NV.tradeHic = tradeHic; NV.tradeWarnings = tradeWarnings;
  NV.speechPrice = speechPrice; NV.speechSplit = speechSplit; NV.speechHas = speechHas; NV.speechWords = wordsToDigits; NV.speechFact = factValue; NV.condLines = condLines;
})();
