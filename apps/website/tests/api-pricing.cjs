// API pricing journeys: every fabric coded product in the built catalog
// must carry exactly the price the fabric API serves for it, the tier
// ladder price for its garment kind, recomputed here independently from
// data/fabric-library.json (fabric tier) and data/fabric-tiers.json (the
// ladder). No coded product may keep a snapshot or formula price, and a
// fabric whose tier has no price for its kind must not appear at all.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
const catalog = read('data/catalog.json');
const lib = read('lib/catalog.json');
const library = read('data/fabric-library.json');
const ladder = read('data/fabric-tiers.json').tiers;
const merchant = read('data/merchant-fabrics.json').fabrics;

const tierByCode = new Map(library.fabrics.map((f) => [f.c, f.tier]));
const COLUMN = { suit: 'suit', shirt: 'dressShirt', pants: 'dressPants', jacket: 'sportCoat', waistcoat: 'vest' };
function expectedPrice(code, kind) {
  const tier = tierByCode.get(code);
  if (tier === undefined || tier === null) return null;
  const row = ladder[String(tier)];
  if (!row || !COLUMN[kind]) return null;
  const v = row[COLUMN[kind]];
  return typeof v === 'number' && v > 0 ? v : null;
}

const products = Array.isArray(catalog) ? catalog : catalog.products;
const coded = products.filter((p) => p.fabricCode);
assert.ok(coded.length > 400, 'catalog still carries its fabric coded products, got ' + coded.length);
for (const p of coded) {
  const expected = expectedPrice(p.fabricCode, p.kind);
  assert.notEqual(expected, null, p.sku + ' (' + p.fabricCode + ') is listed but its tier has no ' + p.kind + ' price');
  assert.equal(p.price, expected, p.sku + ' price must be the API tier price');
}
console.log('P1 every coded product priced from the tier ladder: ok (' + coded.length + ' products)');

// Spot checks against known JPOS records.
const bySku = new Map(products.map((p) => [p.sku, p]));
assert.equal(bySku.get('SM-FAB-SUIT-CB11001').price, 495, 'CB11001 is tier 5, suit 495');
assert.equal(bySku.get('SM-FAB-SHIRT-30-3082-23').price, 175, '30-3082-23 is tier 1.8, shirt 175');
const cn17300 = products.find((p) => p.fabricCode === 'CN17300' && p.kind === 'pants');
assert.equal(cn17300.price, 245, 'CN17300 trousers are tier 7 dress pants, 245');
console.log('P2 known fabric prices: ok');

// EG23537 sits on tier 34, which has no ladder row: it must not be listed.
assert.ok(!products.some((p) => p.fabricCode === 'EG23537'), 'EG23537 has no tier price and is not listed');
console.log('P3 unpriceable fabric absent: ok');

// Every merchant fabric with a ladder price has its product; none without.
for (const f of merchant) {
  const has = products.some((p) => p.fabricCode === f.fabric_code && p.merchantFabric);
  assert.equal(has, expectedPrice(f.fabric_code, f.kind) !== null, 'merchant fabric ' + f.fabric_code + ' listing matches its price availability');
}
console.log('P4 merchant listings match price availability: ok');

// The server side catalog (checkout totals) carries the same prices.
const libById = new Map(lib.map((p) => [p.id, p]));
for (const sku of ['SM-FAB-SUIT-CB11001', 'SM-FAB-SHIRT-30-3082-23']) {
  const p = bySku.get(sku);
  assert.equal(libById.get(p.id).priceCents, p.price * 100, sku + ' server price matches');
}
console.log('P5 server catalog prices match: ok');

console.log('api-pricing: all journeys passed');
