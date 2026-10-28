// Wave 4 stage 3b (NAV-01): generate the sitemap from the route map.
//
// Until this stage public/sitemap.xml was a hand written stub that
// listed only the home page, because nothing else had a real URL.
// Every destination now has one, so the sitemap is generated from
// the same sources as the routes themselves: the generated route map
// (data/real-routes.json, built by scripts/build-real-routes.cjs)
// for the canonical collection paths and the indexable pages, and
// data/catalog.json for the product URLs. It lists, in order: the
// home page, every canonical collection path (101), every product
// URL (2,245), and the indexable content pages (the single segment
// pages the route map marks indexable, plus the fabrics and studio
// family URLs). State pages (customize, checkout, orders, order
// detail, payment return) are noindex and are never listed.
//
// The origin is the one the shell's canonical and Open Graph URLs
// already use: https://suits.me. Entries carry no lastmod: a
// generated date would change daily without any page changing,
// which would make the test suite's freshness check (regenerate and
// compare, the same discipline as the route map) meaningless.
//
// Chain position matters: this generator reads the finished route
// map and the final catalog, so it runs after
// scripts/build-real-routes.cjs in the build chain.
const fs=require('fs');

const ORIGIN='https://suits.me';

function buildSitemap(routeMap,catalog){
  const urls=[ORIGIN+'/'];
  for(const path of Object.keys(routeMap.paths))urls.push(ORIGIN+path);
  const ids=[...new Set(catalog.map(p=>p.id))].sort((a,b)=>a-b);
  for(const id of ids)urls.push(`${ORIGIN}/product/${id}`);
  const extra=[];
  for(const [path,head] of Object.entries(routeMap.heads.pages))
    if(head.robots==='index')extra.push(path);
  for(const [family,kinds] of Object.entries(routeMap.heads.families))
    for(const kind of Object.keys(kinds))extra.push(`/${family}/${kind}`);
  extra.sort();
  for(const path of extra)urls.push(ORIGIN+path);
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    urls.map(u=>`  <url>\n    <loc>${esc(u)}</loc>\n  </url>`).join('\n')+
    '\n</urlset>\n';
}

function main(){
  const routeMap=JSON.parse(fs.readFileSync('data/real-routes.json','utf8'));
  const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
  const xml=buildSitemap(routeMap,catalog);
  fs.writeFileSync('public/sitemap.xml',xml);
  console.log(JSON.stringify({sitemapUrls:(xml.match(/<loc>/g)||[]).length}));
}

if(require.main===module)main();
module.exports={buildSitemap,ORIGIN};
