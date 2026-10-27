#!/usr/bin/env python3
"""
Gera a marca do produto (SVGs) a partir de UM lugar só.

Para trocar o nome do produto: mude NOME abaixo e rode
    python3 brand/gerar-marca.py && node brand/gerar-pngs.js
O nome é desenhado em curvas (Inter Display Bold) para o logo não depender
de fonte instalada. O símbolo não usa letra nenhuma, então continua valendo
com qualquer nome.
"""
import os, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

NOME = sys.argv[1] if len(sys.argv) > 1 else "Nivela"
FONTE = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
TRACKING = -0.025  # em

# cores da marca do produto (ver docs/02-design-system.md)
INK = "#0D2B27"        # verdigris noite (texto do logo / fundo escuro)
VERDE = "#0B7B6A"      # verdigris (cor da marca)
VERDE_CLARO = "#2CC4A7"  # verdigris para fundo escuro
COBRE = "#D9773A"      # cobre (porta / detalhe)
BRANCO = "#FFFFFF"

AQUI = os.path.dirname(os.path.abspath(__file__))


# ── símbolo escolhido: "Planta" ─────────────────────────────────────────
# Um cômodo visto de cima (planta baixa) com a porta abrindo: três paredes
# grossas + o arco da porta preenchido. Grade de 48; ocupa 6..42.
def planta(wall, door, sw=6.0):
    return (
        f'<path d="M18 39H9V9h30v30" fill="none" stroke="{wall}" stroke-width="{sw}" '
        f'stroke-linecap="square" stroke-linejoin="miter"/>'
        f'<path d="M18 42V18a21 21 0 0 1 21 21v3z" fill="{door}"/>'
    )


# ── conceitos alternativos (só para comparação) ───────────────────────
def linha_de_giz(a, b):
    # a linha de giz esticada entre dois pontos, subindo (prumo + crescimento)
    return (
        f'<path d="M9 39L39 9" stroke="{a}" stroke-width="6" stroke-linecap="round"/>'
        f'<circle cx="11" cy="37" r="6" fill="{b}"/><circle cx="37" cy="11" r="4" fill="{a}"/>'
        f'<path d="M6 42h36" stroke="{a}" stroke-width="3" stroke-linecap="round" opacity=".35"/>'
    )


def bolha(a, b):
    # o nível de bolha (ligado ao nome "Nivela"): tubo + bolha no centro entre as marcas
    return (
        f'<rect x="5" y="14" width="38" height="20" rx="10" fill="none" stroke="{a}" stroke-width="5"/>'
        f'<path d="M16 19v10M32 19v10" stroke="{a}" stroke-width="3" stroke-linecap="round"/>'
        f'<circle cx="24" cy="24" r="5" fill="{b}"/>'
    )


# ── texto em curvas ─────────────────────────────────────────────────────
_font = TTFont(FONTE)
_gs = _font.getGlyphSet()
_cmap = _font.getBestCmap()
UPM = _font["head"].unitsPerEm
CAP = _font["OS/2"].sCapHeight


def wordmark_path(text, cap_px):
    """devolve (d, largura) com o texto desenhado com altura de maiúscula = cap_px, baseline em y=0"""
    s = cap_px / CAP
    x = 0.0
    pen = SVGPathPen(_gs)
    for ch in text:
        g = _cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x, 0))
        _gs[g].draw(tp)
        x += _gs[g].width * s + TRACKING * UPM * s
    x -= TRACKING * UPM * s
    d = re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.2f}".rstrip("0").rstrip("."), pen.getCommands())
    return d, x


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def tile(sym, bg, size=48, r=11, scale=0.78):
    off = (48 - 48 * scale) / 2
    return (f'<rect width="{size}" height="{size}" rx="{r}" fill="{bg}"/>'
            f'<g transform="translate({off:g} {off:g}) scale({scale:g})">{sym}</g>')


def write(name, content):
    p = os.path.join(AQUI, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(content)
    print("ok", os.path.relpath(p, AQUI))


def lockup(sym_tile_body, text_color, h=48):
    """símbolo (48x48) + nome. Altura de maiúscula = 46% do símbolo."""
    cap = h * 0.46
    d, tw = wordmark_path(NOME, cap)
    gap = h * 0.30
    base = h / 2 + cap / 2
    w = h + gap + tw
    body = (f'<g>{sym_tile_body}</g>'
            f'<path transform="translate({h + gap:g} {base:g})" d="{d}" fill="{text_color}"/>')
    return svg(round(w, 2), h, body, NOME)


if __name__ == "__main__":
    # símbolo quadrado (ícone de app)
    write("mark.svg", svg(48, 48, tile(planta(BRANCO, COBRE), VERDE), NOME))
    write("mark-dark.svg", svg(48, 48, tile(planta(INK, VERDE), VERDE_CLARO), NOME))
    # símbolo solto (sem fundo) para fundo claro / escuro
    write("mark-solto-claro.svg", svg(48, 48, planta(INK, VERDE), NOME))
    write("mark-solto-escuro.svg", svg(48, 48, planta(BRANCO, VERDE_CLARO), NOME))
    # logo horizontal: símbolo + nome
    write("logo.svg", lockup(tile(planta(BRANCO, COBRE), VERDE), INK))
    write("logo-claro.svg", lockup(tile(planta(BRANCO, COBRE), VERDE), INK))
    write("logo-escuro.svg", lockup(tile(planta(INK, VERDE), VERDE_CLARO), BRANCO))
    write("logo-mono.svg", lockup(planta("currentColor", "currentColor"), "currentColor"))
    # fonte-mestre para PNGs com margem segura (maskable): símbolo dentro do círculo de 40%
    write("_src/icon-full.svg", svg(512, 512,
          f'<rect width="512" height="512" fill="{VERDE}"/>'
          f'<g transform="translate(96 96) scale(6.6667)">{planta(BRANCO, COBRE)}</g>', NOME))
    write("_src/icon-maskable.svg", svg(512, 512,
          f'<rect width="512" height="512" fill="{VERDE}"/>'
          f'<g transform="translate(112 112) scale(6)">{planta(BRANCO, COBRE)}</g>', NOME))
    write("_src/favicon.svg", svg(48, 48, tile(planta(BRANCO, COBRE, sw=7), VERDE, r=10, scale=0.84), NOME))

    # conceitos
    concepts = {
        "a-planta": planta,
        "b-linha-de-giz": linha_de_giz,
        "c-bolha": bolha,
    }
    for k, fn in concepts.items():
        write(f"conceitos/{k}.svg", lockup(tile(fn(BRANCO, COBRE), VERDE), INK))
        write(f"conceitos/{k}-escuro.svg", lockup(tile(fn(INK, VERDE), VERDE_CLARO), BRANCO))
        write(f"conceitos/{k}-solto.svg", svg(48, 48, fn(INK, VERDE), k))
