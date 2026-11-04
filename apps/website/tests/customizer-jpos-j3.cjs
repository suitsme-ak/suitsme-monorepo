const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// J wave package J3 (JPOS consistency plan section 2, mapping J0
// section C.1 and C.6): suits and jackets move to the JPOS aligned
// option model. These journeys pin the package end to end: an aligned
// suit built through the real customizer into the bag and checkout,
// priced only by the Milanese under collar; the shawl width behavior
// of the lapel type and size split; a legacy bag item carrying removed
// values rendering, restoring in bag Edit and pricing exactly as
// before; the tuxedo facing specification journey; the vest in a suit
// journey on the JPOS vest fields; and the server mirror, which must
// never charge an aligned item from the retired tables.
// Client worlds drive the real storefront scripts in a vm with
// stubbed DOM and storage, in the style of the other suites; the
// server section drives lib/commerce.ts through its checkout route.
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

// Journey 1: an aligned suit end to end. The Personalize step offers
// the JPOS groups with a visual key on every value and no Fit
// preference step before it; a full specification bags and checks out
// at base plus the Milanese price only.
{
  const w=makeWorld();
  const base=w.run('products[0].price');
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  const stage0=w.run('customize()');
  assert.ok(!stage0.includes('Your fit preference'),'the aligned design has no Fit preference step: its work lives in the measurements profile');
  assert.ok(!stage0.includes("setOption('fit'"),'no fit choice is offered on a tailored garment');
  w.run('nextConfig()');
  const html=w.run('customize()');
  for(const title of ['Tuxedo facings','Lapel style','Lapel width','Jacket closure','Buttons','Vents','Waist pocket style','Waist pocket angle','Ticket pocket','Breast pocket','Cuff buttons','Cuff button style','Cuff button holes','Cuff stitch position','Cuff stitch color','Under collar fabric','Collar eyelet','Stitching on the jacket edges','French facing','Lining','Vest','Inside label','Collar monogram'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`)||html.includes(`<div class="option-title">${title}</div>`),`the Personalize step offers the ${title} group`);
  for(const gone of ['Pocket accent','Elbow patches','Tailor changes','Square and tie','Make it a tuxedo','Notch 3-3.2in','Classic wider notch'])assert.ok(!html.includes(gone),`the Personalize step no longer offers ${gone}`);
  assert.ok(html.includes('data-visual="lapelType:Peak"'),'every lapel type carries its visual key for the J8 illustrations');
  assert.ok(html.includes('data-visual="underCollarFabric:Milanese Multi-Color"'),'every under collar choice carries its visual key');
  assert.ok(html.includes('data-visual="exteriorStitch:1/16 Pic"'),'every stitch choice carries its visual key');
  assert.ok(html.includes('<span class="subtle">Notch lapel</span>'),'group headers state the current selection in words');
  w.run("setOption('closure','6x2 DB');setOption('lapelType','Peak');setOption('lapelSize','Wide');setOption('buttonStyle','Fabric covered');setOption('vents','Side');setOption('waistPocketType','Double Besom');setOption('waistPocketAngle','Slanted');setOption('ticketPocket','Flap');setOption('breastPocketType','Patch');setOption('cuffButtons','5 Buttons');setOption('cuffButtonType','Slanting Kissing');setOption('cuffButtonHole','Functional Options');setOption('cuffStitchType','All');setOption('underCollarFabric','Milanese Multi-Color');setOption('collarEyelet','Special');setOption('exteriorStitch','5/16 Pic');setOption('frenchFacing','Yes');setOption('lining','Wine')");
  assert.ok(w.run('customize()').includes('$'+(base+40)),'the customizer price carries the Milanese price and nothing else');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the aligned suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.optionModel,3,'the bagged item carries the aligned model marker');
  assert.equal(item.closure,'6x2 DB');assert.equal(item.lapelType,'Peak');assert.equal(item.lapelSize,'Wide');assert.equal(item.underCollarFabric,'Milanese Multi-Color');
  assert.ok(!('lapel' in item)&&!('fit' in item)&&!('buttons' in item)&&!('tier' in item),'the bagged item carries none of the retired slots');
  assert.equal(w.run('itemPrice(bag[0])'),base+40,'the bag line price is base plus the Milanese price');
  assert.equal(w.run('subtotal()'),base+40,'the subtotal is base plus the Milanese price');
  const line=w.run('lineDescription(bag[0])');
  for(const part of ['Peak lapel, Wide','6x2 DB','Fabric covered buttons','Side vents','5 cuff buttons','Slanting Kissing cuff buttons','Working cuff buttonholes','Double Besom waist pockets','Slanted waist pockets','Flap ticket pocket','Patch breast pocket','Milanese Multi-Color under collar','Special collar eyelet','5/16 Pic stitch','French facing','Wine lining'])assert.ok(line.includes(part),`the bag line names ${part}`);
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Milanese Multi-Color under collar')&&checkout.includes('$'+(base+40)),'the checkout shows the specification and the Milanese total');
}

// Journey 2: the lapel type and size split. Switching to Shawl moves
// the width group to the straight and rounded widths with their
// attested inches, and switching back restores the standard width.
{
  const w=makeWorld();
  w.run('beginDesign(0)');w.run('stage=1');
  w.run("setOption('lapelType','Shawl')");
  assert.equal(w.config().lapelSize,'Standard-Straight','choosing Shawl moves the width to the shawl standard');
  const shawlHtml=w.run('customize()');
  assert.ok(shawlHtml.includes("setOption('lapelSize','Wide-Rounded')"),'the shawl widths include the rounded set');
  assert.ok(shawlHtml.includes('Standard straight, 2 1/8 in'),'the shawl standard width shows its attested inches');
  assert.ok(shawlHtml.includes('Wide rounded, 3 in'),'the wide rounded width shows its attested inches');
  w.run("setOption('lapelSize','Narrow-Rounded');setOption('lapelType','Peak')");
  assert.equal(w.config().lapelSize,'Standard','choosing Peak returns the width to the Peak standard');
  assert.ok(w.run('customize()').includes('Standard, 3 in'),'the Peak standard width shows its attested inches');
  w.run("setOption('lapelType','DB Peak')");
  assert.ok(w.run('customize()').includes('Standard, 3 1/4 in'),'the DB Peak standard width shows its attested inches');
}

// Journey 3: a legacy bag item loaded with removed values renders its
// exact previous line, prices exactly as before through the legacy
// tables, and restores in bag Edit into the legacy Personalize step,
// where saving changes nothing but what the shopper changed.
{
  const legacy={id:'legacy-full',product:0,fabric:'Navy',lapel:'Classic wider peak',closure:'One button',fit:'Slim',lining:'Italian jazz royale',liningType:'No lining (unstructured)',buttons:'Victorian lion brass',elbowPatches:'Black leather',tier:'Make it a tuxedo',vest:'Classic vest',vestFabricBack:'Fabric back',additionalPants:'Yes',squareAndTie:'Yes',monogram:'AB',monogram2:'CD',collarMonogram:'EF',workingCuffButtons:'Yes',pickStitch:'Yes',gauntletCuff:'Yes',naturalShoulders:'Yes',boatPocket:'Yes',milaneseButtonhole:'Yes',tailorChanges:'No, contact me',comments:'A legacy note.',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Classic wider peak',closure:'One button',fit:'Slim',lining:'Italian jazz royale',monogram:'AB'}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Classic wider peak lapel · Slim fit · One button · Make it a tuxedo · Victorian lion brass buttons · Italian jazz royale lining · No lining (unstructured) · Black leather elbow patches · Working cuff buttons · Pick stitch · Gauntlet cuff · Natural shoulders · Italian boat pocket · Milanese buttonhole · Classic vest · Fabric back · Additional pants · Square and tie · Tailor changes: No, contact me · Monogram AB / CD · Collar monogram EF','the legacy line keeps its exact previous description');
  // 10 lapel + 109 lining + 40 lining type + 75 buttons + 15 elbow
  // patches + 50 tier + 99 vest + 20 fabric back + 140 additional
  // pants + 39 square and tie + 150 toggles + 10 + 10 monograms.
  assert.equal(w.run('optionCharge(bag[0])'),767,'the legacy line charges exactly what it charged before the alignment');
  assert.equal(w.run('subtotal()'),399+767,'the legacy subtotal follows the same rule');
  w.run("editBagItem('legacy-full')");
  assert.ok(!('optionModel' in w.config()),'editing a legacy item does not move it to the aligned model');
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('Classic wider notch 4.75in'),'the legacy edit session renders the legacy lapel group');
  assert.ok(html.includes('Make it a tuxedo'),'the legacy edit session renders the tier group');
  assert.ok(!html.includes('data-visual="lapelType:'),'the legacy edit session renders no aligned groups');
  bagCurrentWorld(w);
  assert.deepEqual(w.bag()[0],{...legacy,profileId:'profile-1'},'saving the legacy edit changes nothing but the profileId every edit save records');
  assert.equal(w.run('subtotal()'),399+767,'the legacy total survives the edit cycle');
}

// Journey 4: the tuxedo facing specification. Turning the gate on
// reveals the per part facings; the choices store on the item, name
// themselves on the line, and price at nothing.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);w.run('stage=1');
  assert.ok(!w.run('customize()').includes('Tuxedo lapel facing'),'the facing groups stay hidden until the tuxedo gate is on');
  w.run("setOption('tuxedo','Yes')");
  const html=w.run('customize()');
  for(const title of ['Tuxedo lapel facing','Tuxedo collar facing','Tuxedo front edge','Tuxedo breast pocket facing','Tuxedo waist pocket','Tuxedo pocket flaps'])assert.ok(html.includes(`<span>${title}</span>`),`the specification offers ${title}`);
  assert.ok(!html.includes('Tuxedo trouser outseam stripe'),'a standalone jacket offers no trouser outseam stripe');
  w.run("setOption('tuxLapel','Satin full');setOption('tuxCollar','Grosgrain 3/8');setOption('tuxFrontEdge','Satin 1/8');setOption('tuxBreastPocket','None');setOption('tuxWaistPocket','Yes');setOption('tuxPocketFlaps','Yes')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.tuxedo,'Yes');assert.equal(item.tuxLapel,'Satin full');assert.equal(item.tuxCollar,'Grosgrain 3/8');assert.equal(item.tuxWaistPocket,'Yes');
  assert.ok(!('tier' in item),'the bagged item carries no tier slot');
  assert.equal(w.run('subtotal()'),base,'the tuxedo specification prices at nothing pending the upcharge data');
  assert.ok(w.run('lineDescription(bag[0])').includes('Tuxedo facings'),'the bag line names the tuxedo facings');
}

// Journey 5: the vest in a suit on the JPOS vest fields. The field
// groups appear with the gate, the specification stores and reads on
// the line, and turning the gate off removes it from the line.
{
  const w=makeWorld();
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');w.run('stage=1');
  w.run("setOption('vestIncluded','Yes');setOption('vestStyle','Notch Lapel');setOption('vestButtons','DB 6x3');setOption('vestPocketType','Double Besom');setOption('vestPocketNumber','4-Pocket');setOption('vestBack','Fabric')");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.vestIncluded,'Yes');assert.equal(item.vestStyle,'Notch Lapel');assert.equal(item.vestButtons,'DB 6x3');assert.equal(item.vestPocketType,'Double Besom');assert.equal(item.vestPocketNumber,'4-Pocket');assert.equal(item.vestBack,'Fabric');
  assert.ok(!('vest' in item)&&!('vestFabricBack' in item),'the bagged item carries none of the named style slots');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel, Standard · 2-Button · Center vent · 4 cuff buttons · Flap waist pockets · Tonal lining · Vest: Notch Lapel, DB 6x3, Double Besom pockets, 4-Pocket, Fabric back','the bag line reads the vest specification in field order');
  assert.equal(w.run('subtotal()'),base,'the vest fields price at nothing pending the upcharge data');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().vestButtons,'DB 6x3','bag Edit restores the vest buttons');
  w.run("setOption('vestIncluded','No')");
  bagCurrentWorld(w);
  assert.ok(!w.run('lineDescription(bag[0])').includes('Vest:'),'turning the vest off through bag Edit removes it from the line');
}

// Server: the order sanitizer prices an aligned item only from the
// aligned table (the Milanese under collar), even when the item also
// carries retired values; it persists the aligned fields and the
// marker; and the same retired values on an unmarked item price
// exactly as before.
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
  const retired={lapel:'Peak',buttons:'Black tiger',tier:'Make it a tuxedo',vest:'Classic vest',vestFabricBack:'Fabric back',squareAndTie:'Yes',monogram:'AB',collarMonogram:'EF',elbowPatches:'Black leather',liningType:'Half lining'};
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',closure:'6x2 DB',lining:'Wine',optionModel:3,lapelType:'Peak',lapelSize:'Wide',underCollarFabric:'Milanese Multi-Color',tuxedo:'Yes',tuxLapel:'Satin full',vestIncluded:'Yes',vestStyle:'Notch Lapel',vestButtons:'DB 6x3',...retired,profile:readyProfile}],shipping},'jpos-j3-000000000001'),env);
  assert.equal(r.status,200,'a checkout carrying the aligned specification succeeds');
  const placed=await r.json();
  assert.equal(placed.totalCents,suit.priceCents+4000,'the server charges an aligned item only the Milanese price, never the retired values it also carries');
  assert.equal(providerAmount,((suit.priceCents+4000)/100).toFixed(2),'the payment amount matches the aligned total');
  const stored=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(stored.optionModel,3,'the order item persists the aligned marker');
  assert.equal(stored.lapelType,'Peak','the order item persists the lapel type');
  assert.equal(stored.lapelSize,'Wide','the order item persists the lapel size');
  assert.equal(stored.underCollarFabric,'Milanese Multi-Color','the order item persists the under collar fabric');
  assert.equal(stored.tuxLapel,'Satin full','the order item persists the tuxedo facing');
  assert.equal(stored.vestStyle,'Notch Lapel','the order item persists the vest style');
  assert.equal(stored.priceCents,suit.priceCents+4000,'the order item price carries the Milanese price only');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',closure:'2-Button',lining:'Tonal',lapelType:'Notch',underCollarFabric:'Milanese Single Color',profile:readyProfile}],shipping},'jpos-j3-000000000002'),env);
  assert.equal((await r.json()).totalCents,suit.priceCents+2500,'an aligned key alone (no marker) puts the item on the aligned model server side');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',closure:'Two button',fit:'Tailored',lining:'Paisley red',...retired,profile:readyProfile}],shipping},'jpos-j3-000000000003'),env);
  // Legacy: 1000 lapel + 2000 lining + 2000 lining type + 7500 buttons
  // + 1500 elbow patches + 5000 tier + 9900 vest + 2000 fabric back +
  // 3900 square and tie + 1000 + 1000 monograms.
  assert.equal((await r.json()).totalCents,suit.priceCents+36800,'the same retired values on an unmarked item price exactly as before');
  console.log('JPOS J3 checks passed: an aligned suit builds through every JPOS group into the bag and checkout at base plus the Milanese price only, the lapel type and size split follows the shawl widths, a legacy item with removed values renders, restores and prices exactly as before, the tuxedo facing specification and the JPOS vest fields carry their journeys unpriced, and the server mirrors the split: aligned items are never charged from the retired tables.');
})().catch(e=>{console.error(e);process.exit(1)});
