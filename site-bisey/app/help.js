/* Bisey — Ajuda: botão "?" (e tecla ?) com perguntas comuns da tela atual, atalhos de teclado e contato,
   + tour de boas-vindas opcional (passos com destaque nos itens do menu). O tour lembra no aparelho (localStorage com try/catch). */
(function () {
  "use strict";
  var E = window.EE; if (!E) return;
  var S = E.S, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  EXT.modals = EXT.modals || {};
  var CONTACT = "hello@getbisey.com";
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
      [t("faq.prop.3q", "Como o cliente aceita?"), t("faq.prop.3a", "Em “Enviar para o cliente” ele recebe um link para ver, baixar o PDF e aceitar online. Depois do aceite, gere o invoice com um toque.")],
      [t("faq.prop.4q", "O que é a lista de material da proposta aceita?"), t("faq.prop.4a", "Quando o cliente aceita, o Bisey monta sozinho a lista de material do seu ramo e mostra, item por item, a loja mais barata com base nos seus preços (Meus preços) e nas promoções que você registrou. Mostra a economia do mix mais barato contra comprar tudo numa loja só. Marque o que foi comprado, exporte em CSV/PDF ou peça cotação ao fornecedor. Confirme o preço no caixa.")]
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
    prices: [[t("faq.pr.1q", "Para que servem “Meus preços”?"), t("faq.pr.1a", "Anote o preço de cada material por loja. O mais barato fica em verde e é usado na lista de material da proposta aceita.")], [t("faq.pr.2q", "De onde vêm os preços da lista de material?"), t("faq.pr.2a", "Só dos seus preços por loja, das ofertas que você anotou ou importou e, no futuro, de feeds oficiais das lojas. Preço com mais de 30 dias aparece marcado e promoção vencida não conta. Sem preço, o app mostra “Ver preço na loja”.")]],
    settings: [[t("faq.set.1q", "Onde troco o logo e a cor?"), t("faq.set.1a", "Em Configurações → Empresa. A mudança aparece na hora no app e nas próximas propostas e PDFs.")]],
    punch: [[t("faq.punch.1q", "Bati o ponto na obra errada. E agora?"), t("faq.punch.1a", "Avise o administrador ou o gerente: eles corrigem o registro. Da próxima vez, confira a obra antes de bater a entrada.")]],
    jobs: [[t("faq.jobs.1q", "Como marco uma tarefa como feita?"), t("faq.jobs.1a", "Abra a obra → Tarefas e toque na tarefa. Fica registrado quem fez e quando.")]],
    impostos: [
      [t("faq.tax.1q", "Como o app calcula o imposto do ano?"), t("faq.tax.1a", "Soma os pagamentos recebidos do ano e tira material, despesas, mão de obra do ponto e outras deduções. Sobre o lucro aplica o self-employment tax (15,3%), a taxa federal efetiva e a estadual que você escolher. É estimativa: confirme com o seu contador (CPA).")],
      [t("faq.tax.2q", "Quanto devo guardar de cada pagamento?"), t("faq.tax.2a", "Em Finanças → Impostos, o número grande diz o % para separar de cada pagamento recebido, com o exemplo do último pagamento.")],
      [t("faq.tax.3q", "Quando pago o imposto estimado?"), t("faq.tax.3a", "Em 4 vezes: 15 de abril, 15 de junho, 15 de setembro e 15 de janeiro. Depois de pagar, marque “Já paguei este trimestre”: fica registrado quem marcou e quando.")]
    ],
    indicar: [
      [t("faq.ref.1q", "Como funciona o Indique e ganhe?"), t("faq.ref.1a", "Mande o seu link (Conta → Indique e ganhe). O amigo ganha o 1º mês pago grátis; você ganha 1 mês grátis quando ele pagar a 1ª mensalidade, e 1 mês de bônus a cada 3 indicações pagas (até 12 meses por ano).")],
      [t("faq.ref.2q", "Quando o crédito entra?"), t("faq.ref.2a", "Depois do 1º pagamento do amigo, o crédito de 1 mês do seu plano entra na sua próxima fatura. Crédito não vira dinheiro.")]
    ],
    activity: [
      [t("faq.act.1q", "Como vejo quem fez cada coisa na obra?"), t("faq.act.1a", "Abra o projeto → Atividade. Aparece quem marcou tarefa, mandou aviso, lançou nota, enviou arquivo ou mudou a agenda e a escala, com dia e hora. O gerente vê sem os valores em dinheiro.")]
    ],
    assistant: [
      [t("faq.asst.1q", "O que o assistente faz?"), t("faq.asst.1a", "Responde como usar o app, na tela em que você está, e leva até a tela certa (“Mostrar onde”). Ele não vê nem muda os dados da sua empresa. Sem internet, mostra as respostas da ajuda do app.")]
    ]
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
      '<section class="help-assist"><h3>' + esc(t("help.assist", "Bisey Assist: pergunte o que quiser")) + '</h3><p class="muted small">' + esc(t("help.assistSub", "Assistente com IA, em português, inglês ou espanhol. Responde na hora; o que ele não resolver, uma pessoa da equipe responde por e-mail.")) + '</p><button type="button" class="btn" data-act="assistOpen">' + ic("help", 18) + esc(t("help.assistBtn", "Perguntar ao Assist")) + "</button></section>" +
      '<section><h3>' + esc(t("help.faq", "Perguntas comuns desta tela")) + '</h3><div class="faq">' + list.map(function (q, i) { return "<details" + (i === 0 ? " open" : "") + "><summary>" + esc(q[0]) + ic("chevd", 18) + "</summary><p>" + esc(q[1]) + "</p></details>"; }).join("") + "</div></section>" +
      '<section><h3>' + esc(t("help.tour", "Tour de boas-vindas")) + '</h3><p class="muted small">' + esc(t("help.tourSub", "Um passeio de 1 minuto pelos pontos principais do menu.")) + '</p><button type="button" class="btn ghost" data-act="tourStart">' + ic("star", 18) + esc(t("help.tourBtn", "Fazer o tour")) + "</button></section>" +
      '<section class="help-keys"><h3>' + esc(t("help.keys", "Atalhos de teclado")) + "</h3><dl>" + keys.map(function (x) { return "<div><dt>" + x[0].split(" ").map(function (y) { return "<kbd>" + esc(y) + "</kbd>"; }).join(" ") + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl></section>" +
      '<section><h3>' + esc(t("help.contact", "Fale com a gente")) + '</h3><p class="muted small">' + esc(t("help.contactSub", "Respondemos em português, inglês e espanhol, em dias úteis.")) + '</p><div class="row"><a class="btn ghost" href="mailto:' + CONTACT + '?subject=' + encodeURIComponent(E.PRODUCT + " · " + t("help.mailSubject", "Ajuda")) + '">' + ic("doc", 18) + esc(CONTACT) + "</a></div></section>" +
      '<p class="muted small help-ver">' + esc(E.PRODUCT) + " " + esc(E.APP_VERSION) + " · " + esc(E.API.mode === "demo" ? t("help.demo", "modo demonstração") : t("help.live", "conectado")) + "</p></div>";
  };
  AC.help = function () { if (S.tour) tourEnd(false); S.overlay = null; S.modal = { type: "help", title: t("help.titleAssist", "Ajuda + Assist") }; E.render(); loadAssist(); };

  // ═══════════ Bisey Assist (chat com IA): carregado só quando a ajuda abre (support/assist.js) ═══════════
  var assistP = null;
  function loadAssist() {
    if (window.BiseyAssist) return Promise.resolve(window.BiseyAssist);
    if (assistP) return assistP;
    assistP = new Promise(function (ok, no) {
      var v = encodeURIComponent(E.APP_VERSION || "1");
      var l = document.createElement("link"); l.rel = "stylesheet"; l.id = "nva-css"; l.href = "support/assist.css?v=" + v; document.head.appendChild(l);
      var sc = document.createElement("script"); sc.src = "support/assist.js?v=" + v; sc.async = true;
      sc.onload = function () { ok(window.BiseyAssist); }; sc.onerror = function () { assistP = null; no(new Error("assist")); };
      document.head.appendChild(sc);
    });
    return assistP;
  }
  function assistViews() {
    var g = S.user && !E.isStaff() ? E.NAV.employee : E.staffGroups();
    return (g || []).reduce(function (a, x) { return a.concat(x[1].map(function (n) { return n[0]; })); }, []);
  }
  function assistNav(view) {
    if (!S.user || assistViews().indexOf(view) < 0) return false;
    E.guardLeave(function () { E.go(view); }); return true;
  }
  // ═══════════ assistente dentro do app ═══════════
  // Botão flutuante sempre visível (depois de entrar), sabe a tela, o papel, o ramo e o idioma; sugere perguntas da tela;
  // responde com "Mostrar onde" (abre a tela e destaca no menu) ou começa o tour; sem IA/sem internet usa estes artigos.
  var STR = {
    title: function () { return t("asst.name", "Assistente"); },
    sub: function () { return t("asst.sub", "Tira dúvidas do app · IA"); },
    hello: function () { return t("asst.hello", "Oi, {n}! Sou o assistente do app. Pergunte como fazer qualquer coisa: eu explico e te levo até a tela certa.", { n: S.user ? E.firstName(S.user.name) : "" }); },
    placeholder: function () { return t("asst.placeholder", "Pergunte, ex.: como lanço uma nota?"); },
    note: function () { return t("asst.note", "IA pode errar. Ela não vê nem muda os dados da sua empresa."); },
    localIntro: function () { return t("asst.localIntro", "Não consegui falar com a IA agora. Achei isto na ajuda do app:"); },
    show: function () { return t("asst.show", "Mostrar onde"); }
  };
  // perguntas sugeridas por tela (e por papel: funcionário e gerente nunca recebem pergunta de dinheiro)
  function suggest() {
    var v = viewKey(), role = E.roleOf(), emp = role === "employee", tab = S.params && S.params.tab;
    var M = {
      dashboard: [t("asst.s.dash1", "O que é o limite de gastos?"), t("asst.s.dash2", "De onde vem a mão de obra?"), t("asst.s.dash3", "Quanto devo guardar de imposto?")],
      projects: [t("asst.s.proj1", "Como crio um projeto?"), t("asst.s.proj2", "O funcionário vê os valores?"), t("asst.s.proj3", "Como vejo quem fez cada coisa na obra?")],
      proposals: [t("asst.s.prop1", "Como faço uma proposta por voz?"), t("asst.s.prop2", "Como o cliente aceita online?"), t("asst.s.prop3", "Como viro a proposta em invoice?")],
      time: [t("asst.s.time1", "Como corrijo um ponto?"), t("asst.s.time2", "Alguém esqueceu de bater a saída")],
      notas: [t("asst.s.nota1", "Como lanço uma nota com foto?"), t("asst.s.nota2", "E se a leitura errar?")],
      impostos: [t("asst.s.tax1", "Como o app calcula o imposto?"), t("asst.s.tax2", "Quando vence o próximo pagamento?"), t("asst.s.tax3", "Que taxa federal eu uso?")],
      indicar: [t("asst.s.ref1", "Como funciona o Indique e ganhe?"), t("asst.s.ref2", "Quando o crédito entra?")],
      escala: [t("asst.s.esc1", "Como monto a escala da semana?"), t("asst.s.esc2", "O funcionário vê a escala?")],
      agenda: [t("asst.s.ag1", "Como crio um compromisso?"), t("asst.s.ag2", "Quem recebe os compromissos?")],
      avisos: [t("asst.s.av1", "O que é um aviso?"), t("asst.s.av2", "Como marco um aviso como resolvido?")],
      punch: [t("asst.s.punch1", "Como bato o ponto (punch in)?"), t("asst.s.punch2", "Diz que estou fora do raio"), t("asst.s.punch3", "Bati na obra errada")],
      jobs: [t("asst.s.jobs1", "Como marco uma tarefa como feita?"), t("asst.s.jobs2", "Como mando um aviso com foto?")],
      settings: [t("asst.s.set1", "Como troco o logo e a cor?"), t("asst.s.set2", "Como exporto meus dados?")]
    };
    var list = (tab === "activity" ? [t("asst.s.act1", "O que aparece na Atividade?")] : []).concat(M[v] || []);
    if (!list.length) list = [t("asst.s.gen1", "Como instalo no celular?"), t("asst.s.gen2", "Funciona sem internet?"), t("asst.s.gen3", "Como troco o idioma?")];
    if (emp || role === "manager") list = list.filter(function (q) { return !/imposto|impuesto|tax|limite de gastos|límite de gastos|spending limit|mão de obra|mano de obra|labor|crédito|credit/i.test(q); });
    if (!E.can("finance") && v === "dashboard") list = list.concat([t("asst.s.mgr1", "Quem está trabalhando agora?")]);
    return list.length ? list : [t("asst.s.gen1", "Como instalo no celular?")];
  }
  // busca nos artigos da ajuda (só os das telas que este papel abre)
  var VIEW_OF = { activity: "projects", assistant: "dashboard" };
  function localSearch(q) {
    var allowed = assistViews(), norm = function (x) { return String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
    var toks = norm(q).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2 && !/^(como|que|para|com|uma|the|how|and|for|you|meu|minha|onde|esta|isso|what|con|una|mis|donde|cual|eso|los|las|del)$/.test(w); });
    if (!toks.length) return [];
    var out = [];
    Object.keys(FAQ).forEach(function (k) {
      var view = VIEW_OF[k] || k; if (k !== "assistant" && allowed.indexOf(view) < 0) return; // funcionário/gerente: só ajuda das telas dele
      FAQ[k].forEach(function (x) { var h = norm(x[0] + " " + x[1]), sc = toks.reduce(function (a, w) { return a + (h.indexOf(w) >= 0 ? (norm(x[0]).indexOf(w) >= 0 ? 2 : 1) : 0); }, 0); if (sc) out.push({ q: x[0], a: x[1], view: allowed.indexOf(view) >= 0 ? view : null, s: sc }); });
    });
    GENERAL.forEach(function (x) { var h = norm(x[0] + " " + x[1]), sc = toks.reduce(function (a, w) { return a + (h.indexOf(w) >= 0 ? 1 : 0); }, 0); if (sc) out.push({ q: x[0], a: x[1], view: null, s: sc }); });
    return out.sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
  }
  // "Mostrar onde": abre a tela e destaca o item do menu com um passo do tour; "tour" começa o tour
  function showWhere(view) {
    E.guardLeave(function () {
      E.go(view);
      setTimeout(function () {
        var m = mobile(), sel = m ? '.bottom-nav [data-id="' + view + '"]' : '.sidebar [data-id="' + view + '"]';
        if (m && !document.querySelector(sel)) sel = '.bottom-nav [data-id="more"]';
        var lbl = ((E.allNav().find(function (n) { return n[0] === view; }) || [])[1]) || "";
        S.tour = { i: 0, one: { sel: sel, title: t("asst.here", "Fica aqui: {s}", { s: lbl }), text: m && /more/.test(sel) ? t("asst.hereMore", "No celular, toque em “Mais” e depois em “{s}”.", { s: lbl }) : t("asst.hereText", "Este é o caminho no menu. Você já está nesta tela.") } };
        place();
      }, 60);
    });
  }
  function assistNav(view) {
    if (!S.user) return false;
    if (view === "tour") { if (window.BiseyAssist && mobile()) window.BiseyAssist.close(); tourStart(); return true; }
    var show = /^show:/.test(view); view = view.replace(/^show:/, "");
    if (assistViews().indexOf(view) < 0) return false;
    if (show) { if (window.BiseyAssist && mobile()) window.BiseyAssist.close(); showWhere(view); return true; }
    E.guardLeave(function () { E.go(view); }); return true;
  }
  function assistOpts() {
    return {
      channel: "app", launcher: false, lang: function () { return E.LANG; }, onNavigate: assistNav,
      strings: function (k) { return STR[k] ? STR[k]() : null; }, suggest: suggest, localSearch: localSearch, showLabel: t("asst.show", "Mostrar onde"),
      getContext: function () {
        var org = null; try { org = E.API.currentOrg ? E.API.currentOrg() : null; } catch (e) {}
        var role = S.user ? E.roleOf() : "visitor", nav = S.user ? (E.allNav().find(function (n) { return n[0] === E.navActive(S.view); }) || [])[1] : "";
        return { page: location.pathname, appView: S.view, tab: (S.params && S.params.tab) || "", screen: nav || "", views: assistViews(), role: role, trade: S.user ? E.tradeOf(S.company) : "", plan: (org && org.plan) || "", demo: E.API.mode === "demo", appLang: E.LANG };
      },
      getContact: function () { var u = S.user || {}; return u.email && E.roleOf() !== "employee" ? { email: u.email, name: u.name || "" } : { name: u.name || "" }; }
    };
  }
  AC.assistOpen = function () {
    S.modal = null; S.overlay = null; E.render();
    loadAssist().then(function (NA) { NA.open(assistOpts()); }).catch(function () { E.toast(t("help.assistErr", "Não consegui abrir o Assist agora. Escreva para {mail}.", { mail: CONTACT })); });
  };
  // botão flutuante (fora do #app: não pisca a cada render). Sobe acima das barras fixas de "Salvar" do assistente de projeto e da proposta.
  function fab() {
    var b = document.getElementById("asst-fab");
    if (!S.user) { if (b) b.hidden = true; return; }
    if (!b) {
      b = document.createElement("button"); b.type = "button"; b.id = "asst-fab"; b.className = "asst-fab";
      b.innerHTML = ic("spark", 22) + '<span class="asst-fab-t"></span>';
      b.addEventListener("click", function () {
        if (window.BiseyAssist && window.BiseyAssist.isOpen()) { window.BiseyAssist.close(); return; }
        if (S.tour) tourEnd(false);
        loadAssist().then(function (NA) { NA.open(assistOpts()); }).catch(function () { E.toast(t("help.assistErr", "Não consegui abrir o Assist agora. Escreva para {mail}.", { mail: CONTACT })); AC.help(); });
      });
      document.body.appendChild(b);
    }
    b.hidden = false;
    b.querySelector(".asst-fab-t").textContent = t("asst.fab", "Assistente");
    b.setAttribute("aria-label", t("asst.fabAria", "Abrir o assistente: tire dúvidas sobre esta tela"));
    var bar = document.querySelector(".wiz-foot, .sticky-actions"), lift = 0;
    if (bar) { var r = bar.getBoundingClientRect(); if (r.height && r.bottom > window.innerHeight - 140) lift = Math.round(r.height) + 8; }
    document.documentElement.style.setProperty("--asst-lift", lift + "px");
  }
  EXT.afterRender.push(fab);
  window.addEventListener("scroll", function () { if (S.user) fab(); }, { passive: true });
  // link de tela vindo do Assist do site ou de um e-mail (ex.: /app/#projects): abre a tela depois de entrar
  var hashDone = false;
  EXT.afterRender.push(function () {
    if (hashDone || !S.user) return;
    var m = /^#([a-zA-Z]+)$/.exec(location.hash || ""); hashDone = true; if (!m) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    if (assistViews().indexOf(m[1]) >= 0 && m[1] !== S.view) setTimeout(function () { E.go(m[1]); }, 0);
  });

  // ═══════════ tour de boas-vindas ═══════════
  var TOUR_KEY = "bisey_tour_v1";
  function tourDone() { return E.storeGet(TOUR_KEY + "_" + (S.user && S.user.id)) === "1"; }
  function markTour() { E.storeSet(TOUR_KEY + "_" + (S.user && S.user.id), "1"); }
  function mobile() { return window.matchMedia ? matchMedia("(max-width: 860px)").matches : window.innerWidth <= 860; }
  function steps() {
    var m = mobile();
    if (S.tour && S.tour.one) return [S.tour.one];
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
    var one = S.tour && S.tour.one; // "Mostrar onde" do assistente: não conta como tour feito
    S.tour = null; if (!one) markTour(); var l = document.getElementById("tour"); if (l) l.remove();
    if (finished && !one) E.toast(t("tour.done", "Pronto! O tour fica sempre na Ajuda (?)."));
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
