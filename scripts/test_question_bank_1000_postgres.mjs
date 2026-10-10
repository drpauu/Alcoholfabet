#!/usr/bin/env node
/** Local PostgreSQL preflight; PGlite is a QA-only tool installed outside repo.
 * Run: PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node ...
 * Auth/Realtime transport are absent here; live rollback tests cover those. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadWorkbookBank, prepareSql, batchSql, finalizeSql, linksSql } from './import_questions_1000.mjs';
const modulePath = process.env.PGLITE_MODULE ?? join(homedir(), '.local/share/tecla-pau/qa-postgres/node_modules/@electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite(), bank = await loadWorkbookBank(), checks = [];
const run = async sql => (await db.exec(sql)).at(-1)?.rows?.[0];
const check = name => checks.push(name);
const rejection = async (sql, message) => {
  await assert.rejects(run(sql), error => error.message === message);
};
try {
  await db.exec("create schema auth;create schema private;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);");
  const schema = (await readFile('supabase/migrations/0001_schema.sql', 'utf8')).replace('create extension if not exists pgcrypto;', '');
  await db.exec(schema);
  await db.exec(await readFile('supabase/migrations/0014_question_bank_and_fact_selection.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/0017_question_selection_query_bounds.sql', 'utf8'));
  const legacy = JSON.parse(await readFile('data/questions_approved.json', 'utf8'));
  for (const row of legacy) await db.query('insert into public.questions(id,pool,topic,difficulty,question_ca,answer_ca,review_status,active,factual_reviewed,language_reviewed)values($1,$2,$3,$4,$5,$6,\'APPROVED\',true,true,true)', [row.id, row.pool, row.topic, row.difficulty, row.questionCa, row.answerCa]);
  await db.exec("insert into private.question_bank_imports(version,canonical_sha256,status)values('canonical-5000-20261009-v1',repeat('a',64),'ACTIVE');update public.questions set source_version='canonical-5000-20261009-v1';");
  const old = await run('select md5(string_agg(to_jsonb(q)::text,\'\'order by id)) hash from public.questions q;');
  const user = (await run('insert into auth.users(id)values(gen_random_uuid())returning id;')).id;
  const couple = (await run("select id from public.couples where slug='pau-tecla';")).id;
  const newGame = async () => (await db.query("insert into public.games(couple_id,created_by,mode,status,target_minutes,finish_position,starting_player,current_turn)values($1,$2,'IN_PERSON','ACTIVE',20,13,'PAU','PAU')returning id,question_bank_version", [couple, user])).rows[0];
  const existingGame = (await db.query("insert into public.games(couple_id,created_by,mode,status,target_minutes,finish_position,starting_player,current_turn,state_version,current_question_id)values($1,$2,'IN_PERSON','ACTIVE',20,13,'PAU','PAU',7,'pau_002')returning id", [couple, user])).rows[0].id;
  const existingBefore = await run(`select to_jsonb(g) snapshot from public.games g where id='${existingGame}';`);
  await db.exec(await readFile('supabase/migrations/0018_versioned_question_bank_manifests.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/0019_question_bank_validation_rpc.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/0020_question_bank_historical_concepts_rpc.sql', 'utf8'));
  const after = await run(`select to_jsonb(g)-'question_bank_version' snapshot,question_bank_version from public.games g where id='${existingGame}';`);
  assert.deepEqual(after.snapshot, existingBefore.snapshot);assert.equal(after.question_bank_version,'canonical-5000-20261009-v1');
  check('additive migration preserves existing state, question reference and pinned bank');
  const prepared = (await run(prepareSql(bank))).report;assert.equal(prepared.status,'IMPORTING');
  for(let start=0;start<1000;start+=200)assert.equal((await run(batchSql(bank,start,{stage:true}))).report.rowsChanged,200);
  await rejection(finalizeSql(bank),'BANK_POOL_COUNT_MISMATCH');
  assert.equal((await run("select version from private.question_bank_imports where status='ACTIVE'")).version,'canonical-5000-20261009-v1');
  check('all 1000 staged as inactive drafts; publication rejected before approval');
  for(let start=0;start<1000;start+=200)await run(batchSql(bank,start));
  await rejection(finalizeSql(bank),'BANK_NOT_VALIDATED');check('approval alone cannot activate an unvalidated bank');
  const tampered = { ...bank, rows: bank.rows.map((r,i)=>i===0?{...r,answer_ca:'Una resposta falsa'}:r) };
  await rejection(batchSql(tampered,0,{validate:true}),'BANK_IMPORTED_CONTENT_MISMATCH');check('independent validation rejects altered answers');
  for(let start=0;start<1000;start+=200)assert.equal((await run(batchSql(bank,start,{validate:true}))).report.rowsValidated,200);
  const legacyIds = new Set(legacy.map(row => row.id));
  const linkedBank = { ...bank, links: bank.links.filter(link => legacyIds.has(link.question_id)) };
  assert.equal((await run(linksSql(linkedBank))).report.linksChanged, linkedBank.links.length);
  assert.equal((await run(linksSql(linkedBank))).report.linksChanged, 0);
  await rejection(linksSql({ ...bank, links: [{ question_id: 'unknown-question', semantic_key: bank.rows[0].semantic_key }] }), 'INVALID_CONCEPT_LINKS');
  await rejection(linksSql({ ...bank, links: [{ ...linkedBank.links[0], semantic_key: bank.rows.find(row => row.semantic_key !== linkedBank.links[0].semantic_key).semantic_key }] }), 'CONCEPT_LINK_IMMUTABLE');
  check('historical concept links are validated, idempotent and immutable');
  const activated=(await run(finalizeSql(bank))).report;assert.equal(activated.imported,1000);assert.equal(activated.approved,bank.manifest.approved);
  check('all rows validated and activated atomically with exact manifest pools');
  for(let start=0;start<1000;start+=200)assert.equal((await run(batchSql(bank,start))).report.rowsChanged,0);
  await rejection(batchSql(tampered,0),'BANK_PUBLISHED_IMMUTABLE');
  await rejection(prepareSql({...bank,checksum:'b'.repeat(64)}),'BANK_MANIFEST_MISMATCH');
  check('idempotent reimport changes zero rows; changed published answers/checksums rejected');
  const game=await newGame();assert.equal(game.question_bank_version,bank.version);
  assert.equal((await run(`select source_version from public.questions where id=(select public.pick_unused_question('${existingGame}','PAU'))`)).source_version,'canonical-5000-20261009-v1');
  check('ongoing game continues old bank; new game is pinned to new bank');
  const used=new Set(), answers=[],topics=[];
  for(let turn=1;turn<=150;turn++){
    const pool=['PAU','TECLA','TECLA_PAU','PAU_TECLA','TP'][(turn-1)%5];
    const q=await run(`select id,semantic_key,normalized_answer,subtopic,source_version from public.questions where id=(select public.pick_unused_question('${game.id}','${pool}'))`);
    assert.equal(q.source_version,bank.version);assert.ok(!used.has(q.semantic_key));used.add(q.semantic_key);
    assert.notEqual(q.normalized_answer,answers.at(-1));
    assert.ok(topics.length<2||q.subtopic!==topics.at(-1)||q.subtopic!==topics.at(-2));
    await db.query("insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values($1,$2,$3,'PAU')",[game.id,q.id,turn]);
    answers.push(q.normalized_answer);topics.push(q.subtopic);
  }
  check('150 actual new-bank selections across all pools: no repeated fact, consecutive answer or third subtopic');
  const alias = JSON.parse(await readFile('data/question-bank-1000/historical_concept_links.json','utf8')).find(x=>x.question_id==='pau_002');
  const historicalGame=await newGame();await db.query("insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values($1,'pau_002',1,'PAU')",[historicalGame.id]);
  assert.equal((await run(`select semantic_key from public.game_question_usage where game_id='${historicalGame.id}'`)).semantic_key,alias.semantic_key);
  const originalHistory=await run(`select md5(string_agg(to_jsonb(u)::text,''order by id)) hash from public.game_question_usage u where game_id='${historicalGame.id}'`);
  await rejection(`insert into public.game_question_usage(game_id,question_id,turn_number,responding_player)values('${historicalGame.id}','NEW26-TECLA_PAU-001',2,'PAU')`,'duplicate key value violates unique constraint "game_question_usage_game_semantic_uidx"');
  assert.deepEqual(await run(`select md5(string_agg(to_jsonb(u)::text,''order by id)) hash from public.game_question_usage u where game_id='${historicalGame.id}'`),originalHistory);
  check('private aliases prevent old/new conceptual repetition and preserve existing snapshots');
  for(const role of ['anon','authenticated']){
    const permissions=await db.query("select has_function_privilege($1,'public.admin_prepare_question_bank(text,text,text,text,integer,jsonb)','EXECUTE') prepare,has_function_privilege($1,'public.admin_validate_question_bank_batch(text,text,jsonb)','EXECUTE') validate,has_function_privilege($1,'public.admin_link_question_bank_concepts(text,text,jsonb)','EXECUTE') links,has_table_privilege($1,'private.question_semantic_aliases','SELECT') aliases",[role]);
    assert.deepEqual(permissions.rows[0],{prepare:false,validate:false,links:false,aliases:false});
  }
  check('anonymous/authenticated clients cannot invoke administration or read private aliases');
  assert.deepEqual(await run("select md5(string_agg(to_jsonb(q)::text,''order by id)) hash from public.questions q where source_version='canonical-5000-20261009-v1'"),old);
  check('all old question rows remain byte-identical after replacement');
  await mkdir('acceptance/question-bank-1000',{recursive:true});
  await writeFile('acceptance/question-bank-1000/LOCAL_POSTGRES_REPORT.json',JSON.stringify({status:'PASS',database:(await run('select version() version')).version,scope:'Real PostgreSQL via local PGlite; transport/auth fixtures, no remote writes',checks},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length}));
}catch(error){console.error(JSON.stringify({status:'FAIL',checks,code:error.code,message:error.message}));process.exitCode=1;}
finally{await db.close();}
