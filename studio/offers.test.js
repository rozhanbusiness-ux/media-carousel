// Run: node --test studio/
const test = require('node:test');
const assert = require('node:assert');
const { parseFlightOffers, parsePackageOffers, parseEuro, cheapestPerRoute } = require('./offers');

const flightBox = (from, to, dep, price) =>
  `<a href="?depapt1=${from}&amp;dstapt1=${to}&amp;depdate1=${dep}&amp;retdate1=2026-12-10" class="teaser-flights x">` +
  `<div class="departure">Düsseldorf (${from})</div><div class="destination">Erbil (${to})</div>` +
  `<img aria-label="Pegasus Airlines"><span class="price">ab ${price} €</span></a>`;

test('parses flight offers and keeps the cheapest per route', () => {
  const html = flightBox('DUS', 'EBL', '2026-12-01', '321,50') + flightBox('DUS', 'EBL', '2026-12-02', '299');
  const offers = parseFlightOffers(html);
  assert.equal(offers.length, 2);
  assert.deepEqual(offers[0].from, { name: 'Düsseldorf', code: 'DUS' });
  const best = cheapestPerRoute(offers);
  assert.equal(best.length, 1);
  assert.equal(best[0].price, 299);
});

test('rejects flights with bad codes or dates and injected markup', () => {
  assert.equal(parseFlightOffers(flightBox('du<s', 'EBL', '2026-12-01', '10')).length, 0);
  assert.equal(parseFlightOffers(flightBox('DUS', 'EBL', 'tomorrow', '10')).length, 0);
});

test('parses package offers', () => {
  const html = '<div class="offer-item x" data-city-id="12" data-region-id="34" data-giata-id="56">' +
    '<p>Malta &raquo; Qawra</p><h5><span>Canifor Hotel</span></h5>' +
    '<div class="category"><i class="fa-sun"></i><i class="fa-sun"></i><i class="opacity fa-sun"></i></div>' +
    '<div class="descript">5 Nächte, inkl. Flug</div><button class="offer-item-price">ab 1.275 €</button></div>';
  const [o] = parsePackageOffers(html);
  assert.deepEqual(o.location, ['Malta', 'Qawra']);
  assert.equal(o.stars, 2);
  assert.equal(o.nights, 5);
  assert.equal(o.price, 1275);
});

test('parseEuro', () => {
  assert.equal(parseEuro('1.234,56 €'), 1234.56);
  assert.equal(parseEuro('nothing'), null);
});
