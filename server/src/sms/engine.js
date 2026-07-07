import { pool } from '../db/pool.js';

// Lightweight language detection: looks for common Spanish booking words/accents.
// Good enough for a first message; once a customer has a preferred_lang on file we trust that instead.
const SPANISH_HINTS = /\b(hola|cita|quiero|cuando|cuándo|disponible|gracias|si|sí|no|hoy|mañana|servicio|precio)\b|[ñáéíóú]/i;

function detectLang(text) {
  return SPANISH_HINTS.test(text) ? 'es' : 'en';
}

const COPY = {
  en: {
    greeting: (biz) =>
      `Hi! This is ${biz.name}. Reply with the service you'd like (e.g. "manicure") and a day/time, like "gel manicure Thursday 3pm".`,
    noService: (services) =>
      `I didn't catch which service. We offer: ${services.map((s) => s.name_en).join(', ')}. Which one would you like?`,
    askTime: (service) =>
      `Got it — ${service.name_en}. What day and time works for you? (e.g. "Friday 2pm")`,
    confirmed: (service, when) =>
      `You're booked: ${service.name_en} on ${when}. Reply CANCEL anytime to cancel. See you soon!`,
    cancelled: `Your appointment has been cancelled. Reply anytime to book a new one.`,
    fallback: `Sorry, I didn't understand that. Reply with a service name, or CANCEL to cancel an existing appointment.`,
  },
  es: {
    greeting: (biz) =>
      `¡Hola! Soy ${biz.name}. Responde con el servicio que deseas (ej. "manicure") y un día/hora, como "manicure de gel jueves 3pm".`,
    noService: (services) =>
      `No identifiqué el servicio. Ofrecemos: ${services.map((s) => s.name_es || s.name_en).join(', ')}. ¿Cuál deseas?`,
    askTime: (service) =>
      `Perfecto — ${service.name_es || service.name_en}. ¿Qué día y hora te funciona? (ej. "viernes 2pm")`,
    confirmed: (service, when) =>
      `Tu cita está confirmada: ${service.name_es || service.name_en} el ${when}. Responde CANCELAR para cancelar. ¡Nos vemos pronto!`,
    cancelled: `Tu cita ha sido cancelada. Responde cuando quieras para agendar una nueva.`,
    fallback: `No entendí ese mensaje. Responde con el nombre de un servicio, o CANCELAR para cancelar una cita existente.`,
  },
};

// Strips accents so "manicure clasico" matches "Manicure Clásico" — most people
// don't bother typing accents on a phone keyboard, and the match should not silently fail.
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findService(text, services) {
  const lower = normalize(text);
  return services.find(
    (s) =>
      lower.includes(normalize(s.name_en)) ||
      (s.name_es && lower.includes(normalize(s.name_es)))
  );
}

function extractWhen(text) {
  // Naive extraction for demo purposes: grabs anything that looks like a day/time phrase.
  // Matched against the accent-stripped text so "miercoles" works same as "miércoles".
  const match = normalize(text).match(
    /\b(mon|tue|wed|thu|fri|sat|sun|lun|mar|mie|jue|vie|sab|dom)[a-z]*\s*\d{0,2}:?\d{0,2}\s*(am|pm)?\b/i
  );
  return match ? match[0].trim() : null;
}

async function getOrCreateCustomer(phone) {
  const existing = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
  if (existing.rows.length) return existing.rows[0];
  const created = await pool.query(
    'INSERT INTO customers (phone) VALUES ($1) RETURNING *',
    [phone]
  );
  return created.rows[0];
}

async function logMessage({ customerId, businessId, direction, body, lang }) {
  await pool.query(
    `INSERT INTO sms_messages (customer_id, business_id, direction, body, lang)
     VALUES ($1, $2, $3, $4, $5)`,
    [customerId, businessId, direction, body, lang]
  );
}

// Core handler: given an inbound SMS body + phone + business slug, returns the reply text
// and applies any side effects (booking, cancelling). Stateless across requests aside from
// what's reconstructable from sms_messages + appointments, which mirrors how a real Twilio
// webhook integration would need to work (no in-memory session).
export async function handleInboundSms({ phone, body, businessSlug }) {
  const bizRes = await pool.query('SELECT * FROM businesses WHERE slug = $1', [businessSlug]);
  if (!bizRes.rows.length) throw new Error('Unknown business');
  const business = bizRes.rows[0];

  const servicesRes = await pool.query('SELECT * FROM services WHERE business_id = $1', [business.id]);
  const services = servicesRes.rows;

  const customer = await getOrCreateCustomer(phone);

  // Only detect language fresh on this customer+business's first ever message.
  // After that, stick with whatever was established so the conversation doesn't
  // flip languages mid-thread just because a later message (like a day name) has no hints.
  const priorCount = await pool.query(
    'SELECT COUNT(*)::int AS n FROM sms_messages WHERE customer_id = $1 AND business_id = $2',
    [customer.id, business.id]
  );
  const isFirstMessage = priorCount.rows[0].n === 0;
  const lang = isFirstMessage ? detectLang(body) : customer.preferred_lang;

  if (lang !== customer.preferred_lang) {
    await pool.query('UPDATE customers SET preferred_lang = $1 WHERE id = $2', [lang, customer.id]);
    customer.preferred_lang = lang;
  }
  const t = COPY[lang];

  await logMessage({ customerId: customer.id, businessId: business.id, direction: 'inbound', body, lang });

  const trimmed = body.trim().toLowerCase();
  let reply;

  if (trimmed === 'cancel' || trimmed === 'cancelar') {
    await pool.query(
      `UPDATE appointments SET status = 'cancelled'
       WHERE customer_id = $1 AND business_id = $2 AND status IN ('pending','confirmed')`,
      [customer.id, business.id]
    );
    reply = t.cancelled;
  } else {
    const service = findService(body, services);
    const when = extractWhen(body);

    if (!service && !when) {
      reply = trimmed === 'hi' || trimmed === 'hola' || trimmed.length === 0
        ? t.greeting(business)
        : t.noService(services);
    } else if (service && !when) {
      reply = t.askTime(service);
    } else if (service && when) {
      await pool.query(
        `INSERT INTO appointments (business_id, customer_id, service_id, starts_at, status, created_via, notes)
         VALUES ($1, $2, $3, now() + interval '1 day', 'confirmed', 'sms', $4)`,
        [business.id, customer.id, service.id, `Requested: ${when}`]
      );
      reply = t.confirmed(service, when);
    } else {
      // Time given but no service recognized yet
      reply = t.noService(services);
    }
  }

  await logMessage({ customerId: customer.id, businessId: business.id, direction: 'outbound', body: reply, lang });

  return { reply, lang, customer };
}
