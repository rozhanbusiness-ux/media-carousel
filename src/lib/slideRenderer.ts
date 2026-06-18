import { Carousel, CarouselItem, FlightRoute, SLIDE_DIMENSIONS, SlideSize } from '../types';

const NAVY = '#001F3F';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const FOOTER_PHONE = '+491 765 8866 999';
const FOOTER_EMAIL = 'info@media-travels.com';

/** Normalize ligatures and odd whitespace that PDF extraction can leave behind */
function clean(text: string): string {
  // NFKD normalization splits ligatures; then explicit replacements for any that survive
  let s = (text ?? '').normalize('NFKD');
  s = s
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/ﬅ/g, 'st')
    .replace(/ﬆ/g, 'st')
    .replace(/[­​‌‍﻿]/g, '')
    .replace(/[     ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

/** Boost saturation & contrast of the drawn photo so colors pop (matches the vivid template look) */
function boostContrast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const contrast = 1.12;
  const sat = 1.28;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    // contrast
    r = r * contrast + intercept;
    g = g * contrast + intercept;
    b = b * contrast + intercept;
    // saturation around luma
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * sat;
    g = lum + (g - lum) * sat;
    b = lum + (b - lum) * sat;
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw image to cover the whole canvas (center-crop, no distortion) */
function coverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function createCanvas(size: SlideSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const { width, height } = SLIDE_DIMENSIONS[size];
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Gold line footer + phone left + email right */
function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const lineY = h - Math.round(h * 0.052);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.round(w * 0.05), lineY);
  ctx.lineTo(w - Math.round(w * 0.05), lineY);
  ctx.stroke();

  const fs = Math.round(w * 0.026);
  ctx.font = `${fs}px Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(FOOTER_PHONE, Math.round(w * 0.05), h - Math.round(h * 0.012));
  ctx.textAlign = 'right';
  ctx.fillText(FOOTER_EMAIL, w - Math.round(w * 0.05), h - Math.round(h * 0.012));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** MEDIA logo top-center, 28% of slide width */
async function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    // Respect Vite base path so the logo loads on GitHub Pages (/media-carousel/logo.png)
    const base = import.meta.env.BASE_URL ?? '/';
    const logo = await loadImage(`${base}logo.png`);
    const logoW = Math.round(w * 0.28);
    const logoH = Math.round(logoW * (logo.height / logo.width));
    ctx.drawImage(logo, (w - logoW) / 2, Math.round(h * 0.038), logoW, logoH);
  } catch {
    // no logo — skip
  }
}

/** Navy-to-transparent gradient over the bottom 45% of a photo slide */
function drawBottomGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const gradStart = h * 0.55;
  const grad = ctx.createLinearGradient(0, gradStart, 0, h);
  grad.addColorStop(0, 'rgba(0,31,63,0)');
  grad.addColorStop(0.6, 'rgba(0,31,63,0.88)');
  grad.addColorStop(1, 'rgba(0,31,63,0.98)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradStart, w, h - gradStart);
}

/** Wrap text that's too wide, returns lines array */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Slide 1: Hook ───────────────────────────────────────────────────────────

export async function renderHookSlide(
  offer: Pick<Carousel, 'destination' | 'hookHeadline' | 'hookTagline'>,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  // Background photo
  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);

  // Full-slide dark gradient (stronger at top and bottom for text readability)
  const vignette = ctx.createLinearGradient(0, 0, 0, h);
  vignette.addColorStop(0, 'rgba(0,20,50,0.45)');
  vignette.addColorStop(0.3, 'rgba(0,20,50,0.05)');
  vignette.addColorStop(0.7, 'rgba(0,20,50,0.1)');
  vignette.addColorStop(1, 'rgba(0,20,50,0.75)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  // Destination name — large, centered, vertical center
  const destFs = Math.round(w * 0.1);
  ctx.font = `bold ${destFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(clean(offer.destination), w / 2, h * 0.48);

  // Gold divider under destination
  const divW = Math.round(w * 0.45);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((w - divW) / 2, h * 0.5);
  ctx.lineTo((w + divW) / 2, h * 0.5);
  ctx.stroke();

  // Headline (e.g. "Sommer Angebote") — italic gold script
  const hlFs = Math.round(w * 0.065);
  ctx.font = `italic bold ${hlFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(clean(offer.hookHeadline), w / 2, h * 0.5 + Math.round(hlFs * 1.6));

  // Tagline (e.g. "Luxus am Meer - Jetzt buchen!") — small white
  const tagFs = Math.round(w * 0.038);
  ctx.font = `${tagFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.9;
  ctx.fillText(clean(offer.hookTagline), w / 2, h * 0.5 + Math.round(hlFs * 1.6) + Math.round(tagFs * 2));
  ctx.globalAlpha = 1;

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Slide A: Item Visual ────────────────────────────────────────────────────

export async function renderVisualSlide(
  item: CarouselItem,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);
  drawBottomGradient(ctx, w, h);

  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Item name (wrapped, centered) — positioned bottom block
  const name = clean(item.name);
  const location = clean(item.subtitle);
  const nameFs = Math.round(w * 0.07);
  ctx.font = `bold ${nameFs}px Georgia, serif`;
  const nameLines = wrapText(ctx, name, w * 0.86);
  const lineH = Math.round(nameFs * 1.15);

  const locFs = Math.round(w * 0.036);
  ctx.font = `${locFs}px Arial, sans-serif`;
  const locLines = wrapText(ctx, location, w * 0.86);
  const locLineH = Math.round(locFs * 1.25);

  const hasRating = item.rating > 0;
  const ratingFs = Math.round(w * 0.036);
  const ratingGap = hasRating ? Math.round(ratingFs * 2.2) : 0;

  // Compute total block height and anchor it near the bottom
  const blockH = nameLines.length * lineH + Math.round(locFs * 0.6) + locLines.length * locLineH + ratingGap;
  let cursorY = h * 0.9 - blockH;

  ctx.font = `bold ${nameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  nameLines.forEach((line) => {
    cursorY += lineH;
    ctx.fillText(line, w / 2, cursorY);
  });

  cursorY += Math.round(locFs * 0.6);
  ctx.font = `${locFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.85;
  locLines.forEach((line) => {
    cursorY += locLineH;
    ctx.fillText(line, w / 2, cursorY);
  });
  ctx.globalAlpha = 1;

  if (hasRating) {
    cursorY += ratingGap;
    ctx.font = `bold ${ratingFs}px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(`${item.rating}% Bewertung`, w / 2, cursorY);
  }

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Slide B: Item Details ────────────────────────────────────────────────────

export async function renderDetailsSlide(item: CarouselItem, size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  // Item name
  const nameFs = Math.round(w * 0.058);
  ctx.font = `bold ${nameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameLines = wrapText(ctx, clean(item.name), w * 0.82);
  const nameY = Math.round(h * 0.2);
  nameLines.forEach((line, i) => ctx.fillText(line, w / 2, nameY + i * Math.round(nameFs * 1.2)));
  const belowName = nameY + nameLines.length * Math.round(nameFs * 1.2);

  const hasPrice = !!item.price && item.price.trim() !== '';

  // Price block (only if there is a price)
  let divY: number;
  if (hasPrice) {
    const priceBlockY = belowName + Math.round(h * 0.05);
    const abFs = Math.round(w * 0.042);
    const numFs = Math.round(w * 0.11);
    const eurFs = Math.round(w * 0.055);
    const gap = Math.round(w * 0.018);

    const abText = 'ab ';
    ctx.font = `${abFs}px Arial, sans-serif`;
    const abW = ctx.measureText(abText).width;
    ctx.font = `bold ${numFs}px Georgia, serif`;
    const numW = ctx.measureText(item.price).width;
    ctx.font = `bold ${eurFs}px Georgia, serif`;
    const eurW = ctx.measureText(' €').width;

    const totalW = abW + gap + numW + gap + eurW;
    let cursorX = (w - totalW) / 2;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = `${abFs}px Arial, sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText(abText, cursorX, priceBlockY);
    cursorX += abW + gap;

    ctx.font = `bold ${numFs}px Georgia, serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(item.price, cursorX, priceBlockY);
    cursorX += numW + gap;

    ctx.font = `bold ${eurFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText('€', cursorX, priceBlockY);

    ctx.textAlign = 'center';
    divY = priceBlockY + Math.round(h * 0.02);
  } else {
    divY = belowName + Math.round(h * 0.035);
  }

  // Gold divider
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, divY);
  ctx.lineTo(w * 0.9, divY);
  ctx.stroke();

  // Detail rows — generic, from item.rows; append rating if present and not already a row
  const rows = [...(item.rows ?? [])];
  if (item.rating > 0 && !rows.some((r) => /bewertung|rating/i.test(r.label))) {
    rows.push({ label: 'Bewertung', value: `${item.rating}%`, icon: '⭐' });
  }

  const rowsStartY = divY + Math.round(h * 0.03);
  const rowsEndY = h * 0.895;
  const rowH = rows.length > 0 ? (rowsEndY - rowsStartY) / rows.length : 0;
  const labelFs = Math.round(w * 0.032);
  const valueFs = Math.round(w * 0.042);
  const iconX = w * 0.1;
  const labelX = w * 0.18;

  rows.forEach((row, i) => {
    const midY = rowsStartY + i * rowH + rowH / 2;

    if (i > 0) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(w * 0.08, rowsStartY + i * rowH);
      ctx.lineTo(w * 0.92, rowsStartY + i * rowH);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.font = `${valueFs}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = WHITE;
    ctx.fillText(row.icon || '•', iconX, midY);

    ctx.font = `bold ${labelFs}px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean(row.label), labelX, midY - Math.round(labelFs * 0.7));

    ctx.font = `${valueFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    const valLines = wrapText(ctx, clean(row.value), w * 0.72);
    ctx.fillText(valLines[0] ?? '', labelX, midY + Math.round(valueFs * 0.55));
  });

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Regular post slide: headline + body text over photo ──────────────────────

export async function renderPostSlide(
  carousel: Pick<Carousel, 'destination' | 'hookHeadline' | 'body'>,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);

  // strong full overlay for text readability
  const overlay = ctx.createLinearGradient(0, 0, 0, h);
  overlay.addColorStop(0, 'rgba(0,20,50,0.55)');
  overlay.addColorStop(0.5, 'rgba(0,20,50,0.35)');
  overlay.addColorStop(1, 'rgba(0,20,50,0.85)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Headline
  const hlFs = Math.round(w * 0.078);
  ctx.font = `bold ${hlFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  const hlLines = wrapText(ctx, clean(carousel.hookHeadline || carousel.destination), w * 0.84);
  let y = h * 0.4 - (hlLines.length - 1) * hlFs * 0.6;
  hlLines.forEach((line) => { ctx.fillText(line, w / 2, y); y += Math.round(hlFs * 1.15); });

  // gold divider
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, y + Math.round(h * 0.005));
  ctx.lineTo(w * 0.7, y + Math.round(h * 0.005));
  ctx.stroke();
  y += Math.round(h * 0.05);

  // Body
  const bodyFs = Math.round(w * 0.044);
  ctx.font = `${bodyFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  const bodyLines = wrapText(ctx, clean(carousel.body ?? ''), w * 0.82);
  bodyLines.forEach((line) => { ctx.fillText(line, w / 2, y); y += Math.round(bodyFs * 1.4); });

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Flight Slide 1: Visual (airplane + cities + destination) ─────────────────

/** Derive the cities subtitle: "Frankfurt → Antalya" or "Verschiedene Routen" */
function flightCitiesLine(flights: FlightRoute[]): string {
  const outs = flights
    .map((f) => f.legs.find((l) => /hin/i.test(l.direction)) ?? f.legs[0])
    .filter(Boolean);
  if (outs.length === 0) return '';
  const froms = new Set(outs.map((l) => l!.from.replace(/\s*\(.*\)/, '').trim()));
  const tos = new Set(outs.map((l) => l!.to.replace(/\s*\(.*\)/, '').trim()));
  const from = froms.size === 1 ? [...froms][0] : 'Mehrere Abflüge';
  const to = tos.size === 1 ? [...tos][0] : 'Mehrere Ziele';
  return `${from}  ✈  ${to}`;
}

export async function renderFlightVisualSlide(
  carousel: Carousel,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);

  const vignette = ctx.createLinearGradient(0, 0, 0, h);
  vignette.addColorStop(0, 'rgba(0,20,50,0.5)');
  vignette.addColorStop(0.35, 'rgba(0,20,50,0.05)');
  vignette.addColorStop(0.7, 'rgba(0,20,50,0.15)');
  vignette.addColorStop(1, 'rgba(0,20,50,0.8)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Headline (e.g. "Flugangebote")
  const hlFs = Math.round(w * 0.05);
  ctx.font = `italic bold ${hlFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(clean(carousel.hookHeadline || 'Flugangebote'), w / 2, h * 0.4);

  // Destination — large
  const destFs = Math.round(w * 0.1);
  ctx.font = `bold ${destFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  const destLines = wrapText(ctx, clean(carousel.destination), w * 0.86);
  let y = h * 0.5;
  destLines.forEach((line) => { ctx.fillText(line, w / 2, y); y += Math.round(destFs * 1.12); });

  // Gold divider
  const divW = Math.round(w * 0.45);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo((w - divW) / 2, y);
  ctx.lineTo((w + divW) / 2, y);
  ctx.stroke();
  y += Math.round(h * 0.04);

  // Cities line (Frankfurt ✈ Antalya)
  const cities = flightCitiesLine(carousel.flights ?? []);
  if (cities) {
    const cFs = Math.round(w * 0.05);
    ctx.font = `bold ${cFs}px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(cities, w / 2, y);
    y += Math.round(cFs * 1.4);
  }

  // Tagline
  if (carousel.hookTagline) {
    const tagFs = Math.round(w * 0.036);
    ctx.font = `${tagFs}px Arial, sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = 0.9;
    ctx.fillText(clean(carousel.hookTagline), w / 2, y);
    ctx.globalAlpha = 1;
  }

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Flight Slide 2: Details (all routes + prices, ذهاب/عودة separated) ────────

export async function renderFlightDetailsSlide(carousel: Carousel, size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);
  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Header
  const titleFs = Math.round(w * 0.052);
  ctx.font = `bold ${titleFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Flugdetails', w / 2, h * 0.17);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.185);
  ctx.lineTo(w * 0.9, h * 0.185);
  ctx.stroke();

  const flights = carousel.flights ?? [];
  const areaTop = h * 0.21;
  const areaBottom = h * 0.895;
  const count = Math.max(flights.length, 1);
  const blockH = (areaBottom - areaTop) / count;
  const padX = w * 0.08;

  flights.forEach((f, i) => {
    const top = areaTop + i * blockH;

    // separator between cards
    if (i > 0) {
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, top);
      ctx.lineTo(w - padX, top);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    let yy = top + blockH * 0.22;

    // Route title (left) + price (right)
    const routeFs = Math.round(w * 0.042);
    ctx.font = `bold ${routeFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'left';
    ctx.fillText(clean(f.title || carousel.destination), padX, yy);

    if (f.price) {
      const pFs = Math.round(w * 0.055);
      ctx.font = `bold ${pFs}px Georgia, serif`;
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'right';
      ctx.fillText(`${clean(f.price)} €`, w - padX, yy);
    }

    // airline / class / baggage line
    const meta = [f.airline, f.flightClass, f.baggage ? `🧳 ${f.baggage}` : '', f.priceNote]
      .filter((s) => s && s.trim()).map(clean).join('  ·  ');
    if (meta) {
      const mFs = Math.round(w * 0.03);
      ctx.font = `${mFs}px Arial, sans-serif`;
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 0.9;
      yy += Math.round(mFs * 1.5);
      ctx.fillText(meta, padX, yy);
      ctx.globalAlpha = 1;
    }

    // legs (Hinflug / Rückflug) — clearly separated lines
    const legFs = Math.round(w * 0.032);
    f.legs.forEach((leg) => {
      yy += Math.round(legFs * 1.7);
      const icon = /rück/i.test(leg.direction) ? '🛬' : '🛫';
      // direction label (gold, fixed width) + route
      ctx.font = `bold ${legFs}px Arial, sans-serif`;
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'left';
      ctx.fillText(`${icon} ${clean(leg.direction)}`, padX, yy);

      const route = `${clean(leg.from)} → ${clean(leg.to)}`;
      const dt = [leg.date, leg.time].filter((s) => s && s.trim()).map(clean).join('  ');
      ctx.font = `${legFs}px Georgia, serif`;
      ctx.fillStyle = WHITE;
      ctx.textAlign = 'left';
      ctx.fillText(route, padX + w * 0.26, yy);

      if (dt) {
        ctx.fillStyle = WHITE;
        ctx.globalAlpha = 0.8;
        ctx.textAlign = 'right';
        ctx.font = `${Math.round(legFs * 0.85)}px Arial, sans-serif`;
        ctx.fillText(dt, w - padX, yy);
        ctx.globalAlpha = 1;
      }
    });
  });

  ctx.textAlign = 'center';
  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Last Slide: CTA ──────────────────────────────────────────────────────────

export async function renderCtaSlide(size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);

  // subtle radial glow
  const radial = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.65);
  radial.addColorStop(0, 'rgba(20,55,100,0.55)');
  radial.addColorStop(1, 'rgba(0,31,63,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  const bigFs = Math.round(w * 0.135);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = `bold ${bigFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Jetzt', w / 2, h * 0.43);

  ctx.fillStyle = GOLD;
  ctx.fillText('buchen!', w / 2, h * 0.43 + bigFs * 1.18);

  // gold divider
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.58);
  ctx.lineTo(w * 0.72, h * 0.58);
  ctx.stroke();

  const subFs = Math.round(w * 0.038);
  ctx.font = `${subFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Kontaktiere uns heute', w / 2, h * 0.635);

  ctx.font = `bold ${Math.round(w * 0.036)}px Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(`📞 ${FOOTER_PHONE}`, w / 2, h * 0.695);
  ctx.fillText(`✉ ${FOOTER_EMAIL.toUpperCase()}`, w / 2, h * 0.75);

  // italic script outro
  ctx.font = `italic ${Math.round(w * 0.052)}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText('Dein Traumurlaub wartet!', w / 2, h * 0.855);

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}
