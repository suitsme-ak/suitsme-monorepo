const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
// SIZ-03 size guide, rebuilt in measurements wave package M5. The
// v1 guide (Wave 2) showed only the body chest and body waist
// columns over the old size sets, because no finished values had
// been adopted then. M5 supersedes it: the owner adopted the
// benchmark's published finished garment values as suits.me's
// working values (O2) and aligned the ready sets to the published
// sets (O3, jackets 36 to 62, trousers 30 to 60), so the guide is
// rebuilt per garment from the shared schema, states per table
// whether its numbers are body or finished garment values, and
// converts with the one unit rule (fromCanonicalValue: cm at
// times 2.54, one decimal) instead of v1's whole number rounding.
// Only published finished values appear: a size the chart page
// did not publish values for renders blank cells, never an
// interpolated number.
const nodes={};
const makeNode=()=>({innerHTML:'',textContent:'',checked:false,open:false,classList:{add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0})});
const document={querySelector(s){return nodes[s]??=makeNode()},querySelectorAll(){return[]},addEventListener(){},getElementById(){return makeNode()}};
const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const ctx=vm.createContext({localStorage,crypto:webcrypto,document,location:{hash:'#measure'},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,console});
vm.runInContext(fs.readFileSync('public/measurement-schema.js','utf8'),ctx);vm.runInContext(fs.readFileSync('public/app.js','utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);

// The guide region is everything from its labelled container onward.
const guideRegion=html=>{const i=html.indexOf('id="sizeGuide"');assert.ok(i>=0,'guide region must be present in the markup');return html.slice(i)};
const section=(region,name)=>{const i=region.indexOf('<h3>'+name+'</h3>');assert.ok(i>=0,'guide must have a '+name+' section');const rest=region.slice(i);const j=rest.indexOf('<h3>',1);return j<0?rest:rest.slice(0,j)};
const rowSizes=html=>[...html.matchAll(/<tr><td>(\d+)<\/td>/g)].map(m=>Number(m[1]));
const jackets=Array.from({length:14},(_,i)=>36+i*2),trousers=Array.from({length:16},(_,i)=>30+i*2);
assert.deepEqual(JSON.parse(run('JSON.stringify(READY_SIZE_SETS.jacket)')),jackets,'the schema jacket set is the aligned 36 to 62');
assert.deepEqual(JSON.parse(run('JSON.stringify(READY_SIZE_SETS.trouser)')),trousers,'the schema trouser set is the aligned 30 to 60');

// 1. The ready sizes step offers the guide toggle, collapsed, and the body
//    step never shows it.
run("draft.method='ready';draft.step=1;draft.unit='in';draft.garment=null;draft.wearer='Men';saveDraft()");
let sizesHtml=ctx.measure();
assert.ok(sizesHtml.includes('onclick="toggleSizeGuide()"'),'sizes step must render the size guide toggle');
assert.ok(sizesHtml.includes('aria-expanded="false"'),'the guide starts collapsed');
assert.ok(sizesHtml.includes('aria-controls="sizeGuide"'),'the toggle must point at the guide region');
assert.ok(!sizesHtml.includes('id="sizeGuide"'),'a collapsed guide renders no tables');
run("draft.method='body';draft.step=1;saveDraft()");
const bodyHtml=ctx.measure();
assert.ok(!bodyHtml.includes('toggleSizeGuide')&&!bodyHtml.includes('id="sizeGuide"'),'the body measurement step must not render the size guide');
run("draft.step=2;saveDraft()");
assert.ok(!ctx.measure().includes('id="sizeGuide"'),'the body review step must not render the size guide');

// 2. The sizes step selects offer exactly the aligned sets, the same
//    sets the guide lists.
run("draft.method='ready';draft.step=1;saveDraft()");
sizesHtml=ctx.measure();
const selectOptions=(html,label)=>{const i=html.indexOf('aria-label="'+label+'"');assert.ok(i>=0,'the sizes step has a '+label+' select');const block=html.slice(i,html.indexOf('</select>',i));return [...block.matchAll(/<option[^>]*>(\d+)<\/option>/g)].map(m=>Number(m[1]))};
assert.deepEqual(selectOptions(sizesHtml,'Jacket size'),jackets,'the jacket select offers exactly the aligned set');
assert.deepEqual(selectOptions(sizesHtml,'Trouser size'),trousers,'the trouser select offers exactly the aligned set');

// 3. Opening the guide renders the jacket and trouser tables over the
//    aligned sets, with body and finished columns told apart, the
//    adopted finished values at the published sizes, and blank cells
//    where the chart page published nothing.
ctx.toggleSizeGuide();
sizesHtml=ctx.measure();
assert.ok(sizesHtml.includes('aria-expanded="true"'),'opening the guide flips aria-expanded');
let region=guideRegion(sizesHtml);
assert.ok(region.includes('role="region"')&&region.includes('aria-label="Size guide"'),'the guide region is labelled');
assert.ok(region.includes('Measure your chest and pick the jacket size that matches it.'),'jacket table is headed as a body measurement to compare against');
assert.ok(region.includes('Measure your waist and pick the trouser size that matches it.'),'trouser table is headed as a body measurement to compare against');
const jacketSection=section(region,'Jackets'),trouserSection=section(region,'Trousers');
for(const heading of ['Body chest (in)','Finished chest (in)','Finished shoulder (in)','Finished stomach (in)','Finished sleeve (in)','Finished length (in)'])assert.ok(jacketSection.includes(heading),'the jacket table has a '+heading+' column');
for(const heading of ['Body waist (in)','Finished waist (in)','Finished hip (in)','Finished thigh (in)','Finished leg opening (in)','Finished front rise (in)'])assert.ok(trouserSection.includes(heading),'the trouser table has a '+heading+' column');
assert.deepEqual(rowSizes(jacketSection),jackets,'the jacket table lists one row per aligned size');
assert.deepEqual(rowSizes(trouserSection),trousers,'the trouser table lists one row per aligned size');
assert.ok(jacketSection.includes('<tr><td>40</td><td>40</td><td>43</td><td>18</td><td>40.5</td><td>24.5</td><td>29.5</td></tr>'),'jacket 40: body chest equals the size (D1), finished chest is size plus 3, and the published shoulder, stomach, sleeve and length appear');
assert.ok(jacketSection.includes('<tr><td>62</td><td>62</td><td>65</td><td>23.5</td><td>63</td><td>27</td><td>34</td></tr>'),'jacket 62 carries its published finished values');
assert.ok(jacketSection.includes('<tr><td>38</td><td>38</td><td>41</td><td></td><td></td><td></td><td></td></tr>'),'jacket 38: the unpublished finished cells render blank, never interpolated');
assert.ok(trouserSection.includes('<tr><td>40</td><td>40</td><td>42</td><td>48.5</td><td>28.5</td><td>16</td><td>12</td></tr>'),'trouser 40: body waist equals the size (D2), finished waist is size plus 2, and the published hip, thigh, leg opening and front rise appear');
assert.ok(trouserSection.includes('<tr><td>52</td><td>52</td><td>54.5</td><td>62</td><td>36</td><td>19</td><td>14</td></tr>'),'trouser 52: the finished waist follows the chart rule above 46 (plus 2.5)');
assert.ok(trouserSection.includes('<tr><td>32</td><td>32</td><td>34</td><td></td><td></td><td></td><td></td></tr>'),'trouser 32: the unpublished finished cells render blank, never interpolated');
for(const name of ['Short','Regular','Long'])assert.ok(region.includes(name),'the guidance names the '+name+' length without numbers');
assert.ok(region.includes('UK jacket sizes match US sizes'),'the guide carries the international conversion line');
assert.ok(region.includes('European sizes are the US size plus 10'),'the guide carries the European conversion');

// 4. Switching the Studio unit to cm converts every guide value with
//    the one unit rule (times 2.54, one decimal place).
run("changeUnit('cm')");
assert.equal(run('draft.unit'),'cm');
region=guideRegion(ctx.measure());
assert.ok(region.includes('Body chest (cm)')&&region.includes('Body waist (cm)'),'cm unit is named in the body column headings');
assert.ok(region.includes('Finished chest (cm)')&&region.includes('Finished waist (cm)'),'cm unit is named in the finished column headings');
assert.ok(section(region,'Jackets').includes('<tr><td>40</td><td>101.6</td><td>109.2</td><td>45.7</td><td>102.9</td><td>62.2</td><td>74.9</td></tr>'),'jacket 40 in cm: body chest 101.6, finished chest 109.2, and every published value converted at 2.54 with one decimal');
assert.ok(section(region,'Trousers').includes('<tr><td>40</td><td>101.6</td><td>106.7</td><td>123.2</td><td>72.4</td><td>40.6</td><td>30.5</td></tr>'),'trouser 40 in cm: body waist 101.6, finished waist 106.7, and every published value converted at 2.54 with one decimal');
run("changeUnit('in')");

// 5. The guide is per garment: a trousers session shows only the
//    trousers table, a jacket session only the jackets table, a
//    waistcoat session its finished chest table over the jacket
//    set, and a shirt session the shirt table with the one
//    published row.
run("draft.garment='pants';saveDraft()");
let g=run('sizeGuideHtml()');
assert.ok(g.includes('<h3>Trousers</h3>')&&!g.includes('<h3>Jackets</h3>'),'a trousers session shows the trousers table only');
run("draft.garment='jacket';saveDraft()");
g=run('sizeGuideHtml()');
assert.ok(g.includes('<h3>Jackets</h3>')&&!g.includes('<h3>Trousers</h3>'),'a jacket session shows the jackets table only');
run("draft.garment='waistcoat';saveDraft()");
g=run('sizeGuideHtml()');
assert.ok(g.includes('<h3>Waistcoats</h3>'),'a waistcoat session shows the waistcoat table');
assert.deepEqual(rowSizes(g),jackets,'the waistcoat table runs over the jacket size set, 36 to 62');
assert.ok(g.includes('<tr><td>40</td><td>43.5</td></tr>'),'waistcoat 40: the finished chest is the size plus the published 3.5');
assert.ok(!g.includes('Finished stomach'),'the waistcoat guide invents no stomach column: those values were not published');
run("draft.garment='shirt';saveDraft()");
g=run('sizeGuideHtml()');
assert.ok(g.includes('<h3>Shirts</h3>')&&g.includes('S (36) to 5XL (50)'),'a shirt session shows the shirt table and states the letter ladder');
assert.ok(g.includes('<tr><td>L (40)</td><td>19</td><td>29</td><td>25</td><td>47</td><td>46</td></tr>'),'the shirt table lists the one published finished row, L (40)');
run("draft.garment=null;saveDraft()");

// 6. Women and boys get their own tables, never the men's: hers
//    adds the bust band and the finished bust, his the age ladder
//    and the one published body value.
run("draft.wearer='Women';saveDraft()");
g=run('sizeGuideHtml()');
assert.ok(g.includes("Women's sizes")&&g.includes('keyed to your bust')&&g.includes('Letter size'),'the Women guide is the bust keyed ladder');
assert.ok(g.includes('<tr><td>40</td><td>XL</td><td>39 to 40</td><td>44</td></tr>'),'women 40 (XL): the bust band tops at the size number and the finished bust is the size plus 4');
assert.ok(!g.includes('Body chest')&&!g.includes('Body waist'),'the men tables are not presented as applying to her');
run("draft.wearer='Boys';saveDraft()");
g=run('sizeGuideHtml()');
assert.ok(g.includes("Boys' sizes")&&g.includes('12 months')&&g.includes('10 years'),'the Boys guide is the age ladder');
assert.ok(g.includes('pants waist measures 26 to 28 in'),'the Boys guide carries the one published body value, the age 8 pants waist range');
assert.ok(!g.includes('Body chest')&&!g.includes('Body waist'),'the men tables are not presented as applying to him');
run("draft.wearer='Men';saveDraft()");

// 7. The guide is a pure addition: the ready flow still completes
//    with the guide open, and closing the guide removes the tables.
run("draft.method='ready';draft.step=1;saveDraft()");
run("draft.ready.jacket='40';draft.ready.length='Regular';draft.ready.trouser='34';saveDraft()");
ctx.measureNext();
assert.equal(run('draft.step'),2,'Continue still advances to review with the guide open');
run('draft.step=1;saveDraft()');
ctx.toggleSizeGuide();
assert.ok(!ctx.measure().includes('id="sizeGuide"'),'closing the guide removes the tables');

console.log('Size guide checks passed: the rebuilt guide renders collapsed in the standard size step only, offers the aligned sets (jackets 36 to 62, trousers 30 to 60) matching the selects, states body and finished columns per garment, shows the adopted published finished values with blanks where none were published, converts cm at 2.54 with one decimal, and gives women and boys their own tables.');
