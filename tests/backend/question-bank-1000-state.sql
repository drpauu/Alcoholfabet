-- Administrative observation only: no answer text, tokens or game mutations.
select jsonb_build_object(
  'projectRef','lhgyopkwstuyxolwfucq',
  'checkedAt',now(),
  'manifests',(select jsonb_agg(jsonb_build_object('version',version,'status',status,'imported',imported_rows,'approved',approved_rows,'draft',draft_rows,'activatedAt',activated_at)) from private.question_bank_imports),
  'rowCounts',(select jsonb_object_agg(source_version,n) from(select source_version,count(*)n from public.questions group by source_version)c),
  'pools',(select jsonb_agg(to_jsonb(c))from(select pool,count(*)imported,count(*)filter(where active)active,count(*)filter(where not active)draft,count(distinct semantic_key)filter(where active)active_facts from public.questions where source_version='excel-1000-20261010-v1'group by pool)c),
  'matchingValidationProofs',(select count(*)from private.question_bank_validations v join public.questions q on q.id=v.question_id and md5(to_jsonb(q)::text)=v.row_md5 where v.version='excel-1000-20261010-v1'),
  'historicalLinks',(select count(*)from private.question_semantic_aliases),
  'oldBankMd5',(select md5(string_agg(to_jsonb(q)::text,''order by id)) from public.questions q where source_version<>'excel-1000-20261010-v1'),
  'gamesByBank',(select jsonb_agg(to_jsonb(c))from(select question_bank_version,status,count(*)games from public.games group by question_bank_version,status)c),
  'score',(select jsonb_agg(jsonb_build_object('couple',c.slug,'pauWins',(select count(*)from public.match_results r where r.couple_id=c.id and winner='PAU'),'teclaWins',(select count(*)from public.match_results r where r.couple_id=c.id and winner='TECLA'),'completedGames',(select count(*)from public.match_results r where r.couple_id=c.id)))from public.couples c),
  'orphanQuestions',(select count(*)from public.games g left join public.questions q on q.id=g.current_question_id where g.current_question_id is not null and q.id is null),
  'orphanUsage',(select count(*)from public.game_question_usage u left join public.questions q on q.id=u.question_id where q.id is null),
  'privilegedLinksOnly',not has_function_privilege('authenticated','public.admin_link_question_bank_concepts(text,text,jsonb)','execute') and not has_function_privilege('anon','public.admin_link_question_bank_concepts(text,text,jsonb)','execute')
) report;
