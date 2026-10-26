// Supabase Edge Function: servicos
// Ações do app Eternity Electric que precisam do servidor:
//  readReceipt     (funcionário/admin) – lê a foto da nota com IA e acha a obra
//  sendProposal    (admin)             – envia a proposta por e-mail com link para aceitar
//  publicGet       (cliente)           – mostra a proposta pelo link
//  publicAccept    (cliente)           – cliente aceita; avisa o Bruno e monta a lista de material
//  materialList    (admin)             – monta / refaz a lista de material de uma proposta
//  notifyNotice    (funcionário)       – avisa o administrador de um aviso novo
//  dailyReports    (agendado / admin)  – relatório diário da obra para o cliente
//  weeklyPayroll   (agendado / admin)  – quanto pagar cada funcionário na semana
//  fetchDeals      (agendado / admin)  – busca liquidações de material elétrico nas lojas
// Segredos: ANTHROPIC_API_KEY (IA) e RESEND_API_KEY (e-mail).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = Deno.env.get("PROPOSAL_MODEL") || "claude-sonnet-5-5";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function out(body: unknown) { return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } }); }
function esc(s: unknown) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function money(n: number) { return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function nyDate(d = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); } // YYYY-MM-DD
function longDate(iso: string) { return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); }

let CFG: Record<string, string> | null = null;
async function cfg() {
  if (CFG) return CFG;
  const { data } = await admin.from("app_config").select("key,value");
  CFG = Object.fromEntries((data || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return CFG!;
}

// ── quem está chamando ──
type Me = { id: string; role: string; company_id: string; full_name: string; active: boolean };
async function whoAmI(req: Request): Promise<Me | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await admin.from("profiles").select("id, role, company_id, full_name, active").eq("id", data.user.id).single();
  return p && p.active ? p as Me : null;
}

// ── IA ──
async function claude(system: string, content: unknown, tool: Record<string, unknown>, maxTokens = 4000) {
  const key = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("NO_KEY");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: system + `\n\nAlways answer ONLY by calling the \`${tool.name}\` tool exactly once.`, tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("AI: " + (j?.error?.message || r.status));
  const b = (j.content || []).find((c: { type: string }) => c.type === "tool_use");
  if (b) return b.input;
  const txt = (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) { /* segue */ } }
  throw new Error("AI: sem resposta");
}

// ── marca de cada empresa ──
function BR(co: string | null | undefined, c: Record<string, string>) {
  const blue = co === "bluestar";
  return blue
    ? { id: "bluestar", name: "Blue Star HVAC", sub: "Licensed HVAC Contractor · Watertown, MA", dark: "#13233A", accent: "#B3202A", bg: "#F3F6FA", line: "#d4dce8", footer: "Blue Star HVAC Inc. · 9 Ladd Pl, Watertown, MA · bluestarhvac.inc@gmail.com", reply: c.admin_email_bluestar || c.admin_email, appUrl: c.app_url_bluestar || c.app_url }
    : { id: "eternity", name: "Eternity Electric", sub: "Licensed Electrical Contractor · Massachusetts", dark: "#2B241D", accent: "#B08A4A", bg: "#FBF7F1", line: "#e6d8c2", footer: "Eternity Electric · office@eternityelectrical.com", reply: c.admin_email, appUrl: c.app_url };
}
async function adminEmails(): Promise<string[]> {
  const c = await cfg();
  const { data } = await admin.from("profiles").select("email").eq("role", "admin").eq("active", true);
  const list = (data || []).map((r: any) => String(r.email || "").trim()).filter((e: string) => /@/.test(e));
  return list.length ? Array.from(new Set(list)) : [c.admin_email];
}

// ── e-mail: pela conta Google (senha de app) ou pelo Resend ──
const SMTP: Record<string, any> = {};
async function sendEmail(o: { to: string | string[]; subject: string; html: string; replyTo?: string; bcc?: string[]; co?: string }) {
  const c = await cfg(), b = BR(o.co, c);
  const blueUser = Deno.env.get("GMAIL_USER_BLUESTAR"), bluePass = (Deno.env.get("GMAIL_APP_PASSWORD_BLUESTAR") || "").replace(/\s+/g, "");
  const useBlue = o.co === "bluestar" && blueUser && bluePass;
  const gUser = useBlue ? blueUser! : Deno.env.get("GMAIL_USER"), gPass = useBlue ? bluePass : (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
  if (gUser && gPass) {
    if (!SMTP[gUser]) {
      const nm: any = await import("npm:nodemailer@6.9.16");
      SMTP[gUser] = (nm.default || nm).createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: gUser, pass: gPass } });
    }
    const to = (Array.isArray(o.to) ? o.to : [o.to]).filter(Boolean);
    const bcc = (o.bcc || []).filter((x) => x && x.toLowerCase() !== gUser.toLowerCase() && !to.includes(x));
    const info = await SMTP[gUser].sendMail({ from: `${b.name} <${gUser}>`, to, bcc, replyTo: o.replyTo || b.reply, subject: o.subject, html: o.html });
    return { id: info.messageId };
  }
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("NO_EMAIL_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: c.from_email, to: Array.isArray(o.to) ? o.to : [o.to], subject: o.subject, html: o.html, reply_to: o.replyTo || b.reply, bcc: o.bcc }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("EMAIL: " + (j?.message || r.status));
  return j;
}
let CUR_CO = "eternity";
function shell(title: string, body: string, co?: string) {
  const b = BR(co || CUR_CO, CFG || {});
  return `<div style="background:${b.bg};padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:${b.dark}">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid ${b.line};border-radius:10px;overflow:hidden">
<div style="background:#fff;padding:16px 22px;border-bottom:3px solid ${b.accent};text-align:center"><img src="${b.appUrl}/icons/logo-${b.id}.png" alt="${b.name}" width="170" style="max-width:170px;height:auto;display:inline-block"><div style="font-size:12px;color:${b.dark};margin-top:4px">${b.sub}</div></div>
<div style="padding:22px"><h2 style="margin:0 0 12px;font-size:20px;color:${b.dark}">${title}</h2>${body}</div>
<div style="border-top:1px solid ${b.line};padding:12px 22px;font-size:12px;color:#7a6a55;font-style:italic">${b.footer}</div></div></div>`;
}
function bar(pct: number) {
  const p = Math.max(0, Math.min(100, Math.round(pct))), b = BR(CUR_CO, CFG || {});
  return `<div style="background:#eee;border-radius:6px;height:14px;overflow:hidden"><div style="background:${b.accent};width:${p}%;height:14px"></div></div><div style="font-size:13px;margin-top:4px"><b>${p}%</b> complete</div>`;
}

// ═══════════ ações ═══════════
async function readReceipt(me: Me, b: { path: string }) {
  if (!b.path || (me.role !== "admin" && !b.path.startsWith(me.id + "/"))) throw new Error("FORBIDDEN");
  const { data: file, error } = await admin.storage.from("receipts").download(b.path);
  if (error || !file) throw new Error("Foto não encontrada.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const q = admin.from("projects").select("id, name, address, client, status").neq("status", "Cancelled").neq("status", "Completed");
  const { data: projects } = me.role === "admin" ? await q : await q.eq("company_id", me.company_id);
  const list = (projects || []).map((p: any) => `${p.id} | ${p.name} | ${p.address || ""} | ${p.client || ""}`).join("\n");
  const r = await claude(
    `You read photos of purchase receipts/invoices for an electrical contractor in Massachusetts. Extract the data and decide which job it belongs to. Receipts usually show a job name, PO, address or customer note (e.g. "Job: 53 Mason", "PO 14 Elm"). Match it against the active jobs list; match street numbers/names loosely. If nothing matches, return project_id null. Category: "material" for electrical supplies/tools/parts, "permit" for city/town permit or inspection fees, "equipamento" for equipment rental (lifts, trenchers, etc.), "outros" for anything else.`,
    [
      { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: b64 } },
      { type: "text", text: `Active jobs (id | name | address | client):\n${list || "(none)"}\n\nToday: ${nyDate()}` },
    ],
    {
      name: "receipt", description: "Data read from the receipt",
      input_schema: { type: "object", properties: {
        project_id: { type: ["string", "null"] }, project_text: { type: "string", description: "job name/PO text found on the receipt" },
        vendor: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, total: { type: ["number", "null"] },
        category: { type: "string", enum: ["material", "permit", "equipamento", "outros"] }, summary_pt: { type: "string", description: "short summary in Portuguese of what was bought" },
        readable: { type: "boolean" },
      }, required: ["project_id", "vendor", "total", "category", "readable"] },
    }, 1500);
  if (r.project_id && !(projects || []).some((p: any) => p.id === r.project_id)) r.project_id = null;
  return r;
}

function publicView(row: Record<string, any>) {
  const d = row.data || {};
  const keep = ["docType", "date", "client", "subtitle", "title", "intro", "sections", "items", "totalLabel", "includes", "payment", "notIncluded", "clarifications", "warranty", "header", "validityDays", "amountPaid", "dueTerms", "dueDate", "ref", "acceptedBy"];
  const v: Record<string, unknown> = {}; keep.forEach((k) => { if (d[k] !== undefined) v[k] = d[k]; });
  if (v.client) { const c = v.client as Record<string, unknown>; v.client = { name: c.name, role: c.role, address: c.address }; }
  return { ...v, number: row.number, total: Number(row.total) || 0, status: row.status, companyId: row.company_id, acceptedAt: row.accepted_at };
}

async function sendProposal(b: { id: string; to?: string; note?: string }) {
  const { data: row } = await admin.from("proposals").select("*").eq("id", b.id).single();
  if (!row) throw new Error("Proposta não encontrada.");
  const d = row.data || {}, c = await cfg();
  const to = (b.to || d.client?.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Coloque o e-mail do cliente na proposta.");
  const inv = d.docType === "invoice";
  CUR_CO = row.company_id; const B = BR(row.company_id, c);
  const link = `${B.appUrl}/?proposta=${row.public_token}`;
  const first = String(d.client?.name || "").split(" ")[0] || "there";
  const html = shell(inv ? `Invoice ${esc(row.number)}` : `Proposal ${esc(row.number)}`, `
<p>Hello ${esc(first)},</p>
<p>${inv ? "Please find your invoice" : "Thank you for the opportunity. Please find our proposal"} for <b>${esc(d.client?.address || d.subtitle || "your project")}</b>${d.subtitle ? ` — ${esc(d.subtitle)}` : ""}.</p>
${b.note ? `<p>${esc(b.note)}</p>` : ""}
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:15px"><tr><td style="padding:8px 0;border-bottom:1px solid #e6d8c2">${inv ? "Invoice" : "Proposal"} no.</td><td style="text-align:right;border-bottom:1px solid #e6d8c2"><b>${esc(row.number)}</b></td></tr>
<tr><td style="padding:8px 0">${inv ? "Balance due" : "Total"}</td><td style="text-align:right"><b>${money((Number(row.total) || 0) - (inv ? Number(d.amountPaid) || 0 : 0))}</b></td></tr></table>
<p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#B08A4A;color:#fff;text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:bold;display:inline-block">${inv ? "View invoice" : "View &amp; accept proposal"}</a></p>
<p style="font-size:13px;color:#7a6a55">${inv ? "You can download a PDF copy from the link above." : "You can review every detail, download a PDF and accept the proposal online from the link above. If you have any questions, simply reply to this email."}</p>
<p>Best regards,<br><b>${B.name}</b></p>`);
  await sendEmail({ to, subject: `${inv ? "Invoice" : "Proposal"} ${row.number} — ${d.client?.address || B.name}`, html, bcc: [B.reply], co: row.company_id });
  const data = { ...d, sentTo: to, sentAt: new Date().toISOString() };
  await admin.from("proposals").update({ sent_at: new Date().toISOString(), status: row.status === "Rascunho" ? "Enviada" : row.status, data }).eq("id", row.id);
  return { sent: to };
}

async function buildMaterialList(id: string) {
  const { data: row } = await admin.from("proposals").select("*").eq("id", id).single();
  if (!row) throw new Error("Proposta não encontrada.");
  const d = row.data || {};
  const scope = (d.sections || []).map((s: { title: string; text: string }) => `## ${s.title}\n${s.text}`).join("\n\n");
  const r = await claude(
    `You are an experienced Massachusetts master electrician doing a material takeoff for purchasing. From the scope, list the electrical materials the crew must BUY (not owner-supplied fixtures/appliances, not items marked "by others"). Be realistic with quantities for the described job (add ~10% waste on wire). Use common US supply-house names (e.g. "12/2 NM-B Romex 250 ft", "1-gang new work box", "20A tamper-resistant duplex receptacle", "Square D Homeline 200A main breaker panel"). Group similar items. 8–40 lines.`,
    `Job: ${d.subtitle || ""} at ${d.client?.address || ""}\n\nSCOPE:\n${scope}\n\nINVESTMENT LINES:\n${(d.items || []).map((i: { desc: string }) => i.desc).join("\n")}`,
    { name: "takeoff", description: "Material list", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, qty: { type: "number" }, unit: { type: "string" }, search: { type: "string", description: "short search term for store websites" } }, required: ["name", "qty", "unit", "search"] } }, notes_pt: { type: "string" } }, required: ["items"] } },
    4000);
  const data = { ...d, materialList: { items: r.items || [], notes: r.notes_pt || "", at: new Date().toISOString() } };
  await admin.from("proposals").update({ data }).eq("id", id);
  return data.materialList;
}

async function publicAccept(b: { token: string; name: string }) {
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) throw new Error("Please type your name to accept.");
  const { data: row } = await admin.from("proposals").select("*").eq("public_token", b.token).single();
  if (!row) throw new Error("Proposal not found.");
  if (row.accepted_at) return publicView(row);
  const now = new Date().toISOString();
  const data = { ...(row.data || {}), acceptedBy: name, acceptedAt: now };
  const { data: upd } = await admin.from("proposals").update({ status: "Aceita", accepted_at: now, data }).eq("id", row.id).select().single();
  const c = await cfg();
  const job = (async () => {
    try {
      CUR_CO = row.company_id;
      await sendEmail({ co: row.company_id, to: await adminEmails(), subject: `✅ Proposta ${row.number} ACEITA — ${data.client?.address || ""}`,
        html: shell(`Proposta ${esc(row.number)} aceita`, `<p><b>${esc(name)}</b> aceitou a proposta <b>${esc(row.number)}</b> (${esc(data.client?.address || "")}) no valor de <b>${money(Number(row.total))}</b>.</p><p>Estou montando a lista de material com os melhores preços. Abra a proposta no app para ver.</p><p><a href="${BR(row.company_id, c).appUrl}">Abrir o app</a></p>`) });
    } catch (_) { /* sem e-mail configurado */ }
    try { await buildMaterialList(row.id); } catch (_) { /* sem IA */ }
  })();
  // @ts-ignore EdgeRuntime existe no Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job); else await job;
  return publicView(upd || row);
}

async function notifyNotice(me: Me, b: { id: string }) {
  const { data: n } = await admin.from("notices").select("*, projects(name, address)").eq("id", b.id).single();
  if (!n || (n.user_id !== me.id && me.role !== "admin")) throw new Error("FORBIDDEN");
  const c = await cfg();
  CUR_CO = n.company_id;
  await sendEmail({ co: n.company_id, to: await adminEmails(), subject: `⚠️ Aviso de ${n.author_name || "funcionário"} — ${n.projects?.name || "obra"}`,
    html: shell("Novo aviso da obra", `<p><b>${esc(n.author_name || "")}</b> · ${esc(n.projects?.name || "")}</p><p style="font-size:16px;background:#FFF4DC;padding:12px;border-radius:6px">${esc(n.text).replace(/\n/g, "<br>")}</p>${n.photo_path ? "<p>Tem foto anexada — veja no app.</p>" : ""}<p><a href="${BR(n.company_id, c).appUrl}">Abrir o app</a></p>`) });
  return { ok: true };
}

async function notifyCalendar(me: Me, b: { id: string; changed?: boolean }) {
  const { data: e } = await admin.from("calendar_events").select("*, projects(name, address)").eq("id", b.id).single();
  if (!e) throw new Error("Item não encontrado.");
  CUR_CO = e.company_id || "eternity";
  let whoName = "Todos";
  if (e.who && e.who !== "todos") { const { data: u } = await admin.from("profiles").select("full_name").eq("id", e.who).single(); whoName = u?.full_name || "—"; }
  const when = longDate(e.date) + (e.start_time ? " · " + String(e.start_time).slice(0, 5) + (e.end_time ? "–" + String(e.end_time).slice(0, 5) : "") : "");
  const c = await cfg();
  await sendEmail({ co: CUR_CO, to: await adminEmails(), subject: `📅 ${b.changed ? "Agenda alterada" : "Nova na agenda"}: ${e.title} — ${e.date.split("-").reverse().join("/")}${e.start_time ? " " + String(e.start_time).slice(0, 5) : ""}`,
    html: shell(b.changed ? "Item da agenda alterado" : "Novo item na agenda", `<p style="font-size:18px;margin:0 0 6px"><b>${esc(e.title)}</b></p><p style="margin:0 0 10px">${esc(when)}</p>
<table style="font-size:14px;border-collapse:collapse"><tr><td style="padding:3px 12px 3px 0;color:#7a6a55">Quem</td><td><b>${esc(whoName)}</b></td></tr>
${e.company_id ? `<tr><td style="padding:3px 12px 3px 0;color:#7a6a55">Empresa</td><td>${e.company_id === "bluestar" ? "Blue Star HVAC" : "Eternity Electric"}</td></tr>` : ""}
${e.projects ? `<tr><td style="padding:3px 12px 3px 0;color:#7a6a55">Obra</td><td>${esc(e.projects.name)}${e.projects.address ? " · " + esc(e.projects.address) : ""}</td></tr>` : ""}
<tr><td style="padding:3px 12px 3px 0;color:#7a6a55">Colocado por</td><td>${esc(e.created_by_name || me.full_name)}</td></tr></table>
${e.notes ? `<p style="background:#f6f3ee;padding:10px;border-radius:6px;white-space:pre-wrap">${esc(e.notes)}</p>` : ""}
<p><a href="${BR(CUR_CO, c).appUrl}">Abrir a agenda no app</a></p>`) });
  return { ok: true };
}

async function dailyReports(b: { projectId?: string; force?: boolean }) {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString(), today = nyDate();
  let q = admin.from("projects").select("id, company_id, name, address, client, status, project_tasks(label, grp, done, done_at), project_financials(client_email, daily_report)").eq("status", "Active");
  if (b.projectId) q = admin.from("projects").select("id, company_id, name, address, client, status, project_tasks(label, grp, done, done_at), project_financials(client_email, daily_report)").eq("id", b.projectId);
  const { data: projects } = await q;
  const results: unknown[] = [];
  for (const p of projects || []) {
    const fin = Array.isArray(p.project_financials) ? p.project_financials[0] : p.project_financials;
    if (!fin?.client_email || (!fin.daily_report && !b.force)) { results.push({ id: p.id, skipped: "sem e-mail ou relatório desligado" }); continue; }
    const tasks = p.project_tasks || [];
    const doneToday = tasks.filter((t: { done: boolean; done_at: string }) => t.done && t.done_at && t.done_at >= since);
    const { data: te } = await admin.from("time_entries").select("user_id, check_in, check_out").eq("project_id", p.id).gte("check_in", since);
    const crew = new Set((te || []).map((t: { user_id: string }) => t.user_id)).size;
    const hours = (te || []).reduce((a: number, t: { check_in: string; check_out: string }) => a + (t.check_out ? (new Date(t.check_out).getTime() - new Date(t.check_in).getTime()) / 36e5 : 0), 0);
    if (!doneToday.length && !crew && !b.force) { results.push({ id: p.id, skipped: "sem atividade hoje" }); continue; }
    CUR_CO = p.company_id;
    const done = tasks.filter((t: { done: boolean }) => t.done).length, pct = tasks.length ? (done / tasks.length) * 100 : 0;
    const next = tasks.filter((t: { done: boolean }) => !t.done).slice(0, 5);
    const html = shell(`Daily Progress Report — ${longDate(today)}`, `
<p style="margin:0 0 4px"><b>${esc(p.address || p.name)}</b></p>${p.client ? `<p style="margin:0 0 14px;color:#7a6a55">${esc(p.client)}</p>` : ""}
${bar(pct)}
<p style="margin-top:16px"><b>Work completed today</b></p>
${doneToday.length ? `<ul style="margin:6px 0 0 18px;padding:0">${doneToday.map((t: { label: string }) => `<li style="margin:3px 0">${esc(t.label)}</li>`).join("")}</ul>` : `<p style="margin:6px 0">Work in progress on site${crew ? ` — ${crew} crew member${crew > 1 ? "s" : ""}, ${hours.toFixed(1)} labor hours` : ""}.</p>`}
${crew && doneToday.length ? `<p style="font-size:13px;color:#7a6a55">Crew on site: ${crew} · ${hours.toFixed(1)} labor hours</p>` : ""}
${next.length ? `<p style="margin-top:14px"><b>Coming up next</b></p><ul style="margin:6px 0 0 18px;padding:0">${next.map((t: { label: string }) => `<li style="margin:3px 0">${esc(t.label)}</li>`).join("")}</ul>` : ""}
<p style="margin-top:18px">${done} of ${tasks.length} scheduled tasks completed. Reply to this email with any questions.</p>
<p>${BR(p.company_id, await cfg()).name}</p>`);
    try {
      await sendEmail({ co: p.company_id, to: fin.client_email, subject: `Daily progress — ${p.address || p.name} — ${longDate(today)}`, html });
      await admin.from("project_financials").update({ last_report_at: new Date().toISOString() }).eq("project_id", p.id);
      results.push({ id: p.id, sent: fin.client_email });
    } catch (e) { results.push({ id: p.id, error: String((e as Error).message) }); }
  }
  return { results };
}

async function weeklyPayroll(b: { email?: boolean; company?: string; skipEmpty?: boolean }) {
  const co = b.company === "bluestar" ? "bluestar" : "eternity"; CUR_CO = co;
  // semana de domingo a sábado (horário de Boston)
  const todayNY = nyDate(), d = new Date(todayNY + "T12:00:00Z"), dow = d.getUTCDay();
  const start = new Date(d); start.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(start); end.setUTCDate(start.getUTCDate() + 7);
  const from = start.toISOString().slice(0, 10), to = new Date(end.getTime() - 864e5).toISOString().slice(0, 10);
  const { data: te } = await admin.from("time_entries").select("user_id, check_in, check_out, rate").eq("company_id", co).gte("check_in", from + "T04:00:00Z").lt("check_in", end.toISOString().slice(0, 10) + "T05:00:00Z");
  const { data: people } = await admin.from("profiles").select("id, full_name, hourly_rate, role, active").eq("company_id", co);
  const rows: Record<string, { name: string; hours: number; pay: number; days: Set<string>; open: number }> = {};
  for (const t of te || []) {
    const p = (people || []).find((x: any) => x.id === t.user_id);
    const r = rows[t.user_id] ||= { name: p?.full_name || "?", hours: 0, pay: 0, days: new Set(), open: 0 };
    if (!t.check_out) { r.open++; continue; }
    const h = (new Date(t.check_out).getTime() - new Date(t.check_in).getTime()) / 36e5;
    r.hours += h; r.pay += h * (Number(t.rate) || 0); r.days.add(nyDate(new Date(t.check_in)));
  }
  const list = Object.values(rows).map((r) => ({ name: r.name, hours: Math.round(r.hours * 100) / 100, pay: Math.round(r.pay * 100) / 100, days: r.days.size, open: r.open })).sort((a, b) => b.pay - a.pay);
  const total = list.reduce((a, r) => a + r.pay, 0);
  if (b.email !== false && !(b.skipEmpty && !list.length)) {
    await sendEmail({ co, to: await adminEmails(), subject: `💵 ${BR(co, await cfg()).name}: pagamento da semana (${from} a ${to}) — total ${money(total)}`,
      html: shell("Pagamento da semana", `<p>Semana de <b>${from.split("-").reverse().join("/")}</b> a <b>${to.split("-").reverse().join("/")}</b>.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="background:#2B241D;color:#fff"><th style="text-align:left;padding:8px">Funcionário</th><th style="padding:8px">Dias</th><th style="padding:8px;text-align:right">Horas</th><th style="padding:8px;text-align:right">A pagar</th></tr>
${list.map((r) => `<tr><td style="padding:8px;border-bottom:1px solid #e6d8c2">${esc(r.name)}${r.open ? ' <span style="color:#B45309">(ponto sem saída)</span>' : ""}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #e6d8c2">${r.days}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #e6d8c2">${r.hours.toFixed(2)}h</td><td style="padding:8px;text-align:right;border-bottom:1px solid #e6d8c2"><b>${money(r.pay)}</b></td></tr>`).join("")}
<tr style="background:#B08A4A;color:#fff"><td style="padding:8px" colspan="3"><b>TOTAL</b></td><td style="padding:8px;text-align:right"><b>${money(total)}</b></td></tr></table>
<p style="font-size:13px;color:#7a6a55">Confira no app (aba Ponto) e corrija algum ponto esquecido antes de pagar.</p>`) });
  }
  return { from, to, list, total };
}

// ── promoções ──
const DEAL_SOURCES = [
  { store: "homedepot", url: "https://www.homedepot.com/b/Electrical/Special-Values/N-5yc1vZarcdZ7" },
  { store: "ies", url: "https://www.iesbuy.com/Clearance-Items" },
  { store: "ies", url: "https://www.iesbuy.com/Promotions" },
  { store: "granite", url: "https://www.granitecityelectric.com/promos-and-events" },
  { store: "northeast", url: "https://www.needco.com" },
];
function compactHtml(html: string, base: string) {
  const abs = (u: string) => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return u; } };
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img[^>]*?(?:data-src|src)=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?[^>]*>/gi, (_m, s, a) => ` [IMG ${abs(s)} ${a || ""}] `)
    .replace(/<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi, (_m, h) => ` [LINK ${abs(h)}] `)
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").slice(0, 60000);
}
async function fetchDeals() {
  const report: unknown[] = []; const found: Record<string, unknown>[] = [];
  for (const s of DEAL_SOURCES) {
    try {
      const r = await fetch(s.url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
      if (!r.ok) { report.push({ url: s.url, status: r.status }); continue; }
      const text = compactHtml(await r.text(), s.url);
      if (text.length < 500) { report.push({ url: s.url, status: "vazio" }); continue; }
      const res = await claude(
        `Extract ONLY electrical-contractor products that are on sale, clearance, special value, rebate or promotion from this store page text. Products: wire & cable, conduit & fittings, boxes, devices (receptacles, GFCI, switches, dimmers), breakers, load centers/panels, meter sockets, grounding, lighting (recessed/wafer/LED fixtures), hardwired smoke/CO, EV chargers, electrician tools and consumables. Ignore batteries, extension cords, household bulbs, decor, appliances. Use the [IMG url alt] markers for the product photo (pick the image right next to the product) and [LINK url] for the product page. Prices only if shown; never invent. If the page has no real promotions, return an empty list.`,
        `Store: ${s.store}\nPage: ${s.url}\n\n${text}`,
        { name: "deals", description: "Promotions found", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { title: { type: "string" }, price: { type: ["number", "null"] }, was_price: { type: ["number", "null"] }, image_url: { type: ["string", "null"] }, url: { type: ["string", "null"] }, note: { type: "string", description: "e.g. 'Clearance', 'Buy 5+ save 10%', valid dates" } }, required: ["title"] } } }, required: ["items"] } },
        6000);
      const items = (res.items || []).slice(0, 40);
      items.forEach((it: Record<string, unknown>) => found.push({ store: s.store, title: String(it.title).slice(0, 300), price: it.price ?? null, was_price: it.was_price ?? null, image_url: it.image_url || null, url: it.url || s.url, note: it.note || null, source: "auto", fetched_at: new Date().toISOString() }));
      report.push({ url: s.url, items: items.length });
    } catch (e) { report.push({ url: s.url, error: String((e as Error).message).slice(0, 160) }); }
  }
  if (found.length) {
    await admin.from("deals").delete().eq("source", "auto");
    await admin.from("deals").insert(found);
  }
  return { saved: found.length, report };
}

// ═══════════ roteador ═══════════
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    const c = await cfg();
    const cron = !!req.headers.get("x-cron-secret") && req.headers.get("x-cron-secret") === c.cron_secret;

    // ações públicas (cliente pelo link)
    if (action === "publicGet") {
      const { data: row } = await admin.from("proposals").select("*").eq("public_token", b.token).single();
      if (!row) return out({ error: "NOT_FOUND" });
      return out({ ok: true, proposal: publicView(row) });
    }
    if (action === "publicAccept") return out({ ok: true, proposal: await publicAccept(b) });

    // agendadas
    if (cron) {
      if (action === "dailyReports") return out(await dailyReports({}));
      if (action === "weeklyPayroll") return out({ eternity: await weeklyPayroll({ company: "eternity" }), bluestar: await weeklyPayroll({ company: "bluestar", skipEmpty: true }) });
      if (action === "fetchDeals") return out(await fetchDeals());
    }

    const me = await whoAmI(req);
    if (!me) return out({ error: "LOGIN" });
    if (action === "diag" && me.role === "admin") { const k = Deno.env.get("ANTHROPIC_API_KEY") || ""; return out({ ok: true, aiKey: { length: k.length, start: k.trim().slice(0, 12), spaces: k !== k.trim(), quotes: /["']/.test(k) }, gmail: !!Deno.env.get("GMAIL_APP_PASSWORD") }); }
    if (action === "readReceipt") return out({ ok: true, result: await readReceipt(me, b) });
    if (action === "notifyNotice") return out(await notifyNotice(me, b));
    if (me.role !== "admin") return out({ error: "FORBIDDEN" });
    if (action === "sendProposal") return out({ ok: true, ...(await sendProposal(b)) });
    if (action === "materialList") return out({ ok: true, list: await buildMaterialList(b.id) });
    if (action === "dailyReports") return out({ ok: true, ...(await dailyReports({ projectId: b.projectId, force: true })) });
    if (action === "weeklyPayroll") return out({ ok: true, ...(await weeklyPayroll({ email: !!b.email, company: b.company })) });
    if (action === "notifyCalendar") return out(await notifyCalendar(me, b));
    if (action === "fetchDeals") return out({ ok: true, ...(await fetchDeals()) });
    return out({ error: "UNKNOWN_ACTION" });
  } catch (e) {
    const m = String((e as Error)?.message || e);
    return out({ error: m === "NO_KEY" || m === "NO_EMAIL_KEY" || m === "FORBIDDEN" ? m : "FAIL", detail: m });
  }
});
