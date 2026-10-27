// Gera os PNGs da marca a partir dos SVGs (rode depois de gerar-marca.py).
//   node brand/gerar-pngs.js
// Precisa de `sharp` (npm i sharp). Saída em brand/.
const path = require("path");
const sharp = require("sharp");
const B = __dirname;
const f = (n) => path.join(B, n);

const jobs = [
  // ícone "any": quadrado com cantos arredondados (fica bonito na aba e no instalador do Chrome)
  ["mark.svg", "icon-192.png", 192],
  ["mark.svg", "icon-512.png", 512],
  // maskable: fundo cheio, símbolo dentro do círculo seguro de 80% (Android corta em círculo/gota)
  ["_src/icon-maskable.svg", "icon-maskable-512.png", 512],
  // iOS arredonda sozinho → fundo cheio, sem transparência
  ["_src/icon-full.svg", "apple-touch-icon-180.png", 180],
  // favicon: traço mais grosso para ler em 16/32px
  ["_src/favicon.svg", "favicon-32.png", 32],
  ["_src/favicon.svg", "favicon-16.png", 16],
  // logo horizontal em PNG (e-mail, PDF de proposta, loja de apps)
  ["logo-claro.svg", "logo-claro@2x.png", null, 96],
  ["logo-escuro.svg", "logo-escuro@2x.png", null, 96],
];

(async () => {
  for (const [src, out, w, h] of jobs) {
    const img = sharp(f(src), { density: 600 });
    let pipe = w ? img.resize(w, w) : img.resize({ height: h });
    if (out.startsWith("apple")) pipe = pipe.flatten({ background: "#0B7B6A" }); // iOS não aceita transparência
    await pipe.png().toFile(f(out));
    console.log("ok", out);
  }
})();
