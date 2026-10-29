const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
const path=require('node:path'),file=path.resolve('lib/commerce.ts'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);const {commerce}=m.exports;
class DB{constructor(){this.rows=[];this.sessions=[];this.users=[]}prepare(sql){const self=this;return{bind(...args){return{async first(){if(sql.includes('FROM sessions'))return self.sessions.find(r=>r.token_hash===args[0])||null;if(sql.includes('FROM users'))return self.users.find(r=>r.id===args[0])||null;if(sql.includes('owner=? AND idempotency_key=?'))return self.rows.find(r=>r.owner===args[0]&&r.idempotency_key===args[1])||null;if(sql.includes('id=? AND owner=?'))return self.rows.find(r=>r.id===args[0]&&r.owner===args[1])||null;return self.rows.find(r=>r.id===args[0])||null},async run(){if(sql.startsWith('INSERT')){const keys=['id','owner','idempotency_key','items','shipping','subtotal_cents','shipping_cents','tax_cents','total_cents','status','created_at'];self.rows.push(Object.fromEntries(keys.map((k,i)=>[k,args[i]])))}if(sql.startsWith('DELETE')){self.rows=self.rows.filter(r=>!(r.id===args[0]&&r.owner===args[1]))}if(sql.startsWith('UPDATE')){const row=self.rows.find(r=>r.id===args[1]&&r.status==='pending');if(row){row.status='paid';row.transaction_id=args[0]}}return{success:true}}}}}}}
const db=new DB,env={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:db};let providerAmount,tx;
// Wave 6 package 6.0: the stub also serves the tax quote contract,
// so the live mode branch of the dispatcher (shipping, tax, totals)
// can run end to end against fakes. The tax reply is programmable
// per case; every call is counted and its request captured.
const TAX_URL='https://tax.example/quote';let taxReply={status:200,body:{taxCents:0}},taxCalls=0,lastTaxUrl='',lastTaxAuth=null,lastTaxBody=null;
global.fetch=async(_url,init)=>{if(String(_url)===TAX_URL){taxCalls++;lastTaxUrl=String(_url);lastTaxAuth=init.headers?.Authorization||null;lastTaxBody=JSON.parse(init.body);return Response.json(taxReply.body,{status:taxReply.status})}const data=JSON.parse(init.body);if(data.getHostedPaymentPageRequest){providerAmount=data.getHostedPaymentPageRequest.transactionRequest.amount;return Response.json({messages:{resultCode:'Ok'},token:'mock-hosted-token'})}if(data.getTransactionDetailsRequest)return Response.json({messages:{resultCode:'Ok'},transaction:tx});throw Error('Unexpected network request')};
const shipping={email:'tester@example.com',firstName:'Test',lastName:'Customer',address:'1 Test Street',city:'New York',state:'NY',zip:'10017',country:'US'};
const input={items:[{product:16,price:1,profile:{name:'No measurements required',method:'none'}}],shipping};
const req=(route,body,owner='owner-1',key='test-attempt-00000001')=>new Request('https://shop.example'+route,{method:body?'POST':'GET',headers:{Origin:'https://shop.example','oai-authenticated-user-id':owner,'Idempotency-Key':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 let r=await commerce(req('/api/payment/config'),{});assert.deepEqual(await r.json(),{ready:false,mode:'demo'});
 r=await commerce(req('/api/checkout',input,''),env);assert.equal(r.status,401);
 const badOrigin=req('/api/checkout',input);badOrigin.headers.set('Origin','https://other.example');assert.equal((await commerce(badOrigin,env)).status,403);
 r=await commerce(req('/api/checkout',input),env);assert.equal(r.status,200);const token=await r.json();assert.equal(token.token,'mock-hosted-token');assert.equal(providerAmount,'79.00','Server prices ignore tampered client prices');assert.equal(db.rows.length,1);
 assert.equal((await commerce(req('/api/checkout',input),env)).status,200);assert.equal(db.rows.length,1,'Retries reuse one order');
 assert.equal((await commerce(req('/api/checkout',{...input,shipping:{...shipping,city:'Albany'}}),env)).status,409);
 assert.equal((await commerce(req('/api/checkout',{...input,items:[{product:0}]},'owner-1','test-attempt-00000002'),env)).status,400);
 assert.equal((await commerce(req('/api/checkout',{...input,items:[{product:0,profile:{method:'ready',ready:{jacket:'999',length:'Regular',trouser:'34'}}}]},'owner-1','invalid-ready-000000001'),env)).status,400);
 assert.equal((await commerce(req('/api/checkout',{...input,items:[{product:18,gift:{amount:100,recipient:'Test',email:'bad'}}]},'owner-1','invalid-gift-000000001'),env)).status,400);
 assert.equal((await commerce(req('/api/orders/'+token.orderId,undefined,'other-owner'),env)).status,404);
 let payload=JSON.stringify({eventType:'net.authorize.payment.authcapture.created',payload:{id:'12345'}});
 const webhook=signature=>new Request('https://shop.example/api/authorize/webhook',{method:'POST',headers:{'X-ANET-Signature':signature},body:payload});
 assert.equal((await commerce(webhook('invalid'),env)).status,401);
 const crypto=require('node:crypto'),signature='sha512='+crypto.createHmac('sha512',env.ANET_SIGNATURE_KEY).update(payload).digest('hex');
 tx={order:{invoiceNumber:token.orderId},authAmount:'1.00',transactionStatus:'capturedPendingSettlement'};
 assert.equal((await commerce(webhook(signature),env)).status,409);assert.equal(db.rows[0].status,'pending');
 tx.authAmount='79.00';assert.equal((await commerce(webhook(signature),env)).status,200);assert.equal(db.rows[0].status,'paid');
 assert.equal((await commerce(webhook(signature),env)).status,200);assert.equal(db.rows.length,1);
 assert.equal((await commerce(req('/api/checkout',input),env)).status,409,'Paid orders cannot reopen payment');
 const cloth=require('../lib/catalog.json').find(p=>p.fabricCode);
 r=await commerce(req('/api/checkout',{...input,items:[{product:cloth.id,fabricCode:'TAMPERED',price:1,profile:{name:'Test fit',method:'ready',ready:{jacket:'40',length:'Regular',trouser:'34'}}}]},'owner-1','merchant-fabric-000000001'),env);assert.equal(r.status,200);assert.equal(JSON.parse(db.rows.at(-1).items)[0].fabricCode,cloth.fabricCode,'Fabric code is taken from server catalog');
 const bodyValues={chest:40,waist:34,shoulder:18,sleeve:25.5,jacket:29.5,seat:41,trouserWaist:34,thigh:24,inseam:32,outseam:42};
 const rowsBeforeBodyTests=db.rows.length;
 r=await commerce(req('/api/checkout',{...input,items:[{product:cloth.id,price:1,fabric:'Wool',lapel:'Notch',closure:'Two button',fit:'Tailored',lining:'Burgundy',monogram:'TEST',profile:{name:'Body test',method:'body',unit:'in',wearer:'Men',values:bodyValues}}]},'owner-1','body-profile-00000000001'),env);
 assert.equal(r.status,200,'Body profile checkout succeeds');
 const bodyResult=await r.json();assert.equal(bodyResult.token,'mock-hosted-token');
 assert.equal(providerAmount,((cloth.priceCents+1000)/100).toFixed(2),'Body profile order is priced from the server catalog, plus $10 for its filled monogram (Wave 3 package 3.4)');
 assert.equal(bodyResult.totalCents,cloth.priceCents+1000,'The total is the server catalog price plus the monogram charge');
 const bodyItem=JSON.parse(db.rows.at(-1).items)[0];
 assert.equal(bodyItem.lining,'Burgundy','Lining selection is persisted alongside the body profile');
 assert.equal(bodyItem.lapel,'Notch');assert.equal(bodyItem.closure,'Two button');assert.equal(bodyItem.fit,'Tailored');assert.equal(bodyItem.monogram,'TEST');
 assert.equal(bodyItem.profile.method,'body');assert.equal(bodyItem.profile.name,'Body test');assert.equal(bodyItem.profile.unit,'in');assert.equal(bodyItem.profile.wearer,'Men');
 assert.deepEqual(bodyItem.profile.values,bodyValues,'All body measurements are persisted on the order item');
 r=await commerce(req('/api/orders/'+bodyResult.orderId,undefined,'owner-1'),env);assert.equal(r.status,200);
 const fetchedBodyItem=(await r.json()).items[0];assert.equal(fetchedBodyItem.profile.method,'body');assert.deepEqual(fetchedBodyItem.profile.values,bodyValues,'Body measurements survive the order read back');
 const missingValues={...bodyValues};delete missingValues.inseam;
 assert.equal((await commerce(req('/api/checkout',{...input,items:[{product:cloth.id,profile:{name:'Body test',method:'body',unit:'in',wearer:'Men',values:missingValues}}]},'owner-1','body-missing-00000000001'),env)).status,400,'Body profile with a missing measurement is rejected');
 assert.equal((await commerce(req('/api/checkout',{...input,items:[{product:cloth.id,profile:{name:'Body test',method:'body',unit:'in',wearer:'Men',values:{...bodyValues,chest:250}}}]},'owner-1','body-range-000000000001'),env)).status,400,'Body profile with an out of range measurement is rejected');
 assert.equal(db.rows.length,rowsBeforeBodyTests+1,'Rejected body profiles create no orders');
 // Package 5.6 (design section 1.1): commerce resolves its owner
 // through the shared resolver in lib/accounts.ts. The header cases
 // above are unmodified and behave exactly as before; the cases
 // below add the cookie path and the precedence rule. The fake DB
 // gained sessions and users reads for the resolver; no existing
 // case sends a cookie, so none of them reach those reads.
 const nodeCrypto=require('node:crypto');
 const appDb=new DB,appEnv={...env,DB:appDb};
 const appUserId='U0123456789abcdef0123456789abcdef',appToken='app-session-'+'token-for-tests',appNow=new Date().toISOString();
 appDb.users.push({id:appUserId,email:'app@example.com',display_name:'App Customer',email_verified_at:appNow,created_at:appNow,updated_at:appNow,deleted_at:null});
 appDb.sessions.push({token_hash:nodeCrypto.createHash('sha256').update(appToken).digest('hex'),user_id:appUserId,created_at:appNow,last_seen_at:appNow,expires_at:new Date(Date.now()+29*24*60*60*1000).toISOString()});
 const cookieReq=(route,body,key)=>new Request('https://shop.example'+route,{method:body?'POST':'GET',headers:{Origin:'https://shop.example',Cookie:'suitsme-session='+appToken,...(body?{'Idempotency-Key':key,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 r=await commerce(cookieReq('/api/checkout',input,'app-cookie-attempt-001'),appEnv);assert.equal(r.status,200,'Checkout succeeds under the app session cookie alone');
 const cookieResult=await r.json();assert.equal(cookieResult.token,'mock-hosted-token');
 assert.equal(appDb.rows.length,1);assert.equal(appDb.rows[0].owner,'app:'+appUserId,'The cookie checkout writes the order with owner app:<user id>');
 const bothReq=cookieReq('/api/checkout',input,'app-both-attempt-00001');bothReq.headers.set('oai-authenticated-user-id','gateway-1');
 r=await commerce(bothReq,appEnv);assert.equal(r.status,200);assert.equal(appDb.rows.length,2);assert.equal(appDb.rows[1].owner,'app:'+appUserId,'With both identities present, the app owner wins over the gateway header');
 r=await commerce(cookieReq('/api/orders/'+cookieResult.orderId),appEnv);assert.equal(r.status,200,'The order reads back under cookie auth, the payment return path');
 r=await commerce(req('/api/orders/'+cookieResult.orderId,undefined,'gateway-1'),appEnv);assert.equal(r.status,404,'The gateway identity cannot read the app order');
 const badCookieReq=cookieReq('/api/checkout',input,'app-bad-cookie-0000001');badCookieReq.headers.set('Cookie','suitsme-session=not-a-real-token');
 assert.equal((await commerce(badCookieReq,appEnv)).status,401,'An unknown session cookie with no gateway header is still the guest 401');
 assert.equal(appDb.rows.length,2,'The refused attempts wrote no orders');
 // J27 (Wave 6 package 6.0, design sections 1 F1 and 5): the live
 // mode branch runs end to end against the stubbed tax service.
 // Before this package every case above ran in sandbox mode, which
 // skips the totals branch entirely, so shipping and tax had never
 // executed in tests. The gates first: each missing or malformed
 // production ingredient leaves the mode at demo.
 const gate=async e=>await (await commerce(req('/api/payment/config'),e)).json();
 const liveDb=new DB;
 const liveBase={ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:liveDb,ANET_ENV:'production',COMMERCE_APPROVED:'true',TAX_QUOTE_URL:TAX_URL,TAX_QUOTE_TOKEN:'test-tax-token',SHIPPING_CENTS:'1200'};
 assert.deepEqual(await gate(liveBase),{ready:true,mode:'live'},'J27: the full production settings report live');
 assert.deepEqual(await gate({...liveBase,ANET_ENV:'sandbox'}),{ready:true,mode:'sandbox'},'J27: an explicit sandbox value reports sandbox');
 const noApproval={...liveBase};delete noApproval.COMMERCE_APPROVED;
 assert.deepEqual(await gate(noApproval),{ready:false,mode:'demo'},'J27: production values without COMMERCE_APPROVED stay demo');
 assert.deepEqual(await gate({...liveBase,COMMERCE_APPROVED:'yes'}),{ready:false,mode:'demo'},'J27: COMMERCE_APPROVED must be exactly the string true');
 assert.deepEqual(await gate({...liveBase,SHIPPING_CENTS:'12.00'}),{ready:false,mode:'demo'},'J27: non numeric shipping stays demo');
 const noShipping={...liveBase};delete noShipping.SHIPPING_CENTS;
 assert.deepEqual(await gate(noShipping),{ready:false,mode:'demo'},'J27: missing shipping stays demo');
 const noTaxUrl={...liveBase};delete noTaxUrl.TAX_QUOTE_URL;
 // This case exposed a real defect the harness was built to find:
 // with TAX_QUOTE_URL missing, settings() used to return ready as
 // undefined rather than false, so /api/payment/config answered
 // {"mode":"demo"} with no ready field at all. The settings clause
 // now coerces the URL check to a boolean.
 assert.deepEqual(await gate(noTaxUrl),{ready:false,mode:'demo'},'J27: a missing tax quote URL stays demo, with ready present and false');
 const noSecret={...liveBase};delete noSecret.ANET_TRANSACTION_KEY;
 assert.deepEqual(await gate(noSecret),{ready:false,mode:'demo'},'J27: a missing provider secret stays demo');
 // Settings hardening (finding F8a): an ANET_ENV value that is
 // neither sandbox nor production refuses readiness instead of
 // silently selecting the sandbox endpoints.
 assert.deepEqual(await gate({...liveBase,ANET_ENV:'prod'}),{ready:false,mode:'demo'},'J27: a typo in ANET_ENV refuses readiness instead of selecting sandbox');
 assert.deepEqual(await gate({ANET_API_LOGIN_ID:'test-login',ANET_TRANSACTION_KEY:'test-transaction-key',ANET_SIGNATURE_KEY:'AB'.repeat(64),DB:new DB,ANET_ENV:'staging'}),{ready:false,mode:'demo'},'J27: an unrecognized ANET_ENV with sandbox shaped settings stays demo');
 assert.equal((await commerce(req('/api/checkout',input,'owner-1','bad-env-attempt-0000001'),{...liveBase,ANET_ENV:'prod',DB:new DB})).status,503,'J27: checkout under an unrecognized ANET_ENV refuses instead of charging through sandbox');
 // The live checkout itself: shipping from SHIPPING_CENTS, tax
 // from the stubbed quote service, and the assembled total carried
 // into the stored order and the hosted payment request.
 taxReply={status:200,body:{taxCents:632}};taxCalls=0;
 r=await commerce(req('/api/checkout',input,'owner-1','live-attempt-00000000001'),liveBase);
 assert.equal(r.status,200,'J27: live checkout succeeds');
 const liveResult=await r.json();
 assert.equal(liveResult.totalCents,9732,'J27: the live total is subtotal plus shipping plus tax');
 assert.equal(providerAmount,'97.32','J27: the hosted payment request carries the full live total');
 assert.equal(liveDb.rows.length,1);
 const liveRow=liveDb.rows[0];
 assert.equal(liveRow.subtotal_cents,7900);assert.equal(liveRow.shipping_cents,1200,'J27: shipping is the SHIPPING_CENTS amount');
 assert.equal(liveRow.tax_cents,632,'J27: tax is the quoted amount');assert.equal(liveRow.total_cents,9732);assert.equal(liveRow.status,'pending');
 assert.equal(taxCalls,1,'J27: the tax service is called exactly once');
 assert.equal(lastTaxUrl,TAX_URL);assert.equal(lastTaxAuth,'Bearer test-tax-token','J27: the tax call carries the configured bearer token');
 assert.equal(lastTaxBody.subtotalCents,7900);assert.equal(lastTaxBody.shippingCents,1200,'J27: the quote request carries the subtotal and the shipping amount');
 assert.equal(lastTaxBody.shipping.email,shipping.email);assert.equal(lastTaxBody.items[0].priceCents,7900,'J27: the tax service is quoted the server priced items, not client prices');
 r=await commerce(req('/api/checkout',input,'owner-1','live-attempt-00000000001'),liveBase);
 assert.equal(r.status,200);assert.equal(liveDb.rows.length,1,'J27: a live retry reuses the stored order');
 assert.equal(taxCalls,1,'J27: a live retry does not quote tax a second time');
 r=await commerce(req('/api/orders/'+liveResult.orderId,undefined,'owner-1'),liveBase);
 assert.equal(r.status,200);assert.equal((await r.json()).total_cents,9732,'J27: the live order reads back with its full total');
 // The webhook settles the live order only at the exact total,
 // shipping and tax included.
 const livePayload=JSON.stringify({eventType:'net.authorize.payment.authcapture.created',payload:{id:'67890'}});
 const liveSignature='sha512='+crypto.createHmac('sha512',liveBase.ANET_SIGNATURE_KEY).update(livePayload).digest('hex');
 const liveWebhook=()=>new Request('https://shop.example/api/authorize/webhook',{method:'POST',headers:{'X-ANET-Signature':liveSignature},body:livePayload});
 tx={order:{invoiceNumber:liveResult.orderId},authAmount:'97.31',transactionStatus:'capturedPendingSettlement'};
 assert.equal((await commerce(liveWebhook(),liveBase)).status,409,'J27: a webhook one cent under the live total is refused');
 assert.equal(liveDb.rows[0].status,'pending');
 tx.authAmount='97.32';
 assert.equal((await commerce(liveWebhook(),liveBase)).status,200);assert.equal(liveDb.rows[0].status,'paid','J27: the webhook marks the live order paid at the exact total');
 // Bad tax answers are refused and write no orders: negative,
 // fractional, above the subtotal, not a number, a failing tax
 // service, and a non HTTPS quote URL.
 const rowsBeforeBadTax=liveDb.rows.length,callsBeforeBadTax=taxCalls;
 const badTaxReplies=[['negative',{taxCents:-1}],['fractional',{taxCents:10.5}],['above the subtotal',{taxCents:7901}],['not a number',{taxCents:'632'}]];
 for(let i=0;i<badTaxReplies.length;i++){taxReply={status:200,body:badTaxReplies[i][1]};assert.equal((await commerce(req('/api/checkout',input,'owner-1','live-bad-tax-000000000'+i),liveBase)).status,400,'J27: a '+badTaxReplies[i][0]+' tax quote is refused');}
 taxReply={status:500,body:{}};
 assert.equal((await commerce(req('/api/checkout',input,'owner-1','live-tax-down-000000001'),liveBase)).status,400,'J27: a tax service failure refuses the checkout');
 assert.equal((await commerce(req('/api/checkout',input,'owner-1','live-tax-http-000000001'),{...liveBase,TAX_QUOTE_URL:'http://tax.example/quote'})).status,400,'J27: a non HTTPS tax quote URL is refused before any call');
 assert.equal(liveDb.rows.length,rowsBeforeBadTax,'J27: refused tax answers write no orders');
 assert.equal(taxCalls,callsBeforeBadTax+badTaxReplies.length+1,'J27: each refused quote reached the stubbed tax service exactly once, and the HTTP URL case never called it');
 // Zero is a valid live configuration for both shipping and tax.
 taxReply={status:200,body:{taxCents:0}};
 r=await commerce(req('/api/checkout',input,'owner-1','live-zero-attempt-000001'),{...liveBase,SHIPPING_CENTS:'0'});
 assert.equal(r.status,200);assert.equal((await r.json()).totalCents,7900,'J27: zero shipping and zero tax leave the live total at the subtotal');
 console.log('J27 passed: live mode gates stay demo until every production ingredient is present and exact, an unrecognized ANET_ENV refuses readiness, and the live totals branch runs end to end against the stubbed tax service (shipping applied, tax quoted with the server priced items and carried into the stored order, the hosted payment amount and the webhook amount check; bad tax answers refused with no orders written).');
 // J32 (Wave 6 package 6.1, design sections 3 F3 and 3 F8d):
 // the review step's totals come from the server and equal the
 // stored order's totals, and an unpaid pending order older than
 // 24 hours can no longer be paid against: the webhook refuses
 // it, order reads report it expired, and restarting checkout
 // replaces it under the same idempotency key.
 taxReply={status:200,body:{taxCents:632}};
 const quoteDb=new DB,quoteEnv={...liveBase,DB:quoteDb};
 assert.equal((await commerce(req('/api/checkout/quote',input,''),quoteEnv)).status,401,'J32: a guest cannot obtain a totals quote');
 const quoteBadOrigin=req('/api/checkout/quote',input);quoteBadOrigin.headers.set('Origin','https://other.example');
 assert.equal((await commerce(quoteBadOrigin,quoteEnv)).status,403,'J32: a foreign origin cannot obtain a totals quote');
 assert.equal((await commerce(req('/api/checkout/quote',input),{})).status,503,'J32: no totals quote while commerce is not ready');
 const callsBeforeQuote=taxCalls;
 const quoteResponse=await commerce(req('/api/checkout/quote',input),quoteEnv);
 assert.equal(quoteResponse.status,200);
 assert.deepEqual(await quoteResponse.json(),{mode:'live',subtotalCents:7900,shippingCents:1200,taxCents:632,totalCents:9732},'J32: the quote carries the server computed live totals');
 assert.equal(taxCalls,callsBeforeQuote+1,'J32: the quote consulted the tax service once');
 assert.equal(quoteDb.rows.length,0,'J32: quoting writes no order');
 const placedResponse=await commerce(req('/api/checkout',input,'owner-1','j32-quote-order-000001'),quoteEnv);
 assert.equal(placedResponse.status,200);
 const placedBody=await placedResponse.json();
 const storedRow=quoteDb.rows.find(row=>row.id===placedBody.orderId);
 assert.equal(storedRow.subtotal_cents,7900);assert.equal(storedRow.shipping_cents,1200);assert.equal(storedRow.tax_cents,632);
 assert.equal(storedRow.total_cents,9732,'J32: the totals shown before redirect equal the stored order total');
 assert.equal(placedBody.totalCents,9732);
 // Sandbox quotes carry no shipping or tax and never call the tax service.
 const sandboxQuoteDb=new DB,callsBeforeSandboxQuote=taxCalls;
 const sandboxQuoteResponse=await commerce(req('/api/checkout/quote',input),{...env,DB:sandboxQuoteDb});
 assert.equal(sandboxQuoteResponse.status,200);
 assert.deepEqual(await sandboxQuoteResponse.json(),{mode:'sandbox',subtotalCents:7900,shippingCents:0,taxCents:0,totalCents:7900},'J32: a sandbox quote is the subtotal alone');
 assert.equal(taxCalls,callsBeforeSandboxQuote,'J32: sandbox never quotes tax');
 assert.equal(sandboxQuoteDb.rows.length,0,'J32: a sandbox quote writes no order either');
 const expDb=new DB,expEnv={...liveBase,DB:expDb};
 const firstResponse=await commerce(req('/api/checkout',input,'owner-1','j32-expiry-key-000001'),expEnv);
 assert.equal(firstResponse.status,200);
 const firstBody=await firstResponse.json();
 const expRow=expDb.rows.find(row=>row.id===firstBody.orderId);
 assert.equal(expRow.status,'pending');assert.equal(expRow.total_cents,9732);
 // 23 hours old: inside the window, a retry reuses the order and
 // does not quote tax again.
 expRow.created_at=new Date(Date.now()-23*3600*1000).toISOString();
 const callsBeforeReuse=taxCalls;
 const reuseResponse=await commerce(req('/api/checkout',input,'owner-1','j32-expiry-key-000001'),expEnv);
 assert.equal(reuseResponse.status,200);
 assert.equal((await reuseResponse.json()).orderId,expRow.id,'J32: a pending order inside 24 hours is reused, not replaced');
 assert.equal(expDb.rows.length,1);assert.equal(taxCalls,callsBeforeReuse,'J32: reuse inside the window does not requote tax');
 // 25 hours old: expired. The webhook can no longer settle it
 // and the order read reports it as expired.
 expRow.created_at=new Date(Date.now()-25*3600*1000).toISOString();
 const expPayload=JSON.stringify({eventType:'net.authorize.payment.authcapture.created',payload:{id:'13579'}});
 const expSignature='sha512='+crypto.createHmac('sha512',expEnv.ANET_SIGNATURE_KEY).update(expPayload).digest('hex');
 const expWebhook=()=>new Request('https://shop.example/api/authorize/webhook',{method:'POST',headers:{'X-ANET-Signature':expSignature},body:expPayload});
 tx={order:{invoiceNumber:expRow.id},authAmount:'97.32',transactionStatus:'capturedPendingSettlement'};
 assert.equal((await commerce(expWebhook(),expEnv)).status,409,'J32: the webhook refuses to settle an expired pending order');
 assert.equal(expRow.status,'pending','J32: the refused webhook leaves the expired order unsettled');
 const expiredRead=await commerce(req('/api/orders/'+expRow.id,undefined,'owner-1'),expEnv);
 assert.equal(expiredRead.status,200);
 const expiredBody=await expiredRead.json();
 assert.equal(expiredBody.status,'expired','J32: order reads report an expired pending order as expired');
 assert.equal(expiredBody.total_cents,9732);
 // Restarting checkout replaces the expired order under the same
 // key, and the replacement settles normally.
 const restartResponse=await commerce(req('/api/checkout',input,'owner-1','j32-expiry-key-000001'),expEnv);
 assert.equal(restartResponse.status,200);
 const restartBody=await restartResponse.json();
 assert.notEqual(restartBody.orderId,expRow.id,'J32: restart replaces the expired order instead of resurrecting it');
 assert.equal(expDb.rows.length,1,'J32: the expired row is deleted on restart');
 const replacement=expDb.rows[0];
 assert.equal(replacement.id,restartBody.orderId);assert.equal(replacement.status,'pending');assert.equal(replacement.total_cents,9732);
 assert.ok(Date.now()-Date.parse(replacement.created_at)<60000,'J32: the replacement starts a fresh 24 hour window');
 tx={order:{invoiceNumber:replacement.id},authAmount:'97.32',transactionStatus:'capturedPendingSettlement'};
 assert.equal((await commerce(expWebhook(),expEnv)).status,200,'J32: the replacement order settles normally');
 assert.equal(replacement.status,'paid');
 // A paid order never expires, however old it gets.
 replacement.created_at=new Date(Date.now()-72*3600*1000).toISOString();
 const paidRead=await commerce(req('/api/orders/'+replacement.id,undefined,'owner-1'),expEnv);
 assert.equal((await paidRead.json()).status,'paid','J32: paid orders never read as expired');
 // Expiry is mode independent: sandbox pending orders expire too.
 const sbExpDb=new DB,sbExpEnv={...env,DB:sbExpDb};
 const sbFirst=await commerce(req('/api/checkout',input,'owner-1','j32-expiry-sandbox-01'),sbExpEnv);
 const sbFirstBody=await sbFirst.json();
 const sbRow=sbExpDb.rows.find(row=>row.id===sbFirstBody.orderId);
 sbRow.created_at=new Date(Date.now()-25*3600*1000).toISOString();
 const sbRetry=await commerce(req('/api/checkout',input,'owner-1','j32-expiry-sandbox-01'),sbExpEnv);
 assert.notEqual((await sbRetry.json()).orderId,sbRow.id,'J32: expiry replacement applies in sandbox mode too');
 assert.equal(sbExpDb.rows.length,1);
 console.log('J32 passed: the review quote carries the server computed live totals and the checkout stores exactly those totals; an unpaid pending order older than 24 hours is refused by the webhook, reads as expired, and is replaced on restart, while orders inside the window are reused and paid orders never expire.');
 console.log('Commerce contract checks passed: authentication, origin, server pricing, required profiles, body measurement profiles, idempotency, owner access, signed webhook verification, amount matching, paid-order replay, plus the package 5.6 cookie owner path and its precedence over the gateway header.');
})().catch(e=>{console.error(e);process.exit(1)});
