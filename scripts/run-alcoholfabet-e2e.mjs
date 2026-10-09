import { spawn } from 'node:child_process';
import { readFile, writeFile, chmod, mkdir, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const directory = join(process.cwd(), 'acceptance/alcoholfabet');
const noVideo = false;
const motionPathRecheck = false;
const motionRecheck = false;
const prefix = process.argv.includes('--assets-only') ? 'ACCESS_ASSETS_RECHECK' : process.argv.includes('--recheck') ? 'ACCESS_DURATION_RECHECK' : process.argv.includes('--in-person-completion') ? 'IN_PERSON_COMPLETE_RECHECK' : process.argv.includes('--complete-games') ? 'COMPLETE_GAMES_E2E' : 'ALCOHOLFABET_E2E';
await mkdir(directory, { recursive: true });
const code = (await readFile(process.env.TECLA_ACCESS_CODE_FILE ?? join(homedir(), '.config/tecla-pau/access-code.txt'), 'utf8')).trim();
const mask = (value) => String(value).split(code).join('[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const temporaryReport = `/tmp/tecla-pau-${prefix.toLowerCase()}-raw.json`;
await writeFile(temporaryReport, '{}', { mode: 0o600 }); await chmod(temporaryReport, 0o600);
const startedAt = new Date().toISOString(), start = Date.now();
const args = ['playwright', 'test', ...(process.argv.includes('--assets-only') ? ['tests/e2e/access-public.spec.ts','--grep','banc cru'] : process.argv.includes('--recheck') ? ['tests/e2e/access-public.spec.ts','tests/e2e/alcoholfabet.spec.ts','--grep','banc cru|durada:'] : process.argv.includes('--in-person-completion') ? ['tests/e2e/game.spec.ts', '--grep', 'partida presencial:'] : process.argv.includes('--complete-games') ? ['tests/e2e/game.spec.ts', '--grep', 'partida presencial:|online: dos contexts'] : ['tests/e2e/access-public.spec.ts','tests/e2e/alcoholfabet.spec.ts']), '--trace', 'off', '--reporter=json'];
const child = spawn('npx', args, { cwd: process.cwd(), env: { ...process.env, TECLA_PAU_QA_MANIFEST: join(directory, 'QA_E2E_MANIFEST.json'), PLAYWRIGHT_JSON_OUTPUT_NAME: temporaryReport }, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const heartbeat = setInterval(() => console.log(JSON.stringify({ stage: 'E2E', running: true, elapsedSeconds: Math.round((Date.now() - start) / 1000) })), 30000);
const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
clearInterval(heartbeat);
const raw = JSON.parse(mask(await readFile(temporaryReport, 'utf8')));
const tests = [];
function collect(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const result = test.results?.at(-1);
      tests.push({ name: spec.title, file: spec.file, status: result?.status ?? test.status, durationMs: result?.duration ?? 0, errors: (result?.errors ?? []).map((error) => mask(error.message ?? error.value ?? 'Unknown failure')) });
    }
    collect(suite.suites);
  }
}
collect(raw.suites);
const report = { status: exitCode === 0 && !raw.stats?.unexpected && !(raw.errors?.length) ? 'PASS' : 'FAIL', startedAt, completedAt: new Date().toISOString(), command: `npx ${args.map((argument) => /[\s^]/.test(argument) ? `'${argument}'` : argument).join(' ')}`, arguments: args, backend: 'real Supabase Anonymous Auth, authoritative RPCs and private Realtime', exitCode, passed: raw.stats?.expected ?? 0, failed: raw.stats?.unexpected ?? 0, flaky: raw.stats?.flaky ?? 0, skipped: raw.stats?.skipped ?? 0, durationMs: raw.stats?.duration ?? Date.now() - start, tests, errors: (raw.errors ?? []).map((error) => mask(error.message ?? error.value ?? 'Unknown failure')), traceDisabledToKeepCredentialsOutOfArtifacts: true, noSecrets: true, ...(motionRecheck ? { reason: noVideo ? 'Measure the final exact route-fraction motion with the existing QA session, without video, screenshots or new Auth, and verify the same two-arrival and badge-order assertions.' : motionPathRecheck ? 'Verify the exact route-fraction shortcut and ensure +1 badge begins after the first landing with isolated native rAF timestamps.' : 'Isolate each requestAnimationFrame recorder and use its native frame timestamp; replace measurements affected by callback reuse.', noMetaInThisRecheck: true } : {}), ...(noVideo ? { videoRecording: false, screenshotRecording: false, existingSessionOnly: true } : {}) };
await writeFile(join(directory, `${prefix}_RAW.json`), JSON.stringify(raw, null, 2) + '\n');
await writeFile(join(directory, `${prefix}_LOG.txt`), mask(stdout + stderr));
await writeFile(join(directory, `${prefix}_REPORT.json`), JSON.stringify(report, null, 2) + '\n');
await unlink(temporaryReport);
console.log(JSON.stringify({ stage: 'E2E', status: report.status, passed: report.passed, failed: report.failed, flaky: report.flaky, skipped: report.skipped, noSecrets: true }));
process.exitCode = report.status === 'PASS' ? 0 : 1;
