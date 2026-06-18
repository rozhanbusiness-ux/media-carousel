// Image generation — tries current Gemini image models then falls back to a clean gradient.

async function tryGeminiImage(model: string, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[${model}] HTTP ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error(`[${model}] No image part in response: ${JSON.stringify(data).slice(0, 300)}`);
}

async function tryImagen(model: string, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '3:4' },
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[${model}] HTTP ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const img = data.predictions?.[0];
  if (img?.bytesBase64Encoded) return `data:${img.mimeType ?? 'image/png'};base64,${img.bytesBase64Encoded}`;
  throw new Error(`[${model}] No bytesBase64Encoded: ${JSON.stringify(data).slice(0, 300)}`);
}

// Clean cinematic gradient — no text. Exported so App can use it as fallback.
export function gradientFallback(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, '#1a3a5c');
  grad.addColorStop(0.5, '#0f2742');
  grad.addColorStop(1, '#0a1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
  const radial = ctx.createRadialGradient(540, 380, 50, 540, 380, 700);
  radial.addColorStop(0, 'rgba(212,175,55,0.18)');
  radial.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 1080, 1080);
  return canvas.toDataURL('image/jpeg', 0.9);
}

const IMAGE_MODELS: Array<(p: string, k: string) => Promise<string>> = [
  (p, k) => tryGeminiImage('gemini-2.0-flash-preview-image-generation', p, k),
  (p, k) => tryImagen('imagen-3.0-generate-002', p, k),
  (p, k) => tryGeminiImage('gemini-2.0-flash-exp', p, k),
];

export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const errors: string[] = [];
  for (const attempt of IMAGE_MODELS) {
    try {
      return await attempt(prompt, apiKey);
    } catch (e: any) {
      errors.push(e.message ?? String(e));
    }
  }
  const msg = errors.join(' | ');
  console.warn('All image models failed:', msg);
  // Surface the real error so user can see it
  throw new Error(`Bildgenerierung fehlgeschlagen: ${msg}`);
}

export function hookImagePrompt(destination: string): string {
  return `Luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or famous landmark, crystal blue sea, dramatic sky, no text, no watermarks, professional travel magazine style`;
}

/**
 * Ask the Gemini text model to describe what the REAL hotel actually looks like,
 * so the generated image is as close as possible to reality.
 * Falls back to a generic description if the lookup fails.
 */
export async function describeHotel(hotelName: string, location: string, apiKey: string): Promise<string> {
  const q = `You are a travel photographer. Describe in ONE vivid English paragraph (max 70 words) the real visual appearance of the hotel "${hotelName}" in ${location}: its architecture style, building colors, number of floors, the pool, gardens, beach/sea or mountains around it, and overall atmosphere. If you are not certain of the exact hotel, describe a typical real resort of that name and region. Output only the description, no preamble.`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: q }] }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const desc = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (desc) return desc;
  } catch (_e) {
    // fall through to generic
  }
  return `a luxury resort named ${hotelName} in ${location} with elegant architecture, a large pool and palm gardens`;
}

export function hotelImagePrompt(hotelName: string, location: string, description?: string): string {
  const detail = description
    ? description
    : `beautiful facade and pool view of ${hotelName} resort in ${location}`;
  return `Ultra-realistic professional hotel photography. ${detail}. Golden hour lighting, vivid saturated colors, sharp focus, warm cinematic tones, real architectural photo, no text, no watermarks, no people in foreground.`;
}
