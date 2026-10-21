import { speakersData } from '../data';
import { sessions, tracks, COMMON_TRACK, type AgendaSession } from './agenda';

export type Speaker = {
  slug: string;
  name: string;
  role: string;
  moderator: boolean;
  photo?: string;
  links: { label: string; url: string }[];
  session: AgendaSession;
  color: 'blue' | 'red' | 'yellow' | 'green';
};

// speakers.json adds photos and social links for some speakers; match them by name.
const extras = new Map(speakersData.map((s) => [s.name.trim().toLowerCase(), s]));

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const colorFor = (session: AgendaSession): Speaker['color'] =>
  session.track === COMMON_TRACK
    ? 'yellow'
    : (tracks.find((t) => t.name === session.track)?.color ?? 'blue');

/** Every speaker in the agenda, with their session. People with photos come first. */
export const speakers: Speaker[] = sessions
  .flatMap((session) =>
    session.speakers.map(({ name, role }) => {
      const extra = extras.get(name.trim().toLowerCase());
      // "Moderator | Engineering Director, Academian" -> moderator flag + role
      const moderator = /^moderator\b/i.test(role);
      return {
        slug: slugify(name),
        name,
        role: role.replace(/^moderator\s*\|\s*/i, '') || extra?.company.designation || '',
        moderator,
        photo: extra?.image ? `/img/speakers/${extra.image}` : undefined,
        links: extra
          ? Object.entries(extra.social)
              .filter(([, url]) => url)
              .map(([label, url]) => ({ label, url }))
          : [],
        session,
        color: colorFor(session),
      };
    }),
  )
  .sort((a, b) => Number(!!b.photo) - Number(!!a.photo) || a.name.localeCompare(b.name));

export const speakerStats = {
  speakers: speakers.length,
  talks: new Set(speakers.filter((s) => s.session.kind === 'Talk').map((s) => s.session.id)).size,
  panels: new Set(speakers.filter((s) => s.session.kind === 'Panel').map((s) => s.session.id)).size,
  moderators: speakers.filter((s) => s.moderator).length,
};

/** Filter chips: one per parallel track, plus the main hall. */
export const trackFilters = [
  ...tracks.map((t) => ({ id: slugify(t.name), label: t.name, color: t.color })),
  { id: slugify(COMMON_TRACK), label: 'Main hall', color: 'yellow' as const },
];
export const trackId = (track: string) => slugify(track);
