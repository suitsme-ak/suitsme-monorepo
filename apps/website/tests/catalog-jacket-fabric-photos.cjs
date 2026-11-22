const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey JF (fabric defined jackets): the wool jackets in the
// Jackets collections used to be a 36 product sample grid whose
// photos were keyed only on color and pattern, and every other
// jacket collection shared the same few photos. The owner then
// ruled (2026-11-21) that site prices come from the fabric API
// only and that removed products are replaced with new products on
// available unused fabrics: the wool tailored jackets are now built
// from real library fabrics that are NOT shown for suits (nor used
// by any other product), one product per fabric pinned in
// data/jacket-fabrics.json, priced from the API at the sport coat
// tier price, the photo generated from that fabric's own swatch
// with a variety of models and poses (named
// jacket-fabric-<code>.webp), and the product opens at
// /jackets/<fabric code>, the same URL pattern as the fabric
// trousers. Combos the unused pool does not hold (there is no
// burgundy herringbone in it) simply have no product. Driven on the
// real generated catalog data and the pin file, in the style of
// the trousers suite.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));
const fullCatalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const pin=JSON.parse(fs.readFileSync('data/jacket-fabrics.json','utf8'));
const library=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8')).fabrics;
const libByCode=new Map(library.filter(f=>f.c).map(f=>[f.c,f]));
const ladder=JSON.parse(fs.readFileSync('data/fabric-tiers.json','utf8')).tiers;
const hashOf=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const arrivals=collections['#collection/Jackets/New%20Arrivals'];
assert.ok(arrivals,'the Jackets New Arrivals collection exists');
assert.equal(arrivals.ids.length,pin.fabrics.length,'the collection holds one product per pinned jacket fabric');
const frontHashes=new Set(),backHashes=new Set();
for(const id of arrivals.ids){
  const p=byId.get(id);
  assert.ok(p,'collection product '+id+' resolves');
  assert.equal(p.kind,'jacket','product '+p.sku+' is a jacket');
  assert.equal(p.fabric,'Wool','product '+p.sku+' is wool');
  assert.equal(p.jacketFabric,true,'product '+p.sku+' is a fabric defined jacket');
  assert.ok(p.fabricCode,'product '+p.sku+' carries a fabric code');
  const pinEntry=pin.fabrics.find(f=>f.code===p.fabricCode);
  assert.ok(pinEntry,'product '+p.sku+' fabric '+p.fabricCode+' is pinned for jackets');
  assert.equal(p.color,pinEntry.color,'product '+p.sku+' color matches its fabric pin');
  assert.equal(p.pattern,pinEntry.pattern,'product '+p.sku+' pattern matches its fabric pin');
  // The pin is honest: the code is a real active library suit
  // fabric of wool with a swatch image, and it is not shown for
  // suits: no other product in the catalog uses the same fabric.
  const lib=libByCode.get(p.fabricCode);
  assert.ok(lib,'fabric '+p.fabricCode+' exists in the library');
  assert.equal(lib.k,'suit','fabric '+p.fabricCode+' is a suit fabric');
  assert.equal(lib.act,1,'fabric '+p.fabricCode+' is active');
  assert.equal(lib.mat,'Wool','fabric '+p.fabricCode+' is wool');
  assert.ok(lib.img,'fabric '+p.fabricCode+' has a swatch image');
  assert.equal(fullCatalog.filter(q=>q.fabricCode===p.fabricCode).length,1,'fabric '+p.fabricCode+' is used by exactly one product, so it is not shown for suits');
  // The price is the API sport coat price for the fabric's tier.
  const row=ladder[String(lib.tier)];
  assert.ok(row&&typeof row.sportCoat==='number'&&row.sportCoat>0,'fabric '+p.fabricCode+' tier has a sport coat price');
  assert.equal(p.price,row.sportCoat,'product '+p.sku+' is priced at the sport coat tier price for '+p.fabricCode);
  const expected='jacket-fabric-'+p.fabricCode+'.webp';
  assert.equal(p.img,expected,'product '+p.sku+' uses the photo generated from fabric '+p.fabricCode);
  const file=path.join('public','assets',p.img);
  assert.ok(fs.existsSync(file),'photo file exists for '+p.sku+': '+p.img);
  assert.ok(fs.statSync(file).size>50000,'photo file is a real image for '+p.sku+': '+p.img);
  const backFile=path.join('public','assets',p.img.replace('.webp','-back.webp'));
  assert.ok(fs.existsSync(backFile),'the product gallery back view exists for '+p.sku+': '+p.img);
  assert.ok(fs.statSync(backFile).size>50000,'back view is a real image for '+p.sku+': '+p.img);
  frontHashes.add(hashOf(file));backHashes.add(hashOf(backFile));
}
assert.equal(frontHashes.size,pin.fabrics.length,'all jacket front photos have different image content');
assert.equal(backHashes.size,pin.fabrics.length,'all jacket back photos have different image content');
console.log('JF fabric defined jackets: '+pin.fabrics.length+' products built from unused real fabrics at sport coat tier prices');

// The rule lives in the generator and the pin, so the next catalog
// build keeps the mapping, and the code URL wiring is in place.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes('jacket-fabrics.json'),'generator reads the jacket fabrics pin');
assert.ok(generator.includes('addJacketFabricCollection'),'generator builds fabric defined jacket collections');
assert.ok(generator.includes("apiPrice(f.code,'jacket')"),'generator prices fabric defined jackets from the API ladder');
const routeMap=JSON.parse(fs.readFileSync('data/real-routes.json','utf8'));
assert.deepEqual(routeMap.families.jackets.fabrics,pin.fabrics.map(f=>f.code).sort(),'real routes carry the jacket fabric family');
const realRoutes=fs.readFileSync('public/real-routes.js','utf8');
assert.ok(realRoutes.includes("'#jacket/'"),'real routes map jacket code paths to the jacket route');
const merchant=fs.readFileSync('public/merchant.js','utf8');
assert.ok(merchant.includes("'/jackets/'+encodeURIComponent(p.fabricCode)"),'product cards link fabric defined jackets to their fabric code URL');
const fabricLib=fs.readFileSync('public/fabric-library.js','utf8');
assert.ok(fabricLib.includes("startsWith('#jacket/')"),'the jacket route renders the product page for its fabric code');
assert.ok(fs.existsSync('app/jackets/[code]/route.ts'),'the jackets code route exists');
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
for(const f of pin.fabrics)assert.ok(sitemap.includes('/jackets/'+encodeURIComponent(f.code)),'sitemap lists /jackets/'+f.code);

// Neighbours: tweed jackets keep the tweed photo, and non wool
// jackets keep the shared jacket photo. (Suits new arrivals were
// a shared photo neighbour when this suite was written; since the
// fabric defined suits package, 2026-11-22, they lead with a
// fabric defined suit instead, which the SF suite verifies.)
const suitArrivals=collections['#collection/Suits/New%20Arrivals'];
assert.ok(suitArrivals.ids.length>0,'suits new arrivals exist');
assert.ok(byId.get(suitArrivals.ids[0]).suitFabric,'suits new arrivals are now fabric defined');
assert.ok(entries.some(p=>p.img==='model-tweed.webp'),'tweed photography is unchanged');
assert.ok(entries.some(p=>p.img==='model-jacket.webp'),'non wool jackets keep the shared jacket photo');

// The listing card itself, rendered through the real script chain
// in the page's load order (quick-add.js owns the card markup,
// merchant.js wraps it last): a fabric defined jacket's card links
// to the fabric code URL and shows the fabric code, not the
// /product/<id> link and SM sku. Render the card, not the source:
// the first trousers deploy failed exactly on a source-only check.
{
  function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class JFFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:crypto.webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:JFFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const wctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),wctx,{filename:f});
  const run=s=>vm.runInContext(s,wctx);
  const p=fullCatalog.find(q=>q.jacketFabric&&q.fabricCode);
  assert.ok(p,'a fabric defined jacket exists in the full catalog');
  const card=run('productCard(products['+p.id+'],'+p.id+')');
  const url='/jackets/'+encodeURIComponent(p.fabricCode);
  assert.ok(card.includes('href="'+url+'"'),'the jacket listing card links to '+url);
  assert.ok(card.includes('Fabric '+p.fabricCode),'the jacket listing card shows Fabric '+p.fabricCode);
  assert.ok(!card.includes('href="/product/'+p.id+'"'),'the jacket listing card no longer links to /product/'+p.id);
  assert.ok(!card.includes('sku-label">'+p.sku+'</span>'),'the jacket listing card no longer shows the SM sku '+p.sku+' as its label');
  console.log('JF jacket listing card: links to '+url+' and shows Fabric '+p.fabricCode);
  const tweed=entries.find(q=>q.img==='model-tweed.webp'&&q.kind==='jacket');
  assert.ok(tweed,'a tweed jacket still exists as the negative control');
  const tweedCard=run('productCard(products['+tweed.id+'],'+tweed.id+')');
  assert.ok(tweedCard.includes('href="/product/'+tweed.id+'"'),'a non fabric jacket card keeps its /product link');
  assert.ok(tweedCard.includes(tweed.sku),'a non fabric jacket card keeps its SM sku');
}

console.log('JF fabric defined jackets: ok (unused real fabrics, sport coat prices, code URLs, neighbours unchanged)');
