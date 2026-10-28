// Wave 4 stage 2 (NAV-01): generate the real URL route map.
//
// The staged real pages migration serves collections at real paths
// (Mechanic A: framework server routes, see docs/ux-audit/wave-4-spike.md).
// This generator is the single source of truth for which real paths
// exist. It reads the menu source (data/reference-navigation.json) for
// the canonical destinations and slugs, and data/collections.json for
// full coverage: every one of the 147 catalog collection keys, aliases
// included, must resolve through the generated map to the destination
// it renders today, so nothing reachable by hash becomes unreachable
// by real path.
//
// Outputs:
//   data/real-routes.json      consumed by the server routes
//                              (validation, canonical redirects, 404s)
//   public/real-routes-data.js consumed by public/real-routes.js, the
//                              boot script that translates a real path
//                              into the hash route the storefront
//                              renders, when the URL carries no hash,
//                              and by the link translation the rendered
//                              pages use to point at real URLs.
//
// Stage 3a extends the map beyond collections: the single segment
// state and content pages (PAGES), and the parameterised families
// (fabrics and studio kinds, catalog product ids, order detail). The
// same fail loudly discipline applies: a page path colliding with a
// collection path, or a catalog entry without a valid numeric id,
// fails the build instead of shipping a partial map.
//
// Chain position matters: this generator must run AFTER every script
// that writes data/catalog.json (generate-catalog.cjs,
// build-merchant-catalog.cjs and build-suit-edits.cjs all append to
// it), or the product id ranges would be generated from an
// intermediate catalog and real product URLs would 404. The test
// suite guards the invariant: it regenerates the map from the final
// catalog and compares it with the committed artifacts, so a chain
// reorder that breaks this fails the suite after a build.
//
// Canonicalisation rules (spike report section 6): slugs are lowercase,
// spaces become hyphens, & becomes and, parentheses and apostrophes are
// dropped. Menu destinations and category roots are canonical. A key
// whose slug path matches a canonical path is an alias spelling of that
// destination (the lowercase "Wool suits" style keys). A key whose slug
// path is new but whose catalog entry already has a canonical path is
// an alias path (the retired "Pants" wording mirroring Trousers): it
// resolves to the canonical path instead of claiming its own. Two
// different destinations claiming one slug path fail the build loudly.
const fs=require('fs');

function slug(value){
  return String(value).toLowerCase()
    .replace(/&/g,'and')
    .replace(/['()]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
function route(cat,item){return '#collection/'+encodeURIComponent(cat)+(item?'/'+encodeURIComponent(item):'');}
// Menu labels that menuLink sends somewhere other than a collection
// (mirrors public/navigation.js and generate-catalog.cjs).
function isServiceLabel(item){
  return item==='Fit Guarantee'||/^3d/i.test(item)||item==='Clone Garments'||item==='Other Charges'||item==='Gift Cards';
}
function parseKey(key){
  if(key==='#collection')return{cat:null,topic:null};
  const parts=key.split('/');
  const dec=s=>{try{return decodeURIComponent(s)}catch{return s}};
  return{cat:dec(parts[1]||''),topic:parts.length>2?dec(parts.slice(2).join('/')):null};
}
function pathFor(cat,topic){
  // The bare #collection route renders the Suits root today, so its
  // real path is the Suits category root (spike report section 6).
  if(cat==null)return '/collections/suits';
  return '/collections/'+slug(cat)+(topic?'/'+slug(topic):'');
}

// Single segment state and content screens, each mapping to exactly
// the hash route the render dispatch serves today (complete.js:
// customize, measure, checkout, orders, gift cards, help, locations,
// the three policy pages and the payment return; expanded.js: fit
// support, clone, charges). One canonical path per screen; there are
// no aliases for these.
const PAGES={
  '/customize':'#customize',
  '/measure':'#measure',
  '/checkout':'#checkout',
  '/orders':'#orders',
  '/gift-cards':'#gift-cards',
  '/help':'#help',
  '/locations':'#locations',
  '/shipping':'#shipping',
  '/privacy':'#privacy',
  '/terms':'#terms',
  '/fit-support':'#fit-support',
  '/clone':'#clone',
  '/charges':'#charges',
  '/payment-return':'#payment-return',
};
// Parameterised family kinds, mirroring the client dispatch:
// merchant.js renders the #fabrics/ listings for suit and shirt only,
// and expanded.js renders #studio/ for suit, jacket and pants. Any
// other kind is not a route. Product ids are validated against the
// catalog data in buildRealRoutes; order ids are deliberately not
// enumerable (they live in the shopper's browser storage or in server
// order records the shell cannot list), so the orders family carries
// no validation data and its route serves any single segment id.
const FAMILY_KINDS={fabrics:['shirt','suit'],studio:['jacket','pants','suit']};

function productIdRanges(catalog){
  if(!Array.isArray(catalog))throw new Error('real routes: data/catalog.json is not an array');
  const ids=new Set();
  for(const p of catalog){
    if(!p||!Number.isInteger(p.id)||p.id<0)throw new Error('real routes: a catalog entry has no valid numeric id, so /product/ routes cannot be validated');
    if(ids.has(p.id))throw new Error(`real routes: duplicate catalog product id ${p.id}`);
    ids.add(p.id);
  }
  const ranges=[];
  for(const id of [...ids].sort((a,b)=>a-b)){
    const last=ranges[ranges.length-1];
    if(last&&id===last[1]+1)last[1]=id;else ranges.push([id,id]);
  }
  return ranges;
}

function buildRealRoutes(menus,collections,catalog){
  const entryId=value=>JSON.stringify(value);
  // Group the catalog keys by the entry they render.
  const groups=new Map();
  for(const key of Object.keys(collections)){
    const id=entryId(collections[key]);
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(key);
  }
  // Canonical destinations: every menu collection destination, every
  // menu category root, and the Accessories and Fabrics roots the
  // catalog filter chips link to (they alias More entries in the
  // catalog data but are destinations in their own right).
  const canonical=new Map();
  const claimCanonical=(hash,path)=>{
    if(!(hash in collections))throw new Error(`real routes: canonical destination ${hash} is missing from data/collections.json`);
    if(canonical.has(hash)&&canonical.get(hash)!==path)throw new Error(`real routes: ${hash} claims two canonical paths: ${canonical.get(hash)} and ${path}`);
    canonical.set(hash,path);
  };
  for(const m of menus){
    claimCanonical(route(m.name),'/collections/'+slug(m.name));
    for(const label of [...m.shortcuts,...m.groups.flatMap(g=>g[1])]){
      if(isServiceLabel(label))continue;
      claimCanonical(route(m.name,label),'/collections/'+slug(m.name)+'/'+slug(label));
    }
  }
  claimCanonical(route('Accessories'),'/collections/accessories');
  claimCanonical(route('Fabrics'),'/collections/fabrics');

  // Canonical slug paths per catalog entry, for alias resolution. An
  // entry can hold several (its bare category root and its Shop All
  // destination, for one); alias resolution prefers the shortest.
  const entryCanonicalPaths=new Map();
  for(const [id,keys] of groups){
    const paths=new Set();
    for(const key of keys)if(canonical.has(key))paths.add(canonical.get(key));
    entryCanonicalPaths.set(id,paths);
  }

  const paths={},aliases={};
  const claimPath=(path,hash)=>{
    if(path in aliases)throw new Error(`real routes: slug collision at ${path}: claimed as an alias and as the canonical path for ${hash}`);
    if(path in paths&&paths[path]!==hash)throw new Error(`real routes: slug collision at ${path}: ${paths[path]} and ${hash} are different destinations`);
    paths[path]=hash;
  };
  for(const [hash,path] of canonical)claimPath(path,hash);

  for(const key of Object.keys(collections)){
    const{cat,topic}=parseKey(key);
    const path=pathFor(cat,topic);
    const id=entryId(collections[key]);
    if(path in paths){
      // An exact canonical key, or an alias spelling of one. Either
      // way the path must render this key's entry.
      if(entryId(collections[paths[path]])!==id)throw new Error(`real routes: slug collision at ${path}: ${key} and ${paths[path]} render different collections`);
      continue;
    }
    if(path in aliases){
      const targets=new Set([aliases[path]]);
      for(const p of entryCanonicalPaths.get(id))targets.add(p);
      if(targets.size>1)throw new Error(`real routes: alias path ${path} (from ${key}) resolves to more than one canonical path`);
      continue;
    }
    const canonicalPaths=[...entryCanonicalPaths.get(id)].sort((a,b)=>a.length-b.length||(a<b?-1:1));
    if(canonicalPaths.length){
      // A legacy path for a destination that already has a canonical
      // path (the Pants mirror of Trousers): alias, never a second
      // canonical claim.
      aliases[path]=canonicalPaths[0];
    }else{
      // A collection with no menu destination: it still maps to its
      // own hash route so nothing that renders today is unreachable.
      claimPath(path,key);
    }
  }

  // Every key resolves: canonical keys to their path, alias spellings
  // to the canonical path they share, alias paths to their target.
  const reverse={};
  for(const key of Object.keys(collections)){
    const{cat,topic}=parseKey(key);
    const own=pathFor(cat,topic);
    const resolved=aliases[own]||own;
    if(!(resolved in paths))throw new Error(`real routes: ${key} does not resolve through the generated map`);
    if(entryId(collections[paths[resolved]])!==entryId(collections[key]))throw new Error(`real routes: ${key} resolves to ${paths[resolved]}, a different collection`);
    reverse[key]=resolved;
  }

  // Stage 3a families: the single segment pages and the parameterised
  // families join the map. A page path that collides with a canonical
  // or alias collection path, or a page hash that already resolves
  // somewhere else, fails the build.
  const pages=Object.fromEntries(Object.entries(PAGES).sort(([a],[b])=>a<b?-1:a>b?1:0));
  for(const path of Object.keys(pages)){
    if(path.split('/').filter(Boolean).length!==1)throw new Error(`real routes: page path ${path} is not a single segment`);
    if(path in paths||path in aliases)throw new Error(`real routes: page path ${path} collides with a collection path`);
    const hash=pages[path];
    if(hash in reverse&&reverse[hash]!==path)throw new Error(`real routes: page hash ${hash} already resolves to ${reverse[hash]}`);
    reverse[hash]=path;
  }
  if('#home' in reverse&&reverse['#home']!=='/')throw new Error('real routes: #home already resolves somewhere other than the root');
  reverse['#home']='/';
  const families={
    fabrics:{kinds:[...FAMILY_KINDS.fabrics]},
    studio:{kinds:[...FAMILY_KINDS.studio]},
    product:{idRanges:productIdRanges(catalog)},
    orders:{anySingleSegment:true},
  };

  const sortObj=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a<b?-1:a>b?1:0));
  return{paths:sortObj(paths),aliases:sortObj(aliases),reverse:sortObj(reverse),pages,families};
}

function main(){
  const menus=JSON.parse(fs.readFileSync('data/reference-navigation.json','utf8'));
  const collections=JSON.parse(fs.readFileSync('data/collections.json','utf8'));
  const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
  const{paths,aliases,reverse,pages,families}=buildRealRoutes(menus,collections,catalog);
  fs.writeFileSync('data/real-routes.json',JSON.stringify({paths,aliases,reverse,pages,families},null,2)+'\n');
  const header='// Generated by scripts/build-real-routes.cjs from data/reference-navigation.json,\n// data/collections.json and data/catalog.json. Do not edit by hand; the build\n// regenerates it.\n';
  fs.writeFileSync('public/real-routes-data.js',
    header+
    '// Canonical real collection paths and the hash route each one boots into.\nconst realRoutePaths='+JSON.stringify(paths)+';\n'+
    '// Alias real paths (legacy spellings, the retired Pants wording) and the\n// canonical real path each one resolves to.\nconst realRouteAliases='+JSON.stringify(aliases)+';\n'+
    '// Every hash route that has a real URL, mapped to it: the collections,\n// the single segment pages and home. Rendered links translate through\n// realUrlForHash in public/real-routes.js.\nconst realRouteReverse='+JSON.stringify(reverse)+';\n'+
    '// Single segment real paths (state and content screens) and the hash\n// route each one boots into.\nconst realRoutePages='+JSON.stringify(pages)+';\n'+
    '// Parameterised families: the valid kinds for the fabrics and studio\n// listings and the catalog product id ranges the product routes\n// validate against. Order detail paths are deliberately absent: any\n// single segment id boots, because order ids are not enumerable.\nconst realRouteFamilies='+JSON.stringify(families)+';\n');
  console.log(JSON.stringify({realPaths:Object.keys(paths).length,aliasPaths:Object.keys(aliases).length,catalogKeys:Object.keys(collections).length,pagePaths:Object.keys(pages).length,productIds:families.product.idRanges.reduce((n,[lo,hi])=>n+hi-lo+1,0)}));
}

if(require.main===module)main();
module.exports={buildRealRoutes,slug};
