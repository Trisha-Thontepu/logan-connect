// Phone numbers are stored in E.164 (+16195550100) so the same person is always the
// same customer, whether the number arrived as "(619) 555-0100" or "619-555-0100".
// Demo sessions from the website widget use "demo-<random>" instead of a number.

const DEMO_RE = /^demo-[a-z0-9]{6,40}$/;

export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (DEMO_RE.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export const isDemoPhone = (phone) => typeof phone === 'string' && phone.startsWith('demo-');

/** "+16199555599" -> "(619) 955-5599". Anything else is returned unchanged. */
export function formatPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
