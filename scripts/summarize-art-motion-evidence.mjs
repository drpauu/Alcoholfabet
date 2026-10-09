import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = 'acceptance/art-redesign';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function cardAngle(frame) {
  if (!frame?.card?.startsWith('matrix3d(')) return null;
  const values = frame.card.slice(9, -1).split(',').map(Number);
  return values.length === 16 ? Math.atan2(-values[2], values[0]) * 180 / Math.PI : null;
}
function summary(frames) {
  if (!frames?.length) return null;
  const gaps = frames.slice(1).map((frame, index) => frame.t - frames[index].t).filter(gap => gap > 0);
  const travelGaps = frames.slice(1).flatMap((frame, index) => distance(frame, frames[index]) > .2 && frame.t > frames[index].t ? [frame.t - frames[index].t] : []);
  const flipGaps = frames.slice(1).flatMap((frame, index) => {
    const angle = cardAngle(frame), previous = cardAngle(frames[index]);
    return angle !== null && previous !== null && Math.abs(angle - previous) > .1 && frame.t > frames[index].t ? [frame.t - frames[index].t] : [];
  });
  const first = frames[0], last = frames.at(-1), duration = last.t - first.t;
  const departure = frames.find(frame => distance(frame, first) > 3);
  const confirmation = frames.find(frame => ['MOVING', 'RESULT', 'BETWEEN_TURNS', 'FINISHED'].includes(frame.phase));
  const revealConfirmation = frames.find(frame => frame.phase === 'ANSWER_REVEALED');
  const firstAnswer = frames.find(frame => frame.answer);
  const angles = frames.map(cardAngle).filter(angle => angle !== null);
  const travel = frames.filter(frame => distance(frame, first) > 3);
  const settledAt = frames.findIndex((frame, index) => departure && frame.t >= departure.t && distance(frame, last) < .2 && frames.slice(index).every(later => distance(later, last) < .2));
  const plateaus = [];
  let start = 0;
  for (let index = 1; index <= frames.length; index += 1) {
    if (index < frames.length && distance(frames[index], frames[start]) < .35) continue;
    const end = index - 1;
    if (end > start && frames[end].t - frames[start].t >= 90) plateaus.push({ startMs: round(frames[start].t), endMs: round(frames[end].t), durationMs: round(frames[end].t - frames[start].t), x: round(frames[start].x), y: round(frames[start].y), intermediate: distance(frames[start], first) > 3 && distance(frames[start], last) > 3 });
    start = index;
  }
  const visibleBadge = frames.filter(frame => frame.plusOpacity > .05);
  const visibleDrink = frames.filter(frame => frame.drinkOpacity > .05);
  const visibleError = frames.filter(frame => frame.errorOpacity > .05);
  return {
    frameCount: frames.length, recordingMs: round(duration),
    averageSampleFps: round(duration > 0 ? (frames.length - 1) / duration * 1000 : null),
    medianSampleFps: round(1000 / percentile(gaps, .5)),
    nonIncreasingSampleTimestamps: frames.slice(1).filter((sample, index) => sample.t <= frames[index].t).length,
    p95FrameGapMs: round(percentile(gaps, .95)), longestFrameGapMs: round(Math.max(...gaps)),
    movingIntervalCount: travelGaps.length,
    medianMovingSampleFps: travelGaps.length ? round(1000 / percentile(travelGaps, .5)) : null,
    p95MovingFrameGapMs: round(percentile(travelGaps, .95)),
    rotatingCardIntervalCount: flipGaps.length,
    medianRotatingCardSampleFps: flipGaps.length ? round(1000 / percentile(flipGaps, .5)) : null,
    p95RotatingCardFrameGapMs: round(percentile(flipGaps, .95)),
    firstTravelAtRecordingMs: round(departure?.t),
    firstTravelAfterConfirmedPhaseMs: round(departure && confirmation ? departure.t - confirmation.t : null),
    distinctTravelPoints: new Set(travel.map(frame => `${frame.x.toFixed(1)},${frame.y.toFixed(1)}`)).size,
    finalArrivalAtRecordingMs: round(settledAt >= 0 ? frames[settledAt].t : null),
    start: { x: round(first.x), y: round(first.y) }, end: { x: round(last.x), y: round(last.y) },
    xRange: [round(Math.min(...frames.map(frame => frame.x))), round(Math.max(...frames.map(frame => frame.x)))],
    yRange: [round(Math.min(...frames.map(frame => frame.y))), round(Math.max(...frames.map(frame => frame.y)))],
    intermediatePlateaus: plateaus.filter(plateau => plateau.intermediate),
    plusBadgeAfterFirstIntermediateArrivalMs: round(visibleBadge[0] && plateaus.find(plateau => plateau.intermediate) ? visibleBadge[0].t - plateaus.find(plateau => plateau.intermediate).startMs : null),
    plusBadgeFirstVisibleMs: round(visibleBadge[0]?.t), plusBadgeLastVisibleMs: round(visibleBadge.at(-1)?.t),
    drinkFirstVisibleMs: round(visibleDrink[0]?.t), drinkLastVisibleMs: round(visibleDrink.at(-1)?.t),
    drinkFirstVisibleAfterConfirmedPhaseMs: round(visibleDrink[0] && confirmation ? visibleDrink[0].t - confirmation.t : null),
    errorFirstVisibleMs: round(visibleError[0]?.t), errorLastVisibleMs: round(visibleError.at(-1)?.t),
    phaseTransitions: frames.filter((frame, index) => frame.phase && (index === 0 || frame.phase !== frames[index - 1].phase)).map(frame => ({ t: round(frame.t), phase: frame.phase })),
    flipFirst3dMs: round(frames.find(frame => frame.card?.startsWith('matrix3d'))?.t),
    cardRotationDegreesRange: angles.length ? [round(Math.min(...angles)), round(Math.max(...angles))] : null,
    answerFirstVisibleMs: round(firstAnswer?.t),
    answerFirstVisibleAfterRevealPhaseMs: round(firstAnswer && revealConfirmation ? firstAnswer.t - revealConfirmation.t : null),
    cardAngleAtFirstAnswerDegrees: round(cardAngle(firstAnswer)),
  };
}
const files = readdirSync(directory).filter(name => /^motion-(plus-one|victory)-\d+x\d+\.json$/.test(name)).sort();
const responsive = files.map(name => {
  const data = read(join(directory, name));
  const size = name.match(/(\d+)x(\d+)/);
  return { source: join(directory, name), sequence: name.includes('plus-one') ? 'PLUS_ONE' : 'VICTORY', viewport: [Number(size[1]), Number(size[2])], videoRecording: false, player: data.player ?? null, ...summary(data.frames) };
});
const browserPath = join(directory, 'MOTION_BROWSER_QA.json');
const browser = existsSync(browserPath) ? read(browserPath) : null;
const sequences = browser?.evidence.map((entry, index) => ({ source: browserPath, index, sequence: entry.type, viewport: [1440, 900], videoRecording: true, ...summary(entry.frames) })) ?? [];
const noVideoPath = join(directory, 'MOTION_NO_VIDEO_FRAMES.json');
const noVideo = existsSync(noVideoPath) ? read(noVideoPath) : null;
const noVideoSequences = noVideo?.evidence.map((entry, index) => ({ source: noVideoPath, index, sequence: entry.type, viewport: noVideo.viewport ?? [1440, 900], videoRecording: false, screenshotRecording: false, nativeRafTimestamps: true, ...summary(entry.frames) })) ?? [];
const victoryPath = join(directory, 'MOTION_VICTORY_QA.json');
const victory = existsSync(victoryPath) ? read(victoryPath) : null;
const firstVisible = victory ? Object.fromEntries(['crown', 'winner', 'score', 'actions'].map(target => [target, victory.timeline.find(entry => entry[target])?.t ?? null])) : null;
const scoreFrames = (victory?.timeline ?? []).filter(entry => entry.score && entry.scoreTransform).map(entry => {
  const transform = entry.scoreTransform;
  const numbers = transform === 'none' ? null : transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
  return { t: entry.t, opacity: round(entry.scoreOpacity), y: round(numbers ? numbers.length === 16 ? numbers[13] : numbers[5] : 0), rotationDegrees: round(numbers ? Math.atan2(numbers[1], numbers[0]) * 180 / Math.PI : 0) };
});
const e2ePath = join(directory, 'FINAL_E2E_REPORT.json');
const e2e = existsSync(e2ePath) ? read(e2ePath) : null;
const capturePath = join(directory, 'VISUAL_CAPTURE_REPORT.json');
const capture = existsSync(capturePath) ? read(capturePath) : null;
const recheckPath = join(directory, 'MOTION_RECORDER_RECHECK_REPORT.json');
const recheck = existsSync(recheckPath) ? read(recheckPath) : null;
const pathRecheckPath = join(directory, 'MOTION_PATH_RECHECK_REPORT.json');
const pathRecheck = existsSync(pathRecheckPath) ? read(pathRecheckPath) : null;
const noVideoReportPath = join(directory, 'MOTION_NO_VIDEO_REPORT.json');
const noVideoReport = existsSync(noVideoReportPath) ? read(noVideoReportPath) : null;
const plusSequences = sequences.filter(sequence => sequence.sequence === 'PLUS_ONE');
const noVideoPlusSequences = noVideoSequences.filter(sequence => sequence.sequence === 'PLUS_ONE');
const e2eStats = e2e ? {
  status: e2e.status ?? null,
  passed: e2e.passed ?? e2e.stats?.expected ?? 0,
  failed: e2e.failed ?? e2e.stats?.unexpected ?? 0,
  flaky: e2e.flaky ?? e2e.stats?.flaky ?? 0,
  skipped: e2e.skipped ?? e2e.stats?.skipped ?? 0,
  durationMs: e2e.durationMs ?? e2e.stats?.duration ?? null,
} : null;
const evidenceChecks = {
  sixResponsiveSequences: responsive.length === 6 && responsive.every(sequence => sequence.frameCount > 1),
  requiredNormalSequences: ['ANSWER_REVEAL', 'INCORRECT', 'CORRECT', 'PLUS_ONE'].every(type => sequences.some(sequence => sequence.sequence === type && sequence.frameCount > 1)),
  victoryTimeline: Boolean(victory?.timeline?.length),
  eightE2ePassed: Boolean(e2eStats?.status === 'PASS' && e2eStats.passed === 8 && e2eStats.failed === 0 && e2eStats.flaky === 0 && e2eStats.skipped === 0 && e2e?.exitCode === 0),
  correctedNormalRecorderPassed: Boolean(recheck?.status === 'PASS' && recheck.passed === 1 && recheck.failed === 0 && recheck.flaky === 0 && recheck.skipped === 0 && recheck.exitCode === 0 && sequences.every(sequence => sequence.nonIncreasingSampleTimestamps === 0)),
  exactRouteRecheckPassed: Boolean(pathRecheck?.status === 'PASS' && pathRecheck.passed === 1 && pathRecheck.failed === 0 && pathRecheck.flaky === 0 && pathRecheck.skipped === 0 && pathRecheck.exitCode === 0),
  noVideoFocusedCheckPassed: Boolean(noVideoReport?.status === 'PASS' && noVideoReport.passed === 1 && noVideoReport.failed === 0 && noVideoReport.flaky === 0 && noVideoReport.skipped === 0 && noVideoReport.exitCode === 0),
  noVideoNativeSamples: Boolean(noVideo?.videoRecording === false && noVideo.screenshotRecording === false && noVideo.nativeRafTimestamps === true && ['ANSWER_REVEAL', 'PLUS_ONE'].every(type => noVideoSequences.some(sequence => sequence.sequence === type && sequence.frameCount > 1)) && noVideoSequences.every(sequence => sequence.nonIncreasingSampleTimestamps === 0)),
  noVideoPlusBadgeAfterLanding: noVideoPlusSequences.length > 0 && noVideoPlusSequences.every(sequence => sequence.intermediatePlateaus.length > 0 && sequence.plusBadgeAfterFirstIntermediateArrivalMs !== null && sequence.plusBadgeAfterFirstIntermediateArrivalMs >= 0),
  plusBadgeAfterLanding: plusSequences.length > 0 && plusSequences.every(sequence => sequence.intermediatePlateaus.length > 0 && sequence.plusBadgeAfterFirstIntermediateArrivalMs !== null && sequence.plusBadgeAfterFirstIntermediateArrivalMs >= 0),
  victoryOrder: Boolean(firstVisible && ['crown', 'winner', 'score', 'actions'].every(target => Number.isFinite(firstVisible[target])) && firstVisible.crown < firstVisible.winner && firstVisible.winner < firstVisible.score && firstVisible.score < firstVisible.actions),
  scoreHasPhysicalEntry: scoreFrames.some(entry => Math.abs(entry.y) > .05 || Math.abs(entry.rotationDegrees) > .05),
  capturesComplete: Boolean(capture?.status === 'PASS' && Array.isArray(capture.missing) && capture.missing.length === 0),
  noReportedErrors: Boolean(browser && capture && e2e && recheck && pathRecheck && noVideo && noVideoReport && [browser.errors, capture.errors, e2e.errors, recheck.errors, pathRecheck.errors, noVideo.errors, noVideoReport.errors, ...(e2e.tests ?? []).map(test => test.errors), ...(recheck.tests ?? []).map(test => test.errors), ...(pathRecheck.tests ?? []).map(test => test.errors), ...(noVideoReport.tests ?? []).map(test => test.errors)].every(errors => Array.isArray(errors) && errors.length === 0)),
};
const report = {
  generatedAt: new Date().toISOString(),
  evidenceComplete: Object.values(evidenceChecks).every(Boolean),
  evidenceChecks,
  environment: 'Playwright Chromium headless on the QA Linux host; production React components, actual Supabase RPCs and private Realtime.',
  method: 'requestAnimationFrame samples of computed SVG pawn transforms. Corrected normal E2E series and the separate no-video focused check use native callback timestamps and isolate each recording; responsive series use performance.now after style reads. Recording starts before the client action; RPC latency and scheduling are included. The focused check has no video or screenshots. Median FPS is 1000 divided by the median frame gap. The p95 gap describes slow frames. Counts are sample observations, not device FPS guarantees.',
  limits: ['Responsive capture samples include timed screenshots and predate the exact route-fraction shortcut; E2E samples include video encoding.', 'Only the E2E series records confirmed phase, answer visibility and card transform.', 'Victory visibility E2E timestamps begin after confirmed FINISHED was fetched, not at the exact JSON timeline origin.', 'Pawn-body tilt, shadow and particle styling are checked in source and visual captures; these frame samples measure the route wrapper.'],
  responsiveCaptureSequences: responsive, normalVideoSequences: sequences, noVideoSequences,
  constant60FpsOnPhysicalDevices: { status: 'PARTIAL', reason: 'The measured environment is Chromium headless on the Linux QA host. No physical phone/tablet/desktop performance measurement was made.' },
  victoryFirstVisibleAfterFinishedFetchMs: firstVisible,
  scorePhysicalEntry: scoreFrames.length ? {
    observedMotion: scoreFrames.some(entry => Math.abs(entry.y) > .05 || Math.abs(entry.rotationDegrees) > .05),
    yRange: [Math.min(...scoreFrames.map(entry => entry.y)), Math.max(...scoreFrames.map(entry => entry.y))],
    rotationDegreesRange: [Math.min(...scoreFrames.map(entry => entry.rotationDegrees)), Math.max(...scoreFrames.map(entry => entry.rotationDegrees))],
    samples: scoreFrames,
  } : null,
  e2eStats,
  normalRecorderRecheck: recheck ? { source: recheckPath, status: recheck.status, passed: recheck.passed, failed: recheck.failed, flaky: recheck.flaky, skipped: recheck.skipped, completedAt: recheck.completedAt } : null,
  exactRouteRecheck: pathRecheck ? { source: pathRecheckPath, status: pathRecheck.status, passed: pathRecheck.passed, failed: pathRecheck.failed, flaky: pathRecheck.flaky, skipped: pathRecheck.skipped, completedAt: pathRecheck.completedAt } : null,
  noVideoFocusedCheck: noVideoReport ? { source: noVideoReportPath, status: noVideoReport.status, passed: noVideoReport.passed, failed: noVideoReport.failed, flaky: noVideoReport.flaky, skipped: noVideoReport.skipped, completedAt: noVideoReport.completedAt } : null,
  browserPageErrors: browser?.errors ?? null,
};
writeFileSync(join(directory, 'motion-performance-report.json'), JSON.stringify(report, null, 2) + '\n');
const concise = group => ({ sequences: group.length, medianSampleFpsRange: group.length ? [Math.min(...group.map(sequence => sequence.medianSampleFps)), Math.max(...group.map(sequence => sequence.medianSampleFps))] : null, maximumP95FrameGapMs: group.length ? Math.max(...group.map(sequence => sequence.p95FrameGapMs)) : null });
console.log(JSON.stringify({ responsive: concise(responsive), normalVideo: concise(sequences), noVideo: concise(noVideoSequences), victory: firstVisible, e2e: report.e2eStats }));
