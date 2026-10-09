-- Privileged transactional regression. QA codes exist only inside rollback.
create or replace function pg_temp.test_online_identity()
returns jsonb language plpgsql as $$
declare
  v_a uuid:=gen_random_uuid(); v_b uuid:=gen_random_uuid(); v_c uuid:=gen_random_uuid();
  v_result jsonb; v_game jsonb; v_local uuid; v_online uuid; v_i integer;
  v_checks text[]:='{}';
begin
  begin
    insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
      values(v_a,'authenticated','authenticated',true,now(),now()),
        (v_b,'authenticated','authenticated',true,now(),now()),
        (v_c,'authenticated','authenticated',true,now(),now());
    update private.online_player_codes set code_sha256=extensions.digest(
      case player_role when 'PAU' then 'qa-pau-identity' else 'qa-tecla-identity' end,'sha256');
    perform set_config('request.jwt.claim.sub',v_a::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
    if not(public.get_access_context()->>'authorized')::boolean then raise exception 'PUBLIC_MENU_REQUIRES_CODE'; end if;
    v_game:=public.create_game('IN_PERSON',20,'PAU','IN_PERSON_CONTROLLER',gen_random_uuid());
    v_local:=(v_game->'game'->>'id')::uuid;
    begin
      perform public.create_game('ONLINE',20,'PAU','PAU',gen_random_uuid());
      raise exception 'UNIDENTIFIED_CREATOR_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'ONLINE_IDENTITY_REQUIRED' then raise; end if;
    end;
    v_result:=public.identify_online_player('wrong-qa-code');
    if v_result->>'error'<>'INVALID_CODE' or v_result->>'identified'<>'false' then raise exception 'INVALID_CODE_ACCEPTED'; end if;
    v_result:=public.identify_online_player('  QA-PAU-IDENTITY  ');
    if v_result->>'role'<>'PAU' or v_result->>'identified'<>'true' then raise exception 'PAU_CODE_MAPPING_FAILED'; end if;
    if public.get_access_context()->>'onlineRole'<>'PAU' then raise exception 'IDENTITY_NOT_RESTORED'; end if;
    begin
      perform public.create_game('ONLINE',20,'PAU','TECLA',gen_random_uuid());
      raise exception 'FORGED_CREATOR_ROLE_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'ONLINE_ROLE_MISMATCH' then raise; end if;
    end;
    v_game:=public.create_game('ONLINE',20,'PAU','PAU',gen_random_uuid());
    v_online:=(v_game->'game'->>'id')::uuid;
    v_result:=public.identify_online_player('qa-tecla-identity');
    if v_result->>'error'<>'ONLINE_IDENTITY_IN_USE' then raise exception 'ACTIVE_ROLE_SWITCH_ALLOWED'; end if;
    v_checks:=array_append(v_checks,'public-in-person-no-code; verified-pau-role; forged-role-and-active-switch-rejected');

    perform set_config('request.jwt.claim.sub',v_b::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
    begin
      perform public.join_game_by_code(v_game->'game'->>'inviteCode','TECLA',gen_random_uuid());
      raise exception 'UNIDENTIFIED_JOIN_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'ONLINE_IDENTITY_REQUIRED' then raise; end if;
    end;
    v_result:=public.identify_online_player('qa-tecla-identity');
    if v_result->>'role'<>'TECLA' then raise exception 'TECLA_MAPPING_FAILED'; end if;
    begin
      perform public.join_game_by_code(v_game->'game'->>'inviteCode','PAU',gen_random_uuid());
      raise exception 'FORGED_JOIN_ROLE_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'ONLINE_ROLE_MISMATCH' then raise; end if;
    end;
    v_game:=public.join_game_by_code(v_game->'game'->>'inviteCode','TECLA',gen_random_uuid());
    if v_game->'viewer'->>'role'<>'TECLA' then raise exception 'VERIFIED_JOIN_FAILED'; end if;
    v_checks:=array_append(v_checks,'verified-tecla-join; missing-identity-and-forged-role-rejected');

    perform set_config('request.jwt.claim.sub',v_c::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_c,'role','authenticated')::text,true);
    for v_i in 1..10 loop
      v_result:=public.identify_online_player('wrong-qa-code');
      if v_result->>'error'<>'INVALID_CODE' then raise exception 'ATTEMPT_LIMIT_TOO_EARLY'; end if;
    end loop;
    v_result:=public.identify_online_player('qa-pau-identity');
    if v_result->>'error'<>'ACCESS_RATE_LIMITED' then raise exception 'ONLINE_RATE_LIMIT_FAILED'; end if;
    if exists(select 1 from public.match_results where game_id in(v_local,v_online)) then raise exception 'IDENTITY_ADDED_SCORE'; end if;
    v_checks:=array_append(v_checks,'ten-invalid-attempt-limit; no-score-created');

    if has_schema_privilege('authenticated','private','USAGE')
      or has_table_privilege('authenticated','private.online_player_codes','SELECT')
      or has_table_privilege('authenticated','private.online_player_identities','INSERT')
      or has_function_privilege('authenticated','private.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid)','EXECUTE')
      or has_function_privilege('authenticated','private.join_game_by_code(text,public.player_role,uuid)','EXECUTE')
      or has_function_privilege('anon','public.identify_online_player(text)','EXECUTE') then raise exception 'ONLINE_IDENTITY_PRIVILEGE_LEAK'; end if;
    if exists(select 1 from pg_class where relkind='r' and relnamespace='private'::regnamespace
      and relname like 'online_player_%' and not relrowsecurity) then raise exception 'IDENTITY_RLS_DISABLED'; end if;
    v_checks:=array_append(v_checks,'private-codes-identities-attempts; RLS; no-client-bypass-or-anon-RPC');
    raise exception using errcode='ZX013',message='ROLLBACK_IDENTITY_QA';
  exception when sqlstate 'ZX013' then null; end;
  if exists(select 1 from auth.users where id in(v_a,v_b,v_c)) then raise exception 'QA_USERS_REMAIN'; end if;
  if exists(select 1 from public.games where id in(v_local,v_online)) then raise exception 'QA_GAMES_REMAIN'; end if;
  return jsonb_build_object('status','PASS','checks',to_jsonb(v_checks),'fixturesRolledBack',true,'privateCodesRestored',true);
end; $$;
select pg_temp.test_online_identity() as report;
