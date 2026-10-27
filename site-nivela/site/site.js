/* Nivela · site de vendas: idioma (EN padrão / PT), tema claro/escuro, menu do celular,
   preço mensal/anual e imagens do app conforme idioma + tema.
   O inglês fica no próprio HTML (bom para SEO e sem JS); aqui só o português. */
(function () {
  'use strict';
  var d = document.documentElement;

  var PT = {
    page_title: 'Nivela · App de gestão de obras para empreiteiros, em português e inglês',
    page_desc: 'Toda a sua obra em um app. A IA monta a proposta pela sua voz, lê a nota e lança na obra certa, e a equipe bate o ponto com selfie e GPS. Para elétrica, HVAC, plumbing, sprinkler, GC, drywall, pintura, piso, siding, telhado e fundação. 14 dias grátis.',
    skip: 'Pular para o conteúdo',
    nav_label: 'Principal', nav_features: 'Recursos', nav_pricing: 'Preços', nav_faq: 'Perguntas', nav_signin: 'Entrar',
    cta_trial: 'Teste grátis por 14 dias', cta_trial_short: 'Teste grátis', cta_trial_short2: 'Começar teste grátis',
    cta_demo: 'Ver a demonstração',
    lang_label: 'Idioma', theme_to_dark: 'Mudar para o modo escuro', theme_to_light: 'Mudar para o modo claro',
    menu_open: 'Abrir menu', menu_close: 'Fechar menu',
    eyebrow: 'Feito por empreiteiros, para empreiteiros',
    h1: 'Toda a sua obra em um app. <em>Em português ou inglês.</em>',
    lead: 'Fale o orçamento e a IA monta a proposta. Tire foto da nota e ela cai na obra certa. Sua equipe bate o ponto com selfie e GPS.',
    hero_fine: 'Sem cartão de crédito. Já vem com uma empresa de demonstração para você testar na hora.',
    stage_label: 'Nivela no notebook e no celular',
    trades_title: 'Feito para 11 ramos, da fundação ao telhado',
    trade_el: 'Elétrica', trade_pl: 'Plumbing', trade_gc: 'General contractor (GC)',
    trade_sp: 'Sprinkler', trade_dw: 'Drywall', trade_pa: 'Pintura', trade_fl: 'Piso', trade_si: 'Siding', trade_ro: 'Telhado', trade_fo: 'Fundação e escavação',
    feat_kicker: 'Tudo em um lugar só',
    feat_title: 'Proposta, custo, equipe e lucro. Enfim, no mesmo app.',
    feat_sub: 'Chega de pular entre planilha, grupo de WhatsApp e três aplicativos diferentes. O Nivela deixa cada obra no nível, do primeiro orçamento ao último invoice.',
    b1_t: 'Fale em vez de digitar',
    b1_p: 'Descreva o serviço em voz alta. O Nivela monta a proposta com a sua marca e os seus preços, e o cliente aceita online em minutos.',
    b2_t: 'Notas que se lançam sozinhas',
    b2_p: 'Tire foto de qualquer nota. A IA lê, descobre a obra e a categoria e atualiza seus custos.',
    b3_t: 'Saiba o lucro de cada obra',
    b3_p: 'Mão de obra, material, permit e equipamento contra a receita, ao vivo. O alerta chega antes de estourar o orçamento, não depois.',
    b4_t: 'Ponto que a equipe respeita',
    b4_p: 'Selfie + GPS que reconhece a obra sozinho. A folha semanal chega no seu e-mail todo sábado.',
    b5_t: 'Compre material mais barato',
    b5_p: 'Promoções das lojas e a sua lista de preços lado a lado, o mais barato em verde. Depois do aceite, você recebe a lista de material mais barata.',
    b6_t: 'Bilíngue de verdade',
    b6_p: 'A equipe trabalha em português e o cliente lê em inglês. Cada tela, proposta e relatório, nos dois idiomas.',
    founder_t: 'Feito por quem toca obra, não por empresa de software',
    founder_p: 'O Nivela começou como o app que um eletricista licenciado em Massachusetts criou para tocar a própria equipe e as próprias obras. Cada função resolveu um problema real, numa obra real, antes de virar produto.',
    diff_kicker: 'O que o Nivela tem de diferente',
    diff_title: 'Menos digitação. Mais obra.',
    d1_tag: 'Proposta por voz com IA',
    d1_t: 'Fale o serviço. Receba a proposta.',
    d1_p: 'Ande pela obra, toque no microfone e explique o serviço do jeito que você explicaria para o seu encarregado. A IA do Nivela transforma isso numa proposta com o seu logo, os seus preços e os seus termos.',
    d1_l1: 'Segue o escopo padrão e a lista de preços da sua empresa',
    d1_l2: 'O cliente abre um link e aceita online',
    d1_l3: 'Proposta aceita vira invoice com um toque',
    art1_quote: '“Trocar o painel de 100 amp por 200, colocar seis luzes embutidas na cozinha e um circuito dedicado para o fogão.”',
    art1_prop: 'Proposta · 14 Elm St', art1_acc: 'Aceita online',
    art1_l1: 'Upgrade de serviço para 200A', art1_l2: '6 luzes embutidas LED, cozinha', art1_l3: 'Circuito do fogão, 50A',
    art_note: 'Exemplo',
    d2_tag: 'A IA lê suas notas',
    d2_t: 'Fotografe a nota. Ela acha a obra.',
    d2_p: 'Tire foto de qualquer nota da loja de material. A IA lê os itens e o total, descobre a obra e a categoria e atualiza o custo daquela obra. A equipe faz isso de dentro da caminhonete.',
    d2_l1: 'Material, permit, equipamento ou outros, separado para você',
    d2_l2: 'Nota sem obra clara fica esperando a sua revisão',
    d2_l3: 'Custos da obra e alertas de orçamento se atualizam sozinhos',
    art2_store: 'LOJA DE MATERIAL', art2_read: 'Lido pela IA', art2_job: 'Obra', art2_jobv: 'EXEMPLO · 14 Elm St',
    art2_cat: 'Categoria', art2_catv: 'Material', art2_amt: 'Lançado nos custos', art2_lim: '46% do limite de material',
    d3_tag: 'Ponto com selfie + GPS',
    d3_t: 'Ponto com selfie. O GPS sabe a obra.',
    d3_p: 'A equipe toca num botão grande. O Nivela tira a selfie, confere a localização e escolhe a obra sozinho. Sem código de obra errado, sem dúvida de quem estava onde.',
    d3_l1: 'Selfie e localização salvas em cada batida',
    d3_l2: 'Folha semanal por e-mail todo sábado',
    d3_l3: 'A equipe vê a obra, nunca os seus preços ou o seu lucro',
    art3_in: 'Entrada · 7:10', art3_where: 'EXEMPLO · 14 Elm St, achada pelo GPS', art3_btn: 'Bater saída',
    bi_kicker: 'Bilíngue para toda a equipe',
    bi_title: 'A equipe lê em português. O cliente lê em inglês. Mesma obra.',
    bi_p: 'Cada pessoa escolhe o próprio idioma. Propostas e relatórios saem no idioma do cliente, mesmo que você tenha escrito em português. Chega de traduzir no WhatsApp às dez da noite.',
    bi_l1: 'Todas as telas em português e inglês',
    bi_l2: 'Idioma por pessoa, não por empresa',
    bi_l3: 'Suporte em português e inglês nos planos Pro e Business',
    bi_crew: 'Celular da equipe', bi_client: 'E-mail do cliente',
    price_kicker: 'Preço simples',
    price_title: 'Um preço para a empresa. A equipe já está incluída.',
    price_sub: 'Todo plano já inclui usuários de escritório e de campo. Teste qualquer plano por 14 dias grátis, sem cartão.',
    bill_label: 'Forma de cobrança', bill_m: 'Mensal', bill_y: 'Anual', bill_save: '2 meses grátis',
    per_mo: '/mês', billed_m: 'Cobrança mensal',
    billed_y1: '$490 cobrados por ano', billed_y2: '$990 cobrados por ano', billed_y3: '$1,990 cobrados por ano',
    p1_for: 'Para equipe pequena que quer se organizar.',
    p1_f1: '<b>2 de escritório + 5 de campo</b>',
    p1_f2: '1 empresa · até 10 obras ativas',
    pa_prop: 'Propostas, PDF, aceite online e invoices',
    p1_f3: 'IA: <b>20</b> propostas por voz + <b>50</b> notas por mês',
    pa_clock: 'Ponto com selfie + GPS e folha semanal',
    pa_tasks: 'Tarefas, plantas, avisos e agenda',
    p1_f4: 'Financeiro da obra básico',
    p1_f5: 'Sua própria lista de preços',
    p1_f6: 'Suporte por e-mail',
    p2_badge: 'Recomendado',
    p2_for: 'Para empresa em crescimento, com várias obras ao mesmo tempo.',
    p2_all: 'Tudo do Starter, mais:',
    p2_f1: '<b>3 de escritório + 15 de campo</b>',
    p2_f2: 'Obras ativas ilimitadas',
    p2_f3: 'IA: <b>100</b> propostas por voz + <b>300</b> notas por mês',
    p2_f4: 'Escala da equipe',
    p2_f5: 'Financeiro completo, limites de gasto e alertas',
    p2_f6: 'Promoções das lojas e lista de material mais barata',
    p2_f7: 'Relatório diário automático e portal do cliente',
    p2_f8: '1 gerente',
    p2_f9: 'Suporte por e-mail + WhatsApp em português e inglês',
    p3_for: 'Para o dono que toca mais de uma empresa.',
    p3_all: 'Tudo do Pro, mais:',
    p3_f1: '<b>6 de escritório + 40 de campo</b>',
    p3_f2: '<b>Até 3 empresas</b> na mesma conta',
    p3_f3: 'IA: ilimitada (uso justo)',
    p3_f4: 'Páginas do cliente só com a sua marca, sem “Enviado com Nivela”',
    p3_f5: 'Relatórios para exportar',
    p3_f6: 'Gerentes ilimitados',
    p3_f7: 'Suporte prioritário e implantação guiada',
    plans_note: 'Precisa de mais gente? Usuário extra de campo custa $5/mês e de escritório $19/mês ($4 e $15 no Business). Usuário de campo bate ponto, vê tarefas e recebe avisos. Usuário de escritório cuida de propostas, custos e relatórios.',
    faq_kicker: 'Perguntas', faq_title: 'Resposta direta',
    faq_sub: 'Ainda com dúvida? Abra a demonstração e mexa à vontade. É o jeito mais rápido de ver se o Nivela serve para a sua empresa.',
    q1: 'Pago por usuário?',
    a1: 'Não. Todo plano já inclui usuários de escritório e de campo. Você só paga um valor pequeno por usuário que passar do limite do plano.',
    q2: 'Funciona no meu celular?',
    a2: 'Sim. Instala no iPhone, Android, tablet ou computador em segundos, direto do navegador. Não precisa de loja de apps.',
    q3: 'Posso testar antes?',
    a3: 'Sim. São 14 dias grátis, sem cartão, com uma empresa de demonstração pronta para você testar propostas, custos e o ponto na hora.',
    q4: 'Minha equipe fala português e meus clientes falam inglês. Funciona?',
    a4: 'O Nivela foi feito exatamente para isso. Cada pessoa escolhe o próprio idioma, e propostas e relatórios saem no idioma do cliente que vai receber.',
    q5: 'Meus funcionários vão ver preços e lucro?',
    a5: 'Não. O usuário de campo vê a obra, as tarefas, as plantas, os avisos e o ponto. Valores em dinheiro, custos e lucro ficam só com o dono e com quem você liberar.',
    q6: 'Tenho duas empresas. Preciso de duas contas?',
    a6: 'Não. O plano Business guarda até 3 empresas na mesma conta, cada uma com seu logo, suas cores e suas propostas. Você troca de uma para outra com um toque.',
    q7: 'O que conta no limite de IA?',
    a7: 'Cada proposta criada por voz e cada nota lida pela IA contam uma vez. Se chegar ao limite do plano, você ainda pode lançar à mão ou subir de plano.',
    q8: 'O que acontece quando o teste acaba?',
    a8: 'Você escolhe um plano para continuar. Como nunca pedimos cartão, nada é cobrado automaticamente.',
    final_t: 'Deixe cada obra no nível.',
    final_p: 'Comece hoje o teste grátis de 14 dias. Sem cartão, e com uma empresa de demonstração pronta.',
    foot_tag: 'Feito por empreiteiros, para empreiteiros.',
    doc_back: '← Voltar ao início',
    foot_label: 'Rodapé', foot_terms: 'Termos', foot_privacy: 'Privacidade', foot_contact: 'Contato'
  };

  // ── guarda o inglês que já está no HTML ──
  var EN = {};
  var nodes = document.querySelectorAll('[data-i18n]');
  nodes.forEach(function (el) { var k = el.getAttribute('data-i18n'); if (!(k in EN)) EN[k] = el.innerHTML; });
  var attrNodes = document.querySelectorAll('[data-i18n-attr]');
  attrNodes.forEach(function (el) {
    el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
      var p = pair.split(':'); if (!(p[1] in EN)) EN[p[1]] = el.getAttribute(p[0]);
    });
  });
  EN.page_title = document.title;
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) EN.page_desc = metaDesc.getAttribute('content');
  EN.theme_to_light = 'Switch to light mode';
  EN.menu_close = 'Close menu';

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var lang = d.getAttribute('data-lang-init') === 'pt' ? 'pt' : 'en';
  function t(k) { var dict = lang === 'pt' ? PT : EN; return dict[k] != null ? dict[k] : EN[k]; }

  function applyLang() {
    d.lang = lang === 'pt' ? 'pt-BR' : 'en';
    nodes.forEach(function (el) { var v = t(el.getAttribute('data-i18n')); if (v != null) el.innerHTML = v; });
    attrNodes.forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); var v = t(p[1]); if (v != null) el.setAttribute(p[0], v);
      });
    });
    var isDoc = document.body.hasAttribute('data-doc');
    document.title = isDoc ? (document.body.getAttribute('data-title-' + lang) || EN.page_title) : t('page_title');
    if (metaDesc && !isDoc) metaDesc.setAttribute('content', t('page_desc'));
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    updateThemeLabel(); updateMenuLabel(); updateShots();
  }

  // ── tema ──
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function resolvedTheme() {
    var a = d.getAttribute('data-theme');
    if (a === 'light' || a === 'dark') return a;
    return mq && mq.matches ? 'dark' : 'light';
  }
  var themeBtn = document.getElementById('theme-btn');
  function updateThemeLabel() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-label', t(resolvedTheme() === 'dark' ? 'theme_to_light' : 'theme_to_dark'));
  }
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = resolvedTheme() === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-theme', next); store('nivela-site-theme', next);
    updateThemeLabel(); updateShots();
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { updateThemeLabel(); updateShots(); });

  // ── imagens do app (idioma + tema) ──
  function updateShots() {
    var th = resolvedTheme();
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var src = 'img/' + img.getAttribute('data-shot') + '-' + lang + '-' + th + '.jpg';
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
  }

  // ── idioma ──
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-lang'); store('nivela-site-lang', lang); applyLang();
    });
  });

  // ── menu do celular ──
  var menu = document.getElementById('menu'), menuBtn = document.getElementById('menu-btn');
  function updateMenuLabel() {
    if (menuBtn) menuBtn.setAttribute('aria-label', t(menuBtn.getAttribute('aria-expanded') === 'true' ? 'menu_close' : 'menu_open'));
  }
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); updateMenuLabel();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 900) setMenu(false); });
  }

  // ── mensal / anual ──
  document.querySelectorAll('[data-bill]').forEach(function (b) {
    b.addEventListener('click', function () {
      var mode = b.getAttribute('data-bill');
      d.setAttribute('data-billing', mode);
      document.querySelectorAll('[data-bill]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      document.querySelectorAll('.amt[data-m]').forEach(function (a) { a.textContent = '$' + a.getAttribute('data-' + mode); });
    });
  });

  // ── borda do topo ao rolar ──
  var top = document.querySelector('.top');
  if (top) {
    var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  applyLang();
})();
