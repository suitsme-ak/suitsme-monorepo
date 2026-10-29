const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-01 (Wave 3 package 3.3): the jacket finishes. The Lapel group grows
// to the eight captured variants with widths in the labels (the three
// peak variants priced at +$10), the Lining group grows to the captured
// colorways in price tiers (Default included, plain +$15, Paisley +$20,
// Bemberg +$30, Italian +$109), and Lining type (Half +$20, Unstructured
// +$40), Buttons (horn +$7, corozo +$4 or +$5, leather and metal +$9,
// statement brass +$75) and Elbow patches (+$15) join the Personalize
// step for suits and standalone jackets. All prices read OPTION_PRICES
// in app.js and its server mirror. The new slots (liningType, buttons,
// elbowPatches) stay absent from config until chosen, like packages 3.1
// and 3.2, so stored items from before this change render byte
// identically. Two deliberate legacy rules are pinned down here:
// a stored lapel of Peak now prices at +$10 (its line text is unchanged),
// and stored lining values Tonal, Burgundy and Midnight, which are not
// in the captured list, price at $0 and keep rendering as before; Tonal
// shows as the Default choice selected, without being rewritten.
// Package 3.4 adds a third deliberate rule, pinned in its own suite: a
// filled inside monogram now prices at +$10, so the legacy Peak world
// below, whose item also carries a monogram, totals both modifiers.
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

// World 1: a suit renders all five finish areas with their defaults, in
// captured order, and the new slots stay unset until chosen.
{
  const w=makeWorld();
  assert.equal(w.run('LAPEL_VALUES.length'),8,'the lapel group holds the eight captured variants');
  assert.equal(w.run('LINING_VALUES.length'),63,'the lining group holds Default plus the 62 captured colorways');
  assert.equal(w.run('BUTTON_VALUES.length'),24,'the buttons group holds the 24 captured choices');
  assert.equal(w.run('ELBOW_PATCH_VALUES.length'),21,'the elbow patch group holds None plus the 20 captured choices');
  assert.equal(w.run("optionPrice('lapel','Peak')"),10,'Peak prices at $10 in the table');
  assert.equal(w.run("optionPrice('lining','Paisley red')"),20,'a Paisley lining prices at $20');
  assert.equal(w.run("optionPrice('lining','Italian jazz royale')"),109,'an Italian lining prices at $109');
  assert.equal(w.run("optionPrice('buttons','Corozo ivory')"),5,'Corozo ivory prices at $5, above the other corozo at $4');
  w.run('beginDesign(0)');
  assert.ok(!('liningType' in w.config())&&!('buttons' in w.config())&&!('elbowPatches' in w.config()),'the finish slots stay unset until the shopper picks a choice');
  w.run('stage=1');
  const html=w.run('customize()');
  const titles=['Lapel','Jacket closure','Buttons','Vents','Jacket cuff buttons','Pocket accent','Lining','Lining type','Elbow patches'];
  let at=-1;
  for(const t of titles){const i=html.indexOf(`<div class="option-title">${t}</div>`);assert.ok(i>at,`the Personalize step offers ${t} after the previous group`);at=i}
  assert.ok(html.indexOf('<h3>Trousers</h3>')>at,'the Trousers section follows the jacket finishes');
  assert.ok(html.indexOf('<label class="field">Monogram')>html.indexOf('<h3>Trousers</h3>'),'the Monogram field follows the Trousers section');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lapel','Notch')">Notch 3-3.2in · Included`),'the Notch lapel is the selected default, width in its label');
  assert.ok(html.includes(`onclick="setOption('lapel','Peak')">Peak 3-3.2in · +$10`),'the Peak lapel shows its width and +$10 modifier');
  assert.ok(html.includes(`onclick="setOption('lapel','Wide peak')">Wide peak 3.75in · +$10`),'the Wide peak lapel shows its width and +$10 modifier');
  assert.ok(html.includes(`onclick="setOption('lapel','Classic wider notch')">Classic wider notch 4.75in · Included`),'the Classic wider notch shows its width, Included');
  assert.ok(html.includes(`onclick="setOption('lapel','Shawl')">Shawl · Included`),'the Shawl lapel is offered, Included');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lining','Default')">Default · Included`),'the Default lining is the selected default');
  assert.equal(w.config().lining,'Tonal','rendering the Default choice does not rewrite the stored Tonal value');
  assert.ok(html.includes(`onclick="setOption('lining','Red')">Red · +$15`),'a plain lining shows +$15');
  assert.ok(html.includes(`onclick="setOption('lining','Paisley red')">Paisley red · +$20`),'a Paisley lining shows +$20');
  assert.ok(html.includes(`onclick="setOption('lining','Black Bemberg')">Black Bemberg · +$30`),'a Bemberg lining shows +$30');
  assert.ok(html.includes(`onclick="setOption('lining','Italian jazz royale')">Italian jazz royale · +$109`),'an Italian lining shows +$109');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('liningType','Full lining')">Full lining · Included`),'Full lining is the selected lining type default');
  assert.ok(html.includes(`onclick="setOption('liningType','Half lining')">Half lining · +$20`),'Half lining shows +$20');
  assert.ok(html.includes(`onclick="setOption('liningType','No lining (unstructured)')">No lining (unstructured) · +$40`),'the unstructured lining type shows +$40');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('buttons','Horn brown')">Horn brown · Included`),'Horn brown is the selected button default');
  assert.ok(html.includes(`onclick="setOption('buttons','Horn solid black')">Horn solid black · +$7`),'a horn button shows +$7');
  assert.ok(html.includes(`onclick="setOption('buttons','Corozo beige')">Corozo beige · +$4`),'a corozo button shows +$4');
  assert.ok(html.includes(`onclick="setOption('buttons','Vintage brown leather')">Vintage brown leather · +$9`),'a leather button shows +$9');
  assert.ok(html.includes(`onclick="setOption('buttons','Black tiger')">Black tiger · +$75`),'a statement brass button shows +$75');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('elbowPatches','None')">None · Included`),'no elbow patch is the selected default');
  assert.ok(html.includes(`onclick="setOption('elbowPatches','Black leather')">Black leather · +$15`),'an elbow patch shows +$15');
}

// World 2: each priced finish adds exactly its modifier on its own.
{
  const cases=[["setOption('lapel','Wide peak')",10,'a Wide peak lapel adds $10'],["setOption('lining','Paisley red')",20,'a Paisley lining adds $20'],["setOption('lining','Italian jazz royale')",109,'an Italian lining adds $109'],["setOption('lining','Wine')",15,'a plain lining adds $15'],["setOption('liningType','Half lining')",20,'Half lining adds $20'],["setOption('liningType','No lining (unstructured)')",40,'the unstructured lining type adds $40'],["setOption('buttons','Black tiger')",75,'a statement brass button adds $75'],["setOption('buttons','Italian horn black')",7,'a horn button adds $7'],["setOption('elbowPatches','Dark blue suede')",15,'an elbow patch adds $15']];
  for(const [act,delta,message] of cases){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(act);
    assert.equal(w.run('itemPrice(config)'),399+delta,message);
    assert.equal(w.run('optionCharge(config)'),delta,message+' (option charge)');
  }
}

// World 3: combined finishes total correctly through the bag line and
// checkout, and bag Edit restores them.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('lapel','Wide peak');setOption('buttons','Black tiger');setOption('lining','Paisley red');setOption('liningType','Half lining');setOption('elbowPatches','Black leather')");
  assert.ok(w.run('customize()').includes('<div class="price">$539 '),'the customizer price carries all five modifiers (10+75+20+20+15)');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.lapel,'Wide peak');assert.equal(item.buttons,'Black tiger');assert.equal(item.lining,'Paisley red');assert.equal(item.liningType,'Half lining');assert.equal(item.elbowPatches,'Black leather');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Wide peak lapel · Tailored fit · Two button · Black tiger buttons · Paisley red lining · Half lining · Black leather elbow patches','the bag line shows the finishes in customizer order');
  assert.equal(w.run('subtotal()'),539,'the subtotal totals the combined finishes');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Paisley red lining')&&checkout.includes('$539'),'the checkout shows the finishes and the combined total');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().lapel,'Wide peak','bag Edit restores the lapel');
  assert.equal(w.config().buttons,'Black tiger','bag Edit restores the buttons');
  assert.equal(w.config().lining,'Paisley red','bag Edit restores the lining');
  assert.equal(w.config().liningType,'Half lining','bag Edit restores the lining type');
  assert.equal(w.config().elbowPatches,'Black leather','bag Edit restores the elbow patches');
  w.run("setOption('buttons','Horn brown')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.run('subtotal()'),464,'removing the brass button reprices the line from the same table');
}

// World 4: a standalone jacket renders the same finish areas and prices
// them the same way.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(idx>=0,'the catalog holds a standalone jacket');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  for(const t of ['Lapel','Buttons','Lining','Lining type','Elbow patches'])assert.ok(html.includes(`<div class="option-title">${t}</div>`),`the jacket Personalize step offers the ${t} group`);
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('buttons','Horn brown')"`),'the jacket starts from the same button default');
  assert.ok(!html.includes('<h3>Trousers</h3>'),'a standalone jacket has no Trousers section');
  w.run("setOption('lining','Italian golden maduro');setOption('elbowPatches','Red leather')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.lining,'Italian golden maduro','the jacket line stores the Italian lining');
  assert.equal(item.elbowPatches,'Red leather','the jacket line stores the elbow patch');
  assert.equal(w.run('subtotal()'),base+109+15,'the jacket subtotal includes both modifiers');
  assert.ok(w.run('lineDescription(bag[0])').includes('Italian golden maduro lining'),'the jacket bag line shows the lining');
  assert.ok(w.run('lineDescription(bag[0])').includes('Red leather elbow patches'),'the jacket bag line shows the elbow patch');
}

// World 5: the deliberate legacy Peak rule. A stored item with lapel
// Peak and lining Burgundy renders its line text exactly as before this
// package; its price follows the new table only through Peak at +$10,
// because Burgundy is absent from OPTION_PRICES and prices at $0.
{
  const legacy={id:'legacy-peak',product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB'}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Peak lapel · Slim fit · One button · Burgundy lining · Monogram AB','the legacy Peak line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),20,'the legacy Peak line charges the Peak modifier and the filled monogram charge package 3.4 adds');
  assert.equal(w.run('itemPrice(bag[0])'),419,'the legacy Peak line prices at base plus both modifiers');
  assert.equal(w.run('subtotal()'),419,'the legacy subtotal follows both repricing rules');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('$419'),'the legacy Peak item checks out at base plus both modifiers');
  w.run("editBagItem('legacy-peak')");
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lapel','Peak')">Peak 3-3.2in · +$10`),'the restored Peak lapel shows selected with its width and modifier');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lining','Burgundy')">Burgundy · Included`),'the stored Burgundy lining, no longer offered, still shows as the active choice at no charge');
  assert.equal(w.config().lining,'Burgundy','the stored Burgundy value is not rewritten by rendering');
}

// World 6: a legacy Notch and Tonal item is byte and price identical to
// before this package, and its stored Tonal survives a full bag cycle.
{
  const legacy={id:'legacy-notch',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Tonal lining','the legacy Notch and Tonal line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),0,'the legacy Notch and Tonal line carries no option charge');
  assert.equal(w.run('itemPrice(bag[0])'),399,'the legacy Notch and Tonal line prices at the product base');
  w.run("editBagItem('legacy-notch')");
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lining','Default')">Default · Included`),'the stored Tonal shows as the Default choice selected');
  assert.equal(w.config().lining,'Tonal','the stored Tonal value is not rewritten by rendering or editing');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the legacy edit adds no new line');
  assert.equal(w.bag()[0].lining,'Tonal','the saved line keeps its stored Tonal lining');
  assert.ok(!('liningType' in w.bag()[0])&&!('buttons' in w.bag()[0])&&!('elbowPatches' in w.bag()[0]),'the saved legacy line gains no finish fields');
  assert.equal(w.run('subtotal()'),399,'the legacy line still prices at base after the edit cycle');
}

// World 7: the CUS-07 product change reset clears the finishes too.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('lapel','Wide peak');setOption('lining','Paisley red');setOption('liningType','Half lining');setOption('buttons','Black tiger');setOption('elbowPatches','Black leather')");
  w.run('beginDesign(1)');
  const config=w.config();
  assert.ok(!('liningType' in config)&&!('buttons' in config)&&!('elbowPatches' in config),'starting another product clears the finish slots');
  assert.equal(config.lapel,'Notch','the second product starts from the Notch lapel');
  assert.equal(config.lining,'Tonal','the second product starts from the default lining');
  w.run('stage=1');
  assert.ok(w.run('customize()').includes(`aria-pressed="true" onclick="setOption('lining','Default')"`),'the second product shows the Default lining selected');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.ok(!('buttons' in item)&&!('liningType' in item),'the second product line carries no finishes from the first');
  assert.equal(w.run('subtotal()'),449,'the second product prices at its base');
}

// Server: the order sanitizer persists the finish fields and prices
// them from the mirrored tables, for suits and jackets only.
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
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Wide peak',closure:'Two button',buttons:'Black tiger',fit:'Tailored',lining:'Paisley red',liningType:'Half lining',elbowPatches:'Black leather',monogram:'',profile:readyProfile}],shipping},'jacket-finishes-0000001'),env);
  assert.equal(r.status,200,'a checkout carrying the finishes succeeds');
  const placed=await r.json();
  assert.equal(placed.totalCents,suit.priceCents+1000+2000+2000+7500+1500,'the server total adds all five finish modifiers');
  assert.equal(providerAmount,((suit.priceCents+14000)/100).toFixed(2),'the payment amount matches the raised total');
  const stored=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(stored.lapel,'Wide peak','the order item persists the lapel');
  assert.equal(stored.lining,'Paisley red','the order item persists the lining');
  assert.equal(stored.liningType,'Half lining','the order item persists the lining type');
  assert.equal(stored.buttons,'Black tiger','the order item persists the buttons');
  assert.equal(stored.elbowPatches,'Black leather','the order item persists the elbow patches');
  assert.equal(stored.priceCents,suit.priceCents+14000,'the order item price carries the combined modifiers');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Peak',closure:'One button',fit:'Tailored',lining:'Burgundy',monogram:'',profile:readyProfile}],shipping},'jacket-finishes-0000002'),env);
  assert.equal((await r.json()).totalCents,suit.priceCents+1000,'server side, a legacy Peak prices at +$10 and a legacy Burgundy lining at $0');
  const jacketIdx=catalog.findIndex(p=>p.kind==='jacket'),jacket=catalog[jacketIdx];
  r=await commerce(req({items:[{product:jacketIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',elbowPatches:'Red leather',monogram:'',profile:readyProfile}],shipping},'jacket-finishes-0000003'),env);
  assert.equal((await r.json()).totalCents,jacket.priceCents+1500,'a jacket elbow patch prices server side');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  r=await commerce(req({items:[{product:pantsIdx,fabric:'Wool',lapel:'Wide peak',closure:'Flat front',buttons:'Black tiger',fit:'Tailored',lining:'Paisley red',liningType:'Half lining',elbowPatches:'Black leather',monogram:'',profile:readyProfile}],shipping},'jacket-finishes-0000004'),env);
  assert.equal((await r.json()).totalCents,pants.priceCents,'finish values on trousers are never priced');
  console.log('Customizer jacket finish checks passed: suits and jackets render the expanded Lapel and Lining groups plus Lining type, Buttons and Elbow patches with defaults and tier prices, every modifier flows from the one table to the customizer, bag, checkout and server order, bag Edit restores the finishes, a product switch resets them, legacy Peak reprices only through its documented rule, and legacy Notch and Tonal items are byte and price identical.');
})().catch(e=>{console.error(e);process.exit(1)});
