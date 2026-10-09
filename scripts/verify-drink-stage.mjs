import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const root = process.cwd(), origin = 'http://127.0.0.1:5173';
const output = process.argv.find(argument => argument.startsWith('--output-dir='))?.slice('--output-dir='.length);
const directory = join(root, output ?? 'acceptance/drink-stage');
const drinkTimeline = JSON.parse(await readFile(join(root, 'motion/event-choreography.json'), 'utf8')).INCORRECT_AND_DRINK;
const html = join(root, '.drink-stage-qa.html'), jsx = join(root, '.drink-stage-qa.tsx');
if (existsSync(html) || existsSync(jsx)) throw new Error('REFUSE_OVERWRITE_DRINK_STAGE_HARNESS');
await mkdir(join(directory, 'screenshots'), { recursive: true });
await mkdir(join(directory, 'videos'), { recursive: true });

// Real production components, hook, runner, audio manager and orchestrator;
// typed confirmed-view fixtures never touch Auth, RPCs or persisted game data.
const source = `import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Scene} from '/src/components/Scene.tsx';
import {Board} from '/src/components/Board.tsx';
import {PlayerBadge} from '/src/components/PlayerBadge.tsx';
import {QuestionCard} from '/src/components/QuestionCard.tsx';
import {DrinkCelebration} from '/src/components/DrinkCelebration.tsx';
import {ArtButtonPrimary,ArtIconButton} from '/src/components/art/index.ts';
import {ca} from '/src/content/ca.ts';
import {useGameMotion} from '/src/motion/useGameMotion.ts';
import {GameAudioManager} from '/src/motion/audio.ts';
import type {GameView} from '/src/services/game-contract.ts';
import type {BoardCell,PlayerRole} from '/src/domain/game/game-types.ts';
import '/src/styles/base.css';import '/src/styles/game.css';import '/src/motion/motion.css';
const params=new URLSearchParams(location.search),player:PlayerRole=params.get('player')==='TECLA'?'TECLA':'PAU',double=params.has('double');
const cells:BoardCell[]=Array.from({length:24},(_,index)=>({position:index+1,type:index%5===4?'TP':index%2?'CROSSED':'PERSONAL',modifier:index%7===6?'PLUS_ONE':'NONE'}));
function view(result=false):GameView{return{
game:{id:'drink-stage-qa',coupleId:'local-fixture',inviteCode:null,mode:'IN_PERSON',status:'ACTIVE',phase:result?'RESULT':'ANSWER_REVEALED',currentTurn:player==='PAU'?'TECLA':'PAU',startingPlayer:'PAU',targetMinutes:20,finishPosition:25,currentTargetCell:3,tpClaimant:player,respondingPlayer:player,pauPosition:2,teclaPosition:1,turnNumber:4,stateVersion:result?2:1,winner:null},
viewer:{role:'IN_PERSON_CONTROLLER',userId:'local-fixture'},board:cells,
question:{id:'fixture-question',pool:'TP',topic:'Cultura',questionCa:'Com s’anomena un grup de persones que canten juntes?'},
capabilities:{canSeeAnswer:false,canJudge:!result,canBeginTurn:false,canReveal:false,canClaim:false,canNextTurn:result,canStart:false,canAbandon:true},members:[{role:'IN_PERSON_CONTROLLER'}],
lastEvent:result?{id:'confirmed-incorrect',type:'JUDGE_INCORRECT',stateVersion:2,createdAt:'',payload:{correct:false,respondingPlayer:player,drinkCount:double?2:1}}:null,
scoreboard:{pauWins:0,teclaWins:0,completedGames:0}};}
const qa=window.drinkStageQa={mounts:0,cues:[],frames:[],busy:false,sampling:false,start:0};
const playAudio=GameAudioManager.prototype.play;
GameAudioManager.prototype.play=function(cue,key,signal){qa.cues.push({cue,at:performance.now()-qa.start,enabled:this.enabled});return playAudio.call(this,cue,key,signal);};
function sample(){if(!qa.sampling)return;const stage=document.querySelector('[data-drink-presentation]');const glass=document.querySelector('[data-motion="drinkHeroFirst"]');const liquid=document.querySelector('[data-motion="drinkLiquidFirst"]');qa.frames.push({at:performance.now()-qa.start,present:!!stage,transform:glass?getComputedStyle(glass).transform:null,liquid:liquid?getComputedStyle(liquid).transform:null,opacity:stage?getComputedStyle(stage).opacity:null,particles:document.querySelectorAll('.drink-stage__sparkles .tp-motion-particle').length});requestAnimationFrame(sample);}
function Harness(){const[current,setCurrent]=useState<GameView|null>(()=>view(params.has('hydrate')));const motion=useGameMotion(current);qa.busy=motion.busy;
useEffect(()=>{if(motion.drinkPresentation)qa.mounts++;},[motion.drinkPresentation?.key]);
function play(){motion.unlockAudio();qa.start=performance.now();qa.sampling=true;requestAnimationFrame(sample);setCurrent(view(true));}
return <><Scene variant="game"><div className="app-header"><span className="brand">{ca.appTitle}</span><div className="header-actions"><ArtIconButton icon="rules" aria-label={ca.showRules}/><ArtIconButton icon={motion.soundEnabled?'sound_on':'sound_off'} aria-label="Canvia el so" onClick={motion.toggleSound}/><ArtIconButton icon="home" aria-label={ca.exit}/></div></div>
<div className="game-layout" data-motion="gameCamera"><header className="game-hud"><PlayerBadge player="PAU" position={2} finishPosition={25} active={player==='PAU'}/><div className={'turn-label turn-label--'+player.toLowerCase()}><span>{player==='PAU'?ca.turnPau:ca.turnTecla}</span><small>{ca.turnLabel} 4</small></div><PlayerBadge player="TECLA" position={1} finishPosition={25} active={player==='TECLA'}/></header>
<section className="board-column"><Board cells={cells} positions={{PAU:2,TECLA:1}} activePlayer={player} targetPosition={3} finishPosition={25} busy={motion.busy}/></section>
<section className="card-column"><QuestionCard category={ca.tpBoth} pool="TP" question={view().question!.questionCa} phase={current?.game.phase??'RESULT'} busy={motion.busy} drinkPlayer={current?.game.phase==='RESULT'?player:undefined} drinkDouble={double}>
{current?.game.phase==='RESULT'?<><div className="result-note is-incorrect"><strong>{ca.incorrect}!</strong><p>{ca.doNotAdvance} {ca.loseTurn}</p></div><ArtButtonPrimary className="primary-button" disabled={motion.busy}>{ca.nextTurn}</ArtButtonPrimary></>:<ArtButtonPrimary className="primary-button" onClick={play}>Provar el brindis</ArtButtonPrimary>}
</QuestionCard></section></div></Scene><DrinkCelebration presentation={motion.drinkPresentation}/>
<div className="qa-tools"><button onClick={()=>setCurrent(view(true))}>Duplicat</button><button onClick={motion.disconnect}>Desconnecta</button><button onClick={motion.reconnect}>Reconnecta</button><button onClick={()=>setCurrent(null)}>Menú</button><span data-qa-busy={motion.busy}>{motion.busy?'Animant':'Preparat'}</span></div></>}
createRoot(document.getElementById('root')!).render(<Harness/>);`;
await writeFile(jsx, source);
await writeFile(html, '<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA del brindis central</title><style>.qa-tools{position:fixed;bottom:0;left:0;z-index:200;display:flex;gap:5px;font:9px sans-serif}.qa-tools button{font:9px sans-serif;padding:2px;color:#fff;background:#302216;border:1px solid #b99564}.qa-tools span{color:#fff}</style></head><body><div id="root"></div><script type="module" src="/.drink-stage-qa.tsx"></script></body></html>');
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const cases = [], lifecycle = [], errors = [], blocked = [], audioFiles = new Set();
const sizes = [[360,800],[390,844],[430,932],[1024,768],[1440,900]];
const scenarios = [[false, 'PAU', false], [false, 'TECLA', true], [true, 'PAU', true], [true, 'TECLA', false]];
let status = 'FAIL';
async function contextFor(width, height, reduced, video = false) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? { recordVideo: { dir: join(directory,'videos'), size: { width, height } } } : {}) });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || /\/(auth|rest|realtime|graphql)\/v1/.test(url.pathname)) { blocked.push(url.origin + url.pathname); return route.abort(); }
    if (url.pathname.endsWith('.wav')) audioFiles.add(url.pathname);
    return route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}
async function ready(page, player, double, hydrate = false) {
  await page.goto(`${origin}/.drink-stage-qa.html?player=${player}${double?'&double':''}${hydrate?'&hydrate':''}`);
  await page.locator('.question-card').waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(image => image.decode())); });
}
try {
  for (const [reduced, player, double] of scenarios) for (const [width,height] of (reduced ? [[390,844],[1024,768],[1440,900]] : sizes)) {
    const video = !reduced && width === 390 && player === 'TECLA';
    const { context, page } = await contextFor(width,height,reduced,video);
    await ready(page,player,double);
    const boardBefore = await page.locator('.game-board').boundingBox();
    await page.getByRole('button',{name:'Provar el brindis',exact:true}).click();
    const stage = page.locator('[data-drink-presentation]'); await stage.waitFor({state:'attached'});
    await page.waitForTimeout(reduced ? Math.round(drinkTimeline.reducedTotalMs * .3) : Math.round(drinkTimeline.totalMs * .32));
    const geometry = await page.evaluate(() => {
      const bounds = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
      const stage=document.querySelector('[data-drink-presentation]');const content=document.querySelector('.drink-stage__content');
      return { width:innerWidth,height:innerHeight,stage:bounds('.drink-stage'),content:bounds('.drink-stage__content'),glass:bounds('[data-motion="drinkHeroFirst"]'),caption:bounds('.drink-stage__caption'),board:bounds('.game-board'),player:stage?.getAttribute('data-drink-player'),count:stage?.getAttribute('data-drink-count'),text:content?.textContent,svgGlasses:document.querySelectorAll('.drink-stage__glass svg').length,bitmapGlasses:document.querySelectorAll('.drink-stage img').length,opacity:stage?getComputedStyle(stage).opacity:null,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,nextDisabled:document.querySelector('.question-actions button')?.disabled};
    });
    const screenshot = `screenshots/drink-${player.toLowerCase()}-${double?'double':'single'}-${width}x${height}${reduced?'-reduced':''}.png`;
    await page.screenshot({path:join(directory,screenshot)});
    await stage.waitFor({state:'detached'});
    await page.locator('[data-qa-busy="false"]').waitFor();
    await page.evaluate(() => { window.drinkStageQa.sampling=false; });
    await page.getByRole('button',{name:'Duplicat',exact:true}).click();
    await page.waitForTimeout(200);
    const data = await page.evaluate(() => ({...window.drinkStageQa, remainingStages:document.querySelectorAll('[data-drink-presentation]').length,remainingParticles:document.querySelectorAll('.tp-motion-particle').length,remainingAnimations:document.getAnimations().length,nextDisabled:document.querySelector('.question-actions button')?.disabled}));
    const transforms = new Set(data.frames.filter(frame=>frame.present).map(frame=>frame.transform));
    const liquids = new Set(data.frames.filter(frame=>frame.present).map(frame=>frame.liquid));
    const maximumParticles = Math.max(0,...data.frames.map(frame=>frame.particles));
    const visibleFrames = data.frames.filter(frame=>frame.present);
    const visibleDurationMs = visibleFrames.length ? visibleFrames.at(-1).at - visibleFrames[0].at : 0;
    const center = {x:geometry.content.x+geometry.content.width/2,y:geometry.content.y+geometry.content.height/2};
    const failures = [];
    if(Math.abs(center.x-width/2)>1||Math.abs(center.y-height/2)>1)failures.push('NOT_VIEWPORT_CENTERED');
    if(geometry.content.left<0||geometry.content.right>width||geometry.content.top<0||geometry.content.bottom>height)failures.push('COMPOSITION_OUTSIDE_VIEWPORT');
    if(geometry.glass.height<220||geometry.glass.width<165)failures.push('GLASS_TOO_SMALL');
    if(geometry.svgGlasses!==(double?2:1)||geometry.bitmapGlasses)failures.push('GLASS_NOT_CRISP_VECTOR');
    if(geometry.player!==player||geometry.count!==String(double?2:1)||!geometry.text.includes(player==='PAU'?'En Pau':'La Tecla')||!geometry.text.includes('ha de beure')||(double&&!geometry.text.includes('Beu doble')))failures.push('WRONG_RECIPIENT_OR_PENALTY');
    if(Number(geometry.opacity)<.99||!geometry.nextDisabled)failures.push('STAGE_OR_BUSY_STATE_WRONG');
    if(data.mounts!==1||data.cues.map(item=>item.cue).join(',')!==`INCORRECT,${double?'DOUBLE_DRINK':'DRINK'}`)failures.push('EVENT_OR_SOUND_REPEATED');
    if(visibleDurationMs < (reduced ? drinkTimeline.reducedTotalMs : drinkTimeline.totalMs) * .94)failures.push('STAGE_CLOSED_TOO_EARLY');
    if(data.remainingStages||data.remainingParticles||data.remainingAnimations||data.nextDisabled)failures.push('RESIDUAL_EFFECT_OR_LOCK');
    if(reduced ? transforms.size!==1||liquids.size!==1||maximumParticles!==0 : transforms.size<12||liquids.size<12||maximumParticles!==10)failures.push('MOTION_OR_REDUCED_MOTION_WRONG');
    if(Math.abs(boardBefore.x-geometry.board.x)>.1||Math.abs(boardBefore.y-geometry.board.y)>.1||Math.abs(boardBefore.width-geometry.board.width)>.1||Math.abs(boardBefore.height-geometry.board.height)>.1)failures.push('BOARD_LAYOUT_SHIFT');
    if(geometry.bodyWidth>width||geometry.bodyHeight>height)failures.push('PAGE_OVERFLOW');
    const result={status:failures.length?'FAIL':'PASS',player,double,reduced,width,height,screenshot,geometry,center,mounts:data.mounts,cues:data.cues,frames:data.frames.length,visibleDurationMs,distinctGlassTransforms:transforms.size,distinctLiquidTransforms:liquids.size,maximumParticles,remainingStages:data.remainingStages,remainingParticles:data.remainingParticles,failures};
    cases.push(result);console.log(JSON.stringify({size:`${width}x${height}`,player,double,reduced,status:result.status,failures}));
    if(video){const recording=page.video();await context.close();await recording.saveAs(join(directory,'videos','double-tecla-390x844.webm'));await recording.delete();}else await context.close();
  }
  for (const action of ['Desconnecta','Menú']) {
    const {context,page}=await contextFor(390,844,false);
    await ready(page,'PAU',true);await page.getByRole('button',{name:'Provar el brindis',exact:true}).click();
    await page.locator('[data-drink-presentation]').waitFor({state:'attached'});await page.waitForTimeout(330);
    await page.getByRole('button',{name:action,exact:true}).click();
    await page.locator('[data-drink-presentation]').waitFor({state:'detached'});await page.locator('[data-qa-busy="false"]').waitFor();
    if(action==='Desconnecta'){await page.getByRole('button',{name:'Reconnecta',exact:true}).click();await page.locator('[data-qa-busy="false"]').waitFor();await page.getByRole('button',{name:'Duplicat',exact:true}).click();}
    await page.waitForTimeout(250);
    const data=await page.evaluate(()=>({mounts:window.drinkStageQa.mounts,stages:document.querySelectorAll('[data-drink-presentation]').length,particles:document.querySelectorAll('.tp-motion-particle').length,animations:document.getAnimations().length}));
    lifecycle.push({action,...data,status:data.mounts===1&&!data.stages&&!data.particles&&!data.animations?'PASS':'FAIL'});await context.close();
  }
  const {context,page}=await contextFor(390,844,false);
  await ready(page,'TECLA',true,true);await page.waitForTimeout(300);
  await page.reload();await page.waitForTimeout(300);
  const hydration=await page.evaluate(()=>({mounts:window.drinkStageQa.mounts,cues:window.drinkStageQa.cues.length,stages:document.querySelectorAll('[data-drink-presentation]').length,notice:document.querySelector('.drink-notice')?.textContent}));
  lifecycle.push({action:'Hydrate and reload confirmed RESULT',...hydration,status:!hydration.mounts&&!hydration.cues&&!hydration.stages&&hydration.notice.includes('La Tecla ha de beure')?'PASS':'FAIL'});await context.close();
  status=cases.length===16&&cases.every(item=>item.status==='PASS')&&lifecycle.every(item=>item.status==='PASS')&&!errors.length&&!blocked.length?'PASS':'FAIL';
} catch(error) { errors.push(String(error.stack??error)); }
finally {
  await browser.close();await unlink(html);await unlink(jsx);
  const hashes=[];for(const path of ['src/components/DrinkCelebration.tsx','src/art-system/drink-stage.css','src/motion/useGameMotion.ts','src/motion/dom-runner.ts','motion/event-choreography.json'])hashes.push({path,sha256:createHash('sha256').update(await readFile(join(root,path))).digest('hex')});
  const report={status,completedAt:new Date().toISOString(),scope:'Chromium executes production Scene, Board, QuestionCard, DrinkCelebration, useGameMotion, effects, choreography, DOM runner, event orchestrator and Web Audio manager. Typed safe-view fixtures only; no live Supabase calls.',cases,lifecycle,errors,blockedApiRequests:blocked,requestedAudioFiles:[...audioFiles],anonymousSessionsCreated:0,gamesCreated:0,temporaryHarnessRemoved:true,hashes,visualInspectionPending:true};
  await writeFile(join(directory,'BROWSER_REPORT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status,cases:cases.length,lifecycle:lifecycle.length,errors,blockedApiRequests:blocked.length,temporaryHarnessRemoved:true}));
  if(status!=='PASS')process.exitCode=1;
}
