-- Alcoholfabet opens entry to every anonymous authenticated session.
-- A separate public couple keeps all legacy private games and results private.
lock table public.couples, public.games, public.game_cells, public.match_results, public.authorized_devices in share mode;
create temporary table alcoholfabet_existing_rows on commit drop as
select 'games'::text as entity, md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) as row_hash from public.games g
union all select 'cells',md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.game_id,c.position),'')) from public.game_cells c
union all select 'results',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.match_results r
union all select 'devices',md5(coalesce(string_agg(to_jsonb(d)::text,'' order by d.id),'')) from public.authorized_devices d;

insert into public.couples(slug,display_name) values('alcoholfabet','Alcoholfabet')
on conflict(slug) do nothing;

create or replace function public.is_authorized_for_couple(p_couple_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    exists(select 1 from public.couples c where c.id=p_couple_id and c.slug='alcoholfabet')
    or exists(select 1 from public.authorized_devices d
      where d.couple_id=p_couple_id and d.user_id=auth.uid() and d.revoked_at is null)
  );
$$;

create or replace function public.get_access_context()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_couple uuid; v_active uuid; v_score jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  select c.id into v_couple from public.couples c
    where c.slug='alcoholfabet' and public.is_authorized_for_couple(c.id);
  if v_couple is null then raise exception 'PUBLIC_GAME_NOT_CONFIGURED'; end if;
  select g.id into v_active from public.games g join public.game_members gm on gm.game_id=g.id
    where gm.user_id=auth.uid() and g.couple_id=v_couple and g.status in ('LOBBY','ACTIVE')
    order by g.last_action_at desc limit 1;
  select jsonb_build_object('pauWins',count(*) filter(where winner='PAU'),
    'teclaWins',count(*) filter(where winner='TECLA'),'completedGames',count(*))
    into v_score from public.match_results where couple_id=v_couple;
  return jsonb_strip_nulls(jsonb_build_object('authorized',true,'coupleId',v_couple,
    'activeGameId',v_active,'scoreboard',v_score));
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
  where c.slug = 'alcoholfabet' and public.is_authorized_for_couple(c.id)
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


revoke all on function public.is_authorized_for_couple(uuid),public.get_access_context(),
  public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) from public,anon;
grant execute on function public.is_authorized_for_couple(uuid),public.get_access_context(),
  public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) to authenticated;

-- Membership, answer filtering, private Realtime and write-only RPCs are unchanged.
-- Assert this migration did not change a single existing game, route, result or device.
do $$ begin
  if exists(
    select 1 from alcoholfabet_existing_rows old join (
      select 'games'::text as entity,md5(coalesce(string_agg(to_jsonb(g)::text,'' order by g.id),'')) as row_hash from public.games g
      union all select 'cells',md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.game_id,c.position),'')) from public.game_cells c
      union all select 'results',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by r.id),'')) from public.match_results r
      union all select 'devices',md5(coalesce(string_agg(to_jsonb(d)::text,'' order by d.id),'')) from public.authorized_devices d
    ) current using(entity) where old.row_hash is distinct from current.row_hash
  ) then raise exception 'PUBLIC_ACCESS_CHANGED_EXISTING_DATA'; end if;
end; $$;
drop table alcoholfabet_existing_rows;
