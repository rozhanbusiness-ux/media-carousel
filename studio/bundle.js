// ============================================================
//  studio/bundle.js — "Mehrere Angebote": one post with 2-6 offers
//  Slides: cover (first offer's photo, all destination names), one
//  details slide per offer (its own photo), closing slide (WhatsApp +
//  slogan). Max 8 slides. Glass template only. Captions are built by
//  code (prices, dates and routes never come from the AI).
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cardFor, countryName, offerKey } = require('./packages');
const { formatDate, formatPrice, cityName, BASE_TAGS, FIXED } = require('./captions');
const { renderSlide } = require('./render');
const { candidates: pexelsCandidates, download: pexelsDownload } = require('./pexels');
const { rankPhotos } = require('./photo-rank');
const store = require('./store');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const CACHE = path.join(ROOT, 'cache');
const MIN = 2;
const MAX = 6;
const photoPath = (id, n) => path.join(CACHE, `studio-photo-${id}-${n}.txt`);

const COVER = {
  de: { kicker: 'Unsere Auswahl', swipe: 'Wischen für alle Angebote →' },
  ar: { kicker: 'اختيارنا لك', swipe: '← اسحب لكل العروض' },
  ckb: { kicker: 'هەلبژارتنا مە', swipe: '← بکێشە بۆ هەمی پێشنیاران' },
};
// Cover titles per offer kind (client approved all; one is picked at random per post).
const TITLES = {
  flight: [
    { de: 'Ziele, die auf dich warten', ar: 'وجهات تنتظرك', ckb: 'جهێن چاڤەڕێیا تە دکەن' },
    { de: 'Handverlesene Flüge', ar: 'رحلات مختارة بعناية', ckb: 'گەشتێن ب هویری هاتینە هەلبژارتن' },
    { de: 'Abheben nach …', ar: 'حلّق إلى…', ckb: 'بفڕە بۆ…' },
  ],
  package: [
    { de: 'Urlaub, den du verdienst', ar: 'عطلات تستحقها', ckb: 'بێهنڤەدانا تو هێژایی' },
    { de: 'Handverlesene Auszeiten', ar: 'إقامات مختارة بعناية', ckb: 'مانێن ب هویری هاتینە هەلبژارتن' },
    { de: 'Momente, die bleiben', ar: 'لحظات لا تُنسى', ckb: 'ساتێن ناهێنە ژبیرکرن' },
  ],
};
const KINDS = Object.keys(TITLES);
const titleOf = (draft, lang) => TITLES[draft.bundleKind || 'flight'][draft.titleIndex || 0][lang];
const CAPTION_HEAD = { de: 'Wähle dein nächstes Ziel:', ar: 'اختر وجهتك القادمة:', ckb: 'جهێ خۆ یێ دی هەلبژێرە:' };

const local = (p, lang) => (lang === 'de' ? p.name : cityName(p, lang));

/** One caption line per offer, e.g. "✈️ Düsseldorf → Istanbul · 12.11. · ab 184,99 €". */
function offerLine(o, lang) {
  const f = FIXED[lang];
  const price = `${f.from} ${formatPrice(o.price)}`;
  if (o.kind === 'package') return `🏨 ${local(o.to, lang)}${o.country ? ', ' + countryName(o.country, lang) : ''} · ${o.hotel} · ${price}`;
  return `✈️ ${f.route({ from: local(o.from, lang), to: local(o.to, lang) })} · ${formatDate(o.departureDate)} · ${price}`;
}

function bundleCaption(offers, lang, title = '') {
  const f = FIXED[lang];
  const tags = [...(BASE_TAGS[lang] || [])];
  return [...(title ? [title.replace(/\s*…$/, ''), ''] : []), CAPTION_HEAD[lang], '', ...offers.map((o) => offerLine(o, lang)), '', f.cta, '', f.notice, '', tags.join(' ')].join('\n');
}

/** Best real photo for one offer: library first (passed in), else the top-ranked Pexels photo. */
async function photoFor(offer, used, queriesFor, choosePhoto) {
  const lib = choosePhoto(offer);
  if (lib && !used.has(lib.file)) { used.add(lib.file); return { file: lib.file, pexelsId: null, dataUri: lib.dataUri }; }
  let list = [];
  try { list = await pexelsCandidates(queriesFor(offer), used, 8); } catch (err) { console.error('studio bundle pexels:', err.message); }
  const ranked = await rankPhotos(list, [offer.to.name, offer.country].filter(Boolean).join(', '));
  const best = ranked.find((c) => c.score == null || c.score >= 5) || ranked[0];
  if (!best) return null;
  used.add(best.id);
  return { file: null, pexelsId: best.id, dataUri: await pexelsDownload(best.url) };
}

async function pickPhotos(draft, queriesFor, choosePhoto) {
  const used = new Set(store.listDrafts().flatMap((d) => [d.pexelsId, ...(d.pexelsIds || []), d.photoFile]).filter(Boolean));
  for (const id of draft.pexelsIds || []) used.add(id); // "new photos" shows other ones
  draft.pexelsIds = [];
  for (let n = 0; n < draft.offers.length; n++) {
    const p = await photoFor(draft.offers[n], used, queriesFor, choosePhoto);
    if (!p) throw new Error(`Kein Foto für ${draft.offers[n].to.name} gefunden.`);
    fs.writeFileSync(photoPath(draft.id, n), p.dataUri);
    draft.pexelsIds.push(p.pexelsId || p.file);
  }
}

function postFor(o, lang, photo) {
  const card = o.kind === 'package' ? cardFor(o, lang, formatPrice) : null;
  return {
    style: 'flight', lang, photo, bundle: true, destination: local(o.to, lang), hook: '',
    from: o.from ? { city: local(o.from, lang), code: o.from.code || '' } : { city: '', code: '' },
    to: { city: local(o.to, lang), code: o.to.code || '' },
    dates: o.kind === 'package' ? '' : formatDate(o.departureDate) + (o.returnDate ? ' – ' + formatDate(o.returnDate) : ''),
    price: o.price, kind: o.kind, card, country: card && o.country ? countryName(o.country, lang) : '',
  };
}

async function renderBundle(draft) {
  const photos = draft.offers.map((_, n) => fs.readFileSync(photoPath(draft.id, n), 'utf8'));
  const stamp = Date.now().toString(36);
  const versions = [];
  for (const lang of draft.langs) {
    const posts = draft.offers.map((o, n) => postFor(o, lang, photos[n]));
    const title = titleOf(draft, lang);
    const cover = { ...posts[0], kind: 'flight', card: null, country: '', destination: title,
      hook: draft.offers.map((o) => local(o.to, lang)).join(' · '), labels: { kicker: COVER[lang].kicker, swipe: COVER[lang].swipe } };
    const slides = [[cover, 1], ...posts.map((p) => [p, 2]), [posts[0], 3]];
    const files = [];
    for (const size of ['story', 'portrait']) {
      for (let i = 0; i < slides.length; i++) {
        const name = `studio_${draft.id}_${stamp}_${lang}_${size}_${i + 1}.jpg`;
        fs.writeFileSync(path.join(OUTPUT, name), await renderSlide(slides[i][0], size, slides[i][1]));
        files.push({ size, slide: i + 1, url: '/output/' + name });
      }
    }
    versions.push({ lang, caption: (draft.texts[lang] || {}).caption || bundleCaption(draft.offers, lang, titleOf(draft, lang)), aiWritten: false, files });
  }
  for (const v of draft.versions || []) for (const f of v.files) {
    try { fs.unlinkSync(path.join(OUTPUT, path.basename(f.url))); } catch { /* already gone */ }
  }
  draft.versions = versions;
  draft.updatedAt = new Date().toISOString();
  return store.upsertDraft(draft);
}

/** Bundle draft from offer keys of ONE kind (client rule: never mix flights, packages, cruises, ...). */
async function createBundleDraft({ kind, keys, langs, date, liveOffers, queriesFor, choosePhoto }) {
  if (!KINDS.includes(kind)) throw new Error('unknown kind');
  if (!Array.isArray(keys) || keys.length < MIN || keys.length > MAX) throw new Error(`Bitte ${MIN} bis ${MAX} Angebote wählen.`);
  const all = await liveOffers(kind);
  if (keys.some((k) => (kind === 'package') !== k.startsWith('p-'))) throw new Error('Nur eine Angebotsart pro Beitrag.');
  const offers = keys.map((k) => all.find((o) => offerKey(o) === k));
  if (offers.some((o) => !o || (o.kind || 'flight') !== kind)) throw new Error('Ein Angebot ist nicht mehr verfügbar – bitte Liste neu laden.');
  if (new Set(offers.map((o) => o.to.code || o.to.name)).size !== offers.length) throw new Error('Jede Destination nur einmal pro Beitrag.');
  const draft = {
    id: crypto.randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style: 'flight', source: 'specials', bundle: true, bundleKind: kind,
    titleIndex: Math.floor(Math.random() * TITLES[kind].length), offers, offer: offers[0], langs, texts: {}, versions: [],
  };
  for (const l of langs) draft.texts[l] = { caption: bundleCaption(offers, l, titleOf(draft, l)) };
  await pickPhotos(draft, queriesFor, choosePhoto);
  return renderBundle(draft);
}

/** Bundle actions: 'langs' (value: list) or 'all' (new photos and texts). */
async function regenerateBundle(draft, what, value, queriesFor, choosePhoto, LANGS) {
  if (what === 'langs') {
    if (!Array.isArray(value) || !value.length || value.length > 3 || !value.every((l) => LANGS.includes(l))) throw new Error('bad languages');
    draft.langs = [...new Set(value)];
  } else if (what === 'all') {
    await pickPhotos(draft, queriesFor, choosePhoto);
    draft.texts = {};
  } else throw new Error('Bei Sammel-Beiträgen nur Sprachen oder „Alles neu“.');
  for (const l of draft.langs) if (!(draft.texts[l] || {}).caption) draft.texts[l] = { caption: bundleCaption(draft.offers, l, titleOf(draft, l)) };
  draft.status = 'pending';
  return renderBundle(draft);
}

function deleteBundlePhotos(draft) {
  for (let n = 0; n < (draft.offers || []).length; n++) {
    try { fs.unlinkSync(photoPath(draft.id, n)); } catch { /* none */ }
  }
}

module.exports = { KINDS, TITLES, MIN, MAX, bundleCaption, offerLine, createBundleDraft, regenerateBundle, deleteBundlePhotos };
