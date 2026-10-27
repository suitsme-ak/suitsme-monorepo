const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

const complete=fs.readFileSync('public/complete.js','utf8');
const start=complete.indexOf('function lineDescription');
const end=complete.indexOf('function subtotal',start);
assert.ok(start>=0&&end>start,'Bag line renderers were not found');

const products=[{name:'The Everyday Navy',fabric:'Wool',color:'Navy',price:399,img:'model-navy.webp',kind:'suit'}];
const fields=[
  {id:'chest',label:'Chest'},
  {id:'waist',label:'Natural waist'},
  {id:'shoulder',label:'Shoulder width'},
  {id:'sleeve',label:'Sleeve length'},
  {id:'jacket',label:'Jacket length'},
  {id:'seat',label:'Seat / hips'},
  {id:'trouserWaist',label:'Trouser waist'},
  {id:'thigh',label:'Thigh'},
  {id:'inseam',label:'Inseam'},
  {id:'outseam',label:'Outseam'}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n).toFixed(2).replace('.00','');
const context=vm.createContext({products,fields,esc,money});
vm.runInContext(complete.slice(start,end),context);

const item={
  id:'test-item',
  product:0,
  fabric:'Navy',
  fit:'Tailored',
  lapel:'Peak',
  closure:'Two button',
  lining:'Burgundy',
  monogram:'AUDIT',
  profile:{
    name:'My measurements',
    method:'body',
    unit:'in',
    values:{chest:40,waist:34,shoulder:18,sleeve:25,jacket:30,seat:40,trouserWaist:34,thigh:24,inseam:32,outseam:42}
  }
};
const expectedDescription='Navy · Peak lapel · Tailored fit · Two button · Burgundy lining · Monogram AUDIT';
const expectedSummary='Body measurements · Chest 40 in · Natural waist 34 in · Shoulder width 18 in · Sleeve length 25 in · Jacket length 30 in · Seat / hips 40 in · Trouser waist 34 in · Thigh 24 in · Inseam 32 in · Outseam 42 in';
assert.equal(context.lineDescription(item),expectedDescription);
assert.equal(context.profileSummary(item),expectedSummary);
const html=context.lineHtml(item,false);
assert.ok(html.includes('The Everyday Navy'));
assert.ok(html.includes(expectedDescription));
assert.ok(html.includes('Fit profile: My measurements'));
assert.ok(html.includes(expectedSummary));
assert.ok(!html.includes('Remove'));

const readyItem=JSON.parse(JSON.stringify(item));
readyItem.profile={name:'My standard sizes',method:'ready',ready:{jacket:'40',length:'Regular',trouser:'34'}};
assert.equal(context.profileSummary(readyItem),'Standard sizes · Jacket size 40 · Jacket length Regular · Trouser size 34');
assert.ok(context.lineHtml(readyItem,false).includes('Standard sizes · Jacket size 40 · Jacket length Regular · Trouser size 34'));

const quickAdd=fs.readFileSync('public/quick-add.js','utf8');
const quickStart=quickAdd.indexOf('function quickAddSelections');
const quickEnd=quickAdd.indexOf('function quickAddProduct',quickStart);
assert.ok(quickStart>=0&&quickEnd>quickStart,'Quick add selection helpers were not found');
vm.runInContext(quickAdd.slice(quickStart,quickEnd),context);
assert.deepEqual(JSON.parse(JSON.stringify(context.quickAddSelections({kind:'waistcoat',silhouette:'Tailored'}))),{lapel:'Notch',closure:'Five button',lining:'Tonal'});
assert.equal(context.quickAddDetails({kind:'waistcoat',silhouette:'Tailored'}),'Notch lapel · Five button · Tonal lining');

console.log('Bag line checks passed: every configured selection, lining, body measurements, and standard sizes are shown.');
