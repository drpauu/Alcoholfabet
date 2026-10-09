import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const directory='acceptance/online-identity', origin='http://127.0.0.1:5173';
await mkdir(directory+'/screenshots',{recursive:true});
const env=Object.fromEntries((await readFile('.env.local','utf8')).split('\n').filter(line=>line.includes('=')&&!line.trim().startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
const codes=JSON.parse(await readFile(join(homedir(),'.config/tecla-pau/online-player-codes.json'),'utf8'));
const redact=value=>Object.values(codes).reduce((text,code)=>text.split(code).join('[REDACTED_CODE]'),String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_TOKEN]');
const manifestPath=directory+'/QA_MANIFEST.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8').catch(()=>'{"userIds":[],"gameIds":[]}'));
let journal=Promise.resolve();
const record=(userId,gameId)=>{if(userId&&!manifest.userIds.includes(userId))manifest.userIds.push(userId);if(gameId&&!manifest.gameIds.includes(gameId))manifest.gameIds.push(gameId);journal=journal.then(()=>writeFile(manifestPath,JSON.stringify(manifest,null,2)));};
const browser=await chromium.launch({executablePath:join(homedir(),'.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'),headless:true,args:['--no-sandbox']});
const contexts=[],cases=[],errors=[],captures=[];
function check(condition,label){if(!condition)throw new Error(label);}
async function makeContext(){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});contexts.push(context);context.on('page',page=>{page.on('pageerror',error=>errors.push(redact(error.message)));page.on('response',async response=>{const path=new URL(response.url()).pathname;if(path==='/auth/v1/signup'){const body=await response.json().catch(()=>({}));record(body.user?.id);}if(path==='/rest/v1/rpc/create_game'){const body=await response.json().catch(()=>({}));record(body.viewer?.userId,body.game?.id);}});});return context;}
async function boot(page){await page.goto(origin);await page.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor({timeout:25000});}
async function rpc(page,name,body){return page.evaluate(async({url,key,name,body})=>{const storageKey='sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';const session=JSON.parse(localStorage.getItem(storageKey)||'{}');const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};},{url:env.VITE_SUPABASE_URL,key:env.VITE_SUPABASE_PUBLISHABLE_KEY,name,body});}
async function current(page){const id=await page.locator('[data-game-id]').getAttribute('data-game-id');return (await rpc(page,'get_game_view',{p_game_id:id})).body;}
async function waitReady(page){await page.waitForFunction(()=>{const buttons=Array.from(document.querySelectorAll('button'));return !buttons.some(button=>button.classList.contains('primary-button')&&button.disabled)&&!document.querySelector('[data-drink-presentation]');});}
async function capture(page,name){for(const [width,height]of[[390,844],[1024,768],[1440,900]]){await page.setViewportSize({width,height});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(image=>image.decode()));});const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,passwordFields:Array.from(document.querySelectorAll('input[type=password]')).map(input=>({empty:input.value.length===0,bounds:input.getBoundingClientRect().toJSON()}))}));check(geometry.bodyWidth<=width&&geometry.bodyHeight<=height,'SCREEN_OVERFLOW_'+name);const path=directory+'/screenshots/'+name+'-'+width+'x'+height+'.png';await page.screenshot({path});captures.push({name,width,height,path,geometry});}await page.setViewportSize({width:390,height:844});}
let status='FAIL';
try{
 const pau=await (await makeContext()).newPage(),tecla=await (await makeContext()).newPage();
 await boot(pau);await boot(tecla);
 const before=(await rpc(pau,'get_access_context',{})).body.scoreboard;
 const bypass=await rpc(pau,'create_game',{p_mode:'ONLINE',p_target_minutes:20,p_starting_player:'PAU',p_creator_role:'PAU',p_idempotency_key:crypto.randomUUID()});
 check(bypass.status===403&&bypass.body.message==='ONLINE_IDENTITY_REQUIRED','UNIDENTIFIED_ONLINE_CREATE_ALLOWED');cases.push({name:'server rejects online creation without identity',status:'PASS'});
 await pau.getByRole('button',{name:'Jugar en línia',exact:true}).click();await pau.getByRole('heading',{name:'El teu codi privat',exact:true}).waitFor();await capture(pau,'online-code-empty');
 await pau.getByLabel('Codi privat',{exact:true}).fill('invalid-qa-code');await pau.getByRole('button',{name:'Entrar',exact:true}).click();await pau.getByText('El codi no és correcte.',{exact:true}).waitFor();
 await pau.getByLabel('Codi privat',{exact:true}).fill(codes.PAU);await pau.getByRole('button',{name:'Entrar',exact:true}).click();await pau.getByRole('heading',{name:'Preparem la trobada',exact:true}).waitFor();
 check((await rpc(pau,'get_access_context',{})).body.onlineRole==='PAU','PAU_IDENTITY_NOT_PERSISTED');check(await pau.getByText('Jugues com a en Pau.',{exact:true}).count()===1,'PAU_NAME_NOT_SHOWN');await capture(pau,'identified-pau');
 await pau.reload();await pau.getByRole('button',{name:'Jugar en línia',exact:true}).click();await pau.getByRole('heading',{name:'Preparem la trobada',exact:true}).waitFor();check(await pau.locator('input[type=password]').count()===0,'IDENTITY_NOT_RESTORED');
 const forged=await rpc(pau,'create_game',{p_mode:'ONLINE',p_target_minutes:20,p_starting_player:'PAU',p_creator_role:'TECLA',p_idempotency_key:crypto.randomUUID()});check(forged.status===403&&forged.body.message==='ONLINE_ROLE_MISMATCH','CLIENT_CAN_FORGE_OTHER_ROLE');
 cases.push({name:'invalid code, verified Pau role, reload and forged role rejection',status:'PASS'});
 await pau.getByRole('button',{name:'Crear una partida',exact:true}).click();await pau.getByRole('button',{name:'20 minuts',exact:true}).click();await pau.getByRole('button',{name:'Continuar',exact:true}).click();await pau.getByRole('button',{name:'Pau en Pau',exact:true}).click();await pau.locator('[data-game-id]').waitFor();
 const lobby=await current(pau);record(lobby.viewer.userId,lobby.game.id);check(lobby.viewer.role==='PAU','CREATOR_ROLE_WRONG');
 const noJoin=await rpc(tecla,'join_game_by_code',{p_invite_code:lobby.game.inviteCode,p_role:'TECLA',p_idempotency_key:crypto.randomUUID()});check(noJoin.status===403&&noJoin.body.message==='ONLINE_IDENTITY_REQUIRED','UNIDENTIFIED_JOIN_ALLOWED');
 await tecla.goto(origin+'/?partida='+lobby.game.inviteCode);await tecla.getByRole('heading',{name:'El teu codi privat',exact:true}).waitFor();await tecla.getByLabel('Codi privat',{exact:true}).fill(codes.TECLA);await tecla.getByRole('button',{name:'Entrar',exact:true}).click();await tecla.getByRole('heading',{name:'Unir-se a una partida',exact:true}).waitFor();await tecla.getByRole('button',{name:'Unir-se a una partida',exact:true}).click();await tecla.locator('[data-game-id]').waitFor();
 check((await current(tecla)).viewer.role==='TECLA','JOINER_ROLE_WRONG');
 await pau.getByRole('button',{name:'Començar la partida',exact:true}).waitFor();await pau.getByRole('button',{name:'Començar la partida',exact:true}).click();
 await pau.waitForFunction(()=>['QUESTION','TP_OPEN','TP_CLAIMED'].includes(document.querySelector('[data-phase]')?.getAttribute('data-phase')));
 let view=await current(pau);if(view.game.phase==='TP_OPEN'){await pau.getByRole('button',{name:'Jo responc!',exact:true}).click();await pau.waitForFunction(()=>document.querySelector('[data-phase]')?.getAttribute('data-phase')==='TP_CLAIMED');view=await current(pau);}
 await tecla.getByRole('button',{name:'Incorrecte',exact:true}).waitFor();const respondent=await current(pau),judge=await current(tecla);check(!Object.hasOwn(respondent.question,'answerCa')&&judge.question?.answerCa,'ANSWER_PRIVACY_FAILED');
 const switchRole=await rpc(pau,'identify_online_player',{p_code:codes.TECLA});check(switchRole.body.identified===false&&switchRole.body.error==='ONLINE_IDENTITY_IN_USE','ACTIVE_IDENTITY_CAN_SWITCH');
 await tecla.getByRole('button',{name:'Incorrecte',exact:true}).click();await pau.locator('.drink-notice').waitFor();check((await current(pau)).lastEvent.payload.respondingPlayer==='PAU','WRONG_DRINK_RECIPIENT');
 await pau.getByRole('button',{name:'Següent torn',exact:true}).waitFor();await waitReady(pau);await waitReady(tecla);
 const snapshot=await current(pau);await pau.reload();await pau.locator('[data-game-id]').waitFor();const restored=await current(pau);check(restored.game.id===snapshot.game.id&&restored.game.stateVersion===snapshot.game.stateVersion&&restored.viewer.role==='PAU','ONLINE_RELOAD_FAILED');
 await capture(pau,'online-restored');
 await pau.getByRole('button',{name:'Sortir',exact:true}).click();await pau.getByRole('button',{name:'Abandonar la partida',exact:true}).click();await pau.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor();await tecla.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor();check(JSON.stringify((await rpc(pau,'get_access_context',{})).body.scoreboard)===JSON.stringify(before),'ABANDONMENT_CHANGED_SCORE');
 cases.push({name:'two real devices, verified roles, private Realtime, answer privacy, result, reload and abandon',status:'PASS'});
 const local=await (await makeContext()).newPage();await boot(local);await local.getByRole('button',{name:'Jugar en persona',exact:true}).click();await local.getByRole('heading',{name:'Quant de temps voleu que duri la partida?',exact:true}).waitFor();check(await local.locator('input[type=password]').count()===0,'IN_PERSON_REQUIRES_PRIVATE_CODE');
 await local.getByRole('button',{name:'20 minuts',exact:true}).click();await local.getByRole('button',{name:'Continuar',exact:true}).click();await local.getByRole('button',{name:'Pau en Pau',exact:true}).click();await local.locator('[data-game-id]').waitFor();record((await current(local)).viewer.userId,(await current(local)).game.id);check((await current(local)).viewer.role==='IN_PERSON_CONTROLLER','IN_PERSON_ROLE_CHANGED');
 await local.getByRole('button',{name:'Sortir',exact:true}).click();await local.getByRole('button',{name:'Abandonar la partida',exact:true}).click();await local.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor();cases.push({name:'fresh in-person game needs no private code',status:'PASS'});
 // One rejected cached token, then recover with a fresh anonymous session.
 const recovery=await makeContext();let verificationAttempts=0;
 await recovery.route('**/auth/v1/user',route=>{verificationAttempts++;if(verificationAttempts===1)return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'bad_jwt',message:'Invalid JWT'})});return route.continue();});
 const recovering=await recovery.newPage();await boot(recovering);await recovering.reload();await recovering.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor();check(verificationAttempts>=1,'RECOVERY_NOT_EXERCISED');cases.push({name:'cached invalid session recovers to the playable menu',status:'PASS'});
 status=cases.length===5&&!errors.length?'PASS':'FAIL';
}catch(error){errors.push(redact(error.stack??error));}finally{
 for(const context of contexts)await context.close();await journal;await browser.close();
 const report={status,completedAt:new Date().toISOString(),scope:'Real production App, Anonymous Auth, server-verified identities, authoritative RPCs and private Realtime in separate Chromium contexts.',cases,captures,errors,qaUserIds:manifest.userIds,qaGameIds:manifest.gameIds,traceAndVideoDisabled:true,noSecretsInArtifacts:true,cleanupPending:true};
 await writeFile(directory+'/E2E_REPORT.json',redact(JSON.stringify(report,null,2))+'\n');console.log(redact(JSON.stringify({status,cases:cases.length,errors,users:manifest.userIds.length,games:manifest.gameIds.length})));if(status!=='PASS')process.exitCode=1;
}
