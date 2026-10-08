const test = require('node:test');
const assert = require('node:assert');
const { toDraftOffer, factLine, starText, offerKey } = require('./packages');

const raw = { location: ['Türkei', 'Türkische Riviera', 'Side'], hotel: 'Hotel <b>Sun</b>', stars: 5, details: '7 Nächte, All Inclusive, Doppelzimmer, inkl. Flug', nights: 7, price: 699, giataId: '123', cityId: '1', regionId: '2' };

test('maps a specials package offer to the draft shape', () => {
  const o = toDraftOffer(raw);
  assert.strictEqual(o.kind, 'package');
  assert.deepStrictEqual(o.to, { code: '', name: 'Side' });
  assert.strictEqual(o.region, 'Türkische Riviera');
  assert.strictEqual(o.hotel, 'Hotel bSun/b');
  assert.strictEqual(offerKey(o), 'p-123');
});

test('builds localized fact lines and stars', () => {
  const o = toDraftOffer(raw);
  assert.strictEqual(factLine(o, 'de'), '7 Nächte · All Inclusive · inkl. Flug');
  assert.strictEqual(factLine(o, 'ar'), '7 ليالٍ · إقامة شاملة · شامل الطيران');
  assert.strictEqual(starText(5), '★★★★★');
  assert.strictEqual(factLine({ nights: null, details: 'Doppelzimmer' }, 'de'), '');
});
