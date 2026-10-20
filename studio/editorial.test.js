const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { plan, research, writeStory, jsonIn, okText } = require('./editorial');

test('plan: different themes, about 60 % core areas', () => {
  const p = plan(6, () => 0.3);
  assert.strictEqual(new Set(p.map((x) => x.theme)).size, 6);
  assert.strictEqual(p.filter((x) => x.core).length, 4);
  const three = plan(3, () => 0.1);
  assert.strictEqual(three.filter((x) => x.core).length, 2);
});

test('jsonIn reads the JSON block of a grounded answer', () => {
  assert.deepStrictEqual(jsonIn('Here you go:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.strictEqual(jsonIn('no json'), null);
});

test('okText: stories yes, sales pitches, links, sad or food topics no', () => {
  assert.ok(okText('Wenn die Sonne sinkt, leuchtet der Sonnenuntergang über dem Tal.', 700));
  for (const s of ['Jetzt buchen und mitfliegen.', 'Mehr auf www.example.com', 'Gast gerettet', 'Die besten Restaurants der Stadt', 'احجز الآن']) assert.ok(!okText(s, 700), s);
});

const grounded = (obj, chunks = []) => async () => ({ ok: true, json: async () => ({ candidates: [{
  content: { parts: [{ text: 'Result: ' + JSON.stringify(obj) }] }, groundingMetadata: { groundingChunks: chunks } }] }) });

test('research keeps verified facts and takes sources from the grounding data', async () => {
  config.GEMINI_API_KEY = 'test';
  const r = await research({ theme: 'nature', area: 'Europe' }, [], grounded(
    { topic: 'Plitvice Lakes', place: 'Plitvice', country: 'Croatia', facts: ['16 terraced lakes', 'UNESCO since 1979', 'colours change'], photo_query: 'Plitvice lakes waterfalls' },
    [{ web: { uri: 'https://en.wikipedia.org/wiki/Plitvice', title: 'wikipedia.org' } }, { web: { uri: 'javascript:x', title: 'bad' } }]));
  assert.strictEqual(r.place, 'Plitvice');
  assert.deepStrictEqual(r.sources, [{ title: 'wikipedia.org', url: 'https://en.wikipedia.org/wiki/Plitvice' }]);
});

test('research drops sad or food topics', async () => {
  config.GEMINI_API_KEY = 'test';
  assert.strictEqual(await research({ theme: 'unusual', area: 'Europe' }, [], grounded({ topic: 'Best restaurants of Rome', place: 'Rome', country: 'Italy', facts: ['a', 'b', 'c'] })), null);
  assert.strictEqual(await research({ theme: 'unusual', area: 'Europe' }, [], grounded({ topic: 'Ship rescue', place: 'Sea', country: 'Italy', facts: ['passenger rescued', 'b', 'c'] })), null);
});

const story = (de) => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ de,
  ar: { hook: 'ست عشرة بحيرة', body: 'تتدرج البحيرات وتصلها الشلالات.', hashtags: ['#كرواتيا', '#بحيرات'] },
  ckb: { hook: 'شازدە گول', body: 'گول ب شەلالان ڤە گرێداینە.', hashtags: ['#کرواتیا', '#گول'] } }) }] } }] }) });
const facts = { topic: 'Plitvice', place: 'Plitvice', country: 'Croatia', facts: ['a', 'b', 'c'] };

test('writeStory accepts a story in all three languages', async () => {
  config.GEMINI_API_KEY = 'test';
  const t = await writeStory(facts, story({ hook: '16 Seen und keiner gleicht dem anderen', body: 'Stufe um Stufe fällt das Wasser.', hashtags: ['#Kroatien', '#Plitvice'] }));
  assert.deepStrictEqual(Object.keys(t), ['de', 'ar', 'ckb']);
});

test('writeStory rejects a sales pitch', async () => {
  config.GEMINI_API_KEY = 'test';
  assert.strictEqual(await writeStory(facts, story({ hook: 'Plitvice', body: 'Jetzt buchen mit uns.', hashtags: ['#Kroatien', '#Seen'] })), null);
});
