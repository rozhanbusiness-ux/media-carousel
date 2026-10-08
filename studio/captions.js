// ============================================================
//  studio/captions.js — social captions in de / ar / ckb
//  Gemini writes ONLY the creative words (hook, short text,
//  hashtags). Prices, dates, routes, the call to action and the
//  legal notice are added by code, so the model can never invent
//  a price or a promise. Every model answer is checked; if it fails
//  (or no API key is set) a safe fixed caption is used instead.
// ============================================================

const config = require('../config');

const TEXT_MODEL = 'gemini-2.5-flash';
const LANGS = ['de', 'ar', 'ckb'];

// City names per airport code; unknown codes keep the provider's (German) name.
const CITY = {
  DUS: { de: 'Düsseldorf', ar: 'دوسلدورف', ckb: 'دۆسێڵدۆرف' },
  FRA: { de: 'Frankfurt', ar: 'فرانكفورت', ckb: 'فرانکفۆرت' },
  MUC: { de: 'München', ar: 'ميونخ', ckb: 'میونخ' },
  HAJ: { de: 'Hannover', ar: 'هانوفر', ckb: 'هانۆڤەر' },
  STR: { de: 'Stuttgart', ar: 'شتوتغارت', ckb: 'شتوتگارت' },
  IST: { de: 'Istanbul', ar: 'إسطنبول', ckb: 'ئیستانبوڵ' },
  AYT: { de: 'Antalya', ar: 'أنطاليا', ckb: 'ئەنتاڵیا' },
  PMI: { de: 'Mallorca', ar: 'مايوركا', ckb: 'مایۆرکا' },
  DXB: { de: 'Dubai', ar: 'دبي', ckb: 'دوبەی' },
  LON: { de: 'London', ar: 'لندن', ckb: 'لەندەن' },
  EBL: { de: 'Erbil', ar: 'أربيل', ckb: 'هەولێر' },
  ISU: { de: 'Sulaimaniyya', ar: 'السليمانية', ckb: 'سلێمانی' },
  BGW: { de: 'Bagdad', ar: 'بغداد', ckb: 'بەغدا' },
};
// Fixed hashtags per language (always added); the destination adds its own.
const BASE_TAGS = {
  de: ['#Reisen', '#Urlaub', '#Flugangebot', '#Reiseangebote', '#Reisebüro', '#Fernweh', '#Reiselust', '#UrlaubBuchen', '#Herbsturlaub', '#Halle', '#Düsseldorf'],
  ar: ['#سفر', '#سياحة', '#عروض_سفر', '#طيران', '#حجز_طيران', '#عطلة', '#سفر_من_المانيا', '#المانيا', '#رحلات', '#عروض_طيران'],
  ckb: ['#گەشت', '#گەشتیاری', '#فرۆکە', '#پێشنیار', '#کوردستان', '#ئەڵمانیا', '#بەهدینان', '#دهۆک', '#گەشتکرن', '#هەولێر'],
};
const tagWord = (s) => '#' + String(s).replace(/[^\p{L}]/gu, '');

const cityName = (place, lang) => (place.code && CITY[place.code] && CITY[place.code][lang]) || place.name;

const LANG_NAME = { de: 'German', ar: 'Arabic (Modern Standard, warm tone)', ckb: 'Kurdish Badini (Behdînî, Northern Kurdish of Duhok, written in Arabic script)' };

// Random choice from a small pool, so default texts do not repeat every day.
const pick = (list) => (o) => list[Math.floor(Math.random() * list.length)](o);

const FIXED = {
  de: {
    from: 'ab', perPerson: 'p. P.', route: (o) => `${o.from} → ${o.to}`,
    dates: (o) => `${o.dateOut}–${o.dateBack}`,
    cta: '👉 Link in der Bio – jetzt Angebot sichern.',
    notice: 'Preise schwanken täglich – wer früh bucht, reist günstiger.',
    fallbackHook: pick([
      (o) => `${o.toName} wartet schon auf dich.`,
      (o) => `Dein nächster Sonnenuntergang: ${o.toName}.`,
      (o) => `Koffer packen – ${o.toName} ruft.`,
      (o) => `Mehr Meer, mehr Licht: ${o.toName}.`,
    ]),
    fallbackBody: 'Ein spontaner Tapetenwechsel kostet weniger, als du denkst – aber nicht mehr lange.',
  },
  ar: {
    from: 'ابتداءً من', perPerson: 'للشخص', route: (o) => `من ${o.from} إلى ${o.to}`,
    dates: (o) => `من ${o.dateOut} إلى ${o.dateBack}`,
    cta: '👈 الرابط في البايو – احجز الآن.',
    notice: 'الأسعار تتغير باستمرار، ومن يحجز أولاً يسافر بسعر أفضل.',
    fallbackHook: pick([
      (o) => `${o.toName} بانتظارك…`,
      (o) => `حان وقت ${o.toName}.`,
      (o) => `حقيبتك جاهزة؟ ${o.toName} تناديك.`,
      (o) => `${o.toName}… رحلة تستحقها.`,
    ]),
    fallbackBody: 'المقاعد بهذا السعر محدودة، ومن يحجز أولاً يسافر أولاً.',
  },
  ckb: {
    from: 'ژ', perPerson: 'بۆ هەر کەسەکی', route: (o) => `ژ ${o.from} بۆ ${o.to}`,
    dates: (o) => `ژ ${o.dateOut} بۆ ${o.dateBack}`,
    cta: '👈 لینک د بایۆیێ دایە – نوکە بوک بکە.',
    notice: 'نرخ بەردەوام دگوهۆڕن، ئەوێ زوی بوک بکەت ب نرخەکێ باشتر گەشتێ دکەت.',
    fallbackHook: pick([
      (o) => `${o.toName}، نێزیکترە ژ ئەوا تو هزر دکەی.`,
      (o) => `${o.toName} ل هیڤیا تە یە.`,
      (o) => `دەمێ ${o.toName} هات.`,
    ]),
    fallbackBody: 'گەشتا تە یا بهێت ئێک کلیک دویرە.',
  },
};

/** "2026-10-23" -> "23.10.2026" */
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** 184.77 -> "184,77 €" (German format, also used in ar/ckb for clarity). */
function formatPrice(n) {
  // LRI ... PDI keeps "184,77 €" left-to-right (euro sign on the right) inside Arabic/Kurdish text.
  return '\u2066' + n.toFixed(2).replace('.', ',').replace(/,00$/, '') + ' €\u2069';
}

// Model output must never contain numbers, prices, links, contact data or free/discount promises.
const FORBIDDEN = /[0-9٠-٩€$%@]|https?:|www\.|\.com|kostenlos|gratis|umsonst|rabatt|garantiert|مجان|خصم|مضمون|بەخۆڕایی|داشکاندن/i;

function isSafeText(s, max) {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= max && !FORBIDDEN.test(s) && !/[<>{}]/.test(s);
}

function isSafeHashtag(t) {
  return typeof t === 'string' && /^#[\p{L}_]{2,30}$/u.test(t);
}

function buildPrompt(offer, lang) {
  return [
    `You write one Instagram/Facebook caption part for a travel agency (MEDIA Travel & Tourism, Germany).`,
    `Language: ${LANG_NAME[lang]}. Destination: ${offer.toName}. Departure city: ${offer.fromName}. Product: ${offer.kind}.`,
    `Brand voice: luxurious, warm, elegant and confident; never cheap, pushy or loud. Write like a high-end travel magazine.`,
    `Hook: max 55 characters, printed large on the photo. Evoke ONE concrete, sensory detail typical of ${offer.toName} (light, sea, a view, a taste, a sound, a famous place) so it could not be about any other city. Natural, native phrasing.`,
    `Avoid clichés and generic openers such as "Entdecke", "Fernweh?", "Während hier...", "Lust auf...", "اكتشف", "هل تحلم".`,
    `Rules: no numbers, no prices, no dates, no links, no discounts or "free", no emojis in the hook, no religious references or buildings.`,
    `Return ONLY JSON: {"hook": "<the hook>", "body": "<max 200 characters, 1-2 vivid sentences why this trip is special now>", "hashtags": ["#...", 8 to 12 specific hashtags about the destination and travel, without numbers]}`,
  ].join('\n');
}

async function askModel(offer, lang, fetchImpl) {
  if (!config.GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(offer, lang) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { console.error('studio caption: HTTP', res.status); return null; }
  const json = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

/**
 * Build the caption for one flight offer (from studio/offers.js) in one language.
 * Returns { lang, hook, body, facts, cta, notice, hashtags, text, aiWritten }.
 */
async function buildCaption(flight, lang, fetchImpl = fetch) {
  if (!LANGS.includes(lang)) throw new Error('unsupported language: ' + lang);
  const f = FIXED[lang];
  const offer = {
    kind: flight.kind || 'flight',
    fromName: cityName(flight.from, lang), toName: cityName(flight.to, lang),
    from: cityName(flight.from, lang) + (flight.from.code ? ` (${flight.from.code})` : ''), to: cityName(flight.to, lang) + (flight.to.code ? ` (${flight.to.code})` : ''),
    dateOut: formatDate(flight.departureDate), dateBack: formatDate(flight.returnDate),
  };

  // Up to 3 attempts: the model sometimes writes too long or uses a forbidden word.
  let ai = null;
  let aiOk = false;
  for (let attempt = 0; attempt < 3 && !aiOk; attempt++) {
    try { ai = await askModel(offer, lang, fetchImpl); } catch { ai = null; }
    aiOk = Boolean(ai && isSafeText(ai.hook, 70) && isSafeText(ai.body, 260));
    if (ai && !aiOk) console.error(`studio caption (${lang}): rejected – hook ${String(ai.hook || '').length} chars, body ${String(ai.body || '').length} chars`);
  }
  const hook = aiOk ? ai.hook.trim() : f.fallbackHook(offer);
  const body = aiOk ? ai.body.trim() : f.fallbackBody;
  const hashtags = ((aiOk && Array.isArray(ai.hashtags)) ? ai.hashtags.filter(isSafeHashtag) : [])
    .concat([tagWord(offer.toName), tagWord(offer.toName + (lang === 'de' ? 'Urlaub' : '')), ...BASE_TAGS[lang], '#MediaTravel', '#MediaTravelTourism'])
    .filter((t, i, all) => isSafeHashtag(t) && all.indexOf(t) === i)
    .slice(0, 22);

  // Facts are written by code only.
  const facts = [
    `✈️ ${f.route(offer)}`,
    offer.dateBack ? `📅 ${f.dates(offer)}` : `📅 ${offer.dateOut}`,
    `💶 ${f.from} ${formatPrice(flight.price)} ${f.perPerson}`,
  ];
  const text = [hook, '', body, '', ...facts, '', f.cta, '', f.notice, '', hashtags.join(' ')].join('\n');
  return { lang, hook, body, facts, cta: f.cta, notice: f.notice, hashtags, text, aiWritten: Boolean(aiOk) };
}

module.exports = { BASE_TAGS, buildCaption, isSafeText, isSafeHashtag, formatDate, formatPrice, cityName, LANGS };
