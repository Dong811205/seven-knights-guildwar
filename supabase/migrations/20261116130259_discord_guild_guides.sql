-- 公會攻略 v1. Run once in the Supabase SQL Editor as the project administrator.
-- This file contains schema and permissions only, never guild guides or invitations.
begin;
create schema if not exists gvg_private;
revoke all on schema gvg_private from public;
grant usage on schema gvg_private to authenticated;

create table public.gvg_guilds (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 2 and 60),
 created_at timestamptz not null default now()
);
create table public.gvg_members (
 guild_id uuid not null references public.gvg_guilds(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
 role text not null default 'viewer' check (role in ('admin','editor','viewer')),
 status text not null default 'active' check (status='active'),
 discord_user_id text not null,
 checked_until timestamptz not null default now(),
 created_at timestamptz not null default now(),
 primary key (guild_id,user_id)
);
create index gvg_members_user on public.gvg_members(user_id);
-- Server-only configuration. Empty roles deny ALL access until configured.
create table gvg_private.discord_config (
 singleton boolean primary key default true check(singleton),
 guild_id uuid not null references public.gvg_guilds(id),
 discord_guild_id text not null default '',
 viewer_role_ids text[] not null default '{}',
 editor_role_ids text[] not null default '{}',
 admin_role_ids text[] not null default '{}'
);
with g as (insert into public.gvg_guilds(name) values ('七騎士GvG出刀攻略') returning id)
insert into gvg_private.discord_config(guild_id) select id from g;
alter table gvg_private.discord_config enable row level security;
revoke all on gvg_private.discord_config from public,anon,authenticated;
create table public.gvg_guides (
 id uuid primary key default gen_random_uuid(),
 guild_id uuid not null references public.gvg_guilds(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 title text not null check(char_length(btrim(title)) between 2 and 120),
 summary text not null default '' check(char_length(summary)<=6000),
 status text not null default 'draft' check(status in ('draft','published')),
 build jsonb not null,
 video_url text not null default '' check(char_length(video_url)<=2000 and (video_url='' or video_url ~ '^https://')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index gvg_guides_guild on public.gvg_guides(guild_id,updated_at desc);
create index gvg_guides_author on public.gvg_guides(author_id);
create table public.gvg_comments (
 id uuid primary key default gen_random_uuid(),
 guide_id uuid not null references public.gvg_guides(id) on delete cascade,
 author_id uuid not null default auth.uid() references auth.users(id),
 nickname text not null check(char_length(btrim(nickname)) between 1 and 40),
 result text not null default 'note' check(result in ('note','win','loss')),
 body text not null check(char_length(btrim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create index gvg_comments_guide on public.gvg_comments(guide_id,created_at);
create index gvg_comments_author on public.gvg_comments(author_id);
create table public.gvg_attachments (
 id uuid primary key default gen_random_uuid(),
 guide_id uuid not null references public.gvg_guides(id) on delete cascade,
 uploader_id uuid not null default auth.uid() references auth.users(id),
 path text unique not null check(char_length(path)<=300),
 filename text not null check(char_length(filename) between 1 and 160),
 created_at timestamptz not null default now()
);
create index gvg_attachments_guide on public.gvg_attachments(guide_id);
create index gvg_attachments_uploader on public.gvg_attachments(uploader_id);
create index gvg_discord_config_guild on gvg_private.discord_config(guild_id);

create function gvg_private.is_member(g uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gvg_members where guild_id=g and user_id=(select auth.uid()) and status='active' and checked_until>now());
$$;
create function gvg_private.is_admin(g uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gvg_members where guild_id=g and user_id=(select auth.uid()) and status='active' and checked_until>now() and role='admin');
$$;
create function gvg_private.is_editor(g uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gvg_members where guild_id=g and user_id=(select auth.uid()) and status='active' and checked_until>now() and role in ('admin','editor'));
$$;
create function gvg_private.can_read_guide(i uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gvg_guides where id=i and gvg_private.is_member(guild_id) and (status='published' or author_id=(select auth.uid()) or gvg_private.is_admin(guild_id)));
$$;
create function gvg_private.can_edit_guide(i uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gvg_guides where id=i and gvg_private.is_editor(guild_id) and (author_id=(select auth.uid()) or gvg_private.is_admin(guild_id)));
$$;
-- Reject incomplete/malformed team and enemy structures even if the client is bypassed.
create function gvg_private.valid_build(b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare h jsonb; m jsonb; q jsonb; s jsonb; n int;
begin
 if jsonb_typeof(b) is distinct from 'object' or octet_length(b::text)>100000 then return false; end if;
 if jsonb_typeof(b->'heroes') is distinct from 'array' or jsonb_array_length(b->'heroes')<>3 then return false; end if;
 select count(distinct x->>'id') into n from jsonb_array_elements(b->'heroes') x;
 if n<>3 then return false; end if;
 for h in select * from jsonb_array_elements(b->'heroes') loop
  if coalesce(h->>'id','') !~ '^[a-z0-9-]{1,80}$' or coalesce(h->>'form','') not in ('s6','awakened','source_default') or coalesce(h->>'row','') not in ('front','back') then return false; end if;
  if jsonb_typeof(h->'stats') is distinct from 'array' or jsonb_array_length(h->'stats')>24 then return false; end if;
  for s in select * from jsonb_array_elements(h->'stats') loop
   if coalesce(s->>'kind','') not in ('required','recommended') or coalesce(s->>'key','')='' or char_length(coalesce(s->>'value',''))>100 then return false; end if;
  end loop;
 end loop;
 if jsonb_typeof(b->'pet') is distinct from 'object' or char_length(b->'pet'->>'name') is null or char_length(b->'pet'->>'name') not between 1 and 80 then return false; end if;
 if jsonb_typeof(b->'matchups') is distinct from 'array' or jsonb_array_length(b->'matchups') not between 1 and 12 then return false; end if;
 for m in select * from jsonb_array_elements(b->'matchups') loop
  if jsonb_typeof(m->'heroes') is distinct from 'array' or jsonb_array_length(m->'heroes')<>3 then return false; end if;
  select count(distinct x->>'id') into n from jsonb_array_elements(m->'heroes') x;
  if n<>3 then return false; end if;
  for h in select * from jsonb_array_elements(m->'heroes') loop
   if coalesce(h->>'id','') !~ '^[a-z0-9-]{1,80}$' or coalesce(h->>'form','') not in ('s6','awakened','source_default') then return false; end if;
  end loop;
  if jsonb_typeof(m->'queue') is distinct from 'array' or jsonb_array_length(m->'queue')>12 then return false; end if;
  for q in select * from jsonb_array_elements(m->'queue') loop
   if coalesce(q->>'skill','') not in ('s1','s2','awakened') or not exists(select 1 from jsonb_array_elements(b->'heroes') x where x->>'id'=q->>'hero_id') then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end; $$;
alter table public.gvg_guides add constraint gvg_build_valid check(gvg_private.valid_build(build));
create function gvg_private.guard_guide_update() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.guild_id<>old.guild_id or new.author_id<>old.author_id or new.created_at<>old.created_at then raise exception '攻略身分與所屬公會不能變更'; end if;
 new.updated_at=now(); return new;
end; $$;
create trigger gvg_guide_update before update on public.gvg_guides for each row execute function gvg_private.guard_guide_update();

alter table public.gvg_guilds enable row level security;
alter table public.gvg_members enable row level security;
alter table public.gvg_guides enable row level security;
alter table public.gvg_comments enable row level security;
alter table public.gvg_attachments enable row level security;
revoke all on public.gvg_guilds,public.gvg_members,public.gvg_guides,public.gvg_comments,public.gvg_attachments from anon,authenticated;
grant select on public.gvg_guilds,public.gvg_members to authenticated;
grant select,insert,update,delete on public.gvg_guides to authenticated;
grant select,insert,delete on public.gvg_comments,public.gvg_attachments to authenticated;
create policy guild_read on public.gvg_guilds for select to authenticated using (gvg_private.is_member(id));
create policy member_read on public.gvg_members for select to authenticated using(gvg_private.is_member(guild_id));
create policy guide_read on public.gvg_guides for select to authenticated using(gvg_private.is_member(guild_id) and (status='published' or author_id=(select auth.uid()) or gvg_private.is_admin(guild_id)));
create policy guide_add on public.gvg_guides for insert to authenticated with check(author_id=(select auth.uid()) and gvg_private.is_editor(guild_id));
create policy guide_edit on public.gvg_guides for update to authenticated using(gvg_private.is_editor(guild_id) and (author_id=(select auth.uid()) or gvg_private.is_admin(guild_id))) with check(gvg_private.is_editor(guild_id) and (author_id=(select auth.uid()) or gvg_private.is_admin(guild_id)));
create policy guide_remove on public.gvg_guides for delete to authenticated using(gvg_private.is_editor(guild_id) and (author_id=(select auth.uid()) or gvg_private.is_admin(guild_id)));
create policy comment_read on public.gvg_comments for select to authenticated using(gvg_private.can_read_guide(guide_id));
create policy comment_add on public.gvg_comments for insert to authenticated with check(author_id=(select auth.uid()) and gvg_private.can_read_guide(guide_id) and nickname=(select m.nickname from public.gvg_members m join public.gvg_guides g on g.guild_id=m.guild_id where g.id=guide_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy comment_remove on public.gvg_comments for delete to authenticated using(gvg_private.can_read_guide(guide_id) and (author_id=(select auth.uid()) or exists(select 1 from public.gvg_guides g where g.id=guide_id and gvg_private.is_admin(g.guild_id))));
create policy attachment_read on public.gvg_attachments for select to authenticated using(gvg_private.can_read_guide(guide_id));
create policy attachment_add on public.gvg_attachments for insert to authenticated with check(uploader_id=(select auth.uid()) and gvg_private.can_edit_guide(guide_id) and exists(select 1 from public.gvg_guides g where g.id=guide_id and path like g.guild_id::text||'/'||g.id::text||'/%') and path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$' and (select count(*) from public.gvg_attachments a where a.guide_id=gvg_attachments.guide_id)<12);
create policy attachment_remove on public.gvg_attachments for delete to authenticated using(gvg_private.can_edit_guide(guide_id));

-- Only the Edge Function's service credential can apply Discord-verified roles.
create function public.gvg_discord_settings() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('discord_guild_id',discord_guild_id) from gvg_private.discord_config where singleton;
$$;
create function public.gvg_sync_discord_member(p_user uuid,p_discord_id text,p_nickname text,p_roles text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c gvg_private.discord_config; r text; expiry timestamptz;
begin
 select * into c from gvg_private.discord_config where singleton;
 if p_roles && c.admin_role_ids then r='admin';
 elsif p_roles && c.editor_role_ids then r='editor';
 elsif p_roles && c.viewer_role_ids then r='viewer';
 else delete from public.gvg_members where guild_id=c.guild_id and user_id=p_user;
 return jsonb_build_object('allowed',false); end if;
 expiry=now()+interval '2 minutes';
 insert into public.gvg_members(guild_id,user_id,discord_user_id,nickname,role,status,checked_until)
 values(c.guild_id,p_user,p_discord_id,left(p_nickname,40),r,'active',expiry)
 on conflict(guild_id,user_id) do update set discord_user_id=excluded.discord_user_id,nickname=excluded.nickname,role=excluded.role,checked_until=excluded.checked_until;
 return jsonb_build_object('allowed',true,'guild_id',c.guild_id,'role',r,'checked_until',expiry);
end; $$;
revoke all on all functions in schema gvg_private from public,anon,authenticated;
grant execute on function gvg_private.is_member(uuid),gvg_private.is_editor(uuid),gvg_private.is_admin(uuid),gvg_private.can_read_guide(uuid),gvg_private.can_edit_guide(uuid),gvg_private.valid_build(jsonb) to authenticated;
revoke all on function public.gvg_discord_settings(),public.gvg_sync_discord_member(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.gvg_discord_settings(),public.gvg_sync_discord_member(uuid,text,text,text[]) to service_role;

-- Private images. Downloads require BOTH an active membership and readable guide.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gvg-guides','gvg-guides',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy gvg_image_read on storage.objects for select to authenticated using(bucket_id='gvg-guides' and exists(select 1 from public.gvg_attachments a where a.path=name and gvg_private.can_read_guide(a.guide_id)));
create policy gvg_image_add on storage.objects for insert to authenticated with check(bucket_id='gvg-guides' and exists(select 1 from public.gvg_guides g where (storage.foldername(name))[1]=g.guild_id::text and (storage.foldername(name))[2]=g.id::text and gvg_private.can_edit_guide(g.id)) and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$');
create policy gvg_image_remove on storage.objects for delete to authenticated using(bucket_id='gvg-guides' and exists(select 1 from public.gvg_guides g where (storage.foldername(name))[1]=g.guild_id::text and (storage.foldername(name))[2]=g.id::text and gvg_private.can_edit_guide(g.id)));
commit;
