import { DateTime } from 'luxon';
import { hoursFor } from '../lib/hours.js';

export const MIN_LEAD_MIN = 60; // can't book something starting within the hour
export const MAX_DAYS_AHEAD = 60;
export const SLOT_STEP_MIN = 30;

// Appointments in these states hold a slot. Demo bookings from the website widget
// never do, otherwise anyone playing with the demo could block a real customer.
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'reminded'];

/**
 * Is a requested start time bookable, ignoring other customers' appointments?
 * Returns { ok: true } or { ok: false, reason, range }.
 */
export function checkSlot(business, startDt, durationMin, now) {
  if (startDt < now.plus({ minutes: MIN_LEAD_MIN })) {
    return { ok: false, reason: startDt <= now ? 'past' : 'too_soon' };
  }
  if (startDt > now.plus({ days: MAX_DAYS_AHEAD })) return { ok: false, reason: 'too_far' };

  const range = hoursFor(business.hours_json, startDt);
  if (!range) return { ok: false, reason: 'closed_day' };

  const startMin = startDt.hour * 60 + startDt.minute;
  if (startMin < range.open || startMin + durationMin > range.close) {
    return { ok: false, reason: 'outside_hours', range };
  }
  return { ok: true, range };
}

/** How many active appointments overlap [start, end)? `db` is a pool or a transaction client. */
export async function overlapCount(db, businessId, start, end) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM appointments
      WHERE business_id = $1
        AND status = ANY($2)
        AND created_via <> 'sms_demo'
        AND starts_at < $4 AND ends_at > $3`,
    [businessId, ACTIVE_STATUSES, start.toJSDate(), end.toJSDate()]
  );
  return rows[0].n;
}

/**
 * The next few open start times, on a 30-minute grid, spaced at least an hour apart so the
 * suggestions are a real choice instead of three back-to-back slots.
 */
export async function findOpenings(db, business, durationMin, from, { now, limit = 3, days = 14 } = {}) {
  const zone = from.zone;
  const clock = now || DateTime.now().setZone(zone);
  const earliest = DateTime.max(from, clock.plus({ minutes: MIN_LEAD_MIN }));
  const horizon = earliest.plus({ days }).endOf('day');

  const { rows } = await db.query(
    `SELECT starts_at, ends_at FROM appointments
      WHERE business_id = $1 AND status = ANY($2) AND created_via <> 'sms_demo'
        AND ends_at > $3 AND starts_at < $4`,
    [business.id, ACTIVE_STATUSES, earliest.toJSDate(), horizon.toJSDate()]
  );
  const busy = rows.map((r) => [r.starts_at.getTime(), r.ends_at.getTime()]);

  const picks = [];
  for (let d = earliest.startOf('day'); d <= horizon && picks.length < limit; d = d.plus({ days: 1 })) {
    const range = hoursFor(business.hours_json, d);
    if (!range) continue;
    for (let m = range.open; m + durationMin <= range.close && picks.length < limit; m += SLOT_STEP_MIN) {
      const start = d.set({ hour: Math.floor(m / 60), minute: m % 60, second: 0, millisecond: 0 });
      if (start < earliest) continue;
      const s = start.toMillis();
      const e = s + durationMin * 60_000;
      const overlapping = busy.filter(([bs, be]) => bs < e && be > s).length;
      if (overlapping >= business.chairs) continue;
      const last = picks[picks.length - 1];
      if (last && start.diff(last, 'minutes').minutes < 60) continue;
      picks.push(start);
    }
  }
  return picks;
}
