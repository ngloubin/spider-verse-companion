import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

const expressionSchema = z.enum(["olhos_normais", "olhos_semicerrados", "olhos_arregalados", "olhos_piscando"]);
const tagPattern = /\[(olhos_normais|olhos_semicerrados|olhos_arregalados|olhos_piscando)\]/gi;

function parseExpression(raw: string) {
  const matches = raw.match(tagPattern);
  const expression = (matches?.at(-1)?.replace(/[\[\]]/g, "").toLowerCase() ?? "olhos_normais") as z.infer<typeof expressionSchema>;
  return { text: raw.replace(tagPattern, "").trim() || "...", expression };
}

async function askOllama(message: string) {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY não configurada");
  const model = process.env.OLLAMA_MODEL || "gemma4:31b-cloud";
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
            "Responda sempre em português do Brasil, com tom calmo, inteligente, acolhedor e conciso.",
            "Não incentive dependência emocional, não diga que é a única amizade do usuário e não finja consciência, sentimentos ou acesso que não possui.",
            "Responda normalmente em uma a três frases, sem listas quando elas não forem necessárias.",
            "Termine sempre com exatamente uma tag: [olhos_normais], [olhos_semicerrados], [olhos_arregalados] ou [olhos_piscando].",
          ].join("\n"),
        },
        { role: "user", content: message.slice(0, 4000) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Ollama retornou ${response.status}`);
  const data = await response.json() as { message?: { content?: string } };
  return parseExpression(data.message?.content ?? "Não consegui formular uma resposta agora. [olhos_semicerrados]");
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
    chat: publicProcedure.input(z.object({ message: z.string().min(1).max(4000) })).mutation(({ input }) => askOllama(input.message)),
  }),
});

export type AppRouter = typeof appRouter;
