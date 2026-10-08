// ============================================================
//  studio/pexels.js — real destination photos from Pexels
//  Pexels licence: free commercial use, no attribution required.
//  Photos whose description mentions a religious building or symbol
//  are skipped (client rule); the client still reviews every draft.
// ============================================================

const API = 'https://api.pexels.com/v1/search';
const RELIGIOUS = /mosque|minaret|church|cathedral|chapel|temple|shrine|synagogue|monastery|basilica|religio|prayer|cross\b|crucifix|crescent|islam|christian|buddh|hindu|jewish|dome|moschee|kirche|kathedrale|tempel/i;
// Perceived brightness (0-255) of the Pexels average colour, e.g. "#A3B8CC".
const MIN_BRIGHTNESS = 120;
function brightness(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
const MAX_BYTES = 15 * 1024 * 1024;

const key = () => process.env.PEXELS_API_KEY || '';

/** Pexels search → list of { id, url } for portrait photos that pass the content filter. */
async function search(query, fetchImpl = fetch) {
  const url = `${API}?query=${encodeURIComponent(query)}&orientation=portrait&size=large&per_page=40`;
  const res = await fetchImpl(url, { headers: { Authorization: key() }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`pexels search ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data.photos) ? data.photos : [])
    .filter((p) => Number.isInteger(p.id) && typeof p.src?.original === 'string' && p.height > p.width && p.height >= 2000)
    .filter((p) => !RELIGIOUS.test(`${p.alt || ''} ${p.url || ''}`))
    .filter((p) => brightness(p.avg_color) >= MIN_BRIGHTNESS) // the template adds a dark filter, so start bright
    .map((p) => ({ id: p.id, url: p.src.original }));
}

/** Download one photo (Pexels CDN only), resized by the CDN to ~2200 px wide. Returns a data URI. */
async function download(photoUrl, fetchImpl = fetch) {
  const u = new URL(photoUrl);
  if (u.protocol !== 'https:' || u.hostname !== 'images.pexels.com') throw new Error('unexpected photo host');
  u.search = '?auto=compress&cs=tinysrgb&w=2200';
  const res = await fetchImpl(u.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`pexels download ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('unexpected photo type');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('photo too large');
  return `data:${type};base64,` + buf.toString('base64');
}

/**
 * First unused photo for the queries (tried in order). `used` = Set of Pexels ids already used.
 * Returns { id, dataUri } or null when nothing suitable is found (or no API key is set).
 */
async function findPhoto(queries, used, fetchImpl = fetch) {
  if (!key()) return null;
  for (const q of queries.filter(Boolean)) {
    const fresh = (await search(q, fetchImpl)).filter((p) => !used.has(p.id));
    if (fresh.length) {
      const pick = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
      return { id: pick.id, dataUri: await download(pick.url, fetchImpl) };
    }
  }
  return null;
}

module.exports = { findPhoto, search, download, brightness, RELIGIOUS };
