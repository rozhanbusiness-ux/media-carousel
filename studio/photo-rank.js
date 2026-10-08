// ============================================================
//  studio/photo-rank.js — Gemini scores candidate photos 0-10
//  Only small thumbnails and the criteria are sent. The model returns
//  numbers only; they are validated here before use.
// ============================================================

const config = require('../config');

const MODEL = 'gemini-2.5-flash';

function criteria(city) {
  return [
    `You are the photo editor of a luxury travel agency. Score each photo (0-10) as the background of an Instagram ad for a trip to ${city}.`,
    'High scores: bright, sunny, airy, light colours; clearly recognisable, attractive view or landmark of THIS destination; clean, elegant, luxurious travel feeling;',
    'calm area at the top (for a logo) and at the bottom (for text); sharp, professional, natural photo.',
    'Score 0 if the photo shows a mosque, minaret, church, cathedral, temple, dome of a religious building or any religious symbol, even small or in the distance.',
    'Low scores: dark, grey or gloomy; night; close-up faces; crowds; text, signs or logos; food or interiors; generic places that could be anywhere; blurry.',
    'Photos are numbered from 0 in the order given.',
    'Return ONLY JSON: {"scores":[{"i":0,"score":7}, ...]} with one entry per photo.',
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
async function rankPhotos(candidates, city, fetchImpl = fetch) {
  const list = candidates.map((c) => ({ ...c, score: null }));
  if (!config.GEMINI_API_KEY || !list.length) return list;
  const thumbs = await Promise.all(list.map((c) => fetchThumb(c.thumb, fetchImpl)));
  const usable = list.map((c, i) => ({ c, t: thumbs[i] })).filter((x) => x.t);
  if (!usable.length) return list;
  const parts = [{ text: criteria(city) }];
  usable.forEach((x, i) => parts.push({ text: `Photo ${i}:` }, { inline_data: { mime_type: x.t.mime, data: x.t.data } }));
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 } }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return list;
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const scores = JSON.parse(text.replace(/```json|```/g, '').trim()).scores;
    if (!Array.isArray(scores)) return list;
    for (const s of scores) {
      if (Number.isInteger(s?.i) && s.i >= 0 && s.i < usable.length && Number.isFinite(s.score)) {
        usable[s.i].c.score = Math.max(0, Math.min(10, Math.round(s.score)));
      }
    }
  } catch (err) { console.error('studio photo rank:', err.message); return list; }
  return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

module.exports = { rankPhotos };
