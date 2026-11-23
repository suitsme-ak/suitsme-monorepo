const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey SF (fabric defined suits): the men's tailored wool,
// linen and cotton suit collections used to be sample grids whose
// photos were keyed only on color and pattern, so every product in
// a collection shared the same few photos, and their prices came
// from a generator formula. The owner ruled (2026-11-21) that site
// prices come from the fabric API only and that removed products
// are replaced with new products on available unused fabrics, and
// (2026-11-22) chose a new selector built from the wider palette
// with display color and pattern derived from the raw JPOS color
// and pattern strings (the library's normalized fields mislabel
// real fabrics). The tailored wool, linen and cotton suits are now
// built from real library fabrics, one product per fabric pinned
// in data/suit-fabrics.json (36 per material, spread round robin
// across color and pattern groups), priced from the API at the
// suit tier price, the photo generated from that fabric's own
// swatch with a variety of models and poses (named
// suit-fabric-<code>.webp), and the product opens at
// /suits/<fabric code>, the same URL pattern as the fabric
// jackets. Tweed, corduroy and seersucker suits keep their grids
// for a later package; double breasted, tuxedo, boys, evening and
// leather suits are different styles and keep theirs too.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));
const fullCatalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const pin=JSON.parse(fs.readFileSync('data/suit-fabrics.json','utf8'));
const library=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8')).fabrics;
const libByCode=new Map(library.filter(f=>f.c).map(f=>[f.c,f]));
const ladder=JSON.parse(fs.readFileSync('data/fabric-tiers.json','utf8')).tiers;
const hashOf=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const GROUPS={wool:'Wool',linen:'Linen',cotton:'Cotton'};
let total=0;
const frontHashes=new Set(),backHashes=new Set();
for(const [group,material] of Object.entries(GROUPS)){
  const list=pin[group]||[];
  assert.equal(list.length,36,'the '+group+' pin holds 36 fabrics');
  // Every collection made only of this group's fabric suits holds
  // exactly the pin set (the products are shared across the
  // collections that carry this spec, by signature).
  const groupCodes=new Set(list.map(f=>f.code));
  const seen=new Set();
  for(const [key,col] of Object.entries(collections)){
    const prods=col.ids.map(id=>byId.get(id)).filter(Boolean);
    if(prods.length&&prods.every(p=>p.suitFabric===group)){
      assert.equal(prods.length,list.length,'collection '+key+' holds one product per pinned '+group+' fabric');
      for(const p of prods){assert.ok(groupCodes.has(p.fabricCode),'collection '+key+' product '+p.sku+' is pinned');seen.add(p.fabricCode);}
    }
  }
  assert.equal(seen.size,list.length,'every pinned '+group+' fabric appears in a suits collection');
  for(const f of list){
    total++;
    const matches=fullCatalog.filter(q=>q.fabricCode===f.code);
    assert.equal(matches.length,1,'fabric '+f.code+' is used by exactly one product in the catalog');
    const p=matches[0];
    assert.equal(p.kind,'suit','product '+p.sku+' is a suit');
    assert.equal(p.category,'Suits','product '+p.sku+' is in the Suits category');
    assert.equal(p.fabric,material,'product '+p.sku+' is '+material.toLowerCase());
    assert.equal(p.suitFabric,group,'product '+p.sku+' is a fabric defined '+group+' suit');
    assert.equal(p.color,f.color,'product '+p.sku+' color matches its fabric pin');
    assert.equal(p.pattern,f.pattern,'product '+p.sku+' pattern matches its fabric pin');
    // The pin is honest: the code is a real active library suit
    // fabric of the group's material with a swatch image.
    const lib=libByCode.get(f.code);
    assert.ok(lib,'fabric '+f.code+' exists in the library');
    assert.equal(lib.k,'suit','fabric '+f.code+' is a suit fabric');
    assert.equal(lib.act,1,'fabric '+f.code+' is active');
    assert.equal(lib.mat,material,'fabric '+f.code+' is '+material.toLowerCase());
    assert.ok(lib.img,'fabric '+f.code+' has a swatch image');
    // The price is the API suit price for the fabric's tier.
    const row=ladder[String(lib.tier)];
    assert.ok(row&&typeof row.suit==='number'&&row.suit>0,'fabric '+f.code+' tier has a suit price');
    assert.equal(p.price,row.suit,'product '+p.sku+' is priced at the suit tier price for '+f.code);
    const expected='suit-fabric-'+f.code+'.webp';
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
assert.equal(frontHashes.size,total,'all suit front photos have different image content');
assert.equal(backHashes.size,total,'all suit back photos have different image content');
console.log('SF fabric defined suits: '+total+' products built from unused real fabrics at suit tier prices');

// The rule lives in the generator and the pin, so the next catalog
// build keeps the mapping, and the code URL wiring is in place.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes('suit-fabrics.json'),'generator reads the suit fabrics pin');
assert.ok(generator.includes('addSuitFabricCollection'),'generator builds fabric defined suit collections');
assert.ok(generator.includes("apiPrice(f.code,'suit')"),'generator prices fabric defined suits from the API ladder');
const routeMap=JSON.parse(fs.readFileSync('data/real-routes.json','utf8'));
assert.deepEqual(routeMap.families.suits.groups,Object.fromEntries(Object.entries(pin).map(([g,list])=>[g,list.map(f=>f.code).sort()])),'real routes carry the suit fabric family');
const realRoutes=fs.readFileSync('public/real-routes.js','utf8');
assert.ok(realRoutes.includes("'#suit/'"),'real routes map suit code paths to the suit route');
const merchant=fs.readFileSync('public/merchant.js','utf8');
assert.ok(merchant.includes("'/suits/'+encodeURIComponent(p.fabricCode)"),'product cards link fabric defined suits to their fabric code URL');
const fabricLib=fs.readFileSync('public/fabric-library.js','utf8');
assert.ok(fabricLib.includes("startsWith('#suit/')"),'the suit route renders the product page for its fabric code');
assert.ok(fs.existsSync('app/suits/[code]/route.ts'),'the suits code route exists');
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
for(const list of Object.values(pin))for(const f of list)assert.ok(sitemap.includes('/suits/'+encodeURIComponent(f.code)),'sitemap lists /suits/'+f.code);

// Neighbours are untouched: tweed suits keep the shared tweed
// photo, and the merchant launch suits keep their own photos.
assert.ok(entries.some(p=>p.kind==='suit'&&p.img==='model-tweed.webp'),'tweed suits keep the shared tweed photo');
assert.ok(entries.some(p=>p.kind==='suit'&&!p.suitFabric&&p.fabricCode),'merchant suits keep their fabric coded products');

// The listing card itself, rendered through the real script chain
// in the page's load order (quick-add.js owns the card markup,
// merchant.js wraps it last): a fabric defined suit's card links
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
  class SFFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:crypto.webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:SFFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const wctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js','fabric-library-data.js','fabric-library.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),wctx,{filename:f});
  const run=s=>vm.runInContext(s,wctx);
  const p=fullCatalog.find(q=>q.suitFabric&&q.fabricCode);
  assert.ok(p,'a fabric defined suit exists in the full catalog');
  const card=run('productCard(products['+p.id+'],'+p.id+')');
  const url='/suits/'+encodeURIComponent(p.fabricCode);
  assert.ok(card.includes('href="'+url+'"'),'the suit listing card links to '+url);
  assert.ok(card.includes('Fabric '+p.fabricCode),'the suit listing card shows Fabric '+p.fabricCode);
  assert.ok(!card.includes('href="/product/'+p.id+'"'),'the suit listing card no longer links to /product/'+p.id);
  assert.ok(!card.includes('sku-label">'+p.sku+'</span>'),'the suit listing card no longer shows the SM sku '+p.sku+' as its label');
  console.log('SF suit listing card: links to '+url+' and shows Fabric '+p.fabricCode);
  // The #suit/ hash renders that fabric's product page through
  // the fabric library render wrapper.
  run("location.hash='#suit/"+encodeURIComponent(p.fabricCode)+"';render();");
  assert.ok(elFor('#main').innerHTML.includes(p.name),'the #suit/ route renders the product page for '+p.fabricCode);
  console.log('SF suit code route: #suit/'+p.fabricCode+' renders '+p.name);
  const tweed=entries.find(q=>q.kind==='suit'&&q.img==='model-tweed.webp');
  assert.ok(tweed,'a tweed suit still exists as the negative control');
  const tweedCard=run('productCard(products['+tweed.id+'],'+tweed.id+')');
  assert.ok(tweedCard.includes('href="/product/'+tweed.id+'"'),'a non fabric suit card keeps its /product link');
  assert.ok(tweedCard.includes(tweed.sku),'a non fabric suit card keeps its SM sku');
}

console.log('SF fabric defined suits: ok (unused real fabrics, suit prices, code URLs, neighbours unchanged)');
