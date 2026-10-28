'use strict';
// Retain the historical catalog definitions so saved product IDs stay stable.
const removedSuitCategories=new Set(['Italian Limited Edition','Tweed Suits','Leather Suits','Napolean Wool Suits','Murano Suits']);
const navMenus=referenceNavigation.map(menu=>menu.name==='Suits'?{...menu,shortcuts:menu.shortcuts.filter(item=>!removedSuitCategories.has(item)),groups:menu.groups.map(([title,items])=>[title,items.filter(item=>!removedSuitCategories.has(item))])}:menu);
// Wave 4 stage 3a (NAV-01): menu destinations are computed exactly as
// before, as hash routes, then translated to their real URLs through
// realUrlForHash (public/real-routes.js, backed by the generated route
// map) so the rendered menus link to real pages. The destination set
// is unchanged; only the href form moves. Worlds without the boot
// translator keep the hash form.
function menuLink(cat,item){const hash=item==='Fit Guarantee'?'#fit-support':/^3d/i.test(item)?'#studio/'+(cat==='Trousers'?'pants':cat==='Jackets'?'jacket':'suit'):item==='Clone Garments'?'#clone':item==='Other Charges'?'#charges':item==='Gift Cards'?'#gift-cards':'#collection/'+encodeURIComponent(cat)+(item?'/'+encodeURIComponent(item):'');return typeof realUrlForHash==='function'?realUrlForHash(hash):hash;}
$('#catalogNav').innerHTML=navMenus.map((m,i)=>`<details class="nav-item" id="nav-${i}"><summary>${m.name}</summary><div class="mega-menu reference-mega" data-menu="${m.name}">${m.shortcuts.length?`<div class="mega-shortcuts">${m.shortcuts.map(label=>`<a href="${menuLink(m.name,label)}">${label}</a>`).join('')}</div>`:''}<div class="mega-columns" style="--groups:${m.groups.length}">${m.groups.map(([label,items])=>`<div class="mega-group">${label?`<h3>${label}</h3>`:''}${items.map(item=>`<a href="${menuLink(m.name,item)}">${item}</a>`).join('')}</div>`).join('')}</div></div></details>`).join('');
function closeMenus(){document.querySelectorAll('.nav-item').forEach(d=>d.open=false)}
document.querySelectorAll('.nav-item').forEach(d=>{d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.nav-item').forEach(other=>{if(other!==d)other.open=false})});d.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{closeMenus();if(a.hash===location.hash)render()}))});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus()});document.addEventListener('click',e=>{if(!e.target.closest('header'))closeMenus()});window.addEventListener('hashchange',closeMenus);
