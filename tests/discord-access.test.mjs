import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {transform} from 'esbuild';
const source=(await readFile(new URL('../supabase/functions/discord-access/index.ts',import.meta.url),'utf8')).replace(/import \{ createClient \} from '[^']+';/,"const createClient=(...args)=>globalThis.testAdmin;");
const js=(await transform(source,{loader:'ts',format:'esm'})).code;
const originalFetch=globalThis.fetch;let handler,calls=[],mode='valid',roleInput,fetchCount=0,expiresAt,sequence=0;
const discordId='123456789012345678',userId='11111111-1111-4111-8111-111111111111';
async function setup(){
 calls=[];mode='valid';fetchCount=0;expiresAt=new Date(Date.now()+120000).toISOString();
 globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEYS:'{"default":"testing-not-a-real-secret"}'}[k])},serve:fn=>handler=fn};
 globalThis.testAdmin={auth:{getUser:async token=>token==='valid-session'?{data:{user:{id:userId,identities:[{provider:'discord',identity_data:{provider_id:discordId}}]}}}:{data:{user:null},error:new Error('invalid')}},rpc:async(name,args)=>{calls.push(name);if(name==='gvg_discord_settings')return {data:{discord_guild_id:'999999999999999999'}};roleInput=args;return {data:{allowed:args.p_roles.length>0,role:'editor',checked_until:expiresAt}};}};
 await import('data:text/javascript;base64,'+Buffer.from(js+`\n// isolated ${sequence++}`).toString('base64'));
 globalThis.fetch=async(url,init)=>{
  fetchCount++;assert.equal(init.headers.Authorization,'Bearer real-discord-token-for-test');
  if(mode==='busy')return new Response(JSON.stringify({retry_after:45}),{status:429,headers:{'Retry-After':'60'}});
  if(mode==='outage')return new Response('unavailable',{status:503});
  if(url.endsWith('/users/@me'))return new Response(JSON.stringify({id:mode==='mismatch'?'777777777777777777':discordId,username:'test'}),{status:mode==='expired'?401:200});
  if(mode==='notmember')return new Response('{}',{status:404});
  return new Response(JSON.stringify({roles:['server-editor-role'],nick:'Test',pending:mode==='pending'}));
 };
}
const request=(body={},token='valid-session',origin='https://dong811205.github.io')=>new Request('https://example.supabase.co/functions/v1/discord-access',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({provider_token:'real-discord-token-for-test',...body})});
test('reject invalid Supabase session before contacting Discord',async()=>{await setup();const r=await handler(request({},'invalid'));assert.equal(r.status,401);assert.deepEqual(calls,[]);assert.equal(fetchCount,0)});
test('ignore client role claims and use Discord verified roles',async()=>{await setup();const r=await handler(request({roles:['admin'],user_id:'another-user'}));assert.equal(r.status,200);assert.deepEqual(roleInput.p_roles,['server-editor-role']);assert.equal(roleInput.p_user,userId);assert.equal(roleInput.p_discord_id,discordId)});
test('cannot present a different Discord users token',async()=>{await setup();mode='mismatch';const r=await handler(request());assert.equal(r.status,403);assert.equal(calls.includes('gvg_sync_discord_member'),false)});
test('expired provider token never renews membership',async()=>{await setup();mode='expired';const r=await handler(request());assert.equal(r.status,401);assert.equal(calls.includes('gvg_sync_discord_member'),false)});
test('leaving server or pending screening removes membership',async()=>{for(const m of ['notmember','pending']){await setup();mode=m;const r=await handler(request());assert.equal((await r.json()).allowed,false);assert.deepEqual(roleInput.p_roles,[])}});
test('wrong origins cannot call verification service',async()=>{await setup();const r=await handler(request({},'valid-session','https://another.example'));assert.equal(r.status,403);assert.equal(fetchCount,0)});
test('concurrent calls share Discord requests and cache does not extend DB deadline',async()=>{await setup();const rs=await Promise.all([handler(request()),handler(request()),handler(request())]);for(const r of rs)assert.equal((await r.json()).checked_until,expiresAt);assert.equal(fetchCount,2);assert.equal(calls.filter(x=>x==='gvg_sync_discord_member').length,1);const cached=await handler(request());assert.equal((await cached.json()).checked_until,expiresAt);assert.equal(fetchCount,2);const unauth=await handler(request({},'invalid'));assert.equal(unauth.status,401)});
test('429 honors retry-after without repeated Discord requests or membership renewal',async()=>{await setup();mode='busy';const r=await handler(request());assert.equal(r.status,429);const body=await r.json();assert.equal(body.error,'discord_busy');assert.equal(body.retry_after,60);assert.equal(r.headers.get('Retry-After'),'60');const r2=await handler(request());assert.equal(r2.status,429);assert.equal(fetchCount,1);assert.equal(calls.includes('gvg_sync_discord_member'),false)});
test('expired DB deadline is never cached',async()=>{await setup();expiresAt=new Date(Date.now()-1000).toISOString();await handler(request());mode='notmember';const r=await handler(request());assert.equal((await r.json()).allowed,false);assert.equal(fetchCount,4)});
test('Discord outages are transient errors, not forced reauthentication',async()=>{await setup();mode='outage';const r=await handler(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'discord_unavailable',retry_after:10});assert.equal(calls.includes('gvg_sync_discord_member'),false)});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.Deno;delete globalThis.testAdmin;});
