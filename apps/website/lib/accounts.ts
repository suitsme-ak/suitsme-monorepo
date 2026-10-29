// Wave 5, Option B standalone accounts (docs/ux-audit/wave-5-design.md).
// Package 5.1 landed the readiness gates, the dispatcher skeleton and
// the me endpoint. Package 5.2 adds the email and password core:
// register, verify email, resend verification, sign in, sign out,
// forgot password, reset password and change password, with the
// hashing, session, rate limiting, enumeration and CSRF controls of
// design section 3. Package 5.5 adds the profiles API and the guest
// migration import (design sections 2.6 and 5). Package 5.6 adds
// the account orders endpoint: the signed in user's store_orders
// rows merged with their imported demo snapshots (design sections
// 2.6 and 6). Google sign in is package 5.7; until then the Google
// paths return 404 when accounts are enabled and the gate's 503
// when they are not. Runtime data access is raw D1 SQL in the
// commerce style; db/schema.ts stays the migration source of truth.
import { validateProfile as validateMeasurementProfile } from './measurement-schema.js';
type Env=Record<string,any>;
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function replyCookie(data:any,status:number,cookie:string){const r=reply(data,status);r.headers.append('Set-Cookie',cookie);return r;}
export const SESSION_COOKIE='suitsme-session';
const DAY_MS=24*60*60*1000,HOUR_MS=60*60*1000,SESSION_IDLE_MS=14*DAY_MS,SESSION_TOUCH_MS=DAY_MS,SESSION_MAX_MS=30*DAY_MS;
const VERIFY_TTL_MS=24*HOUR_MS,RESET_TTL_MS=HOUR_MS;
// Readiness gate, mirroring settings() in lib/commerce.ts (section 2 of
// the design). Accounts stay invisible to shoppers until an email sending
// path exists, because verification and password reset depend on it.
export function accountsEnabled(env:Env){return !!(env.DB&&env.EMAIL_API_URL&&env.EMAIL_API_KEY&&env.EMAIL_FROM);}
export function googleEnabled(env:Env){return accountsEnabled(env)&&!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);}
function cookieValue(request:Request,name:string){const header=request.headers.get('Cookie')||'';for(const part of header.split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();}return null;}
const sessionCookie=(token:string)=>SESSION_COOKIE+'='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age='+(SESSION_MAX_MS/1000);
const clearedCookie=()=>SESSION_COOKIE+'=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
function publicUser(user:any){return{id:user.id,email:user.email,name:user.display_name,emailVerified:!!user.email_verified_at};}
async function userByEmail(env:Env,email:string){return env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();}
async function userById(env:Env,id:string){return env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();}
// Password hashing (design section 3.1 and the package 5.0 addendum,
// which verified these exact parameters on the built worker):
// PBKDF2 HMAC SHA-256 through WebCrypto, 600,000 iterations, a 16 byte
// random salt per password, a 32 byte derived key, stored self
// describing so the parameters can rise later. Comparison is a
// constant time equality over the full 32 bytes.
const PBKDF2_ITERATIONS=600000,enc=new TextEncoder();
function b64urlEncode(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function b64urlDecode(value:string){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function derive(password:string,salt:Uint8Array,iterations:number){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256));}
async function hashPassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));return 'pbkdf2-sha256:'+PBKDF2_ITERATIONS+':'+b64urlEncode(salt)+':'+b64urlEncode(await derive(password,salt,PBKDF2_ITERATIONS));}
async function verifyPassword(password:string,stored:string){try{const parts=String(stored).split(':');if(parts.length!==4||parts[0]!=='pbkdf2-sha256')return false;const iterations=Number(parts[1]);if(!Number.isSafeInteger(iterations)||iterations<1)return false;const digest=await derive(password,b64urlDecode(parts[2]),iterations),expected=b64urlDecode(parts[3]);if(digest.length!==expected.length)return false;let diff=0;for(let i=0;i<digest.length;i++)diff|=digest[i]^expected[i];return diff===0;}catch{return false;}}
// Unknown email sign ins verify against this fixed dummy hash (a real
// PBKDF2 hash of a published non credential at the current parameters),
// so the response time matches a real wrong password attempt and does
// not reveal whether the account exists (design section 3.5).
const DUMMY_HASH='pbkdf2-sha256:600000:63NzfO_k2igCS7U3fB2-Tg:yeMNZEQ6INKcH4R1oeEGbeE25QfwbZ6ZRQQWmTCxSBs';
// Password policy (design section 3.2): 12 to 128 characters, no
// composition rules, never the account email or its local part, and
// never one of the common passwords shipped here as data.
const COMMON_PASSWORDS=new Set(('123456789012 password1234 qwertyuiop12 1234567890ab 1q2w3e4r5t6y qwerty123456 iloveyou1234 letmein12345 dragon123456 football1234 baseball1234 monkey123456 shadow123456 master123456 superman1234 batman123456 trustno1pass jordan123456 michael12345 1234567891011 1234567890qw qazwsx123456 zxcvbnm12345 asdfghjkl123 passw0rd1234 password12345 p@ssw0rd1234 changeme1234 welcome12345 welcome123456 admin1234567 login1234567 starwars1234 pokemon12345 naruto123456 lol123456789 chelsea12345 liverpool123 arsenal12345 manchester12 computer1234 michelle1234 jessica12345 ashley123456 nicole123456 daniel123456 andrew123456 joshua123456 matthew12345 robert123456 peanut123456 soccer123456 hockey123456 killer123456 george123456 charlie12345 thomas123456 maggie123456 pepper123456 111111111111 999999999999 123123123123 qwe123456789 abc123456789 aa1234567890 sunshine1234 princess1234 beautiful123 pass12345678 test12345678 demo12345678 guest1234567 secret123456 winter123456 summer123456 autumn123456 spring123456 flower123456 purple123456 orange123456 banana123456 monkey1234567 dragon1234567 master1234567 killer1234567 shadow1234567').split(' '));
function passwordProblem(password:string,email:string){if(typeof password!=='string'||password.length<12)return 'Please use a password of at least 12 characters.';if(password.length>128)return 'Please use a password of at most 128 characters.';const lower=password.toLowerCase();if(lower===email||lower===email.split('@')[0])return 'Your password cannot be your email address.';if(COMMON_PASSWORDS.has(lower))return 'That password is too common. Try a longer phrase.';return null;}
function normalizeEmail(value:any){return typeof value==='string'?value.trim().toLowerCase():'';}
function validEmail(email:string){return email.length>2&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
// Sessions (design sections 2.3 and 3.3): the token is 32 random
// bytes, base64url; only its SHA-256 hash is stored.
async function sha256Hex(value:string){const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function mintSession(env:Env,userId:string){const token=b64urlEncode(crypto.getRandomValues(new Uint8Array(32))),now=Date.now(),iso=new Date(now).toISOString();await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)').bind(await sha256Hex(token),userId,iso,iso,new Date(now+SESSION_MAX_MS).toISOString()).run();return token;}
async function deleteSession(env:Env,token:string){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256Hex(token)).run();}
async function deleteUserSessions(env:Env,userId:string){await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId).run();}
// One time emailed tokens (verify 24 hours, reset 1 hour). Only the
// SHA-256 hash is stored; minting a fresh token replaces any earlier
// one of the same purpose, so at most one link per purpose is live.
async function mintToken(env:Env,userId:string,purpose:string,ttlMs:number){await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id=? AND purpose=?').bind(userId,purpose).run();const token=b64urlEncode(crypto.getRandomValues(new Uint8Array(32))),now=Date.now();await env.DB.prepare('INSERT INTO auth_tokens (token_hash,user_id,purpose,expires_at,used_at,created_at) VALUES (?,?,?,?,NULL,?)').bind(await sha256Hex(token),userId,purpose,new Date(now+ttlMs).toISOString(),new Date(now).toISOString()).run();return token;}
async function liveToken(env:Env,token:string,purpose:string){if(!token)return null;const row=await env.DB.prepare('SELECT * FROM auth_tokens WHERE token_hash=?').bind(await sha256Hex(token)).first();if(!row||row.purpose!==purpose||row.used_at||Date.now()>=Date.parse(row.expires_at))return null;return row;}
// Rate limiting and lockout (design section 3.4): D1 backed counters
// in auth_attempts, keyed by the submitted identifier, never by
// whether an account exists. The IP dimension reads cf-connecting-ip;
// whether this hosting surfaces that header is unverified, so its
// absence degrades to one shared 'unknown' bucket while the email
// dimension carries the posture, and no header is invented.
const LOCK_MS=15*60*1000,SIGNIN_WINDOW_MS=15*60*1000,SIGNIN_EMAIL_LIMIT=5,SIGNIN_IP_LIMIT=20;
const SEND_WINDOW_MS=HOUR_MS,EMAIL_SEND_CAP=3,IP_SEND_CAP=10;
function clientIp(request:Request){return request.headers.get('cf-connecting-ip')||'unknown';}
async function attemptRow(env:Env,key:string){try{return await env.DB.prepare('SELECT * FROM auth_attempts WHERE key=?').bind(key).first();}catch{return null;}}
async function isLocked(env:Env,key:string){const row=await attemptRow(env,key);return !!(row&&row.locked_until&&Date.parse(row.locked_until)>Date.now());}
async function recordFailure(env:Env,key:string,limit:number){const now=Date.now(),iso=new Date(now).toISOString(),row=await attemptRow(env,key);const fresh=!row||now-Date.parse(row.window_started_at)>=SIGNIN_WINDOW_MS,count=fresh?1:row.count+1,lock=count>=limit?new Date(now+LOCK_MS).toISOString():null;if(row)await env.DB.prepare('UPDATE auth_attempts SET count=?,window_started_at=?,locked_until=? WHERE key=?').bind(count,fresh?iso:row.window_started_at,lock,key).run();else await env.DB.prepare('INSERT INTO auth_attempts (key,count,window_started_at,locked_until) VALUES (?,?,?,?)').bind(key,count,iso,lock).run();}
async function bumpWindow(env:Env,key:string,windowMs:number){const now=Date.now(),iso=new Date(now).toISOString(),row=await attemptRow(env,key);if(!row)await env.DB.prepare('INSERT INTO auth_attempts (key,count,window_started_at,locked_until) VALUES (?,?,?,NULL)').bind(key,1,iso).run();else if(now-Date.parse(row.window_started_at)>=windowMs)await env.DB.prepare('UPDATE auth_attempts SET count=?,window_started_at=?,locked_until=? WHERE key=?').bind(1,iso,null,key).run();else await env.DB.prepare('UPDATE auth_attempts SET count=? WHERE key=?').bind(row.count+1,key).run();}
async function clearAttempts(env:Env,key:string){try{await env.DB.prepare('DELETE FROM auth_attempts WHERE key=?').bind(key).run();}catch{}}
// Email send caps share one key space across register, resend and
// forgot password (design section 3.4). A capped request still returns
// its uniform success response; it simply does not send.
async function reserveSend(env:Env,email:string,ip:string){const now=Date.now(),counted=async(key:string)=>{const row=await attemptRow(env,key);return row&&now-Date.parse(row.window_started_at)<SEND_WINDOW_MS?row.count:0;};if(await counted('email-send:email:'+email)>=EMAIL_SEND_CAP||await counted('email-send:ip:'+ip)>=IP_SEND_CAP)return false;await bumpWindow(env,'email-send:email:'+email,SEND_WINDOW_MS);await bumpWindow(env,'email-send:ip:'+ip,SEND_WINDOW_MS);return true;}
// Email delivery seam. Package 5.3 owns the provider contract and the
// final templates; package 5.2 sends the three flow emails through
// this one function, shaped like the tax quote precedent in
// lib/commerce.ts (an HTTPS POST to EMAIL_API_URL with a bearer key),
// so the harness stubs fetch exactly as it does for Authorize.Net.
// Send failures are swallowed on purpose: register, forgot password
// and resend must return their uniform responses either way (design
// section 3.5), and nothing here is ever logged (section 3.7).
async function sendAccountEmail(env:Env,kind:string,to:string,link:string){
 const subjects:Record<string,string>={verify:'Confirm your email for your Suits.me account',reset:'Reset your Suits.me password',notice:'Someone tried to register with your email at Suits.me'};
 const texts:Record<string,string>={
  verify:'Welcome to Suits.me.\n\nConfirm your email address to finish creating your account:\n'+link+'\n\nThis link works for 24 hours. If you did not create an account, you can ignore this email.',
  reset:'We received a request to reset your Suits.me password.\n\nChoose a new password here:\n'+link+'\n\nThis link works for 1 hour. If you did not ask for a reset, you can ignore this email and your password stays unchanged.',
  notice:'Someone, possibly you, tried to create a Suits.me account with this email address, but an account already exists for it.\n\nIf it was you, sign in or use the forgot password link on the sign in page. If it was not you, no action is needed: no new account was created.'};
 try{await fetch(env.EMAIL_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.EMAIL_API_KEY},body:JSON.stringify({from:env.EMAIL_FROM,to,subject:subjects[kind],text:texts[kind]}),signal:AbortSignal.timeout(15000)});}catch{}
}
async function emailTokenLink(env:Env,request:Request,user:any,purpose:string){
 if(!await reserveSend(env,user.email,clientIp(request)))return;
 const token=await mintToken(env,user.id,purpose,purpose==='verify'?VERIFY_TTL_MS:RESET_TTL_MS);
 const link=new URL(request.url).origin+(purpose==='verify'?'/verify-email?token=':'/reset-password?token=')+token;
 await sendAccountEmail(env,purpose,user.email,link);
}
async function emailNotice(env:Env,request:Request,user:any){if(await reserveSend(env,user.email,clientIp(request)))await sendAccountEmail(env,'notice',user.email,'');}
// CSRF posture (design section 3.6): every POST under /api/auth/* and
// /api/account/* requires the Origin header to equal the request
// origin, generalizing the check lib/commerce.ts applies to checkout.
// When Origin is absent, a Referer with a matching origin is accepted
// for older browsers; with neither header present the POST is rejected.
function originOk(request:Request,url:URL){const origin=request.headers.get('Origin');if(origin)return origin===url.origin;const referer=request.headers.get('Referer');if(referer){try{return new URL(referer).origin===url.origin;}catch{return false;}}return false;}
async function readBody(request:Request,max=10000){const raw=await request.text();if(raw.length>max)throw Error('Request too large.');if(!raw)return{};return JSON.parse(raw);}
// The signed in app user for this request, or null. Sessions store only
// the SHA-256 hash of the token (design section 1). An expired session
// (absolute 30 days, or idle more than 14 days) and a session whose user
// was deleted are removed on use; last_seen_at advances at most once a
// day. A storage failure reads as signed out rather than as an error, so
// GET /api/auth/me never fails a guest (design section 2.3).
export async function sessionUser(request:Request,env:Env){
 try{
  if(!env.DB)return null;
  const token=cookieValue(request,SESSION_COOKIE);if(!token)return null;
  const tokenHash=await sha256Hex(token);
  const session=await env.DB.prepare('SELECT * FROM sessions WHERE token_hash=?').bind(tokenHash).first();
  if(!session)return null;
  const user=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(session.user_id).first();
  const now=Date.now(),expired=now>=Date.parse(session.expires_at)||now-Date.parse(session.last_seen_at)>SESSION_IDLE_MS;
  if(!user||user.deleted_at||expired){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();return null;}
  if(now-Date.parse(session.last_seen_at)>=SESSION_TOUCH_MS)await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').bind(new Date(now).toISOString(),tokenHash).run();
  return publicUser(user);
 }catch{return null;}
}
// One owner resolver for every authenticated route (design section 1.1):
// a valid app session wins, keyed app:<user id>; else the gateway header
// exactly as lib/commerce.ts reads it today; else the request is a guest.
// lib/commerce.ts adopts this resolver (package 5.6); nothing here reads
// an owner, user id or email from the request body or query string.
export async function resolveOwner(request:Request,env:Env){
 const user=await sessionUser(request,env);
 if(user)return{owner:'app:'+user.id,user};
 const gateway=request.headers.get('oai-authenticated-user-id');
 if(gateway)return{owner:gateway,user:null};
 return{owner:null,user:null};
}
// Register (design section 2.1). The response is always the same 202,
// whether the email is new, already verified, or registered but
// unverified, so the endpoint cannot be used to enumerate accounts.
// No session is created here; the verification link mints the first
// one. The password policy is only evaluated on the paths that would
// set a credential (a new email, or an unverified registration being
// completed by its mailbox owner), never for an already verified
// email, where a policy answer would leak that the account exists.
async function register(request:Request,env:Env,body:any){
 const done=()=>reply({ok:true,message:'Check your email to finish creating your account.'},202);
 const email=normalizeEmail(body.email);if(!validEmail(email))return done();
 const existing=await userByEmail(env,email);
 if(existing&&existing.deleted_at)return done();
 if(existing&&existing.email_verified_at){await emailNotice(env,request,existing);return done();}
 const password=typeof body.password==='string'?body.password:'',problem=passwordProblem(password,email);
 if(problem)return reply({error:problem},400);
 const name=typeof body.name==='string'?body.name.trim().slice(0,120):'',now=new Date().toISOString(),hash=await hashPassword(password);
 if(!existing){
  const id='U'+crypto.randomUUID().replaceAll('-','');
  await env.DB.prepare('INSERT INTO users (id,email,display_name,email_verified_at,created_at,updated_at,deleted_at) VALUES (?,?,?,NULL,?,?,NULL)').bind(id,email,name||null,now,now).run();
  await env.DB.prepare('INSERT INTO user_credentials (user_id,password_hash,password_updated_at) VALUES (?,?,?)').bind(id,hash,now).run();
  await emailTokenLink(env,request,{id,email},'verify');
  return done();
 }
 await env.DB.prepare('UPDATE user_credentials SET password_hash=?,password_updated_at=? WHERE user_id=?').bind(hash,now,existing.id).run();
 if(name)await env.DB.prepare('UPDATE users SET display_name=?,updated_at=? WHERE id=?').bind(name,now,existing.id).run();
 await emailTokenLink(env,request,existing,'verify');
 return done();
}
// Verify email (design section 2.2). Success sets email_verified_at,
// consumes the token, clears any other outstanding verify tokens and
// creates the first session. Every failure shares one 400 body.
async function verifyEmail(request:Request,env:Env,body:any){
 const invalid=()=>reply({error:'This link is invalid or has expired.'},400);
 const row=await liveToken(env,typeof body.token==='string'?body.token:'','verify');if(!row)return invalid();
 const user=await userById(env,row.user_id);if(!user||user.deleted_at)return invalid();
 const now=new Date().toISOString();
 await env.DB.prepare('UPDATE auth_tokens SET used_at=? WHERE token_hash=?').bind(now,row.token_hash).run();
 await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id=? AND purpose=? AND token_hash<>?').bind(row.user_id,'verify',row.token_hash).run();
 await env.DB.prepare('UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?').bind(now,now,row.user_id).run();
 user.email_verified_at=now;
 return replyCookie({user:publicUser(user)},200,sessionCookie(await mintSession(env,row.user_id)));
}
// Resend verification (the resend field the verify page offers, design
// section 2.2). Same uniform 202 as register; a fresh token is minted
// and sent only when an unverified account exists for the email.
async function resendVerification(request:Request,env:Env,body:any){
 const done=()=>reply({ok:true,message:'Check your email to finish creating your account.'},202);
 const email=normalizeEmail(body.email);if(!validEmail(email))return done();
 const user=await userByEmail(env,email);
 if(user&&!user.email_verified_at&&!user.deleted_at)await emailTokenLink(env,request,user,'verify');
 return done();
}
// Sign in (design section 2.3). Unknown email, wrong password and
// lockout share one 401 body and status; an unknown email still pays
// one PBKDF2 verification against the dummy hash. A correct password
// on an unverified account resends the verification email and returns
// the 403, which only the password holder can ever reach. A stored
// hash whose parameters differ from the current ones is rehashed on
// the way in (design section 3.1).
async function signIn(request:Request,env:Env,body:any){
 const fail=()=>reply({error:'Email or password is not correct.'},401);
 const email=normalizeEmail(body.email),password=typeof body.password==='string'?body.password:'';
 const emailKey='signin:email:'+email,ipKey='signin:ip:'+clientIp(request);
 if(await isLocked(env,emailKey)||await isLocked(env,ipKey))return fail();
 const user=await userByEmail(env,email);
 const cred=user?await env.DB.prepare('SELECT * FROM user_credentials WHERE user_id=?').bind(user.id).first():null;
 let ok=false;
 if(cred)ok=await verifyPassword(password,cred.password_hash);else await verifyPassword(password,DUMMY_HASH);
 if(!user||!cred||!ok||user.deleted_at){await recordFailure(env,emailKey,SIGNIN_EMAIL_LIMIT);await recordFailure(env,ipKey,SIGNIN_IP_LIMIT);return fail();}
 await clearAttempts(env,emailKey);
 if(!cred.password_hash.startsWith('pbkdf2-sha256:'+PBKDF2_ITERATIONS+':'))await env.DB.prepare('UPDATE user_credentials SET password_hash=?,password_updated_at=? WHERE user_id=?').bind(await hashPassword(password),new Date().toISOString(),user.id).run();
 if(!user.email_verified_at){await emailTokenLink(env,request,user,'verify');return reply({error:'Please confirm your email first. We have sent you a new link.'},403);}
 return replyCookie({user:publicUser(user)},200,sessionCookie(await mintSession(env,user.id)));
}
// Sign out (design section 2.3): the session row is deleted and the
// cookie cleared. Local profiles, bag and orders are client state and
// are untouched.
async function signOut(request:Request,env:Env){
 const token=cookieValue(request,SESSION_COOKIE);if(token)await deleteSession(env,token);
 return replyCookie({ok:true},200,clearedCookie());
}
// Forgot password (design section 2.4). Always the same 202. A reset
// token is minted and emailed only for a verified account; unverified
// accounts recover through the register flow instead, which the help
// copy states and this response deliberately does not.
async function forgotPassword(request:Request,env:Env,body:any){
 const done=()=>reply({ok:true,message:'If an account matches that email, a reset link is on its way.'},202);
 const email=normalizeEmail(body.email);if(!validEmail(email))return done();
 const user=await userByEmail(env,email);
 if(user&&user.email_verified_at&&!user.deleted_at)await emailTokenLink(env,request,user,'reset');
 return done();
}
// Reset password (design section 2.4): a valid token sets the new
// hash, is consumed, revokes every session for the user, and mints
// one fresh session. Token failures share the verify 400 body. A
// Google only account has no credential row yet; setting its first
// password here is the design's supported path (section 2.7).
async function resetPassword(request:Request,env:Env,body:any){
 const invalid=()=>reply({error:'This link is invalid or has expired.'},400);
 const row=await liveToken(env,typeof body.token==='string'?body.token:'','reset');if(!row)return invalid();
 const user=await userById(env,row.user_id);if(!user||user.deleted_at)return invalid();
 const password=typeof body.password==='string'?body.password:'',problem=passwordProblem(password,user.email);
 if(problem)return reply({error:problem},400);
 const now=new Date().toISOString(),hash=await hashPassword(password);
 const cred=await env.DB.prepare('SELECT * FROM user_credentials WHERE user_id=?').bind(user.id).first();
 if(cred)await env.DB.prepare('UPDATE user_credentials SET password_hash=?,password_updated_at=? WHERE user_id=?').bind(hash,now,user.id).run();
 else await env.DB.prepare('INSERT INTO user_credentials (user_id,password_hash,password_updated_at) VALUES (?,?,?)').bind(user.id,hash,now).run();
 await env.DB.prepare('UPDATE auth_tokens SET used_at=? WHERE token_hash=?').bind(now,row.token_hash).run();
 await deleteUserSessions(env,user.id);
 return replyCookie({user:publicUser(user)},200,sessionCookie(await mintSession(env,user.id)));
}
// Change password (design section 2.4), signed in. A wrong current
// password returns the sign in 401 body. Success sets the new hash,
// deletes the user's other sessions and rotates the current one: the
// old token is deleted and a fresh cookie issued, which is the same
// observable end state.
async function changePassword(request:Request,env:Env,body:any){
 const session=await sessionUser(request,env);if(!session)return reply({error:'Please sign in to continue.'},401);
 const cred=await env.DB.prepare('SELECT * FROM user_credentials WHERE user_id=?').bind(session.id).first();
 const current=typeof body.currentPassword==='string'?body.currentPassword:'';
 if(!cred||!await verifyPassword(current,cred.password_hash))return reply({error:'Email or password is not correct.'},401);
 const next=typeof body.newPassword==='string'?body.newPassword:'',problem=passwordProblem(next,session.email);
 if(problem)return reply({error:problem},400);
 await env.DB.prepare('UPDATE user_credentials SET password_hash=?,password_updated_at=? WHERE user_id=?').bind(await hashPassword(next),new Date().toISOString(),session.id).run();
 await deleteUserSessions(env,session.id);
 return replyCookie({user:session},200,sessionCookie(await mintSession(env,session.id)));
}
// Profiles and import (design sections 2.6 and 5, package 5.5).
// Profiles are the client object stored as JSON, minus the transient
// step field, keyed by the client uid so the same profile imported
// or saved from two browsers is one row. Validation is the shared
// measurement schema (lib/measurement-schema.js), the same rule
// cleanItems in lib/commerce.ts enforces, so a profile the server
// accepts here is one checkout accepts for its garment.
function cleanProfile(input:any){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 if(typeof input.id!=='string'||!input.id||input.id.length>80)return null;
 if(!['body','ready','garment','modify'].includes(input.method))return null;
 if(!validateMeasurementProfile(input).ok)return null;
 const stored={...input};delete stored.step;return stored;
}
function profileCreatedAt(profile:any,fallback:string){return typeof profile.created==='string'&&profile.created?profile.created:fallback;}
// The account routes require an app session. A gateway identity has
// no account rows in v1, so like the design's resolver order, only
// the session path reaches them; a guest reads as 401.
async function listProfiles(request:Request,env:Env){
 const user=await sessionUser(request,env);if(!user)return reply({error:'Please sign in to continue.'},401);
 const result=await env.DB.prepare('SELECT * FROM account_profiles WHERE user_id=?').bind(user.id).all();
 const rows=[...(result.results||[])].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at)));
 return reply({profiles:rows.map((row:any)=>JSON.parse(row.data))});
}
// Create or replace by (user, profile.id): a signed in save goes to
// the API first and the client mirrors it locally on success
// (section 5.2), so replacing is the normal edit path. The row's
// created_at is the profile's own creation time, kept on replace.
async function upsertProfile(request:Request,env:Env,body:any){
 const user=await sessionUser(request,env);if(!user)return reply({error:'Please sign in to continue.'},401);
 const profile=cleanProfile(body.profile);if(!profile)return reply({error:'Please review your measurement profile.'},400);
 const now=new Date().toISOString(),data=JSON.stringify(profile);
 const existing=await env.DB.prepare('SELECT * FROM account_profiles WHERE user_id=? AND id=?').bind(user.id,profile.id).first();
 if(existing)await env.DB.prepare('UPDATE account_profiles SET data=?,updated_at=? WHERE user_id=? AND id=?').bind(data,now,user.id,profile.id).run();
 else await env.DB.prepare('INSERT INTO account_profiles (user_id,id,data,created_at,updated_at) VALUES (?,?,?,?,?)').bind(user.id,profile.id,data,profileCreatedAt(profile,now),now).run();
 return reply({profile});
}
// Deleting a profile that is not the session user's is the same 404
// as deleting one that does not exist, so the endpoint cannot be
// used to probe another account's profile ids.
async function deleteProfile(request:Request,env:Env,id:string){
 const user=await sessionUser(request,env);if(!user)return reply({error:'Please sign in to continue.'},401);
 const existing=await env.DB.prepare('SELECT * FROM account_profiles WHERE user_id=? AND id=?').bind(user.id,id).first();
 if(!existing)return reply({error:'Profile not found.'},404);
 await env.DB.prepare('DELETE FROM account_profiles WHERE user_id=? AND id=?').bind(user.id,id).run();
 return reply({ok:true});
}
// Guest migration import (design section 5). Idempotent by primary
// key: rows that already exist are skipped and never overwritten, so
// a repeat import, from this browser or another holding the same
// local data, imports zero duplicates. Local orders are stored
// verbatim as view only snapshots in account_order_snapshots, never
// in store_orders, and stay marked as the demo records they are.
// Everything is validated before anything is written.
async function importLocal(request:Request,env:Env,body:any){
 const user=await sessionUser(request,env);if(!user)return reply({error:'Please sign in to continue.'},401);
 const profilesIn=Array.isArray(body.profiles)?body.profiles:[],ordersIn=Array.isArray(body.orders)?body.orders:[];
 if(profilesIn.length>50||ordersIn.length>50)return reply({error:'Too much data to import at once.'},400);
 const profiles:any[]=[];
 for(const raw of profilesIn){const profile=cleanProfile(raw);if(!profile)return reply({error:'Please review your measurement profile.'},400);profiles.push(profile);}
 for(const order of ordersIn){if(!order||typeof order!=='object'||Array.isArray(order)||typeof order.id!=='string'||!order.id||order.id.length>80)return reply({error:'Please review your order history.'},400);}
 const now=new Date().toISOString();
 let profilesImported=0,profilesSkipped=0,ordersImported=0,ordersSkipped=0;
 for(const profile of profiles){
  const existing=await env.DB.prepare('SELECT * FROM account_profiles WHERE user_id=? AND id=?').bind(user.id,profile.id).first();
  if(existing){profilesSkipped++;continue;}
  await env.DB.prepare('INSERT INTO account_profiles (user_id,id,data,created_at,updated_at) VALUES (?,?,?,?,?)').bind(user.id,profile.id,JSON.stringify(profile),profileCreatedAt(profile,now),now).run();
  profilesImported++;
 }
 for(const order of ordersIn){
  const existing=await env.DB.prepare('SELECT * FROM account_order_snapshots WHERE user_id=? AND id=?').bind(user.id,order.id).first();
  if(existing){ordersSkipped++;continue;}
  await env.DB.prepare('INSERT INTO account_order_snapshots (user_id,id,data,imported_at) VALUES (?,?,?,?)').bind(user.id,order.id,JSON.stringify(order),now).run();
  ordersImported++;
 }
 return reply({profilesImported,profilesSkipped,ordersImported,ordersSkipped});
}
// Account orders (design sections 2.6 and 6, package 5.6). One
// merged history for the orders page: the user's real orders from
// store_orders, keyed app:<user id> by the shared resolver commerce
// now uses, in exactly the JSON shape GET /api/orders/:id returns,
// combined with their imported local demo orders. Snapshots are
// view only history: they are returned marked demo and imported,
// they never enter store_orders, and gateway keyed rows are never
// read here, let alone re keyed: a gateway identity's orders stay
// readable through gateway authenticated requests, unchanged
// (design section 1.1). The combined list is newest first; a
// snapshot's position is its own recorded date, falling back to
// when it was imported.
async function listAccountOrders(request:Request,env:Env){
 const user=await sessionUser(request,env);if(!user)return reply({error:'Please sign in to continue.'},401);
 const real=await env.DB.prepare('SELECT * FROM store_orders WHERE owner=?').bind('app:'+user.id).all();
 const entries=(real.results||[]).map((row:any)=>({at:Date.parse(row.created_at)||0,order:{id:row.id,created_at:row.created_at,items:JSON.parse(row.items),shipping:JSON.parse(row.shipping),status:row.status,total_cents:row.total_cents}}));
 const snaps=await env.DB.prepare('SELECT * FROM account_order_snapshots WHERE user_id=?').bind(user.id).all();
 for(const row of snaps.results||[]){const data=JSON.parse(row.data);entries.push({at:Date.parse(data.created)||Date.parse(row.imported_at)||0,order:{...data,demo:true,imported:true}});}
 entries.sort((a:any,b:any)=>b.at-a.at);
 return reply({orders:entries.map((entry:any)=>entry.order)});
}
const AUTH_POSTS:Record<string,(request:Request,env:Env,body:any)=>Promise<Response>>={
 '/api/auth/register':register,
 '/api/auth/verify-email':verifyEmail,
 '/api/auth/resend-verification':resendVerification,
 '/api/auth/sign-in':signIn,
 '/api/auth/sign-out':signOut,
 '/api/auth/forgot-password':forgotPassword,
 '/api/auth/reset-password':resetPassword,
 '/api/auth/change-password':changePassword,
};
export async function accounts(request:Request,env:Env){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(!accountsEnabled(env)){
   if(path==='/api/auth/me'&&request.method==='GET')return reply({user:null,enabled:false});
   if(path.startsWith('/api/auth/')||path.startsWith('/api/account/'))return reply({error:'Accounts are not enabled yet.'},503);
   return reply({error:'Not found'},404);
  }
  if(path==='/api/auth/me'&&request.method==='GET')return reply({user:await sessionUser(request,env),enabled:true});
  // Google sign in is package 5.7 and independently gated: while its
  // settings are absent the Google routes answer 503, and the client
  // does not render the button.
  if(path.startsWith('/api/auth/google/')){if(!googleEnabled(env))return reply({error:'Google sign in is not enabled yet.'},503);return reply({error:'Not found'},404);}
  // Account data (package 5.5): profiles list, upsert and delete,
  // and the migration import. POSTs carry the same origin check as
  // every auth POST (section 3.6) before any state can change; the
  // session requirement itself is enforced inside each handler.
  if(path==='/api/account/profiles'&&request.method==='GET')return await listProfiles(request,env);
  if(path==='/api/account/profiles'&&request.method==='POST'){if(!originOk(request,url))return reply({error:'Invalid request origin.'},403);return await upsertProfile(request,env,await readBody(request));}
  if(path.startsWith('/api/account/profiles/')&&request.method==='DELETE')return await deleteProfile(request,env,decodeURIComponent(path.slice('/api/account/profiles/'.length)));
  if(path==='/api/account/import'&&request.method==='POST'){if(!originOk(request,url))return reply({error:'Invalid request origin.'},403);return await importLocal(request,env,await readBody(request,200000));}
  // Account orders (package 5.6): a read only GET, so no origin
  // check; the session requirement is enforced inside the handler.
  if(path==='/api/account/orders'&&request.method==='GET')return await listAccountOrders(request,env);
  const handler=AUTH_POSTS[path];
  if(handler&&request.method==='POST'){
   if(!originOk(request,url))return reply({error:'Invalid request origin.'},403);
   return await handler(request,env,await readBody(request));
  }
  return reply({error:'Not found'},404);
 }catch(error){return reply({error:error instanceof SyntaxError?'Invalid request.':error instanceof Error?error.message:'Unable to complete this request.'},400);}
}
