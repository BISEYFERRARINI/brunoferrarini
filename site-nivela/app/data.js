/* Data layer: one interface, two backends.
   - DemoStore: everything in this device's storage, seeded with clearly-marked example data.
   - SupaStore: Supabase (Postgres + Auth + Storage) with row-level security.
   The UI (app.js) only talks to window.API. */
(function () {
  "use strict";
  // textos (i18n.js): mensagens de erro e dados de exemplo saem no idioma de quem usa; valores gravados (opções, grupos) continuam em PT
  var t = window.NV.t, tv = window.NV.tv;

  // Só a Eternity neste app (a Blue Star vai ter um app separado; os dados dela continuam guardados no banco)
  var ALL_COMPANIES = [
    { id: "eternity", name: "Eternity Electric", trade: "electrical", short: "Eternity", preset: true },
    { id: "bluestar", name: "Blue Star HVAC", trade: "hvac", short: "Blue Star", noGas: true, preset: true } // a Blue Star não faz gás (Configurações → Empresa → "Não fazemos gás")
  ];
  var APP_CO = (window.APP_CONFIG && window.APP_CONFIG.COMPANY) || "eternity";
  var COMPANIES = ALL_COMPANIES.filter(function (c) { return c.id === APP_CO; });
  var BASE_COMPANIES = COMPANIES.map(function (c) { return Object.assign({}, c); }); // empresas pré-configuradas (conta de exemplo / app do Bruno)
  // troca a lista de empresas NO LUGAR (o app guarda a referência de API.companies)
  function setCompanies(list) { COMPANIES.length = 0; list.forEach(function (c) { COMPANIES.push(c); }); }
  // ramos válidos e sufixo do nome da empresa ("Acme Plumbing") vêm do registro trades.js
  var TRADES = window.NV.tradeList().map(function (d) { return d.id; });
  var TRADE_NAME = {}; window.NV.tradeList().forEach(function (d) { TRADE_NAME[d.id] = d.companySuffix; });
  function slugify(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "empresa"; }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || "").trim()); }
  function genPassword() { var a = "abcdefghjkmnpqrstuvwxyz23456789", s = ""; for (var i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  // perfis de empresa que o app usa no cabeçalho das propostas / PDF e na marca (logo, cor)
  var CO_FIELDS = ["name", "short", "trade", "logo", "accent", "address", "phone", "email", "license", "state", "noGas", "hicReg"]; // noGas: "Não fazemos gás" (HVAC / plumbing); hicReg: nº de registro HIC (MA)
  function isStaffRole(r) { return r === "admin" || r === "manager"; }
  function finOut(f) {
    var mat = Number(f.materialBudget) || 0, lab = Number(f.laborBudget) || 0;
    return { contractValue: Number(f.contractValue) || 0, budget: mat + lab > 0 ? mat + lab : Number(f.budget) || 0, estHours: Number(f.estHours) || 0, materialBudget: mat, laborBudget: lab,
      clientEmail: (f.clientEmail || "").trim(), clientPhone: (f.clientPhone || "").trim(), dailyReport: f.dailyReport !== false && f.dailyReport !== "false" };
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function hoursOf(e) {
    if (!e.checkIn) return 0;
    var end = e.checkOut ? new Date(e.checkOut) : null;
    if (!end) return 0;
    return Math.max(0, (end - new Date(e.checkIn)) / 36e5);
  }
  function blobToDataURL(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(d) {
    var parts = d.split(","), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function inRange(iso, from, to) {
    if (!iso) return false;
    var d = String(iso).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  // ══════════════════════════ DEMO ══════════════════════════
  function DemoStore() {
    var KEY = "ee_demo_v2", SESSION = "ee_demo_session";
    // contas criadas no aparelho (onboarding): cada uma tem o próprio banco; a de exemplo continua em KEY
    var ACTIVE = "nivela_demo_active", REG = "nivela_demo_orgs";
    var activeKey = KEY, pendingOwner = null;
    var mem = {};         // big blobs that may not fit in localStorage
    var db = null;

    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

    function seed() {
      var r = rng(42);
      var today = new Date(); today.setHours(0, 0, 0, 0);
      function daysAgo(n, h, m) { var d = new Date(today); d.setDate(d.getDate() - n); d.setHours(h, m || 0, 0, 0); return d.toISOString(); }
      function dateAgo(n) { var d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

      var users = [
        { id: "u-admin", username: "bruno", password: "1234", name: "Bruno", role: "admin", companyId: "eternity", rate: 0, active: true },
        { id: "u-joao", username: "joao", password: "1234", name: "João Silva", role: "employee", companyId: "eternity", rate: 34, active: true },
        { id: "u-marcos", username: "marcos", password: "1234", name: "Marcos Lima", role: "employee", companyId: "eternity", rate: 28, active: true },
        { id: "u-pedro", username: "pedro", password: "1234", name: "Pedro Souza", role: "employee", companyId: "bluestar", rate: 32, active: true },
        { id: "u-lucas", username: "lucas", password: "1234", name: "Lucas Reis", role: "employee", companyId: "bluestar", rate: 26, active: true },
        // gerente: vê obras, escala, agenda, avisos, notas, ponto e propostas, sem os valores financeiros da empresa
        { id: "u-carla", username: "carla", password: "1234", name: "Carla Mendes", role: "manager", companyId: "eternity", rate: 0, active: true }
      ];

      function tasksFrom(list, doneCount) {
        return list.map(function (t, i) { return { id: uid(), group: t[0], label: tv(t[1]), done: i < doneCount, doneBy: i < doneCount ? "João Silva" : null, doneAt: i < doneCount ? dateAgo(10 - Math.min(i, 9)) : null }; });
      }

      var projects = [
        {
          id: "p-elm", companyId: "eternity", name: t("sample.sample14ElmSt", "EXEMPLO · 14 Elm St"), client: t("sample.sampleCustomerLlc", "Cliente Exemplo LLC"),
          address: "14 Elm St, Worcester, MA", lat: 42.2626, lng: -71.8023, radius: 150, status: "Active",
          startDate: dateAgo(26), estCompletion: dateAgo(-30),
          details: { sector: "Residencial", workType: "New Construction", building: "Two-family", bedrooms: "3", bathrooms: "2", units: "2", floors: "3", sqft: "2800",
            permit: "Sim, já aprovado", permitNo: "E-2026-0412", walls: "Abertas (sem drywall)", occupied: "Desocupado",
            wiring: ["Romex (NM-B)"], serviceAmps: "200A", serviceType: "Novo serviço", serviceFeed: "Subterrâneo", utility: "National Grid", panel: "Square D Homeline", fireAlarm: "Sim", lowVoltage: "Sim", extras: ["Carregador EV"] },
          scope: t("sample.scopePerContractComplete", "Escopo conforme contrato:\n• Elétrica completa para dois apartamentos (2 x 200A), com medidores separados.\n• Rough-in e acabamento em todos os cômodos conforme planta E-1 e E-2.\n• Detectores de fumaça/CO interligados conforme código.\n• Circuito dedicado para condensadoras (2) e carregador EV na garagem.\n• Não incluso: luminárias decorativas (fornecidas pelo cliente)."),
          teamNotes: t("sample.keyInTheLockbox", "Chave na caixa de segredo da porta dos fundos. Usar Romex 12/2 na cozinha. Inspeção rough marcada para quinta."),
          tasks: tasksFrom([["Serviço", "Upgrade / instalação de serviço"], ["Serviço", "Meter socket"], ["Serviço", "Aterramento (ground rods / bonding)"], ["Rough-in", "Rough-in elétrico"], ["Rough-in", "Circuitos dedicados da cozinha"], ["Rough-in", "Circuitos AFCI dos quartos"], ["Rough-in", "Detectores de fumaça / CO"], ["Rough-in", "Circuito da condensadora (HVAC)"], ["Rough-in", "Carregador EV"], ["Inspeções", "Inspeção rough"], ["Acabamento", "Instalar tomadas e interruptores"], ["Acabamento", "Instalar luminárias"], ["Inspeções", "Inspeção final"]], 6),
          files: []
        },
        {
          id: "p-maple", companyId: "eternity", name: t("sample.sample88MapleAve", "EXEMPLO · 88 Maple Ave"), client: t("sample.sampleCustomerHomeowner", "Cliente Exemplo (proprietário)"),
          address: "88 Maple Ave, Shrewsbury, MA", lat: 42.2959, lng: -71.7129, radius: 150, status: "Active",
          startDate: dateAgo(12), estCompletion: dateAgo(-10),
          details: { sector: "Residencial", workType: "Remodel", building: "Single family", bedrooms: "4", bathrooms: "2.5", floors: "2", sqft: "2200",
            permit: "Sim, já aprovado", permitNo: "SH-E-1187", walls: "Parcialmente abertas", occupied: "Ocupado (família morando)",
            wiring: ["Romex (NM-B)", "MC Cable"], serviceAmps: "200A", serviceType: "Upgrade (100A → 200A)", serviceFeed: "Aéreo", utility: "Eversource", panel: "Eaton BR", fireAlarm: "Não", lowVoltage: "Não", extras: [] },
          scope: t("sample.kitchenAndTwoBathroom", "Reforma da cozinha e dois banheiros + upgrade do serviço de 100A para 200A.\n• Trocar todas as tomadas e interruptores da casa (decorator branco).\n• 8 recessed na cozinha, 2 pendentes na ilha.\n• GFCI em todos os balcões."),
          teamNotes: t("sample.occupiedHouseProtectThe", "Casa ocupada — proteger o piso, desligar energia só com aviso de 1h. Cachorro no quintal."),
          tasks: tasksFrom([["Serviço", "Upgrade / instalação de serviço"], ["Serviço", "Troca de painel"], ["Rough-in", "Circuitos dedicados da cozinha"], ["Rough-in", "Circuito do banheiro (GFCI)"], ["Rough-in", "Iluminação recessed"], ["Acabamento", "Trocar tomadas"], ["Acabamento", "Trocar interruptores"], ["Inspeções", "Inspeção final"]], 2),
          files: []
        },
        {
          id: "p-oak", companyId: "bluestar", name: t("sample.sample8OakAve", "EXEMPLO · 8 Oak Ave"), client: t("sample.sampleCustomerHomeowner", "Cliente Exemplo (proprietário)"),
          address: "8 Oak Ave, Watertown, MA", lat: 42.3709, lng: -71.1828, radius: 150, status: "Active",
          startDate: dateAgo(9), estCompletion: dateAgo(-12),
          details: { sector: "Residencial", workType: "Substituição de equipamento", building: "Single family", bedrooms: "3", bathrooms: "2", floors: "2", sqft: "1900",
            permit: "Sim, já aprovado", permitNo: "WT-M-2210", walls: "Fechadas (acabadas)", occupied: "Ocupado (família morando)",
            equipment: ["Heat pump ducted", "Air handler"], capacity: "36,000 BTU (3 ton)", zones: "2", brand: "Mitsubishi", fuel: "Elétrico (heat pump)", ducts: "Aproveitar dutos existentes", lineSet: "Novo line set (35 ft)", thermostat: "2 termostatos Wi-Fi", manualJ: "Sim", rebate: "Sim, Mass Save", electricalBy: "Eternity Electric" },
          scope: t("sample.replaceOilFurnaceWith", "Substituir fornalha a óleo por heat pump ducted 3 ton com air handler no porão.\n• 2 zonas com dampers.\n• Selar e isolar dutos acessíveis no porão.\n• Remoção do tanque de óleo por terceiros (não incluso)."),
          teamNotes: t("sample.enterThroughTheBasement", "Entrada pelo porão (porta lateral). Elétrica do circuito feita pela Eternity."),
          tasks: tasksFrom([["Remoção", "Remover equipamento antigo"], ["Equipamento", "Instalar condensadora / heat pump"], ["Equipamento", "Instalar air handler"], ["Distribuição", "Line set"], ["Distribuição", "Isolamento e vedação de dutos"], ["Controles", "Zoneamento"], ["Controles", "Termostatos"], ["Comissionamento", "Teste de pressão (nitrogênio)"], ["Comissionamento", "Vácuo"], ["Comissionamento", "Start-up e teste"], ["Comissionamento", "Documentação Mass Save"]], 3),
          files: []
        }
      ];

      var financials = {
        "p-elm": { contractValue: 62000, budget: 41000, materialBudget: 16000, laborBudget: 25000, estHours: 520, clientEmail: "", dailyReport: true },
        "p-maple": { contractValue: 18500, budget: 11500, materialBudget: 4500, laborBudget: 7000, estHours: 150, clientEmail: "", dailyReport: true },
        "p-oak": { contractValue: 24800, budget: 16200, estHours: 90 }
      };

      var time = [];
      function work(user, proj, days) {
        days.forEach(function (n) {
          var d = new Date(today); d.setDate(d.getDate() - n);
          if (d.getDay() === 0) return;
          var startH = 7, startM = Math.floor(r() * 30);
          var len = 7 + r() * 2.5;
          var inIso = daysAgo(n, startH, startM);
          var out = new Date(new Date(inIso).getTime() + len * 36e5).toISOString();
          time.push({ id: uid(), userId: user.id, companyId: user.companyId, projectId: proj, checkIn: inIso, checkOut: out, rate: user.rate,
            inLoc: { lat: 0, lng: 0, ok: true }, outLoc: { lat: 0, lng: 0, ok: true }, inPhoto: null, outPhoto: null });
        });
      }
      var range = function (a, b) { var o = []; for (var i = a; i >= b; i--) o.push(i); return o; };
      work(users[1], "p-elm", range(26, 1).filter(function (n) { return n % 7 !== 6; }));
      work(users[2], "p-elm", range(20, 8));
      work(users[2], "p-maple", range(7, 1));
      work(users[1], "p-maple", [12, 11]);
      work(users[3], "p-oak", range(9, 1));
      work(users[4], "p-oak", range(6, 2));
      // open shift for João today
      time.push({ id: uid(), userId: "u-joao", companyId: "eternity", projectId: "p-elm", checkIn: daysAgo(0, 7, 10), checkOut: null, rate: 34, inLoc: { ok: true }, inPhoto: null });

      var exp = [];
      function e(co, p, cat, amt, vendor, n, by) { exp.push({ id: uid(), companyId: co, projectId: p, kind: "expense", category: cat, amount: amt, vendor: vendor, date: dateAgo(n), note: "", receipt: null, createdBy: by || "u-admin" }); }
      e("eternity", "p-elm", "material", 3840.55, "Graybar", 24); e("eternity", "p-elm", "material", 1265.10, "Home Depot", 18, "u-joao");
      e("eternity", "p-elm", "material", 2210.00, "City Electric Supply", 9); e("eternity", "p-elm", "permit", 640.00, t("sample.cityOfWorcester", "Cidade de Worcester"), 25);
      e("eternity", "p-elm", "gasolina", 68.40, "Shell", 20, "u-joao"); e("eternity", "p-elm", "gasolina", 72.15, "Mobil", 13, "u-joao"); e("eternity", "p-elm", "gasolina", 59.80, "Gulf", 5, "u-marcos");
      e("eternity", "p-elm", "equipamento", 420.00, t("sample.sunbeltRentalsLift", "Sunbelt Rentals (elevador)"), 11); e("eternity", "p-elm", "subcontractor", 1800.00, t("sample.sampleExcavation", "Escavação Exemplo"), 16);
      e("eternity", "p-maple", "material", 1490.30, "Graybar", 11); e("eternity", "p-maple", "permit", 285.00, t("sample.cityOfShrewsbury", "Cidade de Shrewsbury"), 12); e("eternity", "p-maple", "gasolina", 44.90, "Shell", 4, "u-marcos");
      e("bluestar", "p-oak", "material", 7420.00, t("sample.fWWebbMitsubishi", "F.W. Webb (equipamento Mitsubishi)"), 8); e("bluestar", "p-oak", "material", 612.45, "Johnstone Supply", 6, "u-pedro");
      e("bluestar", "p-oak", "permit", 310.00, t("sample.cityOfWatertown", "Cidade de Watertown"), 9); e("bluestar", "p-oak", "gasolina", 61.20, "Sunoco", 5, "u-pedro"); e("bluestar", "p-oak", "outros", 95.00, t("sample.equipmentDisposal", "Descarte de equipamento"), 7);
      function rev(co, p, amt, n, note) { exp.push({ id: uid(), companyId: co, projectId: p, kind: "revenue", category: "receita", amount: amt, vendor: t("sample.customer", "Cliente"), date: dateAgo(n), note: note, receipt: null, createdBy: "u-admin" }); }
      rev("eternity", "p-elm", 18600, 25, t("sample.30Deposit", "Depósito 30%")); rev("eternity", "p-elm", 12400, 6, t("sample.roughInProgressBilling", "Medição rough-in"));
      rev("eternity", "p-maple", 5550, 12, t("sample.30Deposit", "Depósito 30%")); rev("bluestar", "p-oak", 12400, 9, t("sample.50Deposit", "Depósito 50%"));

      return { v: 2, createdAt: new Date().toISOString(), users: users, projects: projects, financials: financials, time: time, expenses: exp };
    }

    function registry() { try { var r = JSON.parse(safeGet(REG) || "[]"); return Array.isArray(r) ? r : []; } catch (e) { return []; } }
    function setRegistry(r) { safeSet(REG, JSON.stringify(r)); }
    function allKeys() { return [KEY].concat(registry().map(function (r) { return r.key; })); }
    function readDb(k) { if (k === activeKey && db) return db; try { return JSON.parse(safeGet(k) || "null"); } catch (e) { return null; } }
    function load() {
      var raw = safeGet(activeKey);
      db = null;
      if (raw) { try { db = JSON.parse(raw); } catch (e) { db = null; } }
      if (!db && activeKey !== KEY) { activeKey = KEY; safeSet(ACTIVE, KEY); return load(); } // conta criada que sumiu → volta para a de exemplo
      if (!db) { db = seed(); persist(); }
      applyCompanies();
    }
    // empresas da conta ativa: as pré-configuradas (exemplo) + ajustes de Configurações, ou as criadas no onboarding
    function applyCompanies() {
      var prof = db.companyProfiles || {};
      setCompanies(db.companies && db.companies.length ? clone(db.companies) : BASE_COMPANIES.map(function (c) { return Object.assign({}, c, prof[c.id] || {}); }));
    }
    function switchTo(k) { activeKey = k; safeSet(ACTIVE, k); load(); }
    function persist() {
      // strip large data URLs that don't fit; keep them in memory
      var ok = safeSet(activeKey, JSON.stringify(db));
      if (!ok) {
        var slim = JSON.parse(JSON.stringify(db));
        slim.projects.forEach(function (p) { (p.files || []).forEach(function (f) { if (f.data) { mem[f.id] = f.data; f.data = null; f.memOnly = true; } }); });
        safeSet(activeKey, JSON.stringify(slim));
      }
    }
    function me() { var id = safeGet(SESSION); return db.users.find(function (u) { return u.id === id; }) || null; }
    function pub(u) { return u ? { id: u.id, username: u.username, name: u.name, role: u.role, companyId: u.companyId, rate: u.rate, active: u.active, email: u.email || "", locale: u.locale || "" } : null; }
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function P(v) { return Promise.resolve(v); }
    function staff(u) { return !u || isStaffRole(u.role); }
    function findUser(d, login) { login = String(login || "").trim().toLowerCase(); return d && (d.users || []).find(function (x) { return x.username === login || (x.email && x.email.toLowerCase() === login && x.role === "admin"); }); }
    function loginTaken(login) { return allKeys().some(function (k) { return !!findUser(readDb(k), login); }); }
    function emailTaken(e) { e = String(e || "").trim().toLowerCase(); return allKeys().some(function (k) { var d = readDb(k); return d && (d.users || []).some(function (u) { return (u.email || "").toLowerCase() === e || u.username === e; }); }); }
    function uniqueLogin(base) { var b = slugify(base).replace(/-/g, "") || "user", u = b, n = 2; while (loginTaken(u)) u = b + n++; return u; }
    function trialEnd(from) { var d = new Date(from || Date.now()); d.setDate(d.getDate() + 14); return d.toISOString(); }

    return {
      mode: "demo",
      companies: COMPANIES,
      init: function () { var k = safeGet(ACTIVE); activeKey = k && (k === KEY || safeGet(k)) ? k : KEY; load(); return P(); },
      needsSetup: function () { return P(false); },
      reset: function () { safeDel(KEY); safeDel(SESSION); db = null; activeKey = KEY; safeSet(ACTIVE, KEY); load(); return P(); },
      session: function () { return P(pub(me())); },
      signIn: function (username, pw) {
        var u = findUser(db, username);
        if (!u) { // a conta pode ser outra (exemplo ou uma criada no aparelho)
          var k = allKeys().filter(function (x) { return x !== activeKey; }).find(function (x) { return !!findUser(readDb(x), username); });
          if (k) { switchTo(k); u = findUser(db, username); }
        }
        if (!u || u.password !== pw) return Promise.reject(new Error(t("errors.wrongUsernameOrPassword", "Usuário ou senha incorretos.")));
        if (!u.active) return Promise.reject(new Error(t("errors.thisUserIsDeactivated", "Este usuário está desativado. Fale com o administrador.")));
        safeSet(SESSION, u.id);
        return P(pub(u));
      },
      signOut: function () { safeDel(SESSION); return P(); },
      listUsers: function () { return P(db.users.map(pub)); },
      createUser: function (u) {
        var uname = String(u.username || "").trim().toLowerCase();
        if (!uname) return Promise.reject(new Error(t("errors.enterTheUsername", "Informe o usuário.")));
        if (loginTaken(uname)) return Promise.reject(new Error(t("errors.thatUsernameAlreadyExists", "Esse usuário já existe.")));
        var rec = { id: uid(), username: uname, password: u.password, name: u.name, role: u.role || "employee", companyId: u.companyId, rate: Number(u.rate) || 0, active: true, email: u.email || "" };
        db.users.push(rec); persist(); return P(pub(rec));
      },
      updateUser: function (id, patch) {
        var u = db.users.find(function (x) { return x.id === id; });
        if (!u) return Promise.reject(new Error(t("errors.employeeNotFound", "Funcionário não encontrado.")));
        ["name", "role", "companyId", "rate", "active", "email"].forEach(function (k) { if (patch[k] !== undefined) u[k] = k === "rate" ? Number(patch[k]) || 0 : patch[k]; });
        if (patch.password) u.password = patch.password;
        persist(); return P(pub(u));
      },
      setLocale: function (loc) { var u = me(); if (u) { u.locale = loc; persist(); } return P(); },
      listProjects: function (companyId) {
        var list = db.projects.filter(function (p) { return !companyId || p.companyId === companyId; });
        return P(clone(list));
      },
      saveProject: function (p) {
        var rec = clone(p);
        if (!rec.id) rec.id = uid();
        (rec.tasks || []).forEach(function (t) { if (!t.id) t.id = uid(); });
        var i = db.projects.findIndex(function (x) { return x.id === rec.id; });
        if (i >= 0) { rec.files = db.projects[i].files; db.projects[i] = rec; } else { rec.files = []; db.projects.unshift(rec); }
        persist(); return P(clone(rec));
      },
      deleteProject: function (id, opts) {
        var all = opts && opts.all;
        db.projects = db.projects.filter(function (p) { return p.id !== id; });
        delete db.financials[id];
        db.notices = (db.notices || []).filter(function (x) { return x.projectId !== id; });
        db.schedule = (db.schedule || []).filter(function (x) { return x.projectId !== id; });
        if (all) {
          db.time = db.time.filter(function (x) { return x.projectId !== id; });
          db.expenses = db.expenses.filter(function (x) { return x.projectId !== id; });
          db.events = (db.events || []).filter(function (x) { return x.projectId !== id; });
        } else {
          db.time.forEach(function (x) { if (x.projectId === id) x.projectId = null; });
          db.expenses.forEach(function (x) { if (x.projectId === id) x.projectId = null; });
          (db.events || []).forEach(function (x) { if (x.projectId === id) x.projectId = null; });
        }
        persist(); return P();
      },
      projectFootprint: function (id) {
        var f = function (a) { return (a || []).filter(function (x) { return x.projectId === id; }).length; };
        var p = db.projects.find(function (x) { return x.id === id; }) || {};
        return P({ time: f(db.time), expenses: f(db.expenses), events: f(db.events), notices: f(db.notices), schedule: f(db.schedule), files: (p.files || []).length, tasks: (p.tasks || []).length });
      },
      getFinancials: function () { return P(clone(db.financials)); },
      saveFinancials: function (projectId, f) { db.financials[projectId] = finOut(f); persist(); return P(); },
      setTaskDone: function (projectId, taskId, done, byName) {
        var p = db.projects.find(function (x) { return x.id === projectId; });
        var t = p && p.tasks.find(function (x) { return x.id === taskId; });
        if (t) { t.done = done; t.doneBy = done ? byName : null; t.doneAt = done ? new Date().toISOString() : null; persist(); }
        return P();
      },
      uploadFile: function (projectId, file) {
        return blobToDataURL(file).then(function (d) {
          var p = db.projects.find(function (x) { return x.id === projectId; });
          var rec = { id: uid(), name: file.name, mime: file.type, size: file.size, createdAt: new Date().toISOString(), data: d };
          p.files = p.files || []; p.files.push(rec); persist();
          var out = clone(rec); return out;
        });
      },
      deleteFile: function (projectId, fileId) {
        var p = db.projects.find(function (x) { return x.id === projectId; });
        p.files = (p.files || []).filter(function (f) { return f.id !== fileId; }); delete mem[fileId]; persist(); return P();
      },
      fileUrl: function (f) {
        var d = f.data || mem[f.id];
        if (!d) return P(null);
        try { return P(URL.createObjectURL(dataURLToBlob(d))); } catch (e) { return P(d); }
      },
      listTime: function (q) {
        q = q || {};
        var u = me();
        return P(clone(db.time.filter(function (t) {
          if (u && !staff(u) && t.userId !== u.id) return false;
          if (q.companyId && t.companyId !== q.companyId) return false;
          if (q.userId && t.userId !== q.userId) return false;
          if (q.projectId && t.projectId !== q.projectId) return false;
          if ((q.from || q.to) && !inRange(t.checkIn, q.from, q.to)) return false;
          return true;
        }).sort(function (a, b) { return a.checkIn < b.checkIn ? 1 : -1; })));
      },
      openShift: function (userId) { return P(clone(db.time.find(function (t) { return t.userId === userId && !t.checkOut; }) || null)); },
      clockIn: function (o) {
        var u = me();
        return (o.photo ? blobToDataURL(o.photo) : P(null)).then(function (ph) {
          var rec = { id: uid(), userId: u.id, companyId: u.companyId, projectId: o.projectId || null, checkIn: new Date().toISOString(), checkOut: null, rate: u.rate, inLoc: o.loc, inPhoto: ph };
          db.time.push(rec); persist(); return clone(rec);
        });
      },
      clockOut: function (o) {
        var u = me();
        var t = db.time.find(function (x) { return x.userId === u.id && !x.checkOut; });
        if (!t) return Promise.reject(new Error(NV.t("errors.noOpenPunchIn", "Nenhuma entrada aberta.")));
        return (o.photo ? blobToDataURL(o.photo) : P(null)).then(function (ph) {
          t.checkOut = new Date().toISOString(); t.outLoc = o.loc; t.outPhoto = ph; persist(); return clone(t);
        });
      },
      updateTime: function (id, patch) {
        var t = db.time.find(function (x) { return x.id === id; });
        if (t) { Object.assign(t, patch); persist(); }
        return P();
      },
      photoUrl: function (ref) { return P(ref || null); },
      listExpenses: function (q) {
        q = q || {};
        var u = me();
        return P(clone(db.expenses.filter(function (x) {
          if (u && !staff(u) && x.createdBy !== u.id) return false;
          if (q.companyId && x.companyId !== q.companyId) return false;
          if (q.projectId && x.projectId !== q.projectId) return false;
          if ((q.from || q.to) && !inRange(x.date, q.from, q.to)) return false;
          return true;
        }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })));
      },
      addExpense: function (x) {
        var u = me();
        return (x.receipt ? blobToDataURL(x.receipt) : P(x.receiptPath || null)).then(function (d) {
          var rec = { id: uid(), companyId: x.companyId || u.companyId, projectId: x.projectId || null, kind: x.kind || "expense", category: x.category, amount: Number(x.amount) || 0, vendor: x.vendor || "", date: x.date, note: x.note || "", receipt: d, createdBy: u.id, ai: x.ai || null };
          db.expenses.push(rec); persist(); return clone(rec);
        });
      },
      deleteExpense: function (id) { db.expenses = db.expenses.filter(function (x) { return x.id !== id; }); persist(); return P(); },
      // propostas
      listProposals: function (companyId) { db.proposals = db.proposals || []; return P(clone(db.proposals.filter(function (x) { return !companyId || x.companyId === companyId; }))); },
      saveProposal: function (p) {
        db.proposals = db.proposals || [];
        var rec = clone(p); if (!rec.id) { rec.id = uid(); rec.createdAt = new Date().toISOString(); }
        rec.updatedAt = new Date().toISOString();
        var i = db.proposals.findIndex(function (x) { return x.id === rec.id; });
        if (i >= 0) db.proposals[i] = rec; else db.proposals.unshift(rec);
        persist(); return P(clone(rec));
      },
      deleteProposal: function (id) { db.proposals = (db.proposals || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },
      aiProposal: function () { return P({ error: "DEMO" }); },
      services: function (action) { return P({ error: "DEMO", action: action }); },
      uploadReceipt: function (blob) { return blobToDataURL(blob); },
      readReceipt: function () { return P({ error: "DEMO" }); },
      listNotices: function () { db.notices = db.notices || []; var u = me(); return P(clone(db.notices.filter(function (n) { return staff(u) || n.companyId === u.companyId; })).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })); },
      addNotice: function (n) {
        var u = me(); db.notices = db.notices || [];
        return (n.photo ? blobToDataURL(n.photo) : P(null)).then(function (ph) {
          var rec = { id: uid(), companyId: u.companyId, projectId: n.projectId || null, userId: u.id, authorName: u.name, text: n.text, photo: ph, resolved: false, createdAt: new Date().toISOString() };
          db.notices.unshift(rec); persist(); return clone(rec);
        });
      },
      resolveNotice: function (id, v) { var n = (db.notices || []).find(function (x) { return x.id === id; }); if (n) { n.resolved = v; n.resolvedAt = v ? new Date().toISOString() : null; persist(); } return P(); },
      deleteNotice: function (id) { db.notices = (db.notices || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },
      listEvents: function (from, to) { db.events = db.events || []; return P(clone(db.events.filter(function (e) { return e.date >= from && e.date <= to; }).sort(function (a, b) { return (a.date + (a.start || "")) < (b.date + (b.start || "")) ? -1 : 1; }))); },
      saveEvent: function (e) { db.events = db.events || []; var u = me(), rec = clone(e); if (!rec.id) { rec.id = uid(); rec.createdBy = u.id; rec.createdByName = u.name; } var i = db.events.findIndex(function (x) { return x.id === rec.id; }); if (i >= 0) db.events[i] = rec; else db.events.push(rec); persist(); return P(clone(rec)); },
      deleteEvent: function (id) { db.events = (db.events || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },
      listSchedule: function (from, to) { db.schedule = db.schedule || []; var u = me(); return P(clone(db.schedule.filter(function (x) { return x.date >= from && x.date <= to && (staff(u) || x.userId === u.id); }))); },
      saveShift: function (x) { db.schedule = db.schedule || []; var rec = clone(x); if (!rec.id) rec.id = uid(); var i = db.schedule.findIndex(function (y) { return y.id === rec.id; }); if (i >= 0) db.schedule[i] = rec; else db.schedule.push(rec); persist(); return P(clone(rec)); },
      deleteShift: function (id) { db.schedule = (db.schedule || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },
      // materiais e preços
      listMaterials: function () { db.materials = db.materials || []; return P(clone(db.materials)); },
      saveMaterial: function (m) {
        db.materials = db.materials || [];
        var rec = clone(m); if (!rec.id) { rec.id = uid(); rec.prices = []; }
        var i = db.materials.findIndex(function (x) { return x.id === rec.id; });
        if (i >= 0) { rec.prices = db.materials[i].prices; db.materials[i] = rec; } else db.materials.push(rec);
        persist(); return P(clone(rec));
      },
      saveMaterials: function (list) { var self = this; return list.reduce(function (pr, m) { return pr.then(function () { return self.saveMaterial(m); }); }, P()); },
      deleteMaterial: function (id) { db.materials = (db.materials || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },
      addPrice: function (o) {
        var m = (db.materials || []).find(function (x) { return x.id === o.materialId; });
        var rec = { id: uid(), store: o.store, price: Number(o.price) || 0, date: o.date, note: o.note || "" };
        m.prices = m.prices || []; m.prices.push(rec); persist(); return P(clone(rec));
      },
      deletePrice: function (materialId, priceId) { var m = (db.materials || []).find(function (x) { return x.id === materialId; }); if (m) m.prices = m.prices.filter(function (p) { return p.id !== priceId; }); persist(); return P(); },
      listDeals: function () { return P(clone(db.deals || [])); },
      saveDeal: function (d) { db.deals = db.deals || []; var rec = clone(d); rec.id = rec.id || uid(); var i = db.deals.findIndex(function (x) { return x.id === rec.id; }); if (i >= 0) db.deals[i] = rec; else db.deals.unshift(rec); persist(); return P(clone(rec)); },
      deleteDeal: function (id) { db.deals = (db.deals || []).filter(function (x) { return x.id !== id; }); persist(); return P(); },

      // ── conta / empresa nova (onboarding), configurações e cobrança — modo demonstração: tudo neste aparelho ──
      // org atual: a de exemplo vem marcada com example:true (o checklist de primeiros passos não aparece nela)
      currentOrg: function () {
        if (!db.createdAt) { db.createdAt = new Date().toISOString(); persist(); }
        if (db.org) return clone(db.org);
        return { id: "example", example: true, name: (COMPANIES[0] || {}).name || t("sample.sample", "Exemplo"), plan: "trial", status: "trialing", createdAt: db.createdAt, trialEndsAt: trialEnd(db.createdAt) };
      },
      // passo 1: dono (nome, e-mail, senha). No demo só confere e guarda na memória até criar a empresa.
      signUpOwner: function (o) {
        o = o || {};
        var email = String(o.email || "").trim().toLowerCase();
        if (!String(o.name || "").trim()) return Promise.reject(new Error(t("errors.enterYourName", "Informe o seu nome.")));
        if (!validEmail(email)) return Promise.reject(new Error(t("errors.enterAValidEmail", "Informe um e-mail válido.")));
        if (String(o.password || "").length < 6) return Promise.reject(new Error(t("errors.thePasswordNeedsAt", "A senha precisa ter pelo menos 6 caracteres.")));
        if (emailTaken(email)) return Promise.reject(new Error(t("errors.thereSAlreadyAn", "Já existe uma conta com esse e-mail neste aparelho. Use Entrar.")));
        pendingOwner = { name: String(o.name).trim(), email: email, password: String(o.password) };
        return P({ ok: true, needsEmailConfirm: false });
      },
      // passo 2+3: cria a organização com uma empresa por ramo marcado (os 11 ramos de trades.js), já com logo e cor
      createOrganization: function (o) {
        o = o || {};
        var own = o.owner || pendingOwner;
        if (!own) return Promise.reject(new Error(t("errors.createTheOwnerLogin", "Crie o login do dono primeiro.")));
        var name = String(o.name || "").trim(); if (!name) return Promise.reject(new Error(t("errors.enterTheCompanyName", "Informe o nome da empresa.")));
        var trades = (o.trades || []).filter(function (t) { return TRADES.indexOf(t) >= 0; }); if (!trades.length) return Promise.reject(new Error(t("errors.pickAtLeastOne", "Escolha pelo menos um ramo.")));
        var orgId = "o-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key = "nivela_demo_org_" + orgId, base = slugify(name), used = {};
        var companies = trades.map(function (t) {
          var id = trades.length === 1 ? base : base + "-" + t; while (used[id] || id === "eternity" || id === "bluestar") id += "-2"; used[id] = 1;
          return { id: id, name: trades.length === 1 ? name : name + " " + TRADE_NAME[t], short: name.split(/\s+/)[0], trade: t, logo: o.logo || "", accent: o.accent || "", state: o.state || "", email: own.email, phone: o.phone || "", address: "", license: "" };
        });
        var owner = { id: uid(), username: own.email, email: own.email, password: own.password, name: own.name, role: "admin", companyId: companies[0].id, rate: 0, active: true };
        var now = new Date().toISOString();
        var nd = { v: 2, createdAt: now, org: { id: orgId, name: name, trades: trades, state: o.state || "", plan: "trial", status: "trialing", createdAt: now, trialEndsAt: trialEnd(now), ownerEmail: own.email },
          companies: companies, users: [owner], projects: [], financials: {}, time: [], expenses: [], proposals: [], notices: [], events: [], schedule: [], materials: [], deals: [] };
        if (!safeSet(key, JSON.stringify(nd))) return Promise.reject(new Error(t("errors.notEnoughSpaceOn", "Sem espaço neste aparelho para criar a conta. Tente um logo menor.")));
        var r = registry(); r.push({ id: orgId, key: key, name: name, createdAt: now }); setRegistry(r);
        switchTo(key); safeSet(SESSION, owner.id); pendingOwner = null;
        return P(pub(owner));
      },
      // convites: no demo cria cada funcionário com usuário e senha gerados (para copiar e mandar)
      inviteMembers: function (list) {
        var self = this, out = [];
        return (list || []).filter(function (m) { return m && String(m.name || "").trim(); }).reduce(function (pr, m) {
          return pr.then(function () {
            var first = String(m.name).trim().split(/\s+/)[0], tag = slugify((db.org && db.org.name) || "").split("-")[0];
            var uname = uniqueLogin(first + (tag ? "." + tag : "")), pw = genPassword(), contact = String(m.contact || m.email || m.phone || "").trim();
            return self.createUser({ username: uname, password: pw, name: String(m.name).trim(), role: m.role === "manager" ? "manager" : "employee", companyId: m.companyId || (COMPANIES[0] || {}).id, rate: 0, email: validEmail(contact) ? contact : "" })
              .then(function (u) { out.push({ id: u.id, name: u.name, username: u.username, password: pw, role: u.role, contact: contact }); });
          });
        }, P()).then(function () { return out; });
      },
      // atalho do onboarding: dono + organização + convites, nesta ordem (mesma sequência da versão Supabase)
      createAccount: function (a) {
        var self = this;
        return self.signUpOwner(a.owner).then(function () { return self.createOrganization(Object.assign({}, a.org, { logo: a.logo, accent: a.accent })); })
          .then(function (user) { return self.inviteMembers(a.team || []).then(function (inv) { return { user: user, invites: inv }; }); });
      },
      uploadLogo: function (dataUrl) { return P(dataUrl || ""); }, // demo: o logo já vem como dataURL (redimensionado no canvas)
      saveCompany: function (c) {
        var patch = {}; CO_FIELDS.forEach(function (k) { if (c[k] !== undefined) patch[k] = c[k]; });
        if (patch.trade && TRADES.indexOf(patch.trade) < 0) delete patch.trade;
        if (db.companies && db.companies.length) {
          var x = db.companies.find(function (y) { return y.id === c.id; }); if (!x) return Promise.reject(new Error(t("errors.companyNotFound", "Empresa não encontrada.")));
          Object.assign(x, patch);
        } else { db.companyProfiles = db.companyProfiles || {}; db.companyProfiles[c.id] = Object.assign(db.companyProfiles[c.id] || {}, patch); }
        persist(); applyCompanies();
        return P(clone(COMPANIES.find(function (y) { return y.id === c.id; }) || null));
      },
      saveOrg: function (o) { if (db.org && o && o.name) { db.org.name = String(o.name).trim(); persist(); } return P(this.currentOrg()); },
      billingCheckout: function (plan) { return P({ demo: true, plan: plan }); },
      billingPortal: function () { return P({ demo: true }); },
      deleteAccount: function () {
        if (activeKey === KEY) return Promise.reject(new Error(t("errors.theSampleAccountCan", "A conta de exemplo não pode ser apagada. Use “Restaurar exemplos”.")));
        var k = activeKey; safeDel(k); setRegistry(registry().filter(function (r) { return r.key !== k; })); safeDel(SESSION); switchTo(KEY); return P();
      }
    };
  }

  // ══════════════════════════ SUPABASE ══════════════════════════
  function SupaStore(cfg) {
    var sb = null, profile = null, org = null;
    var QUEUE = "ee_punch_queue", PCACHE = "ee_profile_cache";
    var SAAS = !!cfg.SAAS; // backend multiempresa (supabase-saas/001_multitenant.sql). Sem ele, as funções novas falham com mensagem clara.
    function email(u) { return String(u).trim().toLowerCase() + "@" + cfg.LOGIN_DOMAIN; }
    function chk(r) { if (r.error) throw new Error(friendly(r.error.message, r.error.hint)); return r.data; }
    function friendly(code, detail) {
      var m = String(code || "") + " " + String(detail || "");
      if (/PLAN_LIMIT:users/.test(m)) return t("errors.yourPlanHitIts", "Seu plano chegou ao limite de usuários ativos. Faça upgrade em Configurações → Plano.");
      if (/PLAN_LIMIT:projects/.test(m)) return t("errors.yourPlanHitIts2", "Seu plano chegou ao limite de obras ativas. Conclua uma obra ou faça upgrade.");
      if (/PLAN_LIMIT:companies/.test(m)) return t("errors.yourPlanDoesnT", "Seu plano não permite mais empresas. Faça upgrade.");
      if (/SUBSCRIPTION_INACTIVE/.test(m)) return t("errors.subscriptionInactiveTheApp", "Assinatura inativa: o app está em modo somente leitura. O dono pode regularizar em Configurações → Plano.");
      if (/AI_LIMIT/.test(m)) return t("errors.yourPlanSMonthly", "Limite mensal de IA do plano atingido.");
      return code || detail || t("errors.error", "Erro.");
    }
    function needSaas() { return Promise.reject(new Error(t("errors.thisNeedsTheMulti", "Isso precisa do servidor multiempresa (Supabase com supabase-saas/001_multitenant.sql e SAAS: true no config.js). No modo demonstração funciona neste aparelho."))); }
    function svcFn(name, body) {
      return sb.functions.invoke(name, { body: body }).then(function (r) {
        if (r.error) { var st = r.error.context && r.error.context.status; return { error: st === 404 ? "NOT_DEPLOYED" : "OFFLINE", detail: r.error.message || "" }; }
        return r.data || { error: "FAIL" };
      });
    }
    function fnErr(r) { var e = r && r.error; return new Error(e === "NOT_DEPLOYED" ? t("errors.thisServiceIsnT", "Esse serviço ainda não foi instalado no Supabase.") : e === "OFFLINE" ? t("errors.noConnectionToThe", "Sem conexão com o servidor agora.") : friendly(e, r && r.detail)); }
    // ramo: o banco usa "general" para General Contractor; o app usa "gc"
    function tradeIn(t) { return t === "general" ? "gc" : t; }
    function tradeOut(t) { return t === "gc" ? "general" : t; }
    var ROLE_UI = { owner: "admin", manager: "manager", employee: "employee", admin: "admin" };
    var ROLE_DB = { admin: "owner", manager: "manager", employee: "employee" };
    var CO_BY_SLUG = {}, CO_BY_ID = {};
    function coId(slug) { return slug && CO_BY_SLUG[slug] ? CO_BY_SLUG[slug].uuid : slug; }
    function coSlug(id) { return id && CO_BY_ID[id] ? CO_BY_ID[id].id : id; }
    function publicAsset(path) { return sb.storage.from("org-assets").getPublicUrl(path).data.publicUrl; }
    // org ativa + empresas (só no backend multiempresa); atualiza API.companies no lugar
    function loadOrg() {
      if (!SAAS) return Promise.resolve(null);
      return sb.rpc("current_org").then(function (r) {
        var orgId = chk(r); if (!orgId) { org = null; return null; }
        return Promise.all([sb.from("organizations").select("*").eq("id", orgId).single(), sb.from("companies").select("*").eq("active", true).order("sort").order("created_at")]).then(function (res) {
          org = chk(res[0]);
          var list = chk(res[1]).map(function (c) {
            return { id: c.slug, uuid: c.id, name: c.name, trade: tradeIn(c.trade), short: c.short_name || c.name.split(" ")[0], logo: c.logo_path ? publicAsset(c.logo_path) : (org.logo_path ? publicAsset(org.logo_path) : ""),
              accent: c.accent_color || org.accent_color || "", email: c.email || "", phone: c.phone || "", address: c.address || "", license: c.license_no || "", state: c.state || org.state || "", settings: c.settings || {}, hicReg: (c.settings || {}).hicReg || "" };
          });
          CO_BY_SLUG = {}; CO_BY_ID = {}; list.forEach(function (c) { CO_BY_SLUG[c.id] = c; CO_BY_ID[c.uuid] = c; });
          if (list.length) setCompanies(list);
          return org;
        });
      });
    }

    function mapUser(r) { return r ? { id: r.id, username: r.username, name: r.full_name || r.display_name, role: ROLE_UI[r.role] || "employee", orgRole: r.role, companyId: coSlug(r.company_id), rate: Number(r.hourly_rate) || 0, active: r.active, email: r.email || r.contact_email || "", locale: r.locale || "" } : null; }
    function mapEvent(r) { return { id: r.id, title: r.title, date: r.date, start: r.start_time ? r.start_time.slice(0, 5) : "", end: r.end_time ? r.end_time.slice(0, 5) : "", companyId: r.company_id, projectId: r.project_id, who: r.who, notes: r.notes, done: r.done, createdBy: r.created_by, createdByName: r.created_by_name, createdAt: r.created_at }; }
    function mapShift(r) { return { id: r.id, companyId: r.company_id, userId: r.user_id, date: r.date, projectId: r.project_id, start: r.start_time ? r.start_time.slice(0, 5) : "", note: r.note }; }
    function mapProject(r) {
      return { id: r.id, companyId: r.company_id, name: r.name, client: r.client, address: r.address, lat: r.lat, lng: r.lng, radius: r.radius_m || 150,
        status: r.status, startDate: r.start_date, estCompletion: r.est_completion, details: r.details || {}, scope: r.scope || "", teamNotes: r.team_notes || "",
        tasks: (r.project_tasks || []).sort(function (a, b) { return a.sort - b.sort; }).map(function (t) { return { id: t.id, group: t.grp, label: t.label, done: t.done, doneBy: t.done_by_name, doneAt: t.done_at }; }),
        files: (r.project_files || []).map(function (f) { return { id: f.id, name: f.name, mime: f.mime, size: f.size, path: f.path, createdAt: f.created_at }; }) };
    }
    function mapTime(r) { return { id: r.id, userId: r.user_id, companyId: r.company_id, projectId: r.project_id, checkIn: r.check_in, checkOut: r.check_out, rate: Number(r.rate) || 0,
      inLoc: r.in_lat != null ? { lat: r.in_lat, lng: r.in_lng, ok: true } : { ok: false }, outLoc: r.out_lat != null ? { lat: r.out_lat, lng: r.out_lng, ok: true } : { ok: false }, inPhoto: r.in_photo, outPhoto: r.out_photo }; }
    function mapProposal(r) { return Object.assign({}, r.data || {}, { id: r.id, companyId: r.company_id, number: r.number, status: r.status, total: Number(r.total) || 0, createdAt: r.created_at, updatedAt: r.updated_at, token: r.public_token, sentAt: r.sent_at, acceptedAt: r.accepted_at }); }
    function mapExp(r) { return { id: r.id, companyId: r.company_id, projectId: r.project_id, kind: r.kind, category: r.category, amount: Number(r.amount) || 0, vendor: r.vendor, date: r.date, note: r.note, receipt: r.receipt_path, createdBy: r.created_by, ai: r.ai }; }
    function mapNotice(r) { return { id: r.id, companyId: r.company_id, projectId: r.project_id, userId: r.user_id, authorName: r.author_name, text: r.text, photo: r.photo_path, resolved: r.resolved, resolvedAt: r.resolved_at, createdAt: r.created_at }; }
    function svc(action, body) {
      return sb.functions.invoke("servicos", { body: Object.assign({ action: action, locale: window.NV.locale() }, body || {}) }).then(function (r) {
        if (r.error) { var st = r.error.context && r.error.context.status; return { error: st === 404 ? "NOT_DEPLOYED" : "OFFLINE", detail: r.error.message || "" }; }
        return r.data || { error: "FAIL" };
      });
    }

    function loadLib() {
      if (window.supabase) return Promise.resolve();
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
        s.onload = res; s.onerror = function () { rej(new Error(t("errors.noConnectionToLoad", "Sem conexão para carregar o app. Verifique a internet."))); };
        document.head.appendChild(s);
      });
    }
    function loadProfile() {
      return sb.auth.getUser().then(function (r) {
        var user = r.data && r.data.user;
        if (!user && r.error && (!navigator.onLine || /fetch|network|retryable/i.test((r.error.name || "") + r.error.message))) throw new Error("offline");
        if (!user) { profile = null; return null; }
        if (SAAS) return loadOrg().then(function (o) {
          if (!o) { profile = { id: user.id, needsOnboarding: true, role: "none", active: false }; return profile; }
          return sb.from("members").select("*").eq("id", user.id).eq("org_id", o.id).single().then(function (pr) { profile = mapUser(chk(pr)); profile.orgId = o.id; safeSet(PCACHE, JSON.stringify(profile)); return profile; });
        });
        return sb.from("profiles").select("*").eq("id", user.id).single().then(function (pr) { profile = mapUser(chk(pr)); safeSet(PCACHE, JSON.stringify(profile)); return profile; });
      });
    }
    function upload(bucket, path, blob) {
      return sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false }).then(function (r) { chk(r); return path; });
    }
    function punch(kind, o, when) {
      var path = null;
      var p = o.photo ? upload("punch-photos", profile.id + "/" + Date.now() + "-" + kind + ".jpg", o.photo).then(function (x) { path = x; }) : Promise.resolve();
      return p.then(function () {
        var args = { p_lat: o.loc && o.loc.ok ? o.loc.lat : null, p_lng: o.loc && o.loc.ok ? o.loc.lng : null, p_photo: path, p_time: when || null };
        if (kind === "in") args.p_project_id = o.projectId || null;
        return sb.rpc(kind === "in" ? "clock_in" : "clock_out", args);
      }).then(function (r) { return mapTime(chk(r)); });
    }
    function queue() { try { return JSON.parse(safeGet(QUEUE) || "[]"); } catch (e) { return []; } }
    function enqueue(kind, o) {
      return (o.photo ? blobToDataURL(o.photo) : Promise.resolve(null)).then(function (d) {
        var q = queue(); q.push({ kind: kind, projectId: o.projectId, loc: o.loc, photo: d, at: new Date().toISOString() }); safeSet(QUEUE, JSON.stringify(q));
        return { offline: true, checkIn: kind === "in" ? new Date().toISOString() : null, checkOut: kind === "out" ? new Date().toISOString() : null };
      });
    }
    function flush() {
      var q = queue(); if (!q.length || !profile) return Promise.resolve();
      var item = q[0];
      return punch(item.kind, { projectId: item.projectId, loc: item.loc, photo: item.photo ? dataURLToBlob(item.photo) : null }, item.at)
        .then(function () { var rest = queue().slice(1); safeSet(QUEUE, JSON.stringify(rest)); return flush(); })
        .catch(function () {});
    }

    return {
      mode: "live",
      companies: COMPANIES,
      pendingPunches: function () { return queue().length; },
      init: function () {
        return loadLib().then(function () {
          sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
          window.addEventListener("online", flush);
          return sb.from("companies").select("*").then(function (r) { if (!r.error && r.data && r.data.length) { /* names editable in DB */ r.data.forEach(function (c) { var k = COMPANIES.find(function (x) { return x.id === c.id; }); if (k) k.name = c.name; }); } });
        });
      },
      pendingQueue: function () { return queue(); },
      needsSetup: function () { return sb.rpc("needs_setup").then(function (r) { return !r.error && r.data === true; }).catch(function () { return false; }); },
      setupAdmin: function (o) {
        var uname = String(o.username || "").trim().toLowerCase();
        return sb.auth.signUp({ email: email(uname), password: o.password, options: { data: { username: uname, full_name: o.name } } }).then(function (r) {
          if (r.error) throw new Error(/registered/i.test(r.error.message) ? t("errors.thatUsernameAlreadyExists2", "Esse usuário já existe. Use Entrar.") : r.error.message);
          if (!r.data.session) throw new Error(t("errors.inSupabaseTurnOff", "No Supabase, desligue 'Confirm email' (Authentication → Sign In / Providers → Email) e tente de novo."));
          return sb.rpc("claim_first_admin", { p_name: o.name });
        }).then(function (r) { chk(r); return loadProfile(); });
      },
      session: function () {
        return sb.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          if (!s) return null;
          return loadProfile().then(function (p) { if (p) flush(); return p && p.active ? p : null; }).catch(function () {
            // sem internet: usa o último perfil salvo neste aparelho
            var c = null; try { c = JSON.parse(safeGet(PCACHE) || "null"); } catch (e) {}
            if (c && c.id === s.user.id && c.active) { profile = c; return c; }
            return null;
          });
        }).catch(function () { return null; });
      },
      signIn: function (username, pw) {
        return sb.auth.signInWithPassword({ email: email(username), password: pw }).then(function (r) {
          if (r.error) {
            var m = (r.error.name || "") + " " + (r.error.message || "") + " " + (r.error.status || "");
            if (!navigator.onLine || /fetch|network|retryable|timeout|5\d\d|\b0\b/i.test(m)) throw new Error(t("errors.couldnTConnectTo", "Não foi possível conectar ao servidor. Verifique a internet. Se a internet estiver ok, o banco de dados pode estar pausado: entre no Supabase e clique em Restore project."));
            throw new Error(t("errors.wrongUsernameOrPassword", "Usuário ou senha incorretos."));
          }
          return loadProfile();
        }).then(function (p) {
          if (!p || !p.active) { sb.auth.signOut(); throw new Error(t("errors.thisUserHasnT", "Este usuário ainda não foi ativado pelo administrador.")); }
          flush(); return p;
        });
      },
      signOut: function () { profile = null; safeDel(PCACHE); return sb.auth.signOut(); },
      // idioma de cada pessoa (profiles.locale: pt-BR / en-US); sem a coluna (banco antigo) fica só no aparelho
      setLocale: function (loc) {
        if (!profile || !profile.id) return Promise.resolve();
        profile.locale = loc; safeSet(PCACHE, JSON.stringify(profile));
        return sb.from("profiles").update({ locale: loc }).eq("id", profile.id).then(function (r) { if (r.error && !/locale|column|permission/i.test(r.error.message)) throw new Error(r.error.message); }).catch(function () {});
      },
      listUsers: function () { return sb.from(SAAS ? "members" : "profiles").select("*").order("full_name").then(function (r) { return chk(r).map(mapUser); }); },
      createUser: function (u) {
        if (u.role === "manager" && !SAAS) return Promise.reject(new Error(t("errors.theManagerRoleNeeds", "O papel Gerente precisa do servidor multiempresa (SAAS: true no config.js). Por enquanto use Funcionário ou Administrador.")));
        if (SAAS) return svcFn("convite", { action: "createMember", username: String(u.username).trim().toLowerCase(), password: u.password, full_name: u.name, role: ROLE_DB[u.role] === "owner" ? "manager" : (ROLE_DB[u.role] || "employee"),
            company_id: coId(u.companyId), hourly_rate: Number(u.rate) || 0, email: u.email || null })
          .then(function (r) { if (r.error) throw fnErr(r); var m = mapUser(r.member); if (u.role === "admin" && m) return API.updateUser(m.id, { role: "admin" }); return m; });
        var tmp = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "ee-tmp-signup" } });
        var uname = String(u.username).trim().toLowerCase();
        return tmp.auth.signUp({ email: email(uname), password: u.password, options: { data: { username: uname, full_name: u.name } } }).then(function (r) {
          if (r.error) throw new Error(/registered/i.test(r.error.message) ? t("errors.thatUsernameAlreadyExists", "Esse usuário já existe.") : r.error.message);
          if (!r.data.user || (r.data.user.identities && r.data.user.identities.length === 0)) throw new Error(t("errors.thatUsernameAlreadyExists", "Esse usuário já existe."));
          var id = r.data.user.id;
          var row = { full_name: u.name, role: u.role || "employee", company_id: u.companyId, hourly_rate: Number(u.rate) || 0, active: true, email: u.email || null };
          return sb.from("profiles").update(row).eq("id", id).select().single().then(function (r2) { if (r2.error && /email/i.test(r2.error.message)) { delete row.email; return sb.from("profiles").update(row).eq("id", id).select().single(); } return r2; });
        }).then(function (r) { return mapUser(chk(r)); });
      },
      updateUser: function (id, patch) {
        if (patch.role === "manager" && !SAAS) return Promise.reject(new Error(t("errors.theManagerRoleNeeds", "O papel Gerente precisa do servidor multiempresa (SAAS: true no config.js). Por enquanto use Funcionário ou Administrador.")));
        if (SAAS) { // backend multiempresa: membership + set_member_role (docs/03b §6)
          var mrow = {};
          if (patch.name !== undefined) mrow.display_name = patch.name;
          if (patch.companyId !== undefined) mrow.company_id = coId(patch.companyId);
          if (patch.rate !== undefined) mrow.hourly_rate = Number(patch.rate) || 0;
          if (patch.active !== undefined) mrow.active = patch.active;
          if (patch.email !== undefined) mrow.contact_email = patch.email || null;
          var q = Object.keys(mrow).length ? sb.from("memberships").update(mrow).eq("user_id", id).eq("org_id", profile.orgId).then(chk) : Promise.resolve();
          if (patch.role !== undefined) q = q.then(function () { return sb.rpc("set_member_role", { p_user: id, p_role: ROLE_DB[patch.role] || "employee" }).then(chk); });
          if (patch.password) q = q.then(function () { return sb.rpc("admin_set_password", { p_user_id: id, p_password: patch.password }).then(chk); });
          return q.then(function () { return sb.from("members").select("*").eq("id", id).eq("org_id", profile.orgId).single(); }).then(function (r) { return mapUser(chk(r)); });
        }
        var row = {};
        if (patch.name !== undefined) row.full_name = patch.name;
        if (patch.role !== undefined) row.role = patch.role;
        if (patch.companyId !== undefined) row.company_id = patch.companyId;
        if (patch.rate !== undefined) row.hourly_rate = Number(patch.rate) || 0;
        if (patch.active !== undefined) row.active = patch.active;
        if (patch.email !== undefined) row.email = patch.email || null;
        var p = sb.from("profiles").update(row).eq("id", id).select().single().then(function (r) {
          if (r.error && /email/i.test(r.error.message) && row.email !== undefined) { delete row.email; return sb.from("profiles").update(row).eq("id", id).select().single(); }
          return r;
        }).then(function (r) { return mapUser(chk(r)); });
        if (patch.password) {
          p = p.then(function (u) { return sb.rpc("admin_set_password", { p_user_id: id, p_password: patch.password }).then(function (r) { chk(r); return u; }); });
        }
        return p;
      },
      listProjects: function (companyId) {
        var q = sb.from("projects").select("*, project_tasks(*), project_files(*)").order("created_at", { ascending: false });
        if (companyId) q = q.eq("company_id", companyId);
        return q.then(function (r) { return chk(r).map(mapProject); });
      },
      saveProject: function (p) {
        var id = p.id || uid();
        var row = { id: id, company_id: p.companyId, name: p.name, client: p.client || null, address: p.address || null, lat: p.lat, lng: p.lng, radius_m: Number(p.radius) || 150,
          status: p.status || "Active", start_date: p.startDate || null, est_completion: p.estCompletion || null, details: p.details || {}, scope: p.scope || "", team_notes: p.teamNotes || "" };
        var tasks = (p.tasks || []).map(function (t, i) { return { id: t.id || uid(), project_id: id, grp: t.group, label: t.label, done: !!t.done, done_by_name: t.doneBy || null, done_at: t.doneAt || null, sort: i }; });
        return sb.from("projects").upsert(row).then(chk).then(function () {
          var keep = tasks.map(function (t) { return t.id; });
          var del = sb.from("project_tasks").delete().eq("project_id", id);
          if (keep.length) del = del.not("id", "in", "(" + keep.join(",") + ")");
          return del;
        }).then(chk).then(function () { return tasks.length ? sb.from("project_tasks").upsert(tasks).then(chk) : null; })
          .then(function () { return sb.from("projects").select("*, project_tasks(*), project_files(*)").eq("id", id).single(); })
          .then(function (r) { return mapProject(chk(r)); });
      },
      // opts.all = true → apaga também ponto, gastos/notas (com fotos), compromissos da agenda e arquivos
      deleteProject: function (id, opts) {
        var all = opts && opts.all, ok = function (r) { return r; };
        var files = sb.from("project_files").select("path").eq("project_id", id).then(function (r) {
          var paths = (r.data || []).map(function (f) { return f.path; }).filter(Boolean);
          return paths.length ? sb.storage.from("project-files").remove(paths).then(ok, ok) : null;
        }, ok);
        var extra = !all ? Promise.resolve() : Promise.all([
          sb.from("expenses").select("receipt_path").eq("project_id", id).then(function (r) {
            var paths = (r.data || []).map(function (x) { return x.receipt_path; }).filter(Boolean);
            return (paths.length ? sb.storage.from("receipts").remove(paths).then(ok, ok) : Promise.resolve()).then(function () { return sb.from("expenses").delete().eq("project_id", id).then(chk); });
          }),
          sb.from("time_entries").delete().eq("project_id", id).then(chk),
          sb.from("calendar_events").delete().eq("project_id", id).then(ok, ok),
          sb.from("notices").select("photo_path").eq("project_id", id).then(function (r) {
            var paths = (r.data || []).map(function (x) { return x.photo_path; }).filter(Boolean);
            return paths.length ? sb.storage.from("notice-photos").remove(paths).then(ok, ok) : null;
          }, ok)
        ]);
        return Promise.all([files, extra]).then(function () { return sb.from("projects").delete().eq("id", id).then(chk); });
      },
      projectFootprint: function (id) {
        var c = function (t) { return sb.from(t).select("id", { count: "exact", head: true }).eq("project_id", id).then(function (r) { return r.count || 0; }, function () { return 0; }); };
        return Promise.all([c("time_entries"), c("expenses"), c("calendar_events"), c("notices"), c("work_schedule"), c("project_files"), c("project_tasks")]).then(function (n) {
          return { time: n[0], expenses: n[1], events: n[2], notices: n[3], schedule: n[4], files: n[5], tasks: n[6] };
        });
      },
      getFinancials: function () {
        return sb.from("project_financials").select("*").then(function (r) {
          var out = {}; chk(r).forEach(function (f) { out[f.project_id] = { contractValue: Number(f.contract_value) || 0, budget: Number(f.budget) || 0, estHours: Number(f.est_hours) || 0, materialBudget: Number(f.material_budget) || 0, laborBudget: Number(f.labor_budget) || 0, clientEmail: f.client_email || "", clientPhone: f.client_phone || "", dailyReport: f.daily_report !== false, lastReportAt: f.last_report_at }; }); return out;
        });
      },
      saveFinancials: function (projectId, f) { var o = finOut(f); return sb.from("project_financials").upsert({ project_id: projectId, contract_value: o.contractValue, budget: o.budget, est_hours: o.estHours, material_budget: o.materialBudget, labor_budget: o.laborBudget, client_email: o.clientEmail || null, client_phone: o.clientPhone || null, daily_report: o.dailyReport }).then(chk); },
      setTaskDone: function (projectId, taskId, done) { return sb.rpc("set_task_done", { p_task_id: taskId, p_done: done }).then(chk); },
      uploadFile: function (projectId, file) {
        var fid = uid();
        var path = projectId + "/" + fid + "-" + file.name.replace(/[^\w.\-]+/g, "_");
        return upload("project-files", path, file).then(function () {
          return sb.from("project_files").insert({ id: fid, project_id: projectId, name: file.name, mime: file.type, size: file.size, path: path }).select().single();
        }).then(function (r) { var f = chk(r); return { id: f.id, name: f.name, mime: f.mime, size: f.size, path: f.path, createdAt: f.created_at }; });
      },
      deleteFile: function (projectId, fileId) {
        return sb.from("project_files").select("path").eq("id", fileId).single().then(function (r) {
          var path = chk(r).path; return sb.storage.from("project-files").remove([path]);
        }).then(function () { return sb.from("project_files").delete().eq("id", fileId); }).then(chk);
      },
      fileUrl: function (f) { return sb.storage.from("project-files").createSignedUrl(f.path, 3600).then(function (r) { return chk(r).signedUrl; }); },
      listTime: function (q) {
        q = q || {};
        var s = sb.from("time_entries").select("*").order("check_in", { ascending: false }).limit(2000);
        if (q.companyId) s = s.eq("company_id", q.companyId);
        if (q.userId) s = s.eq("user_id", q.userId);
        if (q.projectId) s = s.eq("project_id", q.projectId);
        if (q.from) s = s.gte("check_in", q.from + "T00:00:00");
        if (q.to) s = s.lte("check_in", q.to + "T23:59:59");
        return s.then(function (r) { return chk(r).map(mapTime); });
      },
      openShift: function (userId) {
        return sb.from("time_entries").select("*").eq("user_id", userId).is("check_out", null).order("check_in", { ascending: false }).limit(1)
          .then(function (r) { var d = chk(r); return d.length ? mapTime(d[0]) : null; });
      },
      clockIn: function (o) { return punch("in", o).catch(function (e) { if (!navigator.onLine || /fetch|network/i.test(e.message)) return enqueue("in", o); throw e; }); },
      clockOut: function (o) { return punch("out", o).catch(function (e) { if (!navigator.onLine || /fetch|network/i.test(e.message)) return enqueue("out", o); throw e; }); },
      updateTime: function (id, patch) {
        var row = {};
        if (patch.checkIn !== undefined) row.check_in = patch.checkIn;
        if (patch.checkOut !== undefined) row.check_out = patch.checkOut;
        if (patch.projectId !== undefined) row.project_id = patch.projectId;
        return sb.from("time_entries").update(row).eq("id", id).then(chk);
      },
      photoUrl: function (path, bucket) {
        if (!path) return Promise.resolve(null);
        return sb.storage.from(bucket || "punch-photos").createSignedUrl(path, 3600).then(function (r) { return r.error ? null : r.data.signedUrl; });
      },
      listExpenses: function (q) {
        q = q || {};
        var s = sb.from("expenses").select("*").order("date", { ascending: false }).limit(3000);
        if (q.companyId) s = s.eq("company_id", q.companyId);
        if (q.projectId) s = s.eq("project_id", q.projectId);
        if (q.from) s = s.gte("date", q.from);
        if (q.to) s = s.lte("date", q.to);
        return s.then(function (r) { return chk(r).map(mapExp); });
      },
      addExpense: function (x) {
        var id = uid();
        var p = x.receipt ? upload("receipts", profile.id + "/" + id + ".jpg", x.receipt) : Promise.resolve(x.receiptPath || null);
        return p.then(function (path) {
          return sb.from("expenses").insert({ id: id, company_id: x.companyId || profile.companyId, project_id: x.projectId || null, kind: x.kind || "expense", category: x.category,
            amount: Number(x.amount) || 0, vendor: x.vendor || null, date: x.date, note: x.note || null, receipt_path: path, created_by: profile.id, ai: x.ai || null }).select().single();
        }).then(function (r) { return mapExp(chk(r)); });
      },
      deleteExpense: function (id) { return sb.from("expenses").delete().eq("id", id).then(chk); },
      services: svc,
      uploadReceipt: function (blob) { return upload("receipts", profile.id + "/nota-" + Date.now() + ".jpg", blob); },
      readReceipt: function (path) { return svc("readReceipt", { path: path }); },
      listNotices: function () { return sb.from("notices").select("*").order("created_at", { ascending: false }).limit(500).then(function (r) { return chk(r).map(mapNotice); }); },
      addNotice: function (n) {
        var id = uid();
        var p = n.photo ? upload("notice-photos", profile.id + "/" + id + ".jpg", n.photo) : Promise.resolve(null);
        return p.then(function (path) {
          return sb.from("notices").insert({ id: id, company_id: profile.companyId, project_id: n.projectId || null, user_id: profile.id, author_name: profile.name, text: n.text, photo_path: path }).select().single();
        }).then(function (r) { var rec = mapNotice(chk(r)); svc("notifyNotice", { id: rec.id }); return rec; });
      },
      resolveNotice: function (id, v) { return sb.from("notices").update({ resolved: v, resolved_at: v ? new Date().toISOString() : null }).eq("id", id).then(chk); },
      deleteNotice: function (id) { return sb.from("notices").delete().eq("id", id).then(chk); },
      // agenda dos sócios
      listEvents: function (from, to) { return sb.from("calendar_events").select("*").gte("date", from).lte("date", to).order("date").order("start_time", { nullsFirst: true }).then(function (r) { return chk(r).map(mapEvent); }); },
      saveEvent: function (e) {
        var row = { title: e.title, date: e.date, start_time: e.start || null, end_time: e.end || null, company_id: e.companyId || null, project_id: e.projectId || null, who: e.who || "todos", notes: e.notes || null, done: !!e.done, updated_at: new Date().toISOString() };
        if (e.id) row.id = e.id; else { row.created_by = profile.id; row.created_by_name = profile.name; }
        return sb.from("calendar_events").upsert(row).select().single().then(function (r) { var ev = mapEvent(chk(r)); if (!e.id || e.notify) { var mail = svc("notifyCalendar", { id: ev.id, changed: !!e.id }).catch(function () { return { error: "OFFLINE" }; }); try { Object.defineProperty(ev, "mail", { value: mail, enumerable: false }); } catch (x) {} } return ev; }); // ev.mail: resposta do envio do e-mail (o app só diz "enviado" quando ela confirma)
      },
      deleteEvent: function (id) { return sb.from("calendar_events").delete().eq("id", id).then(chk); },
      // escala
      listSchedule: function (from, to) { return sb.from("work_schedule").select("*").gte("date", from).lte("date", to).order("date").then(function (r) { return chk(r).map(mapShift); }); },
      saveShift: function (x) {
        var row = { company_id: x.companyId, user_id: x.userId, date: x.date, project_id: x.projectId || null, start_time: x.start || null, note: x.note || null };
        if (x.id) row.id = x.id;
        return sb.from("work_schedule").upsert(row).select().single().then(function (r) { return mapShift(chk(r)); });
      },
      deleteShift: function (id) { return sb.from("work_schedule").delete().eq("id", id).then(chk); },
      // propostas
      listProposals: function (companyId) {
        var q = sb.from("proposals").select("*").order("updated_at", { ascending: false });
        if (companyId) q = q.eq("company_id", companyId);
        return q.then(function (r) { return chk(r).map(mapProposal); });
      },
      saveProposal: function (p) {
        var id = p.id || uid();
        var data = JSON.parse(JSON.stringify(p)); ["id", "companyId", "number", "status", "total", "createdAt", "updatedAt"].forEach(function (k) { delete data[k]; });
        return sb.from("proposals").upsert({ id: id, company_id: p.companyId, number: p.number || null, status: p.status || "Rascunho", total: Number(p.total) || 0, data: data, updated_at: new Date().toISOString() })
          .select().single().then(function (r) { return mapProposal(chk(r)); });
      },
      deleteProposal: function (id) { return sb.from("proposals").delete().eq("id", id).then(chk); },
      aiProposal: function (body) {
        return sb.functions.invoke("montar-proposta", { body: body }).then(function (r) {
          if (r.error) { var st = r.error.context && r.error.context.status; return { error: st === 404 ? "NOT_DEPLOYED" : "OFFLINE", detail: r.error.message || "" }; }
          return r.data || { error: "FAIL" };
        });
      },
      // materiais e preços
      listMaterials: function () {
        return sb.from("materials").select("*, material_prices(*)").order("name").then(function (r) {
          return chk(r).map(function (m) { return { id: m.id, name: m.name, category: m.category, unit: m.unit, prices: (m.material_prices || []).map(function (p) { return { id: p.id, store: p.store, price: Number(p.price), date: p.date, note: p.note }; }) }; });
        });
      },
      saveMaterial: function (m) {
        var row = { name: m.name, category: m.category || null, unit: m.unit || null };
        if (m.id) row.id = m.id;
        return sb.from("materials").upsert(row).select().single().then(function (r) { var x = chk(r); return { id: x.id, name: x.name, category: x.category, unit: x.unit, prices: m.prices || [] }; });
      },
      saveMaterials: function (list) {
        return sb.from("materials").insert(list.map(function (m) { return { name: m.name, category: m.category || null, unit: m.unit || null }; })).then(chk);
      },
      deleteMaterial: function (id) { return sb.from("materials").delete().eq("id", id).then(chk); },
      addPrice: function (o) {
        return sb.from("material_prices").insert({ material_id: o.materialId, store: o.store, price: Number(o.price) || 0, date: o.date, note: o.note || null }).select().single().then(function (r) { return chk(r); });
      },
      deletePrice: function (materialId, priceId) { return sb.from("material_prices").delete().eq("id", priceId).then(chk); },
      listDeals: function () {
        return sb.from("deals").select("*").order("created_at", { ascending: false }).then(function (r) {
          return chk(r).map(function (d) { return { id: d.id, store: d.store, title: d.title, price: d.price == null ? null : Number(d.price), wasPrice: d.was_price == null ? null : Number(d.was_price), image: d.image_url, source: d.source, validUntil: d.valid_until, url: d.url, note: d.note, createdAt: d.created_at, fetchedAt: d.fetched_at }; });
        });
      },
      saveDeal: function (d) {
        var row = { store: d.store, title: d.title, price: d.price === "" || d.price == null ? null : Number(d.price), valid_until: d.validUntil || null, url: d.url || null, note: d.note || null };
        if (d.id) row.id = d.id;
        return sb.from("deals").upsert(row).then(chk);
      },
      deleteDeal: function (id) { return sb.from("deals").delete().eq("id", id).then(chk); },
      // promoções coletadas (substitui as automáticas de uma loja)
      replaceAutoDeals: function (store, items) {
        var now = new Date().toISOString();
        return sb.from("deals").delete().eq("source", "auto").eq("store", store).then(chk).then(function () {
          if (!items.length) return [];
          return sb.from("deals").insert(items.map(function (d) { return { store: store, title: String(d.title).slice(0, 300), price: d.price == null ? null : Number(d.price), was_price: d.was_price == null ? null : Number(d.was_price), image_url: d.image_url || null, url: d.url || null, note: d.note || null, valid_until: d.valid_until || null, source: "auto", fetched_at: now }; })).then(chk);
        });
      },

      // ── conta / empresa nova, configurações e cobrança (docs/03b §4, §5, §11) — só com o backend multiempresa ──
      currentOrg: function () {
        if (!org) return null;
        return { id: org.id, name: org.name, slug: org.slug, plan: org.plan || "trial", status: org.subscription_status || "trialing", createdAt: org.created_at, trialEndsAt: org.trial_ends_at, periodEnd: org.current_period_end, example: false };
      },
      signUpOwner: function (o) {
        if (!SAAS) return needSaas();
        return sb.auth.signUp({ email: String(o.email || "").trim().toLowerCase(), password: o.password,
          options: { data: { full_name: o.name, locale: o.locale || window.NV.locale() }, emailRedirectTo: location.origin + location.pathname + "?onboarding=1" } })
          .then(function (r) {
            if (r.error) throw new Error(/registered/i.test(r.error.message) ? t("errors.thereSAlreadyAn2", "Já existe uma conta com esse e-mail. Use Entrar.") : r.error.message);
            return { ok: true, needsEmailConfirm: !r.data.session };
          });
      },
      createOrganization: function (o) {
        if (!SAAS) return needSaas();
        var self = this, trades = (o.trades || []).length ? o.trades : ["electrical"];
        return sb.rpc("create_organization", { p_name: o.name, p_trade: tradeOut(trades[0]), p_locale: o.locale || window.NV.locale(),
            p_company_name: trades.length > 1 ? o.name + " " + TRADE_NAME[trades[0]] : o.name, p_accent_color: o.accent || null,
            p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, p_reply_to: (o.owner && o.owner.email) || null })
          .then(chk).then(loadOrg)
          .then(function () { // um ramo a mais = uma empresa a mais na mesma conta (respeita PLAN_LIMIT:companies)
            return trades.slice(1).reduce(function (pr, t) { return pr.then(function () { return self.saveCompany({ id: slugify(o.name) + "-" + t, name: o.name + " " + TRADE_NAME[t], trade: t, accent: o.accent || "", state: o.state || "" }); }); }, Promise.resolve());
          })
          .then(function () { return o.logo ? self.uploadLogo(o.logo).then(function (path) { return self.saveOrg({ logoPath: path }); }) : null; })
          .then(loadProfile);
      },
      inviteMembers: function (list) {
        if (!SAAS) return needSaas();
        var out = [];
        return (list || []).filter(function (m) { return m && String(m.name || "").trim(); }).reduce(function (pr, m) {
          return pr.then(function () {
            var contact = String(m.contact || "").trim(), uname = slugify(String(m.name).split(/\s+/)[0]).replace(/-/g, "") + Math.floor(10 + Math.random() * 89), pw = genPassword();
            return svcFn("convite", { action: "createMember", username: uname, password: pw, full_name: String(m.name).trim(), role: m.role === "manager" ? "manager" : "employee",
              company_id: coId(m.companyId || (COMPANIES[0] || {}).id), hourly_rate: 0, email: validEmail(contact) ? contact : null })
              .then(function (r) { if (r.error) throw fnErr(r); out.push({ id: (r.member || {}).id, name: m.name, username: uname, password: pw, role: m.role === "manager" ? "manager" : "employee", contact: contact, orgCode: org && org.slug }); });
          });
        }, Promise.resolve()).then(function () { return out; });
      },
      createAccount: function (a) {
        if (!SAAS) return needSaas();
        var self = this;
        return self.signUpOwner(a.owner).then(function (r) {
          if (r.needsEmailConfirm) throw new Error(t("errors.weSentAConfirmation", "Enviamos um link de confirmação para ") + a.owner.email + t("errors.openTheEmailConfirm", ". Abra o e-mail, confirme e entre de novo para terminar a configuração da empresa."));
          return self.createOrganization(Object.assign({}, a.org, { logo: a.logo, accent: a.accent, owner: a.owner }));
        }).then(function (user) { return self.inviteMembers(a.team || []).then(function (inv) { return { user: user, invites: inv }; }); });
      },
      uploadLogo: function (img, companySlug) {
        if (!SAAS) return needSaas();
        var blob = typeof img === "string" ? dataURLToBlob(img) : img;
        var path = org.id + "/" + (companySlug ? "companies/" + coId(companySlug) : "logo") + "-" + Date.now() + ".png";
        return sb.storage.from("org-assets").upload(path, blob, { contentType: blob.type || "image/png", upsert: true }).then(chk).then(function () { return path; });
      },
      saveOrg: function (o) {
        if (!SAAS) return needSaas();
        var row = {}; if (o.name) row.name = o.name; if (o.accent !== undefined) row.accent_color = o.accent || null; if (o.logoPath) row.logo_path = o.logoPath;
        if (o.phone !== undefined) row.phone = o.phone || null; if (o.address !== undefined) row.address = o.address || null;
        return sb.from("organizations").update(row).eq("id", org.id).then(chk).then(loadOrg);
      },
      saveCompany: function (c) {
        if (!SAAS) return needSaas();
        var self = this, logoP = c.logo && /^data:/.test(c.logo) ? self.uploadLogo(c.logo, c.id) : Promise.resolve(null);
        return logoP.then(function (path) {
          var row = { slug: c.id, name: c.name, trade: c.trade ? tradeOut(c.trade) : undefined, short_name: c.short || null, accent_color: c.accent || null, email: c.email || null,
            license_no: c.license || null, address: c.address || null, phone: c.phone || null };
          // opções da empresa ficam em companies.settings (jsonb), sem apagar o que já estiver lá
          // (todas as opções do ramo — companyFlags — e o nº de registro HIC de MA; antes só noGas era gravado)
          var setx = {}; window.NV.tradeList().forEach(function (td) { td.companyFlags.forEach(function (f) { if (c[f.key] !== undefined) setx[f.key] = !!c[f.key]; }); });
          if (c.hicReg !== undefined) setx.hicReg = String(c.hicReg || "").trim();
          if (Object.keys(setx).length) row.settings = Object.assign({}, (CO_BY_SLUG[c.id] || {}).settings || {}, setx);
          if (path) row.logo_path = path; else if (c.logo === "") row.logo_path = null;
          Object.keys(row).forEach(function (k) { if (row[k] === undefined) delete row[k]; });
          if (CO_BY_SLUG[c.id]) row.id = CO_BY_SLUG[c.id].uuid;
          return sb.from("companies").upsert(row).then(chk);
        }).then(loadOrg).then(function () { return COMPANIES.find(function (x) { return x.id === c.id; }) || null; });
      },
      billingCheckout: function (plan) {
        if (!SAAS) return needSaas();
        return svcFn("billing", { action: "checkout", plan: plan }).then(function (r) { if (r.error) throw fnErr(r); return { url: r.url }; });
      },
      billingPortal: function () {
        if (!SAAS) return needSaas();
        return svcFn("billing", { action: "portal" }).then(function (r) { if (r.error) throw fnErr(r); return { url: r.url }; });
      },
      deleteAccount: function () {
        if (!SAAS) return needSaas();
        return svcFn("conta", { action: "delete" }).then(function (r) { if (r.error) throw fnErr(r); return sb.auth.signOut(); });
      }
    };
  }

  var cfg = window.APP_CONFIG || {};
  window.API = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? SupaStore(cfg) : DemoStore();
  window.API.hoursOf = hoursOf;
})();
