// POST /api/suggest — "Falta alguma coisa que você faz? Sugira": a IA classifica e normaliza a sugestão da empresa.
// Entrada: { accountId, companyId, user: { id, name, role, email? }, trade, lang, type: task|material|service|other, text, example?, groups?: [grupos PT do ramo], demo? }
// Saída:   { ok, id, status: "added" | "ticket" | "rejected" | "queued", kind, entries: [{ type, group:{pt,en,es}, label:{pt,en,es} }], message, ticketId? }
//   added   → tarefa / material / item de serviço do ramo: o app põe as entradas no catálogo da empresa na hora (data.js → addCatalog)
//   ticket  → pedido de funcionalidade ou algo maior: vira ticket para a equipe do Bisey (tickets.mjs, kind "suggestion")
//   rejected→ inseguro / fora do assunto / tentativa de prompt injection (guardrails) — nada é gravado no catálogo
//   queued  → IA sem chave ou no limite de gasto do dia: fica guardada (sugq/) e o app mantém o item como "pendente de revisão"
// POST /api/suggest/tasks — "Refinar com IA" das tarefas geradas pela proposta: { trade, lang, lines[], current[], groups{} } → { ok, tasks[] }
// Limites: SUGGEST_MAX_CHARS (300) por campo; SUGGEST_RL_IP_HOUR (20), SUGGEST_RL_ACCOUNT_DAY (40), SUGGEST_RL_REFINE_HOUR (10).
import { json, preflight, readJSON, clientIp, hash, env, newId, clip } from "../lib/util.mjs";
import { callModel, MODEL_FAST, aiConfigured, overBudget, limit, windows } from "../lib/brain.mjs";
import { detectInjection } from "../lib/guardrails.mjs";
import { openTicket } from "../lib/tickets.mjs";
import { bump } from "../lib/store.mjs";
import { parseRequest, systemPrompt, userPrompt, TOOL, validateOutput, decide, record, msg, parseRefine, refinePrompt, REFINE_TOOL, validateRefine } from "../lib/suggest.mjs";

async function refine(req, b, ip, w) {
  if (!(await limit("sg-ref", ip, parseInt(env("SUGGEST_RL_REFINE_HOUR", "10"), 10), w.hour))) return json(req, { ok: false, error: "RATE_LIMIT" }, 429);
  const r = parseRefine(b); if (r.error) return json(req, { ok: false, error: r.error }, r.status);
  if (!aiConfigured() || (await overBudget())) return json(req, { ok: false, error: "AI_UNAVAILABLE" }, 503);
  const p = refinePrompt(r);
  try {
    const out = await callModel({ model: MODEL_FAST(), system: p.system, messages: [{ role: "user", content: p.user }], tools: [REFINE_TOOL], toolName: REFINE_TOOL.name, maxTokens: 1200 });
    return json(req, { ok: true, tasks: validateRefine(out.input, r) });
  } catch (e) { console.error("suggest refine", e.message); return json(req, { ok: false, error: "AI_ERROR" }, 502); }
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "METHOD" }, 405);
  let b; try { b = await readJSON(req, 16000); } catch (e) { return json(req, { error: e.message }, e.status || 400); }
  const ip = hash(clientIp(req, context)), w = windows();
  if (/\/api\/suggest\/tasks\/?$/.test(new URL(req.url).pathname)) return refine(req, b, ip, w);

  const r = parseRequest(b);
  if (r.error) return json(req, { ok: false, error: r.error, max: r.max }, r.status);
  if (!(await limit("sg-ip", ip, parseInt(env("SUGGEST_RL_IP_HOUR", "20"), 10), w.hour)) || !(await limit("sg-acc", hash(r.accountId), parseInt(env("SUGGEST_RL_ACCOUNT_DAY", "40"), 10), w.day)))
    return json(req, { ok: false, error: "RATE_LIMIT" }, 429);

  const rec = { id: newId("sg"), at: new Date().toISOString(), accountId: r.accountId, companyId: r.companyId, user: { id: r.user.id, name: r.user.name, role: r.user.role }, trade: r.trade, lang: r.lang, type: r.type, text: r.text, example: r.example, demo: r.demo, entries: [] };
  // prompt injection no texto: é dado, não instrução — nem chega à IA
  if (detectInjection(r.text) || detectInjection(r.example)) {
    Object.assign(rec, { status: "rejected", kind: "unsafe", reason: "injection" }); await record(rec); await bump("metrics/" + w.day, { suggestions: 1, injections: 1 });
    return json(req, { ok: true, id: rec.id, status: "rejected", kind: "unsafe", entries: [], message: msg("rejected", r.lang) });
  }
  if (!aiConfigured() || (await overBudget())) {
    Object.assign(rec, { status: "queued", reason: aiConfigured() ? "budget" : "not_configured" }); await record(rec); await bump("metrics/" + w.day, { suggestions: 1 });
    return json(req, { ok: true, id: rec.id, status: "queued", entries: [], message: msg("queued", r.lang) });
  }
  let v;
  try {
    const out = await callModel({ model: MODEL_FAST(), system: systemPrompt(), messages: [{ role: "user", content: userPrompt(r) }], tools: [TOOL], toolName: TOOL.name, maxTokens: 700 });
    v = validateOutput(out.input, r); rec.provider = out.provider;
  } catch (e) {
    console.error("suggest ai", e.message);
    Object.assign(rec, { status: "queued", reason: "ai_error" }); await record(rec);
    return json(req, { ok: true, id: rec.id, status: "queued", entries: [], message: msg("queued", r.lang) });
  }
  const status = decide(v);
  Object.assign(rec, { status, kind: v.kind || "", summary: v.summary || "", entries: status === "added" ? v.entries : [] });
  if (status === "ticket") {
    try {
      const t = await openTicket({ sessionId: newId("sgs"), channel: "app", kind: "suggestion", reason: "suggestion", lang: r.lang, note: r.text + (r.example ? "\n\nExemplo: " + r.example : ""),
        contact: r.user.email ? { email: r.user.email, name: r.user.name } : null, context: { appView: "suggestion", role: r.user.role, trade: r.trade, demo: r.demo, accountId: r.accountId, companyId: r.companyId },
        summary: { summary: "Sugestão (" + (v.kind || "outro") + "): " + clip(v.summary || r.text, 300), question: clip(r.text, 300), tried: "", category: "sugestao", priority: "normal" } });
      rec.ticketId = t.id;
    } catch (e) { console.error("suggest ticket", e.message); }
  }
  await record(rec);
  await bump("metrics/" + w.day, { suggestions: 1 });
  const names = rec.entries.map((e) => e.label[r.lang] || e.label.en).join(", ");
  return json(req, { ok: true, id: rec.id, status, kind: rec.kind, entries: rec.entries, ticketId: rec.ticketId, message: msg(status, r.lang, names) });
};

export const config = { path: ["/api/suggest", "/api/suggest/tasks"] };
