import { useEffect, useId, useMemo, useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

type Shape = Exclude<Expression, "olhos_piscando">;

const LENS: Record<Shape, string> = {
  olhos_normais:
    "M270 341 C249 302 210 264 156 244 C116 229 86 239 83 271 C80 306 122 341 178 352 C225 361 283 362 270 341 Z",
  olhos_semicerrados:
    "M270 345 C249 324 213 297 161 282 C124 271 97 281 96 303 C95 329 132 350 184 358 C230 364 283 365 270 345 Z",
  olhos_arregalados:
    "M274 338 C251 286 205 236 143 210 C99 192 66 209 61 250 C55 297 111 349 177 362 C235 373 288 369 274 338 Z",
};

const ORDER: Shape[] = ["olhos_normais", "olhos_semicerrados", "olhos_arregalados"];
const HEAD =
  "M300 24 C187 24 104 95 78 207 C54 313 82 423 157 517 C207 580 258 610 300 610 C342 610 393 580 443 517 C518 423 546 313 522 207 C496 95 413 24 300 24 Z";

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
  const rawId = useId();
  const ids = useMemo(() => {
    const id = rawId.replace(/:/g, "");
    return {
      fill: `${id}-mask-fill`,
      lens: `${id}-lens-fill`,
      sheen: `${id}-sheen`,
      clip: `${id}-head-clip`,
      glow: `${id}-lens-glow`,
    };
  }, [rawId]);

  useEffect(() => {
    if (expression !== "olhos_piscando") return;
    setBlink(true);
    const timeout = window.setTimeout(() => setBlink(false), 190);
    return () => window.clearTimeout(timeout);
  }, [expression]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 150);
    }, 7000 + Math.random() * 6000);
    return () => window.clearInterval(interval);
  }, []);

  const spokes = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 22;
        return {
          x1: Math.round((300 + Math.cos(angle) * 8) * 100) / 100,
          y1: Math.round((300 + Math.sin(angle) * 8) * 100) / 100,
          x2: Math.round((300 + Math.cos(angle) * 470) * 100) / 100,
          y2: Math.round((300 + Math.sin(angle) * 505) * 100) / 100,
        };
      }),
    [],
  );

  return (
    <div className="ev-mask-wrap" data-speaking={speaking} data-listening={listening} data-thinking={thinking}>
      <svg viewBox="0 0 600 650" className="ev-mask" role="img" aria-label="Máscara da E.V.">
        <defs>
          <radialGradient id={ids.fill} cx="43%" cy="18%" r="86%">
            <stop offset="0%" stopColor="var(--mask-red-hi)" />
            <stop offset="52%" stopColor="var(--mask-red-mid)" />
            <stop offset="100%" stopColor="var(--mask-red-lo)" />
          </radialGradient>
          <linearGradient id={ids.lens} x1="0.12" y1="0" x2="0.82" y2="1">
            <stop offset="0%" stopColor="var(--lens-hi)" />
            <stop offset="50%" stopColor="var(--lens-mid)" />
            <stop offset="100%" stopColor="var(--lens-lo)" />
          </linearGradient>
          <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="38%" stopColor="white" stopOpacity="0.18" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id={ids.glow} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={ids.clip}><path d={HEAD} /></clipPath>
        </defs>

        <path d={HEAD} fill={`url(#${ids.fill})`} />
        <g clipPath={`url(#${ids.clip})`}>
          <ellipse cx="300" cy="90" rx="232" ry="160" fill="white" opacity="0.08" />
          <ellipse cx="300" cy="650" rx="280" ry="230" fill="black" opacity="0.38" />
          <ellipse cx="105" cy="360" rx="140" ry="300" fill="black" opacity="0.23" />
          <ellipse cx="495" cy="360" rx="140" ry="300" fill="black" opacity="0.23" />
          <path d="M112 108 Q300 26 488 108 L470 150 Q300 89 130 150 Z" fill="white" opacity="0.035" />
        </g>

        <g clipPath={`url(#${ids.clip})`} className="ev-web">
          <g stroke="var(--web-line)" strokeWidth="2.35" fill="none" strokeLinecap="round">
            {spokes.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
          </g>
          <g stroke="var(--web-line)" strokeWidth="1.9" fill="none">
            {[44, 88, 138, 198, 270, 350, 438].map((r) => <ellipse key={r} cx="300" cy="294" rx={r} ry={r * 1.09} />)}
          </g>
        </g>

        <g transform="translate(0,-5)">
          <g className="ev-lens-rim">
            {ORDER.map((key) => <path key={`left-rim-${key}`} d={LENS[key]} fill="var(--lens-edge)" stroke="var(--lens-edge)" strokeWidth="24" strokeLinejoin="round" className="ev-lens-path" data-active={key === shape} />)}
            <g transform="translate(600,0) scale(-1,1)">{ORDER.map((key) => <path key={`right-rim-${key}`} d={LENS[key]} fill="var(--lens-edge)" stroke="var(--lens-edge)" strokeWidth="24" strokeLinejoin="round" className="ev-lens-path" data-active={key === shape} />)}</g>
          </g>
          <g className="ev-lenses" data-blink={blink} filter={`url(#${ids.glow})`}>
            <g>{ORDER.map((key) => <path key={`left-${key}`} d={LENS[key]} fill={`url(#${ids.lens})`} className="ev-lens-path" data-active={key === shape} />)}</g>
            <g transform="translate(600,0) scale(-1,1)">{ORDER.map((key) => <path key={`right-${key}`} d={LENS[key]} fill={`url(#${ids.lens})`} className="ev-lens-path" data-active={key === shape} />)}</g>
            <g opacity="0.42"><path d="M106 248 L236 240 L198 288 L96 294 Z" fill={`url(#${ids.sheen})`} /><path d="M364 240 L494 248 L504 294 L402 288 Z" fill={`url(#${ids.sheen})`} /></g>
          </g>
        </g>
      </svg>
    </div>
  );
}
