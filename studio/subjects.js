// ============================================================
//  studio/subjects.js — the cities of the city library screen.
//  The real places themselves are found by Gemini on the web
//  (places.js), never written by hand (client 2026-11-21).
// ============================================================

// Cities of the library screen: library key (= ai-library keyOf), place and country for the prompt.
const CITIES = [
  ['EBL', 'Erbil', 'Iraq'], ['ISU', 'Sulaymaniyah', 'Iraq'], ['BGW', 'Baghdad', 'Iraq'], ['DUHOK', 'Duhok', 'Iraq'],
  ['DUS', 'Düsseldorf', 'Germany'], ['CGN', 'Köln', 'Germany'], ['FRA', 'Frankfurt', 'Germany'], ['MUC', 'München', 'Germany'],
  ['STR', 'Stuttgart', 'Germany'], ['HAM', 'Hamburg', 'Germany'], ['HAJ', 'Hannover', 'Germany'], ['BER', 'Berlin', 'Germany'],
  ['NUE', 'Nürnberg', 'Germany'], ['LEJ', 'Leipzig', 'Germany'], ['BRE', 'Bremen', 'Germany'], ['DTM', 'Dortmund', 'Germany'],
  ['AMS', 'Amsterdam', 'Netherlands'],
].map(([key, name, country]) => ({ key, name, country, place: key === 'DUHOK' ? { name: 'duhok' } : { code: key, name } }));

module.exports = { CITIES };
