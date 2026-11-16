// Shared choices for the guild editor. These contain public catalog metadata only.
export const HERO_TYPES=[['Magic','魔法型'],['Attack','攻擊型'],['Defense','防禦型'],['Support','支援型'],['Universal','萬能型']];
export function heroesByType(heroes,type){
 if(!HERO_TYPES.some(([id])=>id===type))return [];
 return heroes.filter(h=>h.released_in_source&&h.role_en===type).sort((a,b)=>(b.release_date_source||'').localeCompare(a.release_date_source||'')||a.name_tw.localeCompare(b.name_tw,'zh-Hant'));
}
export function preservedChoices(choices,current){
 return current&&!choices.some(([value])=>value===current)?[...choices,[current,`${current}（既有設定）`]]:choices;
}
export function availableLegendaryPets(catalog){return catalog.legendary_pets.filter(p=>p.rarity==='L'&&p.name_tw);}
export function mixedSetDescription(hero,statFields){
 if(hero.set!=='雜套')return hero.set||'未指定';
 const name=statFields.find(([key])=>key===hero.mixed_stat)?.[1];
 return name?`雜套 · 優先${name}`:'雜套';
}
