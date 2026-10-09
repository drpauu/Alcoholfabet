import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { identifyOnline, clickAction, createGame, currentView, enter, makeContext, viewForGame, waitSynced } from './helpers';

const directory = 'acceptance/alcoholfabet';
const sizes = [[360, 800], [390, 844], [430, 932], [1024, 768], [1440, 900]] as const;

async function capture(page: Page, scene: string) {
  mkdirSync(`${directory}/screenshots`, { recursive: true });
  const layouts = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      const decoded = await Promise.allSettled(images.map(image => image.decode()));
      return decoded.every(result => result.status === 'fulfilled') && images.every(image => image.complete && image.naturalWidth > 0);
    })).toBe(true);
    const layout = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
      controls: Array.from(document.querySelectorAll('button')).filter(element => element.checkVisibility()).map(element => ({ label: element.textContent?.trim() || element.getAttribute('aria-label'), ...element.getBoundingClientRect().toJSON() })),
      notice: document.querySelector('.drink-notice')?.getBoundingClientRect().toJSON(),
      boardWindow: { start: document.querySelector('[data-board-window-start]')?.getAttribute('data-board-window-start'), end: document.querySelector('[data-board-window-end]')?.getAttribute('data-board-window-end') },
      backgroundFilter: getComputedStyle(document.querySelector('.scene-background img')!).filter,
    }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(width); expect(layout.bodyHeight).toBeLessThanOrEqual(height);
    for (const control of layout.controls) { expect(control.width).toBeGreaterThanOrEqual(47.5); expect(control.height).toBeGreaterThanOrEqual(47.5); expect(control.top).toBeGreaterThanOrEqual(0); expect(control.bottom).toBeLessThanOrEqual(height); }
    if (layout.notice) { expect(layout.notice.top).toBeGreaterThanOrEqual(0); expect(layout.notice.bottom).toBeLessThanOrEqual(height); }
    await page.screenshot({ path: `${directory}/screenshots/${scene}-${width}x${height}.png` });
    layouts.push({ width, height, ...layout });
  }
  writeFileSync(`${directory}/${scene}-LAYOUT.json`, JSON.stringify({ status: 'PASS', capturedAt: new Date().toISOString(), realApp: true, layouts }, null, 2));
}

test('presencial: got ple, noms i doble, tauler llarg i abandonar torna directament al menú', async ({ browser }) => {
  test.setTimeout(240000);
  const context = await makeContext(browser, 0);
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await enter(page); await createGame(page, false, 20);
    const initial = await currentView(page);
    expect(initial.game.finishPosition).toBe(17);
    expect(initial.board).toHaveLength(17);
    const beforeNavigation = initial.game.stateVersion;
    await expect(page.locator('[data-board-window-start]')).toHaveAttribute('data-board-window-start', '0');
    await page.getByRole('button', { name: 'Veure les caselles següents', exact: true }).click();
    await expect(page.locator('[data-board-window-start]')).toHaveAttribute('data-board-window-start', '10');
    expect((await currentView(page)).game.stateVersion).toBe(beforeNavigation);
    await page.getByRole('button', { name: 'Veure les caselles anteriors', exact: true }).click();
    let sawPau = false, sawTecla = false, sawDouble = false;
    const used = new Set<string>();
    for (let turn = 0; turn < 60 && !(sawPau && sawTecla && sawDouble); turn++) {
      await clickAction(page, 'Començar el torn');
      let view = await currentView(page);
      if (view.game.phase === 'TP_OPEN') { await clickAction(page, view.game.currentTurn === 'PAU' ? 'En Pau respon!' : 'La Tecla respon!'); view = await currentView(page); }
      expect(used.has(view.question!.id)).toBe(false); used.add(view.question!.id);
      await expect(page.locator('.voice-hint,.player-avatar')).toHaveCount(0);
      await expect(page.getByText('Respon en veu alta!', { exact: true })).toHaveCount(0);
      const respondent = view.game.respondingPlayer!;
      const bonus = view.board.find(cell => cell.position === view.game.currentTargetCell)?.modifier === 'PLUS_ONE';
      const fail = (respondent === 'PAU' && !sawPau) || (respondent === 'TECLA' && !sawTecla) || bonus;
      await clickAction(page, 'Mostra la resposta');
      await clickAction(page, fail ? 'Incorrecte' : 'Correcte');
      view = await currentView(page);
      if (fail) {
        await expect(page.getByRole('button', { name: 'Següent torn', exact: true })).toBeEnabled();
        const notice = page.locator('.drink-notice');
        await expect(notice).toHaveAttribute('data-drink-player', respondent);
        await expect(notice).toHaveAttribute('data-drink-count', bonus ? '2' : '1');
        await expect(notice).toContainText(respondent === 'PAU' ? 'En Pau ha de beure' : 'La Tecla ha de beure');
        await expect(notice.locator('img').first()).toHaveAttribute('src', '/assets/production/effects/drink-filled.svg');
        expect(view.lastEvent?.payload.respondingPlayer).toBe(respondent);
        expect(view.scoreboard).toEqual(initial.scoreboard);
        if (respondent === 'PAU' && !sawPau) { sawPau = true; await capture(page, 'drink-pau'); }
        if (respondent === 'TECLA' && !sawTecla) { sawTecla = true; await capture(page, 'drink-tecla'); }
        if (bonus && !sawDouble) { sawDouble = true; await expect(notice).toContainText('Beu doble'); await capture(page, 'drink-double'); }
      } else await expect(page.locator('.drink-notice')).toHaveCount(0);
      if (!(sawPau && sawTecla && sawDouble)) await clickAction(page, 'Següent torn');
    }
    expect(sawPau && sawTecla && sawDouble).toBe(true);
    await page.getByRole('button', { name: 'Sortir', exact: true }).click();
    // A failed RPC keeps the actual game and confirmation open, so it can be retried.
    await page.route('**/rest/v1/rpc/apply_game_action', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA_TRANSIENT_FAILURE' }) }));
    await page.getByRole('button', { name: 'Abandonar la partida', exact: true }).click();
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('[data-game-id]')).toHaveAttribute('data-game-id', initial.game.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.unroute('**/rest/v1/rpc/apply_game_action');
    await page.getByRole('button', { name: 'Abandonar la partida', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
    await expect(page.locator('[data-game-id]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reprendre la partida', exact: true })).toHaveCount(0);
    const abandoned = await viewForGame(page, initial.game.id);
    expect(abandoned.game.status).toBe('ABANDONED'); expect(abandoned.scoreboard).toEqual(initial.scoreboard);
    expect(abandoned.question).toBeNull();
    expect(await page.evaluate(() => ['tp-current-game', 'tp-active-game'].map(key => localStorage.getItem(key)))).toEqual([null, null]);
    await page.reload(); await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
    await capture(page, 'home-after-abandon');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('durada: màxim60minuts,50caselles llegibles i ruta sencera sense mutacions del client', async ({ browser }) => {
  const context = await makeContext(browser, 0, false), page = await context.newPage();
  try {
    await enter(page);
    await page.getByRole('button', { name: 'Jugar en persona', exact: true }).click();
    await expect(page.locator('.setup-hint')).toHaveCount(0);
    await page.getByRole('button', { name: 'Personalitzada', exact: true }).click();
    const input = page.getByLabel('Durada en minuts (10–60)', { exact: true });
    await input.fill('61'); await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
    await input.fill('30.5'); await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
    await input.fill('60'); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Pau en Pau' }).click();
    const initial = await currentView(page);
    expect(initial.game.finishPosition).toBe(50); expect(initial.board).toHaveLength(50);
    await capture(page, 'board-60-start');
    const positions = new Set<number>();
    for (const start of [0, 10, 20, 30, 40]) {
      await expect(page.locator('[data-board-window-start]')).toHaveAttribute('data-board-window-start', String(start));
      const visible = await page.locator('.board-cell').evaluateAll(elements => elements.map(element => Number(element.getAttribute('data-board-position'))));
      for (const position of visible) positions.add(position);
      if (start < 40) {
        await expect(page.locator('.board-end--finish')).toHaveCount(0);
        await page.getByRole('button', { name: 'Veure les caselles següents', exact: true }).click();
      }
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    await expect(page.locator('.board-end--finish')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Veure les caselles següents', exact: true })).toBeDisabled();
    // Pieces outside the inspected section are labels, never pieces on a false cell.
    await expect(page.locator('[data-motion="pawn-PAU"] [data-pawn-body]')).toHaveCount(0);
    await expect(page.locator('.board-outside-label')).toHaveCount(2);
    await capture(page, 'board-60-finish');
    const inspected = await currentView(page);
    expect(inspected.game).toEqual(initial.game); expect(inspected.board).toEqual(initial.board); expect(inspected.scoreboard).toEqual(initial.scoreboard);
    await page.getByRole('button', { name: 'Sortir', exact: true }).click();
    await page.getByRole('button', { name: 'Abandonar la partida', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
    expect((await viewForGame(page, initial.game.id)).scoreboard).toEqual(initial.scoreboard);
  } finally { await context.close(); }
});

test('online: qui reclama T&P veu el seu avís de beure i abandonar torna tots dos al menú', async ({ browser }) => {
  test.setTimeout(240000);
  const a = await makeContext(browser, 0), b = await makeContext(browser, 1);
  const pau = await a.newPage(), tecla = await b.newPage();
  try {
    await enter(pau); await enter(tecla); await createGame(pau, true, 20);
    const lobby = await currentView(pau);
    await tecla.getByRole('button', { name: 'Jugar en línia', exact: true }).click();
  await identifyOnline(tecla, 'TECLA');
    await tecla.getByRole('button', { name: 'Unir-se a una partida', exact: true }).click();
    await tecla.getByLabel('Codi de la partida', { exact: true }).fill(lobby.game.inviteCode!);
    await tecla.getByRole('button', { name: 'Unir-se a una partida', exact: true }).click();
    await clickAction(pau, 'Començar la partida'); await waitSynced(pau, tecla);
    let testedClaimant = false;
    for (let turn = 0; turn < 30 && !testedClaimant; turn++) {
      let view = await currentView(pau);
      const active = view.game.currentTurn === 'PAU' ? pau : tecla;
      await clickAction(active, 'Començar el torn'); await waitSynced(pau, tecla); view = await currentView(pau);
      const tp = view.game.phase === 'TP_OPEN';
      if (tp) {
        expect(view.question).not.toHaveProperty('answerCa'); expect((await currentView(tecla)).question).not.toHaveProperty('answerCa');
        const claimant = view.game.currentTurn === 'PAU' ? tecla : pau;
        await clickAction(claimant, 'Jo responc!'); await waitSynced(pau, tecla); view = await currentView(pau);
      }
      const respondent = view.game.respondingPlayer === 'PAU' ? pau : tecla;
      const judge = respondent === pau ? tecla : pau;
      expect((await currentView(respondent)).question).not.toHaveProperty('answerCa');
      expect((await currentView(judge)).question?.answerCa).toBeTruthy();
      await clickAction(judge, tp ? 'Incorrecte' : 'Correcte'); await waitSynced(pau, tecla);
      if (tp) {
        testedClaimant = true;
        const name = view.game.respondingPlayer === 'PAU' ? 'En Pau ha de beure' : 'La Tecla ha de beure';
        for (const page of [pau, tecla]) await expect(page.locator('.drink-notice')).toContainText(name);
        await expect(respondent.locator('.answer-panel')).toHaveCount(0);
        expect((await currentView(respondent)).question).not.toHaveProperty('answerCa');
        await respondent.reload(); await waitSynced(pau, tecla);
        await expect(respondent.locator('.drink-notice')).toContainText(name);
        await capture(respondent, 'online-tp-drink');
      } else {
        const nextView = await currentView(pau);
        await clickAction(nextView.capabilities.canNextTurn ? pau : tecla, 'Següent torn'); await waitSynced(pau, tecla);
      }
    }
    expect(testedClaimant).toBe(true);
    await pau.getByRole('button', { name: 'Sortir', exact: true }).click();
    await pau.getByRole('button', { name: 'Abandonar la partida', exact: true }).click();
    for (const page of [pau, tecla]) {
      await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
      await expect(page.locator('[data-game-id],.drink-notice,.answer-panel')).toHaveCount(0);
      const view = await viewForGame(page, lobby.game.id);
      expect(view.game.status).toBe('ABANDONED'); expect(view.scoreboard).toEqual(lobby.scoreboard);
      expect(view.question).toBeNull(); expect(view.capabilities.canSeeAnswer).toBe(false);
      // Even a stale saved pointer to the abandoned game boots into the main menu.
      await page.evaluate(gameId => { localStorage.setItem('tp-current-game', gameId); localStorage.setItem('tp-active-game', gameId); }, lobby.game.id);
      await page.reload(); await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
      expect(await page.evaluate(() => ['tp-current-game', 'tp-active-game'].map(key => localStorage.getItem(key)))).toEqual([null, null]);
    }
  } finally { await a.close(); await b.close(); }
});
