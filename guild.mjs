import {createClient} from './vendor/supabase.mjs';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './guild-config.mjs';
import {blankGuide,blankMatchup,STAT_FIELDS,validateGuide,filterGuides,canEdit,safeHttps} from './guild-model.mjs';
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{flowType:'pkce',detectSessionInUrl:true}});
const $=s=>document.querySelector(s),root=$('#guild-app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={setupPending:false,user:null,providerToken:null,access:null,guild:null,member:null,members:[],guides:[],view:'list',guide:null,comments:[],attachments:[],edit:null,dirty:false,busy:false,syncing:false,search:'',mine:false,enemy:['','',''],urls:[],generation:0};
let D,H,heroes,pets=[],sets=[],accessories=[],authVersion=0;
const roleText=r=>({viewer:'可查看攻略',editor:'攻略投稿者',admin:'公會管理員'}[r]||'尚未驗證');
const heroName=id=>H?.get(id)?.name_tw||id||'未選擇';
const formText=f=>({s6:'未覺醒',awakened:'覺醒',source_default:'來源預設'}[f]||f);
const person=h=>`<div class="guild-person"><img src="assets/heroes/${esc(h.id)}.webp" alt="${esc(heroName(h.id))}" loading="lazy"><span>${esc(heroName(h.id))}<small>${esc(formText(h.form))}${h.row?' · '+(h.row==='front'?'前排':'後排'):''}</small></span></div>`;
const team=hs=>`<div class="guild-team">${hs.map(person).join('')}</div>`;
const options=(items,current,empty='請選擇')=>`<option value="">${empty}</option>`+items.map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join('');
const heroOptions=id=>options(heroes.map(h=>[h.hero_id,h.name_tw]),id,'選擇角色');
const forms=(id,current)=>options([...new Set((D.skills||[]).filter(s=>s.hero_id===id).map(s=>s.form))].map(f=>[f,formText(f)]),current,'選擇型態');
function field(label,path,value,{type='text',max=1000,list='',hint='',required=false}={}){return `<label class="guild-field"><span>${label}${required?' *':''}</span>${type==='textarea'?`<textarea data-path="${path}" maxlength="${max}" rows="3">${esc(value)}</textarea>`:`<input data-path="${path}" type="${type}" value="${esc(value)}" maxlength="${max}" ${list?`list="${list}"`:''} ${required?'required':''}>`}${hint?`<small class="guild-small">${hint}</small>`:''}</label>`}
const selectField=(label,path,value,items)=>`<label class="guild-field"><span>${label}</span><select data-path="${path}">${options(items,value)}</select></label>`;
function toast(t){$('#guild-toast').textContent=t;$('#guild-toast').classList.add('show');setTimeout(()=>$('#guild-toast').classList.remove('show'),3000)}
function releaseImages(){S.urls.forEach(URL.revokeObjectURL);S.urls=[];}
function clearPrivate(){S.generation++;releaseImages();S.access=null;S.member=null;S.guild=null;S.members=[];S.guides=[];S.guide=null;S.comments=[];S.attachments=[];S.edit=null;S.dirty=false;S.view='list';}
function errorText(e){const msg=e?.message||String(e||'');if(/does not exist|schema cache|PGRST|Failed to send a request|Failed to fetch|permission denied for schema/i.test(msg))return '公會資料庫或驗證服務尚未啟用。設定完成後請重新驗證。';if(/row-level security|permission denied|42501/i.test(msg))return '權限不足或驗證已過期，請重新驗證 Discord 身分。';return msg.slice(0,260)||'操作未完成，請稍後再試。'}
function showError(e){toast(errorText(e));const slot=$('#guild-form-error');if(slot)slot.textContent=errorText(e);}
function lockPage(message='請用 Discord 驗證你的公會身分。'){
 if(S.setupPending)message='Discord 登入尚未啟用，公會攻略暫時鎖定。公開出刀建議仍可使用。';
 root.innerHTML=`<section class="guild-auth panel"><span class="eyebrow">GUILD STRATEGIES · 公會攻略</span><div class="guild-hero"><span class="guild-pill">僅限指定 Discord 身分組</span><h1>把關鍵打法，留在公會裡。</h1><p>三人陣容、寵物、角色配裝與應對條件，由公會一起累積。</p></div><div class="guild-note" role="status">${esc(message)}</div><button class="primary" data-g="login" ${S.setupPending?'disabled':''}>${S.setupPending?'等待 Discord 設定':S.user?'重新驗證 Discord':'使用 Discord 登入'}</button>${S.user?'<button class="soft-btn" data-g="logout">登出</button>':''}<div class="guild-permissions"><div><b>公會成員</b><p>有指定身分組即可查看攻略、搜尋敵隊與回報實戰。</p></div><div><b>會長與幹部</b><p>由投稿身分組開放新增攻略、編輯自己的攻略及上傳截圖。</p></div></div><p class="guild-small guild-submit">無須另辦帳密。登入不代表取得權限，仍須通過伺服器與身分組檢查。<br><a href="index.html">← 回到公開出刀建議</a></p></section>`;
}
async function login(){
 if(S.dirty&&!confirm('尚未儲存的攻略會遺失，確定重新登入？'))return;
 const {error}=await db.auth.signInWithOAuth({provider:'discord',options:{scopes:'identify email guilds.members.read',redirectTo:new URL('guild.html',location.href).href.split('?')[0]}});
 if(error)showError(error);
}
async function verify({silent=false}={}){
 if(S.syncing)return false;S.syncing=true;
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session){clearPrivate();lockPage();return false;}
  S.user=session.user;S.providerToken=session.provider_token||S.providerToken;
  if(!S.providerToken){clearPrivate();lockPage('請重新以 Discord 登入，才能檢查目前的公會身分組。');return false;}
  const {data,error}=await db.functions.invoke('discord-access',{body:{provider_token:S.providerToken}});
  if(error){let code='';try{code=(await error.context.json()).error}catch{};throw new Error(({setup_required:'Discord 公會驗證尚未設定完成。',discord_relogin_required:'Discord 驗證已過期，請重新登入。',discord_busy:'Discord 暫時忙碌，請稍後重新驗證。',identity_mismatch:'登入身分不一致，請登出後重新以 Discord 登入。'}[code])||'公會驗證服務尚未啟用或目前無法連線。');}
  if(!data?.allowed){clearPrivate();lockPage('目前沒有查看資格。請確認已加入公會 Discord，並取得指定的攻略身分組。');return false;}
  const previousRole=S.access?.role;S.access=data;
  if(previousRole&&previousRole!==data.role&&S.edit){S.edit=null;S.dirty=false;S.view='list';toast('身分組權限已更新，已關閉編輯畫面');}
  return true;
 }catch(e){if(!silent||!S.access||Date.parse(S.access.checked_until)<=Date.now()){clearPrivate();lockPage(errorText(e));}return false;}
 finally{S.syncing=false;}
}
async function loadGuild(){
 const generation=S.generation;
 const [{data:g,error:ge},{data:ms,error:me},{data:gs,error:se}]=await Promise.all([db.from('gvg_guilds').select('*').eq('id',S.access.guild_id).single(),db.from('gvg_members').select('user_id,nickname,role,status,guild_id').eq('guild_id',S.access.guild_id),db.from('gvg_guides').select('*').eq('guild_id',S.access.guild_id).order('updated_at',{ascending:false}).limit(500)]);
 if(ge||me||se)throw ge||me||se;if(generation!==S.generation)return;
 S.guild=g;S.members=ms;S.member=ms.find(m=>m.user_id===S.user.id);S.guides=gs;
 if(!S.member)throw new Error('公會資格已失效，請重新驗證。');
}
function header(){return `<div class="guild-topline"><div><span class="eyebrow">DISCORD VERIFIED · 公會內部</span><h1>${esc(S.guild.name)}</h1></div><div class="guild-actions"><span class="badge gold">${esc(roleText(S.access.role))}</span><span class="guild-small">${esc(S.member.nickname)}</span><button class="soft-btn" data-g="refresh">重新驗證</button><button class="soft-btn" data-g="logout">登出</button></div></div>`;}
function render(){if(!S.guild||!S.access)return lockPage();if(S.view==='edit')renderEditor();else if(S.view==='detail')renderDetail();else renderList();}
function renderList(){
 root.innerHTML=header()+`<div class="guild-layout"><aside class="panel guild-side"><span class="guild-pill">攻略由後端限制存取</span><h2>公會自己的解法</h2><p>同一隊可以有不同打法。查看每組敵隊的出技、速度與替換條件，再決定怎麼打。</p>${['admin','editor'].includes(S.access.role)?'<button class="primary" data-g="new">＋ 新增出刀攻略</button>':'<p>你可以查看攻略與回報實戰；新增攻略由會長及幹部的投稿身分組開放。</p>'}<button class="soft-btn" data-g="mine">${S.mine?'查看全公會':'只看我的攻略'}</button><p>${S.members.length} 位近期驗證成員<br>目前身分：${esc(roleText(S.access.role))}</p><a href="index.html">公開出刀建議 ↗</a></aside><section><div class="guild-toolbar"><label class="search-box"><input id="guild-search" placeholder="搜尋攻略、角色或打法…" value="${esc(S.search)}" aria-label="搜尋公會攻略"></label><button class="soft-btn" data-g="reload">更新攻略</button></div><details class="guild-form-section" ${S.enemy.some(Boolean)?'open':''}><summary>依敵方角色篩選</summary><div class="guild-filter">${S.enemy.map((id,i)=>`<label class="guild-field"><span>敵方角色 ${i+1}</span><select data-filter-enemy="${i}">${heroOptions(id)}</select></label>`).join('')}</div><button class="soft-btn" data-g="reset-filter">清除角色篩選</button></details><div id="guild-guide-list"></div><p class="guild-small">最多載入最近500篇。草稿只限作者與管理員查看；公會資料不儲存到本機攻略庫。</p></section></div>`;
 renderCards();
}
function renderCards(){const gs=filterGuides(S.guides,{text:S.search,enemy:S.enemy.filter(Boolean),mine:S.mine,userId:S.user.id},heroName);$('#guild-guide-list').innerHTML=`<p class="guild-small">${gs.length} 篇符合條件的攻略</p>`+(gs.length?gs.map(g=>`<article class="guild-card"><button class="guild-card-link" data-g="open" data-id="${esc(g.id)}"><span class="badge ${g.status==='draft'?'muted':'gold'}">${g.status==='draft'?'草稿・未發布':'公會內部'}</span><h2>${esc(g.title)}</h2>${team(g.build.heroes)}<p>寵物 ${esc(g.build.pet.name)} · ${g.build.matchups.length} 組應對組合</p><div class="guild-target"><span class="guild-small">應對 ${g.build.matchups.map(m=>m.heroes.map(h=>heroName(h.id)).join('＋')).map(esc).join(' ／ ')}</span></div><div class="guide-author">${esc(S.members.find(m=>m.user_id===g.author_id)?.nickname||'原公會成員')} · ${new Date(g.updated_at).toLocaleDateString('zh-TW')}</div></button></article>`).join(''):'<div class="guild-empty">沒有符合的攻略。可以調整篩選，或由投稿者新增第一篇。</div>');}
function dataLists(){return `<datalist id="pets">${pets.map(p=>`<option value="${esc(p)}">`).join('')}</datalist><datalist id="sets">${sets.map(p=>`<option value="${esc(p)}">`).join('')}</datalist><datalist id="accessories">${accessories.map(p=>`<option value="${esc(p)}">`).join('')}</datalist>`;}
function renderEditor(){const g=S.edit;
 root.innerHTML=`<section class="guild-editor"><div class="guild-topline"><div><span class="eyebrow">GUILD GUIDE · ${g.id?'編輯':'新增'}攻略</span><h1>${g.id?'調整你的出刀攻略':'留下這一隊的解法。'}</h1></div><div class="guild-actions"><button class="soft-btn" data-g="back">取消</button><button class="soft-btn" data-g="save" data-status="draft">儲存草稿</button><button class="primary" data-g="save" data-status="published">發布至公會</button></div></div><div class="guild-note">僅同公會的指定 Discord 身分組可查看。草稿須填完整三人陣容與至少一組敵隊，再儲存；尚未儲存的內容只留在本頁。</div><div id="guild-form-error" class="guild-form-error" role="alert"></div><div class="guild-form-section"><h2>01 · 攻略基本資料</h2>${field('攻略標題','title',g.title,{max:120,required:true})}${field('打法說明','summary',g.summary,{type:'textarea',max:6000,hint:'寫下勝負關鍵、適用範圍及實戰觀察；不要把建議值當成保證門檻。'})}${field('實戰影片連結（選填）','video_url',g.video_url,{type:'url',max:2000,hint:'影片本身也須限制觀看權限，網站不會替外部影片加鎖。'})}</div><div class="guild-form-section"><h2>02 · 我方隊伍與寵物</h2><div class="guild-fields">${field('陣型','build.formation',g.build.formation,{max:100,hint:'例如保護陣型、平衡陣型；各角色另選前後排。'})}${field('寵物','build.pet.name',g.build.pet.name,{list:'pets',max:80,required:true,hint:'可從建議清單選擇，也可自行填寫其他寵物。'})}</div>${field('寵物養成／替代條件','build.pet.condition',g.build.pet.condition,{max:1000})}${g.build.heroes.map(editorHero).join('')}</div><div class="guild-form-section"><h2>03 · 應對組合與特殊條件</h2><p>每組敵隊有自己的出技順序、速度條件與換裝限制。</p>${g.build.matchups.map(editorMatchup).join('')}<button class="soft-btn" data-g="add-matchup" ${g.build.matchups.length>=12?'disabled':''}>＋ 加入另一組敵方陣容</button></div><div class="guild-note">截圖：儲存後進入攻略內容頁，即可上傳公會專用圖片。</div><div class="guild-actions guild-submit"><button class="soft-btn" data-g="save" data-status="draft">儲存草稿</button><button class="primary" data-g="save" data-status="published">發布至公會</button></div>${dataLists()}</section>`;}
function editorHero(h,i){const base=`build.heroes.${i}`;return `<details open><summary>角色 ${i+1} · ${esc(heroName(h.id))}</summary><div class="guild-fields"><label class="guild-field"><span>角色 *</span><select data-path="${base}.id" data-hero-change="${i}">${heroOptions(h.id)}</select></label><label class="guild-field"><span>型態 *</span><select data-path="${base}.form">${h.id?forms(h.id,h.form):'<option value="s6">請先選角色</option>'}</select></label>${selectField('站位',`${base}.row`,h.row,[['front','前排'],['back','後排']])}${field('套裝建議',`${base}.set`,h.set,{list:'sets',max:200})}</div><details><summary>素質條件 · 必要／建議</summary><p class="guild-small">空白代表作者沒有指定，不是0。可填「至少18000」、「高於對方」等明確條件。</p><div class="guild-stats">${STAT_FIELDS.map(([key,label])=>{const s=h.stats.find(x=>x.key===key);return `<label class="guild-stat-row"><span>${label}</span><input data-stat-hero="${i}" data-stat-key="${key}" value="${esc(s?.value||'')}" maxlength="100" aria-label="角色${i+1}${label}數值"><select data-stat-kind="${i}" data-stat-key="${key}" aria-label="角色${i+1}${label}條件種類"><option value="recommended" ${s?.kind!=='required'?'selected':''}>建議</option><option value="required" ${s?.kind==='required'?'selected':''}>必要</option></select></label>`}).join('')}</div></details><div class="guild-fields">${field('武器建議',`${base}.weapon`,h.weapon)}${field('防具建議',`${base}.armor`,h.armor)}${field('副屬性建議',`${base}.substats`,h.substats)}${field('飾品／飾品組合',`${base}.accessory`,h.accessory,{list:'accessories'})}${field('專屬裝備',`${base}.exclusive`,h.exclusive)}${field('裝備必要條件、替代方案與其他說明',`${base}.notes`,h.notes,{type:'textarea',max:2000})}</div></details>`;}
function editorMatchup(m,i){const base=`build.matchups.${i}`,my=S.edit.build.heroes.filter(h=>h.id);return `<details open><summary>應對組合 ${i+1} · ${m.heroes.map(h=>esc(heroName(h.id))).join('＋')}</summary><div class="guild-fields">${m.heroes.map((h,j)=>`<div><label class="guild-field"><span>敵方角色 ${j+1} *</span><select data-path="${base}.heroes.${j}.id" data-enemy-change="${i},${j}">${heroOptions(h.id)}</select></label><label class="guild-field"><span>敵方型態</span><select data-path="${base}.heroes.${j}.form">${h.id?forms(h.id,h.form):'<option value="s6">請先選角色</option>'}</select></label></div>`).join('')}${field('敵方寵物與配置限制（選填）',`${base}.pet`,m.pet,{max:500})}</div>${field('適用條件／不能打的情況',`${base}.conditions`,m.conditions,{type:'textarea',max:3000})}${field('速度與先手必要條件',`${base}.speed`,m.speed,{type:'textarea',max:2000,hint:'例如甲速度 > 乙；須搶過敵方角色；未知條件請寫尚未確認。'})}<h3>技能預約順序</h3>${m.queue.map((q,j)=>`<div class="queue-line"><span>${j+1}</span><select data-path="${base}.queue.${j}.hero_id" aria-label="應對${i+1}第${j+1}手角色">${options(my.map(h=>[h.id,heroName(h.id)]),q.hero_id)}</select><select data-path="${base}.queue.${j}.skill" aria-label="應對${i+1}第${j+1}手技能">${options([['s1','技能1'],['s2','技能2'],['awakened','覺醒技']],q.skill)}</select><button class="soft-btn" data-g="queue-up" data-i="${i}" data-j="${j}" ${j===0?'disabled':''} aria-label="提前第${j+1}手">↑</button><button class="soft-btn" data-g="queue-remove" data-i="${i}" data-j="${j}" aria-label="移除第${j+1}手">×</button></div>`).join('')}<button class="soft-btn" data-g="queue-add" data-i="${i}" ${m.queue.length>=12?'disabled':''}>＋ 加入下一手</button>${field('這組對局的換寵／換裝／替換條件',`${base}.adjustments`,m.adjustments,{type:'textarea',max:3000})}${S.edit.build.matchups.length>1?`<button class="soft-btn" data-g="remove-matchup" data-i="${i}">移除這組應對組合</button>`:''}</details>`;}
function getPath(obj,path){return path.split('.').reduce((o,k)=>o?.[k],obj)}
function setPath(obj,path,value){const keys=path.split('.'),last=keys.pop();let ptr=obj;for(const k of keys)ptr=ptr[k];ptr[last]=value;}
function stamp(){S.dirty=true;}
async function saveGuide(status){
 if(S.busy)return;S.edit.status=status;const problem=validateGuide(S.edit,new Set(heroes.map(h=>h.hero_id)));if(problem){$('#guild-form-error').textContent=problem;$('#guild-form-error').scrollIntoView({block:'center'});return;}
 const payload=structuredClone(S.edit);S.busy=true;root.querySelectorAll('[data-g="save"]').forEach(b=>b.disabled=true);
 try{
  if(!await verify())return;
  if(!['admin','editor'].includes(S.access.role))throw new Error('目前沒有投稿權限');
  let response;const fields={title:payload.title.trim(),summary:payload.summary,status,build:payload.build,video_url:payload.video_url.trim()};
  if(payload.id)response=await db.from('gvg_guides').update(fields).eq('id',payload.id).select().single();
  else response=await db.from('gvg_guides').insert({...fields,guild_id:S.access.guild_id,author_id:S.user.id}).select().single();
  if(response.error)throw response.error;S.dirty=false;S.edit=null;await loadGuild();await openGuide(response.data.id);toast(status==='draft'?'草稿已儲存，只有作者與管理員可見':'已發布至公會攻略');
 }catch(e){showError(e);}finally{S.busy=false;root.querySelectorAll('[data-g="save"]').forEach(b=>b.disabled=false);}
}
async function openGuide(id){
 releaseImages();const generation=S.generation;
 const {data,error}=await db.from('gvg_guides').select('*').eq('id',id).single();if(error)throw error;if(generation!==S.generation)return;
 S.guide=data;S.view='detail';S.comments=[];S.attachments=[];renderDetail();
 const [{data:cs,error:ce},{data:ats,error:ae}]=await Promise.all([db.from('gvg_comments').select('*').eq('guide_id',id).order('created_at'),db.from('gvg_attachments').select('*').eq('guide_id',id).order('created_at')]);
 if(generation!==S.generation||S.guide?.id!==id||S.view!=='detail')return;
 if(ce||ae)throw ce||ae;S.comments=cs;S.attachments=ats;renderDetail();await loadImages();window.scrollTo({top:0});
}
function renderDetail(){const g=S.guide;if(!g)return;const edit=canEdit(g,S.user.id,S.access.role);
 root.innerHTML=`<section class="guild-detail"><div class="guild-topline"><a href="guild.html" data-g="back">← 公會攻略</a><div class="guild-actions">${edit?'<button class="soft-btn" data-g="edit">編輯攻略</button><button class="soft-btn" data-g="delete">刪除攻略</button>':''}<button class="soft-btn" data-g="logout">登出</button></div></div><span class="badge gold">${g.status==='draft'?'草稿・限作者與管理員':'公會內部攻略'}</span><h1>${esc(g.title)}</h1><div class="guide-author">${esc(S.members.find(m=>m.user_id===g.author_id)?.nickname||'原公會成員')} · 更新 ${new Date(g.updated_at).toLocaleString('zh-TW')}</div><div class="guild-form-section"><div class="guild-prose">${esc(g.summary||'作者未補充打法說明。')}</div>${safeHttps(g.video_url)?`<p><a href="${esc(g.video_url)}" target="_blank" rel="noopener noreferrer">查看實戰影片 ↗</a></p>`:''}</div><div class="guild-form-section"><h2>進攻陣容</h2>${team(g.build.heroes)}<div class="guild-note">陣型：${esc(g.build.formation||'未指定')}<br>寵物：${esc(g.build.pet.name)}${g.build.pet.condition?'\n'+esc(g.build.pet.condition):''}</div><div class="guild-build-grid">${g.build.heroes.map(h=>`<article>${person(h)}<h3>素質需求</h3>${h.stats.filter(s=>s.value).map(s=>`<p class="stat-line ${s.kind==='required'?'required':'recommended'}">${s.kind==='required'?'必要':'建議'} · ${esc(STAT_FIELDS.find(([k])=>k===s.key)?.[1]||s.key)}：${esc(s.value)}</p>`).join('')||'<p class="guild-small">未指定數值門檻</p>'}<dl>${[['set','套裝'],['weapon','武器'],['armor','防具'],['substats','副屬性'],['accessory','飾品'],['exclusive','專屬裝備'],['notes','必要條件／替代方案']].map(([k,l])=>`<dt>${l}</dt><dd>${esc(h[k]||'未指定')}</dd>`).join('')}</dl></article>`).join('')}</div></div><div class="guild-form-section"><h2>應對組合</h2>${g.build.matchups.map((m,i)=>`<div class="guild-target"><h3>對局 ${i+1}</h3>${team(m.heroes)}${m.pet?`<div class="guild-note">敵方寵物／配置：${esc(m.pet)}</div>`:''}<h3>適用條件</h3><p class="guild-prose">${esc(m.conditions||'作者未指定，請先核對實際敵方配置。')}</p><h3>速度與先手</h3><p class="guild-prose">${esc(m.speed||'作者未指定速度條件。')}</p><h3>技能預約順序</h3><div class="guild-note">${m.queue.length?m.queue.map((q,j)=>`${j+1}. ${heroName(q.hero_id)} ${q.skill==='s1'?'技能1':q.skill==='s2'?'技能2':'覺醒技'}`).map(esc).join('\n'):'作者未指定，不能推定出技順序。'}</div>${m.adjustments?`<h3>對局專用調整</h3><p class="guild-prose">${esc(m.adjustments)}</p>`:''}</div>`).join('')}</div><section class="guild-form-section"><h2>實戰截圖</h2><p class="guild-small">圖片同樣需要公會權限才能下載。</p><div class="guild-images">${S.attachments.map(a=>`<figure><div class="guild-loading" id="image-${esc(a.id)}">載入圖片…</div><figcaption>${esc(a.filename)} ${edit?`<button class="link-btn" data-g="image-delete" data-id="${esc(a.id)}">移除</button>`:''}</figcaption></figure>`).join('')}</div>${!S.attachments.length?'<p class="guild-small">尚未附上截圖。</p>':''}${edit?`<input class="guild-file" id="guild-upload" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上傳攻略截圖" ${S.attachments.length>=12?'disabled':''}><p class="guild-small">單張上限5MB，最多12張，支援PNG／JPG／WebP。</p>`:''}</section><section class="guild-form-section"><h2>實戰回報與補充</h2><p class="guild-small">回報是個別實戰觀察，不會自動換算成保證勝率。</p>${S.comments.map(c=>`<article class="guild-comment"><div class="guild-comment-head"><span>${esc(c.nickname)} · ${c.result==='win'?'成功':c.result==='loss'?'失敗':'補充'} · ${new Date(c.created_at).toLocaleDateString('zh-TW')}</span>${c.author_id===S.user.id||S.access.role==='admin'?`<button class="link-btn" data-g="comment-delete" data-id="${esc(c.id)}">刪除</button>`:''}</div><p class="guild-prose">${esc(c.body)}</p></article>`).join('')}<form id="guild-comment-form"><label class="guild-field"><span>回報類型</span><select name="result"><option value="note">補充說明</option><option value="win">成功</option><option value="loss">失敗</option></select></label><label class="guild-field"><span>實戰配置、結果或注意事項</span><textarea name="body" maxlength="3000" required rows="3"></textarea></label><button class="soft-btn" type="submit">送出回報</button></form></section></section>`;}
async function loadImages(){const generation=S.generation,id=S.guide?.id;for(const a of S.attachments){
 const slot=$(`#image-${a.id}`);if(!slot)continue;
 const {data,error}=await db.storage.from('gvg-guides').download(a.path);
 if(generation!==S.generation||S.guide?.id!==id||S.view!=='detail')return;
 if(error){slot.textContent='圖片無法載入，請重新驗證後再試。';continue;}
 const url=URL.createObjectURL(data);S.urls.push(url);const img=document.createElement('img');img.src=url;img.alt=a.filename;slot.replaceChildren(img);slot.classList.remove('guild-loading');
 }}
async function uploadImage(file){
 if(!file||S.busy)return;if(file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('請選擇5MB以下的 PNG、JPG 或 WebP 圖片');
 S.busy=true;const input=$('#guild-upload');if(input)input.disabled=true;
 try{if(!await verify())return;const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=`${S.access.guild_id}/${S.guide.id}/${crypto.randomUUID()}.${ext}`;
 const {error}=await db.storage.from('gvg-guides').upload(path,file,{contentType:file.type,cacheControl:'0',upsert:false});if(error)throw error;
 const {error:ae}=await db.from('gvg_attachments').insert({guide_id:S.guide.id,uploader_id:S.user.id,path,filename:file.name.slice(0,160)});
 if(ae){await db.storage.from('gvg-guides').remove([path]);throw ae;}
 await openGuide(S.guide.id);toast('截圖已上傳至公會私有空間');
 }catch(e){showError(e)}finally{S.busy=false;if(input)input.disabled=false;}}
async function action(b){const a=b.dataset.g;if(S.busy&&!['logout'].includes(a))return;
 try{
 if(a==='login')return login();
 if(a==='logout'){if(S.dirty&&!confirm('攻略尚未儲存，確定登出？'))return;clearPrivate();S.providerToken=null;S.user=null;authVersion++;await db.auth.signOut({scope:'local'});lockPage('已登出。');return;}
 if(a==='refresh'){if(await verify()){await loadGuild();render();}return;}
 if(!S.access||Date.parse(S.access.checked_until)<=Date.now()){clearPrivate();lockPage('公會資格驗證已到期，請重新驗證。');return;}
 if(a==='back'){if(S.dirty&&!confirm('離開會捨棄尚未儲存的內容，確定離開？'))return;S.edit=null;S.dirty=false;S.view='list';S.guide=null;releaseImages();await loadGuild();render();window.scrollTo({top:0});}
 else if(a==='new'){if(!['admin','editor'].includes(S.access.role))return;S.edit=blankGuide();const preset=new URL(location.href).searchParams.get('enemy')?.split(',');if(preset?.length===3&&preset.every(id=>H.has(id)))S.edit.build.matchups[0].heroes=preset.map(id=>({id,form:'s6'}));S.view='edit';S.dirty=false;render();window.scrollTo({top:0});}
 else if(a==='mine'){S.mine=!S.mine;renderList();}
 else if(a==='reload'){await loadGuild();renderList();}
 else if(a==='reset-filter'){S.enemy=['','',''];renderList();}
 else if(a==='open')await openGuide(b.dataset.id);
 else if(a==='edit'){if(!canEdit(S.guide,S.user.id,S.access.role))return;S.edit=structuredClone(S.guide);S.view='edit';S.dirty=false;releaseImages();render();window.scrollTo({top:0});}
 else if(a==='save')await saveGuide(b.dataset.status);
 else if(a==='add-matchup'){S.edit.build.matchups.push(blankMatchup());stamp();renderEditor();}
 else if(a==='remove-matchup'){S.edit.build.matchups.splice(+b.dataset.i,1);stamp();renderEditor();}
 else if(a==='queue-add'){const hero=S.edit.build.heroes.find(h=>h.id);if(!hero)return toast('先選擇我方角色，再設定出技順序');S.edit.build.matchups[+b.dataset.i].queue.push({hero_id:hero.id,skill:'s1'});stamp();renderEditor();}
 else if(a==='queue-remove'){S.edit.build.matchups[+b.dataset.i].queue.splice(+b.dataset.j,1);stamp();renderEditor();}
 else if(a==='queue-up'){const q=S.edit.build.matchups[+b.dataset.i].queue,j=+b.dataset.j;[q[j-1],q[j]]=[q[j],q[j-1]];stamp();renderEditor();}
 else if(a==='delete'){if(!confirm('確定刪除這篇攻略與回報？此操作無法復原。'))return;if(!await verify())return;for(const at of S.attachments){const {error}=await db.storage.from('gvg-guides').remove([at.path]);if(error)throw error;}const {error}=await db.from('gvg_guides').delete().eq('id',S.guide.id).select().single();if(error)throw error;S.guide=null;S.view='list';releaseImages();await loadGuild();render();toast('攻略已刪除');}
 else if(a==='image-delete'){if(!confirm('確定移除此張截圖？'))return;const at=S.attachments.find(x=>x.id===b.dataset.id);if(!at)return;const {error}=await db.storage.from('gvg-guides').remove([at.path]);if(error)throw error;const {error:ae}=await db.from('gvg_attachments').delete().eq('id',at.id).select().single();if(ae)throw ae;await openGuide(S.guide.id);}
 else if(a==='comment-delete'){if(!confirm('確定刪除此則回報？'))return;const {error}=await db.from('gvg_comments').delete().eq('id',b.dataset.id).select().single();if(error)throw error;await openGuide(S.guide.id);}
 }catch(e){showError(e);}
}
root.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(b){e.preventDefault();action(b)}});
root.addEventListener('input',e=>{
 if(e.target.id==='guild-search'){S.search=e.target.value;renderCards();return;}
 if(!S.edit)return;
 if(e.target.dataset.path){setPath(S.edit,e.target.dataset.path,e.target.value);stamp();}
 if(e.target.dataset.statHero!==undefined){const i=+e.target.dataset.statHero,key=e.target.dataset.statKey,h=S.edit.build.heroes[i];let s=h.stats.find(x=>x.key===key);if(!s){s={key,value:'',kind:'recommended'};h.stats.push(s)}s.value=e.target.value;stamp();}
});
root.addEventListener('change',e=>{
 if(e.target.id==='guild-upload')return uploadImage(e.target.files[0]);
 if(e.target.dataset.filterEnemy!==undefined){S.enemy[+e.target.dataset.filterEnemy]=e.target.value;renderCards();return;}
 if(!S.edit)return;
 if(e.target.dataset.path){setPath(S.edit,e.target.dataset.path,e.target.value);stamp();}
 if(e.target.dataset.statKind!==undefined){const h=S.edit.build.heroes[+e.target.dataset.statKind],key=e.target.dataset.statKey;let s=h.stats.find(x=>x.key===key);if(!s){s={key,value:'',kind:e.target.value};h.stats.push(s)}else s.kind=e.target.value;stamp();}
 if(e.target.dataset.heroChange!==undefined){const h=S.edit.build.heroes[+e.target.dataset.heroChange],fs=[...new Set(D.skills.filter(s=>s.hero_id===h.id).map(s=>s.form))];h.form=fs.includes('s6')?'s6':fs[0]||'s6';S.edit.build.matchups.forEach(m=>m.queue=m.queue.filter(q=>S.edit.build.heroes.some(h=>h.id===q.hero_id)));renderEditor();}
 if(e.target.dataset.enemyChange){const [i,j]=e.target.dataset.enemyChange.split(',').map(Number),h=S.edit.build.matchups[i].heroes[j],fs=[...new Set(D.skills.filter(s=>s.hero_id===h.id).map(s=>s.form))];h.form=fs.includes('s6')?'s6':fs[0]||'s6';renderEditor();}
});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='guild-comment-form')return;e.preventDefault();if(S.busy)return;const form=e.target,body=form.elements.body.value.trim(),result=form.elements.result.value;if(!body)return;S.busy=true;form.querySelector('button').disabled=true;
 try{if(!await verify())return;const {error}=await db.from('gvg_comments').insert({guide_id:S.guide.id,author_id:S.user.id,nickname:S.member.nickname,result,body});if(error)throw error;await openGuide(S.guide.id);toast('實戰回報已送出');}catch(err){showError(err)}finally{S.busy=false;if(form.isConnected)form.querySelector('button').disabled=false;}
});
window.addEventListener('beforeunload',e=>{if(S.dirty){e.preventDefault();e.returnValue='';}});
setInterval(async()=>{if(!S.user||!S.access)return;const previous=S.access.role;if(await verify({silent:true})){if(previous!==S.access.role){await loadGuild().catch(showError);render();}}},60000);
setInterval(()=>{if(S.access&&Date.parse(S.access.checked_until)<=Date.now()){clearPrivate();lockPage('Discord 身分驗證已到期。請重新驗證後繼續查看。');}},5000);
async function start(session){const run=++authVersion;
 if(!session){clearPrivate();S.user=null;lockPage();return;}
 S.user=session.user;S.providerToken=session.provider_token||S.providerToken;
 if(!await verify()||run!==authVersion)return;
 try{await loadGuild();if(run===authVersion)render();}catch(e){clearPrivate();lockPage(errorText(e));}
}
try{
 try{const settings=await fetch(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});if(settings.ok){const cfg=await settings.json();S.setupPending=cfg.external?.discord===false;}}catch{}
 const response=await fetch('app-data.json');if(!response.ok)throw new Error('角色資料無法載入');D=await response.json();heroes=D.heroes.filter(h=>h.released_in_source).sort((a,b)=>a.name_tw.localeCompare(b.name_tw,'zh-Hant'));H=new Map(heroes.map(h=>[h.hero_id,h]));pets=[...new Set(D.guildwar_teams.flatMap(t=>t.pet_options_tw_json))].sort();sets=[...new Set(D.guildwar_hero_builds.map(b=>b.gear_set_tw).filter(Boolean))];accessories=[...new Set(D.guildwar_hero_builds.flatMap(b=>[...b.accA_tw_json,...b.accB_tw_json]))];
 const enemy=new URL(location.href).searchParams.get('enemy')?.split(',');if(enemy?.length===3&&enemy.every(id=>H.has(id)))S.enemy=enemy;
 db.auth.onAuthStateChange((event,session)=>{if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT'){setTimeout(()=>{if(event==='SIGNED_IN'&&S.user?.id===session?.user.id&&S.guild){S.providerToken=session.provider_token||S.providerToken;return;}start(session)},0);}});
}catch(e){lockPage(errorText(e));}
