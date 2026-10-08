// ============================================================
//  studio/planner.js — build the daily draft
//  1 offer (cheapest flight whose destination was not used in the last
//  3 days), the weekday's style, captions in German + Arabic (Kurdish
//  Badini on Mon/Wed/Fri instead of Arabic), slides in portrait (feed)
//  and story (WhatsApp Status / stories). Nothing is published here:
//  the draft waits for Rozhan's approval in the studio page.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFlightOffers } = require('./offers');
const { buildCaption, formatDate, formatPrice } = require('./captions');
const { renderSlide, STYLE_BY_WEEKDAY } = require('./render');
const store = require('./store');

const OUTPUT = path.join(__dirname, '..', 'output');
const PHOTOS = path.join(__dirname, 'photos');
const REPEAT_DAYS = 3;
const KURDISH_DAYS = new Set([1, 3, 5]);

/** A library photo for the destination (studio/photos/<IATA>-n.jpg), least recently used first. */
function libraryPhoto(code, usedPhotos) {
  let files = [];
  try { files = fs.readdirSync(PHOTOS).filter((f) => f.startsWith(code + '-') && /\.(jpe?g|png|webp)$/i.test(f)); } catch { /* none */ }
  if (!files.length) return null;
  const fresh = files.filter((f) => !usedPhotos.has(f));
  const file = (fresh.length ? fresh : files)[0];
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  return { file, dataUri: `data:image/${ext};base64,` + fs.readFileSync(path.join(PHOTOS, file)).toString('base64') };
}

async function aiPhoto(cityName) {
  // Reuses Carousel's existing Gemini background generator (no change to it).
  const { generateBackground } = require('../src/gemini-image');
  const dataUri = await generateBackground(cityName, 'story', 'flight', '');
  return { file: null, dataUri };
}

/** Pick the offer: cheapest flight whose destination is not in `recent`. */
function pickOffer(offers, recent) {
  return offers.find((o) => !recent.has(o.to.code)) || null;
}

async function createDailyDraft({ date = new Date(), offers = null } = {}) {
  const weekday = date.getDay();
  const style = STYLE_BY_WEEKDAY[weekday];
  const list = offers || (await getFlightOffers());
  const offer = pickOffer(list, store.recentDestinations(REPEAT_DAYS));
  if (!offer) throw new Error('no suitable flight offer today');

  const used = new Set(store.listDrafts().map((d) => d.photoFile).filter(Boolean));
  const photo = libraryPhoto(offer.to.code, used) || (await aiPhoto(offer.to.name));

  const id = crypto.randomBytes(6).toString('hex');
  const langs = ['de', KURDISH_DAYS.has(weekday) ? 'ckb' : 'ar'];
  const versions = [];
  for (const lang of langs) {
    const caption = await buildCaption(offer, lang);
    const post = {
      style, lang, photo: photo.dataUri,
      destination: lang === 'de' ? offer.to.name : captionCity(offer.to, lang),
      hook: caption.hook,
      from: { city: lang === 'de' ? offer.from.name : captionCity(offer.from, lang), code: offer.from.code },
      to: { city: lang === 'de' ? offer.to.name : captionCity(offer.to, lang), code: offer.to.code },
      dates: lang === 'de' ? `${formatDate(offer.departureDate)} – ${formatDate(offer.returnDate)}`
        : `${lang === 'ar' ? 'من' : 'ژ'} ${formatDate(offer.departureDate)} ${lang === 'ar' ? 'إلى' : 'بۆ'} ${formatDate(offer.returnDate)}`,
      airline: offer.airline, price: formatPrice(offer.price).replace(/,\d\d €$/, ' €'),
    };
    const files = [];
    for (const size of ['portrait', 'story']) {
      for (const slide of [1, 2, 3]) {
        const name = `studio_${id}_${lang}_${size}_${slide}.png`;
        fs.writeFileSync(path.join(OUTPUT, name), await renderSlide(post, size, slide));
        files.push({ size, slide, url: '/output/' + name });
      }
    }
    versions.push({ lang, caption: caption.text, aiWritten: caption.aiWritten, files });
  }

  return store.upsertDraft({
    id, createdAt: new Date().toISOString(), forDate: date.toISOString().slice(0, 10),
    status: 'pending', style, offer, photoFile: photo.file, versions,
  });
}

// Localised city names come from the captions module's table.
function captionCity(place, lang) {
  const { cityName } = require('./captions');
  return cityName(place, lang);
}

module.exports = { createDailyDraft, pickOffer };
