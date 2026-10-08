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
    ctaTitle: 'Jetzt sichern', ctaText: 'Solange die Plätze reichen.', ctaButton: 'Link in der Bio', notice: 'Preise freibleibend, Verfügbarkeit vorbehalten.' },
  ar: { kicker: 'عرض طيران', swipe: '← اسحب للتفاصيل', detailsTitle: 'رحلتك', priceLabel: 'ابتداءً من', perPerson: 'للشخص',
    fromLabel: 'من', toLabel: 'إلى', datesLabel: 'موعد السفر', airlineLabel: 'شركة الطيران',
    ctaTitle: 'احجز الآن', ctaText: 'المقاعد محدودة بهذا السعر.', ctaButton: 'الرابط في البايو', notice: 'الأسعار غير ملزمة وحسب التوفر.' },
  ckb: { kicker: 'پێشنیارا فرۆکێ', swipe: '← بکێشە بۆ وردەکاریان', detailsTitle: 'گەشتا تە', priceLabel: 'ژ', perPerson: 'بۆ هەر کەسەکی',
    fromLabel: 'ژ', toLabel: 'بۆ', datesLabel: 'دەمێ گەشتێ', airlineLabel: 'کۆمپانیا فرۆکێ',
    ctaTitle: 'نوکە بوک بکە', ctaText: 'جهێن ب ڤی نرخی کێمن.', ctaButton: 'لینک د بایۆیێ دایە', notice: 'نرخ نە جێگیرن و ل دویڤ بەردەستبوونێ نە.' },
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
    dates: post.dates, airline: post.airline || '', price: post.price,
  };
  const tpl = fs.readFileSync(path.join(DIR, 'templates', post.style + '.html'), 'utf8');
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'fontCss' || k === 'photo' ? `{{${k}}}` : esc(values[k])));
  // Trusted data URIs are inserted last (they are built here, never from user input).
  html = html.replace('<link rel="stylesheet" href="{{fontCss}}" />', `<style>${fontCss()}</style>`)
    .replace(/\{\{photo\}\}/g, /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(post.photo) ? post.photo : '');
  return renderToPng(html, size);
}

module.exports = { renderSlide, STYLES, SIZES, STYLE_BY_WEEKDAY, LABELS };
