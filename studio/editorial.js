// ============================================================
//  studio/editorial.js — the editor behind "Ideen des Tages"
//  (client model, agreed with examples): ONE place a day and ONE
//  sharp angle about it (a legend, something that exists only there,
//  a strange sight, a local custom) in 2-3 sentences — no statistics,
//  no lists, no long articles. Mostly Europe (lakes, mountains,
//  coasts, villages, islands, German cities, capitals), some
//  Kurdistan/UAE and a little of the rest of the world. Plus
//  practical "Ratgeber" posts (booking flights, choosing hotels,
//  river cruises, before travelling to …).
//  Single source: Wikivoyage (reliable, CC BY-SA 4.0, credited).
//  Gemini must quote the sentence of the article its angle rests on;
//  the quote is checked against the article, so nothing is invented.
//  Client rules: joyful, no food, no mosques/minarets, no sales talk.
// ============================================================

const config = require('../config');
const { EXCLUDE, SAD } = require('./news-sources');

const MODEL = 'gemini-2.5-flash';
const LANGS = ['de', 'ar', 'ckb'];
const LANG_NAME = { de: 'German', ar: 'Arabic (Modern Standard)', ckb: 'Kurdish Badini (Behdînî, Northern Kurdish of Duhok, written in Arabic script)' };
const MAX_ARTICLE = 16000; // characters of the article given to the model

// Place types with weights (client: mostly Europe; Europe has thousands of lakes, mountains, coasts and villages).
const PLACE_TYPES = [
  ['german_city', 'a German town or city (not only the big ones)', 3],
  ['lake', 'a lake in Europe', 3],
  ['mountain', 'a mountain, mountain village or mountain area in Europe', 2],
  ['coast', 'a coast, bay, beach area or cliff coast in Europe', 3],
  ['island', 'an island in Europe', 2],
  ['village', 'a small village or small old town in Europe', 3],
  ['capital', 'a European capital city', 2],
  ['kurdistan', 'a town, valley or natural place in the Kurdistan Region of Iraq', 1],
  ['uae', 'a place in the United Arab Emirates', 1],
  ['world', 'a remarkable place outside Europe (Asia, Africa, the Americas, Oceania)', 1],
];

// Ratgeber topics: the Wikivoyage articles to read (first one that exists is used).
const TIPS = [
  ['flights', 'when and how to book flights well (timing, flexibility, luggage rules)', ['Air travel', 'Flying', 'Air travel in Europe']],
  ['hotels', 'what to look at when booking a hotel', ['Accommodation', 'Hotels']],
  ['river_cruise', 'what to know before booking a river cruise', ['River cruises', 'Cruising on small ships', 'Cruise ships']],
  ['packing', 'smart packing and hand luggage', ['Packing list', 'Luggage']],
  ['insurance', 'travel insurance basics', ['Travel insurance']],
  ['passenger_rights', 'air passenger rights in the EU', ['Air passenger rights in the European Union', 'Air passenger rights']],
  ['jet_lag', 'arriving rested after a long flight', ['Jet lag']],
  ['before', 'what to know before travelling to this country (entry, money, customs, etiquette)',
    ['Turkey', 'Egypt', 'United Arab Emirates', 'Iraqi Kurdistan', 'Greece', 'Spain', 'Cyprus', 'Georgia (country)', 'Jordan', 'Portugal', 'Croatia', 'Thailand', 'Italy', 'Bulgaria', 'Tunisia', 'Morocco']],
];

const SALES = /jetzt buchen|buchen sie|mit uns|bei uns|unser angebot|book now|with us|احجز|معنا|لدينا عروض|دگەل مە|ئۆفەر/i;
const LINKS = /https?:|www\.|\.com\b|\.de\b|@|€|\$|kostenlos|gratis|rabatt|مجان|خصم/i;
// Openers the client found monotonous, and direct address (the posts are narrated, not addressed).
const CLICHE = /stellen sie sich|stell dir vor|imagine|تخيل|تخيّل|خۆ بێخە|wussten sie|did you know|\bentdecke\b|entdecken sie|\bdiscover\b|اكتشف|verborgenes juwel|hidden gem|paradies|paradise|unvergess|unforgettable|atemberaub|breathtaking|!/i;

const weighted = (list, rnd) => {
  const total = list.reduce((s, x) => s + x[2], 0);
  let r = rnd() * total;
  for (const x of list) { r -= x[2]; if (r < 0) return x; }
  return list[list.length - 1];
};

/** Plan for one day: two place stories and a third that is a Ratgeber post on about 3 of 5 days. */
function plan(n = 3, rnd = Math.random) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1 && rnd() < 0.6) slots.push({ kind: 'tip', tip: TIPS[Math.floor(rnd() * TIPS.length)] });
    else {
      let t = weighted(PLACE_TYPES, rnd);
      for (let k = 0; k < 20 && slots.some((s) => s.type === t[0]); k++) t = weighted(PLACE_TYPES, rnd);
      if (slots.some((s) => s.type === t[0])) t = PLACE_TYPES.find((x) => !slots.some((s) => s.type === x[0])); // no repeat in one day
      slots.push({ kind: 'place', type: t[0], desc: t[1] });
    }
  }
  return slots;
}

async function gemini(prompt, fetchImpl, temperature = 0.9) {
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  try { return JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || ''); } catch { return null; }
}

/** Wikivoyage article as plain text: { title, text, url } or null (English first, then German). */
async function article(title, fetchImpl, langs = ['en', 'de']) {
  for (const lang of langs) {
    try {
      const url = `https://${lang}.wikivoyage.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
      const res = await fetchImpl(url, { headers: { 'User-Agent': 'MEDIA Studio (media-travels.com)' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const page = Object.values((await res.json()).query?.pages || {})[0];
      const text = String(page?.extract || '');
      if (!page || page.missing !== undefined || text.length < 1500) continue;
      return { title: page.title, lang, text: text.slice(0, MAX_ARTICLE), url: `https://${lang}.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
    } catch { /* try the next language */ }
  }
  return null;
}

/** A few candidate places of one type, not used before (the model knows Wikivoyage's coverage). */
async function candidates(slot, avoid, fetchImpl) {
  const ai = await gemini([
    `List 12 real places that are ${slot.desc} and have their own article on English Wikivoyage.`,
    'Prefer places with something special: a legend, an unusual sight, a local custom, a striking landscape. Mix well-known and lesser-known places.',
    avoid.length ? `Do not list any of these: ${avoid.slice(-150).join('; ')}.` : '',
    'Return ONLY JSON: {"places":["exact Wikivoyage article title", …]}',
  ].filter(Boolean).join('\n'), fetchImpl, 1);
  return Array.isArray(ai?.places) ? ai.places.filter((p) => typeof p === 'string' && p.length < 80 && !avoid.includes(p)) : [];
}

const squash = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[„“"'’]/g, '').trim();

function storyPrompt(a, slot) {
  const what = slot.kind === 'tip'
    ? `a short, useful "travel advice" post about: ${slot.tip[1]}${slot.tip[0] === 'before' ? ` (country: ${a.title})` : ''}. Pick the 2 or 3 most useful, concrete pieces of advice from the article that many travellers do not know.`
    : `a post about ${a.title}. Read the whole article and pick ONE single angle: a legend or story, something that exists only here, a strange or beautiful sight, or a striking local custom. The angle must make a reader stop and think "I did not know that". NOT statistics, NOT population, NOT lists of sights, NOT general descriptions.`;
  return [
    'You are the editor of the social media pages of MEDIA Travel & Tourism, a travel agency in Germany (readers: Germans, Kurds and Arabs living in Germany).',
    `Wikivoyage article "${a.title}":\n"""\n${a.text}\n"""`,
    `Write ${what}`,
    'Use ONLY facts from this article. Copy into "evidence" the exact sentence (or part of a sentence, at least 40 characters, word for word) of the article your post rests on.',
    'Style: short, precise and vivid, like a sharp travel-magazine note. The headline IS the angle. Narrate; do not address the reader (no "Sie", "du", "you"). No opening with "Imagine", "Stellen Sie sich vor", "تخيل", "Did you know". No sales talk, no calls to book, no prices, no links, no clichés (paradise, hidden gem, breathtaking, unforgettable), no exclamation marks. Nothing about food, restaurants or drinks; nothing about mosques or minarets; nothing sad.',
    'Native, natural phrasing in each language (not a word-for-word translation).',
    `For each language (${LANGS.map((l) => `${l} = ${LANG_NAME[l]}`).join('; ')}): hook = the headline (max 60 characters); body = ${slot.kind === 'tip' ? '2-3 short points or sentences (max 420 characters)' : '2-3 sentences (max 360 characters)'}; hashtags = 3 to 5 about this place or topic only (letters only).`,
    'If the article has nothing joyful or interesting enough, return {"skip":true}.',
    'Return ONLY JSON: {"angle":"one line in English","evidence":"…","de":{"hook":"","body":"","hashtags":["#…"]},"ar":{…},"ckb":{…}}',
  ].join('\n');
}

/** Why a text is rejected (null when fine). Ratgeber posts may mention delays or cancellations. */
function textProblem(s, max, kind = 'place') {
  if (typeof s !== 'string' || !s.trim()) return 'empty';
  if (s.length > max) return `too long (${s.length})`;
  for (const [name, re] of [['markup', /[<>{}]/], ['link/price', LINKS], ['sales', SALES], ['cliche', CLICHE], ['food/excluded', EXCLUDE], ...(kind === 'tip' ? [] : [['sad', SAD]])]) {
    const m = re.exec(s);
    if (m) return `${name}: "${m[0]}"`;
  }
  return null;
}
const okTags = (t) => Array.isArray(t) && t.length >= 2 && t.length <= 6 && t.every((x) => typeof x === 'string' && /^#[\p{L}\p{N}_]{2,30}$/u.test(x));

/** The post for one article, or null (reason logged). */
async function writePost(a, slot, fetchImpl = fetch, log = () => {}) {
  const ai = await gemini(storyPrompt(a, slot), fetchImpl);
  if (!ai) { log(`${a.title}: no usable JSON`); return null; }
  if (ai.skip) { log(`${a.title}: skipped by the editor (nothing strong enough)`); return null; }
  const ev = squash(ai.evidence);
  if (ev.length < 40 || !squash(a.text).includes(ev)) { log(`${a.title}: evidence not found in the article`); return null; }
  const max = slot.kind === 'tip' ? 520 : 460;
  const texts = {};
  for (const l of LANGS) {
    const t = ai[l] || {};
    const why = textProblem(t.hook, 90, slot.kind) || textProblem(t.body, max, slot.kind) || (okTags(t.hashtags) ? null : 'hashtags');
    if (why) { log(`${a.title} ${l}: ${why}`); return null; }
    texts[l] = { hook: t.hook.trim(), body: t.body.trim(), hashtags: [...new Set(t.hashtags)] };
  }
  return { angle: String(ai.angle || '').slice(0, 160), evidence: String(ai.evidence).slice(0, 400), texts };
}

/**
 * n ideas for today. Each: { kind, type, place, topic, angle, evidence, sources, photoQuery, texts }.
 * `avoid` holds places and tips used before (not repeated).
 */
async function makeIdeas(n = 3, { avoid = [], fetchImpl = fetch, log = console.log, rnd = Math.random } = {}) {
  if (!config.GEMINI_API_KEY) return [];
  const out = [];
  const used = new Set(avoid);
  for (const slot of plan(n, rnd)) {
    try {
      if (slot.kind === 'tip') {
        const titles = slot.tip[0] === 'before' ? [...slot.tip[2]].sort(() => rnd() - 0.5).filter((t) => !used.has(`tip:before:${t}`)) : slot.tip[2];
        for (const title of titles.slice(0, 3)) {
          const a = await article(title, fetchImpl, ['en']);
          if (!a) continue;
          const post = await writePost(a, slot, fetchImpl, log);
          if (!post) continue;
          const key = slot.tip[0] === 'before' ? `tip:before:${title}` : `tip:${slot.tip[0]}`;
          used.add(key);
          out.push({ kind: 'tip', type: slot.tip[0], place: slot.tip[0] === 'before' ? a.title : '', topic: key, ...post,
            sources: [{ title: `Wikivoyage: ${a.title} (CC BY-SA 4.0)`, url: a.url }], photoQuery: slot.tip[0] === 'before' ? `${a.title} landscape` : '' });
          break;
        }
        continue;
      }
      const names = (await candidates(slot, [...used], fetchImpl)).sort(() => rnd() - 0.5);
      for (const name of names.slice(0, 4)) {
        if (used.has(name)) continue;
        const a = await article(name, fetchImpl);
        if (!a) { log(`${name}: no Wikivoyage article`); continue; }
        if (EXCLUDE.test(a.title)) continue;
        const post = await writePost(a, slot, fetchImpl, log);
        used.add(name);
        if (!post) continue;
        out.push({ kind: 'place', type: slot.type, place: a.title, topic: name, ...post,
          sources: [{ title: `Wikivoyage: ${a.title} (CC BY-SA 4.0)`, url: a.url }], photoQuery: a.title });
        break;
      }
    } catch (err) { log(`editorial ${slot.type || slot.tip[0]}: ${err.message}`); }
  }
  return out;
}

module.exports = { PLACE_TYPES, TIPS, plan, article, candidates, storyPrompt, writePost, makeIdeas, textProblem };
