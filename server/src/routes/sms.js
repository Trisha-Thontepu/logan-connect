import { Router } from 'express';
import { handleInboundSms } from '../sms/engine.js';
import { pool } from '../db/pool.js';

const router = Router();

// POST /api/sms/simulate  { phone, body, businessSlug }
// Used by the demo "Text to book" widget on the site so judges/users can try the
// bilingual booking flow without needing a real phone number or Twilio account.
router.post('/simulate', async (req, res) => {
  const { phone, body, businessSlug } = req.body;
  if (!phone || !body || !businessSlug) {
    return res.status(400).json({ error: 'phone, body, and businessSlug are required' });
  }
  try {
    const result = await handleInboundSms({ phone, body, businessSlug });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/sms/thread?phone=&businessSlug=
router.get('/thread', async (req, res) => {
  const { phone, businessSlug } = req.query;
  const { rows } = await pool.query(
    `SELECT m.body, m.direction, m.lang, m.created_at
     FROM sms_messages m
     JOIN customers c ON c.id = m.customer_id
     JOIN businesses b ON b.id = m.business_id
     WHERE c.phone = $1 AND b.slug = $2
     ORDER BY m.created_at ASC`,
    [phone, businessSlug]
  );
  res.json(rows);
});

// POST /api/sms/webhook — Twilio-compatible shape (x-www-form-urlencoded: From, Body)
// Drop-in target once a real Twilio number is connected; not used by the demo UI directly.
router.post('/webhook', async (req, res) => {
  const { From, Body, businessSlug } = req.body;
  try {
    const result = await handleInboundSms({ phone: From, body: Body, businessSlug });
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${result.reply}</Message></Response>`);
  } catch (err) {
    res.status(400).send('<Response></Response>');
  }
});

export default router;
