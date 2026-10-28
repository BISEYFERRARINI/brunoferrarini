// Bisey Assist — utilidades comuns das funções (variáveis de ambiente, respostas JSON, segredo, datas, ids).
import crypto from "node:crypto";

export function env(name, def) {
  let v;
  try { if (globalThis.Netlify && globalThis.Netlify.env) v = globalThis.Netlify.env.get(name); } catch (e) { /* fora do Netlify */ }
  if (v == null || v === "") v = process.env[name];
  return v == null || v === "" ? def : v;
}

const ALLOWED_ORIGINS = /^https:\/\/([a-z0-9-]+\.)*getbisey\.com$|^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
export function cors(req) {
  const o = req.headers.get("origin") || "";
  const h = { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, x-support-secret", "Vary": "Origin" };
  if (ALLOWED_ORIGINS.test(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
export function json(req, data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }, cors(req), extra) });
}
export function preflight(req) { return new Response(null, { status: 204, headers: cors(req) }); }

// segredo do suporte (header x-support-secret) — comparação em tempo constante; sem segredo configurado, nada abre
export function checkSecret(req) {
  const want = env("SUPPORT_SECRET", "");
  if (!want || want.length < 16) return { ok: false, status: 503, error: "SUPPORT_SECRET_NOT_CONFIGURED" };
  const got = req.headers.get("x-support-secret") || "";
  const a = crypto.createHash("sha256").update(got).digest(), b = crypto.createHash("sha256").update(want).digest();
  if (!got || !crypto.timingSafeEqual(a, b)) return { ok: false, status: 401, error: "UNAUTHORIZED" };
  return { ok: true };
}

export async function readJSON(req, max = 64000) {
  const txt = await req.text();
  if (txt.length > max) { const e = new Error("TOO_LARGE"); e.status = 413; throw e; }
  try { return JSON.parse(txt || "{}"); } catch (e) { const x = new Error("BAD_JSON"); x.status = 400; throw x; }
}

export function clientIp(req, context) {
  return (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
}
export function hash(s) { return crypto.createHash("sha256").update(String(s) + "|" + env("SUPPORT_SECRET", "bisey")).digest("hex").slice(0, 20); }
export function newId(prefix) { return (prefix || "") + Date.now().toString(36) + crypto.randomBytes(5).toString("hex"); }
export function day(d) { return (d || new Date()).toISOString().slice(0, 10); }
export function hour(d) { return (d || new Date()).toISOString().slice(0, 13); }
export function lastDays(n) { const out = []; for (let i = 0; i < n; i++) out.push(day(new Date(Date.now() - i * 864e5))); return out; }

export const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export function cleanEmail(e) { e = String(e || "").trim().toLowerCase(); return EMAIL_RE.test(e) ? e : ""; }
export function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; }
export function safeId(s) { return /^[a-zA-Z0-9:_-]{6,120}$/.test(String(s || "")) ? String(s) : ""; }
