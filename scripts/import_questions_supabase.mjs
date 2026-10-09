#!/usr/bin/env node
/** Actual importer: canonical JSONL + reproducible quarantine, batches of 200.
 * --emit-sql DIR emits the same administrative RPC calls used through MCP.
 * Without --emit-sql, reads server-only SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 * Never load this module in the application or place output in public/.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
export const VERSION='canonical-5000-20261009-v1';
export const BATCH_SIZE=200;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function loadBank(canonicalPath='data/question-bank/questions_5000.jsonl',reviewedPath='data/question-bank/reviewed_5000.jsonl'){
 const canonicalBytes=await readFile(canonicalPath),reviewedBytes=await readFile(reviewedPath);
 const original=canonicalBytes.toString().trim().split(/\r?\n/).map(JSON.parse);
 const reviewed=reviewedBytes.toString().trim().split(/\r?\n/).map(JSON.parse);
 const expected={PAU:1300,TECLA:1300,TECLA_PAU:750,PAU_TECLA:750,TP:900},counts={};
 if(original.length!==5000||reviewed.length!==5000||new Set(reviewed.map(r=>r.id)).size!==5000)throw Error('BANK_COUNT_OR_ID_INVALID');
 reviewed.forEach((r,i)=>{
  for(const field of ['id','pool','topic','subtopic','difficulty','question_ca','answer_ca','accepted_answers','answer_word_count','fact_id','variant_no','source_key','source_url'])if(JSON.stringify(r[field])!==JSON.stringify(original[i][field]))throw Error('CANONICAL_CONTENT_CHANGED:'+r.id+':'+field);
  if(!['APPROVED','DRAFT'].includes(r.review_status)||r.active!==(r.review_status==='APPROVED'))throw Error('BANK_REVIEW_INVALID');
  if(!r.semantic_key||r.answer_ca.trim().split(/\s+/).length!==r.answer_word_count||r.answer_word_count<1||r.answer_word_count>5)throw Error('BANK_METADATA_INVALID');
  counts[r.pool]=(counts[r.pool]??0)+1;
 });
 for(const [pool,n]of Object.entries(expected))if(counts[pool]!==n)throw Error('BANK_POOL_COUNT_INVALID');
 return {rows:reviewed,checksum:digest(canonicalBytes),reviewedChecksum:digest(reviewedBytes)};
}
const literal=s=>"'"+s.replaceAll("'","''")+"'";
export function batchSql(bank,start){return 'select public.admin_upsert_question_bank_batch('+literal(VERSION)+','+literal(bank.checksum)+','+literal(JSON.stringify(bank.rows.slice(start,start+BATCH_SIZE)))+'::jsonb) as report;\n';}
export function finalizeSql(bank){return 'select public.admin_finalize_question_bank('+literal(VERSION)+','+literal(bank.checksum)+') as report;\n';}
async function main(){
 const bank=await loadBank(),emit=process.argv.indexOf('--emit-sql');
 if(emit>=0){
  if(!process.argv[emit+1])throw Error('OUTPUT_DIRECTORY_REQUIRED');
  const directory=resolve(process.argv[emit+1]);if(directory===resolve('public')||directory.startsWith(resolve('public')+'/'))throw Error('PRIVATE_OUTPUT_REQUIRED');
  await mkdir(directory,{recursive:true,mode:0o700});
  for(let i=0;i<bank.rows.length;i+=BATCH_SIZE)await writeFile(join(directory,String(i/BATCH_SIZE+1).padStart(3,'0')+'.sql'),batchSql(bank,i),{mode:0o600});
  await writeFile(join(directory,'finalize.sql'),finalizeSql(bank),{mode:0o600});
  console.log(JSON.stringify({rows:bank.rows.length,batches:bank.rows.length/BATCH_SIZE,checksum:bank.checksum,version:VERSION}));return;
 }
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('SERVER_IMPORT_ENV_REQUIRED');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 for(let i=0;i<bank.rows.length;i+=BATCH_SIZE){const {data,error}=await client.rpc('admin_upsert_question_bank_batch',{p_version:VERSION,p_checksum:bank.checksum,p_rows:bank.rows.slice(i,i+BATCH_SIZE)});if(error)throw Error('BANK_BATCH_FAILED:'+String(i/BATCH_SIZE+1)+':'+error.code);console.log(JSON.stringify({batch:i/BATCH_SIZE+1,...data}));}
 const {data,error}=await client.rpc('admin_finalize_question_bank',{p_version:VERSION,p_checksum:bank.checksum});if(error)throw Error('BANK_FINALIZE_FAILED:'+error.code);console.log(JSON.stringify(data));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))main().catch(error=>{console.error(error.message);process.exitCode=1;});
