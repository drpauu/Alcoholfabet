with scope as (select array['0d7e075e-6f61-46c5-9523-307eef15ab02'::uuid,'14cd1fde-8dde-4a2a-8abf-62bd53064c20'::uuid,'14f340fc-96d2-4152-96e1-0d256440eec9'::uuid,'1664ffdb-fae4-4da2-92ad-3e995a78cdf4'::uuid,'206bff8d-0739-4793-93e4-2345cb63099b'::uuid,'3e05b878-f01f-4b11-b693-eb694bf01c3b'::uuid,'4dc61786-f31a-414a-9afa-b90cb0a4a032'::uuid,'4e969a01-c2b5-4003-8fd0-db34a502be5e'::uuid,'547615ab-7140-4ab3-96d4-d34de4841525'::uuid,'823f09e5-f6c1-4995-9189-ee7f7479f08e'::uuid,'9dbae7d3-4773-4319-b675-b7f04b878036'::uuid,'cb009e8a-d36e-4a4e-950c-300406920e64'::uuid,'cf6a5350-2275-4d7c-8dc2-82af0736d096'::uuid,'cf966057-0661-482f-8382-95639a938b57'::uuid,'efebe68f-e131-4533-bdc9-0804b9f97456'::uuid,'f66f2fd0-9611-4fd3-b289-47adfee59fda'::uuid,'fab3b6a5-9cdf-4b5a-b441-8bb866c71909'::uuid,'fc5dfbfb-4739-4b03-bddc-9553c4045ae8'::uuid]::uuid[] as users,array['0752c60c-b3fb-4ce0-b370-402f79e7931c'::uuid,'453d64f8-1f82-4122-8f8f-dec01a41ca14'::uuid,'4edaf423-7ac3-4b68-925a-348e08a37d00'::uuid,'65ba178a-8400-4f29-a471-328197129aed'::uuid,'6db79011-5402-4884-898b-5eea8b75c488'::uuid,'80d3493f-d801-43bc-804d-fc0933273e16'::uuid,'820d917b-2702-4070-be64-ff2026b9af02'::uuid,'8dba7573-a3c0-45fb-a6e9-66aae3a5afd4'::uuid,'95109c8d-32a5-4aac-b545-5da8fed7acdf'::uuid,'a2b41146-80f1-47ae-a4e5-63a760937a35'::uuid,'c45bb89c-c627-4af0-9528-1ddaee2ea320'::uuid,'e6922818-9a2b-46cc-83dc-c53d2bd974c9'::uuid,'f3e640a6-92c7-4f65-89ea-16bbb0d4e837'::uuid]::uuid[] as games)
select jsonb_build_object('scope','gameplay-refinement','noSecrets',true,
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
