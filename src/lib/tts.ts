let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;

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
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`tts failed: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
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
