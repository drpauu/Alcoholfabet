-- Real Postgres integration with isolated fixtures. The exception subtransaction
-- rolls back every row (including the temporary active bank); no live reset.
create or replace function pg_temp.run_question_bank_regression()
returns jsonb language plpgsql as $$
declare
 v_checks text[]:='{}'; v_report jsonb; v_user uuid:=gen_random_uuid(); v_couple uuid:=gen_random_uuid();
 v_game uuid:=gen_random_uuid(); v_hist uuid; v_pool public.question_pool; v_question text;
 v_prev_answer text; v_answer text; v_prev_sub text; v_sub text; v_streak integer:=0;
 v_n integer:=0; v_start timestamptz; v_times double precision[]:='{}'; v_version text;
 v_count integer; v_variant text; v_error boolean; v_active_version text;
begin
 if (select count(*) from public.questions where source_version='canonical-5000-20261009-v1')<>5000 then raise exception 'PACKAGE_COUNT'; end if;
 if exists(select 1 from public.questions where answer_word_count not between 1 and 5 or difficulty not between 1 and 7) then raise exception 'BAD_WORDS_OR_DIFFICULTY'; end if;
 if (select count(*) from public.questions where source_version='legacy-130')<>130 then raise exception 'LEGACY_COUNT'; end if;
 if exists(select 1 from public.questions group by external_id having count(*)>1) then raise exception 'DUPLICATE_EXTERNAL_ID'; end if;
 if exists(select 1 from (values('PAU'::public.question_pool,1300),('TECLA',1300),('TECLA_PAU',750),('PAU_TECLA',750),('TP',900)) p(pool,n)
   where (select count(*) from public.questions q where q.source_version='canonical-5000-20261009-v1' and q.pool=p.pool)<>p.n) then raise exception 'POOL_COUNTS'; end if;
 v_checks:=array_append(v_checks,'5000 package + 130 legacy; exact five pools, unique external IDs, answers 1–5 words, difficulty 1–7');
 if has_function_privilege('authenticated','public.admin_upsert_question_bank_batch(text,text,jsonb)','execute')
 or has_function_privilege('anon','public.admin_finalize_question_bank(text,text)','execute')
 or has_function_privilege('authenticated','public.pick_unused_question(uuid,public.question_pool)','execute') then raise exception 'CLIENT_ADMIN_PRIVILEGE'; end if;
 if has_table_privilege('authenticated','public.game_question_usage','select') then raise exception 'FACT_METADATA_LEAK'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename in ('questions','game_question_usage')) then raise exception 'ANSWERS_READ_POLICY'; end if;
 if exists(select 1 from pg_class where oid in('public.questions'::regclass,'public.game_question_usage'::regclass)and not relrowsecurity) then raise exception 'NO_RLS'; end if;
 v_checks:=array_append(v_checks,'RLS and default-deny bank; administrative import and selector inaccessible to clients');
 begin
  insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at)values(v_user,'authenticated','authenticated',true,now(),now());
  insert into public.couples(id,slug,display_name)values(v_couple,'question-bank-qa-'||v_couple,'Question bank QA');
  insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,created_by)
    values(v_game,v_couple,'IN_PERSON','ACTIVE',20,13,'PAU','PAU',v_user);
  -- Production bank, sequential usage in all pools; select and consume one
  -- question at a time exactly as BEGIN_TURN does. No local bank selector.
  for v_n in 1..150 loop
   v_pool:=case(v_n%5)when 0 then 'PAU' when 1 then 'TECLA' when 2 then 'TECLA_PAU' when 3 then 'PAU_TECLA' else 'TP' end;
   v_start:=clock_timestamp();v_question:=public.pick_unused_question(v_game,v_pool);
   v_times:=array_append(v_times,extract(epoch from clock_timestamp()-v_start)*1000);
   select normalized_answer,subtopic into v_answer,v_sub from public.questions where id=v_question;
   if v_answer=v_prev_answer then raise exception 'CONSECUTIVE_ANSWER'; end if;
   v_streak:=case when v_prev_sub=v_sub then v_streak+1 else 1 end;
   if v_streak>2 then raise exception 'SUBTOPIC_STREAK'; end if;
   if exists(select 1 from public.questions where id=v_question and (pool<>v_pool or not active or review_status<>'APPROVED' or source_version<>'canonical-5000-20261009-v1'))then raise exception 'BAD_POOL_OR_REVIEW'; end if;
   insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values(v_game,v_question,v_n,'PAU');
   v_prev_answer:=v_answer;v_prev_sub:=v_sub;
  end loop;
  if (select count(distinct fact_id) from public.game_question_usage where game_id=v_game)<>150
    or(select count(distinct semantic_key) from public.game_question_usage where game_id=v_game)<>150 then raise exception 'REPEATED_FACT'; end if;
  v_checks:=array_append(v_checks,'150 real-bank selections in all five pools: no IDs, facts, inverse capital relation, answer or subtopic repeats');
  -- A different formulation of a consumed fact is rejected by Postgres too.
  select q.id into v_variant from public.questions q join public.game_question_usage u on u.fact_id=q.fact_id
    where u.game_id=v_game and q.id<>u.question_id limit 1;
  v_error:=false;
  begin
   insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values(v_game,v_variant,151,'PAU');
  exception when unique_violation then v_error:=true; end;
  if not v_error then raise exception 'FACT_UNIQUENESS_NOT_ENFORCED'; end if;
  v_checks:=array_append(v_checks,'database rejects another variant even when question_id differs');
  v_report:=jsonb_build_object('selectionLatencyMs',jsonb_build_object('calls',cardinality(v_times),'min',(select min(t) from unnest(v_times)t),'mean',(select avg(t)from unnest(v_times)t),'max',(select max(t)from unnest(v_times)t),'p95',(select percentile_cont(.95)within group(order by t)from unnest(v_times)t)));

  -- A tiny synthetic bank makes recent-window boundaries deterministic. Its
  -- publication is uncommitted and rolled back; other sessions keep live bank.
  select version into v_active_version from private.question_bank_imports where status='ACTIVE';
  update private.question_bank_imports set status='SUPERSEDED' where status='ACTIVE';
  v_version:='qa-'||v_user;
  insert into private.question_bank_imports(version,canonical_sha256,status)values(v_version,repeat('0',64),'ACTIVE');
  insert into public.questions(id,pool,topic,subtopic,difficulty,question_ca,answer_ca,fact_id,semantic_key,source_version,review_status,active,factual_reviewed,language_reviewed)
   select 'qa-'||v_user||'-'||p||'-'||n,p,'QA','Subtema '||n,7,'Pregunta de prova número '||n||'?','Resposta '||n,'qa-fact-'||n,'qa-fact-'||n,v_version,'APPROVED',true,true,true
   from unnest(enum_range(null::public.question_pool))p cross join generate_series(1,11)n;
  -- Each of 11 preceding games consumes a distinct fact. Different pools in
  -- history still exclude the same fact in the requested pool.
  v_couple:=gen_random_uuid();v_game:=gen_random_uuid();
  insert into public.couples(id,slug,display_name)values(v_couple,'question-bank-qa-'||v_couple,'Question bank QA');
  insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,created_by)
    values(v_game,v_couple,'IN_PERSON','ACTIVE',20,13,'PAU','PAU',v_user);
  for v_n in 1..11 loop
   v_hist:=gen_random_uuid();
   insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,created_by,last_action_at)
    values(v_hist,v_couple,'IN_PERSON','ABANDONED',20,13,'PAU','PAU',v_user,now()-v_n*interval '1 minute');
   insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)
    values(v_hist,'qa-'||v_user||'-TP-'||v_n,1,'PAU');
  end loop;
  foreach v_pool in array array['PAU','TECLA','TP']::public.question_pool[]loop
   v_question:=public.pick_unused_question(v_game,v_pool);
   if(select fact_id from public.questions where id=v_question)<>'qa-fact-11' then raise exception 'RECENT_TEN_WINDOW'; end if;
  end loop;
  foreach v_pool in array array['PAU_TECLA','TECLA_PAU']::public.question_pool[]loop
   for v_n in 1..25 loop
    v_question:=public.pick_unused_question(v_game,v_pool);
    if(select substring(fact_id from '([0-9]+)$')::integer from public.questions where id=v_question)<=5 then raise exception 'RECENT_FIVE_WINDOW'; end if;
   end loop;
  end loop;
  v_checks:=array_append(v_checks,'last 10 games for personal/TP; last 5 for crossed; facts excluded across pools and abandoned games included');
  insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values(v_game,'qa-'||v_user||'-PAU-11',1,'PAU');
  v_question:=public.pick_unused_question(v_game,'PAU');
  if(select fact_id from public.questions where id=v_question)<>'qa-fact-10' then raise exception 'FALLBACK_NOT_OLDEST'; end if;
  v_checks:=array_append(v_checks,'controlled fallback selects the oldest last occurrence, never current-match facts');
  insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)
   select v_game,id,12-substring(fact_id from '([0-9]+)$')::integer,'PAU' from public.questions
   where source_version=v_version and pool='PAU' and fact_id<>'qa-fact-11';
  v_error:=false;begin perform public.pick_unused_question(v_game,'PAU');exception when others then if sqlerrm='QUESTION_POOL_EMPTY'then v_error:=true;else raise;end if;end;
  if not v_error then raise exception 'EXHAUSTION_REPEATED_FACT'; end if;
  v_checks:=array_append(v_checks,'true exhaustion returns QUESTION_POOL_EMPTY, with no repetition fallback');
  -- Same answer under a new fact ID is still blocked.
  insert into public.questions(id,pool,topic,subtopic,difficulty,question_ca,answer_ca,fact_id,source_version,review_status,active,factual_reviewed,language_reviewed)
    values('qa-'||v_user||'-answer','PAU','QA','Nou subtema',7,'Una pregunta amb una resposta ja vista?',
    (select q.answer_ca from public.game_question_usage u join public.questions q on q.id=u.question_id where u.game_id=v_game order by u.turn_number desc,u.used_at desc,u.id desc limit 1),'qa-new-answer',v_version,'APPROVED',true,true,true);
  v_error:=false;begin perform public.pick_unused_question(v_game,'PAU');exception when others then if sqlerrm='QUESTION_POOL_EMPTY'then v_error:=true;else raise;end if;end;
  if not v_error then raise exception 'ANSWER_FILTER_RELAXED'; end if;
  v_checks:=array_append(v_checks,'same-answer exclusion remains hard during exhaustion');
  -- An inverse formulation has a different fact_id but the same semantic key.
  insert into public.questions(id,pool,topic,subtopic,difficulty,question_ca,answer_ca,fact_id,semantic_key,source_version,review_status,active,factual_reviewed,language_reviewed)
    values('qa-'||v_user||'-inverse','TECLA','QA','Nova relació',7,'La mateixa relació preguntada a l’inrevés?',
    'Resposta inversa','qa-inverse-fact','qa-fact-11',v_version,'APPROVED',true,true,true);
  v_error:=false;begin
    insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values(v_game,'qa-'||v_user||'-inverse',50,'TECLA');
   exception when unique_violation then v_error:=true;end;
  if not v_error then raise exception 'INVERSE_SEMANTIC_REPEAT';end if;
  v_checks:=array_append(v_checks,'inverse formulations with different fact IDs are rejected by a second unique semantic constraint');
  -- Hard subtopic restriction, even with only one unconsumed candidate.
  v_couple:=gen_random_uuid();v_game:=gen_random_uuid();
  insert into public.couples(id,slug,display_name)values(v_couple,'question-bank-qa-'||v_couple,'Question bank QA');
  insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,created_by)
    values(v_game,v_couple,'IN_PERSON','ACTIVE',20,13,'PAU','PAU',v_user);
  update public.questions set subtopic='Mateix subtema'where source_version=v_version and pool='PAU';
  update public.questions set review_status='DRAFT',active=false where source_version=v_version and pool='PAU'and fact_id not in('qa-fact-1','qa-fact-2','qa-fact-3');
  insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values
   (v_game,'qa-'||v_user||'-PAU-1',1,'PAU'),(v_game,'qa-'||v_user||'-PAU-2',2,'PAU');
  v_error:=false;begin perform public.pick_unused_question(v_game,'PAU');exception when others then if sqlerrm='QUESTION_POOL_EMPTY'then v_error:=true;else raise;end if;end;
  if not v_error then raise exception 'SUBTOPIC_FILTER_RELAXED';end if;
  v_checks:=array_append(v_checks,'third consecutive identical subtopic is blocked and DRAFT candidates never rescue exhaustion');
  -- Map an old concept while keeping its original usage snapshot.
  v_couple:=gen_random_uuid();v_game:=gen_random_uuid();
  insert into public.couples(id,slug,display_name)values(v_couple,'question-bank-qa-'||v_couple,'Question bank QA');
  insert into public.games(id,couple_id,mode,status,target_minutes,finish_position,starting_player,current_turn,created_by)
    values(v_game,v_couple,'IN_PERSON','ACTIVE',20,13,'PAU','PAU',v_user);
  update public.questions set review_status='DRAFT',active=false where source_version=v_version and pool='PAU';
  update public.questions set review_status='APPROVED',active=true,subtopic='Subtema distint'where source_version=v_version and pool='PAU'and fact_id in('qa-fact-1','qa-fact-2');
  insert into public.questions(id,pool,topic,subtopic,difficulty,question_ca,answer_ca,fact_id,semantic_key,source_version,review_status,active,factual_reviewed,language_reviewed)
    values('qa-'||v_user||'-legacy','TP','QA','Històric',7,'Una formulació històrica equivalent?',
    'Nom antic','legacy-qa-fact','qa-fact-1',v_version,'APPROVED',true,true,true);
  insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values(v_game,'qa-'||v_user||'-legacy',1,'PAU');
  update public.game_question_usage set semantic_key='legacy-snapshot'where game_id=v_game;
  v_question:=public.pick_unused_question(v_game,'PAU');
  if(select fact_id from public.questions where id=v_question)<>'qa-fact-2'then raise exception 'LEGACY_RESOLVED_FACT_REPEATED';end if;
  v_checks:=array_append(v_checks,'mapped legacy concept excluded while the original historical usage snapshot is preserved');
  raise exception using errcode='P0099',message='ROLLBACK_QA_FIXTURES';
 exception when sqlstate 'P0099' then null;
 end;
 if exists(select 1 from auth.users where id=v_user)or exists(select 1 from public.questions where source_version=v_version)then raise exception 'QA_LEAK';end if;
 return v_report||jsonb_build_object('status','PASS','checks',to_jsonb(v_checks),'fixturesRolledBack',true,'legacyRows',130,'packageRows',5000);
end; $$;
select pg_temp.run_question_bank_regression() as report;
