// ============================================================
//  studio/bank-build.js — build the photo bank by hand or as a night job:
//    node studio/bank-build.js EBL ISU AYT DXB BCN
//  Writes a review page to output/bank-report-<random>.html (thumbnails,
//  scores, credits) and prints its path.
// ============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bank = require('./bank');

// Destinations of the first test round (name, country as the ranking sees them).
const PLACES = {
  EBL: ['Erbil', 'Kurdistan, Irak'], ISU: ['Sulaymaniyah', 'Kurdistan, Irak'], AYT: ['Antalya', 'Türkei'],
  DXB: ['Dubai', 'Vereinigte Arabische Emirate'], BCN: ['Barcelona', 'Spanien'], IST: ['Istanbul', 'Türkei'],
  PMI: ['Mallorca', 'Spanien'], CAI: ['Kairo', 'Ägypten'], HRG: ['Hurghada', 'Ägypten'], LON: ['London', 'Großbritannien'],
  PAR: ['Paris', 'Frankreich'], ROM: ['Rom', 'Italien'], AMS: ['Amsterdam', 'Niederlande'], VIE: ['Wien', 'Österreich'],
  TBS: ['Tiflis', 'Georgien'], LCA: ['Larnaka', 'Zypern'], HER: ['Kreta', 'Griechenland'], BKK: ['Bangkok', 'Thailand'],
  LIS: ['Lissabon', 'Portugal'], BGW: ['Bagdad', 'Irak'], duhok: ['Duhok', 'Kurdistan, Irak'], zakho: ['Zakho', 'Kurdistan, Irak'],
};
// English names for the search (stock sites index English words).
const SEARCH_NAME = { CAI: 'Cairo', LON: 'London', ROM: 'Rome', VIE: 'Vienna', TBS: 'Tbilisi', LCA: 'Larnaca', HER: 'Crete', LIS: 'Lisbon', BGW: 'Baghdad', PMI: 'Mallorca' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

(async () => {
  const keys = process.argv.slice(2).filter((k) => PLACES[k]);
  if (!keys.length) { console.log('usage: node studio/bank-build.js ' + Object.keys(PLACES).join(' ')); process.exit(1); }
  const results = [];
  for (const k of keys) {
    const [name, country] = PLACES[k];
    results.push(await bank.build(bank.target(k, SEARCH_NAME[k] || name, 'flight', country)));
  }
  const rows = results.map((r) => {
    const kept = new Set(bank.readIndex(r.key).photos.map((p) => p.id));
    const cells = r.top.map((c) => `<figure class="${kept.has(c.id) ? 'kept' : ''}"><img src="${esc(c.thumb)}" loading="lazy" referrerpolicy="no-referrer">
      <figcaption><b>${c.score ?? '–'}/10</b> ${esc(c.shot || '')} · ${esc(c.why || '')}<br><small>${esc((c.credit || {}).source)} – ${esc((c.credit || {}).author)}</small></figcaption></figure>`).join('');
    return `<h2>${esc(r.key)} – ${r.total} im Bank (${r.added} neu), ${r.scored}/${r.candidates} bewertet</h2><div class="grid">${cells}</div>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bildbank</title>
<style>body{font-family:system-ui;background:#0b1530;color:#fff;margin:24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
figure{margin:0;background:#16234a;border-radius:10px;overflow:hidden;opacity:.55}figure.kept{opacity:1;outline:3px solid #e6c25a}
img{width:100%;height:220px;object-fit:cover;display:block}figcaption{padding:8px;font-size:13px}small{opacity:.7}</style>
<h1>Bildbank – Test (gold = aufgenommen)</h1>${rows}`;
  const name = `bank-report-${crypto.randomBytes(6).toString('hex')}.html`;
  fs.writeFileSync(path.join(__dirname, '..', 'output', name), html);
  console.log('REPORT: /output/' + name);
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
