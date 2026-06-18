// Image generation — auto-discovers available image models from the API, then tries them.

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
  throw new Error(`[${model}] No image part in response: ${JSON.stringify(data).slice(0, 200)}`);
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
  throw new Error(`[${model}] No bytesBase64Encoded: ${JSON.stringify(data).slice(0, 200)}`);
}

/** Query the Gemini API to discover which image-generation models are available for this key */
export async function listAvailableImageModels(apiKey: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models ?? [];
    return models
      .filter(m =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        (m.name.toLowerCase().includes('image') || m.name.toLowerCase().includes('imagen'))
      )
      .map(m => m.name.replace('models/', ''));
  } catch {
    return [];
  }
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

export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  // Discover available image models, then try known hardcoded ones as fallback
  const discovered = await listAvailableImageModels(apiKey);
  const knownModels = [
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.5-flash-preview-image-generation',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-image',
    'imagen-3.0-generate-002',
    'imagen-4.0-generate-001',
  ];

  // Deduplicate: discovered first, then known
  const toTry = [...new Set([...discovered, ...knownModels])];

  const errors: string[] = [];
  for (const model of toTry) {
    try {
      if (model.startsWith('imagen')) {
        return await tryImagen(model, prompt, apiKey);
      } else {
        return await tryGeminiImage(model, prompt, apiKey);
      }
    } catch (e: any) {
      errors.push(e.message?.slice(0, 120) ?? String(e));
    }
  }

  const msg = errors.slice(0, 3).join('\n');
  console.warn('All image models failed:\n', msg);
  throw new Error(`Bildgenerierung fehlgeschlagen:\n${msg}`);
}

export function hookImagePrompt(destination: string): string {
  return `Luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or famous landmark, crystal blue sea, dramatic sky, no text, no watermarks, professional travel magazine style`;
}

export async function describeHotel(hotelName: string, location: string, apiKey: string): Promise<string> {
  const q = `You are a travel photographer. Describe in ONE vivid English paragraph (max 70 words) the real visual appearance of the hotel "${hotelName}" in ${location}: its architecture style, building colors, number of floors, the pool, gardens, beach/sea or mountains around it. Output only the description, no preamble.`;
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
  const detail = description ?? `beautiful facade and pool view of ${hotelName} resort in ${location}`;
  return `Ultra-realistic professional hotel photography. ${detail}. Golden hour lighting, vivid saturated colors, sharp focus, warm cinematic tones, real architectural photo, no text, no watermarks, no people in foreground.`;
}
