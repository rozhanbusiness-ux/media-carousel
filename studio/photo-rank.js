// ============================================================
//  studio/photo-rank.js — Gemini scores candidate photos 0-10
//  Only preview images and the criteria are sent. The model returns
//  numbers only; they are validated here before use.
// ============================================================

const config = require('../config');

const MODEL = 'gemini-2.5-flash';

// Kept for diagnosis only: with this schema Gemini 2.5 Flash wrote endless digits for "x" (seen 2026-10-18),
// so the ranking uses plain JSON mode plus parseScores() salvage instead.
const SCHEMA = {
  type: 'OBJECT',
  properties: { scores: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    i: { type: 'INTEGER' }, score: { type: 'INTEGER' }, x: { type: 'INTEGER' },
    shot: { type: 'STRING', enum: ['aerial', 'panorama', 'bay', 'waterfront', 'landmark', 'sunset', 'resort', 'street', 'other'] },
    sky: { type: 'STRING', enum: ['clear', 'cloudy', 'overcast'] }, why: { type: 'STRING', maxLength: 40 },
  }, required: ['i', 'score'] } } },
  required: ['scores'],
};

/** Scores from the answer; a cut-off answer still yields its complete entries (seen: runaway "why" texts). */
function parseScores(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean).scores; } catch { /* salvage below */ }
  const out = [];
  for (const m of clean.matchAll(/\{[^{}]*\}/g)) { try { const o = JSON.parse(m[0]); if (Number.isInteger(o.i)) out.push(o); } catch { /* skip */ } }
  return out.length ? out : null;
}

const OFFER_TYPE = { flight: 'flights', package: 'holiday packages', cruise: 'river cruises', home: 'holiday homes' };
const WINTER = new Set([10, 11, 0, 1, 2]); // Nov-Mar

function criteria(city, kind, month = new Date().getMonth()) {
  if (!kind) return coverCriteria(city); // type covers (airplane / resort), no destination
  // Client's four rules (2026-10-18, kept short on purpose: longer rule lists made the model too strict).
  return [
    `You select background photos for an Instagram ad for trips to ${city}. A great photo has:`,
    '1. High resolution: sharp and professional.',
    '2. A landmark in the centre.',
    '3. Clean, without clutter.',
    '4. Day or night, with high contrast.',
    `Score 0-10 for how well a photo meets these four points and shows ${city}. Score 0-3 if it shows any mosque or minaret.`,
    'Photos are numbered from 0 in the order given.',
    'For each photo return: "score" (0-10), "x" (horizontal centre of the main subject in percent of the width, 0 = left, 100 = right),',
    '"shot" (one of: aerial, panorama, bay, waterfront, landmark, sunset, resort, street, other), "sky" (clear, cloudy or overcast)',
    'and "why" (very short German reason, max 4 words, e.g. "Luftbild, Bucht, strahlend").',
    'Return ONLY JSON: {"scores":[{"i":0,"score":9,"x":50,"shot":"aerial","sky":"clear","why":"Luftbild, Bucht, strahlend"}, ...]} with one entry per photo.',
  ].join('\n');
}

function coverCriteria(subject) {
  return [
    `You are the photo editor of a luxury travel agency. Score each photo (0-10) as the cover background of an Instagram post about ${subject}.`,
    'High scores: bright, clear blue sky, elegant, luxurious, sharp, professional; calm area at the top (logo) and bottom (text).',
    'Low scores: dark, grey, cluttered, text or logos, close-up faces, any mosque or minaret.',
    'Photos are numbered from 0 in the order given. Also give "x" (horizontal centre of the main subject in percent).',
    'Give each photo a very short German reason (max 4 words).',
    'Return ONLY JSON: {"scores":[{"i":0,"score":7,"x":50,"why":"hell, elegant"}, ...]} with one entry per photo.',
  ].join('\n');
}

/** Thumbnail bytes (Pexels CDN only) → { mime, data } or null. */
async function fetchThumb(url, fetchImpl) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !['images.pexels.com', 'images.unsplash.com', 'upload.wikimedia.org'].includes(u.hostname)) return null;
    const headers = u.hostname === 'upload.wikimedia.org' ? { 'User-Agent': 'MediaTravelStudio/1.0 (https://media-travels.com)' } : {};
    const res = await fetchImpl(u.toString(), { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || '').split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length < 2 * 1024 * 1024 ? { mime, data: buf.toString('base64') } : null;
  } catch { return null; }
}

/**
 * Adds `score` (0-10, or null when scoring is unavailable) to each candidate
 * ({ id, thumb, ... }) and returns them sorted best first.
 */
async function rankPhotos(candidates, city, fetchImpl = fetch, kind = null) {
  const list = candidates.map((c) => ({ ...c, score: null, why: '' }));
  if (!config.GEMINI_API_KEY || !list.length) return list;
  const thumbs = await Promise.all(list.map((c) => fetchThumb(c.preview || c.thumb, fetchImpl))); // larger preview: composition is judged better
  const usable = list.map((c, i) => ({ c, t: thumbs[i] })).filter((x) => x.t);
  if (!usable.length) { console.error('studio photo rank: no thumbnails loaded'); return list; }
  const parts = [{ text: criteria(city, kind) }];
  usable.forEach((x, i) => parts.push({ text: `Photo ${i}:` }, { inline_data: { mime_type: x.t.mime, data: x.t.data } }));
  // Plain JSON mode (a response schema caused runaway digits); cut-off answers are salvaged; one retry.
  let scores = null;
  for (let attempt = 1; attempt <= 2 && !scores; attempt++) {
    try {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(90000),
      });
      require('./ai-status').report(res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const parsed = parseScores(text);
      if (!Array.isArray(parsed)) {
        // Diagnosis: what Gemini actually answered (no key or image data in it).
        const c = json?.candidates?.[0] || {};
        const t = String(text).replace(/\s+/g, ' ');
        throw new Error(`no scores (finish: ${c.finishReason || '-'}, block: ${json?.promptFeedback?.blockReason || '-'}, ${t.length} chars) start: ${t.slice(0, 400)} … end: ${t.slice(-200)}`);
      }
      scores = parsed;
    } catch (err) { console.error(`studio photo rank (attempt ${attempt}):`, err.message); }
  }
  if (!scores) return list; // unscored: callers never use unscored photos automatically
  {
    for (const s of scores) {
      if (Number.isInteger(s?.i) && s.i >= 0 && s.i < usable.length && Number.isFinite(s.score)) {
        usable[s.i].c.score = Math.max(0, Math.min(10, Math.round(s.score)));
        const SHOTS = ['aerial', 'panorama', 'bay', 'waterfront', 'landmark', 'sunset', 'resort', 'street', 'other'];
        if (SHOTS.includes(s.shot)) usable[s.i].c.shot = s.shot;
        if (Number.isFinite(s.x)) usable[s.i].c.x = Math.max(0, Math.min(100, Math.round(s.x)));
        if (typeof s.why === 'string') usable[s.i].c.why = s.why.replace(/[<>{}]/g, '').trim().slice(0, 40);
      }
    }
  }
  return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

module.exports = { rankPhotos, criteria, parseScores, SCHEMA };
