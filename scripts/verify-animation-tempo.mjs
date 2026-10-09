import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const baseline=process.argv.includes('--baseline'), origin='http://127.0.0.1:5173';
const directory=baseline?'audit/animation-tempo-before':'acceptance/animation-tempo';
await mkdir(join(directory,'screenshots'),{recursive:true});
const browser=await chromium.launch({executablePath:join(homedir(),'.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'),headless:true,args:['--no-sandbox']});
const errors=[],blocked=[],captures=[];
const session=`const noop=()=>{};const session={loading:false,pending:false,access:{authorized:true,scoreboard:{pauWins:0,teclaWins:0,completedGames:0},activeGameId:null,onlineRole:'PAU'},view:null,userId:'local-setup-qa',error:null,run:async()=>false,refresh:async()=>{},boot:async()=>{},acceptView:noop,goHome:noop,clearError:noop};export function useGameSession(){return session;}`;
try{
 for(const mode of (baseline?['IN_PERSON']:['IN_PERSON','ONLINE']))for(const [width,height]of [[390,844],[1024,768],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height}});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin||/\/(auth|rest|realtime|graphql)\/v1/.test(url.pathname)){blocked.push(url.origin+url.pathname);return route.abort();}if(url.pathname==='/src/hooks/useGameSession.ts')return route.fulfill({status:200,contentType:'application/javascript',body:session});return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.getByRole('button',{name:mode==='IN_PERSON'?'Jugar en persona':'Jugar en línia',exact:true}).click();
  if(mode==='ONLINE'){await page.getByRole('button',{name:'Crear una partida',exact:true}).click();}
  await page.getByRole('heading',{name:'Quant de temps voleu que duri la partida?',exact:true}).waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(image=>image.decode()));});
  const data=await page.evaluate(()=>({hintCount:document.querySelectorAll('.setup-hint').length,text:document.body.innerText,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,buttons:Array.from(document.querySelectorAll('.duration-options button')).map(button=>button.innerText)}));
  const removed=!data.text.includes('Estimació amb torns de 30 segons. Jugueu al vostre ritme.')&&data.hintCount===0;
  const failures=[];if(baseline?!data.hintCount:!removed)failures.push('WRONG_HINT_VISIBILITY');if(data.bodyWidth>width||data.bodyHeight>height)failures.push('OVERFLOW');
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('heading',{name:'Qui comença?',exact:true}).waitFor();
  await page.getByRole('button',{name:'Enrere',exact:true}).click();
  const screenshot=`screenshots/duration-${mode.toLowerCase()}-${width}x${height}.png`;await page.screenshot({path:join(directory,screenshot)});
  captures.push({mode,width,height,screenshot,status:failures.length?'FAIL':'PASS',failures,hintCount:data.hintCount,bodyWidth:data.bodyWidth,bodyHeight:data.bodyHeight,options:data.buttons,continueAndBack:'PASS'});
  await context.close();
 }
}catch(error){errors.push(String(error.stack??error));}finally{
 await browser.close();const status=captures.length===(baseline?3:6)&&captures.every(item=>item.status==='PASS')&&!errors.length&&!blocked.length?'PASS':'FAIL';
 const report={status,completedAt:new Date().toISOString(),baseline,scope:'Real production App and setup flow; session hook replaced in browser routing with a local authorized access fixture. No Auth, DB or RPC writes.',captures,errors,blockedApiRequests:blocked,anonymousSessionsCreated:0,gamesCreated:0};
 await writeFile(join(directory,'SETUP_BROWSER_REPORT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(status!=='PASS')process.exitCode=1;
}
