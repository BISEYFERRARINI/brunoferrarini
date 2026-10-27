// IA com reserva (Anthropic → OpenAI). O código fica num lugar só, em supabase/functions/_shared/ai-fallback.mjs
// (JS puro, roda no Deno do Supabase e no Node do Netlify); o empacotador do Netlify inclui o arquivo pelo import.
export * from "../../supabase/functions/_shared/ai-fallback.mjs";
