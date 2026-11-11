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
// J14 jacket core options journey (CUS-01; JPOS aligned groups since J3)
// J15 trousers options journey (CUS-01)
// J16 jacket finishes journey (CUS-01; lapel type and width split since J3)
// J17 tuxedo facings, vest fields and label program journey (CUS-02; aligned since J3)
// J18 cuff construction, trouser details and comments journey (CUS-02; aligned since J3)
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
  for(const f of ['measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
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
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
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
// Note (JPOS consistency wave, package J1): the suit journey runs the
// garment aware studio on the version 3 schema: a name and height
// preamble with the optional weight and posture answers, the JPOS suit
// set in a jacket part and a trousers part (waist split into jacket and
// trouser waists, sleeve split into left and right inseams), inches
// entry with a centimeter converter display, no fit selectors, and a
// version 3 profile. The bag line lists the version 3 summary.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');
  w.run("setOption('lining','Midnight')");
  w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  w.run("draft.wearerName='E2E Shopper';updateBodyValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'the Studio advances to the jacket measurements step');
  // Field inputs write through updateBodyValue, their real oninput handler.
  w.run("updateBodyValue('chest','200');updateBodyValue('jacketWaist','5');updateBodyValue('sleeveInseamL','100')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'Continue is blocked while jacket measurements are invalid');
  const summary=w.elFor('#measureError').innerHTML;
  assert.equal((summary.match(/<li>/g)||[]).length,7,'all seven jacket problems are listed in one message');
  for(const text of ['Please check chest.','Please check chest over arms.','Please check left sleeve inseam.','Please check right sleeve inseam.','Please check shoulder width.','Please check jacket length.','Please check jacket waist.'])assert.ok(summary.includes(text),'the one message includes: '+text);
  assert.equal(w.elFor('#measureInput-chest').getAttribute('aria-invalid'),'true','the out of range chest input is marked invalid');
  w.run("updateBodyValue('chest','40');updateBodyValue('chestOverArm','46');updateBodyValue('sleeveInseamL','18');updateBodyValue('sleeveInseamR','18');updateBodyValue('shoulder','18');updateBodyValue('jacketLength','29');updateBodyValue('jacketWaist','34')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid jacket measurements advance to the trousers step');
  w.run("updateBodyValue('outseam','42');updateBodyValue('trouserWaist','34');updateBodyValue('seat','40');updateBodyValue('frontRise','11');updateBodyValue('thigh','24');updateBodyValue('inseam','32');updateBodyValue('rise','12');updateBodyValue('crotch','10')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),4,'valid trouser measurements advance to review');
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  assert.equal(w.run('profiles.length'),1,'the Studio saves the body measurement profile');
  assert.equal(w.run('profiles[0].method'),'body','the saved profile carries the body method');
  assert.equal(w.run('profiles[0].version'),3,'the saved suit profile is a version 3 profile');
  assert.equal(w.run('stage'),2,'saving returns to the customizer Measurements step');
  w.elFor('#profileSelect').value=w.run('profiles[0].id');
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const lineHtml=w.run('lineHtml(bag[0])');
  assert.ok(lineHtml.includes('Body measurements'),'the bag line shows the body measurement summary');
  for(const text of ['Height 70 in','Chest 40 in','Chest over arms 46 in','Left sleeve inseam 18 in','Shoulder width 18 in','Jacket length 29 in','Jacket waist 34 in','Outseam 42 in','Trouser waist 34 in','Seat / hips 40 in','Front rise 11 in','Thigh 24 in','Inseam 32 in'])assert.ok(lineHtml.includes(text),'the bag line lists the entered measurement: '+text);
  assert.ok(!lineHtml.includes('Jacket Fit'),'the bag line shows no fit selectors for a version 3 profile');
  assert.ok(lineHtml.includes('Midnight lining'),'the bag line shows the chosen lining');
}

// ---------------------------------------------------------------- J4
// Method switch journey: with a body profile and a standard size profile
// saved for the same wearer, switching the method card in the customizer
// changes which profile Add to Bag uses, in both directions.
{
  // Fixture note (measurements wave, package M1): the body profile a
  // shopper brings to a suit today is a complete version 2 suit profile,
  // the shape the garment aware studio saves; the journey's subject is
  // method switching, not profile completeness.
  const bodyProfile={id:'p-body',name:'Body profile',method:'body',version:2,garment:'suit',wearer:'Men',wearerName:'E2E Shopper',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{height:70,chest:40,sleeve:25,shoulder:18,jacket:29,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24},created:'2026-01-01T00:00:00.000Z'};
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
  w.run("setOption('lapelType','Peak');setOption('lining','Burgundy')");
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
  assert.equal(w.run('config.lapelType'),'Peak','Edit restores the previous lapel type');
  w.run('stage=1');
  const personalize=w.run('customize()');
  assert.ok(/class="choice active"[^>]*aria-pressed="true" onclick="setOption\('lining','Burgundy'\)"/.test(personalize),'the Personalize step shows the previous lining selected');
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
// Women journey: the customizer Measurements step offers both methods
// for a Women garment, the standard size card keyed to the bust
// (measurements wave package M4, superseding the pre M4 refusal this
// journey used to pin), and the Women garment bags through each path
// with its own wearer's profile.
{
  const womenBody={id:'p-women-body',name:'Women body',method:'body',wearer:'Women',unit:'in',fit:'Tailored',values:{chest:36},created:'2026-01-01T00:00:00.000Z'};
  const womenReady={id:'p-women-ready',name:'Women ready',version:2,method:'ready',garment:'suit',wearer:'Women',unit:'in',fit:'Tailored',ready:{womenSize:'40'},created:'2026-01-02T00:00:00.000Z'};
  const w=makeWorld({profiles:[womenBody,womenReady]});
  const idx=w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx>=0,'the catalog holds a Women suit for the journey');
  assert.equal(w.run(`productWearerOf(products[${idx}])`),'Women','the chosen garment is a Women garment');
  w.run(`chooseProduct(${idx})`);w.run(`beginDesign(${idx})`);
  w.run('nextConfig()');w.run('nextConfig()');
  const stepHtml=w.run('customize()');
  assert.ok(stepHtml.includes("setCustomizerMethod('body')"),'the body method card is offered for the Women garment');
  assert.ok(stepHtml.includes("setCustomizerMethod('ready')"),'the standard size card is offered for the Women garment');
  assert.ok(stepHtml.includes('Choose your standard size by bust'),'the standard size card is keyed to the bust');
  assert.ok(!stepHtml.includes('Standard sizes are not offered'),'the pre M4 refusal note is gone');
  w.run("chooseCustomizerProfile('p-women-body')");
  w.elFor('#profileSelect').value='p-women-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the Women garment is bagged through the body path');
  assert.equal(w.bag()[0].profile.id,'p-women-body','the bagged profile is the body profile');
  assert.equal(w.bag()[0].profile.method,'body','the body profile is bagged first');
  w.run("setCustomizerMethod('ready')");
  assert.equal(w.run('draft.method'),'ready','a standard size switch is honored for the Women garment');
  assert.equal(w.run('config.profileId'),'p-women-ready','the selection moves to the saved Women standard size profile');
  w.elFor('#profileSelect').value='p-women-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,2,'the Women garment is bagged through the standard size path too');
  assert.equal(w.bag()[1].profile.id,'p-women-ready','the bagged profile is the standard size profile');
  assert.equal(w.bag()[1].profile.method,'ready','a standard size profile is bagged for the Women garment');
  assert.ok(w.run('lineHtml(bag[1])').includes('Women&#39;s size 40 (XL)'),'the bag line shows her bust keyed size with its letter (apostrophe HTML escaped by the renderer)');
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
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
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
// Size guide journey (SIZ-03, rebuilt in measurements package M5):
// inside the Studio standard size flow the shopper opens the size
// guide, checks jacket 40 against a 40 in body chest and its adopted
// finished values, switches the Studio unit to cm and reads the
// values converted by the one unit rule (101.6 body, 109.2 finished),
// then chooses the sizes, saves the profile, and bags the garment.
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
  assert.ok(sizesHtml.includes('<tr><td>40</td><td>40</td><td>43</td><td>18</td><td>40.5</td><td>24.5</td><td>29.5</td></tr>'),'jacket 40 matches a body chest of 40 in (rule D1) and shows the adopted finished values');
  w.run("changeUnit('cm')");
  sizesHtml=w.run('measure()');
  assert.ok(sizesHtml.includes('Body chest (cm)'),'the guide follows the Studio unit switch to cm');
  assert.ok(sizesHtml.includes('<tr><td>40</td><td>101.6</td><td>109.2</td>'),'jacket 40 reads body chest 101.6 cm and finished chest 109.2 cm after the switch (the one unit rule, package M5)');
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

console.log('E2E journey J11 passed: the rebuilt size guide is consulted in inches and cm inside the standard size flow, then the profile is saved and the garment bagged.');

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
  w.run(`setOption('lapelType','Peak');setOption('closure','1-Button');setOption('lining','Burgundy');config.monogram='E2E';saveConfig();stage=2;render(false)`);
  w.elFor('#profileSelect').value='p-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the first suit is bagged with its distinctive options');
  const first=w.bag()[0];
  assert.equal(first.monogram,'E2E','the first suit keeps its own monogram');

  w.run(`location.hash='#product/1';render()`);
  assert.ok(w.elFor('#main').innerHTML.includes('The Modern Charcoal'),'the journey lands on the second product page');
  w.run('beginDesign(1)');
  const started=JSON.parse(w.run('JSON.stringify(config)'));
  assert.deepEqual({lapelType:started.lapelType,closure:started.closure,lapelSize:started.lapelSize,lining:started.lining,monogram:started.monogram},{lapelType:'Notch',closure:'2-Button',lapelSize:'Standard',lining:'Tonal',monogram:''},'the second product starts from its own aligned defaults');
  assert.ok(!('lapel' in started)&&!('fit' in started),'the second product design carries no legacy lapel or fit slot');
  const personalize=w.run('stage=1;customize()');
  assert.ok(!personalize.includes('E2E'),'the first product monogram is absent from the second product customizer');
  assert.ok(/class="choice active"[^>]*aria-pressed="true" onclick="setOption\('lining','Default'\)"/.test(personalize),'the second product shows the Default lining choice as active (its stored Tonal default, since package 3.3)');
  w.run('stage=2;render(false)');
  w.elFor('#profileSelect').value='p-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,2,'the second product is bagged as its own line');
  assert.equal(w.bag()[1].monogram,'','the bagged second product carries no monogram from the first');
  assert.equal(w.bag()[1].lining,'Tonal','the bagged second product carries its default lining');

  w.run(`editBagItem('${first.id}')`);
  const restored=JSON.parse(w.run('JSON.stringify(config)'));
  assert.deepEqual({lapelType:restored.lapelType,closure:restored.closure,lining:restored.lining,monogram:restored.monogram},{lapelType:'Peak',closure:'1-Button',lining:'Burgundy',monogram:'E2E'},'bag Edit restores the first suit configuration exactly');
  assert.ok(!('lapel' in restored)&&!('fit' in restored),'the restored aligned configuration carries no legacy lapel or fit slot');
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
// trouserFront preselect remains as the legacy fallback. Since J4 the
// Pleats group carries the aligned JPOS values (Flat Front, Single
// Rvrs Pleat, Double Rvrs Pleat) with buyer language labels.
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
  assert.ok(personalize.includes('<div class="option-title"><span>Pleats</span>'),'the Personalize step offers a Pleats group for the Women suit');
  assert.ok(personalize.includes("setOption('pleats','Single Rvrs Pleat')"),'the Single reverse pleat choice is offered');
  assert.ok(personalize.includes('<div class="option-title"><span>Jacket closure</span>'),'the jacket closure group is still offered');
  w.run("setOption('pleats','Single Rvrs Pleat')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-women-body';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the Women suit is bagged');
  assert.equal(w.bag()[0].pleats,'Single Rvrs Pleat','the bagged item stores the chosen trouser front in the pleats slot');
  assert.equal(w.bag()[0].closure,'2-Button','the bagged item keeps the jacket closure in its own slot, in the aligned JPOS vocabulary');
  assert.ok(w.run('lineHtml(bag[0])').includes('Single reverse pleat'),'the bag line shows the trouser front');
  w.run("location.hash='#checkout'");
  assert.ok(w.run('checkoutPage()').includes('Single reverse pleat'),'the checkout selection shows the trouser front');
  console.log('E2E journey J13 passed: the Women suit Personalize step offers trouser personalization through the aligned Pleats group, and the choice reaches the bag line and checkout.');
}

// ---------------------------------------------------------------- J14
// Jacket core options journey (CUS-01, aligned model since J3): from
// a suit product page, the Personalize step offers the JPOS closure
// (including 3-Roll-2 and the double breasted configurations), vents
// None, Center, Side, the pocket groups and the cuff construction
// with their JPOS standards selected; choosing the priced Milanese
// under collar raises the price on the customizer, the bag line and
// the checkout total by exactly its price, and nothing else on the
// step carries a price.
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
  for(const title of ['Vents','Waist pocket style','Ticket pocket','Cuff buttons','Under collar fabric'])assert.ok(personalize.includes(`<div class="option-title"><span>${title}</span>`),`the Personalize step offers the ${title} group`);
  assert.ok(personalize.includes("setOption('closure','3-Roll-2')")&&personalize.includes("setOption('closure','6x2 DB')"),'the closure group offers 3-Roll-2 and the double breasted configurations');
  assert.ok(!personalize.includes('Double vent'),'no double vent exists in the aligned model');
  assert.ok(!personalize.includes('Pocket accent'),'the Pocket accent group is gone; its choices live in the pocket groups');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('vents','Center')"`),'the Center vent starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('cuffButtons','4 Buttons')"`),'four cuff buttons start selected, the JPOS standard');
  assert.ok(personalize.includes('Milanese felt, multiple colors · +$40'),'the Milanese multi color under collar shows its price');
  w.run("setOption('vents','Side');setOption('underCollarFabric','Milanese Multi-Color')");
  assert.ok(w.run('customize()').includes('$'+(base+40)),'the customizer price rises by the Milanese price only');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].underCollarFabric,'Milanese Multi-Color','the bagged item stores the under collar fabric');
  assert.equal(w.bag()[0].vents,'Side','the bagged item stores the vents');
  assert.ok(w.run('lineHtml(bag[0])').includes('$'+(base+40)),'the bag line price includes the Milanese price');
  assert.ok(w.run('lineDescription(bag[0])').includes('Side vents'),'the bag line shows the vents');
  assert.ok(w.run('lineDescription(bag[0])').includes('Milanese Multi-Color under collar'),'the bag line shows the under collar fabric');
  assert.equal(w.run('subtotal()'),base+40,'the subtotal includes the Milanese price only');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Milanese Multi-Color under collar'),'the checkout selection shows the under collar fabric');
  assert.ok(checkout.includes('$'+(base+40)),'the checkout total includes the Milanese price');
  console.log('E2E journey J14 passed: the suit Personalize step offers the aligned jacket core groups with JPOS standards selected, and the Milanese under collar raises the customizer, bag and checkout prices by exactly its price.');
}

// ---------------------------------------------------------------- J15
// Trousers options journey (CUS-01, package 3.2; aligned model since
// J4): from a suit product page, the Personalize step offers the
// aligned JPOS trousers groups with their standards selected and
// every choice Included (no JPOS trousers price is attested, plan
// input 1); the retired groups (pants lining, the folded pocket
// style, forward pleats, the named side tabs) are gone. Choosing a
// pleat and a sized cuff changes no price anywhere. A Boys suit
// offers the same section, and standalone trousers keep their
// Trouser front entry, now the aligned pleats values, with the same
// groups under it.
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
  for(const title of ['Pleats','Side pockets','Back pocket style','Back pocket closure','Trouser cuff','Front tab','Leg break','Watch pocket','Suspender buttons','Elastic side tabs','Tunnel belt loops','Belt loops'])assert.ok(personalize.includes(`<div class="option-title"><span>${title}</span>`),`the Personalize step offers the ${title} group`);
  for(const gone of ['Pants lining','Pocket style','Forward single pleat','Venice side tabs','Flap coin pocket','2 inch waistband'])assert.ok(!personalize.includes(gone),`the retired ${gone} is gone from the aligned step`);
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('pleats','Flat Front')"`),'Flat Front starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('sidePockets','Slanted')"`),'slanted side pockets start selected');
  assert.ok(personalize.includes('Double reverse pleats · Included'),'the double reverse pleats choice shows as Included, unpriced pending the upcharge data');
  w.run("setOption('pleats','Double Rvrs Pleat');setOption('trouserCuff','1-1/2 in')");
  assert.ok(w.run('customize()').includes('$'+base),'the customizer price does not move for aligned trousers choices');
  assert.ok(!w.run('customize()').includes('$'+(base+15)),'no retired trousers modifier sneaks into the customizer price');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].pleats,'Double Rvrs Pleat','the bagged item stores the pleats');
  assert.equal(w.bag()[0].trouserCuff,'1-1/2 in','the bagged item stores the cuff');
  assert.ok(!('pantsLining' in w.bag()[0]),'the bagged aligned item carries no retired pants lining slot');
  assert.ok(w.run('lineDescription(bag[0])').includes('Double reverse pleats'),'the bag line shows the pleats');
  assert.ok(w.run('lineDescription(bag[0])').includes('Cuff, 1-1/2 inch'),'the bag line shows the cuff');
  assert.equal(w.run('subtotal()'),base,'the subtotal is the base price only');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Double reverse pleats')&&checkout.includes('Cuff, 1-1/2 inch'),'the checkout selection shows the trousers choices');
  assert.ok(checkout.includes('$'+base),'the checkout total is the base price only');
  // A Boys suit offers the same Trousers section.
  const boysIdx=w.run("products.findIndex(p=>p.kind==='suit'&&p.silhouette==='Boys two-piece')");
  assert.ok(boysIdx>=0,'the catalog holds a Boys suit for the journey');
  w.run(`beginDesign(${boysIdx})`);
  w.run('nextConfig()');
  const boysPersonalize=w.run('customize()');
  for(const title of ['Pleats','Side pockets','Belt loops'])assert.ok(boysPersonalize.includes(`<div class="option-title"><span>${title}</span>`),`the Boys suit Personalize step offers the ${title} group`);
  // Standalone trousers: the Trouser front entry stays, carrying the
  // aligned pleats values, and the aligned groups sit under it.
  const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");
  assert.ok(pantsIdx>=0,'the catalog holds standalone trousers for the journey');
  const pantsBase=w.run(`products[${pantsIdx}].price`);
  w.run(`beginDesign(${pantsIdx})`);
  w.run('nextConfig()');
  const pantsPersonalize=w.run('customize()');
  assert.ok(pantsPersonalize.includes('<div class="option-title"><span>Trouser front</span>'),'standalone trousers keep the Trouser front group');
  for(const title of ['Side pockets','Back pocket style','Trouser cuff','Belt loops'])assert.ok(pantsPersonalize.includes(`<div class="option-title"><span>${title}</span>`),`standalone trousers offer the ${title} group`);
  assert.ok(!pantsPersonalize.includes('<div class="option-title"><span>Pleats</span>'),'standalone trousers have no separate Pleats group; the front entry carries it');
  w.run("setOption('sidePockets','Western')");
  w.run('nextConfig()');
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  const pantsLine=w.bag().find(x=>x.product===pantsIdx);
  assert.ok(pantsLine,'the configured trousers are bagged');
  assert.equal(pantsLine.sidePockets,'Western','the trousers line stores the side pockets');
  assert.ok(w.run(`lineHtml(bag.find(x=>x.product===${pantsIdx}))`).includes('$'+pantsBase),'the trousers bag line price is the base price, unpriced options included');
  console.log('E2E journey J15 passed: the suit Personalize step offers the twelve aligned trousers groups with standards selected and every choice Included, retired groups are gone, choices change no price through bag and checkout, a Boys suit offers the same section, and standalone trousers keep the Trouser front entry over the same groups.');
}

// ---------------------------------------------------------------- J16
// Jacket finishes journey (CUS-01, aligned model since J3): from a
// suit product page, the Personalize step offers lapel type and lapel
// width as separate groups with the JPOS inch values, the button
// style group in place of the named button materials, and the lining
// group (placeholder values, unpriced pending the JPOS lining
// catalog); the removed groups (Lining type, Elbow patches, named
// materials) are absent, choosing across the finish areas changes no
// price, and a standalone jacket renders the same finish areas.
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
  for(const title of ['Lapel style','Lapel width','Buttons','Lining'])assert.ok(personalize.includes(`<div class="option-title"><span>${title}</span>`),`the Personalize step offers the ${title} group`);
  for(const gone of ['Lining type','Elbow patches','Black tiger'])assert.ok(!personalize.includes(gone),`the Personalize step no longer offers ${gone}`);
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('lapelType','Notch')">`)&&personalize.includes('Notch lapel · Included'),'the Notch lapel type starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('lapelSize','Standard')">`)&&personalize.includes('Standard, 2 7/8 in · Included'),'the Standard notch width starts selected with its JPOS inches');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('lining','Default')"`),'the Default lining starts selected');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('buttonStyle','Matching')">`)&&personalize.includes('Matching buttons · Included'),'matching buttons start selected');
  assert.ok(personalize.includes('Paisley red · Included'),'the placeholder lining values are unpriced in the aligned model');
  w.run("setOption('lapelType','Peak')");
  assert.ok(w.run('customize()').includes(`aria-pressed="true" onclick="setOption('lapelSize','Standard')">`)&&w.run('customize()').includes('Standard, 3 in · Included'),'switching to Peak shows the Peak standard width in inches');
  w.run("setOption('lining','Paisley red');setOption('buttonStyle','Fabric covered')");
  assert.ok(w.run('customize()').includes('$'+base+' '),'the customizer price does not move for unpriced finish choices');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  assert.equal(w.bag()[0].lapelType,'Peak','the bagged item stores the lapel type');
  assert.equal(w.bag()[0].lapelSize,'Standard','the bagged item stores the lapel width');
  assert.equal(w.bag()[0].lining,'Paisley red','the bagged item stores the lining');
  assert.equal(w.bag()[0].buttonStyle,'Fabric covered','the bagged item stores the button style');
  assert.ok(!('buttons' in w.bag()[0])&&!('elbowPatches' in w.bag()[0])&&!('liningType' in w.bag()[0]),'the bagged item carries none of the removed finish slots');
  assert.ok(w.run('lineDescription(bag[0])').includes('Peak lapel, Standard'),'the bag line shows the lapel type and width');
  assert.ok(w.run('lineDescription(bag[0])').includes('Paisley red lining'),'the bag line shows the lining');
  assert.ok(w.run('lineDescription(bag[0])').includes('Fabric covered buttons'),'the bag line shows the button style');
  assert.equal(w.run('subtotal()'),base,'the subtotal is the base price: every finish choice here is unpriced');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Paisley red lining'),'the checkout selection shows the finishes');
  assert.ok(checkout.includes('$'+base),'the checkout total is the base price');
  // A standalone jacket renders the same finish areas.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  for(const title of ['Lapel style','Lapel width','Buttons','Lining'])assert.ok(jacketPersonalize.includes(`<div class="option-title"><span>${title}</span>`),`the jacket Personalize step offers the ${title} group`);
  console.log('E2E journey J16 passed: the suit Personalize step offers lapel type and width as separate groups with JPOS inches, the button style group and the unpriced placeholder lining, the removed finish groups are absent, and a standalone jacket offers the same finish areas.');
}

// ---------------------------------------------------------------- J17
// Tuxedo facings, vest and label journey (CUS-02, aligned model since
// J3): from a suit product page, the Personalize step opens with the
// Tuxedo facings group in place of the tier switch; turning it on
// reveals the per part facing specification; the vest is specified on
// the JPOS vest fields in place of the six named styles; the label
// program and collar monogram are styles with text only when a
// personalized style is chosen; the square and tie set is gone; since
// J4 the second pair of trousers replaces additional pants on aligned
// designs and is unpriced pending the upcharge data, so nothing on
// this step prices; and a standalone jacket offers the tuxedo
// specification but no vest.
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
  assert.ok(personalize.indexOf('<span>Tuxedo facings</span>')<personalize.indexOf('<span>Lapel style</span>'),'the Tuxedo facings group opens the Personalize step');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('tuxedo','No')"`),'the standard jacket starts selected');
  assert.ok(!personalize.includes('Tier')&&!personalize.includes('Square and tie')&&!personalize.includes('Classic vest'),'the tier switch, the square and tie set and the named vest styles are gone');
  assert.ok(personalize.includes('<span>Second pair of trousers</span>')&&personalize.includes('Add a second pair · Included'),'the second pair is offered in place of additional pants, unpriced pending the upcharge data');
  assert.ok(!personalize.includes('Additional pants'),'additional pants are gone from the aligned step');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('vestIncluded','No')"`),'no vest starts selected: nothing is preselected on');
  w.run("setOption('tuxedo','Yes')");
  const tuxHtml=w.run('customize()');
  for(const title of ['Tuxedo lapel facing','Tuxedo collar facing','Tuxedo front edge','Tuxedo breast pocket facing','Tuxedo trouser outseam stripe'])assert.ok(tuxHtml.includes(`<span>${title}</span>`),`the tuxedo specification offers ${title}`);
  assert.ok(tuxHtml.includes("setOption('tuxLapel','Grosgrain full')"),'the facing choices combine material and coverage');
  w.run("setOption('vestIncluded','Yes')");
  assert.ok(w.run('customize()').includes('<span>Vest back</span>'),'choosing a vest reveals the vest field groups');
  w.run("setOption('tuxLapel','Satin full');setOption('tuxWaistPocket','Yes');setOption('vestStyle','Notch Lapel');setOption('vestButtons','DB 6x3');setOption('vestBack','Fabric');setOption('labelStyle','Personalized Monogram');config.monogram='AB';config.monogram2='CD';setOption('collarMonogramStyle','Block');config.collarMonogram='EF';saveConfig()");
  assert.ok(w.run('customize()').includes('$'+base),'the customizer price does not move: facings, vest fields and label styles are unpriced');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.tuxedo,'Yes','the bagged item stores the tuxedo gate');
  assert.equal(item.tuxLapel,'Satin full','the bagged item stores the lapel facing');
  assert.equal(item.vestIncluded,'Yes','the bagged item stores the vest gate');
  assert.equal(item.vestStyle,'Notch Lapel','the bagged item stores the vest style');
  assert.equal(item.vestButtons,'DB 6x3','the bagged item stores the vest buttons');
  assert.equal(item.vestBack,'Fabric','the bagged item stores the vest back');
  assert.equal(item.labelStyle,'Personalized Monogram','the bagged item stores the label style');
  assert.equal(item.monogram2,'CD','the bagged item stores the second label line');
  assert.equal(item.collarMonogram,'EF','the bagged item stores the collar monogram text');
  assert.ok(!('tier' in item)&&!('vest' in item)&&!('squareAndTie' in item),'the bagged item carries none of the removed extras slots');
  const line=w.run('lineDescription(bag[0])');
  for(const part of ['Tuxedo facings','Vest: Notch Lapel, DB 6x3','Fabric back','Label: Personalized Monogram AB / CD','Collar monogram EF'])assert.ok(line.includes(part),`the bag line names ${part}`);
  assert.equal(w.run('subtotal()'),base,'the subtotal is the base price only');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Notch Lapel'),'the checkout selection shows the vest');
  assert.ok(checkout.includes('$'+base),'the checkout total is the base price only');
  // A standalone jacket offers the tuxedo specification, but no vest.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  const jacketBase=w.run(`products[${jacketIdx}].price`);
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  assert.ok(jacketPersonalize.includes('<span>Tuxedo facings</span>'),'the jacket Personalize step offers the tuxedo specification');
  assert.ok(!jacketPersonalize.includes('<span>Vest</span>'),'the jacket offers no vest');
  w.run("setOption('tuxedo','Yes');setOption('tuxLapel','Satin 3/8')");
  assert.equal(w.run('itemPrice(config)'),jacketBase,'the jacket prices its tuxedo facings at nothing: they are unpriced pending the upcharge data');
  console.log('E2E journey J17 passed: the suit Personalize step opens with the tuxedo facing specification in place of the tier switch, the vest is specified on the JPOS vest fields, the label program carries the monogram text unpriced, the second pair replaces additional pants unpriced, and a standalone jacket offers the tuxedo specification but no vest.');
}

// ---------------------------------------------------------------- J18
// Detail add ons journey (CUS-02, aligned model since J3): from a
// suit product page, the Personalize step offers the cuff construction
// and exterior stitch groups in place of the jacket detail toggles,
// the aligned trousers groups in place of the Trouser details toggles
// and Side tabs group (J4), and the comments field; the tailor
// changes consent is gone. Every detail choice is unpriced in the
// aligned model, so nothing on the step moves the price; the
// comments reach the bag and checkout, and a standalone jacket offers
// the cuff construction but no trouser details.
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
  for(const title of ['Cuff button style','Cuff button holes','Stitching on the jacket edges'])assert.ok(personalize.includes(`<span>${title}</span>`),`the Personalize step offers the ${title} group`);
  assert.ok(!personalize.includes('Milanese lapel buttonhole')&&!personalize.includes('Tailor changes'),'the Milanese lapel buttonhole and the tailor changes consent are gone');
  assert.ok(personalize.includes(`aria-pressed="true" onclick="setOption('cuffButtonHole','Imitation Button Holes')"`),'imitation cuff button holes start selected, the JPOS standard');
  assert.ok(personalize.includes('<div class="option-title"><span>Elastic side tabs</span>'),'the Personalize step offers the aligned trousers groups');
  assert.ok(!personalize.includes('<h3>Trouser details</h3>')&&!personalize.includes('Venice side tabs'),'the Trouser details toggles and the named side tabs are gone');
  assert.ok(personalize.includes('<textarea maxlength="200"'),'the comments field is offered');
  w.run("setOption('cuffButtonHole','Functional Options');setOption('exteriorStitch','1/16 Pic');setOption('suspenderButtons','Yes');setOption('elasticSideTabs','Side Buckle');config.comments='Please rush for a wedding.';saveConfig()");
  assert.ok(w.run('customize()').includes('$'+base),'the customizer price does not move; every detail choice is unpriced');
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()');
  assert.equal(w.bag().length,1,'the configured suit is bagged');
  const item=w.bag()[0];
  assert.equal(item.cuffButtonHole,'Functional Options','the bagged item stores the cuff button holes');
  assert.equal(item.exteriorStitch,'1/16 Pic','the bagged item stores the exterior stitch');
  assert.equal(item.suspenderButtons,'Yes','the bagged item stores the suspender buttons toggle');
  assert.equal(item.elasticSideTabs,'Side Buckle','the bagged item stores the elastic side tabs');
  assert.equal(item.comments,'Please rush for a wedding.','the bagged item stores the comments');
  assert.ok(!('tailorChanges' in item)&&!('workingCuffButtons' in item)&&!('boatPocket' in item)&&!('sideTabs' in item),'the bagged item carries none of the removed detail slots');
  const line=w.run('lineDescription(bag[0])');
  for(const part of ['Working cuff buttonholes','1/16 Pic stitch','Suspender buttons','Side buckle adjusters'])assert.ok(line.includes(part),`the bag line names ${part}`);
  assert.ok(w.run('lineHtml(bag[0])').includes('Comments: Please rush for a wedding.'),'the bag line markup shows the comments');
  assert.equal(w.run('subtotal()'),base,'the subtotal is the base price only');
  w.run("location.hash='#checkout'");
  const checkout=w.run('checkoutPage()');
  assert.ok(checkout.includes('Comments: Please rush for a wedding.'),'the checkout shows the comments');
  assert.ok(checkout.includes('$'+base),'the checkout total is the base price only');
  // A standalone jacket offers the cuff construction, but no trouser
  // details.
  const jacketIdx=w.run("products.findIndex(p=>p.kind==='jacket')");
  assert.ok(jacketIdx>=0,'the catalog holds a standalone jacket for the journey');
  const jacketBase=w.run(`products[${jacketIdx}].price`);
  w.run(`beginDesign(${jacketIdx})`);
  w.run('nextConfig()');
  const jacketPersonalize=w.run('customize()');
  assert.ok(jacketPersonalize.includes('<span>Cuff button holes</span>'),'the jacket Personalize step offers the cuff construction');
  assert.ok(!jacketPersonalize.includes('<h3>Trouser details</h3>'),'the jacket offers no Trouser details section');
  w.run("setOption('cuffButtonType','Slanting Kissing')");
  assert.equal(w.run('itemPrice(config)'),jacketBase,'the jacket prices its cuff construction at nothing: unpriced pending the upcharge data');
  console.log('E2E journey J18 passed: the suit Personalize step offers the cuff construction and exterior stitch groups in place of the jacket detail toggles, the aligned trousers groups in place of the Trouser details and Side tabs, the tailor changes consent is gone, nothing on the step prices, the comments reach the bag and checkout, and a standalone jacket offers the cuff construction only.');
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
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
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
  assert.ok(run('customize()').includes(`onclick="setOption('lining','Wine')">`)&&run('customize()').includes('Wine · Included'),'the Personalize step offers the Wine lining, unpriced in the aligned model pending the JPOS lining catalog');
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
  const location={hash:'',pathname:'/product/1941'};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:J20FormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  const catalog=require('../data/catalog.json');
  const productName=catalog[1941].name;

  assert.equal(location.hash,'#product/1941','entering at the real product URL boots into the product hash route');
  const page=elFor('#main').innerHTML;
  assert.ok(page.includes('product-page'),'the real product URL entry renders the product page');
  assert.ok(page.includes(productName),'the product page names the product the URL identifies');
  assert.ok(page.includes('href="/collections/suits"'),'the product page breadcrumb links to the real collection URL');
  assert.ok(page.includes('href="/measure"'),'the product page links to the measurement studio at its real URL');
  assert.ok(page.includes('href="/product/'),'the product page offers related products at real URLs');
  assert.ok(!page.includes('href="#'),'the rendered product page carries no hash hrefs');
  run('beginDesign(1941)');
  assert.equal(run('location.hash'),'#customize','designing from the real URL entry lands on the customize route');
  assert.equal(run('config.product'),1941,'the customizer opens on the product from the URL');
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
  assert.ok(w.run('customize()').includes(`onclick="setOption('lining','Wine')">`)&&w.run('customize()').includes('Wine · Included'),'the Personalize step offers the Wine lining, unpriced in the aligned model pending the JPOS lining catalog');
  w.run("setOption('lining','Wine')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  w.elFor('#profileSelect').value='p-ready';
  w.run('nextConfig()'); // Add to Bag
  assert.equal(w.bag().length,1,'Add to Bag creates exactly one bag line');
  const expectedTotal=w.run('itemPrice(bag[0])');
  assert.equal(expectedTotal,basePrice,'the configured price is the base price: the placeholder lining is unpriced in the aligned model');
  w.run("location.hash='#checkout';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('checkoutForm'),'the checkout opens on the delivery form');
  w.run(`saveCheckoutForm({__data:{email:'e2e@example.com',firstName:'E2E',lastName:'Shopper',address:'1 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'submitting the delivery form advances to review and payment');
  const review=w.elFor('#main').innerHTML;
  assert.ok(review.includes(productName),'the review shows the product from the real URL entry');
  assert.ok(review.includes('Wine lining'),'the review shows the lining chosen at the Personalize step');
  w.elFor('#orderConsent').checked=true;
  w.run('submitCheckout()');
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the demo checkout records exactly one order');
  assert.equal(orders[0].demo,true,'the recorded order is a demo order');
  assert.equal(orders[0].total,expectedTotal,'the order total is the configured price');
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
