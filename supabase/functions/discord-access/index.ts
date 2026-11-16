import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
// No Discord client secret / bot token in the web app. The user's consented OAuth
// token is checked against Discord on the SERVER; roles supplied by a client are ignored.
const origin = 'https://dong811205.github.io';
const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const respond=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json',...(body?.retry_after?{'Retry-After':String(body.retry_after)}:{})}});
// Isolate-local request coalescing and bounded cache. Cached permissions retain the
// ORIGINAL database deadline; neither errors nor cache hits renew membership.
const results=new Map<string,{data:any,until:number}>();
const pending=new Map<string,Promise<Response>>();
const cooldowns=new Map<string,number>();
let globalCooldown=0;
const remaining=(until:number)=>Math.max(1,Math.ceil((until-Date.now())/1000));
async function discordFailure(res:Response,key:string){
 if(res.status===429){
  let body:any={};try{body=await res.json();}catch{}
  const header=res.headers.get('Retry-After');
  const seconds=header===null?NaN:Number(header);
  const headerMs=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-Date.now():0;
  const bodyMs=Number.isFinite(Number(body.retry_after))?Number(body.retry_after)*1000:0;
  const until=Date.now()+Math.max(1000,headerMs||0,bodyMs||0,5000);
  cooldowns.set(key,until);if(body.global===true)globalCooldown=Math.max(globalCooldown,until);
  return respond({error:'discord_busy',retry_after:remaining(until)},429);
 }
 if(res.status===401||res.status===403)return respond({error:'discord_relogin_required'},401);
 return respond({error:'discord_unavailable',retry_after:10},503);
}
function prune(){
 const now=Date.now();
 for(const [key,value] of results)if(value.until<=now)results.delete(key);
 for(const [key,until] of cooldowns)if(until<=now)cooldowns.delete(key);
 while(results.size>256)results.delete(results.keys().next().value!);
 while(cooldowns.size>256)cooldowns.delete(cooldowns.keys().next().value!);
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 if(req.headers.get('origin')!==origin)return respond({error:'origin_not_allowed'},403);
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return respond({error:'not_authenticated'},401);
 const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
 const backendKey=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!backendKey)return respond({error:'setup_required'},503);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,backendKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:{user},error}=await admin.auth.getUser(bearer.slice(7));
  if(error||!user)return respond({error:'not_authenticated'},401);
  const identity=user.identities?.find(i=>i.provider==='discord');
  const discordId=identity?.identity_data?.provider_id||identity?.identity_data?.sub;
  if(!discordId||!/^\d{17,22}$/.test(String(discordId)))return respond({error:'discord_login_required'},403);
  const {data:cfg,error:cfgError}=await admin.rpc('gvg_discord_settings');
  if(cfgError||!cfg?.discord_guild_id||!/^\d{17,22}$/.test(cfg.discord_guild_id))return respond({error:'setup_required'},503);
  const text=await req.text();if(text.length>6000)return respond({error:'invalid_request'},400);
  const token=JSON.parse(text).provider_token;
  if(typeof token!=='string'||token.length<10||token.length>4096)return respond({error:'discord_relogin_required'},401);
  prune();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const key=JSON.stringify([user.id,String(discordId),cfg,hash]);
  const cached=results.get(key);
  if(cached&&cached.until>Date.now())return respond(cached.data);
  const waitUntil=Math.max(globalCooldown,cooldowns.get(key)||0);
  if(waitUntil>Date.now())return respond({error:'discord_busy',retry_after:remaining(waitUntil)},429);
  const running=pending.get(key);if(running)return (await running).clone();
  const task=(async()=>{
  const dcHeaders={Authorization:`Bearer ${token}`};
  const meRes=await fetch('https://discord.com/api/v10/users/@me',{headers:dcHeaders,signal:AbortSignal.timeout(10000)});
  if(!meRes.ok)return discordFailure(meRes,key);
  const me=await meRes.json();
  if(me.id!==String(discordId))return respond({error:'identity_mismatch'},403);
  const memberRes=await fetch(`https://discord.com/api/v10/users/@me/guilds/${cfg.discord_guild_id}/member`,{headers:dcHeaders,signal:AbortSignal.timeout(10000)});
  if(memberRes.status===404){await admin.rpc('gvg_sync_discord_member',{p_user:user.id,p_discord_id:me.id,p_nickname:me.global_name||me.username,p_roles:[]});return respond({allowed:false,reason:'not_in_server'});}
  if(!memberRes.ok)return discordFailure(memberRes,key);
  const member=await memberRes.json();
  const roles=member.pending?[]:member.roles;
  if(!Array.isArray(roles)||!roles.every(r=>typeof r==='string'))return respond({error:'invalid_discord_response'},502);
  const {data,error:writeError}=await admin.rpc('gvg_sync_discord_member',{p_user:user.id,p_discord_id:me.id,p_nickname:member.nick||me.global_name||me.username,p_roles:roles});
  if(writeError)return respond({error:'membership_update_failed'},500);
  const deadline=Date.parse(data?.checked_until||'');
  if(data?.allowed&&Number.isFinite(deadline)&&deadline>Date.now())results.set(key,{data,until:Math.min(Date.now()+30000,deadline)});
  return respond(data);
  })();
  pending.set(key,task);
  try{return (await task).clone();}finally{pending.delete(key);}
 }catch{return respond({error:'verification_failed',retry_after:10},502);}
});
