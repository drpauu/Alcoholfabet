import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadBank,batchSql,finalizeSql,BATCH_SIZE} from '../../scripts/import_questions_supabase.mjs';
const bank=await loadBank();
test('canonical 5000 IDs and unchanged text, difficulty, metadata',()=>{
 assert.equal(bank.rows.length,5000);assert.equal(new Set(bank.rows.map(r=>r.id)).size,5000);
 assert.equal(bank.rows.filter(r=>r.active).length,4596);assert.equal(bank.rows.filter(r=>r.review_status==='DRAFT').length,404);
 assert.equal(new Set(bank.rows.map(r=>r.fact_id)).size,1529);
 assert.equal(bank.rows.some(r=>r.pool==='PAU'&&r.topic==='Atletisme'),false);
});
test('200-row administrative batches and explicit activation',()=>{
 assert.equal(BATCH_SIZE,200);assert.equal(Array.from({length:25},(_,i)=>batchSql(bank,i*200)).length,25);
 assert.match(batchSql(bank,0),/^select public\.admin_upsert_question_bank_batch/);
 assert.match(finalizeSql(bank),/^select public\.admin_finalize_question_bank/);
 assert.doesNotMatch(batchSql(bank,0),/truncate|delete from/i);
});
test('question/answer content edits cannot slip into an import',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'question-bank-test-'));try{
  const rows=bank.rows.map(r=>({...r}));rows[0].answer_ca='Resposta improvisada';
  const path=join(dir,'tampered.jsonl');await writeFile(path,rows.map(r=>JSON.stringify(r)).join('\n'),{mode:0o600});
  await assert.rejects(loadBank('data/question-bank/questions_5000.jsonl',path),/CANONICAL_CONTENT_CHANGED/);
 }finally{await rm(dir,{recursive:true});}
});
test('every flagged fact quarantines all of its variants across pools',()=>{
 const draftFacts=new Set(bank.rows.filter(r=>!r.active).map(r=>r.fact_id));
 assert.equal(bank.rows.some(r=>r.active&&draftFacts.has(r.fact_id)),false);
 assert.ok(bank.rows.filter(r=>!r.active).every(r=>r.review_note&&r.review_status==='DRAFT'));
});
test('inverse country/capital formulations share a stricter semantic key',()=>{
 const inverse=bank.rows.filter(r=>r.fact_id.endsWith('_country_by_capital'));
 assert.ok(inverse.length>0);assert.ok(inverse.every(r=>r.semantic_key===r.fact_id.replace('_country_by_capital','_capital')));
});
test('raw bank is blocked by development config and absent from build inputs',async()=>{
 const config=await readFile('vite.config.ts','utf8');assert.match(config,/\*\*\/data\/question-bank\/\*\*/);assert.match(config,/questions_pack\.zip/);
 const index=await readFile('src/services/game-repository.ts','utf8');assert.doesNotMatch(index,/questions_5000|reviewed_5000/);
});
