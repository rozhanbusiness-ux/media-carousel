// ============================================================
//  render.js — export HTML to PNG via Puppeteer
//  Takes HTML string, renders at 1080x1920, returns PNG buffer.
// ============================================================

const config = require('../config');
const path = require('path');

// Use puppeteer if available, otherwise puppeteer-core
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  puppeteer = require('puppeteer-core');
}

let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  const opts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (config.PUPPETEER_EXECUTABLE) {
    opts.executablePath = config.PUPPETEER_EXECUTABLE;
  }
  _browser = await puppeteer.launch(opts);
  return _browser;
}

/**
 * Render HTML to a PNG buffer.
 * @param {string} html - full HTML content
 * @returns {Promise<Buffer>}
 */
async function renderToPng(html, size) {
  const dims = (size && config.SIZES && config.SIZES[size]) ? config.SIZES[size] : config.CANVAS;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: dims.width,
      height: dims.height,
      deviceScaleFactor: 2,
    });
    // inject <base> so relative assets (fonts/logo) resolve if not embedded
    const templatesDir = 'file://' + path.join(__dirname, '..', 'templates') + '/';
    let finalHtml = html;
    if (!/<base /i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<head>/i, `<head><base href="${templatesDir}">`);
    }
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise((r) => setTimeout(r, 300));
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: dims.width, height: dims.height },
    });
    return buf;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; }
}

module.exports = { renderToPng, closeBrowser };
