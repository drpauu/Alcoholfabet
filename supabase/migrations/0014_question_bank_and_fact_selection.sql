-- Keep the existing text IDs, enums, answers and historical results intact.
-- Import helpers are administrative only; game clients keep using safe RPCs.
create or replace function private.normalized_question_answer(p_text text)
returns text language sql immutable strict set search_path=pg_catalog as $$
  select regexp_replace(lower(translate(trim(p_text),'àáâäèéêëìíîïòóôöùúûüç','aaaaeeeeiiiioooouuuuc')), '\s+', ' ', 'g');
$$;
revoke all on function private.normalized_question_answer(text) from public,anon,authenticated;

alter table public.questions drop constraint if exists questions_difficulty_check;
alter table public.questions add constraint questions_difficulty_check check(difficulty between 1 and 7);
alter table public.questions
  add column if not exists external_id text,
  add column if not exists subtopic text,
  add column if not exists accepted_answers jsonb not null default '[]',
  add column if not exists answer_word_count smallint generated always as (cardinality(regexp_split_to_array(trim(answer_ca), E'\\s+'))) stored,
  add column if not exists fact_id text,
  add column if not exists semantic_key text,
  add column if not exists variant_no integer not null default 1,
  add column if not exists source_key text,
  add column if not exists source_url text,
  add column if not exists source_version text not null default 'legacy-130',
  add column if not exists normalized_answer text;
update public.questions set external_id=id,subtopic=topic,accepted_answers=jsonb_build_array(answer_ca),
  fact_id='legacy:'||id,semantic_key='legacy:'||id,source_key=source_type,
  normalized_answer=private.normalized_question_answer(answer_ca)
where external_id is null;
alter table public.questions alter column external_id set not null;
alter table public.questions alter column subtopic set not null;
alter table public.questions alter column fact_id set not null;
alter table public.questions alter column semantic_key set not null;
alter table public.questions alter column normalized_answer set not null;
alter table public.questions add constraint questions_variant_positive check(variant_no>=1);
alter table public.questions add constraint questions_accepted_array check(jsonb_typeof(accepted_answers)='array');
create unique index if not exists questions_external_id_uidx on public.questions(external_id);
create index if not exists questions_pool_active_review_idx on public.questions(pool,active,review_status,source_version);
create index if not exists questions_fact_id_idx on public.questions(fact_id);
create index if not exists questions_semantic_key_idx on public.questions(semantic_key);
create index if not exists questions_topic_difficulty_idx on public.questions(topic,difficulty);

create or replace function private.complete_question_metadata()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  new.external_id:=coalesce(new.external_id,new.id);
  new.subtopic:=coalesce(new.subtopic,new.topic);
  new.fact_id:=coalesce(new.fact_id,'legacy:'||new.id);
  new.semantic_key:=coalesce(new.semantic_key,new.fact_id);
  new.source_key:=coalesce(new.source_key,new.source_type);
  new.normalized_answer:=private.normalized_question_answer(new.answer_ca);
  if new.accepted_answers='[]' then new.accepted_answers:=jsonb_build_array(new.answer_ca); end if;
  return new;
end; $$;
create trigger questions_complete_metadata before insert or update on public.questions
  for each row execute function private.complete_question_metadata();
revoke all on function private.complete_question_metadata() from public,anon,authenticated;

alter table public.game_question_usage
  add column if not exists fact_id text,
  add column if not exists semantic_key text,
  add column if not exists pool public.question_pool;
update public.game_question_usage u set fact_id=q.fact_id,semantic_key=q.semantic_key,pool=q.pool
  from public.questions q where q.id=u.question_id and u.fact_id is null;
alter table public.game_question_usage alter column fact_id set not null;
alter table public.game_question_usage alter column semantic_key set not null;
alter table public.game_question_usage alter column pool set not null;
create unique index if not exists game_question_usage_game_fact_uidx on public.game_question_usage(game_id,fact_id);
create unique index if not exists game_question_usage_game_semantic_uidx on public.game_question_usage(game_id,semantic_key);
create index if not exists game_question_usage_recent_fact_idx on public.game_question_usage(game_id,semantic_key,used_at desc);
create index if not exists game_question_usage_turn_idx on public.game_question_usage(game_id,turn_number desc,used_at desc,id desc);
create index if not exists games_recent_question_history_idx on public.games(couple_id,last_action_at desc,id);

create or replace function private.snapshot_question_usage()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  select q.fact_id,q.semantic_key,q.pool into new.fact_id,new.semantic_key,new.pool
    from public.questions q where q.id=new.question_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  return new;
end; $$;
create trigger game_question_usage_snapshot before insert on public.game_question_usage
  for each row execute function private.snapshot_question_usage();
revoke all on function private.snapshot_question_usage() from public,anon,authenticated;

create table private.question_bank_imports(
  version text primary key,
  canonical_sha256 text not null check(canonical_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'IMPORTING' check(status in ('IMPORTING','ACTIVE','SUPERSEDED')),
  expected_rows integer not null default 5000 check(expected_rows=5000),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  batches_applied integer not null default 0,
  imported_rows integer,
  approved_rows integer,
  draft_rows integer,
  summary jsonb not null default '{}'
);
create unique index question_bank_one_active on private.question_bank_imports((true)) where status='ACTIVE';
alter table private.question_bank_imports enable row level security;
revoke all on private.question_bank_imports from public,anon,authenticated;
alter table public.questions enable row level security;
alter table public.game_question_usage enable row level security;
-- Questions deliberately have no client SELECT policy. Usage stores no answers.

create or replace function public.admin_upsert_question_bank_batch(p_version text,p_checksum text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer; v_checksum text;
begin
  if p_version is null or length(p_version) not between 3 and 100 or p_version='legacy-130' then raise exception 'INVALID_BANK_VERSION'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 250 then raise exception 'INVALID_BANK_BATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  insert into private.question_bank_imports(version,canonical_sha256) values(p_version,p_checksum) on conflict(version) do nothing;
  select canonical_sha256 into v_checksum from private.question_bank_imports where version=p_version;
  if v_checksum is distinct from p_checksum then raise exception 'BANK_CHECKSUM_MISMATCH'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where r->>'id' !~ '^(PAU|TECLA|TECLA_PAU|PAU_TECLA|TP)-[0-9]{4}$'
    or r->>'fact_id' is null or length(r->>'subtopic')=0 or (r->>'review_status') not in ('APPROVED','DRAFT')
    or (r->>'active')::boolean is distinct from (r->>'review_status'='APPROVED')) then raise exception 'INVALID_BANK_ROW'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r join public.questions q on q.id=r->>'id'
    where q.source_version<>p_version) then raise exception 'BANK_ID_COLLISION'; end if;
  insert into public.questions as q(id,external_id,pool,topic,subtopic,difficulty,question_ca,answer_ca,
    accepted_answers,fact_id,semantic_key,variant_no,source_key,source_url,review_status,active,
    factual_reviewed,language_reviewed,source_type,notes,source_version,approved_at)
  select r->>'id',r->>'id',(r->>'pool')::public.question_pool,r->>'topic',r->>'subtopic',
    (r->>'difficulty')::smallint,r->>'question_ca',r->>'answer_ca',r->'accepted_answers',r->>'fact_id',
    coalesce(r->>'semantic_key',r->>'fact_id'),(r->>'variant_no')::integer,r->>'source_key',r->>'source_url',
    (r->>'review_status')::public.review_status,(r->>'active')::boolean,
    (r->>'factual_checked')::boolean,(r->>'language_checked')::boolean,r->>'source_key',
    coalesce(r->>'review_note',''),p_version,case when r->>'review_status'='APPROVED' then now() end
  from jsonb_array_elements(p_rows) r
  on conflict(id) do update set pool=excluded.pool,topic=excluded.topic,subtopic=excluded.subtopic,
    difficulty=excluded.difficulty,question_ca=excluded.question_ca,answer_ca=excluded.answer_ca,
    accepted_answers=excluded.accepted_answers,fact_id=excluded.fact_id,semantic_key=excluded.semantic_key,
    variant_no=excluded.variant_no,source_key=excluded.source_key,source_url=excluded.source_url,
    review_status=excluded.review_status,active=excluded.active,factual_reviewed=excluded.factual_reviewed,
    language_reviewed=excluded.language_reviewed,notes=excluded.notes
  where (q.pool,q.topic,q.subtopic,q.difficulty,q.question_ca,q.answer_ca,q.accepted_answers,q.fact_id,
    q.semantic_key,q.variant_no,q.source_key,q.source_url,q.review_status,q.active,q.factual_reviewed,q.language_reviewed,q.notes)
    is distinct from (excluded.pool,excluded.topic,excluded.subtopic,excluded.difficulty,excluded.question_ca,
    excluded.answer_ca,excluded.accepted_answers,excluded.fact_id,excluded.semantic_key,excluded.variant_no,
    excluded.source_key,excluded.source_url,excluded.review_status,excluded.active,excluded.factual_reviewed,excluded.language_reviewed,excluded.notes);
  get diagnostics v_count=row_count;
  update private.question_bank_imports set batches_applied=batches_applied+1,updated_at=now() where version=p_version;
  return jsonb_build_object('rowsReceived',jsonb_array_length(p_rows),'rowsChanged',v_count);
end; $$;
revoke all on function public.admin_upsert_question_bank_batch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_upsert_question_bank_batch(text,text,jsonb) to service_role;

create or replace function public.admin_finalize_question_bank(p_version text,p_checksum text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_summary jsonb; v_total integer; v_approved integer; v_draft integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  if not exists(select 1 from private.question_bank_imports where version=p_version and canonical_sha256=p_checksum) then raise exception 'BANK_CHECKSUM_MISMATCH'; end if;
  select count(*),count(*) filter(where review_status='APPROVED' and active),count(*) filter(where review_status='DRAFT' and not active)
    into v_total,v_approved,v_draft from public.questions where source_version=p_version;
  if v_total<>5000 or v_approved+v_draft<>5000 then raise exception 'BANK_COUNT_MISMATCH'; end if;
  if exists(select 1 from (values('PAU'::public.question_pool,1300),('TECLA',1300),('TECLA_PAU',750),('PAU_TECLA',750),('TP',900)) e(pool,n)
    where (select count(*) from public.questions q where q.source_version=p_version and q.pool=e.pool)<>e.n
    or not exists(select 1 from public.questions q where q.source_version=p_version and q.pool=e.pool and q.active and q.review_status='APPROVED')) then raise exception 'BANK_POOL_COUNT_MISMATCH'; end if;
  select jsonb_object_agg(pool,n) into v_summary from (select pool,count(*) n from public.questions where source_version=p_version group by pool) c;
  update private.question_bank_imports set status='SUPERSEDED' where status='ACTIVE' and version<>p_version;
  update private.question_bank_imports set status='ACTIVE',activated_at=coalesce(activated_at,now()),updated_at=now(),
    imported_rows=v_total,approved_rows=v_approved,draft_rows=v_draft,summary=v_summary where version=p_version;
  return jsonb_build_object('version',p_version,'imported',v_total,'approved',v_approved,'draft',v_draft,'pools',v_summary);
end; $$;
revoke all on function public.admin_finalize_question_bank(text,text) from public,anon,authenticated;
grant execute on function public.admin_finalize_question_bank(text,text) to service_role;

create or replace function public.pick_unused_question(p_game_id uuid,p_pool public.question_pool)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
  v_couple uuid; v_version text; v_window integer;
  v_previous_answer text; v_subtopics text[]; v_blocked_subtopic text;
  v_candidates text[]; v_fact text; v_id text; v_variant_count integer;
begin
  -- The engine already holds this lock; it also protects administrative tests.
  select couple_id into v_couple from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  select version into v_version from private.question_bank_imports where status='ACTIVE';
  v_version:=coalesce(v_version,'legacy-130');
  v_window:=case when p_pool in ('TECLA_PAU','PAU_TECLA') then 5 else 10 end;
  select q.normalized_answer into v_previous_answer from public.game_question_usage u join public.questions q on q.id=u.question_id
    where u.game_id=p_game_id order by u.turn_number desc,u.used_at desc,u.id desc limit 1;
  select array_agg(subtopic) into v_subtopics from (
    select q.subtopic from public.game_question_usage u join public.questions q on q.id=u.question_id
    where u.game_id=p_game_id order by u.turn_number desc,u.used_at desc,u.id desc limit 2) s;
  if cardinality(v_subtopics)=2 and v_subtopics[1]=v_subtopics[2] then v_blocked_subtopic:=v_subtopics[1]; end if;
  with recent_games as materialized (
    select g.id,row_number() over(order by g.last_action_at desc,g.id desc)::integer recent_rank
    from public.games g where g.couple_id=v_couple and g.id<>p_game_id
    and exists(select 1 from public.game_question_usage u where u.game_id=g.id)
    order by g.last_action_at desc,g.id desc limit v_window
  ), recent_facts as materialized (
    select u.semantic_key,min(r.recent_rank) recent_rank from recent_games r
    join public.game_question_usage u on u.game_id=r.id group by u.semantic_key
  ), eligible as materialized (
    select q.semantic_key,coalesce(r.recent_rank,v_window+1) recent_rank
    from public.questions q left join recent_facts r on r.semantic_key=q.semantic_key
    where q.source_version=v_version and q.pool=p_pool and q.active and q.review_status='APPROVED'
      and q.factual_reviewed and q.language_reviewed
      and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
      and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic)
      and not exists(select 1 from public.game_question_usage u where u.game_id=p_game_id
        and (u.question_id=q.id or u.fact_id=q.fact_id or u.semantic_key=q.semantic_key))
    group by q.semantic_key,r.recent_rank
  )
  select array_agg(semantic_key order by semantic_key) into v_candidates from eligible
    where recent_rank=(select max(recent_rank) from eligible);
  -- Fresh facts rank above all recent facts. Only when none remain do we
  -- relax recent history, taking the oldest last occurrence first. Match,
  -- answer and subtopic exclusions are NEVER relaxed, including exhaustion.
  if coalesce(cardinality(v_candidates),0)=0 then raise exception 'QUESTION_POOL_EMPTY'; end if;
  v_fact:=v_candidates[1+floor(random()*cardinality(v_candidates))::integer];
  select count(*) into v_variant_count from public.questions q where q.semantic_key=v_fact
    and q.pool=p_pool and q.source_version=v_version and q.active and q.review_status='APPROVED'
    and q.factual_reviewed and q.language_reviewed
    and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
    and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic);
  select q.id into v_id from public.questions q where q.semantic_key=v_fact
    and q.pool=p_pool and q.source_version=v_version and q.active and q.review_status='APPROVED'
    and q.factual_reviewed and q.language_reviewed
    and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
    and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic)
    order by q.id offset floor(random()*v_variant_count)::integer limit 1;
  if v_id is null then raise exception 'QUESTION_POOL_EMPTY'; end if;
  return v_id;
end; $$;
revoke all on function public.pick_unused_question(uuid,public.question_pool) from public,anon,authenticated;
