// ============================================================
//  studio/bank-ai.js — destination photos generated ONCE by Gemini into the
//  photo bank (client decision 2026-10-18), with a master prompt built on the
//  client's six rules. The client reviews them in the report; posts then take
//  them from the bank. Credit: "KI-generiert".
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const bank = require('./bank');

// Five scenes per destination: one clear subject, centred, with sky (and sea where there is one).
const SCENES = {
  IST: ['the Maiden\'s Tower on its small island in the Bosphorus, seen from the water at eye level',
    'the Galata Tower rising above the old rooftops of Beyoğlu, seen from a terrace across the street',
    'the Bosphorus Bridge spanning the strait, seen from the European shore with a calm sea in front',
    'a white ferry crossing the Bosphorus with the old city skyline far behind (no minarets visible)',
    'the colourful wooden mansions (yalı) on the Bosphorus shore at Arnavutköy, reflected in the water'],
  AYT: ['the Düden waterfall falling from the cliffs straight into the turquoise Mediterranean',
    'the old harbour of Kaleiçi with wooden gulets and the city walls, seen from above',
    'Konyaaltı beach with the Taurus mountains behind, seen from a low elevated point',
    'a sandy cove with crystal-clear turquoise water and pine trees near Antalya, seen from the cliff',
    'Hadrian\'s Gate in Kaleiçi, centred, with a palm tree beside it'],
  DXB: ['the Burj Khalifa alone against the sky, seen from the Dubai Fountain lake',
    'the Burj Al Arab on its island, seen from Jumeirah beach with turquoise water in front',
    'Dubai Marina towers reflected in the marina water, with yachts',
    'golden sand dunes of the Dubai desert under a deep blue sky, a single dune ridge in the centre',
    'the Museum of the Future, its silver ring shape centred against the sky'],
  LCA: ['the palm-lined Finikoudes promenade of Larnaca by the turquoise sea',
    'the medieval Larnaca fort at the seafront, centred, with the sea beside it',
    'a white-sand beach in Ayia Napa with crystal-clear turquoise water',
    'the sea caves of Cape Greco with turquoise water below the rocks',
    'the old pier of Larnaca stretching into a calm blue sea'],
  ATH: ['the Parthenon on the Acropolis, centred, seen from Filopappou hill with olive trees',
    'the Acropolis rock above the city, seen from Lycabettus hill',
    'the Temple of Poseidon at Cape Sounion on its cliff above the Aegean Sea',
    'a white-washed lane in the Plaka district with bougainvillea',
    'the Athens Riviera at Vouliagmeni with turquoise water and a small cove'],
  SOF: ['the Alexander Nevsky Cathedral with its golden domes, centred, on its square',
    'Vitosha mountain above Sofia, seen from a green park',
    'Vitosha Boulevard with the mountain at the end of the street',
    'the National Palace of Culture with its fountains',
    'the Seven Rila Lakes in the mountains near Sofia, seen from above'],
  CAI: ['the Great Pyramid of Giza alone against the sky, seen from the desert plateau',
    'the Great Sphinx with a pyramid behind it',
    'a white felucca sailing on the Nile in Cairo with the riverbank behind',
    'the Cairo Tower rising above the Nile',
    'the three Pyramids of Giza in a row seen from the panorama point in the desert'],
  EBL: ['the Erbil Citadel on its mound, centred, its ancient walls lit by the sun',
    'the main gate of the Erbil Citadel with the square and fountains in front',
    'Shanadar Park in Erbil with green lawns and fountains',
    'the Minare Park area of Erbil with green gardens and fountains, without any minaret visible',
    'the mountains near Erbil (Korek mountain) with green valleys'],
  ISU: ['the Azmar mountain above Sulaymaniyah, green slopes, seen from the city edge',
    'Dukan lake near Sulaymaniyah with clear blue water and hills around',
    'Goizha mountain with the city at its foot',
    'a green valley with a river near Sulaymaniyah in spring',
    'the Sulaymaniyah park with fountains and trees'],
  BGW: ['the Tigris river in Baghdad with a modern bridge, seen from the riverbank',
    'the Al-Shaheed Monument with its turquoise split dome, centred, with its reflecting pool',
    'the Baghdad Tower rising above palm trees',
    'a riverside promenade on the Tigris with palm trees',
    'the Victory Arch (Hands of Victory) in Baghdad, centred'],
};

/** Master prompt: the client's six rules, written as a photo brief. */
function masterPrompt(place, scene) {
  return [
    `Ultra-realistic professional travel photograph of ${place}: ${scene}.`,
    'This must look exactly like a real photo taken on a medium-format camera (Phase One / Hasselblad), not like a rendering.',
    'RULES (all mandatory):',
    '1. Few elements: ONE clear main subject in the CENTRE of the frame; simple, uncluttered composition; plenty of calm space around it.',
    '2. Clear sky: deep, clean cobalt-blue sky, at most a few small white clouds near the horizon; no haze.',
    '3. Brilliant sea: where water is visible it is bright, shining blue or turquoise, crystal clear.',
    '4. Highest resolution: tack-sharp from foreground to background, finest detail in stone, leaves and water.',
    '5. Strong colour contrast: rich, vivid, saturated-but-natural colours that pop (blue sky and sea against white, warm stone, green); bright sunny daylight.',
    '6. Clean: no people in focus, no cars, no crowds, no wires, no construction, no litter, no text, no signs, no logos, no watermark.',
    'Accurate to reality: the place and its landmark must look exactly as they really are; do not invent or move buildings.',
    'No mosque and no minaret anywhere in the frame.',
    'Vertical 9:16 frame; the subject centred horizontally (a centre square crop must still show it whole); top 12% calm sky for a logo; lower third calm (water, sand, lawn or plaza) for a price card.',
  ].join('\n');
}

async function generate(place, scene) {
  const model = process.env.GEMINI_IMAGE_MODEL_BANK || config.GEMINI_IMAGE_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: masterPrompt(place, scene) }] }],
      generationConfig: { responseModalities: ['Image'], imageConfig: { imageSize: config.GEMINI_IMAGE_SIZE || '2K', aspectRatio: '9:16' } },
    }),
    signal: AbortSignal.timeout(180000),
  });
  require('./ai-status').report(res.status);
  if (!res.ok) throw new Error(`Gemini image error ${res.status}`);
  const json = await res.json();
  const part = (json?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!part) throw new Error(`no image (finish: ${json?.candidates?.[0]?.finishReason || '-'})`);
  const inline = part.inlineData || part.inline_data;
  return { mime: inline.mimeType || inline.mime_type || 'image/png', data: inline.data };
}

/** Generate the scenes of one destination into the bank (skips scenes already generated). */
async function build(key, place, log = console.log) {
  const scenes = SCENES[key] || [];
  const index = bank.readIndex(key);
  const have = new Set(index.photos.map((p) => p.id));
  let added = 0;
  for (const [n, scene] of scenes.entries()) {
    const id = `ai:${key}:${n}`;
    if (have.has(id) || (index.removed || []).includes(id)) continue;
    try {
      const img = await generate(place, scene);
      const ext = img.mime === 'image/jpeg' ? 'jpg' : img.mime === 'image/webp' ? 'webp' : 'png';
      const file = `${crypto.createHash('sha1').update(id).digest('hex').slice(0, 16)}.${ext}`;
      fs.mkdirSync(bank.entryDir(key), { recursive: true });
      fs.writeFileSync(path.join(bank.entryDir(key), file), Buffer.from(img.data, 'base64'));
      index.photos.push({ id, file, score: null, shot: 'ai', x: 50, why: scene.slice(0, 60), thumb: '', ai: true,
        credit: { source: 'KI-generiert', author: '', license: '' }, added: new Date().toISOString() });
      added++;
      log(`${key}: scene ${n + 1}/${scenes.length} ok`);
    } catch (err) { log(`${key}: scene ${n + 1}: ${err.message}`); }
  }
  index.name = index.name || place;
  bank.writeIndex(key, index);
  return { key, added, total: index.photos.length };
}

module.exports = { build, masterPrompt, SCENES };
