const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-01 (Wave 3 package 3.1): the jacket core option groups and the
// price modifier mechanism. Suits and standalone jackets gain Vents,
// Jacket cuff buttons and Pocket accent groups in the Personalize step,
// the Jacket closure group gains Three button and Four button, and the
// pocket accent choices carry prices from the single OPTION_PRICES table
// in app.js: the customizer labels, the bag item price, the checkout
// total and the server order all read the same figures. The new config
// slots stay absent until a shopper picks a choice, so a stored config
// or bag item from before this change (no new fields) loads with the
// defaults and renders exactly as before.
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
  for(const f of ['app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const config=()=>JSON.parse(store.get('suits-config'));
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,config,bag};
}
function bagCurrentWorld(w){w.run('stage=2;render(false)');w.elFor('#profileSelect').value='profile-1';w.run('nextConfig()')}

// World 1: a suit gains the three groups, the extended closure, priced
// choices, and the modifier reaches the bag line and checkout.
{
  const w=makeWorld();
  assert.equal(w.run("optionPrice('pocketAccent','Patch pocket')"),15,'the price table prices a Patch pocket at $15');
  assert.equal(w.run("optionPrice('pocketAccent','Ticket pocket')"),5,'the price table prices a Ticket pocket at $5');
  assert.equal(w.run("optionPrice('vents','Double vent')"),0,'unpriced choices cost nothing');
  w.run('beginDesign(0)');
  assert.ok(!('vents' in w.config())&&!('cuffButtons' in w.config())&&!('pocketAccent' in w.config()),'the new slots stay unset until the shopper picks a choice');
  w.run('stage=1');
  const html=w.run('customize()');
  for(const title of ['Vents','Jacket cuff buttons','Pocket accent'])assert.ok(html.includes(`<div class="option-title">${title}</div>`),`the Personalize step offers the ${title} group`);
  for(const style of ['Two button','One button','Three button','Four button','Double breasted'])assert.ok(html.includes(`setOption('closure','${style}')`),`the closure group offers ${style}`);
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('vents','Single vent')">Single vent · Included</button>`),'Single vent is the selected default, labelled Included');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('cuffButtons','Three')">Three · Included</button>`),'Three cuff buttons is the selected default, labelled Included');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pocketAccent','None')">None · Included</button>`),'No pocket accent is the selected default, labelled Included');
  assert.ok(html.includes('Ticket pocket · +$5'),'the Ticket pocket choice shows its +$5 modifier');
  assert.ok(html.includes('Slant pocket · +$5'),'the Slant pocket choice shows its +$5 modifier');
  assert.ok(html.includes('Patch pocket · +$15'),'the Patch pocket choice shows its +$15 modifier');
  assert.ok(html.includes('Double vent · Included'),'unpriced vent choices are labelled Included');
  w.run("setOption('vents','Double vent');setOption('cuffButtons','Four');setOption('pocketAccent','Patch pocket');setOption('closure','Three button')");
  const chosen=w.run('customize()');
  assert.ok(chosen.includes('<div class="price">$414 '),'the customizer price rises by the Patch pocket modifier');
  assert.ok(chosen.includes(`aria-pressed="true" onclick="setOption('pocketAccent','Patch pocket')"`),'the chosen pocket accent renders selected');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.vents,'Double vent');assert.equal(item.cuffButtons,'Four');assert.equal(item.pocketAccent,'Patch pocket');assert.equal(item.closure,'Three button');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Three button · Double vent · Four cuff buttons · Patch pocket · Tonal lining','the bag line shows the new selections in customizer order');
  assert.ok(w.run('lineHtml(bag[0])').includes('$414'),'the bag line price includes the modifier');
  assert.equal(w.run('subtotal()'),414,'the subtotal includes the modifier');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Patch pocket')&&checkout.includes('$414'),'the checkout shows the selection and the raised total');
  // Bag Edit restores the new selections and reprices on change.
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().vents,'Double vent','bag Edit restores the vents');
  assert.equal(w.config().cuffButtons,'Four','bag Edit restores the cuff buttons');
  assert.equal(w.config().pocketAccent,'Patch pocket','bag Edit restores the pocket accent');
  w.run("setOption('pocketAccent','Slant pocket')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.bag()[0].pocketAccent,'Slant pocket','the edited line carries the new pocket accent');
  assert.equal(w.run('subtotal()'),404,'the edited line is repriced from the same table');
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
  for(const title of ['Vents','Jacket cuff buttons','Pocket accent'])assert.ok(html.includes(`<div class="option-title">${title}</div>`),`the jacket Personalize step offers the ${title} group`);
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('vents','Single vent')"`),'the jacket starts from the same defaults');
  w.run("setOption('pocketAccent','Patch pocket')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.pocketAccent,'Patch pocket','the jacket line stores the pocket accent');
  assert.ok(!('vents' in item),'an untouched group stores nothing on the jacket line');
  assert.equal(w.run('subtotal()'),base+15,'the jacket subtotal includes the modifier');
  assert.ok(w.run('lineHtml(bag[0])').includes('$'+(base+15)),'the jacket bag line shows the raised price');
  assert.ok(w.run('lineDescription(bag[0])').includes('Patch pocket'),'the jacket bag line shows the pocket accent');
}

// World 3: Ticket pocket adds $5, choosing None returns the price to base.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('pocketAccent','Ticket pocket')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),404,'a Ticket pocket adds exactly $5');
  w.run(`editBagItem('${w.bag()[0].id}')`);
  w.run("setOption('pocketAccent','None')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),399,'choosing None returns the price to the base');
  assert.ok(!w.run('lineDescription(bag[0])').includes('pocket'),'a None pocket accent adds no bag line segment');
}

// World 4: the CUS-07 product change reset clears the new groups too.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('pocketAccent','Patch pocket');setOption('vents','Double vent');setOption('cuffButtons','Four')");
  w.run('beginDesign(1)');
  const config=w.config();
  assert.ok(!('pocketAccent' in config)&&!('vents' in config)&&!('cuffButtons' in config),'starting another product clears the new groups back to their defaults');
  w.run('stage=1');
  assert.ok(w.run('customize()').includes(`aria-pressed="true" onclick="setOption('pocketAccent','None')"`),'the second product starts from the default pocket accent');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.ok(!('pocketAccent' in item),'the second product line carries no pocket accent from the first');
  assert.equal(w.run('subtotal()'),449,'the second product is priced at its base');
}

// World 5: a legacy bag item and config, saved before the new fields
// existed, load and render exactly as before. Its price follows the
// current table only through the Peak lapel modifier that package 3.3
// deliberately prices (Peak at +$10); the 3.3 suite pins that rule down.
{
  const legacy={id:'legacy-1',product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB'}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Peak lapel · Slim fit · One button · Burgundy lining · Monogram AB','a legacy line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),10,'a legacy line charges only the Peak lapel modifier package 3.3 adds');
  assert.equal(w.run('itemPrice(bag[0])'),409,'a legacy line is priced at the product base plus the Peak modifier');
  assert.equal(w.run('subtotal()'),409,'the legacy subtotal follows the same rule');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('$409'),'the legacy item checks out at its base price plus the Peak modifier');
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
  console.log('Customizer jacket option checks passed: suits and jackets render Vents, Jacket cuff buttons and Pocket accent with Included or priced labels and preselected defaults, the closure offers five styles, pocket accent prices flow from the one table to the customizer, bag, checkout and server order, bag Edit restores the selections, a product switch resets them, and legacy items render unchanged, repricing only through the Peak lapel rule package 3.3 documents.');
})().catch(e=>{console.error(e);process.exit(1)});
