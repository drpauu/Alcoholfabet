import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const root = process.cwd(), origin = 'http://127.0.0.1:5173';
const baseline = process.argv.includes('--baseline');
const directory = join(root, baseline ? 'audit/alcoholfabet-before' : 'acceptance/alcoholfabet');
const htmlPath = join(root, '.alcoholfabet-qa.html'), jsxPath = join(root, '.alcoholfabet-qa.tsx');
const sizes = [[360,800],[390,844],[430,932],[1024,768],[1440,900]];
const cases = ['double-pau-three-lines','double-tecla-three-lines','double-pau-longest','double-tecla-longest','answer-three-lines','answer-longest'];
const approved = JSON.parse(await readFile(join(root,'data/questions_approved.json'),'utf8')).filter(question=>question.active && question.factualReviewed && question.reviewStatus === 'APPROVED');
const longest = approved.sort((first,second)=>second.questionCa.length-first.questionCa.length)[0];
const threeLines = approved.find(question=>question.questionCa === 'Com s’anomena un grup de persones que canten juntes?');
if (!threeLines) throw new Error('APPROVED_THREE_LINE_QUESTION_MISSING');
if (existsSync(htmlPath) || existsSync(jsxPath)) throw new Error('SMALL_FINAL_HARNESS_REFUSE_OVERWRITE');
await mkdir(join(directory,'screenshots'),{recursive:true});
const source = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { Scene } from '/src/components/Scene.tsx';
import { Board } from '/src/components/Board.tsx';
import { PlayerBadge } from '/src/components/PlayerBadge.tsx';
import { QuestionCard } from '/src/components/QuestionCard.tsx';
import { ArtButtonPrimary, ArtButtonCorrect, ArtButtonIncorrect, ArtIconButton, ArtIcon } from '/src/components/art/index.ts';
import { ca } from '/src/content/ca.ts';
import '/src/styles/base.css';
import '/src/styles/game.css';
import '/src/motion/motion.css';
import '/src/art-system/icons.css';
import '/src/art-system/effects.css';
const shortQuestion = ${JSON.stringify(threeLines)};
const longQuestion = ${JSON.stringify(longest)};
const cells = Array.from({length:24},(_,index)=>({position:index+1,type:index%5===4?'TP':index%2?'CROSSED':'PERSONAL',modifier:index%7===6?'PLUS_ONE':'NONE'})) as any;
const scenario = new URLSearchParams(location.search).get('case') ?? 'double-pau-three-lines';
const answer = scenario.startsWith('answer'), player = scenario.includes('tecla') ? 'TECLA' : 'PAU';
const question = scenario.endsWith('longest') ? longQuestion : shortQuestion;
function Harness(){return <Scene variant="game"><div className="app-header"><span className="brand">{ca.appTitle}</span><div className="header-actions"><ArtIconButton icon="rules" aria-label={ca.showRules}/><ArtIconButton icon="sound_on" aria-label={ca.soundOn}/><ArtIconButton icon="home" aria-label={ca.exit}/></div></div>
<div className="game-layout"><header className="game-hud"><PlayerBadge player="PAU" position={2} finishPosition={25} active={player==='PAU'}/><div className={'turn-label turn-label--'+player.toLowerCase()}><span>{player==='PAU'?ca.turnPau:ca.turnTecla}</span><small>{ca.turnLabel} 4</small></div><PlayerBadge player="TECLA" position={1} finishPosition={25} active={player==='TECLA'}/></header>
<section className="board-column" aria-label={ca.boardLabel}><Board cells={cells} positions={{PAU:2,TECLA:1}} activePlayer={player} targetPosition={3} finishPosition={25}/><div className="board-legend"><span><ArtIcon name="personal"/>{ca.personalLabel}</span><span><ArtIcon name="crossed"/>{ca.crossedLabel}</span><span><ArtIcon name="tp"/>T&amp;P</span></div></section>
<section className="card-column"><QuestionCard category={player==='PAU'?ca.personalPau:ca.personalTecla} pool={player} question={question.questionCa} answer={answer?question.answerCa:undefined} answerVisible phase={answer?'ANSWER_REVEALED':'RESULT'} drinkPlayer={answer?undefined:player} drinkDouble={!answer}>
{answer?<div className="judge-controls" data-motion="judgeButtons"><ArtButtonIncorrect className="danger-button">{ca.incorrect}</ArtButtonIncorrect><ArtButtonCorrect className="primary-button">{ca.correct}</ArtButtonCorrect></div>:<><div className="result-note is-incorrect"><strong>{ca.incorrect}!</strong><p>{ca.doNotAdvance} {ca.loseTurn}</p></div><ArtButtonPrimary className="primary-button">{ca.nextTurn}</ArtButtonPrimary></>}
</QuestionCard></section></div><div className="alcoholfabet-qa-label">QA local · components reals · sense App, Auth ni DB</div></Scene>}
createRoot(document.getElementById('root')!).render(<Harness/>);`;
await writeFile(jsxPath,source);
await writeFile(htmlPath,'<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA presentacional de targetes petites</title><style>.alcoholfabet-qa-label{position:fixed;left:5px;bottom:2px;z-index:200;font:9px sans-serif;color:#fff1d6;text-shadow:0 1px 2px #342516;pointer-events:none}</style></head><body><div id="root"></div><script type="module" src="/.alcoholfabet-qa.tsx"></script></body></html>');
const browser = await chromium.launch({executablePath:join(homedir(),'.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'),headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'});
const blockedApi=[],external=[],pageErrors=[],assertionErrors=[],captures=[],modules=new Set();
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(/\/(?:auth|rest|realtime|graphql)\/v1/.test(url.pathname)){blockedApi.push(url.pathname);await route.abort();return;}if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol)){external.push({origin:url.origin,path:url.pathname});await route.abort();return;}modules.add(url.pathname);await route.continue();});
const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
let status='FAIL';
try{
for(const scenario of cases)for(const [width,height]of sizes){
 await page.setViewportSize({width,height});await page.goto(`${origin}/.alcoholfabet-qa.html?case=${scenario}`);
 await page.locator('.question-copy h2').waitFor({state:'visible'});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(image=>image.decode()));});
 const geometry=await page.evaluate(()=>{const bounds=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON()??null;const question=document.querySelector('.question-copy h2');const style=getComputedStyle(question);const h2=bounds('.question-copy h2'),space=bounds('.answer-space'),notice=bounds('.drink-notice'),note=bounds('.result-note'),actions=bounds('.question-actions'),button=bounds('.question-actions>.art-button--primary');return{bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,h2,questionCopy:bounds('.question-copy'),answerSpace:space,drinkNotice:notice,resultNote:note,actions,nextButton:button,card:bounds('.question-card-inner'),board:bounds('.game-board'),questionToAnswerGap:space.top-h2.bottom,noticeToResultGap:notice&&note?note.top-notice.bottom:null,resultToButtonGap:note&&button?button.top-note.bottom:null,questionFont:{family:style.fontFamily,size:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),lines:Math.round(h2.height/parseFloat(style.lineHeight))},fontLoaded:document.fonts.check('700 21px Nunito'),controls:Array.from(document.querySelectorAll('button')).filter(element=>element.getBoundingClientRect().width>0).map(element=>({label:element.textContent?.trim()||element.getAttribute('aria-label'),bounds:element.getBoundingClientRect().toJSON(),opacity:getComputedStyle(element).opacity,visibility:getComputedStyle(element).visibility})),storageKeys:Object.keys(localStorage)};});
 const path=join(directory,'screenshots',`alcoholfabet-${scenario}-${width}x${height}.png`);await page.screenshot({path});
 const failures=[];if(geometry.bodyWidth>width||geometry.bodyHeight>height)failures.push('BODY_OVERFLOW');if(geometry.questionToAnswerGap<3.99)failures.push('QUESTION_ANSWER_GAP_BELOW_4');if(geometry.noticeToResultGap!==null&&geometry.noticeToResultGap<3.99)failures.push('DRINK_RESULT_GAP_BELOW_4');if(geometry.resultToButtonGap!==null&&geometry.resultToButtonGap<3.99)failures.push('RESULT_BUTTON_GAP_BELOW_4');if(geometry.questionFont.size<21||!geometry.fontLoaded)failures.push('QUESTION_FONT_TOO_SMALL_OR_NOT_LOADED');
 for(const control of geometry.controls){if(control.bounds.width<47.99||control.bounds.height<47.99)failures.push('CONTROL_BELOW_48:'+control.label);if(control.bounds.left<-.5||control.bounds.top<-.5||control.bounds.right>width+.5||control.bounds.bottom>height+.5||control.visibility!=='visible'||Number(control.opacity)<.99)failures.push('CONTROL_NOT_FULLY_VISIBLE:'+control.label);}
 if(geometry.card.bottom>height+.5)failures.push('CARD_OUTSIDE_VIEWPORT');if(geometry.controls.some(control=>control.bounds.top>=geometry.actions.top&&control.bounds.bottom>geometry.card.bottom-.5))failures.push('ACTION_OUTSIDE_PAPER');if(geometry.storageKeys.length)failures.push('STORAGE_NOT_EMPTY');
 captures.push({scenario,width,height,path:path.slice(root.length+1),geometry,status:failures.length?'FAIL':'PASS',failures});assertionErrors.push(...failures.map(reason=>({scenario,width,height,reason})));
 console.log(JSON.stringify({scenario,size:`${width}x${height}`,status:failures.length?'FAIL':'PASS',questionGap:geometry.questionToAnswerGap,lines:geometry.questionFont.lines,failures}));
}
if(modules.has('/src/App.tsx')||[...modules].some(path=>path.startsWith('/src/hooks/')||path.startsWith('/src/services/')))assertionErrors.push({reason:'FORBIDDEN_APP_MODULE'});
status=assertionErrors.length||blockedApi.length||external.length||pageErrors.length?'FAIL':'PASS';
}catch(error){pageErrors.push(String(error.message));}
finally{await context.close();await browser.close();await unlink(htmlPath);await unlink(jsxPath);const hashes=[];for(const path of ['src/styles/game.css','src/styles/base.css','src/art-system/board.css','src/art-system/drink.css'])hashes.push({path,sha256:createHash('sha256').update(await readFile(join(root,path))).digest('hex')});await writeFile(join(directory,'VISUAL_REPORT.json'),JSON.stringify({status,completedAt:new Date().toISOString(),scope:'Presentational QA of real React components and approved local question JSON; no App boot or database access.',realComponents:['Scene','Board','PlayerBadge','QuestionCard','DrinkNotice','ArtButton'],questions:{threeLines:{id:threeLines.id,text:threeLines.questionCa},longest:{id:longest.id,text:longest.questionCa,length:longest.questionCa.length,method:'Longest active factual-reviewed APPROVED question in data/questions_approved.json; first stable tie.'}},boardFixture:{finishPosition:25,positions:{PAU:2,TECLA:1},target:3,cells:24,notPersisted:true},sizes,cases,captures,assertionErrors,blockedApi,external,pageErrors,authDbRequests:blockedApi.length,anonymousSessionsCreated:0,gamesCreated:0,emptyStorage:true,forbiddenAppModulesRequested:false,temporaryHarnessRemoved:true,styles:hashes,visualInspectionPending:true},null,2)+'\n');console.log(JSON.stringify({status,captures:captures.length,assertionErrors:assertionErrors.length,authDbRequests:blockedApi.length,temporaryHarnessRemoved:true}));if(status!=='PASS')process.exitCode=1;}
