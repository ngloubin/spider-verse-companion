import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { text?: string } | null;
        const text = body?.text?.trim();
        if (!text) return new Response("missing text", { status: 400 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text.slice(0, 3000),
            voice: "shimmer",
            instructions:
              "Voz feminina jovem, calorosa e levemente sarcástica, tom de amiga próxima conversando em português do Brasil. Natural, sem pressa robótica.",
            stream_format: "sse",
            response_format: "pcm",
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          return new Response(detail || "tts failed", { status: res.status });
        }

        return new Response(res.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
