// ============================================================
//  studio/planner.js — build and re-build drafts
//  A draft = offer + style + languages + photo + texts. Each part can
//  be regenerated on its own (photo, texts, style, languages) and the
//  slides are re-rendered. Nothing is published from here.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFlightOffers, getPackageOffers, getPackageBoxOffers } = require('./offers');
const { toDraftOffer, offerKey, countryName, cardFor } = require('./packages');
const { buildCaption, formatDate, formatPrice, cityName, LANGS } = require('./captions');
const { renderSlide, STYLE_BY_WEEKDAY, STYLES, PACKAGE_STYLES } = require('./render');
const { generateSet, enhancePhoto } = require('./image');
const sources = require('./photo-sources');
const bank = require('./bank');
const registry = require('./photo-registry');
const { rankPhotos } = require('./photo-rank');
const store = require('./store');
const ownOffers = require('./own-offers');
const { createBundleDraft: buildBundle, regenerateBundle, deleteBundlePhotos } = require('./bundle');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const CACHE = path.join(ROOT, 'cache');
const PHOTOS = path.join(__dirname, 'photos');
const LIBRARY = path.join(CACHE, 'studio-library'); // approved photos, kept across deploys (cache volume)
const REPEAT_DAYS = 14; // no destination (packages: no country) again within 14 days (client plan)
const KURDISH_DAYS = new Set([1, 3, 5]);

const defaultLangs = (date) => ['de', KURDISH_DAYS.has(date.getDay()) ? 'ckb' : 'ar'];
const photoPath = (id) => path.join(CACHE, `studio-photo-${id}.txt`);
const slidePath = (id, slide) => path.join(CACHE, `studio-photo-${id}-s${slide}.txt`); // own photo for slide 2/3 (AI sets)

/** A library photo for the destination (studio/photos/<IATA>-n.jpg), least recently used first. */
function libraryPhoto(code, used) {
  const block = registry.blocked(code);
  const files = [];
  for (const dir of [PHOTOS, LIBRARY]) {
    try {
      for (const f of fs.readdirSync(dir)) if (code && f.startsWith(code + '-') && /\.(jpe?g|png|webp)$/i.test(f)) files.push([dir, f]);
    } catch { /* none */ }
  }
  const fresh = files.filter(([, f]) => !used.has(f) && !block.has('lib:' + f));
  if (!fresh.length) return null;
  const [dir, file] = fresh[0];
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  return { file, pexelsId: null, dataUri: `data:image/${ext};base64,` + fs.readFileSync(path.join(dir, file)).toString('base64') };
}

// Fallback search words (destinations.js and Gemini suggestions come first, see photo-sources.js).
const QUERIES = {
  IST: ['Istanbul Bosphorus sunny', 'Galata tower daytime', 'Istanbul waterfront'],
  AYT: ['Antalya beach', 'Antalya coast turquoise', 'Kaleici harbour'],
  PMI: ['Mallorca bay turquoise', 'Palma de Mallorca harbour', 'Mallorca beach'],
  BCN: ['Barcelona beach sunny', 'Barcelona city view', 'Barcelona street'],
  DXB: ['Dubai skyline day', 'Dubai marina', 'Dubai beach'],
  EBL: ['Erbil citadel', 'Erbil city', 'Kurdistan mountains'],
  HRG: ['Hurghada beach', 'Red Sea beach Egypt'],
  LIS: ['Lisbon tram sunny', 'Lisbon viewpoint', 'Lisbon city'],
  FCO: ['Rome Colosseum sunny', 'Rome street', 'Rome city view'],
  BCN: ['Barcelona beach sunny', 'Barcelona Park Guell', 'Barcelona city view'],
  ROM: ['Rome Colosseum sunny', 'Rome Trevi fountain', 'Rome city view'],
  HER: ['Crete beach turquoise', 'Heraklion harbour', 'Crete coast sunny'],
  PAR: ['Paris Eiffel tower sunny', 'Paris Seine', 'Paris street cafe'],
  AMS: ['Amsterdam canal sunny', 'Amsterdam houses canal', 'Amsterdam tulips'],
  TBS: ['Tbilisi old town', 'Tbilisi city view', 'Georgia mountains Kazbegi'],
  CAI: ['Giza pyramids', 'Cairo Nile', 'Egypt pyramids sunny'],
  BKK: ['Bangkok skyline', 'Thailand beach turquoise', 'Bangkok river'],
  VIE: ['Vienna Schonbrunn', 'Vienna city view', 'Vienna Belvedere'],
  LCA: ['Cyprus beach turquoise', 'Larnaca promenade', 'Cyprus coast sunny'],
  LON: ['London Tower Bridge', 'London Big Ben sunny', 'London city view'],
  BGW: ['Baghdad Tigris', 'Baghdad city', 'Iraq Tigris river'],
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

// AI set → picture: slide 1 photo plus different photos for slides 2 and 3 (client: never one photo for all slides).
const aiPicture = ([a, b, c]) => ({ file: null, pexelsId: null, ai: true, dataUri: a, slides: { 2: b, 3: c } }); // only via the 🤖 KI button

const AUTO_MIN = 8; // strict: only magazine-level real photos are used automatically
const AUTO_FILL = 7; // slides 2/3 may use a slightly lower score rather than repeating slide 1
const pos = (c) => `${Number.isInteger(c.x) ? c.x : 50}% 50%`;
const placeName = (o) => [o.to.name, o.country].filter(Boolean).join(', ');

/** Fully automatic photos (client decision): real photos, strictly ranked by Gemini, three different
 *  ones for the three slides, each retouched (light/colour/sky, place unchanged). Returns
 *  { picture, ranked }: picture is null when no photo is good enough (ranked are then shown). */
async function autoPicture(offer, used = new Set()) {
  // Photo bank first (client-approved, ranked in advance): instant, three different photos.
  const fromBank = bank.pick(offer, 3, used);
  if (fromBank.length) {
    fromBank.forEach((b) => bank.markUsed(offer, b));
    return { ranked: [], picture: { file: null, pexelsId: fromBank[0].id, dataUri: fromBank[0].dataUri,
      slides: { 2: (fromBank[1] || {}).dataUri || null, 3: (fromBank[2] || {}).dataUri || null },
      pos: { 1: fromBank[0].pos, 2: (fromBank[1] || {}).pos || null, 3: (fromBank[2] || {}).pos || null },
      credits: fromBank.map((b) => b.credit) } };
  }
  let list = [];
  try { list = await sources.candidates(offer, queriesFor, used, 20); } catch (err) { console.error('studio photos:', err.message); }
  const ranked = await rankPhotos(list, placeName(offer), fetch, offer.kind || 'flight');
  const top = ranked.filter((c) => c.score != null && c.score >= AUTO_MIN);
  if (!top.length) return { picture: choosePhoto(offer), ranked };
  // Variety (client): a different kind of shot on each slide when possible (aerial cover, then bay, sunset ...).
  const pool = [...top, ...ranked.filter((c) => c.score != null && c.score >= AUTO_FILL && c.score < AUTO_MIN)];
  const picks = [];
  for (const c of pool) if (picks.length < 3 && !picks.some((p) => p.shot && p.shot === c.shot)) picks.push(c);
  for (const c of pool) if (picks.length < 3 && !picks.includes(c)) picks.push(c);
  const imgs = await Promise.all(picks.map(async (c) => {
    try {
      const raw = await sources.download(c.url);
      try { return await enhancePhoto(raw); } catch (err) { console.error('studio enhance:', err.message); return raw; }
    } catch { return null; }
  }));
  if (!imgs[0]) return { picture: choosePhoto(offer), ranked };
  picks.slice(1).forEach((c, i) => { if (imgs[i + 1]) sources.use(offer, c.id, imgs[i + 1]); });
  return {
    ranked,
    picture: { file: null, pexelsId: picks[0].id, dataUri: imgs[0], slides: { 2: imgs[1] || null, 3: imgs[2] || null },
      pos: { 1: pos(picks[0]), 2: picks[1] ? pos(picks[1]) : null, 3: picks[2] ? pos(picks[2]) : null } },
  };
}

const usedIds = () => new Set(store.listDrafts().flatMap((d) => [d.pexelsId, ...(d.pexelsIds || [])]).filter(Boolean));
const asCandidates = (ranked) => ranked.map((c) => ({ id: c.id, url: c.url, thumb: c.thumb, score: c.score, why: c.why || '', x: c.x }));

/** Real photo candidates for a draft, ranked best first by Gemini (score 0-10). */
async function findCandidates(draft) {
  const used = new Set(store.listDrafts().map((d) => d.pexelsId).filter(Boolean));
  for (const c of draft.photoCandidates || []) used.add(c.id); // "more photos" shows new ones
  let list = [];
  try { list = await sources.candidates(draft.offer, queriesFor, used, 15); } catch (err) { console.error('studio photos:', err.message); }
  const ranked = await rankPhotos(list, placeName(draft.offer), fetch, draft.offer.kind || 'flight');
  draft.photoCandidates = asCandidates(ranked);
}

/** Use one candidate (by Pexels id) as the draft photo. */
async function useCandidate(draft, id) {
  const c = (draft.photoCandidates || []).find((x) => x.id === id);
  if (!c) throw new Error('unknown photo');
  // Slides 2 and 3 get the next best other photos (client: never one photo for all slides).
  const others = draft.photoCandidates.filter((x) => x.id !== id).slice(0, 2);
  const extra = await Promise.all(others.map((x) => sources.download(x.url).catch(() => null)));
  setPhoto(draft, { file: null, pexelsId: c.id, dataUri: await sources.download(c.url), slides: { 2: extra[0] || null, 3: extra[1] || null },
    pos: { 1: pos(c), 2: others[0] ? pos(others[0]) : null, 3: others[1] ? pos(others[1]) : null } });
  others.forEach((x, i) => { if (extra[i]) sources.use(draft.offer, x.id, extra[i]); });
  draft.photoCandidates = [];
}

function setPhoto(draft, p) {
  if (p) draft.photoCandidates = [];
  fs.writeFileSync(photoPath(draft.id), p ? p.dataUri : '');
  for (const n of [2, 3]) {
    const extra = p && p.slides && p.slides[n];
    try { if (extra) fs.writeFileSync(slidePath(draft.id, n), extra); else fs.unlinkSync(slidePath(draft.id, n)); } catch { /* none */ }
  }
  draft.photoFile = p ? p.file : null;
  draft.pexelsId = p ? p.pexelsId : null;
  draft.needsPhoto = !p;
  draft.aiPhoto = !!(p && p.ai);
  draft.photoPos = (p && p.pos) || null;
  draft.photoCredits = (p && p.credits) || [];
  if (p) sources.use(draft.offer, p.pexelsId != null ? p.pexelsId : (p.file ? 'lib:' + p.file : null), p.dataUri);
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
// Packages: specials top offers + last-minute offers, ONE package per country (client rule),
// the cheapest. The client's own offers are always kept.
// The client's own offers ("Eigene Angebote") are always added to their kind's list.
async function liveOffers(kind) {
  if (kind !== 'package') return [...ownOffers.list('flight'), ...(await getFlightOffers())].sort((a, b) => a.price - b.price);
  const [top, last, boxes] = await Promise.all([getPackageOffers('package'), getPackageOffers('lastminute'), getPackageBoxOffers()]);
  const best = new Map();
  for (const o of [...top, ...last, ...boxes].map(toDraftOffer).filter((x) => x.to.name)) {
    const k = o.country || destKey(o);
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
  const slidePhotos = {};
  for (const n of [2, 3]) { try { slidePhotos[n] = fs.readFileSync(slidePath(draft.id, n), 'utf8'); } catch { /* uses slide 1 photo */ } }
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
    for (const size of ['story', 'square']) { // story first: it is posted first
      for (const slide of [1, 2, 3]) {
        const name = `studio_${draft.id}_${stamp}_${lang}_${size}_${slide}.jpg`;
        const own = !!slidePhotos[slide];
        const at = draft.photoPos && (own ? draft.photoPos[slide] : draft.photoPos[1]);
        fs.writeFileSync(path.join(OUTPUT, name), await renderSlide({ ...post, photo: own ? slidePhotos[slide] : photo, photoPosition: at || '' }, size, slide));
        files.push({ size, slide, url: '/output/' + name });
      }
    }
    const credit = bank.creditLine(draft.photoCredits);
    versions.push({ lang, caption: credit && !t.caption.includes(credit) ? `${t.caption}\n\n${credit}` : t.caption, aiWritten: t.aiWritten, files });
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

async function buildDraft({ offer, style, date, source, photo = null, langs = null, warning = '' }) {
  const id = crypto.randomBytes(6).toString('hex');
  const auto = photo ? { picture: { file: null, pexelsId: null, dataUri: photo }, ranked: [] } : await autoPicture(offer, usedIds());
  const picture = auto.picture;
  const draft = {
    id, createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style, source, offer, langs: langs || defaultLangs(date), versions: [], warning,
  };
  setPhoto(draft, picture);
  await writeTexts(draft);
  if (!picture) { // no good-enough photo and no library photo: show the ranked photos; the client picks one
    draft.photoCandidates = asCandidates(auto.ranked);
    return store.upsertDraft(draft);
  }
  return renderDraft(draft);
}

// Repeat rule: a flight destination (packages: a country) is not used again within REPEAT_DAYS,
// counting every offer of every draft (also multi-offer posts). When today's offers contain no
// fresh one, the least recently used is taken and the draft carries a visible warning.
const placeOf = (o) => (o.kind === 'package' ? o.country || destKey(o) : destKey(o));
function lastUse() {
  const last = new Map();
  for (const d of store.listDrafts()) {
    if (d.status === 'rejected') continue;
    const t = Date.parse(d.createdAt) || 0;
    for (const o of d.offers || [d.offer]) if (o) last.set(placeOf(o), Math.max(last.get(placeOf(o)) || 0, t));
  }
  return last;
}
const REPEAT_WARNING = 'Keine neue Destination verfügbar – diese wurde in den letzten 14 Tagen schon verwendet. Mehr Angebote: „📝 Eigene Angebote“ oder neue specials-Angebotsboxen.';
function pickFresh(list, skip = new Set()) {
  const pool = list.filter((o) => !skip.has(offerKey(o)));
  if (!pool.length) return { offer: null };
  const last = lastUse(), since = Date.now() - REPEAT_DAYS * 86400000;
  const fresh = pool.find((o) => (last.get(placeOf(o)) || 0) < since);
  if (fresh) return { offer: fresh, warning: '' };
  const oldest = [...pool].sort((a, b) => (last.get(placeOf(a)) || 0) - (last.get(placeOf(b)) || 0))[0];
  return { offer: oldest, warning: REPEAT_WARNING };
}

async function createDailyDraft({ date = new Date(), offers = null, langs = null } = {}) {
  const list = offers || (await liveOffers('flight'));
  const { offer, warning } = pickFresh(list);
  if (!offer) throw new Error('Heute keine Flugangebote verfügbar.');
  return buildDraft({ offer, style: STYLE_BY_WEEKDAY[date.getDay()], date, source: 'specials', langs, warning });
}

/** Package draft (hotel + flight) from today's specials top offers. */
async function createPackageDraft({ date = new Date(), offers = null, langs = null } = {}) {
  const list = offers || (await liveOffers('package'));
  const { offer, warning } = pickFresh(list);
  if (!offer) throw new Error('Heute keine Pauschalreisen verfügbar.');
  return buildDraft({ offer, style: 'flight', date, source: 'specials', langs, warning });
}

/** Replace the offer of a draft (another destination); keeps style and languages. */
async function changeOffer(draft, key) {
  if (!['flight', 'package', undefined].includes(draft.offer.kind)) throw new Error('Nur bei Flug- und Paketangeboten möglich.');
  const kind = draft.offer.kind === 'package' ? 'package' : 'flight';
  const list = await liveOffers(kind);
  draft.skippedOffers = [...new Set([...(draft.skippedOffers || []), offerKey(draft.offer)])].slice(-50);
  const others = list.filter((o) => placeOf(o) !== placeOf(draft.offer)); // "another destination" really means another one
  const picked = key ? { offer: list.find((o) => offerKey(o) === key), warning: '' } : pickFresh(others, new Set(draft.skippedOffers));
  const offer = picked.offer;
  if (!offer) throw new Error(key ? 'Angebot nicht mehr verfügbar.' : 'Kein weiteres Angebot verfügbar – bitte „📝 Eigene Angebote“ ergänzen.');
  draft.offer = offer;
  draft.warning = picked.warning || '';
  draft.texts = {};
  await writeTexts(draft);
  const auto = await autoPicture(offer, usedIds());
  setPhoto(draft, auto.picture);
  if (!auto.picture) draft.photoCandidates = asCandidates(auto.ranked);
}

/** Today's offers of the draft's kind, for the "choose offer" list. */
async function offerChoices(kind) {
  return (await liveOffers(kind === 'package' ? 'package' : 'flight')).map((o) => ({
    key: offerKey(o), price: o.price, dest: o.kind === 'package' ? (o.country || destKey(o)) : destKey(o),
    label: (o.own ? '⭐ ' : '') + (o.kind === 'package' ? `${o.to.name} – ${o.hotel}` : `${o.from.name} → ${o.to.name} (${o.departureDate})`),
  }));
}

async function createManualDraft({ offer, style, photo = null, date = new Date(), langs = null }) {
  return buildDraft({ offer, style: style || STYLE_BY_WEEKDAY[date.getDay()], date, source: 'manual', photo, langs });
}

/** Re-generate one part of an existing draft: 'photo' | 'text' | 'all' | {style} | {langs}. */
async function regenerate(draft, what, value) {
  if (draft.bundle) return regenerateBundle(draft, what, value, queriesFor, choosePhoto, LANGS);
  if (String(what).startsWith('bundle-')) throw new Error('bad request');
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
  if (what === 'photo-ai') setPhoto(draft, aiPicture(await generateSet(draft.offer)));
  if (what === 'photo-upload') setPhoto(draft, { file: null, pexelsId: null, dataUri: value });
  if (what === 'text' || what === 'all') await writeTexts(draft);
  if (what === 'all') { // new automatic photos (other ones than now)
    const used = usedIds();
    for (const c of draft.photoCandidates || []) used.add(c.id);
    const auto = await autoPicture(draft.offer, used);
    if (auto.picture) setPhoto(draft, auto.picture);
    else draft.photoCandidates = asCandidates(auto.ranked);
  }
  if (what === 'style') {
    if (!STYLES.includes(value)) throw new Error('unknown style');
    if (draft.offer.kind && draft.offer.kind !== 'flight' && !PACKAGE_STYLES.includes(value)) throw new Error('Für dieses Angebot: Glas oder Magazin.');
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
  for (const n of [2, 3]) { try { fs.unlinkSync(slidePath(draft.id, n)); } catch { /* none */ } }
  if (draft.bundle) deleteBundlePhotos(draft);
  store.removeDraft(draft.id);
}

/** "Mehrere Angebote": one post with 2-6 offers (studio/bundle.js). */
async function createBundleDraft({ kind, keys, date = new Date(), langs = null }) {
  return buildBundle({ kind, keys, langs: langs || defaultLangs(date), date, liveOffers, queriesFor, choosePhoto });
}

module.exports = { createBundleDraft, offerChoices, createPackageDraft, saveToLibrary, deleteDraft, createDailyDraft, createManualDraft, regenerate, pickOffer };
