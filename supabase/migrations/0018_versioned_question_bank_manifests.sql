-- Additive bank replacement: old rows, usage, results and game state survive.
-- Every game keeps the version available at creation. Public clients cannot
-- import, activate, read answer banks, change version or inspect fact history.
alter table private.question_bank_imports drop constraint question_bank_imports_expected_rows_check;
alter table private.question_bank_imports add constraint question_bank_imports_expected_rows_check check(expected_rows between 5 and 100000);
alter table private.question_bank_imports
  add column expected_pool_counts jsonb not null default '{"PAU":1300,"TECLA":1300,"TECLA_PAU":750,"PAU_TECLA":750,"TP":900}',
  add column reviewed_sha256 text check(reviewed_sha256 ~ '^[a-f0-9]{64}$'),
  add column source_sha256 text check(source_sha256 ~ '^[a-f0-9]{64}$');

-- Fast column default captures the currently published bank for existing rows
-- without an UPDATE, a state-version change, a broadcast or a history rewrite.
do $$ declare v_version text; begin
  select version into v_version from private.question_bank_imports where status='ACTIVE';
  execute format('alter table public.games add column question_bank_version text not null default %L',coalesce(v_version,'legacy-130'));
end $$;
alter table public.games alter column question_bank_version drop default;

create or replace function private.pin_game_question_bank()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- Ignore even an administrative INSERT's supplied version: the authoritative
  -- active manifest, atomically visible, decides new games' bank.
  select version into new.question_bank_version from private.question_bank_imports where status='ACTIVE';
  new.question_bank_version:=coalesce(new.question_bank_version,'legacy-130');
  return new;
end; $$;
revoke all on function private.pin_game_question_bank() from public,anon,authenticated;
create trigger games_pin_question_bank before insert on public.games for each row execute function private.pin_game_question_bank();

-- Cross-version concept links retain the exact historical bank and snapshots.
-- Only administrative import can populate this private, default-deny table.
create table private.question_semantic_aliases(
  question_id text primary key references public.questions(id),
  semantic_key text not null check(length(semantic_key)>0)
);
alter table private.question_semantic_aliases enable row level security;
revoke all on private.question_semantic_aliases from public,anon,authenticated;
create index question_semantic_alias_key_idx on private.question_semantic_aliases(semantic_key);

create table private.question_bank_validations(
  version text not null references private.question_bank_imports(version),
  question_id text not null references public.questions(id),
  row_md5 text not null,
  validated_at timestamptz not null default now(),
  primary key(version,question_id)
);
alter table private.question_bank_validations enable row level security;
revoke all on private.question_bank_validations from public,anon,authenticated;

create or replace function public.admin_prepare_question_bank(
  p_version text,p_checksum text,p_reviewed_checksum text,p_source_checksum text,
  p_expected_rows integer,p_expected_pools jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_existing private.question_bank_imports%rowtype;
begin
  if p_version is null or length(p_version) not between 3 and 100 or p_version='legacy-130'
    or p_checksum is null or p_checksum !~ '^[a-f0-9]{64}$'
    or p_reviewed_checksum is null or p_reviewed_checksum !~ '^[a-f0-9]{64}$'
    or p_source_checksum is null or p_source_checksum !~ '^[a-f0-9]{64}$'
    or p_expected_rows is null or p_expected_rows not between 5 and 100000
    or p_expected_pools is null or jsonb_typeof(p_expected_pools)<>'object' then raise exception 'INVALID_BANK_MANIFEST'; end if;
  if (select count(*) from jsonb_each(p_expected_pools))<>5
    or exists(select 1 from jsonb_each_text(p_expected_pools) e where e.key not in ('PAU','TECLA','TECLA_PAU','PAU_TECLA','TP') or e.value !~ '^[1-9][0-9]*$')
    or (select sum(value::integer) from jsonb_each_text(p_expected_pools))<>p_expected_rows then raise exception 'INVALID_BANK_MANIFEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  select * into v_existing from private.question_bank_imports where version=p_version;
  if found then
    if (v_existing.canonical_sha256,v_existing.reviewed_sha256,v_existing.source_sha256,v_existing.expected_rows,v_existing.expected_pool_counts)
      is distinct from (p_checksum,p_reviewed_checksum,p_source_checksum,p_expected_rows,p_expected_pools) then raise exception 'BANK_MANIFEST_MISMATCH'; end if;
  else
    insert into private.question_bank_imports(version,canonical_sha256,reviewed_sha256,source_sha256,expected_rows,expected_pool_counts)
      values(p_version,p_checksum,p_reviewed_checksum,p_source_checksum,p_expected_rows,p_expected_pools);
  end if;
  return jsonb_build_object('version',p_version,'status',coalesce(v_existing.status,'IMPORTING'),'expected',p_expected_rows,'pools',p_expected_pools);
end; $$;
revoke all on function public.admin_prepare_question_bank(text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.admin_prepare_question_bank(text,text,text,text,integer,jsonb) to service_role;

create or replace function public.admin_finalize_question_bank(p_version text,p_checksum text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_summary jsonb;v_total integer;v_approved integer;v_draft integer;v_manifest private.question_bank_imports%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  select * into v_manifest from private.question_bank_imports where version=p_version and canonical_sha256=p_checksum for update;
  if not found then raise exception 'BANK_CHECKSUM_MISMATCH'; end if;
  select count(*),count(*) filter(where review_status='APPROVED' and active),count(*) filter(where review_status='DRAFT' and not active)
    into v_total,v_approved,v_draft from public.questions where source_version=p_version;
  if v_total<>v_manifest.expected_rows or v_approved+v_draft<>v_total then raise exception 'BANK_COUNT_MISMATCH'; end if;
  if exists(select 1 from jsonb_each_text(v_manifest.expected_pool_counts) e
    where (select count(*) from public.questions q where q.source_version=p_version and q.pool::text=e.key)<>e.value::integer
    or not exists(select 1 from public.questions q where q.source_version=p_version and q.pool::text=e.key and q.active and q.review_status='APPROVED')) then raise exception 'BANK_POOL_COUNT_MISMATCH'; end if;
  if exists(select 1 from public.questions q where q.source_version=p_version and
    (length(trim(q.question_ca))=0 or length(trim(q.answer_ca))=0 or q.answer_word_count not between 1 and 5
     or q.difficulty not between 1 and 7 or length(trim(q.fact_id))=0 or length(trim(q.semantic_key))=0
     or length(trim(q.subtopic))=0 or jsonb_array_length(q.accepted_answers)=0
     or (q.active and (not q.factual_reviewed or not q.language_reviewed)))) then raise exception 'BANK_REVIEW_INCOMPLETE'; end if;
  if v_manifest.reviewed_sha256 is not null and exists(select 1 from public.questions q
    left join private.question_bank_validations v on v.version=p_version and v.question_id=q.id
    where q.source_version=p_version and (v.row_md5 is null or v.row_md5<>md5(to_jsonb(q)::text))) then raise exception 'BANK_NOT_VALIDATED'; end if;
  select jsonb_object_agg(pool,n) into v_summary from (select pool,count(*) n from public.questions where source_version=p_version group by pool)c;
  update private.question_bank_imports set status='SUPERSEDED' where status='ACTIVE' and version<>p_version;
  update private.question_bank_imports set status='ACTIVE',activated_at=coalesce(activated_at,now()),updated_at=now(),
    imported_rows=v_total,approved_rows=v_approved,draft_rows=v_draft,summary=v_summary where version=p_version;
  return jsonb_build_object('version',p_version,'imported',v_total,'approved',v_approved,'draft',v_draft,'pools',v_summary);
end; $$;
revoke all on function public.admin_finalize_question_bank(text,text) from public,anon,authenticated;
grant execute on function public.admin_finalize_question_bank(text,text) to service_role;

create or replace function private.snapshot_question_usage()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  select q.fact_id,coalesce(a.semantic_key,q.semantic_key),q.pool into new.fact_id,new.semantic_key,new.pool
    from public.questions q left join private.question_semantic_aliases a on a.question_id=q.id where q.id=new.question_id;
  if not found then raise exception 'QUESTION_NOT_FOUND'; end if;
  return new;
end; $$;
revoke all on function private.snapshot_question_usage() from public,anon,authenticated;

create or replace function public.admin_upsert_question_bank_batch(p_version text,p_checksum text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_count integer; v_checksum text; v_status text;
begin
  if p_version is null or length(p_version) not between 3 and 100 or p_version='legacy-130' then raise exception 'INVALID_BANK_VERSION'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 250 then raise exception 'INVALID_BANK_BATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended('question-bank-import',0));
  insert into private.question_bank_imports(version,canonical_sha256) values(p_version,p_checksum) on conflict(version) do nothing;
  select canonical_sha256,status into v_checksum,v_status from private.question_bank_imports where version=p_version;
  if v_checksum is distinct from p_checksum then raise exception 'BANK_CHECKSUM_MISMATCH'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where r->>'id' is null or not (r->>'id' ~ ('^'||(r->>'pool')||'-[0-9]{4}$') or r->>'id' ~ ('^NEW26-'||(r->>'pool')||'-[0-9]{3}$'))
    or nullif(trim(r->>'fact_id'),'') is null or nullif(trim(r->>'semantic_key'),'') is null or nullif(trim(r->>'subtopic'),'') is null or (r->>'review_status') not in ('APPROVED','DRAFT')
    or r->>'review_status' is null or (r->>'active')::boolean is distinct from (r->>'review_status'='APPROVED')
    or (r->>'review_status'='APPROVED' and ((r->>'factual_checked')::boolean is distinct from true or (r->>'language_checked')::boolean is distinct from true))) then raise exception 'INVALID_BANK_ROW'; end if;
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
  if v_status<>'IMPORTING' and v_count>0 then raise exception 'BANK_PUBLISHED_IMMUTABLE'; end if;
  update private.question_bank_imports set batches_applied=batches_applied+1,updated_at=now() where version=p_version;
  return jsonb_build_object('rowsReceived',jsonb_array_length(p_rows),'rowsChanged',v_count);
end; $$;
revoke all on function public.admin_upsert_question_bank_batch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_upsert_question_bank_batch(text,text,jsonb) to service_role;


create or replace function public.pick_unused_question(p_game_id uuid,p_pool public.question_pool)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
  v_couple uuid; v_version text; v_window integer;
  v_previous_answer text; v_subtopics text[]; v_blocked_subtopic text;
  v_candidates text[]; v_fact text; v_id text; v_variant_count integer;
begin
  -- The engine already holds this lock; it also protects administrative tests.
  select couple_id,question_bank_version into v_couple,v_version from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  v_version:=coalesce(v_version,'legacy-130');
  v_window:=case when p_pool in ('TECLA_PAU','PAU_TECLA') then 5 else 10 end;
  select q.normalized_answer into v_previous_answer from public.game_question_usage u join public.questions q on q.id=u.question_id left join private.question_semantic_aliases a on a.question_id=q.id
    where u.game_id=p_game_id order by u.turn_number desc,u.used_at desc,u.id desc limit 1;
  select array_agg(subtopic) into v_subtopics from (
    select q.subtopic from public.game_question_usage u join public.questions q on q.id=u.question_id left join private.question_semantic_aliases a on a.question_id=q.id
    where u.game_id=p_game_id order by u.turn_number desc,u.used_at desc,u.id desc limit 2) s;
  if cardinality(v_subtopics)=2 and v_subtopics[1]=v_subtopics[2] then v_blocked_subtopic:=v_subtopics[1]; end if;
  with current_usage as materialized (
    select u.question_id,u.fact_id,u.semantic_key,coalesce(a.semantic_key,q.semantic_key) resolved_key
    from public.game_question_usage u join public.questions q on q.id=u.question_id left join private.question_semantic_aliases a on a.question_id=q.id
    where u.game_id=p_game_id
  ), recent_games as materialized (
    select g.id,row_number() over(order by g.last_action_at desc,g.id desc)::integer recent_rank
    from public.games g where g.couple_id=v_couple and g.id<>p_game_id
    and exists(select 1 from public.game_question_usage u where u.game_id=g.id)
    order by g.last_action_at desc,g.id desc limit v_window
  ), recent_facts as materialized (
    select coalesce(a.semantic_key,q.semantic_key) semantic_key,min(r.recent_rank) recent_rank from recent_games r
    join public.game_question_usage u on u.game_id=r.id
    join public.questions q on q.id=u.question_id left join private.question_semantic_aliases a on a.question_id=q.id group by coalesce(a.semantic_key,q.semantic_key)
  ), eligible as materialized (
    select coalesce(a.semantic_key,q.semantic_key) semantic_key,coalesce(r.recent_rank,v_window+1) recent_rank
    from public.questions q left join private.question_semantic_aliases a on a.question_id=q.id left join recent_facts r on r.semantic_key=coalesce(a.semantic_key,q.semantic_key)
    where q.source_version=v_version and q.pool=p_pool and q.active and q.review_status='APPROVED'
      and q.factual_reviewed and q.language_reviewed
      and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
      and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic)
      and not exists(select 1 from current_usage u
        where u.question_id=q.id or u.fact_id=q.fact_id or u.semantic_key=coalesce(a.semantic_key,q.semantic_key) or u.resolved_key=coalesce(a.semantic_key,q.semantic_key))
    group by coalesce(a.semantic_key,q.semantic_key),r.recent_rank
  )
  select array_agg(semantic_key order by semantic_key) into v_candidates from eligible
    where recent_rank=(select max(recent_rank) from eligible);
  -- Fresh facts rank above all recent facts. Only when none remain do we
  -- relax recent history, taking the oldest last occurrence first. Match,
  -- answer and subtopic exclusions are NEVER relaxed, including exhaustion.
  if coalesce(cardinality(v_candidates),0)=0 then raise exception 'QUESTION_POOL_EMPTY'; end if;
  v_fact:=v_candidates[1+floor(random()*cardinality(v_candidates))::integer];
  select count(*) into v_variant_count from public.questions q left join private.question_semantic_aliases a on a.question_id=q.id where coalesce(a.semantic_key,q.semantic_key)=v_fact
    and q.pool=p_pool and q.source_version=v_version and q.active and q.review_status='APPROVED'
    and q.factual_reviewed and q.language_reviewed
    and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
    and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic);
  select q.id into v_id from public.questions q left join private.question_semantic_aliases a on a.question_id=q.id where coalesce(a.semantic_key,q.semantic_key)=v_fact
    and q.pool=p_pool and q.source_version=v_version and q.active and q.review_status='APPROVED'
    and q.factual_reviewed and q.language_reviewed
    and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
    and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic)
    order by q.id offset floor(random()*v_variant_count)::integer limit 1;
  if v_id is null then raise exception 'QUESTION_POOL_EMPTY'; end if;
  return v_id;
end; $$;
revoke all on function public.pick_unused_question(uuid,public.question_pool) from public,anon,authenticated;
