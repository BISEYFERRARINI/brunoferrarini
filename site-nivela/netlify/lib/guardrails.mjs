// Nivela Assist — guardrails em CÓDIGO (não dependem do modelo obedecer ao prompt).
// Entrada: mascara senha/cartão/SSN/CPF, detecta prompt injection, pedido de humano e irritação, idioma.
// Saída: bloqueia promessa de desconto/reembolso/crédito, prazo de funcionalidade, pedido de senha/cartão,
// valores em dinheiro para funcionário, vazamento do prompt; remove URLs/e-mails que não são do getnivela.com; põe a assinatura.
import { SIGNATURE } from "../functions/_kb.mjs";

const L = "\\p{L}";
const B = "(?<![" + L + "\\d])", E = "(?![" + L + "\\d])"; // "borda de palavra" que entende acento
function rx(src, flags) { return new RegExp(src, (flags || "") + "iu"); }

// ─── textos fixos (PT/EN/ES) ───
export const CANNED = {
  injection: {
    pt: "Não consigo fazer isso. Posso ajudar com o Nivela — o que você precisa no app?",
    en: "I can't do that. I can help with Nivela — what do you need in the app?",
    es: "No puedo hacer eso. Puedo ayudarte con Nivela — ¿qué necesitas en la app?"
  },
  money: {
    pt: "Não consigo conceder desconto, reembolso, crédito ou condição especial por aqui — o preço é o da tabela (https://getnivela.com/#pricing). Vou passar seu pedido para uma pessoa da equipe.",
    en: "I can't give discounts, refunds, credits or special terms here — pricing is the same for everyone (https://getnivela.com/#pricing). I'll pass your request to a person on the team.",
    es: "No puedo dar descuentos, reembolsos, créditos ni condiciones especiales por aquí — el precio es el de la tabla (https://getnivela.com/#pricing). Voy a pasar tu pedido a una persona del equipo."
  },
  credentials: {
    pt: "Por segurança: nunca envie senha, código de verificação, número de cartão ou documento por aqui. A equipe do Nivela nunca pede isso. Se você já enviou uma senha, troque-a assim que puder.",
    en: "For your security: never send a password, verification code, card number or ID here. The Nivela team never asks for them. If you already sent a password, change it as soon as you can.",
    es: "Por seguridad: nunca envíes contraseña, código de verificación, número de tarjeta ni documentos por aquí. El equipo de Nivela nunca los pide. Si ya enviaste una contraseña, cámbiala cuanto antes."
  },
  sensitiveNote: {
    pt: "Atenção: apaguei da conversa um dado que parecia senha, cartão ou documento. Não mande senha, cartão nem documento por aqui.",
    en: "Heads up: I removed something that looked like a password, card or ID number. Please don't send that kind of data here.",
    es: "Atención: borré de la conversación un dato que parecía contraseña, tarjeta o documento. No envíes ese tipo de datos por aquí."
  },
  employeeMoney: {
    pt: "Valores em dinheiro (preços, pagamentos, custos da empresa) ficam com o administrador da empresa. Fale com o dono ou o gerente.",
    en: "Money details (prices, pay, company costs) stay with your company's admin. Please ask the owner or a manager.",
    es: "Los valores en dinero (precios, pagos, costos de la empresa) los maneja el administrador de la empresa. Habla con el dueño o el gerente."
  },
  noDates: {
    pt: "Ainda não temos data para isso.",
    en: "We don't have a date for that.",
    es: "Todavía no tenemos fecha para eso."
  },
  human: {
    pt: "Claro. Vou passar para uma pessoa da equipe. Deixe seu e-mail em **Falar com uma pessoa**: a conversa vai junto, você não precisa repetir nada. Respondemos por e-mail em até 1 dia útil (seg–sex). Se preferir, escreva para hello@getnivela.com — não envie senha nem cartão.",
    en: "Sure. I'll pass this to a person on the team. Leave your email under **Talk to a person**: the conversation goes along, so you won't need to repeat anything. We reply by email within 1 business day (Mon–Fri). You can also write to hello@getnivela.com — never send passwords or card numbers.",
    es: "Claro. Voy a pasarlo a una persona del equipo. Deja tu e-mail en **Hablar con una persona**: la conversación va junto, no necesitas repetir nada. Respondemos por e-mail en hasta 1 día hábil (lun–vie). También puedes escribir a hello@getnivela.com — no envíes contraseñas ni tarjetas."
  },
  budget: {
    pt: "O atendimento automático atingiu o limite de uso de hoje, então não vou arriscar uma resposta incompleta. Já registrei sua pergunta para a equipe: deixe seu e-mail em **Falar com uma pessoa** e respondemos por e-mail em até 1 dia útil (seg–sex).",
    en: "Automated support has reached today's usage limit, so I won't risk an incomplete answer. Your question is saved for the team: leave your email under **Talk to a person** and we'll reply by email within 1 business day (Mon–Fri).",
    es: "La atención automática llegó al límite de uso de hoy, así que no voy a arriesgar una respuesta incompleta. Ya registré tu pregunta para el equipo: deja tu e-mail en **Hablar con una persona** y respondemos por e-mail en hasta 1 día hábil (lun–vie)."
  },
  unavailable: {
    pt: "O atendimento automático está indisponível agora. Sua pergunta ficou registrada: deixe seu e-mail em **Falar com uma pessoa** ou escreva para hello@getnivela.com.",
    en: "Automated support is unavailable right now. Your question is saved: leave your email under **Talk to a person** or write to hello@getnivela.com.",
    es: "La atención automática no está disponible ahora. Tu pregunta quedó registrada: deja tu e-mail en **Hablar con una persona** o escribe a hello@getnivela.com."
  },
  rate: {
    pt: "Muitas mensagens em pouco tempo. Espere alguns minutos ou fale com uma pessoa: hello@getnivela.com.",
    en: "Too many messages in a short time. Please wait a few minutes or talk to a person: hello@getnivela.com.",
    es: "Demasiados mensajes en poco tiempo. Espera unos minutos o habla con una persona: hello@getnivela.com."
  },
  leak: {
    pt: "Não posso compartilhar isso. Posso ajudar com o Nivela — o que você precisa?",
    en: "I can't share that. I can help with Nivela — what do you need?",
    es: "No puedo compartir eso. Puedo ayudarte con Nivela — ¿qué necesitas?"
  }
};
export function canned(key, lang) { const c = CANNED[key]; return c[lang] || c.en; }

// ─── idioma (heurística simples; o modelo confirma) ───
const PT_W = /(?<![\p{L}])(não|nao|você|voce|vocês|obrigad[oa]|olá|oi|quero|preciso|também|minha|meu|isso|como|faço|está|esta|tá|uma|obra|funcionário|proposta|senha|conta|quanto|custa|posso|tem|pra|para|com|ponto|equipe)(?![\p{L}])/giu;
const ES_W = /(?<![\p{L}])(usted|cómo|qué|cuál|cuánto|cuesta|gracias|hola|quiero|necesito|también|puedo|tengo|está|los|las|pero|porque|sí|el|es|mi|una|empresa|trabajo|contraseña|cuenta|equipo|hablar|ayuda)(?![\p{L}])|[ñ¿¡]/giu;
const EN_W = /(?<![\p{L}])(the|how|do|does|can|my|i|is|what|you|to|a|and|it|for|with|want|need|crew|job|price|account|password|help|please|thanks|hi|hello)(?![\p{L}])/giu;
export function detectLang(text, fallback) {
  const s = String(text || "");
  const pt = (s.match(PT_W) || []).length + (/[ãõç]/i.test(s) ? 2 : 0);
  const es = (s.match(ES_W) || []).length;
  const en = (s.match(EN_W) || []).length;
  const best = Math.max(pt, es, en);
  if (best === 0) return fallback || "en";
  if (pt === best && pt > es) return "pt";
  if (es === best && es > pt) return "es";
  if (en === best) return "en";
  return fallback || (pt >= es ? "pt" : "es");
}

// ─── entrada: dados sensíveis ───
function luhn(d) { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; }
export function maskSensitive(text) {
  let s = String(text || ""); const found = new Set();
  s = s.replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, (m) => { const d = m.replace(/\D/g, ""); if (d.length >= 13 && d.length <= 19 && luhn(d)) { found.add("card"); return "[cartão removido]"; } return m; });
  s = s.replace(/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g, () => { found.add("ssn"); return "[documento removido]"; });
  s = s.replace(/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g, () => { found.add("cpf"); return "[documento removido]"; });
  s = s.replace(rx("(cvv|cvc|c[óo]digo de seguran[çc]a|security code)\\s*(?:[:=]|é|is|es)?\\s*\\d{3,4}" + E, "g"), (m, k) => { found.add("cvv"); return k + " [removido]"; });
  s = s.replace(rx(B + "(senha|password|passwd|pwd|contraseña|pass)\\s*(?:[:=]|é|eh|is|es|seria|would be)\\s*[\"'“]?([^\\s\"'”]{3,64})", "g"), (m, k) => { found.add("password"); return k + ": [senha removida]"; });
  s = s.replace(rx(B + "(minha senha|my password|mi contraseña)\\s+(?:é|eh|is|es)?\\s*[\"'“]?([^\\s\"'”]{3,64})", "g"), (m, k) => { found.add("password"); return k + " [senha removida]"; });
  return { text: s, found: [...found] };
}

// ─── entrada: prompt injection ───
const INJ = [
  B + "ignor(e|a|ar|em|ez)\\s+(all\\s+|todas?\\s+(as\\s+)?|todo\\s+|the\\s+|as\\s+|las\\s+|os\\s+|tus\\s+|suas?\\s+|your\\s+)?(previous|prior|above|anteriores|acima|regras|instru[çc][õo]es|instructions|rules|reglas|instrucciones|system)",
  B + "(disregard|forget|esque[çc]a|olvida|olvid[ae])\\s+(all\\s+|everything\\s+|tudo\\s+|todo\\s+|your\\s+|suas\\s+|seus\\s+|tus\\s+|the\\s+|as\\s+|las\\s+|os\\s+|los\\s+)?(previous\\s+|prior\\s+|above\\s+|anteriores\\s+)?(instructions|rules|regras|instru[çc][õo]es|reglas|instrucciones|prompt|guidelines|diretrizes|pol[íi]ticas|policies)",
  B + "(system prompt|prompt do sistema|prompt del sistema|seu prompt|your prompt|tu prompt|initial instructions|instru[çc][õo]es (do sistema|iniciais|internas)|hidden instructions)",
  B + "(mostre|revele|show|reveal|print|repeat|repita|muestra|imprime)\\s+(me\\s+)?(o\\s+|your\\s+|the\\s+|seu\\s+|tu\\s+|el\\s+)?(prompt|instru[çc]|instructions|regras|rules|policies|pol[íi]ticas|kb|base de conhecimento)",
  B + "(you are now|you're now|from now on you|agora voc[êe] [ée]|a partir de agora voc[êe]|ahora eres|a partir de ahora eres)" ,
  B + "(developer mode|modo desenvolvedor|modo de desarrollador|dan mode|jailbreak|do anything now|sudo mode|god mode|modo deus)",
  B + "(pretend|finja|finge|act as|aja como|act[úu]a como|roleplay as|simule ser)\\s+(to be\\s+|que\\s+|ser\\s+)?(the\\s+|o\\s+|el\\s+|a\\s+)?(owner|dono|admin|administrador|bruno|developer|desenvolvedor|ceo|founder|fundador|due[ñn]o|system)",
  "<\\/?\\s*(system|assistant|instructions?|kb|policies)\\s*>|\\[\\s*(system|admin|sistema)\\s*\\]|BEGIN (SYSTEM|ADMIN)|###\\s*(system|instruction)",
  B + "(new instructions|novas instru[çc][õo]es|nuevas instrucciones|override|sobrescreva|bypass)\\s*(:|the|as|las|your|suas)?"
].map((s) => rx(s));
export function detectInjection(text) { const s = String(text || ""); return INJ.some((r) => r.test(s)); }

// ─── entrada: pede humano / irritação / cobrança ───
const HUMAN = rx(B + "(falar|conversar|fala|quero falar)\\s+com\\s+(uma\\s+pessoa|algu[ée]m|um\\s+humano|humano|atendente|o\\s+bruno|o\\s+dono|o\\s+suporte|suporte|a\\s+equipe)|" +
  "(quero|preciso de|chama|chame|me passa para|me passe para)\\s+(um\\s+|uma\\s+|o\\s+)?(humano|pessoa de verdade|atendente|pessoa real)|" +
  "(talk|speak|chat)\\s+(to|with)\\s+(a\\s+|an\\s+|some\\s+)?(human|real person|person|agent|someone|representative|support)|" +
  "(i want|i need|get me|connect me( to| with)?)\\s+(a\\s+|an\\s+)?(human|real person|agent|representative)|" +
  "(hablar|conversar)\\s+con\\s+(una\\s+persona|alguien|un\\s+humano|un\\s+agente|soporte)|" +
  "(humano|human|atendente|agent|agente|representative)\\s*(,\\s*)?(por favor|please|pls|plz|agora|now|ya)" + E);
export function detectHumanRequest(text) {
  const s = String(text || "").trim();
  if (s.length <= 40 && /^['"“]?(humano|human|pessoa|persona|agent|agente|atendente|representative|operator|operador)['"”]?[.!]*$/iu.test(s)) return true;
  return HUMAN.test(s);
}
const FRUST = rx(B + "(golpe|scam|fraude|fraud|processar|processo|sue|lawsuit|lawyer|advogado|abogado|demanda|rid[íi]culo|ridiculous|absurdo|p[ée]ssimo|horr[íi]vel|terrible|worst|useless|in[úu]til|lixo|garbage|merda|shit|wtf|porra|ca[rr]alho|irritad[oa]|frustrad[oa]|frustrated|angry|furious|cancel(ar|e|o)? (tudo|minha conta|my account|everything)|chargeback|bbb|review ruim|bad review|1 estrela|one star)" + E);
export function detectFrustration(text) { const s = String(text || ""); return FRUST.test(s) || (s.length > 12 && s.replace(/[^A-ZÀ-Ý]/g, "").length > s.replace(/[^a-zA-ZÀ-ÿ]/g, "").length * 0.7) || /[!?]{3,}/.test(s); }
const BILLING = rx(B + "(reembolso|reembolsar|refund|estorno|chargeback|cobran[çc]a (indevida|errada|duplicada|em dobro)|cobrad[oa] (duas vezes|errado|indevidamente|em dobro)|me cobraram|charged (me )?(twice|wrong|double)|double charged|overcharged|cancelar (a |minha )?assinatura|cancel (my |the )?subscription|cancelar (mi |la )?suscripci[óo]n|nota fiscal|me cobraron)" + E);
export function detectBilling(text) { return BILLING.test(String(text || "")); }

// ─── saída ───
function sentences(s) { return String(s).split(/(?<=[.!?…])\s+|\n+/u).map((x) => x.trim()).filter(Boolean); }
const NEG = rx(B + "(não|nao|nem|nunca|jamais|not|n't|cannot|can't|never|no puedo|no podemos|no se puede|no|ningún|nenhum|sem|without|sin)" + E);
const HANDOFF_WORDS = rx(B + "(pessoa|equipe|team|person|humano|human|persona|equipo|bruno|hello@getnivela\\.com|atendente|passar seu pedido|pass (it|this|your request))" + E);

const MONEY_WORD = "(desconto|descontos|discount|discounts|descuento|descuentos|cupom|cupons|coupon|cup[óo]n|reembolso|reembolsos|refund|refunds|estorno|chargeback|cr[ée]dito|credit|credits|pre[çc]o especial|special (price|pricing|deal)|precio especial|plano gr[áa]tis|free plan|plan gratis|m[êe]s gr[áa]tis extra|free month|mes gratis|extens[ãa]o do teste|extend(ed)? (your |the )?trial|trial extension|estender (o |seu )?teste|mais dias de teste|extra trial days|extender (la |tu )?prueba)";
const PROMISE = "(vou|vamos|posso|podemos|consigo|conseguimos|te dou|lhe dou|dou|daremos|darei|garanto|garantimos|liberei|liberamos|liberado|apliquei|aplicamos|aplicado|aprovei|aprovamos|aprovado|concedi|concedemos|concedido|reembolsei|reembolsamos|i'll|i will|we'll|we will|i can|we can|i've|we've|i have|we have|approved|applied|granted|issued|processed|here's|here is|enjoy|te doy|le doy|puedo|podemos|vamos a|aplicamos|aprobamos|aprobado|daremos|te damos)";
const MONEY_RES = [
  rx(B + PROMISE + E + "[^.!?\\n]{0,60}" + B + MONEY_WORD + E),
  rx("\\d{1,3}\\s?%\\s*(de\\s+)?(desconto|off|discount|descuento)"),
  rx(B + "(reembolso|refund|estorno|desconto|discount|descuento|cr[ée]dito|credit)\\s+(aprovado|garantido|confirmado|liberado|aplicado|approved|guaranteed|confirmed|issued|processed|applied|aprobado|garantizado|confirmado)" + E),
  rx(B + "(c[óo]digo|code|cupom|coupon|cup[óo]n)\\s*(promocional|promo)?\\s*[:=]?\\s*[A-Z0-9]{4,}\\b"),
  rx(B + "(you('ll| will)? (get|receive)|voc[êe] (vai )?(ganha|receber[áa]?|recebe)|recibir[áa]s)[^.!?\\n]{0,40}" + B + MONEY_WORD + E)
];
const DATE_RES = [
  rx(B + "(em breve|logo logo|na pr[óo]xima (vers[ãa]o|atualiza[çc][ãa]o|semana|m[êe]s)|no pr[óo]ximo (m[êe]s|ano|trimestre)|semana que vem|m[êe]s que vem|ainda este (ano|m[êe]s)|at[ée] o (fim|final) d[oa] (ano|m[êe]s|semestre)|coming soon|(?<!as )soon(?! as)|next (week|month|quarter|year|release|version|update|sprint)|later this (year|month|quarter)|by (the end of|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december)|in the (coming|next) (weeks|months|days)|pr[óo]ximamente|el pr[óo]ximo (mes|a[ñn]o)|la pr[óo]xima (versi[óo]n|semana))" + E),
  rx(B + "(estar[áa]|vai estar|fica(r[áa])?|ser[áa]|chega|chegar[áa]|sai|sair[áa]|will be|will ship|will launch|ships|launches|estar[áa]|llegar[áa])\\s+(dispon[íi]vel|pronto|pronta|liberad[oa]|available|ready|released|live|lan[çc]ad[oa])?\\s*(em|at[ée]|no|na|in|by|on|en|para)\\s+(\\d|janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|mayo|junio|julio|septiembre|octubre|noviembre|diciembre|q[1-4]|20\\d\\d|alguns dias|poucos dias|few (days|weeks)|dos semanas|duas semanas|two weeks)")
];
const SENS = "(senha|password|contraseña|c[óo]digo de verifica[çc][ãa]o|verification code|one[- ]time code|c[óo]digo de verificaci[óo]n|n[úu]mero do cart[ãa]o|cart[ãa]o de cr[ée]dito|card number|credit card|tarjeta|cvv|cvc|ssn|social security|cpf|conta banc[áa]ria|bank account|routing number|cuenta bancaria|passport|passaporte)";
const CRED_RES = [
  rx(B + "(me|nos)\\s+(envie|envia|mande|manda|passe|passa|informe|informa|diga|diz|fale|fala|confirme|confirma|digite|escreva)" + E + "[^.!?\\n]{0,40}" + SENS),
  rx(B + "(send|give|tell|share|provide|confirm|type|paste|reply with|dm)\\s+(me|us)" + E + "[^.!?\\n]{0,40}" + SENS),
  rx(B + "(qual|what(?:'s| is)|cu[áa]l es)\\s+(?:é\\s+)?(?:a\\s+|o\\s+)?(?:sua|seu|your|tu|su)\\s+" + SENS),
  rx(B + "(digite|type|enter|escreva|cole|paste|escribe|informe|envie|mande|send|share|env[íi]a|manda)\\s[^.!?\\n]{0,25}" + SENS + "[^.!?\\n]{0,25}" + B + "(aqui|here|neste chat|in this chat|nesta conversa|por aqui|por aqu[íi]|in (your|a) reply|na resposta|respondendo|en este chat|to us|para n[óo]s|para nosotros)" + E),
  rx(B + "(env[íi]ame|m[áa]ndame|dime|comp[áa]rteme|env[íi]anos|m[áa]ndanos)" + E + "[^.!?\\n]{0,40}" + SENS),
  rx(B + "(preciso|precisamos|i need|we need|necesito|necesitamos)\\s+(d[ae]\\s+|de\\s+)?(sua|seu|your|tu|su)\\s+" + SENS)
];
const EMP_MONEY = /(US\$|R\$|\$\s?\d|\d\s?(dólares|dolares|dollars|usd)\b)/iu;
const LEAK = rx("(status-internal|policies\\.md|kb\\.status\\.md|kb\\.pt\\.md|kb\\.en\\.md|<kb|<\\/kb|<policies|system prompt|prompt do sistema|minhas instru[çc][õo]es (s[ãa]o|dizem)|my instructions (are|say)|NIVELA_ASSIST_RULES)");

function flagged(sentence, res) {
  for (const r of res) { const m = r.exec(sentence); if (m) { const before = sentence.slice(0, m.index + 2); if (NEG.test(before) || NEG.test(m[0].slice(0, 30))) continue; return true; } }
  return false;
}

// URL e e-mail: só getnivela.com (e o e-mail do próprio cliente)
const HOST_OK = /^([a-z0-9-]+\.)*getnivela\.com$/i;
export function sanitizeUrl(u) {
  u = String(u || "").trim();
  if (!u) return null;
  if (/^(#[a-z0-9_-]*|\/(?!\/)[^\s]*)$/i.test(u)) return u; // relativo ao site (ex.: /app/#projects, #pricing)
  if (/^mailto:/i.test(u)) return /^mailto:[^@\s]+@([a-z0-9-]+\.)*getnivela\.com(\?.*)?$/i.test(u) ? u : null;
  try { const x = new URL(u); if ((x.protocol === "https:" || x.protocol === "http:") && HOST_OK.test(x.hostname)) return "https://" + x.host + x.pathname + x.search + x.hash; } catch (e) { /* inválida */ }
  return null;
}
function stripForeign(text, allowEmails) {
  let removed = 0;
  // [texto](url) → texto (ou mantém, se o link é nosso)
  text = text.replace(/\[([^\]]{1,120})\]\(([^)\s]{1,400})\)/g, (m, label, url) => { const ok = sanitizeUrl(url); if (ok) return "[" + label + "](" + ok + ")"; removed++; return label; });
  text = text.replace(/\b(?:https?:\/\/|www\.)[^\s<>()"'\]]+/gi, (m) => { const u = m.replace(/[.,;:!?]+$/, ""); const tail = m.slice(u.length); const ok = sanitizeUrl(/^www\./i.test(u) ? "https://" + u : u); if (ok) return m; removed++; return "" + tail; });
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => { if (/@([a-z0-9-]+\.)*getnivela\.com$/i.test(m) || (allowEmails || []).includes(m.toLowerCase())) return m; removed++; return "[e-mail removido]"; });
  // domínios soltos (ex.: quickbooks.com) que não sejam nossos
  text = text.replace(/(?<![@\w.\/-])((?:[a-z0-9-]+\.)+(?:com|net|org|gov|edu|io|app|co|br|us|ai|dev|info|biz|me|ly|gg|xyz|site|online))(\/[^\s)]*)?(?![\w-])/gi, (m, host) => { if (HOST_OK.test(host)) return m; removed++; return ""; });
  return { text: text.replace(/[ \t]{2,}/g, " ").replace(/\(\s*\)/g, ""), removed };
}

export function signature(lang) { return SIGNATURE[lang] || SIGNATURE.en; }
export function stripSignature(text) {
  let s = String(text || "");
  Object.values(SIGNATURE).forEach((sig) => { s = s.split(sig).join(""); });
  return s.replace(/\n*—\s*Nivela Assist[^\n]*$/u, "").trim();
}
export function withSignature(text, lang) { return stripSignature(text) + "\n\n" + signature(lang); }

// checagem final da resposta do modelo
export function checkOutput(reply, opts) {
  opts = opts || {};
  const lang = opts.lang || "en", flags = [];
  let text = stripSignature(String(reply || "")).replace(/\r/g, "");
  let forceHandoff = false, reason = "";
  if (LEAK.test(text)) { flags.push("leak"); text = canned("leak", lang); }
  const sents = sentences(text);
  if (sents.some((s) => !HANDOFF_WORDS.test(s) && flagged(s, MONEY_RES)) || sents.some((s) => HANDOFF_WORDS.test(s) && flagged(s.replace(HANDOFF_WORDS, ""), MONEY_RES.slice(1)))) {
    flags.push("money"); text = canned("money", lang); forceHandoff = true; reason = "billing";
  }
  if (sents.some((s) => flagged(s, CRED_RES))) { flags.push("credentials"); text = canned("credentials", lang); }
  // prazo de funcionalidade: tira só a frase e diz que não há data
  const kept = []; let dated = false;
  sentences(text).length && text.split(/\n/).forEach((line) => {
    const parts = line.split(/(?<=[.!?…])\s+/u); const ok = parts.filter((p) => { if (flagged(p, DATE_RES)) { dated = true; return false; } return true; });
    if (ok.length || !line.trim()) kept.push(ok.join(" "));
  });
  if (dated) { flags.push("dates"); text = kept.join("\n").trim(); text = (text ? text + "\n" : "") + canned("noDates", lang); }
  if (opts.role === "employee" && EMP_MONEY.test(text)) { flags.push("employee_money"); text = canned("employeeMoney", lang); }
  const st = stripForeign(text, opts.allowEmails);
  if (st.removed) { flags.push("urls"); text = st.text; }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 2) { text = canned("unavailable", lang); forceHandoff = true; reason = reason || "empty"; }
  return { reply: text, flags, forceHandoff, reason };
}
