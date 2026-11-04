const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// JPOS consistency wave, package J5: shirt alignment (plan section 3
// shirts, section 5 shirt removals, and j0-mapping-design.md section
// C.4). A new shirt design runs on the aligned model: the JPOS shirt
// specification on the Personalize step (body style, front style,
// collar type and height, sleeve style, nine cuff styles, back
// style, pocket style and position as separate groups, the numbered
// button colors and mother of pearl variants, button hole thread,
// monogram placement and font, collar and cuff stitching and its
// thread color), with buyer language labels first, the current
// selection stated in every group header, and a data-visual key on
// every value for J8.
//
// Journey J5-1: an aligned shirt specified across the full JPOS
// groups carries every key into the bag, the bag line, bag Edit and
// checkout, priced at base plus $10 for the hidden placket, the
// only JPOS shirt price attested in code. Every other aligned shirt
// option is unpriced in this package (plan input 1, the
// upcharge_shirts data, will price them), and the server never
// charges an aligned shirt from any retired table.
// Journey J5-2: an aligned shirt at the JPOS starting values prices
// at base on client and server, with the stage 0 fit preference
// retired (the style page body style does that work, as in JPOS).
// Journey J5-3: a pre-alignment shirt item (collar in the closure
// slot, monogram text, nothing else) renders, restores in bag Edit
// and prices exactly as before, client and server.
// Journey J5-4: the product page entry also starts shirts on the
// aligned model, and switching to another garment leaks no shirt
// keys into the new design.
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
const SHIRT_V3_VALUES={height:70,neck:15.5,chest:40,sleeve:25,shoulder:18,backLength:30,bicep:13,cuffSize:8,waist:34,sweep:42};
const shirtV3=(over={})=>({version:3,origin:'web',method:'body',garment:'shirt',wearer:'Men',wearerName:'Alex Kumar',name:'J5 shirt',unit:'in',header:{profileType:'shirt',jposLinks:null},figure:{},provenance:null,values:{...SHIRT_V3_VALUES},...over});
const SHIRT_SPEC={shirtBodyStyle:'Slim',shirtFrontStyle:'Hidden Placket',shirtCollarType:'Cut away',shirtCollarHeight:'High',shirtSleeveStyle:'Straight',shirtCuffStyle:'French Mitered',shirtBackStyle:'Center Pleat',shirtPocketStyle:'V-Shaped',shirtPocketPosition:'Left',shirtButtons:'Mop1white',shirtButtonHoleThread:'Match',shirtMonogramPlacement:'Left Cuff',shirtMonogramFont:'Script',shirtStitching:'1/16 Edge Stitch',shirtThreadColor:'Match'};

(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  global.fetch=async(_url,init)=>{const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});throw Error('Unexpected network request')};
  const catalog=require('../lib/catalog.json');
  const shirtIdx=catalog.findIndex(p=>p.kind==='shirt'),shirt=catalog[shirtIdx];
  assert.ok(shirtIdx>=0&&shirt.priceCents===9900,'the server catalog holds the $99 shirt');
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const checkout=async item=>{const res=await commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-j5','Idempotency-Key':'j5-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify({items:[item],shipping})}),cenv);const body=await res.json();return{status:res.status,totalCents:body.totalCents,stored:res.status===200?JSON.parse(cdb.rows.at(-1).items)[0]:null}};

  // ---------------------------------------------------------- J5-1
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='shirt')");
    w.run(`beginDesign(${idx})`);
    assert.equal(w.config().optionModel,3,'a new shirt design carries the aligned model marker');
    w.run('stage=1');
    const html=w.run('customize()');
    for(const title of ['Body style','Front style','Collar','Collar height','Sleeve style','Cuff style','Back style','Pocket style','Pocket position','Buttons','Button hole thread','Monogram placement','Monogram font','Collar and cuff stitching','Stitching thread color'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`the aligned step offers the ${title} group`);
    assert.ok(html.includes('<span>Collar</span><span class="subtle">Spread collar</span>'),'the collar header states the starting selection in buyer words');
    assert.ok(html.includes('data-visual="shirtFrontStyle:Hidden Placket"')&&html.includes('data-visual="shirtCuffStyle:French Mitered"')&&html.includes('data-visual="shirtButtons:Mop1white"')&&html.includes('data-visual="shirtMonogramFont:Old English"'),'every aligned value carries its visual key for J8');
    assert.ok(html.includes('Hidden placket, buttons covered · +$10'),'the hidden placket button shows its attested price');
    assert.ok(html.includes('Standard placket front · Included'),'the standard placket shows as included');
    assert.ok(!html.includes('Point collar'),'the retired Point collar is not offered on an aligned design');
    assert.equal(html.split('<label class="field">Monogram ').length-1,1,'the Personalize step carries exactly one monogram field');
    assert.equal(html.split('Continue').length-1,1,'the Personalize step renders once, with one Continue action');
    for(const [k,v] of Object.entries(SHIRT_SPEC))w.run(`setOption('${k}','${v}')`);
    w.run("config.monogram='AK';saveConfig()");
    assert.equal(w.run('optionCharge(config)'),10,'the hidden placket is the only aligned shirt charge');
    assert.equal(w.run('itemPrice(config)'),109,'the fully specified aligned shirt prices at base plus $10');
    const specified=w.run('customize()');
    assert.ok(specified.includes('<span>Collar</span><span class="subtle">Cutaway collar</span>'),'the collar header follows the chosen collar in buyer words');
    assert.ok(specified.includes('<span>Collar height</span><span class="subtle">High, 1 7/8 in</span>'),'the collar height header states the height with its inches');
    bagCurrentWorld(w,'profile-men');
    assert.equal(w.bag().length,1,'the configured shirt is bagged');
    const item=w.bag()[0];
    for(const [k,v] of Object.entries(SHIRT_SPEC))assert.equal(item[k],v,`the bagged item stores ${k}`);
    assert.equal(item.optionModel,3,'the bagged item carries the aligned model marker');
    assert.equal(item.monogram,'AK','the bagged item stores the monogram text');
    assert.equal(w.run('lineDescription(bag[0])'),'Blue · Slim fit · Cutaway collar · High, 1 7/8 in · Hidden placket, buttons covered · Straight sleeve · French cuff, angled (mitered) · Center pleat · V-shaped pocket · Pocket left chest · Mother of pearl, white buttons · Edge stitch, 1/16 in from the edge · Match the shirt stitching thread · Monogram AK, Left cuff, Script font','the bag line reads the full shirt specification, monogram placement and font included');
    assert.equal(w.run('subtotal()'),109,'the subtotal is base plus the hidden placket');
    w.run("location.hash='#checkout'");
    const checkoutHtml=w.run('checkoutPage()');
    assert.ok(checkoutHtml.includes('Hidden placket, buttons covered')&&checkoutHtml.includes('Monogram AK, Left cuff, Script font')&&checkoutHtml.includes('$109'),'the checkout shows the shirt specification and the $109 total');
    // Bag Edit restores every aligned key and saves in place.
    w.run(`editBagItem('${item.id}')`);
    const restored=w.config();
    for(const [k,v] of Object.entries(SHIRT_SPEC))assert.equal(restored[k],v,`bag Edit restores ${k}`);
    assert.equal(restored.monogram,'AK','bag Edit restores the monogram text');
    assert.ok(!('fit' in restored),'the aligned shirt edit session carries no fit slot: the body style does that work');
    w.run("setOption('shirtCuffStyle','2Button Square');stage=2;render(false)");
    w.elFor('#profileSelect').value='profile-men';
    w.run('nextConfig()');
    assert.equal(w.bag().length,1,'saving the shirt edit adds no new line');
    assert.equal(w.bag()[0].shirtCuffStyle,'2Button Square','the edited line carries the new cuff');
    assert.equal(w.bag()[0].shirtFrontStyle,'Hidden Placket','the edited line keeps the hidden placket');
    assert.equal(w.run('subtotal()'),109,'the edited shirt still prices at base plus $10');
    // Server: the same specification stores at base plus $10, with
    // every aligned key, the monogram placement and font persisted,
    // and retired values smuggled onto the item never charged.
    const posted={product:shirtIdx,fabric:'Blue',lapel:'',closure:'Spread collar',fit:'Tailored',lining:'Tonal',monogram:'AK',optionModel:3,...SHIRT_SPEC,profile:shirtV3()};
    const clean=await checkout(posted);
    assert.equal(clean.status,200,'the aligned shirt checkout succeeds');
    assert.equal(clean.totalCents,10900,'the server total is base plus the $10 hidden placket');
    assert.equal(clean.stored.priceCents,10900,'the stored item price is base plus $10');
    for(const [k,v] of Object.entries(SHIRT_SPEC))assert.equal(clean.stored[k],v,`the order item persists ${k}`);
    assert.equal(clean.stored.monogram,'AK','the order item persists the monogram text');
    const plain=await checkout({...posted,shirtFrontStyle:'Placket'});
    assert.equal(plain.totalCents,9900,'the same specification without the hidden placket totals the base price');
    const poisoned=await checkout({...posted,lapel:'Peak',lining:'Italian jazz royale',squareAndTie:'Yes',milaneseButtonhole:'Yes',pantsLining:'Front and back lining',sideTabs:'Venice side tabs'});
    assert.equal(poisoned.totalCents,10900,'retired values on an aligned shirt are never charged by the server');
    console.log('J5-1 passed: an aligned shirt specified across the full JPOS groups carries every key, its monogram placement and font, into the bag, bag Edit and checkout at base plus $10 for the hidden placket only, on client and server.');
  }

  // ---------------------------------------------------------- J5-2
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='shirt')");
    w.run(`beginDesign(${idx})`);
    const stage0=w.run('customize()');
    assert.ok(!stage0.includes('Your fit preference'),'the aligned shirt fabric step offers no fit preference: the body style group does that work');
    assert.deepEqual(JSON.parse(JSON.stringify(w.run('alignedShirtDefaults()'))),{shirtBodyStyle:'Regular',shirtFrontStyle:'Placket',shirtCollarType:'Spread',shirtCollarHeight:'Standard',shirtSleeveStyle:'Regular',shirtCuffStyle:'1Button Round',shirtBackStyle:'Side Pleat',shirtPocketStyle:'No Pocket',shirtPocketPosition:'None',shirtButtons:'Match',shirtButtonHoleThread:'Match',shirtMonogramPlacement:'No',shirtMonogramFont:'None',shirtStitching:'1/4 Normal Stitch',shirtThreadColor:'None'},'a new shirt starts at the JPOS starting values, the collar at Spread');
    assert.equal(w.run('itemPrice(config)'),99,'an aligned shirt at the starting values prices at base');
    bagCurrentWorld(w,'profile-men');
    assert.equal(w.run('lineDescription(bag[0])'),'Blue · Spread collar · One button, rounded cuff','the bag line for a standard shirt names its collar and cuff');
    assert.equal(w.run('subtotal()'),99,'the subtotal is the base price');
    const posted={product:shirtIdx,fabric:'Blue',lapel:'',closure:'Spread collar',lining:'Tonal',monogram:'',optionModel:3,...JSON.parse(JSON.stringify(w.run('alignedShirtDefaults()'))),profile:shirtV3()};
    const clean=await checkout(posted);
    assert.equal(clean.totalCents,9900,'the server prices a standard aligned shirt at base');
    assert.equal(clean.stored.shirtCollarType,'Spread','the order item persists the Spread collar');
    console.log('J5-2 passed: an aligned shirt at the JPOS starting values prices at base on client and server, and the stage 0 fit preference is retired for aligned shirts.');
  }

  // ---------------------------------------------------------- J5-3
  {
    const legacy={id:'legacy-shirt',product:null,fabric:'Blue',lapel:'',closure:'Point collar',fit:'Relaxed',lining:'',monogram:'JO',profile:JSON.parse(JSON.stringify(menProfile))};
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='shirt')");
    legacy.product=idx;
    const w2=makeWorld({bag:[legacy],config:{product:idx,fabric:'Blue',lapel:'',closure:'Point collar',fit:'Relaxed',lining:'',monogram:'JO'}});
    assert.equal(w2.run('lineDescription(bag[0])'),'Blue · Relaxed fit · Point collar · Monogram JO','a legacy shirt line keeps its exact previous description');
    assert.equal(w2.run('optionCharge(bag[0])'),0,'a legacy shirt carries no option charge, as before');
    assert.equal(w2.run('itemPrice(bag[0])'),99,'a legacy shirt prices at the product base');
    const stage0=w2.run('customize()');
    assert.ok(stage0.includes('Your fit preference'),'a legacy shirt session keeps its fit preference step');
    w2.run(`editBagItem('legacy-shirt')`);
    w2.run('stage=1');
    const html=w2.run('customize()');
    assert.ok(html.includes('Spread collar')&&html.includes('Point collar'),'the legacy shirt Personalize step still offers its collar pair');
    assert.ok(!html.includes('shirtCollarType')&&!html.includes('Cuff style'),'the legacy shirt Personalize step offers none of the aligned groups');
    bagCurrentWorld(w2,'profile-men');
    assert.deepEqual(w2.bag()[0],{...legacy,profileId:'profile-men'},'saving the legacy shirt edit changes nothing but the profileId every edit save records');
    const clean=await checkout({product:shirtIdx,fabric:'Blue',lapel:'',closure:'Point collar',fit:'Relaxed',lining:'',monogram:'JO',profile:shirtV3()});
    assert.equal(clean.status,200,'the legacy shirt checkout succeeds');
    assert.equal(clean.totalCents,9900,'the server prices a legacy shirt at base, exactly as before');
    assert.equal(clean.stored.shirtFrontStyle,'','the stored legacy item carries no aligned front style');
    assert.ok(!('optionModel' in clean.stored),'the stored legacy item carries no aligned model marker');
    console.log('J5-3 passed: a pre-alignment shirt item renders, restores in bag Edit and prices exactly as before, client and server.');
  }

  // ---------------------------------------------------------- J5-4
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='shirt')");
    w.run(`chooseProduct(${idx})`);
    assert.equal(w.config().optionModel,3,'starting a shirt from its product page lands on the aligned model');
    assert.equal(w.config().shirtCuffStyle,'1Button Round','the product page entry seeds the aligned shirt defaults');
    w.run('beginDesign(0)');
    const suitConfig=w.config();
    assert.ok(!('shirtCollarType' in suitConfig)&&!('shirtFrontStyle' in suitConfig),'switching to a suit leaks no shirt keys');
    assert.equal(suitConfig.lapelType,'Notch','the suit design starts from its own aligned defaults');
    console.log('J5-4 passed: the product page entry starts shirts on the aligned model, and a kind switch leaks no shirt keys into the next design.');
  }

  console.log('JPOS J5 shirt checks passed: the full JPOS shirt specification on the aligned model, hidden placket the only priced option, monogram placement and font carried through, and legacy shirts untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
