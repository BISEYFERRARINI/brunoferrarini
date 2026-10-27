// POST /api/assist — chat do site e do app (o mesmo cérebro do e-mail).
// Entrada: { channel: "site"|"app", sessionId, lang?, messages: [{role, text}], context: { page, appView, role, trade, plan, demo, appLang }, contact? }
// Saída:   { sessionId, messageId, reply, lang, articleIds, confidence, handoff, handoffReason, suggestedActions, leadInfo? }
import { json, preflight, readJSON, clientIp, hash, env, safeId, newId, cleanEmail, clip, checkSecret } from "../lib/util.mjs";
import { answer, limit, windows } from "../lib/brain.mjs";
import { openTicket } from "../lib/tickets.mjs";
import { canned, detectLang } from "../lib/guardrails.mjs";
import { bump } from "../lib/store.mjs";

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "METHOD" }, 405);
  let b;
  try { b = await readJSON(req); } catch (e) { return json(req, { error: e.message }, e.status || 400); }
  const channel = b.channel === "app" ? "app" : b.channel === "site" ? "site" : null;
  if (!channel) return json(req, { error: "CHANNEL" }, 400); // o canal e-mail só entra por /api/assist/email (com segredo)
  const msgs = Array.isArray(b.messages) ? b.messages : [];
  const last = [...msgs].reverse().find((m) => m && m.role === "user" && typeof m.text === "string");
  const text = last ? String(last.text).trim() : String(b.text || "").trim();
  if (!text) return json(req, { error: "EMPTY" }, 400);
  const maxChars = parseInt(env("ASSIST_MAX_MESSAGE_CHARS", "2000"), 10);
  const sessionId = safeId(b.sessionId) || newId("s");
  const lang = ["pt", "en", "es"].includes(b.lang) ? b.lang : detectLang(text, "en");
  if (text.length > maxChars) return json(req, { sessionId, error: "TOO_LONG", reply: lang === "pt" ? "Mensagem muito longa. Resuma em até " + maxChars + " caracteres, por favor." : lang === "es" ? "Mensaje demasiado largo. Resume en hasta " + maxChars + " caracteres, por favor." : "Message too long. Please keep it under " + maxChars + " characters." }, 413);

  const ip = hash(clientIp(req, context)), w = windows();
  const trusted = !!req.headers.get("x-support-secret") && checkSecret(req).ok; // avaliação (tests/assist-eval.js) com o segredo: sem limite por IP
  const okH = trusted || await limit("ip-h", ip, parseInt(env("ASSIST_RL_IP_HOUR", "30"), 10), w.hour);
  const okD = trusted || (okH && (await limit("ip-d", ip, parseInt(env("ASSIST_RL_IP_DAY", "150"), 10), w.day)));
  const okS = trusted || (okD && (await limit("ses-d", sessionId.slice(0, 60), parseInt(env("ASSIST_RL_SESSION_DAY", "80"), 10), w.day)));
  if (!okS) { await bump("metrics/" + w.day, { rateLimited: 1 }); return json(req, { sessionId, error: "RATE_LIMIT", reply: canned("rate", lang), handoff: true, handoffReason: "rate_limit" }, 429); }

  const contact = b.contact && cleanEmail(b.contact.email) ? { email: cleanEmail(b.contact.email), name: clip(b.contact.name || "", 80) } : null;
  try {
    const r = await answer({ channel, sessionId, lang, text, context: b.context, contact, noMetrics: trusted && b.eval === true });
    // limite de gasto / IA indisponível: abre ticket com a conversa (o e-mail do cliente entra depois pelo /handoff)
    if (r.path === "budget" || r.path === "not_configured" || r.path === "error")
      await openTicket({ sessionId, channel, contact, lang: r.lang, reason: r.handoffReason, context: b.context, summary: { summary: "Assist sem IA (" + r.path + "). Pergunta: " + clip(text, 400), question: clip(text, 300), tried: "", category: "outro", priority: "normal" } });
    return json(req, { sessionId, messageId: r.messageId, reply: r.reply, lang: r.lang, articleIds: r.articleIds, confidence: r.confidence, handoff: r.handoff, handoffReason: r.handoffReason, suggestedActions: r.suggestedActions, leadInfo: r.leadInfo || undefined });
  } catch (e) {
    console.error("assist error", e);
    return json(req, { sessionId, error: "SERVER", reply: canned("unavailable", lang), handoff: true, handoffReason: "unavailable" }, 500);
  }
};

export const config = { path: "/api/assist" };
