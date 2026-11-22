const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey WF (fabric defined women's products): the women's wool
// tailored collections used to be 36 product sample grids whose
// photos were one shared women's photo per garment kind. The owner
// ruled (2026-11-21) that site prices come from the fabric API only
// and that removed products are replaced with new products on
// available unused fabrics: the women's suits, jackets, trousers
// and shirts are now built from real library fabrics that are NOT
// shown for suits (nor used by any other product), one product per
// fabric pinned in data/women-fabrics.json, priced from the API at
// the tier price for the garment kind (suits at the suit price,
// jackets at the sport coat price, trousers at the dress pants
// price, shirts at the dress shirt price), the photo generated
// from that fabric's own swatch with a variety of models and poses
// (named women-<kind>-<code>.webp), and the product opens at
// /women/<group>/<fabric code>, the same URL pattern as the fabric
// trousers. Combos the unused pool does not hold (there is no
// burgundy herringbone in it) simply have no product. Allocation
// order inside the pin: suits, then jackets, then trousers, then
// shirts, each fabric used by exactly one women's product. Driven
// on the real generated catalog data and the pin file, in the
// style of the jackets suite.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));
const fullCatalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const pin=JSON.parse(fs.readFileSync('data/women-fabrics.json','utf8'));
const library=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8')).fabrics;
const libByCode=new Map(library.filter(f=>f.c).map(f=>[f.c,f]));
const ladder=JSON.parse(fs.readFileSync('data/fabric-tiers.json','utf8')).tiers;
const hashOf=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const GROUPS={
  suits:{collection:'#collection/Women/Suits',kind:'suit',column:'suit',singular:'suit',libKind:'suit'},
  jackets:{collection:'#collection/Women/Jackets',kind:'jacket',column:'sportCoat',singular:'jacket',libKind:'suit'},
  trousers:{collection:'#collection/Women/Trousers',kind:'pants',column:'dressPants',singular:'trouser',libKind:'suit'},
  shirts:{collection:'#collection/Women/Shirts',kind:'shirt',column:'dressShirt',singular:'shirt',libKind:'shirt'},
};
const frontHashes=new Set(),backHashes=new Set();
let total=0;
for(const [group,g] of Object.entries(GROUPS)){
  const col=collections[g.collection];
  assert.ok(col,'the Women '+group+' collection exists');
  assert.equal(col.ids.length,pin[group].length,'the Women '+group+' collection holds one product per pinned fabric');
  for(const id of col.ids){
    const p=byId.get(id);
    assert.ok(p,'collection product '+id+' resolves');
    assert.equal(p.category,'Women','product '+p.sku+' is a Women product');
    assert.equal(p.kind,g.kind,'product '+p.sku+' is a '+g.kind);
    assert.equal(p.womenFabric,group,'product '+p.sku+' is a fabric defined women '+group+' product');
    assert.ok(p.fabricCode,'product '+p.sku+' carries a fabric code');
    const pinEntry=pin[group].find(f=>f.code===p.fabricCode);
    assert.ok(pinEntry,'product '+p.sku+' fabric '+p.fabricCode+' is pinned for women '+group);
    assert.equal(p.color,pinEntry.color,'product '+p.sku+' color matches its fabric pin');
    assert.equal(p.pattern,pinEntry.pattern,'product '+p.sku+' pattern matches its fabric pin');
    if(group==='shirts')assert.equal(p.fabric,pinEntry.mat,'product '+p.sku+' fabric matches its shirt fabric material');
    else assert.equal(p.fabric,'Wool','product '+p.sku+' is wool');
    // The pin is honest: the code is a real active library fabric
    // with a swatch image, and it is not shown for suits: no other
    // product in the catalog uses the same fabric.
    const lib=libByCode.get(p.fabricCode);
    assert.ok(lib,'fabric '+p.fabricCode+' exists in the library');
    assert.equal(lib.k,g.libKind,'fabric '+p.fabricCode+' is a '+g.libKind+' fabric');
    assert.equal(lib.act,1,'fabric '+p.fabricCode+' is active');
    assert.ok(lib.img,'fabric '+p.fabricCode+' has a swatch image');
    assert.equal(fullCatalog.filter(q=>q.fabricCode===p.fabricCode).length,1,'fabric '+p.fabricCode+' is used by exactly one product, so it is not shown for suits');
    // The price is the API tier price for the garment kind.
    const row=ladder[String(lib.tier)];
    assert.ok(row&&typeof row[g.column]==='number'&&row[g.column]>0,'fabric '+p.fabricCode+' tier has a '+g.column+' price');
    assert.equal(p.price,row[g.column],'product '+p.sku+' is priced at the '+g.column+' tier price for '+p.fabricCode);
    const expected='women-'+g.singular+'-'+p.fabricCode+'.webp';
    assert.equal(p.img,expected,'product '+p.sku+' uses the photo generated from fabric '+p.fabricCode);
    const file=path.join('public','assets',p.img);
    assert.ok(fs.existsSync(file),'photo file exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(file).size>40000,'photo file is a real image for '+p.sku+': '+p.img);
    const backFile=path.join('public','assets',p.img.replace('.webp','-back.webp'));
    assert.ok(fs.existsSync(backFile),'the product gallery back view exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(backFile).size>40000,'back view is a real image for '+p.sku+': '+p.img);
    frontHashes.add(hashOf(file));backHashes.add(hashOf(backFile));
    total++;
  }
}
assert.equal(frontHashes.size,total,'all women front photos have different image content');
assert.equal(backHashes.size,total,'all women back photos have different image content');
console.log('WF fabric defined women: '+total+' products built from unused real fabrics at tier prices for their garment kind');

// The rule lives in the generator and the pin, so the next catalog
// build keeps the mapping, and the code URL wiring is in place.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes('women-fabrics.json'),'generator reads the women fabrics pin');
assert.ok(generator.includes('addWomenFabricCollection'),'generator builds fabric defined women collections');
const routeMap=JSON.parse(fs.readFileSync('data/real-routes.json','utf8'));
assert.deepEqual(routeMap.families.women.groups,Object.fromEntries(Object.entries(pin).map(([g,list])=>[g,list.map(f=>f.code).sort()])),'real routes carry the women fabric families');
const realRoutes=fs.readFileSync('public/real-routes.js','utf8');
assert.ok(realRoutes.includes("'#women/'"),'real routes map women code paths to the women route');
const merchant=fs.readFileSync('public/merchant.js','utf8');
assert.ok(merchant.includes("'/women/'+p.womenFabric"),'product cards link fabric defined women products to their fabric code URL');
const fabricLib=fs.readFileSync('public/fabric-library.js','utf8');
assert.ok(fabricLib.includes("startsWith('#women/')"),'the women route renders the product page for its fabric code');
assert.ok(fs.existsSync('app/women/[group]/[code]/route.ts'),'the women code route exists');
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
for(const [group,list] of Object.entries(pin))for(const f of list)assert.ok(sitemap.includes('/women/'+group+'/'+encodeURIComponent(f.code)),'sitemap lists /women/'+group+'/'+f.code);

// Neighbours are untouched: women's leather, overcoat and tuxedo
// products keep their shared photos.
assert.ok(entries.some(p=>p.category==='Women'&&p.img==='model-women-leather.webp'),'women leather photography is unchanged');
assert.ok(entries.some(p=>p.category==='Women'&&p.img==='model-women-overcoat.webp'),'women overcoat photography is unchanged');
assert.ok(entries.some(p=>p.category==='Women'&&p.img==='model-women-tuxedo.webp'),'women tuxedo photography is unchanged');

// The listing card itself, rendered through the real script chain
// in the page's load order (quick-add.js owns the card markup,
// merchant.js wraps it last): a fabric defined women's card links
// to the fabric code URL and shows the fabric code, not the
// /product/<id> link and SM sku. Render the card, not the source.
{
  function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class WFFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:crypto.webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:WFFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const wctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js','fabric-library-data.js','fabric-library.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),wctx,{filename:f});
  const run=s=>vm.runInContext(s,wctx);
  const p=fullCatalog.find(q=>q.womenFabric==='suits'&&q.fabricCode);
  assert.ok(p,'a fabric defined women suit exists in the full catalog');
  const card=run('productCard(products['+p.id+'],'+p.id+')');
  const url='/women/suits/'+encodeURIComponent(p.fabricCode);
  assert.ok(card.includes('href="'+url+'"'),'the women suit listing card links to '+url);
  assert.ok(card.includes('Fabric '+p.fabricCode),'the women suit listing card shows Fabric '+p.fabricCode);
  assert.ok(!card.includes('href="/product/'+p.id+'"'),'the women suit listing card no longer links to /product/'+p.id);
  assert.ok(!card.includes('sku-label">'+p.sku+'</span>'),'the women suit listing card no longer shows the SM sku '+p.sku+' as its label');
  console.log('WF women suit listing card: links to '+url+' and shows Fabric '+p.fabricCode);
  // The women code route renders the product page through the
  // fabric library render wrapper, like the jacket and trouser
  // routes.
  run("location.hash='#women/suits/"+p.fabricCode+"';render(false)");
  assert.ok(elFor('#main').innerHTML.includes('product-page'),'the women code route renders the product page');
  const leather=entries.find(q=>q.category==='Women'&&q.img==='model-women-leather.webp');
  assert.ok(leather,'a women leather product still exists as the negative control');
  const leatherCard=run('productCard(products['+leather.id+'],'+leather.id+')');
  assert.ok(leatherCard.includes('href="/product/'+leather.id+'"'),'a non fabric women card keeps its /product link');
  assert.ok(leatherCard.includes(leather.sku),'a non fabric women card keeps its SM sku');
}

console.log('WF fabric defined women: ok (unused real fabrics, garment kind tier prices, code URLs, neighbours unchanged)');
