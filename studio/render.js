// ============================================================
//  studio/render.js — fill a studio template and export PNG
//  Reuses the existing src/render.js (Puppeteer) without changing it.
//  Fonts, logo and photo are embedded as data URIs so rendering never
//  depends on file paths. Every text value is HTML-escaped.
// ============================================================

const fs = require('fs');
const path = require('path');
const { renderToPng } = require('../src/render');

const DIR = __dirname;
const STYLES = ['flight', 'flight-ticket', 'flight-split', 'flight-diagonal', 'flight-postcard', 'flight-ribbon', 'flight-band'];
const SIZES = ['story', 'portrait', 'square'];

// Monday..Sunday -> style (client decision 2026-10-08).
const STYLE_BY_WEEKDAY = { 1: 'flight', 2: 'flight-ticket', 3: 'flight-split', 4: 'flight-diagonal', 5: 'flight-postcard', 6: 'flight-ribbon', 0: 'flight-band' };

const LABELS = {
  de: { kicker: 'Flugangebot', swipe: 'Wischen für Details →', detailsTitle: 'Dein Flug', priceLabel: 'ab', perPerson: 'pro Person',
    fromLabel: 'Ab', toLabel: 'Nach', datesLabel: 'Reisedatum', airlineLabel: 'Airline',
    ctaTitle: 'Jetzt sichern', ctaText: 'Solange die Plätze reichen.', ctaButton: 'Link in der Bio', notice: 'Preise können sich je nach Verfügbarkeit ändern.' },
  ar: { kicker: 'عرض طيران', swipe: '← اسحب للتفاصيل', detailsTitle: 'رحلتك', priceLabel: 'ابتداءً من', perPerson: 'للشخص',
    fromLabel: 'من', toLabel: 'إلى', datesLabel: 'موعد السفر', airlineLabel: 'شركة الطيران',
    ctaTitle: 'احجز الآن', ctaText: 'المقاعد محدودة بهذا السعر.', ctaButton: 'الرابط في البايو', notice: 'قد تتغير الأسعار حسب التوفر.' },
  ckb: { kicker: 'پێشنیارا فرۆکێ', swipe: '← بکێشە بۆ وردەکاریان', detailsTitle: 'گەشتا تە', priceLabel: 'ژ', perPerson: 'بۆ هەر کەسەکی',
    fromLabel: 'ژ', toLabel: 'بۆ', datesLabel: 'دەمێ گەشتێ', airlineLabel: 'کۆمپانیا فرۆکێ',
    ctaTitle: 'نوکە بوک بکە', ctaText: 'جهێن ب ڤی نرخی کێمن.', ctaButton: 'لینک د بایۆیێ دایە', notice: 'دبیت نرخ ل دویڤ بەردەستبوونێ بگوهۆڕن.' },
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let FONT_CSS = null;
function fontCss() {
  if (FONT_CSS) return FONT_CSS;
  const css = fs.readFileSync(path.join(DIR, 'fonts', 'fonts.css'), 'utf8');
  FONT_CSS = css.replace(/url\(\.\/([\w.-]+\.woff2)\)/g, (_, f) =>
    `url(data:font/woff2;base64,${fs.readFileSync(path.join(DIR, 'fonts', f)).toString('base64')})`);
  return FONT_CSS;
}

const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, '..', 'templates', 'logo.png')).toString('base64');

// Price: big whole euros, small cents and euro sign top-right; long numbers shrink to stay inside badges.
const PRICE_CSS = '.pr{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;letter-spacing:-.01em;display:inline-flex;align-items:flex-start;direction:ltr;unicode-bidi:isolate;white-space:nowrap;line-height:1}'
  + '.pr.l4{font-size:.8em}.pr.l5{font-size:.68em}'
  + '.pr .pt{display:flex;flex-direction:column;align-items:flex-start;font-size:.4em;line-height:1.05;margin-left:.1em;padding-top:.14em}';

/** Number -> trusted HTML (digits only, never user text). Accepts 184.99 or legacy "184,99 €" strings. */
function buildPriceHtml(price) {
  const n = typeof price === 'number' ? price
    : Number(String(price).replace(/[^\d,]/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n >= 100000) throw new Error('invalid price');
  const [whole, cents] = n.toFixed(2).split('.');
  const main = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const tail = (cents !== '00' ? `<span>,${cents}</span>` : '') + '<span>€</span>';
  return `<span class="pr l${whole.length}"><span class="pm">${main}</span><span class="pt">${tail}</span></span>`;
}

/**
 * Render one slide. `post` = { style, lang, destination, hook, from, to, dates, airline, price, photo (data URI) }.
 * Returns a PNG buffer.
 */
async function renderSlide(post, size, slide) {
  if (!STYLES.includes(post.style)) throw new Error('unknown style');
  if (!SIZES.includes(size)) throw new Error('unknown size');
  if (![1, 2, 3].includes(slide)) throw new Error('unknown slide');
  const L = LABELS[post.lang] || LABELS.de;
  const rtl = post.lang !== 'de';
  const values = {
    ...L, lang: post.lang, dir: rtl ? 'rtl' : 'ltr', size, slide,
    titleClass: rtl ? '' : 'script', photoPosition: 'center', logo: LOGO,
    destination: post.destination, hook: post.hook,
    fromCity: post.from.city, fromCode: post.from.code, toCity: post.to.city, toCode: post.to.code,
    dates: '\u2066' + post.dates + '\u2069', airline: post.airline || '', price: '%%PRICE%%',
  };
  const priceHtml = buildPriceHtml(post.price);
  const tpl = fs.readFileSync(path.join(DIR, 'templates', post.style + '.html'), 'utf8');
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'fontCss' || k === 'photo' ? `{{${k}}}` : esc(values[k])));
  // Trusted data URIs are inserted last (they are built here, never from user input).
  // Readability on busy photos: soft shadow behind light text (not on the light-background styles).
  const shadow = PRICE_CSS + (['flight-postcard'].includes(post.style) ? ''
    : '.post :is(.title,.hook,.h,.big,.sub,.kicker,.trk,.caps,.swipe){text-shadow:0 2px 18px rgba(0,0,0,.65),0 0 2px rgba(0,0,0,.35)}');
  html = html.replace('<link rel="stylesheet" href="{{fontCss}}" />', `<style>${fontCss()}${shadow}</style>`)
    .replace(/%%PRICE%%/g, priceHtml)
    .replace(/\{\{photo\}\}/g, /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(post.photo) ? post.photo : '');
  return renderToPng(html, size);
}

module.exports = { renderSlide, buildPriceHtml, STYLES, SIZES, STYLE_BY_WEEKDAY, LABELS };
