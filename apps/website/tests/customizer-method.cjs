const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// SIZ-02: the sizing method choice must live inside the customizer Measurements
// step, share the Measurement Studio state (draft.method and the saved
// profiles), and drive what Add to Bag uses. Quick add must explain, in its
// own words, that a measurement profile is needed instead of relying on the
// browser default form validation text.
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
function makeEl(){return{innerHTML:'',textContent:'',value:'',open:false,style:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){this.open=true},close(){this.open=false}}}
const elements=new Map();
const documentStub={title:'',querySelector(sel){if(!elements.has(sel))elements.set(sel,makeEl());return elements.get(sel)},getElementById(id){return documentStub.querySelector('#'+id)},addEventListener(){},createElement:()=>makeEl()};
class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
const bodyProfile={id:'p-body',name:'Body profile',method:'body',wearer:'Men',unit:'in',fit:'Tailored',values:{chest:40},created:'2026-01-01T00:00:00.000Z'};
const readyProfile={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'42',length:'Long',trouser:'36'},created:'2026-01-02T00:00:00.000Z'};
localStorage.setItem('suits-profiles',JSON.stringify([bodyProfile,readyProfile]));
localStorage.setItem('suits-config',JSON.stringify({product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profileId:'p-body'}));
const ctx=vm.createContext({console,localStorage,document:documentStub,location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);'});
for(const f of ['app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx);

// 1. The method choice renders in the customizer Measurements step, reusing
// the Studio cards, with the saved body profile's method active.
run('stage=2;config.product=0');
const html1=run('customize()');
assert.ok(html1.includes('method-cards'),'method choice renders in the customizer Measurements step');
assert.ok(html1.includes('How would you like to find your fit?'),'customizer asks for a method in context');
assert.ok(html1.includes('Measure my body')&&html1.includes('Use a standard size'),'both Studio methods are offered');
assert.ok(/class="method active"[^>]*setCustomizerMethod\('body'\)/.test(html1),'body card is active for the selected body profile');
assert.ok(!/class="method active"[^>]*setCustomizerMethod\('ready'\)/.test(html1),'ready card is not active yet');

// 2. Switching method updates the shared Studio state and the profile Add to
// Bag will use: the most recent saved profile of the chosen method becomes
// the selection, the dropdown shows it selected, and nextConfig bags it.
run("setCustomizerMethod('ready')");
assert.equal(run('draft.method'),'ready','Studio draft method follows the customizer choice');
assert.equal(run('config.profileId'),'p-ready','switching method selects a saved profile of that method');
const html2=run('customize()');
assert.ok(html2.includes('<option value="p-ready" selected>'),'dropdown shows the ready profile selected');
assert.ok(/class="method active"[^>]*setCustomizerMethod\('ready'\)/.test(html2),'ready card is active after switching');
documentStub.querySelector('#profileSelect').value='p-ready';
const bagBefore=run('bag.length');
run('nextConfig()');
assert.equal(run('bag.length'),bagBefore+1,'Add to Bag adds one item');
assert.equal(run('bag[bag.length-1].profile.id'),'p-ready','Add to Bag uses the profile chosen under the new method');
assert.equal(run('bag[bag.length-1].profile.method'),'ready','bagged profile carries the standard size method');

// 3. Switching to a method with no saved profile clears the selection, so
// Add to Bag cannot silently use a profile of the other method; it keeps
// blocking with the existing clear message.
run("profiles=profiles.filter(p=>p.id!=='p-ready');config.profileId='p-body';draft.method='body';saveConfig();saveDraft()");
run("setCustomizerMethod('ready')");
assert.equal(run('config.profileId'),undefined,'selection is cleared when no profile uses the chosen method');
documentStub.querySelector('#profileSelect').value='';
const bagLen3=run('bag.length');
run('nextConfig()');
assert.equal(run('bag.length'),bagLen3,'nothing is bagged without a profile for the chosen method');
assert.equal(documentStub.querySelector('#configError').textContent,'Choose a saved profile, or take your measurements first.','the clear customizer message still blocks Add to Bag');

// 4. Women: standard sizes are not offered in the customizer, matching the
// Studio rule, and a programmatic switch to ready is refused.
run("stage=2;config.product=13;config.profileId='p-body';draft.method='body'");
const htmlW=run('customize()');
assert.ok(htmlW.includes("setCustomizerMethod('body')"),'body method card still renders for a Women garment');
assert.ok(!htmlW.includes("setCustomizerMethod('ready')"),'no standard size card for a Women garment');
assert.ok(htmlW.includes('Standard sizes are not offered for this garment'),'the Women rule is explained in the step');
run("setCustomizerMethod('ready')");
assert.equal(run('draft.method'),'body','ready cannot be selected for a Women garment');

// 5. Quick add: no profile chosen shows the clear custom message inside the
// dialog, and the select no longer leans on the required attribute (the
// source of the browser default "Please select an item in the list." text).
const qaSource=fs.readFileSync('public/quick-add.js','utf8');
assert.ok(!qaSource.includes('name="profile" required'),'quick add profile select does not rely on required validation');
assert.ok(qaSource.includes('id="quickAddError"'),'quick add dialog has an inline error area');
const bagLen5=run('bag.length');
run('quickAddProduct(0)');
const modalHtml=documentStub.querySelector('#modalContent').innerHTML;
assert.ok(modalHtml.includes('id="quickAddError"'),'rendered dialog contains the inline error area');
assert.ok(!modalHtml.includes('name="profile" required'),'rendered dialog select has no required attribute');
run("submitQuickAdd(0,{__data:{profile:'',fit:'Tailored'}})");
assert.equal(run('bag.length'),bagLen5,'quick add bags nothing without a profile');
assert.equal(documentStub.querySelector('#quickAddError').textContent,'Please choose a saved measurement profile first, or take your measurements before adding this garment to your bag.','quick add names the missing measurement profile in its own words');
run("submitQuickAdd(0,{__data:{profile:'p-body',fit:'Tailored'}})");
assert.equal(run('bag.length'),bagLen5+1,'quick add still works with a chosen profile');
assert.equal(run('bag[bag.length-1].profile.id'),'p-body','quick add bags the chosen profile');

console.log('Customizer method checks passed: method choice renders in the Measurements step, switching method updates Studio state and the profile Add to Bag uses, Women garments offer no standard sizes, and quick add explains the missing measurement profile.');
