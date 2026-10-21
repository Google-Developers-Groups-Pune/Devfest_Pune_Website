import { organizingTeamData, teamLeadsData, teamData } from '../data';

type Color = 'blue' | 'red' | 'yellow' | 'green';

/** Squads group the free-text roles in team.json ("Website Development, Design"). */
export const squads = [
  { id: 'anchoring', label: 'Anchoring', color: 'red', match: /anchor/i },
  { id: 'content', label: 'Content', color: 'blue', match: /content/i },
  { id: 'design', label: 'Design', color: 'yellow', match: /design/i },
  { id: 'web', label: 'Web & dev', color: 'green', match: /develop/i },
  { id: 'media', label: 'Photo & video', color: 'red', match: /photo|video/i },
  { id: 'social', label: 'Social & PR', color: 'blue', match: /social|\bpr\b/i },
  { id: 'partners', label: 'Partnerships', color: 'green', match: /startup|sponsor|collab/i },
] as const satisfies readonly { id: string; label: string; color: Color; match: RegExp }[];

export type SquadId = (typeof squads)[number]['id'];

export type Member = {
  slug: string;
  name: string;
  /** Job title outside DevFest, e.g. "DevOps Engineer". */
  title: string;
  bio: string;
  image?: string;
  links: { label: string; url: string }[];
  lead: boolean;
  /** Squads in the order they appear in the role text; the first is the main one. */
  squads: SquadId[];
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const key = (name: string) => name.trim().toLowerCase();

function squadsFor(role: string): SquadId[] {
  return squads
    .map((s) => ({ id: s.id, at: role.search(s.match) }))
    .filter((s) => s.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((s) => s.id);
}

const linksOf = (social: { linkType: string; url: string }[]) =>
  social.filter((s) => s.url).map((s) => ({ label: s.linkType, url: s.url }));

export const organizers = organizingTeamData.map((m) => ({
  slug: slugify(m.name),
  name: m.name,
  role: m.company.name,
  bio: m.bio ?? '',
  image: m.image,
  links: linksOf(m.social),
}));

// Leads are also listed in team.json, so merge the two lists into one entry per person.
const volunteersByName = new Map<string, Raw>(teamData.map((m) => [key(m.name), m]));
const leadNames = new Set(teamLeadsData.map((m) => key(m.name)));

type Raw = {
  name: string;
  company: { name: string };
  community_title?: string;
  bio?: string;
  image?: string;
  social: { linkType: string; url: string }[];
};

const toMember = (m: Raw, lead: boolean): Member => {
  const other = volunteersByName.get(key(m.name));
  return {
    slug: slugify(m.name),
    name: m.name.trim(),
    title: m.community_title || other?.community_title || '',
    bio: (m.bio || other?.bio || '').trim(),
    image: m.image || other?.image,
    links: linksOf(m.social.some((s) => s.url) ? m.social : (other?.social ?? [])),
    lead,
    squads: squadsFor(m.company.name),
  };
};

/** Everyone on the crew, leads first, then A to Z. */
export const crew: Member[] = [
  ...teamLeadsData.map((m) => toMember(m, true)),
  ...teamData.filter((m) => !leadNames.has(key(m.name))).map((m) => toMember(m, false)),
].sort((a, b) => Number(b.lead) - Number(a.lead) || a.name.localeCompare(b.name));

export const squadCounts = Object.fromEntries(
  squads.map((s) => [s.id, crew.filter((m) => m.squads.includes(s.id)).length]),
) as Record<SquadId, number>;

export const squadById = Object.fromEntries(squads.map((s) => [s.id, s])) as Record<
  SquadId,
  (typeof squads)[number]
>;
