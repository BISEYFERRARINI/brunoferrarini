/* Bisey Assist — widget de atendimento (JS puro, sem dependências).
   Site:  <script src="/app/support/assist.js" defer data-channel="site"></script>  → botão flutuante "Ajuda"
   App:   help.js carrega este arquivo só quando a pessoa abre o Assist (BiseyAssist.open({ channel: "app", ... })).
   Opções (BiseyAssist.init/open): { channel, api, launcher, lang: fn|str, getContext: fn, getContact: fn, onNavigate: fn(view) → bool,
     strings: fn(chave) → texto|null (o app troca nome, saudação etc. pelos textos dele, com t()),
     suggest: fn() → [perguntas da tela atual], localSearch: fn(pergunta) → [{ q, a, view }] (ajuda local quando a IA não responde),
     showLabel: texto do botão "Mostrar onde" }
   No app, links de tela aceitam "/app/#tela", "/app/#show:tela" (abre e destaca no menu) e "/app/#tour" (começa o tour).
   Conversa salva por sessão neste aparelho (localStorage com try/catch). Idioma PT/EN/ES (app/página/navegador).
   O servidor (/api/assist) responde só com a base de conhecimento; "Falar com uma pessoa" fica sempre visível. */
(function () {
  "use strict";
  if (window.BiseyAssist) return;
  var SCRIPT = document.currentScript;
  var BASE = SCRIPT && SCRIPT.src ? SCRIPT.src.replace(/[^/]*(\?.*)?$/, "") : "";

  // ═══════════ textos ═══════════
  var T = {
    pt: {
      launch: "Ajuda", title: "Bisey Assist", sub: "Assistente com IA · responde na hora", human: "Falar com uma pessoa", close: "Fechar", reset: "Nova conversa",
      hello: "Oi! Sou o Bisey Assist, o assistente do Bisey (IA). Respondo na hora sobre o app. O que eu não resolver, uma pessoa da equipe responde por e-mail.",
      placeholder: "Escreva sua pergunta…", send: "Enviar", typing: "Bisey Assist está digitando", note: "IA pode errar. Não envie senha nem cartão.",
      up: "Resposta útil", down: "Resposta não ajudou", thanks: "Obrigado pelo retorno!", downThanks: "Obrigado. Vou registrar para melhorar. Quer falar com uma pessoa?",
      offerHuman: "Quer que eu passe para uma pessoa da equipe?", yesHuman: "Sim, falar com uma pessoa",
      hTitle: "Falar com uma pessoa", hText: "Respondemos por e-mail em até 1 dia útil (seg–sex). A conversa vai junto: você não precisa repetir nada.",
      name: "Seu nome", email: "Seu e-mail", noteLbl: "Quer acrescentar algo? (opcional)", hSend: "Enviar para a equipe", cancel: "Cancelar", optional: "opcional",
      badEmail: "Confira o e-mail.", sending: "Enviando…", net: "Não consegui conectar. Tente de novo ou fale com uma pessoa.", retry: "Tentar de novo",
      leadQ: "Quer que a gente te mande um teste guiado? É rápido e sem compromisso.", leadYes: "Quero", leadNo: "Agora não",
      lTitle: "Teste guiado", lText: "Tudo é opcional, menos o e-mail para a gente responder.", company: "Empresa", trade: "Ramo", team: "Tamanho da equipe", lSend: "Pedir teste guiado",
      teamOpts: ["Só eu", "2–5", "6–15", "16–40", "Mais de 40"], tradeOther: "Outro", choose: "Escolha…",
      open: "Abrir", sent: "Pedido enviado", localIntro: "Não consegui falar com a IA agora. Achei isto na ajuda do app:", show: "Mostrar onde"
    },
    en: {
      launch: "Help", title: "Bisey Assist", sub: "AI assistant · instant answers", human: "Talk to a person", close: "Close", reset: "New conversation",
      hello: "Hi! I'm Bisey Assist, Bisey's AI assistant. I answer questions about the app right away. Anything I can't solve, a person on the team answers by email.",
      placeholder: "Type your question…", send: "Send", typing: "Bisey Assist is typing", note: "AI can make mistakes. Never send passwords or card numbers.",
      up: "Helpful answer", down: "Didn't help", thanks: "Thanks for the feedback!", downThanks: "Thanks. I'll log it so we improve. Want to talk to a person?",
      offerHuman: "Want me to pass this to a person on the team?", yesHuman: "Yes, talk to a person",
      hTitle: "Talk to a person", hText: "We reply by email within 1 business day (Mon–Fri). The conversation goes along, so you won't need to repeat anything.",
      name: "Your name", email: "Your email", noteLbl: "Anything to add? (optional)", hSend: "Send to the team", cancel: "Cancel", optional: "optional",
      badEmail: "Please check the email.", sending: "Sending…", net: "I couldn't connect. Try again or talk to a person.", retry: "Try again",
      leadQ: "Want us to send you a guided trial? Quick, no strings attached.", leadYes: "Yes, please", leadNo: "Not now",
      lTitle: "Guided trial", lText: "Everything is optional except the email, so we can reply.", company: "Company", trade: "Trade", team: "Crew size", lSend: "Request guided trial",
      teamOpts: ["Just me", "2–5", "6–15", "16–40", "40+"], tradeOther: "Other", choose: "Choose…",
      open: "Open", sent: "Request sent", localIntro: "I couldn't reach the AI right now. Here's what I found in the app's help:", show: "Show me where"
    },
    es: {
      launch: "Ayuda", title: "Bisey Assist", sub: "Asistente con IA · responde al instante", human: "Hablar con una persona", close: "Cerrar", reset: "Nueva conversación",
      hello: "¡Hola! Soy Bisey Assist, el asistente de Bisey (IA). Respondo al instante sobre la app. Lo que no pueda resolver, una persona del equipo lo responde por e-mail.",
      placeholder: "Escribe tu pregunta…", send: "Enviar", typing: "Bisey Assist está escribiendo", note: "La IA puede equivocarse. No envíes contraseñas ni tarjetas.",
      up: "Respuesta útil", down: "No ayudó", thanks: "¡Gracias por tu opinión!", downThanks: "Gracias. Lo registro para mejorar. ¿Quieres hablar con una persona?",
      offerHuman: "¿Quieres que lo pase a una persona del equipo?", yesHuman: "Sí, hablar con una persona",
      hTitle: "Hablar con una persona", hText: "Respondemos por e-mail en hasta 1 día hábil (lun–vie). La conversación va junto: no necesitas repetir nada.",
      name: "Tu nombre", email: "Tu e-mail", noteLbl: "¿Algo más? (opcional)", hSend: "Enviar al equipo", cancel: "Cancelar", optional: "opcional",
      badEmail: "Revisa el e-mail.", sending: "Enviando…", net: "No pude conectar. Inténtalo de nuevo o habla con una persona.", retry: "Reintentar",
      leadQ: "¿Quieres que te enviemos una prueba guiada? Es rápido y sin compromiso.", leadYes: "Sí, quiero", leadNo: "Ahora no",
      lTitle: "Prueba guiada", lText: "Todo es opcional menos el e-mail, para poder responderte.", company: "Empresa", trade: "Rubro", team: "Tamaño del equipo", lSend: "Pedir prueba guiada",
      teamOpts: ["Solo yo", "2–5", "6–15", "16–40", "Más de 40"], tradeOther: "Otro", choose: "Elige…",
      open: "Abrir", sent: "Pedido enviado", localIntro: "No pude hablar con la IA ahora. Encontré esto en la ayuda de la app:", show: "Mostrar dónde"
    }
  };
  var TRADES = { pt: ["Elétrica", "HVAC", "Plumbing", "Sprinkler", "General contractor", "Drywall", "Pintura", "Piso", "Siding", "Telhado", "Fundação"], en: ["Electrical", "HVAC", "Plumbing", "Fire sprinkler", "General contractor", "Drywall", "Painting", "Flooring", "Siding", "Roofing", "Foundation"], es: ["Electricidad", "HVAC", "Plomería", "Rociadores", "General contractor", "Drywall", "Pintura", "Pisos", "Siding", "Techos", "Cimientos"] };

  // sugestões: site e cada tela do app (admin/gerente) e do funcionário
  var SUG = {
    site: { pt: ["Quanto custa?", "Posso testar grátis?", "Funciona em português, inglês e espanhol?", "Como funciona o ponto com GPS?"], en: ["How much is it?", "Can I try it for free?", "Does it work in Portuguese?", "How does the GPS time clock work?"], es: ["¿Cuánto cuesta?", "¿Puedo probarla gratis?", "¿Está en español?", "¿Cómo funciona el reloj con GPS?"] },
    dashboard: { pt: ["O que é o limite de gastos?", "De onde vem a mão de obra?", "Como vejo só uma obra?"], en: ["What's the spending limit?", "Where does labor cost come from?", "How do I see a single job?"], es: ["¿Qué es el límite de gastos?", "¿De dónde sale la mano de obra?", "¿Cómo veo una sola obra?"] },
    projects: { pt: ["Como crio um projeto?", "O funcionário vê os valores?", "Como apago um projeto?", "O que o “Sugerir pela ficha” faz?"], en: ["How do I create a job?", "Can my crew see the money?", "How do I delete a job?", "What does “Suggest from specs” do?"], es: ["¿Cómo creo una obra?", "¿Mi cuadrilla ve el dinero?", "¿Cómo borro una obra?", "¿Qué hace “Sugerir según la ficha”?"] },
    proposals: { pt: ["Como faço uma proposta por voz?", "Como o cliente aceita online?", "Como viro a proposta em invoice?", "Como gero o PDF?"], en: ["How do I write an estimate by voice?", "How does the customer accept online?", "How do I turn it into an invoice?", "How do I get the PDF?"], es: ["¿Cómo hago un estimado por voz?", "¿Cómo acepta el cliente en línea?", "¿Cómo lo convierto en factura?", "¿Cómo saco el PDF?"] },
    time: { pt: ["Como corrijo um ponto?", "Esqueceram de bater a saída", "“Fora do raio”: o que fazer?", "Como vejo o pagamento da semana?"], en: ["How do I fix a punch?", "Someone forgot to punch out", "“Out of range”: what now?", "Where's the weekly pay?"], es: ["¿Cómo corrijo una marcación?", "Alguien olvidó marcar la salida", "“Fuera del radio”: ¿qué hago?", "¿Dónde está el pago de la semana?"] },
    team: { pt: ["Como cadastro um funcionário?", "Qual a diferença entre gerente e funcionário?", "Como troco a senha de alguém?"], en: ["How do I add an employee?", "Manager vs. employee?", "How do I reset someone's password?"], es: ["¿Cómo agrego un empleado?", "¿Gerente o empleado?", "¿Cómo cambio la contraseña de alguien?"] },
    escala: { pt: ["Como monto a escala da semana?", "O funcionário vê a escala?"], en: ["How do I build the weekly schedule?", "Can my crew see the schedule?"], es: ["¿Cómo armo el horario de la semana?", "¿El empleado ve el horario?"] },
    agenda: { pt: ["Como crio um compromisso?", "Quem recebe os compromissos?"], en: ["How do I add an appointment?", "Who gets the appointments?"], es: ["¿Cómo creo una cita?", "¿Quién recibe las citas?"] },
    avisos: { pt: ["O que é um aviso?", "Como marco um aviso como resolvido?"], en: ["What's a notice?", "How do I mark a notice resolved?"], es: ["¿Qué es un aviso?", "¿Cómo marco un aviso como resuelto?"] },
    gastos: { pt: ["Como lanço uma despesa?", "Como registro um pagamento recebido?"], en: ["How do I add an expense?", "How do I log a payment received?"], es: ["¿Cómo registro un gasto?", "¿Cómo registro un pago recibido?"] },
    notas: { pt: ["Como lanço uma nota com foto?", "E se a leitura errar?"], en: ["How do I add a receipt photo?", "What if the reading is wrong?"], es: ["¿Cómo subo la foto de un recibo?", "¿Y si la lectura sale mal?"] },
    reports: { pt: ["Como baixo a folha de horas?", "Como exporto para o contador?"], en: ["How do I download the timesheet?", "How do I export for my accountant?"], es: ["¿Cómo descargo las horas?", "¿Cómo exporto para el contador?"] },
    prices: { pt: ["Para que servem “Meus preços”?", "Como anoto uma oferta?"], en: ["What are “My prices” for?", "How do I log a deal?"], es: ["¿Para qué sirven “Mis precios”?", "¿Cómo anoto una oferta?"] },
    settings: { pt: ["Como troco o logo e a cor?", "Onde coloco o registro HIC?", "Como exporto meus dados?"], en: ["How do I change logo and color?", "Where do I add my HIC number?", "How do I export my data?"], es: ["¿Cómo cambio el logo y el color?", "¿Dónde pongo mi número HIC?", "¿Cómo exporto mis datos?"] },
    punch: { pt: ["Como bato o ponto?", "A câmera não abre", "Diz que estou fora do raio", "Bati na obra errada"], en: ["How do I punch in?", "The camera won't open", "It says I'm out of range", "I punched in at the wrong job"], es: ["¿Cómo marco la entrada?", "La cámara no abre", "Dice que estoy fuera del radio", "Marqué entrada en la obra equivocada"] },
    jobs: { pt: ["Como marco uma tarefa como feita?", "Como mando um aviso com foto?"], en: ["How do I mark a task done?", "How do I send a notice with a photo?"], es: ["¿Cómo marco una tarea como hecha?", "¿Cómo envío un aviso con foto?"] },
    me: { pt: ["Como troco o idioma?", "Onde vejo minhas horas?"], en: ["How do I change the language?", "Where are my hours?"], es: ["¿Cómo cambio el idioma?", "¿Dónde veo mis horas?"] },
    "default": { pt: ["Como instalo no celular?", "Funciona sem internet?", "Como troco o idioma?"], en: ["How do I install it on my phone?", "Does it work offline?", "How do I change the language?"], es: ["¿Cómo la instalo en el celular?", "¿Funciona sin internet?", "¿Cómo cambio el idioma?"] }
  };
  var VIEW_ALIAS = { project: "projects", projectForm: "projects", proposalForm: "proposals", hours: "dashboard", myexp: "notas" };

  // ═══════════ estado ═══════════
  var O = { channel: "site", api: "/api/assist", launcher: true }, st = null, root = null, lastFocus = null, busy = false;
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function key() { return "bisey_assist_v1_" + O.channel; }
  function rid() { try { var a = new Uint8Array(8); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); } catch (e) { return Math.random().toString(16).slice(2, 18); } }
  function load() {
    var s = store(key());
    if (!s || !s.sid || (s.at && Date.now() - s.at > 30 * 864e5)) s = { sid: "s" + Date.now().toString(36) + rid(), msgs: [], at: Date.now() };
    st = s;
  }
  function save() { st.at = Date.now(); if (st.msgs.length > 60) st.msgs = st.msgs.slice(-60); store(key(), st); }
  function L() {
    var l = typeof O.lang === "function" ? O.lang() : O.lang;
    if (!l) l = document.documentElement.lang || (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    l = String(l).toLowerCase();
    return l.indexOf("pt") === 0 ? "pt" : l.indexOf("es") === 0 ? "es" : "en";
  }
  function tx(k) { var o = null; try { o = typeof O.strings === "function" ? O.strings(k) : O.strings && O.strings[k]; } catch (e) {} if (o != null) return o; var l = L(); return (T[l] || T.en)[k]; }
  function ctx() { var c = {}; try { c = (O.getContext && O.getContext()) || {}; } catch (e) {} if (!c.page) c.page = location.pathname + location.hash; return c; }
  function contact() { try { return (O.getContact && O.getContact()) || {}; } catch (e) { return {}; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ═══════════ links: só getbisey.com; no app, "/app/#tela" navega dentro do app ═══════════
  function safeUrl(u) {
    u = String(u || "").trim();
    if (/^#[\w-]*$/.test(u) || /^\/(?!\/)\S*$/.test(u)) return u;
    if (/^mailto:[^@\s]+@([a-z0-9-]+\.)*getbisey\.com/i.test(u)) return u;
    try { var x = new URL(u); if (/^https?:$/.test(x.protocol) && /(^|\.)getbisey\.com$/i.test(x.hostname)) return x.href; } catch (e) {}
    return null;
  }
  function appView(u) { var m = /^(?:https?:\/\/(?:www\.)?getbisey\.com)?\/app\/?(?:index\.html)?(?:\?[^#]*)?#((?:show:)?[a-zA-Z]+)$/.exec(u || ""); return m ? m[1] : null; }
  function linkAttrs(u) {
    var v = appView(u);
    if (v && O.channel === "app") return ' href="' + esc(u) + '" data-nva-nav="' + esc(v) + '"';
    var ext = O.channel === "site" && /\/app\//.test(u);
    return ' href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : "");
  }

  // markdown mínimo e seguro: **negrito**, listas, links (só nossos), quebras de linha; tira a assinatura
  function md(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").filter(function (l) { return !/^\s*—\s*Bisey Assist/.test(l); });
    var out = [], list = null;
    function inline(s) {
      var parts = [], re = /\[([^\]]{1,120})\]\(([^)\s]{1,400})\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])|([A-Za-z0-9._%+-]+@getbisey\.com)/g, last = 0, m;
      while ((m = re.exec(s))) {
        parts.push(fmt(s.slice(last, m.index)));
        if (m[1]) { var u = safeUrl(m[2]); parts.push(u ? "<a" + linkAttrs(u) + ">" + fmt(m[1]) + "</a>" : fmt(m[1])); }
        else if (m[3]) { var u2 = safeUrl(m[3]); parts.push(u2 ? "<a" + linkAttrs(u2) + ">" + esc(m[3].replace(/^https?:\/\//, "")) + "</a>" : ""); }
        else parts.push('<a href="mailto:' + esc(m[4]) + '">' + esc(m[4]) + "</a>");
        last = re.lastIndex;
      }
      parts.push(fmt(s.slice(last)));
      return parts.join("");
    }
    function fmt(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }
    function close() { if (list) { out.push("</" + list + ">"); list = null; } }
    lines.forEach(function (l) {
      var n = /^\s*\d+[.)]\s+(.*)$/.exec(l), b = /^\s*[-•*]\s+(.*)$/.exec(l);
      if (n) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push("<li>" + inline(n[1]) + "</li>"); }
      else if (b) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(b[1]) + "</li>"); }
      else { close(); if (l.trim()) out.push("<p>" + inline(l) + "</p>"); }
    });
    close();
    return out.join("");
  }

  // ═══════════ DOM ═══════════
  var ICON = {
    chat: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 12l16-8-6 16-2-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    person: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M7 11v9H4v-9zM7 11l4-8c2 0 3 1 3 3v3h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M7 13V4H4v9zM7 13l4 8c2 0 3-1 3-3v-3h5a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-2H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };
  function css() {
    if (document.getElementById("nva-css")) return;
    var l = document.createElement("link"); l.id = "nva-css"; l.rel = "stylesheet"; l.href = (O.css || BASE + "assist.css"); document.head.appendChild(l);
  }
  function launcher() {
    if (!O.launcher || document.getElementById("nva-launch")) return;
    css();
    var b = document.createElement("button");
    b.type = "button"; b.id = "nva-launch"; b.className = "nva-launch"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "nva-panel");
    b.innerHTML = ICON.chat + '<span class="nva-launch-t"></span>';
    b.querySelector(".nva-launch-t").textContent = tx("launch");
    b.addEventListener("click", function () { root && !root.hidden ? close() : open(); });
    document.body.appendChild(b);
    // a página pode trocar de idioma depois (site PT/EN): atualiza o rótulo
    try { new MutationObserver(function () { var t = b.querySelector(".nva-launch-t"); if (t) t.textContent = tx("launch"); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] }); } catch (e) {}
  }
  function build() {
    css();
    if (root) return;
    root = document.createElement("section");
    root.id = "nva-panel"; root.className = "nva-panel"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "false"); root.setAttribute("aria-labelledby", "nva-title");
    document.body.appendChild(root);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    });
  }
  function shell() {
    root.setAttribute("lang", L() === "pt" ? "pt-BR" : L());
    root.innerHTML =
      '<header class="nva-head"><div class="nva-id"><span class="nva-dot" aria-hidden="true"></span><div><h2 id="nva-title">' + esc(tx("title")) + '</h2><p class="nva-sub">' + esc(tx("sub")) + "</p></div></div>" +
      '<div class="nva-tools"><button type="button" class="nva-ic" data-nva="reset" aria-label="' + esc(tx("reset")) + '" title="' + esc(tx("reset")) + '">' + ICON.reset + "</button>" +
      '<button type="button" class="nva-ic" data-nva="close" aria-label="' + esc(tx("close")) + '" title="' + esc(tx("close")) + '">' + ICON.x + "</button></div>" +
      '<button type="button" class="nva-human" data-nva="human">' + ICON.person + "<span>" + esc(tx("human")) + "</span></button></header>" +
      '<div class="nva-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>' +
      '<form class="nva-form" novalidate><label class="nva-sr" for="nva-in">' + esc(tx("placeholder")) + '</label><textarea id="nva-in" rows="1" maxlength="2000" placeholder="' + esc(tx("placeholder")) + '" autocomplete="off"></textarea>' +
      '<button type="submit" class="nva-send" aria-label="' + esc(tx("send")) + '">' + ICON.send + "</button></form>" +
      '<p class="nva-note">' + esc(tx("note")) + "</p>";
    var f = root.querySelector(".nva-form"), ta = root.querySelector("textarea");
    f.addEventListener("submit", function (e) { e.preventDefault(); send(ta.value); });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; });
    paint();
  }
  function log() { return root.querySelector(".nva-log"); }
  function bubble(m) {
    var me = m.role === "user", h = '<div class="nva-msg ' + (me ? "me" : "bot") + (m.kind ? " " + m.kind : "") + '" data-id="' + esc(m.id || "") + '">';
    h += '<div class="nva-b">' + (me ? "<p>" + esc(m.text).replace(/\n/g, "<br>") + "</p>" : md(m.text) + (m.local ? localHtml(m) : "")) + "</div>";
    if (!me && m.actions && m.actions.length) h += '<div class="nva-acts">' + m.actions.map(function (a) { var u = safeUrl(a.url); return u ? "<a class=\"nva-act\"" + linkAttrs(u) + ">" + esc(a.label) + "</a>" : ""; }).join("") + "</div>";
    if (!me && m.id && !m.kind) {
      h += '<div class="nva-rate" role="group" aria-label="' + esc(tx("up")) + " / " + esc(tx("down")) + '">' +
        '<button type="button" class="nva-r" data-nva="up" aria-pressed="' + (m.rating === "up") + '" aria-label="' + esc(tx("up")) + '" title="' + esc(tx("up")) + '">' + ICON.up + "</button>" +
        '<button type="button" class="nva-r" data-nva="down" aria-pressed="' + (m.rating === "down") + '" aria-label="' + esc(tx("down")) + '" title="' + esc(tx("down")) + '">' + ICON.down + "</button></div>";
    }
    return h + "</div>";
  }
  function suggestions() {
    var own = null; try { own = O.suggest && O.suggest(); } catch (e) {}
    if (own && own.length) return '<div class="nva-chips" role="group">' + own.slice(0, 4).map(function (q) { return '<button type="button" class="nva-chip" data-nva="ask">' + esc(q) + "</button>"; }).join("") + "</div>";
    var key = "site";
    if (O.channel === "app") { var v = (ctx().appView) || ""; v = VIEW_ALIAS[v] || v; if (ctx().role === "employee" && v === "projects") v = "jobs"; key = SUG[v] ? v : "default"; }
    var l = L(), list = (SUG[key][l] || SUG[key].en).slice(0, 4);
    return '<div class="nva-chips" role="group">' + list.map(function (q) { return '<button type="button" class="nva-chip" data-nva="ask">' + esc(q) + "</button>"; }).join("") + "</div>";
  }
  function paint() {
    var h = bubble({ role: "assistant", text: tx("hello"), kind: "hello" });
    st.msgs.forEach(function (m) { h += bubble(m); });
    if (!st.msgs.length) h += suggestions();
    h += '<div class="nva-extra"></div>';
    log().innerHTML = h;
    extras();
    scroll();
  }
  function scroll() { var l = log(); l.scrollTop = l.scrollHeight; }
  function extra(html) { var x = root.querySelector(".nva-extra"); if (x) { x.innerHTML = html; scroll(); var f = x.querySelector("input:not([type=hidden]):not(.nva-hp), button"); return f; } }
  // cartões depois da última mensagem: oferta de pessoa (handoff), oferta de teste guiado (site), formulário aberto
  function extras() {
    if (st.form === "human") return humanForm();
    if (st.form === "lead") return leadForm();
    var lastBot = null; for (var i = st.msgs.length - 1; i >= 0; i--) if (st.msgs[i].role === "assistant") { lastBot = st.msgs[i]; break; }
    if (lastBot && (lastBot.handoff || lastBot.rating === "down") && !st.ticket) return extra('<div class="nva-card"><p>' + esc(tx("offerHuman")) + '</p><div class="nva-row"><button type="button" class="nva-btn" data-nva="human">' + esc(tx("yesHuman")) + "</button></div></div>");
    if (O.channel === "site" && lastBot && !lastBot.handoff && !lastBot.kind && !st.lead && !st.leadNo && st.msgs.filter(function (m) { return m.role === "assistant" && !m.kind; }).length >= 1)
      return extra('<div class="nva-card nva-soft"><p>' + esc(tx("leadQ")) + '</p><div class="nva-row"><button type="button" class="nva-btn" data-nva="lead">' + esc(tx("leadYes")) + '</button><button type="button" class="nva-btn ghost" data-nva="leadNo">' + esc(tx("leadNo")) + "</button></div></div>");
    extra("");
  }
  function field(id, label, type, val, req, ac) {
    return '<label class="nva-f" for="' + id + '"><span>' + esc(label) + (req ? "" : ' <em>(' + esc(tx("optional")) + ")</em>") + '</span><input id="' + id + '" type="' + type + '" value="' + esc(val || "") + '"' + (req ? " required" : "") + (ac ? ' autocomplete="' + ac + '"' : "") + "></label>";
  }
  function humanForm() {
    var c = Object.assign({}, contact(), st.contact || {});
    var f = extra('<form class="nva-card nva-hform" novalidate><h3>' + esc(tx("hTitle")) + '</h3><p class="nva-muted">' + esc(tx("hText")) + "</p>" +
      field("nva-hn", tx("name"), "text", c.name, false, "name") + field("nva-he", tx("email"), "email", c.email, true, "email") +
      '<label class="nva-f" for="nva-hx"><span>' + esc(tx("noteLbl")) + '</span><textarea id="nva-hx" rows="2" maxlength="1000"></textarea></label>' +
      '<input class="nva-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="nva-err" role="alert" hidden></p><div class="nva-row"><button type="submit" class="nva-btn">' + esc(tx("hSend")) + '</button><button type="button" class="nva-btn ghost" data-nva="cancelForm">' + esc(tx("cancel")) + "</button></div></form>");
    var form = root.querySelector(".nva-hform");
    form.addEventListener("submit", function (e) { e.preventDefault(); submitHandoff(form, "support"); });
    var em = root.querySelector("#nva-he"); if (em) { (em.value ? root.querySelector("#nva-hx") : em).focus(); }
    return f;
  }
  function leadForm() {
    var c = Object.assign({}, contact(), st.contact || {}), l = L();
    var trades = (TRADES[l] || TRADES.en).concat([tx("tradeOther")]);
    extra('<form class="nva-card nva-lform" novalidate><h3>' + esc(tx("lTitle")) + '</h3><p class="nva-muted">' + esc(tx("lText")) + "</p>" +
      field("nva-ln", tx("name"), "text", c.name, false, "name") + field("nva-le", tx("email"), "email", c.email, true, "email") + field("nva-lc", tx("company"), "text", "", false, "organization") +
      '<label class="nva-f" for="nva-lt"><span>' + esc(tx("trade")) + ' <em>(' + esc(tx("optional")) + ')</em></span><select id="nva-lt"><option value="">' + esc(tx("choose")) + "</option>" + trades.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<label class="nva-f" for="nva-ls"><span>' + esc(tx("team")) + ' <em>(' + esc(tx("optional")) + ')</em></span><select id="nva-ls"><option value="">' + esc(tx("choose")) + "</option>" + tx("teamOpts").map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<input class="nva-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="nva-err" role="alert" hidden></p><div class="nva-row"><button type="submit" class="nva-btn">' + esc(tx("lSend")) + '</button><button type="button" class="nva-btn ghost" data-nva="cancelForm">' + esc(tx("cancel")) + "</button></div></form>");
    var form = root.querySelector(".nva-lform");
    form.addEventListener("submit", function (e) { e.preventDefault(); submitHandoff(form, "lead"); });
    var n = root.querySelector("#nva-ln"); if (n) n.focus();
  }

  // ═══════════ rede ═══════════
  function post(path, body) {
    return fetch(O.api + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "omit" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function typing(on) {
    var x = log().querySelector(".nva-typing");
    if (on && !x) { var d = document.createElement("div"); d.className = "nva-msg bot nva-typing"; d.innerHTML = '<div class="nva-b"><span class="nva-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="nva-sr">' + esc(tx("typing")) + "</span></div>"; log().insertBefore(d, root.querySelector(".nva-extra")); scroll(); }
    if (!on && x) x.remove();
  }
  // ajuda local (artigos do app) quando a IA não responde ou não há internet
  function localAnswer(text) {
    var hits = []; try { hits = (O.localSearch && O.localSearch(text)) || []; } catch (e) {}
    if (!hits.length) return null;
    return { role: "assistant", kind: "sys local", text: tx("localIntro") || "", local: hits.slice(0, 3), handoff: true, ts: Date.now() };
  }
  function localHtml(m) {
    return '<div class="nva-local">' + (m.local || []).map(function (h) {
      return '<div class="nva-art"><b>' + esc(h.q) + "</b><p>" + esc(h.a) + "</p>" + (h.view && O.channel === "app" ? '<a class="nva-act" href="/app/#show:' + esc(h.view) + '" data-nva-nav="show:' + esc(h.view) + '">' + esc(O.showLabel || tx("show") || "→") + "</a>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function send(text) {
    text = String(text || "").trim(); if (!text || busy) return;
    var ta = root.querySelector("textarea"); ta.value = ""; ta.style.height = "auto";
    st.form = null;
    st.msgs.push({ role: "user", text: text, ts: Date.now() }); save();
    var ch = log().querySelector(".nva-chips"); if (ch) ch.remove();
    var tmp = document.createElement("div"); tmp.innerHTML = bubble(st.msgs[st.msgs.length - 1]); log().insertBefore(tmp.firstChild, root.querySelector(".nva-extra")); extra("");
    busy = true; root.querySelector(".nva-send").disabled = true; typing(true);
    var hist = st.msgs.filter(function (m) { return !m.kind; }).slice(-12).map(function (m) { return { role: m.role, text: m.text }; });
    var offline = typeof navigator !== "undefined" && navigator.onLine === false;
    (offline ? Promise.reject(new Error("offline")) : post("", { channel: O.channel, sessionId: st.sid, lang: L(), messages: hist, context: ctx(), contact: st.contact || (contact().email ? contact() : undefined) })).then(function (r) {
      typing(false);
      if (r.sessionId) st.sid = r.sessionId;
      if (!r.reply) throw new Error("no reply");
      // IA fora do ar (sem chave, teto do dia, erro): no app, mostra também a ajuda local que combina com a pergunta
      if (!r.messageId && O.localSearch && (r.handoffReason === "unavailable" || r.handoffReason === "budget" || r._status >= 500)) { var la = localAnswer(text); if (la) { st.msgs.push(la); save(); reveal(la); return; } }
      var m = { role: "assistant", id: r.messageId || "", text: r.reply, actions: r.suggestedActions || [], handoff: !!r.handoff, ts: Date.now() };
      if (!r.messageId) m.kind = "sys";
      st.msgs.push(m); save(); reveal(m);
    }).catch(function () {
      typing(false);
      var la = localAnswer(text);
      if (la) { st.msgs.push(la); save(); reveal(la); return; } // sem internet / sem servidor: a pergunta fica, com os artigos da ajuda do app
      st.msgs.pop(); save();
      var d = document.createElement("div"); d.className = "nva-msg bot sys"; d.innerHTML = '<div class="nva-b"><p>' + esc(tx("net")) + '</p></div><div class="nva-acts"><button type="button" class="nva-act" data-nva="retry" data-text="' + esc(text) + '">' + esc(tx("retry")) + "</button></div>";
      log().insertBefore(d, root.querySelector(".nva-extra")); scroll();
      extra('<div class="nva-card"><div class="nva-row"><button type="button" class="nva-btn" data-nva="human">' + esc(tx("human")) + "</button></div></div>");
    }).then(function () { busy = false; var b = root.querySelector(".nva-send"); if (b) b.disabled = false; });
  }
  // mostra a resposta aos poucos (parece streaming); sem animação se a pessoa prefere menos movimento
  function reveal(m) {
    var tmp = document.createElement("div"); tmp.innerHTML = bubble(m); var el = tmp.firstChild;
    log().insertBefore(el, root.querySelector(".nva-extra"));
    var b = el.querySelector(".nva-b"), full = b.innerHTML;
    if (reduce || full.length > 4000) { extras(); scroll(); return; }
    var words = m.text.replace(/\n*—\s*Bisey Assist[^\n]*$/, "").split(/(\s+)/), i = 0, step = Math.max(2, Math.ceil(words.length / 28));
    el.classList.add("nva-streaming"); b.setAttribute("aria-hidden", "true");
    var sr = document.createElement("div"); sr.className = "nva-sr"; sr.innerHTML = full; el.appendChild(sr);
    (function tick() {
      i += step;
      if (i >= words.length) { b.innerHTML = full; b.removeAttribute("aria-hidden"); sr.remove(); el.classList.remove("nva-streaming"); extras(); scroll(); return; }
      b.innerHTML = md(words.slice(0, i).join("")); scroll(); setTimeout(tick, 28);
    })();
  }
  function submitHandoff(form, kind) {
    var g = function (id) { var x = form.querySelector(id); return x ? x.value.trim() : ""; };
    var email = g(kind === "lead" ? "#nva-le" : "#nva-he"), name = g(kind === "lead" ? "#nva-ln" : "#nva-hn"), err = form.querySelector(".nva-err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = tx("badEmail"); err.hidden = false; form.querySelector('input[type="email"]').focus(); return; }
    var btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = tx("sending");
    var body = { sessionId: st.sid, channel: O.channel, lang: L(), context: ctx(), kind: kind, contact: { email: email, name: name, website: (form.querySelector(".nva-hp") || {}).value || "" } };
    if (kind === "lead") body.lead = { name: name, company: g("#nva-lc"), trade: g("#nva-lt"), teamSize: g("#nva-ls") };
    else body.note = g("#nva-hx");
    post("/handoff", body).then(function (r) {
      if (!r.ok) { err.textContent = r.message || tx("net"); err.hidden = false; btn.disabled = false; btn.textContent = tx(kind === "lead" ? "lSend" : "hSend"); return; }
      st.contact = { email: email, name: name }; st.form = null;
      if (kind === "lead") st.lead = { at: Date.now() }; else st.ticket = { at: Date.now(), id: r.ticketId };
      st.msgs.push({ role: "assistant", kind: "sys ok", text: r.message || tx("sent"), ts: Date.now() }); save(); paint();
    }).catch(function () { err.textContent = tx("net"); err.hidden = false; btn.disabled = false; btn.textContent = tx(kind === "lead" ? "lSend" : "hSend"); });
  }
  function rate(id, value, btn) {
    var m = st.msgs.filter(function (x) { return x.id === id; })[0]; if (!m || m.rating === value) return;
    m.rating = value; save();
    var g = btn.parentNode; [].forEach.call(g.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-nva") === value)); });
    post("/feedback", { sessionId: st.sid, messageId: id, value: value }).catch(function () {});
    var note = document.createElement("p"); note.className = "nva-thanks"; note.setAttribute("role", "status"); note.textContent = value === "up" ? tx("thanks") : tx("downThanks");
    var old = g.parentNode.querySelector(".nva-thanks"); if (old) old.remove();
    g.parentNode.appendChild(note);
    if (value === "down") extras();
  }
  function onClick(e) {
    var nav = e.target.closest("[data-nva-nav]");
    if (nav) { var v = nav.getAttribute("data-nva-nav"); var done = false; try { done = O.onNavigate && O.onNavigate(v); } catch (x) {} if (done) { e.preventDefault(); if (window.matchMedia && matchMedia("(max-width: 600px)").matches) close(); } return; }
    var b = e.target.closest("[data-nva]"); if (!b) return;
    var a = b.getAttribute("data-nva");
    if (a === "close") return close();
    if (a === "reset") { st = { sid: "s" + Date.now().toString(36) + rid(), msgs: [], at: Date.now(), contact: st.contact }; save(); paint(); root.querySelector("textarea").focus(); return; }
    if (a === "human") { st.form = "human"; save(); humanForm(); return; }
    if (a === "lead") { st.form = "lead"; save(); leadForm(); return; }
    if (a === "leadNo") { st.leadNo = true; save(); extra(""); return; }
    if (a === "cancelForm") { st.form = null; save(); extras(); root.querySelector("textarea").focus(); return; }
    if (a === "ask") return send(b.textContent);
    if (a === "retry") { var t = b.getAttribute("data-text"); var row = b.closest(".nva-msg"); if (row) row.remove(); return send(t); }
    if (a === "up" || a === "down") { var row2 = b.closest(".nva-msg"); return rate(row2.getAttribute("data-id"), a, b); }
  }

  // ═══════════ abrir / fechar ═══════════
  function open(opts) {
    if (opts) Object.assign(O, opts);
    if (!st) load();
    build();
    lastFocus = document.activeElement;
    shell();
    root.hidden = false; root.classList.add("nva-open");
    document.documentElement.classList.add("nva-is-open");
    var lb = document.getElementById("nva-launch"); if (lb) lb.setAttribute("aria-expanded", "true");
    setTimeout(function () { var ta = root.querySelector("textarea"); if (ta) try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } scroll(); }, 30);
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true; root.classList.remove("nva-open");
    document.documentElement.classList.remove("nva-is-open");
    var lb = document.getElementById("nva-launch"); if (lb) lb.setAttribute("aria-expanded", "false");
    var f = lastFocus && document.contains(lastFocus) ? lastFocus : lb; if (f && f.focus) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  function init(opts) {
    Object.assign(O, opts || {});
    load();
    if (O.launcher) { if (document.body) launcher(); else document.addEventListener("DOMContentLoaded", launcher); }
  }

  window.BiseyAssist = { init: init, open: open, close: close, toggle: function (o) { root && !root.hidden ? close() : open(o); }, isOpen: function () { return !!(root && !root.hidden); }, _md: md, _safeUrl: safeUrl };

  // site: <script … data-channel="site"> inicia sozinho, sem atrasar a página
  if (SCRIPT && SCRIPT.getAttribute("data-channel")) {
    var cfg = { channel: SCRIPT.getAttribute("data-channel"), launcher: SCRIPT.getAttribute("data-launcher") !== "false" };
    if (SCRIPT.getAttribute("data-api")) cfg.api = SCRIPT.getAttribute("data-api");
    var go = function () { init(cfg); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 600);
  }
})();
