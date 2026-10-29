const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path');
// Journey J-M6 (measurements wave, package M6): deferred
// measurements, owner decision O7. A shopper may place an order
// with measurements to follow: the customizer's Measurements step
// offers "Provide measurements later" as a deliberate third
// choice, the bag, checkout and order record the item in an
// explicit deferred state with no measurement values anywhere,
// the order surfaces mark it incomplete, and the shopper later
// attaches a real profile from the order page, either a saved one
// or one measured on the spot in the garment studio. The server
// half runs the real lib/commerce.ts: checkout stores the
// deferred shape cleaned by the same rule that refuses smuggled
// values, and POST /api/orders/:id/measurements attaches the
// completed profile to the stored order. Driven on the real
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
const SUIT_VALUES={height:70,chest:40,sleeve:25,shoulder:18,jacket:29,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24};
const SUIT_PROFILE={id:'suit-profile-1',version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Saved suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...SUIT_VALUES},created:'2026-02-01T00:00:00.000Z'};
const SHIRT_PROFILE={id:'shirt-profile-1',version:2,method:'body',garment:'shirt',wearer:'Men',wearerName:'Alex Kumar',name:'Saved shirt fit',unit:'in',fit:'Tailored',fits:{shirtFit:'Relaxed'},values:{height:70,neck:15.5,chest:40,sleeve:25,shoulder:18,frontLength:29,stomach:34,seat:40},created:'2026-02-02T00:00:00.000Z'};
const SHIPPING_FORM={email:'jm6@example.com',firstName:'Alex',lastName:'Kumar',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'};
function demoCheckout(w){
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:${JSON.stringify(SHIPPING_FORM)}})`);
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
}

// ---------------------------------------------------------------- J-M6 client
// Defer at the customizer, bag and checkout show the deferred
// state, the demo order records it distinctly, and the order page
// prompts for completion until a saved profile is attached.
{
  const w=makeWorld({profiles:[SUIT_PROFILE]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  assert.equal(w.run('stage'),2,'the customizer reaches the Measurements step');
  const methods=w.run('customize()');
  assert.ok(methods.includes('Measure my body')&&methods.includes('Use a standard size'),'the two profile methods are still offered');
  assert.ok(methods.includes('Provide measurements later'),'the deferred choice is offered as a deliberate third method');
  assert.ok(methods.includes('id="profileSelect"'),'a profile can still be chosen in the normal way');

  // Choosing deferred is explicit, is not a profile, and does not
  // touch the Studio's own method state.
  w.run("setCustomizerMethod('deferred')");
  assert.equal(w.run('customizerMethod()'),'deferred','the deferred method is the active choice');
  assert.equal(w.run('draft.method'),'body','the Studio draft method is never set to deferred');
  const deferredHtml=w.run('customize()');
  assert.ok(deferredHtml.includes('measurements to follow'),'the Measurements step explains the deferred state');
  assert.ok(deferredHtml.includes('nothing is measured or guessed for you'),'the step states that nothing is filled in');
  assert.ok(!deferredHtml.includes('id="profileSelect"'),'no profile select is shown while deferred is chosen');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag bags the deferred item');
  const item=w.bag()[0];
  assert.deepEqual(item.profile,{name:'Measurements to follow',method:'deferred',wearer:'Men',garment:'suit',version:2,deferred:true},'the bagged profile is exactly the deferred state, with no values');
  assert.equal(w.run('profiles.length'),1,'deferring creates no saved profile');
  assert.equal(w.run('config.deferMeasurements'),undefined,'the defer choice is consumed by bagging, not left armed');

  // Bag and checkout surfaces show the item as measurements to follow.
  const line=w.run('lineHtml(bag[0])');
  assert.ok(line.includes('Fit profile: Measurements to follow'),'the bag line names the deferred state');
  assert.ok(line.includes('Measurements to follow: we cannot start making this garment until you add them.'),'the bag line states the consequence');
  w.run('openBag()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Measurements to follow'),'the bag modal shows the deferred state');
  const summary=w.run('checkoutPage()');
  assert.ok(summary.includes('Measurements to follow: we cannot start making this garment until you add them.'),'the checkout summary shows the deferred item');
  w.run('checkoutStage=1');
  const review=w.run('checkoutPage()');
  assert.ok(review.includes('Measurements to follow: at least one item in this order has no measurements yet.'),'the review step calls out the deferred order before it is placed');
  w.run('checkoutStage=0');

  // The demo order records the deferred state distinctly.
  demoCheckout(w);
  assert.equal(w.orders().length,1,'the demo checkout records one order');
  const order=w.orders()[0];
  assert.equal(order.items[0].profile.method,'deferred','the demo order item is deferred');
  assert.ok(!('values' in order.items[0].profile),'the demo order item carries no measurement values');
  assert.equal(w.run('orderNeedsMeasurements(orders[0])'),true,'the order reads as needing measurements');

  // The order page and the orders list mark it incomplete and
  // prompt for completion from the order.
  const page=w.run(`orderPage('${order.id}')`);
  assert.ok(page.includes('Measurements: to follow. This order stays incomplete until they are added.'),'the order page marks the order incomplete');
  assert.ok(page.includes('Add measurements'),'the order page offers the completion action');
  assert.ok(w.run('ordersPage()').includes('Measurements to follow'),'the orders list flags the incomplete order');

  // Attach the saved profile from the order page.
  w.run(`openOrderMeasurements('${order.id}',0)`);
  const modal=w.elFor('#modalContent').innerHTML;
  assert.ok(modal.includes('Add measurements for'),'the completion dialog names the garment');
  assert.ok(modal.includes('Saved suit fit'),'the saved suit profile is offered for this garment');
  assert.ok(modal.includes('Take my measurements'),'measuring on the spot is offered too');
  w.run(`attachProfileToOrder('${order.id}',0,'suit-profile-1')`);
  const done=w.orders()[0];
  assert.equal(done.items[0].profile.method,'body','the attached profile replaces the deferred state');
  assert.equal(done.items[0].profile.id,'suit-profile-1','the demo order records the profile that was attached');
  assert.deepEqual(done.items[0].profile.values,SUIT_VALUES,'the attached values are the profile values, intact');
  assert.equal(w.run('orderNeedsMeasurements(orders[0])'),false,'the order no longer needs measurements');
  const donePage=w.run(`orderPage('${order.id}')`);
  assert.ok(!donePage.includes('stays incomplete'),'the order page no longer marks the order incomplete');
  assert.ok(!donePage.includes('Add measurements'),'the completion action is gone once measurements are attached');
  assert.ok(!w.run('ordersPage()').includes('Measurements to follow'),'the orders list no longer flags the order');
  console.log('J-M6 (client, defer and attach) passed: deferring is a deliberate customizer choice, the bag, checkout and demo order show the deferred state with no values, the order surfaces mark it incomplete, and attaching a saved profile from the order page completes it.');
}

// ---------------------------------------------------------------- J-M6 client
// Completion by measuring: from the order page into the garment
// studio, and the profile saved there attaches to the order item.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('deferred')");
  w.run('nextConfig()');
  demoCheckout(w);
  const orderId=w.orders()[0].id;
  assert.equal(w.orders()[0].items[0].profile.method,'deferred','the second order starts deferred');

  w.run(`measureForOrderItem('${orderId}',0)`);
  assert.equal(w.run('location.hash'),'#measure','measuring from the order opens the Studio');
  assert.equal(w.run('draft.garment'),'suit','the Studio carries the order item garment');
  assert.equal(w.run('garmentMode()'),true,'the garment aware studio is active');
  assert.ok(w.run('pendingOrderAttach')!==null,'the attach context is armed');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  w.run("updateValue('chest','40');updateValue('sleeve','25');updateValue('shoulder','18');updateValue('jacket','29');updateValue('stomach','34')");
  w.run('measureNext()');
  w.run("updateValue('pantsLength','42');updateValue('waist','34');updateValue('seat','40');updateValue('frontRise','11');updateValue('thigh','24')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'the Studio reaches its review step');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the new profile');
  const attached=w.orders()[0].items[0].profile;
  assert.equal(attached.method,'body','saving in the Studio attaches the profile to the order item');
  assert.equal(attached.garment,'suit','the attached profile names the garment');
  assert.deepEqual(attached.values,SUIT_VALUES,'the attached values are exactly what was measured');
  assert.equal(attached.id,w.run('profiles[0].id'),'the attached profile is the one the Studio saved');
  assert.equal(w.run('pendingOrderAttach'),null,'the attach context is consumed by the save');
  assert.equal(w.run('location.hash'),'#order/'+orderId,'the flow returns to the completed order');
  assert.equal(w.run('orderNeedsMeasurements(orders[0])'),false,'the order reads complete');
  console.log('J-M6 (client, measure and attach) passed: measuring from the order page runs the garment studio for that item, and the profile saved there attaches to the order.');
}

// ---------------------------------------------------------------- J-M6 client
// Editing a deferred bag item: the customizer reopens in the
// deferred state, and choosing a real profile saves the item
// measured, in place.
{
  const w=makeWorld({profiles:[SUIT_PROFILE,SHIRT_PROFILE]});
  w.run('chooseProduct(12)');w.run('beginDesign(12)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('deferred')");
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the deferred shirt is bagged');
  assert.equal(w.bag()[0].profile.garment,'shirt','the deferred item names the shirt garment');
  const bagId=w.bag()[0].id;
  w.run(`editBagItem('${bagId}')`);
  assert.equal(w.run('config.deferMeasurements'),true,'editing a deferred item reopens the customizer in the deferred state');
  w.run('stage=2');
  assert.equal(w.run('customizerMethod()'),'deferred','the deferred method shows active while editing');
  assert.ok(w.run('customize()').includes('measurements to follow'),'the deferred explanation shows while editing');
  w.run("setCustomizerMethod('body')");
  assert.equal(w.run('config.deferMeasurements'),undefined,'choosing a real method clears the defer choice');
  assert.equal(w.run('config.profileId'),'shirt-profile-1','the most recent profile for the garment wearer is selected');
  w.elFor('#profileSelect').value='shirt-profile-1';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'saving the edit updates the item in place');
  assert.equal(w.bag()[0].profile.method,'body','the edited item is now measured');
  assert.equal(w.bag()[0].profile.garment,'shirt','the edited item carries the shirt profile');
  console.log('J-M6 (client, bag edit) passed: a deferred bag item reopens deferred in the customizer, and saving it with a real profile completes it in place.');
}

// ---------------------------------------------------------------- J-M6 client
// The guard that predates M6 is unchanged: with no profile chosen
// and no defer choice made, Add to Bag still refuses.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  assert.ok(w.run('customize()').includes('Provide measurements later'),'the deferred choice is present alongside the guard');
  w.elFor('#profileSelect').value='';
  w.run('nextConfig()');
  assert.equal(w.bag().length,0,'nothing is bagged without a profile or a defer choice');
  assert.equal(w.elFor('#configError').textContent,'Choose a saved profile, or take your measurements first.','the existing refusal message is unchanged');
  console.log('J-M6 (client, guard) passed: deferring never becomes a silent default; without the deliberate choice the customizer still refuses to bag.');
}

// ---------------------------------------------------------------- J-M6 server
// The real lib/commerce.ts: checkout accepts and stores the
// deferred shape, refuses deferred items carrying values, and the
// measurements endpoint attaches a cleaned profile to the stored
// order under the order's owner only.
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
(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  global.fetch=async(url,init)=>{if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url)};
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit');
  assert.ok(suitIdx>=0,'the catalog has a suit product');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const post=async(pathname,body,owner='owner-jm6')=>commerce(new Request('https://shop.example'+pathname,{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':owner,'Idempotency-Key':'jm6-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify(body)}),cenv);
  const checkout=async(profile)=>{const res=await post('/api/checkout',{items:[{product:suitIdx,profile}],shipping});return{status:res.status,data:res.status===200?await res.json():null}};
  const storedProfile=()=>JSON.parse(cdb.rows.at(-1).items)[0].profile;
  const DEFERRED={name:'Measurements to follow',method:'deferred',wearer:'Men',garment:'suit',version:2,deferred:true};

  // A deferred item checks out and is stored in the explicit
  // deferred shape: state, wearer, garment, and empty values.
  const placed=await checkout(DEFERRED);
  assert.equal(placed.status,200,'checkout accepts a deferred item');
  const orderId=placed.data.orderId;
  assert.deepEqual(storedProfile(),{name:'Measurements to follow',method:'deferred',unit:'in',wearer:'Men',values:{},version:2,garment:'suit',deferred:true},'the stored order profile is exactly the deferred shape');
  assert.equal(placed.data.totalCents,catalog[suitIdx].priceCents,'deferring changes nothing about the price');

  // The review quote runs the same validation for a deferred item.
  const quote=await post('/api/checkout/quote',{items:[{product:suitIdx,profile:DEFERRED}],shipping});
  assert.equal(quote.status,200,'the review quote accepts a deferred item');

  // Deferred shapes carrying anything measurable are refused.
  assert.equal((await checkout({...DEFERRED,values:{chest:40}})).status,400,'a deferred item with smuggled body values is refused');
  assert.equal((await checkout({...DEFERRED,ready:{jacket:'40',length:'Regular',trouser:'34'}})).status,400,'a deferred item with smuggled standard sizes is refused');
  assert.equal((await checkout({...DEFERRED,fits:{jacketFit:'Regular Fit'}})).status,400,'a deferred item with smuggled fit selections is refused');
  assert.equal((await checkout({...DEFERRED,garment:'shirt'})).status,400,'a deferred item naming another garment is refused');
  assert.equal((await checkout({...DEFERRED,wearer:'Aliens'})).status,400,'a deferred item with an unrecognized wearer is refused');
  assert.equal(cdb.rows.length,1,'refused checkouts write no orders');

  // Measured orders behave exactly as before: a valid body profile
  // is accepted and a malformed one is still refused.
  const bodyProfile={version:2,method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'Server suit fit',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{...SUIT_VALUES}};
  assert.equal((await checkout(bodyProfile)).status,200,'a measured body profile still checks out');
  const broken={...bodyProfile,values:{...SUIT_VALUES}};delete broken.values.stomach;
  assert.equal((await checkout(broken)).status,400,'a body profile missing a required measurement is still refused');

  // Completion: only the order's owner, only while the item is
  // deferred, and the stored profile is the cleaned one.
  const attach=(id,body,owner)=>post('/api/orders/'+id+'/measurements',body,owner);
  assert.equal((await attach(orderId,{index:0,profile:bodyProfile},'someone-else')).status,404,'another owner cannot complete the order');
  assert.equal((await attach(orderId,{index:0,profile:broken})).status,400,'an incomplete profile cannot complete the order');
  assert.equal((await attach(orderId,{index:0,profile:DEFERRED})).status,400,'a deferred shape cannot complete the order');
  assert.equal((await attach(orderId,{index:5,profile:bodyProfile})).status,400,'an item that does not exist cannot be completed');
  const rowBefore=cdb.rows.find(r=>r.id===orderId);
  assert.equal(JSON.parse(rowBefore.items)[0].profile.method,'deferred','the refused completions leave the order deferred');
  const done=await attach(orderId,{index:0,profile:bodyProfile});
  assert.equal(done.status,200,'the owner completes the deferred item');
  const doneData=await done.json();
  assert.equal(doneData.items[0].profile.method,'body','the completion answer carries the measured profile');
  assert.deepEqual(doneData.items[0].profile.values,SUIT_VALUES,'the completion answer carries the cleaned values');
  assert.equal(doneData.total_cents,catalog[suitIdx].priceCents,'completion changes nothing about the order total');
  const stored=JSON.parse(cdb.rows.find(r=>r.id===orderId).items)[0].profile;
  assert.equal(stored.method,'body','the stored order now carries the measured profile');
  assert.equal(stored.version,2,'the stored profile is version 2');
  assert.equal(stored.garment,'suit','the stored profile names the garment');
  assert.ok(!('deferred' in stored),'the stored profile no longer reads as deferred');
  assert.equal((await attach(orderId,{index:0,profile:bodyProfile})).status,400,'a completed item cannot be completed again');
  const read=await commerce(new Request('https://shop.example/api/orders/'+orderId,{headers:{'oai-authenticated-user-id':'owner-jm6'}}),cenv);
  assert.equal(read.status,200,'the order still reads for its owner');
  assert.equal((await read.json()).items[0].profile.method,'body','the order read shows the attached measurements');
  console.log('J-M6 (server) passed: checkout stores the deferred shape and refuses smuggled values, measured orders are unchanged, and the measurements endpoint attaches the cleaned profile for the owner only, exactly once.');
})().catch(e=>{console.error(e);process.exit(1)});
