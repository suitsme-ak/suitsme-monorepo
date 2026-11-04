const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Journeys J-M1a, J-M1b and J-M1c, as rebuilt by the JPOS
// consistency wave (package J1) on the version 3 schema: the
// garment aware Measurement Studio for suits and jackets. The
// wizard collects the JPOS shaped per garment set from the shared
// schema (GARMENT_SETS_V3), with the name and height preamble, the
// optional weight and posture answers, inches entry with a
// centimeter converter display (plan M9), and no fit selectors,
// and saves a version 3 profile in the J0 section D envelope; a
// legacy version 1 profile used for a suit is offered completion
// with exactly the fields its upgrade to version 3 still owes,
// and cancelling leaves it untouched. Driven on the real
// storefront scripts in a Node vm with stubbed DOM and storage,
// in the style of the other suites.
// Changed from the M1 originals, all by the approved J1 design:
// the field sets and order are the JPOS sets (waist split into
// jacketWaist and trouserWaist, sleeve split into left and right
// inseams plus an optional outseam, stomach removed); centimeter
// entry is gone from the body flow (converter display only); the
// review carries no fit selectors; saves are version 3.

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
// to demo checkout, with exactly the version 3 suit set and the J0
// envelope intact the whole way.
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
  // problems at once. The version 3 preamble also offers the
  // optional weight and posture answers, and no units toggle:
  // entry is inches, with centimeters as a converter display.
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  const preamble=w.run('measure()');
  assert.ok(preamble.includes('Name of the person being measured'),'the preamble asks who the clothes are for');
  assert.ok(preamble.includes('measureInput-height'),'the preamble asks for height');
  assert.ok(preamble.includes('measureInput-weight'),'the preamble offers the optional weight');
  assert.ok(preamble.includes('Posture'),'the preamble offers the optional posture answer');
  assert.ok(!preamble.includes('changeUnit'),'the body preamble has no units toggle: inches are the entry model');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'an empty preamble cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),2,'the name and the height problems are reported together');
  w.run("draft.wearerName='Alex Kumar';updateBodyValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the jacket part');

  // Jacket part: exactly the version 3 jacket block, in order, with
  // guidance labels; problems still all at once (SIZ-06 divergence).
  const jacketHtml=w.run('measure()');
  const jacketOrder=['chest','chestOverArm','sleeveInseamL','sleeveInseamR','sleeveOutseam','shoulder','jacketLength','jacketWaist'];
  assert.deepEqual(fieldOrder(jacketHtml,jacketOrder).slice().sort((a,b)=>a-b),fieldOrder(jacketHtml,jacketOrder),'the jacket fields render in the version 3 order');
  for(const id of jacketOrder)assert.ok(jacketHtml.includes('measureInput-'+id),'the jacket part asks for '+id);
  for(const id of ['sleeve','stomach','bicep','waist','pantsLength'])assert.ok(!jacketHtml.includes('measureInput-'+id+'"'),'the jacket part never asks for the retired '+id);
  assert.ok(!jacketHtml.includes('measureInput-trouserWaist"'),'the jacket part asks for no trouser fields');
  assert.ok(jacketHtml.includes('Body measurement'),'fields are labeled as body measurements');
  assert.ok(jacketHtml.includes('Garment target'),'jacket length is labeled as a garment target');
  assert.ok(jacketHtml.includes('Optional'),'the optional sleeve outseam is marked optional');
  assert.ok(jacketHtml.includes('cmEq-chest'),'each field carries its centimeter converter display');
  assert.ok(!jacketHtml.includes('changeUnit'),'the body fields step has no units toggle');
  w.run("updateBodyValue('chest','200');updateBodyValue('jacketWaist','5');updateBodyValue('sleeveInseamL','100')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'invalid jacket values cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),7,'all seven jacket problems are listed in one message');
  assert.equal(w.elFor('#measureInput-chest').getAttribute('aria-invalid'),'true','the out of range chest is marked invalid');
  w.run("updateBodyValue('chest','40');updateBodyValue('chestOverArm','46');updateBodyValue('sleeveInseamL','18');updateBodyValue('sleeveInseamR','18');updateBodyValue('shoulder','18');updateBodyValue('jacketLength','29');updateBodyValue('jacketWaist','34')");
  // The centimeter figure is a converter display that follows the
  // inch entry; it is never an entry mode (plan M9).
  assert.equal(w.elFor('#cmEq-chest').textContent,'= 101.6 cm','the centimeter display converts the entered inches');
  assert.equal(w.run('draft.values.chest'),40,'the stored value is the inch entry, exactly as typed');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid jacket values advance to the trousers part');

  // Trousers part: exactly the version 3 trouser block, in order;
  // the merged waist, the pants length and the leg opening of
  // version 2 are never asked under their old names.
  const trousersHtml=w.run('measure()');
  const trouserOrder=['outseam','trouserWaist','seat','frontRise','backRise','thigh','knee','bottom','inseam','rise','crotch'];
  assert.deepEqual(fieldOrder(trousersHtml,trouserOrder).slice().sort((a,b)=>a-b),fieldOrder(trousersHtml,trouserOrder),'the trouser fields render in the version 3 order');
  for(const id of trouserOrder)assert.ok(trousersHtml.includes('measureInput-'+id),'the trousers part asks for '+id);
  for(const id of ['pantsLength','legOpening'])assert.ok(!trousersHtml.includes('measureInput-'+id+'"'),'the trousers part never asks for the retired '+id);
  assert.ok(!trousersHtml.includes('measureInput-waist"'),'the trousers part never asks for the merged waist');
  w.run("updateBodyValue('outseam','42');updateBodyValue('trouserWaist','34');updateBodyValue('seat','40');updateBodyValue('frontRise','11');updateBodyValue('thigh','24');updateBodyValue('inseam','32');updateBodyValue('rise','12');updateBodyValue('crotch','10')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'optional trouser fields left empty do not block the review');

  // Review: values grouped by garment part, the posture answer
  // shown, and no fit selectors anywhere in version 3.
  const review=w.run('measure()');
  assert.ok(review.includes('About you')&&review.includes('Jacket')&&review.includes('Trousers'),'the review groups values by garment part');
  assert.ok(!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the version 3 review carries no fit selectors');
  assert.ok(review.includes('Posture'),'the review shows the posture answer line');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the suit profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,3,'the saved profile is version 3');
  assert.equal(p.origin,'web','the saved profile is web created');
  assert.equal(p.garment,'suit','the saved profile names its garment');
  assert.equal(p.wearerName,'Alex Kumar','the saved profile carries the wearer name');
  assert.deepEqual(p.header,{profileType:'suit',jposLinks:null},'the saved profile carries the measurementProfiles style header');
  assert.deepEqual(p.figure,{},'the saved profile carries an empty figure object: no figure questions ship yet');
  assert.equal(p.provenance,null,'a web profile carries no provenance');
  assert.equal(p.unit,'in','the saved profile records inches');
  assert.equal(p.values.trouserWaist,34,'the trouser waist is stored');
  assert.equal(p.values.jacketWaist,34,'the jacket waist is stored separately');
  assert.equal(p.gauge.chest,40,'the gauge block copies the chest');
  assert.equal(p.gauge.jacketWaist,34,'the gauge block carries the jacket waist');
  assert.equal(p.gauge.pantsWaist,34,'the gauge block carries the pants waist from the trouser waist');
  assert.equal(p.gauge.halfWaistJacket,null,'the gauge half waist stays null for a web profile');
  assert.equal(p.gauge.posture,null,'an unanswered posture is null in the gauge block');
  for(const key of ['waist','sleeve','stomach','pantsLength','legOpening'])assert.ok(!(key in p.values),'the saved values never carry the retired '+key);
  assert.ok(!('fits' in p),'the saved profile carries no fit selectors');
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"),true,'the saved profile passes the shared schema validation');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');

  // Per field guidance: placement, the common mistake, the helper
  // flag, and the body or garment label.
  w.run("gShowGuide('shoulder')");
  const guide=w.elFor('#modalContent').innerHTML;
  assert.ok(guide.includes('Measure across your back from shoulder tip to shoulder tip'),'the guide shows the placement guidance');
  assert.ok(guide.includes('Common mistake:'),'the guide names the common mistake');
  assert.ok(guide.includes('Ask a helper'),'the guide flags fields that need a second person');
  w.run("gShowGuide('jacketLength')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('finished garment target'),'the guide labels a garment target as one');
  w.run("gShowGuide('jacketWaist')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('not your trouser waist'),'the jacket waist guidance separates it from the trouser waist');
  w.run("gShowGuide('sleeveInseamL')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('inside of the arm'),'the sleeve guidance covers the left inseam');

  // Bag and demo checkout keep the version 3 profile intact.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  assert.equal(w.bag()[0].profile.version,3,'the bagged item carries the version 3 profile');
  const lineHtml=w.run('lineHtml(bag[0])');
  for(const text of ['Height 70 in','Chest 40 in','Chest over arms 46 in','Jacket waist 34 in','Trouser waist 34 in','Outseam 42 in','Inseam 32 in'])assert.ok(lineHtml.includes(text),'the bag line lists: '+text);
  assert.ok(!lineHtml.includes('Jacket Fit'),'the bag line shows no fit selectors for a version 3 profile');
  w.run("location.hash='#checkout';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('checkoutForm'),'the checkout opens on the delivery form');
  w.run(`saveCheckoutForm({__data:{email:'jm1@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'submitting the delivery form advances to review');
  assert.ok(w.elFor('#main').innerHTML.includes('The Everyday Navy'),'the review shows the suit');
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].items[0].profile.version,3,'the order item carries the version 3 profile');
  assert.deepEqual(orders[0].items[0].profile.values,p.values,'the order item carries the measured values intact');
  assert.deepEqual(orders[0].items[0].profile.gauge,p.gauge,'the order item carries the gauge block intact');
  console.log('J-M1a passed: a suit is measured with exactly the version 3 suit set, preamble with weight and posture, saved as a version 3 profile in the J0 envelope, and carried intact through the bag into a demo order.');
}

// ---------------------------------------------------------------- J-M1b
// Jacket only: the trousers fields are neither asked nor required,
// Seat is asked, and no fit selector appears. Quick add for a suit
// or jacket with no profile routes into the same flow.
{
  const w=makeWorld();
  w.run('chooseProduct(6)');w.run('beginDesign(6)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.garment'),'jacket','the session carries the jacket garment');
  assert.equal(w.run('garmentSteps().length'),4,'the jacket flow has method, preamble, one fields step and review');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateBodyValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the preamble advances to the jacket fields');
  const html=w.run('measure()');
  for(const id of ['chest','chestOverArm','sleeveInseamL','sleeveInseamR','shoulder','jacketLength','jacketWaist','seat'])assert.ok(html.includes('measureInput-'+id),'the jacket flow asks for '+id);
  for(const id of ['sleeve','stomach','bicep','outseam','trouserWaist','frontRise','thigh'])assert.ok(!html.includes('measureInput-'+id+'"'),'the jacket flow never asks for '+id);
  const progress=w.run('measure()');
  assert.ok(progress.includes('Your jacket')&&!progress.includes('Your trousers'),'the progress shows a jacket step and no trousers step');
  w.run("updateBodyValue('chest','40');updateBodyValue('chestOverArm','46');updateBodyValue('sleeveInseamL','18');updateBodyValue('sleeveInseamR','18');updateBodyValue('shoulder','18');updateBodyValue('jacketLength','28');updateBodyValue('jacketWaist','34');updateBodyValue('seat','40')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the jacket fields advance straight to review');
  const review=w.run('measure()');
  assert.ok(!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the jacket review carries no fit selectors in version 3');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,3,'the jacket profile is version 3');
  assert.equal(p.garment,'jacket','the jacket profile names its garment');
  assert.ok(!('trouserWaist' in p.values),'the jacket profile stores no trouser waist');
  assert.equal(p.gauge.pantsWaist,null,'the jacket gauge block has no pants waist');
  assert.equal(w.run("validateProfile(profiles[0],'jacket').ok"),true,'the jacket profile passes the shared schema validation');
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the jacket is bagged with its profile');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Seat / hips 40 in'),'the bag line lists the seat the jacket form asked for');
  assert.ok(!lineHtml.includes('Jacket Fit'),'the bag line lists no fit selector');

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
  console.log('J-M1b passed: a jacket asks only the version 3 jacket set (Seat included, no trouser fields, no fit selectors), and quick add routes suits and jackets into the same measuring flow when no profile exists.');
}

// ---------------------------------------------------------------- J-M1c
// Legacy profile completion: a version 1 profile selected for a suit
// is offered completion with exactly the fields its upgrade to
// version 3 still owes (J0 section D.5); the completion carries the
// values the upgrade carries and nothing else (the merged waist
// lands on trouserWaist; the sleeve and the stomach are not
// carried); saving writes version 3 under the same id; cancelling
// leaves the stored legacy profile byte identical.
{
  const legacy={id:'legacy-1',name:'Legacy fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:32,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},created:'2026-01-15T00:00:00.000Z'};
  const w=makeWorld({profiles:[legacy]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("chooseCustomizerProfile('legacy-1')");
  const html=w.run('customize()');
  assert.ok(html.includes('still needs:'),'selecting the legacy profile for a suit offers completion');
  for(const label of ['Name of the person being measured','Height','Chest over arms','Left sleeve inseam','Right sleeve inseam','Jacket waist','Outseam','Front rise','Inseam','Rise','Crotch depth'])assert.ok(html.includes(label),'the offer names the missing: '+label);
  assert.deepEqual(JSON.parse(w.run("JSON.stringify(missingForCompletion(profiles[0],'suit'))")),['wearerName','height','chestOverArm','sleeveInseamL','sleeveInseamR','jacketWaist','outseam','frontRise','inseam','rise','crotch'],'the owed fields are exactly the version 3 completion list');
  const before=w.store.get('suits-profiles');

  // Cancel first: the stored profile must not move a byte.
  w.run("startProfileCompletion('legacy-1')");
  assert.equal(w.run('draft.completionId'),'legacy-1','the completion session targets the legacy profile');
  assert.equal(w.run('draft.values.trouserWaist'),34,'the merged waist lands on the trouser waist');
  assert.equal(w.run('draft.values.chest'),40,'the carried chest is present, as measured');
  assert.equal(w.run('draft.values.sleeve'),undefined,'the version 2 sleeve is not carried: its landmarks differ');
  assert.equal(w.run('draft.values.waist'),undefined,'no merged waist survives the upgrade');
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
  w.run("draft.wearerName='Sam';updateBodyValue('height','71')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the preamble advances to the jacket part');
  assert.equal(w.run('draft.values.chest'),40,'the carried chest is in the completion form');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the owed jacket fields still block');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),4,'exactly the four owed jacket fields are reported');
  w.run("updateBodyValue('chestOverArm','47');updateBodyValue('sleeveInseamL','19');updateBodyValue('sleeveInseamR','19')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the one remaining owed jacket field still blocks');
  assert.equal(w.elFor('#measureError').textContent,'Please check jacket waist. Enter a measurement between 22 and 70 inches, or contact a fitter for guidance.','the only jacket problem named is the owed jacket waist');
  w.run("updateBodyValue('jacketWaist','35')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the jacket part advances to the trousers part');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the owed trouser fields still block');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),5,'exactly the five owed trouser fields are reported');
  w.run("updateBodyValue('outseam','43');updateBodyValue('frontRise','11');updateBodyValue('inseam','32');updateBodyValue('rise','12');updateBodyValue('crotch','10')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'the completed values advance to review');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'completion saves in place, no duplicate profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.id,'legacy-1','the completed profile keeps its id');
  assert.equal(p.version,3,'the completed profile is version 3');
  assert.equal(p.created,'2026-01-15T00:00:00.000Z','the completed profile keeps its creation date');
  assert.equal(p.wearerName,'Sam','the wearer name is the one just given');
  assert.equal(p.values.chest,40,'the carried chest survives verbatim');
  assert.equal(p.values.trouserWaist,34,'the trouser waist is the legacy trouser waist, as the upgrade rules');
  assert.equal(p.values.jacketWaist,35,'the newly measured jacket waist is stored');
  assert.equal(p.values.outseam,43,'the newly measured outseam is stored');
  assert.equal(p.values.height,71,'the newly measured height is stored');
  for(const key of ['waist','sleeve','stomach'])assert.ok(!(key in p.values),'the completed values never carry the retired '+key);
  assert.equal(p.gauge.pantsWaist,34,'the gauge pants waist follows the trouser waist');
  assert.equal(p.gauge.jacketWaist,35,'the gauge jacket waist is the newly measured one');
  assert.equal(w.run("validateProfile(profiles[0],'suit').ok"),true,'the completed profile passes the shared schema validation');
  w.elFor('#profileSelect').value='legacy-1';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the completed profile bags the suit');
  assert.equal(w.bag()[0].profile.version,3,'the bagged item carries the completed version 3 profile');
  console.log('J-M1c passed: a legacy profile is offered completion with exactly the fields its version 3 upgrade owes, completion carries only what the upgrade carries, saving writes version 3 in place, and cancelling leaves the legacy profile byte identical.');
}
