import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir, rename, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'acceptance/art-redesign');
const screenshots = join(output, 'screenshots');
const baseURL = process.env.TECLA_VISUAL_URL ?? 'http://127.0.0.1:5173';
const baselineStorage = process.env.TECLA_ART_BASELINE_STORAGE ?? '/tmp/tecla-pau-art-baseline-storage.json';
const manifestPath = join(output, 'QA_MANIFEST.json');
const smoke = process.argv.includes('--smoke');
const customOnly = process.argv.includes('--custom-only');
const onlineOnly = process.argv.includes('--online-only');
const onlineFromArgument = process.argv.find((argument) => argument.startsWith('--online-from-width='));
const onlineFrom = onlineFromArgument ? Number(onlineFromArgument.split('=')[1]) : 390;
const sizes = [[390, 844], [1024, 768], [1440, 900]];
if (!sizes.some(([width]) => width === onlineFrom)) throw new Error('QA_INVALID_ONLINE_RESUME_SIZE');
const resumeAtArgument = process.argv.find((argument) => argument.startsWith('--resume-at='));
const resumeAt = resumeAtArgument ? Number(resumeAtArgument.split('=')[1]) : null;
if (resumeAt !== null && !sizes.some(([width]) => width === resumeAt)) throw new Error('QA_INVALID_RESUME_SIZE');
const env = Object.fromEntries((await readFile(join(root, '.env.local'), 'utf8')).split('\n').filter((line) => line.includes('=')).map((line) => {
  const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim()];
}));
const projectUrl = env.VITE_SUPABASE_URL;
const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
const baseline = JSON.parse(await readFile(join(root, 'audit/art-redesign-before/before-visual-metrics.json'), 'utf8'));
let manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { scope: 'art-redesign', userIds: [], gameIds: [], users: [], games: [], captures: [] };
await mkdir(screenshots, { recursive: true });
let manifestWrites = Promise.resolve();
const saveManifest = () => {
  manifestWrites = manifestWrites.then(async () => {
    manifest.updatedAt = new Date().toISOString();
    await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2) + '\n');
    await rename(`${manifestPath}.tmp`, manifestPath);
  });
  return manifestWrites;
};
let writes = Promise.resolve();
function remember(userId, gameId = null, source = 'art-capture', status = null) {
  writes = writes.then(async () => {
    if (userId && !manifest.userIds.includes(userId)) { manifest.userIds.push(userId); manifest.users.push({ userId, source }); }
    if (gameId && !manifest.gameIds.includes(gameId)) { manifest.gameIds.push(gameId); manifest.games.push({ gameId, userId, source, status }); }
    else if (gameId && status) { const record = manifest.games.find((game) => game.gameId === gameId); if (record) record.status = status; }
    await saveManifest();
  });
  return writes;
}
await remember(baseline.userId, baseline.gameId, 'explicit-root-baseline', 'ACTIVE');
const code = (await readFile(process.env.TECLA_ACCESS_CODE_FILE ?? join(homedir(), '.config/tecla-pau/access-code.txt'), 'utf8')).trim();
const redact = (value) => String(value).split(code).join('[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]');
const checkpoint = resumeAt === null && !onlineOnly ? null : JSON.parse(await readFile(join(output, 'CAPTURE_PROGRESS.json'), 'utf8'));
const errors = checkpoint?.errors ?? [];
const retryOnlineScenarios = ['loading', 'private-access', 'private-access-error', 'online-choice', 'role'];
const metrics = checkpoint?.metrics.filter((capture) => onlineOnly ? !retryOnlineScenarios.includes(capture.scenario) : capture.width < resumeAt) ?? [];
const interactionMetrics = checkpoint?.interactionMetrics?.filter((capture) => onlineOnly || capture.width < resumeAt) ?? [];
const dialogMetrics = checkpoint?.dialogMetrics?.filter((capture) => onlineOnly || capture.width < resumeAt) ?? [];
const coverage = new Set(metrics.map((capture) => `${capture.scenario}:${capture.width}x${capture.height}`));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const contexts = [];

async function context(storageState, width = 390, height = 844) {
  const value = await browser.newContext({ storageState, viewport: { width, height }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  contexts.push(value);
  value.on('page', (page) => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname === '/auth/v1/signup') void response.json().then((body) => {
        if (body.user?.id) return remember(body.user.id, null, 'anonymous-art-qa');
      }).catch(() => undefined);
      if (pathname === '/rest/v1/rpc/create_game') void response.json().then((body) => {
        if (body.game?.id && body.viewer?.userId) return remember(body.viewer.userId, body.game.id, 'art-create-rpc', body.game.status);
      }).catch(() => undefined);
    });
  });
  return value;
}
async function rpc(page, name, body) {
  return page.evaluate(async ({ projectUrl, publishable, storageKey, name, body }) => {
    const token = JSON.parse(localStorage.getItem(storageKey) ?? '{}').access_token;
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: {
      apikey: publishable, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(`QA_RPC_${name}_${result.message ?? response.status}`);
    return result;
  }, { projectUrl, publishable, storageKey, name, body });
}
async function view(page) {
  const gameId = await page.locator('[data-game-id]').getAttribute('data-game-id');
  const result = await rpc(page, 'get_game_view', { p_game_id: gameId });
  await remember(result.viewer.userId, result.game.id, 'art-capture', result.game.status);
  return result;
}
async function click(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled({ timeout: 25000 });
  await button.click();
}
async function action(page, name) {
  const old = Number(await page.locator('[data-state-version]').getAttribute('data-state-version'));
  await click(page, name);
  await expect.poll(async () => Number(await page.locator('[data-state-version]').getAttribute('data-state-version')), { timeout: 25000 }).toBeGreaterThan(old);
}
async function settled(page) {
  await expect(page.locator('.connection-overlay')).not.toHaveClass(/is-visible/, { timeout: 25000 });
  if (await page.locator('.question-card').count()) await expect(page.locator('.question-card')).toHaveAttribute('aria-busy', 'false', { timeout: 25000 });
}
async function open(page, captureAccess = false) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  if (captureAccess) {
    const loading = page.getByRole('status').filter({ hasText: 'Preparem la taula…' });
    if (await loading.isVisible()) await screenshot(page, 'loading', sizes[0], { resize: false });
  }
  await expect(page.getByRole('button', { name: 'Entrar', exact: true }).or(page.getByRole('button', { name: 'Jugar en persona', exact: true })).or(page.locator('[data-game-id]'))).toBeVisible({ timeout: 25000 });
  if (await page.getByLabel('Codi privat', { exact: true }).isVisible()) {
    if (captureAccess) {
      for (const size of sizes) await screenshot(page, 'private-access', size);
      await page.getByLabel('Codi privat', { exact: true }).fill('QA-INVALID');
      await click(page, 'Entrar');
      await expect(page.getByRole('alert')).toContainText('El codi no és correcte.', { timeout: 25000 });
      for (const size of sizes) await screenshot(page, 'private-access-error', size);
      await page.getByRole('alert').getByRole('button', { name: 'Tancar', exact: true }).click();
    }
    await page.getByLabel('Codi privat', { exact: true }).fill(code);
    await click(page, 'Entrar');
  }
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true }).or(page.locator('[data-game-id]'))).toBeVisible({ timeout: 25000 });
}
async function ownGameToHome(page) {
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true }).or(page.locator('[data-game-id]'))).toBeVisible({ timeout: 25000 });
  if (await page.locator('[data-game-id]').count()) {
    // Do not register a discovered game to make it eligible for mutation.
    const gameId = await page.locator('[data-game-id]').getAttribute('data-game-id');
    if (!manifest.gameIds.includes(gameId)) throw new Error('QA_REFUSE_UNLISTED_GAME');
    const state = await view(page);
    if (['ACTIVE', 'LOBBY'].includes(state.game.status)) {
      await rpc(page, 'apply_game_action', { p_game_id: state.game.id, p_action: 'ABANDON_GAME',
        p_expected_state_version: state.game.stateVersion, p_idempotency_key: crypto.randomUUID(), p_payload: {} });
      await remember(state.viewer.userId, state.game.id, 'art-qa-abandoned', 'ABANDONED');
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible({ timeout: 25000 });
    }
    await click(page, 'Anar a l’inici');
  }
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
}
async function screenshot(page, scenario, size, options = {}) {
  const [width, height] = size;
  if (options.resize !== false) { await page.setViewportSize({ width, height }); await page.waitForTimeout(120); }
  await page.evaluate(async () => { await document.fonts.ready; });
  const suffix = options.suffix ? `-${options.suffix}` : '';
  const path = join(screenshots, `${scenario}${suffix}-${width}x${height}.png`);
  const layout = await page.evaluate(() => {
    const rect = (selector) => Array.from(document.querySelectorAll(selector)).find(visible)?.getBoundingClientRect().toJSON() ?? null;
    const visible = (element) => {
      if (!element.getBoundingClientRect().width) return false;
      while (element) { const style = getComputedStyle(element); if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < .05) return false; element = element.parentElement; }
      return true;
    };
    const modal = document.querySelector('dialog[open]');
    const controls = Array.from(document.querySelectorAll('button')).filter((element) => visible(element) && (!modal || modal.contains(element)));
    return { phase: document.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null,
      gameId: document.querySelector('[data-game-id]')?.getAttribute('data-game-id') ?? null,
      stateVersion: document.querySelector('[data-state-version]')?.getAttribute('data-state-version') ?? null,
      bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
      card: rect('.question-card'), board: rect('.game-board'), panel: rect('.card-column .art-panel') ?? rect('.art-panel'),
      activeAnimations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      feedback: ['correctHalo', 'correctCheck', 'errorHalo', 'errorCross', 'drinkGlass', 'plusOneBadge', 'crown', 'confetti'].map((target) => {
        const element = document.querySelector(`[data-motion="${target}"]`);
        return { target, visible: element ? visible(element) : false, opacity: element ? Number(getComputedStyle(element).opacity) : 0, bounds: element?.getBoundingClientRect().toJSON() ?? null };
      }),
      controls: controls.map((button) => ({ label: button.textContent.trim() || button.getAttribute('aria-label'), ...button.getBoundingClientRect().toJSON(), disabled: button.disabled, artButton: button.classList.contains('art-button') })),
      judgeControls: Array.from(document.querySelectorAll('.judge-controls button')).map((button) => {
        const style = getComputedStyle(button), rect = button.getBoundingClientRect();
        return { label: button.textContent.trim(), width: rect.width, height: rect.height, fontSize: style.fontSize, fontWeight: style.fontWeight, borderWidth: style.borderWidth, padding: style.padding, shadow: style.boxShadow };
      }),
      textFit: ['.question-copy', '.answer-panel', '.card-category', '.art-button__label'].flatMap((selector) => Array.from(document.querySelectorAll(selector)).filter(visible).map((element) => ({ selector, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))),
      pawns: ['PAU', 'TECLA'].map((player) => { const element = document.querySelector(`[data-motion="pawn-${player}"]`); return { player, transform: element ? getComputedStyle(element).transform : null }; }),
    };
  });
  await page.screenshot({ path });
  const capture = { scenario, suffix: options.suffix ?? null, width, height, path: path.slice(root.length + 1), motionSampleMs: options.motionSampleMs ?? null, layout };
  metrics.push(capture); coverage.add(`${scenario}:${width}x${height}`); manifest.captures.push({ scenario, width, height, path: capture.path }); await saveManifest();
  await writeFile(join(output, 'CAPTURE_PROGRESS.json'), JSON.stringify({ mode: customOnly ? 'custom-only' : smoke ? 'smoke' : 'full', capturedAt: new Date().toISOString(), latest: { scenario, width, height }, captures: metrics.length, errors, metrics, interactionMetrics, dialogMetrics }, null, 2) + '\n');
  console.log(JSON.stringify({ capture: scenario, size: `${width}x${height}`, number: metrics.length }));
  if (!smoke && options.assertLayout !== false) {
    expect(layout.bodyWidth).toBeLessThanOrEqual(width);
    expect(layout.bodyHeight).toBeLessThanOrEqual(height);
    for (const control of layout.controls) {
      expect(control.artButton, control.label).toBe(true);
      expect(control.width, control.label).toBeGreaterThanOrEqual(47.5); expect(control.height, control.label).toBeGreaterThanOrEqual(47.5);
      expect(control.left, control.label).toBeGreaterThanOrEqual(-.5); expect(control.top, control.label).toBeGreaterThanOrEqual(-.5);
      expect(control.right, control.label).toBeLessThanOrEqual(width + .5); expect(control.bottom, control.label).toBeLessThanOrEqual(height + .5);
    }
    if (layout.judgeControls.length === 2) {
      const [incorrect, correct] = layout.judgeControls;
      expect(Math.abs(incorrect.width - correct.width)).toBeLessThan(1); expect(incorrect.height).toBe(correct.height);
      expect(incorrect.fontSize).toBe(correct.fontSize); expect(incorrect.fontWeight).toBe(correct.fontWeight); expect(incorrect.borderWidth).toBe(correct.borderWidth);
    }
    for (const fit of layout.textFit.filter((value) => value.clientWidth > 0)) expect(fit.scrollWidth, fit.selector).toBeLessThanOrEqual(fit.clientWidth + 1);
    const gamePanel = layout.card ?? layout.panel;
    if (layout.board && gamePanel) {
      if (width <= 600) expect(gamePanel.top, 'mobile board/card overlap').toBeGreaterThanOrEqual(layout.board.bottom + 8);
      else expect(gamePanel.left, 'desktop board/card overlap').toBeGreaterThanOrEqual(layout.board.right + 8);
    }
  }
  return capture;
}
async function interactionAudit(page, size) {
  const records = [];
  const count = await page.locator('button:visible:not(:disabled)').count();
  for (let index = 0; index <= count; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLButtonElement)) return null;
      const style = getComputedStyle(element);
      return { label: element.textContent.trim() || element.getAttribute('aria-label'), focusVisible: element.matches(':focus-visible'), outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineColor: style.outlineColor, shadow: style.boxShadow };
    });
    if (focus && !records.some((record) => record.label === focus.label)) records.push(focus);
  }
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  const audit = { width: size[0], height: size[1], records, allFocusVisible: records.every((record) => record.focusVisible && record.outlineWidth >= 2 && record.outlineStyle !== 'none') };
  interactionMetrics.push(audit);
  if (!smoke) { expect(records.length).toBeGreaterThan(0); expect(audit.allFocusVisible).toBe(true); }
  return audit;
}
async function trackMotion(page, player) {
  await page.evaluate((player) => {
    window.__artQaFrames = { start: performance.now(), running: true, frames: [] };
    const record = window.__artQaFrames;
    const sample = (rafTime) => {
      if (window.__artQaFrames !== record || !record.running) return;
      const pawn = document.querySelector(`[data-motion="pawn-${player}"]`);
      const transform = pawn ? new DOMMatrixReadOnly(getComputedStyle(pawn).transform) : new DOMMatrixReadOnly();
      const badge = document.querySelector('[data-motion="plusOneBadge"]');
      record.frames.push({ t: rafTime - record.start, x: transform.e, y: transform.f, activeAnimations: document.getAnimations().filter((a) => a.playState === 'running').length, plusOpacity: badge ? Number(getComputedStyle(badge).opacity) : 0 });
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  }, player);
}
async function stopMotion(page) { return page.evaluate(() => { window.__artQaFrames.running = false; return window.__artQaFrames.frames; }); }
async function atMotionTime(page, milliseconds) {
  const elapsed = await page.evaluate(() => performance.now() - (window.__artQaFrames.eventStart ?? window.__artQaFrames.start));
  await page.waitForTimeout(Math.max(0, milliseconds - elapsed));
}

try {
  const main = await context(baselineStorage);
  const page = await main.newPage();
  await open(page);
  if (customOnly) {
    await ownGameToHome(page); await click(page, 'Jugar en persona'); await click(page, 'Personalitzada');
    await page.getByLabel('Durada en minuts', { exact: true }).fill('45');
    for (const size of sizes) await screenshot(page, 'duration-custom', size);
    const path = join(output, 'VISUAL_CAPTURE_REPORT.json');
    const previous = JSON.parse(await readFile(path, 'utf8'));
    previous.metrics = previous.metrics.filter((capture) => capture.scenario !== 'duration-custom').concat(metrics);
    previous.captures = previous.metrics.length; previous.customDurationRecapturedAt = new Date().toISOString();
    await writeFile(path, JSON.stringify(previous, null, 2) + '\n');
    console.log(JSON.stringify({ recaptured: 'duration-custom', captures: metrics.length, errors, noGameMutations: true }));
  } else if (smoke) {
    const state = await view(page);
    expect(state.game.id).toBe(baseline.gameId);
    await settled(page);
    for (const size of sizes) { await screenshot(page, 'vertical-system-smoke', size); await interactionAudit(page, size); }
    await writeFile(join(output, 'SMOKE_REPORT.json'), JSON.stringify({ backend: 'real Supabase', readOnly: true, gameId: state.game.id, userId: state.viewer.userId, stateVersion: state.game.stateVersion, errors, metrics, interactionMetrics, noSecrets: true }, null, 2) + '\n');
    console.log(JSON.stringify({ mode: 'smoke', gameId: state.game.id, captures: metrics.length, errors }));
  } else {
    for (const size of sizes.filter(([width]) => !onlineOnly && (resumeAt === null || width >= resumeAt))) {
      await page.setViewportSize({ width: size[0], height: size[1] });
      await ownGameToHome(page);
      await screenshot(page, 'home', size);
      await click(page, 'Normes'); await expect(page.locator('dialog[open]')).toBeVisible();
      await screenshot(page, 'norms', size); await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Normes', exact: true })).toBeFocused();
      dialogMetrics.push({ scenario: 'norms', width: size[0], height: size[1], closedWith: 'Escape', focusRestored: true });
      await click(page, 'Jugar en persona');
      await expect(page.getByRole('heading', { name: 'Quant de temps voleu que duri la partida?', exact: true })).toBeVisible();
      await screenshot(page, 'duration', size);
      await click(page, 'Personalitzada'); await page.getByLabel('Durada en minuts', { exact: true }).fill('45'); await screenshot(page, 'duration-custom', size);
      await click(page, '60 minuts'); await click(page, 'Continuar'); await screenshot(page, 'starter', size); await click(page, 'Pau en Pau');
      await expect(page.locator('[data-game-id]')).toBeVisible();
      let state = await view(page); await settled(page);
      await screenshot(page, 'turn-intro', size);
      await click(page, 'Sortir'); await expect(page.locator('dialog[open]')).toBeVisible();
      await screenshot(page, 'abandon-confirmation', size); await click(page, 'Continuar jugant');
      if (size[0] === 390 || size[0] === 1024) {
        const rotated = size[0] === 390 ? [844, 390] : [768, 1024];
        await page.setViewportSize({ width: rotated[0], height: rotated[1] });
        await expect(page.locator('.orientation-gate')).toBeVisible();
        await screenshot(page, 'rotation', rotated, { assertLayout: false });
        await page.setViewportSize({ width: size[0], height: size[1] }); await settled(page);
      }
      let sawIncorrect = false, sawCorrect = false, sawQuestion = false, sawAnswer = false, sawTP = false, sawPlus = false;
      for (let turn = 0; turn < 45; turn += 1) {
        await action(page, 'Començar el torn'); state = await view(page); await settled(page);
        if (state.game.phase === 'TP_OPEN') {
          if (!sawTP) { await screenshot(page, 'tp', size); sawTP = true; }
          await action(page, 'En Pau respon!'); state = await view(page); await settled(page);
        }
        if (!sawQuestion) { expect(state.question).not.toHaveProperty('answerCa'); await screenshot(page, 'question', size); sawQuestion = true; }
        await action(page, 'Mostra la resposta'); await settled(page);
        if (!sawAnswer) { await screenshot(page, 'answer-revealed', size); await interactionAudit(page, size); sawAnswer = true; }
        state = await view(page);
        const respondent = state.game.respondingPlayer ?? state.game.currentTurn;
        const incorrect = !sawIncorrect || respondent === 'TECLA';
        await trackMotion(page, respondent);
        await action(page, incorrect ? 'Incorrecte' : 'Correcte');
        await page.evaluate(() => { window.__artQaFrames.eventStart = performance.now(); });
        if (incorrect && !sawIncorrect) {
          await atMotionTime(page, 200); await screenshot(page, 'incorrect', size, { resize: false, motionSampleMs: 200 });
          await atMotionTime(page, 360); await screenshot(page, 'incorrect', size, { resize: false, suffix: 'settled' }); sawIncorrect = true;
        }
        if (!incorrect && !sawCorrect) { await atMotionTime(page, 170); await screenshot(page, 'correct', size, { resize: false, motionSampleMs: 170 }); sawCorrect = true; }
        state = await view(page);
        if (!incorrect && state.lastEvent?.payload.plusOne && !sawPlus) {
          // CORRECT feedback 360ms + first step420ms + pause160ms: +1 pulse begins at940ms.
          await atMotionTime(page, 1050);
          await screenshot(page, 'plus-one', size, { resize: false, motionSampleMs: 1050 }); sawPlus = true;
        }
        if (state.game.status === 'FINISHED') {
          // Victory begins after the final movement; capture crown/confetti as well as final controls.
          await expect(page.locator('[data-motion="crown"]')).toHaveAttribute('data-ready', 'true', { timeout: 25000 });
          await page.waitForTimeout(130);
          await screenshot(page, 'victory', size, { resize: false, suffix: 'crown-paper', motionSampleMs: 1400 });
          await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeEnabled({ timeout: 25000 });
          await screenshot(page, 'victory', size, { resize: false });
          const frames = await stopMotion(page); await writeFile(join(output, `motion-victory-${size[0]}x${size[1]}.json`), JSON.stringify({ gameId: state.game.id, frames }, null, 2));
          expect(sawIncorrect && sawCorrect && sawQuestion && sawAnswer && sawTP && sawPlus).toBe(true);
          break;
        }
        await settled(page);
        const frames = await stopMotion(page);
        if (!incorrect && state.lastEvent?.payload.plusOne) await writeFile(join(output, `motion-plus-one-${size[0]}x${size[1]}.json`), JSON.stringify({ gameId: state.game.id, player: respondent, frames }, null, 2));
        if (turn === 1) {
          await main.setOffline(true); await expect(page.locator('.connection-overlay')).toHaveClass(/is-visible/);
          await page.waitForTimeout(240); await screenshot(page, 'disconnect', size, { resize: false });
          await main.setOffline(false); await settled(page); await page.waitForTimeout(1800);
          await expect(page.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
        }
        await action(page, 'Següent torn'); await settled(page);
      }
      await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeEnabled();
      await click(page, 'Anar a l’inici');
    }
    // Verify the densest supported board with an actual custom-duration game.
    if (!onlineOnly) {
    await click(page, 'Jugar en persona'); await click(page, 'Personalitzada');
    await page.getByLabel('Durada en minuts', { exact: true }).fill('100');
    await click(page, 'Continuar'); await click(page, 'Pau en Pau'); await view(page); await settled(page);
    for (const size of sizes) await screenshot(page, 'board-100-minutes', size);
    // Additional master-prompt sizes use a real, long server-selected question.
    let representative;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await action(page, 'Començar el torn'); await settled(page); representative = await view(page);
      if ((representative.question?.questionCa.length ?? 0) >= 75 || attempt === 11) break;
      await action(page, 'Mostra la resposta'); await settled(page); await action(page, 'Incorrecte'); await settled(page);
      await action(page, 'Següent torn'); await settled(page);
    }
    const additionalSizes = [[360, 800], [430, 932], [1366, 768]];
    for (const size of additionalSizes) await screenshot(page, 'question-extra', size);
    await action(page, 'Mostra la resposta'); await settled(page);
    for (const size of additionalSizes) { await screenshot(page, 'answer-revealed-extra', size); await interactionAudit(page, size); }
    for (const size of sizes) { await page.setViewportSize({ width: size[0], height: size[1] }); await settled(page); await interactionAudit(page, size); }
    await writeFile(join(output, 'ADDITIONAL_RESPONSIVE_REPORT.json'), JSON.stringify({ gameId: representative.game.id, questionLength: representative.question?.questionCa.length ?? 0, source: 'real server-selected question via legitimate turns', sizes: additionalSizes, noSecrets: true }, null, 2) + '\n');
    await page.setViewportSize({ width: 1440, height: 900 }); await settled(page);
    await click(page, 'Sortir'); await action(page, 'Abandonar la partida');
    await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible({ timeout: 25000 });
    }
    // Online lobby: actual two devices, private channel and Presence; no shared mocked role.
    const partner = await context(undefined, 390, 844); const other = await partner.newPage(); await open(other, true);
    for (const size of sizes.filter(([width]) => width >= onlineFrom)) {
      await ownGameToHome(page); await page.setViewportSize({ width: size[0], height: size[1] });
      await click(page, 'Jugar en línia'); await screenshot(page, 'online-choice', size); await click(page, 'Crear una partida'); await screenshot(page, 'role', size); await click(page, /Soc en Pau$/);
      await click(page, '30 minuts'); await click(page, 'Continuar'); await click(page, 'Pau en Pau');
      await expect(page.locator('[data-game-id]')).toBeVisible(); let lobby = await view(page);
      await ownGameToHome(other); await other.setViewportSize({ width: size[0], height: size[1] }); await click(other, 'Jugar en línia'); await click(other, 'Unir-se a una partida'); await click(other, /Soc la Tecla$/);
      await screenshot(other, 'join', size);
      await other.getByLabel('Codi de la partida', { exact: true }).fill(lobby.game.inviteCode); await click(other, 'Unir-se a una partida');
      await view(other); await settled(page); await settled(other);
      await expect(page.getByRole('button', { name: 'Començar la partida', exact: true })).toBeEnabled({ timeout: 25000 });
      await screenshot(page, 'online-lobby', size);
      // Supplement main-game TP snapshot with real online question protection.
      await action(page, 'Començar la partida'); await settled(page); await settled(other);
      await action(page, 'Començar el torn'); await settled(page); await settled(other);
      const respondent = await view(page), judge = await view(other);
      expect(respondent.question).not.toHaveProperty('answerCa'); expect(judge.question?.answerCa).toBeTruthy();
      await expect(page.locator('.answer-panel')).toHaveCount(0);
      await screenshot(page, 'online-respondent', size);
      await screenshot(other, 'online-judge', size);
      await click(page, 'Sortir'); await action(page, 'Abandonar la partida');
      await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible({ timeout: 25000 });
      await view(page);
      await screenshot(page, 'abandoned', size);
      await page.reload(); await other.reload();
    }
    const required = ['home', 'duration', 'online-lobby', 'turn-intro', 'question', 'answer-revealed', 'correct', 'incorrect', 'tp', 'plus-one', 'disconnect', 'victory'];
    const missing = required.flatMap((scenario) => sizes.filter(([w, h]) => !coverage.has(`${scenario}:${w}x${h}`)).map(([w, h]) => `${scenario}:${w}x${h}`));
    expect(missing).toEqual([]); expect(errors).toEqual([]);
    const report = { backend: 'real Supabase Anonymous Auth, RPCs and private Realtime', completedAt: new Date().toISOString(), requiredScenarios: required, sizes, missing, captures: metrics.length, errors, metrics, interactionMetrics, dialogMetrics, resumedAtWidth: resumeAt, resumedOnlineOnly: onlineOnly, noSecrets: true };
    await writeFile(join(output, 'VISUAL_CAPTURE_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
    const finalStorage = '/tmp/tecla-pau-art-final-storage.json';
    await writeFile(finalStorage, JSON.stringify(await main.storageState()), { mode: 0o600 }); await chmod(finalStorage, 0o600);
    console.log(JSON.stringify({ requiredScenarioCaptures: 36, captures: metrics.length, missing, errors, manifest: 'acceptance/art-redesign/QA_MANIFEST.json' }));
  }
} catch (error) {
  const failure = { status: 'FAIL', capturedAt: new Date().toISOString(), captures: metrics.length, error: redact(error instanceof Error ? error.message : error), noSecrets: true };
  await writeFile(join(output, 'CAPTURE_FAILURE.json'), JSON.stringify(failure, null, 2) + '\n');
  console.error(JSON.stringify(failure)); process.exitCode = 1;
} finally {
  await writes;
  await saveManifest();
  await writeFile(join(output, 'CAPTURE_PROGRESS.json'), JSON.stringify({ mode: customOnly ? 'custom-only' : smoke ? 'smoke' : 'full', captures: metrics.length, errors, metrics, interactionMetrics, dialogMetrics }, null, 2) + '\n');
  for (const value of contexts) await value.close();
  await browser.close();
}
