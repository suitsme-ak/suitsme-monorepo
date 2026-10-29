const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path');
// Journey J-M7 (measurements wave, package M7): the measure an
// existing garment entry mode, the benchmark's second entry mode
// (owner decision O10). The shopper measures a garment they
// already own, laid flat, instead of their body. For the suit the
// studio asks exactly the verified garment set of the capture of
// 2026-10-29 (the name and height preamble, then the fifteen
// garment fields, all required, no fit selectors); the profile it
// saves is a distinct kind, method 'garment', whose values are
// finished garment measurements, validated against the garment
// ranges and never the body ranges, and labeled as garment
// measurements on the bag line, the checkout summary and the
// order. The server half runs the real lib/commerce.ts and
// lib/accounts.ts: the same profile is accepted or refused
// identically by the client validator, the account profile store
// and checkout, the stored order carries the cleaned garment
// shape, and a deferred order (package M6) can be completed with
// a garment profile. Driven on the real storefront scripts in a
// Node vm with stubbed DOM and storage, in the style of the
// other suites.

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
// The verified suit garment set in the form's order (capture of
// 2026-10-29), and a realistic set of finished garment values for
// a suit that fits: flat widths doubled where the guidance says
// so, circumferences as the garment's own numbers.
const SUIT_GARMENT_ORDER=['gJacketChest','gShoulderWidth','gJacketMidsection','gJacketLength','gSleeveLength','gBicepWidth','gWaistCircumference','gSleeveOpening','gHipWidth','gThighWidth','gKneeWidth','gLegOpening','gOutseam','gFrontRise','gBackRise'];
const JACKET_STEP=['gJacketChest','gShoulderWidth','gJacketMidsection','gJacketLength','gSleeveLength','gBicepWidth','gSleeveOpening'];
const TROUSER_STEP=['gWaistCircumference','gHipWidth','gThighWidth','gKneeWidth','gLegOpening','gOutseam','gFrontRise','gBackRise'];
const GARMENT_VALUES={height:70,gJacketChest:43,gShoulderWidth:18.5,gJacketMidsection:38,gJacketLength:29.5,gSleeveLength:25.5,gBicepWidth:13,gWaistCircumference:35,gSleeveOpening:9.5,gHipWidth:41,gThighWidth:23,gKneeWidth:15.5,gLegOpening:15,gOutseam:41,gFrontRise:11,gBackRise:13};
const SAVED_GARMENT_PROFILE={id:'garment-profile-1',version:2,method:'garment',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Best fitting suit',unit:'in',fit:'Tailored',values:{...GARMENT_VALUES},created:'2026-02-03T00:00:00.000Z'};
const BODY_VALUES={height:70,chest:40,sleeve:25,shoulder:18,jacket:29,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24};
const BODY_PROFILE={id:'body-profile-1',version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Saved suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...BODY_VALUES},created:'2026-02-01T00:00:00.000Z'};
const SHIPPING_FORM={email:'jm7@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'};
function demoCheckout(w){
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:${JSON.stringify(SHIPPING_FORM)}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
}

// ---------------------------------------------------------------- J-M7 client
// The suit garment mode end to end: the customizer offers the
// mode as its own card, the studio asks exactly the verified
// garment set in order with every field required and garment
// labeled, the saved profile is a garment profile, and the bag,
// checkout and demo order carry it labeled as garment
// measurements, never as body measurements.
{
  const w=makeWorld({profiles:[BODY_PROFILE,SAVED_GARMENT_PROFILE]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  assert.equal(w.run('stage'),2,'the customizer reaches the Measurements step');
  const methods=w.run('customize()');
  assert.ok(methods.includes('Measure my body')&&methods.includes('Use a standard size'),'the body and standard size methods are still offered');
  assert.ok(methods.includes('Measure an existing garment'),'the garment mode is offered as its own customizer method');
  assert.ok(methods.includes('Best fitting suit · From an existing garment'),'a saved garment profile is labeled as from an existing garment in the profile select');
  assert.ok(methods.includes('Saved suit fit · Custom measurements'),'a body profile keeps its own label');

  w.run("setCustomizerMethod('garment')");
  assert.equal(w.run('customizerMethod()'),'garment','the garment method is the active choice');
  assert.equal(w.run('draft.method'),'garment','the Studio draft carries the garment method');
  assert.equal(w.run('config.profileId'),'garment-profile-1','the saved garment profile for the wearer is selected');

  // Into the studio: the garment aware studio runs the garment flow.
  w.run('startMeasurements()');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active in garment mode');
  assert.equal(w.run('draft.garment'),'suit','the session carries the suit garment');
  assert.ok(/^Suit_\d{1,2}\/\d{1,2}\/\d{4}$/.test(w.run('draft.name')),'the profile name is prefilled with the category and date: '+w.run('draft.name'));
  assert.equal(w.run('garmentFlowSteps().length'),5,'the garment flow has method, preamble, jacket fields, trousers fields and review steps');
  const methodHtml=w.run('measure()');
  assert.ok(methodHtml.includes('Measure an existing garment'),'the studio method step offers the garment mode too');
  assert.ok(methodHtml.includes('record the garment’s own finished measurements'),'the method step explains that garment values are recorded, not body values');

  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the jacket garment fields');

  // The jacket step: exactly the jacket block of the verified
  // set, in the form's order, every input labeled a garment
  // measurement, on a flat garment diagram, and no body field.
  const jacketHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(jacketHtml,JACKET_STEP).slice().sort((a,b)=>a-b),fieldOrder(jacketHtml,JACKET_STEP),'the jacket garment fields render in the verified order');
  for(const id of JACKET_STEP)assert.ok(jacketHtml.includes('measureInput-'+id),'the jacket step asks for '+id);
  assert.equal(inputCount(jacketHtml),7,'the jacket step asks for exactly 7 garment measurements');
  for(const id of ['chest','sleeve','shoulder','jacket','bicep','stomach','waist','seat'])assert.ok(!jacketHtml.includes(`id="measureInput-${id}"`),'the garment flow never asks for the body field '+id);
  assert.ok(jacketHtml.includes('Garment measurement'),'every field is labeled a garment measurement');
  assert.ok(!jacketHtml.includes('Body measurement'),'no field on the garment step is labeled a body measurement');
  assert.ok(jacketHtml.includes('Lay your suit flat'),'the step tells the shopper to lay the garment flat');
  assert.ok(jacketHtml.includes('Diagram of a garment laid flat'),'the illustration is a flat garment diagram, not the body figure');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'empty garment fields cannot advance');
  assert.equal(liCount(w.elFor('#measureError').innerHTML),7,'all seven jacket garment fields are required and reported together');
  for(const id of JACKET_STEP)w.run(`updateValue('${id}','${GARMENT_VALUES[id]}')`);
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid jacket garment values advance to the trousers garment fields');

  // The trousers step: exactly the trousers block, in order.
  const trouserHtml=w.run('measure()');
  assert.deepEqual(fieldOrder(trouserHtml,TROUSER_STEP).slice().sort((a,b)=>a-b),fieldOrder(trouserHtml,TROUSER_STEP),'the trouser garment fields render in the verified order');
  assert.equal(inputCount(trouserHtml),8,'the trousers step asks for exactly 8 garment measurements');
  for(const id of TROUSER_STEP)w.run(`updateValue('${id}','${GARMENT_VALUES[id]}')`);
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'valid trouser garment values advance to review');

  // Review: the garment values grouped by part, stated to be
  // garment measurements, and no fit selector anywhere.
  const review=w.run('measure()');
  assert.ok(review.includes('Every measurement below is a garment measurement'),'the review states the values are garment measurements');
  assert.ok(review.includes('Jacket chest')&&review.includes('Outseam'),'the review lists the garment fields');
  assert.ok(!review.includes('Jacket Fit')&&!review.includes('Trouser Fit'),'the garment review carries no fit selector, as the verified form has none');
  assert.ok(!review.includes('Body measurements'),'the garment review never calls the values body measurements');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  const p=JSON.parse(w.run('JSON.stringify(profiles[profiles.length-1])'));
  assert.equal(p.method,'garment','the saved profile is a garment profile');
  assert.equal(p.version,2,'the saved profile is version 2');
  assert.equal(p.garment,'suit','the saved profile names its garment');
  assert.equal(p.wearerName,'Alex Kumar','the saved profile carries the wearer name from the preamble');
  assert.deepEqual(p.values,GARMENT_VALUES,'the saved values are exactly the garment set plus height');
  assert.deepEqual(Object.keys(p.values),['height',...SUIT_GARMENT_ORDER],'the saved values are stored in the verified set order');
  assert.ok(!('fits' in p),'the garment profile records no fit selections');
  assert.equal(w.run("validateProfile(profiles[profiles.length-1],'suit').ok"),true,'the saved profile passes the shared schema validation as a garment profile');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');
  assert.equal(w.run('config.profileId'),p.id,'the saved garment profile is selected for the garment');

  // Bag, configuration review and demo order carry the profile
  // labeled as garment measurements.
  w.elFor('#profileSelect').value=p.id;
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const summary=w.run('profileSummary(bag[0])');
  assert.ok(summary.startsWith('Garment measurements · Height 70 in · Jacket chest 43 in'),'the bag summary leads with the garment label: '+summary);
  assert.ok(summary.includes('Outseam 41 in')&&summary.includes('Back rise 13 in'),'the bag summary carries the full garment set');
  assert.ok(!summary.includes('Body measurements'),'the bag summary never calls garment values body measurements');
  const line=w.run('lineHtml(bag[0])');
  assert.ok(line.includes('Garment measurements · '),'the bag line shows the garment summary');
  w.run('reviewOrder()');
  const reviewModal=w.elFor('#modalContent').innerHTML;
  assert.ok(reviewModal.includes('Jacket chest')&&reviewModal.includes('Outseam'),'the configuration review lists the garment fields');
  assert.ok(!reviewModal.includes('NaN'),'the configuration review never renders garment values through the body fields');
  demoCheckout(w);
  assert.equal(w.orders().length,1,'the demo checkout records exactly one order');
  const orderProfile=w.orders()[0].items[0].profile;
  assert.equal(orderProfile.method,'garment','the demo order item carries the garment profile');
  assert.deepEqual(orderProfile.values,GARMENT_VALUES,'the demo order carries the garment values intact');
  const page=w.run(`orderPage('${w.orders()[0].id}')`);
  assert.ok(page.includes('Garment measurements · '),'the order page shows the garment summary');

  // The two kinds are never confused in summaries: the same
  // surface labels a body profile as body measurements.
  assert.ok(w.run(`profileSummary({profile:${JSON.stringify(BODY_PROFILE)}})`).startsWith('Body measurements · '),'a body profile still summarizes as body measurements');
  w.run('openProfiles()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('garment measurements'),'the profiles list labels the garment profile by its kind');
  console.log('J-M7 (client) passed: a suit is measured from an existing garment with exactly the verified set in order, all required, no fit selectors, saved as a version 2 garment profile, and the bag, configuration review and demo order carry it labeled as garment measurements.');
}

// ---------------------------------------------------------------- J-M7 client
// Quick Add routes into the same studio, whose method step offers
// the garment mode; the validator guards pin the kind separation
// at the client surface too.
{
  const w=makeWorld();
  w.run('quickAddProduct(0)');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('quickAddMeasure'),'quick add for a suit with no profile offers the measuring flow');
  w.run('quickAddMeasure(0)');
  assert.equal(w.run('draft.garment'),'suit','the quick add route carries the suit garment');
  const methodHtml=w.run('measure()');
  assert.ok(methodHtml.includes('Measure an existing garment'),'the studio reached from quick add offers the garment mode');
  w.run("setMethod('garment')");
  assert.equal(w.run('garmentMode()'),true,'choosing the garment mode in the studio activates the garment flow');
  assert.equal(w.run('garmentFlowSteps().length'),5,'the garment flow steps are the garment ones');

  const base={version:2,method:'garment',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Guard',unit:'in',values:{...GARMENT_VALUES}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(base)},'suit').ok`),true,'a complete garment profile validates');
  const wide={...base,values:{...GARMENT_VALUES,gJacketChest:72}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(wide)},'suit').ok`),true,'a finished jacket chest of 72 validates against the garment range, past the body chest maximum of 70');
  const tooWide={...base,values:{...GARMENT_VALUES,gJacketChest:90}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(tooWide)},'suit').ok`),false,'a jacket chest of 90 is refused by the garment range');
  const mixed={...base,values:{...GARMENT_VALUES,chest:40}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(mixed)},'suit').ok`),false,'a body field inside a garment profile is refused: the kinds are never mixed');
  const missing={...base,values:{...GARMENT_VALUES}};delete missing.values.gOutseam;
  assert.equal(w.run(`validateProfile(${JSON.stringify(missing)},'suit').ok`),false,'a garment profile missing a required garment field is refused');
  const withFits={...base,fits:{jacketFit:'Regular Fit'}};
  assert.equal(w.run(`validateProfile(${JSON.stringify(withFits)},'suit').ok`),false,'a garment profile carrying fit selections is refused');
  const legacy={...base};delete legacy.version;
  assert.equal(w.run(`validateProfile(${JSON.stringify(legacy)},'suit').ok`),false,'a garment profile with no version 2 marker is refused: there is no legacy garment shape');
  const wrongGarment={...base,garment:'shirt'};
  assert.equal(w.run(`validateProfile(${JSON.stringify(wrongGarment)}).ok`),false,'a garment profile validates against its own garment’s set: suit garment values are unknown keys in the shirt set');
  assert.equal(w.run(`validateProfile(${JSON.stringify(wrongGarment)},'shirt').ok`),false,'and the same profile refuses for the garment it names when its values belong to another set');
  console.log('J-M7 (client, doors and guards) passed: quick add reaches the garment mode through the studio method step, and the shared validator keeps garment values in garment ranges and out of body fields.');
}

// ---------------------------------------------------------------- J-M7 server
// The real lib/commerce.ts and lib/accounts.ts: checkout and the
// account profile store accept and refuse the garment profile
// identically, the stored order carries the cleaned garment
// shape, and a deferred order can be completed with a garment
// profile through the package M6 endpoint.
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
  const post=async(pathname,body,owner='owner-jm7')=>commerce(new Request('https://shop.example'+pathname,{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':owner,'Idempotency-Key':'jm7-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify(body)}),cenv);
  const checkout=async(profile)=>{const res=await post('/api/checkout',{items:[{product:suitIdx,profile}],shipping});return{status:res.status,data:res.status===200?await res.json():null}};
  const storedProfile=()=>JSON.parse(cdb.rows.at(-1).items)[0].profile;

  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const DAY=24*60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
  const adb=new AccountDB();
  adb.users.push({id:'U0123456789abcdef0123456789abcdef',email:'jm7@example.com',display_name:'J-M7',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  adb.sessions.push({token_hash:hash('jm7-session-token'),user_id:'U0123456789abcdef0123456789abcdef',created_at:iso(-DAY),last_seen_at:iso(0),expires_at:iso(29*DAY)});
  const aenv={DB:adb,...EMAIL};
  const acookie=SESSION_COOKIE+'=jm7-session-token';
  let acase=0;
  const accountSave=async(profile)=>accounts(new Request('https://shop.example/api/account/profiles',{method:'POST',headers:{Cookie:acookie,Origin:'https://shop.example','Content-Type':'application/json'},body:JSON.stringify({profile:{...profile,id:'jm7-a-'+(++acase)}})}),aenv);

  const GARMENT_PROFILE={version:2,method:'garment',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Best fitting suit',unit:'in',fit:'Tailored',values:{...GARMENT_VALUES}};

  // Checkout accepts the garment profile and stores the cleaned
  // garment shape; the account store accepts the same profile.
  const placed=await checkout(GARMENT_PROFILE);
  assert.equal(placed.status,200,'checkout accepts a garment profile');
  assert.deepEqual(storedProfile(),{name:'Best fitting suit',method:'garment',unit:'in',wearer:'Men',values:{...GARMENT_VALUES},version:2,garment:'suit',wearerName:'Alex Kumar'},'the stored order profile is exactly the cleaned garment shape');
  assert.deepEqual(Object.keys(storedProfile().values),['height',...SUIT_GARMENT_ORDER],'the stored garment values keep the verified set order');
  assert.equal(placed.data.totalCents,catalog[suitIdx].priceCents,'a garment profile changes nothing about the price');
  assert.equal((await accountSave(GARMENT_PROFILE)).status,200,'the account profile store accepts the garment profile');
  const listRes=await accounts(new Request('https://shop.example/api/account/profiles',{headers:{Cookie:acookie}}),aenv);
  const saved=(await listRes.json()).profiles.find(q=>q.method==='garment');
  assert.ok(saved,'the account lists the saved garment profile');
  assert.deepEqual(saved.values,GARMENT_VALUES,'the account copy carries the garment values intact');

  // Garment values validate against garment ranges, not body
  // ranges: a finished jacket chest past the body maximum is
  // accepted everywhere, while a body chest at the same number
  // is refused everywhere.
  const wide={...GARMENT_PROFILE,values:{...GARMENT_VALUES,gJacketChest:72}};
  assert.equal((await checkout(wide)).status,200,'checkout accepts a finished jacket chest of 72, past the body chest maximum');
  assert.equal((await accountSave(wide)).status,200,'the account store accepts the same garment value');
  const wideBody={version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Wide body',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...BODY_VALUES,chest:72}};
  assert.equal((await checkout(wideBody)).status,400,'a body chest of 72 is still refused for a body profile');
  assert.equal((await accountSave(wideBody)).status,400,'the account store refuses the same body value');

  // Refusals, identical at checkout and the account store.
  const missing={...GARMENT_PROFILE,values:{...GARMENT_VALUES}};delete missing.values.gOutseam;
  assert.equal((await checkout(missing)).status,400,'checkout refuses a garment profile missing a required garment field');
  assert.equal((await accountSave(missing)).status,400,'the account store refuses it too');
  const mixed={...GARMENT_PROFILE,values:{...GARMENT_VALUES,chest:40}};
  assert.equal((await checkout(mixed)).status,400,'checkout refuses a garment profile carrying a body field');
  assert.equal((await accountSave(mixed)).status,400,'the account store refuses it too');
  const tooWide={...GARMENT_PROFILE,values:{...GARMENT_VALUES,gJacketChest:90}};
  assert.equal((await checkout(tooWide)).status,400,'checkout refuses a garment value past the garment range');
  assert.equal((await accountSave(tooWide)).status,400,'the account store refuses it too');
  const wrongGarment={...GARMENT_PROFILE,garment:'shirt'};
  assert.equal((await checkout(wrongGarment)).status,400,'checkout refuses a garment profile for another garment');
  const legacy={...GARMENT_PROFILE};delete legacy.version;
  assert.equal((await checkout(legacy)).status,400,'checkout refuses a garment profile without the version 2 marker');
  assert.equal((await accountSave(legacy)).status,400,'the account store refuses it too');
  const withFits={...GARMENT_PROFILE,fits:{jacketFit:'Regular Fit'}};
  assert.equal((await checkout(withFits)).status,400,'checkout refuses a garment profile carrying fit selections');
  const rowsBefore=cdb.rows.length;

  // A deferred order (package M6) can be completed afterwards
  // with a garment profile through the same endpoint.
  const DEFERRED={name:'Measurements to follow',method:'deferred',wearer:'Men',garment:'suit',version:2,deferred:true};
  const deferredOrder=await checkout(DEFERRED);
  assert.equal(deferredOrder.status,200,'the deferred order is placed');
  const attach=await post('/api/orders/'+deferredOrder.data.orderId+'/measurements',{index:0,profile:GARMENT_PROFILE});
  assert.equal(attach.status,200,'the deferred order completes with a garment profile');
  const attached=(await attach.json()).items[0].profile;
  assert.equal(attached.method,'garment','the completed order carries the garment profile');
  assert.deepEqual(attached.values,GARMENT_VALUES,'the completed order carries the garment values');
  assert.equal(cdb.rows.length,rowsBefore+1,'the refused checkouts wrote no orders');
  console.log('J-M7 (server) passed: checkout and the account store accept and refuse garment profiles identically, garment values validate against garment ranges only, the stored order carries the cleaned garment shape in the verified order, and a deferred order completes with a garment profile.');
})().catch(e=>{console.error(e);process.exit(1)});
