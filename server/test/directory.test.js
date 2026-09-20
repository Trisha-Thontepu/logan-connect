import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, resetDatabase, closePool, startServer } from './helpers.js';
import { seed } from '../src/db/seed.js';
import { FOUNDER_LISTING, PUBLIC_LISTINGS } from '../src/db/seed-data.js';
import { geocodeAddress, distanceKm, NEIGHBORHOOD_CENTER } from '../src/lib/geocode.js';

let server;
before(async () => {
  await resetDatabase();
  await seed({ log: () => {} });
  server = await startServer();
});
after(async () => {
  await server.close();
  await closePool();
});

test('the seeded directory contains only real, sourced listings', async () => {
  const { json } = await server.get('/api/businesses');
  assert.equal(json.length, 1 + PUBLIC_LISTINGS.length);
  const slugs = json.map((b) => b.slug);
  for (const fake of ['panaderia-la-perla', 'taqueria-el-portal', 'barberia-don-chuy', 'lavanderia-rapida', 'estetica-bella-vida']) {
    assert.ok(!slugs.includes(fake), `${fake} should be gone`);
  }
  for (const b of json.filter((x) => x.origin === 'public_listing')) {
    assert.equal(b.claim_status, 'unclaimed');
    assert.ok(b.data_source, `${b.slug} must say where its info came from`);
    assert.ok(b.data_checked_on);
    assert.equal(b.tagline, null, `${b.slug}: no invented tagline`);
    assert.equal(b.story_en, null, `${b.slug}: no invented story`);
    assert.equal(b.owner_name, null, `${b.slug}: no invented owner`);
    assert.deepEqual(b.badges, [], `${b.slug}: ownership badges are self-reported only`);
    assert.equal(b.booking_enabled, false);
  }
});

test('every listing is in the 92102/92113 area and has a phone number', () => {
  for (const b of [FOUNDER_LISTING, ...PUBLIC_LISTINGS]) {
    assert.match(b.address, /San Diego, CA 921(02|13)$/, b.slug);
    assert.match(b.phone, /^\(\d{3}\) \d{3}-\d{4}$/, b.slug);
  }
});

test('unclaimed listings sort after claimed ones, then alphabetically', async () => {
  const { json } = await server.get('/api/businesses');
  assert.equal(json[0].slug, 'logan-nails-spa');
  const rest = json.slice(1).map((b) => b.name);
  assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b, 'en')));
});

test('filter by category', async () => {
  const { json } = await server.get('/api/businesses?category=Barbershop');
  assert.deepEqual(json.map((b) => b.slug).sort(), ['ag-hair-salon-and-barber', 'sd-bladez-barbershop']);
});

test('search matches names, service tags and service names', async () => {
  assert.deepEqual((await server.get('/api/businesses?q=picasso')).json.map((b) => b.slug), ['picasso-hair-design']);
  assert.ok((await server.get('/api/businesses?q=threading')).json.some((b) => b.slug === 'dve-beauty-salon'));
  assert.ok((await server.get('/api/businesses?q=acrylics')).json.some((b) => b.slug === 'logan-nails-spa'));
});

test('search treats % and _ as plain characters, not wildcards', async () => {
  assert.equal((await server.get('/api/businesses?q=%25')).json.length, 0);
  assert.equal((await server.get('/api/businesses?q=_')).json.length, 0);
});

test('the profile endpoint returns services and no private fields', async () => {
  const { status, json } = await server.get('/api/businesses/logan-nails-spa');
  assert.equal(status, 200);
  assert.equal(json.services.length, 4);
  for (const key of ['email', 'owner_email', 'token', 'token_hash', 'sms_number', 'chairs']) {
    assert.ok(!(key in json), `${key} must not be public`);
  }
});

test('unpublished and unknown listings are 404', async () => {
  await pool.query(
    `INSERT INTO businesses (slug, name, category, address, status) VALUES ('hidden', 'Hidden', 'Other', '1 A St', 'pending')`
  );
  assert.equal((await server.get('/api/businesses/hidden')).status, 404);
  assert.equal((await server.get('/api/businesses/nope')).status, 404);
  assert.ok(!(await server.get('/api/businesses')).json.some((b) => b.slug === 'hidden'));
});

test('re-seeding refreshes unclaimed listings but never overwrites a claimed one', async () => {
  await pool.query(`UPDATE businesses SET phone = '(619) 000-0000' WHERE slug = 'nail-addictionz'`);
  await pool.query(`UPDATE businesses SET phone = '(619) 111-1111', claim_status = 'claimed' WHERE slug = 'dve-beauty-salon'`);
  await seed({ log: () => {} });
  const phone = async (slug) => (await pool.query('SELECT phone FROM businesses WHERE slug = $1', [slug])).rows[0].phone;
  assert.equal(await phone('nail-addictionz'), '(619) 957-6954'); // refreshed
  assert.equal(await phone('dve-beauty-salon'), '(619) 111-1111'); // owner's edit preserved
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM services s JOIN businesses b ON b.id = s.business_id WHERE b.slug = $1', ['logan-nails-spa'])).rows[0].n, 4);
});

// ---- geocoding (mocked: the real Census service is not reachable from CI sandboxes) ----------

const census = (x, y) => async () => ({ ok: true, json: async () => ({ result: { addressMatches: [{ matchedAddress: '1985 NATIONAL AVE', coordinates: { x, y } }] } }) });

test('geocoder returns coordinates from a Census-shaped response (x = longitude, y = latitude)', async () => {
  const r = await geocodeAddress('1985 National Ave, San Diego, CA 92113', { fetchImpl: census(-117.14, 32.70) });
  assert.deepEqual([r.lat, r.lng], [32.70, -117.14]);
});

test('geocoder rejects matches far from the neighborhood and survives failures', async () => {
  assert.equal(await geocodeAddress('1 Main St', { fetchImpl: census(-77.03, 38.89) }), null); // Washington, DC
  assert.equal(await geocodeAddress('x', { fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await geocodeAddress('x', { fetchImpl: async () => { throw new Error('offline'); } }), null);
  assert.equal(await geocodeAddress('x', { fetchImpl: async () => ({ ok: true, json: async () => ({ result: { addressMatches: [] } }) }) }), null);
});

test('distance helper is sane', () => {
  assert.ok(distanceKm(NEIGHBORHOOD_CENTER, NEIGHBORHOOD_CENTER) < 0.001);
  assert.ok(distanceKm({ lat: 32.7157, lng: -117.1611 }, NEIGHBORHOOD_CENTER) > 2); // downtown SD is a few km away
});
