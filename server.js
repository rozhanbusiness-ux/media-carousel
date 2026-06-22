// ============================================================
//  server.js — Express server
//  - serves the frontend (public/)
//  - POST /api/generate-bg -> generate background image via Gemini
//  - POST /api/render      -> inject data + export PNG
//  API key stays here on the server only.
// ============================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { validate, normalize } = require('./src/offer-schema');
const { fillTemplate } = require('./src/fill-template');
const { generateBackground } = require('./src/gemini-image');
const { renderToPng } = require('./src/render');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

// ---- generate background image via Gemini ----
app.post('/api/generate-bg', async (req, res) => {
  try {
    const subject = (req.body.image_subject || '').trim();
    if (!subject) return res.status(400).json({ error: 'image_subject is required' });
    const dataUri = await generateBackground(subject);
    res.json({ image: dataUri });
  } catch (err) {
    console.error('generate-bg:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- render final PNG ----
app.post('/api/render', async (req, res) => {
  try {
    const data = normalize(req.body);
    const errors = validate(data);
    if (errors.length) return res.status(400).json({ error: errors.join(' | ') });

    data.bg_image = req.body.bg_image || '';
    if (!data.bg_image) return res.status(400).json({ error: 'background image is missing' });

    const html = fillTemplate(data);
    const png = await renderToPng(html);

    const fname = `offer_${Date.now()}.png`;
    fs.writeFileSync(path.join(__dirname, 'output', fname), png);
    res.json({ image: 'data:image/png;base64,' + png.toString('base64'), file: fname });
  } catch (err) {
    console.error('render:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(config.PORT, () => {
  console.log(`media-carousel running on http://localhost:${config.PORT}`);
  if (!config.GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY not set — image generation will not work. Put it in .env');
  }
});
