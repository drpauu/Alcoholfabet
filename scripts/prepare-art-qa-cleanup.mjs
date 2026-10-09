import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Produces reviewable SQL; execution requires the task owner's final approval.
const directory = join(process.cwd(), 'acceptance/art-redesign');
const before = JSON.parse(await readFile(join(directory, 'DATABASE_BEFORE.json'), 'utf8'));
const baseline = JSON.parse(await readFile('audit/art-redesign-before/before-visual-metrics.json', 'utf8'));
const sources = ['QA_MANIFEST.json', 'QA_E2E_MANIFEST.json', 'QA_MOTION_MANIFEST.json'];
const users = new Set(), games = new Set();
for (const source of sources) {
  const path = join(directory, source);
  if (!existsSync(path)) continue;
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  for (const userId of manifest.userIds ?? []) users.add(userId);
  for (const gameId of manifest.gameIds ?? []) games.add(gameId);
  if (Array.isArray(manifest)) for (const row of manifest) { users.add(row.userId); games.add(row.gameId); }
}
const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for (const id of [...users, ...games]) if (!validUuid.test(id)) throw new Error('QA_CLEANUP_INVALID_UUID');
for (const id of before.userIds) if (id !== baseline.userId && users.has(id)) throw new Error('QA_CLEANUP_PROTECTED_USER');
for (const row of before.games) if (row.id !== baseline.gameId && games.has(row.id)) throw new Error('QA_CLEANUP_PROTECTED_GAME');
const array = (ids) => `array[${[...ids].sort().map((id) => `'${id}'::uuid`).join(',')}]::uuid[]`;
const sql = `begin;
lock table public.games in share row exclusive mode;
lock table auth.users in share row exclusive mode;
drop table if exists pg_temp.tecla_pau_art_qa_cleanup_result;
create temporary table tecla_pau_art_qa_cleanup_result(report jsonb) on commit preserve rows;
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
begin
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
  select count(*) into v_deleted_results from public.match_results where game_id = any(v_games);
  delete from public.games where id = any(v_games);
  get diagnostics v_deleted_games = row_count;
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
  select jsonb_build_object('pauWins', count(*) filter(where winner = 'PAU'), 'teclaWins', count(*) filter(where winner = 'TECLA'), 'completedGames', count(*))
    into v_score from public.match_results where couple_id = (select id from public.couples where slug = 'pau-tecla');
  insert into tecla_pau_art_qa_cleanup_result values(jsonb_build_object(
    'completedAt', now(), 'status', 'COMPLETE', 'scope', 'art-redesign', 'projectRef', 'lhgyopkwstuyxolwfucq', 'noSecrets', true,
    'requestedUsers', cardinality(v_users), 'requestedGames', cardinality(v_games),
    'deletedUsers', v_deleted_users, 'deletedGames', v_deleted_games, 'deletedMatchResults', v_deleted_results,
    'remainingQaUsers', v_remaining_users, 'remainingQaGames', v_remaining_games, 'remainingQaAuthorizedDevices', v_remaining_devices,
    'preservedOtherUsers', jsonb_array_length(v_other_users), 'preservedOtherGames', jsonb_array_length(v_other_games),
    'preservedOtherMatchResults', jsonb_array_length(v_other_results),
    'couplePreserved', true, 'questionsPreserved', true, 'accessHashPreserved', true, 'unlistedRowsUnchanged', true,
    'scoreboard', v_score, 'questionCount', (select count(*) from public.questions)));
end;
$cleanup$;
commit;
select report from pg_temp.tecla_pau_art_qa_cleanup_result;
`;
await writeFile(join(directory, 'QA_CLEANUP.sql'), sql);
await writeFile(join(directory, 'QA_CLEANUP_MANIFEST.json'), JSON.stringify({ scope: 'art-redesign', generatedAt: new Date().toISOString(), sources, userIds: [...users].sort(), gameIds: [...games].sort(), baselineExplicitlyAllowed: { userId: baseline.userId, gameId: baseline.gameId }, expectedExistingScoreboard: before.scoreboard, noSecrets: true, executed: false }, null, 2) + '\n');
console.log(JSON.stringify({ prepared: true, executed: false, users: users.size, games: games.size, noSecrets: true }));
