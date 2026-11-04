# Studio memory (marketing studio, `studio/` only)

Decisions and state of the marketing studio. The rest of Carousel is documented in
`PROJECT-MEMORY.md` (not edited from the studio work).

## Languages
- Posts are written in German (`de`), Arabic (`ar`) and Kurdish **Badini in Arabic script**
  (`ckb`, right-to-left). Client decision 2026-10-30, for offers and ideas alike: the switch to
  Kurmanji in Latin letters (`kmr`, 2026-10-20) was reverted; the audience (Badini Kurds) and
  the competitor both use Arabic script.
- Offer drafts saved with `kmr` are migrated to `ckb` when loaded (`store.js`). Old ideas with
  `kmr` texts stay as they are.
- Badini template words (Magazin labels, "چوون و هاتن") still need a native speaker's review.
- The script title font is used for German only.

## Offer posts for WhatsApp status / stories (decisions 2026-10-30)
- Strategy: online target 10-20 bookings a month within 6 months; Google Ads for flights first,
  then Meta ads for packages. WhatsApp status is the strongest channel today.
- Template "◻ Schlicht" (`templates/flight-simple.html`), modelled on the competitor's stories
  but different on purpose: full-screen 9:16, navy price plate with a gold underline
  ("189 EUR", same order in every language), one route line, "round trip" tag only for round
  trips, logo + slogan at the bottom. No dates, no frame, no glass card. Rejected on the way:
  round gold seal, framed trip tag, bookmark ribbon.
- AI photos (`image.js`): realistic poster photos with open sky in the top 35 % and a calm
  bottom; one real viewpoint (no landmark collages); generate the DESTINATION only, never the
  product (no invented hotel, room, pool, ship interior, house, no aircraft). Real photos stay
  allowed; approved photos go to the library and are reused.
- Bundle posts are generated in the background; the page polls `/drafts/bundle/status`
  (a 6-offer bundle took longer than the Nginx timeout of 180 s -> 504).

## "Ideen des Tages" (news-ideas.js, editorial.js, news-photos.js)
- Client rules: joyful only; no food, restaurants or drinks; no mosques or minarets (temples and
  churches are allowed); no sales talk, prices or links; nothing is published automatically.
- Single source: Wikivoyage (CC BY-SA 4.0, always credited). Place posts read only the See/Do
  sections and describe ONE experience a traveller can have (what, where, when, why worth it);
  trivia (plants, name origins, geology, statistics) is rejected (editor score < 7).
- The post must quote a sentence of the article ("evidence", 85 % word match), so nothing is
  invented. Dated events only when they start in 2–10 weeks.
- Style approved with examples (Lauterbrunnen waterfall, Bled wishing bell): a friend who has just
  been there, "du" / second person, curiosity hook, one sensory moment, one practical detail,
  short closing line, one emoji. Never "Stell dir vor".
- Mix: two place posts a day (mostly Europe: German cities, lakes, mountains, coasts, islands,
  villages, capitals; some Kurdistan/UAE; a little rest of world) and on about 3 of 5 days a
  Ratgeber post (flights, hotels, river cruises, packing, insurance, passenger rights, jet lag,
  "before travelling to …").
- History of rejected approaches: news feeds (weak, dry, US-heavy, accidents), Google-grounded
  research (source reliability), trivia angles. Do not go back to them.
- Photos: per idea, search Wikimedia Commons, Pexels and Unsplash, ranked with the client's four
  photo rules plus "exactly this place and experience"; the client picks one of six. Never
  AI-generated photos of real places, never photos taken from articles.
- Preview without saving: `docker exec media-carousel-app node studio/editorial-preview.js 6`.
- Wikivoyage API: one request about every 1.1 s, retry on 429, contact User-Agent.

## Purpose of the studio (agreed 2026-11-04)
Part of the sales strategy (website repo, `docs/PROJECT_MEMORY.md`, section 11b). The studio
turns today's offers into ready story posts for WhatsApp status/Channel and a short video for
TikTok, so the client posts daily and more customers write on WhatsApp. Every change must make
that flow faster, better or cheaper. Rules: Badini first; one 9:16 format; no airline names
(the visitor should message us); today's prices are typed in by the client each morning (the
airline agent portal is never connected); a tracking word per post; AI photo library reused
before generating. To do first: Gemini 2.5 Flash -> 3.5 Flash-Lite before 2026-12-01
(`thinkingBudget` -> `thinkingLevel`, drop `temperature`), then fix errors and freeze what does
not serve the purpose. `src/extract-offer.js` (outside `studio/`) also uses 2.5 Flash: client
decision needed.

## State after 2026-11-02
- AI photos first in every post (bundles: cover, closing slide and every offer; single posts:
  three photos); real photos only as fallback or on request. Closing slide has its own AI photo.
- Bundle dialog: kind -> template -> offers -> start. Format setting for the whole studio:
  "Story / Status" (default) or "Story + Feed".
- Posts show the city, not the airport (CGN -> Köln, HER -> Kreta).
- Client verdict 2026-11-02: the studio still has **many errors**; next agreed topic is a full
  design review of the studio (and the design in general) before more features.
- Known open points: AI photos do not always keep the layout (towers into the sky band,
  occasional seams); square crop is the weakest size; Badini template words need a native
  speaker; build context large (no .dockerignore); port 3010 published on 0.0.0.0 (check).

## Next
- "Magazin" slide template for ideas (approved mock: cover with photo + serif title, story
  slide, closing slide with slogan and logo). Client changes: darker title area on the cover;
  slide 2 photo only lightly blurred.
- Then: ideas as articles on the website ("Reise-Magazin"); Kurmanji template texts reviewed by a
  native speaker.

## Incidents
- 2026-10-20: commit bec494d broke logo and photo position on offer slides (a comment swallowed
  two settings in `render.js`); fixed in 5ae7ed8. Offer posts made in between should be regenerated.
