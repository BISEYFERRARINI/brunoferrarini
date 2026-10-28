// /api/assist/admin/* — painel do dono e Apps Script. Exige o header x-support-secret = SUPPORT_SECRET.
//   GET  tickets?status=open|answered|all&notified=0|1&kind=support|lead&full=1
//   POST tickets/answered { ids: [...] }      POST tickets/notified { ids: [...] }     POST tickets/reopen { ids }
//   GET  conversation?id=<sessionId>
//   GET  gaps?days=14                          GET metrics?days=7
//   GET  leads?days=30                         GET weekly   (métricas + top perguntas sem resposta com rascunho de artigo)
//   GET  suggestions?days=30                   sugestões das empresas (/api/suggest) + candidatos ao catálogo global (mesmo item em várias contas)
import { json, preflight, readJSON, checkSecret, lastDays, safeId, day, env } from "../lib/util.mjs";
import { store } from "../lib/store.mjs";
import { listTickets, updateTickets } from "../lib/tickets.mjs";
import { loadConv, draftArticles, budgetUsd, normQuestion } from "../lib/brain.mjs";
import { listSuggestions, listCandidates } from "../lib/suggest.mjs";

async function metrics(days) {
  const s = await store(); const ds = lastDays(Math.min(Math.max(days || 7, 1), 90));
  const per = []; const tot = {};
  for (const d of ds) { const m = (await s.get("metrics/" + d)) || {}; delete m.updatedAt; per.push(Object.assign({ day: d }, m)); Object.keys(m).forEach((k) => { tot[k] = (tot[k] || 0) + (m[k] || 0); }); }
  const conv = tot.conversations || 0, ho = tot.handoffs || 0;
  const open = (await listTickets({ status: "open" })).filter((t) => t.kind === "support").length;
  return {
    days: ds.length, from: ds[ds.length - 1], to: ds[0], totals: tot,
    conversations: conv, messages: tot.messages || 0, handoffs: ho, leads: tot.leads || 0,
    resolvedWithoutHumanPct: conv ? Math.round(Math.max(0, conv - ho) / conv * 1000) / 10 : null,
    thumbsUp: tot.up || 0, thumbsDown: tot.down || 0,
    costUsd: Math.round((tot.costUsd || 0) * 10000) / 10000, todaySpendUsd: Math.round((((await s.get("spend/" + day())) || {}).usd || 0) * 10000) / 10000, dailyBudgetUsd: budgetUsd(),
    // IA de reserva: quantas respostas vieram de cada provedor e quantas vezes a OpenAI salvou (Anthropic fora/lenta/sem saldo)
    byProvider: { anthropic: tot.ai_anthropic || 0, openai: tot.ai_openai || 0 }, fallbacks: tot.fallbacks || 0,
    openTickets: open, perDay: per
  };
}
async function gaps(days) {
  const s = await store(); const groups = {};
  for (const d of lastDays(Math.min(Math.max(days || 14, 1), 90))) {
    for (const k of await s.list("gap/" + d + "/")) {
      const g = await s.get(k); if (!g) continue;
      const key = g.key || normQuestion(g.question);
      const x = groups[key] || (groups[key] = { question: g.question, count: 0, langs: {}, reasons: {}, channels: {}, last: g.at, sessionIds: [] });
      x.count++; x.langs[g.lang] = 1; x.reasons[g.reason] = (x.reasons[g.reason] || 0) + 1; x.channels[g.channel] = 1;
      if (g.at > x.last) x.last = g.at; if (x.sessionIds.length < 5) x.sessionIds.push(g.sessionId);
    }
  }
  return Object.values(groups).map((x) => Object.assign(x, { langs: Object.keys(x.langs), channels: Object.keys(x.channels) })).sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last))).slice(0, 100);
}
async function cleanup() {
  const s = await store(); const keep = lastDays(2); let n = 0;
  // limites antigos (rl/*) não servem depois de 2 dias
  for (const k of await s.list("rl/")) { const w = k.split("/").pop(); if (!keep.some((d) => w.startsWith(d))) { await s.del(k); n++; } }
  // privacidade: conversas, tickets respondidos, 👍/👎 e perguntas com mais de ASSIST_RETENTION_DAYS (padrão 365) são apagados
  const days = parseInt(env("ASSIST_RETENTION_DAYS", "365"), 10) || 365, limit = new Date(Date.now() - days * 864e5).toISOString();
  for (const pre of ["fb/", "gap/", "metrics/", "spend/", "sug/"]) for (const k of await s.list(pre)) { const d = k.slice(pre.length, pre.length + 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < limit.slice(0, 10)) { await s.del(k); n++; } }
  for (const k of await s.list("conv/")) { const c = await s.get(k); if (c && (c.updatedAt || c.createdAt || "") < limit) { await s.del(k); n++; } }
  for (const pre of ["ticket/", "lead/"]) for (const k of await s.list(pre)) { const t = await s.get(k); if (t && (t.status !== "open" || pre === "lead/") && (t.updatedAt || t.at || t.createdAt || "") < limit) { await s.del(k); n++; } }
  return n;
}

export default async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  const auth = checkSecret(req);
  if (!auth.ok) return json(req, { error: auth.error }, auth.status);
  const url = new URL(req.url); const route = url.pathname.replace(/^.*\/api\/assist\/admin\/?/, "").replace(/\/+$/, "");
  const q = (k) => url.searchParams.get(k);
  try {
    if (req.method === "GET" && route === "tickets") return json(req, { tickets: await listTickets({ status: q("status") || "open", notified: q("notified"), kind: q("kind"), full: q("full") === "1" }) });
    if (req.method === "POST" && /^tickets\/(answered|notified|reopen)$/.test(route)) {
      const b = await readJSON(req, 20000); const ids = Array.isArray(b.ids) ? b.ids : b.id ? [b.id] : [];
      const now = new Date().toISOString(), act = route.split("/")[1];
      const patch = act === "answered" ? { status: "answered" } : act === "notified" ? { notifiedAt: now } : { status: "open", answeredAt: null };
      return json(req, { ok: true, updated: await updateTickets(ids, patch) });
    }
    if (req.method === "GET" && route === "conversation") { const id = safeId(q("id")); const c = id ? await loadConv(id) : null; return c ? json(req, { conversation: c }) : json(req, { error: "NOT_FOUND" }, 404); }
    if (req.method === "GET" && route === "gaps") return json(req, { gaps: await gaps(parseInt(q("days") || "14", 10)) });
    if (req.method === "GET" && route === "metrics") return json(req, await metrics(parseInt(q("days") || "7", 10)));
    if (req.method === "GET" && route === "suggestions") return json(req, { suggestions: (await listSuggestions(parseInt(q("days") || "30", 10))).slice(0, 300), candidates: await listCandidates(parseInt(q("min") || "2", 10)) });
    if (req.method === "GET" && route === "leads") return json(req, { leads: (await listTickets({ status: "all", kind: "lead" })).slice(0, 200) });
    if (req.method === "GET" && route === "weekly") {
      const m = await metrics(7); const g = (await gaps(7)).slice(0, 10);
      const drafts = q("drafts") === "0" ? [] : await draftArticles(g.slice(0, 5));
      const removed = await cleanup();
      return json(req, { metrics: m, gaps: g, drafts, cleaned: removed });
    }
    return json(req, { error: "NOT_FOUND" }, 404);
  } catch (e) {
    console.error("admin error", e);
    return json(req, { error: e.message || "SERVER" }, e.status || 500);
  }
};

export const config = { path: ["/api/assist/admin", "/api/assist/admin/*"] };
