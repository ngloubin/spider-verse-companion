import { useEffect, useMemo, useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

type Shape = Exclude<Expression, "olhos_piscando">;

// Left lens outlines (right lens is mirrored) — angular, Brand New Day style.
const LENS: Record<Shape, string> = {
  olhos_normais:
    "M278 292 C252 240 194 202 136 202 C98 202 82 232 88 264 C95 304 142 340 200 346 C252 351 290 334 278 292 Z",
  olhos_semicerrados:
    "M278 302 C256 272 200 246 144 248 C108 249 92 268 96 290 C102 318 146 344 202 348 C252 352 288 336 278 302 Z",
  olhos_arregalados:
    "M282 284 C256 220 188 174 126 174 C84 174 64 210 70 252 C78 304 134 354 200 362 C258 369 298 342 282 284 Z",
};

const ORDER: Shape[] = ["olhos_normais", "olhos_semicerrados", "olhos_arregalados"];

const HEAD =
  "M300 30 C182 30 96 108 78 224 C62 328 96 436 168 522 C214 577 258 600 300 600 C342 600 386 577 432 522 C504 436 538 328 522 224 C504 108 418 30 300 30 Z";

export function SpiderMask({
  expression = "olhos_normais",
  speaking = false,
  listening = false,
  thinking = false,
}: {
  expression?: Expression;
  speaking?: boolean;
  listening?: boolean;
  thinking?: boolean;
}) {
  const [blink, setBlink] = useState(false);
  const shape: Shape = expression === "olhos_piscando" ? "olhos_normais" : expression;

  useEffect(() => {
    if (expression !== "olhos_piscando") return;
    setBlink(true);
    const t = setTimeout(() => setBlink(false), 200);
    return () => clearTimeout(t);
  }, [expression]);

  useEffect(() => {
    const id = setInterval(
      () => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
      },
      7000 + Math.random() * 6000,
    );
    return () => clearInterval(id);
  }, []);

  const spokes = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / 22;
        return {
          x1: 300 + Math.cos(a) * 8,
          y1: 250 + Math.sin(a) * 8,
          x2: 300 + Math.cos(a) * 460,
          y2: 250 + Math.sin(a) * 500,
        };
      }),
    [],
  );

  return (
    <div
      className="ev-mask-wrap"
      data-speaking={speaking}
      data-listening={listening}
      data-thinking={thinking}
    >
      <svg viewBox="0 0 600 640" className="ev-mask" role="img" aria-label="Máscara da E.V.">
        <defs>
          <radialGradient id="maskFill" cx="50%" cy="28%" r="78%">
            <stop offset="0%" stopColor="var(--mask-red-hi)" />
            <stop offset="62%" stopColor="var(--mask-red-mid)" />
            <stop offset="100%" stopColor="var(--mask-red-lo)" />
          </radialGradient>
          <linearGradient id="lensFill" x1="0.1" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="var(--lens-hi)" />
            <stop offset="55%" stopColor="var(--lens-mid)" />
            <stop offset="100%" stopColor="var(--lens-lo)" />
          </linearGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0 / 0.85)" />
            <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
          </linearGradient>
          <filter id="lensGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="headClip">
            <path d={HEAD} />
          </clipPath>
        </defs>

        {/* head */}
        <path d={HEAD} fill="url(#maskFill)" />

        {/* fabric shading */}
        <g clipPath="url(#headClip)">
          <ellipse cx="300" cy="120" rx="230" ry="150" fill="oklch(1 0 0 / 0.05)" />
          <ellipse cx="300" cy="640" rx="260" ry="220" fill="oklch(0 0 0 / 0.35)" />
          <ellipse cx="120" cy="360" rx="120" ry="260" fill="oklch(0 0 0 / 0.22)" />
          <ellipse cx="480" cy="360" rx="120" ry="260" fill="oklch(0 0 0 / 0.22)" />
        </g>

        {/* web: radial spokes + arcs */}
        <g clipPath="url(#headClip)" className="ev-web">
          <g stroke="var(--web-line)" strokeWidth="2.4" fill="none" strokeLinecap="round">
            {spokes.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
            ))}
          </g>
          <g stroke="var(--web-line)" strokeWidth="2" fill="none">
            {[46, 92, 146, 208, 276, 352, 436].map((r) => (
              <ellipse key={r} cx={300} cy={250} rx={r} ry={r * 1.1} />
            ))}
          </g>
        </g>

        {/* lens sockets (black rim) */}
        <g transform="translate(0,34)">
          <g className="ev-lens-rim">
            {ORDER.map((k) => (
              <path
                key={`l-${k}`}
                d={LENS[k]}
                fill="var(--lens-edge)"
                stroke="var(--lens-edge)"
                strokeWidth="26"
                strokeLinejoin="round"
                className="ev-lens-path"
                data-active={k === shape}
              />
            ))}
            <g transform="translate(600,0) scale(-1,1)">
              {ORDER.map((k) => (
                <path
                  key={`r-${k}`}
                  d={LENS[k]}
                  fill="var(--lens-edge)"
                  stroke="var(--lens-edge)"
                  strokeWidth="26"
                  strokeLinejoin="round"
                  className="ev-lens-path"
                  data-active={k === shape}
                />
              ))}
            </g>
          </g>

          {/* lenses */}
          <g className="ev-lenses" data-blink={blink} filter="url(#lensGlow)">
            <g>
              {ORDER.map((k) => (
                <path
                  key={`ll-${k}`}
                  d={LENS[k]}
                  fill="url(#lensFill)"
                  className="ev-lens-path"
                  data-active={k === shape}
                />
              ))}
            </g>
            <g transform="translate(600,0) scale(-1,1)">
              {ORDER.map((k) => (
                <path
                  key={`rl-${k}`}
                  d={LENS[k]}
                  fill="url(#lensFill)"
                  className="ev-lens-path"
                  data-active={k === shape}
                />
              ))}
            </g>

            {/* tech scan sheen inside lenses */}
            <g opacity="0.5" clipPath="url(#headClip)">
              <path d="M120 210 L250 210 L210 262 L96 262 Z" fill="url(#sheen)" />
              <path d="M350 210 L480 210 L504 262 L390 262 Z" fill="url(#sheen)" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
