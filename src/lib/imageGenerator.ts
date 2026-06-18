async function tryImagen(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
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
  throw new Error('No image in response');
}

async function tryGeminiFlash(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
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

function gradientPlaceholder(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(1, '#1a2f4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = 'rgba(212,175,55,0.15)';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.fillText(label, 540, 540);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  try {
    return await tryImagen(prompt, apiKey);
  } catch (_e1) {
    try {
      return await tryGeminiFlash(prompt, apiKey);
    } catch (_e2) {
      // Return a gradient placeholder so slides can still be composed
      const label = prompt.split(',')[0].replace(/^.*?of\s+/i, '').slice(0, 40);
      return gradientPlaceholder(label);
    }
  }
}

export function hookImagePrompt(destination: string): string {
  return `Ultra-realistic luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or iconic landmark, crystal-clear sea or dramatic landscape, warm dramatic sky, no text, no watermarks, no logos, dark vignette at edges, professional travel magazine quality`;
}

export function hotelImagePrompt(hotelName: string, location: string): string {
  return `Ultra-realistic luxury hotel photography, facade or pool view of a luxury resort named ${hotelName} in ${location}, golden hour or dusk lighting, warm cinematic tones, no text, no watermarks, no logos, dark navy gradient at bottom, professional architectural hotel photography`;
}
