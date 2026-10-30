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

// Countries as specials writes them (German) → Arabic / Badini. Unknown countries stay German.
const COUNTRIES = {
  'Türkei': ['تركيا', 'تورکیا'], 'Ägypten': ['مصر', 'میسر'], 'Spanien': ['إسبانيا', 'ئیسپانیا'], 'Griechenland': ['اليونان', 'یۆنان'],
  'Malta': ['مالطا', 'ماڵتا'], 'Zypern': ['قبرص', 'قوبرس'], 'Italien': ['إيطاليا', 'ئیتالیا'], 'Portugal': ['البرتغال', 'پورتوگال'],
  'Kroatien': ['كرواتيا', 'کرواتیا'], 'Tunesien': ['تونس', 'تونس'], 'Marokko': ['المغرب', 'مەغریب'], 'Bulgarien': ['بلغاريا', 'بولگاریا'],
  'Vereinigte Arabische Emirate': ['الإمارات', 'ئیمارات'], 'Thailand': ['تايلاند', 'تایلەند'], 'Frankreich': ['فرنسا', 'فەرەنسا'],
  'Montenegro': ['الجبل الأسود', 'مۆنتینیگرۆ'], 'Albanien': ['ألبانيا', 'ئەلبانیا'], 'Mexiko': ['المكسيك', 'مەکسیک'],
  'Dominikanische Republik': ['جمهورية الدومينيكان', 'دۆمینیکان'], 'Malediven': ['جزر المالديف', 'مالدیڤ'], 'Kap Verde': ['الرأس الأخضر', 'کاپ ڤێردێ'],
};
function countryName(de, lang) {
  if (!de || lang === 'de') return de || '';
  const t = COUNTRIES[de];
  return t ? t[lang === 'ar' ? 0 : 1] : de;
}

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

// ---- Manual offers: river cruises and holiday homes (client enters them in the studio) ----
const FEATURES = {
  pool: { de: 'Pool', ar: 'مسبح', ckb: 'حەوز' },
  sea: { de: 'Meerblick', ar: 'إطلالة على البحر', ckb: 'دیمەنێ دەریایێ' },
  garden: { de: 'Garten', ar: 'حديقة', ckb: 'باخچە' },
  wifi: { de: 'WLAN', ar: 'واي فاي', ckb: 'وای فای' },
  parking: { de: 'Parkplatz', ar: 'موقف سيارات', ckb: 'جهێ ترومبێلێ' },
  pets: { de: 'Haustiere erlaubt', ar: 'يسمح بالحيوانات', ckb: 'گیانەوەر دهێنە قەبوولکرن' },
};
const BOARD_KEYS = { none: 4, breakfast: 3, half: 2, full: 1, all: 0 };
const KIND_LABELS = {
  cruise: { de: ['Flusskreuzfahrt', 'Deine Reise'], ar: ['رحلة نهرية', 'رحلتك'], ckb: ['گەشتا ڕووباری', 'گەشتا تە'] },
  home: { de: ['Ferienhaus', 'Dein Zuhause auf Zeit'], ar: ['بيت عطلات', 'بيتك في العطلة'], ckb: ['خانیێ بێهنڤەدانێ', 'خانیێ تە'] },
};
const PER = {
  person: { de: 'pro Person', ar: 'للشخص', ckb: 'بۆ هەر کەسەکی' },
  night: { de: 'pro Nacht', ar: 'لليلة', ckb: 'بۆ شەڤەکێ' },
};

/** Card content for non-flight posts: { kicker, detailsTitle, title, stars, place, line, priceValue, per }. */
function cardFor(o, lang, fmtPrice) {
  const fmt = (iso) => (/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '') || []).slice(1).reverse().join('.');
  if (o.kind === 'cruise') {
    const board = BOARDS[BOARD_KEYS[o.board]];
    return {
      kicker: KIND_LABELS.cruise[lang][0], detailsTitle: KIND_LABELS.cruise[lang][1],
      title: o.ship, stars: '', place: o.route,
      line: [o.nights ? NIGHTS[lang](o.nights) : '', board ? board[lang] : '', o.startDate ? '\u2066' + fmt(o.startDate) + '\u2069' : ''].filter(Boolean).join(' · '),
      priceValue: o.price, per: PER.person[lang],
    };
  }
  if (o.kind === 'home') {
    const persons = { de: `bis ${o.persons} Personen`, ar: `حتى ${o.persons} أشخاص`, ckb: `هەتا ${o.persons} کەس` }[lang];
    const rooms = { de: `${o.bedrooms} Schlafzimmer`, ar: `${o.bedrooms} غرف نوم`, ckb: `${o.bedrooms} ژوورێن نڤستنێ` }[lang];
    const night = o.priceNight > 0;
    const total = o.priceTotal > 0 && o.nights ? `${NIGHTS[lang](o.nights)} ${({ de: 'ab', ar: 'ابتداءً من', ckb: 'ژ' })[lang]} ${fmtPrice(o.priceTotal)}` : '';
    return {
      kicker: KIND_LABELS.home[lang][0], detailsTitle: KIND_LABELS.home[lang][1],
      title: o.home, stars: '', place: [o.to.name, countryName(o.country, lang)].filter(Boolean).join(', '),
      line: [o.persons ? persons : '', o.bedrooms ? rooms : '', ...(o.features || []).map((f) => FEATURES[f][lang])].filter(Boolean).join(' · '),
      priceValue: night ? o.priceNight : o.priceTotal,
      per: night ? [PER.night[lang], total].filter(Boolean).join(' · ') : NIGHTS[lang](o.nights || 1),
    };
  }
  return { // package
    title: o.hotel, stars: starText(o.stars), place: [o.to.name, countryName(o.country, lang)].filter(Boolean).join(', '),
    line: factLine(o, lang), priceValue: o.price, per: PER.person[lang],
  };
}

module.exports = { FEATURES, BOARD_KEYS, cardFor, countryName, toDraftOffer, factLine, starText, offerKey };
