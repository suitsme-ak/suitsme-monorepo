const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
// SIZ-01: a fresh standard size (ready) selection must start unselected, and
// the flow must refuse to continue or save until the shopper picks every size.
const nodes={};
const makeNode=()=>({innerHTML:'',textContent:'',checked:false,open:false,classList:{add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0})});
const document={querySelector(s){return nodes[s]??=makeNode()},querySelectorAll(){return[]},addEventListener(){},getElementById(){return makeNode()}};
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const ctx=vm.createContext({localStorage,crypto:webcrypto,document,location:{hash:'#home'},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,console});
vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);

// 1. A fresh draft has no standard size preselected.
assert.equal(run('draft.ready.jacket'),'','Fresh draft must not preselect a jacket size');
assert.equal(run('draft.ready.length'),'','Fresh draft must not preselect a jacket length');
assert.equal(run('draft.ready.trouser'),'','Fresh draft must not preselect a trouser size');

// 2. The sizes step shows a clear prompt option for each field and no chosen value.
run("draft.method='ready';draft.step=1;saveDraft()");
const sizesHtml=ctx.measure();
for(const prompt of ['Choose a jacket size','Choose a jacket length','Choose a trouser size'])assert.ok(sizesHtml.includes(prompt),'Sizes step is missing prompt: '+prompt);
assert.ok(!/<option selected>/.test(sizesHtml),'Sizes step must not mark any real size as selected');

// 3. Continue is blocked with a message naming every missing field.
const errorNode=document.querySelector('#measureError');
errorNode.textContent='';
ctx.measureNext();
assert.equal(run('draft.step'),1,'Continue must stay on the sizes step while sizes are missing');
let error=errorNode.textContent;
for(const label of ['jacket size','jacket length','trouser size'])assert.ok(error.includes(label),'Block message must name the missing '+label+'. Got: '+error);

// 4. Choosing one field narrows the message to the fields still missing.
run("draft.ready.jacket='40'");
errorNode.textContent='';
ctx.measureNext();
assert.equal(run('draft.step'),1,'Continue must stay blocked until every size is chosen');
error=errorNode.textContent;
assert.ok(error.includes('jacket length')&&error.includes('trouser size'),'Block message must name the remaining fields. Got: '+error);
assert.ok(!error.includes('jacket size'),'Block message must not name a field already chosen. Got: '+error);

// 5. With every size chosen, Continue advances and the review echoes the choices.
run("draft.ready.length='Regular';draft.ready.trouser='34'");
ctx.measureNext();
assert.equal(run('draft.step'),2,'Continue must advance to review once every size is chosen');
const reviewHtml=ctx.measure();
for(const value of ['<strong>40</strong>','<strong>Regular</strong>','<strong>34</strong>'])assert.ok(reviewHtml.includes(value),'Review must echo the chosen size '+value);

// 6. A profile saved earlier with ready sizes still loads and echoes its own values.
run("profiles.push({id:'saved-ready',name:'Saved standard',method:'ready',fit:'Tailored',unit:'in',values:{},ready:{jacket:'42',length:'Long',trouser:'36'}})");
run("bag=[{id:'bag-1',product:0,fabric:'Navy',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Tonal',monogram:'',profile:profiles.find(p=>p.id==='saved-ready')}]");
ctx.reviewOrder();
const modalHtml=document.querySelector('#modalContent').innerHTML;
for(const value of ['42','Long','36'])assert.ok(modalHtml.includes(value),'Saved profile review must still show its saved size '+value);

console.log('Standard size checks passed: fresh draft starts unselected, prompt options shown, incomplete choices blocked with named fields, review echoes chosen sizes, saved profiles keep their values.');
