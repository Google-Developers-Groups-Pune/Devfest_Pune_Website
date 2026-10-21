# DevFest Pune 2026

Website for DevFest Pune 2026 by GDG Pune, built with [Astro](https://astro.build) as a fully
static site and deployed to Firebase Hosting at https://devfest.gdgpune.in.

## Getting started

Requires Node.js 22.22+.

```sh
npm install
npm run dev       # http://localhost:4321
```

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Start the dev server                            |
| `npm run build`   | Type-check (`astro check`) and build to `dist/` |
| `npm run preview` | Serve the production build locally              |
| `npm run format`  | Format everything with Prettier                 |

## Updating content

Content lives in `src/data/*.json`, in the same files and shapes as the previous Nuxt site, so
content can be copied across as-is. `src/data/index.ts` imports them all (like the old
`useJSONData()`), and pages read from there. Images go in `public/img/<section>/` and are
referenced from JSON by filename only.

| File                                                 | Controls                                          |
| ---------------------------------------------------- | ------------------------------------------------- |
| `config.json`                                        | Event name, date, venue, registration, stats, SEO |
| `navbar.json`                                        | Navigation links (`visible`, `mobileMenuOnly`)    |
| `speakers.json`                                      | Speakers (photos in `public/img/speakers/`)       |
| `sessions.json`                                      | Agenda sessions                                   |
| `sponsors.json`, `partners.json`                     | Sponsor tiers and community partners              |
| `team.json`, `teamLeads.json`, `organizingTeam.json` | Team page (photos in `public/img/team/`)          |
| `faq.json`, `coc.json`                               | FAQ and Code of Conduct                           |

`config.json` → `eventInfo.startDate` / `endDate` are ISO dates used for Google's Event rich
results. Keep them in sync with the human-readable `date` and `time`.

Registration opens when `eventInfo.registeration.link` is set and `end_date` is in the future.
The site is static, so **rebuild and deploy** after changing it.

## Design system

The site follows the DevFest Pune _Website style guide_ (light theme only). All of it lives as
CSS variables in `src/styles/global.css`: the 16 approved colours, the Google Sans Flex type
scale (desktop and mobile), 4px spacing steps, radii (8 / 16 / 24 / pill), the 1200px layout
with a 24px gutter, and shared classes for buttons (`.button`, `.button--secondary`,
`.button--outline`), chips (`.chip`, `.chip--red|green|yellow`) and cards (`.card`). Use the
variables in components rather than raw colours or sizes.

Google Sans Flex is configured in `astro.config.mjs` and served from the site itself.

## SEO and the switch from the old site

The new site keeps everything Google has already indexed:

- Same domain (`site` in `astro.config.mjs`) and the same trailing-slash URLs (`/agenda/`,
  `/speakers/`, `/sponsors/`, `/team/`, `/faq/`, `/coc/`, `/register/`, `/badge/`).
- Same page titles (`Agenda - DevFest Pune 2026 | GDG Pune`) and description.
- Same Google Analytics property (`G-05RNMF45V4`), loaded in production builds only.

It adds a canonical URL per page, `lang="en"`, a sitemap, `robots.txt` pointing to it, and
Event, Organization and FAQ structured data. After launch, submit
`https://devfest.gdgpune.in/sitemap-index.xml` in Google Search Console.

## Deploying

```sh
npm run build
firebase deploy --only hosting
```

`firebase.json` serves `dist/` with trailing-slash URLs and long caching for hashed assets.
