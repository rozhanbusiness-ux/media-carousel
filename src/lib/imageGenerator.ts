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
  return `Ultra-realistic luxury travel photography, cinematic aerial wide shot of ${destination} coastline at golden hour, crystal blue sea, dramatic warm sky, no text, no watermarks, no logos, dark vignette at bottom for text overlay, 1080x1080`;
}

export function hotelImagePrompt(hotelName: string, stars: number, destination: string): string {
  return `Ultra-realistic luxury travel photography, facade view of a ${stars}-star resort named ${hotelName} in ${destination}, golden hour or dusk lighting, cinematic, no text, no watermarks, no logos, dark navy gradient at bottom 40% for text overlay, 1080x1080, professional hotel photography`;
}
