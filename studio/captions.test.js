const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { buildCaption, isSafeText } = require('./captions');

const flight = { kind: 'flight', from: { name: 'Düsseldorf', code: 'DUS' }, to: { name: 'Istanbul', code: 'IST' },
  departureDate: '2026-10-23', returnDate: '2026-11-07', price: 184.77 };

const fakeFetch = (answer) => async () => ({
  ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }),
});

test('uses the model words but code-written facts', async () => {
  config.GEMINI_API_KEY = 'test';
  const c = await buildCaption(flight, 'de', fakeFetch({ hook: 'Zwei Kontinente, ein Wochenende.', body: 'Basare, Bosporus und Baklava.', hashtags: ['#Istanbul', '#Reisen'] }));
  assert.equal(c.aiWritten, true);
  assert.match(c.text, /ab 184,77 € p\. P\./);
  assert.match(c.text, /23\.10\.2026–07\.11\.2026/);
  assert.match(c.text, /Preise freibleibend/);
  assert.deepEqual(c.hashtags, ['#Istanbul', '#Reisen', '#MediaTravel']);
});

test('rejects model text with prices, links or free promises and falls back', async () => {
  config.GEMINI_API_KEY = 'test';
  for (const hook of ['Nur 99 € heute!', 'Kostenlos fliegen', 'Siehe www.x.de', 'سفر مجاني']) {
    const c = await buildCaption(flight, 'de', fakeFetch({ hook, body: 'ok', hashtags: [] }));
    assert.equal(c.aiWritten, false, hook);
  }
});

test('works without an API key (safe fixed caption) in ar and ckb', async () => {
  config.GEMINI_API_KEY = '';
  const ar = await buildCaption(flight, 'ar');
  assert.equal(ar.aiWritten, false);
  assert.match(ar.text, /ابتداءً من 184,77 €/);
  assert.match(ar.text, /الأسعار غير ملزمة/);
  const ckb = await buildCaption(flight, 'ckb');
  assert.match(ckb.text, /بۆ هەر کەسەکی/);
});

test('hashtag filter drops numbers and markup', () => {
  assert.equal(isSafeText('<b>x</b>', 50), false);
});
