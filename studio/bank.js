// ============================================================
//  studio/bank.js — photo bank (client plan): for each destination
//  (later also offer types and occasions) many photos are collected from
//  Pexels, Unsplash and Wikimedia, strictly ranked by Gemini in small
//  batches, and the best (8+) are stored with their credit. Posts take
//  their photos from here. Stored in cache/studio-bank/<key>/ (server
//  volume, never in git). Built by bank-build.js (night job or by hand).
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pexels = require('./pexels');
const unsplash = require('./unsplash');
const wikimedia = require('./wikimedia');
const destinations = require('./destinations');
const { shotQueries } = require('./photo-sources');
const { rankPhotos } = require('./photo-rank');

const DIR = path.join(__dirname, '..', 'cache', 'studio-bank');
// Unsplash Demo keys allow 50 requests per hour: on 403/429 Unsplash is paused for an hour and
// the destinations that missed it are topped up later (bank-build.js waits and runs them again).
let unsplashPausedUntil = 0;
const unsplashPaused = () => Date.now() < unsplashPausedUntil;
const KEEP = 50; // best photos kept per entry (client: about 50 per destination)
const MIN_SCORE = 8;
const BATCH = 10; // photos per Gemini call (small batches: reliable answers)
const MAX_CANDIDATES = 360;

const safeKey = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
const entryDir = (k) => path.join(DIR, safeKey(k));
const fileId = (id) => crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 16);

/** Bank entry → { key, name, kind, queries }. */
function target(key, name, kind = 'flight', country = '') {
  const offer = { kind, to: { code: /^[A-Z]{3}$/.test(key) ? key : '', name }, country };
  const own = (destinations.find(offer) || {}).q || [];
  return { key, name, country, kind, queries: [...new Set([...shotQueries(offer), ...own, `${name} landmark`, `${name} city view`, `${name} travel`])].slice(0, 12) };
}

/** Candidates from all sources (deduplicated by id), Pexels first. */
async function collect(t, log = console.log) {
  const out = new Map();
  const add = (list) => { for (const p of list) if (!out.has(p.id) && out.size < MAX_CANDIDATES) out.set(p.id, p); };
  for (const q of t.queries) {
    try { add(await pexels.search(q)); } catch (err) { log(`pexels "${q}": ${err.message}`); }
    if (unsplash.enabled()) {
      if (unsplashPaused()) t.unsplashMissed = true;
      else {
        try { add(await unsplash.search(q)); } catch (err) {
          log(`unsplash "${q}": ${err.message}`);
          if (/ (403|429)$/.test(err.message)) { unsplashPausedUntil = Date.now() + 61 * 60000; t.unsplashMissed = true; log('unsplash: hourly limit reached, paused for 1 hour'); }
        }
      }
    }
  }
  // Wikimedia: quality images of the place itself (its strength: real landmarks, incl. Kurdistan).
  for (const q of [t.name, ...t.queries.slice(-3)]) {
    try { add(await wikimedia.search(q, fetch, true)); } catch (err) { log(`wikimedia "${q}": ${err.message}`); }
  }
  try { add(await wikimedia.search(t.name)); } catch (err) { log(`wikimedia "${t.name}": ${err.message}`); }
  return [...out.values()];
}

/** Rank in small batches; returns all with score (null when a batch failed). */
async function rankAll(list, t) {
  const place = [t.name, t.country].filter(Boolean).join(', ');
  const ranked = [];
  for (let i = 0; i < list.length; i += BATCH) ranked.push(...(await rankPhotos(list.slice(i, i + BATCH), place, fetch, t.kind)));
  return ranked.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

const downloadAny = (url) => (/^https:\/\/images\.unsplash\.com\//.test(url) ? unsplash.download(url)
  : /^https:\/\/upload\.wikimedia\.org\//.test(url) ? wikimedia.download(url) : pexels.download(url));

function readIndex(key) {
  try { return JSON.parse(fs.readFileSync(path.join(entryDir(key), 'index.json'), 'utf8')); } catch { return { key, photos: [] }; }
}
function writeIndex(key, index) {
  fs.mkdirSync(entryDir(key), { recursive: true });
  fs.writeFileSync(path.join(entryDir(key), 'index.json'), JSON.stringify(index, null, 1));
}

/** Build (or top up) one entry: keeps existing photos, adds the best new ones up to KEEP. */
async function build(t, log = console.log) {
  const index = readIndex(t.key);
  const have = new Set(index.photos.map((p) => p.id));
  const removed = new Set(index.removed || []); // deleted by the client: never again
  const seen = new Set(index.seen || []); // ranked before: not ranked (and paid) again
  const list = (await collect(t, log)).filter((p) => !have.has(p.id) && !removed.has(p.id) && !seen.has(p.id));
  log(`${t.key}: ${list.length} candidates`);
  const ranked = await rankAll(list, t);
  const scored = ranked.filter((c) => c.score != null).length;
  const good = ranked.filter((c) => c.score != null && c.score >= MIN_SCORE).slice(0, Math.max(0, KEEP - index.photos.length));
  for (const c of good) {
    try {
      const dataUri = await downloadAny(c.url);
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUri);
      if (!m) continue;
      const file = `${fileId(c.id)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      fs.mkdirSync(entryDir(t.key), { recursive: true });
      fs.writeFileSync(path.join(entryDir(t.key), file), Buffer.from(m[2], 'base64'));
      index.photos.push({ id: c.id, file, score: c.score, shot: c.shot || 'other', x: Number.isInteger(c.x) ? c.x : 50,
        why: c.why || '', thumb: c.thumb || '', credit: c.credit || {}, added: new Date().toISOString() });
    } catch (err) { log(`${t.key}: download ${c.id}: ${err.message}`); }
  }
  index.seen = [...new Set([...(index.seen || []), ...ranked.filter((c) => c.score != null).map((c) => c.id)])].slice(-5000);
  index.name = t.name; index.kind = t.kind; index.builtAt = new Date().toISOString();
  writeIndex(t.key, index);
  log(`${t.key}: ${scored}/${ranked.length} scored, ${good.length} new (8+), ${index.photos.length} in bank`);
  return { key: t.key, unsplashMissed: !!t.unsplashMissed, candidates: ranked.length, scored, added: good.length, total: index.photos.length, top: ranked.slice(0, 24) };
}

module.exports = { unsplashPausedUntil: () => unsplashPausedUntil, build, target, readIndex, writeIndex, entryDir, DIR, MIN_SCORE, KEEP };
