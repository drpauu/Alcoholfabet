-- Materialize only this match’s usage before the candidate anti-join.
-- This prevents a generic plan from joining the entire global usage table.
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
  with current_usage as materialized (
    select u.question_id,u.fact_id,u.semantic_key,q.semantic_key resolved_key
    from public.game_question_usage u join public.questions q on q.id=u.question_id
    where u.game_id=p_game_id
  ), recent_games as materialized (
    select g.id,row_number() over(order by g.last_action_at desc,g.id desc)::integer recent_rank
    from public.games g where g.couple_id=v_couple and g.id<>p_game_id
    and exists(select 1 from public.game_question_usage u where u.game_id=g.id)
    order by g.last_action_at desc,g.id desc limit v_window
  ), recent_facts as materialized (
    select q.semantic_key,min(r.recent_rank) recent_rank from recent_games r
    join public.game_question_usage u on u.game_id=r.id
    join public.questions q on q.id=u.question_id group by q.semantic_key
  ), eligible as materialized (
    select q.semantic_key,coalesce(r.recent_rank,v_window+1) recent_rank
    from public.questions q left join recent_facts r on r.semantic_key=q.semantic_key
    where q.source_version=v_version and q.pool=p_pool and q.active and q.review_status='APPROVED'
      and q.factual_reviewed and q.language_reviewed
      and (v_previous_answer is null or q.normalized_answer<>v_previous_answer)
      and (v_blocked_subtopic is null or q.subtopic<>v_blocked_subtopic)
      and not exists(select 1 from current_usage u
        where u.question_id=q.id or u.fact_id=q.fact_id or u.semantic_key=q.semantic_key or u.resolved_key=q.semantic_key)
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
