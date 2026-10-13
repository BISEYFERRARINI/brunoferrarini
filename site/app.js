/* Eternity Electric — app UI (admin + funcionário). Vanilla JS, no build step. */
(function () {
  "use strict";
  var API = window.API;

  // ═══════════ helpers ═══════════
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n, dec) { n = Number(n) || 0; var d = dec === undefined ? (Math.abs(n) >= 10000 ? 0 : 2) : dec; return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function hrs(n) { n = Number(n) || 0; return (n >= 100 ? Math.round(n) : n.toFixed(1)).toLocaleString("en-US") + "h"; }
  function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
  function fmtPct(p) { return (p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)) + "%"; }
  function fmtDate(d) { if (!d) return "—"; var x = new Date(String(d).length === 10 ? d + "T12:00:00" : d); return isNaN(x) ? String(d) : x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
  function fmtTime(d) { if (!d) return "—"; var x = new Date(d); return isNaN(x) ? "—" : x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function todayISO() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function isoLocal(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function set(obj, path, val) { var ks = path.split("."), o = obj; for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200); }
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var hoursOf = API.hoursOf;

  var ICON = {
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 2 4.5 13.4h6.1L9.8 22l8.7-11.6h-6.2L13.2 2Z"/></svg>',
    flake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11M9 3.8 12 6l3-2.2M9 20.2 12 18l3 2.2"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M17 7.5c-.7-1.4-2.6-2.3-5-2.3-2.8 0-4.6 1.4-4.6 3.3 0 4.6 9.8 2.3 9.8 7 0 2-2 3.4-5 3.4-2.6 0-4.6-1-5.3-2.6M12 3v18"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.8 2.4 3 5.2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 17v-3M12 17v-6M15 17v-4"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>'
  };

  // ═══════════ catalog (electrical / HVAC) ═══════════
  var EXPENSE_CATS = [
    { id: "labor", label: "Mão de obra (horas)", color: "var(--c2)" },
    { id: "material", label: "Material", color: "var(--c1)" },
    { id: "gasolina", label: "Gasolina", color: "var(--c5)" },
    { id: "subcontractor", label: "Subempreiteiro", color: "var(--c4)" },
    { id: "permit", label: "Permit / licença", color: "var(--c3)" },
    { id: "equipamento", label: "Equipamento / aluguel", color: "var(--c7)" },
    { id: "outros", label: "Outros", color: "var(--c6)" }
  ];
  function catLabel(id) { var c = EXPENSE_CATS.find(function (x) { return x.id === id; }); return c ? c.label : (id === "receita" ? "Receita" : id); }
  var STATUS = { Active: ["Em andamento", "good"], Planned: ["A começar", "accent"], "On Hold": ["Em espera", "warn"], Completed: ["Concluído", "neutral"], Cancelled: ["Cancelado", "bad"] };
  function statusPill(s) { var x = STATUS[s] || [s, "neutral"]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }

  var COMMON_FIELDS = {
    sector: { label: "Setor", opts: ["Residencial", "Comercial", "Multifamily", "Industrial", "Institucional"] },
    buildingRes: { label: "Tipo de imóvel", opts: ["Single family", "Two-family", "Three-family", "Townhouse", "Condo / apartamento", "Multifamily (4+ unidades)", "ADU"] },
    buildingCom: { label: "Tipo de imóvel", opts: ["Escritório", "Loja / retail", "Restaurante", "Galpão / warehouse", "Escola", "Clínica / saúde", "Igreja", "Uso misto", "Outro"] },
    bedrooms: { label: "Quartos", opts: ["Studio", "1", "2", "3", "4", "5", "6+"] },
    bathrooms: { label: "Banheiros", opts: ["1", "1.5", "2", "2.5", "3", "3.5", "4+"] },
    floors: { label: "Andares", opts: ["1", "2", "3", "4", "5+"] },
    permit: { label: "Permit", opts: ["Sim, já aprovado", "Sim, a tirar", "Não precisa"] },
    walls: { label: "Paredes", opts: ["Abertas (sem drywall)", "Fechadas (acabadas)", "Parcialmente abertas"] },
    occupied: { label: "Ocupação", opts: ["Desocupado", "Ocupado (família morando)", "Comercial em funcionamento"] },
    access: { label: "Acesso", multi: true, opts: ["Porão acessível", "Sótão acessível", "Crawl space", "Sem acesso por cima/baixo", "Precisa de elevador / andaime"] }
  };
  var TRADE = {
    electrical: {
      stepName: "Elétrica",
      workType: ["New Construction", "Remodel / Renovação", "Addition (ampliação)", "Service upgrade", "Reparo / service call", "Fit-out comercial", "Fire alarm"],
      fields: {
        wiring: { label: "Fiação / método", multi: true, opts: ["Romex (NM-B)", "MC Cable", "EMT (conduíte)", "PVC", "Rigid / IMC", "BX existente", "Knob & tube existente"] },
        serviceType: { label: "Serviço (service)", opts: ["Sem mudança no serviço", "Novo serviço", "Upgrade (100A → 200A)", "Upgrade (outro)", "Troca de painel apenas", "Subpainel novo"] },
        serviceAmps: { label: "Amperagem", opts: ["60A", "100A", "150A", "200A", "320/400A", "600A+"] },
        phase: { label: "Tensão / fase", opts: ["Monofásico 120/240V", "Trifásico 120/208V", "Trifásico 277/480V"] },
        serviceFeed: { label: "Entrada do serviço", opts: ["Aéreo", "Subterrâneo"] },
        utility: { label: "Concessionária", opts: ["Eversource", "National Grid", "Unitil", "Municipal (light dept.)", "Outra"] },
        fireAlarm: { label: "Fire alarm", opts: ["Sim", "Não", "Só detectores interligados"] },
        lowVoltage: { label: "Low voltage (dados/TV/câmeras)", opts: ["Sim", "Não"] },
        extras: { label: "Itens especiais", multi: true, opts: ["Carregador EV", "Gerador / transfer switch", "Solar", "Piscina / spa", "Snow melt", "Aquecimento elétrico (baseboard)", "Circuitos de mini-split", "Iluminação externa / paisagismo"] }
      },
      text: [{ key: "panel", label: "Painel (marca / modelo)" }, { key: "unitsCount", label: "Unidades (multifamily)" }],
      tasks: {
        "Serviço": ["Upgrade / instalação de serviço", "Troca de painel", "Meter socket", "Aterramento (ground rods / bonding)", "Coordenação com a concessionária", "Subpainel"],
        "Rough-in": ["Rough-in elétrico", "Caixas e furação", "Circuitos dedicados da cozinha", "Circuito do banheiro (GFCI)", "Circuitos AFCI dos quartos", "Detectores de fumaça / CO", "Iluminação recessed", "Ventilador de teto", "Exaustor de banheiro", "Circuito da condensadora (HVAC)", "Circuito 240V (secadora / fogão)", "Carregador EV", "Gerador / transfer switch", "Low voltage (dados / TV)", "Fire alarm — rough"],
        "Acabamento": ["Instalar tomadas e interruptores", "Trocar tomadas", "Trocar interruptores", "Instalar luminárias", "Tampas e placas", "Identificar circuitos do painel", "Fire alarm — dispositivos e teste"],
        "Inspeções": ["Inspeção de serviço", "Inspeção rough", "Inspeção final", "Inspeção de fire alarm"]
      }
    },
    hvac: {
      stepName: "HVAC",
      workType: ["New Construction", "Substituição de equipamento", "Sistema novo (casa existente)", "Ampliação", "Manutenção / service call", "Comercial (RTU)"],
      fields: {
        equipment: { label: "Equipamento", multi: true, opts: ["Heat pump ductless (mini-split)", "Mini-split multi-zona", "Heat pump ducted", "Air handler", "Fornalha a gás (furnace)", "Fornalha a óleo", "Caldeira (boiler)", "Central AC (condensadora)", "RTU (rooftop)", "ERV / HRV"] },
        fuel: { label: "Combustível", opts: ["Elétrico (heat pump)", "Gás natural", "Propano", "Óleo"] },
        brand: { label: "Marca", opts: ["Mitsubishi", "Fujitsu", "Daikin", "Viessmann", "Carrier", "Lennox", "Bosch", "Trane", "Outra"] },
        zones: { label: "Zonas", opts: ["1", "2", "3", "4", "5+"] },
        ducts: { label: "Dutos", opts: ["Dutos novos (sheet metal)", "Aproveitar dutos existentes", "Sem dutos (ductless)", "Misto"] },
        condensate: { label: "Condensado", opts: ["Gravidade", "Bomba de condensado"] },
        refrigerant: { label: "Refrigerante", opts: ["R-410A", "R-454B", "R-32"] },
        gasPiping: { label: "Tubulação de gás", opts: ["Sim", "Não"] },
        manualJ: { label: "Manual J (cálculo de carga)", opts: ["Sim, feito", "A fazer", "Não precisa"] },
        rebate: { label: "Rebate", opts: ["Sim, Mass Save", "Sim, outro", "Não", "Verificar"] },
        electricalBy: { label: "Elétrica feita por", opts: ["Eternity Electric", "Outro eletricista", "Cliente"] }
      },
      text: [{ key: "capacity", label: "Capacidade (BTU / ton)" }, { key: "lineSet", label: "Line set (comprimento)" }, { key: "thermostat", label: "Termostato(s)" }],
      tasks: {
        "Remoção": ["Remover equipamento antigo", "Recuperar refrigerante", "Descarte de equipamento"],
        "Equipamento": ["Instalar condensadora / heat pump", "Pad / suporte da condensadora", "Instalar air handler", "Instalar evaporadoras (mini-split)", "Instalar fornalha (furnace)", "Instalar caldeira (boiler)"],
        "Distribuição": ["Dutos novos (sheet metal)", "Isolamento e vedação de dutos", "Registros supply / return", "Line set", "Dreno / bomba de condensado", "Tubulação de gás", "Ventilação / exaustão (flue)"],
        "Controles": ["Termostatos", "Zoneamento", "Controles Wi-Fi"],
        "Comissionamento": ["Teste de pressão (nitrogênio)", "Vácuo", "Carga de refrigerante", "Start-up e teste", "Manual J / cálculo de carga", "Documentação Mass Save"],
        "Inspeções": ["Permit mecânico", "Inspeção de gás", "Inspeção final"]
      }
    }
  };
  function tradeOf(companyId) { var c = API.companies.find(function (x) { return x.id === companyId; }); return c ? c.trade : "electrical"; }
  function companyName(id) { var c = API.companies.find(function (x) { return x.id === id; }); return c ? c.name : id; }

  // ═══════════ state ═══════════
  var S = {
    user: null, company: storeGet("ee_company") || "eternity", view: "dashboard", params: {},
    projects: [], fin: {}, users: [], time: [], expenses: [],
    filters: { preset: "all", from: "", to: "", projectId: "", userId: "" },
    gastoCat: "all", draft: null, draftFiles: [], wizStep: 0, modal: null, open: null, loc: null, installEvt: null
  };

  function applyPreset() {
    var f = S.filters, now = new Date(), from = null, to = new Date(now);
    if (f.preset === "today") from = new Date(now);
    else if (f.preset === "this_week") { from = new Date(now); from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); }
    else if (f.preset === "last_week") { to = new Date(now); to.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 1); from = new Date(to); from.setDate(to.getDate() - 6); }
    else if (f.preset === "this_month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (f.preset === "last_month") { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (f.preset === "custom") return;
    else { f.from = ""; f.to = ""; return; }
    f.from = isoLocal(from); f.to = isoLocal(to);
  }

  function companyProjects() { return S.projects.filter(function (p) { return p.companyId === S.company; }); }
  function projectById(id) { return S.projects.find(function (p) { return p.id === id; }); }
  function userById(id) { return S.users.find(function (u) { return u.id === id; }); }
  function userName(id) { var u = userById(id); return u ? u.name : (S.user && S.user.id === id ? S.user.name : "—"); }

  function loadData() {
    var isAdmin = S.user.role === "admin";
    var co = isAdmin ? S.company : S.user.companyId;
    var jobs = [API.listProjects(co), API.listTime({ companyId: isAdmin ? co : null }), API.listExpenses({ companyId: isAdmin ? co : null })];
    if (isAdmin) { jobs.push(API.getFinancials()); jobs.push(API.listUsers()); }
    var CK = "ee_cache_" + S.user.id + "_" + co;
    return Promise.all(jobs).then(function (r) {
      S.projects = r[0]; S.time = r[1]; S.expenses = r[2];
      if (isAdmin) { S.fin = r[3] || {}; S.users = r[4] || []; }
      S.offline = false;
      if (API.mode === "live") storeSet(CK, JSON.stringify({ p: S.projects, t: S.time.slice(0, 600), e: S.expenses.slice(0, 600), f: S.fin, u: S.users, at: new Date().toISOString() }));
    }).catch(function (e) {
      // sem internet: mostra os últimos dados salvos neste aparelho
      var c = null; try { c = JSON.parse(storeGet(CK) || "null"); } catch (x) {}
      if (!c) throw e;
      S.projects = c.p || []; S.time = c.t || []; S.expenses = c.e || []; S.fin = c.f || {}; S.users = c.u || [];
      S.offline = c.at;
    }).then(function () {
      if (S.filters.projectId && !projectById(S.filters.projectId)) S.filters.projectId = "";
    });
  }

  // ═══════════ metrics ═══════════
  function inPeriod(iso) { var f = S.filters; if (!iso) return false; var d = isoLocal(new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso)); return (!f.from || d >= f.from) && (!f.to || d <= f.to); }
  function metrics() {
    var f = S.filters;
    var scope = companyProjects().filter(function (p) { return f.projectId ? p.id === f.projectId : p.status !== "Cancelled"; });
    var ids = {}; scope.forEach(function (p) { ids[p.id] = true; });
    var inScope = function (pid) { return f.projectId ? pid === f.projectId : (pid ? !!ids[pid] : true); };
    var T = S.time.filter(function (t) { return t.companyId === S.company && inScope(t.projectId) && (!f.userId || t.userId === f.userId); });
    var E = S.expenses.filter(function (x) { return x.companyId === S.company && inScope(x.projectId); });
    var m = { scope: scope, contract: 0, budget: 0, estHours: 0, period: blank(), all: blank(), T: T, E: E };
    scope.forEach(function (p) { var fi = S.fin[p.id] || {}; m.contract += fi.contractValue || 0; m.budget += fi.budget || 0; m.estHours += fi.estHours || 0; });
    function blank() { var o = { hours: 0, labor: 0, revenue: 0, exp: 0, byCat: {}, byUser: {} }; EXPENSE_CATS.forEach(function (c) { o.byCat[c.id] = 0; }); return o; }
    function addT(o, t) { var h = hoursOf(t); o.hours += h; o.labor += h * (t.rate || 0); o.byCat.labor += h * (t.rate || 0); var u = o.byUser[t.userId] || (o.byUser[t.userId] = { hours: 0, cost: 0, rate: t.rate }); u.hours += h; u.cost += h * (t.rate || 0); }
    function addE(o, x) { if (x.kind === "revenue") o.revenue += x.amount; else { o.exp += x.amount; o.byCat[x.category in o.byCat ? x.category : "outros"] += x.amount; } }
    T.forEach(function (t) { addT(m.all, t); if (inPeriod(t.checkIn)) addT(m.period, t); });
    E.forEach(function (x) { addE(m.all, x); if (inPeriod(x.date)) addE(m.period, x); });
    [m.period, m.all].forEach(function (o) { o.cost = o.labor + o.exp; o.profit = o.revenue - o.cost; });
    return m;
  }
  function projectStats(p) {
    var fi = S.fin[p.id] || {}, labor = 0, exp = 0, hours = 0, rev = 0;
    S.time.forEach(function (t) { if (t.projectId === p.id) { var h = hoursOf(t); hours += h; labor += h * (t.rate || 0); } });
    S.expenses.forEach(function (x) { if (x.projectId === p.id) { if (x.kind === "revenue") rev += x.amount; else exp += x.amount; } });
    var done = (p.tasks || []).filter(function (t) { return t.done; }).length, total = (p.tasks || []).length;
    return { contract: fi.contractValue || 0, budget: fi.budget || 0, estHours: fi.estHours || 0, labor: labor, exp: exp, cost: labor + exp, hours: hours, revenue: rev, done: done, total: total };
  }

  // ═══════════ charts (SVG) ═══════════
  function ring(p, size, opts) {
    opts = opts || {};
    size = size || 64;
    var stroke = opts.stroke || Math.max(6, Math.round(size / 9)), r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var shown = Math.max(0, Math.min(100, p || 0));
    var color = opts.color || (p > 100 ? "var(--bad)" : p > 85 ? "var(--warn)" : "var(--accent)");
    var label = opts.text != null ? opts.text : fmtPct(p || 0);
    var fs = opts.fontSize || Math.round(size / 4.2);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(label) + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>' +
      (shown > 0 ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (c * shown / 100) + " " + c + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' : "") +
      '<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="' + fs + '" fill="' + (opts.textColor || "var(--ink)") + '">' + esc(label) + "</text>" +
      (opts.sub ? '<text x="50%" y="' + (size / 2 + fs * 0.95) + '" text-anchor="middle" font-size="' + (opts.subSize || Math.round(fs * 0.42)) + '" fill="var(--muted)" style="font-family:var(--f-body);font-weight:500">' + esc(opts.sub) + "</text>" : "") +
      "</svg>";
  }
  function donut(segs, size, center, sub) {
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0);
    var stroke = Math.round(size / 7), r = (size - stroke) / 2, c = 2 * Math.PI * r, off = 0, out = "";
    out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>';
    if (total > 0) segs.forEach(function (s) {
      if (s.value <= 0) return;
      var len = c * s.value / total, gap = segs.filter(function (x) { return x.value > 0; }).length > 1 ? 2 : 0;
      out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="' + stroke + '" stroke-dasharray="' + Math.max(0, len - gap) + " " + c + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>';
      off += len;
    });
    out += '<text x="50%" y="47%" dominant-baseline="central" text-anchor="middle" font-size="' + Math.round(size / 8.5) + '" fill="var(--ink)" style="font-family:var(--f-display);font-weight:700">' + esc(center) + "</text>";
    if (sub) out += '<text x="50%" y="62%" text-anchor="middle" font-size="' + Math.round(size / 19) + '" fill="var(--muted)">' + esc(sub) + "</text>";
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(center + " " + (sub || "")) + '">' + out + "</svg>";
  }
  function bars(rows, fmt) {
    var max = rows.reduce(function (a, r) { return Math.max(a, r.value); }, 0);
    if (!rows.length) return '<div class="empty">Sem dados no período.</div>';
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="bar-row"' + (r.act ? ' data-act="' + r.act + '" data-id="' + esc(r.id) + '" style="cursor:pointer"' : "") + '><span>' + esc(r.label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + (max ? (r.value / max) * 100 : 0) + "%;background:" + (r.color || "var(--accent)") + '"></div></div><span class="n">' + fmt(r.value) + "</span></div>";
    }).join("") + "</div>";
  }

  // ═══════════ render root ═══════════
  function render() {
    document.documentElement.dataset.company = S.user ? (S.user.role === "admin" ? S.company : S.user.companyId) : S.company;
    var app = $("#app");
    if (!S.user) { app.innerHTML = loginView(); return; }
    app.innerHTML = S.user.role === "admin" ? adminShell() : employeeShell();
    app.insertAdjacentHTML("beforeend", S.modal ? modalView() : "");
    if (S.view === "punch") startTicker();
  }
  function go(view, params) { S.view = view; S.params = params || {}; S.modal = null; render(); window.scrollTo(0, 0); }

  // ═══════════ login ═══════════
  function loginView() {
    return '<div class="login"><form class="login-card" id="loginForm">' +
      '<div class="brand"><div class="brand-mark">' + ICON.bolt + '</div><div><div class="brand-name">Eternity Electric</div><div class="brand-sub">Eternity Electric · Blue Star HVAC</div></div></div>' +
      '<label class="field"><span>Usuário</span><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" required></label>' +
      '<label class="field"><span>Senha</span><input type="password" id="lgPass" autocomplete="current-password" required></label>' +
      '<div class="err" id="lgErr" hidden></div>' +
      '<button class="btn block" type="submit">Entrar</button>' +
      (API.mode === "demo" ? '<div class="login-hint"><b>Modo demonstração</b> (dados de exemplo)<br>Administrador: <b>bruno</b> / 1234<br>Funcionário Eternity: <b>joao</b> / 1234<br>Funcionário Blue Star: <b>pedro</b> / 1234</div>' : '<div class="login-hint">Esqueceu a senha? Peça ao administrador para criar uma nova.</div>') +
      "</form></div>";
  }

  // ═══════════ admin shell ═══════════
  var ADMIN_NAV = [["dashboard", "Painel", "dash"], ["gastos", "Gastos", "money"], ["projects", "Projetos", "folder"], ["time", "Ponto", "clock"], ["team", "Equipe", "team"], ["reports", "Relatórios", "report"]];
  function navActive(v) { var map = { project: "projects", projectForm: "projects" }; return map[v] || v; }
  function coSwitch() {
    return '<div class="co-switch" role="group" aria-label="Empresa">' + API.companies.map(function (c) {
      return '<button data-act="company" data-id="' + c.id + '" class="' + (S.company === c.id ? "on" : "") + '">' + esc(c.short) + "</button>";
    }).join("") + "</div>";
  }
  function adminShell() {
    var cur = navActive(S.view);
    var co = API.companies.find(function (c) { return c.id === S.company; });
    var side = '<aside class="sidebar"><div class="brand"><div class="brand-mark">' + (co.trade === "hvac" ? ICON.flake : ICON.bolt) + '</div><div><div class="brand-name">Eternity Electric</div><div class="brand-sub">' + (co.trade === "hvac" ? "Blue Star HVAC" : "Elétrica") + "</div></div></div>" +
      coSwitch() + '<nav class="nav">' + ADMIN_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + esc(n[1]) + "</button>"; }).join("") + "</nav>" +
      '<div class="side-foot"><span>' + esc(S.user.name) + " · Administrador</span>" + installBtn() + '<button data-act="logout">Sair</button></div></aside>';
    var top = '<header class="topbar"><div class="brand"><div class="brand-mark" style="width:30px;height:30px">' + (co.trade === "hvac" ? ICON.flake : ICON.bolt) + '</div><div class="brand-name" style="font-size:17px">Eternity Electric</div></div>' + coSwitch() + "</header>";
    var mob = '<nav class="mobile-nav">' + ADMIN_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + "<span>" + esc(n[1]) + "</span></button>"; }).join("") + "</nav>";
    var body = ({ dashboard: dashboardView, gastos: gastosView, projects: projectsView, project: projectView, projectForm: wizardView, time: timeView, team: teamView, reports: reportsView })[S.view] || dashboardView;
    return '<div class="shell">' + side + '<div class="main">' + top + demoFlag() + body() + "</div></div>" + mob;
  }
  function offlineFlag() { return S.offline ? '<div class="demo-flag">Sem internet: mostrando os dados salvos em ' + fmtDate(S.offline) + " " + fmtTime(S.offline) + ". O ponto continua funcionando e é enviado quando a conexão voltar.</div>" : ""; }
  function demoFlag() { return offlineFlag() + (API.mode === "demo" ? '<div class="demo-flag">Modo demonstração: os projetos e valores são exemplos e ficam salvos só neste aparelho. <button class="btn sm ghost" data-act="resetDemo" style="margin-left:6px">Restaurar exemplos</button></div>' : ""); }
  function installBtn() { return S.installEvt ? '<button data-act="install">Instalar o app</button>' : ""; }

  // ═══════════ filters ═══════════
  function filtersBar(opts) {
    opts = opts || {};
    var f = S.filters;
    var presets = [["all", "Desde o início"], ["today", "Hoje"], ["this_week", "Esta semana"], ["last_week", "Semana passada"], ["this_month", "Este mês"], ["last_month", "Mês passado"], ["custom", "Personalizado"]];
    var emps = S.users.filter(function (u) { return u.companyId === S.company && u.role !== "admin"; });
    return '<div class="filters">' +
      '<label class="field"><span>Período</span><select data-filter="preset">' + presets.map(function (p) { return '<option value="' + p[0] + '"' + (f.preset === p[0] ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></label>" +
      (f.preset === "custom" ? '<label class="field"><span>De</span><input type="date" data-filter="from" value="' + esc(f.from) + '"></label><label class="field"><span>Até</span><input type="date" data-filter="to" value="' + esc(f.to) + '"></label>' : "") +
      '<label class="field"><span>Projeto</span><select data-filter="projectId"><option value="">Todos os projetos</option>' + companyProjects().map(function (p) { return '<option value="' + p.id + '"' + (f.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      (opts.noUser ? "" : '<label class="field"><span>Funcionário</span><select data-filter="userId"><option value="">Todos os funcionários</option>' + emps.map(function (u) { return '<option value="' + u.id + '"' + (f.userId === u.id ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select></label>") +
      "</div>";
  }
  function periodLabel() { var f = S.filters; if (f.preset === "all") return "desde o início"; return fmtDate(f.from) + " a " + fmtDate(f.to); }

  // ═══════════ dashboard ═══════════
  function kpi(o) {
    var tag = o.act ? "button" : "div";
    return "<" + tag + ' class="kpi"' + (o.act ? ' data-act="' + o.act + '" data-id="' + (o.id || "") + '"' : "") + "><div style=\"min-width:0\">" +
      '<div class="kpi-label">' + esc(o.label) + '</div><div class="kpi-value ' + (o.cls || "") + '">' + o.value + "</div>" +
      '<div class="kpi-sub">' + o.sub + "</div>" + (o.act ? '<div class="kpi-go">Ver detalhes →</div>' : "") + "</div>" +
      ring(o.pct, 66, o.ringOpts) + "</" + tag + ">";
  }
  function dashboardView() {
    var m = metrics(), P = m.period, A = m.all, f = S.filters;
    var sel = f.projectId ? projectById(f.projectId) : null;
    var active = m.scope.filter(function (p) { return p.status === "Active"; }).length;
    var margin = P.revenue > 0 ? pct(P.profit, P.revenue) : 0;
    var tDone = 0, tAll = 0; m.scope.forEach(function (p) { (p.tasks || []).forEach(function (t) { tAll++; if (t.done) tDone++; }); });

    var banner = '<div class="proj-banner"><div class="bolt-badge">' + (tradeOf(S.company) === "hvac" ? ICON.flake : ICON.bolt) + "</div><div style=\"min-width:0\">" +
      '<div class="label">' + (sel ? "Projeto selecionado" : "Todos os projetos · " + esc(companyName(S.company))) + "</div>" +
      '<div class="pname">' + esc(sel ? sel.name : m.scope.length + " projetos") + "</div>" +
      '<div class="pmeta">' + (sel ? esc([sel.client, sel.address].filter(Boolean).join(" · ")) : "Período: " + periodLabel()) + "</div></div>" +
      '<div class="pval"><div class="label">Valor da obra</div><div class="kpi-value">' + money(m.contract) + '</div><div class="pmeta">Orçamento ' + money(m.budget) + "</div></div></div>";

    var cards = '<div class="kpis">' +
      kpi({ label: "Projetos ativos", value: active + ' <span class="muted" style="font-size:17px">de ' + m.scope.length + "</span>", sub: "projetos em andamento", pct: pct(active, m.scope.length), ringOpts: { color: "var(--accent)" }, act: "nav", id: "projects" }) +
      kpi({ label: "Horas trabalhadas", value: hrs(P.hours), cls: "v-info", sub: "das " + hrs(m.estHours) + " previstas", pct: pct(P.hours, m.estHours), act: "gastos", id: "labor" }) +
      kpi({ label: "Mão de obra", value: money(P.labor), sub: fmtPct(pct(P.labor, m.budget)) + " do orçamento", pct: pct(P.labor, m.budget), act: "gastos", id: "labor" }) +
      kpi({ label: "Despesas (material, gasolina…)", value: money(P.exp), cls: "v-bad", sub: fmtPct(pct(P.exp, m.budget)) + " do orçamento", pct: pct(P.exp, m.budget), act: "gastos", id: "all" }) +
      kpi({ label: "Custo total", value: money(P.cost), cls: "v-bad", sub: "mão de obra + despesas", pct: pct(P.cost, m.budget), act: "gastos", id: "all" }) +
      kpi({ label: "Receita recebida", value: money(P.revenue), cls: "v-good", sub: fmtPct(pct(P.revenue, m.contract)) + " do valor da obra", pct: pct(P.revenue, m.contract), ringOpts: { color: "var(--good)" }, act: "gastos", id: "receita" }) +
      kpi({ label: "Lucro bruto", value: money(P.profit), cls: P.profit >= 0 ? "v-good" : "v-bad", sub: "receita − custo total", pct: Math.abs(margin), ringOpts: { color: P.profit >= 0 ? "var(--good)" : "var(--bad)", text: fmtPct(margin) } }) +
      kpi({ label: "Tarefas concluídas", value: tDone + ' <span class="muted" style="font-size:17px">de ' + tAll + "</span>", sub: "progresso da obra", pct: pct(tDone, tAll), ringOpts: { color: "var(--info)" }, act: sel ? "openProject" : "nav", id: sel ? sel.id : "projects" }) +
      "</div>";

    // Budget (always project-to-date)
    var used = pct(A.cost, m.budget), remaining = m.budget - A.cost;
    var budget = '<div class="section-title"><h3>Orçamento e metas</h3><span class="muted small">acumulado da obra, independente do período</span></div>' +
      '<div class="budget"><div class="panel budget-ring">' +
      ring(used, 210, { stroke: 20, fontSize: 44, sub: "do orçamento", subSize: 15 }) +
      '<div class="cap">' + esc(sel ? sel.name : "Todos os projetos") + "</div>" +
      '<div class="muted">Valor da obra <b style="color:var(--ink)" class="num">' + money(m.contract) + "</b> · Orçamento <b style=\"color:var(--ink)\" class=\"num\">" + money(m.budget) + "</b></div></div>" +
      '<div class="budget-list">' +
      '<div class="panel"><div class="label">Valor da obra (contrato)</div><div class="kpi-value v-info">' + money(m.contract) + "</div></div>" +
      '<button class="panel kpi" data-act="gastos" data-id="all" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="label">Gasto até agora</div><div class="kpi-value">' + money(A.cost) + '</div><div class="kpi-sub">Mão de obra ' + money(A.labor) + " · Despesas " + money(A.exp) + '</div><div class="kpi-go">Ver gastos separados →</div></div>' + ring(used, 58) + "</button>" +
      '<div class="panel"><div class="label">Restante do orçamento</div><div class="kpi-value ' + (remaining >= 0 ? "v-good" : "v-bad") + '">' + money(remaining) + "</div></div>" +
      '<div class="panel"><div class="label">Lucro previsto (valor da obra − gasto até agora)</div><div class="kpi-value">' + money(m.contract - A.cost) + '</div><div class="kpi-sub">Recebido até agora: ' + money(A.revenue) + " (" + fmtPct(pct(A.revenue, m.contract)) + ")</div></div>" +
      "</div></div>";

    // Breakdown
    var catRows = EXPENSE_CATS.map(function (c) { return { id: c.id, label: c.label, value: P.byCat[c.id] || 0, color: c.color, act: "gastos" }; }).filter(function (r) { return r.value > 0; });
    var userRows = Object.keys(P.byUser).map(function (id) { return { id: id, label: userName(id), value: P.byUser[id].hours, color: "var(--c2)" }; }).sort(function (a, b) { return b.value - a.value; });
    var userCost = Object.keys(P.byUser).map(function (id) { return { id: id, label: userName(id), value: P.byUser[id].cost, color: "var(--c1)" }; }).sort(function (a, b) { return b.value - a.value; });
    var breakdown = '<div class="section-title"><h3>Para onde foi o dinheiro</h3><span class="muted small">' + periodLabel() + "</span></div>" +
      '<div class="grid2"><div class="panel"><h3>Gastos por categoria</h3>' + bars(catRows, money) + '</div><div class="panel"><h3>Horas por funcionário</h3>' + bars(userRows, hrs) + "</div></div>" +
      '<div class="grid2" style="margin-top:12px"><div class="panel"><h3>Custo de mão de obra por funcionário</h3>' + bars(userCost, money) + "</div>" + projectsTable() + "</div>";

    return '<div class="page-head"><div><h1>Painel</h1><p>Visão geral de projetos, mão de obra e finanças</p></div></div>' + filtersBar() + banner + cards + budget + breakdown;
  }
  function projectsTable() {
    var list = companyProjects().filter(function (p) { return p.status !== "Cancelled"; });
    return '<div class="panel" style="padding:0;overflow:hidden"><h3 style="padding:16px 16px 0">Orçamento por projeto</h3><div style="overflow-x:auto"><table><thead><tr><th>Projeto</th><th class="n">Valor</th><th class="n">Gasto</th><th class="n">Usado</th></tr></thead><tbody>' +
      list.map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="pickProject" data-id="' + p.id + '"><td>' + esc(p.name) + '</td><td class="n">' + money(s.contract) + '</td><td class="n">' + money(s.cost) + '</td><td class="n">' + ring(pct(s.cost, s.budget), 40, { stroke: 5, fontSize: 11 }) + "</td></tr>"; }).join("") +
      "</tbody></table></div></div>";
  }

  // ═══════════ gastos (expense breakdown) ═══════════
  function gastosView() {
    var m = metrics(), P = m.period, f = S.filters;
    var cat = S.gastoCat;
    var segs = EXPENSE_CATS.map(function (c) { return { id: c.id, value: P.byCat[c.id] || 0, color: c.color }; });
    var tiles = '<div class="cat-grid">' +
      '<button class="cat' + (cat === "all" ? " on" : "") + '" data-act="gastoCat" data-id="all"><span class="label">Todos os gastos</span><span class="amt">' + money(P.cost) + '</span><span class="muted small">100% · ' + periodLabel() + "</span></button>" +
      EXPENSE_CATS.map(function (c) { var v = P.byCat[c.id] || 0; return '<button class="cat' + (cat === c.id ? " on" : "") + '" data-act="gastoCat" data-id="' + c.id + '"><span class="label"><span class="swatch" style="background:' + c.color + '"></span>' + esc(c.label) + '</span><span class="amt">' + money(v) + '</span><span class="muted small">' + fmtPct(pct(v, P.cost)) + " do total" + (c.id === "labor" ? " · " + hrs(P.hours) : "") + "</span></button>"; }).join("") +
      '<button class="cat' + (cat === "receita" ? " on" : "") + '" data-act="gastoCat" data-id="receita"><span class="label"><span class="swatch" style="background:var(--good)"></span>Receita (entradas)</span><span class="amt v-good">' + money(P.revenue) + '</span><span class="muted small">pagamentos recebidos</span></button>' +
      "</div>";

    var detail;
    if (cat === "labor") {
      var rows = Object.keys(P.byUser).map(function (id) { var u = P.byUser[id]; return { id: id, name: userName(id), hours: u.hours, rate: u.hours ? u.cost / u.hours : u.rate, cost: u.cost }; }).sort(function (a, b) { return b.cost - a.cost; });
      var entries = m.T.filter(function (t) { return inPeriod(t.checkIn) && t.checkOut; });
      detail = '<div class="panel" style="padding:0"><h3 style="padding:16px 16px 0">Mão de obra por funcionário</h3><div style="overflow-x:auto"><table><thead><tr><th>Funcionário</th><th class="n">Horas</th><th class="n">Valor/hora</th><th class="n">Custo</th><th class="n">% do total</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) { return "<tr><td>" + esc(r.name) + '</td><td class="n">' + hrs(r.hours) + '</td><td class="n">' + money(r.rate, 2) + '</td><td class="n"><b>' + money(r.cost) + '</b></td><td class="n">' + fmtPct(pct(r.cost, P.labor)) + "</td></tr>"; }).join("") : '<tr><td colspan="5" class="empty">Nenhuma hora registrada no período.</td></tr>') +
        "</tbody></table></div></div>" +
        '<div class="section-title"><h3>Registros de ponto</h3><span class="muted small">' + entries.length + " registros</span></div>" + timeTable(entries.slice(0, 200), false);
    } else {
      var list = m.E.filter(function (x) { return inPeriod(x.date) && (cat === "all" ? x.kind !== "revenue" : cat === "receita" ? x.kind === "revenue" : x.kind !== "revenue" && x.category === cat); });
      var total = list.reduce(function (a, x) { return a + x.amount; }, 0);
      detail = (cat === "all" && P.labor > 0 ? '<div class="panel" style="margin-bottom:12px" data-act="gastoCat" data-id="labor"><div class="spread"><div><div class="label">Mão de obra (horas trabalhadas)</div><div class="kpi-value">' + money(P.labor) + '</div><div class="kpi-sub">' + hrs(P.hours) + ' · toque para ver por funcionário</div></div><button class="btn ghost sm" data-act="gastoCat" data-id="labor">Ver horas →</button></div></div>' : "") +
        '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Categoria</th><th>Projeto</th><th>Fornecedor / descrição</th><th>Lançado por</th><th class="n">Valor</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (x) {
          var p = projectById(x.projectId);
          return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(catLabel(x.category)) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + esc(x.vendor || "") + (x.note ? '<div class="muted small">' + esc(x.note) + "</div>" : "") + "</td><td>" + esc(userName(x.createdBy)) + '</td><td class="n"><b>' + money(x.amount, 2) + '</b></td><td class="n">' +
            (x.receipt ? '<button class="btn ghost sm" data-act="viewReceipt" data-id="' + x.id + '">Recibo</button> ' : "") + '<button class="btn ghost sm" data-act="delExpense" data-id="' + x.id + '" aria-label="Apagar">✕</button></td></tr>';
        }).join("") + '<tr><td colspan="5"><b>Total</b></td><td class="n"><b>' + money(total, 2) + "</b></td><td></td></tr>" : '<tr><td colspan="7" class="empty">Nenhum lançamento nesta categoria no período.</td></tr>') +
        "</tbody></table></div>";
    }

    return '<div class="page-head"><div><h1>Gastos</h1><p>Separados por categoria: mão de obra, material, gasolina e mais</p></div><button class="btn" data-act="newExpense">+ Novo lançamento</button></div>' +
      filtersBar({ noUser: cat !== "labor" }) +
      '<div class="split"><div class="panel donut-wrap" style="flex-direction:column;align-items:center;gap:10px">' + donut(segs, 220, money(P.cost, 0), "gasto total") +
      '<div class="muted small" style="text-align:center">' + esc(f.projectId ? (projectById(f.projectId) || {}).name : "Todos os projetos") + "<br>" + periodLabel() + "</div></div>" + tiles + "</div>" +
      '<div class="section-title"><h3>' + esc(cat === "all" ? "Todos os lançamentos" : catLabel(cat)) + "</h3></div>" + detail;
  }

  // ═══════════ projects ═══════════
  function projectsView() {
    var list = companyProjects();
    var isHvac = tradeOf(S.company) === "hvac";
    return '<div class="page-head"><div><h1>Projetos</h1><p>' + esc(companyName(S.company)) + " · " + list.length + ' projetos</p></div><button class="btn" data-act="newProject">+ Novo projeto</button></div>' +
      (list.length ? '<div class="proj-list">' + list.map(function (p) {
        var s = projectStats(p), d = p.details || {};
        return '<button class="pcard" data-act="openProject" data-id="' + p.id + '"><div class="spread"><h2>' + esc(p.name) + "</h2>" + statusPill(p.status) + "</div>" +
          '<div class="muted small">' + esc([p.client, p.address].filter(Boolean).join(" · ")) + "</div>" +
          '<div class="chips">' + [d.sector, d.workType, d.building].filter(Boolean).map(function (x) { return '<span class="pill neutral">' + esc(x) + "</span>"; }).join("") + "</div>" +
          '<div class="spread"><div style="flex:1;min-width:120px"><div class="spread small"><span class="muted">Tarefas</span><b>' + s.done + "/" + s.total + '</b></div><div class="progress"><div style="width:' + pct(s.done, s.total) + '%"></div></div></div>' +
          '<div class="row" style="gap:8px">' + ring(pct(s.cost, s.budget), 46, { stroke: 6, fontSize: 12 }) + '<div class="small"><div class="muted">Valor da obra</div><b class="num">' + money(s.contract) + "</b></div></div></div></button>";
      }).join("") + "</div>" : '<div class="panel empty">Nenhum projeto ainda. Toque em “Novo projeto” para cadastrar o primeiro ' + (isHvac ? "trabalho de HVAC" : "trabalho elétrico") + ".</div>");
  }

  function specRows(p) {
    var d = p.details || {}, trade = TRADE[tradeOf(p.companyId)];
    var rows = [["Setor", d.sector], ["Tipo de trabalho", d.workType], ["Imóvel", d.building], ["Quartos", d.bedrooms], ["Banheiros", d.bathrooms], ["Andares", d.floors], ["Área (sq ft)", d.sqft], ["Unidades", d.unitsCount || d.units],
      ["Permit", d.permit + (d.permitNo ? " · " + d.permitNo : "")], ["Paredes", d.walls], ["Ocupação", d.occupied], ["Acesso", (d.access || []).join(", ")]];
    Object.keys(trade.fields).forEach(function (k) { var v = d[k]; rows.push([trade.fields[k].label, Array.isArray(v) ? v.join(", ") : v]); });
    trade.text.forEach(function (t) { if (t.key !== "unitsCount") rows.push([t.label, d[t.key]]); });
    return rows.filter(function (r) { return r[1] && r[1] !== "undefined" && String(r[1]).trim(); });
  }

  function projectView() {
    var p = projectById(S.params.id);
    if (!p) return '<div class="panel empty">Projeto não encontrado. <button class="btn ghost sm" data-act="nav" data-id="' + (S.user.role === "admin" ? "projects" : "jobs") + '">Voltar</button></div>';
    var admin = S.user.role === "admin";
    var tab = S.params.tab || "overview";
    var tabs = [["overview", "Visão geral"], ["scope", "Escopo e tarefas"], ["files", "Plantas e arquivos (" + (p.files || []).length + ")"]];
    if (admin) { tabs.push(["money", "Financeiro"]); tabs.push(["ptime", "Ponto"]); }
    var s = projectStats(p);
    var maps = p.address ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '" target="_blank" rel="noopener">Abrir no mapa</a>' : "";
    var head = '<div class="page-head"><div style="min-width:0"><button class="btn ghost sm" data-act="nav" data-id="' + (admin ? "projects" : "jobs") + '" style="margin-bottom:10px">← ' + (admin ? "Projetos" : "Obras") + '</button>' +
      '<h1>' + esc(p.name) + '</h1><p>' + esc([p.client, p.address].filter(Boolean).join(" · ")) + (maps ? " · " + maps : "") + "</p></div>" +
      '<div class="row">' + statusPill(p.status) + (admin ? '<button class="btn ghost" data-act="editProject" data-id="' + p.id + '">Editar</button>' : "") + "</div></div>";
    var tabsHtml = '<div class="tabs">' + tabs.map(function (t) { return '<button data-act="ptab" data-id="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + esc(t[1]) + "</button>"; }).join("") + "</div>";
    var body = "";
    if (tab === "overview") {
      var specs = specRows(p);
      body = '<div class="stack">' +
        (p.teamNotes ? '<div class="panel" style="border-left:4px solid var(--accent)"><h3>Recado para a equipe</h3><div class="prose">' + esc(p.teamNotes) + "</div></div>" : "") +
        '<div class="spread"><h3>Ficha da obra</h3><span class="muted small">Início ' + fmtDate(p.startDate) + " · Previsão " + fmtDate(p.estCompletion) + "</span></div>" +
        (specs.length ? '<div class="specs">' + specs.map(function (r) { return '<div class="spec"><div class="label">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") + "</div>" : '<div class="panel empty">Sem detalhes cadastrados.</div>') +
        '<div class="panel"><div class="spread"><h3 style="margin:0">Progresso das tarefas</h3><b>' + s.done + " de " + s.total + '</b></div><div class="progress" style="margin-top:10px;height:10px"><div style="width:' + pct(s.done, s.total) + '%"></div></div></div>' +
        "</div>";
    } else if (tab === "scope") {
      var groups = {}, order = Object.keys(TRADE[tradeOf(p.companyId)].tasks).concat(["Outros"]);
      (p.tasks || []).forEach(function (t) { (groups[t.group || "Outros"] = groups[t.group || "Outros"] || []).push(t); });
      var gkeys = Object.keys(groups).sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      body = '<div class="grid2" style="align-items:start"><div class="panel"><h3>Escopo do contrato</h3><div class="prose">' + (p.scope ? esc(p.scope) : '<span class="muted">Sem escopo cadastrado.</span>') + "</div></div>" +
        '<div><div class="spread" style="margin-bottom:10px"><h3>Tarefas</h3><span class="muted small">Marque quando terminar</span></div>' +
        (gkeys.length ? gkeys.map(function (g) {
          return '<div class="check-group"><h4>' + esc(g) + "</h4>" + groups[g].map(function (t) {
            return '<label class="check' + (t.done ? " done" : "") + '"><input type="checkbox" data-act="task" data-pid="' + p.id + '" data-id="' + t.id + '"' + (t.done ? " checked" : "") + '><div><div class="t">' + esc(t.label) + "</div>" + (t.done && t.doneBy ? '<div class="by">Feito por ' + esc(t.doneBy) + " · " + fmtDate(t.doneAt) + "</div>" : "") + "</div></label>";
          }).join("") + "</div>";
        }).join("") : '<div class="panel empty">Nenhuma tarefa cadastrada.</div>') + "</div></div>";
    } else if (tab === "files") {
      body = filesBlock(p, admin);
    } else if (tab === "money" && admin) {
      var fi = S.fin[p.id] || {};
      var segs = EXPENSE_CATS.map(function (c) { var v = c.id === "labor" ? s.labor : S.expenses.filter(function (x) { return x.projectId === p.id && x.kind !== "revenue" && x.category === c.id; }).reduce(function (a, x) { return a + x.amount; }, 0); return { id: c.id, label: c.label, value: v, color: c.color }; });
      body = '<div class="kpis">' +
        kpi({ label: "Valor da obra", value: money(s.contract), sub: "contrato", pct: 100, ringOpts: { color: "var(--info)", text: "100%" } }) +
        kpi({ label: "Gasto até agora", value: money(s.cost), sub: "do orçamento de " + money(s.budget), pct: pct(s.cost, s.budget), act: "gastosFor", id: p.id }) +
        kpi({ label: "Horas", value: hrs(s.hours), sub: "de " + hrs(s.estHours) + " previstas", pct: pct(s.hours, s.estHours) }) +
        kpi({ label: "Recebido", value: money(s.revenue), cls: "v-good", sub: "do valor da obra", pct: pct(s.revenue, s.contract), ringOpts: { color: "var(--good)" } }) +
        kpi({ label: "Lucro previsto", value: money(s.contract - s.cost), sub: "valor da obra − gasto", pct: pct(s.contract - s.cost, s.contract), ringOpts: { color: "var(--good)" } }) +
        '</div><div class="split" style="margin-top:14px"><div class="panel donut-wrap">' + donut(segs, 220, money(s.cost, 0), "gasto total") + '</div><div class="panel"><h3>Gastos por categoria</h3>' + bars(segs.filter(function (x) { return x.value > 0; }).map(function (x) { return { id: x.id, label: x.label, value: x.value, color: x.color }; }), money) + "</div></div>" +
        (fi.contractValue == null ? '<p class="muted">Valores ainda não cadastrados. Use “Editar” → etapa “Valores”.</p>' : "");
    } else if (tab === "ptime" && admin) {
      body = timeTable(S.time.filter(function (t) { return t.projectId === p.id; }).slice(0, 300), true);
    }
    var danger = admin && tab === "overview" ? '<div style="margin-top:28px"><button class="btn danger sm" data-act="askDelProject" data-id="' + p.id + '">Apagar projeto</button></div>' : "";
    return head + tabsHtml + body + danger;
  }

  function filesBlock(p, canEdit) {
    var files = p.files || [];
    return (canEdit ? '<label class="drop" style="margin-bottom:14px"><input type="file" data-act="uploadFiles" data-id="' + p.id + '" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"><b>Enviar planta, desenho ou documento</b><br><span class="small">PDF, foto, Word, Excel. Toque aqui para escolher os arquivos.</span></label>' : "") +
      (files.length ? '<div class="files">' + files.map(function (f) {
        var isImg = /^image\//.test(f.mime || ""), ext = (f.name.split(".").pop() || "").toUpperCase().slice(0, 4);
        return '<div class="file"><div class="thumb" data-thumb="' + f.id + '">' + (isImg ? "IMG" : esc(ext)) + '</div><div class="fname">' + esc(f.name) + '</div><div class="muted small">' + (f.size ? (f.size / 1048576).toFixed(1) + " MB · " : "") + fmtDate(f.createdAt) + "</div>" +
          '<div class="row"><button class="btn sm" data-act="openFile" data-pid="' + p.id + '" data-id="' + f.id + '">Abrir</button>' + (canEdit ? '<button class="btn ghost sm" data-act="delFile" data-pid="' + p.id + '" data-id="' + f.id + '">Apagar</button>' : "") + "</div></div>";
      }).join("") + "</div>" : '<div class="panel empty">Nenhuma planta enviada ainda.</div>');
  }

  // ═══════════ project wizard ═══════════
  function blankProject() {
    return { id: null, companyId: S.company, name: "", client: "", address: "", lat: null, lng: null, radius: 150, status: "Active", startDate: todayISO(), estCompletion: "", details: { access: [], wiring: [], extras: [], equipment: [] }, scope: "", teamNotes: "", tasks: [], fin: { contractValue: "", budget: "", estHours: "" } };
  }
  function wizSteps() { var t = TRADE[tradeOf(S.draft.companyId)]; return ["Obra", "Tipo", "Condições", t.stepName, "Tarefas", "Escopo e plantas", "Valores"]; }
  function chooser(path, def, multi) {
    var v = get(S.draft, path);
    return '<div class="opt-block"><span class="label">' + esc(def.label) + '</span><div class="chips">' + def.opts.map(function (o) {
      var on = multi ? (v || []).indexOf(o) >= 0 : v === o;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-act="' + (multi ? "toggleOpt" : "pickOpt") + '" data-path="' + path + '" data-val="' + esc(o) + '">' + esc(o) + "</button>";
    }).join("") + "</div></div>";
  }
  function inputF(path, label, type, attrs) {
    var v = get(S.draft, path);
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" id="w-' + path.replace(/\./g, "-") + '" data-bind="' + path + '" value="' + esc(v == null ? "" : v) + '" ' + (attrs || "") + "></label>";
  }
  function wizardView() {
    var d = S.draft, step = S.wizStep, steps = wizSteps(), trade = TRADE[tradeOf(d.companyId)], body = "";
    if (step === 0) {
      body = '<div class="stack">' + inputF("name", "Nome do projeto (ex.: 53 Mason St — Unidade 2)") + '<div class="grid2">' + inputF("client", "Cliente / GC") +
        '<label class="field"><span>Status</span><select data-bind="status" id="w-status">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (d.status === k ? " selected" : "") + ">" + STATUS[k][0] + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="row" style="align-items:flex-end">' + '<div style="flex:1 1 260px">' + inputF("address", "Endereço da obra") + '</div><button type="button" class="btn ghost" data-act="geocode">Buscar no mapa</button></div>' +
        '<div class="muted small" id="geoStatus">' + (d.lat ? "Localização: " + Number(d.lat).toFixed(5) + ", " + Number(d.lng).toFixed(5) + " — usada para detectar a obra quando o funcionário bate o ponto." : "Busque o endereço para o app reconhecer a obra pelo GPS do funcionário.") + "</div>" +
        '<div class="grid4 keep2">' + inputF("lat", "Latitude", "number", 'step="any"') + inputF("lng", "Longitude", "number", 'step="any"') + inputF("radius", "Raio do ponto (metros)", "number") + "</div>" +
        '<div class="grid2">' + inputF("startDate", "Início", "date") + inputF("estCompletion", "Previsão de término", "date") + "</div></div>";
    } else if (step === 1) {
      var res = d.details.sector === "Residencial" || d.details.sector === "Multifamily" || !d.details.sector;
      body = '<div class="stack">' + chooser("details.sector", COMMON_FIELDS.sector) + chooser("details.workType", { label: "Tipo de trabalho", opts: trade.workType }) +
        chooser("details.building", res ? COMMON_FIELDS.buildingRes : COMMON_FIELDS.buildingCom) +
        (res ? chooser("details.bedrooms", COMMON_FIELDS.bedrooms) + chooser("details.bathrooms", COMMON_FIELDS.bathrooms) : "") +
        chooser("details.floors", COMMON_FIELDS.floors) +
        '<div class="grid2">' + inputF("details.sqft", "Área (sq ft)", "number") + inputF("details.unitsCount", "Unidades (se for multifamily)", "number") + "</div></div>";
    } else if (step === 2) {
      body = '<div class="stack">' + chooser("details.permit", COMMON_FIELDS.permit) + inputF("details.permitNo", "Nº do permit / cidade") +
        chooser("details.walls", COMMON_FIELDS.walls) + chooser("details.occupied", COMMON_FIELDS.occupied) + chooser("details.access", COMMON_FIELDS.access, true) + "</div>";
    } else if (step === 3) {
      body = '<div class="stack">' + Object.keys(trade.fields).map(function (k) { return chooser("details." + k, trade.fields[k], trade.fields[k].multi); }).join("") +
        '<div class="grid2">' + trade.text.filter(function (t) { return t.key !== "unitsCount"; }).map(function (t) { return inputF("details." + t.key, t.label); }).join("") + "</div></div>";
    } else if (step === 4) {
      var have = {}; d.tasks.forEach(function (t) { have[t.group + "|" + t.label] = true; });
      var custom = d.tasks.filter(function (t) { return !(trade.tasks[t.group] && trade.tasks[t.group].indexOf(t.label) >= 0); });
      body = '<div class="spread" style="margin-bottom:12px"><p class="muted" style="margin:0;max-width:60ch">Toque nas tarefas que fazem parte deste trabalho. A equipe vê esta lista e marca o que for terminando.</p><button type="button" class="btn ghost sm" data-act="suggestTasks">Sugerir pela ficha da obra</button></div><div class="stack task-picker">' +
        Object.keys(trade.tasks).map(function (g) {
          return '<div class="opt-block"><span class="label">' + esc(g) + '</span><div class="chips">' + trade.tasks[g].map(function (l) { var on = have[g + "|" + l]; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-act="toggleTask" data-group="' + esc(g) + '" data-val="' + esc(l) + '">' + (on ? "✓ " : "") + esc(l) + "</button>"; }).join("") + "</div></div>";
        }).join("") +
        '<div class="panel"><h3>Tarefa personalizada</h3><div class="row"><input type="text" id="customTask" placeholder="Ex.: Mover painel para a garagem" style="flex:1 1 220px"><select id="customGroup" style="width:auto">' + Object.keys(trade.tasks).concat(["Outros"]).map(function (g) { return "<option>" + esc(g) + "</option>"; }).join("") + '</select><button type="button" class="btn" data-act="addTask">Adicionar</button></div>' +
        (custom.length ? '<div class="chips" style="margin-top:10px">' + custom.map(function (t) { return '<button type="button" class="chip on" data-act="toggleTask" data-group="' + esc(t.group) + '" data-val="' + esc(t.label) + '">✕ ' + esc(t.label) + "</button>"; }).join("") + "</div>" : "") + "</div>" +
        '<div class="muted small">' + d.tasks.length + " tarefas selecionadas</div></div>";
    } else if (step === 5) {
      body = '<div class="stack"><label class="field"><span>Escopo do contrato (cole aqui o escopo que o contrato passa)</span><textarea id="w-scope" data-bind="scope" style="min-height:200px">' + esc(d.scope) + "</textarea></label>" +
        '<label class="field"><span>Recado para a equipe (chave, horários, cuidados, material)</span><textarea id="w-teamNotes" data-bind="teamNotes">' + esc(d.teamNotes) + "</textarea></label>" +
        '<div><span class="label">Plantas e documentos</span>' +
        '<label class="drop" style="margin-top:6px"><input type="file" data-act="wizFiles" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"><b>Escolher plantas / PDFs</b><br><span class="small">Os arquivos são enviados quando você salvar o projeto</span></label>' +
        (S.draftFiles.length ? '<div class="chips" style="margin-top:8px">' + S.draftFiles.map(function (f, i) { return '<button type="button" class="chip" data-act="rmDraftFile" data-id="' + i + '">✕ ' + esc(f.name) + "</button>"; }).join("") + "</div>" : "") +
        (d.id && (projectById(d.id) || {}).files && projectById(d.id).files.length ? '<div class="muted small" style="margin-top:6px">Já enviados: ' + projectById(d.id).files.map(function (f) { return esc(f.name); }).join(", ") + "</div>" : "") +
        "</div></div>";
    } else if (step === 6) {
      body = '<div class="stack"><p class="muted" style="margin:0">Só o administrador vê estes valores. Os funcionários nunca veem preço, orçamento ou lucro.</p>' +
        '<div class="grid3">' + inputF("fin.contractValue", "Valor da obra (contrato) $", "number", 'step="0.01" inputmode="decimal"') + inputF("fin.budget", "Orçamento de custo $", "number", 'step="0.01" inputmode="decimal"') + inputF("fin.estHours", "Horas previstas", "number", 'inputmode="decimal"') + "</div>" +
        '<div class="panel"><h3>Resumo</h3><div class="specs">' +
        [["Projeto", d.name || "—"], ["Tipo", [d.details.sector, d.details.workType].filter(Boolean).join(" · ") || "—"], ["Tarefas", d.tasks.length], ["Arquivos para enviar", S.draftFiles.length], ["Lucro previsto", money((Number(d.fin.contractValue) || 0) - (Number(d.fin.budget) || 0))]].map(function (r) { return '<div class="spec"><div class="label">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") +
        "</div></div></div>";
    }
    return '<div class="page-head"><div><button class="btn ghost sm" data-act="cancelWizard" style="margin-bottom:10px">← Cancelar</button><h1>' + (d.id ? "Editar projeto" : "Novo projeto") + "</h1><p>" + esc(companyName(d.companyId)) + "</p></div></div>" +
      '<div class="steps">' + steps.map(function (s, i) { return '<button data-act="wizGo" data-id="' + i + '" class="' + (i === step ? "on" : i < step ? "done" : "") + '">' + (i + 1) + ". " + esc(s) + "</button>"; }).join("") + "</div>" +
      '<div class="panel">' + body + '<div class="err" id="wizErr" hidden></div></div>' +
      '<div class="wiz-foot"><button class="btn ghost" data-act="wizGo" data-id="' + Math.max(0, step - 1) + '"' + (step === 0 ? " disabled" : "") + ">← Voltar</button>" +
      '<div class="row">' + (step < steps.length - 1 ? '<button class="btn ghost" data-act="saveProject">Salvar</button><button class="btn" data-act="wizGo" data-id="' + (step + 1) + '">Próximo →</button>' : '<button class="btn" data-act="saveProject">Salvar projeto</button>') + "</div></div>";
  }

  // ═══════════ time (admin) ═══════════
  function timeTable(list, withCost) {
    return '<div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Projeto</th><th>Data</th><th>Entrada</th><th>Saída</th><th class="n">Horas</th>' + (withCost ? '<th class="n">Custo</th>' : "") + "<th>Fotos</th><th>GPS</th>" + (S.user.role === "admin" ? "<th></th>" : "") + "</tr></thead><tbody>" +
      (list.length ? list.map(function (t) {
        var p = projectById(t.projectId), h = hoursOf(t);
        var gps = t.inLoc && t.inLoc.ok ? '<span class="pill good">ok</span>' : '<span class="pill warn">sem GPS</span>';
        return "<tr><td>" + esc(userName(t.userId)) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + fmtDate(t.checkIn) + "</td><td>" + fmtTime(t.checkIn) + "</td><td>" + (t.checkOut ? fmtTime(t.checkOut) : '<span class="pill good">trabalhando</span>') + '</td><td class="n">' + (t.checkOut ? hrs(h) : "—") + "</td>" +
          (withCost ? '<td class="n">' + money(h * (t.rate || 0)) + "</td>" : "") +
          "<td>" + (t.inPhoto || t.outPhoto ? '<button class="btn ghost sm" data-act="viewPunch" data-id="' + t.id + '">Ver</button>' : '<span class="muted">—</span>') + "</td><td>" + gps + "</td>" +
          (S.user.role === "admin" ? '<td><button class="btn ghost sm" data-act="editTime" data-id="' + t.id + '">Corrigir</button></td>' : "") + "</tr>";
      }).join("") : '<tr><td colspan="10" class="empty">Nenhum registro.</td></tr>') + "</tbody></table></div>";
  }
  function timeView() {
    var f = S.filters;
    var list = S.time.filter(function (t) { return t.companyId === S.company && inPeriod(t.checkIn) && (!f.projectId || t.projectId === f.projectId) && (!f.userId || t.userId === f.userId); });
    var now = S.time.filter(function (t) { return t.companyId === S.company && !t.checkOut; });
    var tot = list.reduce(function (a, t) { return a + hoursOf(t); }, 0), cost = list.reduce(function (a, t) { return a + hoursOf(t) * (t.rate || 0); }, 0);
    return '<div class="page-head"><div><h1>Registro de ponto</h1><p>Entradas e saídas com foto e GPS</p></div></div>' + filtersBar() +
      '<div class="grid3 keep2" style="margin-bottom:14px"><div class="panel"><div class="label">Trabalhando agora</div><div class="kpi-value v-good">' + now.length + '</div><div class="kpi-sub">' + (now.map(function (t) { return esc(userName(t.userId)); }).join(", ") || "ninguém") + '</div></div><div class="panel"><div class="label">Horas no período</div><div class="kpi-value v-info">' + hrs(tot) + '</div></div><div class="panel"><div class="label">Custo no período</div><div class="kpi-value">' + money(cost) + "</div></div></div>" +
      timeTable(list.slice(0, 400), true);
  }

  // ═══════════ team ═══════════
  function teamView() {
    var list = S.users.filter(function (u) { return u.companyId === S.company || u.role === "admin"; });
    return '<div class="page-head"><div><h1>Equipe</h1><p>' + esc(companyName(S.company)) + '</p></div><button class="btn" data-act="newUser">+ Novo funcionário</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th>Empresa</th><th class="n">Valor/hora</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (u) {
        return "<tr><td><b>" + esc(u.name) + "</b></td><td>" + esc(u.username) + "</td><td>" + (u.role === "admin" ? "Administrador" : "Funcionário") + "</td><td>" + esc(companyName(u.companyId)) + '</td><td class="n">' + (u.role === "admin" ? "—" : money(u.rate, 2)) + "</td><td>" + (u.active ? '<span class="pill good">Ativo</span>' : '<span class="pill neutral">Inativo</span>') + '</td><td><button class="btn ghost sm" data-act="editUser" data-id="' + u.id + '">Editar</button></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  // ═══════════ reports ═══════════
  function reportsView() {
    var f = S.filters;
    var emps = S.users.filter(function (u) { return u.companyId === S.company && u.role !== "admin"; });
    var payroll = emps.map(function (u) { var l = S.time.filter(function (t) { return t.userId === u.id && inPeriod(t.checkIn) && t.checkOut; }); var h = l.reduce(function (a, t) { return a + hoursOf(t); }, 0); return { u: u, days: l.length, h: h, cost: l.reduce(function (a, t) { return a + hoursOf(t) * (t.rate || 0); }, 0) }; });
    return '<div class="page-head"><div><h1>Relatórios</h1><p>Folha de horas e lucratividade por projeto</p></div></div>' + filtersBar({ noUser: true }) +
      '<div class="section-title"><h3>Folha de horas · ' + periodLabel() + '</h3><button class="btn ghost sm" data-act="csv" data-id="payroll">Baixar CSV</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Valor/hora</th><th class="n">Total a pagar</th></tr></thead><tbody>' +
      payroll.map(function (r) { return "<tr><td>" + esc(r.u.name) + '</td><td class="n">' + r.days + '</td><td class="n">' + hrs(r.h) + '</td><td class="n">' + money(r.u.rate, 2) + '</td><td class="n"><b>' + money(r.cost, 2) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="section-title"><h3>Lucratividade por projeto (acumulado)</h3><button class="btn ghost sm" data-act="csv" data-id="profit">Baixar CSV</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Projeto</th><th>Status</th><th class="n">Valor da obra</th><th class="n">Mão de obra</th><th class="n">Despesas</th><th class="n">Gasto total</th><th class="n">Recebido</th><th class="n">Lucro previsto</th></tr></thead><tbody>' +
      companyProjects().map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="openProject" data-id="' + p.id + '"><td>' + esc(p.name) + "</td><td>" + statusPill(p.status) + '</td><td class="n">' + money(s.contract) + '</td><td class="n">' + money(s.labor) + '</td><td class="n">' + money(s.exp) + '</td><td class="n">' + money(s.cost) + '</td><td class="n">' + money(s.revenue) + '</td><td class="n"><b class="' + (s.contract - s.cost >= 0 ? "v-good" : "v-bad") + '">' + money(s.contract - s.cost) + "</b></td></tr>"; }).join("") +
      "</tbody></table></div>";
  }
  function csv(kind) {
    var rows;
    if (kind === "payroll") {
      rows = [["Funcionário", "Data", "Projeto", "Entrada", "Saída", "Horas", "Valor/hora", "Total"]];
      S.time.filter(function (t) { return t.companyId === S.company && inPeriod(t.checkIn) && t.checkOut; }).forEach(function (t) { var h = hoursOf(t), p = projectById(t.projectId); rows.push([userName(t.userId), fmtDate(t.checkIn), p ? p.name : "", fmtTime(t.checkIn), fmtTime(t.checkOut), h.toFixed(2), t.rate, (h * t.rate).toFixed(2)]); });
    } else {
      rows = [["Projeto", "Status", "Valor da obra", "Orçamento", "Mão de obra", "Despesas", "Gasto total", "Recebido", "Lucro previsto"]];
      companyProjects().forEach(function (p) { var s = projectStats(p); rows.push([p.name, p.status, s.contract, s.budget, s.labor.toFixed(2), s.exp.toFixed(2), s.cost.toFixed(2), s.revenue.toFixed(2), (s.contract - s.cost).toFixed(2)]); });
    }
    var text = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" }));
    a.download = (kind === "payroll" ? "folha-de-horas" : "lucratividade") + "-" + todayISO() + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Arquivo CSV gerado.");
  }

  // ═══════════ employee shell ═══════════
  var EMP_NAV = [["punch", "Ponto", "clock"], ["jobs", "Obras", "folder"], ["myexp", "Gastos", "receipt"], ["me", "Perfil", "user"]];
  function employeeShell() {
    var cur = S.view === "project" ? "jobs" : S.view;
    var co = API.companies.find(function (c) { return c.id === S.user.companyId; }) || API.companies[0];
    var side = '<aside class="sidebar"><div class="brand"><div class="brand-mark">' + (co.trade === "hvac" ? ICON.flake : ICON.bolt) + '</div><div><div class="brand-name">Eternity Electric</div><div class="brand-sub">' + (co.trade === "hvac" ? "Blue Star HVAC" : "Elétrica") + '</div></div></div><nav class="nav">' +
      EMP_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + esc(n[1]) + "</button>"; }).join("") + '</nav><div class="side-foot"><span>' + esc(S.user.name) + "</span>" + installBtn() + '<button data-act="logout">Sair</button></div></aside>';
    var top = '<header class="topbar"><div class="brand"><div class="brand-mark" style="width:30px;height:30px">' + (co.trade === "hvac" ? ICON.flake : ICON.bolt) + '</div><div><div class="brand-name" style="font-size:17px">Eternity Electric</div><div class="brand-sub">' + (co.trade === "hvac" ? "Blue Star HVAC" : "Elétrica") + "</div></div></div></header>";
    var mob = '<nav class="mobile-nav">' + EMP_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + "<span>" + esc(n[1]) + "</span></button>"; }).join("") + "</nav>";
    var body = ({ punch: punchView, jobs: jobsView, project: projectView, myexp: myExpView, me: meView })[S.view] || punchView;
    return '<div class="shell">' + side + '<div class="main">' + top + offlineFlag() + (API.mode === "demo" ? '<div class="demo-flag">Modo demonstração — dados de exemplo.</div>' : "") + body() + "</div></div>" + mob;
  }

  function nearest() {
    if (!S.loc || !S.loc.ok) return null;
    var best = null;
    S.projects.forEach(function (p) {
      if (p.lat == null || p.lng == null || p.status === "Completed" || p.status === "Cancelled") return;
      var d = dist(S.loc.lat, S.loc.lng, p.lat, p.lng);
      if (!best || d < best.d) best = { p: p, d: d };
    });
    return best;
  }
  function dist(a, b, c, d) { var R = 6371000, toR = Math.PI / 180, dLat = (c - a) * toR, dLng = (d - b) * toR; var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return 2 * R * Math.asin(Math.sqrt(x)); }

  function punchView() {
    var open = S.open, jobs = S.projects.filter(function (p) { return p.status === "Active" || p.status === "Planned"; });
    var near = nearest(), autoId = near && near.d <= (near.p.radius || 150) ? near.p.id : "";
    if (!S.params.projectId && autoId) S.params.projectId = autoId;
    var locLine = !S.loc ? '<div class="loc-bad">Buscando sua localização…</div>' : S.loc.ok ? (near ? '<div class="' + (autoId ? "loc-ok" : "loc-bad") + '">' + (autoId ? "Você está na obra: " + esc(near.p.name) : "Obra mais próxima: " + esc(near.p.name) + " (" + (near.d > 1000 ? (near.d / 1000).toFixed(1) + " km" : Math.round(near.d) + " m") + ")") + "</div>" : '<div class="loc-ok">Localização ok</div>') : '<div class="loc-bad">Localização indisponível. Ative o GPS para o ponto ficar completo.</div>';
    var mine = S.time.filter(function (t) { return t.userId === S.user.id; });
    var weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    var weekH = mine.filter(function (t) { return new Date(t.checkIn) >= weekStart; }).reduce(function (a, t) { return a + hoursOf(t); }, 0);
    var card;
    if (open) {
      var p = projectById(open.projectId);
      card = '<div class="clock-card"><div class="label">Trabalhando desde ' + fmtTime(open.checkIn) + (p ? " · " + esc(p.name) : "") + '</div><div class="time" id="ticker">00:00:00</div>' + locLine +
        '<button class="clock-btn out" data-act="punch" data-id="out">Bater saída</button><div class="label" style="text-transform:none;letter-spacing:0">O app vai pedir uma selfie e a localização.</div></div>';
    } else {
      card = '<div class="clock-card"><div class="label">' + new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) + '</div><div class="time" id="ticker">' + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "</div>" + locLine +
        '<label class="field" style="text-align:left"><span style="color:var(--nav-ink)">Obra</span><select id="punchProject" data-act="punchProject">' + '<option value="">Selecione a obra</option>' + jobs.map(function (j) { return '<option value="' + j.id + '"' + (S.params.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
        '<button class="clock-btn in" data-act="punch" data-id="in">Bater entrada</button><div class="label" style="text-transform:none;letter-spacing:0">O app vai pedir uma selfie e a localização.</div></div>';
    }
    var pend = API.pendingPunches ? API.pendingPunches() : 0;
    return '<div class="page-head"><div><h1>Olá, ' + esc(S.user.name.split(" ")[0]) + "</h1><p>" + esc(companyName(S.user.companyId)) + "</p></div></div>" +
      (pend ? '<div class="demo-flag">' + pend + " ponto(s) salvos sem internet. Serão enviados quando a conexão voltar.</div>" : "") +
      '<input type="file" id="selfie" accept="image/*" capture="user" hidden>' + card +
      '<div class="grid2" style="margin-top:14px"><div class="panel"><div class="label">Horas nesta semana</div><div class="kpi-value v-info">' + hrs(weekH) + '</div></div><div class="panel"><div class="label">Dias trabalhados (30 dias)</div><div class="kpi-value">' + mine.filter(function (t) { return (Date.now() - new Date(t.checkIn)) < 30 * 864e5; }).length + "</div></div></div>" +
      '<div class="section-title"><h3>Meus registros</h3></div><div class="table-wrap"><table><thead><tr><th>Dia e obra</th><th>Horário</th><th class="n">Horas</th></tr></thead><tbody>' +
      (mine.length ? mine.slice(0, 20).map(function (t) { var p = projectById(t.projectId); return "<tr><td><b>" + fmtDate(t.checkIn) + '</b><div class="muted small">' + esc(p ? p.name : "—") + "</div></td><td>" + fmtTime(t.checkIn) + " – " + (t.checkOut ? fmtTime(t.checkOut) : "agora") + '</td><td class="n">' + (t.checkOut ? hrs(hoursOf(t)) : "—") + "</td></tr>"; }).join("") : '<tr><td colspan="3" class="empty">Nenhum registro ainda.</td></tr>') +
      "</tbody></table></div>";
  }
  var tick = null;
  function startTicker() {
    clearInterval(tick);
    tick = setInterval(function () {
      var el = $("#ticker"); if (!el) { clearInterval(tick); return; }
      if (S.open) { var s = Math.max(0, Math.floor((Date.now() - new Date(S.open.checkIn)) / 1000)); el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(function (n) { return String(n).padStart(2, "0"); }).join(":"); }
      else el.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }, 1000);
  }

  function jobsView() {
    var list = S.projects.filter(function (p) { return p.status !== "Cancelled"; });
    return '<div class="page-head"><div><h1>Obras</h1><p>O que vai ser feito em cada trabalho</p></div></div>' +
      (list.length ? '<div class="proj-list">' + list.map(function (p) {
        var s = projectStats(p), d = p.details || {};
        return '<button class="pcard" data-act="openProject" data-id="' + p.id + '"><div class="spread"><h2>' + esc(p.name) + "</h2>" + statusPill(p.status) + '</div><div class="muted small">' + esc(p.address || "") + '</div><div class="chips">' +
          [d.sector, d.workType, d.building, d.permit ? "Permit: " + d.permit : ""].filter(Boolean).map(function (x) { return '<span class="pill neutral">' + esc(x) + "</span>"; }).join("") +
          '</div><div><div class="spread small"><span class="muted">Tarefas feitas</span><b>' + s.done + "/" + s.total + '</b></div><div class="progress"><div style="width:' + pct(s.done, s.total) + '%"></div></div></div></button>';
      }).join("") + "</div>" : '<div class="panel empty">Nenhuma obra ativa no momento.</div>');
  }

  function myExpView() {
    var mine = S.expenses.filter(function (x) { return x.createdBy === S.user.id; });
    var jobs = S.projects.filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed"; });
    return '<div class="page-head"><div><h1>Gastos</h1><p>Lance gasolina, material comprado e outras despesas da obra</p></div></div>' +
      '<form class="panel stack" id="empExpForm">' + expenseFields(jobs, false) + '<button class="btn block" type="submit">Enviar gasto</button></form>' +
      '<div class="section-title"><h3>Meus lançamentos</h3></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Obra</th><th class="n">Valor</th></tr></thead><tbody>' +
      (mine.length ? mine.slice(0, 30).map(function (x) { var p = projectById(x.projectId); return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(catLabel(x.category)) + "</td><td>" + esc(p ? p.name : "—") + '</td><td class="n">' + money(x.amount, 2) + "</td></tr>"; }).join("") : '<tr><td colspan="4" class="empty">Nenhum gasto lançado.</td></tr>') +
      "</tbody></table></div>";
  }
  function expenseFields(jobs, admin) {
    var cats = EXPENSE_CATS.filter(function (c) { return c.id !== "labor" && (admin || ["gasolina", "material", "equipamento", "outros"].indexOf(c.id) >= 0); });
    return (admin ? '<label class="field"><span>Tipo</span><select id="xKind"><option value="expense">Despesa (saída)</option><option value="revenue">Receita (pagamento recebido)</option></select></label>' : "") +
      '<div class="grid2"><label class="field"><span>Categoria</span><select id="xCat">' + cats.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Valor $</span><input type="number" id="xAmt" step="0.01" inputmode="decimal" required></label></div>' +
      '<div class="grid2"><label class="field"><span>Obra</span><select id="xProj"><option value="">Sem obra específica</option>' + jobs.map(function (j) { return '<option value="' + j.id + '"' + (S.filters.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Data</span><input type="date" id="xDate" value="' + todayISO() + '" required></label></div>' +
      '<label class="field"><span>Fornecedor / descrição</span><input type="text" id="xVendor" placeholder="Ex.: Home Depot, Shell"></label>' +
      '<label class="field"><span>Foto do recibo (opcional)</span><input type="file" id="xReceipt" accept="image/*" capture="environment"></label>';
  }

  function meView() {
    return '<div class="page-head"><div><h1>Perfil</h1></div></div><div class="panel stack"><div><div class="label">Nome</div><div class="kpi-value">' + esc(S.user.name) + '</div></div><div><div class="label">Empresa</div><div>' + esc(companyName(S.user.companyId)) + '</div></div><div><div class="label">Usuário</div><div>' + esc(S.user.username) + "</div></div>" +
      installHelp() + '<button class="btn ghost" data-act="logout">Sair</button></div>';
  }
  function installHelp() {
    return '<div class="panel" style="background:var(--surface-2)"><h3>Instalar no celular</h3>' + (S.installEvt ? '<button class="btn" data-act="install" style="margin-top:6px">Instalar o app</button>' : '<div class="small">iPhone: abra no Safari → botão Compartilhar → “Adicionar à Tela de Início”.<br>Android: menu ⋮ do Chrome → “Instalar app”.</div>') + "</div>";
  }

  // ═══════════ modals ═══════════
  function modalView() {
    var m = S.modal, inner = "";
    if (m.type === "expense") {
      inner = '<form id="admExpForm" class="stack">' + expenseFields(companyProjects(), true) + '<label class="field"><span>Observação</span><input type="text" id="xNote"></label><button class="btn" type="submit">Salvar lançamento</button></form>';
    } else if (m.type === "user") {
      var u = m.user || { name: "", username: "", role: "employee", companyId: S.company, rate: "", active: true };
      inner = '<form id="userForm" class="stack"><label class="field"><span>Nome completo</span><input type="text" id="uName" value="' + esc(u.name) + '" required></label>' +
        '<div class="grid2"><label class="field"><span>Usuário (login)</span><input type="text" id="uUser" value="' + esc(u.username) + '" autocapitalize="none" ' + (u.id ? "disabled" : "required") + '></label><label class="field"><span>' + (u.id ? "Nova senha (deixe vazio para manter)" : "Senha inicial") + '</span><input type="text" id="uPass" ' + (u.id ? "" : 'required minlength="6"') + "></label></div>" +
        '<div class="grid3"><label class="field"><span>Empresa</span><select id="uCo">' + API.companies.map(function (c) { return '<option value="' + c.id + '"' + (u.companyId === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + '</select></label><label class="field"><span>Função</span><select id="uRole"><option value="employee"' + (u.role !== "admin" ? " selected" : "") + '>Funcionário</option><option value="admin"' + (u.role === "admin" ? " selected" : "") + '>Administrador</option></select></label><label class="field"><span>Valor/hora $</span><input type="number" id="uRate" step="0.01" value="' + esc(u.rate) + '"></label></div>' +
        (u.id ? '<label class="row"><input type="checkbox" id="uActive"' + (u.active ? " checked" : "") + "> Ativo (pode entrar no app)</label>" : "") +
        '<div class="err" id="uErr" hidden></div><button class="btn" type="submit">' + (u.id ? "Salvar" : "Criar funcionário") + "</button></form>";
    } else if (m.type === "time") {
      var t = S.time.find(function (x) { return x.id === m.id; });
      var loc = function (iso) { if (!iso) return ""; var d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
      inner = '<form id="timeForm" class="stack"><div class="muted">' + esc(userName(t.userId)) + '</div><label class="field"><span>Obra</span><select id="tProj"><option value="">—</option>' + companyProjects().map(function (p) { return '<option value="' + p.id + '"' + (t.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
        '<div class="grid2"><label class="field"><span>Entrada</span><input type="datetime-local" id="tIn" value="' + loc(t.checkIn) + '"></label><label class="field"><span>Saída</span><input type="datetime-local" id="tOut" value="' + loc(t.checkOut) + '"></label></div><button class="btn" type="submit">Salvar correção</button></form>';
    } else if (m.type === "image") {
      inner = m.urls.length ? '<div class="grid2">' + m.urls.map(function (u) { return '<div><div class="label">' + esc(u[0]) + '</div><img src="' + esc(u[1]) + '" alt="' + esc(u[0]) + '" style="border-radius:10px;margin-top:6px"></div>'; }).join("") + "</div>" : '<div class="empty">Sem imagem.</div>';
    } else if (m.type === "confirm") {
      inner = '<p>' + esc(m.text) + '</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="' + m.act + '" data-id="' + m.id + '">' + esc(m.okLabel || "Confirmar") + "</button></div>";
    }
    return '<div class="modal-bg" data-act="modalBg"><div class="modal" role="dialog" aria-modal="true"><div class="spread"><h2>' + esc(m.title) + '</h2><button class="x" data-act="closeModal" aria-label="Fechar">×</button></div>' + inner + "</div></div>";
  }

  // ═══════════ image helpers ═══════════
  function compress(file, max) {
    max = max || 900;
    return new Promise(function (res) {
      if (!file || !/^image\//.test(file.type)) return res(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.72);
      };
      img.onerror = function () { res(file); };
      img.src = url;
    });
  }
  function getLoc(timeout) {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res({ ok: false });
      var done = false;
      setTimeout(function () { if (!done) { done = true; res({ ok: false }); } }, (timeout || 9000) + 500);
      try {
        navigator.geolocation.getCurrentPosition(function (p) { if (done) return; done = true; res({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
          function () { if (done) return; done = true; res({ ok: false }); }, { enableHighAccuracy: true, timeout: timeout || 9000, maximumAge: 30000 });
      } catch (e) { done = true; res({ ok: false }); }
    });
  }

  // ═══════════ actions ═══════════
  function refresh() { return loadData().then(render).catch(function (e) { toast(e.message || "Erro ao carregar."); }); }
  var A = {
    nav: function (el) { var v = el.dataset.id; if (v === "dashboard" || v === "gastos") S.gastoCat = S.gastoCat || "all"; go(v); if (v === "punch") locate(); },
    company: function (el) { S.company = el.dataset.id; storeSet("ee_company", S.company); S.filters.projectId = ""; S.filters.userId = ""; if (S.view === "project" || S.view === "projectForm") S.view = "projects"; refresh(); },
    logout: function () { API.signOut().then(function () { S.user = null; S.view = "dashboard"; render(); }); },
    resetDemo: function () { API.reset().then(function () { S.user = null; render(); toast("Exemplos restaurados. Entre novamente."); }); },
    install: function () { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; render(); } },
    gastos: function (el) { S.gastoCat = el.dataset.id || "all"; go("gastos"); },
    gastosFor: function (el) { S.filters.projectId = el.dataset.id; S.gastoCat = "all"; go("gastos"); },
    gastoCat: function (el) { S.gastoCat = el.dataset.id; render(); },
    pickProject: function (el) { S.filters.projectId = el.dataset.id; render(); window.scrollTo(0, 0); },
    openProject: function (el) { go("project", { id: el.dataset.id, tab: "overview" }); },
    ptab: function (el) { S.params.tab = el.dataset.id; render(); },
    newProject: function () { S.draft = blankProject(); S.draftFiles = []; S.wizStep = 0; go("projectForm"); },
    editProject: function (el) {
      var p = projectById(el.dataset.id), fi = S.fin[p.id] || {};
      S.draft = JSON.parse(JSON.stringify(p)); S.draft.fin = { contractValue: fi.contractValue || "", budget: fi.budget || "", estHours: fi.estHours || "" };
      ["access", "wiring", "extras", "equipment"].forEach(function (k) { if (!Array.isArray(S.draft.details[k])) S.draft.details[k] = S.draft.details[k] ? [S.draft.details[k]] : []; });
      S.draftFiles = []; S.wizStep = 0; go("projectForm");
    },
    cancelWizard: function () { var id = S.draft && S.draft.id; S.draft = null; if (id) go("project", { id: id }); else go("projects"); },
    wizGo: function (el) { S.wizStep = Number(el.dataset.id); render(); window.scrollTo(0, 0); },
    pickOpt: function (el) { var p = el.dataset.path, v = el.dataset.val; set(S.draft, p, get(S.draft, p) === v ? "" : v); render(); },
    toggleOpt: function (el) { var p = el.dataset.path, v = el.dataset.val, arr = (get(S.draft, p) || []).slice(), i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); set(S.draft, p, arr); render(); },
    toggleTask: function (el) { var g = el.dataset.group, l = el.dataset.val, i = S.draft.tasks.findIndex(function (t) { return t.group === g && t.label === l; }); if (i >= 0) S.draft.tasks.splice(i, 1); else S.draft.tasks.push({ id: null, group: g, label: l, done: false }); render(); },
    addTask: function () { var l = $("#customTask").value.trim(), g = $("#customGroup").value; if (!l) return; S.draft.tasks.push({ id: null, group: g, label: l, done: false }); render(); },
    suggestTasks: function () {
      var d = S.draft.details || {}, hv = tradeOf(S.draft.companyId) === "hvac", add = [];
      var has = function (arr, v) { return (arr || []).indexOf(v) >= 0; };
      var newish = /New Construction|Addition|Sistema novo/.test(d.workType || "") || /Abertas|Parcial/.test(d.walls || "");
      if (!hv) {
        if (d.serviceType && d.serviceType !== "Sem mudança no serviço") { add.push(["Serviço", "Upgrade / instalação de serviço"], ["Serviço", "Aterramento (ground rods / bonding)"], ["Serviço", "Coordenação com a concessionária"]); if (/Novo|Upgrade/.test(d.serviceType)) add.push(["Serviço", "Meter socket"], ["Serviço", "Troca de painel"]); if (/Troca de painel/.test(d.serviceType)) add.push(["Serviço", "Troca de painel"]); if (/Subpainel/.test(d.serviceType)) add.push(["Serviço", "Subpainel"]); add.push(["Inspeções", "Inspeção de serviço"]); }
        if (newish) { add.push(["Rough-in", "Rough-in elétrico"], ["Rough-in", "Caixas e furação"], ["Rough-in", "Detectores de fumaça / CO"], ["Acabamento", "Instalar tomadas e interruptores"], ["Acabamento", "Instalar luminárias"], ["Acabamento", "Tampas e placas"], ["Acabamento", "Identificar circuitos do painel"], ["Inspeções", "Inspeção rough"]);
          if (d.bedrooms) add.push(["Rough-in", "Circuitos AFCI dos quartos"]); if (d.bathrooms) add.push(["Rough-in", "Circuito do banheiro (GFCI)"], ["Rough-in", "Exaustor de banheiro"]); if (/Residencial|Multifamily/.test(d.sector || "")) add.push(["Rough-in", "Circuitos dedicados da cozinha"], ["Rough-in", "Circuito 240V (secadora / fogão)"]); }
        else if (/Remodel|Reparo/.test(d.workType || "")) add.push(["Acabamento", "Trocar tomadas"], ["Acabamento", "Trocar interruptores"]);
        if (has(d.extras, "Carregador EV")) add.push(["Rough-in", "Carregador EV"]);
        if (has(d.extras, "Gerador / transfer switch")) add.push(["Rough-in", "Gerador / transfer switch"]);
        if (has(d.extras, "Circuitos de mini-split")) add.push(["Rough-in", "Circuito da condensadora (HVAC)"]);
        if (d.lowVoltage === "Sim") add.push(["Rough-in", "Low voltage (dados / TV)"]);
        if (d.fireAlarm === "Sim") add.push(["Rough-in", "Fire alarm — rough"], ["Acabamento", "Fire alarm — dispositivos e teste"], ["Inspeções", "Inspeção de fire alarm"]);
        if (d.fireAlarm === "Só detectores interligados") add.push(["Rough-in", "Detectores de fumaça / CO"]);
      } else {
        var eq = d.equipment || [];
        if (/Substituição/.test(d.workType || "")) add.push(["Remoção", "Remover equipamento antigo"], ["Remoção", "Recuperar refrigerante"], ["Remoção", "Descarte de equipamento"]);
        if (eq.some(function (x) { return /Heat pump|Mini-split|Central AC/.test(x); })) add.push(["Equipamento", "Instalar condensadora / heat pump"], ["Equipamento", "Pad / suporte da condensadora"], ["Distribuição", "Line set"], ["Distribuição", "Dreno / bomba de condensado"], ["Comissionamento", "Teste de pressão (nitrogênio)"], ["Comissionamento", "Vácuo"], ["Comissionamento", "Carga de refrigerante"]);
        if (eq.some(function (x) { return /ductless|Mini-split/.test(x); })) add.push(["Equipamento", "Instalar evaporadoras (mini-split)"]);
        if (has(eq, "Air handler") || has(eq, "Heat pump ducted")) add.push(["Equipamento", "Instalar air handler"]);
        if (eq.some(function (x) { return /Fornalha/.test(x); })) add.push(["Equipamento", "Instalar fornalha (furnace)"], ["Distribuição", "Ventilação / exaustão (flue)"]);
        if (has(eq, "Caldeira (boiler)")) add.push(["Equipamento", "Instalar caldeira (boiler)"], ["Distribuição", "Ventilação / exaustão (flue)"]);
        if (/novos/.test(d.ducts || "")) add.push(["Distribuição", "Dutos novos (sheet metal)"], ["Distribuição", "Registros supply / return"]);
        if (/existentes/.test(d.ducts || "")) add.push(["Distribuição", "Isolamento e vedação de dutos"]);
        if (d.gasPiping === "Sim") add.push(["Distribuição", "Tubulação de gás"], ["Inspeções", "Inspeção de gás"]);
        if (Number(d.zones) > 1 || d.zones === "5+") add.push(["Controles", "Zoneamento"]);
        add.push(["Controles", "Termostatos"], ["Comissionamento", "Start-up e teste"]);
        if (d.manualJ === "A fazer") add.push(["Comissionamento", "Manual J / cálculo de carga"]);
        if (/Mass Save/.test(d.rebate || "")) add.push(["Comissionamento", "Documentação Mass Save"]);
      }
      if (/Sim/.test(d.permit || "")) add.push([hv ? "Inspeções" : "Inspeções", hv ? "Permit mecânico" : "Inspeção final"]);
      if (hv && /Sim/.test(d.permit || "")) add.push(["Inspeções", "Inspeção final"]);
      var n = 0;
      add.forEach(function (a) { if (!S.draft.tasks.some(function (t) { return t.group === a[0] && t.label === a[1]; })) { S.draft.tasks.push({ id: null, group: a[0], label: a[1], done: false }); n++; } });
      render(); toast(n ? n + " tarefas sugeridas adicionadas. Revise a lista." : "Preencha as etapas Tipo, Condições e " + (hv ? "HVAC" : "Elétrica") + " para receber sugestões.");
    },
    rmDraftFile: function (el) { S.draftFiles.splice(Number(el.dataset.id), 1); render(); },
    geocode: function () {
      var addr = S.draft.address, st = $("#geoStatus");
      if (!addr) { st.textContent = "Digite o endereço primeiro."; return; }
      st.textContent = "Buscando…";
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" + encodeURIComponent(addr), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d.length) { st.textContent = "Endereço não encontrado. Confira ou preencha latitude/longitude manualmente."; return; } S.draft.lat = Number(d[0].lat); S.draft.lng = Number(d[0].lon); render(); toast("Localização encontrada."); })
        .catch(function () { st.textContent = "Não foi possível buscar agora. Preencha latitude/longitude manualmente (Google Maps → clique no ponto)."; });
    },
    saveProject: function () {
      var d = S.draft, err = $("#wizErr");
      if (!d.name.trim()) { S.wizStep = 0; render(); var e2 = $("#wizErr"); e2.textContent = "Dê um nome ao projeto."; e2.hidden = false; return; }
      var fin = d.fin, files = S.draftFiles.slice(), proj = JSON.parse(JSON.stringify(d)); delete proj.fin;
      proj.lat = proj.lat === "" || proj.lat == null ? null : Number(proj.lat); proj.lng = proj.lng === "" || proj.lng == null ? null : Number(proj.lng);
      toast("Salvando…");
      API.saveProject(proj).then(function (saved) {
        return API.saveFinancials(saved.id, fin).then(function () {
          return files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(saved.id, f); }); }, Promise.resolve());
        }).then(function () { return saved; });
      }).then(function (saved) { S.draft = null; S.draftFiles = []; return loadData().then(function () { go("project", { id: saved.id, tab: "overview" }); toast("Projeto salvo."); }); })
        .catch(function (e) { if (err) { err.textContent = e.message || "Erro ao salvar."; err.hidden = false; } });
    },
    askDelProject: function (el) { var p = projectById(el.dataset.id); S.modal = { type: "confirm", title: "Apagar projeto", text: "Apagar “" + p.name + "”? As tarefas e plantas deste projeto também serão apagadas. Os registros de ponto e gastos continuam salvos.", act: "delProject", id: p.id, okLabel: "Apagar" }; render(); },
    delProject: function (el) { API.deleteProject(el.dataset.id).then(function () { S.modal = null; return loadData(); }).then(function () { go("projects"); toast("Projeto apagado."); }); },
    task: function (el) {
      var done = el.checked;
      API.setTaskDone(el.dataset.pid, el.dataset.id, done, S.user.name).then(function () {
        var p = projectById(el.dataset.pid), t = p.tasks.find(function (x) { return x.id === el.dataset.id; });
        if (t) { t.done = done; t.doneBy = done ? S.user.name : null; t.doneAt = done ? new Date().toISOString() : null; }
        render();
      }).catch(function (e) { el.checked = !done; toast(e.message); });
    },
    openFile: function (el) {
      var p = projectById(el.dataset.pid), f = (p.files || []).find(function (x) { return x.id === el.dataset.id; });
      API.fileUrl(f).then(function (u) {
        if (!u) { toast("Arquivo indisponível neste aparelho."); return; }
        var a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; if (/^blob:/.test(u)) a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      });
    },
    delFile: function (el) { API.deleteFile(el.dataset.pid, el.dataset.id).then(refresh).then(function () { toast("Arquivo apagado."); }); },
    newExpense: function () { S.modal = { type: "expense", title: "Novo lançamento" }; render(); },
    delExpense: function (el) { S.modal = { type: "confirm", title: "Apagar lançamento", text: "Apagar este lançamento de gasto? Isso não pode ser desfeito.", act: "delExpenseOk", id: el.dataset.id, okLabel: "Apagar" }; render(); },
    delExpenseOk: function (el) { API.deleteExpense(el.dataset.id).then(function () { S.modal = null; return refresh(); }).then(function () { toast("Lançamento apagado."); }); },
    viewReceipt: function (el) { var x = S.expenses.find(function (e) { return e.id === el.dataset.id; }); API.photoUrl(x.receipt, "receipts").then(function (u) { S.modal = { type: "image", title: "Recibo", urls: u ? [["Recibo", u]] : [] }; render(); }); },
    viewPunch: function (el) {
      var t = S.time.find(function (x) { return x.id === el.dataset.id; });
      Promise.all([API.photoUrl(t.inPhoto), API.photoUrl(t.outPhoto)]).then(function (u) {
        var urls = []; if (u[0]) urls.push(["Entrada " + fmtTime(t.checkIn), u[0]]); if (u[1]) urls.push(["Saída " + fmtTime(t.checkOut), u[1]]);
        S.modal = { type: "image", title: userName(t.userId) + " · " + fmtDate(t.checkIn), urls: urls }; render();
      });
    },
    editTime: function (el) { S.modal = { type: "time", title: "Corrigir ponto", id: el.dataset.id }; render(); },
    newUser: function () { S.modal = { type: "user", title: "Novo funcionário" }; render(); },
    editUser: function (el) { S.modal = { type: "user", title: "Editar funcionário", user: userById(el.dataset.id) }; render(); },
    closeModal: function () { S.modal = null; render(); },
    modalBg: function (el, ev) { if (ev.target === el) { S.modal = null; render(); } },
    csv: function (el) { csv(el.dataset.id); },
    punch: function (el) {
      var kind = el.dataset.id;
      if (kind === "in" && !S.params.projectId) { var sel = $("#punchProject"); if (sel && sel.value) S.params.projectId = sel.value; }
      if (kind === "in" && !S.params.projectId) { toast("Escolha a obra antes de bater a entrada."); return; }
      S.pendingPunch = kind;
      var inp = $("#selfie"); inp.value = ""; inp.click();
    }
  };

  function locate() { S.loc = null; getLoc(9000).then(function (l) { S.loc = l; if (S.view === "punch") render(); }); }

  function doPunch(file) {
    var kind = S.pendingPunch;
    toast("Registrando ponto…");
    Promise.all([compress(file, 640), S.loc && S.loc.ok ? Promise.resolve(S.loc) : getLoc(8000)]).then(function (r) {
      var loc = r[1]; S.loc = loc;
      var o = { photo: r[0], loc: loc, projectId: S.params.projectId };
      return kind === "in" ? API.clockIn(o) : API.clockOut(o);
    }).then(function (rec) {
      if (rec && rec.offline) { toast("Sem internet: ponto salvo no aparelho e será enviado depois."); S.open = kind === "in" ? { checkIn: rec.checkIn, projectId: S.params.projectId } : null; render(); return; }
      toast(kind === "in" ? "Entrada registrada às " + fmtTime(rec.checkIn) : "Saída registrada às " + fmtTime(rec.checkOut) + " · " + hrs(hoursOf(rec)));
      return API.openShift(S.user.id).then(function (o) { S.open = o; }).catch(function () { S.open = kind === "in" ? rec : null; }).then(function () { return loadData(); }).then(render);
    }).catch(function (e) { toast(e.message || "Erro ao registrar ponto."); });
  }

  // ═══════════ events ═══════════
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]");
    if (!el) return;
    var act = el.dataset.act;
    if (el.tagName === "INPUT" || el.tagName === "SELECT") return; // handled on change
    if (A[act]) { if (el.tagName === "A") return; ev.preventDefault(); A[act](el, ev); }
  });
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    if (el.dataset.filter) {
      S.filters[el.dataset.filter] = el.value;
      if (el.dataset.filter === "preset") { if (el.value === "custom" && !S.filters.from) { S.filters.preset = "this_month"; applyPreset(); S.filters.preset = "custom"; } else applyPreset(); }
      render(); return;
    }
    if (el.dataset.bind && S.draft) { set(S.draft, el.dataset.bind, el.value); if (el.tagName === "SELECT") render(); return; }
    if (el.dataset.act === "task") { A.task(el); return; }
    if (el.dataset.act === "punchProject") { S.params.projectId = el.value; return; }
    if (el.id === "selfie" && el.files[0]) { doPunch(el.files[0]); return; }
    if (el.dataset.act === "wizFiles") { S.draftFiles = S.draftFiles.concat([].slice.call(el.files)); render(); return; }
    if (el.dataset.act === "uploadFiles") {
      var files = [].slice.call(el.files), pid = el.dataset.id;
      toast("Enviando " + files.length + " arquivo(s)…");
      files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(pid, f); }); }, Promise.resolve())
        .then(refresh).then(function () { toast("Arquivos enviados."); }).catch(function (e) { toast(e.message || "Erro ao enviar."); });
    }
  });
  document.addEventListener("input", function (ev) { var el = ev.target; if (el.dataset.bind && S.draft && el.tagName !== "SELECT") set(S.draft, el.dataset.bind, el.value); });
  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (f.id === "loginForm") {
      var err = $("#lgErr"); err.hidden = true;
      API.signIn($("#lgUser").value, $("#lgPass").value).then(afterLogin).catch(function (e) { err.textContent = e.message; err.hidden = false; });
    } else if (f.id === "admExpForm" || f.id === "empExpForm") {
      var amt = Number($("#xAmt").value);
      if (!(amt > 0)) { toast("Informe um valor maior que zero."); return; }
      var kind = $("#xKind") ? $("#xKind").value : "expense";
      compress($("#xReceipt").files[0], 1200).then(function (rc) {
        return API.addExpense({ companyId: S.user.role === "admin" ? S.company : S.user.companyId, kind: kind, category: kind === "revenue" ? "receita" : $("#xCat").value, amount: amt, projectId: $("#xProj").value, date: $("#xDate").value, vendor: $("#xVendor").value, note: $("#xNote") ? $("#xNote").value : "", receipt: rc || null });
      }).then(function () { S.modal = null; return refresh(); }).then(function () { toast("Lançamento salvo."); }).catch(function (e) { toast(e.message || "Erro ao salvar."); });
    } else if (f.id === "userForm") {
      var u = S.modal.user, ue = $("#uErr");
      var data = { name: $("#uName").value.trim(), companyId: $("#uCo").value, role: $("#uRole").value, rate: $("#uRate").value, password: $("#uPass").value };
      var p = u ? API.updateUser(u.id, Object.assign(data, { active: $("#uActive").checked, password: data.password || undefined })) : API.createUser(Object.assign(data, { username: $("#uUser").value }));
      p.then(function () { S.modal = null; return refresh(); }).then(function () { toast(u ? "Funcionário atualizado." : "Funcionário criado. Passe o usuário e a senha para ele."); }).catch(function (e) { ue.textContent = e.message; ue.hidden = false; });
    } else if (f.id === "timeForm") {
      var tin = $("#tIn").value, tout = $("#tOut").value;
      if (tout && tin && tout <= tin) { toast("A saída precisa ser depois da entrada."); return; }
      API.updateTime(S.modal.id, { projectId: $("#tProj").value || null, checkIn: tin ? new Date(tin).toISOString() : undefined, checkOut: tout ? new Date(tout).toISOString() : null })
        .then(function () { S.modal = null; return refresh(); }).then(function () { toast("Ponto corrigido."); });
    }
  });

  function localOpenShift() {
    var q = API.pendingQueue ? API.pendingQueue() : [], last = q[q.length - 1];
    if (last) return last.kind === "in" ? { checkIn: last.at, projectId: last.projectId } : null;
    return S.time.find(function (t) { return t.userId === S.user.id && !t.checkOut; }) || null;
  }
  window.addEventListener("online", function () { if (S.user) setTimeout(function () { loadData().then(function () { return S.user.role !== "admin" ? API.openShift(S.user.id).then(function (o) { S.open = o; }).catch(function () {}) : null; }).then(render).catch(function () {}); }, 4000); });
  function afterLogin(user) {
    S.user = user;
    if (user.role !== "admin") { S.company = user.companyId; S.view = "punch"; } else { S.view = "dashboard"; }
    applyPreset();
    return loadData().then(function () { return user.role !== "admin" ? API.openShift(user.id).then(function (o) { S.open = o; }).catch(function () { S.open = localOpenShift(); }) : null; }).then(function () { render(); if (user.role !== "admin") locate(); });
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); S.installEvt = e; if (S.user) render(); });
  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
    try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
  }

  // boot
  $("#app").innerHTML = '<div class="login"><div class="brand"><div class="brand-mark">' + ICON.bolt + '</div><div class="brand-name">Eternity Electric</div></div></div>';
  API.init().then(function () { return API.session(); }).then(function (u) { if (u) return afterLogin(u); render(); })
    .catch(function (e) { $("#app").innerHTML = '<div class="login"><div class="login-card"><div class="brand-name">Eternity Electric</div><div class="err">' + esc(e.message || "Erro ao iniciar.") + "</div></div></div>"; });
})();
