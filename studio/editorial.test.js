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
  kmr: { hook: 'Şaredariyek di nav çem de', body: 'Şaredarî li ser giravekê hatiye avakirin.', hashtags: ['#Bamberg', '#Almanya'] },
});
const a = { title: 'Bamberg', text: ARTICLE, url: 'https://en.wikivoyage.org/wiki/Bamberg' };
const slot = { kind: 'place', type: 'german_city' };

test('writePost: accepts a post whose evidence is a real sentence of the article', async () => {
  config.GEMINI_API_KEY = 'test';
  const p = await writePost(a, slot, reply({ angle: 'town hall on an island', score: 9, evidence: 'built on an artificial island in the river Regnitz because the bishop refused',
    ...texts('Der Bischof gab kein Land, also bauten die Bürger ihr Rathaus auf eine künstliche Insel in der Regnitz.') }));
  assert.deepStrictEqual(Object.keys(p.texts), ['de', 'ar', 'kmr']);
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
    const p = await writePost(a, slot, reply({ score: 9, evidence: 'built on an artificial island in the river Regnitz because the bishop refused', ...texts(body) }));
    assert.strictEqual(p, null, body);
  }
});

test('writePost: rejects weak angles (score below 7)', async () => {
  config.GEMINI_API_KEY = 'test';
  const p = await writePost(a, slot, reply({ score: 4, evidence: 'built on an artificial island in the river Regnitz because the bishop refused', ...texts('Ein Rathaus.') }));
  assert.strictEqual(p, null);
});

test('evidence: word for word or lightly rephrased, never invented', () => {
  const { evidenceFound } = require('./editorial');
  assert.ok(evidenceFound('The Old Town Hall was built on an artificial island in the river Regnitz', ARTICLE));
  assert.ok(evidenceFound('Old Town Hall built upon an artificial island in the Regnitz river because the bishop refused land', ARTICLE));
  assert.ok(!evidenceFound('The town hall is made entirely of gold and glows at night every single day', ARTICLE));
});

test('food filter matches whole words only (sichtbar, kostbar stay)', () => {
  const { EXCLUDE } = require('./news-sources');
  for (const s of ['Die Küste ist von weitem sichtbar', 'ein kostbarer Schatz', 'der Gerichtshof von Den Haag']) assert.ok(!EXCLUDE.test(s), s);
  assert.ok(EXCLUDE.test('Die besten Bars der Stadt'));
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

test('article: finds the right page with the site search when the title differs', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    const ok = (body) => ({ ok: true, json: async () => body });
    if (url.includes('list=search')) return ok({ query: { search: [{ title: 'Amadiya' }] } });
    if (url.includes('titles=Amedi')) return ok({ query: { pages: { '-1': { title: 'Amedi', missing: '' } } } });
    return ok({ query: { pages: { 7: { title: 'Amadiya', extract: '== See ==\n' + 'The town sits on a flat mountain top with the old Badinan gate. '.repeat(10) } } } });
  };
  const a = await article('Amedi', fake, ['en'], { onlySeeDo: true });
  assert.strictEqual(a.title, 'Amadiya');
  assert.ok(calls.some((u) => u.includes('list=search')));
});

test('one-time Wikipedia source is credited as Wikipedia', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ query: { pages: { 1: { title: 'Lalish', extract: 'Lalish is a mountain valley. '.repeat(80) } } } }) });
  const a = await article('Lalish', fake, ['en'], { site: 'wikipedia' });
  assert.strictEqual(a.url, 'https://en.wikipedia.org/wiki/Lalish');
});

test('events only when they start in 2-10 weeks', async () => {
  config.GEMINI_API_KEY = 'test';
  const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const base = { score: 9, evidence: 'built on an artificial island in the river Regnitz because the bishop refused', ...texts('Ein Rathaus auf einer Insel.') };
  assert.strictEqual(await writePost(a, slot, reply({ ...base, event_start: iso(-10) })), null);
  assert.strictEqual(await writePost(a, slot, reply({ ...base, event_start: iso(200) })), null);
  assert.ok(await writePost(a, slot, reply({ ...base, event_start: iso(30) })));
});

test('food and drink words in every language are excluded', () => {
  const { EXCLUDE } = require('./news-sources');
  for (const s of ['ein Fest mit Speisen und Getränken', 'beer tents', 'مهرجان يقدم البيرة والطعام', 'خوارن و ڤەخوارن']) assert.ok(EXCLUDE.test(s), s);
});

test('Kurmanji (ê, î, ş) and Arabic hashtags with tatweel or marks are accepted', async () => {
  config.GEMINI_API_KEY = 'test';
  const t = texts('Ein Rathaus auf einer Insel.');
  t.kmr.hashtags = ['#Kurdistan', '#Gerîyan'];
  t.ar.hashtags = ['#سفـر', '#رحلاتٌ'];
  assert.ok(await writePost(a, slot, reply({ score: 9, evidence: 'built on an artificial island in the river Regnitz because the bishop refused', ...t })));
});

test('Wikivoyage 429: retried politely instead of failing', async () => {
  let n = 0;
  const fake = async () => (++n === 1 ? { ok: false, status: 429 } : { ok: true, status: 200, json: async () => ({ query: { pages: { 1: { title: 'Bamberg', extract: ARTICLE } } } }) });
  const r = await article('Bamberg', fake, ['en']);
  assert.strictEqual(r.title, 'Bamberg');
  assert.strictEqual(n, 2);
});

test('"Dies" (German "this") is not a sad word', () => {
  const { SAD } = require('./news-sources');
  assert.ok(!SAD.test('Dies ist der schönste Blick auf den See.'));
});

test('place posts read only what a traveller can see and do (See / Do sections)', () => {
  const { seeDo } = require('./editorial');
  const text = 'Intro text.\n\n== Understand ==\nThe name comes from a knight.\n\n== See ==\nRing the wishing bell on the island.\n\n=== Viewpoints ===\nOjstrica at sunrise.\n\n== Do ==\nTake a pletna boat.\n\n== Eat ==\nCream cake.';
  const out = seeDo(text);
  assert.match(out, /wishing bell/);
  assert.match(out, /Ojstrica/);
  assert.match(out, /pletna/);
  assert.doesNotMatch(out, /knight|Cream cake/);
});

test('the prompt asks for a traveller experience, not trivia', () => {
  const { storyPrompt } = require('./editorial');
  const p = storyPrompt({ title: 'Bled', text: '…' }, { kind: 'place', type: 'lake' });
  assert.match(p, /experience a visitor can have/);
  assert.match(p, /NOT trivia/);
  // approved style: friend's voice, "du", the two client-approved examples
  assert.match(p, /with "du" \(never "Sie"\)/);
  assert.match(p, /Wortwörtlich/);
  assert.match(p, /99 درجة/);
  assert.match(p, /NOT as a translation/);
});

test('makeIdeas without an API key returns nothing', async () => {
  config.GEMINI_API_KEY = '';
  assert.deepStrictEqual(await makeIdeas(3, { fetchImpl: async () => { throw new Error('no network'); } }), []);
});
