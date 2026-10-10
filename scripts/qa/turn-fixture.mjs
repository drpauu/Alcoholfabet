import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

// Run the real application with an isolated, role-safe RPC/Realtime transport.
// No authentication, games or scores are created on Supabase.
export function createTurnFixtureHarness(browser, { origin = 'http://127.0.0.1:5173', errors = [], blocked = [] } = {}) {
  const gameId = '90000000-0000-4000-8000-000000000001';
  const coupleId = '90000000-0000-4000-8000-000000000002';
  const userId = (role) => `90000000-0000-4000-8000-${role === 'TECLA' ? '000000000004' : '000000000003'}`;
  const capabilities = { canSeeAnswer: false, canJudge: false, canBeginTurn: false, canReveal: false, canClaim: false, canNextTurn: false, canStart: false, canAbandon: true };

  function server({ online = false, lobby = false, tp = false, failures = 0, bootOffline = false, plusOne = true, questionText = 'Quin instrument té tecles blanques i negres?', answerText = 'Piano' } = {}) {
    const model = {
      game: { id: gameId, coupleId, mode: online ? 'ONLINE' : 'IN_PERSON', status: lobby ? 'LOBBY' : 'ACTIVE',
        phase: lobby ? 'LOBBY' : 'TURN_INTRO', inviteCode: online ? 'QATEST' : null, targetMinutes: 20, finishPosition: 17,
        startingPlayer: 'PAU', currentTurn: 'PAU', currentTargetCell: null, respondingPlayer: null, tpClaimant: null,
        pauPosition: 0, teclaPosition: 0, turnNumber: 1, stateVersion: 0, winner: null },
      board: Array.from({ length: 17 }, (_, i) => ({ position: i + 1, type: i === 0 && tp ? 'TP' : 'PERSONAL', modifier: i === 0 && plusOne ? 'PLUS_ONE' : 'NONE' })),
      question: null, lastEvent: null, scoreboard: { pauWins: 0, teclaWins: 0, completedGames: 0 },
    };
    const pages = [], intents = [];
    const safe = (role) => {
      const value = structuredClone(model), game = value.game;
      const canSeeAnswer = Boolean(value.question && (online ? game.phase !== 'TP_OPEN' && role !== game.respondingPlayer : ['ANSWER_REVEALED', 'RESULT', 'MOVING'].includes(game.phase)));
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
      if (name === 'get_access_context') return bootOffline ? { data: null, error: { message: 'Failed to fetch' } } : { data: { authorized: true, activeGameId: gameId, scoreboard: model.scoreboard }, error: null };
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
        model.question = { id: `fixture-${game.turnNumber}`, pool: tp ? 'TP' : game.currentTurn, topic: 'Música', questionCa: questionText, answerCa: answerText };
      } else if (action === 'CLAIM_TP') { assert.equal(game.phase, 'TP_OPEN'); game.phase = 'TP_CLAIMED'; game.tpClaimant = payload.p_payload.claimant; game.respondingPlayer = payload.p_payload.claimant; }
      else if (action === 'REVEAL_ANSWER') game.phase = 'ANSWER_REVEALED';
      else if (action === 'JUDGE_CORRECT') { assert.equal(safe(role).capabilities.canJudge, true); game.pauPosition = game.respondingPlayer === 'PAU' ? (plusOne ? 2 : 1) : game.pauPosition; game.teclaPosition = game.respondingPlayer === 'TECLA' ? (plusOne ? 2 : 1) : game.teclaPosition; game.phase = 'RESULT'; }
      else if (action === 'JUDGE_INCORRECT') { assert.equal(safe(role).capabilities.canJudge, true); game.phase = 'RESULT'; }
      else if (action === 'NEXT_TURN') { assert.equal(game.phase, 'RESULT'); game.currentTurn = game.currentTurn === 'PAU' ? 'TECLA' : 'PAU'; game.phase = 'TURN_INTRO'; game.respondingPlayer = null; game.tpClaimant = null; model.question = null; game.turnNumber++; }
      else throw new Error(`Unexpected fixture action: ${action}`);
      game.stateVersion++;
      model.lastEvent = { id: `event-${game.stateVersion}`, type: action, stateVersion: game.stateVersion, createdAt: new Date().toISOString(),
        payload: action === 'JUDGE_INCORRECT' ? { correct: false, respondingPlayer: game.respondingPlayer, from: 0, to: 0, plusOne, drinkCount: plusOne ? 2 : 1 } : action === 'JUDGE_CORRECT' ? { correct: true, respondingPlayer: game.respondingPlayer, from: 0, to: plusOne ? 2 : 1, plusOne, drinkCount: 0 } : {} };
      const data = safe(role); notify(); return { data, error: null };
    }
    return { model, pages, intents, rpc, safe, restoreAccess: () => { bootOffline = false; } };
  }

  async function open(fixture, role = 'IN_PERSON_CONTROLLER', { connection = 'connected', reducedMotion = 'reduce', viewport = { width: 1440, height: 900 }, mobile = false } = {}) {
    const context = await browser.newContext({ viewport, reducedMotion, isMobile: mobile, hasTouch: mobile });
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
  return { server, open, ready, begins };
}
