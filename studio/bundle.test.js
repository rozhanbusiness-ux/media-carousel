const test = require('node:test');
const assert = require('node:assert');
const { bundleCaption } = require('./bundle');

const offers = [
  { kind: 'flight', from: { code: 'DUS', name: 'Düsseldorf' }, to: { code: 'IST', name: 'Istanbul' }, departureDate: '2026-11-12', price: 184.99 },
  { kind: 'package', to: { code: '', name: 'Side' }, country: 'Türkei', hotel: 'Hotel Sunrise', price: 699 },
];

test('bundle caption lists every offer with its full price once', () => {
  const de = bundleCaption(offers, 'de');
  assert.match(de, /Istanbul/);
  assert.match(de, /Hotel Sunrise/);
  assert.match(de, /184,99/);
  assert.doesNotMatch(de, /€\S*\s*€/);
  assert.match(bundleCaption(offers, 'ar'), /تركيا/);
});
