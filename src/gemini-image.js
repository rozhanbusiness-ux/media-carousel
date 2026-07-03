// ============================================================
//  gemini-image.js — background image generation via Gemini (Nano Banana)
//  API key stays on the server only. Returns image as a data-URI (base64).
//  Prompt building is delegated to the offer-type registry when available.
// ============================================================

const config = require('../config');
const { getOfferType } = require('./offer-types');

// Fallback prompt (city/offer slides, or when no offer type is given)
function buildCityPrompt(subject, orientationText) {
  return [
    `Professional high-quality travel photograph of ${subject}.`,
    'Composition: the sky occupies at most 10 percent at the very top;',
    'the rest of the frame is filled with the city, landmarks, or scenery.',
    'The very top strip of the image MUST be a clean bright BLUE sky with a smooth gradient,',
    'daytime, clear blue sky only — absolutely no sunset, no orange, no golden sky at the top.',
    'Ultra realistic, true-to-life colors, very high contrast, sharp details, high resolution,',
    'vibrant and rich tones, bright clear daylight, aerial or elevated view.',
    orientationText + ' No text, no logos, no watermarks, no people in foreground.',
  ].join(' ');
}

/**
 * Build the final prompt.
 * Priority: offer-type prompt builder > city fallback.
 */
function buildImagePrompt(subject, orientationText, size, offerTypeId) {
  const offerType = offerTypeId ? getOfferType(offerTypeId) : null;
  if (offerType && typeof offerType.buildBackgroundPrompt === 'function') {
    return offerType.buildBackgroundPrompt(subject, orientationText);
  }
  return buildCityPrompt(subject, orientationText);
}

/**
 * Generate a background image and return it as a data-URI.
 * @param {string} subject - image subject description
 * @param {string} size - size id (story/square/portrait)
 * @param {string} [offerTypeId] - offer type id (e.g. 'flight')
 * @returns {Promise<string>} data:image/png;base64,...
 */
async function generateBackground(subject, size, offerTypeId) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Put it in your .env file.');
  }

  const RATIOS = {
    square:   { ratio: '1:1',  text: 'Square 1:1 composition.' },
    portrait: { ratio: '4:5',  text: 'Vertical 4:5 portrait composition.' },
    story:    { ratio: '9:16', text: 'Vertical 9:16 portrait orientation.' },
  };
  const r = RATIOS[size] || RATIOS.story;
  const aspectRatio = r.ratio;
  const orientationText = r.text;
  const prompt = buildImagePrompt(subject, orientationText, size, offerTypeId);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_IMAGE_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['Image'],
        imageConfig: {
          imageSize: config.GEMINI_IMAGE_SIZE || '2K',
          aspectRatio: aspectRatio,
        },
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json = await res.json();

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inlineData || p.inline_data);
  if (!imgPart) {
    throw new Error('Gemini returned no image. Response: ' + JSON.stringify(json).slice(0, 300));
  }
  const inline = imgPart.inlineData || imgPart.inline_data;
  const mime = inline.mimeType || inline.mime_type || 'image/png';
  const b64 = inline.data;

  return `data:${mime};base64,${b64}`;
}

module.exports = { generateBackground, buildImagePrompt };
