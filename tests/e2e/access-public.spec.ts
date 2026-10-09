import { expect, test } from '@playwright/test';
import { makeContext, projectUrl, publishable } from './helpers';

test('Alcoholfabet entra directament sense codi ni avatars i conserva el so i les invitacions', async ({ browser }) => {
  const context = await makeContext(browser, 0);
  const page = await context.newPage();
  const privateAccessRequests: string[] = [], avatarRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('verify-couple-access') || request.url().includes('authorize_private_code')) privateAccessRequests.push(request.url());
    if (request.url().includes('/avatars/')) avatarRequests.push(request.url());
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Alcoholfabet', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Alcoholfabet');
    await expect(page.locator('input,.player-avatar,.home-characters')).toHaveCount(0);
    await page.getByRole('button', { name: 'Llegir les normes', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).not.toContainText('No s’encadenen bonificacions.');
    await page.getByRole('button', { name: 'Tancar', exact: true }).last().click();
    await page.getByRole('button', { name: 'So activat', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'So desactivat', exact: true })).toBeVisible();
    await page.goto('/?partida=ABCDEF');
    await expect(page.getByRole('heading', { name: 'El teu codi privat', exact: true })).toBeVisible();
    expect(privateAccessRequests).toEqual([]); expect(avatarRequests).toEqual([]);
    const unauthenticated = await context.request.post(`${projectUrl}/rest/v1/rpc/get_game_view`, {
      headers: { apikey: publishable }, data: { p_game_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(unauthenticated.ok()).toBe(false);
  } finally { await context.close(); }
});

test('el navegador no pot llegir el banc cru, secrets, migracions o avatars retirats', async ({ request }) => {
  for (const path of ['/data/questions_approved.json', '/.env.local', '/supabase/migrations/0004_seed_questions.sql']) {
    expect((await request.get(path)).ok()).toBe(false);
  }
  const avatar = await request.get('/assets/production/avatars/pau_character_v2.webp');
  expect(avatar.ok()).toBe(false);
  expect(avatar.headers()['content-type'] ?? '').not.toContain('image/');
});
