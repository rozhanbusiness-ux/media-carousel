const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { rankPhotos } = require('./photo-rank');

const cand = (id) => ({ id, url: `https://images.pexels.com/photos/${id}/o.jpeg`, thumb: `https://images.pexels.com/photos/${id}/m.jpeg` });

function fake(modelText) {
  return async (url) => {
    if (url.startsWith('https://images.pexels.com/')) return { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new Uint8Array([1]).buffer };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: modelText }] } }] }) };
  };
}

test('sorts by validated scores, clamps and ignores bad entries', async () => {
  config.GEMINI_API_KEY = 'test';
  const out = await rankPhotos([cand(1), cand(2), cand(3)], 'Istanbul',
    fake('{"scores":[{"i":0,"score":4},{"i":1,"score":15},{"i":2,"score":"x"},{"i":9,"score":10}]}'));
  assert.deepStrictEqual(out.map((c) => [c.id, c.score]), [[2, 10], [1, 4], [3, null]]);
});

test('keeps order with null scores when the model fails or no key', async () => {
  config.GEMINI_API_KEY = 'test';
  assert.deepStrictEqual((await rankPhotos([cand(1), cand(2)], 'X', fake('not json'))).map((c) => c.id), [1, 2]);
  config.GEMINI_API_KEY = '';
  assert.deepStrictEqual((await rankPhotos([cand(5)], 'X', fake('{}'))).map((c) => c.score), [null]);
});
