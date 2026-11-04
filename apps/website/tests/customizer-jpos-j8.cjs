const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// JPOS consistency wave, package J8: the visuals and plain language
// completion layer (plan section 4). Every aligned option value
// carries an original line illustration in the measurement diagram
// hand, keyed by the data-visual attributes the aligned renderers
// have carried since J3, so no aligned tile is text only; the
// aligned suit and jacket Personalize step also shows a combined
// schematic preview of the jacket front and back that follows the
// current lapel, closure and vent choices; and the last tailor
// jargon labels (cuff button arrangements, cuff stitch positions,
// tuxedo facings, vest button counts, the three-roll-two closure)
// read in buyer language first, stored values unchanged.
//
// Journey J8-1: an aligned suit's Personalize step renders an
// illustration inside the covered tiles and the combined preview
// states and draws the starting choices; changing the lapel, the
// closure and the vents redraws the preview and restates them.
// Journey J8-2: coverage is enumerated from the rendered steps
// themselves (suit at its defaults, suit with the tuxedo facings,
// the vest and the second pair open, suit with a shawl lapel,
// standalone trousers, shirt, waistcoat): every data-visual key the
// steps emit resolves to a well formed illustration, and the
// fallback set is empty.
// Journey J8-3: a value outside coverage falls back cleanly: an
// unknown stored lining colorway (appended to the lining group the
// way a legacy colorway is) renders its tile exactly as before J8,
// with no illustration node, no image element and no extra class.
// Journey J8-4: the legacy path is untouched: a pre-alignment item
// in bag Edit renders its Personalize step with no illustration
// nodes and no preview, and a legacy tile keeps its exact previous
// markup byte for byte.
function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
const readyProfile={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
function makeWorld(seed={}){
  const els=new Map();const elFor=s=>{if(!els.has(s))els.set(s,makeEl());return els.get(s)};
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  store.set('suits-profiles',JSON.stringify(seed.profiles||[readyProfile]));
  if(seed.config)store.set('suits-config',JSON.stringify(seed.config));
  if(seed.bag)store.set('suits-bag',JSON.stringify(seed.bag));
  const sandbox={console,localStorage,location:{hash:'#home'},fetch:async()=>({ok:false,json:async()=>null}),crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',FormData:class{constructor(f){this.data=(f&&f._data)||{}}get(k){return k in this.data?this.data[k]:null}},document:{title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()},addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=code=>vm.runInContext(code,ctx);
  const bag=()=>JSON.parse(store.get('suits-bag')||'[]');
  return{run,elFor,store,bag,config:()=>JSON.parse(store.get('suits-config'))};
}
function visualKeys(html){const out=new Set();for(const m of html.matchAll(/data-visual="([^"]+)"/g))out.add(m[1]);return out}
function tile(html,visual){const m=new RegExp(`<button class="choice[^"]*" data-visual="${visual.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^>]*>([\\s\\S]*?)</button>`).exec(html);return m?m[1]:null}

(async()=>{
  // ---------------------------------------------------------- J8-1
  {
    const w=makeWorld();
    w.run('beginDesign(0)');w.run('stage=1');
    const html=w.run('customize()');
    assert.ok(html.includes('<div class="option-preview" data-preview-lapel="Notch" data-preview-closure="2-Button" data-preview-vents="Center">'),'the combined preview opens the aligned step, stating the starting lapel, closure and vents');
    assert.ok(html.includes('Your jacket so far: Notch lapel, standard, 2 7/8 in · Two buttons · Center vent, single.'),'the preview caption states the combined choices in buyer words');
    assert.ok(html.includes('A schematic of the shapes you chose, not a photo.'),'the preview is honest about being a schematic');
    for(const visual of ['lapelType:Notch','lapelType:Peak','lapelSize:Standard','closure:6x2 DB','vents:Side','waistPocketType:Patch','ticketPocket:Flap','breastPocketType:Welt','cuffButtons:5 Buttons','cuffButtonType:Slanting Kissing','shirtCuffStyle:French Mitered']){
      if(!html.includes(`data-visual="${visual}"`))continue;
      const body=tile(html,visual);
      assert.ok(body&&body.startsWith('<svg class="choice-art"'),'the '+visual+' tile opens with its illustration');
      assert.ok(body.includes('</svg>'),'the '+visual+' illustration is a complete svg');
    }
    const lapelTile=tile(html,'lapelType:Peak');
    assert.ok(lapelTile&&lapelTile.endsWith('Peak lapel · Included'),'the illustrated tile keeps its buyer label and Included wording after the illustration');
    const previewBefore=html.slice(html.indexOf('<div class="option-preview"'),html.indexOf('</svg>',html.indexOf('<div class="option-preview"')));
    w.run("setOption('lapelType','Peak');setOption('closure','6x2 DB');setOption('vents','Side')");
    const changed=w.run('customize()');
    assert.ok(changed.includes('data-preview-lapel="Peak" data-preview-closure="6x2 DB" data-preview-vents="Side"'),'the preview follows the changed lapel, closure and vents');
    assert.ok(changed.includes('Your jacket so far: Peak lapel, standard, 3 in · Double breasted, 6 by 2 · Side vents, double.'),'the preview caption restates the new combination in buyer words');
    const previewAfter=changed.slice(changed.indexOf('<div class="option-preview"'),changed.indexOf('</svg>',changed.indexOf('<div class="option-preview"')));
    assert.notEqual(previewAfter,previewBefore,'the preview drawing itself changes with the choices');
    assert.ok(changed.includes('Three-roll-two, fastens at the middle button · Included'),'the three-roll-two closure reads in buyer language (J8 plain language pass)');
    assert.ok(changed.includes('Buttons touching, angled row (kissing) · Included'),'the kissing cuff button arrangement reads in buyer language, tailor term kept');
    assert.ok(changed.includes('Standard position · Included'),'the standard cuff stitch position reads in buyer language');
    console.log('J8-1 passed: the aligned Personalize step illustrates its tiles and the combined jacket preview states and redraws the lapel, closure and vent choices.');
  }
  // ---------------------------------------------------------- J8-2
  {
    const w=makeWorld();
    const keys=new Set();
    const collect=()=>{for(const k of visualKeys(w.run('customize()')))keys.add(k)};
    w.run('beginDesign(0)');w.run('stage=1');collect();
    w.run("setOption('tuxedo','Yes');setOption('vestIncluded','Yes');setOption('secondPairPants','Yes');setOption('labelStyle','Personalized Monogram');setOption('collarMonogramStyle','Block')");collect();
    w.run("setOption('lapelType','Shawl')");collect();
    const pantsIdx=w.run("products.findIndex(p=>p.kind==='pants')");w.run(`beginDesign(${pantsIdx})`);w.run('stage=1');collect();
    const shirtIdx=w.run("products.findIndex(p=>p.kind==='shirt')");w.run(`beginDesign(${shirtIdx})`);w.run('stage=1');collect();
    const vestIdx=w.run("products.findIndex(p=>p.kind==='waistcoat')");w.run(`beginDesign(${vestIdx})`);w.run('stage=1');collect();
    assert.ok(keys.size>=300,`the rendered steps emit the full aligned key set (saw ${keys.size})`);
    const fallback=[];
    for(const k of keys){const i=k.indexOf(':');const svg=w.run(`optionVisual(${JSON.stringify(k.slice(0,i))},${JSON.stringify(k.slice(i+1))})`);if(!svg){fallback.push(k);continue}assert.ok(svg.startsWith('<svg class="choice-art"')&&svg.endsWith('</svg>'),'the illustration for '+k+' is a complete choice-art svg');assert.ok(!svg.includes('NaN')&&!svg.includes('undefined'),'the illustration for '+k+' carries no unresolved values')}
    assert.deepEqual(fallback,[],'every data-visual key the aligned steps emit resolves to an illustration; the fallback set is empty');
    for(const group of ['lapelType','lapelSize','closure','vents','waistPocketType','waistPocketAngle','ticketPocket','breastPocketType','cuffButtons','cuffButtonType','cuffButtonHole','cuffStitchType','exteriorStitch','underCollarFabric','collarEyelet','pleats','sidePockets','backPockets','backPocketClosure','trouserCuff','frontTab','legBreak','watchPocket','elasticSideTabs','shirtBodyStyle','shirtFrontStyle','shirtCollarType','shirtCollarHeight','shirtSleeveStyle','shirtCuffStyle','shirtBackStyle','shirtPocketStyle','shirtPocketPosition','shirtButtons','shirtMonogramPlacement','shirtMonogramFont','shirtStitching','vestStyle','vestButtons','vestPocketType','vestPocketNumber','vestBack','lining','pants2.pleats','pants2.trouserCuff','secondPairPants','tuxLapel','tuxOutseam','labelStyle','collarMonogramStyle'])assert.ok([...keys].some(k=>k.startsWith(group+':')),'the coverage enumeration includes the '+group+' group');
    console.log(`J8-2 passed: coverage enumerated from the rendered steps: ${keys.size} distinct data-visual keys, every one illustrated, fallback set empty.`);
  }
  // ---------------------------------------------------------- J8-3
  {
    const w=makeWorld();
    assert.equal(w.run("optionVisual('lining','Chartreuse')"),'','a lining name with no known color resolves to no illustration');
    assert.equal(w.run("optionVisual('noSuchGroup','X')"),'','an unknown key resolves to no illustration');
    w.run('beginDesign(0)');w.run("config.lining='Chartreuse';saveConfig()");w.run('stage=1');
    const html=w.run('customize()');
    assert.equal(tile(html,'lining:Chartreuse'),'Chartreuse · Included','the uncovered tile renders exactly as before J8: label and Included, nothing else');
    const wine=tile(html,'lining:Wine');
    assert.ok(wine&&wine.startsWith('<svg class="choice-art"'),'a covered lining value on the same step carries its swatch');
    assert.ok(!html.includes('<img class="choice-art"')&&!html.includes('src=""'),'no broken image element is ever emitted for a fallback tile');
    console.log('J8-3 passed: a value outside coverage falls back to the exact pre-J8 tile, with no broken image and no empty box.');
  }
  // ---------------------------------------------------------- J8-4
  {
    const legacy={id:'legacy-j8',product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB',profile:JSON.parse(JSON.stringify(readyProfile))};
    const w=makeWorld({bag:[legacy],config:{product:0,fabric:'Navy',lapel:'Peak',closure:'One button',fit:'Slim',lining:'Burgundy',monogram:'AB'}});
    w.run("editBagItem('legacy-j8')");w.run('stage=1');
    const html=w.run('customize()');
    assert.ok(!html.includes('<svg'),'the legacy Personalize step contains no illustration nodes');
    assert.ok(!html.includes('choice-art')&&!html.includes('option-preview'),'the legacy Personalize step gains neither illustrated tiles nor the combined preview');
    assert.ok(html.includes(`<button class="choice active" aria-pressed="true" onclick="setOption('lining','Burgundy')">Burgundy · Included</button>`),'a legacy tile keeps its exact previous markup byte for byte');
    console.log('J8-4 passed: the legacy Personalize step is structurally identical to before J8, with no illustration nodes injected.');
  }
  console.log('JPOS J8 checks passed: every aligned value illustrated in the measurement diagram hand, the combined jacket preview follows the choices, uncovered values fall back to the exact pre-J8 tile, plain language labels lead, and legacy items are untouched.');
})().catch(e=>{console.error(e);process.exit(1)});
