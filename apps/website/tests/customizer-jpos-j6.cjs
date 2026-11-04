const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// JPOS consistency wave, package J6: waistcoat alignment (plan
// section 3 waistcoats, section 5 removals, and j0-mapping-design.md
// section C.5), plus the standalone trousers rendering rider the J5
// build flagged. One vest model in both contexts, as in JPOS: a new
// standalone waistcoat runs the same field set as the vest inside a
// suit (section C.6), on the same keys and value sets the J3 suit
// vest uses: style (No Lapel, Notch Lapel), buttons (5-Button,
// 6-Button, DB 6x3, Low 5 Button), pocket type (Welt, Double
// Besom), pocket number (2-Pocket, 4-Pocket) and back (Lining,
// Fabric). The legacy Front style pair (Five button, Six button)
// maps onto the button set and the monogram field leaves the
// aligned waistcoat, because the JPOS vest section of the style
// page carries no monogram. No waistcoat option price is attested
// anywhere in the JPOS evidence, so every aligned waistcoat option
// is unpriced in this package (plan input 1, the upcharge data,
// will price them), and the server never charges a waistcoat item
// from any retired table.
//
// The top coat scope resolved to no build: suits.me sells no coat
// kind (overcoats are a style on jacket kind products, so they
// already run the aligned jacket model built in J3), and section
// C.7 of the mapping records the JPOS coat evidence, a body style
// template and buttons only, as adds if a coat kind is ever
// created; building one here would be inventing a product line.
// Leather is a material on jacket kind products, not a kind, and
// its measurement set has no JPOS evidence (mapping section A.7
// leaves it on version 2); both are untouched here.
//
// Journey J6-1: an aligned waistcoat specified across the full JPOS
// vest groups carries every key into the bag, the bag line, bag
// Edit and checkout at the base price, client and server.
// Journey J6-2: an aligned waistcoat at the JPOS starting values
// prices at base, its stage 0 fit preference is retired, and
// re-entering the same design keeps the shopper's choices.
// Journey J6-3: a pre-alignment waistcoat item (front style in the
// closure slot, monogram text, nothing else) renders, restores in
// bag Edit and prices exactly as before, client and server.
// Journey J6-4: the product page entry also starts waistcoats on
// the aligned model, and switching to a suit leaks none of the
// waistcoat's choices into the suit design.
// Journey J6-5 (the rider): an aligned standalone trousers
// Personalize step renders each part exactly once (the general
// splice branch no longer also runs behind the aligned branch and
// duplicates the step tail), and a legacy trousers step still
// renders exactly once through the general branch.
function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
const readyProfile={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
const menProfile={id:'profile-men',name:'Men fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},created:'2026-10-27T00:00:00.000Z'};
function makeWorld(seed={}){
  const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  store.set('suits-profiles',JSON.stringify(seed.profiles||[readyProfile,menProfile]));
  if(seed.config)store.set('suits-config',JSON.stringify(seed.config));
  if(seed.bag)store.set('suits-bag',JSON.stringify(seed.bag));
  const sandbox={console,localStorage,location:{hash:'#home'},fetch:async()=>({ok:false,json:async()=>null}),crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',FormData:class{constructor(f){this.data=(f&&f._data)||{}}get(k){return k in this.data?this.data[k]:null}},document:{title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()},addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag,config:()=>JSON.parse(store.get('suits-config'))};
}
function bagCurrentWorld(w,profileId){w.run('stage=2;render(false)');w.elFor('#profileSelect').value=profileId;w.run('nextConfig()')}
function loadLib(rel){const ts=require('typescript'),Module=require('node:module'),path=require('node:path');const file=path.resolve(rel),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return m.exports}
class CommerceDB{constructor(){this.rows=[]}prepare(sql){const self=this;return{bind(...args){return{async first(){if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;return self.rows.find(r=>r.id===args[0])||null},async run(){if(sql.startsWith('INSERT')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}return{success:true}}}}}}}
const WAISTCOAT_V3_VALUES={height:70,chest:40,vestBackLength:24,halfWaist:17,opening:12};
const waistcoatV3=(over={})=>({version:3,origin:'web',method:'body',garment:'waistcoat',wearer:'Men',wearerName:'Alex Kumar',name:'J6 waistcoat',unit:'in',header:{profileType:'waistcoat',jposLinks:null},figure:{},provenance:null,values:{...WAISTCOAT_V3_VALUES},...over});
const WAISTCOAT_SPEC={vestStyle:'Notch Lapel',vestButtons:'DB 6x3',vestPocketType:'Double Besom',vestPocketNumber:'4-Pocket',vestBack:'Fabric'};

(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  global.fetch=async(_url,init)=>{const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});throw Error('Unexpected network request')};
  const catalog=require('../lib/catalog.json');
  const vestIdx=catalog.findIndex(p=>p.kind==='waistcoat'),vest=catalog[vestIdx];
  assert.ok(vestIdx>=0&&vest.priceCents===14900,'the server catalog holds the $149 waistcoat');
  assert.ok(!catalog.some(p=>p.kind==='coat'||p.kind==='leather-jacket'),'the catalog holds no coat or leather kind: the coat scope has no product surface of its own, per mapping section C.7');
  assert.ok(catalog.filter(p=>p.name.includes('Overcoat')).every(p=>p.kind==='jacket'),'overcoats are jacket kind products, already on the aligned jacket model from J3');
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const checkout=async item=>{const res=await commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-j6','Idempotency-Key':'j6-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify({items:[item],shipping})}),cenv);const body=await res.json();return{status:res.status,totalCents:body.totalCents,stored:res.status===200?JSON.parse(cdb.rows.at(-1).items)[0]:null}};

  // ---------------------------------------------------------- J6-1
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='waistcoat')");
    w.run(`beginDesign(${idx})`);
    assert.equal(w.config().optionModel,3,'a new waistcoat design carries the aligned model marker');
    w.run('stage=1');
    const html=w.run('customize()');
    for(const title of ['Vest style','Vest buttons','Vest pocket style','Vest pockets','Vest back'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`the aligned step offers the ${title} group`);
    assert.ok(html.includes('<span>Vest buttons</span><span class="subtle">5 buttons</span>'),'the buttons header states the starting selection in buyer words (J8 plain language pass; the stored value keeps the JPOS spelling)');
    assert.ok(html.includes('data-visual="vestButtons:DB 6x3"')&&html.includes('data-visual="vestStyle:Notch Lapel"')&&html.includes('data-visual="vestBack:Fabric"'),'every aligned value carries its visual key for J8');
    assert.ok(html.includes('Double besom pockets · Included'),'the pocket type shows its buyer language label as included, unpriced');
    assert.ok(!html.includes('Five button')&&!html.includes('Six button'),'the retired Front style pair is not offered on an aligned design');
    assert.equal(html.split('<label class="field">Monogram').length-1,0,'the aligned waistcoat step carries no monogram field: the JPOS vest section has none');
    assert.equal(html.split('Continue').length-1,1,'the Personalize step renders once, with one Continue action');
    for(const [k,v] of Object.entries(WAISTCOAT_SPEC))w.run(`setOption('${k}','${v}')`);
    assert.equal(w.run('optionCharge(config)'),0,'no aligned waistcoat option is charged on the client');
    assert.equal(w.run('itemPrice(config)'),149,'the fully specified aligned waistcoat prices at base');
    const specified=w.run('customize()');
    assert.ok(specified.includes('<span>Vest buttons</span><span class="subtle">Double breasted, 6 by 3</span>'),'the buttons header follows the chosen buttons, in buyer words (J8 plain language pass)');
    assert.ok(specified.includes('<span>Vest back</span><span class="subtle">Fabric back</span>'),'the back header states the fabric back in buyer words');
    bagCurrentWorld(w,'profile-men');
    assert.equal(w.bag().length,1,'the configured waistcoat is bagged');
    const item=w.bag()[0];
    for(const [k,v] of Object.entries(WAISTCOAT_SPEC))assert.equal(item[k],v,`the bagged item stores ${k}`);
    assert.equal(item.optionModel,3,'the bagged item carries the aligned model marker');
    assert.equal(w.run('lineDescription(bag[0])'),'Brown · Notch Lapel · DB 6x3 · Double besom pockets · 4-Pocket · Fabric back · Tonal lining','the bag line reads the full waistcoat specification');
    assert.equal(w.run('subtotal()'),149,'the subtotal is the base price');
    w.run("location.hash='#checkout'");
    const checkoutHtml=w.run('checkoutPage()');
    assert.ok(checkoutHtml.includes('Double besom pockets')&&checkoutHtml.includes('Fabric back')&&checkoutHtml.includes('$149'),'the checkout shows the waistcoat specification and the $149 total');
    // Bag Edit restores every aligned key and saves in place.
    w.run(`editBagItem('${item.id}')`);
    const restored=w.config();
    for(const [k,v] of Object.entries(WAISTCOAT_SPEC))assert.equal(restored[k],v,`bag Edit restores ${k}`);
    assert.ok(!('fit' in restored),'the aligned waistcoat edit session carries no fit slot');
    w.run("setOption('vestPocketNumber','2-Pocket');stage=2;render(false)");
    w.elFor('#profileSelect').value='profile-men';
    w.run('nextConfig()');
    assert.equal(w.bag().length,1,'saving the waistcoat edit adds no new line');
    assert.equal(w.bag()[0].vestPocketNumber,'2-Pocket','the edited line carries the new pocket count');
    assert.equal(w.bag()[0].vestButtons,'DB 6x3','the edited line keeps its buttons');
    assert.equal(w.run('subtotal()'),149,'the edited waistcoat still prices at base');
    // Server: the same specification stores at base with every
    // aligned key persisted, and retired values smuggled onto the
    // item (the legacy suit vest fields among them) never charged.
    const posted={product:vestIdx,fabric:'Brown',lapel:'',closure:'Five button',fit:'Tailored',lining:'Tonal',monogram:'',optionModel:3,...WAISTCOAT_SPEC,profile:waistcoatV3()};
    const clean=await checkout(posted);
    assert.equal(clean.status,200,'the aligned waistcoat checkout succeeds');
    assert.equal(clean.totalCents,14900,'the server total is the base price: nothing is priced in the aligned waistcoat model');
    assert.equal(clean.stored.priceCents,14900,'the stored item price is the base price');
    for(const [k,v] of Object.entries(WAISTCOAT_SPEC))assert.equal(clean.stored[k],v,`the order item persists ${k}`);
    const poisoned=await checkout({...posted,vest:'Classic vest',vestFabricBack:'Fabric back',tier:'Make it a tuxedo',squareAndTie:'Yes',monogram:'AK',lining:'Italian jazz royale'});
    assert.equal(poisoned.totalCents,14900,'retired values on an aligned waistcoat are never charged by the server');
    console.log('J6-1 passed: an aligned waistcoat specified across the full JPOS vest groups carries every key into the bag, bag Edit and checkout at the base price, on client and server.');
  }

  // ---------------------------------------------------------- J6-2
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='waistcoat')");
    w.run(`beginDesign(${idx})`);
    const stage0=w.run('customize()');
    assert.ok(!stage0.includes('Your fit preference'),'the aligned waistcoat fabric step offers no fit preference: the shared step is removed under full alignment');
    assert.deepEqual(JSON.parse(JSON.stringify(w.run('alignedWaistcoatDefaults()'))),{vestStyle:'No Lapel',vestButtons:'5-Button',vestPocketType:'Welt',vestPocketNumber:'2-Pocket',vestBack:'Lining'},'a new waistcoat starts at the JPOS starting values, the legacy Five button kept as the 5-Button');
    assert.equal(w.run('itemPrice(config)'),149,'an aligned waistcoat at the starting values prices at base');
    w.run("setOption('vestButtons','6-Button')");
    w.run(`beginDesign(${idx})`);
    assert.equal(w.config().vestButtons,'6-Button','re-entering the same waistcoat design keeps the shopper\u2019s choices, as the other kinds do');
    assert.equal(w.config().optionModel,3,'the re-entered design stays on the aligned model');
    bagCurrentWorld(w,'profile-men');
    assert.equal(w.run('lineDescription(bag[0])'),'Brown · No Lapel · 6-Button · Welt pockets · 2-Pocket · Lining back · Tonal lining','the bag line for a standard waistcoat names its full specification');
    assert.equal(w.run('subtotal()'),149,'the subtotal is the base price');
    const posted={product:vestIdx,fabric:'Brown',lapel:'',closure:'Five button',lining:'Tonal',monogram:'',optionModel:3,...JSON.parse(JSON.stringify(w.run('alignedWaistcoatDefaults()'))),profile:waistcoatV3()};
    const clean=await checkout(posted);
    assert.equal(clean.totalCents,14900,'the server prices a standard aligned waistcoat at base');
    assert.equal(clean.stored.vestButtons,'5-Button','the order item persists the starting buttons');
    console.log('J6-2 passed: an aligned waistcoat at the JPOS starting values prices at base on client and server, the fit preference step is retired, and design re-entry keeps the shopper\u2019s choices.');
  }

  // ---------------------------------------------------------- J6-3
  {
    const legacy={id:'legacy-waistcoat',product:null,fabric:'Brown',lapel:'',closure:'Six button',fit:'Tailored',lining:'Tonal',monogram:'JO',profile:JSON.parse(JSON.stringify(menProfile))};
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='waistcoat')");
    legacy.product=idx;
    const w2=makeWorld({bag:[legacy],config:{product:idx,fabric:'Brown',lapel:'',closure:'Six button',fit:'Tailored',lining:'Tonal',monogram:'JO'}});
    assert.equal(w2.run('lineDescription(bag[0])'),'Brown · Tailored fit · Six button · Tonal lining · Monogram JO','a legacy waistcoat line keeps its exact previous description');
    assert.equal(w2.run('optionCharge(bag[0])'),0,'a legacy waistcoat carries no option charge, as before');
    assert.equal(w2.run('itemPrice(bag[0])'),149,'a legacy waistcoat prices at the product base');
    const stage0=w2.run('customize()');
    assert.ok(stage0.includes('Your fit preference'),'a legacy waistcoat session keeps its fit preference step');
    w2.run(`editBagItem('legacy-waistcoat')`);
    w2.run('stage=1');
    const html=w2.run('customize()');
    assert.ok(html.includes('Front style')&&html.includes('Five button')&&html.includes('Six button'),'the legacy waistcoat Personalize step still offers its Front style pair');
    assert.ok(html.includes('<label class="field">Monogram'),'the legacy waistcoat Personalize step keeps its monogram field');
    assert.ok(!html.includes('vestButtons')&&!html.includes('Vest pockets'),'the legacy waistcoat Personalize step offers none of the aligned groups');
    bagCurrentWorld(w2,'profile-men');
    assert.deepEqual(w2.bag()[0],{...legacy,profileId:'profile-men'},'saving the legacy waistcoat edit changes nothing but the profileId every edit save records');
    const clean=await checkout({product:vestIdx,fabric:'Brown',lapel:'',closure:'Six button',fit:'Tailored',lining:'Tonal',monogram:'JO',profile:waistcoatV3()});
    assert.equal(clean.status,200,'the legacy waistcoat checkout succeeds');
    assert.equal(clean.totalCents,14900,'the server prices a legacy waistcoat at base, exactly as before');
    assert.equal(clean.stored.vestStyle,'','the stored legacy item carries no aligned vest style');
    assert.ok(!('optionModel' in clean.stored),'the stored legacy item carries no aligned model marker');
    console.log('J6-3 passed: a pre-alignment waistcoat item renders, restores in bag Edit and prices exactly as before, client and server.');
  }

  // ---------------------------------------------------------- J6-4
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='waistcoat')");
    w.run(`chooseProduct(${idx})`);
    assert.equal(w.config().optionModel,3,'starting a waistcoat from its product page lands on the aligned model');
    assert.equal(w.config().vestButtons,'5-Button','the product page entry seeds the aligned waistcoat defaults');
    w.run(`beginDesign(${idx})`);
    w.run("setOption('vestButtons','DB 6x3')");
    w.run('beginDesign(0)');
    const suitConfig=w.config();
    assert.equal(suitConfig.vestButtons,'5-Button','switching to a suit starts the suit vest at its own default: the waistcoat choice does not follow the shopper');
    assert.equal(suitConfig.vestIncluded,'No','the suit design starts with no vest included, as before');
    assert.equal(suitConfig.lapelType,'Notch','the suit design starts from its own aligned defaults');
    console.log('J6-4 passed: the product page entry starts waistcoats on the aligned model, and a kind switch leaks none of the waistcoat\u2019s choices into the next design.');
  }

  // ---------------------------------------------------------- J6-5
  {
    // The rider: the stage 1 splices are sequential ifs, and for an
    // aligned standalone trousers design both the aligned branch and
    // the general branch used to run; the general branch then found
    // no Lapel title, spliced at -1, and duplicated the whole step
    // tail (a second monogram field, a second Continue). The general
    // branch is now guarded the way J5 guarded shirts.
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='pants')");
    w.run(`beginDesign(${idx})`);
    w.run('stage=1');
    const html=w.run('customize()');
    const count=s=>html.split(s).length-1;
    assert.equal(count('<span>Trouser front</span>'),1,'the aligned trousers step renders its front group once');
    assert.equal(count('<span>Side pockets</span>'),1,'the aligned trousers step renders its side pockets group once');
    assert.equal(count('<span>Tunnel belt loops</span>'),1,'the aligned trousers step renders its tunnel loops group once');
    assert.equal(count('<label class="field">Monogram'),1,'the aligned trousers step carries exactly one monogram field');
    assert.equal(count('Continue'),1,'the aligned trousers step renders once, with one Continue action');
    // A legacy standalone trousers session still renders its step
    // exactly once through the general branch.
    const legacyConfig={product:idx,fabric:'Navy',lapel:'',closure:'Flat front',fit:'Tailored',lining:'Tonal',monogram:''};
    const w2=makeWorld({config:legacyConfig});
    w2.run('stage=1');
    const legacyHtml=w2.run('customize()');
    const lcount=s=>legacyHtml.split(s).length-1;
    assert.equal(lcount('Trouser front'),1,'the legacy trousers step renders its front group once');
    assert.equal(lcount('<label class="field">Monogram'),1,'the legacy trousers step carries exactly one monogram field');
    assert.equal(lcount('Continue'),1,'the legacy trousers step renders once, with one Continue action');
    console.log('J6-5 passed: the aligned standalone trousers Personalize step renders each part exactly once, and the legacy trousers step still renders exactly once.');
  }

  console.log('JPOS J6 checks passed: the standalone waistcoat runs the JPOS vest field set shared with the in suit vest, unpriced, monogram removed, legacy waistcoats untouched, and the trousers step duplication is fixed.');
})().catch(e=>{console.error(e);process.exit(1)});
