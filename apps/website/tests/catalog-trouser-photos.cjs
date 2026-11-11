const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey JT (fabric defined trousers): every men's trousers product
// in the sample catalog used to render the same model-shirt.webp
// photo (a man in navy trousers) whatever its own color, pattern or
// material. The owner then ruled (2026-11-11) that trousers are
// built from real library fabrics only: a trousers collection whose
// group has shipped holds one product per real fabric pinned in
// data/trouser-fabrics.json, the photo is generated from that
// fabric's own swatch (named trouser-<group>-<color>-<pattern>.webp),
// and the product opens at /trousers/<group>/<fabric code>, the same
// URL pattern as the fabric detail pages. Combos the library does
// not hold (there is no burgundy herringbone wool fabric) simply
// have no product. Groups join this suite as they ship; unshipped
// groups keep the grid and the shared photo until their turn.
// Driven on the real generated catalog data and the pin file, in
// the style of the other suites.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));
const pin=JSON.parse(fs.readFileSync('data/trouser-fabrics.json','utf8'));
const library=JSON.parse(fs.readFileSync('data/fabric-library.json','utf8')).fabrics;
const libByCode=new Map(library.filter(f=>f.c).map(f=>[f.c,f]));
const slug=s=>s.toLowerCase().replace(/ /g,'-');
const hashOf=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// Shipped groups: collection key, group slug, material, style.
const SHIPPED=[
  {collection:'#collection/Trousers/Wool%20Trousers',group:'wool'},
  {collection:'#collection/Trousers/Linen%20Trousers',group:'linen'},
  {collection:'#collection/Trousers/Cotton%20Dress%20Trousers',group:'cotton'},
];
for(const g of SHIPPED){
  const def=pin.groups[g.group];
  assert.ok(def,'the pin holds the '+g.group+' group');
  const col=collections[g.collection];
  assert.ok(col,'the '+g.collection+' collection exists');
  assert.equal(col.ids.length,def.fabrics.length,'the collection holds one product per pinned '+g.group+' fabric');
  const seen=new Set(),frontHashes=new Set(),backHashes=new Set();
  for(const id of col.ids){
    const p=byId.get(id);
    assert.ok(p,'collection product '+id+' resolves');
    assert.equal(p.kind,'pants','product '+p.sku+' is trousers');
    assert.equal(p.trouserGroup,g.group,'product '+p.sku+' belongs to the '+g.group+' fabric group');
    assert.ok(p.fabricCode,'product '+p.sku+' carries a fabric code');
    const pinEntry=def.fabrics.find(f=>f.code===p.fabricCode);
    assert.ok(pinEntry,'product '+p.sku+' fabric '+p.fabricCode+' is pinned for '+g.group);
    assert.equal(p.color,pinEntry.color,'product '+p.sku+' color matches its fabric pin');
    assert.equal(p.pattern,pinEntry.pattern,'product '+p.sku+' pattern matches its fabric pin');
    assert.equal(p.fabric,def.material,'product '+p.sku+' material matches its group');
    // The pin is honest: the code is a real active library suit
    // fabric of the group's material, with a swatch image.
    const lib=libByCode.get(p.fabricCode);
    assert.ok(lib,'fabric '+p.fabricCode+' exists in the library');
    assert.equal(lib.k,'suit','fabric '+p.fabricCode+' is a suit fabric');
    assert.equal(lib.act,1,'fabric '+p.fabricCode+' is active');
    assert.equal(lib.mat,def.material,'fabric '+p.fabricCode+' is '+def.material.toLowerCase());
    assert.ok(lib.img,'fabric '+p.fabricCode+' has a swatch image');
    assert.ok(!seen.has(p.fabricCode),'fabric '+p.fabricCode+' is used once in the group');
    seen.add(p.fabricCode);
    const expected='trouser-'+g.group+'-'+slug(p.color)+'-'+slug(p.pattern)+'.webp';
    assert.equal(p.img,expected,'product '+p.sku+' ('+p.color+' '+p.pattern+') uses the photo generated from fabric '+p.fabricCode);
    const file=path.join('public','assets',p.img);
    assert.ok(fs.existsSync(file),'photo file exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(file).size>50000,'photo file is a real image for '+p.sku+': '+p.img);
    const backFile=path.join('public','assets',p.img.replace('.webp','-back.webp'));
    assert.ok(fs.existsSync(backFile),'the product gallery back view exists for '+p.sku+': '+p.img);
    assert.ok(fs.statSync(backFile).size>50000,'back view is a real image for '+p.sku+': '+p.img);
    frontHashes.add(hashOf(file));backHashes.add(hashOf(backFile));
  }
  assert.equal(frontHashes.size,def.fabrics.length,'all '+g.group+' front photos have different image content');
  assert.equal(backHashes.size,def.fabrics.length,'all '+g.group+' back photos have different image content');
  console.log('JT '+g.group+' trousers: '+def.fabrics.length+' fabric defined products, photos generated per fabric');
}

// The rule lives in the generator and the pin, so the next catalog
// build keeps the mapping, and the code URL wiring is in place.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes('trouser-fabrics.json'),'generator reads the trouser fabrics pin');
assert.ok(generator.includes('addFabricCollection'),'generator builds fabric defined trousers collections');
const realRoutes=fs.readFileSync('public/real-routes.js','utf8');
assert.ok(realRoutes.includes("'#trouser/'"),'real routes map trousers code paths to the trouser route');
const merchant=fs.readFileSync('public/merchant.js','utf8');
assert.ok(merchant.includes("'/trousers/'+p.trouserGroup"),'product cards link fabric defined trousers to their fabric code URL');
const fabricLib=fs.readFileSync('public/fabric-library.js','utf8');
assert.ok(fabricLib.includes("startsWith('#trouser/')"),'the trouser route renders the product page for its fabric code');
assert.ok(fs.existsSync('app/trousers/[group]/[code]/route.ts'),'the trousers code route exists');

// Neighbours are untouched: shirts keep the shared shirt photo,
// women's trousers keep the women's photo, and an unshipped trousers
// group (tweed) keeps the grid and the shared photo until its turn.
const shirtArrivals=collections['#collection/Shirts/New%20Arrivals'];
assert.ok(shirtArrivals.ids.length>0,'shirts new arrivals exist');
assert.equal(byId.get(shirtArrivals.ids[0]).img,'model-shirt.webp','shirts keep their existing photo');
const womenTrousers=entries.filter(p=>p.category==='Women'&&p.kind==='pants'&&p.fabric==='Wool');
assert.ok(womenTrousers.length>0&&womenTrousers.every(p=>p.img==='model-woman.webp'),'women wool trousers keep the women photo');
const tweed=collections['#collection/Trousers/Tweed%20Trousers'];
assert.equal(tweed.ids.length,36,'unshipped tweed trousers keep the 36 product grid for now');
assert.ok(tweed.ids.every(id=>byId.get(id).img==='model-shirt.webp'),'unshipped tweed trousers keep the shared photo for now');

console.log('JT fabric defined trousers: ok (shipped groups built from real fabrics, neighbours unchanged)');
