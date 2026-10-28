const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),crypto=require('node:crypto');
const path=require('node:path'),file=path.resolve('lib/accounts.ts'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);const {accounts,accountsEnabled,googleEnabled,resolveOwner,SESSION_COOKIE}=m.exports;
// Package 5.6: commerce adopts the shared resolver, so journey A5
// drives the real commerce dispatcher too. Its import of
// lib/accounts.ts resolves through Node's TypeScript support; the
// two copies share state only through the env's fake D1, exactly
// as two route handlers share the real database.
const commerceFile=path.resolve('lib/commerce.ts'),cm=new Module(commerceFile,module);cm.filename=commerceFile;cm.paths=module.paths;
cm._compile(ts.transpileModule(fs.readFileSync(commerceFile,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,commerceFile);const {commerce}=cm.exports;
// Generic fake D1 for the statement shapes lib/accounts.ts issues:
// single table SELECT, INSERT, UPDATE and DELETE with equality (or
// not-equal) conditions on bound values and NULL literals. Rows are
// plain objects in per table arrays, so tests can also seed and
// inspect state directly, as the package 5.1 suite did.
function matchWhere(row,where,args){if(!where)return true;let ai=0;return where.split(' AND ').every(cond=>{const c=cond.trim().match(/^(\w+)(=|<>)(\?|NULL)$/);if(!c)throw Error('Fake DB cannot parse condition: '+cond);if(c[3]==='NULL')return c[2]==='='?(row[c[1]]===null||row[c[1]]===undefined):!(row[c[1]]===null||row[c[1]]===undefined);const v=args[ai++];return c[2]==='='?row[c[1]]===v:row[c[1]]!==v;});}
class DB{
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
// The mailer is stubbed exactly as tests/commerce.cjs stubs the
// payment provider: every fetch must be the account email POST to
// EMAIL_API_URL, and the sent mail is captured for the journeys.
// Package 5.6 also drives lib/commerce.ts for journey A5, so the
// stub answers the Authorize.Net hosted page request the same way
// tests/commerce.cjs does.
const sentMail=[];
global.fetch=async(url,init)=>{if(url===EMAIL.EMAIL_API_URL){sentMail.push(JSON.parse(init.body));return Response.json({ok:true});}if(String(url).includes('authorize.net')){const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest)return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'});}throw Error('Unexpected network request: '+url);};
const mailTo=email=>sentMail.filter(m=>m.to===email);
const tokenFromMail=(email,page)=>{const list=mailTo(email);for(let i=list.length-1;i>=0;i--){const hit=list[i].text.match(new RegExp(page+'\\?token=([A-Za-z0-9_-]+)'));if(hit)return hit[1];}return null;};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const DAY=24*60*60*1000,HOUR=60*60*1000,iso=ms=>new Date(Date.now()+ms).toISOString();
const EMAIL={EMAIL_API_URL:'https://mail.example/send',EMAIL_API_KEY:'test-mail-key',EMAIL_FROM:'Suits.me <accounts@example.com>'};
const GOOGLE={GOOGLE_CLIENT_ID:'test-client-id',GOOGLE_CLIENT_SECRET:'test-client-secret'};
const req=(route,{method='GET',cookie,owner,body,origin,ip,headers={}}={})=>new Request('https://shop.example'+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(owner?{'oai-authenticated-user-id':owner}:{}),...(method==='POST'&&origin!==null?{Origin:origin||'https://shop.example'}:{}),...(ip?{'cf-connecting-ip':ip}:{}),...headers,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const post=(route,body,opts={})=>accounts(req(route,{method:'POST',body,...opts}),opts.env);
const sessionOf=r=>{const m=(r.headers.get('Set-Cookie')||'').match(/suitsme-session=([^;]+)/);return m?m[1]:null;};
const cookieOf=r=>SESSION_COOKIE+'='+sessionOf(r);
const userRow=(over={})=>({id:'U0123456789abcdef0123456789abcdef',email:'tester@example.com',display_name:'Test Customer',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null,...over});
const sessionRow=(token,over={})=>({token_hash:hash(token),user_id:'U0123456789abcdef0123456789abcdef',created_at:iso(-DAY),last_seen_at:iso(0),expires_at:iso(29*DAY),...over});
const PASS='correct horse battery staple',PASS2='a brand new passphrase 42',WRONG='wrong password attempt';
(async()=>{
 // A8, gating: the gates themselves.
 assert.equal(accountsEnabled({}),false,'No DB and no email settings: accounts disabled');
 assert.equal(accountsEnabled({DB:new DB}),false,'DB alone does not enable accounts');
 assert.equal(accountsEnabled({DB:new DB,EMAIL_API_URL:EMAIL.EMAIL_API_URL}),false,'Partial email settings do not enable accounts');
 assert.equal(accountsEnabled({DB:new DB,...EMAIL,EMAIL_FROM:''}),false,'An empty email setting does not enable accounts');
 assert.equal(accountsEnabled({DB:new DB,...EMAIL}),true,'DB plus all three email settings enables accounts');
 assert.equal(googleEnabled({DB:new DB,...EMAIL}),false,'Google stays disabled without its settings');
 assert.equal(googleEnabled({DB:new DB,...GOOGLE}),false,'Google settings without email settings do not enable Google');
 assert.equal(googleEnabled({DB:new DB,...EMAIL,...GOOGLE}),true,'Email plus Google settings enables Google');
 // A8, gating: with email settings absent every auth and account route
 // returns 503, except me, which reports the disabled state at 200 so
 // the client can hide the entry points.
 for(const env of [{},{DB:new DB}]){
  for(const [route,method] of [['/api/auth/register','POST'],['/api/auth/sign-in','POST'],['/api/auth/sign-out','POST'],['/api/account/profiles','GET'],['/api/account/import','POST'],['/api/account/orders','GET']]){
   const r=await accounts(req(route,{method}),env);assert.equal(r.status,503,route+' is gated off');assert.deepEqual(await r.json(),{error:'Accounts are not enabled yet.'});
  }
  const me=await accounts(req('/api/auth/me'),env);assert.equal(me.status,200);assert.deepEqual(await me.json(),{user:null,enabled:false});
  assert.equal(me.headers.get('Cache-Control'),'no-store','Account responses are never cached');
 }
 // Enabled skeleton: me answers for guests, and paths whose bodies land
 // in later packages are an honest 404 rather than a stubbed success.
 const db=new DB,enabled={DB:db,...EMAIL};
 let r=await accounts(req('/api/auth/me'),enabled);assert.equal(r.status,200);assert.deepEqual(await r.json(),{user:null,enabled:true});
 r=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'=no-such-token'}),enabled);assert.deepEqual(await r.json(),{user:null,enabled:true},'An unknown session cookie reads as a guest');
 assert.equal((await accounts(req('/api/account/profiles'),enabled)).status,401,'The profiles API (package 5.5) requires a session; a guest reads as 401');
 assert.equal((await accounts(req('/api/account/orders'),enabled)).status,401,'The account orders API (package 5.6) requires a session; a guest reads as 401');
 assert.equal((await accounts(req('/api/auth/google/start'),enabled)).status,503,'Google routes stay gated off without Google settings');
 // Session validation through me.
 db.users.push(userRow());db.sessions.push(sessionRow('test-session-token'));
 r=await accounts(req('/api/auth/me',{cookie:'other=1; '+SESSION_COOKIE+'=test-session-token'}),enabled);
 assert.deepEqual(await r.json(),{user:{id:'U0123456789abcdef0123456789abcdef',email:'tester@example.com',name:'Test Customer',emailVerified:true},enabled:true},'A valid session cookie returns the user');
 const touched=db.sessions[0].last_seen_at;
 db.sessions[0]=sessionRow('idle-touch-token',{created_at:iso(-3*DAY),last_seen_at:iso(-2*DAY),expires_at:iso(27*DAY)});
 r=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'=idle-touch-token'}),enabled);assert.equal((await r.json()).user.email,'tester@example.com');
 assert.ok(Date.parse(db.sessions[0].last_seen_at)>Date.parse(iso(-2*DAY)),'last_seen_at advances on use, at most once a day');assert.notEqual(db.sessions[0].last_seen_at,touched);
 db.sessions.push(sessionRow('expired-token',{created_at:iso(-31*DAY),last_seen_at:iso(-2*DAY),expires_at:iso(-DAY)}));
 r=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'=expired-token'}),enabled);assert.equal((await r.json()).user,null,'An absolutely expired session reads as a guest');
 assert.ok(!db.sessions.some(s=>s.token_hash===hash('expired-token')),'Expired sessions are deleted on use');
 db.sessions.push(sessionRow('idle-token',{created_at:iso(-20*DAY),last_seen_at:iso(-15*DAY),expires_at:iso(10*DAY)}));
 r=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'=idle-token'}),enabled);assert.equal((await r.json()).user,null,'A session idle for more than 14 days reads as a guest');
 assert.ok(!db.sessions.some(s=>s.token_hash===hash('idle-token')),'Idle expired sessions are deleted on use');
 db.users.push(userRow({id:'Ufedcba9876543210fedcba9876543210',email:'gone@example.com',deleted_at:iso(-DAY)}));
 db.sessions.push(sessionRow('deleted-user-token',{user_id:'Ufedcba9876543210fedcba9876543210'}));
 r=await accounts(req('/api/auth/me',{cookie:SESSION_COOKIE+'=deleted-user-token'}),enabled);assert.equal((await r.json()).user,null,'A deleted user has no live session');
 assert.ok(!db.sessions.some(s=>s.token_hash===hash('deleted-user-token')),'Sessions of deleted users are removed');
 // Owner resolution (design section 1.1): app session first, keyed
 // app:<user id>; then the gateway header; then guest. Package 5.6
 // wires this resolver into checkout (journey A5); the commerce suite
 // keeps covering the header path until then.
 db.sessions.push(sessionRow('test-session-token'));
 let resolved=await resolveOwner(req('/api/auth/me',{cookie:SESSION_COOKIE+'=test-session-token'}),enabled);
 assert.equal(resolved.owner,'app:U0123456789abcdef0123456789abcdef');assert.equal(resolved.user.email,'tester@example.com');
 resolved=await resolveOwner(req('/api/auth/me',{owner:'gateway-user-1'}),enabled);assert.deepEqual(resolved,{owner:'gateway-user-1',user:null});
 resolved=await resolveOwner(req('/api/auth/me',{cookie:SESSION_COOKIE+'=test-session-token',owner:'gateway-user-1'}),enabled);
 assert.equal(resolved.owner,'app:U0123456789abcdef0123456789abcdef','The app session wins when both identities are present');
 resolved=await resolveOwner(req('/api/auth/me'),enabled);assert.deepEqual(resolved,{owner:null,user:null},'Neither identity means guest');

 // A1, lifecycle: register returns the uniform 202 and creates no
 // session; the emailed token verifies the account and mints the
 // first session; sign out kills it; sign in returns a fresh,
 // different token.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const reg=await post('/api/auth/register',{name:'Ada Lovelace',email:'Ada@Example.com',password:PASS},{env});
  assert.equal(reg.status,202);assert.deepEqual(await reg.json(),{ok:true,message:'Check your email to finish creating your account.'});
  assert.equal(reg.headers.get('Set-Cookie'),null,'Registration sets no session cookie');
  assert.equal(db.sessions.length,0,'Registration creates no session');
  assert.equal(db.users.length,1);assert.equal(db.users[0].email,'ada@example.com','Email is stored trimmed and lower cased');
  assert.equal(db.users[0].display_name,'Ada Lovelace');assert.equal(db.users[0].email_verified_at,null);
  const stored=db.user_credentials[0].password_hash;
  assert.match(stored,/^pbkdf2-sha256:600000:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/,'Stored hash is the self describing 600,000 iteration format');
  assert.equal(mailTo('ada@example.com').length,1,'One verification email is sent');
  assert.equal(mailTo('ada@example.com')[0].subject,'Confirm your email for your Suits.me account');
  const token=tokenFromMail('ada@example.com','/verify-email');assert.ok(token,'The verification email carries a token link');
  assert.equal(db.auth_tokens.length,1);assert.equal(db.auth_tokens[0].purpose,'verify');
  assert.equal(db.auth_tokens[0].token_hash,hash(token),'Only the SHA-256 hash of the token is stored');
  assert.ok(Math.abs(Date.parse(db.auth_tokens[0].expires_at)-(Date.now()+24*HOUR))<60000,'Verify tokens live 24 hours');
  // Sign in before verification: the correct password reaches the 403
  // and resends the link; a wrong one is the uniform 401.
  const early=await post('/api/auth/sign-in',{email:'ada@example.com',password:PASS},{env});
  assert.equal(early.status,403);assert.deepEqual(await early.json(),{error:'Please confirm your email first. We have sent you a new link.'});
  assert.equal(mailTo('ada@example.com').length,2,'The unverified sign in resends the verification email');
  const earlyWrong=await post('/api/auth/sign-in',{email:'ada@example.com',password:WRONG},{env});
  assert.equal(earlyWrong.status,401,'A wrong password on an unverified account is still the uniform 401');
  const freshToken=tokenFromMail('ada@example.com','/verify-email');assert.ok(freshToken&&freshToken!==token,'The resend mints a fresh token');
  const stale=await post('/api/auth/verify-email',{token},{env});
  assert.equal(stale.status,400,'A replaced verify token no longer works');
  const ver=await post('/api/auth/verify-email',{token:freshToken},{env});
  assert.equal(ver.status,200);const verBody=await ver.json();
  assert.deepEqual(verBody.user,{id:db.users[0].id,email:'ada@example.com',name:'Ada Lovelace',emailVerified:true});
  const firstSession=sessionOf(ver);assert.ok(firstSession,'Verification mints the first session');
  assert.match(firstSession,/^[A-Za-z0-9_-]{43}$/,'The session token is 32 random bytes, base64url');
  assert.ok((ver.headers.get('Set-Cookie')||'').includes('HttpOnly; Secure; SameSite=Lax; Path=/'),'The session cookie carries the design attributes');
  assert.ok(db.sessions.some(s=>s.token_hash===hash(firstSession)),'Only the session token hash is stored');
  assert.ok(db.users[0].email_verified_at,'Verification sets email_verified_at');
  assert.ok(db.auth_tokens.find(t=>t.token_hash===hash(freshToken)).used_at,'The verify token is consumed');
  const again=await post('/api/auth/verify-email',{token:freshToken},{env});
  assert.equal(again.status,400,'A verify token cannot be used twice');
  let me=await accounts(req('/api/auth/me',{cookie:cookieOf(ver)}),env);assert.equal((await me.json()).user.email,'ada@example.com');
  const out=await post('/api/auth/sign-out',{},{env,cookie:cookieOf(ver)});
  assert.equal(out.status,200);assert.deepEqual(await out.json(),{ok:true});
  assert.ok((out.headers.get('Set-Cookie')||'').includes('Max-Age=0'),'Sign out clears the cookie');
  assert.equal(db.sessions.length,0,'Sign out deletes the session row');
  me=await accounts(req('/api/auth/me',{cookie:cookieOf(ver)}),env);assert.equal((await me.json()).user,null,'The signed out cookie reads as a guest');
  const inR=await post('/api/auth/sign-in',{email:'ada@example.com',password:PASS},{env});
  assert.equal(inR.status,200);assert.deepEqual((await inR.json()).user,verBody.user);
  const secondSession=sessionOf(inR);assert.ok(secondSession&&secondSession!==firstSession,'Sign in returns a fresh, different session token');
 }

 // A2, enumeration: unknown email, wrong password and lockout are
 // byte identical; register and forgot password return identical 202
 // bodies for existing and non existing emails; bad verify and reset
 // tokens share one 400 body.
 {
  const db=new DB,env={DB:db,...EMAIL};
  await post('/api/auth/register',{name:'Grace',email:'grace@example.com',password:PASS},{env});
  await post('/api/auth/verify-email',{token:tokenFromMail('grace@example.com','/verify-email')},{env});
  const unknown=await post('/api/auth/sign-in',{email:'nobody@example.com',password:WRONG},{env});
  const wrong=await post('/api/auth/sign-in',{email:'grace@example.com',password:WRONG},{env});
  assert.equal(unknown.status,401);assert.equal(wrong.status,401);
  const unknownBody=await unknown.text(),wrongBody=await wrong.text();
  assert.equal(unknownBody,wrongBody,'Unknown email and wrong password are byte identical');
  assert.equal(unknownBody,JSON.stringify({error:'Email or password is not correct.'}));
  const regNew=await post('/api/auth/register',{name:'New',email:'new@example.com',password:PASS},{env});
  const regKnown=await post('/api/auth/register',{name:'Grace',email:'grace@example.com',password:PASS},{env});
  assert.equal(regNew.status,202);assert.equal(regKnown.status,202);
  assert.equal(await regNew.text(),await regKnown.text(),'Register is identical for new and existing emails');
  assert.equal(db.users.filter(u=>u.email==='grace@example.com').length,1,'Registering a verified email creates nothing');
  const notice=mailTo('grace@example.com').filter(m=>m.subject.includes('tried to register'));
  assert.equal(notice.length,1,'The account owner gets the registration notice email');
  const forgotKnown=await post('/api/auth/forgot-password',{email:'grace@example.com'},{env});
  const forgotUnknown=await post('/api/auth/forgot-password',{email:'ghost@example.com'},{env});
  assert.equal(forgotKnown.status,202);assert.equal(forgotUnknown.status,202);
  assert.equal(await forgotKnown.text(),await forgotUnknown.text(),'Forgot password is identical for known and unknown emails');
  assert.equal(mailTo('ghost@example.com').length,0,'No reset email is sent for an unknown email');
  assert.ok(tokenFromMail('grace@example.com','/reset-password'),'A reset email is sent for the verified account');
  const badVerify=await post('/api/auth/verify-email',{token:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'},{env});
  const badReset=await post('/api/auth/reset-password',{token:'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',password:PASS2},{env});
  assert.equal(badVerify.status,400);assert.equal(badReset.status,400);
  assert.equal(await badVerify.text(),await badReset.text(),'Bad verify and reset tokens share one body');
  assert.equal(await (await post('/api/auth/verify-email',{token:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'},{env})).text(),JSON.stringify({error:'This link is invalid or has expired.'}));
 }

 // A3, lockout: five failed sign ins lock the submitted email for 15
 // minutes; the correct password during lockout still returns the
 // uniform 401; a different email is unaffected until the IP
 // threshold is reached.
 {
  const db=new DB,env={DB:db,...EMAIL};
  await post('/api/auth/register',{name:'Lock',email:'lock@example.com',password:PASS},{env});
  await post('/api/auth/verify-email',{token:tokenFromMail('lock@example.com','/verify-email')},{env});
  await post('/api/auth/register',{name:'Other',email:'other@example.com',password:PASS},{env});
  await post('/api/auth/verify-email',{token:tokenFromMail('other@example.com','/verify-email')},{env});
  const ip='203.0.113.9';
  for(let i=0;i<4;i++)assert.equal((await post('/api/auth/sign-in',{email:'lock@example.com',password:WRONG},{env,ip})).status,401);
  const cleared=await post('/api/auth/sign-in',{email:'lock@example.com',password:PASS},{env,ip});
  assert.equal(cleared.status,200,'Four failures do not lock, and success clears the counter');
  await post('/api/auth/sign-out',{},{env,cookie:cookieOf(cleared)});
  for(let i=0;i<5;i++)assert.equal((await post('/api/auth/sign-in',{email:'lock@example.com',password:WRONG},{env,ip})).status,401);
  const lockRow=db.auth_attempts.find(a=>a.key==='signin:email:lock@example.com');
  assert.ok(lockRow&&lockRow.locked_until&&Date.parse(lockRow.locked_until)>Date.now(),'Five failures lock the email key');
  assert.ok(Math.abs(Date.parse(lockRow.locked_until)-(Date.now()+15*60*1000))<60000,'The lock lasts 15 minutes');
  const during=await post('/api/auth/sign-in',{email:'lock@example.com',password:PASS},{env,ip});
  assert.equal(during.status,401,'The correct password during lockout is refused');
  assert.equal(await during.text(),JSON.stringify({error:'Email or password is not correct.'}),'Lockout returns the uniform 401 body');
  const other=await post('/api/auth/sign-in',{email:'other@example.com',password:PASS},{env,ip});
  assert.equal(other.status,200,'A different email from the same IP is unaffected below the IP threshold');
  for(let i=0;i<15;i++)await post('/api/auth/sign-in',{email:'nobody'+i+'@example.com',password:WRONG},{env,ip});
  const ipRow=db.auth_attempts.find(a=>a.key==='signin:ip:'+ip);
  assert.ok(ipRow&&ipRow.locked_until,'Twenty failures lock the IP key');
  const ipLocked=await post('/api/auth/sign-in',{email:'other@example.com',password:PASS},{env,ip});
  assert.equal(ipLocked.status,401,'Once the IP is locked, even a correct sign in from it is refused');
  const elsewhere=await post('/api/auth/sign-in',{email:'other@example.com',password:PASS},{env,ip:'198.51.100.2'});
  assert.equal(elsewhere.status,200,'The same account still signs in from another IP');
 }

 // A4, reset: forgot password issues a token; reset changes the
 // password, revokes all prior sessions, and the token cannot be
 // used twice. Change password follows the same discipline.
 {
  const db=new DB,env={DB:db,...EMAIL};
  await post('/api/auth/register',{name:'Reset',email:'reset@example.com',password:PASS},{env});
  const ver=await post('/api/auth/verify-email',{token:tokenFromMail('reset@example.com','/verify-email')},{env});
  const cookieA=cookieOf(ver);
  const inB=await post('/api/auth/sign-in',{email:'reset@example.com',password:PASS},{env});
  const cookieB=cookieOf(inB);assert.ok(cookieB&&cookieB!==cookieA);
  assert.equal(db.sessions.length,2,'Two live sessions before the reset');
  await post('/api/auth/forgot-password',{email:'reset@example.com'},{env});
  const resetToken=tokenFromMail('reset@example.com','/reset-password');assert.ok(resetToken);
  const tokenRow=db.auth_tokens.find(t=>t.token_hash===hash(resetToken));
  assert.equal(tokenRow.purpose,'reset');assert.ok(Math.abs(Date.parse(tokenRow.expires_at)-(Date.now()+HOUR))<60000,'Reset tokens live 1 hour');
  const reset=await post('/api/auth/reset-password',{token:resetToken,password:PASS2},{env});
  assert.equal(reset.status,200);assert.equal((await reset.json()).user.email,'reset@example.com');
  const cookieC=cookieOf(reset);assert.ok(cookieC&&cookieC!==cookieA&&cookieC!==cookieB,'Reset mints one fresh session');
  assert.equal(db.sessions.length,1,'Reset revokes every prior session');
  for(const old of [cookieA,cookieB]){const me=await accounts(req('/api/auth/me',{cookie:old}),env);assert.equal((await me.json()).user,null,'An old cookie returns null from me after reset');}
  const reuse=await post('/api/auth/reset-password',{token:resetToken,password:'yet another passphrase 7'},{env});
  assert.equal(reuse.status,400,'The reset token cannot be used twice');
  assert.equal((await post('/api/auth/sign-in',{email:'reset@example.com',password:PASS},{env})).status,401,'The old password stops working after reset');
  assert.equal((await post('/api/auth/sign-in',{email:'reset@example.com',password:PASS2},{env})).status,200,'The new password works after reset');
  // Change password: wrong current is the sign in 401 body; success
  // rotates the current session and deletes the others.
  const wrongCurrent=await post('/api/auth/change-password',{currentPassword:WRONG,newPassword:'replacement passphrase 9'},{env,cookie:cookieC});
  assert.equal(wrongCurrent.status,401);assert.deepEqual(await wrongCurrent.json(),{error:'Email or password is not correct.'});
  const guestChange=await post('/api/auth/change-password',{currentPassword:PASS2,newPassword:'replacement passphrase 9'},{env});
  assert.equal(guestChange.status,401);assert.deepEqual(await guestChange.json(),{error:'Please sign in to continue.'});
  const other=await post('/api/auth/sign-in',{email:'reset@example.com',password:PASS2},{env});
  const cookieD=cookieOf(other);assert.equal(db.sessions.length,3);
  const changed=await post('/api/auth/change-password',{currentPassword:PASS2,newPassword:'replacement passphrase 9'},{env,cookie:cookieC});
  assert.equal(changed.status,200);
  const cookieE=cookieOf(changed);assert.ok(cookieE&&cookieE!==cookieC&&cookieE!==cookieD,'Change password rotates the session');
  assert.equal(db.sessions.length,1,'Change password deletes the other sessions');
  for(const old of [cookieC,cookieD]){const me=await accounts(req('/api/auth/me',{cookie:old}),env);assert.equal((await me.json()).user,null,'Rotated away cookies are dead');}
  assert.equal((await post('/api/auth/sign-in',{email:'reset@example.com',password:PASS2},{env})).status,401,'The previous password stops working after a change');
  assert.equal((await post('/api/auth/sign-in',{email:'reset@example.com',password:'replacement passphrase 9'},{env})).status,200,'The changed password works');
 }

 // A7, CSRF: every auth POST with a foreign or missing origin returns
 // 403 and changes no state. A matching Referer is the documented
 // fallback when Origin is absent.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const foreign={env,origin:'https://evil.example'};
  const r1=await post('/api/auth/register',{name:'Csrf',email:'csrf@example.com',password:PASS},foreign);
  assert.equal(r1.status,403);assert.deepEqual(await r1.json(),{error:'Invalid request origin.'});
  assert.equal(db.users.length,0,'A foreign origin register creates no user');
  const noOrigin=await post('/api/auth/register',{name:'Csrf',email:'csrf@example.com',password:PASS},{env,origin:null});
  assert.equal(noOrigin.status,403,'Neither Origin nor Referer on a POST is rejected');
  assert.equal(db.users.length,0,'A missing origin register creates no user');
  const refererOk=await post('/api/auth/register',{name:'Csrf',email:'csrf@example.com',password:PASS},{env,origin:null,headers:{Referer:'https://shop.example/register'}});
  assert.equal(refererOk.status,202,'A same origin Referer is accepted when Origin is absent');
  assert.equal(db.users.length,1);
  const token=tokenFromMail('csrf@example.com','/verify-email');
  const vForeign=await post('/api/auth/verify-email',{token},{env,origin:'https://evil.example'});
  assert.equal(vForeign.status,403);assert.equal(db.auth_tokens[0].used_at,null,'A foreign origin verify consumes no token');
  assert.equal(db.sessions.length,0,'A foreign origin verify creates no session');
  const sForeign=await post('/api/auth/sign-in',{email:'csrf@example.com',password:PASS},{env,origin:'https://evil.example'});
  assert.equal(sForeign.status,403);assert.equal(db.sessions.length,0,'A foreign origin sign in creates no session');
  for(const route of ['/api/auth/sign-out','/api/auth/forgot-password','/api/auth/reset-password','/api/auth/change-password','/api/auth/resend-verification']){
   const rr=await post(route,{email:'csrf@example.com',token,password:PASS,currentPassword:PASS,newPassword:PASS2},{env,origin:'https://evil.example'});
   assert.equal(rr.status,403,route+' rejects a foreign origin');
  }
  assert.equal(db.users[0].email_verified_at,null,'No CSRF attempt changed any state');
 }

 // A7 completed (package 5.8 parity gate audit): the design asks
 // for every POST under /api/auth/* and /api/account/*, with a
 // foreign or a missing origin, to return 403 and change no state.
 // The block above proves the foreign origin status for every auth
 // route and the missing origin status for register, with state
 // assertions on the routes it drives individually, and A6 proves
 // the foreign origin status for the two account POSTs. What was
 // not yet proven end to end: the missing origin case on the
 // remaining routes, and a whole surface state assertion. This
 // block closes both: every auth and account POST is driven with
 // a missing origin and with a foreign origin against a live
 // session, with the database and the mail outbox snapshotted
 // before and after, so "changes no state" is asserted across the
 // surface, not sampled.
 {
  const db=new DB,env={DB:db,...EMAIL};
  await post('/api/auth/register',{name:'Gap',email:'gap@example.com',password:PASS},{env});
  const ver=await post('/api/auth/verify-email',{token:tokenFromMail('gap@example.com','/verify-email')},{env});
  assert.equal(ver.status,200);
  const cookie=cookieOf(ver);
  const snapshot=()=>JSON.stringify([db.users.length,db.user_credentials.length,db.sessions.length,db.auth_tokens.length,db.account_profiles.length,db.account_order_snapshots.length,db.users[0].email_verified_at,db.user_credentials[0].password_hash,sentMail.length]);
  const before=snapshot();
  const body={name:'Gap',email:'gap@example.com',token:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',password:PASS2,currentPassword:PASS,newPassword:PASS2,profile:{id:'gap-1',name:'Gap profile',method:'ready',wearer:'Men',ready:{jacket:'40',length:'Regular',trouser:'34'}},profiles:[],orders:[]};
  for(const origin of [null,'https://evil.example']){
   for(const route of ['/api/auth/register','/api/auth/verify-email','/api/auth/resend-verification','/api/auth/sign-in','/api/auth/sign-out','/api/auth/forgot-password','/api/auth/reset-password','/api/auth/change-password']){
    const rr=await post(route,body,{env,cookie,origin});
    assert.equal(rr.status,403,route+' rejects a '+(origin?'foreign':'missing')+' origin even with a live session');
   }
   for(const route of ['/api/account/profiles','/api/account/import']){
    const rr=await post(route,body,{env,cookie,origin});
    assert.equal(rr.status,403,route+' rejects a '+(origin?'foreign':'missing')+' origin even with a live session');
   }
  }
  assert.equal(snapshot(),before,'Every rejected POST across the auth and account surface changed no state: no user, credential, session, token, profile, snapshot or email');
  const me=await accounts(req('/api/auth/me',{cookie}),env);
  assert.equal((await me.json()).user.email,'gap@example.com','The session survives the rejected sign out attempts');
  assert.equal((await post('/api/auth/sign-in',{email:'gap@example.com',password:PASS},{env})).status,200,'The password survives the rejected change attempts');
 }

 // Password policy, the unverified re-register path, resend, send
 // caps and the parameter upgrade rehash.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const short=await post('/api/auth/register',{name:'Pol',email:'pol@example.com',password:'short'},{env});
  assert.equal(short.status,400);assert.deepEqual(await short.json(),{error:'Please use a password of at least 12 characters.'});
  const common=await post('/api/auth/register',{name:'Pol',email:'pol@example.com',password:'password1234'},{env});
  assert.equal(common.status,400);assert.deepEqual(await common.json(),{error:'That password is too common. Try a longer phrase.'});
  const asEmail=await post('/api/auth/register',{name:'Pol',email:'pol@example.com',password:'pol@example.com'},{env});
  assert.equal(asEmail.status,400);assert.deepEqual(await asEmail.json(),{error:'Your password cannot be your email address.'});
  assert.equal(db.users.length,0,'Policy failures create no account');
  const badMail=await post('/api/auth/register',{name:'Pol',email:'not-an-email',password:PASS},{env});
  assert.equal(badMail.status,202,'A malformed email still returns the uniform 202');assert.equal(db.users.length,0);
  // Re-registering an unverified email replaces the password, so the
  // mailbox owner completes registration with the newest password.
  await post('/api/auth/register',{name:'Sq',email:'squat@example.com',password:'first passphrase 111'},{env});
  const squatterToken=tokenFromMail('squat@example.com','/verify-email');
  const reReg=await post('/api/auth/register',{name:'Real Owner',email:'squat@example.com',password:'second passphrase 222'},{env});
  assert.equal(reReg.status,202);assert.equal(db.users.filter(u=>u.email==='squat@example.com').length,1,'Re-registering creates no second account');
  assert.equal(db.users.find(u=>u.email==='squat@example.com').display_name,'Real Owner');
  const ownerToken=tokenFromMail('squat@example.com','/verify-email');
  assert.ok(ownerToken&&ownerToken!==squatterToken,'Re-registering mints a fresh verify token');
  assert.equal((await post('/api/auth/verify-email',{token:squatterToken},{env})).status,400,'The squatter token is replaced');
  assert.equal((await post('/api/auth/verify-email',{token:ownerToken},{env})).status,200);
  assert.equal((await post('/api/auth/sign-in',{email:'squat@example.com',password:'first passphrase 111'},{env})).status,401,'The replaced password no longer works');
  assert.equal((await post('/api/auth/sign-in',{email:'squat@example.com',password:'second passphrase 222'},{env})).status,200,'The newest password completes the registration');
  // Resend verification: uniform 202 for any email; a fresh token is
  // sent only for an unverified account.
  await post('/api/auth/register',{name:'Re',email:'resend@example.com',password:PASS},{env});
  const before=tokenFromMail('resend@example.com','/verify-email');
  const resend=await post('/api/auth/resend-verification',{email:'resend@example.com'},{env});
  assert.equal(resend.status,202);const resendText=await resend.text();
  assert.deepEqual(JSON.parse(resendText),{ok:true,message:'Check your email to finish creating your account.'});
  const after=tokenFromMail('resend@example.com','/verify-email');
  assert.ok(after&&after!==before,'Resend mints and emails a fresh token');
  const resendGhost=await post('/api/auth/resend-verification',{email:'ghost2@example.com'},{env});
  assert.equal(resendGhost.status,202);assert.equal(resendText,await resendGhost.text(),'Resend is identical for unknown emails');
  assert.equal(mailTo('ghost2@example.com').length,0);
  assert.equal((await post('/api/auth/verify-email',{token:after},{env})).status,200,'The resent token verifies the account');
  // Send caps: at most 3 sends per email per hour across the shared
  // key space; a capped request still returns its uniform response.
  await post('/api/auth/forgot-password',{email:'resend@example.com'},{env});
  await post('/api/auth/forgot-password',{email:'resend@example.com'},{env});
  const sentBefore=mailTo('resend@example.com').length;
  const capped=await post('/api/auth/forgot-password',{email:'resend@example.com'},{env});
  assert.equal(capped.status,202,'A capped forgot password still returns the uniform 202');
  assert.equal(mailTo('resend@example.com').length,sentBefore,'The fourth send inside the hour does not happen');
  // Parameter upgrade: a stored hash at old parameters is rehashed to
  // the current ones on a successful sign in.
  const crypto2=require('node:crypto');
  const salt=crypto2.randomBytes(16),oldBits=crypto2.pbkdf2Sync(PASS,salt,1000,32,'sha256');
  const oldHash='pbkdf2-sha256:1000:'+salt.toString('base64url')+':'+oldBits.toString('base64url');
  const uid='Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  db.users.push({id:uid,email:'old@example.com',display_name:'Old Timer',email_verified_at:iso(-DAY),created_at:iso(-DAY),updated_at:iso(-DAY),deleted_at:null});
  db.user_credentials.push({user_id:uid,password_hash:oldHash,password_updated_at:iso(-DAY)});
  const upgraded=await post('/api/auth/sign-in',{email:'old@example.com',password:PASS},{env});
  assert.equal(upgraded.status,200,'A hash at old parameters still verifies');
  assert.match(db.user_credentials.find(c=>c.user_id===uid).password_hash,/^pbkdf2-sha256:600000:/,'Sign in rehashes to the current parameters');
 }
 // A6, profiles and import (package 5.5, design sections 2.6 and
 // 5): upsert creates and replaces by client id, the stored copy
 // drops the transient step field, validation mirrors the commerce
 // profile checks, another user's profile id deletes as a plain
 // 404, and the migration import is idempotent by primary key,
 // storing local orders verbatim as demo snapshots.
 {
  const db=new DB,env={DB:db,...EMAIL};
  const uid2='Ufedcba9876543210fedcba9876543210';
  db.users.push(userRow(),userRow({id:uid2,email:'second@example.com'}));
  db.sessions.push(sessionRow('a6-token'),sessionRow('a6-token-2',{user_id:uid2}));
  const cookie=SESSION_COOKIE+'=a6-token',cookie2=SESSION_COOKIE+'=a6-token-2';
  const values={chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42};
  const prof=(id,over={})=>({id,name:'Profile '+id,method:'body',unit:'in',values:{...values},fit:'Tailored',wearer:'Men',created:'2026-01-0'+id.slice(-1)+'T00:00:00.000Z',...over});
  const list=async(c)=>{const r=await accounts(req('/api/account/profiles',{cookie:c}),env);assert.equal(r.status,200);return (await r.json()).profiles;};
  // Guests reach none of it.
  assert.equal((await accounts(req('/api/account/profiles'),env)).status,401,'Listing profiles as a guest is a 401');
  assert.equal((await post('/api/account/profiles',{profile:prof('prof-x')},{env})).status,401,'Saving a profile as a guest is a 401');
  assert.equal(db.account_profiles.length,0,'A guest save writes nothing');
  // Create through the upsert, with the wizard's transient step
  // field present in the posted object as the client sends it.
  const created=await post('/api/account/profiles',{profile:prof('prof-1',{step:3})},{env,cookie});
  assert.equal(created.status,200);
  const storedBack=(await created.json()).profile;
  assert.equal(storedBack.id,'prof-1');assert.ok(!('step' in storedBack),'The stored profile drops the transient step field');
  assert.equal(db.account_profiles.length,1);
  assert.ok(!('step' in JSON.parse(db.account_profiles[0].data)),'The stored JSON drops the step field too');
  assert.equal(db.account_profiles[0].created_at,'2026-01-01T00:00:00.000Z','The row creation time is the profile creation time');
  assert.deepEqual(await list(cookie),[storedBack],'The list returns the stored profile');
  assert.deepEqual(await list(cookie2),[],'Another account lists none of them');
  // Replace by id is the edit path: same id, new values, one row.
  const edited=await post('/api/account/profiles',{profile:prof('prof-1',{name:'Edited profile',values:{...values,chest:41}})},{env,cookie});
  assert.equal(edited.status,200);assert.equal((await edited.json()).profile.values.chest,41);
  assert.equal(db.account_profiles.length,1,'An edit replaces rather than duplicates');
  assert.equal(db.account_profiles[0].created_at,'2026-01-01T00:00:00.000Z','An edit keeps the original creation time');
  assert.ok(Date.parse(db.account_profiles[0].updated_at)>Date.parse(db.account_profiles[0].created_at),'The edit stamps a fresh updated_at');
  assert.equal((await list(cookie))[0].name,'Edited profile');
  // Validation mirrors cleanItems: out of range body values, an
  // unknown method or wearer, and out of range ready sizes refuse.
  for(const bad of [prof('bad-1',{values:{...values,chest:200}}),prof('bad-2',{values:{...values,waist:5}}),prof('bad-3',{method:'guess'}),prof('bad-4',{wearer:'Aliens'}),{id:'bad-5',name:'Ready',method:'ready',wearer:'Men',ready:{jacket:63,length:'Regular',trouser:34}},prof('bad-6',{values:{...values,thigh:'wide'}})]) {
   const r=await post('/api/account/profiles',{profile:bad},{env,cookie});
   assert.equal(r.status,400,'An invalid profile is refused: '+bad.id);assert.deepEqual(await r.json(),{error:'Please review your measurement profile.'});
  }
  assert.equal(db.account_profiles.length,1,'Invalid profiles write nothing');
  const readyOk=await post('/api/account/profiles',{profile:{id:'prof-ready',name:'Standard',method:'ready',unit:'in',wearer:'Men',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-02T00:00:00.000Z'}},{env,cookie});
  assert.equal(readyOk.status,200,'A valid standard size profile saves');
  assert.deepEqual((await list(cookie)).map(p=>p.id),['prof-1','prof-ready'],'The list is ordered by creation');
  // Delete: another user's id is an indistinguishable 404, the
  // owner's delete works, and a second delete is the same 404.
  const del=(id,c)=>accounts(req('/api/account/profiles/'+id,{method:'DELETE',cookie:c}),env);
  assert.equal((await del('prof-1',cookie2)).status,404,'Deleting another user profile id reads as not found');
  assert.equal(db.account_profiles.length,2,'The cross user delete removed nothing');
  assert.equal((await del('prof-1',cookie)).status,200);
  assert.deepEqual((await list(cookie)).map(p=>p.id),['prof-ready']);
  assert.equal((await del('prof-1',cookie)).status,404,'Deleting a missing profile is the same 404');
  // CSRF on the account POSTs (A7 extended): a foreign origin with
  // a valid session changes no state.
  const csrfSave=await post('/api/account/profiles',{profile:prof('prof-csrf')},{env,cookie,origin:'https://evil.example'});
  assert.equal(csrfSave.status,403);assert.ok(!db.account_profiles.some(p=>p.id==='prof-csrf'),'A foreign origin profile save writes nothing');
  const csrfImport=await post('/api/account/import',{profiles:[prof('prof-csrf')],orders:[]},{env,cookie,origin:'https://evil.example'});
  assert.equal(csrfImport.status,403);assert.equal(db.account_order_snapshots.length,0,'A foreign origin import writes nothing');
  // Import: three profiles and two demo orders in, counts back;
  // a repeat imports nothing and overwrites nothing.
  const order=(id,total)=>({id,created:'2026-01-03T00:00:00.000Z',items:[{name:'A suit'}],shipping:{city:'New York'},total,status:'Demo order recorded',demo:true});
  const imp=await post('/api/account/import',{profiles:[prof('imp-1'),prof('imp-2'),prof('imp-3')],orders:[order('DEMO-ONE',399),order('DEMO-TWO',449)]},{env,cookie});
  assert.equal(imp.status,200);assert.deepEqual(await imp.json(),{profilesImported:3,profilesSkipped:0,ordersImported:2,ordersSkipped:0});
  assert.equal(db.account_order_snapshots.length,2);
  const snap=db.account_order_snapshots.find(s=>s.id==='DEMO-ONE');
  assert.deepEqual(JSON.parse(snap.data),order('DEMO-ONE',399),'Snapshots store the local order verbatim, demo flag included');
  assert.ok(db.account_order_snapshots.every(s=>JSON.parse(s.data).demo===true),'Every snapshot keeps its demo marking');
  const again=await post('/api/account/import',{profiles:[prof('imp-1',{name:'Changed on another browser'}),prof('imp-2'),prof('imp-3')],orders:[order('DEMO-ONE',399),order('DEMO-TWO',449)]},{env,cookie});
  assert.deepEqual(await again.json(),{profilesImported:0,profilesSkipped:3,ordersImported:0,ordersSkipped:2},'A repeat import imports zero duplicates');
  assert.equal((await list(cookie)).find(p=>p.id==='imp-1').name,'Profile imp-1','An import never overwrites the stored copy');
  const mixed=await post('/api/account/import',{profiles:[prof('imp-1'),prof('imp-4')],orders:[order('DEMO-ONE',399),order('DEMO-THREE',199)]},{env,cookie});
  assert.deepEqual(await mixed.json(),{profilesImported:1,profilesSkipped:1,ordersImported:1,ordersSkipped:1},'A partial repeat imports only what is new');
  const badImport=await post('/api/account/import',{profiles:[prof('imp-9',{values:{...values,chest:200}})],orders:[]},{env,cookie});
  assert.equal(badImport.status,400,'An invalid profile refuses the import');
  assert.ok(!db.account_profiles.some(p=>p.id==='imp-9'),'A refused import writes nothing');
  assert.equal((await post('/api/account/import',{profiles:[prof('imp-8')],orders:[]},{env})).status,401,'Importing as a guest is a 401');
  // The same local profile imported by another account is that
  // account's own row: ids are only unique per user.
  const otherImp=await post('/api/account/import',{profiles:[prof('imp-1')],orders:[]},{env,cookie:cookie2});
  assert.deepEqual(await otherImp.json(),{profilesImported:1,profilesSkipped:0,ordersImported:0,ordersSkipped:0},'Import is keyed per account');
 }

 // A5, owner resolution through checkout (package 5.6, design
 // section 1.1): commerce adopts the shared resolver, so an app
 // session cookie keys the order app:<user id>, the gateway header
 // alone keys it exactly as before, both together resolve to the
 // app owner, and neither is the 401 of today. The merged account
 // orders endpoint then serves the app keyed rows with the user's
 // imported snapshots, badged as demo records, and nothing else:
 // gateway rows are never re keyed or claimed, and snapshots never
 // enter store_orders.
 {
  const db=new DB,shopEnv={DB:db,...EMAIL,ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64)};
  await post('/api/auth/register',{name:'Buyer',email:'buyer@example.com',password:PASS},{env:shopEnv});
  const buyerVerifyToken=tokenFromMail('buyer@example.com','/verify-email');
  const ver=await post('/api/auth/verify-email',{token:buyerVerifyToken},{env:shopEnv});
  assert.equal(ver.status,200);
  const buyerCookie=cookieOf(ver),buyerId=db.users.find(u=>u.email==='buyer@example.com').id;
  await post('/api/auth/register',{name:'Other',email:'other@example.com',password:PASS},{env:shopEnv});
  const otherVerifyToken=tokenFromMail('other@example.com','/verify-email');
  const verOther=await post('/api/auth/verify-email',{token:otherVerifyToken},{env:shopEnv});
  const otherCookie=cookieOf(verOther),otherId=db.users.find(u=>u.email==='other@example.com').id;
  const checkoutInput={items:[{product:16,price:1,profile:{name:'No measurements required',method:'none'}}],shipping:{email:'buyer@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'}};
  const buy=async({cookie,owner,key})=>{const headers={Origin:'https://shop.example','Content-Type':'application/json','Idempotency-Key':key};if(cookie)headers.Cookie=cookie;if(owner)headers['oai-authenticated-user-id']=owner;return commerce(new Request('https://shop.example/api/checkout',{method:'POST',headers,body:JSON.stringify(checkoutInput)}),shopEnv);};
  const readOrder=async(id,{cookie,owner}={})=>{const headers={};if(cookie)headers.Cookie=cookie;if(owner)headers['oai-authenticated-user-id']=owner;return commerce(new Request('https://shop.example/api/orders/'+id,{headers}),shopEnv);};
  const cookieOrder=await buy({cookie:buyerCookie,key:'a5-cookie-attempt-00001'});
  assert.equal(cookieOrder.status,200,'Checkout succeeds under the app session cookie alone');
  const cookieOrderId=(await cookieOrder.json()).orderId;
  assert.equal(db.store_orders.find(r=>r.id===cookieOrderId).owner,'app:'+buyerId,'The cookie checkout writes the order with owner app:<user id>');
  const bothOrder=await buy({cookie:buyerCookie,owner:'gateway-buyer-9',key:'a5-both-attempt-0000001'});
  assert.equal(bothOrder.status,200);
  const bothOrderId=(await bothOrder.json()).orderId;
  assert.equal(db.store_orders.find(r=>r.id===bothOrderId).owner,'app:'+buyerId,'With both identities present, the app owner wins');
  const gatewayOrder=await buy({owner:'gateway-buyer-9',key:'a5-gateway-attempt-0001'});
  assert.equal(gatewayOrder.status,200);
  const gatewayOrderId=(await gatewayOrder.json()).orderId;
  assert.equal(db.store_orders.find(r=>r.id===gatewayOrderId).owner,'gateway-buyer-9','The gateway header alone keys the order exactly as before the resolver');
  assert.equal((await buy({key:'a5-guest-attempt-000001'})).status,401,'With neither identity, checkout is the 401 of today');
  assert.equal(db.store_orders.length,3,'The guest attempt wrote no order');
  // Order read back (the payment return path): the cookie reads
  // its own orders, each identity is refused the other's, and the
  // gateway order is never claimed by the matching app account.
  const readBack=await readOrder(cookieOrderId,{cookie:buyerCookie});
  assert.equal(readBack.status,200,'The payment return read back works under cookie auth');
  assert.equal((await readBack.json()).total_cents,db.store_orders.find(r=>r.id===cookieOrderId).total_cents);
  assert.equal((await readOrder(cookieOrderId,{owner:'gateway-buyer-9'})).status,404,'The gateway identity cannot read the app order');
  assert.equal((await readOrder(gatewayOrderId,{owner:'gateway-buyer-9'})).status,200,'The gateway order still reads under its own header');
  assert.equal((await readOrder(gatewayOrderId,{cookie:buyerCookie})).status,404,'The app account does not claim the gateway order');
  assert.equal((await readOrder(cookieOrderId,{cookie:otherCookie})).status,404,'Another app account cannot read the order');
  // The merged account orders endpoint: real app keyed rows in the
  // store order shape, newest first, combined with the imported
  // snapshots marked demo and imported; the gateway row is absent.
  const demoOld={id:'DEMO-A5-OLD',created:'2026-01-02T00:00:00.000Z',items:[{product:16}],shipping:{email:'buyer@example.com'},total:100,status:'Demo order recorded',demo:true};
  const demoNew={id:'DEMO-A5-NEW',created:'2026-01-05T00:00:00.000Z',items:[{product:16}],shipping:{email:'buyer@example.com'},total:200,status:'Demo order recorded',demo:true};
  const imp=await post('/api/account/import',{profiles:[],orders:[demoOld,demoNew]},{env:shopEnv,cookie:buyerCookie});
  assert.deepEqual(await imp.json(),{profilesImported:0,profilesSkipped:0,ordersImported:2,ordersSkipped:0});
  const merged=await accounts(req('/api/account/orders',{cookie:buyerCookie}),shopEnv);
  assert.equal(merged.status,200);
  const mergedOrders=(await merged.json()).orders;
  assert.equal(mergedOrders.length,4,'The merged history holds the two real orders and the two snapshots, and no gateway row');
  assert.deepEqual(new Set([mergedOrders[0].id,mergedOrders[1].id]),new Set([cookieOrderId,bothOrderId]),'The real orders come first, newest first');
  assert.equal(mergedOrders[0].total_cents,db.store_orders.find(r=>r.id===mergedOrders[0].id).total_cents,'Real rows keep the store order shape');
  assert.equal(mergedOrders[0].demo,undefined,'Real rows carry no demo marking');
  assert.equal(mergedOrders[2].id,'DEMO-A5-NEW');assert.equal(mergedOrders[3].id,'DEMO-A5-OLD','Snapshots follow in their own date order');
  assert.equal(mergedOrders[2].demo,true);assert.equal(mergedOrders[2].imported,true,'Snapshots are marked demo and imported');
  assert.equal(mergedOrders[2].total,200,'Snapshot rows stay in the verbatim client shape');
  assert.ok(!mergedOrders.some(o=>o.id===gatewayOrderId),'The gateway order is not merged into the account history');
  const othersView=await accounts(req('/api/account/orders',{cookie:otherCookie}),shopEnv);
  assert.deepEqual((await othersView.json()).orders,[],'Another account sees none of this history');
  assert.equal((await accounts(req('/api/account/orders'),shopEnv)).status,401,'A guest is refused the account orders endpoint');
  assert.ok(db.store_orders.every(r=>!String(r.id).startsWith('DEMO')),'Snapshots never enter store_orders');
  assert.equal(db.store_orders.find(r=>r.id===gatewayOrderId).owner,'gateway-buyer-9','The gateway row was never re keyed');
  assert.ok(otherId&&otherId!==buyerId);
 }

 console.log('Accounts checks passed: A8 gating (package 5.1), session validation and owner resolution (package 5.1), A1 lifecycle with register, verify, sign out and sign in session rotation, A2 enumeration byte equality across sign in, register, forgot password and token failures, A3 lockout on the email and IP keys, A4 reset and change password session revocation, A7 CSRF origin checks with the Referer fallback, completed at the parity gate with missing and foreign origin rejections plus whole surface state snapshots across every auth and account POST (package 5.8), password policy, unverified re-register, resend verification, email send caps and the parameter upgrade rehash, A6 profiles upsert, replace, validation and delete with cross user 404s, idempotent import counts, verbatim demo snapshots and account POST CSRF (package 5.5), A5 owner resolution through checkout under cookie, gateway and both identities with the payment return read back under cookie auth, and the merged account orders endpoint with demo badged snapshots and no gateway claiming (package 5.6).');
})().catch(e=>{console.error(e);process.exit(1)});
