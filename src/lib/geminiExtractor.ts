import { Carousel, ContentType } from '../types';

const SCHEMA = `Return ONLY a valid JSON object — no markdown, no explanation. Shape:
{
  "type": "hotel" | "flight" | "rivercruise" | "seacruise" | "post",
  "destination": "string (main destination or theme, e.g. Griechenland / Nilkreuzfahrt / Reisetipp)",
  "hookHeadline": "string (season/theme line, e.g. Sommer Angebote)",
  "hookTagline": "string (call-to-action line, e.g. Luxus am Meer - Jetzt buchen!)",
  "body": "string (ONLY for type=post: the main post text, 1-3 short sentences. Empty otherwise)",
  "items": [
    {
      "name": "string (main heading: hotel name / flight title / ship name)",
      "subtitle": "string (location or route, e.g. 'Kos - Kardamena' or 'Frankfurt → Antalya')",
      "price": "string (numeric only, e.g. 533, empty if none)",
      "rating": number (percentage 0-100, 0 if not shown),
      "stars": number (1-5, 0 if not applicable),
      "imageHint": "string (short English phrase describing the ideal background photo for this item)",
      "rows": [ { "label": "string", "value": "string", "icon": "single emoji" } ]
    }
  ]
}

Choose the correct "type" yourself by reading the content:
- "hotel": holiday/hotel package offers. rows should cover: Reisedatum (📅), Hinflug (✈), Rückflug (✈), Verpflegung (🍽), Transfer (🚌), and Bewertung (⭐) if a rating exists.
- "flight": flight-only offers. rows: Abflug (🛫), Ankunft (🛬), Airline (🏢), Reisedatum (📅), Gepäck (🧳), Hin/Rückflug (🔁).
- "rivercruise": river cruise (Nile, Rhine, Danube…). rows: Route/Fluss (🌊), Schiff (🚢), Nächte (🌙), Häfen/Stopps (📍), Kabine (🛏), Verpflegung (🍽).
- "seacruise": ocean cruise. rows: Reederei (🏢), Schiff (🛳), Meer/Region (🌊), Häfen (⚓), Kabine (🛏), Verpflegung (🍽).
- "post": a non-promotional post (travel tip, destination of the week, quote, greeting). Put the message in "body" and leave "items" as an empty array (or a single item describing the visual).

Fill rows with whatever relevant fields the source actually contains; omit rows with no data.`;

function parseCarousel(raw: string): Carousel {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const c = JSON.parse(cleaned) as Carousel;
  if (!c.items) c.items = [];
  if (!c.type) c.type = 'hotel';
  c.items.forEach((it) => { if (!it.rows) it.rows = []; });
  return c;
}

export async function extractCarouselFromText(
  text: string,
  apiKey: string,
  forcedType?: ContentType
): Promise<Carousel> {
  const typeHint = forcedType ? `\nThe user says this content is of type "${forcedType}" — use that as the "type".` : '';
  const prompt = `Extract the social-media carousel content from the text below.${typeHint}\n${SCHEMA}\nText: ${text}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini extraction failed: ${await response.text()}`);
  const data = await response.json();
  const c = parseCarousel(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  if (forcedType) c.type = forcedType;
  return c;
}

export async function extractCarouselFromImage(
  file: File,
  apiKey: string,
  forcedType?: ContentType
): Promise<Carousel> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const typeHint = forcedType ? `\nThe user says this content is of type "${forcedType}" — use that as the "type".` : '';
  const prompt = `This is a screenshot or photo of a travel offer or social-media post. Extract its carousel content.${typeHint}\n${SCHEMA}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini image extraction failed: ${await response.text()}`);
  const data = await response.json();
  const c = parseCarousel(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  if (forcedType) c.type = forcedType;
  return c;
}
