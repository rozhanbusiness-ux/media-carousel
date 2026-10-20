const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { pickIdeas, writeIdea } = require('./news-ideas');

const f = (id, cat, date = '2026-10-19') => ({ id, cat, date, title: id, summary: 's', source: 'x', link: 'https://x.org' });
const facts = [f('i1', 'inspiration'), f('i2', 'inspiration'), f('p1', 'place'), f('c1', 'cruise'), f('s1', 'season'), f('a1', 'practical')];

test('three ideas: two inspiration ideas of different kinds, then one more', () => {
  const picks = pickIdeas(facts, new Set(), () => 0.1);
  assert.strictEqual(picks.length, 3);
  assert.ok(['inspiration', 'place', 'food', 'cruise'].includes(picks[0].cat));
  assert.notStrictEqual(picks[0].cat, picks[1].cat);
  assert.strictEqual(picks[2].cat, 'season');
});

test('skips facts already used', () => {
  const picks = pickIdeas(facts, new Set(['i1', 'i2', 'p1', 'c1']), () => 0.9);
  assert.deepStrictEqual(picks.map((p) => p.id), ['a1', 's1']);
});

const answer = (de) => async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
  de, ar: { hook: 'بحيرة هادئة', body: 'ماء صافٍ وغروب ذهبي.', hashtags: ['#سفر', '#بحيرة'] },
  ckb: { hook: 'گولەکا ئارام', body: 'ئاڤا زەلال.', hashtags: ['#گەشت', '#گول'] } }) }] } }] }) });

test('accepts safe model texts in all three languages', async () => {
  config.GEMINI_API_KEY = 'test';
  const t = await writeIdea(facts[0], answer({ hook: 'Stille am Dukan-See', body: 'Klares Wasser, goldenes Licht.', hashtags: ['#Reisen', '#See'] }));
  assert.deepStrictEqual(Object.keys(t), ['de', 'ar', 'ckb']);
});

test('rejects links, prices and mosques in model texts', async () => {
  config.GEMINI_API_KEY = 'test';
  for (const body of ['Mehr auf www.example.com', 'Nur 99 € heute', 'Die Moschee am See']) {
    assert.strictEqual(await writeIdea(facts[0], answer({ hook: 'Hallo', body, hashtags: ['#Reisen'] })), null, body);
  }
});

test('no API key: no idea', async () => {
  config.GEMINI_API_KEY = '';
  assert.strictEqual(await writeIdea(facts[0], answer({})), null);
});
