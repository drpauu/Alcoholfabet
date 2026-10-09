-- Online identity is verified on the server. In-person entry stays public.
create table private.online_player_codes (
  player_role public.player_role primary key,
  code_sha256 bytea not null unique check (octet_length(code_sha256)=32),
  updated_at timestamptz not null default now()
);
create table private.online_player_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_role public.player_role not null,
  identified_at timestamptz not null default now()
);
create table private.online_player_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);
alter table private.online_player_codes enable row level security;
alter table private.online_player_identities enable row level security;
alter table private.online_player_attempts enable row level security;
revoke all on private.online_player_codes, private.online_player_identities,
  private.online_player_attempts from public, anon, authenticated;

create function public.identify_online_player(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_role public.player_role;
  v_previous public.player_role;
  v_attempt private.online_player_attempts%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('online-identity:'||v_user::text,0));
  select * into v_attempt from private.online_player_attempts where user_id=v_user;
  if v_attempt.window_started_at>now()-interval '15 minutes' and v_attempt.attempts>=10 then
    return jsonb_build_object('identified',false,'error','ACCESS_RATE_LIMITED');
  end if;
  insert into private.online_player_attempts(user_id,attempts) values(v_user,1)
    on conflict(user_id) do update set
      attempts=case when private.online_player_attempts.window_started_at<=now()-interval '15 minutes' then 1 else private.online_player_attempts.attempts+1 end,
      window_started_at=case when private.online_player_attempts.window_started_at<=now()-interval '15 minutes' then now() else private.online_player_attempts.window_started_at end;
  if (select count(*) from private.online_player_codes)<>2 then
    return jsonb_build_object('identified',false,'error','ONLINE_CODES_NOT_CONFIGURED');
  end if;
  if p_code is not null and length(trim(p_code)) between 6 and 128 then
    select player_role into v_role from private.online_player_codes
      where code_sha256=extensions.digest(lower(trim(p_code)),'sha256');
  end if;
  if v_role is null then return jsonb_build_object('identified',false,'error','INVALID_CODE'); end if;
  select player_role into v_previous from private.online_player_identities where user_id=v_user;
  if exists(select 1 from public.game_members gm join public.games g on g.id=gm.game_id
    where gm.user_id=v_user and g.mode='ONLINE' and g.status in ('LOBBY','ACTIVE')
      and gm.access_role::text<>v_role::text) then
    return jsonb_build_object('identified',false,'error','ONLINE_IDENTITY_IN_USE');
  end if;
  insert into private.online_player_identities(user_id,player_role) values(v_user,v_role)
    on conflict(user_id) do update set player_role=excluded.player_role,identified_at=now();
  delete from private.online_player_attempts where user_id=v_user;
  return jsonb_build_object('identified',true,'role',v_role);
end; $$;

create function private.require_online_role(p_role public.player_role)
returns void language plpgsql security definer set search_path=public as $$
declare v_role public.player_role;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('online-identity:'||auth.uid()::text,0));
  select player_role into v_role from private.online_player_identities where user_id=auth.uid();
  if v_role is null then raise exception 'ONLINE_IDENTITY_REQUIRED' using errcode='42501'; end if;
  if p_role is null or v_role<>p_role then raise exception 'ONLINE_ROLE_MISMATCH' using errcode='42501'; end if;
end; $$;

-- Keep the existing authoritative implementations intact, outside exposed schemas.
alter function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid) set schema private;
alter function public.join_game_by_code(text,public.player_role,uuid) set schema private;
revoke all on function private.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid),
  private.join_game_by_code(text,public.player_role,uuid),private.require_online_role(public.player_role) from public,anon,authenticated;

create function public.create_game(p_mode public.game_mode,p_target_minutes integer,
  p_starting_player public.player_role,p_creator_role public.game_member_role,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_mode='ONLINE' then
    if p_creator_role is null or p_creator_role not in ('PAU','TECLA') then raise exception 'INVALID_ONLINE_CREATOR_ROLE'; end if;
    perform private.require_online_role(p_creator_role::text::public.player_role);
  end if;
  return private.create_game(p_mode,p_target_minutes,p_starting_player,p_creator_role,p_idempotency_key);
end; $$;

create function public.join_game_by_code(p_invite_code text,p_role public.player_role,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform private.require_online_role(p_role);
  return private.join_game_by_code(p_invite_code,p_role,p_idempotency_key);
end; $$;

create or replace function public.get_access_context()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_couple uuid; v_active uuid; v_score jsonb; v_online_role public.player_role;
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
  select player_role into v_online_role from private.online_player_identities where user_id=auth.uid();
  return jsonb_strip_nulls(jsonb_build_object('authorized',true,'coupleId',v_couple,
    'activeGameId',v_active,'scoreboard',v_score,'onlineRole',v_online_role));
end; $$;

revoke all on function public.identify_online_player(text),public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid),
  public.join_game_by_code(text,public.player_role,uuid),public.get_access_context() from public,anon;
grant execute on function public.identify_online_player(text),public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid),
  public.join_game_by_code(text,public.player_role,uuid),public.get_access_context() to authenticated;
notify pgrst,'reload schema';
