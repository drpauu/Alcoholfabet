-- EXPLAIN the actual candidate query with a real game and all hard filters.
-- Supply QA_GAME_ID as a literal before executing via the connected MCP.
explain(analyze,buffers,format json)
with context as materialized (
 select g.id,g.couple_id,(select version from private.question_bank_imports where status='ACTIVE') version,
  (select q.normalized_answer from public.game_question_usage u join public.questions q on q.id=u.question_id
    where u.game_id=g.id order by u.turn_number desc,u.used_at desc,u.id desc limit 1) previous_answer,
  (select case when count(*)=2 and min(subtopic)=max(subtopic) then min(subtopic) end from (
    select q.subtopic from public.game_question_usage u join public.questions q on q.id=u.question_id
    where u.game_id=g.id order by u.turn_number desc,u.used_at desc,u.id desc limit 2)s) blocked_subtopic
 from public.games g where g.id='QA_GAME_ID'::uuid
),current_usage as materialized (
 select u.question_id,u.fact_id,u.semantic_key,q.semantic_key resolved_key
 from public.game_question_usage u join public.questions q on q.id=u.question_id
 where u.game_id='QA_GAME_ID'::uuid
),recent_games as materialized (
 select g.id,row_number()over(order by g.last_action_at desc,g.id desc)::integer recent_rank
 from public.games g,context c where g.couple_id=c.couple_id and g.id<>c.id
  and exists(select 1 from public.game_question_usage u where u.game_id=g.id)
 order by g.last_action_at desc,g.id desc limit 10
),recent_facts as materialized (
 select q.semantic_key,min(r.recent_rank)recent_rank from recent_games r
 join public.game_question_usage u on u.game_id=r.id join public.questions q on q.id=u.question_id group by q.semantic_key
),eligible as materialized (
 select q.semantic_key,coalesce(r.recent_rank,11)recent_rank
 from public.questions q cross join context c left join recent_facts r on r.semantic_key=q.semantic_key
 where q.source_version=c.version and q.pool='PAU' and q.active and q.review_status='APPROVED'
 and q.factual_reviewed and q.language_reviewed
 and (c.previous_answer is null or q.normalized_answer<>c.previous_answer)
 and (c.blocked_subtopic is null or q.subtopic<>c.blocked_subtopic)
 and not exists(select 1 from current_usage u
   where u.question_id=q.id or u.fact_id=q.fact_id or u.semantic_key=q.semantic_key or u.resolved_key=q.semantic_key)
 group by q.semantic_key,r.recent_rank
)
select array_agg(semantic_key order by semantic_key)from eligible where recent_rank=(select max(recent_rank)from eligible);
