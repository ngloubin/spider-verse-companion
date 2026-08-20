import { useEffect, useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

// Left lens outlines for each emotional state (right lens is mirrored).
const LENS: Record<Exclude<Expression, "olhos_piscando">, string> = {
  olhos_normais:
    "M110 212 C162 176 252 174 280 208 C294 226 282 264 246 294 C204 328 136 324 114 290 C98 266 98 228 110 212 Z",
  olhos_semicerrados:
    "M114 240 C168 214 256 212 280 236 C292 248 280 274 246 290 C204 310 136 306 116 286 C104 274 106 248 114 240 Z",
  olhos_arregalados:
    "M96 190 C156 148 264 146 294 188 C312 214 296 264 252 302 C202 344 122 340 98 300 C80 270 84 208 96 190 Z",
};

const ORDER: Array<Exclude<Expression, "olhos_piscando">> = [
  "olhos_normais",
  "olhos_semicerrados",
  "olhos_arregalados",
];

export function SpiderMask({
  expression = "olhos_normais",
  speaking = false,
  listening = false,
}: {
  expression?: Expression;
  speaking?: boolean;
  listening?: boolean;
}) {
  const [blink, setBlink] = useState(false);
  const shape: Exclude<Expression, "olhos_piscando"> =
    expression === "olhos_piscando" ? "olhos_normais" : expression;

  // Explicit wink/blink expression
  useEffect(() => {
    if (expression !== "olhos_piscando") return;
    setBlink(true);
    const t = setTimeout(() => setBlink(false), 220);
    return () => clearTimeout(t);
  }, [expression]);

  // Idle life: automatic blink every ~15s
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 180);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ev-mask-wrap" data-speaking={speaking} data-listening={listening}>
      <svg viewBox="0 0 600 620" className="ev-mask" role="img" aria-label="Máscara da E.V.">
        <defs>
          <radialGradient id="maskFill" cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="var(--mask-red-hi)" />
            <stop offset="100%" stopColor="var(--mask-red-lo)" />
          </radialGradient>
          <linearGradient id="lensFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lens-hi)" />
            <stop offset="100%" stopColor="var(--lens-lo)" />
          </linearGradient>
          <filter id="lensGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* head */}
        <clipPath id="headClip">
          <path d="M300 36 C160 36 74 148 74 288 C74 404 140 524 242 582 C272 599 328 599 358 582 C460 524 526 404 526 288 C526 148 440 36 300 36 Z" />
        </clipPath>
        <path
          d="M300 36 C160 36 74 148 74 288 C74 404 140 524 242 582 C272 599 328 599 358 582 C460 524 526 404 526 288 C526 148 440 36 300 36 Z"
          fill="url(#maskFill)"
          stroke="var(--web-line)"
          strokeWidth="3"
        />

        {/* web: radial spokes */}
        <g stroke="var(--web-line)" strokeWidth="1.6" fill="none" opacity="0.55" clipPath="url(#headClip)">
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (Math.PI * 2 * i) / 16;
            return (
              <line
                key={i}
                x1={300}
                y1={300}
                x2={300 + Math.cos(a) * 320}
                y2={300 + Math.sin(a) * 340}
              />
            );
          })}
          {[70, 120, 170, 220, 270, 320].map((r) => (
            <ellipse key={r} cx={300} cy={300} rx={r} ry={r * 1.06} />
          ))}
        </g>

        {/* lenses */}
        <g className="ev-lenses" data-blink={blink} filter="url(#lensGlow)" transform="translate(300,265) scale(1.22) translate(-300,-265)">
          <g className="ev-lens ev-lens-left">
            {ORDER.map((k) => (
              <path
                key={k}
                d={LENS[k]}
                fill="url(#lensFill)"
                stroke="var(--lens-edge)"
                strokeWidth="7"
                className="ev-lens-path"
                data-active={k === shape}
              />
            ))}
          </g>
          <g className="ev-lens ev-lens-right" transform="translate(600,0) scale(-1,1)">
            {ORDER.map((k) => (
              <path
                key={k}
                d={LENS[k]}
                fill="url(#lensFill)"
                stroke="var(--lens-edge)"
                strokeWidth="7"
                className="ev-lens-path"
                data-active={k === shape}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
