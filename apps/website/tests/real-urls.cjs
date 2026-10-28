const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
// Wave 4 (NAV-01), Mechanic A. Stage 1 proved one collection at a real
// URL; stage 2 generalises it: a generated route map
// (scripts/build-real-routes.cjs) covers every catalog collection, a
// framework catch all route (app/collections/[...slug]/route.ts)
// serves the storefront shell for canonical paths, redirects alias
// paths to their canonical form, and 404s unknown slugs, and the boot
// script (public/real-routes.js, fed by the generated
// public/real-routes-data.js) translates a real path into the hash
// route the storefront renders when the URL carries no hash.
// This suite proves:
//  1. the committed generated map equals a fresh generation from the
//     menu source and the catalog data, and every one of the 147
//     catalog collection keys resolves through it to exactly the
//     destination it names today, with unique slugs per category;
//  2. the boot translation maps every canonical path to its hash and
//     every alias path to the canonical destination, tolerates case
//     and trailing slash variants, maps unknown paths to nothing, and
//     never overrides an existing hash;
//  3. the catch all handler serves the shared document for canonical
//     paths with the root route's headers, redirects alias and
//     non-canonical forms, and 404s unknown slugs;
//  4. full storefront boots at real URLs render the collections they
//     name: the Wool Suits flagship in depth, one category root and
//     one topic per menu category computed from the map, and an alias
//     entry rendering the canonical destination;
//  5. the pre migration behaviour is unchanged: hash URLs at the root
//     render as before and the root boot sets no hash.
// Live server evidence (status codes from the built wrangler server)
// is recorded in docs/ux-audit/wave-4-spike.md, stage 2 addendum.

const menus=require('../data/reference-navigation.json');
const collections=require('../data/collections.json');
const committedMap=require('../data/real-routes.json');
const {buildRealRoutes}=require('../scripts/build-real-routes.cjs');
const catalog=require('../data/catalog.json');
const REAL_PATH='/collections/suits/wool-suits';
const WOOL_HASH='#collection/Suits/Wool%20Suits';
const woolIds=require('../data/suit-collections.json')['Wool Suits'].ids;

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

(async()=>{

// ------------------------------------------------------------------ 1
{
  const fresh=buildRealRoutes(menus,collections);
  assert.deepEqual(committedMap,fresh,'the committed data/real-routes.json matches a fresh generation from the menu source and catalog data');
  const dataCtx=vm.createContext({});
  vm.runInContext(fs.readFileSync('public/real-routes-data.js','utf8'),dataCtx);
  const plain=v=>JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(vm.runInContext('realRoutePaths',dataCtx)),committedMap.paths,'the boot data file carries the same canonical paths as the server map');
  assert.deepEqual(plain(vm.runInContext('realRouteAliases',dataCtx)),committedMap.aliases,'the boot data file carries the same alias paths as the server map');

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
  console.log(`Route map checks passed: ${Object.keys(committedMap.paths).length} canonical paths and ${Object.keys(committedMap.aliases).length} alias paths generated from source data, all 147 catalog keys resolve to the destinations they name today, slugs unique per category.`);
}

// ------------------------------------------------------------------ 2
{
  const bootLoc=location=>{
    const sandbox={location};
    sandbox.window=sandbox;
    const ctx=vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync('public/real-routes-data.js','utf8'),ctx);
    vm.runInContext(fs.readFileSync('public/real-routes.js','utf8'),ctx);
    return sandbox;
  };
  const probe=bootLoc({hash:'',pathname:'/'});
  for(const [path,hash] of Object.entries(committedMap.paths))
    assert.equal(probe.hashForRealPath(path),hash,`canonical path ${path} boots into ${hash}`);
  for(const [alias,target] of Object.entries(committedMap.aliases)){
    assert.equal(probe.canonicalRealPath(alias),target,`alias path ${alias} canonicalises to ${target}`);
    assert.equal(probe.hashForRealPath(alias),committedMap.paths[target],`alias path ${alias} boots into the canonical hash`);
  }
  assert.equal(probe.hashForRealPath('/collections/suits/not-a-collection'),null,'an unknown topic maps to nothing');
  assert.equal(probe.hashForRealPath('/collections/not-a-category'),null,'an unknown category maps to nothing');
  assert.equal(probe.hashForRealPath('/collections'),null,'the bare collections path maps to nothing');
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
  const home={hash:'',pathname:'/'};
  bootLoc(home);
  assert.equal(home.hash,'','the home path is left alone');
  console.log('Boot translation checks passed: every canonical and alias path in the generated map translates, variants normalise, unknown paths map to nothing, existing hashes are untouched.');
}

// ------------------------------------------------------------------ 3
{
  assert.ok(!fs.existsSync('app/collections/suits/wool-suits/route.ts'),'the spike explicit Wool Suits route is retired');
  const source=fs.readFileSync('app/collections/[...slug]/route.ts','utf8');
  assert.ok(source.includes('from "../../../web/index.html?raw"'),'the catch all serves the shared storefront document');
  assert.ok(source.includes('from "../../../data/real-routes.json"'),'the catch all validates against the generated map');
  const html=fs.readFileSync('web/index.html','utf8');
  assert.equal(fs.readFileSync('public/index.html','utf8'),html,'the two HTML copies stay identical');
  assert.ok(html.includes('<base href="/">'),'the document resolves relative URLs from the site root');
  assert.ok(html.indexOf('<script src="real-routes-data.js"></script>')>=0,'the generated route data is in the document');
  assert.ok(html.indexOf('real-routes-data.js')<html.indexOf('real-routes.js'),'the route data loads before the boot script');
  assert.ok(html.indexOf('real-routes.js')<html.indexOf('src="app.js"'),'the boot script runs before the storefront scripts');
  const js=ts.transpileModule(source
    .replace(/import html from "[^"]+";/,`const html=${JSON.stringify(html)};`)
    .replace(/import routeMap from "[^"]+";/,`const routeMap=${JSON.stringify(committedMap)};`),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,Response,URL});
  const get=async path=>m.exports.GET(new Request('http://spike.test'+path));

  for(const path of ['/collections/suits','/collections/jackets','/collections/trousers','/collections/shirts','/collections/weddings','/collections/more','/collections/women',REAL_PATH,'/collections/women/leather-trousers']){
    const res=await get(path);
    assert.equal(res.status,200,`${path} serves the shell`);
    assert.equal(res.headers.get('Content-Type'),'text/html; charset=utf-8',`${path} carries the root route content type`);
    assert.equal(res.headers.get('Cache-Control'),'no-cache',`${path} carries the root route cache header`);
    assert.equal(await res.text(),html,`${path} returns the storefront document byte for byte`);
  }
  const alias=await get('/collections/pants/wool-pants');
  assert.equal(alias.status,308,'an alias path redirects');
  assert.equal(alias.headers.get('Location'),'/collections/trousers/wool-trousers','the alias redirects to the canonical path');
  const cased=await get('/collections/Suits/Wool-Suits');
  assert.equal(cased.status,308,'a case variant redirects');
  assert.equal(cased.headers.get('Location'),REAL_PATH,'the case variant redirects to the canonical form');
  const slashed=await get(REAL_PATH+'/');
  assert.equal(slashed.status,308,'a trailing slash that reaches the handler redirects');
  assert.equal(slashed.headers.get('Location'),REAL_PATH);
  for(const path of ['/collections/suits/not-a-collection','/collections/not-a-category','/collections/suits/wool-suits/extra','/collections']){
    const res=await get(path);
    assert.equal(res.status,404,`${path} is a 404`);
  }
  console.log('Catch all handler checks passed: canonical paths serve the shared document with root route headers, alias and non-canonical forms redirect to the canonical path, unknown slugs 404.');
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
  assert.ok(html.includes('href="#product/1964"'),'the first Wool Suits product links onward');
  assert.ok(w.elFor('#catalogNav').innerHTML.includes('href="#collection/Suits/Wool%20Suits"'),'the menu still offers the Wool Suits destination');
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
  console.log('Real URL entry checks passed: Wool Suits renders in depth from its real URL, one root and one topic per menu category render the collections the map names, and the Pants alias renders the canonical Trousers destination.');
}

// ------------------------------------------------------------------ 5
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
