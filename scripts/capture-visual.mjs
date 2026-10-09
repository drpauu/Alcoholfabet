import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const cwd=process.cwd();
await mkdir(join(cwd,'acceptance/screenshots'),{recursive:true});
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || [join(homedir(),'.cache/ms-playwright/chromium-1200/chrome-linux64/chrome')].find(existsSync);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',deviceScaleFactor:1});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const metrics=[];
const sizes=[[390,844],[1024,768],[1440,900],[360,800],[430,932],[1366,768],[768,1024],[844,390]];
async function shot(scenario,width,height){
 await page.setViewportSize({width,height});await page.waitForTimeout(180);
 await page.screenshot({path:`${cwd}/acceptance/screenshots/real-${scenario}-${width}x${height}.png`});
 metrics.push({scenario,width,height,layout:await page.evaluate(()=>({phase:document.querySelector('[data-phase]')?.getAttribute('data-phase'),bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,viewportHeight:innerHeight,card:document.querySelector('.question-card')?.getBoundingClientRect().toJSON(),board:document.querySelector('.game-board')?.getBoundingClientRect().toJSON(),gateVisible:document.querySelector('.orientation-gate')?getComputedStyle(document.querySelector('.orientation-gate')).display:'absent',paddingTop:getComputedStyle(document.querySelector('.scene-content')).paddingTop,paddingBottom:getComputedStyle(document.querySelector('.scene-content')).paddingBottom,mainControls:Array.from(document.querySelectorAll('.primary-button,.secondary-button,.blue-button,.pink-button,.danger-button')).filter(button=>button.getBoundingClientRect().width>0).map(button=>({label:button.textContent.trim(),width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})),judgeGap:document.querySelector('.judge-controls')?getComputedStyle(document.querySelector('.judge-controls')).columnGap:null}))});
}
await page.goto(process.env.TECLA_VISUAL_URL || 'http://127.0.0.1:5173');
await expect(page.getByLabel('Codi privat',{exact:true})).toBeVisible({timeout:20000});
for(const [width,height] of sizes.slice(0,3))await shot('access',width,height);
const code=(await readFile(process.env.TECLA_ACCESS_CODE_FILE || join(homedir(),'.config/tecla-pau/access-code.txt'),'utf8')).trim();
await page.getByLabel('Codi privat',{exact:true}).fill(code);await page.getByRole('button',{name:'Entrar',exact:true}).click();
await expect(page.getByRole('button',{name:'Jugar en persona',exact:true})).toBeVisible({timeout:20000});
for(const [width,height] of sizes.slice(0,6))await shot('home',width,height);
await page.getByRole('button',{name:'Jugar en persona',exact:true}).click();
await expect(page.getByRole('heading',{name:'Quant de temps voleu que duri la partida?',exact:true})).toBeVisible();
for(const [width,height] of sizes.slice(0,6))await shot('duration',width,height);
await page.getByRole('button',{name:'45 minuts',exact:true}).click();
await page.getByRole('button',{name:'Continuar',exact:true}).click();
await page.getByRole('button',{name:'Pau en Pau',exact:true}).click();
await expect(page.locator('[data-game-id]')).toBeVisible({timeout:20000});
await expect(page.locator('.connection-overlay')).not.toHaveClass(/is-visible/,{timeout:20000});
await expect(page.getByRole('button',{name:'Començar el torn',exact:true})).toBeEnabled({timeout:20000});
for(const [width,height] of sizes.slice(0,3))await shot('turn-intro',width,height);
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:'Començar el torn',exact:true}).click();
await expect(page.getByRole('button',{name:'Mostra la resposta',exact:true}).or(page.getByRole('button',{name:'En Pau respon!',exact:true}))).toBeVisible();
if(await page.getByRole('button',{name:'En Pau respon!',exact:true}).isVisible())await page.getByRole('button',{name:'En Pau respon!',exact:true}).click();
await expect(page.getByRole('button',{name:'Mostra la resposta',exact:true})).toBeEnabled();
for(const [width,height] of sizes)await shot('game',width,height);
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:'Mostra la resposta',exact:true}).click();
await expect(page.locator('.answer-panel')).toBeVisible();
await expect(page.getByRole('button',{name:'Correcte',exact:true})).toBeEnabled();
for(const [width,height] of sizes)await shot('answer',width,height);
const gameId=await page.locator('[data-game-id]').getAttribute('data-game-id');
const userId=await page.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('sb-')&&key.endsWith('-auth-token'));return key?JSON.parse(localStorage.getItem(key)||'{}').user?.id:null;});
await writeFile(`${cwd}/acceptance/screenshots/real-visual-metrics.json`,JSON.stringify({backend:'real Supabase Anonymous Auth + authorized device + in-person RPC',gameId,userId,errors,metrics},null,2));
expect(errors).toEqual([]);
for (const capture of metrics) {
  expect(capture.layout.bodyWidth).toBeLessThanOrEqual(capture.width);
  expect(capture.layout.bodyHeight).toBeLessThanOrEqual(capture.height);
  for (const control of capture.layout.mainControls) {
    expect(control.width).toBeGreaterThanOrEqual(48);
    expect(control.height).toBeGreaterThanOrEqual(48);
  }
}
console.log(JSON.stringify({gameId,userId,errors,captures:metrics.length,evidence:'acceptance/screenshots/real-visual-metrics.json'}));
await writeFile(process.env.TECLA_VISUAL_STATE_FILE || '/tmp/tecla-pau-visual-storage.json',JSON.stringify(await context.storageState()),{mode:0o600});
await context.close();await browser.close();
