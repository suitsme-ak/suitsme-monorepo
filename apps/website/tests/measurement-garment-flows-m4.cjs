const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), Module = require('node:module'), crypto = require('node:crypto');
const path = require('node:path');
// Journeys J-M4a, J-M4b, J-M4c and J-M4d (measurements wave,
// package M4): the garment aware Measurement Studio extends from
// Men to Women and Boys. A women's suit is measured with the
// verified women's set (the men's suit fields in the form's
// order, stomach before bicep, every field required) and both fit
// selectors; a boys' journey entered from the navigation Studio,
// where a persisted draft still carries a previous session's Men
// wearer (inconsistency INC-03), completes under the boys ranges
// once the wearer is chosen explicitly; switching the wearer
// mid session changes the rules the session applies, and the
// customizer offers each wearer only their own profiles; and
// standard sizes exist for both groups (inconsistency INC-04):
// women by bust band, kids by age, using the benchmark's
// published sets, with no men's table presented as applying to
// them. Driven on the real storefront scripts in a Node vm with
// stubbed DOM and storage, plus the real checkout module for the
// stored order shape, in the style of the other suites.

function makeEl() { const el = { innerHTML: '', textContent: '', value: '', checked: false, open: false, style: {}, attrs: {}, classList: { add() {}, remove() {}, toggle() { return false } }, setAttribute(k, v) { el.attrs[k] = String(v) }, removeAttribute(k) { delete el.attrs[k] }, getAttribute(k) { return k in el.attrs ? el.attrs[k] : null }, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }), showModal() { el.open = true }, close() { el.open = false }, scrollIntoView() {} }; return el }
function makeWorld(seed = {}) {
  const store = new Map();
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  if (seed.profiles) localStorage.setItem('suits-profiles', JSON.stringify(seed.profiles));
  if (seed.config) localStorage.setItem('suits-config', JSON.stringify(seed.config));
  if (seed.draft) localStorage.setItem('suits-draft', JSON.stringify(seed.draft));
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
const liCount = html => (html.match(/<li>/g) || []).length;
const inputCount = html => (html.match(/measureInput-/g) || []).length;
const fieldOrder = (html, ids) => ids.map(id => html.indexOf('measureInput-' + id));
const setValues = (w, values) => { for (const [k, v] of Object.entries(values)) w.run(`updateValue('${k}','${v}')`); };
const demoCheckout = (w, email) => {
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:{email:'${email}',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  w.elFor('#orderConsent').checked = true;
  w.run('submitCheckout()');
  return JSON.parse(w.store.get('suits-orders') || '[]');
};
const WOMEN_SUIT_VALUES = { chest: 38, sleeve: 24, shoulder: 16, jacket: 28, stomach: 32, bicep: 12, pantsLength: 40, waist: 30, seat: 40, frontRise: 11, backRise: 15, thigh: 23, knee: 15, legOpening: 14 };

// ---------------------------------------------------------------- J-M4a
// Women's suit measuring end to end: the verified women's set in
// the form's order with every field required, both fit selectors,
// a version 2 women's profile, and the bag and demo order carrying
// it. Quick Add routes a women's suit with no profile into the
// same flow.
{
  const w = makeWorld();
  const idx = w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx >= 0, 'the catalog holds a Women suit');
  w.run(`chooseProduct(${idx})`); w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.wearer'), 'Women', 'the session carries the Women wearer from the product');
  assert.equal(w.run('garmentMode()'), true, 'the garment aware studio is active for a Women suit');
  assert.equal(w.run('garmentSetId()'), 'womens-suit', "the session uses the verified women's suit set");
  assert.ok(/^Women's suit_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')), 'the profile name is prefilled with the category and date: ' + w.run('draft.name'));
  assert.equal(w.run('garmentSteps().length'), 5, 'the women suit flow has method, preamble, jacket, trousers and review steps');

  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='Priya Kumar';updateValue('height','66')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'a completed preamble advances to the jacket fields');

  // The jacket part: the verified order, stomach before bicep,
  // and every field required (nothing carries the Optional tag).
  const jacketHtml = w.run('measure()');
  const jacketOrder = ['chest', 'sleeve', 'shoulder', 'jacket', 'stomach', 'bicep'];
  assert.deepEqual(fieldOrder(jacketHtml, jacketOrder).slice().sort((a, b) => a - b), fieldOrder(jacketHtml, jacketOrder), 'the women jacket fields render in the verified order, stomach before bicep');
  assert.equal(inputCount(jacketHtml), 6, 'the women jacket step asks for exactly 6 measurements');
  assert.ok(!jacketHtml.includes(' · Optional'), 'no field on the women jacket step is optional');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'empty women jacket fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML), 6, 'all six women jacket fields are reported together, bicep included');
  setValues(w, { chest: 38, sleeve: 24, shoulder: 16, jacket: 28, stomach: 32 });
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'the one field that is optional for men still blocks for women');
  assert.equal(liCount(w.elFor('#measureError').innerHTML), 0, 'a single problem is shown as text, not a list');
  assert.ok(w.elFor('#measureError').textContent.includes('bicep'), 'the blocking problem names the bicep');
  w.run("updateValue('bicep','12')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 3, 'the completed jacket part advances to the trousers fields');

  // The trousers part: the same 8 fields as the men's suit, all
  // required here, including back rise, knee and leg opening.
  const trousersHtml = w.run('measure()');
  const trousersOrder = ['pantsLength', 'waist', 'seat', 'frontRise', 'backRise', 'thigh', 'knee', 'legOpening'];
  assert.deepEqual(fieldOrder(trousersHtml, trousersOrder).slice().sort((a, b) => a - b), fieldOrder(trousersHtml, trousersOrder), 'the women trouser fields render in the verified order');
  assert.equal(inputCount(trousersHtml), 8, 'the women trousers step asks for exactly 8 measurements');
  assert.ok(!trousersHtml.includes(' · Optional'), 'no field on the women trousers step is optional');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 3, 'empty women trouser fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML), 8, 'all eight women trouser fields are reported together');
  setValues(w, { pantsLength: 40, waist: 30, seat: 40, frontRise: 11, backRise: 15, thigh: 23, knee: 15, legOpening: 14 });
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 4, 'the completed trousers part advances to review');

  // Review: both fit selectors at their benchmark defaults.
  const review = w.run('measure()');
  assert.ok(review.includes('>Jacket<') && review.includes('>Trousers<'), 'the review groups the values under Jacket and Trousers');
  assert.ok(review.includes('Jacket Fit') && review.includes('Trouser Fit'), 'the review carries both fit selectors');
  assert.equal(w.run('draft.fits.jacketFit'), 'Regular Fit', 'the jacket fit starts at the benchmark default');
  assert.equal(w.run('draft.fits.trouserFit'), 'Classic Comfort Fit', 'the trouser fit starts at the benchmark default');
  w.elFor('#confirmMeasures').checked = true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'), 1, 'the Studio saves the women suit profile');
  const p = JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version, 2, 'the saved profile is version 2');
  assert.equal(p.garment, 'suit', 'the saved profile names its garment');
  assert.equal(p.wearer, 'Women', 'the saved profile names its wearer');
  assert.equal(p.wearerName, 'Priya Kumar');
  assert.deepEqual(p.values, { height: 66, ...WOMEN_SUIT_VALUES }, 'the saved values are exactly the women suit set plus height');
  assert.deepEqual(p.fits, { jacketFit: 'Regular Fit', trouserFit: 'Classic Comfort Fit' }, 'the saved profile carries both fit selections');
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"), true, 'the saved profile passes the shared schema validation');
  const noBicep = { ...p, values: { ...p.values } }; delete noBicep.values.bicep;
  assert.equal(w.run(`validateProfile(${JSON.stringify(noBicep)},'suit').ok`), false, 'the same profile without a bicep is refused by the shared rule');
  assert.equal(w.run('stage'), 2, 'saving returns to the customizer Measurements step');

  // Bag and demo checkout keep the women profile intact.
  w.elFor('#profileSelect').value = p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length, 1, 'Add to Bag creates exactly one bag line');
  const lineHtml = w.run('lineHtml(bag[0])');
  for (const text of ['Height 66 in', 'Chest 38 in', 'Bicep 12 in', 'Stomach 32 in', 'Leg opening 14 in', 'Jacket Fit Regular Fit', 'Trouser Fit Classic Comfort Fit']) assert.ok(lineHtml.includes(text), 'the bag line lists: ' + text);
  const orders = demoCheckout(w, 'jm4a@example.com');
  assert.equal(orders.length, 1, 'the demo checkout records exactly one order');
  assert.equal(orders[0].items[0].profile.wearer, 'Women', 'the order item carries the Women wearer');
  assert.deepEqual(orders[0].items[0].profile.values, p.values, 'the order item carries the measured values intact');

  // Quick Add for a women's suit with no profile routes into
  // measuring, in the same garment aware studio.
  const wq = makeWorld();
  const qidx = wq.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  wq.run(`quickAddProduct(${qidx})`);
  assert.ok(wq.elFor('#modalContent').innerHTML.includes('quickAddMeasure'), "quick add for a women's suit with no profile offers the measuring flow");
  wq.run(`quickAddMeasure(${qidx})`);
  assert.equal(wq.run('draft.wearer'), 'Women', 'the quick add route carries the Women wearer');
  assert.equal(wq.run('garmentMode()'), true, 'the quick add route lands in the garment aware studio');
  assert.equal(wq.run('garmentSetId()'), 'womens-suit', "the quick add route uses the women's suit set");

  // The legacy completion offer extends to a Women profile:
  // exactly the owed fields, cancel byte safe.
  const LEGACY_W = { id: 'legacy-w', name: 'Legacy women fit', method: 'body', unit: 'in', wearer: 'Women', fit: 'Tailored', values: { chest: 38, waist: 30, shoulder: 16, sleeve: 24, jacket: 28, seat: 40, trouserWaist: 30, thigh: 23, inseam: 30, outseam: 40 }, created: '2026-01-15T00:00:00.000Z' };
  const wc = makeWorld({ profiles: [LEGACY_W] });
  const cidx = wc.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  wc.run(`chooseProduct(${cidx})`); wc.run(`beginDesign(${cidx})`);
  wc.run('nextConfig()'); wc.run('nextConfig()');
  wc.run("chooseCustomizerProfile('legacy-w')");
  const offerHtml = wc.run('customize()');
  assert.ok(offerHtml.includes('still needs:'), 'selecting the legacy Women profile for a women suit offers completion');
  assert.deepEqual(JSON.parse(wc.run("JSON.stringify(missingForCompletion(profiles[0],'suit'))")), ['wearerName', 'height', 'stomach', 'bicep', 'pantsLength', 'frontRise', 'backRise', 'knee', 'legOpening', 'jacketFit', 'trouserFit'], 'the women owed fields are exactly the schema completion list, every men optional included');
  const before = wc.store.get('suits-profiles');
  wc.run("startProfileCompletion('legacy-w')");
  assert.equal(wc.run('draft.wearer'), 'Women', 'the completion session carries the Women wearer');
  assert.equal(wc.run('garmentMode()'), true, 'the completion runs in the garment aware studio');
  wc.run('cancelCompletion()');
  assert.equal(wc.store.get('suits-profiles'), before, 'cancelling leaves the stored legacy Women profile byte identical');
  console.log('J-M4a passed: a women suit is measured with the verified all required set in the form order, saved as a version 2 Women profile through bag and demo order, quick add routes into measuring, and the legacy completion offer covers Women profiles with byte safe cancel.');
}

// ---------------------------------------------------------------- J-M4b
// Boys measuring entered from the navigation Studio. The
// persisted draft still carries a Men wearer and a suit garment
// from a previous product session (the INC-03 setup: via this
// door the same child used to be measured under whatever rules
// the leftover draft implied). The shopper chooses Boys at the
// method step, and from there the boys rules govern: child
// ranges, the men's field split, and a version 2 Boys profile
// the boys garment can actually use.
{
  const staleDraft = { step: 0, method: 'body', unit: 'in', values: {}, name: 'Suit_10/20/2026', fit: 'Tailored', ready: { jacket: '', length: '', trouser: '' }, garment: 'suit', wearer: 'Men', wearerName: '', fits: null, completionId: null, completionMissing: null };
  const w = makeWorld({ draft: staleDraft });
  w.run("location.hash='#measure';render()");
  assert.equal(w.run('draft.wearer'), 'Men', 'the navigation door opens on the persisted wearer, the INC-03 setup');
  let html = w.run('measure()');
  assert.ok(html.includes('Who are these measurements for?'), 'the method step offers the explicit wearer choice at this door too');
  // The shopper corrects the wearer, exactly what the select does.
  w.run("draft.wearer='Boys';saveDraft();render(false)");
  assert.equal(w.run('garmentMode()'), true, 'with the wearer chosen, the garment aware studio runs for Boys');
  assert.equal(w.run('garmentSetId()'), 'suit', 'the boys session uses the suit set with child ranges');

  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='Young Kumar';updateValue('height','90')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'a height above the boys maximum is refused at this door');
  assert.ok(w.elFor('#measureError').textContent.includes('between 36 and 84'), 'the refusal quotes the boys height range, not the adult one: ' + w.elFor('#measureError').textContent);
  w.run("updateValue('height','54')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'a boys height advances to the jacket fields');

  // Boys ranges govern, not the adult ones the stale draft
  // implied: chest 24, sleeve 16 and jacket length 20 are all
  // below the men minimums and valid for a child; the bicep,
  // optional in the men's split the boys sets follow, may stay
  // empty.
  setValues(w, { chest: 24, sleeve: 16, shoulder: 12, jacket: 20, stomach: 24 });
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 3, 'boys scale jacket values advance, the optional bicep left empty');
  setValues(w, { pantsLength: 32, waist: 24, seat: 28, frontRise: 8, thigh: 15 });
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 4, 'boys scale trouser values advance to review');
  w.elFor('#confirmMeasures').checked = true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'), 1, 'the Studio saves the boys profile');
  const p = JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version, 2, 'the saved profile is version 2');
  assert.equal(p.wearer, 'Boys', 'the saved profile names the Boys wearer');
  assert.deepEqual(p.values, { height: 54, chest: 24, sleeve: 16, shoulder: 12, jacket: 20, stomach: 24, pantsLength: 32, waist: 24, seat: 28, frontRise: 8, thigh: 15 }, 'the saved values are exactly the boys measurements entered');
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"), true, 'the saved profile passes the shared schema validation');
  const asMen = { ...p, wearer: 'Men' };
  assert.equal(w.run(`validateProfile(${JSON.stringify(asMen)},'suit').ok`), false, 'the same numbers are not a valid Men profile: the wearer rule, not the door, decides');

  // The profile the nav door produced is the one the boys
  // garment uses.
  const idx = w.run("products.findIndex(p=>p.silhouette==='Boys two-piece'&&p.kind==='suit')");
  assert.ok(idx >= 0, 'the catalog holds a Boys suit');
  w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); w.run('nextConfig()');
  const stepHtml = w.run('customize()');
  assert.ok(stepHtml.includes(p.name), 'the boys customizer lists the profile saved from the navigation Studio');
  w.elFor('#profileSelect').value = p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length, 1, 'the Boys garment is bagged with the nav door profile');
  assert.equal(w.bag()[0].profile.wearer, 'Boys', 'the bagged profile is the Boys profile');
  const orders = demoCheckout(w, 'jm4b@example.com');
  assert.equal(orders.length, 1, 'the demo checkout records exactly one order');
  assert.deepEqual(orders[0].items[0].profile.values, p.values, 'the order item carries the boys values intact');
  console.log('J-M4b passed: entered from the navigation Studio over a stale Men draft, choosing Boys applies the boys ranges and field split, saves a version 2 Boys profile the shared rule accepts (and refuses as a Men profile), and the boys garment bags and orders with it.');
}

// ---------------------------------------------------------------- J-M4c
// Wearer switching. In the studio, switching the wearer at the
// method step changes the set and the required split the session
// applies (Men suit: bicep optional; Women: the same session now
// owes it). In the customizer, each garment offers only its own
// wearer's profiles.
{
  const w = makeWorld();
  const idx = w.run("products.findIndex(p=>p.category==='Suits'&&p.kind==='suit')");
  assert.ok(idx >= 0, 'the catalog holds a Men suit');
  w.run(`chooseProduct(${idx})`); w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); w.run('nextConfig()');
  w.run('startMeasurements()');
  assert.equal(w.run('draft.wearer'), 'Men', 'the session starts as Men from the product');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','66')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'the Men session reaches the jacket fields');
  assert.ok(w.run('measure()').includes(' · Optional'), 'for Men the bicep is marked optional');
  w.run('measureBack()'); w.run('measureBack()');
  assert.equal(w.run('draft.step'), 0, 'the session returns to the method step');
  w.run("draft.wearer='Women';saveDraft();render(false)");
  assert.equal(w.run('garmentSetId()'), 'womens-suit', "switching the wearer switches the session to the women's set");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'the preamble values survive the switch');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'the switched session reaches the jacket fields');
  const html = w.run('measure()');
  assert.ok(!html.includes(' · Optional'), 'after the switch no jacket field is optional');
  setValues(w, { chest: 38, sleeve: 24, shoulder: 16, jacket: 28, stomach: 32 });
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'after the switch the bicep the Men split let through now blocks');
  assert.ok(w.elFor('#measureError').textContent.includes('bicep'), 'the blocking problem names the bicep');

  // Customizer filtering: each garment's profile picker offers
  // only its own wearer's profiles.
  const menBody = { id: 'pf-men', name: 'Men body profile', method: 'body', wearer: 'Men', unit: 'in', fit: 'Tailored', values: { chest: 40 }, created: '2026-01-01T00:00:00.000Z' };
  const womenBody = { id: 'pf-women', name: 'Women body profile', version: 2, method: 'body', garment: 'suit', wearer: 'Women', wearerName: 'Priya Kumar', unit: 'in', fit: 'Tailored', values: { height: 66, ...WOMEN_SUIT_VALUES }, fits: { jacketFit: 'Regular Fit', trouserFit: 'Classic Comfort Fit' }, created: '2026-01-02T00:00:00.000Z' };
  const boysBody = { id: 'pf-boys', name: 'Boys body profile', method: 'body', wearer: 'Boys', unit: 'in', fit: 'Tailored', values: { chest: 24 }, created: '2026-01-03T00:00:00.000Z' };
  const wf = makeWorld({ profiles: [menBody, womenBody, boysBody] });
  const cases = [
    ["products.findIndex(p=>p.category==='Suits'&&p.kind==='suit')", 'Men body profile', ['Women body profile', 'Boys body profile']],
    ["products.findIndex(p=>p.category==='Women'&&p.kind==='suit')", 'Women body profile', ['Men body profile', 'Boys body profile']],
    ["products.findIndex(p=>p.silhouette==='Boys two-piece'&&p.kind==='suit')", 'Boys body profile', ['Men body profile', 'Women body profile']]
  ];
  for (const [find, own, others] of cases) {
    const i = wf.run(find);
    assert.ok(i >= 0, 'the catalog holds the garment for the filtering case');
    wf.run(`beginDesign(${i})`);
    wf.run('nextConfig()'); wf.run('nextConfig()');
    const stepHtml = wf.run('customize()');
    assert.ok(stepHtml.includes(own), 'the customizer offers the garment wearer its own profile: ' + own);
    for (const other of others) assert.ok(!stepHtml.includes(other), 'the customizer does not offer ' + other + ' for this garment');
    wf.run('stage=0');
  }
  console.log('J-M4c passed: switching the wearer mid session switches the set and the required split the session applies, and the customizer offers each garment only its own wearer profiles.');
}

// ---------------------------------------------------------------- J-M4d
// Standard sizes for women and boys: the customizer offers the
// method for both groups, the studio asks only for her bust keyed
// size (women) or the child's age (boys), nothing preselected,
// and the saved version 2 profiles, bag summaries and stored
// orders carry exactly those parts. The men's tables are never
// presented as applying to them.
{
  // Women, by bust band.
  const w = makeWorld();
  const idx = w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  w.run(`chooseProduct(${idx})`); w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); w.run('nextConfig()');
  const stepHtml = w.run('customize()');
  assert.ok(stepHtml.includes("setCustomizerMethod('ready')"), 'the customizer offers standard sizes for the Women garment');
  assert.ok(stepHtml.includes('Choose your standard size by bust'), 'the Women standard size card is keyed to the bust');
  w.run("setCustomizerMethod('ready')");
  w.run('startMeasurements()');
  assert.equal(w.run('garmentMode()'), true, 'the garment aware studio runs the Women ready flow');
  assert.equal(w.run('garmentFlowSteps().length'), 3, 'the ready flow has method, sizes and review steps');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'the Studio advances to the sizes step');
  const sizes = w.run('measure()');
  assert.ok(sizes.includes("Women's size"), 'the sizes step asks for her size');
  assert.equal((sizes.match(/<select/g) || []).length, 1, 'the Women sizes step has exactly one select');
  for (const opt of ['30 (XXS)', '40 (XL)', '46 (4XL)']) assert.ok(sizes.includes(opt), 'the size choices include ' + opt);
  assert.ok(!sizes.includes('Jacket size (US)') && !sizes.includes('Trouser size (US)'), "the men's size selects are not offered to her");
  w.run('toggleSizeGuide()');
  const guide = w.run('measure()');
  assert.ok(guide.includes('keyed to your bust') && guide.includes('Letter size'), 'her size guide is the bust keyed ladder');
  assert.ok(!guide.includes('Body chest') && !guide.includes('Body waist'), "the men's tables are not presented as applying to her");
  w.run('toggleSizeGuide()');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 1, 'an unchosen size cannot advance');
  assert.equal(w.elFor('#measureError').textContent, "Choose your women's size to continue. No standard size is preselected.", 'the blocked message names her missing choice');
  w.run("setGarmentReadyPart('womenSize','40')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'), 2, 'the chosen size advances to review');
  const review = w.run('measure()');
  assert.ok(review.includes("Women's size") && review.includes('40 (XL)'), 'the review echoes her size with its letter');
  w.elFor('#confirmMeasures').checked = true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'), 1, 'the Studio saves the Women ready profile');
  const p = JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version, 2, 'the ready profile is version 2');
  assert.equal(p.method, 'ready', 'the ready profile keeps its method');
  assert.equal(p.wearer, 'Women', 'the ready profile names the Women wearer');
  assert.deepEqual(p.ready, { womenSize: '40' }, 'the ready profile records only her bust keyed size');
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"), true, 'the ready profile passes the shared schema validation');
  w.elFor('#profileSelect').value = p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length, 1, 'Add to Bag creates exactly one bag line');
  assert.equal(w.run('profileSummary(bag[0])'), "Standard sizes · Women's size 40 (XL)", 'the profile summary shows only her size');
  const orders = demoCheckout(w, 'jm4d@example.com');
  assert.deepEqual(orders[0].items[0].profile.ready, { womenSize: '40' }, 'the demo order records only her size');

  // Boys, by age.
  const wb = makeWorld();
  const bidx = wb.run("products.findIndex(p=>p.silhouette==='Boys two-piece'&&p.kind==='suit')");
  assert.ok(bidx >= 0, 'the catalog holds a Boys suit');
  wb.run(`chooseProduct(${bidx})`); wb.run(`beginDesign(${bidx})`);
  wb.run('nextConfig()'); wb.run('nextConfig()');
  const bStepHtml = wb.run('customize()');
  assert.ok(bStepHtml.includes("setCustomizerMethod('ready')"), 'the customizer offers standard sizes for the Boys garment');
  assert.ok(bStepHtml.includes('Choose a standard size by age'), 'the Boys standard size card is keyed to age');
  wb.run("setCustomizerMethod('ready')");
  wb.run('startMeasurements()');
  assert.equal(wb.run('garmentMode()'), true, 'the garment aware studio runs the Boys ready flow');
  wb.run('measureNext()');
  const bSizes = wb.run('measure()');
  assert.ok(bSizes.includes('Age'), 'the sizes step asks for the age');
  assert.equal((bSizes.match(/<select/g) || []).length, 1, 'the Boys sizes step has exactly one select');
  for (const opt of ['12 months', '8 years', '10 years']) assert.ok(bSizes.includes(opt), 'the age choices include ' + opt);
  assert.ok(!bSizes.includes('Jacket size (US)') && !bSizes.includes('Trouser size (US)'), "the men's size selects are not offered for the child");
  wb.run('measureNext()');
  assert.equal(wb.run('draft.step'), 1, 'an unchosen age cannot advance');
  assert.equal(wb.elFor('#measureError').textContent, 'Choose your age to continue. No standard size is preselected.', 'the blocked message names the missing age');
  wb.run("setGarmentReadyPart('age','8 years')");
  wb.run('measureNext()');
  assert.equal(wb.run('draft.step'), 2, 'the chosen age advances to review');
  wb.elFor('#confirmMeasures').checked = true;
  wb.run('measureNext()');
  const pb = JSON.parse(wb.run('JSON.stringify(profiles[0])'));
  assert.equal(pb.version, 2, 'the Boys ready profile is version 2');
  assert.equal(pb.wearer, 'Boys', 'the ready profile names the Boys wearer');
  assert.deepEqual(pb.ready, { age: '8 years' }, 'the ready profile records only the age');
  assert.equal(wb.run("validateProfile(profiles[0],'suit').ok"), true, 'the Boys ready profile passes the shared schema validation');
  wb.elFor('#profileSelect').value = pb.id;
  wb.run('nextConfig()');
  assert.equal(wb.run('profileSummary(bag[0])'), 'Standard sizes · Age 8 years', 'the profile summary shows only the age');
  console.log('J-M4d (client) passed: women size by bust band and boys by age, one select each, nothing preselected, no men table presented to them, and the profiles, bag summaries and demo orders carry only the wearer part.');
}

// J-M4d, server half: the real checkout module stores the wearer
// shaped ready parts on the order, refuses a Women profile
// carrying the men's parts or a version 1 Women ready profile,
// and keeps Men ready profiles working exactly as before.
function loadLib(rel) { const file = path.resolve(rel), m = new Module(file, module); m.filename = file; m.paths = module.paths; m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file); return m.exports }
class CommerceDB { constructor() { this.rows = []; this.sessions = []; this.users = [] } prepare(sql) { const self = this; return { bind(...args) { return { async first() { if (sql.includes('FROM sessions')) return self.sessions.find(r => r.token_hash === args[0]) || null; if (sql.includes('FROM users')) return self.users.find(r => r.id === args[0]) || null; if (sql.includes('owner=? AND idempotency_key=?')) return self.rows.find(r => r.owner === args[0] && r.idempotency_key === args[1]) || null; if (sql.includes('id=? AND owner=?')) return self.rows.find(r => r.id === args[0] && r.owner === args[1]) || null; return self.rows.find(r => r.id === args[0]) || null }, async run() { if (sql.startsWith('INSERT')) { const keys = ['id', 'owner', 'idempotency_key', 'items', 'shipping', 'subtotal_cents', 'shipping_cents', 'tax_cents', 'total_cents', 'status', 'created_at']; self.rows.push(Object.fromEntries(keys.map((k, i) => [k, args[i]]))) } if (sql.startsWith('DELETE')) { self.rows = self.rows.filter(r => !(r.id === args[0] && r.owner === args[1])) } if (sql.startsWith('UPDATE')) { const row = self.rows.find(r => r.id === args[1] && r.status === 'pending'); if (row) { row.status = 'paid'; row.transaction_id = args[0] } } return { success: true } } } } } } }
(async () => {
  const { commerce } = loadLib('lib/commerce.ts');
  global.fetch = async (url, init) => { if (String(url).includes('authorize.net')) { const data = JSON.parse(init.body); if (data.getHostedPaymentPageRequest) return Response.json({ messages: { resultCode: 'Ok' }, token: 'mock-hosted-token' }); } throw Error('Unexpected network request: ' + url) };
  const catalog = require('../lib/catalog.json');
  const suitIdx = catalog.findIndex(p => p.kind === 'suit');
  assert.ok(suitIdx >= 0, 'the catalog has a suit product');
  const cdb = new CommerceDB();
  const cenv = { ANET_API_LOGIN_ID: 'test-login', ANET_TRANSACTION_KEY: 'test-transaction-key', ANET_SIGNATURE_KEY: 'AB'.repeat(64), DB: cdb };
  const shipping = { email: 'tester@example.com', firstName: 'Test', lastName: 'Customer', address: '1 Test Street', city: 'New York', state: 'NY', zip: '10017', country: 'US' };
  let attempt = 0;
  const checkout = async (product, profile) => { const res = await commerce(new Request('https://shop.example/api/checkout', { method: 'POST', headers: { Origin: 'https://shop.example', 'oai-authenticated-user-id': 'owner-jm4', 'Idempotency-Key': 'jm4-attempt-' + String(++attempt).padStart(8, '0'), 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product, profile }], shipping }) }), cenv); return res.status };
  const lastItem = () => JSON.parse(cdb.rows.at(-1).items)[0];

  const womenReady = { version: 2, method: 'ready', garment: 'suit', wearer: 'Women', name: 'J-M4 ready', unit: 'in', fit: 'Tailored', ready: { womenSize: '40' } };
  assert.equal(await checkout(suitIdx, womenReady), 200, 'checkout accepts the wearer shaped Women ready profile');
  assert.deepEqual(lastItem().profile.ready, { womenSize: '40' }, 'the stored order records only her size');
  assert.equal(lastItem().profile.wearer, 'Women', 'the stored order records the Women wearer');
  const boysReady = { version: 2, method: 'ready', garment: 'suit', wearer: 'Boys', name: 'J-M4 ready', unit: 'in', fit: 'Tailored', ready: { age: '8 years' } };
  assert.equal(await checkout(suitIdx, boysReady), 200, 'checkout accepts the wearer shaped Boys ready profile');
  assert.deepEqual(lastItem().profile.ready, { age: '8 years' }, 'the stored order records only the age');
  assert.equal(await checkout(suitIdx, { ...womenReady, ready: { jacket: '40', length: 'Regular', trouser: '34' } }), 400, "checkout refuses a Women ready profile carrying the men's parts");
  assert.equal(await checkout(suitIdx, { method: 'ready', wearer: 'Women', name: 'J-M4 legacy ready', unit: 'in', fit: 'Tailored', ready: { jacket: '38', length: 'Regular', trouser: '32' } }), 400, 'checkout still refuses a version 1 ready profile for a Women wearer');
  assert.equal(await checkout(suitIdx, { ...boysReady, ready: { age: '11 years' } }), 400, 'checkout refuses an age off the published ladder');
  assert.equal(await checkout(suitIdx, { version: 2, method: 'ready', garment: 'suit', wearer: 'Men', name: 'J-M4 men ready', unit: 'in', fit: 'Tailored', ready: { jacket: '40', length: 'Regular', trouser: '34' } }), 200, 'checkout still accepts a Men ready profile in its garment shape');
  assert.deepEqual(lastItem().profile.ready, { jacket: '40', length: 'Regular', trouser: '34' }, 'the stored Men order keeps its historical shape');
  console.log('J-M4d (server) passed: checkout stores only the wearer shaped ready parts for Women and Boys, refuses substituted men parts, a version 1 Women ready profile and off ladder values, and keeps Men ready orders in their historical shape.');
})().catch(e => { console.error(e); process.exit(1) });
