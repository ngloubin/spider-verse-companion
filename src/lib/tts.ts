let ctx: AudioContext | null = null;
let currentAbort: AbortController | null = null;
let sources: AudioBufferSourceNode[] = [];

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx || ctx.state === "closed") ctx = new AC({ sampleRate: 24000 });
  return ctx;
}

/** Must be called from a real user gesture (click/tap) so the browser allows audio. */
export function unlockAudio() {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume().catch(() => undefined);
  try {
    const buf = audio.createBuffer(1, 1, 24000);
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(audio.destination);
    src.start(0);
  } catch {
    /* noop */
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    // Priming the speech engine keeps the browser fallback usable later.
    window.speechSynthesis.cancel();
  }
}

export function stopSpeech() {
  currentAbort?.abort();
  currentAbort = null;
  for (const s of sources) {
    try {
      s.stop();
    } catch {
      /* noop */
    }
  }
  sources = [];
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/** Streams TTS audio from the backend and plays it as it arrives. */
export async function speakStream(text: string, onDone?: () => void): Promise<void> {
  stopSpeech();
  const controller = new AbortController();
  currentAbort = controller;

  const audio = getCtx();
  if (!audio) {
    fallbackSpeak(text, onDone);
    return;
  }
  if (audio.state === "suspended") await audio.resume().catch(() => undefined);

  let playhead = 0;
  let pending = new Uint8Array(0);
  let lastEnd = 0;
  let played = false;

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
    playhead = playhead === 0 ? audio.currentTime + 0.15 : Math.max(playhead, audio.currentTime);
    source.start(playhead);
    playhead += buffer.duration;
    lastEnd = playhead;
    sources.push(source);
    played = true;
  };

  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } catch {
    fallbackSpeak(text, onDone);
    return;
  }
  if (!res.ok || !res.body) {
    // Fallback: local browser voice (used when cloud TTS is unavailable).
    fallbackSpeak(text, onDone);
    return;
  }

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

  if (!played) {
    fallbackSpeak(text, onDone);
    return;
  }

  const wait = Math.max(0, (lastEnd - audio.currentTime) * 1000);
  setTimeout(() => {
    if (currentAbort === controller) currentAbort = null;
    sources = [];
    onDone?.();
  }, wait + 120);
}

function fallbackSpeak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 1.05;
  u.pitch = 1.15;
  const pt = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
  if (pt) u.voice = pt;
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
