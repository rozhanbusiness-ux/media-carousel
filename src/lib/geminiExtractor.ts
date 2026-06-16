import { Offer } from '../types';

export async function extractOffersFromText(text: string, apiKey: string): Promise<Offer[]> {
  const prompt = `Extract all travel offers from the text below. Return ONLY a valid JSON array — no markdown, no explanation.
Each offer object must have exactly this shape:
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
      "rating": number (percentage 0-100, e.g. 94)
    }
  ]
}
Text: ${text}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini extraction failed: ${err}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as Offer[];
}
