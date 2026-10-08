# Studio templates

Seven flight carousel styles, one per weekday (client decision 2026-10-08). Each file has
3 slides (hook, details, call to action) and 3 sizes (`story` 1080x1920, `portrait`
1080x1350, `square` 1080x1080), chosen by the body classes `{{size}} {{dir}}` and `s{{slide}}`.
All placeholders are HTML-escaped by the renderer. Fonts: `../fonts/fonts.css` (OFL, copied
from the media-travels.com build).

| Weekday   | File                  | Style             |
| --------- | --------------------- | ----------------- |
| Monday    | `flight.html`         | Glass card        |
| Tuesday   | `flight-ticket.html`  | Boarding pass     |
| Wednesday | `flight-split.html`   | Split             |
| Thursday  | `flight-diagonal.html`| Diagonal          |
| Friday    | `flight-postcard.html`| Postcard          |
| Saturday  | `flight-ribbon.html`  | Gold ribbon       |
| Sunday    | `flight-band.html`    | Gold band         |

Rejected by the client: magazine, polaroid, circle lens.
