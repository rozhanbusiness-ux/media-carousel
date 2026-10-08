// ============================================================
//  studio/routes.js — studio API + page (added to the existing app
//  with one line in server.js). Protected by the same Nginx login as
//  the rest of Carousel. Inputs are validated; nothing is published
//  from here (phase 1: approve, then download/copy manually).
// ============================================================

const path = require('path');
const express = require('express');
const store = require('./store');
const { createDailyDraft } = require('./planner');
const { getFlightOffers } = require('./offers');

const ID = /^[a-f0-9]{12}$/;
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
      res.json(await createDailyDraft({ date: day }));
    } catch (err) {
      console.error('studio draft:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      generating = false;
    }
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
    }
    res.json(store.upsertDraft(draft));
  });

  app.use('/api/studio', router);
  app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));
};
