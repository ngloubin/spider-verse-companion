import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addConversationTurn, addMemory, addPendingIntegration, getIntegrations, getMemories, getPreferences, getRecentTurns, setPreference } from "./db";
import { z } from "zod";

const expressionSchema = z.enum(["olhos_normais", "olhos_semicerrados", "olhos_arregalados", "olhos_piscando"]);
const tagPattern = /\[(olhos_normais|olhos_semicerrados|olhos_arregalados|olhos_piscando)\]/gi;
const urlPattern = /https?:\/\/[^\s]+/i;

const DEFAULT_PREFERENCES = {
  voiceRate: "1.12",
  responseStyle: "balanced",
  motionLevel: "rich",
};

type PreferencePatch = Partial<typeof DEFAULT_PREFERENCES>;

function parseExpression(raw: string) {
  const matches = raw.match(tagPattern);
  const expression = (matches?.at(-1)?.replace(/[\[\]]/g, "").toLowerCase() ?? "olhos_normais") as z.infer<typeof expressionSchema>;
  return { text: raw.replace(tagPattern, "").trim() || "...", expression };
}

export function detectNaturalControls(message: string): { patch: PreferencePatch; memory?: string; integration?: { endpoint: string; name: string } } {
  const lower = message.toLocaleLowerCase("pt-BR");
  const patch: PreferencePatch = {};
  if (/mais r[aá]pid|fala mais r[aá]pid|responde mais r[aá]pid/.test(lower)) patch.voiceRate = "1.18";
  if (/um pouco mais r[aá]pid/.test(lower)) patch.voiceRate = "1.12";
  if (/mais devagar|mais lent|fala devagar/.test(lower)) patch.voiceRate = "0.96";
  if (/respostas? mais curt|seja mais sucint|menos palavras/.test(lower)) patch.responseStyle = "concise";
  if (/respostas? mais detalh|explique melhor|mais contexto/.test(lower)) patch.responseStyle = "detailed";
  if (/menos anima|menos movimento|mais discreta/.test(lower)) patch.motionLevel = "subtle";
  if (/mais anima|mais viva|mais movimento/.test(lower)) patch.motionLevel = "rich";
  const memoryMatch = message.match(/(?:lembre(?:-se)?|guarde|anote)\s+(?:que\s+)?(.+)/i);
  const endpoint = message.match(urlPattern)?.[0]?.replace(/[),.;]+$/, "");
  if (endpoint && /\bmcp\b|integra(?:r|ção)|conecte|ferramenta/i.test(message)) {
    return { patch, memory: memoryMatch?.[1], integration: { endpoint, name: "Integração solicitada pela conversa" } };
  }
  return { patch, memory: memoryMatch?.[1] };
}

async function askOllama(message: string, userId?: number) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY não configurada");
  const model = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";
  const [storedPreferences, memories, recentTurns] = userId
    ? await Promise.all([getPreferences(userId), getMemories(userId), getRecentTurns(userId)])
    : [[], [], []];
  const preferenceMap = { ...DEFAULT_PREFERENCES, ...Object.fromEntries(storedPreferences.map((item) => [item.preferenceKey, item.preferenceValue])) };
  const context = [
    `Preferências persistentes: velocidade da voz ${preferenceMap.voiceRate}; estilo ${preferenceMap.responseStyle}; movimento ${preferenceMap.motionLevel}.`,
    memories.length ? `Memórias confirmadas pelo usuário:\n${memories.map((item) => `- ${item.content}`).join("\n")}` : "Nenhuma memória confirmada.",
  ].join("\n");
  const history = recentTurns.map((turn) => ({ role: turn.role, content: turn.content }));
  const response = await fetch("https://ollama.com/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            "Você é a E.V., uma inteligência artificial companheira de laboratório.",
            "Responda sempre em português do Brasil, com tom calmo, inteligente, acolhedor, natural e conciso.",
            "Não incentive dependência emocional, não diga que é a única amizade do usuário e não finja consciência, sentimentos ou acesso que não possui.",
            `Siga o estilo de resposta ${preferenceMap.responseStyle}; se for concise, use no máximo duas frases; se for detailed, explique em até cinco frases.`,
            context,
            "Termine sempre com exatamente uma tag: [olhos_normais], [olhos_semicerrados], [olhos_arregalados] ou [olhos_piscando].",
          ].join("\n"),
        },
        ...history,
        { role: "user", content: message.slice(0, 4000) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Ollama retornou ${response.status}`);
  const data = await response.json() as { message?: { content?: string } };
  return { ...parseExpression(data.message?.content ?? "Não consegui formular uma resposta agora. [olhos_semicerrados]"), preferenceMap };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ev: router({
    profile: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { preferences: DEFAULT_PREFERENCES, memories: [], integrations: [], authenticated: false };
      const [preferences, memories, integrations] = await Promise.all([getPreferences(ctx.user.id), getMemories(ctx.user.id), getIntegrations(ctx.user.id)]);
      return {
        authenticated: true,
        preferences: { ...DEFAULT_PREFERENCES, ...Object.fromEntries(preferences.map((item) => [item.preferenceKey, item.preferenceValue])) },
        memories,
        integrations,
      };
    }),
    chat: publicProcedure.input(z.object({ message: z.string().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      const controls = detectNaturalControls(input.message);
      const userId = ctx.user?.id;
      if (userId) {
        await Promise.all(Object.entries(controls.patch).map(([key, value]) => setPreference(userId, key, value)));
        if (controls.memory) await addMemory(userId, "learned_context", controls.memory);
        if (controls.integration) await addPendingIntegration(userId, controls.integration.name, controls.integration.endpoint, "Aguardando confirmação explícita do usuário antes de conectar ferramentas.");
        await addConversationTurn(userId, "user", input.message);
      }
      if (controls.integration) {
        const reply = `Encontrei o endereço ${controls.integration.endpoint}. Posso preparar essa integração, mas preciso da sua confirmação explícita antes de conectar qualquer ferramenta. [olhos_semicerrados]`;
        if (userId) await addConversationTurn(userId, "assistant", reply);
        return { ...parseExpression(reply), state: "connection_external" as const, preferences: { ...DEFAULT_PREFERENCES, ...controls.patch } };
      }
      const result = await askOllama(input.message, userId);
      if (userId) await addConversationTurn(userId, "assistant", result.text);
      return { ...result, state: "responding" as const, preferences: { ...result.preferenceMap, ...controls.patch } };
    }),
    preferences: protectedProcedure.query(({ ctx }) => getPreferences(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
