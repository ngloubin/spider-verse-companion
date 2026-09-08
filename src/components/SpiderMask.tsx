import { useEffect, useRef, useState } from "react";

import maskBlink from "@/assets/ev-mask-blink.png";
import maskNormal from "@/assets/ev-mask-normal.png";
import maskSquint from "@/assets/ev-mask-squint.png";
import maskWide from "@/assets/ev-mask-wide.png";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

const LAYERS: { key: Expression; src: string }[] = [
  { key: "olhos_normais", src: maskNormal },
  { key: "olhos_semicerrados", src: maskSquint },
  { key: "olhos_arregalados", src: maskWide },
  { key: "olhos_piscando", src: maskBlink },
];

/**
 * Photographic mask made of four cross-fading plates (one per expression)
 * plus light layers that react to what E.V. is doing.
 */
export function SpiderMask({
  expression = "olhos_normais",
  speaking = false,
  listening = false,
  thinking = false,
  intensity = 0,
}: {
  expression?: Expression;
  speaking?: boolean;
  listening?: boolean;
  thinking?: boolean;
  /** 0..1 — how energetic the current voice/processing activity is. */
  intensity?: number;
}) {
  const [blink, setBlink] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // natural, non-periodic blinking
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 130);
          schedule();
        },
        3800 + Math.random() * 6500,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // gentle parallax — the mask keeps facing the person at the desk
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const loop = () => {
      cx += (tx - cx) * 0.045;
      cy += (ty - cy) * 0.045;
      el.style.setProperty("--px", cx.toFixed(4));
      el.style.setProperty("--py", cy.toFixed(4));
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const active: Expression = blink ? "olhos_piscando" : expression;

  return (
    <div
      ref={wrapRef}
      className="ev-mask-wrap"
      data-speaking={speaking}
      data-listening={listening}
      data-thinking={thinking}
      style={{ ["--energy" as string]: intensity.toFixed(3) }}
    >
      <div className="ev-mask-contact" aria-hidden />
      <div className="ev-mask-plate" role="img" aria-label="Máscara da E.V.">
        {LAYERS.map((l) => (
          <img
            key={l.key}
            src={l.src}
            alt=""
            width={1024}
            height={1280}
            draggable={false}
            className="ev-mask-layer"
            data-active={l.key === active}
          />
        ))}
        <div className="ev-mask-lightwrap" aria-hidden>
          <div className="ev-mask-key" />
          <div className="ev-mask-rim" />
          <div className="ev-mask-lensglow" />
        </div>
      </div>
    </div>
  );
}
