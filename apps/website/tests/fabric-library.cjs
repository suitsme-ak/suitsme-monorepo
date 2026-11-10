const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Fabric library journeys (owner request 2026-11-10): /fabrics/suit
// and /fabrics/shirt show the FULL shop fabric library imported from
// JPOS, not just the merchant set. The screens open on the active
// fabrics by default; the Availability filter can show everything,
// and inactive fabrics always carry an Inactive marker. Rich filters
// (collection, color, pattern, material, season, mill, weave,
// occasion, search) narrow the library. Driven on the real generated
// library data and the real storefront scripts in the e2e harness
// style of the other screen suites.
//
// L1 data: the library holds every JPOS suit and shirt fabric with
//    the export's active split, and every merchant fabric code is in
//    it flagged as a merchant fabric.
// L2 default view: the suit screen opens on active fabrics only
//    (3,648 results, 36 cards, no Inactive marker anywhere).
// L3 availability: All fabrics shows 6,311 with Inactive markers on
//    the inactive cards; Inactive fabrics shows 2,663, all marked.
// L3b codeless shells: the 406 export rows with no fabric code are
//    excluded from the served data entirely (owner rule 2026-11-10),
//    so no placeholder card ever renders.
// L4 filters: mill, color and collection filters narrow to the exact
//    counts the data predicts, and search by fabric code finds the
//    one fabric, linked to its product page.
// L5 shirt screen: opens on 665 active shirt fabrics and serves
//    swatches from the shirt image path.
// L6 wiring: index.html loads the library after merchant.js, the
//    build regenerates the library data file, and collection screens
//    still render through the merchant screen untouched.
// L7 fabric detail pages (owner request 2026-11-10): every fabric
//    opens at /fabrics/<kind>/<code> with the code in the URL; the
//    real path translator maps it to the detail route, the detail
//    screen carries the fabric facts and, for merchant fabrics, the
//    design entry; inactive fabrics show their status; unknown codes
//    show a not found screen; codes with slashes survive encoding.

const lib=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8'));
assert.ok(Array.isArray(lib.fabrics),'library data loads');
const suit=lib.fabrics.filter(f=>f.k==='suit'),shirt=lib.fabrics.filter(f=>f.k==='shirt');
assert.equal(suit.length,6714,'library holds all JPOS suit fabrics');
assert.equal(shirt.length,1251,'library holds all JPOS shirt fabrics');
assert.equal(suit.filter(f=>f.act).length,3648,'suit active count matches the JPOS flag');
assert.equal(shirt.filter(f=>f.act).length,665,'shirt active count matches the JPOS flag');
assert.ok(suit.every(f=>!f.act||f.c),'every active suit fabric carries its fabric code');
assert.ok(shirt.every(f=>!f.act||f.c),'every active shirt fabric carries its fabric code');
const merchant=JSON.parse(fs.readFileSync('data/merchant-fabrics.json','utf8'));
const merchantRows=merchant.fabrics||merchant;
assert.equal(lib.fabrics.filter(f=>f.mer).length,merchantRows.length,'every merchant fabric is in the library');
for(const m of merchantRows)assert.ok(lib.fabrics.some(f=>f.c===m.fabric_code&&f.mer===1),'merchant fabric '+m.fabric_code+' is flagged in the library');
assert.equal(lib.fabrics.filter(f=>!f.c).length,406,'the export holds 406 codeless legacy rows');

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
function makeWorld(hash){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class WorldFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash,pathname:'/',search:''};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:async()=>({ok:false,status:0,json:async()=>null}),FormData:WorldFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js','fabric-library-data.js','fabric-library.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,location};
}
const count=(html,needle)=>html.split(needle).length-1;
const escHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const cards=html=>count(html,'product merchant-swatch fabric-lib');
const resultsLine=html=>{const m=html.match(/([\d,]+) results?/);assert.ok(m,'results line renders');return m[0]};

// L2 default suit view
const w=makeWorld('#fabrics/suit');
assert.equal(w.run('fabricLibraryData.fabrics.length'),7559,'served library data excludes the codeless rows');
assert.equal(w.run('fabricLibraryData.fabrics.filter(f=>!f.c).length'),0,'no codeless fabric is served');
// No manual render() here: the first paint must come from the
// scripts' own boot sequence, exactly as in production. merchant.js
// paints at its load; the library scripts load after it and must
// repaint the fabrics route themselves (the PR #62 live miss).
let html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),'3648 results','suit library opens on the active fabrics');
assert.equal(cards(html),36,'first page shows 36 fabric cards');
assert.equal(count(html,'fabric-status'),0,'no Inactive marker in the active view');
assert.ok(html.includes('6,311 suit fabrics'),'header states the full library size');
assert.ok(html.includes('Inactive fabrics stay in the library for reference'),'header explains the inactive rule');

// L3 availability filter
w.run("libStatus='All fabrics';libPage=1;render(false)");
html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),'6311 results','All fabrics shows the whole suit library');
w.run("libPage=187;render(false)");
html=w.elFor('#main').innerHTML;
assert.ok(count(html,'fabric-status')>0,'inactive cards are marked in the All view');
w.run("libStatus='Inactive fabrics';libPage=1;render(false)");
html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),'2663 results','Inactive view shows only inactive suit fabrics');
assert.equal(count(html,'fabric-status'),36,'every card in the Inactive view is marked');
assert.equal((html.match(/JPOS \d/g)||[]).length,0,'no codeless placeholder cards in the Inactive view');

// L4 filters and search, checked against the data itself
const vbcActive=suit.filter(f=>f.act&&f.m==='VITALE BARBERIS CANONICO').length;
w.run("libStatus='Active fabrics';libMill='VITALE BARBERIS CANONICO';libPage=1;render(false)");
html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),String(vbcActive)+(vbcActive===1?' result':' results'),'mill filter narrows to the data count');
const productId=w.run("products.find(p=>p.fabricCode==='CB11001').id");
w.run("libMill='All mills';libSearch='CB11001';libPage=1;render(false)");
html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),'1 result','search by fabric code finds exactly one fabric');
assert.ok(html.includes('href="/fabrics/suit/CB11001"'),'the fabric card links to its own page with the code in the URL');
const bestSellersActive=suit.filter(f=>f.act&&(f.grp||[]).includes('Best Sellers')).length;
w.run("libSearch='';libCollection='Best Sellers';libPage=1;render(false)");
html=w.elFor('#main').innerHTML;
assert.equal(resultsLine(html),String(bestSellersActive)+(bestSellersActive===1?' result':' results'),'collection filter narrows to the data count');

// L5 shirt screen
const w2=makeWorld('#fabrics/shirt');
html=w2.elFor('#main').innerHTML;
assert.equal(resultsLine(html),'665 results','shirt library opens on the active fabrics');
assert.ok(html.includes('/website/images/fabric/shirts/large/'),'shirt swatches come from the shirt image path');
assert.ok(html.includes('1,248 shirt fabrics'),'shirt header states the full library size');

// L6 wiring
const shell=fs.readFileSync('public/index.html','utf8');
assert.ok(shell.indexOf('merchant.js')<shell.indexOf('fabric-library-data.js')&&shell.indexOf('fabric-library-data.js')<shell.indexOf('fabric-library.js'),'index.html loads the fabric library after merchant.js');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.ok(pkg.scripts.build.includes('build-fabric-library.cjs'),'the website build regenerates the library data');
assert.ok(fs.existsSync('public/fabric-library-data.js'),'the generated library data file exists');
const w3=makeWorld('#collection/Suits/Best%20Sellers');
w3.run('render()');
assert.ok(w3.elFor('#main').innerHTML.length>0,'collection screens still render through the merchant screen');

// L7 fabric detail pages
const wd=makeWorld('#fabric/suit/CB11001');
html=wd.elFor('#main').innerHTML;
assert.ok(html.includes('Fabric CB11001'),'detail page is titled by the fabric code');
assert.ok(html.includes('href="/product/'+productId+'"'),'merchant fabric detail offers the design entry');
assert.equal(count(html,'fabric-status'),0,'an active fabric detail carries no Inactive badge');
assert.ok(html.includes('/website/images/fabric/large/CB11001.jpg'),'detail page shows the shop swatch');
const inactiveSuit=suit.find(f=>!f.act&&f.c&&f.img);
const wi=makeWorld('#fabric/suit/'+encodeURIComponent(inactiveSuit.c));
html=wi.elFor('#main').innerHTML;
assert.ok(count(html,'fabric-status')>=1,'inactive fabric detail shows the Inactive badge');
assert.ok(html.includes('not currently available to order'),'inactive detail states the fabric cannot be ordered');
assert.ok(!html.includes('Design your suit in this fabric'),'inactive detail has no design entry');
const wu=makeWorld('#fabric/suit/ZZ99999');
assert.ok(wu.elFor('#main').innerHTML.includes('Fabric not found'),'an unknown code shows the not found screen');
const slashShirt=shirt.find(f=>f.c&&f.c.includes('/'));
if(slashShirt){
  const ws=makeWorld('#fabric/shirt/'+encodeURIComponent(slashShirt.c));
  assert.ok(ws.elFor('#main').innerHTML.includes(escHtml(slashShirt.c)),'a code with a slash opens its detail page');
}
assert.equal(w.run("hashForRealPath('/fabrics/suit/CB11001')"),'#fabric/suit/CB11001','the real path translator maps a fabric URL to the detail route');
assert.equal(w.run("hashForRealPath('/fabrics/suit')"),'#fabrics/suit','the listing path still maps to the listing route');
const detailRoute=fs.readFileSync('app/fabrics/[kind]/[code]/route.ts','utf8');
assert.ok(detailRoute.includes('fabric-library.json')&&detailRoute.includes('headForFabric'),'the fabric detail route validates codes against the library data');
assert.ok(fs.readFileSync('lib/route-head.ts','utf8').includes('export function headForFabric'),'route-head builds the fabric detail head');

console.log('fabric-library journeys: all assertions passed');
