// ============================================================
//  extract-offer.js — field-guided extraction from screenshots
//  Sends an image + the offer type's field list to Gemini,
//  returns extracted values as a flat JSON object.
// ============================================================

const config = require('../config');
const { getOfferType } = require('./offer-types');

// Text-capable Gemini model for extraction (not the image-generation model)
const EXTRACT_MODEL = 'gemini-2.5-flash';

function buildExtractionPrompt(offerType, todayIso) {
  const fieldLines = Object.entries(offerType.fields)
    .map(([key, f]) => `- "${key}": ${f.label} (example: ${f.default})`)
    .join('\n');

  return [
    'You are a precise data extraction engine for a travel agency.',
    'Look at the attached screenshot of a travel offer and extract the value of each field below.',
    'Fields to find:',
    fieldLines,
    '',
    'Rules:',
    `- Today is ${todayIso}. Travel dates are ALWAYS in the future.`,
    '  If a date in the image has no year: use the current year if its month is >= the current month,',
    '  otherwise use the next year. Output dates in DD.MM.YYYY format.',
    '- If a field is highlighted with a colored box in the image, prefer that value.',
    '- Prices: copy the numeric value exactly as shown (keep decimals), digits and separators only, no currency symbol.',
    '- City fields: output the city NAME (e.g. "DUS" means Düsseldorf, "EBL" means Erbil).',
    '- If a field cannot be found in the image, output an empty string "" for it. NEVER guess.',
    '- Answer with ONLY a raw JSON object, no markdown, no explanations.',
    'Example answer format: {"origin":"Düsseldorf","destination":"Erbil","price":"694.11","date_out":"09.07.2026","date_return":"30.07.2026","baggage_1":"","baggage_2":""}',
  ].join('\n');
}

/**
 * Extract offer fields from a screenshot.
 * @param {string} imageBase64 - raw base64 (no data-uri prefix)
 * @param {string} mimeType - e.g. image/png
 * @param {string} offerTypeId - e.g. 'flight'
 * @returns {Promise<Object>} extracted field values
 */
async function extractFromImage(imageBase64, mimeType, offerTypeId) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Put it in your .env file.');
  }
  const offerType = getOfferType(offerTypeId);
  if (!offerType) throw new Error('Unknown offer type: ' + offerTypeId);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const prompt = buildExtractionPrompt(offerType, todayIso);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EXTRACT_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType, data: imageBase64 } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini extraction error ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const clean = text.replace(/```json|```/g, '').trim();

  let extracted;
  try {
    extracted = JSON.parse(clean);
  } catch {
    throw new Error('Extraction returned invalid JSON: ' + clean.slice(0, 200));
  }

  // keep only known fields; unknown keys are dropped
  const out = {};
  for (const key of Object.keys(offerType.fields)) {
    out[key] = typeof extracted[key] === 'string' ? extracted[key].trim() : '';
  }
  return out;
}

function buildMultiExtractionPrompt(offerType, todayIso) {
  const fieldLines = Object.entries(offerType.fields)
    .map(([key, f]) => `- "${key}": ${f.label} (example: ${f.default})`)
    .join('\n');

  return [
    'You are a precise data extraction engine for a travel agency.',
    'This PDF document contains MULTIPLE travel package offers (a list/catalog).',
    'Find EVERY offer in the document and extract the value of each field below FOR EACH offer.',
    'Fields to find (per offer):',
    fieldLines,
    '',
    'Rules:',
    `- Today is ${todayIso}. Travel dates are ALWAYS in the future.`,
    '  If a date has no year: use the current year if its month is >= the current month, otherwise next year.',
    '  Output dates in DD.MM.YYYY format.',
    '- Prices: copy the numeric value exactly as shown (keep decimals), digits and separators only, no currency symbol.',
    '- If a field cannot be found for a given offer, output an empty string "" for it. NEVER guess.',
    '- Extract ALL offers found in the document, however many there are.',
    '- Answer with ONLY a raw JSON ARRAY of objects, no markdown, no explanations.',
    'Example answer format: [{"destination":"Antalya","hotel_name":"Campus Hill Hotel","price":"457",...}, {...}, ...]',
  ].join('\n');
}

/**
 * Extract MULTIPLE offers from a PDF document (e.g. a supplier's offer list).
 * @param {string} pdfBase64 - raw base64 (no data-uri prefix)
 * @param {string} offerTypeId - e.g. 'package'
 * @returns {Promise<Object[]>} array of extracted field-value objects
 */
async function extractFromPdf(pdfBase64, offerTypeId) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Put it in your .env file.');
  }
  const offerType = getOfferType(offerTypeId);
  if (!offerType) throw new Error('Unknown offer type: ' + offerTypeId);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const prompt = buildMultiExtractionPrompt(offerType, todayIso);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EXTRACT_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini PDF extraction error ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const clean = text.replace(/```json|```/g, '').trim();

  let extractedList;
  try {
    extractedList = JSON.parse(clean);
  } catch {
    throw new Error('PDF extraction returned invalid JSON: ' + clean.slice(0, 200));
  }
  if (!Array.isArray(extractedList)) extractedList = [extractedList];

  return extractedList.map(extracted => {
    const out = {};
    for (const key of Object.keys(offerType.fields)) {
      out[key] = typeof extracted[key] === 'string' ? extracted[key].trim() : '';
    }
    return out;
  });
}

module.exports = { extractFromImage, extractFromPdf, buildExtractionPrompt, buildMultiExtractionPrompt };
