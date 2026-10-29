const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CAT-03 (delivery estimate part): the product page and the checkout order
// summary both show a delivery estimate, and both are built from the one
// DELIVERY_ESTIMATE_WEEKS config value in app.js. Changing that value must
// change both surfaces, and the wording must pluralize correctly.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

function makeWorld(appSource){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  localStorage.setItem('suits-profiles',JSON.stringify([ready]));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/measurement-schema.js','utf8'),ctx,{filename:'measurement-schema.js'});vm.runInContext(appSource||fs.readFileSync('public/app.js','utf8'),ctx,{filename:'app.js'});
  for(const f of ['complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag};
}

function bagOneSuit(w){
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
}

// ---- The config is a single source, defined once, in app.js.
const publicFiles=fs.readdirSync('public').filter(f=>f.endsWith('.js'));
let definitions=0,definitionFile='';
for(const f of publicFiles){
  const src=fs.readFileSync('public/'+f,'utf8');
  const hits=(src.match(/const DELIVERY_ESTIMATE_WEEKS=/g)||[]).length;
  if(hits){definitions+=hits;definitionFile=f}
  assert.ok(f==='app.js'||!src.includes('Delivery in about'),'the estimate wording is built only in app.js, not duplicated in '+f);
}
assert.equal(definitions,1,'DELIVERY_ESTIMATE_WEEKS is defined exactly once across the storefront sources');
assert.equal(definitionFile,'app.js','the delivery estimate config lives in app.js');
const completeSrc=fs.readFileSync('public/complete.js','utf8');
assert.ok((completeSrc.match(/deliveryEstimateText\(\)/g)||[]).length>=2,'both the product page and the checkout render call the shared deliveryEstimateText builder');

// ---- With the shipped value (1 week), both surfaces show the estimate.
{
  const w=makeWorld();
  assert.equal(w.run('DELIVERY_ESTIMATE_WEEKS'),1,'the shipped config value is 1 week');
  assert.equal(w.run('deliveryEstimateText()'),'Delivery in about 1 week.','the builder pluralizes the singular value correctly');
  const page=w.run('productPage(0)');
  assert.ok(page.includes('Made to order. Delivery in about 1 week.'),'the tailored product page shows the estimate near the purchase controls. Got excerpt: '+page.slice(page.indexOf('detail-price'),page.indexOf('detail-price')+600));
  const accessory=w.run("products.findIndex(p=>p.kind==='accessory')");
  assert.ok(accessory>=0,'the catalog holds an accessory for the direct product page check');
  const directPage=w.run(`productPage(${accessory})`);
  assert.ok(directPage.includes('Delivery in about 1 week.'),'the direct product page also shows the delivery estimate');
  assert.ok(!directPage.includes('Made to order. Delivery'),'the direct product page does not claim the item is made to order');
  bagOneSuit(w);
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Delivery in about 1 week.'),'the checkout order summary shows the same delivery estimate');
  assert.ok(checkout.indexOf('Delivery in about 1 week.')>checkout.indexOf('order-summary'),'the estimate appears inside the checkout order summary area');
}

// ---- With the config stubbed to another value, both surfaces follow it,
// ---- and the plural form is used. This is the config change the owner
// ---- will make later; no template edit is involved.
{
  const appSrc=fs.readFileSync('public/app.js','utf8');
  const stubbed=appSrc.replace('DELIVERY_ESTIMATE_WEEKS=1','DELIVERY_ESTIMATE_WEEKS=3');
  assert.notEqual(stubbed,appSrc,'the stubbed source actually changes the config value');
  const w=makeWorld(stubbed);
  assert.equal(w.run('deliveryEstimateText()'),'Delivery in about 3 weeks.','the builder pluralizes a multi week value correctly');
  const page=w.run('productPage(0)');
  assert.ok(page.includes('Made to order. Delivery in about 3 weeks.'),'the product page follows the changed config value');
  assert.ok(!page.includes('1 week'),'the product page shows no trace of the old config value');
  bagOneSuit(w);
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Delivery in about 3 weeks.'),'the checkout follows the changed config value');
  assert.ok(!checkout.includes('1 week'),'the checkout shows no trace of the old config value');
}

console.log('Delivery estimate checks passed: one config value in app.js drives the estimate on the product page and at checkout, with correct week and weeks wording.');
