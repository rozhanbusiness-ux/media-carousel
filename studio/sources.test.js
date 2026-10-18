const test = require('node:test');
const assert = require('node:assert');
const wikimedia = require('./wikimedia');
const unsplash = require('./unsplash');

const json = (body) => async () => ({ ok: true, json: async () => body });

test('wikimedia keeps only CC0 / public domain / CC BY (never BY-SA) and credits the author', async () => {
  const page = (pageid, lic, title = 'File:Erbil.jpg') => ({ pageid, title, imageinfo: [{ mime: 'image/jpeg', width: 4000, height: 3000,
    url: 'https://upload.wikimedia.org/a.jpg', thumburl: `https://upload.wikimedia.org/thumb/a.jpg/2200px-a${pageid}.jpg`, descriptionurl: 'https://commons.wikimedia.org/wiki/File:x',
    extmetadata: { LicenseShortName: { value: lic }, Artist: { value: '<a href="x">Jane Doe</a>' } } }] });
  const body = { query: { pages: { 1: page(1, 'CC BY 4.0'), 2: page(2, 'CC BY-SA 4.0'), 3: page(3, 'Public domain'), 4: page(4, 'CC0'), 5: page(5, 'CC BY 4.0', 'File:Erbil mosque.jpg') } } };
  const list = await wikimedia.search('Erbil', json(body));
  assert.deepStrictEqual(list.map((p) => p.id).sort(), ['wm:1', 'wm:3', 'wm:4']);
  assert.strictEqual(list.find((p) => p.id === 'wm:1').credit.author, 'Jane Doe');
  assert.match(list[0].preview, /\/1024px-/);
  await assert.rejects(wikimedia.download('https://evil.example/a.jpg'), /host/);
});

test('unsplash maps credit and download tracking, filters small photos', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'k';
  const r = (id, w) => ({ id, width: w, height: 3000, alt_description: 'beach', urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=1`, regular: `https://images.unsplash.com/photo-${id}?w=1080`, small: `https://images.unsplash.com/photo-${id}?w=400` },
    user: { name: 'Max Muster', links: { html: 'https://unsplash.com/@max' } }, links: { download_location: 'https://api.unsplash.com/photos/x/download' } });
  const list = await unsplash.search('Dubai', json({ results: [r('abcd1', 4000), r('abcd2', 1000)] }));
  assert.deepStrictEqual(list.map((p) => p.id), ['us:abcd1']);
  assert.strictEqual(list[0].credit.author, 'Max Muster');
  assert.match(list[0].url, /w=2200/);
  delete process.env.UNSPLASH_ACCESS_KEY;
});
