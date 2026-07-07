import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

// GET /api/businesses?category=&q=
router.get('/', async (req, res) => {
  const { category, q } = req.query;
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(tagline) LIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, slug, name, category, tagline, owner_name, address, lat, lng,
            phone, appointment_only, languages, hours_json, photo_seed
     FROM businesses ${where} ORDER BY name ASC`,
    params
  );
  res.json(rows);
});

// GET /api/businesses/:slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const { rows } = await pool.query('SELECT * FROM businesses WHERE slug = $1', [slug]);
  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  const business = rows[0];
  const services = await pool.query(
    'SELECT id, name_en, name_es, price_cents, duration_min FROM services WHERE business_id = $1 ORDER BY id',
    [business.id]
  );
  res.json({ ...business, services: services.rows });
});

// GET /api/businesses/meta/categories
router.get('/meta/categories', async (req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT category FROM businesses ORDER BY category');
  res.json(rows.map((r) => r.category));
});

export default router;
