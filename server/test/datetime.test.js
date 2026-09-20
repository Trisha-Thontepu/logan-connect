import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { parseWhen } from '../src/sms/datetime.js';

const TZ = 'America/Los_Angeles';
// Wednesday 16 Sep 2026, 10:00 in San Diego.
const NOW = DateTime.fromISO('2026-09-16T10:00:00', { zone: TZ });
const HOURS = { mon: '9:00-19:00', tue: '9:00-19:00', wed: '9:00-19:00', thu: '9:00-19:00',
                fri: '9:00-19:00', sat: '9:00-17:00', sun: 'closed' };

const at = (text, opts = {}) => {
  const r = parseWhen(text, { now: NOW, hours: HOURS, ...opts });
  return r.dt ? r.dt.toFormat('yyyy-MM-dd HH:mm') : null;
};

test('weekday + time, English', () => {
  assert.equal(at('gel manicure thursday 3pm'), '2026-09-17 15:00');
  assert.equal(at('Friday 2pm'), '2026-09-18 14:00');
  assert.equal(at('sat 11:30am'), '2026-09-19 11:30');
});

test('weekday + time, Spanish (with and without accents)', () => {
  assert.equal(at('manicure de gel jueves 3pm'), '2026-09-17 15:00');
  assert.equal(at('viernes a las 2'), '2026-09-18 14:00');
  assert.equal(at('miércoles a las 3 de la tarde'), '2026-09-16 15:00');
  assert.equal(at('miercoles a las 3 de la tarde'), '2026-09-16 15:00');
});

test('"mañana" is tomorrow, but "de la mañana" is morning', () => {
  assert.equal(at('mañana a las 10'), '2026-09-17 10:00');
  assert.equal(at('el sábado a las 11 de la mañana'), '2026-09-19 11:00');
  assert.equal(at('pasado mañana 4pm'), '2026-09-18 16:00');
});

test('relative days in English', () => {
  assert.equal(at('tomorrow 10am'), '2026-09-17 10:00');
  assert.equal(at('today 4pm'), '2026-09-16 16:00');
  assert.equal(at('day after tomorrow at 1:15 pm'), '2026-09-18 13:15');
});

test('a weekday that is today rolls to next week once the time has passed', () => {
  assert.equal(at('wednesday 9am'), '2026-09-23 09:00'); // it is already 10:00
  assert.equal(at('wednesday 3pm'), '2026-09-16 15:00');
});

test('"next monday" is the upcoming Monday, and next week if today is Monday', () => {
  assert.equal(at('next monday 9am'), '2026-09-21 09:00');
  const monday = DateTime.fromISO('2026-09-21T08:00:00', { zone: TZ });
  const r = parseWhen('next monday 9am', { now: monday, hours: HOURS });
  assert.equal(r.dt.toFormat('yyyy-MM-dd HH:mm'), '2026-09-28 09:00');
});

test('calendar dates: 9/25, "sept 25th", "25 de septiembre"', () => {
  assert.equal(at('9/25 at 3'), '2026-09-25 15:00');
  assert.equal(at('sept 25th 3:30pm'), '2026-09-25 15:30');
  assert.equal(at('25 de septiembre a las 4 de la tarde'), '2026-09-25 16:00');
});

test('a date that already passed this year means next year', () => {
  assert.equal(at('1/5 10am'), '2027-01-05 10:00');
});

test('bare hours are resolved using the business hours', () => {
  assert.equal(at('friday at 3'), '2026-09-18 15:00'); // 3am is closed, 3pm is open
  assert.equal(at('friday at 10'), '2026-09-18 10:00'); // 10pm is closed, 10am is open
  assert.equal(at('friday at 12'), '2026-09-18 12:00');
});

test('bare hours with no business hours fall back to sensible defaults', () => {
  assert.equal(at('friday at 3', { hours: null }), '2026-09-18 15:00');
  assert.equal(at('friday at 9', { hours: null }), '2026-09-18 09:00');
});

test('24-hour times and noon', () => {
  assert.equal(at('friday 14:30'), '2026-09-18 14:30');
  assert.equal(at('noon saturday'), '2026-09-19 12:00');
  assert.equal(at('sabado mediodia'), '2026-09-19 12:00');
});

test('"a.m." / "p.m." spellings', () => {
  assert.equal(at('friday 2 p.m.'), '2026-09-18 14:00');
  assert.equal(at('friday 9:15 a.m.'), '2026-09-18 09:15');
});

test('partial answers stay partial', () => {
  const dayOnly = parseWhen('friday', { now: NOW, hours: HOURS });
  assert.equal(dayOnly.dt, null);
  assert.equal(dayOnly.date.toFormat('yyyy-MM-dd'), '2026-09-18');
  assert.equal(dayOnly.time, null);

  const timeOnly = parseWhen('3pm', { now: NOW, hours: HOURS });
  assert.equal(timeOnly.dt, null);
  assert.equal(timeOnly.date, null);
  assert.deepEqual(timeOnly.time, { hour: 15, minute: 0 });
});

test('text with no date or time returns nothing', () => {
  for (const text of ['hi', 'hola', 'gel manicure', 'pedicure por favor', '']) {
    const r = parseWhen(text, { now: NOW, hours: HOURS });
    assert.equal(r.date, null, text);
    assert.equal(r.time, null, text);
  }
});

test('impossible dates and times are ignored rather than guessed', () => {
  assert.equal(parseWhen('2/30 3pm', { now: NOW, hours: HOURS }).date, null);
  assert.equal(parseWhen('friday 25:00', { now: NOW, hours: HOURS }).dt, null);
});

test('a phone number in the message is not read as a time', () => {
  const r = parseWhen('call me 619 555 0100', { now: NOW, hours: HOURS });
  assert.equal(r.time, null);
});
