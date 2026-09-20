// Business hours are stored as JSON: { "mon": "9:00-19:00", "sun": "closed", ... }
// (the format the original seed already used). Times are 24-hour, local to the
// business's timezone.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const RANGE_RE = /^([01]?\d|2[0-3]):([0-5]\d)-([01]?\d|2[0-3]):([0-5]\d)$/;

/** "9:00-19:00" -> { open: 540, close: 1140 } (minutes after midnight). "closed"/invalid -> null. */
export function parseRange(value) {
  if (typeof value !== 'string') return null;
  const m = RANGE_RE.exec(value.trim());
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  const close = Number(m[3]) * 60 + Number(m[4]);
  return close > open ? { open, close } : null;
}

/** Hours for a Luxon DateTime's weekday, or null when closed / not listed. */
export function hoursFor(hoursJson, dt) {
  if (!hoursJson) return null;
  return parseRange(hoursJson[DAY_KEYS[dt.weekday - 1]]);
}

/** True when at least one day has usable hours. Booking cannot be enabled without this. */
export function hasAnyHours(hoursJson) {
  return DAY_KEYS.some((d) => parseRange(hoursJson?.[d]));
}

/**
 * Validate hours coming from a form. Returns { ok: true, value } with only the seven
 * known keys kept, or { ok: false, error }.
 */
export function validateHours(input) {
  if (input == null) return { ok: true, value: null };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Hours must be an object with one entry per day.' };
  }
  const value = {};
  for (const day of DAY_KEYS) {
    const v = input[day];
    if (v === undefined || v === null || v === '') continue;
    if (v === 'closed') { value[day] = 'closed'; continue; }
    if (!parseRange(v)) {
      return { ok: false, error: `Hours for ${day} must look like "9:00-17:30" or "closed".` };
    }
    value[day] = v.trim();
  }
  return { ok: true, value: Object.keys(value).length ? value : null };
}

export function minutesToClock(min, { hour12 = true } = {}) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  if (!hour12) return `${h}:${m}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}
