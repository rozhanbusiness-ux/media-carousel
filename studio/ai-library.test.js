const test = require('node:test');
const assert = require('node:assert');
const lib = require('./ai-library');

test('library keys: airport code first, unsafe names cleaned', () => {
  assert.strictEqual(lib.keyOf({ code: 'DUS', name: 'Düsseldorf' }), 'DUS');
  assert.strictEqual(lib.keyOf({ name: 'Köln/Bonn' }), 'KOLN-BONN');
  assert.strictEqual(lib.keyOf({ name: '../../etc' }), 'ETC');
  assert.strictEqual(lib.keyOf({}), '');
});

test('library file names are validated (no path traversal)', () => {
  assert.strictEqual(lib.fileOf('../x.jpg'), null);
  assert.strictEqual(lib.fileOf('DUS-1234abcd.jpg') !== null, true);
  assert.strictEqual(lib.fileOf('DUS-1234abcd.svg'), null);
});
