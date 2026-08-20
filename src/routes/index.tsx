import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Terminal, Volume2, VolumeX, X } from "lucide-react";

import { SpiderMask, type Expression } from "@/components/SpiderMask";
import { evHistory, evSend } from "@/lib/ev.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "E.V. — Sua IA companheira de laboratório" },
      {
        name: "description",
        content:
          "E.V. (Eevee): interface residencial com máscara expressiva, conversa por voz e memória contínua para não te deixar sozinho.",
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
  const [voiceOut, setVoiceOut] = useState(false);
  const [listening, setListening] = useState(false);
  const [wakeArmed, setWakeArmed] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!deviceId) return;
    loadHistory({ data: { deviceId } })
      .then((res) => {
        setLines(res.messages.map((m: any) => ({ role: m.role, content: m.content })));
      })
      .catch(() => undefined);
  }, [deviceId, loadHistory]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOut || typeof window === "undefined" || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.05;
      u.pitch = 1.15;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voiceOut],
  );

  const submit = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || !deviceId || busy) return;
      setInput("");
      setLines((l) => [...l, { role: "user", content: clean }]);
      setBusy(true);
      setExpression("olhos_semicerrados");

      if (/hist[oó]ric|conversas antigas|log/i.test(clean)) setShowHistory(true);

      try {
        const res = await send({ data: { deviceId, message: clean } });
        setExpression(res.expression as Expression);
        setReply(res.text);
        setLines((l) => [...l, { role: "assistant", content: res.text }]);
        speak(res.text);
      } catch {
        setExpression("olhos_semicerrados");
        setReply("Deu ruído na linha. Tenta de novo?");
      } finally {
        setBusy(false);
      }
    },
    [busy, deviceId, send, speak],
  );

  // Wake word + voice mode
  const startRecognition = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceHint("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      const transcript = String(e.results[e.results.length - 1][0].transcript).trim();
      const lower = transcript.toLowerCase();
      const hit = WAKE_WORDS.find((w) => lower.includes(w));
      if (hit) {
        const after = lower.slice(lower.indexOf(hit) + hit.length).trim();
        setListening(true);
        setVoiceHint("Modo de voz ativo");
        if (after.length > 1) void submit(after);
        return;
      }
      if (listening && transcript.length > 1) void submit(transcript);
    };
    rec.onerror = () => setVoiceHint("Não consegui ouvir. Verifique o microfone.");
    rec.onend = () => {
      if (recRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    recRef.current = rec;
    rec.start();
    setWakeArmed(true);
    setVoiceHint('Ouvindo... diga "Eevee" para me acordar.');
  }, [listening, submit]);

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop?.();
    setWakeArmed(false);
    setListening(false);
    setVoiceHint(null);
  }, []);

  useEffect(() => () => recRef.current?.stop?.(), []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-4 py-8">
      <header className="flex w-full max-w-4xl items-center justify-between text-xs uppercase tracking-[0.35em] text-muted-foreground">
        <span className="font-[family-name:var(--font-terminal)]">E.V. // unidade doméstica</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceOut((v) => !v)}
            aria-label="Alternar voz local"
            className={`rounded-md border border-border p-2 transition-colors hover:bg-secondary ${voiceOut ? "text-accent" : "text-muted-foreground"}`}
          >
            {voiceOut ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => setShowHistory((s) => !s)}
            aria-label="Histórico"
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Terminal size={16} />
          </button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <h1 className="sr-only">E.V. — inteligência artificial companheira</h1>
        <SpiderMask expression={expression} speaking={busy} listening={listening} />
        <p className="max-w-xl text-center text-base leading-relaxed text-foreground/90 md:text-lg">
          {busy ? <span className="text-muted-foreground">processando...</span> : reply}
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
            void submit(input);
          }}
          className="terminal-panel flex items-center gap-2 rounded-full px-3 py-2"
        >
          <button
            type="button"
            onClick={() => (wakeArmed ? stopRecognition() : startRecognition())}
            aria-label="Modo de voz"
            className={`rounded-full p-2 transition-colors ${wakeArmed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            {wakeArmed ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="fala comigo..."
            className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
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

      {showHistory && (
        <aside className="terminal-panel fixed right-0 top-0 z-20 h-full w-full max-w-sm overflow-y-auto p-4 text-xs animate-slide-in-right">
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
