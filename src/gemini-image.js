// ============================================================
//  gemini-image.js — background image generation via Gemini (Nano Banana)
//  API key stays on the server only. Returns image as a data-URI (base64).
// ============================================================

const config = require('../config');

// Build the image prompt with fixed brand rules
function buildImagePrompt(subject) {
  return [
    `Professional high-quality travel photograph of ${subject}.`,
    // rule: sky <= 10% at the very top, rest is city/landmarks
    'Composition: the sky occupies at most 10 percent at the very top;',
    'the rest of the frame is filled with the city, landmarks, or scenery.',
    // CRITICAL: top sky must be a clear BLUE gradient sky (never orange/sunset),',
    'so a gold logo stays readable over it.',
    'The very top strip of the image MUST be a clean bright BLUE sky with a smooth gradient,',
    'daytime, clear blue sky only — absolutely no sunset, no orange, no golden sky at the top.',
    // high realism + high contrast
    'Ultra realistic, true-to-life colors, very high contrast, sharp details, high resolution,',
    'vibrant and rich tones, bright clear daylight, aerial or elevated view.',
    'Vertical 9:16 portrait orientation. No text, no logos, no watermarks, no people in foreground.',
  ].join(' ');
}

/**
 * Generate a background image and return it as a data-URI.
 * @param {string} subject - destination description
 * @returns {Promise<string>} data:image/png;base64,...
 */
async function generateBackground(subject) {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Put it in your .env file.');
  }

  const prompt = buildImagePrompt(subject);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_IMAGE_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 400)}`);
  }

  const json = await res.json();

  // Extract image data from the response (Nano Banana returns parts)
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
