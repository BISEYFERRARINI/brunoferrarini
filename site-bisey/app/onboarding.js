/* Bisey — Criar conta / onboarding de empresa nova (4 passos) + checklist de primeiros passos no Painel.
   Funciona no modo demonstração (tudo neste aparelho) e chama API.createAccount no Supabase multiempresa
   (signUpOwner → createOrganization → uploadLogo/saveOrg → inviteMembers; ver data.js e docs/03b). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, API = E.API, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  function $(s) { return document.querySelector(s); }

  // ramos do cadastro: registro trades.js (ordem, ícone, nome e descrição curta de cada ramo)
  var TRADES = NV.tradeList().map(function (d) { return [d.id, d.icon, d.obLabel, d.obDesc]; });
  var STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
  var PALETTE = [["#2A5BFF", "Bisey"], ["#1F6FD1", NV.t("onboarding.blue", "Azul")], ["#C98200", NV.t("onboarding.amber", "Âmbar")], ["#B3202A", NV.t("onboarding.red", "Vermelho")], ["#6D28D9", NV.t("onboarding.purple", "Roxo")], ["#E2621B", NV.t("onboarding.orange", "Laranja")], ["#15803D", NV.t("onboarding.green", "Verde")], ["#334155", NV.t("onboarding.graphite", "Grafite")]];
  var STEPS = [t("ob.step1", "Sua conta"), t("ob.step2", "Sua empresa"), t("ob.step3", "Sua marca"), t("ob.step4", "Sua equipe")];

  function fresh() {
    return { step: 0, err: "", busy: false, done: null, brandBefore: E.brandOverride(),
      d: { name: "", email: "", password: "", orgName: "", trades: [], state: "MA", logo: "", accent: "#2A5BFF", team: [{ name: "", contact: "", role: "employee" }, { name: "", contact: "", role: "employee" }] } };
  }
  function restoreBrand() { var b = (S.signup && S.signup.brandBefore) || {}; E.applyBrand(Object.assign({ reset: true }, b)); }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || "").trim()); }

  // ═══════════ tela ═══════════
  function aside() {
    var tips = [
      ["clock", t("ob.aside.1", "Leva 2 minutos"), t("ob.aside.1d", "Conta, empresa, marca e equipe. Dá para mudar tudo depois em Configurações.")],
      ["star", t("ob.aside.2", "14 dias grátis"), t("ob.aside.2d", "Sem cartão. Escolha o plano só quando quiser continuar.")],
      ["team", t("ob.aside.3", "Sua equipe no celular"), t("ob.aside.3d", "Cada funcionário recebe usuário e senha e bate o ponto com selfie e GPS.")]
    ];
    return '<aside class="login-aside"><img class="login-logo" src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + esc(E.PRODUCT) + '" width="97" height="40">' +
      '<div class="login-pitch"><h1>' + esc(t("ob.aside.title", "Sua empresa no Bisey em 4 passos.")) + "</h1><p>" + esc(t("ob.aside.sub", "Elétrica, HVAC, plumbing, sprinkler, GC, drywall, pintura, piso, siding, telhado ou fundação: o app já vem com as tarefas, campos técnicos e propostas de cada um dos 11 ramos.")) + "</p>" +
      '<ul class="login-feats">' + tips.map(function (x) { return "<li>" + ic(x[0]) + "<div><b>" + esc(x[1]) + "</b><span>" + esc(x[2]) + "</span></div></li>"; }).join("") + "</ul></div>" +
      '<div class="login-foot">' + esc(t("ob.aside.foot", "Feito por empreiteiro, para empreiteiro.")) + "</div></aside>";
  }
  function field(key, label, type, attrs, hint) {
    var v = S.signup.d[key];
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" id="ob-' + key + '" data-ob="' + key + '" value="' + esc(v == null ? "" : v) + '" ' + (attrs || "") + ">" + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "") + "</label>";
  }
  function stepper() {
    var st = S.signup.step;
    return '<div class="ob-steps"><div class="ob-steps-t"><b>' + esc(t("ob.stepOf", "Passo {n} de 4", { n: st + 1 })) + "</b><span>" + esc(STEPS[st]) + "</span></div>" + E.level((st + 1) / 4 * 100, { sm: true, bubble: false, label: t("ob.progress", "Progresso do cadastro") }) +
      '<ol class="ob-dots">' + STEPS.map(function (s, i) { return '<li class="' + (i < st ? "done" : i === st ? "on" : "") + '"' + (i === st ? ' aria-current="step"' : "") + "><span>" + (i < st ? ic("check", 14) : i + 1) + "</span>" + esc(s) + "</li>"; }).join("") + "</ol></div>";
  }
  function previewCard() {
    var d = S.signup.d, name = d.orgName || t("ob.yourCompany", "Sua empresa"), tr = d.trades[0] || "electrical";
    var logo = d.logo ? '<img src="' + esc(d.logo) + '" alt="">' : '<span class="co-ini">' + esc(E.initials(name)) + "</span>";
    var title = NV.tradeDef(tr).proposal.title;
    return '<div class="ob-preview" aria-label="' + esc(t("ob.preview", "Prévia ao vivo")) + '"><div class="obp-side"><div class="obp-co"><span class="co-logo">' + logo + "</span><b>" + esc(name) + "</b></div>" +
      '<div class="obp-nav"><span class="on">' + ic("dash", 16) + esc(t("ob.pv.dash", "Painel")) + "</span><span>" + ic("folder", 16) + esc(t("ob.pv.projects", "Projetos")) + "</span><span>" + ic("doc", 16) + esc(t("ob.pv.proposals", "Propostas")) + "</span><span>" + ic("clock", 16) + esc(t("ob.pv.time", "Ponto")) + "</span></div></div>" +
      '<div class="obp-main"><div class="obp-row"><b>' + esc(t("ob.pv.progress", "Progresso das obras")) + '</b><span class="num">62%</span></div>' + E.level(62, { sm: true, label: "62%" }) +
      '<div class="obp-row"><span class="pill accent">' + esc(t("ob.pv.pill", "Em andamento")) + '</span><span class="btn sm" aria-hidden="true">' + ic("plus", 16) + esc(t("ob.pv.btn", "Nova proposta")) + "</span></div>" +
      '<div class="obp-doc"><div class="obp-doc-logo">' + logo + "</div><div><b>" + esc(name) + '</b><span class="obp-doc-t">' + title + "</span></div></div></div></div>";
  }
  function stepBody() {
    var sg = S.signup, d = sg.d, st = sg.step;
    if (st === 0) {
      return "<h2>" + esc(t("ob.s1.title", "Crie seu login")) + '</h2><p class="muted">' + esc(t("ob.s1.sub", "Você é o dono (administrador). A equipe você convida no passo 4.")) + "</p>" +
        field("name", t("ob.s1.name", "Seu nome"), "text", 'autocomplete="name" required') +
        field("email", t("ob.s1.email", "E-mail (é o seu login)"), "email", 'autocomplete="email" autocapitalize="none" inputmode="email" spellcheck="false" required') +
        '<label class="field"><span>' + esc(t("ob.s1.pass", "Senha (mínimo 6)")) + '</span><span class="pw"><input type="password" id="ob-password" data-ob="password" value="' + esc(d.password) + '" autocomplete="new-password" minlength="6" required><button type="button" class="pw-eye" data-act="obPw" aria-label="' + esc(t("ob.showPass", "Mostrar senha")) + '">' + ic("eye") + "</button></span></label>" +
        (API.mode === "demo" ? '<div class="ob-note">' + ic("info", 18) + "<span>" + esc(t("ob.s1.demo", "Modo demonstração: a conta e os dados ficam só neste aparelho. Nada é enviado.")) + "</span></div>" : "");
    }
    if (st === 1) {
      return "<h2>" + esc(t("ob.s2.title", "Sobre a sua empresa")) + "</h2>" +
        field("orgName", t("ob.s2.name", "Nome da empresa"), "text", 'autocomplete="organization" required placeholder="' + esc(t("ob.s2.ph", "Ex.: Silva Plumbing & Heating")) + '"') +
        '<fieldset class="ob-trades"><legend>' + esc(t("ob.s2.trade", "Ramo principal")) + ' <span class="muted">' + esc(t("ob.s2.tradeHint", "· pode marcar mais de um")) + "</span></legend><div class=\"ob-trade-grid" + (TRADES.length > 4 ? " many" : "") + "\">" +
        TRADES.map(function (x) { var on = d.trades.indexOf(x[0]) >= 0; return '<button type="button" class="ob-trade' + (on ? " on" : "") + '" data-act="obTrade" data-id="' + x[0] + '" aria-pressed="' + on + '"><span class="em-ic">' + ic(x[1], 22) + "</span><b>" + esc(x[2]) + "</b><span>" + esc(x[3]) + "</span>" + (on ? '<span class="ob-check">' + ic("check", 16) + "</span>" : "") + "</button>"; }).join("") + "</div>" +
        (d.trades.length > 1 ? '<div class="ob-note">' + ic("info", 18) + "<span>" + esc(t("ob.s2.multi", "Cada ramo vira uma empresa no app (ex.: “Acme Electric” e “Acme HVAC”), com troca num botão. Os nomes dá para ajustar em Configurações.")) + "</span></div>" : "") + "</fieldset>" +
        '<label class="field" style="max-width:240px"><span>' + esc(t("ob.s2.state", "Estado onde trabalha")) + '</span><select id="ob-state" data-ob="state">' + STATES.map(function (s) { return "<option" + (d.state === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></label>";
    }
    if (st === 2) {
      var light = E.luminance(d.accent) > 0.45;
      return "<h2>" + esc(t("ob.s3.title", "Sua marca")) + '</h2><p class="muted">' + esc(t("ob.s3.sub", "O logo e a cor aparecem no app da equipe, nas propostas e no PDF que o cliente recebe.")) + "</p>" +
        '<div class="ob-brand"><div class="stack">' +
        '<div><span class="label">' + esc(t("ob.s3.logo", "Logo")) + '</span><div class="ob-logo">' +
        (d.logo ? '<span class="ob-logo-img"><img src="' + esc(d.logo) + '" alt="' + esc(t("ob.s3.logoAlt", "Logo da empresa")) + '"></span>' : '<span class="ob-logo-img empty">' + ic("upload", 22) + "</span>") +
        '<div class="stack" style="gap:6px"><label class="btn ghost sm upload-btn">' + ic("upload", 16) + esc(d.logo ? t("ob.s3.change", "Trocar logo") : t("ob.s3.send", "Enviar logo")) + '<input type="file" id="obLogo" accept="image/*"></label>' +
        (d.logo ? '<button type="button" class="btn quiet sm" data-act="obLogoRm">' + esc(t("ob.s3.remove", "Remover")) + "</button>" : '<span class="muted small">' + esc(t("ob.s3.logoHint", "PNG, JPG ou SVG. Ajustamos o tamanho sozinhos.")) + "</span>") + "</div></div></div>" +
        '<div><span class="label">' + esc(t("ob.s3.color", "Cor de destaque")) + '</span><div class="ob-swatches" role="radiogroup" aria-label="' + esc(t("ob.s3.color", "Cor de destaque")) + '">' +
        PALETTE.map(function (c) { var on = d.accent.toLowerCase() === c[0].toLowerCase(); return '<button type="button" role="radio" aria-checked="' + on + '" class="ob-sw' + (on ? " on" : "") + '" style="--sw:' + c[0] + '" data-act="obColor" data-id="' + c[0] + '" aria-label="' + esc(c[1]) + '" title="' + esc(c[1]) + '"></button>'; }).join("") +
        '<label class="ob-sw custom" title="' + esc(t("ob.s3.custom", "Outra cor")) + '"><input type="color" id="obColorPick" value="' + esc(d.accent) + '" aria-label="' + esc(t("ob.s3.custom", "Outra cor")) + '">' + ic("plus", 16) + "</label></div>" +
        '<div class="muted small" style="margin-top:6px">' + esc(d.accent.toUpperCase()) + (light ? " · " + esc(t("ob.s3.light", "cor clara: vamos usar texto escuro nos botões")) : "") + "</div></div></div>" + previewCard() + "</div>";
    }
    var rows = d.team.map(function (m, i) {
      return '<div class="ob-member"><label class="field"><span>' + esc(t("ob.s4.name", "Nome")) + '</span><input type="text" data-obm="' + i + '.name" value="' + esc(m.name) + '" autocomplete="off" placeholder="' + esc(t("ob.s4.namePh", "Ex.: Carlos Souza")) + '"></label>' +
        '<label class="field"><span>' + esc(t("ob.s4.contact", "Telefone ou e-mail (opcional)")) + '</span><input type="text" data-obm="' + i + '.contact" value="' + esc(m.contact) + '" autocomplete="off" inputmode="email"></label>' +
        '<label class="field"><span>' + esc(t("ob.s4.role", "Papel")) + '</span><select data-obm="' + i + '.role"><option value="employee"' + (m.role !== "manager" ? " selected" : "") + ">" + esc(E.roleLabel("employee")) + '</option><option value="manager"' + (m.role === "manager" ? " selected" : "") + ">" + esc(E.roleLabel("manager")) + "</option></select></label>" +
        '<button type="button" class="x" data-act="obRmMember" data-id="' + i + '" aria-label="' + esc(t("ob.s4.rm", "Tirar esta pessoa")) + '">' + ic("x") + "</button></div>";
    }).join("");
    return "<h2>" + esc(t("ob.s4.title", "Convide sua equipe")) + '</h2><p class="muted">' + esc(t("ob.s4.sub", "Funcionários batem o ponto e veem as obras sem nenhum valor. Gerentes também cuidam da escala, agenda e propostas, sem ver o financeiro.")) + "</p>" +
      '<div class="stack" style="gap:10px">' + rows + "</div>" +
      '<button type="button" class="btn ghost sm" data-act="obAddMember" style="justify-self:start">' + ic("plus", 16) + esc(t("ob.s4.add", "Adicionar pessoa")) + "</button>" +
      '<div class="ob-note">' + ic("info", 18) + "<span>" + esc(API.mode === "demo" ? t("ob.s4.demo", "No modo demonstração criamos o usuário e a senha de cada um para você copiar e mandar no WhatsApp.") : t("ob.s4.live", "Cada pessoa recebe um usuário e uma senha para entrar no app.")) + "</span></div>";
  }
  function doneView() {
    var r = S.signup.done, inv = r.invites || [], url = location.origin + location.pathname;
    return '<div class="ob-done"><span class="ob-done-ic">' + ic("check", 30) + "</span><h2>" + esc(t("ob.done.title", "Tudo pronto!")) + '</h2><p class="muted">' + esc(t("ob.done.sub", "Sua conta foi criada. Copie os acessos da equipe e mande para cada um.")) + "</p></div>" +
      '<div class="table-wrap"><table><thead><tr><th>' + esc(t("ob.done.name", "Nome")) + "</th><th>" + esc(t("ob.done.user", "Usuário")) + "</th><th>" + esc(t("ob.done.pass", "Senha")) + "</th><th>" + esc(t("ob.done.role", "Papel")) + "</th><th></th></tr></thead><tbody>" +
      inv.map(function (x, i) { return "<tr><td><b>" + esc(x.name) + "</b>" + (x.contact ? '<div class="muted small">' + esc(x.contact) + "</div>" : "") + '</td><td><code>' + esc(x.username) + "</code></td><td><code>" + esc(x.password) + "</code></td><td>" + esc(E.roleLabel(x.role)) + '</td><td class="n"><button type="button" class="btn ghost sm icon-only" data-act="obCopy" data-id="' + i + '" aria-label="' + esc(t("ob.done.copyOne", "Copiar acesso de {n}", { n: x.name })) + '" title="' + esc(t("ob.done.copy", "Copiar")) + '">' + ic("copy", 16) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="row"><button type="button" class="btn ghost" data-act="obCopy" data-id="all">' + ic("copy", 18) + esc(t("ob.done.copyAll", "Copiar todos")) + "</button></div>" +
      '<div class="muted small">' + esc(t("ob.done.where", "Eles entram em {url} com o usuário e a senha acima.", { url: url })) + (API.mode === "demo" ? " " + esc(t("ob.done.demo", "No modo demonstração essas contas ficam só neste aparelho.")) : "") + "</div>" +
      '<div class="ob-foot"><span></span><button type="button" class="btn lg" data-act="obGoDash">' + esc(t("ob.done.go", "Ir para o painel")) + ic("chevr", 18) + "</button></div>";
  }
  EXT.signupView = function () {
    var sg = S.signup, st = sg.step, last = st === 3;
    var foot = sg.done ? "" : '<div class="ob-foot">' +
      (st === 0 ? '<button type="button" class="btn quiet" data-act="signupCancel">' + ic("chevl", 18) + esc(t("ob.toLogin", "Já tenho conta")) + "</button>" : '<button type="button" class="btn ghost" data-act="obBack"' + (sg.busy ? " disabled" : "") + ">" + ic("chevl", 18) + esc(t("ob.back", "Voltar")) + "</button>") +
      '<div class="row">' + (last ? '<button type="button" class="btn ghost" data-act="obFinish" data-id="skip"' + (sg.busy ? " disabled" : "") + ">" + esc(t("ob.skip", "Pular por agora")) + "</button>" : "") +
      '<button type="button" class="btn" data-act="' + (last ? "obFinish" : "obNext") + '"' + (sg.busy ? " disabled" : "") + ">" + (sg.busy ? '<span class="spin" aria-hidden="true"></span>' + esc(t("ob.creating", "Criando a conta…")) : esc(last ? t("ob.finish", "Criar conta e convidar") : t("ob.next", "Continuar")) + ic("chevr", 18)) + "</button></div></div>";
    // idioma: dá para trocar no 1º passo (a troca recarrega a página)
    return '<div class="login ob">' + aside() + '<main class="login-main" id="conteudo">' + (st === 0 && !sg.done ? E.langSwitch("login-lang") : "") + '<form class="login-card ob-card" id="obForm" novalidate>' +
      '<img class="login-logo-m only-light" src="brand/logo/bisey-lockup-horizontal-color.svg" alt="' + esc(E.PRODUCT) + '" width="82" height="34"><img class="login-logo-m only-dark" src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + esc(E.PRODUCT) + '" width="82" height="34">' +
      (sg.done ? doneView() : stepper() + (st === 0 ? refBanner() : "") + '<div class="stack ob-body">' + stepBody() + "</div>" + '<div class="err" id="obErr" role="alert"' + (sg.err ? "" : " hidden") + ">" + esc(sg.err) + "</div>" + foot) +
      "</form></main></div>";
  };

  // ═══════════ ações ═══════════
  function setErr(m) { S.signup.err = m || ""; var e = $("#obErr"); if (e) { e.textContent = S.signup.err; e.hidden = !m; } if (m) { var f = document.querySelector(".ob-body input:invalid, .ob-body [aria-invalid=true]"); if (f) f.focus(); } }
  function validate(step) {
    var d = S.signup.d;
    if (step === 0) {
      if (!d.name.trim()) return [t("ob.err.name", "Informe o seu nome."), "name"];
      if (!validEmail(d.email)) return [t("ob.err.email", "Informe um e-mail válido."), "email"];
      if (String(d.password).length < 6) return [t("ob.err.pass", "A senha precisa ter pelo menos 6 caracteres."), "password"];
    }
    if (step === 1) {
      if (!d.orgName.trim()) return [t("ob.err.org", "Informe o nome da empresa."), "orgName"];
      if (!d.trades.length) return [t("ob.err.trade", "Escolha pelo menos um ramo."), null];
    }
    return null;
  }
  function go(step) { S.signup.step = step; S.signup.err = ""; E.render(); window.scrollTo(0, 0); var f = document.querySelector(".ob-body input, .ob-body button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  // indicação: código que veio no link (?ref=, guardado por referral.js) → "Você foi indicado por …"
  function refBanner() {
    var r = S.signup && S.signup.ref; if (!r || !r.code) return "";
    return '<div class="ob-note ob-ref" role="status">' + ic("gift", 18) + "<span>" + (r.name ? esc(t("ob.refBy", "Você foi indicado por {n} — ganhou 1 mês grátis.", { n: r.name })) : esc(t("ob.refCode", "Você chegou por uma indicação (código {c}) — ganhou 1 mês grátis.", { c: r.code }))) + "</span></div>";
  }
  AC.signupStart = function () {
    S.signup = fresh(); S.modal = null;
    var code = E.referralCode ? E.referralCode() : "";
    if (code) { S.signup.ref = { code: code, name: "" }; E.peekReferral(code).then(function (x) { if (x && S.signup && S.signup.ref) { S.signup.ref.name = x.name; S.signup.ref.code = x.code || code; E.render(); } }); }
    try { if (/[?&](signup|onboarding)=1/.test(location.search)) history.replaceState(null, "", location.pathname); } catch (e) {}
    E.applyBrand({ accent: S.signup.d.accent }); E.render(); window.scrollTo(0, 0);
    var f = $("#ob-name"); if (f) f.focus();
  };
  AC.signupCancel = function () { restoreBrand(); S.signup = null; E.render(); };
  AC.obPw = function (el) { var i = $("#ob-password"); if (!i) return; var show = i.type === "password"; i.type = show ? "text" : "password"; el.classList.toggle("on", show); el.setAttribute("aria-label", show ? t("ob.hidePass", "Esconder senha") : t("ob.showPass", "Mostrar senha")); };
  AC.obNext = function () {
    var v = validate(S.signup.step);
    if (v) { if (v[1]) { var el = $("#ob-" + v[1]); if (el) el.setAttribute("aria-invalid", "true"); } setErr(v[0]); return; }
    go(Math.min(3, S.signup.step + 1));
  };
  AC.obBack = function () { go(Math.max(0, S.signup.step - 1)); };
  AC.obTrade = function (el) { var a = S.signup.d.trades, i = a.indexOf(el.dataset.id); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.id); S.signup.err = ""; E.render(); var b = document.querySelector('[data-act="obTrade"][data-id="' + el.dataset.id + '"]'); if (b) b.focus(); };
  AC.obColor = function (el) { S.signup.d.accent = el.dataset.id; E.applyBrand({ accent: el.dataset.id }); E.render(); var b = document.querySelector('[data-act="obColor"][data-id="' + el.dataset.id + '"]'); if (b) b.focus(); };
  AC.obLogoRm = function () { S.signup.d.logo = ""; E.render(); };
  AC.obAddMember = function () { S.signup.d.team.push({ name: "", contact: "", role: "employee" }); E.render(); var ins = document.querySelectorAll('[data-obm$=".name"]'); if (ins.length) ins[ins.length - 1].focus(); };
  AC.obRmMember = function (el) { S.signup.d.team.splice(Number(el.dataset.id), 1); if (!S.signup.d.team.length) S.signup.d.team.push({ name: "", contact: "", role: "employee" }); E.render(); };
  AC.obFinish = function (el) {
    var sg = S.signup, d = sg.d, skip = el && el.dataset.id === "skip";
    for (var s = 0; s < 2; s++) { var v = validate(s); if (v) { sg.step = s; sg.err = v[0]; E.render(); return; } }
    sg.busy = true; sg.err = ""; E.render();
    API.createAccount({
      owner: { name: d.name.trim(), email: d.email.trim().toLowerCase(), password: d.password, locale: E.LOCALE },
      org: { name: d.orgName.trim(), trades: d.trades.slice(), state: d.state, locale: E.LOCALE },
      logo: d.logo || "", accent: d.accent,
      team: skip ? [] : d.team.filter(function (m) { return m.name.trim(); }),
      referral: sg.ref && sg.ref.code ? sg.ref.code : null
    }).then(function (r) {
      sg.busy = false; if (sg.ref && E.clearReferral) E.clearReferral();
      if (r.invites && r.invites.length) { sg.done = r; E.render(); window.scrollTo(0, 0); return; } // a tela de acessos mantém a cor escolhida
      restoreBrand(); // daqui em diante vale a cor salva na empresa criada (API.companies), não mais a prévia
      return E.afterLogin(r.user).then(function () { E.toast(t("ob.welcome", "Conta criada. Bem-vindo ao {p}!", { p: E.PRODUCT })); });
    }).catch(function (e) {
      sg.busy = false; var m = (e && e.message) || t("ob.err.generic", "Não deu para criar a conta.");
      if (/e-mail|email|senha|nome/i.test(m) && !/empresa/i.test(m)) sg.step = 0;
      sg.err = m; E.render();
    });
  };
  AC.obGoDash = function () { var r = S.signup && S.signup.done; if (!r) return; restoreBrand(); E.afterLogin(r.user).then(function () { E.toast(t("ob.welcome", "Conta criada. Bem-vindo ao {p}!", { p: E.PRODUCT })); }); };
  AC.obCopy = function (el) {
    var inv = (S.signup.done || {}).invites || [], url = location.origin + location.pathname;
    var one = function (x) { return t("ob.copy.msg", "Acesso ao {p} — {name}\nEntre em: {url}\nUsuário: {u}\nSenha: {pw}", { p: E.PRODUCT, name: x.name, url: url, u: x.username, pw: x.password }); };
    E.copyText(el.dataset.id === "all" ? inv.map(one).join("\n\n") : one(inv[Number(el.dataset.id)]));
  };

  // campos: guardam no rascunho sem redesenhar (o cursor não pula)
  EXT.input.push(function (el) {
    if (!S.signup) return false;
    if (el.dataset.ob) { S.signup.d[el.dataset.ob] = el.value; el.removeAttribute("aria-invalid"); if (S.signup.err) setErr(""); return true; }
    if (el.dataset.obm) { var k = el.dataset.obm.split("."); S.signup.d.team[Number(k[0])][k[1]] = el.value; return true; }
    if (el.id === "obColorPick") { S.signup.d.accent = el.value; E.applyBrand({ accent: el.value }); return true; }
    return false;
  });
  EXT.change.push(function (el) {
    if (!S.signup) return false;
    if (el.id === "obColorPick") { S.signup.d.accent = el.value; E.applyBrand({ accent: el.value }); E.render(); return true; }
    if (el.dataset.ob) { S.signup.d[el.dataset.ob] = el.value; return true; }
    if (el.dataset.obm) { var k = el.dataset.obm.split("."); S.signup.d.team[Number(k[0])][k[1]] = el.value; return true; }
    if (el.id === "obLogo" && el.files && el.files[0]) {
      E.resizeImage(el.files[0], 256).then(function (d) { S.signup.d.logo = d; E.render(); }).catch(function (e) { setErr(e.message); });
      return true;
    }
    return false;
  });
  EXT.submit.obForm = function () { if (!S.signup || S.signup.done) return; if (S.signup.step === 3) AC.obFinish(); else AC.obNext(); };

  // ═══════════ checklist de primeiros passos (Painel do dono, conta nova) ═══════════
  function orgNow() { try { return API.currentOrg ? API.currentOrg() : null; } catch (e) { return null; } }
  function ckKey(org) { return "bisey_ob_checklist_" + (org && org.id) + "_" + (S.user && S.user.id); }
  function items() {
    var co = S.company;
    return [
      { id: "project", done: S.projects.some(function (p) { return p.companyId === co; }), title: t("ck.project", "Criar o primeiro projeto"), text: t("ck.project.d", "Ficha técnica, tarefas e plantas para a equipe."), act: "newProject", icon: "folder" },
      { id: "team", done: (S.users || []).length > 1, title: t("ck.team", "Convidar a equipe"), text: t("ck.team.d", "Usuário e senha para cada funcionário."), act: "nav", aid: "team", icon: "team" },
      { id: "voice", done: (S.proposals || []).some(function (p) { return p.companyId === co && p.speech; }), title: t("ck.voice", "Fazer a primeira proposta por voz"), text: t("ck.voice.d", "Fale o serviço e a proposta sai pronta."), act: "pNew", aid: "estimate", icon: "mic" },
      { id: "receipt", done: (S.expenses || []).some(function (x) { return x.receipt; }), title: t("ck.receipt", "Tirar foto de uma nota"), text: t("ck.receipt.d", "A nota entra na obra e no gasto certo."), act: "createNota", icon: "camera" },
      { id: "punch", done: (S.time || []).length > 0, title: t("ck.punch", "Bater o ponto"), text: t("ck.punch.d", "Um funcionário entra e bate o ponto com selfie e GPS."), act: "obPunchHint", icon: "clock" }
    ];
  }
  EXT.dashTop.push(function () {
    if (!E.can("settings")) return "";
    var org = orgNow(); if (!org || org.example) return "";
    if (E.storeGet(ckKey(org)) === "hidden") return "";
    var list = items(), n = list.filter(function (x) { return x.done; }).length;
    if (n === list.length) return "";
    return '<section class="panel checklist" aria-labelledby="ckTitle"><div class="panel-head"><div><h3 id="ckTitle">' + esc(t("ck.title", "Primeiros passos")) + '</h3><span class="muted small">' + esc(t("ck.count", "{n} de {total} feitos", { n: n, total: list.length })) + "</span></div>" +
      '<button type="button" class="btn quiet sm" data-act="obChecklistHide">' + esc(t("ck.hide", "Dispensar")) + "</button></div>" + E.level(n / list.length * 100, { sm: true, bubble: false, label: t("ck.count", "{n} de {total} feitos", { n: n, total: list.length }) }) +
      '<ul class="ck-list">' + list.map(function (x) {
        return '<li class="' + (x.done ? "done" : "") + '"><span class="ck-box" aria-hidden="true">' + (x.done ? ic("check", 16) : "") + '</span><span class="ck-t"><b>' + esc(x.title) + "</b><span>" + esc(x.text) + "</span></span>" +
          (x.done ? '<span class="sr-only">' + esc(t("ck.doneSr", "feito")) + "</span>" : '<button type="button" class="btn ghost sm" data-act="' + x.act + '"' + (x.aid ? ' data-id="' + x.aid + '"' : "") + ">" + ic(x.icon, 16) + esc(t("ck.go", "Fazer")) + "</button>") + "</li>";
      }).join("") + "</ul></section>";
  });
  AC.obChecklistHide = function () { var org = orgNow(); E.storeSet(ckKey(org), "hidden"); E.render(); E.toast(t("ck.hidden", "Checklist dispensado. A ajuda continua no botão “?”.")); };
  AC.obPunchHint = function () { E.go("time"); E.toast(t("ck.punchHint", "Peça para um funcionário entrar com o usuário dele e bater o ponto (selfie + GPS). O registro aparece aqui.")); };
})();
