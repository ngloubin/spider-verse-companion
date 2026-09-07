import { useEffect, useMemo, useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

type Shape = Exclude<Expression, "olhos_piscando">;

/**
 * Left lens outlines (right lens is mirrored) — teardrop shape of the
 * live-action mask: wide rounded outer corner, sharp inner point.
 */
const LENS: Record<Shape, string> = {
  olhos_normais:
    "M268 352 C246 306 196 254 140 240 C104 231 78 248 76 282 C73 322 118 356 176 364 C224 371 280 376 268 352 Z",
  olhos_semicerrados:
    "M268 356 C250 328 206 292 152 280 C116 272 92 288 92 314 C92 340 132 360 184 366 C230 371 280 376 268 356 Z",
  olhos_arregalados:
    "M272 348 C250 292 194 224 128 202 C86 188 56 212 54 258 C51 312 112 358 176 368 C232 377 286 378 272 348 Z",
};

const ORDER: Shape[] = ["olhos_normais", "olhos_semicerrados", "olhos_arregalados"];

/** Anatomical head silhouette: broad cranium, tapered jaw, rounded chin. */
const HEAD =
  "M300 24 C214 24 146 62 108 128 C76 184 68 250 78 318 C90 400 124 476 176 536 C214 580 256 606 300 606 C344 606 386 580 424 536 C476 476 510 400 522 318 C532 250 524 184 492 128 C454 62 386 24 300 24 Z";

const WEB_CX = 300;
const WEB_CY = 322;
const SPOKES = 20;
const RINGS = [54, 104, 158, 216, 280, 350, 428, 512];

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Point on the web grid, shaped to follow the curvature of the head. */
function webPoint(angle: number, radius: number, sag = 0) {
  const rx = radius * 0.94;
  const ry = radius * 1.16;
  // bulge outwards near the middle of the face, tighten near the chin
  const vertical = Math.sin(angle);
  const squeeze = 1 - 0.13 * Math.max(0, vertical) - 0.05 * Math.max(0, -vertical);
  const k = (1 - sag) * squeeze;
  return {
    x: r2(WEB_CX + Math.cos(angle) * rx * k),
    y: r2(WEB_CY + Math.sin(angle) * ry * k),
  };
}

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

  /** Radial threads, gently curved so they wrap around the volume. */
  const spokes = useMemo(
    () =>
      Array.from({ length: SPOKES }).map((_, i) => {
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / SPOKES;
        const inner = webPoint(a, 26);
        const mid = webPoint(a + 0.05, 300);
        const outer = webPoint(a, 620);
        return `M${inner.x} ${inner.y} Q${mid.x} ${mid.y} ${outer.x} ${outer.y}`;
      }),
    [],
  );

  /** Concentric threads that sag between each pair of spokes. */
  const rings = useMemo(
    () =>
      RINGS.map((radius) => {
        const steps = SPOKES * 4;
        let d = "";
        for (let i = 0; i <= steps; i++) {
          const a = -Math.PI / 2 + (Math.PI * 2 * i) / steps;
          const phase = (i % 4) / 4;
          const sag = 0.055 * Math.sin(phase * Math.PI);
          const p = webPoint(a, radius, sag);
          d += `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
          if (i < steps) d += " ";
        }
        return `${d} Z`;
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
          {/* base fabric colour with key light from above-left */}
          <radialGradient id="maskFill" cx="40%" cy="22%" r="86%">
            <stop offset="0%" stopColor="var(--mask-red-hi)" />
            <stop offset="42%" stopColor="var(--mask-red-mid)" />
            <stop offset="100%" stopColor="var(--mask-red-lo)" />
          </radialGradient>

          {/* rim light hugging the right edge */}
          <linearGradient id="rimLight" x1="0" y1="0.2" x2="1" y2="0.9">
            <stop offset="0%" stopColor="oklch(1 0 0 / 0)" />
            <stop offset="78%" stopColor="oklch(1 0 0 / 0)" />
            <stop offset="100%" stopColor="oklch(0.8 0.12 30 / 0.5)" />
          </linearGradient>

          <radialGradient id="lensFill" cx="34%" cy="30%" r="82%">
            <stop offset="0%" stopColor="var(--lens-hi)" />
            <stop offset="52%" stopColor="var(--lens-mid)" />
            <stop offset="100%" stopColor="var(--lens-lo)" />
          </radialGradient>

          <linearGradient id="sheen" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="oklch(1 0 0 / 0.75)" />
            <stop offset="100%" stopColor="oklch(1 0 0 / 0)" />
          </linearGradient>

          {/* woven fabric texture */}
          <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="oklch(0 0 0 / 0)" />
            <path d="M0 0 L6 6" stroke="oklch(0 0 0 / 0.16)" strokeWidth="1" />
            <path d="M6 0 L0 6" stroke="oklch(1 0 0 / 0.05)" strokeWidth="1" />
          </pattern>

          {/* perforated lens mesh */}
          <pattern id="lensMesh" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.25" fill="oklch(0.35 0.02 250 / 0.5)" />
            <circle cx="5.5" cy="5.5" r="1.25" fill="oklch(0.35 0.02 250 / 0.5)" />
          </pattern>

          <filter id="lensGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="softShade" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="26" />
          </filter>

          <clipPath id="headClip">
            <path d={HEAD} />
          </clipPath>
        </defs>

        {/* head */}
        <path d={HEAD} fill="url(#maskFill)" />

        <g clipPath="url(#headClip)">
          {/* fabric weave */}
          <path d={HEAD} fill="url(#weave)" opacity="0.55" />

          {/* volumetric shading: temples, cheeks, chin, brow */}
          <g filter="url(#softShade)">
            <ellipse cx="92" cy="330" rx="96" ry="270" fill="oklch(0 0 0 / 0.4)" />
            <ellipse cx="508" cy="330" rx="96" ry="270" fill="oklch(0 0 0 / 0.34)" />
            <ellipse cx="300" cy="648" rx="230" ry="180" fill="oklch(0 0 0 / 0.42)" />
            <ellipse cx="248" cy="140" rx="180" ry="110" fill="oklch(1 0 0 / 0.1)" />
            <ellipse cx="300" cy="470" rx="120" ry="90" fill="oklch(0 0 0 / 0.18)" />
          </g>

          {/* nose / brow definition */}
          <path
            d="M300 372 C286 400 282 432 300 452 C318 432 314 400 300 372 Z"
            fill="oklch(0 0 0 / 0.16)"
            filter="url(#softShade)"
          />

          {/* web: curved radial threads + sagging rings */}
          <g className="ev-web" fill="none" strokeLinecap="round">
            <g stroke="var(--web-shadow)" strokeWidth="4" transform="translate(1.5,2.5)">
              {spokes.map((d, i) => (
                <path key={`ss-${i}`} d={d} />
              ))}
              {rings.map((d, i) => (
                <path key={`rs-${i}`} d={d} />
              ))}
            </g>
            <g stroke="var(--web-line)" strokeWidth="3">
              {spokes.map((d, i) => (
                <path key={`sp-${i}`} d={d} />
              ))}
            </g>
            <g stroke="var(--web-line)" strokeWidth="2.4">
              {rings.map((d, i) => (
                <path key={`rg-${i}`} d={d} />
              ))}
            </g>
          </g>

          {/* rim light */}
          <path d={HEAD} fill="url(#rimLight)" />
        </g>

        {/* lens sockets: thick black bevelled rim */}
        <g transform="translate(300,326) scale(0.88) translate(-300,-330)">
          <g className="ev-lens-rim">
            <g transform="translate(-30,0)">
            {ORDER.map((k) => (
              <path
                key={`l-${k}`}
                d={LENS[k]}
                fill="var(--lens-edge)"
                stroke="var(--lens-edge)"
                strokeWidth="30"
                strokeLinejoin="round"
                className="ev-lens-path"
                data-active={k === shape}
              />
            ))}
            </g>
            <g transform="translate(600,0) scale(-1,1) translate(-30,0)">

              {ORDER.map((k) => (
                <path
                  key={`r-${k}`}
                  d={LENS[k]}
                  fill="var(--lens-edge)"
                  stroke="var(--lens-edge)"
                  strokeWidth="30"
                  strokeLinejoin="round"
                  className="ev-lens-path"
                  data-active={k === shape}
                />
              ))}
            </g>
          </g>

          {/* lenses */}
          <g className="ev-lenses" data-blink={blink} filter="url(#lensGlow)">
            <g transform="translate(-30,0)">
              {ORDER.map((k) => (
                <g key={`ll-${k}`} className="ev-lens-path" data-active={k === shape}>
                  <path d={LENS[k]} fill="url(#lensFill)" />
                  <path d={LENS[k]} fill="url(#lensMesh)" opacity="0.5" />
                  <path d={LENS[k]} fill="url(#sheen)" opacity="0.35" />
                </g>
              ))}
            </g>
            <g transform="translate(600,0) scale(-1,1) translate(-30,0)">
              {ORDER.map((k) => (
                <g key={`rl-${k}`} className="ev-lens-path" data-active={k === shape}>
                  <path d={LENS[k]} fill="url(#lensFill)" />
                  <path d={LENS[k]} fill="url(#lensMesh)" opacity="0.5" />
                  <path d={LENS[k]} fill="url(#sheen)" opacity="0.35" />
                </g>
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
