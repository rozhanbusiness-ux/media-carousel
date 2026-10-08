// ============================================================
//  studio/offers.js — live offers from specials.de (partner 993036)
//  Flight offer boxes + package top offers, parsed with strict
//  patterns. The provider HTML is untrusted: only plain values are
//  extracted and validated; no provider markup is ever rendered.
//  (Ported from the media-travels.com website, src/lib/offers/.)
// ============================================================

const PARTNER_ID = '993036';
const TOP_OFFERS_ENDPOINT = 'https://ibe.specials.de/';
const FLIGHT_BOX_BASE = 'https://api.specials.de/component/teaserFlights.html';
// One offer box per route, configured by Rozhan in the specials partner tools.
const FLIGHT_BOX_KEYS = [
  'e8e7cf1b63e22aa4c9612b459eaa2c68', // DUS-EBL
  'e6b2c162eeb20f923740bbcf192a16eb', // HAJ-EBL
  '5fbbe53dd88b336b361f11b5afb131ec', // FRA-EBL
  '8e016fc6c512a12b7723014e4ae95c5f', // MUC-EBL
  '68247f0e6d8a5cc42969cd3542f17ff8', // STR-EBL
  '7055812ff8fefdd0d85c5a2554d50de6', // DUS-PMI
  'c7dedbd3150374df970ace74c2ed9a86', // DUS-AYT
  'ecd141163ae629bd021cc0c11ed1457f', // DUS-IST
  '8d0452e5babe17648c928a0ee04c9f98', // DUS-LON
  'a4f5c8b17cfc9a2b3e84f05b040dbe26', // DUS-DXB
];
const MAX_OFFERS = 12;
const MAX_BYTES = 2000000;
const IMAGE_PREFIX = 'https://media.traffics-switch.de/service/imgdata?';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ', raquo: '»', euro: '€' };

/** Strip tags, decode the few entities the widgets use, collapse whitespace. */
function plainText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#?\w+);/g, (m, name) => {
      if (ENTITIES[name]) return ENTITIES[name];
      const code = /^#(\d{1,6})$/.exec(name);
      return code ? String.fromCodePoint(Number(code[1])) : m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.234,56" or "283" -> number (EUR); null if not a sane price. */
function parseEuro(text) {
  const m = /(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(/\./g, '') + '.' + (m[2] || '0'));
  return value > 0 && value < 100000 ? value : null;
}

const isText = (s, max) => typeof s === 'string' && s.length >= 1 && s.length <= max;
const isId = (s) => /^\d{1,12}$/.test(s);
const isIata = (s) => /^[A-Z]{3}$/.test(s);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Parse the offerListHtml of ibe.specials.de/?action=topoffer&rd_type=json. */
function parsePackageOffers(html) {
  const offers = [];
  for (const chunk of String(html).split('<div class="offer-item ').slice(1, MAX_OFFERS + 1)) {
    const attr = (name) => (new RegExp('data-' + name + '="(\\d*)"').exec(chunk) || [])[1] || '';
    const location = plainText((/<p[^>]*>([\s\S]*?)<\/p>/.exec(chunk) || [])[1])
      .split('»').map((s) => s.trim()).filter(Boolean);
    const category = (/class="category">([\s\S]*?)<\/div>/.exec(chunk) || [])[1] || '';
    const stars = (category.split('opacity')[0].match(/fa-sun/g) || []).length;
    const details = plainText((/class="descript"[^>]*>([\s\S]*?)<\/div>/.exec(chunk) || [])[1]);
    const price = parseEuro(plainText((/class="offer-item-price">([\s\S]*?)<\/button>/.exec(chunk) || [])[1])) || 0;
    const nights = (/(\d{1,2})\s*Nächte?/.exec(details) || [])[1];
    const imageRaw = (/data-src="([^"]+)"/.exec(chunk) || [])[1];
    const image = imageRaw ? imageRaw.replace(/&amp;/g, '&') : null;
    const offer = {
      kind: 'package',
      location,
      hotel: plainText((/<h5[^>]*>\s*<span>([\s\S]*?)<\/span>/.exec(chunk) || [])[1]),
      stars,
      details,
      nights: nights ? Number(nights) : null,
      price,
      cityId: attr('city-id'),
      regionId: attr('region-id'),
      giataId: attr('giata-id'),
      image: image && image.startsWith(IMAGE_PREFIX) && image.length <= 600 ? image : null,
    };
    const ok = location.length >= 1 && location.length <= 5 && location.every((l) => isText(l, 80))
      && isText(offer.hotel, 120) && stars <= 6 && details.length <= 200
      && price > 0 && isId(offer.cityId) && isId(offer.regionId) && isId(offer.giataId);
    if (ok) offers.push(offer);
  }
  return offers;
}

/** Parse the HTML of api.specials.de/component/teaserFlights.html?access=... */
function parseFlightOffers(html) {
  const offers = [];
  const anchors = String(html).matchAll(/<a href="\?([^"]*)"[^>]*class="[^"]*teaser-flights[^"]*">([\s\S]*?)<\/a>/g);
  for (const [, query, body] of anchors) {
    if (offers.length >= MAX_OFFERS) break;
    const params = new URLSearchParams(query.replace(/&amp;/g, '&'));
    const place = (cls) => plainText((new RegExp('class="' + cls + '">([\\s\\S]*?)</div>').exec(body) || [])[1])
      .replace(/\s*\([A-Z]{3}\)\s*$/, '');
    const offer = {
      kind: 'flight',
      from: { name: place('departure'), code: params.get('depapt1') || '' },
      to: { name: place('destination'), code: params.get('dstapt1') || '' },
      departureDate: params.get('depdate1') || '',
      returnDate: params.get('retdate1') || null,
      airline: (/aria-label="([^"]{1,80})"/.exec(body) || [])[1] || null,
      price: parseEuro(plainText((/class="price">([\s\S]*?)<\/span>/.exec(body) || [])[1])) || 0,
    };
    const ok = isText(offer.from.name, 80) && isIata(offer.from.code)
      && isText(offer.to.name, 80) && isIata(offer.to.code)
      && isIsoDate(offer.departureDate) && (offer.returnDate === null || isIsoDate(offer.returnDate))
      && offer.price > 0;
    if (ok) offers.push(offer);
  }
  return offers;
}

/** One offer per route (departure -> destination), the cheapest. */
function cheapestPerRoute(offers) {
  const best = new Map();
  for (const o of offers) {
    const route = o.from.code + '-' + o.to.code;
    const cur = best.get(route);
    if (!cur || o.price < cur.price) best.set(route, o);
  }
  return [...best.values()];
}

/** GET a provider URL with timeout and size limit; null on any failure. */
async function fetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json, text/html' } });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length <= MAX_BYTES ? text : null;
  } catch {
    return null;
  }
}

/** Live flight offers: cheapest per route over all offer boxes, future departures only. */
async function getFlightOffers() {
  const pages = await Promise.all(FLIGHT_BOX_KEYS.map((k) => fetchText(FLIGHT_BOX_BASE + '?access=' + k)));
  const today = new Date().toISOString().slice(0, 10);
  const all = pages.flatMap((html) => (html ? parseFlightOffers(html) : []));
  return cheapestPerRoute(all.filter((o) => o.departureDate > today)).sort((a, b) => a.price - b.price);
}

/** Live package top offers ('package' or 'lastminute'). */
async function getPackageOffers(kind = 'package') {
  const query = kind === 'lastminute' ? 'product=package&mask=lastminute' : 'product=package';
  const text = await fetchText(TOP_OFFERS_ENDPOINT + '?action=topoffer&rd_type=json&' + query + '&agent=' + PARTNER_ID);
  if (!text) return [];
  try {
    const html = ((JSON.parse(text) || {}).data || {}).offerListHtml;
    return typeof html === 'string' ? parsePackageOffers(html).map((o) => ({ ...o, kind })) : [];
  } catch {
    return [];
  }
}

module.exports = { getFlightOffers, getPackageOffers, parseFlightOffers, parsePackageOffers, parseEuro, plainText, cheapestPerRoute };
