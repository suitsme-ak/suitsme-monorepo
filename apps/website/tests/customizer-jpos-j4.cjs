const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// JPOS consistency wave, package J4: trousers alignment and the
// independent second pair (j0-mapping-design.md sections A.3, C.2,
// C.3, D and E; jpos-consistency-plan.md sections 3 and 5).
//
// Journey J4-1: an aligned suit with a fully specified trousers set
// carries every JPOS group into the bag and checkout at the base
// price: no JPOS trousers option price is attested in code, so every
// aligned trousers option is unpriced in this package (plan input 1,
// the upcharge extract, will price them), and the server never
// charges an aligned item from the retired trousers tables.
// Journey J4-2: a second pair of trousers carries its own style block
// (the JPOS Pants2 groups) and its own measurement set (the Pants2
// fields), collected in the measurement studio when a second pair is
// chosen, stored on the item and the order; turning it off removes
// both blocks cleanly.
// Journey J4-3: standalone trousers run the same aligned model, with
// the Trouser front entry carrying the pleats choice in the pleats
// slot, mirrored into the closure slot.
// Journey J4-4: a legacy suit with additional pants and retired
// trousers values restores and prices exactly as before, client and
// server.
// Journey J4-5: the dual model boundary: a J3 era design (aligned
// jacket, no trousers keys) still prices its trousers side from the
// legacy tables, on both sides of the wire.
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
const SUIT_V3_VALUES={height:70,weight:180,chest:40,chestOverArm:46,sleeveInseamL:18,sleeveInseamR:18,shoulder:18,jacketLength:29,jacketWaist:34,outseam:42,trouserWaist:34,seat:40,frontRise:11,thigh:24,inseam:32,rise:12,crotch:10};
const suitV3=(over={})=>({version:3,origin:'web',method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'J4 suit',unit:'in',fit:'Tailored',header:{profileType:'suit',jposLinks:null},figure:{},provenance:null,values:{...SUIT_V3_VALUES},...over});
const SECOND_PAIR_VALUES={trouserWaist:36,seat:41,thigh:25,inseam:33,outseam:43,rise:12,bottom:17,knee:19};

(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  global.fetch=async(_url,init)=>{const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});throw Error('Unexpected network request')};
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit'&&p.fabricCode),suit=catalog[suitIdx];
  const pantsIdx=catalog.findIndex(p=>p.kind==='pants'),pants=catalog[pantsIdx];
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const checkout=async item=>{const res=await commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-j4','Idempotency-Key':'j4-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify({items:[item],shipping})}),cenv);const body=await res.json();return{status:res.status,totalCents:body.totalCents,stored:res.status===200?JSON.parse(cdb.rows.at(-1).items)[0]:null}};
  const serverReady={name:'Test fit',method:'ready',ready:{jacket:'40',length:'Regular',trouser:'34'}};

  // ---------------------------------------------------------- J4-1
  {
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run('stage=1');
    const html=w.run('customize()');
    assert.ok(html.includes('<h3>Trousers</h3>'),'the Personalize step has a Trousers section');
    for(const title of ['Pleats','Side pockets','Back pocket style','Back pocket closure','Trouser cuff','Front tab','Leg break','Watch pocket','Suspender buttons','Elastic side tabs','Tunnel belt loops','Belt loops'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`the aligned step offers the ${title} group`);
    assert.ok(html.includes('<span>Pleats</span><span class="subtle">Flat front, no pleats</span>'),'the group header states the current pleats selection in buyer words');
    assert.ok(html.includes('data-visual="pleats:Flat Front"')&&html.includes('data-visual="sidePockets:Slanted"'),'every aligned value carries its visual key for J8');
    assert.ok(html.includes('<span>Second pair of trousers</span>'),'the second pair group is offered on a suit');
    for(const gone of ['Pants lining','Pocket style','Forward single pleat','Forward 2 pleats','Venice side tabs','Flap coin pocket','2 inch waistband','Additional pants'])assert.ok(!html.includes(gone),`the retired ${gone} is not offered on an aligned design`);
    w.run("setOption('pleats','Double Rvrs Pleat');setOption('sidePockets','Western');setOption('backPockets','Single Besom');setOption('backPocketClosure','Button Thru');setOption('trouserCuff','1-1/2 in');setOption('frontTab','Square Tab');setOption('legBreak','Full Break');setOption('watchPocket','Flap');setOption('suspenderButtons','Yes');setOption('elasticSideTabs','Side Buckle');setOption('tunnelBeltLoops','Yes');setOption('beltLoops','No')");
    assert.equal(w.run('optionCharge(config)'),0,'no aligned trousers choice charges anything');
    assert.equal(w.run('itemPrice(config)'),399,'the fully specified aligned suit prices at base');
    assert.ok(w.run('customize()').includes('data-visual="trouserCuff:1-1/2 in"'),'the chosen cuff carries its visual key');
    bagCurrentWorld(w,'p-ready');
    assert.equal(w.bag().length,1,'the configured suit is bagged');
    const item=w.bag()[0];
    for(const [k,v] of [['pleats','Double Rvrs Pleat'],['sidePockets','Western'],['backPockets','Single Besom'],['backPocketClosure','Button Thru'],['trouserCuff','1-1/2 in'],['frontTab','Square Tab'],['legBreak','Full Break'],['watchPocket','Flap'],['suspenderButtons','Yes'],['elasticSideTabs','Side Buckle'],['tunnelBeltLoops','Yes'],['beltLoops','No'],['optionModel',3]])assert.equal(item[k],v,`the bagged item stores ${k}`);
    assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel, Standard · 2-Button · Center vent · 4 cuff buttons · Flap waist pockets · Double reverse pleats · Western style pockets · Single besom back pocket with Button through closure · Cuff, 1-1/2 inch · Square tab · Full break, rests on the shoe · Flap watch pocket · Suspender buttons · Side buckle adjusters · Tunnel belt loops · No belt loops · Tonal lining','the bag line reads the full aligned trousers specification');
    assert.equal(w.run('subtotal()'),399,'the subtotal is the base price');
    w.run("location.hash='#checkout'");
    const checkoutHtml=w.run('checkoutPage()');
    assert.ok(checkoutHtml.includes('Double reverse pleats')&&checkoutHtml.includes('$399'),'the checkout shows the trousers specification at the base total');
    // Server: the same aligned item stores at base, and legacy priced
    // keys smuggled onto it are never charged.
    const posted={product:suitIdx,fabric:'Navy',lining:'Tonal',monogram:'',optionModel:3,closure:'2-Button',lapelType:'Notch',pleats:'Double Rvrs Pleat',sidePockets:'Western',backPockets:'Single Besom',backPocketClosure:'Button Thru',trouserCuff:'1-1/2 in',frontTab:'Square Tab',legBreak:'Full Break',watchPocket:'Flap',suspenderButtons:'Yes',elasticSideTabs:'Side Buckle',tunnelBeltLoops:'Yes',beltLoops:'No',secondPairPants:'No',profile:serverReady};
    const clean=await checkout(posted);
    assert.equal(clean.status,200,'the aligned checkout succeeds');
    assert.equal(clean.totalCents,suit.priceCents,'the server total is the base price for the aligned item');
    assert.equal(clean.stored.sidePockets,'Western','the order item persists the side pockets');
    assert.equal(clean.stored.trouserCuff,'1-1/2 in','the order item persists the cuff');
    assert.equal(clean.stored.backPocketClosure,'Button Thru','the order item persists the back pocket closure');
    assert.equal(clean.stored.priceCents,suit.priceCents,'the stored item price is the base price');
    const poisoned=await checkout({...posted,pantsLining:'Front and back lining',additionalPants:'Yes',sideTabs:'Venice side tabs',coinPocket:'Yes',pantsCuff:'Yes'});
    assert.equal(poisoned.totalCents,suit.priceCents,'retired trousers values on an aligned item are never charged by the server');
    console.log('J4-1 passed: an aligned suit with a fully specified trousers set carries every JPOS group through the bag and checkout at the base price, and the server stores it at base even with retired values attached.');
  }

  // ---------------------------------------------------------- J4-2
  {
    const w=makeWorld();
    w.run('beginDesign(0)');
    w.run('stage=1');
    w.run("setOption('secondPairPants','Yes')");
    assert.deepEqual(w.run('config.pants2'),w.run('alignedSecondPairDefaults()'),'choosing a second pair seeds its own style block at the standards');
    const html=w.run('customize()');
    assert.ok(html.includes('<h3>Second pair style</h3>'),'the second pair style groups render once a pair is chosen');
    assert.ok(html.includes('data-visual="pants2.pleats:Flat Front"'),'the second pair values carry their own visual keys');
    w.run("setPants2Option('pleats','Single Rvrs Pleat');setPants2Option('sidePockets','On-Seam');setPants2Option('trouserCuff','2 in')");
    assert.equal(w.run('config.pleats'),'Flat Front','the first pair keeps its own pleats while the second pair is styled');
    assert.equal(w.run('config.pants2.pleats'),'Single Rvrs Pleat','the second pair stores its own pleats');
    assert.equal(w.run('itemPrice(config)'),399,'the second pair adds nothing to the price in this package');
    w.run('nextConfig()'); // stage 2, Measurements
    w.run('startMeasurements()');
    assert.equal(w.run('garmentSteps().map(s=>s.key).join(",")'),'method,preamble,fields,fields,secondPair,review','the studio adds a second pair step for a suit design carrying a pair');
    w.run(`draft.wearerName='Alex Kumar';draft.name='J4 suit';draft.values=${JSON.stringify(SUIT_V3_VALUES)};draft.secondPairValues=${JSON.stringify(SECOND_PAIR_VALUES)};saveDraft()`);
    w.run('measureNext()');w.run('measureNext()');w.run('measureNext()');w.run('measureNext()');
    assert.equal(w.run('draft.step'),4,'the studio reaches the second pair step');
    const spHtml=w.run('measure()');
    assert.ok(spHtml.includes('Your second pair of trousers.')&&spHtml.includes('measureInput-sp-trouserWaist'),'the second pair step collects its own fields');
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),5,'the second pair step advances to review');
    assert.ok(w.run('measure()').includes('Second pair of trousers'),'the review names the second pair measurements');
    w.elFor('#confirmMeasures').checked=true;
    w.run('measureNext()');
    const profileId=w.run('profiles.at(-1).id');
    assert.deepEqual(JSON.parse(w.run('JSON.stringify(profiles.at(-1).secondPair)')),SECOND_PAIR_VALUES,'the saved profile carries the second pair measurements');
    w.elFor('#profileSelect').value=profileId;
    w.run('nextConfig()');
    assert.equal(w.bag().length,1,'the suit with a second pair is bagged');
    const item=w.bag()[0];
    assert.equal(item.secondPairPants,'Yes','the bagged item records the second pair');
    assert.equal(item.pants2.pleats,'Single Rvrs Pleat','the bagged item carries the second pair style block');
    assert.equal(item.pants2.trouserCuff,'2 in','the bagged item carries the second pair cuff');
    assert.deepEqual(item.profile.secondPair,SECOND_PAIR_VALUES,'the bagged item carries the second pair measurements on its profile');
    assert.ok(w.run('lineDescription(bag[0])').includes('Second pair: Single reverse pleat, On-seam pockets, Cuff, 2 inch, Medium break'),'the bag line names the second pair and its differing style');
    assert.ok(w.run('profileSummary(bag[0])').includes('Second pair:'),'the profile summary names the second pair measurements');
    assert.equal(w.run('subtotal()'),399,'the bag total stays at base with a second pair');
    // Turning the pair off in bag Edit removes both blocks cleanly.
    w.run(`editBagItem('${item.id}')`);
    assert.equal(w.run('config.secondPairPants'),'Yes','bag Edit restores the second pair choice');
    assert.equal(w.run('config.pants2.pleats'),'Single Rvrs Pleat','bag Edit restores the second pair style');
    w.run("setOption('secondPairPants','No')");
    assert.ok(!('pants2' in w.config()),'turning the pair off drops the style block from the design');
    w.run('stage=2;render(false)');
    w.elFor('#profileSelect').value=profileId;
    w.run('nextConfig()');
    assert.equal(w.bag().length,1,'saving the edit adds no new line');
    assert.ok(!('pants2' in w.bag()[0]),'the edited item carries no second pair style block');
    assert.ok(!('secondPair' in w.bag()[0].profile),'the edited item carries no second pair measurements');
    assert.equal(w.run('subtotal()'),399,'the total is unchanged after removing the pair');
    // Server: the pair's style and measurements land on the order,
    // cleaned to the Pants2 keys only.
    const posted={product:suitIdx,fabric:'Navy',lining:'Tonal',monogram:'',optionModel:3,closure:'2-Button',pleats:'Flat Front',sidePockets:'Slanted',secondPairPants:'Yes',pants2:{pleats:'Single Rvrs Pleat',sidePockets:'On-Seam',trouserCuff:'2 in',backPockets:'Patch',unknownKey:'x'},profile:suitV3({secondPair:{...SECOND_PAIR_VALUES}})};
    const res=await checkout(posted);
    assert.equal(res.status,200,'the second pair checkout succeeds');
    assert.equal(res.totalCents,suit.priceCents,'the second pair order totals at base');
    assert.deepEqual(res.stored.pants2,{pleats:'Single Rvrs Pleat',sidePockets:'On-Seam',trouserCuff:'2 in'},'the order item persists the second pair style block, Pants2 keys only (no back pocket style column exists)');
    assert.deepEqual(res.stored.profile.secondPair,SECOND_PAIR_VALUES,'the order profile persists the second pair measurements');
    console.log('J4-2 passed: a second pair carries its own style block and its own measurement set from the Personalize step through the studio into the bag and the order, and turning it off removes both blocks cleanly.');
  }

  // ---------------------------------------------------------- J4-3
  {
    const w=makeWorld();
    const idx=w.run("products.findIndex(p=>p.kind==='pants'&&p.category==='Trousers')");
    assert.ok(idx>=0,'the catalog holds standalone trousers');
    const base=w.run(`products[${idx}].price`),color=w.run(`products[${idx}].color`);
    w.run(`beginDesign(${idx})`);
    assert.equal(w.run('config.pleats'),'Flat Front','standalone trousers start at the Flat Front standard in the pleats slot');
    assert.equal(w.run('config.closure'),'Flat Front','the closure slot mirrors the front standard');
    w.run('stage=1');
    const html=w.run('customize()');
    assert.ok(html.includes('<div class="option-title"><span>Trouser front</span><span class="subtle">Flat front, no pleats</span></div>'),'the Trouser front entry heads the standalone step, stating its selection');
    assert.ok(!html.includes('<div class="option-title"><span>Pleats</span>'),'standalone trousers have no separate Pleats group; the front entry carries it');
    for(const title of ['Side pockets','Back pocket style','Trouser cuff','Belt loops'])assert.ok(html.includes(`<div class="option-title"><span>${title}</span>`),`standalone trousers offer the ${title} group`);
    assert.ok(!html.includes('Second pair'),'standalone trousers offer no second pair group');
    w.run("setOption('pleats','Double Rvrs Pleat');setOption('watchPocket','Patch')");
    assert.equal(w.run('config.closure'),'Double Rvrs Pleat','choosing a front mirrors it into the closure slot');
    bagCurrentWorld(w,'profile-men');
    const item=w.bag()[0];
    assert.equal(item.pleats,'Double Rvrs Pleat','the bagged trousers store the front in the pleats slot');
    assert.equal(item.closure,'Double Rvrs Pleat','the bagged trousers mirror the front in the closure slot');
    assert.equal(item.watchPocket,'Patch','the bagged trousers store the watch pocket');
    assert.equal(item.optionModel,3,'the bagged trousers carry the aligned marker');
    assert.equal(w.run('lineDescription(bag[0])'),`${color} · Double reverse pleats · Slanted pockets · Double besom back pockets · Medium break · Patch watch pocket · Belt loops · Tonal lining`,'the trousers bag line reads the aligned specification');
    assert.equal(w.run('subtotal()'),base,'the trousers total is the base price');
    const res=await checkout({product:pantsIdx,fabric:'Wool',lining:'',monogram:'',optionModel:3,pleats:'Double Rvrs Pleat',sidePockets:'Slanted',watchPocket:'Patch',profile:serverReady});
    assert.equal(res.status,200,'the aligned trousers checkout succeeds');
    assert.equal(res.totalCents,pants.priceCents,'the server totals the aligned trousers at base');
    assert.equal(res.stored.watchPocket,'Patch','the order item persists the watch pocket');
    console.log('J4-3 passed: standalone trousers run the aligned model under the Trouser front entry, the front choice living in the pleats slot mirrored to closure, into the bag and the order at base.');
  }

  // ---------------------------------------------------------- J4-4
  {
    const legacy={id:'legacy-j4',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',pantsLining:'Front and back lining',pocketStyle:'Seam',pleats:'Forward 2 pleats',backPockets:'2 flap pockets',beltLoops:'No',pantsCuff:'Yes',suspenderButtons:'Yes',coinPocket:'Yes',wideWaistband:'Yes',sideTabs:'Venice side tabs',additionalPants:'Yes',profile:JSON.parse(JSON.stringify(menProfile))};
    const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''}});
    assert.equal(w.run('optionCharge(bag[0])'),187,'the legacy suit charges every retired trousers value plus additional pants (10+5+5+2+5+20+140)');
    assert.equal(w.run('itemPrice(bag[0])'),586,'the legacy suit prices at base plus $187');
    assert.equal(w.run('lineDescription(bag[0])'),'Navy · Notch lapel · Tailored fit · Two button · Front and back lining · Seam · Forward 2 pleats · 2 flap pockets · No belt loops · Pants cuff · Suspender buttons · Flap coin pocket · 2 inch waistband · Venice side tabs · Tonal lining · Additional pants','the legacy line keeps its exact description');
    w.run("editBagItem('legacy-j4')");
    for(const k of ['pantsLining','pocketStyle','pleats','backPockets','beltLoops','pantsCuff','suspenderButtons','coinPocket','wideWaistband','sideTabs','additionalPants'])assert.equal(w.config()[k],legacy[k],`bag Edit restores the legacy ${k}`);
    w.run('stage=1');
    assert.ok(w.run('customize()').includes('<h3>Trouser details</h3>'),'the legacy edit session renders the legacy Trouser details');
    bagCurrentWorld(w,'profile-men');
    assert.deepEqual(w.bag()[0],{...legacy,profileId:'profile-men'},'saving the legacy edit changes nothing but the recorded profileId');
    assert.equal(w.run('subtotal()'),586,'the legacy total survives the edit cycle');
    const res=await checkout({product:suitIdx,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',pantsLining:'Front and back lining',pocketStyle:'Seam',pleats:'Forward 2 pleats',backPockets:'2 flap pockets',beltLoops:'No',pantsCuff:'Yes',suspenderButtons:'Yes',coinPocket:'Yes',wideWaistband:'Yes',sideTabs:'Venice side tabs',additionalPants:'Yes',profile:serverReady});
    assert.equal(res.status,200,'the legacy checkout succeeds');
    assert.equal(res.totalCents,suit.priceCents+18700,'the server totals the legacy suit at base plus $187');
    assert.equal(res.stored.additionalPants,'Yes','the order item persists additional pants');
    assert.equal(res.stored.priceCents,suit.priceCents+18700,'the stored legacy item price carries every modifier');
    console.log('J4-4 passed: a legacy suit with additional pants and retired trousers values renders, restores, edits and prices exactly as before, on the client and the server.');
  }

  // ---------------------------------------------------------- J4-5
  {
    const w=makeWorld();
    w.run("config={product:0,fabric:'Navy',lining:'Tonal',monogram:'',...alignedOptionDefaults()};saveConfig()");
    w.run("setOption('underCollarFabric','Milanese Single Color');setOption('pantsLining','Front and back lining');setOption('additionalPants','Yes')");
    assert.equal(w.run('optionCharge(config)'),175,'a J3 era design (aligned jacket, legacy trousers side) prices its trousers side from the legacy tables (25+10+140)');
    bagCurrentWorld(w,'p-ready');
    assert.equal(w.run('subtotal()'),574,'the transitional suit totals at base plus $175');
    const res=await checkout({product:suitIdx,fabric:'Wool',lining:'Tonal',monogram:'',optionModel:3,underCollarFabric:'Milanese Single Color',pantsLining:'Front and back lining',additionalPants:'Yes',profile:serverReady});
    assert.equal(res.totalCents,suit.priceCents+17500,'the server mirrors the transitional split exactly');
    console.log('J4-5 passed: the dual model boundary holds: a J3 era design with no trousers keys keeps its legacy trousers pricing on both sides, while aligned trousers keys switch the trousers side off the retired tables entirely.');
  }

  console.log('JPOS J4 checks passed: trousers run the aligned JPOS groups on suits and standalone trousers, the second pair is independent in style and measurements, and legacy items are untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
