export async function generateImage(prompt: string, apiKey: string): Promise<string> {
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed: ${err}`);
  }

  const data = await response.json();
  const img = data.predictions?.[0];
  if (img?.bytesBase64Encoded) {
    return `data:${img.mimeType ?? 'image/png'};base64,${img.bytesBase64Encoded}`;
  }
  throw new Error('No image returned from Imagen');
}

export function hookImagePrompt(destination: string): string {
  return `Ultra-realistic luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or iconic landmark, crystal-clear sea or dramatic landscape, warm dramatic sky, no text, no watermarks, no logos, dark vignette at edges, professional travel magazine quality`;
}

export function hotelImagePrompt(hotelName: string, location: string): string {
  return `Ultra-realistic luxury hotel photography, facade or pool view of a luxury resort named ${hotelName} in ${location}, golden hour or dusk lighting, warm cinematic tones, no text, no watermarks, no logos, dark navy gradient at bottom, professional architectural hotel photography`;
}
