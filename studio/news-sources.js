// ============================================================
//  NOTE: since the editorial engine (editorial.js) the daily ideas no
//  longer use these feeds; EXCLUDE and SAD are still shared filters.
//  studio/news-sources.js — free travel sources for the daily
//  "Ideen des Tages" (client list, checked from the Codespace):
//  magazines and cruises (RSS/Atom), Wikivoyage (CC BY-SA),
//  UNESCO, school holidays, public holidays, weather and the German
//  Foreign Office. Only plain text facts are taken (title, short
//  summary, link); nothing from a source is rendered as HTML.
//  Turkey is treated like every other destination: no Turkey-only
//  news sources (client decision).
// ============================================================

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20000;

// cat: inspiration | cruise | practical | season (no food: client decision, not a cooking site)
const FEEDS = [
  { id: 'cntraveler', name: 'Condé Nast Traveler', url: 'https://www.cntraveler.com/feed/rss', cat: 'inspiration' },
  { id: 'cnn', name: 'CNN Travel', url: 'http://rss.cnn.com/rss/edition_travel.rss', cat: 'inspiration' },
  { id: 'reisereporter', name: 'reisereporter', url: 'https://www.reisereporter.de/arc/outboundfeeds/rss/', cat: 'inspiration' },
  { id: 'thenational', name: 'The National', url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/category/travel/?outputType=xml', cat: 'inspiration' },
  { id: 'unesco', name: 'UNESCO World Heritage', url: 'https://whc.unesco.org/en/news/rss/', cat: 'inspiration' },
  { id: 'cruisehive', name: 'CruiseHive', url: 'https://www.cruisehive.com/feed', cat: 'cruise' },
  { id: 'kreuzfahrtpiraten', name: 'Kreuzfahrtpiraten', url: 'https://www.kreuzfahrtpiraten.de/feed/', cat: 'cruise' },
  { id: 'cruisetricks', name: 'Cruisetricks', url: 'https://www.cruisetricks.de/feed/', cat: 'cruise' },
];

// Evergreen places (Wikivoyage): our destinations, incl. Kurdistan (no Kurdish news feed exists).
const PLACES = [
  ['Erbil', 'en'], ['Duhok', 'en'], ['Sulaymaniyah', 'en'], ['Dukan', 'en'], ['Amedi', 'en'], ['Zakho', 'en'],
  ['Antalya', 'de'], ['Mallorca', 'de'], ['Kreta', 'de'], ['Zypern', 'de'], ['Dubai', 'de'], ['Hurghada', 'de'],
  ['Scharm asch-Schaich', 'de'], ['Algarve', 'de'], ['Rhodos', 'de'], ['Teneriffa', 'de'], ['Sizilien', 'de'],
  ['Kroatien', 'de'], ['Agadir', 'de'], ['Tiflis', 'de'], ['Larnaka', 'de'], ['Barcelona', 'de'], ['Wien', 'de'],
];

// Weather pairs: destination vs. Germany (Berlin) for "while it is X here, it is Y there".
const WEATHER = [
  ['Antalya', 36.89, 30.71], ['Mallorca', 39.57, 2.65], ['Dubai', 25.2, 55.27], ['Hurghada', 27.26, 33.81],
  ['Erbil', 36.19, 44.01], ['Teneriffa', 28.29, -16.63], ['Larnaka', 34.92, 33.63], ['Kreta', 35.34, 25.13],
];
const BERLIN = [52.52, 13.41];

// Countries whose Foreign Office notes matter for our customers (ISO codes).
const AA_COUNTRIES = new Set(['IQ', 'TR', 'EG', 'AE', 'ES', 'GR', 'CY', 'PT', 'HR', 'BG', 'IT', 'MA', 'TN', 'GE', 'JO', 'LB', 'TH', 'AL', 'RO']);
// States with most of our customers (school holidays).
const STATES = { NW: 'Nordrhein-Westfalen', NI: 'Niedersachsen', HE: 'Hessen', BY: 'Bayern', BW: 'Baden-Württemberg', BE: 'Berlin', HH: 'Hamburg' };

// Client rules: no mosques/minarets; posts stay positive (no disasters or politics); no food,
// restaurant or recipe topics (destinations, unusual places, activities and festivals only).
const EXCLUDE = /moschee|minarett|mosque|minaret|مسجد|جامع|مئذنة|مزگەوت|krieg|\bwar\b|anschlag|terror|attack|killed|absturz|crash|shooting|erdbeben|earthquake|\bwahl\b|wahlen\b|election|trump|putin|restaurant|rezept|recipe|kochen|cooking|küche|cuisine|\bchef\b|\bkoch\b|\bessen\b|\beat\b|eating|\bfood|\bdish(es)?\b|\bgerichte?\b|menü|menu|michelin|bakery|bäckerei|café|coffee|kaffee|\bwein\b|\bwine|cocktail|\bbars?\b|\bspeisen\b|getränk|\bbier\b|\bbeer\b|\bdrinks?\b|\bschmaus|kulinar|culinar|gastronom|مطعم|مطاعم|طبخ|أكل|مأكولات|وصفة|طعام|بيرة|شراب|مشروب|خواردن|خوارن|چێشت|ڤەخوارن/i;

// Client rule: only happy, joyful news. Anything about incidents, danger, illness, crime, delays,
// disputes or losses is dropped before the model sees it (and checked again in the written text).
const SAD = /unfall|accident|incident|vorfall|rettung|gerettet|rescue|rescued|evakuier|evacuat|sturm|stürm|storm|unwetter|hurricane|hurrikan|typhoon|taifun|flood|flut|überschwemm|hochwasser|waldbrand|wildfire|\bfire\b|\bbrand\b|\bexplosion|schiffsunglück|shipwreck|\buntergang\b|kentern|capsiz|ertrunk|drown|\bdead\b|death|died|\btod\b|gestorben|starb|verstorb|leiche|body found|\btot\b|verletz|injur|krank|illness|outbreak|ausbruch|virus|norovirus|covid|pandemi|seuche|verhaftet|arrest|festgenommen|polizei|police|crime|verbrechen|diebstahl|theft|stolen|gestohlen|raub|robbery|betrug|fraud|scam|lawsuit|klage|gericht|court|verklagt|sued|strafe|bußgeld|\bban\b|verbot|streik|strike|protest|demonstration|demonstrant|kundgebung|chaos|delay|verspät|cancel|annull|storniert|gestrichen|ausfall|warnung|warning|alarm|gefahr|danger|bedroh|threat|überboo|overbook|overtour|overcrowd|missing|vermisst|verschwunden|lost at sea|over ?board|über bord|notfall|emergency|notlandung|turbulen|lärm|beschwerde|complaint|pleite|insolven|bankrupt|layoff|entlass|schließt|closes|closure|geschlossen|حادث|إنقاذ|غرق|عاصفة|وفاة|موت|قتل|مرض|اعتقال|سرقة|إضراب|تأخير|إلغاء|تحذير|خطر|حريق|فيضان|ڕووداو|مەرگ|کوشتن|نەخۆشی|مانگرتن|هۆشداری|ئاگر|لافاو/i;

const ALLOWED_HOSTS = new Set([...FEEDS.map((f) => new URL(f.url).host), 'en.wikivoyage.org', 'de.wikivoyage.org',
  'ferien-api.de', 'date.nager.at', 'api.open-meteo.com', 'www.auswaertiges-amt.de']);

/** GET a listed host only, with timeout and size limit; returns text. */
async function fetchText(url, fetchImpl = fetch) {
  const u = new URL(url);
  if (!ALLOWED_HOSTS.has(u.host)) throw new Error('host not allowed');
  const res = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (MEDIA Studio)' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('too large');
  return text;
}
const fetchJson = async (url, fetchImpl) => JSON.parse(await fetchText(url, fetchImpl));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Plain text: CDATA, tags and entities removed, whitespace collapsed. */
function plain(s, max = 400) {
  const t = String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 31 ? String.fromCodePoint(n) : ' '; }
      return ENTITIES[e.toLowerCase()] ?? ' ';
    }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s\S*$/, '') + '…' : t;
}
const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? m[1] : ''; };
const safeLink = (s) => { try { const u = new URL(plain(s, 500)); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; } };

/** RSS 2.0 / Atom → [{ title, summary, link, date }] (max 30). */
function parseFeed(xml) {
  const blocks = String(xml).match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 30).map((b) => {
    const atomLink = /<link[^>]*href="([^"]+)"/i.exec(b);
    const date = Date.parse(plain(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date'), 60));
    return {
      title: plain(tag(b, 'title'), 160),
      summary: plain(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'), 400),
      link: safeLink(tag(b, 'link') || (atomLink && atomLink[1])),
      date: Number.isFinite(date) ? new Date(date).toISOString() : null,
    };
  }).filter((i) => i.title && i.link);
}

const idOf = (s) => require('crypto').createHash('sha1').update(s).digest('hex').slice(0, 12);
const fact = (o) => ({ id: idOf(o.key || o.link || o.title), ...o });
const fresh = (iso, days) => !iso || Date.now() - Date.parse(iso) < days * 86400000;

async function feedFacts(fetchImpl, log) {
  const out = [];
  await Promise.all(FEEDS.map(async (f) => {
    try {
      for (const i of parseFeed(await fetchText(f.url, fetchImpl))) {
        if (!fresh(i.date, 10) || EXCLUDE.test(`${i.title} ${i.summary}`) || SAD.test(`${i.title} ${i.summary}`)) continue;
        out.push(fact({ cat: f.cat, source: f.name, sourceId: f.id, title: i.title, summary: i.summary, link: i.link, date: i.date }));
      }
    } catch (err) { log(`news ${f.id}: ${err.message}`); }
  }));
  return out;
}

/** One random Wikivoyage place: a paragraph about sights, nature or activities (CC BY-SA 4.0). */
async function placeFacts(fetchImpl, log, rnd = Math.random) {
  const out = [];
  const pool = [...PLACES].sort(() => rnd() - 0.5).slice(0, 3);
  for (const [title, lang] of pool) {
    try {
      const url = `https://${lang}.wikivoyage.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
      const page = Object.values((await fetchJson(url, fetchImpl)).query?.pages || {})[0];
      const paras = String(page?.extract || '').split(/\n+/).map((p) => p.trim())
        .filter((p) => p.length >= 160 && p.length <= 900 && !/^=/.test(p) && !EXCLUDE.test(p) && !SAD.test(p));
      if (!paras.length) continue;
      const p = paras[Math.floor(rnd() * paras.length)];
      const link = `https://${lang}.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
      out.push(fact({ key: `wv:${title}:${idOf(p)}`, cat: 'place', source: 'Wikivoyage (CC BY-SA 4.0)', sourceId: 'wikivoyage', place: title, title: page.title, summary: plain(p, 600), link }));
    } catch (err) { log(`news wikivoyage ${title}: ${err.message}`); }
  }
  return out;
}

/** School holidays (next 10–28 days) and public holidays in Germany and Iraq (next 7–30 days). */
async function seasonFacts(fetchImpl, log, now = new Date()) {
  const out = [];
  const inDays = (iso) => Math.round((Date.parse(iso) - now.getTime()) / 86400000);
  const year = now.getFullYear();
  await Promise.all(Object.entries(STATES).map(async ([code, name]) => {
    try {
      for (const h of await fetchJson(`https://ferien-api.de/api/v1/holidays/${code}`, fetchImpl)) {
        const d = inDays(h.start);
        if (d >= 10 && d <= 28) out.push(fact({ key: `ferien:${code}:${h.start}`, cat: 'season', source: 'ferien-api.de', sourceId: 'ferien',
          title: `${plain(h.name, 60)} in ${name}`, summary: `${plain(h.name, 60)} in ${name} beginnen am ${h.start.slice(0, 10)} (in ${d} Tagen) und enden am ${String(h.end).slice(0, 10)}.`, link: 'https://ferien-api.de' }));
      }
    } catch (err) { log(`news ferien ${code}: ${err.message}`); }
  }));
  for (const cc of ['DE', 'IQ']) {
    for (const y of [year, year + 1]) {
      try {
        for (const h of await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`, fetchImpl)) {
          const d = inDays(h.date);
          if (d >= 7 && d <= 30 && !EXCLUDE.test(h.name)) out.push(fact({ key: `holiday:${cc}:${h.date}`, cat: 'season', source: 'Nager.Date', sourceId: 'nager',
            title: `${plain(h.name, 80)} (${cc === 'DE' ? 'Deutschland' : 'Irak/Kurdistan'})`, summary: `${plain(h.localName || h.name, 80)} / ${plain(h.name, 80)} am ${h.date} (in ${d} Tagen).`, link: 'https://date.nager.at' }));
        }
      } catch (err) { log(`news holidays ${cc}: ${err.message}`); }
    }
  }
  return out;
}

/** Current temperature at two random destinations vs. Berlin. */
async function weatherFacts(fetchImpl, log, rnd = Math.random) {
  const temp = async (lat, lon) => (await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&forecast_days=1&timezone=auto`, fetchImpl)).daily.temperature_2m_max[0];
  try {
    const home = Math.round(await temp(...BERLIN));
    const out = [];
    for (const [name, lat, lon] of [...WEATHER].sort(() => rnd() - 0.5).slice(0, 2)) {
      const t = Math.round(await temp(lat, lon));
      if (t - home >= 8) out.push(fact({ key: `weather:${name}:${new Date().toISOString().slice(0, 10)}`, cat: 'season', source: 'Open-Meteo', sourceId: 'weather', place: name,
        title: `${t}° in ${name}, ${home}° in Berlin`, summary: `Heute bis ${t} °C in ${name}, in Berlin nur ${home} °C.`, link: 'https://open-meteo.com' }));
    }
    return out;
  } catch (err) { log(`news weather: ${err.message}`); return []; }
}

/** Foreign Office: travel notes of our countries changed in the last 3 days. */
async function practicalFacts(fetchImpl, log) {
  try {
    const data = (await fetchJson('https://www.auswaertiges-amt.de/opendata/travelwarning', fetchImpl)).response || {};
    return Object.values(data).filter((v) => v && typeof v === 'object' && AA_COUNTRIES.has(v.countryCode)).flatMap((v) => {
      const ms = Number(v.lastModified) < 1e12 ? Number(v.lastModified) * 1000 : Number(v.lastModified);
      if (!Number.isFinite(ms) || Date.now() - ms > 3 * 86400000) return [];
      const level = v.warning ? 'Reisewarnung' : v.partialWarning ? 'Teilreisewarnung' : v.situationWarning ? 'Hinweise zur Lage' : 'Reise- und Sicherheitshinweise';
      return [fact({ key: `aa:${v.countryCode}:${ms}`, cat: 'practical', source: 'Auswärtiges Amt', sourceId: 'aa', title: `${plain(v.title, 120)} aktualisiert`,
        summary: `Das Auswärtige Amt hat die ${level} für ${plain(v.countryName || v.title, 60)} am ${new Date(ms).toISOString().slice(0, 10)} aktualisiert.`, link: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise' })];
    });
  } catch (err) { log(`news auswaertiges-amt: ${err.message}`); return []; }
}

/** All facts of today from every source (sources fail independently). */
async function collectFacts(fetchImpl = fetch, log = console.log) {
  // Foreign Office notes (practicalFacts) are not part of the daily ideas: client wants joyful news only.
  const parts = await Promise.all([feedFacts(fetchImpl, log), placeFacts(fetchImpl, log), seasonFacts(fetchImpl, log), weatherFacts(fetchImpl, log)]);
  return parts.flat();
}

module.exports = { FEEDS, PLACES, EXCLUDE, SAD, ALLOWED_HOSTS, fetchText, parseFeed, plain, collectFacts, feedFacts, placeFacts, seasonFacts, weatherFacts, practicalFacts };
