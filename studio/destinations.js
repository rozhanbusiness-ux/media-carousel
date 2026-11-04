// ============================================================
//  studio/destinations.js — what a good photo of each destination
//  shows: specific search phrases (iconic, bright views; no mosques or minarets)
//  and scene descriptions for AI images. Each destination has its own
//  phrases; no generic phrase is shared between destinations (shared
//  phrases returned the same photo for different places).
// ============================================================

// Keys: airport code, or lower-case place name (offers without a code).
const D = {
  EBL: { q: ['Erbil citadel', 'Erbil Shanadar park', 'Erbil Qaysari bazaar', 'Erbil city skyline'], ai: ['the ancient Erbil Citadel on its mound at golden hour, seen from the square below', 'Shanadar Park in Erbil with green lawns and fountains in soft morning light'] },
  ISU: { q: ['Sulaymaniyah Azmar mountain', 'Sulaymaniyah city view', 'Sulaymaniyah park', 'Goizha mountain'], ai: ['a panoramic view over Sulaymaniyah with the Azmar and Goizha mountains at sunset', 'a green park in Sulaymaniyah with mountains in the background on a clear spring day'] },
  BGW: { q: ['Baghdad Tigris river bridge', 'Baghdad Al-Shaheed monument', 'Baghdad Mutanabbi street'], ai: ['the Tigris river in Baghdad at golden hour with a modern bridge', 'the Al-Shaheed Monument in Baghdad, its turquoise split dome under a clear blue sky'] },
  duhok: { q: ['Duhok dam lake', 'Duhok city mountains', 'Duhok Kurdistan valley'], ai: ['the Duhok dam lake surrounded by mountains on a bright day', 'Duhok city nestled in a green valley between mountains at golden hour'] },
  dohuk: { alias: 'duhok' },
  zakho: { q: ['Zakho Delal bridge', 'Zakho Khabur river'], ai: ['the ancient stone Delal Bridge in Zakho over the clear Khabur river on a sunny day'] },
  IST: { q: ['Istanbul Bosphorus bridge', 'Galata tower', 'Istanbul waterfront Ortakoy', 'Istanbul Maiden tower'], ai: ['the Bosphorus with its suspension bridge and passing ferries at golden hour', 'the Galata Tower above the rooftops of Istanbul on a clear evening'] },
  AYT: { q: ['Antalya Kaleici harbour', 'Antalya Duden waterfall', 'Konyaalti beach', 'Antalya cliffs sea'], ai: ['the old harbour of Kaleiçi in Antalya with yachts and turquoise water', 'the Düden waterfall falling into the turquoise Mediterranean near Antalya'] },
  PMI: { q: ['Mallorca Caló des Moro', 'Mallorca Cap de Formentor', 'Palma marina', 'Mallorca turquoise cove'], ai: ['a hidden turquoise cove in Mallorca framed by pine trees and limestone cliffs', 'the cliffs of Cap de Formentor in Mallorca above a deep blue sea'] },
  DXB: { q: ['Burj Khalifa skyline', 'Dubai marina yachts', 'Dubai Burj Al Arab beach', 'Dubai desert dunes'], ai: ['the Burj Khalifa and the Dubai skyline at blue hour reflected in the fountain lake', 'the Burj Al Arab seen from a white sand beach with turquoise water'] },
  LON: { q: ['London Tower Bridge', 'London Big Ben Westminster', 'London Thames skyline', 'London red bus'], ai: ['Tower Bridge over the Thames on a bright morning with a clear sky', 'Westminster and Big Ben seen across the Thames at golden hour'] },
  BCN: { q: ['Barcelona Park Guell', 'Barcelona Barceloneta beach', 'Barcelona Casa Batllo', 'Barcelona Bunkers del Carmel view'], ai: ['the colourful mosaic terrace of Park Güell overlooking Barcelona and the sea', 'Barceloneta beach and the Barcelona skyline on a sunny day'] },
  ROM: { q: ['Rome Colosseum', 'Rome Trevi fountain', 'Rome Roman Forum', 'Rome Piazza Navona'], ai: ['the Colosseum in Rome at golden hour under a clear sky', 'the Trevi Fountain in Rome in soft morning light without crowds'] },
  FCO: { alias: 'ROM' },
  HER: { q: ['Crete Balos lagoon', 'Heraklion Venetian harbour', 'Crete Elafonissi beach', 'Knossos palace'], ai: ['the turquoise Balos lagoon on Crete seen from above', 'the Venetian fortress of Heraklion harbour on Crete at sunset'] },
  PAR: { q: ['Paris Eiffel tower', 'Paris Seine bridge', 'Paris Arc de Triomphe', 'Paris Louvre pyramid'], ai: ['the Eiffel Tower seen from the Trocadéro gardens at golden hour', 'a Seine bridge in Paris with Haussmann buildings in soft morning light'] },
  AMS: { q: ['Amsterdam canal houses', 'Amsterdam canal bridge bikes', 'Amsterdam Rijksmuseum', 'Keukenhof tulips'], ai: ['classic Amsterdam canal houses reflected in a calm canal on a sunny day', 'a canal bridge in Amsterdam with bicycles and flowers in spring'] },
  TBS: { q: ['Tbilisi old town balconies', 'Tbilisi Narikala fortress view', 'Tbilisi Peace bridge', 'Kazbegi mountains'], ai: ['the colourful wooden balconies of Tbilisi old town above the Mtkvari river', 'a panoramic view over Tbilisi from the Narikala fortress at golden hour'] },
  CAI: { q: ['Giza pyramids', 'Giza sphinx', 'Cairo Nile skyline', 'Nile felucca'], ai: ['the Pyramids of Giza in warm afternoon light under a clear blue sky', 'a white felucca sailing on the Nile in Cairo at sunset'] },
  BKK: { q: ['Bangkok skyline river', 'Bangkok Chao Phraya', 'Thailand Phi Phi beach', 'Bangkok rooftop'], ai: ['the Chao Phraya river and Bangkok skyline at blue hour', 'a long-tail boat on turquoise water near limestone cliffs in Thailand'] },
  VIE: { q: ['Vienna Schonbrunn palace', 'Vienna Belvedere palace', 'Vienna Ringstrasse', 'Vienna Prater wheel'], ai: ['Schönbrunn Palace and its gardens in Vienna on a sunny day', 'the Upper Belvedere palace in Vienna reflected in its pond'] },
  LCA: { q: ['Larnaca Finikoudes promenade', 'Cyprus Ayia Napa beach', 'Larnaca salt lake flamingos', 'Cyprus turquoise sea'], ai: ['the palm-lined Finikoudes promenade in Larnaca by the sea', 'a turquoise bay with white sand in Cyprus on a sunny day'] },
  HRG: { q: ['Hurghada red sea beach', 'Hurghada coral reef', 'Hurghada marina'], ai: ['a Red Sea beach in Hurghada with crystal clear turquoise water'] },
  ATH: { q: ['Athens Acropolis Parthenon', 'Athens Plaka old town', 'Athens Lycabettus hill view', 'Athens Riviera Vouliagmeni', 'Athens city panorama'], ai: ['a panoramic view over Athens from Lycabettus hill at golden hour'] },
  SOF: { q: ['Sofia Alexander Nevsky Cathedral', 'Sofia Vitosha mountain', 'Sofia Vitosha boulevard', 'Sofia city panorama', 'Sofia National Palace of Culture'], ai: ['Sofia city with Vitosha mountain behind on a clear day'] },
  LIS: { q: ['Lisbon tram 28', 'Lisbon Belem tower', 'Lisbon viewpoint Alfama'], ai: ['a yellow tram climbing a narrow street in Lisbon on a sunny day'] },
  side: { q: ['Side Turkey Apollo temple ruins sea', 'Side Turkey beach', 'Side harbour Turkey'], ai: ['a long sandy beach at Side on the Turkish Riviera with calm turquoise water'] },
  alanya: { q: ['Alanya castle peninsula', 'Alanya Cleopatra beach', 'Alanya red tower'], ai: ['the Alanya peninsula with its castle walls above Cleopatra beach'] },
  manavgat: { q: ['Manavgat waterfall', 'Manavgat river boat', 'Manavgat beach'], ai: ['the Manavgat river meeting the sea with boats on a sunny day'] },
  tosmur: { alias: 'alanya' },
  beldibi: { q: ['Beldibi beach mountains', 'Kemer coast mountains', 'Antalya Kemer bay'], ai: ['a pebble beach at Beldibi with the Taurus mountains behind'] },
  'sharm el-sheikh': { q: ['Sharm el Sheikh beach', 'Sharm el Sheikh coral reef', 'Ras Mohammed'], ai: ['a turquoise Red Sea bay in Sharm el-Sheikh with a coral reef'] },
  hurghada: { alias: 'HRG' },
  qawra: { q: ['Malta Qawra bay', 'Malta Blue Lagoon Comino', 'Malta Valletta harbour'], ai: ['the Blue Lagoon of Comino in Malta with crystal clear water'] },
  'lloret de mar': { q: ['Lloret de Mar beach', 'Costa Brava cove', 'Lloret de Mar castle'], ai: ['the golden beach of Lloret de Mar on the Costa Brava with a small castle on the cliffs'] },
};

// Flights home to Iraq/Kurdistan (client decision 2026-11-04): most offers go to the same city
// (Erbil) from many German airports, so the photo shows the DEPARTURE city instead; expats see
// their own city and every slide of a multi-city post looks different.
const HOME = new Set(['EBL', 'ISU', 'BGW', 'BSR', 'NJF', 'OSM', 'KIK']);
const GERMAN = {
  DUS: ['the Rheinturm and the Media Harbour in Düsseldorf at golden hour, seen across the Rhine', 'the Rhine promenade of Düsseldorf old town with the Rheinturm in the distance on a clear evening'],
  CGN: ['Cologne Cathedral and the Hohenzollern Bridge over the Rhine at golden hour', 'the colourful old town houses on the Rhine bank in Cologne on a clear evening'],
  FRA: ['the Frankfurt skyline over the Main river at blue hour, seen from a bridge', 'the Römerberg square in Frankfurt with its half-timbered houses on a bright morning'],
  MUC: ['the Munich skyline with the Frauenkirche towers and the Alps far behind on a clear day', 'Marienplatz in Munich with the New Town Hall in warm late-afternoon light'],
  STR: ['the Schlossplatz in Stuttgart with the New Palace and fountains on a sunny evening', 'a view over Stuttgart city between green vineyard hills at golden hour'],
  HAM: ['the Elbphilharmonie and the Hamburg harbour at golden hour seen across the water', 'the Speicherstadt brick warehouses in Hamburg reflected in the canals at blue hour'],
  HAJ: ['the New Town Hall of Hanover reflected in the Maschteich lake on a clear evening', 'the Herrenhausen Gardens in Hanover with fountains and hedges in soft sunlight'],
  BER: ['the Brandenburg Gate in Berlin at golden hour under a clear sky', 'the Berlin Cathedral and the Spree river at blue hour'],
  NUE: ['the old town of Nuremberg with the castle above the rooftops at golden hour'],
  LEJ: ['the Augustusplatz in Leipzig with the Gewandhaus and the City-Hochhaus on a clear evening'],
  BRE: ['the market square of Bremen with the town hall and the Roland statue in warm light'],
  DTM: ['the Phoenix lake in Dortmund with the city skyline at golden hour'],
};

/** What the photo of a flight should show: the departure city for flights home, else the destination. */
function photoSubject(offer) {
  const from = offer && offer.from;
  if (!(offer && offer.to && HOME.has(offer.to.code) && from && (from.code || from.name))) return offer;
  return { kind: 'flight', to: { code: from.code || '', name: from.name }, country: 'Germany', ai: GERMAN[from.code] || null };
}

/** Entry for an offer's destination: by airport code, then by place name; aliases resolved. */
function find(offer) {
  if (offer && offer.ai) return { ai: offer.ai }; // departure-city subject (photoSubject)
  const name = String((offer.to && offer.to.name) || '').trim().toLowerCase();
  let e = D[offer.to && offer.to.code] || D[name] || D[name.split(/[ ,(]/)[0]];
  for (let i = 0; e && e.alias && i < 3; i++) e = D[e.alias];
  return e || null;
}

module.exports = { find, photoSubject, HOME };
