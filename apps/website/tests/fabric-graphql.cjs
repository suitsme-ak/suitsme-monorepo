// Fabric GraphQL API journeys: drive the real lib/fabric-graphql.ts handler
// against a fake D1 seeded with JPOS shaped rows, the same pattern as
// tests/accounts.cjs. Covers the detail lookup (fabric, tier pricing,
// per store inventory), the list filters, pagination, the tiers ladder,
// and the error paths.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), Module = require('node:module');
const path = require('node:path'), file = path.resolve('lib/fabric-graphql.ts'), m = new Module(file, module);
m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file);
const { fabricGraphql, FABRIC_GRAPHQL_SCHEMA } = m.exports;

// Fake D1 for exactly the statement shapes lib/fabric-graphql.ts issues.
function like(value, pattern) {
  if (value === null || value === undefined) return false;
  const rx = new RegExp('^' + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
  return rx.test(String(value));
}
function matchConds(row, conds, args, db) {
  let ai = 0;
  for (const raw of conds) {
    const c = raw.trim();
    if (c === 'stock > 0') { if (!(Number(row.stock) > 0)) return false; continue; }
    if (c.startsWith('(code LIKE')) { const a = args[ai++], b = args[ai++]; if (!(like(row.code, a) || like(row.description, b))) return false; continue; }
    const inMatch = c.match(/^fabric_id IN \(SELECT fabric_id FROM api_fabric_stores WHERE store_id = \?\)$/);
    if (inMatch) { const sid = args[ai++]; if (!db.api_fabric_stores.some(s => s.fabric_id === row.fabric_id && s.store_id === sid)) return false; continue; }
    const eq = c.match(/^(\w+)(?: COLLATE NOCASE)? (=|>=|<=) \?$/);
    if (eq) {
      const v = args[ai++]; let left = row[eq[1]], right = v;
      if (typeof left === 'string' && typeof right === 'string' && c.includes('COLLATE NOCASE')) { left = left.toLowerCase(); right = right.toLowerCase(); }
      if (eq[2] === '=' && left !== right) return false;
      if (eq[2] === '>=' && !(left >= right)) return false;
      if (eq[2] === '<=' && !(left <= right)) return false;
      continue;
    }
    throw Error('Fake DB cannot parse condition: ' + c);
  }
  return true;
}
function sortRows(rows, order) {
  const keys = order.split(',').map(s => s.trim()).map(s => { const [col, dir] = s.split(/\s+/); return { col, desc: dir === 'DESC' }; });
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const av = a[k.col], bv = b[k.col];
      if (av === bv) continue;
      if (av === null || av === undefined) return k.desc ? 1 : -1;
      if (bv === null || bv === undefined) return k.desc ? -1 : 1;
      return (av < bv ? -1 : 1) * (k.desc ? -1 : 1);
    }
    return 0;
  });
}
class DB {
  constructor() {
    this.api_fabrics = [
      { fabric_id: 4786, code: 'CN17300', old_code: '1072-21S50-0815', type: 'SUIT', description: '100% WOOL, INK BLUE TWILL SOLID', mill: 'CIMEXLANA', color: 'NAVY', color_family: null, pattern: 'TWILL SOLID', pattern_category: 'PLAIN', material: null, content: '100% WOOL', weight: 270, season: null, weave: null, occasion: null, image: 'CN17300.jpg', swatch: 1, active: 1, tier: 7, fabric_price: 695, price_cat: null, sale_price: null, stock: 886.1, qty_actual: null, qty_reserved: null, backorder_qty: 400, po_qty: 1000, minimum_qty: 0 },
      { fabric_id: 351, code: 'CB11001', old_code: null, type: 'SUIT', description: '100% WOOL, BLACK MINI HERRINGBONE', mill: null, color: 'BLACK', color_family: null, pattern: 'MINI HERRINGBONE', pattern_category: 'HERRINGBONE', material: null, content: '100% WOOL', weight: 270, season: null, weave: null, occasion: null, image: 'CB11001.jpg', swatch: 1, active: 1, tier: 5, fabric_price: 495, price_cat: null, sale_price: null, stock: 0, qty_actual: 0, qty_reserved: 0, backorder_qty: 0, po_qty: 0, minimum_qty: 0 },
      { fabric_id: 891, code: '30-3051-09', old_code: null, type: 'SHIRTS', description: '100% COTTON, TEAL BLUE STRIPE', mill: null, color: 'BLUE', color_family: 'Blue/Navy', pattern: 'STRIPE', pattern_category: 'STRIPE', material: null, content: '100%COTTON', weight: 162, season: 'ALL SEASON', weave: null, occasion: null, image: '30-3051-09.JPG', swatch: 0, active: 1, tier: 1.8, fabric_price: 175, price_cat: null, sale_price: null, stock: 42, qty_actual: 61.3, qty_reserved: 0, backorder_qty: 0, po_qty: 0, minimum_qty: 0 },
      { fabric_id: 9001, code: 'EN54010', old_code: null, type: 'SUIT', description: 'NAVY HERRINGBONE TWEED', mill: 'KENNETH MACKENZIE', color: 'NAVY', color_family: null, pattern: 'HERRINGBONE', pattern_category: 'HERRINGBONE', material: null, content: '100% WOOL', weight: 290, season: null, weave: null, occasion: null, image: 'EN53207.jpg', swatch: 1, active: 1, tier: 9, fabric_price: 895, price_cat: null, sale_price: null, stock: 12, qty_actual: null, qty_reserved: null, backorder_qty: 0, po_qty: 0, minimum_qty: 0 },
      { fabric_id: 9999, code: 'XX00000', old_code: null, type: 'SUIT', description: 'LEGACY UNTITLED', mill: null, color: null, color_family: null, pattern: null, pattern_category: null, material: null, content: null, weight: null, season: null, weave: null, occasion: null, image: null, swatch: 0, active: 0, tier: 0, fabric_price: null, price_cat: null, sale_price: null, stock: null, qty_actual: null, qty_reserved: null, backorder_qty: null, po_qty: null, minimum_qty: null },
    ];
    this.api_fabric_tiers = [
      { tier: 1.8, sport_coat: null, dress_pants: null, suit: null, suit_vest: null, dress_shirt: 175, vest: null },
      { tier: 5, sport_coat: 335, dress_pants: 165, suit: 495, suit_vest: 660, dress_shirt: null, vest: 165 },
      { tier: 7, sport_coat: 475, dress_pants: 245, suit: 695, suit_vest: 920, dress_shirt: null, vest: 225 },
      { tier: 9, sport_coat: 615, dress_pants: 325, suit: 895, suit_vest: 1180, dress_shirt: null, vest: 285 },
    ];
    this.api_fabric_stores = [
      { fabric_id: 4786, store_id: 2, hanger: 1 },
      { fabric_id: 4786, store_id: 8, hanger: 1 },
      { fabric_id: 4786, store_id: 44, hanger: 3 },
      { fabric_id: 351, store_id: 2, hanger: 1 },
    ];
  }
  prepare(sql) {
    const self = this;
    return { bind(...args) { return {
      async first() { return self.query(sql, args)[0] || null; },
      async all() { return { results: self.query(sql, args) }; },
      async run() { self.query(sql, args); return { success: true }; },
    }; } };
  }
  query(sql, args) {
    let mm;
    if (mm = sql.match(/^SELECT \* FROM api_fabric_tiers ORDER BY tier ASC$/)) return sortRows(this.api_fabric_tiers, 'tier ASC');
    if (mm = sql.match(/^SELECT \* FROM api_fabric_tiers WHERE tier = \?$/)) return this.api_fabric_tiers.filter(r => r.tier === args[0]);
    if (mm = sql.match(/^SELECT store_id, hanger FROM api_fabric_stores WHERE fabric_id = \? ORDER BY store_id$/)) return sortRows(this.api_fabric_stores.filter(r => r.fabric_id === args[0]), 'store_id ASC').map(r => ({ store_id: r.store_id, hanger: r.hanger }));
    if (mm = sql.match(/^SELECT COUNT\(\*\) AS n FROM api_fabrics(?: WHERE (.+))?$/)) {
      const conds = mm[1] ? mm[1].split(' AND ') : [];
      return [{ n: this.api_fabrics.filter(r => matchConds(r, conds, args, this)).length }];
    }
    if (mm = sql.match(/^SELECT \* FROM api_fabrics WHERE (.+?) ORDER BY (.+?) LIMIT \? OFFSET \?$/)) {
      const conds = mm[1].split(' AND '), limit = args[args.length - 2], offset = args[args.length - 1];
      const rows = sortRows(this.api_fabrics.filter(r => matchConds(r, conds, args.slice(0, -2), this)), mm[2]);
      return rows.slice(offset, offset + limit);
    }
    if (mm = sql.match(/^SELECT \* FROM api_fabrics WHERE (.+?) ORDER BY active DESC, fabric_id ASC LIMIT 1$/)) {
      const conds = mm[1].split(' AND ');
      const rows = this.api_fabrics.filter(r => matchConds(r, conds, args, this));
      rows.sort((a, b) => (b.active - a.active) || (a.fabric_id - b.fabric_id));
      return rows.slice(0, 1);
    }
    throw Error('Fake DB cannot run: ' + sql);
  }
}

const db = new DB();
const env = { DB: db };
async function post(query, variables) {
  const res = await fabricGraphql(new Request('https://suits.me/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) }), env);
  return { status: res.status, body: await res.json() };
}

(async () => {
  assert.ok(FABRIC_GRAPHQL_SCHEMA.includes('fabric(code: String!'), 'schema exposes the fabric query');

  // G1: detail lookup returns the fabric, its tier prices and its stores.
  let r = await post('{ fabric(code:"CN17300") { code mill color pricing { tier fabricPrice garments { suit dressPants dressShirt } } inventory { stock backorderQty stores { storeId hanger } } } }');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.fabric.code, 'CN17300');
  assert.equal(r.body.data.fabric.mill, 'CIMEXLANA');
  assert.equal(r.body.data.fabric.pricing.tier, 7);
  assert.equal(r.body.data.fabric.pricing.garments.suit, 695);
  assert.equal(r.body.data.fabric.pricing.garments.dressPants, 245);
  assert.equal(r.body.data.fabric.pricing.garments.dressShirt, null, 'tier 7 has no shirt price, null not invented');
  assert.equal(r.body.data.fabric.inventory.stock, 886.1);
  assert.equal(r.body.data.fabric.inventory.stores.length, 3);
  assert.deepEqual(r.body.data.fabric.inventory.stores[2], { storeId: 44, hanger: 3 });
  console.log('G1 fabric detail with tier pricing and store inventory: ok');

  // G2: a shirt fabric prices through the shirt column only.
  r = await post('{ fabric(code:"30-3051-09") { code pricing { tier garments { suit dressShirt } } } }');
  assert.equal(r.body.data.fabric.pricing.garments.dressShirt, 175);
  assert.equal(r.body.data.fabric.pricing.garments.suit, null);
  console.log('G2 shirt tier pricing: ok');

  // G3: unknown code is a null fabric, not an error.
  r = await post('{ fabric(code:"NOPE404") { code } }');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.fabric, null);
  console.log('G3 unknown code: ok');

  // G4: a tier 0 legacy fabric returns no garment prices.
  r = await post('{ fabric(code:"XX00000") { code active pricing { tier garments { suit } } } }');
  assert.equal(r.body.data.fabric.active, false);
  assert.equal(r.body.data.fabric.pricing.garments.suit, null);
  console.log('G4 tier 0 fabric has no invented prices: ok');

  // G5: variables work.
  r = await post('query($c:String!){ fabric(code:$c) { code } }', { c: 'CB11001' });
  assert.equal(r.body.data.fabric.code, 'CB11001');
  console.log('G5 variables: ok');

  // G6: list defaults to active fabrics only.
  r = await post('{ fabrics { total results { code } } }');
  assert.equal(r.body.data.fabrics.total, 4);
  assert.ok(!r.body.data.fabrics.results.some(f => f.code === 'XX00000'));
  r = await post('{ fabrics(active:false) { total results { code } } }');
  assert.equal(r.body.data.fabrics.total, 1);
  assert.equal(r.body.data.fabrics.results[0].code, 'XX00000');
  console.log('G6 list active default and inactive on request: ok');

  // G7: filters narrow the list.
  r = await post('{ fabrics(type:"SUIT") { total } }');
  assert.equal(r.body.data.fabrics.total, 3);
  r = await post('{ fabrics(color:"navy") { total results { code } } }');
  assert.equal(r.body.data.fabrics.total, 2, 'color match is case insensitive');
  r = await post('{ fabrics(tierMin:7, tierMax:10) { total } }');
  assert.equal(r.body.data.fabrics.total, 2);
  r = await post('{ fabrics(store:44) { total results { code } } }');
  assert.equal(r.body.data.fabrics.total, 1);
  assert.equal(r.body.data.fabrics.results[0].code, 'CN17300');
  r = await post('{ fabrics(inStock:true) { total } }');
  assert.equal(r.body.data.fabrics.total, 3, 'CB11001 has zero stock');
  r = await post('{ fabrics(q:"herringbone") { total } }');
  assert.equal(r.body.data.fabrics.total, 2, 'text search hits descriptions');
  console.log('G7 filters: ok');

  // G8: pagination.
  r = await post('{ fabrics(pageSize:2, page:2) { total page pageSize results { code } } }');
  assert.equal(r.body.data.fabrics.total, 4);
  assert.equal(r.body.data.fabrics.results.length, 2);
  console.log('G8 pagination: ok');

  // G9: the ladder is queryable.
  r = await post('{ tiers { tier suit dressShirt } }');
  assert.equal(r.body.data.tiers.length, 4);
  assert.equal(r.body.data.tiers[1].suit, 495);
  assert.equal(r.body.data.tiers[0].dressShirt, 175);
  console.log('G9 tiers ladder: ok');

  // G10: GET without a query explains the endpoint; GET with a query runs it.
  let res = await fabricGraphql(new Request('https://suits.me/api/graphql'), env);
  assert.equal(res.status, 200);
  let body = await res.json();
  assert.equal(body.service, 'suits.me fabric GraphQL API');
  res = await fabricGraphql(new Request('https://suits.me/api/graphql?query=' + encodeURIComponent('{ fabric(code:"CN17300") { code } }')), env);
  body = await res.json();
  assert.equal(body.data.fabric.code, 'CN17300');
  console.log('G10 GET behavior: ok');

  // G11: error paths.
  res = await fabricGraphql(new Request('https://suits.me/api/graphql', { method: 'POST', body: 'not json' }), env);
  assert.equal(res.status, 400);
  res = await fabricGraphql(new Request('https://suits.me/api/graphql', { method: 'POST', body: JSON.stringify({ query: '{ fabric(code:"CN17300") }' }) }), {});
  assert.equal(res.status, 503, 'no database binding is a 503');
  r = await post('{ fabric(code:"CN17300") { nope } }');
  assert.ok(r.body.errors && r.body.errors.length > 0, 'unknown field is a GraphQL error');
  console.log('G11 error paths: ok');

  // G12: the route file wires the handler.
  const route = fs.readFileSync(path.resolve('app/api/graphql/route.ts'), 'utf8');
  assert.ok(route.includes('fabricGraphql'), 'route delegates to the fabric GraphQL handler');
  console.log('G12 route wiring: ok');

  console.log('fabric-graphql: all journeys passed');
})().catch(e => { console.error(e); process.exit(1); });
