/* Nivela — Configurações (só administrador): Empresa, Aparência, Notificações, Plano e cobrança, Dados, Sobre.
   Empresa → API.saveCompany (usado no cabeçalho das propostas/PDF das empresas que não são pré-configuradas).
   Plano → API.billingCheckout(plan) (no demo: aviso "disponível quando a cobrança for ativada"). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, API = E.API, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  function $(s) { return document.querySelector(s); }
  var PRESET = { eternity: 1, bluestar: 1 }; // modelos de proposta já prontos (CO em proposals.js)
  var PALETTE = ["#0B7B6A", "#1F6FD1", "#C98200", "#B3202A", "#6D28D9", "#E2621B", "#15803D", "#334155"];
  var STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
  var PLANS = [
    { id: "starter", name: "Starter", price: 49, users: t("plan.starter.u", "2 escritório + 5 campo"), feats: [t("plan.f.proposals", "Propostas, PDF, aceite online e invoice"), t("plan.starter.ai", "IA: 20 propostas por voz e 50 notas/mês"), t("plan.f.punch", "Ponto com selfie + GPS e folha semanal"), t("plan.starter.jobs", "Até 10 obras ativas")] },
    { id: "pro", name: "Pro", price: 99, best: true, users: t("plan.pro.u", "3 escritório + 15 campo"), feats: [t("plan.pro.all", "Tudo do Starter, obras ilimitadas"), t("plan.pro.ai", "IA: 100 propostas por voz e 300 notas/mês"), t("plan.pro.sched", "Escala, financeiro completo e alertas"), t("plan.pro.mgr", "1 gerente, relatório diário ao cliente")] },
    { id: "business", name: "Business", price: 199, users: t("plan.biz.u", "6 escritório + 40 campo"), feats: [t("plan.biz.all", "Tudo do Pro, até 3 empresas na conta"), t("plan.biz.ai", "IA com uso justo ilimitado"), t("plan.biz.mgr", "Gerentes ilimitados, relatórios exportáveis"), t("plan.biz.brand", "Página de aceite só com a sua marca")] }
  ];
  var TABS = [["empresa", t("set.tab.company", "Empresa"), "home"], ["aparencia", t("set.tab.look", "Aparência"), "sun"], ["notificacoes", t("set.tab.notif", "Notificações"), "bell"], ["plano", t("set.tab.plan", "Plano e cobrança"), "card"], ["dados", t("set.tab.data", "Dados"), "download"], ["sobre", t("set.tab.about", "Sobre"), "info"]];

  function company() { return API.companies.find(function (c) { return c.id === S.company; }) || API.companies[0] || {}; }
  function draft() {
    var c = company();
    if (!S.setCo || S.setCo.id !== c.id) {
      var b = E.companyBrand(c.id);
      S.setCo = { id: c.id, name: b.name || c.name || "", trade: NV.tradeKey(c.trade || "electrical"), logo: c.logo || "", accent: c.accent || "", address: c.address || "", phone: c.phone || "", email: c.email || "", license: c.license || "", hicReg: c.hicReg || (c.settings || {}).hicReg || "", state: c.state || "MA", dirty: false };
      NV.tradeList().forEach(function (td) { td.companyFlags.forEach(function (f) { S.setCo[f.key] = !!(c[f.key] || (c.settings || {})[f.key]); }); }); // ex.: noGas
    }
    return S.setCo;
  }
  function inp(key, label, type, attrs) { var d = draft(); return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" id="set-' + key + '" data-set="' + key + '" value="' + esc(d[key] || "") + '" ' + (attrs || "") + "></label>"; }

  function empresaTab() {
    var d = draft(), preset = PRESET[d.id], cur = d.accent || getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0B7B6A";
    var logo = d.logo || (E.companyBrand(d.id).logo || "");
    var head = '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.co.title", "Dados da empresa")) + '</h3><span class="muted small">' + esc(API.companies.length > 1 ? t("set.co.which", "Editando {n} · troque a empresa no topo do menu", { n: d.name }) : t("set.co.sub", "Aparecem no app, nas propostas e no PDF")) + "</span></div></div>" +
      '<div class="grid2">' + inp("name", t("set.co.name", "Nome da empresa"), "text", 'autocomplete="organization"') +
      '<label class="field"><span>' + esc(t("set.co.trade", "Ramo")) + '</span><select id="set-trade" data-set="trade">' + NV.tradeList().map(function (td) { return [td.id, td.label]; }).map(function (x) { return '<option value="' + x[0] + '"' + (d.trade === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></label></div>" +
      inp("address", t("set.co.address", "Endereço"), "text", 'autocomplete="street-address"') +
      '<div class="grid3">' + inp("phone", t("set.co.phone", "Telefone"), "tel", 'autocomplete="tel" inputmode="tel"') + inp("email", t("set.co.email", "E-mail"), "email", 'autocapitalize="none" inputmode="email"') + inp("license", t("set.co.license", "Licença (nº)")) + "</div>" +
      '<div class="grid2"><label class="field" style="max-width:200px"><span>' + esc(t("set.co.state", "Estado")) + '</span><select id="set-state" data-set="state">' + STATES.map(function (s) { return "<option" + (d.state === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></label>" +
      // nº de registro HIC (lei de MA, M.G.L. c.142A): vai no bloco de contrato residencial das propostas de reforma em MA
      (d.state === "MA" && NV.tradeDef(d.trade).proposal.hic ? inp("hicReg", t("set.co.hicReg", "Registro HIC (MA) — nº")) : "") + "</div>" + flagsBlock(d) + "</section>";
    var brand = '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.brand.title", "Logo e cor")) + '</h3><span class="muted small">' + esc(t("set.brand.sub", "A cor vai nos botões, abas e barras; o logo no menu e nas propostas.")) + "</span></div></div>" +
      '<div class="set-brand"><div class="ob-logo"><span class="ob-logo-img' + (logo ? "" : " empty") + '">' + (logo ? '<img src="' + esc(logo) + '" alt="' + esc(t("set.brand.logoAlt", "Logo atual")) + '">' : ic("upload", 22)) + "</span>" +
      '<div class="stack" style="gap:6px"><label class="btn ghost sm upload-btn">' + ic("upload", 16) + esc(logo ? t("set.brand.change", "Trocar logo") : t("set.brand.send", "Enviar logo")) + '<input type="file" id="setLogo" accept="image/*"></label>' +
      (d.logo ? '<button type="button" class="btn quiet sm" data-act="setLogoRm">' + esc(t("set.brand.remove", "Remover logo")) + "</button>" : "") + "</div></div>" +
      '<div><div class="ob-swatches" role="radiogroup" aria-label="' + esc(t("set.brand.color", "Cor de destaque")) + '">' + PALETTE.map(function (c) { var on = (d.accent || "").toLowerCase() === c.toLowerCase(); return '<button type="button" role="radio" aria-checked="' + on + '" class="ob-sw' + (on ? " on" : "") + '" style="--sw:' + c + '" data-act="setColor" data-id="' + c + '" aria-label="' + c + '"></button>'; }).join("") +
      '<label class="ob-sw custom" title="' + esc(t("set.brand.custom", "Outra cor")) + '"><input type="color" id="setColorPick" value="' + esc(/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#0B7B6A") + '" aria-label="' + esc(t("set.brand.custom", "Outra cor")) + '">' + ic("plus", 16) + "</label></div>" +
      '<div class="muted small" style="margin-top:6px">' + (d.accent ? esc(d.accent.toUpperCase()) + ' · <button type="button" class="link-btn" data-act="setColor" data-id="">' + esc(t("set.brand.default", "usar a cor padrão")) + "</button>" : esc(t("set.brand.isDefault", "Cor padrão"))) + "</div></div></div>" +
      '<div class="set-doc"><span class="label">' + esc(t("set.doc.title", "Como aparece no cabeçalho da proposta")) + "</span>" + docPreview(d, logo) + "</div>" +
      (preset ? '<div class="ob-note">' + ic("info", 18) + "<span>" + esc(t("set.doc.preset", "Esta empresa usa o modelo de proposta pré-configurado (logo, endereço e rodapé próprios). Nome, logo e cor mudam no app.")) + "</span></div>" : "") + "</section>";
    return head + brand + '<div class="set-save"><span class="muted small">' + esc(d.dirty ? t("set.unsaved", "Alterações não salvas") : t("set.saved", "Tudo salvo")) + '</span><button type="button" class="btn" data-act="setSaveCo"' + (S.setBusy ? " disabled" : "") + ">" + (S.setBusy ? '<span class="spin" aria-hidden="true"></span>' : ic("check", 18)) + esc(t("set.save", "Salvar")) + "</button></div>";
  }
  // opções do ramo para esta empresa (trades.js → companyFlags), ex.: HVAC / plumbing → "Não fazemos gás"
  function flagsBlock(d) {
    var fl = NV.tradeDef(d.trade).companyFlags;
    if (!fl.length) return "";
    return '<div class="set-flags"><span class="label">' + esc(t("set.co.flags", "Como a empresa trabalha")) + "</span>" + fl.map(function (f) {
      return '<label class="set-toggle"><span><b>' + esc(f.label) + "</b><span>" + esc(f.desc) + '</span></span><input type="checkbox" role="switch" id="set-flag-' + f.key + '" data-setflag="' + f.key + '"' + (d[f.key] ? " checked" : "") + '><span class="sw-ui" aria-hidden="true"></span></label>';
    }).join("") + "</div>";
  }
  function docPreview(d, logo) {
    var td = NV.tradeDef(d.trade).proposal, acc = d.accent || "var(--accent)", title = td.title || "PROPOSAL", tag = td.tagline || ""; // cabeçalho do ramo (trades.js)
    return '<div class="doc-head" style="--doc:' + esc(acc) + '">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '<div class="doc-name">' + esc(String(d.name || "").toUpperCase()) + "</div>") +
      '<div class="doc-tag">' + esc(tag) + (d.license ? " · LIC. " + esc(String(d.license).toUpperCase()) : "") + '</div><div class="doc-contact">' + esc([d.address, d.email, d.phone].filter(Boolean).join(" · ") || t("set.doc.empty", "endereço · e-mail · telefone")) + "</div>" +
      '<div class="doc-title">' + esc(title) + "</div></div>";
  }
  function aparenciaTab() {
    var cur = (function () { try { return localStorage.getItem("nivela_theme") || "auto"; } catch (e) { return "auto"; } })();
    var opt = function (id, label, sub, icon) { return '<button type="button" role="radio" aria-checked="' + (cur === id) + '" class="' + (cur === id ? "on" : "") + '" data-act="setTheme" data-id="' + id + '">' + ic(icon, 20) + "<b>" + esc(label) + "</b><span>" + esc(sub) + "</span></button>"; };
    return '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.look.theme", "Tema")) + '</h3><span class="muted small">' + esc(t("set.look.themeSub", "Escuro cansa menos a vista de manhã cedo e à noite. Fica salvo neste aparelho.")) + "</span></div></div>" +
      '<div class="seg seg3" role="radiogroup" aria-label="' + esc(t("set.look.theme", "Tema")) + '">' + opt("auto", t("set.look.auto", "Automático"), t("set.look.autoSub", "segue o aparelho"), "grid") + opt("light", t("set.look.light", "Claro"), t("set.look.lightSub", "melhor no sol"), "sun") + opt("dark", t("set.look.dark", "Escuro"), t("set.look.darkSub", "manhã cedo e noite"), "moon") + "</div></section>" +
      '<section class="panel set-sec" id="set-lang"><div class="panel-head"><div><h3>' + esc(t("set.look.lang", "Idioma")) + '</h3><span class="muted small">' + esc(t("set.look.langSub2", "Cada pessoa escolhe o seu idioma; fica salvo no seu perfil e neste aparelho. Propostas e invoices continuam saindo em inglês para o cliente.")) + "</span></div></div>" +
      '<div class="seg" role="radiogroup" aria-label="' + esc(t("set.look.langField", "Idioma do app")) + '">' + window.NV.langs.map(function (x) {
        var on = x[0] === E.LANG;
        return '<button type="button" role="radio" aria-checked="' + on + '" class="' + (on ? "on" : "") + '" data-act="setLang" data-id="' + x[0] + '" lang="' + (x[0] === "en" ? "en" : "pt-BR") + '"><b>' + esc(x[1]) + "</b><span>" + esc(x[0] === "en" ? "Construction English: job, crew, punch in/out" : "Português do Brasil") + "</span></button>";
      }).join("") + "</div></section>";
  }
  function notifTab() {
    var p = E.notifPrefs(), perm = window.Notification ? Notification.permission : "unsupported";
    var row = function (k, title, sub, extra) { return '<label class="set-toggle"><span><b>' + esc(title) + "</b><span>" + esc(sub) + '</span></span><input type="checkbox" role="switch" data-notif="' + k + '"' + (p[k] ? " checked" : "") + (extra || "") + '><span class="sw-ui" aria-hidden="true"></span></label>'; };
    return '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.nt.title", "Neste aparelho")) + '</h3><span class="muted small">' + esc(t("set.nt.sub", "Preferências salvas só neste aparelho.")) + "</span></div></div>" +
      '<div class="set-toggles">' + row("notices", t("set.nt.notices", "Aviso novo da equipe"), t("set.nt.noticesSub", "Mostra um alerta quando alguém reporta algo numa obra.")) +
      row("todayAgenda", t("set.nt.agenda", "Compromissos de hoje ao entrar"), t("set.nt.agendaSub", "Ao abrir o app, lembra quantos compromissos você tem hoje.")) +
      row("browser", t("set.nt.browser", "Notificação do sistema"), perm === "unsupported" ? t("set.nt.unsupported", "Este navegador não tem notificações.") : perm === "denied" ? t("set.nt.denied", "Bloqueada nas configurações do navegador.") : t("set.nt.browserSub", "Aviso novo aparece mesmo com o app em segundo plano."), perm === "unsupported" || perm === "denied" ? " disabled" : "") + "</div></section>" +
      '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.nt.email", "E-mails automáticos")) + '</h3><span class="muted small">' + esc(t("set.nt.emailSub", "Enviados pelo servidor quando a conta está conectada.")) + "</span></div></div>" +
      '<ul class="set-list"><li>' + ic("calendar", 18) + esc(t("set.nt.e1", "Compromisso novo na agenda: para os sócios")) + "</li><li>" + ic("clock", 18) + esc(t("set.nt.e2", "Folha de pagamento da semana: todo sábado à noite")) + "</li><li>" + ic("doc", 18) + esc(t("set.nt.e3", "Proposta aceita pelo cliente: na hora")) + "</li><li>" + ic("bell", 18) + esc(t("set.nt.e4", "Aviso novo da equipe: na hora")) + "</li></ul>" +
      (API.mode === "demo" ? '<div class="ob-note">' + ic("info", 18) + "<span>" + esc(t("set.nt.demo", "Modo demonstração: nenhum e-mail é enviado.")) + "</span></div>" : "") + "</section>";
  }
  function daysLeft(org) { if (!org || !org.trialEndsAt) return 14; return Math.max(0, Math.min(14, Math.ceil((new Date(org.trialEndsAt) - Date.now()) / 864e5 - 0.01))); }
  function planoTab() {
    var org = API.currentOrg ? API.currentOrg() : null, plan = (org && org.plan) || "trial", trial = plan === "trial", left = daysLeft(org);
    var cur = '<section class="panel set-sec plan-cur"><div class="spread"><div><span class="label">' + esc(t("plan.current", "Plano atual")) + "</span><h3>" + (trial ? esc(t("plan.trial", "Teste grátis — 14 dias")) : esc((PLANS.find(function (p) { return p.id === plan; }) || {}).name || plan)) + "</h3>" +
      '<span class="muted small">' + (trial ? esc(t("plan.left", "Faltam {n} dias. Sem cartão até você escolher um plano.", { n: left })) : esc(t("plan.active", "Assinatura ativa."))) + "</span></div>" +
      (trial ? E.level((14 - left) / 14 * 100, { sm: true, bubble: false, label: t("plan.used", "{n} de 14 dias usados", { n: 14 - left }) }) : '<button type="button" class="btn ghost" data-act="setPortal">' + esc(t("plan.manage", "Gerenciar assinatura")) + "</button>") + "</div></section>";
    var cards = '<div class="plans">' + PLANS.map(function (p) {
      return '<section class="plan' + (p.best ? " best" : "") + '">' + (p.best ? '<span class="plan-badge">' + esc(t("plan.best", "Mais vendido")) + "</span>" : "") + "<h3>" + esc(p.name) + '</h3><div class="plan-price"><b>$' + p.price + "</b><span>" + esc(t("plan.month", "/mês")) + '</span></div><div class="muted small">' + esc(p.users) + "</div>" +
        "<ul>" + p.feats.map(function (f) { return "<li>" + ic("check", 16) + esc(f) + "</li>"; }).join("") + "</ul>" +
        '<button type="button" class="btn' + (p.best ? "" : " ghost") + ' block" data-act="setCheckout" data-id="' + p.id + '"' + (S.setBusy ? " disabled" : "") + ">" + esc(plan === p.id ? t("plan.yours", "Seu plano") : t("plan.choose", "Assinar {n}", { n: p.name })) + "</button></section>";
    }).join("") + "</div>";
    return cur + cards + '<p class="muted small">' + esc(t("plan.note", "Anual: 2 meses grátis. Usuário extra: campo $5 · escritório $19. Pagamento seguro pelo Stripe; cancele quando quiser.")) + "</p>";
  }
  function dadosTab() {
    var demo = API.mode === "demo", org = API.currentOrg ? API.currentOrg() : null;
    var btn = function (id, label) { return '<button type="button" class="btn ghost sm" data-act="setExport" data-id="' + id + '">' + ic("download", 16) + esc(label) + "</button>"; };
    return '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.data.export", "Exportar")) + '</h3><span class="muted small">' + esc(t("set.data.exportSub", "Seus dados são seus. Baixe quando quiser.")) + "</span></div></div>" +
      '<div class="row">' + btn("json", t("set.data.json", "Tudo (JSON)")) + "</div>" +
      '<div class="label" style="margin-top:12px">' + esc(t("set.data.csv", "Planilhas (CSV)")) + '</div><div class="row">' + btn("projects", t("set.data.projects", "Projetos")) + btn("time", t("set.data.time", "Ponto")) + btn("expenses", t("set.data.expenses", "Despesas e receitas")) + btn("proposals", t("set.data.proposals", "Propostas")) + btn("team", t("set.data.team", "Equipe")) + "</div></section>" +
      (demo ? '<section class="panel set-sec"><div class="panel-head"><div><h3>' + esc(t("set.data.demo", "Modo demonstração")) + '</h3><span class="muted small">' + esc(t("set.data.demoSub", "Os dados ficam só neste aparelho.")) + "</span></div></div>" +
        '<div class="row"><button type="button" class="btn ghost" data-act="resetDemo">' + esc(t("set.data.reset", "Restaurar exemplos")) + "</button>" +
        (org && !org.example ? '<button type="button" class="btn danger" data-act="setDelAccount">' + ic("trash", 18) + esc(t("set.data.del", "Apagar esta conta de demonstração")) + "</button>" : "") + "</div>" +
        '<p class="muted small" style="margin-top:8px">' + esc(t("set.data.resetSub", "“Restaurar exemplos” volta a conta de exemplo (bruno / 1234) ao começo.")) + "</p></section>" : "");
  }
  function sobreTab() {
    return '<section class="panel set-sec"><div class="about"><img src="brand/logo-claro.svg" class="about-logo only-light" alt="' + esc(E.PRODUCT) + '" width="120" height="39"><img src="brand/logo-escuro.svg" class="about-logo only-dark" alt="" width="120" height="39">' +
      '<div><b>' + esc(E.PRODUCT) + " " + esc(E.APP_VERSION) + '</b><div class="muted small">' + esc(t("set.about.tag", "Gestão de obras para empreiteiros")) + " · " + esc(API.mode === "demo" ? t("help.demo", "modo demonstração") : t("help.live", "conectado")) + "</div></div></div>" +
      '<div class="row" style="margin-top:14px"><a class="btn ghost sm" href="site/termos.html" target="_blank" rel="noopener">' + ic("doc", 16) + esc(t("set.about.terms", "Termos de uso")) + '</a><a class="btn ghost sm" href="site/privacidade.html" target="_blank" rel="noopener">' + ic("lock", 16) + esc(t("set.about.privacy", "Privacidade")) + "</a>" +
      '<button type="button" class="btn ghost sm" data-act="tourStart">' + ic("star", 16) + esc(t("set.about.tour", "Rever o tour")) + '</button><button type="button" class="btn ghost sm" data-act="help">' + ic("help", 16) + esc(t("set.about.help", "Central de ajuda")) + "</button></div></section>";
  }

  EXT.views.settings = function () {
    var tab = S.setTab || "empresa", body = { empresa: empresaTab, aparencia: aparenciaTab, notificacoes: notifTab, plano: planoTab, dados: dadosTab, sobre: sobreTab }[tab] || empresaTab;
    return '<div class="page-head"><div><h1>' + esc(t("set.title", "Configurações")) + "</h1><p>" + esc(t("set.sub", "Empresa, aparência, notificações, plano e dados")) + "</p></div></div>" +
      '<nav class="tabs set-tabs" role="tablist" aria-label="' + esc(t("set.title", "Configurações")) + '">' + TABS.map(function (x) { return '<button type="button" role="tab" aria-selected="' + (tab === x[0]) + '" class="' + (tab === x[0] ? "on" : "") + '" data-act="setTab" data-id="' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("") + "</nav>" +
      '<div role="tabpanel" class="set-body">' + body() + "</div>";
  };

  // ═══════════ ações ═══════════
  function mark() { draft().dirty = true; var s = $(".set-save .muted"); if (s) s.textContent = t("set.unsaved", "Alterações não salvas"); }
  AC.setTab = function (el) { S.setTab = el.dataset.id; E.render(); };
  AC.setTheme = function (el) { E.setTheme(el.dataset.id); E.render(); };
  AC.setColor = function (el) { var d = draft(); d.accent = el.dataset.id; d.dirty = true; E.render(); };
  AC.setLogoRm = function () { var d = draft(); d.logo = ""; d.dirty = true; E.render(); };
  AC.setSaveCo = function () {
    var d = draft(); if (!String(d.name).trim()) { E.toast(t("set.err.name", "Informe o nome da empresa.")); return; }
    S.setBusy = true; E.render();
    var rec = { id: d.id, name: d.name.trim(), trade: d.trade, logo: d.logo, accent: d.accent, address: d.address.trim(), phone: d.phone.trim(), email: d.email.trim(), license: d.license.trim(), hicReg: String(d.hicReg || "").trim(), state: d.state };
    NV.tradeDef(d.trade).companyFlags.forEach(function (f) { rec[f.key] = !!d[f.key]; }); // opções do ramo escolhido (as de outro ramo ficam como estão)
    API.saveCompany(rec)
      .then(function () { S.setBusy = false; S.setCo = null; E.applyBrand({}); E.toast(t("set.ok", "Empresa salva.")); })
      .catch(function (e) { S.setBusy = false; E.render(); E.toast(e.message || t("set.err", "Não deu para salvar.")); });
  };
  AC.setCheckout = function (el) {
    var plan = el.dataset.id; S.setBusy = true; E.render();
    API.billingCheckout(plan).then(function (r) {
      S.setBusy = false; E.render();
      if (r && r.url) { location.href = r.url; return; }
      E.toast(t("plan.demo", "Plano {p}: disponível quando a cobrança for ativada.", { p: (PLANS.find(function (x) { return x.id === plan; }) || {}).name || plan }), { kind: "info" });
    }).catch(function (e) { S.setBusy = false; E.render(); E.toast(e.message, { kind: "bad" }); });
  };
  AC.setPortal = function () { API.billingPortal().then(function (r) { if (r && r.url) location.href = r.url; else E.toast(t("plan.demoPortal", "Disponível quando a cobrança for ativada."), { kind: "info" }); }).catch(function (e) { E.toast(e.message, { kind: "bad" }); }); };
  AC.setDelAccount = function () { S.modal = { type: "confirm", title: t("set.del.title", "Apagar conta"), text: t("set.del.text", "Apagar esta conta de demonstração e todos os dados dela neste aparelho? Isso não pode ser desfeito."), act: "setDelOk", id: "x", okLabel: t("set.del.ok", "Apagar conta") }; E.render(); };
  AC.setDelOk = function () { API.deleteAccount().then(function () { S.modal = null; S.user = null; S.view = "dashboard"; E.render(); E.toast(t("set.del.done", "Conta apagada.")); }).catch(function (e) { S.modal = null; E.render(); E.toast(e.message, { kind: "bad" }); }); };

  // exportar: usa só as funções da API que já existem (funciona igual no demo e no Supabase)
  function stamp() { return E.todayISO(); }
  function download(name, text, type) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  function strip(u) { var c = Object.assign({}, u); delete c.password; return c; }
  AC.setExport = function (el) {
    var k = el.dataset.id, co = S.company, pn = function (id) { var p = E.projectById(id); return p ? p.name : ""; }, un = function (id) { var u = (S.users || []).find(function (x) { return x.id === id; }); return u ? u.name : ""; };
    if (k === "json") {
      E.toast(t("set.data.preparing", "Preparando o arquivo…"));
      var from = "2000-01-01", to = "2100-12-31";
      Promise.all([API.listProjects(co), API.getFinancials(), API.listTime({ companyId: co }), API.listExpenses({ companyId: co }), API.listProposals ? API.listProposals(co) : [], API.listNotices ? API.listNotices() : [], API.listUsers(),
        API.listEvents ? API.listEvents(from, to) : [], API.listSchedule ? API.listSchedule(from, to) : [], API.listMaterials ? API.listMaterials() : [], API.listDeals ? API.listDeals() : []].map(function (p) { return Promise.resolve(p).catch(function () { return []; }); }))
        .then(function (r) {
          var strip64 = function (x) { return JSON.parse(JSON.stringify(x, function (key, v) { return typeof v === "string" && v.length > 2000 && /^data:/.test(v) ? t("settings.imageOmitted", "[imagem omitida]") : v; })); };
          var out = { app: E.PRODUCT, version: E.APP_VERSION, exportedAt: new Date().toISOString(), company: company(), org: API.currentOrg ? API.currentOrg() : null,
            projects: r[0], financials: r[1], time: r[2], expenses: r[3], proposals: r[4], notices: r[5], users: (r[6] || []).map(strip), events: r[7], schedule: r[8], materials: r[9], deals: r[10] };
          download("nivela-" + co + "-" + stamp() + ".json", JSON.stringify(strip64(out), null, 1), "application/json");
          E.toast(t("set.data.done", "Arquivo baixado."));
        });
      return;
    }
    var rows;
    if (k === "projects") { rows = [[t("settings.project", "Projeto"), t("settings.customer", "Cliente"), t("settings.address", "Endereço"), t("settings.status", "Status"), t("settings.home", "Início"), t("settings.estCompletion", "Previsão"), t("settings.tasksDone", "Tarefas feitas"), t("settings.tasks", "Tarefas"), t("settings.contractValue", "Valor da obra"), t("settings.spendingLimit", "Limite de gastos")]]; E.companyProjects().forEach(function (p) { var f = S.fin[p.id] || {}, tk = p.tasks || []; rows.push([p.name, p.client, p.address, E.statusLabel ? E.statusLabel(p.status) : p.status, p.startDate, p.estCompletion, tk.filter(function (x) { return x.done; }).length, tk.length, f.contractValue || "", f.budget || ""]); }); }
    else if (k === "time") { rows = [[t("settings.employee", "Funcionário"), t("settings.project", "Projeto"), t("settings.in", "Entrada"), t("settings.out", "Saída"), t("settings.hours", "Horas"), t("settings.hourlyRate", "Valor/hora")]]; S.time.filter(function (x) { return x.companyId === co; }).forEach(function (x) { rows.push([un(x.userId), pn(x.projectId), x.checkIn, x.checkOut || "", E.API.hoursOf(x).toFixed(2), x.rate]); }); }
    else if (k === "expenses") { rows = [[t("settings.date", "Data"), t("settings.type", "Tipo"), t("settings.category", "Categoria"), t("settings.project", "Projeto"), t("settings.vendor", "Fornecedor"), t("settings.amount", "Valor"), t("settings.note", "Observação")]]; S.expenses.filter(function (x) { return x.companyId === co; }).forEach(function (x) { rows.push([x.date, x.kind === "revenue" ? t("settings.revenue", "Receita") : t("settings.expense", "Despesa"), x.category, pn(x.projectId), x.vendor, x.amount, x.note]); }); }
    else if (k === "proposals") { rows = [[t("settings.number", "Número"), t("settings.type", "Tipo"), t("settings.customer", "Cliente"), t("settings.address", "Endereço"), t("settings.date", "Data"), t("settings.status", "Status"), "Total"]]; (S.proposals || []).filter(function (p) { return p.companyId === co; }).forEach(function (p) { rows.push([p.number, p.docType === "invoice" ? "Invoice" : E.t("proposals.rowEstimate", "Proposta"), (p.client || {}).name, (p.client || {}).address, p.date, E.tv(p.status), p.total]); }); }
    else { rows = [[t("settings.name", "Nome"), t("settings.username", "Usuário"), t("settings.role", "Papel"), t("settings.company", "Empresa"), t("settings.hourlyRate", "Valor/hora"), t("settings.active", "Ativo"), t("settings.csvEmail", "E-mail")]]; (S.users || []).forEach(function (u) { rows.push([u.name, u.username, E.roleLabel(u), E.companyName(u.companyId), u.rate, u.active ? t("settings.yes", "Sim") : t("settings.no", "Não"), u.email]); }); }
    E.csvDownload("nivela-" + k + "-" + stamp() + ".csv", rows);
  };

  // campos (sem redesenhar a cada tecla)
  EXT.input.push(function (el) {
    if (el.dataset.set && S.setCo) { S.setCo[el.dataset.set] = el.value; mark(); var pv = $(".set-doc .doc-head"); if (pv) pv.outerHTML = docPreview(S.setCo, S.setCo.logo || E.companyBrand(S.setCo.id).logo); return true; }
    return false;
  });
  EXT.change.push(function (el) {
    if (el.dataset.setflag && S.setCo) { S.setCo[el.dataset.setflag] = el.checked; mark(); return true; }
    if (el.dataset.set && S.setCo) { S.setCo[el.dataset.set] = el.value; S.setCo.dirty = true; if (el.tagName === "SELECT") E.render(); return true; } // texto: sem redesenhar (o clique em Salvar não se perde)
    if (el.id === "setColorPick" && S.setCo) { S.setCo.accent = el.value; S.setCo.dirty = true; E.render(); return true; }
    if (el.id === "setLogo" && el.files && el.files[0]) { E.resizeImage(el.files[0], 256).then(function (d) { var x = draft(); x.logo = d; x.dirty = true; E.render(); }).catch(function (e) { E.toast(e.message, { kind: "bad" }); }); return true; }
    if (el.dataset.notif) {
      var k = el.dataset.notif, on = el.checked;
      if (k === "browser" && on && window.Notification && Notification.permission === "default") {
        Notification.requestPermission().then(function (p) { E.setNotifPref("browser", p === "granted"); E.render(); if (p !== "granted") E.toast(t("set.nt.noPerm", "Permissão não concedida."), { kind: "bad" }); });
        return true;
      }
      E.setNotifPref(k, on); E.toast(on ? t("set.nt.on", "Ativado.") : t("set.nt.off", "Desativado.")); return true;
    }
    return false;
  });
  // ao entrar: lembrar compromissos de hoje (se ligado em Notificações)
  EXT.afterLogin.push(function (u) {
    if (!E.isStaff(u) || !E.notifPrefs().todayAgenda || !API.listEvents) return;
    var d = E.todayISO();
    API.listEvents(d, d).then(function (l) { var n = (l || []).filter(function (e) { return !e.done; }).length; if (n) setTimeout(function () { E.toast(t("set.nt.today", "Hoje: {n} compromisso(s) na agenda.", { n: n }), { kind: "info", action: { label: t("set.nt.see", "Ver"), run: function () { E.go("agenda"); } } }); }, 1200); }).catch(function () {});
  });
})();
