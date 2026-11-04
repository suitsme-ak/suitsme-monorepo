const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-01, aligned model (J wave package J3): the jacket core option
// groups follow the JPOS style form. Suits and standalone jackets get
// the JPOS closure (3-Roll-2 and the double breasted configurations),
// vents None, Center, Side, waist pocket type and angle, ticket
// pocket, breast pocket type and the cuff construction, all starting
// from the JPOS standards in alignedOptionDefaults. The only priced
// jacket choices are the Milanese under collar fabrics ($25, $40) from
// OPTION_PRICES in app.js: the customizer labels, the bag item price,
// the checkout total and the server order all read the same figures.
// World 5 and the server section pin the legacy rule: an item saved
// before the alignment (no aligned marker) renders and prices exactly
// as it did under the Wave 3 tables, which survive in
// LEGACY_OPTION_PRICES for that purpose only.
// Client worlds drive the real storefront scripts in a vm with stubbed
// DOM and storage, in the style of the other suites; the server section
// drives lib/commerce.ts through its checkout route like commerce.cjs.
function makeEl(){return{innerHTML:'',textContent:'',value:'',checked:false,open:false,classList:{add(){},remove(){},toggle(){return false}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),showModal(){this.open=true},close(){this.open=false},scrollIntoView(){}}}
const profile={id:'profile-1',name:'Test fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-10-27T00:00:00.000Z'};
function makeWorld(seed={}){
  const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  store.set('suits-profiles',JSON.stringify([profile]));
  if(seed.config)store.set('suits-config',JSON.stringify(seed.config));
  if(seed.bag)store.set('suits-bag',JSON.stringify(seed.bag));
  const sandbox={console,localStorage,location:{hash:'#home'},fetch:async()=>({ok:false,json:async()=>null}),crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',FormData:class{constructor(f){this.data=(f&&f._data)||{}}get(k){return k in this.data?this.data[k]:null}},document:{title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()},addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const config=()=>JSON.parse(store.get('suits-config'));
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,config,bag};
}
function bagCurrentWorld(w){w.run('stage=2;render(false)');w.elFor('#profileSelect').value='profile-1';w.run('nextConfig()')}

// World 1: a suit gains the aligned groups and the JPOS closure, the
// standards start selected, and the one priced jacket choice (the
// Milanese under collar) reaches the bag line and checkout.
{
  const w=makeWorld();
  assert.equal(w.run("optionPrice('underCollarFabric','Milanese Single Color')"),25,'the price table prices the Milanese single color under collar at $25');
  assert.equal(w.run("optionPrice('underCollarFabric','Milanese Multi-Color')"),40,'the price table prices the Milanese multi color under collar at $40');
  assert.equal(w.run("optionPrice('pocketAccent','Patch pocket')"),0,'the current price table no longer offers the retired pocket accent');
  assert.equal(w.run("legacyOptionPrice('pocketAccent','Patch pocket')"),15,'the legacy table keeps the pocket accent price for pre-alignment items only');
  assert.equal(w.run("optionPrice('vents','Side')"),0,'unpriced choices cost nothing');
  w.run('beginDesign(0)');
  assert.equal(w.config().vents,'Center','a fresh design starts from the aligned standards');
  assert.equal(w.config().cuffButtons,'4 Buttons','four cuff buttons are the JPOS standard');
  assert.ok(!('pocketAccent' in w.config()),'the retired pocket accent slot is never set by a new design');
  w.run('stage=1');
  const html=w.run('customize()');
  for(const title of ['Vents','Waist pocket style','Waist pocket angle','Ticket pocket','Breast pocket','Cuff buttons','Cuff button style','Under collar fabric'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`the Personalize step offers the ${title} group`);
  for(const style of ['1-Button','2-Button','3-Button','3-Roll-2','4-Button','2x1 DB','4x2 DB','6x1 DB','6x2 DB','8x2 DB'])assert.ok(html.includes(`setOption('closure','${style}')`),`the closure group offers ${style}`);
  assert.ok(!html.includes('Double vent'),'the vents group has no double vent: JPOS offers None, Center, Side');
  assert.ok(html.includes(`<button class="choice active" data-visual="vents:Center" aria-pressed="true" onclick="setOption('vents','Center')">`)&&html.includes('Center vent, single · Included</button>'),'the Center vent is the selected standard, labelled Included');
  assert.ok(html.includes(`<button class="choice active" data-visual="cuffButtons:4 Buttons" aria-pressed="true" onclick="setOption('cuffButtons','4 Buttons')">`)&&html.includes('4 buttons · Included</button>'),'four cuff buttons are the selected standard, labelled Included');
  assert.ok(html.includes(`<button class="choice active" data-visual="ticketPocket:None" aria-pressed="true" onclick="setOption('ticketPocket','None')">`)&&html.includes('No ticket pocket · Included</button>'),'no ticket pocket is the selected standard, labelled Included');
  assert.ok(html.includes('Milanese felt, one color · +$25'),'the Milanese single color choice shows its +$25 price');
  assert.ok(html.includes('Milanese felt, multiple colors · +$40'),'the Milanese multi color choice shows its +$40 price');
  assert.ok(html.includes('Flap ticket pocket · Included'),'unpriced pocket choices are labelled Included');
  w.run("setOption('vents','Side');setOption('cuffButtons','5 Buttons');setOption('waistPocketType','Patch');setOption('closure','3-Roll-2');setOption('underCollarFabric','Milanese Single Color')");
  const chosen=w.run('customize()');
  assert.ok(chosen.includes('<div class="price">$424 '),'the customizer price rises by the Milanese price only');
  assert.ok(chosen.includes(`aria-pressed="true" onclick="setOption('waistPocketType','Patch')"`),'the chosen waist pocket type renders selected');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.vents,'Side');assert.equal(item.cuffButtons,'5 Buttons');assert.equal(item.waistPocketType,'Patch');assert.equal(item.closure,'3-Roll-2');assert.equal(item.underCollarFabric,'Milanese Single Color');assert.equal(item.optionModel,3);
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel, Standard · 3-Roll-2 · Side vents · 5 cuff buttons · Patch waist pockets · Milanese Single Color under collar · Flat front, no pleats · Slanted pockets · Double besom back pockets · Medium break · Belt loops · Tonal lining','the bag line shows the new selections in customizer order, trousers specification included since J4');
  assert.ok(w.run('lineHtml(bag[0])').includes('$424'),'the bag line price includes the Milanese price');
  assert.equal(w.run('subtotal()'),424,'the subtotal includes the Milanese price');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Patch waist pockets')&&checkout.includes('$424'),'the checkout shows the selection and the raised total');
  // Bag Edit restores the new selections and reprices on change.
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().vents,'Side','bag Edit restores the vents');
  assert.equal(w.config().cuffButtons,'5 Buttons','bag Edit restores the cuff buttons');
  assert.equal(w.config().waistPocketType,'Patch','bag Edit restores the waist pocket type');
  w.run("setOption('underCollarFabric','Match')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.bag()[0].underCollarFabric,'Match','the edited line carries the new under collar fabric');
  assert.equal(w.run('subtotal()'),399,'the edited line is repriced from the same table');
}

// World 2: a standalone jacket gets the same groups and pricing.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(idx>=0,'the catalog holds a standalone jacket');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  for(const title of ['Vents','Waist pocket style','Ticket pocket','Cuff buttons'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`the jacket Personalize step offers the ${title} group`);
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('vents','Center')"`),'the jacket starts from the same standards');
  w.run("setOption('ticketPocket','Flap');setOption('underCollarFabric','Milanese Multi-Color')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.ticketPocket,'Flap','the jacket line stores the ticket pocket');
  assert.equal(item.vents,'Center','the jacket line stores the standard vent it started from');
  assert.equal(w.run('subtotal()'),base+40,'the jacket subtotal includes the Milanese price');
  assert.ok(w.run('lineHtml(bag[0])').includes('$'+(base+40)),'the jacket bag line shows the raised price');
  assert.ok(w.run('lineDescription(bag[0])').includes('Flap ticket pocket'),'the jacket bag line shows the ticket pocket');
}

// World 3: the Milanese single color adds $25, returning to Match
// returns the price to base.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('underCollarFabric','Milanese Single Color')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),424,'a Milanese single color under collar adds exactly $25');
  w.run(`editBagItem('${w.bag()[0].id}')`);
  w.run("setOption('underCollarFabric','Match')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),399,'returning to Match returns the price to the base');
  assert.ok(!w.run('lineDescription(bag[0])').includes('under collar'),'a Match under collar adds no bag line segment');
}

// World 4: the CUS-07 product change reset restores the aligned
// standards too.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('waistPocketType','Patch');setOption('vents','Side');setOption('cuffButtons','5 Buttons');setOption('underCollarFabric','Milanese Multi-Color')");
  w.run('beginDesign(1)');
  const config=w.config();
  assert.equal(config.waistPocketType,'Flap','starting another product resets the waist pocket type to the standard');
  assert.equal(config.vents,'Center','starting another product resets the vents to the standard');
  assert.equal(config.cuffButtons,'4 Buttons','starting another product resets the cuff buttons to the standard');
  assert.equal(config.underCollarFabric,'Match','starting another product resets the under collar fabric');
  w.run('stage=1');
  assert.ok(w.run('customize()').includes(`aria-pressed="true" onclick="setOption('ticketPocket','None')"`),'the second product starts from the standard ticket pocket');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.waistPocketType,'Flap','the second product line carries the standard, not the first product choice');
  assert.equal(w.run('subtotal()'),449,'the second product is priced at its base');
}

// World 5: a legacy bag item and config, saved before the new fields
// existed, load and render exactly as before. Its price follows the
// current tables only through the two deliberate repricings that apply
// to its stored values: the Peak lapel modifier package 3.3 prices
// (Peak at +$10) and the filled monogram package 3.4 prices (+$10);
// the 3.3 suite pins the Peak rule and the 3.4 suite pins the monogram
// rule down.
{
  const legacy={id:'legacy-1',product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB'}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Peak lapel · Slim fit · One button · Burgundy lining · Monogram AB','a legacy line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),20,'a legacy line charges the Peak lapel modifier and the filled monogram charge');
  assert.equal(w.run('itemPrice(bag[0])'),419,'a legacy line is priced at the product base plus both modifiers');
  assert.equal(w.run('subtotal()'),419,'the legacy subtotal follows the same rule');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('$419'),'the legacy item checks out at its base price plus both modifiers');
  w.run("editBagItem('legacy-1')");
  w.run("setOption('lining','Midnight')");
  bagCurrentWorld(w);
  assert.deepEqual(w.bag()[0],{...legacy,lining:'Midnight',profileId:'profile-1'},'editing a legacy line changes only what the shopper changed (plus the profileId every edit save records), with no new option fields injected');
}

// Server: the order sanitizer persists the new selections and prices
// the pocket accent from the mirrored table, for suits and jackets only.
(async()=>{
  const ts=require('typescript'),Module=require('node:module'),path=require('node:path');
  const file=path.resolve('lib/commerce.ts'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
  const {commerce}=m.exports;
  class DB{constructor(){this.rows=[]}prepare(sql){const self=this;return{bind(...args){return{async first(){if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;return self.rows.find(r=>r.id===args[0])||null},async run(){if(sql.startsWith('INSERT')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}return{success:true}}}}}}}
  const db=new DB,env={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:db};
  let providerAmount;
  global.fetch=async(_url,init)=>{const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest){providerAmount=data.getHostedPaymentPageRequest.transactionRequest.amount;return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'})}throw Error('Unexpected network request')};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  const req=(body,key)=>new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-1','Idempotency-Key':key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit'&&p.fabricCode),suit=catalog[suitIdx];
  const readyProfile={name:'Test fit',method:'ready',ready:{jacket:'40',length:'Regular',trouser:'34'}};
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Three button',vents:'Double vent',cuffButtons:'Four',pocketAccent:'Patch pocket',fit:'Tailored',lining:'Tonal',monogram:'',profile:readyProfile}],shipping},'jacket-options-00000001'),env);
  assert.equal(r.status,200,'a checkout carrying the new selections succeeds');
  const placed=await r.json();
  assert.equal(placed.totalCents,suit.priceCents+1500,'the server total adds the Patch pocket modifier');
  assert.equal(providerAmount,((suit.priceCents+1500)/100).toFixed(2),'the payment amount matches the raised total');
  const stored=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(stored.vents,'Double vent','the order item persists the vents');
  assert.equal(stored.cuffButtons,'Four','the order item persists the cuff buttons');
  assert.equal(stored.pocketAccent,'Patch pocket','the order item persists the pocket accent');
  assert.equal(stored.priceCents,suit.priceCents+1500,'the order item price carries the modifier');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',pocketAccent:'None',fit:'Tailored',lining:'Tonal',monogram:'',profile:readyProfile}],shipping},'jacket-options-00000002'),env);
  assert.equal((await r.json()).totalCents,suit.priceCents,'a None pocket accent adds nothing server side');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  r=await commerce(req({items:[{product:pantsIdx,fabric:'Wool',lapel:'',closure:'Flat front',pocketAccent:'Patch pocket',fit:'Tailored',lining:'',monogram:'',profile:readyProfile}],shipping},'jacket-options-00000003'),env);
  assert.equal((await r.json()).totalCents,pants.priceCents,'a pocket accent value on trousers is never priced');
  console.log('Customizer jacket option checks passed: suits and jackets render the aligned JPOS groups (closure with 3-Roll-2 and the DB configurations, vents None Center Side, the pocket groups and the cuff construction) with standards preselected, the Milanese under collar prices flow from the one table to the customizer, bag, checkout and server order, bag Edit restores the selections, a product switch resets them to the standards, and legacy items render and price unchanged through the legacy tables.');
})().catch(e=>{console.error(e);process.exit(1)});
