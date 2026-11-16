begin;
create or replace function gvg_private.valid_build(b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare h jsonb; m jsonb; q jsonb; s jsonb; n int;
begin
 if jsonb_typeof(b) is distinct from 'object' or octet_length(b::text)>100000 then return false; end if;
 if b->>'kind'='screenshots' then return coalesce(jsonb_typeof(b->'heroes')='array' and jsonb_array_length(b->'heroes')=0 and jsonb_typeof(b->'matchups')='array' and jsonb_array_length(b->'matchups')=0 and (b->>'quick_count')::int between 0 and 10,false); end if;
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
  if m ? 'enemy_queue' then
   if jsonb_typeof(m->'enemy_queue') is distinct from 'array' or jsonb_array_length(m->'enemy_queue')>12 then return false;end if;
   for q in select * from jsonb_array_elements(m->'enemy_queue') loop
    if coalesce(q->>'skill','') not in ('s1','s2','awakened') or not exists(select 1 from jsonb_array_elements(m->'heroes') x where x->>'id'=q->>'hero_id') then return false;end if;
   end loop;
  end if;
  if jsonb_typeof(m->'queue') is distinct from 'array' or jsonb_array_length(m->'queue')>12 then return false; end if;
  for q in select * from jsonb_array_elements(m->'queue') loop
   if coalesce(q->>'skill','') not in ('s1','s2','awakened') or not exists(select 1 from jsonb_array_elements(b->'heroes') x where x->>'id'=q->>'hero_id') then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end; $$;

-- Serialize attachment counting on its parent row, including parallel uploads.
create function gvg_private.enforce_attachment_limit() returns trigger
language plpgsql set search_path='' as $$
declare g public.gvg_guides; limit_count int;
begin
 select * into g from public.gvg_guides where id=new.guide_id for update;
 if g.id is null then raise exception 'Guide not found' using errcode='42501';end if;
 limit_count=case when g.build->>'kind'='screenshots' then 10 else 12 end;
 if (select count(*) from public.gvg_attachments where guide_id=new.guide_id)>=limit_count then raise exception 'Image limit reached';end if;
 return new;
end;$$;
create trigger gvg_attachment_limit before insert on public.gvg_attachments for each row execute function gvg_private.enforce_attachment_limit();
create function gvg_private.guard_quick_post() returns trigger
language plpgsql set search_path='' as $$
declare n int;
begin
 if tg_op='UPDATE' and coalesce(old.build->>'kind','strategy')<>coalesce(new.build->>'kind','strategy') then raise exception 'Post type cannot change';end if;
 if new.build->>'kind'='screenshots' and new.status='published' then
  select count(*) into n from public.gvg_attachments where guide_id=new.id;
  if n not between 1 and 10 then raise exception 'Upload 1 to 10 images before publishing';end if;
 end if;
 return new;
end;$$;
create trigger gvg_quick_publish before insert or update on public.gvg_guides for each row execute function gvg_private.guard_quick_post();
revoke all on function gvg_private.enforce_attachment_limit(),gvg_private.guard_quick_post() from public,anon,authenticated;
commit;
