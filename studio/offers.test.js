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

test('parsePackageBox reads specials package offer boxes', () => {
  const { parsePackageBox } = require('./offers');
  const a = (giata, stars, price) => `<a class="teaser-small preload" href="?action=dates&amp;agent=993036&amp;product=package&amp;regionId=133&amp;giataId=${giata}" target="_top">
<div class="img" style="position:relative; background-image: url('https://media.traffics-switch.de/service/imgdata?uid=602&amp;iid=1')"></div> <div class="content">
<div class="header"><div class="hotel-title">THB Felip</div><div class="category">${'<i class="fa fa-star"></i>'.repeat(stars)}<span style="opacity: .6;"><i class="fa fa-star-o"></i></span></div></div>
<p style="line-height: 160%;"><strong>Porto Cristo</strong> - Mallorca - Spanien<br/>Doppelzimmer, Halbpension<br />8 Tage (7 Nächte), inkl. Flug</p> <div class="price">p.P. ab <span>${price} €</span></div></div></a>`;
  const out = parsePackageBox(`<body>${a(3506, 4, 362)}${a('x', 4, 1)}</body>`);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].location, ['Spanien', 'Mallorca', 'Porto Cristo']);
  assert.strictEqual(out[0].stars, 4);
  assert.strictEqual(out[0].nights, 7);
  assert.strictEqual(out[0].price, 362);
  assert.strictEqual(out[0].giataId, '3506');
  assert.match(out[0].image, /^https:\/\/media\.traffics-switch\.de\//);
});
