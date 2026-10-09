-- Pau & Tecla — safe read functions

create or replace function public.scoreboard(p_couple_id uuid)
returns table (
  pau_wins bigint,
  tecla_wins bigint,
  completed_games bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_authorized_for_couple(p_couple_id) then
    raise exception 'DEVICE_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where mr.winner = 'PAU')::bigint,
    count(*) filter (where mr.winner = 'TECLA')::bigint,
    count(*)::bigint
  from public.match_results mr
  where mr.couple_id = p_couple_id;
end;
$$;

grant execute on function public.scoreboard(uuid) to authenticated;

create or replace function public.get_game_view(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_member public.game_members%rowtype;
  v_question public.questions%rowtype;
  v_show_answer boolean := false;
  v_responding public.player_role;
  v_cells jsonb;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select * into v_member
  from public.game_members
  where game_id = p_game_id and user_id = auth.uid();

  if not found then
    raise exception 'NOT_GAME_MEMBER' using errcode = '42501';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_authorized_for_couple(v_game.couple_id) then
    raise exception 'DEVICE_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_game.current_question_id is not null then
    select * into v_question from public.questions where id = v_game.current_question_id;
  end if;

  v_responding := coalesce(v_game.responding_player, v_game.tp_claimant);

  if v_game.mode = 'IN_PERSON' then
    v_show_answer := v_game.current_phase in ('ANSWER_REVEALED', 'JUDGING', 'RESULT', 'MOVING', 'BETWEEN_TURNS', 'FINISHED');
  elsif v_member.access_role in ('PAU', 'TECLA') then
    v_show_answer := v_member.access_role::text <> v_responding::text
      and v_game.current_phase in ('QUESTION', 'TP_CLAIMED', 'JUDGING', 'RESULT', 'MOVING', 'BETWEEN_TURNS', 'FINISHED');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', gc.position,
    'type', gc.cell_type,
    'modifier', gc.modifier
  ) order by gc.position), '[]'::jsonb)
  into v_cells
  from public.game_cells gc
  where gc.game_id = p_game_id;

  return jsonb_build_object(
    'game', jsonb_build_object(
      'id', v_game.id,
      'coupleId', v_game.couple_id,
      'inviteCode', v_game.invite_code,
      'mode', v_game.mode,
      'status', v_game.status,
      'targetMinutes', v_game.target_minutes,
      'finishPosition', v_game.finish_position,
      'startingPlayer', v_game.starting_player,
      'currentTurn', v_game.current_turn,
      'phase', v_game.current_phase,
      'currentTargetCell', v_game.current_target_cell,
      'tpClaimant', v_game.tp_claimant,
      'respondingPlayer', v_responding,
      'pauPosition', v_game.pau_position,
      'teclaPosition', v_game.tecla_position,
      'turnNumber', v_game.turn_number,
      'stateVersion', v_game.state_version,
      'winner', v_game.winner
    ),
    'viewer', jsonb_build_object(
      'role', v_member.access_role,
      'userId', auth.uid()
    ),
    'board', v_cells,
    'question', case when v_game.current_question_id is null then null else jsonb_build_object(
      'id', v_question.id,
      'pool', v_question.pool,
      'topic', v_question.topic,
      'questionCa', v_question.question_ca,
      'difficulty', v_question.difficulty
    ) || case when v_show_answer then jsonb_build_object('answerCa', v_question.answer_ca) else '{}'::jsonb end end,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('role', gm.access_role)), '[]'::jsonb) from public.game_members gm where gm.game_id=p_game_id),
    'lastEvent', (select jsonb_build_object('id', e.id,'type',e.event_type,'stateVersion',e.state_version,'payload',e.payload-'request','createdAt',e.created_at)
      from public.game_events e where e.game_id=p_game_id order by e.state_version desc,e.id desc limit 1),
    'scoreboard', (select jsonb_build_object('pauWins',count(*) filter (where mr.winner='PAU'),'teclaWins',count(*) filter (where mr.winner='TECLA'),'completedGames',count(*))
      from public.match_results mr where mr.couple_id=v_game.couple_id),
    'capabilities', jsonb_build_object(
      'canSeeAnswer', v_show_answer,
      'canStart', v_game.mode='ONLINE' and v_game.status='LOBBY' and (select count(*) from public.game_members gm where gm.game_id=p_game_id)=2,
      'canBeginTurn', v_game.status='ACTIVE' and v_game.current_phase='TURN_INTRO' and (v_game.mode='IN_PERSON' or v_member.access_role::text=v_game.current_turn::text),
      'canReveal', v_game.mode='IN_PERSON' and v_game.status='ACTIVE' and v_game.current_phase in ('QUESTION','TP_CLAIMED'),
      'canClaim', v_game.status='ACTIVE' and v_game.current_phase='TP_OPEN',
      'canNextTurn', v_game.status='ACTIVE' and v_game.current_phase in ('RESULT','MOVING'),
      'canAbandon', v_game.status in ('LOBBY','ACTIVE'),
      'canJudge', v_game.status='ACTIVE' and coalesce(case
        when v_game.mode = 'IN_PERSON' then v_game.current_phase in ('ANSWER_REVEALED', 'JUDGING')
        else v_member.access_role::text <> v_responding::text and v_game.current_phase in ('QUESTION', 'TP_CLAIMED', 'JUDGING')
      end, false)
    )
  );
end;
$$;

grant execute on function public.get_game_view(uuid) to authenticated;
revoke all on function public.scoreboard(uuid), public.get_game_view(uuid) from public, anon;
