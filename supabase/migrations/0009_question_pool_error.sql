-- Keep the empty-pool error stable so the UI can explain the exhausted category.
create or replace function public.pick_unused_question(p_game_id uuid,p_pool public.question_pool)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_question_id text;
begin
  select q.id into v_question_id from public.questions q
  where q.pool=p_pool and q.review_status='APPROVED' and q.active
    and q.factual_reviewed and q.language_reviewed
    and not exists(select 1 from public.game_question_usage u where u.game_id=p_game_id and u.question_id=q.id)
  order by random() limit 1;
  if v_question_id is null then raise exception 'QUESTION_POOL_EMPTY'; end if;
  return v_question_id;
end; $$;
revoke all on function public.pick_unused_question(uuid,public.question_pool) from public,anon,authenticated;
