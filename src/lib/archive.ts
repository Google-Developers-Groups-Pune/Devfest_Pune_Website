/**
 * The archive loader.
 *
 * Every past edition lives in its own folder under src/data/archive/<year>/, holding up to
 * four JSON files. This module discovers those folders, normalises them into one shape and
 * derives the numbers the page shows. A missing file degrades to an empty section; it never
 * breaks the build.
 */

export type ArchiveSessionKind = 'Talk' | 'Panel' | 'Keynote' | 'Break' | 'Everyone' | 'Workshop';
export type ArchiveTrackKind = 'common' | 'track' | 'lounge';
export type ArchiveColor = 'blue' | 'red' | 'yellow' | 'green';

export type ArchiveSession = {
  id: string;
  title: string;
  description: string;
  start: string; // "HH:MM", 24-hour, Pune local
  end: string; // "HH:MM"
  kind: ArchiveSessionKind;
  speakers: string[]; // names
};

export type ArchiveTrack = {
  id: string;
  name: string;
  kind: ArchiveTrackKind;
  color: ArchiveColor;
  sessions: ArchiveSession[];
};

export type ArchiveSpeaker = {
  name: string;
  role: string;
  moderator: boolean;
  image?: string; // the JSON holds a bare filename; the loader resolves it to
  // "/img/archive/<year>/speakers/<filename>"
  links: { label: string; url: string }[];
};

export type ArchiveSponsor = { name: string; logo: string; link: string };
export type ArchiveTier = { category: string; color: string; sponsors: ArchiveSponsor[] };

export type ArchiveEvent = {
  year: string;
  name: string;
  date: string;
  venue: { name: string; address: string };
  summary: string;
  stats: { name: string; value: string }[];
  stages: string[];
};

export type ArchiveStats = {
  speakers: number;
  participants: string;
  sessions: number;
  tracks: number;
};

export type ArchiveEdition = {
  year: string;
  event: ArchiveEvent;
  speakers: ArchiveSpeaker[];
  tiers: ArchiveTier[];
  tracks: ArchiveTrack[]; // all kinds, in file order
  stats: ArchiveStats;
};

export type ArchiveCell = {
  session: ArchiveSession;
  row: number;
  rowSpan: number;
  column: number;
  columnSpan: number;
};

export type ArchiveGrid = {
  columns: ArchiveTrack[]; // kind === 'track' only
  rowStarts: string[]; // distinct start times, ascending
  cells: ArchiveCell[]; // common + track sessions, in reading order
  empties: { row: number; column: number }[];
};

export type ArchiveSpeakerRow = ArchiveSpeaker & {
  sessions: ArchiveSession[];
  color: ArchiveColor;
  initials: string;
};

/* ------------------------------------------------------------------ discovery */

/** The files an edition folder may hold. A folder with none of them is not an edition. */
const EDITION_FILES = ['event', 'speakers', 'sponsors', 'schedule'] as const;
type EditionFile = (typeof EDITION_FILES)[number];

/** Glob keys look like "../data/archive/2025/event.json": <year>/<kind>.json. */
const ARCHIVE_KEY = /^\.\.\/data\/archive\/([^/]+)\/([^/]+)\.json$/;
/** A year folder is four digits; anything else is not an edition. */
const YEAR = /^\d{4}$/;

const files = import.meta.glob<{ default: unknown }>('../data/archive/*/*.json', { eager: true });

type RawFiles = Partial<Record<EditionFile, unknown>>;

const isEditionFile = (kind: string): kind is EditionFile =>
  (EDITION_FILES as readonly string[]).includes(kind);

/** Group the glob by year, keeping only the four files an edition is made of. */
const rawByYear = new Map<string, RawFiles>();
for (const [key, module] of Object.entries(files)) {
  const match = ARCHIVE_KEY.exec(key);
  if (!match) continue;
  const [, year, kind] = match;
  if (!YEAR.test(year) || !isEditionFile(kind)) continue;
  const group = rawByYear.get(year) ?? {};
  group[kind] = module.default;
  rawByYear.set(year, group);
}

/* -------------------------------------------------------------- normalisation */

type RawEvent = {
  year?: string;
  name?: string;
  date?: string;
  venue?: { name?: string; address?: string };
  summary?: string;
  stats?: { name?: string; value?: string }[];
  stages?: string[];
};

type RawSession = {
  id?: string;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  kind?: string;
  speakers?: string[];
};

type RawTrack = {
  id?: string;
  name?: string;
  kind?: string;
  color?: string;
  sessions?: RawSession[];
};

type RawSpeaker = {
  name?: string;
  role?: string;
  moderator?: boolean;
  image?: string;
  links?: { label?: string; url?: string }[];
};

type RawSponsor = { name?: string; logo?: string; link?: string };
type RawTier = { category?: string; color?: string; sponsors?: RawSponsor[] };

/** Column colours, in track order — the same rotation the live agenda uses. */
const COLORS: readonly ArchiveColor[] = ['blue', 'red', 'yellow', 'green'];
const SESSION_KINDS: readonly ArchiveSessionKind[] = [
  'Talk',
  'Panel',
  'Keynote',
  'Break',
  'Everyone',
  'Workshop',
];
const TRACK_KINDS: readonly ArchiveTrackKind[] = ['common', 'track', 'lounge'];
/** A common track reads as yellow and the lounge as green, as on the live pages. */
const TRACK_COLORS: Record<ArchiveTrackKind, ArchiveColor> = {
  common: 'yellow',
  track: 'blue',
  lounge: 'green',
};

const list = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

const toSessionKind = (value: string | undefined): ArchiveSessionKind =>
  SESSION_KINDS.includes(value as ArchiveSessionKind) ? (value as ArchiveSessionKind) : 'Talk';

const toTrackKind = (value: string | undefined): ArchiveTrackKind =>
  TRACK_KINDS.includes(value as ArchiveTrackKind) ? (value as ArchiveTrackKind) : 'track';

const toColor = (value: string | undefined): ArchiveColor | undefined =>
  COLORS.includes(value as ArchiveColor) ? (value as ArchiveColor) : undefined;

const toSession = (raw: RawSession): ArchiveSession => ({
  id: raw.id ?? '',
  title: raw.title ?? '',
  description: raw.description ?? '',
  start: raw.start ?? '',
  end: raw.end ?? '',
  kind: toSessionKind(raw.kind),
  speakers: list(raw.speakers).filter((name): name is string => typeof name === 'string'),
});

const toTracks = (raw: RawTrack[]): ArchiveTrack[] => {
  // The colour rotation counts the track-kind tracks only, so a common track or a lounge
  // never pushes a stage track along the palette.
  let trackIndex = 0;
  return raw.map((track) => {
    const kind = toTrackKind(track.kind);
    const fallback = kind === 'track' ? COLORS[trackIndex % COLORS.length] : TRACK_COLORS[kind];
    if (kind === 'track') trackIndex += 1;
    return {
      id: track.id ?? '',
      name: track.name ?? '',
      kind,
      color: toColor(track.color) ?? fallback,
      sessions: list(track.sessions).map(toSession),
    };
  });
};

const toSpeakers = (raw: RawSpeaker[], year: string): ArchiveSpeaker[] =>
  raw.map((speaker) => ({
    name: speaker.name ?? '',
    role: speaker.role ?? '',
    moderator: speaker.moderator ?? false,
    image: speaker.image ? `/img/archive/${year}/speakers/${speaker.image}` : undefined,
    links: list(speaker.links).map((link) => ({
      label: link.label ?? '',
      url: link.url ?? '',
    })),
  }));

const toTiers = (raw: RawTier[], year: string): ArchiveTier[] =>
  raw.map((tier) => ({
    category: tier.category ?? '',
    color: tier.color ?? '',
    sponsors: list(tier.sponsors).map((sponsor) => ({
      name: sponsor.name ?? '',
      logo: sponsor.logo ? `/img/archive/${year}/sponsors/${sponsor.logo}` : '',
      link: sponsor.link ?? '',
    })),
  }));

const toEvent = (raw: RawEvent | undefined, year: string): ArchiveEvent => ({
  year: raw?.year ?? year,
  name: raw?.name ?? year,
  date: raw?.date ?? '',
  venue: { name: raw?.venue?.name ?? '', address: raw?.venue?.address ?? '' },
  summary: raw?.summary ?? '',
  stats: list(raw?.stats).map((stat) => ({ name: stat.name ?? '', value: stat.value ?? '' })),
  stages: list(raw?.stages),
});

/**
 * The canonical session list: a session id listed under several tracks is one session, and
 * the common track's copy wins, so a shared session keeps its common kind — the same rule
 * src/lib/agenda.ts applies to the closing note.
 */
const canonicalSessions = (
  tracks: ArchiveTrack[],
): { session: ArchiveSession; track: ArchiveTrack }[] => {
  const canonical = new Map<string, { session: ArchiveSession; track: ArchiveTrack }>();
  for (const track of tracks) {
    for (const session of track.sessions) {
      const held = canonical.get(session.id);
      if (!held || (held.track.kind !== 'common' && track.kind === 'common')) {
        canonical.set(session.id, { session, track });
      }
    }
  }
  return [...canonical.values()];
};

/** The headline numbers, always counted from the data so they cannot drift. */
const deriveStats = (
  event: ArchiveEvent,
  speakers: ArchiveSpeaker[],
  tracks: ArchiveTrack[],
): ArchiveStats => {
  const sessions = canonicalSessions(tracks).map(({ session }) => session);
  return {
    speakers: speakers.length,
    participants: event.stats.find((stat) => stat.name === 'Participants')?.value ?? '—',
    sessions: sessions.filter(
      (session) =>
        session.kind === 'Talk' || session.kind === 'Panel' || session.kind === 'Keynote',
    ).length,
    // The lounge ran in parallel with the stage tracks, so the live agenda counts it too.
    tracks: tracks.filter((track) => track.kind === 'track' || track.kind === 'lounge').length,
  };
};

const toEdition = (year: string, raw: RawFiles): ArchiveEdition => {
  const event = toEvent(raw.event as RawEvent | undefined, year);
  const speakers = toSpeakers(list(raw.speakers as RawSpeaker[]), year);
  const tiers = toTiers(list((raw.sponsors as { tiers?: RawTier[] } | undefined)?.tiers), year);
  const tracks = toTracks(list((raw.schedule as { tracks?: RawTrack[] } | undefined)?.tracks));
  return { year, event, speakers, tiers, tracks, stats: deriveStats(event, speakers, tracks) };
};

/** Every edition on the site, newest year first. */
export const editions: ArchiveEdition[] = [...rawByYear.entries()]
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([year, raw]) => toEdition(year, raw));

/* ----------------------------------------------------------------- the grid */

/** Grid placement, mirroring src/lib/agenda.ts: row 1 is the header, column 1 is the time. */
export function buildGrid(edition: ArchiveEdition): ArchiveGrid {
  const columns = edition.tracks.filter((track) => track.kind === 'track');
  // The lounge is a separate band below the grid, so it has no column and no row.
  const gridTracks = edition.tracks.filter(
    (track) => track.kind === 'common' || track.kind === 'track',
  );

  const columnOf = new Map<ArchiveTrack, number>();
  let column = 2;
  for (const track of edition.tracks) {
    if (track.kind === 'track') columnOf.set(track, column++);
  }

  const placed = gridTracks.flatMap((track) =>
    track.sessions.map((session) => ({ session, track })),
  );

  // A session id listed under more than one track is one shared session, not one per track.
  const tracksOf = new Map<string, Set<ArchiveTrack>>();
  for (const entry of placed) {
    const seen = tracksOf.get(entry.session.id) ?? new Set<ArchiveTrack>();
    seen.add(entry.track);
    tracksOf.set(entry.session.id, seen);
  }

  const rowStarts = [...new Set(placed.map(({ session }) => session.start))].sort();

  const cells: ArchiveCell[] = [];
  const emitted = new Set<string>();
  for (const { session, track } of placed) {
    if (emitted.has(session.id)) continue;
    emitted.add(session.id);
    const row = rowStarts.indexOf(session.start) + 2;
    if (track.kind === 'common' || (tracksOf.get(session.id)?.size ?? 0) > 1) {
      // A span of zero is not valid markup, so an edition with no stage tracks still
      // gives its common cells a column to sit in.
      cells.push({ session, row, rowSpan: 1, column: 2, columnSpan: Math.max(1, columns.length) });
    } else {
      const rowSpan = Math.max(
        1,
        rowStarts.filter((start) => start >= session.start && start < session.end).length,
      );
      cells.push({
        session,
        row,
        rowSpan,
        column: columnOf.get(track) ?? 2,
        columnSpan: 1,
      });
    }
  }
  // Reading order, row by row, so the stacked mobile view reads top to bottom.
  cells.sort((a, b) => a.row - b.row || a.column - b.column);

  // Every slot a cell does not cover gets a placeholder, so the column dividers stay continuous.
  const taken = new Set<string>();
  for (const cell of cells) {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let col = cell.column; col < cell.column + cell.columnSpan; col++) {
        taken.add(`${r}:${col}`);
      }
    }
  }
  const empties: { row: number; column: number }[] = [];
  for (let r = 0; r < rowStarts.length; r++) {
    for (let col = 0; col < columns.length; col++) {
      if (!taken.has(`${r + 2}:${col + 2}`)) empties.push({ row: r + 2, column: col + 2 });
    }
  }

  return { columns, rowStarts, cells, empties };
}

/* ---------------------------------------------------------------- speakers */

/** The first letter of the first two capitalised words, as on the live speakers page. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^[A-Z]/.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** One row per speaker, joined to the sessions they appear in. */
export function speakerRows(edition: ArchiveEdition): ArchiveSpeakerRow[] {
  // The same session id listed under several tracks is one session, so it is listed once.
  // The common track wins, so a shared session keeps the common colour.
  const all = canonicalSessions(edition.tracks).sort(
    (a, b) =>
      a.session.start.localeCompare(b.session.start) || a.session.end.localeCompare(b.session.end),
  );

  return edition.speakers.map((speaker) => {
    const entries = all.filter(({ session }) =>
      session.speakers.some((name) => sameName(name, speaker.name)),
    );
    const first = entries[0];
    const color: ArchiveColor = !first
      ? 'blue'
      : first.track.kind === 'common'
        ? 'yellow'
        : first.track.kind === 'lounge'
          ? 'green'
          : first.track.color;
    return {
      ...speaker,
      sessions: entries.map(({ session }) => session),
      color,
      initials: initials(speaker.name),
    };
  });
}
