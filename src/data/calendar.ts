import { mainData } from '.';

const { eventInfo } = mainData;

/** 2026-12-13T09:00:00+05:30 -> 20261213T033000Z (UTC, as calendars expect). */
function toUtcStamp(iso: string) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

const location = `${eventInfo.venue.name}, ${eventInfo.venue.address}`;
const details = `${eventInfo.description.short}\n\n${mainData.seo.hostUrl}`;

export const googleCalendarUrl =
  'https://calendar.google.com/calendar/render?' +
  new URLSearchParams({
    action: 'TEMPLATE',
    text: eventInfo.name,
    dates: `${toUtcStamp(eventInfo.startDate)}/${toUtcStamp(eventInfo.endDate)}`,
    details,
    location,
  }).toString();

/** Escape text for an iCalendar property value. */
const ics = (text: string) => text.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export const icsFileName = 'devfest-pune-2026.ics';

/** iCalendar lines longer than 75 characters are folded onto continuation lines. */
const fold = (line: string) => line.match(/.{1,74}/g)!.join('\r\n ');

export function buildIcs() {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GDG Pune//DevFest Pune//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:devfest-pune-2026@devfest.gdgpune.in`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(eventInfo.startDate)}`,
    `DTEND:${toUtcStamp(eventInfo.endDate)}`,
    `SUMMARY:${ics(eventInfo.name)}`,
    `DESCRIPTION:${ics(details)}`,
    `LOCATION:${ics(location)}`,
    `URL:${mainData.seo.hostUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
