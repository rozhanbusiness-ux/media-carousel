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
- templates - map: each size -> array of template filenames (one slide, or a pair for multi-slide types)
- fields - object: each field key -> { label (German), type ('text'|'date'|'select'), required, maxLen, default, manual (optional, true = never extracted, user fills by hand), options (for type:'select') }
- buildBackgroundPrompt(subject, orientationText) - function returning the Gemini image-generation prompt text

**To add a new offer type in the future:** add ONE new record here + build its HTML template file(s). Nothing else in the architecture needs to change - the frontend (public/index.html) dynamically builds its input fields from whatever registry entry is selected, and the server reads the templates map generically. This pattern has been proven twice (flight, then package) with zero architectural changes needed for the second type.

### Data flow

1. User picks an Offer Type from a dropdown (populated live from GET /api/offer-types)
2. Frontend fetches that type's field definitions (GET /api/offer-types/:id) and dynamically builds input fields (text/date-picker/dropdown as defined)
3. User either fills fields manually, OR uploads a screenshot (POST /api/extract, one offer per image) OR a PDF (POST /api/extract-pdf, extracts ALL offers found in the document, one card each)
4. User can hold multiple "offer cards" at once (a mini-carousel in progress), each with independently-tracked fields + background + city-toggle state
5. Per offer, user clicks "Hintergrundbild generieren" - background image generated ONCE at story (9:16) ratio and shared/cropped across all selected sizes (saves cost, ensures visual consistency)
6. Preview shows the selected size/slide; a "Folie: 1/2" toggle switches between paired slides for multi-slide types (currently only package)
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

### 3.3 Shared extraction system

- src/extract-offer.js exports extractFromImage() (single offer, field-guided prompt built from the active type's field list - doubles as extraction target list) and extractFromPdf() (multi-offer array extraction, same field-guided approach, instructs Gemini to find EVERY offer in a multi-offer PDF document and return a JSON array)
- **Field-guided extraction principle (Rozhan's own idea, proven twice):** instead of asking the AI to freely parse an unknown layout, give it the exact field list (with German labels + example values) and ask it to find each field's value specifically. Works reliably across wildly different source layouts (5-15+ variants exist across suppliers) because the fields are the stable anchor, not the layout.
- **Date rule:** travel dates are ALWAYS future - if extracted month >= current month, use current year, else next year. Output DD.MM.YYYY.
- **Missing field rule:** empty string, NEVER guess.
- **Price rule:** copy numeric value exactly as shown including decimals, Rozhan adjusts manually.
- Colored-box hint: if the source screenshot has values highlighted in a colored box (Rozhan's own technique), prefer that value.
- Tested successfully on 2 real supplier PDFs (12-offer and 9-offer catalogs, different layouts) - extraction accuracy was excellent both times.

---

## 4. Fixed Visual Identity (NEVER changes)

- **Colors:** deep navy #0F2359 / #0a1838, gold #C9A227 / #E6C25A, white #FFFFFF
- **Fonts:** Playfair Display (titles), DM Serif Display (ALL numbers/values/prices - unified project-wide on 2026-07-17; the old Anton/Archivo Black bold price fonts on flight templates were removed and replaced, confirmed to still look good with the gold outline effect)
- **Logo:** real file templates/logo.png, always embedded as a data-URI at render time (never faked, never CSS-drawn)
- **Footer:** thin gold line + phone icon + email icon, fixed on every slide, present in every template
- **Backgrounds:** always AI-generated aerial city panoramas - never resort/beach imagery, even for package holidays. Sky capped at top for logo legibility. Composition rule embedded in every prompt: keep key visual interest in the upper-middle vertical band so the image survives cropping to other aspect ratios from the same generated source image.
- **Background sharing:** ONE generation at story (9:16) ratio is reused/cropped for square and portrait outputs of the same offer - never regenerated per size (cost + consistency).

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

---

## 6. Workflow / How We Work Together

- **Chat language:** switches between Arabic and German per Rozhan's request (German since 2026-07-16 for his language practice - small natural corrections are welcome but not forced). Code, comments, identifiers: always English. App UI and all rendered output text: always German only.
- **Small verified steps, always.** Never offer "do everything at once" as an equal alternative - guide toward incremental steps, verify each works before proceeding to the next.
- **Verify file state before editing** - cat/grep the actual current file content, never assume a previous edit succeeded without confirming its output.
- **Exact copy-pasteable terminal commands** - Rozhan pastes commands himself in the Codespaces terminal.
- **Before any git add/commit:** always run git status first, inspect the file list together, exclude test artifacts, confirm no secrets.
- **Commit frequently at clean checkpoints** - commit/push right after each verified, working feature.
- **Session-end rule (mandatory):** at the end of every successful working session, write a detailed session summary to Claude's memory (and keep this file updated too).
- **Light German correction:** when Rozhan makes small German grammar/spelling mistakes in chat, offer gentle natural corrections without making it a big deal.

---

## 7. Current State (as of last update)

- **Last commit:** e78c7c0 - "Full-carousel batch background generation: two buttons (missing-only / force-all), sequential progress" - "Package square (1080x1080) pair added; details rows left/right margin increased across all 3 sizes; fade-line fix for row dividers"
- **Repo status:** clean, fully synced with origin/main on GitHub (rozhanbusiness-ux/media-carousel)
- **Both offer types (flight, package) are fully functional end-to-end**, with full 3-size parity (story/square/portrait), both extraction paths (screenshot + PDF), dynamic field UI, multi-offer card management, background sharing across sizes, and batch export.

---

## 8. Roadmap Status

**COMPLETED 2026-07-19: Full-carousel batch background generation.** Two buttons added: "Alle generieren" (only generates for offer cards missing a background) and "Alle neu generieren" (force-regenerates ALL cards regardless of existing background). Both run sequentially through all offer cards with progress feedback ("Generiere Hintergrundbild N von M..."), reusing the per-offer-index busy-tracking (`generatingOffers` Set) and writing results directly into `offers[idx]` established in earlier sessions. Refactored the original single-offer generation handler into a shared `generateOfferBackground(idx)` function to avoid duplicating the fetch/error logic. Verified working end-to-end with 3 offer cards. Git commit `e78c7c0`.

**This closes the entire original project roadmap** (both offer types at full 3-size parity + both extraction paths + multi-offer + batch generation). Next up per Rozhan's 2026-07-19 priority order:

1. **Deploy the app to Rozhan's own server** for daily production use (see Section 9 deployment considerations) — NEXT IMMEDIATE STEP.
2. **Additional offer types** - hotels (standalone, not part of a package), visa services, river cruises, sea cruises. Each is purely a new src/offer-types.js registry entry (fields + background prompt + templates map for the 3 sizes) plus building the actual HTML template file(s) for its slide(s). No other architectural changes are expected to be needed, per the twice-proven registry pattern.
3. (Longer-term, from original vision) Full 10-slide carousel generation in one operation, matching the original "Carousel Constitution" structure Rozhan specified early on: hook (his own Canva asset) -> repeating hotel/details or offer pairs -> CTA (his own Canva asset). The app currently produces only the repeating data-heavy middle slides, by design.

---

## 9. Long-Term Vision (future phases, not started, no urgency)

Order of near-term work (Rozhan's explicit priority, 2026-07 planning session):
1. Finish full-carousel batch generation (current active work)
2. Deploy the app to Rozhan's own server for daily production use — deployment considerations noted below
3. THEN, without rushing: additional offer types in this priority order:
   - River cruises (Flusskreuzfahrten)
   - Sea cruises (Seekreuzfahrten)
   - Hotels / vacation homes (Ferienhäuser) — Rozhan is considering merging these into ONE offer type (an "accommodation type" field distinguishing hotel vs. vacation home) rather than two separate types, since their data shape is very similar. Decide this properly when we get there, not now.
   - Visa services (Visa)

### Deployment considerations (for when we deploy to Rozhan's server — not addressed yet)
- **Secrets:** GEMINI_API_KEY currently lives in local `.env`. A real server needs a secure env var mechanism, and the app currently has NO login/auth system at all — needs consideration before public/always-on deployment.
- **Storage:** exported PNGs currently accumulate in `output/` locally with no cleanup. A daily-use server needs either periodic cleanup or proper storage (not just an ever-growing local folder).
- **Stability:** current server has no auto-restart-on-crash or error monitoring. Daily production use benefits from a basic process manager (e.g. pm2) or platform-level restart policy.

### Big future feature ideas (Rozhan's vision, explicitly flagged as "much later, no rush")
1. **Direct social media publishing integration** — auto-post generated carousels directly to platforms. NOTE: this requires each platform's official app registration + security review (Meta Graph API app review, etc.) — an administrative/approval process outside pure coding, not just an engineering task. Discuss in detail when we get there.
2. **Post scheduling** — schedule carousels to publish at specific future times.
3. **Additional regular post types** — general informational/educational content posts (not tied to travel offers), i.e. full standalone content pieces.
4. **Reels/Shorts generation** — via integration with external video platforms (Rozhan mentioned higgsfield as an example).
5. **Additional platforms** — e.g. LinkedIn, beyond the current Instagram/Facebook/TikTok-shared-size approach.
6. **AI content-writing platform** — the biggest, most transformative idea: evolving the app from "data-driven image generator" into an AI tool that WRITES marketing copy/posts. This is architecturally a much bigger shift than adding an offer type (moves from templated-data-rendering into generative-content-writing) and deserves a dedicated architecture discussion whenever Rozhan wants to pursue it — not a simple registry addition like offer types are.
