// ============================================================
//  studio/fe-cities.js — extra departure airports with direct flights
//  to Erbil, added by the client when a new route opens (2026-11-05).
//  Stored in the cache volume; the built-in airports stay in the page.
// ============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cache', 'studio-fe-cities.json');
const MAX = 20;
const valid = (c) => c && /^[A-Z]{3}$/.test(c.code) && typeof c.name === 'string' && c.name.trim().length >= 2 && c.name.length <= 40 && !/[<>{}"]/.test(c.name);

function list() {
  try { const l = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(l) ? l.filter(valid) : []; } catch { return []; }
}
const write = (l) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(l)); };

function add(input) {
  const c = { code: String((input && input.code) || '').trim().toUpperCase(), name: String((input && input.name) || '').trim() };
  if (!valid(c)) throw new Error('invalid');
  const l = list().filter((x) => x.code !== c.code);
  if (l.length >= MAX) throw new Error('full');
  write([...l, c]);
  return c;
}

function remove(code) {
  const l = list();
  write(l.filter((x) => x.code !== code));
  return l.length;
}

module.exports = { list, add, remove, MAX };
