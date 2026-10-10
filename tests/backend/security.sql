-- Run through Supabase execute_sql as a privileged QA harness.
-- All fixtures and broadcasts roll back. Gameplay still uses the public RPCs.
begin;
do $$
declare
  v_user uuid:=gen_random_uuid(); v_couple uuid; v_view jsonb; v_game uuid;
  v_read boolean[]; v_write boolean[]; v_result jsonb; v_i integer;
begin
  insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)
    values(v_user,'authenticated','authenticated',true,now(),now());
  select id into v_couple from public.couples where slug='pau-tecla';
  insert into public.authorized_devices(couple_id,user_id) values(v_couple,v_user);
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);
  v_view:=public.create_game('IN_PERSON',30,'PAU','IN_PERSON_CONTROLLER',gen_random_uuid());
  v_game:=(v_view->'game'->>'id')::uuid;
  -- Exercise the retained legacy-private permissions with a private fixture.
  update public.games set couple_id=v_couple where id=v_game;
  select read_allowed,write_allowed into v_read,v_write from realtime.authorize('authenticated','game:'||v_game::text,
    jsonb_build_object('sub',v_user,'role','authenticated')::text,v_user::text,'{}',array['broadcast','presence'],array['broadcast','presence']);
  if v_read<>array[true,true] or v_write<>array[false,true] then raise exception 'private channel policy failed'; end if;
  update public.authorized_devices set revoked_at=now() where user_id=v_user;
  if public.is_member_of_game(v_game) then raise exception 'revoked device remained a member for RLS'; end if;
  if not(public.get_access_context()->>'authorized')::boolean then raise exception 'public entry should remain open'; end if;
  begin
    perform public.get_game_view(v_game);
    raise exception 'revoked device read allowed';
  exception when insufficient_privilege then
    if sqlerrm<>'DEVICE_NOT_AUTHORIZED' then raise; end if;
  end;
  begin
    perform public.apply_game_action(v_game,'BEGIN_TURN',0,gen_random_uuid(),'{}');
    raise exception 'revoked device mutation allowed';
  exception when insufficient_privilege then
    if sqlerrm<>'DEVICE_NOT_AUTHORIZED' then raise; end if;
  end;
  select read_allowed,write_allowed into v_read,v_write from realtime.authorize('authenticated','game:'||v_game::text,
    jsonb_build_object('sub',v_user,'role','authenticated')::text,v_user::text,'{}',array['broadcast','presence'],array['broadcast','presence']);
  if v_read<>array[false,false] or v_write<>array[false,false] then raise exception 'revoked private channel policy failed'; end if;
  for v_i in 1..10 loop
    v_result:=public.authorize_private_code('incorrect-private-code');
    if v_result->>'error'<>'INVALID_CODE' then raise exception 'invalid code response failed'; end if;
  end loop;
  v_result:=public.authorize_private_code('incorrect-private-code');
  if v_result->>'error'<>'ACCESS_RATE_LIMITED' then raise exception 'rate limiting failed'; end if;
  if not v_result ? 'retryAfterSeconds' then raise exception 'rate retry time missing'; end if;
  if (select attempts from private.access_attempts where user_id=v_user)<>10 then raise exception 'rate counter failed'; end if;
  if public.game_id_from_realtime_topic('game:'||v_game::text||':extra') is not null
    or public.game_id_from_realtime_topic('game:invalid') is not null then raise exception 'topic parser failed'; end if;
  update public.authorized_devices set revoked_at=null where user_id=v_user;
  insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)
    select v_game,id,0,'PAU' from (select distinct on (coalesce(a.semantic_key,q.semantic_key)) q.id from public.questions q left join private.question_semantic_aliases a on a.question_id=q.id where q.pool='PAU' order by coalesce(a.semantic_key,q.semantic_key),q.id) facts;
  begin
    perform public.apply_game_action(v_game,'BEGIN_TURN',0,gen_random_uuid(),'{}');
    raise exception 'exhausted pool unexpectedly allowed a question';
  exception when raise_exception then
    if sqlerrm<>'QUESTION_POOL_EMPTY' then raise; end if;
  end;
  if (public.get_game_view(v_game)->'game'->>'stateVersion')::bigint<>0 then raise exception 'exhausted pool changed the game'; end if;
  raise notice 'PASS revoked views/RPC/RLS, private Broadcast/Presence ACL, server-only broadcast, rate limiting and exact topic parsing';
end; $$;
rollback;
