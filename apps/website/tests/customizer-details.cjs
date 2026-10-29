const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-02 (Wave 3 package 3.5): the detail add ons, tailor changes and
// comments. Suits and jackets gain a Jacket details section of six
// No/Yes toggles (working cuff buttons +$5, pick stitch +$10, gauntlet
// cuff +$15, natural shoulders +$20, Italian boat pocket +$25,
// Milanese lapel buttonhole +$75); suits and standalone trousers gain
// a Trouser details section (pants cuff +$5, suspender buttons +$2,
// flap coin pocket +$5, a free 2 inch waistband toggle) and a Side
// tabs group (No side tabs included, then +$12, +$12, +$12, +$17,
// +$20, +$20); suits gain the tailor changes consent (Yes, change if
// required by default, No, contact me shown on the bag line and
// persisted to the order because fulfillment needs it); and suits,
// jackets and trousers gain a free comments field of up to 200
// characters, persisted client and server and shown as its own
// paragraph in the bag line markup wherever bag lines render. Every
// priced detail reads from OPTION_PRICES and its server mirror, with
// the same kind guards as the earlier packages, and the new slots
// stay absent from config until chosen, like packages 3.1 to 3.4.
// The Buttonholes color swatches from the reference builder are
// deliberately not implemented: their names were never captured, so
// there is nothing honest to label them with.
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
const NEW_SLOTS=['workingCuffButtons','pickStitch','gauntletCuff','naturalShoulders','boatPocket','milaneseButtonhole','pantsCuff','suspenderButtons','coinPocket','wideWaistband','sideTabs','tailorChanges','comments'];
const JACKET_TOGGLES=[['workingCuffButtons',5],['pickStitch',10],['gauntletCuff',15],['naturalShoulders',20],['boatPocket',25],['milaneseButtonhole',75]];

// World 1: a suit renders the Jacket details section after Elbow
// patches and before Trousers, the Trouser details section inside
// Trousers, the tailor changes consent in Extras with its default
// selected, and the comments field; every price shows before it is
// chosen, every toggle starts off, and no new slot exists until chosen.
{
  const w=makeWorld();
  for(const [key,price] of JACKET_TOGGLES)assert.equal(w.run(`optionPrice('${key}','Yes')`),price,`the ${key} toggle prices at $${price} in the table`);
  assert.equal(w.run("optionPrice('pantsCuff','Yes')"),5,'pants cuff prices at $5');
  assert.equal(w.run("optionPrice('suspenderButtons','Yes')"),2,'suspender buttons price at $2');
  assert.equal(w.run("optionPrice('coinPocket','Yes')"),5,'the flap coin pocket prices at $5');
  assert.equal(w.run("optionPrice('wideWaistband','Yes')"),0,'the 2 inch waistband toggle is free');
  assert.equal(w.run("optionPrice('sideTabs','Venice side tabs')"),20,'Venice side tabs price at $20');
  w.run('beginDesign(0)');
  const fresh=w.config();
  for(const k of NEW_SLOTS)assert.ok(!(k in fresh),`the ${k} slot stays unset until the shopper chooses it`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.indexOf('Elbow patches')<html.indexOf('<h3>Jacket details</h3>')&&html.indexOf('<h3>Jacket details</h3>')<html.indexOf('<h3>Trousers</h3>'),'the Jacket details section follows Elbow patches and precedes Trousers');
  for(const [key,price] of JACKET_TOGGLES){
    assert.ok(html.includes(`aria-pressed="true" onclick="setOption('${key}','No')">No · Included`),`the ${key} toggle starts off, shown Included`);
    assert.ok(html.includes(`onclick="setOption('${key}','Yes')">Yes · +$${price}`),`the ${key} toggle shows its +$${price} before it is added`);
  }
  assert.ok(html.indexOf('<h3>Trousers</h3>')<html.indexOf('<h3>Trouser details</h3>'),'the Trouser details section sits inside the Trousers section');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('pantsCuff','No')">No · Included`),'the pants cuff toggle starts off');
  assert.ok(html.includes(`onclick="setOption('suspenderButtons','Yes')">Yes · +$2`),'suspender buttons show +$2');
  assert.ok(html.includes(`onclick="setOption('wideWaistband','Yes')">Yes · Included`),'the 2 inch waistband toggle is labelled Included');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('sideTabs','No side tabs')">No side tabs · Included`),'no side tabs is the selected default, shown Included');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Classic side tabs')">Classic side tabs · +$12`),'classic side tabs show +$12');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Back elastic')">Back elastic · +$12`),'back elastic shows +$12');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Side adjusters')">Side adjusters · +$12`),'side adjusters show +$12');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Side elasticated tabs')">Side elasticated tabs · +$17`),'side elasticated tabs show +$17');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Milan side tabs')">Milan side tabs · +$20`),'Milan side tabs show +$20');
  assert.ok(html.includes(`onclick="setOption('sideTabs','Venice side tabs')">Venice side tabs · +$20`),'Venice side tabs show +$20');
  assert.ok(html.indexOf('Square and tie')<html.indexOf('<div class="option-title">Tailor changes</div>'),'the tailor changes consent follows the Extras choices');
  assert.ok(html.includes(`aria-pressed="true" onclick="setOption('tailorChanges','Yes, change if required')">Yes, change if required`),'the tailor changes default is selected');
  assert.ok(html.includes(`onclick="setOption('tailorChanges','No, contact me')">No, contact me`),'the contact me choice is offered');
  assert.ok(html.includes('<textarea maxlength="200"'),'the comments field caps at 200 characters');
  assert.ok(html.includes('config.comments=this.value;saveConfig()'),'the comments field writes to the config slot');
  assert.ok(!html.includes('Buttonholes'),'no Buttonholes color group is offered: its swatch names were never captured');
}

// World 2: each jacket detail toggle adds exactly its modifier on its
// own, and all six combine to $150.
{
  for(const [key,price] of JACKET_TOGGLES){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(`setOption('${key}','Yes')`);
    assert.equal(w.run('optionCharge(config)'),price,`the ${key} toggle charges $${price} on its own`);
    assert.equal(w.run('itemPrice(config)'),399+price,`the ${key} toggle raises the item price by $${price}`);
  }
  const w=makeWorld();
  w.run('beginDesign(0)');
  for(const [key] of JACKET_TOGGLES)w.run(`setOption('${key}','Yes')`);
  assert.equal(w.run('optionCharge(config)'),150,'all six jacket details combine to $150');
  assert.equal(w.run('itemPrice(config)'),399+150,'the item price carries all six jacket details');
}

// World 3: the trouser detail toggles and every side tab tier add
// exactly their modifiers on a suit, on their own and combined.
{
  for(const [key,price] of [['pantsCuff',5],['suspenderButtons',2],['coinPocket',5],['wideWaistband',0]]){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(`setOption('${key}','Yes')`);
    assert.equal(w.run('optionCharge(config)'),price,`the ${key} toggle charges $${price} on a suit`);
    assert.equal(w.run('itemPrice(config)'),399+price,`the ${key} toggle raises the suit price by $${price}`);
  }
  for(const [value,price] of [['No side tabs',0],['Classic side tabs',12],['Back elastic',12],['Side adjusters',12],['Side elasticated tabs',17],['Milan side tabs',20],['Venice side tabs',20]]){
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run(`setOption('sideTabs','${value}')`);
    assert.equal(w.run('optionCharge(config)'),price,`the ${value} choice charges $${price}`);
    assert.equal(w.run('itemPrice(config)'),399+price,`the ${value} choice raises the suit price by $${price}`);
  }
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('pantsCuff','Yes');setOption('suspenderButtons','Yes');setOption('coinPocket','Yes');setOption('wideWaistband','Yes');setOption('sideTabs','Milan side tabs')");
  assert.equal(w.run('optionCharge(config)'),32,'the trouser details combine to $32 (5+2+5+0+20)');
}

// World 4: a combined suit carries every detail through the bag item,
// the bag line, the comments paragraph and checkout, with the tailor
// changes consent named because the shopper chose No, contact me.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('workingCuffButtons','Yes');setOption('milaneseButtonhole','Yes');setOption('pantsCuff','Yes');setOption('coinPocket','Yes');setOption('sideTabs','Venice side tabs');setOption('tailorChanges','No, contact me');config.comments='Please rush for a wedding.';saveConfig()");
  assert.ok(w.run('customize()').includes('<div class="price">$509 '),'the customizer price carries every detail (5+75+5+5+20)');
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.workingCuffButtons,'Yes');assert.equal(item.milaneseButtonhole,'Yes');assert.equal(item.pantsCuff,'Yes');assert.equal(item.coinPocket,'Yes');assert.equal(item.sideTabs,'Venice side tabs');assert.equal(item.tailorChanges,'No, contact me');assert.equal(item.comments,'Please rush for a wedding.');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Pants cuff · Flap coin pocket · Venice side tabs · Tonal lining · Working cuff buttons · Milanese buttonhole · Tailor changes: No, contact me','the bag line names the trouser details, the jacket details and the tailor changes consent');
  assert.ok(w.run('lineHtml(bag[0])').includes('<p>Comments: Please rush for a wedding.</p>'),'the bag line markup shows the comments as their own paragraph');
  assert.equal(w.run('subtotal()'),509,'the subtotal totals every detail');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Milanese buttonhole')&&checkout.includes('Comments: Please rush for a wedding.')&&checkout.includes('$509'),'the checkout shows the details, the comments and the combined total');
}

// World 5: bag Edit restores every new slot, and turning a detail off
// or clearing the comments through an edit removes its effect.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('workingCuffButtons','Yes');setOption('milaneseButtonhole','Yes');setOption('pantsCuff','Yes');setOption('coinPocket','Yes');setOption('sideTabs','Venice side tabs');setOption('tailorChanges','No, contact me');config.comments='Please rush for a wedding.';saveConfig()");
  bagCurrentWorld(w);
  const item=w.bag()[0];
  w.run(`editBagItem('${item.id}')`);
  assert.equal(w.config().workingCuffButtons,'Yes','bag Edit restores the working cuff buttons toggle');
  assert.equal(w.config().milaneseButtonhole,'Yes','bag Edit restores the Milanese buttonhole toggle');
  assert.equal(w.config().pantsCuff,'Yes','bag Edit restores the pants cuff toggle');
  assert.equal(w.config().sideTabs,'Venice side tabs','bag Edit restores the side tabs');
  assert.equal(w.config().tailorChanges,'No, contact me','bag Edit restores the tailor changes consent');
  assert.equal(w.config().comments,'Please rush for a wedding.','bag Edit restores the comments');
  w.run("setOption('workingCuffButtons','No');setOption('pantsCuff','No');config.comments='';saveConfig()");
  bagCurrentWorld(w);
  assert.equal(w.bag().length,1,'saving the edit adds no new line');
  assert.equal(w.run('subtotal()'),499,'turning two details off through bag Edit removes their $5 each');
  assert.ok(!w.run('lineDescription(bag[0])').includes('Working cuff buttons'),'the edited line no longer names the working cuff buttons');
  assert.ok(!w.run('lineDescription(bag[0])').includes('Pants cuff'),'the edited line no longer names the pants cuff');
  assert.ok(!w.run('lineHtml(bag[0])').includes('Comments:'),'the edited line no longer shows a comments paragraph');
  assert.ok(w.run('lineDescription(bag[0])').includes('Milanese buttonhole'),'the untouched details survive the edit');
}

// World 6: a standalone jacket offers the Jacket details section and
// the comments field, but no Trouser details and no tailor changes,
// and trouser detail values seeded onto a jacket item are never
// priced or described.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(idx>=0,'the catalog holds a standalone jacket');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<h3>Jacket details</h3>'),'the jacket Personalize step offers the Jacket details section');
  assert.ok(!html.includes('<h3>Trouser details</h3>'),'a standalone jacket offers no Trouser details section');
  assert.ok(!html.includes('<div class="option-title">Tailor changes</div>'),'a standalone jacket offers no tailor changes consent');
  assert.ok(html.includes('<textarea maxlength="200"'),'the jacket offers the comments field');
  w.run("setOption('gauntletCuff','Yes');setOption('boatPocket','Yes');config.comments='Sleeves a touch shorter, please.';saveConfig()");
  assert.equal(w.run('itemPrice(config)'),base+40,'the jacket prices its details (15+25)');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.gauntletCuff,'Yes');assert.equal(item.comments,'Sleeves a touch shorter, please.');
  assert.ok(!('tailorChanges' in item)&&!('pantsCuff' in item),'the jacket line carries no suit only or trouser fields');
  assert.equal(w.run('subtotal()'),base+40,'the jacket subtotal includes its details');
  const seeded={product:idx,fabric:'Taupe',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',pantsCuff:'Yes',suspenderButtons:'Yes',coinPocket:'Yes',wideWaistband:'Yes',sideTabs:'Venice side tabs',profile:JSON.parse(JSON.stringify(profile))};
  assert.equal(w.run(`optionCharge(${JSON.stringify(seeded)})`),0,'trouser detail values on a jacket are never priced');
  const line=w.run(`lineDescription(${JSON.stringify(seeded)})`);
  assert.ok(!line.includes('Pants cuff')&&!line.includes('Venice side tabs')&&!line.includes('2 inch waistband'),'the jacket line describes none of the trouser details');
}

// World 7: standalone trousers offer the Trouser details section, the
// Side tabs group and the comments field, but no Jacket details and no
// tailor changes; their details price like the suit's, and jacket
// detail values seeded onto a trousers item are never priced or
// described.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.kind==='pants')");
  assert.ok(idx>=0,'the catalog holds standalone trousers');
  const base=w.run(`products[${idx}].price`);
  w.run(`beginDesign(${idx})`);
  w.run('stage=1');
  const html=w.run('customize()');
  assert.ok(html.includes('<h3>Trouser details</h3>'),'the trousers Personalize step offers the Trouser details section');
  assert.ok(html.includes('<div class="option-title">Side tabs</div>'),'the trousers offer the Side tabs group');
  assert.ok(!html.includes('Jacket details'),'standalone trousers offer no Jacket details section');
  assert.ok(!html.includes('<div class="option-title">Tailor changes</div>'),'standalone trousers offer no tailor changes consent');
  assert.ok(html.includes('<textarea maxlength="200"'),'the trousers offer the comments field');
  assert.ok(html.indexOf('Monogram <span')<html.indexOf('Comments <span'),'the comments field follows the monogram field on trousers');
  w.run("setOption('pantsCuff','Yes');setOption('suspenderButtons','Yes');setOption('sideTabs','Milan side tabs');config.comments='Hem to a cropped length.';saveConfig()");
  assert.equal(w.run('itemPrice(config)'),base+27,'the trousers price their details (5+2+20)');
  bagCurrentWorld(w);
  const item=w.bag()[0];
  assert.equal(item.pantsCuff,'Yes');assert.equal(item.sideTabs,'Milan side tabs');assert.equal(item.comments,'Hem to a cropped length.');
  assert.ok(!('workingCuffButtons' in item)&&!('tailorChanges' in item),'the trousers line carries no jacket detail or suit only fields');
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Tailored fit · Flat front · Pants cuff · Suspender buttons · Milan side tabs · Tonal lining','the trousers bag line names its details');
  assert.ok(w.run('lineHtml(bag[0])').includes('<p>Comments: Hem to a cropped length.</p>'),'the trousers bag line markup shows the comments');
  assert.equal(w.run('subtotal()'),base+27,'the trousers subtotal includes their details');
  const seeded={product:idx,fabric:'Navy',lapel:'',closure:'Flat front',fit:'',lining:'',monogram:'',workingCuffButtons:'Yes',pickStitch:'Yes',gauntletCuff:'Yes',naturalShoulders:'Yes',boatPocket:'Yes',milaneseButtonhole:'Yes',tailorChanges:'No, contact me',profile:JSON.parse(JSON.stringify(profile))};
  assert.equal(w.run(`optionCharge(${JSON.stringify(seeded)})`),0,'jacket detail values on trousers are never priced');
  assert.equal(w.run(`lineDescription(${JSON.stringify(seeded)})`),'Navy · Flat front','the trousers line describes none of the jacket details or the suit only consent');
}

// World 8: shirts and waistcoats gain none of the new areas.
{
  const w=makeWorld();
  for(const kind of ['shirt','waistcoat']){
    const idx=w.run(`products.findIndex(p=>p.kind==='${kind}')`);
    assert.ok(idx>=0,`the catalog holds a ${kind}`);
    w.run(`beginDesign(${idx})`);
    w.run('stage=1');
    const html=w.run('customize()');
    assert.ok(!html.includes('Jacket details')&&!html.includes('Trouser details')&&!html.includes('Tailor changes')&&!html.includes('Comments <span'),`the ${kind} Personalize step gains no detail, consent or comments areas`);
  }
}

// World 9: legacy items without any of the new fields keep their
// exact previous line text and price, and a legacy edit cycle injects
// nothing.
{
  const plain={id:'legacy-plain',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profile:JSON.parse(JSON.stringify(profile))};
  const w=makeWorld({bag:[plain],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''}});
  assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Tonal lining','a legacy suit line keeps its exact previous description');
  assert.equal(w.run('optionCharge(bag[0])'),0,'a legacy suit line carries no detail charge');
  assert.equal(w.run('itemPrice(bag[0])'),399,'a legacy suit line prices at the product base');
  assert.ok(!w.run('lineHtml(bag[0])').includes('Comments:'),'a legacy line shows no comments paragraph');
  w.run("editBagItem('legacy-plain')");
  bagCurrentWorld(w);
  assert.deepEqual(w.bag()[0],{...plain,profileId:'profile-1'},'saving the legacy edit changes nothing but the profileId every edit save records, and injects no detail fields');
  const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");
  const plainPants={id:'legacy-pants',product:pantsIdx,fabric:'Navy',lapel:'',closure:'Flat front',fit:'',lining:'',monogram:'',profile:JSON.parse(JSON.stringify(profile))};
  const w2=makeWorld({bag:[plainPants]});
  assert.equal(w2.run('lineDescription(bag[0])'),'Navy · Flat front','a legacy trousers line keeps its exact previous description');
  assert.equal(w2.run('itemPrice(bag[0])'),w2.run(`products[${pantsIdx}].price`),'a legacy trousers line prices at the product base');
}

// World 10: the CUS-07 product change reset clears every new slot,
// returning to the same product resumes them, and starting a garment
// of another kind never inherits them.
{
  const w=makeWorld();
  w.run('beginDesign(0)');
  w.run("setOption('workingCuffButtons','Yes');setOption('pickStitch','Yes');setOption('gauntletCuff','Yes');setOption('naturalShoulders','Yes');setOption('boatPocket','Yes');setOption('milaneseButtonhole','Yes');setOption('pantsCuff','Yes');setOption('suspenderButtons','Yes');setOption('coinPocket','Yes');setOption('wideWaistband','Yes');setOption('sideTabs','Venice side tabs');setOption('tailorChanges','No, contact me');config.comments='Please rush for a wedding.';saveConfig()");
  w.run('beginDesign(0)');
  assert.equal(w.config().workingCuffButtons,'Yes','returning to the same product resumes the in progress details');
  assert.equal(w.config().comments,'Please rush for a wedding.','returning to the same product resumes the comments');
  w.run('beginDesign(1)');
  const config=w.config();
  for(const k of NEW_SLOTS)assert.ok(!(k in config),`starting another product clears the ${k} slot`);
  bagCurrentWorld(w);
  const item=w.bag()[0];
  for(const k of NEW_SLOTS)assert.ok(!(k in item),`the second product line carries no ${k} from the first`);
  assert.equal(w.run('subtotal()'),449,'the second product prices at its base');
  const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");
  w.run('beginDesign(0)');
  w.run("setOption('workingCuffButtons','Yes');setOption('tailorChanges','No, contact me');config.comments='For a wedding.';saveConfig()");
  w.run(`beginDesign(${pantsIdx})`);
  const pantsConfig=w.config();
  assert.ok(!('workingCuffButtons' in pantsConfig)&&!('tailorChanges' in pantsConfig)&&!('comments' in pantsConfig),'starting trousers inherits no jacket details, consent or comments from the suit');
}

// Server: the order sanitizer persists the details, the consent and
// the comments and prices them from the mirrored tables, with kind
// guards: jacket details price on suits and jackets only, trouser
// details on suits and trousers only, and comments are capped at 200
// characters on the order item.
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
  const allDetails={workingCuffButtons:'Yes',pickStitch:'Yes',gauntletCuff:'Yes',naturalShoulders:'Yes',boatPocket:'Yes',milaneseButtonhole:'Yes',pantsCuff:'Yes',suspenderButtons:'Yes',coinPocket:'Yes',wideWaistband:'Yes',sideTabs:'Venice side tabs'};
  let r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',...allDetails,tailorChanges:'No, contact me',comments:'Please rush for a wedding.',profile:readyProfile}],shipping},'details-0000000000001'),env);
  assert.equal(r.status,200,'a checkout carrying the details succeeds');
  const placed=await r.json();
  assert.equal(placed.totalCents,suit.priceCents+18200,'the server total adds every priced detail (15000 jacket + 1200 trouser toggles + 2000 side tabs)');
  assert.equal(providerAmount,((suit.priceCents+18200)/100).toFixed(2),'the payment amount matches the raised total');
  const stored=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(stored.workingCuffButtons,'Yes','the order item persists the working cuff buttons toggle');
  assert.equal(stored.milaneseButtonhole,'Yes','the order item persists the Milanese buttonhole toggle');
  assert.equal(stored.pantsCuff,'Yes','the order item persists the pants cuff toggle');
  assert.equal(stored.wideWaistband,'Yes','the order item persists the free waistband toggle');
  assert.equal(stored.sideTabs,'Venice side tabs','the order item persists the side tabs');
  assert.equal(stored.tailorChanges,'No, contact me','the order item persists the tailor changes consent fulfillment needs');
  assert.equal(stored.comments,'Please rush for a wedding.','the order item persists the comments');
  assert.equal(stored.priceCents,suit.priceCents+18200,'the order item price carries every priced detail');
  r=await commerce(req({items:[{product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',comments:'x'.repeat(250),profile:readyProfile}],shipping},'details-0000000000002'),env);
  assert.equal(r.status,200,'a checkout carrying long comments succeeds');
  assert.equal(JSON.parse(db.rows.at(-1).items)[0].comments.length,200,'the order item caps comments at 200 characters');
  const jacketIdx=catalog.findIndex(p=>p.kind==='jacket'),jacket=catalog[jacketIdx];
  r=await commerce(req({items:[{product:jacketIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',pickStitch:'Yes',pantsCuff:'Yes',suspenderButtons:'Yes',sideTabs:'Venice side tabs',comments:'Sleeves shorter.',profile:readyProfile}],shipping},'details-0000000000003'),env);
  assert.equal((await r.json()).totalCents,jacket.priceCents+1000,'a jacket prices its own detail only, while trouser detail values on it are never priced');
  assert.equal(JSON.parse(db.rows.at(-1).items)[0].comments,'Sleeves shorter.','the jacket order item persists its comments');
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  r=await commerce(req({items:[{product:pantsIdx,fabric:'Wool',lapel:'',closure:'Flat front',fit:'',lining:'',...allDetails,comments:'Hem to a cropped length.',profile:readyProfile}],shipping},'details-0000000000004'),env);
  assert.equal((await r.json()).totalCents,pants.priceCents+3200,'trousers price their trouser details and side tabs (500+200+500+2000), while jacket detail values on them are never priced');
  const storedPants=JSON.parse(db.rows.at(-1).items)[0];
  assert.equal(storedPants.comments,'Hem to a cropped length.','the trousers order item persists its comments');
  assert.equal(storedPants.sideTabs,'Venice side tabs','the trousers order item persists the side tabs');
  console.log('Customizer detail checks passed: suits and jackets render the Jacket details toggles and suits and trousers the Trouser details toggles and Side tabs group, all off by default with prices shown, suits render the tailor changes consent and all three kinds the comments field, every modifier flows from the one table to the customizer, bag, checkout and server order with kind guards on both sides, bag Edit restores and removes details, a product switch resets every new slot, and legacy items are byte and price identical.');
})().catch(e=>{console.error(e);process.exit(1)});
