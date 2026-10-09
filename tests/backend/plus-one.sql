-- Real authoritative +1 regression. Only generated QA fixtures are changed;
-- the inner subtransaction rolls back games, users, identities and results.
create or replace function pg_temp.plus_qa_identity(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
end;
$$;

create or replace function pg_temp.run_plus_one_regression()
returns jsonb language plpgsql as $$
declare
  v_pau uuid := gen_random_uuid();
  v_tecla uuid := gen_random_uuid();
  v_game uuid;
  v_mode public.game_mode;
  v_view jsonb;
  v_turn public.player_role;
  v_question text;
  v_used integer;
  v_pre_version bigint;
  v_key uuid;
  v_before text;
  v_after text;
  v_checks text[] := '{}';
begin
  lock table public.games,public.game_cells,public.game_members,public.game_events,
    public.game_question_usage,public.match_results,auth.users,private.online_player_identities in share mode;
  select md5(jsonb_build_object(
    'games',(select jsonb_agg(to_jsonb(g) order by id) from public.games g),
    'cells',(select jsonb_agg(to_jsonb(c) order by game_id,position) from public.game_cells c),
    'members',(select jsonb_agg(to_jsonb(m) order by game_id,user_id) from public.game_members m),
    'events',(select jsonb_agg(to_jsonb(e) order by game_id,state_version) from public.game_events e),
    'usage',(select jsonb_agg(to_jsonb(u) order by game_id,question_id) from public.game_question_usage u),
    'results',(select jsonb_agg(to_jsonb(r) order by game_id) from public.match_results r),
    'users',(select jsonb_agg(to_jsonb(a) order by id) from auth.users a),
    'identities',(select jsonb_agg(to_jsonb(i) order by user_id) from private.online_player_identities i)
  )::text) into v_before;
  begin
    insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
      values(v_pau,'authenticated','authenticated',true,now(),now()),
        (v_tecla,'authenticated','authenticated',true,now(),now());
    insert into private.online_player_identities(user_id,player_role) values(v_pau,'PAU'),(v_tecla,'TECLA');

    foreach v_mode in array array['IN_PERSON'::public.game_mode,'ONLINE'::public.game_mode] loop
      perform pg_temp.plus_qa_identity(v_pau);
      v_view := public.create_game(v_mode,10,'PAU',
        case when v_mode='IN_PERSON' then 'IN_PERSON_CONTROLLER'::public.game_member_role else 'PAU'::public.game_member_role end,gen_random_uuid());
      v_game := (v_view->'game'->>'id')::uuid;
      if v_mode='ONLINE' then
        perform pg_temp.plus_qa_identity(v_tecla);
        perform public.join_game_by_code(v_view->'game'->>'inviteCode','TECLA',gen_random_uuid());
        perform pg_temp.plus_qa_identity(v_pau);
        v_view := public.get_game_view(v_game);
        v_view := public.start_game(v_game,(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid());
      end if;
      if not exists(select 1 from public.game_cells where game_id=v_game and position=4 and modifier='PLUS_ONE') then
        raise exception 'QA_EXPECTED_BONUS_AT_FOUR';
      end if;

      -- Reach the bonus through normal turns, with no direct position edits.
      for v_used in 1..6 loop
        v_turn := (v_view->'game'->>'currentTurn')::public.player_role;
        perform pg_temp.plus_qa_identity(case when v_mode='IN_PERSON' or v_turn='PAU' then v_pau else v_tecla end);
        v_view := public.get_game_view(v_game);
        v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        if v_view->'game'->>'phase'='TP_OPEN' then
          v_view := public.apply_game_action(v_game,'CLAIM_TP',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),jsonb_build_object('claimant',v_turn));
        end if;
        if v_mode='IN_PERSON' then
          v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        else
          perform pg_temp.plus_qa_identity(case when v_turn='PAU' then v_tecla else v_pau end);
        end if;
        v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      end loop;
      if (v_view->'game'->>'pauPosition')::integer<>3 or (v_view->'game'->>'teclaPosition')::integer<>3 then
        raise exception 'QA_NATURAL_POSITIONS_MISMATCH';
      end if;

      -- A temporary consecutive bonus checks that one answer never chains.
      update public.game_cells set modifier='PLUS_ONE' where game_id=v_game and position=5;
      perform pg_temp.plus_qa_identity(v_pau);
      v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      v_question := v_view->'question'->>'id';
      select count(*) into v_used from public.game_question_usage where game_id=v_game;
      if v_mode='IN_PERSON' then
        v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      else perform pg_temp.plus_qa_identity(v_tecla); end if;
      v_pre_version := (v_view->'game'->>'stateVersion')::bigint;
      v_key := gen_random_uuid();
      v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_key,'{}');
      if (v_view->'game'->>'pauPosition')::integer<>5 or v_view->'game'->>'phase'<>'MOVING'
        or (v_view->'lastEvent'->'payload'->>'from')::integer<>3
        or (v_view->'lastEvent'->'payload'->>'to')::integer<>5
        or (v_view->'lastEvent'->'payload'->>'drinkCount')::integer<>0
        or not (v_view->'lastEvent'->'payload'->>'plusOne')::boolean
        or v_view->'question'->>'id'<>v_question
        or (select count(*) from public.game_question_usage where game_id=v_game)<>v_used then
        raise exception 'BONUS_MUST_MOVE_TWO_WITHOUT_ANOTHER_QUESTION_OR_CHAIN';
      end if;
      perform public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_key,'{}');
      if (select pau_position from public.games where id=v_game)<>5 then raise exception 'BONUS_REPLAY_MOVED_AGAIN'; end if;
      v_checks := array_append(v_checks,v_mode||':correct-two-cells-one-question-no-chain-idempotent');
      v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');

      perform pg_temp.plus_qa_identity(case when v_mode='IN_PERSON' then v_pau else v_tecla end);
      v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      v_question := v_view->'question'->>'id';
      select count(*) into v_used from public.game_question_usage where game_id=v_game;
      if v_mode='IN_PERSON' then
        v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      else perform pg_temp.plus_qa_identity(v_pau); end if;
      v_view := public.apply_game_action(v_game,'JUDGE_INCORRECT',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      if (v_view->'game'->>'teclaPosition')::integer<>3 or v_view->'game'->>'phase'<>'RESULT'
        or (v_view->'lastEvent'->'payload'->>'drinkCount')::integer<>2
        or v_view->'lastEvent'->'payload'->>'respondingPlayer'<>'TECLA'
        or (v_view->'lastEvent'->'payload'->>'from')::integer<>(v_view->'lastEvent'->'payload'->>'to')::integer
        or (select count(*) from public.game_question_usage where game_id=v_game)<>v_used then
        raise exception 'INCORRECT_OR_UNKNOWN_MUST_STAY_AND_DRINK_DOUBLE';
      end if;
      v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
      if v_view->'game'->>'currentTurn'<>'PAU' or v_view->'game'->>'phase'<>'TURN_INTRO'
        or v_view->'question'<>'null'::jsonb then raise exception 'BONUS_FAILURE_MUST_PASS_TURN'; end if;
      if exists(select 1 from public.match_results where game_id=v_game) then raise exception 'BONUS_BEFORE_META_CHANGED_SCORE'; end if;
      v_checks := array_append(v_checks,v_mode||':incorrect-or-unknown-no-move-double-drink-pass-turn-no-score');

      if v_mode='IN_PERSON' then
        -- Disputed +1 uses the confirmed claimant's position, with one question.
        update public.game_cells set cell_type='TP',modifier='PLUS_ONE' where game_id=v_game and position=6;
        v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        v_view := public.apply_game_action(v_game,'CLAIM_TP',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{"claimant":"TECLA"}');
        v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        select count(*) into v_used from public.game_question_usage where game_id=v_game;
        v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        if (v_view->'game'->>'teclaPosition')::integer<>5 or (v_view->'game'->>'pauPosition')::integer<>5
          or v_view->'lastEvent'->'payload'->>'respondingPlayer'<>'TECLA'
          or (select count(*) from public.game_question_usage where game_id=v_game)<>v_used then raise exception 'TP_BONUS_CLAIMANT_OR_QUESTION_WRONG'; end if;
        v_checks := array_append(v_checks,'TP:bonus-belongs-to-confirmed-claimant-one-question');

        -- Finish by real turns, including a +1 that reaches META atomically.
        v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        update public.game_cells set cell_type='PERSONAL',modifier='NONE' where game_id=v_game and position=6;
        for v_used in 1..2 loop
          v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
          v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
          v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
          v_view := public.apply_game_action(v_game,'NEXT_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        end loop;
        update public.game_cells set cell_type='PERSONAL',modifier='PLUS_ONE' where game_id=v_game and position=7;
        v_view := public.apply_game_action(v_game,'BEGIN_TURN',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        v_view := public.apply_game_action(v_game,'REVEAL_ANSWER',(v_view->'game'->>'stateVersion')::bigint,gen_random_uuid(),'{}');
        v_pre_version := (v_view->'game'->>'stateVersion')::bigint; v_key := gen_random_uuid();
        v_view := public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_key,'{}');
        perform public.apply_game_action(v_game,'JUDGE_CORRECT',v_pre_version,v_key,'{}');
        if v_view->'game'->>'status'<>'FINISHED'
          or (select count(*) from public.match_results where game_id=v_game)<>1 then raise exception 'BONUS_META_MUST_SCORE_ONCE'; end if;
        v_checks := array_append(v_checks,'META:bonus-finishes-atomically-result-counted-once');
      end if;
    end loop;
    raise exception using errcode='ZX001',message='ROLLBACK_PLUS_ONE_QA';
  exception when sqlstate 'ZX001' then null;
  end;
  select md5(jsonb_build_object(
    'games',(select jsonb_agg(to_jsonb(g) order by id) from public.games g),
    'cells',(select jsonb_agg(to_jsonb(c) order by game_id,position) from public.game_cells c),
    'members',(select jsonb_agg(to_jsonb(m) order by game_id,user_id) from public.game_members m),
    'events',(select jsonb_agg(to_jsonb(e) order by game_id,state_version) from public.game_events e),
    'usage',(select jsonb_agg(to_jsonb(u) order by game_id,question_id) from public.game_question_usage u),
    'results',(select jsonb_agg(to_jsonb(r) order by game_id) from public.match_results r),
    'users',(select jsonb_agg(to_jsonb(a) order by id) from auth.users a),
    'identities',(select jsonb_agg(to_jsonb(i) order by user_id) from private.online_player_identities i)
  )::text) into v_after;
  if v_before<>v_after then raise exception 'NON_QA_DATA_CHANGED'; end if;
  return jsonb_build_object('status','PASS','checks',v_checks,'fixturesRolledBack',true,
    'existingRowsUnchanged',true,'authSessionsCreated',0,'remainingQaGames',0,'remainingQaUsers',0);
end;
$$;
select pg_temp.run_plus_one_regression() as report;
