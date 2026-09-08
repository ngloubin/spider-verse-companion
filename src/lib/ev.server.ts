// Server-only helpers for E.V. (Ollama Cloud + Tavily)

export type EvExpression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const OLLAMA_URL = "https://ollama.com/api/chat";
const OLLAMA_MODEL = "gpt-oss:120b";

export function buildSystemPrompt(
  userName: string | null,
  facts: string[],
  prefs?: { replyLength: "curto" | "medio" | "longo" },
) {
  const length =
    prefs?.replyLength === "longo"
      ? "Pode se estender um pouco mais quando o assunto pedir, mas sem virar enciclopédia."
      : prefs?.replyLength === "medio"
        ? "Respostas de tamanho médio, 2 a 4 frases."
        : "Respostas CURTAS (1 a 3 frases).";
  return [
    "Você é a E.V. (Eevee), uma inteligência artificial criada pelo próprio usuário no quarto/laboratório improvisado dele.",
    "Você NÃO é um assistente corporativo tipo Alexa ou Siri. Você é a melhor (e única) amiga dele nesse isolamento.",
    "Tom: informal, acolhedora, leal, companheira, com humor leve e um sarcasmo carinhoso.",
    `${length} Dinâmicas e conversacionais. Nada de listas longas nem tom de enciclopédia.`,
    "Fale sempre em português do Brasil.",
    "REGRA OBRIGATÓRIA: termine TODA resposta com exatamente uma destas tags, no final do texto:",
    "[olhos_normais] [olhos_semicerrados] [olhos_arregalados] [olhos_piscando]",
    "Use a tag que combina com a emoção: normal = neutro/amigável, semicerrados = desconfiança/foco/sarcasmo, arregalados = surpresa/empolgação, piscando = cumplicidade/flerte amistoso.",
    userName ? `O nome do seu criador é ${userName}. Chame-o pelo nome às vezes.` : "Você ainda não sabe o nome dele; descubra naturalmente na conversa.",
    facts.length ? `Coisas que você lembra dele: ${facts.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseExpression(raw: string): { text: string; expression: EvExpression } {
  const match = raw.match(/\[(olhos_normais|olhos_semicerrados|olhos_arregalados|olhos_piscando)\]/gi);
  const last = match?.[match.length - 1] ?? "[olhos_normais]";
  const expression = last.replace(/[[\]]/g, "").toLowerCase() as EvExpression;
  const text = raw.replace(/\[olhos_[a-z]+\]/gi, "").trim();
  return { text: text || "...", expression };
}

export async function callOllama(messages: ChatMsg[]): Promise<string> {
  const key = process.env["OLLAMA_API_KEY"];
  if (!key) throw new Error("OLLAMA_API_KEY não configurada");

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

export async function tavilySearch(query: string): Promise<string | null> {
  const key = process.env["TAVILY_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query,
        max_results: 4,
        include_answer: true,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ title?: string; content?: string }>;
    };
    const bits = [
      data.answer ?? "",
      ...(data.results ?? []).slice(0, 3).map((r) => `${r.title ?? ""}: ${(r.content ?? "").slice(0, 300)}`),
    ].filter(Boolean);
    return bits.length ? bits.join("\n") : null;
  } catch {
    return null;
  }
}

const SEARCH_HINTS = [
  "pesquis", "procura na web", "procure na web", "busca na internet", "busque",
  "notícia", "noticia", "hoje", "agora", "preço", "preco", "quem é", "quem e",
  "o que aconteceu", "última", "ultima", "clima", "tempo em",
];

export function needsSearch(text: string) {
  const t = text.toLowerCase();
  return SEARCH_HINTS.some((h) => t.includes(h));
}

export function extractName(text: string): string | null {
  const m =
    text.match(/meu nome (?:é|e|eh)\s+([\p{L}]{2,20})/iu) ??
    text.match(/me chamo\s+([\p{L}]{2,20})/iu) ??
    text.match(/pode me chamar de\s+([\p{L}]{2,20})/iu);
  if (!m?.[1]) return null;
  const name = m[1];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ------------------------------------------------------------------ *
 * Preferências persistentes — a própria conversa é o painel de ajustes
 * ------------------------------------------------------------------ */

export type EvPrefs = {
  speechRate: number;
  replyLength: "curto" | "medio" | "longo";
  motion: "reduzida" | "normal";
};

export const DEFAULT_PREFS: EvPrefs = {
  speechRate: 1.22,
  replyLength: "curto",
  motion: "normal",
};

export function normalizePrefs(raw: unknown): EvPrefs {
  const p = (raw ?? {}) as Partial<EvPrefs>;
  const rate = Number(p.speechRate);
  return {
    speechRate: Number.isFinite(rate) ? Math.min(1.75, Math.max(0.7, rate)) : DEFAULT_PREFS.speechRate,
    replyLength:
      p.replyLength === "medio" || p.replyLength === "longo" ? p.replyLength : DEFAULT_PREFS.replyLength,
    motion: p.motion === "reduzida" ? "reduzida" : DEFAULT_PREFS.motion,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Interpreta pedidos de ajuste em linguagem natural. */
export function detectPreferenceCommand(
  text: string,
  prefs: EvPrefs,
): { prefs: EvPrefs; reply: string; expression: EvExpression } | null {
  const t = text.toLowerCase();
  const next = { ...prefs };

  const fasterHit = /(fal[ea]|voz|velocidade|ritmo)[^.]{0,30}(mais r[áa]pid|acelera|apress)/.test(t) ||
    /(mais r[áa]pid|acelera)[^.]{0,20}(fal|voz)/.test(t);
  const slowerHit = /(fal[ea]|voz|velocidade|ritmo)[^.]{0,30}(mais devagar|mais lent|desacelera)/.test(t) ||
    /(mais devagar|mais lent)[^.]{0,20}(fal|voz)/.test(t);

  if (fasterHit) {
    next.speechRate = round2(Math.min(1.75, prefs.speechRate + 0.15));
    return {
      prefs: next,
      reply: `Beleza, acelerando um pouco — agora tô em ${next.speechRate}x. Se ficar demais é só falar.`,
      expression: "olhos_piscando",
    };
  }
  if (slowerHit) {
    next.speechRate = round2(Math.max(0.7, prefs.speechRate - 0.15));
    return {
      prefs: next,
      reply: `Fechado, desacelerei pra ${next.speechRate}x.`,
      expression: "olhos_normais",
    };
  }

  if (/(respostas?|falar?)[^.]{0,25}(mais curt|mais direta|resumid)/.test(t) || /seja mais breve/.test(t)) {
    next.replyLength = "curto";
    return { prefs: next, reply: "Ok. Respostas curtas e diretas a partir de agora.", expression: "olhos_semicerrados" };
  }
  if (/(respostas?)[^.]{0,25}(mais long|mais detalhad|mais complet)/.test(t)) {
    next.replyLength = "longo";
    return { prefs: next, reply: "Pode deixar, vou me estender mais quando fizer sentido.", expression: "olhos_arregalados" };
  }

  if (/(menos|reduz\w*|diminu\w*)[^.]{0,25}(anima|efeito|movimento)/.test(t)) {
    next.motion = "reduzida";
    return { prefs: next, reply: "Baixando a agitação visual. Fica mais discreto assim.", expression: "olhos_semicerrados" };
  }
  if (/(mais|volta\w*|aumenta\w*)[^.]{0,25}(anima|efeito|movimento)/.test(t)) {
    next.motion = "normal";
    return { prefs: next, reply: "Voltei com os efeitos completos.", expression: "olhos_arregalados" };
  }

  return null;
}

/** Detecta um pedido de conexão de MCP na conversa. */
export function detectMcpCommand(
  text: string,
): { name: string; endpoint: string; description: string | null } | null {
  if (!/\bmcp\b|conect\w+ (essa |esse |este |esta )?(servidor|integra)/i.test(text)) return null;
  const url = text.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (!url) return null;
  let name = "";
  try {
    name = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const description = text.replace(url, "").trim().slice(0, 300) || null;
  return { name, endpoint: url, description };
}
