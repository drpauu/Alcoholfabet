import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = process.cwd(), directory = join(root, 'acceptance/alcoholfabet');
const html = join(root, '.drink-motion-qa.html'), jsx = join(root, '.drink-motion-qa.tsx');
if (existsSync(html) || existsSync(jsx)) throw new Error('REFUSE_OVERWRITE_MOTION_HARNESS');
await mkdir(join(directory, 'screenshots'), { recursive: true });
const source = `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QuestionCard} from '/src/components/QuestionCard.tsx';
import {ArtButtonPrimary} from '/src/components/art/index.ts';
import {GameAudioManager} from '/src/motion/audio.ts';
import {GameEventOrchestrator} from '/src/motion/orchestrator.ts';
import {sequenceFor,reduceSequence} from '/src/motion/choreography.ts';
import {runSequence} from '/src/motion/dom-runner.ts';
import '/src/styles/base.css';import '/src/styles/game.css';import '/src/motion/motion.css';
const params=new URLSearchParams(location.search),player=params.get('player')==='TECLA'?'TECLA':'PAU',double=params.has('double');
const audio=new GameAudioManager(),orchestrator=new GameEventOrchestrator();orchestrator.hydrate('drink-qa',1);
const effect={gameId:'drink-qa',stateVersion:2,id:'incorrect-2',type:'INCORRECT_AND_DRINK',drinkCount:double?2:1};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
window.drinkQa={runs:0,cues:[],frames:[],running:false};
function Harness(){const[done,setDone]=useState(false);
async function play(){audio.unlock();window.drinkQa.running=true;
 const sample=()=>{if(!window.drinkQa.running)return;const glass=document.querySelector('[data-motion="drinkGlass"]');const panel=document.querySelector('[data-motion="drinkNotice"]');window.drinkQa.frames.push({at:performance.now(),transform:glass?getComputedStyle(glass).transform:null,panel:panel?getComputedStyle(panel).transform:null,particles:document.querySelectorAll('.drink-bubbles .tp-motion-particle').length,opacity:glass?getComputedStyle(glass).opacity:null});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 const execute=async(confirmed,signal)=>{window.drinkQa.runs++;const sequence=sequenceFor(confirmed);await runSequence(reduced?reduceSequence(sequence):sequence,{audio:{play:async(cue)=>{window.drinkQa.cues.push(cue);}},signal,reduced,effect:confirmed,key:'qa-drink'});};
 await orchestrator.enqueue(effect,execute);await orchestrator.enqueue(effect,execute);await orchestrator.settled();window.drinkQa.running=false;setDone(true);}
return <main className="scene scene--game"><div className="qa-drink-wrap"><QuestionCard category="T&P · Tots dos" pool="TP" question="Qui respon aquesta pregunta?" phase="RESULT" drinkPlayer={player} drinkDouble={double}><ArtButtonPrimary onClick={play} disabled={done}>{done?'Comprovat':'Provar el brindis'}</ArtButtonPrimary></QuestionCard></div></main>}
createRoot(document.getElementById('root')!).render(<Harness/>);`;
await writeFile(jsx, source);
await writeFile(html, '<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>.qa-drink-wrap{width:min(500px,calc(100vw - 34px));margin:100px auto}.qa-drink-wrap .question-card-inner{min-height:430px}</style></head><body><div id="root"></div><script type="module" src="/.drink-motion-qa.tsx"></script></body></html>');
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const cases = [], errors = [], blockedApi = [];
try {
  for (const reduced of [false, true]) for (const [player, double] of [['PAU', false], ['TECLA', true]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (/\/(auth|rest|realtime|graphql)\/v1/.test(url.pathname) || url.origin !== 'http://127.0.0.1:5173') { blockedApi.push(url.pathname); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5173/.drink-motion-qa.html?player=${player}${double ? '&double' : ''}`);
    await page.getByRole('button', { name: 'Provar el brindis', exact: true }).click();
    if (!reduced) { await page.waitForTimeout(430); await page.screenshot({ path: join(directory, 'screenshots', `drink-in-motion-${player.toLowerCase()}.png`) }); }
    await page.getByRole('button', { name: 'Comprovat', exact: true }).waitFor();
    const data = await page.evaluate(() => ({ ...window.drinkQa, finalGlassTransform: getComputedStyle(document.querySelector('[data-motion="drinkGlass"]')).transform, residualParticles: document.querySelectorAll('.tp-motion-particle').length }));
    const transforms = new Set(data.frames.map(frame => frame.transform));
    const maximumParticles = Math.max(0, ...data.frames.map(frame => frame.particles));
    const pass = data.runs === 1 && data.cues.join(',') === `INCORRECT,${double ? 'DOUBLE_DRINK' : 'DRINK'}` && data.residualParticles === 0 && (reduced ? transforms.size === 1 && maximumParticles === 0 : transforms.size > 8 && maximumParticles === 6);
    cases.push({ player, double, reduced, status: pass ? 'PASS' : 'FAIL', runs: data.runs, cues: data.cues, frames: data.frames.length, distinctGlassTransforms: transforms.size, maximumParticles, residualParticles: data.residualParticles, finalGlassTransform: data.finalGlassTransform });
    await context.close();
  }
} finally {
  await browser.close(); await unlink(html); await unlink(jsx);
  const report = { status: cases.length === 4 && cases.every(item => item.status === 'PASS') && !errors.length && !blockedApi.length ? 'PASS' : 'FAIL', completedAt: new Date().toISOString(), scope: 'Production choreography, runner and orchestrator in a presentational harness. Audio cues recorded; no live Auth/DB.', cases, errors, blockedApi, anonymousSessionsCreated: 0, gamesCreated: 0, temporaryHarnessRemoved: true };
  await writeFile(join(directory, 'DRINK_MOTION_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report)); if (report.status !== 'PASS') process.exitCode = 1;
}
