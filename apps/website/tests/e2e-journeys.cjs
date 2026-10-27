const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// End to end journey coverage for the Wave 1 changes. The feature suites
// (standard-sizes, measurements, customizer-method, bag-lines, bag-edit)
// test each fix in isolation; this suite drives complete user paths across
// screens in sequence, on top of the same real storefront scripts loaded
// into a Node vm with stubbed DOM and storage, in the same style.
//
// J1 menu to product (NAV-02, NAV-03, NAV-04)
// J2 standard size suit journey (SIZ-01, SIZ-02, CRT-01)
// J3 body measurement journey (SIZ-06, CRT-01)
// J4 method switch journey (SIZ-02)
// J5 quick add journey (SIZ-02, CRT-01, CRT-02)
// J6 bag edit journey (CRT-02, CRT-01)
// J7 women journey (SIZ-02 rule)
// J11 size guide journey (SIZ-03)
// J12 cross product customizer state journey (CUS-07)

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

// A fresh storefront world: new storage, new element registry, the real
// app.js, complete.js, catalog-data.js, expanded.js, gallery.js and
// quick-add.js, the script composition the live page loads for these flows.
// Seed profiles or config are written
// to storage before the scripts load, exactly as a returning shopper's
// browser would present them.
function makeWorld(seed={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(seed.profiles)localStorage.setItem('suits-profiles',JSON.stringify(seed.profiles));
  if(seed.config)localStorage.setItem('suits-config',JSON.stringify(seed.config));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['app.js','complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag};
}

// ---------------------------------------------------------------- J1
// Render the navigation from the real navigation data and navigation.js,
// then follow one rendered destination into a collection and open a product.
{
  const navEl=makeEl();
  const navCtx=vm.createContext({console,$:()=>navEl,document:{querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},location:{hash:'#home'}});
  vm.runInContext(fs.readFileSync('public/navigation-data.js','utf8'),navCtx);
  vm.runInContext(fs.readFileSync('public/navigation.js','utf8'),navCtx);
  const html=navEl.innerHTML;
  assert.ok(html.includes('id="nav-0"'),'navigation rendered into the catalog nav element');
  const menus=html.split('<details class="nav-item"').slice(1).map(chunk=>{
    const name=/<summary>([^<]+)<\/summary>/.exec(chunk)[1];
    const anchors=[...chunk.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m=>({href:m[1],label:m[2]}));
    const headings=[...chunk.matchAll(/<h3>([^<]*)<\/h3>/g)].map(m=>m[1]);
    return{name,anchors,headings};
  });
  assert.deepEqual(menus.map(m=>m.name),['Suits','Jackets','Trousers','Shirts','Weddings','More','Women'],'all seven menus render in order');
  let totalAnchors=0;const destinations=new Set();
  for(const menu of menus){
    const labels=menu.anchors.map(a=>a.label);
    assert.equal(new Set(labels).size,labels.length,'no duplicate link labels within the '+menu.name+' menu');
    totalAnchors+=menu.anchors.length;
    for(const a of menu.anchors)destinations.add(a.href);
  }
  assert.equal(totalAnchors,96,'rendered menu rows match the audited baseline');
  assert.equal(destinations.size,94,'rendered destination count matches the catalog suite baseline of 94');
  for(const name of ['Suits','Jackets','Trousers']){
    const menu=menus.find(m=>m.name===name);
    assert.ok(menu.headings.includes('Shop by Collection'),name+' group is headed Shop by Collection');
  }
  assert.ok(!html.includes('Shop by Fabric'),'no menu is headed Shop by Fabric anymore');
  assert.ok(menus.find(m=>m.name==='More').headings.includes('Services and Extras'),'More has a Services and Extras heading');
  const threeD={};
  for(const menu of menus)for(const a of menu.anchors)if(a.label.includes('3D'))threeD[a.label]=a.href;
  assert.deepEqual(threeD,{'3D Suit Configurator':'#studio/suit','3D Jacket Configurator':'#studio/jacket','3D Trousers Configurator':'#studio/pants'},'the three 3D entries use the unified names and lead to the studio destinations');

  // Follow one rendered destination to its collection and open a product.
  const suits=menus.find(m=>m.name==='Suits');
  const link=suits.anchors.find(a=>a.href.startsWith('#collection/Suits/'));
  assert.ok(link,'Suits menu offers a collection destination');
  const collections=require('../data/collections.json');
  const collection=collections[link.href];
  assert.ok(collection,'rendered destination resolves to a real collection: '+link.href);
  assert.ok(collection.ids.length>=36,'collection holds at least 36 designs: '+link.href);
  const firstId=collection.ids[0];
  const world=makeWorld();
  assert.equal(world.run(`resolveCollection('${link.href}').ids[0]`),firstId,'the runtime collection resolver agrees with the catalog data for '+link.href);
  assert.ok(world.run(`resolveCollection('${link.href}').ids.length`)>=36,'the runtime collection holds at least 36 designs');
  world.run(`chooseProduct(${firstId})`);
  assert.equal(world.run('config.product'),firstId,'opening the product selects it');
  assert.equal(world.run('location.hash'),'#product/'+firstId,'opening the product lands on its product page');
  const productName=world.run(`products[${firstId}].name`);
  assert.ok(world.run(`productPage(${firstId})`).includes(productName),'the product page renders for '+productName);
  world.run(`beginDesign(${firstId})`);
  assert.equal(world.run('location.hash'),'#customize','designing from the product page lands on the customize route');
  assert.equal(world.run('config.product'),firstId,'the customizer opens on the chosen product');
}

// ---------------------------------------------------------------- J2
// Standard size suit journey: product, customizer, method cards, Studio
// ready flow with no preselected sizes, saved profile, bag with lining and
// chosen sizes on the rendered line.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  w.run("setOption('lining','Burgundy')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  const stepHtml=w.run('customize()');
  assert.ok(stepHtml.includes('method-cards'),'Measurements step offers the method cards');
  assert.ok(stepHtml.includes('How would you like to find your fit?'),'Measurements step asks how to find the fit');
  assert.ok(stepHtml.includes('Measure my body')&&stepHtml.includes('Use a standard size'),'both methods are offered in the customizer');
  w.run("setCustomizerMethod('ready')");
  assert.equal(w.run('draft.method'),'ready','choosing standard size in the customizer carries into the Studio');
  w.run('startMeasurements()');
  assert.equal(w.run('location.hash'),'#measure','the Studio opens from the customizer');
  assert.equal(w.run('draft.step'),0,'the Studio starts at the method step');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the sizes step');
  assert.deepEqual(JSON.parse(w.run('JSON.stringify(draft.ready)')),{jacket:'',length:'',trouser:''},'a fresh standard size profile starts with jacket, length and trouser all unselected');
  const sizesHtml=w.run('measure()');
  for(const prompt of ['Choose a jacket size','Choose a jacket length','Choose a trouser size'])assert.ok(sizesHtml.includes(prompt),'sizes step shows the prompt: '+prompt);
  w.elFor('#measureError').textContent='';
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'Continue is blocked while sizes are missing');
  const blocked=w.elFor('#measureError').textContent;
  for(const label of ['jacket size','jacket length','trouser size'])assert.ok(blocked.includes(label),'the blocked message names the missing '+label+'. Got: '+blocked);
  // The size selects write draft.ready through their onchange handlers.
  w.run("draft.ready.jacket='42';draft.ready.length='Long';draft.ready.trouser='36';saveDraft()");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'Continue advances to review once every size is chosen');
  const reviewHtml=w.run('measure()');
  for(const value of ['<strong>42</strong>','<strong>Long</strong>','<strong>36</strong>'])assert.ok(reviewHtml.includes(value),'review echoes the chosen size '+value);
  w.run("draft.name='E2E standard sizes'");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the standard size profile');
  assert.equal(w.run('profiles[0].method'),'ready','the saved profile carries the standard size method');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');
  w.elFor('#profileSelect').value=w.run('profiles[0].id');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Burgundy lining'),'the bag line shows the lining chosen at the Personalize step');
  assert.ok(lineHtml.includes('Standard sizes'),'the bag line shows the standard size summary');
  assert.ok(lineHtml.includes('Jacket size 42'),'the bag line shows the chosen jacket size');
  assert.ok(lineHtml.includes('Jacket length Long'),'the bag line shows the chosen jacket length');
  assert.ok(lineHtml.includes('Trouser size 36'),'the bag line shows the chosen trouser size');
}

// ---------------------------------------------------------------- J3
// Body measurement journey: several invalid values are reported together,
// then corrected, the profile is saved, and the bag line lists every
// entered measurement plus the chosen lining.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');
  w.run("setOption('lining','Midnight')");
  w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the jacket measurements step');
  // Field inputs write through updateValue, their real oninput handler.
  w.run("updateValue('chest','200');updateValue('waist','5');updateValue('sleeve','100')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'Continue is blocked while jacket measurements are invalid');
  const summary=w.elFor('#measureError').innerHTML;
  assert.equal((summary.match(/<li>/g)||[]).length,5,'all five jacket problems are listed in one message');
  for(const text of ['Please check chest.','Please check natural waist.','Please check shoulder width.','Please check sleeve length.','Please check jacket length.'])assert.ok(summary.includes(text),'the one message includes: '+text);
  assert.equal(w.elFor('#measureInput-chest').getAttribute('aria-invalid'),'true','the out of range chest input is marked invalid');
  w.run("updateValue('chest','40');updateValue('waist','32');updateValue('shoulder','18');updateValue('sleeve','25');updateValue('jacket','29')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'valid jacket measurements advance to the trousers step');
  w.run("updateValue('seat','40');updateValue('trouserWaist','34');updateValue('thigh','24');updateValue('inseam','32');updateValue('outseam','42')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid trouser measurements advance to review');
  w.run("draft.name='E2E body profile'");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the body measurement profile');
  assert.equal(w.run('profiles[0].method'),'body','the saved profile carries the body method');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');
  w.elFor('#profileSelect').value=w.run('profiles[0].id');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Body measurements'),'the bag line shows the body measurement summary');
  for(const text of ['Chest 40 in','Natural waist 32 in','Shoulder width 18 in','Sleeve length 25 in','Jacket length 29 in','Seat / hips 40 in','Trouser waist 34 in','Thigh 24 in','Inseam 32 in','Outseam 42 in'])assert.ok(lineHtml.includes(text),'the bag line lists the entered measurement: '+text);
  assert.ok(lineHtml.includes('Midnight lining'),'the bag line shows the chosen lining');
}

// ---------------------------------------------------------------- J4
// Method switch journey: with a body profile and a standard size profile
// saved for the same wearer, switching the method card in the customizer
// changes which profile Add to Bag uses, in both directions.
{
  const bodyProfile={id:'p-body',name:'Body profile',method:'body',wearer:'Men',unit:'in',fit:'Tailored',values:{chest:40},created:'2026-01-01T00:00:00.000Z'};
  const readyProfile={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'42',length:'Long',trouser:'36'},created:'2026-01-02T00:00:00.000Z'};
  const w=makeWorld({profiles:[bodyProfile,readyProfile],config:{product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profileId:'p-body'}});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('ready')");
  assert.equal(w.run('draft.method'),'ready','the Studio state follows the switch to standard size');
  assert.equal(w.run('config.profileId'),'p-ready','switching selects the standard size profile, never silently keeping the body profile');
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'first Add to Bag creates one line');
  assert.equal(w.bag()[0].profile.id,'p-ready','the bagged item carries the standard size profile');
  assert.equal(w.bag()[0].profile.method,'ready','the bagged profile method matches the chosen method');
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  assert.equal(w.run('draft.method'),'body','the Studio state follows the switch back to body');
  assert.equal(w.run('config.profileId'),'p-body','switching back selects the body profile');
  w.elFor('#profileSelect').value='p-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,2,'second Add to Bag creates a second line');
  assert.equal(w.bag()[1].profile.id,'p-body','the second bagged item carries the body profile');
  assert.equal(w.bag()[1].profile.method,'body','the second bagged profile method matches the chosen method');
}

// ---------------------------------------------------------------- J5
// Quick add journey: no profile, no bagging and a clear message; then a
// saved profile makes Quick add work with the standard details shown; the
// quick added line offers Edit.
{
  const w=makeWorld();
  w.run('quickAddProduct(0)');
  const emptyDialog=w.elFor('#modalContent').innerHTML;
  assert.ok(emptyDialog.includes('Create a measurement profile before adding this tailored garment.'),'with no saved profiles the Quick add dialog explains a profile must be created first');
  assert.ok(!emptyDialog.includes('name="profile"'),'with no saved profiles the dialog offers no profile form to submit');
  w.run("submitQuickAdd(0,{__data:{profile:'',fit:'Tailored'}})");
  assert.equal(w.bag().length,0,'Quick add bags nothing without a profile');
  assert.equal(w.elFor('#quickAddError').textContent,'Please choose a saved measurement profile first, or take your measurements before adding this garment to your bag.','Quick add names the missing measurement profile in its own words');
  // Save a standard size profile through the Studio save path.
  w.run("draft.method='ready';draft.ready={jacket:'42',length:'Long',trouser:'36'};draft.step=2;draft.name='E2E quick add sizes';saveDraft()");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the profile used by Quick add');
  const profileId=w.run('profiles[0].id');
  w.run('quickAddProduct(0)');
  const dialog=w.elFor('#modalContent').innerHTML;
  assert.ok(dialog.includes('id="quickAddError"'),'the reopened dialog carries the inline error area');
  w.run(`submitQuickAdd(0,{__data:{profile:'${profileId}',fit:'Tailored'}})`);
  assert.equal(w.bag().length,1,'Quick add bags the garment once a profile is chosen');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Notch lapel'),'the quick added line shows the standard lapel');
  assert.ok(lineHtml.includes('Two button'),'the quick added line shows the standard closure');
  assert.ok(lineHtml.includes('Tonal lining'),'the quick added line shows the standard lining');
  assert.ok(lineHtml.includes('Jacket size 42'),'the quick added line shows the profile sizes');
  assert.ok(lineHtml.includes('>Edit</button>'),'the quick added line offers Edit');
  assert.equal(w.run('editableBagItem(bag[0])'),true,'the quick added line is editable');
}

// ---------------------------------------------------------------- J6
// Bag edit journey: Edit reopens the customizer with the previous choices,
// changing only the lining updates the same line, cancel leaves the bag
// byte-identical, and the checkout line shows the update without buttons.
{
  const profile={id:'profile-1',name:'Test fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-10-27T00:00:00.000Z'};
  const w=makeWorld({profiles:[profile]});
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');
  w.run("setOption('lapel','Peak');setOption('lining','Burgundy')");
  w.run('nextConfig()');
  w.elFor('#profileSelect').value='profile-1';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const before=JSON.parse(JSON.stringify(w.bag()[0]));
  assert.equal(before.lining,'Burgundy','the bagged suit carries the chosen lining');
  w.run('openBag()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('>Edit</button>'),'the bag offers Edit on the configured line');
  w.run(`editBagItem('${before.id}')`);
  assert.equal(w.run('editingBagId'),before.id,'Edit targets the bagged line');
  assert.ok(w.run('customize()').includes('editing an item from your bag'),'the customizer shows the editing note');
  assert.equal(w.run('config.lining'),'Burgundy','Edit restores the previous lining');
  assert.equal(w.run('config.lapel'),'Peak','Edit restores the previous lapel');
  w.run('stage=1');
  const personalize=w.run('customize()');
  assert.ok(/class="choice active" aria-pressed="true" onclick="setOption\('lining','Burgundy'\)"/.test(personalize),'the Personalize step shows the previous lining selected');
  w.run("setOption('lining','Midnight')");
  w.run('stage=2');
  w.elFor('#profileSelect').value='profile-1';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'saving the edit keeps exactly one bag line');
  assert.equal(w.bag()[0].id,before.id,'the edited line keeps its identity');
  assert.deepEqual(w.bag()[0],{...before,lining:'Midnight'},'only the lining changed; every other field including all profile values is unchanged');
  const snapshot=w.store.get('suits-bag');
  w.run(`editBagItem('${before.id}')`);
  w.run("setOption('lining','Tonal')");
  w.run('cancelBagEdit()');
  assert.equal(w.run('editingBagId'),null,'cancel ends the edit session');
  assert.equal(w.store.get('suits-bag'),snapshot,'cancelling an edit leaves the bag byte-identical');
  const checkoutHtml=w.run('lineHtml(bag[0],false)');
  assert.ok(checkoutHtml.includes('Midnight lining'),'the checkout line shows the updated lining');
  assert.ok(checkoutHtml.includes('Body measurements'),'the checkout line shows the profile summary');
  assert.ok(checkoutHtml.includes('Chest 40 in'),'the checkout line lists the profile measurements');
  assert.ok(!checkoutHtml.includes('>Edit</button>')&&!checkoutHtml.includes('>Remove</button>'),'the checkout line renders no Edit or Remove buttons');
  assert.ok(!checkoutHtml.includes('editBagItem')&&!checkoutHtml.includes('removeBag'),'the checkout line carries no bag actions');
}

// ---------------------------------------------------------------- J7
// Women journey: the customizer Measurements step offers only the body
// method with the explanatory note, and the standard size path cannot be
// used to bag a Women garment.
{
  const womenBody={id:'p-women-body',name:'Women body',method:'body',wearer:'Women',unit:'in',fit:'Tailored',values:{chest:36},created:'2026-01-01T00:00:00.000Z'};
  const womenReady={id:'p-women-ready',name:'Women ready',method:'ready',wearer:'Women',fit:'Tailored',ready:{jacket:'38',length:'Regular',trouser:'32'},created:'2026-01-02T00:00:00.000Z'};
  const w=makeWorld({profiles:[womenBody,womenReady]});
  const idx=w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx>=0,'the catalog holds a Women suit for the journey');
  assert.equal(w.run(`productWearerOf(products[${idx}])`),'Women','the chosen garment is a Women garment');
  w.run(`chooseProduct(${idx})`);w.run(`beginDesign(${idx})`);
  w.run('nextConfig()');w.run('nextConfig()');
  const stepHtml=w.run('customize()');
  assert.ok(stepHtml.includes("setCustomizerMethod('body')"),'the body method card is offered for the Women garment');
  assert.ok(!stepHtml.includes("setCustomizerMethod('ready')"),'no standard size card is offered for the Women garment');
  assert.ok(stepHtml.includes('Standard sizes are not offered for this garment'),'the step explains standard sizes are not offered for this garment');
  w.run("setCustomizerMethod('ready')");
  assert.equal(w.run('draft.method'),'body','a standard size switch is refused for the Women garment');
  assert.equal(w.run('config.profileId'),'p-women-body','the selection stays on the body profile, not the standard size profile');
  w.elFor('#profileSelect').value=w.run('config.profileId');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the Women garment is bagged through the body path');
  assert.equal(w.bag()[0].profile.id,'p-women-body','the bagged profile is the body profile');
  assert.equal(w.bag()[0].profile.method,'body','no standard size profile is bagged for the Women garment');
}

// ---------------------------------------------------------------- J8
// Listing controls journey (CAT-01): from a menu destination open a fabric
// listing, use search, a filter and a sort, and open a product from the
// narrowed results; then open a design listing and repeat the same control
// sequence, asserting the same controls exist with the same labels. This
// world additionally loads the merchant scripts, completing the live page
// composition, because fabric listings are rendered by merchant.js.
{
  const w=makeWorld();
  w.run(fs.readFileSync('public/merchant-data.js','utf8'));
  w.run(fs.readFileSync('public/merchant.js','utf8'));
  const show=hash=>{w.run(`location.hash=${JSON.stringify(hash)};render()`);return w.elFor('#main').innerHTML};
  const again=()=>{w.run('render(false)');return w.elFor('#main').innerHTML};
  const signature=html=>[...html.matchAll(/aria-label="(Filter by [^"]+|Sort products)"/g)].map(m=>m[1]);
  const count=html=>Number(/<p class="listing-count" role="status">(\d+) results?/.exec(html)[1]);
  const grid=html=>html.slice(html.indexOf('<div class="products"'));
  const prices=html=>[...grid(html).matchAll(/<strong>\$([\d,]+)<\/strong>/g)].map(m=>Number(m[1].replace(/,/g,'')));
  const firstProduct=html=>Number(/href="#product\/(\d+)"/.exec(grid(html))[1]);
  const openProduct=html=>{const id=firstProduct(html);w.run(`location.hash='#product/${id}';render()`);const page=w.elFor('#main').innerHTML;assert.ok(page.includes(`beginDesign(${id})`),'the product page offers to design the opened product');w.run(`beginDesign(${id})`);assert.equal(w.run('location.hash'),'#customize','the product opens into the customizer');assert.equal(w.run('config.product'),id,'the opened product is the first narrowed result');return id};
  const searchTextOf=p=>[p.name,p.sku,p.fabricCode,p.fabric,p.color,p.colorFamily,p.pattern,p.sourceCategory].filter(Boolean).join(' ').toLowerCase();
  const partialWord=items=>{const counts={};for(const p of items)for(const word of new Set(searchTextOf(p).split(/\s+/)))counts[word]=(counts[word]||0)+1;const word=Object.keys(counts).filter(x=>x.length>=3&&counts[x]>0&&counts[x]<items.length).sort((a,b)=>b.length-a.length)[0];assert.ok(word,'a narrowing search word exists');return word};
  const partialValue=(items,field)=>{const counts={};for(const p of items)counts[p[field]]=(counts[p[field]]||0)+1;const value=Object.keys(counts).find(k=>counts[k]>0&&counts[k]<items.length);assert.ok(value,'a narrowing filter value exists');return value};

  // Fabric listing: Wool Suits, a Suits menu destination.
  let html=show('#collection/Suits/Wool Suits');
  const fabricSignature=signature(html);
  assert.deepEqual(fabricSignature,['Filter by fabric','Filter by color','Filter by pattern','Sort products'],'the fabric listing exposes the unified control set');
  const wool=JSON.parse(w.run(`JSON.stringify(merchantSuitCollections['Wool Suits'].ids.map(i=>products[i]))`));
  assert.equal(count(html),wool.length,'the fabric listing starts with every Wool Suits design');
  const woolColor=partialValue(wool,'colorFamily');
  const woolFiltered=wool.filter(p=>p.colorFamily===woolColor);
  w.run(`fabricColor=${JSON.stringify(woolColor)}`);html=again();
  assert.equal(count(html),woolFiltered.length,'the fabric Color filter narrows the listing');
  const woolTerm=partialWord(woolFiltered);
  const woolSearched=woolFiltered.filter(p=>searchTextOf(p).includes(woolTerm));
  w.run(`fabricSearch=${JSON.stringify(woolTerm)}`);html=again();
  assert.equal(count(html),woolSearched.length,'fabric search narrows the filtered listing further');
  w.run(`fabricSort='low'`);html=again();
  assert.deepEqual(prices(html),woolSearched.map(p=>p.price).sort((a,b)=>a-b),'fabric sort orders the narrowed results by price, low to high');
  openProduct(html);
  w.run('location.hash="#collection/Suits/Wool Suits";render()');
  w.run('resetMerchantFilters()');html=again();
  assert.equal(count(html),wool.length,'clearing restores the full fabric listing');

  // Design listing: Women, repeating the same control sequence.
  html=show('#collection/Women');
  assert.deepEqual(signature(html),fabricSignature,'the design listing exposes the same controls with the same labels');
  const women=JSON.parse(w.run(`JSON.stringify(resolveCollection('#collection/Women').ids.map(i=>products[i]))`));
  assert.equal(count(html),women.length,'the design listing starts with every Women design');
  const womenColor=partialValue(women,'color');
  const womenFiltered=women.filter(p=>p.color===womenColor);
  w.run(`catalogColor=${JSON.stringify(womenColor)}`);html=again();
  assert.equal(count(html),womenFiltered.length,'the design Color filter narrows the listing');
  const womenTerm=partialWord(womenFiltered);
  const womenSearched=womenFiltered.filter(p=>searchTextOf(p).includes(womenTerm));
  w.run(`searchText=${JSON.stringify(womenTerm)}`);html=again();
  assert.equal(count(html),womenSearched.length,'design search narrows the filtered listing further');
  w.run(`catalogSort='high'`);html=again();
  assert.equal(prices(html)[0],Math.max(...womenSearched.map(p=>p.price)),'design sort puts the highest priced narrowed result first');
  assert.deepEqual(prices(html),prices(html).slice().sort((a,b)=>b-a),'design sort orders the page by price, high to low');
  openProduct(html);
  w.run('location.hash="#collection/Women";render()');
  w.run('resetCatalogFilters()');html=again();
  assert.equal(count(html),women.length,'clearing restores the full design listing');
}


// ---------------------------------------------------------------- J9
// Delivery estimate journey (CAT-03): the estimate built from the one
// DELIVERY_ESTIMATE_WEEKS config value appears on the product page, and
// the same estimate appears in the checkout order summary once the item
// is in the bag.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const page=w.run('productPage(0)');
  assert.ok(page.includes('Made to order. Delivery in about 1 week.'),'the product page shows the delivery estimate by the purchase controls');
  w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Delivery in about 1 week.'),'the checkout order summary shows the same delivery estimate as the product page');
  assert.ok(checkout.indexOf('Delivery in about 1 week.')>checkout.indexOf('order-summary'),'the estimate appears inside the checkout order summary area');
}

// ---------------------------------------------------------------- J10
// Listing model labels (CAT-02): from the rendered menus, a fabric
// listing announces itself as fabrics and a design listing as designs,
// and a product opens from each. This journey needs the full live script
// composition (navigation.js and merchant.js included), so it builds its
// own world the same way the listing-labels feature suite does.
{
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class J10FormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const sandbox={console,localStorage,document:documentStub,location:{hash:'#home'},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:J10FormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const navHtml=elFor('#catalogNav').innerHTML;
  const menuAnchors=name=>{
    const chunk=navHtml.split('<details class="nav-item"').slice(1).find(c=>c.includes(`data-menu="${name}"`));
    assert.ok(chunk,'the '+name+' menu renders');
    return[...chunk.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m=>({href:m[1],label:m[2]}));
  };
  // Fabric listing: Suits, Wool Suits, a fabric led collection.
  const wool=menuAnchors('Suits').find(a=>a.href==='#collection/Suits/Wool%20Suits');
  assert.ok(wool,'the Suits menu links to Wool Suits');
  const fabricHtml=run(`categoryCollection('${wool.href}')`);
  assert.ok(fabricHtml.includes('<span class="eyebrow">Fabrics</span>'),'the fabric listing is eyebrowed Fabrics');
  assert.ok(fabricHtml.includes('<p>Choose a fabric, then design your garment around it.</p>'),'the fabric listing explains the fabric model');
  assert.ok(!fabricHtml.includes('<span class="eyebrow">Designs</span>'),'the fabric listing never claims to be designs');
  const fabricCard=/href="#product\/(\d+)"/.exec(fabricHtml);
  assert.ok(fabricCard,'the fabric listing offers products to open');
  run(`location.hash='#product/${fabricCard[1]}';render(false)`);
  assert.ok(elFor('#main').innerHTML.includes('product-page'),'a product opens from the fabric listing');
  // Design listing: Women, Suits, the destination the audit found reading
  // as a fabric collection while listing designs.
  const womenSuits=menuAnchors('Women').find(a=>a.href==='#collection/Women/Suits');
  assert.ok(womenSuits,'the Women menu links to Women Suits');
  const designHtml=run(`categoryCollection('${womenSuits.href}')`);
  assert.ok(designHtml.includes('<span class="eyebrow">Designs</span>'),'the design listing is eyebrowed Designs');
  assert.ok(designHtml.includes('<p>Finished designs, ready to customize.</p>'),'the design listing explains the design model');
  assert.ok(!designHtml.includes('<span class="eyebrow">Fabrics</span>'),'the design listing never claims to be fabrics');
  const designCard=/href="#product\/(\d+)"/.exec(designHtml);
  assert.ok(designCard,'the design listing offers products to open');
  run(`location.hash='#product/${designCard[1]}';render(false)`);
  assert.ok(elFor('#main').innerHTML.includes('product-page'),'a product opens from the design listing');
  console.log('E2E J10 passed: menu to fabric listing shows the Fabrics signal, menu to design listing shows the Designs signal, and a product opens from each.');
}

// ---------------------------------------------------------------- J11
// Size guide journey (SIZ-03): inside the Studio standard size flow the
// shopper opens the size guide, checks jacket 40 against a 40 in chest,
// switches the Studio unit to cm and reads 102, then chooses the sizes,
// saves the profile, and bags the garment.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()'); // stage 0 to 1 to 2, Measurements
  w.run("setCustomizerMethod('ready')");
  w.run('startMeasurements()');
  assert.equal(w.run('location.hash'),'#measure','the Studio opens from the customizer');
  w.run('measureNext()'); // method step to sizes step
  assert.equal(w.run('draft.step'),1,'the Studio reaches the sizes step');
  let sizesHtml=w.run('measure()');
  assert.ok(sizesHtml.includes('aria-expanded="false"'),'the size guide starts collapsed');
  assert.ok(!sizesHtml.includes('id="sizeGuide"'),'no guide tables render while collapsed');
  w.run('toggleSizeGuide()');
  sizesHtml=w.run('measure()');
  assert.ok(sizesHtml.includes('aria-expanded="true"'),'the size guide opens from its toggle');
  assert.ok(sizesHtml.includes('<tr><td>40</td><td>40</td></tr>'),'jacket 40 matches a body chest of 40 in (rule D1)');
  w.run("changeUnit('cm')");
  sizesHtml=w.run('measure()');
  assert.ok(sizesHtml.includes('Body chest (cm)'),'the guide follows the Studio unit switch to cm');
  assert.ok(sizesHtml.includes('<tr><td>40</td><td>102</td></tr>'),'jacket 40 reads chest 102 cm after the switch');
  w.run("changeUnit('in')");
  // The size selects write draft.ready through their onchange handlers.
  w.run("draft.ready.jacket='40';draft.ready.length='Regular';draft.ready.trouser='34';saveDraft()");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'Continue advances to review after choosing sizes read from the guide');
  w.run("draft.name='E2E size guide'");
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the profile is saved after using the guide');
  assert.equal(w.run('profiles[0].ready.jacket'),'40','the saved profile carries the jacket size read from the guide');
  w.elFor('#profileSelect').value=w.run('profiles[0].id');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the garment is bagged with the guide informed profile');
  assert.ok(w.run('lineHtml(bag[0])').includes('Jacket size 40'),'the bag line shows the chosen jacket size');
}

console.log('E2E journey J11 passed: the size guide is consulted in inches and cm inside the standard size flow, then the profile is saved and the garment bagged.');

// ---------------------------------------------------------------- J12
// Cross product state journey (CUS-07): the shopper designs one suit with
// distinctive options and a monogram and bags it, then opens a second
// product page directly (the path card links take) and starts designing
// it: none of the first product's options or monogram may appear. Bag
// Edit of the first suit still restores its exact configuration.
{
  const body={id:'p-body',name:'Body profile',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[body]});
  w.run('beginDesign(0)');
  w.run(`setOption('fit','Slim');setOption('lapel','Peak');setOption('closure','One button');setOption('lining','Burgundy');config.monogram='E2E';saveConfig();stage=2;render(false)`);
  w.elFor('#profileSelect').value='p-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the first suit is bagged with its distinctive options');
  const first=w.bag()[0];
  assert.equal(first.monogram,'E2E','the first suit keeps its own monogram');

  w.run(`location.hash='#product/1';render()`);
  assert.ok(w.elFor('#main').innerHTML.includes('The Modern Charcoal'),'the journey lands on the second product page');
  w.run('beginDesign(1)');
  const started=JSON.parse(w.run('JSON.stringify(config)'));
  assert.deepEqual({lapel:started.lapel,closure:started.closure,fit:started.fit,lining:started.lining,monogram:started.monogram},{lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:''},'the second product starts from its own defaults');
  const personalize=w.run('stage=1;customize()');
  assert.ok(!personalize.includes('E2E'),'the first product monogram is absent from the second product customizer');
  assert.ok(personalize.includes(`class="choice active" aria-pressed="true" onclick="setOption('lining','Tonal')"`),'the second product shows its default lining as the active choice');
  w.run('stage=2;render(false)');
  w.elFor('#profileSelect').value='p-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,2,'the second product is bagged as its own line');
  assert.equal(w.bag()[1].monogram,'','the bagged second product carries no monogram from the first');
  assert.equal(w.bag()[1].lining,'Tonal','the bagged second product carries its default lining');

  w.run(`editBagItem('${first.id}')`);
  const restored=JSON.parse(w.run('JSON.stringify(config)'));
  assert.deepEqual({lapel:restored.lapel,closure:restored.closure,fit:restored.fit,lining:restored.lining,monogram:restored.monogram},{lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'E2E'},'bag Edit restores the first suit configuration exactly');
  assert.ok(w.run('customize()').includes('editing an item from your bag'),'the customizer shows the edit in progress');
}

console.log('E2E journey J12 passed: designing a second product starts clean with no options or monogram from the first, the bagged second line carries only its own defaults, and bag Edit restores the first product configuration.');


console.log('E2E journey checks passed: menu to product, standard size and body measurement journeys, method switching, quick add, bag edit with checkout rendering, the Women body-only rule, and the unified listing controls journey all hold end to end.');
console.log('J9 delivery estimate journey passed: the product page and the checkout order summary show the same estimate from the one config value.');
