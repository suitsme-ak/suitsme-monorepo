const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey SH (fabric defined shirts): the men's tailored cotton
// and linen shirt collections used to be sample grids whose
// photos were keyed only on color and pattern, and their prices
// came from a generator formula. The owner ruled (2026-11-21)
// that site prices come from the fabric API only and that
// removed products are replaced with new products on available
// unused fabrics, and (2026-11-22) chose a new selector built
// from the wider palette with display color and pattern derived
// from the raw JPOS color and pattern strings, and separately
// ruled that the silk shirt collection is removed (no priced
// unused silk shirt fabrics exist, so no like for like
// replacement is possible). The tailored cotton and linen shirts
// are now built from real library shirt fabrics, one product per
// fabric pinned in data/shirt-fabrics.json (36 cotton spread
// round robin across color and pattern groups, and all 9 priced
// unused linen shirt fabrics), priced from the API at the dress
// shirt tier price, the photo generated from that fabric's own
// swatch with a variety of models and poses (named
// shirt-fabric-<code>.webp), and the product opens at
// /shirts/<fabric code>, the same URL pattern as the fabric
// suits. Short sleeve, tuxedo and overshirt collections are
// different styles and keep their grids.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));
const fullCatalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const pin=JSON.parse(fs.readFileSync('data/shirt-fabrics.json','utf8'));
const library=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8')).fabrics;
const libByCode=new Map(library.filter(f=>f.c).map(f=>[f.c,f]));
const ladder=JSON.parse(fs.readFileSync('data/fabric-tiers.json','utf8')).tiers;
const hashOf=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const GROUPS={cotton:{material:'Cotton',count:36},linen:{material:'Linen',count:9}};
let total=0;
const frontHashes=new Set(),backHashes=new Set();
for(const [group,{material,count}] of Object.entries(GROUPS)){
  const list=pin[group]||[];
  assert.equal(list.length,count,'the '+group+' pin holds '+count+' fabrics');
  const groupCodes=new Set(list.map(f=>f.code));
  const seen=new Set();
  for(const [key,col] of Object.entries(collections)){
    const prods=col.ids.map(id=>byId.get(id)).filter(Boolean);
    if(prods.length&&prods.every(p=>p.shirtFabric===group)){
      assert.equal(prods.length,list.length,'collection '+key+' holds one product per pinned '+group+' fabric');
      for(const p of prods){assert.ok(groupCodes.has(p.fabricCode),'collection '+key+' product '+p.sku+' is pinned');seen.add(p.fabricCode);}
    }
  }
  assert.equal(seen.size,list.length,'every pinned '+group+' fabric appears in a shirts collection');
  for(const f of list){
    total++;
    const matches=fullCatalog.filter(q=>q.fabricCode===f.code);
    assert.equal(matches.length,1,'fabric '+f.code+' is used by exactly one product in the catalog');
    const p=matches[0];
    assert.equal(p.kind,'shirt','product '+p.sku+' is a shirt');
    assert.equal(p.category,'Shirts','product '+p.sku+' is in the Shirts category');
    assert.equal(p.fabric,material,'product '+p.sku+' is '+material.toLowerCase());
    assert.equal(p.shirtFabric,group,'product '+p.sku+' is a fabric defined '+group+' shirt');
    assert.equal(p.color,f.color,'product '+p.sku+' color matches its fabric pin');
    assert.equal(p.pattern,f.pattern,'product '+p.sku+' pattern matches its fabric pin');
    // The pin is honest: the code is a real active library shirt
    // fabric of the group's material with a swatch image.
    const lib=libByCode.get(f.code);
    assert.ok(lib,'fabric '+f.code+' exists in the library');
    assert.equal(lib.k,'shirt','fabric '+f.code+' is a shirt fabric');
    assert.equal(lib.act,1,'fabric '+f.code+' is active');
    assert.equal(lib.mat,material,'fabric '+f.code+' is '+material.toLowerCase());
    assert.ok(lib.img,'fabric '+f.code+' has a swatch image');
    // The price is the API dress shirt price for the fabric's tier.
    const row=ladder[String(lib.tier)];
    assert.ok(row&&typeof row.dressShirt==='number'&&row.dressShirt>0,'fabric '+f.code+' tier has a dress shirt price');
    assert.equal(p.price,row.dressShirt,'product '+p.sku+' is priced at the dress shirt tier price for '+f.code);
    const expected='shirt-fabric-'+f.code+'.webp';
    assert.equal(p.img,expected,'product '+p.sku+' uses the photo generated from fabric '+f.code);
    const file=path.join('public','assets',p.img);
    assert.ok(fs.existsSync(file),'photo file exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(file).size>30000,'photo file is a real image for '+p.sku+': '+p.img);
    const backFile=path.join('public','assets',p.img.replace('.webp','-back.webp'));
    assert.ok(fs.existsSync(backFile),'the product gallery back view exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(backFile).size>30000,'back view is a real image for '+p.sku+': '+p.img);
    frontHashes.add(hashOf(file));backHashes.add(hashOf(backFile));
  }
}
assert.equal(frontHashes.size,total,'all shirt front photos have different image content');
assert.equal(backHashes.size,total,'all shirt back photos have different image content');
console.log('SH fabric defined shirts: '+total+' products built from unused real fabrics at dress shirt tier prices');

// The silk shirt collection is removed (owner decision,
// 2026-11-22): no Silk Shirts menu item, no collection, and no
// silk shirt products remain.
const nav=JSON.parse(fs.readFileSync('data/reference-navigation.json','utf8'));
const shirtsMenu=nav.find(c=>c.name==='Shirts');
assert.ok(shirtsMenu,'the Shirts menu exists');
assert.ok(!JSON.stringify(shirtsMenu).includes('Silk Shirts'),'the Shirts menu no longer offers Silk Shirts');
assert.ok(!('#collection/Shirts/Silk%20Shirts' in collections),'the Silk Shirts collection is gone');
assert.ok(!fullCatalog.some(p=>p.category==='Shirts'&&p.kind==='shirt'&&p.fabric==='Silk'),'no silk shirt products remain');
console.log('SH silk removal: menu item, collection and products are gone');

// The rule lives in the generator and the pin, so the next
// catalog build keeps the mapping, and the code URL wiring is
// in place.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes('shirt-fabrics.json'),'generator reads the shirt fabrics pin');
assert.ok(generator.includes('addShirtFabricCollection'),'generator builds fabric defined shirt collections');
assert.ok(generator.includes("apiPrice(f.code,'shirt')"),'generator prices fabric defined shirts from the API ladder');
const routeMap=JSON.parse(fs.readFileSync('data/real-routes.json','utf8'));
assert.deepEqual(routeMap.families.shirts.groups,Object.fromEntries(Object.entries(pin).map(([g,list])=>[g,list.map(f=>f.code).sort()])),'real routes carry the shirt fabric family');
const realRoutes=fs.readFileSync('public/real-routes.js','utf8');
assert.ok(realRoutes.includes("'#shirt/'"),'real routes map shirt code paths to the shirt route');
const merchant=fs.readFileSync('public/merchant.js','utf8');
assert.ok(merchant.includes("'/shirts/'+encodeURIComponent(p.fabricCode)"),'product cards link fabric defined shirts to their fabric code URL');
const fabricLib=fs.readFileSync('public/fabric-library.js','utf8');
assert.ok(fabricLib.includes("startsWith('#shirt/')"),'the shirt route renders the product page for its fabric code');
assert.ok(fs.existsSync('app/shirts/[code]/route.ts'),'the shirts code route exists');
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
for(const list of Object.values(pin))for(const f of list)assert.ok(sitemap.includes('/shirts/'+encodeURIComponent(f.code)),'sitemap lists /shirts/'+f.code);
assert.ok(!sitemap.includes('/collections/shirts/silk-shirts'),'the sitemap no longer lists the silk shirts collection');

// Neighbours are untouched: short sleeve shirts keep their grid
// photo, and merchant shirts keep their fabric coded products.
assert.ok(entries.some(p=>p.kind==='shirt'&&p.silhouette==='Short sleeve'),'short sleeve shirts keep their grid products');
assert.ok(entries.some(p=>p.kind==='shirt'&&!p.shirtFabric&&p.fabricCode),'merchant shirts keep their fabric coded products');

// The listing card itself, rendered through the real script
// chain in the page's load order (quick-add.js owns the card
// markup, merchant.js wraps it last): a fabric defined shirt's
// card links to the fabric code URL and shows the fabric code,
// not the /product/<id> link and SM sku.
{
  function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class SHFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:crypto.webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:SHFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const wctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js','fabric-library-data.js','fabric-library.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),wctx,{filename:f});
  const run=s=>vm.runInContext(s,wctx);
  const p=fullCatalog.find(q=>q.shirtFabric&&q.fabricCode);
  assert.ok(p,'a fabric defined shirt exists in the full catalog');
  const card=run('productCard(products['+p.id+'],'+p.id+')');
  const url='/shirts/'+encodeURIComponent(p.fabricCode);
  assert.ok(card.includes('href="'+url+'"'),'the shirt listing card links to '+url);
  assert.ok(card.includes('Fabric '+p.fabricCode),'the shirt listing card shows Fabric '+p.fabricCode);
  assert.ok(!card.includes('href="/product/'+p.id+'"'),'the shirt listing card no longer links to /product/'+p.id);
  assert.ok(!card.includes('sku-label">'+p.sku+'</span>'),'the shirt listing card no longer shows the SM sku '+p.sku+' as its label');
  console.log('SH shirt listing card: links to '+url+' and shows Fabric '+p.fabricCode);
  run("location.hash='#shirt/"+encodeURIComponent(p.fabricCode)+"';render();");
  assert.ok(elFor('#main').innerHTML.includes(p.name),'the #shirt/ route renders the product page for '+p.fabricCode);
  console.log('SH shirt code route: #shirt/'+p.fabricCode+' renders '+p.name);
  const control=entries.find(q=>q.kind==='shirt'&&q.silhouette==='Short sleeve');
  assert.ok(control,'a short sleeve shirt still exists as the negative control');
  const controlCard=run('productCard(products['+control.id+'],'+control.id+')');
  assert.ok(controlCard.includes('href="/product/'+control.id+'"'),'a non fabric shirt card keeps its /product link');
  assert.ok(controlCard.includes(control.sku),'a non fabric shirt card keeps its SM sku');
}

console.log('SH fabric defined shirts: ok (unused real fabrics, dress shirt prices, code URLs, silk removed, neighbours unchanged)');
