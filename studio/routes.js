// ============================================================
//  studio/routes.js — studio API + page (added to the existing app
//  with one line in server.js). Protected by the same Nginx login as
//  the rest of Carousel. Inputs are validated; nothing is published
//  from here (phase 1: approve, then download/copy manually).
// ============================================================

const path = require('path');
const express = require('express');
const store = require('./store');
const music = require('./music');
const ownOffers = require('./own-offers');
const covers = require('./covers');
const bank = require('./bank');
const { FEATURES, BOARD_KEYS } = require('./packages');
const { createBundleDraft, offerChoices, createPackageDraft, saveToLibrary, deleteDraft, createDailyDraft, createManualDraft, regenerate } = require('./planner');
const { STYLES } = require('./render');
const { getFlightOffers } = require('./offers');

const ID = /^[a-f0-9]{12}$/;
const LANG_SET = ['de', 'ar', 'ckb'];
const cleanLangs = (v) => (Array.isArray(v) && v.length && v.length <= 3 && v.every((l) => LANG_SET.includes(l)) ? [...new Set(v)] : null);
let generating = false;

module.exports = function mountStudio(app) {
  const router = express.Router();

  router.get('/drafts', (req, res) => res.json(store.listDrafts().slice(0, 30)));
  router.get('/ai-status', (req, res) => res.json(require('./ai-status').get()));

  router.get('/offers', async (req, res) => {
    try { res.json(await getFlightOffers()); } catch { res.status(502).json({ error: 'offers unavailable' }); }
  });

  // Today's offers of one kind for the "choose offer" list: [{ key, label, price }].
  router.get('/offer-choices', async (req, res) => {
    try { res.json(await offerChoices(req.query.kind === 'package' ? 'package' : 'flight')); }
    catch { res.status(502).json({ error: 'offers unavailable' }); }
  });

  // "Mehrere Angebote": 2-6 offers of ONE kind (flight or package) in one post.
  router.post('/drafts/bundle', async (req, res) => {
    const { kind, keys, langs } = req.body || {};
    if (!['flight', 'package'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
    if (!Array.isArray(keys) || keys.length < 2 || keys.length > 6 || !keys.every((k) => typeof k === 'string' && /^[A-Za-z0-9-]{3,40}$/.test(k)) || new Set(keys).size !== keys.length) {
      return res.status(400).json({ error: 'Bitte 2 bis 6 verschiedene Angebote wählen.' });
    }
    if (generating) return res.status(429).json({ error: 'already generating' });
    generating = true;
    try { res.json(await createBundleDraft({ kind, keys, langs: cleanLangs(langs) })); }
    catch (err) { console.error('studio bundle:', err.message); res.status(500).json({ error: err.message }); }
    finally { generating = false; }
  });

  // Package draft (hotel + flight), on demand.
  router.post('/drafts/package', async (req, res) => {
    if (generating) return res.status(429).json({ error: 'already generating' });
    generating = true;
    try { res.json(await createPackageDraft({ langs: cleanLangs((req.body || {}).langs) })); }
    catch (err) { console.error('studio package draft:', err.message); res.status(500).json({ error: err.message }); }
    finally { generating = false; }
  });

  // Create today's (or a given day's) draft. One generation at a time.
  router.post('/drafts', async (req, res) => {
    if (generating) return res.status(429).json({ error: 'already generating' });
    const day = typeof req.body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? new Date(req.body.date + 'T12:00:00') : new Date();
    generating = true;
    try {
      const langs = cleanLangs(req.body.langs);
      const flight = await createDailyDraft({ date: day, langs });
      // Weekly plan (client): Monday and Thursday also get a package post.
      if ([1, 4].includes(day.getDay())) {
        try { await createPackageDraft({ date: day, langs }); } catch (err) { console.error('studio package draft:', err.message); }
      }
      res.json(flight);
    } catch (err) {
      console.error('studio draft:', err.message);
      res.status(500).json({ error: err.message });
    } finally {
      generating = false;
    }
  });

  // Manual river cruise or holiday home (client decision: entered by hand, not available from specials).
  router.post('/manual-extra', async (req, res) => {
    const b = req.body || {};
    const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max && !/[<>{}]/.test(v);
    const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    const money = (v) => v === null || v === undefined || v === '' || (Number(v) > 0 && Number(v) < 100000);
    const iso = (v) => v === '' || v === undefined || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
    const photoOk = !b.photo || (typeof b.photo === 'string' && b.photo.length < 12000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo));
    const id = require('crypto').randomBytes(4).toString('hex');
    let offer = null;
    if (b.kind === 'cruise' && text(b.ship, 2, 80) && text(b.river, 2, 60) && text(b.route, 2, 120) && int(b.nights, 1, 60)
      && iso(b.startDate) && (b.board === '' || Object.hasOwn(BOARD_KEYS, b.board)) && Number(b.price) > 0 && Number(b.price) < 100000) {
      offer = { kind: 'cruise', key: 'c-' + id, to: { code: '', name: b.river.trim() }, ship: b.ship.trim(), route: b.route.trim(),
        nights: b.nights, startDate: b.startDate || '', board: b.board, price: Number(b.price), country: '' };
    }
    const feats = Array.isArray(b.features) ? b.features : [];
    if (b.kind === 'home' && text(b.home, 2, 80) && text(b.place, 2, 60) && (b.country === '' || text(b.country, 2, 60))
      && int(b.persons, 1, 40) && int(b.bedrooms, 0, 20) && (b.nights === null || int(b.nights, 1, 60))
      && feats.length <= 6 && feats.every((f) => typeof f === 'string' && Object.hasOwn(FEATURES, f)) && money(b.priceNight) && money(b.priceTotal)
      && (Number(b.priceNight) > 0 || (Number(b.priceTotal) > 0 && b.nights))) {
      offer = { kind: 'home', key: 'h-' + id, to: { code: '', name: b.place.trim() }, country: (b.country || '').trim(), home: b.home.trim(),
        persons: b.persons, bedrooms: b.bedrooms, nights: b.nights || null, features: [...new Set(feats)],
        priceNight: Number(b.priceNight) || 0, priceTotal: Number(b.priceTotal) || 0, price: Number(b.priceNight) || Number(b.priceTotal) };
    }
    if (!offer || !photoOk) return res.status(400).json({ error: 'invalid offer data' });
    if (generating) return res.status(429).json({ error: 'already generating' });
    generating = true;
    try { res.json(await createManualDraft({ offer, style: 'flight', photo: b.photo || null, langs: cleanLangs(b.langs) })); }
    catch (err) { console.error('studio manual extra:', err.message); res.status(500).json({ error: err.message }); }
    finally { generating = false; }
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
    if (!['offer-next', 'offer-pick', 'photo', 'photo-pick', 'photo-auto', 'photo-ai', 'text', 'all', 'style', 'langs', 'photo-upload', 'bundle-photos', 'bundle-photo-pick', 'bundle-photo-upload', 'bundle-photo-ai'].includes(what)) return res.status(400).json({ error: 'bad request' });
    if (what === 'photo-upload' && !(typeof value === 'string' && value.length < 12000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) {
      return res.status(400).json({ error: 'bad image' });
    }
    if (what === 'offer-pick' && !(typeof value === 'string' && /^[A-Za-z0-9-]{3,40}$/.test(value))) return res.status(400).json({ error: 'bad offer' });
    const pid = (id) => (Number.isInteger(id) && id > 0 && id < 1e12) || (typeof id === 'string' && /^pb:\d{1,12}$/.test(id));
    if (what === 'photo-pick' && !pid(value)) return res.status(400).json({ error: 'bad photo' });
    const slot = (n) => Number.isInteger(n) && n >= -1 && n < 6;
    if (what === 'bundle-photos' && !slot(value)) return res.status(400).json({ error: 'bad slide' });
    if (what === 'bundle-photo-ai' && !(slot(value) && value >= 0)) return res.status(400).json({ error: 'bad slide' });
    if (what === 'bundle-photo-pick' && !(value && slot(value.n) && pid(value.id))) return res.status(400).json({ error: 'bad photo' });
    if (what === 'bundle-photo-upload' && !(value && slot(value.n) && typeof value.data === 'string' && value.data.length < 12000000
      && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.data))) return res.status(400).json({ error: 'bad image' });
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
      if (status === 'approved') {
        try { saveToLibrary(draft); } catch (err) { console.error('studio library:', err.message); }
      }
    }
    if (caption !== undefined) {
      const v = draft.versions.find((x) => x.lang === lang);
      if (!v || typeof caption !== 'string' || caption.length > 2200) return res.status(400).json({ error: 'bad caption' });
      v.caption = caption;
      if (draft.texts && draft.texts[lang]) draft.texts[lang].caption = caption;
    }
    res.json(store.upsertDraft(draft));
  });

  // Delete a draft; only rejected drafts can be deleted.
  router.delete('/drafts/:id', (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const draft = store.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: 'not found' });
    if (draft.status !== 'rejected') return res.status(409).json({ error: 'only rejected drafts can be deleted' });
    if (generating) return res.status(429).json({ error: 'busy' });
    deleteDraft(draft);
    res.json({ ok: true });
  });

  // "Eigene Angebote": the client's own offers (studio/own-offers.js).
  router.get('/own-offers', (req, res) => res.json(ownOffers.list()));
  router.post('/own-offers', (req, res) => {
    try { res.json(ownOffers.add(req.body)); }
    catch (err) { res.status(400).json({ error: err.message === 'full' ? `Maximal ${ownOffers.MAX} eigene Angebote.` : 'Bitte alle Pflichtfelder korrekt ausfüllen.' }); }
  });
  router.delete('/own-offers/:key', (req, res) => {
    if (!ownOffers.isOwnKey(req.params.key)) return res.status(400).json({ error: 'bad key' });
    res.status(ownOffers.remove(req.params.key) ? 200 : 404).json({});
  });

  // Cover photos per offer type for multi-offer posts (studio/covers.js).
  const coverKind = (k) => covers.KINDS.includes(k);
  router.get('/covers', (req, res) => res.json(coverKind(req.query.kind) ? covers.list(req.query.kind) : []));
  router.post('/covers/suggest', async (req, res) => {
    if (!coverKind((req.body || {}).kind)) return res.status(400).json({ error: 'bad kind' });
    try { res.json(await covers.suggest(req.body.kind)); } catch (err) { console.error('studio covers:', err.message); res.status(502).json({ error: 'Keine Vorschläge verfügbar.' }); }
  });
  router.post('/covers', async (req, res) => {
    const { kind, id } = req.body || {};
    if (!coverKind(kind) || !Number.isInteger(id)) return res.status(400).json({ error: 'bad request' });
    try { await covers.save(kind, id); res.json({ ok: true }); }
    catch (err) { res.status(400).json({ error: err.message === 'full' ? `Maximal ${covers.MAX_PER_KIND} Cover-Fotos pro Art.` : 'Foto nicht verfügbar – bitte Vorschläge neu laden.' }); }
  });
  router.get('/covers/:kind/:id', (req, res) => {
    const uri = coverKind(req.params.kind) && /^\d{1,12}$/.test(req.params.id) ? covers.read(req.params.kind, Number(req.params.id)) : null;
    const m = uri && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(uri);
    if (!m) return res.status(404).end();
    res.type(m[1]).send(Buffer.from(m[2], 'base64'));
  });
  router.delete('/covers/:kind/:id', (req, res) => {
    const ok = coverKind(req.params.kind) && /^\d{1,12}$/.test(req.params.id) && covers.remove(req.params.kind, Number(req.params.id));
    res.status(ok ? 200 : 404).json({});
  });

  // Reel music: the client's own licensed MP3s (studio/music.js).
  router.get('/music', (req, res) => res.json({ tracks: music.list(), recent: music.history() }));
  router.post('/music', express.raw({ type: 'audio/mpeg', limit: music.MAX_BYTES }), (req, res) => {
    let name = '';
    try { name = decodeURIComponent(String(req.get('X-Track-Name') || '')); } catch { /* keep default */ }
    try { res.json(music.add(req.body, name, req.get('X-Track-Kind') || 'all', req.get('X-Track-Mood') || 'calm')); } catch (err) { res.status(400).json({ error: err.message === 'too many tracks' ? 'too many tracks' : 'only mp3 files up to 10 MB' }); }
  });
  router.get('/music/:id', (req, res) => {
    if (!music.ID.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
    res.type('audio/mpeg').sendFile(music.file(req.params.id), (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });
  router.patch('/music/:id', (req, res) => {
    const { kind, mood } = req.body || {};
    res.status(music.tag(req.params.id, kind, mood) ? 200 : 400).json({});
  });
  router.post('/music/:id/used', (req, res) => res.status(music.used(req.params.id) ? 200 : 404).json({}));
  router.delete('/music/:id', (req, res) => res.status(music.remove(req.params.id) ? 200 : 404).json({}));

  // "Ideen des Tages" (news-ideas.js): collected and written once a day; nothing is published.
  let newsBusy = false;
  const news = require('./news-ideas');
  const newsRun = async (req, res, force) => {
    if (newsBusy) return res.status(429).json({ error: 'Ideen werden gerade erstellt …' });
    newsBusy = true;
    try { res.json(await news.today({ force })); }
    catch (err) { console.error('studio news:', err.message); res.status(500).json({ error: 'Ideen nicht verfügbar' }); }
    finally { newsBusy = false; }
  };
  router.get('/news', (req, res) => newsRun(req, res, false));
  router.post('/news/refresh', (req, res) => newsRun(req, res, true));
  router.post('/news/:id/status', (req, res) => {
    const { status } = req.body || {};
    if (!ID.test(req.params.id) || !['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'bad request' });
    const idea = news.setStatus(req.params.id, status);
    res.status(idea ? 200 : 404).json(idea || {});
  });
  // Real photos for an idea: search + rank (about a minute), then the client picks one.
  const newsPhotos = require('./news-photos');
  router.post('/news/:id/photos', async (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).json({ error: 'bad id' });
    const idea = news.getIdea(req.params.id);
    if (!idea) return res.status(404).json({ error: 'not found' });
    if (newsBusy) return res.status(429).json({ error: 'Bitte warten …' });
    newsBusy = true;
    try {
      const cands = await newsPhotos.search(idea);
      news.updateIdea(idea.id, (i) => { i.photoCandidates = cands; });
      res.json(cands);
    } catch (err) { console.error('studio news photos:', err.message); res.status(500).json({ error: 'Fotosuche fehlgeschlagen' }); }
    finally { newsBusy = false; }
  });
  router.post('/news/:id/photo', async (req, res) => {
    const { cand } = req.body || {};
    if (!ID.test(req.params.id) || typeof cand !== 'string' || cand.length > 80) return res.status(400).json({ error: 'bad request' });
    const idea = news.getIdea(req.params.id);
    const c = idea && (idea.photoCandidates || []).find((x) => x.id === cand); // only candidates found by the search
    if (!c) return res.status(404).json({ error: 'not found' });
    try {
      const photo = await newsPhotos.choose(idea.id, c);
      res.json(news.updateIdea(idea.id, (i) => { i.photo = photo; }));
    } catch (err) { console.error('studio news photo:', err.message); res.status(500).json({ error: 'Download fehlgeschlagen' }); }
  });
  router.get('/news/:id/photo.jpg', (req, res) => {
    if (!ID.test(req.params.id)) return res.status(400).end();
    res.type('image/jpeg').sendFile(newsPhotos.fileOf(req.params.id), (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });
  // Bank photo of an idea (key and file name validated against the bank index).
  router.get('/news/photo/:key/:file', (req, res) => {
    const { key, file } = req.params;
    if (!/^[a-z0-9-]{2,40}$/.test(key) || !/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(file)) return res.status(400).end();
    if (!(bank.readIndex(key).photos || []).some((p) => p.file === file)) return res.status(404).end();
    res.sendFile(path.join(bank.entryDir(key), file), (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  app.use('/api/studio', express.json({ limit: '15mb' }), router);
  app.get('/studio', (req, res) => res.sendFile(path.join(__dirname, 'studio.html')));
  // Vendored MP4 muxer for the in-browser Reel (studio/vendor, MIT).
  app.get('/studio/mp4-muxer.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'vendor', 'mp4-muxer.js')));
};
