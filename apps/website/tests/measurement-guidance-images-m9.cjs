const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
// Journey J-M9 (measurements wave, guidance images package,
// owner decision O9): in the body measuring flow, the focused
// field's visual pane and the How to measure dialog show a
// suits.me original photograph of a model with a red measuring
// tape at the field's placement for photo style fields, and a
// per field line diagram with a marked start and finish for
// diagram style fields, replacing the generic highlighted
// figure. The photographs were generated for this site in the
// instructional style the benchmark uses; the poses and tape
// placements follow the verified capture of 2026-10-29 and no
// benchmark image file was copied. Four of the thirteen
// photographs could not be generated (waist, seat, front-length
// and the women's chest variant), so those fields keep the
// studio figure, as does every Boys field, and the garment and
// modify modes keep their M7 and M8 flat garment diagrams
// untouched. Presentation only: no measurement behavior,
// validation or stored data changes. Driven on the real
// storefront scripts in a Node vm with stubbed DOM and storage,
// in the style of the other suites, plus a file check that
// every photo the studio can reference exists on disk.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
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
  return{run,elFor,store};
}
const drawing=w=>w.elFor('#bodyDrawing').innerHTML;
const focus=(w,key)=>{w.run(`focusGarmentField('${key}')`);return drawing(w)};
function enterBodyStudio(w,productIdx){
  w.run(`chooseProduct(${productIdx})`);w.run(`beginDesign(${productIdx})`);
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('body')");
  w.run('startMeasurements()');
  w.run('measureNext()');
}
// The photographs produced for this package, named by schema
// ref, and the diagram refs drawn for the body flows.
const PRODUCED_PHOTOS=['neck','chest','sleeve','shoulder','jacket-length','bicep','stomach','thigh','knee'];
const DIAGRAM_REFS=['height','pants-length','front-rise','back-rise','leg-opening','vest-length'];

// ---------------------------------------------------------------- files
// Every ref the studio can turn into a photograph has a real
// image on disk, and the in code list matches what was produced.
{
  const w=makeWorld();
  const refs=JSON.parse(w.run('JSON.stringify(MEASURE_PHOTO_REFS)'));
  assert.deepEqual([...refs].sort(),[...PRODUCED_PHOTOS].sort(),'the studio photo list is exactly the set of photographs produced');
  for(const ref of PRODUCED_PHOTOS){
    const file=path.join('public','assets','measure',ref+'.webp');
    assert.ok(fs.existsSync(file),'the photograph exists on disk: '+file);
    assert.ok(fs.statSync(file).size>10000,'the photograph has non-trivial size: '+file+' ('+fs.statSync(file).size+' bytes)');
  }
  const diagrams=JSON.parse(w.run('JSON.stringify(Object.keys(BODY_DIAGRAMS))'));
  assert.deepEqual([...diagrams].sort(),[...DIAGRAM_REFS].sort(),'the drawn diagrams are exactly the reachable diagram style body fields');
  console.log('J-M9 (files) passed: every photograph the studio references exists under public/assets/measure/ with non-trivial size, and the diagram set is exactly the six reachable diagram fields.');
}

// ---------------------------------------------------------------- suit body flow
// Focusing each photo field renders its photograph with the
// field named in the alt text; the diagram fields render a line
// diagram and no photograph; waist and seat, whose photographs
// could not be generated, keep the studio figure.
{
  const w=makeWorld();
  enterBodyStudio(w,0);
  assert.equal(w.run('draft.step'),1,'the Studio advances to the name and height preamble');
  const preamble=w.run('measure()');
  assert.ok(preamble.includes('Line diagram showing the height measurement'),'the preamble draws the height line diagram');
  assert.ok(preamble.includes('>START<')&&preamble.includes('>FINISH<'),'the height diagram marks its start and finish');
  assert.ok(!preamble.includes('<img'),'the preamble shows no photograph');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),2,'a completed preamble advances to the jacket fields');

  const firstDraw=w.run('measure()');
  assert.ok(firstDraw.includes('src="assets/measure/chest.webp"'),'the jacket step opens on the chest photograph');
  const photoCases=[['chest','chest','Chest'],['sleeve','sleeve','Sleeve length'],['shoulder','shoulder','Shoulder width'],['jacket','jacket-length','Jacket length'],['bicep','bicep','Bicep'],['stomach','stomach','Stomach']];
  for(const [key,ref,label] of photoCases){
    const html=focus(w,key);
    assert.ok(html.includes(`<img class="measure-photo" src="assets/measure/${ref}.webp"`),'focusing '+key+' renders the '+ref+' photograph');
    assert.ok(html.includes(`alt="Photograph showing the tape placement for the ${label.toLowerCase()} measurement"`),'the '+key+' photograph alt text names the field and the tape placement');
    assert.ok(!html.includes('<svg'),'focusing '+key+' shows the photograph, not the figure');
  }
  w.run("gShowGuide('chest')");
  assert.ok(w.elFor('#modalContent').innerHTML.includes('src="assets/measure/chest.webp"'),'the How to measure dialog shows the chest photograph');

  w.run("updateValue('chest','40');updateValue('sleeve','25');updateValue('shoulder','18');updateValue('jacket','29');updateValue('stomach','34')");
  w.run('measureNext()');
  assert.equal(w.run('draft.step'),3,'valid jacket values advance to the trousers fields');
  const trousersDraw=w.run('measure()');
  assert.ok(trousersDraw.includes('Line diagram showing the pants length measurement'),'the trousers step opens on the pants length diagram');
  assert.ok(!trousersDraw.includes('<img'),'the trousers step opens with no photograph');
  for(const [key,label] of [['pantsLength','pants length'],['frontRise','front rise'],['backRise','back rise'],['legOpening','leg opening']]){
    const html=focus(w,key);
    assert.ok(html.includes(`Line diagram showing the ${label} measurement`),'focusing '+key+' renders its line diagram');
    assert.ok(html.includes('>START<')&&html.includes('>FINISH<'),'the '+key+' diagram marks start and finish');
    assert.ok(!html.includes('<img'),'focusing '+key+' shows no photograph');
  }
  for(const [key,label] of [['waist','Waist'],['seat','Seat / hips']]){
    const html=focus(w,key);
    assert.ok(html.includes(`Illustration showing ${label.toLowerCase()} measurement`),'focusing '+key+' keeps the studio figure, its photograph not having been generated');
    assert.ok(!html.includes('<img'),'focusing '+key+' shows no photograph');
  }
  for(const [key,ref] of [['thigh','thigh'],['knee','knee']]){
    const html=focus(w,key);
    assert.ok(html.includes(`src="assets/measure/${ref}.webp"`),'focusing '+key+' renders the '+ref+' photograph');
  }
  console.log('J-M9 (suit) passed: the suit body flow shows the produced photograph for every photo field with a generated asset, a marked line diagram for every diagram field, and the studio figure for waist and seat.');
}

// ---------------------------------------------------------------- women and boys
// A Women wearer is never shown the men's chest photograph: the
// women's chest variant could not be generated, so her chest
// keeps the figure, while her other photo fields use the
// produced set. A Boys wearer gets the figure for every field,
// photographs and diagrams alike, the set having been produced
// on adult models.
{
  const w=makeWorld();
  const idx=w.run("products.findIndex(p=>p.category==='Women'&&p.kind==='suit')");
  assert.ok(idx>=0,'the catalog holds a Women suit');
  enterBodyStudio(w,idx);
  w.run("draft.wearerName='Alex Kumar';updateValue('height','66')");
  w.run('measureNext()');
  assert.equal(w.run('garmentSetId()'),'womens-suit',"the session uses the women's suit set");
  const chestHtml=focus(w,'chest');
  assert.ok(!chestHtml.includes('assets/measure/chest'),'the women chest field never renders the men chest photograph');
  assert.ok(chestHtml.includes('Illustration showing chest measurement'),'the women chest field keeps the studio figure until its own photograph exists');
  assert.ok(focus(w,'sleeve').includes('src="assets/measure/sleeve.webp"'),'the women sleeve field uses the produced photograph');
  assert.ok(focus(w,'stomach').includes('src="assets/measure/stomach.webp"'),'the women stomach field uses the produced photograph');

  const wb=makeWorld();
  const bidx=wb.run("products.findIndex(p=>p.silhouette==='Boys two-piece')");
  assert.ok(bidx>=0,'the catalog holds a Boys suit');
  enterBodyStudio(wb,bidx);
  assert.equal(wb.run('draft.wearer'),'Boys','the session carries the Boys wearer');
  const boysPreamble=wb.run('measure()');
  assert.ok(boysPreamble.includes('Illustration showing height measurement'),'the boys preamble keeps the studio figure, not the height diagram');
  assert.ok(!boysPreamble.includes('Line diagram'),'the boys preamble draws no diagram');
  wb.run("draft.wearerName='Sam Kumar';updateValue('height','54')");
  wb.run('measureNext()');
  const boysChest=focus(wb,'chest');
  assert.ok(!boysChest.includes('<img'),'the boys chest field shows no photograph');
  assert.ok(boysChest.includes('Illustration showing chest measurement'),'the boys chest field keeps the studio figure');
  console.log('J-M9 (women and boys) passed: the women chest keeps the figure rather than the men photograph, her other fields use the produced set, and a Boys wearer gets the figure for photographs and diagrams alike.');
}

// ---------------------------------------------------------------- garment and modify modes
// The M7 garment mode and the M8 modify mode keep their flat
// garment diagrams: focusing their fields never renders a body
// photograph or a body diagram.
{
  const w=makeWorld();
  w.run('chooseProduct(0)');w.run('beginDesign(0)');
  w.run('nextConfig()');w.run('nextConfig()');
  w.run("setCustomizerMethod('garment')");
  w.run('startMeasurements()');
  w.run('measureNext()');
  w.run("draft.wearerName='Alex Kumar';updateValue('height','70')");
  w.run('measureNext()');
  const garmentDraw=w.run('measure()');
  assert.ok(garmentDraw.includes('Diagram of a garment laid flat'),'the garment mode fields step keeps the flat garment diagram');
  assert.ok(!garmentDraw.includes('assets/measure'),'the garment mode shows no guidance photograph');
  w.run("focusGarmentMeasureField('gJacketChest')");
  assert.ok(drawing(w).includes('Diagram of a garment laid flat'),'focusing a garment field keeps the flat garment diagram');
  assert.ok(!drawing(w).includes('<img'),'focusing a garment field shows no photograph');

  const wm=makeWorld();
  wm.run('chooseProduct(0)');wm.run('beginDesign(0)');
  wm.run('nextConfig()');wm.run('nextConfig()');
  wm.run("setCustomizerMethod('modify')");
  wm.run('startMeasurements()');
  wm.run('measureNext()');
  wm.run("draft.wearerName='Alex Kumar';saveDraft()");
  wm.run('measureNext()');
  wm.run("setModifyBasePart('jacket','40');setModifyBasePart('length','Regular');setModifyBasePart('trouser','34');setModifyBasePart('inseam','32')");
  wm.run('measureNext()');
  const modifyDraw=wm.run('measure()');
  assert.ok(modifyDraw.includes('Diagram of a garment laid flat'),'the modify mode fields step keeps the flat garment diagram');
  assert.ok(!modifyDraw.includes('assets/measure'),'the modify mode shows no guidance photograph');
  wm.run("focusGarmentMeasureField('gJacketChest')");
  assert.ok(drawing(wm).includes('Diagram of a garment laid flat'),'focusing a modify field keeps the flat garment diagram');
  assert.ok(!drawing(wm).includes('<img'),'focusing a modify field shows no photograph');
  console.log('J-M9 (garment and modify) passed: the existing garment and modify a standard size modes render exactly the flat garment diagrams they had, with no body photograph or body diagram anywhere.');
}
