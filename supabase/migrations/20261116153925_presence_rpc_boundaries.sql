-- Keep narrow privileged helpers outside the exposed Data API schema.
begin;
alter function public.gvg_presence_heartbeat(uuid) set schema gvg_private;
alter function public.gvg_online_members(uuid) set schema gvg_private;
create function public.gvg_presence_heartbeat(p_guild uuid) returns timestamptz
language sql security invoker set search_path='' as $$
 select gvg_private.gvg_presence_heartbeat(p_guild);
$$;
create function public.gvg_online_members(p_guild uuid)
returns table(user_id uuid,nickname text,last_seen timestamptz,online boolean)
language sql stable security invoker set search_path='' as $$
 select * from gvg_private.gvg_online_members(p_guild);
$$;
revoke all on function public.gvg_presence_heartbeat(uuid),public.gvg_online_members(uuid) from public,anon,authenticated;
grant execute on function public.gvg_presence_heartbeat(uuid),public.gvg_online_members(uuid) to authenticated;
commit;
