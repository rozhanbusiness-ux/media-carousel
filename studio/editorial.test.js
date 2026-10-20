const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { plan, article, writePost, makeIdeas, textProblem } = require('./editorial');

const ARTICLE = 'Bamberg is a town in Franconia. '.repeat(40)
  + 'The Old Town Hall was built on an artificial island in the river Regnitz because the bishop refused to give the citizens land. '
  + 'It is reached by two bridges. '.repeat(20);

test('plan: two place stories, the third is sometimes a Ratgeber post', () => {
  const tipDay = plan(3, () => 0.1);
  assert.deepStrictEqual(tipDay.map((s) => s.kind), ['place', 'place', 'tip']);
  const placeDay = plan(3, () => 0.95);
  assert.ok(placeDay.every((s) => s.kind === 'place'));
});

test('article: reads Wikivoyage as plain text, skips missing or tiny pages', async () => {
  const fake = (extract) => async () => ({ ok: true, json: async () => ({ query: { pages: { 1: { title: 'Bamberg', extract } } } }) });
  const a = await article('Bamberg', fake(ARTICLE));
  assert.strictEqual(a.url, 'https://en.wikivoyage.org/wiki/Bamberg');
  assert.strictEqual(await article('Nowhere', fake('short')), null);
});

const reply = (obj) => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const texts = (deBody) => ({
  de: { hook: 'Ein Rathaus mitten im Fluss', body: deBody, hashtags: ['#Bamberg', '#Franken'] },
  ar: { hook: 'دار بلدية وسط النهر', body: 'بُنيت دار البلدية على جزيرة صنعها الأهالي في النهر.', hashtags: ['#بامبرغ', '#ألمانيا'] },
  ckb: { hook: 'شارەوانیەک د ناڤ رووباری دا', body: 'شارەوانی ل سەر گزیرتەکێ هاتە ئاڤاکرن.', hashtags: ['#بامبێرگ', '#ئەلمانیا'] },
});
const a = { title: 'Bamberg', text: ARTICLE, url: 'https://en.wikivoyage.org/wiki/Bamberg' };
const slot = { kind: 'place', type: 'german_city' };

test('writePost: accepts a post whose evidence is a real sentence of the article', async () => {
  config.GEMINI_API_KEY = 'test';
  const p = await writePost(a, slot, reply({ angle: 'town hall on an island', evidence: 'built on an artificial island in the river Regnitz because the bishop refused',
    ...texts('Der Bischof gab kein Land, also bauten die Bürger ihr Rathaus auf eine künstliche Insel in der Regnitz.') }));
  assert.deepStrictEqual(Object.keys(p.texts), ['de', 'ar', 'ckb']);
});

test('writePost: rejects invented evidence (nothing that is not in the article)', async () => {
  config.GEMINI_API_KEY = 'test';
  const logs = [];
  const p = await writePost(a, slot, reply({ evidence: 'The town hall is made entirely of gold and glows at night every day', ...texts('Gold.') }), (m) => logs.push(m));
  assert.strictEqual(p, null);
  assert.match(logs[0], /evidence not found/);
});

test('writePost: rejects clichés, direct address openers and sales talk', async () => {
  config.GEMINI_API_KEY = 'test';
  for (const body of ['Stellen Sie sich vor: ein Rathaus im Fluss.', 'Ein Paradies am Wasser.', 'Jetzt buchen und hinfliegen.', 'Ein Rathaus im Fluss!']) {
    const p = await writePost(a, slot, reply({ evidence: 'built on an artificial island in the river Regnitz because the bishop refused', ...texts(body) }));
    assert.strictEqual(p, null, body);
  }
});

test('writePost: the editor may skip a weak article', async () => {
  config.GEMINI_API_KEY = 'test';
  assert.strictEqual(await writePost(a, slot, reply({ skip: true })), null);
});

test('textProblem names the reason; Ratgeber posts may mention delays', () => {
  assert.match(textProblem('Bei Verspätung haben Fluggäste Rechte.', 400, 'place'), /^sad/);
  assert.strictEqual(textProblem('Bei Verspätung haben Fluggäste Rechte.', 400, 'tip'), null);
  assert.strictEqual(textProblem('Die Kirche wurde 1850 entdeckt und restauriert.', 400), null);
});

test('makeIdeas without an API key returns nothing', async () => {
  config.GEMINI_API_KEY = '';
  assert.deepStrictEqual(await makeIdeas(3, { fetchImpl: async () => { throw new Error('no network'); } }), []);
});
