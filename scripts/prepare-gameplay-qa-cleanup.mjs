import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Produces SQL scoped to this task's explicit UUIDs. Run after active QA ends.
const directory = join(process.cwd(), 'acceptance/gameplay-refinement');
const sources = ['QA_E2E_MANIFEST.json'];
const users = new Set(), games = new Set();
const sourceHashes = {};
for (const source of sources) {
  const path = join(directory, source);
  if (!existsSync(path)) continue;
  const contents = await readFile(path, 'utf8');
  sourceHashes[source] = createHash('sha256').update(contents).digest('hex');
  const manifest = JSON.parse(contents);
  for (const userId of manifest.userIds ?? []) users.add(userId);
  for (const gameId of manifest.gameIds ?? []) games.add(gameId);
  if (Array.isArray(manifest)) for (const row of manifest) { users.add(row.userId); games.add(row.gameId); }
}
const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for (const id of [...users, ...games]) if (!validUuid.test(id)) throw new Error('QA_CLEANUP_INVALID_UUID');
if (users.size === 0 || games.size === 0) throw new Error('QA_CLEANUP_REQUIRES_EXPLICIT_FIXTURES');
const array = (ids) => `array[${[...ids].sort().map((id) => `'${id}'::uuid`).join(',')}]::uuid[]`;
const sql = `begin;
lock table public.games in share row exclusive mode;
lock table auth.users,auth.sessions,auth.identities,auth.refresh_tokens,public.game_cells,public.game_members,public.game_events,public.game_question_usage,public.match_results,public.authorized_devices,public.couple_admins,private.access_attempts in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_gameplay_qa_cleanup_result;
create temporary table tecla_pau_gameplay_qa_cleanup_result(report jsonb) on commit preserve rows;
do $cleanup$
declare
  v_users uuid[] := ${array(users)};
  v_games uuid[] := ${array(games)};
  v_before_couples jsonb;
  v_before_questions jsonb;
  v_before_hash_config jsonb;
  v_other_users jsonb;
  v_other_games jsonb;
  v_other_results jsonb;
  v_deleted_games integer;
  v_deleted_users integer;
  v_deleted_results integer;
  v_remaining_users integer;
  v_remaining_games integer;
  v_remaining_devices integer;
  v_score jsonb;
  v_entity record;
  v_snapshot jsonb;
  v_snapshots jsonb := '{}';
  v_matrix jsonb := '{}';
  v_scope_ids uuid[];
begin
  if exists(select 1 from auth.users where id=any(v_users) and is_anonymous is distinct from true)
    or exists(select 1 from public.couple_admins where user_id=any(v_users)) then
    raise exception 'QA_CLEANUP_BLOCKED_NON_ANONYMOUS_OR_ADMIN_USER';
  end if;
  if exists(select 1 from public.games where created_by = any(v_users) and not(id = any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_GAMES';
  end if;
  if exists(select 1 from public.game_members where user_id = any(v_users) and not(game_id = any(v_games))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_MEMBERSHIPS';
  end if;
  if exists(select 1 from public.games where id = any(v_games) and not(created_by = any(v_users)))
    or exists(select 1 from public.game_members where game_id = any(v_games) and not(user_id = any(v_users))) then
    raise exception 'QA_CLEANUP_BLOCKED_UNLISTED_OWNER_OR_MEMBER';
  end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]') into v_before_couples from public.couples c;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') into v_before_questions from public.questions q;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id), '[]') into v_before_hash_config from private.couple_access_config h;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]') into v_other_users from auth.users u where not(id = any(v_users));
  select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]') into v_other_games from public.games g where not(id = any(v_games));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') into v_other_results from public.match_results r where not(game_id = any(v_games));
  for v_entity in select * from (values
    ('public.game_cells','game_id','games'),('public.game_members','game_id','games'),
    ('public.game_events','game_id','games'),('public.game_question_usage','game_id','games'),
    ('public.authorized_devices','user_id','users'),('auth.sessions','user_id','users'),
    ('auth.identities','user_id','users'),('auth.refresh_tokens','user_id','users'),
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users')
  ) as entities(table_name,key_name,scope_name) loop
    v_scope_ids := case when v_entity.scope_name='games' then v_games else v_users end;
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %s t where %s is null or not(%s::text=any($1::text[]))',v_entity.table_name,v_entity.key_name,v_entity.key_name)
      into v_snapshot using v_scope_ids;
    v_snapshots := v_snapshots || jsonb_build_object(v_entity.table_name,v_snapshot);
  end loop;
  select count(*) into v_deleted_results from public.match_results where game_id = any(v_games);
  delete from public.games where id = any(v_games);
  get diagnostics v_deleted_games = row_count;
  delete from auth.refresh_tokens where user_id=any(v_users::text[]);
  delete from auth.users where id = any(v_users);
  get diagnostics v_deleted_users = row_count;
  select count(*) into v_remaining_users from auth.users where id = any(v_users);
  select count(*) into v_remaining_games from public.games where id = any(v_games);
  select count(*) into v_remaining_devices from public.authorized_devices where user_id = any(v_users);
  if v_remaining_users <> 0 or v_remaining_games <> 0 or v_remaining_devices <> 0 then raise exception 'QA_CLEANUP_INCOMPLETE'; end if;
  if v_other_users is distinct from (select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]') from auth.users u)
    or v_other_games is distinct from (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]') from public.games g)
    or v_other_results is distinct from (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') from public.match_results r) then
    raise exception 'QA_CLEANUP_MODIFIED_UNLISTED_RECORDS';
  end if;
  if v_before_couples is distinct from (select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]') from public.couples c)
    or v_before_questions is distinct from (select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') from public.questions q)
    or v_before_hash_config is distinct from (select coalesce(jsonb_agg(to_jsonb(h) order by h.couple_id), '[]') from private.couple_access_config h) then
    raise exception 'QA_CLEANUP_MODIFIED_PRODUCTION_FOUNDATIONS';
  end if;
  for v_entity in select * from (values
    ('public.game_cells','game_id','games'),('public.game_members','game_id','games'),
    ('public.game_events','game_id','games'),('public.game_question_usage','game_id','games'),
    ('public.authorized_devices','user_id','users'),('auth.sessions','user_id','users'),
    ('auth.identities','user_id','users'),('auth.refresh_tokens','user_id','users'),
    ('public.couple_admins','user_id','users'),('private.access_attempts','user_id','users')
  ) as entities(table_name,key_name,scope_name) loop
    v_scope_ids := case when v_entity.scope_name='games' then v_games else v_users end;
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from %s t',v_entity.table_name)
      into v_snapshot;
    if v_snapshot is distinct from v_snapshots->v_entity.table_name then raise exception 'QA_CLEANUP_MODIFIED_UNLISTED_RELATED_ROWS'; end if;
    v_matrix := v_matrix || jsonb_build_object(v_entity.table_name,jsonb_build_object('status','PASS','preservedRows',jsonb_array_length(v_snapshot),'remainingQaRows',0));
  end loop;
  select jsonb_build_object('pauWins', count(*) filter(where winner = 'PAU'), 'teclaWins', count(*) filter(where winner = 'TECLA'), 'completedGames', count(*))
    into v_score from public.match_results where couple_id = (select id from public.couples where slug = 'pau-tecla');
  insert into tecla_pau_gameplay_qa_cleanup_result values(jsonb_build_object(
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'gameplay-refinement', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
    'requestedUsers', cardinality(v_users), 'requestedGames', cardinality(v_games),
    'deletedUsers', v_deleted_users, 'deletedGames', v_deleted_games, 'deletedMatchResults', v_deleted_results,
    'remainingQaUsers', v_remaining_users, 'remainingQaGames', v_remaining_games, 'remainingQaAuthorizedDevices', v_remaining_devices,
    'preservedOtherUsers', jsonb_array_length(v_other_users), 'preservedOtherGames', jsonb_array_length(v_other_games),
    'preservedOtherMatchResults', jsonb_array_length(v_other_results),
    'couplePreserved', true, 'questionsPreserved', true, 'accessHashPreserved', true, 'unlistedRowsUnchanged', true, 'relatedTableVerification',v_matrix,
    'scoreboard', v_score, 'questionCount', (select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_gameplay_qa_cleanup_result;
`;
await writeFile(join(directory, 'QA_CLEANUP.sql'), sql);
const preflight = `with scope as (select ${array(users)} as users,${array(games)} as games)
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
`;
await writeFile(join(directory, 'QA_CLEANUP_PREFLIGHT.sql'), preflight);
await writeFile(join(directory, 'QA_CLEANUP_MANIFEST.json'), JSON.stringify({ scope: 'gameplay-refinement', generatedAt: new Date().toISOString(), sources, sourceHashes, cleanupSqlSha256:createHash('sha256').update(sql).digest('hex'), preflightSqlSha256:createHash('sha256').update(preflight).digest('hex'), userIds: [...users].sort(), gameIds: [...games].sort(), noSecrets: true, executed: false }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: true, executed: false, users: users.size, games: games.size, noSecrets: true }));
