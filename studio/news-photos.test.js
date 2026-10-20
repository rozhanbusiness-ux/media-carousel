const test = require('node:test');
const assert = require('node:assert');
const { queries } = require('./news-photos');

test('photo search words: the place and the place with its experience', () => {
  const q = queries({ place: 'Lauterbrunnen', photoQuery: 'Lauterbrunnen', angle: 'Hiking behind a waterfall in Lauterbrunnen' });
  assert.deepStrictEqual(q, ['Lauterbrunnen', 'Hiking behind a waterfall in Lauterbrunnen']);
});

test('photo search words have no special characters', () => {
  const q = queries({ place: 'Bled <script>', angle: 'Ringing the "wishing bell"' });
  assert.ok(q.every((x) => !/[<>"]/.test(x)));
});

test('story ranking uses its own criteria (exactly this place and experience)', () => {
  const { criteria } = require('./photo-rank');
  const c = criteria('Bled – ringing the wishing bell', 'story');
  assert.match(c, /exactly this place/);
  assert.match(c, /mosque or minaret/);
});
