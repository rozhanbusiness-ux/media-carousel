// ============================================================
//  studio/ai-library.js — the client's library of good photos
//  (client decision 2026-11-05): a photo he likes is saved once and
//  can be picked again for the same place or theme, at no AI cost.
//  Files live in the cache volume (never in git), named
//  <key>-<8 hex>.<ext>; the key is an airport code, a place or a theme.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'cache', 'studio-ailib');
const MAX_PER_KEY = 300; // every generated photo is kept (client 2026-11-24: AI photos cost money)
const KEY = /^[A-Za-z0-9-]{2,40}$/;
const FILE = /^([A-Za-z0-9-]{2,40})-([a-f0-9]{8})\.(jpg|png|webp)$/;
const DATA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

/** Library key: airport code, else the place name (letters only), else ''. */
const keyOf = (place) => {
  const k = String((place && (place.code || place.name)) || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return KEY.test(k) ? k.toUpperCase() : '';
};

// Subject of each photo (client 2026-11-21): landmark, water, castle, ... (see SHOTS in image.js).
// Kept in one small index file next to the photos. Photos saved before this have no tag and count
// as 'landmark' (they were landmark close-ups).
const INDEX = path.join(DIR, 'subjects.json');
const SUBJECT = /^[a-z]{2,20}$/;
function readIndex() { try { return JSON.parse(fs.readFileSync(INDEX, 'utf8')) || {}; } catch { return {}; } }
function tag(file, subject, place, season, light) {
  if (!FILE.test(file) || !SUBJECT.test(subject || '')) return;
  const idx = readIndex();
  // v: 2 = photo style of 2026-11-24 (the only style kept by purgeOld).
  idx[file] = { subject, place: place ? String(place).slice(0, 120) : null, season: SUBJECT.test(season || '') ? season : null, light: SUBJECT.test(light || '') ? light : null, v: 2 };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(INDEX, JSON.stringify(idx));
}

function list(key, subject, season, light) {
  if (!KEY.test(key)) return [];
  const idx = readIndex();
  try {
    return fs.readdirSync(DIR).filter((f) => FILE.test(f) && FILE.exec(f)[1] === key)
      .map((f) => ({ file: f, subject: (idx[f] && idx[f].subject) || idx[f] || 'landmark', place: (idx[f] && idx[f].place) || null, season: (idx[f] && idx[f].season) || null, v: (idx[f] && idx[f].v) || 1, light: (idx[f] && idx[f].light) || 'blue', added: fs.statSync(path.join(DIR, f)).mtimeMs }))
      .filter((x) => (!subject || x.subject === subject) && (!season || x.season === season) && (!light || x.light === light)).sort((a, b) => b.added - a.added);
  } catch { return []; }
}

/** Save a photo (data URI) under a key; returns the file name. The same photo is kept once. */
function save(key, dataUri, subject, place, season, light) {
  const m = DATA.exec(dataUri || '');
  if (!KEY.test(key) || !m) throw new Error('Foto kann nicht gespeichert werden.');
  const buf = Buffer.from(m[2], 'base64');
  const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const file = `${key}-${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  if (list(key).length >= MAX_PER_KEY && !fs.existsSync(path.join(DIR, file))) throw new Error(`Bibliothek für ${key} ist voll (max. ${MAX_PER_KEY}).`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, file), buf);
  if (subject) tag(file, subject, place, season, light);
  return file;
}

/** Absolute path of a library file (validated name), or null. */
const fileOf = (file) => (FILE.test(file || '') ? path.join(DIR, file) : null);

function dataUriOf(file) {
  const p = fileOf(file);
  if (!p || !fs.existsSync(p)) throw new Error('Foto nicht mehr in der Bibliothek.');
  const ext = FILE.exec(file)[3];
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fs.readFileSync(p).toString('base64')}`;
}

/** Delete a library photo (validated name) and its tag. */
function remove(file) {
  const p = fileOf(file);
  if (!p) throw new Error('bad file');
  try { fs.unlinkSync(p); } catch { /* already gone */ }
  const idx = readIndex();
  if (idx[file]) { delete idx[file]; fs.writeFileSync(INDEX, JSON.stringify(idx)); }
}

/** Delete every photo older than the 2026-11-24 photo style (client: clean the library). Returns the count. */
function purgeOld() {
  const idx = readIndex();
  let n = 0;
  let files = [];
  try { files = fs.readdirSync(DIR).filter((f) => FILE.test(f)); } catch { return 0; }
  for (const f of files) {
    if (idx[f] && idx[f].v === 2) continue;
    try { fs.unlinkSync(path.join(DIR, f)); n++; } catch { /* already gone */ }
    delete idx[f];
  }
  fs.writeFileSync(INDEX, JSON.stringify(idx));
  return n;
}

/** Number of photos per key. */
function counts() {
  const c = {};
  try { for (const f of fs.readdirSync(DIR)) { const m = FILE.exec(f); if (m) c[m[1]] = (c[m[1]] || 0) + 1; } } catch { /* empty */ }
  return c;
}

module.exports = { purgeOld, counts, remove, keyOf, list, save, tag, fileOf, dataUriOf, KEY, FILE };
