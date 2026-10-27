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
  var HD = { id: "homedepot", name: "The Home Depot", short: "Home Depot", url: function (q) { return "https://www.homedepot.com/s/" + encodeURIComponent(q); } };
  var STORES = [
    HD,
    { id: "ies", name: "Independent Electric Supply", short: "Independent", url: function (q) { return g("site:iesbuy.com " + q); } },
    { id: "northeast", name: "Northeast Electrical", short: "Northeast", url: function (q) { return g("site:needco.com " + q); } },
    { id: "granite", name: "Granite City Electric", short: "Granite City", url: function (q) { return g("site:granitecityelectric.com " + q); } },
    { id: "standard", name: "Standard Electric", short: "Standard", url: function (q) { return g("Standard Electric Supply " + q); } }
  ];
  var STORES_EL = STORES; // elétrica e HVAC: as lojas de sempre
  var LOWES = { id: "lowes", name: "Lowe's", short: "Lowe's", url: function (q) { return g("site:lowes.com " + q); } };
  var STORE_SETS = {
    plumbing: [HD, { id: "fwwebb", name: "F.W. Webb", short: "F.W. Webb", url: function (q) { return g("site:fwwebb.com " + q); } }, { id: "ferguson", name: "Ferguson", short: "Ferguson", url: function (q) { return g("site:ferguson.com " + q); } },
      { id: "supplyhouse", name: "SupplyHouse.com", short: "SupplyHouse", url: function (q) { return g("site:supplyhouse.com " + q); } }, LOWES],
    gc: [HD, LOWES, { id: "lumber84", name: "84 Lumber", short: "84 Lumber", url: function (q) { return g("site:84lumber.com " + q); } },
      { id: "abcsupply", name: "ABC Supply", short: "ABC Supply", url: function (q) { return g("site:abcsupply.com " + q); } }, { id: "lumberyard", name: t("prices.localLumberYard", "Madeireira local"), short: t("prices.lumberYard", "Madeireira"), url: function (q) { return g("lumber yard " + q); } }]
  };
  function syncStores() { STORES = STORE_SETS[tradeKey(S.company)] || STORES_EL; }
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
      accent: "#B08A4A", dark: "#2B241D", bg: "#FBF7F1", payTo: "Eternity Electric" },
    bluestar: { brand: "Blue Star HVAC", title: "HVAC PROPOSAL", tagline: "LICENSED HVAC CONTRACTOR", contact: "9 Ladd Pl, Watertown, MA · bluestarhvac.inc@gmail.com · (857) 505-5740 · (774) 244-7256",
      footer: "Blue Star HVAC Inc. · 9 Ladd Pl, Watertown, MA · bluestarhvac.inc@gmail.com", role: "Licensed HVAC Contractor", logo: "icons/logo-bluestar.png", logoSm: "icons/mark-bluestar.png", logoW: "2.5in", accent: "#B3202A", dark: "#13233A", bg: "#F7F9FC", payTo: "Blue Star HVAC Inc." }
  };

  // ramo da empresa para propostas: electrical | hvac | plumbing | gc (o banco multiempresa chama o GC de "general")
  function tradeKey(co) { var t = E.tradeOf(co); return t === "general" ? "gc" : (t === "hvac" || t === "plumbing" || t === "gc") ? t : "electrical"; }
  var STATE_NAMES = { MA: "Massachusetts", NH: "New Hampshire", RI: "Rhode Island", CT: "Connecticut", VT: "Vermont", ME: "Maine", NY: "New York", NJ: "New Jersey", PA: "Pennsylvania", FL: "Florida", GA: "Georgia", TX: "Texas", CA: "California", NC: "North Carolina", VA: "Virginia", MD: "Maryland", IL: "Illinois", OH: "Ohio" };
  function coRec(id) { return (API.companies || []).find(function (c) { return c.id === id; }) || null; }
  function stateOf(co) { var c = coRec(co); return (c && c.state) || "MA"; }
  // cabeçalho do documento: Eternity/Blue Star usam o modelo pré-configurado; as outras empresas usam o que está em Configurações → Empresa
  var TRADE_DOC = {
    electrical: { title: "ELECTRICAL PROPOSAL", tagline: "LICENSED ELECTRICAL CONTRACTOR", role: "Licensed Electrical Contractor" },
    hvac: { title: "HVAC PROPOSAL", tagline: "LICENSED HVAC CONTRACTOR", role: "Licensed HVAC Contractor" },
    plumbing: { title: "PLUMBING PROPOSAL", tagline: "LICENSED PLUMBING CONTRACTOR", role: "Licensed Plumbing Contractor" },
    gc: { title: "CONSTRUCTION PROPOSAL", tagline: "GENERAL CONTRACTOR", role: "General Contractor" }
  };
  function coFor(id, p) {
    if (CO[id]) return CO[id];
    var c = coRec(id) || (p && p.companyBrand) || null;
    if (!c) return CO.eternity;
    var td = TRADE_DOC[c.trade === "general" ? "gc" : c.trade] || TRADE_DOC.electrical, name = c.name || "Company";
    var contact = [c.address, c.email, c.phone].filter(Boolean).join(" · ") || (STATE_NAMES[c.state] || c.state || "");
    var accent = /^#[0-9a-f]{6}$/i.test(c.accent || "") ? c.accent : "#0B7B6A";
    return { brand: name, title: td.title, tagline: td.tagline + (c.license ? " · LIC. " + String(c.license).toUpperCase() : ""), contact: contact,
      footer: [name, c.email, c.phone, c.license ? "License " + c.license : ""].filter(Boolean).join(" · "), role: td.role, logo: c.logo || "", logoSm: c.logo || "", logoW: "1.3in",
      accent: accent, dark: "#1F2A28", bg: "#FAFAF8", payTo: name, email: c.email || "", custom: true };
  }
  // instantâneo da marca na proposta (a página pública do cliente não carrega as empresas da conta)
  function brandSnap(id) { var c = coRec(id); if (!c || CO[id]) return null; return { name: c.name, trade: c.trade, accent: c.accent || "", email: c.email || "", phone: c.phone || "", address: c.address || "", license: c.license || "", state: c.state || "" }; }

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
    ],
    plumbing: [
      ["Demolition & Removal", "Disconnect, cap, and remove existing plumbing fixtures and piping within the work area.\nProtect adjacent finished surfaces; removal of debris from our work."],
      ["Drain, Waste & Vent (DWV)", "Furnish and install new **PVC** drain, waste, and vent piping sized per the plumbing code, including traps, cleanouts, and vent through the roof.\nConnection to the existing building drain / sewer."],
      ["Water Supply Piping", "Furnish and install new **PEX** hot and cold water distribution with manifold and shut-off valves at each fixture.\nInsulation on hot water lines and on piping in unconditioned spaces."],
      ["Fixtures & Trim", "Set and connect toilets, lavatories, tub / shower valves and trim, kitchen sink, and faucets.\nFixtures and trim supplied by Owner / GC unless listed in the Investment section."],
      ["Water Heater", "Furnish and install a new water heater with expansion tank, T&P relief discharge, and venting per the manufacturer's instructions."],
      ["Gas Piping", "Furnish and install gas piping to the listed appliances, including shut-off valves, sediment traps, and pressure test.\nGas work performed by a licensed gas fitter under a separate gas permit."],
      ["Appliance Connections", "Connect dishwasher, disposal, washing machine box, and refrigerator ice-maker line as listed."],
      ["Testing", "Pressure test of water supply and DWV piping at rough-in; final leak check of all fixtures and connections."],
      ["Permit & Inspections", "Plumbing (and gas, where applicable) permits will be pulled by us. Permit fees are included.\nCoordination of all required inspections (rough and final) with the plumbing inspector."]
    ],
    gc: [
      ["General Conditions", "Project management, supervision, scheduling, and coordination of all trades.\nSite protection, temporary facilities, dumpster, and daily cleanup."],
      ["Demolition", "Selective demolition of existing finishes and components within the work area, including disposal."],
      ["Sitework & Foundation", "Excavation, footings, and foundation walls per the structural drawings, including damp-proofing and backfill."],
      ["Framing & Carpentry", "Furnish and install framing lumber, sheathing, and structural members per the drawings and the building code.\nBlocking for cabinets, fixtures, and accessories."],
      ["Roofing & Exterior", "Furnish and install roofing, flashing, house wrap, siding, exterior trim, windows, and exterior doors as specified."],
      ["Mechanical, Electrical & Plumbing", "Electrical, plumbing, and HVAC by licensed subcontractors under their own permits, per the scope and the code."],
      ["Insulation & Drywall", "Insulation per the energy code; drywall hung, taped, and finished (Level 4), ready for paint."],
      ["Interior Finishes", "Interior doors and trim, flooring, tile, cabinets and countertops, and paint (two coats) as specified."],
      ["Permit, Inspections & Closeout", "Building permit will be pulled by us. Permit fees are included.\nCoordination of all inspections, final punch list, final cleaning, and certificate of occupancy where required."]
    ]
  };

  var PAY = {
    "50/50": [["Deposit", "Upon signed acceptance of this proposal.", 50], ["Final Payment", "Upon completion and final inspection.", 50]],
    "30/40/30": [["Deposit", "Upon signed acceptance, prior to mobilization.", 30], ["Rough-In", "Upon completion of rough-in and rough inspection.", 40], ["Final Payment", "Upon completion, final inspection and AHJ sign-off.", 30]],
    "Bank 35/35/30": [["First Draw", "Performance affidavit issued to the bank upon mobilization and start of work.", 35], ["Second Draw", "After rough inspection, second performance affidavit issued to the bank.", 35], ["Final Draw", "After final inspection and AHJ sign-off, completion affidavit issued to the bank.", 30]],
    "100% final": [["Payment in Full", "Upon completion and final inspection.", 100]]
  };

  function defaults(co) {
    var tk = tradeKey(co), c = coFor(co);
    if (tk === "plumbing" || tk === "gc") return newTradeDefaults(tk, c, co);
    var ele = tk !== "hvac";
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
  // plumbing / GC: textos padrão no mesmo formato dos de elétrica e HVAC (estado vem de Configurações → Empresa)
  function newTradeDefaults(tk, c, co) {
    var st = STATE_NAMES[stateOf(co)] || stateOf(co), warranty = "**Workmanship Warranty:** One (1) year on all workmanship from the date of final inspection. Manufacturer warranties on all materials and equipment transferred to Owner.\n**Insurance Coverage:** General Liability $1M / $2M, Workers' Compensation, and Commercial Auto. Certificate of Insurance available upon request.";
    if (tk === "plumbing") return {
      includes: "all labor, piping and materials listed above (fixtures supplied by others unless listed), supervision, applicable " + st + " sales tax, and plumbing permit fees and inspection coordination.",
      notIncluded: "Fixtures, faucets, and trim unless listed above · appliances · electrical work and connections · drywall, patching, painting, tile, or carpentry · excavation or trenching outside the building · water / sewer utility connection fees · septic system work · asbestos or hazardous-material abatement.",
      clarifications: "Plumbing permit will be pulled by " + c.brand + ". **Permit fees are included.**\nAll work performed by licensed plumbers; gas work by a licensed gas fitter.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
      warranty: warranty };
    return {
      includes: "all labor, materials, supervision, project management, subcontractor coordination, dumpster and cleanup, applicable " + st + " sales tax, and building permit fees.",
      notIncluded: "Architectural or engineering design and stamped drawings (unless listed) · utility company charges and connection fees · Owner-selected allowances above the amounts listed · landscaping, paving, and site work outside the work area · asbestos, lead, or hazardous-material abatement · furniture, appliances, and window treatments.",
      clarifications: "Building permit will be pulled by " + c.brand + ". **Permit fees are included.**\nAll subcontracted trades are licensed and insured.\nAllowance items will be reconciled at actual cost.\nAny work outside the scope above will be quoted as a written change order before it is performed.",
      warranty: warranty };
  }
  function introText(p) {
    var tk = tradeKey(p.companyId), where = p.client.address || "the project location";
    var what = p.subtitle ? "the " + p.subtitle.toLowerCase().replace(/ · /g, " — ") : "the project";
    if (tk === "plumbing" || tk === "gc") {
      var ma = stateOf(p.companyId) === "MA";
      return tk === "plumbing"
        ? "This proposal covers the plumbing scope of work for " + what + " at " + where + ". Work will be performed in accordance with " + (ma ? "the Massachusetts Uniform State Plumbing Code (248 CMR), the Massachusetts Fuel Gas Code where applicable," : "the applicable state plumbing and fuel gas codes") + " and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed plumbers under permit."
        : "This proposal covers the general construction scope of work for " + what + " at " + where + ". Work will be performed in accordance with " + (ma ? "the Massachusetts State Building Code 780 CMR (10th edition)" : "the applicable state building code") + ", the approved drawings, and the requirements of the local Authority Having Jurisdiction. Trade work will be performed by licensed and insured subcontractors under permit.";
    }
    var ele = tk !== "hvac";
    return ele
      ? "This proposal covers the electrical scope of work for " + what + " at " + where + ". Work will be performed in full compliance with the 2023 Massachusetts Electrical Code (527 CMR 12.00 / NEC 2023), the Massachusetts State Building Code 780 CMR (10th edition), and the requirements of the local Authority Having Jurisdiction. All work will be performed by licensed Massachusetts electricians under permit."
      : "This proposal covers the HVAC scope of work for " + what + " at " + where + ". Work will be performed in accordance with the Massachusetts State Building Code 780 CMR (10th edition), the Massachusetts Fuel Gas Code (248 CMR) where applicable, the manufacturer's installation instructions, and the requirements of the local Authority Having Jurisdiction.";
  }
  function nextNumber(type) {
    var inv = type === "invoice", blue = S.company === "bluestar", max = inv ? (blue ? 5000 : 1000) : (blue ? 1000 : CO[S.company] ? 366 : 1000), re = inv ? /^INV/i : /^EST/i;
    S.proposals.forEach(function (p) { if (p.companyId !== S.company || !re.test(p.number || "")) return; var m = /(\d+)/.exec(p.number || ""); if (m) max = Math.max(max, Number(m[1])); });
    return (inv ? "INV" : "EST") + (max + 1);
  }
  function blankProposal() {
    var co = S.company, c = coFor(co), d = defaults(co);
    var p = { id: null, docType: "estimate", speech: "", notes: [], companyId: co, number: nextNumber(), status: "Rascunho", date: today(), validityDays: 30, title: c.title, subtitle: "",
      client: { name: "", role: "General Contractor", address: "" }, intro: "", sections: [], items: [{ desc: "", qty: "1 lot", price: "" }],
      totalLabel: "TOTAL — Lump Sum, Fixed Price", includes: d.includes, payment: { note: "", rows: clone(PAY["30/40/30"]) },
      notIncluded: d.notIncluded, clarifications: d.clarifications, warranty: d.warranty,
      header: { tagline: c.tagline, contact: c.contact, footer: c.footer }, materials: [], total: 0, amountPaid: "", dueTerms: "Due upon receipt", dueDate: "" };
    var snap = brandSnap(co); if (snap) p.companyBrand = snap;
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
          return '<tr class="click" data-act="pOpen" data-id="' + p.id + '"><td><b>' + esc(p.number || "—") + '</b><div class="small muted">' + (isInv(p) ? "Invoice" : esc(t("proposals.rowEstimate", "Proposta"))) + "</div></td><td>" + esc((p.client || {}).name || "—") + '</td><td class="small">' + esc((p.client || {}).address || "") + (p.subtitle ? '<div class="muted">' + esc(p.subtitle) + "</div>" : "") + "</td><td>" + E.fmtDate(p.date) + "</td><td>" + pPill(p.status) + '</td><td class="n"><b>' + money(p.total) + "</b></td></tr>";
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
      t("proposals.addSection", '<div><span class="label">Adicionar seção</span><div class="chips" style="margin-top:6px">') + SECTIONS[trade].map(function (x, i) { return '<button type="button" class="chip" data-act="pAddSec" data-id="' + i + '" lang="en">+ ' + esc(x[0]) + "</button>"; }).join("") + t("proposals.blankSection", '<button type="button" class="chip" data-act="pAddSec" data-id="-1">+ Seção em branco</button></div></div></div>');

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

    var terms = t("proposals.terms", '<div class="panel ed-sec"><h3>Condições</h3>') + ta("notIncluded", t("proposals.notIncluded", "Não incluído"), 4) + ta("clarifications", t("proposals.clarifications", "Esclarecimentos"), 4, t("proposals.oneLineOneItem", "uma linha = um item")) + ta("warranty", t("proposals.warrantyAndInsurance", "Garantia e seguro"), 3, t("proposals.oneLineOneItem", "uma linha = um item")) +
      t("proposals.documentHeaderAndFooter", '<details><summary class="small" style="cursor:pointer">Cabeçalho e rodapé do documento</summary><div class="stack" style="margin-top:10px">') + inp("header.tagline", t("proposals.lineUnderTheLogo", "Linha abaixo do logo")) + inp("header.contact", t("proposals.contact", "Contato")) + inp("header.footer", t("proposals.footer", "Rodapé")) + "</div></details></div>";

    return a + sec + inv + (isInv(p) ? "" : pay) + terms + materialsPanel(p);
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
  function draftKey() { return "nivela_pdraft_" + ((S.user && S.user.id) || ""); }
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
  AC.pAddSec = function (el) { var i = Number(el.dataset.id), tr = tradeKey(S.pdraft.companyId); S.pdraft.sections.push(i < 0 ? { title: "New Section", text: "" } : { title: SECTIONS[tr][i][0], text: SECTIONS[tr][i][1] }); E.render(); };
  AC.pRmSec = function (el) { S.pdraft.sections.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pMoveSec = function (el) { var i = Number(el.dataset.id), j = i + Number(el.dataset.dir), a = S.pdraft.sections; if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; E.render(); };
  AC.pAddItem = function () { S.pdraft.items.push({ desc: "", qty: "1", price: "" }); E.render(); };
  AC.pRmItem = function (el) { S.pdraft.items.splice(Number(el.dataset.id), 1); E.render(); };
  AC.pPayPreset = function (el) { S.pdraft.payment.rows = clone(PAY[el.dataset.id]); if (/Bank/.test(el.dataset.id)) S.pdraft.payment.note = "**Bank-financed project — performance-based draws.** This project is financed by the Owner's lender. A performance affidavit and supporting documentation will be issued to the bank at each milestone below."; E.render(); };
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

  EXT.input.push(function (el) {
    if (!el.dataset.pbind || !S.pdraft) return false;
    set(S.pdraft, el.dataset.pbind, el.value);
    schedulePreview(); schedulePersist();
    if (el.dataset.price) { var t = $("#pTotal"); if (t) t.textContent = money2(totalOf(S.pdraft)); }
    if (/^payment\.rows\.\d+\.2$/.test(el.dataset.pbind)) { var sm = $("#pSum"), tot = (S.pdraft.payment.rows || []).reduce(function (a, r) { return a + num(r[2]); }, 0); if (sm) { sm.textContent = NV.t("proposals.sum", "Soma: ") + tot + "%"; sm.className = "small " + (tot === 100 ? "v-good" : "v-bad"); } }
    return true;
  });
  EXT.change.push(function (el) {
    if (el.dataset.pbind && S.pdraft) { set(S.pdraft, el.dataset.pbind, el.value); if (el.tagName === "SELECT") E.render(); else schedulePersist(); return true; }
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
      (p.id ? (inv ? "Invoice " : t("proposals.estimate", "Proposta ")) + esc(p.number) : inv ? t("proposals.newInvoice2", "Novo invoice") : t("proposals.newEstimate2", "Nova proposta")) + "</h1><p>" + esc(E.companyName(p.companyId)) + t("proposals.comesOutInEnglish", " · sai em inglês, no padrão das suas propostas</p></div>") +
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
    var ex = tk === "plumbing" ? E.t("prop.ex.plumbing", "Ex.: “Reforma de dois banheiros: tubulação nova em PEX, troca dos vasos e pias, válvula nova no chuveiro e aquecedor tankless a gás. Preço 12.800, 30/40/30.”")
      : tk === "gc" ? E.t("prop.ex.gc", "Ex.: “Reforma completa da cozinha: demolição, drywall, piso, armários e bancada, elétrica e plumbing por subempreiteiros, pintura. Preço 68 mil, 30/40/30.”")
      : tk === "hvac"
      ? t("proposals.eGReplaceThe", "Ex.: “Trocar o sistema antigo por uma heat pump Viessmann de 36 mil BTU, duas zonas, dois termostatos, linha nova. Preço 14.500, metade na entrada.”")
      : inv ? t("proposals.eGInvoiceFor", "Ex.: “Invoice da troca do painel para 200 amp e 6 tomadas GFCI na cozinha. Total 6.800, ele já pagou 3.400.”")
        : t("proposals.eGTwoStory", "Ex.: “Casa de dois andares. Trocar o serviço para 200 amp, 12 recessed na sala e cozinha, GFCI na cozinha e banheiros, detectores de fumaça interligados. Paredes abertas, Romex. Preço 9.500, 30/40/30.”");
    var voice = '<div class="panel ed-sec"><h3>' + (ok ? t("proposals.wantToChangeSomething", "Quer mudar alguma coisa? Fale aqui") : t("proposals.describeTheJob", "Fale o serviço")) + "</h3>" +
      '<div class="voice"><button type="button" class="mic' + (S.pRec ? " on" : "") + t("proposals.dataActPmicAria", '" data-act="pMic" aria-label="Gravar voz" aria-pressed="') + (S.pRec ? "true" : "false") + '">' + MIC_SVG + "</button>" +
      '<div><b id="micState">' + micLabel() + '</b><div class="small muted" style="margin-top:4px">' + esc(ok ? t("proposals.eGTakeOut", "Ex.: “Tira o permit, muda o preço para 9 mil e acrescenta 4 tomadas no porão.”") : ex) + "</div></div></div>" +
      t("proposals.html6", '<textarea id="pSpeech" rows="5" placeholder="O que você falar aparece aqui. Também dá para digitar ou usar o microfone do teclado.">') + esc(S.pSpeech || "") + "</textarea>" +
      '<div class="row">' + (busy ? t("proposals.buildingTakesAbout30", '<button class="btn" disabled><span class="spin" aria-hidden="true"></span> Montando… leva uns 30 segundos</button>')
        : ok ? t("proposals.adjust", '<button class="btn" data-act="pAI" data-id="adjust">✨ Ajustar ') + (inv ? t("proposals.theInvoice", "o invoice") : t("proposals.theEstimate", "a proposta")) + t("proposals.buildFromScratchWith", '</button><button class="btn ghost" data-act="pAI" data-id="new">Montar do zero com esse texto</button>')
          : t("proposals.build", '<button class="btn" data-act="pAI" data-id="new">✨ Montar ') + (inv ? "invoice" : t("proposals.estimateWord", "proposta")) + "</button>") +
      t("proposals.speechLanguageOptionValue", '<label class="small muted" style="margin-left:auto">Idioma da fala <select id="pLang" style="width:auto;padding:4px 8px"><option value="pt-BR"') + ((S.pLang || E.speechLang()) !== "en-US" ? " selected" : "") + '>Português</option><option value="en-US"' + ((S.pLang || E.speechLang()) === "en-US" ? " selected" : "") + ">English</option></select></label></div></div>";

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
    p.total = totalOf(p);
  }

  // versão simples sem IA (quando a IA não está ligada): escolhe as seções padrão pelas palavras faladas
  var KW = {
    electrical: [/servi[cç]o|service|\b(100|150|200|400)\s?(a|amp)|painel|panel|meter|medidor/i, /rough|fia[cç][aã]o|wiring|r[oô]mex|\bmc\b|rewire|refazer a fia/i, /tomada|outlet|receptacle|interruptor|switch|recess|luz|luzes|light|dimmer|fixture|ilumina/i, /cozinha|kitchen|banheiro|bath/i, /smoke|fuma[cç]a|detector/i, /hvac|condens|heat ?pump|mini.?split|ar.condicionado|air handler/i, /fire alarm|alarme de inc[eê]ndio/i, /low voltage|baixa tens[aã]o|\bdata\b|internet|\btv\b|cat ?6/i, /exterior|externa|lado de fora|garage|garagem|outside/i, /./],
    hvac: [/remov|tirar|velh|antig|existing|old/i, /./, /duto|duct|sheet ?metal/i, /line ?set|linha|refrigerant|condensa/i, /termostato|thermostat|zona|zone/i, /furnace|fornalha|g[aá]s|boiler|caldeira/i, /./, /mass ?save|rebate/i, /./],
    plumbing: [/demol|remov|tirar|retirar|velh|antig|old/i, /esgoto|dreno|drain|dwv|vent|waste|ralo|sewer/i, /[aá]gua|water line|pex|cobre|copper|supply|encanamento|tubula/i, /vaso|toilet|pia|sink|lavat|chuveiro|shower|banheira|tub|torneira|faucet|fixture/i, /aquecedor|water heater|tankless|boiler|caldeira/i, /g[aá]s/i, /lava.?lou|dishwasher|m[aá]quina de lavar|washer|disposal|geladeira|ice ?maker/i, /./, /./],
    gc: [/./, /demol|tirar|remov|gut/i, /funda[cç]|foundation|escava|excav|concreto|slab|footing/i, /framing|estrutura|parede|wall|carpent|madeira|addition|amplia/i, /telhado|roof|siding|janela|window|porta externa|exterior|deck/i, /el[eé]tric|plumbing|hidr[aá]ulic|hvac|encanamento|ar.condicionado/i, /isola|insulation|drywall|gesso|sheetrock/i, /piso|floor|azulejo|tile|arm[aá]rio|cabinet|bancada|countertop|pintura|paint|trim|acabamento|cozinha|kitchen|banheiro|bath/i, /./]
  };
  function priceFrom(t) {
    var best = 0, m, re = /\$\s?([\d.,]+)|\b(\d{1,3}(?:[.,]\d{3})+)\b|\b(\d+(?:[.,]\d+)?)\s?mil\b|\b(\d{4,6})\b/gi;
    while ((m = re.exec(t))) {
      var v = m[1] || m[2] ? Number(String(m[1] || m[2]).replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")) : m[3] ? Number(m[3].replace(",", ".")) * 1000 : Number(m[4]);
      if (v >= 300 && v < 5e6 && v > best) best = v;
    }
    var m2 = /(?:pre[cç]o|valor|total|cobra[r]?|price)\s*(?:de|é|e|:)?\s*\$?\s?(\d+(?:[.,]\d+)?)/i.exec(t);
    if (!best && m2) { var v2 = Number(m2[1].replace(",", ".")); if (v2 >= 50) best = v2; }
    return best;
  }
  function localBuild(p, speech) {
    var tr = tradeKey(p.companyId), price = priceFrom(speech), scopeName = { hvac: "HVAC", electrical: "Electrical", plumbing: "Plumbing", gc: "Construction" }[tr];
    p.sections = SECTIONS[tr].filter(function (x, i) { return KW[tr][i].test(speech); }).map(function (x) { return { title: x[0], text: x[1] }; });
    p.title = isInv(p) ? "INVOICE" : coFor(p.companyId, p).title;
    p.intro = isInv(p) ? "Invoice for " + (tr === "hvac" ? "HVAC" : tr === "electrical" ? "electrical" : tr === "plumbing" ? "plumbing" : "construction") + " work completed at " + (p.client.address || "the project location") + "." : introText(p);
    if (isInv(p)) p.sections = [];
    p.items = [{ desc: scopeName + " Scope" + (isInv(p) ? " — Work Completed" : " — Complete") + "\nLabor, material and permit per the scope above.", qty: "1 lot", price: price ? String(price) : "" }];
    p.payment.rows = clone(PAY[price && price < 8000 ? "50/50" : "30/40/30"]);
    p.notes = [t("proposals.builtWithoutAiI", "Montado sem IA: escolhi as seções padrão pelas palavras faladas. Revise o texto em “Editar tudo”.")].concat(price ? [] : [t("proposals.couldnTFindThe", "Não achei o preço na fala.")]);
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
    API.aiProposal({ company: p.companyId, trade: tradeKey(p.companyId), docType: p.docType || "estimate", speech: speech, client: p.client, today: today(), current: mode === "adjust" ? compact(p) : null })
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
  var BASIC = {
    electrical: [
      ["Romex NM-B 14/2 — 250 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")], ["Romex NM-B 12/2 — 250 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")], ["Romex NM-B 14/3 — 250 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")], ["Romex NM-B 12/3 — 250 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")],
      ["Romex NM-B 10/3 — 125 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")], ["MC 12/2 — 250 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")], ["THHN 12 AWG — 500 ft", t("prices.wireAndCable", "Fio e cabo"), t("prices.unitRoll", "rolo")],
      ["EMT 1/2\" — 10 ft", t("prices.conduit", "Conduíte"), t("prices.each", "peça")], ["EMT 3/4\" — 10 ft", t("prices.conduit", "Conduíte"), t("prices.each", "peça")],
      [t("prices.1GangNewWork", "Caixa 1 gang new work"), t("prices.boxes", "Caixas"), t("prices.unitEach", "un")], [t("prices.2GangNewWork", "Caixa 2 gang new work"), t("prices.boxes", "Caixas"), t("prices.unitEach", "un")], [t("prices.octagonFanBox", "Caixa octogonal / ventilador"), t("prices.boxes", "Caixas"), t("prices.unitEach", "un")],
      [t("prices.15aTrReceptacleDecorator", "Tomada TR 15A (decorator)"), t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")], [t("prices.20aTrReceptacleDecorator", "Tomada TR 20A (decorator)"), t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")], [t("prices.20aGfciReceptacleTr", "Tomada GFCI 20A TR/WR"), t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")], [t("prices.singlePoleDecoratorSwitch", "Interruptor single-pole decorator"), t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")], [t("prices.3WayDecoratorSwitch", "Interruptor 3-way decorator"), t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")], ["Dimmer LED", t("prices.devices", "Dispositivos"), t("prices.unitEach", "un")],
      [t("prices.15aAfciGfciBreaker", "Disjuntor 15A AFCI/GFCI (dual function)"), t("prices.panelAndBreakers", "Painel e disjuntores"), t("prices.unitEach", "un")], [t("prices.20aAfciGfciBreaker", "Disjuntor 20A AFCI/GFCI (dual function)"), t("prices.panelAndBreakers", "Painel e disjuntores"), t("prices.unitEach", "un")], [t("prices.200aMainBreakerPanel", "Painel 200A main breaker 40 espaços"), t("prices.panelAndBreakers", "Painel e disjuntores"), t("prices.unitEach", "un")], ["Meter socket 200A", t("prices.panelAndBreakers", "Painel e disjuntores"), t("prices.unitEach", "un")],
      [t("prices.groundRod58", "Haste de aterramento 5/8\" x 8 ft"), t("prices.grounding", "Aterramento"), t("prices.unitEach", "un")], ["Recessed LED 6\" wafer", t("prices.lighting", "Iluminação"), t("prices.unitEach", "un")], ["Recessed LED 4\" wafer", t("prices.lighting", "Iluminação"), t("prices.unitEach", "un")], [t("prices.hardwiredComboSmokeCo", "Detector fumaça/CO combinado hardwired"), t("prices.lifeSafety", "Segurança"), t("prices.unitEach", "un")],
      [t("prices.wireNutsBox", "Wire nuts (caixa)"), t("prices.consumables", "Consumíveis"), t("prices.unitBox", "caixa")], [t("prices.romexStaplesBox", "Grampos Romex (caixa)"), t("prices.consumables", "Consumíveis"), t("prices.unitBox", "caixa")]
    ],
    hvac: [
      ["Line set 1/4\" x 3/8\" — 50 ft", t("prices.piping", "Tubulação"), t("prices.unitEach", "un")], ["Line set 3/8\" x 3/4\" — 50 ft", t("prices.piping", "Tubulação"), t("prices.unitEach", "un")], [t("prices.condensatePump", "Bomba de condensado"), t("prices.drain", "Dreno"), t("prices.unitEach", "un")], [t("prices.thermostatWire185", "Fio de termostato 18/5 — 250 ft"), t("prices.controls", "Controles"), t("prices.unitRoll", "rolo")],
      ["Disconnect 60A non-fused", t("prices.hvacElectrical", "Elétrica HVAC"), t("prices.unitEach", "un")], ["Whip 3/4\" x 6 ft", t("prices.hvacElectrical", "Elétrica HVAC"), t("prices.unitEach", "un")], [t("prices.condenserPad", "Pad de condensadora"), t("prices.equipment", "Equipamento"), t("prices.unitEach", "un")], [t("prices.miniSplitWallBracket", "Suporte de parede mini-split"), t("prices.equipment", "Equipamento"), t("prices.unitEach", "un")],
      ["Line hide kit", t("prices.finish", "Acabamento"), t("prices.unitEach", "un")], [t("prices.wiFiThermostat", "Termostato Wi-Fi"), t("prices.controls", "Controles"), t("prices.unitEach", "un")], [t("prices.foilTapeMastic", "Fita aluminizada / mastic"), t("prices.ductwork", "Dutos"), t("prices.unitEach", "un")], [t("prices.6InsulatedFlexDuct", "Duto flexível 6\" isolado — 25 ft"), t("prices.ductwork", "Dutos"), t("prices.unitEach", "un")]
    ],
    plumbing: [
      ["PEX-A 1/2\" — 100 ft", t("prices.piping", "Tubulação"), t("prices.unitRoll", "rolo")], ["PEX-A 3/4\" — 100 ft", t("prices.piping", "Tubulação"), t("prices.unitRoll", "rolo")], [t("prices.typeLCopper1", "Cobre tipo L 1/2\" — 10 ft"), t("prices.piping", "Tubulação"), t("prices.each", "peça")], [t("prices.typeLCopper3", "Cobre tipo L 3/4\" — 10 ft"), t("prices.piping", "Tubulação"), t("prices.each", "peça")],
      ["PVC DWV 2\" — 10 ft", t("prices.drainWasteVentDwv", "Esgoto (DWV)"), t("prices.each", "peça")], ["PVC DWV 3\" — 10 ft", t("prices.drainWasteVentDwv", "Esgoto (DWV)"), t("prices.each", "peça")], [t("prices.pTrap11", "Sifão P-trap 1-1/2\""), t("prices.drainWasteVentDwv", "Esgoto (DWV)"), t("prices.unitEach", "un")], [t("prices.pexExpansionRing1", "Anel de expansão PEX 1/2\" (saco)"), t("prices.fittings", "Conexões"), t("prices.unitBag", "saco")],
      [t("prices.ballValve34", "Válvula de esfera 3/4\""), t("prices.valves", "Válvulas"), t("prices.unitEach", "un")], [t("prices.showerValvePressureBalance", "Válvula de chuveiro (pressure balance)"), t("prices.valves", "Válvulas"), t("prices.unitEach", "un")], [t("prices.angleStop12", "Registro angular 1/2\" x 3/8\""), t("prices.valves", "Válvulas"), t("prices.unitEach", "un")],
      [t("prices.waterHeater50Gal", "Aquecedor de água 50 gal a gás"), t("prices.waterHeater", "Aquecedor"), t("prices.unitEach", "un")], ["Expansion tank 2 gal", t("prices.waterHeater", "Aquecedor"), t("prices.unitEach", "un")], [t("prices.waxRingToilet", "Anel de cera (vaso)"), t("prices.finish", "Acabamento"), t("prices.unitEach", "un")], [t("prices.supplyLine", "Flexível de abastecimento (supply line)"), t("prices.finish", "Acabamento"), t("prices.unitEach", "un")],
      [t("prices.pvcCementAndPrimer", "Cola e primer PVC"), t("prices.consumables", "Consumíveis"), t("prices.unitKit", "kit")], [t("prices.threadTapePipeDope", "Fita veda-rosca / pasta"), t("prices.consumables", "Consumíveis"), t("prices.unitEach", "un")]
    ],
    gc: [
      ["2x4 x 8 ft SPF", t("prices.lumber", "Madeira"), t("prices.each", "peça")], ["2x6 x 8 ft SPF", t("prices.lumber", "Madeira"), t("prices.each", "peça")], ["OSB 7/16\" 4x8", t("prices.lumber", "Madeira"), t("prices.unitSheet", "folha")], [t("prices.plywood344x8", "Compensado 3/4\" 4x8"), t("prices.lumber", "Madeira"), t("prices.unitSheet", "folha")],
      ["Drywall 1/2\" 4x8", "Drywall", t("prices.unitSheet", "folha")], ["Drywall 5/8\" Type X 4x8", "Drywall", t("prices.unitSheet", "folha")], [t("prices.jointCompound45", "Massa (joint compound) 4,5 gal"), "Drywall", t("prices.unitBucket", "balde")], [t("prices.r21FiberglassInsulation", "Isolamento R-21 fiberglass"), t("prices.insulation", "Isolamento"), t("prices.unitPack", "pacote")],
      ["House wrap 9x100 ft", t("prices.exterior", "Exterior"), t("prices.unitRoll", "rolo")], ["Shingles (bundle)", t("prices.roofing", "Telhado"), t("prices.unitPack", "pacote")], [t("prices.16dFramingNailsBox", "Pregos de framing 16d (caixa)"), t("prices.fasteners", "Fixação"), t("prices.unitBox", "caixa")], [t("prices.drywallScrews15", "Parafuso de drywall 1-5/8\" (caixa)"), t("prices.fasteners", "Fixação"), t("prices.unitBox", "caixa")],
      [t("prices.interiorPaintGallon", "Tinta interior (galão)"), t("prices.painting", "Pintura"), t("prices.gallon", "galão")], [t("prices.lvpVinylFlooringBox", "Piso vinílico LVP (caixa)"), t("prices.flooring", "Piso"), t("prices.unitBox", "caixa")], ["Dumpster 20 yd", t("prices.services", "Serviços"), t("prices.unitEach", "un")]
    ]
  };
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
        : E.emptyState({ icon: "tag", title: t("prices.noMaterialsYet", "Nenhum material cadastrado"), text: t("prices.startWithABasic", "Comece por uma lista básica e vá anotando os preços de cada loja."), cta: tk === "plumbing" || tk === "gc"
          ? '<div class="row" style="justify-content:center"><button class="btn sm" data-act="prBasic" data-id="' + tk + '">' + esc(tk === "plumbing" ? E.t("prices.basicPlumbing", "Adicionar lista básica de plumbing") : E.t("prices.basicGc", "Adicionar lista básica de obra (GC)")) + "</button></div>"
          : t("prices.addBasicElectricalList", '<div class="row" style="justify-content:center"><button class="btn sm" data-act="prBasic" data-id="electrical">Adicionar lista básica elétrica</button><button class="btn ghost sm" data-act="prBasic" data-id="hvac">Lista básica HVAC</button></div>') }));
    return t("prices.yourPricesByStore", '<div class="spread" style="margin-bottom:10px"><p class="muted small" style="margin:0">Seus preços por loja (usados na estimativa e na lista de material). Verde = mais barato · apagado = mais de 30 dias.</p><button class="btn sm" data-act="prNewMat">+ Material</button></div>') +
      t("prices.searchInputTypeSearch", '<div class="filters"><label class="field"><span>Buscar</span><input type="search" data-pf="q" value="') + esc(f.q) + t("prices.categoryAll", '" placeholder="ex.: Romex, GFCI, line set"></label><label class="field"><span>Categoria</span><select data-pf="cat"><option value="">Todas</option>') +
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
    if (tradeKey(S.company) !== "electrical") return t("proposals.pricesYourMaterialAnd", '<div class="page-head"><div><h1>Preços</h1><p>Seus preços de material e equipamento por fornecedor</p></div></div>') +
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
    var list = BASIC[el.dataset.id].filter(function (x) { return !have[x[0]]; }).map(function (x) { return { name: x[0], category: x[1], unit: x[2] }; });
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
    document.title = "Proposal · Eternity Electric"; document.documentElement.lang = "en-US"; // página do cliente: sempre em inglês
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
      var p = full(raw), inv = p.docType === "invoice", c = coFor(p.companyId, p);
      document.title = (inv ? "Invoice " : "Proposal ") + (p.number || "") + " · " + c.brand;
      document.body.style.background = "#EFE8DC";
      app.innerHTML = '<div class="pub-bar"><div><b style="font-size:17px">' + esc(c.brand) + '</b><div class="small" style="color:#7a6a55">' + (inv ? "Invoice " : "Proposal ") + esc(p.number || "") + "</div></div>" +
        '<button class="btn" id="pubPdf" type="button">Download PDF</button></div>';
      var root = document.getElementById("print-root");
      if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.insertBefore(root, after); }
      root.className = "pub"; root.innerHTML = buildDoc(p);
      document.getElementById("pubPdf").onclick = function () { printDoc(p); setTimeout(function () { root.className = "pub"; document.body.style.background = "#EFE8DC"; }, 2000); };
      if (inv) { after.innerHTML = ""; return; }
      if (p.acceptedAt || p.status === "Aceita") {
        after.innerHTML = '<div class="pub-accept" style="border-color:#2E7D4F"><b style="font-size:18px;color:#2E7D4F">✓ Proposal accepted</b><div>Accepted by <b>' + esc(p.acceptedBy || "") + "</b>" + (p.acceptedAt ? " on " + esc(longDate(String(p.acceptedAt).slice(0, 10))) : "") + ". Thank you! We will contact you shortly to schedule the work.</div></div>";
        return;
      }
      after.innerHTML = '<form class="pub-accept" id="pubForm"><b style="font-size:18px">Accept this proposal</b>' +
        '<div class="small" style="color:#7a6a55">Total: <b style="color:#2B241D">' + money2(p.total) + "</b> · " + esc(p.totalLabel || "") + "</div>" +
        '<label class="field"><span>Your full name</span><input type="text" id="pubName" autocomplete="name" required value="' + esc(p.client.name || "") + '"></label>' +
        '<label class="row" style="align-items:flex-start;gap:8px"><input type="checkbox" id="pubOk" required style="width:auto;margin-top:3px"> <span>I have read and accept the scope of work, pricing and payment terms of this proposal.</span></label>' +
        '<div class="err" id="pubErr" hidden></div><button class="btn" type="submit" style="background:' + (c.custom ? c.accent : "#B08A4A") + ';color:#fff">Accept proposal</button>' +
        '<div class="small" style="color:#7a6a55">Questions? Reply to the email you received' + (c.custom ? (c.email ? " or write to " + esc(c.email) : "") : " or write to office@eternityelectrical.com") + ".</div></form>";
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
      app.innerHTML = '<div class="login"><div class="login-card"><div class="brand-name">Eternity Electric</div><p>' + (r && r.error === "NOT_FOUND" ? "This link is no longer valid." : "We could not load this document right now. Please try again in a moment.") + "</p></div></div>";
    });
  })();
})();
