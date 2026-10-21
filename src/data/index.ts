// Single entry point for site content, like useJSONData() on the previous Nuxt site.
// Edit the JSON files in this folder to update content; pages never hard-code it.
import mainData from './config.json';
import faqData from './faq.json';
import scheduleData from './schedule.json';
import sessionsData from './sessions.json';
import speakersData from './speakers.json';
import sponsorsData from './sponsors.json';
import partnersData from './partners.json';
import organizingTeamData from './organizingTeam.json';
import teamData from './team.json';
import teamLeadsData from './teamLeads.json';
import cocData from './coc.json';
import navbarData from './navbar.json';

export {
  mainData,
  faqData,
  scheduleData,
  sessionsData,
  speakersData,
  sponsorsData,
  partnersData,
  organizingTeamData,
  teamData,
  teamLeadsData,
  cocData,
  navbarData,
};

/** Same rule as the old site: registration is open while it has a link and end_date is ahead. */
export function isRegistrationOpen(now = new Date()) {
  const { link, end_date } = mainData.eventInfo.registeration;
  return link.length > 0 && new Date(end_date) > now;
}
