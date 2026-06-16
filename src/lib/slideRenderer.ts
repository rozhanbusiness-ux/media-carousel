import { Hotel, Offer, SLIDE_DIMENSIONS, SlideSize } from '../types';

const NAVY = '#001F3F';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const FOOTER_PHONE = '+491 765 8866 999';
const FOOTER_EMAIL = 'info@media-travels.com';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
    const logo = await loadImage('/logo.png');
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
  offer: Pick<Offer, 'destination' | 'hookHeadline' | 'hookTagline'>,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  // Background photo
  const bg = await loadImage(bgDataUrl);
  ctx.drawImage(bg, 0, 0, w, h);

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
  ctx.fillText(offer.destination, w / 2, h * 0.48);

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
  ctx.fillText(offer.hookHeadline, w / 2, h * 0.5 + Math.round(hlFs * 1.6));

  // Tagline (e.g. "Luxus am Meer - Jetzt buchen!") — small white
  const tagFs = Math.round(w * 0.038);
  ctx.font = `${tagFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.9;
  ctx.fillText(offer.hookTagline, w / 2, h * 0.5 + Math.round(hlFs * 1.6) + Math.round(tagFs * 2));
  ctx.globalAlpha = 1;

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Slide A: Hotel Visual ───────────────────────────────────────────────────

export async function renderHotelVisualSlide(
  hotel: Hotel,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  ctx.drawImage(bg, 0, 0, w, h);
  drawBottomGradient(ctx, w, h);

  await drawLogo(ctx, w, h);

  // Rating badge top-right area
  const ratingFs = Math.round(w * 0.038);
  ctx.font = `bold ${ratingFs}px Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${hotel.rating}% Bewertung`, w / 2, Math.round(h * 0.88));

  // Hotel name
  const nameFs = Math.round(w * 0.072);
  ctx.font = `bold ${nameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  const nameLines = wrapText(ctx, hotel.name, w * 0.88);
  const nameBaseY = Math.round(h * 0.75);
  nameLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, nameBaseY + i * Math.round(nameFs * 1.15));
  });

  // Location subtitle
  const locFs = Math.round(w * 0.038);
  ctx.font = `${locFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.globalAlpha = 0.85;
  ctx.fillText(hotel.location, w / 2, nameBaseY + nameLines.length * Math.round(nameFs * 1.15) + Math.round(locFs * 1.2));
  ctx.globalAlpha = 1;

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

// ─── Slide B: Hotel Details ───────────────────────────────────────────────────

export async function renderHotelDetailsSlide(hotel: Hotel, size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w, h);

  // Hotel name
  const nameFs = Math.round(w * 0.058);
  ctx.font = `bold ${nameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameLines = wrapText(ctx, hotel.name, w * 0.82);
  const nameY = Math.round(h * 0.22);
  nameLines.forEach((line, i) => ctx.fillText(line, w / 2, nameY + i * Math.round(nameFs * 1.2)));

  // Price block: "ab" + big number + "€"
  const priceBlockY = nameY + nameLines.length * Math.round(nameFs * 1.2) + Math.round(h * 0.025);
  const abFs = Math.round(w * 0.042);
  const numFs = Math.round(w * 0.11);
  const eurFs = Math.round(w * 0.055);

  ctx.font = `${abFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.fillText('ab', w / 2 - Math.round(w * 0.12), priceBlockY);

  ctx.font = `bold ${numFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(hotel.price, w / 2 + Math.round(w * 0.02), priceBlockY);

  ctx.font = `bold ${eurFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('€', w / 2 + Math.round(w * 0.16), priceBlockY);

  // Gold divider under price
  const divY = priceBlockY + Math.round(h * 0.02);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, divY);
  ctx.lineTo(w * 0.9, divY);
  ctx.stroke();

  // Detail rows
  const rows = [
    { label: 'Reisedatum', value: `${hotel.dateFrom} - ${hotel.dateTo}` },
    { label: 'Hinflug', value: hotel.airportDeparture },
    { label: 'Rückflug', value: hotel.airportReturn },
    { label: 'Verpflegung', value: hotel.mealPlan },
    { label: 'Transfer', value: hotel.transfer },
    { label: 'Bewertung', value: `${hotel.rating}%` },
  ];

  const rowsStartY = divY + Math.round(h * 0.03);
  const rowsEndY = h * 0.895;
  const rowH = (rowsEndY - rowsStartY) / rows.length;
  const labelFs = Math.round(w * 0.032);
  const valueFs = Math.round(w * 0.042);
  const iconX = w * 0.1;
  const labelX = w * 0.18;

  const icons: Record<string, string> = {
    Reisedatum: '📅',
    Hinflug: '✈',
    Rückflug: '✈',
    Verpflegung: '🍽',
    Transfer: '🚌',
    Bewertung: '⭐',
  };

  rows.forEach((row, i) => {
    const midY = rowsStartY + i * rowH + rowH / 2;

    // row divider above (except first)
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

    // icon
    ctx.font = `${valueFs}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[row.label] ?? '•', iconX, midY);

    // label
    ctx.font = `bold ${labelFs}px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, labelX, midY - Math.round(labelFs * 0.7));

    // value
    ctx.font = `${valueFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText(row.value, labelX, midY + Math.round(valueFs * 0.55));
  });

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
