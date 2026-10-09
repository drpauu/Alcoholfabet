-- New games estimate a shared 30-second turn, two players, 75% correct answers
-- and 12% +1 cells. Existing games and results retain all persisted data.
-- The historical target_minutes constraint remains 10..180 for legacy rows.
lock table public.games, public.game_cells, public.match_results in share mode;
create temporary table duration_existing_rows on commit drop as
select 'games'::text as entity, md5(coalesce(string_agg(to_jsonb(g)::text, '' order by g.id), '')) as row_hash from public.games g
union all
select 'cells', md5(coalesce(string_agg(to_jsonb(c)::text, '' order by c.game_id,c.position), '')) from public.game_cells c
union all
select 'results', md5(coalesce(string_agg(to_jsonb(r)::text, '' order by r.id), '')) from public.match_results r;

alter table public.games drop constraint games_finish_position_check;
alter table public.games add constraint games_finish_position_check check (finish_position between 3 and 50);

create or replace function public.calculate_finish_position(p_target_minutes integer)
returns integer language plpgsql immutable set search_path = public as $$
begin
  if p_target_minutes is null or p_target_minutes not between 10 and 60 then
    raise exception 'INVALID_GAME_OPTIONS';
  end if;
  return greatest(3, least(50, round(p_target_minutes::numeric * 60 * 0.75 * 1.12 / (2 * 30))::integer));
end; $$;

create or replace function public.generate_game_board(p_game_id uuid, p_finish_position integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_position integer;
  v_type public.cell_type;
  v_plus_count integer;
  v_plus_positions integer[] := '{}';
  v_i integer;
begin
  if p_finish_position is null or p_finish_position < 3 or p_finish_position > 50 then
    raise exception 'INVALID_FINISH_POSITION';
  end if;
  if exists(select 1 from public.game_cells where game_id=p_game_id) then
    raise exception 'BOARD_ALREADY_GENERATED';
  end if;
  v_plus_count := case when p_finish_position < 5 then 0
    else least(round(p_finish_position * 0.12)::integer, floor((p_finish_position - 2)::numeric / 2)::integer) end;
  for v_i in 1..v_plus_count loop
    v_plus_positions := array_append(v_plus_positions, floor(p_finish_position::numeric * v_i / (v_plus_count + 1))::integer);
  end loop;
  for v_position in 1..p_finish_position loop
    -- 40% Personal, 40% Crossed, 20% T&P gives each of the five pools
    -- an estimated 20% share when both players alternate.
    v_type := case ((v_position - 1) % 5)
      when 0 then 'PERSONAL'::public.cell_type
      when 1 then 'CROSSED'::public.cell_type
      when 2 then 'TP'::public.cell_type
      when 3 then 'PERSONAL'::public.cell_type
      else 'CROSSED'::public.cell_type end;
    insert into public.game_cells(game_id,position,cell_type,modifier)
    values(p_game_id,v_position,v_type,
      case when v_position=any(v_plus_positions) then 'PLUS_ONE'::public.cell_modifier else 'NONE'::public.cell_modifier end);
  end loop;
end; $$;

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

  if p_mode is null or p_target_minutes is null or p_creator_role is null then raise exception 'INVALID_GAME_OPTIONS'; end if;
  v_request:=jsonb_build_object('mode',p_mode,'targetMinutes',p_target_minutes,'startingPlayer',p_starting_player,'creatorRole',p_creator_role);
  v_existing_game_id:=public.replay_game_intent(p_idempotency_key,null,'GAME_CREATED',v_request);
  if v_existing_game_id is not null then return public.get_game_view(v_existing_game_id); end if;
  if p_target_minutes not between 10 and 60 then raise exception 'INVALID_GAME_OPTIONS'; end if;
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

-- Internal helpers remain unavailable through the client API.
revoke all on function public.calculate_finish_position(integer),public.generate_game_board(uuid,integer) from public,anon,authenticated;
revoke all on function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) from public,anon;
grant execute on function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) to authenticated;

-- Confirm migration preserved every pre-existing game, route and result.
do $$
begin
  if exists (
    select 1 from duration_existing_rows old
    join (
      select 'games'::text as entity,md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) as row_hash from public.games g
      union all select 'cells',md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.game_id,c.position),'')) from public.game_cells c
      union all select 'results',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.match_results r
    ) current using(entity)
    where old.row_hash is distinct from current.row_hash
  ) then raise exception 'DURATION_MIGRATION_CHANGED_EXISTING_DATA'; end if;
end; $$;
drop table duration_existing_rows;
