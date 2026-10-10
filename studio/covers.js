// ============================================================
//  studio/covers.js — cover photos for multi-offer posts, per offer
//  TYPE (never a destination; client decision). The client picks up
//  to 5 per type from ranked Pexels suggestions; posts rotate through
//  them. Stored in cache/studio-covers/ (server volume, never in git).
// ============================================================

const fs = require('fs');
const path = require('path');
const { candidates: pexelsCandidates, download: pexelsDownload } = require('./pexels');
const { rankPhotos } = require('./photo-rank');

const DIR = path.join(__dirname, '..', 'cache', 'studio-covers');
const KINDS = ['flight', 'package'];
const MAX_PER_KIND = 5;
const QUERIES = {
  flight: ['airplane flying blue sky', 'passenger airplane clouds sunny', 'airplane wing above clouds', 'airliner sunset sky', 'airplane window view clouds'],
  package: ['luxury beach resort pool', 'resort pool sea view sunny', 'luxury hotel pool palm trees', 'beach resort aerial', 'infinity pool ocean'],
};
const SUBJECT = {
  flight: 'a flight offer (a passenger airplane in a bright sky, elegant; any destination)',
  package: 'a holiday package offer (a bright, luxurious beach resort or hotel pool; any destination)',
};
const lastSuggestions = { flight: [], package: [] }; // the client may only save photos we suggested

const fileOf = (kind, id) => path.join(DIR, `${kind}-${id}.txt`);
const validId = (id) => Number.isInteger(id) && id > 0 && id < 1e12;

function list(kind) {
  if (!KINDS.includes(kind)) return [];
  try {
    return fs.readdirSync(DIR).map((f) => new RegExp(`^${kind}-(\\d+)\\.txt$`).exec(f)).filter(Boolean)
      .map((m) => ({ kind, id: Number(m[1]), added: fs.statSync(path.join(DIR, m[0])).mtimeMs }))
      .sort((a, b) => a.added - b.added);
  } catch { return []; }
}

/** Ranked Pexels suggestions (best first), excluding photos already saved. */
async function suggest(kind) {
  if (!KINDS.includes(kind)) throw new Error('bad kind');
  const used = new Set(list(kind).map((c) => c.id));
  const ranked = await rankPhotos(await pexelsCandidates(QUERIES[kind], used, 15), SUBJECT[kind]);
  lastSuggestions[kind] = ranked;
  return ranked.map((c) => ({ id: c.id, thumb: c.thumb, score: c.score, why: c.why || '' }));
}

async function save(kind, id) {
  if (!KINDS.includes(kind) || !validId(id)) throw new Error('bad request');
  if (list(kind).length >= MAX_PER_KIND) throw new Error('full');
  const c = lastSuggestions[kind].find((x) => x.id === id);
  if (!c) throw new Error('unknown photo');
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileOf(kind, id), await pexelsDownload(c.url));
}

function remove(kind, id) {
  if (!KINDS.includes(kind) || !validId(id)) return false;
  try { fs.unlinkSync(fileOf(kind, id)); return true; } catch { return false; }
}

/** Data URI of a saved cover, or null. */
function read(kind, id) {
  if (!KINDS.includes(kind) || !validId(id)) return null;
  try { return fs.readFileSync(fileOf(kind, id), 'utf8'); } catch { return null; }
}

let turn = 0;
/** Next saved cover of this type (rotating), or null when none is saved. */
function next(kind) {
  const saved = list(kind);
  if (!saved.length) return null;
  const c = saved[turn++ % saved.length];
  return { pexelsId: c.id, dataUri: read(kind, c.id) };
}

/** Automatic fallback when the client has not saved covers: the best-ranked suggestion. */
async function auto(kind, used) {
  let list2 = [];
  try { list2 = await pexelsCandidates(QUERIES[kind], used, 10); } catch (err) { console.error('studio cover:', err.message); }
  const ranked = await rankPhotos(list2, SUBJECT[kind]);
  const best = ranked.find((c) => c.score == null || c.score >= 5) || ranked[0];
  return best ? { pexelsId: best.id, dataUri: await pexelsDownload(best.url) } : null;
}

module.exports = { KINDS, MAX_PER_KIND, list, suggest, save, remove, read, next, auto };
