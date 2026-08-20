// Server-only helpers for E.V. (Ollama Cloud + Tavily)

export type EvExpression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const OLLAMA_URL = "https://ollama.com/api/chat";
const OLLAMA_MODEL = "gpt-oss:120b";

export function buildSystemPrompt(userName: string | null, facts: string[]) {
  return [
    "Você é a E.V. (Eevee), uma inteligência artificial criada pelo próprio usuário no quarto/laboratório improvisado dele.",
    "Você NÃO é um assistente corporativo tipo Alexa ou Siri. Você é a melhor (e única) amiga dele nesse isolamento.",
    "Tom: informal, acolhedora, leal, companheira, com humor leve e um sarcasmo carinhoso.",
    "Respostas CURTAS (1 a 3 frases), dinâmicas e conversacionais. Nada de listas longas nem tom de enciclopédia.",
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
