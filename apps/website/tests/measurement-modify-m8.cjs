const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path');
// Journey J-M8 (measurements wave, package M8): the modify a
// standard size entry mode, the benchmark's third entry mode
// (owner decision O10). The shopper picks a standard size (jacket
// size, jacket length, trouser waist, inseam) and adjusts garment
// detail fields to the exact finished dimensions they want. The
// mode was verified for the suit only (capture of 2026-10-29);
// how the benchmark populates its detail fields was NOT observed,
// so the population rule pinned here is suits.me's design under
// the alignment study: a detail field starts filled only where
// the size guide (package M5) publishes a finished value for the
// chosen size, it stays marked as a size guide value until the
// shopper edits it, fields the guide does not publish for that
// size start empty, and nothing reaches a profile except through
// the review screen's explicit save. The saved profile is a
// distinct kind, method 'modify', recording the base size and the
// reviewed garment dimensions, validated against the garment
// ranges and labeled as a modified standard size everywhere it
// is summarized, never as body measurements. The server half runs
// the real lib/commerce.ts and lib/accounts.ts: the same profile
// is accepted or refused identically by the client validator, the
// account profile store and checkout, the stored order carries
// the cleaned base and values, and a deferred order (package M6)
// can be completed with a modify profile. Driven on the real
// storefront scripts in a Node vm with stubbed DOM and storage,
// in the style of the other suites.

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
  const orders=()=>JSON.parse(store.get('suits-orders')||'[]');
  return{run,elFor,store,bag,orders};
}
const liCount=html=>(html.match(/<li>/g)||[]).length;
const inputCount=html=>(html.match(/measureInput-/g)||[]).length;
const fieldOrder=(html,ids)=>ids.map(id=>html.indexOf('measureInput-'+id));
// The verified suit modify set in the form's order (capture of
// 2026-10-29), split into the studio's two field steps. The
// outseam is the set's one optional field.
const MODIFY_ORDER=['gJacketChest','gShoulderWidth','gJacketMidsection','gJacketLength','gSleeveLength','gBicepWidth','gSleeveOpening','gWaistCircumference','gHipWidth','gThighWidth','gKneeWidth','gLegOpening','gFrontRise','gInseam','gOutseam'];
const MODIFY_JACKET_STEP=['gJacketChest','gShoulderWidth','gJacketMidsection','gJacketLength','gSleeveLength','gBicepWidth','gSleeveOpening'];
const MODIFY_TROUSER_STEP=['gWaistCircumference','gHipWidth','gThighWidth','gKneeWidth','gLegOpening','gFrontRise','gInseam','gOutseam'];
const BASE={jacket:40,length:'Regular',trouser:34,inseam:32};
// What the size guide publishes for that base: the finished chest
// rule (40 + 3) and jacket row 40 (shoulder 18, stomach 40.5,
// sleeve 24.5, Regular length 29.5); trousers 34 publishes only
// its finished waist (36); the inseam detail starts from the
// shopper's own inseam selection (32). No other field may start
// filled: the guide publishes no bicep width or sleeve opening
// anywhere, and nothing at all for the other trouser fields at 34.
const PREFILL={gJacketChest:43,gShoulderWidth:18,gJacketMidsection:40.5,gJacketLength:29.5,gSleeveLength:24.5,gWaistCircumference:36,gInseam:32};
// The saved values: the two adjusted fields (jacket chest 44,
// sleeve length 25), the guide values the shopper reviewed and
// kept, and the dimensions they entered themselves. The optional
// outseam is left empty and is not stored.
const MODIFY_VALUES={gJacketChest:44,gShoulderWidth:18,gJacketMidsection:40.5,gJacketLength:29.5,gSleeveLength:25,gBicepWidth:13,gSleeveOpening:9.5,gWaistCircumference:36,gHipWidth:41,gThighWidth:23,gKneeWidth:15.5,gLegOpening:15,gFrontRise:11,gInseam:32};
const ENTERED={gBicepWidth:'13',gSleeveOpening:'9.5',gHipWidth:'41',gThighWidth:'23',gKneeWidth:'15.5',gLegOpening:'15',gFrontRise:'11'};
const BODY_PROFILE={id:'body-profile-1',version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Saved suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{height:70,chest:40,sleeve:25,shoulder:18,jacket:29,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24},created:'2026-02-01T00:00:00.000Z'};
const SAVED_MODIFY_PROFILE={id:'modify-profile-1',version:2,method:'modify',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'My usual 40',unit:'in',fit:'Tailored',base:{...BASE},values:{...MODIFY_VALUES},created:'2026-02-02T00:00:00.000Z'};
const SHIPPING_FORM={email:'jm8@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'};
function demoCheckout(w){
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:${JSON.stringify(SHIPPING_FORM)}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
}

// ---------------------------------------------------------------- J-M8 client
// The suit modify mode end to end: the customizer offers the mode
// as its own card, the studio collects the wearer's name, the
// standard size and the verified detail set in order, starting
// from exactly the guide's published values for the chosen size,
// two detail fields are adjusted, and the saved profile records
// the base and the reviewed dimensions through the bag, the
// configuration review and the demo order, labeled as a modified
// standard size, never as body measurements.
{
  const w=makeWorld({profiles:[BODY_PROFILE,SAVED_MODIFY_PROFILE]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  assert.equal(w.run('stage'),2,'the customizer reaches the Measurements step');
  const methods=w.run('customize()');
  assert.ok(methods.includes('Modify a standard size'),'the modify mode is offered as its own customizer method');
  assert.ok(methods.includes('My usual 40 · Modified standard size'),'a saved modify profile is labeled as a modified standard size in the profile select');
  assert.ok(methods.includes('Saved suit fit · Custom measurements'),'a body profile keeps its own label');

  w.run("setCustomizerMethod('modify')");
  assert.equal(w.run('customizerMethod()'),'modify','the modify method is the active choice');
  assert.equal(w.run('draft.method'),'modify','the Studio draft carries the modify method');
  assert.equal(w.run('config.profileId'),'modify-profile-1','the saved modify profile for the wearer is selected');

  // Into the studio: the garment aware studio runs the modify flow.
  w.run('startMeasurements()');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active in modify mode');
  assert.equal(w.run('draft.garment'),'suit','the session carries the suit garment');
  assert.ok(/^Suit_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentFlowSteps().length'),6,'the modify flow has method, name, sizes, jacket fields, trousers fields and review steps');
  const methodHtml=w.run('measure()');
  assert.ok(methodHtml.includes('Modify a standard size'),'the studio method step offers the modify mode too');
  assert.ok(methodHtml.includes('start from its finished garment dimensions in our size guide'),'the method step explains that the mode starts from the size guide dimensions');

  // The name step: the wearer's name only, no height is asked.
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name step');
  const nameHtml=w.run('measure()');
  assert.ok(nameHtml.includes('wearerNameInput'),'the name step asks for the wearer name');
  assert.ok(!nameHtml.includes('measureInput-height'),'the modify form asks for no height, as the verified form has none');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'an empty wearer name cannot advance');
  assert.ok(w.elFor('#measureError').textContent.includes('Please add the name'),'the missing name is reported');
  w.run("draft.wearerName='Alex Kumar';saveDraft()");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed name advances to the standard size step');

  // The sizes step: exactly the four verified selectors, nothing
  // preselected, and advancing is blocked until all are chosen.
  const sizesHtml=w.run('measure()');
  assert.equal((sizesHtml.match(/<select/g)||[]).length,4,'the sizes step has exactly four selects: jacket size, jacket length, trouser waist and inseam');
  for(const label of ['Jacket size (US)','Jacket length','Trouser size (US)','Inseam'])assert.ok(sizesHtml.includes(label),'the sizes step asks for '+label);
  assert.ok(!sizesHtml.includes('Unhemmed'),'the modify inseam selector offers exact inseams only, no Unhemmed');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'unchosen sizes cannot advance');
  assert.equal(w.elFor('#measureError').textContent,'Choose your jacket size, jacket length, trouser size, inseam to continue. No standard size is preselected.','the blocked message names every missing choice');
  w.run("setModifyBasePart('jacket','40')");w.run("setModifyBasePart('length','Regular')");w.run("setModifyBasePart('trouser','34')");w.run("setModifyBasePart('inseam','32')");
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(draft.base)')),BASE,'the base records exactly the chosen standard size');
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(draft.values)')),PREFILL,'choosing the size starts exactly the fields the size guide publishes for it, and no others');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'chosen sizes advance to the jacket detail fields');

  // The jacket step: exactly the jacket block of the verified
  // modify set in order, the guide values shown and marked, the
  // unpublished fields empty, on a flat garment diagram.
  const jacketHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(jacketHtml,MODIFY_JACKET_STEP).slice().sort((a,b)=>a-b),fieldOrder(jacketHtml,MODIFY_JACKET_STEP),'the jacket detail fields render in the verified order');
  assert.equal(inputCount(jacketHtml),7,'the jacket step asks for exactly 7 detail fields');
  for(const id of MODIFY_JACKET_STEP)assert.ok(jacketHtml.includes('measureInput-'+id),'the jacket step asks for '+id);
  assert.ok(jacketHtml.includes('Starting value from the size guide'),'a prefilled field is marked as a size guide starting value');
  assert.ok(/<input id="measureInput-gJacketChest"[^>]*value="43"/.test(jacketHtml),'the jacket chest starts at the published finished value 43');
  assert.ok(/<input id="measureInput-gBicepWidth"[^>]*value=""/.test(jacketHtml),'the bicep width starts empty: the guide publishes no bicep width');
  assert.ok(/<input id="measureInput-gSleeveOpening"[^>]*value=""/.test(jacketHtml),'the sleeve opening starts empty: the guide publishes no sleeve opening');
  assert.ok(jacketHtml.includes('Garment measurement'),'every field is labeled a garment measurement');
  assert.ok(!jacketHtml.includes('Body measurement'),'no field on the modify step is labeled a body measurement');
  assert.ok(jacketHtml.includes('Diagram of a garment laid flat'),'the illustration is a flat garment diagram, not the body figure');

  // Adjust two detail fields (the study's J-M8 journey): the
  // adjusted fields stop being guide values, the kept ones stay
  // marked, and the two unpublished fields still block the step.
  w.run("updateModifyValue('gJacketChest','44')");w.run("updateModifyValue('gSleeveLength','25')");
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(draft.modifyPrefilled)')),['gShoulderWidth','gJacketMidsection','gJacketLength','gWaistCircumference','gInseam'],'editing a field unmarks it as a guide value; the untouched ones stay marked');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the unpublished fields cannot be skipped: they start empty and are required');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),2,'exactly the two unpublished jacket fields are reported');
  w.run("updateModifyValue('gBicepWidth','13')");w.run("updateModifyValue('gSleeveOpening','9.5')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'completed jacket fields advance to the trousers detail fields');

  // The trousers step: exactly the trousers block in order. For
  // a 34 waist the guide publishes only the finished waist, and
  // the inseam starts from the shopper's own selection; the rest
  // start empty, and the optional outseam may stay empty.
  const trouserHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(trouserHtml,MODIFY_TROUSER_STEP).slice().sort((a,b)=>a-b),fieldOrder(trouserHtml,MODIFY_TROUSER_STEP),'the trouser detail fields render in the verified order');
  assert.equal(inputCount(trouserHtml),8,'the trousers step asks for exactly 8 detail fields');
  assert.ok(/<input id="measureInput-gWaistCircumference"[^>]*value="36"/.test(trouserHtml),'the waist circumference starts at the published finished waist 36');
  assert.ok(/<input id="measureInput-gInseam"[^>]*value="32"/.test(trouserHtml),'the inseam detail starts from the shopper own inseam selection');
  assert.ok(/<input id="measureInput-gHipWidth"[^>]*value=""/.test(trouserHtml),'the hip width starts empty: the guide publishes no hip width for a 34 waist');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'the unentered trouser fields cannot be skipped');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),5,'exactly the five required unentered trouser fields are reported; the optional outseam is not one of them');
  for(const [id,v] of Object.entries(ENTERED))if(!MODIFY_JACKET_STEP.includes(id))w.run(`updateModifyValue('${id}','${v}')`);
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),5,'completed trouser fields advance to review, the optional outseam left empty');

  // Review: the base size and the dimensions together, stated to
  // be garment measurements the shopper has seen and confirmed,
  // and no fit selector anywhere.
  const review=w.run('measure()');
  assert.ok(review.includes('Your standard size'),'the review shows the standard size the profile started from');
  assert.ok(review.includes('Jacket size (US)')&&review.includes('Regular'),'the review lists the base choices');
  assert.ok(review.includes('not body measurements'),'the review states the dimensions are not body measurements');
  assert.ok(review.includes('Jacket chest')&&review.includes('44'),'the review lists the adjusted jacket chest');
  assert.ok(review.includes('Left empty (optional)'),'the review shows the optional outseam was left empty');
  assert.ok(!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the modify review carries no fit selector, as the verified form has none');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  const p=JSON.parse(w.run('JSON.stringify(profiles[profiles.length-1])'));
  assert.equal(p.method,'modify','the saved profile is a modify profile');
  assert.equal(p.version,2,'the saved profile is version 2');
  assert.equal(p.garment,'suit','the saved profile names its garment');
  assert.equal(p.wearerName,'Alex Kumar','the saved profile carries the wearer name');
  assert.deepEqual(p.base,BASE,'the saved profile records the standard size it started from');
  // The no unentered value guard: the stored values are exactly
  // the fields the shopper saw on the two detail steps, each one
  // either a published guide value for the chosen size, the
  // shopper's own inseam selection, or a number they typed; the
  // optional outseam they left empty is absent, and there is no
  // height and no fit selection.
  assert.deepEqual(p.values,MODIFY_VALUES,'the saved values are exactly the reviewed dimensions');
  assert.deepEqual(Object.keys(p.values),MODIFY_ORDER.filter(k=>k!=='gOutseam'),'the saved values are stored in the verified set order, minus the empty optional outseam');
  assert.ok(!('gOutseam' in p.values),'the empty optional outseam is not stored as a measurement');
  assert.ok(!('height' in p.values),'no height is stored: the modify form asks for none and none is invented');
  assert.ok(!('fits' in p),'the modify profile records no fit selections');
  assert.equal(w.run("validateProfile(profiles[profiles.length-1],'suit').ok"),true,'the saved profile passes the shared schema validation as a modify profile');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');
  assert.equal(w.run('config.profileId'),p.id,'the saved modify profile is selected for the garment');

  // Bag, configuration review and demo order carry the profile
  // labeled as a modified standard size, base first.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const summary=w.run('profileSummary(bag[0])');
  assert.ok(summary.startsWith('Modified standard size · Jacket size 40 · Jacket length Regular · Trouser size 34 · Inseam 32 · Jacket chest 44 in'),'the bag summary leads with the modified size label and the base: '+summary);
  assert.ok(summary.includes('Sleeve length 25 in'),'the bag summary carries the adjusted sleeve length');
  assert.ok(!summary.includes('Outseam'),'the bag summary omits the empty optional outseam');
  assert.ok(!summary.includes('Body measurements'),'the bag summary never calls the dimensions body measurements');
  const line=w.run('lineHtml(bag[0])');
  assert.ok(line.includes('Modified standard size · '),'the bag line shows the modify summary');
  w.run('openBag()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Modified standard size'),'the bag modal labels the profile as a modified standard size');
  w.run('reviewOrder()');
  const reviewModal=w.elFor('#modalContent').innerHTML;
  assert.ok(reviewModal.includes('Jacket size (US)')&&reviewModal.includes('Jacket chest'),'the configuration review lists the base and the dimensions');
  assert.ok(!reviewModal.includes('NaN'),'the configuration review never renders modify values through the body fields');
  demoCheckout(w);
  assert.equal(w.orders().length,1,'the demo checkout records exactly one order');
  const orderProfile=w.orders()[0].items[0].profile;
  assert.equal(orderProfile.method,'modify','the demo order item carries the modify profile');
  assert.deepEqual(orderProfile.base,BASE,'the demo order carries the base size intact');
  assert.deepEqual(orderProfile.values,MODIFY_VALUES,'the demo order carries the reviewed dimensions intact');
  const page=w.run(`orderPage('${w.orders()[0].id}')`);
  assert.ok(page.includes('Modified standard size · Jacket size 40'),'the order page shows the modify summary with its base');
  assert.ok(w.run(`profileSummary({profile:${JSON.stringify(BODY_PROFILE)}})`).startsWith('Body measurements · '),'a body profile still summarizes as body measurements');
  console.log('J-M8 (client) passed: a suit is built by modifying a standard size, the detail fields start from exactly the published guide values for the chosen size, two fields are adjusted, the rest are entered, and the saved version 2 modify profile records the base and the reviewed dimensions through the bag and the demo order.');
}

// ---------------------------------------------------------------- J-M8 client
// Quick Add reaches the mode through the studio method step, and
// the prefill discipline is pinned at the sizes step: a size the
// guide does not publish values for starts its fields empty, an
// untouched guide value follows a size change and clears when its
// basis is removed, and an edited value is never overwritten.
{
  const wq=makeWorld();
  wq.run('quickAddProduct(0)');
  assert.ok(wq.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for a suit with no profile offers the measuring flow');
  wq.run('quickAddMeasure(0)');
  assert.equal(wq.run('draft.garment'),'suit','the quick add route carries the suit garment');
  const methodHtml=wq.run('measure()');
  assert.ok(methodHtml.includes('Modify a standard size'),'the studio reached from quick add offers the modify mode');
  wq.run("setMethod('modify')");
  assert.equal(wq.run('garmentMode()'),true,'choosing the modify mode in the studio activates the modify flow');
  assert.equal(wq.run('garmentFlowSteps().length'),6,'the modify flow steps are the modify ones');

  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('modify')");
  w.run('startMeasurements()');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';saveDraft()");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the flow reaches the sizes step');
  // A 42 jacket is not one of the chart's sample sizes: only the
  // finished chest rule (42 + 3) may start a field, and a Long
  // length starts no length at all.
  w.run("setModifyBasePart('jacket','42')");w.run("setModifyBasePart('length','Long')");
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(draft.values)')),{gJacketChest:45},'for a size with no published row, only the stated finished chest rule starts a field; shoulder, midsection, sleeve and length stay empty rather than interpolated');
  // Changing to a published size fills its values; an edited
  // value is then immune to later size changes, while untouched
  // guide values follow the size.
  w.run("setModifyBasePart('jacket','40')");w.run("setModifyBasePart('length','Regular')");
  assert.equal(w.run('draft.values.gShoulderWidth'),18,'the published size fills its guide values');
  w.run("updateModifyValue('gShoulderWidth','19')");
  w.run("setModifyBasePart('jacket','44')");
  assert.equal(w.run('draft.values.gShoulderWidth'),19,'an edited field is never overwritten by a size change');
  assert.equal(w.run('draft.values.gJacketChest'),47,'an untouched guide value follows the new size');
  assert.equal(w.run('draft.values.gJacketLength'),31,'an untouched guide length follows the new size too');
  // Removing the size removes its untouched guide values with it:
  // nothing the shopper never entered survives as a measurement.
  w.run("setModifyBasePart('jacket','')");
  assert.equal(w.run('draft.values.gJacketChest'),undefined,'clearing the size clears the untouched guide values it had started');
  assert.equal(w.run('draft.values.gJacketLength'),undefined,'the guide length clears with its size');
  assert.equal(w.run('draft.values.gShoulderWidth'),19,'the edited value remains the shopper own');
  console.log('J-M8 (client, doors and prefill) passed: quick add reaches the modify mode through the studio method step, unpublished sizes start empty, edited values are never overwritten, and untouched guide values never survive the size that started them.');
}

// ---------------------------------------------------------------- J-M8 client
// The shared validator guards on the client surface: the base is
// validated like a ready profile's parts, the detail values
// against the garment ranges, and the kinds are never mixed.
{
  const w=makeWorld();
  const MODIFY_PROFILE={version:2,method:'modify',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Usual 40',unit:'in',fit:'Tailored',base:{...BASE},values:{...MODIFY_VALUES}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(MODIFY_PROFILE)},'suit').ok`),true,'a complete modify profile validates');
  assert.deepEqual(JSON.parse(w.run(`JSON.stringify(cleanModifyBase({jacket:'40',length:'Regular',trouser:'34',inseam:'32'},'suit','Men'))`)),BASE,'the base is stored canonically: sizes as numbers, the length as its word');
  const noBase={...MODIFY_PROFILE,base:{jacket:40,length:'Regular',trouser:34}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(noBase)},'suit').ok`),false,'a modify profile missing a base part is refused');
  const oldSize={...MODIFY_PROFILE,base:{...BASE,jacket:34}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(oldSize)},'suit').ok`),false,'a base size outside the aligned sets is refused: 34 is no longer offered');
  const unhemed={...MODIFY_PROFILE,base:{...BASE,inseam:'Unhemmed'}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(unhemed)},'suit').ok`),false,'an Unhemmed inseam is refused as a modify base: the mode starts from an exact inseam');
  const missingValue={...MODIFY_PROFILE,values:{...MODIFY_VALUES}};delete missingValue.values.gFrontRise;
  assert.equal(w.run(`validateProfile(${JSON.stringify(missingValue)},'suit').ok`),false,'a modify profile missing a required detail field is refused');
  const withHeight={...MODIFY_PROFILE,values:{...MODIFY_VALUES,height:70}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(withHeight)},'suit').ok`),false,'a height inside modify values is refused: the mode asks for none');
  const mixed={...MODIFY_PROFILE,values:{...MODIFY_VALUES,chest:40}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(mixed)},'suit').ok`),false,'a body field inside a modify profile is refused: the kinds are never mixed');
  const withFits={...MODIFY_PROFILE,fits:{jacketFit:'Regular Fit'}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(withFits)},'suit').ok`),false,'a modify profile carrying fit selections is refused');
  const legacy={...MODIFY_PROFILE};delete legacy.version;
  assert.equal(w.run(`validateProfile(${JSON.stringify(legacy)},'suit').ok`),false,'a modify profile with no version 2 marker is refused: there is no legacy modify shape');
  const boys={...MODIFY_PROFILE,wearer:'Boys'};
  assert.equal(w.run(`validateProfile(${JSON.stringify(boys)},'suit').ok`),false,'a Boys modify profile is refused: no finished values are published by age to start from');
  const womenJacket={...MODIFY_PROFILE,garment:'jacket',wearer:'Women',base:{jacket:40,length:'Regular'},values:{gJacketChest:44,gShoulderWidth:18,gJacketMidsection:40.5,gJacketLength:29.5,gSleeveLength:25,gBicepWidth:13,gSleeveOpening:9.5}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(womenJacket)},'jacket').ok`),false,'a Women jacket modify profile is refused: her sizes carry no published jacket row');
  const womenSuit={...MODIFY_PROFILE,wearer:'Women',base:{womenSize:40}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(womenSuit)},'suit').ok`),true,'a Women suit modify profile on her bust keyed base validates');
  assert.deepEqual(JSON.parse(w.run(`JSON.stringify(modifyPrefillFor('womens-suit',{womenSize:40},'Women'))`)),{gJacketChest:44},'for a women base only the published finished bust starts a field: the jacket chest, at the size plus 4');
  const wrongGarment={...MODIFY_PROFILE,garment:'shirt'};
  assert.equal(w.run(`validateProfile(${JSON.stringify(wrongGarment)},'shirt').ok`),false,'a modify profile validates against its own garment set: suit values are unknown keys in the shirt set');
  const wide={...MODIFY_PROFILE,values:{...MODIFY_VALUES,gJacketChest:72}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(wide)},'suit').ok`),true,'a finished jacket chest of 72 validates against the garment range, past the body chest maximum of 70');
  w.run("draft.garment='suit';draft.wearer='Boys';draft.method='modify';saveDraft()");
  assert.equal(w.run('garmentMode()'),false,'the studio does not run the modify mode for Boys');
  w.run("draft.wearer='Women';saveDraft()");
  assert.equal(w.run('garmentMode()'),true,'the studio runs the modify mode for a Women suit, on her bust keyed base');
  console.log('J-M8 (client, guards) passed: the shared validator holds the base to the aligned sets, keeps modify values in garment ranges and out of body fields, and offers the mode only where a base with published starting values exists.');
}

// ---------------------------------------------------------------- J-M8 server
// The real lib/commerce.ts and lib/accounts.ts: checkout and the
// account profile store accept and refuse the modify profile
// identically, the stored order carries the cleaned base and
// values in set order at the unchanged price, and a deferred
// order can be completed with a modify profile through the
// package M6 endpoint.
function loadLib(rel){const file=path.resolve(rel),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return m.exports}
class CommerceDB{constructor(){this.rows=[]}prepare(sql){const self=this;return{bind(...args){return{
  async first(){
    if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;
    if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;
    if(sql.includes('FROM store_orders'))return self.rows.find(r=>r.id===args[0])||null;
    return null},
  async run(){
    if(sql.startsWith('INSERT INTO store_orders')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}
    if(sql.startsWith('UPDATE store_orders SET items=')){const row=self.rows.find(r=>r.id===args[1]&&r.owner===args[2]);if(row)row.items=args[0]}
    if(sql.startsWith('DELETE')){self.rows=self.rows.filter(r=>!(r.id===args[0]&&r.owner===args[1]))}
    return{success:true}},
  async all(){return{results:[]}}
}}}}}
function matchWhere(row,where,args){if(!where)return true;let ai=0;return where.split(' AND ').every(cond=>{const c=cond.trim().match(/^(\w+)(=|<>)(\?|NULL)$/);if(!c)throw Error('Fake DB cannot parse condition: '+cond);if(c[3]==='NULL')return c[2]==='='?(row[c[1]]===null||row[c[1]]===undefined):!(row[c[1]]===null||row[c[1]]===undefined);const v=args[ai++];return c[2]==='='?row[c[1]]===v:row[c[1]]!==v;});}
class AccountDB{
 constructor(){this.users=[];this.user_credentials=[];this.user_identities=[];this.sessions=[];this.auth_tokens=[];this.auth_attempts=[];this.account_profiles=[];this.account_order_snapshots=[];this.store_orders=[];}
 prepare(sql){const self=this;return{bind(...args){return{async first(){return self.query(sql,args)[0]||null;},async all(){return{results:self.query(sql,args)};},async run(){self.query(sql,args);return{success:true};}}}};}
 query(sql,args){
  let m;
  if(m=sql.match(/^SELECT \* FROM (\w+)(?: WHERE (.+))?$/))return this[m[1]].filter(r=>matchWhere(r,m[2],args));
  if(m=sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/)){const cols=m[2].split(','),vals=m[3].split(','),row={};let ai=0;cols.forEach((c,i)=>{row[c]=vals[i].trim()==='?'?args[ai++]:vals[i].trim()==='NULL'?null:vals[i].trim();});this[m[1]].push(row);return[row];}
  if(m=sql.match(/^UPDATE (\w+) SET (.+) WHERE (.+)$/)){const sets=m[2].split(',').map(s=>s.trim()),rows=this[m[1]].filter(r=>matchWhere(r,m[3],args.slice(sets.length)));for(const r of rows)sets.forEach((s,i)=>{r[s.split('=')[0]]=args[i];});return rows;}
  if(m=sql.match(/^DELETE FROM (\w+) WHERE (.+)$/)){const kept=this[m[1]].filter(r=>!matchWhere(r,m[2],args));this[m[1]]=kept;return[];}
  throw Error('Fake DB cannot run: '+sql);
 }
}
(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  const accountsLib=loadLib('lib/accounts.ts');
  const {accounts,SESSION_COOKIE}=accountsLib;
  const EMAIL={EMAIL_API_URL:'https://mail.example/send',EMAIL_API_KEY:'test-mail-key',EMAIL_FROM:'Suits.me <accounts@example.com>'};
  global.fetch=async(url,init)=>{if(url===EMAIL.EMAIL_API_URL)return Response.json({ok:true});if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url)};
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit');
  assert.ok(suitIdx>=0,'the catalog has a suit product');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const post=async(pathname,body,owner='owner-jm8')=>commerce(new Request('https://shop.example'+pathname,{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':owner,'Idempotency-Key':'jm8-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify(body)}),cenv);
  const checkout=async(profile)=>{const res=await post('/api/checkout',{items:[{product:suitIdx,profile}],shipping});return{status:res.status,data:res.status===200?await res.json():null}};
  const storedProfile=()=>JSON.parse(cdb.rows.at(-1).items)[0].profile;

  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const DAY=24*60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
  const adb=new AccountDB();
  adb.users.push({id:'U0123456789abcdef0123456789abcdef',email:'jm8@example.com',display_name:'J-M8',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  adb.sessions.push({token_hash:hash('jm8-session-token'),user_id:'U0123456789abcdef0123456789abcdef',created_at:iso(-DAY),last_seen_at:iso(0),expires_at:iso(29*DAY)});
  const aenv={DB:adb,...EMAIL};
  const acookie=SESSION_COOKIE+'=jm8-session-token';
  let acase=0;
  const accountSave=async(profile)=>accounts(new Request('https://shop.example/api/account/profiles',{method:'POST',headers:{Cookie:acookie,Origin:'https://shop.example','Content-Type':'application/json'},body:JSON.stringify({profile:{...profile,id:'jm8-a-'+(++acase)}})}),aenv);

  const MODIFY_PROFILE={version:2,method:'modify',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Usual 40',unit:'in',fit:'Tailored',base:{...BASE},values:{...MODIFY_VALUES}};

  // Checkout accepts the modify profile and stores the cleaned
  // shape; the account store accepts the same profile.
  const placed=await checkout(MODIFY_PROFILE);
  assert.equal(placed.status,200,'checkout accepts a modify profile');
  assert.deepEqual(storedProfile(),{name:'Usual 40',method:'modify',unit:'in',wearer:'Men',values:{...MODIFY_VALUES},version:2,garment:'suit',wearerName:'Alex Kumar',base:{...BASE}},'the stored order profile is exactly the cleaned modify shape: base and reviewed dimensions, nothing else');
  assert.deepEqual(Object.keys(storedProfile().values),MODIFY_ORDER.filter(k=>k!=='gOutseam'),'the stored modify values keep the verified set order');
  assert.equal(placed.data.totalCents,catalog[suitIdx].priceCents,'a modify profile changes nothing about the price');
  assert.equal((await accountSave(MODIFY_PROFILE)).status,200,'the account profile store accepts the modify profile');
  const listRes=await accounts(new Request('https://shop.example/api/account/profiles',{headers:{Cookie:acookie}}),aenv);
  const saved=(await listRes.json()).profiles.find(q=>q.method==='modify');
  assert.ok(saved,'the account lists the saved modify profile');
  assert.deepEqual(saved.base,BASE,'the account copy carries the base size intact');
  assert.deepEqual(saved.values,MODIFY_VALUES,'the account copy carries the reviewed dimensions intact');

  // Modify values validate against garment ranges, not body
  // ranges, on the server too.
  const wide={...MODIFY_PROFILE,values:{...MODIFY_VALUES,gJacketChest:72}};
  assert.equal((await checkout(wide)).status,200,'checkout accepts a finished jacket chest of 72, past the body chest maximum');
  assert.equal((await accountSave(wide)).status,200,'the account store accepts the same garment value');

  // Refusals, identical at checkout and the account store.
  const missingValue={...MODIFY_PROFILE,values:{...MODIFY_VALUES}};delete missingValue.values.gFrontRise;
  assert.equal((await checkout(missingValue)).status,400,'checkout refuses a modify profile missing a required detail field');
  assert.equal((await accountSave(missingValue)).status,400,'the account store refuses it too');
  const mixed={...MODIFY_PROFILE,values:{...MODIFY_VALUES,chest:40}};
  assert.equal((await checkout(mixed)).status,400,'checkout refuses a modify profile carrying a body field');
  assert.equal((await accountSave(mixed)).status,400,'the account store refuses it too');
  const noBase={...MODIFY_PROFILE,base:{jacket:40,length:'Regular',trouser:34}};
  assert.equal((await checkout(noBase)).status,400,'checkout refuses a modify profile missing a base part');
  assert.equal((await accountSave(noBase)).status,400,'the account store refuses it too');
  const oldSize={...MODIFY_PROFILE,base:{...BASE,jacket:34}};
  assert.equal((await checkout(oldSize)).status,400,'checkout refuses a base size outside the aligned sets');
  assert.equal((await accountSave(oldSize)).status,400,'the account store refuses it too');
  const withFits={...MODIFY_PROFILE,fits:{jacketFit:'Regular Fit'}};
  assert.equal((await checkout(withFits)).status,400,'checkout refuses a modify profile carrying fit selections');
  const legacy={...MODIFY_PROFILE};delete legacy.version;
  assert.equal((await checkout(legacy)).status,400,'checkout refuses a modify profile without the version 2 marker');
  assert.equal((await accountSave(legacy)).status,400,'the account store refuses it too');
  const boys={...MODIFY_PROFILE,wearer:'Boys'};
  assert.equal((await checkout(boys)).status,400,'checkout refuses a Boys modify profile');
  assert.equal((await accountSave(boys)).status,400,'the account store refuses it too');
  const wrongGarment={...MODIFY_PROFILE,garment:'shirt'};
  assert.equal((await checkout(wrongGarment)).status,400,'checkout refuses a modify profile for another garment');

  // A deferred order (package M6) can be completed afterwards
  // with a modify profile through the same endpoint.
  const DEFERRED={name:'Measurements to follow',method:'deferred',wearer:'Men',garment:'suit',version:2,deferred:true};
  const deferredOrder=await checkout(DEFERRED);
  assert.equal(deferredOrder.status,200,'the deferred order is placed');
  const attach=await post('/api/orders/'+deferredOrder.data.orderId+'/measurements',{index:0,profile:MODIFY_PROFILE});
  assert.equal(attach.status,200,'the deferred order completes with a modify profile');
  const attached=(await attach.json()).items[0].profile;
  assert.equal(attached.method,'modify','the completed order carries the modify profile');
  assert.deepEqual(attached.base,BASE,'the completed order carries the base size');
  assert.deepEqual(attached.values,MODIFY_VALUES,'the completed order carries the reviewed dimensions');
  assert.equal(cdb.rows.length,3,'the refused checkouts wrote no orders: only the two accepted checkouts and the deferred order are stored');
  console.log('J-M8 (server) passed: checkout and the account store accept and refuse modify profiles identically, the stored order carries the cleaned base and dimensions in set order at the unchanged price, and a deferred order completes with a modify profile.');
})().catch(e=>{console.error(e);process.exit(1)});
