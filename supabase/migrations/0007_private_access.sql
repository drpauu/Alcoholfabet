-- Private access code configuration lives outside exposed schemas.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.couple_access_config (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  code_sha256 bytea not null check (octet_length(code_sha256)=32),
  updated_at timestamptz not null default now()
);
create table private.access_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);
alter table private.couple_access_config enable row level security;
alter table private.access_attempts enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

create or replace function public.authorize_private_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid:=auth.uid(); v_couple uuid; v_hash bytea; v_attempt private.access_attempts%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('access:'||v_user::text,0));
  select * into v_attempt from private.access_attempts where user_id=v_user;
  if v_attempt.window_started_at>now()-interval '15 minutes' and v_attempt.attempts>=10 then
    return jsonb_build_object('authorized',false,'error','ACCESS_RATE_LIMITED','retryAfterSeconds',ceil(extract(epoch from v_attempt.window_started_at+interval '15 minutes'-now())));
  end if;
  insert into private.access_attempts(user_id,attempts) values(v_user,1)
    on conflict(user_id) do update set
      attempts=case when private.access_attempts.window_started_at<now()-interval '15 minutes' then 1 else private.access_attempts.attempts+1 end,
      window_started_at=case when private.access_attempts.window_started_at<now()-interval '15 minutes' then now() else private.access_attempts.window_started_at end;
  select c.id,config.code_sha256 into v_couple,v_hash from public.couples c
    join private.couple_access_config config on config.couple_id=c.id where c.slug='pau-tecla';
  if v_hash is null then return jsonb_build_object('authorized',false,'error','ACCESS_NOT_CONFIGURED'); end if;
  if p_code is null or length(trim(p_code)) not between 6 and 128 or extensions.digest(trim(p_code),'sha256')<>v_hash then
    return jsonb_build_object('authorized',false,'error','INVALID_CODE');
  end if;
  insert into public.authorized_devices(couple_id,user_id) values(v_couple,v_user)
    on conflict(couple_id,user_id) do update set authorized_at=now(),revoked_at=null;
  delete from private.access_attempts where user_id=v_user;
  return jsonb_build_object('authorized',true,'coupleId',v_couple);
end; $$;

create or replace function public.get_access_context()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_couple uuid; v_active uuid; v_score jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  select c.id into v_couple from public.couples c where c.slug='pau-tecla' and public.is_authorized_for_couple(c.id);
  if v_couple is null then return jsonb_build_object('authorized',false); end if;
  select g.id into v_active from public.games g join public.game_members gm on gm.game_id=g.id
    where gm.user_id=auth.uid() and g.couple_id=v_couple and g.status in ('LOBBY','ACTIVE') order by g.last_action_at desc limit 1;
  select jsonb_build_object('pauWins',count(*) filter(where winner='PAU'),'teclaWins',count(*) filter(where winner='TECLA'),'completedGames',count(*))
    into v_score from public.match_results where couple_id=v_couple;
  return jsonb_strip_nulls(jsonb_build_object('authorized',true,'coupleId',v_couple,'activeGameId',v_active,'scoreboard',v_score));
end; $$;

revoke all on function public.authorize_private_code(text),public.get_access_context() from public,anon;
grant execute on function public.authorize_private_code(text),public.get_access_context() to authenticated;
revoke all on function public.set_updated_at() from public,anon,authenticated;
-- The platform's event trigger is invoked internally and needs no public RPC access.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end; $$;

-- Defensive constraints prevent impossible finalized positions even under future RPCs.
alter table public.games add constraint game_positions_within_board
  check(pau_position<=finish_position and tecla_position<=finish_position);
alter table public.games add constraint game_finished_reached_meta
  check(status<>'FINISHED' or (winner='PAU' and pau_position=finish_position) or (winner='TECLA' and tecla_position=finish_position));
create unique index game_events_unique_version on public.game_events(game_id,state_version);
