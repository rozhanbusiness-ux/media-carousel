// ============================================================
//  studio/editorial-preview.js — print editorial ideas to the console
//  without saving anything (for review with the client):
//    docker exec media-carousel-app node studio/editorial-preview.js 6
// ============================================================

require('dotenv').config();
const { makeIdeas } = require('./editorial');

(async () => {
  const n = Math.min(Math.max(Number(process.argv[2]) || 6, 1), 9);
  const ideas = await makeIdeas(n, { log: (m) => console.error(m) });
  for (const [i, idea] of ideas.entries()) {
    console.log(`\n==================== ${i + 1}. ${idea.theme} · ${idea.region} · ${idea.place}, ${idea.country}`);
    for (const l of ['de', 'ar', 'ckb']) {
      const t = idea.texts[l];
      console.log(`\n--- ${l}\n${t.hook}\n\n${t.body}\n${t.hashtags.join(' ')}`);
    }
    console.log(`\nSources: ${idea.sources.map((s) => `${s.title} <${s.url}>`).join(' | ') || '-'}`);
    console.log(`Photo search: ${idea.photoQuery}`);
  }
  if (!ideas.length) console.log('No ideas (check GEMINI_API_KEY and the log above).');
})();
