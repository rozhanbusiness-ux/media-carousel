const test = require('node:test');
const assert = require('node:assert');
const { parseFeed, plain, EXCLUDE, fetchText, feedFacts } = require('./news-sources');

const RSS = `<rss><channel><item><title><![CDATA[Lake Dukan & <b>sunsets</b>]]></title>
<link>https://example.org/a</link><description>&lt;p&gt;Calm water&#8230; and boats&lt;/p&gt;</description>
<pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>No link</title></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item></channel></rss>`;
const ATOM = `<feed><entry><title>New ship</title><link rel="alternate" href="https://example.org/ship"/>
<summary>Maiden voyage</summary><updated>2026-10-19T10:00:00Z</updated></entry></feed>`;

test('parses RSS items as plain text and drops items without a safe link', () => {
  const items = parseFeed(RSS);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].title, 'Lake Dukan & sunsets');
  assert.strictEqual(items[0].summary, 'Calm water… and boats');
  assert.strictEqual(items[0].link, 'https://example.org/a');
});

test('parses Atom entries', () => {
  const [e] = parseFeed(ATOM);
  assert.deepStrictEqual([e.title, e.link, e.date], ['New ship', 'https://example.org/ship', '2026-10-19T10:00:00.000Z']);
});

test('plain() strips markup and shortens', () => {
  assert.strictEqual(plain('<script>x</script>a &amp; b'), 'x a & b');
  assert.ok(plain('word '.repeat(200), 50).length <= 50);
});

test('excludes mosques, minarets and bad news', () => {
  for (const s of ['Die schönste Moschee', 'minaret view', 'مسجد', 'Earthquake hits', 'Anschlag']) assert.ok(EXCLUDE.test(s), s);
  assert.ok(!EXCLUDE.test('The strangest salt lake in Cyprus'));
});

test('excludes food and restaurant topics (client decision)', () => {
  for (const s of ['Best new restaurants in Dubai', 'Rezept: Baklava', 'Street food tour', 'مطاعم أربيل', 'Michelin stars']) assert.ok(EXCLUDE.test(s), s);
  for (const s of ['Lantern festival in Chiang Mai', 'Hiking the Rawanduz canyon', 'Kurdish New Year in Hessen', 'Weinberg view']) assert.ok(!EXCLUDE.test(s), s);
});

test('fetches only listed hosts', async () => {
  await assert.rejects(fetchText('https://evil.example/feed', async () => ({ ok: true, text: async () => '' })), /host not allowed/);
});

test('one failing feed does not stop the others', async () => {
  const fake = async (url) => (url.includes('cruisehive') ? { ok: false, status: 500 } : { ok: true, text: async () => RSS });
  const facts = await feedFacts(fake, () => {});
  assert.ok(facts.length >= 5);
  assert.ok(facts.every((f) => f.id && f.source && f.link.startsWith('https://')));
  assert.ok(!facts.some((f) => f.sourceId === 'cruisehive'));
});
