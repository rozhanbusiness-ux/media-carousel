// ============================================================
//  studio/unsplash.js — photos from Unsplash (Unsplash License: free
//  commercial use). API rules we follow: credit "Foto: <name> / Unsplash",
//  report each use to the download endpoint. Active only when
//  UNSPLASH_ACCESS_KEY is set (server .env, never in git).
// ============================================================

const { RELIGIOUS } = require('./pexels');

const API = 'https://api.unsplash.com';
const MAX_BYTES = 15 * 1024 * 1024;
const key = () => process.env.UNSPLASH_ACCESS_KEY || '';
const UTM = 'utm_source=media_travel_studio&utm_medium=referral';

/** Search → [{ id: "us:<id>", url, preview, thumb, w, h, credit }] (filtered). */
async function search(query, fetchImpl = fetch) {
  const url = `${API}/search/photos?query=${encodeURIComponent(query.slice(0, 100))}&per_page=30&content_filter=high`;
  const res = await fetchImpl(url, { headers: { Authorization: `Client-ID ${key()}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`unsplash search ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data.results) ? data.results : [])
    .filter((p) => typeof p.id === 'string' && /^[\w-]{4,40}$/.test(p.id) && p.urls && typeof p.urls.raw === 'string')
    .filter((p) => Math.min(p.width, p.height) >= 2000 && Math.max(p.width, p.height) >= 3000) // highest resolution only (client)
    .filter((p) => !RELIGIOUS.test(`${p.alt_description || ''} ${p.description || ''} ${(p.tags || []).map((t) => t.title).join(' ')}`))
    .map((p) => ({
      id: `us:${p.id}`, w: p.width, h: p.height, landscape: p.width > p.height,
      url: `${p.urls.raw}&w=2200&q=85&fm=jpg`, preview: p.urls.regular, thumb: p.urls.small,
      credit: { source: 'Unsplash', author: String((p.user && p.user.name) || '').slice(0, 80),
        authorUrl: p.user && p.user.links ? `${p.user.links.html}?${UTM}` : '', license: 'Unsplash License',
        downloadLocation: p.links && p.links.download_location ? p.links.download_location : '' },
    }))
    .filter((p) => /^https:\/\/images\.unsplash\.com\//.test(p.url) && /^https:\/\/images\.unsplash\.com\//.test(p.preview));
}

/** Download (Unsplash image CDN only) → data URI. */
async function download(photoUrl, fetchImpl = fetch) {
  const u = new URL(photoUrl);
  if (u.protocol !== 'https:' || u.hostname !== 'images.unsplash.com') throw new Error('unexpected photo host');
  const res = await fetchImpl(u.toString(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`unsplash download ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('unexpected photo type');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('photo too large');
  return `data:${type};base64,` + buf.toString('base64');
}

/** Required by the Unsplash API rules when a photo is used (best effort). */
async function trackUse(downloadLocation, fetchImpl = fetch) {
  try {
    const u = new URL(downloadLocation);
    if (u.protocol !== 'https:' || u.hostname !== 'api.unsplash.com') return;
    await fetchImpl(u.toString(), { headers: { Authorization: `Client-ID ${key()}` }, signal: AbortSignal.timeout(15000) });
  } catch { /* not critical */ }
}

module.exports = { search, download, trackUse, enabled: () => !!key() };
