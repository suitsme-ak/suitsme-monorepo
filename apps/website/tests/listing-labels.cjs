const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CAT-02: the two listing models are labelled explicitly. Fabric listings
// (the merchant fabric library screens) carry a "Fabrics" eyebrow and the
// line "Choose a fabric, then design your garment around it."; design
// listings (the design library renderer) carry a "Designs" eyebrow and the
// line "Finished designs, ready to customize.". This suite loads the full
// live script composition from index.html (including navigation.js and
// merchant.js, which the feature worlds omit) and checks every rendered
// menu destination against the audited inventory: 87 collection
// destinations, 20 fabric listings and 67 design listings, 94 distinct
// destinations across 96 rendered anchors, unchanged by this package.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const elements=new Map();
const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,addEventListener(){},scrollTo(){}};
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
for(const f of ['app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx);

const FABRIC_EYEBROW='<span class="eyebrow">Fabrics</span>',FABRIC_NOTE='<p>Choose a fabric, then design your garment around it.</p>';
const DESIGN_EYEBROW='<span class="eyebrow">Designs</span>',DESIGN_NOTE='<p>Finished designs, ready to customize.</p>';

// The audited dispatch rule (merchant.js categoryCollection override):
// every Suits destination, Shirts Shop All, and More Fabric Samples are
// fabric listings; every other collection destination is a design listing.
function expectedKind(href){
  const bits=href.split('/').map(decodeURIComponent);
  if(bits[1]==='Suits')return 'fabric';
  if(bits[1]==='Shirts'&&(!bits[2]||/^Shop all$/i.test(bits[2])))return 'fabric';
  if(bits[1]==='More'&&bits[2]==='Fabric Samples')return 'fabric';
  return 'design';
}
function assertSignal(html,kind,route){
  if(kind==='fabric'){
    assert.ok(html.includes(FABRIC_EYEBROW),route+' shows the Fabrics eyebrow');
    assert.ok(html.includes(FABRIC_NOTE),route+' shows the fabric explanation');
    assert.ok(!html.includes(DESIGN_EYEBROW),route+' never shows the Designs eyebrow');
    assert.ok(!html.includes(DESIGN_NOTE),route+' never shows the design explanation');
  }else{
    assert.ok(html.includes(DESIGN_EYEBROW),route+' shows the Designs eyebrow');
    assert.ok(html.includes(DESIGN_NOTE),route+' shows the design explanation');
    assert.ok(!html.includes(FABRIC_EYEBROW),route+' never shows the Fabrics eyebrow');
    assert.ok(!html.includes(FABRIC_NOTE),route+' never shows the fabric explanation');
  }
}

// Rendered menu inventory, parsed the same way the e2e J1 journey does.
const navHtml=elFor('#catalogNav').innerHTML;
const menus=navHtml.split('<details class="nav-item"').slice(1).map(chunk=>{
  const name=/<summary>([^<]+)<\/summary>/.exec(chunk)[1];
  const anchors=[...chunk.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m=>({href:m[1],label:m[2]}));
  return{name,anchors};
});
assert.deepEqual(menus.map(m=>m.name),['Suits','Jackets','Trousers','Shirts','Weddings','More','Women'],'all seven menus render in order');
let anchors=0,fabrics=0,designs=0;const destinations=new Set();
for(const menu of menus)for(const a of menu.anchors){
  anchors++;destinations.add(a.href);
  if(!a.href.startsWith('#collection/'))continue;
  const kind=expectedKind(a.href);
  const html=run(`categoryCollection(${JSON.stringify(a.href)})`);
  assertSignal(html,kind,a.href);
  if(kind==='fabric')fabrics++;else designs++;
}
assert.equal(anchors,96,'rendered menu rows unchanged at 96');
assert.equal(destinations.size,94,'distinct destinations unchanged at 94');
assert.equal(fabrics,20,'fabric listing destinations unchanged at 20');
assert.equal(designs,67,'design listing destinations unchanged at 67');

// The fabric swatch routes, reached from chips and product pages rather
// than the menus, are fabric listings too and render through render().
for(const route of ['#fabrics/suit','#fabrics/shirt']){
  run(`location.hash='${route}';render(false)`);
  assertSignal(elFor('#main').innerHTML,'fabric',route);
}
// The bare collection route and the Fabrics chip route are fabric listings.
assertSignal(run(`categoryCollection('#collection')`),'fabric','#collection');
assertSignal(run(`categoryCollection('#collection/Fabrics')`),'fabric','#collection/Fabrics');

console.log('Listing label checks passed: every fabric listing shows the Fabrics signal, every design listing shows the Designs signal, the signals never cross, and the destination inventory is unchanged (96 anchors, 94 destinations, 20 fabric, 67 design).');
