// ============================================================
//  studio/bank-generate.js — generate the AI destination photos once:
//    node studio/bank-generate.js IST AYT DXB LCA ATH SOF CAI EBL ISU BGW
//  Writes a review page (output/bank-ai-<random>.html) with the images.
// ============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bank = require('./bank');
const bankAi = require('./bank-ai');

const PLACES = { IST: 'Istanbul, Turkey', AYT: 'Antalya, Turkey', DXB: 'Dubai, United Arab Emirates', LCA: 'Larnaca, Cyprus',
  ATH: 'Athens, Greece', SOF: 'Sofia, Bulgaria', CAI: 'Cairo, Egypt', EBL: 'Erbil, Kurdistan Region of Iraq',
  ISU: 'Sulaymaniyah, Kurdistan Region of Iraq', BGW: 'Baghdad, Iraq' };
const OUT = path.join(__dirname, '..', 'output');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

(async () => {
  const keys = process.argv.slice(2).filter((k) => PLACES[k]);
  if (!keys.length) { console.log('usage: node studio/bank-generate.js ' + Object.keys(PLACES).join(' ')); process.exitCode = 1; return; }
  const tag = crypto.randomBytes(6).toString('hex');
  const dir = path.join(OUT, `bank-ai-${tag}`);
  fs.mkdirSync(dir, { recursive: true });
  let html = '';
  for (const k of keys) {
    const r = await bankAi.build(k, PLACES[k]);
    console.log(`${k}: ${r.added} new, ${r.total} in bank`);
    const cells = bank.readIndex(k).photos.filter((p) => p.ai).map((p) => {
      fs.copyFileSync(path.join(bank.entryDir(k), p.file), path.join(dir, `${k}-${p.file}`));
      return `<figure><img src="bank-ai-${tag}/${esc(k)}-${esc(p.file)}" loading="lazy"><figcaption>${esc(p.why)}</figcaption></figure>`;
    }).join('');
    html += `<h2>${esc(k)} – ${esc(PLACES[k])}</h2><div class="grid">${cells}</div>`;
  }
  fs.writeFileSync(path.join(OUT, `bank-ai-${tag}.html`), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>KI-Bildbank</title>
<style>body{font-family:system-ui;background:#0b1530;color:#fff;margin:24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
figure{margin:0;background:#16234a;border-radius:10px;overflow:hidden}img{width:100%;aspect-ratio:9/16;object-fit:cover;display:block}figcaption{padding:8px;font-size:13px;opacity:.8}</style>
<h1>KI-Bildbank – zur Prüfung</h1>${html}`);
  console.log(`REPORT: /output/bank-ai-${tag}.html`);
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
