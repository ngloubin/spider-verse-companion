import type { CSSProperties } from "react";
import { useState } from "react";

export type Expression =
  | "olhos_normais"
  | "olhos_semicerrados"
  | "olhos_arregalados"
  | "olhos_piscando";

/**
 * PRIMARY 3D MODEL ROUTE — this is the asset rendered by the live interface.
 * The old PNG/SVG mask assets, if present elsewhere in the repository, are
 * legacy/fallback references only and are not used by this component.
 */
export const SPIDER_MAN_3D_MODEL_ID = "5e47c63e3dd4436f86e838cfaa334447";
export const SPIDER_MAN_3D_SOURCE = "https://sketchfab.com/3d-models/spider-man-5e47c63e3dd4436f86e838cfaa334447";
export const SPIDER_MAN_3D_EMBED_URL = `https://sketchfab.com/models/${SPIDER_MAN_3D_MODEL_ID}/embed?autostart=1&autospin=0&preload=1&transparent=1&ui_controls=0&ui_infos=0&ui_watermark=0&ui_stop=0&ui_hint=0&ui_theme=dark&dnt=1`;

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
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const modelStyle = { "--mask-tilt-x": `${tilt.x}deg`, "--mask-tilt-y": `${tilt.y}deg` } as CSSProperties;

  return <div
    className="ev-mask-wrap ev-mask-3d-primary"
    data-renderer="sketchfab-3d"
    data-model-id={SPIDER_MAN_3D_MODEL_ID}
    data-speaking={speaking}
    data-listening={listening}
    data-thinking={thinking}
    data-expression={expression}
    data-loaded={loaded}
    style={modelStyle}
    onPointerMove={(event) => {
      const box = event.currentTarget.getBoundingClientRect();
      setTilt({ x: ((event.clientX - box.left) / box.width - 0.5) * 5, y: ((event.clientY - box.top) / box.height - 0.5) * -4 });
    }}
    onPointerLeave={() => setTilt({ x: 0, y: 0 })}
  >
    <div className="ev-model-stage">
      <div className="ev-model-backlight" />
      {!loaded && <div className="ev-model-loading"><span /><span /><span /></div>}
      <iframe
        title="Homem-Aranha 3D — referência Sketchfab"
        src={SPIDER_MAN_3D_EMBED_URL}
        loading="eager"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      <div className="ev-model-sheen" />
    </div>
    <a className="model-credit" href={SPIDER_MAN_3D_SOURCE} target="_blank" rel="noreferrer">3D model: Spider-Man · Kuzzy · Sketchfab · CC BY 4.0</a>
  </div>;
}
