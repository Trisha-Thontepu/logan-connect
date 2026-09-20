import { normalize } from './datetime.js';

// Words that carry no information about *which* service someone wants.
const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'con', 'para', 'por', 'favor', 'un', 'una',
  'and', 'the', 'a', 'an', 'of', 'for', 'please', 'full', 'set', 'completo', 'completos',
  'quiero', 'necesito', 'want', 'need', 'book', 'cita', 'appointment', 'appt', 'me', 'i', 'to',
]);
// A few spellings people actually type.
const SYNONYMS = new Map([['manicura', 'manicure'], ['pedicura', 'pedicure'], ['unas', 'nail'], ['acrilicas', 'acrilico']]);

function stem(word) {
  const w = SYNONYMS.get(word) || word;
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
}

function tokens(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Which of a business's services does this message ask for?
 *
 * "gel manicure"  -> Gel Manicure (every word of the name is present)
 * "manicure"      -> Classic Manicure AND Gel Manicure (ambiguous; the caller should ask)
 * "hola"          -> nothing
 *
 * The original engine required the full service name to appear verbatim, so its own
 * suggested reply ("manicure") matched nothing.
 */
export function matchServices(text, services) {
  const words = new Set(tokens(text));
  if (!words.size) return [];

  const scored = [];
  for (const service of services) {
    let best = null;
    for (const name of [service.name_en, service.name_es]) {
      if (!name) continue;
      const nameTokens = [...new Set(tokens(name))];
      if (!nameTokens.length) continue;
      const hits = nameTokens.filter((t) => words.has(t)).length;
      if (!hits) continue;
      const full = hits === nameTokens.length;
      if (!best || full > best.full || (full === best.full && hits > best.hits)) {
        best = { full, hits, size: nameTokens.length };
      }
    }
    if (best) scored.push({ service, ...best });
  }
  if (!scored.length) return [];

  const complete = scored.filter((s) => s.full);
  if (complete.length) {
    // Prefer the most specific full match ("Gel Manicure" over a service just called "Manicure").
    const maxSize = Math.max(...complete.map((s) => s.size));
    return complete.filter((s) => s.size === maxSize).map((s) => s.service);
  }
  const maxHits = Math.max(...scored.map((s) => s.hits));
  return scored.filter((s) => s.hits === maxHits).map((s) => s.service);
}
