/* Bisey — tarefas da obra que refletem a proposta, tarefa avulsa da equipe e "Sugira para a sua página" (tela).
   Motor: tasks-core.js (proposta → tarefas, repetidas, catálogo da empresa). Servidor: netlify/functions/suggest.mjs (/api/suggest).
   1. Proposta → tarefas: "Virar projeto" já traz a lista (regras do ramo em trades.js → taskMatch), cada uma marcada "da proposta";
      proposta aceita ligada a uma obra mostra "N tarefas da proposta ainda não estão na lista" (o gerente revisa e adiciona);
      "Refinar com IA" (POST /api/suggest/tasks) — sem servidor / sem internet / no modo demonstração avisa e não muda nada.
   2. Tarefa avulsa: qualquer pessoa da equipe acrescenta na lista da obra ("fiz uma coisa que não está na lista") — fica quem pôs e quando.
      Dono e gerente editam e apagam; funcionário acrescenta e marca.
   3. Sugestões: aviso na aba Tarefas da obra e no passo Tarefas do assistente, formulário (o quê, tipo, ramo, exemplo),
      Configurações → Sugestões e Ajuda. A IA classifica: tarefa / material / item de serviço do ramo entra na hora no catálogo da
      empresa (dados da empresa em data.js → customCatalog, somado ao trade.tasks nos chips e no cruzamento); pedido maior vira ticket.
      Sem servidor (demonstração / sem internet): entra como "pendente de revisão da IA" e fica na fila do aparelho para enviar depois. */
(function () {
  "use strict";
  var E = window.EE, T = window.BiseyTasks; if (!E || !T) return;
  var S = E.S, API = E.API, esc = E.esc, t = E.t, ic = E.ic, EXT = E.EXT, AC = EXT.actions, NV = window.NV, LANG = NV.lang || "pt";
  EXT.modals = EXT.modals || {};
  function $(s) { return document.querySelector(s); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function canEdit() { return E.can("projects"); } // dono e gerente
  function me() { return S.user || {}; }
  var URL_BASE = ((window.APP_CONFIG || {}).SUGGEST_URL || "/api/suggest").replace(/\/+$/, "");

  // ═══════════ catálogo próprio da empresa ═══════════
  function coRec(id) { return (API.companies || []).find(function (c) { return c.id === id; }) || null; }
  function catalog(id) { var c = coRec(id) || {}; return (c.customCatalog || (c.settings || {}).customCatalog || []).filter(function (e) { return e && !e.removed; }); }
  // rótulos das entradas no idioma da tela (tv): registra em I18N.<lang>.val sem sobrescrever o que já existe
  function applyVals() {
    if (LANG === "pt" || !window.I18N || !window.I18N[LANG]) return;
    var V = window.I18N[LANG].val = window.I18N[LANG].val || {};
    (API.companies || []).forEach(function (c) { var o = T.catalogVals(catalog(c.id), LANG); Object.keys(o).forEach(function (k) { if (V[k] == null) V[k] = o[k]; }); });
  }
  function tradeFor(companyId) { return NV.tradeDef(E.tradeOf(companyId)); }
  // tarefas-modelo do ramo + as da empresa (chips do assistente e cruzamento com a proposta)
  NV.coTasks = function (companyId) { applyVals(); return T.mergeTasks(tradeFor(companyId).tasks, catalog(companyId)); };
  function groupsOf(companyId) { return Object.keys(NV.coTasks(companyId)).concat(["Outros"]).filter(function (g, i, a) { return a.indexOf(g) === i; }); }

  // ═══════════ proposta → tarefas ═══════════
  function forProposal(p, existing) {
    var tr = tradeFor(p.companyId), res = T.fromProposal(p, tr, { tv: E.tv, custom: T.catalogTasks(catalog(p.companyId)) });
    return T.dedupe(existing || [], res.tasks, E.tv);
  }
  E.proposalTasks = forProposal;
  function linkedProposals(p) {
    return (S.proposals || []).filter(function (x) { return x.docType !== "invoice" && (x.status === "Aceita" || x.acceptedAt) && (x.projectId === p.id || p.proposalId === x.id); });
  }
  function srcLabel(tk) {
    return tk.source === "proposal" ? t("ptk.srcProposal", "da proposta") : tk.source === "sheet" ? t("ptk.srcSheet", "da ficha") : tk.source === "ai" ? t("ptk.srcAi", "da IA") : tk.source === "crew" ? t("ptk.srcCrew", "da equipe") : "";
  }
  function srcTag(tk) {
    if (!tk || !tk.source || tk.source === "manual") return "";
    return '<span class="tk-src tk-src-' + esc(tk.source) + '"' + (tk.refNo ? ' title="' + esc(t("ptk.fromEst", "Proposta {n}", { n: tk.refNo })) + '"' : "") + ">" + esc(srcLabel(tk)) + "</span>";
  }

  // ═══════════ passo Tarefas do assistente ═══════════
  function wizHead(d) {
    var tasks = d.tasks || [], c = { proposal: 0, sheet: 0, ai: 0, manual: 0 };
    tasks.forEach(function (x) { var k = x.source && c[x.source] != null ? x.source : "manual"; c[k]++; });
    var prop = d.proposalId && (S.proposals || []).find(function (x) { return x.id === d.proposalId; });
    var parts = [];
    if (c.proposal) parts.push('<span class="tk-src tk-src-proposal">' + esc(t("ptk.nFromProposal", "{n} da proposta", { n: c.proposal })) + (prop && prop.number ? " " + esc(prop.number) : "") + "</span>");
    if (c.sheet) parts.push('<span class="tk-src tk-src-sheet">' + esc(t("ptk.nFromSheet", "{n} da ficha da obra", { n: c.sheet })) + "</span>");
    if (c.ai) parts.push('<span class="tk-src tk-src-ai">' + esc(t("ptk.nFromAi", "{n} da IA", { n: c.ai })) + "</span>");
    if (c.manual) parts.push('<span class="tk-src">' + esc(t("ptk.nByYou", "{n} escolhidas por você", { n: c.manual })) + "</span>");
    return (parts.length ? '<div class="tk-sources" role="status"><span class="muted small">' + esc(t("ptk.whereFrom", "De onde vieram:")) + "</span> " + parts.join(" ") +
      (prop ? ' <button type="button" class="btn ghost sm" data-act="tkRefine">' + ic("spark", 16) + esc(t("ptk.refineAi", "Refinar com IA")) + "</button>" : "") + "</div>" : "") +
      (prop && c.proposal ? '<p class="muted small" style="margin:0 0 10px">' + esc(t("ptk.reviewHint", "As tarefas marcadas “da proposta” saíram do escopo e dos itens da proposta {n}. Revise: toque para tirar ou pôr, e salve.", { n: prop.number || "" })) + "</p>" : "");
  }
  // aviso de sugestões (assistente e aba Tarefas)
  function notice(compact) {
    return '<aside class="sug-note" role="note"><span class="sug-ic" aria-hidden="true">' + ic("spark", 18) + '</span><div><b>' + esc(t("sug.noteTitle", "Cada obra é diferente. Falta alguma coisa que você faz?")) + "</b>" +
      '<div class="small">' + esc(t("sug.noteText", "Sugira e a gente acrescenta na sua página. Nossa IA recebe na hora e já cuida disso.")) + "</div></div>" +
      '<button type="button" class="btn sm' + (compact ? " ghost" : "") + '" data-act="sugOpen">' + esc(t("sug.cta", "Sugerir")) + "</button></aside>";
  }

  // ═══════════ aba Tarefas da obra ═══════════
  function scopeExtra(p) {
    var gs = groupsOf(p.companyId), out = "";
    // proposta aceita ligada à obra com tarefas que ainda não estão na lista (dono / gerente revisa)
    if (canEdit()) linkedProposals(p).forEach(function (pr) {
      var add = forProposal(pr, p.tasks || []), seen = store("bisey_ptk_seen") || {};
      if (!add.length || seen[p.id + "|" + pr.id] === add.length) return;
      out += '<div class="panel tk-prop" role="status"><div><b>' + esc(t("ptk.bannerTitle", "Proposta {n} aceita", { n: pr.number || "" })) + '</b><div class="small muted">' +
        esc(t("ptk.bannerText", "{n} tarefa(s) do escopo ainda não estão nesta lista.", { n: add.length })) + '</div></div><div class="row"><button type="button" class="btn sm" data-act="tkPropReview" data-pid="' + esc(p.id) + '" data-id="' + esc(pr.id) + '">' + esc(t("ptk.review", "Revisar e adicionar")) + '</button><button type="button" class="btn ghost sm" data-act="tkPropDismiss" data-pid="' + esc(p.id) + '" data-id="' + esc(pr.id) + '" data-n="' + add.length + '">' + esc(t("ptk.dismiss", "Agora não")) + "</button></div></div>";
    });
    var emp = !E.isStaff();
    out += '<form class="panel tk-add" id="tkAddForm" data-pid="' + esc(p.id) + '"><h4>' + esc(emp ? t("ptk.addTitleCrew", "Fez alguma coisa que não está na lista?") : t("ptk.addTitle", "Acrescentar tarefa")) + "</h4>" +
      '<div class="tk-add-row"><label class="sr-only" for="tkLabel">' + esc(t("ptk.whatDone", "Tarefa")) + '</label><input type="text" id="tkLabel" maxlength="120" required placeholder="' + esc(t("ptk.addPh", "Ex.: Trocar disjuntor do aquecedor")) + '">' +
      '<label class="sr-only" for="tkGroup">' + esc(t("ptk.group", "Grupo")) + '</label><select id="tkGroup">' + gs.map(function (g) { return '<option value="' + esc(g) + '"' + (g === "Outros" ? " selected" : "") + ">" + esc(E.tv(g)) + "</option>"; }).join("") + "</select>" +
      '<button type="submit" class="btn">' + ic("plus", 18) + esc(t("ptk.add", "Adicionar")) + "</button></div>" +
      '<label class="row small tk-done-now"><input type="checkbox" id="tkDone"' + (emp ? " checked" : "") + "> " + esc(t("ptk.alreadyDone", "Já está feita (marca como feita por mim)")) + "</label>" +
      '<div class="muted small">' + esc(t("ptk.addWho", "Fica registrado quem acrescentou e quando.")) + "</div></form>";
    return out + notice(true);
  }
  // linha da tarefa: origem + quem acrescentou + editar / apagar (dono e gerente)
  function rowExtra(p, tk, compact) {
    var s = srcTag(tk), by = tk.addedBy && !compact ? '<div class="by">' + E.byLine(t("ptk.addedBy", "Acrescentada por {n}"), tk.addedBy, tk.addedAt) + "</div>" : "";
    var acts = !compact && canEdit() ? '<span class="tk-acts"><button type="button" class="btn ghost sm icon-only" data-act="tkEdit" data-pid="' + esc(p.id) + '" data-id="' + esc(tk.id) + '" aria-label="' + esc(t("ptk.edit", "Editar tarefa")) + '" title="' + esc(t("ptk.edit", "Editar tarefa")) + '">' + ic("edit", 16) + '</button><button type="button" class="btn ghost sm icon-only" data-act="tkDel" data-pid="' + esc(p.id) + '" data-id="' + esc(tk.id) + '" aria-label="' + esc(t("ptk.del", "Apagar tarefa")) + '" title="' + esc(t("ptk.del", "Apagar tarefa")) + '">' + ic("trash", 16) + "</button></span>" : "";
    return { tag: s, by: by, acts: acts };
  }

  NV.tasksUi = { wizHead: wizHead, notice: notice, scopeExtra: scopeExtra, rowExtra: rowExtra, srcTag: srcTag, forProposal: forProposal };

  // ═══════════ ações: tarefa avulsa, editar, apagar ═══════════
  function localProject(pid) { return (S.projects || []).find(function (x) { return x.id === pid; }); }
  EXT.submit.tkAddForm = function (f) {
    var pid = f.dataset.pid, l = ($("#tkLabel").value || "").trim(), g = $("#tkGroup").value || "Outros", done = !!($("#tkDone") || {}).checked;
    if (!l) { $("#tkLabel").focus(); return; }
    var btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
    API.addTask(pid, { group: g, label: l, done: done, source: E.isStaff() ? "manual" : "crew" }).then(function (rec) {
      var p = localProject(pid); if (p && rec) { p.tasks = p.tasks || []; p.tasks.push(rec); }
      E.render(); E.toast(t("ptk.added", "Tarefa acrescentada: {x}", { x: l }));
      var i = $("#tkLabel"); if (i) try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); }
    }).catch(function (e) { if (btn) btn.disabled = false; E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); });
  };
  AC.tkEdit = function (el) {
    var p = localProject(el.dataset.pid), tk = p && (p.tasks || []).find(function (x) { return x.id === el.dataset.id; }); if (!tk) return;
    S.modal = { type: "tkEdit", title: t("ptk.edit", "Editar tarefa"), pid: p.id, id: tk.id }; E.render();
    setTimeout(function () { var i = $("#tkeLabel"); if (i) i.focus(); }, 30);
  };
  EXT.modals.tkEdit = function (m) {
    var p = localProject(m.pid), tk = p && (p.tasks || []).find(function (x) { return x.id === m.id; }) || {};
    return '<form id="tkEditForm" class="stack"><label class="field"><span>' + esc(t("ptk.whatDone", "Tarefa")) + '</span><input type="text" id="tkeLabel" maxlength="120" required value="' + esc(tk.label || "") + '"></label>' +
      '<label class="field"><span>' + esc(t("ptk.group", "Grupo")) + '</span><select id="tkeGroup">' + groupsOf(p.companyId).map(function (g) { return '<option value="' + esc(g) + '"' + (g === tk.group ? " selected" : "") + ">" + esc(E.tv(g)) + "</option>"; }).join("") + "</select></label>" +
      (tk.source ? '<div class="muted small">' + esc(t("ptk.origin", "Origem:")) + " " + srcTag(tk) + (tk.from && tk.from[0] ? ' <span lang="en">“' + esc(tk.from[0]) + "”</span>" : "") + "</div>" : "") +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("ptk.cancel", "Cancelar")) + '</button><button type="submit" class="btn">' + esc(t("ptk.save", "Salvar")) + "</button></div></form>";
  };
  EXT.submit.tkEditForm = function () {
    var m = S.modal || {}, l = ($("#tkeLabel").value || "").trim(), g = $("#tkeGroup").value; if (!l) return;
    API.updateTask(m.pid, m.id, { label: l, group: g }).then(function (rec) {
      var p = localProject(m.pid), i = p ? p.tasks.findIndex(function (x) { return x.id === m.id; }) : -1;
      if (i >= 0) p.tasks[i] = Object.assign({}, p.tasks[i], rec || { label: l, group: g });
      S.modal = null; E.render(); E.toast(t("ptk.saved", "Tarefa salva."));
    }).catch(function (e) { E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); });
  };
  AC.tkDel = function (el) {
    var p = localProject(el.dataset.pid), tk = p && (p.tasks || []).find(function (x) { return x.id === el.dataset.id; }); if (!tk) return;
    S.modal = { type: "confirm", title: t("ptk.del", "Apagar tarefa"), text: t("ptk.delText", "Apagar a tarefa “{x}” desta obra?", { x: tk.label }), act: "tkDelOk", id: p.id + "|" + tk.id, okLabel: t("ptk.delOk", "Apagar") }; E.render();
  };
  AC.tkDelOk = function (el) {
    var ids = String(el.dataset.id || "").split("|");
    API.deleteTask(ids[0], ids[1]).then(function () {
      var p = localProject(ids[0]); if (p) p.tasks = (p.tasks || []).filter(function (x) { return x.id !== ids[1]; });
      S.modal = null; E.render(); E.toast(t("ptk.deleted", "Tarefa apagada."));
    }).catch(function (e) { E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); });
  };

  // ═══════════ proposta aceita ligada à obra: revisar e adicionar ═══════════
  AC.tkPropReview = function (el) {
    var p = localProject(el.dataset.pid), pr = (S.proposals || []).find(function (x) { return x.id === el.dataset.id; }); if (!p || !pr) return;
    S.modal = { type: "tkProp", title: t("ptk.reviewTitle", "Tarefas da proposta {n}", { n: pr.number || "" }), pid: p.id, prid: pr.id, list: forProposal(pr, p.tasks || []) }; E.render();
  };
  AC.tkPropDismiss = function (el) { var s = store("bisey_ptk_seen") || {}; s[el.dataset.pid + "|" + el.dataset.id] = Number(el.dataset.n) || 0; store("bisey_ptk_seen", s); E.render(); };
  EXT.modals.tkProp = function (m) {
    return '<form id="tkPropForm" class="stack"><p class="muted small" style="margin:0">' + esc(t("ptk.reviewSub", "Saíram do escopo e dos itens da proposta. Desmarque o que não for para a lista da equipe.")) + "</p>" +
      '<div class="tk-review">' + m.list.map(function (x, i) {
        return '<label class="row tk-rev-row"><input type="checkbox" data-i="' + i + '" checked><span><b>' + esc(x.label) + '</b> <span class="muted small">· ' + esc(E.tv(x.group)) + "</span>" + (x.from && x.from[0] ? '<span class="small muted tk-from" lang="en">“' + esc(x.from[0]) + "”</span>" : "") + "</span></label>";
      }).join("") + "</div>" +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("ptk.cancel", "Cancelar")) + '</button><button type="submit" class="btn">' + esc(t("ptk.addSel", "Adicionar à lista")) + "</button></div></form>";
  };
  EXT.submit.tkPropForm = function (f) {
    var m = S.modal || {}, p = localProject(m.pid); if (!p) return;
    var pick = [].slice.call(f.querySelectorAll("input[type=checkbox][data-i]")).filter(function (c) { return c.checked; }).map(function (c) { return m.list[Number(c.dataset.i)]; });
    if (!pick.length) { S.modal = null; E.render(); return; }
    var rec = clone(p); rec.tasks = (rec.tasks || []).concat(pick.map(function (x) { return Object.assign({}, x, { id: null }); }));
    if (!rec.proposalId) rec.proposalId = m.prid;
    API.saveProject(rec).then(function () { S.modal = null; return E.refresh(); }).then(function () { E.toast(t("ptk.addedN", "{n} tarefa(s) da proposta adicionadas.", { n: pick.length })); })
      .catch(function (e) { E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); });
  };

  // ═══════════ "Refinar com IA" (assistente) ═══════════
  function post(path, body, ms) {
    var ctl = window.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, ms || 9000) : null;
    return fetch(URL_BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "omit", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (tm) clearTimeout(tm); var ct = r.headers.get("content-type") || ""; if (!/json/.test(ct)) throw new Error("NO_API"); return r.json().then(function (j) { j._status = r.status; return j; }); },
        function (e) { if (tm) clearTimeout(tm); throw e; });
  }
  AC.tkRefine = function (el) {
    var d = S.draft; if (!d) return;
    var pr = (S.proposals || []).find(function (x) { return x.id === d.proposalId; }); if (!pr) return;
    if (navigator.onLine === false) { E.toast(t("ptk.aiOffline", "Sem internet: a IA não está disponível agora. As tarefas da proposta continuam aqui.")); return; }
    if (el) { el.disabled = true; el.innerHTML = '<span class="spin" aria-hidden="true"></span> ' + esc(t("ptk.aiBusy", "A IA está revisando…")); }
    var tasks = NV.coTasks(d.companyId);
    post("/tasks", { trade: tradeFor(d.companyId).id, lang: LANG, accountId: acct(), lines: T.proposalLines(pr).map(function (l) { return l.text; }), current: (d.tasks || []).map(function (x) { return { group: x.group, label: x.label }; }), groups: tasks })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error || "AI");
        var add = T.dedupe(d.tasks || [], (r.tasks || []).map(function (x) { return Object.assign({ id: null, done: false, ref: pr.id, refNo: pr.number }, x, { label: x.tpl ? E.tv(x.tpl) + (x.qty ? " (" + x.qty + ")" : "") : x.label }); }), E.tv);
        d.tasks = (d.tasks || []).concat(add); E.render();
        E.toast(add.length ? t("ptk.aiAdded", "A IA acrescentou {n} tarefa(s). Revise antes de salvar.", { n: add.length }) : t("ptk.aiNothing", "A IA não achou nada faltando."));
      })
      .catch(function () { E.render(); E.toast(API.mode === "demo" ? t("ptk.aiDemo", "Refinar com IA funciona na conta conectada. No modo demonstração, as tarefas vêm só das regras do seu ramo.") : t("ptk.aiOffline", "Sem internet: a IA não está disponível agora. As tarefas da proposta continuam aqui."), { kind: "info" }); });
  };

  // ═══════════ sugestões ═══════════
  var QUEUE = "bisey_sug_queue";
  function acct() { var o = API.currentOrg ? API.currentOrg() : null; return (o && o.id) || (API.mode === "demo" ? "demo" : "anon"); }
  function sugTypes() { return [["task", t("sug.tTask", "Tarefa")], ["material", t("sug.tMaterial", "Material")], ["service", t("sug.tService", "Serviço / item de preço")], ["other", t("sug.tOther", "Outra coisa")]]; }
  AC.sugOpen = function () {
    var co = E.isStaff() ? S.company : (me().companyId || S.company);
    S.modal = { type: "sug", title: t("sug.title", "Sugerir para a sua página"), co: co, kind: "task", trade: NV.tradeKey(E.tradeOf(co)) }; E.render();
    setTimeout(function () { var i = $("#sugText"); if (i) i.focus(); }, 30);
  };
  AC.sugType = function (el) { if (S.modal && S.modal.type === "sug") { S.modal.kind = el.dataset.id; var tx = $("#sugText"), ex = $("#sugEx"); S.modal.text = tx ? tx.value : ""; S.modal.ex = ex ? ex.value : ""; E.render(); } };
  EXT.modals.sug = function (m) {
    var busy = m.busy;
    return '<form id="sugForm" class="stack sug-form">' +
      '<p class="muted small" style="margin:0">' + esc(t("sug.intro", "Cada obra é diferente. Conte o que falta e a nossa IA acrescenta na sua página: tarefas, materiais e itens de serviço do seu ramo entram na hora; ideias maiores vão para a equipe do Bisey.")) + "</p>" +
      '<label class="field"><span>' + esc(t("sug.what", "O que acrescentar")) + '</span><textarea id="sugText" maxlength="300" required rows="3" placeholder="' + esc(t("sug.whatPh", "Ex.: Instalar timer de exaustor no banheiro")) + '">' + esc(m.text || "") + "</textarea></label>" +
      '<div><span class="label">' + esc(t("sug.type", "Tipo")) + '</span><div class="chips" role="radiogroup" aria-label="' + esc(t("sug.type", "Tipo")) + '">' + sugTypes().map(function (x) { var on = m.kind === x[0]; return '<button type="button" role="radio" aria-checked="' + on + '" class="chip' + (on ? " on" : "") + '" data-act="sugType" data-id="' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("") + "</div></div>" +
      '<div class="grid2"><label class="field"><span>' + esc(t("sug.trade", "Ramo")) + '</span><select id="sugTrade">' + NV.tradeList().map(function (td) { return '<option value="' + td.id + '"' + (td.id === m.trade ? " selected" : "") + ">" + esc(td.label) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field"><span>' + esc(t("sug.example", "Exemplo (opcional)")) + '</span><input type="text" id="sugEx" maxlength="300" value="' + esc(m.ex || "") + '" placeholder="' + esc(t("sug.examplePh", "Ex.: fazemos isso em toda reforma de banheiro")) + '"></label></div>' +
      '<div class="muted small">' + esc(t("sug.privacy", "Não escreva preço, senha nem dados de cliente. O texto vai para a equipe do Bisey.")) + "</div>" +
      '<div class="err" id="sugErr" hidden></div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("ptk.cancel", "Cancelar")) + '</button><button type="submit" class="btn"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="spin" aria-hidden="true"></span> ' + esc(t("sug.sending", "Enviando para a IA…")) : esc(t("sug.send", "Enviar sugestão"))) + "</button></div></form>";
  };
  function bodyFor(m, text, ex, trade) {
    var u = me();
    return { accountId: acct(), companyId: m.co, user: { id: u.id || "", name: u.name || "", role: E.roleOf ? E.roleOf() : "employee", email: u.email || "" }, trade: trade, lang: LANG, type: m.kind || "other", text: text, example: ex, groups: groupsOf(m.co), demo: API.mode === "demo" };
  }
  function toEntries(r, body) {
    return (r.entries || []).map(function (e) { return T.cleanEntry({ type: e.type, group: e.group, label: e.label, trade: body.trade, by: body.user.id, byName: body.user.name, suggestionId: r.id, status: "active" }); }).filter(Boolean);
  }
  function localEntry(body, qid) {
    var type = body.type === "other" ? "task" : body.type, g = type === "task" ? "Outros" : type === "material" ? { pt: "Material", en: "Material", es: "Material" } : { pt: "Serviços", en: "Services", es: "Servicios" };
    return T.cleanEntry({ id: qid, type: type, group: g, label: body.text, trade: body.trade, by: body.user.id, byName: body.user.name, suggestionId: qid, status: "pending", note: body.example });
  }
  function saveEntries(co, entries) { return entries.length ? API.addCatalog(co, entries).then(function () { applyVals(); }) : Promise.resolve(); }
  function undoBtn(co, ids) {
    return { label: t("sug.undo", "Desfazer"), run: function () { removeEntries(co, ids).then(function () { E.render(); E.toast(t("sug.undone", "Tirado da sua página.")); }).catch(function (e) { E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); }); } };
  }
  function removeEntries(co, ids) { var c = coRec(co) || {}; var list = (c.customCatalog || []).filter(function (e) { return ids.indexOf(e.id) < 0; }); return API.saveCatalog(co, list).then(function () { applyVals(); }); }

  EXT.submit.sugForm = function () {
    var m = S.modal || {}, text = ($("#sugText").value || "").trim(), ex = ($("#sugEx").value || "").trim(), trade = $("#sugTrade").value;
    var err = $("#sugErr");
    if (!text) { $("#sugText").focus(); return; }
    if (text.length > 300 || ex.length > 300) { err.textContent = t("sug.tooLong", "Escreva em até 300 caracteres."); err.hidden = false; return; }
    m.text = text; m.ex = ex; m.busy = true; E.render();
    var body = bodyFor(m, text, ex, trade);
    send(body).then(function (res) {
      S.modal = null; E.render();
      if (res.status === "added") E.toast(t("sug.added", "Adicionado à sua página: {x}", { x: res.names }), { kind: "ok", action: undoBtn(body.companyId, res.ids) });
      else if (res.status === "ticket") E.toast(t("sug.ticket", "Enviado para a equipe do Bisey. Uma pessoa da equipe vai olhar."), { kind: "ok" });
      else if (res.status === "rejected") E.toast(t("sug.rejected", "Não dá para adicionar isso. Sugira tarefas, materiais ou itens de serviço do seu trabalho."), { kind: "bad" });
      else E.toast(t("sug.pending", "Adicionado à sua página como pendente de revisão da IA: {x}. Enviamos para a IA quando o servidor responder.", { x: text.slice(0, 60) }), { kind: "info", action: res.ids && res.ids.length ? undoBtn(body.companyId, res.ids) : null });
    }).catch(function (e) { m.busy = false; E.render(); var er = $("#sugErr"); if (er) { er.textContent = (e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa."); er.hidden = false; } });
  };
  // envia; sem servidor (demonstração / sem internet / erro) → entrada pendente + fila no aparelho
  function send(body) {
    var qid = "sgl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var fallback = function () {
      var e = localEntry(body, qid), q = store(QUEUE) || [];
      q.push({ id: qid, body: body, at: new Date().toISOString() }); store(QUEUE, q.slice(-50));
      return saveEntries(body.companyId, e ? [e] : []).then(function () { return { status: "pending", ids: e ? [e.id] : [] }; });
    };
    if (navigator.onLine === false) return fallback();
    return post("", body).then(function (r) {
      if (r._status === 429) throw new Error(t("sug.rate", "Muitas sugestões em pouco tempo. Tente de novo mais tarde."));
      if (r._status === 413) throw new Error(t("sug.tooLong", "Escreva em até 300 caracteres."));
      if (!r.ok) return fallback();
      return handle(r, body);
    }, function (e) { if (e && /sugest|300/.test(e.message || "")) throw e; return fallback(); });
  }
  function handle(r, body, replaceId) {
    if (r.status === "added") {
      var en = toEntries(r, body);
      var pre = replaceId ? removeEntries(body.companyId, [replaceId]).catch(function () {}) : Promise.resolve();
      return pre.then(function () { return saveEntries(body.companyId, en); }).then(function () { return { status: "added", ids: en.map(function (e) { return e.id; }), names: en.map(function (e) { return e.label[LANG] || e.label.en; }).join(", ") }; });
    }
    if (r.status === "queued") {
      if (replaceId) return Promise.resolve({ status: "queued" }); // servidor guardou; a entrada pendente continua
      var e = localEntry(body, "sgq" + (r.id || Date.now().toString(36)));
      return saveEntries(body.companyId, e ? [e] : []).then(function () { return { status: "pending", ids: e ? [e.id] : [] }; });
    }
    var drop = replaceId ? removeEntries(body.companyId, [replaceId]).catch(function () {}) : Promise.resolve();
    return drop.then(function () { return { status: r.status }; });
  }
  // fila do aparelho: tenta de novo ao entrar e quando a internet volta
  var flushing = false;
  function flush() {
    var q = store(QUEUE) || []; if (!q.length || flushing || navigator.onLine === false || !S.user) return Promise.resolve(0);
    flushing = true; var left = [], sent = 0;
    return q.reduce(function (pr, it) {
      return pr.then(function () {
        return post("", it.body).then(function (r) { if (!r.ok) { left.push(it); return; } sent++; return handle(r, it.body, it.id); }, function () { left.push(it); });
      });
    }, Promise.resolve()).then(function () { store(QUEUE, left); flushing = false; if (sent) E.render(); return sent; }, function () { flushing = false; return 0; });
  }
  EXT.afterLogin.push(function () { applyVals(); setTimeout(flush, 1500); });
  window.addEventListener("online", function () { flush(); });
  AC.sugFlush = function () { flush().then(function (n) { E.toast(n ? t("sug.flushed", "{n} sugestão(ões) enviada(s) para a IA.", { n: n }) : t("sug.flushNone", "A IA ainda não está disponível. Tentamos de novo depois."), { kind: n ? "ok" : "info" }); E.render(); }); };

  // ═══════════ Configurações → Sugestões (e Ajuda) ═══════════
  function panel() {
    var co = E.isStaff() ? S.company : (me().companyId || S.company), list = catalog(co), q = store(QUEUE) || [], staff = canEdit();
    var TY = { task: t("sug.tTask", "Tarefa"), material: t("sug.tMaterial", "Material"), service: t("sug.tService", "Serviço / item de preço") };
    var rows = list.slice().reverse().map(function (e) {
      return '<div class="sug-row"><div><b>' + esc(e.label[LANG] || e.label.pt) + '</b> <span class="muted small">· ' + esc(TY[e.type] || e.type) + " · " + esc(e.group[LANG] || e.group.pt) + "</span>" +
        (e.status === "pending" ? ' <span class="pill warn">' + esc(t("sug.pendingTag", "pendente de revisão da IA")) + "</span>" : ' <span class="pill good">' + esc(t("sug.activeTag", "na sua página")) + "</span>") +
        (e.byName ? '<div class="by">' + E.byLine(t("sug.by", "Sugerido por {n}"), e.byName, e.at) + "</div>" : "") + "</div>" +
        (staff ? '<button type="button" class="btn ghost sm" data-act="sugRemove" data-id="' + esc(e.id) + '">' + esc(t("sug.remove", "Tirar")) + "</button>" : "") + "</div>";
    }).join("");
    return '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("sug.setTitle", "Sugestões para a sua página")) + '</h3><span class="muted small">' + esc(t("sug.setSub", "O que a sua equipe sugeriu e a IA já acrescentou: aparece nos chips de tarefas, nas tarefas da proposta e nas listas.")) + "</span></div></div>" +
      notice(false) +
      (q.length ? '<div class="pill warn sug-queue" style="white-space:normal">' + esc(t("sug.queue", "{n} sugestão(ões) esperando a IA neste aparelho.", { n: q.length })) + ' <button type="button" class="link-btn" data-act="sugFlush">' + esc(t("sug.flush", "Enviar agora")) + "</button></div>" : "") +
      (rows ? '<div class="sug-list">' + rows + "</div>" : '<p class="muted small">' + esc(t("sug.empty", "Nada sugerido ainda.")) + "</p>") + "</section>";
  }
  E.suggestionsPanel = panel;
  // tela própria (Ajuda → Sugestões; funcionário também abre — sem o botão de tirar)
  EXT.views.sugestoes = function () {
    return '<div class="page-head"><div>' + E.crumb(E.isStaff() ? "dashboard" : "jobs", E.isStaff() ? t("nav.dashboard", "Painel") : t("dashboard.jobs", "Obras"), t("sug.navTitle", "Sugestões")) + "<h1>" + esc(t("sug.navTitle", "Sugestões")) + "</h1></div></div>" + panel();
  };
  AC.sugRemove = function (el) { removeEntries(E.isStaff() ? S.company : (me().companyId || S.company), [el.dataset.id]).then(function () { E.render(); E.toast(t("sug.undone", "Tirado da sua página.")); }).catch(function (e) { E.toast((e && e.message) || t("ptk.errSave", "Não consegui salvar a tarefa.")); }); };
  E.sugTest = { send: send, flush: flush, catalog: catalog, QUEUE: QUEUE }; // testes
})();
