const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
// SIZ-03 v1: a size guide inside the standard size step. Jacket size number
// is the body chest in inches (rule D1, owner confirmed 2026-10-27) and
// trouser size number is the body waist in inches (rule D2, confirmed).
// Only those two columns ship; no length, shoulder, sleeve, seat, or
// inseam numbers exist in the codebase, so none may appear in the guide.
const nodes={};
const makeNode=()=>({innerHTML:'',textContent:'',checked:false,open:false,classList:{add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0})});
const document={querySelector(s){return nodes[s]??=makeNode()},querySelectorAll(){return[]},addEventListener(){},getElementById(){return makeNode()}};
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const ctx=vm.createContext({localStorage,crypto:webcrypto,document,location:{hash:'#measure'},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,console});
vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);

// The guide region is everything from its labelled container onward.
const guideRegion=html=>{const i=html.indexOf('id="sizeGuide"');assert.ok(i>=0,'guide region must be present in the markup');return html.slice(i)};
const rowsOf=html=>[...html.matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g)].map(m=>({size:Number(m[1]),value:Number(m[2])}));
const jackets=Array.from({length:17},(_,i)=>30+i*2),trousers=Array.from({length:19},(_,i)=>28+i*2);

// 1. The ready sizes step offers the guide toggle, collapsed, and the body
//    step never shows it.
run("draft.method='ready';draft.step=1;draft.unit='in';saveDraft()");
let sizesHtml=ctx.measure();
assert.ok(sizesHtml.includes('onclick="toggleSizeGuide()"'),'sizes step must render the size guide toggle');
assert.ok(sizesHtml.includes('aria-expanded="false"'),'the guide starts collapsed');
assert.ok(sizesHtml.includes('aria-controls="sizeGuide"'),'the toggle must point at the guide region');
assert.ok(!sizesHtml.includes('id="sizeGuide"'),'a collapsed guide renders no tables');
run("draft.method='body';draft.step=1;saveDraft()");
const bodyHtml=ctx.measure();
assert.ok(!bodyHtml.includes('toggleSizeGuide')&&!bodyHtml.includes('id="sizeGuide"'),'the body measurement step must not render the size guide');
run("draft.step=2;saveDraft()");
assert.ok(!ctx.measure().includes('id="sizeGuide"'),'the body review step must not render the size guide');

// 2. Opening the guide renders both tables with the offered sizes and the
//    confirmed chest and waist values in inches.
run("draft.method='ready';draft.step=1;saveDraft()");
ctx.toggleSizeGuide();
sizesHtml=ctx.measure();
assert.ok(sizesHtml.includes('aria-expanded="true"'),'opening the guide flips aria-expanded');
let region=guideRegion(sizesHtml);
assert.ok(region.includes('role="region"')&&region.includes('aria-label="Size guide"'),'the guide region is labelled');
assert.ok(region.includes('Measure your chest and pick the jacket size that matches it.'),'jacket table is headed as a body measurement to compare against');
assert.ok(region.includes('Measure your waist and pick the trouser size that matches it.'),'trouser table is headed as a body measurement to compare against');
assert.ok(region.includes('Body chest (in)')&&region.includes('Body waist (in)'),'inch unit is named in both column headings');
const rows=rowsOf(region);
assert.equal(rows.length,jackets.length+trousers.length,'the guide lists one row per offered size across both tables');
assert.deepEqual(rows.slice(0,jackets.length),jackets.map(n=>({size:n,value:n})),'jacket rows are the offered sizes 30 to 62 even, chest equal to the size (D1)');
assert.deepEqual(rows.slice(jackets.length),trousers.map(n=>({size:n,value:n})),'trouser rows are the offered sizes 28 to 64 even, waist equal to the size (D2)');

// 3. No deferred column appears anywhere in the guide markup.
assert.equal((region.match(/<th[\s>]/g)||[]).length,4,'the guide has exactly four column headings: size and one measurement per table');
for(const heading of ['Shoulder','Sleeve','Seat','Inseam','Outseam','Thigh','Jacket length (in)','Jacket length (cm)'])assert.ok(!region.includes(heading),'the guide must not show a '+heading+' column: those values do not exist in the code');
for(const name of ['Short','Regular','Long'])assert.ok(region.includes(name),'the guidance names the '+name+' length without numbers');

// 4. Switching the Studio unit to cm converts every guide value with the
//    storefront conversion (times 2.54, whole number rounding).
run("changeUnit('cm')");
assert.equal(run('draft.unit'),'cm');
region=guideRegion(ctx.measure());
assert.ok(region.includes('Body chest (cm)')&&region.includes('Body waist (cm)'),'cm unit is named in both column headings');
const cmRows=rowsOf(region);
assert.deepEqual(cmRows.slice(0,jackets.length),jackets.map(n=>({size:n,value:Math.round(n*2.54)})),'jacket cm values are the inch values times 2.54, rounded');
assert.deepEqual(cmRows.slice(jackets.length),trousers.map(n=>({size:n,value:Math.round(n*2.54)})),'trouser cm values are the inch values times 2.54, rounded');
assert.equal(cmRows.find(r=>r.size===40).value,102,'jacket 40 reads chest 102 cm');
run("changeUnit('in')");

// 5. The guide is a pure addition: Wave 1 ready flow behavior is unchanged
//    with the guide open, and closing the guide removes the tables again.
run("draft.ready.jacket='40';draft.ready.length='Regular';draft.ready.trouser='34';saveDraft()");
ctx.measureNext();
assert.equal(run('draft.step'),2,'Continue still advances to review with the guide open');
run('draft.step=1;saveDraft()');
ctx.toggleSizeGuide();
assert.ok(!ctx.measure().includes('id="sizeGuide"'),'closing the guide removes the tables');

console.log('Size guide checks passed: guide renders collapsed in the standard size step only, jacket rows 30 to 62 with chest equal to size, trouser rows 28 to 64 with waist equal to size, cm switch converts at 2.54, and no deferred column appears.');
