// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Same domain and URL style as the current site, so Google keeps its indexed pages.
  site: 'https://devfest.gdgpune.in',
  // The live site serves every page at a trailing-slash URL (/agenda/), keep it that way.
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
  integrations: [sitemap()],
  // Pre-bundle GSAP when the dev server starts, so it never needs a mid-session re-optimise.
  vite: {
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', 'gsap/ScrambleTextPlugin', 'gsap/DrawSVGPlugin', 'gsap/Flip', 'gsap/Draggable', 'gsap/InertiaPlugin'],
    },
  },
  // Style guide typeface. Astro downloads it at build time and serves it from this site.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Google Sans Flex',
      cssVariable: '--font-sans',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      // Used for times on the agenda.
      provider: fontProviders.google(),
      name: 'Google Sans Code',
      cssVariable: '--font-code',
      weights: ['400 600'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
    {
      // Handwritten captions on the glimpses Polaroids.
      provider: fontProviders.google(),
      name: 'Caveat',
      cssVariable: '--font-hand',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['cursive'],
    },
  ],
});
