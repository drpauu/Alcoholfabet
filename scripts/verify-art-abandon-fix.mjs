import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const gameId = '2ad751d4-5421-40fb-b4fe-a54376ebe366';
const directory = 'acceptance/art-redesign';
const manifest = JSON.parse(await readFile(`${directory}/QA_MANIFEST.json`, 'utf8'));
if (!manifest.gameIds.includes(gameId)) throw new Error('QA_REFUSE_UNLISTED_GAME');
const storageState = JSON.parse(await readFile('/tmp/tecla-pau-art-baseline-storage.json', 'utf8'));
for (const origin of storageState.origins) {
  origin.localStorage = origin.localStorage.filter((entry) => !['tp-active-game', 'tp-current-game'].includes(entry.name));
  origin.localStorage.push({ name: 'tp-current-game', value: gameId });
}
const publicEnv = Object.fromEntries((await readFile('.env.local', 'utf8')).split('\n').filter((line) => line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ storageState, viewport: { width: 390, height: 844 } });
let newAuthAttempts = 0;
await context.route(`${publicEnv.VITE_SUPABASE_URL}/auth/v1/signup`, async (route) => { newAuthAttempts += 1; await route.abort(); });
try {
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Heu deixat la partida', exact: true })).toBeVisible({ timeout: 25000 });
  await expect(page.locator('[data-state-version]')).toHaveAttribute('data-state-version', '4');
  const result = await page.evaluate(async ({ publicEnv, gameId }) => {
    const projectUrl = publicEnv.VITE_SUPABASE_URL;
    const key = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
    const token = JSON.parse(localStorage.getItem(key) ?? '{}').access_token;
    const response = await fetch(`${projectUrl}/rest/v1/rpc/get_game_view`, { method: 'POST', headers: { apikey: publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_game_id: gameId }) });
    if (!response.ok) throw new Error(`QA_VIEW_HTTP_${response.status}`);
    const view = await response.json();
    return { gameId: view.game.id, userId: view.viewer.userId, status: view.game.status, phase: view.game.phase, stateVersion: view.game.stateVersion, question: view.question, capabilities: view.capabilities };
  }, { publicEnv, gameId });
  expect(result.status).toBe('ABANDONED'); expect(result.stateVersion).toBe(4); expect(result.question).toBeNull();
  expect(result.capabilities.canSeeAnswer).toBe(false); expect(Object.values(result.capabilities).every((value) => typeof value === 'boolean')).toBe(true);
  expect(newAuthAttempts).toBe(0); await expect(page.locator('.answer-panel')).toHaveCount(0);
  await page.screenshot({ path: `${directory}/screenshots/abandoned-after-fix-390x844.png` });
  await writeFile(`${directory}/ABANDON_REGRESSION_FIX_REPORT.json`, JSON.stringify({ status: 'PASS', verifiedAt: new Date().toISOString(), backend: 'real Supabase and existing QA Auth session', restoredOnlyOwnedGameId: true, noGameMutations: true, newAuthAttempts, result, noSecrets: true }, null, 2) + '\n');
  const protectedPath = '/tmp/tecla-pau-art-abandon-verified-storage.json';
  await writeFile(protectedPath, JSON.stringify(await context.storageState()), { mode: 0o600 }); await chmod(protectedPath, 0o600);
  console.log(JSON.stringify({ status: 'PASS', gameId, stateVersion: result.stateVersion, canSeeAnswer: result.capabilities.canSeeAnswer, noGameMutations: true, newAuthAttempts }));
} finally { await context.close(); await browser.close(); }
