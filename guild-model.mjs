export const STAT_FIELDS=[['hp','生命力'],['attack','攻擊力'],['magic','魔法攻擊力'],['defense','防禦力'],['speed','攻速'],['crit','暴擊機率%'],['crit_damage','暴擊傷害%'],['weakness','弱點攻擊機率%'],['hit','效果命中%'],['resist','效果抵抗%'],['block','格擋機率%'],['reduction','減傷%'],['birth','誕生%']];
export const blankHero=()=>({id:'',form:'s6',row:'front',attack_order:'',global_attack_order:'',accessory_alternatives:[],stats:[],set:'',mixed_stat:'',weapon:'',armor:'',substats:'',accessory:'',exclusive:'',notes:''});
export const blankMatchup=()=>({heroes:Array.from({length:3},()=>({id:'',form:'s6',row:'front'})),formation:'',pet:'',pet_condition:'',conditions:'',speed:'',queue:[],adjustments:''});
export const blankGuide=()=>({title:'',summary:'',status:'draft',video_url:'',build:{special_notes:'',queue:[],formation:'',pet:{name:'',condition:''},heroes:Array.from({length:3},blankHero),matchups:[blankMatchup()]}});
export function attackOrderError(heroes){
 for(const [key,max,label]of [['attack_order',3,'我方普攻順序'],['global_attack_order',6,'全場普攻順序']]){
  const values=heroes.map(h=>h[key]).filter(v=>v!==''&&v!=null);
  if(values.some(v=>!/^\d$/.test(String(v))||Number(v)<1||Number(v)>max))return `${label}請選擇1至${max}`;
  if(new Set(values.map(Number)).size!==values.length)return `${label}不能有兩名角色指定同一順位`;
 }
 for(const h of heroes)if(h.attack_order&&h.global_attack_order&&(Number(h.global_attack_order)<Number(h.attack_order)||Number(h.global_attack_order)>Number(h.attack_order)+3))return '我方順序與全場六人順序互相矛盾，請調整';
 for(const a of heroes)for(const b of heroes)if(a.attack_order&&b.attack_order&&a.global_attack_order&&b.global_attack_order&&Number(a.attack_order)<Number(b.attack_order)&&Number(a.global_attack_order)>Number(b.global_attack_order))return '我方順序與全場六人順序互相矛盾，請調整';
 return null;
}
export function validateGuide(g,heroIds){
 if(!g||g.title.trim().length<2||g.title.trim().length>120)return '請填寫2至120字的攻略標題';
 if(!['draft','published'].includes(g.status))return '請選擇有效的發布狀態';
 if((g.summary||'').length>6000)return '打法說明最多6000字';
 if(g.video_url&&!safeHttps(g.video_url))return '影片請使用完整的 https:// 連結';
 const b=g.build;if(!b||b.heroes.length!==3||new Set(b.heroes.map(h=>h.id)).size!==3||b.heroes.some(h=>!heroIds.has(h.id)))return '我方請選擇三名不同的角色';
 const speedError=attackOrderError(b.heroes);if(speedError)return speedError;
 for(const h of b.heroes){if(h.accessory_alternatives&&!Array.isArray(h.accessory_alternatives))return '戒指替代方案格式不正確';if((h.accessory_alternatives||[]).length>2)return '戒指最多首選、次選、第三選擇';for(const a of h.accessory_alternatives||[])if(!a.accessory_effect_1||(a.accessory_kind==='compound'&&!a.accessory_effect_2))return '請填完整的戒指替代效果，復合戒指需要兩種效果';}
 if(b.heroes.some(h=>h.set==='雜套'&&!STAT_FIELDS.some(([k])=>k===h.mixed_stat)))return '請選擇雜套優先提升的素質';
 if((b.special_notes||'').length>3000)return '特別注意事項最多3000字';
 if((b.queue||[]).length>12||(b.queue||[]).some(q=>!b.heroes.some(h=>h.id===q.hero_id)||!['s1','s2','awakened'].includes(q.skill)))return '請重新設定共用技能順序';
 if(!b.pet.name.trim())return '請選擇或填寫我方寵物';
 if(!b.matchups.length||b.matchups.length>12)return '請填寫1至12組應對組合';
 for(const [i,m] of b.matchups.entries()){
  if(m.heroes.length!==3||new Set(m.heroes.map(h=>h.id)).size!==3||m.heroes.some(h=>!heroIds.has(h.id)))return `應對組合 ${i+1}：請選擇三名不同的敵方角色`;
  if(m.queue.length>12||m.queue.some(q=>!b.heroes.some(h=>h.id===q.hero_id)||!['s1','s2','awakened'].includes(q.skill)))return `應對組合 ${i+1}：請重新設定出技順序`;
 }
 return null;
}
export function matchesEnemy(guide,ids){return !ids.length||guide.build.matchups.some(m=>ids.every(id=>m.heroes.some(h=>h.id===id)));}
export const safeHttps=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}};
export function filterGuides(guides,{text='',enemy=[],mine=false,userId}={},name=id=>id){
 return guides.filter(g=>(!mine||g.author_id===userId)&&matchesEnemy(g,enemy)&&(!text||[g.title,g.summary,...g.build.heroes.map(h=>name(h.id)),...g.build.matchups.flatMap(m=>m.heroes.map(h=>name(h.id)))].join(' ').toLowerCase().includes(text.toLowerCase())));
}
export const canEdit=(guide,userId,role)=>['admin','editor'].includes(role)&&(role==='admin'||guide.author_id===userId);
