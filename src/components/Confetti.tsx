import { useEffect, useRef } from 'react';

const COLORS = ['#5b3df5', '#ff7a59', '#22c55e', '#facc15', '#ec4899', '#38bdf8'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
}

/** Self-contained canvas confetti (no dependency). Skipped when the user prefers reduced motion. */
export function Confetti({ duration = 3500 }: { duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? 0 : w,
        y: h * 0.7,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9),
        vy: -(9 + Math.random() * 11),
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length],
      };
    });

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = t > duration - 800 ? Math.max(0, (duration - t) / 800) : 1;
      for (const p of pieces) {
        p.vy += 0.32; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
