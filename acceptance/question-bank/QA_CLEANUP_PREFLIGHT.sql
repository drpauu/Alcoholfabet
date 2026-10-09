with scope as (select array['1924d013-2905-4981-9f35-128db0fd8649'::uuid,'1a00dd3b-4748-4dca-ad7e-8c4e158c9d56'::uuid,'55a982b3-d8da-4330-b28b-cbebf9e724b2'::uuid,'767d8792-5e58-4a7f-b4d5-b71959fc5b55'::uuid,'86d71644-1624-4cfa-b3a9-0078d39905d5'::uuid,'92c85667-2da1-4bd7-b13a-26bfbcdcfc57'::uuid,'b7979dac-e5be-4aac-9835-9d51ee01d59a'::uuid,'ef074503-462b-40ee-80b5-a39bafae499b'::uuid]::uuid[] as users,array['4d632ca2-21c9-49a2-95f8-63a59bac584f'::uuid,'68e835b1-5a33-4f36-9cd2-16dee106af8b'::uuid,'a2dac3ec-ac8b-4748-8f98-25877a0a7c75'::uuid,'f8821b24-833d-4348-a000-de5e18e95057'::uuid]::uuid[] as games)
select jsonb_build_object('scope','question-bank','noSecrets',true,
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
