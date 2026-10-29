const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Minimal DOM and storage stubs, in the style of the other suites, so the real
// Measurement Studio code in public/app.js can run under Node. Elements are
// keyed by selector, so the test can read back the error box and the inputs
// that validation marked with aria-invalid.
function makeEl(){const el={innerHTML:'',textContent:'',checked:false,attrs:{},classList:{add(){},remove(){}},addEventListener(){},scrollIntoView(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null}};return el}
const elements=new Map();const elFor=key=>{if(!elements.has(key))elements.set(key,makeEl());return elements.get(key)};
const store=new Map();
const ctx=vm.createContext({
 crypto:require('node:crypto').webcrypto,
 localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
 document:{querySelector:s=>elFor(s),getElementById:id=>elFor('#'+id),addEventListener(){},querySelectorAll:()=>[]},
 location:{hash:'#measure'},
 window:{addEventListener(){},scrollTo(){}},
 setTimeout,clearTimeout,scrollTo(){},
});
vm.runInContext(fs.readFileSync('public/measurement-schema.js','utf8'),ctx);vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
const errorBox=()=>elFor('#measureError');
const clearError=()=>{errorBox().textContent='';errorBox().innerHTML=''};
const itemCount=()=> (errorBox().innerHTML.match(/<li>/g)||[]).length;
const marked=id=>elFor('#measureInput-'+id).getAttribute('aria-invalid');

// Jacket step (group 1) with four missing fields and one out of range value:
// a single Continue must report all five problems together, with ranges.
run(`draft.method='body';draft.unit='in';draft.step=1;draft.values={chest:200}`);
run('measureNext()');
assert.equal(run('draft.step'),1,'stays on the jacket step when fields are invalid');
assert.equal(itemCount(),5,'all five jacket fields are reported in one pass');
for(const text of ['Please check chest.','between 26 and 70 in','Please check natural waist.','between 22 and 70 in','Please check shoulder width.','between 12 and 28 in','Please check sleeve length.','between 17 and 40 in','Please check jacket length.','between 22 and 42 in'])assert.ok(errorBox().innerHTML.includes(text),'summary includes: '+text);
for(const id of ['chest','waist','shoulder','sleeve','jacket'])assert.equal(marked(id),'true',id+' is marked aria-invalid');

// Fixing two fields narrows the next report to the three remaining problems,
// and the fixed fields lose their invalid marking.
clearError();
run(`draft.values={chest:40,waist:32}`);
run('measureNext()');
assert.equal(run('draft.step'),1);
assert.equal(itemCount(),3,'only the remaining three problems are reported');
assert.ok(!errorBox().innerHTML.includes('Please check chest.'),'fixed fields drop out of the summary');
assert.equal(marked('chest'),null,'fixed field is no longer marked invalid');
assert.equal(marked('shoulder'),'true','still invalid field stays marked');

// A single problem keeps the original single field message, word for word.
clearError();
run(`draft.values={chest:40,waist:32,shoulder:20,sleeve:25}`);
run('measureNext()');
assert.equal(errorBox().textContent,'Please check jacket length. Enter a measurement between 22 and 42 in, or contact a fitter for guidance.','single problem uses the original message');
assert.equal(errorBox().innerHTML,'','single problem is not rendered as a list');

// A fully valid jacket step advances to the trousers step.
run(`draft.values.jacket=24`);
run('measureNext()');
assert.equal(run('draft.step'),2,'valid jacket step advances');

// Trousers step (group 2): all five problems are reported together too.
clearError();
run(`draft.values.inseam=5`);
run('measureNext()');
assert.equal(run('draft.step'),2,'stays on the trousers step when fields are invalid');
assert.equal(itemCount(),5,'all five trouser fields are reported in one pass');
for(const text of ['Please check seat / hips.','between 26 and 78 in','Please check trouser waist.','between 22 and 70 in','Please check thigh.','between 15 and 42 in','Please check inseam.','between 20 and 42 in','Please check outseam.','between 30 and 55 in'])assert.ok(errorBox().innerHTML.includes(text),'summary includes: '+text);

// Ranges follow the selected unit: cm entry is converted for storage, and the
// reported range is shown in cm.
clearError();
run(`draft.step=1;draft.unit='cm';draft.values={}`);
run('measureNext()');
assert.ok(errorBox().innerHTML.includes('between 66 and 178 cm'),'chest range is reported in cm');
assert.equal(marked('chest'),'true');

// The standard size flow is untouched by body validation: with sizes chosen
// (fresh sizes start unselected since SIZ-01) it advances without any body
// values present, and without chosen sizes the SIZ-01 guard blocks it.
run(`draft.method='ready';draft.step=1;draft.unit='in';draft.values={};draft.ready={jacket:'',length:'',trouser:''}`);
run('measureNext()');
assert.equal(run('draft.step'),1,'standard size step stays blocked until sizes are chosen');
run(`draft.ready={jacket:'40',length:'Regular',trouser:'34'}`);
run('measureNext()');
assert.equal(run('draft.step'),2,'standard size step advances once sizes are chosen');

console.log('Measurement validation checks passed: every invalid body field is reported together with its range, single problems keep the original message, invalid inputs are marked, and valid steps advance.');
