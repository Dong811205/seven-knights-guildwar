-- Website presence is independent of Discord qualification. A heartbeat never
-- extends checked_until and cannot grant or restore guild access.
begin;
create table gvg_private.website_presence (
 guild_id uuid not null,
 user_id uuid not null,
 last_seen timestamptz not null default now(),
 primary key (guild_id,user_id),
 foreign key (guild_id,user_id) references public.gvg_members(guild_id,user_id) on delete cascade
);
alter table gvg_private.website_presence enable row level security;
revoke all on gvg_private.website_presence from public,anon,authenticated;
create policy website_presence_no_direct_access on gvg_private.website_presence
 for all to authenticated using(false) with check(false);

-- The narrow definer boundary lets a caller update only their own timestamp.
create function public.gvg_presence_heartbeat(p_guild uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare caller uuid := auth.uid(); seen timestamptz := now();
begin
 if caller is null or not gvg_private.is_member(p_guild) then
  raise exception 'Guild verification required' using errcode='42501';
 end if;
 insert into gvg_private.website_presence(guild_id,user_id,last_seen)
 values(p_guild,caller,seen)
 on conflict(guild_id,user_id) do update set last_seen=excluded.last_seen;
 return seen;
end; $$;

create function public.gvg_online_members(p_guild uuid)
returns table(user_id uuid,nickname text,last_seen timestamptz,online boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not gvg_private.is_member(p_guild) then
  raise exception 'Guild verification required' using errcode='42501';
 end if;
 return query
 select m.user_id,m.nickname,p.last_seen,
        coalesce(m.checked_until>now() and p.last_seen>now()-interval '75 seconds',false)
 from public.gvg_members m
 left join gvg_private.website_presence p
 on p.guild_id=m.guild_id and p.user_id=m.user_id
 where m.guild_id=p_guild and m.status='active'
 order by 4 desc,m.nickname,m.user_id;
end; $$;
revoke all on function public.gvg_presence_heartbeat(uuid),public.gvg_online_members(uuid) from public,anon,authenticated;
grant execute on function public.gvg_presence_heartbeat(uuid),public.gvg_online_members(uuid) to authenticated;
commit;
