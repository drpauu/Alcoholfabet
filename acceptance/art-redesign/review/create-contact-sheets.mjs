import { access, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// This lays out the original PNG captures. It does not modify their pixels.
const reviewDirectory = dirname(fileURLToPath(import.meta.url));
const captureDirectory = join(reviewDirectory, '..', 'screenshots');
const scenarios = [
  ['home', 'Inici'], ['duration', 'Durada'], ['online-lobby', 'Sala en línia'],
  ['turn-intro', 'Introducció del torn'], ['question', 'Pregunta'],
  ['answer-revealed', 'Resposta'], ['correct', 'Encert'],
  ['incorrect', 'Error i got'], ['tp', 'T&P'], ['plus-one', '+1'],
  ['disconnect', 'Connexió'], ['victory', 'Victòria'],
];
const onlineScenarios = [
  ['private-access', 'Accés privat'], ['private-access-error', 'Error d’accés'],
  ['online-choice', 'Elecció en línia'], ['role', 'Rol'], ['join', 'Unir-se'],
  ['online-respondent', 'Respondent'], ['online-judge', 'Jutge'],
  ['abandoned', 'Partida abandonada'], ['loading', 'Càrrega'],
];
const sizes = [[390, 844], [1024, 768], [1440, 900]];

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  for (const collection of [{ name: 'contact-sheet', label: 'dotze captures reals', scenarios, required: true }, { name: 'contact-online', label: 'altres estats en línia', scenarios: onlineScenarios, required: false }]) {
  for (const [width, height] of sizes) {
    const size = `${width}x${height}`;
    const items = [];
    for (const [name, label] of collection.scenarios) {
      const item = { file: `${name}-${size}.png`, label };
      try { await access(join(captureDirectory, item.file)); items.push(item); }
      catch (error) { if (collection.required) throw error; }
    }
    const columns = width === 390 ? 4 : 3;
    const figureWidth = width === 390 ? 220 : width === 1024 ? 350 : 460;
    const html = `<!doctype html><html lang="ca"><meta charset="utf-8"><title>Revisió ${size}</title>
<style>body{margin:0;padding:20px;background:#e9dcc4;color:#343d3b;font:14px system-ui}h1{font-size:20px;margin:0 0 16px}main{display:grid;grid-template-columns:repeat(${columns},${figureWidth}px);gap:16px}figure{margin:0;background:#f8edd6;border:1px solid #b89564;padding:6px}figcaption{height:25px;font-weight:700}img{display:block;width:100%;height:auto}</style>
<h1>Tecla&Pau — ${size} — ${collection.label}</h1><main>${items.map(item => `<figure><figcaption>${item.label}</figcaption><img src="../screenshots/${item.file}"></figure>`).join('')}</main></html>`;
    const output = join(reviewDirectory, `${collection.name}-${size}.html`);
    await writeFile(output, html);
    const page = await browser.newPage({ viewport: { width: columns * figureWidth + 16 * (columns - 1) + 40, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(output).href);
    await page.evaluate(() => Promise.all(Array.from(document.images, image => image.decode())));
    await page.screenshot({ path: join(reviewDirectory, `${collection.name}-${size}.png`), fullPage: true });
    await page.close();
    console.log(JSON.stringify({ collection: collection.name, size, availableScreens: items.length }));
  }
  }
} finally {
  await browser.close();
}
