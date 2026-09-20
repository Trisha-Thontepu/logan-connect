import { DateTime } from 'luxon';
import { hoursFor } from '../lib/hours.js';

// Turns free-text like "gel manicure friday 2pm", "mañana a las 10", or "9/25 at 3:30"
// into a real date and time in the business's timezone. Understands English and Spanish.
//
// It only ever returns what the text actually said: a day, a time, both, or neither.
// The booking engine decides what to do with a partial answer, so a message like
// "friday" is not silently turned into a made-up appointment time.

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const WEEKDAYS = [
  [1, ['monday', 'mon', 'lunes', 'lun']],
  [2, ['tuesday', 'tues', 'tue', 'martes', 'mar']],
  [3, ['wednesday', 'weds', 'wed', 'miercoles', 'mie']],
  [4, ['thursday', 'thurs', 'thur', 'thu', 'jueves', 'jue']],
  [5, ['friday', 'fri', 'viernes', 'vie']],
  [6, ['saturday', 'sat', 'sabado', 'sab']],
  [7, ['sunday', 'sun', 'domingo', 'dom']],
];
const WEEKDAY_LOOKUP = new Map(WEEKDAYS.flatMap(([n, words]) => words.map((w) => [w, n])));
const WEEKDAY_RE = new RegExp(
  `\\b(next |this |proximo |este |el )?(${[...WEEKDAY_LOOKUP.keys()].sort((a, b) => b.length - a.length).join('|')})\\b`
);

// "mar" is not accepted as a month (it means Tuesday), so March must be written out.
const MONTHS = new Map([
  ['january', 1], ['jan', 1], ['enero', 1],
  ['february', 2], ['feb', 2], ['febrero', 2],
  ['march', 3], ['marzo', 3],
  ['april', 4], ['apr', 4], ['abril', 4],
  ['may', 5], ['mayo', 5],
  ['june', 6], ['jun', 6], ['junio', 6],
  ['july', 7], ['jul', 7], ['julio', 7],
  ['august', 8], ['aug', 8], ['agosto', 8],
  ['september', 9], ['sept', 9], ['sep', 9], ['septiembre', 9], ['setiembre', 9],
  ['october', 10], ['oct', 10], ['octubre', 10],
  ['november', 11], ['nov', 11], ['noviembre', 11],
  ['december', 12], ['dec', 12], ['diciembre', 12],
]);
const MONTH_ALT = [...MONTHS.keys()].sort((a, b) => b.length - a.length).join('|');
const MONTH_DAY_RE = new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`);
const DAY_MONTH_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+|of\\s+)?(${MONTH_ALT})\\b`);
const NUMERIC_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

const PM_PHRASE_RE =
  /\b(de la tarde|por la tarde|en la tarde|de la noche|por la noche|in the afternoon|in the evening|this afternoon|this evening|esta tarde|esta noche|tonight)\b/;
const AM_PHRASE_RE =
  /\b(de la manana|por la manana|en la manana|in the morning|this morning|esta manana)\b/;
const TODAY_PHRASE_RE = /\b(this afternoon|this evening|this morning|esta tarde|esta noche|esta manana|tonight)\b/;

const DAY_AFTER_TOMORROW_RE = /\b(day after tomorrow|pasado manana)\b/;
const TOMORROW_RE = /\b(tomorrow|tmrw|tmr|manana)\b/;
const TODAY_RE = /\b(today|hoy)\b/;

/** Pull the first match of `re` out of `text`; returns [match, textWithMatchBlanked]. */
function take(re, text) {
  const m = re.exec(text);
  if (!m) return [null, text];
  return [m, text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)];
}

function extractTime(text, { hasDayWord }) {
  let m;
  if ((m = /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/.exec(text))) {
    return { hour: Number(m[1]), minute: Number(m[2]), meridiem: m[3] || null };
  }
  if ((m = /\b(\d{1,2})\s*(am|pm)\b/.exec(text))) {
    return { hour: Number(m[1]), minute: 0, meridiem: m[2] };
  }
  if ((m = /\b(noon|mediodia)\b/.exec(text))) {
    return { hour: 12, minute: 0, meridiem: 'pm' };
  }
  if ((m = /\b(?:at|around|about|a las|a la|las|la|@)\s*(\d{1,2})\b(?!\s*[:/])/.exec(text))) {
    return { hour: Number(m[1]), minute: 0, meridiem: null };
  }
  // "thursday 3": a lone trailing number is only a time when a day was also given.
  if (hasDayWord && (m = /(?:^|\s)(\d{1,2})\s*$/.exec(text.trimEnd()))) {
    return { hour: Number(m[1]), minute: 0, meridiem: null };
  }
  return null;
}

// Decide am/pm for a bare hour ("at 3"). Prefer whichever reading falls inside the
// business's opening hours that day; otherwise fall back to what people usually mean
// (1-6 -> afternoon, 7-11 -> morning, 12 -> noon).
function resolveHour({ hour, minute, meridiem }, marker, range) {
  if (hour > 23 || minute > 59) return null;
  if (hour === 0 || hour >= 13) return { hour, minute };

  const mer = meridiem || marker;
  if (mer === 'am') return { hour: hour % 12, minute };
  if (mer === 'pm') return { hour: (hour % 12) + 12, minute };

  const am = hour % 12;
  const pm = am + 12;
  const inside = (h) => range && h * 60 + minute >= range.open && h * 60 + minute < range.close;
  if (range && inside(am) !== inside(pm)) return { hour: inside(am) ? am : pm, minute };
  if (hour === 12) return { hour: 12, minute };
  return { hour: hour <= 6 ? pm : am, minute };
}

function fromMonthDay(month, day, today, now) {
  let d = DateTime.fromObject({ year: today.year, month, day }, { zone: now.zone });
  if (d.isValid && d < today) d = d.plus({ years: 1 });
  return d.isValid ? d : null;
}

/**
 * @param {string} text
 * @param {{ now: import('luxon').DateTime, hours?: object|null }} ctx
 *   `now` must already be in the business's timezone. `hours` is the business's hours_json,
 *   used only to decide whether a bare "3" means 3am or 3pm.
 * @returns {{ date: DateTime|null, time: {hour:number, minute:number}|null, dt: DateTime|null }}
 */
export function parseWhen(text, { now, hours = null }) {
  let t = ` ${normalize(text).replace(/\b([ap])\.\s?m\.?/g, '$1m')} `;
  const today = now.startOf('day');

  // Period-of-day phrases ("de la tarde") set am/pm and must be removed before the
  // day words are read, because "manana" alone means tomorrow but "de la manana" means morning.
  let marker = null;
  if (PM_PHRASE_RE.test(t)) marker = 'pm';
  if (AM_PHRASE_RE.test(t)) marker = 'am';
  const impliesToday = TODAY_PHRASE_RE.test(t);
  t = t.replace(PM_PHRASE_RE, ' ').replace(AM_PHRASE_RE, ' ');

  let date = null;
  let weekday = null;
  let weekdayStrict = false;
  let hit;

  // 1) explicit calendar dates
  [hit, t] = take(NUMERIC_DATE_RE, t);
  if (hit) {
    const month = Number(hit[1]);
    const day = Number(hit[2]);
    let year = hit[3] ? Number(hit[3]) : today.year;
    if (hit[3] && hit[3].length === 2) year += 2000;
    let d = DateTime.fromObject({ year, month, day }, { zone: now.zone });
    if (d.isValid && !hit[3] && d < today) d = d.plus({ years: 1 });
    if (d.isValid) date = d;
  } else {
    [hit, t] = take(MONTH_DAY_RE, t);
    if (hit) {
      date = fromMonthDay(MONTHS.get(hit[1]), Number(hit[2]), today, now);
    } else {
      [hit, t] = take(DAY_MONTH_RE, t);
      if (hit) date = fromMonthDay(MONTHS.get(hit[2]), Number(hit[1]), today, now);
    }
  }

  // 2) relative words
  if (!date) {
    if (DAY_AFTER_TOMORROW_RE.test(t)) { date = today.plus({ days: 2 }); t = t.replace(DAY_AFTER_TOMORROW_RE, ' '); }
    else if (TOMORROW_RE.test(t)) { date = today.plus({ days: 1 }); t = t.replace(TOMORROW_RE, ' '); }
    else if (TODAY_RE.test(t) || impliesToday) { date = today; t = t.replace(TODAY_RE, ' '); }
  }

  // 3) weekday names
  if (!date) {
    [hit, t] = take(WEEKDAY_RE, t);
    if (hit) {
      weekday = WEEKDAY_LOOKUP.get(hit[2]);
      weekdayStrict = /^(next|proximo)/.test((hit[1] || '').trim());
    }
  }

  const rawTime = extractTime(t, { hasDayWord: Boolean(date || weekday) });

  // Work out the day for a weekday name now that we know whether a time was given.
  const resolveWeekday = (timeParts) => {
    let diff = (weekday - today.weekday + 7) % 7;
    if (diff === 0 && weekdayStrict) diff = 7;
    let d = today.plus({ days: diff });
    if (diff === 0 && timeParts && d.set(timeParts) <= now) d = d.plus({ days: 7 });
    return d;
  };

  let time = null;
  if (rawTime) {
    const refDate = date || (weekday ? resolveWeekday(null) : today);
    time = resolveHour(rawTime, marker, hoursFor(hours, refDate));
  }
  if (weekday) date = resolveWeekday(time);

  const dt = date && time ? date.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 }) : null;
  return { date, time, dt };
}
