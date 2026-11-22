// API pricing: the single price source for fabric coded products.
// Prices come from the same JPOS data that backs the fabric GraphQL API
// (D1 tables api_fabrics and api_fabric_tiers): each fabric carries a tier
// (data/fabric-library.json) and the tier ladder (data/fabric-tiers.json)
// prices each garment kind. Returns null when the fabric's tier has no
// price for the garment kind; callers must not invent a price in that case.
const fs = require('node:fs');
const library = JSON.parse(fs.readFileSync('data/fabric-library.json', 'utf8'));
const ladder = JSON.parse(fs.readFileSync('data/fabric-tiers.json', 'utf8')).tiers;
const tierByCode = new Map(library.fabrics.map((f) => [f.c, f.tier]));
const COLUMN = {
  suit: 'suit',
  shirt: 'dressShirt',
  pants: 'dressPants',
  jacket: 'sportCoat',
  waistcoat: 'vest',
};
function apiPrice(code, kind) {
  const tier = tierByCode.get(code);
  if (tier === undefined || tier === null) return null;
  const row = ladder[String(tier)];
  if (!row) return null;
  const col = COLUMN[kind];
  if (!col) return null;
  const v = row[col];
  return typeof v === 'number' && v > 0 ? v : null;
}
module.exports = { apiPrice };
