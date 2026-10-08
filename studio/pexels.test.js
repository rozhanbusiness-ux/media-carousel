const test = require('node:test');
const assert = require('node:assert');
const { findPhoto, download } = require('./pexels');

const photo = (id, alt, w = 3000, h = 4500) => ({ id, alt, width: w, height: h, url: `https://www.pexels.com/photo/${id}/`, src: { original: `https://images.pexels.com/photos/${id}/x.jpeg` } });

function fakeFetch(photos) {
  return async (url) => {
    if (url.startsWith('https://api.pexels.com/')) return { ok: true, json: async () => ({ photos }) };
    return { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
}

test('findPhoto skips religious, landscape, small and used photos', async () => {
  process.env.PEXELS_API_KEY = 'test';
  const list = [photo(1, 'Blue Mosque at sunset'), photo(2, 'Old town street', 4000, 3000), photo(3, 'Harbour', 800, 1200), photo(4, 'Beach promenade'), photo(5, 'Sea view')];
  const p = await findPhoto(['Palma'], new Set([4]), fakeFetch(list));
  assert.strictEqual(p.id, 5);
  assert.match(p.dataUri, /^data:image\/jpeg;base64,/);
});

test('findPhoto returns null without key or results', async () => {
  process.env.PEXELS_API_KEY = 'test';
  assert.strictEqual(await findPhoto(['X'], new Set(), fakeFetch([photo(1, 'cathedral')])), null);
  delete process.env.PEXELS_API_KEY;
  assert.strictEqual(await findPhoto(['X'], new Set(), fakeFetch([photo(9, 'sea')])), null);
});

test('download only accepts the Pexels image CDN', async () => {
  await assert.rejects(download('https://evil.example.com/a.jpg', fakeFetch([])), /host/);
});
