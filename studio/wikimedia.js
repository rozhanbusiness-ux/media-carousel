// ============================================================
//  studio/wikimedia.js — photos from Wikimedia Commons. Only licences
//  that allow a commercial post without sharing it under the same licence:
//  CC0, public domain and CC BY (never CC BY-SA). Credit is kept with the
//  photo ("Foto: <author> / Wikimedia Commons, CC BY 4.0"). No key needed.
// ============================================================

const { RELIGIOUS } = require('./pexels');

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'MediaTravelStudio/1.0 (https://media-travels.com; info@media-travels.com)';
const MAX_BYTES = 15 * 1024 * 1024;
const OK_LICENSE = /^(cc0|public domain|pd|cc by \d(\.\d)?)$/i;
const HOST = /^https:\/\/upload\.wikimedia\.org\//;
const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

/** Search (quality images first when `quality`) → [{ id: "wm:<pageid>", url, preview, thumb, w, h, credit }]. */
async function search(query, fetchImpl = fetch, quality = false) {
  const q = `${query.slice(0, 100)} filetype:bitmap${quality ? ' incategory:"Quality_images"' : ''}`;
  const url = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=40&gsrsearch=${encodeURIComponent(q)}`
    + '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2200';
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`wikimedia search ${res.status}`);
  const pages = Object.values(((await res.json()).query || {}).pages || {});
  return pages.map((p) => {
    const ii = (p.imageinfo || [])[0] || {};
    const m = ii.extmetadata || {};
    const lic = strip(m.LicenseShortName && m.LicenseShortName.value);
    return { p, ii, m, lic };
  })
    .filter(({ p, ii, lic }) => Number.isInteger(p.pageid) && ii.mime === 'image/jpeg' && OK_LICENSE.test(lic) && Math.min(ii.width, ii.height) >= 1600)
    .filter(({ p, m }) => !RELIGIOUS.test(`${p.title} ${strip(m.ImageDescription && m.ImageDescription.value)} ${strip(m.Categories && m.Categories.value)}`))
    .map(({ p, ii, m, lic }) => ({
      id: `wm:${p.pageid}`, w: ii.width, h: ii.height, landscape: ii.width > ii.height,
      url: ii.thumburl || ii.url, preview: String(ii.thumburl || ii.url).replace(/\/2200px-/, '/1024px-'), thumb: String(ii.thumburl || ii.url).replace(/\/2200px-/, '/400px-'),
      credit: { source: 'Wikimedia Commons', author: strip(m.Artist && m.Artist.value) || 'Wikimedia Commons', authorUrl: ii.descriptionurl || '',
        license: lic, licenseUrl: m.LicenseUrl ? String(m.LicenseUrl.value || '') : '' },
    }))
    .filter((x) => HOST.test(x.url) && HOST.test(x.preview));
}

/** Download (Wikimedia upload host only) → data URI. */
async function download(photoUrl, fetchImpl = fetch) {
  const u = new URL(photoUrl);
  if (u.protocol !== 'https:' || u.hostname !== 'upload.wikimedia.org') throw new Error('unexpected photo host');
  const res = await fetchImpl(u.toString(), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`wikimedia download ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('unexpected photo type');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('photo too large');
  return `data:${type};base64,` + buf.toString('base64');
}

module.exports = { search, download, OK_LICENSE };
