import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, Send, Terminal, Volume2, VolumeX, X } from "lucide-react";
import { SpiderMask, type Expression } from "@/components/SpiderMask";
import { trpc } from "@/lib/trpc";

const WAKE_WORDS = ["eevee", "evie", "evi", "e.v."];

type Line = { role: "user" | "assistant"; content: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: any) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;

function choosePortugueseVoice() {
  if (typeof window === "undefined") return undefined;
  return window.speechSynthesis?.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("pt"));
}

export default function Home() {
  const chat = trpc.ev.chat.useMutation();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("Oi. Tava aqui só ouvindo o cooler girar... fala comigo.");
  const [expression, setExpression] = useState<Expression>("olhos_normais");
  const [voiceOut, setVoiceOut] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [heard, setHeard] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const voiceModeRef = useRef(false);
  const speakingRef = useRef(false);
  const transcriptRef = useRef("");
  const transcriptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceModeRef.current || !voiceOut || !window.speechSynthesis) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = choosePortugueseVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); };
    utterance.onend = () => { speakingRef.current = false; setSpeaking(false); };
    utterance.onerror = () => { speakingRef.current = false; setSpeaking(false); };
    window.speechSynthesis.speak(utterance);
  }, [stopSpeech, voiceOut]);

  const submit = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || chat.isPending) return;
    stopSpeech();
    setInput("");
    setHeard("");
    setLines((current) => [...current, { role: "user", content: clean }]);
    setExpression("olhos_semicerrados");
    try {
      const result = await chat.mutateAsync({ message: clean });
      setExpression(result.expression as Expression);
      setReply(result.text);
      setLines((current) => [...current, { role: "assistant", content: result.text }]);
      speak(result.text);
    } catch {
      setExpression("olhos_semicerrados");
      setReply("Deu ruído na linha. Verifique a conexão do Ollama e tente de novo.");
    }
  }, [chat, speak, stopSpeech]);

  const startRecognition = useCallback(() => {
    const RecognitionAPI = (window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
    if (!RecognitionAPI) {
      setVoiceHint("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    recRef.current?.stop();
    const recognition = new RecognitionAPI();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = String(last[0].transcript).trim();
      if (!last.isFinal) {
        if (voiceModeRef.current) setHeard(transcript);
        return;
      }
      const lower = transcript.toLowerCase();
      if (!voiceModeRef.current) {
        const wake = WAKE_WORDS.find((word) => lower.includes(word));
        if (!wake) return;
        setVoiceMode(true);
        voiceModeRef.current = true;
        const after = transcript.slice(lower.indexOf(wake) + wake.length).trim();
        if (after.length > 1) void submit(after);
        return;
      }
      if (speakingRef.current || transcript.length <= 1) return;
      transcriptRef.current = `${transcriptRef.current} ${transcript}`.trim();
      setHeard(transcriptRef.current);
      if (transcriptTimerRef.current) window.clearTimeout(transcriptTimerRef.current);
      transcriptTimerRef.current = window.setTimeout(() => {
        const complete = transcriptRef.current.trim();
        transcriptRef.current = "";
        setHeard("");
        if (complete) void submit(complete);
      }, 780);
    };
    recognition.onerror = () => setVoiceHint("Não consegui ouvir. Verifique o microfone.");
    recognition.onend = () => {
      if (recRef.current === recognition) {
        try { recognition.start(); } catch { /* browser can reject a fast restart */ }
      }
    };
    recRef.current = recognition;
    try { recognition.start(); } catch { /* permission prompt handles the first attempt */ }
    setListening(true);
    setVoiceHint(voiceModeRef.current ? null : 'Escutando... diga "Eevee" para me acordar.');
  }, [submit]);

  const stopRecognition = useCallback(() => {
    if (transcriptTimerRef.current) window.clearTimeout(transcriptTimerRef.current);
    transcriptTimerRef.current = null;
    transcriptRef.current = "";
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setVoiceHint(null);
  }, []);

  const openVoiceMode = useCallback(() => {
    setVoiceMode(true);
    voiceModeRef.current = true;
    startRecognition();
  }, [startRecognition]);

  const closeVoiceMode = useCallback(() => {
    setVoiceMode(false);
    voiceModeRef.current = false;
    stopRecognition();
    stopSpeech();
    setHeard("");
  }, [stopRecognition, stopSpeech]);

  useEffect(() => () => {
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-6">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <div className="brand-lockup"><span className="ev-wordmark text-lg font-semibold text-foreground">E.V.</span><span className="brand-subtitle">personal intelligence / 01</span></div>
        <div className="flex items-center gap-2">
          <span className={`system-status ${chat.isPending ? "status-thinking" : listening ? "status-listening" : ""}`}><i />{chat.isPending ? "processando" : listening ? "ouvindo" : "online"}</span>
          <button onClick={() => { if (voiceOut) stopSpeech(); setVoiceOut((value) => !value); }} aria-label="Alternar voz da E.V." className={`control-button ${voiceOut ? "control-active" : ""}`}>
            {voiceOut ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button onClick={() => setShowHistory((value) => !value)} aria-label="Histórico" className="control-button"><Terminal size={17} /></button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
        <h1 className="sr-only">E.V. — inteligência artificial companheira</h1>
        <p className="mask-kicker">visual interface <span>•</span> neural presence</p>
        <SpiderMask expression={expression} speaking={speaking} listening={listening} thinking={chat.isPending} />
        <p className="reply-line max-w-xl text-balance text-center text-base leading-relaxed text-foreground/90 md:text-lg">
          {chat.isPending ? <span className="text-muted-foreground">pensando...</span> : reply}
        </p>
      </section>

      <footer className="w-full max-w-2xl space-y-3 pb-2">
        <div className="command-caption"><span>TEXT CHANNEL</span><span className="caption-line" /><span>VOICE MODE OPENS AUDIO</span></div>
        {voiceHint && <p className="text-center text-xs text-accent">{voiceHint}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void submit(input); }} className="terminal-panel command-bar">
          <button type="button" onClick={() => listening ? stopRecognition() : startRecognition()} aria-label="Ativar microfone" className={`command-button ${listening ? "command-active" : ""}`}><Mic size={18} /></button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="fala comigo..." className="command-input" />
          <button type="button" onClick={openVoiceMode} aria-label="Conversa por voz" className="command-button command-voice"><AudioLines size={18} /></button>
          <button type="submit" disabled={chat.isPending} aria-label="Enviar" className="send-button"><Send size={16} /></button>
        </form>
      </footer>

      {voiceMode && <div className="voice-overlay">
        <SpiderMask expression={expression} speaking={speaking} listening={listening && !speaking} thinking={chat.isPending} />
        <div className="voice-bars">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="ev-orb" style={{ animationDelay: `${i * 120}ms`, animationPlayState: speaking || (listening && !chat.isPending) ? "running" : "paused" }} />)}</div>
        <div className="max-w-lg space-y-2 text-center"><p className="text-base leading-relaxed text-foreground/90">{chat.isPending ? "pensando..." : reply}</p><p className="text-xs text-muted-foreground">{speaking ? "falando..." : heard || "pode falar, tô te ouvindo."}</p></div>
        <button onClick={closeVoiceMode} className="close-voice">encerrar conversa</button>
      </div>}

      {showHistory && <aside className="terminal-panel history-panel">
        <div className="mb-3 flex items-center justify-between text-muted-foreground"><span>~/ev/logs</span><button onClick={() => setShowHistory(false)} aria-label="Fechar histórico"><X size={16} /></button></div>
        <div className="space-y-2">{lines.length === 0 && <p className="text-muted-foreground">nenhum registro ainda.</p>}{lines.map((line, i) => <p key={i} className={line.role === "user" ? "text-accent" : "text-foreground/85"}><span className="text-muted-foreground">{line.role === "user" ? "you&gt; " : "ev&gt;  "}</span>{line.content}</p>)}</div>
      </aside>}
    </main>
  );
}
