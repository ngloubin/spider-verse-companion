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
    const { normalizePrefs, DEFAULT_PREFS } = await import("./ev.server");

    const { data: session } = await supabaseAdmin
      .from("ev_sessions")
      .select("id, user_name, memory_facts, preferences")
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (!session) {
      return {
        userName: null as string | null,
        messages: [] as any[],
        prefs: DEFAULT_PREFS,
        facts: [] as string[],
        integrations: [] as any[],
      };
    }

    const [{ data: rows }, { data: integrations }] = await Promise.all([
      supabaseAdmin
        .from("ev_messages")
        .select("id, role, content, expression, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true })
        .limit(200),
      supabaseAdmin
        .from("ev_integrations")
        .select("id, name, endpoint, kind, status, description")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
    ]);

    return {
      userName: session.user_name,
      messages: rows ?? [],
      prefs: normalizePrefs((session as any).preferences),
      facts: ((session.memory_facts ?? []) as string[]).slice(-12),
      integrations: integrations ?? [],
    };
  });

export const evSend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      buildSystemPrompt,
      callOllama,
      detectMcpCommand,
      detectPreferenceCommand,
      extractName,
      needsSearch,
      normalizePrefs,
      parseExpression,
      tavilySearch,
    } = await import("./ev.server");

    // session (create on first contact)
    let { data: session } = await supabaseAdmin
      .from("ev_sessions")
      .select("id, user_name, memory_facts, preferences")
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (!session) {
      const inserted = await supabaseAdmin
        .from("ev_sessions")
        .insert({ device_id: data.deviceId })
        .select("id, user_name, memory_facts, preferences")
        .single();
      session = inserted.data;
    }
    if (!session) throw new Error("Não consegui abrir a memória da E.V.");

    const prefs = normalizePrefs((session as any).preferences);
    const name = extractName(data.message) ?? session.user_name;
    const priorFacts = (session.memory_facts ?? []) as string[];

    const persistTurn = async (assistantText: string, expression: string) => {
      await supabaseAdmin.from("ev_messages").insert([
        { session_id: session!.id, role: "user", content: data.message },
        { session_id: session!.id, role: "assistant", content: assistantText, expression },
      ]);
    };

    /* 1. Ajuste de preferência dito em linguagem natural. */
    const prefCmd = detectPreferenceCommand(data.message, prefs);
    if (prefCmd) {
      await supabaseAdmin
        .from("ev_sessions")
        .update({ preferences: prefCmd.prefs as any, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      await persistTurn(prefCmd.reply, prefCmd.expression);
      return {
        text: prefCmd.reply,
        expression: prefCmd.expression,
        userName: name ?? null,
        searched: false,
        prefs: prefCmd.prefs,
        kind: "preference" as const,
      };
    }

    /* 2. Conexão de uma integração (MCP) pedida na conversa. */
    const mcp = detectMcpCommand(data.message);
    if (mcp) {
      await supabaseAdmin.from("ev_integrations").upsert(
        {
          session_id: session.id,
          name: mcp.name,
          endpoint: mcp.endpoint,
          description: mcp.description,
          kind: "mcp",
          status: "pending",
        } as any,
        { onConflict: "id" },
      );
      const reply = `Guardei a integração ${mcp.name}. Ela fica pendente até você confirmar — me diga "confirma a integração ${mcp.name}" quando quiser que eu use as ferramentas dela.`;
      await persistTurn(reply, "olhos_semicerrados");
      return {
        text: reply,
        expression: "olhos_semicerrados" as const,
        userName: name ?? null,
        searched: false,
        prefs,
        kind: "tool" as const,
      };
    }

    /* 3. Confirmação de uma integração pendente. */
    const confirm = data.message.match(/confirm\w*\s+(?:a\s+)?(?:integra\w+|mcp)\s+([^\s.,]+)/i);
    if (confirm?.[1]) {
      const { data: updated } = await supabaseAdmin
        .from("ev_integrations")
        .update({ status: "ready", updated_at: new Date().toISOString() } as any)
        .eq("session_id", session.id)
        .ilike("name", `%${confirm[1]}%`)
        .select("name");
      const reply = updated?.length
        ? `Integração ${updated[0]!.name} confirmada e ativa.`
        : "Não achei nenhuma integração pendente com esse nome.";
      await persistTurn(reply, updated?.length ? "olhos_arregalados" : "olhos_semicerrados");
      return {
        text: reply,
        expression: updated?.length ? "olhos_arregalados" : "olhos_semicerrados",
        userName: name ?? null,
        searched: false,
        prefs,
        kind: "tool" as const,
      };
    }

    /* 4. Conversa normal. */
    const { data: history } = await supabaseAdmin
      .from("ev_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(24);

    let searchContext: string | null = null;
    if (needsSearch(data.message)) {
      searchContext = await tavilySearch(data.message);
    }

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(name, priorFacts, prefs) },
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
        prefs,
        kind: "error" as const,
      };
    }

    const { text, expression } = parseExpression(raw);
    await persistTurn(text, expression);

    const newFacts = priorFacts.slice(-19);
    if (data.message.length > 20) newFacts.push(data.message.slice(0, 160));
    await supabaseAdmin
      .from("ev_sessions")
      .update({ user_name: name ?? null, memory_facts: newFacts, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    return {
      text,
      expression,
      userName: name ?? null,
      searched: Boolean(searchContext),
      prefs,
      kind: "chat" as const,
    };
  });
