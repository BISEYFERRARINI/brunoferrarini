/* Propostas (proposals) + Preços de material — admin only. Plugs into app.js through window.EE. */
(function () {
  "use strict";
  var E = window.EE, S = E.S, API = E.API, esc = E.esc, money = E.money, EXT = E.EXT;
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
  var STORES = [
    { id: "homedepot", name: "The Home Depot", short: "Home Depot", url: function (q) { return "https://www.homedepot.com/s/" + encodeURIComponent(q); } },
    { id: "ies", name: "Independent Electric Supply", short: "Independent", url: function (q) { return g("Independent Electric Supply " + q); } },
    { id: "northeast", name: "Northeast Electrical", short: "Northeast", url: function (q) { return g("Northeast Electrical Distributors " + q); } },
    { id: "granite", name: "Granite City Electric", short: "Granite City", url: function (q) { return g("Granite City Electric Supply " + q); } },
    { id: "standard", name: "Standard Electric", short: "Standard", url: function (q) { return g("Standard Electric Supply " + q); } }
  ];
  function storeName(id) { var s = STORES.find(function (x) { return x.id === id; }); return s ? s.short : id; }
  function latest(m, store) {
    var list = (m.prices || []).filter(function (p) { return p.store === store; });
    list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return list[0] || null;
  }
  function best(m) {
    var b = null;
    STORES.forEach(function (s) { var p = latest(m, s.id); if (p && (!b || p.price < b.price)) b = p; });
    return b;
  }
  function daysAgo(iso) { return Math.floor((Date.now() - new Date(iso + "T12:00:00")) / 864e5); }
  function matById(id) { return S.materials.find(function (m) { return m.id === id; }); }

  // ═══════════ empresas (cabeçalho do documento) ═══════════
  var CO = {
    eternity: { brand: "Eternity Electric", title: "ELECTRICAL PROPOSAL", tagline: "LICENSED ELECTRICAL CONTRACTOR", contact: "Commonwealth of Massachusetts · office@eternityelectrical.com",
      footer: "Eternity Electric · office@eternityelectrical.com · Licensed Electrical Contractor MA", role: "Licensed Electrical Contractor", logo: "icons/logo-eternity.jpg", logoSm: "icons/logo-eternity-sm.jpg",
      accent: "#B08A4A", dark: "#2B241D", bg: "#FBF7F1", payTo: "Eternity Electric" },
    bluestar: { brand: "Blue Star HVAC", title: "HVAC PROPOSAL", tagline: "HEATING · VENTILATION · AIR CONDITIONING", contact: "Blue Star HVAC Inc. · Watertown, Massachusetts",
      footer: "Blue Star HVAC Inc. · Watertown, MA", role: "HVAC Contractor", logo: null, logoSm: null, accent: "#2462B0", dark: "#13233A", bg: "#F7F9FC", payTo: "Blue Star HVAC Inc." }
  };

  var SECTIONS = {
    electrical: [
      ["Service & Distribution", "Furnish and install a new **200A** electrical service coordinated with the utility, including meter socket, service-entrance conductors, and grounding/bonding system per NEC Article 250.\nFurnish and install a new main panel with all required breakers, including AFCI/GFCI protection per NEC.\nBonding and grounding of the electrical system, including water and gas piping."],
      ["Rough-In & Wiring", "Complete rough-in wiring per the plans and NEC, including all boxes, cable, supports, and fire-stopping at penetrations.\nWiring method: **NM-B (Romex)** where permitted; **MC cable** where required.\nAll branch circuits labeled at the panel."],
      ["Devices & Lighting", "Install all required receptacles per NEC 210.52 — tamper-resistant (TR) throughout.\nWire and install all switching (single-pole, three-way, four-way and dimmers as required).\nFurnish and install LED recessed downlights per the reflected ceiling plan; quantity and trim to be confirmed at rough-in walk-through."],
      ["Kitchen & Bathrooms", "Two (2) 20A small-appliance circuits with GFCI protection at all countertop receptacles.\nDedicated circuits for refrigerator, dishwasher, disposal, microwave / range hood.\nGFCI protection and dedicated 20A circuit for each bathroom; exhaust fan wiring (fan supplied by GC / Owner)."],
      ["Smoke / CO Detectors", "Furnish and install hardwired, interconnected combination smoke / carbon-monoxide detectors per 527 CMR and the Massachusetts Smoke & CO Detector regulations."],
      ["HVAC & Equipment Connections", "Provide power feed, disconnect, and whip for each condensing unit / heat pump.\nProvide power for air handler / furnace and thermostat low-voltage wiring as required."],
      ["Fire Alarm", "Furnish and install the fire alarm system per the approved fire alarm drawings, NFPA 72 and local Fire Department requirements, including devices, wiring, testing, and Fire Department acceptance test coordination."],
      ["Low Voltage — Basic Rough-In", "Provide low-voltage rough-in for **cable / TV** and **data / internet** at primary locations, and doorbell / intercom rough-in. Final termination by Owner / ISP."],
      ["Exterior & Garage", "Install weather-resistant GFCI receptacles with in-use covers at required exterior locations.\nWire exterior lighting at entries (fixtures supplied by Owner / GC)."],
      ["Permit & Inspections", "Electrical permit will be pulled by us. Permit fees are included.\nCoordination of all required inspections (rough and final) with the Authority Having Jurisdiction."]
    ],
    hvac: [
      ["Removal of Existing Equipment", "Disconnect, remove, and properly dispose of the existing equipment.\nRecover existing refrigerant per EPA Section 608."],
      ["Equipment Installation", "Furnish and install a new **heat pump system** sized per Manual J load calculation, including outdoor unit on pad / brackets and indoor air handler.\nAll equipment installed per manufacturer's installation instructions."],
      ["Ductwork & Distribution", "Furnish and install new sheet-metal supply and return ductwork as required, sealed and insulated per the Massachusetts Energy Code.\nInstall supply registers and return grilles."],
      ["Refrigerant Piping & Condensate", "Furnish and install insulated copper line sets, nitrogen pressure test, evacuation (micron verified), and refrigerant charge per manufacturer.\nCondensate drain piping with condensate pump where required."],
      ["Controls & Thermostats", "Furnish and install programmable / Wi-Fi thermostat(s) and zoning controls as required."],
      ["Venting & Gas (by others)", "Install venting / flue per manufacturer's instructions.\nGas piping and gas connection to the appliance by others (licensed plumber / gas fitter)."],
      ["Start-Up, Testing & Commissioning", "Start-up, testing, and commissioning of the complete system; review of operation with the Owner."],
      ["Rebates & Documentation", "Provide documentation required for **Mass Save** rebates where applicable (rebate approval by the program)."],
      ["Permit & Inspections", "Mechanical / gas permits will be pulled by us. Permit fees are included.\nCoordination of all required inspections."]
    ]
  };

  var PAY = {
    "50/50": [["Deposit", "Upon signed acceptance of this proposal.", 50], ["Final Payment", "Upon completion and final inspection.", 50]],
    "30/40/30": [["Deposit", "Upon signed acceptance, prior to mobilization.", 30], ["Rough-In", "Upon completion of rough-in and rough inspection.", 40], ["Final Payment", "Upon completion, final inspection and AHJ sign-off.", 30]],
    "Bank 35/35/30": [["First Draw", "Performance affidavit issued to the bank upon mobilization and start of work.", 35], ["Second Draw", "After rough inspection, second performance affidavit issued to the bank.", 35], ["Final Draw", "After final inspection and AHJ sign-off, completion affidavit issued to the bank.", 30]],
    "100% final": [["Payment in Full", "Upon completion and final inspection.", 100]]
  };

  function defaults(co) {
    var ele = E.tradeOf(co) !== "hvac", c = CO[co] || CO.eternity;
    return {
      includes: ele ? "all labor, materials, supervision, project management, applicable Massachusetts sales tax, and electrical permit fees and inspection coordination."
        : "all labor, equipment and materials listed above, supervision, applicable Massachusetts sales tax, and mechanical permit fees and inspection coordination.",
      notIncluded: ele ? "Fire alarm system (unless listed above) · any engineering, stamped drawings, or design drawings · decorative light fixtures, pendants, sconces, chandeliers, and ceiling fans (supplied by Owner / GC; installation included where listed) · appliances · HVAC equipment supply (electrical connection only) · utility company charges and customer-contribution fees · trenching or excavation · drywall, patching, painting, framing, or carpentry · core drilling and structural penetrations."
        : "Gas piping and gas connections (by a licensed plumber / gas fitter) · electrical power feed and disconnect (by a licensed electrician unless listed above) · drywall, patching, painting, or carpentry · structural modifications · asbestos or hazardous-material abatement · oil tank removal · engineering or stamped drawings · utility company charges.",
      clarifications: (ele ? "Electrical permit will be pulled by " + c.brand + ". **Permit fees are included.**\nAll work performed by licensed Massachusetts electricians under the direct supervision of our Master Electrician.\n"
        : "Mechanical permit will be pulled by " + c.brand + ". **Permit fees are included.**\nAll work performed by licensed technicians.\n") + "Any work outside the scope above will be quoted as a written change order before it is performed.",
      warranty: "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Massachusetts Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request."
    };
  }
  function introText(p) {
    var ele = E.tradeOf(p.companyId) !== "hvac", where = p.client.address || "the project location";
    var what = p.subtitle ? "the " + p.subtitle.toLowerCase().replace(/ · /g, " — ") : (ele ? "the project" : "the project");
    return ele
      ? "This proposal covers the electrical scope of work for " + what + " at " + where + ". Work will be performed in full compliance with the 2023 Massachusetts Electrical Code (527 CMR 12.00 / NEC 2023), the Massachusetts State Building Code 780 CMR (10th edition), and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed Massachusetts electricians under permit."
      : "This proposal covers the HVAC scope of work for " + what + " at " + where + ". Work will be performed in accordance with the Massachusetts State Building Code 780 CMR (10th edition), the Massachusetts Fuel Gas Code (248 CMR) where applicable, the manufacturer's installation instructions, and the requirements of the local Authority Having Jurisdiction.";
  }
  function nextNumber(type) {
    var inv = type === "invoice", max = inv ? 1000 : 366, re = inv ? /^INV/i : /^EST/i;
    S.proposals.forEach(function (p) { if (!re.test(p.number || "")) return; var m = /(\d+)/.exec(p.number || ""); if (m) max = Math.max(max, Number(m[1])); });
    return (inv ? "INV" : "EST") + (max + 1);
  }
  function blankProposal() {
    var co = S.company, c = CO[co] || CO.eternity, d = defaults(co);
    var p = { id: null, docType: "estimate", speech: "", notes: [], companyId: co, number: nextNumber(), status: "Rascunho", date: today(), validityDays: 30, title: c.title, subtitle: "",
      client: { name: "", role: "General Contractor", address: "" }, intro: "", sections: [], items: [{ desc: "", qty: "1 lot", price: "" }],
      totalLabel: "TOTAL — Lump Sum, Fixed Price", includes: d.includes, payment: { note: "", rows: clone(PAY["30/40/30"]) },
      notIncluded: d.notIncluded, clarifications: d.clarifications, warranty: d.warranty,
      header: { tagline: c.tagline, contact: c.contact, footer: c.footer }, materials: [], total: 0, amountPaid: "", dueTerms: "Due upon receipt", dueDate: "" };
    return p;
  }
  function totalOf(p) { return (p.items || []).reduce(function (a, it) { return a + num(it.price); }, 0); }

  // ═══════════ carregamento ═══════════
  EXT.load.push(function () {
    return Promise.all([API.listProposals(), API.listMaterials(), API.listDeals()]).then(function (r) { S.proposals = r[0] || []; S.materials = r[1] || []; S.deals = r[2] || []; });
  });
  function reloadExt() { return Promise.all(EXT.load.map(function (f) { return f(); })).then(E.render); }

  var STATUS_P = { "Rascunho": "neutral", "Enviada": "accent", "Aceita": "good", "Recusada": "bad", "Paga": "good" };
  function isInv(p) { return p && p.docType === "invoice"; }
  function pPill(s) { return '<span class="pill ' + (STATUS_P[s] || "neutral") + '">' + esc(s) + "</span>"; }

  // ═══════════ lista de propostas ═══════════
  EXT.views.proposals = function () {
    if (S.pRec) micStop();
    var all = S.proposals.filter(function (p) { return p.companyId === S.company; }), tf = S.pTypeFilter || "all";
    var list = all.filter(function (p) { return !isInv(p); });
    var shown = all.filter(function (p) { return tf === "all" || (tf === "invoice") === isInv(p); });
    var sum = function (st) { return list.filter(function (p) { return p.status === st; }).reduce(function (a, p) { return a + (p.total || 0); }, 0); };
    var sent = list.filter(function (p) { return p.status === "Enviada" || p.status === "Aceita" || p.status === "Recusada"; }).length, won = list.filter(function (p) { return p.status === "Aceita"; }).length;
    return '<div class="page-head"><div><h1>Propostas</h1><p>' + esc(E.companyName(S.company)) + " · " + list.length + ' estimates · ' + (all.length - list.length) + ' invoices</p></div><div class="row"><button class="btn ghost" data-act="pNew" data-id="invoice">+ Invoice</button><button class="btn" data-act="pNew" data-id="estimate">🎤 Nova proposta</button></div></div>' +
      '<div class="kpis" style="margin-bottom:14px">' +
      kpi("Enviadas aguardando", money(sum("Enviada")), list.filter(function (p) { return p.status === "Enviada"; }).length + " propostas") +
      kpi("Aceitas", money(sum("Aceita")), won + " propostas", "v-good") +
      kpi("Taxa de fechamento", (sent ? Math.round(won / sent * 100) : 0) + "%", won + " de " + sent + " enviadas") + "</div>" +
      '<div class="chips" style="margin-bottom:10px">' + [["all", "Todas"], ["estimate", "Estimates"], ["invoice", "Invoices"]].map(function (x) { return '<button type="button" class="chip' + (tf === x[0] ? " on" : "") + '" data-act="pTypeFilter" data-id="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      (shown.length ? '<div class="table-wrap"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Obra</th><th>Data</th><th>Status</th><th class="n">Valor</th></tr></thead><tbody>' +
        shown.map(function (p) {
          return '<tr class="click" data-act="pOpen" data-id="' + p.id + '"><td><b>' + esc(p.number || "—") + '</b><div class="small muted">' + (isInv(p) ? "Invoice" : "Estimate") + "</div></td><td>" + esc((p.client || {}).name || "—") + '</td><td class="small">' + esc((p.client || {}).address || "") + (p.subtitle ? '<div class="muted">' + esc(p.subtitle) + "</div>" : "") + "</td><td>" + E.fmtDate(p.date) + "</td><td>" + pPill(p.status) + '</td><td class="n"><b>' + money(p.total) + "</b></td></tr>";
        }).join("") + "</tbody></table></div>"
        : '<div class="panel empty">Nada aqui ainda. Toque em “Nova proposta”, fale o serviço e a proposta sai pronta.</div>');
  };
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
    var trade = E.tradeOf(p.companyId) === "hvac" ? "hvac" : "electrical";
    p.total = totalOf(p);
    var payTotal = (p.payment.rows || []).reduce(function (a, r) { return a + num(r[2]); }, 0);
    var a = '<div class="panel ed-sec"><h3>Cliente e obra</h3><div class="grid3">' + inp("number", "Número") + inp("date", "Data", "", "date") + inp("validityDays", "Validade (dias)", 'inputmode="numeric"', "number") + "</div>" +
      '<div class="grid2">' + inp("client.name", "Preparado para (cliente / GC)") + inp("client.role", "Função do cliente (ex.: General Contractor, Homeowner)") + "</div>" +
      inp("client.address", "Endereço da obra") +
      (isInv(p) ? '<div class="grid3">' + inp("amountPaid", "Já pago ($)", 'inputmode="decimal"') + inp("dueTerms", "Condição (ex.: Due upon receipt)") + inp("dueDate", "Vencimento", "", "date") + "</div>" : "") +
      '<div class="grid2">' + inp("title", "Título do documento") + inp("subtitle", "Subtítulo (ex.: New Construction · 5-Unit Multi-Family Residence)") + "</div>" +
      ta("intro", "Introdução", 5) + '<div><button class="btn ghost sm" data-act="pGenIntro">Gerar introdução padrão</button></div></div>';

    var sec = '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Escopo do trabalho</h3><span class="muted small">uma linha = um item ◆ · use **negrito**</span></div>' +
      (p.sections.length ? p.sections.map(function (s, i) {
        return '<div class="sec-card"><div class="row"><input type="text" data-pbind="sections.' + i + '.title" value="' + esc(s.title) + '" style="flex:1 1 220px;font-weight:600">' +
          '<button class="btn ghost sm" data-act="pMoveSec" data-id="' + i + '" data-dir="-1" aria-label="Subir">↑</button><button class="btn ghost sm" data-act="pMoveSec" data-id="' + i + '" data-dir="1" aria-label="Descer">↓</button><button class="btn ghost sm" data-act="pRmSec" data-id="' + i + '" aria-label="Remover seção">✕</button></div>' +
          '<textarea data-pbind="sections.' + i + '.text" rows="' + Math.max(3, lines(s.text).length + 1) + '">' + esc(s.text) + "</textarea></div>";
      }).join("") : '<div class="muted">Adicione as seções do escopo abaixo.</div>') +
      '<div><span class="label">Adicionar seção</span><div class="chips" style="margin-top:6px">' + SECTIONS[trade].map(function (x, i) { return '<button type="button" class="chip" data-act="pAddSec" data-id="' + i + '">+ ' + esc(x[0]) + "</button>"; }).join("") + '<button type="button" class="chip" data-act="pAddSec" data-id="-1">+ Seção em branco</button></div></div></div>';

    var inv = '<div class="panel ed-sec"><h3>Investimento</h3>' + p.items.map(function (it, i) {
      return '<div class="line-row"><textarea data-pbind="items.' + i + '.desc" placeholder="Descrição (primeira linha em negrito no PDF)">' + esc(it.desc) + '</textarea><input type="text" data-pbind="items.' + i + '.qty" value="' + esc(it.qty) + '" placeholder="Qtd"><input type="text" inputmode="decimal" data-pbind="items.' + i + '.price" data-price="1" value="' + esc(it.price) + '" placeholder="Preço $"><button class="btn ghost sm" data-act="pRmItem" data-id="' + i + '" aria-label="Remover item">✕</button></div>';
    }).join("") + '<div><button class="btn ghost sm" data-act="pAddItem">+ Item</button></div>' +
      inp("totalLabel", "Texto da linha de total") +
      '<div class="total-bar"><span>Total</span><span id="pTotal">' + money2(p.total) + "</span></div>" + ta("includes", "Inclui", 2) + "</div>";

    var pay = '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Cronograma de pagamento</h3><span id="pSum" class="small ' + (payTotal === 100 ? "v-good" : "v-bad") + '">Soma: ' + payTotal + "%</span></div>" +
      '<div class="chips">' + Object.keys(PAY).map(function (k) { return '<button type="button" class="chip" data-act="pPayPreset" data-id="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + "</div>" +
      ta("payment.note", "Observação (opcional, aparece acima da tabela)", 2) +
      (p.payment.rows || []).map(function (r, i) {
        return '<div class="pay-row"><input type="text" data-pbind="payment.rows.' + i + '.0" value="' + esc(r[0]) + '" placeholder="Etapa"><textarea data-pbind="payment.rows.' + i + '.1" placeholder="Quando">' + esc(r[1]) + '</textarea><input type="text" inputmode="numeric" data-pbind="payment.rows.' + i + '.2" value="' + esc(r[2]) + '" placeholder="%"><button class="btn ghost sm" data-act="pRmPay" data-id="' + i + '" aria-label="Remover etapa">✕</button></div>';
      }).join("") + '<div><button class="btn ghost sm" data-act="pAddPay">+ Etapa</button></div></div>';

    var terms = '<div class="panel ed-sec"><h3>Condições</h3>' + ta("notIncluded", "Não incluído", 4) + ta("clarifications", "Esclarecimentos", 4, "uma linha = um item") + ta("warranty", "Garantia e seguro", 3, "uma linha = um item") +
      '<details><summary class="small" style="cursor:pointer">Cabeçalho e rodapé do documento</summary><div class="stack" style="margin-top:10px">' + inp("header.tagline", "Linha abaixo do logo") + inp("header.contact", "Contato") + inp("header.footer", "Rodapé") + "</div></details></div>";

    return a + sec + inv + (isInv(p) ? "" : pay) + terms + materialsPanel(p);
  }

  // ── materiais da estimativa ──
  function estimate(p) {
    var rows = (p.materials || []).map(function (x, i) {
      var m = matById(x.materialId), q = num(x.qty) || 0;
      if (!m) return { i: i, name: x.name || "(material removido)", qty: q, missing: true };
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
    return '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Material da estimativa</h3><span class="muted small">só para você · não aparece no PDF</span></div>' +
      (S.materials.length ? '<div class="mat-row"><select id="pMatSel">' + opts + '</select><input type="number" id="pMatQty" min="0" step="any" placeholder="Qtd" inputmode="decimal"><button class="btn sm" data-act="pAddMat">Adicionar</button></div>'
        : '<div class="muted">Cadastre os materiais e preços na aba <a href="#" data-act="nav" data-id="prices">Preços</a> para montar a estimativa aqui.</div>') +
      (est.rows.length ? '<div class="table-wrap"><table><thead><tr><th>Material</th><th class="n">Qtd</th><th>Melhor loja</th><th class="n">Preço un.</th><th class="n">Subtotal</th><th></th></tr></thead><tbody>' +
        est.rows.map(function (r) {
          return "<tr><td>" + esc(r.name) + (r.unit ? ' <span class="muted small">' + esc(r.unit) + "</span>" : "") + '</td><td class="n">' + r.qty + "</td><td>" + (r.best ? '<span class="pill good">' + esc(storeName(r.best.store)) + "</span>" : '<span class="pill warn">sem preço</span>') + '</td><td class="n">' + (r.best ? money2(r.best.price) : "—") + '</td><td class="n"><b>' + (r.best ? money2(r.sub) : "—") + '</b></td><td class="n"><button class="btn ghost sm" data-act="pRmMat" data-id="' + r.i + '" aria-label="Remover">✕</button></td></tr>';
        }).join("") + "</tbody></table></div>" +
        '<div class="grid3 keep2"><div class="panel"><div class="label">Material (melhor preço por item)</div><div class="kpi-value">' + money(est.bestTotal) + '</div>' + (est.noPrice ? '<div class="kpi-sub v-bad">' + est.noPrice + " item(ns) sem preço</div>" : "") + '</div><div class="panel"><div class="label">Valor da proposta</div><div class="kpi-value v-info">' + money(p.total) + '</div></div><div class="panel"><div class="label">Sobra após material</div><div class="kpi-value ' + (margin >= 0 ? "v-good" : "v-bad") + '">' + money(margin) + '</div><div class="kpi-sub">' + E.fmtPct(E.pct(margin, p.total || 0)) + " do valor</div></div></div>" +
        '<div><span class="label">Comprando tudo numa loja só</span><div class="bars" style="margin-top:8px">' + est.byStore.map(function (b) {
          return '<div class="bar-row"><span>' + esc(b.s.short) + '</span><span class="small muted">' + (b.miss ? b.miss + " sem preço" : "todos os itens") + '</span><span class="n">' + (b.tot ? money(b.tot) : "—") + "</span></div>";
        }).join("") + "</div></div>" +
        (Object.keys(shop).length ? '<div><span class="label">Onde comprar cada item</span>' + Object.keys(shop).map(function (sid) {
          return '<div class="sec-card" style="margin-top:8px"><b>' + esc(storeName(sid)) + " · " + money2(shop[sid].reduce(function (a, r) { return a + r.sub; }, 0)) + '</b><div class="small">' + shop[sid].map(function (r) { return esc(r.qty + " × " + r.name); }).join(" · ") + "</div></div>";
        }).join("") + "</div>" : "")
        : "") + "</div>";
  }

  // ═══════════ documento (PDF) ═══════════
  function buildDoc(p) {
    var c = CO[p.companyId] || CO.eternity, hd = p.header || {}, A = c.accent, D = c.dark;
    var logoBig = c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.brand) + '" style="width:3.3in;max-width:100%;display:block;margin:0 auto">' : '<div style="font-size:40pt;font-weight:700;letter-spacing:.04em;color:' + D + '">' + esc(c.brand.toUpperCase()) + "</div>";
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
      (lines(p.warranty).length ? "<h2>Warranty &amp; Insurance</h2>" + lines(p.warranty).map(function (l) { return '<div class="b">' + rich(l) + "</div>"; }).join("") : "");
    var sig = '<div style="page-break-inside:avoid"><h2>Acceptance</h2><p style="text-align:justify">By signing below, the ' + esc(p.client.role || "Client") + " accepts the scope, pricing, and payment terms above as a binding agreement. This proposal is valid for " + esc(p.validityDays || 30) + " days from the date issued.</p>" +
      '<table style="width:100%;margin-top:18px"><tr><td style="width:50%;vertical-align:top;padding-right:20px"><b>' + esc(c.brand.toUpperCase()) + '</b><div style="font-style:italic">' + esc(c.role) + '</div><div style="margin-top:.55in;border-top:1px solid ' + D + ';width:3in;font-size:9pt;padding-top:3px">Signature</div><div style="margin-top:.3in">Date: ____________________</div></td>' +
      '<td style="vertical-align:top"><b>' + esc((p.client.name || "CLIENT").toUpperCase()) + '</b><div style="font-style:italic">' + esc(p.client.role || "") + '</div><div style="margin-top:.55in;border-top:1px solid ' + D + ';width:3in;font-size:9pt;padding-top:3px">Signature</div><div style="margin-top:.3in">Date: ____________________</div></td></tr></table></div>';
    return frame(cover + scope + inv + pay + terms + sig);
  }
  function printDoc(p) {
    var root = $("#print-root");
    if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
    root.innerHTML = buildDoc(p);
    document.body.style.background = (CO[p.companyId] || CO.eternity).bg;
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
  AC.pNew = function (el) {
    var p = blankProposal();
    if (el && el.dataset.id === "invoice") { p.docType = "invoice"; p.number = nextNumber("invoice"); p.title = "INVOICE"; }
    S.pdraft = p; S.pSpeech = ""; S.pAdv = false; E.go("proposalForm");
  };
  AC.pOpen = function (el) { var p = S.proposals.find(function (x) { return x.id === el.dataset.id; }); S.pdraft = Object.assign(blankProposal(), clone(p)); S.pSpeech = ""; S.pAdv = false; E.go("proposalForm"); };
  AC.pGenIntro = function () { S.pdraft.intro = introText(S.pdraft); E.render(); };
  AC.pAddSec = function (el) { var i = Number(el.dataset.id), tr = E.tradeOf(S.pdraft.companyId) === "hvac" ? "hvac" : "electrical"; S.pdraft.sections.push(i < 0 ? { title: "New Section", text: "" } : { title: SECTIONS[tr][i][0], text: SECTIONS[tr][i][1] }); E.render(); };
  AC.pRmSec = function (el) { S.pdraft.sections.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pMoveSec = function (el) { var i = Number(el.dataset.id), j = i + Number(el.dataset.dir), a = S.pdraft.sections; if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; E.render(); };
  AC.pAddItem = function () { S.pdraft.items.push({ desc: "", qty: "1", price: "" }); E.render(); };
  AC.pRmItem = function (el) { S.pdraft.items.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pPayPreset = function (el) { S.pdraft.payment.rows = clone(PAY[el.dataset.id]); if (/Bank/.test(el.dataset.id)) S.pdraft.payment.note = "**Bank-financed project — performance-based draws.** This project is financed by the Owner's lender. A performance affidavit and supporting documentation will be issued to the bank at each milestone below."; E.render(); };
  AC.pAddPay = function () { S.pdraft.payment.rows.push(["", "", 0]); E.render(); };
  AC.pRmPay = function (el) { S.pdraft.payment.rows.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pAddMat = function () { var id = $("#pMatSel").value, q = num($("#pMatQty").value); if (!id || !q) { E.toast("Escolha o material e a quantidade."); return; } var m = matById(id); S.pdraft.materials.push({ materialId: id, name: m.name, qty: q }); E.render(); };
  AC.pRmMat = function (el) { S.pdraft.materials.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pPrint = function () { printDoc(S.pdraft); };
  AC.pSave = function () {
    var p = S.pdraft; p.total = totalOf(p);
    if (!p.client.name && !p.client.address) { E.toast("Preencha o cliente ou o endereço da obra."); return; }
    E.toast("Salvando…");
    API.saveProposal(p).then(function (saved) { S.pdraft = Object.assign(blankProposal(), saved); return reloadExt(); }).then(function () { E.toast("Proposta salva."); }).catch(function (e) { E.toast(e.message || "Erro ao salvar."); });
  };
  AC.pDup = function () { var c = clone(S.pdraft); c.id = null; c.number = nextNumber(c.docType); c.notes = []; c.status = "Rascunho"; c.date = today(); S.pdraft = c; E.render(); E.toast("Cópia criada. Salve para guardar."); window.scrollTo(0, 0); };
  AC.pAskDel = function () { S.modal = { type: "confirm", title: "Apagar proposta", text: "Apagar a proposta " + (S.pdraft.number || "") + "? Isso não pode ser desfeito.", act: "pDel", id: S.pdraft.id, okLabel: "Apagar" }; E.render(); };
  AC.pDel = function (el) { API.deleteProposal(el.dataset.id).then(function () { S.modal = null; S.pdraft = null; return reloadExt(); }).then(function () { E.go("proposals"); E.toast("Proposta apagada."); }); };
  AC.pToProject = function () {
    var p = S.pdraft, d = E.blankProject();
    d.companyId = p.companyId; d.name = p.client.address || p.number; d.client = p.client.name; d.address = p.client.address;
    d.scope = (p.number ? "Proposta " + p.number + "\n\n" : "") + p.sections.map(function (s) { return s.title.toUpperCase() + "\n" + lines(s.text).map(function (l) { return "• " + l.replace(/\*\*/g, ""); }).join("\n"); }).join("\n\n") + (p.notIncluded ? "\n\nNÃO INCLUÍDO\n" + p.notIncluded.replace(/\*\*/g, "") : "");
    d.fin.contractValue = totalOf(p) || "";
    S.draft = d; S.draftFiles = []; S.wizStep = 0; E.go("projectForm"); E.toast("Projeto preenchido com os dados da proposta. Confira e salve.");
  };

  EXT.input.push(function (el) {
    if (!el.dataset.pbind || !S.pdraft) return false;
    set(S.pdraft, el.dataset.pbind, el.value);
    schedulePreview();
    if (el.dataset.price) { var t = $("#pTotal"); if (t) t.textContent = money2(totalOf(S.pdraft)); }
    if (/^payment\.rows\.\d+\.2$/.test(el.dataset.pbind)) { var sm = $("#pSum"), tot = (S.pdraft.payment.rows || []).reduce(function (a, r) { return a + num(r[2]); }, 0); if (sm) { sm.textContent = "Soma: " + tot + "%"; sm.className = "small " + (tot === 100 ? "v-good" : "v-bad"); } }
    return true;
  });
  EXT.change.push(function (el) {
    if (el.dataset.pbind && S.pdraft) { set(S.pdraft, el.dataset.pbind, el.value); if (el.tagName === "SELECT") E.render(); return true; }
    if (el.dataset.pf) { S.priceFilter[el.dataset.pf] = el.value; E.render(); return true; }
    return false;
  });

  // ═══════════ tela simples: cliente + tipo + voz ═══════════
  var ROLES = ["Homeowner", "General Contractor", "Developer", "Property Manager", "Owner"];
  var MIC_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function built(p) { return p.sections.length > 0 || p.items.some(function (it) { return it.desc || it.price; }); }

  EXT.views.proposalForm = function () {
    var p = S.pdraft; if (!p) return '<div class="panel empty">Nenhuma proposta aberta.</div>';
    p.total = totalOf(p);
    var inv = isInv(p), ok = built(p), busy = S.pBusy;
    var head = '<div class="page-head"><div><button class="btn ghost sm" data-act="nav" data-id="proposals" style="margin-bottom:10px">← Propostas</button><h1>' +
      (p.id ? (inv ? "Invoice " : "Proposta ") + esc(p.number) : inv ? "Novo invoice" : "Nova proposta") + "</h1><p>" + esc(E.companyName(p.companyId)) + " · sai em inglês, no padrão das suas propostas</p></div>" +
      '<div class="row"><select data-pbind="status" style="width:auto" aria-label="Status">' + Object.keys(STATUS_P).map(function (s) { return "<option" + (p.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div></div>";

    var type = '<div class="seg" role="group" aria-label="Tipo de documento">' +
      '<button type="button" class="' + (inv ? "" : "on") + '" data-act="pType" data-id="estimate"><b>Estimate</b><span>proposta para o cliente aprovar</span></button>' +
      '<button type="button" class="' + (inv ? "on" : "") + '" data-act="pType" data-id="invoice"><b>Invoice</b><span>cobrança do serviço feito</span></button></div>';

    var cli = '<div class="panel ed-sec"><h3>Cliente</h3><div class="grid2">' + inp("client.name", inv ? "Cobrar de (cliente / GC)" : "Preparado para (cliente / GC)") +
      '<label class="field"><span>Tipo de cliente</span><input type="text" list="pRoles" data-pbind="client.role" value="' + esc(p.client.role || "") + '"></label></div>' +
      '<datalist id="pRoles">' + ROLES.map(function (r) { return '<option value="' + r + '">'; }).join("") + "</datalist>" +
      inp("client.address", "Endereço da obra") + "</div>";

    var ex = E.tradeOf(p.companyId) === "hvac"
      ? "Ex.: “Trocar o sistema antigo por uma heat pump Viessmann de 36 mil BTU, duas zonas, dois termostatos, linha nova. Preço 14.500, metade na entrada.”"
      : inv ? "Ex.: “Invoice da troca do painel para 200 amp e 6 tomadas GFCI na cozinha. Total 6.800, ele já pagou 3.400.”"
        : "Ex.: “Casa de dois andares. Trocar o serviço para 200 amp, 12 recessed na sala e cozinha, GFCI na cozinha e banheiros, detectores de fumaça interligados. Paredes abertas, Romex. Preço 9.500, 30/40/30.”";
    var voice = '<div class="panel ed-sec"><h3>' + (ok ? "Quer mudar alguma coisa? Fale aqui" : "Fale o serviço") + "</h3>" +
      '<div class="voice"><button type="button" class="mic' + (S.pRec ? " on" : "") + '" data-act="pMic" aria-label="Gravar voz" aria-pressed="' + (S.pRec ? "true" : "false") + '">' + MIC_SVG + "</button>" +
      '<div><b id="micState">' + micLabel() + '</b><div class="small muted" style="margin-top:4px">' + esc(ok ? "Ex.: “Tira o permit, muda o preço para 9 mil e acrescenta 4 tomadas no porão.”" : ex) + "</div></div></div>" +
      '<textarea id="pSpeech" rows="5" placeholder="O que você falar aparece aqui. Também dá para digitar ou usar o microfone do teclado.">' + esc(S.pSpeech || "") + "</textarea>" +
      '<div class="row">' + (busy ? '<button class="btn" disabled><span class="spin" aria-hidden="true"></span> Montando… leva uns 30 segundos</button>'
        : ok ? '<button class="btn" data-act="pAI" data-id="adjust">✨ Ajustar ' + (inv ? "o invoice" : "a proposta") + '</button><button class="btn ghost" data-act="pAI" data-id="new">Montar do zero com esse texto</button>'
          : '<button class="btn" data-act="pAI" data-id="new">✨ Montar ' + (inv ? "invoice" : "proposta") + "</button>") +
      '<label class="small muted" style="margin-left:auto">Idioma da fala <select id="pLang" style="width:auto;padding:4px 8px"><option value="pt-BR"' + (S.pLang !== "en-US" ? " selected" : "") + '>Português</option><option value="en-US"' + (S.pLang === "en-US" ? " selected" : "") + ">English</option></select></label></div></div>";

    var notes = (p.notes || []).length ? '<div class="panel ed-sec note-box"><h3>Confira antes de mandar</h3>' + p.notes.map(function (n) { return '<div class="small">• ' + esc(n) + "</div>"; }).join("") + "</div>" : "";
    var paid = inv ? num(p.amountPaid) : 0;
    var prev = ok ? '<div class="panel ed-sec"><div class="spread"><h3 style="margin:0">Prévia do documento</h3><span class="kpi-value" style="font-size:22px">' + money2(p.total - paid) + (inv && paid ? ' <span class="small muted">a receber</span>' : "") + "</span></div>" +
      (p.total ? "" : '<div class="pill warn">Sem preço — fale o valor ou ajuste em “Editar tudo”.</div>') +
      '<div id="pPrev" class="doc-box"></div></div>' : "";

    var adv = '<div><button type="button" class="btn ghost sm" data-act="pAdv">' + (S.pAdv ? "Fechar edição completa ▲" : "Editar tudo (avançado) ▼") + "</button></div>" + (S.pAdv ? fullEditor(p) : "");

    setTimeout(mountPreview, 0);
    return head + type + cli + voice + notes + prev + adv +
      '<div class="sticky-actions">' + (p.id ? '<button class="btn danger" data-act="pAskDel">Apagar</button><button class="btn ghost" data-act="pDup">Duplicar</button>' : "") +
      (p.id && !inv ? '<button class="btn ghost" data-act="pToInvoice">Gerar invoice</button><button class="btn ghost" data-act="pToProject">Virar projeto</button>' : "") +
      '<button class="btn ghost" data-act="pPrint">Ver PDF / Imprimir</button><button class="btn" data-act="pSave">Salvar</button></div>';
  };

  // ── prévia (mesmo HTML do PDF, dentro de um quadro) ──
  var prevTimer = null;
  function schedulePreview() { clearTimeout(prevTimer); prevTimer = setTimeout(mountPreview, 500); }
  function mountPreview() {
    var box = $("#pPrev"); if (!box || !S.pdraft) return;
    var c = CO[S.pdraft.companyId] || CO.eternity;
    var html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + location.href.split("#")[0] + '"><style>html,body{margin:0;background:' + c.bg + "}body{padding:.45in .6in}#print-root .cover{min-height:auto}</style></head><body><div id=\"print-root\">" + buildDoc(S.pdraft) + "</div></body></html>";
    var f = box.querySelector("iframe"), inner = box.querySelector(".doc-inner");
    if (!f) { inner = document.createElement("div"); inner.className = "doc-inner"; f = document.createElement("iframe"); f.title = "Prévia do documento"; f.setAttribute("tabindex", "-1"); inner.appendChild(f); box.appendChild(inner); }
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
  function micLabel() { return S.pRec ? "Gravando… fale à vontade. Toque de novo para parar." : "Toque no microfone e fale o que tem que ser feito"; }
  function micUI() {
    var b = document.querySelector(".mic"), t = $("#micState");
    if (b) { b.classList.toggle("on", !!S.pRec); b.setAttribute("aria-pressed", S.pRec ? "true" : "false"); }
    if (t) t.textContent = micLabel();
  }
  function micStop() { S.pRec = false; if (rec) { try { rec.stop(); } catch (e) { } } rec = null; micUI(); }
  function micStart() {
    var box = $("#pSpeech");
    if (!SR) { E.toast("Este aparelho não grava direto no app. Toque na caixa de texto e use o microfone do teclado."); if (box) box.focus(); return; }
    var android = /Android/i.test(navigator.userAgent);
    var base = (box ? box.value : S.pSpeech || "").replace(/\s*$/, ""); if (base) base += " ";
    var r = new SR(); rec = r;
    r.lang = S.pLang || "pt-BR"; r.interimResults = true; r.continuous = !android; // Android repete frases no modo contínuo
    r.onresult = function (ev) {
      var fin = "", tmp = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) { var x = ev.results[i]; if (x.isFinal) fin += x[0].transcript; else tmp += x[0].transcript; }
      if (fin) base += fin.trim() + " ";
      S.pSpeech = base; var t = $("#pSpeech"); if (t) { t.value = base + tmp; t.scrollTop = t.scrollHeight; }
    };
    r.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { micStop(); E.toast("Libere o microfone para o app nas configurações do celular (ou use o microfone do teclado)."); }
      else if (e.error === "network") { micStop(); E.toast("Sem internet para reconhecer a voz. Use o microfone do teclado."); }
    };
    r.onend = function () { if (S.pRec && rec === r) { setTimeout(function () { if (S.pRec && rec === r) { try { r.start(); } catch (e) { micStop(); } } }, 120); } };
    try { r.start(); S.pRec = true; } catch (e) { S.pRec = false; E.toast("Não consegui abrir o microfone."); }
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
    p.title = isInv(p) ? "INVOICE" : (CO[p.companyId] || CO.eternity).title;
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
    p.total = totalOf(p);
  }

  // versão simples sem IA (quando a IA não está ligada): escolhe as seções padrão pelas palavras faladas
  var KW = {
    electrical: [/servi[cç]o|service|\b(100|150|200|400)\s?(a|amp)|painel|panel|meter|medidor/i, /rough|fia[cç][aã]o|wiring|r[oô]mex|\bmc\b|rewire|refazer a fia/i, /tomada|outlet|receptacle|interruptor|switch|recess|luz|luzes|light|dimmer|fixture|ilumina/i, /cozinha|kitchen|banheiro|bath/i, /smoke|fuma[cç]a|detector/i, /hvac|condens|heat ?pump|mini.?split|ar.condicionado|air handler/i, /fire alarm|alarme de inc[eê]ndio/i, /low voltage|baixa tens[aã]o|\bdata\b|internet|\btv\b|cat ?6/i, /exterior|externa|lado de fora|garage|garagem|outside/i, /./],
    hvac: [/remov|tirar|velh|antig|existing|old/i, /./, /duto|duct|sheet ?metal/i, /line ?set|linha|refrigerant|condensa/i, /termostato|thermostat|zona|zone/i, /furnace|fornalha|g[aá]s|boiler|caldeira/i, /./, /mass ?save|rebate/i, /./]
  };
  function priceFrom(t) {
    var best = 0, m, re = /\$\s?([\d.,]+)|\b(\d{1,3}(?:[.,]\d{3})+)\b|\b(\d+(?:[.,]\d+)?)\s?mil\b|\b(\d{4,6})\b/gi;
    while ((m = re.exec(t))) {
      var v = m[1] || m[2] ? Number(String(m[1] || m[2]).replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")) : m[3] ? Number(m[3].replace(",", ".")) * 1000 : Number(m[4]);
      if (v >= 300 && v < 5e6 && v > best) best = v;
    }
    return best;
  }
  function localBuild(p, speech) {
    var tr = E.tradeOf(p.companyId) === "hvac" ? "hvac" : "electrical", price = priceFrom(speech);
    p.sections = SECTIONS[tr].filter(function (x, i) { return KW[tr][i].test(speech); }).map(function (x) { return { title: x[0], text: x[1] }; });
    p.title = isInv(p) ? "INVOICE" : (CO[p.companyId] || CO.eternity).title;
    p.intro = isInv(p) ? "Invoice for " + (tr === "hvac" ? "HVAC" : "electrical") + " work completed at " + (p.client.address || "the project location") + "." : introText(p);
    if (isInv(p)) p.sections = [];
    p.items = [{ desc: (tr === "hvac" ? "HVAC Scope" : "Electrical Scope") + (isInv(p) ? " — Work Completed" : " — Complete") + "\nLabor, material and permit per the scope above.", qty: "1 lot", price: price ? String(price) : "" }];
    p.payment.rows = clone(PAY[price && price < 8000 ? "50/50" : "30/40/30"]);
    p.notes = ["Montado sem IA: escolhi as seções padrão pelas palavras faladas. Revise o texto em “Editar tudo”."].concat(price ? [] : ["Não achei o preço na fala."]);
    p.speech = speech; p.total = totalOf(p);
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
  AC.pMic = function () { if (S.pRec) micStop(); else micStart(); };
  AC.pAdv = function () { S.pAdv = !S.pAdv; E.render(); };
  AC.pTypeFilter = function (el) { S.pTypeFilter = el.dataset.id; E.render(); };
  AC.pType = function (el) {
    var p = S.pdraft, t = el.dataset.id; if ((p.docType || "estimate") === t) return;
    p.docType = t; p.title = t === "invoice" ? "INVOICE" : (CO[p.companyId] || CO.eternity).title;
    if (!(t === "invoice" ? /^INV/i : /^EST/i).test(p.number || "")) p.number = nextNumber(t);
    if (t === "invoice" && p.status === "Aceita") p.status = "Rascunho";
    E.render();
  };
  AC.pToInvoice = function () {
    var c = clone(S.pdraft); c.ref = c.number; c.id = null; c.docType = "invoice"; c.number = nextNumber("invoice"); c.title = "INVOICE"; c.status = "Rascunho"; c.date = today(); c.amountPaid = ""; c.notes = []; c.dueTerms = c.dueTerms || "Due upon receipt";
    S.pdraft = c; S.pSpeech = ""; E.render(); window.scrollTo(0, 0); E.toast("Invoice criado a partir da proposta. Fale o que mudou (ex.: quanto já foi pago) e salve.");
  };
  AC.pAI = function (el) {
    var mode = el.dataset.id, p = S.pdraft, t = $("#pSpeech"), speech = String((t ? t.value : S.pSpeech) || "").trim();
    if (!speech) { E.toast("Fale ou escreva primeiro o que tem que ser feito."); return; }
    micStop(); S.pSpeech = speech; S.pBusy = true; E.render();
    API.aiProposal({ company: p.companyId, docType: p.docType || "estimate", speech: speech, client: p.client, today: today(), current: mode === "adjust" ? compact(p) : null })
      .then(function (res) {
        if (res && res.ok) { applyAI(p, res.result, mode, speech); S.pSpeech = ""; return { ok: true }; }
        var why = { NO_KEY: "A IA ainda não foi ligada (falta a chave da Anthropic no Supabase).", NOT_DEPLOYED: "A IA ainda não foi instalada no Supabase.", DEMO: "Modo demonstração, sem IA.", FORBIDDEN: "Só administradores podem montar propostas.", OFFLINE: "Sem conexão com a IA agora.", EMPTY: "Nada para montar." }[res && res.error] || ("A IA não respondeu" + (res && res.detail ? ": " + res.detail : "") + ".");
        if (mode === "new" && res && res.error !== "FORBIDDEN") { localBuild(p, speech); S.pSpeech = ""; return { ok: true, msg: why + " Montei uma versão simples pelas palavras faladas." }; }
        return { ok: false, msg: why };
      })
      .catch(function (e) { return { ok: false, msg: (e && e.message) || "Erro ao montar." }; })
      .then(function (r) {
        S.pBusy = false; E.render();
        if (!r.ok) { E.toast(r.msg); return; }
        if (p.client.name || p.client.address) autoSave(r.msg); else E.toast(r.msg || "Pronto! Preencha o cliente e salve.");
        var pv = $("#pPrev"); if (pv) pv.scrollIntoView({ behavior: "smooth", block: "start" });
      });
  };
  function autoSave(msg) {
    var p = S.pdraft; p.total = totalOf(p);
    API.saveProposal(p).then(function (saved) { if (S.pdraft === p) { p.id = saved.id; } return reloadExt(); })
      .then(function () { E.toast(msg || (isInv(p) ? "Invoice pronto e salvo." : "Proposta pronta e salva. Confira a prévia.")); })
      .catch(function () { E.toast((msg ? msg + " " : "") + "Pronto, mas não salvou — toque em Salvar."); });
  }
  EXT.input.push(function (el) { if (el.id !== "pSpeech") return false; S.pSpeech = el.value; return true; });
  EXT.change.push(function (el) { if (el.id !== "pLang") return false; S.pLang = el.value; if (S.pRec) { micStop(); micStart(); } return true; });


  // ═══════════ PREÇOS ═══════════
  var BASIC = {
    electrical: [
      ["Romex NM-B 14/2 — 250 ft", "Fio e cabo", "rolo"], ["Romex NM-B 12/2 — 250 ft", "Fio e cabo", "rolo"], ["Romex NM-B 14/3 — 250 ft", "Fio e cabo", "rolo"], ["Romex NM-B 12/3 — 250 ft", "Fio e cabo", "rolo"],
      ["Romex NM-B 10/3 — 125 ft", "Fio e cabo", "rolo"], ["MC 12/2 — 250 ft", "Fio e cabo", "rolo"], ["THHN 12 AWG — 500 ft", "Fio e cabo", "rolo"],
      ["EMT 1/2\" — 10 ft", "Conduíte", "peça"], ["EMT 3/4\" — 10 ft", "Conduíte", "peça"],
      ["Caixa 1 gang new work", "Caixas", "un"], ["Caixa 2 gang new work", "Caixas", "un"], ["Caixa octogonal / ventilador", "Caixas", "un"],
      ["Tomada TR 15A (decorator)", "Dispositivos", "un"], ["Tomada TR 20A (decorator)", "Dispositivos", "un"], ["Tomada GFCI 20A TR/WR", "Dispositivos", "un"], ["Interruptor single-pole decorator", "Dispositivos", "un"], ["Interruptor 3-way decorator", "Dispositivos", "un"], ["Dimmer LED", "Dispositivos", "un"],
      ["Disjuntor 15A AFCI/GFCI (dual function)", "Painel e disjuntores", "un"], ["Disjuntor 20A AFCI/GFCI (dual function)", "Painel e disjuntores", "un"], ["Painel 200A main breaker 40 espaços", "Painel e disjuntores", "un"], ["Meter socket 200A", "Painel e disjuntores", "un"],
      ["Haste de aterramento 5/8\" x 8 ft", "Aterramento", "un"], ["Recessed LED 6\" wafer", "Iluminação", "un"], ["Recessed LED 4\" wafer", "Iluminação", "un"], ["Detector fumaça/CO combinado hardwired", "Segurança", "un"],
      ["Wire nuts (caixa)", "Consumíveis", "caixa"], ["Grampos Romex (caixa)", "Consumíveis", "caixa"]
    ],
    hvac: [
      ["Line set 1/4\" x 3/8\" — 50 ft", "Tubulação", "un"], ["Line set 3/8\" x 3/4\" — 50 ft", "Tubulação", "un"], ["Bomba de condensado", "Dreno", "un"], ["Fio de termostato 18/5 — 250 ft", "Controles", "rolo"],
      ["Disconnect 60A non-fused", "Elétrica HVAC", "un"], ["Whip 3/4\" x 6 ft", "Elétrica HVAC", "un"], ["Pad de condensadora", "Equipamento", "un"], ["Suporte de parede mini-split", "Equipamento", "un"],
      ["Line hide kit", "Acabamento", "un"], ["Termostato Wi-Fi", "Controles", "un"], ["Fita aluminizada / mastic", "Dutos", "un"], ["Duto flexível 6\" isolado — 25 ft", "Dutos", "un"]
    ]
  };
  EXT.views.prices = function () {
    var f = S.priceFilter, cats = {};
    S.materials.forEach(function (m) { if (m.category) cats[m.category] = 1; });
    var list = S.materials.filter(function (m) { return (!f.cat || m.category === f.cat) && (!f.q || m.name.toLowerCase().indexOf(f.q.toLowerCase()) >= 0); })
      .sort(function (a, b) { return (a.category || "") + a.name < (b.category || "") + b.name ? -1 : 1; });
    var td = today();
    var deals = S.deals.slice().sort(function (a, b) { return (a.validUntil || "9999") < (b.validUntil || "9999") ? -1 : 1; });
    var dealsHtml = '<div class="panel"><div class="spread" style="margin-bottom:10px"><h3 style="margin:0">Ofertas e promoções</h3><button class="btn ghost sm" data-act="prNewDeal">+ Oferta</button></div>' +
      (deals.length ? '<div class="stack" style="gap:8px">' + deals.map(function (d) {
        var expired = d.validUntil && d.validUntil < td;
        return '<div class="deal" style="' + (expired ? "opacity:.5" : "") + '"><div style="min-width:0"><span class="store-chip">' + esc(storeName(d.store)) + "</span> · <b>" + esc(d.title) + "</b>" + (d.price != null ? " · " + money2(d.price) : "") +
          '<div class="small muted">' + (d.validUntil ? (expired ? "Venceu em " : "Até ") + E.fmtDate(d.validUntil) : "Sem validade") + (d.note ? " · " + esc(d.note) : "") + (d.url ? ' · <a href="' + esc(d.url) + '" target="_blank" rel="noopener">abrir</a>' : "") + '</div></div><button class="btn ghost sm" data-act="prDelDeal" data-id="' + d.id + '" aria-label="Apagar oferta">✕</button></div>';
      }).join("") + "</div>" : '<div class="muted small">Quando chegar uma promoção das lojas (e-mail, folheto, balcão), registre aqui para não perder.</div>') + "</div>";
    var table = list.length ? '<div class="table-wrap"><table><thead><tr><th>Material</th>' + STORES.map(function (s) { return '<th class="n">' + esc(s.short) + "</th>"; }).join("") + '<th class="n">Melhor</th></tr></thead><tbody>' +
      list.map(function (m) {
        var b = best(m);
        return '<tr><td><a href="#" data-act="prMat" data-id="' + m.id + '"><b>' + esc(m.name) + '</b></a><div class="small muted">' + esc([m.category, m.unit].filter(Boolean).join(" · ")) + "</div></td>" +
          STORES.map(function (s) {
            var l = latest(m, s.id), cls = !l ? "empty" : (b && l.id === b.id ? "best" : "") + (daysAgo(l.date) > 30 ? " stale" : "");
            return '<td class="n price-cell ' + cls + '" data-act="prPrice" data-id="' + m.id + '" data-store="' + s.id + '">' + (l ? money2(l.price) + '<span class="d">' + E.fmtDate(l.date) + "</span>" : "+") + "</td>";
          }).join("") + '<td class="n">' + (b ? '<b class="v-good">' + money2(b.price) + '</b><span class="d small muted" style="display:block">' + esc(storeName(b.store)) + "</span>" : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>"
      : '<div class="panel empty">' + (S.materials.length ? "Nenhum material com esse filtro." : 'Nenhum material cadastrado. <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-act="prBasic" data-id="electrical">Adicionar lista básica elétrica</button><button class="btn ghost" data-act="prBasic" data-id="hvac">Lista básica HVAC</button></div>') + "</div>";
    return '<div class="page-head"><div><h1>Preços de material</h1><p>Compare The Home Depot, Independent, Northeast, Granite City e Standard. Verde = mais barato · apagado = preço com mais de 30 dias.</p></div><button class="btn" data-act="prNewMat">+ Material</button></div>' +
      dealsHtml +
      '<div class="filters" style="margin-top:14px"><label class="field"><span>Buscar</span><input type="search" data-pf="q" value="' + esc(f.q) + '" placeholder="ex.: Romex, GFCI, line set"></label><label class="field"><span>Categoria</span><select data-pf="cat"><option value="">Todas</option>' +
      Object.keys(cats).sort().map(function (c) { return "<option" + (f.cat === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></label></div>" + table +
      '<p class="muted small" style="margin-top:12px">Toque num preço para atualizar. As lojas de material elétrico mostram preço só para clientes com conta; use o preço da sua cotação ou nota fiscal.</p>';
  };

  AC.prBasic = function (el) {
    var have = {}; S.materials.forEach(function (m) { have[m.name] = 1; });
    var list = BASIC[el.dataset.id].filter(function (x) { return !have[x[0]]; }).map(function (x) { return { name: x[0], category: x[1], unit: x[2] }; });
    E.toast("Adicionando " + list.length + " materiais…");
    API.saveMaterials(list).then(reloadExt).then(function () { E.toast("Lista adicionada. Agora é só preencher os preços."); }).catch(function (e) { E.toast(e.message); });
  };
  AC.prNewMat = function () { S.modal = { type: "material", title: "Novo material" }; E.render(); };
  AC.prMat = function (el) { S.modal = { type: "material", title: "Material", id: el.dataset.id }; E.render(); };
  AC.prPrice = function (el) { S.modal = { type: "price", title: "Atualizar preço", id: el.dataset.id, store: el.dataset.store }; E.render(); };
  AC.prNewDeal = function () { S.modal = { type: "deal", title: "Nova oferta" }; E.render(); };
  AC.prDelDeal = function (el) { API.deleteDeal(el.dataset.id).then(reloadExt); };
  AC.prDelPrice = function (el) { API.deletePrice(S.modal.id, el.dataset.id).then(reloadExt).then(function () { E.render(); }); };
  AC.prAskDelMat = function (el) { S.modal = { type: "confirm", title: "Apagar material", text: "Apagar este material e todo o histórico de preços dele?", act: "prDelMat", id: el.dataset.id, okLabel: "Apagar" }; E.render(); };
  AC.prDelMat = function (el) { API.deleteMaterial(el.dataset.id).then(function () { S.modal = null; return reloadExt(); }); };

  EXT.modals = {
    material: function (m) {
      var x = m.id ? matById(m.id) : { name: "", category: "", unit: "" };
      return '<form id="matForm" class="stack"><label class="field"><span>Nome do material</span><input type="text" id="mName" value="' + esc(x.name) + '" required placeholder="ex.: Romex NM-B 12/2 — 250 ft"></label>' +
        '<div class="grid2"><label class="field"><span>Categoria</span><input type="text" id="mCat" value="' + esc(x.category || "") + '" list="mCats"></label><label class="field"><span>Unidade</span><input type="text" id="mUnit" value="' + esc(x.unit || "") + '" placeholder="rolo, un, caixa, peça"></label></div>' +
        '<datalist id="mCats">' + Array.from(new Set(S.materials.map(function (q) { return q.category; }).filter(Boolean))).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
        (m.id ? '<div><span class="label">Pesquisar nas lojas</span><div class="chips" style="margin-top:6px">' + STORES.map(function (s) { return '<a class="chip" href="' + esc(s.url(x.name)) + '" target="_blank" rel="noopener">' + esc(s.short) + " ↗</a>"; }).join("") + "</div></div>" : "") +
        '<div class="row" style="justify-content:space-between">' + (m.id ? '<button type="button" class="btn danger sm" data-act="prAskDelMat" data-id="' + m.id + '">Apagar material</button>' : "<span></span>") + '<button class="btn" type="submit">Salvar</button></div></form>';
    },
    price: function (m) {
      var x = matById(m.id), st = STORES.find(function (s) { return s.id === m.store; });
      var hist = (x.prices || []).filter(function (p) { return p.store === m.store; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      return '<form id="priceForm" class="stack"><div><b>' + esc(x.name) + '</b><div class="muted small">' + esc(st.name) + (x.unit ? " · por " + esc(x.unit) : "") + "</div></div>" +
        '<div class="grid2"><label class="field"><span>Preço $</span><input type="number" id="prVal" step="0.01" min="0" inputmode="decimal" required autofocus></label><label class="field"><span>Data</span><input type="date" id="prDate" value="' + today() + '" required></label></div>' +
        '<label class="field"><span>Observação</span><input type="text" id="prNote" placeholder="ex.: cotação #1234, promoção, nota fiscal"></label>' +
        '<div class="row" style="justify-content:space-between"><a href="' + esc(st.url(x.name)) + '" target="_blank" rel="noopener" class="small">Pesquisar no site da ' + esc(st.short) + " ↗</a><button class=\"btn\" type=\"submit\">Salvar preço</button></div>" +
        (hist.length ? '<div><span class="label">Histórico</span><div class="table-wrap" style="margin-top:6px"><table><tbody>' + hist.map(function (h) { return "<tr><td>" + E.fmtDate(h.date) + '</td><td class="n"><b>' + money2(h.price) + '</b></td><td class="small muted">' + esc(h.note || "") + '</td><td class="n"><button type="button" class="btn ghost sm" data-act="prDelPrice" data-id="' + h.id + '" aria-label="Apagar">✕</button></td></tr>'; }).join("") + "</tbody></table></div></div>" : "") + "</form>";
    },
    deal: function () {
      return '<form id="dealForm" class="stack"><div class="grid2"><label class="field"><span>Loja</span><select id="dStore">' + STORES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("") + '</select></label><label class="field"><span>Válida até</span><input type="date" id="dUntil"></label></div>' +
        '<label class="field"><span>Oferta</span><input type="text" id="dTitle" required placeholder="ex.: Romex 12/2 250 ft — 15% off"></label>' +
        '<div class="grid2"><label class="field"><span>Preço $ (opcional)</span><input type="number" id="dPrice" step="0.01" min="0" inputmode="decimal"></label><label class="field"><span>Link (opcional)</span><input type="text" id="dUrl" placeholder="https://"></label></div>' +
        '<label class="field"><span>Observação</span><input type="text" id="dNote"></label><button class="btn" type="submit">Salvar oferta</button></form>';
    }
  };
  EXT.submit.matForm = function () {
    var m = { id: S.modal.id || null, name: $("#mName").value.trim(), category: $("#mCat").value.trim(), unit: $("#mUnit").value.trim() };
    if (!m.name) return;
    if (m.id) m.prices = (matById(m.id) || {}).prices;
    API.saveMaterial(m).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast("Material salvo."); }).catch(function (e) { E.toast(e.message); });
  };
  EXT.submit.priceForm = function () {
    var v = num($("#prVal").value); if (!(v > 0)) { E.toast("Informe o preço."); return; }
    API.addPrice({ materialId: S.modal.id, store: S.modal.store, price: v, date: $("#prDate").value, note: $("#prNote").value }).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast("Preço salvo."); }).catch(function (e) { E.toast(e.message); });
  };
  EXT.submit.dealForm = function () {
    var d = { store: $("#dStore").value, title: $("#dTitle").value.trim(), price: $("#dPrice").value, validUntil: $("#dUntil").value, url: $("#dUrl").value.trim(), note: $("#dNote").value.trim() };
    if (!d.title) return;
    API.saveDeal(d).then(function () { S.modal = null; return reloadExt(); }).then(function () { E.toast("Oferta salva."); }).catch(function (e) { E.toast(e.message); });
  };

  window.EE.buildProposalDoc = buildDoc; // usado nos testes
})();
