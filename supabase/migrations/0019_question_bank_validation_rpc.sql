-- Independently compare every imported projection with the reviewed JSONL.
-- Activation rejects missing validations and any later changed question row.
create or replace function public.admin_validate_question_bank_batch(p_version text,p_checksum text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  if not exists(select 1 from private.question_bank_imports where version=p_version and canonical_sha256=p_checksum) then raise exception 'BANK_CHECKSUM_MISMATCH'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 250
    or (select count(distinct r->>'id') from jsonb_array_elements(p_rows)r)<>jsonb_array_length(p_rows) then raise exception 'INVALID_BANK_BATCH'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows)r left join public.questions q on q.id=r->>'id'
    where q.id is null or q.source_version<>p_version or
    (q.pool::text,q.topic,q.subtopic,q.difficulty,q.question_ca,q.answer_ca,q.accepted_answers,q.fact_id,
      q.semantic_key,q.variant_no,q.source_key,q.source_url,q.review_status::text,q.active,q.factual_reviewed,q.language_reviewed,q.notes)
    is distinct from (r->>'pool',r->>'topic',r->>'subtopic',(r->>'difficulty')::smallint,r->>'question_ca',
      r->>'answer_ca',r->'accepted_answers',r->>'fact_id',r->>'semantic_key',(r->>'variant_no')::integer,
      r->>'source_key',r->>'source_url',r->>'review_status',(r->>'active')::boolean,
      (r->>'factual_checked')::boolean,(r->>'language_checked')::boolean,coalesce(r->>'review_note','')))
    then raise exception 'BANK_IMPORTED_CONTENT_MISMATCH'; end if;
  insert into private.question_bank_validations as v(version,question_id,row_md5)
    select p_version,q.id,md5(to_jsonb(q)::text) from jsonb_array_elements(p_rows)r join public.questions q on q.id=r->>'id'
    on conflict(version,question_id) do update set row_md5=excluded.row_md5,validated_at=now() where v.row_md5<>excluded.row_md5;
  get diagnostics v_count=row_count;
  return jsonb_build_object('rowsValidated',jsonb_array_length(p_rows),'validationsChanged',v_count);
end; $$;
revoke all on function public.admin_validate_question_bank_batch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_validate_question_bank_batch(text,text,jsonb) to service_role;
