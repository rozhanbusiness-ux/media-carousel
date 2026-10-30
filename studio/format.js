// ============================================================
//  studio/format.js — which sizes the studio renders (client decision
//  2026-10-30): mostly WhatsApp status and stories, so "story" only by
//  default; "feed" adds the square post for Facebook/Instagram later.
//  One setting for the whole studio, kept in the cache volume.
// ============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cache', 'studio-format.json');
const FORMATS = { story: ['story'], feed: ['story', 'square'] };

function get() {
  try { const f = JSON.parse(fs.readFileSync(FILE, 'utf8')).format; if (FORMATS[f]) return f; } catch { /* default */ }
  return 'story';
}

function set(format) {
  if (!FORMATS[format]) throw new Error('bad format');
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ format }));
  return format;
}

/** Sizes to render now, story first (it is posted first). */
const sizes = () => FORMATS[get()];

module.exports = { get, set, sizes, FORMATS };
