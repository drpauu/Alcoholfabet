-- Tecla&Pau — reviewed write RPCs
-- Apply after 0001_schema.sql, 0002_rls.sql and 0003_read_functions.sql.
-- PostgreSQL remains the source of truth. Clients must not mutate game tables directly.

create or replace function public.replay_game_intent(p_key uuid, p_game_id uuid, p_action text, p_request jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_event public.game_events%rowtype;
begin
  if p_key is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select * into v_event from public.game_events where idempotency_key=p_key;
  if not found then return null; end if;
  if v_event.actor_user_id is distinct from auth.uid() or v_event.event_type<>p_action
    or (p_game_id is not null and v_event.game_id<>p_game_id)
    or (v_event.payload->'request') is distinct from p_request then
    raise exception 'IDEMPOTENCY_KEY_REUSED';
  end if;
  return v_event.game_id;
end; $$;

create or replace function public.calculate_finish_position(p_target_minutes integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_target_minutes
    when 20 then 4
    when 30 then 5
    when 45 then 7
    when 60 then 9
    else greatest(3, least(15, round(p_target_minutes::numeric / 6.5)::integer))
  end;
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i integer;
  v_bytes bytea;
begin
  loop
    v_code := '';
    v_bytes := extensions.gen_random_bytes(8);
    for v_i in 0..7 loop
      v_code := v_code || substr(v_chars, 1 + get_byte(v_bytes,v_i) % length(v_chars), 1);
    end loop;
    exit when not exists (select 1 from public.games where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.member_role_for_game(p_game_id uuid)
returns public.game_member_role
language sql
stable
security definer
set search_path = public
as $$
  select gm.access_role
  from public.game_members gm
  where gm.game_id = p_game_id and gm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.player_role_from_member(p_role public.game_member_role)
returns public.player_role
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_role = 'PAU' then return 'PAU'::public.player_role; end if;
  if p_role = 'TECLA' then return 'TECLA'::public.player_role; end if;
  return null;
end;
$$;

create or replace function public.other_player(p_player public.player_role)
returns public.player_role
language sql
immutable
set search_path = public
as $$
  select case when p_player = 'PAU' then 'TECLA'::public.player_role else 'PAU'::public.player_role end;
$$;

create or replace function public.generate_game_board(p_game_id uuid, p_finish_position integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position integer;
  v_type public.cell_type;
  v_modifier public.cell_modifier;
  v_plus_a integer;
  v_plus_b integer;
begin
  if p_finish_position < 3 or p_finish_position > 15 then
    raise exception 'INVALID_FINISH_POSITION';
  end if;

  if exists (select 1 from public.game_cells where game_id=p_game_id) then raise exception 'BOARD_ALREADY_GENERATED'; end if;

  v_plus_a := case when p_finish_position < 5 then 0 else greatest(2, floor(p_finish_position * 0.42)::integer) end;
  v_plus_b := case when p_finish_position < 13 then 0 else greatest(v_plus_a + 2, floor(p_finish_position * 0.74)::integer) end;
  if v_plus_b >= p_finish_position then v_plus_b := 0; end if;

  for v_position in 1..p_finish_position loop
    -- Balanced repeating pattern. Never more than two cells of the same type.
    v_type := case ((v_position - 1) % 10)
      when 0 then 'PERSONAL'::public.cell_type
      when 1 then 'CROSSED'::public.cell_type
      when 2 then 'TP'::public.cell_type
      when 3 then 'PERSONAL'::public.cell_type
      when 4 then 'CROSSED'::public.cell_type
      when 5 then 'TP'::public.cell_type
      when 6 then 'PERSONAL'::public.cell_type
      when 7 then 'CROSSED'::public.cell_type
      when 8 then 'PERSONAL'::public.cell_type
      else 'TP'::public.cell_type
    end;

    v_modifier := case
      when v_position = v_plus_a or v_position = v_plus_b then 'PLUS_ONE'::public.cell_modifier
      else 'NONE'::public.cell_modifier
    end;

    if v_position = 1 or v_position >= p_finish_position - 1 then
      v_modifier := 'NONE'::public.cell_modifier;
    end if;

    insert into public.game_cells(game_id, position, cell_type, modifier)
    values (p_game_id, v_position, v_type, v_modifier);
  end loop;
end;
$$;

create or replace function public.question_pool_for_turn(
  p_cell_type public.cell_type,
  p_responding_player public.player_role
)
returns public.question_pool
language sql
immutable
set search_path = public
as $$
  select case
    when p_cell_type = 'TP' then 'TP'::public.question_pool
    when p_cell_type = 'PERSONAL' and p_responding_player = 'PAU' then 'PAU'::public.question_pool
    when p_cell_type = 'PERSONAL' and p_responding_player = 'TECLA' then 'TECLA'::public.question_pool
    when p_cell_type = 'CROSSED' and p_responding_player = 'PAU' then 'PAU_TECLA'::public.question_pool
    else 'TECLA_PAU'::public.question_pool
  end;
$$;

create or replace function public.pick_unused_question(
  p_game_id uuid,
  p_pool public.question_pool
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_question_id text;
begin
  select q.id into v_question_id
  from public.questions q
  where q.pool = p_pool
    and q.review_status = 'APPROVED'
    and q.active = true
    and q.factual_reviewed = true
    and q.language_reviewed = true
    and not exists (
      select 1 from public.game_question_usage u
      where u.game_id = p_game_id and u.question_id = q.id
    )
  order by random()
  limit 1;

  if v_question_id is null then
    raise exception 'QUESTION_POOL_EMPTY';
  end if;
  return v_question_id;
end;
$$;

create or replace function public.broadcast_game_updated(
  p_game_id uuid,
  p_state_version bigint,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'gameId', p_game_id,
      'stateVersion', p_state_version,
      'eventType', p_event_type
    ),
    'game_updated',
    'game:' || p_game_id::text,
    true
  );
exception
  when undefined_function then
    -- Local PostgreSQL without Supabase Realtime. Persisted state remains correct.
    null;
end;
$$;

create or replace function public.create_game(
  p_mode public.game_mode,
  p_target_minutes integer,
  p_starting_player public.player_role,
  p_creator_role public.game_member_role,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_couple_id uuid;
  v_game public.games%rowtype;
  v_existing_game_id uuid;
  v_finish integer;
  v_phase public.game_phase;
  v_status public.game_status;
  v_starting_player public.player_role := coalesce(p_starting_player, case when random()<0.5 then 'PAU'::public.player_role else 'TECLA'::public.player_role end);
  v_request jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;

  select c.id into v_couple_id
  from public.couples c
  where c.slug = 'pau-tecla' and public.is_authorized_for_couple(c.id)
  limit 1;
  if v_couple_id is null then raise exception 'DEVICE_NOT_AUTHORIZED' using errcode = '42501'; end if;

  if p_mode = 'ONLINE' and p_creator_role not in ('PAU', 'TECLA') then
    raise exception 'INVALID_ONLINE_CREATOR_ROLE';
  end if;
  if p_mode = 'IN_PERSON' and p_creator_role <> 'IN_PERSON_CONTROLLER' then
    raise exception 'INVALID_IN_PERSON_CREATOR_ROLE';
  end if;

  if p_mode is null or p_target_minutes is null or p_target_minutes not between 10 and 180 or p_creator_role is null then raise exception 'INVALID_GAME_OPTIONS'; end if;
  v_request:=jsonb_build_object('mode',p_mode,'targetMinutes',p_target_minutes,'startingPlayer',p_starting_player,'creatorRole',p_creator_role);
  v_existing_game_id:=public.replay_game_intent(p_idempotency_key,null,'GAME_CREATED',v_request);
  if v_existing_game_id is not null then return public.get_game_view(v_existing_game_id); end if;
  v_finish := public.calculate_finish_position(p_target_minutes);
  v_phase := case when p_mode = 'ONLINE' then 'LOBBY'::public.game_phase else 'TURN_INTRO'::public.game_phase end;
  v_status := case when p_mode = 'ONLINE' then 'LOBBY'::public.game_status else 'ACTIVE'::public.game_status end;

  insert into public.games(
    couple_id, invite_code, mode, status, target_minutes, finish_position,
    starting_player, current_turn, current_phase, created_by, started_at
  ) values (
    v_couple_id,
    case when p_mode = 'ONLINE' then public.generate_invite_code() else null end,
    p_mode, v_status, p_target_minutes, v_finish,
    v_starting_player, v_starting_player, v_phase, v_user,
    case when p_mode = 'IN_PERSON' then now() else null end
  ) returning * into v_game;

  insert into public.game_members(game_id, user_id, access_role)
  values (v_game.id, v_user, p_creator_role);

  perform public.generate_game_board(v_game.id, v_finish);
  if p_mode = 'IN_PERSON' then
    update public.games set turn_number = 1 where id = v_game.id;
  end if;

  insert into public.game_events(game_id, state_version, event_type, actor_user_id, actor_role, payload, idempotency_key)
  values (v_game.id, 0, 'GAME_CREATED', v_user, p_creator_role,
    jsonb_build_object('mode', p_mode, 'targetMinutes', p_target_minutes,'request',v_request), p_idempotency_key);

  return public.get_game_view(v_game.id);
end;
$$;

create or replace function public.join_game_by_code(
  p_invite_code text,
  p_role public.player_role,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_existing_game_id uuid;
  v_new_version bigint;
  v_code text:=regexp_replace(upper(trim(p_invite_code)), '[^A-Z0-9]', '', 'g');
  v_request jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_role is null then raise exception 'INVALID_PLAYER_ROLE'; end if;
  v_request:=jsonb_build_object('inviteCode',v_code,'role',p_role);
  v_existing_game_id:=public.replay_game_intent(p_idempotency_key,null,'PLAYER_JOINED',v_request);
  if v_existing_game_id is not null then return public.get_game_view(v_existing_game_id); end if;

  select * into v_game
  from public.games
  where invite_code = v_code
  for update;

  if not found then raise exception 'GAME_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_game.mode <> 'ONLINE' or v_game.status <> 'LOBBY' then raise exception 'GAME_NOT_JOINABLE'; end if;
  if not public.is_authorized_for_couple(v_game.couple_id) then raise exception 'DEVICE_NOT_AUTHORIZED' using errcode = '42501'; end if;

  if exists (select 1 from public.game_members where game_id = v_game.id and (access_role::text = p_role::text or user_id=v_user)) then
    raise exception 'ROLE_ALREADY_TAKEN';
  end if;

  insert into public.game_members(game_id, user_id, access_role)
  values (v_game.id, v_user, p_role::text::public.game_member_role);

  v_new_version := v_game.state_version + 1;
  update public.games set state_version = v_new_version, last_action_at = now() where id = v_game.id;

  insert into public.game_events(game_id, state_version, event_type, actor_user_id, actor_role, payload, idempotency_key)
  values (v_game.id, v_new_version, 'PLAYER_JOINED', v_user, p_role::text::public.game_member_role,
    jsonb_build_object('role', p_role,'request',v_request), p_idempotency_key);

  perform public.broadcast_game_updated(v_game.id, v_new_version, 'PLAYER_JOINED');
  return public.get_game_view(v_game.id);
end;
$$;

create or replace function public.start_game(
  p_game_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_actor_role public.game_member_role;
  v_new_version bigint;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if public.replay_game_intent(p_idempotency_key,p_game_id,'GAME_STARTED','{}') is not null then return public.get_game_view(p_game_id); end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  select access_role into v_actor_role from public.game_members where game_id = p_game_id and user_id = v_user;
  if v_actor_role is null then raise exception 'NOT_A_GAME_MEMBER' using errcode = '42501'; end if;
  if not public.is_authorized_for_couple(v_game.couple_id) then raise exception 'DEVICE_NOT_AUTHORIZED' using errcode='42501'; end if;
  if v_game.state_version is distinct from p_expected_state_version then raise exception 'STALE_STATE'; end if;
  if v_game.mode <> 'ONLINE' or v_game.status <> 'LOBBY' then raise exception 'GAME_CANNOT_START'; end if;
  if not exists (select 1 from public.game_members where game_id=p_game_id and access_role='PAU')
     or not exists (select 1 from public.game_members where game_id=p_game_id and access_role='TECLA') then
    raise exception 'BOTH_PLAYERS_REQUIRED';
  end if;

  v_new_version := v_game.state_version + 1;
  update public.games
  set status='ACTIVE', current_phase='TURN_INTRO', started_at=coalesce(started_at,now()),
      turn_number=1, state_version=v_new_version, last_action_at=now()
  where id=p_game_id;

  insert into public.game_events(game_id,state_version,event_type,actor_user_id,actor_role,payload,idempotency_key)
  values(p_game_id,v_new_version,'GAME_STARTED',v_user,v_actor_role,jsonb_build_object('request','{}'::jsonb),p_idempotency_key);
  perform public.broadcast_game_updated(p_game_id,v_new_version,'GAME_STARTED');
  return public.get_game_view(p_game_id);
end;
$$;

create or replace function public.apply_game_action(
  p_game_id uuid,
  p_action text,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_actor_role public.game_member_role;
  v_actor_player public.player_role;
  v_action text := upper(trim(p_action));
  v_new_version bigint;
  v_target integer;
  v_cell public.game_cells%rowtype;
  v_pool public.question_pool;
  v_question_id text;
  v_claimant public.player_role;
  v_respondent public.player_role;
  v_destination integer;
  v_start_position integer;
  v_drink_count integer;
  v_event_payload jsonb := '{}'::jsonb;
  v_is_correct boolean;
  v_winner public.player_role;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;

  if p_action is null or jsonb_typeof(coalesce(p_payload,'{}')) <> 'object' then raise exception 'INVALID_ACTION'; end if;
  if (v_action <> 'CLAIM_TP' and coalesce(p_payload,'{}') <> '{}'::jsonb)
    or (v_action = 'CLAIM_TP' and (coalesce(p_payload,'{}') - 'claimant') <> '{}'::jsonb) then raise exception 'INVALID_ACTION_PAYLOAD'; end if;

  if public.replay_game_intent(p_idempotency_key,p_game_id,v_action,coalesce(p_payload,'{}')) is not null then
    return public.get_game_view(p_game_id);
  end if;

  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND' using errcode='P0002'; end if;

  select access_role into v_actor_role from public.game_members where game_id=p_game_id and user_id=v_user;
  if v_actor_role is null then raise exception 'NOT_A_GAME_MEMBER' using errcode='42501'; end if;
  if not public.is_authorized_for_couple(v_game.couple_id) then raise exception 'DEVICE_NOT_AUTHORIZED' using errcode='42501'; end if;
  v_actor_player := public.player_role_from_member(v_actor_role);

  if v_game.state_version is distinct from p_expected_state_version then raise exception 'STALE_STATE'; end if;
  if v_game.status not in ('ACTIVE','LOBBY') then raise exception 'GAME_ALREADY_FINISHED'; end if;

  if v_action = 'BEGIN_TURN' then
    if v_game.status <> 'ACTIVE' or v_game.current_phase not in ('TURN_INTRO','BETWEEN_TURNS') then raise exception 'INVALID_PHASE'; end if;
    if v_game.mode='ONLINE' and v_actor_player is distinct from v_game.current_turn then raise exception 'ACTION_NOT_ALLOWED' using errcode='42501'; end if;
    v_respondent := v_game.current_turn;
    v_target := case when v_respondent='PAU' then v_game.pau_position+1 else v_game.tecla_position+1 end;
    if v_target > v_game.finish_position then raise exception 'INVALID_TARGET'; end if;
    select * into v_cell from public.game_cells where game_id=p_game_id and position=v_target;
    if not found then raise exception 'CELL_NOT_FOUND'; end if;
    v_pool := public.question_pool_for_turn(v_cell.cell_type,v_respondent);
    v_question_id := public.pick_unused_question(p_game_id,v_pool);

    insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)
    values(p_game_id,v_question_id,v_game.turn_number,v_respondent);

    update public.games set
      current_question_id=v_question_id,
      current_target_cell=v_target,
      responding_player=case when v_cell.cell_type='TP' then null else v_respondent end,
      tp_claimant=null,
      current_phase=case when v_cell.cell_type='TP' then 'TP_OPEN'::public.game_phase else 'QUESTION'::public.game_phase end
    where id=p_game_id;
    v_event_payload := jsonb_build_object('targetCell',v_target,'questionCell',v_target,'cellType',v_cell.cell_type,'modifier',v_cell.modifier,'pool',v_pool);

  elsif v_action = 'REVEAL_ANSWER' then
    if v_game.mode <> 'IN_PERSON' or v_actor_role <> 'IN_PERSON_CONTROLLER' then raise exception 'NOT_ALLOWED'; end if;
    if v_game.current_phase not in ('QUESTION','TP_CLAIMED') then raise exception 'INVALID_PHASE'; end if;
    update public.games set current_phase='ANSWER_REVEALED' where id=p_game_id;

  elsif v_action = 'CLAIM_TP' then
    if v_game.current_phase <> 'TP_OPEN' or v_game.tp_claimant is not null then raise exception 'CLAIM_CLOSED'; end if;
    if v_actor_role='IN_PERSON_CONTROLLER' then
      if coalesce(p_payload->>'claimant','') not in ('PAU','TECLA') then raise exception 'INVALID_PLAYER_ROLE'; end if;
      v_claimant:=(p_payload->>'claimant')::public.player_role;
    else
      v_claimant:=v_actor_player;
      if p_payload ? 'claimant' and p_payload->>'claimant'<>v_actor_player::text then raise exception 'CLAIMANT_MISMATCH'; end if;
    end if;
    if v_actor_role = 'IN_PERSON_CONTROLLER' then
      null;
    elsif v_actor_player is null or v_actor_player <> v_claimant then
      raise exception 'CLAIMANT_MISMATCH';
    end if;

    v_target := case when v_claimant='PAU' then v_game.pau_position+1 else v_game.tecla_position+1 end;
    if v_target > v_game.finish_position then v_target := v_game.finish_position; end if;

    update public.games set tp_claimant=v_claimant, responding_player=v_claimant,
      current_phase='TP_CLAIMED'
    where id=p_game_id and tp_claimant is null and current_phase='TP_OPEN';
    if not found then raise exception 'CLAIM_LOST'; end if;

    update public.game_question_usage set responding_player=v_claimant
    where game_id=p_game_id and question_id=v_game.current_question_id;
    select * into v_cell from public.game_cells where game_id=p_game_id and position=v_game.current_target_cell;
    v_event_payload := jsonb_build_object('claimant',v_claimant,'targetCell',v_target,'questionCell',v_game.current_target_cell,'modifier',v_cell.modifier);

  elsif v_action in ('JUDGE_CORRECT','JUDGE_INCORRECT') then
    v_is_correct := v_action='JUDGE_CORRECT';
    if v_game.current_question_id is null or v_game.responding_player is null then raise exception 'NOTHING_TO_JUDGE'; end if;
    if v_game.mode='IN_PERSON' then
      if v_actor_role <> 'IN_PERSON_CONTROLLER' or v_game.current_phase <> 'ANSWER_REVEALED' then raise exception 'NOT_ALLOWED'; end if;
    else
      if v_actor_player is null or v_actor_player = v_game.responding_player then raise exception 'RESPONDENT_CANNOT_JUDGE'; end if;
      if v_game.current_phase not in ('QUESTION','TP_CLAIMED') then raise exception 'INVALID_PHASE'; end if;
    end if;

    v_respondent := v_game.responding_player;
    select * into v_cell from public.game_cells where game_id=p_game_id and position=v_game.current_target_cell;
    if not found then raise exception 'CELL_NOT_FOUND'; end if;

    update public.game_question_usage set result=v_is_correct
    where game_id=p_game_id and question_id=v_game.current_question_id;

    if v_is_correct then
      v_start_position := case when v_respondent='PAU' then v_game.pau_position else v_game.tecla_position end;
      v_destination := least(v_game.finish_position, v_start_position + 1 + case when v_cell.modifier='PLUS_ONE' then 1 else 0 end);
      if v_respondent='PAU' then update public.games set pau_position=v_destination where id=p_game_id;
      else update public.games set tecla_position=v_destination where id=p_game_id; end if;

      if v_destination >= v_game.finish_position then
        v_winner := v_respondent;
        update public.games set status='FINISHED',current_phase='FINISHED',winner=v_winner,finished_at=now() where id=p_game_id;
        insert into public.match_results(game_id,couple_id,winner,finished_at)
        values(p_game_id,v_game.couple_id,v_winner,now()) on conflict(game_id) do nothing;
        v_event_payload := jsonb_build_object('correct',true,'respondingPlayer',v_respondent,'winner',v_winner,'from',v_start_position,'to',v_destination,'plusOne',v_cell.modifier='PLUS_ONE','drinkCount',0);
      else
        update public.games set current_phase='MOVING' where id=p_game_id;
        v_event_payload := jsonb_build_object('correct',true,'respondingPlayer',v_respondent,'from',v_start_position,'to',v_destination,'plusOne',v_cell.modifier='PLUS_ONE','drinkCount',0);
      end if;
    else
      v_start_position := case when v_respondent='PAU' then v_game.pau_position else v_game.tecla_position end;
      v_drink_count := case when v_cell.modifier='PLUS_ONE' then 2 else 1 end;
      update public.games set current_phase='RESULT' where id=p_game_id;
      v_event_payload := jsonb_build_object('correct',false,'respondingPlayer',v_respondent,'from',v_start_position,'to',v_start_position,'drinkCount',v_drink_count,'plusOne',v_cell.modifier='PLUS_ONE');
    end if;

  elsif v_action = 'NEXT_TURN' then
    if v_game.current_phase not in ('RESULT','MOVING') then raise exception 'INVALID_PHASE'; end if;
    update public.games set
      current_turn=public.other_player(v_game.current_turn),
      current_phase='TURN_INTRO',
      current_question_id=null,
      current_target_cell=null,
      responding_player=null,
      tp_claimant=null,
      turn_number=v_game.turn_number+1
    where id=p_game_id;

  elsif v_action = 'ABANDON_GAME' then
    if v_game.status in ('FINISHED','ABANDONED') then return public.get_game_view(p_game_id); end if;
    update public.games set status='ABANDONED',current_question_id=null,responding_player=null,tp_claimant=null,last_action_at=now() where id=p_game_id;

  else
    raise exception 'UNKNOWN_ACTION:%', v_action;
  end if;

  select state_version + 1 into v_new_version from public.games where id=p_game_id;
  update public.games set state_version=v_new_version,last_action_at=now() where id=p_game_id;

  insert into public.game_events(game_id,state_version,event_type,actor_user_id,actor_role,payload,idempotency_key)
  values(p_game_id,v_new_version,v_action,v_user,v_actor_role,v_event_payload||jsonb_build_object('request',coalesce(p_payload,'{}')),p_idempotency_key);

  perform public.broadcast_game_updated(p_game_id,v_new_version,v_action);
  return public.get_game_view(p_game_id);
end;
$$;

revoke all on function public.calculate_finish_position(integer) from public, anon, authenticated;
revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.generate_game_board(uuid,integer) from public, anon, authenticated;
revoke all on function public.pick_unused_question(uuid,public.question_pool) from public, anon, authenticated;
revoke all on function public.broadcast_game_updated(uuid,bigint,text) from public, anon, authenticated;

revoke all on function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) from public, anon;
revoke all on function public.join_game_by_code(text,public.player_role,uuid) from public, anon;
revoke all on function public.start_game(uuid,bigint,uuid) from public, anon;
revoke all on function public.apply_game_action(uuid,text,bigint,uuid,jsonb) from public, anon;

grant execute on function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) to authenticated;
grant execute on function public.join_game_by_code(text,public.player_role,uuid) to authenticated;
grant execute on function public.start_game(uuid,bigint,uuid) to authenticated;
grant execute on function public.apply_game_action(uuid,text,bigint,uuid,jsonb) to authenticated;

revoke all on function public.replay_game_intent(uuid,uuid,text,jsonb),public.member_role_for_game(uuid),public.player_role_from_member(public.game_member_role),public.other_player(public.player_role),public.question_pool_for_turn(public.cell_type,public.player_role) from public,anon,authenticated;
