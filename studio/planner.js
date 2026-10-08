// ============================================================
//  studio/planner.js — build and re-build drafts
//  A draft = offer + style + languages + photo + texts. Each part can
//  be regenerated on its own (photo, texts, style, languages) and the
//  slides are re-rendered. Nothing is published from here.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFlightOffers } = require('./offers');
const { buildCaption, formatDate, cityName, LANGS } = require('./captions');
const { renderSlide, STYLE_BY_WEEKDAY, STYLES } = require('./render');
const { generatePhoto } = require('./image');
const store = require('./store');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const CACHE = path.join(ROOT, 'cache');
const PHOTOS = path.join(__dirname, 'photos');
const REPEAT_DAYS = 3;
const KURDISH_DAYS = new Set([1, 3, 5]);

const defaultLangs = (date) => ['de', KURDISH_DAYS.has(date.getDay()) ? 'ckb' : 'ar'];
const photoPath = (id) => path.join(CACHE, `studio-photo-${id}.txt`);

/** A library photo for the destination (studio/photos/<IATA>-n.jpg), least recently used first. */
function libraryPhoto(code, used) {
  let files = [];
  try { files = fs.readdirSync(PHOTOS).filter((f) => code && f.startsWith(code + '-') && /\.(jpe?g|png|webp)$/i.test(f)); } catch { /* none */ }
  const fresh = files.filter((f) => !used.has(f));
  if (!fresh.length) return null;
  const file = fresh[0];
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  return { file, dataUri: `data:image/${ext};base64,` + fs.readFileSync(path.join(PHOTOS, file)).toString('base64') };
}

async function choosePhoto(offer, { forceNew = false } = {}) {
  if (!forceNew) {
    const used = new Set(store.listDrafts().map((d) => d.photoFile).filter(Boolean));
    const lib = libraryPhoto(offer.to.code, used);
    if (lib) return lib;
  }
  return { file: null, dataUri: await generatePhoto(offer.to.name) };
}

const pickOffer = (offers, recent) => offers.find((o) => !recent.has(o.to.code)) || null;

function datesText(offer, lang) {
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
      from: { city: local(draft.offer.from), code: draft.offer.from.code || '' },
      to: { city: local(draft.offer.to), code: draft.offer.to.code || '' },
      dates: datesText(draft.offer, lang), airline: draft.offer.airline,
      price: draft.offer.price,
    };
    const files = [];
    for (const size of ['portrait', 'story']) {
      for (const slide of [1, 2, 3]) {
        const name = `studio_${draft.id}_${stamp}_${lang}_${size}_${slide}.png`;
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
  for (const lang of langs) {
    const c = await buildCaption(draft.offer, lang);
    draft.texts[lang] = { hook: c.hook, caption: c.text, aiWritten: c.aiWritten };
  }
}

async function buildDraft({ offer, style, date, source, photo = null, langs = null }) {
  const id = crypto.randomBytes(6).toString('hex');
  const picture = photo ? { file: null, dataUri: photo } : await choosePhoto(offer);
  fs.writeFileSync(photoPath(id), picture.dataUri);
  const draft = {
    id, createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style, source, offer, photoFile: picture.file, langs: langs || defaultLangs(date), versions: [],
  };
  await writeTexts(draft);
  return renderDraft(draft);
}

async function createDailyDraft({ date = new Date(), offers = null, langs = null } = {}) {
  const list = offers || (await getFlightOffers());
  const offer = pickOffer(list, store.recentDestinations(REPEAT_DAYS));
  if (!offer) throw new Error('no suitable flight offer today');
  return buildDraft({ offer, style: STYLE_BY_WEEKDAY[date.getDay()], date, source: 'specials', langs });
}

async function createManualDraft({ offer, style, photo = null, date = new Date(), langs = null }) {
  return buildDraft({ offer, style: style || STYLE_BY_WEEKDAY[date.getDay()], date, source: 'manual', photo, langs });
}

/** Re-generate one part of an existing draft: 'photo' | 'text' | 'all' | {style} | {langs}. */
async function regenerate(draft, what, value) {
  if (what === 'photo' || what === 'all') {
    const p = await choosePhoto(draft.offer, { forceNew: true });
    fs.writeFileSync(photoPath(draft.id), p.dataUri);
    draft.photoFile = p.file;
  }
  if (what === 'photo-upload') {
    fs.writeFileSync(photoPath(draft.id), value);
    draft.photoFile = null;
  }
  if (what === 'text' || what === 'all') await writeTexts(draft);
  if (what === 'style') {
    if (!STYLES.includes(value)) throw new Error('unknown style');
    draft.style = value;
  }
  if (what === 'langs') {
    if (!Array.isArray(value) || !value.length || value.length > 3 || !value.every((l) => LANGS.includes(l))) throw new Error('bad languages');
    draft.langs = [...new Set(value)];
    await writeTexts(draft, draft.langs.filter((l) => !(draft.texts || {})[l]));
  }
  draft.status = 'pending';
  return renderDraft(draft);
}

/** Delete a draft with its rendered images and stored photo. */
function deleteDraft(draft) {
  for (const v of draft.versions || []) for (const f of v.files) {
    try { fs.unlinkSync(path.join(OUTPUT, path.basename(f.url))); } catch { /* already gone */ }
  }
  try { fs.unlinkSync(photoPath(draft.id)); } catch { /* no photo */ }
  store.removeDraft(draft.id);
}

module.exports = { deleteDraft, createDailyDraft, createManualDraft, regenerate, pickOffer };
