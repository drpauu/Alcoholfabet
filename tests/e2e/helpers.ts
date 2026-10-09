import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { PlayerRole } from '../../src/domain/game/game-types';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { GameView } from '../../src/services/game-contract';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(line => line.includes('=')).map(line => {
  const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).trim()];
}));
export const projectUrl = env.VITE_SUPABASE_URL;
export const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY;

function recordQa(userId: string, gameId?: string) {
  const path=process.env.TECLA_PAU_QA_MANIFEST || 'acceptance/art-redesign/QA_E2E_MANIFEST.json';
  mkdirSync(dirname(path),{recursive:true});
  const manifest=existsSync(path)?JSON.parse(readFileSync(path,'utf8')) as {userIds:string[];gameIds:string[]}:{userIds:[],gameIds:[]};
  if(!manifest.userIds.includes(userId)) manifest.userIds.push(userId);
  if(gameId&&!manifest.gameIds.includes(gameId)) manifest.gameIds.push(gameId);
  writeFileSync(path,JSON.stringify(manifest,null,2));
}

export function trackQaContext(context: BrowserContext): void {
  context.on('page',page=>page.on('response',response=>{
    const pathname=new URL(response.url()).pathname;
    if(pathname==='/auth/v1/signup') void response.json().then((body:{user?:{id?:string}})=>{
      if(body.user?.id) recordQa(body.user.id);
    }).catch(()=>undefined);
    if(pathname==='/rest/v1/rpc/create_game') void response.json().then((body:GameView)=>{
      if(body.game?.id&&body.viewer?.userId) recordQa(body.viewer.userId,body.game.id);
    }).catch(()=>undefined);
  }));
}

export async function makeContext(browser: Browser, actor: number, reducedMotion = true): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  trackQaContext(context);
  let config: { external?: { anonymous_users?: boolean } } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const settings = await context.request.get(`${projectUrl}/auth/v1/settings`, { headers: { apikey: publishable } });
    if (settings.ok() && settings.headers()['content-type']?.includes('application/json')) {
      config = await settings.json();
      break;
    }
    if (attempt === 2) throw new Error(`QA_AUTH_SETTINGS_HTTP_${settings.status()}`);
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (!config) throw new Error('QA_AUTH_SETTINGS_INVALID');
  if (!config.external?.anonymous_users) {
    const users = JSON.parse(readFileSync('/tmp/tecla-pau-qa-users.json', 'utf8')) as { email: string; password: string }[];
    const response = await context.request.post(`${projectUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: publishable }, data: users[actor],
    });
    expect(response.ok()).toBeTruthy();
    const token = await response.json() as Record<string, unknown> & { expires_in: number };
    const stored = { ...token, expires_at: Math.floor(Date.now() / 1000) + token.expires_in };
    const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
    await context.addInitScript(({ storageKey, stored }) => { localStorage.setItem(storageKey, JSON.stringify(stored)); }, { storageKey, stored });
  }
  return context;
}

export async function enter(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
}

export async function identifyOnline(page: Page, role: PlayerRole) {
  const field = page.getByLabel('Codi privat', { exact: true });
  if (!await field.isVisible()) return;
  const path = process.env.TECLA_ONLINE_CODES_FILE ?? `${homedir()}/.config/tecla-pau/online-player-codes.json`;
  const codes = JSON.parse(readFileSync(path, 'utf8')) as Record<PlayerRole, string>;
  // Inject the private value without including it in Playwright's fill call log.
  await page.evaluate(({ value }) => {
    const input = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!input) throw new Error('ONLINE_IDENTITY_INPUT_MISSING');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, { value: codes[role] });
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(field).toHaveCount(0);
}

export async function createGame(page: Page, online: boolean, minutes = 45) {
  await page.getByRole('button', { name: online ? 'Jugar en línia' : 'Jugar en persona', exact: true }).click();
  if (online) {
    await identifyOnline(page, 'PAU');
    await page.getByRole('button', { name: 'Crear una partida', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Quant de temps voleu que duri la partida?' })).toBeVisible();
  await page.getByRole('button', { name: `${minutes} minuts` }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Pau en Pau' }).click();
  await expect(page.locator('[data-game-id]')).toBeVisible();
  if (!online) await waitForQuestion(page);
}

export async function waitForQuestion(page: Page) {
  await expect(page.locator('[data-phase]')).toHaveAttribute('data-phase', /QUESTION|TP_OPEN|TP_CLAIMED/);
  await expect(page.locator('.question-card')).toHaveAttribute('aria-busy', 'false');
}

export async function currentView(page: Page): Promise<GameView> {
  await expect(page.locator('[data-game-id]')).toBeVisible();
  const gameId = await page.locator('[data-game-id]').getAttribute('data-game-id');
  return viewForGame(page, gameId ?? '');
}

export async function viewForGame(page: Page, gameId: string): Promise<GameView> {
  const view = await page.evaluate(async ({ projectUrl, publishable, gameId }) => {
    const key = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(key) || '{}') as { access_token: string };
    const response = await fetch(`${projectUrl}/rest/v1/rpc/get_game_view`, {
      method: 'POST', headers: {apikey:publishable,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      body: JSON.stringify({p_game_id:gameId}),
    });
    if (!response.ok) throw new Error(`QA_VIEW_FAILED_HTTP_${response.status}`);
    return response.json() as Promise<GameView>;
  }, {projectUrl,publishable,gameId});
  recordQa(view.viewer.userId,view.game.id);
  return view;
}

export async function waitSynced(a: Page, b: Page) {
  await expect.poll(async () => {
    const av = Number(await a.locator('[data-state-version]').getAttribute('data-state-version'));
    const bv = Number(await b.locator('[data-state-version]').getAttribute('data-state-version'));
    return av===bv;
  }).toBe(true);
}

export async function clickAction(page: Page, name: string) {
  const version = Number(await page.locator('[data-state-version]').getAttribute('data-state-version'));
  await page.getByRole('button',{name,exact:true}).click();
  await expect.poll(async () => Number(await page.locator('[data-state-version]').getAttribute('data-state-version'))).toBeGreaterThan(version);
}
