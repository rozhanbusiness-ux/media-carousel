const test = require('node:test');
const assert = require('node:assert');
const { isMp3, cleanName } = require('./music');

test('isMp3 accepts ID3 and frame-sync MP3 and rejects other files', () => {
  const id3 = Buffer.alloc(2048); id3.write('ID3', 0, 'latin1');
  const sync = Buffer.alloc(2048); sync[0] = 0xff; sync[1] = 0xfb;
  assert.ok(isMp3(id3));
  assert.ok(isMp3(sync));
  assert.ok(!isMp3(Buffer.from('<html>' + 'x'.repeat(2048))));
  assert.ok(!isMp3(Buffer.alloc(10)));
  assert.ok(!isMp3(Buffer.alloc(11 * 1024 * 1024, 0xff)));
});

test('cleanName strips markup and path characters', () => {
  assert.strictEqual(cleanName('<b>Sun/set</b> ../x'), 'bSunsetb ..x');
  assert.strictEqual(cleanName(''), 'Track');
  assert.strictEqual(cleanName('a'.repeat(100)).length, 60);
});
