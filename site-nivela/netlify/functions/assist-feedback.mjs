// POST /api/assist/feedback — 👍/👎 em uma resposta. { sessionId, messageId, value: "up"|"down", comment? }
import { json, preflight, readJSON, clientIp, hash, safeId, newId, day, clip } from "../lib/util.mjs";
import { loadConv, saveConv, recordGap, limit, windows } from "../lib/brain.mjs";
import { store, bump } from "../lib/store.mjs";

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "METHOD" }, 405);
  let b; try { b = await readJSON(req, 8000); } catch (e) { return json(req, { error: e.message }, e.status || 400); }
  const sessionId = safeId(b.sessionId), messageId = safeId(b.messageId), value = b.value === "up" ? "up" : b.value === "down" ? "down" : null;
  if (!sessionId || !messageId || !value) return json(req, { error: "BAD_REQUEST" }, 400);
  if (!(await limit("fb-h", hash(clientIp(req, context)), 60, windows().hour))) return json(req, { error: "RATE_LIMIT" }, 429);
  const conv = await loadConv(sessionId);
  const i = conv ? conv.messages.findIndex((m) => m.id === messageId && m.role === "assistant") : -1;
  if (i < 0) return json(req, { error: "NOT_FOUND" }, 404);
  const msg = conv.messages[i], before = msg.rating;
  msg.rating = value; if (b.comment) msg.comment = clip(b.comment, 500);
  await saveConv(conv);
  const s = await store(); const id = newId("f");
  await s.set("fb/" + day() + "/" + id, { id, at: new Date().toISOString(), sessionId, messageId, value, comment: clip(b.comment || "", 500), channel: conv.channel, articleIds: msg.articleIds || [] });
  if (before !== value) {
    const inc = { [value]: 1 }; if (before) inc[before] = -1;
    await bump("metrics/" + day(), inc);
  }
  if (value === "down" && before !== "down") {
    const q = [...conv.messages.slice(0, i)].reverse().find((m) => m.role === "user");
    if (q) await recordGap({ question: q.text, lang: conv.lang, channel: conv.channel, reason: "thumbs_down", reply: msg.text, sessionId });
  }
  return json(req, { ok: true });
};

export const config = { path: "/api/assist/feedback" };
