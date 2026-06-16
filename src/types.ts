export interface Hotel {
  name: string;
  stars: number;
  price: string;
  dateFrom: string;
  dateTo: string;
  airportDeparture: string;
  airportReturn: string;
  mealPlan: string;
  transfer: string;
  rating: number;
}

export interface Offer {
  destination: string;
  hookHeadline: string;
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
