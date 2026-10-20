// ============================================================
//  studio/editorial.js — the "editor-in-chief" behind the daily ideas
//  (client decision after the news-feed test: feeds gave weak, dry
//  posts). Each idea is an editorial topic from a fixed rotation
//  (unusual places, hidden villages, natural wonders, festivals,
//  traditions, records, seasonal beauty). Two Gemini calls:
//   1. research: picks one concrete topic and collects facts WITH
//      Google Search grounding (sources come from the grounding data);
//   2. story: writes the post from those facts only, in de / ar / ckb,
//      as an engaging travel-magazine story (not advertising).
//  Client rules: joyful only, no food, no mosques/minarets, no booking
//  calls; about 60 % Europe / Kurdistan / UAE and 40 % the rest.
// ============================================================

const config = require('../config');
const { EXCLUDE, SAD } = require('./news-sources');

const MODEL = 'gemini-2.5-flash';
const LANGS = ['de', 'ar', 'ckb'];
const LANG_NAME = { de: 'German', ar: 'Arabic (Modern Standard)', ckb: 'Kurdish Badini (Behdînî, Northern Kurdish of Duhok, written in Arabic script)' };

const THEMES = {
  unusual: 'one of the most unusual or surprising places to visit (a strange landscape, a curious village, a place with a story)',
  hidden: 'a little-known village, island, valley or old town that most travellers have never heard of',
  nature: 'a natural wonder: a lake, waterfall, cave, canyon, coast, mountain or forest with something special about it',
  festival: 'a joyful festival, celebration or cultural event that takes place in the next 3 to 10 weeks (verify the dates)',
  tradition: 'a colourful local tradition or custom that travellers can experience',
  record: 'a travel record or superlative (the longest, highest, oldest, deepest …) that is a real place to visit',
  season: 'a place that is at its most beautiful in the current season or the coming weeks, and why',
};
const CORE_AREAS = ['Europe', 'Europe', 'Europe', 'the Kurdistan Region of Iraq', 'the United Arab Emirates'];
const WORLD_AREAS = ['East Asia', 'South-East Asia', 'Central Asia or the Caucasus', 'North Africa', 'the Americas', 'Oceania', 'Southern Africa', 'South Asia'];

// Booking calls and empty advertising words (the story may be vivid, but never a sales pitch).
const SALES = /jetzt buchen|buchen sie|mit uns|bei uns|unser angebot|book now|with us|اكتشف عروض|احجز|معنا|لدينا عروض|دگەل مە|ئۆفەر/i;
const LINKS = /https?:|www\.|\.com\b|\.de\b|@|€|\$|kostenlos|gratis|rabatt|مجان|خصم/i;

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

/** Plan for n ideas: themes without repeats, about 60 % core areas. */
function plan(n, rnd = Math.random) {
  const themes = Object.keys(THEMES).sort(() => rnd() - 0.5);
  const coreCount = n === 3 ? (rnd() < 0.8 ? 2 : 1) : Math.round(n * 0.6);
  return Array.from({ length: n }, (_, i) => ({
    theme: themes[i % themes.length],
    area: i < coreCount ? pick(CORE_AREAS, rnd) : pick(WORLD_AREAS, rnd),
    core: i < coreCount,
  })).sort(() => rnd() - 0.5);
}

async function gemini(body, fetchImpl) {
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return res.json();
}

/** First {...} block of a model answer (search-grounded answers cannot use JSON mode). */
function jsonIn(text) {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/** Step 1: one concrete topic with verified facts and sources (Google Search grounding). */
async function research({ theme, area }, avoid = [], fetchImpl = fetch, today = new Date()) {
  const prompt = [
    `Today is ${today.toISOString().slice(0, 10)}. You are the research editor of a travel magazine for people living in Germany.`,
    `Find ONE specific topic: ${THEMES[theme]}, in ${area}. Use Google Search to verify every fact.`,
    'It must be joyful and make people want to travel. Not about food, restaurants or drinks. Not about mosques, minarets or religious buildings. Not about politics, accidents, danger or anything sad.',
    avoid.length ? `Do not choose any of these recent topics: ${avoid.slice(-40).join('; ')}.` : '',
    'Collect 4 to 6 surprising, concrete, verified facts (what makes it special, a story or legend, the best moment to see it, dates for events). No prices.',
    'Return ONLY JSON: {"topic":"short title in English","place":"place name","country":"country in English","facts":["…"],"photo_query":"3-6 English words to find a real photo of exactly this place"}',
  ].filter(Boolean).join('\n');
  const json = await gemini({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }],
    generationConfig: { temperature: 1, maxOutputTokens: 2048 } }, fetchImpl);
  const cand = json?.candidates?.[0];
  const t = jsonIn((cand?.content?.parts || []).map((p) => p.text || '').join(''));
  if (!t || typeof t.topic !== 'string' || !Array.isArray(t.facts) || t.facts.length < 3) return null;
  const facts = t.facts.filter((f) => typeof f === 'string' && f.length < 400).slice(0, 6);
  const all = `${t.topic} ${t.place} ${facts.join(' ')}`;
  if (EXCLUDE.test(all) || SAD.test(all)) return null;
  const sources = (cand?.groundingMetadata?.groundingChunks || []).map((c) => c.web).filter((w) => w && /^https:\/\//.test(w.uri))
    .slice(0, 4).map((w) => ({ title: String(w.title || '').slice(0, 80), url: w.uri }));
  return { topic: t.topic.slice(0, 120), place: String(t.place || '').slice(0, 80), country: String(t.country || '').slice(0, 60),
    facts, photoQuery: String(t.photo_query || t.place || '').replace(/[^\p{L}\p{N} '-]/gu, '').slice(0, 60), sources };
}

function storyPrompt(r) {
  return [
    'You write one social media post (Instagram/Facebook carousel caption) for MEDIA Travel & Tourism, a travel agency in Germany. Readers: Germans, Kurds and Arabs living in Germany.',
    `Topic: ${r.topic} (${r.place}, ${r.country}). Facts (use ONLY these; do not add facts, numbers or dates that are not here):\n- ${r.facts.join('\n- ')}`,
    'Style (client rule): an engaging travel-magazine STORY, like National Geographic or Atlas Obscura. Open with curiosity or a striking image, give one or two surprising facts, a sensory detail (light, sound, colour), and close with a line that stays in the mind.',
    'It is information and storytelling, NOT advertising: no calls to book or travel, no "with us", no prices, no links, no clichés ("hidden gem", "paradise", "unforgettable", "breathtaking", "Entdecke", "اكتشف"), no exclamation marks.',
    'Native, natural phrasing in each language (not a translation of the German). At most one emoji per text.',
    `For each language (${LANGS.map((l) => `${l} = ${LANG_NAME[l]}`).join('; ')}): hook = headline that makes people stop scrolling (max 60 characters); body = 3 to 5 sentences (max 600 characters); hashtags = 4 to 6 about the place and topic (letters only, no brand tags).`,
    'Return ONLY JSON: {"de":{"hook":"","body":"","hashtags":["#…"]},"ar":{…},"ckb":{…}}',
  ].join('\n');
}

const okText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max && !/[<>{}]/.test(s)
  && !LINKS.test(s) && !SALES.test(s) && !EXCLUDE.test(s) && !SAD.test(s);
const okTags = (t) => Array.isArray(t) && t.length >= 2 && t.length <= 8 && t.every((x) => typeof x === 'string' && /^#[\p{L}\p{N}_]{2,30}$/u.test(x));

/** Step 2: the story in de / ar / ckb from the researched facts. */
async function writeStory(r, fetchImpl = fetch) {
  const json = await gemini({ contents: [{ parts: [{ text: storyPrompt(r) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } } }, fetchImpl);
  const ai = jsonIn(json?.candidates?.[0]?.content?.parts?.[0]?.text);
  if (!ai) return null;
  const texts = {};
  for (const l of LANGS) {
    const t = ai[l] || {};
    if (!okText(t.hook, 70) || !okText(t.body, 700) || !okTags(t.hashtags)) return null;
    texts[l] = { hook: t.hook.trim(), body: t.body.trim(), hashtags: [...new Set(t.hashtags)] };
  }
  return texts;
}

/**
 * n ideas (default 3). Each: { theme, region: 'core'|'world', topic, place, country, facts, sources, photoQuery, texts }.
 * Topics in `avoid` (recent ones) are not repeated. Failed slots are retried once with a new theme.
 */
async function makeIdeas(n = 3, { avoid = [], fetchImpl = fetch, log = console.log, rnd = Math.random } = {}) {
  if (!config.GEMINI_API_KEY) return [];
  const out = [];
  const slots = plan(n, rnd);
  for (let i = 0; i < slots.length; i++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const slot = attempt ? { ...slots[i], theme: pick(Object.keys(THEMES), rnd) } : slots[i];
      try {
        const r = await research(slot, [...avoid, ...out.map((o) => o.topic)], fetchImpl);
        if (!r) continue;
        const texts = await writeStory(r, fetchImpl);
        if (!texts) continue;
        out.push({ theme: slot.theme, region: slot.core ? 'core' : 'world', ...r, texts });
        break;
      } catch (err) { log(`editorial ${slot.theme}/${slot.area}: ${err.message}`); }
    }
  }
  return out;
}

module.exports = { THEMES, plan, research, writeStory, storyPrompt, makeIdeas, jsonIn, okText };
