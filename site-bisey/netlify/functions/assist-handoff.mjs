// POST /api/assist/handoff — o cliente pede uma pessoa (ou, no site, um teste guiado).
// { sessionId, channel, lang, contact: { email, name }, context?, note?, kind?: "support"|"lead", lead?: { name, company, trade, teamSize, state } }
// Cria o ticket com o resumo da conversa feito pela IA — o dono nunca precisa pedir para o cliente repetir.
import { json, preflight, readJSON, clientIp, hash, safeId, newId, cleanEmail, clip } from "../lib/util.mjs";
import { limit, windows } from "../lib/brain.mjs";
import { openTicket, SLA, LEAD_OK } from "../lib/tickets.mjs";

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "METHOD" }, 405);
  let b; try { b = await readJSON(req, 16000); } catch (e) { return json(req, { error: e.message }, e.status || 400); }
  const lang = ["pt", "en", "es"].includes(b.lang) ? b.lang : "en";
  const channel = ["site", "app"].includes(b.channel) ? b.channel : "site";
  const email = cleanEmail(b.contact && b.contact.email);
  if (b.contact && b.contact.website) return json(req, { ok: true, ticketId: "x" }); // honeypot: robô preencheu o campo escondido
  if (!email) return json(req, { error: "EMAIL", message: lang === "pt" ? "Confira o e-mail." : lang === "es" ? "Revisa el e-mail." : "Please check the email." }, 400);
  const w = windows();
  if (!(await limit("ho-ip", hash(clientIp(req, context)), 10, w.day)) || !(await limit("ho-em", hash(email), 5, w.day)))
    return json(req, { error: "RATE_LIMIT", message: lang === "pt" ? "Já recebemos seus pedidos de hoje. Responderemos por e-mail." : lang === "es" ? "Ya recibimos tus pedidos de hoy. Responderemos por e-mail." : "We already have your requests for today. We'll reply by email." }, 429);
  const kind = b.kind === "lead" ? "lead" : "support";
  let lead = null;
  if (kind === "lead" && b.lead && typeof b.lead === "object") { lead = {}; ["name", "company", "trade", "teamSize", "state"].forEach((k) => { if (b.lead[k]) lead[k] = clip(String(b.lead[k]), 100); }); }
  const sessionId = safeId(b.sessionId) || newId("s");
  try {
    const t = await openTicket({ sessionId, channel, kind, lang, contact: { email, name: clip((b.contact && b.contact.name) || (lead && lead.name) || "", 80) }, context: b.context || {}, note: b.note, lead, reason: kind === "lead" ? "lead" : "user_request" });
    return json(req, { ok: true, ticketId: t.id, sessionId, message: (kind === "lead" ? LEAD_OK : SLA)[lang].replace("{email}", email) });
  } catch (e) {
    console.error("handoff error", e);
    return json(req, { error: "SERVER", message: lang === "pt" ? "Não consegui registrar agora. Escreva para hello@getbisey.com." : lang === "es" ? "No pude registrarlo ahora. Escribe a hello@getbisey.com." : "I couldn't save this right now. Please write to hello@getbisey.com." }, 500);
  }
};

export const config = { path: "/api/assist/handoff" };
