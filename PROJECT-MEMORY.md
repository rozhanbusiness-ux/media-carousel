# media-carousel — Project Memory

> This file is the permanent reference for project state. Read it at the start of any new conversation about this project. Update it at the end of every successful working session, alongside Claude's internal memory.

---

## 1. Project Overview

A semi-automatic social media carousel generator for **MEDIA Travel & Tourism**. Converts raw travel offer data (manual entry, screenshots, or PDF supplier catalogs) into publish-ready branded images, in three sizes (Story 1080x1920, Post/Square 1080x1080, Portrait 1080x1350), with a strictly fixed visual identity.

**Core philosophy:** SEMI-automatic, not fully automatic. The system extracts and generates; the user (Rozhan) always reviews and manually corrects before export. No black-box automation - full manual control over every field and choice.

**Owner / stakeholder:** Rozhan (non-developer, works from GitHub Codespaces terminal, pastes commands Claude provides). Repo: rozhanbusiness-ux/media-carousel.

---

## 2. Technical Architecture

- **Server:** Node.js + Express (server.js)
- **Rendering:** Puppeteer converts HTML/CSS templates to PNG (src/render.js), deviceScaleFactor:2 for high resolution
- **AI:** Gemini - one model generates background images ONLY (never touches logo/text/layout, which are fixed HTML/CSS), a separate text-capable model (gemini-2.5-flash) does field-guided extraction from screenshots and PDFs (src/gemini-image.js, src/extract-offer.js)
- **Frontend:** Single file public/index.html - raw HTML/CSS/JS, no framework, no build step (chosen deliberately for this project's scale: instant paste-and-test workflow in Codespaces)
- **Offer type registry:** src/offer-types.js - the architectural backbone (see below)
- **Field-fill layer:** src/fill-template.js - generic, works for any offer type

### Registry Pattern (critical architecture concept)

Each offer type is ONE record in src/offer-types.js containing:
- id - English identifier (e.g. 'flight', 'package')
- displayName - German UI label (e.g. 'Flug', 'Pauschalreise')
- sizes - array of available size ids for this type
- templates - map: each size -> array of template filenames (one slide, or a pair/triplet for multi-slide types)
- fields - object: each field key -> { label (German), type ('text'|'date'|'select'|'list'), required, maxLen, default, manual (optional, true = never extracted, user fills by hand), options (for type:'select'), itemFields (for type:'list' — the shape of each list item) }
- buildBackgroundPrompt(subject, orientationText) - function returning the Gemini image-generation prompt text (a type with multiple independent backgrounds, like cruise, instead exposes buildHeroBackgroundPrompt / buildItineraryBackgroundPrompt and a server-side `purpose` param picks the right one)

**To add a new offer type in the future:** add ONE new record here + build its HTML template file(s). Nothing else in the architecture needs to change - the frontend (public/index.html) dynamically builds its input fields from whatever registry entry is selected, and the server reads the templates map generically. This pattern has been proven three times now (flight, package, cruise) with zero architectural changes needed — though cruise did surface several implicit assumptions in the frontend that needed generalizing (see Section 3.3 lessons).

### Data flow

1. User picks an Offer Type from a dropdown (populated live from GET /api/offer-types)
2. Frontend fetches that type's field definitions (GET /api/offer-types/:id) and dynamically builds input fields (text/date-picker/dropdown/repeatable-list as defined)
3. User either fills fields manually, OR uploads a screenshot (POST /api/extract, one offer per image) OR a PDF (POST /api/extract-pdf, extracts ALL offers found in the document, one card each)
4. User can hold multiple "offer cards" at once (a mini-carousel in progress), each with independently-tracked fields + background(s) + city-toggle state
5. Per offer, user clicks "Hintergrundbild generieren" - background image generated ONCE at story (9:16) ratio and shared/cropped across all selected sizes (saves cost, ensures visual consistency). Types with a second independent background (currently only cruise, for its itinerary slide) get a second dedicated button that sends `purpose:'itinerary'` and stores the result separately.
6. Preview shows the selected size/slide; a "Folie: 1/2" (or 1/3 for cruise) toggle switches between the type's slides
7. Export: single-offer export (current card, all checked sizes) or batch export (ALL offer cards, all checked sizes) - both go through POST /api/render-all, which is template-map aware (loops through however many templates the type defines per size)

---

## 3. Completed Offer Types

### 3.1 Flight (flight)

- **7 fields:** origin (Abflugort), destination (Reiseziel), price (Preis), date_out (Hinflug), date_return (Rueckflug), baggage_1 (Gepaeck 1, optional), baggage_2 (Gepaeck 2, optional)
- **Single slide per size** (no pair)
- **Templates:** offer-slide.html (story), offer-slide-square.html, offer-slide-portrait.html - all 3 sizes complete
- **Background prompt:** city panorama, sky capped at ~10% at the very top (clean bright blue gradient, never sunset/orange there) so the gold logo stays legible; landmarks placed in the vertical upper-middle band (15-60% of height) so the image survives center/top-biased cropping to other aspect ratios
- **Origin note:** an early hook-slide concept (airplane-in-sky background) was built then FULLY CANCELLED - Rozhan designs hook/CTA slides himself in Canva as static per-campaign assets; the app only handles the repeating data-heavy offer slides. All hook-related code/templates/fonts were deleted from the codebase.

### 3.2 Package Holiday (package)

- **11 fields:**
  - destination (Reiseziel) - extracted
  - hotel_name (Hotelname) - extracted
  - price (Preis) - extracted
  - date_from (Reisedatum von) - extracted, **type: date** (native calendar picker, converted to DD.MM.YYYY on collect)
  - date_to (Reisedatum bis) - extracted, type: date
  - origin (Hinflug) - extracted
  - board (Verpflegung) - extracted, **type: select**, options: nur Uebernachtung / Fruehstueck / Halb Pension / Full Pension / All Inklusive / All Inklusive +
  - transfer (Transfer) - extracted, **type: select**, options: Inklusive / Nicht inklusive
  - stars (Bewertung) - extracted (1-5, may be decimal like "3.5" or empty from source; no auto-rounding logic added - Rozhan corrects manually by design)
  - promo_line (Aktionszeile) - **manual: true**, never extracted, hand-written promotional line (e.g. "Promotion Double Standard")
  - room_details (Zimmerdetails) - **manual: true**, never extracted (though Gemini sometimes fills it anyway as a bonus during PDF extraction - harmless, still reviewable)
- **Slide PAIR per size** (this is the key structural difference from flight):
  - Hotel slide: package-hotel.html / -square / -portrait - destination as large white title, hotel name in gold beneath, gold divider+star, promo line, footer
  - Details slide: package-details.html / -square / -portrait - dark navy radial-gradient background (CODED, not AI-generated), "ab {price} Euro" block top, then 6 icon rows: Reisedatum (date range), Hinflug (origin), Rueckflug (destination - Rozhan's literal label choice, keep as-is), Verpflegung, Transfer, Bewertung (stars as dynamic gold SVGs via starsSvg(n) in fill-template.js - exact integer count, no rounding built in)
- **All 3 sizes complete** (story/square/portrait) - reached full parity with flight type on 2026-07-18
- **Background prompt:** delegates to flight.buildBackgroundPrompt() - same city-panorama logic, package.js does NOT define its own (Rozhan explicitly rejected resort/beach imagery even for packages - always city panoramas)

### 3.3 Cruise / Sea & River Cruises (cruise) — COMPLETE (screenshot extraction), 14.–17.09.2026

- **10 fields + 1 list field:**
  - destination (Reiseziel) - extracted
  - ship_name (Schiffsname) - extracted
  - promo_line (Aktionszeile) - manual, like package
  - stars (Bewertung) - extracted, **type: select** (1-5 dropdown, no free text)
  - price (Preis) - extracted
  - date_from (Reisedatum von) - extracted, type: date
  - date_to (Reisedatum bis) - extracted, type: date
  - departure_port (Abfahrtshafen) - extracted
  - cabin_type (Kabinentyp) - extracted, **type: select**, options: Innenkabine / Meerblick / Balkon / Suite
  - board (Verpflegung) - extracted, same select options as package
  - **stops** (Reiseverlauf) - **type: list**, required, the project's first repeatable field. Each item: city (Stadt, text) + day_label (Datum, native date picker). No hard cap on item count, no description field (removed by design decision — added no value)
  - Note: cruise has **no origin field** and **no transfer field** (both explicitly removed/never added) — several frontend places implicitly assumed every type has an origin field; all such assumptions have now been found and fixed (see lessons below)
- **THREE slides per size** (first type with 3 instead of 2):
  1. **Hero** (cruise-hero / -portrait / -square): destination as large white title, ship_name in gold, gold divider+star, promo_line, footer — AI-generated city/ship background (own "Hintergrundbild generieren" button)
  2. **Itinerary/Reiseverlauf** (cruise-itinerary / -portrait / -square): dark navy overlay background, its OWN independently-generated AI background (separate "Alle Häfen anzeigen"-style second button, subject auto-derived from destination, no manual input), dynamic vertical timeline of stops built by buildStopsHtml() (server, src/fill-template.js) and its browser mirror buildStopsHtmlPreview() (public/index.html) — MUST be kept in sync in both places for any future visual change
  3. **Details** (cruise-details / -portrait / -square): same coded-navy-background pattern as package-details — price, date_from/date_to, departure_port (own ship-anchor icon, not the flight icons), cabin_type, board, stars_svg. 5 rows (one fewer than package, since cruise has no transfer/origin/destination pair)
- **All 9 templates (3 slides × 3 sizes) built and confirmed working end-to-end in the browser** — full parity with flight/package reached 17.09.2026
- **Itinerary timeline is size-aware:** buildStopsHtml/buildStopsHtmlPreview take a `size` param; per-size AREA_BOUNDS (story: 340–1780px, portrait: 270–1258px, square: 210–998px) plus a SIZE_SCALE factor (story:1, portrait:0.73, square:0.58) shrink dot/font size appropriately. Square's smaller scale was tested and deliberately kept as-is per Rozhan's decision even though the timeline text reads noticeably smaller there than on Story/Portrait.
- **Screenshot extraction fully working**, including the list field: Gemini correctly returns an array of {city, day_label} objects for stops, and the frontend correctly renders them into the repeatable list UI via setListFieldValue()
- **PDF (multi-offer catalog) extraction for cruise: code path implemented but NOT YET tested against a real cruise PDF** — next session should verify this before considering cruise fully done
- **Background prompt:** buildHeroBackgroundPrompt() and buildItineraryBackgroundPrompt(), both isolated in the cruise registry entry, selected server-side via an optional `purpose` param ('hero' | 'itinerary') added to src/gemini-image.js and server.js — backward-compatible, falls back to old single-background behavior for flight/package

**Hard-learned lessons from building the first offer type with a list field and no origin field** (important for any FUTURE type with similar shape — e.g. planned hotel/vacation-home merge):
1. Several frontend places implicitly assumed every offer type has an `origin` field (the origin/destination background-subject toggle, `emptyOffer()`'s default `bgCityMode`). All now have null-checks/dynamic fallbacks. Check for this class of assumption again with any future type lacking an origin field.
2. The browser preview (`updatePreview()` in public/index.html) uses its OWN separate copy of placeholder-filling logic instead of calling the server's `fillTemplateFile`/`buildStopsHtml` — this is why a browser-side twin (`buildStopsHtmlPreview`) had to be built and kept in sync manually. Same pre-existing pattern as the duplicated `stars_svg` logic. Any future change to how a derived/list field renders must be made in BOTH src/fill-template.js and public/index.html.
3. **Extraction prompt bug (found and fixed 17.09.2026):** `buildExtractionPrompt()` and `buildMultiExtractionPrompt()` in src/extract-offer.js had a **hardcoded example answer string built from flight's fields** (`{"origin":"Düsseldorf",...,"baggage_1":"",...}`). This silently confused Gemini for any non-flight type — for cruise it caused extraction to return only the `destination` field correctly and leave everything else empty, with NO error thrown (looked like extraction was "failing silently"). Fixed by generating the example dynamically from each offer type's actual registered fields. **Any future offer type add should verify extraction end-to-end, not just assume it works because the prompt "looks generic."**
4. **List-field extraction required generalizing the extraction pipeline itself:** both prompt builders now emit a separate "List fields to find" section (derived from `itemFields`) describing the expected array-of-objects shape, and the post-extraction filtering logic in both `extractFromImage()` and `extractFromPdf()` now branches on `fieldDef.type === 'list'` to build a cleaned array of item-objects instead of assuming every field is a plain string.
5. **Frontend single-screenshot-upload bug:** the code path that fills fields after a single-image extraction did `document.getElementById(key).value = val` for every returned field — this silently no-ops for list fields (no such DOM element exists, and val is an array, not a string). Fixed to branch on the field's registry type and call `setListFieldValue(key, val)` for list fields. The multi-file-upload path was already correct since it writes into `o.fields` directly rather than via the DOM.
6. When some Details-slide fields come back empty after extraction (e.g. cabin_type, board), this is expected/correct behavior when the source screenshot itself doesn't contain that information — the "empty field over guessing" rule holds, not a bug.

### 3.4 Shared extraction system

- src/extract-offer.js exports extractFromImage() (single offer, field-guided prompt built from the active type's field list - doubles as extraction target list) and extractFromPdf() (multi-offer array extraction, same field-guided approach, instructs Gemini to find EVERY offer in a multi-offer PDF document and return a JSON array)
- **Field-guided extraction principle (Rozhan's own idea, proven three times now):** instead of asking the AI to freely parse an unknown layout, give it the exact field list (with German labels + example values) and ask it to find each field's value specifically. Works reliably across wildly different source layouts (5-15+ variants exist across suppliers) because the fields are the stable anchor, not the layout.
- **List-type fields are now first-class in extraction** (added for cruise, 17.09.2026): the prompt describes each list field's item shape from `itemFields`, and the example answer format is generated dynamically per offer type (see lesson #3 above — this also fixed a silent flight-only-hardcoded-example bug affecting all non-flight extraction).
- **Date rule:** travel dates are ALWAYS future - if extracted month >= current month, use current year, else next year. Output DD.MM.YYYY.
- **Missing field rule:** empty string (or empty array for list fields), NEVER guess.
- **Price rule:** copy numeric value exactly as shown including decimals, Rozhan adjusts manually.
- Colored-box hint: if the source screenshot has values highlighted in a colored box (Rozhan's own technique), prefer that value.
- Tested successfully on 2 real supplier PDFs for package (12-offer and 9-offer catalogs, different layouts) - extraction accuracy was excellent both times. **Cruise PDF extraction not yet tested with a real document (see Section 3.3).**

---

## 4. Fixed Visual Identity (NEVER changes)

- **Colors:** deep navy #0F2359 / #0a1838, gold #C9A227 / #E6C25A, white #FFFFFF
- **Fonts:** Playfair Display (titles), DM Serif Display (ALL numbers/values/prices - unified project-wide on 2026-07-17; the old Anton/Archivo Black bold price fonts on flight templates were removed and replaced, confirmed to still look good with the gold outline effect)
- **Logo:** real file templates/logo.png, always embedded as a data-URI at render time (never faked, never CSS-drawn)
- **Footer:** thin gold line + phone icon + email icon, fixed on every slide, present in every template
- **Backgrounds:** always AI-generated aerial city panoramas - never resort/beach imagery, even for package holidays or cruises. Sky capped at top for logo legibility. Composition rule embedded in every prompt: keep key visual interest in the upper-middle vertical band so the image survives cropping to other aspect ratios from the same generated source image. Cruise's itinerary slide is the one exception to "shared background across sizes" being the ONLY generation per offer — cruise generates two independent backgrounds (hero + itinerary), each still shared/cropped across its own 3 sizes.
- **Background sharing:** ONE generation at story (9:16) ratio is reused/cropped for square and portrait outputs of the same offer and same background purpose - never regenerated per size (cost + consistency).

---

## 5. Hard-Learned Technical Lessons (do not repeat these mistakes)

1. **Never regex-patch large HTML/JS blocks.** Multiple sessions had page-breaking incidents from replacing big multi-line blocks with sed/naive string replace - a partial match left orphaned code (e.g. half of an old event handler with await outside any function, breaking the entire page load). ALWAYS use small, unique anchor strings for insertions, and ALWAYS verify the anchor exists before writing (if old not in s: raise - write nothing if any anchor is missing).
2. **CSS border-image does not render reliably in Puppeteer/Chrome** for single-side (e.g. bottom-only) borders - it silently fails or renders as a solid line. For any fading/gradient border effect, use a ::after pseudo-element with position:absolute and a linear-gradient background instead. This is now the standard pattern.
3. **After any bulk deletion**, grep for orphaned references (leftover variable declarations, unclosed divs, dangling function calls) before considering the change complete. A partial deletion once broke the entire page layout for an unrelated element.
4. **Never leave placeholder/demo values in input field value="" attributes.** A recurring "Barcelona" bug (background generated for the wrong city repeatedly) traced back to hardcoded demo values (STUTTGART/Barcelona/139/etc.) baked into the HTML input tags themselves, plus a defaultSubjects lookup table - both fully removed. All fields must start genuinely empty.
5. **All test scripts and test artifacts** (test-*.js, test-*.png, sample PDFs like test-offers.pdf) go into .gitignore immediately upon creation - never committed. Check git status before every git add and confirm no test files slipped in.
6. **Declare state variables (JS let) before their first use**, especially when built incrementally across multiple edits - a bgCityMode/currentSlideIndex TDZ (temporal dead zone) error broke page load twice from a late declaration being used earlier in the script.
7. **When per-offer state needs isolating** (e.g. multiple offer cards, each with independent background generation), write results directly into that offer's object (offers[targetIndex]), not into global/shared variables - otherwise concurrent or sequential operations on different cards cross-contaminate each other's data. Also track "busy" state per-offer-index (a Set), not with one global disabled button, to allow parallel background generation across cards.
8. **Server-side, Gemini accepts concurrent generation requests fine** (~14s for 2 simultaneous requests vs ~14s for 1 - true parallelism proven via curl test); any remaining serialization felt in the browser is browser-side request queuing, not a backend limitation. Rozhan decided this minor UX quirk isn't worth chasing further.
9. **Never hardcode an example/sample value from ONE offer type inside a generic, type-agnostic prompt or template string.** The cruise extraction bug (Section 3.3, lesson #3) came from exactly this: a flight-specific example JSON silently confused the AI for every other type, with no thrown error. Any "example output" shown to an AI model (or to a user) inside genuinely generic code must be generated dynamically from the active type's actual registry data.
10. **A field's "browser copy" of server-side render logic (buildStopsHtmlPreview mirroring buildStopsHtml, stars_svg's existing dual implementation) is a known architectural wart, not a one-off.** Any future list/derived field will likely need the same dual maintenance until the preview path is refactored to reuse server code directly — not planned/prioritized as of 17.09.2026, but worth remembering if this pattern causes a third or fourth divergence bug.

---

## 6. Workflow / How We Work Together

- **Chat language:** switches between Arabic and German per Rozhan's request (Arabic as of 17.09.2026, was German for a stretch in July for his language practice — small natural corrections were welcome then but not forced; not currently in German-practice mode). Code, comments, identifiers: always English. App UI and all rendered output text: always German only.
- **Small verified steps, always.** Never offer "do everything at once" as an equal alternative - guide toward incremental steps, verify each works before proceeding to the next.
- **Verify file state before editing** - cat/grep the actual current file content, never assume a previous edit succeeded without confirming its output.
- **Exact copy-pasteable terminal commands** - Rozhan pastes commands himself in the Codespaces terminal.
- **Before any git add/commit:** always run git status first, inspect the file list together, exclude test artifacts, confirm no secrets.
- **Commit frequently at clean checkpoints** - commit/push right after each verified, working feature. When a feature spans multiple sub-steps that only make sense together (e.g. cruise's Portrait/Square templates + the extraction fix), it's fine to defer the commit until the whole unit is verified working, per Rozhan's explicit call each time — but always confirm with him rather than assuming.
- **Session-end rule (mandatory):** at the end of every successful working session, write a detailed session summary to Claude's memory (and keep this file updated too).
- **Light German correction:** when Rozhan makes small German grammar/spelling mistakes in chat, offer gentle natural corrections without making it a big deal (applies during German-language sessions).

---

## 7. Current State (as of last update — 17.09.2026)

- **Last commit:** f030a5f - "Cruise: Portrait/Square templates for all 3 slides + list-field (stops) extraction via Gemini" — added 6 new cruise templates (hero/details/itinerary × portrait/square), made buildStopsHtml/buildStopsHtmlPreview size-aware, fixed a hardcoded-flight-example bug in extract-offer.js that broke non-flight extraction, fixed single-screenshot-upload to correctly fill list fields.
- **Repo status:** clean, fully synced with origin/main on GitHub (rozhanbusiness-ux/media-carousel)
- **All three offer types (flight, package, cruise) are fully functional end-to-end for screenshot-based workflows**, with full 3-size parity, dynamic field UI (including the new repeatable-list field type), multi-offer card management, background sharing across sizes (and independent secondary backgrounds for cruise's itinerary slide), and batch export.
- **Open item before cruise is 100% done:** PDF (multi-offer catalog) extraction has not yet been tested against a real cruise PDF, though the code path was updated to support list fields generically.
- **Not yet deployed:** all of this session's (and recent sessions') changes exist only in Codespaces/GitHub — production (carousel.media-travels.com on Hetzner) has NOT been redeployed since 2026-08-20. See Section 10 for the redeploy procedure.

---

## 8. Roadmap Status

**COMPLETED 2026-07-19: Full-carousel batch background generation.** Two buttons added: "Alle generieren" (only generates for offer cards missing a background) and "Alle neu generieren" (force-regenerates ALL cards regardless of existing background). Both run sequentially through all offer cards with progress feedback ("Generiere Hintergrundbild N von M..."), reusing the per-offer-index busy-tracking (`generatingOffers` Set) and writing results directly into `offers[idx]` established in earlier sessions. Refactored the original single-offer generation handler into a shared `generateOfferBackground(idx)` function to avoid duplicating the fetch/error logic. Verified working end-to-end with 3 offer cards. Git commit `e78c7c0`.

**COMPLETED 17.09.2026: Cruise offer type, screenshot-extraction path.** Third offer type reaches full parity with flight/package: all 9 templates (3 slides × 3 sizes), dual independent AI backgrounds, and full field extraction from screenshots including the project's first repeatable list field (stops/Reiseverlauf). See Section 3.3 for full detail and hard-learned lessons.

Next up, in priority order (updated 17.09.2026):

1. **Test cruise PDF (multi-offer catalog) extraction** with a real document — verify the list-field extraction generalization actually works for multi-offer PDF parsing, not just single-screenshot.
2. **Deploy the app to Rozhan's own server** for daily production use (see Section 10) — includes today's cruise work; NEXT IMMEDIATE STEP after PDF verification, or can be done in parallel/first if Rozhan prefers to get cruise live sooner.
3. **Additional offer types** - river cruises share the `cruise` type conceptually but may need their own registry entry depending on field differences (e.g. river cruises often have no departure_port in the sea-cruise sense) — decide when Rozhan raises it; then hotels/vacation-homes (maybe merged into one type with an accommodation-type field), then visa services. Each is purely a new src/offer-types.js registry entry (fields + background prompt(s) + templates map) plus building the actual HTML template file(s). No other architectural changes are expected to be needed, per the now-three-times-proven registry pattern — though see Section 3.3's lessons about hidden origin-field assumptions and hardcoded flight-example bugs before assuming a fully clean slate.
4. (Longer-term, from original vision) Full 10-slide carousel generation in one operation, matching the original "Carousel Constitution" structure Rozhan specified early on: hook (his own Canva asset) -> repeating hotel/details or offer pairs/triplets -> CTA (his own Canva asset). The app currently produces only the repeating data-heavy middle slides, by design.

---

## 9. Long-Term Vision (future phases, not started, no urgency)

Order of near-term work (Rozhan's explicit priority, 2026-07 planning session, cruise added 2026-09):
1. ~~Finish full-carousel batch background generation~~ — DONE 2026-07-19
2. ~~Build the cruise offer type~~ — DONE 17.09.2026 (screenshot path; PDF path pending verification)
3. Deploy the app to Rozhan's own server for daily production use — deployment considerations noted below (still not done as of 17.09.2026, several sessions of feature work have accumulated since the last deploy)
4. THEN, without rushing: additional offer types in this priority order:
   - River cruises (Flusskreuzfahrten) — may reuse the cruise type or need a variant, TBD
   - Hotels / vacation homes (Ferienhäuser) — Rozhan is considering merging these into ONE offer type (an "accommodation type" field distinguishing hotel vs. vacation home) rather than two separate types, since their data shape is very similar. Decide this properly when we get there, not now.
   - Visa services (Visa)

### Deployment considerations (for when we deploy to Rozhan's server)
- **Secrets:** GEMINI_API_KEY lives in the server's `.env` (never committed) — unchanged, no action needed here.
- **Storage:** exported PNGs accumulate in `output/` on the server with no cleanup. Still a nice-to-have, not yet done.
- **Stability:** current server has no auto-restart-on-crash or error monitoring beyond Docker's `restart unless-stopped`. Still a nice-to-have.
- **Redeploy is a git pull + Docker rebuild** — see Section 10's exact procedure. Multiple sessions' worth of changes (cruise type included) are queued up for the next deploy.

### Big future feature ideas (Rozhan's vision, explicitly flagged as "much later, no rush")
1. **Direct social media publishing integration** — auto-post generated carousels directly to platforms. NOTE: this requires each platform's official app registration + security review (Meta Graph API app review, etc.) — an administrative/approval process outside pure coding, not just an engineering task. Discuss in detail when we get there.
2. **Post scheduling** — schedule carousels to publish at specific future times.
3. **Additional regular post types** — general informational/educational content posts (not tied to travel offers), i.e. full standalone content pieces.
4. **Reels/Shorts generation** — via integration with external video platforms (Rozhan mentioned higgsfield as an example).
5. **Additional platforms** — e.g. LinkedIn, beyond the current Instagram/Facebook/TikTok-shared-size approach.
6. **AI content-writing platform** — the biggest, most transformative idea: evolving the app from "data-driven image generator" into an AI tool that WRITES marketing copy/posts. This is architecturally a much bigger shift than adding an offer type (moves from templated-data-rendering into generative-content-writing) and deserves a dedicated architecture discussion whenever Rozhan wants to pursue it — not a simple registry addition like offer types are.

---

## 10. Deployment — LIVE since 2026-08-20, NOT REDEPLOYED SINCE (as of 17.09.2026)

The app was deployed and went live in production at https://carousel.media-travels.com on 2026-08-20. **Multiple feature sessions (including all of the cruise offer type work) have happened since and have NOT yet been pushed to production** — production is currently running an older version of the app (last known-good state: whatever commit was live as of 2026-08-20/2026-09-04's bug-fix sessions).

### Live setup
- Server: Hetzner VPS, IP 167.233.144.112, Ubuntu 24.04. App lives at /opt/media-carousel
- Container: Docker Compose, service media-carousel-app, host port 3010 to container 3000, restart unless-stopped, secrets via env_file .env (never committed). Volumes: ./output and ./cache
- DNS: A record carousel.media-travels.com to 167.233.144.112 (managed at Hostinger, TTL 14400)
- Nginx: host-level reverse-proxy vhost at /etc/nginx/sites-available/carousel (symlinked into sites-enabled), proxying to 127.0.0.1:3010. Same pattern as existing offers/n8n vhosts
- SSL: Let's Encrypt via Certbot (--nginx), auto-renewing. HTTP to HTTPS redirect by Certbot. Cert expires 2026-11-18
- Auth: HTTP Basic Auth protects the whole site (app has no login of its own). Credentials file /etc/nginx/.htpasswd-carousel. Username MediaTravel (password known to Rozhan only; set via htpasswd, never stored in chat or repo). To add/change a user: htpasswd /etc/nginx/.htpasswd-carousel USERNAME then systemctl reload nginx

### Redeploy procedure (after any future code change)
Reload SSH key in a fresh Codespace, then git pull + rebuild on the server:
  mkdir -p ~/.ssh && echo the HETZNER_SSH_KEY secret into ~/.ssh/hetzner_key && chmod 600 it
  ssh -i ~/.ssh/hetzner_key root@167.233.144.112 then: cd /opt/media-carousel && git pull && docker compose up -d --build

### Notes / still open (minor, non-blocking)
- Kernel upgrade pending on the server (noticed 2026-08-20) — a reboot is advisable at a convenient time; it briefly stops all host services. Not urgent
- output/ PNG cleanup and a crash-restart/monitoring solution (pm2 or a compose healthcheck) remain nice-to-haves, not yet done
- Optional: add .devcontainer/setup-ssh.sh to auto-load the SSH key after each Codespace rebuild (currently manual)
- **The cruise offer type (and all its commits) will only become available to Rozhan in daily use once a redeploy is run — this is now the main reason to prioritize deployment soon.**

---

## 11. Known Bugs — ALL CLOSED (2026-09-04, pre-cruise)

1. PRICE DECIMAL SEPARATOR LOST ON EXPORT — FIXED 2026-08-31. Root cause: src/offer-schema.js normalize() regex was stripping the decimal point/comma. Fixed to keep digits, dot, and comma as typed (no forced German-comma conversion). Confirmed live on production.
2. BATCH DOWNLOAD (export all at once) — FIXED 2026-08-31, STRESS-TESTED 2026-09-04. Root cause: src/render.js used waitUntil:'networkidle0', which large embedded Gemini background images could prevent from completing within the 30s timeout. Fixed to {waitUntil:'load', timeout:60000}. Verified live with a 3-4 offer batch export — all files downloaded with zero errors.
3. SOME INDIVIDUAL IMAGES NOT DOWNLOADABLE — same root cause as bug 2, same fix, verified live with a single-offer export — zero errors.

If export issues recur in the future, check `docker compose logs` on the server first.

**New bug found and fixed 17.09.2026 (see Section 3.3 lessons #3 and #5 for full detail):**
4. NON-FLIGHT OFFER TYPES EXTRACTED ALMOST NOTHING FROM SCREENSHOTS — FIXED 17.09.2026 in commit f030a5f. Root cause: a hardcoded example-answer JSON string in the extraction prompt was built from flight's fields only, silently confusing Gemini for cruise (and, latently, would have affected any future non-flight/package type too, though package happened to work well enough by coincidence of similar field shapes). Fixed by generating the example dynamically per offer type. Confirmed fixed for cruise in Codespaces; **not yet re-verified against flight/package in production after this fix, though the fix is generic and should not change their behavior** (worth a quick sanity check on next production test).
5. LIST-FIELD VALUES SILENTLY LOST DURING SINGLE-SCREENSHOT EXTRACTION — FIXED 17.09.2026 in commit f030a5f, same session. Root cause: the fill-fields-after-extraction code assumed every field maps to a plain DOM input element; list fields (like cruise's stops) have no such element and are arrays, not strings, so the assignment silently no-op'd. Fixed to route list-type fields through setListFieldValue() instead.

---

## 12. Planned Work — Priority Order (updated 17.09.2026)

Phase 1 — Fix the bugs above. DONE (see Section 11 — most recently, the two extraction bugs found while building cruise, 17.09.2026).

Phase 2 — Mobile-responsive UI. FIRST PASS DONE 2026-09-04: added a @media (max-width:768px) block to public/index.html — panel and preview now stack vertically on phones instead of squeezing side-by-side. Confirmed live on Rozhan's actual phone: fields, buttons, upload, offer-card strip, and preview all comfortable, no notes. The preview box itself is still a fixed 360px width (not yet fully fluid/vw-based) — candidate for later polish on narrower phones, not urgent since it already fits real devices fine. (Not yet re-tested on the new cruise offer type's 3-slide UI on mobile — worth checking once cruise is deployed.)

Phase 2b — Small quality-of-life fix, DONE 2026-09-04: flight date fields (Hinflug/Rückflug) switched from free-text to the native calendar-picker (type:'date', same system package dates already used) — no more manual date typing. Also removed old hardcoded default date values (03.07.2026 / 18.07.2026) that violated the no-default-values rule.

Phase 3 — Cruise offer type. DONE 17.09.2026 (screenshot path) — see Section 3.3. PDF extraction path implemented but not yet tested with a real cruise PDF; this is the one remaining open item before Phase 3 is fully closed.

Phase 4 — Deployment refresh (current priority):
- Redeploy to production (Hetzner) to bring cruise (and all accumulated changes since 2026-08-20) live. See Section 10 procedure.
- After redeploy, do a quick live sanity check on flight/package extraction (the hardcoded-example bug fix, while low-risk, hasn't been re-verified against them in production yet).

Phase 5 — Quick wins (not yet started):
- Test cruise PDF extraction with a real multi-offer cruise catalog.
- Additional offer types via the proven registry pattern: river cruises, hotels/vacation-homes (maybe merged into one type with an accommodation-type field — decide then), visa. Each = one registry entry (fields + background prompt(s) + templates map for 3 sizes) + building the HTML templates. Review Section 3.3's lessons (hidden origin-field assumptions, hardcoded example-answer bug class) before assuming this is purely mechanical.
- Drag-and-drop slide reordering.
- Full-carousel sequential download (all slides numbered in correct order in one click). This is useful on its own and does NOT depend on the share button.

Phase 6 — Sharing (needs a feasibility test before committing):
- "Share full carousel" button using the phone native share sheet (same mechanism Canva uses — achievable to the same degree, not Canva-exclusive). Works well for WhatsApp and single-image stories.
- Manual first + last slide upload: two slots to upload Rozhan's own Canva Hook (first) and CTA (last) slides, combined with the generated offer slides into the complete ordered carousel. Rozhan considers this CONDITIONAL on direct multi-image share working.
- Hard part: sharing multiple ordered images at once as a single carousel POST is restricted by the platforms (esp. Instagram). A multi-image ordered post cannot be pushed pre-arranged from an external website; real direct auto-post needs official platform app registration + review (admin process, not just code). Plan: build a SMALL share-button test first and test it live on Rozhan's phone across WhatsApp/Instagram/TikTok to see what actually happens per platform, before designing. Guaranteed-value fallback: numbered ordered download + native share sheet.

## 13. Bigger Future Ideas (not started, need dedicated discussion when pursued)

- User-controllable styling/themes: control colors, fonts, sizes, switch templates on demand. TENSION with the fixed brand identity — decide first between full free control vs. a small set of pre-approved on-brand presets. A design discussion, not just code.
- Reusable generated-image library/archive. Currently Gemini backgrounds are cached in /cache (short bgId, for export speed) and exported PNGs pile up in /output with no reuse/archival — tied to the open output-cleanup item.
- Video generation via Veo integration — short videos and UGC-style videos for TikTok/Instagram. Biggest idea yet: turns the app into a multimedia content platform. Needs a dedicated architecture discussion (related to the earlier Reels/Shorts + social auto-publishing long-term items).
- Also still noted from earlier: full 10-slide carousel generation in one operation; social auto-publishing; post scheduling; AI content-writing platform.
- Refactor the browser preview to reuse server-side render/fill logic directly instead of maintaining a parallel copy (see Section 5, lesson #10) — not urgent, but the duplication has now caused sync issues twice (stars_svg, then the cruise itinerary timeline).

---

## 14. Session Log — 14.09.2026 — Cruise Offer Type (design + data infrastructure)

**Design agreed (3 slides per offer):**
- Hero: destination, ship_name, promo_line (manual), stars — AI city-panorama background
- Itinerary: stops repeatable list field (city, day_label, description) — independent AI background with navy overlay; dynamic sizing, default 6 stops shown but no hard cap
- Details: same pattern as package (price, date_from, date_to, departure_port, cabin_type select, board select, transfer select) — coded navy background

**Implemented and pushed:**
- cruise registry entry in src/offer-types.js (commit d13d6be) — fields, templates map, dual background prompt builders
- Dual-background support in src/gemini-image.js + server.js via optional purpose param, backward-compatible (commit 4fa7d2a)
- list field type support in public/index.html: dynamic add/edit/remove UI for stops, plus fixes to emptyOffer, saveCurrentOffer, loadOffer and collect() (commit 53fd817)
- Two pre-existing frontend bugs discovered and fixed: collect() was calling toGermanDate() on all fields regardless of type; cityForBackground() assumed an origin field always exists (cruise has none)

**NOT done yet at this point:** no visual templates existed, list-field extraction not yet implemented. (Both completed in later sessions — see below.)

---

## 15. Session Log — 14.09.2026 (continued) — Cruise Offer Type: all 3 Story-size slides complete

**Bugs fixed this session:**
- Removed unused `description` field from `stops.itemFields` (registry, server-side `buildStopsHtml`, browser-side `buildStopsHtmlPreview`) - Rozhan decided it added no value
- Increased itinerary timeline font/dot sizes significantly (dotRadius 26-40px, cityFontSize 44-72px, dayFontSize 28-42px) - previous values were far too small regardless of stop count
- `stars` field changed from free text to a select dropdown (1-5); `day_label` in stops changed from text to a native date picker; `transfer` field removed entirely from cruise (not needed)
- Added a second background-generation flow for the itinerary slide: new `btnGenItinerary` button (visible only for cruise), subject auto-derived from `destination` (no manual input), sends `purpose:'itinerary'` to `/api/generate-bg`, stored separately as `itineraryBgImage`/`itineraryBgId` per offer
- Fixed `updatePreview()` to pick the correct background (`bgImage` vs `itineraryBgImage`) depending on which slide is currently shown
- Fixed a deeper bug affecting any future offer type without an `origin` field: the origin/destination background-subject toggle is now hidden when the type has no `origin` field, and `emptyOffer()` now derives its default `bgCityMode` from the current type instead of hardcoding `'origin'`

**Templates completed (Story size only):** cruise-hero.html, cruise-itinerary.html, cruise-details.html — all three built, tested, and confirmed working end-to-end in the browser.

---

## 16. Session Log — 17.09.2026 — Cruise Offer Type: COMPLETE (screenshot path)

**Verified at session start:** all 3 Story-size cruise slides confirmed still working in the browser (Hero, Itinerary, Details) after re-running `npm start`.

**Built and confirmed in-browser (Portrait + Square variants of all 3 slides):**
- cruise-hero-portrait.html, cruise-hero-square.html — direct adaptations of package-hotel-portrait/square with destination/ship_name/promo_line swapped in
- cruise-details-portrait.html, cruise-details-square.html — adaptations of package-details-portrait/square with cruise's 5 rows (Reisedatum, Abfahrtshafen, Kabinentyp, Verpflegung, Bewertung) and cruise's own port icon
- cruise-itinerary-portrait.html, cruise-itinerary-square.html — same navy-overlay-on-AI-background pattern as the Story version, footer/logo sized to match package's portrait/square conventions

**Made the itinerary timeline size-aware (previously Story-only, hardcoded 340–1780px bounds):**
- `buildStopsHtml()` (src/fill-template.js) and `buildStopsHtmlPreview()` (public/index.html, kept in sync as a manual mirror) now take the active `size` and look up per-size `AREA_BOUNDS` (story: 340–1780, portrait: 270–1258, square: 210–998)
- Initial fix alone made Portrait/Square timelines look oversized relative to the smaller canvas — added a `SIZE_SCALE` factor (story:1, portrait:0.73, square:0.58) applied to dot radius and both font sizes to compensate
- Rozhan flagged the Square result as reading too small after this — decided (his explicit call) to leave it as-is rather than further tune it

**Fixed the cruise screenshot-extraction bug (this was the big one — see Section 3.3 and Section 11, bug #4 for full detail):**
- Root cause found via a debug log of Gemini's raw response: extraction WAS correctly returning all cruise fields including stops — the bug was a hardcoded flight-only example-answer string in the prompt confusing the model into extracting almost nothing for other types. Fixed by generating the example dynamically per offer type in both `buildExtractionPrompt()` and `buildMultiExtractionPrompt()`.
- Generalized both prompt builders and both post-extraction filtering functions (`extractFromImage`, `extractFromPdf`) to handle `type:'list'` fields generically (array-of-objects per `itemFields`, filtered to drop items with no i.e. field values).
- Found and fixed a second bug in the same debugging session: the single-screenshot-upload path in public/index.html filled fields via `document.getElementById(key).value = val`, which silently failed for the list field (no such DOM element, val is an array). Fixed to check the field's registry type and call `setListFieldValue()` for list fields.
- Removed the temporary debug `console.log` calls before committing.
- Rozhan tested with a real cruise screenshot: Reiseverlauf (stops) populated correctly. Some Details fields (Kabinentyp/Verpflegung) came back empty for that particular test image — confirmed as correct behavior (source image didn't contain that info), not a bug.

**Committed and pushed:** commit `f030a5f` — "Cruise: Portrait/Square templates for all 3 slides + list-field (stops) extraction via Gemini". `git status` was clean before staging (only the expected 9 files), confirmed no test artifacts or secrets included.

**Session outcome:** cruise offer type now has full 3-slide/3-size template parity with flight and package, and full screenshot-based extraction including its list field. This is the first type built with a repeatable list field and the first without an origin field — see Section 3.3 and Section 5 for the generalizable lessons that came out of it.

**Next session, in order:**
1. Test cruise PDF (multi-offer catalog) extraction with a real document — not yet verified, though the code path was updated.
2. Deploy to production (Hetzner) — see Section 10. Multiple sessions' worth of changes, including all of cruise, are still not live.
3. After redeploy: quick sanity check that flight/package extraction still behaves correctly in production after the extraction-prompt genericization fix (low risk, but not yet re-verified live).
