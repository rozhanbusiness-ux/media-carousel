export interface Hotel {
  name: string;
  location: string;      // e.g. "Kos - Kardamena"
  stars: number;
  price: string;         // numeric string e.g. "533"
  dateFrom: string;
  dateTo: string;
  airportDeparture: string;
  airportReturn: string;
  mealPlan: string;
  transfer: string;
  rating: number;        // percentage 0-100, e.g. 94
}

export interface Offer {
  destination: string;
  hookHeadline: string;  // e.g. "Sommer Angebote"
  hookTagline: string;   // e.g. "Luxus am Meer - Jetzt buchen!"
  hotels: Hotel[];
}

export type SlideSize = 'story' | 'post' | 'reel';

export const SLIDE_DIMENSIONS: Record<SlideSize, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post:  { width: 1080, height: 1080 },
  reel:  { width: 1080, height: 1350 },
};

export interface GeneratedSlide {
  label: string;
  blob: Blob;
}

export interface GenerationProgress {
  current: number;
  total: number;
  label: string;
}
