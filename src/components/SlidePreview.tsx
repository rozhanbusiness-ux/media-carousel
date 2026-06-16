import { GeneratedSlide, SlideSize, SLIDE_DIMENSIONS } from '../types';
import { useState } from 'react';

interface Props {
  slides: GeneratedSlide[];
  size: SlideSize;
}

export function SlidePreview({ slides, size }: Props) {
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const { width, height } = SLIDE_DIMENSIONS[size];
  const aspectRatio = width / height;
  const thumbH = 160;
  const thumbW = thumbH * aspectRatio;

  return (
    <div>
      <div className="slide-grid">
        {slides.map((slide, i) => {
          const url = URL.createObjectURL(slide.blob);
          return (
            <div key={i} className="slide-thumb" onClick={() => setEnlarged(url)} title={slide.label}>
              <img src={url} style={{ width: thumbW, height: thumbH, objectFit: 'cover' }} alt={slide.label} />
              <div className="slide-label">{slide.label}</div>
            </div>
          );
        })}
      </div>
      {enlarged && (
        <div className="lightbox" onClick={() => setEnlarged(null)}>
          <img src={enlarged} alt="enlarged" />
        </div>
      )}
    </div>
  );
}
