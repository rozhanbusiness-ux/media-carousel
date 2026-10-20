// ============================================================
//  studio/news-ideas.js — "Ideen des Tages": three post ideas a day
//  from the travel sources (news-sources.js). Mix agreed with the
//  client: mostly inspiration (places, unusual spots, lakes, cruises, activities, festivals; never food), then
//  seasons/occasions; joyful news only (no incidents, warnings or bad news). Gemini writes the text
//  in its own words (de / ar / ckb); the source is always credited.
//  Nothing is published from here: the client approves or rejects.
//  Stored in cache/studio-news.txt (mounted volume, not in git).
// ============================================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const bank = require('./bank');
const { CITY } = require('./captions');
const { collectFacts, SAD } = require('./news-sources');

const FILE = path.join(__dirname, '..', 'cache', 'studio-news.txt');
const LANGS = ['de', 'ar', 'ckb'];
const LANG_NAME = { de: 'German', ar: 'Arabic (Modern Standard, warm tone)', ckb: 'Kurdish Badini (Behdînî, Northern Kurdish of Duhok, written in Arabic script)' };
const TEXT_MODEL = 'gemini-2.5-flash';
// Client mix: about 60 % Europe, Kurdistan/Iraq and the UAE; about 40 % the rest of the world.
const CORE = ['europe', 'kurdistan', 'uae'];
const REGIONS = [...CORE, 'world', 'general'];
// Advertising words the client rejected; ideas must read like information, not marketing.
const HYPE = /!|entdeck|unvergess|traum|verzauber|atemberaub|mit uns|jetzt buchen|discover|unforgettable|dream|book now|اكتشف|لا تُنسى|لا تنسى|أحلام|احجز|معنا|بیرنەکرن|خەون/i;
const INSPIRATION = ['inspiration', 'place', 'cruise'];

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { days: {}, seen: [] }; } }
function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const days = Object.keys(data.days).sort().slice(-30); // keep 30 days
  data.days = Object.fromEntries(days.map((d) => [d, data.days[d]]));
  data.seen = data.seen.slice(-3000);
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data, null, 1));
  fs.renameSync(FILE + '.tmp', FILE);
}

/**
 * Three ideas: two inspiration ideas of different kinds (e.g. a place and a cruise), then one
 * season idea (about 2 of 3 days) or a practical note; unseen facts only, newest first.
 */
function pickIdeas(facts, seen = new Set(), rnd = Math.random, n = 3) {
  const pool = facts.filter((f) => !seen.has(f.id)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || rnd() - 0.5);
  const byCat = (cats) => pool.filter((f) => cats.includes(f.cat));
  const picks = [];
  const cats = [...INSPIRATION].sort(() => rnd() - 0.5);
  for (const c of cats) {
    if (picks.length >= 2) break;
    const f = byCat([c]).find((x) => !picks.includes(x));
    if (f) picks.push(f);
  }
  for (const f of byCat(INSPIRATION)) if (picks.length < 2 && !picks.includes(f)) picks.push(f);
  const third = rnd() < 0.62 ? [byCat(['season']), byCat(['practical'])] : [byCat(['practical']), byCat(['season'])];
  const extra = [...third[0], ...third[1], ...byCat(INSPIRATION)].find((f) => !picks.includes(f));
  if (extra) picks.push(extra);
  for (const f of [...byCat(INSPIRATION), ...pool]) if (picks.length < n && !picks.includes(f)) picks.push(f); // reserves / quiet days
  return picks.slice(0, n);
}

// Model text: no links, prices, contact data or promises; numbers are allowed (temperatures, dates).
const FORBIDDEN = /https?:|www\.|\.com|\.de\b|@|€|\$|kostenlos|gratis|umsonst|rabatt|garantiert|مجان|خصم|مضمون|بەخۆڕایی|داشکاندن|moschee|minarett|mosque|مسجد|جامع|مئذنة/i;
const safe = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max && !FORBIDDEN.test(s) && !/[<>{}]/.test(s);
const safeTags = (t) => Array.isArray(t) && t.length <= 12 && t.every((x) => typeof x === 'string' && /^#[\p{L}\p{N}_]{2,30}$/u.test(x));

function buildPrompt(f) {
  return [
    'You write a short social media post (Instagram/Facebook) for a travel agency in Germany (MEDIA Travel & Tourism). Customers: Germans, Kurds and Arabs living in Germany.',
    `Kind of post: ${f.cat}. Source: ${f.source}.`,
    `Fact (use ONLY these facts, do not invent anything): Title: ${f.title}. Text: ${f.summary}`,
    'First decide the region the fact is about: "europe" (incl. Cyprus), "kurdistan" (Kurdistan Region and the rest of Iraq), "uae", "world" (every other place: Asia, America, Africa, Australia …) or "general" (travel in general, no specific place).',
    'Tone (client rule): a plain, neutral INFORMATION note, like a short news item or a travel guide entry. Facts only: what, where, when, why it is special or unusual. NOT advertising: no superlatives or hype, no "discover", "unforgettable", "dream", "let yourself be enchanted", no calls to book or travel, no "with us", no exclamation marks.',
    'Write in your OWN words (never copy sentences from the text).',
    'Client rule: ONLY happy, joyful, uplifting news that makes people want to travel (a beautiful or unusual place, a festival, a celebration, a new museum, bridge, trail or ship, a special activity). If the fact is about an accident, rescue, storm, illness, death, crime, delay, cancellation, strike, warning, dispute, closure or anything sad or worrying, return only {"joyful":false}.',
    'Topics: destinations, the most beautiful or most unusual places, unusual activities, events and festivals. Never write about food, restaurants, dishes or drinks.',
    'Rules: no prices, no links, no discounts or "free", no promises; no religious buildings; no politics; at most one emoji per text.',
    `For each language (${LANGS.map((l) => `${l} = ${LANG_NAME[l]}`).join('; ')}) write: hook (max 60 characters), body (max 320 characters, 2-3 factual sentences), hashtags (4 to 6 about the place or topic, each starting with #, letters only, no brand hashtags).`,
    'Hook: a short factual headline (no exclamation mark).',
    'Return ONLY JSON: {"joyful":true,"region":"…","de":{"hook":"","body":"","hashtags":["#..."]},"ar":{...},"ckb":{...}}',
  ].join('\n');
}

async function writeIdea(f, fetchImpl = fetch) {
  if (!config.GEMINI_API_KEY) return null;
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(f) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const ai = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  if (ai.joyful !== true || !REGIONS.includes(ai.region)) return null; // client: joyful news only
  const texts = {};
  for (const l of LANGS) {
    const t = ai[l] || {};
    if (!safe(t.hook, 70) || !safe(t.body, 400) || !safeTags(t.hashtags) || HYPE.test(t.hook + ' ' + t.body) || SAD.test(t.hook + ' ' + t.body)) return null;
    texts[l] = { hook: t.hook.trim(), body: t.body.trim(), hashtags: [...new Set(t.hashtags)] };
  }
  return { region: ai.region, texts };
}

/** Bank photo for the idea when it names one of our destinations: { key, file, credit }. */
function photoFor(f, rnd = Math.random) {
  const text = `${f.place || ''} ${f.title} ${f.summary}`.toLowerCase();
  const alias = { Sulaymaniyah: 'ISU', Kreta: 'HER', Zypern: 'LCA', Larnaka: 'LCA', Duhok: 'duhok', Zakho: 'zakho' };
  const keys = Object.entries(alias).filter(([n]) => text.includes(n.toLowerCase())).map(([, k]) => k);
  for (const [code, names] of Object.entries(CITY)) if (Object.values(names).some((n) => text.includes(String(n).toLowerCase().split(' (')[0]))) keys.push(code);
  for (const key of keys) {
    const photos = bank.readIndex(key).photos || [];
    if (!photos.length) continue;
    const top = [...photos].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8);
    const p = top[Math.floor(rnd() * top.length)];
    return { key: bank.keyOf({ to: { code: key } }), file: p.file, credit: p.credit || {} };
  }
  return null;
}

/** Today's ideas; collects and writes them once a day (or again when `force`). */
async function today({ force = false, fetchImpl = fetch, log = console.log } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const data = load();
  if (data.days[day] && !force) return data.days[day];
  const seen = new Set(data.seen);
  if (force && data.days[day]) for (const i of data.days[day].ideas) seen.add(i.factId);
  const facts = await collectFacts(fetchImpl, log);
  const ideas = [];
  const reserve = [];
  const coreTarget = Math.random() < 0.8 ? 2 : 1; // 2 or 1 of 3 per day: about 60 % over time
  const fits = (region) => region === 'general'
    || (CORE.includes(region) ? ideas.filter((i) => CORE.includes(i.region)).length < coreTarget
      : ideas.filter((i) => i.region === 'world').length < 3 - coreTarget);
  const make = (f, w) => ({ id: require('crypto').randomBytes(6).toString('hex'), factId: f.id, cat: f.cat, region: w.region, source: f.source, sourceId: f.sourceId,
    title: f.title, link: f.link, texts: w.texts, photo: photoFor(f), status: 'pending', createdAt: new Date().toISOString() });
  for (const f of pickIdeas(facts, seen, Math.random, 8)) { // reserves keep the regional mix
    if (ideas.length >= 3) break;
    let w = null;
    try { w = await writeIdea(f, fetchImpl); } catch (err) { log(`news idea ${f.id}: ${err.message}`); }
    if (!w) { seen.add(f.id); continue; }
    if (fits(w.region)) { ideas.push(make(f, w)); seen.add(f.id); } else reserve.push([f, w]);
  }
  for (const [f, w] of reserve) if (ideas.length < 3) { ideas.push(make(f, w)); seen.add(f.id); } // quiet days
  data.days[day] = { day, facts: facts.length, ideas };
  data.seen = [...seen];
  save(data);
  return data.days[day];
}

function setStatus(id, status) {
  const data = load();
  for (const d of Object.values(data.days)) {
    const idea = d.ideas.find((i) => i.id === id);
    if (idea) { idea.status = status; save(data); return idea; }
  }
  return null;
}

module.exports = { CORE, today, setStatus, pickIdeas, writeIdea, photoFor, buildPrompt, LANGS };
