// ============================================================
//  fill-template.js — inject data into the HTML template
//  Deterministic: pure string replacement of {{placeholders}}.
//  Logo + fonts are embedded as data-URIs to guarantee they render.
// ============================================================

const fs = require('fs');
const path = require('path');

const config = require('../config');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const LOGO_PATH = path.join(__dirname, '..', 'templates', 'logo.png');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// Load logo once as data-URI (embedded into the template so it always renders)
let LOGO_DATA_URI = '';
try {
  LOGO_DATA_URI = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64');
} catch { /* logo missing -> fallback alt text */ }

// Load fonts as data-URIs so they load reliably under setContent
function fontUri(file) {
  try {
    return 'data:font/ttf;base64,' + fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
  } catch { return ''; }
}
const FONT_ANTON = fontUri('Anton.ttf');
const FONT_PLAYFAIR = fontUri('PlayfairDisplay-Bold.ttf');
const FONT_MONTSERRAT = fontUri('Montserrat-Bold.ttf');
const FONT_DMSERIF = fontUri('DMSerifDisplay-Regular.ttf');

// Escape user-supplied HTML-sensitive characters (basic safety)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fill the template with data.
 * @param {Object} data - fields + bg_image (path or data-URI)
 * @returns {string} final HTML ready for export
 */
function fillTemplate(data) {
  const size = data.size && config.SIZES[data.size] ? data.size : config.DEFAULT_SIZE;
  const templateFile = config.SIZES[size].template;
  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  let html = fs.readFileSync(templatePath, 'utf8');

  // bg_image is a data-URI (not user text) -> not escaped
  const replacements = {
    bg_image:    data.bg_image || '',
    origin:      escapeHtml(data.origin || ''),
    destination: escapeHtml(data.destination || ''),
    price:       escapeHtml(data.price || ''),
    date_out:    escapeHtml(data.date_out || ''),
    date_return: escapeHtml(data.date_return || ''),
    baggage_1:   escapeHtml(data.baggage_1 || ''),
    baggage_2:   escapeHtml(data.baggage_2 || ''),
  };

  for (const [key, val] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, val);
  }

  // Replace relative logo path with embedded data-URI
  if (LOGO_DATA_URI) {
    html = html.replace('src="logo.png"', `src="${LOGO_DATA_URI}"`);
  }

  // Replace relative font paths with embedded data-URIs
  if (FONT_ANTON)    html = html.replace("url('../fonts/Anton.ttf')", `url('${FONT_ANTON}')`);
  if (FONT_PLAYFAIR) html = html.replace("url('../fonts/PlayfairDisplay-Bold.ttf')", `url('${FONT_PLAYFAIR}')`);
  if (FONT_MONTSERRAT) html = html.replace("url('../fonts/Montserrat-Bold.ttf')", `url('${FONT_MONTSERRAT}')`);
  if (FONT_DMSERIF) html = html.replace("url('../fonts/DMSerifDisplay-Regular.ttf')", `url('${FONT_DMSERIF}')`);

  return html;
}

module.exports = { fillTemplate };
