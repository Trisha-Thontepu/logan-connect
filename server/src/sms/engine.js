import { DateTime } from 'luxon';
import { pool, withTransaction } from '../db/pool.js';
import { normalize, parseWhen } from './datetime.js';
import { matchServices } from './matching.js';
import { ACTIVE_STATUSES, checkSlot, findOpenings, overlapCount } from './availability.js';
import { detectLang, fmtDay, fmtWhen, isGreeting, t } from './copy.js';
import { normalizePhone } from '../lib/phone.js';

const SESSION_TTL_MIN = 30; // a half-finished booking is forgotten after this long
const MAX_UPCOMING = 3;
const MAX_BODY = 1000;

// Whole-message keywords, matched after stripping accents and punctuation.
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'end', 'quit', 'alto', 'parar', 'baja']);
const START_WORDS = new Set(['start', 'unstop', 'empezar', 'iniciar']);
const HELP_WORDS = new Set(['help', 'info', 'ayuda']);
const CANCEL_RE = /^(cancel|cancelar)( (appt|appointment|cita))?$/;
const LANG_WORDS = new Map([['english', 'en'], ['ingles', 'en'], ['espanol', 'es'], ['spanish', 'es']]);

export class SmsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function loadBusiness({ businessSlug, smsNumber }) {
  const { rows } = smsNumber
    ? await pool.query(`SELECT * FROM businesses WHERE sms_number = $1 AND status = 'published'`, [smsNumber])
    : await pool.query(`SELECT * FROM businesses WHERE slug = $1 AND status = 'published'`, [businessSlug]);
  return rows[0] || null;
}

async function getOrCreateCustomer(phone) {
  // ON CONFLICT makes two simultaneous first messages from one number safe.
  const { rows } = await pool.query(
    `INSERT INTO customers (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING *`,
    [phone]
  );
  return rows[0];
}

async function logMessage({ customerId, businessId, direction, body, lang }) {
  await pool.query(
    `INSERT INTO sms_messages (customer_id, business_id, direction, body, lang)
     VALUES ($1, $2, $3, $4, $5)`,
    [customerId, businessId, direction, body, lang]
  );
}

// ---- conversation memory -------------------------------------------------------------

async function loadSession(customerId, businessId, nowDt) {
  const zone = nowDt.zone;
  const { rows } = await pool.query(
    `SELECT pending_service_id, pending_date::text AS pending_date, pending_time::text AS pending_time
       FROM sms_sessions
      WHERE customer_id = $1 AND business_id = $2 AND updated_at > $3`,
    [customerId, businessId, nowDt.minus({ minutes: SESSION_TTL_MIN }).toJSDate()]
  );
  const r = rows[0];
  if (!r) return { serviceId: null, date: null, time: null };
  const time = r.pending_time ? { hour: Number(r.pending_time.slice(0, 2)), minute: Number(r.pending_time.slice(3, 5)) } : null;
  return {
    serviceId: r.pending_service_id,
    date: r.pending_date ? DateTime.fromISO(r.pending_date, { zone }) : null,
    time,
  };
}

async function saveSession(customerId, businessId, { serviceId = null, date = null, time = null }, nowDt) {
  if (!serviceId && !date && !time) {
    await pool.query('DELETE FROM sms_sessions WHERE customer_id = $1 AND business_id = $2', [customerId, businessId]);
    return;
  }
  const timeText = time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : null;
  await pool.query(
    `INSERT INTO sms_sessions (customer_id, business_id, pending_service_id, pending_date, pending_time, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (customer_id, business_id)
     DO UPDATE SET pending_service_id = $3, pending_date = $4, pending_time = $5, updated_at = $6`,
    [customerId, businessId, serviceId, date ? date.toISODate() : null, timeText, nowDt.toJSDate()]
  );
}

// ---- booking -------------------------------------------------------------------------

async function upcomingFor(customerId, businessId, nowDt) {
  const { rows } = await pool.query(
    `SELECT a.id, a.starts_at, a.service_id, s.name_en, s.name_es
       FROM appointments a LEFT JOIN services s ON s.id = a.service_id
      WHERE a.customer_id = $1 AND a.business_id = $2
        AND a.status = ANY($3) AND a.starts_at > $4
      ORDER BY a.starts_at`,
    [customerId, businessId, ACTIVE_STATUSES, nowDt.toJSDate()]
  );
  return rows;
}

// The overlap check and the insert happen under one lock per business, so two customers
// texting for the same last slot cannot both get it.
async function bookSlot({ business, customer, service, start, end, demo }) {
  return withTransaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock($1)', [business.id]);
    if (!demo && (await overlapCount(db, business.id, start, end)) >= business.chairs) {
      return { conflict: true };
    }
    const { rows } = await db.query(
      `INSERT INTO appointments
         (business_id, customer_id, service_id, starts_at, ends_at, status, created_via, notes)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7) RETURNING id`,
      [business.id, customer.id, service.id, start.toJSDate(), end.toJSDate(), demo ? 'sms_demo' : 'sms', null]
    );
    return { id: rows[0].id };
  });
}

/**
 * Handle one inbound text and return the reply (or null when nothing should be sent).
 *
 * Stateless between requests apart from what is stored in the database (sms_messages,
 * sms_sessions, appointments), which is what a real Twilio webhook needs: there is no
 * in-memory session, so any server instance can handle any message.
 */
export async function handleInboundSms({ phone, body, businessSlug, smsNumber, demo = false, now }) {
  const text = String(body ?? '').slice(0, MAX_BODY).trim();
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) throw new SmsError('A valid phone number is required.');

  const business = await loadBusiness({ businessSlug, smsNumber });
  if (!business) throw new SmsError('Unknown business', 404);

  const nowDt = (now ?? DateTime.now()).setZone(business.timezone);

  const { rows: services } = await pool.query(
    'SELECT * FROM services WHERE business_id = $1 AND active ORDER BY id',
    [business.id]
  );
  if (!business.booking_enabled || !services.length) {
    return { reply: t(detectLang(text)).notEnabled(business), lang: detectLang(text) };
  }

  const customer = await getOrCreateCustomer(customerPhone);
  const key = normalize(text).replace(/[^a-z0-9 ]/g, '').trim();

  const { rows: prior } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM sms_messages WHERE customer_id = $1 AND business_id = $2',
    [customer.id, business.id]
  );
  const isFirstMessage = prior[0].n === 0;

  // Detect the language once, on the first message, then stick with it so a reply like
  // "friday" (no Spanish hints) doesn't flip a Spanish conversation to English.
  let lang = isFirstMessage ? detectLang(text) : customer.preferred_lang || 'en';
  if (LANG_WORDS.has(key)) lang = LANG_WORDS.get(key);
  if (lang !== customer.preferred_lang) {
    await pool.query('UPDATE customers SET preferred_lang = $1 WHERE id = $2', [lang, customer.id]);
  }
  const c = t(lang);
  const ctx = { customerId: customer.id, businessId: business.id, lang };

  await logMessage({ ...ctx, direction: 'inbound', body: text });

  const finish = async (reply, extra = {}) => {
    if (reply) await logMessage({ ...ctx, direction: 'outbound', body: reply });
    return { reply, lang, ...extra };
  };

  // -- carrier-required keywords come first and always work
  if (START_WORDS.has(key)) {
    await pool.query('UPDATE customers SET sms_opted_out_at = NULL WHERE id = $1', [customer.id]);
    return finish(c.started(business));
  }
  if (customer.sms_opted_out_at) return finish(null); // opted out: stay silent until START
  if (STOP_WORDS.has(key)) {
    await pool.query('UPDATE customers SET sms_opted_out_at = now() WHERE id = $1', [customer.id]);
    await saveSession(customer.id, business.id, {}, nowDt);
    return finish(c.stopped(business));
  }
  if (HELP_WORDS.has(key)) return finish(c.help(business));
  if (LANG_WORDS.has(key)) return finish(c.langSet(business));

  // -- cancel the customer's next upcoming appointment
  if (CANCEL_RE.test(key)) {
    const upcoming = await upcomingFor(customer.id, business.id, nowDt);
    if (!upcoming.length) return finish(c.nothingToCancel);
    const [next, ...rest] = upcoming;
    await pool.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [next.id]);
    await saveSession(customer.id, business.id, {}, nowDt);
    return finish(c.cancelled(next, DateTime.fromJSDate(next.starts_at, { zone: nowDt.zone }), rest.length));
  }

  // -- booking conversation
  const session = await loadSession(customer.id, business.id, nowDt);
  const matches = matchServices(text, services);
  const parsed = parseWhen(text, { now: nowDt, hours: business.hours_json });

  let service = matches.length === 1 ? matches[0] : null;
  if (!service && session.serviceId) service = services.find((s) => s.id === session.serviceId) || null;
  const date = parsed.date || session.date;
  const time = parsed.time || session.time;

  if (!service) {
    await saveSession(customer.id, business.id, { date, time }, nowDt);
    if (matches.length > 1) return finish(c.ambiguous(matches));
    if (date || time) {
      const when = date && time ? fmtWhen(date.set(time), lang) : date ? fmtDay(date, lang) : nowDt.set({ ...time, second: 0 }).toFormat('h:mm a');
      return finish(c.askService(services, when));
    }
    return finish(isFirstMessage || isGreeting(text) ? c.greeting(business) : c.noService(services));
  }

  if (!date && !time) {
    await saveSession(customer.id, business.id, { serviceId: service.id }, nowDt);
    return finish(c.askTime(service));
  }
  if (!date) {
    await saveSession(customer.id, business.id, { serviceId: service.id, time }, nowDt);
    return finish(c.askDay(service, nowDt.set({ ...time, second: 0 })));
  }
  if (!time) {
    await saveSession(customer.id, business.id, { serviceId: service.id, date }, nowDt);
    return finish(c.askTimeForDay(service, date));
  }

  // Both a day and a time are known: check them against the real calendar.
  const start = date.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 });
  const duration = service.duration_min || 30;
  const end = start.plus({ minutes: duration });
  const keepService = () => saveSession(customer.id, business.id, { serviceId: service.id }, nowDt);

  const slot = checkSlot(business, start, duration, nowDt);
  if (!slot.ok) {
    await keepService();
    if (slot.reason === 'too_far') return finish(c.tooFar);
    const from = slot.reason === 'past' || slot.reason === 'too_soon' ? nowDt : start.startOf('day');
    const openings = await findOpenings(pool, business, duration, from, { now: nowDt });
    if (!openings.length) return finish(c.noOpenings(business));
    if (slot.reason === 'closed_day') return finish(c.closedDay(start, openings));
    if (slot.reason === 'outside_hours') return finish(c.outsideHours(slot.range, openings));
    return finish(slot.reason === 'past' ? c.past(openings) : c.tooSoon(openings));
  }

  const upcoming = await upcomingFor(customer.id, business.id, nowDt);
  const same = upcoming.find((a) => a.service_id === service.id && a.starts_at.getTime() === start.toMillis());
  if (same) {
    await saveSession(customer.id, business.id, {}, nowDt);
    return finish(c.duplicate(service, start));
  }
  if (upcoming.length >= MAX_UPCOMING) {
    await saveSession(customer.id, business.id, {}, nowDt);
    return finish(c.tooMany);
  }

  const booked = await bookSlot({ business, customer, service, start, end, demo });
  if (booked.conflict) {
    await keepService();
    const openings = await findOpenings(pool, business, duration, start.startOf('day'), { now: nowDt });
    return finish(openings.length ? c.taken(openings) : c.noOpenings(business));
  }

  await saveSession(customer.id, business.id, {}, nowDt);
  return finish(c.confirmed(service, start, business), {
    appointment: { id: booked.id, starts_at: start.toISO(), service: service.name_en },
  });
}
