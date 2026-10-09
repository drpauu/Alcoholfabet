begin;
lock table public.games in share row exclusive mode;
lock table auth.users in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_art_qa_cleanup_result;
create temporary table tecla_pau_art_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[] := array['011d5426-155e-4bc4-8b42-86f126405d85'::uuid,'2220493b-9352-49fa-b45e-c04c3c764e36'::uuid,'22c87523-a2ab-41ce-aaa7-2518100b9874'::uuid,'40bf9979-2ef9-46cb-8153-abd5cce4f61c'::uuid,'455e36cf-ff68-40bf-a682-f498135b3ee4'::uuid,'5079269b-210c-4835-b1bb-036ea4e2b9fb'::uuid,'55c7c377-de13-440f-a22c-613fdf7f988b'::uuid,'5be89729-f7b5-410d-9c19-b7644c9123d0'::uuid,'5d04a70a-0598-4e5d-aa98-bc88eac3490a'::uuid,'67c0751e-d784-48e6-8e32-acdde7853966'::uuid,'71e8adb1-4784-45f6-b7a4-facc7c4b6fd9'::uuid,'98b47228-b1c7-4766-837d-e01c18409dbd'::uuid,'a0d6714b-e25f-4309-9f65-37606835ca99'::uuid,'dc8ee7f8-6c9a-4f2f-8c10-8b6636838b73'::uuid,'f5928e07-a9db-4a72-8b69-b681b2500adb'::uuid,'fbc46652-9a8a-4d2c-b10b-bce54871200e'::uuid,'fd89b2a2-a583-42e5-b65d-9542d96c9e4a'::uuid]::uuid[];
  v_games uuid[] := array['092fee56-68ba-4faa-862c-32cd66a24857'::uuid,'2ad751d4-5421-40fb-b4fe-a54376ebe366'::uuid,'4bfc3f80-5e17-4bc1-9dff-979a3806c494'::uuid,'5763c26a-946e-4179-bc38-ad673003465f'::uuid,'5830370c-781f-40a1-a60f-adb27c56ddb0'::uuid,'5c2b4d78-aa6e-4d53-aab3-8376a43ac0ec'::uuid,'6240c19b-b161-42c5-b7cd-cfbc667b2b1f'::uuid,'6a844947-e45a-42f6-87bc-a5a3a8eb4932'::uuid,'8d4ea4ac-e4a3-4604-b753-1c2306bdc186'::uuid,'8dfff372-38ce-4e3e-a3c8-7f4ffb4ad9fe'::uuid,'96b4d98d-da0a-419d-aae4-8379f86ce727'::uuid,'9cdcd317-802b-4d37-84de-909cc66f170c'::uuid,'9d7a4277-06a2-4848-aec2-3e18930ebdd9'::uuid,'a30bd2a3-509d-4aa9-b14a-0e0d84f091fd'::uuid,'a4b684a8-f33b-48c4-83b8-33fc4e0a4927'::uuid,'abb860d4-9bf9-4be0-9e4b-3350290c2aad'::uuid,'b427d61d-b26f-4d67-b25b-346f801cad7f'::uuid,'c955a401-8172-4fce-b7df-000efd8ca641'::uuid,'ce1f8262-2ce2-46f2-a6ab-79b959b2af76'::uuid,'d8db7fa2-ccb8-417f-9f2d-da74f2ea9cb9'::uuid,'db5029b7-8913-4b39-886e-7a02da906c4d'::uuid,'f579a949-2ed8-451c-a10c-7d4747f8e3df'::uuid]::uuid[];
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
begin
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
  select count(*) into v_deleted_results from public.match_results where game_id = any(v_games);
  delete from public.games where id = any(v_games);
  get diagnostics v_deleted_games = row_count;
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
  select jsonb_build_object('pauWins', count(*) filter(where winner = 'PAU'), 'teclaWins', count(*) filter(where winner = 'TECLA'), 'completedGames', count(*))
    into v_score from public.match_results where couple_id = (select id from public.couples where slug = 'pau-tecla');
  insert into tecla_pau_art_qa_cleanup_result values(jsonb_build_object(
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'art-redesign', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
    'requestedUsers', cardinality(v_users), 'requestedGames', cardinality(v_games),
    'deletedUsers', v_deleted_users, 'deletedGames', v_deleted_games, 'deletedMatchResults', v_deleted_results,
    'remainingQaUsers', v_remaining_users, 'remainingQaGames', v_remaining_games, 'remainingQaAuthorizedDevices', v_remaining_devices,
    'preservedOtherUsers', jsonb_array_length(v_other_users), 'preservedOtherGames', jsonb_array_length(v_other_games),
    'preservedOtherMatchResults', jsonb_array_length(v_other_results),
    'couplePreserved', true, 'questionsPreserved', true, 'accessHashPreserved', true, 'unlistedRowsUnchanged', true,
    'scoreboard', v_score, 'questionCount', (select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_art_qa_cleanup_result;
