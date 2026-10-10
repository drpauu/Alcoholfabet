#!/usr/bin/env node
/** Server-only, staged import of the workbook-derived JSONL. Activation is the
 * final explicit administrative step, after independent row validation. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
export const BATCH_SIZE = 200;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
export async function loadWorkbookBank(directory = 'data/question-bank-1000') {
  const [raw, reviewed, audit, linksRaw] = await Promise.all(['questions_1000.jsonl', 'reviewed_1000.jsonl', 'AUDIT.json', 'historical_concept_links.json'].map(name => readFile(join(directory, name))));
  const originals = raw.toString().trim().split(/\r?\n/).map(JSON.parse);
  const rows = reviewed.toString().trim().split(/\r?\n/).map(JSON.parse);
  const manifest = JSON.parse(audit);
  if (sha(raw) !== manifest.canonicalSha256 || sha(reviewed) !== manifest.reviewedSha256) throw Error('BANK_ARTIFACT_CHECKSUM_MISMATCH');
  if (originals.length !== 1000 || rows.length !== 1000 || new Set(rows.map(r => r.id)).size !== 1000) throw Error('BANK_COUNT_OR_ID_INVALID');
  const counts = {};
  rows.forEach((row, index) => {
    const original = originals[index];
    for (const key of ['id', 'pool', 'topic', 'domain', 'question_ca', 'answer_ca', 'source_hint', 'notes']) {
      if (row[key] !== original[key]) throw Error(`CANONICAL_CONTENT_CHANGED:${row.id}:${key}`);
    }
    if (row.difficulty !== Number(original.difficulty) || row.original_fact_id !== original.fact_id) throw Error('CANONICAL_METADATA_CHANGED');
    if (!['APPROVED', 'DRAFT'].includes(row.review_status) || row.active !== (row.review_status === 'APPROVED') || row.factual_checked !== row.active || row.language_checked !== row.active) throw Error('BANK_REVIEW_INVALID');
    if (!row.semantic_key || row.semantic_key !== row.fact_id || row.answer_word_count !== row.answer_ca.trim().split(/\s+/).length || row.answer_word_count < 1 || row.answer_word_count > 5) throw Error('BANK_METADATA_INVALID');
    if (!row.active && !row.review_note) throw Error('QUARANTINE_REASON_REQUIRED');
    counts[row.pool] = (counts[row.pool] ?? 0) + 1;
  });
  for (const pool of ['PAU', 'TECLA', 'TECLA_PAU', 'PAU_TECLA', 'TP']) if (counts[pool] !== 200 || manifest.pools[pool]?.imported !== 200) throw Error('BANK_POOL_COUNT_INVALID');
  if (Object.keys(counts).length !== 5 || rows.filter(r => r.active).length !== manifest.approved) throw Error('BANK_REVIEW_COUNT_INVALID');
  const links = JSON.parse(linksRaw);
  const keys = new Set(rows.map(row => row.semantic_key));
  if (sha(linksRaw) !== manifest.historicalLinksSha256 || links.length !== manifest.historicalLinks || new Set(links.map(link => link.question_id)).size !== links.length || links.some(link => !link.question_id || !keys.has(link.semantic_key))) throw Error('BANK_CONCEPT_LINKS_INVALID');
  return { rows, links, manifest, version: manifest.version, checksum: sha(raw) };
}
export const pendingRows = rows => rows.map(row => ({ ...row, active: false, review_status: 'DRAFT', factual_checked: false, language_checked: false, review_note: 'IMPORT_PENDING_VALIDATION' }));
export const prepareArgs = bank => ({ p_version: bank.version, p_checksum: bank.checksum, p_reviewed_checksum: bank.manifest.reviewedSha256, p_source_checksum: bank.manifest.sourceSha256, p_expected_rows: 1000, p_expected_pools: Object.fromEntries(Object.entries(bank.manifest.pools).map(([pool, info]) => [pool, info.imported])) });
export function prepareSql(bank) {
  const p = prepareArgs(bank);
  return `select public.admin_prepare_question_bank(${literal(p.p_version)},${literal(p.p_checksum)},${literal(p.p_reviewed_checksum)},${literal(p.p_source_checksum)},1000,${literal(JSON.stringify(p.p_expected_pools))}::jsonb) as report;\n`;
}
export function batchSql(bank, start, { stage = false, validate = false } = {}) {
  const rows = bank.rows.slice(start, start + BATCH_SIZE);
  const fn = validate ? 'admin_validate_question_bank_batch' : 'admin_upsert_question_bank_batch';
  return `select public.${fn}(${literal(bank.version)},${literal(bank.checksum)},${literal(JSON.stringify(stage ? pendingRows(rows) : rows))}::jsonb) as report;\n`;
}
export const finalizeSql = bank => `select public.admin_finalize_question_bank(${literal(bank.version)},${literal(bank.checksum)}) as report;\n`;
export const linksArgs = bank => ({ p_version: bank.version, p_checksum: bank.checksum, p_links: bank.links });
export const linksSql = bank => `select public.admin_link_question_bank_concepts(${literal(bank.version)},${literal(bank.checksum)},${literal(JSON.stringify(bank.links))}::jsonb) as report;\n`;
async function main() {
  const bank = await loadWorkbookBank();
  const emit = process.argv.indexOf('--emit-sql');
  if (emit >= 0) {
    if (!process.argv[emit + 1]) throw Error('OUTPUT_DIRECTORY_REQUIRED');
    const directory = resolve(process.argv[emit + 1]);
    if (directory === resolve('public') || directory.startsWith(resolve('public') + '/')) throw Error('PRIVATE_OUTPUT_REQUIRED');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, 'prepare.sql'), prepareSql(bank), { mode: 0o600 });
    for (let start = 0; start < 1000; start += BATCH_SIZE) {
      const index = String(start / BATCH_SIZE + 1).padStart(3, '0');
      for (const phase of ['stage', 'review', 'validate']) await writeFile(join(directory, `${phase}-${index}.sql`), batchSql(bank, start, { stage: phase === 'stage', validate: phase === 'validate' }), { mode: 0o600 });
    }
    await writeFile(join(directory, 'finalize.sql'), finalizeSql(bank), { mode: 0o600 });
    await writeFile(join(directory, 'historical-links.sql'), linksSql(bank), { mode: 0o600 });
    console.log(JSON.stringify({ version: bank.version, imported: 1000, approved: bank.manifest.approved, draft: bank.manifest.draft, checksum: bank.checksum }));
    return;
  }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error('SERVER_IMPORT_ENV_REQUIRED');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw Error(`${name}:${error.code}`);
    return data;
  };
  const manifest = await rpc('admin_prepare_question_bank', prepareArgs(bank));
  if (manifest.status === 'SUPERSEDED') throw Error('BANK_SUPERSEDED_ACTIVATION_REQUIRES_EXPLICIT_ROLLBACK');
  const phases = manifest.status === 'IMPORTING' ? ['stage', 'review', 'validate'] : ['review', 'validate'];
  for (const phase of phases) for (let start = 0; start < 1000; start += BATCH_SIZE) {
    const rows = bank.rows.slice(start, start + BATCH_SIZE);
    const report = await rpc(phase === 'validate' ? 'admin_validate_question_bank_batch' : 'admin_upsert_question_bank_batch', { p_version: bank.version, p_checksum: bank.checksum, p_rows: phase === 'stage' ? pendingRows(rows) : rows });
    console.log(JSON.stringify({ phase, batch: start / BATCH_SIZE + 1, ...report }));
  }
  console.log(JSON.stringify(await rpc('admin_link_question_bank_concepts', linksArgs(bank))));
  console.log(JSON.stringify(await rpc('admin_finalize_question_bank', { p_version: bank.version, p_checksum: bank.checksum })));
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
