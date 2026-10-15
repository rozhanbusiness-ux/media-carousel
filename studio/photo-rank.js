// ============================================================
//  studio/photo-rank.js — Gemini scores candidate photos 0-10
//  Only preview images and the criteria are sent. The model returns
//  numbers only; they are validated here before use.
// ============================================================

const config = require('../config');

const MODEL = 'gemini-2.5-flash';

const SCHEMA = {
  type: 'OBJECT',
  properties: { scores: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    i: { type: 'INTEGER' }, score: { type: 'INTEGER' }, x: { type: 'INTEGER' },
    shot: { type: 'STRING', enum: ['aerial', 'panorama', 'bay', 'waterfront', 'landmark', 'sunset', 'resort', 'street', 'other'] },
    sky: { type: 'STRING', enum: ['clear', 'cloudy', 'overcast'] }, why: { type: 'STRING' },
  }, required: ['i', 'score'] } } },
  required: ['scores'],
};

const OFFER_TYPE = { flight: 'flights', package: 'holiday packages', cruise: 'river cruises', home: 'holiday homes' };
const WINTER = new Set([10, 11, 0, 1, 2]); // Nov-Mar

function criteria(city, kind, month = new Date().getMonth()) {
  if (!kind) return coverCriteria(city); // type covers (airplane / resort), no destination
  const match = kind === 'flight'
    ? '- Flight offer: the city\'s or coast\'s most iconic, recognisable view.'
    : '- Holiday offer: sea, beach, resort coastline, pools, relaxation.';
  return [
    `You are the senior photo editor of a luxury travel magazine choosing images for a premium Instagram campaign selling ${OFFER_TYPE[kind] || 'trips'} to ${city}.`,
    'MUST HAVE (otherwise score 4 or less):',
    '- Clear, deep-blue sky (or a warm, clean golden-hour sky). No overcast, grey, white, hazy or stormy sky.',
    `- Unmistakably ${city}: its signature coastline, skyline or landmark.`,
    '- Bright, sunny, inviting; crisp and in focus.',
    'WHAT MAKES 9-10 (a cover image):',
    '- Aerial / drone or elevated panoramic viewpoint with depth and a sense of space.',
    '- Vivid but natural colours: turquoise water, white sand, lush green, warm stone.',
    '- Strong composition: clear subject, leading lines, clean horizon.',
    '- Calm areas top and bottom (logo / price card) and the subject fitting a vertical 9:16 crop.',
    '- Feels like a dream holiday you want to book NOW: luxury, freedom, escape.',
    ...(WINTER.has(month) ? ['- It is winter in Germany: warm, sunny, summery scenes score higher.'] : []),
    'MATCH THE OFFER:',
    match,
    'ALWAYS LOW (3 or less):',
    '- Any religious building or symbol, including famous ones (Sagrada Familia, Hagia Sophia, Notre-Dame, Blue Mosque, Sheikh Zayed Mosque, St. Peter\'s, Cologne Cathedral ...), even partly visible.',
    '- Night, dark, rain, fog; crowds; traffic; construction; litter.',
    '- Close-up people, selfies; text, signs, logos, watermarks.',
    '- Generic places that could be anywhere; interiors; food.',
    '- Heavy filters, HDR, oversaturated or fake-looking images.',
    'Photos are numbered from 0 in the order given.',
    'For each photo return: "score" (0-10), "x" (horizontal centre of the main subject in percent of the width, 0 = left, 100 = right),',
    '"shot" (one of: aerial, panorama, bay, waterfront, landmark, sunset, resort, street, other), "sky" (clear, cloudy or overcast)',
    'and "why" (very short German reason, max 4 words, e.g. "Drohne, Bucht, strahlend").',
    'Return ONLY JSON: {"scores":[{"i":0,"score":9,"x":50,"shot":"aerial","sky":"clear","why":"Drohne, Bucht, strahlend"}, ...]} with one entry per photo.',
  ].join('\n');
}

function coverCriteria(subject) {
  return [
    `You are the photo editor of a luxury travel agency. Score each photo (0-10) as the cover background of an Instagram post about ${subject}.`,
    'High scores: bright, clear blue sky, elegant, luxurious, sharp, professional; calm area at the top (logo) and bottom (text).',
    'Low scores: dark, grey, cluttered, text or logos, close-up faces, any religious building or symbol.',
    'Photos are numbered from 0 in the order given. Also give "x" (horizontal centre of the main subject in percent).',
    'Give each photo a very short German reason (max 4 words).',
    'Return ONLY JSON: {"scores":[{"i":0,"score":7,"x":50,"why":"hell, elegant"}, ...]} with one entry per photo.',
  ].join('\n');
}

/** Thumbnail bytes (Pexels CDN only) → { mime, data } or null. */
async function fetchThumb(url, fetchImpl) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'images.pexels.com') return null;
    const res = await fetchImpl(u.toString(), { signal: AbortSignal.timeout(15000) });
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
  // The answer is forced into a JSON schema (free JSON was sometimes invalid); one retry on failure.
  let scores = null;
  for (let attempt = 1; attempt <= 2 && !scores; attempt++) {
    try {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()).scores;
      if (!Array.isArray(parsed)) throw new Error('no scores');
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
        if (['cloudy', 'overcast'].includes(s.sky)) usable[s.i].c.score = Math.min(usable[s.i].c.score, 4); // clear sky is a must (client)
        if (Number.isFinite(s.x)) usable[s.i].c.x = Math.max(0, Math.min(100, Math.round(s.x)));
        if (typeof s.why === 'string') usable[s.i].c.why = s.why.replace(/[<>{}]/g, '').trim().slice(0, 40);
      }
    }
  }
  return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

module.exports = { rankPhotos, criteria };
