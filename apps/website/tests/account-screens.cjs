const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Wave 5 package 5.4 (ACC-01, SIZ-04): the client account screens
// and entry points, driven end to end in the e2e harness style: the
// real storefront scripts (full served composition, boot translator
// and route data first) in a Node vm with stubbed DOM and storage,
// against a fake accounts API that implements the package 5.2
// client contract (uniform anti enumeration responses included).
// The API journeys against the real lib live in tests/accounts.cjs;
// this suite proves what the shopper sees:
//
// S1 the gate: while /api/auth/me reports enabled: false, no sign
//    in entry point renders anywhere, the checkout and the home
//    screen are byte identical to a world whose fetch never answers
//    (the pre Wave 5 shape), the profiles modal keeps its browser
//    only line, and the auth routes show the not available state.
// S2 enabled: the header offers Sign in, the register screen
//    carries the design copy and autocomplete attributes, register
//    shows the uniform message and creates no session, and the
//    emailed verify link, entered at its real URL, signs the
//    shopper in and lands on the account screen with the header
//    account menu in place.
// S3 enumeration: unknown email and wrong password sign ins show
//    the byte identical error, register and forgot password show
//    the identical message for known and unknown emails, and a bad
//    verify token lands on the shared invalid link state with the
//    resend field the design specifies.
// S4 returnTo and sign out: a validated returnTo is honoured,
//    protocol relative and auth path values fall back to /account,
//    and sign out restores the guest header while local profiles
//    stay put and usable.
// S5 the checkout strip: guest copy with a returnTo link while
//    enabled, the signed in line while signed in, and nothing at
//    all while disabled (covered by the S1 byte parity).
// S6 reset and change: the emailed reset link renders its screen
//    with the token carried in the form, a mismatched confirmation
//    is refused before any API call, a successful reset signs in,
//    change password returns the sign in error body for a wrong
//    current password, and only the newest password signs in.
// S7 markup: the auth screens carry the design's autocomplete
//    attributes (section 3.2) and never block paste.
// S8 sync (package 5.5): a wizard save while signed in writes
//    through to the account, a delete writes through too, a failed
//    write keeps the local profile and the modal shows the design's
//    "Not saved to your account yet" line until the next sign in
//    lands the retry, a second browser pulls the account profiles
//    down on sign in, and for a shared id the account copy wins
//    (the server list is the account's copy, section 5.2).
// J25 migration (package 5.5, design section 5): the first sign in
//    on a browser holding local data offers the migration modal in
//    the design words; accepting posts exactly the local profile
//    and order arrays, the confirmation reports imported and
//    skipped counts, local profiles, orders and the bag stay
//    untouched, and the offer is made once: "Not now" is remembered
//    under suits-import-dismissed:<user id>, while the /account
//    import button runs the same call by hand. The snapshot is
//    asserted here at the API boundary, marked demo; its rendering
//    on the orders page is the merged view asserted in S9.
// S9 merged orders (package 5.6, design sections 2.6 and 6):
//    signed in, the orders page renders one history from
//    /api/account/orders: the account's real orders beside this
//    browser's orders, imported snapshots badged as demo records
//    and never duplicated against their local copies, newest
//    first, and an account order opens its detail page. Signing
//    out returns the page to the browser only list, and a fresh
//    browser for the same account sees the account history alone.
// J24 signed in parity (package 5.8, design section 6): the
//    parity gate itself. In a world whose sign in makes
//    /api/auth/me return a user, the rendered menus are byte
//    identical to the guest world (byte level, not a sample), and
//    so are the home screen, three collection listings, a product
//    page and the customizer at every stage; the same priced
//    customization J17 drives lands at the same Wave 3 total
//    (base + 368) with a byte identical bag line; checkout is
//    byte identical apart from the one designed difference, the
//    account strip line; the bag persists across re renders; and
//    the demo checkout completes to the order page with the
//    configured total intact.
// J26 sign out restores the guest (package 5.8, design
//    section 6): after sign out the header shows Sign in again
//    and the restored guest is byte identical to a fresh guest
//    world on the same browser data (header slot, home, listing,
//    checkout with its guest strip, orders page, profiles
//    modal); the local profile is then used in the customizer
//    for a full guest purchase down the J1 path (menu
//    destination, collection, product, customizer, bag,
//    checkout) that completes on the order page, with the local
//    profile untouched by the whole cycle.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}

// A fake accounts API implementing the package 5.2 responses the
// client consumes. Passwords are stored in plain text here on
// purpose: this fake stands in for the HTTP contract only; the
// hashing itself is proven against the real lib in
// tests/accounts.cjs.
function makeFakeAccounts({enabled=true}={}){
  const users=new Map();
  let session=null,seq=0,lastVerifyToken=null,lastResetToken=null;
  const calls=[];
  // Package 5.5 surface: per account server copies of profiles and
  // imported order snapshots, plus a switch that fails account
  // writes so the client's unsaved state can be exercised.
  // Package 5.6 adds the real orders an account holds (seeded in
  // the store order shape) and the merged orders endpoint.
  const stores=new Map();
  const accountStore=id=>{if(!stores.has(id))stores.set(id,{profiles:[],orders:[],realOrders:[]});return stores.get(id)};
  const control={failAccountWrites:false};
  const respond=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
  const norm=v=>String(v||'').trim().toLowerCase();
  const pub=u=>({id:u.id,email:u.email,name:u.name,emailVerified:u.verified});
  const mintVerify=u=>{lastVerifyToken='verify-token-'+(++seq);u.verifyToken=lastVerifyToken;};
  async function fetch(url,opts={}){
    const path=String(url).split('?')[0],method=String(opts.method||'GET').toUpperCase();
    const body=opts.body?JSON.parse(opts.body):{};
    if(path==='/api/auth/me'&&method==='GET')return enabled?respond(200,{user:session?pub(users.get(session)):null,enabled:true}):respond(200,{user:null,enabled:false});
    if(path.startsWith('/api/account/')){
      calls.push({method,path,body});
      if(!enabled)return respond(503,{error:'Accounts are not enabled yet.'});
      if(!session)return respond(401,{error:'Please sign in to continue.'});
      if(control.failAccountWrites&&method!=='GET')return respond(500,{error:'Storage is unavailable.'});
      const store=accountStore(users.get(session).id);
      if(path==='/api/account/profiles'&&method==='GET')return respond(200,{profiles:store.profiles.map(p=>({...p}))});
      if(path==='/api/account/profiles'&&method==='POST'){
        const p=body.profile;
        if(!p||typeof p.id!=='string'||!['body','ready'].includes(p.method))return respond(400,{error:'Please review your measurement profile.'});
        if(p.method==='body'){const vs=p.values||{};for(const k of Object.keys(vs)){if(!Number.isFinite(vs[k])||vs[k]<8||vs[k]>100)return respond(400,{error:'Please review your measurement profile.'});}}
        const clean={...p};delete clean.step;
        const i=store.profiles.findIndex(x=>x.id===clean.id);
        if(i>=0)store.profiles[i]=clean;else store.profiles.push(clean);
        return respond(200,{profile:clean});
      }
      if(path.startsWith('/api/account/profiles/')&&method==='DELETE'){
        const id=decodeURIComponent(path.slice('/api/account/profiles/'.length));
        const i=store.profiles.findIndex(x=>x.id===id);
        if(i<0)return respond(404,{error:'Profile not found.'});
        store.profiles.splice(i,1);return respond(200,{ok:true});
      }
      if(path==='/api/account/import'&&method==='POST'){
        let profilesImported=0,profilesSkipped=0,ordersImported=0,ordersSkipped=0;
        for(const p of body.profiles||[]){if(store.profiles.some(x=>x.id===p.id))profilesSkipped++;else{const clean={...p};delete clean.step;store.profiles.push(clean);profilesImported++}}
        for(const o of body.orders||[]){if(store.orders.some(x=>x.id===o.id))ordersSkipped++;else{store.orders.push({...o});ordersImported++}}
        return respond(200,{profilesImported,profilesSkipped,ordersImported,ordersSkipped});
      }
      if(path==='/api/account/orders'&&method==='GET'){
        const merged=[...store.realOrders.map(o=>({o,at:Date.parse(o.created_at)||0})),...store.orders.map(o=>({o:{...o,demo:true,imported:true},at:Date.parse(o.created)||0}))].sort((a,b)=>b.at-a.at).map(x=>x.o);
        return respond(200,{orders:merged});
      }
      return respond(404,{error:'Not found'});
    }
    if(!path.startsWith('/api/auth/'))return{ok:false,status:404,json:async()=>null};
    calls.push({method,path,body});
    if(!enabled)return respond(503,{error:'Accounts are not enabled yet.'});
    if(path==='/api/auth/register'){
      const email=norm(body.email),existing=users.get(email);
      if(existing&&existing.verified)return respond(202,{ok:true,message:'Check your email to finish creating your account.'});
      if(typeof body.password!=='string'||body.password.length<12)return respond(400,{error:'Please use a password of at least 12 characters.'});
      const u=existing||{id:'U'+(++seq),email,name:null,verified:false,verifyToken:null,resetToken:null};
      u.password=body.password;if(body.name)u.name=body.name;users.set(email,u);mintVerify(u);
      return respond(202,{ok:true,message:'Check your email to finish creating your account.'});
    }
    if(path==='/api/auth/verify-email'){
      const u=[...users.values()].find(x=>x.verifyToken&&x.verifyToken===body.token);
      if(!u)return respond(400,{error:'This link is invalid or has expired.'});
      u.verified=true;u.verifyToken=null;session=u.email;
      return respond(200,{user:pub(u)});
    }
    if(path==='/api/auth/resend-verification'){
      const u=users.get(norm(body.email));
      if(u&&!u.verified)mintVerify(u);
      return respond(202,{ok:true,message:'Check your email to finish creating your account.'});
    }
    if(path==='/api/auth/sign-in'){
      const u=users.get(norm(body.email));
      if(!u||u.password!==body.password)return respond(401,{error:'Email or password is not correct.'});
      if(!u.verified){mintVerify(u);return respond(403,{error:'Please confirm your email first. We have sent you a new link.'});}
      session=u.email;
      return respond(200,{user:pub(u)});
    }
    if(path==='/api/auth/sign-out'){session=null;return respond(200,{ok:true});}
    if(path==='/api/auth/forgot-password'){
      const u=users.get(norm(body.email));
      if(u&&u.verified){lastResetToken='reset-token-'+(++seq);u.resetToken=lastResetToken;}
      return respond(202,{ok:true,message:'If an account matches that email, a reset link is on its way.'});
    }
    if(path==='/api/auth/reset-password'){
      const u=[...users.values()].find(x=>x.resetToken&&x.resetToken===body.token);
      if(!u)return respond(400,{error:'This link is invalid or has expired.'});
      if(typeof body.password!=='string'||body.password.length<12)return respond(400,{error:'Please use a password of at least 12 characters.'});
      u.password=body.password;u.resetToken=null;session=u.email;
      return respond(200,{user:pub(u)});
    }
    if(path==='/api/auth/change-password'){
      if(!session)return respond(401,{error:'Please sign in to continue.'});
      const u=users.get(session);
      if(!u||u.password!==body.currentPassword)return respond(401,{error:'Email or password is not correct.'});
      if(typeof body.newPassword!=='string'||body.newPassword.length<12)return respond(400,{error:'Please use a password of at least 12 characters.'});
      u.password=body.newPassword;
      return respond(200,{user:pub(u)});
    }
    return respond(404,{error:'Not found'});
  }
  return{fetch,calls,control,
    seedUser({email,password,name=null,verified=true}){const e=norm(email);users.set(e,{id:'U-seed-'+e,email:e,name,password,verified,verifyToken:null,resetToken:null});},
    accountProfiles(email){const u=users.get(norm(email));return u?accountStore(u.id).profiles:[]},
    accountOrders(email){const u=users.get(norm(email));return u?accountStore(u.id).orders:[]},
    seedRealOrder(email,order){const u=users.get(norm(email));if(u)accountStore(u.id).realOrders.push(order);},
    state:()=>({session,verifyToken:lastVerifyToken,resetToken:lastResetToken})};
}
const neverApi={fetch:async()=>({ok:false,status:0,json:async()=>null}),calls:[],seedUser(){},state:()=>({session:null,verifyToken:null,resetToken:null})};

// A storefront world entered the way the live server delivers it:
// the full script composition from public/index.html, boot
// translator and route data first, in document order.
function makeWorld({pathname='/',hash='',search='',api=neverApi,seed={}}={}){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  if(seed.bag)localStorage.setItem('suits-bag',JSON.stringify(seed.bag));
  if(seed.profiles)localStorage.setItem('suits-profiles',JSON.stringify(seed.profiles));
  if(seed.orders)localStorage.setItem('suits-orders',JSON.stringify(seed.orders));
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class ScreenFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash,pathname,search};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:api.fetch,FormData:ScreenFormData,addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['real-routes-data.js','real-routes.js','measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','navigation-data.js','navigation.js','gallery.js','quick-add.js','merchant-data.js','merchant.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,store,location,api};
}
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,0));};

const PROFILE={id:'p1',name:'My measurements',method:'body',unit:'in',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42},fit:'Tailored',wearer:'Men',created:'2026-01-01T00:00:00.000Z'};
const BAG_ITEM={id:'test-item',product:0,fabric:'Navy',fit:'Tailored',lapel:'Notch',closure:'Two button',lining:'Burgundy',monogram:'',profile:{name:'My measurements',method:'body',unit:'in',values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42}}};

(async()=>{

// ---------------------------------------------------------------- S1
{
  const api=makeFakeAccounts({enabled:false});
  const w=makeWorld({api,seed:{bag:[BAG_ITEM],profiles:[PROFILE]}});
  const baseline=makeWorld({seed:{bag:[BAG_ITEM],profiles:[PROFILE]}});
  await flush();
  assert.equal(w.run('accountState.enabled'),false,'disabled: the client records the gate as closed');
  assert.equal(w.elFor('#accountNav').innerHTML,'','disabled: the header account slot renders nothing');
  assert.equal(w.run('checkoutPage()'),baseline.run('checkoutPage()'),'disabled: checkout is byte identical to the pre accounts checkout');
  assert.equal(w.run('home()'),baseline.run('home()'),'disabled: the home screen is byte identical to the pre accounts home screen');
  assert.ok(!w.run('checkoutPage()').includes('account-strip'),'disabled: checkout carries no account strip');
  w.run('openProfiles()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Saved on this browser. These profiles are not synced to an account.'),'disabled: the profiles modal keeps its browser only line, word for word');
  w.run('closeModal()');
  w.run("location.hash='#sign-in';render()");
  const main=w.elFor('#main').innerHTML;
  assert.ok(main.includes('Accounts are not available yet.'),'disabled: the sign in route shows the not available state');
  assert.ok(!main.includes('submitSignIn')&&!main.includes('type="password"'),'disabled: no sign in form is rendered behind the gate');
  w.run("location.hash='#account';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('Accounts are not available yet.'),'disabled: the account route shows the not available state');
  console.log('S1 passed: with accounts disabled there is no entry point anywhere, guest screens are byte identical to the pre accounts storefront, and the auth routes show the not available state instead of forms.');
}

// ---------------------------------------------------------------- S2
{
  const api=makeFakeAccounts();
  const w=makeWorld({api,seed:{profiles:[PROFILE]}});
  await flush();
  const nav=w.elFor('#accountNav').innerHTML;
  assert.ok(nav.includes('Sign in')&&nav.includes('href="/sign-in"'),'enabled guest: the header offers Sign in at its real URL, beside Your measurements');
  w.run('openProfiles()');
  const modal=w.elFor('#modalContent').innerHTML;
  assert.ok(modal.includes('Profiles are saved on this browser.')&&modal.includes('>Sign in</a>'),'enabled guest: the profiles modal carries the sign in status line');
  w.run('closeModal()');
  w.run("location.hash='#register';render()");
  const reg=w.elFor('#main').innerHTML;
  assert.ok(reg.includes('We will email you a link to confirm your address. Your measurements stay on this device until you sign in.'),'register states what happens next in the design copy');
  assert.ok(reg.includes('autocomplete="name"')&&reg.includes('autocomplete="email"')&&reg.includes('autocomplete="new-password"'),'register carries the design autocomplete attributes');
  assert.ok(reg.includes('<label class="field">Name')&&reg.includes('<label class="field">Email')&&reg.includes('<label class="field">Password'),'register fields carry accessible labels');
  await w.run(`submitRegister({__data:{name:'Ada Tailor',email:'ada@example.com',password:'a long tailor phrase'}})`);
  assert.equal(w.elFor('#registerMessage').textContent,'Check your email to finish creating your account.','register shows the uniform message from the API');
  assert.equal(w.run('accountState.user'),null,'registration creates no session on the client');
  const token=api.state().verifyToken;
  assert.ok(token,'the verification email carried a token');

  // Follow the emailed link exactly as it arrives: a real path
  // with the token in the query string, in a fresh browser world
  // holding the same shopper's local profiles.
  const w2=makeWorld({api,pathname:'/verify-email',search:'?token='+token,seed:{profiles:[PROFILE]}});
  await flush();
  assert.equal(w2.location.hash,'#account','the verify landing signs the shopper in and lands on the account screen');
  assert.equal(w2.run('accountState.user.email'),'ada@example.com','the client holds the verified user');
  const nav2=w2.elFor('#accountNav').innerHTML;
  assert.ok(nav2.includes('My account')&&nav2.includes('My orders')&&nav2.includes('Sign out'),'signed in: the header account menu offers My account, My orders and Sign out');
  assert.ok(nav2.includes('>A</summary>'),'the account button shows the shopper initial');
  assert.ok(nav2.includes('href="/account"')&&nav2.includes('href="/orders"'),'the account menu links use real URLs');
  const acct=w2.elFor('#main').innerHTML;
  assert.ok(acct.includes('ada@example.com')&&acct.includes('Email confirmed.'),'the account screen shows the email and its confirmed state');
  assert.ok(acct.includes('Change your password.')&&acct.includes('autocomplete="current-password"')&&acct.includes('autocomplete="new-password"'),'the account screen carries the change password form with the design autocomplete attributes');
  w2.run('openProfiles()');
  assert.ok(w2.elFor('#modalContent').innerHTML.includes('Profiles save to your account and this browser.'),'signed in: the profiles modal shows the account status line');
  console.log('S2 passed: the header entry point renders while enabled, register shows the uniform message and creates no session, and the emailed verify link entered at its real URL signs in and lands on a complete account screen.');
}

// ---------------------------------------------------------------- S3
{
  const api=makeFakeAccounts();
  api.seedUser({email:'sam@example.com',password:'sam long phrase 1',name:'Sam',verified:true});
  api.seedUser({email:'una@example.com',password:'una long phrase 1',name:'Una',verified:false});
  const w=makeWorld({api});
  await flush();
  w.run("location.hash='#sign-in';render()");
  const signInHtml=w.elFor('#main').innerHTML;
  assert.ok(signInHtml.includes('autocomplete="current-password"'),'sign in password uses current-password');
  assert.ok(signInHtml.includes('autocomplete="email"'),'sign in email uses email autocomplete');
  assert.ok(signInHtml.includes('href="/forgot-password"')&&signInHtml.includes('href="/register"'),'sign in links to forgot password and register at their real URLs');
  await w.run(`submitSignIn({__data:{email:'ghost@example.com',password:'whatever phrase 1'}})`);
  const unknownError=w.elFor('#signInError').textContent;
  assert.equal(unknownError,'Email or password is not correct.','an unknown email gets the uniform sign in error');
  await w.run(`submitSignIn({__data:{email:'sam@example.com',password:'wrong wrong wrong'}})`);
  assert.equal(w.elFor('#signInError').textContent,unknownError,'a wrong password gets the byte identical error');
  await w.run(`submitSignIn({__data:{email:'una@example.com',password:'una long phrase 1'}})`);
  assert.equal(w.elFor('#signInError').textContent,'Please confirm your email first. We have sent you a new link.','the correct password on an unverified account is told to confirm, which only the password holder can reach');
  w.run("location.hash='#register';render()");
  await w.run(`submitRegister({__data:{name:'Sam',email:'sam@example.com',password:'another long phrase'}})`);
  const existingMessage=w.elFor('#registerMessage').textContent;
  await w.run(`submitRegister({__data:{name:'New',email:'new@example.com',password:'another long phrase'}})`);
  assert.equal(w.elFor('#registerMessage').textContent,existingMessage,'register shows the identical message for an existing and a new email');
  assert.equal(existingMessage,'Check your email to finish creating your account.','the register message is the uniform API message');
  await w.run(`submitRegister({__data:{name:'Two',email:'two@example.com',password:'short'}})`);
  assert.equal(w.elFor('#registerError').textContent,'Please use a password of at least 12 characters.','a password policy problem still surfaces on register');
  w.run("location.hash='#forgot-password';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('never confirmed your email'),'the forgot screen carries the help copy for unverified accounts');
  await w.run(`submitForgotPassword({__data:{email:'ghost@example.com'}})`);
  const forgotMessage=w.elFor('#forgotMessage').textContent;
  assert.equal(forgotMessage,'If an account matches that email, a reset link is on its way.','forgot password shows the uniform message');
  await w.run(`submitForgotPassword({__data:{email:'sam@example.com'}})`);
  assert.equal(w.elFor('#forgotMessage').textContent,forgotMessage,'forgot password shows the identical message for a known email');

  const w3=makeWorld({api,pathname:'/verify-email',search:'?token=not-a-real-token'});
  await flush();
  const invalid=w3.elFor('#main').innerHTML;
  assert.ok(invalid.includes('This link is invalid or has expired.'),'a bad verify token lands on the shared invalid link state');
  assert.ok(invalid.includes('Send a new link')&&invalid.includes('name="email"'),'the invalid state offers the resend field');
  await w3.run(`resendVerification({__data:{email:'una@example.com'}})`);
  assert.equal(w3.elFor('#verifyMessage').textContent,'Check your email to finish creating your account.','resend shows the uniform register message');
  assert.ok(api.state().verifyToken&&api.state().verifyToken!=='not-a-real-token','resend minted a fresh token for the unverified account');
  console.log('S3 passed: sign in, register, forgot password and token failures are indistinguishable across account existence on screen, exactly as the API answers.');
}

// ---------------------------------------------------------------- S4
{
  const api=makeFakeAccounts();
  api.seedUser({email:'rio@example.com',password:'rio long phrase 1',name:'Rio',verified:true});
  const w=makeWorld({api,pathname:'/sign-in',search:'?returnTo=/checkout',seed:{profiles:[PROFILE]}});
  await flush();
  assert.equal(w.location.hash,'#sign-in','entering at the real sign in URL selects the sign in screen');
  assert.ok(w.elFor('#main').innerHTML.includes('Welcome back.'),'the sign in screen renders from the real URL entry');
  await w.run(`submitSignIn({__data:{email:'rio@example.com',password:'rio long phrase 1'}})`);
  assert.equal(w.location.hash,'#checkout','a valid returnTo is honoured after sign in');
  assert.equal(w.run('accountState.user.email'),'rio@example.com','the client holds the signed in user');
  await w.run('signOut()');
  assert.equal(w.run('accountState.user'),null,'sign out clears the client account state');
  const nav=w.elFor('#accountNav').innerHTML;
  assert.ok(nav.includes('Sign in')&&!nav.includes('Sign out'),'sign out restores the guest header');
  assert.equal(JSON.parse(w.store.get('suits-profiles')).length,1,'local profiles survive sign out untouched');
  w.run('openProfiles()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('My measurements'),'local profiles remain usable after sign out');

  const w2=makeWorld({api,pathname:'/sign-in',search:'?returnTo='+encodeURIComponent('//evil.example/phish')});
  await flush();
  await w2.run(`submitSignIn({__data:{email:'rio@example.com',password:'rio long phrase 1'}})`);
  assert.equal(w2.location.hash,'#account','a protocol relative returnTo falls back to the account screen');
  const w3=makeWorld({api,pathname:'/sign-in',search:'?returnTo=/sign-in'});
  await flush();
  await w3.run(`submitSignIn({__data:{email:'rio@example.com',password:'rio long phrase 1'}})`);
  assert.equal(w3.location.hash,'#account','an auth path returnTo falls back to the account screen');
  const w4=makeWorld({api,pathname:'/sign-in'});
  await flush();
  await w4.run(`submitSignIn({__data:{email:'rio@example.com',password:'rio long phrase 1'}})`);
  assert.equal(w4.location.hash,'#account','with no returnTo, sign in lands on the account screen');
  console.log('S4 passed: returnTo is validated with the gateway rules, sign in lands where it should, and sign out restores the guest state with local data untouched.');
}

// ---------------------------------------------------------------- S5
{
  const api=makeFakeAccounts();
  api.seedUser({email:'max@example.com',password:'max long phrase 1',name:'Max',verified:true});
  const guest=makeWorld({api,seed:{bag:[BAG_ITEM]}});
  await flush();
  const guestCheckout=guest.run('checkoutPage()');
  assert.ok(guestCheckout.includes('Have an account?'),'enabled guest: the checkout strip asks about an account');
  assert.ok(guestCheckout.includes('href="/sign-in?returnTo=/checkout"'),'the strip sign in link returns the shopper to checkout');
  assert.ok(guestCheckout.includes('Sign in</a> to use your saved measurements.'),'the strip carries the design copy');
  const w=makeWorld({api,seed:{bag:[BAG_ITEM]}});
  await flush();
  await w.run(`submitSignIn({__data:{email:'max@example.com',password:'max long phrase 1'}})`);
  const signedCheckout=w.run('checkoutPage()');
  assert.ok(signedCheckout.includes('Signed in as max@example.com. Your profiles sync to your account.'),'signed in: the checkout strip names the account, in the design copy');
  assert.ok(!signedCheckout.includes('Have an account?'),'signed in: the guest strip copy is gone');
  console.log('S5 passed: the checkout strip shows the guest prompt with a checkout returnTo while enabled, and the signed in line while signed in.');
}

// ---------------------------------------------------------------- S6
{
  const api=makeFakeAccounts();
  api.seedUser({email:'kim@example.com',password:'kim old phrase 1',name:'Kim',verified:true});
  const w=makeWorld({api});
  await flush();
  w.run("location.hash='#forgot-password';render()");
  await w.run(`submitForgotPassword({__data:{email:'kim@example.com'}})`);
  const token=api.state().resetToken;
  assert.ok(token,'the reset email carried a token');
  const w2=makeWorld({api,pathname:'/reset-password',search:'?token='+token});
  await flush();
  const resetHtml=w2.elFor('#main').innerHTML;
  assert.ok(resetHtml.includes('Choose a new password.'),'the reset screen renders from the emailed link');
  assert.ok(resetHtml.includes('autocomplete="new-password"'),'the reset fields use new-password autocomplete');
  assert.ok(resetHtml.includes(`value="${token}"`),'the reset form carries the token from the link');
  const resetCalls=()=>api.calls.filter(c=>c.path==='/api/auth/reset-password').length;
  const before=resetCalls();
  await w2.run(`submitResetPassword({__data:{token:'${token}',password:'kim new phrase 1',confirmation:'kim new phrase 2'}})`);
  assert.equal(w2.elFor('#resetError').textContent,'The passwords do not match.','a mismatched confirmation is refused on the client');
  assert.equal(resetCalls(),before,'a mismatched confirmation never reaches the API');
  await w2.run(`submitResetPassword({__data:{token:'${token}',password:'kim new phrase 1',confirmation:'kim new phrase 1'}})`);
  assert.equal(w2.location.hash,'#account','a successful reset signs in and lands on the account screen');
  assert.equal(w2.run('accountState.user.email'),'kim@example.com','the client holds the user after reset');
  await w2.run(`submitChangePassword({__data:{currentPassword:'not the password',newPassword:'kim newer phrase 1'}})`);
  assert.equal(w2.elFor('#changePasswordError').textContent,'Email or password is not correct.','a wrong current password returns the sign in error body');
  await w2.run(`submitChangePassword({__data:{currentPassword:'kim new phrase 1',newPassword:'kim newer phrase 1'}})`);
  assert.equal(w2.elFor('#changePasswordMessage').textContent,'Your password has been changed.','a correct change is confirmed on the account screen');
  await w2.run('signOut()');
  w2.run("location.hash='#sign-in';render()");
  await w2.run(`submitSignIn({__data:{email:'kim@example.com',password:'kim new phrase 1'}})`);
  assert.equal(w2.elFor('#signInError').textContent,'Email or password is not correct.','the superseded password no longer signs in');
  await w2.run(`submitSignIn({__data:{email:'kim@example.com',password:'kim newer phrase 1'}})`);
  assert.equal(w2.run('accountState.user.email'),'kim@example.com','the newest password signs in');
  console.log('S6 passed: the reset link journey and the change password form behave end to end, with only the newest password valid.');
}

// ---------------------------------------------------------------- S7
{
  const api=makeFakeAccounts();
  const w=makeWorld({api});
  await flush();
  const screens={
    'sign in':w.run('signInPage()'),
    'register':w.run('registerPage()'),
    'forgot password':w.run('forgotPasswordPage()'),
    'reset password':w.run('resetPasswordPage()'),
    'account':w.run('accountPage()'),
  };
  for(const [name,html] of Object.entries(screens)){
    assert.ok(!html.includes('onpaste'),name+': paste is never blocked (design 3.2)');
    assert.ok(!html.includes('\u2014'),name+': screen copy carries no banned punctuation');
  }
  assert.ok(screens['sign in'].includes('name="password" type="password" required autocomplete="current-password"'),'sign in password field carries current-password');
  assert.ok(screens['register'].includes('autocomplete="new-password"'),'register password field carries new-password');
  assert.ok(screens['reset password'].includes('autocomplete="new-password"'),'reset password fields carry new-password');
  const shell=fs.readFileSync('public/index.html','utf8');
  assert.ok(shell.includes('<span id="accountNav"></span>'),'the shell carries the empty account slot in the header actions');
  assert.ok(shell.indexOf('id="accountNav"')>shell.indexOf('measurement-shortcut'),'the account slot sits beside Your measurements, where the design puts the entry point');
  console.log('S7 passed: the auth screens carry the design autocomplete attributes, never block paste, and the header slot sits where the design puts the entry point.');
}

// ---------------------------------------------------------------- S8
{
  const api=makeFakeAccounts();
  api.seedUser({email:'syn@example.com',password:'syn long phrase 1',name:'Syn',verified:true});
  const w=makeWorld({api});
  await flush();
  await w.run(`submitSignIn({__data:{email:'syn@example.com',password:'syn long phrase 1'}})`);
  await flush();
  assert.equal(w.run('accountState.user.email'),'syn@example.com');
  // Create: drive the real wizard save with a complete draft. The
  // save still writes the profile locally, and it also writes
  // through to the account (design section 5.2).
  const values='{chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42}';
  w.run(`draft.method='body';draft.unit='in';draft.values=${values};draft.name='Synced measurements';draft.fit='Tailored';draft.step=3;saveDraft()`);
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  await flush();
  let localProfiles=JSON.parse(w.store.get('suits-profiles'));
  assert.equal(localProfiles.length,1,'the wizard save still writes the profile locally');
  const savedId=localProfiles[0].id;
  const posts=api.calls.filter(c=>c.path==='/api/account/profiles'&&c.method==='POST');
  assert.equal(posts.length,1,'the save wrote through to the profiles API');
  assert.equal(posts[0].body.profile.id,savedId,'the write through carries the client profile id');
  assert.ok(!('step' in posts[0].body.profile),'the write through drops the transient step field');
  assert.equal(api.accountProfiles('syn@example.com').length,1,'the account holds the new profile');
  assert.equal(api.accountProfiles('syn@example.com')[0].name,'Synced measurements');
  // Delete: the local delete goes to the API as well.
  w.run(`deleteProfile('${savedId}')`);
  await flush();
  assert.equal(JSON.parse(w.store.get('suits-profiles')).length,0,'the delete still applies locally');
  assert.ok(api.calls.some(c=>c.path==='/api/account/profiles/'+savedId&&c.method==='DELETE'),'the delete wrote through to the profiles API');
  assert.equal(api.accountProfiles('syn@example.com').length,0,'the account copy is deleted too');
  // A failed write keeps the local change and the modal says so,
  // in the design's words, until a later sync lands it.
  api.control.failAccountWrites=true;
  w.run(`draft.values=${values};draft.name='Offline measurements';draft.step=3;saveDraft()`);
  w.elFor('#confirmMeasures').checked=true;
  w.run('measureNext()');
  await flush();
  localProfiles=JSON.parse(w.store.get('suits-profiles'));
  assert.equal(localProfiles.length,1,'a failed account write keeps the local profile');
  assert.equal(api.accountProfiles('syn@example.com').length,0,'the failed write reached no account copy');
  w.run('openProfiles()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Not saved to your account yet'),'the profiles modal surfaces the unsaved state in the design words');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Offline measurements'),'the unsaved profile is listed and usable');
  api.control.failAccountWrites=false;
  await w.run('signOut()');
  await w.run(`submitSignIn({__data:{email:'syn@example.com',password:'syn long phrase 1'}})`);
  await flush();
  assert.equal(api.accountProfiles('syn@example.com').length,1,'the next sign in retries the outstanding save');
  assert.equal(api.accountProfiles('syn@example.com')[0].name,'Offline measurements');
  w.run('openProfiles()');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Profiles save to your account and this browser.'),'once the retry lands, the modal line is the synced line again');
  console.log('S8 (create and delete) passed: signed in saves and deletes write through to the account, a failed write keeps the local profile with the design surfacing copy, and the next sign in retries it.');
}
{
  const api=makeFakeAccounts();
  api.seedUser({email:'two@example.com',password:'two long phrase 1',name:'Two',verified:true});
  const a=makeWorld({api});
  await flush();
  await a.run(`submitSignIn({__data:{email:'two@example.com',password:'two long phrase 1'}})`);
  a.run(`draft.method='body';draft.unit='in';draft.values={chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42};draft.name='Browser one profile';draft.fit='Tailored';draft.step=3;saveDraft()`);
  a.elFor('#confirmMeasures').checked=true;
  a.run('measureNext()');
  await flush();
  assert.equal(api.accountProfiles('two@example.com').length,1,'browser one saved its profile to the account');
  await a.run('signOut()');
  // A second browser for the same account starts empty (the fake
  // session stands in for this browser's cookie, so browser one
  // signs out first) and pulls the account profiles down when its
  // shopper signs in.
  const b=makeWorld({api});
  await flush();
  assert.equal(JSON.parse(b.store.get('suits-profiles')||'[]').length,0,'the second browser starts with no local profiles');
  await b.run(`submitSignIn({__data:{email:'two@example.com',password:'two long phrase 1'}})`);
  await flush();
  const pulled=JSON.parse(b.store.get('suits-profiles'));
  assert.equal(pulled.length,1,'sign in pulled the account profile down');
  assert.equal(pulled[0].name,'Browser one profile');
  b.run('openProfiles()');
  assert.ok(b.elFor('#modalContent').innerHTML.includes('Browser one profile'),'the pulled down profile is listed on the second browser');
  await b.run('signOut()');
  // Conflict over a shared id: the local copy differs, but the
  // server list is the account's copy (section 5.2), so signing in
  // settles the id to the account version and keeps it one row.
  const localVersion={...PROFILE,id:pulled[0].id,name:'Local edit',values:{...PROFILE.values,chest:44}};
  const c=makeWorld({api,seed:{profiles:[localVersion]}});
  await flush();
  await c.run(`submitSignIn({__data:{email:'two@example.com',password:'two long phrase 1'}})`);
  await flush();
  const merged=JSON.parse(c.store.get('suits-profiles'));
  assert.equal(merged.length,1,'a shared id stays one profile, never a duplicate');
  assert.equal(merged[0].name,'Browser one profile','the account copy wins for a shared id');
  assert.equal(merged[0].values.chest,40,'the account measurements win for a shared id');
  console.log('S8 (second browser) passed: sign in on a fresh browser pulls the account profiles down, and a shared id resolves to the account copy.');
}

// ---------------------------------------------------------------- J25
{
  const api=makeFakeAccounts();
  api.seedUser({email:'mig@example.com',password:'mig long phrase 1',name:'Mig',verified:true});
  const second={...PROFILE,id:'p2',name:'Wedding measurements',created:'2026-01-02T00:00:00.000Z'};
  const demoOrder={id:'DEMO-TEST1',created:'2026-01-03T00:00:00.000Z',items:[{...BAG_ITEM}],shipping:{email:'mig@example.com'},total:399,status:'Demo order recorded',demo:true};
  const w=makeWorld({api,seed:{profiles:[PROFILE,second],orders:[demoOrder],bag:[BAG_ITEM]}});
  await flush();
  await w.run(`submitSignIn({__data:{email:'mig@example.com',password:'mig long phrase 1'}})`);
  await flush();
  const offer=w.elFor('#modalContent').innerHTML;
  assert.ok(offer.includes('Your measurements, saved to your account.'),'the first sign in offers the migration in the design words');
  assert.ok(offer.includes('This browser has 2 measurement profiles saved.'),'the offer counts the local profiles');
  assert.ok(offer.includes('Your orders recorded on this browser (1) come along as view only history, marked as demo records.'),'the offer counts the local orders and marks them demo records');
  assert.ok(offer.includes('Nothing is removed from this browser.'),'the offer promises nothing is removed');
  assert.ok(offer.includes('Add to my account')&&offer.includes('Not now'),'the offer carries the design buttons');
  assert.equal(api.calls.filter(c=>c.path==='/api/account/import').length,0,'no import happens before the shopper accepts');
  await w.run('confirmImport()');
  const imports=api.calls.filter(c=>c.path==='/api/account/import');
  assert.equal(imports.length,1,'accepting posts exactly one import');
  assert.deepEqual(imports[0].body.profiles,[PROFILE,second],'the import carried exactly the local profiles');
  assert.deepEqual(imports[0].body.orders,[demoOrder],'the import carried exactly the local orders');
  const done=w.elFor('#modalContent').innerHTML;
  assert.ok(done.includes('Added 2 profiles; 0 were already in your account.'),'the confirmation reports the imported and skipped profile counts');
  assert.ok(done.includes('Added 1 order as view only history; 0 were already in your account.'),'the confirmation reports the snapshot counts');
  assert.equal(api.accountProfiles('mig@example.com').length,2,'the account now holds both profiles');
  assert.equal(api.accountOrders('mig@example.com').length,1,'the account holds the order snapshot');
  assert.equal(api.accountOrders('mig@example.com')[0].demo,true,'the snapshot stays marked as a demo record');
  assert.deepEqual(JSON.parse(w.store.get('suits-profiles')),[PROFILE,second],'local profiles are untouched by the import');
  assert.deepEqual(JSON.parse(w.store.get('suits-orders')),[demoOrder],'local orders are untouched by the import');
  assert.deepEqual(JSON.parse(w.store.get('suits-bag')),[BAG_ITEM],'the bag is never migrated and stays untouched');
  w.run('openProfiles()');
  const modal=w.elFor('#modalContent').innerHTML;
  assert.ok(modal.includes('Profiles save to your account and this browser.'),'after import the profiles modal shows the account saved line');
  assert.ok(modal.includes('My measurements')&&modal.includes('Wedding measurements'),'the profiles modal lists the imported profiles as account saved');
  // Asked once: a later sign in on this browser does not offer again.
  w.run('closeModal()');
  await w.run('signOut()');
  await w.run(`submitSignIn({__data:{email:'mig@example.com',password:'mig long phrase 1'}})`);
  await flush();
  assert.equal(w.elFor('#modal').open,false,'the migration is not offered twice');
  assert.equal(api.calls.filter(c=>c.path==='/api/account/import').length,1,'no second import is posted');
  console.log('J25 (accept) passed: the offer is made once in the design words, the import carries exactly the local arrays, counts are confirmed, and nothing local is removed or migrated from the bag.');
}
{
  const api=makeFakeAccounts();
  api.seedUser({email:'dis@example.com',password:'dis long phrase 1',name:'Dis',verified:true});
  const w=makeWorld({api,seed:{profiles:[PROFILE]}});
  await flush();
  await w.run(`submitSignIn({__data:{email:'dis@example.com',password:'dis long phrase 1'}})`);
  await flush();
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Your measurements, saved to your account.'),'the offer appears on the dismiss path too');
  w.run('dismissImport()');
  assert.equal(w.elFor('#modal').open,false,'Not now closes the offer');
  const uid=w.run('accountState.user.id');
  assert.equal(w.store.get('suits-import-dismissed:'+uid),'1','Not now is remembered per account on this browser, under the design flag');
  assert.equal(api.calls.filter(c=>c.path==='/api/account/import').length,0,'dismissing imports nothing');
  await w.run('signOut()');
  await w.run(`submitSignIn({__data:{email:'dis@example.com',password:'dis long phrase 1'}})`);
  await flush();
  assert.equal(w.elFor('#modal').open,false,'a dismissed offer is not repeated on the next sign in');
  // The account page still runs the same import by hand.
  w.run("location.hash='#account';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('Import from this browser'),'the account page carries the import button');
  await w.run('importFromAccount()');
  assert.equal(api.calls.filter(c=>c.path==='/api/account/import').length,1,'the account button runs the same import call');
  assert.ok(w.elFor('#importMessage').textContent.includes('Added 1 profile; 0 were already in your account.'),'the account page reports the import counts');
  assert.equal(api.accountProfiles('dis@example.com').length,1,'the manual import lands the profile');
  assert.deepEqual(JSON.parse(w.store.get('suits-profiles')),[PROFILE],'the manual import also removes nothing locally');
  console.log('J25 (dismiss) passed: Not now is remembered under the design flag, the offer is not repeated, and the account page import button runs the same call later.');
}

// ---------------------------------------------------------------- S9
{
  const api=makeFakeAccounts();
  api.seedUser({email:'ord@example.com',password:'ord long phrase 1',name:'Ord',verified:true});
  const demoOrder={id:'DEMO-TEST1',created:'2026-01-03T00:00:00.000Z',items:[{...BAG_ITEM}],shipping:{email:'ord@example.com'},total:399,status:'Demo order recorded',demo:true};
  const w=makeWorld({api,seed:{orders:[demoOrder]}});
  await flush();
  await w.run(`submitSignIn({__data:{email:'ord@example.com',password:'ord long phrase 1'}})`);
  await flush();
  // Accept the migration offer, so the demo order also lives in
  // the account as a snapshot, then seed a real paid order placed
  // from another device, in the store order shape the API returns.
  await w.run('confirmImport()');
  await flush();
  w.run('closeModal()');
  assert.equal(api.accountOrders('ord@example.com').length,1,'the import placed the snapshot in the account');
  api.seedRealOrder('ord@example.com',{id:'SMREALORDER1',created_at:'2026-02-01T00:00:00.000Z',items:[{...BAG_ITEM}],shipping:{email:'ord@example.com',firstName:'Ord',lastName:'Test',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'},status:'paid',total_cents:45900});
  w.run("location.hash='#orders';render()");
  await flush();
  const page=w.elFor('#main').innerHTML;
  assert.ok(page.includes('Orders from your account and this browser.'),'signed in: the orders page speaks of the account and this browser');
  assert.ok(page.includes('SMREALORDER1'),'the account real order renders on this browser');
  assert.ok(page.includes('$459'),'the real order total renders from its total_cents');
  assert.ok(page.includes('Demo record'),'the imported snapshot is badged as a demo record');
  assert.equal((page.match(/class="order-row"/g)||[]).length,2,'the snapshot and its local copy render as one row, beside the real order');
  assert.equal((page.match(/Demo record/g)||[]).length,1,'only the snapshot carries the badge');
  assert.ok(page.indexOf('SMREALORDER1')<page.indexOf('DEMO-TEST1'),'the merged history is newest first');
  // The account order opens its detail page from the merged list.
  w.run("location.hash='#order/SMREALORDER1';render()");
  await flush();
  assert.ok(w.elFor('#main').innerHTML.includes('Thank you for your order.'),'the account order detail renders from the merged list');
  // Signing out returns the page to the browser only history:
  // no account orders, no badges, the original intro line.
  await w.run('signOut()');
  w.run("location.hash='#orders';render()");
  await flush();
  const guestPage=w.elFor('#main').innerHTML;
  assert.ok(guestPage.includes('Orders saved on this browser.'),'signed out: the orders page is the browser only page again');
  assert.ok(!guestPage.includes('SMREALORDER1')&&!guestPage.includes('Demo record'),'signed out: no account orders and no badges remain');
  console.log('S9 (merged orders) passed: the signed in orders page renders one history from the account endpoint, real orders beside local ones with snapshots badged as demo records and never duplicated, newest first, account order details open, and sign out restores the browser only page.');
}
{
  // A fresh browser for the same account holds nothing locally;
  // its orders page is the account history on its own.
  const api=makeFakeAccounts();
  api.seedUser({email:'fresh@example.com',password:'fresh long phrase 1',name:'Fresh',verified:true});
  api.seedRealOrder('fresh@example.com',{id:'SMFRESH1',created_at:'2026-02-02T00:00:00.000Z',items:[{...BAG_ITEM}],shipping:{email:'fresh@example.com'},status:'paid',total_cents:12000});
  const w=makeWorld({api});
  await flush();
  await w.run(`submitSignIn({__data:{email:'fresh@example.com',password:'fresh long phrase 1'}})`);
  await flush();
  w.run("location.hash='#orders';render()");
  await flush();
  const page=w.elFor('#main').innerHTML;
  assert.ok(page.includes('SMFRESH1')&&page.includes('$120'),'a fresh browser sees the account order history on its orders page');
  console.log('S9 (fresh browser) passed: an account with orders and an empty browser shows the account history alone.');
}

// ---------------------------------------------------------------- J24
{
  const api=makeFakeAccounts();
  api.seedUser({email:'par@example.com',password:'par long phrase 1',name:'Par',verified:true});
  const ready={id:'p-ready',name:'Ready profile',method:'ready',wearer:'Men',fit:'Tailored',ready:{jacket:'40',length:'Regular',trouser:'34'},created:'2026-01-01T00:00:00.000Z'};
  const guest=makeWorld({api,seed:{profiles:[ready]}});
  const signed=makeWorld({api,seed:{profiles:[ready]}});
  await flush();
  await signed.run(`submitSignIn({__data:{email:'par@example.com',password:'par long phrase 1'}})`);
  await flush();
  assert.equal(signed.run('accountState.user.email'),'par@example.com','the parity world is signed in');
  assert.equal(guest.run('accountState.user'),null,'the comparison world stays a guest');
  // The one designed header difference: the account slot itself.
  assert.ok(guest.elFor('#accountNav').innerHTML.includes('Sign in')&&guest.elFor('#accountNav').innerHTML.includes('href="/sign-in"'),'the guest header offers Sign in');
  assert.ok(signed.elFor('#accountNav').innerHTML.includes('My account')&&signed.elFor('#accountNav').innerHTML.includes('Sign out'),'the signed in header offers the account menu');
  // Menus: byte level parity is the gate, not a sample.
  assert.ok(guest.elFor('#catalogNav').innerHTML.includes('id="nav-0"'),'the menus rendered in the guest world');
  assert.equal(signed.elFor('#catalogNav').innerHTML,guest.elFor('#catalogNav').innerHTML,'the rendered menus are byte identical signed in and as guest');
  // Home, listings and a product page: byte identical, with both
  // worlds walked in the same order so their listing state moves
  // in lockstep.
  assert.equal(signed.run('home()'),guest.run('home()'),'the home screen is byte identical signed in');
  for(const hash of ['#collection/Suits/Wool%20Suits','#collection/Trousers','#collection/Women']){
    assert.equal(signed.run(`categoryCollection('${hash}')`),guest.run(`categoryCollection('${hash}')`),'the collection listing is byte identical signed in: '+hash);
  }
  assert.equal(signed.run('productPage(0)'),guest.run('productPage(0)'),'the product page is byte identical signed in');
  // The customizer: identical renders at every stage, then the
  // priced customization of J17 driven in both worlds.
  for(const w of [guest,signed]){w.run('chooseProduct(0)');w.run('beginDesign(0)');}
  assert.equal(signed.run('customize()'),guest.run('customize()'),'the customizer fabric step is byte identical signed in');
  const base=signed.run('products[0].price');
  for(const w of [guest,signed]){
    w.run('nextConfig()'); // stage 0 to 1, Personalize
    w.run("setOption('tier','Make it a tuxedo');setOption('vest','Classic vest')");
    w.run("setOption('vestFabricBack','Fabric back');setOption('additionalPants','Yes');setOption('squareAndTie','Yes');config.monogram='AB';config.monogram2='CD';config.collarMonogram='EF';saveConfig()");
  }
  assert.equal(signed.run('customize()'),guest.run('customize()'),'the Personalize step with every priced extra chosen is byte identical signed in');
  assert.ok(signed.run('customize()').includes('$'+(base+368)),'the signed in customizer price carries every extra (50+99+20+140+39+10+10)');
  for(const w of [guest,signed]){
    w.run('nextConfig()'); // stage 1 to 2, Measurements
    w.elFor('#profileSelect').value='p-ready';
    w.run('nextConfig()'); // Add to Bag
  }
  const guestBag=JSON.parse(guest.store.get('suits-bag')),signedBag=JSON.parse(signed.store.get('suits-bag'));
  assert.equal(signedBag.length,1,'the signed in journey bags exactly one suit');
  assert.equal(guestBag.length,1,'the guest journey bags exactly one suit');
  const stripIds=items=>items.map(item=>{const copy={...item};delete copy.id;return copy});
  assert.deepEqual(stripIds(signedBag),stripIds(guestBag),'the bagged item is identical signed in and as guest, its random line id aside');
  assert.equal(signedBag[0].vest,'Classic vest','the signed in bag stores the vest');
  assert.equal(signed.run('subtotal()'),base+368,'the signed in subtotal is the Wave 3 total for this configuration');
  assert.equal(guest.run('subtotal()'),base+368,'the guest subtotal is the same Wave 3 total');
  assert.equal(signed.run('lineHtml(bag[0],false)'),guest.run('lineHtml(bag[0],false)'),'the bag line is byte identical signed in');
  // Checkout: byte identical once the one designed difference,
  // the account strip line, is set aside, and each strip is the
  // copy its state requires.
  const signedCheckout=signed.run('checkoutPage()'),guestCheckout=guest.run('checkoutPage()');
  assert.ok(signedCheckout.includes('Signed in as par@example.com. Your profiles sync to your account.'),'the signed in checkout carries the signed in strip');
  assert.ok(guestCheckout.includes('Have an account?'),'the guest checkout carries the guest strip');
  const stripLine=/<p class="account-strip">.*?<\/p>/;
  assert.equal(signedCheckout.replace(stripLine,''),guestCheckout.replace(stripLine,''),'checkout is byte identical signed in apart from the account strip line');
  assert.ok(signedCheckout.includes('$'+(base+368))&&guestCheckout.includes('$'+(base+368)),'both checkouts total the configured price');
  // The bag persists across re renders while signed in.
  const bagJson=signed.store.get('suits-bag'),lineBefore=signed.run('lineHtml(bag[0],false)');
  signed.run("location.hash='#home';render()");
  assert.equal(signed.elFor('#main').innerHTML,guest.run('home()'),'re rendering home while signed in still matches the guest home');
  assert.equal(signed.store.get('suits-bag'),bagJson,'the bag survives a re render untouched');
  signed.run("location.hash='#checkout';render()");
  assert.equal(signed.store.get('suits-bag'),bagJson,'the bag survives the move to checkout');
  assert.equal(signed.run('lineHtml(bag[0],false)'),lineBefore,'the bag line renders the same after the re renders');
  assert.equal(String(signed.elFor('#bagCount').textContent),'1','the bag count still shows the item');
  // Demo checkout completes to the order page while signed in,
  // with the configured total intact.
  assert.ok(signed.elFor('#main').innerHTML.includes('checkoutForm'),'checkout opens on the delivery form');
  signed.run(`saveCheckoutForm({__data:{email:'par@example.com',firstName:'Par',lastName:'Parity',address:'3 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(signed.run('checkoutStage'),1,'the delivery form advances to review and payment');
  signed.elFor('#orderConsent').checked=true;
  await signed.run('submitCheckout()');
  await flush();
  const orders=JSON.parse(signed.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the signed in demo checkout records exactly one order');
  assert.equal(orders[0].demo,true,'the recorded order is a demo order');
  assert.equal(orders[0].total,base+368,'the order total is the configured total, extras included');
  assert.equal(orders[0].items[0].vest,'Classic vest','the order item keeps the vest');
  assert.equal(signed.location.hash,'#order/'+orders[0].id,'placing the order lands on its order page');
  assert.ok(signed.elFor('#main').innerHTML.includes('DEMONSTRATION COMPLETE'),'the order page renders the demo completion screen');
  assert.equal(JSON.parse(signed.store.get('suits-bag')).length,0,'the bag is empty after the order is placed');
  console.log('J24 passed: signed in, the menus are byte identical to the guest world, and so are home, three listings, a product page and every customizer stage; the priced customization lands at the Wave 3 total (base + 368) with an identical bag line, checkout differs only in the designed account strip line, the bag persists across re renders, and demo checkout completes to the order page (package 5.8).');
}

// ---------------------------------------------------------------- J26
{
  const api=makeFakeAccounts();
  api.seedUser({email:'out@example.com',password:'out long phrase 1',name:'Out',verified:true});
  const w=makeWorld({api,seed:{profiles:[PROFILE],bag:[BAG_ITEM]}});
  await flush();
  await w.run(`submitSignIn({__data:{email:'out@example.com',password:'out long phrase 1'}})`);
  await flush();
  assert.equal(w.run('accountState.user.email'),'out@example.com','the journey starts signed in');
  assert.ok(w.elFor('#accountNav').innerHTML.includes('Sign out'),'the signed in header shows the account menu');
  w.run('dismissImport()'); // the migration offer is J25's subject; this journey signs out
  await w.run('signOut()');
  await flush();
  assert.equal(w.run('accountState.user'),null,'sign out clears the client account state');
  assert.equal(api.state().session,null,'sign out ends the API session');
  const nav=w.elFor('#accountNav').innerHTML;
  assert.ok(nav.includes('Sign in')&&nav.includes('href="/sign-in"'),'after sign out the header shows Sign in again');
  assert.ok(!nav.includes('Sign out')&&!nav.includes('My account'),'after sign out the account menu is gone');
  // The restored guest is the guest: byte parity with a fresh
  // guest world holding the same browser data.
  const guest=makeWorld({api,seed:{profiles:[PROFILE],bag:[BAG_ITEM]}});
  await flush();
  assert.equal(guest.run('accountState.user'),null,'the comparison world is a guest');
  assert.equal(w.elFor('#accountNav').innerHTML,guest.elFor('#accountNav').innerHTML,'the restored header slot is byte identical to a fresh guest');
  assert.equal(w.elFor('#catalogNav').innerHTML,guest.elFor('#catalogNav').innerHTML,'the menus are byte identical after sign out');
  assert.equal(w.run('home()'),guest.run('home()'),'home is byte identical after sign out');
  assert.equal(w.run("categoryCollection('#collection/Suits/Wool%20Suits')"),guest.run("categoryCollection('#collection/Suits/Wool%20Suits')"),'the listing is byte identical after sign out');
  assert.equal(w.run('checkoutPage()'),guest.run('checkoutPage()'),'checkout is byte identical after sign out, guest strip included');
  assert.ok(w.run('checkoutPage()').includes('Have an account?'),'the guest checkout strip is back after sign out');
  assert.equal(w.run('ordersPage()'),guest.run('ordersPage()'),'the orders page is the browser only page again');
  w.run('openProfiles()');guest.run('openProfiles()');
  assert.equal(w.elFor('#modalContent').innerHTML,guest.elFor('#modalContent').innerHTML,'the profiles modal is byte identical after sign out');
  assert.ok(w.elFor('#modalContent').innerHTML.includes('Profiles are saved on this browser.'),'the profiles modal shows the guest line again');
  w.run('closeModal()');
  // The full guest purchase down the J1 path: the menu's Wool
  // Suits destination, its collection, a product, the customizer
  // with the local profile driving the measurements, the bag and
  // a completed demo checkout.
  assert.ok(w.elFor('#catalogNav').innerHTML.includes('href="/collections/suits/wool-suits"'),'the menu still offers the Wool Suits destination');
  const firstId=w.run("merchantSuitCollections['Wool Suits'].ids[0]");
  const base=w.run(`products[${firstId}].price`);
  w.run(`chooseProduct(${firstId})`);
  assert.equal(w.run('location.hash'),'#product/'+firstId,'opening the product lands on its product page');
  assert.ok(w.run(`productPage(${firstId})`).includes(w.run(`products[${firstId}].name`)),'the product page renders after sign out');
  w.run(`beginDesign(${firstId})`);
  assert.equal(w.run('location.hash'),'#customize','designing lands on the customizer after sign out');
  w.run('nextConfig()'); // stage 0 to 1, Personalize
  w.run("setOption('lining','Wine')");
  w.run('nextConfig()'); // stage 1 to 2, Measurements
  assert.ok(w.run('customize()').includes('My measurements'),'the local profile is offered in the customizer after sign out');
  w.elFor('#profileSelect').value='p1';
  w.run('nextConfig()'); // Add to Bag, beside the bag's existing item
  const bagNow=JSON.parse(w.store.get('suits-bag'));
  assert.equal(bagNow.length,2,'the purchase adds to the bag that was already on this browser');
  assert.equal(w.run('bag[bag.length-1].profile.name'),'My measurements','the bagged suit carries the local profile');
  assert.equal(w.run('bag[bag.length-1].lining'),'Wine','the bagged suit carries the chosen lining');
  assert.equal(w.run('itemPrice(bag[bag.length-1])'),base+15,'the bagged suit prices the Wine lining over the base price');
  assert.ok(w.run('lineHtml(bag[bag.length-1],false)').includes('Wine lining'),'the bag line shows the chosen lining');
  w.run("location.hash='#checkout';render()");
  assert.ok(w.elFor('#main').innerHTML.includes('checkoutForm'),'checkout opens on the delivery form');
  w.run(`saveCheckoutForm({__data:{email:'out@example.com',firstName:'Out',lastName:'Guest',address:'2 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'the delivery form advances to review and payment');
  w.elFor('#orderConsent').checked=true;
  await w.run('submitCheckout()');
  await flush();
  const orders=JSON.parse(w.store.get('suits-orders')||'[]');
  assert.equal(orders.length,1,'the guest purchase records exactly one demo order');
  assert.equal(orders[0].demo,true,'the recorded order is a demo order');
  assert.equal(orders[0].items.length,2,'the order carries both bag items');
  assert.equal(orders[0].items[1].lining,'Wine','the order keeps the configured suit');
  assert.equal(w.location.hash,'#order/'+orders[0].id,'the purchase lands on its order page');
  assert.ok(w.elFor('#main').innerHTML.includes('DEMONSTRATION COMPLETE'),'the order page renders the demo completion screen');
  assert.deepEqual(JSON.parse(w.store.get('suits-profiles')),[PROFILE],'the local profile is untouched by the whole sign in, sign out and purchase cycle');
  console.log('J26 passed: after sign out the header shows Sign in again, the restored guest is byte identical to a fresh guest across the header, menus, home, listing, checkout, orders page and profiles modal, and a full guest purchase down the J1 path completes with the local profile driving the measurements (package 5.8).');
}

// ---------------------------------------------------------------- S10
// Wave 6 package 6.0: the sandbox review copy matches what sandbox
// actually charges. Sandbox mode adds no shipping and no tax (the
// server totals branch runs only in live mode), so the review step
// must not tell the shopper that delivery and tax are still to be
// calculated. Live mode keeps the existing calculated copy until
// package 6.1 shows the real totals, and the demo copy is untouched.
{
  const w=makeWorld({seed:{bag:[BAG_ITEM],profiles:[PROFILE]}});
  await flush();
  w.run("paymentConfig={mode:'sandbox',ready:true}");
  const sandbox=w.run('checkoutPage()');
  assert.ok(sandbox.includes('Not charged in sandbox'),'sandbox: the review step says delivery and tax are not charged');
  assert.ok(!sandbox.includes('Calculated by merchant settings')&&!sandbox.includes('Calculated before payment'),'sandbox: no calculated later copy remains');
  assert.ok(sandbox.includes('<span>Total</span>'),'sandbox: the subtotal is labelled as the total, because it is the total charged');
  assert.ok(!sandbox.includes('Merchandise total'),'sandbox: the subtotal is not labelled a merchandise only total');
  w.run("paymentConfig={mode:'live',ready:true}");
  const live=w.run('checkoutPage()');
  assert.ok(live.includes('Calculated by merchant settings')&&live.includes('Calculated before payment')&&live.includes('Merchandise total'),'live: the review copy is unchanged until package 6.1');
  w.run("paymentConfig={mode:'demo',ready:false}");
  assert.ok(w.run('checkoutPage()').includes('Demo total'),'demo: the review copy is unchanged');
  console.log('S10 passed: sandbox review copy states that delivery and tax are not charged and labels the subtotal as the total, matching what sandbox charges; live and demo review copy are unchanged (package 6.0).');
}

// ---------------------------------------------------------------- J32
// Wave 6 package 6.1: in live mode the review step shows the
// server quoted shipping, tax and full total before the shopper
// is sent to the hosted payment page (finding F3: the client
// never computes or invents tax, it asks POST /api/checkout/quote
// and renders what the server answers), and the payment return
// for an order whose 24 hour payment window has closed explains
// the expiry instead of sitting on the confirming page (F8d).
// The server half of J32 lives in tests/commerce.cjs.
{
  const base=makeFakeAccounts({enabled:false});
  const quoteCalls=[];
  let orderReply=null;
  const api={...base,fetch:async(url,opts={})=>{
    const path=String(url);
    if(path==='/api/checkout/quote'){quoteCalls.push(JSON.parse(opts.body));return{ok:true,status:200,json:async()=>({mode:'live',subtotalCents:7900,shippingCents:1200,taxCents:632,totalCents:9732})};}
    if(path.startsWith('/api/orders/'))return{ok:true,status:200,json:async()=>orderReply};
    return base.fetch(url,opts);
  }};
  const w=makeWorld({api,seed:{bag:[BAG_ITEM],profiles:[PROFILE]}});
  await flush();
  w.run("paymentConfig={mode:'live',ready:true}");
  w.run("location.hash='#checkout';render()");
  w.run(`saveCheckoutForm({__data:{email:'live@example.com',firstName:'Live',lastName:'Review',address:'3 Main Street',city:'New York',state:'NY',zip:'10001',country:'US'}})`);
  assert.equal(w.run('checkoutStage'),1,'J32: the delivery form advances to the review step');
  let html=w.elFor('#main').innerHTML;
  assert.ok(html.includes('Calculated before payment')&&html.includes('Merchandise total'),'J32: before the quote returns, the review keeps the calculated later copy');
  assert.equal(quoteCalls.length,1,'J32: entering the review step asks the server for the totals exactly once');
  assert.equal(quoteCalls[0].shipping.email,'live@example.com','J32: the quote request carries the delivery details');
  assert.equal(quoteCalls[0].items.length,1,'J32: the quote request carries the bag');
  await flush();
  html=w.elFor('#main').innerHTML;
  assert.ok(html.includes('<span>Delivery</span><span>$12</span>'),'J32: the review shows the server quoted delivery charge');
  assert.ok(html.includes('<span>Tax</span><span>$6.32</span>'),'J32: the review shows the server quoted tax');
  assert.ok(html.includes('<span>Total</span><strong>$97.32</strong>'),'J32: the review shows the full server quoted total before the redirect');
  assert.ok(!html.includes('Merchandise total')&&!html.includes('Calculated before payment'),'J32: the quoted figures replace the calculated later copy');
  orderReply={id:'SMEXPIRED0000001',created_at:'2026-10-28T00:00:00.000Z',items:[],shipping:{},status:'expired',total_cents:9732};
  w.store.set('suits-pending-order',JSON.stringify('SMEXPIRED0000001'));
  await w.run('paymentReturnPage()');
  html=w.elFor('#main').innerHTML;
  assert.ok(html.includes('This order has expired.'),'J32: the payment return explains that the order expired');
  assert.ok(html.includes('SMEXPIRED0000001'),'J32: the expired page keeps the order reference');
  assert.ok(html.includes('Return to checkout'),'J32: the expired page points the shopper back to checkout to restart');
  assert.ok(!html.includes('being confirmed'),'J32: an expired order does not sit on the confirming page');
  console.log('J32 passed: the live review step renders the server quoted delivery, tax and full total in place of the calculated later copy once the quote returns, and the payment return for an expired order explains the closed 24 hour window, keeps the reference and points back to checkout (package 6.1, client half; the server half is in tests/commerce.cjs).');
}

console.log('Account screen checks passed: the gate hides every entry point with byte identical guest screens, the register to verify to signed in journey works from the real URLs, uniform API answers are shown word for word, returnTo is validated, sign out restores the guest, the checkout strip and profiles line follow the account state, reset and change password complete end to end, signed in profile saves and deletes write through with failure surfacing and retry (S8, package 5.5), a second browser pulls the account profiles down with the account copy winning a shared id (S8, package 5.5), and the guest migration offers once, imports exactly the local arrays and leaves local data and the bag untouched (J25, package 5.5), and the signed in orders page renders the merged account history with demo badged snapshots while sign out restores the browser only page (S9, package 5.6), the signed in shopping surfaces are byte identical to the guest surfaces with the priced customization at the Wave 3 totals and demo checkout completing (J24, package 5.8 parity gate), and sign out restores a guest byte identical to a fresh guest that completes the full purchase path again (J26, package 5.8 parity gate), and the sandbox review copy matches what sandbox actually charges (S10, package 6.0), and the live review step shows the server quoted totals before the redirect and the expired order payment return explains the closed window (J32, package 6.1).');
})().catch(e=>{console.error(e);process.exit(1)});
