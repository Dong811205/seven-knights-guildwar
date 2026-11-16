import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {JSDOM} from 'jsdom';
import * as models from '../guild-model.mjs';import * as choices from '../guide-options.mjs';
const data=JSON.parse(await readFile(new URL('../app-data.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../guide-catalog.json',import.meta.url),'utf8'));
const html=await readFile(new URL('../guild.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../guild.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const uid='11111111-1111-4111-8111-111111111111',gid='99999999-9999-4999-8999-999999999999';
function database(){const tables={gvg_guilds:[{id:gid,name:'測試公會'}],gvg_members:[{user_id:uid,guild_id:gid,nickname:'測試者',role:'editor'}],gvg_guides:[],gvg_comments:[],gvg_attachments:[]};
 function query(table){let filters=[],one=false,op='read',payload;const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},single(){one=true;return q},insert(v){op='insert';payload=v;return q},update(v){op='update';payload=v;return q},then(resolve,reject){try{let rows=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(op==='insert'){const r={...structuredClone(payload),id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',updated_at:new Date().toISOString(),created_at:new Date().toISOString()};tables[table].push(r);rows=[r]}if(op==='update')rows.forEach(r=>Object.assign(r,structuredClone(payload)));resolve({data:structuredClone(one?rows[0]:rows),error:null})}catch(e){reject(e)}}};return q;}
 const session={user:{id:uid},provider_token:'not-a-real-token'};
 return {tables,session,client:{from:query,auth:{getSession:async()=>({data:{session}}),onAuthStateChange(fn){fn('INITIAL_SESSION',session)}},functions:{invoke:async()=>({data:{allowed:true,guild_id:gid,role:'editor',checked_until:new Date(Date.now()+120000).toISOString()}})}}};
}
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('UI did not reach expected state')}
test('editor role dropdowns, badges, mixed set and per-enemy configuration save and reload',async t=>{
 const db=database(),dom=new JSDOM(html,{url:'https://dong811205.github.io/seven-knights-guildwar/guild.html',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=> 'blob:test';w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 w.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).includes('/auth/')?{external:{discord:true}}:String(url).startsWith('guide-catalog.json')?catalog:data)});
 Object.assign(w,{createClient:()=>db.client,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'not-a-real-key',...models,...choices});
 await new vm.Script(`(async()=>{${source}\n})()`).runInContext(dom.getInternalVMContext());
 await until(()=>w.document.querySelector('[data-g="new"]'));
 const $=s=>w.document.querySelector(s),click=s=>{const el=$(s);assert.ok(el,s);el.click()},change=(s,v)=>{const el=$(s);assert.ok(el,s);el.value=v;assert.equal(el.value,v);el.dispatchEvent(new w.Event('change',{bubbles:true}))},input=(s,v)=>{const el=$(s);assert.ok(el,s);el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}))};
 click('[data-g="new"]');input('[data-path="title"]','DOM測試攻略');input('[data-path="build.special_notes"]','攻速必須先確認 <重要>');
 assert.equal($('[data-path="build.formation"]').tagName,'SELECT');assert.equal($('[data-path="build.formation"]').options.length,5);
 assert.equal($('[data-path="build.pet.name"]').options.length,19);change('[data-path="build.pet.name"]','路路');change('[data-path="build.formation"]','保護陣型');
 assert.equal($('[data-path="build.heroes.0.id"]').disabled,true);
 for(const [i,type]of ['Attack','Magic','Support'].entries()){
  const path=`build.heroes.${i}`;change(`[data-role-path="${path}"]`,type);const select=$(`[data-path="${path}.id"]`),expected=choices.heroesByType(data.heroes,type);
  assert.deepEqual(Array.from(select.options).slice(1).map(o=>o.value),expected.map(h=>h.hero_id));change(`[data-path="${path}.id"]`,expected[0].hero_id);
 }
 assert.equal($('[data-path="title"]').value,'DOM測試攻略');
 assert.ok($('[data-role-path="build.heroes.0"]').parentElement.querySelector('.visual-picker summary img'));
 assert.ok($('[data-path="build.heroes.0.id"]').parentElement.querySelector('.visual-options img'));
 change('[data-path="build.formation"]','攻擊陣型');
 click('[data-g="save"][data-status="draft"]');assert.match($('#guild-form-error').textContent,/超過陣型/);assert.equal(db.tables.gvg_guides.length,0);
 change('[data-path="build.heroes.1.row"]','back');change('[data-path="build.heroes.2.row"]','back');
 assert.equal($('[data-path="build.heroes.1.row"] option[value="front"]').disabled,true);
 change('[data-path="build.formation"]','保護陣型');change('[data-path="build.heroes.1.row"]','front');
 assert.equal($('[data-path="build.heroes.1.row"] option[value="back"]').disabled,true);
 change('[data-path="build.heroes.0.weapon"]','Crit');change('[data-path="build.heroes.0.armor"]','Block');
 change('[data-path="build.heroes.0.accessory_rarity"]','L');change('[data-path="build.heroes.0.accessory_kind"]','compound');
 change('[data-path="build.heroes.0.accessory_effect_1"]','Guts');change('[data-path="build.heroes.0.accessory_effect_2"]','Immortal');change('[data-path="build.heroes.0.exclusive"]','DMGAmp');
 click('[data-g="queue-add"][data-i="general"]');change('[data-path="build.queue.0.skill"]','s2');

 assert.equal($('.set-picker [data-value="刺客"] img').getAttribute('src'),'assets/sets/assassin.webp');const summary=$('.set-picker summary');summary.focus();summary.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));assert.equal(w.document.activeElement.dataset.value,'雜套');w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal($('.set-picker').open,false);click('.set-picker [data-value="雜套"]');
 assert.ok($('[data-path="build.heroes.0.mixed_stat"]'));change('[data-path="build.heroes.0.mixed_stat"]','speed');
 for(const [i,type]of ['Defense','Universal','Attack'].entries()){
  const path=`build.matchups.0.heroes.${i}`;change(`[data-role-path="${path}"]`,type);change(`[data-path="${path}.id"]`,choices.heroesByType(data.heroes,type)[0].hero_id);
 }
 click('[data-g="queue-add"][data-i="0"]');change('[data-path="build.matchups.0.queue.0.skill"]','s2');input('[data-path="build.matchups.0.speed"]','甲速度 > 乙速度');
 click('[data-g="save"][data-status="draft"]');await until(()=>w.document.querySelector('[data-g="edit"]')).catch(e=>{console.error('editor message:',w.document.querySelector('#guild-form-error')?.textContent,'toast:',w.document.querySelector('#guild-toast')?.textContent,'saved:',db.tables.gvg_guides.length);throw e});
 assert.equal(db.tables.gvg_guides.length,1);const saved=db.tables.gvg_guides[0];assert.equal(saved.build.special_notes,'攻速必須先確認 <重要>');assert.equal(saved.build.queue[0].skill,'s2');assert.equal(saved.build.heroes[0].weapon,'Crit');assert.equal(saved.build.heroes[0].accessory_effect_2,'Immortal');assert.equal(saved.build.heroes[0].exclusive,'DMGAmp');assert.equal(w.document.querySelector('.strategy-warning div').textContent,'攻速必須先確認 <重要>');assert.equal(saved.build.heroes[0].set,'雜套');assert.equal(saved.build.heroes[0].mixed_stat,'speed');assert.equal(saved.build.matchups[0].queue[0].skill,'s2');assert.equal(saved.build.matchups[0].speed,'甲速度 > 乙速度');assert.ok(w.document.body.textContent.includes('雜套 · 優先攻速'));
 click('[data-g="edit"]');assert.equal($('[data-path="build.formation"]').value,'保護陣型');assert.equal($('[data-path="build.pet.name"]').value,'路路');assert.equal($('[data-role-path="build.heroes.0"]').value,'Attack');assert.equal($('[data-path="build.heroes.0.mixed_stat"]').value,'speed');
});

test('Discord reconnect deduplicates verification, preserves provider token and restores suspended edits',async t=>{
 const db=database(),dom=new JSDOM(html,{url:'https://dong811205.github.io/seven-knights-guildwar/guild.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
 const intervals=[];w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};let now=Date.now();w.Date.now=()=>now;
 w.URL.revokeObjectURL=()=>{};w.structuredClone=structuredClone;w.scrollTo=()=>{};w.confirm=()=>true;
 w.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).includes('/auth/')?{external:{discord:true}}:String(url).startsWith('guide-catalog.json')?catalog:data)});
 Object.assign(w,{createClient:()=>db.client,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test',...models,...choices});
 await new vm.Script(`(async()=>{${source}\nwindow.qa={S,verify};})()`).runInContext(dom.getInternalVMContext());
 await until(()=>w.document.querySelector('[data-g="new"]'));w.document.querySelector('[data-g="new"]').click();
 const title=w.document.querySelector('[data-path="title"]');title.value='未儲存攻略';title.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(w.sessionStorage.getItem('gvg-discord:'+uid),'not-a-real-token');delete db.session.provider_token;w.qa.S.providerToken=null;
 let calls=0;db.client.functions.invoke=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {data:{allowed:true,guild_id:gid,role:'editor',checked_until:new Date(now+120000).toISOString()}}};
 await Promise.all([w.qa.verify({force:true}),w.qa.verify({force:true})]);assert.equal(calls,1);assert.equal(w.qa.S.providerToken,'not-a-real-token');
 w.qa.S.access.checked_until=new Date(now-1).toISOString();db.client.functions.invoke=async()=>{calls++;return {error:{context:{json:async()=>({error:'discord_busy',retry_after:25})}}}};
 assert.equal(await w.qa.verify({force:true}),false);assert.equal(w.document.querySelector('[data-path="title"]'),null);const before=calls;
 await w.qa.verify({force:true});assert.equal(calls,before);
 now+=30000;db.client.functions.invoke=async()=>({data:{allowed:true,guild_id:gid,role:'editor',checked_until:new Date(now+120000).toISOString()}});
 await intervals.find(x=>x.ms===15000).fn();assert.equal(w.document.querySelector('[data-path="title"]').value,'未儲存攻略');assert.ok(w.document.querySelector('#viewer-watermark'));
 db.client.functions.invoke=async()=>({data:{allowed:false}});await w.qa.verify({force:true});assert.equal(w.document.querySelector('#viewer-watermark'),null);assert.equal(w.document.querySelector('[data-path="title"]'),null);
});
