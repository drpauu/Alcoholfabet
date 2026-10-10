import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWorkbookBank, pendingRows, batchSql, prepareArgs, linksSql } from '../../scripts/import_questions_1000.mjs';

const bank = await loadWorkbookBank();
const sha = value => createHash('sha256').update(value).digest('hex');
async function mutated(change) {
  const directory = await mkdtemp(join(tmpdir(), 'alcoholfabet-workbook-'));
  try {
    await cp('data/question-bank-1000', directory, { recursive: true });
    const originals = (await readFile(join(directory, 'questions_1000.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const reviewed = structuredClone(bank.rows), audit = structuredClone(bank.manifest), links = structuredClone(bank.links);
    change({ originals, reviewed, audit, links });
    for (const [name, rows, field] of [['questions_1000.jsonl', originals, 'canonicalSha256'], ['reviewed_1000.jsonl', reviewed, 'reviewedSha256']]) {
      const bytes = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
      await writeFile(join(directory, name), bytes); audit[field] = sha(bytes);
    }
    const bytes = JSON.stringify(links, null, 2) + '\n';
    await writeFile(join(directory, 'historical_concept_links.json'), bytes); audit.historicalLinksSha256 = sha(bytes);
    await writeFile(join(directory, 'AUDIT.json'), JSON.stringify(audit));
    return await loadWorkbookBank(directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('all workbook rows retained; exact pools and conservative review', () => {
  assert.equal(bank.rows.length, 1000);
  assert.deepEqual(prepareArgs(bank).p_expected_pools, { PAU: 200, TECLA: 200, TECLA_PAU: 200, PAU_TECLA: 200, TP: 200 });
  assert.equal(bank.rows.filter(row => row.active).length, 913);
  assert.equal(bank.rows.filter(row => !row.active).length, 87);
  assert.ok(bank.rows.filter(row => !row.active).every(row => row.review_note && !row.factual_checked && !row.language_checked));
  assert.ok(bank.rows.every(row => row.source_verified === false));
});

test('altered answers are rejected even if the reviewed checksum is recomputed', async () => {
  await assert.rejects(mutated(({ reviewed }) => { reviewed[0].answer_ca = 'Resposta alterada'; }), /CANONICAL_CONTENT_CHANGED/);
});

test('duplicate IDs and unequal pool distribution cannot enter an import', async () => {
  await assert.rejects(mutated(({ reviewed }) => { reviewed[1].id = reviewed[0].id; }), /BANK_COUNT_OR_ID_INVALID/);
  await assert.rejects(mutated(({ originals, reviewed }) => { originals[0].pool = reviewed[0].pool = 'TECLA'; }), /BANK_POOL_COUNT_INVALID/);
});

test('review flags and quarantine explanations are enforced', async () => {
  await assert.rejects(mutated(({ reviewed }) => { reviewed.find(row => row.active).factual_checked = false; }), /BANK_REVIEW_INVALID/);
  await assert.rejects(mutated(({ reviewed }) => { reviewed.find(row => !row.active).review_note = ''; }), /QUARANTINE_REASON_REQUIRED/);
});

test('personal/crossed formulations and capital inversions share concepts', () => {
  const get = id => bank.rows.find(row => row.id === id);
  assert.equal(get('NEW26-PAU-001').semantic_key, get('NEW26-TECLA_PAU-012').semantic_key);
  const capital = bank.rows.filter(row => row.semantic_key === 'geo_svk_capital');
  assert.ok(capital.length >= 2);
  assert.ok(new Set(capital.map(row => row.answer_ca)).size >= 2, 'Inverse questions have different answers but one fact');
  const mercury = bank.rows.filter(row => /^mercuri$/i.test(row.answer_ca));
  assert.ok(new Set(mercury.map(row => row.semantic_key)).size >= 2, 'Planet and metal are distinct facts');
});

test('historical links must be unique and resolve to the reviewed bank', async () => {
  assert.equal(bank.links.length, 77);
  await assert.rejects(mutated(({ links }) => { links[0].semantic_key = 'invented-concept'; }), /BANK_CONCEPT_LINKS_INVALID/);
  await assert.rejects(mutated(({ links }) => { links[1].question_id = links[0].question_id; }), /BANK_CONCEPT_LINKS_INVALID/);
});

test('staging disables every row and validation uses an independent RPC', () => {
  assert.ok(pendingRows(bank.rows).every(row => !row.active && row.review_status === 'DRAFT' && !row.factual_checked));
  assert.match(batchSql(bank, 0, { validate: true }), /^select public\.admin_validate_question_bank_batch/);
  assert.match(linksSql(bank), /^select public\.admin_link_question_bank_concepts/);
  assert.doesNotMatch(batchSql(bank, 0), /delete from|truncate/i);
});

test('bank/source answers are excluded from dev and deployment inputs', async () => {
  const config = await readFile('vite.config.ts', 'utf8'), deploy = await readFile('.vercelignore', 'utf8');
  for (const name of ['question-bank-1000', 'questions_1000.xlsx', '_question_bank']) {
    assert.ok(config.includes(name)); assert.ok(deploy.includes(name));
  }
  assert.doesNotMatch(await readFile('src/services/game-repository.ts', 'utf8'), /reviewed_1000|questions_1000/);
});
