/* Propostas (proposals) + Preços de material — admin only. Plugs into app.js through window.EE. */
(function () {
  "use strict";
  var E = window.EE, S = E.S, API = E.API, esc = E.esc, money = E.money, EXT = E.EXT, t = E.t, tv = E.tv;
  function $(s) { return document.querySelector(s); }
  function num(v) { var n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function get(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function set(o, p, v) { var ks = p.split("."), x = o; for (var i = 0; i < ks.length - 1; i++) { if (x[ks[i]] == null) x[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = v; }
  function today() { return E.todayISO(); }
  function longDate(iso) { if (!iso) return ""; var d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  function money2(n) { return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function g(q) { return "https://www.google.com/search?q=" + encodeURIComponent(q); }
  function lines(t) { return String(t || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean); }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }

  S.proposals = []; S.materials = []; S.deals = []; S.pdraft = null; S.priceFilter = { q: "", cat: "" };

  // ═══════════ lojas ═══════════
  // fornecedores por ramo: trades.js → prices.stores (colunas de "Meus preços"; o mais barato fica verde)
  var NV = window.NV;
  var STORES = NV.tradeDef("electrical").prices.stores;
  function tradeDef(co) { return NV.tradeDef(tradeKey(co)); }
  // colunas = lojas do ramo + qualquer loja em que a empresa já tem preço salvo (nada some quando a lista do ramo muda — B16)
  function syncStores() {
    var base = tradeDef(S.company).prices.stores, ids = base.map(function (s) { return s.id; }), extra = [];
    (S.materials || []).forEach(function (m) { (m.prices || []).forEach(function (pr) { if (pr.store && ids.indexOf(pr.store) < 0) { ids.push(pr.store); extra.push(pr.store); } }); });
    STORES = extra.length ? base.concat(extra.map(storeOf)) : base;
  }
  function storeOf(id) { var found = null; NV.tradeList().some(function (t) { return t.prices.stores.some(function (s) { if (s.id === id) { found = s; return true; } return false; }); }); return found || { id: id, name: id, short: id, url: function (q) { return "https://www.google.com/search?q=" + encodeURIComponent(id + " " + q); } }; }
  function storeName(id) { var s = STORES.find(function (x) { return x.id === id; }); return s ? s.short : id; }
  function latest(m, store) {
    var list = (m.prices || []).filter(function (p) { return p.store === store; });
    list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return list[0] || null;
  }
  function best(m) {
    syncStores(); var b = null;
    STORES.forEach(function (s) { var p = latest(m, s.id); if (p && (!b || p.price < b.price)) b = p; });
    return b;
  }
  function daysAgo(iso) { return Math.floor((Date.now() - new Date(iso + "T12:00:00")) / 864e5); }
  function matById(id) { return S.materials.find(function (m) { return m.id === id; }); }

  // ═══════════ empresas (cabeçalho do documento) ═══════════
  var CO = {
    eternity: { brand: "Eternity Electric", title: "ELECTRICAL PROPOSAL", tagline: "LICENSED ELECTRICAL CONTRACTOR", contact: "Commonwealth of Massachusetts · office@eternityelectrical.com",
      footer: "Eternity Electric · office@eternityelectrical.com · Licensed Electrical Contractor MA", role: "Licensed Electrical Contractor", logo: "icons/logo-eternity.png", logoSm: "icons/mark-eternity.png",
      accent: "#B08A4A", dark: "#2B241D", bg: "#FBF7F1", payTo: "Eternity Electric", email: "office@eternityelectrical.com" },
    bluestar: { brand: "Blue Star HVAC", title: "HVAC PROPOSAL", tagline: "LICENSED HVAC CONTRACTOR", contact: "9 Ladd Pl, Watertown, MA · bluestarhvac.inc@gmail.com · (857) 505-5740 · (774) 244-7256",
      footer: "Blue Star HVAC Inc. · 9 Ladd Pl, Watertown, MA · bluestarhvac.inc@gmail.com", role: "Licensed HVAC Contractor", logo: "icons/logo-bluestar.png", logoSm: "icons/mark-bluestar.png", logoW: "2.5in", accent: "#B3202A", dark: "#13233A", bg: "#F7F9FC", payTo: "Blue Star HVAC Inc.", email: "bluestarhvac.inc@gmail.com" }
  };

  // ramo da empresa para propostas: id canônico do registro (trades.js; "general" do banco multiempresa → gc)
  function tradeKey(co) { return NV.tradeKey(E.tradeOf(co)); }
  var STATE_NAMES = { MA: "Massachusetts", NH: "New Hampshire", RI: "Rhode Island", CT: "Connecticut", VT: "Vermont", ME: "Maine", NY: "New York", NJ: "New Jersey", PA: "Pennsylvania", FL: "Florida", GA: "Georgia", TX: "Texas", CA: "California", NC: "North Carolina", VA: "Virginia", MD: "Maryland", IL: "Illinois", OH: "Ohio" };
  function coRec(id) { return (API.companies || []).find(function (c) { return c.id === id; }) || null; }
  function stateOf(co) { var c = coRec(co); return (c && c.state) || "MA"; }
  // cabeçalho do documento: Eternity/Blue Star usam o modelo pré-configurado; as outras empresas usam o que está em Configurações → Empresa
  function coFor(id, p) {
    if (CO[id]) return CO[id];
    var c = coRec(id) || (p && p.companyBrand) || null;
    if (!c) return p && p._public ? NEUTRAL : CO.eternity; // página do cliente sem dados da empresa: texto neutro (nunca a marca de outra empresa)
    var td = NV.tradeDef(c.trade).proposal, name = c.name || "Company";
    var contact = [c.address, c.email, c.phone].filter(Boolean).join(" · ") || (STATE_NAMES[c.state] || c.state || "");
    var accent = /^#[0-9a-f]{6}$/i.test(c.accent || "") ? c.accent : "#2A5BFF";
    return { brand: name, title: td.title, tagline: td.tagline + (c.license ? " · LIC. " + String(c.license).toUpperCase() : ""), contact: contact,
      footer: [name, c.email, c.phone, c.license ? "License " + c.license : ""].filter(Boolean).join(" · "), role: td.role, logo: c.logo || "", logoSm: c.logo || "", logoW: "1.3in",
      accent: accent, dark: "#1C2230", bg: "#FAFAF8", payTo: name, email: c.email || "", custom: true };
  }
  // cabeçalho neutro (página pública sem dados da empresa em Configurações → Empresa)
  var NEUTRAL = { brand: "", title: "PROPOSAL", tagline: "", contact: "", footer: "", role: "Contractor", logo: "", logoSm: "", logoW: "1.3in", accent: "#2A5BFF", dark: "#1C2230", bg: "#FAFAF8", payTo: "", email: "", custom: true, neutral: true };
  // instantâneo da marca na proposta (a página pública do cliente não carrega as empresas da conta)
  function brandSnap(id) { var c = coRec(id); if (!c || CO[id]) return null; return { name: c.name, trade: c.trade, accent: c.accent || "", email: c.email || "", phone: c.phone || "", address: c.address || "", license: c.license || "", state: c.state || "", hicReg: c.hicReg || "" }; }

  // seções padrão por ramo: trades.js → proposal.sections ([título, texto]) e proposal.keywords (modo sem IA)
  function SECTIONS_OF(tr) { return NV.tradeDef(tr).proposal.sections; }

  var PAY = {
    "50/50": [["Deposit", "Upon signed acceptance of this proposal.", 50], ["Final Payment", "Upon completion and final inspection.", 50]],
    "30/40/30": [["Deposit", "Upon signed acceptance, prior to mobilization.", 30], ["Rough-In", "Upon completion of rough-in and rough inspection.", 40], ["Final Payment", "Upon completion, final inspection and AHJ sign-off.", 30]],
    "Bank 35/35/30": [["First Draw", "Performance affidavit issued to the bank upon mobilization and start of work.", 35], ["Second Draw", "After rough inspection, second performance affidavit issued to the bank.", 35], ["Final Draw", "After final inspection and AHJ sign-off, completion affidavit issued to the bank.", 30]],
    "100% final": [["Payment in Full", "Upon completion and final inspection.", 100]]
  };

  // textos padrão (includes / not included / clarifications / warranty) e introdução: trades.js → proposal.defaults / proposal.intro
  // {brand} = nome da empresa no cabeçalho; {state} = estado da empresa (Configurações → Empresa); {code} = código do estado
  function defaults(co) {
    var c = coFor(co), st = STATE_NAMES[stateOf(co)] || stateOf(co);
    return NV.tradeDefaults(tradeKey(co), { brand: c.brand, state: st, code: stateOf(co), co: E.coFlags(co) }); // linhas "[MA] …", "[co:noGas] …"; sem sales tax em NH
  }
  function introText(p) {
    var where = p.client.address || "the project location";
    var what = p.subtitle ? "the " + p.subtitle.toLowerCase().replace(/ · /g, " — ") : "the project";
    return NV.tradeIntro(tradeKey(p.companyId), { what: what, where: where, state: stateOf(p.companyId), co: E.coFlags(p.companyId), preset: !!CO[p.companyId] });
  }
  function secCtx(co) { return { code: stateOf(co), co: E.coFlags(co) }; }
  // contrato residencial de MA (lei HIC): bloco de cláusulas quando o ramo é HIC, a empresa é de MA e o cliente é o dono da casa
  function hicFor(p) {
    var c = coFor(p.companyId, p), r = coRec(p.companyId) || p.companyBrand || {};
    return NV.tradeHic(tradeKey(p.companyId), { state: stateOf(p.companyId), role: p.client.role, brand: c.brand, hic: r.hicReg || "", address: r.address || "",
      client: p.client.name, where: p.client.address, start: p.startDate ? longDate(p.startDate) : "", end: p.endDate ? longDate(p.endDate) : "" });
  }
  function refreshHic(p) { if (isInv(p)) return; if (p.hicAuto !== false || !p.hic) { p.hic = hicFor(p); p.hicAuto = true; } }
  function capDeposit(p) { return !!hicFor(p); }
  // presets do cronograma no ramo (marcos do ramo: telhado "Tear-Off & Dry-In", pintura "Midpoint"…; os outros como sempre)
  function payPreset(p, key) {
    var tr = tradeKey(p.companyId);
    if (key === "50/50") return NV.tradePayment(tr, { split: [50, 50], capDeposit: capDeposit(p) });
    if (key === "30/40/30") return NV.tradePayment(tr, { split: [30, 40, 30] });
    return clone(PAY[key]);
  }
  function nextNumber(type) {
    var inv = type === "invoice", blue = S.company === "bluestar", max = inv ? (blue ? 5000 : 1000) : (blue ? 1000 : CO[S.company] ? 366 : 1000), re = inv ? /^INV/i : /^EST/i;
    S.proposals.forEach(function (p) { if (p.companyId !== S.company || !re.test(p.number || "")) return; var m = /(\d+)/.exec(p.number || ""); if (m) max = Math.max(max, Number(m[1])); });
    return (inv ? "INV" : "EST") + (max + 1);
  }
  function blankProposal() {
    var co = S.company, c = coFor(co), d = defaults(co), td = NV.tradeDef(tradeKey(co)).proposal;
    // tipo de cliente: Eternity / Blue Star como sempre ("General Contractor"); outras empresas, o do ramo (residencial: "Homeowner") ou vazio (B18)
    var role = CO[co] ? "General Contractor" : td.clientRole != null ? td.clientRole : "";
    var p = { id: null, docType: "estimate", speech: "", notes: [], companyId: co, number: nextNumber(), status: "Rascunho", date: today(), validityDays: 30, title: c.title, subtitle: "",
      client: { name: "", role: role, address: "" }, intro: "", sections: [], items: [{ desc: "", qty: "1 lot", price: "" }],
      totalLabel: "TOTAL — Lump Sum, Fixed Price", includes: d.includes, payment: { note: "", rows: NV.tradePayment(tradeKey(co), { split: [30, 40, 30] }) },
      notIncluded: d.notIncluded, clarifications: d.clarifications, warranty: d.warranty,
      header: { tagline: c.tagline, contact: c.contact, footer: c.footer }, materials: [], total: 0, amountPaid: "", dueTerms: "Due upon receipt", dueDate: "" };
    var snap = brandSnap(co); if (snap) p.companyBrand = snap;
    refreshHic(p); if (!p.hic) { delete p.hic; delete p.hicAuto; }
    return p;
  }
  function totalOf(p) { return (p.items || []).reduce(function (a, it) { return a + num(it.price); }, 0); }

  // ═══════════ carregamento ═══════════
  EXT.load.push(function () {
    syncStores();
    return Promise.all([API.listProposals(), API.listMaterials(), API.listDeals()]).then(function (r) { S.proposals = r[0] || []; S.materials = r[1] || []; S.deals = r[2] || []; });
  });
  function reloadExt() { return Promise.all(EXT.load.map(function (f) { return f(); })).then(E.render); }

  var STATUS_P = { "Rascunho": "neutral", "Enviada": "accent", "Aceita": "good", "Recusada": "bad", "Paga": "good" };
  function isInv(p) { return p && p.docType === "invoice"; }
  function pPill(s) { return '<span class="pill ' + (STATUS_P[s] || "neutral") + '">' + esc(tv(s)) + "</span>"; } // status gravado em PT, mostrado no idioma de quem usa

  // ═══════════ lista de propostas ═══════════
  EXT.views.proposals = function () {
    if (S.pRec) micStop();
    var all = S.proposals.filter(function (p) { return p.companyId === S.company; }), tf = S.pTypeFilter || "all";
    var list = all.filter(function (p) { return !isInv(p); });
    var shown = all.filter(function (p) { return tf === "all" || (tf === "invoice") === isInv(p); });
    var sum = function (st) { return list.filter(function (p) { return p.status === st; }).reduce(function (a, p) { return a + (p.total || 0); }, 0); };
    var sent = list.filter(function (p) { return p.status === "Enviada" || p.status === "Aceita" || p.status === "Recusada"; }).length, won = list.filter(function (p) { return p.status === "Aceita"; }).length;
    return t("proposals.estimates", '<div class="page-head"><div><h1>Propostas</h1><p>') + esc(E.companyName(S.company)) + " · " + esc(E.tn("proposals.nEstimates", list.length, "1 proposta", "{n} propostas")) + " · " + esc(E.tn("proposals.nInvoices", all.length - list.length, "1 invoice", "{n} invoices")) + '</p></div><div class="row"><button class="btn ghost" data-act="pNew" data-id="invoice">' + E.ic("plus") + 'Invoice</button><button class="btn" data-act="pNew" data-id="estimate">' + E.ic("mic") + t("proposals.newEstimate", 'Nova proposta</button></div></div>') +
      draftBanner() +
      '<div class="kpis" style="margin-bottom:14px">' +
      kpi(t("proposals.sentAwaitingReply", "Enviadas aguardando"), money(sum("Enviada")), E.tn("proposals.nEstimates", list.filter(function (p) { return p.status === "Enviada"; }).length, "1 proposta", "{n} propostas")) +
      kpi(t("proposals.accepted", "Aceitas"), money(sum("Aceita")), E.tn("proposals.nEstimates", won, "1 proposta", "{n} propostas"), "v-good") +
      kpi(t("proposals.closeRate", "Taxa de fechamento"), (sent ? Math.round(won / sent * 100) : 0) + "%", t("proposals.wonOfSent", "{w} de {s} enviadas", { w: won, s: sent })) + "</div>" +
      '<div class="chips" style="margin-bottom:10px">' + [["all", t("proposals.all", "Todas")], ["estimate", t("proposals.chipEstimates", "Propostas")], ["invoice", "Invoices"]].map(function (x) { return '<button type="button" class="chip' + (tf === x[0] ? " on" : "") + '" data-act="pTypeFilter" data-id="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      (shown.length ? t("proposals.noCustomerJobDate", '<div class="table-wrap"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Obra</th><th>Data</th><th>Status</th><th class="n">Valor</th></tr></thead><tbody>') +
        shown.map(function (p) {
          return '<tr class="click" data-act="pOpen" data-id="' + p.id + '"><td><b>' + esc(p.number || "—") + '</b><div class="small muted">' + (isInv(p) ? "Invoice" : esc(t("proposals.rowEstimate", "Proposta"))) + "</div></td><td>" + esc((p.client || {}).name || "—") + '</td><td class="small">' + esc((p.client || {}).address || "") + (p.subtitle ? '<div class="muted">' + esc(p.subtitle) + "</div>" : "") + "</td><td>" + E.fmtDate(p.date) + "</td><td>" + pPill(p.status) + (p.statusByName || p.createdByName ? '<div class="by">' + E.byLine("{n}", p.statusByName || p.createdByName, p.statusAt || p.createdAt) + "</div>" : "") + '</td><td class="n"><b>' + money(p.total) + "</b></td></tr>";
        }).join("") + "</tbody></table></div>"
        : E.emptyState({ icon: "doc", title: t("proposals.noEstimatesYet", "Nenhuma proposta ainda"), text: t("proposals.tapNewEstimateDescribe", "Toque em “Nova proposta”, fale o serviço e a proposta sai pronta."), cta: { act: "pNew", id: "estimate", label: t("proposals.newEstimate2", "Nova proposta"), icon: "mic", primary: true } }));
  };
  // rascunho não salvo guardado no aparelho (ex.: app fechado no meio da proposta)
  function draftBanner() {
    var d = storedDraft(); if (!d) return "";
    var p = Object.assign(blankProposal(), d.draft);
    return '<div class="panel draft-banner" role="status" style="margin-bottom:14px;border-color:var(--warn, #b7791f)"><div class="spread"><div><b>' + esc(t("proposals.unsavedDraft", "Rascunho não salvo")) + "</b>" +
      '<div class="small muted">' + esc(draftLabel(p)) + (d.at ? " · " + esc(E.fmtDate(new Date(d.at).toISOString())) : "") + "</div></div>" +
      '<div class="row"><button type="button" class="btn ghost sm danger-text" data-act="pDropDraft">' + esc(t("leave.discard", "Descartar")) + '</button><button type="button" class="btn sm" data-act="pResume">' + esc(t("leave.stay", "Continuar editando")) + "</button></div></div></div>";
  }
  function kpi(label, value, sub, cls) { return '<div class="kpi" style="grid-template-columns:1fr"><div><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + (cls || "") + '">' + value + '</div><div class="kpi-sub">' + esc(sub) + "</div></div></div>"; }

  // ═══════════ editor ═══════════
  function inp(path, label, attrs, type) {
    var v = get(S.pdraft, path);
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" data-pbind="' + path + '" value="' + esc(v == null ? "" : v) + '" ' + (attrs || "") + "></label>";
  }
  function ta(path, label, rows, hint) {
    var v = get(S.pdraft, path);
    return '<label class="field"><span>' + esc(label) + (hint ? ' <span class="muted" style="font-weight:400">· ' + esc(hint) + "</span>" : "") + '</span><textarea data-pbind="' + path + '" rows="' + (rows || 4) + '">' + esc(v == null ? "" : v) + "</textarea></label>";
  }
  function fullEditor(p) {
    var trade = tradeKey(p.companyId);
    p.total = totalOf(p);
    var payTotal = (p.payment.rows || []).reduce(function (a, r) { return a + num(r[2]); }, 0);
    var a = t("proposals.customerAndJob", '<div class="panel ed-sec"><h3>Cliente e obra</h3><div class="grid3">') + inp("number", t("proposals.number", "Número")) + inp("date", t("proposals.date", "Data"), "", "date") + inp("validityDays", t("proposals.validForDays", "Validade (dias)"), 'inputmode="numeric"', "number") + "</div>" +
      '<div class="grid2">' + inp("client.name", t("proposals.preparedForCustomerGc", "Preparado para (cliente / GC)")) + inp("client.role", t("proposals.customerRoleEG", "Função do cliente (ex.: General Contractor, Homeowner)")) + "</div>" +
      inp("client.address", t("proposals.jobAddress", "Endereço da obra")) +
      (isInv(p) ? '<div class="grid3">' + inp("amountPaid", t("proposals.alreadyPaid", "Já pago ($)"), 'inputmode="decimal"') + inp("dueTerms", t("proposals.termsEGDue", "Condição (ex.: Due upon receipt)")) + inp("dueDate", t("proposals.dueDate", "Vencimento"), "", "date") + "</div>" : "") +
      '<div class="grid2">' + inp("title", t("proposals.documentTitle", "Título do documento")) + inp("subtitle", t("proposals.subtitleEGNew", "Subtítulo (ex.: New Construction · 5-Unit Multi-Family Residence)")) + "</div>" +
      ta("intro", t("proposals.introduction", "Introdução"), 5) + t("proposals.generateStandardIntro", '<div><button class="btn ghost sm" data-act="pGenIntro">Gerar introdução padrão</button></div></div>');

    var sec = t("proposals.scopeOfWorkOne", '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Escopo do trabalho</h3><span class="muted small">uma linha = um item ◆ · use **negrito**</span></div>') +
      (p.sections.length ? p.sections.map(function (s, i) {
        return '<div class="sec-card"><div class="row"><input type="text" data-pbind="sections.' + i + '.title" value="' + esc(s.title) + '" style="flex:1 1 220px;font-weight:600">' +
          '<button class="btn ghost sm" data-act="pMoveSec" data-id="' + i + '" data-dir="-1" aria-label="Subir">↑</button><button class="btn ghost sm" data-act="pMoveSec" data-id="' + i + '" data-dir="1" aria-label="Descer">↓</button><button class="btn ghost sm" data-act="pRmSec" data-id="' + i + t("proposals.html", '" aria-label="Remover seção">✕</button></div>') +
          '<textarea data-pbind="sections.' + i + '.text" rows="' + Math.max(3, lines(s.text).length + 1) + '">' + esc(s.text) + "</textarea></div>";
      }).join("") : t("proposals.addTheScopeSections", '<div class="muted">Adicione as seções do escopo abaixo.</div>')) +
      t("proposals.addSection", '<div><span class="label">Adicionar seção</span><div class="chips" style="margin-top:6px">') + SECTIONS_OF(trade).map(function (x, i) { return '<button type="button" class="chip" data-act="pAddSec" data-id="' + i + '" lang="en">+ ' + esc(x[0]) + "</button>"; }).join("") + t("proposals.blankSection", '<button type="button" class="chip" data-act="pAddSec" data-id="-1">+ Seção em branco</button></div></div></div>');

    var inv = t("proposals.investment", '<div class="panel ed-sec"><h3>Investimento</h3>') + p.items.map(function (it, i) {
      return '<div class="line-row"><textarea data-pbind="items.' + i + '.desc" placeholder="' + esc(t("proposals.itemDescPh", "Descrição (primeira linha em negrito no PDF)")) + '">' + esc(it.desc) + '</textarea><input type="text" data-pbind="items.' + i + '.qty" value="' + esc(it.qty) + '" placeholder="' + esc(t("proposals.qtyPh", "Qtd")) + '"><input type="text" inputmode="decimal" data-pbind="items.' + i + '.price" data-price="1" value="' + esc(it.price) + t("proposals.buttonClassBtnGhost", '" placeholder="Preço $"><button class="btn ghost sm" data-act="pRmItem" data-id="') + i + t("proposals.html2", '" aria-label="Remover item">✕</button></div>');
    }).join("") + t("proposals.item", '<div><button class="btn ghost sm" data-act="pAddItem">+ Item</button></div>') +
      inp("totalLabel", t("proposals.totalLineText", "Texto da linha de total")) +
      '<div class="total-bar"><span>Total</span><span id="pTotal">' + money2(p.total) + "</span></div>" + ta("includes", t("proposals.includes", "Inclui"), 2) + "</div>";

    var pay = t("proposals.paymentScheduleSpanId", '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Cronograma de pagamento</h3><span id="pSum" class="small ') + (payTotal === 100 ? "v-good" : "v-bad") + t("proposals.sum", '">Soma: ') + payTotal + "%</span></div>" +
      '<div class="chips">' + Object.keys(PAY).map(function (k) { return '<button type="button" class="chip" data-act="pPayPreset" data-id="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + "</div>" +
      ta("payment.note", t("proposals.noteOptionalShowsAbove", "Observação (opcional, aparece acima da tabela)"), 2) +
      (p.payment.rows || []).map(function (r, i) {
        return '<div class="pay-row"><input type="text" data-pbind="payment.rows.' + i + '.0" value="' + esc(r[0]) + '" placeholder="' + esc(t("proposals.milestonePh", "Etapa")) + '"><textarea data-pbind="payment.rows.' + i + '.1" placeholder="' + esc(t("proposals.whenPh", "Quando")) + '">' + esc(r[1]) + '</textarea><input type="text" inputmode="numeric" data-pbind="payment.rows.' + i + '.2" value="' + esc(r[2]) + '" placeholder="%"><button class="btn ghost sm" data-act="pRmPay" data-id="' + i + t("proposals.html3", '" aria-label="Remover etapa">✕</button></div>');
      }).join("") + t("proposals.milestone", '<div><button class="btn ghost sm" data-act="pAddPay">+ Etapa</button></div></div>');

    var hicOn = !isInv(p) && (p.hic || hicFor(p));
    var hic = hicOn ? '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">' + esc(t("proposals.hicTitle", "Contrato residencial (MA) — lei HIC")) + '</h3><button type="button" class="btn ghost sm" data-act="pGenHic">' + esc(t("proposals.hicGen", "Gerar de novo")) + "</button></div>" +
      '<div class="small muted">' + esc(t("proposals.hicHint", "M.G.L. c.142A §2: nº de registro HIC, datas de início e conclusão, cronograma de pagamento (depósito até 1/3), aviso de cancelamento em 3 dias. Modelo para revisar com seu advogado.")) + "</div>" +
      '<div class="grid2">' + inp("startDate", t("proposals.startDate", "Data de início"), "", "date") + inp("endDate", t("proposals.endDate", "Conclusão substancial"), "", "date") + "</div>" +
      ta("hic", t("proposals.hicText", "Cláusulas (aparecem no PDF)"), 6, t("proposals.oneLineOneItem", "uma linha = um item")) + "</div>" : "";
    var terms = t("proposals.terms", '<div class="panel ed-sec"><h3>Condições</h3>') + ta("notIncluded", t("proposals.notIncluded", "Não incluído"), 4) + ta("clarifications", t("proposals.clarifications", "Esclarecimentos"), 4, t("proposals.oneLineOneItem", "uma linha = um item")) + ta("warranty", t("proposals.warrantyAndInsurance", "Garantia e seguro"), 3, t("proposals.oneLineOneItem", "uma linha = um item")) +
      t("proposals.documentHeaderAndFooter", '<details><summary class="small" style="cursor:pointer">Cabeçalho e rodapé do documento</summary><div class="stack" style="margin-top:10px">') + inp("header.tagline", t("proposals.lineUnderTheLogo", "Linha abaixo do logo")) + inp("header.contact", t("proposals.contact", "Contato")) + inp("header.footer", t("proposals.footer", "Rodapé")) + "</div></details></div>";

    return a + sec + inv + (isInv(p) ? "" : pay) + terms + hic + materialsPanel(p);
  }

  // ── materiais da estimativa ──
  function estimate(p) {
    var rows = (p.materials || []).map(function (x, i) {
      var m = matById(x.materialId), q = num(x.qty) || 0;
      if (!m) return { i: i, name: x.name || t("proposals.materialRemoved", "(material removido)"), qty: q, missing: true };
      var b = best(m);
      return { i: i, m: m, name: m.name, unit: m.unit, qty: q, best: b, sub: b ? b.price * q : 0 };
    });
    var byStore = STORES.map(function (s) {
      var tot = 0, miss = 0;
      rows.forEach(function (r) { if (!r.m) return; var l = latest(r.m, s.id); if (l) tot += l.price * r.qty; else miss++; });
      return { s: s, tot: tot, miss: miss };
    });
    var bestTotal = rows.reduce(function (a, r) { return a + (r.sub || 0); }, 0);
    var noPrice = rows.filter(function (r) { return r.m && !r.best; }).length;
    return { rows: rows, byStore: byStore, bestTotal: bestTotal, noPrice: noPrice };
  }
  function materialsPanel(p) {
    var est = estimate(p);
    var opts = S.materials.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + (m.unit ? " (" + esc(m.unit) + ")" : "") + "</option>"; }).join("");
    var shop = {};
    est.rows.forEach(function (r) { if (r.best) (shop[r.best.store] = shop[r.best.store] || []).push(r); });
    var margin = (p.total || 0) - est.bestTotal;
    return t("proposals.estimateMaterialsJustFor", '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Material da estimativa</h3><span class="muted small">só para você · não aparece no PDF</span></div>') +
      (S.materials.length ? '<div class="mat-row"><select id="pMatSel">' + opts + t("proposals.add", '</select><input type="number" id="pMatQty" min="0" step="any" placeholder="Qtd" inputmode="decimal"><button class="btn sm" data-act="pAddMat">Adicionar</button></div>')
        : t("proposals.addMaterialsAndPrices", '<div class="muted">Cadastre os materiais e preços na aba <a href="#" data-act="nav" data-id="prices">Preços</a> para montar a estimativa aqui.</div>')) +
      (est.rows.length ? t("proposals.materialQtyBestStore", '<div class="table-wrap"><table><thead><tr><th>Material</th><th class="n">Qtd</th><th>Melhor loja</th><th class="n">Preço un.</th><th class="n">Subtotal</th><th></th></tr></thead><tbody>') +
        est.rows.map(function (r) {
          return "<tr><td>" + esc(r.name) + (r.unit ? ' <span class="muted small">' + esc(r.unit) + "</span>" : "") + '</td><td class="n">' + r.qty + "</td><td>" + (r.best ? '<span class="pill good">' + esc(storeName(r.best.store)) + "</span>" : t("proposals.noPrice", '<span class="pill warn">sem preço</span>')) + '</td><td class="n">' + (r.best ? money2(r.best.price) : "—") + '</td><td class="n"><b>' + (r.best ? money2(r.sub) : "—") + '</b></td><td class="n"><button class="btn ghost sm" data-act="pRmMat" data-id="' + r.i + t("proposals.html4", '" aria-label="Remover">✕</button></td></tr>');
        }).join("") + "</tbody></table></div>" +
        t("proposals.materialBestPricePer", '<div class="grid3 keep2"><div class="panel"><div class="label">Material (melhor preço por item)</div><div class="kpi-value">') + money(est.bestTotal) + '</div>' + (est.noPrice ? '<div class="kpi-sub v-bad">' + est.noPrice + t("proposals.itemSWithoutA", " item(ns) sem preço</div>") : "") + t("proposals.estimateAmount", '</div><div class="panel"><div class="label">Valor da proposta</div><div class="kpi-value v-info">') + money(p.total) + t("proposals.leftAfterMaterialDiv", '</div></div><div class="panel"><div class="label">Sobra após material</div><div class="kpi-value ') + (margin >= 0 ? "v-good" : "v-bad") + '">' + money(margin) + '</div><div class="kpi-sub">' + E.fmtPct(E.pct(margin, p.total || 0)) + t("proposals.ofTheAmount", " do valor</div></div></div>") +
        t("proposals.buyingEverythingAtOne", '<div><span class="label">Comprando tudo numa loja só</span><div class="bars" style="margin-top:8px">') + est.byStore.map(function (b) {
          return '<div class="bar-row"><span>' + esc(b.s.short) + '</span><span class="small muted">' + (b.miss ? b.miss + t("proposals.withoutPrice", " sem preço") : t("proposals.allItems", "todos os itens")) + '</span><span class="n">' + (b.tot ? money(b.tot) : "—") + "</span></div>";
        }).join("") + "</div></div>" +
        (Object.keys(shop).length ? t("proposals.whereToBuyEach", '<div><span class="label">Onde comprar cada item</span>') + Object.keys(shop).map(function (sid) {
          return '<div class="sec-card" style="margin-top:8px"><b>' + esc(storeName(sid)) + " · " + money2(shop[sid].reduce(function (a, r) { return a + r.sub; }, 0)) + '</b><div class="small">' + shop[sid].map(function (r) { return esc(r.qty + " × " + r.name); }).join(" · ") + "</div></div>";
        }).join("") + "</div>" : "")
        : "") + "</div>";
  }

  // ═══════════ documento (PDF) ═══════════
  function buildDoc(p) {
    var c = coFor(p.companyId, p), hd = p.header || {}, A = c.accent, D = c.dark;
    var logoBig = c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.brand) + '" style="width:' + (c.logoW || "3.3in") + ';max-width:100%;display:block;margin:0 auto">' : '<div style="font-size:40pt;font-weight:700;letter-spacing:.04em;color:' + D + '">' + esc(c.brand.toUpperCase()) + "</div>";
    var logoSm = c.logoSm ? '<img src="' + c.logoSm + '" alt="" style="height:.42in">' : '<span style="font-weight:700;color:' + D + ';letter-spacing:.06em">' + esc(c.brand.toUpperCase()) + "</span>";
    var validity = (p.validityDays || 30) + " days from issue date";
    var css = '<style>@page{size:letter;margin:.45in .6in .5in}' +
      '#print-root{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:"Times New Roman",Times,Georgia,serif;color:' + D + ';font-size:10.5pt;line-height:1.38}' +
      '#print-root table.frame{width:100%;border-collapse:collapse}#print-root .hdr{border-bottom:1px solid ' + A + ';text-align:right;padding-bottom:6px}' +
      '#print-root .ftr{border-top:1px solid ' + A + ';font-style:italic;font-size:8.5pt;color:#7a6a55;padding-top:5px}' +
      '#print-root h2,#print-root h4{font-family:"Times New Roman",Times,Georgia,serif;letter-spacing:0;text-transform:none;line-height:1.2}#print-root h2{font-size:17pt;margin:16px 0 4px;border-bottom:1px solid ' + A + ';padding-bottom:2px;page-break-after:avoid}' +
      '#print-root h4{color:' + A + ';font-size:11.5pt;margin:12px 0 4px;border-bottom:1px solid #e6d8c2;padding-bottom:2px;page-break-after:avoid}' +
      '#print-root .b{margin:0 0 5px 16px;text-indent:-14px}#print-root .b:before{content:"◆  ";color:' + A + '}' +
      '#print-root .tbl{width:100%;border-collapse:collapse;margin:8px 0;page-break-inside:avoid}#print-root .tbl th{background:' + D + ';color:#fff;text-align:left;padding:8px 12px;font-size:10.5pt}' +
      '#print-root .tbl td{padding:8px 12px;border-bottom:1px solid #e6d8c2;vertical-align:middle}#print-root .tbl .tot td{background:' + A + ';color:#fff;font-weight:700;font-size:11.5pt}' +
      '#print-root .cover{text-align:center;page-break-after:always}#print-root .box{border:1px solid ' + A + ';padding:14px 20px;margin:18px auto;max-width:5.7in}' +
      '#print-root .lab{color:' + A + ';font-weight:700;font-size:9.5pt;letter-spacing:.06em;text-transform:uppercase}</style>';
    var frame = function (body) { return css + '<table class="frame"><thead><tr><td class="hdr">' + logoSm + '</td></tr></thead><tfoot><tr><td class="ftr">' + esc(hd.footer || c.footer) + "</td></tr></tfoot><tbody><tr><td>" + body + "</td></tr></tbody></table>"; };
    if (isInv(p)) return frame(invoiceBody(p, c));
    var cover = '<div class="cover">' + '<div style="margin-top:.25in">' + logoBig + "</div>" +
      '<div style="font-weight:700;margin-top:10px">' + esc(hd.tagline || c.tagline) + '</div><div style="font-style:italic">' + esc(hd.contact || c.contact) + "</div>" +
      '<div style="border-top:1px solid ' + A + ';border-bottom:1px solid ' + A + ';margin:14px 0;padding:10px 0"><div style="font-size:26pt;font-weight:700">' + esc(p.title || c.title) + "</div>" + (p.subtitle ? '<div style="font-style:italic">' + esc(p.subtitle) + "</div>" : "") + "</div>" +
      '<div class="box"><div class="lab">Prepared for</div><div style="font-size:13pt;font-weight:700;margin-top:4px">' + esc(p.client.name || "—") + "</div>" + (p.client.role ? '<div style="font-style:italic">' + esc(p.client.role) + "</div>" : "") +
      '<div style="color:' + A + ';margin:8px 0">◆ ◆ ◆</div><div class="lab">Project location</div><div style="font-size:12pt;font-weight:700;margin-top:4px">' + esc(p.client.address || "—") + "</div></div>" +
      '<table style="margin:8px auto;border-collapse:collapse"><tr><td style="padding:0 30px;text-align:center;border-right:1px solid ' + A + '"><div class="lab">Proposal date</div><b>' + esc(longDate(p.date)) + '</b></td><td style="padding:0 30px;text-align:center"><div class="lab">Proposal no.</div><b>' + esc(p.number || "") + '</b></td><td style="padding:0 30px;text-align:center;border-left:1px solid ' + A + '"><div class="lab">Validity</div><b>' + esc(validity) + "</b></td></tr></table>" +
      (p.intro ? '<p style="text-align:justify;margin-top:16px">' + rich(p.intro) + "</p>" : "") + "</div>";
    var scope = p.sections.length ? "<h2>Scope of Work</h2>" + p.sections.map(function (s) { return "<h4>" + esc(s.title) + "</h4>" + lines(s.text).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join(""); }).join("") : "";
    var items = p.items.filter(function (it) { return it.desc || it.price; });
    var inv = "<h2>Investment</h2><table class=\"tbl\"><tr><th>Description</th><th style=\"width:1in\">Quantity</th><th style=\"width:1.3in;text-align:right\">Price</th></tr>" +
      items.map(function (it) { var ls = String(it.desc || "").split("\n"); return "<tr><td><b>" + rich(ls[0]) + "</b>" + (ls.length > 1 ? "<br>" + ls.slice(1).map(rich).join("<br>") : "") + "</td><td>" + esc(it.qty) + '</td><td style="text-align:right">' + (it.price !== "" ? money2(num(it.price)) : "") + "</td></tr>"; }).join("") +
      '<tr class="tot"><td>' + esc(p.totalLabel || "TOTAL") + "</td><td>" + (items.length === 1 ? esc(items[0].qty) : "") + '</td><td style="text-align:right">' + money2(totalOf(p)) + "</td></tr></table>" +
      (p.includes ? '<p style="font-style:italic;margin:4px 0"><b>Includes:</b> ' + rich(p.includes) + "</p>" : "");
    var rows = (p.payment.rows || []).filter(function (r) { return r[0] || r[1]; });
    var pay = rows.length ? "<h2>Payment Schedule</h2>" + (p.payment.note ? '<p style="font-style:italic">' + rich(p.payment.note) + "</p>" : "") +
      '<table class="tbl"><tr><th style="width:1.5in">Milestone</th><th>Trigger</th><th style="width:.8in;text-align:right">%</th></tr>' +
      rows.map(function (r) { var amt = totalOf(p) * num(r[2]) / 100; return "<tr><td><b>" + esc(r[0]) + "</b></td><td>" + rich(r[1]) + '</td><td style="text-align:right"><b>' + esc(num(r[2])) + "%</b>" + (amt ? '<div style="font-size:8.5pt;color:#7a6a55">' + money2(amt) + "</div>" : "") + "</td></tr>"; }).join("") +
      '<tr class="tot"><td>TOTAL</td><td>Project Complete</td><td style="text-align:right">100%</td></tr></table>' : "";
    var terms = (p.notIncluded ? '<h2>Not Included</h2><p style="font-style:italic;text-align:justify">' + rich(p.notIncluded) + "</p>" : "") +
      (lines(p.clarifications).length ? "<h2>Clarifications</h2>" + lines(p.clarifications).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join("") : "") +
      (lines(p.warranty).length ? "<h2>Warranty &amp; Insurance</h2>" + lines(p.warranty).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join("") : "") +
      (lines(p.hic).length ? "<h2>Massachusetts Home Improvement Contract</h2>" + lines(p.hic).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join("") : ""); // lei HIC (M.G.L. c.142A §2)
    var sig = '<div style="page-break-inside:avoid"><h2>Acceptance</h2><p style="text-align:justify">By signing below, the ' + esc(p.client.role || "Client") + " accepts the scope, pricing, and payment terms above as a binding agreement. This proposal is valid for " + esc(p.validityDays || 30) + " days from the date issued.</p>" +
      '<table style="width:100%;margin-top:18px"><tr><td style="width:50%;vertical-align:top;padding-right:20px"><b>' + esc(c.brand.toUpperCase()) + '</b><div style="font-style:italic">' + esc(c.role) + '</div><div style="margin-top:.55in;border-top:1px solid ' + D + ';width:3in;font-size:9pt;padding-top:3px">Signature</div><div style="margin-top:.3in">Date: ____________________</div></td>' +
      '<td style="vertical-align:top"><b>' + esc((p.client.name || "CLIENT").toUpperCase()) + '</b><div style="font-style:italic">' + esc(p.client.role || "") + '</div><div style="margin-top:.55in;border-top:1px solid ' + D + ';width:3in;font-size:9pt;padding-top:3px">Signature</div><div style="margin-top:.3in">Date: ____________________</div></td></tr></table></div>';
    return frame(cover + scope + inv + pay + terms + sig);
  }
  function printDoc(p) {
    var root = $("#print-root");
    if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
    root.innerHTML = buildDoc(p);
    document.body.style.background = coFor(p.companyId, p).bg;
    var imgs = [].slice.call(root.querySelectorAll("img"));
    Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); })).then(function () {
      document.body.classList.add("printing");
      var old = document.title; document.title = (p.number ? p.number + " " : "") + (p.client.address || "Proposal");
      var done = function () { document.body.classList.remove("printing"); document.body.style.background = ""; document.title = old; window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done);
      setTimeout(function () { window.print(); setTimeout(done, 1500); }, 60);
    });
  }

  // ═══════════ ações das propostas ═══════════
  var AC = EXT.actions;
  // ── rascunho: sabe se há alteração não salva, guarda no aparelho e pergunta antes de sair ──
  // S.pBase = retrato do documento como está salvo (null = documento novo ainda não salvo, ex.: invoice gerado ou cópia)
  function snap(p) { var c = clone(p); delete c.total; return JSON.stringify(c); }
  function hasContent(p) { var c = p.client || {}; return !!(c.name || c.address || c.email || c.phone || built(p) || p.speech); }
  function isDirty() { var p = S.pdraft; if (!p) return false; return S.pBase == null ? hasContent(p) : snap(p) !== S.pBase; }
  function draftKey() { return "bisey_pdraft_" + ((S.user && S.user.id) || ""); }
  function storedDraft() { try { var d = JSON.parse(localStorage.getItem(draftKey()) || "null"); return d && d.draft ? d : null; } catch (e) { return null; } }
  function clearStored() { try { localStorage.removeItem(draftKey()); } catch (e) {} }
  function markClean() { S.pBase = S.pdraft ? snap(S.pdraft) : null; clearStored(); }
  function persist() {
    if (!S.user || S.view !== "proposalForm" || !S.pdraft) return;
    try { if (isDirty()) localStorage.setItem(draftKey(), JSON.stringify({ draft: S.pdraft, base: S.pBase, adv: !!S.pAdv, speech: S.pSpeech || "", at: Date.now() })); else localStorage.removeItem(draftKey()); } catch (e) {}
  }
  var persistTimer = null;
  function schedulePersist() { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 300); }
  function restoreStored() {
    var d = storedDraft(); if (!d) return false;
    S.pdraft = Object.assign(blankProposal(), d.draft); S.pBase = d.base == null ? null : d.base; S.pAdv = !!d.adv; S.pSpeech = d.speech || ""; return true;
  }
  function draftLabel(p) { var n = p.number || "", who = (p.client && (p.client.name || p.client.address)) || ""; return (isInv(p) ? "Invoice " : t("proposals.estimate", "Proposta ")) + n + (who ? " · " + who : ""); }
  // salvar pelo aviso de saída (e pelo botão Salvar): devolve false se faltar o cliente
  function saveDraft() {
    var p = S.pdraft; p.total = totalOf(p);
    if (!p.client.name && !p.client.address) { E.toast(t("proposals.fillInTheCustomer", "Preencha o cliente ou o endereço da obra.")); var f = document.querySelector('[data-pbind="client.name"]'); if (f) f.focus(); return Promise.resolve(false); }
    E.toast(t("proposals.saving", "Salvando…"));
    return API.saveProposal(p).then(function (saved) { S.pdraft = Object.assign(blankProposal(), saved); markClean(); return reloadExt(); })
      .then(function () { E.toast(isInv(S.pdraft) ? t("proposals.invoiceSaved", "Invoice salvo.") : t("proposals.estimateSaved", "Proposta salva.")); return true; });
  }
  EXT.leave.push(function () {
    if (S.view !== "proposalForm" || !isDirty()) return null;
    return { label: draftLabel(S.pdraft), save: saveDraft, discard: function () { clearStored(); S.pdraft = null; S.pBase = null; } };
  });
  EXT.beforeReload.push(persist);
  EXT.afterRender.push(persist);

  AC.pNew = function (el) {
    var kind = el && el.dataset.id;
    E.guardLeave(function () {
      var p = blankProposal();
      if (kind === "invoice") { p.docType = "invoice"; p.number = nextNumber("invoice"); p.title = "INVOICE"; }
      S.pdraft = p; S.pSpeech = ""; S.pAdv = false; markClean(); E.go("proposalForm", {}, true);
    });
  };
  AC.pOpen = function (el) {
    var id = el.dataset.id;
    E.guardLeave(function () { var p = S.proposals.find(function (x) { return x.id === id; }); if (!p) return; S.pdraft = Object.assign(blankProposal(), clone(p)); S.pSpeech = ""; S.pAdv = false; markClean(); E.go("proposalForm", {}, true); });
  };
  // rascunho guardado no aparelho (troca de idioma, app fechado no meio): continuar ou descartar
  AC.pResume = function () { if (restoreStored()) E.go("proposalForm", {}, true); };
  AC.pDropDraft = function () { clearStored(); E.render(); E.toast(t("proposals.draftDiscarded", "Rascunho descartado.")); };
  AC.pGenIntro = function () { S.pdraft.intro = introText(S.pdraft); E.render(); };
  AC.pGenHic = function () { var p = S.pdraft; p.hicAuto = true; p.hic = hicFor(p); E.render(); if (!p.hic) E.toast(t("proposals.hicNA", "As cláusulas HIC só valem para empresa de MA, ramo de reforma residencial e cliente dono da casa (Homeowner).")); };
  AC.pAddSec = function (el) { var i = Number(el.dataset.id), p = S.pdraft, tr = tradeKey(p.companyId); p.sections.push(i < 0 ? { title: "New Section", text: "" } : NV.tradeSection(tr, i, p.speech || "", secCtx(p.companyId))); E.render(); };
  AC.pRmSec = function (el) { S.pdraft.sections.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pMoveSec = function (el) { var i = Number(el.dataset.id), j = i + Number(el.dataset.dir), a = S.pdraft.sections; if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; E.render(); };
  AC.pAddItem = function () { S.pdraft.items.push({ desc: "", qty: "1", price: "" }); E.render(); };
  AC.pRmItem = function (el) { S.pdraft.items.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pPayPreset = function (el) { S.pdraft.payment.rows = payPreset(S.pdraft, el.dataset.id); if (/Bank/.test(el.dataset.id)) S.pdraft.payment.note = "**Bank-financed project — performance-based draws.** This project is financed by the Owner's lender. A performance affidavit and supporting documentation will be issued to the bank at each milestone below."; E.render(); };
  AC.pAddPay = function () { S.pdraft.payment.rows.push(["", "", 0]); E.render(); };
  AC.pRmPay = function (el) { S.pdraft.payment.rows.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pAddMat = function () { var id = $("#pMatSel").value, q = num($("#pMatQty").value); if (!id || !q) { E.toast(t("proposals.pickTheMaterialAnd", "Escolha o material e a quantidade.")); return; } var m = matById(id); S.pdraft.materials.push({ materialId: id, name: m.name, qty: q }); E.render(); };
  AC.pRmMat = function (el) { S.pdraft.materials.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pPrint = function () { printDoc(S.pdraft); };
  AC.pSave = function () { saveDraft().catch(function (e) { E.toast(e.message || t("proposals.errorSaving", "Erro ao salvar.")); }); };
  AC.pDup = function () { E.guardLeave(function () { var c = clone(S.pdraft); c.id = null; c.number = nextNumber(c.docType); c.notes = []; c.status = "Rascunho"; c.date = today(); S.pdraft = c; S.pBase = null; E.render(); E.toast(t("proposals.copyCreatedSaveIt", "Cópia criada. Salve para guardar.")); window.scrollTo(0, 0); }); };
  AC.pAskDel = function () { S.modal = { type: "confirm", title: t("proposals.deleteEstimate", "Apagar proposta"), text: t("proposals.deleteEstimate2", "Apagar a proposta ") + (S.pdraft.number || "") + t("proposals.thisCanTBe", "? Isso não pode ser desfeito."), act: "pDel", id: S.pdraft.id, okLabel: t("proposals.delete", "Apagar") }; E.render(); };
  AC.pDel = function (el) { API.deleteProposal(el.dataset.id).then(function () { S.modal = null; S.pdraft = null; S.pBase = null; clearStored(); return reloadExt(); }).then(function () { E.go("proposals"); E.toast(t("proposals.estimateDeleted", "Proposta apagada.")); }); };
  AC.pToProject = function () {
    var p = S.pdraft, d = E.blankProject();
    d.companyId = p.companyId; d.name = p.client.address || p.number; d.client = p.client.name; d.address = p.client.address;
    d.scope = (p.number ? t("proposals.estimate", "Proposta ") + p.number + "\n\n" : "") + p.sections.map(function (s) { return s.title.toUpperCase() + "\n" + lines(s.text).map(function (l) { return "• " + l.replace(/\*\*/g, ""); }).join("\n"); }).join("\n\n") + (p.notIncluded ? "\n\n" + t("proposals.notIncludedHead", "NÃO INCLUÍDO") + "\n" + p.notIncluded.replace(/\*\*/g, "") : "");
    d.fin.contractValue = totalOf(p) || "";
    S.draft = d; S.draftBase = null; S.draftFiles = []; S.wizStep = 0; E.go("projectForm"); E.toast(t("proposals.projectFilledInFrom", "Projeto preenchido com os dados da proposta. Confira e salve."));
  };

  // cláusulas HIC acompanham cliente / endereço / datas enquanto não forem editadas à mão
  function hicSync(p, path) {
    if (path === "hic") { p.hicAuto = false; return; }
    if (/^client\.|^startDate$|^endDate$/.test(path) && p.hicAuto !== false && !isInv(p)) { var h = hicFor(p); if (h || p.hic) { p.hic = h; p.hicAuto = true; } }
  }
  EXT.input.push(function (el) {
    if (!el.dataset.pbind || !S.pdraft) return false;
    set(S.pdraft, el.dataset.pbind, el.value);
    hicSync(S.pdraft, el.dataset.pbind);
    schedulePreview(); schedulePersist();
    if (el.dataset.price) { var t = $("#pTotal"); if (t) t.textContent = money2(totalOf(S.pdraft)); }
    if (/^payment\.rows\.\d+\.2$/.test(el.dataset.pbind)) { var sm = $("#pSum"), tot = (S.pdraft.payment.rows || []).reduce(function (a, r) { return a + num(r[2]); }, 0); if (sm) { sm.textContent = NV.t("proposals.sum", "Soma: ") + tot + "%"; sm.className = "small " + (tot === 100 ? "v-good" : "v-bad"); } }
    return true;
  });
  EXT.change.push(function (el) {
    if (el.dataset.pbind && S.pdraft) { set(S.pdraft, el.dataset.pbind, el.value); hicSync(S.pdraft, el.dataset.pbind); if (el.tagName === "SELECT") E.render(); else schedulePersist(); return true; }
    if (el.dataset.pf) { S.priceFilter[el.dataset.pf] = el.value; E.render(); return true; }
    return false;
  });

  // ═══════════ tela simples: cliente + tipo + voz ═══════════
  var ROLES = ["Homeowner", "General Contractor", "Developer", "Property Manager", "Owner"];
  var MIC_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function built(p) { return p.sections.length > 0 || p.items.some(function (it) { return it.desc || it.price; }); }

  EXT.views.proposalForm = function () {
    if (!S.pdraft) restoreStored(); // voltou da troca de idioma (ou o app fechou) com rascunho guardado
    var p = S.pdraft; if (!p) return '<div class="page-head"><div>' + E.crumb("proposals", t("proposals.estimates2", "Propostas")) + "<h1>" + esc(t("proposals.estimates2", "Propostas")) + "</h1></div></div>" + E.emptyState({ icon: "doc", title: t("proposals.noEstimateOpen", "Nenhuma proposta aberta"), cta: { act: "nav", id: "proposals", label: t("proposals.seeEstimates", "Ver propostas"), icon: "chevl" } });
    p.total = totalOf(p);
    var inv = isInv(p), ok = built(p), busy = S.pBusy;
    var head = '<div class="page-head"><div>' + E.crumb("proposals", t("proposals.estimates2", "Propostas"), p.id ? p.number || "" : inv ? t("proposals.newInvoice", "Novo invoice") : t("proposals.newEstimate2", "Nova proposta")) + "<h1>" +
      (p.id ? (inv ? "Invoice " : t("proposals.estimate", "Proposta ")) + esc(p.number) : inv ? t("proposals.newInvoice2", "Novo invoice") : t("proposals.newEstimate2", "Nova proposta")) + "</h1><p>" + esc(E.companyName(p.companyId)) + t("proposals.comesOutInEnglish", " · sai em inglês, no padrão das suas propostas</p></div>").replace(/<\/div>$/, "") +
      (p.id && (p.createdByName || p.updatedByName || p.statusByName) ? '<div class="bylines">' + E.byLine(inv ? t("who.createdBy", "Criado por {n}") : t("who.createdByF", "Criada por {n}"), p.createdByName, p.createdAt) + (p.statusByName ? E.byLine(t("who.statusBy", "“{s}” por {n}").replace("{s}", E.tv(p.status)), p.statusByName, p.statusAt) : "") + E.byLine(inv ? t("who.editedBy", "Editado por {n}") : t("who.editedByF", "Editada por {n}"), p.updatedByName !== p.statusByName || p.updatedAt !== p.statusAt ? p.updatedByName : "", p.updatedAt) + "</div>" : "") + "</div>" +
      '<div class="row"><select data-pbind="status" style="width:auto" aria-label="Status">' + Object.keys(STATUS_P).map(function (s) { return '<option value="' + s + '"' + (p.status === s ? " selected" : "") + ">" + esc(tv(s)) + "</option>"; }).join("") + "</select></div></div>";

    var type = t("proposals.html5", '<div class="seg" role="group" aria-label="Tipo de documento">') +
      '<button type="button" class="' + (inv ? "" : "on") + t("proposals.estimateProposalForThe", '" data-act="pType" data-id="estimate"><b>Estimate</b><span>proposta para o cliente aprovar</span></button>') +
      '<button type="button" class="' + (inv ? "on" : "") + t("proposals.invoiceBillForWork", '" data-act="pType" data-id="invoice"><b>Invoice</b><span>cobrança do serviço feito</span></button></div>');

    var cli = t("proposals.customer", '<div class="panel ed-sec"><h3>Cliente</h3><div class="grid2">') + inp("client.name", inv ? t("proposals.billToCustomerGc", "Cobrar de (cliente / GC)") : t("proposals.preparedForCustomerGc", "Preparado para (cliente / GC)")) +
      t("proposals.customerTypeInputType", '<label class="field"><span>Tipo de cliente</span><input type="text" list="pRoles" data-pbind="client.role" value="') + esc(p.client.role || "") + '"></label></div>' +
      '<datalist id="pRoles">' + ROLES.map(function (r) { return '<option value="' + r + '">'; }).join("") + "</datalist>" +
      inp("client.address", t("proposals.jobAddress", "Endereço da obra")) +
      '<div class="grid2">' + inp("client.email", t("proposals.customerEmail", "E-mail do cliente"), 'autocapitalize="none" inputmode="email"', "email") + inp("client.phone", t("proposals.customerPhone", "Telefone do cliente"), 'inputmode="tel"', "tel") + "</div></div>";

    var tk = tradeKey(p.companyId);
    var pd = NV.tradeDef(tk).proposal, ex = inv ? pd.speechExampleInvoice : pd.speechExample; // exemplo de fala do ramo (trades.js)
    var voice = '<div class="panel ed-sec"><h3>' + (ok ? t("proposals.wantToChangeSomething", "Quer mudar alguma coisa? Fale aqui") : t("proposals.describeTheJob", "Fale o serviço")) + "</h3>" +
      '<div class="voice"><button type="button" class="mic' + (S.pRec ? " on" : "") + t("proposals.dataActPmicAria", '" data-act="pMic" aria-label="Gravar voz" aria-pressed="') + (S.pRec ? "true" : "false") + '">' + MIC_SVG + "</button>" +
      '<div><b id="micState">' + micLabel() + '</b><div class="small muted" style="margin-top:4px">' + esc(ok ? pd.adjustExample || t("proposals.eGTakeOut", "Ex.: “Tira o permit, muda o preço para 9 mil e acrescenta 4 tomadas no porão.”") : ex) + "</div></div></div>" +
      t("proposals.html6", '<textarea id="pSpeech" rows="5" placeholder="O que você falar aparece aqui. Também dá para digitar ou usar o microfone do teclado.">') + esc(S.pSpeech || "") + "</textarea>" +
      '<div class="row">' + (busy ? t("proposals.buildingTakesAbout30", '<button class="btn" disabled><span class="spin" aria-hidden="true"></span> Montando… leva uns 30 segundos</button>')
        : ok ? t("proposals.adjust", '<button class="btn" data-act="pAI" data-id="adjust">✨ Ajustar ') + (inv ? t("proposals.theInvoice", "o invoice") : t("proposals.theEstimate", "a proposta")) + t("proposals.buildFromScratchWith", '</button><button class="btn ghost" data-act="pAI" data-id="new">Montar do zero com esse texto</button>')
          : t("proposals.build", '<button class="btn" data-act="pAI" data-id="new">✨ Montar ') + (inv ? "invoice" : t("proposals.estimateWord", "proposta")) + "</button>") +
      t("proposals.speechLanguageOptionValue", '<label class="small muted" style="margin-left:auto">Idioma da fala <select id="pLang" style="width:auto;padding:4px 8px"><option value="pt-BR"') + ((S.pLang || E.speechLang()) === "pt-BR" ? " selected" : "") + '>Português</option><option value="en-US"' + ((S.pLang || E.speechLang()) === "en-US" ? " selected" : "") + '>English</option><option value="es-US"' + ((S.pLang || E.speechLang()) === "es-US" ? " selected" : "") + ">Español</option></select></label></div></div>";

    var notes = (p.notes || []).length ? t("proposals.checkBeforeSending", '<div class="panel ed-sec note-box"><h3>Confira antes de mandar</h3>') + p.notes.map(function (n) { return '<div class="small">• ' + esc(n) + "</div>"; }).join("") + "</div>" : "";
    var paid = inv ? num(p.amountPaid) : 0;
    var prev = ok ? t("proposals.documentPreview", '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Prévia do documento</h3><span class="kpi-value" style="font-size:22px">') + money2(p.total - paid) + (inv && paid ? t("proposals.balanceDue", ' <span class="small muted">a receber</span>') : "") + "</span></div>" +
      (p.total ? "" : t("proposals.noPriceSayThe", '<div class="pill warn">Sem preço — fale o valor ou ajuste em “Editar tudo”.</div>')) +
      '<div id="pPrev" class="doc-box"></div></div>' : "";

    var adv = '<div><button type="button" class="btn ghost sm" data-act="pAdv">' + (S.pAdv ? t("proposals.closeFullEditor", "Fechar edição completa ▲") : t("proposals.editEverythingAdvanced", "Editar tudo (avançado) ▼")) + "</button></div>" + (S.pAdv ? fullEditor(p) : "");

    setTimeout(mountPreview, 0);
    var sent = p.acceptedAt ? t("proposals.acceptedByTheCustomer", '<div class="panel ed-sec" style="border-color:var(--good);background:var(--good-soft)"><h3 style="margin:0;color:var(--good)">✓ Aceita pelo cliente</h3><div>') + esc(p.acceptedBy || "") + " · " + E.fmtDate(p.acceptedAt) + "</div></div>"
      : p.sentTo ? t("proposals.sentTo", '<div class="panel ed-sec"><div class="small">📨 Enviada para <b>') + esc(p.sentTo) + t("proposals.sentOn", "</b> em ") + E.fmtDate(p.sentAt) + t("proposals.waitingForTheCustomer", " · aguardando resposta do cliente</div></div>") : "";
    return head + sent + type + cli + voice + notes + prev + (p.id && !inv ? matListPanel(p) : "") + adv +
      '<div class="sticky-actions">' + (p.id ? t("proposals.deleteDuplicate", '<button class="btn danger" data-act="pAskDel">Apagar</button><button class="btn ghost" data-act="pDup">Duplicar</button>') : "") +
      (p.id && !inv ? t("proposals.createInvoiceTurnInto", '<button class="btn ghost" data-act="pToInvoice">Gerar invoice</button><button class="btn ghost" data-act="pToProject">Virar projeto</button>') : "") +
      t("proposals.viewPdfPrintSave", '<button class="btn ghost" data-act="pPrint">Ver PDF / Imprimir</button><button class="btn ghost" data-act="pSave">Salvar</button><button class="btn" data-act="pSend">📨 Enviar para o cliente</button></div>');
  };

  // ── lista de material da obra (montada quando o cliente aceita) ──
  function words(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9/"]+/g, " ").split(" ").filter(function (w) { return w.length > 1; }); }
  function matchMaterial(name) {
    var a = words(name), bestM = null, bestS = 0;
    S.materials.forEach(function (m) { var b = words(m.name), hit = a.filter(function (w) { return b.indexOf(w) >= 0; }).length, sc = hit / Math.max(3, Math.min(a.length, b.length)); if (sc > bestS) { bestS = sc; bestM = m; } });
    return bestS >= 0.5 ? bestM : null;
  }
  function matListPanel(p) {
    var ml = p.materialList;
    var headH = t("proposals.materialListAndWhere", '<div class="spread"><div><h3 style="margin:0">Lista de material e onde comprar mais barato</h3><div class="muted small">Só para você · ') + (ml ? t("proposals.builtOn", "montada em ") + E.fmtDate(ml.at) : t("proposals.buildsItselfWhenThe", "é montada sozinha quando o cliente aceita a proposta")) + "</div></div>" +
      '<button class="btn ' + (ml ? "ghost " : "") + 'sm" data-act="pMatList"' + (S.pMatBusy ? " disabled" : "") + ">" + (S.pMatBusy ? t("proposals.building", "Montando…") : ml ? t("proposals.rebuildList", "Refazer lista") : t("proposals.buildListNow", "Montar lista agora")) + "</button></div>";
    if (!ml || !(ml.items || []).length) return '<div class="panel ed-sec">' + headH + "</div>";
    var shop = {}, known = 0;
    var rows = ml.items.map(function (it) {
      var m = matchMaterial(it.name), b = m ? best(m) : null, sub = b ? b.price * (Number(it.qty) || 0) : 0;
      if (b) { known += sub; (shop[b.store] = shop[b.store] || []).push(it.qty + " " + (it.unit || "") + " " + it.name); }
      return "<tr><td><b>" + esc(it.name) + '</b></td><td class="n">' + esc(it.qty) + " " + esc(it.unit || "") + "</td><td>" +
        (b ? '<span class="pill good">' + esc(storeName(b.store)) + "</span> " + money2(b.price) + '</td><td class="n"><b>' + money2(sub) + "</b>" : t("proposals.noSavedPrice", '<span class="muted small">sem preço salvo</span></td><td class="n">—')) + "</td><td>" +
        STORES.map(function (s) { return '<a class="chip" style="padding:3px 8px;font-size:12px" href="' + esc(s.url(it.search || it.name)) + '" target="_blank" rel="noopener">' + esc(s.short) + "</a>"; }).join(" ") + "</td></tr>";
    }).join("");
    return '<div class="panel ed-sec">' + headH +
      t("proposals.materialQtyCheapestYour", '<div class="table-wrap"><table><thead><tr><th>Material</th><th class="n">Qtd</th><th>Mais barato (seus preços)</th><th class="n">Subtotal</th><th>Pesquisar</th></tr></thead><tbody>') + rows + "</tbody></table></div>" +
      (known ? t("proposals.materialWithKnownPrice", '<div class="total-bar"><span>Material com preço conhecido</span><span>') + money2(known) + "</span></div>" : "") +
      (Object.keys(shop).length ? t("proposals.buyAtEachStore", '<div><span class="label">Comprar em cada loja</span>') + Object.keys(shop).map(function (sid) { return '<div class="sec-card" style="margin-top:8px"><b>' + esc(storeName(sid)) + '</b><div class="small">' + shop[sid].map(esc).join(" · ") + "</div></div>"; }).join("") + "</div>" : "") +
      (ml.notes ? '<div class="muted small">' + esc(ml.notes) + "</div>" : "") +
      t("proposals.theCheapestPriceComes", '<div class="muted small">O preço “mais barato” vem da aba Preços → Meus preços. As lojas de material elétrico não mostram preço sem login; os botões abrem a busca de cada loja para conferir.</div></div>');
  }

  // ── prévia (mesmo HTML do PDF, dentro de um quadro) ──
  var prevTimer = null;
  function schedulePreview() { clearTimeout(prevTimer); prevTimer = setTimeout(mountPreview, 500); }
  function mountPreview() {
    var box = $("#pPrev"); if (!box || !S.pdraft) return;
    var c = coFor(S.pdraft.companyId, S.pdraft);
    var html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + location.href.split("#")[0] + '"><style>html,body{margin:0;background:' + c.bg + "}body{padding:.45in .6in}#print-root .cover{min-height:auto}</style></head><body><div id=\"print-root\">" + buildDoc(S.pdraft) + "</div></body></html>";
    var f = box.querySelector("iframe"), inner = box.querySelector(".doc-inner");
    if (!f) { inner = document.createElement("div"); inner.className = "doc-inner"; f = document.createElement("iframe"); f.title = t("proposals.documentPreview2", "Prévia do documento"); f.setAttribute("tabindex", "-1"); inner.appendChild(f); box.appendChild(inner); }
    function fit() {
      var s = Math.min(1, box.clientWidth / 816), h = 1100;
      try { h = f.contentDocument.documentElement.scrollHeight; } catch (e) { }
      f.style.height = h + "px"; f.style.transform = "scale(" + s + ")"; inner.style.height = Math.ceil(h * s) + "px";
    }
    f.onload = function () { fit(); setTimeout(fit, 400); };
    f.srcdoc = html;
  }
  window.addEventListener("resize", function () { if ($("#pPrev")) schedulePreview(); });

  // ── gravação de voz ──
  var rec = null;
  function micLabel() { return S.pRec ? t("proposals.recordingTalkFreelyTap", "Gravando… fale à vontade. Toque de novo para parar.") : t("proposals.tapTheMicAnd", "Toque no microfone e fale o que tem que ser feito"); }
  function micUI() {
    var b = document.querySelector(".mic"), t = $("#micState");
    if (b) { b.classList.toggle("on", !!S.pRec); b.setAttribute("aria-pressed", S.pRec ? "true" : "false"); }
    if (t) t.textContent = micLabel();
  }
  function micStop() { S.pRec = false; if (rec) { try { rec.stop(); } catch (e) { } } rec = null; micUI(); }
  function micStart() {
    var box = $("#pSpeech");
    if (!SR) { E.toast(t("proposals.thisDeviceCanT", "Este aparelho não grava direto no app. Toque na caixa de texto e use o microfone do teclado.")); if (box) box.focus(); return; }
    var android = /Android/i.test(navigator.userAgent);
    var base = (box ? box.value : S.pSpeech || "").replace(/\s*$/, ""); if (base) base += " ";
    var r = new SR(); rec = r;
    r.lang = S.pLang || E.speechLang(); r.interimResults = true; r.continuous = !android; // Android repete frases no modo contínuo
    r.onresult = function (ev) {
      var fin = "", tmp = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) { var x = ev.results[i]; if (x.isFinal) fin += x[0].transcript; else tmp += x[0].transcript; }
      if (fin) base += fin.trim() + " ";
      S.pSpeech = base; var t = $("#pSpeech"); if (t) { t.value = base + tmp; t.scrollTop = t.scrollHeight; }
    };
    r.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { micStop(); E.toast(t("proposals.allowTheMicrophoneFor", "Libere o microfone para o app nas configurações do celular (ou use o microfone do teclado).")); }
      else if (e.error === "network") { micStop(); E.toast(t("proposals.noInternetToRecognize", "Sem internet para reconhecer a voz. Use o microfone do teclado.")); }
    };
    r.onend = function () { if (S.pRec && rec === r) { setTimeout(function () { if (S.pRec && rec === r) { try { r.start(); } catch (e) { micStop(); } } }, 120); } };
    try { r.start(); S.pRec = true; } catch (e) { S.pRec = false; E.toast(t("proposals.couldnTOpenThe", "Não consegui abrir o microfone.")); }
    micUI();
  }

  // ── IA: monta / ajusta ──
  var BANK_NOTE = "**Bank-financed project — performance-based draws.** This project is financed by the Owner's lender. A performance affidavit and supporting documentation will be issued to the bank at each milestone below.";
  function defaultClar(p) { return lines(defaults(p.companyId).clarifications); }
  function compact(p) {
    var std = defaultClar(p);
    return {
      subtitle: p.subtitle, intro: p.intro,
      sections: p.sections.map(function (s) { return { title: s.title, bullets: lines(s.text) }; }),
      items: p.items.filter(function (it) { return it.desc || it.price; }).map(function (it) { var ls = String(it.desc || "").split("\n"); return { description: ls[0], details: ls.slice(1).join(" "), quantity: it.qty, price: it.price === "" ? null : num(it.price) }; }),
      payment: (p.payment.rows || []).map(function (r) { return { milestone: r[0], trigger: r[1], percent: num(r[2]) }; }),
      bank_financed: !!p.payment.note,
      not_included: String(p.notIncluded || "").replace(/\.\s*$/, "").split(/\s+·\s+/).filter(Boolean),
      extra_clarifications: lines(p.clarifications).filter(function (l) { return std.indexOf(l) < 0; }),
      amount_paid: isInv(p) && p.amountPaid !== "" ? num(p.amountPaid) : null
    };
  }
  function applyAI(p, r, mode, speech) {
    if (r.client_name && (mode === "adjust" || !p.client.name)) p.client.name = r.client_name;
    if (r.client_role && (mode === "adjust" || !p.client.name || p.client.role === "General Contractor")) p.client.role = r.client_role;
    if (r.project_address && (mode === "adjust" || !p.client.address)) p.client.address = r.project_address;
    p.subtitle = r.subtitle || p.subtitle;
    p.title = isInv(p) ? "INVOICE" : coFor(p.companyId, p).title;
    p.intro = r.intro || introText(p);
    p.sections = (r.sections || []).map(function (s) { return { title: s.title, text: (s.bullets || []).join("\n") }; });
    p.items = (r.items || []).map(function (it) { return { desc: it.description + (it.details ? "\n" + it.details : ""), qty: it.quantity || "1 lot", price: it.price == null ? "" : String(it.price) }; });
    if (!p.items.length) p.items = [{ desc: "", qty: "1 lot", price: "" }];
    if (r.payment && r.payment.length) p.payment.rows = r.payment.map(function (x) { return [x.milestone, x.trigger, num(x.percent)]; });
    p.payment.note = r.bank_financed ? BANK_NOTE : "";
    if (r.not_included && r.not_included.length) p.notIncluded = r.not_included.join(" · ") + ".";
    p.clarifications = defaults(p.companyId).clarifications + ((r.extra_clarifications || []).length ? "\n" + r.extra_clarifications.join("\n") : "");
    if (isInv(p)) { if (r.amount_paid != null) p.amountPaid = String(r.amount_paid); if (r.invoice_terms) p.dueTerms = r.invoice_terms; }
    p.notes = r.notes_pt || [];
    p.speech = mode === "adjust" && p.speech ? p.speech + "\n\n[ajuste] " + speech : speech;
    refreshHic(p); if (p.hic) p.notes = p.notes.concat(hicNotes(p));
    p.total = totalOf(p);
  }

  // versão simples sem IA (quando a IA não está ligada): escolhe as seções padrão pelas palavras faladas (trades.js → NV.tradeSections:
  // negação "sem bomba"/"no fire pump", exclude, opção da empresa, estado, fatos da fala) e lê o preço só com contexto de preço (NV.speechPrice)
  function priceFrom(t) { return NV.speechPrice(t); }
  function localBuild(p, speech) {
    var tr = tradeKey(p.companyId), pd = NV.tradeDef(tr).proposal, price = priceFrom(speech), split = NV.speechSplit(speech), scopeName = pd.scopeName;
    p.speech = speech;
    p.sections = isInv(p) ? [] : NV.tradeSections(tr, speech, secCtx(p.companyId));
    p.title = isInv(p) ? "INVOICE" : coFor(p.companyId, p).title;
    p.intro = isInv(p) ? "Invoice for " + pd.invoiceWork + " work completed at " + (p.client.address || "the project location") + "." : introText(p);
    p.items = [{ desc: scopeName + " Scope" + (isInv(p) ? " — Work Completed" : " — Complete") + "\n" + pd.itemNote, qty: "1 lot", price: price ? String(price) : "" }];
    if (!isInv(p)) { // textos padrão do tipo de serviço falado (ex.: reparo de telhado → garantia de 1 ano); o resto fica como está
      var c = coFor(p.companyId, p), base = defaults(p.companyId), jd = NV.tradeJobDefaults(tr, speech, { brand: c.brand, state: STATE_NAMES[stateOf(p.companyId)] || stateOf(p.companyId), code: stateOf(p.companyId), co: E.coFlags(p.companyId) });
      var prev = p.autoDefaults || {}; // o que a fala anterior trocou (para voltar ao padrão se a fala nova não pedir)
      ["includes", "notIncluded", "clarifications", "warranty"].forEach(function (k) { if (!p[k] || p[k] === base[k] || p[k] === prev[k]) p[k] = jd[k] != null ? jd[k] : base[k]; });
      p.autoDefaults = jd;
    }
    refreshHic(p);
    var cap = capDeposit(p);
    p.payment.rows = NV.tradePayment(tr, { price: price, split: split, capDeposit: cap });
    p.notes = [t("proposals.builtWithoutAiI", "Montado sem IA: escolhi as seções padrão pelas palavras faladas. Revise o texto em “Editar tudo”.")].concat(price ? [] : [t("proposals.couldnTFindThe", "Não achei o preço na fala.")])
      .concat(split && cap && split[0] > 33 ? [t("proposals.depositCapped", "Depósito limitado a 1/3 do preço (contrato residencial em MA — lei HIC, M.G.L. c.142A). Material sob encomenda pode justificar mais: ajuste em “Editar tudo”.")] : [])
      .concat(p.hic ? hicNotes(p) : []);
    p.total = totalOf(p);
  }
  function hicNotes(p) {
    var r = coRec(p.companyId) || p.companyBrand || {};
    return [t("proposals.hicAdded", "Incluí as cláusulas de contrato residencial de MA (lei HIC, M.G.L. c.142A): modelo para revisar com seu advogado.")]
      .concat(r.hicReg ? [] : [t("proposals.hicNoReg", "Falta o nº de registro HIC: preencha em Configurações → Empresa.")])
      .concat(p.startDate && p.endDate ? [] : [t("proposals.hicDates", "Preencha a data de início e a de conclusão em “Editar tudo” → Contrato residencial (MA).")]);
  }

  // ═══════════ invoice (documento) ═══════════
  function invoiceBody(p, c) {
    var A = c.accent, D = c.dark, paid = num(p.amountPaid), tot = totalOf(p);
    var logo = c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.brand) + '" style="width:2.4in;display:block;margin:0 auto">' : '<div style="font-size:30pt;font-weight:700;letter-spacing:.04em;color:' + D + ';text-align:center">' + esc(c.brand.toUpperCase()) + "</div>";
    var hd = p.header || {};
    var top = '<div style="text-align:center">' + logo + '<div style="font-weight:700;margin-top:6px">' + esc(hd.tagline || c.tagline) + '</div><div style="font-style:italic">' + esc(hd.contact || c.contact) + "</div></div>" +
      '<div style="border-top:1px solid ' + A + ';border-bottom:1px solid ' + A + ';margin:14px 0;padding:8px 0;text-align:center"><div style="font-size:26pt;font-weight:700;letter-spacing:.08em">INVOICE</div>' + (p.subtitle ? '<div style="font-style:italic">' + esc(p.subtitle) + "</div>" : "") + "</div>";
    var meta = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><tr>' +
      '<td style="width:50%;vertical-align:top;padding-right:14px"><div class="lab">Bill to</div><div style="font-size:12.5pt;font-weight:700;margin-top:3px">' + esc(p.client.name || "—") + "</div>" + (p.client.role ? '<div style="font-style:italic">' + esc(p.client.role) + "</div>" : "") +
      '<div class="lab" style="margin-top:10px">Project location</div><div style="font-weight:700;margin-top:3px">' + esc(p.client.address || "—") + "</div></td>" +
      '<td style="vertical-align:top"><table style="margin-left:auto;border-collapse:collapse">' +
      [["Invoice no.", p.number], ["Invoice date", longDate(p.date)], ["Payment terms", p.dueTerms || "Due upon receipt"], p.dueDate ? ["Due date", longDate(p.dueDate)] : null, p.ref ? ["Reference", "Proposal " + p.ref] : null].filter(Boolean).map(function (r) {
        return '<tr><td class="lab" style="padding:3px 14px 3px 0;text-align:right">' + esc(r[0]) + '</td><td style="padding:3px 0"><b>' + esc(r[1] || "") + "</b></td></tr>";
      }).join("") + "</table></td></tr></table>";
    var intro = p.intro ? '<p style="text-align:justify">' + rich(p.intro) + "</p>" : "";
    var work = p.sections.length ? "<h2>Work Performed</h2>" + p.sections.map(function (s) { return (p.sections.length > 1 ? "<h4>" + esc(s.title) + "</h4>" : "") + lines(s.text).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join(""); }).join("") : "";
    var items = p.items.filter(function (it) { return it.desc || it.price; });
    var tbl = "<h2>Charges</h2><table class=\"tbl\"><tr><th>Description</th><th style=\"width:1in\">Quantity</th><th style=\"width:1.3in;text-align:right\">Amount</th></tr>" +
      items.map(function (it) { var ls = String(it.desc || "").split("\n"); return "<tr><td><b>" + rich(ls[0]) + "</b>" + (ls.length > 1 ? "<br>" + ls.slice(1).map(rich).join("<br>") : "") + "</td><td>" + esc(it.qty) + '</td><td style="text-align:right">' + (it.price !== "" ? money2(num(it.price)) : "") + "</td></tr>"; }).join("") +
      (paid ? '<tr><td colspan="2" style="text-align:right"><b>Subtotal</b></td><td style="text-align:right">' + money2(tot) + '</td></tr><tr><td colspan="2" style="text-align:right"><b>Less: payments received</b></td><td style="text-align:right">(' + money2(paid) + ")</td></tr>" : "") +
      '<tr class="tot"><td colspan="2">BALANCE DUE</td><td style="text-align:right">' + money2(tot - paid) + "</td></tr></table>";
    var pay = '<h2>Payment</h2><div class="b">Please make checks payable to <b>' + esc(c.payTo || c.brand) + "</b> and reference invoice <b>" + esc(p.number || "") + "</b>.</div>" +
      '<div class="b">Payment terms: ' + esc(p.dueTerms || "Due upon receipt") + ".</div>" +
      '<p style="text-align:center;font-style:italic;margin-top:22px;color:' + A + '">Thank you for your business.</p>';
    return top + meta + intro + work + tbl + pay;
  }

  // ── ações da tela simples ──
  AC.pSend = function () {
    var p = S.pdraft, to = String((p.client && p.client.email) || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { E.toast(t("proposals.addTheCustomerS", "Coloque o e-mail do cliente primeiro.")); var f = document.querySelector('[data-pbind="client.email"]'); if (f) f.focus(); return; }
    if (!built(p) || !p.total) { E.toast(t("proposals.buildTheEstimateAnd", "Monte a proposta e confira o valor antes de enviar.")); return; }
    S.modal = { type: "confirm", title: t("proposals.sendToCustomer", "Enviar para o cliente"), text: t("proposals.send", "Enviar ") + (isInv(p) ? t("proposals.theInvoice2", "o invoice ") : t("proposals.theEstimate2", "a proposta ")) + (p.number || "") + " (" + money2(p.total) + t("proposals.to", ") para ") + to + t("proposals.theCustomerGetsAn", "? O cliente recebe um e-mail com o link para ver") + (isInv(p) ? "" : t("proposals.downloadThePdfAnd", ", baixar o PDF e aceitar")) + t("proposals.youLlGetA", ". Você recebe uma cópia.") + (API.mode === "demo" ? " " + t("proposals.demoSendNote", "No modo demonstração nada é enviado: a proposta é salva, mas o e-mail não sai (na conta real, sai na hora).") : ""), act: "pSendOk", id: "x", okLabel: t("proposals.send2", "Enviar") };
    E.render();
  };
  AC.pSendOk = function () {
    var p = S.pdraft; S.modal = null; p.total = totalOf(p); E.render(); E.toast(t("proposals.sending", "Enviando…"));
    API.saveProposal(p).then(function (saved) { p.id = saved.id; if (S.pdraft === p) markClean(); return API.services("sendProposal", { id: saved.id }); })
      .then(function (r) {
        if (r && r.ok) { p.sentTo = r.sent; p.sentAt = new Date().toISOString(); if (p.status === "Rascunho") p.status = "Enviada"; if (S.pdraft === p) markClean(); return reloadExt().then(function () { E.toast(t("proposals.sentTo2", "Enviado para ") + r.sent + "."); }); }
        E.toast(svcMsg(r));
      }).catch(function (e) { E.toast(e.message || t("proposals.errorUploading", "Erro ao enviar.")); });
  };
  AC.pMatList = function () {
    var p = S.pdraft; if (!p.id) { E.toast(t("proposals.saveTheEstimateFirst", "Salve a proposta primeiro.")); return; }
    S.pMatBusy = true; E.render();
    API.services("materialList", { id: p.id }).then(function (r) {
      S.pMatBusy = false;
      if (r && r.ok) { var clean = S.pdraft === p && !isDirty(); p.materialList = r.list; if (clean) markClean(); E.render(); E.toast(t("proposals.materialListReady", "Lista de material pronta.")); } else { E.render(); E.toast(svcMsg(r)); }
    });
  };
  function svcMsg(r) {
    var e = r && r.error;
    return ({ NO_EMAIL_KEY: "O envio de e-mail ainda não foi ligado (falta a chave do Resend no Supabase).", NO_KEY: "A IA ainda não foi ligada.", NOT_DEPLOYED: t("proposals.thisServiceIsnT", "Esse serviço ainda não foi instalado no Supabase."), DEMO: t("proposals.demoModeNothingWas", "Modo demonstração: nada foi enviado."), OFFLINE: t("proposals.noConnectionRightNow", "Sem conexão agora.") })[e] || (t("proposals.thatDidnTWork", "Não deu certo") + (r && r.detail ? ": " + r.detail : "."));
  }
  AC.pMic = function () { if (S.pRec) micStop(); else micStart(); };
  AC.pAdv = function () { S.pAdv = !S.pAdv; E.render(); };
  AC.pTypeFilter = function (el) { S.pTypeFilter = el.dataset.id; E.render(); };
  AC.pType = function (el) {
    var p = S.pdraft, t = el.dataset.id; if ((p.docType || "estimate") === t) return;
    p.docType = t; p.title = t === "invoice" ? "INVOICE" : coFor(p.companyId, p).title;
    if (!(t === "invoice" ? /^INV/i : /^EST/i).test(p.number || "")) p.number = nextNumber(t);
    if (t === "invoice" && p.status === "Aceita") p.status = "Rascunho";
    E.render();
  };
  AC.pToInvoice = function () { E.guardLeave(toInvoice); };
  function toInvoice() {
    var c = clone(S.pdraft); c.ref = c.number; c.id = null; c.docType = "invoice"; c.number = nextNumber("invoice"); c.title = "INVOICE"; c.status = "Rascunho"; c.date = today(); c.amountPaid = ""; c.notes = []; c.dueTerms = c.dueTerms || "Due upon receipt";
    S.pdraft = c; S.pBase = null; S.pSpeech = ""; E.render(); window.scrollTo(0, 0); E.toast(t("proposals.invoiceCreatedFromThe", "Invoice criado a partir da proposta. Fale o que mudou (ex.: quanto já foi pago) e salve."));
  }
  AC.pAI = function (el) {
    var mode = el.dataset.id, p = S.pdraft, t = $("#pSpeech"), speech = String((t ? t.value : S.pSpeech) || "").trim();
    if (!speech) { E.toast(NV.t("proposals.sayOrTypeWhat", "Fale ou escreva primeiro o que tem que ser feito.")); return; }
    micStop(); S.pSpeech = speech; S.pBusy = true; E.render();
    API.aiProposal({ company: p.companyId, trade: tradeKey(p.companyId), rules: NV.tradeAiRules(tradeKey(p.companyId), E.coFlags(p.companyId)), /* regras do ramo + opções da empresa (ex.: "Não fazemos gás") */ docType: p.docType || "estimate", speech: speech, client: p.client, today: today(), current: mode === "adjust" ? compact(p) : null })
      .then(function (res) {
        if (res && res.ok) { applyAI(p, res.result, mode, speech); S.pSpeech = ""; return { ok: true }; }
        var why = { NO_KEY: "A IA ainda não foi ligada (falta a chave da Anthropic no Supabase).", NOT_DEPLOYED: NV.t("proposals.theAiIsnT", "A IA ainda não foi instalada no Supabase."), DEMO: NV.t("proposals.demoModeNoAi", "Modo demonstração, sem IA."), FORBIDDEN: NV.t("proposals.onlyAdminsCanBuild", "Só administradores podem montar propostas."), OFFLINE: NV.t("proposals.noConnectionToThe", "Sem conexão com a IA agora."), EMPTY: NV.t("proposals.nothingToBuild", "Nada para montar.") }[res && res.error] || (NV.t("proposals.theAiDidnT", "A IA não respondeu") + (res && res.detail ? ": " + res.detail : "") + ".");
        if (mode === "new" && res && res.error !== "FORBIDDEN") { localBuild(p, speech); S.pSpeech = ""; return { ok: true, msg: why + NV.t("proposals.iBuiltASimple", " Montei uma versão simples pelas palavras faladas.") }; }
        return { ok: false, msg: why };
      })
      .catch(function (e) { return { ok: false, msg: (e && e.message) || NV.t("proposals.errorBuilding", "Erro ao montar.") }; })
      .then(function (r) {
        S.pBusy = false; E.render();
        if (!r.ok) { E.toast(r.msg); return; }
        if (p.client.name || p.client.address) autoSave(r.msg); else E.toast(r.msg || NV.t("proposals.doneFillInThe", "Pronto! Preencha o cliente e salve."));
        var pv = $("#pPrev"); if (pv) pv.scrollIntoView({ behavior: "smooth", block: "start" });
      });
  };
  function autoSave(msg) {
    var p = S.pdraft; p.total = totalOf(p);
    API.saveProposal(p).then(function (saved) { if (S.pdraft === p) { p.id = saved.id; markClean(); } return reloadExt(); })
      .then(function () { E.toast(msg || (isInv(p) ? t("proposals.invoiceReadyAndSaved", "Invoice pronto e salvo.") : t("proposals.estimateReadyAndSaved", "Proposta pronta e salva. Confira a prévia."))); })
      .catch(function () { E.toast((msg ? msg + " " : "") + t("proposals.doneButNotSaved", "Pronto, mas não salvou — toque em Salvar.")); });
  }
  EXT.input.push(function (el) { if (el.id !== "pSpeech") return false; S.pSpeech = el.value; schedulePersist(); return true; });
  EXT.change.push(function (el) { if (el.id !== "pLang") return false; S.pLang = el.value; if (S.pRec) { micStop(); micStart(); } return true; });


  // ═══════════ PREÇOS ═══════════
  // lista básica de materiais por ramo: trades.js → prices.basic ([nome, categoria, unidade] no idioma de quem adiciona)
  function myPricesView() {
    syncStores(); var f = S.priceFilter, cats = {}, tk = tradeKey(S.company);
    S.materials.forEach(function (m) { if (m.category) cats[m.category] = 1; });
    var list = S.materials.filter(function (m) { return (!f.cat || m.category === f.cat) && (!f.q || m.name.toLowerCase().indexOf(f.q.toLowerCase()) >= 0); })
      .sort(function (a, b) { return (a.category || "") + a.name < (b.category || "") + b.name ? -1 : 1; });
    var td = today();
    var deals = S.deals.filter(function (d) { return d.source !== "auto"; }).sort(function (a, b) { return (a.validUntil || "9999") < (b.validUntil || "9999") ? -1 : 1; });
    var dealsHtml = t("prices.dealsLoggedByHand", '<div class="panel" style="margin-top:14px"><div class="spread" style="margin-bottom:10px"><h3 style="margin:0">Ofertas anotadas à mão</h3><button class="btn ghost sm" data-act="prNewDeal">+ Oferta</button></div>') +
      (deals.length ? '<div class="stack" style="gap:8px">' + deals.map(function (d) {
        var expired = d.validUntil && d.validUntil < td;
        return '<div class="deal" style="' + (expired ? "opacity:.5" : "") + '"><div style="min-width:0"><span class="store-chip">' + esc(storeName(d.store)) + "</span> · <b>" + esc(d.title) + "</b>" + (d.price != null ? " · " + money2(d.price) : "") +
          '<div class="small muted">' + (d.validUntil ? (expired ? t("prices.expiredOn", "Venceu em ") : t("prices.until", "Até ")) + E.fmtDate(d.validUntil) : t("prices.noExpiration", "Sem validade")) + (d.note ? " · " + esc(d.note) : "") + (d.url ? ' · <a href="' + esc(d.url) + t("prices.open", '" target="_blank" rel="noopener">abrir</a>') : "") + '</div></div><button class="btn ghost sm" data-act="prDelDeal" data-id="' + d.id + t("prices.html", '" aria-label="Apagar oferta">✕</button></div>');
      }).join("") + "</div>" : t("prices.whenAStoreDeal", '<div class="muted small">Quando chegar uma promoção das lojas (e-mail, folheto, balcão), registre aqui para não perder.</div>')) + "</div>";
    var table = list.length ? '<div class="table-wrap"><table><thead><tr><th>Material</th>' + STORES.map(function (s) { return '<th class="n">' + esc(s.short) + "</th>"; }).join("") + t("prices.best", '<th class="n">Melhor</th></tr></thead><tbody>') +
      list.map(function (m) {
        var b = best(m);
        return '<tr><td><a href="#" data-act="prMat" data-id="' + m.id + '"><b>' + esc(m.name) + '</b></a><div class="small muted">' + esc([m.category, m.unit].filter(Boolean).join(" · ")) + "</div></td>" +
          STORES.map(function (s) {
            var l = latest(m, s.id), cls = !l ? "empty" : (b && l.id === b.id ? "best" : "") + (daysAgo(l.date) > 30 ? " stale" : "");
            return '<td class="n price-cell ' + cls + '" data-act="prPrice" data-id="' + m.id + '" data-store="' + s.id + '">' + (l ? money2(l.price) + '<span class="d">' + E.fmtDate(l.date) + "</span>" : "+") + "</td>";
          }).join("") + '<td class="n">' + (b ? '<b class="v-good">' + money2(b.price) + '</b><span class="d small muted" style="display:block">' + esc(storeName(b.store)) + "</span>" : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>"
      : (S.materials.length ? E.emptyState({ icon: "search", title: t("prices.noMaterialsMatchThis", "Nenhum material com esse filtro"), text: t("prices.changeTheSearchOr", "Troque a busca ou a categoria.") })
        : E.emptyState({ icon: "tag", title: t("prices.noMaterialsYet", "Nenhum material cadastrado"), text: t("prices.startWithABasic", "Comece por uma lista básica e vá anotando os preços de cada loja."), cta: '<div class="row" style="justify-content:center">' + tradeDef(S.company).prices.basicOffer.map(function (b, i) { return '<button class="btn ' + (i ? "ghost " : "") + 'sm" data-act="prBasic" data-id="' + b.list + '">' + esc(b.label) + "</button>"; }).join("") + "</div>" }));
    return t("prices.yourPricesByStore", '<div class="spread" style="margin-bottom:10px"><p class="muted small" style="margin:0">Seus preços por loja (usados na estimativa e na lista de material). Verde = mais barato · apagado = mais de 30 dias.</p><button class="btn sm" data-act="prNewMat">+ Material</button></div>') +
      t("prices.searchInputTypeSearch", '<div class="filters"><label class="field"><span>Buscar</span><input type="search" data-pf="q" value="') + esc(f.q) + t("prices.categoryAll", '" placeholder="ex.: Romex, GFCI, line set"></label><label class="field"><span>Categoria</span><select data-pf="cat"><option value="">Todas</option>').replace(/placeholder="[^"]*"/, function (m) { var ex = tradeDef(S.company).prices.searchExample; return ex ? 'placeholder="' + esc(ex) + '"' : m; }) + // exemplo do ramo (B17)
      Object.keys(cats).sort().map(function (c) { return "<option" + (f.cat === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></label></div>" + table +
      t("prices.tapAPriceTo", '<p class="muted small" style="margin-top:12px">Toque num preço para atualizar. As lojas de material elétrico mostram preço só para clientes com conta; use o preço da sua cotação ou nota fiscal.</p>') + dealsHtml;
  }

  var promoFile = null;
  // arquivo opcional de liquidações (gerado fora do app): só é buscado se configurado em APP_CONFIG.PROMOS_URL
  // (true = "promos.json" ao lado do app) — sem configuração não há requisição (antes dava 404 no console)
  function promoUrl() { var u = (window.APP_CONFIG || {}).PROMOS_URL; return u === true ? "promos.json" : (typeof u === "string" && u ? u : null); }
  function loadPromoFile() {
    if (promoFile !== null) return;
    promoFile = [];
    var url = promoUrl(); if (!url) return;
    fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !Array.isArray(j.items)) return;
      promoFile = j.items.map(function (d, i) { return { id: "pf" + i, store: d.store, title: d.title, price: d.price == null ? null : Number(d.price), wasPrice: d.was_price == null ? null : Number(d.was_price), image: d.image_url, url: d.url, note: d.note, validUntil: d.valid_until, source: "auto", fetchedAt: j.updated_at }; });
      if (S.view === "prices") E.render();
    }).catch(function () {});
  }
  function promoView() {
    loadPromoFile();
    var auto = S.deals.filter(function (d) { return d.source === "auto"; }).concat(promoFile || []).filter(function (d) { return !d.validUntil || d.validUntil >= today(); }), sf = S.promoStore || "";
    var stores = {}; auto.forEach(function (d) { stores[d.store] = (stores[d.store] || 0) + 1; });
    var list = auto.filter(function (d) { return !sf || d.store === sf; }).sort(function (a, b) {
      var sa = a.wasPrice && a.price ? (a.wasPrice - a.price) / a.wasPrice : 0, sb2 = b.wasPrice && b.price ? (b.wasPrice - b.price) / b.wasPrice : 0; return sb2 - sa; });
    var when = auto.reduce(function (a, d) { return d.fetchedAt > a ? d.fetchedAt : a; }, "");
    return t("prices.onlyElectricalMaterialOn", '<div class="spread" style="margin-bottom:10px"><p class="muted small" style="margin:0">Só material elétrico em liquidação / promoção nas suas lojas. Vem dos e-mails de promoção das lojas e atualiza sozinho todo dia às 7h45') + (when ? t("prices.lastCheck", " · última busca ") + E.fmtDate(when) + " " + new Date(when).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "") + '.</p><button class="btn sm" data-act="prFetch"' + (S.prBusy ? " disabled" : "") + ">" + (S.prBusy ? t("prices.searching1To2", '<span class="spin" aria-hidden="true"></span> Buscando… (1 a 2 min)') : t("prices.searchNow", "Buscar agora")) + "</button></div>" +
      (Object.keys(stores).length > 1 ? '<div class="chips" style="margin-bottom:12px"><button type="button" class="chip' + (!sf ? " on" : "") + t("prices.all", '" data-act="prStore" data-id="">Todas (') + auto.length + ")</button>" + Object.keys(stores).map(function (k) { return '<button type="button" class="chip' + (sf === k ? " on" : "") + '" data-act="prStore" data-id="' + k + '">' + esc(storeName(k)) + " (" + stores[k] + ")</button>"; }).join("") + "</div>" : "") +
      (list.length ? '<div class="deal-grid">' + list.map(function (d) {
        var off = d.wasPrice && d.price ? Math.round((d.wasPrice - d.price) / d.wasPrice * 100) : 0;
        return '<a class="deal-card" href="' + esc(d.url || "#") + '" target="_blank" rel="noopener"><div class="deal-img">' + (d.image ? '<img src="' + esc(d.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'noimg\',textContent:\'sem foto\'}))">' : t("prices.noPhoto", '<span class="noimg">sem foto</span>')) + "</div>" +
          '<div class="deal-body"><span class="store-chip">' + esc(storeName(d.store)) + "</span>" + '<div class="deal-title">' + esc(d.title) + "</div>" +
          (d.price != null ? '<div><span class="deal-price">' + money2(d.price) + "</span>" + (d.wasPrice ? '<span class="deal-was">' + money2(d.wasPrice) + "</span>" : "") + (off ? ' <span class="pill good">-' + off + "%</span>" : "") + "</div>" : "") +
          (d.note ? '<div class="small muted">' + esc(d.note) + "</div>" : "") + "</div></a>";
      }).join("") + "</div>"
        : E.emptyState({ icon: "tag", title: when ? t("prices.noClearanceDealsFound", "Nenhuma liquidação encontrada") : t("prices.weHavenTChecked", "Ainda não buscamos as promoções"), text: when ? t("prices.noElectricalClearanceDeals", "Nenhuma liquidação de material elétrico encontrada na última busca.") : t("prices.tapSearchNow", "Toque em “Buscar agora”.") }));
  }
  EXT.views.prices = function () {
    syncStores();
    if (!tradeDef(S.company).prices.promos) return t("proposals.pricesYourMaterialAnd", '<div class="page-head"><div><h1>Preços</h1><p>Seus preços de material e equipamento por fornecedor</p></div></div>') +
      '<div class="panel promo-note small muted" role="note" style="margin-bottom:12px">' + esc(t("proposals.promosOnlyElectrical", "Promoções (liquidações das lojas) por enquanto só existem para material elétrico. Aqui ficam os seus preços por loja — o mais barato aparece em verde.")) + "</div>" +
      myPricesView(); // promoções = liquidações de material elétrico
    var tab = S.prTab || "promo";
    return t("proposals.pricesStoreClearanceDeals", '<div class="page-head"><div><h1>Preços</h1><p>Liquidações das lojas e seus preços de material</p></div></div>') +
      '<div class="tabs"><button data-act="prTab" data-id="promo" class="' + (tab === "promo" ? "on" : "") + t("proposals.dealsButtonDataAct", '">Promoções</button><button data-act="prTab" data-id="mine" class="') + (tab === "mine" ? "on" : "") + t("proposals.myPrices", '">Meus preços</button></div>') +
      (tab === "promo" ? promoView() : myPricesView());
  };
  AC.prTab = function (el) { S.prTab = el.dataset.id; E.render(); };
  AC.prStore = function (el) { S.promoStore = el.dataset.id; E.render(); };
  AC.prFetch = function () {
    S.prBusy = true; E.render();
    API.services("fetchDeals", {}).then(function (r) {
      S.prBusy = false;
      if (r && r.ok) return reloadExt().then(function () { E.toast(r.saved ? r.saved + t("proposals.dealsFound", " promoções encontradas.") : t("proposals.noElectricalClearanceDeals", "Nenhuma liquidação de material elétrico encontrada agora.")); });
      E.render(); E.toast(svcMsg(r));
    });
  };

  AC.prBasic = function (el) {
    var have = {}; S.materials.forEach(function (m) { have[m.name] = 1; });
    var list = NV.tradeDef(el.dataset.id).prices.basic.filter(function (x) { return !have[x[0]]; }).map(function (x) { return { name: x[0], category: x[1], unit: x[2] }; });
    E.toast(t("proposals.adding", "Adicionando ") + list.length + t("proposals.materials", " materiais…"));
    API.saveMaterials(list).then(reloadExt).then(function () { E.toast(t("proposals.listAddedNowJust", "Lista adicionada. Agora é só preencher os preços.")); }).catch(function (e) { E.toast(e.message); });
  };
  AC.prNewMat = function () { S.modal = { type: "material", title: t("proposals.newMaterial", "Novo material") }; E.render(); };
  AC.prMat = function (el) { S.modal = { type: "material", title: "Material", id: el.dataset.id }; E.render(); };
  AC.prPrice = function (el) { S.modal = { type: "price", title: t("proposals.updatePrice", "Atualizar preço"), id: el.dataset.id, store: el.dataset.store }; E.render(); };
  AC.prNewDeal = function () { S.modal = { type: "deal", title: t("proposals.newDeal", "Nova oferta") }; E.render(); };
  AC.prDelDeal = function (el) { API.deleteDeal(el.dataset.id).then(reloadExt); };
  AC.prDelPrice = function (el) { API.deletePrice(S.modal.id, el.dataset.id).then(reloadExt).then(function () { E.render(); }); };
  AC.prAskDelMat = function (el) { S.modal = { type: "confirm", title: t("proposals.deleteMaterial", "Apagar material"), text: t("proposals.deleteThisMaterialAnd", "Apagar este material e todo o histórico de preços dele?"), act: "prDelMat", id: el.dataset.id, okLabel: t("proposals.delete", "Apagar") }; E.render(); };
  AC.prDelMat = function (el) { API.deleteMaterial(el.dataset.id).then(function () { S.modal = null; return reloadExt(); }); };

  EXT.modals = {
    material: function (m) {
      syncStores();
      var x = m.id ? matById(m.id) : { name: "", category: "", unit: "" };
      return t("prices.materialNameInputType", '<form id="matForm" class="stack"><label class="field"><span>Nome do material</span><input type="text" id="mName" value="') + esc(x.name) + '" required placeholder="' + esc(t("prices.matNamePh", "ex.: Romex NM-B 12/2 — 250 ft")) + '"></label>' +
        t("prices.categoryInputTypeText", '<div class="grid2"><label class="field"><span>Categoria</span><input type="text" id="mCat" value="') + esc(x.category || "") + t("prices.unitInputTypeText", '" list="mCats"></label><label class="field"><span>Unidade</span><input type="text" id="mUnit" value="') + esc(x.unit || "") + t("prices.html2", '" placeholder="rolo, un, caixa, peça"></label></div>') +
        '<datalist id="mCats">' + Array.from(new Set(S.materials.map(function (q) { return q.category; }).filter(Boolean))).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
        (m.id ? t("prices.searchTheStores", '<div><span class="label">Pesquisar nas lojas</span><div class="chips" style="margin-top:6px">') + STORES.map(function (s) { return '<a class="chip" href="' + esc(s.url(x.name)) + '" target="_blank" rel="noopener">' + esc(s.short) + " ↗</a>"; }).join("") + "</div></div>" : "") +
        '<div class="row" style="justify-content:space-between">' + (m.id ? '<button type="button" class="btn danger sm" data-act="prAskDelMat" data-id="' + m.id + t("prices.deleteMaterial", '">Apagar material</button>') : "<span></span>") + t("prices.save", '<button class="btn" type="submit">Salvar</button></div></form>');
    },
    price: function (m) {
      syncStores(); var x = matById(m.id), st = STORES.find(function (s) { return s.id === m.store; });
      var hist = (x.prices || []).filter(function (p) { return p.store === m.store; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      return '<form id="priceForm" class="stack"><div><b>' + esc(x.name) + '</b><div class="muted small">' + esc(st.name) + (x.unit ? t("prices.per", " · por ") + esc(x.unit) : "") + "</div></div>" +
        t("prices.priceDateInputType", '<div class="grid2"><label class="field"><span>Preço $</span><input type="number" id="prVal" step="0.01" min="0" inputmode="decimal" required autofocus></label><label class="field"><span>Data</span><input type="date" id="prDate" value="') + today() + '" required></label></div>' +
        t("prices.note", '<label class="field"><span>Observação</span><input type="text" id="prNote" placeholder="ex.: cotação #1234, promoção, nota fiscal"></label>') +
        '<div class="row" style="justify-content:space-between"><a href="' + esc(st.url(x.name)) + t("prices.searchOn", '" target="_blank" rel="noopener" class="small">Pesquisar no site da ') + esc(st.short) + t("prices.savePrice", " ↗</a><button class=\"btn\" type=\"submit\">Salvar preço</button></div>") +
        (hist.length ? t("prices.history", '<div><span class="label">Histórico</span><div class="table-wrap" style="margin-top:6px"><table><tbody>') + hist.map(function (h) { return "<tr><td>" + E.fmtDate(h.date) + '</td><td class="n"><b>' + money2(h.price) + '</b></td><td class="small muted">' + esc(h.note || "") + '</td><td class="n"><button type="button" class="btn ghost sm" data-act="prDelPrice" data-id="' + h.id + t("expenses.html", '" aria-label="Apagar">✕</button></td></tr>'); }).join("") + "</tbody></table></div></div>" : "") + "</form>";
    },
    deal: function () {
      syncStores(); return t("prices.store", '<form id="dealForm" class="stack"><div class="grid2"><label class="field"><span>Loja</span><select id="dStore">') + STORES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("") + t("prices.validUntil", '</select></label><label class="field"><span>Válida até</span><input type="date" id="dUntil"></label></div>') +
        t("prices.deal", '<label class="field"><span>Oferta</span><input type="text" id="dTitle" required placeholder="ex.: Romex 12/2 250 ft — 15% off"></label>') +
        t("prices.priceOptionalLinkOptional", '<div class="grid2"><label class="field"><span>Preço $ (opcional)</span><input type="number" id="dPrice" step="0.01" min="0" inputmode="decimal"></label><label class="field"><span>Link (opcional)</span><input type="text" id="dUrl" placeholder="https://"></label></div>') +
        t("prices.noteSaveDeal", '<label class="field"><span>Observação</span><input type="text" id="dNote"></label><button class="btn" type="submit">Salvar oferta</button></form>');
    }
  };
  EXT.submit.matForm = function () {
    var m = { id: S.modal.id || null, name: $("#mName").value.trim(), category: $("#mCat").value.trim(), unit: $("#mUnit").value.trim() };
    if (!m.name) return;
    if (m.id) m.prices = (matById(m.id) || {}).prices;
    API.saveMaterial(m).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast(t("proposals.materialSaved", "Material salvo.")); }).catch(function (e) { E.toast(e.message); });
  };
  EXT.submit.priceForm = function () {
    var v = num($("#prVal").value); if (!(v > 0)) { E.toast(t("proposals.enterThePrice", "Informe o preço.")); return; }
    API.addPrice({ materialId: S.modal.id, store: S.modal.store, price: v, date: $("#prDate").value, note: $("#prNote").value }).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast(t("proposals.priceSaved", "Preço salvo.")); }).catch(function (e) { E.toast(e.message); });
  };
  EXT.submit.dealForm = function () {
    var d = { store: $("#dStore").value, title: $("#dTitle").value.trim(), price: $("#dPrice").value, validUntil: $("#dUntil").value, url: $("#dUrl").value.trim(), note: $("#dNote").value.trim() };
    if (!d.title) return;
    API.saveDeal(d).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast(t("proposals.dealSaved", "Oferta salva.")); }).catch(function (e) { E.toast(e.message); });
  };

  window.EE.buildProposalDoc = buildDoc; // usado nos testes

  // ═══════════ página do cliente (link do e-mail): ver, baixar PDF e aceitar ═══════════
  (function publicPage() {
    var mt = /[?&]proposta=([0-9a-f-]{36})/i.exec(location.search); if (!mt) return;
    var cfg = window.APP_CONFIG || {}, token = mt[1], app = document.getElementById("app");
    document.title = "Proposal"; document.documentElement.lang = "en-US"; // página do cliente: sempre em inglês; marca = empresa de quem enviou (Configurações → Empresa)
    function call(body) {
      if (!cfg.SUPABASE_URL) return Promise.resolve({ error: "DEMO" });
      return fetch(cfg.SUPABASE_URL + "/functions/v1/servicos", { method: "POST", headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); }).catch(function () { return { error: "OFFLINE" }; });
    }
    function full(p) {
      return Object.assign({ client: {}, sections: [], items: [], payment: { rows: [] }, header: {}, validityDays: 30 }, p, { client: p.client || {}, sections: p.sections || [], items: p.items || [], payment: p.payment || { rows: [] }, header: p.header || {} });
    }
    var after = document.createElement("div"); after.id = "pub-after"; document.body.appendChild(after);
    function show(raw) {
      var p = full(raw); p._public = true;
      var inv = p.docType === "invoice", c = coFor(p.companyId, p), bg = c.custom ? "#EEF1F0" : "#EFE8DC";
      document.title = ((inv ? "Invoice " : "Proposal ") + (p.number || "")).trim() + (c.brand ? " · " + c.brand : "");
      document.body.style.background = bg;
      app.innerHTML = '<div class="pub-bar"><div><b style="font-size:17px">' + esc(c.brand || (inv ? "Invoice" : "Proposal")) + '</b><div class="small" style="color:#7a6a55">' + (inv ? "Invoice " : "Proposal ") + esc(p.number || "") + "</div></div>" +
        '<button class="btn" id="pubPdf" type="button">Download PDF</button></div>';
      var root = document.getElementById("print-root");
      if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.insertBefore(root, after); }
      root.className = "pub"; root.innerHTML = buildDoc(p);
      document.getElementById("pubPdf").onclick = function () { printDoc(p); setTimeout(function () { root.className = "pub"; document.body.style.background = bg; }, 2000); };
      if (inv) { after.innerHTML = ""; return; }
      if (p.acceptedAt || p.status === "Aceita") {
        after.innerHTML = '<div class="pub-accept" style="border-color:#2E7D4F"><b style="font-size:18px;color:#2E7D4F">✓ Proposal accepted</b><div>Accepted by <b>' + esc(p.acceptedBy || "") + "</b>" + (p.acceptedAt ? " on " + esc(longDate(String(p.acceptedAt).slice(0, 10))) : "") + ". Thank you! We will contact you shortly to schedule the work.</div></div>";
        return;
      }
      after.innerHTML = '<form class="pub-accept" id="pubForm"><b style="font-size:18px">Accept this proposal</b>' +
        '<div class="small" style="color:#7a6a55">Total: <b style="color:#2B241D">' + money2(p.total) + "</b> · " + esc(p.totalLabel || "") + "</div>" +
        '<label class="field"><span>Your full name</span><input type="text" id="pubName" autocomplete="name" required value="' + esc(p.client.name || "") + '"></label>' +
        '<label class="row" style="align-items:flex-start;gap:8px"><input type="checkbox" id="pubOk" required style="width:auto;margin-top:3px"> <span>I have read and accept the scope of work, pricing and payment terms of this proposal.</span></label>' +
        '<div class="err" id="pubErr" hidden></div><button class="btn" type="submit" style="background:' + (c.accent || "#2A5BFF") + ';color:#fff">Accept proposal</button>' +
        '<div class="small" style="color:#7a6a55">Questions? Reply to the email you received' + (c.email ? " or write to " + esc(c.email) : "") + ".</div></form>";
      document.getElementById("pubForm").onsubmit = function (ev) {
        ev.preventDefault();
        var name = document.getElementById("pubName").value.trim(), err = document.getElementById("pubErr"), btn = this.querySelector("button");
        if (!name || !document.getElementById("pubOk").checked) { err.textContent = "Please type your name and check the box."; err.hidden = false; return; }
        btn.disabled = true; btn.textContent = "Sending…";
        call({ action: "publicAccept", token: token, name: name }).then(function (r) {
          if (r && r.ok) { show(r.proposal); window.scrollTo(0, document.body.scrollHeight); return; }
          btn.disabled = false; btn.textContent = "Accept proposal"; err.textContent = (r && r.detail) || "Something went wrong. Please try again."; err.hidden = false;
        });
      };
    }
    call({ action: "publicGet", token: token }).then(function (r) {
      if (r && r.ok) return show(r.proposal);
      app.innerHTML = '<div class="login"><div class="login-card"><div class="brand-name">Online proposal</div><p>' + (r && r.error === "NOT_FOUND" ? "This link is no longer valid." : "We could not load this document right now. Please try again in a moment.") + "</p></div></div>";
    });
  })();
})();
