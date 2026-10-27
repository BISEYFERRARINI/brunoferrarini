/* Nivela — Ajuda: botão "?" (e tecla ?) com perguntas comuns da tela atual, atalhos de teclado e contato,
   + tour de boas-vindas opcional (passos com destaque nos itens do menu). O tour lembra no aparelho (localStorage com try/catch). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  EXT.modals = EXT.modals || {};
  var CONTACT = "hello@getnivela.com";
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

  // ═══════════ perguntas comuns por tela ═══════════
  var FAQ = {
    dashboard: [
      [t("faq.dash.1q", "O que é o “Limite de gastos”?"), t("faq.dash.1a", "É quanto você quer gastar em material + mão de obra na obra. O painel compara o que já foi gasto (notas e horas do ponto) com esse limite. Defina em Projeto → Editar → Valores.")],
      [t("faq.dash.2q", "Como vejo só uma obra ou um período?"), t("faq.dash.2a", "Use os filtros Período, Projeto e Funcionário logo abaixo do título. Os cartões seguem o filtro; “Orçamento e limites” é sempre o acumulado da obra.")],
      [t("faq.dash.3q", "De onde vem a mão de obra?"), t("faq.dash.3a", "Das horas do ponto × valor/hora de cada funcionário (cadastrado em Equipe). Aumento de valor não muda horas antigas.")]
    ],
    projects: [
      [t("faq.proj.1q", "Como crio um projeto?"), t("faq.proj.1a", "Toque em “Novo projeto”: o assistente pede a obra, o tipo, as condições, a ficha técnica do seu ramo, as tarefas, o escopo e os valores. Dá para salvar em qualquer passo.")],
      [t("faq.proj.2q", "O funcionário vê os valores?"), t("faq.proj.2a", "Não. Funcionário vê ficha, escopo, tarefas, plantas e avisos, sem nenhum valor. O app avisa se o escopo tiver preço escrito.")],
      [t("faq.proj.3q", "Como o app sabe em qual obra o funcionário está?"), t("faq.proj.3a", "Pelo GPS na hora do ponto: se ele estiver dentro do raio da obra (padrão 150 m), a obra é escolhida sozinha. Use “Buscar no mapa” no passo Obra.")]
    ],
    proposals: [
      [t("faq.prop.1q", "Como faço uma proposta por voz?"), t("faq.prop.1a", "Toque em “Nova proposta”, aperte o microfone e fale o serviço, o preço e a forma de pagamento. O app monta a proposta no padrão da sua empresa; revise e salve.")],
      [t("faq.prop.2q", "A proposta sai em inglês?"), t("faq.prop.2a", "Sim. Você fala em português e o documento sai em inglês, no padrão americano (escopo, investimento, pagamento, não incluído, garantia, aceite).")],
      [t("faq.prop.3q", "Como o cliente aceita?"), t("faq.prop.3a", "Em “Enviar para o cliente” ele recebe um link para ver, baixar o PDF e aceitar online. Depois do aceite, gere o invoice com um toque.")]
    ],
    notas: [
      [t("faq.nota.1q", "Como lanço uma nota de compra?"), t("faq.nota.1a", "Toque em “Tirar foto da nota”. O app lê a nota, descobre a obra e a categoria e você só confere e salva.")],
      [t("faq.nota.2q", "E se a leitura errar?"), t("faq.nota.2a", "Corrija os campos antes de salvar. Se a foto ficar ruim, tire outra com boa luz e a nota inteira no quadro.")]
    ],
    time: [
      [t("faq.time.1q", "Como o funcionário bate o ponto?"), t("faq.time.1a", "No app dele, em Ponto: escolhe a obra (ou o GPS escolhe) e toca em Bater entrada; o app pede uma selfie e a localização. Na saída, o mesmo.")],
      [t("faq.time.2q", "E sem internet?"), t("faq.time.2a", "O ponto fica guardado no celular e é enviado sozinho quando a conexão voltar (até 24 h).")],
      [t("faq.time.3q", "Como corrijo um ponto errado?"), t("faq.time.3a", "Na tabela de registros, toque em “Corrigir” e ajuste a obra, a entrada ou a saída.")]
    ],
    escala: [[t("faq.esc.1q", "Como monto a escala da semana?"), t("faq.esc.1a", "Toque no “+” do dia de cada funcionário e escolha a obra e o horário. “Copiar semana anterior” repete a semana passada. O funcionário vê no app dele.")]],
    agenda: [[t("faq.ag.1q", "Quem recebe os compromissos?"), t("faq.ag.1a", "Os administradores e gerentes escolhidos em “Quem”. Cada item novo manda e-mail quando o servidor está ligado.")]],
    avisos: [[t("faq.av.1q", "O que é um aviso?"), t("faq.av.1a", "Um recado da obra (material faltando, problema, pedido do cliente), com foto opcional. Marque “Resolvido” quando cuidar dele.")]],
    gastos: [[t("faq.gas.1q", "Como lanço uma despesa ou um pagamento recebido?"), t("faq.gas.1a", "Use “Lançamento manual”: escolha Despesa ou Receita, a categoria, o valor e a obra. Notas com foto entram aqui sozinhas.")]],
    reports: [[t("faq.rep.1q", "Como pago a equipe?"), t("faq.rep.1a", "A folha de horas mostra dias, horas e o total de cada um no período. “Baixar CSV” gera a planilha para o pagamento ou o contador.")]],
    team: [[t("faq.team.1q", "Qual a diferença entre os papéis?"), t("faq.team.1a", "Administrador vê tudo. Gerente cuida de obras, escala, agenda, avisos, notas, ponto e propostas, sem ver valores financeiros nem Configurações. Funcionário bate o ponto e vê as obras sem valores.")]],
    prices: [[t("faq.pr.1q", "Para que servem “Meus preços”?"), t("faq.pr.1a", "Anote o preço de cada material por loja. O mais barato fica em verde e é usado na lista de material da proposta aceita.")]],
    settings: [[t("faq.set.1q", "Onde troco o logo e a cor?"), t("faq.set.1a", "Em Configurações → Empresa. A mudança aparece na hora no app e nas próximas propostas e PDFs.")]],
    punch: [[t("faq.punch.1q", "Bati o ponto na obra errada. E agora?"), t("faq.punch.1a", "Avise o administrador ou o gerente: eles corrigem o registro. Da próxima vez, confira a obra antes de bater a entrada.")]],
    jobs: [[t("faq.jobs.1q", "Como marco uma tarefa como feita?"), t("faq.jobs.1a", "Abra a obra → Tarefas e toque na tarefa. Fica registrado quem fez e quando.")]]
  };
  var ALIAS = { project: "projects", projectForm: "projects", proposalForm: "proposals", hours: "dashboard", me: "punch", myexp: "notas" };
  var GENERAL = [
    [t("faq.gen.1q", "Como acho qualquer coisa rápido?"), t("faq.gen.1a", "Use a busca no topo (ou {k}): obras, propostas, clientes, funcionários e ações.", { k: (isMac ? "⌘" : "Ctrl") + " K" })],
    [t("faq.gen.2q", "Funciona no celular?"), t("faq.gen.2a", "Sim. Instale pela tela inicial: no iPhone, Safari → Compartilhar → Adicionar à Tela de Início; no Android, menu ⋮ → Instalar app.")]
  ];
  function viewKey() { var v = S.view; if (S.user && !E.isStaff() && v === "project") return "jobs"; return FAQ[v] ? v : (ALIAS[v] || v); }

  EXT.modals.help = function () {
    var list = (FAQ[viewKey()] || []).concat(GENERAL), k = isMac ? "⌘" : "Ctrl";
    var keys = [[k + " K", t("help.k.search", "Buscar obra, proposta, cliente ou ação")], ["/", t("help.k.slash", "Também abre a busca")], ["?", t("help.k.help", "Abre esta ajuda")], ["Esc", t("help.k.esc", "Fecha janelas, menus e a busca")], ["↑ ↓ Enter", t("help.k.nav", "Navegar e abrir resultados da busca")]];
    return '<div class="help">' +
      '<section><h3>' + esc(t("help.faq", "Perguntas comuns desta tela")) + '</h3><div class="faq">' + list.map(function (q, i) { return "<details" + (i === 0 ? " open" : "") + "><summary>" + esc(q[0]) + ic("chevd", 18) + "</summary><p>" + esc(q[1]) + "</p></details>"; }).join("") + "</div></section>" +
      '<section><h3>' + esc(t("help.tour", "Tour de boas-vindas")) + '</h3><p class="muted small">' + esc(t("help.tourSub", "Um passeio de 1 minuto pelos pontos principais do menu.")) + '</p><button type="button" class="btn ghost" data-act="tourStart">' + ic("star", 18) + esc(t("help.tourBtn", "Fazer o tour")) + "</button></section>" +
      '<section class="help-keys"><h3>' + esc(t("help.keys", "Atalhos de teclado")) + "</h3><dl>" + keys.map(function (x) { return "<div><dt>" + x[0].split(" ").map(function (y) { return "<kbd>" + esc(y) + "</kbd>"; }).join(" ") + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl></section>" +
      '<section><h3>' + esc(t("help.contact", "Fale com a gente")) + '</h3><p class="muted small">' + esc(t("help.contactSub", "Respondemos em português e inglês, em dias úteis.")) + '</p><div class="row"><a class="btn ghost" href="mailto:' + CONTACT + '?subject=' + encodeURIComponent(E.PRODUCT + " · " + t("help.mailSubject", "Ajuda")) + '">' + ic("doc", 18) + esc(CONTACT) + "</a></div></section>" +
      '<p class="muted small help-ver">' + esc(E.PRODUCT) + " " + esc(E.APP_VERSION) + " · " + esc(E.API.mode === "demo" ? t("help.demo", "modo demonstração") : t("help.live", "conectado")) + "</p></div>";
  };
  AC.help = function () { if (S.tour) tourEnd(false); S.overlay = null; S.modal = { type: "help", title: t("help.title", "Ajuda") }; E.render(); };

  // ═══════════ tour de boas-vindas ═══════════
  var TOUR_KEY = "nivela_tour_v1";
  function tourDone() { return E.storeGet(TOUR_KEY + "_" + (S.user && S.user.id)) === "1"; }
  function markTour() { E.storeSet(TOUR_KEY + "_" + (S.user && S.user.id), "1"); }
  function mobile() { return window.matchMedia ? matchMedia("(max-width: 860px)").matches : window.innerWidth <= 860; }
  function steps() {
    var m = mobile();
    if (S.user && !E.isStaff()) return [
      { sel: m ? '.bottom-nav [data-id="punch"]' : '.sidebar [data-id="punch"]', title: t("tour.e1", "Bater o ponto"), text: t("tour.e1d", "Escolha a obra (ou deixe o GPS achar) e toque em Bater entrada. O app pede uma selfie.") },
      { sel: m ? '.bottom-nav [data-id="escala"]' : '.sidebar [data-id="escala"]', title: t("tour.e2", "Sua escala"), text: t("tour.e2d", "Onde você vai trabalhar nos próximos dias.") },
      { sel: m ? '.bottom-nav [data-id="jobs"]' : '.sidebar [data-id="jobs"]', title: t("tour.e3", "Obras e tarefas"), text: t("tour.e3d", "Ficha, plantas e a lista de tarefas para marcar o que terminou.") },
      { sel: m ? '.bottom-nav [data-id="notas"]' : '.sidebar [data-id="notas"]', title: t("tour.e4", "Notas de compra"), text: t("tour.e4d", "Tire foto da nota e ela entra na obra certa.") },
      { sel: (m ? ".m-top" : ".topbar") + ' [data-act="help"]', title: t("tour.end", "Ajuda sempre aqui"), text: t("tour.endd", "Toque no “?” para perguntas comuns, atalhos e para refazer este tour.") }
    ];
    return [
      { sel: m ? ".bottom-nav" : ".sidebar .nav", title: t("tour.a1", "Seu menu"), text: t("tour.a1d", "Tudo organizado por assunto: Hoje, Obras, Vendas, Equipe e Finanças.") },
      { sel: m ? '.m-top [data-act="search"]' : ".topbar .search", title: t("tour.a2", "Busca rápida"), text: t("tour.a2d", "Ache obra, proposta, cliente ou ação. No computador: {k}.", { k: (isMac ? "⌘" : "Ctrl") + " K" }) },
      { sel: m ? ".bottom-nav .plus" : ".create-dd > summary", title: t("tour.a3", "Criar"), text: t("tour.a3d", "Novo projeto, proposta por voz, foto de nota, aviso ou compromisso, de qualquer tela.") },
      { sel: m ? '.bottom-nav [data-id="projects"]' : '.sidebar [data-id="projects"]', title: t("tour.a4", "Projetos"), text: t("tour.a4d", "Cada obra com ficha técnica do seu ramo, tarefas, plantas, avisos e ponto.") },
      { sel: m ? '.bottom-nav [data-id="time"]' : '.sidebar [data-id="time"]', title: t("tour.a5", "Ponto da equipe"), text: t("tour.a5d", "Entradas e saídas com selfie e GPS de cada funcionário.") },
      { sel: (m ? ".m-top" : ".topbar") + ' [data-act="help"]', title: t("tour.end", "Ajuda sempre aqui"), text: t("tour.endd", "Toque no “?” para perguntas comuns, atalhos e para refazer este tour.") }
    ];
  }
  function layer() { var l = document.getElementById("tour"); if (!l) { l = document.createElement("div"); l.id = "tour"; document.body.appendChild(l); } return l; }
  function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; }
  function place() {
    if (!S.tour) return;
    var st = steps(), i = Math.min(S.tour.i, st.length - 1), s = st[i], el = document.querySelector(s.sel), l = layer(), vw = window.innerWidth, vh = window.innerHeight;
    var ok = visible(el), r = ok ? el.getBoundingClientRect() : null, pad = 6;
    var spot = ok ? '<div class="tour-spot" style="left:' + (r.left - pad) + "px;top:" + (r.top - pad) + "px;width:" + (r.width + pad * 2) + "px;height:" + (r.height + pad * 2) + 'px"></div>' : '<div class="tour-dim"></div>';
    var last = i === st.length - 1;
    var card = '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourT" aria-describedby="tourD"><div class="tour-n">' + esc(t("tour.count", "{n} de {total}", { n: i + 1, total: st.length })) + "</div><h3 id=\"tourT\">" + esc(s.title) + '</h3><p id="tourD">' + esc(s.text) + "</p>" +
      '<div class="tour-dots" aria-hidden="true">' + st.map(function (x, j) { return '<span class="' + (j === i ? "on" : "") + '"></span>'; }).join("") + "</div>" +
      '<div class="tour-act"><button type="button" class="btn quiet sm" data-tour="skip">' + esc(last ? t("tour.close", "Fechar") : t("tour.skip", "Pular tour")) + '</button><span class="sp"></span>' +
      (i > 0 ? '<button type="button" class="btn ghost sm" data-tour="prev">' + esc(t("tour.prev", "Voltar")) + "</button>" : "") +
      '<button type="button" class="btn sm" data-tour="next">' + esc(last ? t("tour.finish", "Concluir") : t("tour.next", "Próximo")) + "</button></div></div>";
    l.innerHTML = spot + card;
    var c = l.querySelector(".tour-card"), cw = Math.min(340, vw - 24), ch = c.offsetHeight || 180, left, top;
    if (ok) {
      if (r.right + 16 + cw < vw && r.height > vh * 0.5) { left = r.right + 16; top = Math.max(12, Math.min(vh - ch - 12, r.top + 12)); } // ao lado da barra lateral
      else { left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2)); top = r.bottom + 14 + ch < vh ? r.bottom + 14 : Math.max(12, r.top - ch - 14); }
    } else { left = (vw - cw) / 2; top = Math.max(12, (vh - ch) / 2); }
    c.style.width = cw + "px"; c.style.left = left + "px"; c.style.top = top + "px";
    var nb = c.querySelector('[data-tour="next"]'); if (nb && document.activeElement && !l.contains(document.activeElement)) try { nb.focus({ preventScroll: true }); } catch (e) { nb.focus(); }
  }
  function tourStart() {
    if (!S.user) return;
    S.modal = null; S.overlay = null; E.render();
    S.tour = { i: 0 }; place();
  }
  function tourEnd(finished) {
    S.tour = null; markTour(); var l = document.getElementById("tour"); if (l) l.remove();
    if (finished) E.toast(t("tour.done", "Pronto! O tour fica sempre na Ajuda (?)."));
    E.render();
  }
  AC.tourStart = tourStart;
  AC.tourLater = function () { markTour(); E.render(); };
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-tour]"); if (!b || !S.tour) return;
    ev.preventDefault(); ev.stopPropagation();
    var a = b.getAttribute("data-tour"), n = steps().length;
    if (a === "skip") return tourEnd(false);
    if (a === "prev") { S.tour.i = Math.max(0, S.tour.i - 1); return place(); }
    if (S.tour.i >= n - 1) return tourEnd(true);
    S.tour.i++; place();
  }, true);
  document.addEventListener("keydown", function (ev) {
    if (!S.tour) return;
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); tourEnd(false); return; }
    if (ev.key === "ArrowRight") { ev.preventDefault(); var n = steps().length; if (S.tour.i >= n - 1) tourEnd(true); else { S.tour.i++; place(); } return; }
    if (ev.key === "ArrowLeft") { ev.preventDefault(); S.tour.i = Math.max(0, S.tour.i - 1); place(); return; }
    if (ev.key === "Tab") { var l = document.getElementById("tour"), f = l ? [].slice.call(l.querySelectorAll("button")) : []; if (!f.length) return; var i = f.indexOf(document.activeElement); ev.preventDefault(); f[(i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  }, true);
  window.addEventListener("resize", function () { if (S.tour) place(); });
  window.addEventListener("scroll", function () { if (S.tour) place(); }, { passive: true });
  EXT.afterRender.push(function () { if (S.tour) { if (!S.user) { S.tour = null; var l = document.getElementById("tour"); if (l) l.remove(); } else place(); } });

  // convite para o tour no Painel de uma conta nova (some depois de feito ou dispensado)
  EXT.dashTop.push(function () {
    if (!S.user || tourDone()) return "";
    var org = null; try { org = E.API.currentOrg ? E.API.currentOrg() : null; } catch (e) {}
    if (!org || org.example) return "";
    return '<div class="tour-offer"><span class="em-ic">' + ic("star", 20) + "</span><div><b>" + esc(t("tour.offer", "Quer um tour rápido de 1 minuto?")) + '</b><span class="muted small">' + esc(t("tour.offerSub", "Mostramos onde fica cada coisa no menu.")) + '</span></div><span class="sp"></span><button type="button" class="btn quiet sm" data-act="tourLater">' + esc(t("tour.later", "Agora não")) + '</button><button type="button" class="btn sm" data-act="tourStart">' + esc(t("tour.go", "Fazer o tour")) + "</button></div>";
  });
})();
