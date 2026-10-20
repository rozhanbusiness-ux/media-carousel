// ============================================================
//  studio/news-photos.js — real photos for "Ideen des Tages":
//  searches Wikimedia Commons (real places, also small ones), Pexels
//  and Unsplash for the idea's place and experience, ranks them with
//  the client's four photo rules (photo-rank.js, kind 'story') and
//  offers the best six. The chosen photo is stored in
//  cache/studio-news-photos/ (mounted volume, not in git) with its
//  credit. Never AI-generated photos for real places, never photos
//  taken from articles (copyright).
// ============================================================

const fs = require('fs');
const path = require('path');
const pexels = require('./pexels');
const unsplash = require('./unsplash');
const wikimedia = require('./wikimedia');
const { rankPhotos } = require('./photo-rank');

const DIR = path.join(__dirname, '..', 'cache', 'studio-news-photos');
const MAX_CANDIDATES = 30;
const BATCH = 10;

/** Search words: the place, and the place with the experience (shortened). */
function queries(idea) {
  const place = String(idea.place || idea.photoQuery || '').replace(/[^\p{L}\p{N} '-]/gu, ' ').trim().slice(0, 60);
  const angle = String(idea.angle || '').replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  return [...new Set([idea.photoQuery, place, angle && !angle.toLowerCase().includes(place.toLowerCase()) ? `${place} ${angle}` : angle].filter(Boolean))].slice(0, 3);
}

/** Up to six ranked candidates: [{ id, url, thumb, preview, credit, score, why, x }]. */
async function search(idea, fetchImpl = fetch, log = console.log) {
  const found = new Map();
  const add = (list) => { for (const p of list) if (!found.has(p.id) && found.size < MAX_CANDIDATES) found.set(p.id, p); };
  for (const q of queries(idea)) {
    try { add(await wikimedia.search(q, fetchImpl, true)); } catch (err) { log(`news photo wikimedia "${q}": ${err.message}`); }
    try { add(await wikimedia.search(q, fetchImpl)); } catch (err) { log(`news photo wikimedia "${q}": ${err.message}`); }
    try { add(await pexels.search(q, fetchImpl)); } catch (err) { log(`news photo pexels "${q}": ${err.message}`); }
    if (unsplash.enabled()) { try { add(await unsplash.search(q, fetchImpl)); } catch (err) { log(`news photo unsplash "${q}": ${err.message}`); } }
  }
  const list = [...found.values()];
  const subject = `${idea.place}${idea.angle ? ` – ${idea.angle}` : ''}`;
  const ranked = [];
  for (let i = 0; i < list.length; i += BATCH) ranked.push(...(await rankPhotos(list.slice(i, i + BATCH), subject, fetchImpl, 'story')));
  return ranked.filter((c) => c.score != null && c.score >= 6).sort((a, b) => b.score - a.score).slice(0, 6)
    .map(({ id, url, thumb, preview, credit, score, why, x }) => ({ id: String(id), url, thumb, preview, credit, score, why, x }));
}

const downloadAny = (url) => (/^https:\/\/images\.unsplash\.com\//.test(url) ? unsplash.download(url)
  : /^https:\/\/upload\.wikimedia\.org\//.test(url) ? wikimedia.download(url) : pexels.download(url));

const fileOf = (ideaId) => path.join(DIR, `${ideaId}.jpg`);

/** Download and keep the chosen candidate for the idea; returns { credit, x }. */
async function choose(ideaId, cand) {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(await downloadAny(cand.url));
  if (!m) throw new Error('unexpected photo data');
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileOf(ideaId), Buffer.from(m[2], 'base64'));
  if (cand.credit && cand.credit.downloadLocation) unsplash.trackUse(cand.credit.downloadLocation);
  return { own: true, credit: cand.credit || {}, x: Number.isInteger(cand.x) ? cand.x : 50 };
}

module.exports = { queries, search, choose, fileOf };
