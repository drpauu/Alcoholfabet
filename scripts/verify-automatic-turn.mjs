import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Exercise the real App, session, repository and motion with an isolated RPC fixture.
// No Supabase authentication, games, questions or scores are written by this check.
const origin = 'http://127.0.0.1:5173';
const directory = 'acceptance/automatic-turn';
await mkdir(join(directory, 'screenshots'), { recursive: true });
const gameId = '90000000-0000-4000-8000-000000000001';
const coupleId = '90000000-0000-4000-8000-000000000002';
const userId = (role) => `90000000-0000-4000-8000-${role === 'TECLA' ? '000000000004' : '000000000003'}`;
const capabilities = { canSeeAnswer: false, canJudge: false, canBeginTurn: false, canReveal: false, canClaim: false, canNextTurn: false, canStart: false, canAbandon: true };
const cases = [], errors = [], blocked = [];
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });

function server({ online = false, lobby = false, tp = false, failures = 0 } = {}) {
  const model = {
    game: { id: gameId, coupleId, mode: online ? 'ONLINE' : 'IN_PERSON', status: lobby ? 'LOBBY' : 'ACTIVE',
      phase: lobby ? 'LOBBY' : 'TURN_INTRO', inviteCode: online ? 'QATEST' : null, targetMinutes: 20, finishPosition: 17,
      startingPlayer: 'PAU', currentTurn: 'PAU', currentTargetCell: null, respondingPlayer: null, tpClaimant: null,
      pauPosition: 0, teclaPosition: 0, turnNumber: 1, stateVersion: 0, winner: null },
    board: Array.from({ length: 17 }, (_, i) => ({ position: i + 1, type: i === 0 && tp ? 'TP' : 'PERSONAL', modifier: i === 0 ? 'PLUS_ONE' : 'NONE' })),
    question: null, lastEvent: null, scoreboard: { pauWins: 0, teclaWins: 0, completedGames: 0 },
  };
  const pages = [], intents = [];
  const safe = (role) => {
    const value = structuredClone(model), game = value.game;
    const canSeeAnswer = Boolean(value.question && (online ? game.phase !== 'TP_OPEN' && role !== game.respondingPlayer : game.phase === 'ANSWER_REVEALED'));
    if (value.question && !canSeeAnswer) delete value.question.answerCa;
    return { ...value, viewer: { role, userId: userId(role) }, members: online ? [{ role: 'PAU' }, { role: 'TECLA' }] : [{ role: 'IN_PERSON_CONTROLLER' }],
      capabilities: { ...capabilities, canSeeAnswer,
        canBeginTurn: game.status === 'ACTIVE' && game.phase === 'TURN_INTRO' && (!online || role === game.currentTurn),
        canStart: game.status === 'LOBBY', canReveal: !online && ['QUESTION', 'TP_CLAIMED'].includes(game.phase),
        canJudge: canSeeAnswer && ['QUESTION', 'TP_CLAIMED', 'ANSWER_REVEALED'].includes(game.phase),
        canClaim: game.phase === 'TP_OPEN', canNextTurn: ['RESULT', 'MOVING'].includes(game.phase) } };
  };
  const notify = () => { for (const page of pages.filter(page => !page.isClosed())) void page.evaluate(stateVersion => window.dispatchEvent(new CustomEvent('qa-refresh', { detail: { stateVersion } })), model.game.stateVersion).catch(() => {}); };
  async function rpc(name, payload, role, overlay) {
    if (name === 'get_access_context') return { data: { authorized: true, activeGameId: gameId, scoreboard: model.scoreboard }, error: null };
    if (name === 'get_game_view') return { data: safe(role), error: null };
    const game = model.game, action = name === 'start_game' ? 'START_GAME' : payload.p_action;
    intents.push({ action, role, version: payload.p_expected_state_version, key: payload.p_idempotency_key });
    if (action === 'BEGIN_TURN') {
      assert.equal(overlay, false, 'Wait for the reconnect presentation before beginning the turn');
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    if (action === 'BEGIN_TURN' && failures-- > 0) return { data: null, error: { message: 'QA_TRANSIENT_FAILURE' } };
    assert.equal(payload.p_expected_state_version, game.stateVersion, 'Duplicate or stale intent');
    assert.match(payload.p_idempotency_key, /^[0-9a-f-]{36}$/);
    if (action === 'START_GAME') { assert.equal(game.status, 'LOBBY'); game.status = 'ACTIVE'; game.phase = 'TURN_INTRO'; }
    else if (action === 'BEGIN_TURN') {
      assert.equal(game.phase, 'TURN_INTRO');
      if (online) assert.equal(role, game.currentTurn, 'The other player must not begin this turn');
      game.phase = tp ? 'TP_OPEN' : 'QUESTION'; game.respondingPlayer = tp ? null : game.currentTurn; game.currentTargetCell = 1;
      model.question = { id: `fixture-${game.turnNumber}`, pool: tp ? 'TP' : game.currentTurn, topic: 'Música', questionCa: 'Quin instrument té tecles blanques i negres?', answerCa: 'Piano' };
    } else if (action === 'CLAIM_TP') { assert.equal(game.phase, 'TP_OPEN'); game.phase = 'TP_CLAIMED'; game.tpClaimant = payload.p_payload.claimant; game.respondingPlayer = payload.p_payload.claimant; }
    else if (action === 'REVEAL_ANSWER') game.phase = 'ANSWER_REVEALED';
    else if (action === 'JUDGE_INCORRECT') { assert.equal(safe(role).capabilities.canJudge, true); game.phase = 'RESULT'; }
    else if (action === 'NEXT_TURN') { assert.equal(game.phase, 'RESULT'); game.currentTurn = game.currentTurn === 'PAU' ? 'TECLA' : 'PAU'; game.phase = 'TURN_INTRO'; game.respondingPlayer = null; game.tpClaimant = null; model.question = null; game.turnNumber++; }
    else throw new Error(`Unexpected fixture action: ${action}`);
    game.stateVersion++;
    model.lastEvent = { id: `event-${game.stateVersion}`, type: action, stateVersion: game.stateVersion, createdAt: new Date().toISOString(),
      payload: action === 'JUDGE_INCORRECT' ? { correct: false, respondingPlayer: game.respondingPlayer, from: 0, to: 0, plusOne: true, drinkCount: 2 } : {} };
    const data = safe(role); notify(); return { data, error: null };
  }
  return { model, pages, intents, rpc, safe };
}

async function open(fixture, role = 'IN_PERSON_CONTROLLER', { connection = 'connected' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  context.setDefaultTimeout(12000);
  const client = `const role=${JSON.stringify(role)},id=${JSON.stringify(userId(role))};let connection=${JSON.stringify(connection)};
export const supabase={
  auth:{getSession:async()=>({data:{session:{user:{id}}},error:null}),getUser:async()=>({data:{user:{id}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async(name,payload={})=>fetch('/__qa/turn-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,payload,role,overlay:document.querySelector('.connection-overlay')?.classList.contains('is-visible')??false})}).then(response=>response.json()),
  realtime:{setAuth:async()=>{}},removeChannel:async channel=>channel.close(),
  channel(name,options){
    if(!options.config.private)throw Error('Expected a private game channel');
    const handlers={};let subscribed;
    const update=event=>handlers.broadcast?.({payload:event.detail});
    const change=event=>{connection=event.detail;subscribed?.(connection==='connected'?'SUBSCRIBED':'CHANNEL_ERROR')};
    const channel={on(type,filter,handler){handlers[type]=handler;return this},
      subscribe(callback){subscribed=callback;window.addEventListener('qa-refresh',update);window.addEventListener('qa-connection',change);setTimeout(()=>callback(connection==='connected'?'SUBSCRIBED':'CHANNEL_ERROR'),100);return this},
      track:async()=>{handlers.presence?.()},presenceState:()=>({fixture:[{role:'PAU'},{role:'TECLA'}]}),
      close(){window.removeEventListener('qa-refresh',update);window.removeEventListener('qa-connection',change)}};
    return channel;
  }
};`;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { blocked.push(url.origin + url.pathname); return route.abort(); }
    if (url.pathname === '/src/services/supabase.ts') return route.fulfill({ contentType: 'application/javascript', body: client });
    if (url.pathname === '/__qa/turn-rpc') {
      const { name, payload, role, overlay } = route.request().postDataJSON();
      try { return route.fulfill({ contentType: 'application/json', body: JSON.stringify(await fixture.rpc(name, payload, role, overlay)) }); }
      catch (error) { errors.push(error.message); return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: null, error: { message: error.message } }) }); }
    }
    return route.continue();
  });
  const page = await context.newPage(); fixture.pages.push(page);
  page.on('pageerror', error => errors.push(error.message)); await page.goto(origin);
  return { context, page };
}
const ready = async (page) => {
  await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /QUESTION|TP_OPEN|TP_CLAIMED/);
  await expect(page.locator('.question-card')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Començar el torn', exact: true })).toHaveCount(0);
  await expect(page.getByText('La següent casella us espera.', { exact: true })).toHaveCount(0);
};
const begins = (fixture) => fixture.intents.filter(intent => intent.action === 'BEGIN_TURN');

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
  await expect(retry.page.locator('.error-message')).toBeVisible(); await retry.page.waitForTimeout(350);
  assert.equal(begins(failed).length, 1, 'Failed intent must not loop');
  await retry.page.locator('.error-message button').click(); await ready(retry.page); assert.equal(begins(failed).length, 2);
  cases.push({ name: 'RPC failure: no loop, dismissing the error retries', status: 'PASS' }); await retry.context.close();

  const offline = server(), reconnect = await open(offline, 'IN_PERSON_CONTROLLER', { connection: 'reconnecting' });
  await expect(reconnect.page.locator('.connection-overlay')).toHaveClass(/is-visible/); assert.equal(begins(offline).length, 0);
  await reconnect.page.evaluate(() => window.dispatchEvent(new CustomEvent('qa-connection', { detail: 'connected' })));
  await expect(reconnect.page.locator('.connection-overlay')).not.toHaveClass(/is-visible/);
  await ready(reconnect.page); assert.equal(begins(offline).length, 1);
  cases.push({ name: 'reconnect: begin only after connection is restored', status: 'PASS' }); await reconnect.context.close();
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
} catch (error) { errors.push(error.stack ?? String(error)); }
finally {
  await browser.close();
  const status = errors.length || blocked.length || cases.length !== 5 ? 'FAIL' : 'PASS';
  await writeFile(join(directory, 'BROWSER_REPORT.json'), JSON.stringify({ status, completedAt: new Date().toISOString(), scope: 'Real App, useGameSession, useGameChannel, GameRepository, motion; isolated RPC and Realtime transport fixtures', cases, errors, blockedRequests: blocked, authCreated: 0, gamesCreated: 0, scoreChanges: 0 }, null, 2) + '\n');
  console.log(JSON.stringify({ status, cases: cases.length, errors, blockedRequests: blocked }));
  if (status !== 'PASS') process.exitCode = 1;
}
