// ============================================================
//  studio/packages.js — package offers (hotel + flight) for posts
//  Turns a specials package offer (studio/offers.js) into the draft
//  offer shape and builds the localized fact line
//  ("7 Nächte · Halbpension · inkl. Flug"). Written by code only.
// ============================================================

// Arabic/Badini use plain wording (client decision): "stay + breakfast" instead of terms like "half board".
const BOARDS = [
  { re: /all[\s-]*inclusive|alles inklusive/i, de: 'All Inclusive', ar: 'إقامة شاملة', ckb: 'مانا گشتگیر' },
  { re: /vollpension/i, de: 'Vollpension', ar: 'إقامة + ثلاث وجبات', ckb: 'مان + سێ ژەمێن خوارنێ' },
  { re: /halbpension/i, de: 'Halbpension', ar: 'إقامة + وجبتان', ckb: 'مان + دوو ژەمێن خوارنێ' },
  { re: /frühstück/i, de: 'Frühstück', ar: 'إقامة + فطور', ckb: 'مان + تێشت' },
  { re: /nur übernachtung|ohne verpflegung/i, de: 'Nur Übernachtung', ar: 'إقامة فقط', ckb: 'تنێ مان' },
];
const NIGHTS = { de: (n) => `${n} ${n === 1 ? 'Nacht' : 'Nächte'}`, ar: (n) => `${n} ليالٍ`, ckb: (n) => `${n} شەڤ` };
const FLIGHT = { de: 'inkl. Flug', ar: 'شامل الطيران', ckb: 'دگەل فرۆکێ' };

const clean = (s, max) => (typeof s === 'string' ? s.replace(/[<>{}]/g, '').trim().slice(0, max) : '');

/** specials package offer → draft offer ({ kind: 'package', to: { name }, hotel, ... }). */
function toDraftOffer(p) {
  const loc = (p.location || []).map((l) => clean(l, 80)).filter(Boolean);
  const city = loc[loc.length - 1] || '';
  return {
    kind: 'package',
    key: 'p-' + p.giataId,
    to: { code: '', name: city },
    region: loc.length > 1 ? loc[loc.length - 2] : '',
    country: loc[0] || '',
    hotel: clean(p.hotel, 120),
    stars: Math.max(0, Math.min(6, Number(p.stars) || 0)),
    nights: Number.isInteger(p.nights) ? p.nights : null,
    details: clean(p.details, 200),
    price: p.price,
    image: p.image || null,
    giataId: p.giataId, cityId: p.cityId, regionId: p.regionId,
  };
}

/** Localized fact line, e.g. "7 Nächte · Halbpension · inkl. Flug". */
function factLine(offer, lang) {
  const parts = [];
  if (offer.nights) parts.push(NIGHTS[lang](offer.nights));
  const board = BOARDS.find((b) => b.re.test(offer.details || ''));
  if (board) parts.push(board[lang]);
  if (/flug/i.test(offer.details || '')) parts.push(FLIGHT[lang]);
  return parts.join(' · ');
}

const starText = (n) => '★'.repeat(Math.max(0, Math.min(6, n || 0)));

/** Stable key of any draft offer (used by "choose another offer"). */
const offerKey = (o) => o.key || (o.kind === 'package' ? 'p-' + o.giataId : `${o.from.code}-${o.to.code}-${o.departureDate}`);

module.exports = { toDraftOffer, factLine, starText, offerKey };
