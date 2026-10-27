/* Bisey · site de vendas: idioma (EN padrão / PT / ES), tema claro/escuro, menu do celular,
   preço mensal/anual e imagens do app conforme idioma + tema.
   O inglês fica no próprio HTML (bom para SEO e sem JS); aqui o português e o espanhol (es-US, por “tú”).
   Imagens do app: há versões EN e PT; em espanhol usa as EN (o app de verdade, no espanhol, está na demonstração). */
(function () {
  'use strict';
  var d = document.documentElement;

  var PT = {
    page_title: 'Bisey · App de gestão de obras para empreiteiros, em português, inglês e espanhol',
    page_desc: 'Toda a sua obra em um app. A IA monta a proposta pela sua voz, lê a nota e lança na obra certa, e a equipe bate o ponto com selfie e GPS. Para elétrica, HVAC, plumbing, sprinkler, GC, drywall, pintura, piso, siding, telhado e fundação. 14 dias grátis.',
    skip: 'Pular para o conteúdo',
    nav_label: 'Principal', nav_features: 'Recursos', nav_pricing: 'Preços', nav_faq: 'Perguntas', nav_signin: 'Entrar',
    cta_trial: 'Teste grátis por 14 dias', cta_trial_short: 'Teste grátis', cta_trial_short2: 'Começar teste grátis',
    cta_demo: 'Ver a demonstração',
    lang_label: 'Idioma', theme_to_dark: 'Mudar para o modo escuro', theme_to_light: 'Mudar para o modo claro',
    menu_open: 'Abrir menu', menu_close: 'Fechar menu',
    eyebrow: 'Feito por empreiteiros, para empreiteiros',
    h1: 'Toda a sua obra em um app. <em>Em português, inglês ou espanhol.</em>',
    lead: 'Fale o orçamento e a IA monta a proposta. Tire foto da nota e ela cai na obra certa. Sua equipe bate o ponto com selfie e GPS.',
    hero_fine: 'Sem cartão de crédito. Já vem com uma empresa de demonstração para você testar na hora.',
    stage_label: 'Bisey no notebook e no celular',
    trades_title: 'Feito para 11 ramos, da fundação ao telhado',
    trade_el: 'Elétrica', trade_pl: 'Plumbing', trade_gc: 'General contractor (GC)',
    trade_sp: 'Sprinkler', trade_dw: 'Drywall', trade_pa: 'Pintura', trade_fl: 'Piso', trade_si: 'Siding', trade_ro: 'Telhado', trade_fo: 'Fundação e escavação',
    feat_kicker: 'Tudo em um lugar só',
    feat_title: 'Proposta, custo, equipe e lucro. Enfim, no mesmo app.',
    feat_sub: 'Chega de pular entre planilha, grupo de WhatsApp e três aplicativos diferentes. O Bisey deixa cada obra em dia, do primeiro orçamento ao último invoice.',
    b1_t: 'Fale em vez de digitar',
    b1_p: 'Descreva o serviço em voz alta. O Bisey monta a proposta com a sua marca e os seus preços, e o cliente aceita online em minutos.',
    b2_t: 'Notas que se lançam sozinhas',
    b2_p: 'Tire foto de qualquer nota. A IA lê, descobre a obra e a categoria e atualiza seus custos.',
    b3_t: 'Saiba o lucro de cada obra',
    b3_p: 'Mão de obra, material, permit e equipamento contra a receita, ao vivo. O alerta chega antes de estourar o orçamento, não depois.',
    b4_t: 'Ponto que a equipe respeita',
    b4_p: 'Selfie + GPS que reconhece a obra sozinho. A folha semanal chega no seu e-mail todo sábado.',
    b5_t: 'Compre material mais barato',
    b5_p: 'Promoções das lojas e a sua lista de preços lado a lado, o mais barato em verde. Depois do aceite, você recebe a lista de material mais barata.',
    b6_t: 'Três idiomas de verdade',
    b6_p: 'A equipe trabalha em português ou espanhol e o cliente lê em inglês. Todas as telas em português, inglês e espanhol; propostas e relatórios no idioma do cliente.',
    founder_t: 'Feito por quem toca obra, não por empresa de software',
    founder_p: 'O Bisey começou como o app que um eletricista licenciado em Massachusetts criou para tocar a própria equipe e as próprias obras. Cada função resolveu um problema real, numa obra real, antes de virar produto.',
    diff_kicker: 'O que o Bisey tem de diferente',
    diff_title: 'Menos digitação. Mais obra.',
    d1_tag: 'Proposta por voz com IA',
    d1_t: 'Fale o serviço. Receba a proposta.',
    d1_p: 'Ande pela obra, toque no microfone e explique o serviço do jeito que você explicaria para o seu encarregado. A IA do Bisey transforma isso numa proposta com o seu logo, os seus preços e os seus termos.',
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
    d3_p: 'A equipe toca num botão grande. O Bisey tira a selfie, confere a localização e escolhe a obra sozinho. Sem código de obra errado, sem dúvida de quem estava onde.',
    d3_l1: 'Selfie e localização salvas em cada batida',
    d3_l2: 'Folha semanal por e-mail todo sábado',
    d3_l3: 'A equipe vê a obra, nunca os seus preços ou o seu lucro',
    art3_in: 'Entrada · 7:10', art3_where: 'EXEMPLO · 14 Elm St, achada pelo GPS', art3_btn: 'Bater saída',
    bi_kicker: 'No idioma de cada pessoa da equipe',
    bi_title: 'A equipe lê em português. O cliente lê em inglês. Mesma obra.',
    bi_p: 'Cada pessoa escolhe o próprio idioma. Propostas e relatórios saem no idioma do cliente, mesmo que você tenha escrito em português. Chega de traduzir no WhatsApp às dez da noite.',
    bi_l1: 'Todas as telas em português, inglês e espanhol',
    bi_l2: 'Idioma por pessoa, não por empresa',
    bi_l3: 'Suporte em português, inglês e espanhol nos planos Pro e Business',
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
    p2_f9: 'Suporte por e-mail + WhatsApp em português, inglês e espanhol',
    p3_for: 'Para o dono que toca mais de uma empresa.',
    p3_all: 'Tudo do Pro, mais:',
    p3_f1: '<b>6 de escritório + 40 de campo</b>',
    p3_f2: '<b>Até 3 empresas</b> na mesma conta',
    p3_f3: 'IA: ilimitada (uso justo)',
    p3_f4: 'Páginas do cliente só com a sua marca, sem “Enviado com Bisey”',
    p3_f5: 'Relatórios para exportar',
    p3_f6: 'Gerentes ilimitados',
    p3_f7: 'Suporte prioritário e implantação guiada',
    plans_note: 'Precisa de mais gente? Usuário extra de campo custa $5/mês e de escritório $19/mês ($4 e $15 no Business). Usuário de campo bate ponto, vê tarefas e recebe avisos. Usuário de escritório cuida de propostas, custos e relatórios.',
    faq_kicker: 'Perguntas', faq_title: 'Resposta direta',
    faq_sub: 'Ainda com dúvida? Abra a demonstração e mexa à vontade. É o jeito mais rápido de ver se o Bisey serve para a sua empresa.',
    q1: 'Pago por usuário?',
    a1: 'Não. Todo plano já inclui usuários de escritório e de campo. Você só paga um valor pequeno por usuário que passar do limite do plano.',
    q2: 'Funciona no meu celular?',
    a2: 'Sim. Instala no iPhone, Android, tablet ou computador em segundos, direto do navegador. Não precisa de loja de apps.',
    q3: 'Posso testar antes?',
    a3: 'Sim. São 14 dias grátis, sem cartão, com uma empresa de demonstração pronta para você testar propostas, custos e o ponto na hora.',
    q4: 'Minha equipe fala português e meus clientes falam inglês. Funciona?',
    a4: 'O Bisey foi feito exatamente para isso. Cada pessoa escolhe o próprio idioma, e propostas e relatórios saem no idioma do cliente que vai receber.',
    q5: 'Meus funcionários vão ver preços e lucro?',
    a5: 'Não. O usuário de campo vê a obra, as tarefas, as plantas, os avisos e o ponto. Valores em dinheiro, custos e lucro ficam só com o dono e com quem você liberar.',
    q6: 'Tenho duas empresas. Preciso de duas contas?',
    a6: 'Não. O plano Business guarda até 3 empresas na mesma conta, cada uma com seu logo, suas cores e suas propostas. Você troca de uma para outra com um toque.',
    q7: 'O que conta no limite de IA?',
    a7: 'Cada proposta criada por voz e cada nota lida pela IA contam uma vez. Se chegar ao limite do plano, você ainda pode lançar à mão ou subir de plano.',
    q9: 'Vocês têm programa de indicação?',
    a9: 'Sim. O cliente compartilha um link pessoal: o empreiteiro novo ganha o 1º mês pago grátis, e quem indicou ganha 1 mês grátis depois desse 1º pagamento (mais 1 mês de bônus a cada 3 indicações pagas, até 12 meses por ano). Crédito não vira dinheiro.',
    ref_banner: 'Um empreiteiro indicou você: o seu 1º mês pago é grátis.',
    ref_kicker: 'Indique e ganhe', ref_title: 'Dê um mês, ganhe um mês.',
    ref_sub: 'Já é cliente? Compartilhe o seu link em <b>Conta → Indique e ganhe</b>. O 1º mês pago do seu amigo é grátis, e você ganha 1 mês grátis para cada empreiteiro que virar cliente.',
    ref_s1t: 'Mande o seu link', ref_s1: 'WhatsApp, SMS ou e-mail, direto do app.',
    ref_s2t: 'Ele testa grátis', ref_s2: '14 dias sem cartão, e o 1º mês pago dele sai de graça.',
    ref_s3t: 'Você ganha 1 mês', ref_s3: 'Depois do 1º pagamento dele. A cada 3 indicações pagas, mais 1 mês de bônus.',
    ref_terms: 'Regras do programa',
    q8: 'O que acontece quando o teste acaba?',
    a8: 'Você escolhe um plano para continuar. Como nunca pedimos cartão, nada é cobrado automaticamente.',
    final_t: 'Cada obra, da proposta ao pagamento.',
    final_p: 'Comece hoje o teste grátis de 14 dias. Sem cartão, e com uma empresa de demonstração pronta.',
    foot_tag: 'Feito por empreiteiros, para empreiteiros.',
    doc_back: '← Voltar ao início',
    foot_label: 'Rodapé', foot_terms: 'Termos', foot_privacy: 'Privacidade', foot_contact: 'Contato'
  };

  var ES = {
    page_title: 'Bisey · App de gestión de obras para contratistas, en español, inglés y portugués',
    page_desc: 'Toda tu obra en una app. La IA arma el estimado con tu voz, lee el recibo y lo registra en la obra correcta, y la cuadrilla marca entrada con selfie y GPS. Para electricidad, HVAC, plomería, rociadores, GC, drywall, pintura, pisos, siding, techos y cimientos. 14 días gratis.',
    skip: 'Saltar al contenido',
    nav_label: 'Principal', nav_features: 'Funciones', nav_pricing: 'Precios', nav_faq: 'Preguntas', nav_signin: 'Entrar',
    cta_trial: 'Prueba gratis por 14 días', cta_trial_short: 'Prueba gratis', cta_trial_short2: 'Empezar la prueba gratis',
    cta_demo: 'Ver la demostración',
    lang_label: 'Idioma', theme_to_dark: 'Cambiar al modo oscuro', theme_to_light: 'Cambiar al modo claro',
    menu_open: 'Abrir menú', menu_close: 'Cerrar menú',
    eyebrow: 'Hecho por contratistas, para contratistas',
    h1: 'Toda tu obra en una app. <em>En español, inglés o portugués.</em>',
    lead: 'Di el estimado en voz alta y la IA arma la propuesta. Tómale foto al recibo y va a la obra correcta. Tu cuadrilla marca entrada con selfie y GPS.',
    hero_fine: 'Sin tarjeta de crédito. Ya viene con una empresa de demostración para que pruebes al momento.',
    stage_label: 'Bisey en la laptop y en el celular',
    trades_title: 'Hecho para 11 rubros, de los cimientos al techo',
    trade_el: 'Electricidad', trade_pl: 'Plomería', trade_gc: 'General contractor (GC)',
    trade_sp: 'Rociadores contra incendios', trade_dw: 'Drywall', trade_pa: 'Pintura', trade_fl: 'Pisos', trade_si: 'Siding', trade_ro: 'Techos', trade_fo: 'Cimientos y excavación',
    feat_kicker: 'Todo en un solo lugar',
    feat_title: 'Estimados, costos, cuadrilla y ganancia. Por fin, en la misma app.',
    feat_sub: 'Se acabó saltar entre la hoja de cálculo, el grupo de WhatsApp y tres apps distintas. Bisey mantiene cada obra al día, del primer estimado a la última factura.',
    b1_t: 'Habla en vez de escribir',
    b1_p: 'Describe el trabajo en voz alta. Bisey arma el estimado con tu marca y tus precios, y el cliente lo acepta en línea en minutos.',
    b2_t: 'Recibos que se registran solos',
    b2_p: 'Tómale foto a cualquier recibo. La IA lo lee, descubre la obra y la categoría y actualiza tus costos.',
    b3_t: 'Conoce la ganancia de cada obra',
    b3_p: 'Mano de obra, material, permisos y equipo contra los ingresos, en vivo. La alerta llega antes de pasarte del presupuesto, no después.',
    b4_t: 'Un reloj que la cuadrilla respeta',
    b4_p: 'Selfie + GPS que reconoce la obra solo. La hoja de horas semanal llega a tu e-mail cada sábado.',
    b5_t: 'Compra material más barato',
    b5_p: 'Las ofertas de las tiendas y tu lista de precios lado a lado, el más barato en verde. Cuando el cliente acepta, recibes la lista de material más barata.',
    b6_t: 'Tres idiomas de verdad',
    b6_p: 'La cuadrilla trabaja en español y el cliente lee en inglés. Cada pantalla en español, inglés o portugués; los estimados y reportes salen en inglés para el cliente.',
    founder_t: 'Hecho por quien maneja obras, no por una empresa de software',
    founder_p: 'Bisey empezó como la app que un electricista con licencia en Massachusetts creó para manejar su propia cuadrilla y sus propias obras. Cada función resolvió un problema real, en una obra real, antes de volverse producto.',
    diff_kicker: 'Lo que Bisey tiene de diferente',
    diff_title: 'Menos escribir. Más obra.',
    d1_tag: 'Estimado por voz con IA',
    d1_t: 'Di el trabajo. Recibe el estimado.',
    d1_p: 'Camina por la obra, toca el micrófono y explica el trabajo como se lo explicarías a tu encargado. La IA de Bisey lo convierte en un estimado con tu logo, tus precios y tus condiciones.',
    d1_l1: 'Sigue el alcance estándar y la lista de precios de tu empresa',
    d1_l2: 'El cliente abre un enlace y acepta en línea',
    d1_l3: 'El estimado aceptado se convierte en factura con un toque',
    art1_quote: '“Cambiar el panel de 100 amp por uno de 200, poner seis luces empotradas en la cocina y un circuito dedicado para la estufa.”',
    art1_prop: 'Estimado · 14 Elm St', art1_acc: 'Aceptado en línea',
    art1_l1: 'Upgrade del servicio a 200A', art1_l2: '6 luces LED empotradas, cocina', art1_l3: 'Circuito de la estufa, 50A',
    art_note: 'Ejemplo',
    d2_tag: 'La IA lee tus recibos',
    d2_t: 'Tómale foto al recibo. Él encuentra la obra.',
    d2_p: 'Tómale foto a cualquier recibo de la tienda de material. La IA lee los artículos y el total, descubre la obra y la categoría y actualiza el costo de esa obra. La cuadrilla lo hace desde la camioneta.',
    d2_l1: 'Material, permisos, equipo u otros, separados para ti',
    d2_l2: 'El recibo sin obra clara espera tu revisión',
    d2_l3: 'Los costos de la obra y las alertas de presupuesto se actualizan solos',
    art2_store: 'TIENDA DE MATERIAL', art2_read: 'Leído por la IA', art2_job: 'Obra', art2_jobv: 'EJEMPLO · 14 Elm St',
    art2_cat: 'Categoría', art2_catv: 'Material', art2_amt: 'Registrado en los costos', art2_lim: '46% del límite de material',
    d3_tag: 'Reloj con selfie + GPS',
    d3_t: 'Marcación con selfie. El GPS sabe la obra.',
    d3_p: 'La cuadrilla toca un botón grande. Bisey toma la selfie, revisa la ubicación y elige la obra solo. Sin códigos de obra equivocados, sin dudas de quién estaba dónde.',
    d3_l1: 'Selfie y ubicación guardadas en cada marcación',
    d3_l2: 'Hoja de horas semanal por e-mail cada sábado',
    d3_l3: 'La cuadrilla ve la obra, nunca tus precios ni tu ganancia',
    art3_in: 'Entrada · 7:10', art3_where: 'EJEMPLO · 14 Elm St, encontrada por GPS', art3_btn: 'Marcar salida',
    bi_kicker: 'En el idioma de cada persona',
    bi_title: 'La cuadrilla lee en español. El cliente lee en inglés. La misma obra.',
    bi_p: 'Cada persona elige su idioma. Los estimados y reportes salen en el idioma del cliente, aunque los hayas escrito en español. Se acabó traducir por WhatsApp a las diez de la noche.',
    bi_l1: 'Todas las pantallas en español, inglés y portugués',
    bi_l2: 'Idioma por persona, no por empresa',
    bi_l3: 'Soporte en español, inglés y portugués en los planes Pro y Business',
    bi_crew: 'Celular de la cuadrilla', bi_client: 'E-mail del cliente',
    price_kicker: 'Precio simple',
    price_title: 'Un precio para la empresa. La cuadrilla ya está incluida.',
    price_sub: 'Todos los planes incluyen usuarios de oficina y de campo. Prueba cualquier plan gratis por 14 días, sin tarjeta.',
    bill_label: 'Forma de cobro', bill_m: 'Mensual', bill_y: 'Anual', bill_save: '2 meses gratis',
    per_mo: '/mes', billed_m: 'Cobro mensual',
    billed_y1: '$490 cobrados al año', billed_y2: '$990 cobrados al año', billed_y3: '$1,990 cobrados al año',
    p1_for: 'Para una cuadrilla pequeña que quiere organizarse.',
    p1_f1: '<b>2 de oficina + 5 de campo</b>',
    p1_f2: '1 empresa · hasta 10 obras activas',
    pa_prop: 'Estimados, PDF, aceptación en línea y facturas',
    p1_f3: 'IA: <b>20</b> estimados por voz + <b>50</b> recibos al mes',
    pa_clock: 'Reloj con selfie + GPS y hoja de horas semanal',
    pa_tasks: 'Tareas, planos, avisos y agenda',
    p1_f4: 'Finanzas básicas de la obra',
    p1_f5: 'Tu propia lista de precios',
    p1_f6: 'Soporte por e-mail',
    p2_badge: 'Recomendado',
    p2_for: 'Para una empresa que crece, con varias obras al mismo tiempo.',
    p2_all: 'Todo lo de Starter, más:',
    p2_f1: '<b>3 de oficina + 15 de campo</b>',
    p2_f2: 'Obras activas ilimitadas',
    p2_f3: 'IA: <b>100</b> estimados por voz + <b>300</b> recibos al mes',
    p2_f4: 'Horario de la cuadrilla',
    p2_f5: 'Finanzas completas, límites de gastos y alertas',
    p2_f6: 'Ofertas de las tiendas y lista de material más barata',
    p2_f7: 'Reporte diario automático y portal del cliente',
    p2_f8: '1 gerente',
    p2_f9: 'Soporte por e-mail + WhatsApp en español, inglés y portugués',
    p3_for: 'Para el dueño que maneja más de una empresa.',
    p3_all: 'Todo lo de Pro, más:',
    p3_f1: '<b>6 de oficina + 40 de campo</b>',
    p3_f2: '<b>Hasta 3 empresas</b> en la misma cuenta',
    p3_f3: 'IA: ilimitada (uso justo)',
    p3_f4: 'Páginas del cliente solo con tu marca, sin “Enviado con Bisey”',
    p3_f5: 'Reportes para exportar',
    p3_f6: 'Gerentes ilimitados',
    p3_f7: 'Soporte prioritario y puesta en marcha guiada',
    plans_note: '¿Necesitas más gente? Un usuario extra de campo cuesta $5/mes y uno de oficina $19/mes ($4 y $15 en Business). El usuario de campo marca entrada, ve tareas y recibe avisos. El usuario de oficina maneja estimados, costos y reportes.',
    faq_kicker: 'Preguntas', faq_title: 'Respuestas directas',
    faq_sub: '¿Todavía con dudas? Abre la demostración y úsala como quieras. Es la forma más rápida de ver si Bisey le sirve a tu empresa.',
    q1: '¿Pago por usuario?',
    a1: 'No. Todos los planes ya incluyen usuarios de oficina y de campo. Solo pagas un monto pequeño por cada usuario que pase del límite del plan.',
    q2: '¿Funciona en mi celular?',
    a2: 'Sí. Se instala en iPhone, Android, tablet o computadora en segundos, directo desde el navegador. No necesitas tienda de apps.',
    q3: '¿Puedo probarla antes?',
    a3: 'Sí. Son 14 días gratis, sin tarjeta, con una empresa de demostración lista para que pruebes estimados, costos y el reloj al momento.',
    q4: 'Mi cuadrilla habla español y mis clientes hablan inglés. ¿Funciona?',
    a4: 'Bisey se hizo exactamente para eso. Cada persona elige su idioma, y los estimados y reportes salen en el idioma del cliente que los recibe.',
    q5: '¿Mis empleados van a ver precios y ganancias?',
    a5: 'No. El usuario de campo ve la obra, las tareas, los planos, los avisos y el reloj. Los montos en dinero, los costos y la ganancia se quedan con el dueño y con quien tú autorices.',
    q6: 'Tengo dos empresas. ¿Necesito dos cuentas?',
    a6: 'No. El plan Business guarda hasta 3 empresas en la misma cuenta, cada una con su logo, sus colores y sus estimados. Cambias de una a otra con un toque.',
    q7: '¿Qué cuenta en el límite de IA?',
    a7: 'Cada estimado creado por voz y cada recibo leído por la IA cuentan una vez. Si llegas al límite del plan, todavía puedes registrar a mano o subir de plan.',
    q9: '¿Tienen programa de recomendaciones?',
    a9: 'Sí. El cliente comparte un enlace personal: el contratista nuevo recibe gratis su primer mes pagado, y quien lo recomendó gana 1 mes gratis después de ese primer pago (más 1 mes de bono por cada 3 recomendaciones pagadas, hasta 12 meses al año). El crédito no se cambia por dinero.',
    ref_banner: 'Un contratista te recomendó: tu primer mes pagado es gratis.',
    ref_kicker: 'Recomienda y gana', ref_title: 'Regala un mes, gana un mes.',
    ref_sub: '¿Ya eres cliente? Comparte tu enlace en <b>Cuenta → Recomienda y gana</b>. El primer mes pagado de tu amigo es gratis, y tú ganas 1 mes gratis por cada contratista que se haga cliente.',
    ref_s1t: 'Manda tu enlace', ref_s1: 'WhatsApp, mensaje de texto o e-mail, directo desde la app.',
    ref_s2t: 'Él prueba gratis', ref_s2: '14 días sin tarjeta, y su primer mes pagado sale gratis.',
    ref_s3t: 'Tú ganas 1 mes', ref_s3: 'Después de su primer pago. Cada 3 recomendaciones pagadas, 1 mes de bono más.',
    ref_terms: 'Reglas del programa',
    q8: '¿Qué pasa cuando termina la prueba?',
    a8: 'Eliges un plan para seguir. Como nunca pedimos tarjeta, no se cobra nada automáticamente.',
    final_t: 'Cada obra, del estimado al pago.',
    final_p: 'Empieza hoy la prueba gratis de 14 días. Sin tarjeta, y con una empresa de demostración lista.',
    foot_tag: 'Hecho por contratistas, para contratistas.',
    doc_back: '← Volver al inicio',
    foot_label: 'Pie de página', foot_terms: 'Términos', foot_privacy: 'Privacidad', foot_contact: 'Contacto'
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

  var DICT = { en: EN, pt: PT, es: ES }, HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };
  var lang = DICT[d.getAttribute('data-lang-init')] ? d.getAttribute('data-lang-init') : 'en';
  function t(k) { var dict = DICT[lang] || EN; return dict[k] != null ? dict[k] : EN[k]; }

  function applyLang() {
    d.lang = HTML_LANG[lang];
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
    d.setAttribute('data-theme', next); store('bisey-site-theme', next);
    updateThemeLabel(); updateShots();
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { updateThemeLabel(); updateShots(); });

  // ── imagens do app (idioma + tema) ──
  function updateShots() {
    var th = resolvedTheme();
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var src = 'img/' + img.getAttribute('data-shot') + '-' + (lang === 'pt' || lang === 'es' ? lang : 'en') + '-' + th + '.jpg';
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
  }

  // ── idioma ──
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = DICT[b.getAttribute('data-lang')] ? b.getAttribute('data-lang') : 'en'; store('bisey-site-lang', lang); applyLang();
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

  // ── indicação: ?ref=CÓDIGO fica guardado (60 dias) e vai junto em todos os botões de cadastro → /app/?signup=1&ref=CÓDIGO ──
  (function () {
    var code = '';
    try {
      var m = /[?&]ref=([^&#]+)/.exec(location.search);
      if (m) { code = decodeURIComponent(m[1]).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32); if (code.length >= 3) localStorage.setItem('bisey_ref', JSON.stringify({ code: code, at: Date.now() })); else code = ''; }
      if (!code) { var s = JSON.parse(localStorage.getItem('bisey_ref') || 'null'); if (s && s.code && Date.now() - (s.at || 0) < 60 * 864e5) code = s.code; }
    } catch (e) {}
    if (!code) return;
    document.querySelectorAll('a[href*="signup=1"]').forEach(function (a) { var h = a.getAttribute('href'); if (!/[?&]ref=/.test(h)) a.setAttribute('href', h + '&ref=' + encodeURIComponent(code)); });
    var b = document.getElementById('ref-banner'); if (b) b.hidden = false;
  })();
})();
