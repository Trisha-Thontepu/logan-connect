import { Router } from 'express';
import { pool } from '../db/pool.js';
import { BADGES } from '../lib/categories.js';

const router = Router();

// The only columns the public API ever returns. Contact details for owners, tokens and
// claim requests live in other tables and can never leak through a `SELECT *`.
export const PUBLIC_COLUMNS = `
  id, slug, name, category, tagline, story_en, story_es, owner_name, address, lat, lng,
  phone, website, appointment_only, languages, hours_json, photo_seed, badges, service_tags,
  claim_status, booking_enabled, data_source, data_checked_on, origin`;

// User input is used inside LIKE patterns; % and _ would otherwise act as wildcards.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// GET /api/businesses?category=&q=&badge=
router.get('/', async (req, res) => {
  const { category, q, badge } = req.query;
  const conditions = [`status = 'published'`];
  const params = [];

  if (typeof category === 'string' && category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (typeof badge === 'string' && BADGES.includes(badge)) {
    params.push(badge);
    conditions.push(`$${params.length} = ANY(badges)`);
  }
  if (typeof q === 'string' && q.trim()) {
    params.push(`%${escapeLike(q.trim().slice(0, 80))}%`);
    const i = params.length;
    conditions.push(
      `(name ILIKE $${i} OR tagline ILIKE $${i} OR category ILIKE $${i} OR address ILIKE $${i}
        OR EXISTS (SELECT 1 FROM unnest(service_tags) t WHERE t ILIKE $${i})
        OR EXISTS (SELECT 1 FROM services s WHERE s.business_id = businesses.id AND s.active
                    AND (s.name_en ILIKE $${i} OR s.name_es ILIKE $${i})))`
    );
  }

  // Claimed listings first (they have owner-written profiles and can take bookings),
  // then alphabetical.
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM businesses
      WHERE ${conditions.join(' AND ')}
      ORDER BY (claim_status = 'claimed') DESC, name ASC`,
    params
  );
  res.json(rows);
});

// GET /api/businesses/meta/categories
router.get('/meta/categories', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT category FROM businesses WHERE status = 'published' ORDER BY category`
  );
  res.json(rows.map((r) => r.category));
});

// GET /api/businesses/:slug
router.get('/:slug', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM businesses WHERE slug = $1 AND status = 'published'`,
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  const business = rows[0];
  const services = await pool.query(
    `SELECT id, name_en, name_es, price_cents, duration_min
       FROM services WHERE business_id = $1 AND active ORDER BY id`,
    [business.id]
  );
  res.json({ ...business, services: services.rows });
});

export default router;
