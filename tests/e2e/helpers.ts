import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { GameView } from '../../src/services/game-contract';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(line => line.includes('=')).map(line => {
  const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).trim()];
}));
export const projectUrl = env.VITE_SUPABASE_URL;
export const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const accessCode = readFileSync(process.env.TECLA_ACCESS_CODE_FILE || '/home/pau/.config/tecla-pau/access-code.txt', 'utf8').trim();

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
  const settings = await context.request.get(`${projectUrl}/auth/v1/settings`, { headers: { apikey: publishable } });
  const config = await settings.json() as { external?: { anonymous_users?: boolean } };
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
  await expect(page.getByRole('button',{name:'Entrar',exact:true}).or(page.getByRole('button',{name:'Jugar en persona',exact:true}))).toBeVisible();
  if (await page.getByLabel('Codi privat',{exact:true}).isVisible()) {
    await page.getByLabel('Codi privat', { exact: true }).fill(accessCode);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
}

export async function createGame(page: Page, online: boolean, minutes = 45) {
  await page.getByRole('button', { name: online ? 'Jugar en línia' : 'Jugar en persona', exact: true }).click();
  if (online) {
    await page.getByRole('button', { name: 'Crear una partida', exact: true }).click();
    await page.getByRole('button', { name: 'Soc en Pau' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Quant de temps voleu que duri la partida?' })).toBeVisible();
  await page.getByRole('button', { name: `${minutes} minuts` }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Pau en Pau' }).click();
  await expect(page.locator('[data-game-id]')).toBeVisible();
}

export async function currentView(page: Page): Promise<GameView> {
  await expect(page.locator('[data-game-id]')).toBeVisible();
  const view = await page.evaluate(async ({ projectUrl, publishable }) => {
    const key = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(key) || '{}') as { access_token: string };
    const gameId = document.querySelector('[data-game-id]')?.getAttribute('data-game-id');
    const response = await fetch(`${projectUrl}/rest/v1/rpc/get_game_view`, {
      method: 'POST', headers: {apikey:publishable,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      body: JSON.stringify({p_game_id:gameId}),
    });
    if (!response.ok) throw new Error(`QA_VIEW_FAILED_HTTP_${response.status}`);
    return response.json() as Promise<GameView>;
  }, {projectUrl,publishable});
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
