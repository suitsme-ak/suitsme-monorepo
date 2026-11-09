const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path'),file=path.resolve('lib/accounts.ts'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);const {accounts,SESSION_COOKIE}=m.exports;
// Package 5.7, Google sign in (design section 2.7). The journeys
// drive the real accounts dispatcher with a fake D1 in the
// accounts.cjs style, and stub fetch the way tests/commerce.cjs
// stubs the payment provider: the mailer, Google's token endpoint
// and Google's JWKS document are the only network calls allowed,
// and the id tokens are real RS256 signatures made with a test
// RSA key, so the JWKS verification runs for real.
function matchWhere(row,where,args){if(!where)return true;let ai=0;return where.split(' AND ').every(cond=>{const c=cond.trim().match(/^(\w+)(=|\<\>)(\?|NULL)$/);if(!c)throw Error('Fake DB cannot parse condition: '+cond);if(c[3]==='NULL')return c[2]==='='?(row[c[1]]===null||row[c[1]]===undefined):!(row[c[1]]===null||row[c[1]]===undefined);const v=args[ai++];return c[2]==='='?row[c[1]]===v:row[c[1]]!==v;});}
class DB{
 constructor(){this.users=[];this.user_credentials=[];this.user_identities=[];this.sessions=[];this.auth_tokens=[];this.auth_attempts=[];this.account_profiles=[];this.account_order_snapshots=[];this.store_orders=[];this.oauth_states=[];}
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
const EMAIL={EMAIL_API_URL:'https://mail.example/send',EMAIL_API_KEY:'test-mail-key',EMAIL_FROM:'Suits.me <accounts@example.com>'};
const GOOGLE={GOOGLE_CLIENT_ID:'test-client-id',GOOGLE_CLIENT_SECRET:'test-client-secret'};
const TOKEN_URL='https://oauth2.googleapis.com/token',JWKS_URL='https://www.googleapis.com/oauth2/v3/certs';
const realKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const attackerKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=realKeys.publicKey.export({format:'jwk'});jwk.kid='test-key-1';jwk.alg='RS256';jwk.use='sig';
const b64url=data=>Buffer.from(data).toString('base64url');
function idToken(claims,{key=realKeys.privateKey,kid='test-key-1'}={}){
 const header=b64url(JSON.stringify({alg:'RS256',kid,typ:'JWT'})),payload=b64url(JSON.stringify(claims));
 const signature=crypto.sign('RSA-SHA256',Buffer.from(header+'.'+payload),key).toString('base64url');
 return header+'.'+payload+'.'+signature;
}
const baseClaims=over=>({iss:'https://accounts.google.com',aud:GOOGLE.GOOGLE_CLIENT_ID,sub:'google-sub-1',email:'new@example.com',email_verified:true,name:'New Shopper',iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+600,...over});
let nextIdToken='',exchangeOk=true;const exchanges=[];
global.fetch=async(url,init)=>{
 if(url===EMAIL.EMAIL_API_URL)return Response.json({ok:true});
 if(url===JWKS_URL)return Response.json({keys:[jwk]});
 if(url===TOKEN_URL){exchanges.push(new URLSearchParams(init.body));if(!exchangeOk)return Response.json({error:'invalid_grant'},{status:400});return Response.json({id_token:nextIdToken,access_token:'fake-access-token',token_type:'Bearer',expires_in:3600});}
 throw Error('Unexpected network request: '+url);
};
const req=(route,{method='GET',cookie,body,headers={}}={})=>new Request('https://shop.example'+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:'https://shop.example'}:{}),...headers,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const DAY=24*60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
const sessionOf=r=>{const m=(r.headers.get('Set-Cookie')||'').match(/suitsme-session=([^;]+)/);return m?m[1]:null;};
const fullEnv=db=>({DB:db,...EMAIL,...GOOGLE});
async function startFlow(env,returnTo){
 const r=await accounts(req('/api/auth/google/start'+(returnTo!==undefined?'?returnTo='+encodeURIComponent(returnTo):'')),env);
 assert.equal(r.status,302,'Start redirects');
 const location=new URL(r.headers.get('Location'));
 return{r,location,state:location.searchParams.get('state'),nonce:location.searchParams.get('nonce')};
}
async function callback(env,state,code='fake-auth-code'){return accounts(req('/api/auth/google/callback?code='+encodeURIComponent(code)+'&state='+encodeURIComponent(state)),env);}
function expectRefusal(r,db,message){
 assert.equal(r.status,302,message+': still a redirect');
 assert.equal(r.headers.get('Location'),'/sign-in?error=google',message+': lands on sign in with the error flag');
 assert.equal(sessionOf(r),null,message+': no session cookie');
}
(async()=>{
 // Gating: without accounts settings the routes answer the
 // accounts 503; with accounts but no Google settings, the Google
 // 503; the me payload reports googleEnabled in every configuration.
 {
  const db=new DB;
  for(const route of ['/api/auth/google/start','/api/auth/google/callback?code=x&state=y']){
   const r=await accounts(req(route),{});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'Accounts are not enabled yet.'});
   const g=await accounts(req(route),{DB:db,...EMAIL});assert.equal(g.status,503);assert.deepEqual(await g.json(),{error:'Google sign in is not enabled yet.'});
  }
  assert.deepEqual(await (await accounts(req('/api/auth/me'),{})).json(),{user:null,enabled:false,googleEnabled:false});
  assert.deepEqual(await (await accounts(req('/api/auth/me'),{DB:db,...EMAIL})).json(),{user:null,enabled:true,googleEnabled:false});
  const env=fullEnv(db);
  assert.deepEqual(await (await accounts(req('/api/auth/me'),env)).json(),{user:null,enabled:true,googleEnabled:true});
  assert.equal((await accounts(req('/api/auth/google/unknown'),env)).status,404,'Unknown Google paths are an honest 404');
  assert.equal((await accounts(req('/api/auth/google/start',{method:'POST'}),env)).status,404,'The Google routes are GET only');
 }
 // Start: the redirect carries the design parameters, the secret
 // is nowhere in it, and the state row stores only SHA-256 hashes
 // with the validated returnTo and a 10 minute expiry.
 {
  const db=new DB,env=fullEnv(db);
  const{location,state,nonce}=await startFlow(env,'/checkout');
  assert.equal(location.origin+location.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(location.searchParams.get('client_id'),GOOGLE.GOOGLE_CLIENT_ID);
  assert.equal(location.searchParams.get('redirect_uri'),'https://shop.example/api/auth/google/callback');
  assert.equal(location.searchParams.get('response_type'),'code');
  assert.equal(location.searchParams.get('scope'),'openid email profile');
  assert.equal(location.searchParams.get('prompt'),'select_account');
  assert.ok(state&&nonce,'State and nonce are minted');
  assert.ok(!location.toString().includes(GOOGLE.GOOGLE_CLIENT_SECRET),'The client secret never reaches the browser');
  assert.equal(db.oauth_states.length,1);
  const row=db.oauth_states[0];
  assert.equal(row.state_hash,hash(state),'Only the state hash is stored');
  assert.equal(row.nonce_hash,hash(nonce),'Only the nonce hash is stored');
  assert.notEqual(row.state_hash,state);assert.notEqual(row.nonce_hash,nonce);
  assert.equal(row.return_to,'/checkout');
  assert.equal(row.used_at,null);
  const ttl=Date.parse(row.expires_at)-Date.now();assert.ok(ttl>9*60*1000&&ttl<=10*60*1000,'State lives 10 minutes');
  for(const bad of ['https://evil.example/steal','//evil.example/steal','/sign-in','/api/auth/google/start','not a path']){
   const db2=new DB;await startFlow(fullEnv(db2),bad);
   assert.equal(db2.oauth_states[0].return_to,'/account','An unsafe returnTo falls back to /account: '+bad);
  }
 }
 // Callback, new user: a verified Google email creates the user
 // already verified, with an identity row and no credential row,
 // mints a session and lands on the returnTo. The state cannot be
 // replayed.
 {
  const db=new DB,env=fullEnv(db);
  const{state,nonce}=await startFlow(env,'/checkout');
  nextIdToken=idToken(baseClaims({nonce,email:'New@Example.com'}));
  const before=exchanges.length;
  const r=await callback(env,state);
  assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/checkout');
  const token=sessionOf(r);assert.ok(token,'A session cookie is set');
  const exchange=exchanges[before];
  assert.equal(exchange.get('grant_type'),'authorization_code');
  assert.equal(exchange.get('code'),'fake-auth-code');
  assert.equal(exchange.get('client_id'),GOOGLE.GOOGLE_CLIENT_ID);
  assert.equal(exchange.get('client_secret'),GOOGLE.GOOGLE_CLIENT_SECRET,'The secret is used server side only, at the token endpoint');
  assert.equal(exchange.get('redirect_uri'),'https://shop.example/api/auth/google/callback');
  assert.equal(db.users.length,1);
  const user=db.users[0];
  assert.equal(user.email,'new@example.com','The email is stored normalized');
  assert.equal(user.display_name,'New Shopper');
  assert.ok(user.email_verified_at,'The Google created user is already verified');
  assert.equal(db.user_credentials.length,0,'A Google created user has no password');
  assert.deepEqual(db.user_identities.map(i=>[i.provider,i.subject,i.user_id,i.email]),[['google','google-sub-1',user.id,'new@example.com']]);
  assert.equal(db.sessions.length,1);
  assert.equal(db.oauth_states[0].used_at!==null,true,'The state is consumed');
  const me=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'='+token}),env);
  assert.deepEqual(await me.json(),{user:{id:user.id,email:'new@example.com',name:'New Shopper',emailVerified:true},enabled:true,googleEnabled:true});
  const replay=await callback(env,state);
  expectRefusal(replay,db,'A replayed callback');
  assert.equal(db.sessions.length,1,'The replay mints no second session');
  assert.equal(exchanges.length,before+1,'The replay never reaches the token endpoint');
 }
 // Callback, linking: an existing user with the same email gets
 // the identity linked, an unverified one is marked verified, and
 // a later sign in resolves through the identity row itself.
 {
  const db=new DB,env=fullEnv(db);
  db.users.push({id:'Uknown',email:'known@example.com',display_name:'Known Customer',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  db.users.push({id:'Uunverified',email:'unverified@example.com',display_name:null,email_verified_at:null,created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  let flow=await startFlow(env);
  nextIdToken=idToken(baseClaims({nonce:flow.nonce,sub:'google-sub-2',email:'known@example.com',name:'Known Customer'}));
  let r=await callback(env,flow.state);
  assert.equal(r.headers.get('Location'),'/account','No returnTo lands on /account');
  assert.equal(db.users.length,2,'Linking creates no user');
  assert.deepEqual(db.user_identities.map(i=>[i.subject,i.user_id]),[['google-sub-2','Uknown']]);
  flow=await startFlow(env);
  nextIdToken=idToken(baseClaims({nonce:flow.nonce,sub:'google-sub-2',email:'renamed@example.com',name:'A Different Name'}));
  r=await callback(env,flow.state);
  assert.equal(r.status,302);assert.ok(sessionOf(r),'The identity row signs its user in');
  assert.equal(db.users.length,2,'Identity resolution wins over the email');
  assert.equal(db.user_identities.length,1,'No second identity row appears');
  const me=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'='+sessionOf(r)}),env);
  assert.equal((await me.json()).user.id,'Uknown');
  flow=await startFlow(env);
  nextIdToken=idToken(baseClaims({nonce:flow.nonce,sub:'google-sub-3',email:'unverified@example.com'}));
  r=await callback(env,flow.state);
  assert.equal(r.status,302);
  const linked=db.users.find(u=>u.id==='Uunverified');
  assert.ok(linked.email_verified_at,'Linking marks an unverified user verified, as Google proved the mailbox');
  assert.deepEqual(db.user_identities.filter(i=>i.user_id==='Uunverified').map(i=>i.subject),['google-sub-3']);
 }
 // Refusals: every failure lands on /sign-in?error=google with no
 // session, no user and no identity, and an unknown or expired
 // state never reaches the token endpoint.
 {
  const db=new DB,env=fullEnv(db);
  let r=await callback(env,'a-state-that-was-never-minted');
  expectRefusal(r,db,'An unknown state');
  db.oauth_states.push({state_hash:hash('expired-state'),nonce_hash:hash('expired-nonce'),return_to:'/account',expires_at:iso(-60*1000),used_at:null,created_at:iso(-11*60*1000)});
  const beforeExpired=exchanges.length;
  nextIdToken=idToken(baseClaims({nonce:'expired-nonce'}));
  r=await callback(env,'expired-state');
  expectRefusal(r,db,'An expired state');
  assert.equal(exchanges.length,beforeExpired,'An expired state is refused before the exchange');
  const refusalWith=async(mutate,message)=>{
   const flow=await startFlow(env);
   nextIdToken=mutate(flow.nonce);
   const rr=await callback(env,flow.state);
   expectRefusal(rr,db,message);
   assert.ok(db.oauth_states[db.oauth_states.length-1].used_at,'The state is consumed even when the flow then fails: '+message);
  };
  await refusalWith(nonce=>idToken(baseClaims({nonce}),{key:attackerKeys.privateKey}),'A signature from the wrong key');
  await refusalWith(nonce=>idToken(baseClaims({nonce,kid:undefined}),{kid:'no-such-key'}),'An unknown signing key');
  await refusalWith(nonce=>idToken(baseClaims({nonce,aud:'someone-elses-client'})),'A token for another audience');
  await refusalWith(nonce=>idToken(baseClaims({nonce,exp:Math.floor(Date.now()/1000)-60})),'An expired token');
  await refusalWith(()=>idToken(baseClaims({nonce:'a-different-nonce'})),'A nonce that does not match the state');
  await refusalWith(nonce=>idToken(baseClaims({nonce,email_verified:false})),'An unverified Google email');
  await refusalWith(nonce=>idToken(baseClaims({nonce,email:undefined})),'A token with no email');
  const flow=await startFlow(env);exchangeOk=false;
  nextIdToken=idToken(baseClaims({nonce:flow.nonce}));
  r=await callback(env,flow.state);exchangeOk=true;
  expectRefusal(r,db,'A failed code exchange');
  assert.equal(db.users.length,0,'No refusal created a user');
  assert.equal(db.user_identities.length,0,'No refusal created an identity');
  assert.equal(db.sessions.length,0,'No refusal created a session');
 }
 // Set a password: the Google created user sets a first password
 // through change password with no current password to check, and
 // can then sign in with email and password. Once a password
 // exists, the current password check applies again.
 {
  const db=new DB,env=fullEnv(db);
  const flow=await startFlow(env);
  nextIdToken=idToken(baseClaims({nonce:flow.nonce,sub:'google-sub-9',email:'setpass@example.com',name:'Set Pass'}));
  const r=await callback(env,flow.state);
  const cookie=SESSION_COOKIE+'='+sessionOf(r);
  const PASS='a first password phrase 7';
  const changed=await accounts(req('/api/auth/change-password',{method:'POST',cookie,body:{newPassword:PASS}}),env);
  assert.equal(changed.status,200,'Setting a first password needs no current password');
  assert.equal(db.user_credentials.length,1,'The credential row is created');
  const rotated=SESSION_COOKIE+'='+sessionOf(changed);assert.ok(sessionOf(changed),'The session rotates on password set');
  const wrong=await accounts(req('/api/auth/change-password',{method:'POST',cookie:rotated,body:{currentPassword:'not the password 123',newPassword:'another new passphrase 9'}}),env);
  assert.equal(wrong.status,401,'Once a password exists, a wrong current password is refused');
  await accounts(req('/api/auth/sign-out',{method:'POST',cookie:rotated,body:{}}),env);
  const signIn=await accounts(req('/api/auth/sign-in',{method:'POST',body:{email:'setpass@example.com',password:PASS}}),env);
  assert.equal(signIn.status,200,'The Google created user can now sign in with email and password');
  assert.equal((await signIn.json()).user.email,'setpass@example.com');
 }
 console.log('Google sign in checks passed: the gates and the me payload report googleEnabled, start mints hash only state with a validated returnTo and a 10 minute life, callback verifies RS256 id tokens against the JWKS (signature, issuer, audience, expiry, nonce) before resolving identity (existing identity, link by verified email with verification upgrade, or a new verified user with no password), every refusal lands on /sign-in?error=google with no session, state is single use, and a Google created user can set a first password and sign in with it (package 5.7).');
})().catch(e=>{console.error(e);process.exit(1)});
