# Studio memory (marketing studio, `studio/` only)

Decisions and state of the marketing studio. The rest of Carousel is documented in
`PROJECT-MEMORY.md` (not edited from the studio work).

## Languages
- Posts are written in German (`de`), Arabic (`ar`) and Kurdish **Kurmanji in Latin letters**
  (`kmr`, client decision 2026-10-20; was Badini in Arabic script, `ckb`). Kurmanji is
  left-to-right; city names match the website (Hewlêr, Silêmanî, Bexda, Stenbol …).
- Old drafts saved with `ckb` are migrated to `kmr` when loaded (`store.js`).
- The script title font is used for German only (not verified for ê, î, ş).

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

## Next
- "Magazin" slide template for ideas (approved mock: cover with photo + serif title, story
  slide, closing slide with slogan and logo). Client changes: darker title area on the cover;
  slide 2 photo only lightly blurred.
- Then: ideas as articles on the website ("Reise-Magazin"); Kurmanji template texts reviewed by a
  native speaker.

## Incidents
- 2026-10-20: commit bec494d broke logo and photo position on offer slides (a comment swallowed
  two settings in `render.js`); fixed in 5ae7ed8. Offer posts made in between should be regenerated.
