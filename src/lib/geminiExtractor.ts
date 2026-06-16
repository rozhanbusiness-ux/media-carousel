import { Offer } from '../types';

export async function extractOffersFromText(text: string, apiKey: string): Promise<Offer[]> {
  const prompt = `Extract all travel offers from the text below. Return ONLY a valid JSON array.
Each offer object must have:
{
  "destination": "string",
  "hookHeadline": "string (e.g. Sommer Angebote)",
  "hotels": [
    {
      "name": "string",
      "stars": number,
      "price": "string",
      "dateFrom": "string",
      "dateTo": "string",
      "airportDeparture": "string",
      "airportReturn": "string",
      "mealPlan": "string",
      "transfer": "string",
      "rating": number
    }
  ]
}
Return ONLY the JSON array, no markdown, no explanation.
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
