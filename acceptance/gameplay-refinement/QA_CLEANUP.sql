begin;
lock table public.games in share row exclusive mode;
lock table auth.users,auth.sessions,auth.identities,auth.refresh_tokens,public.game_cells,public.game_members,public.game_events,public.game_question_usage,public.match_results,public.authorized_devices,public.couple_admins,private.access_attempts in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_gameplay_qa_cleanup_result;
create temporary table tecla_pau_gameplay_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[] := array['0d7e075e-6f61-46c5-9523-307eef15ab02'::uuid,'14cd1fde-8dde-4a2a-8abf-62bd53064c20'::uuid,'14f340fc-96d2-4152-96e1-0d256440eec9'::uuid,'1664ffdb-fae4-4da2-92ad-3e995a78cdf4'::uuid,'206bff8d-0739-4793-93e4-2345cb63099b'::uuid,'3e05b878-f01f-4b11-b693-eb694bf01c3b'::uuid,'4dc61786-f31a-414a-9afa-b90cb0a4a032'::uuid,'4e969a01-c2b5-4003-8fd0-db34a502be5e'::uuid,'547615ab-7140-4ab3-96d4-d34de4841525'::uuid,'823f09e5-f6c1-4995-9189-ee7f7479f08e'::uuid,'9dbae7d3-4773-4319-b675-b7f04b878036'::uuid,'cb009e8a-d36e-4a4e-950c-300406920e64'::uuid,'cf6a5350-2275-4d7c-8dc2-82af0736d096'::uuid,'cf966057-0661-482f-8382-95639a938b57'::uuid,'efebe68f-e131-4533-bdc9-0804b9f97456'::uuid,'f66f2fd0-9611-4fd3-b289-47adfee59fda'::uuid,'fab3b6a5-9cdf-4b5a-b441-8bb866c71909'::uuid,'fc5dfbfb-4739-4b03-bddc-9553c4045ae8'::uuid]::uuid[];
  v_games uuid[] := array['0752c60c-b3fb-4ce0-b370-402f79e7931c'::uuid,'453d64f8-1f82-4122-8f8f-dec01a41ca14'::uuid,'4edaf423-7ac3-4b68-925a-348e08a37d00'::uuid,'65ba178a-8400-4f29-a471-328197129aed'::uuid,'6db79011-5402-4884-898b-5eea8b75c488'::uuid,'80d3493f-d801-43bc-804d-fc0933273e16'::uuid,'820d917b-2702-4070-be64-ff2026b9af02'::uuid,'8dba7573-a3c0-45fb-a6e9-66aae3a5afd4'::uuid,'95109c8d-32a5-4aac-b545-5da8fed7acdf'::uuid,'a2b41146-80f1-47ae-a4e5-63a760937a35'::uuid,'c45bb89c-c627-4af0-9528-1ddaee2ea320'::uuid,'e6922818-9a2b-46cc-83dc-c53d2bd974c9'::uuid,'f3e640a6-92c7-4f65-89ea-16bbb0d4e837'::uuid]::uuid[];
  v_before_couples jsonb;
  v_before_questions jsonb;
  v_before_hash_config jsonb;
  v_other_users jsonb;
  v_other_games jsonb;
  v_other_results jsonb;
  v_deleted_games integer;
  v_deleted_users integer;
  v_deleted_results integer;
  v_remaining_users integer;
  v_remaining_games integer;
  v_remaining_devices integer;
  v_score jsonb;
  v_entity record;
  v_snapshot jsonb;
  v_snapshots jsonb := '{}';
  v_matrix jsonb := '{}';
  v_scope_ids uuid[];
begin
  if exists(select 1 from auth.users where id=any(v_users) and is_anonymous is distinct from true)
    or exists(select 1 from public.couple_admins where user_id=any(v_users)) then
    raise exception 'QA_CLEANUP_BLOCKED_NON_ANONYMOUS_OR_ADMIN_USER';
  end if;
  if exists(select 1 from public.games where created_by = any(v_users) and not(id = any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_GAMES';
  end if;
  if exists(select 1 from public.game_members where user_id = any(v_users) and not(game_id = any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_MEMBERSHIPS';
  end if;
  if exists(select 1 from public.games where id = any(v_games) and not(created_by = any(v_users)))
    or exists(select 1 from public.game_members where game_id = any(v_games) and not(user_id = any(v_users))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_OWNER_OR_MEMBER';
  end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]') into v_before_couples from public.couples c;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') into v_before_questions from public.questions q;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id), '[]') into v_before_hash_config from private.couple_access_config h;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]') into v_other_users from auth.users u where not(id = any(v_users));
  select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]') into v_other_games from public.games g where not(id = any(v_games));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') into v_other_results from public.match_results r where not(game_id = any(v_games));
  for v_entity in select * from (values
    ('public.game_cells','game_id','games'),('public.game_members','game_id','games'),
    ('public.game_events','game_id','games'),('public.game_question_usage','game_id','games'),
    ('public.authorized_devices','user_id','users'),('auth.sessions','user_id','users'),
    ('auth.identities','user_id','users'),('auth.refresh_tokens','user_id','users'),
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users')
  ) as entities(table_name,key_name,scope_name) loop
    v_scope_ids := case when v_entity.scope_name='games' then v_games else v_users end;
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %s t where %s is null or not(%s::text=any($1::text[]))',v_entity.table_name,v_entity.key_name,v_entity.key_name)
      into v_snapshot using v_scope_ids;
    v_snapshots := v_snapshots || jsonb_build_object(v_entity.table_name,v_snapshot);
  end loop;
  select count(*) into v_deleted_results from public.match_results where game_id = any(v_games);
  delete from public.games where id = any(v_games);
  get diagnostics v_deleted_games = row_count;
  delete from auth.refresh_tokens where user_id=any(v_users::text[]);
  delete from auth.users where id = any(v_users);
  get diagnostics v_deleted_users = row_count;
  select count(*) into v_remaining_users from auth.users where id = any(v_users);
  select count(*) into v_remaining_games from public.games where id = any(v_games);
  select count(*) into v_remaining_devices from public.authorized_devices where user_id = any(v_users);
  if v_remaining_users <> 0 or v_remaining_games <> 0 or v_remaining_devices <> 0 then raise exception 'QA_CLEANUP_INCOMPLETE'; end if;
  if v_other_users is distinct from (select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]') from auth.users u)
    or v_other_games is distinct from (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]') from public.games g)
    or v_other_results is distinct from (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') from public.match_results r) then
    raise exception 'QA_CLEANUP_MODIFIED_UNLISTED_RECORDS';
  end if;
  if v_before_couples is distinct from (select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]') from public.couples c)
    or v_before_questions is distinct from (select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') from public.questions q)
    or v_before_hash_config is distinct from (select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id), '[]') from private.couple_access_config h) then
    raise exception 'QA_CLEANUP_MODIFIED_PRODUCTION_FOUNDATIONS';
  end if;
  for v_entity in select * from (values
    ('public.game_cells','game_id','games'),('public.game_members','game_id','games'),
    ('public.game_events','game_id','games'),('public.game_question_usage','game_id','games'),
    ('public.authorized_devices','user_id','users'),('auth.sessions','user_id','users'),
    ('auth.identities','user_id','users'),('auth.refresh_tokens','user_id','users'),
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users')
  ) as entities(table_name,key_name,scope_name) loop
    v_scope_ids := case when v_entity.scope_name='games' then v_games else v_users end;
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %s t',v_entity.table_name)
      into v_snapshot;
    if v_snapshot is distinct from v_snapshots->v_entity.table_name then raise exception 'QA_CLEANUP_MODIFIED_UNLISTED_RELATED_ROWS'; end if;
    v_matrix := v_matrix || jsonb_build_object(v_entity.table_name,jsonb_build_object('status','PASS','preservedRows',jsonb_array_length(v_snapshot),'remainingQaRows',0));
  end loop;
  select jsonb_build_object('pauWins', count(*) filter(where winner = 'PAU'), 'teclaWins', count(*) filter(where winner = 'TECLA'), 'completedGames', count(*))
    into v_score from public.match_results where couple_id = (select id from public.couples where slug = 'pau-tecla');
  insert into tecla_pau_gameplay_qa_cleanup_result values(jsonb_build_object(
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'gameplay-refinement', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
    'requestedUsers', cardinality(v_users), 'requestedGames', cardinality(v_games),
    'deletedUsers', v_deleted_users, 'deletedGames', v_deleted_games, 'deletedMatchResults', v_deleted_results,
    'remainingQaUsers', v_remaining_users, 'remainingQaGames', v_remaining_games, 'remainingQaAuthorizedDevices', v_remaining_devices,
    'preservedOtherUsers', jsonb_array_length(v_other_users), 'preservedOtherGames', jsonb_array_length(v_other_games),
    'preservedOtherMatchResults', jsonb_array_length(v_other_results),
    'couplePreserved', true, 'questionsPreserved', true, 'accessHashPreserved', true, 'unlistedRowsUnchanged', true, 'relatedTableVerification',v_matrix,
    'scoreboard', v_score, 'questionCount', (select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_gameplay_qa_cleanup_result;
