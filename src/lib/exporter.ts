import JSZip from 'jszip';
import { GeneratedSlide, SlideSize } from '../types';

export async function exportZip(
  slides: Record<SlideSize, GeneratedSlide[]>,
  sizes: SlideSize[]
): Promise<void> {
  const zip = new JSZip();

  for (const size of sizes) {
    const folder = zip.folder(size)!;
    const slideList = slides[size];
    slideList.forEach((slide, idx) => {
      const name = `${String(idx + 1).padStart(2, '0')}_${slide.label}.png`;
      folder.file(name, slide.blob);
    });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'media-carousel.zip';
  a.click();
  URL.revokeObjectURL(url);
}
