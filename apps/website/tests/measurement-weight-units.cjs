const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Journey WU (weight units display fix): in the Measure my body
// studio, weight is entered and stored in pounds, but the generic
// length formatting treated it as inches: the entry step showed
// "= 457.2 cm" under a 180 lb entry, the review step showed
// "Weight (lb) 180 in", and the saved profile summary repeated the
// " in" suffix. Weight is now exempt from the inch to centimeter
// conversion and the inch suffix everywhere the generic body
// measurement formatting renders it: the entry equivalent is a
// kilogram figure (180 lb shows 81.6 kg), the review row and the
// saved profile summary read "180 lb", and length fields keep
// their centimeter equivalents and inch labels. The stored value
// and the validation ranges do not change. Driven on the real
// storefront scripts, in the style of the other suites.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
function makeWorld(seed={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(seed.profiles)localStorage.setItem('suits-profiles',JSON.stringify(seed.profiles));
  if(seed.config)localStorage.setItem('suits-config',JSON.stringify(seed.config));
  if(seed.draft)localStorage.setItem('suits-draft',JSON.stringify(seed.draft));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,store};
}

(async()=>{
  const draft={step:0,method:'body',unit:'in',values:{},name:'Weight units profile',fit:'Tailored',ready:{jacket:'',length:'',trouser:''},garment:'suit',wearer:'Men',wearerName:'',fits:null,completionId:null,completionMissing:null};
  const w=makeWorld({draft});
  w.run("location.hash='#measure';render()");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the studio advances to the preamble');

  // Entry step: typing a weight updates its equivalent line live.
  w.run("draft.wearerName='Alex Kumar'");
  w.run("updateBodyValue('height','70')");
  assert.equal(w.elFor('#cmEq-height').textContent,'= 177.8 cm','height, a length, keeps its centimeter equivalent');
  w.run("updateBodyValue('weight','180')");
  assert.equal(w.run('draft.values.weight'),180,'the typed weight is stored as entered, in pounds');
  assert.equal(w.elFor('#cmEq-weight').textContent,'= 81.6 kg','the weight equivalent is kilograms, not a centimeter conversion of pounds');

  // Entry step, rendered fresh with the values in place: the
  // weight field carries the kilogram equivalent and a pounds
  // placeholder, and the centimeter figure for weight never
  // appears.
  const preamble=w.run('measure()');
  assert.ok(preamble.includes('id="cmEq-weight">= 81.6 kg'),'the rendered weight field shows the kilogram equivalent');
  assert.ok(preamble.includes('id="cmEq-height">= 177.8 cm'),'the rendered height field still shows its centimeter equivalent');
  assert.ok(!preamble.includes('457.2'),'the weight is never rendered as a centimeter figure');
  assert.ok(preamble.includes('placeholder="pounds"'),'the weight input prompts for pounds');

  // Jacket fields step: a length field still converts on edit, so
  // the exemption is specific to weight.
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the preamble advances to the jacket fields');
  w.run("updateBodyValue('chest','40')");
  assert.equal(w.elFor('#cmEq-chest').textContent,'= 101.6 cm','a length field on the fields step still shows its centimeter equivalent');
  w.run("updateBodyValue('chestOverArm','46');updateBodyValue('sleeveInseamL','18');updateBodyValue('sleeveInseamR','18');updateBodyValue('shoulder','18');updateBodyValue('jacketLength','29');updateBodyValue('jacketWaist','34')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'the jacket fields advance to the trouser fields');
  w.run("updateBodyValue('outseam','42');updateBodyValue('trouserWaist','34');updateBodyValue('seat','40');updateBodyValue('frontRise','11');updateBodyValue('thigh','24');updateBodyValue('inseam','32');updateBodyValue('rise','12');updateBodyValue('crotch','10')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'the trouser fields advance to review');

  // Review step: weight reads as pounds, lengths as inches.
  const review=w.run('measure()');
  assert.ok(review.includes('<span>Weight (lb)</span><strong>180 lb</strong>'),'the review step renders the weight as 180 lb');
  assert.ok(review.includes('<span>Height</span><strong>70 in</strong>'),'the review step still renders height in inches');
  assert.ok(review.includes('<span>Chest</span><strong>40 in</strong>'),'the review step still renders a set field in inches');
  assert.ok(!review.includes('180 in'),'the review step never renders the weight in inches');
  assert.ok(!review.includes('457.2'),'the review step never renders the weight as centimeters');

  // Save: the stored value is untouched, and the saved profile
  // summary (bag, checkout and orders share it) reads the same
  // way as the review step.
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the profile saves');
  const saved=JSON.parse(w.run('JSON.stringify(profiles[0])'));
  assert.equal(saved.values.weight,180,'the saved weight is the entered pounds, unchanged');
  const summary=w.run('profileSummary({profile:profiles[0]})');
  assert.ok(summary.includes('Weight (lb) 180 lb'),'the saved profile summary renders the weight as 180 lb');
  assert.ok(summary.includes('Height 70 in'),'the saved profile summary still renders height in inches');
  assert.ok(summary.includes('Chest 40 in'),'the saved profile summary still renders a set field in inches');
  assert.ok(!summary.includes('Weight (lb) 180 in'),'the saved profile summary never renders the weight in inches');
  console.log('WU passed: weight shows a kilogram equivalent on entry and reads 180 lb at review and in the saved profile summary, lengths keep their centimeter equivalents and inch labels, and the stored weight is unchanged.');
})().catch(e=>{console.error(e);process.exit(1)});
