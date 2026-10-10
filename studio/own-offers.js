// ============================================================
//  studio/own-offers.js — "Eigene Angebote": the client's own flight
//  and package offers, kept until their expiry date and listed next
//  to the specials offers (each kind stays in its own list).
//  Stored as JSON in cache/ (server volume, never in git).
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BOARD_KEYS } = require('./packages');

const FILE = path.join(__dirname, '..', 'cache', 'studio-own-offers.txt');
const MAX = 50;
const BOARD_DE = { none: 'Nur Übernachtung', breakfast: 'Frühstück', half: 'Halbpension', full: 'Vollpension', all: 'All Inclusive' };

const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max && !/[<>{}]/.test(v);
const iso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const iata = (v) => v === '' || v === undefined || /^[A-Z]{3}$/.test(v);
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const price = (v) => Number(v) > 0 && Number(v) < 100000;
const today = () => new Date().toISOString().slice(0, 10);

function readAll() {
  try { const list = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(list) ? list : []; } catch { return []; }
}
const writeAll = (list) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list)); };

/** Validated input → draft offer shape, or null. Keys: "mf-…" (flight), "mp-…" (package). */
function fromInput(b) {
  const id = crypto.randomBytes(4).toString('hex');
  if (!b || !iso(b.validUntil) || b.validUntil < today() || !price(b.price)) return null;
  if (b.kind === 'flight' && text(b.fromName, 2, 60) && iata(b.fromCode) && text(b.toName, 2, 60) && iata(b.toCode)
    && iso(b.departureDate) && b.departureDate >= today() && (!b.returnDate || (iso(b.returnDate) && b.returnDate >= b.departureDate))) {
    return { kind: 'flight', own: true, key: 'mf-' + id, validUntil: b.validUntil, price: Number(b.price), airline: null,
      from: { name: b.fromName.trim(), code: b.fromCode || '' }, to: { name: b.toName.trim(), code: b.toCode || '' },
      departureDate: b.departureDate, returnDate: b.returnDate || null };
  }
  if (b.kind === 'package' && text(b.hotel, 2, 120) && int(b.stars, 0, 6) && text(b.city, 2, 60) && text(b.country, 2, 60)
    && int(b.nights, 1, 60) && Object.hasOwn(BOARD_KEYS, b.board) && typeof b.withFlight === 'boolean') {
    return { kind: 'package', own: true, key: 'mp-' + id, validUntil: b.validUntil, price: Number(b.price),
      to: { code: '', name: b.city.trim() }, region: '', country: b.country.trim(), hotel: b.hotel.trim(), stars: b.stars,
      nights: b.nights, details: [BOARD_DE[b.board], b.withFlight ? 'inkl. Flug' : ''].filter(Boolean).join(', '), image: null };
  }
  return null;
}

/** Offers that have not expired, optionally of one kind. Expired ones are removed from the file. */
function list(kind) {
  const all = readAll();
  const active = all.filter((o) => o.validUntil >= today());
  if (active.length !== all.length) writeAll(active);
  return kind ? active.filter((o) => o.kind === kind) : active;
}

function add(input) {
  const offer = fromInput(input);
  if (!offer) throw new Error('invalid');
  const all = list();
  if (all.length >= MAX) throw new Error('full');
  writeAll([offer, ...all]);
  return offer;
}

function remove(key) {
  const all = readAll();
  const rest = all.filter((o) => o.key !== key);
  writeAll(rest);
  return rest.length !== all.length;
}

const isOwnKey = (k) => typeof k === 'string' && /^m[fp]-[a-f0-9]{8}$/.test(k);

module.exports = { MAX, fromInput, list, add, remove, isOwnKey };
