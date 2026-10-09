import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const baseline = process.argv.includes('--baseline');
const directory = baseline ? 'audit/plus-board-before' : 'acceptance/plus-board';
const origin = 'http://127.0.0.1:5173';
await mkdir(join(directory, 'screenshots'), { recursive: true });

function fixture(scene) {
  const correct = scene === 'plus-correct', incorrect = scene === 'plus-incorrect';
  const result = correct || incorrect;
  return {
    game: { id: 'local-plus-board-qa', coupleId: 'local-qa', mode: 'IN_PERSON', status: 'ACTIVE',
      phase: correct ? 'MOVING' : incorrect ? 'RESULT' : 'ANSWER_REVEALED', inviteCode: null,
      targetMinutes: 20, finishPosition: 17, startingPlayer: 'PAU', currentTurn: 'PAU',
      currentTargetCell: 5, respondingPlayer: 'PAU', tpClaimant: null,
      pauPosition: correct ? 6 : 4, teclaPosition: 3, turnNumber: 9, stateVersion: result ? 3 : 2, winner: null },
    viewer: { role: 'IN_PERSON_CONTROLLER', userId: 'local-qa' },
    board: Array.from({ length: 17 }, (_, i) => ({ position: i + 1,
      type: ['PERSONAL', 'CROSSED', 'TP', 'PERSONAL', 'CROSSED'][i % 5],
      modifier: [5, 11].includes(i + 1) ? 'PLUS_ONE' : 'NONE' })),
    question: { id: 'local-question', pool: 'PAU_TECLA', topic: 'Música',
      questionCa: 'Quin instrument té tecles blanques i negres?', answerCa: 'Piano' },
    capabilities: { canSeeAnswer: true, canJudge: !result, canBeginTurn: false, canReveal: false,
      canClaim: false, canNextTurn: result, canStart: false, canAbandon: true },
    members: [{ role: 'IN_PERSON_CONTROLLER' }],
    lastEvent: result ? { id: 'confirmed-plus-result', type: correct ? 'JUDGE_CORRECT' : 'JUDGE_INCORRECT',
      payload: { correct, respondingPlayer: 'PAU', from: 4, to: correct ? 6 : 4,
        plusOne: true, drinkCount: incorrect ? 2 : 0 }, stateVersion: 3, createdAt: '' } : null,
    scoreboard: { pauWins: 0, teclaWins: 0, completedGames: 0 },
  };
}

const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const captures = [], errors = [], blocked = [];
let status = 'FAIL';
try {
  for (const scene of baseline ? ['plus-question'] : ['plus-question', 'plus-correct', 'plus-incorrect']) {
    for (const [width, height, dpr] of [[390, 844, 1], [1024, 768, 1], [1440, 900, 1], [1440, 900, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      const view = fixture(scene);
      const hook = `const noop=()=>{};const view=${JSON.stringify(view)};const session={loading:false,pending:false,access:{authorized:true,scoreboard:view.scoreboard},view,userId:'local-qa',error:null,run:async()=>false,refresh:async()=>{},boot:async()=>{},acceptView:noop,goHome:noop,clearError:noop};export function useGameSession(){return session;}`;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || /\/(auth|rest|realtime|graphql)\/v1/.test(url.pathname)) { blocked.push(url.origin + url.pathname); return route.abort(); }
        if (url.pathname === '/src/hooks/useGameSession.ts') return route.fulfill({ contentType: 'application/javascript', body: hook });
        if (url.pathname === '/src/hooks/useGameChannel.ts') return route.fulfill({ contentType: 'application/javascript', body: "export function useGameChannel(){return {connection:'connected',presentRoles:[]};}" });
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await page.locator('.question-card').waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(image => image.decode()));
        await Promise.all(Array.from(document.querySelectorAll('svg image')).map(image => new Promise(resolve => {
          const bitmap = new Image(); bitmap.onload = bitmap.onerror = resolve; bitmap.src = image.getAttribute('href');
        })));
      });
      const geometry = await page.evaluate(() => {
        const board = document.querySelector('.game-board');
        const box = board.getBoundingClientRect();
        return { bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
          board: box.toJSON(), slabBitmaps: Array.from(board.querySelectorAll('.board-slab image')).map(image => image.getAttribute('href')),
          paintedTextureCount: board.querySelectorAll('.board-painted-grain').length,
          bonusSeals: board.querySelectorAll('.cell-bonus-seal').length,
          pawnPosition: board.querySelector('[data-motion="pawn-PAU"]').getAttribute('data-board-position'),
          result: document.querySelector('.result-note')?.textContent ?? '',
          drinkCount: document.querySelector('[data-drink-count]')?.getAttribute('data-drink-count') ?? null,
          question: document.querySelector('.question-copy')?.textContent,
          judgeButtons: document.querySelectorAll('.judge-controls button').length,
          nextTurnButtons: Array.from(document.querySelectorAll('button')).filter(button => button.textContent === 'Següent torn').length,
          boardPath: document.querySelector('[data-motion="boardPath"]').getAttribute('d'),
          animations: document.getAnimations().length };
      });
      const failures = [];
      if (geometry.bodyWidth > width || geometry.bodyHeight > height) failures.push('PAGE_OVERFLOW');
      if (!geometry.bonusSeals || !geometry.boardPath || !geometry.question) failures.push('BOARD_OR_QUESTION_MISSING');
      if (!baseline && (geometry.slabBitmaps.length || geometry.paintedTextureCount)) failures.push('RASTER_WOOD_REMAINS');
      if (!baseline && scene === 'plus-correct' && (!geometry.result.includes('sense cap altra pregunta') || geometry.pawnPosition !== '6' || geometry.judgeButtons || geometry.nextTurnButtons !== 1)) failures.push('PLUS_CORRECT_UI');
      if (scene === 'plus-incorrect' && (geometry.drinkCount !== '2' || geometry.pawnPosition !== '4' || !geometry.result.includes('No avances. Perds el torn.') || geometry.judgeButtons || geometry.nextTurnButtons !== 1)) failures.push('PLUS_INCORRECT_UI');
      const name = `${scene}-${width}x${height}${dpr > 1 ? '-2x' : ''}`;
      const screenshot = `screenshots/${name}.png`;
      await page.screenshot({ path: join(directory, screenshot) });
      const bottom = { x: Math.max(0, Math.floor(geometry.board.x)), y: Math.floor(geometry.board.y + geometry.board.height * .76),
        width: Math.min(width - Math.max(0, Math.floor(geometry.board.x)), Math.floor(geometry.board.width)), height: Math.ceil(geometry.board.height * .24 + 12) };
      const detail = `screenshots/${name}-lower-edge.png`;
      await page.screenshot({ path: join(directory, detail), clip: bottom });
      captures.push({ scene, width, height, dpr, screenshot, detail, geometry, failures, status: failures.length ? 'FAIL' : 'PASS' });
      await context.close();
    }
  }
  status = captures.every(capture => capture.status === 'PASS') && !errors.length && !blocked.length ? 'PASS' : 'FAIL';
} catch (error) { errors.push(error.stack ?? String(error)); }
finally {
  await browser.close();
  const report = { status, baseline, completedAt: new Date().toISOString(), scope: 'Actual App, Board, QuestionCard and motion hydration; browser routes provide local view and connection fixtures. No Auth or DB writes.', captures, errors, blockedApiRequests: blocked, authSessionsCreated: 0, gamesCreated: 0 };
  await writeFile(join(directory, 'BROWSER_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status, captures: captures.length, errors, failures: captures.filter(c => c.failures.length).map(c => ({ scene: c.scene, width: c.width, failures: c.failures })) }));
  if (status !== 'PASS') process.exitCode = 1;
}
