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
// Stage 3b completes the rollout: per route head injection, the
// generated sitemap, and the two copies question:
//
// - the generated map also carries per route heads (collection heads
//   derived from the menu label and category, page and family copy
//   from the generator's tables, state pages marked noindex), and
//   the handlers rewrite the served head through the shared helper
//   lib/route-head.ts: route specific title, description, canonical
//   and robots, with product values looked up in the catalog;
// - scripts/build-sitemap.cjs generates public/sitemap.xml from the
//   route map and the catalog (home, 101 collections, 2,245
//   products, the indexable pages), chained into the build;
// - the web/index.html mirror is retired: every handler imports
//   public/index.html directly, proven against the built server
//   before the mirror was deleted (identical bytes on every family,
//   redirects and 404s unchanged; see the stage 3b addendum in
//   docs/ux-audit/wave-4-spike.md).
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
//     render as before and the root boot sets no hash;
//  7. the served head is rewritten per route: the document each
//     handler returns equals the shell with exactly the expected
//     title, description, canonical and robots injected (an
//     independent injector below computes the expectation), literal
//     spot checks pin one route of each family, alias and
//     non-canonical redirects carry no injection, and the root route
//     serves the shell with its own home head;
//  8. the sitemap is fresh (it equals a fresh generation), lists
//     exactly the canonical indexable URLs counted from source data
//     (home, every collection, every product, the indexable pages),
//     never lists a state page, and robots.txt points at it.
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
const EXPECTED_PAGES={'/customize':'#customize','/measure':'#measure','/checkout':'#checkout','/orders':'#orders','/gift-cards':'#gift-cards','/help':'#help','/locations':'#locations','/shipping':'#shipping','/privacy':'#privacy','/terms':'#terms','/fit-support':'#fit-support','/clone':'#clone','/charges':'#charges','/payment-return':'#payment-return','/sign-in':'#sign-in','/register':'#register','/forgot-password':'#forgot-password','/reset-password':'#reset-password','/verify-email':'#verify-email','/account':'#account'};

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
// Stage 3b adds two substitutions in the same style: the shared head
// helper lib/route-head.ts is compiled once (with the committed map
// substituted for its import) and its exports are handed to each
// handler, and the product handler's catalog import is substituted
// with the committed catalog.
const shellHtml=fs.readFileSync('public/index.html','utf8');
const routeHeadExports=(()=>{
  const source=fs.readFileSync('lib/route-head.ts','utf8');
  const js=ts.transpileModule(source
    .replace(/import routeMap from "[^"]+";/,`const routeMap=${JSON.stringify(committedMap)};`),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,Response,URL});
  return m.exports;
})();
function routeGet(rel){
  let source=fs.readFileSync(rel,'utf8');
  source=source
    .replace(/import html from "[^"]+";/,`const html=${JSON.stringify(shellHtml)};`)
    .replace(/import routeMap from "[^"]+";/,`const routeMap=${JSON.stringify(committedMap)};`)
    .replace(/import \{[^}]+\} from "[^"]*route-head";/,`const {shellResponse,headForCollection,headForPage,headForFamily,headForProduct,headForOrderDetail}=__routeHead;`);
  if(source.includes('data/catalog.json'))
    source=source.replace(/import catalog from "[^"]+";/,`const catalog=${JSON.stringify(catalog)};`);
  const js=ts.transpileModule(source,
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,Response,URL,__routeHead:routeHeadExports});
  return async path=>m.exports.GET(new Request('http://spike.test'+path));
}

// Stage 3b: an independent injector, used only to compute the
// documents the handlers are expected to serve. It re-implements the
// head rewrite from the shell and the expected values, so a bug in
// lib/route-head.ts cannot make the expectation wrong in the same
// way; literal spot checks in section 3 pin the values themselves.
const escAttr=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function expectedDoc({title,description,canonicalPath,robots}){
  const t=escAttr(title),d=escAttr(description),c=escAttr('https://suits.me'+canonicalPath);
  const r=robots==='noindex'?'noindex,nofollow':'index,follow,max-image-preview:large';
  return shellHtml
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${d}">`)
    .replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${c}">`)
    .replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${r}">`)
    .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${t}">`)
    .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${d}">`)
    .replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${c}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/,`<meta name="twitter:title" content="${t}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/,`<meta name="twitter:description" content="${d}">`);
}
const collectionDoc=path=>expectedDoc({title:committedMap.heads.collections[path].title,description:committedMap.heads.collections[path].description,canonicalPath:path,robots:'index'});
const pageDoc=path=>{const h=committedMap.heads.pages[path];return expectedDoc({title:h.title,description:h.description,canonicalPath:path,robots:h.robots})};
const familyDoc=(family,kind)=>{const h=committedMap.heads.families[family][kind];return expectedDoc({title:h.title,description:h.description,canonicalPath:`/${family}/${kind}`,robots:'index'})};
const PRODUCT_NOUNS={suit:'suit',jacket:'jacket',waistcoat:'waistcoat',pants:'trousers',shirt:'shirt',accessory:'accessory set',swatch:'fabric swatch set',gift:'gift card'};
const productDoc=id=>{const p=catalog[id];return expectedDoc({title:`${p.name} | Suits.me`,description:`${p.name} at Suits.me: a ${p.fabric} ${PRODUCT_NOUNS[p.kind]||'garment'} from the ${p.category} collection, custom tailored to your measurements. Choose your details and build your fit profile.`,canonicalPath:`/product/${id}`,robots:'index'})};

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
  // Stage 3b: the generated heads cover exactly the routes they
  // describe, collection values derive from the destination's menu
  // label and category, and the state pages are the noindex ones.
  assert.deepEqual(Object.keys(committedMap.heads.collections).sort(),Object.keys(committedMap.paths).sort(),'every canonical collection path carries a head, and no other path does');
  for(const [path,head] of Object.entries(committedMap.heads.collections)){
    const hash=committedMap.paths[path];
    const dec=s=>{try{return decodeURIComponent(s)}catch{return s}};
    const parts=hash.split('/');
    const label=parts.length>2?dec(parts.slice(2).join('/')):dec(parts[1]);
    assert.equal(head.title,`${label} | Suits.me`,`the ${path} head title derives from its menu label`);
    assert.ok(head.description.includes(label),`the ${path} head description names its label`);
    assert.ok(head.description.includes('Suits.me'),`the ${path} head description names the site`);
  }
  assert.deepEqual(Object.keys(committedMap.heads.pages).sort(),Object.keys(committedMap.pages).sort(),'every page carries a head, and no other path does');
  for(const path of ['/customize','/checkout','/orders','/payment-return'])
    assert.equal(committedMap.heads.pages[path].robots,'noindex',`the state page ${path} is marked noindex`);
  for(const path of ['/measure','/gift-cards','/help','/locations','/shipping','/privacy','/terms','/fit-support','/clone','/charges'])
    assert.equal(committedMap.heads.pages[path].robots,'index',`the content page ${path} is indexable`);
  assert.deepEqual(Object.keys(committedMap.heads.families.fabrics).sort(),[...committedMap.families.fabrics.kinds].sort(),'every fabrics kind carries a head');
  assert.deepEqual(Object.keys(committedMap.heads.families.studio).sort(),[...committedMap.families.studio.kinds].sort(),'every studio kind carries a head');
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
  assert.ok(source.includes('from "../../../public/index.html?raw"'),'the catch all serves the shared storefront document, imported from its single source');
  assert.ok(source.includes('from "../../../data/real-routes.json"'),'the catch all validates against the generated map');
  const html=shellHtml;
  assert.ok(!fs.existsSync('web/index.html'),'the web/index.html mirror is retired: public/index.html is the single shell source');
  // Stage 3b: the head injection rewrites nine anchored head
  // elements; each anchor must occur exactly once in the shell, so a
  // shell edit that breaks an anchor fails here instead of silently
  // serving the home head for a route.
  for(const anchor of ['<title>','name="description"','rel="canonical"','name="robots"','property="og:title"','property="og:description"','property="og:url"','name="twitter:title"','name="twitter:description"'])
    assert.equal(html.split(anchor).length-1,1,`the shell carries exactly one ${anchor} anchor for the head injection`);
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
    assert.equal(await res.text(),collectionDoc(path),`${path} returns the storefront document with its own head injected`);
  }
  // Stage 3b: every canonical collection path serves its own head.
  for(const path of Object.keys(committedMap.paths)){
    const res=await collectionsGet(path);
    assert.equal(res.status,200,`${path} serves`);
    assert.equal(await res.text(),collectionDoc(path),`${path} serves its own injected head`);
  }
  // Literal spot checks, independent of the generated data: the
  // Wool Suits title, canonical and robots, and an ampersand label
  // escaped in the injected title.
  const woolDoc=await (await collectionsGet(REAL_PATH)).text();
  assert.ok(woolDoc.includes('<title>Wool Suits | Suits.me</title>'),'literal: the Wool Suits title');
  assert.ok(woolDoc.includes('<meta name="description" content="Explore Wool Suits in the Suits collection at Suits.me: custom tailoring made to your measurements. Choose your fabric, refine the details, and build your fit profile.">'),'literal: the Wool Suits description');
  assert.ok(woolDoc.includes('<link rel="canonical" href="https://suits.me/collections/suits/wool-suits">'),'literal: the Wool Suits canonical');
  assert.ok(woolDoc.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),'literal: collections are indexable');
  assert.ok(woolDoc.includes('<meta property="og:url" content="https://suits.me/collections/suits/wool-suits">'),'the Open Graph URL follows the canonical');
  assert.ok(committedMap.paths['/collections/suits/cocktail-and-evening-suits'],'the cocktail and evening path is canonical');
  const cocktailDoc=await (await collectionsGet('/collections/suits/cocktail-and-evening-suits')).text();
  assert.ok(cocktailDoc.includes('<title>Cocktail &amp; Evening Suits | Suits.me</title>'),'an ampersand in a menu label is escaped in the injected title');
  assert.ok(!cocktailDoc.includes('<title>Cocktail & Evening'),'the unescaped label never reaches the title');
  const alias=await collectionsGet('/collections/pants/wool-pants');
  assert.equal(alias.status,308,'an alias path redirects');
  assert.equal(alias.headers.get('Location'),'/collections/trousers/wool-trousers','the alias redirects to the canonical path');
  assert.equal(await alias.text(),'','an alias redirect carries no injected document');
  const cased=await collectionsGet('/collections/Suits/Wool-Suits');
  assert.equal(cased.status,308,'a case variant redirects');
  assert.equal(cased.headers.get('Location'),REAL_PATH,'the case variant redirects to the canonical form');
  assert.equal(await cased.text(),'','a canonicalisation redirect carries no injected document');
  const slashed=await collectionsGet(REAL_PATH+'/');
  assert.equal(slashed.status,308,'a trailing slash that reaches the handler redirects');
  assert.equal(slashed.headers.get('Location'),REAL_PATH);
  assert.equal(await slashed.text(),'','a trailing slash redirect carries no injected document');
  for(const path of ['/collections/suits/not-a-collection','/collections/not-a-category','/collections/suits/wool-suits/extra','/collections']){
    const res=await collectionsGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }

  // The root route serves the shell exactly as it stands: the
  // shell's own head is the home head (stage 3b injects nothing at
  // the root).
  const rootGet=await routeGet('app/route.ts');
  const rootRes=await rootGet('/');
  assert.equal(rootRes.status,200,'the root route serves');
  assert.equal(await rootRes.text(),html,'the root route returns the storefront document byte for byte, with its own home head');

  // Stage 3a: every single segment page route serves the shell.
  // Stage 3b: with the page's own head injected.
  for(const path of Object.keys(committedMap.pages)){
    const seg=path.slice(1);
    const file=`app/${seg}/route.ts`;
    assert.ok(fs.existsSync(file),`the page route file exists for ${path}`);
    const pageGet=await routeGet(file);
    const res=await pageGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(res.headers.get('Content-Type'),'text/html; charset=utf-8',`${path} carries the root route content type`);
    assert.equal(res.headers.get('Cache-Control'),'no-cache',`${path} carries the root route cache header`);
    assert.equal(await res.text(),pageDoc(path),`${path} returns the storefront document with its own head injected`);
  }
  // Literal spot checks for the two page kinds: a content page
  // (indexable, its own copy) and a state page (noindex).
  const measureDoc=await (await (await routeGet('app/measure/route.ts'))('/measure')).text();
  assert.ok(measureDoc.includes('<title>Measurement Studio | Suits.me</title>'),'literal: the measure title');
  assert.ok(measureDoc.includes('<link rel="canonical" href="https://suits.me/measure">'),'literal: the measure canonical');
  assert.ok(measureDoc.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),'literal: the content pages are indexable');
  const checkoutDoc=await (await (await routeGet('app/checkout/route.ts'))('/checkout')).text();
  assert.ok(checkoutDoc.includes('<title>Checkout | Suits.me</title>'),'literal: the checkout title');
  assert.ok(checkoutDoc.includes('<meta name="robots" content="noindex,nofollow">'),'literal: the state pages carry noindex');
  assert.ok(checkoutDoc.includes('<link rel="canonical" href="https://suits.me/checkout">'),'literal: the checkout canonical points at its own URL');
  const paymentDoc=await (await (await routeGet('app/payment-return/route.ts'))('/payment-return')).text();
  assert.ok(paymentDoc.includes('<meta name="robots" content="noindex,nofollow">'),'literal: the payment return carries noindex');
  // Wave 5 package 5.4: the account screens join the page set as
  // noindex state pages with their own heads, exactly like checkout.
  const signInDoc=await (await (await routeGet('app/sign-in/route.ts'))('/sign-in')).text();
  assert.ok(signInDoc.includes('<title>Sign in | Suits.me</title>'),'literal: the sign in title');
  assert.ok(signInDoc.includes('<meta name="robots" content="noindex,nofollow">'),'literal: the sign in page carries noindex');
  assert.ok(signInDoc.includes('<link rel="canonical" href="https://suits.me/sign-in">'),'literal: the sign in canonical points at its own URL');
  const accountDoc2=await (await (await routeGet('app/account/route.ts'))('/account')).text();
  assert.ok(accountDoc2.includes('<title>Your account | Suits.me</title>'),'literal: the account title');
  assert.ok(accountDoc2.includes('<meta name="robots" content="noindex,nofollow">'),'literal: the account page carries noindex');
  const verifyDoc=await (await (await routeGet('app/verify-email/route.ts'))('/verify-email')).text();
  assert.ok(verifyDoc.includes('<title>Confirm your email | Suits.me</title>'),'literal: the verify email title');
  assert.ok(verifyDoc.includes('<meta name="robots" content="noindex,nofollow">'),'literal: the verify email page carries noindex');

  // Fabrics and studio: valid kinds serve, unknown kinds 404,
  // non-canonical forms of valid kinds redirect.
  const fabricsGet=await routeGet('app/fabrics/[kind]/route.ts');
  for(const path of ['/fabrics/suit','/fabrics/shirt']){
    const res=await fabricsGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(await res.text(),familyDoc('fabrics',path.split('/')[2]),`${path} returns the storefront document with its own head injected`);
  }
  const fabricsDoc=await (await fabricsGet('/fabrics/suit')).text();
  assert.ok(fabricsDoc.includes('<title>Suit fabrics | Suits.me</title>'),'literal: the suit fabrics title');
  assert.ok(fabricsDoc.includes('<link rel="canonical" href="https://suits.me/fabrics/suit">'),'literal: the suit fabrics canonical');
  for(const [path,to] of [['/fabrics/Suit','/fabrics/suit'],['/fabrics/shirt/','/fabrics/shirt']]){
    const res=await fabricsGet(path);
    assert.equal(res.status,308,`${path} redirects`);
    assert.equal(res.headers.get('Location'),to,`${path} redirects to the canonical form`);
    assert.equal(await res.text(),'','a fabrics redirect carries no injected document');
  }
  for(const path of ['/fabrics/wool','/fabrics','/fabrics/suit/extra']){
    const res=await fabricsGet(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }
  const studioGet=await routeGet('app/studio/[kind]/route.ts');
  for(const path of ['/studio/suit','/studio/jacket','/studio/pants']){
    const res=await studioGet(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(await res.text(),familyDoc('studio',path.split('/')[2]),`${path} returns the storefront document with its own head injected`);
  }
  const studioDoc=await (await studioGet('/studio/pants')).text();
  assert.ok(studioDoc.includes('<title>3D trousers configurator | Suits.me</title>'),'literal: the trousers configurator title');
  const studioCased=await studioGet('/studio/Jacket');
  assert.equal(studioCased.status,308,'a cased studio kind redirects');
  assert.equal(studioCased.headers.get('Location'),'/studio/jacket');
  assert.equal(await studioCased.text(),'','a studio redirect carries no injected document');
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
    assert.equal(await res.text(),productDoc(Number(path.split('/')[2])),`${path} returns the storefront document with the product head injected`);
  }
  // Literal spot checks: the injected product values come from the
  // catalog entry the page renders.
  const product1964Doc=await (await productGet('/product/1964')).text();
  assert.ok(product1964Doc.includes('<title>Black Solid Suit · EB11127 | Suits.me</title>'),'literal: the product title comes from the catalog entry');
  assert.ok(product1964Doc.includes('<link rel="canonical" href="https://suits.me/product/1964">'),'literal: the product canonical');
  assert.ok(product1964Doc.includes('a 100% WOOL suit from the Suits collection'),'literal: the product description carries the catalog fabric, kind and category');
  const product0Doc=await (await productGet('/product/0')).text();
  assert.ok(product0Doc.includes('<title>The Everyday Navy | Suits.me</title>'),'literal: the first catalog product title');
  for(const [path,to] of [['/product/01964','/product/1964'],['/product/1964/','/product/1964']]){
    const res=await productGet(path);
    assert.equal(res.status,308,`${path} redirects`);
    assert.equal(res.headers.get('Location'),to,`${path} redirects to the canonical form`);
    assert.equal(await res.text(),'','a product redirect carries no injected document');
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
    assert.equal(await res.text(),expectedDoc({title:'Order details | Suits.me',description:'The details of your Suits.me order: items, customization, fit profiles, and status.',canonicalPath:path,robots:'noindex'}),`${path} returns the storefront document with the noindex order head injected`);
  }
  const orderDoc=await (await orderGet('/orders/DEMO-ABC123')).text();
  assert.ok(orderDoc.includes('<meta name="robots" content="noindex,nofollow">'),'literal: order detail carries noindex');
  assert.ok(orderDoc.includes('<link rel="canonical" href="https://suits.me/orders/DEMO-ABC123">'),'literal: the order canonical is its own URL');
  console.log('Handler checks passed: collections serve, redirect and 404 as in stage 2; every page route serves the shared document with root route headers; fabrics and studio serve their valid kinds and 404 unknown kinds; product serves existing catalog ids and 404s unknown and non-numeric ids; order detail serves any single segment id. Stage 3b: every served document carries its own injected head (all 101 collections verified, literal spot checks per family), redirects carry no injection, and the root serves the shell with its own home head.');
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

// ------------------------------------------------------------------ 7
{
  // Stage 3b: the sitemap is generated (scripts/build-sitemap.cjs,
  // chained into the build after the route map generator). A stale
  // or hand edited sitemap fails the freshness equality, the same
  // discipline as the generated route map.
  const {buildSitemap,ORIGIN}=require('../scripts/build-sitemap.cjs');
  assert.equal(ORIGIN,'https://suits.me','the sitemap uses the production origin the shell canonical and Open Graph URLs already use');
  const sitemapXml=fs.readFileSync('public/sitemap.xml','utf8');
  assert.equal(sitemapXml,buildSitemap(committedMap,catalog),'public/sitemap.xml matches a fresh generation from the route map and the catalog');
  const locs=[...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  const indexablePages=Object.entries(committedMap.heads.pages).filter(([,head])=>head.robots==='index').map(([path])=>path);
  const familyPaths=Object.entries(committedMap.heads.families).flatMap(([family,kinds])=>Object.keys(kinds).map(kind=>`/${family}/${kind}`));
  assert.equal(locs.length,1+Object.keys(committedMap.paths).length+catalog.length+indexablePages.length+familyPaths.length,'the sitemap lists the home page, every collection, every product and every indexable page, counted from source data');
  assert.equal(new Set(locs).size,locs.length,'the sitemap lists no URL twice');
  assert.equal(locs[0],'https://suits.me/','the home page leads the sitemap');
  const locPaths=new Set(locs.map(u=>u.slice(ORIGIN.length)));
  for(const path of Object.keys(committedMap.paths))assert.ok(locPaths.has(path),`the sitemap lists the collection ${path}`);
  for(const p of catalog)assert.ok(locPaths.has('/product/'+p.id),`the sitemap lists product ${p.id}`);
  assert.equal(locs.filter(u=>u.startsWith(ORIGIN+'/product/')).length,catalog.length,'the sitemap lists exactly one URL per catalog product');
  for(const path of [...indexablePages,...familyPaths])assert.ok(locPaths.has(path),`the sitemap lists the indexable page ${path}`);
  for(const state of ['/customize','/checkout','/orders','/payment-return'])
    assert.ok(!locPaths.has(state),`the sitemap never lists the noindex state page ${state}`);
  assert.ok(![...locPaths].some(p=>p.startsWith('/orders/')),'the sitemap never lists order detail URLs');
  for(const u of locs){
    assert.ok(u.startsWith(ORIGIN+'/'),'every sitemap URL sits on the canonical origin: '+u);
    const path=u.slice(ORIGIN.length);
    assert.equal(path,path.toLowerCase(),'sitemap URLs use the canonical lowercase form: '+u);
    assert.ok(path==='/'||!path.endsWith('/'),'sitemap URLs carry no trailing slash: '+u);
  }
  assert.ok(fs.readFileSync('public/robots.txt','utf8').includes('Sitemap: https://suits.me/sitemap.xml'),'robots.txt points at the sitemap');
  console.log(`Sitemap checks passed: ${locs.length} URLs generated from the route map and the catalog (home, ${Object.keys(committedMap.paths).length} collections, ${catalog.length} products, ${indexablePages.length+familyPaths.length} indexable pages), canonical forms only, no state pages, fresh against the generator, and robots.txt points at it.`);
}

})().catch(e=>{console.error(e);process.exit(1)});
