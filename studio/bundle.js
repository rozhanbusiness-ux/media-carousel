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
const { renderSlide, PACKAGE_STYLES } = require('./render');
const sources = require('./photo-sources');
const bank = require('./bank');
const { generatePhoto, generateThemeCover, THEMES, enhancePhoto } = require('./image');
const { HOME } = require('./destinations');
const { rankPhotos } = require('./photo-rank');
const store = require('./store');
const covers = require('./covers');

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

// Magazine cover texts (client decision 2026-11-04). Badini words need a native speaker's review.
const MONTHS = {
  de: ['JANUAR', 'FEBRUAR', 'MÄRZ', 'APRIL', 'MAI', 'JUNI', 'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DEZEMBER'],
  ar: ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'],
  ckb: ['کانوونا پاشین', 'شوبات', 'ئادار', 'نیسان', 'گولان', 'حەزیران', 'تیرمەه', 'تەباخ', 'ئیلۆن', 'چریا پێشین', 'چریا پاشین', 'کانوونا پێشین'],
};
const THEME_TITLES = {
  autumn: { de: 'Herbst-Angebote', ar: 'عروض الخريف', ckb: 'ئۆفەرێن پاییزێ' },
  winter: { de: 'Winter-Angebote', ar: 'عروض الشتاء', ckb: 'ئۆفەرێن زڤستانێ' },
  spring: { de: 'Frühlings-Angebote', ar: 'عروض الربيع', ckb: 'ئۆفەرێن بهارێ' },
  summer: { de: 'Sommer-Angebote', ar: 'عروض الصيف', ckb: 'ئۆفەرێن هاڤینێ' },
  holidays: { de: 'Ferien-Angebote', ar: 'عروض العطلة', ckb: 'ئۆفەرێن پشوویێ' },
  families: { de: 'Familien-Angebote', ar: 'عروض العائلات', ckb: 'ئۆفەرێن خێزانان' },
  city: { de: 'Städtereisen', ar: 'رحلات المدن', ckb: 'گەشتێن باژێران' },
  eid: { de: 'Angebote zum Fest', ar: 'عروض العيد', ckb: 'ئۆفەرێن جەژنێ' },
  newroz: { de: 'Newroz-Angebote', ar: 'عروض نوروز', ckb: 'ئۆفەرێن نەورۆزێ' },
  lastminute: { de: 'Last Minute', ar: 'عروض اللحظة الأخيرة', ckb: 'لاست مینیت' },
};
const COVER_WORDS = {
  de: { issue: 'DIE AUSGABE DES MONATS', flights: 'FLUGANGEBOTE', packages: 'REISEANGEBOTE', from: 'ab', offers: 'Angebote' },
  ar: { issue: 'عدد هذا الشهر', flights: 'عروض الطيران', packages: 'عروض السفر', from: 'ابتداءً من', offers: 'عروض' },
  ckb: { issue: 'ژمارا ڤێ هەیڤێ', flights: 'ئۆفەرێن فرینێ', packages: 'ئۆفەرێن گەشتێ', from: '', offers: 'ئۆفەر' },
};
const TRIP_WORD = { de: 'Hin & zurück', ar: 'ذهاب وعودة', ckb: 'چوون و هاتن' };

/** Texts of the magazine cover: one destination (its name, departure cities) or a theme. */
function coverTexts(draft, lang, date = new Date()) {
  const w = COVER_WORDS[lang] || COVER_WORDS.de;
  const price = (p) => (w.from ? `${w.from} ` : '') + formatPrice(p);
  const min = Math.min(...draft.offers.map((o) => o.price));
  const one = singleDest(draft);
  const pkg = draft.bundleKind === 'package';
  const lines = one
    ? draft.offers.slice(0, 4).map((o) => [pkg ? o.hotel || local(o.to, lang) : local(o.from, lang), price(o.price)])
    : draft.offers.slice(0, 4).map((o) => [local(o.to, lang), price(o.price)]);
  const theme = require('./image').themeOf(draft.theme || 'auto', date);
  return {
    issueL: 'TRAVEL & TOURISM', issueR: `${(MONTHS[lang] || MONTHS.de)[date.getMonth()]} ${date.getFullYear()}`,
    kick: one ? (pkg ? w.packages : w.flights) : w.issue,
    title: one ? local(one.to, lang) : (THEME_TITLES[theme] || THEME_TITLES.autumn)[lang],
    sub: one ? price(min) + (!pkg && one.returnDate ? ' · ' + TRIP_WORD[lang] : '') : `${draft.offers.length} ${w.offers} · ${price(min)}`,
    lines,
  };
}
const titleOf = (draft, lang) => TITLES[draft.bundleKind || 'flight'][draft.titleIndex || 0][lang];
const CAPTION_HEAD = { de: 'Wähle dein nächstes Ziel:', ar: 'اختر وجهتك القادمة:', ckb: 'جهێ خۆ یێ دی هەلبژێرە:' };

const local = (p, lang) => cityName(p, lang);

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

/** Photo for one offer: a strictly ranked real photo (8+, retouched), else library, else the best real photo. */
async function photoFor(offer, used, queriesFor, choosePhoto) {
  const [fromBank] = bank.pick(offer, 1, used); // photo bank first (client-approved photos)
  if (fromBank) { used.add(fromBank.id); bank.markUsed(offer, fromBank); return { file: null, pexelsId: fromBank.id, dataUri: fromBank.dataUri, pos: fromBank.pos, credit: fromBank.credit }; }
  const lib = choosePhoto(offer);
  let list = [];
  try { list = await sources.candidates(offer, queriesFor, used, 8); } catch (err) { console.error('studio bundle photos:', err.message); }
  const ranked = await rankPhotos(list, [offer.to.name, offer.country].filter(Boolean).join(', '), fetch, offer.kind || 'flight');
  // Strict: a magazine-level real photo (8+), retouched; else our library; else the best one found.
  const best = ranked.find((c) => c.score != null && c.score >= 8);
  if (best) {
    used.add(best.id);
    const raw = await sources.download(best.url);
    let dataUri = raw;
    try { dataUri = await enhancePhoto(raw); } catch (err) { console.error('studio enhance:', err.message); }
    return { file: null, pexelsId: best.id, dataUri, pos: `${Number.isInteger(best.x) ? best.x : 50}% 50%` };
  }
  if (lib && !used.has(lib.file)) { used.add(lib.file); return { file: lib.file, pexelsId: null, dataUri: lib.dataUri }; }
  // Last resort: the best scored photo (an error here blocked whole multi-offer posts).
  const any = ranked.find((c) => c.score != null && c.score >= 6) || ranked.find((c) => c.score != null);
  if (!any) return null;
  used.add(any.id);
  return { file: null, pexelsId: any.id, dataUri: await sources.download(any.url), pos: `${Number.isInteger(any.x) ? any.x : 50}% 50%` };
}

// Cover photo: about the offer TYPE, never a destination (client decision). The client's saved
// covers come first (rotating), else the best-ranked Pexels photo (studio/covers.js).
async function coverPhoto(kind, used) {
  return covers.next(kind) || (await covers.auto(kind, used));
}

// One destination in the whole post (e.g. Erbil from several cities): the cover shows that place.
const singleDest = (draft) => {
  const keys = new Set(draft.offers.map((o) => (draft.bundleKind === 'package' ? o.country || o.to.name : o.to.code || o.to.name)));
  return keys.size === 1 ? draft.offers[0] : null;
};
/** Cover photo: panorama of the single destination (never the departure city), else the theme photo. */
async function aiCover(draft, fresh = false) {
  const one = singleDest(draft);
  if (one) return generatePhoto({ kind: one.kind || 'flight', to: one.to, country: one.country || '' });
  return generateThemeCover(draft.theme || 'auto', fresh);
}

/** AI photos for the cover (n = -1) and every offer, two at a time (client: AI first, one go).
 *  Writes each photo that succeeds; returns the slots that failed. */
async function aiPhotos(draft, report = () => {}) {
  const total = draft.offers.length + 1; // + cover (-1); the closing slide is a fixed design
  const failed = [];
  let done = 0;
  const one = async (n) => {
    try {
      const dataUri = n < 0 ? await aiCover(draft) : await generatePhoto(draft.offers[n]);
      if (n >= 0) sources.use(draft.offers[n], null, dataUri);
      fs.writeFileSync(slotPath(draft, n), dataUri);
      if (n >= 0 && draft.photoPos) draft.photoPos[n] = null;
    } catch (err) { console.error('studio bundle ai:', err.message); failed.push(n); }
    report(++done, total);
  };
  const queue = [-1, ...draft.offers.map((_, n) => n)];
  await Promise.all([0, 1].map(async () => { while (queue.length) await one(queue.shift()); }));
  return failed;
}

/** New bundle: AI photos first; a slot whose AI photo fails gets a real photo instead. */
async function pickPhotosAiFirst(draft, queriesFor, choosePhoto) {
  draft.pexelsIds = []; draft.photoPos = []; draft.photoCredits = [];
  const failed = await aiPhotos(draft);
  if (!failed.length) return;
  const used = new Set(store.listDrafts().flatMap((d) => [d.pexelsId, ...(d.pexelsIds || []), d.photoFile]).filter(Boolean));
  for (const n of failed) {
    const p = n === -1 ? await coverPhoto(draft.bundleKind || 'flight', used) : await photoFor(draft.offers[n], used, queriesFor, choosePhoto);
    if (!p) throw new Error(n === -1 ? 'Kein Cover-Foto (KI fehlgeschlagen) – bitte erneut versuchen.' : `Kein Foto für ${draft.offers[n].to.name} – bitte erneut versuchen.`);
    fs.writeFileSync(slotPath(draft, n), p.dataUri);
    if (n >= 0) { draft.photoPos[n] = p.pos || null; draft.photoCredits[n] = p.credit || null; }
  }
}

async function pickPhotos(draft, queriesFor, choosePhoto) {
  const used = new Set(store.listDrafts().flatMap((d) => [d.pexelsId, ...(d.pexelsIds || []), d.photoFile]).filter(Boolean));
  for (const id of draft.pexelsIds || []) used.add(id); // "new photos" shows other ones
  draft.pexelsIds = [];
  draft.photoPos = [];
  draft.photoCredits = [];
  for (let n = 0; n < draft.offers.length; n++) {
    const p = await photoFor(draft.offers[n], used, queriesFor, choosePhoto);
    if (!p) throw new Error(`Kein Foto für ${draft.offers[n].to.name} gefunden – bitte erneut versuchen oder das Angebot weglassen.`);
    fs.writeFileSync(photoPath(draft.id, n), p.dataUri);
    sources.use(draft.offers[n], p.pexelsId != null ? p.pexelsId : (p.file ? 'lib:' + p.file : null), p.dataUri);
    draft.pexelsIds.push(p.pexelsId || p.file);
    draft.photoPos[n] = p.pos || null; // horizontal crop around the subject (landscape photos)
    draft.photoCredits = [...(draft.photoCredits || []).slice(0, n), p.credit || null];
  }
  const cover = await coverPhoto(draft.bundleKind || 'flight', used);
  if (!cover) throw new Error('Kein Cover-Foto gefunden – bitte unter „📸 Cover-Fotos“ eines speichern.');
  fs.writeFileSync(photoPath(draft.id, 'cover'), cover.dataUri);
  draft.pexelsIds.push(cover.pexelsId);
}

function postFor(o, lang, photo, style = 'flight') {
  const card = o.kind === 'package' ? cardFor(o, lang, formatPrice) : null;
  return {
    style, lang, photo, bundle: true, destination: local(o.to, lang), hook: '',
    from: o.from ? { city: local(o.from, lang), code: o.from.code || '' } : { city: '', code: '' },
    to: { city: local(o.to, lang), code: o.to.code || '' },
    dates: o.kind === 'package' ? '' : formatDate(o.departureDate) + (o.returnDate ? ' – ' + formatDate(o.returnDate) : ''),
    roundTrip: o.kind !== 'package' && !!o.returnDate,
    price: o.price, kind: o.kind, card, country: card && o.country ? countryName(o.country, lang) : '',
  };
}

async function renderBundle(draft) {
  const photos = draft.offers.map((_, n) => fs.readFileSync(photoPath(draft.id, n), 'utf8'));
  let coverImg = '';
  try { coverImg = fs.readFileSync(photoPath(draft.id, 'cover'), 'utf8'); } catch { /* older draft */ }
  const stamp = Date.now().toString(36);
  const versions = [];
  for (const lang of draft.langs) {
    const posts = draft.offers.map((o, n) => ({ ...postFor(o, lang, photos[n], PACKAGE_STYLES.includes(draft.style) ? draft.style : 'flight'), photoPosition: (draft.photoPos || [])[n] || '' }));
    const title = titleOf(draft, lang);
    // Never a destination photo on the cover (client rule).
    const cover = { ...posts[0], isCover: true, photo: coverImg, photoPosition: '', kind: 'flight', card: null, country: '', destination: title,
      cover: coverTexts(draft, lang), labels: { kicker: COVER[lang].kicker, swipe: COVER[lang].swipe } };
    // Last slide: the fixed brand slide (no photo, client decision 2026-11-04).
    const slides = [[cover, 1], ...posts.map((p) => [p, 2]), [{ ...posts[0], photo: '' }, 3]];
    const files = [];
    for (const size of require('./format').sizes()) {
      for (let i = 0; i < slides.length; i++) {
        const name = `studio_${draft.id}_${stamp}_${lang}_${size}_${i + 1}.jpg`;
        fs.writeFileSync(path.join(OUTPUT, name), await renderSlide(slides[i][0], size, slides[i][1]));
        files.push({ size, slide: i + 1, url: '/output/' + name });
      }
    }
    const base = (draft.texts[lang] || {}).caption || bundleCaption(draft.offers, lang, titleOf(draft, lang));
    const credit = bank.creditLine(draft.photoCredits);
    versions.push({ lang, caption: credit && !base.includes(credit) ? `${base}\n\n${credit}` : base, aiWritten: false, files });
  }
  for (const v of draft.versions || []) for (const f of v.files) {
    try { fs.unlinkSync(path.join(OUTPUT, path.basename(f.url))); } catch { /* already gone */ }
  }
  draft.versions = versions;
  draft.updatedAt = new Date().toISOString();
  return store.upsertDraft(draft);
}

/** Bundle draft from offer keys of ONE kind (client rule: never mix flights, packages, cruises, ...). */
async function createBundleDraft({ kind, keys, style, theme, langs, date, liveOffers, queriesFor, choosePhoto }) {
  if (!KINDS.includes(kind)) throw new Error('unknown kind');
  if (!Array.isArray(keys) || keys.length < MIN || keys.length > MAX) throw new Error(`Bitte ${MIN} bis ${MAX} Angebote wählen.`);
  const all = await liveOffers(kind);
  if (keys.some((k) => (kind === 'package') !== /^m?p-/.test(k))) throw new Error('Nur eine Angebotsart pro Beitrag.');
  const offers = keys.map((k) => all.find((o) => offerKey(o) === k));
  if (offers.some((o) => !o || (o.kind || 'flight') !== kind)) throw new Error('Ein Angebot ist nicht mehr verfügbar – bitte Liste neu laden.');
  // Each destination once; packages: each COUNTRY once (client rule).
  // Flights home (Erbil from several German cities, client 2026-11-04): unique per route, not per destination.
  const place = (o) => (kind === 'package' ? o.country || o.to.name
    : HOME.has(o.to.code) ? `${o.from.code || o.from.name}-${o.to.code}` : o.to.code || o.to.name);
  if (new Set(offers.map(place)).size !== offers.length) throw new Error(kind === 'package' ? 'Jedes Land nur einmal pro Beitrag.' : 'Jede Destination nur einmal pro Beitrag.');
  const draft = {
    id: crypto.randomBytes(6).toString('hex'), createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style: PACKAGE_STYLES.includes(style) ? style : 'flight', source: 'specials', bundle: true, bundleKind: kind, theme: THEMES.includes(theme) ? theme : 'auto', // style/theme chosen before the photos (client)
    titleIndex: Math.floor(Math.random() * TITLES[kind].length), offers, offer: offers[0], langs, texts: {}, versions: [],
  };
  for (const l of langs) draft.texts[l] = { caption: bundleCaption(offers, l, titleOf(draft, l)) };
  await pickPhotosAiFirst(draft, queriesFor, choosePhoto);
  return renderBundle(draft);
}

// Photo of one slide: n = offer index (0..), or -1 for the cover.
// n = offer index, -1 = cover, -2 = closing slide (its own AI photo, client: never the cover again)
const slotPath = (draft, n) => photoPath(draft.id, n === -1 ? 'cover' : n === -2 ? 'end' : n);
const validSlot = (draft, n) => Number.isInteger(n) && n >= -1 && n < draft.offers.length;
const validAiSlot = validSlot;

/** Ranked photo suggestions for one slide; kept on the draft so only suggested photos can be picked. */
async function slotCandidates(draft, n, queriesFor) {
  const used = new Set(draft.pexelsIds || []);
  for (const c of (draft.bundlePick && draft.bundlePick.n === n ? draft.bundlePick.list : [])) used.add(c.id); // "more" shows new ones
  let ranked;
  if (n === -1) ranked = (await covers.suggest(draft.bundleKind || 'flight')).map((c) => ({ ...c, cover: true }));
  else {
    const o = draft.offers[n];
    let list = [];
    try { list = await sources.candidates(o, queriesFor, used, 15); } catch (err) { console.error('studio bundle photos:', err.message); }
    ranked = await rankPhotos(list, [o.to.name, o.country].filter(Boolean).join(', '), fetch, o.kind || 'flight');
  }
  if (!ranked.length) throw new Error('Keine weiteren Fotos gefunden – bitte eigenes Foto hochladen.');
  draft.bundlePick = { n, list: ranked.map((c) => ({ id: c.id, url: c.url || '', thumb: c.thumb, score: c.score, why: c.why || '', cover: !!c.cover })) };
}

/** Bundle actions: 'langs', 'all' (new photos), 'style', 'bundle-photos' (show suggestions for a slide),
 *  'bundle-photo-pick' ({ n, id }), 'bundle-photo-upload' ({ n, data }), 'bundle-photo-ai' (n; -1 = AI cover),
 *  'bundle-photo-ai-all' (value = optional progress callback). */
async function regenerateBundle(draft, what, value, queriesFor, choosePhoto, LANGS) {
  if (what === 'bundle-photos') {
    if (!validSlot(draft, value)) throw new Error('bad slide');
    await slotCandidates(draft, value, queriesFor);
    return store.upsertDraft(draft); // nothing to render until a photo is picked
  }
  if (what === 'bundle-photo-pick' || what === 'bundle-photo-upload' || what === 'bundle-photo-ai') {
    const n = what === 'bundle-photo-ai' ? value : value && value.n;
    if (!(what === 'bundle-photo-ai' ? validAiSlot(draft, n) : validSlot(draft, n))) throw new Error('bad slide');
    let dataUri;
    if (what === 'bundle-photo-ai') {
      dataUri = n < 0 ? await aiCover(draft, true) : await generatePhoto(draft.offers[n]);
    } else if (what === 'bundle-photo-upload') dataUri = value.data;
    else {
      const c = draft.bundlePick && draft.bundlePick.n === n && draft.bundlePick.list.find((x) => x.id === value.id);
      if (!c) throw new Error('Foto nicht mehr verfügbar – bitte Vorschläge neu laden.');
      const url = c.cover ? covers.urlOf(draft.bundleKind || 'flight', c.id) : c.url;
      if (!url) throw new Error('Foto nicht mehr verfügbar – bitte Vorschläge neu laden.');
      dataUri = await sources.download(url);
      draft.pexelsIds = [...(draft.pexelsIds || []), c.id];
    }
    if (n >= 0) sources.use(draft.offers[n], what === 'bundle-photo-pick' ? value.id : null, dataUri);
    fs.writeFileSync(slotPath(draft, n), dataUri);
    if (n >= 0 && draft.photoPos) draft.photoPos[n] = null; // new photo: centred
    draft.bundlePick = null;
  } else if (what === 'bundle-photo-ai-all') {
    const failed = await aiPhotos(draft, typeof value === 'function' ? value : () => {});
    if (failed.length === draft.offers.length + 1) throw new Error('KI-Fotos fehlgeschlagen – bitte später erneut versuchen.');
    draft.warning = failed.length ? `Kein KI-Foto für: ${failed.map((n) => (n === -1 ? 'Cover' : draft.offers[n].to.name)).join(', ')} – bitte einzeln mit 🤖 KI erneut versuchen.` : '';
    draft.bundlePick = null;
  } else if (what === 'style') {
    if (!PACKAGE_STYLES.includes(value)) throw new Error('Für Sammel-Beiträge: Glas, Magazin oder Schlicht.');
    draft.style = value;
  } else if (what === 'langs') {
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
  for (const slot of ['cover', 'end']) {
    try { fs.unlinkSync(photoPath(draft.id, slot)); } catch { /* none */ }
  }
}

module.exports = { KINDS, TITLES, MIN, MAX, bundleCaption, offerLine, coverTexts, createBundleDraft, regenerateBundle, deleteBundlePhotos };
