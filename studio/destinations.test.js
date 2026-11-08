const test = require('node:test');
const assert = require('node:assert');
const { photoSubject, find } = require('./destinations');

test('a repeated destination shows the departure city (client 2026-11-04)', () => {
  const s = photoSubject({ kind: 'flight', fromDeparture: true, from: { code: 'DUS', name: 'Düsseldorf' }, to: { code: 'EBL', name: 'Erbil' } });
  assert.strictEqual(s.to.name, 'Düsseldorf');
  assert.strictEqual(s.country, 'Germany');
  assert.ok(find(s).ai.length > 0);
});

test('other flights keep the destination', () => {
  const o = { kind: 'flight', from: { code: 'BER', name: 'Berlin' }, to: { code: 'BCN', name: 'Barcelona' } };
  assert.strictEqual(photoSubject(o), o);
});

test('flights home without a departure city keep the destination', () => {
  const o = { kind: 'flight', to: { code: 'EBL', name: 'Erbil' } };
  assert.strictEqual(photoSubject(o), o);
});

test('a destination that appears once keeps its own photo (client 2026-11-08)', () => {
  const o = { kind: 'flight', from: { code: 'MUC', name: 'München' }, to: { code: 'ISU', name: 'Sulaymaniyah' } };
  assert.strictEqual(photoSubject(o), o);
});
