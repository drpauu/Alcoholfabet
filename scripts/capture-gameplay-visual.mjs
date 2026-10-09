import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const baseline = process.argv.includes('--baseline');
const root = process.cwd(), origin = 'http://127.0.0.1:5173';
const directory = join(root, baseline ? 'audit/gameplay-refinement-before' : 'acceptance/gameplay-refinement');
const htmlPath = join(root, '.gameplay-visual-qa.html');
const jsxPath = join(root, '.gameplay-visual-qa.tsx');
const sizes = [[390, 844], [1024, 768], [1440, 900]];
const allScenes = ['home', 'role', 'duration'];
const requestedScenes = process.argv.find(argument => argument.startsWith('--scenes='))?.slice('--scenes='.length).split(',');
if (requestedScenes?.some(scene => !allScenes.includes(scene))) throw new Error('AVATAR_HARNESS_UNKNOWN_SCENE');
const scenes = requestedScenes ?? allScenes;
const partial = false;
const previousReport = partial ? JSON.parse(await readFile(join(directory, 'REPORT.json'), 'utf8')) : null;
if (partial && (previousReport.status !== 'PASS' || previousReport.captures.length !== allScenes.length * sizes.length)) throw new Error('AVATAR_HARNESS_PARTIAL_REQUIRES_COMPLETE_PASS');
const profiles = [[37, 40], [45, 48], [53, 56], [66, 70], [90, 95]];
await mkdir(join(directory, 'screenshots'), { recursive: true });
if (existsSync(htmlPath) || existsSync(jsxPath)) throw new Error('AVATAR_HARNESS_REFUSE_OVERWRITE');
const portraitImport = "import { PlayerPortrait, characterAsset } from '/src/components/PlayerPortrait.tsx';";
const figure = '<img src={characterAsset(player)} alt={player === "PAU" ? ca.pau : ca.tecla} width={1133} height={1388} draggable={false} />';
const winner = '<PlayerPortrait player={player} className="winner-avatar" />';
const source = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { Scene } from '/src/components/Scene.tsx';
import { PlayerBadge } from '/src/components/PlayerBadge.tsx';
${portraitImport}
import { ArtPanel, ArtCard, ArtButtonSecondary, ArtButtonPrimary, ArtButtonQuiet, ArtIconButton } from '/src/components/art/index.ts';
import { ca } from '/src/content/ca.ts';
import '/src/styles/base.css';
import '/src/styles/game.css';
import '/src/motion/motion.css';
import '/src/art-system/icons.css';
import '/src/art-system/effects.css';
const players = ['PAU', 'TECLA'] as const;
function Header() { return <div className="app-header"><span className="brand">{ca.appTitle}</span><div className="header-actions"><ArtIconButton icon="rules" aria-label={ca.showRules} /><ArtIconButton icon="sound_on" aria-label={ca.soundOn} /></div></div>; }
function Score() { return <ArtPanel as="div" className="score-strip"><span>{ca.pau}</span><strong>1<i>—</i>1</strong><span>{ca.tecla}</span></ArtPanel>; }
function Figure({ player }: { player:'PAU'|'TECLA' }) { return ${figure}; }
function Winner({ player }: { player:'PAU'|'TECLA' }) { return ${winner}; }
function Hud() { return <header className="game-hud"><PlayerBadge player="PAU" position={2} finishPosition={7} active /><div className="turn-label turn-label--pau"><span>{ca.turnPau}</span><small>{ca.turnLabel} 4</small></div><PlayerBadge player="TECLA" position={1} finishPosition={7} /></header>; }
function Harness() {
  const scene = new URLSearchParams(location.search).get('scene') ?? 'home';
  const home = scene === 'home', game = ['hud', 'lobby', 'victory-pau', 'victory-tecla'].includes(scene);
  return <Scene variant={home?'home':game?'game':'setup'}><Header />
    {home ? <section className="home-screen"><p className="eyebrow">{ca.homeEyebrow}</p><h1 className="home-logo">{ca.appTitle}</h1><p className="home-tagline">{ca.tagline}</p><div className="home-characters">{players.map(player=><Figure key={player} player={player}/>)}</div><Score/><div className="home-actions"><ArtButtonSecondary player="PAU" icon="person">{ca.playInPerson}</ArtButtonSecondary><ArtButtonSecondary player="TECLA" icon="online">{ca.playOnline}</ArtButtonSecondary></div><ArtButtonQuiet icon="rules" className="text-button">{ca.rules}</ArtButtonQuiet></section>
      : scene==='duration' ? <section className="setup-screen"><ArtPanel><ArtButtonQuiet icon="back" className="text-button back-button">{ca.back}</ArtButtonQuiet><p className="eyebrow">{ca.inPerson}</p><h1>{ca.durationQuestion}</h1><div className="setup-options duration-options">{[20,30,45,60].map(minutes=><ArtButtonSecondary className={minutes===30?'option-button is-selected':'option-button'} aria-pressed={minutes===30} key={minutes}><strong>{minutes}</strong><span>{ca.minutes}</span></ArtButtonSecondary>)}<ArtButtonSecondary className="option-button">{ca.custom}</ArtButtonSecondary></div><p className="setup-hint">{ca.durationHelp}</p><ArtButtonPrimary className="primary-button">{ca.next}</ArtButtonPrimary></ArtPanel></section> : scene==='profiles' ? <section className="qa-matrix-wrap"><ArtPanel className="qa-matrix-panel"><h1>Retalls del mateix mestre</h1><div className="qa-matrix">${profiles.map(([width,height])=>playersSource(width,height)).join('')}</div></ArtPanel></section>
      : scene==='role' ? <section className="setup-screen"><ArtPanel><ArtButtonQuiet icon="back" className="text-button back-button">{ca.back}</ArtButtonQuiet><h1>{ca.chooseRole}</h1><div className="setup-options">{players.map(player=><ArtButtonSecondary player={player} className="option-button" key={player}><PlayerBadge player={player}/><span>{player==='PAU'?ca.iAmPau:ca.iAmTecla}</span></ArtButtonSecondary>)}</div></ArtPanel></section>
      : <div className="game-layout"><Hud/><section className="board-column"/><section className="card-column">
        {scene==='lobby' ? <ArtPanel className="lobby-panel"><p className="eyebrow">{ca.onlineGame}</p><h2>{ca.waitingStart}</h2><p>{ca.inviteHelp}</p><span className="code-label">{ca.gameCode}</span><strong className="invite-code">EXEMPLE</strong><div className="panel-actions"><ArtButtonSecondary icon="copy">{ca.copy}</ArtButtonSecondary><ArtButtonSecondary icon="share">{ca.share}</ArtButtonSecondary></div><div className="lobby-players">{players.map(player=><div key={player}><PlayerBadge player={player}/><span>{player==='PAU'?ca.connectedMale:ca.connectedFemale}</span></div>)}</div><ArtButtonPrimary icon="start">{ca.startGame}</ArtButtonPrimary></ArtPanel>
          : scene.startsWith('victory') ? <div className="victory-wrap"><img className="winner-crown" src="/assets/production/effects/crown.svg" alt=""/><ArtCard className="victory-panel"><Winner player={scene==='victory-pau'?'PAU':'TECLA'}/><h2>{scene==='victory-pau'?ca.pauWon:ca.teclaWon}</h2><p>{ca.finishedHelp}</p><div className="victory-score"><Score/></div><div className="final-actions"><ArtButtonPrimary icon="turn">{ca.playAgain}</ArtButtonPrimary><ArtButtonSecondary icon="home">{ca.goHome}</ArtButtonSecondary></div></ArtCard></div> : null}
      </section></div>}
    <div className="qa-harness-label">QA de components · sense App, Auth ni DB</div>
  </Scene>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
function playersSource(width, height) {
  return `{players.map(player=><div className="qa-size" key={player+'-${width}'} data-size="${width}x${height}" style={{'--qa-avatar-width':'${width}px','--qa-avatar-height':'${height}px'} as React.CSSProperties}><PlayerBadge player={player}/><small>${width} × ${height}</small></div>)}`;
}
const html = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local de components d’avatar</title><style>.qa-harness-label{position:fixed;left:6px;bottom:3px;z-index:200;font:9px sans-serif;color:#ffefd1;text-shadow:0 1px 2px #342316;pointer-events:none}.qa-matrix-wrap{flex:1;display:grid;place-items:center;padding:16px 0}.qa-matrix-panel{width:min(100%,1000px);padding:24px}.qa-matrix-panel h1{font-size:22px}.qa-matrix{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px 14px;margin-top:23px}.qa-size{display:flex;flex-direction:column;align-items:center;gap:8px}.qa-size .player-badge{flex-direction:column;gap:4px}.qa-size .player-avatar{width:var(--qa-avatar-width)!important;height:var(--qa-avatar-height)!important}.qa-size small{font-size:11px;color:#6c573e}@media(max-width:767px){.qa-matrix{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.qa-matrix-panel{padding:19px}.qa-matrix-panel h1{font-size:20px}.qa-size .player-details>strong{font-size:13px}}</style></head><body data-qa-component-harness="true"><div id="root"></div><script type="module" src="/.gameplay-visual-qa.tsx"></script></body></html>`;
await writeFile(htmlPath, html); await writeFile(jsxPath, source);
const browser = await chromium.launch({ executablePath: join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width:390,height:844 }, reducedMotion:'reduce' });
const external = [], api = [], errors = [], captures = partial ? previousReport.captures.filter(capture => !scenes.includes(capture.scene)) : [], moduleRequests = new Set();
let capturesThisRun = 0;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (/(?:\/auth\/v1|\/rest\/v1|\/realtime\/v1|\/graphql\/v1)/.test(url.pathname)) { api.push({ method:route.request().method(), path:url.pathname }); await route.abort(); return; }
  if (url.origin !== origin && !['data:','blob:'].includes(url.protocol)) { external.push({ origin:url.origin,path:url.pathname }); await route.abort(); return; }
  moduleRequests.add(url.pathname); await route.continue();
});
const page = await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
page.on('websocket', socket=>{ if (!socket.url().startsWith('ws://127.0.0.1:5173/')) external.push({ websocket:socket.url().split('?')[0] }); });
let status='FAIL';
try {
  for (const scene of scenes) for (const [width,height] of sizes) {
    await page.setViewportSize({width,height}); await page.goto(`${origin}/.gameplay-visual-qa.html?scene=${scene}`);
    await expect(page.locator('.scene')).toBeVisible();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(image=>image.decode()));});
    const layout=await page.evaluate(()=>({backgroundFilter:getComputedStyle(document.querySelector('.scene-background img')).filter,surfaces:Array.from(document.querySelectorAll('.score-strip,.setup-screen>.art-panel')).map(element=>({classes:element.className,bounds:element.getBoundingClientRect().toJSON(),color:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor})),atmosphere:getComputedStyle(document.querySelector('.scene-atmosphere')).background,textSamples:Array.from(document.querySelectorAll('.brand,.home-logo,.home-tagline,.home-screen>.eyebrow,.home-screen>.art-button--quiet,.setup-hint,.setup-screen .eyebrow,.setup-screen h1,.setup-screen .art-button__label')).map(element=>({selector:element.className,text:element.textContent?.trim(),bounds:element.getBoundingClientRect().toJSON(),color:getComputedStyle(element).color,fontSize:getComputedStyle(element).fontSize,fontWeight:getComputedStyle(element).fontWeight,background:getComputedStyle(element).backgroundColor,textShadow:getComputedStyle(element).textShadow,textStrokeColor:getComputedStyle(element).webkitTextStrokeColor,textStrokeWidth:getComputedStyle(element).webkitTextStrokeWidth})),bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,
      portraits:Array.from(document.querySelectorAll('.player-portrait,.player-avatar,.winner-avatar,.home-characters>img')).filter((element,index,array)=>!array.some(other=>other!==element&&other.contains(element))).map(element=>{const image=element instanceof HTMLImageElement?element:element.querySelector('img');const style=getComputedStyle(element);const clip=element.querySelector('.player-portrait__clip');const clipStyle=clip?getComputedStyle(clip):null;const imageStyle=image?getComputedStyle(image):null;const imageBounds=image?.getBoundingClientRect();const frame=element.getBoundingClientRect();const player=image?.getAttribute('src')?.includes('pau_')?'PAU':'TECLA';const nose=player==='PAU'?{x:.60,y:.365}:{x:.30,y:.33};return{classes:element.className,player,frame:frame.toJSON(),image:imageBounds?.toJSON()??null,src:image?.getAttribute('src')??null,naturalWidth:image?.naturalWidth??null,naturalHeight:image?.naturalHeight??null,overflowX:style.overflowX,overflowY:style.overflowY,borderRadius:style.borderRadius,backgroundColor:style.backgroundColor,clip:clip?{bounds:clip.getBoundingClientRect().toJSON(),overflowX:clipStyle.overflowX,overflowY:clipStyle.overflowY,borderRadius:clipStyle.borderRadius}:null,objectFit:imageStyle?.objectFit??null,transform:imageStyle?.transform??null,computedImageWidth:imageStyle?parseFloat(imageStyle.width):null,computedImageHeight:imageStyle?parseFloat(imageStyle.height):null,estimatedNoseInFrame:imageBounds?{x:(imageBounds.left+nose.x*imageBounds.width-frame.left)/frame.width,y:(imageBounds.top+nose.y*imageBounds.height-frame.top)/frame.height,method:'Approximate landmark from the final master; visual inspection confirms the actual nose'}:null,expectedSize:element.closest('[data-size]')?.getAttribute('data-size')??null};}),
      controls:Array.from(document.querySelectorAll('button')).filter(element=>element.getBoundingClientRect().width>0).map(element=>({label:element.textContent?.trim()||element.getAttribute('aria-label'),...element.getBoundingClientRect().toJSON()})),storageKeys:Object.keys(localStorage),appLoaded:performance.getEntriesByType('resource').some(entry=>entry.name.includes('/src/App.tsx'))}));
    const path=join(directory,'screenshots',`${scene}-${width}x${height}.png`);await page.screenshot({path});const hiddenStyle=await page.addStyleTag({content:'.brand,.home-logo,.home-tagline,.home-screen>.eyebrow,.home-screen>.art-button--quiet,.setup-hint,.setup-screen .eyebrow,.setup-screen h1,.setup-screen .art-button__label,.setup-screen .art-button__label *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0 transparent!important}'});const samplingPath=join(directory,'screenshots',`${scene}-${width}x${height}-sampling.png`);await page.screenshot({path:samplingPath});await hiddenStyle.evaluate(element=>element.remove());if(!baseline&&scene==='home'){const sceneOnly=await page.addStyleTag({content:'.scene-content{visibility:hidden!important}'});await page.screenshot({path:join(directory,'screenshots',`background-after-${width}x${height}.png`)});const replay=await page.addStyleTag({content:'.scene-background img{filter:none!important}'});await page.screenshot({path:join(directory,'screenshots',`background-before-${width}x${height}.png`)});await replay.evaluate(element=>element.remove());await sceneOnly.evaluate(element=>element.remove());}captures.push({scene,width,height,path:path.slice(root.length+1),samplingPath:samplingPath.slice(root.length+1),capturedAt:new Date().toISOString(),layout});capturesThisRun++;
    expect(layout.bodyWidth).toBeLessThanOrEqual(width);expect(layout.bodyHeight).toBeLessThanOrEqual(height);
    expect(layout.storageKeys).toEqual([]);expect(layout.appLoaded).toBe(false);
    for(const portrait of layout.portraits){expect(portrait.naturalWidth).toBeGreaterThan(0);expect(portrait.frame.left).toBeGreaterThanOrEqual(-.5);expect(portrait.frame.right).toBeLessThanOrEqual(width+.5);expect(portrait.frame.top).toBeGreaterThanOrEqual(-.5);expect(portrait.frame.bottom).toBeLessThanOrEqual(height+.5);if(portrait.expectedSize){const [w,h]=portrait.expectedSize.split('x').map(Number);expect(portrait.frame.width).toBeCloseTo(w,1);expect(portrait.frame.height).toBeCloseTo(h,1);}}
    if(!baseline)for(const portrait of layout.portraits){expect(portrait.src).toMatch(/\/(pau|tecla)_character_v2\.webp$/);if(portrait.classes.includes('player-portrait')){expect(portrait.clip).not.toBeNull();expect(portrait.clip.overflowX).toBe('hidden');expect(portrait.clip.overflowY).toBe('hidden');expect(portrait.image.width).toBeGreaterThan(portrait.frame.width);}}
    if(!baseline)for(const portrait of layout.portraits){if(portrait.objectFit==='fill'){const distortion=(portrait.computedImageWidth/portrait.naturalWidth)/(portrait.computedImageHeight/portrait.naturalHeight);expect(Math.abs(distortion-1),'Avatar aspect ratio compression').toBeLessThan(.015);}else expect(['contain','cover','scale-down','none']).toContain(portrait.objectFit);}
    expect(external).toEqual([]);expect(api).toEqual([]);expect(errors).toEqual([]);
    console.log(JSON.stringify({scene,size:`${width}x${height}`,captureThisRun:capturesThisRun,authDbCalls:api.length}));
  }
  expect([...moduleRequests].some(path=>path==='/src/App.tsx'||path.startsWith('/src/hooks/')||path.startsWith('/src/services/'))).toBe(false);
  status='PASS';
} catch(error) {errors.push(String(error instanceof Error?error.message:error).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[REDACTED_TOKEN]'));process.exitCode=1;}
finally {
  await context.close();await browser.close();await unlink(htmlPath);await unlink(jsxPath);
  const assetPaths=[...new Set(captures.flatMap(c=>c.layout.portraits.map(p=>p.src)).filter(Boolean))];const assets=[];for(const path of assetPaths){const bytes=await readFile(join(root,'public',path));assets.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  captures.sort((a,b)=>allScenes.indexOf(a.scene)-allScenes.indexOf(b.scene)||sizes.findIndex(size=>size[0]===a.width)-sizes.findIndex(size=>size[0]===b.width));
  const styles=[];for(const path of ['src/styles/base.css','src/art-system/tokens.css','src/styles/game.css']){const bytes=await readFile(join(root,path));styles.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});}
  const report={status,completedAt:new Date().toISOString(),componentHarness:true,fullAppTest:false,appBooted:false,realComponents:['Scene','ArtPanel','ArtCard','ArtButton','PlayerBadge',...(!baseline?['PlayerPortrait','characterAsset']:[])],baseline,viewports:sizes,profileSizes:profiles,captures,assets,styles,externalRequests:external,authDbRequests:api,anonymousSessionsCreated:0,gamesCreated:0,emptyBrowserStorage:true,forbiddenAppModulesRequested:false,errors,temporaryHarnessRemoved:true,visualInspectionPending:!baseline,recapture:partial?{scenes,capturesThisRun,preservedCaptures:previousReport.captures.length-capturesThisRun,previousCompletedAt:previousReport.completedAt,reason:'Final home-only CSS: wider mobile figures, warm grounding shadow and alpha mask at lower torso; profile crop unchanged'}:null,noSecrets:true};
  await writeFile(join(directory,baseline?'BASELINE_REPORT.json':'VISUAL_REPORT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status,captures:captures.length,capturesThisRun,authDbCalls:api.length,externalCalls:external.length,temporaryHarnessRemoved:true}));
}
