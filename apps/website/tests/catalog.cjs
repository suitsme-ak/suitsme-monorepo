const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=require('../data/catalog.json'),collections=require('../data/collections.json'),menus=require('../data/reference-navigation.json'),prices=require('../lib/catalog.json');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/catalog-data.js','utf8')+';globalThis.entries=catalogExpansion;globalThis.collections=collectionDefinitions;',context);
assert.equal(context.entries.length+19,catalog.filter(p=>!p.merchantFabric).length);assert.deepEqual(JSON.parse(JSON.stringify(context.collections)),collections);
assert.deepEqual(menus.map(m=>m.name),['Suits','Jackets','Trousers','Shirts','Weddings','More','Women']);
let shopping=0,services=0;const routes=new Set();
for(const menu of menus){assert.ok(menu.groups.length);for(const item of [...menu.shortcuts,...menu.groups.flatMap(g=>g[1])]){
 if(['Fit Guarantee','Clone Garments','Other Charges','Gift Cards'].includes(item)||/^3d/i.test(item)){services++;continue;}
 const route='#collection/'+encodeURIComponent(menu.name)+'/'+encodeURIComponent(item);assert.ok(collections[route],route);routes.add(route);
}}
for(const route of routes){shopping++;const c=collections[route];assert.ok(c.ids.length>=36,route);assert.equal(new Set(c.ids).size,c.ids.length,route+' repeated IDs');const designs=c.ids.map(i=>{const p=catalog[i];assert.ok(p,route+' missing product');return [p.category,p.fabric,p.color,p.pattern,p.silhouette,p.kind].join('|')});assert.equal(new Set(designs).size,designs.length,route+' repeated designs');assert.equal(new Set(c.ids.map(i=>catalog[i].name)).size,c.ids.length,route+' repeated names');}
for(const [i,p] of catalog.entries()){assert.equal(p.id,i);assert.equal(prices[i].priceCents,p.price*100);assert.ok(fs.existsSync('public/assets/'+p.img),p.img);assert.ok(p.price>0);assert.ok(p.sku);}
assert.equal(new Set(catalog.map(p=>p.sku)).size,catalog.length);assert.equal(catalog[0].name,'The Everyday Navy');assert.equal(catalog[18].kind,'gift');
for(const file of ['app.js','complete.js','expanded.js','navigation.js','catalog-data.js','navigation-data.js','gallery.js','quick-add.js','merchant.js','merchant-data.js'])new vm.Script(fs.readFileSync('public/'+file,'utf8'),{filename:file});
assert.equal(fs.readFileSync('web/index.html','utf8'),fs.readFileSync('public/index.html','utf8'));
console.log(`Catalog checks passed: ${catalog.length} unique SKUs, ${shopping} shopping menu destinations, ${services} service links, minimum 36 distinct designs per collection, server prices, source syntax, assets, stable legacy IDs.`);

const galleryContext=vm.createContext({productPage(){return ""},render(){},document:{addEventListener(){}}});vm.runInContext(fs.readFileSync("public/gallery.js","utf8")+";globalThis.views=productImages;",galleryContext);
for(const p of catalog.filter(p=>p.kind!=="gift"&&!p.merchantFabric)){const views=galleryContext.views(p);assert.equal(views.length,3);assert.equal(new Set(views.map(v=>v.src)).size,2);for(const v of views)assert.ok(fs.existsSync("public/assets/"+v.src),v.src);}
console.log("All garment/accessory galleries have front/overview, generated companion and detail views; image references verified.");

const merchant=catalog.filter(p=>p.merchantFabric&&!p.suitEditVariant),source=require('../data/merchant-fabrics.json').fabrics,models=require('../data/merchant-models.json');
assert.equal(merchant.length,456);assert.equal(merchant.filter(p=>p.kind==='suit').length,256);assert.equal(merchant.filter(p=>p.kind==='shirt').length,200);
for(const p of merchant){const f=source.find(f=>f.kind===p.kind&&f.fabric_code===p.fabricCode);assert.ok(f);assert.equal(p.fabricImage,f.image);assert.ok(fs.existsSync('public/assets/'+p.fabricImage));assert.equal(prices[p.id].fabricCode,p.fabricCode);if(p.hasModel){assert.equal((p.modelKey?require('../data/suit-edit-models.json')[p.modelKey]:models[p.kind+':'+p.fabricCode]).image,p.img);assert.notEqual(p.img,p.fabricImage)}else assert.equal(p.img,p.fabricImage);}
for(const kind of ['suit','shirt'])assert.equal(merchant.filter(p=>p.kind===kind&&p.launch&&p.hasModel).length,36);
console.log('Merchant catalog: 456 original swatches, 36 suit and 36 shirt fabric-matched model images, server-owned fabric codes and complete asset mappings verified.');

const suitEdits=require('../data/suit-collections.json'),cast=require('../data/suit-edit-models.json');
for(const [name,c] of Object.entries(suitEdits)){assert.equal(c.ids.length,10,name);assert.equal(new Set(c.ids).size,10,name);const looks=c.ids.map(id=>catalog[id]);assert.equal(new Set(looks.map(p=>p.img)).size,10,name+' needs different photos');assert.equal(new Set(looks.map(p=>p.modelCasting)).size,10,name+' needs different models');for(const p of looks){assert.ok(p.hasModel,name);assert.ok(source.some(f=>f.kind==='suit'&&f.fabric_code===p.fabricCode));assert.equal(cast[p.modelKey].image,p.img);assert.ok(fs.existsSync('public/assets/'+p.img));}}
for(const [name,style]of [['Double Breasted Suits','Double breasted'],['Tuxedos','Tuxedo'],['Boys Suits','Boys two-piece']])assert.ok(suitEdits[name].ids.every(id=>catalog[id].silhouette===style));
console.log('All Suits edits have 10 different fabric-linked photographs and model castings, with correct style variants.');
