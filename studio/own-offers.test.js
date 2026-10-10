const test = require('node:test');
const assert = require('node:assert');
const { fromInput, isOwnKey } = require('./own-offers');

const future = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

test('own flight offer is validated and shaped like a specials offer', () => {
  const o = fromInput({ kind: 'flight', fromName: 'Düsseldorf', fromCode: 'DUS', toName: 'Erbil', toCode: 'EBL', departureDate: future(20), returnDate: '', price: '249', validUntil: future(10) });
  assert.strictEqual(o.kind, 'flight');
  assert.ok(isOwnKey(o.key) && o.key.startsWith('mf-'));
  assert.strictEqual(o.to.code, 'EBL');
  assert.strictEqual(o.price, 249);
});

test('own package offer builds the German fact text', () => {
  const o = fromInput({ kind: 'package', hotel: 'Rixos', stars: 5, city: 'Belek', country: 'Türkei', nights: 7, board: 'all', withFlight: true, price: 899, validUntil: future(5) });
  assert.ok(o.key.startsWith('mp-'));
  assert.strictEqual(o.details, 'All Inclusive, inkl. Flug');
});

test('invalid or expired input is rejected', () => {
  assert.strictEqual(fromInput({ kind: 'flight', fromName: '<b>', toName: 'Erbil', departureDate: future(5), price: 1, validUntil: future(1) }), null);
  assert.strictEqual(fromInput({ kind: 'package', hotel: 'X Hotel', stars: 5, city: 'Side', country: 'Türkei', nights: 7, board: 'all', withFlight: true, price: 500, validUntil: '2020-01-01' }), null);
  assert.strictEqual(fromInput({ kind: 'package', hotel: 'X Hotel', stars: 9, city: 'Side', country: 'Türkei', nights: 7, board: 'all', withFlight: true, price: 500, validUntil: future(1) }), null);
  assert.strictEqual(fromInput({ kind: 'cruise', price: 1, validUntil: future(1) }), null);
});
