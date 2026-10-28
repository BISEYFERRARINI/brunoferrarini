/* Bisey — motor da lista de material (o mesmo arquivo roda no app, nos testes em Node e na Edge Function "servicos").
   Não depende de tela nem de banco: recebe a lista, os seus preços ("Meus preços"), as promoções e as lojas, e devolve
   o melhor preço de cada item, as alternativas, os links das lojas e o resumo (mix mais barato × tudo numa loja só).
   Cópia do servidor: supabase/functions/_shared/matlist-core.js (node tools/build-matlist.js copia; tests/matlist.js confere).

   API (window.BiseyMat / window.NV.matlist / module.exports / globalThis.BiseyMat):
     storeLinks(override)            → modelos de busca por loja + parâmetros de afiliado (APP_CONFIG.STORE_LINKS sobrepõe)
     linkFor(store, q, o)            → link de busca da loja (com afiliado, se configurado)
     withAffiliate(url, store, L)    → acrescenta o parâmetro de afiliado num link de produto daquela loja
     normalizeDeal(d)                → promoção/oferta no formato único { store, product, price, validUntil, url, source, fetchedAt }
     matchScore(a, b) / matchMaterial(item, materials)
     priceList(list, ctx)            → { rows, mix, single, savings, byBest, stores, noPrice, … }
     cleanTakeoff(items)             → limpa o levantamento da IA (tira "by others", fornecido pelo dono, qtd inválida)
     takeoffSystem(cat, ctx) / takeoffUser(p) / TAKEOFF_TOOL → prompt do levantamento por ramo (servidor)
     mockTakeoff(cat, p, lang)       → levantamento de exemplo, determinístico (modo demonstração)
     quoteText(list, o) / csvRows(priced, o)
   Preços: "Meus preços" (mais recente por loja; > 30 dias = desatualizado, ainda vale mas aparece marcado) e promoções
   (vencida não vale; aparece riscada nas alternativas). Sem preço → links de busca das lojas. Nada aqui busca preço em site de loja. */
(function (root) {
  "use strict";
  var STALE_DAYS = 30;

  // ═══════════ links das lojas (pronto para afiliado: só configuração muda) ═══════════
  // search: modelo da busca ({q} = termo); affiliate: parâmetros acrescentados ao link ("tag=x&id=y"), vazio por padrão;
  // domain: links de produto (de promoções) desse domínio também recebem o parâmetro de afiliado.
  var DEFAULT_STORE_LINKS = {
    homedepot: { name: "The Home Depot", short: "Home Depot", search: "https://www.homedepot.com/s/{q}", domain: "homedepot.com", affiliate: "" },
    lowes: { name: "Lowe's", short: "Lowe's", search: "https://www.lowes.com/search?searchTerm={q}", domain: "lowes.com", affiliate: "" }
  };
  var ALWAYS = ["homedepot", "lowes"]; // toda lista mostra estas duas, além das lojas típicas do ramo
  function storeLinks(override) {
    var out = {};
    Object.keys(DEFAULT_STORE_LINKS).forEach(function (k) { out[k] = Object.assign({}, DEFAULT_STORE_LINKS[k]); });
    Object.keys(override || {}).forEach(function (k) { out[k] = Object.assign({}, out[k] || {}, override[k] || {}); });
    return out;
  }
  function addParams(url, params) {
    if (!params) return url;
    var hash = "", i = url.indexOf("#"); if (i >= 0) { hash = url.slice(i); url = url.slice(0, i); }
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + String(params).replace(/^[?&]/, "") + hash;
  }
  function withAffiliate(url, store, L) {
    var c = (L || {})[store]; if (!url || !c || !c.affiliate) return url;
    if (c.domain) { var host = ""; try { host = new URL(url).hostname; } catch (e) { host = ""; } if (host && host !== c.domain && host.slice(-(c.domain.length + 1)) !== "." + c.domain) return url; }
    return addParams(url, c.affiliate);
  }
  // o: { links, tpl } — tpl = modelo do ramo para a loja (trades.js: busca do site / Google "site:")
  function linkFor(store, q, o) {
    o = o || {}; var L = o.links || storeLinks(), c = L[store] || {}, enc = encodeURIComponent(String(q || "").trim()), url;
    if (c.search) url = c.search.replace("{q}", enc);
    else if (o.tpl) url = o.tpl.replace("{q}", enc);
    else url = "https://www.google.com/search?q=" + encodeURIComponent(String(store) + " " + (q || ""));
    return c.affiliate ? addParams(url, c.affiliate) : url;
  }

  // ═══════════ texto e cruzamento de nomes ═══════════
  // palavras de um nome, com cache: o cruzamento item × "Meus preços" × promoções chama isto milhares de vezes com os mesmos textos
  var WCACHE = Object.create(null), WCOUNT = 0;
  function wordsC(s) {
    var k = String(s || ""), c = WCACHE[k]; if (c) return c;
    if (++WCOUNT > 20000) { WCACHE = Object.create(null); WCOUNT = 1; }
    return (WCACHE[k] = splitWords(k));
  }
  function words(s) { return wordsC(s).slice(); } // cópia: quem chama de fora pode mexer no array
  function splitWords(s) {
    var t = String(s || "").toLowerCase();
    try { t = t.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { }
    return t.replace(/(\d)\s*(?:"|''|in\b|inch(?:es)?\b)/g, "$1in").replace(/[^a-z0-9/.]+/g, " ").replace(/(^|\s)\.|\.(\s|$)/g, " ")
      .split(" ").filter(function (w) { return w.length > 1 && !STOP[w]; });
  }
  var STOP = { de: 1, da: 1, do: 1, the: 1, and: 1, com: 1, with: 1, for: 1, para: 1, por: 1, of: 1, en: 1, el: 1, la: 1, off: 1, sale: 1, save: 1, clearance: 1, deal: 1, promo: 1, each: 1, ea: 1, un: 1, pack: 1 };
  function isSpec(w) { return /\d/.test(w) && !/%$/.test(w); }
  // pontuação 0–1 entre dois nomes; números que não batem ("12/2" × "14/2", "20a" × "15a", 1/2in × 3/4in) zeram
  function matchScore(a, b) {
    a = typeof a === "string" ? wordsC(a) : a; b = typeof b === "string" ? wordsC(b) : b;
    if (!a.length || !b.length) return 0;
    var hits = a.filter(function (w) { return b.indexOf(w) >= 0; }).length;
    var sc = hits / Math.max(3, Math.min(a.length, b.length));
    var da = a.filter(isSpec), db = b.filter(isSpec);
    if (da.length && db.length) {
      if (!da.some(function (w) { return db.indexOf(w) >= 0; })) return 0;
      var fa = da.filter(function (w) { return /\d\/\d/.test(w); }), fb = db.filter(function (w) { return /\d\/\d/.test(w); });
      if (fa.length && fb.length && !fa.some(function (w) { return fb.indexOf(w) >= 0; })) return 0;
    }
    return sc;
  }
  function itemNames(it) { var n = [it.name, it.search].concat(it.alt || []); if (it.spec) n.push(it.name + " " + it.spec); return n.filter(Boolean); }
  function bestScore(it, name) { var b = wordsC(name); return itemNames(it).reduce(function (m, n) { return Math.max(m, matchScore(wordsC(n), b)); }, 0); }
  // material de "Meus preços" que corresponde ao item (mesma regra de antes: ≥ 0.5; um vínculo manual it.materialId vence)
  function matchMaterial(it, materials, min) {
    materials = materials || [];
    if (it.materialId) { var f = materials.filter(function (m) { return m.id === it.materialId; })[0]; if (f) return f; }
    var best = null, bs = 0;
    materials.forEach(function (m) { var s = bestScore(it, m.name); if (s > bs) { bs = s; best = m; } });
    return bs >= (min == null ? 0.5 : min) ? best : null;
  }

  // ═══════════ datas ═══════════
  function dayNum(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; }
  function ageDays(iso, today) { var a = dayNum(iso), b = dayNum(today); return a == null || b == null ? null : Math.round(b - a); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  // ═══════════ promoções: um formato só ═══════════
  // Fontes: "manual" (Ofertas anotadas à mão), "import" (ofertas que a empresa importou), "feed" (feed OFICIAL de loja /
  // programa de afiliados — no futuro, só dados novos na tabela deals), "auto" (busca diária de promoções que já existe) e "file" (promos.json).
  // Regra dos varejistas (docs/11-afiliados-e-parcerias.md): preço de loja só aparece na lista se veio de você (Meus preços / oferta
  // registrada ou importada) ou de feed oficial. "auto" e "file" continuam na aba Promoções, mas NÃO dão preço a item da lista.
  var PRICE_SOURCES = { manual: "registered", import: "registered", feed: "feed" };
  function hasAffiliate(L, stores) { return (stores || []).some(function (s) { return !!((L || {})[s] || {}).affiliate; }); }
  function normalizeDeal(d) {
    d = d || {};
    var price = d.price == null || d.price === "" ? null : Number(d.price);
    return { id: d.id || null, store: d.store || "", product: String(d.product || d.title || ""), price: isFinite(price) ? price : null,
      wasPrice: d.wasPrice != null ? Number(d.wasPrice) : d.was_price != null ? Number(d.was_price) : null,
      validUntil: d.validUntil || d.valid_until || "", url: d.url || "", source: d.source || "manual", fetchedAt: d.fetchedAt || d.fetched_at || d.createdAt || d.created_at || "" };
  }

  // ═══════════ candidatos de preço de um item ═══════════
  // ctx: { materials, deals, today, links, stores: [{ id, name, short, url }] }
  function candidates(it, ctx) {
    var today = ctx.today || todayISO(), L = ctx.links || storeLinks(), out = [];
    var m = matchMaterial(it, ctx.materials);
    if (m) {
      var latest = {};
      (m.prices || []).forEach(function (p) { if (!p.store || !(Number(p.price) > 0)) return; var c = latest[p.store]; if (!c || String(p.date || "") > String(c.date || "")) latest[p.store] = p; });
      Object.keys(latest).forEach(function (s) {
        var p = latest[s], age = ageDays(p.date, today);
        out.push({ store: s, unit: Number(p.price), src: "mine", kind: "mine", date: p.date || "", age: age, stale: age != null && age > STALE_DAYS, expired: false, material: m.id, url: "" });
      });
    }
    (ctx.deals || []).forEach(function (d0) {
      var d = d0.product != null && d0.source != null ? d0 : normalizeDeal(d0);
      if (d.price == null || !(d.price > 0) || !d.store || !d.product || !PRICE_SOURCES[d.source]) return;
      if (bestScore(it, d.product) < 0.6) return; // promoções: exigem nome mais parecido
      var expired = !!(d.validUntil && String(d.validUntil).slice(0, 10) < today), age = d.fetchedAt ? ageDays(String(d.fetchedAt).slice(0, 10), today) : null;
      out.push({ store: d.store, unit: d.price, src: "promo", kind: PRICE_SOURCES[d.source], date: d.validUntil || "", until: d.validUntil || "", age: age, stale: !d.validUntil && age != null && age > STALE_DAYS, expired: expired,
        title: d.product, deal: d.id, url: d.url ? withAffiliate(d.url, d.store, L) : "" });
    });
    out.forEach(function (c) { if (!c.url) c.url = linkFor(c.store, it.search || it.name, { links: L, tpl: tplOf(ctx, c.store) }); });
    // mais barato primeiro; no empate, promoção válida e preço mais novo
    out.sort(function (a, b) { return (a.expired - b.expired) || (a.unit - b.unit) || ((a.src === "promo" ? 0 : 1) - (b.src === "promo" ? 0 : 1)) || ((a.age == null ? 1e6 : a.age) - (b.age == null ? 1e6 : b.age)); });
    return out;
  }
  function tplOf(ctx, store) { var s = (ctx.stores || []).filter(function (x) { return x.id === store; })[0]; return s ? (typeof s.url === "string" ? s.url : s.tpl || "") : ""; }
  function storeIds(ctx) {
    var ids = (ctx.stores || []).map(function (s) { return s.id; });
    ALWAYS.forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); });
    return ids;
  }

  // ═══════════ lista com preço + resumo ═══════════
  function priceList(list, ctx) {
    ctx = ctx || {}; var L = ctx.links || (ctx.links = storeLinks()), items = (list && list.items) || list || [];
    var ids = storeIds(ctx), perStore = {}, rows = [];
    items.forEach(function (it, idx) {
      var qty = Number(it.qty) || 0, all = candidates(it, ctx), valid = all.filter(function (c) { return !c.expired; }), best = valid[0] || null;
      var atStore = {}; valid.forEach(function (c) { if (!atStore[c.store] || c.unit < atStore[c.store].unit) atStore[c.store] = c; });
      Object.keys(atStore).forEach(function (s) { if (ids.indexOf(s) < 0) ids.push(s); });
      var links = ids.map(function (s) { return { store: s, url: linkFor(s, it.search || it.name, { links: L, tpl: tplOf(ctx, s) }) }; });
      rows.push({ idx: idx, item: it, qty: qty, best: best, total: best ? r2(best.unit * qty) : null, alts: all.filter(function (c) { return c !== best; }), atStore: atStore, links: links,
        buyUrl: best ? best.url : links[0].url, bought: it.bought || null });
    });
    var priced = rows.filter(function (r) { return r.best; }), mix = r2(priced.reduce(function (a, r) { return a + r.total; }, 0));
    ids.forEach(function (s) {
      var cov = rows.filter(function (r) { return r.atStore[s]; });
      if (!cov.length) return;
      perStore[s] = { store: s, covered: cov.length, missing: rows.length - cov.length, total: r2(cov.reduce(function (a, r) { return a + r.atStore[s].unit * r.qty; }, 0)),
        mixSame: r2(cov.reduce(function (a, r) { return a + r.total; }, 0)) };
    });
    var stores = Object.keys(perStore).map(function (k) { return perStore[k]; }).sort(function (a, b) { return (b.covered - a.covered) || (a.total - b.total); });
    var single = stores[0] || null;
    if (single) { single = Object.assign({}, single, { savings: r2(single.total - single.mixSame), full: single.covered === priced.length }); }
    var by = {}; priced.forEach(function (r) { var s = r.best.store; (by[s] = by[s] || { store: s, total: 0, n: 0, rows: [] }); by[s].total = r2(by[s].total + r.total); by[s].n++; by[s].rows.push(r); });
    var bought = rows.filter(function (r) { return r.bought; }), pend = bought.filter(function (r) { return Number(r.bought.price) > 0 && !r.bought.expenseId; });
    return {
      rows: rows, count: rows.length, priced: priced.length, noPrice: rows.length - priced.length, mix: mix, single: single, savings: single ? Math.max(0, single.savings) : 0,
      stores: stores, byBest: Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.total - a.total; }),
      stale: priced.filter(function (r) { return r.best.stale; }).length, promos: priced.filter(function (r) { return r.best.src === "promo"; }).length,
      boughtCount: bought.length, boughtTotal: r2(bought.reduce(function (a, r) { return a + (Number(r.bought.price) || 0); }, 0)),
      pending: { n: pend.length, total: r2(pend.reduce(function (a, r) { return a + Number(r.bought.price); }, 0)), rows: pend }
    };
  }
  // resumo gravado junto da lista (aviso "economia estimada"); a tela sempre recalcula com os preços de hoje
  function snapshot(priced) { return { mix: priced.mix, single: priced.single ? { store: priced.single.store, total: priced.single.total, covered: priced.single.covered } : null, savings: priced.savings, priced: priced.priced, noPrice: priced.noPrice }; }

  // ═══════════ levantamento (IA no servidor / exemplo no demo) ═══════════
  var BY_OTHERS = /\b(by others|furnished by (?:the )?(?:owner|others|gc)|owner[- ]?(?:supplied|furnished|provided)|supplied by (?:the )?(?:owner|others|customer|client)|customer[- ]supplied|n\.?i\.?c\.?\b|not in contract|pelo (?:dono|cliente)|por (?:outros|terceiros)|fornecid[oa] pelo (?:dono|cliente))/i;
  function cleanTakeoff(items) {
    var seen = {};
    return (items || []).filter(function (it) {
      if (!it || !String(it.name || "").trim()) return false;
      if (it.ownerSupplied || it.byOthers || BY_OTHERS.test(String(it.name) + " " + String(it.spec || "") + " " + String(it.note || ""))) return false;
      return Number(it.qty) > 0;
    }).map(function (it, i) {
      var o = { id: it.id || "t" + (i + 1), name: String(it.name).trim().slice(0, 140), qty: r2(Number(it.qty)), unit: String(it.unit || "ea").trim().slice(0, 24),
        category: String(it.category || "").trim().slice(0, 40), search: String(it.search || it.name).trim().slice(0, 80) };
      if (it.brand) o.brand = String(it.brand).trim().slice(0, 60);
      if (it.spec) o.spec = String(it.spec).trim().slice(0, 120);
      if (it.alt) o.alt = it.alt;
      return o;
    }).filter(function (it) { var k = it.name.toLowerCase() + "|" + it.unit; if (seen[k]) { seen[k].qty = r2(seen[k].qty + it.qty); return false; } seen[k] = it; return true; });
  }
  function pick(x, l) { return x == null ? "" : typeof x === "string" ? x : x[l] != null ? x[l] : x.pt != null ? x.pt : x.en || ""; }
  var TAKEOFF_TOOL = { name: "takeoff", description: "Material list to buy for the job", input_schema: { type: "object", properties: {
    items: { type: "array", items: { type: "object", properties: {
      name: { type: "string", description: "item as sold by US suppliers" }, qty: { type: "number" }, unit: { type: "string", description: "unit as sold: ea, roll, box, sheet, gal, bundle, square, bag, ft…" },
      category: { type: "string" }, search: { type: "string", description: "short generic search term for store websites (no brand unless the scope requires it)" },
      brand: { type: "string", description: "only when the scope names a brand / product line" }, spec: { type: "string", description: "size, rating, color or model when it matters" } },
      required: ["name", "qty", "unit", "category", "search"] } },
    notes_pt: { type: "string", description: "short notes in Portuguese for the contractor (assumptions, items to confirm)" } }, required: ["items"] } };
  // cat = catálogo do ramo (trade-catalog.json → trades[id]); ctx: { state, others: [cat…] (outros ramos da empresa) }
  function takeoffSystem(cat, ctx) {
    ctx = ctx || {}; var label = pick(cat.label, "en") || cat.id, scope = cat.scope || label, role = cat.role || label + " Contractor";
    var stores = (cat.stores || []).map(function (s) { return pick(s.name, "en"); }).concat(["The Home Depot", "Lowe's"]).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var typical = (cat.items || []).slice(0, 40).map(function (it) { return pick(it.n, "en") + " (" + pick(it.u, "en") + ")"; }).join("; ");
    var others = (ctx.others || []).filter(function (o) { return o && o.id !== cat.id; }).map(function (o) { return pick(o.label, "en"); });
    return "You are an experienced " + role + " estimator" + (ctx.state ? " in " + ctx.state : "") + ", doing a material takeoff for purchasing. " +
      "From the scope, list ONLY the " + scope + " materials the crew must BUY for this job. " +
      "Exclude anything owner-supplied, furnished by others, \"by others\", listed under NOT INCLUDED, labor, permits, equipment rental and subcontracted work" +
      (others.length ? " (the company also works in " + others.join(", ") + ", but only take off what this proposal's scope covers)" : "") + ". " +
      "Be realistic with quantities for the described job and add normal waste (about 10% on wire, pipe, sheet goods, shingles, flooring and paint). " +
      "Name each item the way US suppliers sell it (" + stores.join(", ") + "). Give for each line: name, qty (number), unit as sold, category, a short generic search term for store websites, and brand/spec only when the scope names them or they matter (size, rating, color). " +
      "Group identical items. 8–40 lines." +
      (cat.rules ? "\nTrade rules: " + cat.rules : "") +
      (typical ? "\nTypical items for this trade (follow these names and units when they fit): " + typical + "." : "");
  }
  function lines(t) { return String(t || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean); }
  function takeoffUser(d) {
    d = d || {};
    var scope = (d.sections || []).map(function (s) { return "## " + s.title + "\n" + s.text; }).join("\n\n");
    return "Job: " + (d.subtitle || "") + " at " + ((d.client || {}).address || "") + "\n\nSCOPE:\n" + scope +
      "\n\nINVESTMENT LINES:\n" + (d.items || []).map(function (i) { return i.desc; }).filter(Boolean).join("\n") +
      (d.notIncluded ? "\n\nNOT INCLUDED (do NOT take these off):\n" + d.notIncluded : "") +
      (lines(d.clarifications).length ? "\n\nCLARIFICATIONS:\n" + lines(d.clarifications).join("\n") : "");
  }
  // levantamento de exemplo: itens da lista básica do ramo, os citados no escopo primeiro, quantidades estáveis (mesmo resultado sempre)
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // item grande (painel, medidor, equipamento, haste…): 1 ou 2; o resto pela unidade
  var BIG = /panel|meter|socket|ground rod|breaker panel|load center|condenser|heat pump|air handler|furnace|boiler|water heater|tankless|thermostat|disconnect|riser|valve assembly|fdc|backflow|dumpster|painel|medidor|haste|condensadora|aquecedor|termostato/i;
  function rangeFor(u, name) {
    if (/shingle/i.test(name || "") && !/starter|ridge|hip/i.test(name || "")) return [45, 90]; // 3 bundles por square
    if (BIG.test(name || "")) return [1, 2];
    u = String(u || "").toLowerCase();
    if (/roll|coil|rolo|rollo/.test(u)) return [1, 4];
    if (/sheet|folha|hoja|square|^sq$/.test(u)) return [10, 40];
    if (/cubic|yard|^cy$/.test(u)) return [4, 14];
    if (/gal|quart|^qt/.test(u)) return [2, 10];
    if (/\bft\b|linear|^lf$|feet|pie/.test(u)) return [40, 250];
    if (/box|caixa|caja|pail|balde|cubeta|bag|saco|bolsa|bundle|paquete|case|tube|tubo/.test(u)) return [1, 6];
    return [2, 12];
  }
  function mockTakeoff(cat, p, lang) {
    lang = lang || "pt"; p = p || {};
    var text = [p.subtitle, p.speech].concat((p.sections || []).map(function (s) { return s.title + " " + s.text; })).concat((p.items || []).map(function (i) { return i.desc; })).join(" ");
    var tw = words(text), seed = hash(p.id || p.number || "bisey"), f = Math.max(0.6, Math.min(3, (Number(p.total) || 12000) / 12000));
    var hit = [], rest = [];
    (cat.items || []).forEach(function (it, i) {
      var key = wordsC(pick(it.n, "en") + " " + pick(it.n, "pt")).filter(function (w) { return w.length >= 4 && !/\d/.test(w); });
      (key.some(function (w) { return tw.indexOf(w) >= 0; }) ? hit : rest).push(i);
    });
    var n = Math.min((cat.items || []).length, Math.max(10, Math.min(16, hit.length))), pickI = hit.concat(rest).slice(0, n).sort(function (a, b) { return a - b; });
    return pickI.map(function (i, k) {
      var it = cat.items[i], r = rangeFor(pick(it.u, "en"), pick(it.n, "en")), x = (((seed >>> (k % 24)) ^ hash(i + ":" + seed)) >>> 0) % 1000 / 1000;
      var q = Math.max(1, Math.round((r[0] + x * (r[1] - r[0])) * (r[1] <= 2 || r[0] >= 45 ? 1 : r[1] <= 6 ? Math.min(f, 2) : f)));
      var alt = ["pt", "en", "es"].map(function (l) { return pick(it.n, l); }).filter(function (v, j, a) { return v && a.indexOf(v) === j; });
      return { id: "m" + (k + 1), name: pick(it.n, lang), qty: q, unit: pick(it.u, lang), category: pick(it.c, lang), search: pick(it.n, "en").replace(/\s*[—–-]\s*/g, " ").replace(/[()]/g, "").trim(), alt: alt };
    });
  }

  // ═══════════ exportar / pedir cotação ═══════════
  function qtyTxt(it) { return (Number(it.qty) || 0) + " " + (it.unit || ""); }
  // o: { money, head: [rótulos], storeName(id) }
  function csvRows(priced, o) {
    o = o || {}; var sn = o.storeName || function (s) { return s; };
    var rows = [o.head || (o.money ? ["Item", "Qty", "Unit", "Category", "Best store", "Unit price", "Total", "Link", "Bought by"] : ["Item", "Qty", "Unit", "Category", "Link", "Bought by"])];
    priced.rows.forEach(function (r) {
      var it = r.item, by = r.bought ? r.bought.byName || "" : "";
      var name = it.name + (it.spec ? " — " + it.spec : "") + (it.brand ? " (" + it.brand + ")" : "");
      rows.push(o.money ? [name, it.qty, it.unit || "", it.category || "", r.best ? sn(r.best.store) : "", r.best ? r2(r.best.unit).toFixed(2) : "", r.total != null ? r.total.toFixed(2) : "", r.buyUrl, by]
        : [name, it.qty, it.unit || "", it.category || "", r.links[0] ? r.links[0].url : "", by]);
    });
    if (o.money) rows.push(["", "", "", "", "", "", priced.mix.toFixed(2), "", ""]);
    return rows;
  }
  // pedido de cotação ao fornecedor (em inglês: fornecedores dos EUA); quantidades, sem os seus preços
  function quoteText(list, o) {
    o = o || {}; var items = (list && list.items) || list || [];
    return "Hello" + (o.supplier ? " " + o.supplier : "") + ",\n\nPlease send us your best price and availability for the materials below" + (o.job ? " for the job at " + o.job : "") + ".\n\n" +
      items.map(function (it, i) { return (i + 1) + ". " + qtyTxt(it) + " — " + it.name + (it.spec ? " (" + it.spec + ")" : "") + (it.brand ? " · " + it.brand : ""); }).join("\n") +
      (o.note ? "\n\n" + o.note : "") + "\n\nThank you,\n" + (o.company || "");
  }

  // catálogo de materiais por ramo (matlist-catalog.js, gerado): só é baixado quando precisa (lista de exemplo, "+ Item")
  var catP = null;
  function loadCatalog(src) {
    if (root && root.NV && root.NV.MATCAT) return Promise.resolve(root.NV.MATCAT);
    if (typeof document === "undefined") return Promise.reject(new Error("NO_CATALOG"));
    if (!catP) catP = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src || "matlist-catalog.js"; s.async = true;
      s.onload = function () { if (root.NV && root.NV.MATCAT) res(root.NV.MATCAT); else { catP = null; rej(new Error("NO_CATALOG")); } };
      s.onerror = function () { catP = null; rej(new Error("NO_CATALOG")); };
      (document.head || document.documentElement).appendChild(s);
    });
    return catP;
  }

  var API = { STALE_DAYS: STALE_DAYS, PRICE_SOURCES: PRICE_SOURCES, hasAffiliate: hasAffiliate, loadCatalog: loadCatalog, DEFAULT_STORE_LINKS: DEFAULT_STORE_LINKS, ALWAYS: ALWAYS, storeLinks: storeLinks, linkFor: linkFor, withAffiliate: withAffiliate,
    words: words, matchScore: matchScore, matchMaterial: matchMaterial, normalizeDeal: normalizeDeal, candidates: candidates, priceList: priceList, snapshot: snapshot,
    cleanTakeoff: cleanTakeoff, takeoffSystem: takeoffSystem, takeoffUser: takeoffUser, TAKEOFF_TOOL: TAKEOFF_TOOL, mockTakeoff: mockTakeoff,
    csvRows: csvRows, quoteText: quoteText, ageDays: ageDays, todayISO: todayISO, r2: r2, pick: pick };
  if (root) { root.BiseyMat = API; if (root.NV) root.NV.matlist = API; }
  if (typeof module === "object" && module && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
