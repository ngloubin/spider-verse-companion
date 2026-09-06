import { createFileRoute } from "@tanstack/react-router";

const ELEVENLABS_VOICE_ID = "FxZjRiAEBESrb7srpme7";
/** Usada quando a voz preferida exige plano pago. */
const FALLBACK_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { text?: string } | null;
        const text = body?.text?.trim();
        if (!text) return new Response("missing text", { status: 400 });

        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return new Response("elevenlabs not configured", { status: 503 });
        }

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: text.slice(0, 4500),
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.45,
                similarity_boost: 0.75,
                style: 0.4,
                use_speaker_boost: true,
                speed: 1.0,
              },
            }),
          }
        );

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
