/* Bisey — "Vídeo da empresa": vídeo promocional do cliente desenhado em <canvas> (modelo fixo; só a marca muda).
   Carregado depois de client-video-scripts.js (roteiro por ramo e textos em PT / EN / ES).
   API (window.BiseyVideo):
     BiseyVideo.prepare(o) → Promise<video>   o = { trade, lang, name, logo (url|dataURL|""), accent, phone, site, demo }
         carrega logo e fontes, tira a cor de destaque do logo (se não houver cor da empresa) e devolve o vídeo:
         video.duration (s), video.render(ctx, t, w, h) — desenha o quadro do instante t (determinístico: mesmo t → mesmo quadro),
         video.scenes [{ id, start, dur }], video.warnings (textos que não couberam — os testes exigem zero)
     BiseyVideo.mount(el, video, { autoplay, loop, fit }) → player { play, pause, seek, toggle, destroy, t } (play/pause, barra, tempo, tela cheia)
     BiseyVideo.record(video, { width, height, fps, onProgress, signal }) → Promise<{ blob, mime, ext }>
         grava em tempo real com canvas.captureStream + MediaRecorder: MP4 quando o navegador suporta (Safari, Chrome recente), senão WebM
     BiseyVideo.exportMime() → { mime, ext } que será usado (ou null sem MediaRecorder)
     BiseyVideo.link(o) → link da página só do vídeo (?cv=1&trade=…&lang=…&name=…) · ?cv=demo&trade=electrical&lang=en = empresa de demonstração
     BiseyVideo.publicSection(p, c) → bloco "Veja como trabalhamos" na página de aceite (proposals.js), quando p.video.on
   Rota ?cv=…: página cheia só com o vídeo (equipe de marketing grava a tela). &autoplay=1 começa sozinho; &controls=0 esconde os controles. */
(function () {
  "use strict";
  var SC = window.BiseyVideoScripts; if (!SC) return;
  var W = 1280, H = 720, XF = 0.5; // tamanho lógico do quadro; duração da transição entre cenas (s)
  var C = { navy: "#0A1433", navy2: "#232E48", bg: "#F7F9FE", surface: "#FFFFFF", ink: "#0A1433", ink2: "#3A4664", muted: "#5F6472", line: "#D8DCE6", track: "#EAEDF5",
    nav: "#C9D8FB", good: "#006F36", goodMid: "#21A75A", goodSoft: "#E5FFEB", warn: "#864B03", warnSoft: "#FEF5EE", warnLine: "#FFD3AD", spark: "#FFD84D", brand: "#2A5BFF" };
  var FD = '"Inter Display", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', FB = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var LOCALES = { pt: "pt-BR", en: "en-US", es: "es-US" };
  var DEMO_ACCENT = { electrical: "#C98200", hvac: "#1F6FD1", plumbing: "#0E7C86", sprinkler: "#B3202A", gc: "#334155", drywall: "#6D5D4B", painting: "#6D28D9", flooring: "#8A5A2B", siding: "#15803D", roofing: "#7A3E2E", foundation: "#4B5563" };

  // ═══════════ cores ═══════════
  function rgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return [42, 91, 255]; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(c) { return "#" + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function mix(a, b, k) { var x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * k; })); }
  function rgba(h, a) { var c = rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function lum(h) { return rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function inkOn(bg, min) { var c = bg, i = 0; while (contrast(c, "#FFFFFF") < (min || 4.6) && i++ < 20) c = mix(c, "#000000", 0.12); return c; } // escurece até dar contraste com branco
  // cor dominante (saturada) do logo; null se não der (logo cinza/preto, imagem de outro site sem CORS…)
  function accentFromImage(img) {
    try {
      var c = document.createElement("canvas"), S = 48; c.width = S; c.height = S;
      var g = c.getContext("2d"), r = Math.min(S / (img.naturalWidth || img.width || S), S / (img.naturalHeight || img.height || S));
      g.drawImage(img, 0, 0, (img.naturalWidth || img.width || S) * r, (img.naturalHeight || img.height || S) * r);
      var d = g.getImageData(0, 0, S, S).data, bins = {}, best = null;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 160) continue;
        var R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, s = mx === mn ? 0 : (l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
        if (s < 0.3 || l < 0.16 || l > 0.86) continue;
        var h = mx === R ? ((G - B) / (mx - mn) + 6) % 6 : mx === G ? (B - R) / (mx - mn) + 2 : (R - G) / (mx - mn) + 4, k = Math.floor(h * 4); // 24 faixas de matiz
        var b = bins[k] = bins[k] || { w: 0, r: 0, g: 0, b: 0 }; b.w += s; b.r += d[i] * s; b.g += d[i + 1] * s; b.b += d[i + 2] * s;
      }
      Object.keys(bins).forEach(function (k) { if (!best || bins[k].w > best.w) best = bins[k]; });
      if (!best || best.w < 6) return null;
      return hex([best.r / best.w, best.g / best.w, best.b / best.w]);
    } catch (e) { return null; }
  }

  // ═══════════ texto ═══════════
  function font(g, wgt, size, disp) { g.font = wgt + " " + size + "px " + (disp ? FD : FB); }
  function wrap(g, text, maxW) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = "";
    words.forEach(function (w) { var tr = cur ? cur + " " + w : w; if (cur && g.measureText(tr).width > maxW) { lines.push(cur); cur = w; } else cur = tr; });
    if (cur) lines.push(cur);
    return lines;
  }
  // texto que cabe em maxW × maxLines, diminuindo a fonte até min; se nem assim couber, anota em v.warnings (os testes exigem zero)
  function fit(v, g, text, o) {
    var key = [text, o.w, o.size, o.min, o.maxW, o.maxLines, o.disp].join("|"), c = v._fit[key];
    if (c) return c;
    var size = o.size, lines;
    for (; size >= o.min; size -= 1) {
      font(g, o.w, size, o.disp); lines = wrap(g, text, o.maxW);
      if (lines.length <= o.maxLines && lines.every(function (l) { return g.measureText(l).width <= o.maxW + 0.5; })) return (v._fit[key] = { size: size, lines: lines, o: o });
    }
    size = o.min; font(g, o.w, size, o.disp); lines = wrap(g, text, o.maxW);
    if (o.ellipsis && o.maxLines === 1) { // texto digitado pelo usuário (nome da empresa): corta com "…" em vez de acusar erro
      var s1 = String(text); while (s1.length > 1 && g.measureText(s1 + "…").width > o.maxW) s1 = s1.slice(0, -1);
      return (v._fit[key] = { size: size, lines: [s1.replace(/\s+$/, "") + "…"], o: o });
    }
    v.warnings.push("overflow: " + text);
    if (lines.length > o.maxLines) { lines = lines.slice(0, o.maxLines); lines[lines.length - 1] += "…"; }
    return (v._fit[key] = { size: size, lines: lines, o: o });
  }
  // desenha o bloco; y = topo; devolve a altura usada
  function block(v, g, text, x, y, o) {
    var f = fit(v, g, text, o), lh = Math.round(f.size * (o.lh || 1.18));
    font(g, o.w, f.size, o.disp); g.fillStyle = o.color || C.ink; g.textAlign = o.align || "left"; g.textBaseline = "top";
    f.lines.forEach(function (l, i) { g.fillText(l, x, y + i * lh); });
    return f.lines.length * lh;
  }
  function txt(g, s, x, y, wgt, size, color, align, disp) { font(g, wgt, size, disp); g.fillStyle = color; g.textAlign = align || "left"; g.textBaseline = "top"; g.fillText(s, x, y); return g.measureText(s).width; }
  function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); }

  // ═══════════ formas ═══════════
  function rr(g, x, y, w, h, r) { g.beginPath(); rrPath(g, x, y, w, h, r); }
  function rrPath(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function card(g, x, y, w, h, r, fillC, stroke) {
    g.save(); g.shadowColor = "rgba(10,20,51,0.08)"; g.shadowBlur = 18; g.shadowOffsetY = 6; rr(g, x, y, w, h, r); g.fillStyle = fillC || C.surface; g.fill(); g.restore();
    if (stroke !== false) { rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r); g.strokeStyle = stroke || C.line; g.lineWidth = 1; g.stroke(); }
  }
  function pill(g, x, y, text, o) { // x = esquerda (ou direita com o.right); devolve a largura
    font(g, o.w || 600, o.size || 15); var tw = g.measureText(text).width, pad = o.pad || 12, ic = o.icon ? (o.size || 15) + 8 : 0, w = tw + pad * 2 + ic, h = (o.size || 15) + 16;
    if (o.right) x -= w;
    rr(g, x, y, w, h, h / 2); g.fillStyle = o.bg; g.fill(); if (o.line) { g.strokeStyle = o.line; g.lineWidth = 1; g.stroke(); }
    if (o.icon) icon(g, o.icon, x + pad + (o.size || 15) / 2, y + h / 2, (o.size || 15) + 2, o.color);
    txt(g, text, x + pad + ic, y + 8, o.w || 600, o.size || 15, o.color);
    return w;
  }
  function ring(g, cx, cy, r, k, color, lw) {
    g.lineCap = "round"; g.lineWidth = lw || 6; g.strokeStyle = C.track; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    if (k > 0.001) { g.strokeStyle = color; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); g.stroke(); }
  }
  // ícones simples em traço (cx, cy = centro; s = tamanho)
  function icon(g, kind, cx, cy, s, color) {
    var u = s / 24; g.save(); g.translate(cx - 12 * u, cy - 12 * u); g.scale(u, u);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
    var P = function (pts) { pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); };
    switch (kind) {
      case "check": P([[5, 12.5], [10, 17.5], [19, 7]]); break;
      case "money": g.arc(12, 12, 9, 0, Math.PI * 2); g.moveTo(15, 9); g.bezierCurveTo(14, 7.5, 9, 7.2, 9, 9.8); g.bezierCurveTo(9, 12.4, 15, 11.6, 15, 14.2); g.bezierCurveTo(15, 16.8, 10, 16.6, 9, 15); g.moveTo(12, 6); g.lineTo(12, 7.6); g.moveTo(12, 16.4); g.lineTo(12, 18); break;
      case "box": P([[12, 3], [20, 7.5], [20, 16.5], [12, 21], [4, 16.5], [4, 7.5], [12, 3]]); P([[4, 7.5], [12, 12], [20, 7.5]]); g.moveTo(12, 12); g.lineTo(12, 21); break;
      case "doc": P([[6, 3], [14, 3], [19, 8], [19, 21], [6, 21], [6, 3]]); P([[14, 3], [14, 8], [19, 8]]); g.moveTo(9, 12.5); g.lineTo(16, 12.5); g.moveTo(9, 16.5); g.lineTo(16, 16.5); break;
      case "cal": rrPath(g, 3.5, 5, 17, 15.5, 2.5); g.moveTo(3.5, 10); g.lineTo(20.5, 10); g.moveTo(8, 3); g.lineTo(8, 7); g.moveTo(16, 3); g.lineTo(16, 7); g.moveTo(8, 14); g.lineTo(8.1, 14); g.moveTo(12, 14); g.lineTo(12.1, 14); g.moveTo(16, 14); g.lineTo(16.1, 14); break;
      case "tool": g.moveTo(14.5, 9.5); g.lineTo(4.5, 19.5); g.moveTo(15.2, 3.4); g.arc(16.5, 7.5, 4.3, -1.9, 3.5, false); break;
      case "inspect": g.arc(10.5, 10.5, 6.5, 0, Math.PI * 2); g.moveTo(15.3, 15.3); g.lineTo(20.5, 20.5); g.moveTo(7.5, 10.7); g.lineTo(9.7, 12.8); g.lineTo(13.5, 8.6); break;
      case "spark": P([[12, 2.5], [14, 10], [21.5, 12], [14, 14], [12, 21.5], [10, 14], [2.5, 12], [10, 10], [12, 2.5]]); break;
      case "shield": P([[12, 2.8], [19.5, 5.8], [19.5, 11.5]]); g.bezierCurveTo(19.5, 16.5, 16, 19.6, 12, 21.2); g.bezierCurveTo(8, 19.6, 4.5, 16.5, 4.5, 11.5); P([[4.5, 11.5], [4.5, 5.8], [12, 2.8]]); g.moveTo(8.5, 12); g.lineTo(11, 14.5); g.lineTo(15.8, 9.5); break;
      case "home": P([[3, 11], [12, 3.5], [21, 11]]); P([[5.5, 9], [5.5, 20.5], [18.5, 20.5], [18.5, 9]]); P([[10, 20.5], [10, 14.5], [14, 14.5], [14, 20.5]]); break;
      case "invoice": P([[5.5, 2.8], [18.5, 2.8], [18.5, 21], [16, 19.5], [13.5, 21], [11, 19.5], [8.5, 21], [5.5, 19.5], [5.5, 2.8]]); g.moveTo(9, 8); g.lineTo(15, 8); g.moveTo(9, 12); g.lineTo(15, 12); g.moveTo(9, 16); g.lineTo(12.5, 16); break;
      case "layers": P([[12, 3.5], [21, 8], [12, 12.5], [3, 8], [12, 3.5]]); P([[3, 12], [12, 16.5], [21, 12]]); P([[3, 16], [12, 20.5], [21, 16]]); break;
      case "paint": rrPath(g, 3.5, 3.5, 15, 6, 1.5); P([[18.5, 6.5], [20.5, 6.5], [20.5, 12], [12, 12], [12, 15]]); rrPath(g, 10.5, 15, 3, 6.5, 1); break;
      case "drop": g.moveTo(12, 3); g.bezierCurveTo(12, 3, 5.5, 10.5, 5.5, 14.5); g.bezierCurveTo(5.5, 18.2, 8.4, 21, 12, 21); g.bezierCurveTo(15.6, 21, 18.5, 18.2, 18.5, 14.5); g.bezierCurveTo(18.5, 10.5, 12, 3, 12, 3); break;
      case "truck": rrPath(g, 2.5, 6, 11.5, 10, 1.5); P([[14, 9.5], [18, 9.5], [21.5, 13], [21.5, 16], [14, 16]]); g.moveTo(9.3, 18.5); g.arc(7, 18.5, 2.3, 0, Math.PI * 2); g.moveTo(19.3, 18.5); g.arc(17, 18.5, 2.3, 0, Math.PI * 2); break;
      case "roof": P([[2.5, 13], [12, 4.5], [21.5, 13]]); P([[6, 10], [6, 20], [18, 20], [18, 10]]); g.moveTo(6, 15); g.lineTo(18, 15); break;
      case "info": g.arc(12, 12, 9, 0, Math.PI * 2); g.moveTo(12, 11); g.lineTo(12, 16.5); g.moveTo(12, 7.6); g.lineTo(12, 7.7); break;
      case "grid": rrPath(g, 4, 4, 7, 7, 1.5); rrPath(g, 13, 4, 7, 7, 1.5); rrPath(g, 4, 13, 7, 7, 1.5); rrPath(g, 13, 13, 7, 7, 1.5); break;
      default: g.arc(12, 12, 8, 0, Math.PI * 2);
    }
    g.stroke(); g.restore();
  }
  // tempo: 0..1 entre a e a + d (com easing)
  function k01(t, a, d) { return Math.max(0, Math.min(1, (t - a) / (d || 1))); }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eio(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function A(g, a, fn) { var o = g.globalAlpha; g.globalAlpha = o * Math.max(0, Math.min(1, a)); fn(); g.globalAlpha = o; } // desenha com transparência relativa

  // logo dentro da caixa (proporção mantida); sem logo, monograma com as iniciais na cor da empresa
  function initials(n) { return String(n || "?").split(/\s+/).filter(function (w) { return /^[A-Za-z\u00C0-\u00FF0-9]/.test(w); }).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || "?"; }
  function drawLogo(v, g, x, y, w, h, align) {
    var img = v.logoImg;
    if (img) {
      var iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1, s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
      var dx = align === "left" ? x : align === "right" ? x + w - dw : x + (w - dw) / 2;
      g.imageSmoothingQuality = "high"; g.drawImage(img, dx, y + (h - dh) / 2, dw, dh); return dw;
    }
    var sz = Math.min(w, h), mx = align === "left" ? x : align === "right" ? x + w - sz : x + (w - sz) / 2;
    rr(g, mx, y + (h - sz) / 2, sz, sz, sz * 0.22); g.fillStyle = v.accent; g.fill();
    txt(g, initials(v.name), mx + sz / 2, y + (h - sz) / 2 + sz * 0.27, 700, Math.round(sz * 0.42), "#FFFFFF", "center", true);
    return sz;
  }
  // selo da marca no canto (logo em cartão branco, ou nome)
  function brandChip(v, g, x, y, h, alignRight) {
    var w = v.logoImg ? Math.min(240, h * 1.15 * ((v.logoImg.naturalWidth || 1) / (v.logoImg.naturalHeight || 1)) + 28) : 0;
    if (!v.logoImg) { font(g, 700, 18, true); w = Math.min(320, h + 18 + g.measureText(v.name).width + 18); }
    var bx = alignRight ? x - w : x;
    card(g, bx, y, w, h, 14, C.surface, C.line);
    if (v.logoImg) drawLogo(v, g, bx + 14, y + 8, w - 28, h - 16);
    else { drawLogo(v, g, bx + 10, y + 8, h - 16, h - 16, "left"); block(v, g, v.name, bx + h + 2, y + h / 2 - 11, { w: 700, size: 18, min: 14, maxW: w - h - 14, maxLines: 1, disp: true, ellipsis: true }); }
  }
  function money(v, n) { return v.fmt.format(Math.round(n)); }

  // ═══════════ cenas ═══════════
  var STEP = 3.9; // segundos por etapa: cada texto fica ≥ 3,5 s na tela (pedido do dono: o anúncio anterior era rápido demais)
  function scenesOf(v) {
    var n = v.steps.length;
    return [["intro", 5], ["approved", 5], ["steps", n * STEP], ["client", 4 * 4.2], ["dash", 10.5], ["closing", 6.5]];
  }

  function sIntro(v, g, t) {
    g.fillStyle = C.surface; g.fillRect(0, 0, W, H);
    g.fillStyle = rgba(v.accent, 0.07); g.beginPath(); g.arc(1180, 80, 260, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(90, 690, 180, 0, Math.PI * 2); g.fill();
    g.fillStyle = v.accent; g.fillRect(0, H - 10, W * eo(k01(t, 0.1, 1.4)), 10);
    var a = eo(k01(t, 0.15, 0.8)), s = 0.94 + 0.06 * a;
    A(g, a, function () { g.save(); g.translate(W / 2, 250); g.scale(s, s); g.translate(-W / 2, -250); drawLogo(v, g, W / 2 - 300, 140, 600, 220); g.restore(); });
    A(g, eo(k01(t, 0.6, 0.7)), function () { block(v, g, v.name, W / 2, 392, { w: 700, size: 46, min: 30, maxW: 1100, maxLines: 1, disp: true, align: "center", color: C.ink, ellipsis: true }); });
    A(g, eo(k01(t, 1.1, 0.7)), function () {
      block(v, g, v.ui.tagline, W / 2, 458, { w: 500, size: 30, min: 22, maxW: 1000, maxLines: 1, align: "center", color: C.muted });
      font(g, 700, 17); var tl = v.tradeName.toUpperCase(), tw = g.measureText(tl).width + 32;
      rr(g, W / 2 - tw / 2, 520, tw, 36, 18); g.fillStyle = rgba(v.accent, 0.12); g.fill();
      txt(g, tl, W / 2, 529, 700, 17, v.accentInk, "center");
    });
  }

  function sApproved(v, g, t) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    brandChip(v, g, 48, 36, 60);
    var a = eo(k01(t, 0.1, 0.6)), cx = W / 2, cy = 228;
    A(g, a, function () {
      g.fillStyle = C.goodSoft; g.beginPath(); g.arc(cx, cy, 70 * (0.8 + 0.2 * a), 0, Math.PI * 2); g.fill();
      g.fillStyle = C.goodMid; g.beginPath(); g.arc(cx, cy, 50, 0, Math.PI * 2); g.fill();
      var k = eo(k01(t, 0.4, 0.6)); g.save(); g.strokeStyle = "#FFFFFF"; g.lineWidth = 9; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
      var p = [[cx - 22, cy + 2], [cx - 6, cy + 18], [cx + 24, cy - 16]], L1 = Math.hypot(16, 16), L2 = Math.hypot(30, 34), d = (L1 + L2) * k;
      g.moveTo(p[0][0], p[0][1]); if (d <= L1) g.lineTo(p[0][0] + 16 * d / L1, p[0][1] + 16 * d / L1); else { g.lineTo(p[1][0], p[1][1]); g.lineTo(p[1][0] + 30 * (d - L1) / L2, p[1][1] - 34 * (d - L1) / L2); }
      g.stroke(); g.restore();
    });
    A(g, eo(k01(t, 0.35, 0.6)), function () { block(v, g, v.ui.approved1, W / 2, 334, { w: 700, size: 60, min: 40, maxW: 1100, maxLines: 1, disp: true, align: "center" }); });
    A(g, eo(k01(t, 1.0, 0.6)), function () { block(v, g, v.ui.approved2, W / 2, 420, { w: 600, size: 40, min: 28, maxW: 1100, maxLines: 1, disp: true, align: "center", color: v.accentInk }); });
  }

  function sSteps(v, g, t) {
    var n = v.steps.length, i = Math.min(n - 1, Math.floor(t / STEP)), lt = t - i * STEP, st = v.steps[i];
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    block(v, g, fill(v.ui.stepsHead, { trade: v.tradeName }), 64, 52, { w: 700, size: 32, min: 22, maxW: 820, maxLines: 1, disp: true });
    brandChip(v, g, W - 48, 36, 60, true);
    // trilho à esquerda com todas as etapas
    var top = 132, rowH = Math.min(50, 548 / n), x0 = 64;
    g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 15, top + rowH / 2); g.lineTo(x0 + 15, top + rowH * (n - 0.5)); g.stroke();
    g.strokeStyle = v.accent; g.beginPath(); g.moveTo(x0 + 15, top + rowH / 2); g.lineTo(x0 + 15, top + rowH * (i + 0.5)); g.stroke(); // trilho preenchido até a etapa atual
    v.steps.forEach(function (s, j) {
      var cy = top + rowH * (j + 0.5), done = j < i, cur = j === i;
      if (cur) { rr(g, x0 - 8, cy - rowH / 2 + 3, 404, rowH - 6, 12); g.fillStyle = rgba(v.accent, 0.12); g.fill(); }
      g.beginPath(); g.arc(x0 + 15, cy, 14, 0, Math.PI * 2); g.fillStyle = done || cur ? v.accent : C.surface; g.fill();
      if (!done && !cur) { g.strokeStyle = C.line; g.lineWidth = 2; g.stroke(); }
      if (done) icon(g, "check", x0 + 15, cy, 18, "#FFFFFF");
      else txt(g, String(j + 1), x0 + 15, cy - 8, 700, 14, cur ? "#FFFFFF" : C.muted, "center");
      block(v, g, s.t, x0 + 42, cy - 11, { w: cur ? 700 : 500, size: 19, min: 14, maxW: 346, maxLines: 1, color: cur ? C.ink : done ? C.ink2 : C.muted });
    });
    // cartão da etapa atual
    var a = eo(k01(lt, 0, 0.45)), cx = 500, cy0 = 132, cw = 716, ch = 460, dy = (1 - a) * 22;
    card(g, cx, cy0, cw, ch, 22);
    A(g, a, function () {
      g.save(); g.translate(0, dy);
      g.fillStyle = rgba(v.accent, 0.12); g.beginPath(); g.arc(cx + 92, cy0 + 96, 50, 0, Math.PI * 2); g.fill();
      icon(g, st.icon, cx + 92, cy0 + 96, 52, v.accentInk);
      txt(g, fill(v.ui.stepOf, { i: i + 1, n: n }), cx + 166, cy0 + 84, 600, 22, C.muted);
      var hh = block(v, g, st.t, cx + 48, cy0 + 168, { w: 700, size: 48, min: 32, maxW: cw - 96, maxLines: 2, disp: true });
      block(v, g, st.d, cx + 48, cy0 + 168 + hh + 14, { w: 400, size: 30, min: 22, maxW: cw - 96, maxLines: 3, color: C.ink2, lh: 1.3 });
      g.restore();
    });
    // barra segmentada (etapa i de n)
    var bx = cx + 48, bw = cw - 96, gap = 6, sw = (bw - gap * (n - 1)) / n;
    for (var j = 0; j < n; j++) { rr(g, bx + j * (sw + gap), cy0 + ch - 34, sw, 8, 4); g.fillStyle = j < i ? v.accent : j === i ? mix(v.accent, "#FFFFFF", 0.45 * (1 - a)) : C.track; g.fill(); }
    // pagamento ligado à etapa
    if (st.pay) A(g, eo(k01(lt, 0.4, 0.5)), function () {
      var lab = st.pay === "deposit" ? v.ui.depositRow : st.pay === "progress" ? v.ui.progressRow : v.ui.finalRow, pct = v.split[st.pay];
      pill(g, cx, 610, lab + " · " + fill(v.ui.ofContract, { p: pct }), { bg: C.goodSoft, color: C.good, size: 20, icon: "money", line: "#B1EEC0", pad: 16 });
    });
  }

  // tela do celular (cena "o que o cliente vê")
  function phone(v, g, x, y, w, h, draw) {
    g.save(); g.shadowColor = "rgba(10,20,51,0.22)"; g.shadowBlur = 36; g.shadowOffsetY = 14; rr(g, x, y, w, h, 48); g.fillStyle = C.navy; g.fill(); g.restore();
    var sx = x + 12, sy = y + 12, sw = w - 24, sh = h - 24;
    g.save(); rr(g, sx, sy, sw, sh, 38); g.clip(); g.fillStyle = C.bg; g.fillRect(sx, sy, sw, sh); draw(sx, sy + 34, sw, sh - 34); g.restore();
    rr(g, x + w / 2 - 50, y + 22, 100, 24, 12); g.fillStyle = C.navy; g.fill();
  }
  function bars(g, x, y, ws, color) { ws.forEach(function (w, i) { rr(g, x, y + i * 16, w, 8, 4); g.fillStyle = color || C.track; g.fill(); }); }
  function screenProposal(v, g, x, y, w, h, t) {
    g.fillStyle = C.surface; g.fillRect(x, y, w, 62); g.fillStyle = C.line; g.fillRect(x, y + 62, w, 1);
    drawLogo(v, g, x + 16, y + 12, 96, 38, "left");
    block(v, g, v.ui.proposal + " EST-1042", x + w - 16, y + 23, { w: 600, size: 14, min: 10, maxW: w - 136, maxLines: 1, align: "right", color: C.muted });
    card(g, x + 14, y + 78, w - 28, 268, 12);
    g.fillStyle = v.accent; g.fillRect(x + 14, y + 78, w - 28, 6);
    block(v, g, v.ui.proposal.toUpperCase(), x + 30, y + 100, { w: 700, size: 17, min: 12, maxW: w - 60, maxLines: 1, disp: true });
    bars(g, x + 30, y + 132, [210, 170, 230, 120]);
    g.fillStyle = C.line; g.fillRect(x + 30, y + 206, w - 60, 1);
    bars(g, x + 30, y + 220, [150, 190, 110]);
    txt(g, money(v, v.value), x + w - 30, y + 308, 700, 18, C.ink, "right");
    var a = eo(k01(t, 0.7, 0.5));
    A(g, a, function () {
      var by = y + 362 + (1 - a) * 16; rr(g, x + 14, by, w - 28, 112, 12); g.fillStyle = C.goodSoft; g.fill(); g.strokeStyle = "#2E7D4F"; g.lineWidth = 2; g.stroke();
      icon(g, "check", x + 38, by + 30, 22, C.good);
      block(v, g, v.ui.accepted, x + 56, by + 19, { w: 700, size: 18, min: 12, maxW: w - 94, maxLines: 1, color: C.good });
      block(v, g, v.ui.acceptedBy + " · " + v.dateStr, x + 30, by + 52, { w: 500, size: 14, min: 10, maxW: w - 60, maxLines: 1, color: C.ink2 });
      block(v, g, v.ui.thanks, x + 30, by + 74, { w: 400, size: 13, min: 10, maxW: w - 60, maxLines: 2, color: C.muted });
    });
    rr(g, x + 14, y + h - 70, w - 28, 48, 12); g.fillStyle = v.accent; g.fill();
    block(v, g, v.ui.pdf, x + w / 2, y + h - 56, { w: 700, size: 17, min: 12, maxW: w - 60, maxLines: 1, align: "center", color: v.onAccent });
  }
  function screenCalendar(v, g, x, y, w, h, t) {
    block(v, g, v.ui.month, x + 20, y + 14, { w: 700, size: 22, min: 14, maxW: w - 40, maxLines: 1, disp: true });
    var cw = (w - 28) / 7, gx = x + 14, gy = y + 56;
    v.ui.week.forEach(function (d, i) { txt(g, d, gx + cw * i + cw / 2, gy, 600, 13, C.muted, "center"); });
    var ev = v.calEvents, first = 5; // 1º de maio de 2026 = sexta
    for (var d = 1; d <= 31; d++) {
      var c = (first + d - 1) % 7, r = Math.floor((first + d - 1) / 7), cx = gx + cw * c + cw / 2, cy = gy + 34 + r * 38;
      var e = ev.find(function (x) { return x.day === d; }), on = e ? eo(k01(t, 0.4 + e.k * 0.45, 0.4)) : 0;
      if (on > 0) { g.fillStyle = rgba(v.accent, on); g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill(); }
      txt(g, String(d), cx, cy - 8, on > 0.5 ? 700 : 500, 14, on > 0.5 ? v.onAccent : C.ink, "center");
    }
    var ly = gy + 34 + 6 * 38 - 4;
    ev.forEach(function (e, i) {
      A(g, eo(k01(t, 0.4 + i * 0.45, 0.4)), function () {
        var ry = ly + i * 64; card(g, x + 14, ry, w - 28, 54, 10);
        rr(g, x + 26, ry + 10, 44, 34, 8); g.fillStyle = rgba(v.accent, 0.12); g.fill();
        txt(g, String(e.day), x + 48, ry + 18, 700, 16, v.accentInk, "center");
        block(v, g, e.title, x + 82, ry + 17, { w: 600, size: 15, min: 10, maxW: w - 112, maxLines: 1 });
      });
    });
  }
  function screenReport(v, g, x, y, w, h, t) {
    block(v, g, v.ui.report, x + 20, y + 14, { w: 700, size: 21, min: 13, maxW: w - 40, maxLines: 1, disp: true });
    block(v, g, v.ui.sampleJob + " · " + v.dateStr2, x + 20, y + 46, { w: 500, size: 14, min: 10, maxW: w - 40, maxLines: 1, color: C.muted });
    card(g, x + 14, y + 80, w - 28, 132, 12);
    var p = eo(k01(t, 0.3, 1.6)) * v.reportPct;
    block(v, g, v.ui.jobProgress, x + 30, y + 96, { w: 600, size: 14, min: 10, maxW: w - 60, maxLines: 1, color: C.muted });
    txt(g, Math.round(p) + "%", x + 30, y + 120, 700, 40, C.ink, "left", true);
    rr(g, x + 30, y + 178, w - 60, 10, 5); g.fillStyle = C.track; g.fill();
    rr(g, x + 30, y + 178, (w - 60) * p / 100, 10, 5); g.fillStyle = v.accent; g.fill();
    block(v, g, v.ui.completedToday, x + 20, y + 232, { w: 700, size: 15, min: 10, maxW: w - 40, maxLines: 1 });
    v.reportDone.forEach(function (s, i) {
      A(g, eo(k01(t, 0.9 + i * 0.4, 0.4)), function () {
        var ry = y + 262 + i * 62; card(g, x + 14, ry, w - 28, 52, 10);
        g.fillStyle = C.goodSoft; g.beginPath(); g.arc(x + 42, ry + 26, 14, 0, Math.PI * 2); g.fill(); icon(g, "check", x + 42, ry + 26, 18, C.good);
        block(v, g, s, x + 66, ry + 16, { w: 600, size: 15, min: 10, maxW: w - 96, maxLines: 1 });
      });
    });
  }
  function screenInvoices(v, g, x, y, w, h, t) {
    block(v, g, v.ui.invoices, x + 20, y + 14, { w: 700, size: 22, min: 14, maxW: w - 40, maxLines: 1, disp: true });
    var rows = [[v.ui.depositRow, v.amounts.deposit, true], [v.ui.progressRow, v.amounts.progress, true], [v.ui.finalRow, v.amounts.final, false]];
    rows.forEach(function (r, i) {
      A(g, eo(k01(t, 0.3 + i * 0.35, 0.4)), function () {
        var ry = y + 60 + i * 96; card(g, x + 14, ry, w - 28, 84, 12);
        txt(g, "INV-10" + (51 + i), x + 30, ry + 14, 600, 12, C.muted);
        block(v, g, r[0], x + 30, ry + 32, { w: 700, size: 16, min: 11, maxW: w - 170, maxLines: 1 });
        txt(g, money(v, r[1]), x + 30, ry + 56, 500, 14, C.ink2);
        var paid = r[2];
        pill(g, x + w - 30, ry + 26, paid ? v.ui.paid : v.ui.due, { right: true, bg: paid ? C.goodSoft : C.warnSoft, color: paid ? C.good : C.warn, line: paid ? "#B1EEC0" : C.warnLine, size: 13, pad: 10 });
      });
    });
    A(g, eo(k01(t, 1.5, 0.5)), function () {
      var by = y + 362; card(g, x + 14, by, w - 28, 92, 12, C.surface, v.accent);
      block(v, g, v.ui.balance, x + 30, by + 16, { w: 600, size: 15, min: 10, maxW: w - 60, maxLines: 1, color: C.muted });
      txt(g, money(v, v.amounts.final), x + 30, by + 42, 700, 30, C.ink, "left", true);
    });
  }
  function sClient(v, g, t) {
    var D = 4.2, i = Math.min(3, Math.floor(t / D)), lt = t - i * D;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = rgba(v.accent, 0.06); g.beginPath(); g.arc(990, 360, 330, 0, Math.PI * 2); g.fill();
    brandChip(v, g, 48, 36, 60);
    var keys = [["c1h", "c1s"], ["c2h", "c2s"], ["c3h", "c3s"], ["c4h", "c4s"]], a = i === 0 ? 1 : eo(k01(lt, 0, 0.4));
    for (var j = 0; j < 4; j++) { rr(g, 64 + j * 58, 196, 48, 6, 3); g.fillStyle = j <= i ? v.accent : C.line; g.fill(); }
    A(g, a, function () {
      var hh = block(v, g, v.ui[keys[i][0]], 64, 232, { w: 700, size: 54, min: 36, maxW: 640, maxLines: 2, disp: true });
      block(v, g, v.ui[keys[i][1]], 64, 232 + hh + 22, { w: 400, size: 30, min: 22, maxW: 620, maxLines: 3, color: C.ink2, lh: 1.32 });
    });
    var scr = [screenProposal, screenCalendar, screenReport, screenInvoices];
    phone(v, g, 840, 30, 340, 660, function (x, y, w, h) {
      if (i > 0 && lt < 0.4) { scr[i - 1](v, g, x, y, w, h, D); g.globalAlpha = eo(lt / 0.4); g.fillStyle = C.bg; g.fillRect(x, y - 34, w, h + 34); }
      scr[i](v, g, x, y, w, h, lt); g.globalAlpha = 1;
    });
  }

  function sDash(v, g, t) {
    var n = v.steps.length, p = eio(k01(t, 1.2, 7)), k = Math.min(n, Math.floor(p * n + 1e-6));
    // ── barra lateral (como o app) ──
    g.fillStyle = C.navy; g.fillRect(0, 0, W, H);
    rr(g, 14, 18, 204, 64, 12); g.fillStyle = "#FFFFFF"; g.fill(); drawLogo(v, g, 26, 26, 180, 48);
    block(v, g, v.name, 18, 94, { w: 700, size: 15, min: 12, maxW: 196, maxLines: 1, color: "#FFFFFF", ellipsis: true });
    block(v, g, v.tradeName, 18, 116, { w: 500, size: 13, min: 9, maxW: 196, maxLines: 1, color: C.nav });
    v.ui.nav.forEach(function (lab, i) {
      var y = 168 + i * 44; if (!i) { rr(g, 14, y - 9, 204, 38, 10); g.fillStyle = C.navy2; g.fill(); g.fillStyle = v.accent; g.fillRect(0, y - 3, 4, 26); }
      icon(g, ["grid", "cal", "home", "doc", "invoice"][i], 40, y + 10, 18, i ? C.nav : "#FFFFFF");
      block(v, g, lab, 60, y + 1, { w: i ? 500 : 600, size: 16, min: 11, maxW: 150, maxLines: 1, color: i ? C.nav : "#FFFFFF" });
    });
    // ── área principal ──
    g.fillStyle = C.bg; g.fillRect(232, 0, W - 232, H);
    txt(g, v.ui.dashTitle, 264, 34, 700, 36, C.ink, "left", true);
    block(v, g, v.ui.dashSub, 264, 82, { w: 400, size: 19, min: 13, maxW: 560, maxLines: 1, color: C.muted });
    block(v, g, v.ui.sampleJob + " · " + v.tradeName, 264, 110, { w: 600, size: 14, min: 10, maxW: 560, maxLines: 1, color: C.ink2 });
    // selo obrigatório: números de exemplo
    pill(g, W - 32, 40, v.ui.example, { right: true, bg: C.warnSoft, color: C.warn, line: C.warnLine, size: 16, icon: "info", pad: 14 });
    // valores recebidos (sobem quando a etapa do pagamento termina)
    var recv = function (key) { var ti = v.payAt[key]; return ti == null ? 0 : v.amounts[key] * eo(k01(t, ti, 0.6)); };
    var dep = recv("deposit"), prog = recv("progress") + recv("final"), total = dep + prog;
    var cards = [
      [v.ui.contract, money(v, v.value), v.ui.sampleJob, null, C.ink],
      [v.ui.deposit, money(v, dep), fill(v.ui.ofContract, { p: v.split.deposit }), dep / v.amounts.deposit, C.good],
      [v.ui.progressPay, money(v, prog), fill(v.ui.ofContract, { p: Math.round(total / v.value * 100) }), total / v.value, C.good],
      [v.ui.stages, k + " / " + n, "", k / n, v.accentInk]
    ];
    cards.forEach(function (c, i) {
      var x = 264 + i * 250, y = 150, w = 234, h = 170; card(g, x, y, w, h, 14);
      block(v, g, c[0], x + 18, y + 18, { w: 500, size: 15, min: 11, maxW: c[3] == null ? w - 36 : w - 96, maxLines: 2, color: C.muted, lh: 1.25 });
      block(v, g, c[1], x + 18, y + 66, { w: 700, size: 32, min: 20, maxW: w - 36, maxLines: 1, disp: true, color: c[4] });
      block(v, g, c[2], x + 18, y + 118, { w: 400, size: 14, min: 10, maxW: w - 36, maxLines: 2, color: C.muted });
      if (c[3] != null) { ring(g, x + w - 40, y + 40, 22, c[3], i === 3 ? v.accent : C.goodMid, 6); txt(g, Math.round(c[3] * 100) + "%", x + w - 40, y + 34, 700, 11, C.ink, "center"); }
    });
    // progresso da obra
    var px = 264, py = 338, pw = 610, ph = 340; card(g, px, py, pw, ph, 14);
    block(v, g, v.ui.jobProgress, px + 22, py + 20, { w: 600, size: 18, min: 12, maxW: pw - 44, maxLines: 1 });
    txt(g, Math.round(p * 100) + "%", px + 22, py + 52, 700, 56, C.ink, "left", true);
    var bx = px + 22, by = py + 136, bw = pw - 44;
    rr(g, bx, by, bw, 12, 6); g.fillStyle = C.track; g.fill(); rr(g, bx, by, Math.max(12, bw * p), 12, 6); g.fillStyle = v.accent; g.fill();
    g.beginPath(); g.arc(bx + Math.max(6, bw * p), by + 6, 11, 0, Math.PI * 2); g.fillStyle = "#FFFFFF"; g.fill(); g.lineWidth = 3; g.strokeStyle = v.accent; g.stroke();
    for (var j = 0; j < n; j++) { var dx = bx + bw * (j + 1) / n; g.beginPath(); g.arc(Math.min(dx, bx + bw - 5), by + 34, 5, 0, Math.PI * 2); g.fillStyle = j < k ? v.accent : C.line; g.fill(); }
    var now = k >= n ? v.ui.done : fill(v.ui.now, { s: v.steps[Math.min(n - 1, k)].t });
    if (k >= n) A(g, eo(k01(t, v.doneAt, 0.5)), function () { pill(g, px + 22, py + 186, v.ui.done, { bg: C.goodSoft, color: C.good, line: "#B1EEC0", size: 20, icon: "check", pad: 16 }); });
    else block(v, g, now, px + 22, py + 190, { w: 600, size: 22, min: 14, maxW: pw - 44, maxLines: 1, color: C.ink2 });
    var dn = v.steps.slice(Math.max(0, k - 2), k);
    dn.forEach(function (s, i) { icon(g, "check", px + 34, py + 262 + i * 34, 18, C.good); block(v, g, s.t, px + 52, py + 252 + i * 34, { w: 500, size: 16, min: 11, maxW: pw - 80, maxLines: 1, color: C.muted }); });
    // saldo e pagamentos
    var qx = 890, qw = 358; card(g, qx, py, qw, ph, 14);
    block(v, g, v.ui.balance, qx + 22, py + 20, { w: 600, size: 18, min: 12, maxW: qw - 44, maxLines: 1 });
    txt(g, money(v, v.value - total), qx + 22, py + 52, 700, 44, C.ink, "left", true);
    [["deposit", v.ui.depositRow], ["progress", v.ui.progressRow], ["final", v.ui.finalRow]].forEach(function (r, i) {
      var ry = py + 134 + i * 64, paid = v.payAt[r[0]] != null && t >= v.payAt[r[0]];
      g.fillStyle = C.line; g.fillRect(qx + 22, ry - 10, qw - 44, 1);
      block(v, g, r[1], qx + 22, ry + 4, { w: 600, size: 16, min: 11, maxW: qw - 150, maxLines: 1 });
      txt(g, money(v, v.amounts[r[0]]), qx + 22, ry + 28, 400, 14, C.muted);
      pill(g, qx + qw - 22, ry + 6, paid ? v.ui.paid : v.ui.due, { right: true, bg: paid ? C.goodSoft : C.warnSoft, color: paid ? C.good : C.warn, line: paid ? "#B1EEC0" : C.warnLine, size: 13, pad: 10 });
    });
  }

  function sClosing(v, g, t) {
    g.fillStyle = C.navy; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.035)"; g.beginPath(); g.arc(W / 2, 1060, 600, 0, Math.PI * 2); g.fill();
    g.fillStyle = v.accent; g.fillRect(0, H - 10, W, 10);
    A(g, eo(k01(t, 0.1, 0.6)), function () { card(g, W / 2 - 220, 70, 440, 170, 24, "#FFFFFF", false); drawLogo(v, g, W / 2 - 190, 92, 380, 126); });
    A(g, eo(k01(t, 0.4, 0.6)), function () { block(v, g, v.ui.closing1, W / 2, 290, { w: 700, size: 50, min: 34, maxW: 1100, maxLines: 1, disp: true, align: "center", color: "#FFFFFF" }); });
    A(g, eo(k01(t, 0.8, 0.6)), function () { block(v, g, v.ui.closing2, W / 2, 364, { w: 400, size: 30, min: 22, maxW: 1100, maxLines: 1, align: "center", color: C.nav }); });
    A(g, eo(k01(t, 1.2, 0.6)), function () {
      var contact = [v.phone, v.site].filter(Boolean).join("   ·   ");
      block(v, g, v.name, W / 2, 456, { w: 700, size: 30, min: 22, maxW: 1100, maxLines: 1, disp: true, align: "center", color: "#FFFFFF", ellipsis: true });
      if (contact) block(v, g, contact, W / 2, 506, { w: 700, size: 32, min: 20, maxW: 1100, maxLines: 1, align: "center", color: C.spark, ellipsis: true });
    });
  }
  var DRAW = { intro: sIntro, approved: sApproved, steps: sSteps, client: sClient, dash: sDash, closing: sClosing };

  // ═══════════ vídeo ═══════════
  function build(o, logoImg) {
    var lang = SC.UI[o.lang] ? o.lang : "en", tr = SC.TRADES[o.trade] ? o.trade : "electrical", T = SC.TRADES[tr], ui = SC.UI[lang];
    var accent = /^#[0-9a-f]{6}$/i.test(o.accent || "") ? o.accent : C.brand;
    var v = { lang: lang, trade: tr, ui: ui, name: String(o.name || "").trim() || ui.wordmarkFallback, phone: String(o.phone || "").trim(), site: String(o.site || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      logoImg: logoImg || null, accent: accent, accentInk: inkOn(accent), onAccent: contrast(accent, "#FFFFFF") >= 3 ? "#FFFFFF" : C.ink,
      tradeName: T.name[lang], value: T.value, steps: T.steps.map(function (s) { return { icon: s.icon, pay: s.pay, t: s[lang][0], d: s[lang][1] }; }),
      split: { deposit: 30, progress: 40, final: 30 }, warnings: [], _fit: {} };
    v.amounts = { deposit: v.value * 0.3, progress: v.value * 0.4, final: v.value - v.value * 0.3 - v.value * 0.4 };
    v.fmt = new Intl.NumberFormat(LOCALES[lang], { style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0 });
    var df = function (d) { try { return new Intl.DateTimeFormat(LOCALES[lang], { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 4, d))); } catch (e) { return "05/" + d; } };
    v.dateStr = df(4); v.dateStr2 = df(14);
    // calendário: as 3 etapas seguintes ao agendamento
    var si = v.steps.findIndex(function (s) { return s.icon === "cal"; }); if (si < 0) si = 2;
    v.calEvents = v.steps.slice(si + 1, si + 4).map(function (s, i) { return { day: [11, 14, 19][i], title: s.t, k: i }; });
    var pi = v.steps.findIndex(function (s) { return s.pay === "progress"; });
    v.reportDone = v.steps.slice(Math.max(si + 1, pi - 2), pi + 1).map(function (s) { return s.t; }).slice(-3);
    v.reportPct = Math.round((pi + 1) / v.steps.length * 100);
    // cenas e tempos
    var at = 0; v.scenes = scenesOf(v).map(function (s) { var x = { id: s[0], start: at, dur: s[1] }; at += s[1]; return x; });
    v.duration = at;
    // painel: quando cada pagamento entra (fim da etapa com "pay")
    var n = v.steps.length, ease = function (x) { return eio(Math.max(0, Math.min(1, (x - 1.2) / 7))); };
    var whenDone = function (cnt) { for (var x = 0; x <= 10.5; x += 0.01) if (Math.floor(ease(x) * n + 1e-6) >= cnt) return x; return 10.5; };
    v.payAt = {}; v.steps.forEach(function (s, i) { if (s.pay) v.payAt[s.pay] = whenDone(i + 1); });
    v.doneAt = whenDone(n);
    v.render = function (g, t, w, h) { render(v, g, t, w || W, h || H); };
    v.sceneAt = function (t) { return sceneAt(v, t); };
    v.W = W; v.H = H;
    return v;
  }
  function sceneAt(v, t) { for (var i = v.scenes.length - 1; i >= 0; i--) if (t >= v.scenes[i].start) return i; return 0; }
  function render(v, g, t, w, h) {
    t = Math.max(0, Math.min(v.duration - 1e-3, t || 0));
    g.save(); g.setTransform(w / W, 0, 0, h / H, 0, 0); g.globalAlpha = 1;
    var i = sceneAt(v, t), s = v.scenes[i], lt = t - s.start;
    if (i > 0 && lt < XF) { var p = v.scenes[i - 1]; DRAW[p.id](v, g, p.dur - 1e-3); g.globalAlpha = eio(lt / XF); }
    DRAW[s.id](v, g, lt);
    g.restore();
  }

  // ═══════════ preparação (logo, fontes, cor) ═══════════
  function loadImage(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image(); if (/^https?:/i.test(src) && src.indexOf(location.origin) !== 0) img.crossOrigin = "anonymous";
      img.onload = function () { res(img); }; img.onerror = function () { res(null); }; img.src = src;
    });
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var fs = ["400 20px Inter", "500 20px Inter", "600 20px Inter", "700 20px Inter", '600 20px "Inter Display"', '700 20px "Inter Display"'];
    return Promise.all(fs.map(function (f) { return document.fonts.load(f).catch(function () {}); })).then(function () {});
  }
  // logo fictício e neutro para a empresa de demonstração (nenhuma marca real)
  function demoLogo(accent, name) {
    var c = document.createElement("canvas"); c.width = 720; c.height = 240; var g = c.getContext("2d");
    rr(g, 20, 40, 160, 160, 36); g.fillStyle = accent; g.fill();
    g.strokeStyle = "#FFFFFF"; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(64, 158); g.lineTo(64, 84); g.lineTo(136, 158); g.lineTo(136, 84); g.stroke();
    var parts = String(name).split(" "), l1 = parts[0].toUpperCase(), l2 = parts.slice(1).join(" ").toUpperCase();
    txt(g, l1, 210, 62, 700, 64, C.ink, "left", true); txt(g, l2, 212, 138, 600, 38, mix(accent, "#000000", 0.25), "left");
    return new Promise(function (res) { var img = new Image(); img.onload = function () { res(img); }; img.onerror = function () { res(null); }; img.src = c.toDataURL("image/png"); });
  }
  function prepare(o) {
    o = Object.assign({}, o || {});
    if (o.demo) { o.name = o.name || SC.DEMO.name; o.phone = o.phone != null ? o.phone : SC.DEMO.phone; o.site = o.site != null ? o.site : SC.DEMO.site; o.accent = o.accent || DEMO_ACCENT[o.trade] || C.brand; }
    return fontsReady().then(function () { return o.demo && !o.logo ? demoLogo(o.accent, o.name) : loadImage(o.logo); }).then(function (img) {
      if (!/^#[0-9a-f]{6}$/i.test(o.accent || "")) o.accent = (img && accentFromImage(img)) || C.brand; // cor da empresa → cor do logo → cor do Bisey
      return build(o, img);
    });
  }

  // ═══════════ player ═══════════
  var CSS = ".cvp{position:relative;background:#0A1433;border-radius:14px;overflow:hidden;user-select:none;-webkit-user-select:none;max-width:100%}" +
    ".cvp canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#0A1433;cursor:pointer;touch-action:manipulation}" +
    ".cvp-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(10,20,51,.92);color:#fff;font:600 13px/1.2 Inter,system-ui,sans-serif;transition:opacity .25s}" +
    ".cvp-bar button{all:unset;cursor:pointer;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#fff;flex:none}" +
    ".cvp-bar button:hover,.cvp-bar button:focus-visible{background:rgba(255,255,255,.14);outline:none}" +
    ".cvp-bar input[type=range]{flex:1;min-width:60px;accent-color:var(--cvp-accent,#2A5BFF);height:24px;margin:0}" +
    ".cvp-time{font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.9;min-width:84px;text-align:right}" +
    ".cvp-big{position:absolute;left:50%;top:calc(50% - 22px);transform:translate(-50%,-50%);width:76px;height:76px;border-radius:50%;border:0;background:rgba(10,20,51,.78);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.25)}" +
    ".cvp-big[hidden]{display:none}.cvp.full{border-radius:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000}" +
    ".cvp.full canvas{width:min(100vw,calc(100vh * 16 / 9));width:min(100vw,calc(100dvh * 16 / 9));height:auto;margin:0 auto}.cvp.full .cvp-bar{position:absolute;left:0;right:0;bottom:0}" +
    ".cvp.idle .cvp-bar{opacity:0}.cvp.nobar .cvp-bar{display:none}" +
    ".cv-page{position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center}.cv-page .cvp{width:100%;height:100%;background:#000}" +
    ".cv-public{max-width:8.5in;margin:14px auto;padding:16px;background:#fff;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.06)}.cv-public h2{font:700 18px/1.3 Inter,system-ui,sans-serif;margin:0 0 10px;color:#1C2230}@media print{.cv-public{display:none!important}}";
  function css() { if (document.getElementById("cv-css")) return; var s = document.createElement("style"); s.id = "cv-css"; s.textContent = CSS; document.head.appendChild(s); }
  var SVG = { play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>', pause: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    replay: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>', full: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' };
  function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function mount(el, v, o) {
    o = o || {}; css();
    var L = o.labels || { play: "Play", pause: "Pause", full: "Full screen", seek: "Position" };
    el.innerHTML = '<div class="cvp' + (o.full ? " full" : "") + (o.controls === false ? " nobar" : "") + '" style="--cvp-accent:' + v.accent + '"><canvas role="img" aria-label="' + String(v.name + " — " + v.ui.tagline).replace(/"/g, "&quot;") + '"></canvas>' +
      '<button type="button" class="cvp-big" aria-label="' + L.play + '">' + SVG.play.replace(/22/g, "34") + "</button>" +
      '<div class="cvp-bar"><button type="button" class="cvp-pp" aria-label="' + L.play + '">' + SVG.play + '</button><input type="range" min="0" max="' + Math.round(v.duration * 10) + '" value="0" step="1" aria-label="' + L.seek + '"><span class="cvp-time">0:00 / ' + mmss(v.duration) + '</span><button type="button" class="cvp-fs" aria-label="' + L.full + '">' + SVG.full + "</button></div></div>";
    var root = el.firstChild, cv = root.querySelector("canvas"), g = cv.getContext("2d"), pp = root.querySelector(".cvp-pp"), big = root.querySelector(".cvp-big"), rg = root.querySelector("input"), tm = root.querySelector(".cvp-time"), fs = root.querySelector(".cvp-fs");
    var P = { t: o.start || 0, playing: false, raf: 0, t0: 0, s0: 0, dead: false, idle: 0, started: !!o.start };
    function size() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(320, Math.min(1920, Math.round((r.width || 640) * dpr)));
      if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * 9 / 16); draw(); }
    }
    function draw() { v.render(g, !P.started && P.t === 0 ? (o.poster != null ? o.poster : 3.2) : P.t, cv.width, cv.height); // antes do 1º play: quadro de capa (logo e nome já na tela)
      rg.value = Math.round(P.t * 10); tm.textContent = mmss(P.t) + " / " + mmss(v.duration); }
    function ui() { var end = P.t >= v.duration - 0.05; pp.innerHTML = P.playing ? SVG.pause : end ? SVG.replay : SVG.play; pp.setAttribute("aria-label", P.playing ? L.pause : L.play); big.hidden = P.playing || (P.started && !end); } // botão grande só antes do 1º play e no fim (pausado no meio não cobre o texto)
    function frame(now) {
      if (P.dead || !P.playing) return;
      P.t = P.s0 + (now - P.t0) / 1000;
      if (P.t >= v.duration) { if (o.loop) { P.s0 = 0; P.t0 = now; P.t = 0; } else { P.t = v.duration; P.playing = false; ui(); } }
      draw(); if (P.playing) P.raf = requestAnimationFrame(frame);
    }
    function play() { if (P.playing) return; P.started = true; if (P.t >= v.duration - 0.05) P.t = 0; P.playing = true; P.s0 = P.t; P.t0 = performance.now(); ui(); poke(); P.raf = requestAnimationFrame(frame); }
    function pause() { P.playing = false; cancelAnimationFrame(P.raf); ui(); root.classList.remove("idle"); }
    function seek(t) { P.started = true; P.t = Math.max(0, Math.min(v.duration, t)); P.s0 = P.t; P.t0 = performance.now(); draw(); ui(); }
    function toggle() { if (P.playing) pause(); else play(); }
    function poke() { root.classList.remove("idle"); clearTimeout(P.idle); if (P.playing) P.idle = setTimeout(function () { if (P.playing) root.classList.add("idle"); }, 2200); }
    cv.addEventListener("click", toggle); big.addEventListener("click", play); pp.addEventListener("click", toggle);
    rg.addEventListener("input", function () { seek(rg.value / 10); });
    root.addEventListener("pointermove", poke); root.addEventListener("keydown", function (e) { if (e.key === " " && e.target === cv) { e.preventDefault(); toggle(); } });
    fs.addEventListener("click", function () {
      var d = document, on = d.fullscreenElement || d.webkitFullscreenElement;
      if (on) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      else if (cv.webkitEnterFullscreen) cv.webkitEnterFullscreen();
    });
    var onFs = function () { var on = (document.fullscreenElement || document.webkitFullscreenElement) === root; root.classList.toggle("full", on || !!o.full); setTimeout(size, 60); };
    document.addEventListener("fullscreenchange", onFs); document.addEventListener("webkitfullscreenchange", onFs);
    var ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(cv); else window.addEventListener("resize", size);
    size(); draw(); ui();
    if (o.autoplay) play();
    var api = { play: play, pause: pause, seek: seek, toggle: toggle, video: v, el: root, get t() { return P.t; }, get playing() { return P.playing; },
      destroy: function () { P.dead = true; pause(); if (ro) ro.disconnect(); document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("webkitfullscreenchange", onFs); } };
    root._cvp = api;
    return api;
  }

  // ═══════════ exportar (MediaRecorder) ═══════════
  var MIMES = [["video/mp4;codecs=avc1.42E01E", "mp4"], ["video/mp4;codecs=avc1", "mp4"], ["video/mp4", "mp4"], ["video/webm;codecs=vp9", "webm"], ["video/webm;codecs=vp8", "webm"], ["video/webm", "webm"]];
  function exportMime() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    for (var i = 0; i < MIMES.length; i++) { try { if (MediaRecorder.isTypeSupported(MIMES[i][0])) return { mime: MIMES[i][0], ext: MIMES[i][1] }; } catch (e) {} }
    return null;
  }
  // grava em tempo real (a duração do vídeo); a tela continua respondendo (um quadro por requestAnimationFrame).
  // Se a aba for para segundo plano, a gravação pausa e continua do mesmo ponto quando voltar.
  function record(v, o) {
    o = o || {};
    var m = exportMime(); if (!m) return Promise.reject(new Error("NO_RECORDER"));
    var w = o.width || 1280, h = o.height || 720, fps = o.fps || 30;
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1";
    document.body.appendChild(cv);
    var g = cv.getContext("2d"); v.render(g, 0, w, h);
    var stream = cv.captureStream(fps), rec, chunks = [];
    try { rec = new MediaRecorder(stream, { mimeType: m.mime, videoBitsPerSecond: o.bitrate || 6e6 }); } catch (e) { cv.remove(); return Promise.reject(e); }
    return new Promise(function (resolve, reject) {
      var t = 0, last = 0, raf = 0, stopped = false, hidden = false;
      function cleanup() { stopped = true; cancelAnimationFrame(raf); clearTimeout(raf); document.removeEventListener("visibilitychange", vis); stream.getTracks().forEach(function (x) { x.stop(); }); cv.remove(); }
      function vis() { if (document.hidden && rec.state === "recording") { hidden = true; try { rec.pause(); } catch (e) {} } else if (!document.hidden && hidden) { hidden = false; last = performance.now(); try { rec.resume(); } catch (e) {} tick(last); } }
      function tick(now) {
        if (stopped || hidden) return;
        t += Math.min(0.1, (now - last) / 1000); last = now; // nunca pula mais de 0,1 s (se o aparelho engasgar, o vídeo fica um pouco mais longo, nunca corta texto)
        if (o.signal && o.signal.aborted) { cleanup(); try { rec.stop(); } catch (e) {} reject(new Error("ABORTED")); return; }
        if (t >= v.duration) { v.render(g, v.duration, w, h); if (o.onProgress) o.onProgress(1); setTimeout(function () { try { rec.stop(); } catch (e) {} }, 250); return; }
        v.render(g, t, w, h); if (o.onProgress) o.onProgress(t / v.duration);
        raf = requestAnimationFrame(tick);
      }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { cleanup(); reject(e.error || new Error("RECORDER")); };
      rec.onstop = function () { if (stopped && !chunks.length) return; cleanup(); resolve({ blob: new Blob(chunks, { type: m.mime.split(";")[0] }), mime: m.mime, ext: m.ext }); };
      document.addEventListener("visibilitychange", vis);
      rec.start(1000); last = performance.now(); raf = requestAnimationFrame(tick);
    });
  }

  // ═══════════ links e página do cliente ═══════════
  function link(o) {
    var base = location.origin + location.pathname.replace(/[^/]*$/, ""), q = new URLSearchParams();
    q.set("cv", o.demo ? "demo" : "1"); q.set("trade", o.trade || "electrical"); q.set("lang", o.lang || "en");
    if (!o.demo) { if (o.name) q.set("name", o.name); if (o.phone) q.set("phone", o.phone); if (o.site) q.set("site", o.site); if (/^#[0-9a-f]{6}$/i.test(o.accent || "")) q.set("color", o.accent.slice(1)); if (/^https:\/\//.test(o.logo || "")) q.set("logo", o.logo); }
    return base + "?" + q.toString();
  }
  var PRESET_TRADE = { eternity: "electrical", bluestar: "hvac" };
  // bloco "Veja como trabalhamos" na página de aceite (proposals.js → publicPage): toca o canvas ao vivo, sem arquivo hospedado
  function publicSection(p, c, before) {
    var cvo = p && p.video; if (!cvo || !cvo.on) return null;
    var lang = SC.UI[cvo.lang] ? cvo.lang : "en", brand = p.companyBrand || {};
    var box = document.getElementById("cv-public") || document.createElement("section");
    box.id = "cv-public"; box.className = "cv-public"; box.setAttribute("lang", { pt: "pt-BR", en: "en", es: "es" }[lang]);
    box.innerHTML = "<h2>" + SC.UI[lang].watch + '</h2><div class="cv-slot"></div>';
    if (!box.parentNode && before && before.parentNode) before.parentNode.insertBefore(box, before);
    css();
    prepare({ trade: cvo.trade || brand.trade || PRESET_TRADE[p.companyId] || "electrical", lang: lang, name: c.brand || brand.name || "", logo: c.logo || c.logoSm || "", accent: c.accent && !c.neutral ? c.accent : "", phone: cvo.phone || brand.phone || "", site: cvo.site || "" })
      .then(function (v) { var pl = mount(box.querySelector(".cv-slot"), v, {}); if (/[?&]video=1/.test(location.search)) { box.scrollIntoView({ block: "start" }); pl.play(); } });
    return box;
  }

  window.BiseyVideo = { prepare: prepare, build: build, mount: mount, record: record, exportMime: exportMime, link: link, publicSection: publicSection, css: css, W: W, H: H, STEP: STEP, scripts: SC };

  // ═══════════ rota ?cv=… (página só com o vídeo) ═══════════
  var q = /[?&]cv=([\w-]+)/.exec(location.search);
  if (q) {
    var P = new URLSearchParams(location.search), demo = q[1] === "demo", app = document.getElementById("app");
    document.title = "Video";
    if (app) app.style.display = "none";
    var page = document.createElement("div"); page.className = "cv-page"; document.body.appendChild(page); css();
    var lang = P.get("lang") || (window.NV && window.NV.lang) || "en", color = P.get("color");
    prepare({ demo: demo, trade: P.get("trade") || "electrical", lang: lang, name: P.get("name") || "", phone: P.get("phone") != null ? P.get("phone") : undefined, site: P.get("site") != null ? P.get("site") : undefined,
      logo: /^https:\/\//.test(P.get("logo") || "") ? P.get("logo") : "", accent: color && /^[0-9a-f]{6}$/i.test(color) ? "#" + color : "" })
      .then(function (v) { document.title = v.name + " — " + v.ui.tagline; window.__cv = mount(page, v, { full: true, autoplay: P.get("autoplay") === "1", controls: P.get("controls") !== "0" }); });
  }
})();
