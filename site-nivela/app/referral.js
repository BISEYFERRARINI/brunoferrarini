/* Indique e ganhe (só o dono — Conta → Indique e ganhe).
   Oferta (docs/09-indicacao.md): o amigo ganha o 1º mês pago grátis; quem indicou ganha 1 mês grátis para cada amigo que
   virar cliente (crédito depois do 1º pagamento do amigo); na 3ª indicação paga, +1 mês de bônus; até 12 meses de crédito por ano.
   Link pessoal: SITE_URL/?ref=CÓDIGO → a página de vendas leva o código para o cadastro (/app/?signup=1&ref=CÓDIGO).
   Também: captura do ?ref= no app e aviso "Você foi indicado por …" no cadastro (onboarding.js lê S.refInfo). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, API = E.API, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  var PRICE = { starter: 49, pro: 99, business: 199 };
  var RKEY = "bisey_ref";

  // ── código que chegou pelo link (?ref=) — guardado 60 dias neste aparelho até a pessoa criar a conta ──
  function cleanCode(c) { c = String(c || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); return c.length >= 3 && c.length <= 32 ? c : ""; }
  try {
    var m = /[?&]ref=([^&#]+)/.exec(location.search), c0 = m ? cleanCode(decodeURIComponent(m[1])) : "";
    if (c0) localStorage.setItem(RKEY, JSON.stringify({ code: c0, at: Date.now() }));
  } catch (e) {}
  function storedRef() { try { var x = JSON.parse(localStorage.getItem(RKEY) || "null"); if (x && x.code && Date.now() - (x.at || 0) < 60 * 864e5) return x.code; } catch (e) {} return ""; }
  // usado pelo cadastro: código + nome de quem indicou (consulta só o nome da empresa)
  E.referralCode = storedRef;
  E.clearReferral = function () { try { localStorage.removeItem(RKEY); } catch (e) {} };
  E.peekReferral = function (code) { return API.peekReferral ? API.peekReferral(code).catch(function () { return null; }) : Promise.resolve(null); };

  // ── dados da tela ──
  var st = { loaded: false, loading: false, info: null, list: [] };
  function load() {
    if (st.loading) return; st.loading = true;
    Promise.all([API.referralInfo(), API.listReferrals()]).then(function (r) { st = { loaded: true, loading: false, info: r[0], list: r[1] || [] }; if (S.view === "indicar") E.render(); })
      .catch(function (e) { st = { loaded: true, loading: false, info: null, list: [], err: e && e.message }; if (S.view === "indicar") E.render(); });
  }
  EXT.load.push(function () { st.loaded = false; return Promise.resolve(); });
  function link() { return E.SITE_URL + "/?ref=" + encodeURIComponent((st.info || {}).code || ""); }
  function message() { return t("refer.msg", "Uso o {p} para tocar minhas obras: proposta por voz, notas que se lançam sozinhas e ponto com GPS. Cria sua conta por este link e ganha 1 mês grátis: {link}", { p: E.PRODUCT, link: link() }); }
  function credits(list) {
    var paid = list.filter(function (x) { return x.status === "paid"; }).length;
    var months = Math.min(12, paid + Math.floor(paid / 3));
    return { paid: paid, trial: list.filter(function (x) { return x.status === "trial"; }).length, invited: list.length, months: months, toBonus: 3 - (paid % 3) };
  }
  function statusPill(x) {
    var days = x.trialEndsAt ? Math.max(0, Math.ceil((new Date(x.trialEndsAt) - Date.now()) / 864e5)) : null;
    var m = { invited: ["neutral", t("refer.sInvited", "Convite enviado")], trial: ["accent", days != null ? E.tn("refer.sTrialDays", days, "Em teste · falta 1 dia", "Em teste · faltam {n} dias") : t("refer.sTrial", "Em teste")], paid: ["good", t("refer.sPaid", "Virou cliente · você ganhou 1 mês")], expired: ["neutral", t("refer.sExpired", "Não assinou")] }[x.status] || ["neutral", x.status];
    return '<span class="pill ' + m[0] + '">' + esc(m[1]) + "</span>";
  }

  EXT.views.indicar = function () {
    if (!st.loaded) load();
    var head = '<div class="page-head"><div><h1>' + esc(t("refer.title", "Indique e ganhe")) + "</h1><p>" + esc(t("refer.sub", "Indique para outro empreiteiro: ele ganha 1 mês grátis e você também.")) + "</p></div></div>";
    if (!st.loaded) return head + '<div class="panel" aria-busy="true"><span class="spin" aria-hidden="true"></span> ' + esc(t("refer.loading", "Carregando…")) + "</div>";
    if (!st.info) return head + E.emptyState({ icon: "gift", title: t("refer.unavailable", "Indicação indisponível agora"), text: st.err || "" });
    var c = credits(st.list), plan = st.info.plan, price = PRICE[plan];
    var hero = '<section class="panel ref-hero"><div class="ref-offer"><span class="ref-badge">' + ic("gift", 22) + "</span><div><h2>" + esc(t("refer.offer", "Dê 1 mês, ganhe 1 mês")) + "</h2>" +
      "<p>" + esc(t("refer.offerText", "Seu amigo ganha o 1º mês pago grátis. Você ganha 1 mês grátis quando ele virar cliente — e na 3ª indicação, mais 1 mês de bônus.")) + "</p></div></div>" +
      '<label class="field ref-link"><span>' + esc(t("refer.yourLink", "Seu link de indicação")) + '</span><span class="ref-link-row"><input type="text" id="refLink" readonly value="' + esc(link()) + '" aria-label="' + esc(t("refer.yourLink", "Seu link de indicação")) + '"><button type="button" class="btn" data-act="refCopy">' + ic("copy", 18) + esc(t("refer.copy", "Copiar")) + "</button></span></label>" +
      '<div class="muted small">' + esc(t("refer.code", "Código: {c}", { c: st.info.code })) + "</div>" +
      '<div class="ref-share" role="group" aria-label="' + esc(t("refer.shareAria", "Compartilhar o link")) + '">' +
      (navigator.share ? '<button type="button" class="btn ghost" data-act="refShare">' + ic("upload", 18) + esc(t("refer.share", "Compartilhar")) + "</button>" : "") +
      '<a class="btn ghost" href="https://wa.me/?text=' + encodeURIComponent(message()) + '" target="_blank" rel="noopener" data-ref-ch="whatsapp">' + ic("send", 18) + "WhatsApp</a>" +
      '<a class="btn ghost" href="sms:?&body=' + encodeURIComponent(message()) + '" data-ref-ch="sms">' + ic("phone", 18) + esc(t("refer.sms", "SMS")) + "</a>" +
      '<a class="btn ghost" href="mailto:?subject=' + encodeURIComponent(t("refer.mailSubject", "Um app para tocar a obra — 1 mês grátis")) + "&body=" + encodeURIComponent(message()) + '" data-ref-ch="email">' + ic("mail", 18) + esc(t("refer.email", "E-mail")) + "</a>" +
      '<button type="button" class="btn quiet" data-act="refCopyMsg">' + ic("copy", 18) + esc(t("refer.copyMsg", "Copiar mensagem")) + "</button></div>" +
      '<details class="ref-msg"><summary>' + esc(t("refer.seeMsg", "Ver a mensagem")) + '</summary><p class="small">' + esc(message()) + "</p></details></section>";
    var kpi = function (label, v, sub, cls) { return '<div class="kpi" style="grid-template-columns:1fr"><div><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + (cls || "") + '">' + v + '</div><div class="kpi-sub">' + esc(sub) + "</div></div></div>"; };
    var stats = '<div class="kpis ref-kpis">' +
      kpi(t("refer.kInvited", "Indicados"), String(c.invited), t("refer.kInvitedSub", "convites e cadastros")) +
      kpi(t("refer.kTrial", "Em teste"), String(c.trial), t("refer.kTrialSub", "testando agora")) +
      kpi(t("refer.kPaid", "Viraram clientes"), String(c.paid), t("refer.kPaidSub", "indicações pagas"), "v-good") +
      kpi(t("refer.kMonths", "Meses grátis ganhos"), String(c.months), price ? t("refer.kMonthsValue", "≈ {m} no seu plano", { m: E.money(c.months * price, 0) }) : t("refer.kMonthsTrial", "no plano que você escolher"), "v-good") + "</div>" +
      '<section class="panel ref-bonus"><div class="spread"><b>' + esc(c.toBonus === 3 && c.paid ? t("refer.bonusGot", "Bônus ganho! Faltam 3 para o próximo.") : E.tn("refer.toBonus", c.toBonus, "Falta 1 indicação paga para o mês de bônus", "Faltam {n} indicações pagas para o mês de bônus")) + '</b><span class="muted small num">' + (c.paid % 3) + "/3</span></div>" +
      E.level((c.paid % 3) / 3 * 100, { sm: true, label: t("refer.bonusAria", "Progresso até o bônus") }) +
      '<p class="muted small" style="margin:8px 0 0">' + esc(API.mode === "demo" ? t("refer.creditDemo", "Modo demonstração: os amigos da lista são exemplos.") : t("refer.creditLive", "Os créditos entram sozinhos na sua próxima fatura.")) + " " + esc(t("refer.creditCap", "Até 12 meses de crédito por ano. Crédito não vira dinheiro.")) + "</p></section>";
    var form = '<form id="refForm" class="panel ref-form"><h3>' + esc(t("refer.addTitle", "Anotar um convite")) + '</h3><p class="muted small" style="margin:0">' + esc(t("refer.addSub", "Para você lembrar quem já convidou. Quem criar a conta pelo seu link aparece aqui sozinho.")) + "</p>" +
      '<div class="grid2"><label class="field"><span>' + esc(t("refer.fName", "Nome ou empresa")) + '</span><input type="text" id="refName" required autocomplete="off"></label><label class="field"><span>' + esc(t("refer.fContact", "Telefone ou e-mail (opcional)")) + '</span><input type="text" id="refContact" autocomplete="off"></label></div>' +
      '<div class="row"><button type="submit" class="btn">' + ic("plus", 18) + esc(t("refer.add", "Anotar convite")) + "</button></div></form>";
    var list = '<div class="section-title"><h2>' + esc(t("refer.listTitle", "Seus indicados")) + "</h2></div>" + (st.list.length ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t("refer.cFriend", "Amigo")) + "</th><th>" + esc(t("refer.cStatus", "Situação")) + "</th><th>" + esc(t("refer.cWhen", "Desde")) + "</th><th></th></tr></thead><tbody>" +
      st.list.map(function (x) {
        return "<tr><td><b>" + esc(x.name) + "</b>" + (x.contact ? '<div class="muted small">' + esc(x.contact) + "</div>" : "") + "</td><td>" + statusPill(x) + "</td><td>" + esc(E.whenShort((x.paidAt || x.signedUpAt || x.invitedAt || "").slice(0, 10))) + "</td><td class=\"n\">" +
          (x.status === "invited" ? '<a class="btn ghost sm" href="https://wa.me/' + esc(String(x.contact || "").replace(/[^\d]/g, "").length >= 10 ? "1" + String(x.contact).replace(/[^\d]/g, "").slice(-10) : "") + "?text=" + encodeURIComponent(message()) + '" target="_blank" rel="noopener">' + esc(t("refer.remind", "Lembrar")) + "</a>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>" : E.emptyState({ icon: "gift", title: t("refer.empty", "Nenhuma indicação ainda"), text: t("refer.emptyText", "Mande o seu link para outro empreiteiro no WhatsApp. Quando ele criar a conta, aparece aqui.") }));
    var how = '<section class="panel ref-how"><h3>' + esc(t("refer.howTitle", "Como funciona")) + "</h3><ol>" +
      "<li>" + esc(t("refer.how1", "Mande o seu link para um empreiteiro que ainda não usa o app.")) + "</li>" +
      "<li>" + esc(t("refer.how2", "Ele cria a conta pelo link e testa 14 dias grátis, sem cartão. O 1º mês pago dele sai de graça.")) + "</li>" +
      "<li>" + esc(t("refer.how3", "Quando ele pagar a 1ª mensalidade, você ganha 1 mês grátis no seu plano. Na 3ª indicação paga, mais 1 mês de bônus.")) + "</li></ol>" +
      '<a class="small" href="' + "/termos.html" + "?lang=" + (E.LANG === "en" ? "en#referral" : E.LANG === "es" ? "es#recomendacion" : "pt#indicacao") + '" target="_blank" rel="noopener">' + esc(t("refer.terms", "Regras do programa de indicação")) + "</a></section>";
    return head + hero + stats + '<div class="grid2 ref-grid">' + form + how + "</div>" + list;
  };

  AC.refCopy = function () { E.copyText(link()); };
  AC.refCopyMsg = function () { E.copyText(message()); };
  AC.refShare = function () { if (navigator.share) navigator.share({ title: E.PRODUCT, text: message() }).catch(function () {}); };
  EXT.submit.refForm = function () {
    var n = (document.getElementById("refName") || {}).value || "", c = (document.getElementById("refContact") || {}).value || "";
    API.addReferral({ name: n, contact: c }).then(function () { st.loaded = false; load(); E.toast(t("refer.added", "Convite anotado. Agora mande o link para ele.")); }).catch(function (e) { E.toast(e.message || t("refer.err", "Não deu para salvar.")); });
  };

  // cartão no Plano (Configurações) e nada para quem não é dono
  E.referralCard = function () {
    return '<section class="panel ref-card"><span class="ref-badge">' + ic("gift", 20) + '</span><div><b>' + esc(t("refer.cardTitle", "Indique e ganhe 1 mês grátis")) + '</b><span class="muted small">' + esc(t("refer.cardText", "Para cada empreiteiro que virar cliente pelo seu link.")) + '</span></div><button type="button" class="btn sm" data-act="nav" data-id="indicar">' + esc(t("refer.cardGo", "Pegar meu link")) + "</button></section>";
  };
})();
