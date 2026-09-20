// Shared test setup. Tests run against a real Postgres database (logan_connect_test),
// created on demand and rebuilt from the migrations, so they exercise the same SQL
// that production runs. Nothing here touches the development database.
process.env.NODE_ENV = 'test';
process.env.PGDATABASE = process.env.TEST_PGDATABASE || 'logan_connect_test';
process.env.ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';
process.env.PUBLIC_APP_URL = 'http://localhost:5173';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';

import pg from 'pg';

async function ensureDatabase() {
  const admin = new pg.Client({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'loganconnect',
    password: process.env.PGPASSWORD || 'loganconnect_dev',
    database: 'postgres',
  });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      process.env.PGDATABASE,
    ]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${process.env.PGDATABASE}`);
  } finally {
    await admin.end();
  }
}

await ensureDatabase();

const { pool } = await import('../src/db/pool.js');
const { migrate } = await import('../src/db/migrate.js');
const { createApp } = await import('../src/app.js');

export { pool };

export async function resetDatabase() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate({ log: () => {} });
}

// Starts the real Express app on an ephemeral port and returns a tiny fetch wrapper.
export async function startServer() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { body, headers = {}, form } = {}) {
    const init = { method, headers: { ...headers } };
    if (form) {
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(form).toString();
    } else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON (e.g. Twilio XML) */ }
    return { status: res.status, json, text, headers: res.headers };
  }

  return {
    base,
    get: (p, o) => call('GET', p, o),
    post: (p, body, o = {}) => call('POST', p, { ...o, body }),
    patch: (p, body, o = {}) => call('PATCH', p, { ...o, body }),
    put: (p, body, o = {}) => call('PUT', p, { ...o, body }),
    postForm: (p, form, o = {}) => call('POST', p, { ...o, form }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function closePool() {
  await pool.end();
}
