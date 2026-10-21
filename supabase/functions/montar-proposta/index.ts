// Supabase Edge Function: montar-proposta
// Recebe o que o Bruno/sócio falou (em português ou inglês) e devolve a proposta
// (ou invoice) estruturada, em inglês profissional, no padrão Eternity / Blue Star.
// Requer o segredo ANTHROPIC_API_KEY (Edge Functions → Secrets) e só atende admins.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = Deno.env.get("PROPOSAL_MODEL") || "claude-sonnet-5-5";

function out(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}

const ELECTRICAL_RULES = `Company: ETERNITY ELECTRIC — licensed electrical contractor, Worcester MA, works in MA and NH.
Code references to use where relevant: 2023 Massachusetts Electrical Code (527 CMR 12.00 / NEC 2023), Massachusetts State Building Code 780 CMR (10th edition); in New Hampshire use "NEC 2020 as adopted by the State of New Hampshire".
Typical section titles (pick only what the job needs, and prefer sections by AREA or SYSTEM such as "Service Upgrade — 200A", "Kitchen", "Bathroom", "Basement", "Exterior", "Smoke / CO Detectors", "Permit & Inspections").
Style of bullets (examples):
- Furnish and install a new **200A** meter socket and main breaker panel, including service-entrance conductors and grounding/bonding per NEC Article 250.
- Install all required receptacles per NEC 210.52 — tamper-resistant (TR) throughout.
- Furnish and install **12 LED 6" recessed wafer lights** with dimmer control.
- Electrical permit will be pulled by Eternity Electric. Permit fees are included.
Wiring: NM-B (Romex) where permitted, MC cable where required, EMT in commercial/exposed locations — follow what the speaker says.`;

const HVAC_RULES = `Company: BLUE STAR HVAC INC. — HVAC contractor, Watertown MA.
IMPORTANT: Blue Star HVAC does NOT perform gas connections or gas piping. For any furnace/boiler/gas appliance, state in the scope and in Not Included that gas piping and connection are by others (licensed plumber / gas fitter).
Typical sections: "Removal of Existing Equipment", "Equipment Installation" (state brand, model, BTU, SEER/HSPF if said), "Ductwork & Distribution", "Refrigerant Piping & Condensate", "Controls & Thermostats", "Start-Up, Testing & Commissioning", "Rebates & Documentation" (Mass Save when relevant), "Permit & Inspections".
Code references: Massachusetts State Building Code 780 CMR (10th edition), manufacturer's installation instructions, EPA Section 608 for refrigerant.`;

function systemPrompt(company: string, docType: string) {
  const isHvac = company === "bluestar";
  return `You write client documents for a Brazilian contractor in Massachusetts. He (or his partner) dictates the job by voice, usually in Brazilian Portuguese mixed with English trade words, sometimes with speech-recognition mistakes ("rômex" = Romex, "recéssed"/"recess" = recessed lights, "GFI" = GFCI, "panel de 200" = 200A panel, "mil" = thousand). Understand the intent and produce a polished document in professional American English.

${isHvac ? HVAC_RULES : ELECTRICAL_RULES}

Document type: ${docType === "invoice" ? "INVOICE — describe the work COMPLETED (past tense: 'Furnished and installed…'), line items with amounts. Sections are optional for an invoice (use at most one short 'Work Performed' section if useful). Fill invoice fields (amount_paid, terms) only if mentioned." : "ESTIMATE / PROPOSAL — describe the work to be performed (future: 'Furnish and install…')."}

Rules:
- Every bullet is one complete, specific sentence. Use **double asterisks** to bold key specs (amperage, quantities, equipment, model). 3–8 bullets per section. Do not pad with generic filler; only include work the speaker described or that is clearly required by code for that work (and say so).
- Never invent prices. If the speaker gave a total, use it. If he gave prices per part, make one line item per part. If no price was said, set price to null and mention it in notes_pt.
- Quantities/brands/sizes: use exactly what was said; if something important is missing, write a neutral bullet ("quantity to be confirmed at walk-through") and mention it in notes_pt.
- Payment: if the speaker says how he wants to be paid, use it (e.g. "metade na entrada" = 50% deposit / 50% on completion; "banco"/"financiado" = bank draws). Otherwise: total under $8,000 → 50/50; otherwise 30/40/30 (deposit / rough-in / final). Percentages must sum to 100.
- not_included: short items relevant to THIS job (e.g. drywall patching and painting, fixtures supplied by owner, utility fees). 4–9 items.
- extra_clarifications: only job-specific assumptions (e.g. "Walls to remain open during rough-in."). Standard permit/licensing/change-order lines are added automatically — do not repeat them.
- subtitle: short, like "Interior Renovation · Single-Family Residence" or "Swimming Pool Electrical" or "Heat Pump Installation · 2 Zones".
- intro: 2–3 sentences: what the proposal covers, where, and code compliance. For an invoice: one sentence describing the work completed.
- Client name / role / project address: fill ONLY if spoken; otherwise leave empty strings (the app already has them).
- notes_pt: in Brazilian Portuguese, a short list of what Bruno should double-check or what was missing (empty array if nothing). Keep each note under 20 words.
- If a CURRENT DOCUMENT is provided, the speech is an ADJUSTMENT request: apply the requested changes and return the COMPLETE updated document, keeping everything else as it was.`;
}

const TOOL = {
  name: "proposal",
  description: "Return the complete structured document.",
  input_schema: {
    type: "object",
    properties: {
      subtitle: { type: "string" },
      intro: { type: "string" },
      client_name: { type: "string" },
      client_role: { type: "string", description: "e.g. Homeowner, General Contractor, Developer, Property Manager" },
      project_address: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
          required: ["title", "bullets"],
        },
      },
      items: {
        type: "array",
        description: "Investment / invoice lines. First line of description is the bold title; optional details are short.",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            details: { type: "string" },
            quantity: { type: "string", description: "e.g. '1 lot', '12 ea'" },
            price: { type: ["number", "null"] },
          },
          required: ["description", "quantity", "price"],
        },
      },
      payment: {
        type: "array",
        items: {
          type: "object",
          properties: { milestone: { type: "string" }, trigger: { type: "string" }, percent: { type: "number" } },
          required: ["milestone", "trigger", "percent"],
        },
      },
      bank_financed: { type: "boolean" },
      not_included: { type: "array", items: { type: "string" } },
      extra_clarifications: { type: "array", items: { type: "string" } },
      amount_paid: { type: ["number", "null"] },
      invoice_terms: { type: "string" },
      notes_pt: { type: "array", items: { type: "string" } },
    },
    required: ["subtitle", "intro", "sections", "items", "payment", "not_included", "notes_pt"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return out({ error: "NO_KEY" });

    // só administradores (Bruno e sócio)
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const chk = await fetch(url + "/rest/v1/rpc/is_admin", { method: "POST", headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" }, body: "{}" });
    if (!chk.ok || (await chk.json()) !== true) return out({ error: "FORBIDDEN" });

    const b = await req.json();
    const company = b.company === "bluestar" ? "bluestar" : "eternity";
    const docType = b.docType === "invoice" ? "invoice" : "estimate";
    const speech = String(b.speech || "").slice(0, 20000);
    if (!speech.trim()) return out({ error: "EMPTY" });

    let user = `Client (already filled in the app): ${b.client?.name || "-"} (${b.client?.role || "-"}), project address: ${b.client?.address || "-"}\nToday: ${b.today || ""}\n\n`;
    if (b.current) user += `CURRENT DOCUMENT (JSON):\n${JSON.stringify(b.current).slice(0, 30000)}\n\nADJUSTMENT REQUESTED (speech):\n${speech}`;
    else user += `WHAT THE CONTRACTOR SAID ABOUT THE JOB:\n${speech}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: systemPrompt(company, docType),
        tools: [TOOL],
        tool_choice: { type: "tool", name: "proposal" },
        messages: [{ role: "user", content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return out({ error: "AI", detail: j?.error?.message || String(r.status) });
    const block = (j.content || []).find((c: { type: string }) => c.type === "tool_use");
    if (!block) return out({ error: "AI", detail: "sem resposta estruturada" });
    return out({ ok: true, result: block.input, model: MODEL });
  } catch (e) {
    return out({ error: "FAIL", detail: String((e as Error)?.message || e) });
  }
});
