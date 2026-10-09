import { expect, test } from '@playwright/test';
import { accessCode, makeContext, projectUrl, publishable } from './helpers';

test('accés privat real, absència de contingut abans d’entrar i so persistent', async ({ browser }) => {
  const context=await makeContext(browser,0);
  const page=await context.newPage();
  const sounds:string[]=[];
  page.on('request',request=>{if(request.url().endsWith('.wav')) sounds.push(request.url());});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Entra al joc de Pau i Tecla'})).toBeVisible();
  await expect(page.locator('.score-strip')).toHaveCount(0);
  await expect(page.locator('[data-game-id]')).toHaveCount(0);
  expect(sounds).toEqual([]);
  await page.getByLabel('Codi privat',{exact:true}).fill('incorrecte-de-prova');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('El codi no és correcte.');
  await expect(page.locator('.score-strip')).toHaveCount(0);
  await page.getByLabel('Codi privat',{exact:true}).fill(accessCode);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Jugar en persona',exact:true})).toBeVisible();
  expect(sounds.length).toBeGreaterThan(0);
  expect(await page.locator('input').count()).toBe(0);
  await page.getByRole('button',{name:'So activat',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'So desactivat',exact:true})).toBeVisible();
  await page.goto('/?partida=ABCDEF');
  await expect(page.getByRole('heading',{name:'Qui ets?',exact:true})).toBeVisible();
  const outsider=await context.request.post(`${projectUrl}/rest/v1/rpc/get_game_view`,{
    headers:{apikey:publishable},data:{p_game_id:'00000000-0000-0000-0000-000000000000'},
  });
  expect(outsider.ok()).toBe(false);
  await context.close();
});

test('el servidor de desenvolupament també protegeix les preguntes i les fotos privades',async({request})=>{
  expect((await request.get('/data/questions_approved.json')).ok()).toBe(false);
  expect((await request.get('/.env.local')).ok()).toBe(false);
  expect((await request.get('/supabase/migrations/0004_seed_questions.sql')).ok()).toBe(false);
});
