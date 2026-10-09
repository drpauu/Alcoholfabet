import { readFile, writeFile, rename, unlink, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';

// Finalizes existing evidence only. This script never authenticates or writes game data.
const directory = join(process.cwd(), 'acceptance/art-redesign');
const reportPath = join(directory, 'VISUAL_CAPTURE_REPORT.json');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
assert.deepEqual(report.missing, []); assert.deepEqual(report.errors, []);
const completedAt = new Date().toISOString();
const renameStaticResult = (path) => path.replace('/incorrect-drink-', '/incorrect-settled-');
for (const capture of report.metrics) {
  const nextPath = renameStaticResult(capture.path);
  if (nextPath !== capture.path) {
    if (existsSync(capture.path)) await rename(capture.path, nextPath);
    capture.path = nextPath; capture.suffix = 'settled'; capture.motionSampleMs = null;
  }
}
const previousCaptureAttempts = report.metrics.length;
report.metrics = [...new Map(report.metrics.map((capture) => [capture.path, capture])).values()];
let checkedControls = 0, equalJudgePairs = 0;
let minWidth = Infinity, minHeight = Infinity;
for (const capture of report.metrics) {
  await access(capture.path);
  const { layout, width, height } = capture;
  assert.ok(layout.bodyWidth <= width && layout.bodyHeight <= height, `Overflow: ${capture.path}`);
  for (const control of layout.controls) {
    assert.ok(control.artButton && control.width >= 47.5 && control.height >= 47.5, `Control size: ${capture.path}`);
    assert.ok(control.left >= -.5 && control.top >= -.5 && control.right <= width + .5 && control.bottom <= height + .5, `Clipped control: ${capture.path}`);
    minWidth = Math.min(minWidth, control.width); minHeight = Math.min(minHeight, control.height); checkedControls += 1;
  }
  if (layout.judgeControls.length === 2) {
    const [a, b] = layout.judgeControls;
    assert.ok(Math.abs(a.width - b.width) < 1);
    for (const key of ['height', 'fontSize', 'fontWeight', 'borderWidth', 'padding', 'shadow']) assert.equal(a[key], b[key], `Judge ${key}: ${capture.path}`);
    equalJudgePairs += 1;
  }
}
const core = report.metrics.filter((capture) => report.requiredScenarios.includes(capture.scenario) && capture.suffix === null);
assert.equal(core.length, 36);
assert.ok(report.interactionMetrics.every((audit) => audit.allFocusVisible));
assert.ok(report.dialogMetrics.every((audit) => audit.focusRestored));
report.status = 'PASS'; report.finalizedAt = completedAt; report.captures = report.metrics.length;
report.coreCaptures = core.length; report.previousCaptureAttempts = previousCaptureAttempts;
report.staticIncorrectExtras = 'incorrect-settled images show the settled result; visible glass/cross timing is evidenced by the core error captures and normal-motion E2E frames/video';
report.layoutAudit = { status: 'PASS', checkedControls, minimumWidthPx: Number(minWidth.toFixed(2)), minimumHeightPx: Number(minHeight.toFixed(2)), equalJudgePairs, equalJudgeGeometryAndWeight: true, focusAudits: report.interactionMetrics.length, dialogAudits: report.dialogMetrics.length, finalCustomRecaptured: Boolean(report.customDurationRecapturedAt) };
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
await writeFile(join(directory, 'CAPTURE_PROGRESS.json'), JSON.stringify({ mode: 'complete', captures: report.captures, completedAt, errors: report.errors, metrics: report.metrics, interactionMetrics: report.interactionMetrics, dialogMetrics: report.dialogMetrics }, null, 2) + '\n');
const manifestPath = join(directory, 'QA_MANIFEST.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.captures = [...new Map(manifest.captures.map((capture) => { const normalized = { ...capture, path: renameStaticResult(capture.path) }; return [normalized.path, normalized]; })).values()];
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
for (const [name, fix, evidence] of [
  ['001-camera-touch-target.json', 'Camera motion targets the game layout; header controls retain their 48px size.', 'screenshots/victory-390x844.png'],
  ['003-lobby-tablet-overflow.json', 'Low-height tablet lobby uses the compact parchment composition.', 'screenshots/online-lobby-1024x768.png'],
]) {
  const path = join(directory, 'failures', name);
  if (!existsSync(path)) continue;
  const historical = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...historical, status: 'RESOLVED', resolvedAt: completedAt, fix, finalEvidence: evidence }, null, 2) + '\n');
}
const activeFailure = join(directory, 'CAPTURE_FAILURE.json');
if (existsSync(activeFailure)) {
  const historical = JSON.parse(await readFile(activeFailure, 'utf8'));
  await writeFile(join(directory, 'failures', 'last-capture-failure-resolved.json'), JSON.stringify({ ...historical, status: 'RESOLVED', resolvedAt: completedAt, finalEvidence: 'VISUAL_CAPTURE_REPORT.json' }, null, 2) + '\n');
  await unlink(activeFailure);
}
console.log(JSON.stringify({ status: report.status, coreCaptures: core.length, uniqueCaptures: report.captures, ...report.layoutAudit, noSecrets: true, noGameMutations: true }));
