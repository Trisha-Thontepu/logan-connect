import crypto from 'node:crypto';

// Twilio signs every webhook request. Verifying the signature is what stops anyone on
// the internet from posting fake texts (and creating fake appointments) to the endpoint.
// https://www.twilio.com/docs/usage/webhooks/webhooks-security

export function computeTwilioSignature(authToken, url, params) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

export function validateTwilioSignature({ authToken, url, params, signature }) {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(computeTwilioSignature(authToken, url, params));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Escape text for use inside a TwiML <Message>. A raw "&" would produce invalid XML. */
export function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

export function twiml(reply) {
  const message = reply ? `<Message>${escapeXml(reply)}</Message>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${message}</Response>`;
}
