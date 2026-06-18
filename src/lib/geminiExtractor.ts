import { Offer } from '../types';

const OFFER_SCHEMA = `Each offer object must have exactly this shape:
{
  "destination": "string (e.g. Griechenland)",
  "hookHeadline": "string (season/theme, e.g. Sommer Angebote)",
  "hookTagline": "string (call-to-action line, e.g. Luxus am Meer - Jetzt buchen!)",
  "hotels": [
    {
      "name": "string (hotel name)",
      "location": "string (city and area, e.g. Kos - Kardamena)",
      "stars": number (1-5),
      "price": "string (numeric only, e.g. 533)",
      "dateFrom": "string (e.g. 20.05.2026)",
      "dateTo": "string (e.g. 26.05.2026)",
      "airportDeparture": "string (departure city or airport)",
      "airportReturn": "string (return airport name)",
      "mealPlan": "string (e.g. All Inklusiv)",
      "transfer": "string (e.g. Inklusiv)",
      "rating": number (percentage 0-100, e.g. 94, use 0 if not shown)
    }
  ]
}`;

function parseOffers(raw: string): Offer[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as Offer[];
}

export async function extractOffersFromText(text: string, apiKey: string): Promise<Offer[]> {
  const prompt = `Extract all travel offers from the text below. Return ONLY a valid JSON array — no markdown, no explanation.\n${OFFER_SCHEMA}\nText: ${text}`;

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
  return parseOffers(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

export async function extractOffersFromImage(file: File, apiKey: string): Promise<Offer[]> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const prompt = `This is a screenshot or photo of a travel offer document. Extract all travel offers visible in the image. Return ONLY a valid JSON array — no markdown, no explanation.\n${OFFER_SCHEMA}`;

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
  return parseOffers(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}
