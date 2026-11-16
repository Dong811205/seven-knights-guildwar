create policy discord_config_no_client_access on gvg_private.discord_config for all to anon,authenticated using(false) with check(false);
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
