const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Journey J-M3 (measurements wave, package M3): the garment aware
// Measurement Studio extends from suits, jackets, trousers and
// waistcoats (M1 and M2) to shirts. Shirt measuring collects
// exactly the verified 7 field set, neck first, then chest, sleeve,
// shoulder, front length, stomach and seat, plus the Shirt Fit
// selector (default Relaxed), and saves a version 2 shirt profile.
// No waist, bicep, wrist, jacket length or leg field is ever asked,
// the sleeve guidance is the shirt variant (shoulder tip to the
// knuckle of the thumb, not the suit's wrist landmark), and a shirt
// profile cannot be saved without a neck value, the field a collar
// is cut from. Legacy completion offers extend to shirts with the
// M1 design, and Quick Add routes shirts with no suitable profile
// into the same flow. Driven on the real storefront scripts in a
// Node vm with stubbed DOM and storage, in the style of the other
// suites.

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

// ---------------------------------------------------------------- J-M3
// Shirt measuring end to end: exactly the verified 7 field set in
// order with neck first, the shirt sleeve guidance, the Shirt Fit
// selector, a version 2 shirt profile, and the bag and demo order
// carrying it. Quick Add and the legacy completion offer cover
// shirts too.
{
  const w=makeWorld();
  w.run('chooseProduct(12)');w.run('beginDesign(12)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  assert.equal(w.run('draft.garment'),'shirt','the session carries the shirt garment');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active for a Men shirt');
  assert.ok(/^Shirt_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentSteps().length'),4,'the shirt flow has method, preamble, one fields step and review');

  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the shirt fields');

  // Exactly the verified shirt set, neck first, in order; no waist,
  // bicep, jacket length or leg field is asked.
  const fieldsHtml=w.run('measure()');
  const order=['neck','chest','sleeve','shoulder','frontLength','stomach','seat'];
  assert.deepEqual(fieldOrder(fieldsHtml,order).slice().sort((a,b)=>a-b),fieldOrder(fieldsHtml,order),'the shirt fields render in the verified order, neck first');
  for(const id of order)assert.ok(fieldsHtml.includes('measureInput-'+id),'the shirt flow asks for '+id);
  assert.equal(inputCount(fieldsHtml),7,'the shirt step asks for exactly 7 measurements');
  for(const id of ['waist','trouserWaist','bicep','jacket','pantsLength','frontRise','backRise','thigh','knee','legOpening','inseam','outseam'])assert.ok(!fieldsHtml.includes('measureInput-'+id),'the shirt flow never asks for '+id);
  assert.ok(!fieldsHtml.includes('Wrist'),'the shirt flow has no wrist field');
  assert.ok(fieldsHtml.includes('Your shirt')&&!fieldsHtml.includes('Your jacket'),'the progress shows a shirt step and no jacket step');
  assert.ok(fieldsHtml.includes('Garment target'),'front length is labeled as a garment target');
  assert.equal(w.run("garmentFigure('neck')").includes('M131 76 Q150 88 169 76'),true,'the figure highlights the neck line drawn for this field');
  assert.equal(w.run("garmentFigure('frontLength')").includes('M136 83 L136 280'),true,'the figure highlights the front length line drawn for this field');

  // Every shirt field is required, and the problems are still
  // reported all at once (the kept SIZ-06 divergence).
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'empty shirt fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),7,'all seven required shirt fields are reported together');

  // Neck is the field a collar is cut from: with everything else
  // filled it alone blocks, by name, and the schema refuses a
  // neckless shirt profile outright.
  w.run("updateValue('chest','40');updateValue('sleeve','25');updateValue('shoulder','18');updateValue('frontLength','30');updateValue('stomach','34');updateValue('seat','40')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a shirt without a neck value cannot advance');
  assert.ok(w.elFor('#measureError').textContent.includes('Please check neck.'),'the single remaining problem names the neck');
  assert.equal(w.run("validateProfile({version:2,method:'body',garment:'shirt',wearer:'Men',wearerName:'Alex Kumar',name:'No neck',unit:'in',fit:'Tailored',fits:{shirtFit:'Relaxed'},values:{height:70,chest:40,sleeve:25,shoulder:18,frontLength:30,stomach:34,seat:40}},'shirt').ok"),false,'the shared schema refuses a shirt profile with no neck value');
  w.run("updateValue('neck','15.5')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'a completed shirt set advances to review');

  // The sleeve guidance is the shirt variant, in the guide modal
  // and in the drawing tip, and the neck guidance is neck specific.
  w.run("gShowGuide('sleeve')");
  const sleeveGuide=w.elFor('#modalContent').innerHTML;
  assert.ok(sleeveGuide.includes('knuckle of your thumb'),'the shirt sleeve guide measures to the knuckle of the thumb');
  assert.ok(!sleeveGuide.includes('wrist bone'),'the shirt sleeve guide never uses the suit wrist landmark');
  w.run("gShowGuide('neck')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('one finger between the tape and your neck'),'the neck guide keeps a finger between tape and neck');
  w.run("focusGarmentField('sleeve')");
  assert.ok(w.elFor('#drawingTip').textContent.includes('knuckle of your thumb'),'the drawing tip for a shirt sleeve is the shirt variant');

  // Review: one Shirt group, the Shirt Fit selector only.
  const review=w.run('measure()');
  assert.ok(review.includes('>Shirt<'),'the review groups the values under Shirt');
  assert.ok(review.includes('Shirt Fit')&&!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the review carries the shirt fit selector only');
  assert.equal(w.run('draft.fits.shirtFit'),'Relaxed','the shirt fit starts at the benchmark default');
  w.run("draft.fits.shirtFit='Slim Fit';saveDraft()");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the shirt profile');
  const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(p.version,2,'the saved profile is version 2');
  assert.equal(p.garment,'shirt','the saved profile names its garment');
  assert.deepEqual(p.values,{height:70,neck:15.5,chest:40,sleeve:25,shoulder:18,frontLength:30,stomach:34,seat:40},'the saved values are exactly the shirt set plus height');
  assert.deepEqual(p.fits,{shirtFit:'Slim Fit'},'the saved profile carries the shirt fit selection only');
  assert.equal(w.run("validateProfile(profiles[0],'shirt').ok"),true,'the saved profile passes the shared schema validation');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');

  // Bag and demo checkout keep the shirt profile intact, and the
  // summary lists exactly the shirt fields and the shirt fit.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  assert.equal(w.run('profileSummary(bag[0])'),'Body measurements · Height 70 in · Neck 15.5 in · Chest 40 in · Sleeve length 25 in · Shoulder width 18 in · Front length 30 in · Stomach 34 in · Seat / hips 40 in · Shirt Fit Slim Fit','the profile summary lists the shirt set and fit in order');
  const lineHtml=w.run('lineHtml(bag[0])');
  for(const text of ['Neck 15.5 in','Front length 30 in','Shirt Fit Slim Fit'])assert.ok(lineHtml.includes(text),'the bag line lists: '+text);
  assert.ok(!lineHtml.includes('Waist'),'the bag line never shows a waist for a shirt');
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:{email:'jm3@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].items[0].profile.garment,'shirt','the order item carries the shirt profile');
  assert.deepEqual(orders[0].items[0].profile.values,p.values,'the order item carries the measured values intact');
  assert.deepEqual(orders[0].items[0].profile.fits,p.fits,'the order item carries the shirt fit intact');

  // Quick Add for a shirt with no profile routes into measuring.
  const wq=makeWorld();
  wq.run('quickAddProduct(12)');
  assert.ok(wq.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for a shirt with no profile offers the measuring flow');
  wq.run('quickAddMeasure(12)');
  assert.equal(wq.run('draft.garment'),'shirt','the quick add route carries the shirt garment');
  assert.equal(wq.run('garmentMode()'),true,'the quick add route lands in the garment aware studio');

  // Legacy completion offer for a shirt: exactly the owed fields,
  // cancel byte safe, completion writes version 2 in place with
  // only the shirt set carried across.
  const wc=makeWorld({profiles:[LEGACY]});
  wc.run('chooseProduct(12)');wc.run('beginDesign(12)');
  wc.run('nextConfig()');wc.run('nextConfig()');
  wc.run("chooseCustomizerProfile('legacy-1')");
  const offerHtml=wc.run('customize()');
  assert.ok(offerHtml.includes('still needs:'),'selecting the legacy profile for a shirt offers completion');
  for(const label of ['Neck','Front length','Stomach','Shirt Fit'])assert.ok(offerHtml.includes(label),'the shirt offer names the missing: '+label);
  assert.deepEqual(JSON.parse(wc.run("JSON.stringify(missingForCompletion(profiles[0],'shirt'))")),['wearerName','height','neck','frontLength','stomach','shirtFit'],'the shirt owed fields are exactly the schema completion list');
  const before=wc.store.get('suits-profiles');
  wc.run("startProfileCompletion('legacy-1')");
  wc.run('cancelCompletion()');
  assert.equal(wc.store.get('suits-profiles'),before,'cancelling leaves the stored legacy profile byte identical');
  wc.run("startProfileCompletion('legacy-1')");
  wc.run('measureNext()');
  wc.run("draft.wearerName='Sam';updateValue('height','71')");
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),2,'the shirt completion advances to the shirt fields');
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),2,'the owed shirt fields still block');
  assert.equal(liCount(wc.elFor('#measureError').innerHTML),3,'exactly the three owed shirt fields are reported');
  wc.run("updateValue('neck','16');updateValue('frontLength','31');updateValue('stomach','35')");
  wc.run('measureNext()');
  assert.equal(wc.run('draft.step'),3,'the completed values advance to review');
  wc.elFor('#confirmMeasures').checked=true;
  wc.run('measureNext()');
  assert.equal(wc.run('profiles.length'),1,'completion saves in place, no duplicate profile');
  const cp=JSON.parse(wc.run('JSON.stringify(profiles[0])'));
  assert.equal(cp.id,'legacy-1','the completed profile keeps its id');
  assert.equal(cp.version,2,'the completed shirt profile is version 2');
  assert.equal(cp.garment,'shirt','the completed profile names the shirt garment');
  assert.deepEqual(cp.values,{height:71,neck:16,chest:40,sleeve:25,shoulder:18,frontLength:31,stomach:35,seat:40},'the completed values are exactly the shirt set: carried chest, sleeve, shoulder and seat, newly measured neck, front length and stomach');
  for(const key of ['waist','trouserWaist','jacket','thigh','inseam','outseam'])assert.ok(!(key in cp.values),'the completed shirt values carry no '+key);
  assert.equal(cp.fits.shirtFit,'Relaxed','the shirt fit lands at its benchmark default as an option selection');
  assert.equal(wc.run("validateProfile(profiles[0],'shirt').ok"),true,'the completed profile passes the shared schema validation');
  console.log('J-M3 passed: a shirt is measured with exactly the verified 7 field set, neck first and required, with the shirt sleeve guidance and the Shirt Fit selector, saved as a version 2 profile through bag and demo order, quick add routes into measuring, and the legacy completion offer covers shirts with byte safe cancel.');
}
