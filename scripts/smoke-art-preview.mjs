import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const directory = join(process.cwd(), 'acceptance/art-redesign');
const baseURL = process.env.TECLA_PREVIEW_URL ?? 'http://127.0.0.1:4173';
const manifest = JSON.parse(await readFile(join(directory, 'QA_MANIFEST.json'), 'utf8'));
const protectedState = JSON.parse(await readFile('/tmp/tecla-pau-art-final-storage.json', 'utf8'));
const publicEnv = Object.fromEntries((await readFile('.env.local', 'utf8')).split('\n').filter((line) => line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const projectUrl = publicEnv.VITE_SUPABASE_URL, publishable = publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
const storedSession = protectedState.origins.flatMap((origin) => origin.localStorage).find((entry) => entry.name === storageKey);
const expectedUserId = JSON.parse(storedSession?.value ?? '{}').user?.id;
if (!expectedUserId || !manifest.userIds.includes(expectedUserId)) throw new Error('PREVIEW_REFUSE_UNLISTED_SESSION');
// Reuse the same valid QA Auth session on the production-preview origin.
const storageState = { ...protectedState, origins: protectedState.origins.map((origin) => ({ ...origin, origin: new URL(baseURL).origin })) };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const errors = [], captures = []; let newAuthAttempts = 0;
const buildAssets = [];
await context.route(`${projectUrl}/auth/v1/signup`, async (route) => { newAuthAttempts += 1; await route.abort(); });
const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
try {
  const response = await page.goto(baseURL);
  expect(response?.ok()).toBe(true);
  const servedHtml = await response.text();
  const builtHtml = await readFile('dist/index.html', 'utf8');
  const expectedAssets = [...new Set(builtHtml.match(/\/assets\/[^"']+\.(?:js|css)/g) ?? [])];
  expect(expectedAssets.length).toBeGreaterThanOrEqual(2);
  for (const path of expectedAssets) {
    expect(servedHtml).toContain(path);
    const assetResponse = await context.request.get(new URL(path, baseURL).href);
    expect(assetResponse.ok()).toBe(true);
    const served = await assetResponse.body(), built = await readFile(join('dist', path.slice(1)));
    const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');
    expect(checksum(served)).toBe(checksum(built));
    buildAssets.push({ path, sha256: checksum(built), bytes: built.length, servedMatchesDist: true });
  }
  await expect(page.getByRole('button', { name: 'Jugar en persona', exact: true }).or(page.locator('[data-game-id]'))).toBeVisible({ timeout: 25000 });
  const identity = await page.evaluate(async ({ projectUrl, publishable, storageKey }) => {
    const token = JSON.parse(localStorage.getItem(storageKey) ?? '{}').access_token;
    const headers = { apikey: publishable, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const userResponse = await fetch(`${projectUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) throw new Error('PREVIEW_AUTH_FAILED');
    const user = await userResponse.json();
    const accessResponse = await fetch(`${projectUrl}/rest/v1/rpc/get_access_context`, { method: 'POST', headers, body: '{}' });
    if (!accessResponse.ok) throw new Error('PREVIEW_ACCESS_FAILED');
    const access = await accessResponse.json();
    return { userId: user.id, authorized: access.authorized, gameId: document.querySelector('[data-game-id]')?.getAttribute('data-game-id') ?? null };
  }, { projectUrl, publishable, storageKey });
  expect(identity.userId).toBe(expectedUserId); expect(identity.authorized).toBe(true); expect(newAuthAttempts).toBe(0);
  if (identity.gameId) expect(manifest.gameIds).toContain(identity.gameId);
  for (const [width, height] of [[390, 844], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(160);
    await expect(page.locator('.connection-overlay')).not.toHaveClass(/is-visible/, { timeout: 25000 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, bodyHeight: document.body.scrollHeight,
      controls: Array.from(document.querySelectorAll('button')).filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && getComputedStyle(element).visibility !== 'hidden'; }).map((element) => { const rect = element.getBoundingClientRect(); return { label: element.textContent.trim() || element.getAttribute('aria-label'), width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, artButton: element.classList.contains('art-button') }; }) }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(width); expect(layout.bodyHeight).toBeLessThanOrEqual(height);
    for (const control of layout.controls) { expect(control.artButton).toBe(true); expect(control.width).toBeGreaterThanOrEqual(47.5); expect(control.height).toBeGreaterThanOrEqual(47.5); expect(control.top).toBeGreaterThanOrEqual(0); expect(control.bottom).toBeLessThanOrEqual(height); }
    const path = `acceptance/art-redesign/screenshots/preview-${width}x${height}.png`; await page.screenshot({ path }); captures.push({ width, height, path, layout });
  }
  expect(errors).toEqual([]);
  const report = { status: 'PASS', completedAt: new Date().toISOString(), baseURL, backend: 'real Supabase', existingSessionOnly: true, newAuthAttempts, ...identity, captures, buildAssets, servedBuildMatchesFinalDist: true, errors, noSecrets: true };
  await writeFile(join(directory, 'FINAL_PREVIEW_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ preview: 'PASS', captures: captures.length, newAuthAttempts, noSecrets: true }));
} catch (error) {
  const report = { status: 'FAIL', completedAt: new Date().toISOString(), newAuthAttempts, captures, errors, error: String(error instanceof Error ? error.message : error).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]'), noSecrets: true };
  await writeFile(join(directory, 'FINAL_PREVIEW_REPORT.json'), JSON.stringify(report, null, 2) + '\n'); console.error(JSON.stringify(report)); process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
