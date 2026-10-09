-- Real PostgreSQL/RPC regression. Every explicit QA fixture is rolled back
-- inside a caught subtransaction; no Auth session or public marker is created.
create or replace function pg_temp.run_duration_regression()
returns jsonb language plpgsql as $$
declare
  v_user uuid := gen_random_uuid();
  v_couple uuid;
  v_game uuid;
  v_games uuid[] := '{}';
  v_minutes integer;
  v_length integer;
  v_view jsonb;
  v_turns integer := 0;
  v_last_key uuid;
  v_legacy_key uuid;
  v_pre_version bigint;
  v_before jsonb;
  v_after jsonb;
  v_checks text[] := '{}';
begin
  -- Short read-only lock also makes preservation checks meaningful while
  -- other real users may be playing. They resume immediately after this query.
  lock table public.games,public.game_cells,public.game_events,public.game_members,
    public.game_question_usage,public.match_results,auth.users in share mode;
  select jsonb_build_object(
    'games',jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),''))))
    into v_before from public.games g;
  v_before := v_before || jsonb_build_object(
    'results',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),''))) from public.match_results r),
    'cells',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.game_id,c.position),''))) from public.game_cells c),
    'users',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(u)::text,'' order by u.id),''))) from auth.users u));
  begin
    insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
      values(v_user,'authenticated','authenticated',true,now(),now());
    select id into v_couple from public.couples where slug='alcoholfabet';
    perform set_config('request.jwt.claim.sub',v_user::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);

    for v_minutes in 10..60 loop
      if public.calculate_finish_position(v_minutes) <> round(v_minutes * 0.84)::integer then
        raise exception 'SQL_DURATION_FORMULA_MISMATCH';
      end if;
    end loop;
    foreach v_minutes in array array[10,20,30,45,60] loop
      v_view := public.create_game('IN_PERSON',v_minutes,'PAU','IN_PERSON_CONTROLLER',gen_random_uuid());
      v_game := (v_view->'game'->>'id')::uuid;
      v_games := array_append(v_games,v_game);
      v_length := (v_view->'game'->>'finishPosition')::integer;
      if v_length <> round(v_minutes * 0.84)::integer or jsonb_array_length(v_view->'board') <> v_length then
        raise exception 'PERSISTED_DURATION_BOARD_MISMATCH';
      end if;
      if exists(select 1 from public.game_cells where game_id=v_game and modifier='PLUS_ONE' and position in(1,v_length-1,v_length))
        or exists(select 1 from public.game_cells a join public.game_cells b on b.game_id=a.game_id and b.position=a.position+1
          where a.game_id=v_game and a.modifier='PLUS_ONE' and b.modifier='PLUS_ONE') then
        raise exception 'BONUS_POSITION_CONSTRAINT_FAILED';
      end if;
      if exists(select 1 from public.game_cells a join public.game_cells b on b.game_id=a.game_id and b.position=a.position+1
          join public.game_cells c on c.game_id=a.game_id and c.position=a.position+2
          where a.game_id=v_game and a.cell_type=b.cell_type and b.cell_type=c.cell_type) then
        raise exception 'CATEGORY_TRIPLE_FAILED';
      end if;
      if exists(select 1 from public.game_cells where game_id=v_game and cell_type <> case((position-1)%5)
        when 0 then 'PERSONAL'::public.cell_type when 1 then 'CROSSED'::public.cell_type when 2 then 'TP'::public.cell_type
        when 3 then 'PERSONAL'::public.cell_type else 'CROSSED'::public.cell_type end) then
        raise exception 'FINITE_POOL_BALANCE_FAILED';
      end if;
      begin
        perform public.generate_game_board(v_game,v_length);
        raise exception 'BOARD_REGENERATED';
      exception when raise_exception then
        if sqlerrm<>'BOARD_ALREADY_GENERATED' then raise; end if;
      end;
    end loop;
    v_checks := array_append(v_checks,'all51-supported-minutes-and5-persisted-presets');
    v_checks := array_append(v_checks,'balanced-pools-plus-one-and-immutable-board');

    foreach v_minutes in array array[9,61,180] loop
      begin
        perform public.create_game('IN_PERSON',v_minutes,'PAU','IN_PERSON_CONTROLLER',gen_random_uuid());
        raise exception 'OUT_OF_RANGE_GAME_CREATED';
      exception when raise_exception then
        if sqlerrm<>'INVALID_GAME_OPTIONS' then raise; end if;
      end;
    end loop;
    if has_function_privilege('authenticated','public.calculate_finish_position(integer)','EXECUTE')
      or has_function_privilege('authenticated','public.generate_game_board(uuid,integer)','EXECUTE') then
      raise exception 'INTERNAL_HELPER_EXPOSED';
    end if;
    if pg_get_constraintdef((select oid from pg_constraint where conrelid='public.games'::regclass and conname='games_target_minutes_check')) not like '%180%' then
      raise exception 'LEGACY_DURATION_CONSTRAINT_CHANGED';
    end if;
    v_checks := array_append(v_checks,'new-game10-to60-validation-private-helpers-legacy-constraint');

    -- Play the 60-minute, 50-cell game through real authoritative intents.
    -- Both players answer correctly, with normal alternation and T&P claims.
    while v_view->'game'->>'status'<>'FINISHED' loop
      v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      if v_view->'game'->>'phase'='TP_OPEN' then
        v_view := public.apply_game_action(v_game,'CLAIM_TP',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),
          jsonb_build_object('claimant',v_view->'game'->>'currentTurn'));
      end if;
      v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      v_pre_version := (v_view->'game'->>'stateVersion')::bigint;
      v_last_key := gen_random_uuid();
      v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_last_key,'{}');
      v_turns := v_turns + 1;
      if v_turns>130 then raise exception 'LONG_GAME_EXCEEDED_QUESTION_BANK'; end if;
      if v_view->'game'->>'status'<>'FINISHED' then
        v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      end if;
    end loop;
    if (v_view->'game'->>'pauPosition')::integer<>50 or v_view->'game'->>'winner'<>'PAU' then
      raise exception 'LONG_GAME_FINISH_FAILED';
    end if;
    perform public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_last_key,'{}');
    if (select count(*) from public.match_results where game_id=v_game)<>1 then raise exception 'FINISH_REPLAY_COUNTED_TWICE'; end if;
    if exists(select 1 from public.game_question_usage where game_id=v_game group by question_id having count(*)>1) then
      raise exception 'QUESTION_REPEATED';
    end if;
    if exists(select 1 from public.game_question_usage u join public.questions q on q.id=u.question_id where u.game_id=v_game
      and (q.review_status<>'APPROVED' or not q.active or not q.factual_reviewed or not q.language_reviewed)) then
      raise exception 'UNAPPROVED_QUESTION_USED';
    end if;
    v_checks := array_append(v_checks,'50-cell-game-to-meta-no-repeat-approved-only-idempotent-result');

    -- Exhaust a pool in a separate QA game, without replacing/repeating it.
    v_game := v_games[1];
    insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)
      select v_game,id,0,'PAU' from public.questions where pool='PAU';
    begin
      perform public.apply_game_action(v_game,'BEGIN_TURN',0,gen_random_uuid(),'{}');
      raise exception 'EXHAUSTED_POOL_REPEATED_A_QUESTION';
    exception when raise_exception then
      if sqlerrm<>'QUESTION_POOL_EMPTY' then raise; end if;
    end;
    if (public.get_game_view(v_game)->'game'->>'stateVersion')::bigint<>0 then raise exception 'POOL_EXHAUSTION_CHANGED_STATE'; end if;
    for v_minutes in 1..4 loop
      v_game:=v_games[v_minutes];
      v_view:=public.get_game_view(v_game);
      v_view:=public.apply_game_action(v_game,'ABANDON_GAME',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      if v_view->'game'->>'status'<>'ABANDONED' or (select count(*) from public.match_results where game_id=v_game)<>0 then
        raise exception 'ABANDON_COUNTED_A_RESULT';
      end if;
    end loop;
    v_checks := array_append(v_checks,'pool-exhaustion-is-atomic-no-repeat-and-abandon-no-result');

    -- Historical requests above 60 minutes may replay their own original
    -- idempotency key, while the same options cannot create a new game.
    v_game:=gen_random_uuid();
    v_games:=array_append(v_games,v_game);
    v_legacy_key:=gen_random_uuid();
    insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,current_phase,created_by)
      values(v_game,v_couple,'IN_PERSON','ACTIVE',180,15,'PAU','PAU','TURN_INTRO',v_user);
    insert into public.game_members(game_id,user_id,access_role) values(v_game,v_user,'IN_PERSON_CONTROLLER');
    perform public.generate_game_board(v_game,15);
    insert into public.game_events(game_id,state_version,event_type,actor_user_id,actor_role,payload,idempotency_key)
      values(v_game,0,'GAME_CREATED',v_user,'IN_PERSON_CONTROLLER',
        jsonb_build_object('request',jsonb_build_object('mode','IN_PERSON','targetMinutes',180,'startingPlayer','PAU','creatorRole','IN_PERSON_CONTROLLER')),v_legacy_key);
    v_view:=public.create_game('IN_PERSON',180,'PAU','IN_PERSON_CONTROLLER',v_legacy_key);
    if (v_view->'game'->>'id')::uuid<>v_game or (v_view->'game'->>'targetMinutes')::integer<>180
      or (v_view->'game'->>'finishPosition')::integer<>15 then raise exception 'LEGACY_IDEMPOTENCY_REPLAY_LOST'; end if;
    v_checks:=array_append(v_checks,'historical180-minute-idempotency-replay-preserved');
    raise exception using errcode='ZX001',message='ROLLBACK_REGISTERED_DURATION_QA_FIXTURES';
  exception when sqlstate 'ZX001' then
    null;
  end;

  select jsonb_build_object(
    'games',jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),''))))
    into v_after from public.games g;
  v_after := v_after || jsonb_build_object(
    'results',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),''))) from public.match_results r),
    'cells',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.game_id,c.position),''))) from public.game_cells c),
    'users',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(u)::text,'' order by u.id),''))) from auth.users u));
  if v_before is distinct from v_after then raise exception 'QA_CHANGED_EXISTING_DATA'; end if;
  if exists(select 1 from auth.users where id=v_user) or exists(select 1 from public.games where id=any(v_games)) then
    raise exception 'QA_FIXTURE_REMAINS';
  end if;
  return jsonb_build_object('status','PASS','checks',to_jsonb(v_checks),'completedTurns',v_turns,
    'fixtures',jsonb_build_object('userId',v_user,'gameIds',to_jsonb(v_games),'rolledBack',true),
    'preservedRows',v_after,'remainingQaUsers',0,'remainingQaGames',0,'authSessionsCreated',0,'noSecrets',true);
end; $$;
select pg_temp.run_duration_regression() as report;
