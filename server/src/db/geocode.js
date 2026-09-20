import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { geocodeBusiness } from '../lib/geocode.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fill in map coordinates for every listing that has not been geocoded from its address.
 * Coordinates that were typed in by hand count as "not geocoded", because a hand-typed
 * point can be off by blocks. One request per second to stay polite to a free service.
 */
export async function geocodeMissing({ log = console.log, delayMs = 1000 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, slug, address FROM businesses WHERE geocoded_at IS NULL AND status <> 'rejected' ORDER BY id`
  );
  let saved = 0;
  for (const b of rows) {
    const ok = await geocodeBusiness(pool, b);
    log(`${ok ? 'located ' : 'no match'} ${b.slug}`);
    if (ok) saved += 1;
    await sleep(delayMs);
  }
  return { attempted: rows.length, saved };
}

// `npm run db:geocode`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  geocodeMissing()
    .then(async ({ attempted, saved }) => {
      console.log(`${saved} of ${attempted} listings located`);
      await pool.end();
    })
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
