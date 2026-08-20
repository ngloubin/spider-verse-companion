import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SendInput = z.object({
  deviceId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

const HistoryInput = z.object({ deviceId: z.string().uuid() });

export const evHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HistoryInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("ev_sessions")
      .select("id, user_name")
      .eq("device_id", data.deviceId)
      .maybeSingle();
    if (!session) return { userName: null as string | null, messages: [] };

    const { data: rows } = await supabaseAdmin
      .from("ev_messages")
      .select("id, role, content, expression, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(200);

    return { userName: session.user_name, messages: rows ?? [] };
  });

export const evSend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      buildSystemPrompt,
      callOllama,
      extractName,
      needsSearch,
      parseExpression,
      tavilySearch,
    } = await import("./ev.server");

    // session (create on first contact)
    let { data: session } = await supabaseAdmin
      .from("ev_sessions")
      .select("id, user_name, memory_facts")
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (!session) {
      const inserted = await supabaseAdmin
        .from("ev_sessions")
        .insert({ device_id: data.deviceId })
        .select("id, user_name, memory_facts")
        .single();
      session = inserted.data;
    }
    if (!session) throw new Error("Não consegui abrir a memória da E.V.");

    const { data: history } = await supabaseAdmin
      .from("ev_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(24);

    const priorFacts = (session.memory_facts ?? []) as string[];
    const name = extractName(data.message) ?? session.user_name;

    let searchContext: string | null = null;
    if (needsSearch(data.message)) {
      searchContext = await tavilySearch(data.message);
    }

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(name, priorFacts) },
      ...(history ?? [])
        .slice()
        .reverse()
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ...(searchContext
        ? [
            {
              role: "system" as const,
              content: `Resultados de uma busca rápida na web (use com naturalidade, sem citar links longos):\n${searchContext}`,
            },
          ]
        : []),
      { role: "user" as const, content: data.message },
    ];

    let raw: string;
    try {
      raw = await callOllama(messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      return {
        text: `Perdi o sinal com meu núcleo... (${msg})`,
        expression: "olhos_semicerrados" as const,
        userName: name ?? null,
        searched: false,
      };
    }

    const { text, expression } = parseExpression(raw);

    await supabaseAdmin.from("ev_messages").insert([
      { session_id: session.id, role: "user", content: data.message },
      { session_id: session.id, role: "assistant", content: text, expression },
    ]);

    const newFacts = priorFacts.slice(-19);
    if (data.message.length > 20) newFacts.push(data.message.slice(0, 160));
    await supabaseAdmin
      .from("ev_sessions")
      .update({ user_name: name ?? null, memory_facts: newFacts, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    return { text, expression, userName: name ?? null, searched: Boolean(searchContext) };
  });
