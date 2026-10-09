import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { createGame, currentView, projectUrl, trackQaContext } from './helpers';

const noVideoMode = process.env.TECLA_MOTION_NO_VIDEO === '1';
let noVideoSignupAttempts = 0;
if (noVideoMode) test.use({ screenshot: 'off' });

interface FrameSample { t: number; x: number; y: number; card: string; answer: boolean; phase: string | null; plusOpacity: number; drinkOpacity: number; errorOpacity: number }
interface BrowserRecording { started: number; frames: FrameSample[]; running: boolean }

async function motionContext(browser: Browser) {
  const storageState = noVideoMode ? JSON.parse(readFileSync('/tmp/tecla-pau-art-final-storage.json', 'utf8')) : undefined;
  if (storageState) {
    const stored = storageState.origins.flatMap((origin: { localStorage: { name: string; value: string }[] }) => origin.localStorage).find((entry: { name: string }) => entry.name.startsWith('sb-') && entry.name.endsWith('-auth-token'));
    const userId = JSON.parse(stored?.value ?? '{}').user?.id;
    const manifest = JSON.parse(readFileSync('acceptance/art-redesign/QA_MANIFEST.json', 'utf8'));
    if (!userId || !manifest.userIds.includes(userId)) throw new Error('MOTION_REFUSE_UNLISTED_SESSION');
  }
  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...(!noVideoMode ? { recordVideo: { dir: 'acceptance/art-redesign/videos/motion', size: { width: 1440, height: 900 } } } : {}) });
  if (noVideoMode) {
    noVideoSignupAttempts = 0;
    await context.route(`${projectUrl}/auth/v1/signup`, async (route) => { noVideoSignupAttempts += 1; await route.abort(); });
  }
  trackQaContext(context);
  return context;
}

function rememberGame(gameId: string, userId: string, status: string) {
  const path = process.env.TECLA_PAU_MOTION_MANIFEST || 'acceptance/art-redesign/QA_MOTION_MANIFEST.json';
  mkdirSync(dirname(path), { recursive: true });
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as { gameId: string; userId: string; status: string }[] : [];
  const remaining = previous.filter((entry) => entry.gameId !== gameId);
  writeFileSync(path, JSON.stringify([...remaining, { gameId, userId, status }], null, 2));
}

async function enterOrResume(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true }).or(page.locator('[data-game-id]'))).toBeVisible();
}

async function record(page: Page, player: 'PAU' | 'TECLA') {
  await page.evaluate((role) => {
    const host = window as Window & { motionQa?: BrowserRecording };
    host.motionQa = { started: performance.now(), frames: [], running: true };
    const recording = host.motionQa;
    const sample = (rafTime: number) => {
      if (host.motionQa !== recording || !recording.running) return;
      const pawn = document.querySelector(`[data-motion="pawn-${role}"]`);
      const transform = pawn ? new DOMMatrixReadOnly(getComputedStyle(pawn).transform) : new DOMMatrixReadOnly();
      const card = document.querySelector('[data-motion="questionCardInner"]');
      const plusBadge = document.querySelector('[data-motion="plusOneBadge"]');
      const drink = document.querySelector('[data-motion="drinkGlass"]'), errorMark = document.querySelector('[data-motion="errorCross"]');
      recording.frames.push({ t: rafTime - recording.started, x: transform.e, y: transform.f, card: card ? getComputedStyle(card).transform : '', answer: Boolean(document.querySelector('.answer-panel')), phase: document.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null, plusOpacity: plusBadge ? Number(getComputedStyle(plusBadge).opacity) : 0, drinkOpacity: drink ? Number(getComputedStyle(drink).opacity) : 0, errorOpacity: errorMark ? Number(getComputedStyle(errorMark).opacity) : 0 });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, player);
}

async function stopRecording(page: Page): Promise<FrameSample[]> {
  return page.evaluate(() => {
    const recording = (window as Window & { motionQa?: BrowserRecording }).motionQa;
    if (!recording) return [];
    recording.running = false;
    return recording.frames;
  });
}

async function syncedView(page: Page) {
  await expect(page.locator('[data-game-id]')).toBeVisible();
  const snapshot = await currentView(page);
  await expect(page.locator('[data-state-version]')).toHaveAttribute('data-state-version', String(snapshot.game.stateVersion));
  return snapshot;
}

function motionEvidence(frames: FrameSample[]) {
  const first = frames[0];
  const distinct = frames.filter((frame) => Math.hypot(frame.x - first.x, frame.y - first.y) > 3);
  return { count: frames.length, firstMotionMs: distinct[0]?.t, travelPoints: new Set(distinct.map((frame) => `${frame.x.toFixed(1)},${frame.y.toFixed(1)}`)).size };
}

function plusArrivalEvidence(frames: FrameSample[]) {
  const first = frames[0], last = frames.at(-1)!;
  const distance = (a: FrameSample, b: FrameSample) => Math.hypot(a.x - b.x, a.y - b.y);
  let start = 0;
  for (let index = 1; index <= frames.length; index += 1) {
    if (index < frames.length && distance(frames[index], frames[start]) < .35) continue;
    const end = frames[index - 1];
    if (end.t - frames[start].t >= 90 && distance(frames[start], first) > 3 && distance(frames[start], last) > 3) {
      const badge = frames.find((frame) => frame.plusOpacity > .05);
      return { firstArrivalMs: frames[start].t, badgeFirstVisibleMs: badge?.t, holdMs: end.t - frames[start].t };
    }
    start = index;
  }
  return null;
}

test('motion normal: gir al punt mig, recorregut continu i dues arribades +1', async ({ browser }) => {
  test.setTimeout(180000);
  const context = await motionContext(browser);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('acceptance/art-redesign/screenshots/motion', { recursive: true });
  await enterOrResume(page);
  if (noVideoMode && await page.locator('[data-game-id]').count()) {
    const gameId = await page.locator('[data-game-id]').getAttribute('data-game-id');
    const manifest = JSON.parse(readFileSync('acceptance/art-redesign/QA_MANIFEST.json', 'utf8'));
    if (!manifest.gameIds.includes(gameId)) throw new Error('MOTION_REFUSE_UNLISTED_GAME');
    const existing = await currentView(page);
    if (!['ABANDONED', 'FINISHED'].includes(existing.game.status)) throw new Error('MOTION_REFUSE_ACTIVE_EXISTING_GAME');
    await page.getByRole('button', { name: 'Anar a l’inici', exact: true }).click();
  }
  if (!await page.locator('[data-game-id]').count()) await createGame(page, false, 45);
  const initial = await currentView(page);
  rememberGame(initial.game.id, initial.viewer.userId, initial.game.status);
  const evidence: unknown[] = [];
  let bonus = false;
  let failed = false;
  for (let turn = 0; turn < 100; turn += 1) {
    let view = await syncedView(page);
    if (view.game.status === 'FINISHED') throw new Error('MOTION_QA_EXPECTED_ACTIVE_GAME');
    if (view.capabilities.canNextTurn) { await page.getByRole('button', { name: 'Següent torn', exact: true }).click(); await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /READY|TURN_INTRO/); }
    view = await syncedView(page);
    if (view.capabilities.canBeginTurn) { await page.getByRole('button', { name: 'Començar el torn', exact: true }).click(); await expect(page.locator('[data-phase]')).not.toHaveAttribute('data-phase', /READY|TURN_INTRO/); }
    view = await syncedView(page);
    if (view.game.phase === 'TP_OPEN') { await page.getByRole('button', { name: 'En Pau respon!', exact: true }).click(); await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', 'TP_CLAIMED'); }
    view = await syncedView(page);
    const respondent = view.game.respondingPlayer ?? view.game.currentTurn;
    if (view.capabilities.canReveal) {
      await record(page, respondent);
      await page.getByRole('button', { name: 'Mostra la resposta', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Correcte', exact: true })).toBeEnabled();
      const flip = await stopRecording(page);
      const revealedAt = flip.find((frame) => frame.answer)?.t ?? 0;
      expect(revealedAt).toBeGreaterThan(100);
      expect(flip.some((frame) => frame.card.startsWith('matrix3d'))).toBe(true);
      evidence.push({ type: 'ANSWER_REVEAL', revealedAt, frames: flip });
    }
    const incorrect = !failed;
    await record(page, respondent);
    await page.getByRole('button', { name: incorrect ? 'Incorrecte' : 'Correcte', exact: true }).click();
    if (incorrect) failed = true;
    await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /RESULT|MOVING|BETWEEN_TURNS/);
    view = await syncedView(page);
    if (view.game.status === 'FINISHED') throw new Error('MOTION_QA_META_MUST_WAIT_FOR_OTHER_SUITE');
    await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
    const frames = await stopRecording(page);
    const summary = motionEvidence(frames);
    writeFileSync(`acceptance/art-redesign/${noVideoMode ? 'MOTION_NO_VIDEO' : 'MOTION_BROWSER_QA'}_PROGRESS.json`, JSON.stringify({ gameId: view.game.id, evidence, current: { type: incorrect ? 'INCORRECT' : 'CORRECT', respondent, summary, frames }, errors }, null, 2));
    if (!incorrect) {
      expect(summary.travelPoints).toBeGreaterThan(8);
      expect(summary.firstMotionMs).toBeGreaterThan(300);
    }
    const plus = view.lastEvent?.payload.plusOne === true && !incorrect;
    if (plus) {
      const arrivals = plusArrivalEvidence(frames);
      expect(arrivals, 'Two arrivals include a visible pause at the intermediate cell').not.toBeNull();
      expect(arrivals!.badgeFirstVisibleMs, '+1 appears after the first landing').toBeGreaterThanOrEqual(arrivals!.firstArrivalMs);
    }
    evidence.push({ type: incorrect ? 'INCORRECT' : plus ? 'PLUS_ONE' : 'CORRECT', summary, frames });
    if (!noVideoMode) await page.screenshot({ path: `acceptance/art-redesign/screenshots/motion/${incorrect ? 'incorrect' : plus ? 'plus-one' : 'correct'}.png` });
    if (plus) { bonus = true; break; }
  }
  expect(bonus).toBe(true);
  await page.getByRole('button', { name: 'Següent torn', exact: true }).click();
  await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /READY|TURN_INTRO/);
  await page.getByRole('button', { name: 'Començar el torn', exact: true }).click();
  await expect(page.locator('[data-phase]')).not.toHaveAttribute('data-phase', /READY|TURN_INTRO/);
  const snapshot = await syncedView(page);
  writeFileSync(`acceptance/art-redesign/${noVideoMode ? 'MOTION_NO_VIDEO_FRAMES' : 'MOTION_BROWSER_QA'}.json`, JSON.stringify({ date: new Date().toISOString(), gameId: snapshot.game.id, errors, evidence, videoRecording: !noVideoMode, screenshotRecording: !noVideoMode, existingSessionOnly: noVideoMode, newAuthAttempts: noVideoMode ? noVideoSignupAttempts : null, isolatedRecorder: true, nativeRafTimestamps: true }, null, 2));
  expect(errors).toEqual([]);
  if (noVideoMode) expect(noVideoSignupAttempts).toBe(0);
  await page.getByRole('button', { name: 'Sortir', exact: true }).click();
  await page.getByRole('button', { name: 'Abandonar la partida', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
  const abandoned = await currentView(page);
  expect(abandoned.scoreboard.completedGames).toBe(initial.scoreboard.completedGames);
  rememberGame(abandoned.game.id, abandoned.viewer.userId, abandoned.game.status);
  const video = page.video();
  await context.close();
  await video?.saveAs('acceptance/art-redesign/videos/motion/card-and-plus-one.webm');
});

test('motion normal: META, corona, marcador i accions finals en seqüència', async ({ browser }) => {
  const context = await motionContext(browser);
  const page = await context.newPage();
  await enterOrResume(page);
  if (!await page.locator('[data-game-id]').count()) await createGame(page, false, 45);
  const initial = await currentView(page);
  rememberGame(initial.game.id, initial.viewer.userId, initial.game.status);
  for (let turn = 0; turn < 100; turn += 1) {
    let view = await syncedView(page);
    if (view.game.status === 'FINISHED') break;
    if (view.capabilities.canNextTurn) { await page.getByRole('button', { name: 'Següent torn', exact: true }).click(); await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /READY|TURN_INTRO/); }
    view = await syncedView(page);
    if (view.capabilities.canBeginTurn) { await page.getByRole('button', { name: 'Començar el torn', exact: true }).click(); await expect(page.locator('[data-phase]')).not.toHaveAttribute('data-phase', /READY|TURN_INTRO/); }
    view = await syncedView(page);
    if (view.game.phase === 'TP_OPEN') { await page.getByRole('button', { name: 'En Pau respon!', exact: true }).click(); await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', 'TP_CLAIMED'); }
    if (await page.getByRole('button', { name: 'Mostra la resposta', exact: true }).count()) await page.getByRole('button', { name: 'Mostra la resposta', exact: true }).click();
    await page.getByRole('button', { name: 'Correcte', exact: true }).click();
    await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /RESULT|MOVING|BETWEEN_TURNS|FINISHED/);
    view = await syncedView(page);
    if (view.game.status !== 'FINISHED') continue;
    const timeline: { t: number; crown: boolean; winner: boolean; score: boolean; actions: boolean; scoreTransform: string; scoreOpacity: number }[] = [];
    const start = Date.now();
    while (Date.now() - start < 4300) {
      const visibility = await page.evaluate(() => {
        const visible = (selector: string) => {
          let element = document.querySelector(selector);
          if (!element || !element.getBoundingClientRect().width) return false;
          while (element) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < .05) return false;
            element = element.parentElement;
          }
          return true;
        };
        const scoreTarget = document.querySelector('[data-motion="scoreTransition"]');
        return { crown: visible('[data-motion="crown"]'), winner: visible('[data-motion="winnerCard"][data-ready="true"]'), score: visible('[data-motion="scoreTransition"]'), actions: visible('[data-motion="finalActions"]'), scoreTransform: scoreTarget ? getComputedStyle(scoreTarget).transform : 'none', scoreOpacity: scoreTarget ? Number(getComputedStyle(scoreTarget).opacity) : 0 };
      });
      timeline.push({ t: Date.now() - start, ...visibility });
      await page.waitForTimeout(80);
    }
    const appeared = (target: 'crown' | 'winner' | 'score' | 'actions') => timeline.find((entry) => entry[target])?.t ?? Infinity;
    expect(appeared('crown')).toBeGreaterThan(500);
    expect(appeared('winner')).toBeGreaterThan(appeared('crown'));
    expect(appeared('score')).toBeGreaterThan(appeared('winner'));
    expect(appeared('actions')).toBeGreaterThan(appeared('score'));
    await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeEnabled();
    await page.screenshot({ path: 'acceptance/art-redesign/screenshots/motion/victory.png' });
    writeFileSync('acceptance/art-redesign/MOTION_VICTORY_QA.json', JSON.stringify({ gameId: view.game.id, timeline }, null, 2));
    rememberGame(view.game.id, view.viewer.userId, view.game.status);
    break;
  }
  await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeEnabled();
  const video = page.video();
  await context.close();
  await video?.saveAs('acceptance/art-redesign/videos/motion/victory.webm');
});
