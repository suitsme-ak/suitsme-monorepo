const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-01 (Wave 3 package 3.2): the trousers option groups. Suits gain a
// Trousers section in the Personalize step with five groups (Pants
// lining, Pocket style, Pleats, Back pockets, Belt loops), and standalone
// trousers keep their Trouser front group and gain the other four. The
// priced choices (front lining $5, front and back lining $10, forward
// pleats $5) read OPTION_PRICES in app.js, the same table the jacket
// groups use, and the server sanitizer mirrors the figures. The new
// config slots stay absent until a shopper picks a choice, so stored
// state from before this change loads with the defaults and renders
// exactly as before. The suit pleats choice lives in the new pleats
// slot; the CUS-06 trouserFront slot remains as its legacy fallback for
// women's suits: beginDesign still preselects it, the Pleats group and
// the bag line read it when pleats is unset, and bag Edit restores it,
// so a women's suit bagged under CUS-06 displays and edits without loss.
function makeEl(){return{innerHTML:'',textContent:'',value:'',checked:false,open:false,classList:{add(){},remove(){},toggle(){return false}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),showModal(){this.open=true},close(){this.open=false},scrollIntoView(){}}}
const menProfile={id:'profile-men',name:'Men fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-10-27T00:00:00.000Z'};
const womenProfile={id:'profile-women',name:'Women fit',method:'body',unit:'in',wearer:'Women',fit:'Tailored',values:{chest:36,waist:29,shoulder:15,sleeve:24,jacket:28,seat:38,trouserWaist:29,thigh:22,inseam:31,outseam:41},ready:{jacket:'38',length:'Regular',trouser:'30'},created:'2026-10-27T00:00:00.000Z'};
function makeWorld(seed={}){
  const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  store.set('suits-profiles',JSON.stringify([menProfile,womenProfile]));
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
function bagCurrentWorld(w,profileId){w.run('stage=2;render(false)');w.elFor('#profileSelect').value=profileId;w.run('nextConfig()')}
const TROUSER_SLOTS=['pantsLining','pocketStyle','pleats','backPockets','beltLoops'];

// World 1: a men's suit renders the whole Trousers section with the
// captured defaults, and priced choices reach the bag and checkout.
{
  const w=makeWorld();
  assert.equal(w.run("optionPrice('pantsLining','Front and back lining')"),10,'the price table prices front and back lining at $10');
  assert.equal(w.run("optionPrice('pantsLining','Front lining')"),5,'the price table prices front lining at $5');
  assert.equal(w.run("optionPrice('pleats','Forward single pleat')"),5,'the price table prices a forward single pleat at $5');
  assert.equal(w.run("optionPrice('pleats','Single pleat')"),0,'a regular single pleat costs nothing');
  w.run('beginDesign(0)');
  for(const slot of TROUSER_SLOTS)assert.ok(!(slot in w.config()),`the ${slot} slot stays unset until the shopper picks a choice`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<h3>Trousers</h3>'),'the Personalize step has a Trousers section');
  for(const title of ['Pants lining','Pocket style','Pleats','Back pockets','Belt loops'])assert.ok(html.includes(`<div class="option-title">${title}</div>`),`the Trousers section offers the ${title} group`);
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pantsLining','No lining')">No lining · Included</button>`),'No lining is the selected default, labelled Included');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pocketStyle','Cross')">Cross · Included</button>`),'Cross pockets are the selected default');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pleats','Flat front')">Flat front · Included</button>`),'Flat front is the selected pleats default');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('backPockets','2 welted pockets')">2 welted pockets · Included</button>`),'Two welted back pockets are the selected default');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('beltLoops','Yes')">Yes · Included</button>`),'Belt loops Yes is the selected default');
  assert.ok(html.includes('Front lining · +$5'),'the Front lining choice shows its +$5 modifier');
  assert.ok(html.includes('Front and back lining · +$10'),'the Front and back lining choice shows its +$10 modifier');
  assert.ok(html.includes('Forward single pleat · +$5'),'the Forward single pleat choice shows its +$5 modifier');
  assert.ok(html.includes('Forward 2 pleats · +$5'),'the Forward 2 pleats choice shows its +$5 modifier');
  assert.ok(html.includes('Single pleat · Included'),'a regular single pleat is labelled Included');
  assert.ok(html.includes('Seam · Included'),'the Seam pocket style is labelled Included');
  w.run("setOption('pantsLining','Front and back lining');setOption('pocketStyle','Seam');setOption('pleats','Forward 2 pleats');setOption('backPockets','No back pockets');setOption('beltLoops','No')");
  assert.ok(w.run('customize()').includes('<div class="price">$414 '),'the customizer price rises by the lining and pleats modifiers together');
  bagCurrentWorld(w,'profile-men');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.pantsLining,'Front and back lining');assert.equal(item.pocketStyle,'Seam');assert.equal(item.pleats,'Forward 2 pleats');assert.equal(item.backPockets,'No back pockets');assert.equal(item.beltLoops,'No');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Front and back lining · Seam · Forward 2 pleats · No back pockets · No belt loops · Tonal lining','the bag line shows the trousers selections in group order');
  assert.equal(w.run('subtotal()'),414,'the subtotal adds the $10 lining and the $5 pleats');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Front and back lining')&&checkout.includes('$414'),'the checkout shows the selections and the raised total');
  // Bag Edit restores the five selections and reprices on change.
  w.run(`editBagItem('${item.id}')`);
  for(const slot of TROUSER_SLOTS)assert.equal(w.config()[slot],item[slot],`bag Edit restores the ${slot}`);
  w.run("setOption('pantsLining','Front lining')");
  bagCurrentWorld(w,'profile-men');
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.bag()[0].pantsLining,'Front lining','the edited line carries the new lining');
  assert.equal(w.run('subtotal()'),409,'the edited line is repriced: front lining $5 plus forward pleats $5');
}

// World 2: front lining alone adds exactly $5, and No lining adds nothing.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('pantsLining','Front lining')");
  bagCurrentWorld(w,'profile-men');
  assert.equal(w.run('optionCharge(bag[0])'),5,'the front lining charge is exactly $5');
  assert.equal(w.run('subtotal()'),404,'the subtotal rises by exactly $5');
  w.run(`editBagItem('${w.bag()[0].id}')`);
  w.run("setOption('pantsLining','No lining')");
  bagCurrentWorld(w,'profile-men');
  assert.equal(w.run('subtotal()'),399,'choosing No lining returns the price to the base');
  assert.ok(w.run('lineDescription(bag[0])').includes('No lining'),'an explicitly chosen No lining still shows on the bag line');
}

// World 3: a women's suit pleats choice stores in the pleats slot, shows
// on the bag line once (the legacy trouserFront preselect does not
// duplicate it), and restores on bag Edit.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx>=0,'the catalog holds a Women suit');
  w.run(`beginDesign(${idx})`);
  assert.equal(w.config().trouserFront,'Flat front','beginDesign still preselects the legacy trouser front for a Women suit');
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pleats','Flat front')">Flat front · Included</button>`),'the Pleats group shows the preselected front as its current choice');
  w.run("setOption('pleats','Single pleat')");
  bagCurrentWorld(w,'profile-women');
  const item=w.bag()[0];
  assert.equal(item.pleats,'Single pleat','the bagged item stores the pleats choice');
  assert.equal(item.trouserFront,'Flat front','the legacy slot keeps its preselect and is not overwritten');
  assert.equal(w.run('lineDescription(bag[0])'),'Taupe · Notch lapel · Tailored fit · Two button · Single pleat · Tonal lining','the bag line shows the chosen pleat once, in the trouser front position');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().pleats,'Single pleat','bag Edit restores the pleats choice');
  assert.equal(w.config().trouserFront,'Flat front','bag Edit restores the legacy slot alongside it');
}

// World 4: a legacy women's suit item, bagged under CUS-06 with only
// trouserFront, displays byte-identically, edits without losing its
// trouser front, and only gains a pleats value when the shopper picks one.
{
  const legacy={id:'legacy-women',product:13,fabric:'Taupe',lapel:'Notch',closure:'One button',fit:'Tailored',lining:'Tonal',monogram:'',trouserFront:'Single pleat',profile:JSON.parse(JSON.stringify(womenProfile))};
  const w=makeWorld({bag:[legacy],config:{product:13,fabric:'Taupe',lapel:'Notch',closure:'One button',fit:'Tailored',lining:'Tonal',monogram:'',trouserFront:'Single pleat'}});
  assert.equal(w.run("products[13].category"),'Women','the legacy fixture is the Women suit');
  assert.equal(w.run('lineDescription(bag[0])'),'Taupe · Notch lapel · Tailored fit · One button · Single pleat · Tonal lining','the legacy line keeps its exact CUS-06 description');
  assert.equal(w.run('optionCharge(bag[0])'),0,'the legacy line carries no trousers charge');
  assert.equal(w.run('itemPrice(bag[0])'),449,'the legacy line is priced at the product base');
  w.run("editBagItem('legacy-women')");
  assert.ok(!('pleats' in w.config()),'editing the legacy line invents no pleats value');
  assert.equal(w.config().trouserFront,'Single pleat','editing restores the legacy trouser front');
  w.run('stage=1');
  assert.ok(w.run('customize()').includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pleats','Single pleat')">Single pleat · Included</button>`),'the Pleats group shows the legacy front as its selected choice');
  w.run("setOption('lining','Midnight')");
  bagCurrentWorld(w,'profile-women');
  assert.deepEqual(w.bag()[0],{...legacy,lining:'Midnight',profileId:'profile-women'},'saving the legacy edit changes only the lining (plus the profileId every edit save records), with no pleats field injected');
  w.run("editBagItem('legacy-women')");
  w.run("setOption('pleats','2 pleats')");
  bagCurrentWorld(w,'profile-women');
  assert.equal(w.bag()[0].pleats,'2 pleats','a pleats choice made during the edit is stored');
  assert.ok(w.run('lineDescription(bag[0])').includes('2 pleats')&&!w.run('lineDescription(bag[0])').includes('Single pleat'),'the bag line now follows the pleats choice, not the stale legacy front');
}

// World 5: standalone trousers keep Trouser front in the closure slot and
// gain the other four groups; a priced lining flows to the total.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='pants'&&p.category==='Trousers')");
  assert.ok(idx>=0,'the catalog holds standalone trousers');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  assert.equal(w.config().closure,'Flat front','standalone trousers still preselect Flat front in the closure slot');
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<div class="option-title">Trouser front</div>'),'standalone trousers still show the Trouser front group');
  for(const title of ['Pants lining','Pocket style','Back pockets','Belt loops'])assert.ok(html.includes(`<div class="option-title">${title}</div>`),`standalone trousers gain the ${title} group`);
  assert.ok(!html.includes('<div class="option-title">Pleats</div>'),'standalone trousers get no Pleats group; Trouser front covers that choice');
  assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('pantsLining','No lining')">No lining · Included</button>`),'the trousers start from the same lining default');
  w.run("setOption('pantsLining','Front lining');setOption('pocketStyle','Seam');setOption('backPockets','1 flap pocket on right');setOption('beltLoops','No')");
  bagCurrentWorld(w,'profile-men');
  const item=w.bag()[0];
  assert.equal(item.pantsLining,'Front lining');assert.equal(item.pocketStyle,'Seam');assert.equal(item.backPockets,'1 flap pocket on right');assert.equal(item.beltLoops,'No');
  assert.ok(!('pleats' in item),'the trousers line stores no pleats value');
  const line=w.run('lineDescription(bag[0])');
  for(const segment of ['Front lining','Seam','1 flap pocket on right','No belt loops'])assert.ok(line.includes(segment),`the trousers bag line shows ${segment}`);
  assert.equal(w.run('subtotal()'),base+5,'the trousers subtotal adds the $5 front lining');
  assert.ok(w.run('lineHtml(bag[0])').includes('$'+(base+5)),'the trousers bag line price includes the modifier');
}

// World 6: the CUS-07 product change reset and the kind cleanups clear
// the trousers fields, so nothing leaks into a garment that lacks them.
{
  const w=makeWorld();
  const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  w.run('beginDesign(0)');
  w.run("setOption('pantsLining','Front and back lining');setOption('pleats','Forward single pleat');setOption('beltLoops','No');setOption('pocketStyle','Seam');setOption('backPockets','No back pockets')");
  w.run(`beginDesign(${pantsIdx})`);
  for(const slot of TROUSER_SLOTS)assert.ok(!(slot in w.config()),`switching to trousers clears the ${slot} from the suit design`);
  w.run("setOption('pantsLining','Front lining')");
  w.run(`beginDesign(${jacketIdx})`);
  for(const slot of TROUSER_SLOTS)assert.ok(!(slot in w.config()),`switching to a jacket clears the ${slot}; jackets offer no trousers groups`);
  w.run('beginDesign(1)');
  for(const slot of TROUSER_SLOTS)assert.ok(!(slot in w.config()),`switching to another suit clears the ${slot} back to defaults`);
  bagCurrentWorld(w,'profile-men');
  const item=w.bag()[0];
  for(const slot of TROUSER_SLOTS)assert.ok(!(slot in item),`the second suit line carries no ${slot} from the first design`);
  assert.equal(w.run('subtotal()'),449,'the second suit is priced at its base');
}

// Server: the order sanitizer persists the five selections and prices
// the lining and pleats from the mirrored tables, each for the kinds
// that offer them only.
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
  const readyProfile={name:'Test fit',method:'ready',ready:{jacket:'40',length:'Regular',trouser:'34'}};
  const suitIdx=catalog.findIndex(p=>p.kind==='suit'&&p.fabricCode),suit=catalog[suitIdx];
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',pantsLining:'Front and back lining',pocketStyle:'Seam',pleats:'Forward single pleat',backPockets:'No back pockets',beltLoops:'No',profile:readyProfile}],shipping},'trouser-options-00000001'),env);
  assert.equal(r.status,200,'a checkout carrying the trousers selections succeeds');
  assert.equal((await r.json()).totalCents,suit.priceCents+1500,'the server total adds the $10 lining and the $5 forward pleats');
  assert.equal(providerAmount,((suit.priceCents+1500)/100).toFixed(2),'the payment amount matches the raised total');
  const storedSuit=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(storedSuit.pantsLining,'Front and back lining','the order item persists the pants lining');
  assert.equal(storedSuit.pocketStyle,'Seam','the order item persists the pocket style');
  assert.equal(storedSuit.pleats,'Forward single pleat','the order item persists the pleats');
  assert.equal(storedSuit.backPockets,'No back pockets','the order item persists the back pockets');
  assert.equal(storedSuit.beltLoops,'No','the order item persists the belt loops');
  assert.equal(storedSuit.priceCents,suit.priceCents+1500,'the order item price carries both modifiers');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  r=await commerce(req({items:[{product:pantsIdx,fabric:'Wool',lapel:'',closure:'Flat front',fit:'Tailored',lining:'',monogram:'',pantsLining:'Front lining',pleats:'Forward single pleat',profile:readyProfile}],shipping},'trouser-options-00000002'),env);
  assert.equal((await r.json()).totalCents,pants.priceCents+500,'trousers are charged the $5 front lining, and a pleats value on trousers is never priced');
  const storedPants=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(storedPants.pantsLining,'Front lining','the trousers order item persists the pants lining');
  const jacketIdx=catalog.findIndex(p=>p.kind==='jacket'),jacket=catalog[jacketIdx];
  r=await commerce(req({items:[{product:jacketIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',pantsLining:'Front and back lining',pleats:'Forward 2 pleats',profile:readyProfile}],shipping},'trouser-options-00000003'),env);
  assert.equal((await r.json()).totalCents,jacket.priceCents,'trousers values on a jacket are never priced');
  console.log('Customizer trouser option checks passed: suits render the five trousers groups with defaults, priced lining and pleats choices flow from the one table to the customizer, bag, checkout and server order, women suits keep the CUS-06 legacy fallback, standalone trousers gain four groups without a Pleats group, product switches reset the fields, and legacy items are untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
