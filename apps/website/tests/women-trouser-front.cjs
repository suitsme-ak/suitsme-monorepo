const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CUS-06: a women's suit includes trousers, and the trousers sold standalone
// offer a Trouser front choice (Flat front, Single pleat), but the suit
// Personalize step rendered no trouser group at all: the customizer has one
// shared closure slot, spent on the suit's Jacket closure, and complete.js
// only substitutes a garment group for pants, shirt and waistcoat kinds.
// The fix gives women's suits the same Trouser front group and choices in a
// slot of their own (config.trouserFront), preselected by beginDesign the
// way beginDesign preselects Flat front for standalone trousers, shown on
// the bag line, restored by bag edit, and persisted on the order item by
// the server sanitizer. Men's suits and every other garment must render and
// store exactly what they stored before.
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
function makeEl(){return{innerHTML:'',textContent:'',value:'',open:false,style:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){this.open=true},close(){this.open=false}}}
const elements=new Map();
const documentStub={title:'',querySelector(sel){if(!elements.has(sel))elements.set(sel,makeEl());return elements.get(sel)},getElementById(id){return documentStub.querySelector('#'+id)},addEventListener(){},createElement:()=>makeEl()};
class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
const womenProfile={id:'p-women',name:'Women body',method:'body',wearer:'Women',unit:'in',fit:'Tailored',values:{chest:36,waist:29,shoulder:15,sleeve:24,jacket:28,seat:38,trouserWaist:29,thigh:22,inseam:31,outseam:41},created:'2026-01-01T00:00:00.000Z'};
const menProfile={id:'p-men',name:'Men body',method:'body',wearer:'Men',unit:'in',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},created:'2026-01-01T00:00:00.000Z'};
localStorage.setItem('suits-profiles',JSON.stringify([womenProfile,menProfile]));
const ctx=vm.createContext({console,localStorage,document:documentStub,location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);'});
for(const f of ['app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx);
const bagState=()=>JSON.parse(store.get('suits-bag')||'[]');
const womenSuit=run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
const menSuit=run("products.findIndex(p=>p.category==='Suits'&&p.kind==='suit')");
const womenPants=run("products.findIndex(p=>p.category==='Women'&&p.kind==='pants')");
assert.ok(womenSuit>=0&&menSuit>=0&&womenPants>=0,'the seed catalog holds a Women suit, a Men suit and Women trousers');

// 1. The Women's suit Personalize step exposes the Trouser front group with
// the standalone trousers choices, in its own slot, alongside the jacket
// groups; beginDesign preselects Flat front, as it does for trousers.
run(`beginDesign(${womenSuit})`);
assert.equal(run('config.trouserFront'),'Flat front','beginDesign preselects Flat front for a Women suit, mirroring standalone trousers');
run('stage=1');
let html=run('customize()');
assert.ok(html.includes('<div class="option-title">Trouser front</div>'),'the Women suit Personalize step shows a Trouser front group');
assert.ok(html.includes("setOption('trouserFront','Flat front')")&&html.includes("setOption('trouserFront','Single pleat')"),'both trouser front choices are offered for the Women suit');
assert.ok(html.includes('<div class="option-title">Jacket closure</div>')&&html.includes("setOption('closure','Two button')"),'the jacket groups remain on the Women suit');
assert.ok(html.indexOf('Trouser front')>html.indexOf('Lining')&&html.indexOf('Trouser front')<html.indexOf('Monogram'),'the Trouser front group sits after Lining and before Monogram');

// 2. The two style slots are independent, and the trouser choice is stored
// on the configuration and carried into the bag and onto the bag line.
run("setOption('closure','One button')");
run("setOption('trouserFront','Single pleat')");
assert.equal(run('config.closure'),'One button','the jacket closure choice is stored in its own slot');
assert.equal(run('config.trouserFront'),'Single pleat','the trouser front choice is stored alongside it, not over it');
run('stage=2');
documentStub.querySelector('#profileSelect').value='p-women';
run('nextConfig()');
assert.equal(bagState().length,1,'the Women suit is bagged');
const womenItem=bagState()[0];
assert.equal(womenItem.trouserFront,'Single pleat','the bagged item stores the chosen trouser front');
assert.equal(womenItem.closure,'One button','the bagged item keeps the jacket closure as chosen');
assert.equal(run('lineDescription(bag[0])'),'Taupe · Notch lapel · Tailored fit · One button · Single pleat · Tonal lining','the bag line shows the trouser front with the other selections, in line order');
assert.ok(run('lineHtml(bag[0])').includes('Single pleat'),'the rendered bag line shows the trouser front');
assert.ok(run('checkoutPage()').includes('Single pleat'),'the checkout selection shows the trouser front');

// 3. Bag edit restores the trouser front and saving an edit changes only
// what the shopper changed.
const beforeEdit=JSON.parse(run('JSON.stringify(bag[0])'));
run(`editBagItem('${womenItem.id}')`);
assert.equal(run('config.trouserFront'),'Single pleat','editing the bag item restores its trouser front into the customizer');
run("setOption('trouserFront','Flat front')");
run('stage=2');
documentStub.querySelector('#profileSelect').value='p-women';
run('nextConfig()');
assert.equal(bagState().length,1,'saving the edit adds no duplicate line');
assert.deepEqual(bagState()[0],{...beforeEdit,trouserFront:'Flat front'},'only the trouser front changed on the edited Women suit line');

// 4. Men's suit behavior is unchanged: no Trouser front group, no
// trouserFront key stored, and the bag line reads exactly as before.
run(`beginDesign(${menSuit})`);
assert.equal(run('config.trouserFront'),undefined,'beginDesign sets no trouser front for a Men suit');
run('stage=1');
html=run('customize()');
assert.ok(!html.includes('Trouser front'),'the Men suit Personalize step has no Trouser front group');
assert.ok(!html.includes('trouserFront'),'the Men suit Personalize step never mentions the trouser front slot');
run("setOption('closure','Two button')");
run('stage=2');
documentStub.querySelector('#profileSelect').value='p-men';
run('nextConfig()');
const menItem=bagState().find(x=>x.product===menSuit);
assert.ok(menItem,'the Men suit is bagged');
assert.ok(!('trouserFront' in menItem),'the bagged Men suit stores no trouser front key');
assert.equal(run(`lineDescription(bag.find(x=>x.product===${menSuit}))`),'Navy · Notch lapel · Tailored fit · Two button · Tonal lining','the Men suit bag line is unchanged');

// 5. Standalone Women trousers are unchanged: the same group and choices,
// still stored in the closure slot, with no trouserFront slot involved.
run(`beginDesign(${womenPants})`);
assert.equal(run('config.closure'),'Flat front','standalone trousers still preselect Flat front in the closure slot');
run('stage=1');
html=run('customize()');
assert.ok(html.includes('<div class="option-title">Trouser front</div>'),'standalone trousers still show the Trouser front group');
assert.ok(html.includes("setOption('closure','Single pleat')"),'standalone trousers still store the choice as closure');
assert.ok(!html.includes('trouserFront'),'standalone trousers do not use the suit trouser front slot');
run("setOption('closure','Single pleat')");
run('stage=2');
documentStub.querySelector('#profileSelect').value='p-women';
run('nextConfig()');
const pantsItem=bagState().find(x=>x.product===womenPants);
assert.ok(pantsItem,'the standalone trousers are bagged');
assert.equal(pantsItem.closure,'Single pleat','the bagged trousers keep the choice in the closure slot');
assert.ok(!('trouserFront' in pantsItem),'the bagged trousers store no trouser front key');

// 6. The server sanitizer persists trouserFront on the order item, like it
// persists lapel, closure and lining, and defaults it to empty otherwise.
const commerceSource=fs.readFileSync('lib/commerce.ts','utf8');
assert.ok(commerceSource.includes("trouserFront:String(x.trouserFront||'').slice(0,40)"),'the order item sanitizer keeps the trouser front selection');

console.log('Women trouser front checks passed: Women suits expose the Trouser front group, the choice is stored on the configuration, shown on the bag line, restored by bag edit, and persisted by the server sanitizer, while Men suits and standalone trousers are unchanged.');
