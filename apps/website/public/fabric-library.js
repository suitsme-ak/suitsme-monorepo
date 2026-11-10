'use strict';
/* Fabric library screens for /fabrics/suit and /fabrics/shirt.
   The library is the full shop fabric book imported from JPOS
   (data/fabric-library.json): every suit and shirt fabric, active
   and inactive. Following the owner's rule, the screens open on the
   active fabrics, the ones the shop sells today; a shopper can
   switch the Availability filter to see the whole library, and
   inactive fabrics are always marked Inactive on their card.
   Every card opens the fabric's own page at /fabrics/<kind>/<code>,
   so a fabric can be linked and quoted by its code; fabrics that
   already have a product page (the merchant set) offer the design
   entry from their detail page. Swatches are served by the shop
   image server, the same source the JPOS website uses. */
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
  const meta=[f.m,f.sea,f.wv,f.wt].filter(Boolean).join(' · ');
  const inner=`${f.img?`<img src="${libImageUrl(f)}" alt="Fabric swatch ${esc(f.c)}: ${esc(libTitle(f))}" loading="lazy" onerror="this.style.display='none'">`:''}<span class="sku-label">${esc(f.c)}</span>${f.act?'':'<span class="fabric-status">Inactive</span>'}<h3>${esc(libTitle(f))}</h3><p>${esc(f.con||f.d)}</p>${meta?`<small>${esc(meta)}</small>`:''}${f.grp&&f.grp.length?`<small>${esc(f.grp[0])}</small>`:''}<span class="textlink">View fabric →</span>`;
  return `<article class="product merchant-swatch fabric-lib${f.act?'':' is-inactive'}"><a href="/fabrics/${f.k}/${encodeURIComponent(f.c)}">${inner}</a></article>`;
}
function libDecoded(code){try{return decodeURIComponent(code)}catch(e){return code}}
function fabricDetailScreen(kind,rawCode){
  kind=kind==='shirt'?'shirt':'suit';
  const code=libDecoded(rawCode);
  const f=fabricLibraryData.fabrics.find(x=>x.k===kind&&x.c===code);
  if(!f)return `<section class="catalog-heading"><div class="breadcrumb"><a href="/">Home</a> / <a href="/fabrics/${kind}">Fabrics</a> / ${kind==='suit'?'Suits':'Shirts'}</div><span class="eyebrow">Fabrics</span><h1>Fabric not found.</h1><p>We could not find a ${kind} fabric with code ${esc(code)} in the shop fabric library.</p><p><a class="btn light" href="/fabrics/${kind}">Browse ${kind} fabrics</a></p></section>`;
  const p=libMerchantProduct(f.c);
  const facts=[['Fabric code',f.c],['Status',f.act?'Active':'Inactive'],['Mill',f.m],['Color',f.col],['Pattern',f.pat],['Content',f.con],['Material',f.mat],['Season',f.sea],['Weave',f.wv],['Weight',f.wt?f.wt+' g/m':''],['Occasion',f.occ],['Tier',f.tier!=null&&f.tier!==''?'Tier '+f.tier:''],['Collections',(f.grp||[]).join(', ')]].filter(row=>row[1]);
  return `<section class="catalog-heading"><div class="breadcrumb"><a href="/">Home</a> / <a href="/fabrics/${kind}">Fabrics</a> / ${kind==='suit'?'Suits':'Shirts'} / ${esc(f.c)}</div><span class="eyebrow">Fabric ${esc(f.c)}</span><h1>${esc(libTitle(f))}.</h1>${f.act?'':'<p><span class="fabric-status">Inactive</span> This fabric is not currently available to order.</p>'}</section><section class="catalog-body fabric-detail">${f.img?`<img class="fabric-detail-img" src="${libImageUrl(f)}" alt="Fabric swatch ${esc(f.c)}: ${esc(libTitle(f))}">`:''}<div class="detail-facts">${facts.map(row=>`<div><span>${esc(row[0])}</span><strong>${esc(row[1])}</strong></div>`).join('')}</div>${f.d&&f.d!==f.con?`<p>${esc(f.d)}</p>`:''}<p class="fabric-detail-actions">${p?`<a class="btn" href="/product/${p.id}">Design your ${kind} in this fabric</a>`:''}<a class="btn light" href="/fabrics/${kind}">Back to ${kind} fabrics</a></p>${p?'':f.act?`<p class="ai-note">This fabric can be ordered in store with fabric code ${esc(f.c)}.</p>`:`<p class="ai-note">Inactive fabrics stay in the library for reference and cannot be ordered.</p>`}</section>`;
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
render=function(top=true){if(location.hash.startsWith('#fabric/')){const parts=location.hash.split('/');const kind=parts[1]==='shirt'?'shirt':'suit';const code=parts.slice(2).join('/');document.title='Fabric '+libDecoded(code)+' - Suits.me';$('#main').innerHTML=fabricDetailScreen(kind,code);updateBag();if(top)scrollTo(0,0);return}if(location.hash.startsWith('#fabrics/')){const kind=location.hash.split('/')[1]==='shirt'?'shirt':'suit';document.title=(kind==='shirt'?'Shirt':'Suit')+' Fabrics - Suits.me';$('#main').innerHTML=fabricLibraryScreen(kind);updateBag();if(top)scrollTo(0,0);return}referenceLibraryRender(top)};
// merchant.js paints once when it loads, before these scripts arrive.
// On a fabrics route, paint again through the wrapped render so the
// library screen, not the merchant list, is what stands on first load.
if(location.hash.startsWith('#fabrics/')||location.hash.startsWith('#fabric/'))render();
