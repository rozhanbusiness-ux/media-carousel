// ============================================================
//  studio/news-ideas.js — "Ideen des Tages": three post ideas a day
//  from the editor engine (editorial.js): one place and one sharp
//  angle per post (mostly Europe), sometimes a practical Ratgeber
//  post; single source Wikivoyage (CC BY-SA 4.0, always credited). Nothing is published from here: the client
//  approves or rejects. Stored in cache/studio-news.txt (mounted
//  volume, not in git).
// ============================================================

const fs = require('fs');
const path = require('path');
const bank = require('./bank');
const { CITY } = require('./captions');
const editorial = require('./editorial');

const FILE = path.join(__dirname, '..', 'cache', 'studio-news.txt');

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { days: {}, topics: [] }; } }
function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const days = Object.keys(data.days).sort().slice(-30); // keep 30 days
  data.days = Object.fromEntries(days.map((d) => [d, data.days[d]]));
  data.topics = (data.topics || []).slice(-300);
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data, null, 1));
  fs.renameSync(FILE + '.tmp', FILE);
}

/** Bank photo when the idea is about one of our destinations: { key, file, credit }. */
function photoFor(idea, rnd = Math.random) {
  const text = `${idea.place || ''} ${idea.topic || ''}`.toLowerCase();
  const alias = { sulaymaniyah: 'ISU', crete: 'HER', kreta: 'HER', cyprus: 'LCA', larnaca: 'LCA', duhok: 'duhok', zakho: 'zakho' };
  const keys = Object.entries(alias).filter(([n]) => text.includes(n)).map(([, k]) => k);
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

/** Today's ideas; researched and written once a day (or again when `force`). */
async function today({ force = false, fetchImpl = fetch, log = console.log } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const data = load();
  if (data.days[day] && !force) return data.days[day];
  data.topics = data.topics || [];
  const made = await editorial.makeIdeas(3, { avoid: data.topics, fetchImpl, log });
  const ideas = made.map((m) => ({
    id: require('crypto').randomBytes(6).toString('hex'), kind: m.kind, type: m.type, topic: m.topic, place: m.place,
    angle: m.angle, evidence: m.evidence, sources: m.sources, photoQuery: m.photoQuery, texts: m.texts, photo: photoFor(m), status: 'pending', createdAt: new Date().toISOString(),
  }));
  data.topics.push(...ideas.map((i) => i.topic));
  data.days[day] = { day, ideas: [...ideas, ...(force && data.days[day] ? data.days[day].ideas.filter((i) => i.status === 'approved') : [])] };
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

module.exports = { today, setStatus, photoFor };
