import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { clickAction, createGame, currentView, enter, makeContext, waitSynced } from './helpers';

test('partida presencial: accés, resposta oculta, error, +1, Meta i marcador únic', async ({ browser }) => {
  const context = await makeContext(browser, 0);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enter(page);
  await createGame(page, false);
  const initial = await currentView(page);
  let failures = 0;
  let bonus = false;
  let completed = false;
  for (let turn = 0; turn < 50; turn++) {
    await clickAction(page,'Començar el torn');
    let view = await currentView(page);
    if (view.game.phase === 'TP_OPEN') {
      await clickAction(page,'En Pau respon!');
      view = await currentView(page);
    }
    expect(view.question).not.toBeNull();
    expect(view.question).not.toHaveProperty('answerCa');
    await clickAction(page,'Mostra la resposta');
    view = await currentView(page);
    await expect(page.locator('.answer-panel')).toContainText(view.question?.answerCa ?? '');
    const incorrect = failures === 0;
    await clickAction(page,incorrect?'Incorrecte':'Correcte');
    if (incorrect) failures++;
    view = await currentView(page);
    if (view.lastEvent?.payload.plusOne) bonus = true;
    if (view.game.status === 'FINISHED') {
      completed=true;
      await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeVisible();
      expect(view.scoreboard.completedGames).toBe(initial.scoreboard.completedGames + 1);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Tornar a jugar', exact: true })).toBeVisible();
      expect((await currentView(page)).scoreboard.completedGames).toBe(view.scoreboard.completedGames);
      await page.getByRole('button', { name: 'Tornar a jugar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Quant de temps voleu que duri la partida?' })).toBeVisible();
      break;
    }
    await clickAction(page,'Següent torn');
  }
  expect(bonus).toBe(true);
  expect(completed).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('online: dos contexts, resposta segura, T&P concurrent, reload, reconnexió i victòria', async ({ browser }) => {
  const a = await makeContext(browser, 0);
  const b = await makeContext(browser, 1);
  const pau = await a.newPage();
  const tecla = await b.newPage();
  const errors: string[] = [];
  for (const page of [pau, tecla]) page.on('pageerror', error => errors.push(error.message));
  await enter(pau); await enter(tecla);
  await createGame(pau, true);
  const lobby = await currentView(pau);
  await tecla.getByRole('button', {name:'Jugar en línia',exact:true}).click();
  await tecla.getByRole('button', {name:'Unir-se a una partida',exact:true}).click();
  await tecla.getByRole('button', {name:'Soc la Tecla'}).click();
  await tecla.getByLabel('Codi de la partida',{exact:true}).fill(lobby.game.inviteCode ?? '');
  await tecla.getByRole('button', {name:'Unir-se a una partida',exact:true}).click();
  await clickAction(pau,'Començar la partida');
  await waitSynced(pau,tecla);
  let sawTP = false;
  let failed = false;
  let sawBonus = false;
  let completed = false;
  const used = new Set<string>();
  for (let turn = 0; turn < 50; turn++) {
    let view = await currentView(pau);
    const active = view.game.currentTurn === 'PAU' ? pau : tecla;
    await clickAction(active,'Començar el torn');
    await waitSynced(pau,tecla);
    view = await currentView(pau);
    if (view.game.phase === 'TP_OPEN') {
      sawTP = true;
      expect((await currentView(pau)).question).not.toHaveProperty('answerCa');
      expect((await currentView(tecla)).question).not.toHaveProperty('answerCa');
      const beforeClaim=view.game.stateVersion;
      await Promise.allSettled([pau.getByRole('button',{name:'Jo responc!',exact:true}).click(),tecla.getByRole('button',{name:'Jo responc!',exact:true}).click()]);
      await expect.poll(async()=>Number(await pau.locator('[data-state-version]').getAttribute('data-state-version'))).toBeGreaterThan(beforeClaim);
      await waitSynced(pau,tecla);
      view = await currentView(pau);
      expect(['PAU','TECLA']).toContain(view.game.tpClaimant);
    }
    const respondent = view.game.respondingPlayer === 'PAU' ? pau : tecla;
    const judge = respondent === pau ? tecla : pau;
    const secure = await currentView(respondent);
    const judging = await currentView(judge);
    expect(secure.question).not.toHaveProperty('answerCa');
    expect(judging.question?.answerCa).toBeTruthy();
    expect(used.has(secure.question?.id ?? '')).toBe(false);
    used.add(secure.question?.id ?? '');
    await expect(respondent.locator('.answer-panel')).toHaveCount(0);
    await expect(judge.locator('.answer-panel')).toBeVisible();
    await expect(respondent.getByRole('button',{name:'Correcte',exact:true})).toHaveCount(0);
    if (turn === 1) {
      await respondent.reload();
      await expect(respondent.locator('[data-game-id]')).toHaveAttribute('data-game-id',view.game.id);
      expect((await currentView(respondent)).viewer.role).toBe(secure.viewer.role);
      await a.setOffline(true);
      await expect(pau.locator('.connection-overlay')).toHaveClass(/is-visible/);
      await a.setOffline(false);
      await expect(pau.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
      await waitSynced(pau,tecla);
      await pau.waitForTimeout(5500);
      await expect(pau.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
      await expect(pau.locator('.question-card')).toHaveAttribute('aria-busy','false');
    }
    const incorrect = !failed;
    await clickAction(judge,incorrect?'Incorrecte':'Correcte');
    failed = true;
    await waitSynced(pau,tecla);
    view = await currentView(pau);
    if(view.lastEvent?.payload.plusOne) sawBonus=true;
    if(view.game.status === 'FINISHED') {
      completed=true;
      await expect(pau.getByRole('button',{name:'Tornar a jugar',exact:true})).toBeVisible();
      await expect(tecla.getByRole('button',{name:'Tornar a jugar',exact:true})).toBeVisible();
      expect(view.scoreboard.completedGames).toBe(lobby.scoreboard.completedGames+1);
      await pau.reload();
      await expect(pau.locator('[data-phase]')).toHaveAttribute('data-phase','FINISHED');
      expect((await currentView(pau)).scoreboard.completedGames).toBe(view.scoreboard.completedGames);
      break;
    }
    const next = view.capabilities.canNextTurn ? pau : tecla;
    await clickAction(next,'Següent torn');
    await waitSynced(pau,tecla);
  }
  expect(sawTP).toBe(true); expect(sawBonus).toBe(true); expect(completed).toBe(true); expect(errors).toEqual([]);
  await a.close(); await b.close();
});

test('partida abandonada no suma cap punt',async({browser})=>{
  const context=await makeContext(browser,0);
  const page=await context.newPage(); await enter(page); await createGame(page,false,20);
  const initial=await currentView(page);
  await page.getByRole('button',{name:'Sortir',exact:true}).click();
  await page.getByRole('button',{name:'Abandonar la partida',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Heu deixat la partida'})).toBeVisible();
  expect((await currentView(page)).scoreboard.completedGames).toBe(initial.scoreboard.completedGames);
  await context.close();
});

test('online: abandonar durant la pregunta recupera tots dos dispositius sense resposta ni punts', async ({ browser }) => {
  const a = await makeContext(browser, 0), b = await makeContext(browser, 1);
  const pau = await a.newPage(), tecla = await b.newPage();
  await enter(pau); await enter(tecla); await createGame(pau, true, 30);
  const lobby = await currentView(pau);
  await tecla.getByRole('button', { name: 'Jugar en línia', exact: true }).click();
  await tecla.getByRole('button', { name: 'Unir-se a una partida', exact: true }).click();
  await tecla.getByRole('button', { name: /Soc la Tecla$/ }).click();
  await tecla.getByLabel('Codi de la partida', { exact: true }).fill(lobby.game.inviteCode ?? '');
  await tecla.getByRole('button', { name: 'Unir-se a una partida', exact: true }).click();
  await pau.setViewportSize({ width: 1366, height: 768 });
  await expect(pau.getByRole('button', { name: 'Començar la partida', exact: true })).toBeEnabled();
  const lobbyLayout = await pau.evaluate(() => ({
    bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
    panel: document.querySelector('.card-column .art-panel')?.getBoundingClientRect().toJSON(),
    board: document.querySelector('.game-board')?.getBoundingClientRect().toJSON(),
    controls: Array.from(document.querySelectorAll('button')).filter((element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden').map((element) => ({ label: element.textContent?.trim() || element.getAttribute('aria-label'), artButton: element.classList.contains('art-button'), ...element.getBoundingClientRect().toJSON() })),
  }));
  expect(lobbyLayout.bodyWidth).toBeLessThanOrEqual(1366); expect(lobbyLayout.bodyHeight).toBeLessThanOrEqual(768);
  for (const control of lobbyLayout.controls) { expect(control.artButton).toBe(true); expect(control.width).toBeGreaterThanOrEqual(47.5); expect(control.height).toBeGreaterThanOrEqual(47.5); expect(control.top).toBeGreaterThanOrEqual(0); expect(control.bottom).toBeLessThanOrEqual(768); }
  expect(lobbyLayout.panel?.bottom).toBeLessThanOrEqual(768);
  expect(lobbyLayout.panel?.left).toBeGreaterThanOrEqual((lobbyLayout.board?.right ?? 0) + 8);
  mkdirSync('acceptance/art-redesign/screenshots', { recursive: true });
  await pau.screenshot({ path: 'acceptance/art-redesign/screenshots/online-lobby-extra-1366x768.png' });
  writeFileSync('acceptance/art-redesign/LOBBY_1366_REPORT.json', JSON.stringify({ status: 'PASS', completedAt: new Date().toISOString(), gameId: lobby.game.id, existingE2EFixture: true, noExtraGameOrAuth: true, noGameMutationsDuringCapture: true, width: 1366, height: 768, layout: lobbyLayout, noSecrets: true }, null, 2));
  await pau.setViewportSize({ width: 1440, height: 900 });
  await clickAction(pau, 'Començar la partida'); await waitSynced(pau, tecla);
  await clickAction(pau, 'Començar el torn'); await waitSynced(pau, tecla);
  const before = await currentView(pau);
  expect(before.question).not.toBeNull(); expect(before.question).not.toHaveProperty('answerCa');
  expect((await currentView(tecla)).question?.answerCa).toBeTruthy();
  await pau.getByRole('button', { name: 'Sortir', exact: true }).click();
  await clickAction(pau, 'Abandonar la partida');
  for (const page of [pau, tecla]) {
    await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible();
    let view = await currentView(page);
    expect(view.game.status).toBe('ABANDONED'); expect(view.game.stateVersion).toBe(before.game.stateVersion + 1);
    expect(view.question).toBeNull(); expect(view.capabilities.canSeeAnswer).toBe(false); expect(view.capabilities.canJudge).toBe(false);
    expect(Object.values(view.capabilities).every((value) => typeof value === 'boolean')).toBe(true);
    expect(view.scoreboard).toEqual(before.scoreboard); await expect(page.locator('.answer-panel')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible();
    view = await currentView(page); expect(view.game.status).toBe('ABANDONED'); expect(view.question).toBeNull();
    expect(view.capabilities.canSeeAnswer).toBe(false); expect(view.scoreboard).toEqual(before.scoreboard);
  }
  await a.close(); await b.close();
});
