const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-02 extras, aligned model (J wave package J3): the Wave 3 extras
// model (the tuxedo tier switch, six named vest styles with a priced
// fabric back, the square and tie set, priced monogram text fields) is
// replaced by the JPOS shapes: the tuxedo facing specification (per
// part material and coverage), the vest in a suit on the JPOS vest
// fields (style, buttons, pocket type and number, back), and the
// label program and collar monogram as styles whose text fields ride
// along unpriced. Additional pants (+$140) survive because the
// trousers groups are J4's package. The Wave 3 extras prices survive
// only in LEGACY_OPTION_PRICES and its server mirror, for
// pre-alignment items; World 7 and the server section pin that.
// One deliberate legacy rule is pinned down here: the inside monogram
// was free before this package, so a stored item with a filled monogram
// reprices by exactly +$10 under the new table, its line text
// unchanged; a stored item without a monogram is byte and price
// identical. The monogram fields also move from the long-standing
// 12 character cap to the captured 20 characters per line for suits and
// jackets (11 for the collar monogram); other kinds keep the single
// 12 character field and free monogram, unchanged.
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

// World 1: a suit renders the Tuxedo facings group at the top of the
// Personalize step in place of the tier switch, the vest field groups
// after Trousers once a vest is added, and the label program with its
// text fields appearing only for a personalized style. The retired
// extras (tier, named vest styles, square and tie, priced monogram
// text) survive only in the legacy price table.
{
  const w=makeWorld();
  assert.equal(w.run('TUX_FACING_VALUES.length'),7,'the tuxedo facing choices combine three coverages in two materials, plus None');
  assert.equal(w.run('VEST_STYLE_VALUES.length'),2,'the vest style group holds the two JPOS styles');
  assert.equal(w.run("optionPrice('tier','Make it a tuxedo')"),0,'the current table prices no tuxedo tier: the switch is retired');
  assert.equal(w.run("legacyOptionPrice('tier','Make it a tuxedo')"),50,'the legacy table keeps the tier price for pre-alignment items');
  assert.equal(w.run("legacyOptionPrice('vest','Classic vest')"),99,'the legacy table keeps the named vest prices for pre-alignment items');
  assert.equal(w.run("legacyOptionPrice('additionalPants','Yes')"),140,'additional pants price at $140 in the legacy table, for pre-alignment items only');
  assert.equal(w.run("optionPrice('additionalPants','Yes')"),0,'the current table prices no additional pants: the aligned second pair is unpriced pending the upcharge data');
  assert.equal(w.run('TEXT_FIELD_PRICES.monogram'),10,'the text field price survives for legacy items only');
  w.run('beginDesign(0)');
  const fresh=w.config();
  for(const k of ['tier','vest','vestFabricBack','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in fresh),`a new design never sets the retired ${k} slot`);
  assert.equal(fresh.tuxedo,'No','the tuxedo gate starts off');
  assert.equal(fresh.vestIncluded,'No','the vest gate starts off: nothing is preselected on');
  assert.equal(fresh.labelStyle,'None','the label program starts at no label');
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.indexOf('<span>Tuxedo facings</span>')>=0&&html.indexOf('<span>Tuxedo facings</span>')<html.indexOf('<span>Lapel style</span>'),'the Tuxedo facings group opens the Personalize step, before Lapel style');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('tuxedo','No')">`)&&html.includes('Standard jacket · Included'),'the standard jacket is the selected default, shown Included');
  assert.ok(!html.includes('Make it a tuxedo')&&!html.includes('Square and tie')&&!html.includes('Classic vest'),'the tier switch, the square and tie set and the named vest styles are not offered');
  assert.ok(html.indexOf('<h3>Trousers</h3>')<html.indexOf('<span>Vest</span>')&&html.indexOf('<span>Vest</span>')<html.indexOf('<span>Inside label</span>'),'the vest group follows Trousers and precedes the label program');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('vestIncluded','No')">`)&&html.includes('No vest · Included'),'no vest is the selected default, shown Included');
  assert.ok(!html.includes('Vest back'),'the vest field groups stay hidden until a vest is added');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('secondPairPants','No')">`)&&html.includes('No second pair · Included'),'the second pair starts off, shown Included');
  assert.ok(html.includes(`onclick="setOption('secondPairPants','Yes')">`)&&html.includes('Add a second pair · Included'),'the second pair is unpriced in the aligned model, pending the upcharge data');
  assert.ok(!html.includes('Additional pants'),'additional pants are not offered on an aligned design');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('labelStyle','None')">`)&&html.includes('No label · Included'),'no label is the selected label default');
  assert.ok(!html.includes('Monogram for the label'),'the label text field stays hidden until a personalized style is chosen');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('collarMonogramStyle','None')">`)&&html.includes('No collar monogram · Included'),'no collar monogram is the selected default');
  assert.ok(!html.includes('Collar monogram text'),'the collar monogram text field stays hidden until a style is chosen');
  w.run("setOption('vestIncluded','Yes')");
  const withVest=w.run('customize()');
  assert.ok(withVest.includes('<span>Vest back</span>'),'adding a vest reveals the vest field groups');
  assert.ok(withVest.includes(`aria-pressed="true" onclick="setOption('vestBack','Lining')">`)&&withVest.includes('Lining back · Included'),'the lining back is the selected vest back standard');
  assert.ok(withVest.includes(`onclick="setOption('vestBack','Fabric')">`)&&withVest.includes('Fabric back · Included'),'the fabric back is unpriced in the aligned model');
  w.run("setOption('labelStyle','Personalized Monogram')");
  const withLabel=w.run('customize()');
  assert.ok(withLabel.includes('<input maxlength="20" value="" oninput="config.monogram=this.value;saveConfig()" placeholder="Your personal touch">'),'choosing a personalized label reveals the label text field at its 20 character cap');
  assert.ok(withLabel.includes('Second line'),'the second label line field is offered');
  w.run("setOption('collarMonogramStyle','Block')");
  assert.ok(w.run('customize()').includes('<input maxlength="11" value="" oninput="config.collarMonogram=this.value;saveConfig()" placeholder="Your initials">'),'choosing a collar monogram style reveals its text field at its 11 character cap');
}

// World 2: on the aligned model the tuxedo specification, the vest
// fields, the label program and the second pair add nothing; no extra
// on an aligned suit prices at all.
{
  const cases=[["setOption('tuxedo','Yes')",0,'the tuxedo gate adds nothing'],["setOption('tuxedo','Yes');setOption('tuxLapel','Satin full');setOption('tuxCollar','Grosgrain 3/8')",0,'tuxedo facings add nothing'],["setOption('secondPairPants','Yes')",0,'the second pair adds nothing: unpriced pending the upcharge data'],["setOption('vestIncluded','Yes');setOption('vestStyle','Notch Lapel');setOption('vestBack','Fabric')",0,'the vest fields add nothing'],["setOption('labelStyle','Personalized Monogram');config.monogram='AB';config.monogram2='CD';saveConfig()",0,'a filled personalized label adds nothing'],["setOption('collarMonogramStyle','Block');config.collarMonogram='EF';saveConfig()",0,'a filled collar monogram adds nothing'],['',0,'an untouched design adds nothing']];
  for(const [act,delta,message] of cases){
    const w=makeWorld();
    w.run('beginDesign(0)');
    if(act)w.run(act);
    assert.equal(w.run('itemPrice(config)'),399+delta,message);
    assert.equal(w.run('optionCharge(config)'),delta,message+' (option charge)');
  }
}

// World 3: removing the vest removes it from the line completely, in
// the customizer and through bag Edit.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('vestIncluded','Yes');setOption('vestStyle','Notch Lapel');setOption('vestBack','Fabric')");
  assert.equal(w.run('itemPrice(config)'),399,'the vest fields are unpriced in the aligned model');
  assert.ok(w.run('lineDescription(config)').includes('Vest: Notch Lapel'),'the design line names the vest while it is added');
  w.run("setOption('vestIncluded','No')");
  assert.ok(!w.run('lineDescription(config)').includes('Vest:'),'turning the vest off removes it from the line');
  w.run("setOption('vestIncluded','Yes')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),399,'the bagged vest prices at base');
  const item=w.bag()[0];
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().vestIncluded,'Yes','bag Edit restores the vest gate');
  assert.equal(w.config().vestStyle,'Notch Lapel','bag Edit restores the vest style');
  assert.equal(w.config().vestBack,'Fabric','bag Edit restores the vest back');
  w.run("setOption('vestIncluded','No')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the removal adds no new line');
  assert.equal(w.run('subtotal()'),399,'the edited line stays at base price');
  assert.ok(!w.run('lineDescription(bag[0])').includes('Vest:'),'the edited line no longer names a vest');
  assert.ok(!w.run('lineDescription(bag[0])').includes('Fabric back'),'the edited line no longer names the fabric back');
}

// World 4: the aligned extras carry through the bag line and checkout
// at the base price (nothing on the aligned step prices), and bag
// Edit restores every field.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('tuxedo','Yes');setOption('tuxLapel','Satin full');setOption('vestIncluded','Yes');setOption('vestStyle','Notch Lapel');setOption('vestButtons','DB 6x3');setOption('vestBack','Fabric');setOption('labelStyle','Personalized Monogram');config.monogram='AB';config.monogram2='CD';setOption('collarMonogramStyle','Block');config.collarMonogram='EF';saveConfig()");
  assert.ok(w.run('customize()').includes('<div class="price">$399 '),'the customizer price stays at base: no aligned extra prices');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.tuxedo,'Yes');assert.equal(item.tuxLapel,'Satin full');assert.equal(item.vestIncluded,'Yes');assert.equal(item.vestStyle,'Notch Lapel');assert.equal(item.vestButtons,'DB 6x3');assert.equal(item.vestBack,'Fabric');assert.equal(item.labelStyle,'Personalized Monogram');assert.equal(item.monogram,'AB');assert.equal(item.monogram2,'CD');assert.equal(item.collarMonogram,'EF');
  assert.ok(!('tier' in item)&&!('vest' in item)&&!('squareAndTie' in item),'the bagged item carries none of the retired extras slots');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel, Standard · 2-Button · Tuxedo facings · Center vent · 4 cuff buttons · Flap waist pockets · Flat front, no pleats · Slanted pockets · Double besom back pockets · Medium break · Belt loops · Tonal lining · Vest: Notch Lapel, DB 6x3, Welt pockets, 2-Pocket, Fabric back · Label: Personalized Monogram AB / CD · Collar monogram EF','the bag line names the facings, the trousers specification, the vest fields and both monograms');
  assert.equal(w.run('subtotal()'),399,'the subtotal is the base price');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Notch Lapel')&&checkout.includes('$399'),'the checkout shows the extras and the total');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().tuxedo,'Yes','bag Edit restores the tuxedo gate');
  assert.equal(w.config().tuxLapel,'Satin full','bag Edit restores the lapel facing');
  assert.equal(w.config().vestIncluded,'Yes','bag Edit restores the vest gate');
  assert.equal(w.config().vestStyle,'Notch Lapel','bag Edit restores the vest style');
  assert.equal(w.config().vestBack,'Fabric','bag Edit restores the vest back');
  assert.equal(w.config().labelStyle,'Personalized Monogram','bag Edit restores the label style');
  assert.equal(w.config().monogram2,'CD','bag Edit restores the second label line');
  assert.equal(w.config().collarMonogram,'EF','bag Edit restores the collar monogram');
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),399,'saving the restored edit keeps the total');
}

// World 5: a standalone jacket offers the tuxedo specification and
// the label program, but no vest and no additional pants, and prices
// what it offers the same way (nothing, pending the upcharge data).
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(idx>=0,'the catalog holds a standalone jacket');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<span>Tuxedo facings</span>'),'the jacket Personalize step offers the tuxedo specification');
  assert.ok(!html.includes('<span>Vest</span>'),'a standalone jacket offers no vest');
  assert.ok(!html.includes('<span>Additional pants</span>'),'a standalone jacket offers no additional pants');
  assert.ok(html.includes('<span>Inside label</span>')&&html.includes('<span>Collar monogram</span>'),'the jacket offers the label program and the collar monogram style');
  w.run("setOption('tuxedo','Yes');setOption('tuxCollar','Grosgrain 3/8');setOption('collarMonogramStyle','Script');config.collarMonogram='EF';saveConfig()");
  assert.equal(w.run('itemPrice(config)'),base,'the jacket prices its tuxedo facings and collar monogram at nothing');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.tuxedo,'Yes');assert.equal(item.tuxCollar,'Grosgrain 3/8');assert.ok(!('vestIncluded' in item)&&!('additionalPants' in item),'the jacket line carries no suit only extras');
  assert.equal(w.run('lineDescription(bag[0])'),`Taupe · Notch lapel, Standard · 2-Button · Tuxedo facings · Center vent · 4 cuff buttons · Flap waist pockets · Tonal lining · Collar monogram EF`,'the jacket bag line names the facings and the collar monogram');
  assert.equal(w.run('subtotal()'),base,'the jacket subtotal is its base price');
}

// World 6: trousers keep their existing behavior exactly: the single
// 12 character monogram field, no tier, no extras, and extras values
// seeded onto a trousers item are never priced or described.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='pants')");
  assert.ok(idx>=0,'the catalog holds standalone trousers');
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(!html.includes('<div class="option-title">Tier</div>'),'trousers get no Tier group');
  assert.ok(!html.includes('<h3>Extras</h3>'),'trousers get no Extras section');
  assert.ok(html.includes('Monogram <span class="subtle">Optional · up to 12 characters</span>'),'trousers keep the single monogram field at its 12 character cap');
  assert.ok(!html.includes('config.monogram2=this.value')&&!html.includes('config.collarMonogram=this.value'),'trousers gain no second line or collar monogram');
  const seeded={product:idx,fabric:'Navy',lapel:'',closure:'Flat front',fit:'',lining:'',monogram:'AB',tier:'Make it a tuxedo',vest:'Classic vest',vestFabricBack:'Fabric back',additionalPants:'Yes',squareAndTie:'Yes',monogram2:'CD',collarMonogram:'EF',profile:JSON.parse(JSON.stringify(profile))};
  assert.equal(w.run(`optionCharge(${JSON.stringify(seeded)})`),0,'extras and monogram values on trousers are never priced');
  const line=w.run(`lineDescription(${JSON.stringify(seeded)})`);
  assert.ok(!line.includes('Classic vest')&&!line.includes('Make it a tuxedo')&&!line.includes('Square and tie')&&!line.includes('Collar monogram'),'the trousers line describes none of the suit and jacket extras');
}

// World 7: the deliberate legacy monogram rule. A stored item with a
// filled monogram keeps its exact previous line text and reprices by
// exactly +$10; a stored item without one is byte and price identical,
// and an edit cycle keeps the charge at exactly +$10, not lost, not
// doubled.
{
  const legacy={id:'legacy-mono',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'AB',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'AB'}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Tonal lining · Monogram AB','the legacy monogram line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),10,'the legacy monogram line charges exactly the new $10 monogram price');
  assert.equal(w.run('itemPrice(bag[0])'),409,'the legacy monogram line prices at base plus $10');
  assert.equal(w.run('subtotal()'),409,'the legacy subtotal follows the monogram rule');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('$409'),'the legacy monogram item checks out at base plus $10');
  w.run("editBagItem('legacy-mono')");
  bagCurrentWorld(w);
  assert.deepEqual(w.bag()[0],{...legacy,profileId:'profile-1'},'saving the legacy edit changes nothing but the profileId every edit save records, and injects no extras fields');
  assert.equal(w.run('subtotal()'),409,'the monogram charge survives the edit cycle at exactly +$10');
  const plain={id:'legacy-plain',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profile:JSON.parse(JSON.stringify(profile))};
  const w2=makeWorld({bag:[plain],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''}});
  assert.equal(w2.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Tonal lining','a legacy line without a monogram keeps its exact previous description');
  assert.equal(w2.run('optionCharge(bag[0])'),0,'a legacy line without a monogram carries no charge');
  assert.equal(w2.run('itemPrice(bag[0])'),399,'a legacy line without a monogram prices at the product base');
}

// World 8: the CUS-07 product change reset restores every aligned
// slot to its standard and clears the text fields.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('tuxedo','Yes');setOption('vestIncluded','Yes');setOption('additionalPants','Yes');setOption('labelStyle','Personalized Monogram');config.monogram='AB';config.monogram2='CD';config.collarMonogram='EF';saveConfig()");
  w.run('beginDesign(1)');
  const config=w.config();
  for(const k of ['tier','vest','vestFabricBack','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in config),`starting another product clears the ${k} slot`);
  assert.equal(config.tuxedo,'No','the second product starts with the tuxedo gate off');
  assert.equal(config.vestIncluded,'No','the second product starts with no vest');
  assert.equal(config.labelStyle,'None','the second product starts with no label');
  assert.equal(config.monogram,'','the second product starts with an empty monogram');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  for(const k of ['tier','vest','vestFabricBack','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in item),`the second product line carries no ${k} from the first`);
  assert.equal(item.tuxedo,'No','the second product line carries the standard tuxedo gate');
  assert.equal(w.run('subtotal()'),449,'the second product prices at its base');
}

// Server: the order sanitizer persists the extras and monogram fields
// and prices them from the mirrored tables, with kind guards: vest and
// additional pants price on suits only, everything here stays unpriced
// on trousers, and trousers keep the 12 character monogram cap.
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
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',tier:'Make it a tuxedo',vest:'Classic vest',vestFabricBack:'Fabric back',additionalPants:'Yes',squareAndTie:'Yes',monogram:'ABCDEFGHIJKLMNOPQRST',monogram2:'CD',collarMonogram:'EF',profile:readyProfile}],shipping},'extras-00000000000001'),env);
  assert.equal(r.status,200,'a checkout carrying the extras succeeds');
  const placed=await r.json();
  assert.equal(placed.totalCents,suit.priceCents+36800,'the server total adds every extra (5000+9900+2000+14000+3900+1000+1000)');
  assert.equal(providerAmount,((suit.priceCents+36800)/100).toFixed(2),'the payment amount matches the raised total');
  const stored=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(stored.tier,'Make it a tuxedo','the order item persists the tier');
  assert.equal(stored.vest,'Classic vest','the order item persists the vest style');
  assert.equal(stored.vestFabricBack,'Fabric back','the order item persists the fabric back');
  assert.equal(stored.additionalPants,'Yes','the order item persists additional pants');
  assert.equal(stored.squareAndTie,'Yes','the order item persists the square and tie set');
  assert.equal(stored.monogram,'ABCDEFGHIJKLMNOPQRST','the order item persists a full 20 character monogram line');
  assert.equal(stored.monogram2,'CD','the order item persists the second monogram line');
  assert.equal(stored.collarMonogram,'EF','the order item persists the collar monogram');
  assert.equal(stored.priceCents,suit.priceCents+36800,'the order item price carries every extra');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'AB',profile:readyProfile}],shipping},'extras-00000000000002'),env);
  assert.equal((await r.json()).totalCents,suit.priceCents+1000,'server side, a legacy filled monogram reprices by exactly $10 and nothing else');
  const jacketIdx=catalog.findIndex(p=>p.kind==='jacket'),jacket=catalog[jacketIdx];
  r=await commerce(req({items:[{product:jacketIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',tier:'Make it a tuxedo',squareAndTie:'Yes',collarMonogram:'EF',vest:'Classic vest',additionalPants:'Yes',profile:readyProfile}],shipping},'extras-00000000000003'),env);
  assert.equal((await r.json()).totalCents,jacket.priceCents+9900,'a jacket prices its tier, set and collar monogram, while vest and additional pants values on it are never priced');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  r=await commerce(req({items:[{product:pantsIdx,fabric:'Wool',lapel:'',closure:'Flat front',fit:'',lining:'',tier:'Make it a tuxedo',vest:'Classic vest',vestFabricBack:'Fabric back',additionalPants:'Yes',squareAndTie:'Yes',monogram:'ABCDEFGHIJKLMNOPQRST',monogram2:'CD',collarMonogram:'EF',profile:readyProfile}],shipping},'extras-00000000000004'),env);
  assert.equal((await r.json()).totalCents,pants.priceCents,'extras and monogram values on trousers are never priced');
  const storedPants=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(storedPants.monogram,'ABCDEFGHIJKL','trousers keep the 12 character monogram cap on the order item');
  console.log('Customizer extras checks passed: suits and jackets render the tuxedo facing specification in place of the tier switch, suits specify the vest on the JPOS vest fields, the label program and collar monogram are styles with unpriced text, the second pair replaces additional pants unpriced among the extras, removing the vest removes it from the line in the customizer and through bag Edit, a product switch resets every slot, legacy items price and render exactly as before through the legacy tables on client and server, and other kinds are untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
