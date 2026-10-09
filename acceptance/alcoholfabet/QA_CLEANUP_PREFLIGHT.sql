with scope as (select array['03007d3b-6d29-40b7-9f37-4cdf95de8d91'::uuid,'121dd4b9-a11f-4b80-a757-841eb5a86451'::uuid,'1c434e41-6ac2-41da-8f4f-2e6b9942ec02'::uuid,'39cb3e79-13bd-48b2-8c10-3eba316fe1ec'::uuid,'4babeb0b-8fc8-445f-a99c-f3a394d6c332'::uuid,'75f32b4e-8d1f-4e3c-95c0-3643985a4787'::uuid,'a56f1304-37d2-4cde-a362-c1a632748faf'::uuid,'df980159-e357-47c7-9a14-2edd5d14619a'::uuid,'e1d0bc13-f5be-4e83-9e98-f563aee9a0a5'::uuid]::uuid[] as users,array['30030245-e95d-4951-9eb4-a85fa450526c'::uuid,'33186fa7-393a-462d-99a4-637ee05a116a'::uuid,'5ca76025-0714-46c4-9b63-282977db5bc8'::uuid,'73e9e0d1-d50b-45e4-83b4-6d8ece5ebe3a'::uuid,'96ad2f08-2c7b-4e7f-a5e1-6fdb379a4bc5'::uuid,'f6cad8ae-89ca-41d9-96fa-7507c5e44069'::uuid]::uuid[] as games)
select jsonb_build_object('scope','alcoholfabet','noSecrets',true,
  'requestedUsers',cardinality(s.users),'requestedGames',cardinality(s.games),
  'foundUsers',(select count(*) from auth.users where id=any(s.users)),
  'foundGames',(select count(*) from public.games where id=any(s.games)),
  'qaResults',(select count(*) from public.match_results where game_id=any(s.games)),
  'nonAnonymousOrAdminUsers',(select count(*) from auth.users where id=any(s.users) and is_anonymous is distinct from true)
    +(select count(*) from public.couple_admins where user_id=any(s.users)),
  'unlistedGamesOwnedByQaUser',(select count(*) from public.games where created_by=any(s.users) and not(id=any(s.games))),
  'unlistedMembershipsForQaUser',(select count(*) from public.game_members where user_id=any(s.users) and not(game_id=any(s.games))),
  'unlistedOwnersOrMembers',(select count(*) from public.games where id=any(s.games) and not(created_by=any(s.users)))
    +(select count(*) from public.game_members where game_id=any(s.games) and not(user_id=any(s.users))),
  'preservedOtherUsers',(select count(*) from auth.users where not(id=any(s.users))),
  'preservedOtherGames',(select count(*) from public.games where not(id=any(s.games))),
  'preservedOtherResults',(select count(*) from public.match_results where not(game_id=any(s.games))),
  'expectedPostCleanupScoreboard',(select jsonb_build_object('pauWins',count(*) filter(where winner='PAU'),'teclaWins',count(*) filter(where winner='TECLA'),'completedGames',count(*))
    from public.match_results where not(game_id=any(s.games)) and couple_id=(select id from public.couples where slug='pau-tecla')),
  'questionCount',(select count(*) from public.questions)) as preflight from scope s;
