const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), Module = require('node:module'), crypto = require('node:crypto');
const path = require('node:path');
// Journey J-M5 (measurements wave, package M5): the size guide is
// rebuilt per garment from the shared schema and the ready
// (standard size) sets are aligned to the benchmark's published
// sets (owner decision O3: jackets 36 to 62, trousers 30 to 60).
// From each garment's customizer the shopper opens the guide,
// switches units, and finds the guide offering exactly the sizes
// the ready selects offer, with body and finished garment columns
// told apart and the adopted published finished values (O2) at
// the sizes that carry them. Validation parity holds for the new
// bounds on every surface (client schema, account profiles,
// checkout), and version 1 ready profiles keep validating against
// the sets in force when they were saved (LEGACY_READY_SIZE_SETS),
// so a saved profile carrying a formerly offered size (a jacket
// 30 to 34, a trouser 28 or 62 to 64) still loads, syncs and
// orders with its sizes verbatim. Driven on the real storefront
// scripts in a Node vm with stubbed DOM and storage, plus the
// real account and checkout modules, in the style of the other
// suites.

function makeEl() { const el = { innerHTML: '', textContent: '', value: '', checked: false, open: false, style: {}, attrs: {}, classList: { add() {}, remove() {}, toggle() { return false } }, setAttribute(k, v) { el.attrs[k] = String(v) }, removeAttribute(k) { delete el.attrs[k] }, getAttribute(k) { return k in el.attrs ? el.attrs[k] : null }, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }), showModal() { el.open = true }, close() { el.open = false }, scrollIntoView() {} }; return el }
function makeWorld(seed = {}) {
  const store = new Map();
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  if (seed.profiles) localStorage.setItem('suits-profiles', JSON.stringify(seed.profiles));
  const elements = new Map();
  const elFor = s => { if (!elements.has(s)) elements.set(s, makeEl()); return elements.get(s) };
  const documentStub = { title: '', querySelector: s => elFor(s), querySelectorAll: () => [], getElementById: id => elFor('#' + id), addEventListener() {}, createElement: () => makeEl(), body: makeEl() };
  class FakeFormData { constructor(form) { this.data = (form && form.__data) || {} } get(k) { return k in this.data ? this.data[k] : null } }
  const sandbox = { console, localStorage, document: documentStub, location: { hash: '#home' }, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto, fetch: () => Promise.resolve({ ok: false, json: async () => null }), FormData: FakeFormData, fabricBackground: () => 'background:#999;background-image:linear-gradient(#999,#888);', addEventListener() {}, scrollTo() {} };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of ['measurement-schema.js', 'app.js', 'complete.js', 'catalog-data.js', 'expanded.js', 'gallery.js', 'quick-add.js']) vm.runInContext(fs.readFileSync('public/' + f, 'utf8'), ctx, { filename: f });
  const run = s => vm.runInContext(s, ctx);
  const bag = () => JSON.parse(store.get('suits-bag') || '[]');
  return { run, elFor, store, bag };
}
const JACKETS = Array.from({ length: 14 }, (_, i) => 36 + i * 2), TROUSERS = Array.from({ length: 16 }, (_, i) => 30 + i * 2);
const guideRegion = html => { const i = html.indexOf('id="sizeGuide"'); assert.ok(i >= 0, 'guide region must be present in the markup'); return html.slice(i) };
const section = (region, name) => { const i = region.indexOf('<h3>' + name + '</h3>'); assert.ok(i >= 0, 'guide must have a ' + name + ' section'); const rest = region.slice(i); const j = rest.indexOf('<h3>', 1); return j < 0 ? rest : rest.slice(0, j) };
const rowSizes = html => [...html.matchAll(/<tr><td>(\d+)<\/td>/g)].map(m => Number(m[1]));
const selectOptions = (html, label) => { const i = html.indexOf('aria-label="' + label + '"'); assert.ok(i >= 0, 'the sizes step has a ' + label + ' select'); const block = html.slice(i, html.indexOf('</select>', i)); return [...block.matchAll(/<option[^>]*>(\d+)<\/option>/g)].map(m => Number(m[1])) };
// Enters a product's ready flow from its customizer and returns
// the sizes step markup with the guide opened.
function openGuideAtSizes(w, idx) {
  w.run(`chooseProduct(${idx})`); w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); w.run('nextConfig()');
  w.run("setCustomizerMethod('ready')");
  w.run('startMeasurements()');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'the Studio reaches the sizes step');
  const sizes = w.run('measure()');
  w.run('toggleSizeGuide()');
  return { sizes, guide: guideRegion(w.run('measure()')) };
}

// ---------------------------------------------------------------- J-M5 (client)
// The guide from each garment's customizer: per garment tables,
// the offered sizes matching the ready selects, and the unit
// switch converting by the one rule.
{
  // Suit: the legacy ready flow, both tables, selects and guide
  // offering the same aligned sets.
  const w = makeWorld();
  const { sizes, guide } = openGuideAtSizes(w, 0);
  assert.deepEqual(selectOptions(sizes, 'Jacket size'), JACKETS, 'the suit jacket select offers exactly the aligned set');
  assert.deepEqual(selectOptions(sizes, 'Trouser size'), TROUSERS, 'the suit trouser select offers exactly the aligned set');
  assert.deepEqual(rowSizes(section(guide, 'Jackets')), JACKETS, 'the guide jacket table lists the same sizes as the select');
  assert.deepEqual(rowSizes(section(guide, 'Trousers')), TROUSERS, 'the guide trouser table lists the same sizes as the select');
  assert.ok(section(guide, 'Jackets').includes('<tr><td>40</td><td>40</td><td>43</td><td>18</td><td>40.5</td><td>24.5</td><td>29.5</td></tr>'), 'jacket 40 shows its body chest and the adopted finished values');
  w.run("changeUnit('cm')");
  const cmGuide = guideRegion(w.run('measure()'));
  assert.ok(section(cmGuide, 'Jackets').includes('<td>101.6</td><td>109.2</td>'), 'in cm the guide converts by the one rule: body chest 101.6, finished chest 109.2');
  w.run("changeUnit('in')");

  // Jacket: its own table only.
  const wj = makeWorld();
  const j = openGuideAtSizes(wj, 6);
  assert.ok(j.guide.includes('<h3>Jackets</h3>') && !j.guide.includes('<h3>Trousers</h3>'), 'the jacket guide shows the jackets table only');
  assert.deepEqual(selectOptions(j.sizes, 'Jacket size'), JACKETS, 'the jacket select offers the aligned set');

  // Trousers: the garment ready flow; the trousers table only,
  // and the guide sizes match the trouser select.
  const wp = makeWorld();
  const p = openGuideAtSizes(wp, 9);
  assert.deepEqual(selectOptions(p.sizes, 'Trouser size (US)'), TROUSERS, 'the trousers select offers exactly the aligned set');
  assert.deepEqual(selectOptions(p.sizes, 'Inseam'), [28, 30, 32, 34, 36, 38, 40], 'the inseam choices are unchanged (owner decision O8)');
  assert.ok(p.guide.includes('<h3>Trousers</h3>') && !p.guide.includes('<h3>Jackets</h3>'), 'the trousers guide shows the trousers table only');
  assert.deepEqual(rowSizes(section(p.guide, 'Trousers')), TROUSERS, 'the trousers guide lists the same sizes as the select');
  assert.ok(section(p.guide, 'Trousers').includes('<tr><td>52</td><td>52</td><td>54.5</td><td>62</td><td>36</td><td>19</td><td>14</td></tr>'), 'trouser 52 shows the chart finished waist rule above 46 (plus 2.5) and its published values');

  // Waistcoat: the garment ready flow; its select and guide run
  // over the jacket set, and every finished chest is present (the
  // published size plus 3.5 rule), with no invented columns.
  const ww = makeWorld();
  const wc = openGuideAtSizes(ww, 8);
  assert.deepEqual(selectOptions(wc.sizes, 'Waistcoat size (US)'), JACKETS, 'the waistcoat select offers the jacket size set, now aligned 36 to 62');
  const wcSection = section(wc.guide, 'Waistcoats');
  assert.deepEqual(rowSizes(wcSection), JACKETS, 'the waistcoat guide lists the same sizes as its select');
  assert.ok(wcSection.includes('<tr><td>40</td><td>43.5</td></tr>'), 'waistcoat 40: finished chest is the size plus the published 3.5');
  assert.ok(!wcSection.includes('<td></td>'), 'the waistcoat finished chest is published for every size, so no cell is blank');
  assert.ok(!wcSection.includes('Finished stomach') && !wcSection.includes('Finished length'), 'the waistcoat guide invents no stomach or length column');

  // Shirt: the shirt table with the letter ladder and the one
  // published finished row.
  const ws = makeWorld();
  const s = openGuideAtSizes(ws, 12);
  const shirtSection = section(s.guide, 'Shirts');
  assert.ok(shirtSection.includes('S (36) to 5XL (50)'), 'the shirt guide states the published letter ladder');
  assert.ok(shirtSection.includes('<tr><td>L (40)</td><td>19</td><td>29</td><td>25</td><td>47</td><td>46</td></tr>'), 'the shirt guide lists the one published finished row, L (40)');
  assert.ok(!shirtSection.includes('<h3>Jackets</h3>') && !shirtSection.includes('Body waist'), 'the shirt guide shows no men jacket or trouser table');

  // Women: her bust band table, with the finished bust column.
  const wom = makeWorld();
  const widx = wom.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  const wg = openGuideAtSizes(wom, widx);
  const womenSection = section(wg.guide, "Women's sizes");
  assert.ok(womenSection.includes('<tr><td>40</td><td>XL</td><td>39 to 40</td><td>44</td></tr>'), 'women 40 (XL): bust band 39 to 40 and finished bust 44 (size plus 4)');
  assert.ok(!womenSection.includes('Body chest') && !womenSection.includes('Body waist'), 'the men tables are not presented as applying to her');

  // Boys: the age ladder and the one published body value.
  const wb = makeWorld();
  const bidx = wb.run("products.findIndex(p=>p.silhouette==='Boys two-piece'&&p.kind==='suit')");
  assert.ok(bidx >= 0, 'the catalog holds a Boys suit');
  const bg = openGuideAtSizes(wb, bidx);
  const boysSection = section(bg.guide, "Boys' sizes");
  assert.ok(boysSection.includes('12 months') && boysSection.includes('10 years'), 'the boys guide lists the published age ladder');
  assert.ok(boysSection.includes('pants waist measures 26 to 28 in'), 'the boys guide carries the one published body value, the age 8 pants waist range');
  console.log('J-M5 (client) passed: from each garment customizer the guide opens on the sizes step, offers exactly the sizes its ready selects offer (jackets and waistcoats 36 to 62, trousers 30 to 60), states body and finished columns, converts units by the one rule, and gives women and boys their own tables.');
}

// ---------------------------------------------------------------- J-M5 (server)
// Validation parity for the aligned bounds across the client
// schema, account profiles and checkout, and the legacy rule for
// version 1 ready profiles.
function loadLib(rel) { const file = path.resolve(rel), m = new Module(file, module); m.filename = file; m.paths = module.paths; m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file); return m.exports }
class CommerceDB { constructor() { this.rows = []; this.sessions = []; this.users = [] } prepare(sql) { const self = this; return { bind(...args) { return { async first() { if (sql.includes('FROM sessions')) return self.sessions.find(r => r.token_hash === args[0]) || null; if (sql.includes('FROM users')) return self.users.find(r => r.id === args[0]) || null; if (sql.includes('owner=? AND idempotency_key=?')) return self.rows.find(r => r.owner === args[0] && r.idempotency_key === args[1]) || null; if (sql.includes('id=? AND owner=?')) return self.rows.find(r => r.id === args[0] && r.owner === args[1]) || null; return self.rows.find(r => r.id === args[0]) || null }, async run() { if (sql.startsWith('INSERT')) { const keys = ['id', 'owner', 'idempotency_key', 'items', 'shipping', 'subtotal_cents', 'shipping_cents', 'tax_cents', 'total_cents', 'status', 'created_at']; self.rows.push(Object.fromEntries(keys.map((k, i) => [k, args[i]]))) } if (sql.startsWith('DELETE')) { self.rows = self.rows.filter(r => !(r.id === args[0] && r.owner === args[1])) } if (sql.startsWith('UPDATE')) { const row = self.rows.find(r => r.id === args[1] && r.status === 'pending'); if (row) { row.status = 'paid'; row.transaction_id = args[0] } } return { success: true } } } } } } }
function matchWhere(row, where, args) { if (!where) return true; let ai = 0; return where.split(' AND ').every(cond => { const c = cond.trim().match(/^(\w+)(=|<>)(\?|NULL)$/); if (!c) throw Error('Fake DB cannot parse condition: ' + cond); if (c[3] === 'NULL') return c[2] === '=' ? (row[c[1]] === null || row[c[1]] === undefined) : !(row[c[1]] === null || row[c[1]] === undefined); const v = args[ai++]; return c[2] === '=' ? row[c[1]] === v : row[c[1]] !== v; }); }
class AccountDB {
  constructor() { this.users = []; this.user_credentials = []; this.user_identities = []; this.sessions = []; this.auth_tokens = []; this.auth_attempts = []; this.account_profiles = []; this.account_order_snapshots = []; this.store_orders = []; }
  prepare(sql) { const self = this; return { bind(...args) { return { async first() { return self.query(sql, args)[0] || null; }, async all() { return { results: self.query(sql, args) }; }, async run() { self.query(sql, args); return { success: true }; } } } }; }
  query(sql, args) {
    let m;
    if (m = sql.match(/^SELECT \* FROM (\w+)(?: WHERE (.+))?$/)) return this[m[1]].filter(r => matchWhere(r, m[2], args));
    if (m = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/)) { const cols = m[2].split(','), vals = m[3].split(','), row = {}; let ai = 0; cols.forEach((c, i) => { row[c] = vals[i].trim() === '?' ? args[ai++] : vals[i].trim() === 'NULL' ? null : vals[i].trim(); }); this[m[1]].push(row); return [row]; }
    if (m = sql.match(/^UPDATE (\w+) SET (.+) WHERE (.+)$/)) { const sets = m[2].split(',').map(s => s.trim()), rows = this[m[1]].filter(r => matchWhere(r, m[3], args.slice(sets.length))); for (const r of rows) sets.forEach((s, i) => { r[s.split('=')[0]] = args[i]; }); return rows; }
    if (m = sql.match(/^DELETE FROM (\w+) WHERE (.+)$/)) { const kept = this[m[1]].filter(r => !matchWhere(r, m[2], args)); this[m[1]] = kept; return []; }
    throw Error('Fake DB cannot run: ' + sql);
  }
}
(async () => {
  const { commerce } = loadLib('lib/commerce.ts');
  const { accounts, SESSION_COOKIE } = loadLib('lib/accounts.ts');
  const EMAIL = { EMAIL_API_URL: 'https://mail.example/send', EMAIL_API_KEY: 'test-mail-key', EMAIL_FROM: 'Suits.me <accounts@example.com>' };
  global.fetch = async (url, init) => { if (url === EMAIL.EMAIL_API_URL) return Response.json({ ok: true }); if (String(url).includes('authorize.net')) { const data = JSON.parse(init.body); if (data.getHostedPaymentPageRequest) return Response.json({ messages: { resultCode: 'Ok' }, token: 'mock-hosted-token' }); } throw Error('Unexpected network request: ' + url) };
  const sctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync('public/measurement-schema.js', 'utf8'), sctx, { filename: 'measurement-schema.js' });
  const clientValidate = profile => vm.runInContext('validateProfile', sctx)(JSON.parse(JSON.stringify(profile)), undefined).ok;
  const clientValidateFor = (profile, kind) => vm.runInContext('validateProfile', sctx)(JSON.parse(JSON.stringify(profile)), kind).ok;
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const DAY = 24 * 60 * 60 * 1000, iso = ms => new Date(Date.now() + ms).toISOString();
  const adb = new AccountDB();
  adb.users.push({ id: 'U0123456789abcdef0123456789abcdef', email: 'jm5@example.com', display_name: 'J-M5', email_verified_at: iso(-DAY), created_at: iso(-DAY), updated_at: iso(-DAY), deleted_at: null });
  adb.sessions.push({ token_hash: hash('jm5-session-token'), user_id: 'U0123456789abcdef0123456789abcdef', created_at: iso(-DAY), last_seen_at: iso(0), expires_at: iso(29 * DAY) });
  const aenv = { DB: adb, ...EMAIL };
  const acookie = SESSION_COOKIE + '=jm5-session-token';
  const areq = (route, { method = 'GET', cookie, body } = {}) => new Request('https://shop.example' + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method === 'POST' ? { Origin: 'https://shop.example' } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const cdb = new CommerceDB();
  const cenv = { ANET_API_LOGIN_ID: 'test-login', ANET_TRANSACTION_KEY: 'test-transaction-key', ANET_SIGNATURE_KEY: 'AB'.repeat(64), DB: cdb };
  const shipping = { email: 'tester@example.com', firstName: 'Test', lastName: 'Customer', address: '1 Test Street', city: 'New York', state: 'NY', zip: '10017', country: 'US' };
  const catalog = require('../lib/catalog.json');
  const productIndex = {}; for (const kind of ['suit', 'pants', 'waistcoat']) { productIndex[kind] = catalog.findIndex(p => p.kind === kind); assert.ok(productIndex[kind] >= 0, 'the catalog has a ' + kind + ' product') }
  let attempt = 0;
  async function parity(label, profile, kind, want) {
    const client = clientValidateFor(profile, kind);
    const aRes = await accounts(areq('/api/account/profiles', { method: 'POST', cookie: acookie, body: { profile: { ...profile, id: 'jm5-a-' + (++attempt) } } }), aenv);
    const cRes = await commerce(new Request('https://shop.example/api/checkout', { method: 'POST', headers: { Origin: 'https://shop.example', 'oai-authenticated-user-id': 'owner-jm5', 'Idempotency-Key': 'jm5-attempt-' + String(++attempt).padStart(8, '0'), 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product: productIndex[kind], profile }], shipping }) }), cenv);
    assert.equal(client, want, label + ': the client validator ' + (want ? 'accepts' : 'refuses'));
    assert.equal(aRes.status === 200, want, label + ': the account validator ' + (want ? 'accepts' : 'refuses'));
    assert.equal(cRes.status === 200, want, label + ': the checkout validator ' + (want ? 'accepts' : 'refuses'));
    return cRes;
  }
  const v2Suit = ready => ({ version: 2, method: 'ready', garment: 'suit', wearer: 'Men', name: 'J-M5 ready', unit: 'in', ready });

  // The aligned bounds, enforced identically everywhere for new
  // (version 2) profiles.
  await parity('version 2 suit ready at the aligned lower bounds', v2Suit({ jacket: '36', length: 'Regular', trouser: '30' }), 'suit', true);
  await parity('version 2 suit ready at the aligned upper bounds', v2Suit({ jacket: '62', length: 'Long', trouser: '60' }), 'suit', true);
  await parity('version 2 suit ready with a jacket below the aligned set', v2Suit({ jacket: '34', length: 'Regular', trouser: '34' }), 'suit', false);
  await parity('version 2 suit ready with a trouser above the aligned set', v2Suit({ jacket: '40', length: 'Regular', trouser: '62' }), 'suit', false);
  await parity('version 2 trousers ready at the aligned lower bound', { version: 2, method: 'ready', garment: 'pants', wearer: 'Men', name: 'J-M5 ready', unit: 'in', ready: { trouser: '30', inseam: 'Unhemmed' } }, 'pants', true);
  await parity('version 2 trousers ready with a trouser below the aligned set', { version: 2, method: 'ready', garment: 'pants', wearer: 'Men', name: 'J-M5 ready', unit: 'in', ready: { trouser: '28', inseam: 'Unhemmed' } }, 'pants', false);
  await parity('version 2 waistcoat ready at the aligned lower bound', { version: 2, method: 'ready', garment: 'waistcoat', wearer: 'Men', name: 'J-M5 ready', unit: 'in', ready: { waistcoat: '36' } }, 'waistcoat', true);
  await parity('version 2 waistcoat ready below the aligned set', { version: 2, method: 'ready', garment: 'waistcoat', wearer: 'Men', name: 'J-M5 ready', unit: 'in', ready: { waistcoat: '34' } }, 'waistcoat', false);

  // Version 1 ready profiles are historical: they validate
  // against the sets in force when they were saved, so formerly
  // offered sizes keep loading, syncing and ordering verbatim,
  // while a size that was never offered stays refused.
  const v1 = ready => ({ method: 'ready', wearer: 'Men', name: 'J-M5 legacy ready', unit: 'in', fit: 'Tailored', ready });
  await parity('version 1 ready with formerly offered sizes', v1({ jacket: '32', length: 'Regular', trouser: '64' }), 'suit', true);
  await parity('version 1 ready at the legacy extremes', v1({ jacket: '30', length: 'Short', trouser: '28' }), 'suit', true);
  await parity('version 1 ready with aligned sizes still validates', v1({ jacket: '40', length: 'Regular', trouser: '34' }), 'suit', true);
  await parity('version 1 ready with a size never offered', v1({ jacket: '28', length: 'Regular', trouser: '34' }), 'suit', false);
  await parity('version 1 ready with a trouser never offered', v1({ jacket: '40', length: 'Regular', trouser: '66' }), 'suit', false);
  {
    await parity('version 1 ready stored verbatim case', v1({ jacket: '32', length: 'Regular', trouser: '64' }), 'suit', true);
    const item = JSON.parse(cdb.rows.at(-1).items)[0];
    assert.deepEqual(item.profile.ready, { jacket: '32', length: 'Regular', trouser: '64' }, 'checkout stores the version 1 sizes verbatim, outside the aligned sets and unrewritten');
    assert.ok(!('version' in item.profile), 'the stored profile stays version 1');
  }
  assert.equal(clientValidate({ method: 'ready', wearer: 'Men', ready: { jacket: '32', length: 'Regular', trouser: '64' } }), true, 'the client schema alone also honors the legacy sets for version 1');
  console.log('J-M5 (server) passed: the aligned bounds (jackets 36 to 62, trousers 30 to 60) are enforced identically by the client schema, account profiles and checkout for version 2 profiles, and version 1 ready profiles keep validating against the legacy sets, storing formerly offered sizes verbatim.');
})().catch(e => { console.error(e); process.exit(1) });
