import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
import {GAME_SKILL_ORDER,gameSkills,resolveReservation,reservationError,toggleReservation,reconcileReservations} from '../skill-reservations.mjs';
const catalog=JSON.parse(await readFile(new URL('../skill-catalog.json',import.meta.url),'utf8'));
const data=JSON.parse(await readFile(new URL('../app-data.json',import.meta.url),'utf8'));
test('all released hero forms preserve exact source skill identity and battle UI order',async()=>{
 assert.deepEqual(catalog.order,['awakened','s2','s1']);
 for(const hero of data.heroes.filter(h=>h.released_in_source)){
  const forms=[...new Set(data.skills.filter(s=>s.hero_id===hero.hero_id).map(s=>s.form))];
  for(const form of forms){
   const slots=gameSkills({id:hero.hero_id,form},catalog);await access(new URL('../'+catalog.heroes[hero.hero_id].portraits[form],import.meta.url));
   const expected=data.skills.filter(s=>s.hero_id===hero.hero_id&&s.form===form&&!s.converts&&['awakened','ultimate','s1'].includes(s.slot_key));
   assert.equal(slots.length,expected.length,hero.hero_id+':'+form);
   assert.deepEqual(slots.map(s=>s.key),GAME_SKILL_ORDER.filter(k=>expected.some(s=>s.slot_key===(k==='s2'?'ultimate':k))));
   for(const slot of slots){const raw=expected.find(s=>s.slot_key===(slot.key==='s2'?'ultimate':slot.key));assert.equal(slot.skill_group_id,raw.game_skill_group_id,hero.hero_id+':'+form+':'+slot.key);await access(new URL('../'+slot.icon,import.meta.url));}
  }
 }
});
test('screenshot anchors keep awakening at top, Skill2 middle, Skill1 bottom',()=>{
 for(const [id,icons]of Object.entries({li:['4006406','1006403','1006402'],clemyth:['4017906','1017903','1017902'],'giyu-tomioka':['4020106','1020103','1020102'],hayeon:['4018806','1018803','1018802']})){
  const skills=gameSkills({id,form:'awakened'},catalog);assert.deepEqual(skills.map(s=>s.key),['awakened','s2','s1']);assert.deepEqual(skills.map(s=>s.icon.match(/Tex_Skill_(\d+)\.webp$/)?.[1]),icons);
 }
});
test('reservations toggle and compact without changing skill positions; form changes remove unavailable awakening',()=>{
 const heroes=[{id:'li',form:'awakened'},{id:'clemyth',form:'awakened'},{id:'hayeon',form:'s6'}];let q=[];
 q=toggleReservation(q,'clemyth','s1',heroes,catalog);q=toggleReservation(q,'li','s2',heroes,catalog);q=toggleReservation(q,'clemyth','awakened',heroes,catalog);
 assert.deepEqual(q.map(x=>[x.hero_id,x.skill]),[['clemyth','s1'],['li','s2'],['clemyth','awakened']]);assert.equal(reservationError(q,heroes,catalog),'');
 q=toggleReservation(q,'li','s2',heroes,catalog);assert.deepEqual(q.map(x=>x.skill),['s1','awakened']);assert.deepEqual(gameSkills(heroes[1],catalog).map(s=>s.key),['awakened','s2','s1']);
 heroes[1].form='s6';assert.ok(reservationError(q,heroes,catalog));q=reconcileReservations(q,heroes,catalog);assert.deepEqual(q.map(x=>x.skill),['s1']);assert.equal(resolveReservation(q[0],heroes,catalog).skill_group_id,10179602);assert.equal(toggleReservation(q,'hayeon','awakened',heroes,catalog),q);
 const legacy=[{hero_id:'li',skill:'s2'}];assert.equal(resolveReservation(legacy[0],heroes,catalog).source_key,'ultimate');assert.deepEqual(JSON.parse(JSON.stringify(legacy)),legacy);
});
