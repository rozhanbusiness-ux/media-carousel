// ============================================================
//  studio/planner.js — build and re-build drafts
//  A draft = offer + style + languages + photo + texts. Each part can
//  be regenerated on its own (photo, texts, style, languages) and the
//  slides are re-rendered. Nothing is published from here.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFlightOffers, getPackageOffers } = require('./offers');
const { toDraftOffer, offerKey, countryName, cardFor } = require('./packages');
const { buildCaption, formatDate, formatPrice, cityName, LANGS } = require('./captions');
const { renderSlide, STYLE_BY_WEEKDAY, STYLES } = require('./render');
const { generatePhoto } = require('./image');
const { candidates: pexelsCandidates, download: pexelsDownload } = require('./pexels');
const { rankPhotos } = require('./photo-rank');
const store = require('./store');
const ownOffers = require('./own-offers');
const { createBundleDraft: buildBundle, regenerateBundle, deleteBundlePhotos } = require('./bundle');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const CACHE = path.join(ROOT, 'cache');
const PHOTOS = path.join(__dirname, 'photos');
const LIBRARY = path.join(CACHE, 'studio-library'); // approved photos, kept across deploys (cache volume)
const REPEAT_DAYS = 3;
const KURDISH_DAYS = new Set([1, 3, 5]);

const defaultLangs = (date) => ['de', KURDISH_DAYS.has(date.getDay()) ? 'ckb' : 'ar'];
const photoPath = (id) => path.join(CACHE, `studio-photo-${id}.txt`);

/** A library photo for the destination (studio/photos/<IATA>-n.jpg), least recently used first. */
function libraryPhoto(code, used) {
  const files = [];
  for (const dir of [PHOTOS, LIBRARY]) {
    try {
      for (const f of fs.readdirSync(dir)) if (code && f.startsWith(code + '-') && /\.(jpe?g|png|webp)$/i.test(f)) files.push([dir, f]);
    } catch { /* none */ }
  }
  const fresh = files.filter(([, f]) => !used.has(f));
  if (!fresh.length) return null;
  const [dir, file] = fresh[0];
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  return { file, pexelsId: null, dataUri: `data:image/${ext};base64,` + fs.readFileSync(path.join(dir, file)).toString('base64') };
}

// Better search words for frequent destinations (bright, iconic, non-religious views).
const QUERIES = {
  IST: ['Istanbul Bosphorus sunny', 'Galata tower daytime', 'Istanbul waterfront'],
  AYT: ['Antalya beach', 'Antalya coast turquoise', 'Kaleici harbour'],
  PMI: ['Mallorca bay turquoise', 'Palma de Mallorca harbour', 'Mallorca beach'],
  BCN: ['Barcelona beach sunny', 'Barcelona city view', 'Barcelona street'],
  DXB: ['Dubai skyline day', 'Dubai marina', 'Dubai beach'],
  EBL: ['Erbil citadel', 'Erbil city', 'Kurdistan mountains'],
  BGW: ['Baghdad Tigris', 'Baghdad city'],
  HRG: ['Hurghada beach', 'Red Sea beach Egypt'],
  LIS: ['Lisbon tram sunny', 'Lisbon viewpoint', 'Lisbon city'],
  FCO: ['Rome Colosseum sunny', 'Rome street', 'Rome city view'],
  ISU: ['Sulaymaniyah city', 'Sulaymaniyah Kurdistan', 'Kurdistan mountains green', 'Iraqi Kurdistan landscape'],
};
// Places without an airport code (e.g. own offers), by name.
const NAME_QUERIES = {
  erbil: QUERIES.EBL, sulaymaniyah: QUERIES.ISU, slemani: QUERIES.ISU,
  duhok: ['Duhok city', 'Duhok Kurdistan', 'Duhok dam lake', 'Kurdistan mountains green'],
  dohuk: ['Duhok city', 'Duhok Kurdistan', 'Duhok dam lake', 'Kurdistan mountains green'],
  zakho: ['Zakho Delal bridge', 'Zakho Kurdistan', 'Kurdistan river mountains'],
};
const queriesFor = (offer) => QUERIES[offer.to.code] || NAME_QUERIES[(offer.to.name || '').trim().toLowerCase()] || (offer.kind === 'cruise'
  ? [`${offer.to.name} river cruise`, `${offer.to.name} river sunny`, `${(offer.route || '').split(/[–,-]/)[0].trim()} river`]
  : offer.kind === 'home'
    ? [`${offer.to.name} ${offer.country} villa`.trim(), `${offer.to.name} ${offer.country}`.trim(), `${offer.country} countryside sunny`.trim()]
    : offer.kind === 'package'
  // Small towns have few photos: search town + country first, then the country's best-known views.
  ? [`${offer.to.name} ${offer.country}`.trim(), `${offer.country || offer.region} coast sunny`.trim(), `${offer.country || offer.region} landmark`.trim(), `${offer.region} ${offer.country}`.trim()]
  : [`${offer.to.name} city sunny`, `${offer.to.name} travel`, offer.to.name]);

/** Library photo (client decision: our library comes first), or null. */
function choosePhoto(offer) {
  const drafts = store.listDrafts();
  return libraryPhoto(offer.to.code, new Set(drafts.map((d) => d.photoFile).filter(Boolean)));
}

/** Real photo candidates for a draft, ranked best first by Gemini (score 0-10). */
async function findCandidates(draft) {
  const used = new Set(store.listDrafts().map((d) => d.pexelsId).filter(Boolean));
  for (const c of draft.photoCandidates || []) used.add(c.id); // "more photos" shows new ones
  let list = [];
  try { list = await pexelsCandidates(queriesFor(draft.offer), used, 15); } catch (err) { console.error('studio pexels:', err.message); }
  const ranked = await rankPhotos(list, [draft.offer.to.name, draft.offer.country].filter(Boolean).join(', '));
  draft.photoCandidates = ranked.map((c) => ({ id: c.id, url: c.url, thumb: c.thumb, score: c.score, why: c.why || '' }));
}

/** Use one candidate (by Pexels id) as the draft photo. */
async function useCandidate(draft, id) {
  const c = (draft.photoCandidates || []).find((x) => x.id === id);
  if (!c) throw new Error('unknown photo');
  setPhoto(draft, { file: null, pexelsId: c.id, dataUri: await pexelsDownload(c.url) });
  draft.photoCandidates = [];
}

function setPhoto(draft, p) {
  if (p) draft.photoCandidates = [];
  fs.writeFileSync(photoPath(draft.id), p ? p.dataUri : '');
  draft.photoFile = p ? p.file : null;
  draft.pexelsId = p ? p.pexelsId : null;
  draft.needsPhoto = !p;
}

/** Keep the photo of an approved draft in the library (once per draft). */
function saveToLibrary(draft) {
  if (draft.photoFile || draft.libraryFile) return;
  let data = '';
  try { data = fs.readFileSync(photoPath(draft.id), 'utf8'); } catch { return; }
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m || !/^[A-Z]{3}$/.test(draft.offer.to.code || '')) return;
  fs.mkdirSync(LIBRARY, { recursive: true });
  const file = `${draft.offer.to.code}-${draft.id}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(LIBRARY, file), Buffer.from(m[2], 'base64'));
  draft.libraryFile = file;
  draft.photoFile = file; // counts as used by this draft
}

const destKey = (o) => o.to.code || o.to.name;
const pickOffer = (offers, recent, skip = new Set()) => offers.find((o) => !recent.has(destKey(o)) && !skip.has(offerKey(o))) || null;

/** Live offers of one kind, in the draft offer shape. */
// Packages: specials top offers + last-minute offers, cheapest hotel per destination only
// (the feed lists each destination several times with different hotels).
// The client's own offers ("Eigene Angebote") are always added to their kind's list.
async function liveOffers(kind) {
  if (kind !== 'package') return [...ownOffers.list('flight'), ...(await getFlightOffers())].sort((a, b) => a.price - b.price);
  const [top, last] = await Promise.all([getPackageOffers('package'), getPackageOffers('lastminute')]);
  const best = new Map();
  for (const o of [...top, ...last].map(toDraftOffer).filter((x) => x.to.name)) {
    const k = destKey(o) + '|' + (o.country || '');
    if (!best.has(k) || o.price < best.get(k).price) best.set(k, o);
  }
  return [...ownOffers.list('package'), ...best.values()].sort((a, b) => a.price - b.price);
}

function datesText(offer, lang) {
  if (offer.kind === 'package') return '';
  const out = formatDate(offer.departureDate);
  if (!offer.returnDate) return out;
  const back = formatDate(offer.returnDate);
  if (lang === 'de') return `${out} – ${back}`;
  return lang === 'ar' ? `من ${out} إلى ${back}` : `ژ ${out} بۆ ${back}`;
}

/** Render all slides of a draft from its stored photo and texts. */
async function renderDraft(draft) {
  const photo = fs.readFileSync(photoPath(draft.id), 'utf8');
  const stamp = Date.now().toString(36);
  const versions = [];
  for (const lang of draft.langs) {
    const t = draft.texts[lang];
    const local = (p) => (lang === 'de' ? p.name : cityName(p, lang));
    const post = {
      style: draft.style, lang, photo, destination: local(draft.offer.to), hook: t.hook,
      from: draft.offer.from ? { city: local(draft.offer.from), code: draft.offer.from.code || '' } : { city: '', code: '' },
      to: { city: local(draft.offer.to), code: draft.offer.to.code || '' },
      dates: datesText(draft.offer, lang), airline: draft.offer.airline,
      price: draft.offer.price,
      kind: draft.offer.kind, card: draft.offer.kind === 'flight' || !draft.offer.kind ? null : cardFor(draft.offer, lang, formatPrice),
      country: draft.offer.kind && draft.offer.kind !== 'flight' && draft.offer.country ? countryName(draft.offer.country, lang) : '',
    };
    const files = [];
    for (const size of ['story', 'portrait']) { // story first: it is posted first
      for (const slide of [1, 2, 3]) {
        const name = `studio_${draft.id}_${stamp}_${lang}_${size}_${slide}.jpg`;
        fs.writeFileSync(path.join(OUTPUT, name), await renderSlide(post, size, slide));
        files.push({ size, slide, url: '/output/' + name });
      }
    }
    versions.push({ lang, caption: t.caption, aiWritten: t.aiWritten, files });
  }
  // Remove the previous renders of this draft.
  for (const v of draft.versions || []) for (const f of v.files) {
    try { fs.unlinkSync(path.join(OUTPUT, path.basename(f.url))); } catch { /* already gone */ }
  }
  draft.versions = versions;
  draft.updatedAt = new Date().toISOString();
  return store.upsertDraft(draft);
}

async function writeTexts(draft, langs = draft.langs) {
  draft.texts = draft.texts || {};
  const captions = await Promise.all(langs.map((lang) => buildCaption(draft.offer, lang))); // in parallel
  langs.forEach((lang, i) => {
    const c = captions[i];
    draft.texts[lang] = { hook: c.hook, caption: c.text, aiWritten: c.aiWritten };
  });
}

async function buildDraft({ offer, style, date, source, photo = null, langs = null }) {
  const id = crypto.randomBytes(6).toString('hex');
  const picture = photo ? { file: null, pexelsId: null, dataUri: photo } : choosePhoto(offer);
  const draft = {
    id, createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style, source, offer, langs: langs || defaultLangs(date), versions: [],
  };
  setPhoto(draft, picture);
  await writeTexts(draft);
  if (!picture) { // no library photo: show ranked real photos; the client picks one (or "auto")
    await findCandidates(draft);
    return store.upsertDraft(draft);
  }
  return renderDraft(draft);
}

async function createDailyDraft({ date = new Date(), offers = null, langs = null } = {}) {
  const list = offers || (await getFlightOffers());
  const offer = pickOffer(list, store.recentDestinations(REPEAT_DAYS));
  if (!offer) throw new Error('no suitable flight offer today');
  return buildDraft({ offer, style: STYLE_BY_WEEKDAY[date.getDay()], date, source: 'specials', langs });
}

/** Package draft (hotel + flight) from today's specials top offers. */
async function createPackageDraft({ date = new Date(), offers = null, langs = null } = {}) {
  const list = offers || (await liveOffers('package'));
  const offer = pickOffer(list, store.recentDestinations(REPEAT_DAYS));
  if (!offer) throw new Error('no suitable package offer today');
  return buildDraft({ offer, style: 'flight', date, source: 'specials', langs });
}

/** Replace the offer of a draft (another destination); keeps style and languages. */
async function changeOffer(draft, key) {
  if (!['flight', 'package', undefined].includes(draft.offer.kind)) throw new Error('Nur bei Flug- und Paketangeboten möglich.');
  const kind = draft.offer.kind === 'package' ? 'package' : 'flight';
  const list = await liveOffers(kind);
  draft.skippedOffers = [...new Set([...(draft.skippedOffers || []), offerKey(draft.offer)])].slice(-50);
  const offer = key
    ? list.find((o) => offerKey(o) === key)
    : pickOffer(list, store.recentDestinations(REPEAT_DAYS), new Set(draft.skippedOffers))
      || pickOffer(list, new Set(), new Set(draft.skippedOffers));
  if (!offer) throw new Error(key ? 'Angebot nicht mehr verfügbar.' : 'Kein weiteres Angebot verfügbar.');
  draft.offer = offer;
  draft.texts = {};
  await writeTexts(draft);
  const lib = choosePhoto(offer);
  setPhoto(draft, lib);
  if (!lib) await findCandidates(draft);
}

/** Today's offers of the draft's kind, for the "choose offer" list. */
async function offerChoices(kind) {
  return (await liveOffers(kind === 'package' ? 'package' : 'flight')).map((o) => ({
    key: offerKey(o), price: o.price, dest: destKey(o),
    label: (o.own ? '⭐ ' : '') + (o.kind === 'package' ? `${o.to.name} – ${o.hotel}` : `${o.from.name} → ${o.to.name} (${o.departureDate})`),
  }));
}

async function createManualDraft({ offer, style, photo = null, date = new Date(), langs = null }) {
  return buildDraft({ offer, style: style || STYLE_BY_WEEKDAY[date.getDay()], date, source: 'manual', photo, langs });
}

/** Re-generate one part of an existing draft: 'photo' | 'text' | 'all' | {style} | {langs}. */
async function regenerate(draft, what, value) {
  if (draft.bundle) return regenerateBundle(draft, what, value, queriesFor, choosePhoto, LANGS);
  if (what === 'photo') { // show (new) ranked candidates; current photo stays until one is picked
    await findCandidates(draft);
    if (!draft.photoCandidates.length) throw new Error('Kein weiteres echtes Foto gefunden – bitte eigenes Foto hochladen oder KI-Foto (Notfall) nutzen.');
    return store.upsertDraft(draft);
  }
  if (what === 'offer-next') await changeOffer(draft, null);
  if (what === 'offer-pick') await changeOffer(draft, value);
  if (what === 'photo-pick') await useCandidate(draft, value);
  if (what === 'photo-auto') {
    if (!(draft.photoCandidates || []).length) await findCandidates(draft);
    if (!draft.photoCandidates.length) throw new Error('Kein echtes Foto gefunden – bitte eigenes Foto hochladen.');
    await useCandidate(draft, draft.photoCandidates[0].id);
  }
  if (what === 'photo-ai') setPhoto(draft, { file: null, pexelsId: null, dataUri: await generatePhoto(draft.offer.to.name) });
  if (what === 'photo-upload') setPhoto(draft, { file: null, pexelsId: null, dataUri: value });
  if (what === 'text' || what === 'all') await writeTexts(draft);
  if (what === 'all') await findCandidates(draft); // new ranked photos to choose from
  if (what === 'style') {
    if (!STYLES.includes(value)) throw new Error('unknown style');
    if (draft.offer.kind && draft.offer.kind !== 'flight' && value !== 'flight') throw new Error('Dieses Angebot nutzt die Glas-Vorlage.');
    draft.style = value;
  }
  if (what === 'langs') {
    if (!Array.isArray(value) || !value.length || value.length > 3 || !value.every((l) => LANGS.includes(l))) throw new Error('bad languages');
    draft.langs = [...new Set(value)];
    await writeTexts(draft, draft.langs.filter((l) => !(draft.texts || {})[l]));
  }
  draft.status = 'pending';
  if (draft.needsPhoto) return store.upsertDraft(draft); // nothing to render until a photo is chosen
  return renderDraft(draft);
}

/** Delete a draft with its rendered images and stored photo. */
function deleteDraft(draft) {
  for (const v of draft.versions || []) for (const f of v.files) {
    try { fs.unlinkSync(path.join(OUTPUT, path.basename(f.url))); } catch { /* already gone */ }
  }
  try { fs.unlinkSync(photoPath(draft.id)); } catch { /* no photo */ }
  if (draft.bundle) deleteBundlePhotos(draft);
  store.removeDraft(draft.id);
}

/** "Mehrere Angebote": one post with 2-6 offers (studio/bundle.js). */
async function createBundleDraft({ kind, keys, date = new Date(), langs = null }) {
  return buildBundle({ kind, keys, langs: langs || defaultLangs(date), date, liveOffers, queriesFor, choosePhoto });
}

module.exports = { createBundleDraft, offerChoices, createPackageDraft, saveToLibrary, deleteDraft, createDailyDraft, createManualDraft, regenerate, pickOffer };
