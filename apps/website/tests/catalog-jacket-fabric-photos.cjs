const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Journey JF (jacket fabric photos): every jacket on the Jackets
// New Arrivals page used to render the same model-jacket.webp photo
// whatever its fabric, so a navy herringbone and a sand solid looked
// identical. Each wool jacket in the Jackets category now carries a
// photo generated for its own color and pattern, named
// jacket-<color>-<pattern>.webp, assigned by the catalog generator
// so a rebuild keeps the mapping. The shopper opening the
// collection sees 36 different photos, one per fabric, and other
// categories keep their existing photography. Driven on the real
// generated catalog data, in the style of the other suites.

const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+'\n;globalThis.__cap={catalogExpansion,collectionDefinitions};',ctx,{filename:'catalog-data.js'});
const entries=ctx.__cap.catalogExpansion,collections=ctx.__cap.collectionDefinitions;
assert.ok(Array.isArray(entries)&&entries.length>0,'catalog expansion loads');
const byId=new Map(entries.map(p=>[p.id,p]));

const slug=s=>s.toLowerCase().replace(/ /g,'-');
const arrivals=collections['#collection/Jackets/New%20Arrivals'];
assert.ok(arrivals,'the Jackets New Arrivals collection exists');
assert.equal(arrivals.ids.length,36,'the collection holds 36 jackets');
const seen=new Set();
for(const id of arrivals.ids){
  const p=byId.get(id);
  assert.ok(p,'collection product '+id+' resolves');
  assert.equal(p.kind,'jacket','product '+p.sku+' is a jacket');
  assert.equal(p.fabric,'Wool','product '+p.sku+' is wool');
  const expected='jacket-'+slug(p.color)+'-'+slug(p.pattern)+'.webp';
  assert.equal(p.img,expected,'product '+p.sku+' ('+p.color+' '+p.pattern+') uses its own fabric photo');
  assert.ok(!seen.has(p.img),'photo '+p.img+' is not repeated in the collection');
  seen.add(p.img);
  const file=path.join('public','assets',p.img);
  assert.ok(fs.existsSync(file),'photo file exists for '+p.sku+': '+p.img);
  assert.ok(fs.statSync(file).size>50000,'photo file is a real image for '+p.sku+': '+p.img);
  const back=p.img.replace('.webp','-back.webp'),backFile=path.join('public','assets',back);
  assert.ok(fs.existsSync(backFile),'the product gallery back view exists for '+p.sku+': '+back);
  assert.ok(fs.statSync(backFile).size>50000,'back view is a real image for '+p.sku+': '+back);
}
assert.equal(seen.size,36,'all 36 jackets show different photos');

// The rule lives in the generator, so the next catalog build keeps it.
const generator=fs.readFileSync('scripts/generate-catalog.cjs','utf8');
assert.ok(generator.includes("cat==='Jackets'&&s.kind==='jacket'&&s.material==='Wool'"),'generator assigns per fabric photos to wool jackets');
assert.ok(generator.includes('imageFor(cat,s,color,pattern)'),'generator call site passes color and pattern');

// Neighbours are untouched: suits keep their shared photo and tweed
// jackets keep the tweed photo.
const suitArrivals=collections['#collection/Suits/New%20Arrivals'];
assert.ok(suitArrivals.ids.length>0,'suits new arrivals exist');
assert.equal(byId.get(suitArrivals.ids[0]).img,'model-navy.webp','suits keep their existing photo');
assert.ok(entries.some(p=>p.img==='model-tweed.webp'),'tweed photography is unchanged');
assert.ok(entries.some(p=>p.img==='model-jacket.webp'),'non wool jackets keep the shared jacket photo');

console.log('JF jacket fabric photos: ok (36 unique per fabric photos, files present, neighbours unchanged)');
