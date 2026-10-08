// ============================================================
//  studio/browser.js — HTML → JPEG for studio slides
//  JPEG (quality 92) instead of PNG: about 4x faster to encode on the
//  server and about 5x smaller files, with no visible difference for
//  photo slides. Own browser instance (Carousel's src/render.js stays
//  untouched); it is closed after 2 idle minutes to free memory.
// ============================================================

const config = require('../config');

let puppeteer;
try { puppeteer = require('puppeteer'); } catch { puppeteer = require('puppeteer-core'); }

const IDLE_MS = 2 * 60 * 1000;
let browser = null;
let idleTimer = null;
let active = 0;

async function getBrowser() {
  clearTimeout(idleTimer);
  if (browser && browser.isConnected()) return browser;
  const opts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (config.PUPPETEER_EXECUTABLE) opts.executablePath = config.PUPPETEER_EXECUTABLE;
  browser = await puppeteer.launch(opts);
  return browser;
}

function scheduleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (active === 0 && browser) { const b = browser; browser = null; await b.close().catch(() => {}); }
  }, IDLE_MS);
  idleTimer.unref();
}

/** Render a self-contained HTML document to a JPEG buffer at 2x the given size. */
async function renderToJpeg(html, size) {
  const dims = config.SIZES[size];
  if (!dims) throw new Error('unknown size');
  active++;
  const page = await (await getBrowser()).newPage();
  try {
    await page.setViewport({ width: dims.width, height: dims.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluateHandle('document.fonts.ready');
    return await page.screenshot({ type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: dims.width, height: dims.height } });
  } finally {
    await page.close().catch(() => {});
    active--;
    if (active === 0) scheduleClose();
  }
}

module.exports = { renderToJpeg };
