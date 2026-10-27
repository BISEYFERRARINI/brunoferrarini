/* Bisey — idioma do app: Português (Brasil), Inglês (EUA) e Espanhol (América Latina / EUA).
   Carregado ANTES de data.js e app.js. Expõe window.NV = { t, tn, tv, lang, locale, setLang, addDict } e window.I18N.
   - Só o idioma ativo é baixado: em inglês este arquivo carrega i18n.en.js (em espanhol, i18n.es.js) logo em seguida (antes dos outros scripts);
     em português nada mais é baixado, porque o texto PT já está no código (2º argumento de t).
   - i18n.en.js / i18n.es.js / i18n.pt.js: chaves organizadas por tela ("tela": { "chave": "texto" }) → t("tela.chave", "Texto PT", { var }).
     O i18n.pt.js é a referência para novos idiomas e para os testes; o app não precisa dele. As três têm as mesmas chaves (tests/i18n.js confere).
   - I18N.en.val / I18N.es.val: valores gravados no banco (em PT) → como mostrar em inglês / espanhol (tv).
   Inglês de obra dos EUA: job, crew, punch in/out, change order, walkthrough, rough-in, finish, permit, inspection, estimate, invoice.
   Espanhol de obra (es-US, por “tú”): obra, cuadrilla, marcar entrada/salida, estimado, factura, orden de cambio, permiso, inspección, recibo, nómina. */
(function () {
  "use strict";
  var I18N = window.I18N || {};

  // ═══════════ idioma ativo ═══════════
  // Ordem: ?lang=en|pt|es na URL (fica salvo) → escolha salva neste aparelho → idioma do navegador.
  // Cada pessoa escolhe o seu: o app também guarda no perfil (API.setLocale) e aplica ao entrar.
  var KEY = "bisey_lang", SUPPORTED = { pt: "pt-BR", en: "en-US", es: "es-US" };
  function norm(l) { l = String(l || "").toLowerCase(); return l.indexOf("pt") === 0 ? "pt" : l.indexOf("en") === 0 ? "en" : l.indexOf("es") === 0 ? "es" : null; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var LANG = null;
  try { var q = /[?&]lang=(\w+)/.exec(location.search); if (q && norm(q[1])) { LANG = norm(q[1]); store(KEY, LANG); } } catch (e) {}
  if (!LANG) LANG = norm(store(KEY));
  if (!LANG) { var navs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]); for (var i = 0; i < navs.length && !LANG; i++) LANG = norm(navs[i]); }
  if (!LANG) LANG = "en";

  // dicionário achatado: "tela.chave" → texto (preenchido por addDict, quando i18n.<idioma>.js carrega)
  var FLAT = { pt: {}, en: {}, es: {} };
  function addDict(l, d) {
    I18N[l] = d || {}; var f = FLAT[l] = {};
    Object.keys(I18N[l]).forEach(function (ns) { if (ns === "val") return; var o = I18N[l][ns]; Object.keys(o).forEach(function (k) { f[ns + "." + k] = o[k]; }); });
  }
  Object.keys(I18N).forEach(function (l) { addDict(l, I18N[l]); }); // dicionários que já estavam na página (ex.: testes)

  function fill(s, vars) {
    s = String(s);
    if (vars && s.indexOf("|") >= 0 && vars.n != null) { var p = s.split("|"); s = Number(vars.n) === 1 ? p[0] : p[p.length - 1]; } // plural simples: "1 tarefa|{n} tarefas"
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  // t('tela.chave', 'Texto em português', { var: valor }) — o PT fica no código (fonte da verdade), o EN / ES vêm do dicionário
  function t(key, pt, vars) {
    if (pt && typeof pt === "object") { vars = pt; pt = null; }
    var s = LANG === "pt" ? (pt != null ? pt : FLAT.pt[key]) : (FLAT[LANG] || {})[key];
    if (s == null) s = pt != null ? pt : (FLAT.pt[key] != null ? FLAT.pt[key] : key);
    return fill(s, vars);
  }
  // plural: tn('tela.chave', n, '1 tarefa', '{n} tarefas')
  function tn(key, n, one, other, vars) { var o = Object.assign({ n: n }, vars || {}); return t(key, one + "|" + other, o); }
  // valores gravados no banco (opções da ficha técnica, grupos de tarefa, status de proposta…) ficam em PT;
  // tv() traduz só na hora de mostrar. Valor desconhecido (digitado pelo usuário) volta igual.
  function tv(v) { if (v == null || LANG === "pt") return v; var m = (I18N[LANG] && I18N[LANG].val) || {}; return m[v] != null ? m[v] : v; }
  function locale() { return SUPPORTED[LANG]; }
  // troca de idioma: salva neste aparelho e recarrega no mesmo lugar (a tela atual volta pelo sessionStorage)
  function setLang(l, resume) {
    l = norm(l); if (!l) return;
    store(KEY, l);
    try { if (resume) sessionStorage.setItem("bisey_resume", JSON.stringify(resume)); } catch (e) {}
    if (l === LANG) return;
    try { var u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.delete("lang"); history.replaceState(null, "", u.toString()); } } catch (e) {}
    location.reload();
  }
  try { document.documentElement.lang = locale(); } catch (e) {}
  // textos fixos do index.html
  function fixStatic() { var s = document.querySelector(".skip"); if (s) s.textContent = t("nav.skip", "Pular para o conteúdo"); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fixStatic); else fixStatic();

  window.I18N = I18N;
  window.NV = { I18N: I18N, lang: LANG, t: t, tn: tn, tv: tv, locale: locale, setLang: setLang, addDict: addDict, langs: [["pt", "Português (Brasil)"], ["en", "English (US)"], ["es", "Español (EE. UU.)"]],
    // atributo lang de um texto escrito no próprio idioma (nome do idioma no seletor)
    langTag: function (l) { return l === "pt" ? "pt-BR" : l === "es" ? "es" : "en"; } };

  // dicionário do idioma ativo: carregado já, antes de config.js/data.js/app.js (que montam textos ao carregar).
  // Em português não baixa nada (o texto PT está no código). document.write mantém a ordem dos scripts (mesmo site).
  if (LANG !== "pt" && !Object.keys(FLAT[LANG] || {}).length) {
    var src = "i18n." + LANG + ".js";
    if (document.readyState === "loading" && document.write) document.write('<script src="' + src + '"><\/script>');
    else { var sc = document.createElement("script"); sc.src = src; sc.async = false; (document.head || document.documentElement).appendChild(sc); }
  }
})();
