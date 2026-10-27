// Nivela Assist — tickets (pedidos para uma pessoa) e leads (teste guiado).
import { store, bump } from "./store.mjs";
import { newId, day, clip } from "./util.mjs";
import { loadConv, saveConv, newConv, summarize, transcript } from "./brain.mjs";

export const SLA = {
  pt: "Pronto. Uma pessoa da equipe responde por e-mail em até 1 dia útil (seg–sex), em {email}. Você não precisa repetir nada: a conversa vai junto.",
  en: "Done. A person on the team will reply by email within 1 business day (Mon–Fri), at {email}. No need to repeat anything: the conversation goes along.",
  es: "Listo. Una persona del equipo responde por e-mail en hasta 1 día hábil (lun–vie), a {email}. No necesitas repetir nada: la conversación va junto."
};
export const LEAD_OK = {
  pt: "Combinado! Vamos te mandar um teste guiado em {email} em até 1 dia útil (seg–sex).",
  en: "Great! We'll send you a guided trial at {email} within 1 business day (Mon–Fri).",
  es: "¡Listo! Te enviaremos una prueba guiada a {email} en hasta 1 día hábil (lun–vie)."
};

// cria (ou atualiza o ticket aberto da mesma conversa — um por conversa)
export async function openTicket(o) {
  const s = await store();
  let conv = (await loadConv(o.sessionId)) || newConv(o.sessionId, o.channel, o.context, o.contact);
  if (o.contact && o.contact.email) conv.contact = Object.assign({}, conv.contact || {}, o.contact);
  if (o.context && Object.keys(o.context).length && !Object.keys(conv.context || {}).length) conv.context = o.context;
  let t = conv.ticketId ? await s.get("ticket/" + conv.ticketId) : null;
  const isNew = !t || t.status !== "open" || (o.kind || "support") !== t.kind;
  const hadEmail = !!(t && t.contact && t.contact.email);
  const sum = o.summary || (await summarize(conv, o.note));
  if (isNew) t = { id: newId("t"), kind: o.kind || "support", status: "open", createdAt: new Date().toISOString(), sessionId: conv.id, channel: o.channel || conv.channel };
  Object.assign(t, {
    updatedAt: new Date().toISOString(),
    contact: conv.contact || o.contact || null,
    lang: o.lang || conv.lang || "pt",
    reason: o.reason || t.reason || "user_request",
    note: o.note ? clip(o.note, 1000) : t.note || "",
    context: conv.context || {},
    summary: sum.summary, question: sum.question, tried: sum.tried, category: sum.category, priority: sum.priority, summaryByAI: !!sum.ai,
    lead: o.lead || t.lead || null,
    transcript: clip(transcript(conv, 40), 20000)
  });
  if (o.notified) t.notifiedAt = t.notifiedAt || new Date().toISOString();
  else if (!isNew && !hadEmail && t.contact && t.contact.email) t.notifiedAt = null; // o e-mail do cliente chegou depois: avisa o dono de novo, agora com como responder
  await s.set("ticket/" + t.id, t);
  conv.ticketId = t.id; await saveConv(conv);
  if (isNew) await bump("metrics/" + day(), t.kind === "lead" ? { leads: 1 } : { handoffs: 1 });
  if (t.kind === "lead") await s.set("lead/" + t.id, { id: t.id, at: t.createdAt, sessionId: conv.id, lead: t.lead, contact: t.contact, lang: t.lang });
  return t;
}

export async function listTickets(filter) {
  const s = await store(); const keys = await s.list("ticket/"); const out = [];
  for (const k of keys) {
    const t = await s.get(k); if (!t) continue;
    if (filter.status && filter.status !== "all" && t.status !== filter.status) continue;
    if (filter.notified === "0" && t.notifiedAt) continue;
    if (filter.notified === "1" && !t.notifiedAt) continue;
    if (filter.kind && t.kind !== filter.kind) continue;
    out.push(filter.full ? t : Object.assign({}, t, { transcript: undefined }));
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function updateTickets(ids, patch) {
  const s = await store(); const done = [];
  for (const id of ids || []) {
    if (!/^[a-z0-9]{6,40}$/i.test(String(id))) continue;
    const t = await s.get("ticket/" + id); if (!t) continue;
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
    if (patch.status === "answered" && !t.answeredAt) { t.answeredAt = t.updatedAt; await bump("metrics/" + day(), { answered: 1 }); }
    await s.set("ticket/" + id, t); done.push(id);
  }
  return done;
}
