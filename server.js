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
const { listOfferTypes, getOfferType } = require('./src/offer-types');
const { fillTemplate } = require('./src/fill-template');
const { generateBackground } = require('./src/gemini-image');
const { renderToPng } = require('./src/render');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use('/output', express.static(path.join(__dirname, 'output')));

// ---- list available offer types (for the UI dropdown) ----
app.get('/api/offer-types', (req, res) => {
  res.json(listOfferTypes());
});

// ---- get one offer type definition (fields, sizes) ----
app.get('/api/offer-types/:id', (req, res) => {
  const t = getOfferType(req.params.id);
  if (!t) return res.status(404).json({ error: 'unknown offer type' });
  res.json({ id: t.id, displayName: t.displayName, sizes: t.sizes, fields: t.fields });
});

// ---- generate background image via Gemini ----
app.post('/api/generate-bg', async (req, res) => {
  try {
    const subject = (req.body.image_subject || '').trim();
    if (!subject) return res.status(400).json({ error: 'image_subject is required' });
    const size = req.body.size || 'story';
    const offerTypeId = req.body.offer_type || '';
    const dataUri = await generateBackground(subject, size, offerTypeId);
    // Save the generated background on the server itself, return only a small id
    // so the heavy image never needs to travel back and forth over the network.
    const bgId = 'bg_' + Date.now();
    const base64Data = dataUri.split(',')[1];
    fs.writeFileSync(path.join(__dirname, 'cache', bgId + '.txt'), dataUri);
    res.json({ image: dataUri, bgId: bgId });
  } catch (err) {
    console.error('generate-bg:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- render ALL selected sizes in one request ----
app.post('/api/render-all', async (req, res) => {
  try {
    const sizes = Array.isArray(req.body.sizes) ? req.body.sizes : [];
    if (!sizes.length) return res.status(400).json({ error: 'sizes array is required' });

    const data = normalize(req.body);
    const errors = validate(data);
    if (errors.length) return res.status(400).json({ error: errors.join(' | ') });

    if (req.body.bgId) {
      const cachedPath = path.join(__dirname, 'cache', req.body.bgId + '.txt');
      if (fs.existsSync(cachedPath)) {
        data.bg_image = fs.readFileSync(cachedPath, 'utf8');
      }
    }
    if (!data.bg_image) data.bg_image = req.body.bg_image || '';
    if (!data.bg_image) return res.status(400).json({ error: 'background image is missing' });

    const stamp = Date.now();
    const files = [];
    for (const size of sizes) {
      if (!config.SIZES[size]) continue;
      data.size = size;
      const html = fillTemplate(data);
      const png = await renderToPng(html, size);
      const fname = `offer_${stamp}_${size}.png`;
      fs.writeFileSync(path.join(__dirname, 'output', fname), png);
      files.push({ size: size, url: '/output/' + fname, file: fname });
    }
    if (!files.length) return res.status(400).json({ error: 'no valid sizes' });
    res.json({ files: files });
  } catch (err) {
    console.error('render-all:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- render final PNG ----
app.post('/api/render', async (req, res) => {
  try {
    const data = normalize(req.body);
    const errors = validate(data);
    if (errors.length) return res.status(400).json({ error: errors.join(' | ') });

    // If the request includes a cached background id, read the large image
    // directly from the server's own disk instead of waiting for the browser
    // to upload it again over the network.
    if (req.body.bgId) {
      const cachedPath = path.join(__dirname, 'cache', req.body.bgId + '.txt');
      if (fs.existsSync(cachedPath)) {
        data.bg_image = fs.readFileSync(cachedPath, 'utf8');
      }
    }
    if (!data.bg_image) {
      data.bg_image = req.body.bg_image || '';
    }
    if (!data.bg_image) return res.status(400).json({ error: 'background image is missing' });

    const size = req.body.size || 'story';
    data.size = size;
    const html = fillTemplate(data);
    const png = await renderToPng(html, size);

    const fname = `offer_${Date.now()}.png`;
    fs.writeFileSync(path.join(__dirname, 'output', fname), png);
    res.json({ url: '/output/' + fname, file: fname });
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
