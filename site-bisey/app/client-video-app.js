/* Bisey — "Vídeo da empresa" dentro do app (motor em client-video.js).
   - Configurações → aba "Vídeo": prévia ao vivo, ramo (padrão = ramo da empresa), idioma do cliente, telefone/site, "Baixar vídeo" e "Copiar link".
   - Enviar proposta (proposals.js → AC.pSend): opção "Incluir vídeo da empresa" (ligada quando a empresa tem logo) →
     p.video = { on, lang, trade, phone, site }; o e-mail ganha o botão "Veja como trabalhamos" e a página de aceite mostra o player.
   Preferências do vídeo (ramo, idioma, telefone, site) ficam neste aparelho, por empresa (localStorage bisey_cv_<empresa>). */
(function () {
  "use strict";
  var E = window.EE, BV = window.BiseyVideo; if (!E || !BV) return;
  var S = E.S, API = E.API, EXT = E.EXT, esc = E.esc, t = E.t, ic = E.ic, AC = EXT.actions;
  var LANGS = [["pt", "Português"], ["en", "English"], ["es", "Español"]];

  function coRec(id) { return (API.companies || []).find(function (c) { return c.id === id; }) || {}; }
  function key(id) { return "bisey_cv_" + id; }
  function prefs(id) {
    id = id || S.company; var c = coRec(id), o = {};
    try { o = JSON.parse(localStorage.getItem(key(id)) || "{}") || {}; } catch (e) { o = {}; }
    return { trade: BV.scripts.TRADES[o.trade] ? o.trade : NV.tradeKey(c.trade || "electrical"), lang: BV.scripts.UI[o.lang] ? o.lang : "en",
      phone: o.phone != null ? o.phone : (c.phone || ""), site: o.site || "" };
  }
  function savePrefs(id, p) { try { localStorage.setItem(key(id), JSON.stringify(p)); } catch (e) {} }
  // marca da empresa para o vídeo: logo completo (modelo pré-configurado ou o de Configurações), cor escolhida (senão sai do logo)
  function brand(id) {
    id = id || S.company; var c = coRec(id), b = E.companyBrand(id), co = E.prop && E.prop.coFor ? E.prop.coFor(id) : {};
    var preset = co && co.custom !== true;
    return { name: b.name || c.name || "", logo: (preset && co.logo) || b.logo || c.logo || "", accent: c.accent || (preset ? co.accent : "") || "" };
  }
  function opts(id) { var p = prefs(id), b = brand(id); return { trade: p.trade, lang: p.lang, phone: p.phone, site: p.site, name: b.name, logo: b.logo, accent: b.accent }; }
  function tradeOptions(cur) {
    var mine = {}; (API.companies || []).forEach(function (c) { mine[NV.tradeKey(c.trade || "electrical")] = 1; });
    var list = NV.tradeList().filter(function (d) { return BV.scripts.TRADES[d.id]; }), o = function (d) { return '<option value="' + d.id + '"' + (d.id === cur ? " selected" : "") + ">" + esc(d.label) + "</option>"; };
    var a = list.filter(function (d) { return mine[d.id]; }), r = list.filter(function (d) { return !mine[d.id]; });
    return '<optgroup label="' + esc(t("cv.yourTrades", "Seus ramos")) + '">' + a.map(o).join("") + '</optgroup><optgroup label="' + esc(t("cv.otherTrades", "Outros ramos")) + '">' + r.map(o).join("") + "</optgroup>";
  }
  function labels() { return { play: t("cv.play", "Tocar"), pause: t("cv.pause", "Pausar"), full: t("cv.full", "Tela cheia"), seek: t("cv.seek", "Posição do vídeo") }; }

  // ═══════════ Configurações → Vídeo ═══════════
  E.cvSettingsTab = function () {
    var id = S.company, p = prefs(id), b = brand(id), m = BV.exportMime(), busy = S.cvRec;
    var sel = function (k, label, html) { return '<label class="field"><span>' + esc(label) + '</span><select data-cv="' + k + '" id="cv-' + k + '">' + html + "</select></label>"; };
    var inp = function (k, label, type, extra) { return '<label class="field"><span>' + esc(label) + '</span><input type="' + type + '" data-cv="' + k + '" id="cv-' + k + '" value="' + esc(p[k] || "") + '" ' + (extra || "") + "></label>"; };
    return '<section class="panel set-sec" id="cv-set"><div class="panel-head"><div><h3>' + esc(t("cv.title", "Vídeo da empresa")) + '</h3><span class="muted small">' +
      esc(t("cv.sub", "Um vídeo de cerca de 1 minuto e meio que mostra ao cliente como a sua empresa trabalha, etapa por etapa, desde o aceite da proposta. O roteiro é o do ramo; só o logo, o nome e o contato mudam.")) + "</span></div></div>" +
      '<div id="cvPrev" class="cv-prev" aria-label="' + esc(t("cv.preview", "Prévia do vídeo")) + '"></div>' +
      (b.logo ? "" : '<div class="ob-note" style="margin-top:10px">' + ic("info", 18) + "<span>" + esc(t("cv.noLogo", "Sem logo, o vídeo usa as iniciais da empresa. Envie o logo na aba Empresa.")) + "</span></div>") +
      '<div class="grid2" style="margin-top:12px">' + sel("trade", t("cv.trade", "Ramo (roteiro)"), tradeOptions(p.trade)) +
      sel("lang", t("cv.lang", "Idioma do cliente"), LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === p.lang ? " selected" : "") + ' lang="' + NV.langTag(l[0]) + '">' + l[1] + "</option>"; }).join("")) + "</div>" +
      '<div class="grid2">' + inp("phone", t("cv.phone", "Telefone no fim do vídeo"), "tel", 'autocomplete="tel" inputmode="tel"') + inp("site", t("cv.site", "Site (opcional)"), "url", 'autocapitalize="none" inputmode="url"') + "</div>" +
      '<div class="row" style="margin-top:4px">' +
      '<button type="button" class="btn" data-act="cvExport"' + (busy || !m ? " disabled" : "") + ">" + ic("download", 18) + esc(t("cv.download", "Baixar vídeo")) + "</button>" +
      '<button type="button" class="btn ghost" data-act="cvCopy">' + ic("copy", 18) + esc(t("cv.copy", "Copiar link")) + "</button></div>" +
      '<div id="cvExp" aria-live="polite">' + expHtml() + "</div>" +
      '<p class="muted small" style="margin-top:10px">' + esc(m ? t("cv.how", "A gravação leva o tempo do vídeo (cerca de 1 min e meio). Deixe esta tela aberta. Formato neste navegador: {f}.", { f: m.ext.toUpperCase() }) : t("cv.noRec", "Este navegador não grava vídeo. Use o Chrome, o Edge ou o Safari atualizados — o link e a página da proposta funcionam em qualquer navegador.")) +
      " " + esc(t("cv.linkNote", "O link abre o vídeo em tela cheia, sem baixar nada.")) + (API.mode === "demo" ? " " + esc(t("cv.demoLogo", "No modo demonstração o logo fica só neste aparelho: o link mostra as iniciais.")) : "") + "</p>" +
      '<p class="muted small">' + esc(t("cv.dashNote", "A cena do painel usa números de exemplo e mostra o selo “Exemplo · números ilustrativos”.")) + "</p></section>";
  };
  function expHtml() {
    var r = S.cvRec, o = S.cvOut;
    if (r) return '<div class="cv-exp"><div class="spread"><b>' + esc(t("cv.recording", "Gravando o vídeo…")) + '</b><span class="small" id="cvPct">' + Math.round(r.pct * 100) + '%</span></div><div class="cv-track"><span id="cvBar" style="width:' + Math.round(r.pct * 100) + '%"></span></div>' +
      '<button type="button" class="btn quiet sm" data-act="cvCancel">' + esc(t("cv.cancel", "Cancelar")) + "</button></div>";
    if (o) return '<div class="cv-exp"><b>' + esc(t("cv.ready", "Vídeo pronto ({f}, {s} MB).", { f: o.ext.toUpperCase(), s: (o.size / 1048576).toFixed(1) })) + '</b><div class="row"><a class="btn ghost sm" href="' + esc(o.url) + '" download="' + esc(o.name) + '">' + ic("download", 16) + esc(t("cv.saveAgain", "Salvar de novo")) + "</a>" +
      (o.share ? '<button type="button" class="btn ghost sm" data-act="cvShare">' + ic("send", 16) + esc(t("cv.share", "Compartilhar")) + "</button>" : "") + "</div></div>";
    return "";
  }
  function paintExp() { var el = document.getElementById("cvExp"); if (el) el.innerHTML = expHtml(); }
  var player = null, playerKey = "";
  EXT.afterRender.push(function () {
    var el = document.getElementById("cvPrev");
    if (!el) { if (player) { player.destroy(); player = null; playerKey = ""; } return; }
    var o = opts(), k = JSON.stringify(o);
    if (player && playerKey === k && el.contains(player.el)) return;
    var wasT = player && playerKey === k ? player.t : 0; if (player) player.destroy(); player = null; playerKey = k;
    el.innerHTML = '<div class="cv-ph" style="aspect-ratio:16/9;border-radius:14px;background:#0A1433"></div>';
    BV.prepare(o).then(function (v) { if (playerKey !== k || !document.getElementById("cvPrev")) return; player = BV.mount(document.getElementById("cvPrev"), v, { start: wasT, labels: labels() }); });
  });
  EXT.change.push(function (el) {
    if (!el.dataset || !el.dataset.cv) return false;
    var p = prefs(); p[el.dataset.cv] = String(el.value || "").trim(); savePrefs(S.company, p); E.render(); return true;
  });
  AC.cvCopy = function () { E.copyText(BV.link(opts())); };
  AC.cvExport = function () {
    if (S.cvRec) return;
    var o = opts(), ctrl = { aborted: false };
    S.cvOut && URL.revokeObjectURL(S.cvOut.url); S.cvOut = null; S.cvRec = { pct: 0, ctrl: ctrl }; E.render();
    if (player) player.pause();
    BV.prepare(o).then(function (v) {
      return BV.record(v, { width: 1280, height: 720, fps: 30, signal: ctrl, onProgress: function (k) {
        if (!S.cvRec) return; var n = Math.round(k * 100); if (Math.round(S.cvRec.pct * 100) === n) return; S.cvRec.pct = k;
        var b = document.getElementById("cvBar"), pc = document.getElementById("cvPct"); if (b) b.style.width = n + "%"; if (pc) pc.textContent = n + "%";
      } });
    }).then(function (r) {
      var slug = String(o.name || "empresa").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";
      var name = slug + "-" + o.trade + "-" + o.lang + "." + r.ext, url = URL.createObjectURL(r.blob), file = null;
      try { file = new File([r.blob], name, { type: r.blob.type }); } catch (e) {}
      S.cvRec = null; S.cvOut = { url: url, name: name, ext: r.ext, size: r.blob.size, file: file, share: !!(file && navigator.canShare && navigator.canShare({ files: [file] })) };
      var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      E.render(); E.toast(t("cv.done", "Vídeo baixado."));
    }).catch(function (e) {
      S.cvRec = null; E.render();
      if (e && e.message === "ABORTED") return;
      E.toast(e && e.message === "NO_RECORDER" ? t("cv.noRec", "Este navegador não grava vídeo. Use o Chrome, o Edge ou o Safari atualizados — o link e a página da proposta funcionam em qualquer navegador.") : t("cv.fail", "Não deu para gravar o vídeo neste aparelho."), { kind: "bad" });
    });
  };
  AC.cvCancel = function () { if (S.cvRec) S.cvRec.ctrl.aborted = true; };
  AC.cvShare = function () { var o = S.cvOut; if (o && o.file && navigator.share) navigator.share({ files: [o.file], title: brand().name }).catch(function () {}); };

  // ═══════════ envio da proposta: "Incluir vídeo da empresa" ═══════════
  function hasLogo(id) { return !!brand(id).logo; }
  E.cv = {
    // modal de envio (proposals.js → AC.pSend usa type "cvSend" quando este arquivo está carregado)
    applySend: function (p) {
      if (!p || p.docType === "invoice") return;
      var st = S.cvSend || {}, on = document.getElementById("cvSendOn"), lg = document.getElementById("cvSendLang");
      var isOn = on ? on.checked : st.on != null ? st.on : hasLogo(p.companyId), lang = lg ? lg.value : st.lang || prefs(p.companyId).lang, pr = prefs(p.companyId);
      p.video = isOn ? { on: true, lang: lang, trade: pr.trade, phone: pr.phone, site: pr.site } : { on: false };
      S.cvSend = null;
    },
    prefs: prefs, brand: brand, opts: opts
  };
  EXT.modals = EXT.modals || {};
  EXT.modals.cvSend = function (m) {
    var p = S.pdraft || {}, inv = p.docType === "invoice", prev = p.video || {}, on = prev.on != null ? prev.on : hasLogo(p.companyId), lang = prev.lang || prefs(p.companyId).lang;
    var opt = inv ? "" : '<label class="set-toggle"><span><b>' + esc(t("cv.include", "Incluir vídeo da empresa")) + "</b><span>" + esc(t("cv.includeSub", "O e-mail ganha o botão “Veja como trabalhamos” e a página da proposta mostra o vídeo.")) + '</span></span><input type="checkbox" role="switch" id="cvSendOn"' + (on ? " checked" : "") + '><span class="sw-ui" aria-hidden="true"></span></label>' +
      '<label class="field" style="max-width:240px"><span>' + esc(t("cv.lang", "Idioma do cliente")) + '</span><select id="cvSendLang">' + LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === lang ? " selected" : "") + ' lang="' + NV.langTag(l[0]) + '">' + l[1] + "</option>"; }).join("") + "</select></label>";
    return "<p>" + esc(m.text) + "</p>" + opt + '<div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">' + esc(t("cv.cancel", "Cancelar")) + '</button><button type="button" class="btn" data-act="' + m.act + '" data-id="' + esc(m.id) + '">' + esc(m.okLabel || t("modals.confirm", "Confirmar")) + "</button></div>";
  };
  EXT.change.push(function (el) {
    if (el.id === "cvSendOn" || el.id === "cvSendLang") { S.cvSend = { on: (document.getElementById("cvSendOn") || {}).checked, lang: (document.getElementById("cvSendLang") || {}).value }; return true; }
    return false;
  });

  // estilos da aba (só deste módulo)
  var st = document.createElement("style");
  st.textContent = ".cv-prev{margin-top:4px;max-width:760px}.cv-exp{margin-top:12px;display:grid;gap:8px;max-width:760px}.cv-track{height:10px;border-radius:6px;background:var(--track);overflow:hidden}" +
    ".cv-track span{display:block;height:100%;background:var(--accent);border-radius:6px;transition:width .3s}";
  document.head.appendChild(st);
})();
