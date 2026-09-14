// ============================================================
//  fill-template.js — inject data into HTML templates
//  Deterministic: pure string replacement of {{placeholders}}.
//  Logo + fonts are embedded as data-URIs to guarantee they render.
//  Generic: field list comes from the offer-type registry.
// ============================================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getOfferType } = require('./offer-types');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const LOGO_PATH = path.join(TEMPLATES_DIR, 'logo.png');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

let LOGO_DATA_URI = '';
try {
  LOGO_DATA_URI = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64');
} catch { /* logo missing -> fallback alt text */ }

function fontUri(file) {
  try {
    return 'data:font/ttf;base64,' + fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
  } catch { return ''; }
}
const FONTS = [
  ["url('../fonts/Anton.ttf')", fontUri('Anton.ttf')],
  ["url('../fonts/PlayfairDisplay-Bold.ttf')", fontUri('PlayfairDisplay-Bold.ttf')],
  ["url('../fonts/Montserrat-Bold.ttf')", fontUri('Montserrat-Bold.ttf')],
  ["url('../fonts/DMSerifDisplay-Regular.ttf')", fontUri('DMSerifDisplay-Regular.ttf')],
  ["url('../fonts/GreatVibes-Regular.ttf')", fontUri('GreatVibes-Regular.ttf')],
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// N gold stars as inline SVGs (for the package details slide)
function starsSvg(n) {
  const count = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
  const one = '<svg viewBox="0 0 60 60" width="52" height="52"><path d="M30 4 l7.6 16.2 17.4 2.1 -12.9 12.1 3.4 17.2 -15.5-8.7 -15.5 8.7 3.4-17.2 -12.9-12.1 17.4-2.1 Z" fill="#E6C25A"/></svg>';
  return one.repeat(count);
}

// Build the itinerary timeline HTML for the cruise 'stops' list field.
// Dynamically sizes spacing, dot radius, and font sizes based on how many
// stops there are, so any number of stops fits the fixed slide height.
// Currently tuned for the STORY size (1080x1920) only.
function buildStopsHtml(stops, size) {
  const list = Array.isArray(stops) ? stops.filter(s => s && (s.city || s.day_label || s.description)) : [];
  const n = list.length;
  if (n === 0) return '';

  // Story-size layout constants (usable vertical band for the timeline)
  const AREA_TOP = 340;
  const AREA_BOTTOM = 1780;
  const areaHeight = AREA_BOTTOM - AREA_TOP;
  const slotHeight = areaHeight / n;

  // Dynamic sizing: shrink as stop count grows, clamped to sane bounds
  const dotRadius = Math.max(16, Math.min(28, slotHeight * 0.16));
  const cityFontSize = Math.max(28, Math.min(48, slotHeight * 0.26));
  const dayFontSize = Math.max(18, Math.min(30, slotHeight * 0.17));
  const descFontSize = Math.max(16, Math.min(24, slotHeight * 0.13));

  const rows = list.map((stop, i) => {
    const cy = AREA_TOP + slotHeight * (i + 0.5);
    const city = escapeHtml(stop.city || '');
    const dayLabel = escapeHtml(stop.day_label || '');
    const description = escapeHtml(stop.description || '');
    const descRow = description
      ? `<div class="stop-desc" style="font-size:${descFontSize}px;">${description}</div>`
      : '';
    return `
      <div class="stop-dot" style="top:${cy - dotRadius}px; width:${dotRadius * 2}px; height:${dotRadius * 2}px; font-size:${dotRadius}px;">${i + 1}</div>
      <div class="stop-text" style="top:${cy - dotRadius}px;">
        <div class="stop-city" style="font-size:${cityFontSize}px;">${city}</div>
        <div class="stop-day" style="font-size:${dayFontSize}px;">${dayLabel}</div>
        ${descRow}
      </div>`;
  }).join('\n');

  return `<div class="stop-line" style="top:${AREA_TOP}px; height:${areaHeight}px;"></div>` + rows;
}

function embedAssets(html) {
  html = html.replace('src="logo.png"', `src="${LOGO_DATA_URI}"`);
  for (const [rel, uri] of FONTS) {
    if (uri) html = html.replace(rel, `url('${uri}')`);
  }
  return html;
}

/**
 * Fill ONE template file with data for a given offer type.
 * @param {string} templateFile - file name inside templates/
 * @param {Object} data - field values + bg_image
 * @param {string} offerTypeId - registry id ('flight', 'package', ...)
 * @returns {string} final HTML
 */
function fillTemplateFile(templateFile, data, offerTypeId) {
  const offerType = getOfferType(offerTypeId) || getOfferType('flight');
  let html = fs.readFileSync(path.join(TEMPLATES_DIR, templateFile), 'utf8');

  // bg_image is a data-URI (not user text) -> not escaped
  html = html.replaceAll('{{bg_image}}', data.bg_image || '');

  for (const [key, fieldDef] of Object.entries(offerType.fields)) {
    if (fieldDef.type === 'list') continue; // handled separately below
    html = html.replaceAll('{{' + key + '}}', escapeHtml(data[key] || ''));
  }
  // derived placeholders
  html = html.replaceAll('{{stars_svg}}', starsSvg(data.stars));
  html = html.replaceAll('{{stops_html}}', buildStopsHtml(data.stops, data.size));

  return embedAssets(html);
}

/**
 * Legacy entry point (flight, single template chosen by size).
 * Kept so existing callers (server.js, test scripts) stay working.
 */
function fillTemplate(data) {
  const size = data.size && config.SIZES[data.size] ? data.size : config.DEFAULT_SIZE;
  const offerTypeId = data.offer_type || 'flight';
  const offerType = getOfferType(offerTypeId) || getOfferType('flight');
  const templates = (offerType.templates && offerType.templates[size])
    ? offerType.templates[size]
    : [config.SIZES[size].template];
  return fillTemplateFile(templates[0], data, offerTypeId);
}

module.exports = { fillTemplate, fillTemplateFile, starsSvg, buildStopsHtml };
