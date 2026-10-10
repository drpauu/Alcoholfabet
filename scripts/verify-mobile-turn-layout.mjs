import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createTurnFixtureHarness } from './qa/turn-fixture.mjs';

// The real UI, hooks and JSON choreography run against isolated safe RPC views.
// Keep the production database, identities, question bank and scoreboard untouched.
const directory = 'acceptance/mobile-turn-layout';
await mkdir(join(directory, 'screenshots'), { recursive: true });
const errors = [], blocked = [], cases = [], layouts = [];
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), args: ['--no-sandbox'] });
const { server, open, ready, begins } = createTurnFixtureHarness(browser, { errors, blocked });
const rows = async path => (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse).filter(row => row.active);
const newRows = await rows('data/question-bank-1000/reviewed_1000.jsonl');
const oldRows = await rows('data/question-bank/reviewed_5000.jsonl');
const longest = rows => rows.reduce((a, b) => a.question_ca.length > b.question_ca.length ? a : b);

async function layout(page, label, { fullText = true } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.querySelector('.question-body')?.dataset.overflow !== undefined)).toBe(true);
  const metrics = await page.evaluate(() => {
    const copy = document.querySelector('.question-copy'), heading = copy.querySelector('h2');
    const bounds = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    const inViewport = r => r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
    const range = document.createRange(); range.selectNodeContents(heading);
    const r = bounds(copy), lines = [...range.getClientRects()];
    const fits = lines.every(line => line.top >= r.top - 2 && line.bottom <= r.bottom + 2 && line.left >= r.left - 2 && line.right <= r.right + 2);
    const panel = document.querySelector('.answer-space.has-content'), result = document.querySelector('.result-note');
    const buttons = [...document.querySelectorAll('.question-actions button')].map(bounds);
    return { width: innerWidth, height: innerHeight, phase: document.querySelector('[data-phase]').dataset.phase,
      fontSize: parseFloat(getComputedStyle(heading).fontSize), questionChars: heading.textContent.length,
      textFits: fits, scrollable: copy.scrollHeight > copy.clientHeight + 1, copyHeight: r.height,
      scrollHeight: copy.scrollHeight, copyOverflow: getComputedStyle(copy).overflowY,
      panelVisible: !panel || inViewport(bounds(panel)), panelSeparate: !panel || r.bottom <= bounds(panel).top + 1,
      resultVisible: !result || inViewport(bounds(result)),
      actionCount: buttons.length, actionsVisible: buttons.every(inViewport), actionsLargeEnough: buttons.every(r => r.height >= 44),
      boardHeight: document.querySelector('.game-board').clientHeight,
      documentFits: document.body.scrollHeight <= innerHeight + 1 && document.body.scrollWidth <= innerWidth + 1 };
  });
  layouts.push({ label, ...metrics });
  assert.ok(metrics.documentFits && metrics.actionsVisible && metrics.actionsLargeEnough && metrics.panelVisible && metrics.panelSeparate && metrics.resultVisible, JSON.stringify({ label, ...metrics }));
  assert.ok(metrics.fontSize >= 20 && metrics.copyHeight >= 47, JSON.stringify({ label, ...metrics }));
  if (fullText && (!metrics.textFits || metrics.scrollable)) await screenshot(page, `${label}-failure`);
  if (fullText) assert.ok(metrics.textFits && !metrics.scrollable, `Full question should fit: ${JSON.stringify({ label, ...metrics })}`);
  else if (!metrics.textFits) {
    assert.ok(metrics.scrollable && metrics.copyOverflow === 'auto');
    await page.locator('.question-copy').evaluate(element => { element.scrollTop = element.scrollHeight; });
    const lastLineVisible = await page.evaluate(() => {
      const box = document.querySelector('.question-copy'), heading = box.querySelector('h2'), range = document.createRange();
      range.selectNodeContents(heading);
      const lines = [...range.getClientRects()], last = lines.at(-1), rect = box.getBoundingClientRect();
      return last.bottom <= rect.bottom + 2 && last.top >= rect.top - 2;
    });
    assert.ok(lastLineVisible, 'The last line must be reachable without moving or hiding the controls');
    await page.locator('.question-copy').evaluate(element => { element.scrollTop = 0; });
  }
  return metrics;
}
async function screenshot(page, name) { await page.screenshot({ path: join(directory, 'screenshots', `${name}.png`) }); }
async function reveal(page) {
  await page.getByRole('button', { name: 'Mostra la resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Incorrecte', exact: true })).toBeEnabled();
}
async function checkToast(page, label, count) {
  await expect(page.locator('.drink-stage')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeDisabled();
  await expect(page.locator('.drink-stage')).toHaveAttribute('data-drink-count', String(count));
  const frame = await page.locator('.drink-stage').evaluate(async stage => {
    const sample = () => {
      const r = stage.querySelector('.drink-stage__caption').getBoundingClientRect();
      const glasses = [...stage.querySelectorAll('.drink-stage__glass')].map(element => element.getBoundingClientRect());
      return { captionFits: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
        glassesFit: glasses.every(r => r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1) };
    };
    const samples = [sample()];
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await new Promise(resolve => setTimeout(resolve, 900)); samples.push(sample());
      await new Promise(resolve => setTimeout(resolve, 900)); samples.push(sample());
    }
    return samples;
  });
  assert.ok(frame.every(sample => sample.captionFits && sample.glassesFit), JSON.stringify({ label, frame }));
  await screenshot(page, `${label}-toast`);
  await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
  await expect(page.locator('.drink-stage')).toHaveCount(0);
}

try {
  for (const [source, question] of [['new', longest(newRows)], ['old', longest(oldRows)]]) {
    for (const [width, height] of [[360, 640], [360, 800], [390, 844], [430, 932]]) {
      const label = `${source}-${width}x${height}`, reducedMotion = width === 390 || height === 640 ? 'no-preference' : 'reduce';
      const fixture = server({ questionText: question.question_ca, answerText: question.answer_ca });
      const { context, page } = await open(fixture, 'IN_PERSON_CONTROLLER', { viewport: { width, height }, mobile: true, reducedMotion });
      await ready(page); await layout(page, `${label}-question`, { fullText: source === 'new' || height >= 800 });
      await reveal(page); await layout(page, `${label}-answer`, { fullText: source === 'new' || height >= 800 });
      await screenshot(page, `${label}-answer`);
      await page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
      await checkToast(page, label, 2);
      await layout(page, `${label}-double-drink`, { fullText: source === 'new' || height >= 800 });
      await screenshot(page, `${label}-double-drink`);
      await page.getByRole('button', { name: 'Següent torn', exact: true }).click();
      await ready(page);
      assert.equal(fixture.model.game.currentTurn, 'TECLA'); assert.equal(begins(fixture).length, 2);
      await expect(page.locator('.drink-notice')).toHaveCount(0);
      await expect(page.locator('.question-copy')).toHaveJSProperty('scrollTop', 0);
      await reveal(page); await page.getByRole('button', { name: 'Correcte', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
      await layout(page, `${label}-correct-plus-one`, { fullText: source === 'new' || height >= 800 });
      await screenshot(page, `${label}-correct-plus-one`);
      cases.push({ name: label, status: 'PASS', phases: ['question', 'answer', 'double-drink', 'next-turn', 'correct-plus-one'], reducedMotion });
      await context.close();
    }
  }

  // Long answer wrapping and a smaller browser viewport while a question is open.
  const question = longest(newRows), answer = newRows.reduce((a, b) => a.answer_ca.length > b.answer_ca.length ? a : b).answer_ca;
  const stress = server({ plusOne: false, questionText: question.question_ca, answerText: answer });
  const small = await open(stress, 'IN_PERSON_CONTROLLER', { viewport: { width: 320, height: 640 }, mobile: true, reducedMotion: 'no-preference' });
  await ready(small.page); await reveal(small.page); await layout(small.page, '320x640-long-answer', { fullText: false });
  await small.page.setViewportSize({ width: 320, height: 568 });
  await layout(small.page, '320x568-browser-controls', { fullText: false });
  await screenshot(small.page, '320x568-answer');
  await small.page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
  await checkToast(small.page, '320x568-single', 1);
  await layout(small.page, '320x568-single-drink', { fullText: false });
  await screenshot(small.page, '320x568-single-drink');
  await small.page.setViewportSize({ width: 390, height: 844 });
  await layout(small.page, 'browser-controls-restore');
  cases.push({ name: 'Long answer and viewport resize: 320x640 → 320x568 → 390x844', status: 'PASS' });
  await small.context.close();

  const online = server({ online: true, tp: true, plusOne: false, questionText: question.question_ca, answerText: answer });
  const a = await open(online, 'PAU', { viewport: { width: 390, height: 844 }, mobile: true, reducedMotion: 'no-preference' });
  const b = await open(online, 'TECLA', { viewport: { width: 360, height: 640 }, mobile: true, reducedMotion: 'no-preference' });
  await ready(a.page); await ready(b.page);
  await layout(a.page, 'online-tp-open');
  await a.page.getByRole('button', { name: 'Jo responc!', exact: true }).click();
  await expect(b.page.getByRole('button', { name: 'Incorrecte', exact: true })).toBeEnabled();
  await expect(a.page.locator('.answer-panel')).toHaveCount(0);
  assert.ok(!Object.hasOwn(online.safe('PAU').question, 'answerCa'));
  await layout(a.page, 'online-tp-respondent');
  await layout(b.page, 'online-tp-judge', { fullText: false });
  await b.page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
  await checkToast(b.page, 'online-single', 1);
  await expect(a.page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
  await layout(a.page, 'online-result-respondent');
  await layout(b.page, 'online-result-judge');
  await expect(a.page.locator('.answer-panel')).toHaveCount(0);
  assert.ok(!Object.hasOwn(online.safe('PAU').question, 'answerCa'));
  await screenshot(b.page, 'online-judge-result');
  cases.push({ name: 'Two online devices: T&P, private answer, single drink, persistent result', status: 'PASS' });
  await a.context.close(); await b.context.close();

  for (const [width, height] of [[1024, 768], [1440, 900]]) {
    const fixture = server({ questionText: longest(oldRows).question_ca, answerText: longest(oldRows).answer_ca });
    const { context, page } = await open(fixture, 'IN_PERSON_CONTROLLER', { viewport: { width, height } });
    await ready(page); await reveal(page); await layout(page, `desktop-${width}x${height}-answer`);
    await page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
    await layout(page, `desktop-${width}x${height}-result`); await screenshot(page, `result-${width}x${height}`);
    cases.push({ name: `Desktop/tablet: ${width}x${height}`, status: 'PASS' }); await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
} catch (error) { errors.push(error.stack ?? String(error)); }
finally {
  await browser.close();
  const status = errors.length || blocked.length || cases.length !== 12 ? 'FAIL' : 'PASS';
  await writeFile(join(directory, 'BROWSER_REPORT.json'), JSON.stringify({ status, completedAt: new Date().toISOString(), scope: 'Real application and animations, isolated RPC/Realtime fixtures', cases, layouts, errors, blockedRequests: blocked, authCreated: 0, gamesCreated: 0, scoreChanges: 0 }, null, 2) + '\n');
  console.log(JSON.stringify({ status, cases: cases.length, layouts: layouts.length, errors, blockedRequests: blocked }));
  if (status !== 'PASS') process.exitCode = 1;
}
