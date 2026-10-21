/* Data layer: one interface, two backends.
   - DemoStore: everything in this device's storage, seeded with clearly-marked example data.
   - SupaStore: Supabase (Postgres + Auth + Storage) with row-level security.
   The UI (app.js) only talks to window.API. */
(function () {
  "use strict";

  var COMPANIES = [
    { id: "eternity", name: "Eternity Electric", trade: "electrical", short: "Eternity" },
    { id: "bluestar", name: "Blue Star HVAC", trade: "hvac", short: "Blue Star" }
  ];

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
        { id: "u-lucas", username: "lucas", password: "1234", name: "Lucas Reis", role: "employee", companyId: "bluestar", rate: 26, active: true }
      ];

      function tasksFrom(list, doneCount) {
        return list.map(function (t, i) { return { id: uid(), group: t[0], label: t[1], done: i < doneCount, doneBy: i < doneCount ? "João Silva" : null, doneAt: i < doneCount ? dateAgo(10 - Math.min(i, 9)) : null }; });
      }

      var projects = [
        {
          id: "p-elm", companyId: "eternity", name: "EXEMPLO · 14 Elm St", client: "Cliente Exemplo LLC",
          address: "14 Elm St, Worcester, MA", lat: 42.2626, lng: -71.8023, radius: 150, status: "Active",
          startDate: dateAgo(26), estCompletion: dateAgo(-30),
          details: { sector: "Residencial", workType: "New Construction", building: "Two-family", bedrooms: "3", bathrooms: "2", units: "2", floors: "3", sqft: "2800",
            permit: "Sim, já aprovado", permitNo: "E-2026-0412", walls: "Abertas (sem drywall)", occupied: "Desocupado",
            wiring: ["Romex (NM-B)"], serviceAmps: "200A", serviceType: "Novo serviço", serviceFeed: "Subterrâneo", utility: "National Grid", panel: "Square D Homeline", fireAlarm: "Sim", lowVoltage: "Sim", extras: ["Carregador EV"] },
          scope: "Escopo conforme contrato:\n• Elétrica completa para dois apartamentos (2 x 200A), com medidores separados.\n• Rough-in e acabamento em todos os cômodos conforme planta E-1 e E-2.\n• Detectores de fumaça/CO interligados conforme código.\n• Circuito dedicado para condensadoras (2) e carregador EV na garagem.\n• Não incluso: luminárias decorativas (fornecidas pelo cliente).",
          teamNotes: "Chave na caixa de segredo da porta dos fundos. Usar Romex 12/2 na cozinha. Inspeção rough marcada para quinta.",
          tasks: tasksFrom([["Serviço", "Upgrade / instalação de serviço"], ["Serviço", "Meter socket"], ["Serviço", "Aterramento (ground rods / bonding)"], ["Rough-in", "Rough-in elétrico"], ["Rough-in", "Circuitos dedicados da cozinha"], ["Rough-in", "Circuitos AFCI dos quartos"], ["Rough-in", "Detectores de fumaça / CO"], ["Rough-in", "Circuito da condensadora (HVAC)"], ["Rough-in", "Carregador EV"], ["Inspeções", "Inspeção rough"], ["Acabamento", "Instalar tomadas e interruptores"], ["Acabamento", "Instalar luminárias"], ["Inspeções", "Inspeção final"]], 6),
          files: []
        },
        {
          id: "p-maple", companyId: "eternity", name: "EXEMPLO · 88 Maple Ave", client: "Cliente Exemplo (proprietário)",
          address: "88 Maple Ave, Shrewsbury, MA", lat: 42.2959, lng: -71.7129, radius: 150, status: "Active",
          startDate: dateAgo(12), estCompletion: dateAgo(-10),
          details: { sector: "Residencial", workType: "Remodel", building: "Single family", bedrooms: "4", bathrooms: "2.5", floors: "2", sqft: "2200",
            permit: "Sim, já aprovado", permitNo: "SH-E-1187", walls: "Parcialmente abertas", occupied: "Ocupado (família morando)",
            wiring: ["Romex (NM-B)", "MC Cable"], serviceAmps: "200A", serviceType: "Upgrade (100A → 200A)", serviceFeed: "Aéreo", utility: "Eversource", panel: "Eaton BR", fireAlarm: "Não", lowVoltage: "Não", extras: [] },
          scope: "Reforma da cozinha e dois banheiros + upgrade do serviço de 100A para 200A.\n• Trocar todas as tomadas e interruptores da casa (decorator branco).\n• 8 recessed na cozinha, 2 pendentes na ilha.\n• GFCI em todos os balcões.",
          teamNotes: "Casa ocupada — proteger o piso, desligar energia só com aviso de 1h. Cachorro no quintal.",
          tasks: tasksFrom([["Serviço", "Upgrade / instalação de serviço"], ["Serviço", "Troca de painel"], ["Rough-in", "Circuitos dedicados da cozinha"], ["Rough-in", "Circuito do banheiro (GFCI)"], ["Rough-in", "Iluminação recessed"], ["Acabamento", "Trocar tomadas"], ["Acabamento", "Trocar interruptores"], ["Inspeções", "Inspeção final"]], 2),
          files: []
        },
        {
          id: "p-oak", companyId: "bluestar", name: "EXEMPLO · 8 Oak Ave", client: "Cliente Exemplo (proprietário)",
          address: "8 Oak Ave, Watertown, MA", lat: 42.3709, lng: -71.1828, radius: 150, status: "Active",
          startDate: dateAgo(9), estCompletion: dateAgo(-12),
          details: { sector: "Residencial", workType: "Substituição de equipamento", building: "Single family", bedrooms: "3", bathrooms: "2", floors: "2", sqft: "1900",
            permit: "Sim, já aprovado", permitNo: "WT-M-2210", walls: "Fechadas (acabadas)", occupied: "Ocupado (família morando)",
            equipment: ["Heat pump ducted", "Air handler"], capacity: "36,000 BTU (3 ton)", zones: "2", brand: "Mitsubishi", fuel: "Elétrico (heat pump)", ducts: "Aproveitar dutos existentes", lineSet: "Novo line set (35 ft)", thermostat: "2 termostatos Wi-Fi", manualJ: "Sim", rebate: "Sim, Mass Save", electricalBy: "Eternity Electric" },
          scope: "Substituir fornalha a óleo por heat pump ducted 3 ton com air handler no porão.\n• 2 zonas com dampers.\n• Selar e isolar dutos acessíveis no porão.\n• Remoção do tanque de óleo por terceiros (não incluso).",
          teamNotes: "Entrada pelo porão (porta lateral). Elétrica do circuito feita pela Eternity.",
          tasks: tasksFrom([["Remoção", "Remover equipamento antigo"], ["Equipamento", "Instalar condensadora / heat pump"], ["Equipamento", "Instalar air handler"], ["Distribuição", "Line set"], ["Distribuição", "Isolamento e vedação de dutos"], ["Controles", "Zoneamento"], ["Controles", "Termostatos"], ["Comissionamento", "Teste de pressão (nitrogênio)"], ["Comissionamento", "Vácuo"], ["Comissionamento", "Start-up e teste"], ["Comissionamento", "Documentação Mass Save"]], 3),
          files: []
        }
      ];

      var financials = {
        "p-elm": { contractValue: 62000, budget: 41000, estHours: 520 },
        "p-maple": { contractValue: 18500, budget: 11500, estHours: 150 },
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
      e("eternity", "p-elm", "material", 2210.00, "City Electric Supply", 9); e("eternity", "p-elm", "permit", 640.00, "Cidade de Worcester", 25);
      e("eternity", "p-elm", "gasolina", 68.40, "Shell", 20, "u-joao"); e("eternity", "p-elm", "gasolina", 72.15, "Mobil", 13, "u-joao"); e("eternity", "p-elm", "gasolina", 59.80, "Gulf", 5, "u-marcos");
      e("eternity", "p-elm", "equipamento", 420.00, "Sunbelt Rentals (elevador)", 11); e("eternity", "p-elm", "subcontractor", 1800.00, "Escavação Exemplo", 16);
      e("eternity", "p-maple", "material", 1490.30, "Graybar", 11); e("eternity", "p-maple", "permit", 285.00, "Cidade de Shrewsbury", 12); e("eternity", "p-maple", "gasolina", 44.90, "Shell", 4, "u-marcos");
      e("bluestar", "p-oak", "material", 7420.00, "F.W. Webb (equipamento Mitsubishi)", 8); e("bluestar", "p-oak", "material", 612.45, "Johnstone Supply", 6, "u-pedro");
      e("bluestar", "p-oak", "permit", 310.00, "Cidade de Watertown", 9); e("bluestar", "p-oak", "gasolina", 61.20, "Sunoco", 5, "u-pedro"); e("bluestar", "p-oak", "outros", 95.00, "Descarte de equipamento", 7);
      function rev(co, p, amt, n, note) { exp.push({ id: uid(), companyId: co, projectId: p, kind: "revenue", category: "receita", amount: amt, vendor: "Cliente", date: dateAgo(n), note: note, receipt: null, createdBy: "u-admin" }); }
      rev("eternity", "p-elm", 18600, 25, "Depósito 30%"); rev("eternity", "p-elm", 12400, 6, "Medição rough-in");
      rev("eternity", "p-maple", 5550, 12, "Depósito 30%"); rev("bluestar", "p-oak", 12400, 9, "Depósito 50%");

      return { v: 2, users: users, projects: projects, financials: financials, time: time, expenses: exp };
    }

    function load() {
      var raw = safeGet(KEY);
      if (raw) { try { db = JSON.parse(raw); } catch (e) { db = null; } }
      if (!db) { db = seed(); persist(); }
    }
    function persist() {
      // strip large data URLs that don't fit; keep them in memory
      var ok = safeSet(KEY, JSON.stringify(db));
      if (!ok) {
        var slim = JSON.parse(JSON.stringify(db));
        slim.projects.forEach(function (p) { (p.files || []).forEach(function (f) { if (f.data) { mem[f.id] = f.data; f.data = null; f.memOnly = true; } }); });
        safeSet(KEY, JSON.stringify(slim));
      }
    }
    function me() { var id = safeGet(SESSION); return db.users.find(function (u) { return u.id === id; }) || null; }
    function pub(u) { return u ? { id: u.id, username: u.username, name: u.name, role: u.role, companyId: u.companyId, rate: u.rate, active: u.active } : null; }
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function P(v) { return Promise.resolve(v); }

    return {
      mode: "demo",
      companies: COMPANIES,
      init: function () { load(); return P(); },
      reset: function () { safeDel(KEY); safeDel(SESSION); db = null; load(); return P(); },
      session: function () { return P(pub(me())); },
      signIn: function (username, pw) {
        var u = db.users.find(function (x) { return x.username === String(username).trim().toLowerCase(); });
        if (!u || u.password !== pw) return Promise.reject(new Error("Usuário ou senha incorretos."));
        if (!u.active) return Promise.reject(new Error("Este usuário está desativado. Fale com o administrador."));
        safeSet(SESSION, u.id);
        return P(pub(u));
      },
      signOut: function () { safeDel(SESSION); return P(); },
      listUsers: function () { return P(db.users.map(pub)); },
      createUser: function (u) {
        var uname = String(u.username || "").trim().toLowerCase();
        if (db.users.some(function (x) { return x.username === uname; })) return Promise.reject(new Error("Esse usuário já existe."));
        var rec = { id: uid(), username: uname, password: u.password, name: u.name, role: u.role || "employee", companyId: u.companyId, rate: Number(u.rate) || 0, active: true };
        db.users.push(rec); persist(); return P(pub(rec));
      },
      updateUser: function (id, patch) {
        var u = db.users.find(function (x) { return x.id === id; });
        if (!u) return Promise.reject(new Error("Funcionário não encontrado."));
        ["name", "role", "companyId", "rate", "active"].forEach(function (k) { if (patch[k] !== undefined) u[k] = k === "rate" ? Number(patch[k]) || 0 : patch[k]; });
        if (patch.password) u.password = patch.password;
        persist(); return P(pub(u));
      },
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
      deleteProject: function (id) {
        db.projects = db.projects.filter(function (p) { return p.id !== id; });
        delete db.financials[id]; persist(); return P();
      },
      getFinancials: function () { return P(clone(db.financials)); },
      saveFinancials: function (projectId, f) { db.financials[projectId] = { contractValue: Number(f.contractValue) || 0, budget: Number(f.budget) || 0, estHours: Number(f.estHours) || 0 }; persist(); return P(); },
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
          if (u && u.role !== "admin" && t.userId !== u.id) return false;
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
        if (!t) return Promise.reject(new Error("Nenhuma entrada aberta."));
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
          if (u && u.role !== "admin" && x.createdBy !== u.id) return false;
          if (q.companyId && x.companyId !== q.companyId) return false;
          if (q.projectId && x.projectId !== q.projectId) return false;
          if ((q.from || q.to) && !inRange(x.date, q.from, q.to)) return false;
          return true;
        }).sort(function (a, b) { return a.date < b.date ? 1 : -1; })));
      },
      addExpense: function (x) {
        var u = me();
        return (x.receipt ? blobToDataURL(x.receipt) : P(null)).then(function (d) {
          var rec = { id: uid(), companyId: x.companyId || u.companyId, projectId: x.projectId || null, kind: x.kind || "expense", category: x.category, amount: Number(x.amount) || 0, vendor: x.vendor || "", date: x.date, note: x.note || "", receipt: d, createdBy: u.id };
          db.expenses.push(rec); persist(); return clone(rec);
        });
      },
      deleteExpense: function (id) { db.expenses = db.expenses.filter(function (x) { return x.id !== id; }); persist(); return P(); }
    };
  }

  // ══════════════════════════ SUPABASE ══════════════════════════
  function SupaStore(cfg) {
    var sb = null, profile = null;
    var QUEUE = "ee_punch_queue", PCACHE = "ee_profile_cache";
    function email(u) { return String(u).trim().toLowerCase() + "@" + cfg.LOGIN_DOMAIN; }
    function chk(r) { if (r.error) throw new Error(r.error.message); return r.data; }

    function mapUser(r) { return r ? { id: r.id, username: r.username, name: r.full_name, role: r.role, companyId: r.company_id, rate: Number(r.hourly_rate) || 0, active: r.active } : null; }
    function mapProject(r) {
      return { id: r.id, companyId: r.company_id, name: r.name, client: r.client, address: r.address, lat: r.lat, lng: r.lng, radius: r.radius_m || 150,
        status: r.status, startDate: r.start_date, estCompletion: r.est_completion, details: r.details || {}, scope: r.scope || "", teamNotes: r.team_notes || "",
        tasks: (r.project_tasks || []).sort(function (a, b) { return a.sort - b.sort; }).map(function (t) { return { id: t.id, group: t.grp, label: t.label, done: t.done, doneBy: t.done_by_name, doneAt: t.done_at }; }),
        files: (r.project_files || []).map(function (f) { return { id: f.id, name: f.name, mime: f.mime, size: f.size, path: f.path, createdAt: f.created_at }; }) };
    }
    function mapTime(r) { return { id: r.id, userId: r.user_id, companyId: r.company_id, projectId: r.project_id, checkIn: r.check_in, checkOut: r.check_out, rate: Number(r.rate) || 0,
      inLoc: r.in_lat != null ? { lat: r.in_lat, lng: r.in_lng, ok: true } : { ok: false }, outLoc: r.out_lat != null ? { lat: r.out_lat, lng: r.out_lng, ok: true } : { ok: false }, inPhoto: r.in_photo, outPhoto: r.out_photo }; }
    function mapExp(r) { return { id: r.id, companyId: r.company_id, projectId: r.project_id, kind: r.kind, category: r.category, amount: Number(r.amount) || 0, vendor: r.vendor, date: r.date, note: r.note, receipt: r.receipt_path, createdBy: r.created_by }; }

    function loadLib() {
      if (window.supabase) return Promise.resolve();
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
        s.onload = res; s.onerror = function () { rej(new Error("Sem conexão para carregar o app. Verifique a internet.")); };
        document.head.appendChild(s);
      });
    }
    function loadProfile() {
      return sb.auth.getUser().then(function (r) {
        var user = r.data && r.data.user;
        if (!user && r.error && (!navigator.onLine || /fetch|network|retryable/i.test((r.error.name || "") + r.error.message))) throw new Error("offline");
        if (!user) { profile = null; return null; }
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
            if (!navigator.onLine || /fetch|network|retryable|timeout|5\d\d|\b0\b/i.test(m)) throw new Error("Não foi possível conectar ao servidor. Verifique a internet. Se a internet estiver ok, o banco de dados pode estar pausado: entre no Supabase e clique em Restore project.");
            throw new Error("Usuário ou senha incorretos.");
          }
          return loadProfile();
        }).then(function (p) {
          if (!p || !p.active) { sb.auth.signOut(); throw new Error("Este usuário ainda não foi ativado pelo administrador."); }
          flush(); return p;
        });
      },
      signOut: function () { profile = null; safeDel(PCACHE); return sb.auth.signOut(); },
      listUsers: function () { return sb.from("profiles").select("*").order("full_name").then(function (r) { return chk(r).map(mapUser); }); },
      createUser: function (u) {
        var tmp = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "ee-tmp-signup" } });
        var uname = String(u.username).trim().toLowerCase();
        return tmp.auth.signUp({ email: email(uname), password: u.password, options: { data: { username: uname, full_name: u.name } } }).then(function (r) {
          if (r.error) throw new Error(/registered/i.test(r.error.message) ? "Esse usuário já existe." : r.error.message);
          if (!r.data.user || (r.data.user.identities && r.data.user.identities.length === 0)) throw new Error("Esse usuário já existe.");
          var id = r.data.user.id;
          return sb.from("profiles").update({ full_name: u.name, role: u.role || "employee", company_id: u.companyId, hourly_rate: Number(u.rate) || 0, active: true }).eq("id", id).select().single();
        }).then(function (r) { return mapUser(chk(r)); });
      },
      updateUser: function (id, patch) {
        var row = {};
        if (patch.name !== undefined) row.full_name = patch.name;
        if (patch.role !== undefined) row.role = patch.role;
        if (patch.companyId !== undefined) row.company_id = patch.companyId;
        if (patch.rate !== undefined) row.hourly_rate = Number(patch.rate) || 0;
        if (patch.active !== undefined) row.active = patch.active;
        var p = sb.from("profiles").update(row).eq("id", id).select().single().then(function (r) { return mapUser(chk(r)); });
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
      deleteProject: function (id) { return sb.from("projects").delete().eq("id", id).then(chk); },
      getFinancials: function () {
        return sb.from("project_financials").select("*").then(function (r) {
          var out = {}; chk(r).forEach(function (f) { out[f.project_id] = { contractValue: Number(f.contract_value) || 0, budget: Number(f.budget) || 0, estHours: Number(f.est_hours) || 0 }; }); return out;
        });
      },
      saveFinancials: function (projectId, f) { return sb.from("project_financials").upsert({ project_id: projectId, contract_value: Number(f.contractValue) || 0, budget: Number(f.budget) || 0, est_hours: Number(f.estHours) || 0 }).then(chk); },
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
        var p = x.receipt ? upload("receipts", profile.id + "/" + id + ".jpg", x.receipt) : Promise.resolve(null);
        return p.then(function (path) {
          return sb.from("expenses").insert({ id: id, company_id: x.companyId || profile.companyId, project_id: x.projectId || null, kind: x.kind || "expense", category: x.category,
            amount: Number(x.amount) || 0, vendor: x.vendor || null, date: x.date, note: x.note || null, receipt_path: path, created_by: profile.id }).select().single();
        }).then(function (r) { return mapExp(chk(r)); });
      },
      deleteExpense: function (id) { return sb.from("expenses").delete().eq("id", id).then(chk); }
    };
  }

  var cfg = window.APP_CONFIG || {};
  window.API = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? SupaStore(cfg) : DemoStore();
  window.API.hoursOf = hoursOf;
})();
