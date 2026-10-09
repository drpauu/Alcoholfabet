begin;
lock table public.games in share row exclusive mode;
lock table auth.users,auth.sessions,auth.identities,auth.refresh_tokens,public.game_cells,public.game_members,public.game_events,public.game_question_usage,public.match_results,public.authorized_devices,public.couple_admins,private.access_attempts,private.online_player_identities,private.online_player_attempts,private.question_bank_imports in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_gameplay_qa_cleanup_result;
create temporary table tecla_pau_gameplay_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[] := array['1924d013-2905-4981-9f35-128db0fd8649'::uuid,'1a00dd3b-4748-4dca-ad7e-8c4e158c9d56'::uuid,'55a982b3-d8da-4330-b28b-cbebf9e724b2'::uuid,'767d8792-5e58-4a7f-b4d5-b71959fc5b55'::uuid,'86d71644-1624-4cfa-b3a9-0078d39905d5'::uuid,'92c85667-2da1-4bd7-b13a-26bfbcdcfc57'::uuid,'b7979dac-e5be-4aac-9835-9d51ee01d59a'::uuid,'ef074503-462b-40ee-80b5-a39bafae499b'::uuid]::uuid[];
  v_games uuid[] := array['4d632ca2-21c9-49a2-95f8-63a59bac584f'::uuid,'68e835b1-5a33-4f36-9cd2-16dee106af8b'::uuid,'a2dac3ec-ac8b-4748-8f98-25877a0a7c75'::uuid,'f8821b24-833d-4348-a000-de5e18e95057'::uuid]::uuid[];
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
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users'),('private.online_player_identities','user_id','users'),('private.online_player_attempts','user_id','users')
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
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users'),('private.online_player_identities','user_id','users'),('private.online_player_attempts','user_id','users')
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
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'question-bank', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
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
