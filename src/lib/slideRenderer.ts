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

// ─── Flight Slide 1: Cover (airplane background, destination title) ───────────

/** Strip airport code parentheses, e.g. "Frankfurt (FRA)" → "Frankfurt" */
function cityShort(s: string): string {
  return s.replace(/\s*\(.*\)/, '').trim();
}

/** Looks like a bare airport code (e.g. "DUS", "EBL") rather than a city name */
function isCode(s: string): boolean {
  return /^[A-Z]{2,4}$/.test(s.trim());
}

/** Resolve full departure & arrival city names for a route, preferring the title,
 * falling back to the outbound leg. Avoids showing bare airport codes. */
function routeCities(route: FlightRoute): { dep: string; arr: string } {
  const parts = (route.title || '')
    .split(/→|⇌|⇄|»|–|nach/i)
    .map((s) => cityShort(s))
    .filter(Boolean);
  let dep = parts[0] ?? '';
  let arr = parts[1] ?? '';

  const outLeg = route.legs.find((l) => /hin/i.test(l.direction)) ?? route.legs[0];
  const legFrom = cityShort(outLeg?.from || '');
  const legTo = cityShort(outLeg?.to || '');

  // Prefer a non-code value
  if (!dep || isCode(dep)) dep = (!isCode(legFrom) && legFrom) || dep || legFrom;
  if (!arr || isCode(arr)) arr = (!isCode(legTo) && legTo) || arr || legTo;
  return { dep, arr };
}

export async function renderFlightCoverSlide(
  carousel: Pick<Carousel, 'destination' | 'hookHeadline' | 'hookTagline'>,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);

  // Vignette: top 30% light, bottom 28% very dark
  const vignette = ctx.createLinearGradient(0, 0, 0, h);
  vignette.addColorStop(0, 'rgba(0,10,30,0.55)');
  vignette.addColorStop(0.3, 'rgba(0,10,30,0.10)');
  vignette.addColorStop(0.72, 'rgba(0,10,30,0.15)');
  vignette.addColorStop(1, 'rgba(0,10,30,0.95)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Fixed cover title — large bold caps
  const destFs = Math.round(w * 0.115);
  ctx.font = `bold ${destFs}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('DIREKTE FLÜGE', w / 2, h * 0.34);

  // hookHeadline — italic bold gold script (e.g. "Juli Angebote")
  const hlFs = Math.round(w * 0.095);
  ctx.font = `italic bold ${hlFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(clean(carousel.hookHeadline || 'Flugangebote'), w / 2, h * 0.62);

  // Tagline
  const tagFs = Math.round(w * 0.046);
  ctx.font = `bold ${tagFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText(clean(carousel.hookTagline || 'Luxus & Komfort - Jetzt buchen!'), w / 2, h * 0.82);

  // Contact row: phone anchored left, email anchored right (no overlap)
  drawCornerContacts(ctx, w, h * 0.88);

  ctx.textBaseline = 'alphabetic';

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

/** Phone group bottom-left, email group bottom-right — circular gold icons */
function drawCornerContacts(ctx: CanvasRenderingContext2D, w: number, y: number) {
  const r = Math.round(w * 0.026);
  const fs = Math.round(w * 0.03);
  const gap = Math.round(w * 0.014);

  // Phone — left
  let cx = Math.round(w * 0.07);
  ctx.beginPath();
  ctx.arc(cx + r, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${Math.round(r * 1.05)}px Arial`;
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('📞', cx + r, y);
  ctx.font = `${fs}px Arial, sans-serif`;
  ctx.fillStyle = GOLD; ctx.textAlign = 'left';
  ctx.fillText(FOOTER_PHONE, cx + 2 * r + gap, y);

  // Email — right (right-align the text to 0.93w, circle before it)
  ctx.font = `${fs}px Arial, sans-serif`;
  const ew = ctx.measureText(FOOTER_EMAIL).width;
  const textX = Math.round(w * 0.93) - ew;
  const circleX = textX - gap - r;
  ctx.beginPath();
  ctx.arc(circleX, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${Math.round(r * 1.05)}px Arial`;
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✉', circleX, y);
  ctx.font = `${fs}px Arial, sans-serif`;
  ctx.fillStyle = GOLD; ctx.textAlign = 'left';
  ctx.fillText(FOOTER_EMAIL, textX, y);
  ctx.textBaseline = 'alphabetic';
}

// ─── Flight Slide 2: Route slide (city photo + departure/arrival + price/info) ─

export async function renderFlightRouteSlide(
  route: FlightRoute,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  coverImage(ctx, bg, w, h);
  boostContrast(ctx, w, h);

  const aspect = h / w;
  const photoFrac = Math.min(0.65, 0.38 + aspect * 0.155);

  // Top vignette so the gold logo stays legible over bright skies
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.18);
  topGrad.addColorStop(0, 'rgba(0,15,45,0.55)');
  topGrad.addColorStop(1, 'rgba(0,15,45,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * 0.18);

  // Bottom dark gradient
  const gradStart = photoFrac * 0.85;
  const grad = ctx.createLinearGradient(0, gradStart * h, 0, h);
  grad.addColorStop(0, 'rgba(0,15,45,0)');
  grad.addColorStop(1, 'rgba(0,15,45,0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradStart * h, w, h - gradStart * h);

  await drawLogo(ctx, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const outLeg = route.legs.find((l) => /hin/i.test(l.direction)) ?? route.legs[0];
  const retLeg = route.legs.find((l) => /rück/i.test(l.direction));
  const outDate = outLeg?.date || '';
  const retDate = retLeg?.date || '';
  const { dep, arr } = routeCities(route);
  const fromCity = dep.toUpperCase();
  const toCity = arr;

  // Departure city — HUGE white bold
  const cityFs = Math.round(w * 0.165);
  ctx.font = `900 ${cityFs}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  const cityLines = wrapText(ctx, fromCity, w * 0.9);
  let y = h * photoFrac - Math.round(cityFs * 0.1);
  cityLines.forEach((line) => { ctx.fillText(line, w / 2, y); y += cityFs * 1.0; });

  // Destination city — smaller gold italic
  const destFs = Math.round(w * 0.055);
  ctx.font = `italic ${destFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  y += Math.round(destFs * 0.3);
  ctx.fillText(clean(toCity), w / 2, y);
  y += Math.round(destFs * 1.4);

  // Sparkle divider
  const sparkY = y + Math.round(h * 0.01);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, sparkY);
  ctx.lineTo(w * 0.42, sparkY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.58, sparkY);
  ctx.lineTo(w * 0.88, sparkY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const sparkFs = Math.round(w * 0.042);
  ctx.font = `${sparkFs}px Arial`;
  ctx.fillStyle = GOLD;
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', w / 2, sparkY);
  ctx.textBaseline = 'alphabetic';
  y = sparkY + Math.round(h * 0.04);

  // Price block: "ab [N] €"
  if (route.price) {
    const abText = 'ab ';
    const abFs = Math.round(w * 0.052);
    const numFs = Math.round(w * 0.20);
    const eurFs = Math.round(w * 0.075);
    const gap = Math.round(w * 0.02);

    ctx.font = `${abFs}px Arial, sans-serif`;
    const abW = ctx.measureText(abText).width;
    ctx.font = `bold ${numFs}px Georgia, serif`;
    const numW = ctx.measureText(clean(route.price)).width;
    ctx.font = `bold ${eurFs}px Georgia, serif`;
    const eurW = ctx.measureText('€').width;
    const totalW = abW + gap + numW + gap + eurW;
    let cx = (w - totalW) / 2;

    ctx.textAlign = 'left';
    ctx.font = `${abFs}px Arial, sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText(abText, cx, y);
    cx += abW + gap;
    ctx.font = `bold ${numFs}px Georgia, serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(clean(route.price), cx, y);
    cx += numW + gap;
    ctx.font = `bold ${eurFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText('€', cx, y);
    ctx.textAlign = 'center';
    y += Math.round(numFs * 0.2);
  }

  // 2x2 info grid
  const gridY1 = h * (photoFrac + (1 - photoFrac) * 0.78);
  const gridY2 = h * (photoFrac + (1 - photoFrac) * 0.91);
  const col1X = w * 0.20;
  const col2X = w * 0.62;
  const iconFs = Math.round(w * 0.042);
  const infoFs = Math.round(w * 0.038);

  const drawInfoCell = (cellY: number, colX: number, icon: string, text: string) => {
    if (!text) return;
    ctx.font = `${iconFs}px Arial`;
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, colX, cellY);
    ctx.font = `bold ${infoFs}px Arial, sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText(text, colX + w * 0.065, cellY);
    ctx.textBaseline = 'alphabetic';
  };

  drawInfoCell(gridY1, col1X, '📅', outDate);
  if (retDate) drawInfoCell(gridY1, col2X, '📅', retDate);
  if (route.baggage) drawInfoCell(gridY2, col1X, '🧳', route.baggage);
  if (route.baggageCabin) drawInfoCell(gridY2, col2X, '💼', route.baggageCabin);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Last Slide: CTA ──────────────────────────────────────────────────────────

function drawSparkleDivider(ctx: CanvasRenderingContext2D, w: number, sparkY: number) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, sparkY);
  ctx.lineTo(w * 0.42, sparkY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.58, sparkY);
  ctx.lineTo(w * 0.88, sparkY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const sparkFs = Math.round(w * 0.042);
  ctx.font = `${sparkFs}px Arial`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', w / 2, sparkY);
  ctx.textBaseline = 'alphabetic';
}

function drawCircleContact(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  icon: string,
  text: string,
  fontSize: number
) {
  const r = Math.round(w * 0.04);
  ctx.font = `bold ${fontSize}px Arial`;
  const textW = ctx.measureText(text).width;
  const gap = Math.round(w * 0.025);
  const groupW = r * 2 + gap + textW;
  const startX = (w - groupW) / 2;

  ctx.beginPath();
  ctx.arc(startX + r, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `${Math.round(r * 1.1)}px Arial`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, startX + r, y);

  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, startX + r * 2 + gap, y);
  ctx.textBaseline = 'alphabetic';
}

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

  const bigFs = Math.round(w * 0.155);
  ctx.textBaseline = 'alphabetic';
  const leftX = w * 0.1;

  // "Jetzt" huge white LEFT-ALIGNED
  ctx.textAlign = 'left';
  ctx.font = `900 ${bigFs}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Jetzt', leftX, h * 0.41);

  // Small airplane top-right
  const planeFs = Math.round(w * 0.065);
  ctx.font = `${planeFs}px Arial`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'right';
  ctx.fillText('✈', w * 0.88, h * 0.38);

  // "buchen!" huge GOLD LEFT-ALIGNED
  ctx.textAlign = 'left';
  ctx.font = `900 ${bigFs}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText('buchen!', leftX, h * 0.41 + bigFs * 1.08);

  // "Kontaktiere uns heute"
  ctx.textAlign = 'center';
  const subFs = Math.round(w * 0.042);
  ctx.font = `${subFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Kontaktiere uns heute', w / 2, h * 0.60);

  // Phone contact with circle
  drawCircleContact(ctx, w, h * 0.665, '📞', FOOTER_PHONE, Math.round(w * 0.038));

  // Email contact with circle
  drawCircleContact(ctx, w, h * 0.725, '✉', FOOTER_EMAIL.toUpperCase(), Math.round(w * 0.032));

  // Sparkle divider at h*0.785
  drawSparkleDivider(ctx, w, h * 0.785);

  // "Dein Traumurlaub wartet!" gold italic script
  ctx.font = `italic bold ${Math.round(w * 0.062)}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Dein Traumurlaub wartet!', w / 2, h * 0.865);

  // Underline flourish
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.883);
  ctx.lineTo(w * 0.75, h * 0.883);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}
