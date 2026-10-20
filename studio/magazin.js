// ============================================================
//  studio/magazin.js — the "Magazin" slides for "Ideen des Tages"
//  (mock approved by the client 2026-10-20, with two changes: darker
//  title area on the cover, story slide photo without blur).
//   1. cover: full photo, logo, kicker + place, big serif hook
//   2. story: the sharp photo, darkened, with the story text
//   3. close: last line of the story, slogan, logo, source + photo credit
//  Same brand as the offer templates (navy, gold, DM Serif Display).
//  Every text is HTML-escaped; photo, fonts and logo are data URIs.
// ============================================================

const { renderToJpeg } = require('./browser');
const { fontCss, LOGO, SLOGAN_HTML, SLOGAN_CSS, esc } = require('./render');

const KICKER = {
  german_city: { de: 'Deutschland', ar: 'ألمانيا', kmr: 'Almanya' },
  lake: { de: 'Seen', ar: 'بحيرات', kmr: 'Gol' },
  mountain: { de: 'Berge', ar: 'جبال', kmr: 'Çiya' },
  coast: { de: 'Küste', ar: 'سواحل', kmr: 'Perav' },
  island: { de: 'Inseln', ar: 'جزر', kmr: 'Girav' },
  village: { de: 'Dörfer', ar: 'قرى', kmr: 'Gund' },
  capital: { de: 'Hauptstädte', ar: 'عواصم', kmr: 'Paytext' },
  kurdistan: { de: 'Kurdistan', ar: 'كردستان', kmr: 'Kurdistan' },
  uae: { de: 'Emirate', ar: 'الإمارات', kmr: 'Mîrnişîn' },
  world: { de: 'Welt', ar: 'حول العالم', kmr: 'Cîhan' },
  tip: { de: 'Reisetipp', ar: 'نصيحة سفر', kmr: 'Şîreta rêwîtiyê' },
};
const UI = {
  de: { swipe: 'Wischen →', story: 'Erlebnis', source: 'Quelle', photo: 'Foto' },
  ar: { swipe: '← اسحب', story: 'تجربة', source: 'المصدر', photo: 'صورة' },
  kmr: { swipe: 'Bikişîne →', story: 'Serpêhatî', source: 'Çavkanî', photo: 'Wêne' },
};

/** Story text → { middle, last }: the last sentence closes the post on slide 3. */
function splitBody(body) {
  const parts = String(body || '').trim().split(/(?<=[.!?؟…])\s+/u).filter(Boolean);
  // A closing emoji ("… haben. ⛰️") belongs to the last sentence, not on its own.
  while (parts.length > 1 && !/[\p{L}\p{N}]/u.test(parts[parts.length - 1])) parts.splice(-2, 2, `${parts[parts.length - 2]} ${parts[parts.length - 1]}`);
  if (parts.length < 2) return { middle: parts.join(' '), last: '' };
  return { middle: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

const CSS = `
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;overflow:hidden;background:#050a1f}
.s{position:relative;width:1080px;height:1350px;overflow:hidden;color:#fff;font-family:"Plus Jakarta Sans","IBM Plex Sans Arabic",sans-serif}
.rtl .s{font-family:"IBM Plex Sans Arabic",sans-serif}
.bg{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}
.serif{font-family:"DM Serif Display","IBM Plex Sans Arabic",serif;font-weight:400}
.rtl .serif{font-family:"IBM Plex Sans Arabic",sans-serif;font-weight:700}
.logo{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:190px}
.dots{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;gap:10px;direction:ltr}
.dots i{width:10px;height:10px;border-radius:9px;background:rgba(255,255,255,.4)}.dots i.on{width:34px;background:#e6c25a}
/* 1 cover: darker title area (client) */
.c .shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(5,10,31,.45) 0%,rgba(5,10,31,0) 22%,rgba(5,10,31,0) 38%,rgba(5,10,31,.72) 62%,rgba(5,10,31,.96) 100%)}
.c .foot{position:absolute;left:80px;right:80px;bottom:150px;display:flex;flex-direction:column;gap:18px}
.kick{font-size:26px;letter-spacing:10px;color:#e6c25a;text-transform:uppercase;font-weight:600}
.rtl .kick{letter-spacing:0;font-size:32px}
.place{font-size:30px;letter-spacing:3px;color:rgba(255,255,255,.85);text-transform:uppercase;margin-bottom:8px}
.rtl .place{letter-spacing:0}
.hook{font-size:88px;line-height:1.08;text-shadow:0 2px 24px rgba(0,0,0,.6)}
.rtl .hook{font-size:76px;line-height:1.3}
.line{position:absolute;left:80px;bottom:110px;width:120px;height:3px;background:#e6c25a}
.rtl .line{left:auto;right:80px}
.swipe{position:absolute;right:80px;bottom:80px;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,.75);text-transform:uppercase}
.rtl .swipe{right:auto;left:80px;letter-spacing:0}
/* 2 story: sharp photo, no blur (client 2026-10-20); darkened so the text stays readable */
.t .bg{filter:brightness(.55)}
.t .shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(5,10,31,.55),rgba(5,10,31,.35) 50%,rgba(5,10,31,.7))}
.t .q{position:absolute;left:100px;right:100px;top:150px;font-size:24px;letter-spacing:10px;color:#e6c25a;text-transform:uppercase;font-weight:600}
.rtl .t .q{letter-spacing:0;font-size:30px}
.t .txt{position:absolute;left:100px;right:100px;top:230px;font-size:50px;line-height:1.42;text-shadow:0 2px 18px rgba(0,0,0,.55)}
.rtl .t .txt{font-size:46px;line-height:1.7}
/* 3 close */
.e .bg{filter:brightness(.35)}
.e .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:0 110px}
.e .end{font-size:64px;line-height:1.22;text-shadow:0 2px 18px rgba(0,0,0,.5)}
.rtl .e .end{font-size:56px;line-height:1.5}
.e .lg{width:170px}
.e .src{position:absolute;bottom:72px;left:60px;right:60px;text-align:center;font-size:20px;color:rgba(255,255,255,.65);line-height:1.5}
`;

function slideHtml(n, v) {
  const dots = `<div class="dots">${[1, 2, 3].map((i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;
  const bg = `<div class="bg" style="background-image:url('${v.photo}');background-position:${v.pos}"></div>`;
  const body = n === 1
    ? `<div class="s c">${bg}<div class="shade"></div><img class="logo" src="${LOGO}" alt="">
        <div class="foot"><div class="kick">${esc(v.kicker)}</div>${v.place ? `<div class="place">${esc(v.place)}</div>` : ''}<div class="hook serif">${esc(v.hook)}</div></div>
        <div class="line"></div><div class="swipe">${esc(v.ui.swipe)}</div>${dots}</div>`
    : n === 2
      ? `<div class="s t">${bg}<div class="shade"></div><div class="q">${esc(v.ui.story)}</div><div class="txt serif">${esc(v.middle)}</div>${dots}</div>`
      : `<div class="s e">${bg}<div class="mid">${v.last ? `<div class="end serif">${esc(v.last)}</div>` : ''}%%SLOGAN%%<img class="lg" src="${LOGO}" alt=""></div>
        <div class="src">${esc(v.credit)}</div>${dots}</div>`;
  return `<!doctype html><html lang="${v.lang}" dir="${v.dir}" class="${v.dir}"><head><meta charset="utf-8"><style>${fontCss()}${SLOGAN_CSS}:root{--u:1px}${CSS}</style></head><body>${body}</body></html>`
    .replace('%%SLOGAN%%', SLOGAN_HTML);
}

const validPhoto = (p) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p || '');

/** Values for one language of an idea (pure; tested without a browser). */
function slideValues(idea, lang, photo) {
  const t = idea.texts[lang];
  if (!t) throw new Error('language not in this idea');
  if (!validPhoto(photo)) throw new Error('no photo');
  const ui = UI[lang] || UI.de;
  const { middle, last } = splitBody(t.body);
  const c = (idea.photo && idea.photo.credit) || {};
  const credit = [
    `${ui.source}: ${(idea.sources || []).map((s) => s.title).join(', ')}`,
    c.author ? `${ui.photo}: ${c.author} / ${c.source}${/Wikimedia/.test(c.source || '') && c.license ? ` (${c.license})` : ''}` : '',
  ].filter(Boolean).join(' · ');
  const x = idea.photo && Number.isInteger(idea.photo.x) ? idea.photo.x : 50;
  return {
    lang, dir: lang === 'ar' ? 'rtl' : 'ltr', ui, photo, pos: `${x}% 50%`,
    kicker: (KICKER[idea.kind === 'tip' ? 'tip' : idea.type] || KICKER.world)[lang] || '',
    place: idea.kind === 'tip' ? '' : idea.place || '', hook: t.hook, middle: middle || t.body, last, credit,
  };
}

/** The three slides (JPEG buffers, 1080x1350 at 2x) for one language. */
async function renderMagazin(idea, lang, photo) {
  const v = slideValues(idea, lang, photo);
  const out = [];
  for (const n of [1, 2, 3]) out.push(await renderToJpeg(slideHtml(n, v), 'portrait'));
  return out;
}

module.exports = { renderMagazin, slideValues, slideHtml, splitBody, KICKER };
