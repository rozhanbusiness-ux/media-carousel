// ============================================================
//  studio/routes.js — studio API + page (added to the existing app
//  with one line in server.js). Protected by the same Nginx login as
//  the rest of Carousel. Inputs are validated; nothing is published
//  from here (phase 1: approve, then download/copy manually).
// ============================================================

const path = require('path');
const express = require('express');
const store = require('./store');
const { createDailyDraft, createManualDraft, regenerate } = require('./planner');
const { STYLES } = require('./render');
const { getFlightOffers } = require('./offers');

const ID = /^[a-f0-9]{12}$/;
const LANG_SET = ['de', 'ar', 'ckb'];
const cleanLangs = (v) => (Array.isArray(v) && v.length && v.length <= 3 && v.every((l) => LANG_SET.includes(l)) ? [...new Set(v)] : null);
let generating = false;

module.exports = function mountStudio(app) {
  const router = express.Router();

  router.get('/drafts', (req, res) => res.json(store.listDrafts().slice(0, 30)));

  router.get('/offers', async (req, res) => {
    try { res.json(await getFlightOffers()); } catch { res.status(502).json({ error: 'offers unavailable' }); }
  });

  // Create today's (or a given day's) draft. One generation at a time.
  router.post('/drafts', async (req, res) => {
    if (generating) return res.status(429).json({ error: 'already generating' });
    const day = typeof req.body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? new Date(req.body.date + 'T12:00:00') : new Date();
    generating = true;
    try {
      res.json(await createDailyDraft({ date: day, langs: cleanLangs(req.body.langs) }));
    } catch (err) {
      console.error('studio draft:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      generating = false;
    }
  });

  // Manual offer (typed in, or extracted from a screenshot/PDF in the page first).
  router.post('/manual', async (req, res) => {
    const b = req.body || {};
    const name = (v) => typeof v === 'string' && v.trim().length >= 2 && v.length <= 60 && !/[<>{}]/.test(v);
    const code = (v) => v === undefined || v === '' || /^[A-Z]{3}$/.test(v);
    const iso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    const price = Number(b.price);
    const photoOk = b.photo === undefined || b.photo === null || b.photo === ''
      || (typeof b.photo === 'string' && b.photo.length < 12000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo));
    if (!name(b.fromName) || !name(b.toName) || !code(b.fromCode) || !code(b.toCode) || !iso(b.departureDate)
      || !(b.returnDate === '' || iso(b.returnDate)) || !(price > 0 && price < 100000)
      || !(b.airline === undefined || b.airline === '' || name(b.airline)) || !(b.style === undefined || b.style === '' || STYLES.includes(b.style)) || !photoOk) {
      return res.status(400).json({ error: 'invalid offer data' });
    }
    if (generating) return res.status(429).json({ error: 'already generating' });
    generating = true;
    try {
      const offer = {
        kind: 'flight',
        from: { name: b.fromName.trim(), code: b.fromCode || '' }, to: { name: b.toName.trim(), code: b.toCode || '' },
        departureDate: b.departureDate, returnDate: b.returnDate || null, airline: b.airline || null, price,
      };
      res.json(await createManualDraft({ offer, style: b.style || null, photo: b.photo || null, langs: cleanLangs(b.langs) }));
    } catch (err) {
      console.error('studio manual:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      generating = false;
    }
  });

  // Regenerate one part: { what: 'photo'|'text'|'all'|'style'|'langs'|'photo-upload', value }
  router.post('/drafts/:id/regenerate', async (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const draft = store.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'not found' });
    const { what, value } = req.body || {};
    if (!['photo', 'text', 'all', 'style', 'langs', 'photo-upload'].includes(what)) return res.status(400).json({ error: 'bad request' });
    if (what === 'photo-upload' && !(typeof value === 'string' && value.length < 12000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) {
      return res.status(400).json({ error: 'bad image' });
    }
    if (generating) return res.status(429).json({ error: 'already generating' });
    generating = true;
    try { res.json(await regenerate(draft, what, value)); }
    catch (err) { console.error('studio regenerate:', err.message); res.status(500).json({ error: err.message }); }
    finally { generating = false; }
  });

  // Approve / reject / edit a caption.
  router.patch('/drafts/:id', (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const draft = store.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'not found' });
    const { status, lang, caption } = req.body || {};
    if (status !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'bad status' });
      draft.status = status;
      draft.decidedAt = new Date().toISOString();
    }
    if (caption !== undefined) {
      const v = draft.versions.find((x) => x.lang === lang);
      if (!v || typeof caption !== 'string' || caption.length > 2200) return res.status(400).json({ error: 'bad caption' });
      v.caption = caption;
      if (draft.texts && draft.texts[lang]) draft.texts[lang].caption = caption;
    }
    res.json(store.upsertDraft(draft));
  });

  app.use('/api/studio', express.json({ limit: '15mb' }), router);
  app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));
};
