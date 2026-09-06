import { createFileRoute } from "@tanstack/react-router";

/** Voz feminina brasileira (Fish Audio). */
const FISH_VOICE_ID = "5661bf8cb97740fcb10d2f756abf7779";
const FISH_MODEL = "s1";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { text?: string } | null;
        const text = body?.text?.trim();
        if (!text) return new Response("missing text", { status: 400 });

        const apiKey = process.env["FISH_AUDIO_API_KEY"];
        if (!apiKey) {
          return new Response("fish audio not configured", { status: 503 });
        }

        const res = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            model: FISH_MODEL,
          },
          body: JSON.stringify({
            text: text.slice(0, 4500),
            reference_id: FISH_VOICE_ID,
            format: "mp3",
            mp3_bitrate: 128,
            latency: "balanced",
            normalize: true,
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          return new Response(detail || "tts failed", { status: res.status || 502 });
        }

        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
