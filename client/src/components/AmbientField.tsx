import { useEffect, useMemo, useState, type CSSProperties } from "react";

type AmbientState = "idle" | "listening" | "user-speaking" | "thinking" | "responding" | "connection_external" | "error";

export function AmbientField({ state }: { state: AmbientState }) {
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.42 });
  const particles = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    left: `${10 + ((index * 37) % 80)}%`,
    top: `${12 + ((index * 53) % 72)}%`,
    delay: `${(index % 7) * 0.7}s`,
    size: `${index % 3 === 0 ? 3 : 2}px`,
  })), []);

  useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setPointer({ x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight });
        frame = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const style = {
    "--pointer-x": `${pointer.x * 100}%`,
    "--pointer-y": `${pointer.y * 100}%`,
  } as CSSProperties;

  return <div className={`ambient-field ambient-${state}`} style={style} aria-hidden="true">
    <div className="ambient-vignette" />
    <div className="ambient-crosshair" />
    <div className="ambient-ring ambient-ring-a" />
    <div className="ambient-ring ambient-ring-b" />
    <div className="ambient-orbit"><span /><span /><span /></div>
    <div className="ambient-particles">{particles.map((particle, index) => <i key={index} style={{ left: particle.left, top: particle.top, animationDelay: particle.delay, width: particle.size, height: particle.size }} />)}</div>
    <div className="ambient-wave" />
  </div>;
}
