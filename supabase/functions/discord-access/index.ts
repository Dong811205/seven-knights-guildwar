import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
// No Discord client secret / bot token in the web app. The user's consented OAuth
// token is checked against Discord on the SERVER; roles supplied by a client are ignored.
const origin = 'https://dong811205.github.io';
const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
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
  // Requests are at most once per minute in the client; the DB validity is only 2 min.
  const text=await req.text();if(text.length>6000)return respond({error:'invalid_request'},400);
  const token=JSON.parse(text).provider_token;
  if(typeof token!=='string'||token.length<10||token.length>4096)return respond({error:'discord_relogin_required'},401);
  const dcHeaders={Authorization:`Bearer ${token}`};
  const meRes=await fetch('https://discord.com/api/v10/users/@me',{headers:dcHeaders,signal:AbortSignal.timeout(10000)});
  if(!meRes.ok)return respond({error:meRes.status===429?'discord_busy':'discord_relogin_required'},meRes.status===429?429:401);
  const me=await meRes.json();
  if(me.id!==String(discordId))return respond({error:'identity_mismatch'},403);
  const memberRes=await fetch(`https://discord.com/api/v10/users/@me/guilds/${cfg.discord_guild_id}/member`,{headers:dcHeaders,signal:AbortSignal.timeout(10000)});
  if(memberRes.status===404){await admin.rpc('gvg_sync_discord_member',{p_user:user.id,p_discord_id:me.id,p_nickname:me.global_name||me.username,p_roles:[]});return respond({allowed:false,reason:'not_in_server'});}
  if(!memberRes.ok)return respond({error:memberRes.status===429?'discord_busy':'discord_relogin_required'},memberRes.status===429?429:401);
  const member=await memberRes.json();
  const roles=member.pending?[]:member.roles;
  if(!Array.isArray(roles)||!roles.every(r=>typeof r==='string'))return respond({error:'invalid_discord_response'},502);
  const {data,error:writeError}=await admin.rpc('gvg_sync_discord_member',{p_user:user.id,p_discord_id:me.id,p_nickname:member.nick||me.global_name||me.username,p_roles:roles});
  if(writeError)return respond({error:'membership_update_failed'},500);
  return respond(data);
 }catch{return respond({error:'verification_failed'},502);}
});
