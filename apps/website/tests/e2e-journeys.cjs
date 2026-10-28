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
// J13 women suit trouser front journey (CUS-06, Pleats group since 3.2)
// J14 jacket core options journey (CUS-01)
// J15 trousers options journey (CUS-01)
// J16 jacket finishes journey (CUS-01)
// J17 priced extras, tier and monogram fields journey (CUS-02)
// J18 detail add ons, tailor changes and comments journey (CUS-02)
// J19 real URL entry journey (NAV-01)
// J20 real product URL entry journey (NAV-01, Wave 4 stage 3a)
// J21 category spot entry journeys (NAV-01, Wave 4 stage 4)
// J22 real URL entry to demo order, payment return boot (NAV-01)
// J23 hash entry parity with the real URL entry (NAV-01)

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

// A fresh storefront world entered the way the live server delivers it:
// at a real pathname (or at / with a hash), with the full script
// composition the served document loads, boot translator and route data
// first, in document order. Used by the Wave 4 stage 4 entry journeys;
// J19 and J20 above carry their own inline copies of this setup.
function makeEntryWorld({pathname='/',hash='',profiles=null}={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(profiles)localStorage.setItem('suits-profiles',JSON.stringify(profiles));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class EntryFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash,pathname};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:EntryFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag,location};
}

// ---------------------------------------------------------------- J1
// Render the navigation from the real navigation data and navigation.js,
// then follow one rendered destination into a collection and open a product.
{
  const navEl=makeEl();
  const navCtx=vm.createContext({console,$:()=>navEl,document:{querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},location:{hash:'#home'}});
  // The boot translator loads first, as in the served document, so
  // menuLink renders the real URLs the migration ships.
  vm.runInContext(fs.readFileSync('public/real-routes-data.js','utf8'),navCtx);
  vm.runInContext(fs.readFileSync('public/real-routes.js','utf8'),navCtx);
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
  assert.deepEqual(threeD,{'3D Suit Configurator':'/studio/suit','3D Jacket Configurator':'/studio/jacket','3D Trousers Configurator':'/studio/pants'},'the three 3D entries use the unified names and lead to the studio destinations');
  for(const menu of menus)for(const a of menu.anchors)assert.ok(a.href.startsWith('/'),'every rendered menu href is now a real path: '+a.href);

  // Follow one rendered destination to its collection and open a product.
  const suits=menus.find(m=>m.name==='Suits');
  const link=suits.anchors.find(a=>a.href.startsWith('/collections/suits/'));
  assert.ok(link,'Suits menu offers a collection destination');
  const collections=require('../data/collections.json');
  const routeMap=require('../data/real-routes.json');
  const linkHash=routeMap.paths[link.href];
  assert.ok(linkHash,'rendered destination is a canonical real path in the generated map: '+link.href);
  const collection=collections[linkHash];
  assert.ok(collection,'rendered destination resolves to a real collection: '+link.href);
  assert.ok(collection.ids.length>=36,'collection holds at least 36 designs: '+link.href);
  const firstId=collection.ids[0];
  const world=makeWorld();
  assert.equal(world.run(`resolveCollection('${linkHash}').ids[0]`),firstId,'the runtime collection resolver agrees with the catalog data for '+link.href);
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
  const firstProduct=html=>Number(/href="\/product\/(\d+)"/.exec(grid(html))[1]);
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
  for(const f of ['real-routes-data.js','real-routes.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const navHtml=elFor('#catalogNav').innerHTML;
  const menuAnchors=name=>{
    const chunk=navHtml.split('<details class="nav-item"').slice(1).find(c=>c.includes(`data-menu="${name}"`));
    assert.ok(chunk,'the '+name+' menu renders');
    return[...chunk.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(m=>({href:m[1],label:m[2]}));
  };
  const routeMap=require('../data/real-routes.json');
  // Fabric listing: Suits, Wool Suits, a fabric led collection. The
  // menu now links to the real URL; the listing dispatch still takes
  // the hash route the generated map pairs with it.
  const wool=menuAnchors('Suits').find(a=>a.href==='/collections/suits/wool-suits');
  assert.ok(wool,'the Suits menu links to Wool Suits at its real URL');
  const fabricHtml=run(`categoryCollection('${routeMap.paths[wool.href]}')`);
  assert.ok(fabricHtml.includes('<span class="eyebrow">Fabrics</span>'),'the fabric listing is eyebrowed Fabrics');
  assert.ok(fabricHtml.includes('<p>Choose a fabric, then design your garment around it.</p>'),'the fabric listing explains the fabric model');
  assert.ok(!fabricHtml.includes('<span class="eyebrow">Designs</span>'),'the fabric listing never claims to be designs');
  const fabricCard=/href="\/product\/(\d+)"/.exec(fabricHtml);
  assert.ok(fabricCard,'the fabric listing offers products to open');
  run(`location.hash='#product/${fabricCard[1]}';render(false)`);
  assert.ok(elFor('#main').innerHTML.includes('product-page'),'a product opens from the fabric listing');
  // Design listing: Women, Suits, the destination the audit found reading
  // as a fabric collection while listing designs.
  const womenSuits=menuAnchors('Women').find(a=>a.href==='/collections/women/suits');
  assert.ok(womenSuits,'the Women menu links to Women Suits at its real URL');
  const designHtml=run(`categoryCollection('${routeMap.paths[womenSuits.href]}')`);
  assert.ok(designHtml.includes('<span class="eyebrow">Designs</span>'),'the design listing is eyebrowed Designs');
  assert.ok(designHtml.includes('<p>Finished designs, ready to customize.</p>'),'the design listing explains the design model');
  assert.ok(!designHtml.includes('<span class="eyebrow">Fabrics</span>'),'the design listing never claims to be fabrics');
  const designCard=/href="\/product\/(\d+)"/.exec(designHtml);
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
  assert.ok(personalize.includes(`class="choice active" aria-pressed="true" onclick="setOption('lining','Default')"`),'the second product shows the Default lining choice as active (its stored Tonal default, since package 3.3)');
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


// ---------------------------------------------------------------- J13
// Women suit trouser front journey (CUS-06): a Women suit includes
// trousers, so its Personalize step offers trouser personalization; the
// choice is stored on the bagged item and shows on the bag line and at
// checkout, next to the jacket choices. Since package 3.2 the choice is
// the Pleats group of the trousers section, which contains the CUS-06
// Trouser front choices, and it stores in the pleats slot; the
// trouserFront preselect remains as the legacy fallback.
{
  const womenBody={id:'p-women-body',name:'Women body',method:'body',wearer:'Women',unit:'in',fit:'Tailored',values:{chest:36,waist:29,shoulder:15,sleeve:24,jacket:28,seat:38,trouserWaist:29,thigh:22,inseam:31,outseam:41},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[womenBody]});
  const idx=w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx>=0,'the catalog holds a Women suit for the journey');
  w.run(`chooseProduct(${idx})`);
  assert.equal(w.run('location.hash'),'#product/'+idx,'the journey lands on the Women suit product page');
  w.run(`beginDesign(${idx})`);
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  assert.equal(w.run('config.trouserFront'),'Flat front','the trouser front starts at Flat front, as standalone trousers do');
  const personalize=w.run('customize()');
  assert.ok(personalize.includes('<div class="option-title">Pleats</div>'),'the Personalize step offers a Pleats group for the Women suit');
  assert.ok(personalize.includes("setOption('pleats','Single pleat')"),'the Single pleat choice is offered');
  assert.ok(personalize.includes('<div class="option-title">Jacket closure</div>'),'the jacket closure group is still offered');
  w.run("setOption('pleats','Single pleat')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-women-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the Women suit is bagged');
  assert.equal(w.bag()[0].pleats,'Single pleat','the bagged item stores the chosen trouser front in the pleats slot');
  assert.equal(w.bag()[0].closure,'Two button','the bagged item keeps the jacket closure in its own slot');
  assert.ok(w.run('lineHtml(bag[0])').includes('Single pleat'),'the bag line shows the trouser front');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('Single pleat'),'the checkout selection shows the trouser front');
  console.log('E2E journey J13 passed: the Women suit Personalize step offers trouser personalization through the Pleats group, and the choice reaches the bag line and checkout.');
}

// ---------------------------------------------------------------- J14
// Jacket core options journey (CUS-01): from a suit product page, the
// Personalize step offers the extended closure and the new Vents, Jacket
// cuff buttons and Pocket accent groups with their defaults selected;
// choosing a priced pocket accent raises the price on the customizer,
// the bag line and the checkout total by exactly its modifier.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  const personalize=w.run('customize()');
  for(const title of ['Vents','Jacket cuff buttons','Pocket accent'])assert.ok(personalize.includes(`<div class="option-title">${title}</div>`),`the Personalize step offers the ${title} group`);
  assert.ok(personalize.includes("setOption('closure','Three button')")&&personalize.includes("setOption('closure','Four button')"),'the closure group offers the extended styles');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('vents','Single vent')"`),'Single vent starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('cuffButtons','Three')"`),'Three cuff buttons starts selected');
  assert.ok(personalize.includes('Patch pocket · +$15'),'the Patch pocket choice shows its modifier');
  w.run("setOption('vents','Double vent');setOption('pocketAccent','Patch pocket')");
  assert.ok(w.run('customize()').includes('$'+(base+15)),'the customizer price rises by the modifier');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].pocketAccent,'Patch pocket','the bagged item stores the pocket accent');
  assert.equal(w.bag()[0].vents,'Double vent','the bagged item stores the vents');
  assert.ok(w.run('lineHtml(bag[0])').includes('$'+(base+15)),'the bag line price includes the modifier');
  assert.ok(w.run('lineDescription(bag[0])').includes('Patch pocket'),'the bag line shows the pocket accent');
  assert.equal(w.run('subtotal()'),base+15,'the subtotal includes the modifier');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Patch pocket'),'the checkout selection shows the pocket accent');
  assert.ok(checkout.includes('$'+(base+15)),'the checkout total includes the modifier');
  console.log('E2E journey J14 passed: the suit Personalize step offers the jacket core groups with defaults selected, and a priced pocket accent raises the customizer, bag and checkout prices by exactly its modifier.');
}

// ---------------------------------------------------------------- J15
// Trousers options journey (CUS-01, package 3.2): from a suit product
// page, the Personalize step offers a Trousers section with five groups
// and their defaults selected; choosing a priced lining and a forward
// pleat raises the customizer, bag and checkout prices by exactly their
// modifiers. A Boys suit offers the same section, and standalone
// trousers keep their Trouser front group, gain the other four groups,
// and price a front lining the same way.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  const personalize=w.run('customize()');
  for(const title of ['Pants lining','Pocket style','Pleats','Back pockets','Belt loops'])assert.ok(personalize.includes(`<div class="option-title">${title}</div>`),`the Personalize step offers the ${title} group`);
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('pantsLining','No lining')"`),'No lining starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('pleats','Flat front')"`),'Flat front starts selected');
  assert.ok(personalize.includes('Front and back lining · +$10'),'the Front and back lining choice shows its modifier');
  w.run("setOption('pantsLining','Front and back lining');setOption('pleats','Forward single pleat')");
  assert.ok(w.run('customize()').includes('$'+(base+15)),'the customizer price rises by the two modifiers');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].pantsLining,'Front and back lining','the bagged item stores the pants lining');
  assert.equal(w.bag()[0].pleats,'Forward single pleat','the bagged item stores the pleats');
  assert.ok(w.run('lineDescription(bag[0])').includes('Front and back lining'),'the bag line shows the pants lining');
  assert.ok(w.run('lineDescription(bag[0])').includes('Forward single pleat'),'the bag line shows the pleats');
  assert.equal(w.run('subtotal()'),base+15,'the subtotal includes both modifiers');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Front and back lining')&&checkout.includes('Forward single pleat'),'the checkout selection shows the trousers choices');
  assert.ok(checkout.includes('$'+(base+15)),'the checkout total includes both modifiers');
  // A Boys suit offers the same Trousers section.
  const boysIdx=w.run("products.findIndex(p=>p.kind==='suit'&&p.silhouette==='Boys two-piece')");
  assert.ok(boysIdx>=0,'the catalog holds a Boys suit for the journey');
  w.run(`beginDesign(${boysIdx})`);
  w.run('nextConfig()');
  const boysPersonalize=w.run('customize()');
  for(const title of ['Pants lining','Pleats','Belt loops'])assert.ok(boysPersonalize.includes(`<div class="option-title">${title}</div>`),`the Boys suit Personalize step offers the ${title} group`);
  // Standalone trousers: Trouser front stays, four groups join it, and a
  // priced front lining flows to the bag total.
  const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");
  assert.ok(pantsIdx>=0,'the catalog holds standalone trousers for the journey');
  const pantsBase=w.run(`products[${pantsIdx}].price`);
  w.run(`beginDesign(${pantsIdx})`);
  w.run('nextConfig()');
  const pantsPersonalize=w.run('customize()');
  assert.ok(pantsPersonalize.includes('<div class="option-title">Trouser front</div>'),'standalone trousers keep the Trouser front group');
  for(const title of ['Pants lining','Pocket style','Back pockets','Belt loops'])assert.ok(pantsPersonalize.includes(`<div class="option-title">${title}</div>`),`standalone trousers offer the ${title} group`);
  assert.ok(!pantsPersonalize.includes('<div class="option-title">Pleats</div>'),'standalone trousers have no Pleats group');
  w.run("setOption('pantsLining','Front lining')");
  w.run('nextConfig()');
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  const pantsLine=w.bag().find(x=>x.product===pantsIdx);
  assert.ok(pantsLine,'the configured trousers are bagged');
  assert.equal(pantsLine.pantsLining,'Front lining','the trousers line stores the pants lining');
  assert.ok(w.run(`lineHtml(bag.find(x=>x.product===${pantsIdx}))`).includes('$'+(pantsBase+5)),'the trousers bag line price includes the $5 front lining');
  console.log('E2E journey J15 passed: the suit Personalize step offers the five trousers groups with defaults selected, priced lining and pleats choices raise the customizer, bag and checkout prices by exactly their modifiers, a Boys suit offers the same section, and standalone trousers gain four groups with the same lining pricing.');
}

// ---------------------------------------------------------------- J16
// Jacket finishes journey (CUS-01, package 3.3): from a suit product
// page, the Personalize step offers the expanded Lapel and Lining groups
// and the new Lining type, Buttons and Elbow patches groups with their
// defaults selected; one priced choice from each finish area raises the
// customizer, bag and checkout prices by exactly the combined modifier,
// and a standalone jacket renders the same finish areas.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  const personalize=w.run('customize()');
  for(const title of ['Lapel','Buttons','Lining','Lining type','Elbow patches'])assert.ok(personalize.includes(`<div class="option-title">${title}</div>`),`the Personalize step offers the ${title} group`);
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('lapel','Notch')">Notch 3-3.2in`),'the Notch lapel starts selected with its width');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('lining','Default')"`),'the Default lining starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('liningType','Full lining')"`),'Full lining starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('buttons','Horn brown')"`),'Horn brown buttons start selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('elbowPatches','None')"`),'no elbow patch starts selected');
  assert.ok(personalize.includes('Paisley red · +$20'),'the Paisley lining shows its modifier');
  assert.ok(personalize.includes('Black tiger · +$75'),'the brass button shows its modifier');
  w.run("setOption('lapel','Wide peak');setOption('lining','Paisley red');setOption('liningType','Half lining');setOption('buttons','Black tiger');setOption('elbowPatches','Black leather')");
  assert.ok(w.run('customize()').includes('$'+(base+140)),'the customizer price rises by the combined modifiers (10+20+20+75+15)');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].lapel,'Wide peak','the bagged item stores the lapel');
  assert.equal(w.bag()[0].lining,'Paisley red','the bagged item stores the lining');
  assert.equal(w.bag()[0].liningType,'Half lining','the bagged item stores the lining type');
  assert.equal(w.bag()[0].buttons,'Black tiger','the bagged item stores the buttons');
  assert.equal(w.bag()[0].elbowPatches,'Black leather','the bagged item stores the elbow patches');
  assert.ok(w.run('lineDescription(bag[0])').includes('Wide peak lapel'),'the bag line shows the lapel');
  assert.ok(w.run('lineDescription(bag[0])').includes('Paisley red lining'),'the bag line shows the lining');
  assert.ok(w.run('lineDescription(bag[0])').includes('Black leather elbow patches'),'the bag line shows the elbow patches');
  assert.equal(w.run('subtotal()'),base+140,'the subtotal includes the combined modifiers');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Paisley red lining'),'the checkout selection shows the finishes');
  assert.ok(checkout.includes('$'+(base+140)),'the checkout total includes the combined modifiers');
  // A standalone jacket renders the same finish areas.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  for(const title of ['Lapel','Buttons','Lining','Lining type','Elbow patches'])assert.ok(jacketPersonalize.includes(`<div class="option-title">${title}</div>`),`the jacket Personalize step offers the ${title} group`);
  console.log('E2E journey J16 passed: the suit Personalize step offers the expanded lapel and lining groups plus lining type, buttons and elbow patches with defaults selected, one priced choice from each area raises the customizer, bag and checkout prices by exactly the combined modifier, and a standalone jacket offers the same finish areas.');
}

// ---------------------------------------------------------------- J17
// Priced extras journey (CUS-02, package 3.4): from a suit product page,
// the Personalize step opens with the Tier group, the Extras section
// offers the vest, additional pants and square and tie set with prices
// showing and nothing preselected on, and the three monogram fields sit
// below; choosing everything raises the customizer, bag and checkout
// prices by exactly the combined extras total, and a standalone jacket
// offers the tier and the set but no vest.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  const personalize=w.run('customize()');
  assert.ok(personalize.indexOf('<div class="option-title">Tier</div>')<personalize.indexOf('<div class="option-title">Lapel</div>'),'the Tier group opens the Personalize step');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('tier','Regular')"`),'the Regular tier starts selected');
  assert.ok(personalize.includes('Make it a tuxedo · +$50'),'the tuxedo tier shows its price');
  assert.ok(personalize.includes('<h3>Extras</h3>'),'the Extras section is offered');
  assert.ok(personalize.includes('Classic vest · +$99'),'the vest styles show their price');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('vest','No vest')"`),'no vest starts selected: nothing is preselected on');
  assert.ok(personalize.includes('Yes · +$140'),'additional pants show their price');
  assert.ok(personalize.includes('Yes · +$39'),'the square and tie set shows its price');
  assert.ok(personalize.includes('placeholder="Line 2"'),'the second monogram line is offered');
  assert.ok(personalize.includes('Collar monogram'),'the collar monogram is offered');
  w.run("setOption('tier','Make it a tuxedo');setOption('vest','Classic vest')");
  assert.ok(w.run('customize()').includes('<div class="option-title">Waistcoat back</div>'),'choosing a vest reveals the waistcoat back group');
  w.run("setOption('vestFabricBack','Fabric back');setOption('additionalPants','Yes');setOption('squareAndTie','Yes');config.monogram='AB';config.monogram2='CD';config.collarMonogram='EF';saveConfig()");
  assert.ok(w.run('customize()').includes('$'+(base+368)),'the customizer price rises by every extra (50+99+20+140+39+10+10)');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.tier,'Make it a tuxedo','the bagged item stores the tier');
  assert.equal(item.vest,'Classic vest','the bagged item stores the vest');
  assert.equal(item.vestFabricBack,'Fabric back','the bagged item stores the fabric back');
  assert.equal(item.additionalPants,'Yes','the bagged item stores additional pants');
  assert.equal(item.squareAndTie,'Yes','the bagged item stores the square and tie set');
  assert.equal(item.monogram2,'CD','the bagged item stores the second monogram line');
  assert.equal(item.collarMonogram,'EF','the bagged item stores the collar monogram');
  const line=w.run('lineDescription(bag[0])');
  for(const part of ['Make it a tuxedo','Classic vest','Fabric back','Additional pants','Square and tie','Monogram AB / CD','Collar monogram EF'])assert.ok(line.includes(part),`the bag line names ${part}`);
  assert.equal(w.run('subtotal()'),base+368,'the subtotal includes every extra');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Classic vest'),'the checkout selection shows the vest');
  assert.ok(checkout.includes('$'+(base+368)),'the checkout total includes every extra');
  // A standalone jacket offers the tier and the set, but no vest.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  const jacketBase=w.run(`products[${jacketIdx}].price`);
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  assert.ok(jacketPersonalize.includes('<div class="option-title">Tier</div>'),'the jacket Personalize step offers the Tier group');
  assert.ok(jacketPersonalize.includes('<div class="option-title">Square and tie</div>'),'the jacket offers the square and tie set');
  assert.ok(!jacketPersonalize.includes('<div class="option-title">Add a vest</div>'),'the jacket offers no vest');
  w.run("setOption('squareAndTie','Yes')");
  assert.equal(w.run('itemPrice(config)'),jacketBase+39,'the jacket prices the square and tie set');
  console.log('E2E journey J17 passed: the suit Personalize step opens with the Tier group, offers the vest, additional pants and square and tie extras with prices showing and nothing preselected on, and the three monogram fields, the combined extras raise the customizer, bag and checkout prices by exactly their total, and a standalone jacket offers the tier and the set but no vest.');
}

// ---------------------------------------------------------------- J18
// Detail add ons journey (CUS-02, package 3.5): from a suit product
// page, the Personalize step offers the Jacket details toggles, the
// Trouser details toggles and the Side tabs group, the tailor changes
// consent and the comments field; choosing details from both sections
// raises the customizer, bag and checkout prices by exactly their
// combined modifier, the consent and comments reach the bag and
// checkout, and a standalone jacket offers the jacket details but no
// trouser details or consent.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const w=makeWorld({profiles:[ready]});
  w.run('chooseProduct(0)');
  assert.equal(w.run('location.hash'),'#product/0','the journey lands on the product page');
  const base=w.run('products[0].price');
  w.run('beginDesign(0)');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.equal(w.run('stage'),1,'the journey reaches the Personalize step');
  const personalize=w.run('customize()');
  assert.ok(personalize.includes('<h3>Jacket details</h3>'),'the Personalize step offers the Jacket details section');
  assert.ok(personalize.includes('<div class="option-title">Handmade Milanese lapel buttonhole</div>'),'the Personalize step offers the Milanese buttonhole detail');
  assert.ok(personalize.includes(`onclick="setOption('milaneseButtonhole','Yes')">Yes · +$75`),'the priciest jacket detail shows its price');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('workingCuffButtons','No')"`),'the jacket detail toggles start off');
  assert.ok(personalize.includes('<h3>Trouser details</h3>'),'the Personalize step offers the Trouser details section');
  assert.ok(personalize.includes('Venice side tabs · +$20'),'the top side tab tier shows its price');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('tailorChanges','Yes, change if required')"`),'the tailor changes default starts selected');
  assert.ok(personalize.includes('<textarea maxlength="200"'),'the comments field is offered');
  w.run("setOption('workingCuffButtons','Yes');setOption('boatPocket','Yes');setOption('suspenderButtons','Yes');setOption('sideTabs','Milan side tabs');setOption('tailorChanges','No, contact me');config.comments='Please rush for a wedding.';saveConfig()");
  assert.ok(w.run('customize()').includes('$'+(base+52)),'the customizer price rises by the combined detail modifiers (5+25+2+20)');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.workingCuffButtons,'Yes','the bagged item stores the working cuff buttons toggle');
  assert.equal(item.boatPocket,'Yes','the bagged item stores the boat pocket toggle');
  assert.equal(item.suspenderButtons,'Yes','the bagged item stores the suspender buttons toggle');
  assert.equal(item.sideTabs,'Milan side tabs','the bagged item stores the side tabs');
  assert.equal(item.tailorChanges,'No, contact me','the bagged item stores the tailor changes consent');
  assert.equal(item.comments,'Please rush for a wedding.','the bagged item stores the comments');
  const line=w.run('lineDescription(bag[0])');
  for(const part of ['Working cuff buttons','Italian boat pocket','Suspender buttons','Milan side tabs','Tailor changes: No, contact me'])assert.ok(line.includes(part),`the bag line names ${part}`);
  assert.ok(w.run('lineHtml(bag[0])').includes('Comments: Please rush for a wedding.'),'the bag line markup shows the comments');
  assert.equal(w.run('subtotal()'),base+52,'the subtotal includes the detail modifiers');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Comments: Please rush for a wedding.'),'the checkout shows the comments');
  assert.ok(checkout.includes('$'+(base+52)),'the checkout total includes the detail modifiers');
  // A standalone jacket offers the jacket details, but no trouser
  // details and no tailor changes consent.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  const jacketBase=w.run(`products[${jacketIdx}].price`);
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  assert.ok(jacketPersonalize.includes('<h3>Jacket details</h3>'),'the jacket Personalize step offers the Jacket details section');
  assert.ok(!jacketPersonalize.includes('<h3>Trouser details</h3>'),'the jacket offers no Trouser details section');
  assert.ok(!jacketPersonalize.includes('<div class="option-title">Tailor changes</div>'),'the jacket offers no tailor changes consent');
  w.run("setOption('pickStitch','Yes')");
  assert.equal(w.run('itemPrice(config)'),jacketBase+10,'the jacket prices its pick stitch detail');
  console.log('E2E journey J18 passed: the suit Personalize step offers the Jacket details and Trouser details toggles, the Side tabs group, the tailor changes consent and the comments field, the chosen details raise the customizer, bag and checkout prices by exactly their combined modifier, the consent and comments reach the bag and checkout, and a standalone jacket offers the jacket details only.');
}

// ---------------------------------------------------------------- J19
// Real URL entry journey (NAV-01, Wave 4 stage 2): the shopper lands
// on a collection through its real URL instead of a hash link, and
// the whole purchase path works from that entry: the boot script
// translates the path into the collection's hash route, a product
// opens, the customizer personalizes it, a saved profile measures
// it, and the configured garment reaches the bag and checkout with
// its selections intact. The world loads the full script composition
// the live page loads, boot data first, in document order.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  localStorage.setItem('suits-profiles',JSON.stringify([ready]));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class J19FormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/collections/suits/wool-suits'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:J19FormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');

  assert.equal(location.hash,'#collection/Suits/Wool%20Suits','entering at the real URL boots into the Wool Suits hash route');
  const listing=elFor('#main').innerHTML;
  assert.ok(listing.includes('<h1>Wool Suits.</h1>'),'the real URL entry renders the Wool Suits collection');
  assert.ok(listing.includes('10 results'),'the listing shows the ten Wool Suits designs');
  const firstId=run("merchantSuitCollections['Wool Suits'].ids[0]");
  run(`chooseProduct(${firstId})`);
  assert.equal(run('location.hash'),'#product/'+firstId,'opening a product from the real URL entry navigates');
  const productName=run(`products[${firstId}].name`);
  assert.ok(run(`productPage(${firstId})`).includes(productName),'the product page renders for '+productName);
  run(`beginDesign(${firstId})`);
  assert.equal(run('location.hash'),'#customize','designing from the product page lands on the customize route');
  assert.equal(run('config.product'),firstId,'the customizer opens on the chosen product');
  run('nextConfig()'); // stage 0 to 1, Personalize
  assert.ok(run('customize()').includes(`onclick="setOption('lining','Wine')">Wine · +$15`),'the Personalize step offers the Wine lining at its tier price');
  run("setOption('lining','Wine')");
  run('nextConfig()'); // stage 1 to 2, Measurements
  elFor('#profileSelect').value='p-ready';
  run('nextConfig()'); // Add to Bag
  assert.equal(bag().length,1,'Add to Bag creates exactly one bag line');
  const line=run('lineHtml(bag[0])');
  assert.ok(line.includes(productName),'the bag line names the product chosen from the real URL entry');
  assert.ok(line.includes('Wine lining'),'the bag line shows the lining chosen at the Personalize step');
  assert.ok(line.includes('Standard sizes'),'the bag line shows the saved profile summary');
  run("location.hash='#checkout'");
  const checkout=run('checkoutPage()');
  assert.ok(checkout.includes(productName),'the checkout shows the product from the real URL entry');
  assert.ok(checkout.includes('Wine lining'),'the checkout shows the chosen lining');
  console.log('E2E journey J19 passed: entering at the real Wool Suits URL boots into its collection, a product opens, the customizer personalizes it, a saved profile measures it, and the configured garment reaches the bag and checkout intact.');
}

// ---------------------------------------------------------------- J20
// Real product URL entry journey (NAV-01, Wave 4 stage 3a): the
// shopper lands directly on a product through its real URL, the form
// the migrated internal links now take, and the whole purchase path
// works from that entry: the boot script translates the path into the
// product's hash route, the product page renders with real URL links,
// the customizer personalizes it, a saved profile measures it, and
// the configured garment reaches the bag and checkout with its
// selections intact.
{
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  localStorage.setItem('suits-profiles',JSON.stringify([ready]));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class J20FormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'',pathname:'/product/1964'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:J20FormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  const catalog=require('../data/catalog.json');
  const productName=catalog[1964].name;

  assert.equal(location.hash,'#product/1964','entering at the real product URL boots into the product hash route');
  const page=elFor('#main').innerHTML;
  assert.ok(page.includes('product-page'),'the real product URL entry renders the product page');
  assert.ok(page.includes(productName),'the product page names the product the URL identifies');
  assert.ok(page.includes('href="/collections/suits"'),'the product page breadcrumb links to the real collection URL');
  assert.ok(page.includes('href="/measure"'),'the product page links to the measurement studio at its real URL');
  assert.ok(page.includes('href="/product/'),'the product page offers related products at real URLs');
  assert.ok(!page.includes('href="#'),'the rendered product page carries no hash hrefs');
  run('beginDesign(1964)');
  assert.equal(run('location.hash'),'#customize','designing from the real URL entry lands on the customize route');
  assert.equal(run('config.product'),1964,'the customizer opens on the product from the URL');
  run('nextConfig()'); // stage 0 to 1, Personalize
  run("setOption('lining','Wine')");
  run('nextConfig()'); // stage 1 to 2, Measurements
  elFor('#profileSelect').value='p-ready';
  run('nextConfig()'); // Add to Bag
  assert.equal(bag().length,1,'Add to Bag creates exactly one bag line');
  const line=run('lineHtml(bag[0])');
  assert.ok(line.includes(productName),'the bag line names the product chosen from the real product URL entry');
  assert.ok(line.includes('Wine lining'),'the bag line shows the lining chosen at the Personalize step');
  run("location.hash='#checkout'");
  const checkout=run('checkoutPage()');
  assert.ok(checkout.includes(productName),'the checkout shows the product from the real product URL entry');
  assert.ok(checkout.includes('Wine lining'),'the checkout shows the chosen lining');
  console.log('E2E journey J20 passed: entering at a real product URL boots into its product page with real URL links throughout, the customizer personalizes it, a saved profile measures it, and the configured garment reaches the bag and checkout intact.');
}

// ---------------------------------------------------------------- J21
// Category spot entries (NAV-01, Wave 4 stage 4): the stage 2 and 3a
// suites proved the Suits entries in depth; this journey proves the
// same entry shape for three more categories (Women, Trousers and
// Weddings). Each category is entered at its real collection URL,
// taken from the generated route map rather than written out here,
// and the first product the collection data names is opened and
// carried into the customizer with that product loaded.
{
  const routeMap=require('../data/real-routes.json');
  const collections=require('../data/collections.json');
  const catalog=require('../data/catalog.json');
  for(const cat of ['Women','Trousers','Weddings']){
    const hash='#collection/'+cat;
    const path=routeMap.reverse[hash];
    assert.ok(path,'the generated map gives '+cat+' a real collection URL');
    assert.equal(routeMap.paths[path],hash,'the map resolves '+path+' back to '+hash);
    const w=makeEntryWorld({pathname:path});
    assert.equal(w.location.hash,hash,'entering at '+path+' boots into '+hash);
    const firstId=collections[hash].ids[0];
    assert.equal(w.run(`resolveCollection('${hash}').ids[0]`),firstId,'the runtime collection resolver agrees with the catalog data for '+cat);
    const listing=w.elFor('#main').innerHTML;
    assert.ok(listing.includes(catalog[firstId].name),'the '+cat+' real URL entry renders its collection, first product '+catalog[firstId].name);
    w.run(`chooseProduct(${firstId})`);
    assert.equal(w.location.hash,'#product/'+firstId,'opening a product from the '+cat+' entry navigates');
    assert.ok(w.run(`productPage(${firstId})`).includes(catalog[firstId].name),'the product page renders for '+catalog[firstId].name);
    w.run(`beginDesign(${firstId})`);
    assert.equal(w.location.hash,'#customize','designing from the '+cat+' entry lands on the customize route');
    assert.equal(w.run('config.product'),firstId,'the customizer opens on the '+cat+' product from the URL entry');
    assert.ok(w.run('customize()').includes(catalog[firstId].name),'the customizer shows the '+cat+' product chosen from the entry');
  }
  console.log('E2E journey J21 passed: Women, Trousers and Weddings each enter at their real collection URL from the generated map, render the collection, open its first product, and reach the customizer with that product loaded.');
}

// ---------------------------------------------------------------- J22
// Real URL entry to a placed demo order (NAV-01, Wave 4 stage 4): J19
// stops at the checkout page; this journey completes the demo
// checkout from a real URL entry, with a priced option configured,
// and lands on the order page. It then boots the payment return path
// fresh, with no pending order on the browser, and proves the screen
// a returning shopper would meet in demo mode renders without error:
// the Wave 6 critical path the migration had to leave intact.
{
  const routeMap=require('../data/real-routes.json');
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const hash='#collection/Suits/Wool%20Suits';
  const path=routeMap.reverse[hash];
  assert.ok(path,'the generated map gives Wool Suits a real collection URL');
  const w=makeEntryWorld({pathname:path,profiles:[ready]});
  assert.equal(w.location.hash,hash,'entering at '+path+' boots into the Wool Suits hash route');
  const firstId=w.run("merchantSuitCollections['Wool Suits'].ids[0]");
  const productName=w.run(`products[${firstId}].name`);
  const basePrice=w.run(`products[${firstId}].price`);
  w.run(`chooseProduct(${firstId})`);
  w.run(`beginDesign(${firstId})`);
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  assert.ok(w.run('customize()').includes(`onclick="setOption('lining','Wine')">Wine · +$15`),'the Personalize step offers the Wine lining at its tier price');
  w.run("setOption('lining','Wine')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()'); // Add to Bag
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const expectedTotal=w.run('itemPrice(bag[0])');
  assert.equal(expectedTotal,basePrice+15,'the configured price carries the priced lining over the base price');
  w.run("location.hash='#checkout';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('checkoutForm'),'the checkout opens on the delivery form');
  w.run(`saveCheckoutForm({__data:{email:'e2e@example.com',firstName:'E2E',lastName:'Shopper',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'submitting the delivery form advances to review and payment');
  const review=w.elFor('#main').innerHTML;
  assert.ok(review.includes(productName),'the review shows the product from the real URL entry');
  assert.ok(review.includes('Wine lining'),'the review shows the priced lining chosen at the Personalize step');
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].demo,true,'the recorded order is a demo order');
  assert.equal(orders[0].total,expectedTotal,'the order total is the configured price, priced lining included');
  assert.equal(orders[0].items[0].lining,'Wine','the order item keeps the chosen lining');
  assert.equal(w.location.hash,'#order/'+orders[0].id,'placing the demo order lands on its order route');
  const landed=w.elFor('#main').innerHTML;
  assert.ok(landed.includes('DEMONSTRATION COMPLETE'),'the order page renders the demo completion screen');
  assert.ok(landed.includes(orders[0].id),'the order page shows the recorded order id');
  assert.ok(landed.includes(productName),'the order page shows the product from the real URL entry');
  assert.equal(w.bag().length,0,'the bag is empty after the demo order is placed');

  const back=makeEntryWorld({pathname:routeMap.reverse['#payment-return']});
  assert.equal(back.location.hash,'#payment-return','entering at /payment-return boots into the payment return route');
  const screen=back.elFor('#main').innerHTML;
  assert.ok(screen.includes('No pending payment was found on this browser.'),'the payment return path renders its no pending order screen in demo mode');
  assert.ok(screen.includes('href="/orders"'),'the payment return screen links onward to the orders page at its real URL');
  console.log('E2E journey J22 passed: a real URL entry configures a garment with a priced lining, completes the demo checkout onto the order page with the configured total intact, and a fresh /payment-return boot renders its demo mode screen without error.');
}

// ---------------------------------------------------------------- J23
// Hash entry parity (NAV-01, Wave 4 stage 4): the compatibility side
// of the migration. The same shopper arriving at / with the Wool
// Suits hash URL, the form every pre migration bookmark takes, must
// meet exactly what the real URL entry renders: the boot script
// leaves an existing hash untouched, the rendered collection is
// byte identical to the real URL entry's, and the first product is
// the same, after which the journey continues as J19's does.
{
  const routeMap=require('../data/real-routes.json');
  const hash='#collection/Suits/Wool%20Suits';
  const path=routeMap.reverse[hash];
  assert.ok(path,'the generated map gives Wool Suits a real collection URL');
  const real=makeEntryWorld({pathname:path});
  const viaHash=makeEntryWorld({pathname:'/',hash});
  assert.equal(real.location.hash,hash,'the real URL entry boots into the Wool Suits hash route');
  assert.equal(viaHash.location.hash,hash,'the boot script never overrides an existing hash');
  assert.equal(viaHash.elFor('#main').innerHTML,real.elFor('#main').innerHTML,'the hash entry at / renders a collection identical to the real URL entry');
  const firstId=real.run("merchantSuitCollections['Wool Suits'].ids[0]");
  assert.equal(viaHash.run("merchantSuitCollections['Wool Suits'].ids[0]"),firstId,'the hash entry names the same first product as the real URL entry');
  viaHash.run(`chooseProduct(${firstId})`);
  assert.equal(viaHash.location.hash,'#product/'+firstId,'opening the first product from the hash entry navigates');
  assert.ok(viaHash.run(`productPage(${firstId})`).includes(viaHash.run(`products[${firstId}].name`)),'the product page renders from the hash entry');
  viaHash.run(`beginDesign(${firstId})`);
  assert.equal(viaHash.location.hash,'#customize','designing from the hash entry lands on the customize route');
  assert.equal(viaHash.run('config.product'),firstId,'the customizer opens on the same product from the hash entry');
  console.log('E2E journey J23 passed: entering at / with the Wool Suits hash URL renders a collection byte identical to the real URL entry, names the same first product, and continues into the product and customizer unchanged.');
}

console.log('E2E journey checks passed: menu to product, standard size and body measurement journeys, method switching, quick add, bag edit with checkout rendering, the Women body-only rule, and the unified listing controls journey all hold end to end.');
console.log('J9 delivery estimate journey passed: the product page and the checkout order summary show the same estimate from the one config value.');
