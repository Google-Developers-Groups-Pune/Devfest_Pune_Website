import { gsap } from 'gsap';

/**
 * Background "burst": short Google-coloured dashes streaming out from a focal point, the way the
 * GDG Pune site's hero does. The focal point drifts toward the pointer. Static with reduced motion.
 */
const COLORS = [
  '#4285f4',
  '#57caff',
  '#34a853',
  '#5cdb6d',
  '#f9ab00',
  '#ffd427',
  '#ea4335',
  '#ff7daf',
];

type Dash = { angle: number; dist: number; speed: number; len: number; color: string };

export function startBurst(
  canvas: HTMLCanvasElement,
  focus: () => { x: number; y: number },
  { opacity = 0.85 }: { opacity?: number } = {},
) {
  const ctx = canvas.getContext('2d')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let maxDist = 0;
  let dashes: Dash[] = [];
  const center = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  // Colour follows direction, so each side of the burst has its own hue, like the reference.
  const colorFor = (angle: number) => {
    const t = ((angle + Math.PI) / (Math.PI * 2)) * COLORS.length;
    return COLORS[Math.floor(t + Math.random() * 0.8) % COLORS.length];
  };

  const spawn = (dist?: number): Dash => {
    const angle = Math.random() * Math.PI * 2;
    return {
      angle,
      dist: dist ?? 40 + Math.random() * 60,
      speed: 0.25 + Math.random() * 0.6,
      len: 6 + Math.random() * 10,
      color: colorFor(angle),
    };
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const f = focus();
    // Far enough to reach the furthest corner from the focal point.
    maxDist = Math.max(
      Math.hypot(f.x, f.y),
      Math.hypot(width - f.x, f.y),
      Math.hypot(f.x, height - f.y),
      Math.hypot(width - f.x, height - f.y),
    );
    Object.assign(center, f);
    Object.assign(target, f);
    const count = Math.round(Math.min(560, (width * height) / 2400));
    dashes = Array.from({ length: count }, () => spawn(Math.random() * maxDist * 0.8));
  };

  const draw = () => {
    center.x += (target.x - center.x) * 0.04;
    center.y += (target.y - center.y) * 0.04;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const d of dashes) {
      if (!reduce) {
        d.dist += d.speed * (1 + d.dist / 300);
        if (d.dist > maxDist) Object.assign(d, spawn());
      }
      const cos = Math.cos(d.angle);
      const sin = Math.sin(d.angle);
      // Fade in away from the centre so the middle stays calm behind the content.
      ctx.globalAlpha = Math.min(1, Math.max(0, (d.dist - 80) / 260)) * opacity;
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(center.x + cos * d.dist, center.y + sin * d.dist);
      ctx.lineTo(center.x + cos * (d.dist + d.len), center.y + sin * (d.dist + d.len));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  resize();
  window.addEventListener('resize', resize);

  if (reduce) {
    draw();
    return;
  }

  canvas.parentElement?.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const f = focus();
    // Lean a little toward the pointer rather than following it exactly.
    target.x = f.x + (e.clientX - rect.left - f.x) * 0.15;
    target.y = f.y + (e.clientY - rect.top - f.y) * 0.15;
  });

  // Only animate while the hero is on screen.
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) gsap.ticker.add(draw);
    else gsap.ticker.remove(draw);
  }).observe(canvas);
}
