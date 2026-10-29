const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-07: customization and monogram state must not leak across products.
// The customizer draft is one browser wide object (suits-config), and
// beginDesign is the entry point every "Design yours" action funnels
// through: starting a different product must begin from that product's
// defaults, returning to the same product must resume the in progress
// design, and bag Edit must still restore the line's saved configuration.
// Drives the real storefront scripts in a vm with stubbed DOM and storage,
// in the style of the other suites.
function makeEl(){return{innerHTML:'',textContent:'',value:'',checked:false,open:false,classList:{add(){},remove(){},toggle(){return false}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),showModal(){this.open=true},close(){this.open=false},scrollIntoView(){}}}
const profile={id:'profile-1',name:'Test fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-10-27T00:00:00.000Z'};
function makeWorld(seedConfig){
  const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  store.set('suits-profiles',JSON.stringify([profile]));
  if(seedConfig)store.set('suits-config',JSON.stringify(seedConfig));
  const sandbox={console,localStorage,location:{hash:'#home'},fetch:async()=>({ok:false,json:async()=>null}),crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',FormData:class{constructor(f){this.data=(f&&f._data)||{}}get(k){return k in this.data?this.data[k]:null}},document:{title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()},addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const config=()=>JSON.parse(store.get('suits-config'));
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,config,bag};
}

// World 1: the interactive cross product path.
// Customize product 0 with distinctive options and a monogram, and bag it.
const w=makeWorld();
w.run('beginDesign(0)');
w.run(`setOption('fit','Slim');setOption('lapel','Peak');setOption('closure','One button');setOption('lining','Burgundy');config.monogram='AB';saveConfig()`);
assert.deepEqual(w.config(),{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB'},'product 0 design carries the chosen options');
w.run('stage=2;render(false)');
w.elFor('#profileSelect').value='profile-1';
w.run('nextConfig()');
assert.equal(w.bag().length,1,'the configured suit is bagged');
const suitLine=w.bag()[0];

// Open product 1 the way the live site does: card links set the product
// hash directly, then the shopper clicks Design on the product page.
w.run(`location.hash='#product/1';render()`);
w.run('beginDesign(1)');
assert.deepEqual(w.config(),{product:1,fabric:'Charcoal',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profileId:'profile-1'},'starting product 1 begins from defaults, not from product 0 options');
const freshHtml=w.run('stage=1;customize()');
assert.ok(!freshHtml.includes('AB'),'the monogram from product 0 is nowhere in the product 1 customizer');
assert.ok(freshHtml.includes(`class="choice active" aria-pressed="true" onclick="setOption('lining','Default')"`),'the Default lining choice is the active choice for product 1 (the stored Tonal default shows as Default since package 3.3)');
assert.ok(freshHtml.includes(`class="choice active" aria-pressed="true" onclick="setOption('lapel','Notch')"`),'the default lapel is the active choice for product 1');
assert.ok(!freshHtml.includes(`aria-pressed="true" onclick="setOption('lining','Burgundy')"`),'product 0 lining is not active for product 1');

// Bag product 1 as started: its line must carry the defaults, proving the
// leak cannot reach an order.
w.run('stage=2;render(false)');
w.elFor('#profileSelect').value='profile-1';
w.run('nextConfig()');
assert.equal(w.bag().length,2,'product 1 is bagged as a second line');
const secondLine=w.bag()[1];
assert.equal(secondLine.product,1);
assert.equal(secondLine.lapel,'Notch');assert.equal(secondLine.closure,'Two button');
assert.equal(secondLine.fit,'Tailored');assert.equal(secondLine.lining,'Tonal');
assert.equal(secondLine.monogram,'','the bagged product 1 line has no monogram from product 0');

// Returning to the same product resumes the in progress design.
w.run(`setOption('lining','Midnight');config.monogram='Q';saveConfig()`);
w.run(`location.hash='#product/1';render()`);
w.run('beginDesign(1)');
assert.equal(w.config().lining,'Midnight','reopening the same product keeps the in progress lining');
assert.equal(w.config().monogram,'Q','reopening the same product keeps the in progress monogram');

// A kind switch leaks nothing either: suit options and monogram must not
// follow the shopper into a shirt.
const shirt=w.run(`products.findIndex(p=>p.kind==='shirt')`);
w.run(`beginDesign(${shirt})`);
const shirtConfig=w.config();
assert.equal(shirtConfig.product,shirt);
assert.equal(shirtConfig.lapel,'','a shirt starts with no lapel');
assert.equal(shirtConfig.closure,'Spread collar','a shirt starts with its own default closure');
assert.equal(shirtConfig.lining,'Tonal','a shirt starts from the default lining');
assert.equal(shirtConfig.monogram,'','the suit monogram does not follow the shopper into a shirt');

// Bag Edit still restores the saved configuration of product 0 exactly,
// even though the current draft belongs to another product.
w.run(`editBagItem('${suitLine.id}')`);
assert.deepEqual(w.config(),{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB',profileId:'profile-1'},'bag Edit restores product 0 saved options and monogram');
w.run(`setOption('lining','Midnight');stage=2;render(false)`);
w.elFor('#profileSelect').value='profile-1';
w.run('nextConfig()');
const afterEdit=w.bag();
assert.equal(afterEdit.length,2,'saving the edit adds no new line');
assert.deepEqual(afterEdit[0],{...suitLine,lining:'Midnight'},'the edited line changes only the lining');
assert.deepEqual(afterEdit[1],secondLine,'the other line is untouched by the edit');

// World 2: a returning shopper whose browser holds a config for another
// product from an earlier session.
const w2=makeWorld({product:3,fabric:'Blue',lapel:'Shawl',closure:'One button',fit:'Relaxed',lining:'Midnight',monogram:'OLD'});
w2.run('beginDesign(1)');
assert.deepEqual(w2.config(),{product:1,fabric:'Charcoal',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''},'a persisted config for another product does not leak into a new design');
console.log('Customizer state checks passed: starting a different product (including a kind switch and a persisted config from an earlier session) begins from defaults with no options or monogram carried over, returning to the same product resumes the in progress design, and bag Edit still restores and saves the line configuration exactly.');
