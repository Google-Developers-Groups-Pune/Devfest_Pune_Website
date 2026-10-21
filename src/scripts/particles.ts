import { gsap } from 'gsap';

/** Draws the target shape on an offscreen canvas; particles settle on its filled pixels. */
export type Shape = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

type Particle = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  ox: number;
  oy: number;
  c: string;
  s: number;
};

type Options = {
  shape: Shape;
  /** One colour, or several spread left to right (Google blue, red, yellow, green). */
  colors: string[];
  /** Pixels between sampled points. Lower is denser. */
  gap?: number;
  /** Particle size in px, as [min, max]. Defaults to the style guide's 2-3px. */
  size?: [number, number];
  /** How much neighbouring colour bands bleed into each other (0 = clean edges). */
  blend?: number;
  /** Colour left to right across the canvas, or one colour per word of a textShape. */
  colorBy?: 'position' | 'word';
  /** Radius around the pointer that pushes particles away. 0 turns it off. */
  repel?: number;
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Canvas particles that scatter and assemble into a shape (style guide 07: scattered to
 * assembled, 2-3px particles). Only renders while on screen.
 */
export class ParticleShape {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private pointer = { x: -9999, y: -9999 };
  private visible = false;
  private assembled = false;
  private observer: IntersectionObserver;
  private resizeObserver: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private options: Options,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.build();

    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) gsap.ticker.add(this.render);
      else gsap.ticker.remove(this.render);
    });
    this.observer.observe(canvas);

    let timer: number;
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => this.build(), 150);
    });
    this.resizeObserver.observe(canvas);

    if (options.repel) {
      const host = canvas.parentElement ?? canvas;
      host.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      });
      host.addEventListener('pointerleave', () => (this.pointer = { x: -9999, y: -9999 }));
    }
  }

  rebuild() {
    this.build();
  }

  private build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    if (!this.width || !this.height) return;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const off = document.createElement('canvas');
    off.width = this.width;
    off.height = this.height;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    o.fillStyle = o.strokeStyle = '#000';
    this.options.shape(o, this.width, this.height);
    const data = o.getImageData(0, 0, this.width, this.height).data;

    const gap = this.options.gap ?? 6;
    const { colors } = this.options;
    const [minSize, maxSize] = this.options.size ?? [2, 3];
    const points: Particle[] = [];
    for (let y = 0; y < this.height; y += gap) {
      for (let x = 0; x < this.width; x += gap) {
        if (data[(y * this.width + x) * 4 + 3] < 128) continue;
        const band =
          this.options.colorBy === 'word'
            ? // textShape paints word n with red channel n * WORD_STEP; read it back.
              Math.round(data[(y * this.width + x) * 4] / WORD_STEP) % colors.length
            : Math.floor(
                (x / this.width) * colors.length + Math.random() * (this.options.blend ?? 0.5),
              );
        points.push({
          tx: x,
          ty: y,
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          ox: 0,
          oy: 0,
          c: colors[Math.min(band, colors.length - 1)],
          s: minSize + Math.random() * (maxSize - minSize),
        });
      }
    }
    this.particles = points;
    if (this.assembled || reduceMotion()) this.snap();
  }

  /** Jump straight to the assembled shape (used for reduced motion). */
  snap() {
    this.assembled = true;
    for (const p of this.particles) {
      p.x = p.tx;
      p.y = p.ty;
    }
  }

  assemble(duration = 1.6) {
    this.assembled = true;
    if (reduceMotion()) return this.snap();
    gsap.to(this.particles, {
      x: (i) => this.particles[i].tx,
      y: (i) => this.particles[i].ty,
      duration,
      ease: 'expo.inOut',
      stagger: { amount: duration * 0.4, from: 'random' },
      overwrite: true,
    });
  }

  scatter(duration = 0.8) {
    this.assembled = false;
    if (reduceMotion()) return;
    gsap.to(this.particles, {
      x: () => Math.random() * this.width,
      y: () => Math.random() * this.height,
      duration,
      ease: 'power3.out',
      overwrite: true,
    });
  }

  private render = () => {
    const { ctx, pointer } = this;
    const radius = this.options.repel ?? 0;
    const r2 = radius * radius;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const p of this.particles) {
      if (radius) {
        const dx = p.x + p.ox - pointer.x;
        const dy = p.y + p.oy - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const force = ((r2 - d2) / r2) * 4;
          const d = Math.sqrt(d2) || 1;
          p.ox += (dx / d) * force;
          p.oy += (dy / d) * force;
        }
        p.ox *= 0.9;
        p.oy *= 0.9;
      }
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x + p.ox, p.y + p.oy, p.s, p.s);
    }
  };
}

/** Red-channel spacing used to tell words apart when colouring by word. */
const WORD_STEP = 24;

/** Text fitted to the canvas, one entry per line. Each word is painted in its own code colour. */
export function textShape(lines: string[], weight = 700): Shape {
  return (ctx, w, h) => {
    const family = getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${weight} 100px ${family}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const size = Math.min((w * 0.92 * 100) / widest, (h * 0.86) / (lines.length * 1.02));
    ctx.font = `${weight} ${size}px ${family}`;
    const top = h / 2 - ((lines.length - 1) * size * 1.02) / 2;
    const space = ctx.measureText(' ').width;
    let word = 0;
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      const words = line.split(' ');
      let x = w / 2 - ctx.measureText(line).width / 2;
      for (const text of words) {
        ctx.fillStyle = `rgb(${word++ * WORD_STEP}, 0, 0)`;
        ctx.fillText(text, x, top + i * size * 1.02);
        x += ctx.measureText(text).width + space;
      }
    });
  };
}

/** Line icons for the "what to expect" panels, drawn with thick strokes. */
export const icons: Record<string, Shape> = {
  // </> : technical content
  code: (ctx, w, h) => {
    const s = Math.min(w, h) * 0.8;
    const cx = w / 2;
    const cy = h / 2;
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.18, cy - s * 0.3);
    ctx.lineTo(cx - s * 0.46, cy);
    ctx.lineTo(cx - s * 0.18, cy + s * 0.3);
    ctx.moveTo(cx + s * 0.18, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.46, cy);
    ctx.lineTo(cx + s * 0.18, cy + s * 0.3);
    ctx.moveTo(cx + s * 0.08, cy - s * 0.38);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.38);
    ctx.stroke();
  },
  // Two speech bubbles: panel discussions
  talk: (ctx, w, h) => {
    const s = Math.min(w, h) * 0.8;
    const cx = w / 2;
    const cy = h / 2;
    ctx.lineWidth = s * 0.07;
    ctx.lineJoin = 'round';
    const bubble = (x: number, y: number, bw: number, bh: number, tail: 1 | -1) => {
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, bh * 0.3);
      ctx.moveTo(x + bw / 2 - tail * bw * 0.15, y + bh);
      ctx.lineTo(x + bw / 2 - tail * bw * 0.3, y + bh + bh * 0.35);
      ctx.lineTo(x + bw / 2, y + bh);
      ctx.stroke();
    };
    bubble(cx - s * 0.48, cy - s * 0.42, s * 0.6, s * 0.36, 1);
    bubble(cx - s * 0.1, cy + s * 0.02, s * 0.58, s * 0.32, -1);
  },
  // Connected nodes: networking
  network: (ctx, w, h) => {
    const s = Math.min(w, h) * 0.8;
    const cx = w / 2;
    const cy = h / 2;
    const nodes = [
      [0, 0],
      [-0.36, -0.28],
      [0.38, -0.3],
      [-0.4, 0.3],
      [0.34, 0.34],
    ].map(([x, y]) => [cx + x * s, cy + y * s]);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    for (const [x, y] of nodes.slice(1)) {
      ctx.moveTo(nodes[0][0], nodes[0][1]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    nodes.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, s * (i === 0 ? 0.13 : 0.09), 0, Math.PI * 2);
      ctx.fill();
    });
  },
};
