-- Supabase default ACLs grant functions directly to API roles as well as PUBLIC.
revoke all on function public.calculate_finish_position(integer),public.generate_invite_code(),
  public.generate_game_board(uuid,integer),public.pick_unused_question(uuid,public.question_pool),
  public.broadcast_game_updated(uuid,bigint,text),public.replay_game_intent(uuid,uuid,text,jsonb),
  public.member_role_for_game(uuid),public.player_role_from_member(public.game_member_role),
  public.other_player(public.player_role),public.question_pool_for_turn(public.cell_type,public.player_role)
  from public,anon,authenticated;
revoke all on function public.create_game(public.game_mode,integer,public.player_role,public.game_member_role,uuid),
  public.join_game_by_code(text,public.player_role,uuid),public.start_game(uuid,bigint,uuid),
  public.apply_game_action(uuid,text,bigint,uuid,jsonb),public.game_id_from_realtime_topic(text)
  from public,anon;
