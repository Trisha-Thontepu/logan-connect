import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'loganconnect',
  password: process.env.PGPASSWORD || 'loganconnect_dev',
  database: process.env.PGDATABASE || 'logan_connect',
});

// pg.Pool emits 'error' on the pool itself when an idle client hits a connection
// problem (e.g. the database restarts or drops the connection). Without a listener
// here, Node treats that as an unhandled 'error' event and kills the whole process —
// independent of any try/catch around individual queries.
pool.on('error', (err) => {
  console.error('Postgres pool error (connection dropped, pool will reconnect on next query):', err.message);
});
