const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const places = require('./places');

const answer = (list) => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Here:\n' + JSON.stringify(list) }] } }] }) });

test('places: mosques are dropped, duplicates removed', async () => {
  const list = await places.search('Düsseldorf', 'Germany', 'bridge', answer([
    { name: 'Oberkasseler Brücke', view: 'a' }, { name: 'Oberkasseler  Brücke', view: 'b' }, { name: 'Some Mosque', view: 'c' }, { name: 'Fleher Brücke', view: 'd' }]));
  assert.deepStrictEqual(list.map((p) => p.name), ['Oberkasseler Brücke', 'Fleher Brücke']);
});

test('places: a place already in the library is never picked again', async () => {
  const file = path.join(__dirname, '..', 'cache', 'studio-places.json');
  const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
  try {
    const f = answer([{ name: 'A Bridge', view: '' }, { name: 'B Bridge', view: '' }]);
    for (let i = 0; i < 20; i++) assert.strictEqual((await places.pick('TEST', 'X', '', 'bridge', ['A Bridge'], f)).name, 'B Bridge');
  } finally { if (before) fs.writeFileSync(file, before); else fs.rmSync(file, { force: true }); }
});
