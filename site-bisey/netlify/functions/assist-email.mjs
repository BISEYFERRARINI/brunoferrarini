// POST /api/assist/email — chamado pelo Google Apps Script (header x-support-secret).
// { from, name, subject, text, threadId, messageId, history?: [{ fromUs: bool, text, date }] }
// → { reply, lang, handoff, handoffReason, ticketId?, summary?, skip?, reason? }
// Mesmo cérebro do chat, canal "email": tom de e-mail e a assinatura de policies.md.
import { json, preflight, readJSON, checkSecret, cleanEmail, clip, hash, env } from "../lib/util.mjs";
import { answer, limit, windows } from "../lib/brain.mjs";
import { openTicket } from "../lib/tickets.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const auth = checkSecret(req);
  if (!auth.ok) return json(req, { error: auth.error }, auth.status);
  if (req.method !== "POST") return json(req, { error: "METHOD" }, 405);
  let b; try { b = await readJSON(req, 120000); } catch (e) { return json(req, { error: e.message }, e.status || 400); }
  const from = cleanEmail(b.from);
  if (!from) return json(req, { skip: true, reason: "bad_from" });
  if (/@(getbisey|getnivela)\.com$/i.test(from)) return json(req, { skip: true, reason: "own_domain" }); // anti-loop (o Apps Script também filtra); getnivela.com = domínio antigo (antes chamado Nivela), ainda pode ser apelido no Workspace
  const threadId = String(b.threadId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  if (!threadId) return json(req, { error: "THREAD" }, 400);
  const w = windows();
  if (!(await limit("em-d", hash(from), parseInt(env("ASSIST_RL_EMAIL_DAY", "5"), 10), w.day))) return json(req, { skip: true, reason: "rate_limit" });
  const subject = clip(String(b.subject || "").replace(/[\r\n]+/g, " "), 200);
  const body = clip(String(b.text || "").trim(), 6000);
  const text = (subject && !/^(re|fw|fwd|enc|res)\s*:/i.test(subject) ? "Assunto: " + subject + "\n\n" : "") + (body || subject);
  const history = Array.isArray(b.history) ? b.history.slice(-8).map((h) => ({ role: h.fromUs ? "assistant" : "user", text: clip(String(h.text || ""), 3000), ts: h.date || null })).filter((h) => h.text) : [];
  const sessionId = "email:" + threadId;
  const contact = { email: from, name: clip(b.name || "", 80) };
  try {
    const r = await answer({ channel: "email", sessionId, text, contact, history, context: {} });
    let ticket = null;
    if (r.handoff) ticket = await openTicket({ sessionId, channel: "email", contact, lang: r.lang, reason: r.handoffReason, notified: true }); // o Apps Script manda o resumo ao dono agora
    return json(req, { reply: r.reply, lang: r.lang, handoff: r.handoff, handoffReason: r.handoffReason, confidence: r.confidence, articleIds: r.articleIds,
      ticketId: ticket ? ticket.id : undefined, summary: ticket ? { summary: ticket.summary, question: ticket.question, tried: ticket.tried, category: ticket.category, priority: ticket.priority } : undefined });
  } catch (e) {
    console.error("email error", e);
    return json(req, { error: "SERVER" }, 500);
  }
};

export const config = { path: "/api/assist/email" };
