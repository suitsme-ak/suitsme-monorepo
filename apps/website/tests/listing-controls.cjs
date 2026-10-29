const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CAT-01: one listing control set for fabric listings and design listings.
// The feature suites test fixes in isolation; this suite renders the two
// live listing kinds through the full page script composition and asserts
// they expose the same controls with the same labels and behavior:
// a search box, Fabric / Color / Pattern filter selects, a Sort select,
// a live result count, and one shared empty state. State is driven through
// the same globals the inline control handlers write, the seam the other
// suites use, and expectations are computed independently from the raw
// catalog data in this file.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

function makeWorld(){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,store};
}

const world=makeWorld();
const show=hash=>{world.run(`location.hash=${JSON.stringify(hash)};render()`);return world.elFor('#main').innerHTML};
const rerender=()=>{world.run('render(false)');return world.elFor('#main').innerHTML};

// Extractors over the rendered listing HTML.
const selectAriaLabels=html=>[...html.matchAll(/aria-label="(Filter by [^"]+|Sort products)"/g)].map(m=>m[1]);
const gridHtml=html=>html.slice(html.indexOf('<div class="products"'));
const gridSkus=html=>[...gridHtml(html).matchAll(/data-sku="([^"]+)"/g)].map(m=>m[1]);
const gridPrices=html=>[...gridHtml(html).matchAll(/<strong>\$([\d,]+)<\/strong>/g)].map(m=>Number(m[1].replace(/,/g,'')));
const countOf=html=>{const m=/<p class="listing-count" role="status">(\d+) results?/.exec(html);return m?Number(m[1]):null};
const selectOptions=(html,aria)=>{const block=new RegExp(`<select aria-label="${aria}"[^>]*>([\\s\\S]*?)</select>`).exec(html);assert.ok(block,'select exists: '+aria);return [...block[1].matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(m=>m[1])};
const selectedOption=(html,aria)=>{const block=new RegExp(`<select aria-label="${aria}"[^>]*>([\\s\\S]*?)</select>`).exec(html);const m=/<option selected>([^<]+)<\/option>/.exec(block[1]);return m?m[1]:null};
// Independent expectation helpers, computed from raw item data in Node.
const searchTextOf=p=>[p.name,p.sku,p.fabricCode,p.fabric,p.color,p.colorFamily,p.pattern,p.sourceCategory].filter(Boolean).join(' ').toLowerCase();
const stableSort=(items,sort)=>{const d=items.map((p,i)=>[p,i]);if(sort==='low')d.sort((a,b)=>a[0].price-b[0].price||a[1]-b[1]);if(sort==='high')d.sort((a,b)=>b[0].price-a[0].price||a[1]-b[1]);return d.map(x=>x[0])};
const pageSkus=items=>items.slice(0,36).map(p=>p.sku);

const kinds=[
  {name:'fabric listing',hash:'#collection/Suits/Wool Suits',
   items:()=>JSON.parse(world.run(`JSON.stringify(merchantSuitCollections['Wool Suits'].ids.map(i=>products[i]))`)),
   facetField:{fabric:'sourceCategory',color:'colorFamily',pattern:'pattern'},
   set:{search:v=>world.run(`fabricSearch=${JSON.stringify(v)}`),fabric:v=>world.run(`fabricCategory=${JSON.stringify(v)}`),color:v=>world.run(`fabricColor=${JSON.stringify(v)}`),pattern:v=>world.run(`fabricPattern=${JSON.stringify(v)}`),sort:v=>world.run(`fabricSort=${JSON.stringify(v)}`)},
   clear:()=>world.run('resetMerchantFilters()'),clearName:'resetMerchantFilters()'},
  {name:'design listing',hash:'#collection/Women',
   items:()=>JSON.parse(world.run(`JSON.stringify(resolveCollection('#collection/Women').ids.map(i=>products[i]))`)),
   facetField:{fabric:'fabric',color:'color',pattern:'pattern'},
   set:{search:v=>world.run(`searchText=${JSON.stringify(v)}`),fabric:v=>world.run(`catalogFabric=${JSON.stringify(v)}`),color:v=>world.run(`catalogColor=${JSON.stringify(v)}`),pattern:v=>world.run(`catalogPattern=${JSON.stringify(v)}`),sort:v=>world.run(`catalogSort=${JSON.stringify(v)}`)},
   clear:()=>world.run('resetCatalogFilters()'),clearName:'resetCatalogFilters()'}
];

const signatures={};
for(const kind of kinds){
  const items=kind.items();
  assert.ok(items.length>=8,kind.name+' holds enough items to narrow and sort');
  let html=show(kind.hash);

  // The unified control set: same controls, same order, same labels.
  assert.deepEqual(selectAriaLabels(html),['Filter by fabric','Filter by color','Filter by pattern','Sort products'],kind.name+' exposes the unified filter and sort selects in order');
  signatures[kind.name]=selectAriaLabels(html);
  for(const label of ['Fabric','Color','Pattern','Sort'])assert.ok(html.includes(`<label class="field">${label}<select`),kind.name+' labels its '+label+' select visibly');
  assert.ok(html.includes('aria-label="Search this collection"'),kind.name+' has the shared search input');
  assert.ok(html.includes('placeholder="Search by design, color, pattern or SKU"'),kind.name+' uses the shared search placeholder');
  assert.ok(html.includes('>Search</button>'),kind.name+' has a Search button');
  assert.ok(html.includes('>Clear filters</button>'),kind.name+' has a Clear filters button');
  assert.deepEqual(selectOptions(html,'Sort products'),['Featured','Price: low to high','Price: high to low'],kind.name+' offers the shared sort options');
  assert.ok(html.indexOf('listing-controls')<html.indexOf('<div class="products"'),kind.name+' places the controls above the grid');
  assert.ok(html.indexOf('listing-count')>html.indexOf('listing-controls')&&html.indexOf('listing-count')<html.indexOf('<div class="products"'),kind.name+' places the result count between the controls and the grid');
  // Every filter option is a value that exists in this listing's data.
  for(const [facet,aria,all] of [['fabric','Filter by fabric','All fabrics'],['color','Filter by color','All colors'],['pattern','Filter by pattern','All patterns']]){
    const values=new Set(items.map(p=>p[kind.facetField[facet]]).filter(Boolean));
    const options=selectOptions(html,aria);
    assert.equal(options[0],all,kind.name+' '+facet+' filter starts with '+all);
    for(const option of options.slice(1))assert.ok(values.has(option),kind.name+' '+facet+' option exists in the data: '+option);
  }
  // Full listing renders in featured order with a live count.
  assert.equal(countOf(html),items.length,kind.name+' counts every result');
  assert.deepEqual(gridSkus(html),pageSkus(items),kind.name+' first page matches the listing order');

  // Search narrows the listing, on the shared searched fields.
  const termCounts={};
  for(const p of items)for(const word of new Set(searchTextOf(p).split(/\s+/)))termCounts[word]=(termCounts[word]||0)+1;
  const term=Object.keys(termCounts).find(w=>w.length>=5&&termCounts[w]>0&&termCounts[w]<items.length);
  assert.ok(term,kind.name+' has a search term that narrows without emptying');
  kind.set.search(term);html=rerender();
  const expectedSearch=items.filter(p=>searchTextOf(p).includes(term));
  assert.equal(countOf(html),expectedSearch.length,kind.name+' search narrows to the matching items');
  assert.deepEqual(gridSkus(html),pageSkus(expectedSearch),kind.name+' search results are the matching items');
  kind.clear();html=rerender();
  assert.equal(countOf(html),items.length,kind.name+' clearing restores the full listing after search');

  // A filter narrows the listing to exactly that facet's items.
  const colorField=kind.facetField.color;
  const colorCounts={};for(const p of items)colorCounts[p[colorField]]=(colorCounts[p[colorField]]||0)+1;
  const color=Object.keys(colorCounts).find(c=>colorCounts[c]>0&&colorCounts[c]<items.length);
  kind.set.color(color);html=rerender();
  const expectedColor=items.filter(p=>p[colorField]===color);
  assert.equal(countOf(html),expectedColor.length,kind.name+' color filter narrows to the '+color+' items');
  assert.deepEqual(gridSkus(html),pageSkus(expectedColor),kind.name+' color filter shows only '+color+' items');
  assert.equal(selectedOption(html,'Filter by color'),color,kind.name+' color filter stays selected after filtering');
  kind.clear();html=rerender();
  assert.equal(countOf(html),items.length,kind.name+' clearing restores the full listing after filtering');

  // Each sort order produces the expected first page, deterministically.
  for(const sort of ['low','high']){
    kind.set.sort(sort);html=rerender();
    const expected=stableSort(items,sort);
    assert.deepEqual(gridSkus(html),pageSkus(expected),kind.name+' sort '+sort+' orders the first page by price');
    const prices=gridPrices(html);
    assert.deepEqual(prices,prices.slice().sort((a,b)=>sort==='low'?a-b:b-a),kind.name+' sort '+sort+' prices are monotonic on the page');
    const again=rerender();
    assert.deepEqual(gridSkus(again),gridSkus(html),kind.name+' sort '+sort+' is deterministic across renders');
    kind.set.sort('featured');html=rerender();
    assert.deepEqual(gridSkus(html),pageSkus(items),kind.name+' featured restores the listing order');
  }
  kind.clear();html=rerender();

  // One shared empty state, and clearing from it restores the listing.
  kind.set.search('zzzz-no-such-item');html=rerender();
  assert.equal(countOf(html),0,kind.name+' counts zero results for a hopeless search');
  assert.ok(html.includes('Let’s try another combination.'),kind.name+' shows the shared empty state heading');
  assert.ok(html.includes('No items match those filters. Clear the filters to see the full listing again.'),kind.name+' shows the shared empty state text');
  assert.ok(html.includes(`onclick="${kind.clearName}"`),kind.name+' empty state clears through '+kind.clearName);
  kind.clear();html=rerender();
  assert.equal(countOf(html),items.length,kind.name+' clearing restores the full listing after the empty state');
}

// The two kinds expose the identical control signature.
assert.deepEqual(signatures['fabric listing'],signatures['design listing'],'fabric and design listings expose the same control set');

console.log('Listing control checks passed: fabric and design listings share one control set (search, Fabric, Color and Pattern filters, sort, live count, shared empty state), search and filters narrow on both kinds, sort orders are deterministic on both kinds, and clearing restores the full listing.');
