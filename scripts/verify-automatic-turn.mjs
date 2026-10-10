import assert from 'node:assert/strict';
import { createTurnFixtureHarness } from './qa/turn-fixture.mjs';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Exercise the real App, session, repository and motion with an isolated RPC fixture.
// No Supabase authentication, games, questions or scores are written by this check.
const origin = 'http://127.0.0.1:5173';
const directory = 'acceptance/automatic-turn';
await mkdir(join(directory, 'screenshots'), { recursive: true });
const cases = [], errors = [], blocked = [];
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const { server, open, ready, begins } = createTurnFixtureHarness(browser, { origin, errors, blocked });

try {
  const fixture = server(), { context, page } = await open(fixture);
  await ready(page); assert.equal(begins(fixture).length, 1);
  for (const [width, height] of [[390, 844], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => ({ width: document.body.scrollWidth, height: document.body.scrollHeight }));
    assert.ok(geometry.width <= width && geometry.height <= height, 'Question must fit the viewport');
    await page.screenshot({ path: join(directory, 'screenshots', `question-${width}x${height}.png`) });
  }
  await page.getByRole('button', { name: 'Mostra la resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Incorrecte', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
  await expect(page.locator('[data-drink-count="2"]')).toContainText('Beu doble');
  await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
  assert.equal(begins(fixture).length, 1, 'Result must wait for the next-turn action');
  await page.getByRole('button', { name: 'Següent torn', exact: true }).click(); await ready(page);
  assert.equal(fixture.model.game.currentTurn, 'TECLA'); assert.equal(begins(fixture).length, 2);
  assert.equal(fixture.model.question.id, 'fixture-2');
  await page.reload(); await ready(page); assert.equal(begins(fixture).length, 2, 'Reload must retain the question');
  cases.push({ name: 'in-person: automatic start, next turn, double drink, reload, three viewports', status: 'PASS', beginIntents: 2 }); await context.close();

  const online = server({ online: true, lobby: true }), a = await open(online, 'PAU'), b = await open(online, 'TECLA');
  await expect(a.page.getByRole('button', { name: 'Començar la partida', exact: true })).toBeEnabled();
  assert.equal(begins(online).length, 0, 'Lobby must wait for the start-game action');
  await a.page.getByRole('button', { name: 'Començar la partida', exact: true }).click(); await ready(a.page); await ready(b.page);
  assert.deepEqual(begins(online).map(intent => intent.role), ['PAU']);
  await expect(a.page.locator('.answer-panel')).toHaveCount(0); await expect(b.page.locator('.answer-panel')).toContainText('Piano');
  assert.ok(!Object.hasOwn(online.safe('PAU').question, 'answerCa'));
  await b.page.getByRole('button', { name: 'Incorrecte', exact: true }).click();
  await expect(b.page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
  await b.page.getByRole('button', { name: 'Sortir', exact: true }).click();
  await a.page.getByRole('button', { name: 'Següent torn', exact: true }).click();
  await expect(b.page.locator('[data-phase]')).toHaveAttribute('data-phase', 'TURN_INTRO');
  assert.equal(begins(online).length, 1, 'The confirmation must pause automatic start on the next player device');
  await b.page.getByRole('button', { name: 'Continuar jugant', exact: true }).click(); await ready(a.page); await ready(b.page);
  assert.deepEqual(begins(online).map(intent => intent.role), ['PAU', 'TECLA']);
  await expect(b.page.locator('.answer-panel')).toHaveCount(0); await expect(a.page.locator('.answer-panel')).toContainText('Piano');
  assert.ok(!Object.hasOwn(online.safe('TECLA').question, 'answerCa'));
  cases.push({ name: 'online: lobby, automatic PAU/TECLA turns, safe answers, open confirmation pauses start', status: 'PASS', beginIntents: 2 }); await a.context.close(); await b.context.close();

  const tp = server({ tp: true }), disputed = await open(tp); await ready(disputed.page);
  await expect(disputed.page.locator('[data-phase]')).toHaveAttribute('data-phase', 'TP_OPEN');
  await disputed.page.getByRole('button', { name: 'En Pau respon!', exact: true }).click(); await ready(disputed.page);
  assert.equal(tp.model.game.tpClaimant, 'PAU'); assert.equal(begins(tp).length, 1);
  cases.push({ name: 'T&P: automatic question preserves claim', status: 'PASS' }); await disputed.context.close();

  const failed = server({ failures: 1 }), retry = await open(failed);
  await expect(retry.page.locator('[data-phase]')).toHaveAttribute('data-phase', 'TURN_INTRO');
  await retry.page.waitForTimeout(4000);
  await expect(retry.page.locator('.error-message')).toHaveCount(0);
  await expect(retry.page.locator('.error-message')).toBeVisible({ timeout: 10000 }); await retry.page.waitForTimeout(350);
  assert.equal(begins(failed).length, 1, 'Failed intent must not loop');
  await retry.page.locator('.error-message button').click(); await ready(retry.page); assert.equal(begins(failed).length, 2);
  cases.push({ name: 'RPC failure: no loop, dismissing the error retries', status: 'PASS' }); await retry.context.close();

  const inaccessible = server({ bootOffline: true }), initial = await open(inaccessible);
  await expect(initial.page.locator('.setup-screen')).toBeVisible();
  await initial.page.waitForTimeout(4000);
  await expect(initial.page.getByText('Cal connexió per continuar la partida.', { exact: true })).toHaveCount(0);
  await expect(initial.page.getByText('Cal connexió per continuar la partida.', { exact: true })).toBeVisible({ timeout: 10000 });
  inaccessible.restoreAccess();
  await initial.page.getByRole('button', { name: 'Torna-ho a provar', exact: true }).click();
  await ready(initial.page); assert.equal(begins(inaccessible).length, 1);
  cases.push({ name: 'initial network failure: five-second grace, persistent error and retry recovery', status: 'PASS' }); await initial.context.close();

  const offline = server(), reconnect = await open(offline, 'IN_PERSON_CONTROLLER', { connection: 'reconnecting' });
  await expect(reconnect.page.locator('[data-phase]')).toBeVisible();
  await reconnect.page.waitForTimeout(4500);
  await expect(reconnect.page.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
  await expect(reconnect.page.locator('.connection-overlay')).toHaveClass(/is-visible/); assert.equal(begins(offline).length, 0);
  await reconnect.page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-connection', { detail: 'connected' })));
  await expect(reconnect.page.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
  await ready(reconnect.page); assert.equal(begins(offline).length, 1);
  cases.push({ name: 'persistent disconnect: no notice before five seconds; begin after recovery', status: 'PASS' }); await reconnect.context.close();

  const brief = server(), recovered = await open(brief, 'IN_PERSON_CONTROLLER', { connection: 'reconnecting' });
  await expect(recovered.page.locator('[data-phase]')).toBeVisible();
  await recovered.page.evaluate(() => {
    window.__qaNotices = [];
    new MutationObserver(() => {
      if (document.querySelector('.connection-overlay')?.classList.contains('is-visible')) window.__qaNotices.push(performance.now());
    }).observe(document.querySelector('.connection-overlay'), { attributes: true });
  });
  await recovered.page.waitForTimeout(1700);
  await expect(recovered.page.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
  await recovered.page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-connection', { detail: 'connected' })));
  await ready(recovered.page);
  assert.equal(begins(brief).length, 1);
  assert.deepEqual(await recovered.page.evaluate(() => window.__qaNotices), []);
  cases.push({ name: 'brief disconnect: recovery without connection or reconnected notice', status: 'PASS' }); await recovered.context.close();

  const newRows = (await readFile('data/question-bank-1000/reviewed_1000.jsonl', 'utf8')).trim().split('\n').map(JSON.parse);
  const oldRows = (await readFile('data/question-bank/reviewed_5000.jsonl', 'utf8')).trim().split('\n').map(JSON.parse);
  const longest = rows => rows.filter(row => row.active).sort((a, b) => b.question_ca.length - a.question_ca.length)[0];
  const layouts = [];
  for (const [source, question] of [['new', longest(newRows)], ['old', longest(oldRows)]]) {
    for (const [width, height, reducedMotion] of [[360, 800, 'reduce'], [390, 844, 'reduce'], [430, 932, 'reduce'], [390, 844, 'no-preference']]) {
      const mobile = server({ questionText: question.question_ca, answerText: question.answer_ca }), device = await open(mobile, 'IN_PERSON_CONTROLLER', { reducedMotion });
      await ready(device.page);
      await device.page.setViewportSize({ width, height });
      for (const phase of ['question', 'answer']) {
        if (phase === 'answer' && mobile.model.game.phase !== 'ANSWER_REVEALED') {
          await device.page.getByRole('button', { name: 'Mostra la resposta', exact: true }).click();
          await expect(device.page.getByRole('button', { name: 'Incorrecte', exact: true })).toBeEnabled();
        }
        await expect(device.page.locator('[data-phase]')).toHaveAttribute('data-phase', phase === 'question' ? 'QUESTION' : 'ANSWER_REVEALED');
        await device.page.evaluate(() => document.fonts.ready);
        await device.page.waitForTimeout(100);
        const layout = await device.page.evaluate(() => {
          const box = document.querySelector('.question-copy'), heading = box.querySelector('h2');
          const rect = box.getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(heading);
          const lines = [...range.getClientRects()];
          const actions = [...document.querySelectorAll('.question-actions button')].map(button => button.getBoundingClientRect());
          return { chars: heading.textContent.length, fontSize: parseFloat(getComputedStyle(heading).fontSize), scrollable: box.scrollHeight > box.clientHeight + 1,
            textFits: lines.every(line => line.top >= rect.top - 2 && line.bottom <= rect.bottom + 2 && line.left >= rect.left - 2 && line.right <= rect.right + 2),
            actionsVisible: actions.every(button => button.top >= 0 && button.bottom <= innerHeight + 1),
            documentFits: document.body.scrollWidth <= innerWidth && document.body.scrollHeight <= innerHeight };
        });
        assert.ok(layout.documentFits && layout.actionsVisible, JSON.stringify({ source, width, height, phase, ...layout }));
        assert.ok(layout.fontSize >= 20);
        assert.ok(layout.textFits || layout.scrollable, 'Every question is fully visible or internally scrollable');
        if (source === 'new') assert.ok(layout.textFits && !layout.scrollable, 'The new bank fits ordinary mobile turns without scrolling');
        layouts.push({ source, width, height, phase, reducedMotion, ...layout });
        await device.page.screenshot({ path: join(directory, 'screenshots', `long-${source}-${phase}-${width}x${height}${reducedMotion === 'no-preference' ? '-motion' : ''}.png`) });
      }
      await device.context.close();
    }
  }
  cases.push({ name: 'mobile: longest approved old/new prompts remain readable with answers and reachable controls', status: 'PASS', layouts });
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
} catch (error) { errors.push(error.stack ?? String(error)); }
finally {
  await browser.close();
  const status = errors.length || blocked.length || cases.length !== 8 ? 'FAIL' : 'PASS';
  await writeFile(join(directory, 'BROWSER_REPORT.json'), JSON.stringify({ status, completedAt: new Date().toISOString(), scope: 'Real App, useGameSession, useGameChannel, GameRepository, motion; isolated RPC and Realtime transport fixtures', cases, errors, blockedRequests: blocked, authCreated: 0, gamesCreated: 0, scoreChanges: 0 }, null, 2) + '\n');
  console.log(JSON.stringify({ status, cases: cases.length, errors, blockedRequests: blocked }));
  if (status !== 'PASS') process.exitCode = 1;
}
