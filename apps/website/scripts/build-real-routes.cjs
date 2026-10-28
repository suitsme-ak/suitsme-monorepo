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
//   data/real-routes.json      consumed by the server catch all route
//                              (validation, canonical redirects, 404s)
//   public/real-routes-data.js consumed by public/real-routes.js, the
//                              boot script that translates a real path
//                              into the hash route the storefront
//                              renders, when the URL carries no hash.
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

function buildRealRoutes(menus,collections){
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

  const sortObj=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a<b?-1:a>b?1:0));
  return{paths:sortObj(paths),aliases:sortObj(aliases),reverse:sortObj(reverse)};
}

function main(){
  const menus=JSON.parse(fs.readFileSync('data/reference-navigation.json','utf8'));
  const collections=JSON.parse(fs.readFileSync('data/collections.json','utf8'));
  const{paths,aliases,reverse}=buildRealRoutes(menus,collections);
  fs.writeFileSync('data/real-routes.json',JSON.stringify({paths,aliases,reverse},null,2)+'\n');
  const header='// Generated by scripts/build-real-routes.cjs from data/reference-navigation.json\n// and data/collections.json. Do not edit by hand; the build regenerates it.\n';
  fs.writeFileSync('public/real-routes-data.js',
    header+
    '// Canonical real collection paths and the hash route each one boots into.\nconst realRoutePaths='+JSON.stringify(paths)+';\n'+
    '// Alias real paths (legacy spellings, the retired Pants wording) and the\n// canonical real path each one resolves to.\nconst realRouteAliases='+JSON.stringify(aliases)+';\n');
  console.log(JSON.stringify({realPaths:Object.keys(paths).length,aliasPaths:Object.keys(aliases).length,catalogKeys:Object.keys(reverse).length}));
}

if(require.main===module)main();
module.exports={buildRealRoutes,slug};
