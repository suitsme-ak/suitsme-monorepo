const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module');
const path=require('node:path');
// Journey J7 (JPOS consistency wave, package J7): the deferred
// reshape to the JPOS SelfMeasurement set (plan item M7) and the
// order payload alignment (plan section 6, j0-mapping-design.md
// sections E.1 to E.6). A deferred item is stored with an empty
// selfMeasurement block shaped exactly like the SelfMeasurement
// table; the order page offers the ten numeric fields (height in
// feet and inches, chest, chest over arm, waist, seat, thigh,
// jacket sleeve length, pants waist, pants outseam), submissions
// accumulate until the flag reads complete, and the block never
// becomes a profile: the profiles list, the browser profile
// store and the account profile store all stay untouched, and
// the item stays deferred until a full profile is attached
// through the M6 path, which keeps working unchanged. The photo
// fields of the set stay null and no upload is offered: neither
// the design nor the codebase has a photo storage path, and the
// form says the tailors will ask for photos if they need them.
// The server half runs the real lib/commerce.ts: checkout also
// stamps each tailored item with its JPOS shaped payload
// (per piece style and measurement sections under the orders
// column names, gauge specifications for ready and modify
// orders with no finished values invented, and the profile
// provenance ids for JPOS imported profiles), with totals
// computed exactly as before.

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
const SUIT_VALUES={height:70,chest:40,sleeve:25,shoulder:18,jacket:29,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24};
const SUIT_PROFILE={id:'suit-profile-1',version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Saved suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...SUIT_VALUES},created:'2026-02-01T00:00:00.000Z'};
const SHIPPING_FORM={email:'j7@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'};
const SELF_FULL={ActualHeightFeet:5,ActualHeightInches:10,Chest:40,ChestOverArm:46,waist:34,Seat:40,thigh:24,JacketSleeveLength:25,PantsWaist:34,PantsOutseam:42};
function demoCheckout(w){
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:${JSON.stringify(SHIPPING_FORM)}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
}
function deferSuitOrder(w){
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('deferred')");
  w.run('nextConfig()');
  demoCheckout(w);
  return w.orders()[0].id;
}
function fillSelf(w,values){for(const [k,v] of Object.entries(values))w.elFor('#selfInput-'+k).value=String(v)}

// ---------------------------------------------------------------- J7 client
// The full self measurement set from the order page of a demo
// order: stored on the item in the E.5 shape, complete, never a
// profile, and the M6 profile completion still finishes the item.
{
  const w=makeWorld({profiles:[SUIT_PROFILE]});
  const orderId=deferSuitOrder(w);
  const profilesBefore=w.store.get('suits-profiles');
  const page=w.run(`orderPage('${orderId}')`);
  assert.ok(page.includes('Add self measurements'),'the order page offers the self measurement set beside the profile completion');
  assert.ok(page.includes('Measurements to follow'),'the order still reads as measurements to follow before anything is sent');

  w.run(`openSelfMeasurements('${orderId}',0)`);
  const modal=w.elFor('#modalContent').innerHTML;
  for(const label of ['Height','Chest','Chest over arms','Waist','Seat','Thigh','Jacket sleeve length','Trouser waist','Trouser outseam'])assert.ok(modal.includes(label),`the form offers the ${label} field`);
  for(const k of Object.keys(SELF_FULL))assert.ok(modal.includes(`id="selfInput-${k}"`),`the form carries the ${k} input`);
  assert.ok(!modal.includes('type="file"'),'no photo upload is offered: there is no storage path for one');
  assert.ok(modal.includes('front and side photos'),'the form says in words that the tailors will ask for photos if they need them');
  assert.ok(modal.includes('never saved to your profiles'),'the form states the set is not a profile');

  fillSelf(w,SELF_FULL);
  w.run(`saveSelfMeasurements('${orderId}',0)`);
  const item=w.orders()[0].items[0];
  const sm=item.selfMeasurement;
  assert.ok(sm&&typeof sm==='object','the order item now carries the self measurement block');
  assert.equal(typeof sm.DateLastModified,'string','the block is stamped when the set is saved');
  const {DateLastModified,...rest}=sm;
  assert.deepEqual(rest,{customerid:null,iscomplete:true,...SELF_FULL,frontviewimage:null,sideviewimage:null},'the stored block is exactly the SelfMeasurement shape, complete, photos null');
  assert.equal(w.run('profiles.length'),1,'saving self measurements creates no profile');
  assert.equal(w.store.get('suits-profiles'),profilesBefore,'the browser profile store is byte identical: the set never enters it');
  assert.equal(item.profile.method,'deferred','the item itself stays deferred: self measurements are not a profile');
  assert.equal(w.run('orderNeedsMeasurements(orders[0])'),true,'the order still needs its full measurements');
  const donePage=w.run(`orderPage('${orderId}')`);
  assert.ok(donePage.includes('Self measurements received'),'the order page says the self measurements were received');
  assert.ok(donePage.includes('Update self measurements'),'the set can still be updated from the order page');

  // The M6 completion path is unchanged and still finishes it.
  w.run(`attachProfileToOrder('${orderId}',0,'suit-profile-1')`);
  const done=w.orders()[0].items[0];
  assert.equal(done.profile.method,'body','attaching the saved profile completes the item as before');
  assert.deepEqual(done.profile.values,SUIT_VALUES,'the attached values are intact');
  assert.equal(done.selfMeasurement.iscomplete,true,'the self measurement block stays on the completed item as order history');
  assert.equal(w.run('orderNeedsMeasurements(orders[0])'),false,'the order no longer needs measurements');
  console.log('J7 (client, full set) passed: the order page offers the SelfMeasurement set, saving it stores the E.5 block on the item only, complete and profile free, and the profile completion path finishes the item exactly as before.');
}

// ---------------------------------------------------------------- J7 client
// Partial sets accumulate: the flag stays incomplete, the page
// says so in words, and the form reopens with what was sent.
{
  const w=makeWorld();
  const orderId=deferSuitOrder(w);
  w.run(`openSelfMeasurements('${orderId}',0)`);
  fillSelf(w,{Chest:41,waist:35,Seat:41});
  w.run(`saveSelfMeasurements('${orderId}',0)`);
  let sm=w.orders()[0].items[0].selfMeasurement;
  assert.equal(sm.iscomplete,false,'a partial set does not read as complete');
  assert.equal(sm.Chest,41,'the sent values are stored');
  assert.equal(sm.PantsOutseam,null,'the unsent fields stay empty, never filled in');
  const page=w.run(`orderPage('${orderId}')`);
  assert.ok(page.includes('Self measurements received so far'),'the order page says the set is partial, in words');
  assert.ok(page.includes('Full measurements are still to follow'),'the order page keeps the still to follow wording for a partial set');
  w.run(`openSelfMeasurements('${orderId}',0)`);
  const modal=w.elFor('#modalContent').innerHTML;
  assert.ok(modal.includes('id="selfInput-Chest" type="number" inputmode="decimal" step="0.25" value="41"'),'the form reopens with the values already sent');
  const rest={...SELF_FULL};delete rest.Chest;delete rest.waist;delete rest.Seat;
  fillSelf(w,rest);
  w.run(`saveSelfMeasurements('${orderId}',0)`);
  sm=w.orders()[0].items[0].selfMeasurement;
  assert.equal(sm.iscomplete,true,'the accumulated set reads complete once every field is in');
  assert.equal(sm.Chest,41,'the earlier values survive the second visit');
  console.log('J7 (client, partial set) passed: partial self measurements are stored as sent with the flag incomplete and the page wording to match, and a second visit completes the accumulated set.');
}

// ---------------------------------------------------------------- J7 client
// A value that is not a usable number is refused on the spot and
// nothing is stored.
{
  const w=makeWorld();
  const orderId=deferSuitOrder(w);
  w.run(`openSelfMeasurements('${orderId}',0)`);
  w.elFor('#selfInput-Chest').value='not-a-number';
  w.run(`saveSelfMeasurements('${orderId}',0)`);
  assert.equal(w.elFor('#selfError').textContent,'Please check the chest value.','the form names the bad field');
  assert.ok(!('selfMeasurement' in w.orders()[0].items[0]),'a refused save stores nothing');
  console.log('J7 (client, refusal) passed: an unusable self measurement value is refused with the field named, and nothing is stored.');
}

// ---------------------------------------------------------------- J7 server
// The real lib/commerce.ts: the deferred lifecycle with the self
// measurement block, the E.1 payload on aligned and legacy
// orders, gauge specifications for ready and modify, provenance,
// and the profile store boundary.
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
const SUIT_V3_VALUES={height:70,weight:180,chest:40,chestOverArm:46,sleeveInseamL:18,sleeveInseamR:18,shoulder:18,jacketLength:29,jacketWaist:34,outseam:42,trouserWaist:34,seat:40,frontRise:11,thigh:24,inseam:32,rise:12,crotch:10};
const suitV3=(over={})=>({version:3,origin:'web',method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'J7 suit',unit:'in',fit:'Tailored',header:{profileType:'suit',jposLinks:null},figure:{},provenance:null,values:{...SUIT_V3_VALUES},...over});
(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  global.fetch=async(url,init)=>{if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url)};
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit'),shirtIdx=catalog.findIndex(p=>p.kind==='shirt');
  const suit=catalog[suitIdx],shirt=catalog[shirtIdx];
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const post=async(pathname,body,owner='owner-j7')=>commerce(new Request('https://shop.example'+pathname,{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':owner,'Idempotency-Key':'j7-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify(body)}),cenv);
  const checkoutItem=async item=>{const res=await post('/api/checkout',{items:[item],shipping});return{status:res.status,data:res.status===200?await res.json():null,stored:res.status===200?JSON.parse(cdb.rows.at(-1).items)[0]:null}};
  const storedItem=id=>JSON.parse(cdb.rows.find(r=>r.id===id).items)[0];
  const DEFERRED={name:'Measurements to follow',method:'deferred',wearer:'Men',garment:'suit',version:2,deferred:true};
  const EMPTY_SELF={customerid:null,DateLastModified:null,iscomplete:false,ActualHeightFeet:null,ActualHeightInches:null,Chest:null,ChestOverArm:null,waist:null,Seat:null,thigh:null,JacketSleeveLength:null,PantsWaist:null,PantsOutseam:null,frontviewimage:null,sideviewimage:null};

  // ---------------------------------------------------------- J7 server: deferred lifecycle
  const placed=await checkoutItem({product:suitIdx,profile:DEFERRED});
  assert.equal(placed.status,200,'checkout accepts a deferred item');
  const orderId=placed.data.orderId;
  assert.deepEqual(placed.stored.selfMeasurement,EMPTY_SELF,'a deferred item is stored with the empty SelfMeasurement block, unstamped so idempotent retries stay identical');
  assert.equal(placed.stored.profileProvenance,null,'a web deferred order carries no JPOS provenance');
  assert.ok(!('pieces' in placed.stored),'a deferred item with no aligned design carries no payload pieces');
  assert.equal(placed.data.totalCents,suit.priceCents,'the block changes nothing about the price');

  const sendSelf=(body,owner)=>post('/api/orders/'+orderId+'/measurements',body,owner);
  assert.equal((await sendSelf({index:0,selfMeasurement:{Chest:40,waist:34}},'someone-else')).status,404,'another owner cannot send self measurements');
  const partial=await sendSelf({index:0,selfMeasurement:{Chest:40,waist:34}});
  assert.equal(partial.status,200,'the owner sends a partial set');
  let sm=storedItem(orderId).selfMeasurement;
  assert.equal(sm.Chest,40,'the partial set is stored');
  assert.equal(sm.iscomplete,false,'the partial set reads incomplete');
  assert.equal(typeof sm.DateLastModified,'string','the first submission stamps the block');
  assert.equal((await partial.json()).total_cents,suit.priceCents,'self measurements change nothing about the total');
  assert.equal((await sendSelf({index:0,selfMeasurement:{Chest:'40'}})).status,400,'a string in place of a number is refused');
  assert.equal((await sendSelf({index:0,selfMeasurement:{Chest:500}})).status,400,'an impossible number is refused');
  assert.equal((await sendSelf({index:0,selfMeasurement:{ActualHeightFeet:5.5}})).status,400,'a fractional height in feet is refused');
  assert.equal((await sendSelf({index:0,selfMeasurement:{ShoeSize:10}})).status,400,'a field outside the SelfMeasurement set is refused');
  assert.equal((await sendSelf({index:0,selfMeasurement:{frontviewimage:'data:image/png;base64,AAAA'}})).status,400,'photo data is refused: there is no sanctioned place to store it');
  const bodyProfile={version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Server suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...SUIT_VALUES}};
  assert.equal((await sendSelf({index:0,selfMeasurement:{Seat:40},profile:bodyProfile})).status,400,'a request carrying both shapes is refused rather than half applied');
  const rest={...SELF_FULL};delete rest.Chest;delete rest.waist;
  assert.equal((await sendSelf({index:0,selfMeasurement:rest})).status,200,'the rest of the set is accepted on a later visit');
  sm=storedItem(orderId).selfMeasurement;
  assert.equal(sm.iscomplete,true,'the accumulated set reads complete');
  assert.equal(sm.Chest,40,'the earlier partial values survive');
  const readBack=await commerce(new Request('https://shop.example/api/orders/'+orderId,{headers:{'oai-authenticated-user-id':'owner-j7'}}),cenv);
  assert.equal((await readBack.json()).items[0].selfMeasurement.iscomplete,true,'the order read shows the completed set');

  // The profile completion then works exactly as in M6, and the
  // block stays as order history.
  const attached=await sendSelf({index:0,profile:bodyProfile});
  assert.equal(attached.status,200,'the full profile still completes the item');
  const completedItem=storedItem(orderId);
  assert.equal(completedItem.profile.method,'body','the stored profile is the attached one');
  assert.equal(completedItem.selfMeasurement.iscomplete,true,'the self measurement block stays on the completed item');
  assert.equal((await sendSelf({index:0,selfMeasurement:{Chest:41}})).status,400,'a completed item accepts no further self measurements');
  console.log('J7 (server, deferred lifecycle) passed: the deferred item stores the empty E.5 block, submissions accumulate to complete under the owner only, invalid and photo carrying submissions are refused, and the M6 profile completion is unchanged.');

  // ---------------------------------------------------------- J7 server: the aligned payload
  const alignedDesign={optionModel:3,fabric:'Navy',lining:'Tonal',closure:'2-Button',lapelType:'Notch',lapelSize:'Standard',buttonStyle:'Matching',vents:'Side',cuffButtons:'4 Buttons',cuffButtonType:'Regular',cuffButtonHole:'Imitation Button Holes',cuffStitchType:'Default',cuffStitchColor:'Match',waistPocketType:'Flap',waistPocketAngle:'Horizontal',ticketPocket:'None',breastPocketType:'Welt',underCollarFabric:'Milanese Single Color',collarEyelet:'Teardrop (Standard)',exteriorStitch:'None',frenchFacing:'No',labelStyle:'Personalized Name',labelColor:'Default (Contrasting)',collarMonogramStyle:'Block',collarColor:'Default (Contrasting)',monogram:'Alex Kumar',tuxedo:'No',pleats:'Single Rvrs Pleat',sidePockets:'Slanted',backPockets:'Double Besom',backPocketClosure:'Button Thru',trouserCuff:'Plain',frontTab:'Pointed',legBreak:'Medium',watchPocket:'None',suspenderButtons:'No',elasticSideTabs:'None',tunnelBeltLoops:'No',beltLoops:'Yes',secondPairPants:'Yes',pants2:{pleats:'Flat Front',sidePockets:'On-Seam',trouserCuff:'None'},vestIncluded:'Yes',vestStyle:'Notch Lapel',vestButtons:'5-Button',vestPocketType:'Welt',vestPocketNumber:'2-Pocket',vestBack:'Lining'};
  const aligned=await checkoutItem({product:suitIdx,...alignedDesign,profile:suitV3({secondPair:{trouserWaist:36,seat:41,thigh:25,inseam:33,outseam:43,rise:12,bottom:17,knee:16}})});
  assert.equal(aligned.status,200,'the aligned suit checks out');
  assert.equal(aligned.data.totalCents,suit.priceCents+2500,'the aligned suit totals as before: base plus the Milanese under collar only');
  const pieces=aligned.stored.pieces;
  assert.ok(pieces,'the aligned order carries the JPOS payload');
  assert.deepEqual(pieces.jacket.style,{Button:'2-Button',LapelType:'Notch',LapelSize:'Standard',Vent:'Side',WaistPocketType:'Flap',WaistPocketAngle:'Horizontal',TicketPocket:'None',BreastPocketType:'Welt',ButtonStyle:'Matching',CuffButtonNumber:'4 Buttons',CuffButtonType:'Regular',CuffButtonHole:'Imitation Button Holes',CuffStitchType:'Default',CuffStitchColor:'Match',UnderCollarFabric:'Milanese Single Color',CollarEyelet:'Teardrop (Standard)',FrenchFacing:'No',ExteriorStitch:'None',Label:'Personalized Name',LabelColor:'Default (Contrasting)',CollarMonogram:'Block',CollarColor:'Default (Contrasting)',Lining:'Tonal',labelText:'Alex Kumar'},'the jacket style section carries the aligned choices under the orders column names');
  assert.deepEqual(pieces.jacket.measurements,{Height:70,Chest:40,ChestOverArm:46,Weight:180,JacketPointToPoint:18,Shoulder:18,JacketLength:29,JacketSleeveInseamL:18,JacketSleeveInseamR:18,JacketWaist:34,Seat:40,GaugeSuitJacketWaist:34,GaugeSuitPantsWaist:34},'the jacket measurements follow section E.3, gauge pair included for a suit');
  assert.deepEqual(pieces.pants.style,{PantsPleat:'Single Rvrs Pleat',PantsSidePockets:'Slanted',PantsBackPocketStyle:'Double Besom',PantsBackPocketClosure:'Button Thru',PantsCuff:'Plain',PantsFrontTab:'Pointed',PantsLegBreak:'Medium',PantsWatchPocket:'None',PantsSuspenderButtons:'No',PantsElasticSideTabs:'None',PantsTunnelBeltLoops:'No',PantsBeltLoops:'Yes'},'the trousers style section carries the J4 groups under the Pants columns');
  assert.deepEqual(pieces.pants.measurements,{PantsWaist:34,Seat:40,PantsThigh:24,PantsInseam:32,PantsOutseamRI:42,PantsRise:12,PantsFrontRise:11,Pants74Crotch:10},'the trousers measurements follow section E.3, unset optional fields absent');
  assert.deepEqual(pieces.pants2.style,{Pants2Pleat:'Flat Front',Pants2SidePockets:'On-Seam',Pants2Cuff:'None',Pants2ndPairofPants:'Yes'},'the second pair style follows the Pants2 columns as J4 built it');
  assert.deepEqual(pieces.pants2.measurements,{Pants2Waist:36,Pants2Seat:41,Pants2Thigh:25,Pants2Inseam:33,Pants2OutseamRI:43,Pants2Rise:12,Pants2Bottom:17,Pants2Knee:16},'the second pair measurements come from the profile second pair block');
  assert.deepEqual(pieces.vest.style,{VestStyle:'Notch Lapel',VestButton:'5-Button',VestPocketType:'Welt',VestPocketNbr:'2-Pocket',VestBack:'Lining'},'the vest piece carries the JPOS vest fields');
  assert.ok(!JSON.stringify(pieces).includes('BodyStyle'),'no pattern template code is derived or recorded (section F)');
  assert.equal(aligned.stored.selfMeasurement,null,'a measured order carries the self measurement slot as null');
  assert.equal(aligned.stored.profileProvenance,null,'a web profile order carries provenance null');
  assert.equal(aligned.stored.fabricID,null,'no JPOS fabric id exists on the web side yet');
  assert.equal(aligned.stored.FabricChoice,'Navy','the fabric choice rides beside the fabric code');

  // A legacy design with a version 3 profile: the measurements
  // are payload content, the legacy style vocabulary is not
  // renamed into JPOS columns.
  const legacy=await checkoutItem({product:suitIdx,lapel:'Notch',closure:'Two button',lining:'Tonal',pleats:'Forward single pleat',vest:'Classic vest',profile:suitV3()});
  assert.equal(legacy.status,200,'the legacy design still checks out');
  assert.equal(legacy.data.totalCents,suit.priceCents+9900+500,'legacy pricing is untouched: the named vest and the forward pleat price as before');
  assert.ok(legacy.stored.pieces.jacket.measurements,'the version 3 measurements reach the payload on a legacy design too');
  assert.equal(legacy.stored.pieces.jacket.style,undefined,'legacy jacket values are not renamed into JPOS style columns');
  assert.equal(legacy.stored.pieces.pants.style,undefined,'legacy trousers values are not renamed into JPOS style columns');

  // An aligned shirt: its style and ShirtsM measurements land on
  // the shirt piece, priced as J5 left it.
  const shirtProfile={version:3,origin:'web',method:'body',garment:'shirt',wearer:'Men',wearerName:'Alex Kumar',name:'J7 shirt',unit:'in',fit:'Tailored',header:{profileType:'shirt',jposLinks:null},figure:{},provenance:null,values:{height:70,neck:15.5,chest:40,sleeve:25,shoulder:18,backLength:30,bicep:13,cuffSize:8,waist:34,sweep:42}};
  const shirtOrder=await checkoutItem({product:shirtIdx,optionModel:3,fabric:'Blue',shirtBodyStyle:'Slim',shirtFrontStyle:'Hidden Placket',shirtCollarType:'Cut away',shirtCollarHeight:'High',shirtSleeveStyle:'Straight',shirtCuffStyle:'French Mitered',shirtBackStyle:'Center Pleat',shirtPocketStyle:'V-Shaped',shirtPocketPosition:'Left',shirtButtons:'Mop1white',shirtButtonHoleThread:'Match',shirtMonogramPlacement:'Left Cuff',shirtMonogramFont:'Script',shirtStitching:'1/16 Edge Stitch',shirtThreadColor:'Match',monogram:'AK',profile:shirtProfile});
  assert.equal(shirtOrder.status,200,'the aligned shirt checks out');
  assert.equal(shirtOrder.data.totalCents,shirt.priceCents+1000,'the shirt totals as J5 left it: base plus the hidden placket');
  assert.equal(shirtOrder.stored.pieces.shirt.style.ShirtsFStyle,'Hidden Placket','the shirt front style lands under its orders column');
  assert.equal(shirtOrder.stored.pieces.shirt.style.ShirtsCollarStyle,'Cut away','the shirt collar lands under its orders column');
  assert.equal(shirtOrder.stored.pieces.shirt.measurements.ShirtsMNeckbody,15.5,'the shirt body measurements land in the ShirtsM set');
  console.log('J7 (server, payload) passed: aligned orders carry the per piece JPOS payload with totals unchanged, legacy values are never renamed into it, and template codes stay unrecorded.');

  // ---------------------------------------------------------- J7 server: gauge specifications and provenance
  const readyOrder=await checkoutItem({product:suitIdx,profile:{version:2,method:'ready',garment:'suit',wearer:'Men',name:'Ready fit',unit:'in',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'}}});
  assert.equal(readyOrder.status,200,'a ready order checks out');
  assert.deepEqual(readyOrder.stored.pieces,{jacket:{gaugeSpec:{inputs:{},labels:{jacket:'40',length:'Regular'},finished:null}},pants:{gaugeSpec:{inputs:{},labels:{trouser:'34'},finished:null}}},'a ready order carries the per piece gauge specification: labels only, no finished value invented');
  const MODIFY_VALUES={gJacketChest:44,gShoulderWidth:18,gJacketMidsection:40.5,gJacketLength:29.5,gSleeveLength:25,gBicepWidth:13,gSleeveOpening:9.5,gWaistCircumference:36,gHipWidth:41,gThighWidth:23,gKneeWidth:15.5,gLegOpening:15,gFrontRise:11,gInseam:32};
  const modifyOrder=await checkoutItem({product:suitIdx,profile:{version:2,method:'modify',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Usual 40',unit:'in',fit:'Tailored',base:{jacket:40,length:'Regular',trouser:34,inseam:32},values:{...MODIFY_VALUES}}});
  assert.equal(modifyOrder.status,200,'a modify order checks out');
  assert.deepEqual(modifyOrder.stored.pieces.jacket.gaugeSpec.labels,{jacket:40,length:'Regular'},'the modify jacket piece records its base labels');
  assert.deepEqual(modifyOrder.stored.pieces.jacket.gaugeSpec.adjustments,{gJacketChest:44,gShoulderWidth:18,gJacketMidsection:40.5,gJacketLength:29.5,gSleeveLength:25,gBicepWidth:13,gSleeveOpening:9.5},'the jacket adjustments are the jacket fields the shopper set');
  assert.deepEqual(modifyOrder.stored.pieces.pants.gaugeSpec.labels,{trouser:34,inseam:32},'the modify trousers piece records its base labels');
  assert.deepEqual(modifyOrder.stored.pieces.pants.gaugeSpec.adjustments,{gWaistCircumference:36,gHipWidth:41,gThighWidth:23,gKneeWidth:15.5,gLegOpening:15,gFrontRise:11,gInseam:32},'the trousers adjustments are the trousers fields the shopper set');
  assert.equal(modifyOrder.stored.pieces.jacket.gaugeSpec.finished,null,'no finished specification is estimated for a modify order either');

  const imported=await checkoutItem({product:suitIdx,profile:suitV3({origin:'jpos',provenance:{sourceSystem:'jpos',jposCustomerId:'cust-123',jposMeasurementId:'meas-88',jposGaugeSuitProfileId:'gauge-91',jposOrderIds:{jacket:'ord-555',pants:'ord-556',vest:null},importedAt:'2026-10-01T00:00:00.000Z',sourceCreatedAt:'2020-05-01T00:00:00.000Z',sourceModifiedAt:null,sourceTable:'measurementProfiles'}})});
  assert.equal(imported.status,200,'an order from an imported profile checks out');
  assert.deepEqual(imported.stored.profileProvenance,{jposCustomerId:'cust-123',jposMeasurementId:'meas-88',jposGaugeSuitProfileId:'gauge-91',jposOrderIds:{jacket:'ord-555',pants:'ord-556',vest:null}},'the order item carries the import ids at item level (section E.6)');

  // The profile store boundary: a self measurement shape is not
  // a profile and checkout refuses it as one.
  assert.equal((await checkoutItem({product:suitIdx,profile:{method:'selfMeasurement',values:{...SELF_FULL}}})).status,400,'a self measurement shape cannot be checked out as a profile');
  console.log('J7 (server, gauge and provenance) passed: ready and modify orders carry labels and adjustments with finished specifications left empty for the gauge data, imported profiles stamp their ids on the order, and the self measurement set is refused as a profile.');
})().catch(e=>{console.error(e);process.exit(1)});
