// Nivela Assist — armazenamento (Netlify Blobs). Nos testes, globalThis.__ASSIST_STORE__ troca por um armazenamento em memória.
// Chaves:
//   conv/{sessionId}                 conversa (mensagens, contexto, contato)
//   ticket/{id}                      pedido para uma pessoa (status open|answered; notifiedAt quando o dono já recebeu o e-mail)
//   lead/{id}                        pedido de teste guiado (site)
//   fb/{dia}/{id}                    👍/👎
//   gap/{dia}/{id}                   pergunta sem resposta / com 👎 (vira artigo)
//   metrics/{dia}                    contadores do dia
//   spend/{dia}                      gasto estimado com a API no dia (US$)
//   rl/{tipo}/{hash}/{janela}        limites por IP / e-mail
let _store = null;

export async function store() {
  if (globalThis.__ASSIST_STORE__) return globalThis.__ASSIST_STORE__;
  if (_store) return _store;
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name: "nivela-assist", consistency: "strong" });
  _store = {
    async get(key) { return (await s.get(key, { type: "json" })) || null; },
    async set(key, value) { await s.setJSON(key, value); },
    async del(key) { await s.delete(key); },
    async list(prefix) { const r = await s.list({ prefix }); return (r.blobs || []).map((b) => b.key).sort(); } // sem paginate: a biblioteca junta todas as páginas
  };
  return _store;
}

// armazenamento em memória (testes e desenvolvimento local)
export function memoryStore() {
  const m = new Map();
  return {
    _map: m,
    async get(key) { return m.has(key) ? JSON.parse(m.get(key)) : null; },
    async set(key, value) { m.set(key, JSON.stringify(value)); },
    async del(key) { m.delete(key); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort(); }
  };
}

// contador simples (Blobs não tem incremento atômico; para os limites daqui, ler-somar-gravar basta)
export async function bump(key, fields) {
  const s = await store();
  const cur = (await s.get(key)) || {};
  Object.keys(fields).forEach((k) => { cur[k] = Math.round(((cur[k] || 0) + fields[k]) * 1e6) / 1e6; });
  cur.updatedAt = new Date().toISOString();
  await s.set(key, cur);
  return cur;
}
