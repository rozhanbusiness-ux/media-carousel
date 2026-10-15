// ============================================================
//  studio/photo-sources.js — one entry point for real photos:
//  destination-specific search words (destinations.js, else Gemini
//  suggestions, else the generic fallback), Pexels + Pixabay, and the
//  photo registry (no photo for two destinations, 60 days per destination).
// ============================================================

const config = require('../config');
const pexels = require('./pexels');
const pixabay = require('./pixabay');
const registry = require('./photo-registry');
const destinations = require('./destinations');

const destOf = (offer) => (offer.to && (offer.to.code || offer.to.name)) || '';

// Gemini search-word suggestions for destinations not in destinations.js (cached per place).
const suggested = new Map();
async function suggestQueries(offer, fetchImpl = fetch) {
  const place = [offer.to && offer.to.name, offer.country].filter(Boolean).join(', ').slice(0, 80);
  if (!place || !config.GEMINI_API_KEY) return [];
  if (suggested.has(place)) return suggested.get(place);
  let list = [];
  try {
    const prompt = `Give 4 short stock-photo search phrases (2-5 English words each) for iconic, bright, non-religious travel photos of ${place}. `
      + 'Each phrase must name the place or a specific landmark, beach or view of it. No mosques, churches or temples. Answer as a JSON array of strings only.';
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const json = await res.json();
      const arr = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
      list = (Array.isArray(arr) ? arr : []).filter((s) => typeof s === 'string' && /^[\p{L}\p{N} '’.,-]{3,60}$/u.test(s)).slice(0, 4);
    }
  } catch (err) { console.error('studio query suggest:', err.message); }
  suggested.set(place, list);
  return list;
}

// Shot types searched first (client): aerial and elevated views with a clear sky, then the offer's mood.
function shotQueries(offer) {
  const n = String((offer.to && offer.to.name) || '').trim();
  if (!n) return [];
  const pkg = offer.kind && offer.kind !== 'flight';
  return pkg
    ? [`${n} beach aerial view`, `${n} turquoise bay from above`, `${n} coast panorama`, `${n} golden hour sea`]
    : [`${n} aerial view`, `${n} panorama viewpoint`, `${n} skyline blue sky`, `${n} golden hour`]; // never "drone": it returns photos of drones
}

/** Search words: shot types first, then the destination's own list, else Gemini suggestions + the generic fallback. */
async function queriesFor(offer, fallback) {
  const e = destinations.find(offer);
  const own = e ? e.q : [...(await suggestQueries(offer)), ...fallback(offer)];
  return [...new Set([...shotQueries(offer), ...own])];
}

/** Unused candidates (Pexels first, then Pixabay), registry rule applied. */
async function candidates(offer, fallback, used = new Set(), max = 15) {
  const block = registry.blocked(destOf(offer));
  const skip = { has: (id) => used.has(id) || block.has(id) || block.has(registry.keyOf(id)) };
  const queries = await queriesFor(offer, fallback);
  let out = [];
  try { out = await pexels.candidates(queries, skip, max); } catch (err) { console.error('studio pexels:', err.message); }
  if (out.length < max) {
    try { out = out.concat(await pixabay.candidates(queries, skip, max - out.length)); } catch (err) { console.error('studio pixabay:', err.message); }
  }
  return out;
}

/** Download from the right CDN (each adapter accepts only its own host). */
const download = (url) => (/^https:\/\/(cdn\.)?pixabay\.com\//.test(url) ? pixabay.download(url) : pexels.download(url));

/** Record that a photo is now used for this offer's destination. */
const use = (offer, id, dataUri) => registry.record(id, destOf(offer), dataUri);

module.exports = { candidates, download, use, destOf, queriesFor, suggestQueries, shotQueries };
