import { sessionsData } from '../data';

/** Sessions on this track are for everyone and span every column. */
export const COMMON_TRACK = 'Main Event';
/** Column colours, in track order. */
const TRACK_COLORS = ['blue', 'red', 'yellow', 'green'] as const;

export type AgendaSession = {
  id: string;
  title: string;
  description: string;
  track: string;
  start: number; // minutes after midnight
  end: number;
  startLabel: string; // "10:30"
  endLabel: string;
  speakers: { name: string; role: string }[];
  common: boolean;
  isBreak: boolean;
  kind: 'Talk' | 'Panel' | 'Break' | 'Keynote' | 'Everyone';
  topics: string[];
};

/** Topic filters, matched against each session's title and description. */
export const TOPICS = [
  {
    id: 'ai',
    label: 'AI & agents',
    match: /\b(ai|agents?|agentic|gemini|gen ?ai|llm|adk|a2a|mcp|genkit)\b/i,
  },
  { id: 'security', label: 'Security', match: /secur|saif|\brisks?\b/i },
  {
    id: 'cloud',
    label: 'Cloud & platform',
    match: /cloud|platform|monitoring|workflow|enterprise/i,
  },
  { id: 'mobile', label: 'Mobile', match: /android|flutter|compose|navigation 3/i },
  { id: 'web', label: 'Web', match: /\bweb|react|website/i },
  {
    id: 'product',
    label: 'Product & careers',
    match: /product|career|founder|leading|teams?\b|business|fail forward|startup/i,
  },
] as const;

function kindOf(title: string, common: boolean, speakers: number): AgendaSession['kind'] {
  if (/break|lunch|registration/i.test(title)) return 'Break';
  if (/^panel/i.test(title)) return 'Panel';
  if (common) return speakers > 0 ? 'Keynote' : 'Everyone';
  return 'Talk';
}

// "10:30 AM to 11:00 AM (GMT +05:30)" -> [630, 660]
function parseRange(time: string): [number, number] {
  const times = [...time.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)].map(
    ([, h, m, p]) => ((Number(h) % 12) + (p.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m),
  );
  return [times[0] ?? 0, times[1] ?? times[0] ?? 0];
}

const label = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// "Jane Doe (Engineer at Google)" -> { name: "Jane Doe", role: "Engineer at Google" }
function parseSpeaker(text: string) {
  const i = text.indexOf(' (');
  return i < 0
    ? { name: text, role: '' }
    : { name: text.slice(0, i), role: text.slice(i + 2).replace(/\)$/, '') };
}

// The same session id listed under several tracks (e.g. the closing note) is one shared session.
const tracksById = new Map<string, Set<string>>();
for (const s of sessionsData) {
  tracksById.set(s.id, (tracksById.get(s.id) ?? new Set()).add(s.track));
}

const seen = new Set<string>();
export const sessions: AgendaSession[] = sessionsData
  .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
  .map((s) => {
    const [start, end] = parseRange(s.time);
    const common = s.track === COMMON_TRACK || tracksById.get(s.id)!.size > 1;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      track: common ? COMMON_TRACK : s.track,
      start,
      end,
      startLabel: label(start),
      endLabel: label(end),
      speakers: s.speakers.map(parseSpeaker),
      common,
      isBreak: common && s.speakers.length === 0,
      kind: kindOf(s.title, common, s.speakers.length),
      topics: TOPICS.filter((t) => t.match.test(`${s.title} ${s.description}`)).map((t) => t.id),
    };
  })
  .sort((a, b) => a.start - b.start || a.end - b.end);

/** Parallel tracks in the order they first appear, each with a colour. */
export const tracks = [...new Set(sessions.filter((s) => !s.common).map((s) => s.track))].map(
  (name, i) => ({ name, color: TRACK_COLORS[i % TRACK_COLORS.length] }),
);

/** Every distinct start time is a grid row. */
export const rowStarts = [...new Set(sessions.map((s) => s.start))].sort((a, b) => a - b);

/** Grid placement: shared sessions take a full row; track sessions span until they end. */
export function placement(session: AgendaSession) {
  const row = rowStarts.indexOf(session.start) + 2; // row 1 is the header
  if (session.common) return { row, rowSpan: 1, column: 2, columnSpan: tracks.length };
  const rowSpan = Math.max(
    1,
    rowStarts.filter((t) => t >= session.start && t < session.end).length,
  );
  const column = tracks.findIndex((t) => t.name === session.track) + 2; // column 1 is time
  return { row, rowSpan, column, columnSpan: 1 };
}

/** The date in sessions.json, e.g. "Nov 29, 2025". */
export const eventDate = sessionsData[0]?.date ?? '';

/** Headline numbers for the agenda page. */
export const stats = {
  sessions: sessions.filter((s) => s.kind === 'Talk' || s.kind === 'Panel' || s.kind === 'Keynote')
    .length,
  speakers: new Set(sessions.flatMap((s) => s.speakers.map((p) => p.name))).size,
  tracks: tracks.length,
  hours: Math.round(
    (Math.max(...sessions.map((s) => s.end)) - Math.min(...sessions.map((s) => s.start))) / 60,
  ),
};
