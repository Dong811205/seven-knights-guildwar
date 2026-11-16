// Battle UI order, verified against original game icons and supplied screenshots.
// Atlas calls the second active skill "ultimate"; it is NOT the awakening skill.
export const GAME_SKILL_ORDER=Object.freeze(['awakened','s2','s1']);
export const SKILL_SLOT_LABELS=Object.freeze({awakened:'覺醒技',s2:'技能2',s1:'技能1'});
export const MAX_RESERVATIONS=12;
export function gameSkills(hero,catalog){
 const forms=catalog?.heroes?.[hero?.id]?.forms;if(!forms)return [];
 const entries=forms[hero.form]||forms.source_default||[];
 return GAME_SKILL_ORDER.flatMap(key=>{const entry=entries.find(s=>s.key===key&&!s.converts);return entry?[{...entry,label:SKILL_SLOT_LABELS[key]}]:[];});
}
export function resolveReservation(step,heroes,catalog){const hero=heroes.find(h=>h.id===step.hero_id);return hero?gameSkills(hero,catalog).find(s=>s.key===step.skill)||null:null;}
export function reservationError(queue,heroes,catalog){
 if(!Array.isArray(queue)||queue.length>MAX_RESERVATIONS)return `技能預約最多${MAX_RESERVATIONS}手`;
 return queue.some(q=>!resolveReservation(q,heroes,catalog))?'技能預約包含目前角色或型態無法使用的技能，請重新選擇':'';
}
export function toggleReservation(queue,hero,key,heroes,catalog){
 const skill=resolveReservation({hero_id:hero,skill:key},heroes,catalog);if(!skill)return queue;
 if(queue.some(q=>q.hero_id===hero&&q.skill===key))return queue.filter(q=>q.hero_id!==hero||q.skill!==key);
 if(queue.length>=MAX_RESERVATIONS)return queue;
 return [...queue,{hero_id:hero,skill:key,skill_id:skill.skill_group_id}];
}
// A form change can remove an awakening reservation but never swaps Skill1/2.
export function reconcileReservations(queue,heroes,catalog){return (queue||[]).filter(q=>resolveReservation(q,heroes,catalog)).map(q=>({...q,skill_id:resolveReservation(q,heroes,catalog).skill_group_id}));}
