import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, Send, Terminal, Volume2, VolumeX, X } from "lucide-react";
import { AmbientField } from "@/components/AmbientField";
import { SpiderMask, type Expression } from "@/components/SpiderMask";
import { trpc } from "@/lib/trpc";

const WAKE_WORDS = ["eevee", "evie", "evi", "e.v."];
type Line = { role: "user" | "assistant"; content: string };
type SystemState = "idle" | "listening" | "user-speaking" | "thinking" | "responding" | "connection_external" | "error";
type VoicePreferences = { voiceRate: string; responseStyle: string; motionLevel: string };

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

const DEFAULT_PREFERENCES: VoicePreferences = { voiceRate: "1.12", responseStyle: "balanced", motionLevel: "rich" };
const STATE_LABELS: Record<SystemState, string> = {
  idle: "online",
  listening: "ouvindo",
  "user-speaking": "recebendo",
  thinking: "pensando",
  responding: "respondendo",
  connection_external: "conexão externa",
  error: "atenção",
};

function choosePortugueseVoice() {
  if (typeof window === "undefined") return undefined;
  return window.speechSynthesis?.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("pt"));
}

function readLocalPreferences(): VoicePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try { return { ...DEFAULT_PREFERENCES, ...JSON.parse(window.localStorage.getItem("ev-preferences") || "{}") }; } catch { return DEFAULT_PREFERENCES; }
}

export default function Home() {
  const chat = trpc.ev.chat.useMutation();
  const profile = trpc.ev.profile.useQuery();
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
  const [state, setState] = useState<SystemState>("idle");
  const [preferences, setPreferences] = useState<VoicePreferences>(() => readLocalPreferences());
  const recRef = useRef<Recognition | null>(null);
  const voiceModeRef = useRef(false);
  const speakingRef = useRef(false);
  const transcriptRef = useRef("");
  const transcriptTimerRef = useRef<number | null>(null);

  const applyPreferences = useCallback((next: Partial<VoicePreferences>) => {
    setPreferences((current) => {
      const merged = { ...current, ...next };
      window.localStorage?.setItem("ev-preferences", JSON.stringify(merged));
      return merged;
    });
  }, []);

  useEffect(() => {
    if (profile.data?.preferences) applyPreferences(profile.data.preferences);
  }, [applyPreferences, profile.data?.preferences]);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceModeRef.current || !voiceOut || !window.speechSynthesis) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, " ").trim());
    utterance.lang = "pt-BR";
    utterance.rate = Number(preferences.voiceRate) || 1.12;
    utterance.pitch = 1.02;
    utterance.volume = 0.92;
    const voice = choosePortugueseVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); setState("responding"); };
    utterance.onend = () => { speakingRef.current = false; setSpeaking(false); setState(voiceModeRef.current ? "listening" : "idle"); };
    utterance.onerror = () => { speakingRef.current = false; setSpeaking(false); setState("error"); };
    window.speechSynthesis.speak(utterance);
  }, [preferences.voiceRate, stopSpeech, voiceOut]);

  const submit = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || chat.isPending) return;
    stopSpeech();
    setInput("");
    setHeard("");
    setState("thinking");
    setLines((current) => [...current, { role: "user", content: clean }]);
    setExpression("olhos_semicerrados");
    try {
      const result = await chat.mutateAsync({ message: clean });
      setExpression(result.expression as Expression);
      setReply(result.text);
      setLines((current) => [...current, { role: "assistant", content: result.text }]);
      applyPreferences(result.preferences);
      setState(result.state as SystemState);
      if (voiceModeRef.current) speak(result.text);
      else if (result.state !== "connection_external") setState("idle");
    } catch {
      setExpression("olhos_semicerrados");
      setReply("Deu ruído na linha. Verifique a conexão e tente de novo.");
      setState("error");
    }
  }, [applyPreferences, chat, speak, stopSpeech]);

  const startRecognition = useCallback(() => {
    const RecognitionAPI = (window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
    if (!RecognitionAPI) { setVoiceHint("Seu navegador não suporta reconhecimento de voz."); setState("error"); return; }
    recRef.current?.stop();
    const recognition = new RecognitionAPI();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = String(last[0].transcript).trim();
      if (!last.isFinal) { if (voiceModeRef.current) { setHeard(transcriptRef.current ? `${transcriptRef.current} ${transcript}` : transcript); setState("user-speaking"); } return; }
      const lower = transcript.toLocaleLowerCase("pt-BR");
      if (!voiceModeRef.current) {
        const wake = WAKE_WORDS.find((word) => lower.includes(word));
        if (!wake) return;
        setVoiceMode(true); voiceModeRef.current = true; setState("listening");
        const after = transcript.slice(lower.indexOf(wake) + wake.length).trim();
        if (after.length > 1) void submit(after);
        return;
      }
      if (speakingRef.current || transcript.length <= 1) return;
      transcriptRef.current = `${transcriptRef.current} ${transcript}`.trim();
      setHeard(transcriptRef.current);
      setState("user-speaking");
      if (transcriptTimerRef.current) window.clearTimeout(transcriptTimerRef.current);
      transcriptTimerRef.current = window.setTimeout(() => {
        const complete = transcriptRef.current.trim(); transcriptRef.current = ""; setHeard("");
        if (complete) void submit(complete);
      }, 780);
    };
    recognition.onerror = () => { setVoiceHint("Não consegui ouvir. Verifique o microfone e fale um pouco mais perto."); setState("error"); };
    recognition.onend = () => { if (recRef.current === recognition) { try { recognition.start(); } catch { /* browser may reject a fast restart */ } } };
    recRef.current = recognition;
    try { recognition.start(); } catch { /* permission prompt handles the first attempt */ }
    setListening(true);
    setState(voiceModeRef.current ? "listening" : "idle");
    setVoiceHint(voiceModeRef.current ? "Conversa por voz ativa. Pode falar naturalmente." : 'Escutando... diga "Evee" para me acordar.');
  }, [submit]);

  const stopRecognition = useCallback(() => {
    if (transcriptTimerRef.current) window.clearTimeout(transcriptTimerRef.current);
    transcriptTimerRef.current = null; transcriptRef.current = "";
    recRef.current?.stop(); recRef.current = null;
    setListening(false); setVoiceHint(null); setState(voiceModeRef.current ? "idle" : "idle");
  }, []);

  const openVoiceMode = useCallback(() => { setVoiceMode(true); voiceModeRef.current = true; startRecognition(); }, [startRecognition]);
  const closeVoiceMode = useCallback(() => { setVoiceMode(false); voiceModeRef.current = false; stopRecognition(); stopSpeech(); setHeard(""); }, [stopRecognition, stopSpeech]);

  useEffect(() => () => { recRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  return <main className={`ev-shell state-${state} motion-${preferences.motionLevel}`}>
    <AmbientField state={state} />
    <div className="ev-content">
      <header className="ev-header">
        <div className="brand-lockup"><span className="ev-wordmark">E.V.</span><span className="brand-subtitle">personal intelligence / 01</span></div>
        <div className="header-actions">
          <span className={`system-status ${state === "thinking" ? "status-thinking" : listening ? "status-listening" : ""}`}><i />{STATE_LABELS[state]}</span>
          <button onClick={() => { if (voiceOut) stopSpeech(); setVoiceOut((value) => !value); }} aria-label="Alternar voz da E.V." className={`control-button ${voiceOut ? "control-active" : ""}`}>{voiceOut ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button onClick={() => setShowHistory((value) => !value)} aria-label="Histórico" className="control-button"><Terminal size={17} /></button>
        </div>
      </header>
      <section className="ev-stage">
        <div className="stage-heading"><span>visual interface</span><b>•</b><span>neural presence</span></div>
        <SpiderMask expression={expression} speaking={speaking} listening={listening} thinking={state === "thinking"} />
        <p className="reply-line">{state === "thinking" ? <span className="thinking-dots">pensando<span>.</span><span>.</span><span>.</span></span> : reply}</p>
      </section>
      <footer className="ev-footer">
        <div className="command-caption"><span>TEXT CHANNEL</span><span className="caption-line" /><span>VOICE MODE OPENS AUDIO</span></div>
        {voiceHint && <p className="voice-hint">{voiceHint}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void submit(input); }} className="terminal-panel command-bar">
          <button type="button" onClick={() => listening ? stopRecognition() : startRecognition()} aria-label="Ativar microfone" className={`command-button ${listening ? "command-active" : ""}`}><Mic size={18} /></button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="fala comigo..." className="command-input" />
          <button type="button" onClick={openVoiceMode} aria-label="Conversa por voz" className="command-button command-voice"><AudioLines size={18} /></button>
          <button type="submit" disabled={chat.isPending} aria-label="Enviar" className="send-button"><Send size={16} /></button>
        </form>
      </footer>
    </div>
    {voiceMode && <div className="voice-overlay">
      <div className="voice-mode-label"><i /> VOICE CONVERSATION / {STATE_LABELS[state]}</div>
      <SpiderMask expression={expression} speaking={speaking} listening={listening && !speaking} thinking={state === "thinking"} />
      <div className="voice-bars">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="ev-orb" style={{ animationDelay: `${i * 120}ms`, animationPlayState: speaking || (listening && !chat.isPending) ? "running" : "paused" }} />)}</div>
      <div className="voice-copy"><p>{state === "thinking" ? "pensando..." : reply}</p><small>{speaking ? "falando..." : heard || "pode falar, tô te ouvindo."}</small></div>
      <button onClick={closeVoiceMode} className="close-voice">encerrar conversa</button>
    </div>}
    {showHistory && <aside className="terminal-panel history-panel"><div className="history-head"><span>~/ev/logs</span><button onClick={() => setShowHistory(false)} aria-label="Fechar histórico"><X size={16} /></button></div><div className="history-list">{lines.length === 0 && <p className="muted">nenhum registro ainda.</p>}{lines.map((line, i) => <p key={i} className={line.role === "user" ? "history-user" : "history-ev"}><span>{line.role === "user" ? "you&gt; " : "ev&gt;  "}</span>{line.content}</p>)}</div></aside>}
  </main>;
}
