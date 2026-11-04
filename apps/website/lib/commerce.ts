import catalog from './catalog.json';
import { resolveOwner } from './accounts.ts';
import { validateProfile as validateMeasurementProfile, cleanBodyValues, cleanBodyValuesV3, cleanSecondPair, gaugeBlockFor, cleanLegacyValues, cleanGarmentValues, cleanModifyValues, cleanModifyBase, GARMENT_SETS, readyPartsFor } from './measurement-schema.js';
type Env=Record<string,any>;
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// ANET_ENV names the provider environment. Unset and 'sandbox'
// mean sandbox; 'production' means live. Any other value is a
// misconfiguration and refuses readiness (Wave 6 package 6.0,
// finding F8a): a typo must never silently select the sandbox
// endpoints, including with production credentials present.
function anetEnv(env:Env){const v=env.ANET_ENV;if(v===undefined||v===''||v==='sandbox')return'sandbox';if(v==='production')return'production';return null;}
function settings(env:Env){const provider=anetEnv(env);const live=provider==='production';const ready=provider!==null&&!!(env.ANET_API_LOGIN_ID&&env.ANET_TRANSACTION_KEY&&env.ANET_SIGNATURE_KEY&&env.DB)&&(!live||(env.COMMERCE_APPROVED==='true'&&!!env.TAX_QUOTE_URL&&/^\d+$/.test(env.SHIPPING_CENTS||'')));return{ready,mode:ready?(live?'live':'sandbox'):'demo',live};}
// Unpaid pending orders can be paid against for 24 hours from
// creation (Wave 6 package 6.1, finding F8d). Past that the order
// is expired: a checkout restart replaces it instead of
// resurrecting it, the webhook refuses to settle it, and order
// reads report it as expired. Paid orders never expire.
const PENDING_TTL_MS=24*60*60*1000;
function pendingExpired(row:any){return row?.status==='pending'&&Date.now()-Date.parse(row.created_at)>PENDING_TTL_MS;}
// The totals an order will carry, computed exactly one way so the
// review quote (package 6.1, finding F3) and the checkout itself
// can never disagree. Shipping and tax exist only in live mode;
// tax comes only from the owner's quote service, never the client.
async function computeTotals(env:Env,cfg:any,shipping:any,items:any,subtotal:number){let shippingCents=0,taxCents=0;if(cfg.live){shippingCents=Number(env.SHIPPING_CENTS);const taxUrl=new URL(env.TAX_QUOTE_URL);if(taxUrl.protocol!=='https:')throw Error('Tax service must use HTTPS.');const tr=await fetch(taxUrl,{method:'POST',headers:{'Content-Type':'application/json',...(env.TAX_QUOTE_TOKEN?{Authorization:'Bearer '+env.TAX_QUOTE_TOKEN}:{})},body:JSON.stringify({shipping,items,subtotalCents:subtotal,shippingCents}),signal:AbortSignal.timeout(15000)});if(!tr.ok)throw Error('Unable to calculate tax. Please try again.');const tax=await tr.json() as any;taxCents=tax.taxCents;if(!Number.isSafeInteger(taxCents)||taxCents<0||taxCents>subtotal)throw Error('Invalid tax quote.');}if(!Number.isSafeInteger(shippingCents)||shippingCents<0||shippingCents>100000)throw Error('Delivery pricing is not configured correctly.');return{shippingCents,taxCents};}
function auth(env:Env){return{name:env.ANET_API_LOGIN_ID,transactionKey:env.ANET_TRANSACTION_KEY}}
async function anet(env:Env,body:any){const provider=anetEnv(env);if(!provider)throw Error('Payment provider is not configured.');const r=await fetch(provider==='production'?'https://api.authorize.net/xml/v1/request.api':'https://apitest.authorize.net/xml/v1/request.api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Payment provider is temporarily unavailable.');const data=JSON.parse((await r.text()).replace(/^\uFEFF/,''));if(data.messages?.resultCode!=='Ok')throw Error('The payment provider could not prepare this request. Please try again.');return data;}
// Option price modifiers in cents. These mirror the storefront price
// tables in public/app.js (OPTION_PRICES for the current model,
// LEGACY_OPTION_PRICES for pre-alignment items), so an order is priced
// exactly as the bag and checkout showed it. Since J3, a suit or
// jacket item on the aligned JPOS model (the optionModel marker, or
// any distinctly aligned key) is priced only from
// UNDER_COLLAR_FABRIC_PRICE_CENTS on the jacket side: the Milanese
// under collar fabrics are the only JPOS option prices attested in
// code, and every other aligned option stays unpriced until plan
// input 1, the upcharge data extract, prices it. The retired Wave 3
// maps below price only items that carry no aligned marker, exactly
// as they priced before this change; the server never charges an
// aligned item from them.
const POCKET_ACCENT_PRICE_CENTS:Record<string,number>={'Ticket pocket':500,'Slant pocket':500,'Patch pocket':1500};
const PANTS_LINING_PRICE_CENTS:Record<string,number>={'Front lining':500,'Front and back lining':1000};
const PLEATS_PRICE_CENTS:Record<string,number>={'Forward single pleat':500,'Forward 2 pleats':500};
// Jacket finishes (Wave 3 package 3.3) mirror the lapel, lining,
// liningType, buttons and elbowPatches entries of OPTION_PRICES, in
// cents. The lining colorways sit in the same tier lists as the
// storefront table so the two cannot drift apart in membership.
const LAPEL_PRICE_CENTS:Record<string,number>={'Peak':1000,'Wide peak':1000,'Classic wider peak':1000};
const LINING_PLAIN=['Red','Steel gray','Golden beige','Purple','Wine','Turkish blue','Electric blue','Green','Jade green'];
const LINING_PAISLEY=['Paisley black','Paisley white','Paisley copper','Paisley red','Paisley silver','Paisley brown','Paisley royal cyan','Paisley blue','Paisley seaweed green','Paisley pine blue','Paisley cuban pink','Paisley golden beige','Paisley dark blue','Paisley cuban green','Paisley orchid yellow','Paisley coral pink','Paisley neon yellow','Paisley punch pink','Paisley french pink','Paisley lux gold','Paisley cyan blue','Paisley ink blue','Paisley neon green','Paisley neon pink','Paisley light blue','Paisley lilac','Paisley green'];
const LINING_BEMBERG=['Black stretch','Black Bemberg','Purple Bemberg','Green Bemberg','Red Bemberg','Rust Bemberg','Light gray Bemberg','Dark brown Bemberg','Burgandy Bemberg','Brown Bemberg','Dark gray Bemberg','Light blue Bemberg','Hot pink Bemberg','Fawn Bemberg','Blue Bemberg','Teal blue Bemberg','Sundown orange Bemberg','Ivory Bemberg'];
const LINING_ITALIAN=['Italian golden maduro','Italian retro romance','Italian nocturne skull','Italian fortune flag','Italian iconic gent','Italian V8 vintage','Italian elephant valor','Italian jazz royale'];
const LINING_PRICE_CENTS:Record<string,number>=Object.fromEntries([...LINING_PLAIN.map(v=>[v,1500]),...LINING_PAISLEY.map(v=>[v,2000]),...LINING_BEMBERG.map(v=>[v,3000]),...LINING_ITALIAN.map(v=>[v,10900])]);
const LINING_TYPE_PRICE_CENTS:Record<string,number>={'Half lining':2000,'No lining (unstructured)':4000};
const BUTTONS_PRICE_CENTS:Record<string,number>={'Horn solid black':700,'Horn royal black':700,'Italian horn black':700,'Horn mont black':700,'Italian horn dark brown':700,'Corozo beige':400,'Corozo black':400,'Corozo tan':400,'Corozo russet':400,'Corozo irish':400,'Corozo scot brown':400,'Corozo ivory':500,'Vintage brown leather':900,'Matt gold metal':900,'Victorian lion brass':7500,'Venetian mask brass':7500,'Imperial lion brass':7500,'Stallion heritage brass':7500,'Black tiger':7500};
const ELBOW_PATCHES_PRICE_CENTS:Record<string,number>=Object.fromEntries(['Black leather','Brown leather','Tan brown leather','Spanish brown leather','Terrain brown leather','Scottish brown leather','Hunter tan leather','Red leather','White leather','Off white leather','Brazil green leather','Deep blue leather','Prussian blue leather','Light beige leather','Gray leather','Sherpa gray leather','Yellow leather','Dark blue suede','Light brown suede','Caramel brown suede'].map(v=>[v,1500]));
// Priced extras, the tuxedo tier and the extra monogram fields (Wave 3
// package 3.4) mirror the tier, vest, vestFabricBack, additionalPants
// and squareAndTie entries of OPTION_PRICES, in cents, plus the two
// text field prices from TEXT_FIELD_PRICES.
const TIER_PRICE_CENTS:Record<string,number>={'Make it a tuxedo':5000};
const VEST_PRICE_CENTS:Record<string,number>=Object.fromEntries(['Classic vest','Classic lapel vest','Double breasted vest','Double breasted lapel vest','Shawl lapel vest','Shawl lapel double breasted vest'].map(v=>[v,9900]));
const VEST_FABRIC_BACK_PRICE_CENTS:Record<string,number>={'Fabric back':2000};
const ADDITIONAL_PANTS_PRICE_CENTS:Record<string,number>={'Yes':14000};
const SQUARE_AND_TIE_PRICE_CENTS:Record<string,number>={'Yes':3900};
const MONOGRAM_PRICE_CENTS=1000;
const COLLAR_MONOGRAM_PRICE_CENTS=1000;
// Detail add ons (Wave 3 package 3.5) mirror the jacket detail,
// trouser detail and sideTabs entries of OPTION_PRICES, in cents. The
// 2 inch waistband toggle, the tailor changes consent and the comments
// field carry no price on either side; they are persisted below only.
const WORKING_CUFF_BUTTONS_PRICE_CENTS:Record<string,number>={'Yes':500};
const PICK_STITCH_PRICE_CENTS:Record<string,number>={'Yes':1000};
const GAUNTLET_CUFF_PRICE_CENTS:Record<string,number>={'Yes':1500};
const NATURAL_SHOULDERS_PRICE_CENTS:Record<string,number>={'Yes':2000};
const BOAT_POCKET_PRICE_CENTS:Record<string,number>={'Yes':2500};
const MILANESE_BUTTONHOLE_PRICE_CENTS:Record<string,number>={'Yes':7500};
const PANTS_CUFF_PRICE_CENTS:Record<string,number>={'Yes':500};
const SUSPENDER_BUTTONS_PRICE_CENTS:Record<string,number>={'Yes':200};
const COIN_POCKET_PRICE_CENTS:Record<string,number>={'Yes':500};
const SIDE_TABS_PRICE_CENTS:Record<string,number>={'Classic side tabs':1200,'Back elastic':1200,'Side adjusters':1200,'Side elasticated tabs':1700,'Milan side tabs':2000,'Venice side tabs':2000};
// The aligned model (JPOS consistency wave, package J3): the only
// priced aligned jacket options, mirroring OPTION_PRICES in app.js.
const UNDER_COLLAR_FABRIC_PRICE_CENTS:Record<string,number>={'Milanese Single Color':2500,'Milanese Multi-Color':4000};
// Keys that exist only in the aligned model; presence of any one of
// them (or the optionModel marker) puts an item on the aligned model.
const ALIGNED_OPTION_KEYS_CENTS=['lapelType','lapelSize','buttonStyle','cuffButtonType','cuffButtonHole','cuffStitchType','cuffStitchColor','waistPocketType','waistPocketAngle','ticketPocket','breastPocketType','underCollarFabric','collarEyelet','exteriorStitch','frenchFacing','labelStyle','labelColor','collarMonogramStyle','collarColor','tuxedo','tuxLapel','tuxCollar','tuxFrontEdge','tuxBreastPocket','tuxWaistPocket','tuxPocketFlaps','tuxOutseam','tuxPantsPocket','vestIncluded','vestStyle','vestButtons','vestPocketType','vestPocketNumber','vestBack'];
// J4 trousers alignment markers and the second pair's style keys
// (the shopper chosen Pants2 columns of orders, j0-mapping-design.md
// section E.2; the staff side body style and tried size excluded).
const ALIGNED_TROUSER_KEYS_CENTS=["sidePockets","backPocketClosure","trouserCuff","frontTab","legBreak","watchPocket","elasticSideTabs","tunnelBeltLoops","secondPairPants"];
// J5 shirt alignment markers (j0-mapping-design.md section C.4) and
// the one priced aligned shirt option: the hidden placket at
// $10.00, the only JPOS shirt price attested in code, mirroring
// OPTION_PRICES.shirtFrontStyle in app.js. Every other aligned
// shirt option stays unpriced until plan input 1, the
// upcharge_shirts data, prices it, and no retired table prices a
// shirt at all: legacy shirts never carried priced options.
const SHIRT_FRONT_STYLE_PRICE_CENTS:Record<string,number>={'Hidden Placket':1000};
const ALIGNED_SHIRT_KEYS_CENTS=['shirtBodyStyle','shirtFrontStyle','shirtCollarType','shirtCollarHeight','shirtSleeveStyle','shirtCuffStyle','shirtBackStyle','shirtPocketStyle','shirtPocketPosition','shirtButtons','shirtButtonHoleThread','shirtMonogramPlacement','shirtMonogramFont','shirtStitching','shirtThreadColor'];
// J6 waistcoat alignment (j0-mapping-design.md section C.5): the
// standalone waistcoat runs the same vest field set as the vest
// inside a suit, on the keys already persisted in cleanItems below
// (vestStyle, vestButtons, vestPocketType, vestPocketNumber,
// vestBack). No waistcoat option price is attested anywhere in the
// JPOS evidence, so a waistcoat item is never charged for its
// options here; plan input 1, the upcharge data, is the source that
// will price them. VEST_PRICE_CENTS above prices only the legacy
// named vest styles, and only on suit items.
const PANTS2_STYLE_KEYS=["pleats","sidePockets","backPocketClosure","trouserCuff","frontTab","legBreak","watchPocket","suspenderButtons","elasticSideTabs","tunnelBeltLoops"];
function cleanPants2(block:any){const out:any={};for(const k of PANTS2_STYLE_KEYS){const v=block[k];if(typeof v==="string"&&v)out[k]=v.slice(0,40)}return out}
function cleanShipping(x:any){const fields=['email','firstName','lastName','address','city','state','zip','country'];const o:any={};for(const k of fields){if(typeof x?.[k]!=='string'||!x[k].trim()||x[k].length>150)throw Error('Please complete your delivery details.');o[k]=x[k].trim();}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)||!/^\d{5}(-\d{4})?$/.test(o.zip)||!/^[A-Z]{2}$/.test(o.state)||o.country!=='US')throw Error('Please check your email and US delivery address.');return o;}
// The ready sizes an order records. Version 1 profiles keep the
// historical three part shape verbatim. Version 2 profiles are
// garment shaped (measurements wave package M2, READY_PARTS in the
// shared schema): the order stores only the parts the item's
// garment needs, so a trousers order records no jacket size
// (inconsistency INC-07), and the trousers inseam choice is stored
// in its canonical form ('Unhemmed' or a number). Version 2
// profiles for Women and Boys are wearer shaped instead (package
// M4, READY_WEARER_PARTS): the order stores only her bust keyed
// size, or only the child's age.
function cleanReady(profile:any,verdict:any){if(!verdict||!(verdict.version===2||verdict.version===3))return{jacket:String(profile.ready?.jacket||'').slice(0,5),length:String(profile.ready?.length||'').slice(0,10),trouser:String(profile.ready?.trouser||'').slice(0,5),...(profile.ready?.inseam!==undefined?{inseam:profile.ready.inseam}:{})};const parts=readyPartsFor(verdict.setId,verdict.wearer);const out:any={};for(const part of parts){if(part==='inseam')out.inseam=profile.ready.inseam==='Unhemmed'?'Unhemmed':Number(profile.ready.inseam);else if(part==='length'||part==='age')out[part]=String(profile.ready[part]||'').slice(0,10);else out[part]=String(profile.ready[part]||'').slice(0,5)}return out}
// Deferred measurements (measurements wave package M6, owner
// decision O7): an item may be ordered with measurements to
// follow. The deferred shape is deliberately not a measurement
// profile: it records the state, the wearer and the garment, and
// an explicitly empty values object, and nothing else. Any values,
// ready sizes or fit selections carried alongside the marker are
// refused, so a deferred order can never masquerade as a measured
// one or smuggle in placeholder measurements. The shared schema's
// validateProfile keeps rejecting the 'deferred' method, which is
// what keeps this shape out of the account profile store: only an
// order item may carry it.
function cleanDeferredProfile(profile:any,kind:string){
 if(!profile||profile.method!=='deferred')return null;
 const carries=(v:any)=>!!v&&typeof v==='object'&&Object.keys(v).length>0;
 if(carries(profile.values)||carries(profile.ready)||carries(profile.fits))return null;
 if(profile.garment!==undefined&&profile.garment!==kind)return null;
 if(profile.wearer!==undefined&&!['Men','Women','Boys'].includes(profile.wearer))return null;
 return{name:String(profile.name||'').slice(0,60)||'Measurements to follow',method:'deferred',unit:'in',wearer:profile.wearer||'Men',values:{},version:2,garment:kind,deferred:true};
}
// The profile an order item records, cleaned exactly one way so
// checkout and the deferred completion endpoint can never disagree
// about the stored shape: the shared schema validates, body values
// and garment values are cleaned by the schema's cleaners (each
// against its own ranges: garment values are never checked
// against body ranges, package M7), ready sizes go through
// cleanReady, a modify profile's detail values and base go through
// the schema's modify cleaners (package M8), and a deferred
// profile goes through cleanDeferredProfile above.
function cleanItemProfile(profile:any,kind:string){
 if(profile?.method==='deferred'){const cleaned=cleanDeferredProfile(profile,kind);if(!cleaned)throw Error('Please review your measurement profile.');return cleaned;}
 const verdict=validateMeasurementProfile(profile,kind);
 if(!verdict.ok)throw Error(profile?.method==='ready'?'Please review your standard size selections.':'Please review your measurement profile.');
 if(profile.garment!==undefined&&profile.garment!==kind)throw Error('Please review your measurement profile.');
 let values:any={};
 if(profile.method==='body'){values=verdict.version===3?cleanBodyValuesV3(profile.values,verdict.setId,verdict.wearer):verdict.version===2?cleanBodyValues(profile.values,verdict.setId,verdict.wearer):cleanLegacyValues(profile.values,verdict.wearer);if(!values)throw Error('Please review your measurement profile.');}
 if(profile.method==='garment'){values=cleanGarmentValues(profile.values,verdict.setId,verdict.wearer);if(!values)throw Error('Please review your measurement profile.');}
 // A modify a standard size profile (package M8) stores its
 // garment detail values cleaned by the schema's modify cleaner
 // and the standard size it started from, cleaned by
 // cleanModifyBase: the order records the base size and the exact
 // dimensions the shopper reviewed and saved, nothing else.
 let modifyBase:any=null;
 if(profile.method==='modify'){values=cleanModifyValues(profile.values,verdict.setId,verdict.wearer);modifyBase=cleanModifyBase(profile.base,verdict.setId,verdict.wearer);if(!values||!modifyBase)throw Error('Please review your measurement profile.');}
 // A version 3 profile (JPOS consistency wave, package J1) is
 // stored in its J0 section D envelope: the header rebuilt from
 // the verdict, the gauge block rebuilt from the cleaned values
 // with the submitted posture (never trusted as submitted), the
 // figure object and any second pair block copied only after the
 // shared schema validated them, and the unit always inches,
 // because version 3 entry is inches only (plan M9).
 let v3:any=null;
 if(verdict.version===3){
  const origin=profile.origin==='jpos'?'jpos':'web';
  v3={version:3,garment:kind,origin,unit:'in',header:{profileType:verdict.setId,jposLinks:null},provenance:origin==='jpos'?(profile.provenance||null):null};
  if(profile.method==='body'){v3.wearerName=String(profile.wearerName).slice(0,60);v3.gauge=gaugeBlockFor(values,profile.gauge?.posture??null);v3.figure={...(profile.figure||{})};const sp=profile.secondPair?cleanSecondPair(profile.secondPair,verdict.wearer):null;if(sp)v3.secondPair=sp;}
  else if(profile.method==='garment'){v3.wearerName=String(profile.wearerName).slice(0,60);}
  else if(profile.method==='modify'){v3.wearerName=String(profile.wearerName).slice(0,60);v3.base=modifyBase;}
 }
 return{name:String(profile?.name||'').slice(0,60),method:profile?.method||'none',unit:profile?.unit==='cm'?'cm':'in',wearer:verdict.wearer,values,...(profile?.method==='ready'?{ready:cleanReady(profile,verdict)}:{}),...(verdict.version===2?{version:2,garment:kind,...(profile?.method==='body'?{wearerName:String(profile.wearerName).slice(0,60),...(GARMENT_SETS[verdict.setId].fits.length?{fits:Object.fromEntries(GARMENT_SETS[verdict.setId].fits.map((f:any)=>[f.key,profile.fits[f.key]]))}:{})}:profile?.method==='garment'?{wearerName:String(profile.wearerName).slice(0,60)}:profile?.method==='modify'?{wearerName:String(profile.wearerName).slice(0,60),base:modifyBase}:{})}:{}),...(v3||{})};
}
// Deferred self measurements and the JPOS order payload (JPOS
// consistency wave, package J7; plan item M7 and section 6;
// j0-mapping-design.md sections E.1 to E.6). A deferred item is
// stored with a selfMeasurement block shaped exactly like the
// JPOS SelfMeasurement table (section E.5): the small set the
// shop takes first (height in feet and inches, chest, chest over
// arm, waist, seat, thigh, jacket sleeve length, pants waist,
// pants outseam), a completion flag, and the two photo fields.
// The block is order data, never a profile: it is created empty
// at checkout, the completion endpoint below fills it, and no
// path copies it into the profile store, whose cleaners refuse
// anything that is not one of the four profile methods. The
// photo fields stay null: section E.5 has them holding suits.me
// side asset references stored with the order, but neither the
// design nor this codebase specifies an upload or file storage
// path (the hosting record binds no object storage), so a
// submission carrying photo data is refused rather than stored
// somewhere the design did not sanction; the numbers and the
// flag are the whole of what this package persists.
const SELF_MEASUREMENT_FIELDS=['ActualHeightFeet','ActualHeightInches','Chest','ChestOverArm','waist','Seat','thigh','JacketSleeveLength','PantsWaist','PantsOutseam'];
const SELF_MEASUREMENT_RANGES:Record<string,[number,number]>={ActualHeightFeet:[3,8],ActualHeightInches:[0,11.99],Chest:[15,90],ChestOverArm:[15,100],waist:[15,90],Seat:[15,90],thigh:[8,50],JacketSleeveLength:[10,50],PantsWaist:[15,90],PantsOutseam:[15,60]};
function selfMeasurementBlock(customerid:any,values:any,modified:any){const out:any={customerid:customerid??null,DateLastModified:modified,iscomplete:false};for(const k of SELF_MEASUREMENT_FIELDS){const v=values?values[k]:null;out[k]=typeof v==='number'&&Number.isFinite(v)?v:null;}out.iscomplete=SELF_MEASUREMENT_FIELDS.every((k:string)=>out[k]!==null);out.frontviewimage=null;out.sideviewimage=null;return out;}
function emptySelfMeasurement(){return selfMeasurementBlock(null,null,null);}
// One submission, cleaned: only the ten numeric fields may be
// sent, each a finite number inside a broad sanity bound (the
// bounds refuse impossible numbers; they are not JPOS data, the
// table itself records whatever staff take). Values accumulate
// across submissions, so a shopper can send the set in parts; an
// explicit null clears a field. The flag reads complete only
// when every field holds a number. DateLastModified starts null
// at checkout so a retried checkout builds the identical item
// and idempotency keeps holding; the first submission stamps it.
function cleanSelfMeasurement(existing:any,submitted:any){
 if(!submitted||typeof submitted!=='object'||Array.isArray(submitted))return null;
 const merged:any={};for(const k of SELF_MEASUREMENT_FIELDS)merged[k]=existing&&typeof existing[k]==='number'&&Number.isFinite(existing[k])?existing[k]:null;
 for(const k of Object.keys(submitted)){
  if(k==='frontviewimage'||k==='sideviewimage'){if(submitted[k]!==null&&submitted[k]!==undefined&&submitted[k]!=='')return null;continue;}
  if(!SELF_MEASUREMENT_FIELDS.includes(k))return null;
  const v=submitted[k];if(v===null){merged[k]=null;continue;}
  if(typeof v!=='number'||!Number.isFinite(v))return null;
  if(k==='ActualHeightFeet'&&!Number.isInteger(v))return null;
  const range=SELF_MEASUREMENT_RANGES[k];if(v<range[0]||v>range[1])return null;
  merged[k]=v;
 }
 const customerid=existing&&existing.customerid!==undefined?existing.customerid:null;
 return selfMeasurementBlock(customerid,merged,new Date().toISOString());
}
// Provenance on the order (section E.6): when the item's profile
// was imported from JPOS, the order item carries the import's ids
// at item level, copied at checkout, so staff can find the shop
// record from the web order alone. A web profile carries null:
// the absence is itself the signal. (The order level mirror of
// orders.customerID is not stored: the order row has no field for
// it, and an order whose items share one customer is already
// recoverable from these per item blocks.)
function jposProvenanceOf(profile:any){
 if(!profile||profile.version!==3||profile.origin!=='jpos'||!profile.provenance||typeof profile.provenance!=='object'||Array.isArray(profile.provenance))return null;
 const pv=profile.provenance,id=(v:any)=>typeof v==='string'||typeof v==='number'?v:null,ids=pv.jposOrderIds&&typeof pv.jposOrderIds==='object'&&!Array.isArray(pv.jposOrderIds)?pv.jposOrderIds:null;
 return{jposCustomerId:id(pv.jposCustomerId),jposMeasurementId:id(pv.jposMeasurementId),jposGaugeSuitProfileId:id(pv.jposGaugeSuitProfileId),jposOrderIds:ids?{jacket:id(ids.jacket),pants:id(ids.pants),vest:id(ids.vest)}:null};
}
// The JPOS shaped payload (section E.1): beside the flat fields
// the storefront itself reads, a tailored item now also carries
// per piece sections whose keys are the JPOS orders columns of
// sections E.2 and E.3, so the future read only bridge, or the
// JPOS rewrite on this data, reads a web order without a
// translation layer. Style sections are built only from the
// aligned JPOS models of packages J3 to J6: legacy values are a
// different vocabulary (a folded back pocket list, forward
// pleats) and are never renamed into JPOS columns. Measurement
// sections are built only from a version 3 body profile, the
// profile the section A mappings describe; the profile snapshot
// on the item remains the record for every other kind of
// profile. The BodyStyle template fields stay absent (section
// F): no web input derives a pattern code honestly, so staff
// assign templates, as they do when a SelfMeasurement record is
// converted. Two keys are transcriptions rather than attested
// columns, kept so no aligned choice drops out of the payload:
// CollarEyelet (section C.1 attests the collar eyelet field
// family on the form; section E.2 does not list it) and
// PantsBeltLoops (transcribed beside the attested
// PantsTunnelBeltLoops). The tuxedo object also carries the
// trouser outseam and pants pocket facings the J3 model offers,
// beyond the six fields section E.2 names. The label program's
// text rides in labelText beside Label (section E.2); the
// collar monogram text and the second label line stay on the
// item's flat fields, because section E.2 names no payload key
// for them and does not assume LabelOther. Jacket measurements
// write Height as the profile's single total inches value (the
// gauge block's own reading) and leave heightinches unwritten:
// splitting one number into a feet and inches pair under two
// column names would record the same fact twice under names
// whose separate meanings the evidence does not settle.
const JACKET_STYLE_PAYLOAD:Record<string,string>={Button:'closure',LapelType:'lapelType',LapelSize:'lapelSize',Vent:'vents',WaistPocketType:'waistPocketType',WaistPocketAngle:'waistPocketAngle',TicketPocket:'ticketPocket',BreastPocketType:'breastPocketType',ButtonStyle:'buttonStyle',CuffButtonNumber:'cuffButtons',CuffButtonType:'cuffButtonType',CuffButtonHole:'cuffButtonHole',CuffStitchType:'cuffStitchType',CuffStitchColor:'cuffStitchColor',UnderCollarFabric:'underCollarFabric',CollarEyelet:'collarEyelet',FrenchFacing:'frenchFacing',ExteriorStitch:'exteriorStitch',Label:'labelStyle',LabelColor:'labelColor',CollarMonogram:'collarMonogramStyle',CollarColor:'collarColor',Lining:'lining'};
const TUXEDO_PAYLOAD:Record<string,string>={tuxlapel:'tuxLapel',tuxcollar:'tuxCollar',tuxfrontedge:'tuxFrontEdge',tuxbreastpocket:'tuxBreastPocket',tuxwaistpocket:'tuxWaistPocket',tuxwaistpocketFlaps:'tuxPocketFlaps',tuxoutseam:'tuxOutseam',tuxpantspocket:'tuxPantsPocket'};
const PANTS_STYLE_PAYLOAD:Record<string,string>={PantsPleat:'pleats',PantsSidePockets:'sidePockets',PantsBackPocketStyle:'backPockets',PantsBackPocketClosure:'backPocketClosure',PantsCuff:'trouserCuff',PantsFrontTab:'frontTab',PantsLegBreak:'legBreak',PantsWatchPocket:'watchPocket',PantsSuspenderButtons:'suspenderButtons',PantsElasticSideTabs:'elasticSideTabs',PantsTunnelBeltLoops:'tunnelBeltLoops',PantsBeltLoops:'beltLoops'};
const PANTS2_STYLE_PAYLOAD:Record<string,string>={Pants2Pleat:'pleats',Pants2SidePockets:'sidePockets',Pants2BackPocketClosure:'backPocketClosure',Pants2Cuff:'trouserCuff',Pants2FrontTab:'frontTab',Pants2LegBreak:'legBreak',Pants2WatchPocket:'watchPocket',Pants2SuspenderButtons:'suspenderButtons',Pants2ElasticSideTabs:'elasticSideTabs',Pants2TunnelBeltLoops:'tunnelBeltLoops'};
const VEST_STYLE_PAYLOAD:Record<string,string>={VestStyle:'vestStyle',VestButton:'vestButtons',VestPocketType:'vestPocketType',VestPocketNbr:'vestPocketNumber',VestBack:'vestBack'};
const SHIRT_STYLE_PAYLOAD:Record<string,string>={Shirtsbodytype:'shirtBodyStyle',ShirtsFStyle:'shirtFrontStyle',ShirtsCollarStyle:'shirtCollarType',ShirtsCollarHeight:'shirtCollarHeight',ShirtsSleeveStyle:'shirtSleeveStyle',ShirtsCuffStyle:'shirtCuffStyle',ShirtsBackStyle:'shirtBackStyle',ShirtsPocketStyle:'shirtPocketStyle',ShirtsPocketPosition:'shirtPocketPosition',Shirtsbutton:'shirtButtons',ShirtsBHT:'shirtButtonHoleThread',ShirtsMonogramPlacement:'shirtMonogramPlacement',ShirtsMonogramFont:'shirtMonogramFont',Shirtscollarcuffstitch:'shirtStitching',ShirtsThreadcolor:'shirtThreadColor'};
const JACKET_MEASURE_PAYLOAD:Record<string,string>={Height:'height',Chest:'chest',ChestOverArm:'chestOverArm',Weight:'weight',JacketPointToPoint:'shoulder',Shoulder:'shoulder',JacketLength:'jacketLength',JacketSleeveInseamL:'sleeveInseamL',JacketSleeveInseamR:'sleeveInseamR',JacketWaist:'jacketWaist',Seat:'seat'};
const PANTS_MEASURE_PAYLOAD:Record<string,string>={PantsWaist:'trouserWaist',Seat:'seat',PantsThigh:'thigh',PantsInseam:'inseam',PantsOutseamRI:'outseam',PantsRise:'rise',PantsFrontRise:'frontRise',Pants75BackRise:'backRise',Pants74Crotch:'crotch',Pants277Knee:'knee',PantsBottom:'bottom'};
const PANTS2_MEASURE_PAYLOAD:Record<string,string>={Pants2Waist:'trouserWaist',Pants2Seat:'seat',Pants2Thigh:'thigh',Pants2Inseam:'inseam',Pants2OutseamRI:'outseam',Pants2Rise:'rise',Pants2Bottom:'bottom',Pants2Knee:'knee'};
const VEST_MEASURE_PAYLOAD:Record<string,string>={VestBackLength:'vestBackLength',VestHalfWaist:'halfWaist',VestOpening:'opening',VestOpeningAB:'openingAB'};
const SHIRT_MEASURE_PAYLOAD:Record<string,string>={ShirtsMNeckbody:'neck',Shirtschestsize:'chest',ShirtsMSleeveLength:'sleeve',ShirtsMPointToPoint:'shoulder',ShirtsMBackLength:'backLength',ShirtsMwaist:'waist',ShirtsMSweep:'sweep',ShirtsBicep:'bicep',ShirtsCuffSize:'cuffSize'};
function payloadStrings(source:any,map:Record<string,string>){const out:any={};for(const k of Object.keys(map)){const v=source?source[map[k]]:undefined;if(typeof v==='string'&&v)out[k]=v;}return out;}
function payloadNumbers(source:any,map:Record<string,string>){const out:any={};for(const k of Object.keys(map)){const v=source?source[map[k]]:undefined;if(typeof v==='number'&&Number.isFinite(v))out[k]=v;}return out;}
const READY_PART_PIECE:Record<string,string>={jacket:'jacket',length:'jacket',trouser:'pants',inseam:'pants',waistcoat:'vest',womenSize:'jacket',shirtSize:'shirt',age:'jacket'};
const MODIFY_JACKET_KEYS=['gJacketChest','gShoulderWidth','gJacketMidsection','gJacketLength','gSleeveLength','gBicepWidth','gSleeveOpening'];
function jposPiecesFor(kind:string,it:any,profile:any,flags:any){
 const pieces:any={},ensure=(name:string)=>pieces[name]||(pieces[name]={}),has=(o:any)=>Object.keys(o).length>0;
 if((kind==='suit'||kind==='jacket')&&flags.alignedItem){const style=payloadStrings(it,JACKET_STYLE_PAYLOAD);if(it.tuxedo==='Yes'){const tux=payloadStrings(it,TUXEDO_PAYLOAD);if(has(tux))style.tuxedo=tux;}const labelText=[it.monogram,it.monogram2].filter((v:any)=>typeof v==='string'&&v).join(' / ');if(labelText)style.labelText=labelText;if(has(style))ensure('jacket').style=style;}
 if((kind==='suit'||kind==='pants')&&flags.trousersAligned){const style=payloadStrings(it,PANTS_STYLE_PAYLOAD);if(has(style))ensure('pants').style=style;}
 if(kind==='suit'&&it.secondPairPants==='Yes'&&it.pants2&&typeof it.pants2==='object'){const style=payloadStrings(it.pants2,PANTS2_STYLE_PAYLOAD);style.Pants2ndPairofPants='Yes';ensure('pants2').style=style;}
 if(kind==='suit'&&flags.alignedItem&&it.vestIncluded==='Yes'){const style=payloadStrings(it,VEST_STYLE_PAYLOAD);if(has(style))ensure('vest').style=style;}
 if(kind==='waistcoat'&&(it.optionModel===3||['vestStyle','vestButtons','vestPocketType','vestPocketNumber','vestBack'].some((k:string)=>typeof it[k]==='string'&&it[k]))){const style=payloadStrings(it,VEST_STYLE_PAYLOAD);if(has(style))ensure('vest').style=style;}
 if(kind==='shirt'&&flags.shirtAligned){const style=payloadStrings(it,SHIRT_STYLE_PAYLOAD);if(has(style))ensure('shirt').style=style;}
 if(profile&&profile.version===3&&profile.method==='body'){
  const values=profile.values||{};
  if(kind==='suit'||kind==='jacket'){const m=payloadNumbers(values,JACKET_MEASURE_PAYLOAD);if(profile.gauge&&typeof profile.gauge.posture==='string'&&profile.gauge.posture)m.Posture=profile.gauge.posture;if(kind==='suit'&&profile.gauge){if(typeof profile.gauge.jacketWaist==='number')m.GaugeSuitJacketWaist=profile.gauge.jacketWaist;if(typeof profile.gauge.pantsWaist==='number')m.GaugeSuitPantsWaist=profile.gauge.pantsWaist;}if(has(m))ensure('jacket').measurements=m;}
  if(kind==='suit'||kind==='pants'){const m=payloadNumbers(values,PANTS_MEASURE_PAYLOAD);if(has(m))ensure('pants').measurements=m;}
  if(kind==='suit'&&profile.secondPair){const m=payloadNumbers(profile.secondPair,PANTS2_MEASURE_PAYLOAD);if(has(m))ensure('pants2').measurements=m;}
  if(kind==='waistcoat'){const m=payloadNumbers(values,VEST_MEASURE_PAYLOAD);if(has(m))ensure('vest').measurements=m;}
  if(kind==='shirt'){const m=payloadNumbers(values,SHIRT_MEASURE_PAYLOAD);if(has(m))ensure('shirt').measurements=m;}
  const figure=profile.figure&&typeof profile.figure==='object'&&!Array.isArray(profile.figure)?profile.figure:{};
  const split=(pred:(k:string)=>boolean)=>{const out:any={};for(const k of Object.keys(figure))if(pred(k))out[k]=figure[k];return out;};
  if(kind==='suit'||kind==='jacket'){const f=split((k:string)=>!k.startsWith('Pants')&&!k.startsWith('Vest')&&!k.startsWith('Shirts'));if(has(f))ensure('jacket').figure=f;}
  if(kind==='suit'||kind==='pants'){const f=split((k:string)=>k.startsWith('Pants'));if(has(f))ensure('pants').figure=f;}
  if(kind==='shirt'){const f=split((k:string)=>k.startsWith('Shirts'));if(has(f))ensure('shirt').figure=f;}
  if(kind==='waistcoat'||(kind==='suit'&&pieces.vest)){const f=split((k:string)=>k.startsWith('Vest'));if(has(f))ensure('vest').figure=f;}
 }
 if(profile&&(profile.method==='ready'||profile.method==='modify')){
  // The gauge specification (section E.4): per piece, the gauge
  // lookup inputs the profile carries, the size labels the
  // shopper chose, and no finished specification: the finished
  // values are the gauge tables' contents (plan input 2), and
  // none is estimated from the retiring size guide numbers. A
  // modify order also records the shopper's adjusted fields per
  // piece, the web equivalent of the delta companions.
  const pieceNames=kind==='suit'?['jacket','pants']:kind==='jacket'?['jacket']:kind==='pants'?['pants']:kind==='waistcoat'?['vest']:kind==='shirt'?['shirt']:[];
  const labels=profile.method==='ready'?profile.ready:profile.base;
  const inputs:any={};if(profile.gauge&&typeof profile.gauge==='object'){for(const k of['height','weight','posture','chest','chestOverArm','shoulder','jacketWaist','seat','pantsWaist'])if(profile.gauge[k]!==null&&profile.gauge[k]!==undefined)inputs[k]=profile.gauge[k];if(typeof profile.gauge.halfWaistJacket==='number')inputs.halfWaist=profile.gauge.halfWaistJacket;}
  for(const name of pieceNames){const spec:any={inputs:{...inputs},labels:{},finished:null};
   if(labels&&typeof labels==='object')for(const part of Object.keys(labels))if(pieceNames.length===1||READY_PART_PIECE[part]===name)spec.labels[part]=labels[part];
   if(profile.method==='modify'&&profile.values&&typeof profile.values==='object'){const adj:any={};for(const k of Object.keys(profile.values)){const v=profile.values[k];if(typeof v!=='number'||!Number.isFinite(v))continue;const home=kind==='shirt'?'shirt':kind==='waistcoat'?'vest':kind==='pants'?'pants':MODIFY_JACKET_KEYS.includes(k)?'jacket':'pants';if(home===name)adj[k]=v;}if(has(adj))spec.adjustments=adj;}
   ensure(name).gaugeSpec=spec;}
 }
 return pieces;
}
function cleanItems(items:any){if(!Array.isArray(items)||!items.length||items.length>20)throw Error('Choose between 1 and 20 items.');let subtotal=0;const clean=items.map(x=>{const p=catalog[x.product];if(!p||!Number.isInteger(x.product))throw Error('A selected product is not available.');let amount=p.priceCents;const alignedItem=['suit','jacket'].includes(p.kind)&&(x.optionModel===3||ALIGNED_OPTION_KEYS_CENTS.some(k=>x[k]!==undefined&&x[k]!==null&&x[k]!==''));const trousersAligned=['suit','pants'].includes(p.kind)&&ALIGNED_TROUSER_KEYS_CENTS.some(k=>x[k]!==undefined&&x[k]!==null&&x[k]!=='');const shirtAligned=p.kind==='shirt'&&(x.optionModel===3||ALIGNED_SHIRT_KEYS_CENTS.some(k=>x[k]!==undefined&&x[k]!==null&&x[k]!==''));if(shirtAligned)amount+=SHIRT_FRONT_STYLE_PRICE_CENTS[String(x.shirtFrontStyle||'')]||0;if(['suit','jacket'].includes(p.kind)&&alignedItem)amount+=UNDER_COLLAR_FABRIC_PRICE_CENTS[String(x.underCollarFabric||'')]||0;if(['suit','jacket'].includes(p.kind)&&!alignedItem)amount+=POCKET_ACCENT_PRICE_CENTS[String(x.pocketAccent||'')]||0;if(['suit','jacket'].includes(p.kind)&&!alignedItem){amount+=LAPEL_PRICE_CENTS[String(x.lapel||'')]||0;amount+=LINING_PRICE_CENTS[String(x.lining||'')]||0;amount+=LINING_TYPE_PRICE_CENTS[String(x.liningType||'')]||0;amount+=BUTTONS_PRICE_CENTS[String(x.buttons||'')]||0;amount+=ELBOW_PATCHES_PRICE_CENTS[String(x.elbowPatches||'')]||0;amount+=TIER_PRICE_CENTS[String(x.tier||'')]||0;amount+=SQUARE_AND_TIE_PRICE_CENTS[String(x.squareAndTie||'')]||0;if(String(x.monogram||''))amount+=MONOGRAM_PRICE_CENTS;if(String(x.collarMonogram||''))amount+=COLLAR_MONOGRAM_PRICE_CENTS;amount+=WORKING_CUFF_BUTTONS_PRICE_CENTS[String(x.workingCuffButtons||'')]||0;amount+=PICK_STITCH_PRICE_CENTS[String(x.pickStitch||'')]||0;amount+=GAUNTLET_CUFF_PRICE_CENTS[String(x.gauntletCuff||'')]||0;amount+=NATURAL_SHOULDERS_PRICE_CENTS[String(x.naturalShoulders||'')]||0;amount+=BOAT_POCKET_PRICE_CENTS[String(x.boatPocket||'')]||0;amount+=MILANESE_BUTTONHOLE_PRICE_CENTS[String(x.milaneseButtonhole||'')]||0}if(['suit','pants'].includes(p.kind)&&!trousersAligned){amount+=PANTS_LINING_PRICE_CENTS[String(x.pantsLining||'')]||0;amount+=PANTS_CUFF_PRICE_CENTS[String(x.pantsCuff||'')]||0;amount+=SUSPENDER_BUTTONS_PRICE_CENTS[String(x.suspenderButtons||'')]||0;amount+=COIN_POCKET_PRICE_CENTS[String(x.coinPocket||'')]||0;amount+=SIDE_TABS_PRICE_CENTS[String(x.sideTabs||'')]||0}if(p.kind==='suit'){if(!trousersAligned){amount+=PLEATS_PRICE_CENTS[String(x.pleats||'')]||0;amount+=ADDITIONAL_PANTS_PRICE_CENTS[String(x.additionalPants||'')]||0}if(!alignedItem){amount+=VEST_PRICE_CENTS[String(x.vest||'')]||0;if(VEST_PRICE_CENTS[String(x.vest||'')])amount+=VEST_FABRIC_BACK_PRICE_CENTS[String(x.vestFabricBack||'')]||0}}let gift;if(p.kind==='gift'){if(![100,200,300,500,750,1000].includes(x.gift?.amount))throw Error('Choose a valid gift card amount.');if(!String(x.gift.recipient||'').trim()||!/^\S+@\S+\.\S+$/.test(String(x.gift.email||'')))throw Error('Please check the gift recipient details.');amount=x.gift.amount*100;gift={amount:x.gift.amount,recipient:String(x.gift.recipient||'').slice(0,60),email:String(x.gift.email||'').slice(0,150),message:String(x.gift.message||'').slice(0,300)};}let profile:any;if(['gift','accessory','swatch'].includes(p.kind)){profile={name:String(x.profile?.name||'').slice(0,60),method:x.profile?.method||'none',unit:x.profile?.unit==='cm'?'cm':'in',wearer:['Women','Boys'].includes(x.profile?.wearer)?x.profile.wearer:'Men',values:{}};}else{if(!x.profile||!['body','ready','deferred','garment','modify'].includes(x.profile.method))throw Error('A measurement profile is required.');profile=cleanItemProfile(x.profile,p.kind);}
subtotal+=amount;const it:any={product:x.product,name:p.name,priceCents:amount,fabricCode:(p as any).fabricCode||'',fabric:String(x.fabric||'').slice(0,40),lapel:String(x.lapel||'').slice(0,40),closure:String(x.closure||'').slice(0,40),trouserFront:String(x.trouserFront||'').slice(0,40),vents:String(x.vents||'').slice(0,40),cuffButtons:String(x.cuffButtons||'').slice(0,40),pocketAccent:String(x.pocketAccent||'').slice(0,40),pantsLining:String(x.pantsLining||'').slice(0,40),pocketStyle:String(x.pocketStyle||'').slice(0,40),pleats:String(x.pleats||'').slice(0,40),backPockets:String(x.backPockets||'').slice(0,40),beltLoops:String(x.beltLoops||'').slice(0,40),fit:String(x.fit||'').slice(0,40),lining:String(x.lining||'').slice(0,40),liningType:String(x.liningType||'').slice(0,40),buttons:String(x.buttons||'').slice(0,40),elbowPatches:String(x.elbowPatches||'').slice(0,40),tier:String(x.tier||'').slice(0,40),vest:String(x.vest||'').slice(0,40),vestFabricBack:String(x.vestFabricBack||'').slice(0,40),additionalPants:String(x.additionalPants||'').slice(0,40),squareAndTie:String(x.squareAndTie||'').slice(0,40),monogram:String(x.monogram||'').slice(0,['suit','jacket'].includes(p.kind)?20:12),monogram2:String(x.monogram2||'').slice(0,20),collarMonogram:String(x.collarMonogram||'').slice(0,11),workingCuffButtons:String(x.workingCuffButtons||'').slice(0,40),pickStitch:String(x.pickStitch||'').slice(0,40),gauntletCuff:String(x.gauntletCuff||'').slice(0,40),naturalShoulders:String(x.naturalShoulders||'').slice(0,40),boatPocket:String(x.boatPocket||'').slice(0,40),milaneseButtonhole:String(x.milaneseButtonhole||'').slice(0,40),pantsCuff:String(x.pantsCuff||'').slice(0,40),suspenderButtons:String(x.suspenderButtons||'').slice(0,40),coinPocket:String(x.coinPocket||'').slice(0,40),wideWaistband:String(x.wideWaistband||'').slice(0,40),sideTabs:String(x.sideTabs||'').slice(0,40),sidePockets:String(x.sidePockets||'').slice(0,40),backPocketClosure:String(x.backPocketClosure||'').slice(0,40),trouserCuff:String(x.trouserCuff||'').slice(0,40),frontTab:String(x.frontTab||'').slice(0,40),legBreak:String(x.legBreak||'').slice(0,40),watchPocket:String(x.watchPocket||'').slice(0,40),elasticSideTabs:String(x.elasticSideTabs||'').slice(0,40),tunnelBeltLoops:String(x.tunnelBeltLoops||'').slice(0,40),secondPairPants:String(x.secondPairPants||'').slice(0,40),tailorChanges:String(x.tailorChanges||'').slice(0,40),comments:String(x.comments||'').slice(0,200),lapelType:String(x.lapelType||'').slice(0,40),lapelSize:String(x.lapelSize||'').slice(0,40),buttonStyle:String(x.buttonStyle||'').slice(0,40),cuffButtonType:String(x.cuffButtonType||'').slice(0,40),cuffButtonHole:String(x.cuffButtonHole||'').slice(0,40),cuffStitchType:String(x.cuffStitchType||'').slice(0,40),cuffStitchColor:String(x.cuffStitchColor||'').slice(0,40),waistPocketType:String(x.waistPocketType||'').slice(0,40),waistPocketAngle:String(x.waistPocketAngle||'').slice(0,40),ticketPocket:String(x.ticketPocket||'').slice(0,40),breastPocketType:String(x.breastPocketType||'').slice(0,40),underCollarFabric:String(x.underCollarFabric||'').slice(0,40),collarEyelet:String(x.collarEyelet||'').slice(0,40),exteriorStitch:String(x.exteriorStitch||'').slice(0,40),frenchFacing:String(x.frenchFacing||'').slice(0,40),labelStyle:String(x.labelStyle||'').slice(0,40),labelColor:String(x.labelColor||'').slice(0,40),collarMonogramStyle:String(x.collarMonogramStyle||'').slice(0,40),collarColor:String(x.collarColor||'').slice(0,40),tuxedo:String(x.tuxedo||'').slice(0,40),tuxLapel:String(x.tuxLapel||'').slice(0,40),tuxCollar:String(x.tuxCollar||'').slice(0,40),tuxFrontEdge:String(x.tuxFrontEdge||'').slice(0,40),tuxBreastPocket:String(x.tuxBreastPocket||'').slice(0,40),tuxWaistPocket:String(x.tuxWaistPocket||'').slice(0,40),tuxPocketFlaps:String(x.tuxPocketFlaps||'').slice(0,40),tuxOutseam:String(x.tuxOutseam||'').slice(0,40),tuxPantsPocket:String(x.tuxPantsPocket||'').slice(0,40),vestIncluded:String(x.vestIncluded||'').slice(0,40),vestStyle:String(x.vestStyle||'').slice(0,40),vestButtons:String(x.vestButtons||'').slice(0,40),vestPocketType:String(x.vestPocketType||'').slice(0,40),vestPocketNumber:String(x.vestPocketNumber||'').slice(0,40),vestBack:String(x.vestBack||'').slice(0,40),shirtBodyStyle:String(x.shirtBodyStyle||'').slice(0,40),shirtFrontStyle:String(x.shirtFrontStyle||'').slice(0,40),shirtCollarType:String(x.shirtCollarType||'').slice(0,40),shirtCollarHeight:String(x.shirtCollarHeight||'').slice(0,40),shirtSleeveStyle:String(x.shirtSleeveStyle||'').slice(0,40),shirtCuffStyle:String(x.shirtCuffStyle||'').slice(0,40),shirtBackStyle:String(x.shirtBackStyle||'').slice(0,40),shirtPocketStyle:String(x.shirtPocketStyle||'').slice(0,40),shirtPocketPosition:String(x.shirtPocketPosition||'').slice(0,40),shirtButtons:String(x.shirtButtons||'').slice(0,40),shirtButtonHoleThread:String(x.shirtButtonHoleThread||'').slice(0,40),shirtMonogramPlacement:String(x.shirtMonogramPlacement||'').slice(0,40),shirtMonogramFont:String(x.shirtMonogramFont||'').slice(0,40),shirtStitching:String(x.shirtStitching||'').slice(0,40),shirtThreadColor:String(x.shirtThreadColor||'').slice(0,40),...(x.optionModel===3?{optionModel:3}:{}),...(p.kind==='suit'&&x.secondPairPants==='Yes'&&x.pants2&&typeof x.pants2==='object'&&!Array.isArray(x.pants2)?{pants2:cleanPants2(x.pants2)}:{}),profile,...(gift?{gift}:{})};
if(!['gift','accessory','swatch'].includes(p.kind)){it.fabricID=null;it.FabricChoice=it.fabric;it.selfMeasurement=profile.method==='deferred'?emptySelfMeasurement():null;it.profileProvenance=jposProvenanceOf(profile);const pieces=jposPiecesFor(p.kind,it,profile,{alignedItem,trousersAligned,shirtAligned});if(Object.keys(pieces).length)it.pieces=pieces;}
return it;});return{items:clean,subtotal};}
async function hosted(env:Env,order:any,origin:string){const s=JSON.parse(order.shipping);const data=await anet(env,{getHostedPaymentPageRequest:{merchantAuthentication:auth(env),transactionRequest:{transactionType:'authCaptureTransaction',amount:(order.total_cents/100).toFixed(2),order:{invoiceNumber:order.id,description:'Suits.me personal tailoring'},customer:{email:s.email},billTo:{firstName:s.firstName,lastName:s.lastName,address:s.address,city:s.city,state:s.state,zip:s.zip,country:'USA'}},hostedPaymentSettings:{setting:[{settingName:'hostedPaymentReturnOptions',settingValue:JSON.stringify({showReceipt:true,url:origin+'/#payment-return',urlText:'Return to Suits.me',cancelUrl:origin+'/#checkout',cancelUrlText:'Return to bag'})},{settingName:'hostedPaymentStyleOptions',settingValue:JSON.stringify({bgColor:'#c14b35'})},{settingName:'hostedPaymentPaymentOptions',settingValue:JSON.stringify({cardCodeRequired:true,showCreditCard:true,showBankAccount:false})},{settingName:'hostedPaymentOrderOptions',settingValue:JSON.stringify({show:true,merchantName:'Suits.me'})}]}}});if(!data.token)throw Error('The payment provider did not return a checkout token.');return{token:data.token,paymentUrl:anetEnv(env)==='production'?'https://accept.authorize.net/payment/payment':'https://test.authorize.net/payment/payment',orderId:order.id,totalCents:order.total_cents};}
async function verifyWebhook(request:Request,env:Env){if(!env.ANET_SIGNATURE_KEY||!env.DB)return reply({error:'Webhook not configured'},503);const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>100000)return reply({error:'Request too large'},413);const signature=request.headers.get('X-ANET-Signature')||'';if(!/^sha512=[0-9a-f]{128}$/i.test(signature))return reply({error:'Invalid signature'},401);const hex=String(env.ANET_SIGNATURE_KEY);if(!/^[0-9a-f]{128}$/i.test(hex))return reply({error:'Webhook not configured'},503);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(hex),{name:'HMAC',hash:'SHA-512'},false,['verify']);const valid=await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.slice(7).match(/../g)!,s=>parseInt(s,16)),bytes);if(!valid)return reply({error:'Invalid signature'},401);const event=JSON.parse(new TextDecoder().decode(bytes));if(event.eventType!=='net.authorize.payment.authcapture.created')return reply({received:true});const id=String(event.payload?.id||'');if(!/^\d{1,30}$/.test(id))return reply({error:'Invalid transaction'},400);const data=await anet(env,{getTransactionDetailsRequest:{merchantAuthentication:auth(env),transId:id}});const tx=data.transaction;const order=await env.DB.prepare('SELECT * FROM store_orders WHERE id=?').bind(tx?.order?.invoiceNumber||'').first();if(!order)return reply({received:true});if(pendingExpired(order))return reply({error:'This order has expired.'},409);if(Math.round(Number(tx.authAmount)*100)!==order.total_cents||!['capturedPendingSettlement','settledSuccessfully'].includes(tx.transactionStatus))return reply({error:'Transaction does not match order'},409);await env.DB.prepare("UPDATE store_orders SET status='paid',transaction_id=? WHERE id=? AND status='pending'").bind(id,order.id).run();return reply({received:true});}
export async function commerce(request:Request,env:Env){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/api/payment/config'){const {ready,mode}=settings(env);return reply({ready,mode});}
  if(path==='/api/authorize/webhook'&&request.method==='POST')return await verifyWebhook(request,env);
  // Owner resolution is the one shared resolver (design section
  // 1.1, package 5.6): a valid app session cookie wins, keyed
  // app:<user id>; else the gateway header exactly as this file
  // read it before; else the request is a guest and reads as the
  // same 401 it always has. Nothing else in commerce changes:
  // pricing, idempotency, order reads and the webhook keep their
  // existing behaviour under whichever owner the resolver returns.
  const {owner}=await resolveOwner(request,env);
  if(!owner)return reply({error:'Please sign in to continue.'},401);
  if(path.startsWith('/api/orders/')&&request.method==='GET'){
   if(!env.DB)return reply({error:'Order storage is unavailable.'},503);
   const row=await env.DB.prepare('SELECT * FROM store_orders WHERE id=? AND owner=?').bind(decodeURIComponent(path.split('/').pop()||''),owner).first();
   if(!row)return reply({error:'Order not found.'},404);
   return reply({id:row.id,created_at:row.created_at,items:JSON.parse(row.items),shipping:JSON.parse(row.shipping),status:pendingExpired(row)?'expired':row.status,total_cents:row.total_cents});
  }
  // Deferred measurements completion (measurements wave package
  // M6): the owner of an order placed with measurements to follow
  // attaches the real profile afterwards. The named item must
  // still be in the deferred state, the submitted profile is
  // cleaned by the same cleanItemProfile checkout uses, and
  // nothing else about the order (price, totals, status) can
  // change here. An expired pending order is closed to completion
  // just as it is closed to payment. Package J7 adds the second
  // completion shape the JPOS design specifies (section E.5): a
  // selfMeasurement submission fills the item's SelfMeasurement
  // block in place of a profile. The item stays deferred (the
  // block is the shop's self measurement feed, not a profile),
  // submissions accumulate across visits, and a request carrying
  // both shapes is refused rather than half applied.
  if(path.startsWith('/api/orders/')&&request.method==='POST'&&path.endsWith('/measurements')){
   if(!env.DB)return reply({error:'Order storage is unavailable.'},503);
   if(request.headers.get('Origin')!==url.origin)return reply({error:'Invalid request origin.'},403);
   const parts=path.split('/');
   const row=await env.DB.prepare('SELECT * FROM store_orders WHERE id=? AND owner=?').bind(decodeURIComponent(parts[3]||''),owner).first();
   if(!row)return reply({error:'Order not found.'},404);
   if(pendingExpired(row))return reply({error:'This order has expired.'},409);
   const raw=await request.text();if(raw.length>100000)return reply({error:'Request too large.'},413);
   const body=JSON.parse(raw);
   const items=JSON.parse(row.items);
   const item=Number.isInteger(body.index)?items[body.index]:undefined;
   if(!item||item.profile?.method!=='deferred')return reply({error:'That item is not waiting for measurements.'},400);
   const product=catalog[item.product];
   if(!product)return reply({error:'That item is no longer available.'},400);
   if(body.selfMeasurement!==undefined){
    if(body.profile!==undefined)return reply({error:'Please review your measurements.'},400);
    const cleanedSelf=cleanSelfMeasurement(item.selfMeasurement,body.selfMeasurement);
    if(!cleanedSelf)return reply({error:'Please review your self measurements.'},400);
    item.selfMeasurement=cleanedSelf;
    await env.DB.prepare('UPDATE store_orders SET items=? WHERE id=? AND owner=?').bind(JSON.stringify(items),row.id,owner).run();
    return reply({id:row.id,created_at:row.created_at,items,shipping:JSON.parse(row.shipping),status:row.status,total_cents:row.total_cents});
   }
   if(!body.profile||!['body','ready','garment','modify'].includes(body.profile.method))return reply({error:'Please review your measurement profile.'},400);
   item.profile=cleanItemProfile(body.profile,product.kind);
   await env.DB.prepare('UPDATE store_orders SET items=? WHERE id=? AND owner=?').bind(JSON.stringify(items),row.id,owner).run();
   return reply({id:row.id,created_at:row.created_at,items,shipping:JSON.parse(row.shipping),status:row.status,total_cents:row.total_cents});
  }
  if(path==='/api/checkout/quote'&&request.method==='POST'){
   // The review step's figures (package 6.1, finding F3): the same
   // validation and the same totals computation the checkout
   // itself stores, quoted without writing an order, so the total
   // the shopper reviews in live mode before the redirect is the
   // total the stored order will carry.
   if(request.headers.get('Origin')!==url.origin)return reply({error:'Invalid request origin.'},403);
   const qcfg=settings(env);if(!qcfg.ready)return reply({error:'Secure checkout is not enabled. You can complete a demo order instead.'},503);
   const qraw=await request.text();if(qraw.length>100000)return reply({error:'Request too large.'},413);
   const qbody=JSON.parse(qraw),qshipping=cleanShipping(qbody.shipping),qclean=cleanItems(qbody.items);
   const qtotals=await computeTotals(env,qcfg,qshipping,qclean.items,qclean.subtotal);
   return reply({mode:qcfg.mode,subtotalCents:qclean.subtotal,shippingCents:qtotals.shippingCents,taxCents:qtotals.taxCents,totalCents:qclean.subtotal+qtotals.shippingCents+qtotals.taxCents});
  }
  if(path!=='/api/checkout'||request.method!=='POST')return reply({error:'Not found'},404);
  if(request.headers.get('Origin')!==url.origin)return reply({error:'Invalid request origin.'},403);
  const cfg=settings(env);if(!cfg.ready)return reply({error:'Secure checkout is not enabled. You can complete a demo order instead.'},503);
  if(Number(request.headers.get('Content-Length')||0)>100000)return reply({error:'Request too large.'},413);
  const raw=await request.text();if(raw.length>100000)return reply({error:'Request too large.'},413);
  const body=JSON.parse(raw),shipping=cleanShipping(body.shipping),{items,subtotal}=cleanItems(body.items);
  const idem=request.headers.get('Idempotency-Key')||'';if(!/^[a-zA-Z0-9-]{16,80}$/.test(idem))return reply({error:'Please restart checkout.'},400);
  let row=await env.DB.prepare('SELECT * FROM store_orders WHERE owner=? AND idempotency_key=?').bind(owner,idem).first();
  if(row&&row.status==='paid')return reply({error:'This order has already been paid.'},409);
  if(row&&pendingExpired(row)){await env.DB.prepare('DELETE FROM store_orders WHERE id=? AND owner=?').bind(row.id,owner).run();row=null;}
  if(row){if(row.items!==JSON.stringify(items)||row.shipping!==JSON.stringify(shipping))return reply({error:'The bag changed. Please restart checkout.'},409);return reply(await hosted(env,row,url.origin));}
  const{shippingCents,taxCents}=await computeTotals(env,cfg,shipping,items,subtotal);
  const id='SM'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),created=new Date().toISOString();
  try{await env.DB.prepare('INSERT INTO store_orders (id,owner,idempotency_key,items,shipping,subtotal_cents,shipping_cents,tax_cents,total_cents,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,idem,JSON.stringify(items),JSON.stringify(shipping),subtotal,shippingCents,taxCents,subtotal+shippingCents+taxCents,'pending',created).run();}catch{const existing=await env.DB.prepare('SELECT * FROM store_orders WHERE owner=? AND idempotency_key=?').bind(owner,idem).first();if(!existing)throw Error('Unable to save this order. Please try again.');if(existing.items!==JSON.stringify(items)||existing.shipping!==JSON.stringify(shipping)||existing.status==='paid')return reply({error:'Please restart checkout.'},409);row=existing;}
  row=row||await env.DB.prepare('SELECT * FROM store_orders WHERE id=? AND owner=?').bind(id,owner).first();
  return reply(await hosted(env,row,url.origin));
 }catch(error){return reply({error:error instanceof SyntaxError?'Invalid request.':error instanceof Error?error.message:'Unable to complete this request.'},400);}
}
