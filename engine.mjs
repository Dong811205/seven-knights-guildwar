export const sameHeroes=(a,b)=>a.length===b.length&&[...a].sort().join('|')===[...b].sort().join('|');
export function findDefenses(data,ids){return data.guildwar_teams.filter(t=>t.status_source!=='Unused'&&sameHeroes(t.hero_ids_json,ids));}
export function getCounters(data,defenseId,{owned=null,used=[]}={}){
 const teams=new Map(data.guildwar_teams.map(t=>[t.team_id,t]));const rank={Major:0,Minor:1,Situational:2};
 return data.guildwar_matchups.filter(m=>m.defender_team_id===defenseId&&m.attack_outcome_source==='win'&&m.eligible_for_recommendation&&!m.has_source_conflict).map(m=>({...teams.get(m.attacker_team_id),claim_ids:m.claim_ids_json})).filter(t=>t&&t.status_source!=='Unused'&&t.hero_ids_json.every(id=>(!owned||owned.includes(id))&&!used.includes(id))).sort((a,b)=>(rank[a.status_source]??3)-(rank[b.status_source]??3)||a.team_id.localeCompare(b.team_id));
}
export function getWarnings(data,defenseId){return {losses:data.guildwar_matchups.filter(m=>m.defender_team_id===defenseId&&m.attack_outcome_source==='loss'&&m.eligible_for_recommendation),conflicts:data.guildwar_conflicts.filter(m=>m.defender_team_id===defenseId)};}
