import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ParticleShape, icons, textShape } from './particles';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, DrawSVGPlugin);

const GOOGLE = ['#4285f4', '#ea4335', '#f9ab00', '#34a853'];
const $ = <T extends Element = HTMLElement>(s: string) => gsap.utils.toArray<T>(s);

/* ---------- particles ---------- */

const panelShapes = $<HTMLCanvasElement>('.experience canvas[data-icon]').map(
  (canvas) =>
    new ParticleShape(canvas, {
      shape: icons[canvas.dataset.icon!],
      colors: [canvas.dataset.color!],
      gap: 5,
      repel: 70,
    }),
);

const ctaCanvas = document.querySelector<HTMLCanvasElement>('.cta canvas');
const narrow = window.matchMedia('(max-width: 600px)').matches;
const ctaShape =
  ctaCanvas &&
  new ParticleShape(ctaCanvas, {
    // On phones the text goes on three lines with finer dots, so the letters stay legible.
    shape: textShape(
      narrow
        ? ['See you', 'on', ctaCanvas.dataset.text!.split('|')[1]]
        : ctaCanvas.dataset.text!.split('|'),
    ),
    colors: GOOGLE,
    // Bigger, denser dots, one Google colour per word, so the date reads strongly on white.
    gap: narrow ? 3 : 5,
    size: narrow ? [2.2, 2.8] : [3.6, 4.4],
    colorBy: 'word',
    repel: 90,
  });

// Re-sample once Google Sans Flex has loaded so the letters use the real font.
document.fonts.ready.then(() => ctaShape?.rebuild());

/* ---------- motion ---------- */

const mm = gsap.matchMedia();

mm.add(
  {
    motion: '(prefers-reduced-motion: no-preference)',
    wide: '(min-width: 900px)',
  },
  (context) => {
    const { motion, wide } = context.conditions as { motion: boolean; wide: boolean };

    if (!motion) {
      // Everything is shown in its final state.
      panelShapes.forEach((s) => s.snap());
      ctaShape?.snap();
      return;
    }

    // Hero: theme words drop in one by one, the colour bars draw, then the rest follows.
    gsap
      .timeline({ defaults: { ease: 'expo.out' } })
      .from('.hero .place', { y: 16, opacity: 0, duration: 0.6 })
      .from(
        '.hero .word',
        { yPercent: 60, opacity: 0, rotate: 4, duration: 0.9, stagger: 0.12 },
        '-=0.3',
      )
      .from(
        '.hero .word i',
        { scale: 0, duration: 0.6, ease: 'back.out(3)', stagger: 0.12 },
        '-=0.6',
      )
      .from('.hero .name, .hero .year', { y: 24, opacity: 0, duration: 0.8, stagger: 0.1 }, '-=0.5')
      .from(
        '.hero .bars i',
        { scaleX: 0, transformOrigin: 'left', duration: 0.6, stagger: 0.08 },
        '-=0.5',
      )
      .from(
        '.hero .lead, .hero .actions, .hero .facts > div',
        { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 },
        '-=0.4',
      )
      .from('.hero .media', { y: 40, opacity: 0, duration: 1.1, stagger: 0.12 }, 0);

    // Section headings decode themselves as they arrive.
    $('[data-scramble]').forEach((el) => {
      gsap.from(el, {
        duration: 1.2,
        scrambleText: { text: '', chars: '{}<>/01_', revealDelay: 0.2, speed: 0.5 },
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    // Counters.
    $('[data-count]').forEach((el) => {
      gsap.from(el, {
        textContent: 0,
        snap: { textContent: 1 },
        duration: 2,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    // What the day looks like: pinned horizontal scroll on wide screens.
    const panels = $('.experience .card-panel');
    if (wide) {
      const track = document.querySelector<HTMLElement>('.experience .track')!;
      const distance = () => track.scrollWidth - window.innerWidth;
      const scroll = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.experience',
          pin: true,
          scrub: 1,
          end: () => `+=${distance()}`,
          invalidateOnRefresh: true,
        },
      });
      gsap.to('.experience .progress i', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.experience',
          scrub: true,
          start: 'top top',
          end: () => `+=${distance()}`,
        },
      });
      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          containerAnimation: scroll,
          start: 'left 75%',
          onEnter: () => panelShapes[i].assemble(),
          onLeaveBack: () => panelShapes[i].scatter(),
        });
        gsap.from(panel.querySelector('h3'), {
          yPercent: 60,
          opacity: 0,
          duration: 1,
          ease: 'expo.out',
          scrollTrigger: { trigger: panel, containerAnimation: scroll, start: 'left 65%' },
        });
      });
    } else {
      panels.forEach((panel, i) => {
        ScrollTrigger.create({
          trigger: panel,
          start: 'top 70%',
          onEnter: () => panelShapes[i].assemble(),
          onLeaveBack: () => panelShapes[i].scatter(),
        });
      });
    }

    // Topic marquee: rows loop in opposite directions and speed up with scroll speed.
    const rows = $('.marquee .row').map((row) => {
      const dir = Number(row.dataset.direction);
      return gsap.fromTo(
        row,
        { xPercent: dir < 0 ? 0 : -50 },
        { xPercent: dir < 0 ? -50 : 0, duration: 40, ease: 'none', repeat: -1 },
      );
    });
    ScrollTrigger.create({
      trigger: '.marquee',
      onUpdate: (self) => {
        const boost = gsap.utils.clamp(1, 8, Math.abs(self.getVelocity()) / 200);
        rows.forEach((tween) => {
          tween.timeScale(boost);
          gsap.to(tween, { timeScale: 1, duration: 1.2, ease: 'power2.out', overwrite: true });
        });
      },
    });

    // Sponsor cards rise in.
    ScrollTrigger.batch('.title-card, .logo-marquee', {
      start: 'top 90%',
      once: true,
      onEnter: (batch) =>
        gsap.from(batch, { y: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12 }),
    });

    // Venue: roads draw in, then the pin drops with a bounce.
    const venue = document.querySelector('.venue');
    if (venue) {
      gsap
        .timeline({ scrollTrigger: { trigger: venue, start: 'top 75%' } })
        .from('.venue .roads path, .venue .river path', {
          drawSVG: 0,
          duration: 1.4,
          ease: 'power2.inOut',
          stagger: 0.15,
        })
        .from('.venue .pin', { y: -120, opacity: 0, duration: 0.9, ease: 'bounce.out' }, '-=0.4');
    }

    // Cards marked data-tilt lean toward the pointer in 3D.
    $('[data-tilt]').forEach((card) => {
      const rotateX = gsap.quickTo(card, 'rotateX', { duration: 0.5, ease: 'power3.out' });
      const rotateY = gsap.quickTo(card, 'rotateY', { duration: 0.5, ease: 'power3.out' });
      gsap.set(card, { transformPerspective: 900 });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        rotateY(((e.clientX - r.left) / r.width - 0.5) * 12);
        rotateX(-((e.clientY - r.top) / r.height - 0.5) * 12);
      });
      card.addEventListener('pointerleave', () => {
        rotateX(0);
        rotateY(0);
      });
    });

    // Sign-up: the date assembles from scattered particles.
    if (ctaCanvas && ctaShape) {
      ScrollTrigger.create({
        trigger: ctaCanvas,
        start: 'top 75%',
        onEnter: () => ctaShape.assemble(2.2),
        onLeaveBack: () => ctaShape.scatter(),
      });
    }
  },
);
