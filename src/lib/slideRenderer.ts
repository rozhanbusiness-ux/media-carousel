import { Hotel, SLIDE_DIMENSIONS, SlideSize } from '../types';

const NAVY = '#001F3F';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const FOOTER_TEXT = '+491 765 8866 999';
const FOOTER_EMAIL = 'INFO@MEDIA-TRAVELS.COM';

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

function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const barH = Math.round(h * 0.055);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, h - barH, w, 2);

  ctx.fillStyle = GOLD;
  const fs = Math.round(w * 0.025);
  ctx.font = `${fs}px Arial`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(FOOTER_TEXT, Math.round(w * 0.03), h - Math.round(h * 0.01));
  ctx.textAlign = 'right';
  ctx.fillText(FOOTER_EMAIL, w - Math.round(w * 0.03), h - Math.round(h * 0.01));
  ctx.textAlign = 'left';
}

async function drawLogo(ctx: CanvasRenderingContext2D, w: number) {
  try {
    const logo = await loadImage('/logo.png');
    const logoW = Math.round(w * 0.25);
    const logoH = Math.round(logoW * (logo.height / logo.width));
    ctx.drawImage(logo, (w - logoW) / 2, Math.round(w * 0.04), logoW, logoH);
  } catch {
    // no logo file in dev — skip silently
  }
}

function drawGradientOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const gradStart = h * 0.6;
  const grad = ctx.createLinearGradient(0, gradStart, 0, h);
  grad.addColorStop(0, 'rgba(0,31,63,0)');
  grad.addColorStop(1, 'rgba(0,31,63,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradStart, w, h - gradStart);
}

export async function renderHookSlide(
  destination: string,
  headline: string,
  bgDataUrl: string,
  size: SlideSize
): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  const bg = await loadImage(bgDataUrl);
  ctx.drawImage(bg, 0, 0, w, h);

  // bottom vignette
  const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w);

  // Destination name
  const destFs = Math.round(w * 0.085);
  ctx.font = `bold ${destFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(destination, w / 2, h * 0.5);

  // Headline in gold italic
  const hlFs = Math.round(w * 0.055);
  ctx.font = `italic ${hlFs}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(headline, w / 2, h * 0.5 + destFs * 1.3);

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

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
  drawGradientOverlay(ctx, w, h);

  await drawLogo(ctx, w);

  const nameFs = Math.round(w * 0.072);
  ctx.font = `bold ${nameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameY = h - Math.round(h * 0.16);
  ctx.fillText(hotel.name, w / 2, nameY);

  // price
  const priceFs = Math.round(w * 0.05);
  ctx.font = `${priceFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  const priceY = nameY + Math.round(priceFs * 1.6);
  ctx.fillText(`ab ${hotel.price} €`, w / 2, priceY);

  // gold underline under price
  const priceW = ctx.measureText(`ab ${hotel.price} €`).width;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - priceW / 2, priceY + 6);
  ctx.lineTo(w / 2 + priceW / 2, priceY + 6);
  ctx.stroke();

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

export async function renderHotelDetailsSlide(hotel: Hotel, size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w);

  const hotelNameFs = Math.round(w * 0.055);
  ctx.font = `bold ${hotelNameFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(hotel.name, w / 2, Math.round(h * 0.23));

  const stars = '★'.repeat(hotel.stars) + '☆'.repeat(Math.max(0, 5 - hotel.stars));

  const rows = [
    { icon: '📅', label: 'Reisedatum', value: `${hotel.dateFrom} – ${hotel.dateTo}` },
    { icon: '✈️', label: 'Hinflug', value: hotel.airportDeparture },
    { icon: '✈️', label: 'Rückflug', value: hotel.airportReturn },
    { icon: '🍽️', label: 'Verpflegung', value: hotel.mealPlan },
    { icon: '🚌', label: 'Transfer', value: hotel.transfer },
    { icon: '⭐', label: 'Bewertung', value: stars },
  ];

  const rowCount = rows.length;
  const startY = h * 0.28;
  const endY = h * 0.88;
  const rowH = (endY - startY) / rowCount;
  const labelFs = Math.round(w * 0.030);
  const valueFs = Math.round(w * 0.038);

  rows.forEach((row, i) => {
    const y = startY + i * rowH;
    const midY = y + rowH / 2;

    // divider above row (except first)
    if (i > 0) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, y);
      ctx.lineTo(w * 0.9, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // icon
    ctx.font = `${valueFs}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.icon, w * 0.18, midY);

    // label
    ctx.font = `bold ${labelFs}px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, w * 0.25, midY - labelFs * 0.6);

    // value
    ctx.font = `${valueFs}px Georgia, serif`;
    ctx.fillStyle = WHITE;
    ctx.fillText(row.value, w * 0.25, midY + valueFs * 0.6);
  });

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}

export async function renderCtaSlide(size: SlideSize): Promise<Blob> {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = SLIDE_DIMENSIONS[size];

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, w, h);

  // radial glow
  const radial = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  radial.addColorStop(0, 'rgba(30,60,100,0.6)');
  radial.addColorStop(1, 'rgba(0,31,63,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  await drawLogo(ctx, w);

  const bigFs = Math.round(w * 0.13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = `bold ${bigFs}px Georgia, serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Jetzt', w / 2, h * 0.44);

  ctx.fillStyle = GOLD;
  ctx.fillText('buchen!', w / 2, h * 0.44 + bigFs * 1.2);

  // divider
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.57);
  ctx.lineTo(w * 0.7, h * 0.57);
  ctx.stroke();

  const subFs = Math.round(w * 0.036);
  ctx.font = `${subFs}px Arial, sans-serif`;
  ctx.fillStyle = WHITE;
  ctx.fillText('Kontaktiere uns heute', w / 2, h * 0.62);

  ctx.font = `bold ${subFs}px Arial, sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(`📞 ${FOOTER_TEXT}`, w / 2, h * 0.68);
  ctx.fillText(`✉ ${FOOTER_EMAIL}`, w / 2, h * 0.74);

  // script outro
  ctx.font = `italic ${Math.round(w * 0.048)}px Georgia, serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText('Dein Traumurlaub wartet!', w / 2, h * 0.85);

  drawFooter(ctx, w, h);

  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
}
