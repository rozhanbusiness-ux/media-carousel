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

// Regression (2026-10-30): a trailing comment swallowed `bundle: true, bundleKind` in the draft
// literal, so new bundles were treated as single posts.
test('bundle draft literal keeps bundle and bundleKind outside comments', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'bundle.js'), 'utf8');
  const line = src.split('\n').find((l) => l.includes('bundleKind: kind'));
  assert.ok(line, 'draft literal not found');
  const code = line.split('//')[0];
  assert.ok(code.includes('bundle: true') && code.includes('bundleKind: kind'));
});
