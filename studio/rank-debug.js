// ============================================================
//  studio/rank-debug.js — diagnosis only: ranks a few Pexels photos of one
//  place and prints Gemini's raw answer. Changes nothing, prints no key.
//    node studio/rank-debug.js Istanbul
// ============================================================

require('dotenv').config();
const config = require('../config');
const pexels = require('./pexels');
const { criteria } = require('./photo-rank');

(async () => {
  const place = (process.argv[2] || 'Istanbul').slice(0, 40);
  console.log('Gemini key set:', !!config.GEMINI_API_KEY);
  const photos = (await pexels.search(`${place} aerial view`)).slice(0, 3);
  console.log('photos:', photos.length);
  const parts = [{ text: criteria(place, 'flight') }];
  for (const [i, p] of photos.entries()) {
    const res = await fetch(p.preview);
    parts.push({ text: `Photo ${i}:` }, { inline_data: { mime_type: 'image/jpeg', data: Buffer.from(await res.arrayBuffer()).toString('base64') } });
  }
  for (const withSchema of [true, false]) {
    const { SCHEMA } = require('./photo-rank');
    const gen = { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 }, ...(withSchema && SCHEMA ? { responseSchema: SCHEMA } : {}) };
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: gen }),
    });
    const json = await res.json();
    const c = (json.candidates || [])[0] || {};
    const text = ((c.content || {}).parts || []).map((x) => x.text || '').join('');
    console.log(`\n=== schema: ${withSchema && !!SCHEMA} | HTTP ${res.status} | finish: ${c.finishReason} | ${text.length} chars`);
    console.log(text.slice(0, 1500));
    if (json.error) console.log('error:', json.error.message);
  }
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
