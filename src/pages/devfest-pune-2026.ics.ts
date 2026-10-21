import type { APIRoute } from 'astro';
import { buildIcs } from '../data/calendar';

// Static calendar file behind the hero's "Add to Calendar" > "Apple / Outlook (.ics)".
export const GET: APIRoute = () =>
  new Response(buildIcs(), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
