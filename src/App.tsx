import { useState, useCallback } from 'react';
import { Carousel, SlideSize, GeneratedSlide, GenerationProgress, SLIDE_DIMENSIONS } from './types';
import { extractTextFromPDF } from './lib/pdfExtractor';
import { extractCarouselFromText, extractCarouselFromImage } from './lib/geminiExtractor';
import { generateImage, hookImagePrompt, itemImagePrompt, describeHotel, gradientFallback, listAvailableImageModels } from './lib/imageGenerator';
import { renderHookSlide, renderVisualSlide, renderDetailsSlide, renderPostSlide, renderFlightVisualSlide, renderFlightDetailsSlide, renderCtaSlide } from './lib/slideRenderer';
import { exportZip } from './lib/exporter';
import { UploadZone } from './components/UploadZone';
import { OfferCard } from './components/OfferCard';
import { SlidePreview } from './components/SlidePreview';
import { ProgressBar } from './components/ProgressBar';
import './App.css';

const SIZES: SlideSize[] = ['story', 'post', 'reel'];

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') ?? '');
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  // customPhotos[itemIdx] = data URL of user-uploaded photo
  const [customPhotos, setCustomPhotos] = useState<Record<string, string>>({});
  const [slides, setSlides] = useState<Record<SlideSize, GeneratedSlide[]> | null>(null);
  const [activeSize, setActiveSize] = useState<SlideSize>('story');
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [phase, setPhase] = useState<'idle' | 'extracting' | 'ready' | 'generating' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const saveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const testImageGen = async () => {
    if (!apiKey) { setError('Bitte Gemini API Key eingeben.'); return; }
    setError(null);
    setPhase('extracting');
    const available = await listAvailableImageModels(apiKey);
    try {
      const result = await generateImage('A luxury hotel pool in Turkey at sunset', apiKey);
      if (result.startsWith('data:image')) {
        setError(`✅ Bildgenerierung funktioniert! Verfügbare Modelle: ${available.join(', ')}`);
      }
    } catch (e: any) {
      setError(`❌ Fehler (Modelle: ${available.join(', ')}):\n${e.message}`);
    }
    setPhase('idle');
  };

  const handleFile = useCallback(async (file: File) => {
    if (!apiKey) { setError('Bitte Gemini API Key eingeben.'); return; }
    setError(null);
    setPhase('extracting');
    try {
      let extracted: Carousel;
      if (file.type === 'application/pdf') {
        const text = await extractTextFromPDF(file);
        extracted = await extractCarouselFromText(text, apiKey);
      } else if (file.type.startsWith('image/')) {
        extracted = await extractCarouselFromImage(file, apiKey);
      } else {
        throw new Error('Nur PDF oder Bild-Dateien werden unterstützt.');
      }
      setCarousel(extracted);
      setCustomPhotos({});
      setPhase('ready');
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  }, [apiKey]);

  const handleCustomPhoto = (itemIdx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCustomPhotos(prev => ({ ...prev, [String(itemIdx)]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!apiKey || !carousel) return;
    setPhase('generating');
    setError(null);

    const isPost = carousel.type === 'post';
    const isFlight = carousel.type === 'flight';
    const totalImages = 1 + (isPost || isFlight ? 0 : carousel.items.length); // hook + per-item
    const totalSlides = (isPost ? 2 : isFlight ? 2 : 1 + carousel.items.length * 2) + 1; // +CTA
    const totalSteps = totalImages + totalSlides * SIZES.length;
    let step = 0;
    const tick = (label: string) => { step++; setProgress({ current: step, total: totalSteps, label }); };

    const imgErrors: string[] = [];
    const safeGen = async (prompt: string, label: string): Promise<string> => {
      try { return await generateImage(prompt, apiKey); }
      catch (e: any) { imgErrors.push(`[${label}] ${e.message}`); return gradientFallback(); }
    };

    try {
      // ── Generate background images ──
      tick(`Generiere Bild: ${carousel.destination}`);
      const hookImage = await safeGen(hookImagePrompt(carousel.destination, carousel.type), carousel.destination);

      // Flight visual background: use a custom uploaded photo if provided, else the AI hook image
      const flightBg = isFlight ? (customPhotos['0'] ?? hookImage) : hookImage;

      const itemImages: string[] = [];
      if (!isPost && !isFlight) {
        for (let i = 0; i < carousel.items.length; i++) {
          const item = carousel.items[i];
          if (customPhotos[String(i)]) {
            tick(`Foto: ${item.name} (eigenes Bild)`);
            itemImages[i] = customPhotos[String(i)];
          } else {
            tick(`Generiere Bild: ${item.name}`);
            let hint = item.imageHint;
            if (carousel.type === 'hotel') {
              hint = await describeHotel(item.name, item.subtitle, apiKey);
            }
            itemImages[i] = await safeGen(
              itemImagePrompt(item.name, item.subtitle, carousel.type, hint),
              item.name
            );
          }
        }
      }

      if (imgErrors.length > 0) {
        setError(`⚠️ Bildgenerierung-Fehler (Folien trotzdem erstellt):\n${imgErrors.slice(0, 2).join('\n')}`);
      }

      // ── Render slides per size ──
      const result: Record<SlideSize, GeneratedSlide[]> = { story: [], post: [], reel: [] };
      for (const size of SIZES) {
        if (isFlight) {
          tick(`Render ${size}: Flug Visual`);
          result[size].push({ label: `flug_${carousel.destination}`, blob: await renderFlightVisualSlide(carousel, flightBg, size) });
          tick(`Render ${size}: Flug Details`);
          result[size].push({ label: 'flug_details', blob: await renderFlightDetailsSlide(carousel, size) });
          tick(`Render ${size}: CTA`);
          result[size].push({ label: 'cta', blob: await renderCtaSlide(size) });
          continue;
        }

        tick(`Render ${size}: Cover`);
        result[size].push({ label: `cover_${carousel.destination}`, blob: await renderHookSlide(carousel, hookImage, size) });

        if (isPost) {
          tick(`Render ${size}: Inhalt`);
          result[size].push({ label: 'post_text', blob: await renderPostSlide(carousel, hookImage, size) });
        } else {
          for (let i = 0; i < carousel.items.length; i++) {
            const item = carousel.items[i];
            tick(`Render ${size}: ${item.name} Foto`);
            result[size].push({ label: `${item.name}_foto`, blob: await renderVisualSlide(item, itemImages[i], size) });
            tick(`Render ${size}: ${item.name} Details`);
            result[size].push({ label: `${item.name}_details`, blob: await renderDetailsSlide(item, size) });
          }
        }

        tick(`Render ${size}: CTA`);
        result[size].push({ label: 'cta', blob: await renderCtaSlide(size) });
      }

      setSlides(result);
      setPhase('done');
      setProgress(null);
    } catch (e: any) {
      setError(e.message);
      setPhase('ready');
      setProgress(null);
    }
  };

  const download = (sizes: SlideSize[]) => {
    if (slides) exportZip(slides, sizes);
  };

  return (
    <div className="app">
      <header>
        <h1>MEDIA <span className="gold">Carousel Generator</span></h1>
        <p>Travel &amp; Tourism — Automatische Karussell-Erstellung</p>
      </header>

      <section className="api-section">
        <label>Gemini API Key</label>
        <input
          type="password"
          placeholder="AIza..."
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
          className="api-input"
        />
        <button className="btn-outline" style={{ marginTop: 8, fontSize: '0.85em' }} onClick={testImageGen}>
          🔍 Bildgenerierung testen
        </button>
      </section>

      <section>
        <UploadZone onFile={handleFile} disabled={phase === 'extracting' || phase === 'generating'} />
        {phase === 'extracting' && <p className="status">⏳ Datei wird analysiert…</p>}
      </section>

      {error && <div className="error">❌ {error}</div>}

      {(phase === 'ready' || phase === 'generating' || phase === 'done') && carousel && (
        <section>
          <h2>Inhalt bearbeiten</h2>
          <OfferCard
            carousel={carousel}
            customPhotos={customPhotos}
            onCustomPhoto={handleCustomPhoto}
            onChange={setCarousel}
          />
          <button
            className="btn-gold"
            onClick={generate}
            disabled={phase === 'generating'}
          >
            {phase === 'generating' ? '⏳ Generiere…' : '🎨 Karussell generieren'}
          </button>
        </section>
      )}

      {progress && <ProgressBar current={progress.current} total={progress.total} label={progress.label} />}

      {phase === 'done' && slides && (
        <section>
          <h2>Vorschau</h2>
          <div className="size-tabs">
            {SIZES.map((s) => (
              <button key={s} className={`tab ${activeSize === s ? 'active' : ''}`} onClick={() => setActiveSize(s)}>
                {s === 'story' ? 'Story 9:16' : s === 'post' ? 'Post 1:1' : 'Reel 4:5'}
                <span style={{ marginLeft: 6, fontSize: '0.75em', opacity: 0.7 }}>
                  {SLIDE_DIMENSIONS[s].width}×{SLIDE_DIMENSIONS[s].height}
                </span>
              </button>
            ))}
          </div>
          <SlidePreview slides={slides[activeSize]} size={activeSize} />
          <div className="download-row">
            <button className="btn-gold" onClick={() => download([activeSize])}>
              ⬇ {activeSize.toUpperCase()} herunterladen
            </button>
            <button className="btn-outline" onClick={() => download(SIZES)}>
              ⬇ Alle Größen (ZIP)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
