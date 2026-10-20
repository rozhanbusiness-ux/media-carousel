// ============================================================
//  studio/render.js — fill a studio template and export PNG
//  Reuses the existing src/render.js (Puppeteer) without changing it.
//  Fonts, logo and photo are embedded as data URIs so rendering never
//  depends on file paths. Every text value is HTML-escaped.
// ============================================================

const fs = require('fs');
const path = require('path');
const { renderToJpeg } = require('./browser');

const DIR = __dirname;
const STYLES = ['flight', 'flight-cover', 'flight-ticket', 'flight-split', 'flight-diagonal', 'flight-postcard', 'flight-ribbon', 'flight-band'];
const SIZES = ['story', 'portrait', 'square'];

// Monday..Sunday -> style (client decision 2026-10-08).
// Client decision: the full-photo glass template is the default every day; others stay selectable per draft.
const STYLE_BY_WEEKDAY = { 1: 'flight', 2: 'flight', 3: 'flight', 4: 'flight', 5: 'flight', 6: 'flight', 0: 'flight' };

// Package posts (hotel + flight) override a few labels.
const PACKAGE_LABELS = {
  de: { kicker: 'Pauschalreise', detailsTitle: 'Dein Urlaub' },
  ar: { kicker: 'باقة سياحية', detailsTitle: 'عطلتك' },
  kmr: { kicker: 'Rêwîtiya pakêt', detailsTitle: 'Betlaneya te' },
};

const LABELS = {
  de: { kicker: 'Flugangebot', swipe: 'Wischen für Details →', detailsTitle: 'Dein Flug', priceLabel: 'ab', perPerson: 'pro Person',
    fromLabel: 'Ab', toLabel: 'Nach', datesLabel: 'Reisedatum', airlineLabel: 'Airline',
    ctaTitle: 'Jetzt sichern', ctaText: 'Schreib uns auf WhatsApp – die Plätze sind begrenzt.', ctaButton: '', notice: 'Preise schwanken täglich – wer früh bucht, reist günstiger.' },
  ar: { kicker: 'عرض طيران', swipe: '← اسحب للتفاصيل', detailsTitle: 'رحلتك', priceLabel: 'ابتداءً من', perPerson: 'للشخص',
    fromLabel: 'من', toLabel: 'إلى', datesLabel: 'موعد السفر', airlineLabel: 'شركة الطيران',
    ctaTitle: 'احجز الآن', ctaText: 'راسلنا على واتساب – المقاعد محدودة بهذا السعر.', ctaButton: '', notice: 'الأسعار تتغير باستمرار، ومن يحجز أولاً يسافر بسعر أفضل.' },
  kmr: { kicker: 'Pêşniyara firînê', swipe: 'Ji bo hûrguliyan bikişîne →', detailsTitle: 'Firîna te', priceLabel: 'ji', perPerson: 'bo her kesî',
    fromLabel: 'Ji', toLabel: 'Bo', datesLabel: 'Dema rêwîtiyê', airlineLabel: 'Şîrketa firînê',
    ctaTitle: 'Niha rezerv bike', ctaText: 'Li ser WhatsAppê ji me re binivîse – cih bi vê bihayê kêm in.', ctaButton: '', notice: 'Biha her roj diguherin – yê zû rezerv bike, erzantir digere.' },
};

// Slide 3 button: the business WhatsApp number from the server .env (STUDIO_WHATSAPP,
// e.g. "+49 5241 123456"); without it the button shows the website.
function ctaButton() {
  const n = (process.env.STUDIO_WHATSAPP || '').trim();
  return /^\+?[0-9 ]{6,20}$/.test(n) ? '\u2066WhatsApp ' + n + '\u2069' : 'media-travels.com';
}

const validPhoto = (p) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p || '');

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:.85em;height:.85em;vertical-align:-.06em;fill:currentColor;margin:0 .06em"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';

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
// Brand slogan on the last slide of every template (client decision; same look as the website:
// Allura script, "YOU" in gold, gold swash below; never translated). Trusted static HTML.
const SLOGAN_HTML = '<div class="slogan" dir="ltr" lang="en"><span>find your next <b>YOU</b></span>'
  + '<svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M5 14 C 80 2, 160 2, 295 10" fill="none" stroke="#d9b445" stroke-width="2" stroke-linecap="round"/></svg></div>';
const SLOGAN_CSS = '.slogan{display:block;width:max-content;margin:calc(34 * var(--u)) auto 0;position:relative;padding-bottom:calc(14 * var(--u));text-shadow:none}'
  + '.slogan,.slogan *{font-family:"Allura",cursive!important}.slogan{max-width:100%}.slogan span{padding:0 .18em;font-size:calc(66 * var(--u));line-height:1;color:#fff;white-space:nowrap;font-weight:400;text-shadow:0 2px 14px rgba(0,0,0,.45)}'
  + '.slogan b{font-weight:400;font-size:1.28em;background:linear-gradient(135deg,#f7e7a8,#c9a227);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 2px 8px rgba(0,0,0,.4))}'
  + '.panel .slogan{margin-left:0;margin-right:0}.panel .slogan span{font-size:calc(50 * var(--u))}.panel .cta{white-space:nowrap}'
  + '.body .slogan span{color:#0a1838;text-shadow:none}.card .body:has(.slogan){top:auto;bottom:calc(40 * var(--u))}'
  + '.slogan svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:calc(14 * var(--u))}';

// Gold frame (client: slightly thicker, metallic gold): a brushed-gold gradient border with a soft glow.
const FRAME_CSS = '.frame,.lines{border:3px solid transparent!important;border-radius:0!important;'
  + 'border-image:linear-gradient(135deg,#8c6b1c 0%,#f6e3a1 18%,#c9a227 36%,#fff4cc 50%,#b8901f 66%,#f2d98a 82%,#8c6b1c 100%) 1!important;'
  + 'box-shadow:0 0 18px rgba(201,162,39,.25),inset 0 0 0 1px rgba(0,0,0,.18)}';

const PRICE_CSS = '.pr{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;letter-spacing:-.01em;display:inline-flex;align-items:flex-start;direction:ltr;unicode-bidi:isolate;white-space:nowrap;line-height:1}'
  + '.pr.l4{font-size:.8em}.pr.l5{font-size:.68em}.pr .pm{font-size:1em!important}.pr .pt span{font-size:1em!important;line-height:1.05}'
  + '.pr .pt{font-size:.4em!important;display:flex;flex-direction:column;align-items:flex-start;font-size:.4em;line-height:1.05;margin-left:.1em;padding-top:.14em}';

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
 * Returns a JPEG buffer.
 */
async function renderSlide(post, size, slide) {
  if (!STYLES.includes(post.style)) throw new Error('unknown style');
  if (!SIZES.includes(size)) throw new Error('unknown size');
  if (![1, 2, 3].includes(slide)) throw new Error('unknown slide');
  const L = LABELS[post.lang] || LABELS.de;
  const rtl = post.lang === 'ar' || post.lang === 'ckb'; // Kurmanji (kmr) is written with Latin letters
  const values = {
    ...L, ctaButton: ctaButton(), lang: post.lang, dir: rtl ? 'rtl' : 'ltr', size, slide,
    // The script title font is only proven for German letters.
    titleClass: post.lang === 'de' ? 'script' : '',
    photoPosition: /^\d{1,3}% 50%$/.test(post.photoPosition || '') ? post.photoPosition : 'center', logo: LOGO,
    destination: post.destination, hook: post.hook,
    fromCity: post.from.city, fromCode: post.from.code, toCity: post.to.city, toCode: post.to.code,
    dates: '\u2066' + post.dates + '\u2069', price: '%%PRICE%%',
    kind: post.card ? 'package' : 'flight', // every non-flight offer uses the hotel-style card
    country: post.country || '', hotel: '', stars: '', pkgLine: '', place: '',
  };
  if (post.labels) Object.assign(values, post.labels); // bundle cover: own kicker / swipe text
  if (post.card) {
    const c = post.card;
    Object.assign(values, PACKAGE_LABELS[post.lang] || PACKAGE_LABELS.de);
    if (c.kicker) values.kicker = c.kicker;
    if (c.detailsTitle) values.detailsTitle = c.detailsTitle;
    Object.assign(values, { hotel: c.title || '', stars: c.stars || '', place: c.place || '', pkgLine: c.line || '', perPerson: c.per || values.perPerson });
  }
  const priceHtml = buildPriceHtml(post.card ? post.card.priceValue : post.price);
  const tpl = fs.readFileSync(path.join(DIR, 'templates', post.style + '.html'), 'utf8');
  let html = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'fontCss' || k === 'photo' ? `{{${k}}}` : esc(values[k])));
  // Trusted data URIs are inserted last (they are built here, never from user input).
  // Readability on busy photos: soft shadow behind light text (not on the light-background styles).
  const shadow = PRICE_CSS + SLOGAN_CSS + FRAME_CSS + (post.bundle ? '.dots{display:none!important}' : '') + (validPhoto(post.photo) ? '' : 'img[src=""]{visibility:hidden!important}') + (['flight-postcard'].includes(post.style) ? ''
    : '.post :is(.title,.hook,.h,.big,.sub,.kicker,.trk,.caps,.swipe){text-shadow:0 2px 18px rgba(0,0,0,.65),0 0 2px rgba(0,0,0,.35)}');
  html = html.replace('<link rel="stylesheet" href="{{fontCss}}" />', `<style>${fontCss()}${shadow}</style>`)
    .replace(/%%PRICE%%/g, priceHtml)
    .replace(/%%SLOGAN%%/g, SLOGAN_HTML)
    .replace(/\{\{photo\}\}/g, validPhoto(post.photo) ? post.photo : '');
  // Stars as drawn icons: the server has no font with the "★" glyph (it rendered as boxes).
  html = html.replace(/★/g, STAR_SVG);
  return renderToJpeg(html, size);
}

// Templates that also have the hotel card (package, cruise, holiday home posts).
const PACKAGE_STYLES = ['flight', 'flight-cover'];

module.exports = { fontCss, LOGO, SLOGAN_HTML, SLOGAN_CSS, esc, PACKAGE_STYLES, renderSlide, buildPriceHtml, STYLES, SIZES, STYLE_BY_WEEKDAY, LABELS };
