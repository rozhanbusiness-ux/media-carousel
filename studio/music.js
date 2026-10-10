// ============================================================
//  studio/music.js — the client's own Reel music (MP3 uploads)
//  The client picks commercially licensed tracks (e.g. Pixabay Music)
//  and uploads them in the studio. Files live in cache/studio-music/
//  (server volume, never in git). File names are generated here.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'cache', 'studio-music');
const ID = /^[a-f0-9]{16}$/;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TRACKS = 30;
const KINDS = ['flight', 'package', 'all']; // which posts a track suits
const MOODS = ['calm', 'lively'];
const HISTORY = path.join(DIR, 'history.json'); // last used track ids, newest first

/** MP3 check: ID3 tag or an MPEG audio frame sync at the start. */
function isMp3(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 1024 || buf.length > MAX_BYTES) return false;
  if (buf.toString('latin1', 0, 3) === 'ID3') return true;
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
}

const cleanName = (s) => String(s || '').replace(/[^\p{L}\p{N} ._()-]/gu, '').trim().slice(0, 60) || 'Track';

function list() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => /^[a-f0-9]{16}\.json$/.test(f)).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; }
  }).filter((t) => t && ID.test(t.id) && fs.existsSync(file(t.id))).sort((a, b) => b.added.localeCompare(a.added));
}

function add(buf, name, kind = 'all', mood = 'calm') {
  if (!KINDS.includes(kind) || !MOODS.includes(mood)) throw new Error('bad tags');
  if (!isMp3(buf)) throw new Error('not an mp3');
  if (list().length >= MAX_TRACKS) throw new Error('too many tracks');
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(file(id), buf);
  const track = { id, name: cleanName(name), kind, mood, size: buf.length, added: new Date().toISOString() };
  fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify(track));
  return track;
}

function remove(id) {
  if (!ID.test(id)) return false;
  let found = false;
  for (const f of [file(id), path.join(DIR, id + '.json')]) if (fs.existsSync(f)) { fs.unlinkSync(f); found = true; }
  return found;
}

const file = (id) => path.join(DIR, id + '.mp3');

/** Change the tags of a track. */
function tag(id, kind, mood) {
  if (!ID.test(id) || !KINDS.includes(kind) || !MOODS.includes(mood)) return false;
  const meta = path.join(DIR, id + '.json');
  try {
    const t = JSON.parse(fs.readFileSync(meta, 'utf8'));
    fs.writeFileSync(meta, JSON.stringify({ ...t, kind, mood }));
    return true;
  } catch { return false; }
}

function history() {
  try { const h = JSON.parse(fs.readFileSync(HISTORY, 'utf8')); return Array.isArray(h) ? h.filter((x) => ID.test(x)) : []; } catch { return []; }
}
/** Remember that a track was used in a Reel (rule: not again within the next 3 Reels). */
function used(id) {
  if (!ID.test(id) || !fs.existsSync(file(id))) return false;
  fs.writeFileSync(HISTORY, JSON.stringify([id, ...history().filter((x) => x !== id)].slice(0, 10)));
  return true;
}

module.exports = { KINDS, MOODS, tag, history, used, ID, MAX_BYTES, isMp3, cleanName, list, add, remove, file };
