import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { handleInboundSms, SmsError } from '../sms/engine.js';
import { normalizePhone } from '../lib/phone.js';
import { twiml, validateTwilioSignature } from '../sms/twilio.js';

const router = Router();

const demoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many demo messages. Please wait a few minutes and try again.' },
});

// The website widget always talks as a "demo-..." customer. Whatever it sends is
// mapped into that namespace, so this endpoint can never be used to read, book or
// cancel appointments for a real person's phone number.
function demoIdentity({ sessionId, phone }) {
  const raw = String(sessionId || phone || '');
  if (!raw) return null;
  if (/^demo-[a-z0-9]{6,40}$/i.test(raw)) return raw.toLowerCase();
  return `demo-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20)}`;
}

// POST /api/sms/simulate  { sessionId, body, businessSlug }
// Powers the "Text to book" widget so anyone can try the flow without a real phone.
// Bookings made here are marked created_via = 'sms_demo': they never block real slots
// and owners can hide them in their dashboard.
router.post('/simulate', demoLimiter, async (req, res) => {
  const { sessionId, phone, body, businessSlug } = req.body || {};
  const identity = demoIdentity({ sessionId, phone });
  if (!identity || typeof body !== 'string' || !body.trim() || !businessSlug) {
    return res.status(400).json({ error: 'sessionId, body, and businessSlug are required' });
  }
  try {
    const result = await handleInboundSms({ phone: identity, body, businessSlug, demo: true });
    res.json({ reply: result.reply, lang: result.lang });
  } catch (err) {
    if (err instanceof SmsError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// GET /api/sms/thread?sessionId=&businessSlug=   (demo conversations only)
router.get('/thread', demoLimiter, async (req, res) => {
  const identity = demoIdentity({ sessionId: req.query.sessionId, phone: req.query.phone });
  if (!identity || !req.query.businessSlug) {
    return res.status(400).json({ error: 'sessionId and businessSlug are required' });
  }
  const { rows } = await pool.query(
    `SELECT m.body, m.direction, m.lang, m.created_at
       FROM sms_messages m
       JOIN customers c ON c.id = m.customer_id
       JOIN businesses b ON b.id = m.business_id
      WHERE c.phone = $1 AND b.slug = $2
      ORDER BY m.created_at ASC`,
    [identity, req.query.businessSlug]
  );
  res.json(rows);
});

// POST /api/sms/webhook: Twilio's form-encoded shape (From, To, Body).
// The business is found from the number that was texted (To), because Twilio has no way
// to send a business slug. Requests must carry a valid X-Twilio-Signature.
router.post('/webhook', async (req, res) => {
  if (!config.twilioAuthToken) {
    return res.status(503).type('text/plain').send('SMS webhook is not configured (TWILIO_AUTH_TOKEN).');
  }
  const url = config.twilioWebhookUrl || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const valid = validateTwilioSignature({
    authToken: config.twilioAuthToken,
    url,
    params: req.body || {},
    signature: req.get('X-Twilio-Signature'),
  });
  if (!valid) return res.status(403).type('text/plain').send('Invalid signature.');

  const { From, To, Body } = req.body;
  try {
    const result = await handleInboundSms({ phone: From, body: Body, smsNumber: normalizePhone(To) });
    res.type('text/xml').send(twiml(result.reply));
  } catch (err) {
    if (err instanceof SmsError) {
      console.warn('SMS webhook rejected:', err.message);
      return res.type('text/xml').send(twiml(null));
    }
    throw err;
  }
});

export default router;
