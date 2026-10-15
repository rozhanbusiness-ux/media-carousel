const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const registry = require('./photo-registry');
const pixabay = require('./pixabay');

test('a photo is never reused for another destination, and not for the same one within 60 days', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'r.txt');
  registry.record(123, 'IST', null, file);
  registry.record('pb:7', 'AYT', null, file);
  assert.ok(registry.blocked('DXB', Date.now(), file).has(123));
  assert.ok(registry.blocked('dxb', Date.now(), file).has('pb:7'));
  assert.ok(registry.blocked('IST', Date.now(), file).has(123)); // same destination, too soon
  assert.ok(!registry.blocked('IST', Date.now() + 61 * 864e5, file).has(123)); // same destination after 60 days
  assert.ok(registry.blocked('DXB', Date.now() + 400 * 864e5, file).has(123)); // other destination: never
});

test('pixabay: filters religious tags and foreign hosts', async () => {
  process.env.PIXABAY_API_KEY = 'k';
  const hits = [
    { id: 1, largeImageURL: 'https://pixabay.com/get/a.jpg', webformatURL: 'https://pixabay.com/get/a_640.jpg', imageWidth: 800, imageHeight: 1200, tags: 'beach, sea' },
    { id: 2, largeImageURL: 'https://pixabay.com/get/b.jpg', webformatURL: 'https://pixabay.com/get/b_640.jpg', imageWidth: 800, imageHeight: 1200, tags: 'mosque, city' },
    { id: 3, largeImageURL: 'https://evil.example/c.jpg', webformatURL: 'https://evil.example/c.jpg', imageWidth: 800, imageHeight: 1200, tags: 'beach' },
  ];
  const fake = async () => ({ ok: true, json: async () => ({ hits }) });
  const list = await pixabay.candidates(['x'], new Set(), 10, fake);
  assert.deepStrictEqual(list.map((p) => p.id), ['pb:1']);
  await assert.rejects(pixabay.download('https://evil.example/c.jpg'), /unexpected photo host/);
  delete process.env.PIXABAY_API_KEY;
});
