-- Reproducible, server-only concept links. Original questions and historical
-- usage snapshots remain untouched; published links can only be reimported.
create or replace function public.admin_link_question_bank_concepts(p_version text,p_checksum text,p_links jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_status text;v_changed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  select status into v_status from private.question_bank_imports where version=p_version and canonical_sha256=p_checksum;
  if not found then raise exception 'BANK_CHECKSUM_MISMATCH';end if;
  if p_links is null or jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links) not between 1 and 250
    or (select count(distinct r->>'question_id') from jsonb_array_elements(p_links)r)<>jsonb_array_length(p_links)
    or exists(select 1 from jsonb_array_elements(p_links)r
      where not exists(select 1 from public.questions q where q.id=r->>'question_id' and q.source_version<>p_version)
        or not exists(select 1 from public.questions q where q.source_version=p_version and q.semantic_key=r->>'semantic_key'))
    then raise exception 'INVALID_CONCEPT_LINKS';end if;
  if exists(select 1 from jsonb_array_elements(p_links)r join private.question_semantic_aliases a on a.question_id=r->>'question_id'
    where a.semantic_key is distinct from r->>'semantic_key') then raise exception 'CONCEPT_LINK_IMMUTABLE';end if;
  insert into private.question_semantic_aliases(question_id,semantic_key)
    select r->>'question_id',r->>'semantic_key' from jsonb_array_elements(p_links)r on conflict(question_id)do nothing;
  get diagnostics v_changed=row_count;
  if v_status<>'IMPORTING' and v_changed>0 then raise exception 'BANK_PUBLISHED_IMMUTABLE';end if;
  return jsonb_build_object('linksReceived',jsonb_array_length(p_links),'linksChanged',v_changed);
end;$$;
revoke all on function public.admin_link_question_bank_concepts(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_link_question_bank_concepts(text,text,jsonb) to service_role;
