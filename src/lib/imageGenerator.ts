export async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
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
    const err = await response.text();
    throw new Error(`Image generation failed: ${err}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('No image returned from Gemini');
}

export function hookImagePrompt(destination: string): string {
  return `Ultra-realistic luxury travel photography, cinematic aerial wide shot of ${destination} at golden hour, stunning coastline or iconic landmark, crystal-clear sea or dramatic landscape, warm dramatic sky, no text, no watermarks, no logos, dark navy vignette at top and bottom for text overlay, professional travel magazine quality`;
}

export function hotelImagePrompt(hotelName: string, location: string): string {
  return `Ultra-realistic luxury hotel photography, facade or pool view of a luxury resort named ${hotelName} in ${location}, golden hour or dusk lighting, warm cinematic tones, no text, no watermarks, no logos, dark navy gradient at bottom 45% for text overlay, professional architectural hotel photography`;
}
