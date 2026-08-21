let ctx: AudioContext | null = null;
let currentAbort: AbortController | null = null;

function getCtx() {
  if (!ctx) ctx = new AudioContext({ sampleRate: 24000 });
  return ctx;
}

export function stopSpeech() {
  currentAbort?.abort();
  currentAbort = null;
  if (ctx) {
    void ctx.close().catch(() => undefined);
    ctx = null;
  }
}

/** Streams TTS audio from the backend and plays it as it arrives. */
export async function speakStream(text: string, onDone?: () => void): Promise<void> {
  stopSpeech();
  const controller = new AbortController();
  currentAbort = controller;

  const audio = getCtx();
  if (audio.state === "suspended") await audio.resume().catch(() => undefined);

  let playhead = 0;
  let pending = new Uint8Array(0);
  let lastEnd = 0;

  const playChunk = (incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, (s) => s / 32768);
    const buffer = audio.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    playhead = playhead === 0 ? audio.currentTime + 0.06 : Math.max(playhead, audio.currentTime);
    source.start(playhead);
    playhead += buffer.duration;
    lastEnd = playhead;
  };

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: controller.signal,
  });
  if (!res.ok || !res.body) throw new Error(`TTS ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payloadRaw = line.slice(5).trim();
        if (!payloadRaw || payloadRaw === "[DONE]") continue;
        let payload: { type?: string; audio?: string };
        try {
          payload = JSON.parse(payloadRaw);
        } catch {
          continue;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) continue;
        const bin = atob(payload.audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        playChunk(bytes);
      }
    }
  }

  const wait = Math.max(0, (lastEnd - audio.currentTime) * 1000);
  setTimeout(() => {
    if (currentAbort === controller) currentAbort = null;
    onDone?.();
  }, wait);
}
