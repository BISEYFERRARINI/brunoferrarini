/* Eternity Electric — app UI (admin + funcionário). Vanilla JS, no build step. */
(function () {
  "use strict";
  var API = window.API;
  var APP_VERSION = "0.3.0";

  // ═══════════ textos (i18n) ═══════════
  // i18n.js (carregado antes) traz t()/tn()/tv() e o idioma de cada pessoa; em inglês ele já carregou o i18n.en.js.
  // t('tela.chave', 'Texto em português', { var: valor }) · tn(chave, n, '1 item', '{n} itens') · tv(valorGravado) só na exibição.
  var NV = window.NV, I18N = NV.I18N, LANG = NV.lang, t = NV.t, tn = NV.tn, tv = NV.tv, LOCALE = NV.locale();

  // ═══════════ helpers ═══════════
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n, dec) { n = Number(n) || 0; var d = dec === undefined ? (Math.abs(n) >= 10000 ? 0 : 2) : dec; return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function hrs(n) { n = Number(n) || 0; return (n >= 100 ? Math.round(n) : n.toFixed(1)).toLocaleString("en-US") + "h"; }
  function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
  function fmtPct(p) { return (p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)) + "%"; }
  function fmtDate(d) { if (!d) return "—"; var x = new Date(String(d).length === 10 ? d + "T12:00:00" : d); return isNaN(x) ? String(d) : x.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "2-digit" }); }
  function fmtTime(d) { if (!d) return "—"; var x = new Date(d); return isNaN(x) ? "—" : x.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }); }
  function todayISO() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function isoLocal(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function set(obj, path, val) { var ks = path.split("."), o = obj; for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }
  // Toast padronizado: ícone de estado + texto + ação opcional ("Tentar de novo"). O tipo é deduzido do texto
  // quando não vem em opts.kind: "…" no fim = em andamento; erro/não/falh = erro; o resto = sucesso/informação.
  function toast(msg, opts) {
    opts = opts || {};
    var t = $("#toast"); if (!t) return;
    var m = String(msg == null ? "" : msg);
    var kind = opts.kind || (/…$|\.\.\.$/.test(m) ? "busy" : /^(erro|não|nao|sem |falh|digite|escolha|informe|preencha|a saída|error|no |offline|fail|type |choose |pick |enter |fill |punch-out has|that didn't|couldn't|can't)|erro|não consegui|não deu|error|couldn't|could not|didn't work/i.test(m) ? "bad" : /^(modo demonstração|aviso novo|\d+ avisos|demo mode|new notice|\d+ new notices)/i.test(m) ? "info" : "ok");
    var icn = kind === "busy" ? '<span class="spin" aria-hidden="true"></span>' : ic(kind === "bad" ? "alert" : kind === "info" ? "info" : "check", 18);
    t.className = "toast " + kind;
    t.innerHTML = '<span class="toast-ic">' + icn + '</span><span class="toast-msg">' + esc(m) + "</span>" + (opts.action ? '<button type="button" class="toast-act">' + esc(opts.action.label) + "</button>" : "");
    if (opts.action) t.querySelector(".toast-act").onclick = function () { t.hidden = true; opts.action.run(); };
    t.hidden = false; clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, kind === "busy" ? 8000 : opts.action ? 6000 : 4000);
  }
  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var hoursOf = API.hoursOf;
  var EXT = { views: {}, actions: {}, nav: [], load: [], submit: {}, change: [], input: [], afterRender: [], dashTop: [], afterLogin: [], leave: [], beforeReload: [] };
  // leave: funções que devolvem { label, save(): Promise<bool>, discard() } quando a tela atual tem alterações não salvas (rascunho) — go() pergunta antes de sair
  // beforeReload: chamadas antes de recarregar a página (troca de idioma) para guardar rascunhos

  // Ícones Bisey: traço 1,75 em grade 24, cantos arredondados (docs/02-design-system.md §5)
  var ICON_PATHS = {
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    flake: '<path d="M12 2.5v19M4.2 7l15.6 10M4.2 17l15.6-10M9 4.3 12 6.5l3-2.2M9 19.7l3-2.2 3 2.2"/>',
    dash: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    doc: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
    receipt: '<path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    team: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.8.6 3 2.3 3.4 4.7"/>',
    report: '<path d="M4.5 20.5V4.5M4.5 20.5h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.9-3.8 3.8-5.8 7.5-5.8s6.6 2 7.5 5.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevd: '<path d="M7 10l5 5 5-5"/>',
    chevr: '<path d="M10 7l5 5-5 5"/>',
    chevl: '<path d="M14 7l-5 5 5 5"/>',
    map: '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    note: '<path d="M12 8v5M12 16.5v.01"/><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5v10h13v-10"/><path d="M10 19.5v-5h4v5"/>',
    grid: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
    camera: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
    edit: '<path d="M4.5 19.5l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3l-10 10z"/><path d="M13.5 7.5l3 3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    file: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    logout: '<path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    install: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 16.8v.01"/>',
    drop: '<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>',
    hammer: '<path d="M13.5 6.5 6 14l4 4 7.5-7.5"/><path d="M11 4.5l2.5 2 3.5-1 3 3-1 3.5 2 2.5-2 2-6.5-6.5z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    upload: '<path d="M12 15.5V4.5M7 9l5-5 5 5M5 19.5h14"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6.5 14.5h4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    percent: '<path d="M18.5 5.5 5.5 18.5"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5v8h14v-8M12 8v12.5"/><path d="M12 8C10.6 5 7 4.4 7 6.6 7 8 9.3 8 12 8zm0 0c1.4-3 5-3.6 5-1.4C17 8 14.7 8 12 8z"/>',
    send: '<path d="M4 12 20 4l-6 16-2.5-6.5z"/><path d="M11.5 13.5 20 4"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
    spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'
  };
  // ícones dos ramos: um ramo pode trazer o próprio SVG (trades.js → icon: { svg }) e vira o ícone "trade-<id>"
  function iconPath(name) {
    if (!ICON_PATHS[name] && /^trade-/.test(name)) { var td = (NV.TRADES || {})[name.slice(6)]; if (td && td.iconSvg) ICON_PATHS[name] = td.iconSvg; }
    return ICON_PATHS[name] || "";
  }
  (NV.tradeList ? NV.tradeList() : []).forEach(function (d) { if (d.iconSvg) iconPath(d.icon); });
  function ic(name, size, cls) {
    var px = size || 20;
    return '<svg class="i' + (cls ? " " + cls : "") + '" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + iconPath(name) + "</svg>";
  }
  var ICON = {}; Object.keys(ICON_PATHS).forEach(function (k) { ICON[k] = ic(k); }); // compatível com o ICON antigo (EE.ICON)

  // ═══════════ catalog (electrical / HVAC) ═══════════
  // Despesas da obra (as mesmas opções da aba Notas). Mão de obra = horas trabalhadas (calculada pelo ponto).
  var EXPENSE_CATS = [
    { id: "material", label: "Material", color: "var(--c1)" },
    { id: "permit", label: t("catalog.permit", "Permit"), color: "var(--c3)" },
    { id: "equipamento", label: t("catalog.equipmentRental", "Equipamento / aluguel"), color: "var(--c7)" },
    { id: "outros", label: t("catalog.other", "Outros"), color: "var(--c6)" }
  ];
  var LEGACY_CATS = { gasolina: t("catalog.gasFuel", "Gasolina"), subcontractor: t("catalog.subcontractor", "Subempreiteiro"), receita: t("catalog.revenue", "Receita"), labor: t("catalog.labor", "Mão de obra") };
  function catKey(id) { return EXPENSE_CATS.some(function (c) { return c.id === id; }) ? id : "outros"; }
  function catLabel(id) { var c = EXPENSE_CATS.find(function (x) { return x.id === id; }); return c ? c.label : (LEGACY_CATS[id] || id); }
  var STATUS = { Active: [t("catalog.inProgress", "Em andamento"), "good"], Planned: [t("catalog.notStarted", "A começar"), "accent"], "On Hold": [t("catalog.onHold", "Em espera"), "warn"], Completed: [t("catalog.completed", "Concluído"), "neutral"], Cancelled: [t("catalog.cancelled", "Cancelado"), "bad"] };
  function statusLabel(s) { return (STATUS[s] || [s])[0]; } // status do projeto no idioma de quem usa (gravado em inglês: Active, Completed…)
  function statusPill(s) { var x = STATUS[s] || [s, "neutral"]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }

  var COMMON_FIELDS = {
    sector: { label: t("catalog.type", "Tipo"), opts: ["Residencial", "Comercial"] },
    buildingRes: { label: t("catalog.residential", "Residencial"), opts: ["Single family", "Two-family", "Multifamily"] },
    bedrooms: { label: t("catalog.bedrooms", "Quartos"), opts: ["Studio", "1", "2", "3", "4", "5", "6+"] },
    bathrooms: { label: t("catalog.bathrooms", "Banheiros"), opts: ["1", "1.5", "2", "2.5", "3", "3.5", "4+"] },
    floors: { label: t("catalog.floors", "Andares"), opts: ["1", "2", "3", "4", "5+"] },
    permit: { label: "Permit", opts: ["Sim, já aprovado", "Sim, a tirar", "Não precisa"] },
    walls: { label: t("catalog.walls", "Paredes"), opts: ["Abertas (sem drywall)", "Fechadas (acabadas)", "Parcialmente abertas"] },
    occupied: { label: t("catalog.occupancy", "Ocupação"), opts: ["Desocupado", "Ocupado (família morando)", "Comercial em funcionamento"] },
    access: { label: t("catalog.access", "Acesso"), multi: true, opts: ["Porão acessível", "Sótão acessível", "Crawl space", "Sem acesso por cima/baixo", "Precisa de elevador / andaime"] }
  };
  // Ramos (electrical, hvac, plumbing, gc, …): registro dirigido por dados em trades.js (NV.TRADES; formato em docs/ramos/ESQUEMA.md).
  // Cada definição traz workType, fields (ficha técnica), text, tasks, suggest, group, sysKeys, stepName, kind, proposal e prices.
  var TRADE = NV.TRADES;
  function tradeDef(id) { return NV.tradeDef(id); }
  // Marca do PRODUTO (Bisey) x marca da EMPRESA do cliente (vem de API.companies / config; trocável por applyBrand)
  var PRODUCT = "Bisey";
  // endereço público do produto (página de vendas): usado no link de indicação. Troca num lugar só: APP_CONFIG.SITE_URL no config.js
  var SITE_URL = String((window.APP_CONFIG && window.APP_CONFIG.SITE_URL) || "https://getbisey.com").replace(/\/+$/, "");
  var APPCO = API.companies[0], BRAND = APPCO.name, BRAND_ICON = '<img src="icons/mark-' + APPCO.id + '.png" alt="">';
  var KNOWN_LOGOS = { eternity: "icons/mark-eternity.png", bluestar: "icons/mark-bluestar.png" };
  var BRAND_OVR = {}; // preenchido por applyBrand (onboarding / configurações)
  function companyBrand(id) {
    var c = API.companies.find(function (x) { return x.id === id; }) || APPCO, o = id === APPCO.id ? BRAND_OVR : {};
    return { id: c.id, name: o.name || c.name, trade: c.trade, logo: o.logo !== undefined ? o.logo : (c.logo || KNOWN_LOGOS[c.id] || "") };
  }
  function tradeLabel(id) { return NV.tradeLabel(id); }
  function initials(name) { return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  function coLogo(b) { return '<span class="co-logo">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '<span class="co-ini">' + esc(initials(b.name)) + "</span>") + "</span>"; }
  function luminance(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return 0.3;
    var n = parseInt(m[1], 16), ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  /* Gancho para onboarding/configurações: aplica a marca da empresa do cliente.
     applyBrand({ name: "Minha Empresa", logo: "data:image/png;base64,…" | "url" | "", accent: "#C98200" })
     – accent vira --accent (claro) e uma versão mais clara no escuro; --accent-ink é preto/branco pela luminância.
     – passar accent: null volta à cor padrão (cobalto Bisey ou a do data-company do seed). */
  function applyBrand(b) {
    b = b || {};
    if (b.reset) BRAND_OVR = {}; // reset:true limpa a marca aplicada antes (usado para desfazer a prévia do onboarding)
    if (b.name !== undefined) BRAND_OVR.name = b.name || undefined;
    if (b.logo !== undefined) BRAND_OVR.logo = b.logo;
    if (b.accent !== undefined) BRAND_OVR.accent = b.accent || undefined;
    paintAccent();
    if (S && S.user) render();
  }
  function brandOverride() { return Object.assign({}, BRAND_OVR); }
  // cor efetiva: a de applyBrand (config / prévia) para a empresa principal, senão a cor salva da empresa ativa;
  // sem nenhuma, vale o CSS (cobalto Bisey ou o data-company das empresas de exemplo)
  var painted = null;
  function activeCompanyId() { return S && S.user ? (isStaff() ? S.company : S.user.companyId) : (S ? S.company : APPCO.id); }
  function effectiveAccent() {
    var cid = activeCompanyId();
    if (BRAND_OVR.accent && (!S || !S.user || cid === APPCO.id)) return BRAND_OVR.accent;
    var c = API.companies.find(function (x) { return x.id === cid; });
    return (c && c.accent) || null;
  }
  function paintAccent() {
    var a = effectiveAccent(); if (a === painted) return; painted = a;
    var st = document.getElementById("brand-accent");
    if (!a) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement("style"); st.id = "brand-accent"; document.head.appendChild(st); }
    var ink = luminance(a) > 0.45 ? "#111111" : "#FFFFFF", mix = luminance(a) > 0.35 ? 50 : 62;
    var dark = "color-mix(in srgb, " + a + " 72%, #FFFFFF)", R = ":root:root:root:root"; // vence o :root[data-company=…][data-theme=…] do tokens.css
    st.textContent = R + "{--accent:" + a + ";--accent-ink:" + ink + ";--accent-text:color-mix(in srgb, " + a + " " + mix + "%, var(--ink))}" +
      R + "[data-theme=dark]{--accent:" + dark + ";--accent-ink:#04091E}" +
      "@media (prefers-color-scheme: dark){" + R + ":not([data-theme=light]){--accent:" + dark + ";--accent-ink:#04091E}}";
  }
  // imagem → dataURL redimensionada no canvas (logo: PNG com transparência; se ficar grande, JPEG em fundo branco)
  function resizeImage(file, max) {
    max = max || 256;
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type || "")) return rej(new Error(t("img.notImage", "Escolha um arquivo de imagem (PNG, JPG ou SVG).")));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth || img.width || max, h = img.naturalHeight || img.height || max, s = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        var g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var d = c.toDataURL("image/png");
        if (d.length > 180000) { var c2 = document.createElement("canvas"); c2.width = c.width; c2.height = c.height; var g2 = c2.getContext("2d"); g2.fillStyle = "#fff"; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(c, 0, 0); d = c2.toDataURL("image/jpeg", 0.85); }
        res(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error(t("img.unreadable", "Não consegui abrir essa imagem."))); };
      img.src = url;
    });
  }
  function copyText(txt) {
    var done = function () { toast(t("common.copied", "Copiado.")); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(done, function () { fallback(); });
    fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast(t("common.copyFail", "Não consegui copiar. Selecione e copie à mão.")); } ta.remove(); }
  }

  // ═══════════ papéis e permissões ═══════════
  // admin = dono/sócio (tudo) · manager = gerente (obras, escala, agenda, avisos, notas, ponto e propostas, SEM valores
  // financeiros da empresa nem Configurações/Plano) · employee = funcionário (como antes).
  var PERMS = {
    manager: { staff: 1, projects: 1, proposals: 1, schedule: 1 },
    employee: {}
  };
  // telas que pedem uma permissão (as outras telas do escritório pedem só "staff")
  var VIEW_PERM = { gastos: "finance", hours: "finance", reports: "finance", team: "team", settings: "settings", impostos: "finance", indicar: "settings" };
  function roleOf(u) { u = u || (S && S.user); if (!u) return null; return u.role === "admin" || u.role === "manager" ? u.role : "employee"; }
  function can(perm, u) { var r = roleOf(u); if (!r) return false; if (r === "admin") return true; return !!(PERMS[r] || {})[perm]; }
  function isStaff(u) { return can("staff", u); }
  function roleLabel(r) { r = typeof r === "string" ? r : roleOf(r); return r === "admin" ? t("role.admin", "Administrador") : r === "manager" ? t("role.manager", "Gerente") : t("role.employee", "Funcionário"); }
  function canView(v) { var p = VIEW_PERM[v]; return !p || can(p); }
  // Tema: "auto" (segue o aparelho), "light" ou "dark"; a escolha fica no aparelho (localStorage com try/catch)
  function currentTheme() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  function setTheme(t) {
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
    try { if (t === "dark" || t === "light") localStorage.setItem("bisey_theme", t); else localStorage.removeItem("bisey_theme"); } catch (e) {}
    var meta = document.querySelectorAll('meta[name="theme-color"]'); meta.forEach(function (m) { m.setAttribute("content", currentTheme() === "dark" ? "#050A19" : "#0A1433"); });
  }
  function tradeOf(companyId) { var c = API.companies.find(function (x) { return x.id === companyId; }); return c ? c.trade : "electrical"; }
  // opções da empresa (Configurações → Empresa), ex.: { noGas: true } — "Não fazemos gás". Demo: no registro da empresa; Supabase: companies.settings
  function coFlags(companyId) {
    var c = API.companies.find(function (x) { return x.id === companyId; }) || {}, o = {};
    NV.tradeDef(c.trade).companyFlags.forEach(function (f) { o[f.key] = !!(c[f.key] || (c.settings || {})[f.key]); });
    if (c.preset) o._preset = true; // empresa pré-configurada (Eternity / Blue Star): vê as opções antigas da ficha (ex.: "Eternity Electric")
    return o;
  }
  function companyName(id) { var c = API.companies.find(function (x) { return x.id === id; }); return c ? c.name : id; }

  // ═══════════ state ═══════════
  var S = {
    user: null, company: APPCO.id, view: "dashboard", params: {},
    projects: [], fin: {}, users: [], time: [], expenses: [],
    filters: { preset: "all", from: "", to: "", projectId: "", userId: "" },
    gastoCat: "all", draft: null, draftFiles: [], wizStep: 0, modal: null, open: null, loc: null, installEvt: null
  };

  function applyPreset() {
    var f = S.filters, now = new Date(), from = null, to = new Date(now);
    if (f.preset === "today") from = new Date(now);
    else if (f.preset === "this_week") { from = new Date(now); from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); }
    else if (f.preset === "last_week") { to = new Date(now); to.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 1); from = new Date(to); from.setDate(to.getDate() - 6); }
    else if (f.preset === "this_month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (f.preset === "last_month") { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (f.preset === "custom") return;
    else { f.from = ""; f.to = ""; return; }
    f.from = isoLocal(from); f.to = isoLocal(to);
  }

  function companyProjects() { return S.projects.filter(function (p) { return p.companyId === S.company; }); }
  function projectById(id) { return S.projects.find(function (p) { return p.id === id; }); }
  function userById(id) { return S.users.find(function (u) { return u.id === id; }); }
  function userName(id) { var u = userById(id); return u ? u.name : (S.user && S.user.id === id ? S.user.name : "—"); }

  // ═══════════ "Quem fez": autoria em tudo (tarefas, avisos, notas, arquivos, agenda, escala, propostas, ponto) ═══════════
  // Mostra "Carla · 27 out, 14:32" com a inicial; "Feito por João · ontem, 16:05" nas tarefas; "Editado por …" quando mudou.
  var MON = t("who.months", "jan,fev,mar,abr,mai,jun,jul,ago,set,out,nov,dez").split(",");
  function whenShort(iso) {
    if (!iso) return "";
    var dateOnly = String(iso).length === 10, d = new Date(dateOnly ? iso + "T12:00:00" : iso); if (isNaN(d)) return "";
    var today = new Date(); today.setHours(0, 0, 0, 0); var day = new Date(d); day.setHours(0, 0, 0, 0);
    var diff = Math.round((today - day) / 864e5);
    var dl = diff === 0 ? t("who.today", "hoje") : diff === 1 ? t("who.yesterday", "ontem") : (LANG === "en" ? MON[d.getMonth()] + " " + d.getDate() : d.getDate() + " " + MON[d.getMonth()]) + (d.getFullYear() !== today.getFullYear() ? " " + d.getFullYear() : "");
    return dateOnly ? dl : t("who.at", "{d}, {t}", { d: dl, t: fmtTime(iso) });
  }
  function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  // tpl = texto com {n} (nome); o nome sai em negrito. Sem nome → "".
  function byLine(tpl, name, iso, cls) {
    if (!name) return "";
    var txt = esc(tpl.replace("{n}", "\u0001")).replace("\u0001", "<b>" + esc(firstName(name)) + "</b>"), when = whenShort(iso);
    return '<span class="byline' + (cls ? " " + cls : "") + '" title="' + esc(name + (iso ? " · " + fmtDate(iso) + (String(iso).length > 10 ? " " + fmtTime(iso) : "") : "")) + '"><span class="avatar xs" aria-hidden="true">' + esc(initials(name)) + "</span><span>" + txt + (when ? " · " + esc(when) : "") + "</span></span>";
  }
  // só o nome + quando (colunas "Lançado por")
  function byCell(name, iso) { return name ? byLine("{n}", name, iso, "cell") : '<span class="muted">—</span>'; }

  function loadData() {
    if (typeof dropActs === "function") dropActs(); // a atividade da obra recarrega junto com os dados
    var isAdmin = isStaff(), money = can("finance"); // gerente: carrega como o escritório, mas sem o financeiro das obras
    var co = isAdmin ? S.company : S.user.companyId;
    var jobs = [API.listProjects(co), API.listTime({ companyId: isAdmin ? co : null }), API.listExpenses({ companyId: isAdmin ? co : null }), API.listNotices ? API.listNotices().catch(function () { return []; }) : Promise.resolve([])];
    if (isAdmin) { jobs.push(money ? API.getFinancials() : Promise.resolve({})); jobs.push(API.listUsers()); }
    var CK = "ee_cache_" + S.user.id + "_" + co;
    return Promise.all(jobs).then(function (r) {
      S.projects = r[0]; S.time = r[1]; S.expenses = r[2]; S.notices = (r[3] || []).filter(function (n) { return n.companyId === co; });
      if (isAdmin) { S.fin = r[4] || {}; S.users = (r[5] || []).map(function (u) { if (money) return u; var c = Object.assign({}, u); delete c.rate; return c; }); checkNewNotices(); }
      S.offline = false;
      if (isAdmin) return Promise.all(EXT.load.map(function (f) { return f(co).catch(function () {}); }));
      if (API.mode === "live") storeSet(CK, JSON.stringify({ p: S.projects, t: S.time.slice(0, 600), e: S.expenses.slice(0, 600), f: S.fin, u: S.users, at: new Date().toISOString() }));
    }).catch(function (e) {
      // sem internet: mostra os últimos dados salvos neste aparelho
      var c = null; try { c = JSON.parse(storeGet(CK) || "null"); } catch (x) {}
      if (!c) throw e;
      S.projects = c.p || []; S.time = c.t || []; S.expenses = c.e || []; S.fin = c.f || {}; S.users = c.u || [];
      S.offline = c.at;
    }).then(function () {
      if (S.filters.projectId && !projectById(S.filters.projectId)) S.filters.projectId = "";
    });
  }

  // preferências de notificação (Configurações → Notificações): ficam neste aparelho
  var NOTIF_DEF = { notices: true, browser: false, todayAgenda: false };
  function notifPrefs() { var o = {}; try { o = JSON.parse(storeGet("bisey_notif") || "{}") || {}; } catch (e) { o = {}; } return Object.assign({}, NOTIF_DEF, o); }
  function setNotifPref(k, v) { var o = notifPrefs(); o[k] = v; storeSet("bisey_notif", JSON.stringify(o)); }
  function checkNewNotices() {
    var seen = storeGet("ee_notice_seen") || "", fresh = (S.notices || []).filter(function (n) { return !n.resolved && n.createdAt > seen; }), pr = notifPrefs();
    if (fresh.length && S.view !== "avisos" && pr.notices) setTimeout(function () { toast(fresh.length === 1 ? t("notices.newNoticeFrom", "Aviso novo de ") + (fresh[0].authorName || t("notices.crewMember", "funcionário")) + ": " + fresh[0].text.slice(0, 80) : fresh.length + t("notices.newNoticesFromThe", " avisos novos da equipe. Veja em Avisos.")); }, 900);
    if (fresh.length && pr.browser && window.Notification && Notification.permission === "granted" && document.hidden) {
      try { new Notification(PRODUCT + " · " + t("notif.newNotice", "Aviso novo da equipe"), { body: (fresh[0].authorName ? fresh[0].authorName + ": " : "") + fresh[0].text.slice(0, 120), icon: "brand/apple-touch-icon-180.png" }); } catch (e) {}
    }
  }
  function markNoticesSeen() { var last = (S.notices || []).reduce(function (a, n) { return n.createdAt > a ? n.createdAt : a; }, ""); if (last) storeSet("ee_notice_seen", last); }

  // ═══════════ metrics ═══════════
  function inPeriod(iso) { var f = S.filters; if (!iso) return false; var d = isoLocal(new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso)); return (!f.from || d >= f.from) && (!f.to || d <= f.to); }
  function metrics() {
    var f = S.filters;
    var scope = companyProjects().filter(function (p) { return f.projectId ? p.id === f.projectId : p.status !== "Cancelled"; });
    var ids = {}; scope.forEach(function (p) { ids[p.id] = true; });
    var inScope = function (pid) { return f.projectId ? pid === f.projectId : (pid ? !!ids[pid] : true); };
    var T = S.time.filter(function (t) { return t.companyId === S.company && inScope(t.projectId) && (!f.userId || t.userId === f.userId); });
    var E = S.expenses.filter(function (x) { return x.companyId === S.company && inScope(x.projectId); });
    var m = { scope: scope, contract: 0, budget: 0, matBudget: 0, labBudget: 0, estHours: 0, period: blank(), all: blank(), T: T, E: E };
    scope.forEach(function (p) { var fi = S.fin[p.id] || {}; m.contract += fi.contractValue || 0; m.budget += fi.budget || 0; m.matBudget += fi.materialBudget || 0; m.labBudget += fi.laborBudget || 0; m.estHours += fi.estHours || 0; });
    function blank() { var o = { hours: 0, labor: 0, revenue: 0, exp: 0, byCat: {}, byUser: {} }; EXPENSE_CATS.forEach(function (c) { o.byCat[c.id] = 0; }); return o; }
    function addT(o, t) { var h = hoursOf(t); o.hours += h; o.labor += h * (t.rate || 0); var u = o.byUser[t.userId] || (o.byUser[t.userId] = { hours: 0, cost: 0, rate: t.rate }); u.hours += h; u.cost += h * (t.rate || 0); }
    function addE(o, x) { if (x.kind === "revenue") o.revenue += x.amount; else { o.exp += x.amount; o.byCat[catKey(x.category)] += x.amount; } }
    T.forEach(function (t) { addT(m.all, t); if (inPeriod(t.checkIn)) addT(m.period, t); });
    E.forEach(function (x) { addE(m.all, x); if (inPeriod(x.date)) addE(m.period, x); });
    [m.period, m.all].forEach(function (o) { o.cost = o.labor + o.exp; o.profit = o.revenue - o.cost; });
    var tDone = 0, tAll = 0; scope.forEach(function (p) { (p.tasks || []).forEach(function (t) { tAll++; if (t.done) tDone++; }); });
    m.tDone = tDone; m.tAll = tAll;
    return m;
  }
  function projectStats(p) {
    var fi = S.fin[p.id] || {}, labor = 0, exp = 0, hours = 0, rev = 0, mat = 0;
    S.time.forEach(function (t) { if (t.projectId === p.id) { var h = hoursOf(t); hours += h; labor += h * (t.rate || 0); } });
    S.expenses.forEach(function (x) { if (x.projectId === p.id) { if (x.kind === "revenue") rev += x.amount; else { exp += x.amount; if (x.category === "material") mat += x.amount; } } });
    var done = (p.tasks || []).filter(function (t) { return t.done; }).length, total = (p.tasks || []).length;
    return { contract: fi.contractValue || 0, budget: fi.budget || 0, matBudget: fi.materialBudget || 0, labBudget: fi.laborBudget || 0, estHours: fi.estHours || 0, labor: labor, exp: exp, material: mat, cost: labor + exp, hours: hours, revenue: rev, done: done, total: total, progress: pct(done, total) };
  }

  // ═══════════ charts (SVG) ═══════════
  function ring(p, size, opts) {
    opts = opts || {};
    size = size || 64;
    var stroke = opts.stroke || Math.max(6, Math.round(size / 9)), r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var shown = Math.max(0, Math.min(100, p || 0));
    var color = opts.color || (p > 100 ? "var(--bad)" : p > 85 ? "var(--warn)" : "var(--accent)");
    var label = opts.text != null ? opts.text : fmtPct(p || 0);
    var fs = opts.fontSize || Math.round(size / 4.2);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(label) + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>' +
      (shown > 0 ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (c * shown / 100) + " " + c + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' : "") +
      '<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="' + fs + '" fill="' + (opts.textColor || "var(--ink)") + '">' + esc(label) + "</text>" +
      (opts.sub ? '<text x="50%" y="' + (size / 2 + fs * 0.95) + '" text-anchor="middle" font-size="' + (opts.subSize || Math.round(fs * 0.42)) + '" fill="var(--muted)" style="font-family:var(--f-body);font-weight:500">' + esc(opts.sub) + "</text>" : "") +
      "</svg>";
  }
  function donut(segs, size, center, sub) {
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0);
    var stroke = Math.round(size / 7), r = (size - stroke) / 2, c = 2 * Math.PI * r, off = 0, out = "";
    out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>';
    if (total > 0) segs.forEach(function (s) {
      if (s.value <= 0) return;
      var len = c * s.value / total, gap = segs.filter(function (x) { return x.value > 0; }).length > 1 ? 2 : 0;
      out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="' + stroke + '" stroke-dasharray="' + Math.max(0, len - gap) + " " + c + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>';
      off += len;
    });
    out += '<text x="50%" y="47%" dominant-baseline="central" text-anchor="middle" font-size="' + Math.round(size / 8.5) + '" fill="var(--ink)" style="font-family:var(--f-display);font-weight:700">' + esc(center) + "</text>";
    if (sub) out += '<text x="50%" y="62%" text-anchor="middle" font-size="' + Math.round(size / 19) + '" fill="var(--muted)">' + esc(sub) + "</text>";
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(center + " " + (sub || "")) + '">' + out + "</svg>";
  }
  function bars(rows, fmt) {
    var max = rows.reduce(function (a, r) { return Math.max(a, r.value); }, 0);
    if (!rows.length) return '<div class="empty-inline">' + ic("info", 18) + t("dashboard.noDataForThis", "Sem dados no período.</div>");
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="bar-row' + (r.act ? " click" : "") + '"' + (r.act ? ' data-act="' + r.act + '" data-id="' + esc(r.id) + '" role="button" tabindex="0"' : "") + '><span class="bar-l">' + (r.swatch ? '<span class="sw" style="background:' + r.color + '"></span>' : "") + esc(r.label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + (max ? (r.value / max) * 100 : 0) + "%;background:" + (r.color || "var(--accent)") + '"></div></div><span class="n">' + fmt(r.value) + "</span></div>";
    }).join("") + "</div>";
  }

  // ═══════════ render root ═══════════
  var focusMem = { modal: null, overlay: null, opener: null };
  function render() {
    document.documentElement.dataset.company = S.user ? (isStaff() ? S.company : S.user.companyId) : S.company;
    paintAccent();
    var app = $("#app");
    if (!S.user) {
      S.overlay = null;
      // criar conta / onboarding (onboarding.js) ou a tela de entrar
      app.innerHTML = S.signup && EXT.signupView ? EXT.signupView() : loginView(); document.title = (S.signup ? t("signup.title", "Criar conta") + " · " : "") + PRODUCT;
      if (S.modal && S.signup) app.insertAdjacentHTML("beforeend", modalView());
      EXT.afterRender.forEach(function (f) { try { f(); } catch (e) {} });
      return;
    }
    app.innerHTML = (isStaff() ? adminShell() : employeeShell()) + (S.modal ? modalView() : "") + overlayView();
    if (S.view === "punch") startTicker();
    afterRender();
  }
  function go(view, params, force) {
    if (!force && askLeave(function () { go(view, params, true); })) return;
    S.view = view; S.params = params || {}; S.modal = null; S.overlay = null; render(); window.scrollTo(0, 0);
  }
  // rascunho aberto com alterações não salvas → "Salvar / Descartar / Continuar editando" antes de sair da tela
  function askLeave(proceed) {
    for (var i = 0; i < EXT.leave.length; i++) {
      var g = null; try { g = EXT.leave[i](); } catch (e) {}
      if (g) { S.pendingLeave = { proceed: proceed, guard: g }; S.overlay = null; S.modal = { type: "leave", title: t("leave.title", "Alterações não salvas") }; render(); return true; }
    }
    return false;
  }
  function guardLeave(fn) { if (!askLeave(fn)) fn(); }
  // assistente de projeto: alterações não salvas (S.draftBase = retrato ao abrir; null = veio preenchido de outra tela)
  function wizSnap(d) { var c = JSON.parse(JSON.stringify(d)); delete c._moneyOk; return JSON.stringify(c); }
  function markWizClean() { S.draftBase = S.draft ? wizSnap(S.draft) : null; }
  function wizDirty() { return !!(S.draft && ((S.draftFiles && S.draftFiles.length) || S.draftBase == null || wizSnap(S.draft) !== S.draftBase)); }
  function restoreWizard() { try { var w = JSON.parse(sessionStorage.getItem("bisey_wizdraft") || "null"); sessionStorage.removeItem("bisey_wizdraft"); if (w && w.d) { S.draft = w.d; S.draftBase = w.base == null ? null : w.base; S.wizStep = w.step || 0; S.draftFiles = []; } } catch (e) {} }
  EXT.leave.push(function () {
    if (S.view !== "projectForm" || !wizDirty()) return null;
    return { label: t("leave.project", "“{p}”", { p: S.draft.name || t("projects.newProject2", "Novo projeto") }),
      save: function () { A.saveProject(); return false; }, // o salvar normal (com os avisos dele) e abre o projeto salvo
      discard: function () { S.draft = null; S.draftBase = null; S.draftFiles = []; } };
  });
  EXT.beforeReload.push(function () { if (S.view === "projectForm" && S.draft) try { sessionStorage.setItem("bisey_wizdraft", JSON.stringify({ d: S.draft, base: S.draftBase, step: S.wizStep })); } catch (e) {} });

  // foco: abre modal/folha → foca o 1º campo; fecha → volta para o botão que abriu
  function afterRender() {
    var lbl = (allNav().find(function (n) { return n[0] === navActive(S.view); }) || [])[1];
    document.title = (lbl ? lbl + " · " : "") + PRODUCT;
    var modalKey = S.modal ? S.modal.type + (S.modal.id || "") : null, ovKey = S.overlay || null;
    if ((modalKey && modalKey !== focusMem.modal) || (ovKey && ovKey !== focusMem.overlay)) {
      var box = ovKey ? $(".ov-panel") : $(".modal");
      var first = ovKey === "cmdk" ? $("#cmdkInput") : box && box.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not(.x),[href]');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      if (ovKey === "cmdk") cmdkUpdate();
    } else if ((!modalKey && focusMem.modal) || (!ovKey && focusMem.overlay)) {
      var o = focusMem.opener, el = o ? document.querySelector('[data-act="' + o.act + '"]' + (o.id ? '[data-id="' + o.id + '"]' : "")) : null;
      if (el && !(S.modal || S.overlay)) try { el.focus({ preventScroll: true }); } catch (e) {}
    } else if (ovKey === "cmdk") cmdkUpdate();
    focusMem.modal = modalKey; focusMem.overlay = ovKey;
    EXT.afterRender.forEach(function (f) { try { f(); } catch (e) {} }); // tour de boas-vindas etc.
  }

  // ═══════════ login ═══════════
  function loginAside() {
    return '<aside class="login-aside"><img class="login-logo" src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + PRODUCT + '" width="97" height="40">' +
      t("login.yourJobOnThe", '<div class="login-pitch"><h1>Da proposta ao pagamento.</h1><p>Propostas por voz, notas que se lançam sozinhas e ponto com selfie e GPS.</p>') +
      '<ul class="login-feats"><li>' + ic("mic") + t("login.talkInsteadOfTyping", '<div><b>Fale em vez de digitar</b><span>Descreva o serviço e a proposta sai no padrão da sua empresa.</span></div></li>') +
      "<li>" + ic("camera") + t("login.receiptsThatLogThemselves", '<div><b>Notas que se lançam sozinhas</b><span>Foto do recibo: a IA descobre a obra e a categoria.</span></div></li>') +
      "<li>" + ic("clock") + t("login.aTimeClockThe", '<div><b>Ponto que a equipe respeita</b><span>Selfie + GPS detecta a obra e manda a folha todo sábado.</span></div></li></ul></div>') +
      t("login.builtByAContractor", '<div class="login-foot">Feito por empreiteiro, para empreiteiro.</div></aside>');
  }
  function setupView() {
    return '<div class="login">' + loginAside() + '<main class="login-main" id="conteudo">' + langSwitch("login-lang") + '<form class="login-card" id="setupForm">' +
      '<img class="login-logo-m only-light" src="brand/logo/bisey-lockup-horizontal-color.svg" alt="' + PRODUCT + '" width="82" height="34"><img class="login-logo-m only-dark" src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + PRODUCT + '" width="82" height="34">' +
      t("login.firstTimeSetupNew", '<div><h2>Primeiro acesso</h2><p class="muted">Banco de dados novo. Crie agora o login do administrador (você). Os funcionários você cadastra depois, dentro do app.</p></div>') +
      t("login.yourName", '<label class="field"><span>Seu nome</span><input type="text" id="suName" required></label>') +
      t("login.usernameToSignIn", '<label class="field"><span>Usuário (para entrar)</span><input type="text" id="suUser" autocapitalize="none" autocomplete="username" required placeholder="ex.: bruno"></label>') +
      t("login.passwordAtLeast6", '<label class="field"><span>Senha (mínimo 6)</span><input type="password" id="suPass" autocomplete="new-password" minlength="6" required></label>') +
      t("login.createAdminAndSign", '<div class="err" id="suErr" role="alert" hidden></div><button class="btn lg block" type="submit">Criar administrador e entrar</button></form></main></div>');
  }
  function loginView() {
    if (S.setup) return setupView();
    var co = companyBrand(S.company), emp = S.company === "bluestar" ? "pedro" : "joao";
    return '<div class="login">' + loginAside() + '<main class="login-main" id="conteudo">' + langSwitch("login-lang") + '<form class="login-card" id="loginForm" novalidate>' +
      '<img class="login-logo-m only-light" src="brand/logo/bisey-lockup-horizontal-color.svg" alt="' + PRODUCT + '" width="82" height="34"><img class="login-logo-m only-dark" src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + PRODUCT + '" width="82" height="34">' +
      (EXT.signupView ? '<div class="auth-tabs" role="tablist" aria-label="' + esc(t("auth.tabs", "Entrar ou criar conta")) + '"><button type="button" role="tab" aria-selected="true" class="on">' + esc(t("auth.signin", "Entrar")) + '</button><button type="button" role="tab" aria-selected="false" data-act="signupStart">' + esc(t("auth.signup", "Criar conta")) + "</button></div>" : "") +
      t("login.signInUseThe", '<div><h2>Entrar</h2><p class="muted">Use o usuário e a senha que o administrador da sua empresa criou.</p></div>') +
      '<div class="login-co">' + coLogo(co) + '<span><b>' + esc(co.name) + "</b><span>" + esc(tradeLabel(co.trade)) + "</span></span></div>" +
      t("login.username", '<label class="field"><span>Usuário</span><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>') +
      t("login.password", '<label class="field"><span>Senha</span><span class="pw"><input type="password" id="lgPass" autocomplete="current-password" required><button type="button" class="pw-eye" data-act="pwToggle" aria-label="Mostrar senha">') + ic("eye") + "</button></span></label>" +
      '<div class="err" id="lgErr" role="alert" hidden></div>' +
      t("login.signIn", '<button class="btn lg block" type="submit">Entrar</button>') +
      (API.mode === "demo" ? t("login.demoModeSampleData", '<div class="login-demo"><div><b>Modo demonstração.</b> Dados de exemplo, salvos só neste aparelho.</div>') +
        t("login.adminBruno1234Employee", '<div class="login-hint">Administrador: <b>bruno</b> / 1234 · Funcionário: <b>') + emp + "</b> / 1234" + (S.company === "eternity" ? " · " + esc(t("login.managerHint", "Gerente")) + ": <b>carla</b> / 1234" : "") + "</div>" +
        t("login.signInAsOwner", '<div class="row"><button type="button" class="btn ghost" data-act="demoLogin" data-id="bruno">Entrar como dono</button><button type="button" class="btn ghost" data-act="demoLogin" data-id="') + emp + t("login.asEmployee", '">Como funcionário</button>') +
        (S.company === "eternity" ? '<button type="button" class="btn ghost" data-act="demoLogin" data-id="carla">' + esc(t("login.asManager", "Como gerente")) + "</button>" : "") + "</div></div>"
        : t("login.forgotYourPasswordAsk", '<div class="login-hint">Esqueceu a senha? Peça ao administrador para criar uma nova.</div>')) +
      (EXT.signupView ? '<div class="login-new">' + esc(t("auth.noAccount", "Ainda não usa o Bisey?")) + ' <button type="button" class="link-btn" data-act="signupStart">' + esc(t("auth.createTrial", "Criar conta · 14 dias grátis")) + "</button></div>" : "") +
      '<div class="login-powered">' + esc(PRODUCT) + t("login.constructionManagement", " · gestão de obras</div></form></main></div>");
  }

  // ═══════════ navegação (agrupada) ═══════════
  var ADMIN_GROUPS = [
    [t("nav.today", "Hoje"), [["dashboard", t("nav.dashboard", "Painel"), "dash"], ["agenda", t("nav.calendar", "Agenda"), "calendar"], ["avisos", t("nav.notices", "Avisos"), "bell"]]],
    [t("nav.jobs", "Obras"), [["projects", t("nav.projects", "Projetos"), "folder"], ["escala", t("nav.schedule", "Escala"), "pin"]]],
    [t("nav.sales", "Vendas"), [["proposals", t("nav.estimates", "Propostas"), "doc"], ["prices", t("nav.prices", "Preços"), "tag"]]],
    [t("nav.team", "Equipe"), [["time", t("nav.timeClock", "Ponto"), "clock"], ["team", t("nav.team", "Equipe"), "team"]]],
    [t("nav.finance", "Finanças"), [["gastos", t("nav.expenses", "Despesas"), "money"], ["notas", t("nav.receipts", "Notas"), "receipt"], ["reports", t("nav.reports", "Relatórios"), "report"], ["impostos", t("nav.taxes", "Impostos"), "percent"]]],
    [t("nav.account", "Conta"), [["settings", t("nav.settings", "Configurações"), "gear"], ["indicar", t("nav.refer", "Indique e ganhe"), "gift"]]]
  ];
  // menu do escritório filtrado pelo papel (o gerente não vê Despesas, Relatórios, Equipe nem Configurações)
  function groupsFor(role) {
    return ADMIN_GROUPS.map(function (g) { return [g[0], g[1].filter(function (n) { var p = VIEW_PERM[n[0]]; return !p || role === "admin" || !!(PERMS[role] || {})[p]; })]; }).filter(function (g) { return g[1].length; });
  }
  function staffGroups() { return groupsFor(roleOf() || "admin"); }
  var EMP_GROUPS = [
    [t("nav.myDay", "Meu dia"), [["punch", t("nav.timeClock", "Ponto"), "clock"], ["escala", t("nav.schedule", "Escala"), "pin"]]],
    [t("nav.work", "Trabalho"), [["jobs", t("nav.jobs", "Obras"), "folder"], ["notas", t("nav.receipts", "Notas"), "receipt"]]],
    [t("nav.account2", "Conta"), [["me", t("nav.profile", "Perfil"), "user"]]]
  ];
  function flat(groups) { return groups.reduce(function (a, g) { return a.concat(g[1]); }, []); }
  var ADMIN_NAV_BASE = flat(ADMIN_GROUPS);
  var ADMIN_NAV = ADMIN_NAV_BASE;
  var EMP_NAV = flat(EMP_GROUPS);
  function allNav() { return S.user && !isStaff() ? EMP_NAV : flat(staffGroups()); }
  function navActive(v) { var map = { project: "projects", projectForm: "projects", proposalForm: "proposals", hours: "dashboard" }; if (S.user && !isStaff() && v === "project") return "jobs"; if (S.user && !isStaff() && v === "myexp") return "me"; return map[v] || v; }
  function navCount(id) { return id === "avisos" && S.user && isStaff() ? openNotices().length : 0; }
  function helpBtn(cls) { return '<button type="button" class="icon-btn ' + (cls || "") + '" data-act="help" aria-label="' + esc(t("help.open", "Ajuda (tecla ?)")) + '" title="' + esc(t("help.title", "Ajuda")) + '">' + ic("help") + "</button>"; }
  function navLabel(n) { var c = navCount(n[0]); return '<span class="nav-l">' + esc(n[1]) + "</span>" + (c ? '<span class="nav-badge" aria-label="' + esc(tn("nav.openCount", c, "1 aberto", "{n} abertos")) + '">' + c + "</span>" : ""); }
  function navBtn(n, cur) { return '<button type="button" data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ic(n[2]) + navLabel(n) + "</button>"; }
  function navGroups(groups, cur) { return groups.map(function (g) { return '<div class="nav-group">' + esc(g[0]) + "</div>" + g[1].map(function (n) { return navBtn(n, cur); }).join(""); }).join(""); }
  function coSwitch() { return ""; } // compat: o seletor agora é o cartão da empresa (coCard)
  function coCard(coId, canSwitch, compact) {
    var b = companyBrand(coId), inner = coLogo(b) + '<span class="co-txt"><b>' + esc(b.name) + "</b>" + (compact ? "" : "<span>" + esc(tradeLabel(b.trade)) + "</span>") + "</span>";
    if (!canSwitch || API.companies.length < 2) return '<div class="co" title="' + esc(b.name) + '">' + inner + "</div>";
    return t("common.html", '<details class="dd co-dd"><summary class="co" aria-label="Trocar empresa">') + inner + ic("chevd", 18, "chev") + '</summary><div class="dd-menu" role="menu">' +
      API.companies.map(function (c) { var x = companyBrand(c.id); return '<button type="button" role="menuitem" data-act="company" data-id="' + c.id + '" class="' + (c.id === coId ? "on" : "") + '">' + coLogo(x) + esc(x.name) + "</button>"; }).join("") + "</div></details>";
  }
  // ═══════════ idioma (por pessoa) ═══════════
  function speechLang() { return NV.locale(); } // pt-BR / en-US / es-US
  // troca o idioma: grava no perfil (quando há login) e neste aparelho, e recarrega voltando para a mesma tela
  function setLang(l) {
    if (!l || l === LANG) return;
    var resume = S.user ? { view: S.view, params: S.params } : S.signup ? { signup: 1 } : null;
    if (!S.user) { try { sessionStorage.setItem("bisey_lang_explicit", "1"); } catch (e) {} }
    var loc = l === "en" ? "en-US" : l === "es" ? "es-US" : "pt-BR";
    var save = S.user && API.setLocale ? API.setLocale(loc).catch(function () {}) : Promise.resolve();
    EXT.beforeReload.forEach(function (f) { try { f(); } catch (e) {} }); // rascunhos guardados antes de recarregar (voltam abertos no outro idioma)
    save.then(function () { NV.setLang(l, resume); });
  }
  // seletor compacto PT | EN (tela de entrar, menu do usuário, configurações)
  function langSwitch(cls) {
    return '<div class="lang-sw ' + (cls || "") + '" role="group" aria-label="' + esc(t("lang.label", "Idioma")) + '">' + NV.langs.map(function (x) {
      return '<button type="button" data-act="setLang" data-id="' + x[0] + '" class="' + (x[0] === LANG ? "on" : "") + '" aria-pressed="' + (x[0] === LANG) + '" lang="' + NV.langTag(x[0]) + '" title="' + esc(x[1]) + '">' + x[0].toUpperCase() + "</button>";
    }).join("") + "</div>";
  }
  function themeBtn(cls) { var dark = currentTheme() === "dark"; return '<button type="button" class="icon-btn ' + (cls || "") + '" data-act="theme" aria-label="' + (dark ? t("nav.useLightTheme", "Usar tema claro") : t("nav.useDarkTheme", "Usar tema escuro")) + '" title="' + (dark ? t("nav.lightTheme", "Tema claro") : t("nav.darkTheme", "Tema escuro")) + '">' + ic(dark ? "sun" : "moon") + "</button>"; }
  function sideFoot(roleLabel) {
    return '<div class="side-foot"><span class="avatar" aria-hidden="true">' + esc(initials(S.user.name)) + '</span><span class="who"><b>' + esc(S.user.name) + "</b>" + esc(roleLabel) + "</span>" +
      themeBtn("nav-ib") + t("nav.html", '<button type="button" class="icon-btn nav-ib" data-act="logout" aria-label="Sair" title="Sair">') + ic("logout") + "</button></div>" +
      '<div class="side-lang"><span>' + esc(t("lang.label", "Idioma")) + "</span>" + langSwitch("nav-ib") + "</div>" +
      installBtn() + t("nav.madeWithImgSrc", '<div class="powered">feito com <img src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="') + PRODUCT + '" width="80" height="33"></div>';
  }
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  function searchBtn() { return '<button type="button" class="search" data-act="search" aria-label="' + esc(t("nav.searchAria", "Buscar ({k} K)", { k: isMac ? "⌘" : "Ctrl" })) + '">' + ic("search", 18) + t("nav.searchJobEstimateCustomer", '<span class="search-l">Buscar obra, proposta, cliente ou ação</span><kbd>') + (isMac ? "⌘" : "Ctrl") + " K</kbd></button>"; }
  function bellBtn(cls) { var c = openNotices().length; return '<button type="button" class="icon-btn ' + (cls || "") + t("nav.dataActNavData", '" data-act="nav" data-id="avisos" aria-label="Avisos') + (c ? ": " + tn("nav.openCount", c, "1 aberto", "{n} abertos") : "") + '">' + ic("bell") + (c ? '<span class="count">' + c + "</span>" : "") + "</button>"; }
  // + Criar: usa só ações que já existem (newProject, pNew, notas, aviso, agenda, lançamento)
  var CREATE = [["newProject", "", t("nav.newProject", "Novo projeto"), "folder", t("nav.wizardWithTypeSpecs", "Assistente com tipo, ficha técnica, tarefas e valores")], ["pNew", "estimate", t("nav.newEstimate", "Nova proposta"), "mic", t("nav.sayWhatTheJob", "Fale o serviço e a proposta sai pronta")], ["pNew", "invoice", t("nav.newInvoice", "Novo invoice"), "doc", t("nav.billTheCustomer", "Cobrança para o cliente")],
    ["createNota", "", t("nav.newReceipt", "Nova nota (recibo)"), "camera", t("nav.receiptPhotoGoesInto", "Foto da nota entra na obra e no gasto")], ["noticeNew", "", t("nav.newNotice", "Novo aviso"), "bell", t("nav.messageFromAJob", "Recado de uma obra, com foto")], ["createEvent", "", t("nav.newAppointment", "Novo compromisso"), "calendar", t("nav.partnersCalendar", "Agenda dos sócios")], ["newExpense", "", t("nav.manualEntry", "Lançamento manual"), "money", t("nav.expenseOrPaymentReceived", "Despesa ou pagamento recebido")]];
  var CREATE_PERM = { newExpense: "finance" }; // lançamento manual (despesa/receita) é financeiro
  function createItems(cls) { return CREATE.filter(function (c) { return !CREATE_PERM[c[0]] || can(CREATE_PERM[c[0]]); }).map(function (c) { return '<button type="button" role="menuitem" class="' + (cls || "") + '" data-act="' + c[0] + '"' + (c[1] ? ' data-id="' + c[1] + '"' : "") + ">" + '<span class="mi-ic">' + ic(c[3]) + '</span><span class="mi-t"><b>' + esc(c[2]) + "</b><span>" + esc(c[4]) + "</span></span></button>"; }).join(""); }
  function createMenu() { return '<details class="dd create-dd"><summary class="btn">' + ic("plus") + t("nav.create", 'Criar</summary><div class="dd-menu wide" role="menu">') + createItems() + "</div></details>"; }

  // ═══════════ admin shell ═══════════
  function adminShell() {
    var cur = navActive(S.view);
    var side = t("nav.sidebarAria", '<aside class="sidebar" aria-label="Menu principal">') + coCard(S.company, true) + '<nav class="nav">' + navGroups(staffGroups(), cur) + "</nav>" + sideFoot(roleLabel()) + "</aside>";
    var top = '<header class="topbar">' + searchBtn() + '<span class="sp"></span>' + helpBtn() + bellBtn() + createMenu() + "</header>";
    var mtop = '<header class="m-top">' + coCard(S.company, true, true) + t("common.html2", '<span class="sp"></span><button type="button" class="icon-btn" data-act="search" aria-label="Buscar">') + ic("search") + "</button>" + helpBtn() + bellBtn() + "</header>";
    var mcur = { dashboard: "dashboard", projects: "projects", time: "time" }[cur] || "more";
    var bn = function (id, label, icon) { return '<button type="button" data-act="nav" data-id="' + id + '" class="' + (mcur === id ? "on" : "") + '"' + (mcur === id ? ' aria-current="page"' : "") + ">" + ic(icon, 24) + "<span>" + label + "</span></button>"; };
    var c = openNotices().length;
    var mob = '<nav class="bottom-nav" aria-label="Menu">' + bn("dashboard", t("nav.home", "Início"), "home") + bn("projects", t("nav.jobs", "Obras"), "folder") +
      '<button type="button" class="plus" data-act="sheet" data-id="create" aria-label="' + esc(t("nav.createAria", "Criar")) + '"><span class="fab">' + ic("plus", 24) + t("nav.create2", "</span><span>Criar</span></button>") + bn("time", t("nav.timeClock", "Ponto"), "clock") +
      '<button type="button" data-act="sheet" data-id="more" class="' + (mcur === "more" ? "on" : "") + '">' + ic("grid", 24) + t("nav.more", "<span>Mais</span>") + (c ? '<span class="nav-badge">' + c + "</span>" : "") + "</button></nav>";
    var body = Object.assign({ dashboard: can("finance") ? dashboardView : managerDashboardView, gastos: gastosView, hours: hoursView, notas: notasView, avisos: avisosView, agenda: agendaView, escala: escalaView, projects: projectsView, project: projectView, projectForm: wizardView, time: timeView, team: teamView, reports: reportsView }, EXT.views)[S.view] || dashboardView;
    if (!canView(S.view)) body = noAccessView; // guarda central: o gerente não abre telas financeiras nem Configurações, nem por busca/atalho
    return '<div class="shell">' + side + '<div class="main">' + top + mtop + '<main class="content" id="conteudo" tabindex="-1">' + demoFlag() + (S.loading ? skeletonView() : body()) + "</main></div></div>" + mob;
  }
  function noAccessView() {
    return '<div class="page-head"><div><h1>' + esc(t("noAccess.title", "Sem acesso")) + "</h1></div></div>" +
      emptyState({ icon: "lock", title: t("noAccess.head", "Esta tela é só do administrador"), text: t("noAccess.text", "Valores financeiros da empresa e Configurações ficam com o dono. Fale com ele se precisar."), cta: { act: "nav", id: "dashboard", label: t("noAccess.back", "Voltar ao painel"), icon: "chevl" } });
  }
  function offlineFlag() { return S.offline ? '<div class="demo-flag">' + ic("info", 18) + t("nav.offlineShowingDataSaved", "<span>Sem internet: mostrando os dados salvos em ") + fmtDate(S.offline) + " " + fmtTime(S.offline) + t("nav.theTimeClockKeeps", ". O ponto continua funcionando e é enviado quando a conexão voltar.</span></div>") : ""; }
  function demoFlag() { return offlineFlag() + (API.mode === "demo" ? '<div class="demo-flag">' + ic("eye", 18) + t("nav.demoModeProjectsAnd", '<span>Modo demonstração: os projetos e valores são exemplos e ficam salvos só neste aparelho.</span><button class="btn sm ghost" data-act="resetDemo">Restaurar exemplos</button></div>') : ""); }
  function installBtn() { return S.installEvt ? '<button type="button" class="side-install" data-act="install">' + ic("install", 18) + t("nav.installTheApp", "Instalar o app</button>") : ""; }

  // ═══════════ folhas e busca (overlays) ═══════════
  function overlayView() {
    if (!S.overlay || !S.user) return "";
    var admin = isStaff();
    if (S.overlay === "cmdk") {
      return t("nav.html2", '<div class="ov-bg cmdk-bg" data-act="ovBg"><div class="ov-panel cmdk" role="dialog" aria-modal="true" aria-label="Busca">') +
        '<div class="cmdk-in">' + ic("search") + t("nav.inputIdCmdkinputType", '<input id="cmdkInput" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list" placeholder="Buscar obra, proposta, cliente, funcionário ou ação" value="') + esc(S.cmdkQ || "") + '"><kbd>Esc</kbd></div>' +
        t("nav.html3", '<div id="cmdkList" class="cmdk-list" role="listbox" aria-label="Resultados"></div>') +
        t("nav.moveEnterOpenEsc", '<div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div></div></div>');
    }
    var body = "";
    if (S.overlay === "create") body = t("nav.create3", "<h2>Criar</h2>") + '<div class="sheet-list" role="menu">' + createItems("sheet-item") + "</div>";
    if (S.overlay === "more") {
      var cur = navActive(S.view);
      body = "<h2>Menu</h2>" + (admin ? staffGroups() : EMP_GROUPS).map(function (g) {
        return '<div class="sheet-group">' + esc(g[0]) + '</div><div class="sheet-grid">' + g[1].map(function (n) { var c = navCount(n[0]); return '<button type="button" data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '">' + ic(n[2], 24) + "<span>" + esc(n[1]) + "</span>" + (c ? '<span class="nav-badge">' + c + "</span>" : "") + "</button>"; }).join("") + "</div>";
      }).join("") +
        '<div class="sheet-foot"><span class="avatar" aria-hidden="true">' + esc(initials(S.user.name)) + '</span><span class="who"><b>' + esc(S.user.name) + "</b>" + esc(roleLabel()) + "</span>" + langSwitch() + themeBtn() + t("nav.html4", '<button type="button" class="icon-btn" data-act="logout" aria-label="Sair">') + ic("logout") + "</button></div>" + installBtn();
    }
    return '<div class="ov-bg sheet-bg" data-act="ovBg"><div class="ov-panel sheet" role="dialog" aria-modal="true" aria-label="' + (S.overlay === "create" ? t("nav.create4", "Criar") : "Menu") + '"><div class="grab" aria-hidden="true"></div>' +
      t("nav.html5", '<button type="button" class="x" data-act="ovClose" aria-label="Fechar">') + ic("x") + "</button>" + body + "</div></div>";
  }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function searchIndex() {
    var admin = isStaff(), items = [];
    allNav().forEach(function (n) { items.push({ type: t("search.goTo", "Ir para"), label: n[1], icon: n[2], act: "nav", id: n[0], kw: t("search.openScreenMenuGo", "abrir tela menu") }); });
    if (admin) {
      CREATE.forEach(function (c) { if (!CREATE_PERM[c[0]] || can(CREATE_PERM[c[0]])) items.push({ type: t("search.action", "Ação"), label: c[2], sub: c[4], icon: c[3], act: c[0], id: c[1], kw: t("search.createNewAddCriar", "criar novo nova") }); });
      if (can("finance")) items.push({ type: t("search.action", "Ação"), label: t("search.downloadTimesheetCsv", "Baixar CSV da folha de horas"), icon: "download", act: "csv", id: "payroll", kw: t("search.reportPayrollRelatorioPagamento", "relatorio pagamento") });
      if (can("team")) items.push({ type: t("search.action", "Ação"), label: t("search.newEmployee", "Novo funcionário"), icon: "team", act: "newUser", kw: t("search.createTeamUserCrew", "criar equipe usuario") });
    } else {
      items.push({ type: t("search.action", "Ação"), label: t("search.punchInOut", "Bater ponto"), sub: t("search.punchInOrOut", "Entrada ou saída com selfie e GPS"), icon: "clock", act: "nav", id: "punch", kw: t("search.punchClockInOut", "ponto entrada saida") });
    }
    items.push({ type: t("search.action", "Ação"), label: currentTheme() === "dark" ? t("search.useLightTheme", "Usar tema claro") : t("search.useDarkTheme", "Usar tema escuro"), icon: currentTheme() === "dark" ? "sun" : "moon", act: "theme", kw: t("search.themeDarkLightMode", "tema modo escuro claro dark light") });
    var projs = admin ? companyProjects() : S.projects, clients = {};
    projs.forEach(function (p) {
      items.push({ type: t("search.project", "Projeto"), label: p.name, sub: [p.client, p.address].filter(Boolean).join(" · "), icon: "folder", act: "openProject", id: p.id });
      if (p.client && !clients[norm(p.client)]) clients[norm(p.client)] = { type: t("search.customer", "Cliente"), label: p.client, sub: t("search.project2", "Projeto ") + p.name, icon: "user", act: "openProject", id: p.id };
    });
    if (admin) {
      (S.proposals || []).filter(function (p) { return p.companyId === S.company; }).forEach(function (p) {
        var cn = (p.client || {}).name || "";
        items.push({ type: p.docType === "invoice" ? "Invoice" : t("search.estimate", "Proposta"), label: (p.number ? p.number + " · " : "") + (cn || t("search.noCustomer", "Sem cliente")), sub: [p.status, money(p.total), (p.client || {}).address].filter(Boolean).join(" · "), icon: "doc", act: "pOpen", id: p.id, kw: p.subtitle });
        if (cn && !clients[norm(cn)]) clients[norm(cn)] = { type: t("search.customer", "Cliente"), label: cn, sub: t("search.estimate2", "Proposta ") + (p.number || ""), icon: "user", act: "pOpen", id: p.id };
      });
      if (can("team")) S.users.filter(function (u) { return u.companyId === S.company || u.role === "admin"; }).forEach(function (u) { items.push({ type: t("search.employee", "Funcionário"), label: u.name, sub: roleLabel(u) + " · " + u.username, icon: "user", act: "editUser", id: u.id }); });
    }
    items.push({ type: t("search.action", "Ação"), label: t("help.title", "Ajuda"), sub: t("help.searchSub", "Perguntas comuns, atalhos e tour"), icon: "help", act: "help", kw: t("search.helpFaqTourShortcuts", "ajuda duvida tour atalhos suporte") });
    Object.keys(clients).forEach(function (k) { items.push(clients[k]); });
    return items;
  }
  function searchFind(q) {
    var all = searchIndex(), toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return all.filter(function (x) { return x.type === "Ação" || x.type === "Projeto"; }).slice(0, 12);
    var order = { "Projeto": 0, "Proposta": 1, "Invoice": 1, "Cliente": 2, "Funcionário": 3, "Ação": 4, "Ir para": 5 };
    return all.map(function (x) {
      var hay = norm([x.label, x.sub, x.type, x.kw].join(" ")), lab = norm(x.label);
      if (!toks.every(function (t) { return hay.indexOf(t) >= 0; })) return null;
      var score = (lab.indexOf(toks[0]) === 0 ? 0 : lab.indexOf(toks[0]) > 0 ? 1 : 2) * 10 + (order[x.type] || 0);
      return { x: x, s: score };
    }).filter(Boolean).sort(function (a, b) { return a.s - b.s; }).slice(0, 30).map(function (r) { return r.x; });
  }
  function cmdkUpdate() {
    var inp = $("#cmdkInput"), list = $("#cmdkList"); if (!inp || !list) return;
    S.cmdkQ = inp.value; var res = searchFind(inp.value); S.cmdkRes = res; if (S.cmdkSel == null || S.cmdkSel >= res.length) S.cmdkSel = 0;
    if (!res.length) { list.innerHTML = '<div class="cmdk-empty">' + ic("search", 24) + t("search.nothingFoundTryThe", "<b>Nada encontrado</b><span>Tente o nome da obra, do cliente, o número da proposta ou uma ação (ex.: “nova proposta”).</span></div>"); inp.removeAttribute("aria-activedescendant"); return; }
    var last = "";
    list.innerHTML = res.map(function (x, i) {
      var h = x.type !== last ? '<div class="cmdk-type" role="presentation">' + esc(x.type) + "</div>" : ""; last = x.type;
      return h + '<div class="cmdk-item' + (i === S.cmdkSel ? " on" : "") + '" role="option" id="cmdk-' + i + '" data-i="' + i + '" aria-selected="' + (i === S.cmdkSel) + '">' + ic(x.icon || "arrow") + '<span class="ci-t"><b>' + esc(x.label) + "</b>" + (x.sub ? "<span>" + esc(x.sub) + "</span>" : "") + "</span>" + ic("chevr", 16, "ci-go") + "</div>";
    }).join("");
    inp.setAttribute("aria-activedescendant", "cmdk-" + S.cmdkSel);
  }
  function cmdkMove(d) { var n = (S.cmdkRes || []).length; if (!n) return; S.cmdkSel = (S.cmdkSel + d + n) % n; cmdkUpdate(); var on = $("#cmdk-" + S.cmdkSel); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" }); }
  function runAct(act, id) {
    var fn = A[act] || EXT.actions[act]; if (!fn) return;
    var el = document.createElement("button"); el.dataset.act = act; if (id) el.dataset.id = id;
    fn(el, { target: el });
  }
  function cmdkRun(i) { var x = (S.cmdkRes || [])[i]; if (!x) return; S.overlay = null; S.cmdkQ = ""; render(); runAct(x.act, x.id); }
  function openSearch() { if (S.modal) S.modal = null; S.overlay = "cmdk"; S.cmdkQ = ""; S.cmdkSel = 0; render(); }

  // ═══════════ estados: vazio, carregando, nível ═══════════
  // emptyState({ icon, title, text, cta: { act, id, label, icon } | html })
  function emptyState(o) {
    var cta = o.cta ? (typeof o.cta === "string" ? o.cta : '<button type="button" class="btn ' + (o.cta.primary ? "" : "ghost") + ' sm" data-act="' + o.cta.act + '"' + (o.cta.id ? ' data-id="' + esc(o.cta.id) + '"' : "") + ">" + ic(o.cta.icon || "plus", 18) + esc(o.cta.label) + "</button>") : "";
    return '<div class="empty-state' + (o.bare ? "" : " panel") + '"><span class="em-ic">' + ic(o.icon || "info", 26) + "</span><b>" + esc(o.title) + "</b>" + (o.text ? '<span class="small">' + esc(o.text) + "</span>" : "") + cta + "</div>";
  }
  function emptyRow(cols, text) { return '<tr><td colspan="' + cols + '" class="empty-row">' + esc(text) + "</td></tr>"; }
  function skeletonView() {
    var k = '<div class="kpi sk-kpi"><span class="sk" style="width:55%;height:12px"></span><span class="sk" style="width:70%;height:26px;margin-top:10px"></span><span class="sk" style="width:85%;height:10px;margin-top:10px"></span></div>';
    var r = '<div class="sk-row"><span class="sk" style="width:30%"></span><span class="sk" style="width:15%"></span><span class="sk" style="width:20%"></span></div>';
    return '<div class="page-head" aria-busy="true" aria-label="Carregando"><div><span class="sk" style="display:block;width:180px;height:28px"></span><span class="sk" style="display:block;width:280px;height:14px;margin-top:10px"></span></div></div>' +
      '<div class="kpis">' + k + k + k + k + '</div><div class="panel" style="margin-top:24px">' + r + r + r + "</div>";
  }
  // Barra de nível (assinatura da marca): trilho + preenchimento + bolha na posição atual. p em %.
  function level(p, o) {
    o = o || {}; p = Number(p) || 0;
    var over = p > 100, w = Math.max(0, Math.min(100, p)), color = o.color || (over ? "var(--bad)" : "var(--accent)");
    return '<div class="level' + (o.sm ? " sm" : "") + (over ? " over" : "") + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(p, 999)) + '" aria-label="' + esc(o.label || fmtPct(p)) + '">' +
      '<span class="fill" style="width:' + w + "%;background:" + color + '"></span>' + (o.bubble === false ? "" : '<span class="bubble" style="left:' + w + "%;border-color:" + color + '"></span>') + "</div>";
  }
  function miniLevel(p, color) { return '<span class="mini">' + level(p, { sm: true, bubble: false, color: color }) + '<span class="num">' + fmtPct(p) + "</span></span>"; }

  // ═══════════ filters ═══════════
  function filtersBar(opts) {
    opts = opts || {};
    var f = S.filters;
    var presets = [["all", t("dashboard.allTime", "Desde o início")], ["today", t("dashboard.today", "Hoje")], ["this_week", t("dashboard.thisWeek", "Esta semana")], ["last_week", t("dashboard.lastWeek", "Semana passada")], ["this_month", t("dashboard.thisMonth", "Este mês")], ["last_month", t("dashboard.lastMonth", "Mês passado")], ["custom", t("dashboard.custom", "Personalizado")]];
    var emps = S.users.filter(function (u) { return u.companyId === S.company && !isStaff(u); });
    var fsel = function (label, inner, on) { return '<label class="fsel' + (on ? " on" : "") + '"><span>' + label + "</span>" + inner + ic("chevd", 16, "fsel-chev") + "</label>"; };
    return '<div class="filters" role="group" aria-label="' + esc(t("dashboard.filtersAria", "Filtros")) + '">' +
      fsel(t("dashboard.period", "Período"), '<select data-filter="preset">' + presets.map(function (p) { return '<option value="' + p[0] + '"' + (f.preset === p[0] ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select>", f.preset !== "all") +
      (f.preset === "custom" ? t("dashboard.fromInputTypeDate", '<label class="fsel date"><span>De</span><input type="date" data-filter="from" value="') + esc(f.from) + t("dashboard.toInputTypeDate", '"></label><label class="fsel date"><span>Até</span><input type="date" data-filter="to" value="') + esc(f.to) + '"></label>' : "") +
      fsel(t("dashboard.project", "Projeto"), t("dashboard.allProjects", '<select data-filter="projectId"><option value="">Todos os projetos</option>') + companyProjects().map(function (p) { return '<option value="' + p.id + '"' + (f.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select>", !!f.projectId) +
      (opts.noUser ? "" : fsel(t("dashboard.employee", "Funcionário"), t("dashboard.allEmployees", '<select data-filter="userId"><option value="">Todos os funcionários</option>') + emps.map(function (u) { return '<option value="' + u.id + '"' + (f.userId === u.id ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select>", !!f.userId)) +
      "</div>";
  }
  function periodLabel() { var f = S.filters; if (f.preset === "all") return t("dashboard.allTime2", "desde o início"); return fmtDate(f.from) + t("common.to", " a ") + fmtDate(f.to); }

  // ═══════════ dashboard ═══════════
  function kpi(o) {
    var tag = o.act ? "button" : "div";
    return "<" + tag + ' class="kpi' + (o.wide ? " wide" : "") + (o.act ? " is-link" : "") + '"' + (o.act ? ' type="button" data-act="' + o.act + '" data-id="' + (o.id || "") + '"' : "") + ">" +
      '<span class="kpi-label">' + esc(o.label) + "</span>" + (o.noRing ? "<span></span>" : ring(o.pct, 48, Object.assign({ stroke: 5, fontSize: 11 }, o.ringOpts || {}))) +
      '<span class="kpi-value ' + (o.cls || "") + '">' + o.value + "</span>" +
      '<span class="kpi-sub">' + (o.levelHtml || "") + o.sub + "</span>" + (o.act ? t("dashboard.seeDetails", '<span class="kpi-go">Ver detalhes') + ic("chevr", 14) + "</span>" : "") + "</" + tag + ">";
  }
  function limitLine(spent, limit) { return limit > 0 ? fmtPct(pct(spent, limit)) + t("dashboard.ofTheLimitOf", " do limite de ") + money(limit) : t("dashboard.noLimitSet", "sem limite definido"); }
  function dashboardView() {
    var m = metrics(), P = m.period, A = m.all, f = S.filters;
    var sel = f.projectId ? projectById(f.projectId) : null;
    var margin = P.revenue > 0 ? pct(P.profit, P.revenue) : 0;
    var progress = pct(m.tDone, m.tAll);

    // contexto (antes era o banner escuro): projeto selecionado ou todos, período, orçamento e limite
    var ctx = '<div class="ctx" aria-label="' + esc(t("dashboard.summaryAria", "Resumo")) + '">' +
      '<div><div class="k">' + (sel ? t("dashboard.selectedProject", "Projeto selecionado") : t("dashboard.projects", "Projetos")) + '</div><div class="v">' + (sel ? "1" : m.scope.length) + "</div></div>" +
      t("dashboard.contractValue", '<div><div class="k">Valor dos contratos</div><div class="v">') + money(m.contract) + "</div></div>" +
      "</div>";
    var head = t("dashboard.dashboardOverviewOfYour", '<div class="page-head"><div><h1>Painel</h1><p>Visão geral das obras, gastos e progresso</p>') +
      '<p class="ctx-line">' + ic(sel ? "folder" : "grid", 16) + "<b>" + esc(sel ? sel.name : t("dashboard.allProjects2", "Todos os projetos")) + "</b>" + (sel ? '<span class="muted"> · ' + esc([sel.client, sel.address].filter(Boolean).join(" · ")) + "</span>" : "") + t("dashboard.period2", '<span class="muted"> · Período: ') + periodLabel() + "</span>" +
      (sel ? ' <button type="button" class="btn quiet sm" data-act="openProject" data-id="' + sel.id + t("dashboard.openProject", '">Abrir projeto') + ic("chevr", 14) + "</button>" : "") + "</p></div>" + ctx + "</div>";

    var hoursRing = m.labBudget > 0 ? pct(P.labor, m.labBudget) : pct(P.hours, m.estHours);
    var cards = t("dashboard.html2", '<section class="kpis" aria-label="Indicadores do período">') +
      kpi({ label: t("dashboard.hoursWorked", "Horas trabalhadas"), value: hrs(P.hours), cls: "v-info", sub: t("dashboard.labor", "Mão de obra ") + money(P.labor) + ", " + (m.labBudget > 0 ? limitLine(P.labor, m.labBudget) : t("dashboard.ofEstHours", "das {h} previstas", { h: hrs(m.estHours) })), pct: hoursRing, act: "hours" }) +
      kpi({ label: "Material", value: money(P.byCat.material), sub: limitLine(P.byCat.material, m.matBudget), pct: pct(P.byCat.material, m.matBudget), act: "gastos", id: "material" }) +
      kpi({ label: t("dashboard.expenses", "Despesas"), value: money(P.exp), cls: "v-bad", sub: (m.contract > 0 ? fmtPct(pct(P.exp, m.contract)) + t("dashboard.ofContractValue", " do orçamento") + " · " : "") + t("dashboard.materialPermitsEquipmentAnd", "Material, permit, equipamento e outros"), pct: pct(P.exp, m.contract), ringOpts: { color: "var(--c1)" }, act: "gastos", id: "material" }) +
      kpi({ label: t("dashboard.totalCost", "Custo total"), value: money(P.cost), cls: "v-bad", sub: t("dashboard.laborExpenses", "Mão de obra + despesas, ") + limitLine(P.cost, m.budget), pct: pct(P.cost, m.budget) }) +
      kpi({ label: t("dashboard.revenueReceived", "Receita recebida"), value: money(P.revenue), cls: "v-good", sub: fmtPct(pct(P.revenue, m.contract)) + t("dashboard.ofContractValue", " do orçamento"), pct: pct(P.revenue, m.contract), ringOpts: { color: "var(--good)" } }) +
      kpi({ label: t("dashboard.grossProfit", "Lucro bruto"), value: money(P.profit), cls: P.profit >= 0 ? "v-good" : "v-bad", sub: t("dashboard.revenueTotalCost", "Receita − custo total"), pct: Math.abs(margin), ringOpts: { color: P.profit >= 0 ? "var(--good)" : "var(--bad)", text: fmtPct(margin) } }) +
      kpi({ label: sel ? t("dashboard.jobProgress", "Progresso da obra") : t("dashboard.jobsProgress", "Progresso das obras"), value: fmtPct(progress), wide: true, noRing: true, levelHtml: level(progress, { sm: true, bubble: false, color: "var(--info)", label: fmtPct(progress) + t("dashboard.ofTasksCompleted", " das tarefas concluídas") }), sub: m.tDone + t("common.of", " de ") + m.tAll + t("dashboard.tasksCompleted", " tarefas concluídas"), pct: progress, act: sel ? "openProject" : "nav", id: sel ? sel.id : "projects" }) +
      "</section>";

    // Orçamento e limites (sempre acumulado da obra) — barra de nível no lugar do anel grande
    var used = pct(A.cost, m.budget), remaining = m.budget - A.cost;
    var side = function (label, spent, limit, act, id) {
      var p = pct(spent, limit);
      return '<button type="button" class="ls-row" data-act="' + act + '" data-id="' + (id || "") + '"><span class="k"><span>' + label + '</span><span class="num">' + (limit > 0 ? fmtPct(p) : "") + "</span></span>" +
        '<span class="v">' + money(spent) + "</span>" + level(p, { sm: true, bubble: false, label: label + ": " + fmtPct(p) + t("dashboard.ofTheLimit", " do limite") }) +
        '<span class="s">' + (limit > 0 ? t("common.ofStart", "de ") + money(limit) + t("dashboard.leftAmount", ", restam {m}", { m: money(limit - spent) }) : t("dashboard.setTheLimitIn", "defina o limite em Editar → Valores")) + "</span></button>";
    };
    var budget = t("dashboard.budgetAndSpendingLimits", '<div class="section-title"><h2>Orçamento e limites de gasto</h2><span class="muted">Acumulado da obra, independente do período</span></div>') +
      '<section class="panel"><div class="limit"><div>' +
      t("dashboard.spentSoFarOn", '<div class="muted small">Gasto até agora em ') + esc(sel ? sel.name : t("dashboard.allProjects3", "todos os projetos")) + "</div>" +
      '<div class="limit-big">' + money(A.cost) + "<small>" + t("common.ofStart", "de ") + money(m.budget) + "</small></div>" +
      level(used, { label: fmtPct(used) + t("dashboard.ofTheSpendingLimit", " do limite de gastos") }) +
      '<div class="level-scale"><span>$0</span><span>' + fmtPct(used) + t("dashboard.ofTheSpendingLimit2", " do limite de gastos</span><span>") + money(m.budget) + "</span></div>" +
      t("dashboard.contract", '<div class="muted small" style="margin-top:12px">Orçamento <b class="num ink">') + money(m.contract) + t("dashboard.spendingLimit2", '</b> · Limite de gastos <b class="num ink">') + money(m.budget) + "</b></div>" +
      '</div><div class="limit-side">' + side(t("dashboard.materialSpent", "Material gasto"), A.byCat.material, m.matBudget, "gastos", "material") + side(t("dashboard.laborHours", "Mão de obra (horas)"), A.labor, m.labBudget, "hours") + "</div></div>" +
      t("dashboard.leftInSpendingLimit", '<div class="limit-foot"><div><div class="muted small">Restante do limite de gastos</div><div class="limit-mid ') + (remaining >= 0 ? "v-good" : "v-bad") + '">' + money(remaining) + t("dashboard.spentSoFar", '</div><div class="muted small">Gasto até agora ') + money(A.cost) + "</div></div>" +
      t("dashboard.projectedProfitContractSpent", '<div><div class="muted small">Lucro previsto (orçamento − gasto até agora)</div><div class="limit-mid">') + money(m.contract - A.cost) + t("dashboard.receivedSoFar", '</div><div class="muted small">Recebido até agora: ') + money(A.revenue) + " (" + fmtPct(pct(A.revenue, m.contract)) + ")</div></div></div></section>";

    var catRows = EXPENSE_CATS.map(function (c) { return { id: c.id, label: c.label, value: P.byCat[c.id] || 0, color: c.color, act: "gastos", swatch: true }; }).filter(function (r) { return r.value > 0; });
    var userRows = Object.keys(P.byUser).map(function (id) { return { id: id, label: userName(id), value: P.byUser[id].hours, color: "var(--c2)" }; }).sort(function (a, b) { return b.value - a.value; });
    var sumCat = catRows.reduce(function (a, r) { return a + r.value; }, 0), sumH = userRows.reduce(function (a, r) { return a + r.value; }, 0);
    var breakdown = t("dashboard.whereTheMoneyWent", '<div class="section-title"><h2>Para onde foi o dinheiro</h2><span class="muted">') + periodLabel() + "</span></div>" +
      t("dashboard.expensesByCategory", '<div class="grid2"><section class="panel"><div class="panel-head"><h3>Despesas por categoria</h3><span class="muted num">') + money(sumCat, 2) + "</span></div>" + bars(catRows, money) + t("dashboard.hoursByEmployee", '</section><section class="panel"><div class="panel-head"><h3>Horas por funcionário</h3><span class="muted num">') + hrs(sumH) + "</span></div>" + bars(userRows, hrs) + "</section></div>" +
      t("dashboard.jobsProgressAndSpending", '<div class="section-title"><h2>Obras: progresso e gastos</h2><button type="button" class="link-btn" data-act="nav" data-id="projects">Ver todos os projetos</button></div>') + projectsTable();

    // legenda única: o que é orçamento e o que é limite de gastos (os anéis usam um ou outro)
    var legend = '<p class="small muted kpi-legend">' + esc(t("dashboard.legend", "Orçamento = valor da obra cobrado do cliente · Limite de gastos = quanto você planejou gastar. Os anéis mostram o % de um ou de outro, como diz cada cartão.")) + "</p>";
    return head + dashTop() + filtersBar() + cards + legend + budget + breakdown;
  }
  // cartões extras no topo do painel (checklist de primeiros passos, convite para o tour…)
  function dashTop() { return EXT.dashTop.map(function (f) { try { return f() || ""; } catch (e) { return ""; } }).join(""); }

  // Painel do gerente: o mesmo dia a dia (obras, horas, tarefas, avisos, quem está trabalhando), sem nenhum valor em dinheiro
  function managerDashboardView() {
    var m = metrics(), P = m.period, progress = pct(m.tDone, m.tAll), now = S.time.filter(function (x) { return x.companyId === S.company && !x.checkOut; });
    var active = companyProjects().filter(function (p) { return p.status === "Active"; }), open = openNotices();
    var head = '<div class="page-head"><div><h1>' + esc(t("mgr.title", "Painel")) + "</h1><p>" + esc(t("mgr.sub", "Obras, equipe e avisos de hoje")) + ' · <span class="muted">' + esc(t("mgr.role", "visão do gerente, sem valores financeiros")) + "</span></p></div></div>";
    var cards = '<section class="kpis" aria-label="' + esc(t("mgr.kpis", "Indicadores")) + '">' +
      kpi({ label: t("mgr.active", "Obras em andamento"), value: String(active.length), sub: t("mgr.total", "{n} no total", { n: companyProjects().length }), noRing: true, act: "nav", id: "projects" }) +
      kpi({ label: t("mgr.now", "Trabalhando agora"), value: String(now.length), cls: "v-good", sub: now.map(function (x) { return userName(x.userId).split(" ")[0]; }).join(", ") || t("mgr.nobody", "ninguém com ponto aberto"), noRing: true, act: "nav", id: "time" }) +
      kpi({ label: t("mgr.hours", "Horas trabalhadas"), value: hrs(P.hours), cls: "v-info", sub: periodLabel(), noRing: true, act: "nav", id: "time" }) +
      kpi({ label: t("mgr.notices", "Avisos abertos"), value: String(open.length), cls: open.length ? "v-bad" : "", sub: t("mgr.noticesSub", "reportados pela equipe"), noRing: true, act: "nav", id: "avisos" }) +
      kpi({ label: t("mgr.progress", "Progresso das obras"), value: fmtPct(progress), wide: true, noRing: true, levelHtml: level(progress, { sm: true, bubble: false, color: "var(--info)", label: fmtPct(progress) }), sub: t("mgr.tasks", "{d} de {a} tarefas concluídas", { d: m.tDone, a: m.tAll }), pct: progress, act: "nav", id: "projects" }) +
      "</section>";
    var list = companyProjects().filter(function (p) { return p.status !== "Cancelled"; });
    var table = list.length ? '<div class="table-wrap"><table class="wide"><thead><tr><th>' + esc(t("mgr.col.project", "Projeto")) + "</th><th>" + esc(t("mgr.col.status", "Status")) + '</th><th class="n">' + esc(t("mgr.col.hours", "Horas")) + '</th><th class="n">' + esc(t("mgr.col.progress", "Progresso")) + "</th></tr></thead><tbody>" +
      list.map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="openProject" data-id="' + p.id + '" tabindex="0"><td class="cell-main"><b>' + esc(p.name) + "</b><span>" + esc(p.address || p.client || "") + "</span></td><td>" + statusPill(p.status) + '</td><td class="n">' + hrs(s.hours) + '</td><td class="n">' + miniLevel(s.progress, "var(--info)") + "</td></tr>"; }).join("") + "</tbody></table></div>"
      : emptyState({ icon: "folder", title: t("mgr.noProjects", "Nenhuma obra ainda"), cta: { act: "newProject", label: t("mgr.newProject", "Criar primeira obra"), primary: true } });
    var notices = open.slice(0, 4);
    return head + dashTop() + filtersBar() + cards +
      '<div class="section-title"><h2>' + esc(t("mgr.projects", "Obras: progresso e horas")) + '</h2><button type="button" class="link-btn" data-act="nav" data-id="projects">' + esc(t("mgr.allProjects", "Ver todos os projetos")) + "</button></div>" + table +
      '<div class="section-title"><h2>' + esc(t("mgr.openNotices", "Avisos abertos")) + '</h2><button type="button" class="link-btn" data-act="nav" data-id="avisos">' + esc(t("mgr.allNotices", "Ver avisos")) + "</button></div>" +
      (notices.length ? '<div class="stack" style="gap:8px">' + notices.map(function (n) { return noticeCard(n, true); }).join("") + "</div>" : emptyState({ icon: "bell", title: t("mgr.noNotices", "Nenhum aviso aberto"), text: t("mgr.noNoticesText", "Quando alguém da equipe reportar algo numa obra, aparece aqui.") }));
  }
  function projectsTable() {
    var list = companyProjects().filter(function (p) { return p.status !== "Cancelled"; });
    if (!list.length) return emptyState({ icon: "folder", title: t("projects.noJobsYet", "Nenhuma obra ainda"), text: t("projects.addYourFirstJob", "Cadastre a primeira obra para acompanhar progresso e gastos aqui."), cta: { act: "newProject", label: t("projects.createYourFirstJob", "Criar primeira obra"), primary: true } });
    return t("projects.projectContractSpentProgress", '<div class="table-wrap"><table class="wide"><thead><tr><th>Projeto</th><th class="n">Orçamento</th><th class="n">Gasto</th><th class="n">Progresso</th><th class="n">Limite usado</th></tr></thead><tbody>') +
      list.map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="pickProject" data-id="' + p.id + '" tabindex="0"><td class="cell-main"><b>' + esc(p.name) + "</b><span>" + esc(p.address || p.client || "") + '</span></td><td class="n">' + money(s.contract) + '</td><td class="n">' + money(s.cost) + '</td><td class="n">' + miniLevel(s.progress, "var(--info)") + '</td><td class="n">' + miniLevel(pct(s.cost, s.budget)) + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
  }

  // ═══════════ horas trabalhadas da obra selecionada ═══════════
  function hoursView() {
    var f = S.filters, sel = f.projectId ? projectById(f.projectId) : null;
    var T = S.time.filter(function (t) { return t.companyId === S.company && (!f.projectId || t.projectId === f.projectId) && (!f.userId || t.userId === f.userId) && inPeriod(t.checkIn); });
    var hours = 0, cost = 0, by = {};
    T.forEach(function (t) { var h = hoursOf(t), c = h * (t.rate || 0); hours += h; cost += c; var u = by[t.userId] || (by[t.userId] = { hours: 0, cost: 0, days: {} }); u.hours += h; u.cost += c; u.days[isoLocal(new Date(t.checkIn))] = 1; });
    var fi = sel ? S.fin[sel.id] || {} : {};
    var rows = Object.keys(by).map(function (id) { return { id: id, name: userName(id), hours: by[id].hours, cost: by[id].cost, days: Object.keys(by[id].days).length }; }).sort(function (a, b) { return b.hours - a.hours; });
    var head = '<div class="page-head"><div>' + crumb("dashboard", t("dashboard.dashboard", "Painel"), t("dashboard.hoursWorked", "Horas trabalhadas")) + t("dashboard.hoursWorked2", '<h1>Horas trabalhadas</h1><p>') + (sel ? esc(sel.name) : t("dashboard.pickAJobBelow", "Escolha a obra abaixo para ver só as horas dela")) + " · " + periodLabel() + "</p></div></div>";
    return head + filtersBar() +
      '<div class="kpis" style="margin-bottom:14px">' +
      kpi({ label: t("hours.hours", "Horas"), value: hrs(hours), cls: "v-info", sub: sel && fi.estHours ? t("dashboard.ofEstHours", "das {h} previstas", { h: hrs(fi.estHours) }) : t("hours.inThePeriod", "no período"), pct: sel ? pct(hours, fi.estHours || 0) : 0 }) +
      kpi({ label: t("hours.labor", "Mão de obra"), value: money(cost), sub: sel ? limitLine(cost, fi.laborBudget || 0) : t("hours.allJobs", "todas as obras"), pct: sel ? pct(cost, fi.laborBudget || 0) : 0 }) +
      kpi({ label: t("hours.employees", "Funcionários"), value: String(rows.length), sub: t("hours.workedInThePeriod", "trabalharam no período"), pct: 100, ringOpts: { color: "var(--c2)", text: String(rows.length) } }) +
      "</div>" +
      t("hours.byEmployeeEmployeeDays", '<div class="panel" style="padding:0;margin-bottom:14px"><h3 style="padding:16px 16px 0">Por funcionário</h3><div style="overflow-x:auto"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Custo</th></tr></thead><tbody>') +
      (rows.length ? rows.map(function (r) { return "<tr><td>" + esc(r.name) + '</td><td class="n">' + r.days + '</td><td class="n">' + hrs(r.hours) + '</td><td class="n"><b>' + money(r.cost) + "</b></td></tr>"; }).join("") : emptyRow(4, t("hours.noHoursLogged", "Nenhuma hora registrada."))) +
      "</tbody></table></div></div>" +
      t("hours.timeEntries", '<div class="section-title"><h3>Registros de ponto</h3><span class="muted small">') + T.length + t("hours.entries", " registros</span></div>") + timeTable(T.slice(0, 300), true);
  }

  // ═══════════ despesas (por categoria) ═══════════
  function gastosView() {
    var m = metrics(), P = m.period, f = S.filters;
    var cat = EXPENSE_CATS.some(function (c) { return c.id === S.gastoCat; }) ? S.gastoCat : "material";
    var segs = EXPENSE_CATS.map(function (c) { return { id: c.id, value: P.byCat[c.id] || 0, color: c.color }; });
    var tiles = '<div class="cat-grid">' + EXPENSE_CATS.map(function (c) { var v = P.byCat[c.id] || 0; return '<button class="cat' + (cat === c.id ? " on" : "") + '" data-act="gastoCat" data-id="' + c.id + '"><span class="label"><span class="swatch" style="background:' + c.color + '"></span>' + esc(c.label) + '</span><span class="amt">' + money(v) + '</span><span class="muted small">' + fmtPct(pct(v, P.exp)) + t("expenses.ofExpenses", " das despesas</span></button>"); }).join("") + "</div>";
    var list = m.E.filter(function (x) { return inPeriod(x.date) && x.kind !== "revenue" && catKey(x.category) === cat; });
    var total = list.reduce(function (a, x) { return a + x.amount; }, 0);
    var detail = t("expenses.dateProjectVendorDescription", '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Projeto</th><th>Fornecedor / descrição</th><th>Lançado por</th><th class="n">Valor</th><th></th></tr></thead><tbody>') +
      (list.length ? list.map(function (x) {
        var p = projectById(x.projectId);
        return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + esc(x.vendor || "") + (x.category !== cat ? ' <span class="pill neutral">' + esc(catLabel(x.category)) + "</span>" : "") + (x.note ? '<div class="muted small">' + esc(x.note) + "</div>" : "") + "</td><td>" + byCell(x.createdByName || (x.createdBy ? userName(x.createdBy) : ""), x.createdAt || x.date) + '</td><td class="n"><b>' + money(x.amount, 2) + '</b></td><td class="n">' +
          (x.receipt ? '<button class="btn ghost sm" data-act="viewReceipt" data-id="' + x.id + t("expenses.receipt", '">Nota</button> ') : "") + '<button class="btn ghost sm" data-act="delExpense" data-id="' + x.id + t("expenses.html", '" aria-label="Apagar">✕</button></td></tr>');
      }).join("") + t("expenses.total", '<tr><td colspan="4"><b>Total</b></td><td class="n"><b>') + money(total, 2) + "</b></td><td></td></tr>" : emptyRow(6, t("expenses.noExpensesInThis", "Nenhuma despesa nesta categoria no período."))) +
      "</tbody></table></div>";
    return t("expenses.expensesMaterialPermitsEquipment", '<div class="page-head"><div><h1>Despesas</h1><p>Material, permit, equipamento e outros — as notas lançadas entram aqui sozinhas</p></div><button class="btn ghost" data-act="newExpense">+ Lançamento manual</button></div>') +
      filtersBar({ noUser: true }) +
      '<div class="split"><div class="panel donut-wrap" style="flex-direction:column;align-items:center;gap:10px">' + donut(segs, 220, money(P.exp, 0), t("expenses.donutSub", "despesas")) +
      '<div class="muted small" style="text-align:center">' + esc(f.projectId ? (projectById(f.projectId) || {}).name : t("expenses.allProjects", "Todos os projetos")) + "<br>" + periodLabel() + "</div></div>" + tiles + "</div>" +
      '<div class="section-title"><h3>' + esc(catLabel(cat)) + "</h3></div>" + detail;
  }

  // ═══════════ projects ═══════════
  function crumb(navId, label, here) { return '<nav class="crumb" aria-label="Caminho"><button type="button" data-act="nav" data-id="' + navId + '">' + ic("chevl", 16) + esc(label) + "</button>" + (here ? "<span aria-hidden=\"true\">/</span><span>" + esc(here) + "</span>" : "") + "</nav>"; }
  function tagsOf(d, extra) { return [d.sector, d.workType, d.building, d.unitsCount ? d.unitsCount + t("projects.unitsShort", " unid.") : ""].concat(extra || []).filter(Boolean).map(function (x) { return '<span class="tag">' + esc(tv(x)) + "</span>"; }).join(""); }
  function projectsView() {
    var list = companyProjects(), fin = can("finance");
    var kind = tradeDef(tradeOf(S.company)).kind;
    return t("projects.projects", '<div class="page-head"><div><h1>Projetos</h1><p>') + esc(companyName(S.company)) + " · " + list.length + t("projects.projects2", ' projetos</p></div><button class="btn" data-act="newProject">') + ic("plus") + t("projects.newProject", "Novo projeto</button></div>") +
      (list.length ? '<div class="proj-list">' + list.map(function (p) {
        var s = projectStats(p), d = p.details || {}, lim = pct(s.cost, s.budget);
        return '<button type="button" class="pcard" data-act="openProject" data-id="' + p.id + '"><div class="pcard-top"><h2>' + esc(p.name) + "</h2>" + statusPill(p.status) + "</div>" +
          '<div class="muted small pcard-meta">' + esc([p.client, p.address].filter(Boolean).join(" · ")) + "</div>" +
          '<div class="chips">' + tagsOf(d) + "</div>" +
          t("projects.tasks", '<div class="pcard-stats"><div><div class="spread small"><span class="muted">Tarefas</span><b class="num">') + s.done + "/" + s.total + "</b></div>" + level(s.progress, { sm: true, bubble: false, color: "var(--info)", label: t("projects.progress", "Progresso ") + fmtPct(s.progress) }) + "</div>" +
          (fin ? t("projects.limitUsed", '<div><div class="spread small"><span class="muted">Limite usado</span><b class="num">') + fmtPct(lim) + "</b></div>" + level(lim, { sm: true, bubble: false, label: t("projects.limitUsed2", "Limite usado ") + fmtPct(lim) }) + "</div>" +
            t("projects.contract", '<div class="pcard-money"><span class="muted small">Orçamento</span><b class="num">') + money(s.contract) + "</b></div>"
            : '<div><div class="spread small"><span class="muted">' + esc(t("proj.hours", "Horas na obra")) + '</span><b class="num">' + hrs(s.hours) + "</b></div></div>") + "</div></button>";
      }).join("") + "</div>" : emptyState({ icon: "folder", title: t("projects.noProjectsYet", "Nenhum projeto ainda"), text: t("projects.addYourFirst", "Cadastre o primeiro ") + kind + t("projects.specsTasksDrawingsAnd", ": ficha técnica, tarefas, plantas e valores."), cta: { act: "newProject", label: t("projects.newProject2", "Novo projeto"), primary: true } }));
  }

  function specRows(p) {
    var d = p.details || {}, trade = tradeDef(tradeOf(p.companyId));
    var rows = [[t("projects.type", "Tipo"), tv(d.sector)], [t("projects.typeOfWork", "Tipo de trabalho"), tv(d.workType)], [t("projects.property", "Imóvel"), tv(d.building)], [t("projects.bedrooms", "Quartos"), d.bedrooms], [t("projects.bathrooms", "Banheiros"), d.bathrooms], [t("projects.floors", "Andares"), d.floors], [t("projects.areaSqFt", "Área (sq ft)"), d.sqft], [t("projects.units", "Unidades"), d.unitsCount || d.units],
      ["Permit", d.permit && tv(d.permit) + (d.permitNo ? " · " + d.permitNo : "")], [t("projects.walls", "Paredes"), tv(d.walls)], [t("projects.occupancy", "Ocupação"), tv(d.occupied)], [t("projects.access", "Acesso"), (d.access || []).map(tv).join(", ")]];
    Object.keys(trade.fields).forEach(function (k) { var v = d[k]; rows.push([trade.fields[k].label, Array.isArray(v) ? v.map(tv).join(", ") : tv(v)]); });
    trade.text.forEach(function (t) { if (t.key !== "unitsCount") rows.push([t.label, d[t.key]]); });
    return rows.filter(function (r) { return r[1] && r[1] !== "undefined" && String(r[1]).trim(); });
  }
  // Ficha agrupada (Imóvel · Serviço · Sistemas), mesmas linhas de specRows
  function specGroups(p) {
    var trade = tradeDef(tradeOf(p.companyId)), rows = specRows(p);
    var tradeLabels = {}, sysLabels = {};
    Object.keys(trade.fields).forEach(function (k) { ((trade.sysKeys || []).indexOf(k) >= 0 ? sysLabels : tradeLabels)[trade.fields[k].label] = 1; });
    trade.text.forEach(function (t) { tradeLabels[t.label] = 1; });
    var g = [[t("projects.property", "Imóvel"), "home", []], [trade.group[0], trade.group[1], []], [t("projects.systemsAndExtras", "Sistemas e extras"), "grid", []]];
    rows.forEach(function (r) { (sysLabels[r[0]] ? g[2] : tradeLabels[r[0]] ? g[1] : g[0])[2].push(r); });
    return g.filter(function (x) { return x[2].length; });
  }

  function projectView() {
    var p = projectById(S.params.id);
    if (!p) return emptyState({ icon: "folder", title: t("projects.projectNotFound", "Projeto não encontrado"), text: t("projects.itMayHaveBeen", "Ele pode ter sido apagado."), cta: { act: "nav", id: isStaff() ? "projects" : "jobs", label: t("projects.back", "Voltar"), icon: "chevl" } });
    var admin = isStaff(), fin = can("finance"), canDel = can("finance"); // gerente: edita a obra e vê o ponto, sem financeiro e sem apagar
    var tab = S.params.tab || "overview";
    if (tab === "money" && !fin) tab = "overview";
    var pn = (S.notices || []).filter(function (n) { return n.projectId === p.id && !n.resolved; }).length;
    var s = projectStats(p), d = p.details || {};
    var tabs = [["overview", t("projects.overview", "Visão geral")], ["scope", t("projects.tasks2", "Tarefas"), s.done + "/" + s.total], ["avisos", t("projects.notices", "Avisos"), pn || ""], ["files", t("projects.drawingsAndFiles", "Plantas e arquivos"), String((p.files || []).length)]];
    if (admin) { if (fin) tabs.push(["money", t("projects.financials", "Financeiro")]); tabs.push(["ptime", t("projects.timeClock", "Ponto")]); tabs.push(["activity", t("act.tab", "Atividade")]); }
    if (tab === "activity" && !admin) tab = "overview";
    var maps = p.address ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '" target="_blank" rel="noopener">' + ic("map", 16) + t("projects.openInMaps", "Abrir no mapa</a>") : "";
    var meta = [p.client ? "<span>" + ic("user", 16) + esc(p.client) + "</span>" : "", p.address ? "<span>" + ic("pin", 16) + esc(p.address) + "</span>" : "", maps,
      (p.startDate || p.estCompletion) ? '<span>' + ic("calendar", 16) + fmtDate(p.startDate) + t("common.to", " a ") + fmtDate(p.estCompletion) + "</span>" : ""].filter(Boolean).join("");
    var head = crumb(admin ? "projects" : "jobs", admin ? t("dashboard.projects", "Projetos") : t("dashboard.jobs", "Obras"), p.name.replace(/^(EXEMPLO|SAMPLE)\s*·\s*/, "")) +
      '<div class="p-head"><div style="min-width:0"><div class="p-title"><h1>' + esc(p.name) + "</h1>" + statusPill(p.status) + "</div>" +
      '<div class="p-meta">' + meta + "</div>" + '<div class="tags">' + tagsOf(d) + "</div>" +
      (p.createdByName || p.updatedByName ? '<div class="bylines p-who">' + byLine(t("who.createdBy", "Criado por {n}"), p.createdByName, p.createdAt) + byLine(t("who.editedBy", "Editado por {n}"), p.updatedByName, p.updatedAt) + "</div>" : "") + "</div>" +
      (admin ? '<div class="p-actions"><button class="btn ghost" data-act="editProject" data-id="' + p.id + '">' + ic("edit", 18) + t("dashboard.edit", '<span class="lbl">Editar</span></button>') +
        (canDel ? t("dashboard.html3", '<details class="dd"><summary class="btn ghost icon-only" aria-label="Mais ações do projeto">') + ic("more") + '</summary><div class="dd-menu right" role="menu">' +
        '<button type="button" role="menuitem" data-act="editProject" data-id="' + p.id + '">' + ic("edit", 18) + t("dashboard.editProject", "Editar projeto</button>") +
        '<button type="button" role="menuitem" class="danger-item" data-act="askDelProject" data-id="' + p.id + t("dashboard.html4", '" title="Apagar projeto">') + ic("trash", 18) + t("dashboard.deleteProject", "Apagar projeto</button></div></details>") : "") + "</div>" : "") + "</div>";
    var tabsHtml = t("projects.html", '<nav class="tabs" role="tablist" aria-label="Seções do projeto">') + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="ptab" data-id="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + esc(t[1]) + (t[2] !== undefined && t[2] !== "" ? '<span class="ct">' + esc(t[2]) + "</span>" : "") + "</button>"; }).join("") + "</nav>";
    var body = "";
    if (tab === "overview") {
      var groups = specGroups(p), tasks = p.tasks || [];
      var pend = tasks.filter(function (t) { return !t.done; }), done = tasks.filter(function (t) { return t.done; }).sort(function (a, b) { return String(b.doneAt || "") > String(a.doneAt || "") ? 1 : -1; });
      var next = pend.slice(0, 3); if (next.length < 3) next = next.concat(done.slice(0, 3 - next.length));
      var progress = t("projects.jobProgress", '<section class="panel"><div class="prog-head"><h3>Progresso da obra</h3><span class="num"><b>') + fmtPct(s.progress) + '</b> <span class="muted small">' + s.done + t("common.of", " de ") + s.total + t("projects.tasks3", " tarefas</span></span></div>") +
        level(s.progress, { label: t("projects.jobProgress2", "Progresso da obra ") + fmtPct(s.progress) }) +
        (next.length ? t("projects.nextTasks", '<div class="next-tasks"><div class="muted small">Próximas tarefas</div>') + next.map(function (t) { return taskRow(p, t, true); }).join("") + "</div>" +
          t("projects.seeAll", '<button type="button" class="link-btn" data-act="ptab" data-id="scope">Ver as ') + s.total + t("projects.tasks4", " tarefas</button>") : t("projects.noTasksAdded", '<p class="muted small" style="margin-top:12px">Nenhuma tarefa cadastrada.</p>')) + "</section>";
      var ficha = t("projects.jobSpecsStart", '<section class="panel"><div class="panel-head"><h3>Ficha da obra</h3><span class="muted">Início ') + fmtDate(p.startDate) + t("projects.estFinish", ", previsão ") + fmtDate(p.estCompletion) + "</span></div>" +
        (groups.length ? groups.map(function (g) { return '<div class="spec-group"><h4>' + ic(g[1], 16) + esc(g[0]) + '</h4><div class="specs">' + g[2].map(function (r) { return '<div class="spec"><div class="k">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") + "</div></div>"; }).join("")
          : emptyState({ icon: "doc", title: t("projects.noDetailsAdded", "Sem detalhes cadastrados"), bare: true, cta: admin ? { act: "editProject", id: p.id, label: t("projects.fillInTheSpecs", "Preencher a ficha"), icon: "edit" } : null })) + "</section>";
      var left = '<div class="stack">' + (p.teamNotes ? '<div class="note">' + ic("note") + t("projects.notesForTheCrew", "<div><b>Recado para a equipe</b>") + '<div class="prose">' + esc(p.teamNotes) + "</div></div></div>" : "") + progress + ficha +
        (admin && canDel ? t("projects.deletingTheProjectAsks", '<div class="delete-zone"><span>Apagar o projeto pergunta se você quer apagar ou manter as horas, notas e arquivos ligados a ele.</span><button class="btn danger sm" data-act="askDelProject" data-id="') + p.id + '">' + ic("trash", 16) + t("projects.deleteProject", "Apagar projeto</button></div>") : "") + "</div>";
      var files = p.files || [];
      var filesPanel = t("projects.drawingsAndFiles2", '<section class="panel"><div class="panel-head"><h3>Plantas e arquivos</h3>') + (files.length ? t("projects.seeAll2", '<button type="button" class="link-btn" data-act="ptab" data-id="files">Ver todos</button>') : "") + "</div>" +
        (files.length ? '<div class="file-mini">' + files.slice(0, 4).map(function (f) { return '<div class="fm-row">' + ic("file", 18) + '<span class="fm-name">' + esc(f.name) + '</span><button class="btn ghost sm" data-act="openFile" data-pid="' + p.id + '" data-id="' + f.id + t("projects.open", '">Abrir</button></div>'); }).join("") + "</div>"
          : emptyState({ icon: "file", bare: true, title: t("projects.noDrawingsUploadedYet", "Nenhuma planta enviada ainda"), text: admin ? t("projects.pdfPhotoWordOr", "PDF, foto, Word ou Excel. A equipe vê no celular.") : t("projects.whenTheAdminUploads", "Quando o administrador enviar plantas, elas aparecem aqui."),
            cta: admin ? '<label class="btn ghost sm upload-btn">' + ic("plus", 18) + t("projects.uploadFileInputType", 'Enviar arquivo<input type="file" data-act="uploadFiles" data-id="') + p.id + '" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"></label>' : null })) + "</section>";
      var rail = "";
      if (admin) {
        var lim = pct(s.cost, s.budget);
        var onSite = S.time.filter(function (t) { return t.projectId === p.id && !t.checkOut; });
        rail = (!fin ? "" : t("projects.financialsOpen", '<section class="panel"><div class="panel-head"><h3>Financeiro</h3><button type="button" class="link-btn" data-act="ptab" data-id="money">Abrir</button></div>') +
          t("projects.spentSoFar", '<div class="muted small">Gasto até agora</div><div class="big num">') + money(s.cost) + "</div>" + level(lim, { sm: true, label: fmtPct(lim) + t("projects.ofTheLimit", " do limite") }) +
          '<div class="level-scale"><span>' + fmtPct(lim) + t("projects.ofTheLimit2", " do limite</span><span>") + money(s.budget) + "</span></div>" +
          t("projects.material", '<div class="money-rows"><div class="money-row"><span>Material <span class="muted">') + fmtPct(pct(s.material, s.matBudget)) + t("common.of", " de ") + money(s.matBudget) + "</span></span><b>" + money(s.material) + "</b></div>" +
          t("projects.labor", '<div class="money-row"><span>Mão de obra <span class="muted">') + hrs(s.hours) + ", " + fmtPct(pct(s.labor, s.labBudget)) + "</span></span><b>" + money(s.labor) + "</b></div>" +
          t("projects.received", '<div class="money-row"><span>Recebido <span class="muted">') + fmtPct(pct(s.revenue, s.contract)) + t("common.of", " de ") + money(s.contract) + '</span></span><b class="v-good">' + money(s.revenue) + "</b></div>" +
          t("projects.projectedProfitBClass", '<div class="money-row"><span>Lucro previsto</span><b class="') + (s.contract - s.cost >= 0 ? "v-good" : "v-bad") + '">' + money(s.contract - s.cost) + "</b></div></div></section>") +
          t("projects.onTheJobToday", '<section class="panel"><div class="panel-head"><h3>Na obra hoje</h3><button type="button" class="link-btn" data-act="ptab" data-id="ptime">Ponto</button></div>') +
          (onSite.length ? onSite.map(function (t) { var nm = userName(t.userId); return '<div class="who-row"><span class="avatar soft">' + esc(initials(nm)) + '</span><span class="who-t"><b>' + esc(nm) + NV.t("projects.inAt", '</b><span class="muted small">Entrou ') + fmtTime(t.checkIn) + ", " + (t.inLoc && t.inLoc.ok ? NV.t("projects.gpsOk", "GPS ok") : NV.t("projects.noGps", "sem GPS")) + '</span></span><span class="live" title="' + esc(NV.t("projects.workingNowTitle", "Trabalhando agora")) + '"></span></div>'; }).join("")
            : t("projects.nobodyIsPunchedIn", '<p class="muted small">Ninguém está com ponto aberto nesta obra agora.</p>')) + "</section>";
      }
      body = '<div class="layout"><div>' + left + '</div><aside class="rail">' + rail + filesPanel + "</aside></div>";
    } else if (tab === "scope") {
      var gs = {}, order = Object.keys(tradeDef(tradeOf(p.companyId)).tasks).concat(["Outros"]); // grupos gravados em PT; tv() só na tela
      (p.tasks || []).forEach(function (t) { (gs[t.group || "Outros"] = gs[t.group || "Outros"] || []).push(t); });
      var gkeys = Object.keys(gs).sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      body = t("projects.contractScope", '<div class="grid2" style="align-items:start"><section class="panel"><h3>Escopo do contrato</h3><div class="prose">') + (p.scope ? esc(p.scope) : t("projects.noScopeAdded", '<span class="muted">Sem escopo cadastrado.</span>')) + "</div></section>" +
        t("projects.tasks5", '<div><div class="panel-head"><h3>Tarefas <span class="muted num">') + s.done + "/" + s.total + t("projects.checkOffWhenDone", '</span></h3><span class="muted small">Marque quando terminar</span></div>') +
        (gkeys.length ? level(s.progress, { sm: true, bubble: false, label: fmtPct(s.progress) + t("projects.done", " concluído") }) + '<div style="height:12px"></div>' + gkeys.map(function (g) {
          var dn = gs[g].filter(function (t) { return t.done; }).length;
          return '<div class="check-group"><h4>' + esc(tv(g)) + ' <span class="muted num">' + dn + "/" + gs[g].length + "</span></h4>" + gs[g].map(function (t) { return taskRow(p, t); }).join("") + "</div>";
        }).join("") : emptyState({ icon: "check", title: t("projects.noTasksAdded2", "Nenhuma tarefa cadastrada"), text: admin ? t("projects.pickTheTasksIn", "Escolha as tarefas em Editar → Tarefas.") : t("projects.theAdminHasnT", "O administrador ainda não cadastrou tarefas."), cta: admin ? { act: "editProject", id: p.id, label: t("projects.editTasks", "Editar tarefas"), icon: "edit" } : null })) + "</div></div>";
    } else if (tab === "files") {
      body = filesBlock(p, admin);
    } else if (tab === "avisos") {
      body = noticesBlock(p);
    } else if (tab === "money" && admin && fin) {
      var fi = S.fin[p.id] || {};
      var segs = [{ id: "labor", label: t("common.laborHours", "Mão de obra (horas)"), value: s.labor, color: "var(--c2)" }].concat(EXPENSE_CATS.map(function (c) { var v = S.expenses.filter(function (x) { return x.projectId === p.id && x.kind !== "revenue" && catKey(x.category) === c.id; }).reduce(function (a, x) { return a + x.amount; }, 0); return { id: c.id, label: c.label, value: v, color: c.color }; }));
      body = (fi.updatedByName ? '<div class="bylines" style="margin-bottom:12px">' + byLine(t("who.valuesEditedBy", "Valores editados por {n}"), fi.updatedByName, fi.updatedAt) + "</div>" : "") + (fi.contractValue == null ? '<div class="demo-flag">' + ic("info", 18) + t("projects.noBudgetEnteredYet", "<span>Valores ainda não cadastrados. Use “Editar” → etapa “Valores”.</span></div>") : "") +
        t("projects.spendingLimit", '<section class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Limite de gastos</h3><span class="muted num">') + money(s.cost) + t("common.of", " de ") + money(s.budget) + "</span></div>" + level(pct(s.cost, s.budget), { label: fmtPct(pct(s.cost, s.budget)) + t("projects.ofTheLimit", " do limite") }) +
        '<div class="level-scale"><span>$0</span><span>' + fmtPct(pct(s.cost, s.budget)) + t("projects.ofTheSpendingLimit", " do limite de gastos</span><span>") + money(s.budget) + "</span></div></section>" +
        '<div class="kpis">' +
        kpi({ label: t("projects.spentSoFar2", "Gasto até agora"), value: money(s.cost), sub: limitLine(s.cost, s.budget), pct: pct(s.cost, s.budget), act: "gastosFor", id: p.id }) +
        kpi({ label: "Material", value: money(s.material), sub: limitLine(s.material, s.matBudget), pct: pct(s.material, s.matBudget), act: "gastosFor", id: p.id }) +
        kpi({ label: t("projects.laborHours", "Mão de obra (horas)"), value: money(s.labor), sub: hrs(s.hours) + " · " + limitLine(s.labor, s.labBudget), pct: pct(s.labor, s.labBudget), act: "hoursFor", id: p.id }) +
        kpi({ label: t("projects.received2", "Recebido"), value: money(s.revenue), cls: "v-good", sub: t("projects.ofContractValue", "do orçamento de ") + money(s.contract), pct: pct(s.revenue, s.contract), ringOpts: { color: "var(--good)" } }) +
        kpi({ label: t("projects.projectedProfit", "Lucro previsto"), value: money(s.contract - s.cost), sub: t("projects.contractSpent", "orçamento − gasto"), pct: pct(s.contract - s.cost, s.contract), ringOpts: { color: "var(--good)" } }) +
        '</div><div class="split" style="margin-top:16px"><section class="panel donut-wrap">' + donut(segs, 220, money(s.cost, 0), t("projects.totalSpent", "gasto total")) + t("projects.spendingByCategory", '</section><section class="panel"><h3>Gastos por categoria</h3>') + bars(segs.filter(function (x) { return x.value > 0; }).map(function (x) { return { id: x.id, label: x.label, value: x.value, color: x.color, swatch: true }; }), money) + "</section></div>" +
        t("projects.dailyReportForThe", '<section class="panel" style="margin-top:16px"><div class="spread"><div><h3>Relatório diário para o cliente</h3><div class="muted small">') + (fi.clientEmail ? esc(fi.clientEmail) + (fi.dailyReport === false ? t("projects.off", " · desligado") : t("projects.sentEveryDayAt", " · enviado todo dia às 18h quando houver trabalho")) + (fi.lastReportAt ? t("projects.last", " · último: ") + fmtDate(fi.lastReportAt) : "") : t("projects.addTheCustomerS", "Coloque o e-mail do cliente em Editar → Obra.")) + "</div></div>" +
        (fi.clientEmail ? '<button class="btn ghost sm" data-act="reportNow" data-id="' + p.id + t("projects.sendReportNow", '">Enviar relatório agora</button>') + demoNote() : "") + "</div></section>";
    } else if (tab === "ptime" && admin) {
      body = timeTable(S.time.filter(function (t) { return t.projectId === p.id; }).slice(0, 300), true);
    } else if (tab === "activity" && admin) {
      body = activityView(p);
    }
    return head + tabsHtml + '<div role="tabpanel">' + body + "</div>";
  }
  function taskRow(p, tk, compact) {
    return '<label class="check' + (tk.done ? " done" : "") + (compact ? " compact" : "") + '"><input type="checkbox" data-act="task" data-pid="' + p.id + '" data-id="' + tk.id + '"' + (tk.done ? " checked" : "") + '><span class="cbox" aria-hidden="true">' + ic("check", 16) + '</span><div><div class="t">' + esc(tk.label) + "</div>" +
      (tk.done && tk.doneBy ? '<div class="by">' + byLine(t("who.doneBy", "Feito por {n}"), tk.doneBy, tk.doneAt) + "</div>" : compact && tk.group ? '<div class="by">' + esc(tv(tk.group)) + "</div>" : "") + "</div></label>";
  }

  // ═══════════ Atividade da obra: quem fez o quê, quando (dono e gerente; o gerente não vê nada de dinheiro) ═══════════
  var actCache = {};
  function dropActs() { actCache = {}; }
  function ensureAct(pid) {
    if (actCache[pid] === "ok") return true;
    if (actCache[pid] === "loading" || !API.listActivity) return false;
    actCache[pid] = "loading";
    API.listActivity({ projectId: pid }).then(function (l) { S.acts = S.acts || {}; S.acts[pid] = l || []; actCache[pid] = "ok"; if (S.view === "project") render(); })
      .catch(function () { actCache[pid] = "ok"; S.acts = S.acts || {}; S.acts[pid] = []; if (S.view === "project") render(); });
    return false;
  }
  var ACT_KIND = { task: ["task.done", "task.undone"], notice: ["notice.create", "notice.resolve", "notice.reopen", "notice.delete"], money: ["expense.create", "expense.delete", "revenue.create", "revenue.delete", "financials.update"], files: ["file.upload", "file.delete"] };
  function actGroup(type) { for (var k in ACT_KIND) if (ACT_KIND[k].indexOf(type) >= 0) return k; return "other"; }
  function actLine(a) {
    var x = a.extra || {}, fin = can("finance"), amt = "";
    if (fin && /^(expense|revenue)\.create$/.test(a.type)) { var ex = (S.expenses || []).find(function (e) { return e.id === a.ref; }); if (ex) amt = money(ex.amount, 2); }
    var docName = x.docType === "invoice" ? t("act.invoice", "o invoice") : t("act.estimate", "a proposta");
    var M = {
      "task.done": ["check", t("act.taskDone", "{n} marcou como feita: {x}")], "task.undone": ["x", t("act.taskUndone", "{n} desmarcou a tarefa: {x}")],
      "notice.create": ["bell", x.photo ? t("act.noticeCreatePhoto", "{n} mandou um aviso com foto: “{x}”") : t("act.noticeCreate", "{n} mandou um aviso: “{x}”")], "notice.resolve": ["check", t("act.noticeResolve", "{n} resolveu o aviso: “{x}”")],
      "notice.reopen": ["bell", t("act.noticeReopen", "{n} reabriu o aviso: “{x}”")], "notice.delete": ["trash", t("act.noticeDelete", "{n} apagou o aviso: “{x}”")],
      "expense.create": ["receipt", x.receipt ? t("act.receiptCreate", "{n} lançou uma nota ({c}): {x}") : t("act.expenseCreate", "{n} lançou uma despesa ({c}): {x}")], "expense.delete": ["trash", t("act.expenseDelete", "{n} apagou um lançamento ({c}): {x}")],
      "revenue.create": ["money", t("act.revenueCreate", "{n} registrou um pagamento recebido")], "revenue.delete": ["trash", t("act.revenueDelete", "{n} apagou um pagamento recebido")],
      "financials.update": ["money", t("act.financials", "{n} alterou os valores da obra")],
      "file.upload": ["upload", t("act.fileUpload", "{n} enviou o arquivo {x}")], "file.delete": ["trash", t("act.fileDelete", "{n} apagou o arquivo {x}")],
      "project.create": ["folder", t("act.projectCreate", "{n} criou o projeto")], "project.update": ["edit", t("act.projectUpdate", "{n} editou o projeto")],
      "event.create": ["calendar", t("act.eventCreate", "{n} marcou na agenda: {x} ({d})")], "event.update": ["calendar", t("act.eventUpdate", "{n} alterou na agenda: {x} ({d})")],
      "event.done": ["check", t("act.eventDone", "{n} concluiu na agenda: {x}")], "event.undone": ["calendar", t("act.eventUndone", "{n} reabriu na agenda: {x}")], "event.delete": ["trash", t("act.eventDelete", "{n} tirou da agenda: {x}")],
      "shift.create": ["pin", t("act.shiftCreate", "{n} escalou {x} para {d}")], "shift.update": ["pin", t("act.shiftUpdate", "{n} mudou a escala de {x} ({d})")], "shift.delete": ["trash", t("act.shiftDelete", "{n} tirou {x} da escala ({d})")],
      "time.fix": ["clock", t("act.timeFix", "{n} corrigiu o ponto de {x}")],
      "proposal.create": ["doc", t("act.proposalCreate", "{n} criou {k} {x}")], "proposal.status": ["doc", t("act.proposalStatus", "{n} mudou {k} {x} para “{s}”")], "proposal.delete": ["trash", t("act.proposalDelete", "{n} apagou {k} {x}")]
    };
    var m = M[a.type] || ["info", t("act.generic", "{n} fez uma alteração")];
    var B = function (v) { return "<b>" + esc(v) + "</b>"; };
    var html = esc(m[1]).replace("{n}", B(firstName(a.byName) || t("act.someone", "Alguém"))).replace("{x}", a.label ? B(a.label) : "").replace("{c}", esc(catLabel(x.category || ""))).replace("{d}", esc(x.date ? fmtDate(x.date) : "")).replace("{k}", esc(docName)).replace("{s}", esc(tv(x.status || "")));
    return { icon: m[0], html: html + (amt ? ' <span class="act-amt num">' + amt + "</span>" : "") };
  }
  function activityView(p) {
    var ready = ensureAct(p.id), list = ((S.acts || {})[p.id] || []).filter(function (a) { return can("finance") || !a.money; });
    var f = S.actFilter || "all", shown = list.filter(function (a) { return f === "all" || actGroup(a.type) === f; });
    var chips = [["all", t("act.all", "Tudo")], ["task", t("act.fTasks", "Tarefas")], ["notice", t("act.fNotices", "Avisos")], ["money", can("finance") ? t("act.fMoney", "Notas e gastos") : t("act.fReceipts", "Notas")], ["files", t("act.fFiles", "Arquivos")], ["other", t("act.fOther", "Agenda, escala e edições")]];
    var head = '<div class="panel-head" style="margin-bottom:10px"><div><h3>' + esc(t("act.title", "Atividade da obra")) + '</h3><span class="muted small">' + esc(can("finance") ? t("act.sub", "Quem fez o quê, e quando — cada mudança fica registrada com o nome de quem fez.") : t("act.subMgr", "Quem fez o quê, e quando. Valores em dinheiro não aparecem aqui.")) + "</span></div></div>" +
      '<div class="chips" role="group" aria-label="' + esc(t("act.filter", "Filtrar atividade")) + '" style="margin-bottom:12px">' + chips.map(function (c) { return '<button type="button" class="chip' + (f === c[0] ? " on" : "") + '" data-act="actFilter" data-id="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>";
    if (!ready && !list.length) return head + '<div class="panel" aria-busy="true"><span class="spin" aria-hidden="true"></span> ' + esc(t("act.loading", "Carregando atividade…")) + "</div>";
    if (!shown.length) return head + emptyState({ icon: "clock", title: t("act.empty", "Nada registrado ainda"), text: t("act.emptyText", "Quando alguém marcar uma tarefa, mandar um aviso, lançar uma nota ou enviar um arquivo nesta obra, aparece aqui com o nome e a hora.") });
    var out = "", lastDay = "";
    shown.slice(0, 120).forEach(function (a) {
      var d = new Date(a.at), dk = isNaN(d) ? "" : isoLocal(d);
      if (dk !== lastDay) { out += (lastDay ? "</ol>" : "") + '<h4 class="act-day">' + esc(whenShort(dk)) + '</h4><ol class="act-list">'; lastDay = dk; }
      var L = actLine(a);
      out += '<li class="act-item"><span class="act-ic act-' + actGroup(a.type) + '" aria-hidden="true">' + ic(L.icon, 16) + '</span><span class="act-txt">' + L.html + '</span><time class="act-time" datetime="' + esc(a.at) + '">' + esc(isNaN(d) ? "" : fmtTime(a.at)) + "</time></li>";
    });
    return head + '<section class="panel act-panel">' + out + "</ol></section>";
  }

  function filesBlock(p, canEdit) {
    var files = p.files || [];
    return (canEdit ? '<label class="drop" style="margin-bottom:16px"><input type="file" data-act="uploadFiles" data-id="' + p.id + '" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"><span class="em-ic">' + ic("plus", 24) + t("projects.uploadADrawingPlan", "</span><b>Enviar planta, desenho ou documento</b><span class=\"small\">PDF, foto, Word, Excel. Toque aqui para escolher os arquivos.</span></label>") : "") +
      (files.length ? '<div class="files">' + files.map(function (f) {
        var isImg = /^image\//.test(f.mime || ""), ext = (f.name.split(".").pop() || "").toUpperCase().slice(0, 4);
        return '<div class="file"><div class="thumb" data-thumb="' + f.id + '">' + (isImg ? "IMG" : esc(ext)) + '</div><div class="fname">' + esc(f.name) + '</div><div class="muted small">' + (f.size ? (f.size / 1048576).toFixed(1) + " MB · " : "") + fmtDate(f.createdAt) + "</div>" + (f.createdByName ? '<div class="by">' + byLine(t("who.uploadedBy", "Enviado por {n}"), f.createdByName, f.createdAt) + "</div>" : "") +
          '<div class="row"><button class="btn sm" data-act="openFile" data-pid="' + p.id + '" data-id="' + f.id + t("projects.open2", '">Abrir</button>') + (canEdit ? '<button class="btn ghost sm" data-act="delFile" data-pid="' + p.id + '" data-id="' + f.id + t("projects.delete", '">Apagar</button>') : "") + "</div></div>";
      }).join("") + "</div>" : emptyState({ icon: "file", title: t("projects.noDrawingsUploadedYet", "Nenhuma planta enviada ainda"), text: canEdit ? t("projects.useTheButtonAbove", "Use o botão acima: PDF, foto, Word ou Excel. A equipe vê no celular.") : t("projects.whenTheAdminUploads", "Quando o administrador enviar plantas, elas aparecem aqui.") }));
  }

  // ═══════════ project wizard ═══════════
  function blankProject() {
    return { id: null, companyId: S.company, name: "", client: "", address: "", lat: null, lng: null, radius: 150, status: "Active", startDate: todayISO(), estCompletion: "", details: { access: [], wiring: [], extras: [], equipment: [], pipeMaterial: [], fixtures: [], subs: [] }, scope: "", teamNotes: "", tasks: [], fin: { contractValue: "", materialBudget: "", laborBudget: "", estHours: "", clientEmail: "", clientPhone: "", dailyReport: t("projects.yes", "Sim") } };
  }
  // valores em dinheiro no texto que a equipe vê (escopo / recado)
  function moneyHits(t) {
    var re = /(\$\s?\d[\d,.]*|\b(?:usd|us\$)\s?\d[\d,.]*|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b|\b\d+(?:[.,]\d+)?\s?(?:mil|k|d[oó]lar(?:es)?|dollars?|bucks|reais)\b)/gi, out = [], m;
    while ((m = re.exec(String(t || "")))) if (out.indexOf(m[1].trim()) < 0) out.push(m[1].trim());
    return out;
  }
  function scopeWarnHtml(d) {
    var h = moneyHits(d.scope).concat(moneyHits(d.teamNotes).filter(function (x) { return moneyHits(d.scope).indexOf(x) < 0; }));
    return h.length ? '<div class="pill warn" style="white-space:normal;padding:8px 12px">' + ic("alert", 18) + t("projects.iFoundDollarAmounts", ' Achei valores que os funcionários vão ver: <b>') + h.slice(0, 6).map(esc).join(", ") + t("projects.removeThemFromThe", "</b>. Tire do texto se for preço.</div>") : "";
  }
  function wizSteps() { var tr = tradeDef(tradeOf(S.draft.companyId)), st = [t("projects.job", "Obra"), t("projects.type", "Tipo"), t("projects.conditions", "Condições"), tr.stepName, t("projects.tasks2", "Tarefas"), t("projects.scopeAndDrawings", "Escopo e plantas")]; if (can("finance")) st.push(t("projects.budget", "Valores")); return st; } // gerente: sem a etapa Valores
  function chooser(path, def, multi) {
    var v = get(S.draft, path);
    return '<div class="opt-block"><span class="label">' + esc(def.label) + "</span>" + (def.hint ? '<p class="muted small opt-hint">' + esc(def.hint) + "</p>" : "") + '<div class="chips">' + def.opts.map(function (o) {
      var on = multi ? (v || []).indexOf(o) >= 0 : v === o;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-act="' + (multi ? "toggleOpt" : "pickOpt") + '" data-path="' + path + '" data-val="' + esc(o) + '">' + esc(tv(o)) + "</button>";
    }).join("") + "</div></div>";
  }
  function inputF(path, label, type, attrs) {
    var v = get(S.draft, path);
    return '<label class="field"><span>' + esc(label) + '</span><input type="' + (type || "text") + '" id="w-' + path.replace(/\./g, "-") + '" data-bind="' + path + '" value="' + esc(v == null ? "" : v) + '" ' + (attrs || "") + "></label>";
  }
  function wizardView() {
    if (!S.draft) restoreWizard(); // troca de idioma com o assistente aberto: volta no mesmo passo
    if (!S.draft) { S.draft = blankProject(); S.draftFiles = []; S.wizStep = 0; markWizClean(); }
    var d = S.draft, steps = wizSteps(), step = Math.min(S.wizStep, steps.length - 1), trade = tradeDef(tradeOf(d.companyId)), body = "";
    if (step === 0) {
      body = '<div class="stack">' + inputF("name", t("projects.projectNameEG", "Nome do projeto (ex.: 53 Mason St — Unidade 2)")) + '<div class="grid2">' + inputF("client", t("projects.customerGc", "Cliente / GC")) +
        t("projects.status", '<label class="field"><span>Status</span><select data-bind="status" id="w-status">') + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (d.status === k ? " selected" : "") + ">" + STATUS[k][0] + "</option>"; }).join("") + "</select></label></div>" +
        '<div class="row" style="align-items:flex-end">' + '<div style="flex:1 1 260px">' + inputF("address", t("projects.jobAddress", "Endereço da obra")) + t("projects.findOnMap", '</div><button type="button" class="btn ghost" data-act="geocode">Buscar no mapa</button></div>') +
        '<div class="muted small" id="geoStatus">' + (d.lat ? t("projects.location", "Localização: ") + Number(d.lat).toFixed(5) + ", " + Number(d.lng).toFixed(5) + t("projects.usedToDetectThe", " — usada para detectar a obra quando o funcionário bate o ponto.") : t("projects.lookUpTheAddress", "Busque o endereço para o app reconhecer a obra pelo GPS do funcionário.")) + "</div>" +
        '<div class="grid4 keep2">' + inputF("lat", "Latitude", "number", 'step="any"') + inputF("lng", "Longitude", "number", 'step="any"') + inputF("radius", t("projects.punchInRadiusMeters", "Raio do ponto (metros)"), "number") + "</div>" +
        '<div class="grid2">' + inputF("startDate", t("projects.home", "Início"), "date") + inputF("estCompletion", t("projects.estimatedCompletion", "Previsão de término"), "date") + "</div>" +
        (!can("finance") ? "" : t("projects.customerDailyJobReport", '<div class="panel" style="background:var(--surface-2)"><h3>Cliente: relatório diário da obra</h3><p class="muted small" style="margin:0 0 10px">O cliente recebe por e-mail, todo fim de dia em que houver trabalho, o progresso da obra e as tarefas concluídas. Só você vê estes dados.</p>') +
        '<div class="grid2">' + inputF("fin.clientEmail", t("projects.customerEmail", "E-mail do cliente"), "email", 'autocapitalize="none" inputmode="email"') + inputF("fin.clientPhone", t("projects.customerPhone", "Telefone do cliente"), "tel") + "</div>" +
        chooser("fin.dailyReport", { label: t("projects.sendDailyReport", "Enviar relatório diário"), opts: [t("projects.yes", "Sim"), t("projects.no", "Não")] }) + "</div>") + "</div>";
    } else if (step === 1) {
      var sec = d.details.sector, res = sec !== "Comercial", multi = res && d.details.building === "Multifamily";
      var unitsSel = function (label, max) { var v = String(d.details.unitsCount || ""), o = '<option value="">—</option>'; for (var i = 1; i <= max; i++) o += '<option' + (v === String(i) ? " selected" : "") + ">" + i + "</option>"; return '<label class="field" style="max-width:260px"><span>' + label + '</span><select data-bind="details.unitsCount" id="w-units">' + o + "</select></label>"; };
      body = '<div class="stack">' + chooser("details.workType", { label: t("projects.typeOfWork", "Tipo de trabalho"), opts: trade.workType }) + chooser("details.sector", COMMON_FIELDS.sector) +
        (sec === "Residencial" ? chooser("details.building", COMMON_FIELDS.buildingRes) + (multi ? unitsSel(t("projects.unitsApartments", "Unidades (apartamentos)"), 200) : "") + chooser("details.bedrooms", COMMON_FIELDS.bedrooms) + chooser("details.bathrooms", COMMON_FIELDS.bathrooms) : "") +
        (sec === "Comercial" ? unitsSel(t("projects.unitsApartmentsUpTo", "Unidades (apartamentos) — até 200"), 200) : "") +
        chooser("details.floors", COMMON_FIELDS.floors) +
        '<div class="grid2">' + inputF("details.sqft", t("projects.areaSqFt", "Área (sq ft)"), "number") + "</div></div>";
    } else if (step === 2) {
      body = '<div class="stack">' + chooser("details.permit", COMMON_FIELDS.permit) + inputF("details.permitNo", t("projects.permitNoTown", "Nº do permit / cidade")) +
        chooser("details.walls", COMMON_FIELDS.walls) + chooser("details.occupied", COMMON_FIELDS.occupied) + chooser("details.access", COMMON_FIELDS.access, true) + "</div>";
    } else if (step === 3) {
      var flags = coFlags(d.companyId); // opções escondidas para a empresa (ex.: "Não fazemos gás" → sem "Tubulação de gás: Sim"); o valor já gravado continua
      var warns = NV.tradeWarnings(trade.id, d.details || {}, flags); // avisos da ficha (ex.: pintura "Exterior" com tetos) — só aviso, não bloqueia
      body = '<div class="stack">' + warns.map(function (w) { return '<div class="trade-warn note-box" role="status">' + ic("info", 18) + " <span>" + esc(w) + "</span></div>"; }).join("") + Object.keys(trade.fields).map(function (k) { var f = trade.fields[k]; return chooser("details." + k, f.coHide || f.legacy ? Object.assign({}, f, { opts: NV.tradeOpts(trade.id, k, flags, d.details[k]) }) : f, f.multi); }).join("") +
        '<div class="grid2">' + trade.text.filter(function (t) { return t.key !== "unitsCount"; }).map(function (t) { return inputF("details." + t.key, t.label, t.type === "number" ? "number" : null, t.type === "number" ? 'inputmode="decimal" step="any"' : ""); }).join("") + "</div></div>";
    } else if (step === 4) {
      // modelos de tarefa: grupo gravado em PT (valor), rótulo novo no idioma de quem cria; tarefas já salvas em PT continuam reconhecidas
      var have = {}; d.tasks.forEach(function (t) { have[t.group + "|" + t.label] = true; });
      var isTpl = function (g, l) { var a = trade.tasks[g]; return !!a && (a.indexOf(l) >= 0 || a.map(tv).indexOf(l) >= 0); };
      var custom = d.tasks.filter(function (t) { return !isTpl(t.group, t.label); });
      body = t("projects.tapTheTasksThat", '<div class="spread" style="margin-bottom:12px"><p class="muted" style="margin:0;max-width:60ch">Toque nas tarefas que fazem parte deste trabalho. A equipe vê esta lista e marca o que for terminando.</p><button type="button" class="btn ghost sm" data-act="suggestTasks">Sugerir pela ficha da obra</button></div><div class="stack task-picker">') +
        Object.keys(trade.tasks).map(function (g) {
          return '<div class="opt-block"><span class="label">' + esc(tv(g)) + '</span><div class="chips">' + trade.tasks[g].map(function (l) { var on = have[g + "|" + l] || have[g + "|" + tv(l)]; return '<button type="button" class="chip' + (on ? " on" : "") + '" data-act="toggleTask" data-group="' + esc(g) + '" data-val="' + esc(tv(l)) + '" data-pt="' + esc(l) + '">' + (on ? "✓ " : "") + esc(tv(l)) + "</button>"; }).join("") + "</div></div>";
        }).join("") +
        t("projects.customTask", '<div class="panel"><h3>Tarefa personalizada</h3><div class="row"><input type="text" id="customTask" placeholder="Ex.: Mover painel para a garagem" style="flex:1 1 220px"><select id="customGroup" style="width:auto">') + Object.keys(trade.tasks).concat(["Outros"]).map(function (g) { return '<option value="' + esc(g) + '">' + esc(tv(g)) + "</option>"; }).join("") + t("projects.add", '</select><button type="button" class="btn" data-act="addTask">Adicionar</button></div>') +
        (custom.length ? '<div class="chips" style="margin-top:10px">' + custom.map(function (t) { return '<button type="button" class="chip on" data-act="toggleTask" data-group="' + esc(t.group) + '" data-val="' + esc(t.label) + '" data-pt="' + esc(t.label) + '">✕ ' + esc(t.label) + "</button>"; }).join("") + "</div>" : "") + "</div>" +
        '<div class="muted small">' + d.tasks.length + t("projects.tasksSelected", " tarefas selecionadas</div></div>");
    } else if (step === 5) {
      body = t("projects.employeesSeeTheScope", '<div class="stack"><div class="muted small">Os funcionários veem o escopo e o recado. Não coloque preços aqui.</div><div id="scopeWarn">') + scopeWarnHtml(d) + t("projects.contractScopePasteThe", '</div><label class="field"><span>Escopo do contrato (cole aqui o escopo que o contrato passa)</span><textarea id="w-scope" data-bind="scope" style="min-height:200px">') + esc(d.scope) + "</textarea></label>" +
        t("projects.notesForTheCrew2", '<label class="field"><span>Recado para a equipe (chave, horários, cuidados, material)</span><textarea id="w-teamNotes" data-bind="teamNotes">') + esc(d.teamNotes) + "</textarea></label>" +
        t("projects.drawingsAndDocuments", '<div><span class="label">Plantas e documentos</span>') +
        t("projects.chooseDrawingsPdfsFiles", '<label class="drop" style="margin-top:6px"><input type="file" data-act="wizFiles" multiple accept=".pdf,image/*,.dwg,.dxf,.doc,.docx,.xls,.xlsx"><b>Escolher plantas / PDFs</b><br><span class="small">Os arquivos são enviados quando você salvar o projeto</span></label>') +
        (S.draftFiles.length ? '<div class="chips" style="margin-top:8px">' + S.draftFiles.map(function (f, i) { return '<button type="button" class="chip" data-act="rmDraftFile" data-id="' + i + '">✕ ' + esc(f.name) + "</button>"; }).join("") + "</div>" : "") +
        (d.id && (projectById(d.id) || {}).files && projectById(d.id).files.length ? t("projects.alreadyUploaded", '<div class="muted small" style="margin-top:6px">Já enviados: ') + projectById(d.id).files.map(function (f) { return esc(f.name); }).join(", ") + "</div>" : "") +
        "</div></div>";
    } else if (step === 6 && can("finance")) {
      var lim = (Number(d.fin.materialBudget) || 0) + (Number(d.fin.laborBudget) || 0);
      body = t("projects.onlyTheAdminSees", '<div class="stack"><p class="muted" style="margin:0">Só o administrador vê estes valores. Os funcionários nunca veem preço, orçamento ou lucro.</p>') +
        '<div class="grid2">' + inputF("fin.contractValue", t("projects.contractValue", "Orçamento da obra (valor do contrato) $"), "number", 'step="0.01" inputmode="decimal"') + inputF("fin.estHours", t("projects.estimatedHours", "Horas previstas"), "number", 'inputmode="decimal"') + "</div>" +
        '<div class="grid2">' + inputF("fin.materialBudget", t("projects.materialSpendingLimit", "Quanto quero gastar em material (limite) $"), "number", 'step="0.01" inputmode="decimal"') + inputF("fin.laborBudget", t("projects.laborSpendingLimit", "Quanto quero gastar em mão de obra (limite) $"), "number", 'step="0.01" inputmode="decimal"') + "</div>" +
        t("projects.theDashboardTracksMaterial", '<p class="muted small" style="margin:0">O painel acompanha o gasto de material (pelas notas) e de mão de obra (pelas horas do ponto) contra estes limites.</p>') +
        t("projects.summary", '<div class="panel"><h3>Resumo</h3><div class="specs">') +
        [[t("projects.project", "Projeto"), d.name || "—"], [t("projects.type", "Tipo"), [d.details.sector, d.details.building, d.details.workType].filter(Boolean).join(" · ") || "—"], [t("projects.tasks2", "Tarefas"), d.tasks.length], [t("projects.filesToUpload", "Arquivos para enviar"), S.draftFiles.length], [t("projects.spendingLimit2", "Limite de gastos"), money(lim)], [t("projects.projectedProfit", "Lucro previsto"), money((Number(d.fin.contractValue) || 0) - lim)]].map(function (r) { return '<div class="spec"><div class="label">' + esc(r[0]) + '</div><div class="v">' + esc(r[1]) + "</div></div>"; }).join("") +
        "</div></div></div>";
    }
    return '<div class="page-head"><div><nav class="crumb" aria-label="Caminho"><button type="button" data-act="cancelWizard">' + ic("chevl", 16) + t("projects.cancel", "Cancelar</button><span>/</span><span>") + (d.id ? t("projects.edit", "Editar") : t("projects.new", "Novo")) + "</span></nav><h1>" + (d.id ? t("projects.editProject", "Editar projeto") : t("projects.newProject2", "Novo projeto")) + "</h1><p>" + esc(companyBrand(d.companyId).name) + "</p></div></div>" +
      '<div class="steps">' + steps.map(function (s, i) { return '<button data-act="wizGo" data-id="' + i + '" class="' + (i === step ? "on" : i < step ? "done" : "") + '">' + (i + 1) + ". " + esc(s) + "</button>"; }).join("") + "</div>" +
      '<div class="panel">' + body + '<div class="err" id="wizErr" hidden></div></div>' +
      '<div class="wiz-foot"><button class="btn ghost" data-act="wizGo" data-id="' + Math.max(0, step - 1) + '"' + (step === 0 ? " disabled" : "") + ">" + ic("chevl", 18) + t("projects.back2", "Voltar</button>") +
      '<div class="row">' + (step < steps.length - 1 ? t("projects.saveButtonClassBtn", '<button class="btn ghost" data-act="saveProject">Salvar</button><button class="btn" data-act="wizGo" data-id="') + (step + 1) + t("projects.next", '">Próximo') + ic("chevr", 18) + '</button>' : t("projects.saveProject", '<button class="btn" data-act="saveProject">Salvar projeto</button>')) + "</div></div>";
  }

  // ═══════════ time (admin) ═══════════
  function timeTable(list, withCost) {
    withCost = withCost && can("finance"); // custo da hora só para quem vê o financeiro
    return t("time.employeeProjectDateIn", '<div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Projeto</th><th>Data</th><th>Entrada</th><th>Saída</th><th class="n">Horas</th>') + (withCost ? t("time.cost", '<th class="n">Custo</th>') : "") + t("time.photosGps", "<th>Fotos</th><th>GPS</th>") + (isStaff() ? "<th></th>" : "") + "</tr></thead><tbody>" +
      (list.length ? list.map(function (t) {
        var p = projectById(t.projectId), h = hoursOf(t);
        var gps = t.inLoc && t.inLoc.ok ? '<span class="pill good">ok</span>' : NV.t("common.noGps", '<span class="pill warn">sem GPS</span>');
        return "<tr><td>" + esc(userName(t.userId)) + (t.updatedByName ? '<div class="by">' + byLine(NV.t("who.fixedBy", "Corrigido por {n}"), t.updatedByName, t.updatedAt) + "</div>" : "") + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + fmtDate(t.checkIn) + "</td><td>" + fmtTime(t.checkIn) + "</td><td>" + (t.checkOut ? fmtTime(t.checkOut) : NV.t("time.onTheClock", '<span class="pill good">trabalhando</span>')) + '</td><td class="n">' + (t.checkOut ? hrs(h) : "—") + "</td>" +
          (withCost ? '<td class="n">' + money(h * (t.rate || 0)) + "</td>" : "") +
          "<td>" + (t.inPhoto || t.outPhoto ? '<button class="btn ghost sm" data-act="viewPunch" data-id="' + t.id + NV.t("time.view", '">Ver</button>') : '<span class="muted">—</span>') + "</td><td>" + gps + "</td>" +
          (isStaff() ? '<td><button class="btn ghost sm" data-act="editTime" data-id="' + t.id + NV.t("time.fix", '">Corrigir</button></td>') : "") + "</tr>";
      }).join("") : emptyRow(10, t("time.noEntries", "Nenhum registro."))) + "</tbody></table></div>";
  }
  function timeView() {
    var f = S.filters;
    var list = S.time.filter(function (t) { return t.companyId === S.company && inPeriod(t.checkIn) && (!f.projectId || t.projectId === f.projectId) && (!f.userId || t.userId === f.userId); });
    var now = S.time.filter(function (t) { return t.companyId === S.company && !t.checkOut; });
    var tot = list.reduce(function (a, t) { return a + hoursOf(t); }, 0), cost = list.reduce(function (a, t) { return a + hoursOf(t) * (t.rate || 0); }, 0);
    var fin = can("finance"); // gerente: vê entradas, saídas, fotos e GPS; sem pagamento da semana nem custo
    return t("time.timeClock", '<div class="page-head"><div><h1>Registro de ponto</h1><p>') + (fin ? t("time.punchInOutWith", "Entradas e saídas com foto e GPS · pagamento da semana") : esc(t("time.subMgr", "Entradas e saídas com foto e GPS"))) + "</p></div></div>" + (fin ? payrollPanel() : "") + filtersBar() +
      t("time.workingNow", '<div class="grid3 keep2" style="margin-bottom:14px"><div class="panel"><div class="label">Trabalhando agora</div><div class="kpi-value v-good">') + now.length + '</div><div class="kpi-sub">' + (now.map(function (t) { return esc(userName(t.userId)); }).join(", ") || t("time.nobody", "ninguém")) + t("time.hoursInPeriod", '</div></div><div class="panel"><div class="label">Horas no período</div><div class="kpi-value v-info">') + hrs(tot) + "</div></div>" +
      (fin ? t("time.costInPeriod", '<div class="panel"><div class="label">Custo no período</div><div class="kpi-value">') + money(cost) + "</div></div>" : '<div class="panel"><div class="label">' + esc(t("time.records", "Registros no período")) + '</div><div class="kpi-value">' + list.length + "</div></div>") + "</div>" +
      timeTable(list.slice(0, 400), true);
  }

  // ═══════════ team ═══════════
  function teamView() {
    var list = S.users.filter(function (u) { return u.companyId === S.company || u.role === "admin"; });
    return t("team.team", '<div class="page-head"><div><h1>Equipe</h1><p>') + esc(companyName(S.company)) + t("team.newEmployee", '</p></div><button class="btn" data-act="newUser">+ Novo funcionário</button></div>') +
      t("team.nameUsernameRoleHourly", '<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Função</th><th class="n">Valor/hora</th><th>Status</th><th></th></tr></thead><tbody>') +
      list.map(function (u) {
        return "<tr><td><b>" + esc(u.name) + "</b></td><td>" + esc(u.username) + "</td><td>" + (u.role === "manager" ? '<span class="pill accent">' + esc(roleLabel(u)) + "</span>" : esc(roleLabel(u))) + '</td><td class="n">' + (u.role === "admin" ? "—" : money(u.rate, 2)) + "</td><td>" + (u.active ? t("team.active", '<span class="pill good">Ativo</span>') : t("team.inactive", '<span class="pill neutral">Inativo</span>')) + '</td><td><button class="btn ghost sm" data-act="editUser" data-id="' + u.id + t("team.edit", '">Editar</button></td></tr>');
      }).join("") + "</tbody></table></div>";
  }

  // ═══════════ reports ═══════════
  function reportsView() {
    var f = S.filters;
    var emps = S.users.filter(function (u) { return u.companyId === S.company && !isStaff(u); });
    var payroll = emps.map(function (u) { var l = S.time.filter(function (t) { return t.userId === u.id && inPeriod(t.checkIn) && t.checkOut; }); var h = l.reduce(function (a, t) { return a + hoursOf(t); }, 0); return { u: u, days: l.length, h: h, cost: l.reduce(function (a, t) { return a + hoursOf(t) * (t.rate || 0); }, 0) }; });
    return t("reports.reportsTimesheetAndProfitability", '<div class="page-head"><div><h1>Relatórios</h1><p>Folha de horas e lucratividade por projeto</p></div></div>') + filtersBar({ noUser: true }) +
      t("reports.timesheet", '<div class="section-title"><h3>Folha de horas · ') + periodLabel() + t("reports.downloadCsv", '</h3><button class="btn ghost sm" data-act="csv" data-id="payroll">Baixar CSV</button></div>') +
      t("reports.employeeDaysHoursHourly", '<div class="table-wrap"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Valor/hora</th><th class="n">Total a pagar</th></tr></thead><tbody>') +
      payroll.map(function (r) { return "<tr><td>" + esc(r.u.name) + '</td><td class="n">' + r.days + '</td><td class="n">' + hrs(r.h) + '</td><td class="n">' + money(r.u.rate, 2) + '</td><td class="n"><b>' + money(r.cost, 2) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
      t("reports.profitabilityByProjectTo", '<div class="section-title"><h3>Lucratividade por projeto (acumulado)</h3><button class="btn ghost sm" data-act="csv" data-id="profit">Baixar CSV</button></div>') +
      t("reports.projectStatusContractValue", '<div class="table-wrap"><table><thead><tr><th>Projeto</th><th>Status</th><th class="n">Valor da obra</th><th class="n">Mão de obra</th><th class="n">Despesas</th><th class="n">Gasto total</th><th class="n">Recebido</th><th class="n">Lucro previsto</th></tr></thead><tbody>') +
      companyProjects().map(function (p) { var s = projectStats(p); return '<tr class="click" data-act="openProject" data-id="' + p.id + '"><td>' + esc(p.name) + "</td><td>" + statusPill(p.status) + '</td><td class="n">' + money(s.contract) + '</td><td class="n">' + money(s.labor) + '</td><td class="n">' + money(s.exp) + '</td><td class="n">' + money(s.cost) + '</td><td class="n">' + money(s.revenue) + '</td><td class="n"><b class="' + (s.contract - s.cost >= 0 ? "v-good" : "v-bad") + '">' + money(s.contract - s.cost) + "</b></td></tr>"; }).join("") +
      "</tbody></table></div>";
  }
  function csv(kind) {
    var rows;
    if (kind === "payroll") {
      rows = [[t("reports.employee", "Funcionário"), t("reports.date", "Data"), t("reports.project", "Projeto"), t("reports.in", "Entrada"), t("reports.out", "Saída"), t("reports.hours", "Horas"), t("reports.hourlyRate", "Valor/hora"), "Total"]];
      S.time.filter(function (t) { return t.companyId === S.company && inPeriod(t.checkIn) && t.checkOut; }).forEach(function (t) { var h = hoursOf(t), p = projectById(t.projectId); rows.push([userName(t.userId), fmtDate(t.checkIn), p ? p.name : "", fmtTime(t.checkIn), fmtTime(t.checkOut), h.toFixed(2), t.rate, (h * t.rate).toFixed(2)]); });
    } else {
      rows = [[t("reports.project", "Projeto"), t("reports.status", "Status"), t("reports.contractValue", "Valor da obra"), t("reports.contract", "Orçamento"), t("reports.labor", "Mão de obra"), t("reports.expenses", "Despesas"), t("reports.totalSpent", "Gasto total"), t("reports.received", "Recebido"), t("reports.projectedProfit", "Lucro previsto")]];
      companyProjects().forEach(function (p) { var s = projectStats(p); rows.push([p.name, statusLabel(p.status), s.contract, s.budget, s.labor.toFixed(2), s.exp.toFixed(2), s.cost.toFixed(2), s.revenue.toFixed(2), (s.contract - s.cost).toFixed(2)]); });
    }
    csvDownload((kind === "payroll" ? t("reports.payrollFile", "folha-de-horas") : t("reports.profitFile", "lucratividade")) + "-" + todayISO() + ".csv", rows, true);
    toast(t("reports.csvFileCreated", "Arquivo CSV gerado."));
  }
  // baixa um CSV (BOM para o Excel abrir com acento); usado também em Configurações → Dados
  function csvDownload(name, rows, quiet) {
    var text = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    if (!quiet) toast(t("csv.done", "Arquivo CSV gerado."));
  }

  // ═══════════ employee shell ═══════════
  function employeeShell() {
    var cur = navActive(S.view);
    var side = t("nav.sidebarAria", '<aside class="sidebar" aria-label="Menu principal">') + coCard(S.user.companyId, false) + '<nav class="nav">' + navGroups(EMP_GROUPS, cur) + "</nav>" + sideFoot(t("dashboard.employee", "Funcionário")) + "</aside>";
    var top = '<header class="topbar">' + searchBtn() + '<span class="sp"></span>' + helpBtn() + themeBtn() + "</header>";
    var mtop = '<header class="m-top">' + coCard(S.user.companyId, false, true) + t("common.html2", '<span class="sp"></span><button type="button" class="icon-btn" data-act="search" aria-label="Buscar">') + ic("search") + "</button>" + helpBtn() + themeBtn() + "</header>";
    var mob = '<nav class="bottom-nav" aria-label="Menu">' + EMP_NAV.map(function (n) { return '<button type="button" data-act="nav" data-id="' + n[0] + '" class="' + (cur === n[0] ? "on" : "") + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + ic(n[0] === "me" ? "user" : n[2], 24) + "<span>" + esc(n[0] === "me" ? t("nav.me", "Eu") : n[1]) + "</span></button>"; }).join("") + "</nav>";
    var body = ({ punch: punchView, jobs: jobsView, project: projectView, notas: notasView, escala: minhaEscalaView, myexp: myExpView, me: meView })[S.view] || punchView;
    return '<div class="shell">' + side + '<div class="main">' + top + mtop + '<main class="content" id="conteudo" tabindex="-1">' + offlineFlag() + (API.mode === "demo" ? '<div class="demo-flag">' + ic("eye", 18) + t("nav.demoModeSampleData", "<span>Modo demonstração — dados de exemplo.</span></div>") : "") + (S.loading ? skeletonView() : body()) + "</main></div></div>" + mob;
  }

  function nearest() {
    if (!S.loc || !S.loc.ok) return null;
    var best = null;
    S.projects.forEach(function (p) {
      if (p.lat == null || p.lng == null || p.status === "Completed" || p.status === "Cancelled") return;
      var d = dist(S.loc.lat, S.loc.lng, p.lat, p.lng);
      if (!best || d < best.d) best = { p: p, d: d };
    });
    return best;
  }
  function dist(a, b, c, d) { var R = 6371000, toR = Math.PI / 180, dLat = (c - a) * toR, dLng = (d - b) * toR; var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return 2 * R * Math.asin(Math.sqrt(x)); }

  function punchView() {
    var open = S.open, jobs = S.projects.filter(function (p) { return p.status === "Active" || p.status === "Planned"; });
    var near = nearest(), autoId = near && near.d <= (near.p.radius || 150) ? near.p.id : "";
    var tdy = todayISO(); ensureRange("shifts", tdy, addDays(tdy, 14), API.listSchedule);
    var todayShifts = myScheduleList(0);
    if (!S.params.projectId && autoId) S.params.projectId = autoId;
    if (!S.params.projectId && todayShifts.length) S.params.projectId = todayShifts[0].projectId;
    var locLine = !S.loc ? t("time.gettingYourLocation", '<div class="loc-bad">Buscando sua localização…</div>') : S.loc.ok ? (near ? '<div class="' + (autoId ? "loc-ok" : "loc-bad") + '">' + (autoId ? t("time.youReAtThe", "Você está na obra: ") + esc(near.p.name) : t("time.nearestJob", "Obra mais próxima: ") + esc(near.p.name) + " (" + (near.d > 1000 ? (near.d / 1000).toFixed(1) + " km" : Math.round(near.d) + " m") + ")") + "</div>" : t("time.locationOk", '<div class="loc-ok">Localização ok</div>')) : t("time.locationUnavailableTurnOn", '<div class="loc-bad">Localização indisponível. Ative o GPS para o ponto ficar completo.</div>');
    var mine = S.time.filter(function (t) { return t.userId === S.user.id; });
    var weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    var weekH = mine.filter(function (t) { return new Date(t.checkIn) >= weekStart; }).reduce(function (a, t) { return a + hoursOf(t); }, 0);
    // turno em andamento conta nas horas da semana (antes ficava 0.0h com o funcionário trabalhando)
    var openH = S.open && S.open.checkIn && !S.open.checkOut && new Date(S.open.checkIn) >= weekStart ? Math.max(0, (Date.now() - new Date(S.open.checkIn)) / 36e5) : 0;
    weekH += openH;
    var card;
    if (open) {
      var p = projectById(open.projectId);
      card = t("time.onTheClockSince", '<div class="clock-card"><div class="label">Trabalhando desde ') + fmtTime(open.checkIn) + (p ? " · " + esc(p.name) : "") + '</div><div class="time" id="ticker">00:00:00</div>' + locLine +
        '<button class="clock-btn out" data-act="punch" data-id="out">' + ic("camera", 24) + t("time.punchOutTheApp", 'Bater saída</button><div class="clock-hint">O app vai pedir uma selfie e a localização.</div></div>');
    } else {
      card = '<div class="clock-card"><div class="label">' + new Date().toLocaleDateString(LOCALE, { weekday: "long", day: "2-digit", month: "long" }) + '</div><div class="time" id="ticker">' + new Date().toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) + "</div>" + locLine +
        t("time.job", '<label class="field" style="text-align:left"><span style="color:var(--nav-ink)">Obra</span><select id="punchProject" data-act="punchProject">') + t("time.selectTheJob", '<option value="">Selecione a obra</option>') + jobs.map(function (j) { return '<option value="' + j.id + '"' + (S.params.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
        '<button class="clock-btn in" data-act="punch" data-id="in">' + ic("camera", 24) + t("time.punchInTheApp", 'Bater entrada</button><div class="clock-hint">O app vai pedir uma selfie e a localização.</div></div>');
    }
    var pend = API.pendingPunches ? API.pendingPunches() : 0;
    return t("time.hi", '<div class="page-head"><div><h1>Olá, ') + esc(S.user.name.split(" ")[0]) + "</h1><p>" + esc(companyName(S.user.companyId)) + "</p></div></div>" +
      (pend ? '<div class="demo-flag">' + pend + t("time.punchEsSavedOffline", " ponto(s) salvos sem internet. Serão enviados quando a conexão voltar.</div>") : "") +
      (todayShifts.length ? t("time.yourScheduleToday", '<div class="panel today-card" style="margin-bottom:12px"><div class="label">Sua escala de hoje</div>') + todayShifts.map(function (x) { var p = projectById(x.projectId); return '<div style="font-size:17px;font-weight:600;margin-top:4px">' + (x.start ? x.start + " · " : "") + esc(p ? p.name : t("time.job2", "Obra")) + "</div>" + (x.note ? '<div class="small">' + ic("note", 16) + " "  + esc(x.note) + "</div>" : ""); }).join("") + "</div>" : "") +
      '<input type="file" id="selfie" accept="image/*" capture="user" hidden>' + card +
      t("time.hoursThisWeek", '<div class="grid2" style="margin-top:14px"><div class="panel"><div class="label">Horas nesta semana</div><div class="kpi-value v-info">') + hrs(weekH) + (openH ? '<div class="small muted">' + esc(t("time.includesOpenShift", "inclui o turno de agora")) + "</div>" : "") + t("time.daysWorked30Days", '</div></div><div class="panel"><div class="label">Dias trabalhados (30 dias)</div><div class="kpi-value">') + daysWorked30(mine) + "</div></div></div>" +
      t("time.myEntriesDayAnd", '<div class="section-title"><h3>Meus registros</h3></div><div class="table-wrap"><table><thead><tr><th>Dia e obra</th><th>Horário</th><th class="n">Horas</th></tr></thead><tbody>') +
      (mine.length ? mine.slice(0, 20).map(function (t) { var p = projectById(t.projectId); return "<tr><td><b>" + fmtDate(t.checkIn) + '</b><div class="muted small">' + esc(p ? p.name : "—") + "</div></td><td>" + fmtTime(t.checkIn) + " – " + (t.checkOut ? fmtTime(t.checkOut) : NV.t("time.now", "agora")) + '</td><td class="n">' + (t.checkOut ? hrs(hoursOf(t)) : "—") + "</td></tr>"; }).join("") : emptyRow(3, t("time.noEntriesYet", "Nenhum registro ainda."))) +
      "</tbody></table></div>";
  }
  var tick = null;
  function startTicker() {
    clearInterval(tick);
    tick = setInterval(function () {
      var el = $("#ticker"); if (!el) { clearInterval(tick); return; }
      if (S.open) { var s = Math.max(0, Math.floor((Date.now() - new Date(S.open.checkIn)) / 1000)); el.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(function (n) { return String(n).padStart(2, "0"); }).join(":"); }
      else el.textContent = new Date().toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
    }, 1000);
  }

  function jobsView() {
    var list = S.projects.filter(function (p) { return p.status !== "Cancelled"; });
    return t("time.jobsWhatNeedsTo", '<div class="page-head"><div><h1>Obras</h1><p>O que vai ser feito em cada trabalho</p></div></div>') +
      (list.length ? '<div class="proj-list">' + list.map(function (p) {
        var s = projectStats(p), d = p.details || {};
        return '<button type="button" class="pcard" data-act="openProject" data-id="' + p.id + '"><div class="pcard-top"><h2>' + esc(p.name) + "</h2>" + statusPill(p.status) + '</div><div class="muted small pcard-meta">' + esc(p.address || "") + '</div><div class="chips">' +
          [d.sector, d.workType, d.building, d.permit ? "Permit: " + tv(d.permit) : ""].filter(Boolean).map(function (x) { return '<span class="tag">' + esc(tv(x)) + "</span>"; }).join("") +
          t("time.tasksDone", '</div><div><div class="spread small"><span class="muted">Tarefas feitas</span><b class="num">') + s.done + "/" + s.total + "</b></div>" + level(pct(s.done, s.total), { sm: true, bubble: false, label: t("time.tasksDone2", "Tarefas feitas ") + fmtPct(pct(s.done, s.total)) }) + "</div></button>";
      }).join("") + "</div>" : emptyState({ icon: "folder", title: t("time.noActiveJobsRight", "Nenhuma obra ativa no momento"), text: t("time.whenTheAdminAdds", "Quando o administrador cadastrar uma obra, ela aparece aqui.") }));
  }

  function myExpView() {
    var mine = S.expenses.filter(function (x) { return x.createdBy === S.user.id; });
    var jobs = S.projects.filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed"; });
    return t("expenses.expensesLogGasMaterial", '<div class="page-head"><div><h1>Gastos</h1><p>Lance gasolina, material comprado e outras despesas da obra</p></div></div>') +
      '<form class="panel stack" id="empExpForm">' + expenseFields(jobs, false) + t("expenses.submitExpense", '<button class="btn block" type="submit">Enviar gasto</button></form>') +
      t("expenses.myEntriesDateType", '<div class="section-title"><h3>Meus lançamentos</h3></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Obra</th><th class="n">Valor</th></tr></thead><tbody>') +
      (mine.length ? mine.slice(0, 30).map(function (x) { var p = projectById(x.projectId); return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(catLabel(x.category)) + "</td><td>" + esc(p ? p.name : "—") + '</td><td class="n">' + money(x.amount, 2) + "</td></tr>"; }).join("") : emptyRow(4, t("expenses.noExpensesLogged", "Nenhum gasto lançado."))) +
      "</tbody></table></div>";
  }
  function expenseFields(jobs, admin) {
    var cats = EXPENSE_CATS.filter(function (c) { return c.id !== "labor" && (admin || ["gasolina", "material", "equipamento", "outros"].indexOf(c.id) >= 0); });
    return (admin ? t("expenses.typeExpenseMoneyOut", '<label class="field"><span>Tipo</span><select id="xKind"><option value="expense">Despesa (saída)</option><option value="revenue">Receita (pagamento recebido)</option></select></label>') : "") +
      t("expenses.category", '<div class="grid2"><label class="field"><span>Categoria</span><select id="xCat">') + cats.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + "</option>"; }).join("") + "</select></label>" +
      t("expenses.amount", '<label class="field"><span>Valor $</span><input type="number" id="xAmt" step="0.01" inputmode="decimal" required></label></div>') +
      t("expenses.jobNoSpecificJob", '<div class="grid2"><label class="field"><span>Obra</span><select id="xProj"><option value="">Sem obra específica</option>') + jobs.map(function (j) { return '<option value="' + j.id + '"' + (S.filters.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
      t("expenses.dateInputTypeDate", '<label class="field"><span>Data</span><input type="date" id="xDate" value="') + todayISO() + '" required></label></div>' +
      t("expenses.vendorDescription", '<label class="field"><span>Fornecedor / descrição</span><input type="text" id="xVendor" placeholder="Ex.: Home Depot, Shell"></label>') +
      t("expenses.receiptPhotoOptional", '<label class="field"><span>Foto do recibo (opcional)</span><input type="file" id="xReceipt" accept="image/*" capture="environment"></label>');
  }

  function meView() {
    return t("me.profileName", '<div class="page-head"><div><h1>Perfil</h1></div></div><div class="panel stack"><div><div class="label">Nome</div><div class="kpi-value">') + esc(S.user.name) + t("me.company", '</div></div><div><div class="label">Empresa</div><div>') + esc(companyName(S.user.companyId)) + t("me.username", '</div></div><div><div class="label">Usuário</div><div>') + esc(S.user.username) + "</div></div>" +
      installHelp() + t("me.signOut", '<button class="btn ghost" data-act="logout">Sair</button></div>');
  }
  function installHelp() {
    return t("nav.installOnYourPhone", '<div class="panel" style="background:var(--surface-2)"><h3>Instalar no celular</h3>') + (S.installEvt ? t("nav.installTheApp2", '<button class="btn" data-act="install" style="margin-top:6px">Instalar o app</button>') : t("nav.iphoneOpenInSafari", '<div class="small">iPhone: abra no Safari → botão Compartilhar → “Adicionar à Tela de Início”.<br>Android: menu ⋮ do Chrome → “Instalar app”.</div>')) + "</div>";
  }

  // ═══════════ pagamento da semana (domingo a sábado) ═══════════
  function weekRange(offset) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 7 * (offset || 0));
    var end = new Date(d); end.setDate(d.getDate() + 6);
    return { from: isoLocal(d), to: isoLocal(end) };
  }
  function payrollFor(w) {
    var rows = {};
    S.time.forEach(function (t) {
      if (t.companyId !== S.company) return;
      var day = isoLocal(new Date(t.checkIn)); if (day < w.from || day > w.to) return;
      var u = userById(t.userId); if (u && isStaff(u)) return;
      var r = rows[t.userId] || (rows[t.userId] = { id: t.userId, name: userName(t.userId), hours: 0, pay: 0, days: {}, open: 0, rate: t.rate || 0 });
      if (!t.checkOut) { r.open++; return; }
      var h = hoursOf(t); r.hours += h; r.pay += h * (t.rate || 0); r.days[day] = 1;
    });
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.nDays = Object.keys(r.days).length; return r; }).sort(function (a, b) { return b.pay - a.pay; });
    return { list: list, total: list.reduce(function (a, r) { return a + r.pay; }, 0), hours: list.reduce(function (a, r) { return a + r.hours; }, 0) };
  }
  function payrollPanel() {
    var off = S.payWeek || 0, w = weekRange(off), pr = payrollFor(w);
    var isSat = new Date().getDay() === 6;
    return t("time.weeklyPaySunday", '<div class="panel" style="margin-bottom:14px"><div class="spread"><div><h3 style="margin:0">Pagamento da semana</h3><div class="muted small">Domingo ') + fmtDate(w.from) + t("time.toSaturday", " a sábado ") + fmtDate(w.to) + t("time.landsInYourEmail", " · todo sábado à noite chega no seu e-mail</div></div>") +
      '<div class="chips"><button type="button" class="chip' + (off === 0 ? " on" : "") + t("time.thisWeekButtonType", '" data-act="payWeek" data-id="0">Esta semana</button><button type="button" class="chip') + (off === -1 ? " on" : "") + t("time.lastWeek", '" data-act="payWeek" data-id="-1">Semana passada</button></div></div>') +
      t("time.employeeDaysHoursHourly", '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Funcionário</th><th class="n">Dias</th><th class="n">Horas</th><th class="n">Valor/hora</th><th class="n">A pagar</th></tr></thead><tbody>') +
      (pr.list.length ? pr.list.map(function (r) { return "<tr><td><b>" + esc(r.name) + "</b>" + (r.open ? t("time.missingPunchOut", ' <span class="pill warn">ponto sem saída</span>') : "") + '</td><td class="n">' + r.nDays + '</td><td class="n">' + hrs(r.hours) + '</td><td class="n">' + money(r.rate, 2) + '</td><td class="n"><b>' + money(r.pay, 2) + "</b></td></tr>"; }).join("") +
        '<tr class="total-row"><td><b>Total' + (off === 0 && !isSat ? t("time.soFar", " até agora") : "") + '</b></td><td></td><td class="n"><b>' + hrs(pr.hours) + '</b></td><td></td><td class="n"><b>' + money(pr.total, 2) + "</b></td></tr>"
        : emptyRow(5, t("time.noHoursThisWeek", "Nenhuma hora nesta semana."))) + "</tbody></table></div>" +
      t("time.emailItToMe", '<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="payEmail">Mandar para o meu e-mail agora</button></div></div>').replace(/<\/div><\/div>$/, demoNote() + "</div></div>");
  }

  // ═══════════ avisos ═══════════
  function openNotices() { return (S.notices || []).filter(function (n) { return !n.resolved; }); }
  function noticeCard(n, withProject) {
    var p = projectById(n.projectId), admin = isStaff();
    var au = n.authorName || userName(n.userId);
    return '<div class="notice' + (n.resolved ? " done" : "") + '"><div class="spread"><div class="notice-who"><span class="avatar xs soft" aria-hidden="true">' + esc(initials(au)) + '</span><div><b>' + esc(au) + "</b>" + (withProject ? ' · <a href="#" data-act="openProject" data-id="' + esc(n.projectId || "") + '">' + esc(p ? p.name : t("notices.noJob", "Sem obra")) + "</a>" : "") +
      '<div class="muted small">' + esc(whenShort(n.createdAt)) + (n.resolved && !n.resolvedByName ? t("notices.resolved", " · resolvido") : "") + "</div>" + (n.resolved && n.resolvedByName ? '<div class="by">' + byLine(t("who.resolvedBy", "Resolvido por {n}"), n.resolvedByName, n.resolvedAt) + "</div>" : "") + "</div></div>" +
      (admin ? '<div class="row">' + (n.photo ? '<button class="btn ghost sm" data-act="noticePhoto" data-id="' + n.id + t("notices.photo", '">Foto</button>') : "") + '<button class="btn ' + (n.resolved ? "ghost" : "") + ' sm" data-act="noticeResolve" data-id="' + n.id + '">' + (n.resolved ? t("notices.reopen", "Reabrir") : t("notices.resolved2", "Resolvido ✓")) + '</button><button class="btn ghost sm" data-act="noticeDel" data-id="' + n.id + t("notices.html", '" aria-label="Apagar">✕</button></div>')
        : (n.photo ? '<button class="btn ghost sm" data-act="noticePhoto" data-id="' + n.id + t("notices.photo", '">Foto</button>') : "")) +
      '</div><div class="notice-text">' + esc(n.text) + "</div></div>";
  }
  function noticesBlock(p) {
    var list = (S.notices || []).filter(function (n) { return n.projectId === p.id; });
    return '<form class="panel stack" id="noticeForm" data-pid="' + p.id + t("time.newNoticeSomethingThat", '"><h3 style="margin:0">Novo aviso</h3><p class="muted small" style="margin:0">Algo que precisa ser feito, material faltando, problema na obra… O administrador recebe na hora.</p>') +
      t("time.html", '<textarea id="nText" rows="3" required placeholder="Ex.: Falta 2 caixas de 4 polegadas no 2º andar. Cliente pediu mais uma tomada na cozinha."></textarea>') +
      t("time.photoOptional", '<label class="field"><span>Foto (opcional)</span><input type="file" id="nPhoto" accept="image/*" capture="environment"></label>') +
      t("time.sendNotice", '<button class="btn" type="submit">Enviar aviso</button></form>') +
      t("time.noticesForThisJob", '<div class="section-title"><h3>Avisos desta obra</h3></div>') +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (n) { return noticeCard(n, false); }).join("") + "</div>" : emptyState({ icon: "bell", title: t("time.noNoticesYet", "Nenhum aviso ainda"), text: t("time.useTheFormAbove", "Use o formulário acima para avisar sobre material, problema ou pedido do cliente.") }));
  }
  function avisosView() {
    var show = S.noticeFilter || "open", list = (S.notices || []).filter(function (n) { return show === "all" || !n.resolved; });
    return t("notices.noticesWhatTheCrew", '<div class="page-head"><div><h1>Avisos</h1><p>O que a equipe reportou nas obras · você recebe um e-mail a cada aviso novo</p></div></div>') +
      '<div class="chips" style="margin-bottom:12px"><button type="button" class="chip' + (show === "open" ? " on" : "") + t("notices.open", '" data-act="noticeFilter" data-id="open">Abertos (') + openNotices().length + ')</button><button type="button" class="chip' + (show === "all" ? " on" : "") + t("notices.all", '" data-act="noticeFilter" data-id="all">Todos</button></div>') +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (n) { return noticeCard(n, true); }).join("") + "</div>" : emptyState({ icon: "bell", title: show === "open" ? t("notices.noOpen", "Nenhum aviso aberto") : t("notices.none", "Nenhum aviso"), text: t("notices.whenSomeoneOnThe", "Quando alguém da equipe reportar algo numa obra, aparece aqui."), cta: { act: "noticeNew", label: t("notices.newNotice", "Novo aviso") } }));
  }

  // ═══════════ notas (foto da nota → obra + categoria) ═══════════
  var NOTA_CATS = [["material", "Material"], ["permit", t("catalog.permit", "Permit")], ["outros", t("receipts.other", "Outros")], ["equipamento", t("receipts.equipmentRental", "Equipamento / aluguel")]];
  function notasView() {
    var n = S.nota, admin = isStaff(), fin = !admin || can("finance"); // gerente vê as notas da equipe sem os valores
    var jobs = S.projects.filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed" && (admin ? p.companyId === S.company : true); });
    var top;
    if (!n) {
      top = '<label class="nota-cam" tabindex="0" role="button"><input type="file" id="notaFile" accept="image/*" capture="environment" hidden>' + ICON.receipt + t("receipts.takeAPhotoOf", "<b>Tirar foto da nota</b><span>O app lê a nota e descobre de qual obra ela é</span></label>");
    } else {
      var a = n.ai || {};
      top = '<form class="panel stack" id="notaForm"><div class="nota-row"><img src="' + esc(n.preview) + t("receipts.html", '" alt="Foto da nota" class="nota-img"><div class="stack" style="gap:10px;flex:1;min-width:0">') +
        (n.status === "lendo" ? t("receipts.readingTheReceipt", '<div class="pill accent"><span class="spin" aria-hidden="true"></span> Lendo a nota…</div>')
          : n.status === "erro" ? '<div class="pill warn">' + esc(n.msg || t("receipts.couldnTReadThe", "Não consegui ler a nota. Preencha abaixo.")) + "</div>"
            : '<div class="pill good">' + (a.project_id ? t("receipts.jobIdentifiedFromThe", "Obra identificada pela nota") : t("receipts.receiptReadChooseThe", "Nota lida — escolha a obra")) + "</div>" + (a.summary_pt ? '<div class="small muted">' + esc(a.summary_pt) + "</div>" : "")) +
        t("receipts.jobChooseTheJob", '<label class="field"><span>Obra</span><select id="nfProj" required><option value="">Escolha a obra</option>') + jobs.map(function (j) { return '<option value="' + j.id + '"' + (n.projectId === j.id ? " selected" : "") + ">" + esc(j.name) + "</option>"; }).join("") + "</select></label>" +
        t("receipts.type", '<div><span class="label">Tipo</span><div class="chips" style="margin-top:6px">') + NOTA_CATS.map(function (c) { return '<button type="button" class="chip' + (n.category === c[0] ? " on" : "") + '" data-act="notaCat" data-id="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div></div>" +
        t("receipts.totalAmountInputType", '<div class="grid2"><label class="field"><span>Valor total $</span><input type="number" id="nfAmt" step="0.01" inputmode="decimal" required value="') + esc(n.amount == null ? "" : n.amount) + '"></label>' +
        t("receipts.dateInputTypeDate", '<label class="field"><span>Data</span><input type="date" id="nfDate" required value="') + esc(n.date || todayISO()) + '"></label></div>' +
        t("receipts.storeVendorInputType", '<label class="field"><span>Loja / fornecedor</span><input type="text" id="nfVendor" value="') + esc(n.vendor || "") + '"></label>' +
        '<div class="row"><button class="btn" type="submit"' + (n.status === "lendo" || n.saving ? " disabled" : "") + t("receipts.saveReceiptCancel", '>Salvar nota</button><button type="button" class="btn ghost" data-act="notaCancel">Cancelar</button></div></div></div></form>');
    }
    var mine = S.expenses.filter(function (x) { return x.receipt && x.kind !== "revenue" && (admin || x.createdBy === S.user.id); }).slice(0, 40), cols = 5 + (admin ? 1 : 0) + (fin ? 1 : 0);
    return t("receipts.receiptsSnapThePurchase", '<div class="page-head"><div><h1>Notas</h1><p>Foto da nota de compra → entra na obra certa e no gasto da categoria</p></div></div>') + top +
      '<div class="section-title"><h3>' + (admin ? t("receipts.latestReceipts", "Últimas notas") : t("receipts.myReceipts", "Minhas notas")) + t("receipts.dateJobTypeStore", '</h3></div><div class="table-wrap"><table><thead><tr><th>Data</th><th>Obra</th><th>Tipo</th><th>Loja</th>') + (admin ? t("receipts.enteredBy", "<th>Lançado por</th>") : "") + (fin ? t("receipts.amount", '<th class="n">Valor</th>') : "") + "<th></th></tr></thead><tbody>" +
      (mine.length ? mine.map(function (x) { var p = projectById(x.projectId); return "<tr><td>" + fmtDate(x.date) + "</td><td>" + esc(p ? p.name : "—") + "</td><td>" + esc(catLabel(x.category)) + "</td><td>" + esc(x.vendor || "") + "</td>" + (admin ? "<td>" + byCell(x.createdByName || (x.createdBy ? userName(x.createdBy) : ""), x.createdAt || x.date) + "</td>" : "") + (fin ? '<td class="n"><b>' + money(x.amount, 2) + "</b></td>" : "") + '<td class="n"><button class="btn ghost sm" data-act="viewReceipt" data-id="' + x.id + t("receipts.view", '">Ver</button></td></tr>'); }).join("")
        : emptyRow(cols, t("receipts.noReceiptsYet", "Nenhuma nota ainda."))) + "</tbody></table></div>";
  }
  function startNota(file) {
    var reader = new FileReader();
    compress(file, 1600).then(function (blob) {
      reader.onload = function () {
        S.nota = { preview: reader.result, status: "lendo", category: "material", date: todayISO() }; render();
        API.uploadReceipt(blob).then(function (path) {
          S.nota.path = path;
          return API.readReceipt(path);
        }).then(function (res) {
          if (!S.nota) return;
          if (res && res.ok) {
            var a = res.result || {}; S.nota.ai = a; S.nota.status = "pronto";
            if (a.project_id) S.nota.projectId = a.project_id;
            if (a.total != null) S.nota.amount = a.total;
            if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) S.nota.date = a.date;
            if (a.vendor) S.nota.vendor = a.vendor;
            if (a.category) S.nota.category = a.category;
            if (a.readable === false) { S.nota.status = "erro"; S.nota.msg = t("receipts.thePhotoWasHard", "A foto ficou difícil de ler. Confira os dados ou tire outra foto."); }
          } else {
            S.nota.status = "erro";
            S.nota.msg = { NO_KEY: "A leitura automática ainda não está ligada. Preencha abaixo.", DEMO: t("receipts.demoModeFillIt", "Modo demonstração: preencha abaixo."), NOT_DEPLOYED: t("receipts.automaticReadingIsnT", "A leitura automática ainda não foi instalada. Preencha abaixo.") }[res && res.error] || t("receipts.couldnTReadThe2", "Não consegui ler a nota agora. Preencha abaixo.");
          }
          render();
        }).catch(function (e) { if (!S.nota) return; S.nota.status = "erro"; S.nota.msg = (e && e.message) || t("receipts.errorUploadingThePhoto", "Erro ao enviar a foto."); render(); });
      };
      reader.readAsDataURL(blob);
    });
  }

  // ═══════════ agenda dos sócios ═══════════
  var WD = [t("agenda.sun", "Dom"), t("agenda.mon", "Seg"), t("agenda.tue", "Ter"), t("agenda.wed", "Qua"), t("agenda.thu", "Qui"), t("agenda.fri", "Sex"), t("agenda.sat", "Sáb")];
  var MONTHS = [t("agenda.january", "Janeiro"), t("agenda.february", "Fevereiro"), t("agenda.march", "Março"), t("agenda.april", "Abril"), t("agenda.may", "Maio"), t("agenda.june", "Junho"), t("agenda.july", "Julho"), t("agenda.august", "Agosto"), t("agenda.september", "Setembro"), t("agenda.october", "Outubro"), t("agenda.november", "Novembro"), t("agenda.december", "Dezembro")];
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); }
  var rangeCache = {};
  function ensureRange(kind, from, to, loader) {
    var key = kind + from + to;
    if (rangeCache[kind] === key) return true;
    if (rangeCache[kind + "_loading"] === key) return false;
    rangeCache[kind + "_loading"] = key;
    loader(from, to).then(function (list) { S[kind] = list || []; rangeCache[kind] = key; rangeCache[kind + "_loading"] = ""; render(); })
      .catch(function (e) { rangeCache[kind + "_loading"] = ""; toast(e.message || t("agenda.errorLoading", "Erro ao carregar.")); });
    return false;
  }
  function reloadRange(kind) { rangeCache[kind] = ""; render(); }
  // dias distintos com ponto nos últimos 30 dias (duas entradas no mesmo dia contam 1 dia)
  function daysWorked30(list) { var seen = {}; list.forEach(function (x) { if ((Date.now() - new Date(x.checkIn)) < 30 * 864e5) seen[dayKey(x.checkIn)] = 1; }); return Object.keys(seen).length; }
  function dayKey(iso) { var d = new Date(iso); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function admins() { return S.users.filter(function (u) { return isStaff(u) && u.active; }); }
  // outro administrador (sócio) ativo: só então as mensagens falam em "você e o sócio"
  // aviso antes da ação (modo demonstração): nada é enviado por e-mail
  function demoNote() { return API.mode === "demo" ? '<span class="small muted demo-note">' + esc(t("common.demoNothingSent", "No modo demonstração nada é enviado.")) + "</span>" : ""; }
  function hasPartner() { return S.users.some(function (u) { return u.role === "admin" && u.active && S.user && u.id !== S.user.id; }); }
  function agendaMailHint() {
    if (API.mode === "demo") return hasPartner() ? t("agenda.mailHintDemoPartner", "No modo demonstração nada é enviado. Na conta real, você e o seu sócio recebem um e-mail com este item.") : t("agenda.mailHintDemo", "No modo demonstração nada é enviado. Na conta real, você recebe um e-mail com este item.");
    return hasPartner() ? t("agenda.mailHintPartner", "Você e o seu sócio recebem um e-mail com este item.") : t("agenda.mailHint", "Você recebe um e-mail com este item.");
  }
  // empresas da agenda: as duas do exemplo (como sempre foi) ou as da conta criada no onboarding
  function evCompanies() { return API.companies.some(function (c) { return !KNOWN_LOGOS[c.id]; }) ? API.companies.map(function (c) { return [c.id, c.name]; }) : [["eternity", "Eternity Electric"], ["bluestar", "Blue Star HVAC"]]; }
  function evCoShort(id) { if (id === "bluestar") return "Blue Star"; var c = API.companies.find(function (x) { return x.id === id; }); return c && !KNOWN_LOGOS[id] ? (c.short || c.name) : "Eternity"; }
  function whoLabel(w) { if (!w || w === "todos") return t("agenda.everyone", "Todos"); var u = userById(w); return u ? u.name.split(" ")[0] : "—"; }
  function agendaView() {
    var t = todayISO(), cal = S.cal || (S.cal = { month: t.slice(0, 7), day: t });
    var first = cal.month + "-01", fd = new Date(first + "T12:00:00"), gridStart = addDays(first, -fd.getDay());
    var lastDay = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate(), gridEnd = addDays(cal.month + "-" + String(lastDay).padStart(2, "0"), 6 - new Date(fd.getFullYear(), fd.getMonth(), lastDay).getDay());
    var to = gridEnd > addDays(t, 14) ? gridEnd : addDays(t, 14), from = gridStart < t ? gridStart : t;
    var ready = ensureRange("events", from, to, API.listEvents);
    var ev = S.events || [], byDay = {};
    ev.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var cells = "", d = gridStart;
    while (d <= gridEnd) {
      var list = byDay[d] || [], other = d.slice(0, 7) !== cal.month;
      cells += '<button type="button" class="cal-cell' + (other ? " other" : "") + (d === t ? " today" : "") + (d === cal.day ? " sel" : "") + '" data-act="calDay" data-id="' + d + '"><span class="cal-n">' + Number(d.slice(8)) + "</span>" +
        list.slice(0, 3).map(function (e) { return '<span class="cal-ev' + (e.done ? " done" : "") + '">' + (e.start ? e.start + " " : "") + esc(e.title) + "</span>"; }).join("") + (list.length > 3 ? '<span class="cal-more">+' + (list.length - 3) + "</span>" : "") + "</button>";
      d = addDays(d, 1);
    }
    var mIdx = fd.getMonth();
    var dayList = byDay[cal.day] || [];
    var upcoming = ev.filter(function (e) { return e.date >= t && e.date <= addDays(t, 14) && !e.done; });
    return NV.t("agenda.calendarYourCalendarAnd", '<div class="page-head"><div><h1>Agenda</h1><p>Sua agenda e a do seu sócio juntas · cada item novo manda e-mail para vocês</p></div><button class="btn" data-act="evNew">+ Novo na agenda</button></div>') +
      NV.t("agenda.html", '<div class="panel"><div class="spread" style="margin-bottom:10px"><button class="btn ghost sm" data-act="calMonth" data-id="-1" aria-label="Mês anterior">') + ic("chevl") + '</button><h3 style="margin:0">' + MONTHS[mIdx] + " " + fd.getFullYear() + (ready ? "" : ' <span class="spin" aria-hidden="true"></span>') + NV.t("agenda.html2", '</h3><button class="btn ghost sm" data-act="calMonth" data-id="1" aria-label="Próximo mês">') + ic("chevr") + '</button></div>' +
      '<div class="cal-grid">' + WD.map(function (w) { return '<div class="cal-wd">' + w + "</div>"; }).join("") + cells + "</div></div>" +
      '<div class="grid2" style="margin-top:14px;align-items:start"><div><div class="section-title"><h3>' + fmtDate(cal.day) + " · " + WD[new Date(cal.day + "T12:00:00").getDay()] + '</h3><button class="btn ghost sm" data-act="evNew" data-id="' + cal.day + NV.t("agenda.onThisDay", '">+ Neste dia</button></div>') +
      (dayList.length ? '<div class="stack" style="gap:8px">' + dayList.map(evCard).join("") + "</div>" : emptyState({ icon: "calendar", title: NV.t("agenda.nothingOnThisDay", "Nada neste dia"), cta: { act: "evNew", id: cal.day, label: NV.t("agenda.addOnThisDay", "Adicionar neste dia") } })) + "</div>" +
      NV.t("agenda.next14Days", '<div><div class="section-title"><h3>Próximos 14 dias</h3></div>') + (upcoming.length ? '<div class="stack" style="gap:8px">' + upcoming.map(function (e) { return evCard(e, true); }).join("") + "</div>" : emptyState({ icon: "calendar", title: NV.t("agenda.nothingScheduled", "Nada marcado"), text: NV.t("agenda.noAppointmentsInThe", "Nenhum compromisso nos próximos 14 dias.") })) + "</div></div>";
  }
  function evCard(e, withDate) {
    var p = e.projectId ? projectById(e.projectId) : null;
    return '<div class="ev' + (e.done ? " done" : "") + '"><label class="ev-check"><input type="checkbox" data-act="evDone" data-id="' + e.id + '"' + (e.done ? " checked" : "") + ' aria-label="' + esc(t("agenda.doneAria", "Feito")) + '"></label><div style="min-width:0;flex:1">' +
      '<div class="ev-title">' + (withDate ? '<span class="muted">' + fmtDate(e.date) + "</span> " : "") + (e.start ? "<b>" + e.start + (e.end ? "–" + e.end : "") + "</b> " : "") + esc(e.title) + "</div>" +
      '<div class="chips" style="margin-top:4px"><span class="pill accent">' + esc(whoLabel(e.who)) + "</span>" + (e.companyId ? '<span class="pill neutral">' + esc(evCoShort(e.companyId)) + "</span>" : "") + (p ? '<span class="pill neutral">' + esc(p.name) + "</span>" : "") + "</div>" +
      (e.notes ? '<div class="small" style="margin-top:4px;white-space:pre-wrap">' + esc(e.notes) + "</div>" : "") +
      '<div class="bylines">' + byLine(t("who.addedBy", "Marcado por {n}"), e.createdByName, e.createdAt) + byLine(t("who.editedBy", "Editado por {n}"), e.updatedByName, e.updatedAt) + (e.done ? byLine(t("who.doneBy", "Feito por {n}"), e.doneByName, e.doneAt) : "") + "</div></div>" +
      '<div class="row" style="gap:4px"><button class="btn ghost sm" data-act="evEdit" data-id="' + e.id + t("agenda.editButtonClassBtn", '">Editar</button><button class="btn ghost sm" data-act="evDel" data-id="') + e.id + t("agenda.html3", '" aria-label="Apagar">✕</button></div></div>');
  }
  function evModal(m) {
    var e = m.ev || { title: "", date: (S.cal && S.cal.day) || todayISO(), start: "", end: "", who: "todos", companyId: S.company, projectId: "", notes: "" };
    return t("agenda.whatInputTypeText", '<form id="evForm" class="stack"><label class="field"><span>O que é</span><input type="text" id="evTitle" required value="') + esc(e.title) + t("agenda.html4", '" placeholder="Ex.: Visita técnica 53 Mason St, reunião com GC, inspeção final"></label>') +
      t("agenda.dayInputTypeDate", '<div class="grid3"><label class="field"><span>Dia</span><input type="date" id="evDate" required value="') + esc(e.date) + t("agenda.startInputTypeTime", '"></label><label class="field"><span>Início</span><input type="time" id="evStart" value="') + esc(e.start || "") + t("agenda.endInputTypeTime", '"></label><label class="field"><span>Fim</span><input type="time" id="evEnd" value="') + esc(e.end || "") + '"></label></div>' +
      (hasPartner() ? t("agenda.whoEveryoneYouAnd", '<div class="grid2"><label class="field"><span>Quem</span><select id="evWho"><option value="todos">Todos (você e o sócio)</option>') : '<div class="grid2"><label class="field"><span>' + esc(t("agenda.who", "Quem")) + '</span><select id="evWho"><option value="todos">' + esc(t("agenda.everyone", "Todos")) + "</option>") + admins().map(function (u) { return '<option value="' + u.id + '"' + (e.who === u.id ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select></label>" +
      t("agenda.companyGeneral", '<label class="field"><span>Empresa</span><select id="evCo"><option value="">Geral</option>') + evCompanies().map(function (c) { return '<option value="' + esc(c[0]) + '"' + (e.companyId === c[0] ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("") + "</select></label></div>" +
      t("agenda.jobOptional", '<label class="field"><span>Obra (opcional)</span><select id="evProj"><option value="">—</option>') + companyProjects().filter(function (p) { return p.status !== "Cancelled"; }).map(function (p) { return '<option value="' + p.id + '"' + (e.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      t("agenda.notes", '<label class="field"><span>Observações</span><textarea id="evNotes" rows="3">') + esc(e.notes || "") + "</textarea></label>" +
      (m.ev ? t("agenda.emailAboutThisChange", '<label class="row"><input type="checkbox" id="evNotify" style="width:auto"> Avisar por e-mail sobre a mudança</label>') : '<div class="muted small">' + esc(agendaMailHint()) + "</div>") +
      '<button class="btn" type="submit">' + (m.ev ? t("agenda.save", "Salvar") : t("agenda.addToCalendar", "Adicionar na agenda")) + "</button></form>";
  }

  // ═══════════ escala dos funcionários ═══════════
  function weekStartISO(offset) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 7 * (offset || 0)); return isoLocal(d); }
  function shiftLabel(x) { var p = projectById(x.projectId); return (x.start ? x.start + " · " : "") + (p ? p.name : t("schedule.jobRemoved", "Obra removida")); }
  function escalaView() {
    var off = S.schedWeek || 0, from = weekStartISO(off), to = addDays(from, 6), t = todayISO();
    var ready = ensureRange("shifts", from, to, API.listSchedule);
    var emps = S.users.filter(function (u) { return u.companyId === S.company && !isStaff(u) && u.active; });
    var days = []; for (var i = 0; i < 7; i++) days.push(addDays(from, i));
    var sh = (S.shifts || []).filter(function (x) { return x.companyId === S.company; });
    var head = NV.t("dashboard.employee2", "<tr><th>Funcionário</th>") + days.map(function (d, i) { return '<th class="' + (d === t ? "today" : "") + '">' + WD[i] + "<br><span class=\"small muted\">" + (LANG === "en" ? d.slice(5, 7) + "/" + d.slice(8) : d.slice(8) + "/" + d.slice(5, 7)) + "</span></th>"; }).join("") + "</tr>";
    var rows = emps.map(function (u) {
      return "<tr><td><b>" + esc(u.name) + "</b></td>" + days.map(function (d) {
        var mine = sh.filter(function (x) { return x.userId === u.id && x.date === d; });
        return '<td class="sched-cell' + (d === t ? " today" : "") + '">' + mine.map(function (x) { var wt = x.createdByName ? NV.t("who.scheduledBy", "Escalado por {n}").replace("{n}", x.updatedByName || x.createdByName) + " · " + whenShort(x.updatedAt || x.createdAt) : ""; return '<button type="button" class="sched-chip" data-act="shiftEdit" data-id="' + x.id + '"' + (wt ? ' title="' + esc(wt) + '"' : "") + ">" + esc(shiftLabel(x)) + "</button>"; }).join("") +
          '<button type="button" class="sched-add" data-act="shiftNew" data-id="' + u.id + '" data-date="' + d + '" aria-label="' + esc(NV.t("schedule.scheduleOn", "Escalar {n} em {d}", { n: u.name, d: fmtDate(d) })) + '">+</button></td>';
      }).join("") + "</tr>";
    }).join("");
    return NV.t("schedule.scheduleWhereEachEmployee", '<div class="page-head"><div><h1>Escala</h1><p>Onde cada funcionário vai trabalhar · eles veem no app deles</p></div><button class="btn ghost" data-act="schedCopy">Copiar semana anterior</button></div>') +
      '<div class="spread" style="margin-bottom:10px"><button class="btn ghost sm" data-act="schedWeek" data-id="-1">' + ic("chevl", 18) + NV.t("schedule.previousWeek", 'Semana anterior</button><b>') + fmtDate(from) + NV.t("common.to", " a ") + fmtDate(to) + (ready ? "" : ' <span class="spin" aria-hidden="true"></span>') + NV.t("schedule.nextWeek", '</b><button class="btn ghost sm" data-act="schedWeek" data-id="1">Próxima semana') + ic("chevr", 18) + '</button></div>' +
      (emps.length ? '<div class="table-wrap sched"><table><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>" : emptyState({ icon: "team", title: NV.t("schedule.noEmployeesYet", "Nenhum funcionário ainda"), text: NV.t("schedule.addEmployeesOnThe", "Cadastre funcionários na aba Equipe para montar a escala."), cta: can("team") ? { act: "nav", id: "team", label: NV.t("schedule.goToTeam", "Ir para Equipe"), icon: "team" } : null }));
  }
  function shiftModal(m) {
    var x = m.shift || { userId: m.userId, date: m.date, projectId: "", start: "07:00", note: "" };
    var jobs = companyProjects().filter(function (p) { return p.status !== "Cancelled" && p.status !== "Completed"; });
    return '<form id="shiftForm" class="stack"><div class="muted">' + esc(userName(x.userId)) + " · " + WD[new Date(x.date + "T12:00:00").getDay()] + " " + fmtDate(x.date) + "</div>" +
      (x.createdByName ? '<div class="bylines">' + byLine(t("who.scheduledBy", "Escalado por {n}"), x.createdByName, x.createdAt) + byLine(t("who.editedBy", "Editado por {n}"), x.updatedByName, x.updatedAt) + "</div>" : "") +
      t("schedule.jobChooseTheJob", '<label class="field"><span>Obra</span><select id="shProj" required><option value="">Escolha a obra</option>') + jobs.map(function (p) { return '<option value="' + p.id + '"' + (x.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
      t("schedule.arriveAtInputType", '<div class="grid2"><label class="field"><span>Chegar às</span><input type="time" id="shStart" value="') + esc(x.start || "") + t("schedule.noteForThemInput", '"></label><label class="field"><span>Observação para ele</span><input type="text" id="shNote" value="') + esc(x.note || "") + t("schedule.html", '" placeholder="Ex.: levar escada de 10 ft"></label></div>') +
      '<div class="row">' + (x.id ? '<button type="button" class="btn danger" data-act="shiftDel" data-id="' + x.id + t("schedule.removeFromSchedule", '">Tirar da escala</button>') : "") + t("schedule.save", '<button class="btn" type="submit" style="margin-left:auto">Salvar</button></div></form>');
  }
  // funcionário: minha escala
  function myScheduleList(days) {
    var t = todayISO(), list = (S.shifts || []).filter(function (x) { return x.userId === S.user.id && x.date >= t && x.date <= addDays(t, days); }).sort(function (a, b) { return a.date + (a.start || "") < b.date + (b.start || "") ? -1 : 1; });
    return list;
  }
  function minhaEscalaView() {
    var t = todayISO(); ensureRange("shifts", t, addDays(t, 14), API.listSchedule);
    var list = myScheduleList(14);
    return NV.t("schedule.myScheduleWhereYou", '<div class="page-head"><div><h1>Minha escala</h1><p>Onde você vai trabalhar nos próximos dias</p></div></div>') +
      (list.length ? '<div class="stack" style="gap:8px">' + list.map(function (x) {
        var p = projectById(x.projectId);
        return '<div class="panel' + (x.date === t ? " today-card" : "") + '"><div class="spread"><b>' + (x.date === t ? NV.t("schedule.today", "Hoje") : WD[new Date(x.date + "T12:00:00").getDay()] + " " + fmtDate(x.date)) + "</b>" + (x.start ? '<span class="pill accent">' + x.start + "</span>" : "") + "</div>" +
          '<div style="font-size:17px;font-weight:600;margin-top:4px">' + esc(p ? p.name : NV.t("schedule.job", "Obra")) + "</div>" + (p && p.address ? '<div class="small"><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '" target="_blank" rel="noopener">' + esc(p.address) + " ↗</a></div>" : "") +
          (x.note ? '<div class="small" style="margin-top:6px">' + ic("note", 16) + " "  + esc(x.note) + "</div>" : "") + (p ? '<div style="margin-top:8px"><button class="btn ghost sm" data-act="openProject" data-id="' + p.id + NV.t("schedule.seeTheJobAnd", '">Ver a obra e as tarefas</button></div>') : "") + "</div>";
      }).join("") + "</div>" : emptyState({ icon: "pin", title: NV.t("schedule.noScheduleYet", "Nenhuma escala marcada"), text: NV.t("schedule.whenTheAdminSchedules", "Quando o administrador escalar você numa obra, aparece aqui.") }));
  }

  // ═══════════ modals ═══════════
  function modalView() {
    var m = S.modal, inner = "";
    if (m.type === "expense") {
      inner = '<form id="admExpForm" class="stack">' + expenseFields(companyProjects(), true) + t("modals.noteSaveEntry", '<label class="field"><span>Observação</span><input type="text" id="xNote"></label><button class="btn" type="submit">Salvar lançamento</button></form>');
    } else if (m.type === "user") {
      var u = m.user || { name: "", username: "", role: "employee", companyId: S.company, rate: "", active: true };
      inner = t("modals.fullNameInputType", '<form id="userForm" class="stack"><label class="field"><span>Nome completo</span><input type="text" id="uName" value="') + esc(u.name) + '" required></label>' +
        t("modals.usernameLoginInputType", '<div class="grid2"><label class="field"><span>Usuário (login)</span><input type="text" id="uUser" value="') + esc(u.username) + '" autocapitalize="none" ' + (u.id ? "disabled" : "required") + '></label><label class="field"><span>' + (u.id ? t("modals.newPasswordLeaveBlank", "Nova senha (deixe vazio para manter)") : t("modals.startingPasswordMin", "Senha inicial (mínimo 6)")) + '</span><input type="text" id="uPass" ' + (u.id ? "" : 'required minlength="6"') + "></label></div>" +
        '<input type="hidden" id="uCo" value="' + esc(S.company) + t("modals.roleOptionValueEmployee", '"><div class="grid2"><label class="field"><span>Função</span><select id="uRole"><option value="employee"') + (u.role !== "admin" && u.role !== "manager" ? " selected" : "") + t("modals.employeeOptionValueManager", '>Funcionário</option><option value="manager"') + (u.role === "manager" ? " selected" : "") + ">" + esc(t("role.manager", "Gerente")) + '</option><option value="admin"' + (u.role === "admin" ? " selected" : "") + t("modals.adminHourlyRateInput", '>Administrador</option></select></label><label class="field"><span>Valor/hora $</span><input type="number" id="uRate" step="0.01" value="') + esc(u.rate) + '"></label></div>' +
        t("modals.emailGetsTheCalendar", '<label class="field"><span>E-mail (recebe a agenda e os avisos') + (u.role === "admin" ? "" : t("modals.optional", " — opcional")) + ')</span><input type="email" id="uEmail" value="' + esc(u.email || "") + '" autocapitalize="none"></label>' +
        '<div class="muted small role-help">' + esc(t("team.roleHelp", "Gerente: vê obras, escala, agenda, avisos, notas, ponto e propostas, mas não vê valores financeiros da empresa (painel financeiro, despesas, relatórios, valor/hora) nem Configurações.")) + "</div>" +
        (u.id ? '<label class="row"><input type="checkbox" id="uActive"' + (u.active ? " checked" : "") + t("modals.activeCanSignIn", "> Ativo (pode entrar no app)</label>") : "") +
        '<div class="err" id="uErr" hidden></div><button class="btn" type="submit">' + (u.id ? t("modals.save", "Salvar") : t("modals.createEmployee", "Criar funcionário")) + "</button></form>";
    } else if (m.type === "time") {
      var tm = S.time.find(function (x) { return x.id === m.id; });
      var loc = function (iso) { if (!iso) return ""; var d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
      inner = '<form id="timeForm" class="stack"><div class="muted">' + esc(userName(tm.userId)) + t("modals.job", '</div><label class="field"><span>Obra</span><select id="tProj"><option value="">—</option>') + companyProjects().map(function (p) { return '<option value="' + p.id + '"' + (tm.projectId === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + "</select></label>" +
        t("modals.inInputTypeDatetime", '<div class="grid2"><label class="field"><span>Entrada</span><input type="datetime-local" id="tIn" value="') + loc(tm.checkIn) + t("modals.outInputTypeDatetime", '"></label><label class="field"><span>Saída</span><input type="datetime-local" id="tOut" value="') + loc(tm.checkOut) + t("modals.saveCorrection", '"></label></div><button class="btn" type="submit">Salvar correção</button></form>');
    } else if (m.type === "image") {
      inner = m.urls.length ? '<div class="grid2">' + m.urls.map(function (u) { return '<div><div class="label">' + esc(u[0]) + '</div><img src="' + esc(u[1]) + '" alt="' + esc(u[0]) + '" style="border-radius:10px;margin-top:6px"></div>'; }).join("") + "</div>" : t("modals.noImage", '<div class="empty">Sem imagem.</div>');
    } else if (m.type === "event") {
      inner = evModal(m);
    } else if (m.type === "shift") {
      inner = shiftModal(m);
    } else if (EXT.modals && EXT.modals[m.type]) {
      inner = EXT.modals[m.type](m);
    } else if (m.type === "delProject") {
      var fp = m.fp, ln = function (n, a, b) { return n ? "<li>" + n + " " + (n === 1 ? a : b) + "</li>" : ""; };
      var always = fp ? ln(fp.tasks, t("modals.task", "tarefa"), t("modals.tasks", "tarefas")) + ln(fp.files, t("modals.file", "planta/arquivo"), t("modals.files", "plantas/arquivos")) + ln(fp.notices, t("modals.notice", "aviso"), t("modals.notices", "avisos")) + ln(fp.schedule, t("modals.scheduleDay", "dia de escala"), t("modals.scheduleDays", "dias de escala")) : "";
      var linked = fp ? ln(fp.time, t("modals.timeEntryHours", "registro de ponto (horas)"), t("modals.timeEntriesHours", "registros de ponto (horas)")) + ln(fp.expenses, t("modals.expense", "gasto/nota/recebimento"), t("modals.expenses", "gastos/notas/recebimentos")) + ln(fp.events, t("modals.calendarAppointment", "compromisso na agenda"), t("modals.calendarAppointments", "compromissos na agenda")) : "";
      var opt = function (id, t, d) { return '<label class="del-opt' + (m.mode === id ? " on" : "") + '"><input type="radio" name="delmode" data-act="delMode" data-id="' + id + '"' + (m.mode === id ? " checked" : "") + '><div><b>' + t + '</b><div class="small muted">' + d + "</div></div></label>"; };
      inner = t("modals.youReAboutTo", '<p>Você vai apagar <b>') + esc(m.name) + t("modals.thisCanTBe", "</b>. Isso não pode ser desfeito.</p>") +
        (!fp ? t("modals.countingWhatSLinked", '<p class="muted small">Contando o que está ligado a este projeto…</p>') :
          (always ? t("modals.alwaysDeletedWithIt", '<div class="small"><b>Sempre apagado junto:</b><ul style="margin:4px 0 10px 18px">') + always + "</ul></div>" : "") +
          (linked ? t("modals.alsoLinkedToThis", '<div class="small"><b>Também ligado a este projeto:</b><ul style="margin:4px 0 10px 18px">') + linked + "</ul></div>" : t("modals.noTimeEntriesExpenses", '<p class="small muted">Não há ponto, gastos nem agenda ligados a este projeto.</p>'))) +
        '<div class="stack" style="gap:8px;margin:10px 0">' +
        opt("keep", t("modals.deleteOnlyTheProject", "Apagar só o projeto"), t("modals.hoursExpensesReceiptsAnd", "Horas, gastos/notas e agenda continuam salvos (ficam “sem projeto”) — os relatórios e a folha não mudam.")) +
        opt("all", t("modals.deleteTheProjectAnd", "Apagar o projeto e tudo ligado a ele"), t("modals.alsoDeletesTheHours", "Apaga também as horas, os gastos/notas (com fotos), recebimentos e compromissos da agenda deste projeto.")) +
        "</div>" +
        t("modals.typeDeleteToConfirm", '<label class="label">Digite <b>APAGAR</b> para confirmar</label><input type="text" id="delConfirm" autocomplete="off" placeholder="APAGAR" style="margin-bottom:12px">') +
        t("modals.cancelButtonClassBtn", '<div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="delProject" data-id="') + m.id + t("modals.delete", '">Apagar</button></div>');
    } else if (m.type === "noticeNew") {
      var nj = (isStaff() ? companyProjects() : S.projects).filter(function (x) { return x.status !== "Cancelled" && x.status !== "Completed"; });
      inner = t("modals.somethingThatNeedsDoing", '<form class="stack" id="noticeForm" data-pid=""><p class="muted small" style="margin:0">Algo que precisa ser feito, material faltando, problema na obra… O administrador recebe na hora.</p>') +
        t("modals.jobChooseTheJob", '<label class="field"><span>Obra</span><select id="nProj" required><option value="">Escolha a obra</option>') + nj.map(function (x) { return '<option value="' + x.id + '"' + (S.params && S.params.id === x.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></label>" +
        t("modals.notice", '<label class="field"><span>Aviso</span><textarea id="nText" rows="3" required placeholder="Ex.: Falta 2 caixas de 4 polegadas no 2º andar."></textarea></label>') +
        t("modals.photoOptional", '<label class="field"><span>Foto (opcional)</span><input type="file" id="nPhoto" accept="image/*" capture="environment"></label>') +
        t("modals.sendNotice", '<button class="btn" type="submit">Enviar aviso</button></form>');
    } else if (m.type === "leave") {
      var lg = (S.pendingLeave && S.pendingLeave.guard) || {};
      inner = "<p>" + esc(lg.label ? t("leave.textWhat", "Você tem alterações não salvas em {what}.", { what: lg.label }) : t("leave.text", "Você tem alterações não salvas.")) + "</p>" +
        '<p class="small muted">' + esc(t("leave.hint", "Salve para guardar, descarte para perder as mudanças ou continue editando.")) + "</p>" +
        '<div class="row leave-row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("leave.stay", "Continuar editando")) + '</button><button type="button" class="btn ghost danger-text" data-act="leaveDiscard">' + esc(t("leave.discard", "Descartar")) + '</button><button type="button" class="btn" data-act="leaveSave">' + esc(t("leave.save", "Salvar")) + "</button></div>";
    } else if (m.type === "confirm") {
      inner = '<p>' + esc(m.text) + t("modals.cancelButtonClassBtn2", '</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="') + m.act + '" data-id="' + m.id + '">' + esc(m.okLabel || t("modals.confirm", "Confirmar")) + "</button></div>";
    }
    return '<div class="modal-bg" data-act="modalBg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="grab" aria-hidden="true"></div><div class="modal-head"><h2 id="modalTitle">' + esc(m.title) + t("modals.html", '</h2><button type="button" class="x" data-act="closeModal" aria-label="Fechar">') + ic("x") + "</button></div>" + inner + "</div></div>";
  }

  // ═══════════ image helpers ═══════════
  function compress(file, max) {
    max = max || 900;
    return new Promise(function (res) {
      if (!file || !/^image\//.test(file.type)) return res(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.72);
      };
      img.onerror = function () { res(file); };
      img.src = url;
    });
  }
  function getLoc(timeout) {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res({ ok: false });
      var done = false;
      setTimeout(function () { if (!done) { done = true; res({ ok: false }); } }, (timeout || 9000) + 500);
      try {
        navigator.geolocation.getCurrentPosition(function (p) { if (done) return; done = true; res({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
          function () { if (done) return; done = true; res({ ok: false }); }, { enableHighAccuracy: true, timeout: timeout || 9000, maximumAge: 30000 });
      } catch (e) { done = true; res({ ok: false }); }
    });
  }

  // ═══════════ actions ═══════════
  function refresh() { return loadData().then(render).catch(function (e) { toast(e.message || t("common.errorLoading", "Erro ao carregar.")); }); }
  var A = {
    theme: function () { setTheme(currentTheme() === "dark" ? "light" : "dark"); render(); },
    setLang: function (el) { setLang(el.dataset.id); },
    search: function () { openSearch(); },
    sheet: function (el) { S.overlay = el.dataset.id; render(); },
    ovBg: function (el, ev) { if (ev.target === el) { S.overlay = null; render(); } },
    ovClose: function () { S.overlay = null; render(); },
    pwToggle: function (el) { var i = $("#lgPass"); if (!i) return; var show = i.type === "password"; i.type = show ? "text" : "password"; el.setAttribute("aria-label", show ? t("login.hidePassword", "Esconder senha") : t("login.showPassword", "Mostrar senha")); el.classList.toggle("on", show); },
    demoLogin: function (el) { var u = $("#lgUser"), pw = $("#lgPass"); if (!u || !pw) return; u.value = el.dataset.id; pw.value = "1234"; var f = $("#loginForm"); if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", { cancelable: true })); },
    createNota: function () { S.nota = null; go("notas"); var cam = $(".nota-cam"); if (cam) cam.focus(); },
    noticeNew: function () { S.modal = { type: "noticeNew", title: t("notices.newNotice", "Novo aviso") }; render(); },
    createEvent: function (el) { var t = todayISO(); if (!S.cal) S.cal = { month: t.slice(0, 7), day: t }; A.evNew(el); },
    nav: function (el) { var v = el.dataset.id; if (v === "avisos") markNoticesSeen(); go(v); if (v === "punch") locate(); },
    company: function (el) { guardLeave(function () { A.companyNow(el); }); },
    companyNow: function (el) { S.company = el.dataset.id; storeSet("ee_company", S.company); S.filters.projectId = ""; S.filters.userId = ""; if (S.view === "project" || S.view === "projectForm") S.view = "projects"; refresh(); },
    logout: function () { guardLeave(function () { A.logoutNow(); }); },
    logoutNow: function () { API.signOut().then(function () { S.user = null; S.view = "dashboard"; render(); }); },
    resetDemo: function () { API.reset().then(function () { S.user = null; render(); toast(t("common.samplesRestoredSignIn", "Exemplos restaurados. Entre novamente.")); }); },
    install: function () { if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; render(); } },
    gastos: function (el) { S.gastoCat = el.dataset.id || "material"; go("gastos"); },
    gastosFor: function (el) { S.filters.projectId = el.dataset.id; S.gastoCat = "material"; go("gastos"); },
    hours: function () { go("hours"); },
    hoursFor: function (el) { S.filters.projectId = el.dataset.id; go("hours"); },
    reportNow: function (el) {
      toast(t("reports.sendingReport", "Enviando relatório…"));
      API.services("dailyReports", { projectId: el.dataset.id }).then(function (r) {
        var x = r && r.results && r.results[0];
        if (r && r.ok && x && x.sent) { toast(t("reports.reportSentTo", "Relatório enviado para ") + x.sent + "."); return refresh(); }
        toast(svcError(r, x && x.error));
      });
    },
    calDay: function (el) { S.cal.day = el.dataset.id; if (el.dataset.id.slice(0, 7) !== S.cal.month) S.cal.month = el.dataset.id.slice(0, 7); render(); },
    calMonth: function (el) { var d = new Date(S.cal.month + "-15T12:00:00"); d.setMonth(d.getMonth() + Number(el.dataset.id)); S.cal.month = isoLocal(d).slice(0, 7); S.cal.day = S.cal.month + "-01"; render(); },
    evNew: function (el) { S.modal = { type: "event", title: t("agenda.addToCalendar2", "Novo na agenda"), date: el.dataset.id }; if (el.dataset.id) S.cal.day = el.dataset.id; render(); },
    evEdit: function (el) { S.modal = { type: "event", title: t("agenda.edit", "Editar"), ev: (S.events || []).find(function (e) { return e.id === el.dataset.id; }) }; render(); },
    evDel: function (el) { S.modal = { type: "confirm", title: t("agenda.deleteFromCalendar", "Apagar da agenda"), text: t("agenda.deleteThisCalendarItem", "Apagar este item da agenda?"), act: "evDelOk", id: el.dataset.id, okLabel: t("agenda.delete", "Apagar") }; render(); },
    evDelOk: function (el) { API.deleteEvent(el.dataset.id).then(function () { S.modal = null; reloadRange("events"); toast(t("agenda.deleted", "Apagado.")); }); },
    shiftNew: function (el) { S.modal = { type: "shift", title: t("schedule.scheduleEmployee", "Escalar funcionário"), userId: el.dataset.id, date: el.dataset.date }; render(); },
    shiftEdit: function (el) { var x = (S.shifts || []).find(function (y) { return y.id === el.dataset.id; }); S.modal = { type: "shift", title: t("schedule.schedule", "Escala"), shift: x, userId: x.userId, date: x.date }; render(); },
    shiftDel: function (el) { API.deleteShift(el.dataset.id).then(function () { S.modal = null; reloadRange("shifts"); toast(t("schedule.removedFromSchedule", "Tirado da escala.")); }); },
    schedWeek: function (el) { S.schedWeek = (S.schedWeek || 0) + Number(el.dataset.id); render(); },
    schedCopy: function () {
      var from = weekStartISO(S.schedWeek || 0), prevFrom = addDays(from, -7);
      toast(t("schedule.copying", "Copiando…"));
      API.listSchedule(prevFrom, addDays(prevFrom, 6)).then(function (prev) {
        prev = prev.filter(function (x) { return x.companyId === S.company; });
        if (!prev.length) { toast(t("schedule.lastWeekIsEmpty", "A semana anterior está vazia.")); return; }
        var have = (S.shifts || []).map(function (x) { return x.userId + x.date + x.projectId; });
        var todo = prev.map(function (x) { return { companyId: x.companyId, userId: x.userId, date: addDays(x.date, 7), projectId: x.projectId, start: x.start, note: x.note }; }).filter(function (x) { return have.indexOf(x.userId + x.date + x.projectId) < 0; });
        return todo.reduce(function (pr, x) { return pr.then(function () { return API.saveShift(x); }); }, Promise.resolve()).then(function () { reloadRange("shifts"); toast(tn("schedule.entriesCopied", todo.length, "1 escala copiada.", "{n} escalas copiadas.")); });
      }).catch(function (e) { toast(e.message); });
    },
    payWeek: function (el) { S.payWeek = Number(el.dataset.id); render(); },
    payEmail: function () { toast(t("time.sending", "Enviando…")); API.services("weeklyPayroll", { email: true }).then(function (r) { toast(r && r.ok ? t("time.sentToYourEmail", "Enviado para o seu e-mail.") : svcError(r)); }); },
    noticeFilter: function (el) { S.noticeFilter = el.dataset.id; render(); },
    noticeResolve: function (el) { var n = S.notices.find(function (x) { return x.id === el.dataset.id; }); API.resolveNotice(n.id, !n.resolved).then(refresh); },
    noticeDel: function (el) { S.modal = { type: "confirm", title: t("notices.deleteNotice", "Apagar aviso"), text: t("notices.deleteThisNotice", "Apagar este aviso?"), act: "noticeDelOk", id: el.dataset.id, okLabel: t("notices.delete", "Apagar") }; render(); },
    noticeDelOk: function (el) { API.deleteNotice(el.dataset.id).then(function () { S.modal = null; return refresh(); }); },
    noticePhoto: function (el) { var n = S.notices.find(function (x) { return x.id === el.dataset.id; }); API.photoUrl(n.photo, "notice-photos").then(function (u) { S.modal = { type: "image", title: t("notices.noticePhoto", "Foto do aviso"), urls: u ? [[n.authorName || "", u]] : [] }; render(); }); },
    notaCat: function (el) { S.nota.category = el.dataset.id; render(); },
    notaCancel: function () { S.nota = null; render(); },
    gastoCat: function (el) { S.gastoCat = el.dataset.id; render(); },
    pickProject: function (el) { S.filters.projectId = el.dataset.id; render(); window.scrollTo(0, 0); },
    openProject: function (el) { go("project", { id: el.dataset.id, tab: "overview" }); },
    ptab: function (el) { S.params.tab = el.dataset.id; render(); },
    newProject: function () { guardLeave(function () { S.draft = blankProject(); S.draftFiles = []; S.wizStep = 0; markWizClean(); go("projectForm", {}, true); }); },
    editProject: function (el) {
      var p = projectById(el.dataset.id), fi = S.fin[p.id] || {};
      S.draft = JSON.parse(JSON.stringify(p)); S.draft.fin = { contractValue: fi.contractValue || "", materialBudget: fi.materialBudget || "", laborBudget: fi.laborBudget || "", budget: fi.budget || "", estHours: fi.estHours || "", clientEmail: fi.clientEmail || "", clientPhone: fi.clientPhone || "", dailyReport: fi.dailyReport === false ? t("projects.no", "Não") : t("projects.yes", "Sim") };
      NV.tradeMultiKeys(tradeOf(p.companyId)).forEach(function (k) { if (!Array.isArray(S.draft.details[k])) S.draft.details[k] = S.draft.details[k] ? [S.draft.details[k]] : []; });
      S.draftFiles = []; S.wizStep = 0; markWizClean(); go("projectForm", {}, true);
    },
    // Cancelar também pergunta se houver alterações (Salvar / Descartar / Continuar editando)
    cancelWizard: function () { var id = S.draft && S.draft.id; guardLeave(function () { S.draft = null; S.draftBase = null; if (id) go("project", { id: id }, true); else go("projects", {}, true); }); },
    wizGo: function (el) { S.wizStep = Number(el.dataset.id); render(); window.scrollTo(0, 0); },
    pickOpt: function (el) { var p = el.dataset.path, v = el.dataset.val; set(S.draft, p, get(S.draft, p) === v ? "" : v); render(); },
    toggleOpt: function (el) { var p = el.dataset.path, v = el.dataset.val, arr = (get(S.draft, p) || []).slice(), i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); set(S.draft, p, arr); render(); },
    toggleTask: function (el) { var g = el.dataset.group, l = el.dataset.val, pt = el.dataset.pt || l, i = S.draft.tasks.findIndex(function (t) { return t.group === g && (t.label === l || t.label === pt); }); if (i >= 0) S.draft.tasks.splice(i, 1); else S.draft.tasks.push({ id: null, group: g, label: l, done: false }); render(); },
    addTask: function () {
      var l = $("#customTask").value.trim(), g = $("#customGroup").value; if (!l) { $("#customTask").focus(); return; }
      S.draft.tasks.push({ id: null, group: g, label: l, done: false }); render();
      // continua no campo (e no mesmo grupo) para digitar várias tarefas seguidas
      var gs = $("#customGroup"); if (gs) gs.value = g; var f = $("#customTask"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    },
    suggestTasks: function () {
      // regras do ramo (trades.js → suggest): lista [[grupo, tarefa], …] na ordem em que as regras disparam
      var tr = tradeDef(tradeOf(S.draft.companyId)), add = NV.tradeSuggest(tr.id, S.draft.details || {}, coFlags(S.draft.companyId));
      var n = 0;
      add.forEach(function (a) { if (!S.draft.tasks.some(function (t) { return t.group === a[0] && (t.label === a[1] || t.label === tv(a[1])); })) { S.draft.tasks.push({ id: null, group: a[0], label: tv(a[1]), done: false }); n++; } });
      render(); toast(n ? n + t("projects.suggestedTasksAddedReview", " tarefas sugeridas adicionadas. Revise a lista.") : t("projects.fillInTheType", "Preencha as etapas Tipo, Condições e ") + tr.stepName + t("projects.stepsToGetSuggestions", " para receber sugestões."));
    },
    rmDraftFile: function (el) { S.draftFiles.splice(Number(el.dataset.id), 1); render(); },
    geocode: function () {
      var addr = S.draft.address, st = $("#geoStatus");
      if (!addr) { st.textContent = t("projects.enterTheAddressFirst", "Digite o endereço primeiro."); return; }
      st.textContent = t("projects.searching", "Buscando…");
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" + encodeURIComponent(addr), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d.length) { st.textContent = t("projects.addressNotFoundCheck", "Endereço não encontrado. Confira ou preencha latitude/longitude manualmente."); return; } S.draft.lat = Number(d[0].lat); S.draft.lng = Number(d[0].lon); render(); toast(t("projects.locationFound", "Localização encontrada.")); })
        .catch(function () { st.textContent = t("projects.couldnTSearchRight", "Não foi possível buscar agora. Preencha latitude/longitude manualmente (Google Maps → clique no ponto)."); });
    },
    saveProjectForce: function () { S.modal = null; S.draft._moneyOk = true; A.saveProject(); },
    saveProject: function () {
      var d = S.draft, err = $("#wizErr");
      var hits = moneyHits(d.scope).concat(moneyHits(d.teamNotes));
      if (hits.length && !d._moneyOk) {
        S.wizStep = 5;
        S.modal = { type: "confirm", title: t("projects.headsUpDollarAmount", "Atenção: valor no escopo"), text: t("projects.theScopeOrThe", "O escopo ou o recado para a equipe tem valores: ") + hits.slice(0, 6).join(", ") + t("projects.employeesWillSeeThis", ". Os funcionários vão ver esse texto. Volte e tire os preços, ou salve mesmo assim se não for preço (ex.: metragem)."), act: "saveProjectForce", id: "x", okLabel: t("projects.saveAnyway", "Salvar mesmo assim") };
        render(); return;
      }
      if (!d.name.trim()) { S.wizStep = 0; render(); var e2 = $("#wizErr"); e2.textContent = t("projects.giveTheProjectA", "Dê um nome ao projeto."); e2.hidden = false; return; }
      var fin = d.fin, files = S.draftFiles.slice(), proj = JSON.parse(JSON.stringify(d)); delete proj.fin; delete proj._moneyOk; delete d._moneyOk;
      proj.lat = proj.lat === "" || proj.lat == null ? null : Number(proj.lat); proj.lng = proj.lng === "" || proj.lng == null ? null : Number(proj.lng);
      toast(t("projects.saving", "Salvando…"));
      API.saveProject(proj).then(function (saved) {
        return (can("finance") ? API.saveFinancials(saved.id, fin) : Promise.resolve()).then(function () { // gerente não grava (nem apaga) os valores
          return files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(saved.id, f); }); }, Promise.resolve());
        }).then(function () { return saved; });
      }).then(function (saved) { S.draft = null; S.draftBase = null; S.draftFiles = []; return loadData().then(function () { go("project", { id: saved.id, tab: "overview" }); toast(t("projects.projectSaved", "Projeto salvo.")); }); })
        .catch(function (e) { if (err) { err.textContent = e.message || t("projects.errorSaving", "Erro ao salvar."); err.hidden = false; } });
    },
    askDelProject: function (el) {
      var p = projectById(el.dataset.id); if (!p) return;
      S.modal = { type: "delProject", title: t("projects.deleteProject2", "Apagar projeto"), id: p.id, name: p.name, fp: null, mode: "keep" }; render();
      (API.projectFootprint ? API.projectFootprint(p.id) : Promise.resolve(null)).then(function (fp) { if (S.modal && S.modal.type === "delProject") { S.modal.fp = fp || {}; render(); } });
    },
    delMode: function (el) { if (S.modal) { S.modal.mode = el.dataset.id; render(); } },
    delProject: function (el) {
      var m = S.modal || {}, id = el.dataset.id, all = m.mode === "all";
      var ci = document.getElementById("delConfirm"); if (m.type === "delProject" && (!ci || ci.value.trim().toUpperCase() !== t("modals.deleteWord", "APAGAR"))) { toast(t("projects.typeDeleteToConfirm", "Digite APAGAR para confirmar.")); return; }
      el.disabled = true; el.textContent = t("projects.deleting", "Apagando…");
      API.deleteProject(id, { all: all }).then(function () { S.modal = null; return loadData(); }).then(function () { go("projects"); toast(all ? t("projects.projectAndEverythingLinked", "Projeto e tudo ligado a ele apagados.") : t("projects.projectDeletedTimeEntries", "Projeto apagado. Ponto e gastos continuam salvos.")); })
        .catch(function (e) { el.disabled = false; el.textContent = t("projects.delete2", "Apagar"); toast(t("projects.couldnTDelete", "Não consegui apagar: ") + (e && e.message || e)); });
    },
    task: function (el) {
      var done = el.checked;
      API.setTaskDone(el.dataset.pid, el.dataset.id, done, S.user.name).then(function () {
        var p = projectById(el.dataset.pid), t = p.tasks.find(function (x) { return x.id === el.dataset.id; });
        if (t) { t.done = done; t.doneBy = done ? S.user.name : null; t.doneById = done ? S.user.id : null; t.doneAt = done ? new Date().toISOString() : null; }
        dropActs(); render();
      }).catch(function (e) { el.checked = !done; toast(e.message); });
    },
    actFilter: function (el) { S.actFilter = el.dataset.id; render(); },
    openFile: function (el) {
      var p = projectById(el.dataset.pid), f = (p.files || []).find(function (x) { return x.id === el.dataset.id; });
      API.fileUrl(f).then(function (u) {
        if (!u) { toast(t("projects.fileNotAvailableOn", "Arquivo indisponível neste aparelho.")); return; }
        var a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; if (/^blob:/.test(u)) a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      });
    },
    delFile: function (el) { API.deleteFile(el.dataset.pid, el.dataset.id).then(refresh).then(function () { toast(t("projects.fileDeleted", "Arquivo apagado.")); }); },
    newExpense: function () { S.modal = { type: "expense", title: t("expenses.newEntry", "Novo lançamento") }; render(); },
    delExpense: function (el) { S.modal = { type: "confirm", title: t("expenses.deleteEntry", "Apagar lançamento"), text: t("expenses.deleteThisExpenseEntry", "Apagar este lançamento de gasto? Isso não pode ser desfeito."), act: "delExpenseOk", id: el.dataset.id, okLabel: t("expenses.delete", "Apagar") }; render(); },
    delExpenseOk: function (el) { API.deleteExpense(el.dataset.id).then(function () { S.modal = null; return refresh(); }).then(function () { toast(t("expenses.entryDeleted", "Lançamento apagado.")); }); },
    viewReceipt: function (el) { var x = S.expenses.find(function (e) { return e.id === el.dataset.id; }); API.photoUrl(x.receipt, "receipts").then(function (u) { S.modal = { type: "image", title: t("common.receipt", "Recibo"), urls: u ? [[t("common.receipt", "Recibo"), u]] : [] }; render(); }); },
    viewPunch: function (el) {
      var t = S.time.find(function (x) { return x.id === el.dataset.id; });
      Promise.all([API.photoUrl(t.inPhoto), API.photoUrl(t.outPhoto)]).then(function (u) {
        var urls = []; if (u[0]) urls.push([NV.t("time.in", "Entrada ") + fmtTime(t.checkIn), u[0]]); if (u[1]) urls.push([NV.t("time.out", "Saída ") + fmtTime(t.checkOut), u[1]]);
        S.modal = { type: "image", title: userName(t.userId) + " · " + fmtDate(t.checkIn), urls: urls }; render();
      });
    },
    editTime: function (el) { S.modal = { type: "time", title: t("time.fixPunch", "Corrigir ponto"), id: el.dataset.id }; render(); },
    newUser: function () { S.modal = { type: "user", title: t("team.newEmployee2", "Novo funcionário") }; render(); },
    editUser: function (el) { S.modal = { type: "user", title: t("team.editEmployee", "Editar funcionário"), user: userById(el.dataset.id) }; render(); },
    closeModal: function () { S.modal = null; S.pendingLeave = null; render(); },
    // aviso de alterações não salvas (askLeave)
    leaveSave: function () {
      var pl = S.pendingLeave; if (!pl) return; S.modal = null; render();
      Promise.resolve(pl.guard.save()).then(function (ok) { if (ok === false) return; S.pendingLeave = null; pl.proceed(); })
        .catch(function (e) { toast((e && e.message) || t("common.errorSaving", "Erro ao salvar.")); });
    },
    leaveDiscard: function () { var pl = S.pendingLeave; if (!pl) return; S.pendingLeave = null; S.modal = null; try { pl.guard.discard(); } catch (e) {} pl.proceed(); },
    modalBg: function (el, ev) { if (ev.target === el) { S.modal = null; render(); } },
    csv: function (el) { csv(el.dataset.id); },
    punch: function (el) {
      var kind = el.dataset.id;
      if (kind === "in" && !S.params.projectId) { var sel = $("#punchProject"); if (sel && sel.value) S.params.projectId = sel.value; }
      if (kind === "in" && !S.params.projectId) { toast(t("time.chooseTheJobBefore", "Escolha a obra antes de bater a entrada.")); return; }
      S.pendingPunch = kind;
      var inp = $("#selfie"); inp.value = ""; inp.click();
    }
  };

  function svcError(r, extra) {
    var e = r && r.error;
    return ({ NO_EMAIL_KEY: "O envio de e-mail ainda não foi ligado (falta a chave do Resend no Supabase).", NO_KEY: "A IA ainda não foi ligada.", NOT_DEPLOYED: t("common.thisServiceIsnT", "Esse serviço ainda não foi instalado no Supabase."), DEMO: t("common.demoModeNothingWas", "Modo demonstração: nada foi enviado."), OFFLINE: t("common.noConnectionRightNow", "Sem conexão agora."), FORBIDDEN: t("common.noPermission", "Sem permissão.") })[e] || (t("common.thatDidnTWork", "Não deu certo") + (extra || (r && r.detail) ? ": " + (extra || r.detail) : "."));
  }
  function locate() { S.loc = null; getLoc(9000).then(function (l) { S.loc = l; if (S.view === "punch") render(); }); }

  function doPunch(file) {
    var kind = S.pendingPunch;
    toast(t("time.recordingPunch", "Registrando ponto…"));
    Promise.all([compress(file, 640), S.loc && S.loc.ok ? Promise.resolve(S.loc) : getLoc(8000)]).then(function (r) {
      var loc = r[1]; S.loc = loc;
      var o = { photo: r[0], loc: loc, projectId: S.params.projectId };
      return kind === "in" ? API.clockIn(o) : API.clockOut(o);
    }).then(function (rec) {
      if (rec && rec.offline) { toast(t("time.offlinePunchSavedOn", "Sem internet: ponto salvo no aparelho e será enviado depois.")); S.open = kind === "in" ? { checkIn: rec.checkIn, projectId: S.params.projectId } : null; render(); return; }
      toast(kind === "in" ? t("time.punchedInAt", "Entrada registrada às ") + fmtTime(rec.checkIn) : t("time.punchedOutAt", "Saída registrada às ") + fmtTime(rec.checkOut) + " · " + hrs(hoursOf(rec)));
      return API.openShift(S.user.id).then(function (o) { S.open = o; }).catch(function () { S.open = kind === "in" ? rec : null; }).then(function () { return loadData(); }).then(render);
    }).catch(function (e) { toast(e.message || t("time.errorRecordingPunch", "Erro ao registrar ponto.")); });
  }

  // ═══════════ events ═══════════
  document.addEventListener("click", function (ev) {
    // menus <details> (Criar, ⋯, empresa): fecha ao clicar fora
    document.querySelectorAll("details.dd[open]").forEach(function (d) { if (!d.contains(ev.target)) d.removeAttribute("open"); });
    var ci = ev.target.closest(".cmdk-item"); if (ci) { cmdkRun(Number(ci.dataset.i)); return; }
    var el = ev.target.closest("[data-act]");
    if (!el) return;
    var act = el.dataset.act;
    if (el.tagName === "INPUT" || el.tagName === "SELECT") return; // handled on change
    if ((act === "modalBg" || act === "ovBg") && ev.target !== el) return; // clique dentro do modal: deixa botões e formulários funcionarem
    var fn = A[act] || EXT.actions[act];
    if (fn) {
      if (el.tagName === "A" && el.getAttribute("href") !== "#") return;
      ev.preventDefault();
      if (!el.closest(".modal,.ov-panel,.dd-menu")) focusMem.opener = { act: act, id: el.dataset.id || "" };
      var dd = el.closest("details.dd"); if (dd) dd.removeAttribute("open");
      var hadOv = !!S.overlay;
      if (hadOv && !/^(ovBg|ovClose|sheet|search|theme)$/.test(act)) S.overlay = null; // escolher algo numa folha fecha a folha
      fn(el, ev);
      if (hadOv && !S.overlay && $(".ov-bg")) render();
    }
  });
  // teclado: Ctrl/Cmd+K ou "/" abre a busca; Esc fecha; setas/Enter na busca; foco preso em modal/folha; Enter em linhas clicáveis
  function typing(t) { return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); }
  document.addEventListener("keydown", function (ev) {
    if (!S.user) return;
    var k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (k === "k" || k === "K")) { ev.preventDefault(); if (S.overlay === "cmdk") { S.overlay = null; render(); } else openSearch(); return; }
    if (k === "/" && !typing(ev.target) && !S.modal && !S.overlay) { ev.preventDefault(); openSearch(); return; }
    if (k === "?" && !typing(ev.target) && !S.modal && !S.overlay && (A.help || EXT.actions.help)) { ev.preventDefault(); runAct("help"); return; }
    if (k === "Escape") {
      var openDd = document.querySelector("details.dd[open]");
      if (S.overlay) { ev.preventDefault(); S.overlay = null; render(); }
      else if (S.modal) { ev.preventDefault(); S.modal = null; render(); }
      else if (openDd) { openDd.removeAttribute("open"); var sm = openDd.querySelector("summary"); if (sm) sm.focus(); }
      return;
    }
    if (S.overlay === "cmdk") {
      if (k === "ArrowDown") { ev.preventDefault(); cmdkMove(1); return; }
      if (k === "ArrowUp") { ev.preventDefault(); cmdkMove(-1); return; }
      if (k === "Enter") { ev.preventDefault(); cmdkRun(S.cmdkSel || 0); return; }
    }
    // Enter nos campos de "adicionar" (tarefa personalizada do assistente, material da proposta) adiciona o item
    if (k === "Enter" && !ev.isComposing && ev.target && (ev.target.id === "customTask" || ev.target.id === "pMatQty")) { ev.preventDefault(); runAct(ev.target.id === "customTask" ? "addTask" : "pAddMat"); return; }
    if (k === "Tab" && (S.modal || S.overlay)) {
      var box = S.overlay ? $(".ov-panel") : $(".modal"); if (!box) return;
      var f = [].slice.call(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      return;
    }
    if ((k === "Enter" || k === " ") && ev.target && ev.target.matches && ev.target.matches('[data-act][tabindex]:not(button):not(input):not(select):not(textarea),label.nota-cam')) { ev.preventDefault(); ev.target.click(); }
  });
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    for (var ci = 0; ci < EXT.change.length; ci++) { if (EXT.change[ci](el, ev)) return; }
    if (el.dataset.filter) {
      S.filters[el.dataset.filter] = el.value;
      if (el.dataset.filter === "preset") { if (el.value === "custom" && !S.filters.from) { S.filters.preset = "this_month"; applyPreset(); S.filters.preset = "custom"; } else applyPreset(); }
      render(); return;
    }
    if (el.dataset.bind && S.draft) { set(S.draft, el.dataset.bind, el.value); if (el.tagName === "SELECT") render(); return; }
    if (el.dataset.act === "task") { A.task(el); return; }
    if (el.dataset.act === "delMode") { A.delMode(el); return; }
    if (el.dataset.act === "punchProject") { S.params.projectId = el.value; return; }
    if (el.id === "selfie" && el.files[0]) { doPunch(el.files[0]); return; }
    if (el.id === "notaFile" && el.files[0]) { startNota(el.files[0]); return; }
    if (el.dataset.act === "evDone") { var ev = (S.events || []).find(function (e) { return e.id === el.dataset.id; }); if (ev) { ev.done = el.checked; API.saveEvent(Object.assign({}, ev)).then(render).catch(function (e) { toast(e.message); }); } return; }
    if (S.nota && /^nf/.test(el.id)) { notaField(el); return; }
    if (el.dataset.act === "wizFiles") { S.draftFiles = S.draftFiles.concat([].slice.call(el.files)); render(); return; }
    if (el.dataset.act === "uploadFiles") {
      var files = [].slice.call(el.files), pid = el.dataset.id;
      toast(t("common.uploading", "Enviando ") + files.length + t("common.fileS", " arquivo(s)…"));
      files.reduce(function (p, f) { return p.then(function () { return API.uploadFile(pid, f); }); }, Promise.resolve())
        .then(refresh).then(function () { toast(t("common.filesUploaded", "Arquivos enviados.")); }).catch(function (e) { toast(e.message || t("common.errorUploading", "Erro ao enviar.")); });
    }
  });
  function notaField(el) { var k = { nfProj: "projectId", nfAmt: "amount", nfDate: "date", nfVendor: "vendor" }[el.id]; if (k && S.nota) S.nota[k] = el.value; }
  // validação dos formulários com mensagem do próprio app (PT/EN) no lugar do balão nativo do navegador
  var invAt = 0;
  function fieldLabel(el) {
    var l = el.closest("label"), sp = l && l.querySelector("span");
    var s = (sp && sp.textContent) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
    return s.replace(/\s+/g, " ").trim();
  }
  document.addEventListener("invalid", function (ev) {
    var el = ev.target; if (!el || !el.validity) return;
    ev.preventDefault(); // sem balão nativo (que sai no idioma do navegador)
    var now = Date.now(); if (now - invAt < 400) return; invAt = now; // só o 1º campo inválido
    var v = el.validity, f = fieldLabel(el) || t("val.thisField", "este campo"), msg;
    if (v.valueMissing) msg = t("val.required", "Preencha “{f}”.", { f: f });
    else if (v.tooShort) msg = t("val.tooShort", "“{f}” precisa ter pelo menos {n} caracteres.", { f: f, n: el.minLength });
    else if (v.typeMismatch && el.type === "email") msg = t("val.email", "Confira o e-mail em “{f}”.", { f: f });
    else if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput) msg = t("val.number", "Confira o número em “{f}”.", { f: f });
    else msg = t("val.generic", "Confira o campo “{f}”.", { f: f });
    el.setAttribute("aria-invalid", "true");
    try { el.focus({ preventScroll: false }); } catch (e) {}
    var box = el.form && el.form.querySelector(".err");
    if (box) { box.textContent = msg; box.hidden = false; box.setAttribute("role", "alert"); } else toast(msg);
  }, true);
  document.addEventListener("input", function (ev) { if (ev.target && ev.target.getAttribute && ev.target.getAttribute("aria-invalid") === "true") ev.target.removeAttribute("aria-invalid"); }, true);
  document.addEventListener("input", function (ev) { var el = ev.target; if (el.id === "cmdkInput") { S.cmdkSel = 0; cmdkUpdate(); return; } if (S.nota && /^nf/.test(el.id)) notaField(el); for (var ii = 0; ii < EXT.input.length; ii++) { if (EXT.input[ii](el, ev)) return; } if (el.dataset.bind && S.draft && el.tagName !== "SELECT") { set(S.draft, el.dataset.bind, el.value); if (/^(scope|teamNotes)$/.test(el.dataset.bind)) { S.draft._moneyOk = false; var w = $("#scopeWarn"); if (w) w.innerHTML = scopeWarnHtml(S.draft); } } });
  document.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (EXT.submit[f.id]) { EXT.submit[f.id](f, ev); return; }
    if (f.id === "evForm") {
      var old = S.modal.ev, ev = Object.assign({}, old || {}, { title: $("#evTitle").value.trim(), date: $("#evDate").value, start: $("#evStart").value, end: $("#evEnd").value, who: $("#evWho").value, companyId: $("#evCo").value, projectId: $("#evProj").value, notes: $("#evNotes").value.trim(), notify: !!($("#evNotify") && $("#evNotify").checked) });
      if (!ev.title || !ev.date) return;
      API.saveEvent(ev).then(function (saved) {
        S.modal = null; S.cal.day = ev.date; S.cal.month = ev.date.slice(0, 7); reloadRange("events");
        if (old && !ev.notify) { toast(t("common.saved", "Salvo.")); return; }
        // só diz que o e-mail foi enviado quando o servidor confirma; no modo demonstração nada é enviado
        if (API.mode === "demo") { toast(t("agenda.savedDemo", "Salvo na agenda. No modo demonstração nada é enviado.")); return; }
        var mail = saved && saved.mail;
        if (!mail || !mail.then) { toast(t("agenda.savedToCalendar", "Salvo na agenda.")); return; }
        toast(t("agenda.savedSending", "Salvo na agenda. Enviando o e-mail…"));
        mail.then(function (r) { toast(r && r.ok ? (hasPartner() ? t("agenda.mailSentPartner", "E-mail enviado para você e o sócio.") : t("agenda.mailSentYou", "E-mail enviado para você.")) : svcError(r)); });
      }).catch(function (e) { toast(e.message || t("common.errorSaving", "Erro ao salvar.")); });
      return;
    }
    if (f.id === "shiftForm") {
      var m0 = S.modal, sx = Object.assign({}, m0.shift || {}, { companyId: S.company, userId: m0.userId, date: m0.date, projectId: $("#shProj").value, start: $("#shStart").value, note: $("#shNote").value.trim() });
      if (!sx.projectId) { toast(t("common.chooseTheJob", "Escolha a obra.")); return; }
      API.saveShift(sx).then(function () { S.modal = null; reloadRange("shifts"); toast(t("common.scheduleSaved", "Escala salva.")); }).catch(function (e) { toast(e.message || t("common.errorSaving", "Erro ao salvar.")); });
      return;
    }
    if (f.id === "noticeForm") {
      var txt = $("#nText").value.trim(); if (!txt) return;
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      var npid = f.dataset.pid || ($("#nProj") && $("#nProj").value); if (!npid) { btn.disabled = false; toast(t("common.chooseTheJobFor", "Escolha a obra do aviso.")); return; }
      compress($("#nPhoto").files[0], 1200).then(function (ph) { return API.addNotice({ projectId: npid, text: txt, photo: ph || null }); })
        .then(function () { if (S.modal && S.modal.type === "noticeNew") S.modal = null; return refresh(); }).then(function () { toast(t("common.noticeSentTheAdmin", "Aviso enviado. O administrador foi avisado.")); })
        .catch(function (e) { btn.disabled = false; toast(e.message || t("common.errorSendingNotice", "Erro ao enviar aviso.")); });
      return;
    }
    if (f.id === "notaForm") {
      var n = S.nota, amt = Number(n.amount);
      if (!n.projectId) { toast(t("common.chooseTheJobFor2", "Escolha a obra da nota.")); return; }
      if (!(amt > 0)) { toast(t("common.enterTheReceiptAmount", "Informe o valor da nota.")); return; }
      n.saving = true; render();
      API.addExpense({ companyId: isStaff() ? S.company : S.user.companyId, kind: "expense", category: n.category || "material", amount: amt, projectId: n.projectId, date: n.date || todayISO(), vendor: n.vendor || "", note: n.ai && n.ai.summary_pt ? n.ai.summary_pt : "", receiptPath: n.path || null, ai: n.ai || null })
        .then(function () { var p = projectById(n.projectId); S.nota = null; return refresh().then(function () { toast(t("common.receiptSavedTo", "Nota salva em ") + (p ? p.name : t("common.jobWord", "obra")) + " · " + catLabel(n.category) + " " + money(amt, 2)); }); })
        .catch(function (e) { n.saving = false; render(); toast(e.message || t("common.errorSavingTheReceipt", "Erro ao salvar a nota.")); });
      return;
    }
    if (f.id === "setupForm") {
      var se = $("#suErr"); se.hidden = true;
      API.setupAdmin({ name: $("#suName").value.trim(), username: $("#suUser").value, password: $("#suPass").value })
        .then(function (u) { S.setup = false; return afterLogin(u); }).catch(function (e) { se.textContent = e.message; se.hidden = false; });
      return;
    }
    if (f.id === "loginForm") {
      var err = $("#lgErr"); err.hidden = true;
      API.signIn($("#lgUser").value, $("#lgPass").value).then(afterLogin).catch(function (e) { err.textContent = e.message; err.hidden = false; });
    } else if (f.id === "admExpForm" || f.id === "empExpForm") {
      var amt = Number($("#xAmt").value);
      if (!(amt > 0)) { toast(t("common.enterAnAmountGreater", "Informe um valor maior que zero.")); return; }
      var kind = $("#xKind") ? $("#xKind").value : "expense";
      compress($("#xReceipt").files[0], 1200).then(function (rc) {
        return API.addExpense({ companyId: isStaff() ? S.company : S.user.companyId, kind: kind, category: kind === "revenue" ? "receita" : $("#xCat").value, amount: amt, projectId: $("#xProj").value, date: $("#xDate").value, vendor: $("#xVendor").value, note: $("#xNote") ? $("#xNote").value : "", receipt: rc || null });
      }).then(function () { S.modal = null; return refresh(); }).then(function () { toast(t("common.entrySaved", "Lançamento salvo.")); }).catch(function (e) { toast(e.message || t("common.errorSaving", "Erro ao salvar.")); });
    } else if (f.id === "userForm") {
      var u = S.modal.user, ue = $("#uErr");
      var data = { name: $("#uName").value.trim(), companyId: $("#uCo").value, role: $("#uRole").value, rate: $("#uRate").value, password: $("#uPass").value, email: $("#uEmail").value.trim() };
      var p = u ? API.updateUser(u.id, Object.assign(data, { active: $("#uActive").checked, password: data.password || undefined })) : API.createUser(Object.assign(data, { username: $("#uUser").value }));
      p.then(function () { S.modal = null; return refresh(); }).then(function () { toast(u ? t("common.employeeUpdated", "Funcionário atualizado.") : t("common.employeeCreatedGiveThem", "Funcionário criado. Passe o usuário e a senha para ele.")); }).catch(function (e) { ue.textContent = e.message; ue.hidden = false; });
    } else if (f.id === "timeForm") {
      var tin = $("#tIn").value, tout = $("#tOut").value;
      if (tout && tin && tout <= tin) { toast(t("common.punchOutHasTo", "A saída precisa ser depois da entrada.")); return; }
      API.updateTime(S.modal.id, { projectId: $("#tProj").value || null, checkIn: tin ? new Date(tin).toISOString() : undefined, checkOut: tout ? new Date(tout).toISOString() : null })
        .then(function () { S.modal = null; return refresh(); }).then(function () { toast(t("common.punchFixed", "Ponto corrigido.")); });
    }
  });

  function localOpenShift() {
    var q = API.pendingQueue ? API.pendingQueue() : [], last = q[q.length - 1];
    if (last) return last.kind === "in" ? { checkIn: last.at, projectId: last.projectId } : null;
    return S.time.find(function (t) { return t.userId === S.user.id && !t.checkOut; }) || null;
  }
  window.addEventListener("online", function () { if (S.user) setTimeout(function () { loadData().then(function () { return !isStaff() ? API.openShift(S.user.id).then(function (o) { S.open = o; }).catch(function () {}) : null; }).then(render).catch(function () {}); }, 4000); });
  function afterLogin(user) {
    // a conta pode ter mudado (exemplo ↔ empresa criada no onboarding): a empresa principal passa a ser a 1ª da conta
    if (API.companies.length && !API.companies.some(function (c) { return c.id === APPCO.id; })) { APPCO = API.companies[0]; BRAND = APPCO.name; }
    var hasCo = function (id) { return API.companies.some(function (c) { return c.id === id; }); };
    if (!isStaff(user) && !hasCo(user.companyId)) {
      API.signOut();
      var other = user.companyId === "bluestar" ? "Blue Star HVAC" : "Eternity Electric";
      return Promise.reject(new Error(t("login.userOtherCompany", "Este usuário é da {co}. Use o app da {co}.", { co: other })));
    }
    // idioma de cada pessoa: quem escolheu na tela de entrar grava no perfil; senão vale o idioma salvo no perfil
    var explicit = null; try { explicit = sessionStorage.getItem("bisey_lang_explicit"); sessionStorage.removeItem("bisey_lang_explicit"); } catch (e) {}
    var want = /^en/i.test(user.locale || "") ? "en" : /^es/i.test(user.locale || "") ? "es" : /^pt/i.test(user.locale || "") ? "pt" : null;
    if (explicit || (!want && API.setLocale)) { if (API.setLocale && (explicit || API.mode === "demo")) API.setLocale(LOCALE).catch(function () {}); }
    else if (want && want !== LANG) { NV.setLang(want); return new Promise(function () {}); } // recarrega no idioma da pessoa
    S.user = user; S.signup = null;
    if (!isStaff(user)) { S.company = user.companyId; S.view = "punch"; } else { if (!hasCo(S.company)) S.company = hasCo(user.companyId) ? user.companyId : APPCO.id; S.view = "dashboard"; }
    var resume = null; try { resume = JSON.parse(sessionStorage.getItem("bisey_resume") || "null"); sessionStorage.removeItem("bisey_resume"); } catch (e) {}
    if (resume && resume.view && canView(resume.view)) { S.view = resume.view; S.params = resume.params || {}; }
    applyPreset();
    S.loading = true; render(); // casca + skeleton enquanto os dados chegam
    return loadData().then(function () { return !isStaff(user) ? API.openShift(user.id).then(function (o) { S.open = o; }).catch(function () { S.open = localOpenShift(); }) : null; })
      .then(function () { S.loading = false; render(); if (!isStaff(user)) locate(); EXT.afterLogin.forEach(function (f) { try { f(user); } catch (e) {} }); }, function (e) { S.loading = false; S.user = null; render(); throw e; });
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); S.installEvt = e; if (S.user) render(); });
  if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic/.test(location.hostname)) {
    try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
  }

  window.EE = { S: S, EXT: EXT, API: API, render: render, go: go, guardLeave: guardLeave, statusLabel: statusLabel, toast: toast, esc: esc, money: money, fmtDate: fmtDate, fmtPct: fmtPct, pct: pct, todayISO: todayISO,
    companyName: companyName, tradeOf: tradeOf, coFlags: coFlags, companyProjects: companyProjects, projectById: projectById, statusPill: statusPill, ICON: ICON, refresh: refresh,
    blankProject: blankProject, TRADE: TRADE, storeGet: storeGet, storeSet: storeSet, ring: ring,
    // interface Bisey (ganchos para onboarding/configurações/idioma)
    ic: ic, emptyState: emptyState, emptyRow: emptyRow, level: level, skeletonView: skeletonView, crumb: crumb, applyBrand: applyBrand, setTheme: setTheme, currentTheme: currentTheme,
    openSearch: openSearch, companyBrand: companyBrand, PRODUCT: PRODUCT, NAV: { admin: ADMIN_GROUPS, employee: EMP_GROUPS }, CREATE: CREATE,
    // fase 3: textos, papéis, conta nova, configurações e ajuda
    t: t, tn: tn, tv: tv, I18N: I18N, LANG: LANG, LOCALE: LOCALE, setLang: setLang, langSwitch: langSwitch, speechLang: speechLang, APP_VERSION: APP_VERSION, can: can, isStaff: isStaff, roleOf: roleOf, roleLabel: roleLabel, canView: canView, tradeLabel: tradeLabel, tradeDef: tradeDef,
    luminance: luminance, resizeImage: resizeImage, copyText: copyText, brandOverride: brandOverride, paintAccent: paintAccent, afterLogin: afterLogin, runAct: runAct,
    notifPrefs: notifPrefs, setNotifPref: setNotifPref, hrs: hrs, fmtTime: fmtTime, initials: initials, coLogo: coLogo, modalView: modalView, csvDownload: csvDownload, staffGroups: staffGroups,
    // "quem fez" (autoria) e permissões por tela — usados por propostas, impostos, indicação e o assistente
    SITE_URL: SITE_URL, byLine: byLine, byCell: byCell, whenShort: whenShort, firstName: firstName, isoLocal: isoLocal, VIEW_PERM: VIEW_PERM, allNav: allNav, navActive: navActive, catLabel: catLabel, hoursOf: hoursOf };
  window.EE.NAV.manager = groupsFor("manager");

  // boot (o link da proposta para o cliente é tratado em proposals.js)
  if (/[?&]proposta=/.test(location.search)) return;
  $("#app").innerHTML = '<div class="boot" aria-busy="true"><img src="brand/bisey-loading.svg" class="boot-mark" alt="' + PRODUCT + '" width="72" height="95"></div>';
  // marca da empresa vinda do config (opcional): APP_CONFIG.BRAND = { name, logo, accent }
  if (window.APP_CONFIG && window.APP_CONFIG.BRAND) applyBrand(window.APP_CONFIG.BRAND);
  // espera os módulos (proposals.js, settings.js, onboarding.js, help.js) registrarem as telas antes da 1ª tela
  function whenReady(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }
  new Promise(whenReady).then(function () { return API.init(); }).then(function () {
    // a conta ativa no aparelho pode ser outra (empresa criada no onboarding): a empresa principal é a 1ª dela
    if (API.companies.length && !API.companies.some(function (c) { return c.id === APPCO.id; })) { APPCO = API.companies[0]; BRAND = APPCO.name; S.company = APPCO.id; }
    return API.session();
  }).then(function (u) {
    if (u) return afterLogin(u);
    var rs = null; try { rs = JSON.parse(sessionStorage.getItem("bisey_resume") || "null"); if (rs && rs.signup) sessionStorage.removeItem("bisey_resume"); } catch (e) {}
    if ((/[?&](signup|onboarding)=1/.test(location.search) || (rs && rs.signup)) && EXT.actions.signupStart) { EXT.actions.signupStart(); return; } // link "teste grátis" do site / troca de idioma no cadastro
    return (API.needsSetup ? API.needsSetup() : Promise.resolve(false)).then(function (n) { S.setup = n; render(); });
  })
    .catch(function (e) { $("#app").innerHTML = '<div class="boot"><img src="brand/logo/bisey-lockup-horizontal-reverse.svg" alt="' + PRODUCT + '" width="128" height="53"><div class="err">' + esc(e.message || t("common.errorStartingUp", "Erro ao iniciar.")) + t("common.tryAgain", '</div><button class="btn" onclick="location.reload()">Tentar de novo</button></div>'); });
})();
