// Image generation with multi-model fallback.
// Tries the current Gemini/Imagen image models in order, then falls back
// to a clean gradient (NO text) so slides always compose cleanly.

async function tryGeminiImage(model: string, prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('No image in Gemini response');
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
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const img = data.predictions?.[0];
  if (img?.bytesBase64Encoded) return `data:${img.mimeType ?? 'image/png'};base64,${img.bytesBase64Encoded}`;
  throw new Error('No image in Imagen response');
}

// Clean cinematic gradient — NO text overlay. Used only when all APIs fail.
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
  // subtle radial glow for depth
  const radial = ctx.createRadialGradient(540, 380, 50, 540, 380, 700);
  radial.addColorStop(0, 'rgba(212,175,55,0.18)');
  radial.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 1080, 1080);
  return canvas.toDataURL('image/jpeg', 0.9);
}

const IMAGE_ATTEMPTS: Array<(p: string, k: string) => Promise<string>> = [
  (p, k) => tryGeminiImage('gemini-2.5-flash-image', p, k),
  (p, k) => tryGeminiImage('gemini-2.0-flash-preview-image-generation', p, k),
  (p, k) => tryImagen('imagen-4.0-generate-001', p, k),
  (p, k) => tryImagen('imagen-3.0-generate-002', p, k),
];

export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  for (const attempt of IMAGE_ATTEMPTS) {
    try {
      return await attempt(prompt, apiKey);
    } catch (_e) {
      // try next model
    }
  }
  return gradientPlaceholder();
}

export function hookImagePrompt(destination: string): string {
  return `Ultra-realistic luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or iconic landmark, crystal-clear sea or dramatic landscape, warm dramatic sky, no text, no watermarks, no logos, dark vignette at edges, professional travel magazine quality`;
}

export function hotelImagePrompt(hotelName: string, location: string): string {
  return `Ultra-realistic luxury hotel photography, facade or pool view of a luxury resort named ${hotelName} in ${location}, golden hour or dusk lighting, warm cinematic tones, no text, no watermarks, no logos, dark navy gradient at bottom, professional architectural hotel photography`;
}
