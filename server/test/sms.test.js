import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { pool, resetDatabase, closePool, startServer } from './helpers.js';
import { handleInboundSms } from '../src/sms/engine.js';
import { computeTwilioSignature } from '../src/sms/twilio.js';

const TZ = 'America/Los_Angeles';
const NOW = DateTime.fromISO('2026-09-16T10:00:00', { zone: TZ }); // a Wednesday
const HOURS = JSON.stringify({ mon: '9:00-19:00', tue: '9:00-19:00', wed: '9:00-19:00', thu: '9:00-19:00',
                               fri: '9:00-19:00', sat: '9:00-17:00', sun: 'closed' });
let bizId;

async function seedBusiness({ chairs = 1, enabled = true } = {}) {
  await pool.query('TRUNCATE businesses, customers RESTART IDENTITY CASCADE');
  const { rows } = await pool.query(
    `INSERT INTO businesses (slug, name, category, address, phone, hours_json, booking_enabled, chairs, sms_number)
     VALUES ('test-spa', 'Test Spa', 'Nail Salon', '1 Main St, San Diego, CA 92113', '(619) 555-0100', $1, $2, $3, '+16195550111')
     RETURNING id`,
    [HOURS, enabled, chairs]
  );
  bizId = rows[0].id;
  await pool.query(
    `INSERT INTO services (business_id, name_en, name_es, price_cents, duration_min) VALUES
     ($1, 'Classic Manicure', 'Manicure Clásico', 2500, 30),
     ($1, 'Gel Manicure', 'Manicure de Gel', 4000, 45),
     ($1, 'Pedicure', 'Pedicure', 4500, 45),
     ($1, 'Full Set Acrylics', 'Acrílicos Completos', 6500, 75)`,
    [bizId]
  );
}

const send = (phone, body, opts = {}) =>
  handleInboundSms({ phone, body, businessSlug: 'test-spa', now: NOW, ...opts });

const booked = async (phone) =>
  (await pool.query(
    `SELECT a.status, a.created_via, a.starts_at, a.ends_at FROM appointments a
       JOIN customers c ON c.id = a.customer_id WHERE c.phone = $1 ORDER BY a.starts_at`,
    [phone]
  )).rows.map((r) => ({ ...r, local: DateTime.fromJSDate(r.starts_at).setZone(TZ).toFormat('yyyy-MM-dd HH:mm') }));

before(resetDatabase);
beforeEach(() => seedBusiness());
after(closePool);

// ---- the four failures recorded against the original engine ----------------------------

test('multi-turn booking remembers the service between texts (was: "I didn\'t catch the service")', async () => {
  const p = '+16195550101';
  assert.match((await send(p, 'hola')).reply, /¡Hola!/);
  assert.match((await send(p, 'manicure de gel')).reply, /Perfecto: Manicure de Gel/);
  const r = await send(p, 'viernes 2pm');
  assert.match(r.reply, /Tu cita está confirmada: Manicure de Gel/);
  const [a] = await booked(p);
  assert.equal(a.local, '2026-09-18 14:00');
});

test('the appointment is stored at the requested time (was: tomorrow at the current time)', async () => {
  const p = '+16195550102';
  const r = await send(p, 'gel manicure thursday 3pm');
  assert.match(r.reply, /You're booked: Gel Manicure on Thursday, Sep 17 at 3:00 PM/);
  const [a] = await booked(p);
  assert.equal(a.local, '2026-09-17 15:00');
  assert.equal((a.ends_at - a.starts_at) / 60000, 45); // service duration
});

test('a closed day is refused with real alternatives (was: booked Sunday 3am)', async () => {
  const r = await send('+16195550103', 'pedicure sunday 3pm');
  assert.match(r.reply, /closed on Sundays/);
  assert.match(r.reply, /Next openings: .*Monday, Sep 21/);
  assert.equal((await booked('+16195550103')).length, 0);
});

test('hours are enforced: too late on a short Saturday', async () => {
  const r = await send('+16195550104', 'pedicure saturday 6pm');
  assert.match(r.reply, /outside our hours \(9:00 AM to 5:00 PM\)/);
});

// ---- conversation handling ---------------------------------------------------------------

test('an ambiguous service asks which one, then continues with the day already given', async () => {
  const p = '+16195550105';
  const r1 = await send(p, 'manicure friday 2pm');
  assert.match(r1.reply, /Which one did you mean: Classic Manicure \(\$25\), Gel Manicure \(\$40\)\?/);
  const r2 = await send(p, 'gel');
  assert.match(r2.reply, /You're booked: Gel Manicure on Friday, Sep 18 at 2:00 PM/);
});

test('time first, then day', async () => {
  const p = '+16195550106';
  await send(p, 'gel manicure');
  assert.match((await send(p, '3pm')).reply, /Which day\?/);
  assert.match((await send(p, 'friday')).reply, /You're booked: Gel Manicure on Friday, Sep 18 at 3:00 PM/);
});

test('a half-finished booking is forgotten after 30 minutes', async () => {
  const p = '+16195550107';
  await send(p, 'gel manicure');
  const later = await send(p, 'friday 2pm', { now: NOW.plus({ minutes: 45 }) });
  assert.match(later.reply, /Which service\?/);
  assert.equal((await booked(p)).length, 0);
});

test('a Spanish conversation stays Spanish when a later text has no Spanish words', async () => {
  const p = '+16195550108';
  await send(p, 'hola');
  const r = await send(p, 'gel');
  assert.equal(r.lang, 'es');
  assert.match(r.reply, /¿Qué día y hora/);
});

test('past times and last-minute requests are rejected', async () => {
  const r1 = await send('+16195550109', 'pedicure today 9am');
  assert.match(r1.reply, /already passed/);
  const r2 = await send('+16195550110', 'pedicure today 10:30am');
  assert.match(r2.reply, /at least an hour/);
});

// ---- capacity ---------------------------------------------------------------------------

test('overlapping bookings are refused and the taken slot is not offered again', async () => {
  await send('+16195550120', 'gel manicure friday 2pm');
  const r = await send('+16195550121', 'gel manicure friday 2:30pm');
  assert.match(r.reply, /already taken/);
  assert.match(r.reply, /Next openings/);
  assert.doesNotMatch(r.reply, /2:30 PM/);
});

test('more chairs means more simultaneous bookings', async () => {
  await pool.query('UPDATE businesses SET chairs = 2 WHERE id = $1', [bizId]);
  await send('+16195550122', 'gel manicure friday 2pm');
  assert.match((await send('+16195550123', 'gel manicure friday 2pm')).reply, /You're booked/);
  assert.match((await send('+16195550124', 'gel manicure friday 2pm')).reply, /already taken/);
});

test('two customers racing for the last slot: exactly one wins', async () => {
  const results = await Promise.all(
    ['+16195550130', '+16195550131', '+16195550132', '+16195550133'].map((p) =>
      send(p, 'pedicure friday 4pm')
    )
  );
  const wins = results.filter((r) => /You're booked/.test(r.reply)).length;
  assert.equal(wins, 1);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE status = 'confirmed'`);
  assert.equal(rows[0].n, 1);
});

test('demo bookings never block real customers', async () => {
  const demo = await send('demo-abcdef123456', 'gel manicure friday 2pm', { demo: true });
  assert.match(demo.reply, /You're booked/);
  assert.equal((await booked('demo-abcdef123456'))[0].created_via, 'sms_demo');
  assert.match((await send('+16195550140', 'gel manicure friday 2pm')).reply, /You're booked/);
});

test('a customer is limited to 3 upcoming appointments', async () => {
  const p = '+16195550150';
  for (const when of ['friday 2pm', 'saturday 10am', 'monday 10am']) {
    assert.match((await send(p, `pedicure ${when}`)).reply, /You're booked/);
  }
  assert.match((await send(p, 'pedicure tuesday 10am')).reply, /already have 3 upcoming/);
});

test('asking for the same appointment twice does not double-book', async () => {
  const p = '+16195550151';
  await send(p, 'gel manicure friday 2pm');
  assert.match((await send(p, 'gel manicure friday 2pm')).reply, /You already have Gel Manicure/);
  assert.equal((await booked(p)).length, 1);
});

// ---- cancel, STOP, help -------------------------------------------------------------------

test('CANCEL cancels only the next appointment and says how many remain', async () => {
  const p = '+16195550160';
  await send(p, 'pedicure friday 2pm');
  await send(p, 'pedicure saturday 10am');
  const r = await send(p, 'cancel');
  assert.match(r.reply, /Cancelled: Pedicure on Friday, Sep 18/);
  assert.match(r.reply, /1 more upcoming/);
  const rows = await booked(p);
  assert.deepEqual(rows.map((x) => x.status), ['cancelled', 'confirmed']);
});

test('cancelled slots become bookable again', async () => {
  await send('+16195550161', 'pedicure friday 2pm');
  await send('+16195550161', 'cancel appt');
  assert.match((await send('+16195550162', 'pedicure friday 2pm')).reply, /You're booked/);
});

test('CANCEL with nothing booked says so', async () => {
  assert.match((await send('+16195550163', 'cancelar')).reply, /No tienes citas|any upcoming/);
});

test('STOP silences replies until START', async () => {
  const p = '+16195550170';
  assert.match((await send(p, 'STOP')).reply, /unsubscribed/);
  assert.equal((await send(p, 'gel manicure friday 2pm')).reply, null);
  assert.equal((await booked(p)).length, 0);
  assert.match((await send(p, 'start')).reply, /Welcome back/);
  assert.match((await send(p, 'gel manicure friday 2pm')).reply, /You're booked/);
});

test('HELP works in both languages', async () => {
  assert.match((await send('+16195550171', 'help')).reply, /CANCEL APPT/);
  assert.match((await send('+16195550172', 'ayuda')).reply, /CANCELAR CITA/);
});

test('a business that has not turned on text booking says so and stores nothing', async () => {
  await pool.query('UPDATE businesses SET booking_enabled = FALSE WHERE id = $1', [bizId]);
  const r = await send('+16195550180', 'gel manicure friday 2pm');
  assert.match(r.reply, /isn't taking bookings by text yet.*\(619\) 555-0100/);
  assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM customers`)).rows[0].n, 0);
});

test('unpublished businesses cannot be texted', async () => {
  await pool.query(`UPDATE businesses SET status = 'pending' WHERE id = $1`, [bizId]);
  await assert.rejects(send('+16195550181', 'hi'), /Unknown business/);
});

// ---- HTTP layer -------------------------------------------------------------------------

test('Twilio webhook: valid signature, routes by the number texted, escapes XML', async () => {
  await pool.query(`UPDATE services SET name_en = 'Gel & Shine', name_es = 'Gel & Brillo' WHERE name_en = 'Gel Manicure'`);
  const server = await startServer();
  try {
    const params = { From: '+16195550190', To: '+16195550111', Body: 'gel' };
    const url = `${server.base}/api/sms/webhook`;
    const signature = computeTwilioSignature('test-twilio-token', url, params);
    const res = await server.postForm('/api/sms/webhook', params, { headers: { 'X-Twilio-Signature': signature } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /xml/);
    assert.match(res.text, /<Message>Got it: Gel &amp; Shine\./); // raw "&" would be invalid XML
  } finally {
    await server.close();
  }
});

test('Twilio webhook rejects bad or missing signatures', async () => {
  const server = await startServer();
  try {
    const params = { From: '+16195550191', To: '+16195550111', Body: 'hi' };
    assert.equal((await server.postForm('/api/sms/webhook', params)).status, 403);
    assert.equal((await server.postForm('/api/sms/webhook', params, { headers: { 'X-Twilio-Signature': 'nope' } })).status, 403);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM customers')).rows[0].n, 0);
  } finally {
    await server.close();
  }
});

test('the demo endpoint cannot be used to reach a real customer\'s number or thread', async () => {
  await send('+16195550195', 'gel manicure friday 2pm'); // a real customer with a real booking
  const server = await startServer();
  try {
    const sim = await server.post('/api/sms/simulate', { phone: '+16195550195', body: 'cancel', businessSlug: 'test-spa' });
    assert.equal(sim.status, 200);
    assert.match(sim.json.reply, /don't have any upcoming/); // the demo identity has no bookings
    assert.equal((await booked('+16195550195'))[0].status, 'confirmed'); // real booking untouched

    const thread = await server.get('/api/sms/thread?phone=%2B16195550195&businessSlug=test-spa');
    assert.deepEqual(thread.json.map((m) => m.body).filter((b) => /booked/.test(b)), []);
  } finally {
    await server.close();
  }
});
