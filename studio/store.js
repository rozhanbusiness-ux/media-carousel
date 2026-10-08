// ============================================================
//  studio/store.js — drafts and history as a JSON file in cache/
//  (cache/ is already a mounted volume on the server and *.txt is
//  git-ignored, so no Docker or .gitignore change is needed).
// ============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cache', 'studio-store.txt');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { drafts: [] }; }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, FILE);
}

function listDrafts() { return load().drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

function getDraft(id) { return load().drafts.find((d) => d.id === id) || null; }

function upsertDraft(draft) {
  const data = load();
  const i = data.drafts.findIndex((d) => d.id === draft.id);
  if (i >= 0) data.drafts[i] = draft; else data.drafts.push(draft);
  data.drafts = data.drafts.slice(-200); // keep the last 200
  save(data);
  return draft;
}

/** Destination codes used by drafts created in the last `days` days (not rejected). */
function recentDestinations(days) {
  const since = Date.now() - days * 86400000;
  return new Set(load().drafts.filter((d) => d.status !== 'rejected' && Date.parse(d.createdAt) >= since).map((d) => d.offer.to.code));
}

function removeDraft(id) {
  const data = load();
  data.drafts = data.drafts.filter((d) => d.id !== id);
  save(data);
}

module.exports = { listDrafts, getDraft, upsertDraft, removeDraft, recentDestinations };
