const test = require('node:test');
const assert = require('node:assert');
const { splitBody, slideValues, slideHtml } = require('./magazin');

const PHOTO = 'data:image/jpeg;base64,AAAA';
const idea = { kind: 'place', type: 'mountain', place: 'Val di Funes', sources: [{ title: 'Wikivoyage: South Tyrol (CC BY-SA 4.0)' }],
  photo: { credit: { author: 'A. B.', source: 'Wikimedia Commons', license: 'CC BY-SA 4.0' }, x: 40 },
  texts: { de: { hook: 'Dolomiten <so> nah', body: 'Du stehst im Tal. Die Luft ist still. Diese Ruhe muss man spüren. ⛰️' },
    ar: { hook: 'الدولوميت', body: 'تقف في الوادي. الهواء ساكن. هذا الهدوء يجب أن تشعر به. ⛰️' } } };

test('the last sentence (with its emoji) closes the post on slide 3', () => {
  assert.deepStrictEqual(splitBody('A eins. B zwei. C drei. ⛰️'), { middle: 'A eins. B zwei.', last: 'C drei. ⛰️' });
  assert.deepStrictEqual(splitBody('Nur ein Satz.'), { middle: 'Nur ein Satz.', last: '' });
});

test('values: kicker per type and language, Arabic right-to-left, source and photo credit', () => {
  const de = slideValues(idea, 'de', PHOTO);
  assert.strictEqual(de.kicker, 'Berge');
  assert.strictEqual(de.dir, 'ltr');
  assert.strictEqual(de.pos, '40% 50%');
  assert.match(de.credit, /Wikivoyage: South Tyrol.*Foto: A\. B\. \/ Wikimedia Commons \(CC BY-SA 4\.0\)/);
  const ar = slideValues(idea, 'ar', PHOTO);
  assert.strictEqual(ar.dir, 'rtl');
  assert.strictEqual(ar.kicker, 'جبال');
});

test('texts are escaped in the slide HTML; no slide without a photo', () => {
  const html = slideHtml(1, slideValues(idea, 'de', PHOTO));
  assert.match(html, /Dolomiten &lt;so&gt; nah/);
  assert.throws(() => slideValues(idea, 'de', 'javascript:x'), /no photo/);
});
