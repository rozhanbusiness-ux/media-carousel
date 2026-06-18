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
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
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

// Clean cinematic gradient — no text. Used only when all APIs fail.
function gradientPlaceholder(): string {
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
  // Log all errors to console so we can debug
  console.warn('All image models failed. Errors:\n' + errors.join('\n'));
  return gradientPlaceholder();
}

export function hookImagePrompt(destination: string): string {
  return `Luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or famous landmark, crystal blue sea, dramatic sky, no text, no watermarks, professional travel magazine style`;
}

export function hotelImagePrompt(hotelName: string, location: string): string {
  return `Luxury hotel photography, beautiful facade and pool view of ${hotelName} resort in ${location}, golden hour lighting, warm cinematic tones, no text, no watermarks, professional architectural photography`;
}
