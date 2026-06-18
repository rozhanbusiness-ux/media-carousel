export type ContentType = 'hotel' | 'flight' | 'rivercruise' | 'seacruise' | 'post';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  hotel: '🏨 Hotel / Urlaub',
  flight: '✈️ Flug',
  rivercruise: '🚢 Flusskreuzfahrt',
  seacruise: '🛳️ Hochseekreuzfahrt',
  post: '📝 Normaler Post',
};

/** One label/value line shown on the details slide */
export interface DetailRow {
  label: string;
  value: string;
  icon: string;     // emoji icon, e.g. "📅"
}

/** A single offer item inside a carousel (a hotel, a flight, a cruise…) */
export interface CarouselItem {
  name: string;        // hotel / flight / ship name (main heading)
  subtitle: string;    // location or route, e.g. "Kos - Kardamena" / "Frankfurt → Antalya"
  price: string;       // numeric only, '' if none
  rating: number;      // percentage 0-100, 0 = hide
  stars: number;       // 0 = hide
  rows: DetailRow[];   // detail rows for the details slide
  imageHint: string;   // describes the ideal AI background for this item
}

export interface Carousel {
  type: ContentType;
  destination: string;   // header destination / theme
  hookHeadline: string;  // e.g. "Sommer Angebote"
  hookTagline: string;   // e.g. "Luxus am Meer - Jetzt buchen!"
  items: CarouselItem[]; // for 'post' usually empty
  flights?: FlightRoute[]; // for 'flight' type — structured flight offers
  body?: string;         // free-form body text for regular posts
}

/** One direction of a flight (Hinflug or Rückflug) */
export interface FlightLeg {
  direction: string;   // "Hinflug" | "Rückflug"
  from: string;        // "Frankfurt (FRA)"
  to: string;          // "Antalya (AYT)"
  date: string;        // "20.05.2026"
  time: string;        // "10:30 - 14:15" or ''
  flightNo: string;    // "XQ 123" or ''
}

/** A complete flight offer (round-trip, one-way, or one option in a package) */
export interface FlightRoute {
  title: string;       // "Frankfurt → Antalya" (route heading)
  airline: string;     // "SunExpress" or ''
  price: string;       // numeric only, per person
  priceNote: string;   // "p.P. Hin & Rück" or ''
  baggage: string;     // "20kg" or ''
  flightClass: string; // "Economy" or ''
  legs: FlightLeg[];   // outbound (+ optional return)
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
