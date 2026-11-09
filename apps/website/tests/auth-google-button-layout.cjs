const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Journey GL (Google button layout): on the sign in and create
// account pages the Continue with Google button used to render in a
// plain paragraph directly under the form, so it sat glued to the
// form's submit button with a 0px gap, and the two buttons sized to
// their labels (139px against 267px on a 460px form column), reading
// as one mismatched stack. The Google button now renders in its own
// .google-row under the form: the row caps at the form's 460px
// column with a 14px gap above it, the button spans the row, and the
// form's submit button spans the same column, so the pair matches.
// With Google disabled nothing renders, exactly as before. Driven on
// the real storefront scripts, in the style of the other suites.

function makeEl(){const el={innerHTML:'',textContent:'',value:'',checked:false,open:false,style:{},attrs:{},classList:{add(){},remove(){},toggle(){return false}},setAttribute(k,v){el.attrs[k]=String(v)},removeAttribute(k){delete el.attrs[k]},getAttribute(k){return k in el.attrs?el.attrs[k]:null},addEventListener(){},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0}),showModal(){el.open=true},close(){el.open=false},scrollIntoView(){}};return el}
function makeWorld(){
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const elements=new Map();
  const elFor=s=>{if(!elements.has(s))elements.set(s,makeEl());return elements.get(s)};
  const documentStub={title:'',querySelector:s=>elFor(s),querySelectorAll:()=>[],getElementById:id=>elFor('#'+id),addEventListener(){},createElement:()=>makeEl(),body:makeEl()};
  class FakeFormData{constructor(form){this.data=(form&&form.__data)||{}}get(k){return k in this.data?this.data[k]:null}}
  const location={hash:'#home',pathname:'/',search:''};
  const sandbox={console,localStorage,document:documentStub,location,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,fetch:()=>Promise.resolve({ok:false,json:async()=>null}),FormData:FakeFormData,fabricBackground:()=>'background:#999;background-image:linear-gradient(#999,#888);',addEventListener(){},scrollTo(){}};
  sandbox.window=sandbox;
  const ctx=vm.createContext(sandbox);
  for(const f of ['measurement-schema.js','app.js','complete.js','catalog-data.js','expanded.js','gallery.js','quick-add.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx,{filename:f});
  const run=s=>vm.runInContext(s,ctx);
  return{run,elFor,store,location};
}

(async()=>{
  const w=makeWorld();
  w.run('accountState.loaded=true;accountState.enabled=true;accountState.user=null;accountState.googleEnabled=true');

  // Sign in page: the Google button sits in its own row under the
  // form, still pointing at the real start route with its label.
  const signIn=w.run('signInPage()');
  assert.ok(signIn.includes('<p class="google-row"><a class="btn light" href="/api/auth/google/start'),'the sign in Google button renders inside the google row');
  assert.ok(signIn.includes('Continue with Google'),'the Google button keeps its label');
  assert.ok(signIn.indexOf('</form>')<signIn.indexOf('google-row'),'the Google row comes after the sign in form');

  // Create account page: the same row under its form.
  const register=w.run('registerPage()');
  assert.ok(register.includes('<p class="google-row"><a class="btn light" href="/api/auth/google/start'),'the register Google button renders inside the google row');
  assert.ok(register.indexOf('</form>')<register.indexOf('google-row'),'the Google row comes after the register form');

  // The stylesheet carries the layout: the form column and the
  // Google row share the 460px width, both buttons span their
  // column, and the row keeps a 14px gap above it so the pair can
  // never touch.
  const css=fs.readFileSync('public/store.css','utf8');
  assert.ok(css.includes('.auth-page form{max-width:460px}'),'the auth form column stays 460px');
  assert.ok(css.includes('.auth-page form .btn{width:100%}'),'the form submit button spans the form column');
  assert.ok(css.includes('.auth-page .google-row{max-width:460px;margin:14px 0 0}'),'the Google row matches the column and keeps a 14px gap');
  assert.ok(css.includes('.google-row .btn{width:100%}'),'the Google button spans its row');

  // Google disabled: neither page renders the row or the button.
  w.run('accountState.googleEnabled=false');
  assert.ok(!w.run('signInPage()').includes('google-row'),'no Google row on sign in when Google is disabled');
  assert.ok(!w.run('registerPage()').includes('Continue with Google'),'no Google button on register when Google is disabled');

  console.log('auth-google-button-layout: all journeys passed');
})().catch(e=>{console.error(e);process.exit(1)});
