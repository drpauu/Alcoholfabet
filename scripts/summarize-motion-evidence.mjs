import { readFileSync, writeFileSync } from 'node:fs';

const browser = JSON.parse(readFileSync('acceptance/MOTION_BROWSER_QA.json', 'utf8'));
const victory = JSON.parse(readFileSync('acceptance/MOTION_VICTORY_QA.json', 'utf8'));
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;
const rounded = value => value == null ? null : Math.round(value * 100) / 100;
const sequences = browser.evidence.map((entry) => {
  const frames = entry.frames;
  const gaps = frames.slice(1).map((frame, index) => frame.t - frames[index].t);
  const duration = frames.at(-1).t - frames[0].t;
  const first = frames[0];
  const moved = frames.find(frame => Math.hypot(frame.x - first.x, frame.y - first.y) > 3);
  const confirmed = frames.find(frame => ['MOVING', 'RESULT', 'FINISHED'].includes(frame.phase));
  return {
    type: entry.type,
    frameCount: frames.length,
    recordingMs: rounded(duration),
    averageSampleFps: rounded((frames.length - 1) / duration * 1000),
    medianSampleFps: rounded(1000 / percentile(gaps, .5)),
    p95FrameGapMs: rounded(percentile(gaps, .95)),
    longestFrameGapMs: rounded(Math.max(...gaps)),
    firstTravelAfterConfirmationMs: moved && confirmed ? rounded(moved.t - confirmed.t) : null,
    distinctTravelPoints: entry.summary?.travelPoints ?? null,
    revealedAtRecordingMs: rounded(entry.revealedAt),
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  environment: 'Playwright Chromium headless, 1440×900, no-preference, video recording enabled',
  method: 'requestAnimationFrame samples of computed SVG pawn transforms; browser and RPC scheduling are included. This measures the QA host, not a guarantee for other hardware.',
  input: ['acceptance/MOTION_BROWSER_QA.json', 'acceptance/MOTION_VICTORY_QA.json'],
  sequences,
  victoryFirstVisibleMs: Object.fromEntries(['crown', 'winner', 'score', 'actions'].map(target => [target, victory.timeline.find(entry => entry[target])?.t ?? null])),
};
writeFileSync('acceptance/motion-performance-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sequences: sequences.length, medianFpsRange: [Math.min(...sequences.map(sequence => sequence.medianSampleFps)), Math.max(...sequences.map(sequence => sequence.medianSampleFps))], maximumP95GapMs: Math.max(...sequences.map(sequence => sequence.p95FrameGapMs)), victory: report.victoryFirstVisibleMs }));
