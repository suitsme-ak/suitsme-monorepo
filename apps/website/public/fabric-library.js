'use strict';
/* Fabric library screens for /fabrics/suit and /fabrics/shirt.
   The library is the full shop fabric book imported from JPOS
   (data/fabric-library.json): every suit and shirt fabric, active
   and inactive. Following the owner's rule, the screens open on the
   active fabrics, the ones the shop sells today; a shopper can
   switch the Availability filter to see the whole library, and
   inactive fabrics are always marked Inactive on their card.
   Fabrics that already have a product page (the merchant set) link
   to it; the rest are reference cards carrying the fabric code the
   shop orders by. Swatches are served by the shop image server, the
   same source the JPOS website uses. */
let libSearch='',libStatus='Active fabrics',libCollection='All collections',libColor='All colors',libPattern='All patterns',libMaterial='All materials',libSeason='All seasons',libMill='All mills',libWeave='All weaves',libOccasion='All occasions',libSort='featured',libPage=1,libRoute='';
function resetLibraryFilters(){libSearch='';libStatus='Active fabrics';libCollection='All collections';libColor='All colors';libPattern='All patterns';libMaterial='All materials';libSeason='All seasons';libMill='All mills';libWeave='All weaves';libOccasion='All occasions';libSort='featured';libPage=1;render(false)}
let libProductByCode=null;
function libMerchantProduct(code){if(!code)return null;if(!libProductByCode){libProductByCode={};for(const p of products)if(p.fabricCode)libProductByCode[p.fabricCode]=p}return libProductByCode[code]||null}
function libImageUrl(f){return 'https://system.mysuitonline.com/website/images/fabric/'+(f.k==='shirt'?'shirts/':'')+'large/'+encodeURIComponent(f.img)}
function libSearchText(f){return [f.c,f.d,f.m,f.col,f.cf,f.pat,f.pc,f.con,f.mat,f.sea,(f.grp||[]).join(' ')].filter(Boolean).join(' ').toLowerCase()}
function libFacetValues(items,key){return [...new Set(items.map(f=>f[key]).filter(Boolean))].sort()}
function libCollectionValues(items){return [...new Set(items.flatMap(f=>f.grp||[]))].sort()}
function libTitle(f){const t=(f.col+' '+f.pat).trim();return t||f.d||f.c||'Fabric '+f.id}
function libCard(f){
  const p=libMerchantProduct(f.c);
  const meta=[f.m,f.sea,f.wv,f.wt].filter(Boolean).join(' · ');
  const inner=`${f.img?`<img src="${libImageUrl(f)}" alt="Fabric swatch ${esc(f.c||f.id)}: ${esc(libTitle(f))}" loading="lazy" onerror="this.style.display='none'">`:''}<span class="sku-label">${esc(f.c||'JPOS '+f.id)}</span>${f.act?'':'<span class="fabric-status">Inactive</span>'}<h3>${esc(libTitle(f))}</h3><p>${esc(f.con||f.d)}</p>${meta?`<small>${esc(meta)}</small>`:''}${f.grp&&f.grp.length?`<small>${esc(f.grp[0])}</small>`:''}${p?`<span class="textlink">View fabric & design ${f.k==='suit'?'suit':'shirt'} →</span>`:f.act?`<span class="textlink">Order in store with code ${esc(f.c)}</span>`:`<span class="textlink">Kept for reference</span>`}`;
  return p?`<article class="product merchant-swatch fabric-lib"><a href="/product/${p.id}">${inner}</a></article>`:`<article class="product merchant-swatch fabric-lib${f.act?'':' is-inactive'}">${inner}</article>`;
}
function fabricLibraryScreen(kind){
  kind=kind==='shirt'?'shirt':'suit';
  const route=location.hash;
  if(libRoute!==route){libRoute=route;libSearch='';libStatus='Active fabrics';libCollection='All collections';libColor='All colors';libPattern='All patterns';libMaterial='All materials';libSeason='All seasons';libMill='All mills';libWeave='All weaves';libOccasion='All occasions';libSort='featured';libPage=1}
  const all=fabricLibraryData.fabrics.filter(f=>f.k===kind);
  const activeCount=all.filter(f=>f.act).length;
  const filtered=all.filter(f=>(libStatus==='All fabrics'||(libStatus==='Active fabrics')===!!f.act)&&(libCollection==='All collections'||(f.grp||[]).includes(libCollection))&&(libColor==='All colors'||f.cf===libColor)&&(libPattern==='All patterns'||f.pc===libPattern)&&(libMaterial==='All materials'||f.mat===libMaterial)&&(libSeason==='All seasons'||f.sea===libSeason)&&(libMill==='All mills'||f.m===libMill)&&(libWeave==='All weaves'||f.wv===libWeave)&&(libOccasion==='All occasions'||f.occ===libOccasion)&&(!libSearch||libSearchText(f).includes(libSearch.toLowerCase())));
  const decorated=filtered.map((f,i)=>[f,i]);
  if(libSort==='code')decorated.sort((a,b)=>String(a[0].c).localeCompare(String(b[0].c))||a[1]-b[1]);
  else if(libSort==='mill')decorated.sort((a,b)=>String(a[0].m).localeCompare(String(b[0].m))||String(a[0].c).localeCompare(String(b[0].c))||a[1]-b[1]);
  else decorated.sort((a,b)=>Number(b[0].web)-Number(a[0].web)||Number(b[0].mer)-Number(a[0].mer)||Number(b[0].act)-Number(a[0].act)||String(a[0].c).localeCompare(String(b[0].c))||a[1]-b[1]);
  const items=decorated.map(pair=>pair[0]);
  const pages=Math.max(1,Math.ceil(items.length/36));libPage=Math.min(libPage,pages);
  const shown=items.slice((libPage-1)*36,libPage*36);
  const facet=(label,allLabel,key,values,current,assign)=>({label,ariaLabel:'Filter by '+label.toLowerCase(),all:allLabel,values,current,onchange:assign+'=this.value;libPage=1;render(false)'});
  return `<section class="catalog-heading"><div class="breadcrumb"><a href="/">Home</a> / Fabrics / ${kind==='suit'?'Suits':'Shirts'}</div><span class="eyebrow">Fabrics</span><h1>${kind==='suit'?'Suit':'Shirt'} fabrics.</h1><p>The full shop fabric library: ${all.length.toLocaleString('en-US')} ${kind} fabrics, ${activeCount.toLocaleString('en-US')} of them active.</p><p>The list opens on the active fabrics, the ones the shop sells today. Inactive fabrics stay in the library for reference: switch Availability to All fabrics to see them, and every inactive fabric is marked Inactive on its card. Inactive fabrics cannot be ordered.</p><div class="filter-chips"><a class="chip ${kind==='suit'?'active':''}" href="/fabrics/suit">Suit fabrics</a><a class="chip ${kind==='shirt'?'active':''}" href="/fabrics/shirt">Shirt fabrics</a><a class="chip" href="/collections/${kind==='suit'?'suits':'shirts'}">View garments ↗</a></div></section><section class="catalog-body merchant-catalog fabric-library">${listingControlsHtml({search:libSearch,searchInput:'libSearch=this.value',apply:'libPage=1;render(false)',clear:'resetLibraryFilters()',facets:[
    {label:'Availability',ariaLabel:'Filter by availability',all:'Active fabrics',values:['All fabrics','Inactive fabrics'],current:libStatus,onchange:'libStatus=this.value;libPage=1;render(false)'},
    facet('Collection','All collections','grp',libCollectionValues(all),libCollection,'libCollection'),
    facet('Color','All colors','cf',libFacetValues(all,'cf'),libColor,'libColor'),
    facet('Pattern','All patterns','pc',libFacetValues(all,'pc'),libPattern,'libPattern'),
    facet('Material','All materials','mat',libFacetValues(all,'mat'),libMaterial,'libMaterial'),
    facet('Season','All seasons','sea',libFacetValues(all,'sea'),libSeason,'libSeason'),
    facet('Mill','All mills','m',libFacetValues(all,'m'),libMill,'libMill'),
    facet('Weave','All weaves','wv',libFacetValues(all,'wv'),libWeave,'libWeave'),
    facet('Occasion','All occasions','occ',libFacetValues(all,'occ'),libOccasion,'libOccasion')
  ],sort:libSort,sortChange:'libSort=this.value;libPage=1;render(false)',sortOptions:[['featured','Featured'],['code','Fabric code'],['mill','Mill']]})}${listingCountHtml(items.length,shown.length,libPage)}${shown.length?`<div class="products">${shown.map(libCard).join('')}</div>`:listingEmptyHtml('resetLibraryFilters()')}<div class="pagination"><button class="btn light" ${libPage===1?'disabled':''} onclick="libPage--;render(false);document.querySelector('.fabric-library').scrollIntoView()">← Previous</button><span>Page ${libPage} of ${pages}</span><button class="btn light" ${libPage===pages?'disabled':''} onclick="libPage++;render(false);document.querySelector('.fabric-library').scrollIntoView()">Next →</button></div><p class="ai-note">Fabric data and swatches come from the shop fabric library (JPOS), export of 2026-11-04. Fabrics with a product page can be designed online; the rest can be ordered in store by fabric code.</p></section>`;
}
const referenceLibraryRender=render;
render=function(top=true){if(location.hash.startsWith('#fabrics/')){const kind=location.hash.split('/')[1]==='shirt'?'shirt':'suit';document.title=(kind==='shirt'?'Shirt':'Suit')+' Fabrics - Suits.me';$('#main').innerHTML=fabricLibraryScreen(kind);updateBag();if(top)scrollTo(0,0);return}referenceLibraryRender(top)};
// merchant.js paints once when it loads, before these scripts arrive.
// On a fabrics route, paint again through the wrapped render so the
// library screen, not the merchant list, is what stands on first load.
if(location.hash.startsWith('#fabrics/'))render();
