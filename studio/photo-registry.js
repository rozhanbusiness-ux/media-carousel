// ============================================================
//  studio/photo-registry.js — every photo used in a draft, with its
//  destination. Rule (client): a photo is never used for another
//  destination, and not again for the same destination within 60 days.
//  Keys: Pexels id (number), Pixabay id ("pb:123"), library file
//  ("lib:EBL-1.jpg") or content hash ("h:<sha1>") for uploads/AI images.
//  Stored in cache/studio-photo-registry.txt (one JSON line per use).
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'cache', 'studio-photo-registry.txt');
const SAME_DEST_DAYS = 60;
const MAX_LINES = 20000;

const norm = (dest) => String(dest || '').trim().toLowerCase();
const keyOf = (id) => (typeof id === 'number' ? `px:${id}` : String(id));
const hashKey = (dataUri) => 'h:' + crypto.createHash('sha1').update(String(dataUri || '')).digest('hex');

function load(file = FILE) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Ids (in the form the sources return: numbers for Pexels, strings otherwise) that must not be used for `dest`. */
function blocked(dest, now = Date.now(), file = FILE) {
  const d = norm(dest);
  const out = new Set();
  for (const r of load(file)) {
    if (r.d !== d || now - r.t < SAME_DEST_DAYS * 864e5) {
      out.add(r.k);
      const m = /^px:(\d+)$/.exec(r.k);
      if (m) out.add(Number(m[1]));
    }
  }
  return out;
}

/** True when the photo may be used for `dest`. */
const allowed = (id, dest, now = Date.now(), file = FILE) => !blocked(dest, now, file).has(keyOf(id));

/** Record a use. `id` may be null when only the image data is known (then its hash is stored). */
function record(id, dest, dataUri, file = FILE) {
  const keys = [];
  if (id != null && id !== '') keys.push(keyOf(id));
  if (dataUri && /^data:image\//.test(dataUri)) keys.push(hashKey(dataUri));
  if (!keys.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const t = Date.now();
  fs.appendFileSync(file, keys.map((k) => JSON.stringify({ k, d: norm(dest), t })).join('\n') + '\n');
  const lines = load(file);
  if (lines.length > MAX_LINES) fs.writeFileSync(file, lines.slice(-MAX_LINES).map((r) => JSON.stringify(r)).join('\n') + '\n');
}

module.exports = { blocked, allowed, record, keyOf, hashKey, SAME_DEST_DAYS };
