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
// Kurdish in Kurmanji with Latin letters (client decision: written better and readable without Arabic script).
const LANGS = ['de', 'ar', 'kmr'];
const LANG_NAME = { de: 'German', ar: 'Arabic (Modern Standard)', kmr: 'Kurdish Kurmanji in Latin script (Hawar alphabet with ç, ê, î, ş, û), natural everyday Kurmanji as spoken by Kurds in Germany; no Turkish words, no Arabic script' };
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

// One-time topics the client asked for (used once, then never again).
// One-time topics the client asks for (used once, then never again). Lalish was removed by the client.
const PINNED = [];

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
// Sections a traveller can act on (client rule: write what a traveller can see and do there, not trivia).
const SEE_DO = /^(see|do|sehenswürdigkeiten|aktivitäten|unternehmungen)$/i;
/** Only the "See" and "Do" sections of a Wikivoyage plain-text article (with their sub-sections). */
function seeDo(text) {
  const parts = String(text).split(/^==\s*([^=\n]+?)\s*==\s*$/m);
  let out = '';
  for (let i = 1; i < parts.length; i += 2) if (SEE_DO.test(parts[i].trim())) out += `== ${parts[i].trim()} ==\n${parts[i + 1]}\n`;
  return out.trim();
}

// Wikimedia API etiquette: a descriptive User-Agent with contact, one request at a time with a pause,
// and a polite retry when the API answers 429 (too many requests).
const UA = { 'User-Agent': 'MEDIA-Studio/1.0 (https://media-travels.com; info@media-travels.com)' };
const GAP_MS = 1100;
let lastCall = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, fetchImpl, retries = [3000, 8000]) {
  for (let attempt = 0; ; attempt++) {
    const pause = lastCall + GAP_MS - Date.now();
    if (pause > 0 && fetchImpl === fetch) await wait(pause);
    lastCall = Date.now();
    const res = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (res.status === 429 && attempt < retries.length) { await wait(fetchImpl === fetch ? retries[attempt] : 0); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

/**
 * Article as plain text: { title, lang, text, url, site } or null (reason logged). Tries English, then
 * German; when the exact title does not exist, the site's own search finds the right article
 * (e.g. "Amedi" -> "Amadiya"). `site` is 'wikivoyage' (default) or 'wikipedia' (one-time exceptions).
 */
async function article(title, fetchImpl, langs = ['en', 'de'], { onlySeeDo = false, site = 'wikivoyage', log = () => {} } = {}) {
  let why = 'no article';
  for (const lang of langs) {
    const api = `https://${lang}.${site}.org/w/api.php?format=json&action=query`;
    try {
      let page = Object.values((await getJson(`${api}&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`, fetchImpl)).query?.pages || {})[0];
      if (!page || page.missing !== undefined) {
        const hit = (await getJson(`${api}&list=search&srlimit=1&srnamespace=0&srsearch=${encodeURIComponent(title)}`, fetchImpl)).query?.search?.[0];
        if (!hit) continue;
        page = Object.values((await getJson(`${api}&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(hit.title)}`, fetchImpl)).query?.pages || {})[0];
        if (!page || page.missing !== undefined) continue;
      }
      const full = String(page.extract || '');
      const text = onlySeeDo ? seeDo(full) : full;
      if (text.length < (onlySeeDo ? 300 : 1500)) { why = onlySeeDo ? `"See/Do" too short in ${lang}:${page.title}` : `too short (${lang}:${page.title})`; continue; }
      return { title: page.title, lang, site, text: text.slice(0, MAX_ARTICLE), url: `https://${lang}.${site}.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
    } catch (err) { why = err.message; }
  }
  log(`${title}: ${why}`);
  return null;
}
const credit = (a) => `${a.site === 'wikipedia' ? 'Wikipedia' : 'Wikivoyage'}: ${a.title} (CC BY-SA 4.0)`;

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

const MIN_SCORE = 7; // the editor's own "would a reader stop and say: I did not know that?" score, 1-10

const words = (s) => String(s || '').toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]{4,}/gu) || [];
/** The quoted evidence must be in the article: word for word, or at least 85 % of its words (light rephrasing). */
function evidenceFound(evidence, text) {
  const ev = squash(evidence);
  if (ev.length < 40) return false;
  if (squash(text).includes(ev)) return true;
  const have = new Set(words(text));
  const w = words(evidence);
  return w.length >= 6 && w.filter((x) => have.has(x)).length / w.length >= 0.85;
}

const squash = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[„“"'’]/g, '').trim();

function storyPrompt(a, slot, today = new Date()) {
  const what = slot.kind === 'tip'
    ? `a short, useful "travel advice" post about: ${slot.tip[1]}${slot.tip[0] === 'before' ? ` (country: ${a.title})` : ''}. Pick the 2 or 3 most useful, concrete pieces of advice from the article that many travellers do not know.`
    : `a post about ${a.title}. Put yourself in the place of a traveller planning a trip. From the "See" and "Do" sections, pick ONE experience a visitor can have there themselves and that makes them want to go: what they see or do, where exactly, the best time or moment for it, and why it is worth the trip (e.g. a boat ride to an island and ringing a bell, bathing in hot springs while it snows, watching the northern lights, a famous viewpoint at sunset, a cable car, a festival, a walk through an old town). NOT trivia a traveller cannot experience: no plants or animals as such, no origin of names, no geology or growth rates, no history dates, no statistics, no lists.`;
  return [
    'You are the editor of the social media pages of MEDIA Travel & Tourism, a travel agency in Germany (readers: Germans, Kurds and Arabs living in Germany).',
    `${a.site === 'wikipedia' ? 'Wikipedia' : 'Wikivoyage'} article "${a.title}":\n"""\n${a.text}\n"""`,
    `Write ${what}`,
    'Use ONLY facts from this article. Copy into "evidence" the exact sentence (or part of a sentence, at least 40 characters, word for word) of the article your post rests on.',
    'Style (approved by the client with the examples below): like a friend who has just been there and tells you about it. Not an advert, not an encyclopedia.',
    '- Hook: creates curiosity or a twist that makes people stop scrolling (e.g. "Du stehst hinter einem Wasserfall. Wortwörtlich.", "99 Stufen für einen Wunsch").',
    '- Speak to the reader directly: German with "du" (never "Sie"), Arabic and Kurdish in the second person.',
    '- One sensory moment (sound, cold, light, spray), one practical detail (when or how), and a short closing line that stays in the mind (it may be a question to the reader). One fitting emoji at the end.',
    '- Start directly inside the scene. NEVER begin with "Stell dir vor", "Imagine", "تخيل" or "خۆ بێخە" (those posts are rejected).',
    '- Short lines, natural rhythm. No calls to book, no prices, no links, no clichés (paradise, hidden gem, breathtaking, unforgettable, "Stell dir vor", "Imagine", "تخيل"), no exclamation marks. Nothing about food, restaurants or drinks; nothing about mosques or minarets; nothing sad.',
    `Example (German):\n"Du stehst hinter einem Wasserfall. Wortwörtlich."\n"Ein Tunnel im Fels, ein paar Schritte ins Halbdunkel – und plötzlich donnert der Staubbachfall direkt vor dir herab. Die Gischt kühlt dein Gesicht, das Tal leuchtet grün dahinter. Am stärksten rauscht er im Frühsommer, wenn der Schnee schmilzt. Manche Aussichten muss man sich erlaufen. 💧"`,
    `Example (Arabic):\n"99 درجة… مقابل أمنية"\n"قارب خشبي ينساب فوق البحيرة الزمردية نحو جزيرة صغيرة. في الأعلى، داخل الكنيسة، حبل يتدلى من جرس قديم. من يقرعه يتمنى أمنية، هكذا يقول أهل بليد منذ قرون. وأنت، ماذا ستتمنى؟ 🔔"`,
    `Today is ${today.toISOString().slice(0, 10)}. If the experience is a festival or event with dates, choose it only when it starts between 2 and 10 weeks after today, and put its start date in "event_start" (YYYY-MM-DD); otherwise choose another experience of this place. For anything that is not a dated event, leave "event_start" empty.`,
    'Write each language separately, NOT as a translation (client rule): the Arabic and the Kurmanji texts are written as if a native Arabic and a native Kurmanji travel writer told the same experience to their own readers, with their own hook, rhythm, images and idioms. Same facts, but sentence structure and wording must clearly differ from the German; never translate word for word.',
    'German must be grammatically perfect: check every article, case and gender (e.g. "das Silberhorn", "die Wunschglocke läuten"). Proofread each text once before answering.',
    'Rate your choice honestly: "score" 1-10 = how much a traveller would want to go there and do exactly this after reading. Trivia, a plain name or a general description is at most 3.',
    `For each language (${LANGS.map((l) => `${l} = ${LANG_NAME[l]}`).join('; ')}): hook = the headline (max 65 characters); body = ${slot.kind === 'tip' ? '3-4 short lines (max 450 characters)' : '3-4 short sentences like the examples (max 420 characters)'}; hashtags = 3 to 5 about this place or topic only (letters only).`,
    'If the article has nothing joyful or interesting enough, return {"skip":true}.',
    'Return ONLY JSON: {"angle":"the experience, one line in English","score":7,"event_start":"","evidence":"…","de":{"hook":"","body":"","hashtags":["#…"]},"ar":{…},"kmr":{…}}',
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
// Letters incl. Arabic/Kurdish marks, ZWNJ and tatweel (Kurdish and Arabic hashtags use them).
const okTags = (t) => Array.isArray(t) && t.length >= 2 && t.length <= 6 && t.every((x) => typeof x === 'string' && /^#[\p{L}\p{M}\p{N}_\u200c\u0640]{2,30}$/u.test(x));

/** The post for one article, or null (reason logged). */
async function writePost(a, slot, fetchImpl = fetch, log = () => {}) {
  const ai = await gemini(storyPrompt(a, slot), fetchImpl);
  if (!ai) { log(`${a.title}: no usable JSON`); return null; }
  if (ai.skip) { log(`${a.title}: skipped by the editor (nothing strong enough)`); return null; }
  if (!evidenceFound(ai.evidence, a.text)) { log(`${a.title}: evidence not found in the article`); return null; }
  if (EXCLUDE.test(ai.evidence)) { log(`${a.title}: the experience is about food/drink or an excluded topic`); return null; }
  if (ai.event_start) {
    const days = (Date.parse(ai.event_start) - Date.now()) / 86400000;
    if (!(days >= 14 && days <= 70)) { log(`${a.title}: event on ${ai.event_start} is not in the next 2-10 weeks`); return null; }
  }
  const score = Number(ai.score);
  if (!(score >= MIN_SCORE)) { log(`${a.title}: angle too weak (${ai.score}/10: ${String(ai.angle || '').slice(0, 80)})`); return null; }
  const max = slot.kind === 'tip' ? 560 : 540;
  const texts = {};
  for (const l of LANGS) {
    const t = ai[l] || {};
    const why = textProblem(t.hook, 100, slot.kind) || textProblem(t.body, max, slot.kind) || (okTags(t.hashtags) ? null : 'hashtags');
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
  const slots = plan(n, rnd);
  for (const p of PINNED) if (!used.has(p.key) && !slots.some((s) => s.type === p.type)) slots[0] = { kind: 'place', type: p.type, desc: PLACE_TYPES.find((t) => t[0] === p.type)[1] };
  for (const slot of slots) {
    try {
      if (slot.kind === 'tip') {
        const titles = slot.tip[0] === 'before' ? [...slot.tip[2]].sort(() => rnd() - 0.5).filter((t) => !used.has(`tip:before:${t}`)) : slot.tip[2];
        for (const title of titles.slice(0, 3)) {
          const a = await article(title, fetchImpl, ['en'], { log });
          if (!a) continue;
          const post = await writePost(a, slot, fetchImpl, log);
          if (!post) continue;
          const key = slot.tip[0] === 'before' ? `tip:before:${title}` : `tip:${slot.tip[0]}`;
          used.add(key);
          out.push({ kind: 'tip', type: slot.tip[0], place: slot.tip[0] === 'before' ? a.title : '', topic: key, ...post,
            sources: [{ title: credit(a), url: a.url }], photoQuery: slot.tip[0] === 'before' ? `${a.title} landscape` : '' });
          break;
        }
        continue;
      }
      const pin = PINNED.find((p) => p.type === slot.type && !used.has(p.key));
      if (pin) {
        used.add(pin.key); // once only, also when it fails
        let done = false;
        for (const t of pin.titles) {
          const a = await article(t, fetchImpl, ['en'], { site: pin.site || 'wikivoyage', onlySeeDo: !pin.site, log });
          if (!a) continue;
          const post = await writePost(a, slot, fetchImpl, log);
          if (post) { out.push({ kind: 'place', type: slot.type, place: a.title, topic: pin.key, ...post, sources: [{ title: credit(a), url: a.url }], photoQuery: a.title }); done = true; }
          break;
        }
        if (done) continue;
        log(`${pin.key}: no post (${pin.titles.join(', ')})`);
      }
      const names = (await candidates(slot, [...used], fetchImpl)).sort(() => rnd() - 0.5);
      for (const name of names.slice(0, 4)) {
        if (used.has(name)) continue;
        const a = await article(name, fetchImpl, ['en', 'de'], { onlySeeDo: true, log });
        if (!a) continue;
        if (EXCLUDE.test(a.title)) continue;
        const post = await writePost(a, slot, fetchImpl, log);
        used.add(name);
        if (!post) continue;
        out.push({ kind: 'place', type: slot.type, place: a.title, topic: name, ...post,
          sources: [{ title: credit(a), url: a.url }], photoQuery: a.title });
        break;
      }
    } catch (err) { log(`editorial ${slot.type || slot.tip[0]}: ${err.message}`); }
  }
  return out;
}

module.exports = { seeDo, evidenceFound, PLACE_TYPES, TIPS, plan, article, candidates, storyPrompt, writePost, makeIdeas, textProblem };
