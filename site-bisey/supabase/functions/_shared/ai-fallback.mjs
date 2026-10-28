// IA com reserva automática — JS puro, sem dependências: roda no Supabase (Deno) e no Netlify (Node 18+,
// por netlify/lib/ai.mjs, que só reexporta este arquivo).
//
// Quem chama monta o pedido no formato da API de Mensagens da Anthropic (system, messages, tools, tool_choice)
// e recebe a resposta no mesmo formato (content[] com tool_use/text, usage, stop_reason), venha de quem vier.
//
//   1. Chama a Anthropic (ou a OpenAI primeiro, se AI_PRIMARY=openai).
//   2. Se falhar por rede, tempo esgotado, 408/429/5xx/529 (sobrecarga), 401/403 (chave errada) ou saldo esgotado,
//      tenta o outro provedor. Erro 400 de validação (pedido nosso malformado) NÃO cai na reserva: é registrado e devolvido.
//   3. Sem OPENAI_API_KEY nada muda: só a Anthropic, com o mesmo erro de sempre.
// A OpenAI é chamada pela Responses API (recomendada pela OpenAI para projetos novos), com store:false.
// Nos logs: provedor, modelo, status e tempo — nunca a chave nem o texto do cliente.

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const OPENAI_URL = "https://api.openai.com/v1/responses";

// Modelos da OpenAI (developers.openai.com/api/docs/pricing e páginas dos modelos, conferido em 27/10/2026).
//   smart: propostas, leitura de nota/recibo (imagem), lista de material, promoções — gpt-6.1-sol (texto+imagem, tools, structured outputs)
//   fast : assistente de suporte — gpt-6-luna (texto+imagem, tools, structured outputs, raciocínio "none" = rápido)
// Trocar sem mexer no código: OPENAI_MODEL_SMART / OPENAI_MODEL_FAST.
export const OPENAI_DEFAULT_MODELS = { smart: "gpt-6.1-sol", fast: "gpt-6-luna" };
// Esforço de raciocínio (reasoning.effort). gpt-6-luna aceita "none"; gpt-6.1-sol começa em "low".
export const OPENAI_DEFAULT_EFFORT = { smart: "low", fast: "none" };

// US$ por milhão de tokens, tier Standard (developers.openai.com/api/docs/pricing, 27/10/2026).
// in = entrada, cached = entrada em cache, out = saída (inclui tokens de raciocínio). OPENAI_PRICES (JSON) troca a tabela.
export const OPENAI_PRICES = {
  "gpt-6-astra": { in: 10, cached: 1, out: 50 },
  "gpt-6.1-sol": { in: 2, cached: 0.1, out: 10 },
  "gpt-6.1-terra": { in: 1, cached: 0.05, out: 5 },
  "gpt-6-luna": { in: 0.1, cached: 0.01, out: 0.5 },
};

export class AIError extends Error {
  constructor(message, fields) { super(message); this.name = "AIError"; Object.assign(this, fields || {}); }
}

function cleanKey(v) { return String(v == null ? "" : v).trim().replace(/^["']|["']$/g, ""); }
function getEnv(env, k) { try { const v = env ? env(k) : undefined; return v == null ? "" : String(v); } catch (_) { return ""; } }
function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; }

export function hasKey(env, provider) { return !!cleanKey(getEnv(env, provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY")); }
/** Alguma IA configurada (Anthropic ou OpenAI)? */
export function aiConfigured(env) { return hasKey(env, "anthropic") || hasKey(env, "openai"); }

export function openaiModel(env, tier) {
  return getEnv(env, tier === "fast" ? "OPENAI_MODEL_FAST" : "OPENAI_MODEL_SMART").trim() || OPENAI_DEFAULT_MODELS[tier === "fast" ? "fast" : "smart"];
}
export function openaiPrice(model, env) {
  let t = OPENAI_PRICES;
  const x = getEnv(env, "OPENAI_PRICES");
  if (x) { try { t = Object.assign({}, t, JSON.parse(x)); } catch (_) { /* tabela padrão */ } }
  if (t[model]) return t[model];
  const k = Object.keys(t).sort((a, b) => b.length - a.length).find((m) => String(model || "").startsWith(m)); // snapshot com data
  return k ? t[k] : t["gpt-6-astra"] || { in: 10, cached: 1, out: 50 }; // desconhecido: o mais caro (conservador)
}
/** Custo estimado em US$ de uma resposta da OpenAI já traduzida (usage no formato da Anthropic). */
export function openaiCost(model, usage, env) {
  const p = openaiPrice(model, env), u = usage || {};
  return ((u.input_tokens || 0) * p.in + (u.cache_read_input_tokens || 0) * p.cached + (u.output_tokens || 0) * p.out) / 1e6;
}

// ─── quando cair na reserva ───
export function shouldFallback(err) {
  if (!err || !(err instanceof AIError)) return false;
  if (err.code === "NO_API_KEY" || err.code === "TIMEOUT" || err.code === "NETWORK" || err.code === "BAD_RESPONSE") return true;
  if (err.code !== "API_ERROR") return false;
  const s = err.status;
  if (s === 401 || s === 403 || s === 408 || s === 429 || s === 529 || s >= 500) return true;
  // saldo/créditos esgotados vem como 400 na Anthropic ("credit balance is too low") — não é erro do nosso pedido
  if (s === 400 && /credit balance|billing|quota|insufficient/i.test(err.apiMessage || "")) return true;
  return false;
}
function reasonOf(err) {
  if (!err) return null;
  return err.provider + "_" + (err.code === "API_ERROR" ? err.status : String(err.code).toLowerCase());
}

async function timedFetch(fetchFn, url, init, ms, provider) {
  const ctl = new AbortController(); let timedOut = false;
  const tm = ms && ms > 0 ? setTimeout(() => { timedOut = true; ctl.abort(); }, ms) : null;
  try {
    const r = await fetchFn(url, Object.assign({}, init, { signal: ctl.signal }));
    const text = await r.text();
    return { r, text };
  } catch (e) {
    if (timedOut || (e && e.name === "AbortError")) throw new AIError(provider + " timeout after " + ms + " ms", { code: "TIMEOUT", provider });
    throw new AIError(provider + " network error", { code: "NETWORK", provider, cause: clip(e && e.message, 120) });
  } finally { if (tm) clearTimeout(tm); }
}
function apiError(provider, status, data) {
  const msg = clip((data && data.error && (data.error.message || data.error.type)) || "", 200);
  return new AIError(provider.toUpperCase() + "_" + status + (msg ? ": " + msg : ""), { code: "API_ERROR", provider, status, apiMessage: msg });
}
function parse(text) { try { return JSON.parse(text); } catch (_) { return null; } }

// ─── Anthropic ───
export async function callAnthropic(body, o) {
  const key = cleanKey(getEnv(o.env, "ANTHROPIC_API_KEY"));
  if (!key) throw new AIError("NO_API_KEY", { code: "NO_API_KEY", provider: "anthropic" });
  const { r, text } = await timedFetch(o.fetch, ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  }, o.timeoutMs, "anthropic");
  const data = parse(text);
  if (!r.ok) throw apiError("anthropic", r.status, data);
  if (!data || !Array.isArray(data.content)) throw new AIError("anthropic: bad response", { code: "BAD_RESPONSE", provider: "anthropic", status: r.status });
  return data;
}

// ─── tradução Anthropic → OpenAI (Responses API) ───
const STRICT_BLOCKERS = ["oneOf", "allOf", "not", "if", "then", "else", "patternProperties", "dependentSchemas", "dependentRequired", "$ref", "$defs", "definitions", "propertyNames"];

function nullable(s) {
  const c = Object.assign({}, s);
  if (Array.isArray(c.anyOf)) { if (!c.anyOf.some((x) => x && x.type === "null")) c.anyOf = c.anyOf.concat([{ type: "null" }]); return c; }
  if (c.type == null) return { anyOf: [s, { type: "null" }] };
  const types = Array.isArray(c.type) ? c.type.slice() : [c.type];
  if (types.indexOf("null") < 0) types.push("null");
  c.type = types;
  if (Array.isArray(c.enum) && c.enum.indexOf(null) < 0) c.enum = c.enum.concat([null]);
  return c;
}
/** JSON Schema da Anthropic → schema estrito da OpenAI (todas as chaves em required, additionalProperties:false,
 *  opcionais viram "ou null"). Devolve null se o schema não cabe no modo estrito (aí vai com strict:false). */
export function toStrictSchema(schema) {
  function walk(s) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    for (const k of STRICT_BLOCKERS) if (k in s) return null;
    const out = Object.assign({}, s);
    if (Array.isArray(s.anyOf)) { out.anyOf = []; for (const x of s.anyOf) { const w = walk(x); if (!w) return null; out.anyOf.push(w); } }
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (types.indexOf("object") >= 0) {
      if (!s.properties || typeof s.properties !== "object" || !Object.keys(s.properties).length) return null; // objeto livre: não dá estrito
      if (s.additionalProperties && s.additionalProperties !== false) return null;
      const req = Array.isArray(s.required) ? s.required : [];
      out.properties = {};
      for (const k of Object.keys(s.properties)) {
        const w = walk(s.properties[k]); if (!w) return null;
        out.properties[k] = req.indexOf(k) >= 0 ? w : nullable(w);
      }
      out.required = Object.keys(s.properties);
      out.additionalProperties = false;
    }
    if (types.indexOf("array") >= 0 && s.items) { const w = walk(s.items); if (!w) return null; out.items = w; }
    return out;
  }
  if (!schema || schema.type !== "object") return null;
  return walk(schema);
}
/** Tira os null que o modo estrito obrigou a mandar em campos que eram opcionais (o chamador recebe como antes: campo ausente). */
export function stripAddedNulls(value, schema) {
  if (!schema || typeof schema !== "object" || value == null) return value;
  if (Array.isArray(value)) return schema.items ? value.map((v) => stripAddedNulls(v, schema.items)) : value;
  if (typeof value === "object" && schema.properties) {
    const req = Array.isArray(schema.required) ? schema.required : [];
    const out = {};
    for (const k of Object.keys(value)) {
      if (value[k] === null && req.indexOf(k) < 0 && schema.properties[k]) continue;
      out[k] = schema.properties[k] ? stripAddedNulls(value[k], schema.properties[k]) : value[k];
    }
    return out;
  }
  return value;
}

function systemText(system) {
  if (!system) return "";
  if (typeof system === "string") return system;
  return (Array.isArray(system) ? system : []).map((b) => (b && b.type === "text" ? b.text : "")).filter(Boolean).join("\n\n"); // cache_control fica para trás
}
function imagePart(c) {
  const src = c.source || {};
  if (src.type === "base64") return { type: "input_image", image_url: "data:" + (src.media_type || "image/jpeg") + ";base64," + src.data, detail: "auto" };
  if (src.type === "url") return { type: "input_image", image_url: src.url, detail: "auto" };
  return null;
}
function docPart(c) {
  const src = c.source || {};
  if (src.type === "base64") return { type: "input_file", filename: (c.title || "document") + ".pdf", file_data: "data:" + (src.media_type || "application/pdf") + ";base64," + src.data };
  if (src.type === "url") return { type: "input_file", file_url: src.url };
  if (src.type === "text") return { type: "input_text", text: String(src.data || "") };
  return null;
}
function toolResultText(c) {
  if (typeof c.content === "string") return c.content;
  return (Array.isArray(c.content) ? c.content : []).map((x) => (x && x.type === "text" ? x.text : "")).join("\n");
}
function toInput(messages) {
  const input = [];
  for (const m of messages || []) {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") { input.push({ role, content: m.content }); continue; }
    let parts = [];
    const flush = () => {
      if (!parts.length) return;
      if (role === "assistant") input.push({ role, content: parts.map((p) => p.text || "").join("\n") });
      else input.push({ role, content: parts });
      parts = [];
    };
    for (const c of m.content || []) {
      if (!c) continue;
      if (c.type === "text") parts.push({ type: "input_text", text: c.text });
      else if (c.type === "image") { const p = imagePart(c); if (p) parts.push(p); }
      else if (c.type === "document") { const p = docPart(c); if (p) parts.push(p); }
      else if (c.type === "tool_use") { flush(); input.push({ type: "function_call", call_id: c.id, name: c.name, arguments: JSON.stringify(c.input || {}) }); }
      else if (c.type === "tool_result") { flush(); input.push({ type: "function_call_output", call_id: c.tool_use_id, output: toolResultText(c) }); }
      // thinking / outros blocos da Anthropic: ignorados
    }
    flush();
  }
  return input;
}
function toolChoice(tc) {
  if (!tc) return undefined;
  if (tc.type === "tool") return { type: "function", name: tc.name };
  if (tc.type === "any") return "required";
  if (tc.type === "none") return "none";
  return "auto";
}

/** Pedido no formato da Anthropic → corpo da Responses API da OpenAI. */
export function toOpenAIRequest(body, o) {
  o = o || {};
  const effort = o.effort || "none";
  const req = { model: o.model, input: toInput(body.messages), store: false };
  const sys = systemText(body.system);
  if (sys) req.instructions = sys;
  const tools = (body.tools || []).filter((t) => t && t.name && (t.input_schema || !t.type || t.type === "custom"));
  if (tools.length) {
    req.tools = tools.map((t) => {
      const strict = toStrictSchema(t.input_schema);
      return { type: "function", name: t.name, description: t.description || "", parameters: strict || t.input_schema || { type: "object", properties: {} }, strict: !!strict };
    });
    const tc = toolChoice(body.tool_choice); if (tc) req.tool_choice = tc;
    req.parallel_tool_calls = false;
  }
  // o raciocínio conta dentro de max_output_tokens: dá folga para não cortar a resposta
  if (body.max_tokens) req.max_output_tokens = body.max_tokens + (effort === "none" ? 0 : (o.reasoningExtra || 4000));
  req.reasoning = { effort };
  return req;
}

/** Resposta da Responses API → formato da API de Mensagens da Anthropic. */
export function fromOpenAIResponse(data, body, model) {
  const content = []; let called = false;
  for (const it of (data && data.output) || []) {
    if (it.type === "message") {
      for (const c of it.content || []) {
        if (c.type === "output_text" && c.text) content.push({ type: "text", text: c.text });
        else if (c.type === "refusal" && c.refusal) content.push({ type: "text", text: c.refusal });
      }
    } else if (it.type === "function_call") {
      const input = parse(it.arguments || "{}");
      if (input && typeof input === "object" && !Array.isArray(input)) {
        const tool = ((body && body.tools) || []).find((t) => t.name === it.name);
        content.push({ type: "tool_use", id: it.call_id || it.id, name: it.name, input: tool ? stripAddedNulls(input, tool.input_schema) : input });
        called = true;
      } else content.push({ type: "text", text: String(it.arguments || "") }); // JSON cortado: o chamador ainda tenta achar um objeto no texto
    }
  }
  const u = (data && data.usage) || {}, cached = (u.input_tokens_details && u.input_tokens_details.cached_tokens) || 0;
  const cut = data && data.status === "incomplete" && data.incomplete_details && data.incomplete_details.reason === "max_output_tokens";
  return {
    id: data && data.id, type: "message", role: "assistant", model: (data && data.model) || model, content,
    stop_reason: called ? "tool_use" : cut ? "max_tokens" : "end_turn",
    usage: { input_tokens: Math.max(0, (u.input_tokens || 0) - cached), output_tokens: u.output_tokens || 0, cache_creation_input_tokens: 0, cache_read_input_tokens: cached },
  };
}

export async function callOpenAI(body, o) {
  const key = cleanKey(getEnv(o.env, "OPENAI_API_KEY"));
  if (!key) throw new AIError("NO_API_KEY", { code: "NO_API_KEY", provider: "openai" });
  const tier = o.tier === "fast" ? "fast" : "smart";
  const model = openaiModel(o.env, tier);
  const effort = getEnv(o.env, tier === "fast" ? "OPENAI_REASONING_FAST" : "OPENAI_REASONING_SMART").trim() || OPENAI_DEFAULT_EFFORT[tier];
  const req = toOpenAIRequest(body, { model, effort });
  const t0 = Date.now();
  const send = () => timedFetch(o.fetch, OPENAI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify(req),
  }, o.timeoutMs ? Math.max(1000, o.timeoutMs - (Date.now() - t0)) : o.timeoutMs, "openai");
  let { r, text } = await send();
  let data = parse(text);
  // schema recusado no modo estrito: tenta uma vez sem strict (o JSON continua validado pelo chamador)
  if (r.status === 400 && (req.tools || []).some((t) => t.strict) && /schema|strict|additionalProperties|required/i.test(JSON.stringify((data && data.error) || ""))) {
    req.tools = req.tools.map((t) => Object.assign({}, t, { strict: false, parameters: ((body.tools || []).find((x) => x && x.name === t.name) || {}).input_schema || t.parameters }));
    ({ r, text } = await send()); data = parse(text);
  }
  if (!r.ok) throw apiError("openai", r.status, data);
  if (!data || !Array.isArray(data.output) || data.status === "failed") throw new AIError("openai: bad response", { code: "BAD_RESPONSE", provider: "openai", status: r.status });
  return { data: fromOpenAIResponse(data, body, model), model };
}

/**
 * Chama a IA com reserva. body = pedido no formato da Anthropic (model, max_tokens, system, messages, tools, tool_choice).
 * opts:
 *   env(k)             lê variável de ambiente (Deno.env.get / process.env)
 *   tier               "fast" | "smart" — qual modelo da OpenAI usar na reserva
 *   timeoutMs          tempo da 1ª tentativa quando há reserva
 *   fallbackTimeoutMs  tempo da reserva (padrão = timeoutMs)
 *   soloTimeoutMs      tempo quando NÃO há reserva (mantém o comportamento de antes; vazio = sem limite)
 *   totalMs            prazo total; a reserva só tenta se sobrar >= minFallbackMs (padrão 2000)
 *   fetch, log         para testes
 * Devolve { data (formato Anthropic), provider, model, fallback, fallbackReason, ms }.
 * Se tudo falhar, lança o erro da 1ª tentativa (com .fallbackError quando a reserva também falhou).
 */
export async function aiCall(body, opts) {
  const o = opts || {};
  const env = o.env;
  const fetchFn = o.fetch || ((u, i) => globalThis.fetch(u, i));
  const log = o.log || ((line) => console.log(line));
  const order = getEnv(env, "AI_PRIMARY").trim().toLowerCase() === "openai" ? ["openai", "anthropic"] : ["anthropic", "openai"];
  let chain = order.filter((p) => hasKey(env, p));
  if (!chain.length) chain = ["anthropic"]; // nada configurado: mesmo erro NO_API_KEY de antes
  const t0 = Date.now(); let firstErr = null;
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    let ms = chain.length === 1 ? o.soloTimeoutMs : i === 0 ? o.timeoutMs : (o.fallbackTimeoutMs || o.timeoutMs);
    if (i > 0 && o.totalMs) {
      const left = o.totalMs - (Date.now() - t0);
      if (left < (o.minFallbackMs || 2000)) { log("ai skip-fallback provider=" + p + " reason=no_time_left"); break; }
      ms = ms ? Math.min(ms, left) : left;
    }
    const ts = Date.now();
    try {
      let data, model;
      if (p === "anthropic") { data = await callAnthropic(body, { env, fetch: fetchFn, timeoutMs: ms }); model = body.model; }
      else { const x = await callOpenAI(body, { env, fetch: fetchFn, timeoutMs: ms, tier: o.tier }); data = x.data; model = x.model; }
      const fallback = p !== order[0];
      const reason = fallback ? (firstErr ? reasonOf(firstErr) : order[0] + "_no_key") : null;
      log("ai ok provider=" + p + " model=" + model + " fallback=" + (fallback ? 1 : 0) + (reason ? " reason=" + reason : "") + " ms=" + (Date.now() - ts));
      return { data, provider: p, model, fallback, fallbackReason: reason, ms: Date.now() - t0 };
    } catch (e) {
      if (!(e instanceof AIError)) throw e;
      log("ai fail provider=" + p + " code=" + e.code + (e.status ? " status=" + e.status : "") + " ms=" + (Date.now() - ts) +
        (e.code === "API_ERROR" && e.status === 400 ? " msg=" + JSON.stringify(clip(e.apiMessage, 160)) : ""));
      if (!firstErr) firstErr = e; else firstErr.fallbackError = e;
      if (!shouldFallback(e)) break; // 400 de validação etc.: erro nosso, não adianta outro provedor
    }
  }
  throw firstErr;
}
