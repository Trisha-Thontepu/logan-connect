import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, resetDatabase, closePool } from './helpers.js';
import { migrate } from '../src/db/migrate.js';

before(resetDatabase);
after(closePool);

test('migrations create the tables the app depends on', async () => {
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const names = rows.map((r) => r.table_name);
  for (const t of [
    'businesses', 'services', 'customers', 'appointments', 'sms_messages',
    'sms_sessions', 'owner_contacts', 'owner_access_tokens', 'claim_requests',
    'schema_migrations',
  ]) {
    assert.ok(names.includes(t), `missing table ${t}`);
  }
});

test('running migrations again applies nothing', async () => {
  const ran = await migrate({ log: () => {} });
  assert.deepEqual(ran, []);
});

test('only one pending claim is allowed per business', async () => {
  const { rows } = await pool.query(
    `INSERT INTO businesses (slug, name, category, address, claim_status)
     VALUES ('t-biz', 'T', 'Nail Salon', '1 Main St', 'unclaimed') RETURNING id`
  );
  const id = rows[0].id;
  const insert = () =>
    pool.query(
      `INSERT INTO claim_requests (business_id, claimant_name, claimant_email, claimant_phone)
       VALUES ($1, 'A', 'a@example.com', '6195550100')`,
      [id]
    );
  await insert();
  await assert.rejects(insert, /idx_claim_one_pending/);
});

test('invalid statuses are rejected by the database itself', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO businesses (slug, name, category, address, status)
       VALUES ('bad-status', 'X', 'Nail Salon', '1 Main St', 'live')`
    ),
    /businesses_status_check/
  );
});
