let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;
let speechRate = 1.22;

export function setSpeechRate(rate: number) {
  speechRate = Math.min(1.75, Math.max(0.7, rate));
}

export function getSpeechRate() {
  return speechRate;
}

/** Prime the browser audio engine so later plays inside the same gesture work. */
export function unlockAudio() {
  const audio = new Audio();
  void audio.play().catch(() => undefined);
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function stopSpeech() {
  currentAbort?.abort();
  currentAbort = null;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/** Streams TTS audio from the backend and plays it as it arrives. */
export async function speakStream(text: string, onDone?: () => void): Promise<void> {
  stopSpeech();
  const controller = new AbortController();
  currentAbort = controller;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, rate: speechRate }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`tts failed: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = 1;
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onDone?.();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      fallbackSpeak(text, onDone);
    };

    await audio.play();
  } catch {
    fallbackSpeak(text, onDone);
  }
}

/**
 * Native voice fallback. Long answers are split into clauses and queued back
 * to back so the delivery stays continuous instead of word-by-word.
 */
function fallbackSpeak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const pt = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
  const chunks = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .flatMap((s) => (s.length > 160 ? s.split(/(?<=,)\s+/) : [s]))
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    onDone?.();
    return;
  }

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "pt-BR";
    // small natural variation so the rhythm doesn't sound metronomic
    u.rate = speechRate * (1 + (i % 3 === 1 ? 0.03 : i % 3 === 2 ? -0.02 : 0));
    u.pitch = 1.1 + (i % 2 === 0 ? 0.04 : -0.03);
    if (pt) u.voice = pt;
    if (i === chunks.length - 1) {
      u.onend = () => onDone?.();
      u.onerror = () => onDone?.();
    }
    synth.speak(u);
  });
}
