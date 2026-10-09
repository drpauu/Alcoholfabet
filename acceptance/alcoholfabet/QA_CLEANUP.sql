begin;
lock table public.games in share row exclusive mode;
lock table auth.users,auth.sessions,auth.identities,auth.refresh_tokens,public.game_cells,public.game_members,public.game_events,public.game_question_usage,public.match_results,public.authorized_devices,public.couple_admins,private.access_attempts in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_gameplay_qa_cleanup_result;
create temporary table tecla_pau_gameplay_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[] := array['03007d3b-6d29-40b7-9f37-4cdf95de8d91'::uuid,'121dd4b9-a11f-4b80-a757-841eb5a86451'::uuid,'1c434e41-6ac2-41da-8f4f-2e6b9942ec02'::uuid,'39cb3e79-13bd-48b2-8c10-3eba316fe1ec'::uuid,'4babeb0b-8fc8-445f-a99c-f3a394d6c332'::uuid,'75f32b4e-8d1f-4e3c-95c0-3643985a4787'::uuid,'a56f1304-37d2-4cde-a362-c1a632748faf'::uuid,'df980159-e357-47c7-9a14-2edd5d14619a'::uuid,'e1d0bc13-f5be-4e83-9e98-f563aee9a0a5'::uuid]::uuid[];
  v_games uuid[] := array['30030245-e95d-4951-9eb4-a85fa450526c'::uuid,'33186fa7-393a-462d-99a4-637ee05a116a'::uuid,'5ca76025-0714-46c4-9b63-282977db5bc8'::uuid,'73e9e0d1-d50b-45e4-83b4-6d8ece5ebe3a'::uuid,'96ad2f08-2c7b-4e7f-a5e1-6fdb379a4bc5'::uuid,'f6cad8ae-89ca-41d9-96fa-7507c5e44069'::uuid]::uuid[];
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
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'alcoholfabet', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
    'requestedUsers', cardinality(v_users), 'requestedGames', cardinality(v_games),
    'deletedUsers', v_deleted_users, 'deletedGames', v_deleted_games, 'deletedMatchResults', v_deleted_results,
    'remainingQaUsers', v_remaining_users, 'remainingQaGames', v_remaining_games, 'remainingQaAuthorizedDevices', v_remaining_devices,
    'preservedOtherUsers', jsonb_array_length(v_other_users), 'preservedOtherGames', jsonb_array_length(v_other_games),
    'preservedOtherMatchResults', jsonb_array_length(v_other_results),
    'couplePreserved', true, 'questionsPreserved', true, 'accessHashPreserved', true, 'unlistedRowsUnchanged', true, 'relatedTableVerification',v_matrix,
    'legacyScoreboard', v_score, 'publicScoreboard', (select jsonb_build_object('pauWins',count(*) filter(where winner='PAU'),'teclaWins',count(*) filter(where winner='TECLA'),'completedGames',count(*)) from public.match_results where couple_id=(select id from public.couples where slug='alcoholfabet')), 'questionCount', (select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_gameplay_qa_cleanup_result;
