const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-01 finishes, aligned model (J wave package J3): the Wave 3
// finish model (eight lapel variants with folded in widths, tiered
// lining prices, named button materials, lining types, elbow patches)
// is replaced by the JPOS groups: lapel type and lapel width as
// separate groups with the attested inch values, button style
// (Matching, Tuxedo Button, Fabric covered), and the lining group
// kept as unpriced placeholder values pending the JPOS lining
// catalog (plan input 3). The Wave 3 prices survive only in
// LEGACY_OPTION_PRICES and its server mirror, for pre-alignment
// items: Worlds 5 and 6 and the server section pin that legacy
// behavior byte and price exact. (The historical note this suite
// carried: the new slots stayed absent from config until chosen, so
// stored items from before the Wave 3 change rendered byte
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

// World 1: a suit renders the aligned finish areas with their
// standards, in mapping order: lapel type and width as separate
// groups, button style in place of the named materials, and the
// placeholder lining group unpriced. The removed finish groups
// (Lining type, Elbow patches, named button materials) are absent,
// and the retired prices survive only in the legacy table.
{
  const w=makeWorld();
  assert.equal(w.run('LAPEL_TYPE_VALUES.length'),4,'the lapel type group holds the four JPOS types');
  assert.equal(w.run("lapelSizeValues('Shawl').length"),6,'the shawl width group holds the straight and rounded widths');
  assert.equal(w.run('LINING_VALUES.length'),63,'the lining group still holds Default plus the 62 placeholder colorways');
  assert.equal(w.run("optionPrice('lapel','Peak')"),0,'the current table prices no lapel: the Peak modifier is retired for new designs');
  assert.equal(w.run("legacyOptionPrice('lapel','Peak')"),10,'the legacy table keeps Peak at $10 for pre-alignment items');
  assert.equal(w.run("legacyOptionPrice('lining','Italian jazz royale')"),109,'the legacy table keeps the Italian lining tier for pre-alignment items');
  assert.equal(w.run("optionPrice('underCollarFabric','Milanese Multi-Color')"),40,'the Milanese multi color under collar prices at $40 in the current table');
  w.run('beginDesign(0)');
  assert.ok(!('liningType' in w.config())&&!('buttons' in w.config())&&!('elbowPatches' in w.config()),'a new design never sets the removed finish slots');
  assert.equal(w.config().lapelType,'Notch','a new design starts from the Notch lapel type standard');
  w.run('stage=1');
  const html=w.run('customize()');
  const titles=['Tuxedo facings','Lapel style','Lapel width','Jacket closure','Buttons','Vents','Waist pocket style','Under collar fabric','Lining'];
  let at=-1;
  for(const t of titles){const i=html.indexOf(`<div class="option-title"><span>${t}</span>`);assert.ok(i>at,`the Personalize step offers ${t} after the previous group`);at=i}
  assert.ok(html.indexOf('<h3>Trousers</h3>')>at,'the Trousers section follows the jacket finishes');
  assert.ok(html.indexOf('<span>Inside label</span>')>html.indexOf('<h3>Trousers</h3>'),'the label program follows the Trousers section');
  for(const gone of ['Lining type','Elbow patches','Black tiger','Horn brown','Classic wider notch'])assert.ok(!html.includes(gone),`the Personalize step no longer offers ${gone}`);
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lapelType','Notch')">Notch lapel · Included`),'the Notch lapel type is the selected standard');
  assert.ok(html.includes(`onclick="setOption('lapelType','Peak')">Peak lapel · Included`),'the Peak lapel type is offered unpriced');
  assert.ok(html.includes(`onclick="setOption('lapelType','DB Peak')">Double breasted peak lapel · Included`),'the DB Peak lapel type is offered');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lapelSize','Standard')">Standard, 2 7/8 in · Included`),'the Standard notch width is selected, with its JPOS inches');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('lining','Default')">Default · Included`),'the Default lining is the selected default');
  assert.equal(w.config().lining,'Tonal','rendering the Default choice does not rewrite the stored Tonal value');
  assert.ok(html.includes(`onclick="setOption('lining','Paisley red')">Paisley red · Included`),'a Paisley lining is unpriced in the aligned model');
  assert.ok(html.includes(`onclick="setOption('lining','Italian jazz royale')">Italian jazz royale · Included`),'an Italian lining is unpriced in the aligned model');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('buttonStyle','Matching')">Matching buttons · Included`),'matching buttons are the selected standard');
  assert.ok(html.includes(`onclick="setOption('buttonStyle','Fabric covered')">Fabric covered buttons · Included`),'fabric covered buttons are offered');
}

// World 2: on the aligned model only the Milanese under collar
// fabrics move the price; every other finish choice adds nothing.
{
  const cases=[["setOption('lapelType','Peak')",0,'a Peak lapel type adds nothing'],["setOption('lapelSize','Wide')",0,'a Wide lapel adds nothing'],["setOption('lining','Paisley red')",0,'a Paisley lining adds nothing'],["setOption('lining','Italian jazz royale')",0,'an Italian lining adds nothing'],["setOption('buttonStyle','Fabric covered')",0,'fabric covered buttons add nothing'],["setOption('exteriorStitch','5/16 Pic')",0,'an exterior stitch adds nothing'],["setOption('underCollarFabric','Milanese Single Color')",25,'a Milanese single color under collar adds $25'],["setOption('underCollarFabric','Milanese Multi-Color')",40,'a Milanese multi color under collar adds $40']];
  for(const [act,delta,message] of cases){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(act);
    assert.equal(w.run('itemPrice(config)'),399+delta,message);
    assert.equal(w.run('optionCharge(config)'),delta,message+' (option charge)');
  }
}

// World 3: combined finishes total correctly through the bag line and
// checkout (only the Milanese under collar prices), and bag Edit
// restores them.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('lapelType','Peak');setOption('lapelSize','Wide');setOption('buttonStyle','Tuxedo Button');setOption('lining','Paisley red');setOption('underCollarFabric','Milanese Multi-Color')");
  assert.ok(w.run('customize()').includes('<div class="price">$439 '),'the customizer price carries the Milanese price only (40)');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.lapelType,'Peak');assert.equal(item.lapelSize,'Wide');assert.equal(item.buttonStyle,'Tuxedo Button');assert.equal(item.lining,'Paisley red');assert.equal(item.underCollarFabric,'Milanese Multi-Color');
  assert.ok(!('buttons' in item)&&!('liningType' in item)&&!('elbowPatches' in item),'the bagged item carries none of the removed finish slots');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Peak lapel, Wide · 2-Button · Tuxedo buttons · Center vent · 4 cuff buttons · Flap waist pockets · Milanese Multi-Color under collar · Paisley red lining','the bag line shows the finishes in customizer order');
  assert.equal(w.run('subtotal()'),439,'the subtotal totals the Milanese price only');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Paisley red lining')&&checkout.includes('$439'),'the checkout shows the finishes and the total');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().lapelType,'Peak','bag Edit restores the lapel type');
  assert.equal(w.config().lapelSize,'Wide','bag Edit restores the lapel width');
  assert.equal(w.config().buttonStyle,'Tuxedo Button','bag Edit restores the button style');
  assert.equal(w.config().lining,'Paisley red','bag Edit restores the lining');
  assert.equal(w.config().underCollarFabric,'Milanese Multi-Color','bag Edit restores the under collar fabric');
  w.run("setOption('underCollarFabric','Match')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.run('subtotal()'),399,'returning the under collar to Match reprices the line from the same table');
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
  for(const t of ['Lapel style','Lapel width','Buttons','Lining'])assert.ok(html.includes(`<div class="option-title"><span>${t}</span>`),`the jacket Personalize step offers the ${t} group`);
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('buttonStyle','Matching')"`),'the jacket starts from the same button style standard');
  assert.ok(!html.includes('<h3>Trousers</h3>'),'a standalone jacket has no Trousers section');
  w.run("setOption('lining','Italian golden maduro');setOption('underCollarFabric','Milanese Single Color')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.lining,'Italian golden maduro','the jacket line stores the Italian lining');
  assert.equal(item.underCollarFabric,'Milanese Single Color','the jacket line stores the under collar fabric');
  assert.equal(w.run('subtotal()'),base+25,'the jacket subtotal includes the Milanese price only');
  assert.ok(w.run('lineDescription(bag[0])').includes('Italian golden maduro lining'),'the jacket bag line shows the lining');
  assert.ok(w.run('lineDescription(bag[0])').includes('Milanese Single Color under collar'),'the jacket bag line shows the under collar fabric');
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

// World 7: the CUS-07 product change reset restores the finish
// standards too.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('lapelType','Peak');setOption('lapelSize','Wide');setOption('lining','Paisley red');setOption('buttonStyle','Fabric covered');setOption('underCollarFabric','Milanese Multi-Color')");
  w.run('beginDesign(1)');
  const config=w.config();
  assert.ok(!('liningType' in config)&&!('buttons' in config)&&!('elbowPatches' in config),'starting another product sets no removed finish slots');
  assert.equal(config.lapelType,'Notch','the second product starts from the Notch lapel type');
  assert.equal(config.lapelSize,'Standard','the second product starts from the Standard lapel width');
  assert.equal(config.buttonStyle,'Matching','the second product starts from matching buttons');
  assert.equal(config.underCollarFabric,'Match','the second product starts from the Match under collar');
  assert.equal(config.lining,'Tonal','the second product starts from the default lining');
  w.run('stage=1');
  assert.ok(w.run('customize()').includes(`aria-pressed="true" onclick="setOption('lining','Default')"`),'the second product shows the Default lining selected');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.lapelType,'Notch','the second product line carries the standard lapel type');
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
  console.log('Customizer jacket finish checks passed: suits and jackets render the aligned lapel type and width groups with JPOS inches, the button style group and the unpriced placeholder lining, the removed finish groups are absent, only the Milanese under collar prices on the jacket side, bag Edit restores the finishes, a product switch resets them to the standards, and legacy items price and render exactly as before through the legacy tables on client and server.');
})().catch(e=>{console.error(e);process.exit(1)});
