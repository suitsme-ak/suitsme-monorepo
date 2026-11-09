const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path'),{pathToFileURL}=require('node:url'),file=path.resolve('lib/accounts.ts'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);const {accounts,SESSION_COOKIE}=m.exports;
// Package J9, JPOS shop measurements import (design in
// docs/ux-audit/j9-app-import-design.md). The journeys drive the
// real lib/accounts.ts dispatcher against a fake D1 that also
// carries the three jpos_staging_ tables, in the accounts.cjs
// style. Every staged row here is invented test data; no real
// customer data is used anywhere in this suite. The fake supports
// the LOWER(customeremail) lookup shape the handler issues.
function matchWhere(row,where,args){if(!where)return true;let ai=0;return where.split(' AND ').every(cond=>{const c=cond.trim().match(/^(LOWER\((\w+)\)|(\w+))(=|<>)(\?|NULL)$/);if(!c)throw Error('Fake DB cannot parse condition: '+cond);const value=c[2]?(typeof row[c[2]]==='string'?row[c[2]].toLowerCase():row[c[2]]):row[c[3]];if(c[5]==='NULL')return c[4]==='='?(value===null||value===undefined):!(value===null||value===undefined);const v=args[ai++];return c[4]==='='?value===v:value!==v;});}
class DB{
 constructor(){this.users=[];this.user_credentials=[];this.user_identities=[];this.sessions=[];this.auth_tokens=[];this.auth_attempts=[];this.account_profiles=[];this.account_order_snapshots=[];this.store_orders=[];this.oauth_states=[];this.jpos_staging_customers=[];this.jpos_staging_gaugesuitprofiles=[];this.jpos_staging_measurementprofiles=[];}
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
global.fetch=async(url)=>{throw Error('Unexpected network request: '+url);};
const EMAIL={EMAIL_API_URL:'https://mail.example/send',EMAIL_API_KEY:'test-mail-key',EMAIL_FROM:'Suits.me <accounts@example.com>'};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const DAY=24*60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
const req=(route,{method='GET',cookie,body,origin,headers={}}={})=>new Request('https://shop.example'+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'&&origin!==null?{Origin:origin||'https://shop.example'}:{}),...headers,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const callImport=(env,opts={})=>accounts(req('/api/account/jpos-import',{method:'POST',body:{},...opts}),env);
const UID='U0123456789abcdef0123456789abcdef';
function seedAccount(db,{email='shopper@example.com',verified=true,name='Shop Customer',token='j9-session-token'}={}){
 db.users.push({id:UID,email,display_name:name,email_verified_at:verified?iso(-DAY):null,created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
 db.sessions.push({token_hash:hash(token),user_id:UID,created_at:iso(-DAY),last_seen_at:iso(0),expires_at:iso(29*DAY)});
 return SESSION_COOKIE+'='+token;
}
// Invented staged rows for one shop customer: a gauge record with a
// mixed fraction half waist, band labels for height and weight, a
// shoulder label, and two profile headers where the later one wins.
function seedShop(db,{chestOverArm='46',chest='42'}={}){
 db.jpos_staging_customers.push({customerID:'1001',customerfirstname:'Ada',customerlastname:'Tailor',customeremail:'Shopper@Example.com'});
 db.jpos_staging_gaugesuitprofiles.push({gaugeSuitProfileId:'GSP-1',Height:'5 ft 9 in to 5 ft 11 in',Chest:chest,ChestOverArm:chestOverArm,GaugeSuitJacketWaist:'36',HalfWaistJacket:'17 1/2',Weight:'180 lb to 199 lb',GaugeSuitPantsWaist:'34',Seat:'44',Posture:'Normal',Shoulder:'Regular',customerId:'1001',gaugeProfileCreationDate:'2020-01-15',gaugeProfileModificationDate:'2020-06-15',Thigh:'24',PantsOutSeam:'42'});
 db.jpos_staging_measurementprofiles.push({measurementId:'M-OLD',gaugeSuitProfileId:'GSP-1',jacketOrderId:'OJ-OLD',pantsOrderId:'OP-OLD',vestOrderId:'',customerId:'1001',measurementCreationDate:'2019-05-01',measurementModificationDate:'2019-06-01',measurementType:'Trim Classic',lastOrderNo:'1'});
 db.jpos_staging_measurementprofiles.push({measurementId:'M-NEW',gaugeSuitProfileId:'GSP-1',jacketOrderId:'OJ-9',pantsOrderId:'OP-9',vestOrderId:'OV-9',customerId:'1001',measurementCreationDate:'2021-03-01',measurementModificationDate:'2021-03-02',measurementType:'Classic',lastOrderNo:'2'});
}
const storedProfile=db=>db.account_profiles.length?JSON.parse(db.account_profiles[0].data):null;
(async()=>{
 const schema=await import(pathToFileURL(path.resolve('lib/measurement-schema.js')).href);
 const validateV3Blocks=schema.validateV3Blocks;
 assert.equal(typeof validateV3Blocks,'function','The suite validates stored profiles with the real validateV3Blocks');

 // Guest: no session is a 401 and nothing is read or written.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const r=await callImport(env);
  assert.equal(r.status,401,'A guest import is refused');
  assert.equal((await r.json()).imported,0);
  assert.equal(db.account_profiles.length,0,'A guest import writes nothing');
 }

 // Unverified: the verified email gate refuses with the confirm
 // your email wording, and nothing is written even though a shop
 // record matches the address.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db,{verified:false});
  const r=await callImport(env,{cookie});
  assert.equal(r.status,403,'An unverified account is refused');
  const body=await r.json();
  assert.ok(body.error&&body.error.startsWith('Please confirm your email first.'),'The refusal uses the confirm your email wording');
  assert.equal(body.imported,0);
  assert.equal(db.account_profiles.length,0,'An unverified import writes nothing');
 }

 // Foreign origin: the standard POST origin check refuses before
 // any state can change.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  const r=await callImport(env,{cookie,origin:'https://evil.example'});
  assert.equal(r.status,403,'A foreign origin is refused');
  assert.deepEqual(await r.json(),{error:'Invalid request origin.'});
  assert.equal(db.account_profiles.length,0,'A foreign origin import writes nothing');
 }

 // No match: no JPOS customer carries the account email.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const cookie=seedAccount(db,{email:'stranger@example.com'});
  seedShop(db);
  const r=await callImport(env,{cookie});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{status:'no-match',imported:0});
  assert.equal(db.account_profiles.length,0,'A no match import writes nothing');
 }

 // Ambiguous: a shared email on two distinct customer ids imports
 // nothing (the safe default for shared addresses).
 {
  const db=new DB,env={DB:db,...EMAIL};
  const cookie=seedAccount(db,{email:'shared@example.com'});
  db.jpos_staging_customers.push({customerID:'2001',customerfirstname:'First',customerlastname:'Sharer',customeremail:'shared@example.com'});
  db.jpos_staging_customers.push({customerID:'2002',customerfirstname:'Second',customerlastname:'Sharer',customeremail:'Shared@Example.com'});
  db.jpos_staging_gaugesuitprofiles.push({gaugeSuitProfileId:'GSP-2',Chest:'40',customerId:'2001'});
  db.jpos_staging_gaugesuitprofiles.push({gaugeSuitProfileId:'GSP-3',Chest:'41',customerId:'2002'});
  const r=await callImport(env,{cookie});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.status,'ambiguous','A shared email is ambiguous');
  assert.equal(body.imported,0);
  assert.ok(body.message&&body.message.includes('ask the shop'),'The ambiguous answer asks the customer to have the shop confirm the record');
  assert.equal(db.account_profiles.length,0,'An ambiguous import writes nothing');
 }

 // No gauge: the customer matched but holds no gauge profile row.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const cookie=seedAccount(db);
  db.jpos_staging_customers.push({customerID:'3001',customerfirstname:'No',customerlastname:'Gauge',customeremail:'shopper@example.com'});
  const r=await callImport(env,{cookie});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{status:'no-gauge',imported:0});
  assert.equal(db.account_profiles.length,0,'A no gauge import writes nothing');
 }

 // Unavailable: staging tables that cannot be read answer 503
 // with the unavailable status instead of a generic failure.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const cookie=seedAccount(db);
  delete db.jpos_staging_customers;
  const r=await callImport(env,{cookie});
  assert.equal(r.status,503,'Missing staging tables answer 503');
  const body=await r.json();
  assert.equal(body.status,'unavailable');
  assert.equal(body.imported,0);
 }

 // Full import: fraction conversion, band labels snapshot only,
 // the posture token kept, provenance and header links right, and
 // the stored profile passes validateV3Blocks.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  const r=await callImport(env,{cookie});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.status,'imported');
  assert.equal(body.imported,1);
  assert.equal(db.account_profiles.length,1,'One profile row is stored');
  const profile=storedProfile(db);
  assert.deepEqual(body.profile,profile,'The answer carries the stored profile');
  assert.equal(profile.id,'jpos-1001','The id is deterministic from the JPOS customer id');
  assert.equal(profile.version,3);assert.equal(profile.origin,'jpos');
  assert.equal(profile.method,'body');assert.equal(profile.garment,'suit');assert.equal(profile.wearer,'Men');assert.equal(profile.unit,'in');
  assert.equal(profile.wearerName,'Ada Tailor','The wearer name comes from the customer record');
  assert.equal(profile.name,'Shop measurements (Classic)','The name carries the latest header type');
  assert.equal(profile.gauge.halfWaistJacket,17.5,'The mixed fraction 17 1/2 converts to 17.5');
  assert.equal(profile.gauge.chest,42);assert.equal(profile.gauge.jacketWaist,36);assert.equal(profile.gauge.pantsWaist,34);
  assert.equal(profile.gauge.chestOverArm,46);assert.equal(profile.gauge.seat,44);
  assert.equal(profile.gauge.height,null,'Gauge height is always null: the source is a band label');
  assert.equal(profile.gauge.weight,null,'Gauge weight is always null: the source is a band label');
  assert.equal(profile.gauge.shoulder,null,'Gauge shoulder is always null: the source is a label');
  assert.equal(profile.gauge.posture,'Normal','A recorded posture token is kept');
  assert.deepEqual(profile.values,{},'Gauge values are never copied into body values');
  assert.deepEqual(profile.figure,{},'The figure block is empty');
  assert.deepEqual(profile.header,{profileType:'Classic',jposLinks:{jacket:'OJ-9',pants:'OP-9',vest:'OV-9'}},'The header comes from the latest measurement profile');
  const prov=profile.provenance;
  assert.equal(prov.sourceSystem,'jpos');assert.equal(prov.sourceTable,'measurementProfiles');
  assert.equal(prov.jposCustomerId,'1001');assert.equal(prov.jposMeasurementId,'M-NEW');assert.equal(prov.jposGaugeSuitProfileId,'GSP-1');
  assert.deepEqual(prov.jposOrderIds,{jacket:'OJ-9',pants:'OP-9',vest:'OV-9'});
  assert.equal(prov.sourceCreatedAt,'2021-03-01');assert.equal(prov.sourceModifiedAt,'2021-03-02');
  assert.ok(prov.importedAt,'The provenance records the import time');
  const snap=prov.importSnapshot;
  assert.deepEqual(snap.gauge,profile.gauge,'The snapshot holds the gauge exactly as imported');
  assert.deepEqual(snap.values,{});assert.deepEqual(snap.figure,{});
  assert.equal(snap.raw.Height,'5 ft 9 in to 5 ft 11 in','The height band text is kept in the raw snapshot');
  assert.equal(snap.raw.Weight,'180 lb to 199 lb','The weight band text is kept in the raw snapshot');
  assert.equal(snap.raw.Shoulder,'Regular','The shoulder label is kept in the raw snapshot');
  assert.equal(snap.raw.Thigh,'24','Thigh has no gauge slot and stays raw only');
  assert.equal(snap.raw.PantsOutSeam,'42','PantsOutSeam has no gauge slot and stays raw only');
  assert.deepEqual(validateV3Blocks(profile),[],'The stored profile passes validateV3Blocks');
 }

 // Re-import unchanged: the same source values are a no op, with
 // no second row and the row timestamps untouched.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  await callImport(env,{cookie});
  const rowBefore={...db.account_profiles[0]};
  const r=await callImport(env,{cookie});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.status,'unchanged','A repeat import of the same source is unchanged');
  assert.equal(body.imported,0);
  assert.equal(db.account_profiles.length,1,'No second row appears');
  assert.equal(db.account_profiles[0].data,rowBefore.data,'The stored profile is untouched');
  assert.equal(db.account_profiles[0].updated_at,rowBefore.updated_at,'updated_at is untouched');
 }

 // Refresh: the staged gauge changes and the copy is untouched
 // since import, so the copy and its snapshot update in place.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  await callImport(env,{cookie});
  db.jpos_staging_gaugesuitprofiles[0].Chest='44';
  const r=await callImport(env,{cookie});
  const body=await r.json();
  assert.equal(body.status,'refreshed','A changed source refreshes an untouched copy');
  assert.equal(body.imported,1);
  assert.equal(db.account_profiles.length,1,'A refresh stays one row');
  const profile=storedProfile(db);
  assert.equal(profile.gauge.chest,44,'The refreshed copy carries the new gauge value');
  assert.equal(profile.provenance.importSnapshot.gauge.chest,44,'The snapshot is refreshed with the copy');
  assert.deepEqual(validateV3Blocks(profile),[],'The refreshed profile passes validateV3Blocks');
  const again=await callImport(env,{cookie});
  assert.equal((await again.json()).status,'unchanged','After a refresh the same source is unchanged again');
 }

 // Candidate: the staged gauge changes again but the copy was
 // edited on suits.me, so the copy is kept and the new values are
 // recorded as a pending candidate on its provenance.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  await callImport(env,{cookie});
  const edited=storedProfile(db);
  edited.values={chest:41};edited.gauge={...edited.gauge,chest:41};
  db.account_profiles[0].data=JSON.stringify(edited);
  db.jpos_staging_gaugesuitprofiles[0].Chest='45';
  const r=await callImport(env,{cookie});
  const body=await r.json();
  assert.equal(body.status,'candidate','A changed source against an edited copy is a candidate');
  assert.equal(body.imported,0);
  const profile=storedProfile(db);
  assert.equal(profile.gauge.chest,41,'The edited copy is never overwritten');
  assert.deepEqual(profile.values,{chest:41},'The customer edits survive');
  assert.equal(profile.provenance.importSnapshot.gauge.chest,42,'The original snapshot is kept');
  const pending=profile.provenance.pendingCandidate;
  assert.ok(pending,'The new values are recorded as a pending candidate');
  assert.equal(pending.gauge.chest,45,'The candidate holds the new shop value');
  assert.ok(pending.importedAt,'The candidate carries its own import time');
 }

 // Malformed gauge text: a ChestOverArm that is not a number stays
 // out of the gauge block and lands in the raw snapshot instead.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db,{chestOverArm:'not-a-number'});
  const cookie=seedAccount(db);
  const r=await callImport(env,{cookie});
  assert.equal((await r.json()).status,'imported');
  const profile=storedProfile(db);
  assert.equal(profile.gauge.chestOverArm,null,'Malformed text never enters the gauge block');
  assert.equal(profile.provenance.importSnapshot.raw.ChestOverArm,'not-a-number','Malformed text is kept in the raw snapshot');
  assert.deepEqual(validateV3Blocks(profile),[],'The profile still passes validateV3Blocks');
 }

 // Gauge only: a customer with a gauge row but no header row gets
 // a gauge only candidate, with the gauge table as its source.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const cookie=seedAccount(db);
  db.jpos_staging_customers.push({customerID:'4001',customerfirstname:'',customerlastname:'',customeremail:'shopper@example.com'});
  db.jpos_staging_gaugesuitprofiles.push({gaugeSuitProfileId:'GSP-4',Height:'',Chest:'40',ChestOverArm:'',GaugeSuitJacketWaist:'33',HalfWaistJacket:'16',Weight:'',GaugeSuitPantsWaist:'32',Seat:'41',Posture:'Erect',Shoulder:'',customerId:'4001',gaugeProfileCreationDate:'2018-02-01',gaugeProfileModificationDate:'2018-03-01',Thigh:'',PantsOutSeam:''});
  const r=await callImport(env,{cookie});
  assert.equal((await r.json()).status,'imported');
  const profile=storedProfile(db);
  assert.equal(profile.name,'Shop measurements','A gauge only import has no type in its name');
  assert.deepEqual(profile.header,{profileType:null,jposLinks:null},'A gauge only import has a null links header');
  assert.equal(profile.provenance.sourceTable,'GaugeSuitProfiles');
  assert.equal(profile.provenance.jposMeasurementId,null);
  assert.deepEqual(profile.provenance.jposOrderIds,{jacket:null,pants:null,vest:null});
  assert.equal(profile.provenance.sourceCreatedAt,'2018-02-01','Source dates fall back to the gauge row');
  assert.equal(profile.wearerName,'Shop Customer','The wearer name falls back to the account name');
  assert.equal(profile.gauge.posture,'Erect');
  assert.deepEqual(validateV3Blocks(profile),[],'The gauge only profile passes validateV3Blocks');
 }

 // Foreign row safety: an existing profile with the deterministic
 // id but no JPOS provenance for this customer is never touched.
 {
  const db=new DB,env={DB:db,...EMAIL};seedShop(db);
  const cookie=seedAccount(db);
  const foreign={id:'jpos-1001',name:'My own profile',method:'body',version:2};
  db.account_profiles.push({user_id:UID,id:'jpos-1001',data:JSON.stringify(foreign),created_at:iso(-DAY),updated_at:iso(-DAY)});
  const r=await callImport(env,{cookie});
  assert.equal(r.status,409,'A foreign row with the import id refuses');
  assert.equal((await r.json()).imported,0);
  assert.equal(db.account_profiles[0].data,JSON.stringify(foreign),'The foreign row is never touched');
 }

 console.log('JPOS import checks passed: guest 401, unverified 403 with nothing written, foreign origin 403, no match, shared email ambiguous, no gauge row, staging unavailable 503, full import (fraction 17 1/2 to 17.5, band labels snapshot only with gauge height, weight and shoulder null, posture token kept, provenance ids and header links right, validateV3Blocks clean), re-import unchanged with no write, refresh of an untouched copy, edited copy kept with a pending candidate, malformed gauge text snapshot only, gauge only import, and a foreign profile row never touched (package J9).');
})().catch(e=>{console.error(e);process.exit(1)});
