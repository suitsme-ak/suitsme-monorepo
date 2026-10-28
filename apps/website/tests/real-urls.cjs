const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
// Wave 4 (NAV-01), Mechanic A. Stage 1 proved one collection at a real
// URL; stage 2 generalised collections: a generated route map
// (scripts/build-real-routes.cjs), a framework catch all route
// (app/collections/[...slug]/route.ts) and the boot script
// (public/real-routes.js, fed by the generated
// public/real-routes-data.js). Stage 3a completes the route families
// and moves internal links to real URLs:
//
// - the generated map also carries the single segment pages and the
//   parameterised families (fabrics and studio kinds, catalog product
//   id ranges, order detail), generated from the same sources with the
//   same fail loudly discipline;
// - app/fabrics/[kind], app/studio/[kind] and app/product/[id]
//   validate against the map (unknown kinds and ids 404 on the
//   server, non-canonical forms 308 to the canonical path),
//   app/orders/[id] serves any single segment id (order ids live in
//   the shopper's browser or in server order records, so the client
//   keeps rendering its own not found state), and one route file per
//   single segment page serves the shell;
// - menuLink and the rendered templates link to real URLs through
//   realUrlForHash, with labels, ordering and destination sets
//   identical to the pre migration baseline.
//
// This suite proves:
//  1. the committed generated map equals a fresh generation, every one
//     of the 147 catalog collection keys resolves through it to
//     exactly the destination it names today, slugs are unique per
//     category, the pages and families are exactly as specified, and
//     the product id ranges cover exactly the catalog ids;
//  2. the boot translation maps every canonical and alias collection
//     path, every page path and representative family paths (a fabrics
//     kind, each studio kind, a product id, an order id with its case
//     preserved), maps unknown kinds, unknown product ids and other
//     unknown paths to nothing, and never overrides an existing hash;
//     the reverse translation (realUrlForHash) round trips the whole
//     generated reverse map and passes the parameterised families
//     through;
//  3. the handlers serve the shared document for valid paths with the
//     root route's headers, redirect non-canonical forms, and 404
//     unknown slugs, kinds and product ids;
//  4. full storefront boots at real URLs render the screens they name
//     (Wool Suits in depth, one root and topic per menu category, the
//     Pants alias, a product, the fabrics listing, order detail's not
//     found state, customize, measure and checkout), with rendered
//     links in real URL form;
//  5. menu parity: the rendered menus carry the same anchor labels in
//     the same order and the same destination set as the pre migration
//     baseline, with every href now a real path that resolves through
//     the generated map or a family pattern;
//  6. the pre migration behaviour is unchanged: hash URLs at the root
//     render as before and the root boot sets no hash.
// Live server evidence (status codes from the built wrangler server)
// is recorded in docs/ux-audit/wave-4-spike.md, stage 3a addendum.

const menus=require('../data/reference-navigation.json');
const collections=require('../data/collections.json');
const committedMap=require('../data/real-routes.json');
const {buildRealRoutes}=require('../scripts/build-real-routes.cjs');
const catalog=require('../data/catalog.json');
const REAL_PATH='/collections/suits/wool-suits';
const WOOL_HASH='#collection/Suits/Wool%20Suits';
const woolIds=require('../data/suit-collections.json')['Wool Suits'].ids;
const EXPECTED_PAGES={'/customize':'#customize','/measure':'#measure','/checkout':'#checkout','/orders':'#orders','/gift-cards':'#gift-cards','/help':'#help','/locations':'#locations','/shipping':'#shipping','/privacy':'#privacy','/terms':'#terms','/fit-support':'#fit-support','/clone':'#clone','/charges':'#charges','/payment-return':'#payment-return'};

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

function makeWorld(location){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,store};
}

function bootLoc(location){
  const sandbox={location};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('public/real-routes-data.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('public/real-routes.js','utf8'),ctx);
  return sandbox;
}

// Compile a route handler the way the stage 2 checks do: the shared
// document and the generated map are substituted for the imports, the
// TypeScript is transpiled, and GET is invoked with a real Request.
const shellHtml=fs.readFileSync('web/index.html','utf8');
function routeGet(rel){
  const source=fs.readFileSync(rel,'utf8');
  const js=ts.transpileModule(source
    .replace(/import html from "[^"]+";/,`const html=${JSON.stringify(shellHtml)};`)
    .replace(/import routeMap from "[^"]+";/,`const routeMap=${JSON.stringify(committedMap)};`),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,Response,URL});
  return async path=>m.exports.GET(new Request('http://spike.test'+path));
}

(async()=>{

// ------------------------------------------------------------------ 1
{
  const fresh=buildRealRoutes(menus,collections,catalog);
  assert.deepEqual(committedMap,fresh,'the committed data/real-routes.json matches a fresh generation from the menu source, the catalog data and the product catalog');
  const dataCtx=vm.createContext({});
  vm.runInContext(fs.readFileSync('public/real-routes-data.js','utf8'),dataCtx);
  const plain=v=>JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(vm.runInContext('realRoutePaths',dataCtx)),committedMap.paths,'the boot data file carries the same canonical paths as the server map');
  assert.deepEqual(plain(vm.runInContext('realRouteAliases',dataCtx)),committedMap.aliases,'the boot data file carries the same alias paths as the server map');
  assert.deepEqual(plain(vm.runInContext('realRouteReverse',dataCtx)),committedMap.reverse,'the boot data file carries the same reverse map as the server map');
  assert.deepEqual(plain(vm.runInContext('realRoutePages',dataCtx)),committedMap.pages,'the boot data file carries the same page paths as the server map');
  assert.deepEqual(plain(vm.runInContext('realRouteFamilies',dataCtx)),committedMap.families,'the boot data file carries the same families as the server map');

  const keys=Object.keys(collections);
  assert.equal(keys.length,147,'the catalog still holds 147 collection keys');
  for(const key of keys){
    const path=committedMap.reverse[key];
    assert.ok(path,`catalog key ${key} has a real path in the generated map`);
    assert.ok(committedMap.paths[path],`the real path for ${key} is canonical`);
    assert.deepEqual(collections[committedMap.paths[path]],collections[key],`${key} resolves through the map to exactly the destination it names today`);
  }
  // Slug uniqueness per category, computed independently from the
  // menu source: no two menu destinations in a category slugify to
  // the same topic slug, and no two canonical paths coincide.
  const {slug}=require('../scripts/build-real-routes.cjs');
  for(const m of menus){
    const seen=new Map();
    for(const label of [...m.shortcuts,...m.groups.flatMap(g=>g[1])]){
      const s=slug(label);
      assert.ok(!seen.has(s),`slug collision in ${m.name}: "${label}" and "${seen.get(s)}" both slugify to ${s}`);
      seen.set(s,label);
    }
  }
  assert.equal(Object.keys(committedMap.paths).length,new Set(Object.keys(committedMap.paths)).size,'canonical paths are unique');
  for(const alias of Object.keys(committedMap.aliases))assert.ok(!(alias in committedMap.paths),`alias path ${alias} is not also a canonical path`);

  // Stage 3a additions: the pages are exactly the specified single
  // segment screens, none colliding with a collection path, and the
  // reverse map carries them plus home.
  assert.deepEqual(committedMap.pages,EXPECTED_PAGES,'the generated pages are exactly the single segment screens in the approved scheme');
  for(const [path,hash] of Object.entries(EXPECTED_PAGES)){
    assert.equal(committedMap.reverse[hash],path,`the reverse map carries ${hash} to ${path}`);
    assert.ok(!(path in committedMap.paths)&&!(path in committedMap.aliases),`page path ${path} does not collide with a collection path`);
  }
  assert.equal(committedMap.reverse['#home'],'/','the reverse map carries home to the root');
  assert.deepEqual(committedMap.families.fabrics,{kinds:['shirt','suit']},'the fabrics family carries exactly the kinds the merchant dispatch renders');
  assert.deepEqual(committedMap.families.studio,{kinds:['jacket','pants','suit']},'the studio family carries exactly the kinds the expanded dispatch renders');
  assert.deepEqual(committedMap.families.orders,{anySingleSegment:true},'the orders family is deliberately unvalidated: order ids are not enumerable');
  // The product id ranges cover exactly the catalog ids: every id is
  // in a range, and every integer in a range is a catalog id.
  const inRanges=id=>committedMap.families.product.idRanges.some(([lo,hi])=>id>=lo&&id<=hi);
  const catalogIds=new Set(catalog.map(p=>p.id));
  for(const id of catalogIds)assert.ok(inRanges(id),`catalog product id ${id} is covered by the generated ranges`);
  for(const [lo,hi] of committedMap.families.product.idRanges)for(let id=lo;id<=hi;id++)assert.ok(catalogIds.has(id),`the generated ranges claim product id ${id}, which the catalog does not hold`);
  console.log(`Route map checks passed: ${Object.keys(committedMap.paths).length} canonical paths, ${Object.keys(committedMap.aliases).length} alias paths, ${Object.keys(committedMap.pages).length} page paths and the parameterised families generated from source data, all 147 catalog keys resolve to the destinations they name today, slugs unique per category, product ranges covering exactly the ${catalogIds.size} catalog ids.`);
}

// ------------------------------------------------------------------ 2
{
  const probe=bootLoc({hash:'',pathname:'/'});
  for(const [path,hash] of Object.entries(committedMap.paths))
    assert.equal(probe.hashForRealPath(path),hash,`canonical path ${path} boots into ${hash}`);
  for(const [alias,target] of Object.entries(committedMap.aliases)){
    assert.equal(probe.canonicalRealPath(alias),target,`alias path ${alias} canonicalises to ${target}`);
    assert.equal(probe.hashForRealPath(alias),committedMap.paths[target],`alias path ${alias} boots into the canonical hash`);
  }
  for(const [path,hash] of Object.entries(committedMap.pages))
    assert.equal(probe.hashForRealPath(path),hash,`page path ${path} boots into ${hash}`);
  assert.equal(probe.hashForRealPath('/fabrics/suit'),'#fabrics/suit','the suit fabrics path boots into its listing');
  assert.equal(probe.hashForRealPath('/fabrics/shirt'),'#fabrics/shirt','the shirt fabrics path boots into its listing');
  assert.equal(probe.hashForRealPath('/studio/suit'),'#studio/suit');
  assert.equal(probe.hashForRealPath('/studio/jacket'),'#studio/jacket');
  assert.equal(probe.hashForRealPath('/studio/pants'),'#studio/pants');
  assert.equal(probe.hashForRealPath('/product/0'),'#product/0','the first catalog id boots');
  assert.equal(probe.hashForRealPath('/product/1964'),'#product/1964','a product path boots into its product route');
  assert.equal(probe.hashForRealPath('/product/2244'),'#product/2244','the last catalog id boots');
  assert.equal(probe.hashForRealPath('/product/01964'),'#product/1964','a leading zero spelling boots into the canonical product route');
  assert.equal(probe.hashForRealPath('/orders/DEMO-ABC123'),'#order/DEMO-ABC123','an order path boots into its order route with the id case preserved');
  assert.equal(probe.hashForRealPath('/orders/'),'#orders','the orders path with a trailing slash boots into the orders list');
  assert.equal(probe.hashForRealPath('/collections/suits/not-a-collection'),null,'an unknown topic maps to nothing');
  assert.equal(probe.hashForRealPath('/collections/not-a-category'),null,'an unknown category maps to nothing');
  assert.equal(probe.hashForRealPath('/collections'),null,'the bare collections path maps to nothing');
  assert.equal(probe.hashForRealPath('/fabrics/wool'),null,'an unknown fabrics kind maps to nothing');
  assert.equal(probe.hashForRealPath('/fabrics'),null,'the bare fabrics path maps to nothing');
  assert.equal(probe.hashForRealPath('/studio/tuxedo'),null,'an unknown studio kind maps to nothing');
  assert.equal(probe.hashForRealPath('/product/2245'),null,'the first id past the catalog maps to nothing');
  assert.equal(probe.hashForRealPath('/product/99999'),null,'an unknown product id maps to nothing');
  assert.equal(probe.hashForRealPath('/product/abc'),null,'a non-numeric product id maps to nothing');
  assert.equal(probe.hashForRealPath('/product/-1'),null,'a negative product id maps to nothing');
  assert.equal(probe.hashForRealPath('/orders/a/b'),null,'a two segment order path maps to nothing');
  assert.equal(probe.hashForRealPath('/not-a-page'),null,'an unknown single segment path maps to nothing');
  assert.equal(probe.hashForRealPath('/'),null,'the root path needs no translation');
  assert.equal(probe.hashForRealPath(''),null);
  assert.equal(probe.hashForRealPath(REAL_PATH+'/'),WOOL_HASH,'a trailing slash still maps');
  assert.equal(probe.hashForRealPath('/Collections/Suits/Wool-Suits'),WOOL_HASH,'case variants map');
  const loc={hash:'',pathname:REAL_PATH};
  bootLoc(loc);
  assert.equal(loc.hash,WOOL_HASH,'the boot sets the hash for a real path');
  const keep={hash:'#checkout',pathname:REAL_PATH};
  bootLoc(keep);
  assert.equal(keep.hash,'#checkout','an existing hash is never overridden');
  const keepFamily={hash:'#home',pathname:'/product/1964'};
  bootLoc(keepFamily);
  assert.equal(keepFamily.hash,'#home','an existing hash is never overridden on a family path either');
  const home={hash:'',pathname:'/'};
  bootLoc(home);
  assert.equal(home.hash,'','the home path is left alone');

  // The reverse translation the rendered links use.
  for(const [hash,path] of Object.entries(committedMap.reverse))
    assert.equal(probe.realUrlForHash(hash),path,`hash route ${hash} links to its real URL ${path}`);
  for(const [path,hash] of Object.entries(committedMap.paths))
    assert.equal(probe.hashForRealPath(path),hash,`real path ${path} boots back into ${hash}: the two translations agree`);
  assert.equal(probe.realUrlForHash('#product/1964'),'/product/1964','a product hash links to its real URL');
  assert.equal(probe.realUrlForHash('#order/DEMO-ABC123'),'/orders/DEMO-ABC123','an order hash links to its real URL with the id case preserved');
  assert.equal(probe.realUrlForHash('#fabrics/shirt'),'/fabrics/shirt','a fabrics hash links to its real URL');
  assert.equal(probe.realUrlForHash('#fabrics/wool'),'#fabrics/wool','a fabrics kind with no real route keeps its hash form');
  assert.equal(probe.realUrlForHash('#studio/pants'),'/studio/pants','a studio hash links to its real URL');
  assert.equal(probe.realUrlForHash('#story'),'/#craft','the story route links to the craft fragment on the home URL, per the approved scheme');
  assert.equal(probe.realUrlForHash('#no-such-route'),'#no-such-route','a hash with no real equivalent is returned unchanged');
  assert.equal(probe.realUrlForHash(''),'/','an empty hash links to the root');
  console.log('Boot translation checks passed: every canonical, alias and page path in the generated map translates, the fabrics, studio, product and orders families translate (unknown kinds and product ids map to nothing, order id case is preserved), variants normalise, existing hashes are untouched, and the reverse link translation round trips the whole map.');
}

// ------------------------------------------------------------------ 3
{
  assert.ok(!fs.existsSync('app/collections/suits/wool-suits/route.ts'),'the spike explicit Wool Suits route is retired');
  const source=fs.readFileSync('app/collections/[...slug]/route.ts','utf8');
  assert.ok(source.includes('from "../../../web/index.html?raw"'),'the catch all serves the shared storefront document');
  assert.ok(source.includes('from "../../../data/real-routes.json"'),'the catch all validates against the generated map');
  const html=shellHtml;
  assert.equal(fs.readFileSync('public/index.html','utf8'),html,'the two HTML copies stay identical');
  assert.ok(html.includes('<base href="/">'),'the document resolves relative URLs from the site root');
  assert.ok(html.indexOf('<script src="real-routes-data.js"></script>')>=0,'the generated route data is in the document');
  assert.ok(html.indexOf('real-routes-data.js')<html.indexOf('real-routes.js'),'the route data loads before the boot script');
  assert.ok(html.indexOf('real-routes.js')<html.indexOf('src="app.js"'),'the boot script runs before the storefront scripts');
  assert.ok(html.includes('<a class="logo" href="/"'),'the shell logo links to the real home URL');
  assert.ok(!html.includes('href="#'),'the shell carries no hash hrefs');
  const collectionsGet=await routeGet('app/collections/[...slug]/route.ts');

  for(const path of ['/collections/suits','/collections/jackets','/collections/trousers','/collections/shirts','/collections/weddings','/collections/more','/collections/women',REAL_PATH,'/collections/women/leather-trousers']){
    const res=await collectionsGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(res.headers.get('Content-Type'),'text/html; charset=utf-8',`${path} carries the root route content type`);
    assert.equal(res.headers.get('Cache-Control'),'no-cache',`${path} carries the root route cache header`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  const alias=await collectionsGet('/collections/pants/wool-pants');
  assert.equal(alias.status,308,'an alias path redirects');
  assert.equal(alias.headers.get('Location'),'/collections/trousers/wool-trousers','the alias redirects to the canonical path');
  const cased=await collectionsGet('/collections/Suits/Wool-Suits');
  assert.equal(cased.status,308,'a case variant redirects');
  assert.equal(cased.headers.get('Location'),REAL_PATH,'the case variant redirects to the canonical form');
  const slashed=await collectionsGet(REAL_PATH+'/');
  assert.equal(slashed.status,308,'a trailing slash that reaches the handler redirects');
  assert.equal(slashed.headers.get('Location'),REAL_PATH);
  for(const path of ['/collections/suits/not-a-collection','/collections/not-a-category','/collections/suits/wool-suits/extra','/collections']){
    const res=await collectionsGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }

  // Stage 3a: every single segment page route serves the shell.
  for(const path of Object.keys(committedMap.pages)){
    const seg=path.slice(1);
    const file=`app/${seg}/route.ts`;
    assert.ok(fs.existsSync(file),`the page route file exists for ${path}`);
    const pageGet=await routeGet(file);
    const res=await pageGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(res.headers.get('Content-Type'),'text/html; charset=utf-8',`${path} carries the root route content type`);
    assert.equal(res.headers.get('Cache-Control'),'no-cache',`${path} carries the root route cache header`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }

  // Fabrics and studio: valid kinds serve, unknown kinds 404,
  // non-canonical forms of valid kinds redirect.
  const fabricsGet=await routeGet('app/fabrics/[kind]/route.ts');
  for(const path of ['/fabrics/suit','/fabrics/shirt']){
    const res=await fabricsGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  for(const [path,to] of [['/fabrics/Suit','/fabrics/suit'],['/fabrics/shirt/','/fabrics/shirt']]){
    const res=await fabricsGet(path);
    assert.equal(res.status,308,`${path} redirects`);
    assert.equal(res.headers.get('Location'),to,`${path} redirects to the canonical form`);
  }
  for(const path of ['/fabrics/wool','/fabrics','/fabrics/suit/extra']){
    const res=await fabricsGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }
  const studioGet=await routeGet('app/studio/[kind]/route.ts');
  for(const path of ['/studio/suit','/studio/jacket','/studio/pants']){
    const res=await studioGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  const studioCased=await studioGet('/studio/Jacket');
  assert.equal(studioCased.status,308,'a cased studio kind redirects');
  assert.equal(studioCased.headers.get('Location'),'/studio/jacket');
  for(const path of ['/studio/tuxedo','/studio']){
    const res=await studioGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }

  // Product: existing ids serve, unknown and non-numeric ids 404,
  // non-canonical spellings of existing ids redirect.
  const productGet=await routeGet('app/product/[id]/route.ts');
  for(const path of ['/product/0','/product/1964','/product/2244']){
    const res=await productGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(res.headers.get('Content-Type'),'text/html; charset=utf-8',`${path} carries the root route content type`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  for(const [path,to] of [['/product/01964','/product/1964'],['/product/1964/','/product/1964']]){
    const res=await productGet(path);
    assert.equal(res.status,308,`${path} redirects`);
    assert.equal(res.headers.get('Location'),to,`${path} redirects to the canonical form`);
  }
  for(const path of ['/product/2245','/product/99999','/product/abc','/product/-1','/product','/product/1964/extra']){
    const res=await productGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }

  // Order detail serves any single segment id: ids are not the
  // server's to validate (see the comment in app/orders/[id]).
  const orderGet=await routeGet('app/orders/[id]/route.ts');
  for(const path of ['/orders/DEMO-ABC123','/orders/anything-at-all']){
    const res=await orderGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  console.log('Handler checks passed: collections serve, redirect and 404 as in stage 2; every page route serves the shared document with root route headers; fabrics and studio serve their valid kinds and 404 unknown kinds; product serves existing catalog ids and 404s unknown and non-numeric ids; order detail serves any single segment id.');
}

// ------------------------------------------------------------------ 4
{
  const loc={hash:'',pathname:REAL_PATH};
  const w=makeWorld(loc);
  assert.equal(loc.hash,WOOL_HASH,'booting at the real URL selects the Wool Suits route');
  const html=w.elFor('#main').innerHTML;
  assert.ok(html.includes('<h1>Wool Suits.</h1>'),'the Wool Suits collection renders as the page heading');
  assert.ok(html.includes('<p class="listing-count" role="status">10 results'),'the listing reports all ten Wool Suits designs');
  for(const id of woolIds){
    const p=catalog[id];
    assert.ok(html.includes('assets/'+p.img),`product ${id} photo renders`);
    assert.ok(html.includes(p.fabricCode),`product ${id} fabric code ${p.fabricCode} renders`);
  }
  assert.ok(html.includes('href="/product/1964"'),'the first Wool Suits product links onward at its real URL');
  assert.ok(w.elFor('#catalogNav').innerHTML.includes('href="/collections/suits/wool-suits"'),'the menu offers the Wool Suits destination at its real URL');
  w.run('chooseProduct(1964)');
  assert.equal(w.run('location.hash'),'#product/1964','opening a product from the real URL entry navigates');
  assert.ok(w.elFor('#main').innerHTML.includes(catalog[1964].name),'the opened product page renders');
  w.run("location.hash='#measure';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('MEASUREMENT STUDIO'),'a hash destination renders from the real URL entry');
  w.run(`location.hash='${WOOL_HASH}';render()`);
  assert.ok(w.elFor('#main').innerHTML.includes('<h1>Wool Suits.</h1>'),'navigating back returns to Wool Suits');

  // One root and one topic per menu category, computed from the map.
  const {slug}=require('../scripts/build-real-routes.cjs');
  for(const m of menus){
    const rootPath='/collections/'+slug(m.name);
    const rootHash=committedMap.paths[rootPath];
    assert.ok(rootHash,`the map carries the ${m.name} category root`);
    const rootLoc={hash:'',pathname:rootPath};
    const rootWorld=makeWorld(rootLoc);
    assert.equal(rootLoc.hash,rootHash,`booting at ${rootPath} selects ${rootHash}`);
    assert.equal(rootWorld.run(`resolveCollection('${rootHash}').title`),collections[rootHash].title,`the ${m.name} root renders its named collection`);
    assert.ok(rootWorld.elFor('#main').innerHTML.includes('class="products"'),`the ${m.name} root renders a product listing`);

    const topicPath=Object.keys(committedMap.paths).filter(p=>p.startsWith(rootPath+'/')).sort()[0];
    const topicHash=committedMap.paths[topicPath];
    const topicLoc={hash:'',pathname:topicPath};
    const topicWorld=makeWorld(topicLoc);
    assert.equal(topicLoc.hash,topicHash,`booting at ${topicPath} selects ${topicHash}`);
    assert.equal(topicWorld.run(`resolveCollection('${topicHash}').title`),collections[topicHash].title,`the ${m.name} topic at ${topicPath} renders its named collection`);
    assert.ok(topicWorld.elFor('#main').innerHTML.includes('class="products"'),`the ${m.name} topic renders a product listing`);
  }

  // An alias entry renders the canonical destination.
  const aliasLoc={hash:'',pathname:'/collections/pants/wool-pants'};
  const aliasWorld=makeWorld(aliasLoc);
  assert.equal(aliasLoc.hash,'#collection/Trousers/Wool%20Trousers','entering through the Pants alias selects the canonical Trousers hash');
  assert.equal(aliasWorld.run("resolveCollection(location.hash).title"),'Wool Trousers','the alias entry renders the canonical collection');

  // Stage 3a family entries.
  const productLoc={hash:'',pathname:'/product/1964'};
  const productWorld=makeWorld(productLoc);
  assert.equal(productLoc.hash,'#product/1964','booting at the real product URL selects the product route');
  const productHtml=productWorld.elFor('#main').innerHTML;
  assert.ok(productHtml.includes('product-page'),'the product page renders from the real URL entry');
  assert.ok(productHtml.includes(catalog[1964].name),'the rendered product is the one the URL names');
  assert.ok(!productHtml.includes('href="#'),'the rendered product page carries no hash hrefs');

  const fabricsLoc={hash:'',pathname:'/fabrics/suit'};
  const fabricsWorld=makeWorld(fabricsLoc);
  assert.equal(fabricsLoc.hash,'#fabrics/suit','booting at the real fabrics URL selects the fabrics route');
  assert.ok(fabricsWorld.elFor('#main').innerHTML.includes('<span class="eyebrow">Fabrics</span>'),'the fabrics listing renders from the real URL entry');
  assert.ok(fabricsWorld.elFor('#main').innerHTML.includes('<h1>Suit fabrics.</h1>'),'the suit fabrics listing renders its heading');

  const orderLoc={hash:'',pathname:'/orders/DEMO-NOTREAL'};
  const orderWorld=makeWorld(orderLoc);
  assert.equal(orderLoc.hash,'#order/DEMO-NOTREAL','booting at a real order URL selects the order route');
  assert.ok(orderWorld.elFor('#main').innerHTML.includes('<h1>Your orders.</h1>'),'an unknown order id renders the client side not found state, the orders list, exactly as the hash route does');

  const customizeLoc={hash:'',pathname:'/customize'};
  const customizeWorld=makeWorld(customizeLoc);
  assert.equal(customizeLoc.hash,'#customize','booting at the real customize URL selects the customizer');
  assert.ok(customizeWorld.elFor('#main').innerHTML.includes('config-layout'),'the customizer renders from the real URL entry');

  const measureLoc={hash:'',pathname:'/measure'};
  const measureWorld=makeWorld(measureLoc);
  assert.equal(measureLoc.hash,'#measure','booting at the real measure URL selects the measurement studio');
  assert.ok(measureWorld.elFor('#main').innerHTML.includes('MEASUREMENT STUDIO'),'the measurement studio renders from the real URL entry');

  const checkoutLoc={hash:'',pathname:'/checkout'};
  const checkoutWorld=makeWorld(checkoutLoc);
  assert.equal(checkoutLoc.hash,'#checkout','booting at the real checkout URL selects checkout');
  assert.ok(checkoutWorld.elFor('#main').innerHTML.includes('Let’s find your first piece.'),'checkout renders its empty bag state from the real URL entry');
  console.log('Real URL entry checks passed: Wool Suits renders in depth from its real URL, one root and one topic per menu category render the collections the map names, the Pants alias renders the canonical Trousers destination, and the product, fabrics, order, customize, measure and checkout entries render their screens.');
}

// ------------------------------------------------------------------ 5
{
  // Menu parity against the pre migration baseline: the same anchor
  // labels in the same order, the same destination set, with every
  // href now a real path. The baseline is computed from the menu
  // source alone: navigation.js filters five historical Suits labels
  // (recorded in its removedSuitCategories set), and menuLink's
  // destination rules are the documented ones (service labels to
  // their screens, 3D labels to the studio kinds, everything else to
  // its collection).
  const removedSuitCategories=new Set(['Italian Limited Edition','Tweed Suits','Leather Suits','Napolean Wool Suits','Murano Suits']);
  const baselineLabels=[],baselineHashes=new Set();
  for(const m of menus){
    const items=[...m.shortcuts,...m.groups.flatMap(g=>g[1])].filter(item=>!(m.name==='Suits'&&removedSuitCategories.has(item)));
    for(const item of items){
      baselineLabels.push(item);
      if(item==='Fit Guarantee')baselineHashes.add('#fit-support');
      else if(/^3d/i.test(item))baselineHashes.add('#studio/'+(m.name==='Trousers'?'pants':m.name==='Jackets'?'jacket':'suit'));
      else if(item==='Clone Garments')baselineHashes.add('#clone');
      else if(item==='Other Charges')baselineHashes.add('#charges');
      else if(item==='Gift Cards')baselineHashes.add('#gift-cards');
      else baselineHashes.add('#collection/'+encodeURIComponent(m.name)+'/'+encodeURIComponent(item));
    }
  }
  const w=makeWorld({hash:'',pathname:'/'});
  const navHtml=w.elFor('#catalogNav').innerHTML;
  const chunks=navHtml.split('<details class="nav-item"').slice(1);
  assert.equal(chunks.length,7,'all seven menus render');
  const anchors=[];
  for(const chunk of chunks)for(const m of chunk.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g))anchors.push({href:m[1],label:m[2]});
  assert.equal(anchors.length,96,'the rendered menu anchor count matches the audited baseline of 96');
  assert.deepEqual(anchors.map(a=>a.label),baselineLabels,'the rendered menu labels match the pre migration baseline, in order');
  const pathToHash={...committedMap.pages};
  for(const [path,hash] of Object.entries(committedMap.paths))pathToHash[path]=hash;
  for(const [alias,target] of Object.entries(committedMap.aliases))pathToHash[alias]=committedMap.paths[target];
  const familyToHash=href=>{
    const m=/^\/(fabrics|studio)\/([a-z]+)$/.exec(href);
    if(m&&committedMap.families[m[1]].kinds.includes(m[2]))return '#'+m[1]+'/'+m[2];
    return null;
  };
  const renderedHashes=new Set();
  for(const a of anchors){
    assert.ok(a.href.startsWith('/'),'every menu href is a real path: '+a.href);
    assert.ok(!a.href.includes('#'),'no menu href carries a hash: '+a.href);
    const hash=pathToHash[a.href]||familyToHash(a.href);
    assert.ok(hash,`menu href ${a.href} resolves through the generated map or a family pattern`);
    if(hash.startsWith('#collection/'))assert.ok(collections[hash],`menu href ${a.href} names a collection that exists`);
    renderedHashes.add(hash);
  }
  assert.equal(new Set(anchors.map(a=>a.href)).size,94,'the rendered destination count matches the audited baseline of 94');
  assert.deepEqual(renderedHashes,baselineHashes,'the rendered destinations are exactly the pre migration destination set, translated to real URLs');
  console.log('Menu parity checks passed: 96 anchors with the baseline labels in order and the baseline set of 94 destinations, every href a real path resolving through the generated map or a family pattern.');
}

// ------------------------------------------------------------------ 6
{
  const loc={hash:WOOL_HASH,pathname:'/'};
  const w=makeWorld(loc);
  assert.equal(loc.hash,WOOL_HASH,'the hash URL is left exactly as it was');
  assert.ok(w.elFor('#main').innerHTML.includes('<h1>Wool Suits.</h1>'),'the hash URL renders the same collection');
  const homeLoc={hash:'',pathname:'/'};
  const home=makeWorld(homeLoc);
  assert.equal(homeLoc.hash,'','the root boot sets no hash');
  assert.ok(!home.elFor('#main').innerHTML.includes('<h1>Wool Suits.</h1>'),'the root still renders the home page, not the collection');
  console.log('Compatibility checks passed: the existing hash URL renders Wool Suits unchanged and the root boot is untouched.');
}

})().catch(e=>{console.error(e);process.exit(1)});
