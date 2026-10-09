-- Real public access regression. Explicit fixtures roll back before returning.
create or replace function pg_temp.run_public_access_regression()
returns jsonb language plpgsql as $$
declare
  v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid(); v_outsider uuid:=gen_random_uuid();
  v_public uuid; v_private uuid; v_private_game uuid; v_local uuid; v_online uuid;
  v_view jsonb; v_peer jsonb; v_context jsonb; v_code text;
  v_read boolean[]; v_write boolean[]; v_before jsonb; v_after jsonb;
  v_checks text[]:='{}';
begin
  lock table public.games,public.game_cells,public.game_events,public.game_members,
    public.game_question_usage,public.match_results,public.authorized_devices,auth.users in share mode;
  select jsonb_build_object(
    'games',(select md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) from public.games g),
    'results',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.match_results r),
    'users',(select md5(coalesce(string_agg(to_jsonb(u)::text,'' order by u.id),'')) from auth.users u),
    'devices',(select md5(coalesce(string_agg(to_jsonb(d)::text,'' order by d.id),'')) from public.authorized_devices d),
    'questions',(select md5(coalesce(string_agg(to_jsonb(q)::text,'' order by q.id),'')) from public.questions q)) into v_before;
  select id into strict v_public from public.couples where slug='alcoholfabet';
  select id into strict v_private from public.couples where slug='pau-tecla';
  select id into v_private_game from public.games where couple_id=v_private limit 1;
  begin
    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claims','{}',true);
    begin
      perform public.get_access_context(); raise exception 'UNAUTHENTICATED_RPC_ALLOWED';
    exception when insufficient_privilege then null; end;
    insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
      values(v_a,'authenticated','authenticated',true,now(),now()),
        (v_b,'authenticated','authenticated',true,now(),now()),
        (v_outsider,'authenticated','authenticated',true,now(),now());
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_context:=public.get_access_context();
    if not(v_context->>'authorized')::boolean or (v_context->>'coupleId')::uuid<>v_public
      or public.is_authorized_for_couple(v_private) then raise exception 'PUBLIC_ACCESS_LEAKS_PRIVATE_COUPLE'; end if;
    if exists(select 1 from public.authorized_devices where user_id=v_a) then raise exception 'CODE_OR_DEVICE_REQUIRED'; end if;
    v_view:=public.create_game('IN_PERSON',20,'PAU','IN_PERSON_CONTROLLER',gen_random_uuid());
    v_local:=(v_view->'game'->>'id')::uuid;
    if (v_view->'game'->>'coupleId')::uuid<>v_public then raise exception 'NEW_GAME_NOT_PUBLIC'; end if;
    insert into private.online_player_identities(user_id,player_role) values(v_a,'PAU'),(v_b,'TECLA');
    v_view:=public.create_game('ONLINE',20,'PAU','PAU',gen_random_uuid());
    v_online:=(v_view->'game'->>'id')::uuid; v_code:=v_view->'game'->>'inviteCode';
    v_checks:=array_append(v_checks,'anonymous-entry-and-in-person-create-without-code; online-roles-verified');

    perform set_config('request.jwt.claim.sub',v_outsider::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_outsider,'role','authenticated')::text,true);
    v_context:=public.get_access_context();
    if v_context ? 'activeGameId' or public.is_member_of_game(v_online) then raise exception 'OTHER_GAME_EXPOSED'; end if;
    begin
      perform public.get_game_view(v_online); raise exception 'OUTSIDER_READ_ALLOWED';
    exception when insufficient_privilege then null; end;
    begin
      perform public.apply_game_action(v_local,'ABANDON_GAME',0,gen_random_uuid(),'{}');
      raise exception 'OUTSIDER_ACTION_ALLOWED';
    exception when insufficient_privilege then null; end;
    if v_private_game is not null then
      begin
        perform public.get_game_view(v_private_game); raise exception 'LEGACY_PRIVATE_GAME_EXPOSED';
      exception when insufficient_privilege then null; end;
    end if;
    select read_allowed,write_allowed into v_read,v_write from realtime.authorize('authenticated','game:'||v_online::text,
      jsonb_build_object('sub',v_outsider,'role','authenticated')::text,v_outsider::text,'{}',array['broadcast','presence'],array['broadcast','presence']);
    if v_read<>array[false,false] or v_write<>array[false,false] then raise exception 'OUTSIDER_REALTIME_ALLOWED'; end if;
    v_checks:=array_append(v_checks,'outsider-cannot-resume-read-act-or-subscribe-to-other-or-legacy-game');

    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    v_peer:=public.join_game_by_code(v_code,'TECLA',gen_random_uuid());
    if v_peer->'viewer'->>'role'<>'TECLA' then raise exception 'PUBLIC_JOIN_FAILED'; end if;
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    v_view:=public.start_game(v_online,(v_peer->'game'->>'stateVersion')::bigint,gen_random_uuid());
    v_view:=public.apply_game_action(v_online,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
    if v_view->'question' ? 'answerCa' or (v_view->'capabilities'->>'canSeeAnswer')::boolean then raise exception 'RESPONDENT_ANSWER_EXPOSED'; end if;
    select read_allowed,write_allowed into v_read,v_write from realtime.authorize('authenticated','game:'||v_online::text,
      jsonb_build_object('sub',v_a,'role','authenticated')::text,v_a::text,'{}',array['broadcast','presence'],array['broadcast','presence']);
    if v_read<>array[true,true] or v_write<>array[false,true] then raise exception 'MEMBER_REALTIME_ACL_FAILED'; end if;
    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    v_peer:=public.get_game_view(v_online);
    if not(v_peer->'question' ? 'answerCa') or not(v_peer->'capabilities'->>'canJudge')::boolean then raise exception 'JUDGE_ANSWER_NOT_VISIBLE'; end if;
    v_peer:=public.apply_game_action(v_online,'JUDGE_INCORRECT',(v_peer->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
    if v_peer->'lastEvent'->'payload'->>'respondingPlayer'<>'PAU'
      or (v_peer->'lastEvent'->'payload'->>'drinkCount')::integer<>1 then raise exception 'DRINK_RECIPIENT_CHANGED'; end if;
    v_peer:=public.apply_game_action(v_online,'ABANDON_GAME',(v_peer->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
    if v_peer->'game'->>'status'<>'ABANDONED' or exists(select 1 from public.match_results where game_id in(v_online,v_local)) then raise exception 'ABANDON_ADDED_POINTS'; end if;
    v_checks:=array_append(v_checks,'public-online-join-private-answer-and-member-only-realtime');

    if has_table_privilege('authenticated','public.questions','SELECT')
      or has_table_privilege('authenticated','public.games','UPDATE')
      or has_table_privilege('authenticated','public.match_results','INSERT')
      or has_function_privilege('authenticated','public.generate_game_board(uuid,integer)','EXECUTE')
      or has_function_privilege('anon','public.get_access_context()','EXECUTE') then raise exception 'DIRECT_CLIENT_PRIVILEGE_LEAK'; end if;
    if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname in('games','questions','match_results','game_members','game_events') and not relrowsecurity) then raise exception 'RLS_DISABLED'; end if;
    v_checks:=array_append(v_checks,'rls-and-server-only-write-privileges-preserved');
    raise exception using errcode='ZX002',message='ROLLBACK_PUBLIC_ACCESS_QA';
  exception when sqlstate 'ZX002' then null; end;
  select jsonb_build_object(
    'games',(select md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) from public.games g),
    'results',(select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.match_results r),
    'users',(select md5(coalesce(string_agg(to_jsonb(u)::text,'' order by u.id),'')) from auth.users u),
    'devices',(select md5(coalesce(string_agg(to_jsonb(d)::text,'' order by d.id),'')) from public.authorized_devices d),
    'questions',(select md5(coalesce(string_agg(to_jsonb(q)::text,'' order by q.id),'')) from public.questions q)) into v_after;
  if v_before is distinct from v_after then raise exception 'PUBLIC_QA_CHANGED_EXISTING_ROWS'; end if;
  if exists(select 1 from auth.users where id in(v_a,v_b,v_outsider)) or exists(select 1 from public.games where id in(v_local,v_online)) then raise exception 'PUBLIC_QA_FIXTURES_REMAIN'; end if;
  return jsonb_build_object('status','PASS','checks',to_jsonb(v_checks),'fixturesRolledBack',true,
    'existingRowsUnchanged',true,'authSessionsCreated',0,'remainingQaUsers',0,'remainingQaGames',0,'noSecrets',true);
end; $$;
select pg_temp.run_public_access_regression() as report;
