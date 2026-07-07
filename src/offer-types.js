// ============================================================
//  offer-types.js — central registry of offer types
//  Each offer type defines: english id, German display name,
//  its own background-generation prompt builder, and its field list.
//  Field list serves double duty: template fields AND extraction targets.
// ============================================================

const OFFER_TYPES = {

  flight: {
    id: 'flight',
    displayName: 'Flug',                 // German UI name
    sizes: ['square', 'story', 'portrait'],  // available sizes for this type
    // templates per size: array = slides rendered per offer (flight = 1 slide)
    templates: {
      story:    ['offer-slide.html'],
      square:   ['offer-slide-square.html'],
      portrait: ['offer-slide-portrait.html'],
    },

    // Background prompt builder (subject = user's image description)
    buildBackgroundPrompt(subject, orientationText) {
      return [
        `Professional high-quality travel photograph of ${subject}.`,
        'Composition: the sky occupies at most 10 percent at the very top;',
        'the rest of the frame is filled with the city, landmarks, or scenery.',
        'The very top strip of the image MUST be a clean bright BLUE sky with a smooth gradient,',
        'daytime, clear blue sky only — absolutely no sunset, no orange, no golden sky at the top.',
        'Ultra realistic, true-to-life colors, very high contrast, sharp details, high resolution,',
        'vibrant and rich tones, bright clear daylight, aerial or elevated view.',
        'CRITICAL COMPOSITION RULE: place the city skyline and all key landmarks in the UPPER-MIDDLE band',
        'of the frame, roughly between 15 and 60 percent of the image height from the top.',
        'The bottom 40 percent may contain water, streets or foreground that can be safely cropped away,',
        'because the image will be cropped to square and 4:5 formats keeping the upper part.',
        orientationText + ' No text, no logos, no watermarks, no people in foreground.',
      ].join(' ');
    },

    // Fields: english key -> German label + defaults + validation
    fields: {
      origin:      { label: 'Abflugort',  type: 'text', required: true, maxLen: 18, default: 'DÜSSELDORF' },
      destination: { label: 'Reiseziel',  type: 'text', required: true, maxLen: 20, default: 'Erbil' },
      price:       { label: 'Preis',      type: 'text', required: true, maxLen: 6,  default: '649' },
      date_out:    { label: 'Hinflug',    type: 'text', required: true, maxLen: 12, default: '03.07.2026' },
      date_return: { label: 'Rückflug',   type: 'text', required: true, maxLen: 12, default: '18.07.2026' },
      baggage_1:   { label: 'Gepäck 1',   type: 'text', required: true, maxLen: 8,  default: '23 KG' },
      baggage_2:   { label: 'Gepäck 2',   type: 'text', required: true, maxLen: 8,  default: '8 KG' },
    },
  },

  package: {
    id: 'package',
    displayName: 'Pauschalreise',
    sizes: ['story'], // square/portrait templates not built yet
    // templates per size: package renders a PAIR per offer (hotel + details)
    templates: {
      story: ['package-hotel.html', 'package-details.html'],
    },

    buildBackgroundPrompt(subject, orientationText) {
      // same city-panorama composition as flight offers
      return OFFER_TYPES.flight.buildBackgroundPrompt(subject, orientationText);
    },

    fields: {
      destination:  { label: 'Reiseziel',      type: 'text', required: true,  maxLen: 20, default: '' },
      hotel_name:   { label: 'Hotelname',      type: 'text', required: true,  maxLen: 40, default: '' },
      price:        { label: 'Preis',          type: 'text', required: true,  maxLen: 8,  default: '' },
      date_from:    { label: 'Reisedatum von', type: 'date', required: true,  maxLen: 12, default: '' },
      date_to:      { label: 'Reisedatum bis', type: 'date', required: true,  maxLen: 12, default: '' },
      origin:       { label: 'Hinflug',        type: 'text', required: true,  maxLen: 18, default: '' },
      board:        { label: 'Verpflegung',    type: 'select', required: false, maxLen: 20, default: '', options: ['nur Übernachtung', 'Frühstück', 'Halb Pension', 'Full Pension', 'All Inklusive', 'All Inklusive +'] },
      transfer:     { label: 'Transfer',       type: 'text', required: false, maxLen: 15, default: '' },
      stars:        { label: 'Bewertung',      type: 'text', required: false, maxLen: 1,  default: '' },
      promo_line:   { label: 'Aktionszeile',   type: 'text', required: false, maxLen: 40, default: '', manual: true },
      room_details: { label: 'Zimmerdetails',  type: 'text', required: false, maxLen: 60, default: '', manual: true },
    },
  },

};

function getOfferType(id) {
  return OFFER_TYPES[id] || null;
}

function listOfferTypes() {
  return Object.values(OFFER_TYPES).map(t => ({ id: t.id, displayName: t.displayName }));
}

module.exports = { OFFER_TYPES, getOfferType, listOfferTypes };
