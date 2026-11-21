// ============================================================
//  studio/subjects.js — REAL places per photo subject, per city
//  (client decision 2026-11-21): the AI only gets places that really
//  exist, so it never invents a castle or a bridge. A subject a city
//  does not have is simply missing; that city never gets it.
//  Keys: airport code, or lower-case place name. Subjects: see SHOTS
//  in image.js. Rule: no mosques or minarets.
// ============================================================

const S = {
  // ---- Departure cities (Germany and around) ----
  DUS: {
    landmark: 'the Rheinturm TV tower in Düsseldorf seen from close below at the Media Harbour',
    water: 'the Media Harbour (Medienhafen) in Düsseldorf: the marina with the curved Gehry buildings reflected in the water',
    castle: 'Benrath Palace in Düsseldorf, the pink baroque palace seen across its pond',
    nature: 'the Hofgarten park in Düsseldorf with its old trees, lawns and pond',
    bridge: 'the Rheinkniebrücke cable-stayed bridge over the Rhine in Düsseldorf',
    promenade: 'the Rhine riverside promenade (Rheinuferpromenade) of Düsseldorf old town with strolling people far away',
    museum: 'the curved black granite facade of the K20 art museum on Grabbeplatz in Düsseldorf',
  },
  CGN: {
    landmark: 'the Gothic twin towers of Cologne Cathedral seen up close from the square',
    water: 'the Rheinauhafen in Cologne: the three crane houses (Kranhäuser) on the Rhine',
    castle: 'Augustusburg Palace in Brühl near Cologne with its baroque garden',
    nature: 'the Rheinpark in Cologne with green lawns along the Rhine',
    bridge: 'the Hohenzollern Bridge in Cologne with its steel arches over the Rhine and the cathedral behind',
    promenade: 'the Rhine promenade of Cologne old town with its colourful narrow houses',
    museum: 'the Chocolate Museum on its peninsula at the Rheinauhafen in Cologne',
  },
  FRA: {
    landmark: 'the half-timbered Römer houses on the Römerberg square in Frankfurt',
    water: 'the Main river in Frankfurt with the skyscraper skyline reflected in it',
    nature: 'the Palmengarten botanical garden in Frankfurt with its lawns and palm house',
    bridge: 'the Eiserner Steg iron footbridge over the Main in Frankfurt',
    promenade: 'the Museumsufer riverside promenade along the Main in Frankfurt with strolling people far away',
    museum: 'the Städel Museum in Frankfurt, its historic facade seen from its forecourt',
  },
  MUC: {
    landmark: 'the Gothic New Town Hall on Marienplatz in Munich seen up close from the square',
    water: 'the Isar river in Munich with its clear water and gravel banks',
    castle: 'Nymphenburg Palace in Munich seen along its long canal with swans',
    nature: 'the English Garden in Munich with the round Monopteros temple on its hill',
    bridge: 'the Maximiliansbrücke over the Isar in Munich with the Maximilianeum behind',
    heights: 'the view from the green Olympiaberg hill in the Olympic Park of Munich over the tent roofs and the Olympic Tower',
    museum: 'the Propylaea gate and the Glyptothek on Königsplatz in Munich',
  },
  STR: {
    landmark: 'the New Palace on the Schlossplatz in Stuttgart with its fountains',
    water: 'the Max-Eyth-See lake in Stuttgart with the Neckar vineyards behind',
    castle: 'Ludwigsburg Residential Palace near Stuttgart with its baroque gardens',
    nature: 'the Killesberg park in Stuttgart with its lakes and flower beds',
    heights: 'the vineyards on the Württemberg hill above Stuttgart, rows of vines in the foreground and the Neckar valley below',
    museum: 'the futuristic Mercedes-Benz Museum building in Stuttgart',
  },
  HAM: {
    landmark: 'the Elbphilharmonie in Hamburg seen up close from the water',
    water: 'the port of Hamburg at the Landungsbrücken with harbour ferries and ships',
    nature: 'the Planten un Blomen park in Hamburg with its lake and gardens',
    bridge: 'a canal bridge in the brick Speicherstadt warehouse district of Hamburg',
    promenade: 'the Elbstrand sandy beach at Övelgönne in Hamburg with ships passing on the Elbe',
    museum: 'the Hamburger Kunsthalle art museum building in Hamburg',
  },
  HAJ: {
    landmark: 'the New Town Hall of Hanover with its dome seen across the Maschteich pond',
    water: 'the Maschsee lake in Hanover with sailing boats',
    castle: 'Marienburg Castle near Hanover, the neo-Gothic castle on its hill',
    nature: 'the Great Garden of the Herrenhausen Gardens in Hanover with its fountains and hedges',
    promenade: 'the lakeside promenade along the Maschsee in Hanover with strolling people far away',
    museum: 'the Lower Saxony State Museum (Landesmuseum) in Hanover seen from the Maschpark',
  },
  BER: {
    landmark: 'the Brandenburg Gate in Berlin seen up close from Pariser Platz',
    water: 'the Spree river at Museum Island in Berlin with a tour boat',
    castle: 'Charlottenburg Palace in Berlin with its baroque garden',
    nature: 'the Tiergarten park in Berlin with its lake and old trees',
    bridge: 'the red-brick Oberbaum Bridge over the Spree in Berlin',
    museum: 'the Bode Museum at the tip of Museum Island in Berlin',
  },
  NUE: {
    landmark: 'the Schöner Brunnen golden fountain on the main market of Nuremberg',
    water: 'the Pegnitz river in Nuremberg old town with the half-timbered Weinstadel',
    castle: 'the Kaiserburg imperial castle of Nuremberg seen whole from below',
    bridge: 'the wooden Henkersteg covered footbridge over the Pegnitz in Nuremberg',
    museum: 'the Germanisches Nationalmuseum in Nuremberg with its Way of Human Rights columns',
  },
  LEJ: {
    landmark: 'the Völkerschlachtdenkmal monument in Leipzig seen across its reflecting pool',
    water: 'the Karl-Heine canal in Leipzig with old brick factories and boats',
    nature: 'the Clara-Zetkin-Park in Leipzig with its lawns and old trees',
    promenade: 'the sandy beach of the Cospudener See lake near Leipzig',
    museum: 'the glass cube of the Museum of Fine Arts in Leipzig',
  },
  BRE: {
    landmark: 'the Gothic town hall and the Roland statue on the market square in Bremen',
    water: 'the Weser river in Bremen with the historic ship moored at the Schlachte',
    nature: 'the Bürgerpark in Bremen with its lake and old trees',
    promenade: 'the Schlachte riverside promenade on the Weser in Bremen',
    museum: 'the Universum Science Center in Bremen, its silver whale-shaped building',
  },
  DTM: {
    landmark: 'the U-Tower in Dortmund with its golden U on top, seen from the street',
    water: 'the Phoenix-See lake in Dortmund with its harbour promenade',
    nature: 'the Westfalenpark in Dortmund with its flower gardens',
    museum: 'the German Football Museum building in Dortmund',
  },
  AMS: {
    landmark: 'classic gabled canal houses along the Herengracht in Amsterdam',
    water: 'an Amsterdam canal with a canal tour boat and houseboats',
    nature: 'the Vondelpark in Amsterdam with its pond and old trees',
    bridge: 'the white Magere Brug drawbridge over the Amstel in Amsterdam',
    museum: 'the Rijksmuseum in Amsterdam seen from the Museumplein with its pond',
  },
  // ---- Destinations (Iraq and Kurdistan) ----
  EBL: {
    landmark: 'the massive ancient walls of the Erbil Citadel seen up close from the square below',
    castle: 'the main gate of the Erbil Citadel with the fountains of the square in front of it',
    nature: 'the Sami Abdulrahman Park in Erbil with its lake, lawns and trees',
    water: 'the lake in the Sami Abdulrahman Park in Erbil with the city behind',
  },
  ISU: {
    landmark: 'the historic Qaysari bazaar arches in Sulaymaniyah',
    nature: 'the Azmar mountain ridge above green hills near Sulaymaniyah',
    heights: 'the view from Goizha mountain over the city of Sulaymaniyah, rocky ground in the foreground',
    water: 'the Dukan lake near Sulaymaniyah with mountains around it',
  },
  BGW: {
    landmark: 'the Al-Shaheed Monument in Baghdad, its turquoise split dome',
    water: 'the Tigris river in Baghdad at its widest, palm trees along the bank',
    castle: 'the Abbasid Palace in Baghdad, its brick arches and courtyard',
    bridge: 'a suspension bridge over the Tigris in Baghdad',
    promenade: 'Abu Nuwas riverside street and park along the Tigris in Baghdad',
  },
  duhok: {
    water: 'the Duhok dam lake surrounded by mountains',
    nature: 'the Zawita pine forest near Duhok',
    heights: 'the mountains above Duhok with the city in the valley below',
  },
};
S.dohuk = S.duhok;

/** Real places of a city by subject, or null when the city has no list yet. */
function of(place) {
  if (!place) return null;
  const name = String(place.name || '').trim().toLowerCase();
  return S[place.code] || S[name] || S[name.split(/[ ,(]/)[0]] || null;
}

module.exports = { of, S };
