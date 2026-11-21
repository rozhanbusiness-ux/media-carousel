// ============================================================
//  studio/places.js — real places of a city for a photo subject,
//  found by Gemini with Google Search (client 2026-11-21: no
//  hand-written lists; the model searches the web itself).
//  Lists are cached per city and subject; a place already used in the
//  library is skipped, so every new photo shows a DIFFERENT place.
// ============================================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { endpoint } = require('./gemini-text');

const FILE = path.join(__dirname, '..', 'cache', 'studio-places.json');
const KINDS = {
  landmark: 'famous landmarks, monuments and historic buildings',
  water: 'harbours, marinas, rivers, canals, lakes and waterfalls',
  castle: 'castles, palaces, fortresses and citadels (also in the surrounding region)',
  nature: 'parks, forests, gardens, valleys and lakes in nature (also in the surrounding region)',
  bridge: 'bridges',
  heights: 'hills, mountains and viewpoints with a view',
  promenade: 'beaches, riverside promenades, corniches, lakeside walks and lively squares',
  museum: 'museums, opera houses, concert halls and icons of modern architecture',
};

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch { return {}; } };
const write = (d) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();

/** Ask Gemini (grounded with Google Search) for up to 10 real places with a shot brief; [{ name, view }]. */
async function search(city, country, subject, fetchImpl = fetch) {
  // Art-director brief (client 2026-11-21: precision, creativity, uniqueness). Gemini acts as the
  // photo editor of a premium travel magazine and scouts each place like a location scout.
  const prompt = [
    `You are the photo editor of a premium travel magazine, scouting locations for a story on ${city}${country ? ', ' + country : ''}. Search the web.`,
    `Find up to 10 REAL ${KINDS[subject]} in or near ${city} (inside it or in its region, at most about 80 km away).`,
    'Mix: about half are the famous icons, half are photogenic places that locals and photographers love but tourists rarely know. Each must really exist; check it.',
    'For each place write a SHOT BRIEF a photographer could follow on site:',
    '"spot": the exact place to stand (e.g. "from the steps of the riverside below the east pillar");',
    '"layers": what is in the foreground, middle and background, using real elements that are there;',
    '"detail": one unique, characteristic detail only this place has (a material, a shape, a colour, a texture, a ritual of daily life);',
    '"avoid": the cliché postcard shot of this place that we must NOT repeat.',
    'Do NOT mention the time of day, light or weather (we choose them). Never include mosques or minarets. No duplicates.',
    'Answer ONLY with a JSON array: [{"name": "<official name>", "spot": "...", "layers": "...", "detail": "...", "avoid": "..."}].',
  ].join(' ');
  const call = async (tools) => {
    const res = await fetchImpl(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(tools ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: 4096 } }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Gemini places error ${res.status}`);
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const m = text.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : [];
  };
  let list;
  try { list = await call(true); } catch (err) { console.error('studio places (search):', err.message); list = await call(false); }
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((p) => p && typeof p.name === 'string' && p.name.trim() && !/mosque|minaret|moschee|masjid|jami/i.test([p.name, p.view, p.spot, p.layers, p.detail].join(' ')))
    .map((p) => {
      const f = (k, label) => (p[k] ? `${label}: ${String(p[k]).trim().slice(0, 240)}` : '');
      const view = p.spot || p.layers ? [f('spot', 'Camera position'), f('layers', 'Layers'), f('detail', 'Signature detail'), f('avoid', 'Avoid the cliché')].filter(Boolean).join('. ') : String(p.view || '').trim().slice(0, 300);
      return { name: p.name.trim().slice(0, 120), view };
    })
    .filter((p) => !seen.has(norm(p.name)) && seen.add(norm(p.name)));
}

/** A place of this subject not in `exclude` (names). Searches once, then uses the cached list;
 *  searches again when every cached place is used. Returns { name, view } or null. */
async function pick(key, city, country, subject, exclude = [], fetchImpl = fetch) {
  if (!KINDS[subject]) return null;
  const used = new Set(exclude.map(norm));
  const id = `${key}|${subject}`;
  const db = read();
  let free = (db[id] || []).filter((p) => !used.has(norm(p.name)));
  if (!free.length) {
    const found = await search(city, country, subject, fetchImpl);
    db[id] = [...(db[id] || []), ...found.filter((p) => !(db[id] || []).some((q) => norm(q.name) === norm(p.name)))];
    write(db);
    free = db[id].filter((p) => !used.has(norm(p.name)));
  }
  if (!free.length) return null;
  return free[Math.floor(Math.random() * Math.min(free.length, 4))];
}

module.exports = { pick, search, KINDS };
