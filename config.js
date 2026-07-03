// ============================================================
//  config.js — central project configuration
// ============================================================
module.exports = {
  PORT: process.env.PORT || 3000,

  // Gemini image generation model:
  //   'gemini-2.5-flash-image'         -> Nano Banana (cheapest, stable) [default]
  //   'gemini-3.1-flash-image-preview' -> Nano Banana 2 (newest, 4K)
  //   'gemini-3-pro-image-preview'     -> Nano Banana Pro (highest quality)
  GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image-preview',
  GEMINI_IMAGE_SIZE: '2K',

  // API key is read from environment only (never hardcoded)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Available output sizes (each maps to its own template file)
  SIZES: {
    story:  { width: 1080, height: 1920, template: 'offer-slide.html' },
    square: { width: 1080, height: 1080, template: 'offer-slide-square.html' },
    portrait: { width: 1080, height: 1350, template: 'offer-slide-portrait.html' },
  },
  DEFAULT_SIZE: 'story',
  // Backward-compatible default canvas (story)
  CANVAS: { width: 1080, height: 1920 },

  // Leave empty on Codespace/devcontainer so Puppeteer finds its own browser
  PUPPETEER_EXECUTABLE: process.env.PUPPETEER_EXECUTABLE || '',
};
