// ============================================================
//  studio/ai-status.js — last Gemini problem, shown in the studio so
//  results made without AI (unranked photos, standard texts) are never
//  mistaken for AI results. In memory only; cleared by the next success.
// ============================================================

let last = null; // { status, at }

const HINTS = {
  402: 'Gemini-Guthaben aufgebraucht – bitte in Google AI Studio aufladen.',
  403: 'Gemini-Schlüssel ungültig oder gesperrt.',
  429: 'Gemini-Limit erreicht – bitte später erneut versuchen.',
};

/** Record a failed Gemini HTTP status (or ok when the call worked). */
function report(status) {
  if (status >= 200 && status < 300) { last = null; return; }
  last = { status, at: new Date().toISOString() };
}

/** null when fine, else { status, at, text } (German, for the studio). */
function get() {
  if (!last) return null;
  return { ...last, text: HINTS[last.status] || `Gemini-Fehler (HTTP ${last.status}).` };
}

module.exports = { report, get };
