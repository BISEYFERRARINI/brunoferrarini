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
  var EXT = { views: {}, actions: {}, nav: [], load: [], submit: {}, change: [], input: [] };

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
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4M9 12h6M9 16h6M9 8h2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5 12.5 20z"/><circle cx="8" cy="8" r="1.6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>'
  };

  // ═══════════ catalog (electrical / HVAC) ═══════════
  // Despesas da obra (as mesmas opções da aba Notas). Mão de obra = horas trabalhadas (calculada pelo ponto).
  var EXPENSE_CATS = [
    { id: "material", label: "Material", color: "var(--c1)" },
    { id: "permit", label: "Permit", color: "var(--c3)" },
    { id: "equipamento", label: "Equipamento / aluguel", color: "var(--c7)" },
    { id: "outros", label: "Outros", color: "var(--c6)" }
  ];
  var LEGACY_CATS = { gasolina: "Gasolina", subcontractor: "Subempreiteiro", receita: "Receita", labor: "Mão de obra" };
  function catKey(id) { return EXPENSE_CATS.some(function (c) { return c.id === id; }) ? id : "outros"; }
  function catLabel(id) { var c = EXPENSE_CATS.find(function (x) { return x.id === id; }); return c ? c.label : (LEGACY_CATS[id] || id); }
  var STATUS = { Active: ["Em andamento", "good"], Planned: ["A começar", "accent"], "On Hold": ["Em espera", "warn"], Completed: ["Concluído", "neutral"], Cancelled: ["Cancelado", "bad"] };
  function statusPill(s) { var x = STATUS[s] || [s, "neutral"]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }

  var COMMON_FIELDS = {
    sector: { label: "Tipo", opts: ["Residencial", "Comercial"] },
    buildingRes: { label: "Residencial", opts: ["Single family", "Two-family", "Multifamily"] },
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
      workType: ["New Construction", "Remodel / Renovação", "Addition (ampliação)", "Service upgrade", "Reparo / service call", "Fire alarm"],
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
  var APPCO = API.companies[0], BRAND = APPCO.name, BRAND_ICON = '<img src="icons/mark-' + APPCO.id + '.png" alt="">';
  function tradeOf(companyId) { var c = API.companies.find(function (x) { return x.id === companyId; }); return c ? c.trade : "electrical"; }
  function companyName(id) { var c = API.companies.find(function (x) { return x.id === id; }); return c ? c.name : id; }

  // ═══════════ state ═══════════
  var S = {
    user: null, company: APPCO.id, view: "dashboard", params: {},
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
    var jobs = [API.listProjects(co), API.listTime({ companyId: isAdmin ? co : null }), API.listExpenses({ companyId: isAdmin ? co : null }), API.listNotices ? API.listNotices().catch(function () { return []; }) : Promise.resolve([])];
    if (isAdmin) { jobs.push(API.getFinancials()); jobs.push(API.listUsers()); }
    var CK = "ee_cache_" + S.user.id + "_" + co;
    return Promise.all(jobs).then(function (r) {
      S.projects = r[0]; S.time = r[1]; S.expenses = r[2]; S.notices = (r[3] || []).filter(function (n) { return n.companyId === co; });
      if (isAdmin) { S.fin = r[4] || {}; S.users = r[5] || []; checkNewNotices(); }
      S.offline = false;
      if (isAdmin) return Promise.all(EXT.load.map(function (f) { return f(co).catch(function () {}); }));
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

  function checkNewNotices() {
    var seen = storeGet("ee_notice_seen") || "", fresh = (S.notices || []).filter(function (n) { return !n.resolved && n.createdAt > seen; });
    if (fresh.length && S.view !== "avisos") setTimeout(function () { toast(fresh.length === 1 ? "Aviso novo de " + (fresh[0].authorName || "funcionário") + ": " + fresh[0].text.slice(0, 80) : fresh.length + " avisos novos da equipe. Veja em Avisos."); }, 900);
  }
  function markNoticesSeen() { var last = (S.notices || []).reduce(function (a, n) { return n.createdAt > a ? n.createdAt : a; }, ""); if (last) storeSet("ee_notice_seen", last); }

  // ═══════════ metrics ═══════════
  function inPeriod(iso) { var f = S.filters; if (!iso) return false; var d = isoLocal(new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso)); return (!f.from || d >= f.from) && (!f.to || d <= f.to); }
  function metrics() {
    var f = S.filters;
    var scope = companyProjects().filter(function (p) { return f.projectId ? p.id === f.projectId : p.status !== "Cancelled"; });
    var ids = {}; scope.forEach(function (p) { ids[p.id] = true; });
    var inScope = function (pid) { return f.projectId ? pid === f.projectId : (pid ? !!ids[pid] : true); };
    var T = S.time.filter(function (t) { return t.companyId === S.company && inScope(t.projectId) && (!f.userId || t.userId === f.userId); });
    var E = S.expenses.filter(function (x) { return x.companyId === S.company && inScope(x.projectId); });
    var m = { scope: scope, contract: 0, budget: 0, matBudget: 0, labBudget: 0, estHours: 0, period: blank(), all: blank(), T: T, E: E };
    scope.forEach(function (p) { var fi = S.fin[p.id] || {}; m.contract += fi.contractValue || 0; m.budget += fi.budget || 0; m.matBudget += fi.materialBudget || 0; m.labBudget += fi.laborBudget || 0; m.estHours += fi.estHours || 0; });
    function blank() { var o = { hours: 0, labor: 0, revenue: 0, exp: 0, byCat: {}, byUser: {} }; EXPENSE_CATS.forEach(function (c) { o.byCat[c.id] = 0; }); return o; }
    function addT(o, t) { var h = hoursOf(t); o.hours += h; o.labor += h * (t.rate || 0); var u = o.byUser[t.userId] || (o.byUser[t.userId] = { hours: 0, cost: 0, rate: t.rate }); u.hours += h; u.cost += h * (t.rate || 0); }
    function addE(o, x) { if (x.kind === "revenue") o.revenue += x.amount; else { o.exp += x.amount; o.byCat[catKey(x.category)] += x.amount; } }
    T.forEach(function (t) { addT(m.all, t); if (inPeriod(t.checkIn)) addT(m.period, t); });
    E.forEach(function (x) { addE(m.all, x); if (inPeriod(x.date)) addE(m.period, x); });
    [m.period, m.all].forEach(function (o) { o.cost = o.labor + o.exp; o.profit = o.revenue - o.cost; });
    var tDone = 0, tAll = 0; scope.forEach(function (p) { (p.tasks || []).forEach(function (t) { tAll++; if (t.done) tDone++; }); });
    m.tDone = tDone; m.tAll = tAll;
    return m;
  }
  function projectStats(p) {
    var fi = S.fin[p.id] || {}, labor = 0, exp = 0, hours = 0, rev = 0, mat = 0;
    S.time.forEach(function (t) { if (t.projectId === p.id) { var h = hoursOf(t); hours += h; labor += h * (t.rate || 0); } });
    S.expenses.forEach(function (x) { if (x.projectId === p.id) { if (x.kind === "revenue") rev += x.amount; else { exp += x.amount; if (x.category === "material") mat += x.amount; } } });
    var done = (p.tasks || []).filter(function (t) { return t.done; }).length, total = (p.tasks || []).length;
    return { contract: fi.contractValue || 0, budget: fi.budget || 0, matBudget: fi.materialBudget || 0, labBudget: fi.laborBudget || 0, estHours: fi.estHours || 0, labor: labor, exp: exp, material: mat, cost: labor + exp, hours: hours, revenue: rev, done: done, total: total, progress: pct(done, total) };
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
  function setupView() {
    return '<div class="login"><form class="login-card" id="setupForm">' +
      '<div class="brand"><div class="brand-mark">' + BRAND_ICON + '</div><div><div class="brand-name">' + esc(BRAND) + '</div><div class="brand-sub">Primeiro acesso</div></div></div>' +
      '<div class="login-hint">Banco de dados novo. Crie agora o login do administrador (você). Os funcionários você cadastra depois, dentro do app.</div>' +
      '<label class="field"><span>Seu nome</span><input type="text" id="suName" required></label>' +
      '<label class="field"><span>Usuário (para entrar)</span><input type="text" id="suUser" autocapitalize="none" autocomplete="username" required placeholder="ex.: bruno"></label>' +
      '<label class="field"><span>Senha (mínimo 6)</span><input type="password" id="suPass" autocomplete="new-password" minlength="6" required></label>' +
      '<div class="err" id="suErr" hidden></div><button class="btn block" type="submit">Criar administrador e entrar</button></form></div>';
  }
  function loginView() {
    if (S.setup) return setupView();
    return '<div class="login"><form class="login-card" id="loginForm">' +
      '<div class="brand"><div class="brand-mark">' + BRAND_ICON + '</div><div><div class="brand-name">' + esc(BRAND) + '</div><div class="brand-sub">Gestão de obras</div></div></div>' +
      '<label class="field"><span>Usuário</span><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" required></label>' +
      '<label class="field"><span>Senha</span><input type="password" id="lgPass" autocomplete="current-password" required></label>' +
      '<div class="err" id="lgErr" hidden></div>' +
      '<button class="btn block" type="submit">Entrar</button>' +
      (API.mode === "demo" ? '<div class="login-hint"><b>Modo demonstração</b> (dados de exemplo)<br>Administrador: <b>bruno</b> / 1234<br>Funcionário: <b>' + (S.company === "bluestar" ? "pedro" : "joao") + '</b> / 1234</div>' : '<div class="login-hint">Esqueceu a senha? Peça ao administrador para criar uma nova.</div>') +
      "</form></div>";
  }

  // ═══════════ admin shell ═══════════
  var ADMIN_NAV_BASE = [["dashboard", "Painel", "dash"], ["agenda", "Agenda", "calendar"], ["gastos", "Despesas", "money"], ["projects", "Projetos", "folder"], ["escala", "Escala", "pin"], ["proposals", "Propostas", "doc"], ["notas", "Notas", "receipt"], ["avisos", "Avisos", "bell"], ["prices", "Preços", "tag"], ["time", "Ponto", "clock"], ["team", "Equipe", "team"], ["reports", "Relatórios", "report"]];
  var ADMIN_NAV = ADMIN_NAV_BASE;
  function navActive(v) { var map = { project: "projects", projectForm: "projects", proposalForm: "proposals", hours: "dashboard" }; if (S.user && S.user.role !== "admin" && v === "project") return "jobs"; return map[v] || v; }
  function navLabel(n) { var c = n[0] === "avisos" ? openNotices().length : 0; return esc(n[1]) + (c ? ' <span class="nav-badge">' + c + "</span>" : ""); }
  function coSwitch() { return ""; } // app só da Eternity
  function adminShell() {
    var cur = navActive(S.view);
    var co = API.companies.find(function (c) { return c.id === S.company; });
    var side = '<aside class="sidebar"><div class="brand"><div class="brand-mark">' + BRAND_ICON + '</div><div><div class="brand-name">' + esc(BRAND) + '</div><div class="brand-sub">' + (co.trade === "hvac" ? "HVAC" : "Elétrica") + "</div></div></div>" +
      coSwitch() + '<nav class="nav">' + ADMIN_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + navLabel(n) + "</button>"; }).join("") + "</nav>" +
      '<div class="side-foot"><span>' + esc(S.user.name) + " · Administrador</span>" + installBtn() + '<button data-act="logout">Sair</button></div></aside>';
    var top = '<header class="topbar"><div class="brand"><div class="brand-mark" style="width:30px;height:30px">' + BRAND_ICON + '</div><div class="brand-name" style="font-size:17px">' + esc(BRAND) + '</div></div>' + coSwitch() + "</header>";
    var mob = '<nav class="mobile-nav">' + ADMIN_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + "<span>" + navLabel(n) + "</span></button>"; }).join("") + "</nav>";
    var body = Object.assign({ dashboard: dashboardView, gastos: gastosView, hours: hoursView, notas: notasView, avisos: avisosView, agenda: agendaView, escala: escalaView, projects: projectsView, project: projectView, projectForm: wizardView, time: timeView, team: teamView, reports: reportsView }, EXT.views)[S.view] || dashboardView;
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
  function limitLine(spent, limit) { return limit > 0 ? fmtPct(pct(spent, limit)) + " do limite de " + money(limit) : "sem limite definido"; }
  function dashboardView() {
    var m = metrics(), P = m.period, A = m.all, f = S.filters;
    var sel = f.projectId ? projectById(f.projectId) : null;
    var margin = P.revenue > 0 ? pct(P.profit, P.revenue) : 0;
    var progress = pct(m.tDone, m.tAll);

    var banner = '<div class="proj-banner"><div class="bolt-badge">' + BRAND_ICON + "</div><div style=\"min-width:0\">" +
      '<div class="label">' + (sel ? "Projeto selecionado" : "Todos os projetos") + "</div>" +
      '<div class="pname">' + esc(sel ? sel.name : m.scope.length + " projetos") + "</div>" +
      '<div class="pmeta">' + (sel ? esc([sel.client, sel.address].filter(Boolean).join(" · ")) : "Período: " + periodLabel()) + "</div></div>" +
      '<div class="pval"><div class="label">Orçamento</div><div class="kpi-value">' + money(m.contract) + '</div><div class="pmeta">Limite de gastos ' + money(m.budget) + "</div></div></div>";

    var hoursRing = m.labBudget > 0 ? pct(P.labor, m.labBudget) : pct(P.hours, m.estHours);
    var cards = '<div class="kpis">' +
      kpi({ label: "Horas trabalhadas", value: hrs(P.hours), cls: "v-info", sub: "Mão de obra " + money(P.labor) + " · " + (m.labBudget > 0 ? limitLine(P.labor, m.labBudget) : "das " + hrs(m.estHours) + " previstas"), pct: hoursRing, act: "hours" }) +
      kpi({ label: "Material", value: money(P.byCat.material), sub: limitLine(P.byCat.material, m.matBudget), pct: pct(P.byCat.material, m.matBudget), act: "gastos", id: "material" }) +
      kpi({ label: "Despesas", value: money(P.exp), cls: "v-bad", sub: "material, permit, equipamento e outros", pct: pct(P.exp, m.contract), ringOpts: { color: "var(--c1)" }, act: "gastos", id: "material" }) +
      kpi({ label: "Custo total", value: money(P.cost), cls: "v-bad", sub: "mão de obra + despesas · " + limitLine(P.cost, m.budget), pct: pct(P.cost, m.budget) }) +
      kpi({ label: "Receita recebida", value: money(P.revenue), cls: "v-good", sub: fmtPct(pct(P.revenue, m.contract)) + " do orçamento", pct: pct(P.revenue, m.contract), ringOpts: { color: "var(--good)" } }) +
      kpi({ label: "Lucro bruto", value: money(P.profit), cls: P.profit >= 0 ? "v-good" : "v-bad", sub: "receita − custo total", pct: Math.abs(margin), ringOpts: { color: P.profit >= 0 ? "var(--good)" : "var(--bad)", text: fmtPct(margin) } }) +
      kpi({ label: "Progresso da obra", value: fmtPct(progress), sub: m.tDone + " de " + m.tAll + " tarefas concluídas", pct: progress, ringOpts: { color: "var(--info)" }, act: sel ? "openProject" : "nav", id: sel ? sel.id : "projects" }) +
      "</div>";

    // Limites (sempre acumulado da obra)
    var used = pct(A.cost, m.budget), remaining = m.budget - A.cost;
    var mini = function (label, spent, limit, act, id) {
      return '<' + (act ? 'button data-act="' + act + '" data-id="' + (id || "") + '"' : "div") + ' class="panel kpi" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="label">' + label + '</div><div class="kpi-value">' + money(spent) + '</div><div class="kpi-sub">' + (limit > 0 ? "de " + money(limit) + " · restam " + money(limit - spent) : "defina o limite em Editar → Valores") + "</div></div>" + ring(pct(spent, limit), 58) + "</" + (act ? "button" : "div") + ">";
    };
    var budget = '<div class="section-title"><h3>Orçamento e limites de gasto</h3><span class="muted small">acumulado da obra, independente do período</span></div>' +
      '<div class="budget"><div class="panel budget-ring">' +
      ring(used, 210, { stroke: 20, fontSize: 44, sub: "do limite de gastos", subSize: 15 }) +
      '<div class="cap">' + esc(sel ? sel.name : "Todos os projetos") + "</div>" +
      '<div class="muted">Orçamento <b style="color:var(--ink)" class="num">' + money(m.contract) + '</b> · Limite de gastos <b style="color:var(--ink)" class="num">' + money(m.budget) + "</b></div></div>" +
      '<div class="budget-list">' +
      mini("Material gasto", A.byCat.material, m.matBudget, "gastos", "material") +
      mini("Mão de obra (horas)", A.labor, m.labBudget, "hours") +
      '<div class="panel"><div class="label">Restante do limite de gastos</div><div class="kpi-value ' + (remaining >= 0 ? "v-good" : "v-bad") + '">' + money(remaining) + '</div><div class="kpi-sub">Gasto até agora ' + money(A.cost) + "</div></div>" +
      '<div class="panel"><div class="label">Lucro previsto (orçamento − gasto até agora)</div><div class="kpi-value">' + money(m.contract - A.cost) + '</div><div class="kpi-sub">Recebido até agora: ' + money(A.revenue) + " (" + fmtPct(pct(A.revenue, m.contract)) + ")</div></div>" +
      "</div></div>";

    var catRows = EXPENSE_CATS.map(function (c) { return { id: c.id, label: c.label, value: P.byCat[c.id] || 0, color: c.color, act: "gastos" }; }).filter(function (r) { return r.value > 0; });
    var userRows = Object.keys(P.byUser).map(function (id) { return { id: id, label: userName(id), value: P.byUser[id].hours, color: "var(--c2)" }; }).sort(function (a, b) { return b.value - a.value; });
    var breakdown = '<div class="section-title"><h3>Para onde foi o dinheiro</h3><span class="muted small">' + periodLabel() + "</span></div>" +
      '<div class="grid2"><div class="panel"><h3>Despesas por categoria</h3>' + bars(catRows, money) + '</div><div class="panel"><h3>Horas por funcionário</h3>' + bars(userRows, hrs) + "</div></div>" +
      '<div style="margin-top:12px">' + projectsTable() + "</div>";

    return '<div class="page-head"><div><h1>Painel</h1><p>Visão geral das obras, gastos e progresso</p></div></div>' + filtersBar() + banner + cards + budget + breakdown;
  }
  function projectsTable() {
    var list = companyProjects().filter(function (p) { return p.status !== "Cancelled"; });
    return '<div class="panel" style="padding:0;overflow:hidden"><h3 style="padding:16px 16px 0">Obras: progresso e gastos</h3><div style="overflow-x:auto"><table><thead><tr><th>Projeto</th><th class="n">Orçamento</th><th class="n">Gasto</th><th class="n">Progresso</th><th class="n">Limite usado</th></tr></thead><tbody>' +
      list.map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="pickProject" data-id="' + p.id + '"><td>' + esc(p.name) + '</td><td class="n">' + money(s.contract) + '</td><td class="n">' + money(s.cost) + '</td><td class="n">' + ring(s.progress, 40, { stroke: 5, fontSize: 11, color: "var(--info)" }) + '</td><td class="n">' + ring(pct(s.cost, s.budget), 40, { stroke: 5, fontSize: 11 }) + "</td></tr>"; }).join("") +
      "</tbody></table></div></div>";
  }

  // ═══════════ horas trabalhadas da obra selecionada ═══════════
  function hoursView() {
    var f = S.filters, sel = f.projectId ? projectById(f.projectId) : null;
    var T = S.time.filter(function (t) { return t.companyId === S.company && (!f.projectId || t.projectId === f.projectId) && (!f.userId || t.userId === f.userId) && inPeriod(t.checkIn); });
    var hours = 0, cost = 0, by = {};
    T.forEach(function (t) { var h = hoursOf(t), c = h * (t.rate || 0); hours += h; cost += c; var u = by[t.userId] || (by[t.userId] = { hours: 0, cost: 0, days: {} }); u.hours += h; u.cost += c; u.days[isoLocal(new Date(t.checkIn))] = 1; });
    var fi = sel ? S.fin[sel.id] || {} : {};
    var rows = Object.keys(by).map(function (id) { return { id: id, name: userName(id), hours: by[id].hours, cost: by[id].cost, days: Object.keys(by[id].days).length }; }).sort(function (a, b) { return b.hours - a.hours; });
    var head = '<div class="page-head"><div><button class="btn ghost sm" data-act="nav" data-id="dashboard" style="margin-bottom:10px">← Painel</button><h1>Horas trabalhadas</h1><p>' + (sel ? esc(sel.name) : "Escolha a obra abaixo para ver só as horas dela") + " · " + periodLabel() + "</p></div></div>";
    return head + filtersBar() +
      '<div class="kpis" style="margin-bottom:14px">' +
      kpi({ label: "Horas", value: hrs(hours), cls: "v-info", sub: sel && fi.estHours ? "das " + hrs(fi.estHours) + " previstas" : "no período", pct: sel ? pct(hours, fi.estHours || 0) : 0 }) +
      kpi({ label: "Mão de obra", value: money(cost), sub: sel ? limitLine(cost, fi.laborBudget || 0) : "todas as obras", pct: sel ? pct(cost, fi.laborBudget || 0) : 0 }) +
      kpi({ label: "Funcionários", value: String(rows.length), sub: "trabalharam no período", pct: 100, ringOpts: { color: "var(--c2)", text: String(rows.length) } }) +
      "</div>" +
      '<div class="panel" style="padding:0;margin-bottom:14px"><h3 style="padding:16px 16px 0">Por funcionário</h3><div style="overflow-x:auto"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Custo</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return "<tr><td>" + esc(r.name) + '</td><td class="n">' + r.days + '</td><td class="n">' + hrs(r.hours) + '</td><td class="n"><b>' + money(r.cost) + "</b></td></tr>"; }).join("") : '<tr><td colspan="4" class="empty">Nenhuma hora registrada.</td></tr>') +
      "</tbody></table></div></div>" +
      '<div class="section-title"><h3>Registros de ponto</h3><span class="muted small">' + T.length + " registros</span></div>" + timeTable(T.slice(0, 300), true);
  }

  // ═══════════ despesas (por categoria) ═══════════
  function gastosView() {
    var m = metrics(), P = m.period, f = S.filters;
    var cat = EXPENSE_CATS.some(function (c) { return c.id === S.gastoCat; }) ? S.gastoCat : "material";
    var segs = EXPENSE_CATS.map(function (c) { return { id: c.id, value: P.byCat[c.id] || 0, color: c.color }; });
    var tiles = '<div class="cat-grid">' + EXPENSE_CATS.map(function (c) { var v = P.byCat[c.id] || 0; return '<button class="cat' + (cat === c.id ? " on" : "") + '" data-act="gastoCat" data-id="' + c.id + '"><span class="label"><span class="swatch" style="background:' + c.color + '"></span>' + esc(c.label) + '</span><span class="amt">' + money(v) + '</span><span class="muted small">' + fmtPct(pct(v, P.exp)) + " das despesas</span></button>"; }).join("") + "</div>";
    var list = m.E.filter(function (x) { return inPeriod(x.date) && x.kind !== "revenue" && catKey(x.category) === cat; });
    var total = list.reduce(function (a, x) { return a + x.amount; }, 0);
    var detail = '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Projeto</th><th>Fornecedor / descrição</th><th>Lançado por</th><th class="n">Valor</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (x) {
        var p = projectById(x.projectId);
        return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + esc(x.vendor || "") + (x.category !== cat ? ' <span class="pill neutral">' + esc(catLabel(x.category)) + "</span>" : "") + (x.note ? '<div class="muted small">' + esc(x.note) + "</div>" : "") + "</td><td>" + esc(userName(x.createdBy)) + '</td><td class="n"><b>' + money(x.amount, 2) + '</b></td><td class="n">' +
          (x.receipt ? '<button class="btn ghost sm" data-act="viewReceipt" data-id="' + x.id + '">Nota</button> ' : "") + '<button class="btn ghost sm" data-act="delExpense" data-id="' + x.id + '" aria-label="Apagar">✕</button></td></tr>';
      }).join("") + '<tr><td colspan="4"><b>Total</b></td><td class="n"><b>' + money(total, 2) + "</b></td><td></td></tr>" : '<tr><td colspan="6" class="empty">Nenhuma despesa nesta categoria no período.</td></tr>') +
      "</tbody></table></div>";
    return '<div class="page-head"><div><h1>Despesas</h1><p>Material, permit, equipamento e outros — as notas lançadas entram aqui sozinhas</p></div><button class="btn ghost" data-act="newExpense">+ Lançamento manual</button></div>' +
      filtersBar({ noUser: true }) +
      '<div class="split"><div class="panel donut-wrap" style="flex-direction:column;align-items:center;gap:10px">' + donut(segs, 220, money(P.exp, 0), "despesas") +
      '<div class="muted small" style="text-align:center">' + esc(f.projectId ? (projectById(f.projectId) || {}).name : "Todos os projetos") + "<br>" + periodLabel() + "</div></div>" + tiles + "</div>" +
      '<div class="section-title"><h3>' + esc(catLabel(cat)) + "</h3></div>" + detail;
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
          '<div class="chips">' + [d.sector, d.workType, d.building, d.unitsCount ? d.unitsCount + " unid." : ""].filter(Boolean).map(function (x) { return '<span class="pill neutral">' + esc(x) + "</span>"; }).join("") + "</div>" +
          '<div class="spread"><div style="flex:1;min-width:120px"><div class="spread small"><span class="muted">Tarefas</span><b>' + s.done + "/" + s.total + '</b></div><div class="progress"><div style="width:' + pct(s.done, s.total) + '%"></div></div></div>' +
          '<div class="row" style="gap:8px">' + ring(pct(s.cost, s.budget), 46, { stroke: 6, fontSize: 12 }) + '<div class="small"><div class="muted">Orçamento</div><b class="num">' + money(s.contract) + "</b></div></div></div></button>";
      }).join("") + "</div>" : '<div class="panel empty">Nenhum projeto ainda. Toque em “Novo projeto” para cadastrar o primeiro ' + (isHvac ? "trabalho de HVAC" : "trabalho elétrico") + ".</div>");
  }

  function specRows(p) {
    var d = p.details || {}, trade = TRADE[tradeOf(p.companyId)];
    var rows = [["Tipo", d.sector], ["Tipo de trabalho", d.workType], ["Imóvel", d.building], ["Quartos", d.bedrooms], ["Banheiros", d.bathrooms], ["Andares", d.floors], ["Área (sq ft)", d.sqft], ["Unidades", d.unitsCount || d.units],
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
    var pn = (S.notices || []).filter(function (n) { return n.projectId === p.id && !n.resolved; }).length;
    var tabs = [["overview", "Visão geral"], ["scope", "Tarefas"], ["avisos", "Avisos" + (pn ? " (" + pn + ")" : "")], ["files", "Plantas e arquivos (" + (p.files || []).length + ")"]];
    if (admin) { tabs.push(["money", "Financeiro"]); tabs.push(["ptime", "Ponto"]); }
    var s = projectStats(p);
    var maps = p.address ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '" target="_blank" rel="noopener">Abrir no mapa</a>' : "";
    var head = '<div class="page-head"><div style="min-width:0"><button class="btn ghost sm" data-act="nav" data-id="' + (admin ? "projects" : "jobs") + '" style="margin-bottom:10px">← ' + (admin ? "Projetos" : "Obras") + '</button>' +
      '<h1>' + esc(p.name) + '</h1><p>' + esc([p.client, p.address].filter(Boolean).join(" · ")) + (maps ? " · " + maps : "") + "</p></div>" +
      '<div class="row">' + statusPill(p.status) + (admin ? '<button class="btn ghost" data-act="editProject" data-id="' + p.id + '">Editar</button><button class="btn ghost danger-text" data-act="askDelProject" data-id="' + p.id + '" title="Apagar projeto">Apagar</button>' : "") + "</div></div>";
    var tabsHtml = '<div class="tabs">' + tabs.map(function (t) { return '<button data-act="ptab" data-id="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + esc(t[1]) + "</button>"; }).join("") + "</div>";
    var body = "";
    if (tab === "overview") {
      var specs = specRows(p);
      body = '<div class="stack">' +
        (p.teamNotes ? '<div class="panel" style="border-left:4px solid var(--accent)"><h3>Recado para a equipe</h3><div class="prose">' + esc(p.teamNotes) + "</div></div>" : "") +
        '<div class="spread"><h3>Ficha da obra</h3><span class="muted small">Início ' + fmtDate(p.startDate) + " · Previsão " + fmtDate(p.estCompletion) + "</span></div>" +
        (specs.length ? '<div class="specs">' + specs.map(function (r) { return '<div class="spec"><div class="label">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") + "</div>" : '<div class="panel empty">Sem detalhes cadastrados.</div>') +
        '<div class="panel"><div class="spread"><h3 style="margin:0">Progresso da obra</h3><b>' + fmtPct(s.progress) + " · " + s.done + " de " + s.total + ' tarefas</b></div><div class="progress" style="margin-top:10px;height:10px"><div style="width:' + s.progress + '%"></div></div></div>' +
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
    } else if (tab === "avisos") {
      body = noticesBlock(p);
    } else if (tab === "money" && admin) {
      var fi = S.fin[p.id] || {};
      var segs = [{ id: "labor", label: "Mão de obra (horas)", value: s.labor, color: "var(--c2)" }].concat(EXPENSE_CATS.map(function (c) { var v = S.expenses.filter(function (x) { return x.projectId === p.id && x.kind !== "revenue" && catKey(x.category) === c.id; }).reduce(function (a, x) { return a + x.amount; }, 0); return { id: c.id, label: c.label, value: v, color: c.color }; }));
      body = '<div class="kpis">' +
        kpi({ label: "Gasto até agora", value: money(s.cost), sub: limitLine(s.cost, s.budget), pct: pct(s.cost, s.budget), act: "gastosFor", id: p.id }) +
        kpi({ label: "Material", value: money(s.material), sub: limitLine(s.material, s.matBudget), pct: pct(s.material, s.matBudget), act: "gastosFor", id: p.id }) +
        kpi({ label: "Mão de obra (horas)", value: money(s.labor), sub: hrs(s.hours) + " · " + limitLine(s.labor, s.labBudget), pct: pct(s.labor, s.labBudget), act: "hoursFor", id: p.id }) +
        kpi({ label: "Recebido", value: money(s.revenue), cls: "v-good", sub: "do orçamento de " + money(s.contract), pct: pct(s.revenue, s.contract), ringOpts: { color: "var(--good)" } }) +
        kpi({ label: "Lucro previsto", value: money(s.contract - s.cost), sub: "orçamento − gasto", pct: pct(s.contract - s.cost, s.contract), ringOpts: { color: "var(--good)" } }) +
        '</div><div class="split" style="margin-top:14px"><div class="panel donut-wrap">' + donut(segs, 220, money(s.cost, 0), "gasto total") + '</div><div class="panel"><h3>Gastos por categoria</h3>' + bars(segs.filter(function (x) { return x.value > 0; }).map(function (x) { return { id: x.id, label: x.label, value: x.value, color: x.color }; }), money) + "</div></div>" +
        '<div class="panel" style="margin-top:14px"><div class="spread"><div><h3 style="margin:0">Relatório diário para o cliente</h3><div class="muted small">' + (fi.clientEmail ? esc(fi.clientEmail) + (fi.dailyReport === false ? " · desligado" : " · enviado todo dia às 18h quando houver trabalho") + (fi.lastReportAt ? " · último: " + fmtDate(fi.lastReportAt) : "") : "Coloque o e-mail do cliente em Editar → Obra.") + "</div></div>" +
        (fi.clientEmail ? '<button class="btn ghost sm" data-act="reportNow" data-id="' + p.id + '">Enviar relatório agora</button>' : "") + "</div></div>" +
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
    return { id: null, companyId: S.company, name: "", client: "", address: "", lat: null, lng: null, radius: 150, status: "Active", startDate: todayISO(), estCompletion: "", details: { access: [], wiring: [], extras: [], equipment: [] }, scope: "", teamNotes: "", tasks: [], fin: { contractValue: "", materialBudget: "", laborBudget: "", estHours: "", clientEmail: "", clientPhone: "", dailyReport: "Sim" } };
  }
  // valores em dinheiro no texto que a equipe vê (escopo / recado)
  function moneyHits(t) {
    var re = /(\$\s?\d[\d,.]*|\b(?:usd|us\$)\s?\d[\d,.]*|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b|\b\d+(?:[.,]\d+)?\s?(?:mil|k|d[oó]lar(?:es)?|dollars?|bucks|reais)\b)/gi, out = [], m;
    while ((m = re.exec(String(t || "")))) if (out.indexOf(m[1].trim()) < 0) out.push(m[1].trim());
    return out;
  }
  function scopeWarnHtml(d) {
    var h = moneyHits(d.scope).concat(moneyHits(d.teamNotes).filter(function (x) { return moneyHits(d.scope).indexOf(x) < 0; }));
    return h.length ? '<div class="pill warn" style="white-space:normal;padding:8px 12px">⚠️ Achei valores que os funcionários vão ver: <b>' + h.slice(0, 6).map(esc).join(", ") + "</b>. Tire do texto se for preço.</div>" : "";
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
        '<div class="grid2">' + inputF("startDate", "Início", "date") + inputF("estCompletion", "Previsão de término", "date") + "</div>" +
        '<div class="panel" style="background:var(--surface-2)"><h3>Cliente: relatório diário da obra</h3><p class="muted small" style="margin:0 0 10px">O cliente recebe por e-mail, todo fim de dia em que houver trabalho, o progresso da obra e as tarefas concluídas. Só você vê estes dados.</p>' +
        '<div class="grid2">' + inputF("fin.clientEmail", "E-mail do cliente", "email", 'autocapitalize="none" inputmode="email"') + inputF("fin.clientPhone", "Telefone do cliente", "tel") + "</div>" +
        chooser("fin.dailyReport", { label: "Enviar relatório diário", opts: ["Sim", "Não"] }) + "</div></div>";
    } else if (step === 1) {
      var sec = d.details.sector, res = sec !== "Comercial", multi = res && d.details.building === "Multifamily";
      var unitsSel = function (label, max) { var v = String(d.details.unitsCount || ""), o = '<option value="">—</option>'; for (var i = 1; i <= max; i++) o += '<option' + (v === String(i) ? " selected" : "") + ">" + i + "</option>"; return '<label class="field" style="max-width:260px"><span>' + label + '</span><select data-bind="details.unitsCount" id="w-units">' + o + "</select></label>"; };
      body = '<div class="stack">' + chooser("details.workType", { label: "Tipo de trabalho", opts: trade.workType }) + chooser("details.sector", COMMON_FIELDS.sector) +
        (sec === "Residencial" ? chooser("details.building", COMMON_FIELDS.buildingRes) + (multi ? unitsSel("Unidades (apartamentos)", 200) : "") + chooser("details.bedrooms", COMMON_FIELDS.bedrooms) + chooser("details.bathrooms", COMMON_FIELDS.bathrooms) : "") +
        (sec === "Comercial" ? unitsSel("Unidades (apartamentos) — até 200", 200) : "") +
        chooser("details.floors", COMMON_FIELDS.floors) +
        '<div class="grid2">' + inputF("details.sqft", "Área (sq ft)", "number") + "</div></div>";
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
      body = '<div class="stack"><div class="muted small">Os funcionários veem o escopo e o recado. Não coloque preços aqui.</div><div id="scopeWarn">' + scopeWarnHtml(d) + '</div><label class="field"><span>Escopo do contrato (cole aqui o escopo que o contrato passa)</span><textarea id="w-scope" data-bind="scope" style="min-height:200px">' + esc(d.scope) + "</textarea></label>" +
        '<label class="field"><span>Recado para a equipe (chave, horários, cuidados, material)</span><textarea id="w-teamNotes" data-bind="teamNotes">' + esc(d.teamNotes) + "</textarea></label>" +
        '<div><span class="label">Plantas e documentos</span>' +
        '<label class="drop" style="margin-top:6px"><input type="file" data-act="wizFiles" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"><b>Escolher plantas / PDFs</b><br><span class="small">Os arquivos são enviados quando você salvar o projeto</span></label>' +
        (S.draftFiles.length ? '<div class="chips" style="margin-top:8px">' + S.draftFiles.map(function (f, i) { return '<button type="button" class="chip" data-act="rmDraftFile" data-id="' + i + '">✕ ' + esc(f.name) + "</button>"; }).join("") + "</div>" : "") +
        (d.id && (projectById(d.id) || {}).files && projectById(d.id).files.length ? '<div class="muted small" style="margin-top:6px">Já enviados: ' + projectById(d.id).files.map(function (f) { return esc(f.name); }).join(", ") + "</div>" : "") +
        "</div></div>";
    } else if (step === 6) {
      var lim = (Number(d.fin.materialBudget) || 0) + (Number(d.fin.laborBudget) || 0);
      body = '<div class="stack"><p class="muted" style="margin:0">Só o administrador vê estes valores. Os funcionários nunca veem preço, orçamento ou lucro.</p>' +
        '<div class="grid2">' + inputF("fin.contractValue", "Orçamento da obra (valor do contrato) $", "number", 'step="0.01" inputmode="decimal"') + inputF("fin.estHours", "Horas previstas", "number", 'inputmode="decimal"') + "</div>" +
        '<div class="grid2">' + inputF("fin.materialBudget", "Quanto quero gastar em material (limite) $", "number", 'step="0.01" inputmode="decimal"') + inputF("fin.laborBudget", "Quanto quero gastar em mão de obra (limite) $", "number", 'step="0.01" inputmode="decimal"') + "</div>" +
        '<p class="muted small" style="margin:0">O painel acompanha o gasto de material (pelas notas) e de mão de obra (pelas horas do ponto) contra estes limites.</p>' +
        '<div class="panel"><h3>Resumo</h3><div class="specs">' +
        [["Projeto", d.name || "—"], ["Tipo", [d.details.sector, d.details.building, d.details.workType].filter(Boolean).join(" · ") || "—"], ["Tarefas", d.tasks.length], ["Arquivos para enviar", S.draftFiles.length], ["Limite de gastos", money(lim)], ["Lucro previsto", money((Number(d.fin.contractValue) || 0) - lim)]].map(function (r) { return '<div class="spec"><div class="label">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") +
        "</div></div></div>";
    }
    return '<div class="page-head"><div><button class="btn ghost sm" data-act="cancelWizard" style="margin-bottom:10px">← Cancelar</button><h1>' + (d.id ? "Editar projeto" : "Novo projeto") + "</h1><p>" + esc(BRAND) + "</p></div></div>" +
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
    return '<div class="page-head"><div><h1>Registro de ponto</h1><p>Entradas e saídas com foto e GPS · pagamento da semana</p></div></div>' + payrollPanel() + filtersBar() +
      '<div class="grid3 keep2" style="margin-bottom:14px"><div class="panel"><div class="label">Trabalhando agora</div><div class="kpi-value v-good">' + now.length + '</div><div class="kpi-sub">' + (now.map(function (t) { return esc(userName(t.userId)); }).join(", ") || "ninguém") + '</div></div><div class="panel"><div class="label">Horas no período</div><div class="kpi-value v-info">' + hrs(tot) + '</div></div><div class="panel"><div class="label">Custo no período</div><div class="kpi-value">' + money(cost) + "</div></div></div>" +
      timeTable(list.slice(0, 400), true);
  }

  // ═══════════ team ═══════════
  function teamView() {
    var list = S.users.filter(function (u) { return u.companyId === S.company || u.role === "admin"; });
    return '<div class="page-head"><div><h1>Equipe</h1><p>' + esc(companyName(S.company)) + '</p></div><button class="btn" data-act="newUser">+ Novo funcionário</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th class="n">Valor/hora</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (u) {
        return "<tr><td><b>" + esc(u.name) + "</b></td><td>" + esc(u.username) + "</td><td>" + (u.role === "admin" ? "Administrador" : "Funcionário") + '</td><td class="n">' + (u.role === "admin" ? "—" : money(u.rate, 2)) + "</td><td>" + (u.active ? '<span class="pill good">Ativo</span>' : '<span class="pill neutral">Inativo</span>') + '</td><td><button class="btn ghost sm" data-act="editUser" data-id="' + u.id + '">Editar</button></td></tr>';
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
  var EMP_NAV = [["punch", "Ponto", "clock"], ["escala", "Escala", "pin"], ["jobs", "Obras", "folder"], ["notas", "Notas", "receipt"], ["me", "Perfil", "user"]];
  function employeeShell() {
    var cur = S.view === "project" ? "jobs" : S.view;
    var co = API.companies.find(function (c) { return c.id === S.user.companyId; }) || API.companies[0];
    var side = '<aside class="sidebar"><div class="brand"><div class="brand-mark">' + BRAND_ICON + '</div><div><div class="brand-name">' + esc(BRAND) + '</div><div class="brand-sub">' + (co.trade === "hvac" ? "HVAC" : "Elétrica") + '</div></div></div><nav class="nav">' +
      EMP_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + esc(n[1]) + "</button>"; }).join("") + '</nav><div class="side-foot"><span>' + esc(S.user.name) + "</span>" + installBtn() + '<button data-act="logout">Sair</button></div></aside>';
    var top = '<header class="topbar"><div class="brand"><div class="brand-mark" style="width:30px;height:30px">' + BRAND_ICON + '</div><div><div class="brand-name" style="font-size:17px">' + esc(BRAND) + '</div><div class="brand-sub">' + (co.trade === "hvac" ? "HVAC" : "Elétrica") + "</div></div></div></header>";
    var mob = '<nav class="mobile-nav">' + EMP_NAV.map(function (n) { return '<button data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ICON[n[2]] + "<span>" + esc(n[1]) + "</span></button>"; }).join("") + "</nav>";
    var body = ({ punch: punchView, jobs: jobsView, project: projectView, notas: notasView, escala: minhaEscalaView, myexp: myExpView, me: meView })[S.view] || punchView;
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
    var tdy = todayISO(); ensureRange("shifts", tdy, addDays(tdy, 14), API.listSchedule);
    var todayShifts = myScheduleList(0);
    if (!S.params.projectId && autoId) S.params.projectId = autoId;
    if (!S.params.projectId && todayShifts.length) S.params.projectId = todayShifts[0].projectId;
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
      (todayShifts.length ? '<div class="panel today-card" style="margin-bottom:12px"><div class="label">Sua escala de hoje</div>' + todayShifts.map(function (x) { var p = projectById(x.projectId); return '<div style="font-size:17px;font-weight:600;margin-top:4px">' + (x.start ? x.start + " · " : "") + esc(p ? p.name : "Obra") + "</div>" + (x.note ? '<div class="small">📝 ' + esc(x.note) + "</div>" : ""); }).join("") + "</div>" : "") +
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

  // ═══════════ pagamento da semana (domingo a sábado) ═══════════
  function weekRange(offset) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 7 * (offset || 0));
    var end = new Date(d); end.setDate(d.getDate() + 6);
    return { from: isoLocal(d), to: isoLocal(end) };
  }
  function payrollFor(w) {
    var rows = {};
    S.time.forEach(function (t) {
      if (t.companyId !== S.company) return;
      var day = isoLocal(new Date(t.checkIn)); if (day < w.from || day > w.to) return;
      var u = userById(t.userId); if (u && u.role === "admin") return;
      var r = rows[t.userId] || (rows[t.userId] = { id: t.userId, name: userName(t.userId), hours: 0, pay: 0, days: {}, open: 0, rate: t.rate || 0 });
      if (!t.checkOut) { r.open++; return; }
      var h = hoursOf(t); r.hours += h; r.pay += h * (t.rate || 0); r.days[day] = 1;
    });
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.nDays = Object.keys(r.days).length; return r; }).sort(function (a, b) { return b.pay - a.pay; });
    return { list: list, total: list.reduce(function (a, r) { return a + r.pay; }, 0), hours: list.reduce(function (a, r) { return a + r.hours; }, 0) };
  }
  function payrollPanel() {
    var off = S.payWeek || 0, w = weekRange(off), pr = payrollFor(w);
    var isSat = new Date().getDay() === 6;
    return '<div class="panel" style="margin-bottom:14px"><div class="spread"><div><h3 style="margin:0">Pagamento da semana</h3><div class="muted small">Domingo ' + fmtDate(w.from) + " a sábado " + fmtDate(w.to) + " · todo sábado à noite chega no seu e-mail</div></div>" +
      '<div class="chips"><button type="button" class="chip' + (off === 0 ? " on" : "") + '" data-act="payWeek" data-id="0">Esta semana</button><button type="button" class="chip' + (off === -1 ? " on" : "") + '" data-act="payWeek" data-id="-1">Semana passada</button></div></div>' +
      '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Valor/hora</th><th class="n">A pagar</th></tr></thead><tbody>' +
      (pr.list.length ? pr.list.map(function (r) { return "<tr><td><b>" + esc(r.name) + "</b>" + (r.open ? ' <span class="pill warn">ponto sem saída</span>' : "") + '</td><td class="n">' + r.nDays + '</td><td class="n">' + hrs(r.hours) + '</td><td class="n">' + money(r.rate, 2) + '</td><td class="n"><b>' + money(r.pay, 2) + "</b></td></tr>"; }).join("") +
        '<tr class="total-row"><td><b>Total' + (off === 0 && !isSat ? " até agora" : "") + '</b></td><td></td><td class="n"><b>' + hrs(pr.hours) + '</b></td><td></td><td class="n"><b>' + money(pr.total, 2) + "</b></td></tr>"
        : '<tr><td colspan="5" class="empty">Nenhuma hora nesta semana.</td></tr>') + "</tbody></table></div>" +
      '<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="payEmail">Mandar para o meu e-mail agora</button></div></div>';
  }

  // ═══════════ avisos ═══════════
  function openNotices() { return (S.notices || []).filter(function (n) { return !n.resolved; }); }
  function noticeCard(n, withProject) {
    var p = projectById(n.projectId), admin = S.user.role === "admin";
    return '<div class="notice' + (n.resolved ? " done" : "") + '"><div class="spread"><div><b>' + esc(n.authorName || userName(n.userId)) + "</b>" + (withProject ? ' · <a href="#" data-act="openProject" data-id="' + esc(n.projectId || "") + '">' + esc(p ? p.name : "Sem obra") + "</a>" : "") +
      '<div class="muted small">' + fmtDate(n.createdAt) + " " + fmtTime(n.createdAt) + (n.resolved ? " · resolvido" : "") + "</div></div>" +
      (admin ? '<div class="row">' + (n.photo ? '<button class="btn ghost sm" data-act="noticePhoto" data-id="' + n.id + '">Foto</button>' : "") + '<button class="btn ' + (n.resolved ? "ghost" : "") + ' sm" data-act="noticeResolve" data-id="' + n.id + '">' + (n.resolved ? "Reabrir" : "Resolvido ✓") + '</button><button class="btn ghost sm" data-act="noticeDel" data-id="' + n.id + '" aria-label="Apagar">✕</button></div>'
        : (n.photo ? '<button class="btn ghost sm" data-act="noticePhoto" data-id="' + n.id + '">Foto</button>' : "")) +
      '</div><div class="notice-text">' + esc(n.text) + "</div></div>";
  }
  function noticesBlock(p) {
    var list = (S.notices || []).filter(function (n) { return n.projectId === p.id; });
    return '<form class="panel stack" id="noticeForm" data-pid="' + p.id + '"><h3 style="margin:0">Novo aviso</h3><p class="muted small" style="margin:0">Algo que precisa ser feito, material faltando, problema na obra… O administrador recebe na hora.</p>' +
      '<textarea id="nText" rows="3" required placeholder="Ex.: Falta 2 caixas de 4 polegadas no 2º andar. Cliente pediu mais uma tomada na cozinha."></textarea>' +
      '<label class="field"><span>Foto (opcional)</span><input type="file" id="nPhoto" accept="image/*" capture="environment"></label>' +
      '<button class="btn" type="submit">Enviar aviso</button></form>' +
      '<div class="section-title"><h3>Avisos desta obra</h3></div>' +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (n) { return noticeCard(n, false); }).join("") + "</div>" : '<div class="panel empty">Nenhum aviso ainda.</div>');
  }
  function avisosView() {
    var show = S.noticeFilter || "open", list = (S.notices || []).filter(function (n) { return show === "all" || !n.resolved; });
    return '<div class="page-head"><div><h1>Avisos</h1><p>O que a equipe reportou nas obras · você recebe um e-mail a cada aviso novo</p></div></div>' +
      '<div class="chips" style="margin-bottom:12px"><button type="button" class="chip' + (show === "open" ? " on" : "") + '" data-act="noticeFilter" data-id="open">Abertos (' + openNotices().length + ')</button><button type="button" class="chip' + (show === "all" ? " on" : "") + '" data-act="noticeFilter" data-id="all">Todos</button></div>' +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (n) { return noticeCard(n, true); }).join("") + "</div>" : '<div class="panel empty">Nenhum aviso ' + (show === "open" ? "aberto" : "") + ".</div>");
  }

  // ═══════════ notas (foto da nota → obra + categoria) ═══════════
  var NOTA_CATS = [["material", "Material"], ["permit", "Permit"], ["outros", "Outros"], ["equipamento", "Equipamento / aluguel"]];
  function notasView() {
    var n = S.nota, admin = S.user.role === "admin";
    var jobs = S.projects.filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed" && (admin ? p.companyId === S.company : true); });
    var top;
    if (!n) {
      top = '<label class="nota-cam"><input type="file" id="notaFile" accept="image/*" capture="environment" hidden>' + ICON.receipt + "<b>Tirar foto da nota</b><span>O app lê a nota e descobre de qual obra ela é</span></label>";
    } else {
      var a = n.ai || {};
      top = '<form class="panel stack" id="notaForm"><div class="nota-row"><img src="' + esc(n.preview) + '" alt="Foto da nota" class="nota-img"><div class="stack" style="gap:10px;flex:1;min-width:0">' +
        (n.status === "lendo" ? '<div class="pill accent"><span class="spin" aria-hidden="true"></span> Lendo a nota…</div>'
          : n.status === "erro" ? '<div class="pill warn">' + esc(n.msg || "Não consegui ler a nota. Preencha abaixo.") + "</div>"
            : '<div class="pill good">' + (a.project_id ? "Obra identificada pela nota" : "Nota lida — escolha a obra") + "</div>" + (a.summary_pt ? '<div class="small muted">' + esc(a.summary_pt) + "</div>" : "")) +
        '<label class="field"><span>Obra</span><select id="nfProj" required><option value="">Escolha a obra</option>' + jobs.map(function (j) { return '<option value="' + j.id + '"' + (n.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
        '<div><span class="label">Tipo</span><div class="chips" style="margin-top:6px">' + NOTA_CATS.map(function (c) { return '<button type="button" class="chip' + (n.category === c[0] ? " on" : "") + '" data-act="notaCat" data-id="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div></div>" +
        '<div class="grid2"><label class="field"><span>Valor total $</span><input type="number" id="nfAmt" step="0.01" inputmode="decimal" required value="' + esc(n.amount == null ? "" : n.amount) + '"></label>' +
        '<label class="field"><span>Data</span><input type="date" id="nfDate" required value="' + esc(n.date || todayISO()) + '"></label></div>' +
        '<label class="field"><span>Loja / fornecedor</span><input type="text" id="nfVendor" value="' + esc(n.vendor || "") + '"></label>' +
        '<div class="row"><button class="btn" type="submit"' + (n.status === "lendo" || n.saving ? " disabled" : "") + '>Salvar nota</button><button type="button" class="btn ghost" data-act="notaCancel">Cancelar</button></div></div></div></form>';
    }
    var mine = S.expenses.filter(function (x) { return x.receipt && x.kind !== "revenue" && (admin || x.createdBy === S.user.id); }).slice(0, 40);
    return '<div class="page-head"><div><h1>Notas</h1><p>Foto da nota de compra → entra na obra certa e no gasto da categoria</p></div></div>' + top +
      '<div class="section-title"><h3>' + (admin ? "Últimas notas" : "Minhas notas") + '</h3></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Obra</th><th>Tipo</th><th>Loja</th>' + (admin ? "<th>Lançado por</th>" : "") + '<th class="n">Valor</th><th></th></tr></thead><tbody>' +
      (mine.length ? mine.map(function (x) { var p = projectById(x.projectId); return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + esc(catLabel(x.category)) + "</td><td>" + esc(x.vendor || "") + "</td>" + (admin ? "<td>" + esc(userName(x.createdBy)) + "</td>" : "") + '<td class="n"><b>' + money(x.amount, 2) + '</b></td><td class="n"><button class="btn ghost sm" data-act="viewReceipt" data-id="' + x.id + '">Ver</button></td></tr>'; }).join("")
        : '<tr><td colspan="7" class="empty">Nenhuma nota ainda.</td></tr>') + "</tbody></table></div>";
  }
  function startNota(file) {
    var reader = new FileReader();
    compress(file, 1600).then(function (blob) {
      reader.onload = function () {
        S.nota = { preview: reader.result, status: "lendo", category: "material", date: todayISO() }; render();
        API.uploadReceipt(blob).then(function (path) {
          S.nota.path = path;
          return API.readReceipt(path);
        }).then(function (res) {
          if (!S.nota) return;
          if (res && res.ok) {
            var a = res.result || {}; S.nota.ai = a; S.nota.status = "pronto";
            if (a.project_id) S.nota.projectId = a.project_id;
            if (a.total != null) S.nota.amount = a.total;
            if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) S.nota.date = a.date;
            if (a.vendor) S.nota.vendor = a.vendor;
            if (a.category) S.nota.category = a.category;
            if (a.readable === false) { S.nota.status = "erro"; S.nota.msg = "A foto ficou difícil de ler. Confira os dados ou tire outra foto."; }
          } else {
            S.nota.status = "erro";
            S.nota.msg = { NO_KEY: "A leitura automática ainda não está ligada. Preencha abaixo.", DEMO: "Modo demonstração: preencha abaixo.", NOT_DEPLOYED: "A leitura automática ainda não foi instalada. Preencha abaixo." }[res && res.error] || "Não consegui ler a nota agora. Preencha abaixo.";
          }
          render();
        }).catch(function (e) { if (!S.nota) return; S.nota.status = "erro"; S.nota.msg = (e && e.message) || "Erro ao enviar a foto."; render(); });
      };
      reader.readAsDataURL(blob);
    });
  }

  // ═══════════ agenda dos sócios ═══════════
  var WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  var MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); }
  var rangeCache = {};
  function ensureRange(kind, from, to, loader) {
    var key = kind + from + to;
    if (rangeCache[kind] === key) return true;
    if (rangeCache[kind + "_loading"] === key) return false;
    rangeCache[kind + "_loading"] = key;
    loader(from, to).then(function (list) { S[kind] = list || []; rangeCache[kind] = key; rangeCache[kind + "_loading"] = ""; render(); })
      .catch(function (e) { rangeCache[kind + "_loading"] = ""; toast(e.message || "Erro ao carregar."); });
    return false;
  }
  function reloadRange(kind) { rangeCache[kind] = ""; render(); }
  function admins() { return S.users.filter(function (u) { return u.role === "admin" && u.active; }); }
  function whoLabel(w) { if (!w || w === "todos") return "Todos"; var u = userById(w); return u ? u.name.split(" ")[0] : "—"; }
  function agendaView() {
    var t = todayISO(), cal = S.cal || (S.cal = { month: t.slice(0, 7), day: t });
    var first = cal.month + "-01", fd = new Date(first + "T12:00:00"), gridStart = addDays(first, -fd.getDay());
    var lastDay = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate(), gridEnd = addDays(cal.month + "-" + String(lastDay).padStart(2, "0"), 6 - new Date(fd.getFullYear(), fd.getMonth(), lastDay).getDay());
    var to = gridEnd > addDays(t, 14) ? gridEnd : addDays(t, 14), from = gridStart < t ? gridStart : t;
    var ready = ensureRange("events", from, to, API.listEvents);
    var ev = S.events || [], byDay = {};
    ev.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var cells = "", d = gridStart;
    while (d <= gridEnd) {
      var list = byDay[d] || [], other = d.slice(0, 7) !== cal.month;
      cells += '<button type="button" class="cal-cell' + (other ? " other" : "") + (d === t ? " today" : "") + (d === cal.day ? " sel" : "") + '" data-act="calDay" data-id="' + d + '"><span class="cal-n">' + Number(d.slice(8)) + "</span>" +
        list.slice(0, 3).map(function (e) { return '<span class="cal-ev' + (e.done ? " done" : "") + '">' + (e.start ? e.start + " " : "") + esc(e.title) + "</span>"; }).join("") + (list.length > 3 ? '<span class="cal-more">+' + (list.length - 3) + "</span>" : "") + "</button>";
      d = addDays(d, 1);
    }
    var mIdx = fd.getMonth();
    var dayList = byDay[cal.day] || [];
    var upcoming = ev.filter(function (e) { return e.date >= t && e.date <= addDays(t, 14) && !e.done; });
    return '<div class="page-head"><div><h1>Agenda</h1><p>Sua agenda e a do seu sócio juntas · cada item novo manda e-mail para vocês</p></div><button class="btn" data-act="evNew">+ Novo na agenda</button></div>' +
      '<div class="panel"><div class="spread" style="margin-bottom:10px"><button class="btn ghost sm" data-act="calMonth" data-id="-1" aria-label="Mês anterior">◀</button><h3 style="margin:0">' + MONTHS[mIdx] + " " + fd.getFullYear() + (ready ? "" : ' <span class="spin" aria-hidden="true"></span>') + '</h3><button class="btn ghost sm" data-act="calMonth" data-id="1" aria-label="Próximo mês">▶</button></div>' +
      '<div class="cal-grid">' + WD.map(function (w) { return '<div class="cal-wd">' + w + "</div>"; }).join("") + cells + "</div></div>" +
      '<div class="grid2" style="margin-top:14px;align-items:start"><div><div class="section-title"><h3>' + fmtDate(cal.day) + " · " + WD[new Date(cal.day + "T12:00:00").getDay()] + '</h3><button class="btn ghost sm" data-act="evNew" data-id="' + cal.day + '">+ Neste dia</button></div>' +
      (dayList.length ? '<div class="stack" style="gap:8px">' + dayList.map(evCard).join("") + "</div>" : '<div class="panel empty">Nada neste dia.</div>') + "</div>" +
      '<div><div class="section-title"><h3>Próximos 14 dias</h3></div>' + (upcoming.length ? '<div class="stack" style="gap:8px">' + upcoming.map(function (e) { return evCard(e, true); }).join("") + "</div>" : '<div class="panel empty">Nada marcado.</div>') + "</div></div>";
  }
  function evCard(e, withDate) {
    var p = e.projectId ? projectById(e.projectId) : null;
    return '<div class="ev' + (e.done ? " done" : "") + '"><label class="ev-check"><input type="checkbox" data-act="evDone" data-id="' + e.id + '"' + (e.done ? " checked" : "") + ' aria-label="Feito"></label><div style="min-width:0;flex:1">' +
      '<div class="ev-title">' + (withDate ? '<span class="muted">' + fmtDate(e.date) + "</span> " : "") + (e.start ? "<b>" + e.start + (e.end ? "–" + e.end : "") + "</b> " : "") + esc(e.title) + "</div>" +
      '<div class="chips" style="margin-top:4px"><span class="pill accent">' + esc(whoLabel(e.who)) + "</span>" + (e.companyId ? '<span class="pill neutral">' + (e.companyId === "bluestar" ? "Blue Star" : "Eternity") + "</span>" : "") + (p ? '<span class="pill neutral">' + esc(p.name) + "</span>" : "") + "</div>" +
      (e.notes ? '<div class="small" style="margin-top:4px;white-space:pre-wrap">' + esc(e.notes) + "</div>" : "") + '<div class="small muted" style="margin-top:2px">por ' + esc(e.createdByName || "") + "</div></div>" +
      '<div class="row" style="gap:4px"><button class="btn ghost sm" data-act="evEdit" data-id="' + e.id + '">Editar</button><button class="btn ghost sm" data-act="evDel" data-id="' + e.id + '" aria-label="Apagar">✕</button></div></div>';
  }
  function evModal(m) {
    var e = m.ev || { title: "", date: (S.cal && S.cal.day) || todayISO(), start: "", end: "", who: "todos", companyId: S.company, projectId: "", notes: "" };
    return '<form id="evForm" class="stack"><label class="field"><span>O que é</span><input type="text" id="evTitle" required value="' + esc(e.title) + '" placeholder="Ex.: Visita técnica 53 Mason St, reunião com GC, inspeção final"></label>' +
      '<div class="grid3"><label class="field"><span>Dia</span><input type="date" id="evDate" required value="' + esc(e.date) + '"></label><label class="field"><span>Início</span><input type="time" id="evStart" value="' + esc(e.start || "") + '"></label><label class="field"><span>Fim</span><input type="time" id="evEnd" value="' + esc(e.end || "") + '"></label></div>' +
      '<div class="grid2"><label class="field"><span>Quem</span><select id="evWho"><option value="todos">Todos (você e o sócio)</option>' + admins().map(function (u) { return '<option value="' + u.id + '"' + (e.who === u.id ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Empresa</span><select id="evCo"><option value="">Geral</option><option value="eternity"' + (e.companyId === "eternity" ? " selected" : "") + '>Eternity Electric</option><option value="bluestar"' + (e.companyId === "bluestar" ? " selected" : "") + ">Blue Star HVAC</option></select></label></div>" +
      '<label class="field"><span>Obra (opcional)</span><select id="evProj"><option value="">—</option>' + companyProjects().filter(function (p) { return p.status !== "Cancelled"; }).map(function (p) { return '<option value="' + p.id + '"' + (e.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>Observações</span><textarea id="evNotes" rows="3">' + esc(e.notes || "") + "</textarea></label>" +
      (m.ev ? '<label class="row"><input type="checkbox" id="evNotify" style="width:auto"> Avisar por e-mail sobre a mudança</label>' : '<div class="muted small">Você e o seu sócio recebem um e-mail com este item.</div>') +
      '<button class="btn" type="submit">' + (m.ev ? "Salvar" : "Adicionar na agenda") + "</button></form>";
  }

  // ═══════════ escala dos funcionários ═══════════
  function weekStartISO(offset) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 7 * (offset || 0)); return isoLocal(d); }
  function shiftLabel(x) { var p = projectById(x.projectId); return (x.start ? x.start + " · " : "") + (p ? p.name : "Obra removida"); }
  function escalaView() {
    var off = S.schedWeek || 0, from = weekStartISO(off), to = addDays(from, 6), t = todayISO();
    var ready = ensureRange("shifts", from, to, API.listSchedule);
    var emps = S.users.filter(function (u) { return u.companyId === S.company && u.role !== "admin" && u.active; });
    var days = []; for (var i = 0; i < 7; i++) days.push(addDays(from, i));
    var sh = (S.shifts || []).filter(function (x) { return x.companyId === S.company; });
    var head = "<tr><th>Funcionário</th>" + days.map(function (d, i) { return '<th class="' + (d === t ? "today" : "") + '">' + WD[i] + "<br><span class=\"small muted\">" + d.slice(8) + "/" + d.slice(5, 7) + "</span></th>"; }).join("") + "</tr>";
    var rows = emps.map(function (u) {
      return "<tr><td><b>" + esc(u.name) + "</b></td>" + days.map(function (d) {
        var mine = sh.filter(function (x) { return x.userId === u.id && x.date === d; });
        return '<td class="sched-cell' + (d === t ? " today" : "") + '">' + mine.map(function (x) { return '<button type="button" class="sched-chip" data-act="shiftEdit" data-id="' + x.id + '">' + esc(shiftLabel(x)) + "</button>"; }).join("") +
          '<button type="button" class="sched-add" data-act="shiftNew" data-id="' + u.id + '" data-date="' + d + '" aria-label="Escalar ' + esc(u.name) + " em " + fmtDate(d) + '">+</button></td>';
      }).join("") + "</tr>";
    }).join("");
    return '<div class="page-head"><div><h1>Escala</h1><p>Onde cada funcionário vai trabalhar · eles veem no app deles</p></div><button class="btn ghost" data-act="schedCopy">Copiar semana anterior</button></div>' +
      '<div class="spread" style="margin-bottom:10px"><button class="btn ghost sm" data-act="schedWeek" data-id="-1">◀ Semana anterior</button><b>' + fmtDate(from) + " a " + fmtDate(to) + (ready ? "" : ' <span class="spin" aria-hidden="true"></span>') + '</b><button class="btn ghost sm" data-act="schedWeek" data-id="1">Próxima semana ▶</button></div>' +
      (emps.length ? '<div class="table-wrap sched"><table><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>" : '<div class="panel empty">Cadastre funcionários na aba Equipe para montar a escala.</div>');
  }
  function shiftModal(m) {
    var x = m.shift || { userId: m.userId, date: m.date, projectId: "", start: "07:00", note: "" };
    var jobs = companyProjects().filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed"; });
    return '<form id="shiftForm" class="stack"><div class="muted">' + esc(userName(x.userId)) + " · " + WD[new Date(x.date + "T12:00:00").getDay()] + " " + fmtDate(x.date) + "</div>" +
      '<label class="field"><span>Obra</span><select id="shProj" required><option value="">Escolha a obra</option>' + jobs.map(function (p) { return '<option value="' + p.id + '"' + (x.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      '<div class="grid2"><label class="field"><span>Chegar às</span><input type="time" id="shStart" value="' + esc(x.start || "") + '"></label><label class="field"><span>Observação para ele</span><input type="text" id="shNote" value="' + esc(x.note || "") + '" placeholder="Ex.: levar escada de 10 ft"></label></div>' +
      '<div class="row">' + (x.id ? '<button type="button" class="btn danger" data-act="shiftDel" data-id="' + x.id + '">Tirar da escala</button>' : "") + '<button class="btn" type="submit" style="margin-left:auto">Salvar</button></div></form>';
  }
  // funcionário: minha escala
  function myScheduleList(days) {
    var t = todayISO(), list = (S.shifts || []).filter(function (x) { return x.userId === S.user.id && x.date >= t && x.date <= addDays(t, days); }).sort(function (a, b) { return a.date + (a.start || "") < b.date + (b.start || "") ? -1 : 1; });
    return list;
  }
  function minhaEscalaView() {
    var t = todayISO(); ensureRange("shifts", t, addDays(t, 14), API.listSchedule);
    var list = myScheduleList(14);
    return '<div class="page-head"><div><h1>Minha escala</h1><p>Onde você vai trabalhar nos próximos dias</p></div></div>' +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (x) {
        var p = projectById(x.projectId);
        return '<div class="panel' + (x.date === t ? " today-card" : "") + '"><div class="spread"><b>' + (x.date === t ? "Hoje" : WD[new Date(x.date + "T12:00:00").getDay()] + " " + fmtDate(x.date)) + "</b>" + (x.start ? '<span class="pill accent">' + x.start + "</span>" : "") + "</div>" +
          '<div style="font-size:17px;font-weight:600;margin-top:4px">' + esc(p ? p.name : "Obra") + "</div>" + (p && p.address ? '<div class="small"><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '" target="_blank" rel="noopener">' + esc(p.address) + " ↗</a></div>" : "") +
          (x.note ? '<div class="small" style="margin-top:6px">📝 ' + esc(x.note) + "</div>" : "") + (p ? '<div style="margin-top:8px"><button class="btn ghost sm" data-act="openProject" data-id="' + p.id + '">Ver a obra e as tarefas</button></div>' : "") + "</div>";
      }).join("") + "</div>" : '<div class="panel empty">Nenhuma escala marcada para os próximos dias.</div>');
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
        '<input type="hidden" id="uCo" value="' + esc(S.company) + '"><div class="grid2"><label class="field"><span>Função</span><select id="uRole"><option value="employee"' + (u.role !== "admin" ? " selected" : "") + '>Funcionário</option><option value="admin"' + (u.role === "admin" ? " selected" : "") + '>Administrador</option></select></label><label class="field"><span>Valor/hora $</span><input type="number" id="uRate" step="0.01" value="' + esc(u.rate) + '"></label></div>' +
        '<label class="field"><span>E-mail (recebe a agenda e os avisos' + (u.role === "admin" ? "" : " — opcional") + ')</span><input type="email" id="uEmail" value="' + esc(u.email || "") + '" autocapitalize="none"></label>' +
        (u.id ? '<label class="row"><input type="checkbox" id="uActive"' + (u.active ? " checked" : "") + "> Ativo (pode entrar no app)</label>" : "") +
        '<div class="err" id="uErr" hidden></div><button class="btn" type="submit">' + (u.id ? "Salvar" : "Criar funcionário") + "</button></form>";
    } else if (m.type === "time") {
      var t = S.time.find(function (x) { return x.id === m.id; });
      var loc = function (iso) { if (!iso) return ""; var d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
      inner = '<form id="timeForm" class="stack"><div class="muted">' + esc(userName(t.userId)) + '</div><label class="field"><span>Obra</span><select id="tProj"><option value="">—</option>' + companyProjects().map(function (p) { return '<option value="' + p.id + '"' + (t.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
        '<div class="grid2"><label class="field"><span>Entrada</span><input type="datetime-local" id="tIn" value="' + loc(t.checkIn) + '"></label><label class="field"><span>Saída</span><input type="datetime-local" id="tOut" value="' + loc(t.checkOut) + '"></label></div><button class="btn" type="submit">Salvar correção</button></form>';
    } else if (m.type === "image") {
      inner = m.urls.length ? '<div class="grid2">' + m.urls.map(function (u) { return '<div><div class="label">' + esc(u[0]) + '</div><img src="' + esc(u[1]) + '" alt="' + esc(u[0]) + '" style="border-radius:10px;margin-top:6px"></div>'; }).join("") + "</div>" : '<div class="empty">Sem imagem.</div>';
    } else if (m.type === "event") {
      inner = evModal(m);
    } else if (m.type === "shift") {
      inner = shiftModal(m);
    } else if (EXT.modals && EXT.modals[m.type]) {
      inner = EXT.modals[m.type](m);
    } else if (m.type === "delProject") {
      var fp = m.fp, ln = function (n, a, b) { return n ? "<li>" + n + " " + (n === 1 ? a : b) + "</li>" : ""; };
      var always = fp ? ln(fp.tasks, "tarefa", "tarefas") + ln(fp.files, "planta/arquivo", "plantas/arquivos") + ln(fp.notices, "aviso", "avisos") + ln(fp.schedule, "dia de escala", "dias de escala") : "";
      var linked = fp ? ln(fp.time, "registro de ponto (horas)", "registros de ponto (horas)") + ln(fp.expenses, "gasto/nota/recebimento", "gastos/notas/recebimentos") + ln(fp.events, "compromisso na agenda", "compromissos na agenda") : "";
      var opt = function (id, t, d) { return '<label class="del-opt' + (m.mode === id ? " on" : "") + '"><input type="radio" name="delmode" data-act="delMode" data-id="' + id + '"' + (m.mode === id ? " checked" : "") + '><div><b>' + t + '</b><div class="small muted">' + d + "</div></div></label>"; };
      inner = '<p>Você vai apagar <b>' + esc(m.name) + "</b>. Isso não pode ser desfeito.</p>" +
        (!fp ? '<p class="muted small">Contando o que está ligado a este projeto…</p>' :
          (always ? '<div class="small"><b>Sempre apagado junto:</b><ul style="margin:4px 0 10px 18px">' + always + "</ul></div>" : "") +
          (linked ? '<div class="small"><b>Também ligado a este projeto:</b><ul style="margin:4px 0 10px 18px">' + linked + "</ul></div>" : '<p class="small muted">Não há ponto, gastos nem agenda ligados a este projeto.</p>')) +
        '<div class="stack" style="gap:8px;margin:10px 0">' +
        opt("keep", "Apagar só o projeto", "Horas, gastos/notas e agenda continuam salvos (ficam “sem projeto”) — os relatórios e a folha não mudam.") +
        opt("all", "Apagar o projeto e tudo ligado a ele", "Apaga também as horas, os gastos/notas (com fotos), recebimentos e compromissos da agenda deste projeto.") +
        "</div>" +
        '<label class="label">Digite <b>APAGAR</b> para confirmar</label><input type="text" id="delConfirm" autocomplete="off" placeholder="APAGAR" style="margin-bottom:12px">' +
        '<div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="delProject" data-id="' + m.id + '">Apagar</button></div>';
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
    nav: function (el) { var v = el.dataset.id; if (v === "avisos") markNoticesSeen(); go(v); if (v === "punch") locate(); },
    company: function (el) { S.company = el.dataset.id; storeSet("ee_company", S.company); S.filters.projectId = ""; S.filters.userId = ""; if (S.view === "project" || S.view === "projectForm") S.view = "projects"; refresh(); },
    logout: function () { API.signOut().then(function () { S.user = null; S.view = "dashboard"; render(); }); },
    resetDemo: function () { API.reset().then(function () { S.user = null; render(); toast("Exemplos restaurados. Entre novamente."); }); },
    install: function () { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; render(); } },
    gastos: function (el) { S.gastoCat = el.dataset.id || "material"; go("gastos"); },
    gastosFor: function (el) { S.filters.projectId = el.dataset.id; S.gastoCat = "material"; go("gastos"); },
    hours: function () { go("hours"); },
    hoursFor: function (el) { S.filters.projectId = el.dataset.id; go("hours"); },
    reportNow: function (el) {
      toast("Enviando relatório…");
      API.services("dailyReports", { projectId: el.dataset.id }).then(function (r) {
        var x = r && r.results && r.results[0];
        if (r && r.ok && x && x.sent) { toast("Relatório enviado para " + x.sent + "."); return refresh(); }
        toast(svcError(r, x && x.error));
      });
    },
    calDay: function (el) { S.cal.day = el.dataset.id; if (el.dataset.id.slice(0, 7) !== S.cal.month) S.cal.month = el.dataset.id.slice(0, 7); render(); },
    calMonth: function (el) { var d = new Date(S.cal.month + "-15T12:00:00"); d.setMonth(d.getMonth() + Number(el.dataset.id)); S.cal.month = isoLocal(d).slice(0, 7); S.cal.day = S.cal.month + "-01"; render(); },
    evNew: function (el) { S.modal = { type: "event", title: "Novo na agenda", date: el.dataset.id }; if (el.dataset.id) S.cal.day = el.dataset.id; render(); },
    evEdit: function (el) { S.modal = { type: "event", title: "Editar", ev: (S.events || []).find(function (e) { return e.id === el.dataset.id; }) }; render(); },
    evDel: function (el) { S.modal = { type: "confirm", title: "Apagar da agenda", text: "Apagar este item da agenda?", act: "evDelOk", id: el.dataset.id, okLabel: "Apagar" }; render(); },
    evDelOk: function (el) { API.deleteEvent(el.dataset.id).then(function () { S.modal = null; reloadRange("events"); toast("Apagado."); }); },
    shiftNew: function (el) { S.modal = { type: "shift", title: "Escalar funcionário", userId: el.dataset.id, date: el.dataset.date }; render(); },
    shiftEdit: function (el) { var x = (S.shifts || []).find(function (y) { return y.id === el.dataset.id; }); S.modal = { type: "shift", title: "Escala", shift: x, userId: x.userId, date: x.date }; render(); },
    shiftDel: function (el) { API.deleteShift(el.dataset.id).then(function () { S.modal = null; reloadRange("shifts"); toast("Tirado da escala."); }); },
    schedWeek: function (el) { S.schedWeek = (S.schedWeek || 0) + Number(el.dataset.id); render(); },
    schedCopy: function () {
      var from = weekStartISO(S.schedWeek || 0), prevFrom = addDays(from, -7);
      toast("Copiando…");
      API.listSchedule(prevFrom, addDays(prevFrom, 6)).then(function (prev) {
        prev = prev.filter(function (x) { return x.companyId === S.company; });
        if (!prev.length) { toast("A semana anterior está vazia."); return; }
        var have = (S.shifts || []).map(function (x) { return x.userId + x.date + x.projectId; });
        var todo = prev.map(function (x) { return { companyId: x.companyId, userId: x.userId, date: addDays(x.date, 7), projectId: x.projectId, start: x.start, note: x.note }; }).filter(function (x) { return have.indexOf(x.userId + x.date + x.projectId) < 0; });
        return todo.reduce(function (pr, x) { return pr.then(function () { return API.saveShift(x); }); }, Promise.resolve()).then(function () { reloadRange("shifts"); toast(todo.length + " escalas copiadas."); });
      }).catch(function (e) { toast(e.message); });
    },
    payWeek: function (el) { S.payWeek = Number(el.dataset.id); render(); },
    payEmail: function () { toast("Enviando…"); API.services("weeklyPayroll", { email: true }).then(function (r) { toast(r && r.ok ? "Enviado para o seu e-mail." : svcError(r)); }); },
    noticeFilter: function (el) { S.noticeFilter = el.dataset.id; render(); },
    noticeResolve: function (el) { var n = S.notices.find(function (x) { return x.id === el.dataset.id; }); API.resolveNotice(n.id, !n.resolved).then(refresh); },
    noticeDel: function (el) { S.modal = { type: "confirm", title: "Apagar aviso", text: "Apagar este aviso?", act: "noticeDelOk", id: el.dataset.id, okLabel: "Apagar" }; render(); },
    noticeDelOk: function (el) { API.deleteNotice(el.dataset.id).then(function () { S.modal = null; return refresh(); }); },
    noticePhoto: function (el) { var n = S.notices.find(function (x) { return x.id === el.dataset.id; }); API.photoUrl(n.photo, "notice-photos").then(function (u) { S.modal = { type: "image", title: "Foto do aviso", urls: u ? [[n.authorName || "", u]] : [] }; render(); }); },
    notaCat: function (el) { S.nota.category = el.dataset.id; render(); },
    notaCancel: function () { S.nota = null; render(); },
    gastoCat: function (el) { S.gastoCat = el.dataset.id; render(); },
    pickProject: function (el) { S.filters.projectId = el.dataset.id; render(); window.scrollTo(0, 0); },
    openProject: function (el) { go("project", { id: el.dataset.id, tab: "overview" }); },
    ptab: function (el) { S.params.tab = el.dataset.id; render(); },
    newProject: function () { S.draft = blankProject(); S.draftFiles = []; S.wizStep = 0; go("projectForm"); },
    editProject: function (el) {
      var p = projectById(el.dataset.id), fi = S.fin[p.id] || {};
      S.draft = JSON.parse(JSON.stringify(p)); S.draft.fin = { contractValue: fi.contractValue || "", materialBudget: fi.materialBudget || "", laborBudget: fi.laborBudget || "", budget: fi.budget || "", estHours: fi.estHours || "", clientEmail: fi.clientEmail || "", clientPhone: fi.clientPhone || "", dailyReport: fi.dailyReport === false ? "Não" : "Sim" };
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
    saveProjectForce: function () { S.modal = null; S.draft._moneyOk = true; A.saveProject(); },
    saveProject: function () {
      var d = S.draft, err = $("#wizErr");
      var hits = moneyHits(d.scope).concat(moneyHits(d.teamNotes));
      if (hits.length && !d._moneyOk) {
        S.wizStep = 5;
        S.modal = { type: "confirm", title: "Atenção: valor no escopo", text: "O escopo ou o recado para a equipe tem valores: " + hits.slice(0, 6).join(", ") + ". Os funcionários vão ver esse texto. Volte e tire os preços, ou salve mesmo assim se não for preço (ex.: metragem).", act: "saveProjectForce", id: "x", okLabel: "Salvar mesmo assim" };
        render(); return;
      }
      if (!d.name.trim()) { S.wizStep = 0; render(); var e2 = $("#wizErr"); e2.textContent = "Dê um nome ao projeto."; e2.hidden = false; return; }
      var fin = d.fin, files = S.draftFiles.slice(), proj = JSON.parse(JSON.stringify(d)); delete proj.fin; delete proj._moneyOk; delete d._moneyOk;
      proj.lat = proj.lat === "" || proj.lat == null ? null : Number(proj.lat); proj.lng = proj.lng === "" || proj.lng == null ? null : Number(proj.lng);
      toast("Salvando…");
      API.saveProject(proj).then(function (saved) {
        return API.saveFinancials(saved.id, fin).then(function () {
          return files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(saved.id, f); }); }, Promise.resolve());
        }).then(function () { return saved; });
      }).then(function (saved) { S.draft = null; S.draftFiles = []; return loadData().then(function () { go("project", { id: saved.id, tab: "overview" }); toast("Projeto salvo."); }); })
        .catch(function (e) { if (err) { err.textContent = e.message || "Erro ao salvar."; err.hidden = false; } });
    },
    askDelProject: function (el) {
      var p = projectById(el.dataset.id); if (!p) return;
      S.modal = { type: "delProject", title: "Apagar projeto", id: p.id, name: p.name, fp: null, mode: "keep" }; render();
      (API.projectFootprint ? API.projectFootprint(p.id) : Promise.resolve(null)).then(function (fp) { if (S.modal && S.modal.type === "delProject") { S.modal.fp = fp || {}; render(); } });
    },
    delMode: function (el) { if (S.modal) { S.modal.mode = el.dataset.id; render(); } },
    delProject: function (el) {
      var m = S.modal || {}, id = el.dataset.id, all = m.mode === "all";
      var ci = document.getElementById("delConfirm"); if (m.type === "delProject" && (!ci || ci.value.trim().toUpperCase() !== "APAGAR")) { toast("Digite APAGAR para confirmar."); return; }
      el.disabled = true; el.textContent = "Apagando…";
      API.deleteProject(id, { all: all }).then(function () { S.modal = null; return loadData(); }).then(function () { go("projects"); toast(all ? "Projeto e tudo ligado a ele apagados." : "Projeto apagado. Ponto e gastos continuam salvos."); })
        .catch(function (e) { el.disabled = false; el.textContent = "Apagar"; toast("Não consegui apagar: " + (e && e.message || e)); });
    },
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

  function svcError(r, extra) {
    var e = r && r.error;
    return ({ NO_EMAIL_KEY: "O envio de e-mail ainda não foi ligado (falta a chave do Resend no Supabase).", NO_KEY: "A IA ainda não foi ligada.", NOT_DEPLOYED: "Esse serviço ainda não foi instalado no Supabase.", DEMO: "Modo demonstração: nada foi enviado.", OFFLINE: "Sem conexão agora.", FORBIDDEN: "Sem permissão." })[e] || ("Não deu certo" + (extra || (r && r.detail) ? ": " + (extra || r.detail) : "."));
  }
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
    if (act === "modalBg" && ev.target !== el) return; // clique dentro do modal: deixa botões e formulários funcionarem
    var fn = A[act] || EXT.actions[act];
    if (fn) { if (el.tagName === "A" && el.getAttribute("href") !== "#") return; ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    for (var ci = 0; ci < EXT.change.length; ci++) { if (EXT.change[ci](el, ev)) return; }
    if (el.dataset.filter) {
      S.filters[el.dataset.filter] = el.value;
      if (el.dataset.filter === "preset") { if (el.value === "custom" && !S.filters.from) { S.filters.preset = "this_month"; applyPreset(); S.filters.preset = "custom"; } else applyPreset(); }
      render(); return;
    }
    if (el.dataset.bind && S.draft) { set(S.draft, el.dataset.bind, el.value); if (el.tagName === "SELECT") render(); return; }
    if (el.dataset.act === "task") { A.task(el); return; }
    if (el.dataset.act === "delMode") { A.delMode(el); return; }
    if (el.dataset.act === "punchProject") { S.params.projectId = el.value; return; }
    if (el.id === "selfie" && el.files[0]) { doPunch(el.files[0]); return; }
    if (el.id === "notaFile" && el.files[0]) { startNota(el.files[0]); return; }
    if (el.dataset.act === "evDone") { var ev = (S.events || []).find(function (e) { return e.id === el.dataset.id; }); if (ev) { ev.done = el.checked; API.saveEvent(Object.assign({}, ev)).then(render).catch(function (e) { toast(e.message); }); } return; }
    if (S.nota && /^nf/.test(el.id)) { notaField(el); return; }
    if (el.dataset.act === "wizFiles") { S.draftFiles = S.draftFiles.concat([].slice.call(el.files)); render(); return; }
    if (el.dataset.act === "uploadFiles") {
      var files = [].slice.call(el.files), pid = el.dataset.id;
      toast("Enviando " + files.length + " arquivo(s)…");
      files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(pid, f); }); }, Promise.resolve())
        .then(refresh).then(function () { toast("Arquivos enviados."); }).catch(function (e) { toast(e.message || "Erro ao enviar."); });
    }
  });
  function notaField(el) { var k = { nfProj: "projectId", nfAmt: "amount", nfDate: "date", nfVendor: "vendor" }[el.id]; if (k && S.nota) S.nota[k] = el.value; }
  document.addEventListener("input", function (ev) { var el = ev.target; if (S.nota && /^nf/.test(el.id)) notaField(el); for (var ii = 0; ii < EXT.input.length; ii++) { if (EXT.input[ii](el, ev)) return; } if (el.dataset.bind && S.draft && el.tagName !== "SELECT") { set(S.draft, el.dataset.bind, el.value); if (/^(scope|teamNotes)$/.test(el.dataset.bind)) { S.draft._moneyOk = false; var w = $("#scopeWarn"); if (w) w.innerHTML = scopeWarnHtml(S.draft); } } });
  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (EXT.submit[f.id]) { EXT.submit[f.id](f, ev); return; }
    if (f.id === "evForm") {
      var old = S.modal.ev, ev = Object.assign({}, old || {}, { title: $("#evTitle").value.trim(), date: $("#evDate").value, start: $("#evStart").value, end: $("#evEnd").value, who: $("#evWho").value, companyId: $("#evCo").value, projectId: $("#evProj").value, notes: $("#evNotes").value.trim(), notify: !!($("#evNotify") && $("#evNotify").checked) });
      if (!ev.title || !ev.date) return;
      API.saveEvent(ev).then(function () { S.modal = null; S.cal.day = ev.date; S.cal.month = ev.date.slice(0, 7); reloadRange("events"); toast(old && !ev.notify ? "Salvo." : "Salvo na agenda. E-mail enviado para você e o sócio."); }).catch(function (e) { toast(e.message || "Erro ao salvar."); });
      return;
    }
    if (f.id === "shiftForm") {
      var m0 = S.modal, sx = Object.assign({}, m0.shift || {}, { companyId: S.company, userId: m0.userId, date: m0.date, projectId: $("#shProj").value, start: $("#shStart").value, note: $("#shNote").value.trim() });
      if (!sx.projectId) { toast("Escolha a obra."); return; }
      API.saveShift(sx).then(function () { S.modal = null; reloadRange("shifts"); toast("Escala salva."); }).catch(function (e) { toast(e.message || "Erro ao salvar."); });
      return;
    }
    if (f.id === "noticeForm") {
      var txt = $("#nText").value.trim(); if (!txt) return;
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      compress($("#nPhoto").files[0], 1200).then(function (ph) { return API.addNotice({ projectId: f.dataset.pid, text: txt, photo: ph || null }); })
        .then(function () { return refresh(); }).then(function () { toast("Aviso enviado. O administrador foi avisado."); })
        .catch(function (e) { btn.disabled = false; toast(e.message || "Erro ao enviar aviso."); });
      return;
    }
    if (f.id === "notaForm") {
      var n = S.nota, amt = Number(n.amount);
      if (!n.projectId) { toast("Escolha a obra da nota."); return; }
      if (!(amt > 0)) { toast("Informe o valor da nota."); return; }
      n.saving = true; render();
      API.addExpense({ companyId: S.user.role === "admin" ? S.company : S.user.companyId, kind: "expense", category: n.category || "material", amount: amt, projectId: n.projectId, date: n.date || todayISO(), vendor: n.vendor || "", note: n.ai && n.ai.summary_pt ? n.ai.summary_pt : "", receiptPath: n.path || null, ai: n.ai || null })
        .then(function () { var p = projectById(n.projectId); S.nota = null; return refresh().then(function () { toast("Nota salva em " + (p ? p.name : "obra") + " · " + catLabel(n.category) + " " + money(amt, 2)); }); })
        .catch(function (e) { n.saving = false; render(); toast(e.message || "Erro ao salvar a nota."); });
      return;
    }
    if (f.id === "setupForm") {
      var se = $("#suErr"); se.hidden = true;
      API.setupAdmin({ name: $("#suName").value.trim(), username: $("#suUser").value, password: $("#suPass").value })
        .then(function (u) { S.setup = false; return afterLogin(u); }).catch(function (e) { se.textContent = e.message; se.hidden = false; });
      return;
    }
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
      var data = { name: $("#uName").value.trim(), companyId: $("#uCo").value, role: $("#uRole").value, rate: $("#uRate").value, password: $("#uPass").value, email: $("#uEmail").value.trim() };
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
    if (user.role !== "admin" && user.companyId !== S.company) {
      API.signOut();
      var other = user.companyId === "bluestar" ? "Blue Star HVAC" : "Eternity Electric";
      return Promise.reject(new Error("Este usuário é da " + other + ". Use o app da " + other + "."));
    }
    S.user = user;
    if (user.role !== "admin") { S.company = user.companyId; S.view = "punch"; } else { S.view = "dashboard"; }
    applyPreset();
    return loadData().then(function () { return user.role !== "admin" ? API.openShift(user.id).then(function (o) { S.open = o; }).catch(function () { S.open = localOpenShift(); }) : null; }).then(function () { render(); if (user.role !== "admin") locate(); });
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); S.installEvt = e; if (S.user) render(); });
  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
    try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
  }

  window.EE = { S: S, EXT: EXT, API: API, render: render, go: go, toast: toast, esc: esc, money: money, fmtDate: fmtDate, fmtPct: fmtPct, pct: pct, todayISO: todayISO,
    companyName: companyName, tradeOf: tradeOf, companyProjects: companyProjects, projectById: projectById, statusPill: statusPill, ICON: ICON, refresh: refresh,
    blankProject: blankProject, TRADE: TRADE, storeGet: storeGet, storeSet: storeSet, ring: ring };

  // boot (o link da proposta para o cliente é tratado em proposals.js)
  if (/[?&]proposta=/.test(location.search)) return;
  $("#app").innerHTML = '<div class="login"><div class="brand"><div class="brand-mark">' + BRAND_ICON + '</div><div class="brand-name">' + esc(BRAND) + '</div></div></div>';
  API.init().then(function () { return API.session(); }).then(function (u) {
    if (u) return afterLogin(u);
    return (API.needsSetup ? API.needsSetup() : Promise.resolve(false)).then(function (n) { S.setup = n; render(); });
  })
    .catch(function (e) { $("#app").innerHTML = '<div class="login"><div class="login-card"><div class="brand-name">' + esc(BRAND) + '</div><div class="err">' + esc(e.message || "Erro ao iniciar.") + "</div></div></div>"; });
})();
