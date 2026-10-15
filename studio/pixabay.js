// ============================================================
//  studio/pixabay.js — second free photo source (Pixabay Content
//  Licence: free commercial use, no attribution required). Active only
//  when PIXABAY_API_KEY is set. Photos are downloaded and stored with
//  the draft (Pixabay forbids hotlinking). Same content filter as Pexels.
// ============================================================

const { RELIGIOUS } = require('./pexels');

const API = 'https://pixabay.com/api/';
const MAX_BYTES = 15 * 1024 * 1024;
const key = () => process.env.PIXABAY_API_KEY || '';

/** Pixabay search → list of { id: "pb:<n>", url, thumb } (vertical photos, filtered). */
async function search(query, fetchImpl = fetch) {
  const url = `${API}?key=${encodeURIComponent(key())}&q=${encodeURIComponent(query.slice(0, 100))}`
    + '&image_type=photo&orientation=vertical&safesearch=true&min_height=1200&per_page=40';
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`pixabay search ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data.hits) ? data.hits : [])
    .filter((p) => Number.isInteger(p.id) && typeof p.largeImageURL === 'string' && p.imageHeight > p.imageWidth)
    .filter((p) => !RELIGIOUS.test(`${p.tags || ''} ${p.pageURL || ''}`))
    .map((p) => ({ id: `pb:${p.id}`, url: p.largeImageURL, thumb: p.webformatURL || '' }))
    .filter((p) => /^https:\/\/(cdn\.)?pixabay\.com\//.test(p.url) && /^https:\/\/(cdn\.)?pixabay\.com\//.test(p.thumb));
}

/** Download one photo (Pixabay CDN only). Returns a data URI. */
async function download(photoUrl, fetchImpl = fetch) {
  const u = new URL(photoUrl);
  if (u.protocol !== 'https:' || !['pixabay.com', 'cdn.pixabay.com'].includes(u.hostname)) throw new Error('unexpected photo host');
  const res = await fetchImpl(u.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`pixabay download ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('unexpected photo type');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('photo too large');
  return `data:${type};base64,` + buf.toString('base64');
}

/** Up to `max` unused candidates over all queries (deduplicated). */
async function candidates(queries, used, max = 15, fetchImpl = fetch) {
  if (!key()) return [];
  const out = new Map();
  for (const q of queries.filter(Boolean)) {
    for (const p of await search(q, fetchImpl)) {
      if (!used.has(p.id) && !out.has(p.id)) out.set(p.id, p);
      if (out.size >= max) return [...out.values()];
    }
  }
  return [...out.values()];
}

module.exports = { search, download, candidates };
