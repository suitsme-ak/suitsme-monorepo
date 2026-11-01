const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path');
// Journeys J-M2a, J-M2b and J-M2c (measurements wave, package M2):
// the garment aware Measurement Studio extends from suits and
// jackets (M1) to trousers and waistcoats. Trousers only measuring
// collects the verified 8 field set plus the Trouser Fit selector;
// waistcoat measuring collects exactly the verified 3 fields with
// no fit selector; ready (standard size) profiles become garment
// shaped, so a trousers order records only its trouser size and
// the new inseam choice (Unhemmed included, owner decision O8) and
// never a jacket size (inconsistency INC-07), and a waistcoat
// records only its own size. Legacy completion offers extend to
// both garments with the M1 design, and Quick Add routes trousers
// and waistcoats with no suitable profile into the same flow.
// Driven on the real storefront scripts in a Node vm with stubbed
// DOM and storage, plus the real checkout module for the stored
// order shape, in the style of the other suites.

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
const inputCount=html=>(html.match(/measureInput-/g)||[]).length;
const fieldOrder=(html,ids)=>ids.map(id=>html.indexOf('measureInput-'+id));
const LEGACY={id:'legacy-1',name:'Legacy fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:32,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},created:'2026-01-15T00:00:00.000Z'};

// ---------------------------------------------------------------- J-M2a
// Trousers only measuring end to end: exactly the verified 8 field
// set in order, the single merged waist, the Trouser Fit selector,
// a version 2 trousers profile, and the bag and demo order carrying
// it. Quick Add and the legacy completion offer cover trousers too.
{
  const w=makeWorld();
  w.run('chooseProduct(9)');w.run('beginDesign(9)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.garment'),'pants','the session carries the trousers garment');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active for Men trousers');
  assert.ok(/^Trousers_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentSteps().length'),4,'the trousers flow has method, preamble, one fields step and review');

  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the trousers fields');

  // Exactly the verified trousers set, in order; no jacket field is
  // asked, and the retired inseam, outseam and second waist are not.
  const fieldsHtml=w.run('measure()');
  const order=['pantsLength','waist','seat','frontRise','backRise','thigh','knee','legOpening'];
  assert.deepEqual(fieldOrder(fieldsHtml,order).slice().sort((a,b)=>a-b),fieldOrder(fieldsHtml,order),'the trouser fields render in the verified order');
  for(const id of order)assert.ok(fieldsHtml.includes('measureInput-'+id),'the trousers flow asks for '+id);
  assert.equal(inputCount(fieldsHtml),8,'the trousers step asks for exactly 8 measurements');
  for(const id of ['chest','sleeve','shoulder','jacket','bicep','stomach'])assert.ok(!fieldsHtml.includes('measureInput-'+id),'the trousers flow never asks for the jacket field '+id);
  for(const id of ['inseam','outseam','trouserWaist'])assert.ok(!fieldsHtml.includes('measureInput-'+id),'the trousers flow never asks for the retired '+id);
  assert.ok(fieldsHtml.includes('Your trousers')&&!fieldsHtml.includes('Your jacket'),'the progress shows a trousers step and no jacket step');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'empty required trouser fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),5,'the five required trouser fields are reported together');
  w.run("updateValue('pantsLength','42');updateValue('waist','34');updateValue('seat','40');updateValue('frontRise','11');updateValue('thigh','24')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid trouser values advance to review, optional fields left empty');

  // Review: one Trousers group, the Trouser Fit selector only.
  const review=w.run('measure()');
  assert.ok(review.includes('>Trousers<'),'the review groups the values under Trousers');
  assert.ok(review.includes('Trouser Fit')&&!review.includes('Jacket Fit'),'the review carries the trouser fit selector only');
  assert.equal(w.run('draft.fits.trouserFit'),'Classic Comfort Fit','the trouser fit starts at the benchmark default');
  w.run("draft.fits.trouserFit='Straight Fit';saveDraft()");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the trousers profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the saved profile is version 2');
  assert.equal(p.garment,'pants','the saved profile names its garment');
  assert.deepEqual(p.values,{height:70,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24},'the saved values are exactly the trousers set plus height');
  assert.deepEqual(p.fits,{trouserFit:'Straight Fit'},'the saved profile carries the trouser fit selection only');
  assert.equal(w.run("validateProfile(profiles[0],'pants').ok"),true,'the saved profile passes the shared schema validation');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');

  // Bag and demo checkout keep the trousers profile intact.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const lineHtml=w.run('lineHtml(bag[0])');
  for(const text of ['Height 70 in','Pants length 42 in','Waist 34 in','Seat / hips 40 in','Front rise 11 in','Trouser Fit Straight Fit'])assert.ok(lineHtml.includes(text),'the bag line lists: '+text);
  assert.ok(!lineHtml.includes('Jacket Fit'),'the bag line never shows a jacket fit for trousers');
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:{email:'jm2@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].items[0].profile.garment,'pants','the order item carries the trousers profile');
  assert.deepEqual(orders[0].items[0].profile.values,p.values,'the order item carries the measured values intact');

  // Quick Add for trousers with no profile routes into measuring.
  const wq=makeWorld();
  wq.run('quickAddProduct(9)');
  assert.ok(wq.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for trousers with no profile offers the measuring flow');
  wq.run('quickAddMeasure(9)');
  assert.equal(wq.run('draft.garment'),'pants','the quick add route carries the trousers garment');
  assert.equal(wq.run('garmentMode()'),true,'the quick add route lands in the garment aware studio');

  // Legacy completion offer for trousers: exactly the owed fields,
  // cancel byte safe, completion writes version 2 in place.
  const wc=makeWorld({profiles:[LEGACY]});
  wc.run('chooseProduct(9)');wc.run('beginDesign(9)');
  wc.run('nextConfig()');wc.run('nextConfig()');
  wc.run("chooseCustomizerProfile('legacy-1')");
  const offerHtml=wc.run('customize()');
  assert.ok(offerHtml.includes('still needs:'),'selecting the legacy profile for trousers offers completion');
  for(const label of ['Pants length','Front rise','Trouser Fit'])assert.ok(offerHtml.includes(label),'the trousers offer names the missing: '+label);
  assert.deepEqual(JSON.parse(wc.run("JSON.stringify(missingForCompletion(profiles[0],'pants'))")),['wearerName','height','pantsLength','frontRise','trouserFit'],'the trousers owed fields are exactly the schema completion list');
  const before=wc.store.get('suits-profiles');
  wc.run("startProfileCompletion('legacy-1')");
  assert.equal(wc.run('draft.values.waist'),34,'the merged waist is carried from the legacy trouser waist');
  wc.run('cancelCompletion()');
  assert.equal(wc.store.get('suits-profiles'),before,'cancelling leaves the stored legacy profile byte identical');
  wc.run("startProfileCompletion('legacy-1')");
  wc.run('measureNext()');
  wc.run("draft.wearerName='Sam';updateValue('height','71')");
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),2,'the trousers completion advances to the trousers fields');
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),2,'the owed trouser fields still block');
  assert.equal(liCount(wc.elFor('#measureError').innerHTML),2,'exactly the two owed trouser fields are reported');
  wc.run("updateValue('pantsLength','43');updateValue('frontRise','11')");
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),3,'the completed values advance to review');
  wc.elFor('#confirmMeasures').checked=true;
  wc.run('measureNext()');
  assert.equal(wc.run('profiles.length'),1,'completion saves in place, no duplicate profile');
  const cp=JSON.parse(wc.run('JSON.stringify(profiles[0])'));
  assert.equal(cp.id,'legacy-1','the completed profile keeps its id');
  assert.equal(cp.version,2,'the completed trousers profile is version 2');
  assert.equal(cp.garment,'pants','the completed profile names the trousers garment');
  assert.equal(cp.values.waist,34,'the merged waist is the legacy trouser waist, as the migration rules');
  assert.equal(cp.values.pantsLength,43,'the newly measured pants length is stored');
  assert.ok(!('chest' in cp.values),'the completed trousers values carry no jacket fields');
  assert.equal(wc.run("validateProfile(profiles[0],'pants').ok"),true,'the completed profile passes the shared schema validation');
  console.log('J-M2a passed: trousers are measured with exactly the verified 8 field set and the Trouser Fit selector, saved as a version 2 profile through bag and demo order, quick add routes into measuring, and the legacy completion offer covers trousers with byte safe cancel.');
}

// ---------------------------------------------------------------- J-M2b
// Waistcoat measuring: exactly the verified 3 fields, all required,
// no fit selector, saved as a version 2 waistcoat profile. Quick
// Add and the legacy completion offer cover the waistcoat too.
{
  const w=makeWorld();
  w.run('chooseProduct(8)');w.run('beginDesign(8)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.garment'),'waistcoat','the session carries the waistcoat garment');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active for a Men waistcoat');
  assert.ok(/^Waistcoat_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentSteps().length'),4,'the waistcoat flow has method, preamble, one fields step and review');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the waistcoat fields');

  const fieldsHtml=w.run('measure()');
  const order=['vestLength','chest','stomach'];
  assert.deepEqual(fieldOrder(fieldsHtml,order).slice().sort((a,b)=>a-b),fieldOrder(fieldsHtml,order),'the waistcoat fields render in the verified order');
  assert.equal(inputCount(fieldsHtml),3,'the waistcoat step asks for exactly 3 measurements');
  for(const id of order)assert.ok(fieldsHtml.includes('measureInput-'+id),'the waistcoat flow asks for '+id);
  for(const id of ['waist','seat','sleeve','shoulder','jacket','bicep'])assert.ok(!fieldsHtml.includes('measureInput-'+id),'the waistcoat flow never asks for '+id);
  assert.ok(fieldsHtml.includes('Your waistcoat'),'the progress shows a waistcoat step');
  // Package M9 supersedes the highlighted figure for this field:
  // vest length is a diagram style field, so the step now opens
  // on its per field line diagram instead of the studio figure.
  assert.ok(fieldsHtml.includes('Line diagram showing the vest length measurement'),'the step opens on the vest length line diagram drawn for this field (package M9)');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'empty waistcoat fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),3,'all three waistcoat fields are required and reported together');
  w.run("updateValue('vestLength','24');updateValue('chest','40');updateValue('stomach','34')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid waistcoat values advance to review');

  const review=w.run('measure()');
  assert.ok(review.includes('>Waistcoat<'),'the review groups the values under Waistcoat');
  assert.ok(!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the waistcoat review carries no fit selector, as the verified form has none');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the waistcoat profile is version 2');
  assert.equal(p.garment,'waistcoat','the waistcoat profile names its garment');
  assert.deepEqual(p.values,{height:70,vestLength:24,chest:40,stomach:34},'the saved values are exactly the waistcoat set plus height');
  assert.deepEqual(p.fits,{},'the waistcoat profile carries no fit selections');
  assert.equal(w.run("validateProfile(profiles[0],'waistcoat').ok"),true,'the waistcoat profile passes the shared schema validation');
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the waistcoat is bagged with its profile');
  const lineHtml=w.run('lineHtml(bag[0])');
  for(const text of ['Vest length 24 in','Chest 40 in','Stomach 34 in'])assert.ok(lineHtml.includes(text),'the bag line lists: '+text);

  // Quick Add for a waistcoat with no profile routes into measuring.
  const wq=makeWorld();
  wq.run('quickAddProduct(8)');
  assert.ok(wq.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for a waistcoat with no profile offers the measuring flow');
  wq.run('quickAddMeasure(8)');
  assert.equal(wq.run('draft.garment'),'waistcoat','the quick add route carries the waistcoat garment');
  assert.equal(wq.run('garmentMode()'),true,'the quick add route lands in the garment aware studio');

  // Legacy completion offer for a waistcoat, cancel byte safe.
  const wc=makeWorld({profiles:[LEGACY]});
  wc.run('chooseProduct(8)');wc.run('beginDesign(8)');
  wc.run('nextConfig()');wc.run('nextConfig()');
  wc.run("chooseCustomizerProfile('legacy-1')");
  const offerHtml=wc.run('customize()');
  assert.ok(offerHtml.includes('still needs:'),'selecting the legacy profile for a waistcoat offers completion');
  for(const label of ['Vest length','Stomach'])assert.ok(offerHtml.includes(label),'the waistcoat offer names the missing: '+label);
  assert.deepEqual(JSON.parse(wc.run("JSON.stringify(missingForCompletion(profiles[0],'waistcoat'))")),['wearerName','height','vestLength','stomach'],'the waistcoat owed fields are exactly the schema completion list');
  const before=wc.store.get('suits-profiles');
  wc.run("startProfileCompletion('legacy-1')");
  wc.run('cancelCompletion()');
  assert.equal(wc.store.get('suits-profiles'),before,'cancelling leaves the stored legacy profile byte identical');
  console.log('J-M2b passed: a waistcoat is measured with exactly the verified 3 fields, all required, no fit selector, saved as a version 2 profile, and quick add plus the legacy completion offer cover the waistcoat.');
}

// ---------------------------------------------------------------- J-M2c
// Ready trousers: the standard size flow is garment shaped. The
// sizes step asks only for a trouser size and an inseam (Unhemmed
// included), nothing is preselected, the saved version 2 profile
// and every summary record only those parts, and the real checkout
// stores exactly them on the order: no jacket size anywhere.
{
  const w=makeWorld();
  w.run('chooseProduct(9)');w.run('beginDesign(9)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('ready')");
  w.run('startMeasurements()');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio runs the trousers ready flow');
  assert.equal(w.run('garmentFlowSteps().length'),3,'the ready flow has method, sizes and review steps');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the sizes step');
  const sizes=w.run('measure()');
  assert.ok(sizes.includes('Trouser size (US)'),'the sizes step asks for a trouser size');
  assert.ok(sizes.includes('Inseam'),'the sizes step asks for the inseam choice');
  assert.ok(sizes.includes('Unhemmed'),'the inseam choices include Unhemmed');
  assert.ok(!sizes.includes('Jacket size'),'the trousers sizes step never asks for a jacket size');
  assert.equal((sizes.match(/<select/g)||[]).length,2,'the trousers sizes step has exactly two selects: trouser size and inseam');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'unchosen sizes cannot advance');
  assert.equal(w.elFor('#measureError').textContent,'Choose your trouser size, inseam to continue. No standard size is preselected.','the blocked message names both missing choices');
  w.run("setGarmentReadyPart('inseam','32')");
  assert.equal(w.run('draft.ready.inseam'),32,'a numeric inseam choice is stored as a number');
  w.run("setGarmentReadyPart('trouser','34');setGarmentReadyPart('inseam','Unhemmed')");
  assert.equal(w.run('draft.ready.inseam'),'Unhemmed','the Unhemmed choice is stored as itself');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'chosen sizes advance to review');
  const review=w.run('measure()');
  assert.ok(review.includes('Trouser size (US)')&&review.includes('Unhemmed'),'the review echoes the trouser size and the Unhemmed inseam');
  assert.ok(!review.includes('Jacket size'),'the review shows no jacket size');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the ready trousers profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the ready profile is version 2');
  assert.equal(p.method,'ready','the ready profile keeps its method');
  assert.equal(p.garment,'pants','the ready profile names its garment');
  assert.deepEqual(p.ready,{trouser:'34',inseam:'Unhemmed'},'the ready profile records only the trouser size and the inseam');
  assert.equal(w.run("validateProfile(profiles[0],'pants').ok"),true,'the ready profile passes the shared schema validation');
  assert.equal(w.run("validateProfile({version:2,method:'ready',garment:'pants',wearer:'Men',ready:{trouser:'34'}},'pants').ok"),false,'a version 2 trousers ready profile without the inseam choice is refused by the shared rule');
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  assert.equal(w.run('profileSummary(bag[0])'),'Standard sizes · Trouser size 34 · Inseam Unhemmed','the profile summary shows only the chosen trouser size and inseam');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Standard sizes · Trouser size 34 · Inseam Unhemmed'),'the bag line shows the trouser size and the Unhemmed inseam');
  assert.ok(!lineHtml.includes('Jacket size'),'the bag line shows no jacket size');
  w.run('openBag()');
  const bagHtml=w.elFor('#modalContent').innerHTML;
  assert.ok(bagHtml.includes('Inseam Unhemmed')&&!bagHtml.includes('Jacket size'),'the bag modal shows the inseam and no jacket size');
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:{email:'jm2c@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.deepEqual(orders[0].items[0].profile.ready,{trouser:'34',inseam:'Unhemmed'},'the demo order records only the trouser size and the inseam');
  assert.ok(!('jacket' in orders[0].items[0].profile.ready),'the demo order records no jacket size');

  // A numeric inseam is stored and shown as the number chosen.
  const wn=makeWorld();
  wn.run('chooseProduct(9)');wn.run('beginDesign(9)');
  wn.run('nextConfig()');wn.run('nextConfig()');
  wn.run("setCustomizerMethod('ready')");wn.run('startMeasurements()');
  wn.run('measureNext()');
  wn.run("setGarmentReadyPart('trouser','36');setGarmentReadyPart('inseam','32')");
  wn.run('measureNext()');
  wn.elFor('#confirmMeasures').checked=true;
  wn.run('measureNext()');
  const pn=JSON.parse(wn.run('JSON.stringify(profiles[0])'));
  assert.deepEqual(pn.ready,{trouser:'36',inseam:32},'a numeric inseam is stored as the number chosen');
  assert.equal(wn.run('profileSummary({profile:profiles[0]})'),'Standard sizes · Trouser size 36 · Inseam 32','the summary shows the numeric inseam');

  // Ready waistcoat: only its own size is asked, stored and shown.
  const ww=makeWorld();
  ww.run('chooseProduct(8)');ww.run('beginDesign(8)');
  ww.run('nextConfig()');ww.run('nextConfig()');
  ww.run("setCustomizerMethod('ready')");ww.run('startMeasurements()');
  assert.equal(ww.run('garmentMode()'),true,'the garment aware studio runs the waistcoat ready flow');
  ww.run('measureNext()');
  const wsizes=ww.run('measure()');
  assert.ok(wsizes.includes('Waistcoat size (US)'),'the waistcoat sizes step asks for a waistcoat size');
  assert.ok(!wsizes.includes('Trouser size')&&!wsizes.includes('Jacket size'),'the waistcoat sizes step asks for no other size');
  assert.equal((wsizes.match(/<select/g)||[]).length,1,'the waistcoat sizes step has exactly one select');
  ww.run("setGarmentReadyPart('waistcoat','40')");
  ww.run('measureNext()');
  ww.elFor('#confirmMeasures').checked=true;
  ww.run('measureNext()');
  const pw=JSON.parse(ww.run('JSON.stringify(profiles[0])'));
  assert.deepEqual(pw.ready,{waistcoat:'40'},'the waistcoat ready profile records only its own size');
  assert.equal(ww.run("validateProfile(profiles[0],'waistcoat').ok"),true,'the waistcoat ready profile passes the shared schema validation');
  ww.elFor('#profileSelect').value=pw.id;
  ww.run('nextConfig()');
  assert.equal(ww.run('profileSummary(bag[0])'),'Standard sizes · Waistcoat size 40','the waistcoat summary shows only the waistcoat size');
  console.log('J-M2c (client) passed: ready trousers ask only for a trouser size and an inseam, nothing preselected, Unhemmed and numeric inseams stored and shown, no jacket size on the profile, the bag line or the demo order, and a ready waistcoat records only its own size.');
}

// J-M2c, server half: the real checkout module stores the garment
// shaped ready parts on the order, refuses a trousers ready
// profile without its inseam, and keeps version 1 ready profiles
// in their historical shape.
function loadLib(rel){const file=path.resolve(rel),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return m.exports}
class CommerceDB{constructor(){this.rows=[];this.sessions=[];this.users=[]}prepare(sql){const self=this;return{bind(...args){return{async first(){if(sql.includes('FROM sessions'))return self.sessions.find(r=>r.token_hash===args[0])||null;if(sql.includes('FROM users'))return self.users.find(r=>r.id===args[0])||null;if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;return self.rows.find(r=>r.id===args[0])||null},async run(){if(sql.startsWith('INSERT')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}if(sql.startsWith('DELETE')){self.rows=self.rows.filter(r=>!(r.id===args[0]&&r.owner===args[1]))}if(sql.startsWith('UPDATE')){const row=self.rows.find(r=>r.id===args[1]&&r.status==='pending');if(row){row.status='paid';row.transaction_id=args[0]}}return{success:true}}}}}}}
(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  global.fetch=async(url,init)=>{if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url)};
  const catalog=require('../lib/catalog.json');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),waistcoatIdx=catalog.findIndex(p=>p.kind==='waistcoat');
  assert.ok(pantsIdx>=0&&waistcoatIdx>=0,'the catalog has trousers and waistcoat products');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const checkout=async(product,profile)=>{const res=await commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-jm2','Idempotency-Key':'jm2-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify({items:[{product,profile}],shipping})}),cenv);return res.status};
  const lastReady=()=>JSON.parse(cdb.rows.at(-1).items)[0].profile.ready;

  assert.equal(await checkout(pantsIdx,{version:2,method:'ready',garment:'pants',wearer:'Men',name:'J-M2 ready',unit:'in',fit:'Tailored',ready:{trouser:'34',inseam:'Unhemmed'}}),200,'checkout accepts the garment shaped trousers ready profile');
  assert.deepEqual(lastReady(),{trouser:'34',inseam:'Unhemmed'},'the stored order records only the trouser size and the Unhemmed inseam');
  assert.equal(await checkout(pantsIdx,{version:2,method:'ready',garment:'pants',wearer:'Men',name:'J-M2 ready',unit:'in',fit:'Tailored',ready:{trouser:'36',inseam:32}}),200,'checkout accepts a numeric inseam');
  assert.deepEqual(lastReady(),{trouser:'36',inseam:32},'the stored order records the numeric inseam as a number');
  assert.equal(await checkout(waistcoatIdx,{version:2,method:'ready',garment:'waistcoat',wearer:'Men',name:'J-M2 ready',unit:'in',fit:'Tailored',ready:{waistcoat:'40'}}),200,'checkout accepts the garment shaped waistcoat ready profile');
  assert.deepEqual(lastReady(),{waistcoat:'40'},'the stored waistcoat order records only the waistcoat size');
  assert.equal(await checkout(pantsIdx,{version:2,method:'ready',garment:'pants',wearer:'Men',name:'J-M2 ready',unit:'in',fit:'Tailored',ready:{trouser:'34'}}),400,'checkout refuses a version 2 trousers ready profile without its inseam choice');
  assert.equal(await checkout(pantsIdx,{method:'ready',wearer:'Men',name:'J-M2 legacy ready',unit:'in',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'}}),200,'checkout still accepts a version 1 ready profile');
  assert.deepEqual(lastReady(),{jacket:'40',length:'Regular',trouser:'34'},'a version 1 ready profile is stored in its historical shape');
  console.log('J-M2c (server) passed: checkout stores only the garment shaped ready parts, refuses a trousers ready profile without its inseam, and keeps version 1 ready profiles in their historical shape.');
})().catch(e=>{console.error(e);process.exit(1)});
