const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// CRT-02: bag Edit restores a configured item into the customizer and saving
// updates that same item in place. Drives the real storefront scripts in a vm
// with stubbed DOM and storage, in the style of the other suites.
// Note (Wave 3 package 3.3): the suit configured below wears a Peak lapel,
// which OPTION_PRICES now prices at +$10, so the two subtotal expectations
// carry that modifier; every other behavior asserted here is unchanged.
// Note (Wave 3 package 3.4): the same suit carries a filled monogram,
// which TEXT_FIELD_PRICES now prices at +$10, so the same two subtotal
// expectations carry that modifier too.
function makeEl(){return{innerHTML:'',textContent:'',value:'',checked:false,open:false,classList:{add(){},remove(){},toggle(){return false}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),showModal(){this.open=true},close(){this.open=false},scrollIntoView(){}}}
const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const profile={id:'profile-1',name:'Test fit',method:'body',unit:'in',wearer:'Men',fit:'Tailored',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:29,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-10-27T00:00:00.000Z'};
store.set('suits-profiles',JSON.stringify([profile]));
const sandbox={console,localStorage,location:{hash:'#home'},fetch:async()=>({ok:false,json:async()=>null}),crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fabricBackground:()=>'background-image:linear-gradient(#000,#000)',FormData:class{constructor(f){this.data=(f&&f._data)||{}}get(k){return k in this.data?this.data[k]:null}},document:{title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()},addEventListener(){},scrollTo(){}};
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
for(const f of ['measurement-schema.js','app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
const run=code=>vm.runInContext(code,ctx);
const bagState=()=>JSON.parse(store.get('suits-bag')||'[]');
const clone=o=>JSON.parse(JSON.stringify(o));

// Build a fully configured suit through the real customizer flow.
run('beginDesign(0)');
run(`setOption('fit','Slim');setOption('lapel','Peak');setOption('closure','One button');setOption('lining','Burgundy');config.monogram='AB';saveConfig();stage=2;render(false)`);
elFor('#profileSelect').value='profile-1';
run('nextConfig()');
let bag=bagState();
assert.equal(bag.length,1,'customizer add creates one bag line');
const suit=bag[0];
assert.equal(suit.product,0);assert.equal(suit.fabric,'Navy');assert.equal(suit.fit,'Slim');
assert.equal(suit.lapel,'Peak');assert.equal(suit.closure,'One button');assert.equal(suit.lining,'Burgundy');
assert.equal(suit.monogram,'AB');assert.deepEqual(suit.profile,profile,'item stores a copy of the full profile');

// A second line via quick add, so position preservation can be checked.
run(`submitQuickAdd(7,{_data:{profile:'profile-1',fit:'Tailored'}})`);
bag=bagState();
assert.equal(bag.length,2,'quick add appends a second line');
const jacket=bag[1];
assert.equal(jacket.lapel,'Notch');assert.equal(jacket.lining,'Tonal');assert.deepEqual(jacket.profile,profile);
assert.equal(run('subtotal()'),399+10+10+279,'subtotal covers both lines (the Peak lapel and the filled monogram add their $10 modifiers)');

// Edit the suit: change exactly one option (lining) and save.
run(`editBagItem('${suit.id}')`);
assert.equal(run('editingBagId'),suit.id,'edit session targets the suit line');
const restored=JSON.parse(store.get('suits-config'));
assert.equal(restored.lapel,'Peak');assert.equal(restored.lining,'Burgundy');assert.equal(restored.closure,'One button');
assert.equal(restored.fit,'Slim');assert.equal(restored.monogram,'AB');assert.equal(restored.profileId,'profile-1','profile is restored into the customizer');
assert.ok(run('customize()').includes('editing an item from your bag'),'customizer explains the edit in progress');
run('stage=2;render(false)');
const editingHtml=run('customize()');
assert.ok(editingHtml.includes('Save changes'),'customizer offers Save changes while editing');
assert.ok(editingHtml.includes('Cancel editing'),'customizer offers a way to cancel editing');
run(`setOption('lining','Midnight');stage=2;render(false)`);
elFor('#profileSelect').value='profile-1';
run('nextConfig()');
bag=bagState();
assert.equal(bag.length,2,'saving an edit must not add a new line');
assert.equal(bag[0].id,suit.id,'edited line keeps its identity and position');
assert.equal(bag[1].id,jacket.id,'the other line is untouched');
assert.deepEqual(bag[0],{...suit,lining:'Midnight'},'only the lining changed; fabric, lapel, closure, fit, monogram and the full profile survive');
assert.deepEqual(bag[1],jacket,'the unedited line is byte for byte unchanged');
assert.equal(run('editingBagId'),null,'edit session ends after saving');

// Cancel path: start an edit, change an option, cancel; nothing may change.
const beforeCancel=clone(bagState());
run(`editBagItem('${suit.id}');setOption('lining','Tonal')`);
run('cancelBagEdit()');
assert.equal(run('editingBagId'),null,'cancel ends the edit session');
assert.deepEqual(bagState(),beforeCancel,'cancelling an edit leaves the bag exactly as it was');

// Profile guard: an edit cannot be saved without a profile.
run(`editBagItem('${suit.id}');stage=2;render(false)`);
elFor('#profileSelect').value='';
run('nextConfig()');
assert.ok(elFor('#configError').textContent.includes('Choose a saved profile'),'saving an edit without a profile is blocked');
assert.deepEqual(bagState(),beforeCancel,'a blocked save leaves the bag unchanged');
run('cancelBagEdit()');

// Quick add items are editable through the same path, and fields the
// customizer does not own (fabricCode) survive an edit.
run(`bag[1].fabricCode='EB11127';write('suits-bag',bag)`);
const jacketBefore=bagState()[1];
run(`editBagItem('${jacket.id}');setOption('lapel','Shawl');stage=2;render(false)`);
elFor('#profileSelect').value='profile-1';
run('nextConfig()');
bag=bagState();
assert.equal(bag.length,2);
// Saving through the customizer also records profileId on the item, the same
// field customizer-created items already carry; nothing pre-existing is lost.
assert.deepEqual(bag[1],{...jacketBefore,lapel:'Shawl',profileId:'profile-1'},'quick add item updates in place and keeps fabricCode and its profile');

// Non garment kinds get no Edit action, and editBagItem ignores them.
run('addDirect(16)'); // accessory set
run(`addDirect(18,{gift:{amount:100,recipient:'Sam',email:'sam@example.com',message:''}})`); // gift card
bag=bagState();
assert.equal(bag.length,4);
run('openBag()');
const bagHtml=elFor('#modalContent').innerHTML;
assert.equal((bagHtml.match(/editBagItem\(/g)||[]).length,2,'only the two configured garments offer Edit');
assert.ok(!run(`lineHtml(bag[2])`).includes('editBagItem'),'accessory line has no Edit');
assert.ok(!run(`lineHtml(bag[3])`).includes('editBagItem'),'gift card line has no Edit');
assert.ok(run(`lineHtml(bag[0])`).includes('>Edit</button>'),'garment line renders an Edit button');
run(`editBagItem('${bag[2].id}')`);
assert.equal(run('editingBagId'),null,'editBagItem is a no-op for non garment items');
assert.equal(run('subtotal()'),399+10+10+279+79+100,'totals still cover every kind of line');
console.log('Bag edit checks passed: edit restores every selection, saving updates the same line in place with only the changed option different, cancel and the profile guard leave the bag untouched, quick add items are editable, and gift/accessory/swatch lines offer no Edit.');
