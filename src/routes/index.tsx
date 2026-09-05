import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, Send, Terminal, Volume2, VolumeX, X } from "lucide-react";

import { SpiderMask, type Expression } from "@/components/SpiderMask";
import { evHistory, evSend } from "@/lib/ev.functions";
import { speakStream, stopSpeech, unlockAudio } from "@/lib/tts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "E.V. — Sua IA companheira de laboratório" },
      {
        name: "description",
        content:
          "E.V. (Eevee): interface residencial com máscara expressiva, conversa por voz em tempo real e memória contínua para não te deixar sozinho.",
      },
      { property: "og:title", content: "E.V. — Sua IA companheira de laboratório" },
      {
        property: "og:description",
        content: "Converse com a E.V. por texto ou voz. Lentes expressivas, memória na nuvem e busca na web.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvHome,
});

type Line = { role: "user" | "assistant"; content: string };

const DEVICE_KEY = "ev-device-id";
const WAKE_WORDS = ["eevee", "evie", "ivi", "evi", "e.v.", "ev "];

function useDeviceId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let stored = localStorage.getItem(DEVICE_KEY);
    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, stored);
    }
    setId(stored);
  }, []);
  return id;
}

function EvHome() {
  const deviceId = useDeviceId();
  const send = useServerFn(evSend);
  const loadHistory = useServerFn(evHistory);

  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expression, setExpression] = useState<Expression>("olhos_normais");
  const [reply, setReply] = useState("Oi. Tava aqui só ouvindo o cooler girar... fala comigo.");
  const [showHistory, setShowHistory] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    if (!deviceId) return;
    loadHistory({ data: { deviceId } })
      .then((res) => setLines(res.messages.map((m: any) => ({ role: m.role, content: m.content }))))
      .catch(() => undefined);
  }, [deviceId, loadHistory]);

  const speak = useCallback(
    async (text: string) => {
      if (!voiceOut) return;
      try {
        setSpeaking(true);
        speakingRef.current = true;
        await speakStream(text, () => {
          setSpeaking(false);
          speakingRef.current = false;
        });
      } catch {
        setSpeaking(false);
        speakingRef.current = false;
      }
    },
    [voiceOut],
  );

  const submit = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || !deviceId || busy) return;
      setInput("");
      setHeard("");
      stopSpeech();
      setSpeaking(false);
      setLines((l) => [...l, { role: "user", content: clean }]);
      setBusy(true);
      setExpression("olhos_semicerrados");

      if (/hist[oó]ric|conversas antigas|log/i.test(clean)) setShowHistory(true);

      try {
        const res = await send({ data: { deviceId, message: clean } });
        setExpression(res.expression as Expression);
        setReply(res.text);
        setLines((l) => [...l, { role: "assistant", content: res.text }]);
        void speak(res.text);
      } catch {
        setExpression("olhos_semicerrados");
        setReply("Deu ruído na linha. Tenta de novo?");
      } finally {
        setBusy(false);
      }
    },
    [busy, deviceId, send, speak],
  );

  const startRecognition = useCallback(
    (immediate: boolean) => {
      const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (!SR) {
        setVoiceHint("Seu navegador não suporta reconhecimento de voz.");
        return;
      }
      recRef.current?.stop?.();
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e: any) => {
        const last = e.results[e.results.length - 1];
        const transcript = String(last[0].transcript).trim();
        if (!last.isFinal) {
          if (voiceModeRef.current) setHeard(transcript);
          return;
        }
        const lower = transcript.toLowerCase();
        if (!voiceModeRef.current) {
          const hit = WAKE_WORDS.find((w) => lower.includes(w));
          if (!hit) return;
          setVoiceMode(true);
          voiceModeRef.current = true;
          const after = transcript.slice(lower.indexOf(hit) + hit.length).trim();
          if (after.length > 1) void submit(after);
          return;
        }
        if (speakingRef.current) return;
        if (transcript.length > 1) void submit(transcript);
      };
      rec.onerror = () => setVoiceHint("Não consegui ouvir. Verifique o microfone.");
      rec.onend = () => {
        if (recRef.current === rec) {
          try {
            rec.start();
          } catch {
            /* noop */
          }
        }
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch {
        /* noop */
      }
      setListening(true);
      setVoiceHint(immediate ? null : 'Escutando... diga "Eevee" para me acordar.');
    },
    [submit],
  );

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop?.();
    setListening(false);
    setVoiceHint(null);
  }, []);

  const openVoiceMode = useCallback(() => {
    unlockAudio();
    setVoiceMode(true);
    voiceModeRef.current = true;
    startRecognition(true);
  }, [startRecognition]);

  const closeVoiceMode = useCallback(() => {
    setVoiceMode(false);
    voiceModeRef.current = false;
    stopRecognition();
    stopSpeech();
    setSpeaking(false);
    setHeard("");
  }, [stopRecognition]);

  useEffect(() => {
    return () => {
      recRef.current?.stop?.();
      recRef.current = null;
      stopSpeech();
    };
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-6">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <span className="ev-wordmark text-lg font-semibold text-foreground">E.V.</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              unlockAudio();
              setVoiceOut((v) => {
                if (v) {
                  stopSpeech();
                  setSpeaking(false);
                }
                return !v;
              });
            }}
            aria-label="Alternar voz da E.V."
            className={`rounded-full border border-border p-2 transition-colors hover:bg-secondary ${voiceOut ? "text-accent" : "text-muted-foreground"}`}
          >
            {voiceOut ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => setShowHistory((s) => !s)}
            aria-label="Histórico"
            className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Terminal size={16} />
          </button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
        <h1 className="sr-only">E.V. — inteligência artificial companheira</h1>
        <SpiderMask
          expression={expression}
          speaking={speaking}
          listening={listening}
          thinking={busy}
        />
        <p className="max-w-xl text-balance text-center text-base leading-relaxed text-foreground/90 md:text-lg">
          {busy ? <span className="text-muted-foreground">pensando...</span> : reply}
        </p>
      </section>

      <footer className="w-full max-w-2xl space-y-3 pb-2">
        {voiceHint && (
          <p className="text-center text-xs font-[family-name:var(--font-terminal)] text-accent">
            {voiceHint}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            void submit(input);
          }}
          className="terminal-panel flex items-center gap-2 rounded-full px-3 py-2"
        >
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              listening ? stopRecognition() : startRecognition(false);
            }}
            aria-label="Palavra-chave Eevee"
            className={`rounded-full p-2 transition-colors ${listening ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <Mic size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="fala comigo..."
            className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={openVoiceMode}
            aria-label="Conversa por voz"
            className="rounded-full border border-accent/50 p-2 text-accent transition-colors hover:bg-accent/10"
          >
            <AudioLines size={18} />
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-label="Enviar"
            className="rounded-full bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>

      {voiceMode && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-10 bg-background/95 px-6 backdrop-blur-xl">
          <SpiderMask
            expression={expression}
            speaking={speaking}
            listening={listening && !speaking}
            thinking={busy}
          />
          <div className="flex h-12 items-end gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="ev-orb"
                style={{
                  animationDelay: `${i * 120}ms`,
                  animationPlayState: speaking || (listening && !busy) ? "running" : "paused",
                }}
              />
            ))}
          </div>
          <div className="max-w-lg space-y-2 text-center">
            <p className="text-base leading-relaxed text-foreground/90">
              {busy ? "pensando..." : reply}
            </p>
            <p className="text-xs text-muted-foreground">
              {speaking ? "falando..." : heard || "pode falar, tô te ouvindo."}
            </p>
          </div>
          <button
            onClick={closeVoiceMode}
            className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:bg-secondary"
          >
            encerrar conversa
          </button>
        </div>
      )}

      {showHistory && (
        <aside className="terminal-panel fixed right-0 top-0 z-40 h-full w-full max-w-sm animate-in slide-in-from-right overflow-y-auto p-4 text-xs">
          <div className="mb-3 flex items-center justify-between text-muted-foreground">
            <span>~/ev/logs</span>
            <button onClick={() => setShowHistory(false)} aria-label="Fechar histórico">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {lines.length === 0 && <p className="text-muted-foreground">nenhum registro ainda.</p>}
            {lines.map((l, i) => (
              <p key={i} className={l.role === "user" ? "text-accent" : "text-foreground/85"}>
                <span className="text-muted-foreground">{l.role === "user" ? "you> " : "ev>  "}</span>
                {l.content}
              </p>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
