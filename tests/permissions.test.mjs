import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const pg=new PGlite();
const ids={editor:'11111111-1111-4111-8111-111111111111',viewer:'22222222-2222-4222-8222-222222222222',outsider:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',otherEditor:'55555555-5555-4555-8555-555555555555'};
const otherGuild='99999999-9999-4999-8999-999999999999';
let guild,published,draft;
const fixture={formation:'保護陣型',pet:{name:'測試寵物',condition:''},heroes:['a','b','c'].map(id=>({id,form:'s6',row:'front',stats:[]})),matchups:[{heroes:['d','e','f'].map(id=>({id,form:'s6'})),queue:[{hero_id:'a',skill:'s1'}]}]};
async function as(user,fn){await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);try{return await fn()}finally{await pg.exec('reset role')}}
async function denied(user,sql,params=[]){await assert.rejects(as(user,()=>pg.query(sql,params)));}
test('setup migration and Discord-only membership',async()=>{
 await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;`);
 await pg.exec(await readFile(new URL('../supabase/migrations/20261116130259_discord_guild_guides.sql',import.meta.url),'utf8'));
 for(const id of Object.values(ids))await pg.query('insert into auth.users values ($1)',[id]);
 guild=(await pg.query('select id from public.gvg_guilds')).rows[0].id;
 await pg.query(`update gvg_private.discord_config set discord_guild_id='123456789012345678',viewer_role_ids=array['view'],editor_role_ids=array['edit'],admin_role_ids=array['admin']`);
 for(const [name,role] of [['editor','edit'],['viewer','view'],['admin','admin']])await pg.query('select public.gvg_sync_discord_member($1,$2,$3,$4)',[ids[name],'123456789012345678',name,[role]]);
 await pg.query('insert into public.gvg_guilds(id,name) values($1,$2)',[otherGuild,'另一個公會']);
 await pg.query(`insert into public.gvg_members(guild_id,user_id,discord_user_id,nickname,role,checked_until)values($1,$2,'999999999999999999','otherEditor','editor',now()+interval '2 minutes')`,[otherGuild,ids.otherEditor]);
 await denied(ids.viewer,`select public.gvg_sync_discord_member($1,'123456789012345678','hack',array['admin'])`,[ids.viewer]);
 await denied(ids.viewer,`update public.gvg_members set role='admin' where user_id=$1`,[ids.viewer]);
 await denied(ids.outsider,`insert into public.gvg_members(guild_id,user_id,discord_user_id,nickname,role,checked_until)values($1,$2,'123456789012345678','hack','admin',now()+interval '1 day')`,[guild,ids.outsider]);
});
test('editors create; viewers cannot create; draft visibility and other guild isolation',async()=>{
 const insert=async(status)=>as(ids.editor,()=>pg.query('insert into public.gvg_guides(guild_id,title,status,build) values ($1,$2,$3,$4) returning id',[guild,'測試攻略',status,fixture]));
 published=(await insert('published')).rows[0].id;draft=(await insert('draft')).rows[0].id;
 assert.equal((await as(ids.viewer,()=>pg.query('select * from public.gvg_guides'))).rows.length,1);
 assert.equal((await as(ids.editor,()=>pg.query('select * from public.gvg_guides'))).rows.length,2);
 assert.equal((await as(ids.admin,()=>pg.query('select * from public.gvg_guides'))).rows.length,2);
 for(const u of [ids.outsider,ids.otherEditor])assert.equal((await as(u,()=>pg.query('select * from public.gvg_guides where guild_id=$1',[guild]))).rows.length,0);
 await denied(ids.viewer,'insert into public.gvg_guides(guild_id,title,build) values ($1,$2,$3)',[guild,'越權新增',fixture]);
 assert.equal((await as(ids.viewer,()=>pg.query("update public.gvg_guides set title='越權' returning id"))).rows.length,0);
 assert.equal((await as(ids.otherEditor,()=>pg.query("update public.gvg_guides set title='越權' returning id"))).rows.length,0);
 await pg.exec('set role anon');await assert.rejects(pg.query('select * from public.gvg_guides'));await pg.exec('reset role');
});
test('guard immutable guide identity; malformed builds; peer editor cannot edit others',async()=>{
 await denied(ids.editor,'update public.gvg_guides set guild_id=$1 where id=$2',[otherGuild,published]);
 await denied(ids.editor,'update public.gvg_guides set author_id=$1 where id=$2',[ids.admin,published]);
 await denied(ids.editor,"insert into public.gvg_guides(guild_id,title,build) values ($1,'壞資料',$2)",[guild,{...fixture,heroes:[]}]);
 await denied(ids.editor,"update public.gvg_guides set build=$1 where id=$2",[{...fixture,matchups:[{...fixture.matchups[0],queue:[{hero_id:'unrelated',skill:'s1'}]}]},published]);
 await pg.query(`insert into public.gvg_members(guild_id,user_id,discord_user_id,nickname,role,checked_until)values($1,$2,'999999999999999999','otherEditor','editor',now()+interval '2 minutes')`,[guild,ids.otherEditor]);
 assert.equal((await as(ids.otherEditor,()=>pg.query("update public.gvg_guides set title='越權' where id=$1 returning id",[published]))).rows.length,0);
 assert.equal((await as(ids.admin,()=>pg.query("update public.gvg_guides set title='管理員修訂' where id=$1 returning id",[published]))).rows.length,1);
});
test('viewer comments require authentic nickname and cannot read draft comments',async()=>{
 await as(ids.viewer,()=>pg.query("insert into public.gvg_comments(guide_id,nickname,body)values($1,'viewer','成功觀察')",[published]));
 await denied(ids.viewer,"insert into public.gvg_comments(guide_id,nickname,body)values($1,'admin','假冒')",[published]);
 await denied(ids.viewer,"insert into public.gvg_comments(guide_id,nickname,body)values($1,'viewer','偷看草稿')",[draft]);
 await denied(ids.outsider,"insert into public.gvg_comments(guide_id,nickname,body)values($1,'outsider','外人')",[published]);
});
test('private images require guide visibility and forbid viewer uploads/path spoof',async()=>{
 const path=`${guild}/${published}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
 await as(ids.editor,()=>pg.query("insert into storage.objects(bucket_id,name)values('gvg-guides',$1)",[path]));
 await as(ids.editor,()=>pg.query('insert into public.gvg_attachments(guide_id,path,filename) values($1,$2,$3)',[published,path,'test.png']));
 assert.equal((await as(ids.viewer,()=>pg.query('select * from storage.objects'))).rows.length,1);
 await pg.query('delete from public.gvg_members where guild_id=$1 and user_id=$2',[guild,ids.otherEditor]);
 for(const u of [ids.outsider,ids.otherEditor])assert.equal((await as(u,()=>pg.query('select * from storage.objects'))).rows.length,0);
 await denied(ids.viewer,"insert into storage.objects(bucket_id,name)values('gvg-guides',$1)",[path.replace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')]);
 await denied(ids.editor,'insert into public.gvg_attachments(guide_id,path,filename)values($1,$2,$3)',[published,`${otherGuild}/${published}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`,'spoof.png']);
 const draftPath=`${guild}/${draft}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
 await as(ids.editor,()=>pg.query("insert into storage.objects(bucket_id,name)values('gvg-guides',$1)",[draftPath]));
 await as(ids.editor,()=>pg.query('insert into public.gvg_attachments(guide_id,path,filename)values($1,$2,$3)',[draft,draftPath,'draft.png']));
 assert.equal((await as(ids.viewer,()=>pg.query('select * from storage.objects'))).rows.length,1);
});
test('expired, removed and downgraded roles lose data and editing access',async()=>{
 await pg.query("update public.gvg_members set checked_until=now()-interval '1 second' where user_id=$1",[ids.viewer]);
 assert.equal((await as(ids.viewer,()=>pg.query('select * from public.gvg_guides'))).rows.length,0);
 assert.equal((await as(ids.viewer,()=>pg.query('select * from public.gvg_comments'))).rows.length,0);
 assert.equal((await as(ids.viewer,()=>pg.query('select * from storage.objects'))).rows.length,0);
 await pg.query('select public.gvg_sync_discord_member($1,$2,$3,$4)',[ids.editor,'123456789012345678','editor',['view']]);
 assert.equal((await as(ids.editor,()=>pg.query("update public.gvg_guides set title='降權後修改' returning id"))).rows.length,0);
 const deniedResult=await pg.query('select public.gvg_sync_discord_member($1,$2,$3,$4)',[ids.editor,'123456789012345678','editor',[]]);assert.equal(deniedResult.rows[0].gvg_sync_discord_member.allowed,false);
 assert.equal((await as(ids.editor,()=>pg.query('select * from public.gvg_guides'))).rows.length,0);
 await pg.close();
});
