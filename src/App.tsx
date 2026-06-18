import { useState, useCallback } from 'react';
import { Offer, SlideSize, GeneratedSlide, GenerationProgress, SLIDE_DIMENSIONS } from './types';
import { extractTextFromPDF } from './lib/pdfExtractor';
import { extractOffersFromText } from './lib/geminiExtractor';
import { generateImage, hookImagePrompt, hotelImagePrompt, describeHotel, gradientFallback, listAvailableImageModels } from './lib/imageGenerator';
import { renderHookSlide, renderHotelVisualSlide, renderHotelDetailsSlide, renderCtaSlide } from './lib/slideRenderer';
import { exportZip } from './lib/exporter';
import { UploadZone } from './components/UploadZone';
import { OfferCard } from './components/OfferCard';
import { SlidePreview } from './components/SlidePreview';
import { ProgressBar } from './components/ProgressBar';
import './App.css';

const SIZES: SlideSize[] = ['story', 'post', 'reel'];

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') ?? '');
  const [offers, setOffers] = useState<Offer[]>([]);
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
      const text = await extractTextFromPDF(file);
      const extracted = await extractOffersFromText(text, apiKey);
      setOffers(extracted);
      setPhase('ready');
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  }, [apiKey]);

  const generate = async () => {
    if (!apiKey || offers.length === 0) return;
    setPhase('generating');
    setError(null);

    // Count total steps: per size × (hook + hotelA + hotelB per hotel + CTA)
    const totalImages = offers.reduce((acc, o) => acc + 1 + o.hotels.length, 0); // hook + hotel images
    const totalSlides = offers.reduce((acc, o) => acc + 1 + o.hotels.length * 2, 0) + 1; // hook + A+B per hotel + CTA
    const totalSteps = totalImages + totalSlides * SIZES.length;
    let step = 0;

    const tick = (label: string) => {
      step++;
      setProgress({ current: step, total: totalSteps, label });
    };

    try {
      // Generate images first
      const hookImages: Record<string, string> = {};
      const hotelImages: Record<string, Record<string, string>> = {};

      const imgErrors: string[] = [];

      const safeGen = async (prompt: string, label: string): Promise<string> => {
        try {
          return await generateImage(prompt, apiKey);
        } catch (e: any) {
          imgErrors.push(`[${label}] ${e.message}`);
          return gradientFallback();
        }
      };

      for (const offer of offers) {
        tick(`Generiere Bild: ${offer.destination}`);
        hookImages[offer.destination] = await safeGen(hookImagePrompt(offer.destination), offer.destination);

        hotelImages[offer.destination] = {};
        for (const hotel of offer.hotels) {
          tick(`Generiere Bild: ${hotel.name}`);
          const desc = await describeHotel(hotel.name, hotel.location, apiKey);
          hotelImages[offer.destination][hotel.name] = await safeGen(
            hotelImagePrompt(hotel.name, hotel.location, desc),
            hotel.name
          );
        }
      }

      if (imgErrors.length > 0) {
        setError(`⚠️ Bildgenerierung-Fehler (Folien trotzdem erstellt):\n${imgErrors.slice(0, 2).join('\n')}`);
      }

      // Render slides per size
      const result: Record<SlideSize, GeneratedSlide[]> = { story: [], post: [], reel: [] };

      for (const size of SIZES) {
        // Hook slide per offer
        for (const offer of offers) {
          tick(`Render ${size}: Hook ${offer.destination}`);
          const blob = await renderHookSlide(offer, hookImages[offer.destination], size);
          result[size].push({ label: `hook_${offer.destination}`, blob });

          for (const hotel of offer.hotels) {
            tick(`Render ${size}: ${hotel.name} Foto`);
            const blobA = await renderHotelVisualSlide(hotel, hotelImages[offer.destination][hotel.name], size);
            result[size].push({ label: `${hotel.name}_foto`, blob: blobA });

            tick(`Render ${size}: ${hotel.name} Details`);
            const blobB = await renderHotelDetailsSlide(hotel, size);
            result[size].push({ label: `${hotel.name}_details`, blob: blobB });
          }
        }

        tick(`Render ${size}: CTA`);
        const ctaBlob = await renderCtaSlide(size);
        result[size].push({ label: 'cta', blob: ctaBlob });
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
        {phase === 'extracting' && <p className="status">⏳ PDF wird analysiert…</p>}
      </section>

      {error && <div className="error">❌ {error}</div>}

      {(phase === 'ready' || phase === 'generating' || phase === 'done') && offers.length > 0 && (
        <section>
          <h2>Angebote bearbeiten</h2>
          {offers.map((offer, i) => (
            <OfferCard
              key={i}
              offer={offer}
              onChange={(updated) => {
                const next = [...offers];
                next[i] = updated;
                setOffers(next);
              }}
            />
          ))}
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
