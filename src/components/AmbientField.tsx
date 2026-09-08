import { useEffect, useRef } from "react";

export type EvState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "tool"
  | "error";

type P = { x: number; y: number; z: number; vx: number; vy: number; r: number };

const TONE: Record<EvState, [number, number, number]> = {
  idle: [180, 205, 230],
  listening: [110, 205, 255],
  thinking: [150, 175, 255],
  speaking: [255, 120, 120],
  tool: [130, 255, 210],
  error: [255, 90, 90],
};

const SPEED: Record<EvState, number> = {
  idle: 0.1,
  listening: 0.28,
  thinking: 0.5,
  speaking: 0.42,
  tool: 0.36,
  error: 0.2,
};

/**
 * Very light particle atmosphere: dust drifting around the mask, drawn on a
 * single canvas so it never costs more than a few percent of a frame.
 */
export function AmbientField({ state = "idle", energy = 0 }: { state?: EvState; energy?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const energyRef = useRef(energy);

  stateRef.current = state;
  energyRef.current = energy;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let parts: P[] = [];

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(120, Math.max(40, (w * h) / 14000)));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.25 + Math.random() * 0.75,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 0.5 + Math.random() * 1.4,
      }));
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);

    const mouse = { x: -999, y: -999 };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let smooth = 0;
    let t = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      t += 0.016;
      const st = stateRef.current;
      const [cr, cg, cb] = TONE[st];
      const target = SPEED[st] * (0.6 + energyRef.current * 0.9);
      smooth += (target - smooth) * 0.03;

      ctx.clearRect(0, 0, w, h);

      const cxm = w / 2;
      const cym = h * 0.45;

      for (const p of parts) {
        // slow organic drift + a soft pull towards the mask centre
        const ang = Math.sin(p.x * 0.004 + t * 0.25) + Math.cos(p.y * 0.005 - t * 0.2);
        p.vx += Math.cos(ang) * 0.004;
        p.vy += Math.sin(ang) * 0.004;

        const dxc = cxm - p.x;
        const dyc = cym - p.y;
        const dc = Math.hypot(dxc, dyc) || 1;
        p.vx += (dxc / dc) * 0.0025 * smooth;
        p.vy += (dyc / dc) * 0.0025 * smooth;

        // pointer repulsion, keeps the field feeling alive under the cursor
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < 130) {
          p.vx += (dx / (d || 1)) * 0.12;
          p.vy += (dy / (d || 1)) * 0.12;
        }

        p.vx *= 0.965;
        p.vy *= 0.965;
        p.x += p.vx * (0.5 + smooth) * (reduced ? 0.2 : 1);
        p.y += p.vy * (0.5 + smooth) * (reduced ? 0.2 : 1);

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const near = 1 - Math.min(1, dc / (Math.max(w, h) * 0.55));
        const alpha = (0.06 + near * 0.22) * p.z * (0.65 + energyRef.current * 0.5);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r * p.z * (1 + energyRef.current * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className="ev-field" aria-hidden />;
}
