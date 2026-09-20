import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './pool.js';
import { CHECKED_ON, FOUNDER_LISTING, PUBLIC_LISTINGS } from './seed-data.js';

const COLUMNS = [
  'slug', 'name', 'category', 'tagline', 'story_en', 'story_es', 'owner_name', 'address',
  'phone', 'website', 'appointment_only', 'hours_json', 'photo_seed', 'badges', 'service_tags',
  'origin', 'claim_status', 'booking_enabled', 'data_source', 'data_checked_on',
];

function values(b) {
  return [
    b.slug, b.name, b.category, b.tagline ?? null, b.story_en ?? null, b.story_es ?? null,
    b.owner_name ?? null, b.address, b.phone ?? null, b.website ?? null,
    b.appointment_only ?? false, b.hours ? JSON.stringify(b.hours) : null, b.photo_seed ?? null,
    b.badges ?? [], b.service_tags ?? [], b.origin, b.claim_status, b.booking_enabled ?? false,
    b.data_source ?? null, b.origin === 'public_listing' ? CHECKED_ON : null,
  ];
}

/**
 * Idempotent. Safe to run on every deploy:
 *  - unclaimed public listings are refreshed to the latest known facts;
 *  - once an owner has claimed a listing, seeding never touches it again, so an owner's
 *    edits are never overwritten;
 *  - services are only added when the business has none of that name.
 */
export async function seed({ log = console.log } = {}) {
  const results = [];
  await withTransaction(async (db) => {
    for (const b of [FOUNDER_LISTING, ...PUBLIC_LISTINGS]) {
      const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
      const updates = COLUMNS.filter((c) => c !== 'slug').map((c) => `${c} = EXCLUDED.${c}`).join(', ');
      const { rows } = await db.query(
        `INSERT INTO businesses (${COLUMNS.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (slug) DO UPDATE SET ${updates}, updated_at = now()
         WHERE businesses.claim_status = 'unclaimed'
         RETURNING id, (xmax = 0) AS inserted`,
        values(b)
      );
      // No row returned means the listing already exists and has been claimed: leave it.
      const row = rows[0];
      const { rows: existing } = row ? { rows: [row] } : await db.query('SELECT id FROM businesses WHERE slug = $1', [b.slug]);
      const id = existing[0].id;

      for (const s of b.services ?? []) {
        await db.query(
          `INSERT INTO services (business_id, name_en, name_es, price_cents, duration_min)
           SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (SELECT 1 FROM services WHERE business_id = $1 AND name_en = $2)`,
          [id, s.name_en, s.name_es, s.price_cents, s.duration_min]
        );
      }
      results.push(`${row ? (row.inserted ? 'added  ' : 'updated') : 'kept   '} ${b.slug}`);
    }
  });
  results.forEach((r) => log(r));
  return results;
}

// `npm run db:seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
