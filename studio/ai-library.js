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
const MAX_PER_KEY = 30;
const KEY = /^[A-Za-z0-9-]{2,40}$/;
const FILE = /^([A-Za-z0-9-]{2,40})-([a-f0-9]{8})\.(jpg|png|webp)$/;
const DATA = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

/** Library key: airport code, else the place name (letters only), else ''. */
const keyOf = (place) => {
  const k = String((place && (place.code || place.name)) || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return KEY.test(k) ? k.toUpperCase() : '';
};

function list(key) {
  if (!KEY.test(key)) return [];
  try {
    return fs.readdirSync(DIR).filter((f) => FILE.test(f) && FILE.exec(f)[1] === key)
      .map((f) => ({ file: f, added: fs.statSync(path.join(DIR, f)).mtimeMs })).sort((a, b) => b.added - a.added);
  } catch { return []; }
}

/** Save a photo (data URI) under a key; returns the file name. The same photo is kept once. */
function save(key, dataUri) {
  const m = DATA.exec(dataUri || '');
  if (!KEY.test(key) || !m) throw new Error('Foto kann nicht gespeichert werden.');
  const buf = Buffer.from(m[2], 'base64');
  const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const file = `${key}-${id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  if (list(key).length >= MAX_PER_KEY && !fs.existsSync(path.join(DIR, file))) throw new Error(`Bibliothek für ${key} ist voll (max. ${MAX_PER_KEY}).`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, file), buf);
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

module.exports = { keyOf, list, save, fileOf, dataUriOf, KEY, FILE };
