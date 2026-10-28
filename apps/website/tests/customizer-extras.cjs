const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-02 (Wave 3 package 3.4): the priced extras, the tuxedo tier and
// the extra monogram fields. Suits and jackets gain a Tier group at the
// top of the Personalize step (Regular included, Make it a tuxedo +$50)
// and a square and tie set (+$39); suits alone gain a vest in six styles
// (+$99 each) with an optional fabric back (+$20) and additional pants
// (+$140). The inside monogram grows a second line and a collar
// monogram joins it: a filled first line prices at +$10 (the second
// line adds nothing) and a filled collar monogram at +$10, read from
// TEXT_FIELD_PRICES and its server mirror. Every extra shows its price
// before it is added and nothing is preselected on. The new slots stay
// absent from config until chosen, like packages 3.1 to 3.3.
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
  for(const f of ['app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const config=()=>JSON.parse(store.get('suits-config'));
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,config,bag};
}
function bagCurrentWorld(w){w.run('stage=2;render(false)');w.elFor('#profileSelect').value='profile-1';w.run('nextConfig()')}

// World 1: a suit renders the Tier group at the top of the Personalize
// step, the Extras section after Trousers with every price showing, and
// the three monogram fields; the new slots stay unset until chosen and
// the waistcoat back group appears only once a vest is chosen.
{
  const w=makeWorld();
  assert.equal(w.run('VEST_VALUES.length'),6,'the vest group holds the six captured styles');
  assert.equal(w.run("optionPrice('tier','Make it a tuxedo')"),50,'the tuxedo tier prices at $50 in the table');
  assert.equal(w.run("optionPrice('vest','Classic vest')"),99,'a vest style prices at $99');
  assert.equal(w.run("optionPrice('vestFabricBack','Fabric back')"),20,'the fabric back prices at $20');
  assert.equal(w.run("optionPrice('additionalPants','Yes')"),140,'additional pants price at $140');
  assert.equal(w.run("optionPrice('squareAndTie','Yes')"),39,'the square and tie set prices at $39');
  assert.equal(w.run('TEXT_FIELD_PRICES.monogram'),10,'a filled inside monogram prices at $10');
  assert.equal(w.run('TEXT_FIELD_PRICES.collarMonogram'),10,'a filled collar monogram prices at $10');
  w.run('beginDesign(0)');
  const fresh=w.config();
  for(const k of ['tier','vest','vestFabricBack','additionalPants','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in fresh),`the ${k} slot stays unset until the shopper chooses it`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.indexOf('<div class="option-title">Tier</div>')>=0&&html.indexOf('<div class="option-title">Tier</div>')<html.indexOf('<div class="option-title">Lapel</div>'),'the Tier group opens the Personalize step, before Lapel');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('tier','Regular')">Regular · Included`),'Regular is the selected tier default, shown Included');
  assert.ok(html.includes(`onclick="setOption('tier','Make it a tuxedo')">Make it a tuxedo · +$50`),'the tuxedo tier shows its +$50 before it is chosen');
  assert.ok(html.indexOf('<h3>Trousers</h3>')<html.indexOf('<h3>Extras</h3>')&&html.indexOf('<h3>Extras</h3>')<html.indexOf('<label class="field">Monogram'),'the Extras section follows Trousers and precedes the monogram fields');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('vest','No vest')">No vest · Included`),'no vest is the selected default, shown Included: nothing is preselected on');
  assert.ok(html.includes(`onclick="setOption('vest','Classic vest')">Classic vest · +$99`),'a vest style shows its +$99 before it is added');
  assert.ok(html.includes(`onclick="setOption('vest','Shawl lapel double breasted vest')">Shawl lapel double breasted vest · +$99`),'every vest style shows +$99');
  assert.ok(!html.includes('Waistcoat back'),'the waistcoat back group stays hidden until a vest is chosen');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('additionalPants','No')">No · Included`),'additional pants start off, shown Included');
  assert.ok(html.includes(`onclick="setOption('additionalPants','Yes')">Yes · +$140`),'additional pants show +$140 before they are added');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('squareAndTie','No')">No · Included`),'the square and tie set starts off, shown Included');
  assert.ok(html.includes(`onclick="setOption('squareAndTie','Yes')">Yes · +$39`),'the square and tie set shows +$39 before it is added');
  assert.ok(html.includes('Inside the jacket · +$10 when filled · up to 20 characters'),'the inside monogram states its price and its 20 character cap');
  assert.ok(html.includes('<input maxlength="20" value="" oninput="config.monogram=this.value;saveConfig()" placeholder="Line 1">'),'the first monogram line takes 20 characters');
  assert.ok(html.includes('<input maxlength="20" value="" oninput="config.monogram2=this.value;saveConfig()" placeholder="Line 2">'),'the second monogram line takes 20 characters');
  assert.ok(html.includes('Collar monogram'),'the collar monogram field is offered');
  assert.ok(html.includes('<input maxlength="11" value="" oninput="config.collarMonogram=this.value;saveConfig()" placeholder="Your personal touch">'),'the collar monogram takes 11 characters');
  w.run("setOption('vest','Classic vest')");
  const withVest=w.run('customize()');
  assert.ok(withVest.includes('<div class="option-title">Waistcoat back</div>'),'choosing a vest reveals the waistcoat back group');
  assert.ok(withVest.includes(`aria-pressed="true" onclick="setOption('vestFabricBack','Matches lining')">Matches lining · Included`),'the lining back is the selected waistcoat back default');
  assert.ok(withVest.includes(`onclick="setOption('vestFabricBack','Fabric back')">Fabric back · +$20`),'the fabric back shows +$20');
}

// World 2: each extra and field adds exactly its modifier on its own.
{
  const cases=[["setOption('tier','Make it a tuxedo')",50,'the tuxedo tier adds $50'],["setOption('additionalPants','Yes')",140,'additional pants add $140'],["setOption('squareAndTie','Yes')",39,'the square and tie set adds $39'],["config.monogram='AB';saveConfig()",10,'a filled inside monogram adds $10'],["config.monogram='AB';config.monogram2='CD';saveConfig()",10,'the second monogram line adds nothing beyond the first'],["config.collarMonogram='EF';saveConfig()",10,'a filled collar monogram adds $10'],["config.monogram2='CD';saveConfig()",0,'a lone second line, with the first line empty, adds nothing'],['',0,'empty monogram fields add nothing']];
  for(const [act,delta,message] of cases){
    const w=makeWorld();
    w.run('beginDesign(0)');
    if(act)w.run(act);
    assert.equal(w.run('itemPrice(config)'),399+delta,message);
    assert.equal(w.run('optionCharge(config)'),delta,message+' (option charge)');
  }
  for(const style of ['Classic vest','Classic lapel vest','Double breasted vest','Double breasted lapel vest','Shawl lapel vest','Shawl lapel double breasted vest']){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(`setOption('vest','${style}')`);
    assert.equal(w.run('itemPrice(config)'),399+99,`the ${style} adds $99`);
    assert.equal(w.run('optionCharge(config)'),99,`the ${style} charges $99`);
  }
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('vest','Classic vest');setOption('vestFabricBack','Fabric back')");
  assert.equal(w.run('itemPrice(config)'),399+119,'a vest with a fabric back adds $99 plus $20');
}

// World 3: removing the vest removes its charge completely, in the
// customizer and through bag Edit.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('vest','Classic lapel vest');setOption('vestFabricBack','Fabric back')");
  assert.equal(w.run('itemPrice(config)'),399+119,'the vest and fabric back price together');
  w.run("setOption('vest','No vest')");
  assert.ok(!('vestFabricBack' in w.config()),'choosing No vest clears the fabric back selection with it');
  assert.equal(w.run('itemPrice(config)'),399,'removing the vest returns the customizer price to base');
  assert.equal(w.run('optionCharge(config)'),0,'removing the vest leaves no charge');
  w.run("setOption('vest','Classic lapel vest');setOption('vestFabricBack','Fabric back')");
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),399+119,'the bagged vest prices with its fabric back');
  const item=w.bag()[0];
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().vest,'Classic lapel vest','bag Edit restores the vest style');
  assert.equal(w.config().vestFabricBack,'Fabric back','bag Edit restores the fabric back');
  w.run("setOption('vest','No vest')");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the removal adds no new line');
  assert.equal(w.run('subtotal()'),399,'removing the vest through bag Edit returns the line to base price');
  assert.ok(!w.run('lineDescription(bag[0])').includes('vest'),'the edited line no longer names a vest');
  assert.ok(!w.run('lineDescription(bag[0])').includes('Fabric back'),'the edited line no longer names the fabric back');
}

// World 4: all the extras combined total correctly through the bag
// line and checkout, and bag Edit restores every one of them.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('tier','Make it a tuxedo');setOption('vest','Classic vest');setOption('vestFabricBack','Fabric back');setOption('additionalPants','Yes');setOption('squareAndTie','Yes');config.monogram='AB';config.monogram2='CD';config.collarMonogram='EF';saveConfig()");
  assert.ok(w.run('customize()').includes('<div class="price">$767 '),'the customizer price carries every extra (50+99+20+140+39+10+10)');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.tier,'Make it a tuxedo');assert.equal(item.vest,'Classic vest');assert.equal(item.vestFabricBack,'Fabric back');assert.equal(item.additionalPants,'Yes');assert.equal(item.squareAndTie,'Yes');assert.equal(item.monogram,'AB');assert.equal(item.monogram2,'CD');assert.equal(item.collarMonogram,'EF');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Make it a tuxedo · Tonal lining · Classic vest · Fabric back · Additional pants · Square and tie · Monogram AB / CD · Collar monogram EF','the bag line names the tier, the vest and its fabric back, both add ons and both monograms');
  assert.equal(w.run('subtotal()'),767,'the subtotal totals every extra');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Classic vest')&&checkout.includes('$767'),'the checkout shows the extras and the combined total');
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().tier,'Make it a tuxedo','bag Edit restores the tier');
  assert.equal(w.config().vest,'Classic vest','bag Edit restores the vest');
  assert.equal(w.config().vestFabricBack,'Fabric back','bag Edit restores the fabric back');
  assert.equal(w.config().additionalPants,'Yes','bag Edit restores additional pants');
  assert.equal(w.config().squareAndTie,'Yes','bag Edit restores the square and tie set');
  assert.equal(w.config().monogram2,'CD','bag Edit restores the second monogram line');
  assert.equal(w.config().collarMonogram,'EF','bag Edit restores the collar monogram');
  bagCurrentWorld(w);
  assert.equal(w.run('subtotal()'),767,'saving the restored edit keeps the combined total');
}

// World 5: a standalone jacket offers the tier, the square and tie set
// and the expanded monogram fields, but no vest and no additional
// pants, and prices what it offers the same way.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(idx>=0,'the catalog holds a standalone jacket');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<div class="option-title">Tier</div>'),'the jacket Personalize step offers the Tier group');
  assert.ok(html.includes('<div class="option-title">Square and tie</div>'),'the jacket offers the square and tie set');
  assert.ok(!html.includes('<div class="option-title">Add a vest</div>'),'a standalone jacket offers no vest');
  assert.ok(!html.includes('<div class="option-title">Additional pants</div>'),'a standalone jacket offers no additional pants');
  assert.ok(html.includes('config.monogram2=this.value')&&html.includes('config.collarMonogram=this.value'),'the jacket offers the second monogram line and the collar monogram');
  w.run("setOption('tier','Make it a tuxedo');setOption('squareAndTie','Yes');config.collarMonogram='EF';saveConfig()");
  assert.equal(w.run('itemPrice(config)'),base+50+39+10,'the jacket prices the tier, the set and the collar monogram');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.tier,'Make it a tuxedo');assert.equal(item.squareAndTie,'Yes');assert.ok(!('vest' in item)&&!('additionalPants' in item),'the jacket line carries no suit only extras');
  assert.equal(w.run('lineDescription(bag[0])'),`Taupe · Notch lapel · Tailored fit · Two button · Make it a tuxedo · Tonal lining · Square and tie · Collar monogram EF`,'the jacket bag line names the tier, the set and the collar monogram');
  assert.equal(w.run('subtotal()'),base+99,'the jacket subtotal includes its extras');
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

// World 8: the CUS-07 product change reset clears every new slot.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('tier','Make it a tuxedo');setOption('vest','Classic vest');setOption('vestFabricBack','Fabric back');setOption('additionalPants','Yes');setOption('squareAndTie','Yes');config.monogram='AB';config.monogram2='CD';config.collarMonogram='EF';saveConfig()");
  w.run('beginDesign(1)');
  const config=w.config();
  for(const k of ['tier','vest','vestFabricBack','additionalPants','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in config),`starting another product clears the ${k} slot`);
  assert.equal(config.monogram,'','the second product starts with an empty monogram');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  for(const k of ['tier','vest','vestFabricBack','additionalPants','squareAndTie','monogram2','collarMonogram'])assert.ok(!(k in item),`the second product line carries no ${k} from the first`);
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
  console.log('Customizer extras checks passed: suits and jackets render the Tier group and expanded monogram fields, suits gain the vest, fabric back, additional pants and square and tie extras with prices shown before adding and nothing preselected on, every modifier flows from the one table to the customizer, bag, checkout and server order, removing the vest removes its charge in the customizer and through bag Edit, a product switch resets every new slot, legacy monogram items reprice by exactly $10 with line text unchanged, and other kinds are untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
