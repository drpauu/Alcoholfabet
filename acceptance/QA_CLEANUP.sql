begin;
lock table public.games in share row exclusive mode;
lock table auth.users in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_qa_cleanup_result;
create temporary table tecla_pau_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[]:=array['05c2a3e6-3ed3-4cb8-90ad-9546d7bc8496'::uuid,'0b6a7049-6d3b-4299-bd1f-bc11437f3556'::uuid,'18daea1e-98fb-4393-86bd-ffadc726c01f'::uuid,'1a81e92f-e6b2-4941-b187-373f2c3640a6'::uuid,'1ee12845-932f-43fe-bd17-dd398344f535'::uuid,'24618b64-9e05-403e-8b5d-55607a5f2daa'::uuid,'404fc39f-faca-416e-b505-c6b8c28bbd32'::uuid,'4613ab2f-8a65-4eb5-abae-6c12bc76f93d'::uuid,'52d7cf07-5f4e-40dd-adc3-45f520fcfb10'::uuid,'5e4feeea-3dc4-4337-948f-417e99bd328d'::uuid,'68467619-7d38-43dd-a650-c30ca04e218b'::uuid,'766e8e3b-1b21-49eb-969f-f3e834b430bf'::uuid,'7935f0e6-1145-4f3a-9f1a-cbac44733f91'::uuid,'8ce2c44b-bc41-4fbd-940d-c0f9b715de29'::uuid,'8ef90938-596d-4247-ac43-83a3c4f7973d'::uuid,'a0d0c9f4-f7bb-4585-98d5-72a3dd2e9dfe'::uuid,'a39ef06c-bbb2-4579-bbbc-ed78876cea2d'::uuid,'b0625f9b-c330-4957-9660-770a85a58f61'::uuid,'c437b26b-23c7-4ff3-8e38-b551a8c84e5a'::uuid,'c75dc1df-030d-41f0-83f5-120a9a627432'::uuid,'ca873f92-3079-4cd5-9b51-b73b9a9d477b'::uuid,'e18ce774-567b-48fa-aa7f-09c3cf2c4cc7'::uuid,'eaf56ba1-31eb-49da-a272-502d668ccba7'::uuid,'f67c4d8a-dc2d-4969-95fb-799ffa88e618'::uuid];
  v_games uuid[]:=array['059b297e-89e5-448f-8005-b3a7c8ab8efa'::uuid,'0d48f1c2-2dbb-4066-9327-df23cd8863cb'::uuid,'0fce58ba-6ae0-4875-9e88-7c1b0742f1a1'::uuid,'130e2168-7496-433f-9530-a885c2e20cd8'::uuid,'14e7697d-a6fd-4999-8d61-b0daa4256594'::uuid,'171290d3-93a7-48a4-b260-31d8de9af724'::uuid,'1f1acce1-477e-401c-8c5b-83e63dc9fcd6'::uuid,'2c95b058-ec2e-4ad5-8b62-aa98ff268bba'::uuid,'2e659bfa-aa42-4282-b3ed-bdbb7551278e'::uuid,'30906114-65fc-423d-a710-25b78d257f4b'::uuid,'37c979a0-aa00-492b-8715-f3ca05e413d4'::uuid,'3963d92f-d0ea-4d06-9dd3-e00b86be3d8f'::uuid,'3a576040-767c-4154-af45-372dc62c5300'::uuid,'3f313c70-1cb8-495e-98c2-c2fb9f861e44'::uuid,'41a5e930-d365-47c0-9c3d-50baa4848970'::uuid,'44419b23-64af-46fc-9e23-872d90182e79'::uuid,'5abacb14-90aa-472d-bd34-cc9979378017'::uuid,'60fda820-5a33-4694-ada2-aedc80005f74'::uuid,'6f15a87d-8c57-4713-962d-6efb68ccf640'::uuid,'7b6c08c0-4741-4b9f-971b-386c7657a998'::uuid,'857e52f9-4e7a-4571-abf2-447f77a0eed2'::uuid,'8b8c12c8-91f3-44f6-beb6-378e9f819070'::uuid,'8f86962c-84e8-40f7-99c7-247a7a2a9a2a'::uuid,'95ecc07a-92d6-4bb0-9f66-e177999ca609'::uuid,'9760614a-8838-42c8-803b-8034c3480441'::uuid,'a29c89a6-6490-43a0-8298-ed0241fe87fa'::uuid,'aebb5b15-8195-4c75-9ec8-5e0e5b37b6fb'::uuid,'bf3b611f-8201-4f7f-84ab-bef143ccdfaa'::uuid,'c3813f72-0cab-47cb-b4de-383554f48f67'::uuid,'c505fad9-ac46-4927-a91c-877618e66102'::uuid,'c5a22ca4-d568-453d-84f7-99ea8fd4d70e'::uuid,'cc046695-cd1c-403b-aa8c-d279a30df24f'::uuid,'cd39a957-24ab-4eb6-a3d8-4528ad8d76bd'::uuid,'d19cd501-ae9a-4dc2-b1f4-cf4b9905aacf'::uuid,'d8e50c18-fd35-4fe6-b1bd-fd1f486c36a3'::uuid,'df27c3ce-17cb-4341-83e1-812c7af92e32'::uuid,'e5b25d16-11c8-425c-a362-e08747ca8e49'::uuid,'ea96af43-7903-463d-9d6f-0d75064f7434'::uuid,'ee9f47cd-9b5e-4d71-a486-436a398a6e67'::uuid];
  v_before_couples jsonb;
  v_before_questions jsonb;
  v_before_hash_config jsonb;
  v_other_users uuid[];
  v_other_games uuid[];
  v_deleted_games integer;
  v_deleted_users integer;
  v_deleted_results integer;
  v_remaining_users integer;
  v_remaining_games integer;
  v_remaining_devices integer;
  v_score jsonb;
begin
  if exists(select 1 from public.games where created_by=any(v_users) and not(id=any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_GAMES';
  end if;
  if exists(select 1 from public.game_members where user_id=any(v_users) and not(game_id=any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_MEMBERSHIPS';
  end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into v_before_couples from public.couples c;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') into v_before_questions from public.questions q;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id),'[]') into v_before_hash_config from private.couple_access_config h;
  select coalesce(array_agg(id),'{}') into v_other_users from auth.users where not(id=any(v_users));
  select coalesce(array_agg(id),'{}') into v_other_games from public.games where not(id=any(v_games));
  select count(*) into v_deleted_results from public.match_results where game_id=any(v_games);
  delete from public.games where id=any(v_games);
  get diagnostics v_deleted_games=row_count;
  delete from auth.users where id=any(v_users);
  get diagnostics v_deleted_users=row_count;
  select count(*) into v_remaining_users from auth.users where id=any(v_users);
  select count(*) into v_remaining_games from public.games where id=any(v_games);
  select count(*) into v_remaining_devices from public.authorized_devices where user_id=any(v_users);
  if v_remaining_users<>0 or v_remaining_games<>0 or v_remaining_devices<>0 then raise exception 'QA_CLEANUP_INCOMPLETE'; end if;
  if exists(select 1 from unnest(v_other_users) as original(id) where not exists(select 1 from auth.users u where u.id=original.id))
    or exists(select 1 from unnest(v_other_games) as original(id) where not exists(select 1 from public.games g where g.id=original.id)) then
    raise exception 'QA_CLEANUP_MODIFIED_UNLISTED_RECORDS';
  end if;
  if v_before_couples is distinct from (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.couples c)
    or v_before_questions is distinct from (select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') from public.questions q)
    or v_before_hash_config is distinct from (select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id),'[]') from private.couple_access_config h) then
    raise exception 'QA_CLEANUP_MODIFIED_PRODUCTION_FOUNDATIONS';
  end if;
  select jsonb_build_object('pauWins',count(*) filter(where winner='PAU'),'teclaWins',count(*) filter(where winner='TECLA'),'completedGames',count(*))
    into v_score from public.match_results where couple_id=(select id from public.couples where slug='pau-tecla');
  insert into tecla_pau_qa_cleanup_result values(jsonb_build_object(
    'completedAt',now(),'status','COMPLETE','projectRef','lhgyopkwstuyxolwfucq','noSecrets',true,
    'requestedUsers',cardinality(v_users),'requestedGames',cardinality(v_games),
    'deletedUsers',v_deleted_users,'deletedGames',v_deleted_games,'deletedMatchResults',v_deleted_results,
    'remainingQaUsers',v_remaining_users,'remainingQaGames',v_remaining_games,'remainingQaAuthorizedDevices',v_remaining_devices,
    'preservedOtherUsers',cardinality(v_other_users),'preservedOtherGames',cardinality(v_other_games),
    'couplePreserved',true,'questionsPreserved',true,'accessHashPreserved',true,'unlistedRecordsPreserved',true,
    'scoreboard',v_score,'questions',(select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_qa_cleanup_result;\n