import { useEffect, useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

// Left lens outlines for each emotional state (right lens is mirrored).
const LENS: Record<Exclude<Expression, "olhos_piscando">, string> = {
  olhos_normais: "M96 96 C130 66 186 62 214 84 C226 94 224 118 204 140 C176 170 124 176 100 152 C84 136 84 108 96 96 Z",
  olhos_semicerrados: "M96 116 C132 96 190 92 216 106 C226 112 222 130 202 140 C172 154 122 156 102 142 C90 134 88 122 96 116 Z",
  olhos_arregalados: "M84 88 C122 50 194 46 222 76 C238 92 234 126 208 152 C176 184 114 190 88 162 C68 140 70 104 84 88 Z",
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
        <path
          d="M300 20 C170 20 78 118 78 268 C78 420 176 570 300 600 C424 570 522 420 522 268 C522 118 430 20 300 20 Z"
          fill="url(#maskFill)"
          stroke="var(--web-line)"
          strokeWidth="3"
        />

        {/* web: radial spokes */}
        <g stroke="var(--web-line)" strokeWidth="1.6" fill="none" opacity="0.55">
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
        <g className="ev-lenses" data-blink={blink} filter="url(#lensGlow)">
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
