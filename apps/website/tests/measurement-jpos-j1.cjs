const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path');
// Journeys J-J1a to J-J1d (JPOS consistency wave, package J1): the
// measurements core moves to the JPOS shaped version 3 schema.
// J-J1a: a version 3 suit body profile with the split waists
// validates identically in the browser schema, the account store
// and checkout, and the order stores the J0 envelope (header,
// gauge block rebuilt from the cleaned values, figure, web
// origin). J-J1b: a stored version 2 suit profile is offered
// completion against version 3, the upgrade lands its merged
// waist on trouserWaist only, jacketWaist is owed, and its sleeve
// and stomach are not carried; completing it in the studio saves
// version 3 in place. J-J1c: the version 3 shirt set validates
// and refuses identically on every surface. J-J1d: entry is
// inches only (plan M9): a draft left in centimeter mode by
// another flow does not change body entry, the centimeter figures
// beside the fields are a converter display, and a version 3
// profile is stored in inches whatever unit it claims.
// Driven on the real storefront scripts and the real server
// modules, in the style of the other suites.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
function makeWorld(seed={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(seed.profiles)localStorage.setItem('suits-profiles',JSON.stringify(seed.profiles));
  if(seed.config)localStorage.setItem('suits-config',JSON.stringify(seed.config));
  if(seed.draft)localStorage.setItem('suits-draft',JSON.stringify(seed.draft));
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
function loadLib(rel){const file=path.resolve(rel),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return m.exports}
class CommerceDB{constructor(){this.rows=[];this.sessions=[];this.users=[]}prepare(sql){const self=this;return{bind(...args){return{async first(){if(sql.includes('FROM sessions'))return self.sessions.find(r=>r.token_hash===args[0])||null;if(sql.includes('FROM users'))return self.users.find(r=>r.id===args[0])||null;if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;return self.rows.find(r=>r.id===args[0])||null},async run(){if(sql.startsWith('INSERT')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}if(sql.startsWith('DELETE')){self.rows=self.rows.filter(r=>!(r.id===args[0]&&r.owner===args[1]))}if(sql.startsWith('UPDATE')){const row=self.rows.find(r=>r.id===args[1]&&r.status==='pending');if(row){row.status='paid';row.transaction_id=args[0]}}return{success:true}}}}}}}
function matchWhere(row,where,args){if(!where)return true;let ai=0;return where.split(' AND ').every(cond=>{const c=cond.trim().match(/^(\w+)(=|<>)(\?|NULL)$/);if(!c)throw Error('Fake DB cannot parse condition: '+cond);if(c[3]==='NULL')return c[2]==='='?(row[c[1]]===null||row[c[1]]===undefined):!(row[c[1]]===null||row[c[1]]===undefined);const v=args[ai++];return c[2]==='='?row[c[1]]===v:row[c[1]]!==v;});}
class AccountDB{
 constructor(){this.users=[];this.user_credentials=[];this.user_identities=[];this.sessions=[];this.auth_tokens=[];this.auth_attempts=[];this.account_profiles=[];this.account_order_snapshots=[];this.store_orders=[];}
 prepare(sql){const self=this;return{bind(...args){return{async first(){return self.query(sql,args)[0]||null;},async all(){return{results:self.query(sql,args)};},async run(){self.query(sql,args);return{success:true};}}}};}
 query(sql,args){
  let m;
  if(m=sql.match(/^SELECT \* FROM (\w+)(?: WHERE (.+))?$/))return this[m[1]].filter(r=>matchWhere(r,m[2],args));
  if(m=sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/)){const cols=m[2].split(','),vals=m[3].split(','),row={};let ai=0;cols.forEach((c,i)=>{row[c]=vals[i].trim()==='?'?args[ai++]:vals[i].trim()==='NULL'?null:vals[i].trim();});this[m[1]].push(row);return[row];}
  if(m=sql.match(/^UPDATE (\w+) SET (.+) WHERE (.+)$/)){const sets=m[2].split(',').map(s=>s.trim()),rows=this[m[1]].filter(r=>matchWhere(r,m[3],args.slice(sets.length)));for(const r of rows)sets.forEach((s,i)=>{r[s.split('=')[0]]=args[i];});return rows;}
  if(m=sql.match(/^DELETE FROM (\w+) WHERE (.+)$/)){const kept=this[m[1]].filter(r=>!matchWhere(r,m[2],args));this[m[1]]=kept;return[];}
  throw Error('Fake DB cannot run: '+sql);
 }
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const DAY=24*60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
const SUIT_V3_VALUES={height:70,weight:180,chest:40,chestOverArm:46,sleeveInseamL:18,sleeveInseamR:18,shoulder:18,jacketLength:29,jacketWaist:34,outseam:42,trouserWaist:34,seat:40,frontRise:11,thigh:24,inseam:32,rise:12,crotch:10};
const suitV3=(over={})=>({version:3,origin:'web',method:'body',garment:'suit',wearer:'Men',wearerName:'Alex Kumar',name:'J1 suit',unit:'in',fit:'Tailored',header:{profileType:'suit',jposLinks:null},figure:{},provenance:null,values:{...SUIT_V3_VALUES},...over});

(async()=>{
  const {commerce}=loadLib('lib/commerce.ts');
  const accountsLib=loadLib('lib/accounts.ts');
  const {accounts,SESSION_COOKIE}=accountsLib;
  const EMAIL={EMAIL_API_URL:'https://mail.example/send',EMAIL_API_KEY:'test-mail-key',EMAIL_FROM:'Suits.me <accounts@example.com>'};
  global.fetch=async(url,init)=>{if(url===EMAIL.EMAIL_API_URL)return Response.json({ok:true});if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url)};
  const catalog=require('../lib/catalog.json');
  const suitIdx=catalog.findIndex(p=>p.kind==='suit'),shirtIdx=catalog.findIndex(p=>p.kind==='shirt'),pantsIdx=catalog.findIndex(p=>p.kind==='pants');
  assert.ok(suitIdx>=0&&shirtIdx>=0&&pantsIdx>=0,'the catalog has suit, shirt and trousers products');
  const adb=new AccountDB();
  adb.users.push({id:'U0123456789abcdef0123456789abcdef',email:'jj1@example.com',display_name:'J-J1',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  adb.sessions.push({token_hash:hash('jj1-session-token'),user_id:'U0123456789abcdef0123456789abcdef',created_at:iso(-DAY),last_seen_at:iso(0),expires_at:iso(29*DAY)});
  const aenv={DB:adb,...EMAIL};
  const acookie=SESSION_COOKIE+'=jj1-session-token';
  const areq=(route,{method='GET',cookie,body}={})=>new Request('https://shop.example'+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:'https://shop.example'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const cdb=new CommerceDB();
  const cenv={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:cdb};
  const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
  let attempt=0;
  const checkout=async(product,profile)=>{const res=await commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers:{Origin:'https://shop.example','oai-authenticated-user-id':'owner-jj1','Idempotency-Key':'jj1-attempt-'+String(++attempt).padStart(8,'0'),'Content-Type':'application/json'},body:JSON.stringify({items:[{product,profile}],shipping})}),cenv);return res.status};
  const accountSave=async profile=>(await accounts(areq('/api/account/profiles',{method:'POST',cookie:acookie,body:{profile}}),aenv)).status;
  const lastProfile=()=>JSON.parse(cdb.rows.at(-1).items)[0].profile;

  // ------------------------------------------------------------ J-J1a
  // A version 3 suit profile with split waists, on every surface.
  {
    const profile=suitV3();
    const w=makeWorld();
    assert.equal(w.run(`validateProfile(${JSON.stringify(profile)},'suit').ok`),true,'the client schema accepts the version 3 suit profile');
    assert.equal(await accountSave({...profile,id:'jj1-a-1'}),200,'the account store accepts the version 3 suit profile');
    assert.equal(await checkout(suitIdx,profile),200,'checkout accepts the version 3 suit profile');
    const stored=lastProfile();
    assert.equal(stored.version,3,'the order stores version 3');
    assert.equal(stored.origin,'web','the order stores the web origin');
    assert.equal(stored.unit,'in','the order stores inches');
    assert.deepEqual(stored.values,SUIT_V3_VALUES,'the order stores exactly the entered values, weight included');
    assert.deepEqual(stored.header,{profileType:'suit',jposLinks:null},'the order stores the rebuilt header');
    assert.deepEqual(stored.gauge,{height:70,chest:40,jacketWaist:34,pantsWaist:34,posture:null,weight:180,chestOverArm:46,seat:40,shoulder:18,halfWaistJacket:null},'the order stores the gauge block rebuilt from the cleaned values');
    assert.deepEqual(stored.figure,{},'the order stores the empty figure object');
    // The split is real: the two waists are independent values.
    const split=suitV3({values:{...SUIT_V3_VALUES,jacketWaist:36}});
    assert.equal(await checkout(suitIdx,split),200,'checkout accepts different jacket and trouser waists');
    assert.equal(lastProfile().gauge.jacketWaist,36,'the gauge jacket waist follows the jacket waist');
    assert.equal(lastProfile().gauge.pantsWaist,34,'the gauge pants waist follows the trouser waist');
    // Refusals agree everywhere: a merged waist, a stomach, a
    // missing jacket waist, a claimed halfWaistJacket.
    const bad=[['a merged waist key',{...suitV3(),values:{...SUIT_V3_VALUES,waist:34}}],['a stomach',{...suitV3(),values:{...SUIT_V3_VALUES,stomach:34}}],['no jacket waist',(()=>{const v={...SUIT_V3_VALUES};delete v.jacketWaist;return{...suitV3(),values:v}})()],['a web halfWaistJacket',{...suitV3(),gauge:{halfWaistJacket:17}}]];
    for(const [label,p] of bad){
      assert.equal(w.run(`validateProfile(${JSON.stringify(p)},'suit').ok`),false,'the client schema refuses '+label);
      assert.equal(await accountSave({...p,id:'jj1-bad-'+label.length}),400,'the account store refuses '+label);
      assert.equal(await checkout(suitIdx,p),400,'checkout refuses '+label);
    }
    // A second pair block rides along only in its J0 shape.
    const withPair=suitV3({secondPair:{trouserWaist:36,seat:41,thigh:25,inseam:33,outseam:43,rise:12}});
    assert.equal(await checkout(suitIdx,withPair),200,'checkout accepts a profile with a second pair block');
    assert.deepEqual(lastProfile().secondPair,{trouserWaist:36,seat:41,thigh:25,inseam:33,outseam:43,rise:12},'the order stores the second pair block cleaned');
    const badPair=suitV3({secondPair:{frontRise:11}});
    assert.equal(await checkout(suitIdx,badPair),400,'checkout refuses a second pair key with no Pants2 counterpart');
    console.log('J-J1a passed: a version 3 suit profile with split waists validates identically in the browser, the account store and checkout, the order stores the J0 envelope with the gauge block rebuilt server side, and version 2 shapes are refused on every surface.');
  }

  // ------------------------------------------------------------ J-J1c
  // The version 3 shirt set, on every surface.
  {
    const shirtValues={height:70,neck:15.5,chest:40,sleeve:25,shoulder:18,backLength:30,bicep:13,cuffSize:8,waist:34,sweep:42};
    const shirt={version:3,origin:'web',method:'body',garment:'shirt',wearer:'Men',wearerName:'Alex Kumar',name:'J1 shirt',unit:'in',fit:'Tailored',header:{profileType:'shirt',jposLinks:null},figure:{},provenance:null,values:shirtValues};
    const w=makeWorld();
    assert.equal(w.run(`validateProfile(${JSON.stringify(shirt)},'shirt').ok`),true,'the client schema accepts the version 3 shirt profile');
    assert.equal(await accountSave({...shirt,id:'jj1-c-1'}),200,'the account store accepts the version 3 shirt profile');
    assert.equal(await checkout(shirtIdx,shirt),200,'checkout accepts the version 3 shirt profile');
    assert.deepEqual(lastProfile().values,shirtValues,'the order stores exactly the shirt set');
    const noSweep={...shirt,values:{...shirtValues}};delete noSweep.values.sweep;
    assert.equal(await checkout(shirtIdx,noSweep),400,'checkout refuses a shirt profile without its sweep');
    const withSeat={...shirt,values:{...shirtValues,seat:40}};
    assert.equal(await checkout(shirtIdx,withSeat),400,'checkout refuses a shirt profile carrying the version 2 seat');
    const withFront={...shirt,values:{...shirtValues,frontLength:30}};delete withFront.values.backLength;
    assert.equal(await checkout(shirtIdx,withFront),400,'checkout refuses a shirt profile carrying front length instead of back length');
    assert.equal(await checkout(suitIdx,shirt),400,'checkout refuses the shirt profile on a suit');
    console.log('J-J1c passed: the version 3 shirt set validates on every surface, and the version 2 shirt fields (seat, front length) are refused in a version 3 profile.');
  }

  // ------------------------------------------------------------ J-J1d
  // Inches are the entry model; centimeters are a converter
  // display only (plan M9).
  {
    // A draft left in centimeter mode by a garment session does
    // not change body entry: no toggle is rendered on body steps,
    // typed numbers are stored as inches exactly, and the
    // centimeter figure beside the field follows the entry.
    const staleDraft={step:0,method:'body',unit:'cm',values:{},name:'My measurements',fit:'Tailored',ready:{jacket:'',length:'',trouser:''},garment:'suit',wearer:'Men',wearerName:'',fits:null,completionId:null,completionMissing:null};
    const w=makeWorld({draft:staleDraft});
    w.run("location.hash='#measure';render()");
    w.run('measureNext()');
    const preamble=w.run('measure()');
    assert.ok(!preamble.includes('changeUnit'),'the body preamble renders no units toggle even with a centimeter draft');
    assert.ok(preamble.includes('placeholder="inches"'),'the body preamble fields take inches');
    w.run("draft.wearerName='Alex Kumar';updateBodyValue('height','70')");
    w.run('measureNext()');
    const fieldsHtml=w.run('measure()');
    assert.ok(!fieldsHtml.includes('changeUnit'),'the body fields step renders no units toggle');
    w.run("updateBodyValue('chest','40')");
    assert.equal(w.run('draft.values.chest'),40,'a typed 40 is stored as 40 inches, not converted from centimeters');
    assert.equal(w.elFor('#cmEq-chest').textContent,'= 101.6 cm','the centimeter display converts the inch entry for reading the tape');
    // And a version 3 profile that claims centimeters is stored
    // in inches by checkout: version 3 has no centimeter mode.
    const claimsCm=suitV3({unit:'cm'});
    assert.equal(await checkout(suitIdx,claimsCm),200,'checkout accepts the version 3 profile');
    assert.equal(lastProfile().unit,'in','the stored profile records inches');
    assert.equal(lastProfile().values.chest,40,'the stored values are the inch values as submitted');
    console.log('J-J1d passed: body entry is inches only with centimeters as a converter display, a centimeter draft changes nothing, and checkout stores version 3 profiles in inches.');
  }

  // ------------------------------------------------------------ J-J1b
  // The version 2 to version 3 upgrade journey, in the studio.
  {
    const v2={id:'v2-suit',name:'Version 2 suit',method:'body',version:2,garment:'suit',wearer:'Men',wearerName:'Alex Kumar',unit:'in',fit:'Tailored',fits:{jacketFit:'Regular Fit',trouserFit:'Classic Comfort Fit'},values:{height:70,chest:40,sleeve:25,shoulder:18,jacket:29,bicep:13,stomach:34,pantsLength:42,waist:34,seat:40,frontRise:11,thigh:24},created:'2026-02-01T00:00:00.000Z'};
    const w=makeWorld({profiles:[v2]});
    // The upgrade itself, at the schema level.
    const up=JSON.parse(w.run(`JSON.stringify(upgradeProfileToV3(profiles[0],'suit').profile)`));
    assert.equal(up.version,3,'the upgrade produces a version 3 profile');
    assert.equal(up.values.trouserWaist,34,'the merged waist lands on trouserWaist');
    assert.ok(!('jacketWaist' in up.values),'jacketWaist is not derived from the merged waist');
    assert.ok(!('sleeve' in up.values)&&!('stomach' in up.values)&&!('bicep' in up.values),'the sleeve, stomach and bicep are not carried');
    assert.equal(up.values.jacketLength,29,'the jacket length carries under its version 3 name');
    assert.equal(up.values.outseam,42,'the pants length carries as the outseam');
    assert.deepEqual(JSON.parse(w.run("JSON.stringify(missingForCompletion(profiles[0],'suit'))")),['chestOverArm','sleeveInseamL','sleeveInseamR','jacketWaist','inseam','rise','crotch'],'completion reports exactly what the upgrade owes');
    // The customizer offers completion; cancelling is byte safe.
    w.run('chooseProduct(0)');w.run('beginDesign(0)');
    w.run('nextConfig()');w.run('nextConfig()');
    w.run("chooseCustomizerProfile('v2-suit')");
    const html=w.run('customize()');
    assert.ok(html.includes('still needs:'),'selecting the version 2 profile for a suit offers completion');
    for(const label of ['Chest over arms','Left sleeve inseam','Jacket waist','Inseam','Rise','Crotch depth'])assert.ok(html.includes(label),'the offer names the missing: '+label);
    const before=w.store.get('suits-profiles');
    w.run("startProfileCompletion('v2-suit')");
    assert.equal(w.run('draft.values.trouserWaist'),34,'the completion is seeded with the trouser waist');
    assert.equal(w.run('draft.values.sleeve'),undefined,'the completion is not seeded with the sleeve');
    w.run('cancelCompletion()');
    assert.equal(w.store.get('suits-profiles'),before,'cancelling leaves the stored version 2 profile byte identical');
    // Complete it.
    w.run("startProfileCompletion('v2-suit')");
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),1,'the completion advances to the preamble, name and height already carried');
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),2,'the preamble advances without new input');
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),2,'the owed jacket fields still block');
    w.run("updateBodyValue('chestOverArm','46');updateBodyValue('sleeveInseamL','18');updateBodyValue('sleeveInseamR','18');updateBodyValue('jacketWaist','35')");
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),3,'the jacket part advances to the trousers part');
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),3,'the owed trouser fields still block');
    w.run("updateBodyValue('inseam','32');updateBodyValue('rise','12');updateBodyValue('crotch','10')");
    w.run('measureNext()');
    assert.equal(w.run('draft.step'),4,'the completed values advance to review');
    w.elFor('#confirmMeasures').checked=true;
    w.run('measureNext()');
    assert.equal(w.run('profiles.length'),1,'completion saves in place, no duplicate profile');
    const p=JSON.parse(w.run('JSON.stringify(profiles[0])'));
    assert.equal(p.id,'v2-suit','the completed profile keeps its id');
    assert.equal(p.version,3,'the completed profile is version 3');
    assert.equal(p.created,'2026-02-01T00:00:00.000Z','the completed profile keeps its creation date');
    assert.equal(p.values.trouserWaist,34,'the trouser waist is the carried merged waist');
    assert.equal(p.values.jacketWaist,35,'the jacket waist is the newly measured one');
    assert.ok(!('sleeve' in p.values)&&!('stomach' in p.values)&&!('waist' in p.values),'no retired value survives completion');
    assert.equal(p.gauge.pantsWaist,34,'the gauge pants waist follows the carried trouser waist');
    assert.equal(p.gauge.halfWaistJacket,null,'the gauge half waist stays null');
    assert.equal(w.run("validateProfile(profiles[0],'suit').ok"),true,'the completed profile passes the shared schema validation');
    assert.deepEqual(JSON.parse(w.run("JSON.stringify(missingForCompletion(profiles[0],'suit'))")),[],'a completed version 3 profile owes nothing');
    console.log('J-J1b passed: a version 2 suit profile upgrades with its waist on trouserWaist only, jacketWaist owed, sleeve and stomach not carried, and studio completion saves version 3 in place with byte safe cancel.');
  }
})().catch(e=>{console.error(e);process.exit(1)});

