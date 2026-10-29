const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Journeys J-M1a, J-M1b and J-M1c (measurements wave, package M1): the
// garment aware Measurement Studio for suits and jackets. The wizard
// collects the verified per garment set from the shared schema, in the
// benchmark order, with the name and height preamble and the in form
// fit selectors, and saves a version 2 profile; a legacy version 1
// profile used for a suit is offered completion with exactly the
// fields it still owes, and cancelling leaves it untouched. Driven on
// the real storefront scripts in a Node vm with stubbed DOM and
// storage, in the style of the other suites.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
function makeWorld(seed={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(seed.profiles)localStorage.setItem('suits-profiles',JSON.stringify(seed.profiles));
  if(seed.config)localStorage.setItem('suits-config',JSON.stringify(seed.config));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag};
}
const liCount=html=>(html.match(/<li>/g)||[]).length;
const fieldOrder=(html,ids)=>ids.map(id=>html.indexOf('measureInput-'+id));

// ---------------------------------------------------------------- J-M1a
// Suit measuring end to end: customizer to garment aware wizard to bag
// to demo checkout, with exactly the verified suit set and the fit
// selections intact the whole way.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('location.hash'),'#measure','the Studio opens from the customizer');
  assert.equal(w.run('draft.garment'),'suit','the session carries the suit garment');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active for a Men suit');
  assert.ok(/^Suit_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentSteps().length'),5,'the suit flow has method, preamble, jacket, trousers and review steps');

  // Step 0 (method) to the preamble; an empty preamble reports both
  // problems at once.
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  const preamble=w.run('measure()');
  assert.ok(preamble.includes('Name of the person being measured'),'the preamble asks who the clothes are for');
  assert.ok(preamble.includes('measureInput-height'),'the preamble asks for height');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'an empty preamble cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),2,'the name and the height problems are reported together');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the jacket part');

  // Jacket part: exactly the verified jacket block, in order, with
  // guidance labels; problems still all at once (SIZ-06 divergence).
  const jacketHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(jacketHtml,['chest','sleeve','shoulder','jacket','bicep','stomach']).slice().sort((a,b)=>a-b),fieldOrder(jacketHtml,['chest','sleeve','shoulder','jacket','bicep','stomach']),'the jacket fields render in the verified order');
  for(const id of ['chest','sleeve','shoulder','jacket','bicep','stomach'])assert.ok(jacketHtml.includes('measureInput-'+id),'the jacket part asks for '+id);
  assert.ok(!jacketHtml.includes('measureInput-pantsLength'),'the jacket part asks for no trouser fields');
  assert.ok(jacketHtml.includes('Body measurement'),'fields are labeled as body measurements');
  assert.ok(jacketHtml.includes('Garment target'),'jacket length is labeled as a garment target');
  assert.ok(jacketHtml.includes('Optional'),'the optional bicep is marked optional');
  w.run("updateValue('chest','200');updateValue('stomach','5');updateValue('sleeve','100')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'invalid jacket values cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),5,'all five jacket problems are listed in one message');
  assert.equal(w.elFor('#measureInput-chest').getAttribute('aria-invalid'),'true','the out of range chest is marked invalid');
  w.run("updateValue('chest','40');updateValue('sleeve','25');updateValue('shoulder','18');updateValue('jacket','29');updateValue('stomach','34')");
  // Centimeter entry converts through the one schema rule.
  w.run("changeUnit('cm');updateValue('bicep','30.5')");
  assert.ok(Math.abs(w.run('draft.values.bicep')-30.5/2.54)<0.0001,'a centimeter entry is stored as canonical inches');
  w.run("changeUnit('in')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid jacket values advance to the trousers part');

  // Trousers part: exactly the verified trouser block, in order; the
  // legacy inseam, outseam and second waist are never asked.
  const trousersHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(trousersHtml,['pantsLength','waist','seat','frontRise','backRise','thigh','knee','legOpening']).slice().sort((a,b)=>a-b),fieldOrder(trousersHtml,['pantsLength','waist','seat','frontRise','backRise','thigh','knee','legOpening']),'the trouser fields render in the verified order');
  for(const id of ['pantsLength','waist','seat','frontRise','backRise','thigh','knee','legOpening'])assert.ok(trousersHtml.includes('measureInput-'+id),'the trousers part asks for '+id);
  for(const id of ['inseam','outseam','trouserWaist'])assert.ok(!trousersHtml.includes('measureInput-'+id),'the trousers part never asks for the retired '+id);
  w.run("updateValue('pantsLength','42');updateValue('waist','34');updateValue('seat','40');updateValue('frontRise','11');updateValue('thigh','24')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'optional trouser fields left empty do not block the review');

  // Review: values grouped by garment part, fit selectors at their
  // benchmark defaults until the shopper changes them.
  const review=w.run('measure()');
  assert.ok(review.includes('About you')&&review.includes('Jacket')&&review.includes('Trousers'),'the review groups values by garment part');
  assert.ok(review.includes('Jacket Fit')&&review.includes('Trouser Fit'),'the review carries both fit selectors');
  assert.equal(w.run('draft.fits.jacketFit'),'Regular Fit','the jacket fit starts at the benchmark default');
  assert.equal(w.run('draft.fits.trouserFit'),'Classic Comfort Fit','the trouser fit starts at the benchmark default');
  w.run("draft.fits.trouserFit='Slimmer Straight';saveDraft()");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the suit profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the saved profile is version 2');
  assert.equal(p.garment,'suit','the saved profile names its garment');
  assert.equal(p.wearerName,'Alex Kumar','the saved profile carries the wearer name');
  assert.deepEqual(p.fits,{jacketFit:'Regular Fit',trouserFit:'Slimmer Straight'},'the saved profile carries the fit selections');
  assert.equal(p.values.waist,34,'the single body waist is stored');
  for(const key of ['trouserWaist','inseam','outseam'])assert.ok(!(key in p.values),'the saved values never carry the retired '+key);
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"),true,'the saved profile passes the shared schema validation');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');

  // Per field guidance: placement, the common mistake, the helper
  // flag, and the body or garment label.
  w.run("gShowGuide('shoulder')");
  const guide=w.elFor('#modalContent').innerHTML;
  assert.ok(guide.includes('Measure across your back from shoulder tip to shoulder tip'),'the guide shows the placement guidance');
  assert.ok(guide.includes('Common mistake:'),'the guide names the common mistake');
  assert.ok(guide.includes('Ask a helper'),'the guide flags fields that need a second person');
  w.run("gShowGuide('jacket')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('finished garment target'),'the guide labels a garment target as one');

  // Bag and demo checkout keep the version 2 profile intact.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  assert.equal(w.bag()[0].profile.version,2,'the bagged item carries the version 2 profile');
  const lineHtml=w.run('lineHtml(bag[0])');
  for(const text of ['Height 70 in','Chest 40 in','Bicep 12 in','Stomach 34 in','Pants length 42 in','Waist 34 in','Front rise 11 in','Jacket Fit Regular Fit','Trouser Fit Slimmer Straight'])assert.ok(lineHtml.includes(text),'the bag line lists: '+text);
  assert.ok(!lineHtml.includes('Natural waist'),'the bag line never shows the retired second waist');
  w.run("location.hash='#checkout';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('checkoutForm'),'the checkout opens on the delivery form');
  w.run(`saveCheckoutForm({__data:{email:'jm1@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'submitting the delivery form advances to review');
  assert.ok(w.elFor('#main').innerHTML.includes('The Everyday Navy'),'the review shows the suit');
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].items[0].profile.version,2,'the order item carries the version 2 profile');
  assert.deepEqual(orders[0].items[0].profile.values,p.values,'the order item carries the measured values intact');
  assert.deepEqual(orders[0].items[0].profile.fits,p.fits,'the order item carries the fit selections intact');
  console.log('J-M1a passed: a suit is measured with exactly the verified suit set, preamble and fit selectors, saved as a version 2 profile, and carried intact through the bag into a demo order.');
}

// ---------------------------------------------------------------- J-M1b
// Jacket only: the trousers fields are neither asked nor required,
// Seat is asked, and only the Jacket Fit selector appears. Quick add
// for a suit or jacket with no profile routes into the same flow.
{
  const w=makeWorld();
  w.run('chooseProduct(6)');w.run('beginDesign(6)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.garment'),'jacket','the session carries the jacket garment');
  assert.equal(w.run('garmentSteps().length'),4,'the jacket flow has method, preamble, one fields step and review');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the preamble advances to the jacket fields');
  const html=w.run('measure()');
  for(const id of ['chest','sleeve','shoulder','jacket','bicep','stomach','seat'])assert.ok(html.includes('measureInput-'+id),'the jacket flow asks for '+id);
  for(const id of ['pantsLength','waist','frontRise','thigh'])assert.ok(!html.includes('measureInput-'+id),'the jacket flow never asks for '+id);
  const progress=w.run('measure()');
  assert.ok(progress.includes('Your jacket')&&!progress.includes('Your trousers'),'the progress shows a jacket step and no trousers step');
  w.run("updateValue('chest','40');updateValue('sleeve','25');updateValue('shoulder','18');updateValue('jacket','28');updateValue('stomach','34');updateValue('seat','40')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the jacket fields advance straight to review');
  const review=w.run('measure()');
  assert.ok(review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the jacket review carries the jacket fit selector only');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the jacket profile is version 2');
  assert.equal(p.garment,'jacket','the jacket profile names its garment');
  assert.ok(!('waist' in p.values),'the jacket profile stores no trouser waist');
  assert.equal(w.run("validateProfile(profiles[0],'jacket').ok"),true,'the jacket profile passes the shared schema validation');
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the jacket is bagged with its profile');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Seat / hips 40 in'),'the bag line lists the seat the jacket form asked for');
  assert.ok(lineHtml.includes('Jacket Fit Regular Fit')&&!lineHtml.includes('Trouser Fit'),'the bag line lists the jacket fit only');

  // Quick add routing: no profile at all, a suit or a jacket offers
  // the measuring flow directly; other garments keep the M0 behavior
  // until their own packages land.
  const wq=makeWorld();
  wq.run('quickAddProduct(6)');
  const jacketDialog=wq.elFor('#modalContent').innerHTML;
  assert.ok(jacketDialog.includes('Take my measurements'),'quick add for a jacket with no profile offers the measuring flow');
  wq.run('quickAddMeasure(6)');
  assert.equal(wq.run('location.hash'),'#measure','the quick add route opens the Studio');
  assert.equal(wq.run('draft.garment'),'jacket','the quick add route carries the jacket garment');
  assert.equal(wq.run('garmentMode()'),true,'the quick add route lands in the garment aware studio');
  const ws=makeWorld();
  ws.run('quickAddProduct(0)');
  assert.ok(ws.elFor('#modalContent').innerHTML.includes('Take my measurements'),'quick add for a suit with no profile offers the measuring flow');
  const wp=makeWorld();
  wp.run('quickAddProduct(9)');
  assert.ok(wp.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for trousers offers the measuring flow from package M2 (was: previous behavior in M1)');
  console.log('J-M1b passed: a jacket asks only the verified jacket set (Seat included, no trouser fields, one fit selector), and quick add routes suits and jackets into the same measuring flow when no profile exists.');
}

// ---------------------------------------------------------------- J-M1c
// Legacy profile completion: a version 1 profile selected for a suit
// is offered completion with exactly the fields it still owes; the
// completion carries the values the migration carries and nothing
// else; saving writes version 2 under the same id; cancelling leaves
// the stored legacy profile byte identical.
{
  const legacy={id:'legacy-1',name:'Legacy fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:32,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},created:'2026-01-15T00:00:00.000Z'};
  const w=makeWorld({profiles:[legacy]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("chooseCustomizerProfile('legacy-1')");
  const html=w.run('customize()');
  assert.ok(html.includes('still needs:'),'selecting the legacy profile for a suit offers completion');
  for(const label of ['Name of the person being measured','Height','Stomach','Pants length','Front rise','Jacket Fit','Trouser Fit'])assert.ok(html.includes(label),'the offer names the missing: '+label);
  assert.deepEqual(JSON.parse(w.run("JSON.stringify(missingForCompletion(profiles[0],'suit'))")),['wearerName','height','stomach','pantsLength','frontRise','jacketFit','trouserFit'],'the owed fields are exactly the schema completion list');
  const before=w.store.get('suits-profiles');

  // Cancel first: the stored profile must not move a byte.
  w.run("startProfileCompletion('legacy-1')");
  assert.equal(w.run('draft.completionId'),'legacy-1','the completion session targets the legacy profile');
  assert.equal(w.run('draft.values.waist'),34,'the merged waist is carried from the legacy trouser waist');
  assert.equal(w.run('draft.values.chest'),40,'the carried chest is present, as measured');
  assert.equal(w.run('draft.values.inseam'),undefined,'the retired inseam is not carried into the completion');
  assert.ok(w.run('measure()').includes('Complete this profile.'),'the completion opens by naming what it is doing');
  w.run('cancelCompletion()');
  assert.equal(w.store.get('suits-profiles'),before,'cancelling leaves the stored legacy profile byte identical');
  assert.equal(w.run('draft.completionId'),null,'the completion session is over after cancelling');
  assert.equal(w.run('location.hash'),'#customize','cancelling returns to the customizer');

  // Complete it: only the owed fields are asked for as missing; the
  // carried values are already there and are not re-asked as errors.
  w.run("startProfileCompletion('legacy-1')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the completion advances to the preamble');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the empty name and height still block');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),2,'the preamble reports exactly the two owed items');
  w.run("draft.wearerName='Sam';updateValue('height','71')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the preamble advances to the jacket part');
  assert.equal(w.run("displayValue('chest')"),'40','the carried chest shows in the completion form');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the one owed jacket field still blocks');
  assert.equal(w.elFor('#measureError').textContent,'Please check stomach. Enter a measurement between 22 and 80 in, or contact a fitter for guidance.','the only jacket problem named is the owed stomach');
  w.run("updateValue('stomach','35')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the jacket part advances to the trousers part');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the owed trouser fields still block');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),2,'exactly the two owed trouser fields are reported');
  w.run("updateValue('pantsLength','43');updateValue('frontRise','11')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'the completed values advance to review');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'completion saves in place, no duplicate profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.id,'legacy-1','the completed profile keeps its id');
  assert.equal(p.version,2,'the completed profile is version 2');
  assert.equal(p.created,'2026-01-15T00:00:00.000Z','the completed profile keeps its creation date');
  assert.equal(p.wearerName,'Sam','the wearer name is the one just given');
  assert.equal(p.values.chest,40,'the carried chest survives verbatim');
  assert.equal(p.values.waist,34,'the merged waist is the legacy trouser waist, as the migration rules');
  assert.equal(p.values.stomach,35,'the newly measured stomach is stored');
  assert.equal(p.values.pantsLength,43,'the newly measured pants length is stored');
  assert.equal(p.values.height,71,'the newly measured height is stored');
  for(const key of ['trouserWaist','inseam','outseam'])assert.ok(!(key in p.values),'the completed values never carry the retired '+key);
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"),true,'the completed profile passes the shared schema validation');
  w.elFor('#profileSelect').value='legacy-1';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the completed profile bags the suit');
  assert.equal(w.bag()[0].profile.version,2,'the bagged item carries the completed version 2 profile');
  console.log('J-M1c passed: a legacy profile is offered completion with exactly the fields it owes, completion carries only what the migration carries, saving writes version 2 in place, and cancelling leaves the legacy profile byte identical.');
}
