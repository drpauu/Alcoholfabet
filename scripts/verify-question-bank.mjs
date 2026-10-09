import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const dir='acceptance/question-bank',origin='http://127.0.0.1:5173';await mkdir(dir+'/screenshots',{recursive:true});
const env=Object.fromEntries((await readFile('.env.local','utf8')).split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}));
const codes=JSON.parse(await readFile(join(homedir(),'.config/tecla-pau/online-player-codes.json'),'utf8'));
const manifestPath=dir+'/QA_MANIFEST.json';const manifest=JSON.parse(await readFile(manifestPath,'utf8').catch(()=>'{"userIds":[],"gameIds":[]}'));
let journal=Promise.resolve();const record=(userId,gameId)=>{if(userId&&!manifest.userIds.includes(userId))manifest.userIds.push(userId);if(gameId&&!manifest.gameIds.includes(gameId))manifest.gameIds.push(gameId);journal=journal.then(()=>writeFile(manifestPath,JSON.stringify(manifest,null,2)));};
const browser=await chromium.launch({executablePath:join(homedir(),'.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'),headless:true,args:['--no-sandbox']});
const pages=[],contexts=[],errors=[],checks=[],pools={},captures=[],requests=[];let status='FAIL';
const check=(condition,name)=>{if(!condition)throw Error(name);};
async function makePage(){const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});contexts.push(c);const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(new URL(r.url()).pathname));p.on('response',async r=>{const path=new URL(r.url()).pathname;if(path==='/auth/v1/signup'){const b=await r.json().catch(()=>({}));record(b.user?.id);}if(path==='/rest/v1/rpc/create_game'){const b=await r.json().catch(()=>({}));record(b.viewer?.userId,b.game?.id);}if(path.startsWith('/rest/v1/rpc/')){const v=await r.json().catch(()=>({}));if(v.question&&((v.viewer?.role===v.game?.respondingPlayer)||v.game?.phase==='TP_OPEN')&&Object.hasOwn(v.question,'answerCa'))errors.push('RESPONDENT_NETWORK_ANSWER_LEAK');}});await p.goto(origin);await p.getByRole('button',{name:'Jugar en persona',exact:true}).waitFor({timeout:30000});return p;}
async function rpc(p,name,body){return p.evaluate(async({env,name,body})=>{const s=JSON.parse(localStorage.getItem('sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'));const r=await fetch(env.VITE_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},{env,name,body});}
async function view(p,id){return (await rpc(p,'get_game_view',{p_game_id:id})).body;}
async function act(p,v,name,payload={}){const r=await rpc(p,'apply_game_action',{p_game_id:v.game.id,p_action:name,p_expected_state_version:v.game.stateVersion,p_idempotency_key:crypto.randomUUID(),p_payload:payload});check(r.status===200,'ACTION_FAILED_'+name);return r.body;}
async function sync(p,id,version){await p.waitForFunction(({id,version})=>document.querySelector('[data-game-id]')?.getAttribute('data-game-id')===id&&Number(document.querySelector('[data-state-version]')?.getAttribute('data-state-version'))>=version,{id,version},{timeout:15000});await p.waitForFunction(()=>document.querySelector('[aria-busy="true"]')===null&&document.querySelector('[data-drink-presentation]')===null);}
try{
 const pau=await makePage(),tecla=await makePage();
 for(const [p,role]of[[pau,'PAU'],[tecla,'TECLA']]){const r=await rpc(p,'identify_online_player',{p_code:codes[role]});check(r.body.identified&&r.body.role===role,'IDENTITY_FAILED');}
 let r=await rpc(pau,'create_game',{p_mode:'ONLINE',p_target_minutes:20,p_starting_player:'PAU',p_creator_role:'PAU',p_idempotency_key:crypto.randomUUID()});check(r.status===200,'CREATE_FAILED');let v=r.body;record(v.viewer.userId,v.game.id);const id=v.game.id;
 r=await rpc(tecla,'join_game_by_code',{p_invite_code:v.game.inviteCode,p_role:'TECLA',p_idempotency_key:crypto.randomUUID()});check(r.status===200,'JOIN_FAILED');v=r.body;
 r=await rpc(pau,'start_game',{p_game_id:id,p_expected_state_version:v.game.stateVersion,p_idempotency_key:crypto.randomUUID()});check(r.status===200,'START_FAILED');v=r.body;
 // Restore the real App from its persisted membership, then use authoritative
 // intents with separate real user sessions, private Realtime, and actual DOM.
 await pau.reload();await tecla.reload();await sync(pau,id,v.game.stateVersion);await sync(tecla,id,v.game.stateVersion);
 const ids=new Set();
 for(let turn=0;turn<12&&Object.keys(pools).length<5;turn++){
  v=await view(pau,id);const active=v.game.currentTurn==='PAU'?pau:tecla;v=await act(active,v,'BEGIN_TURN');
  if(v.game.phase==='TP_OPEN'){
   const [a,b]=await Promise.all([view(pau,id),view(tecla,id)]);check(!Object.hasOwn(a.question,'answerCa')&&!Object.hasOwn(b.question,'answerCa'),'OPEN_TP_LEAK');
   const before=v.game.stateVersion;const [first,second]=await Promise.all([rpc(pau,'apply_game_action',{p_game_id:id,p_action:'CLAIM_TP',p_expected_state_version:before,p_idempotency_key:crypto.randomUUID(),p_payload:{claimant:'PAU'}}),rpc(tecla,'apply_game_action',{p_game_id:id,p_action:'CLAIM_TP',p_expected_state_version:before,p_idempotency_key:crypto.randomUUID(),p_payload:{claimant:'TECLA'}})]);
   check([first,second].filter(r=>r.status===200).length===1,'TP_DOUBLE_CLAIM');v=await view(pau,id);check(v.game.stateVersion===before+1,'TP_DOUBLE_VERSION');checks.push('T&P concurrent: one claimant and one state change');
  }
  const respondent=v.game.respondingPlayer==='PAU'?pau:tecla,judge=respondent===pau?tecla:pau;
  const secure=await view(respondent,id),judging=await view(judge,id);const q=secure.question;check(q&&!Object.hasOwn(q,'answerCa')&&judging.question?.answerCa,'ROLE_PRIVACY');check(!ids.has(q.id),'REPEATED_QUESTION_ID');ids.add(q.id);
  check(/^(PAU|TECLA|TECLA_PAU|PAU_TECLA|TP)-\d{4}$/.test(q.id),'LEGACY_BANK_SELECTED');
  await sync(respondent,id,v.game.stateVersion);await sync(judge,id,v.game.stateVersion);
  check(await respondent.locator('.answer-panel').count()===0&&await judge.locator('.answer-panel').count()===1,'DOM_PRIVACY');
  check(!Object.hasOwn(secure.question,'accepted_answers')&&!Object.hasOwn(secure.question,'fact_id')&&!Object.hasOwn(secure.question,'semantic_key'),'QUESTION_METADATA_LEAK');
  pools[q.pool]={questionId:q.id,respondingPlayer:v.game.respondingPlayer,judge:judging.viewer.role,respondentJson:'PASS',respondentDom:'PASS',judgeAnswer:'PASS'};
  if(turn===1){const before=structuredClone(secure.game);await respondent.reload();await sync(respondent,id,before.stateVersion);const restored=await view(respondent,id);check(restored.question.id===q.id&&restored.game.stateVersion===before.stateVersion,'RELOAD_CONSUMED_QUESTION');checks.push('question refresh and App reload preserve ID and state version');}
  if(Object.keys(pools).length===5){
   for(const [width,height]of[[390,844],[1024,768],[1440,900]]){await respondent.setViewportSize({width,height});await respondent.evaluate(()=>document.fonts.ready);const geometry=await respondent.evaluate(()=>({bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,question:document.querySelector('.question-copy')?.getBoundingClientRect().toJSON()}));check(geometry.bodyWidth<=width&&geometry.bodyHeight<=height,'LAYOUT_OVERFLOW');const path=dir+'/screenshots/respondent-'+width+'x'+height+'.png';await respondent.screenshot({path});captures.push({width,height,path,geometry});}
  }
  v=await act(judge,v,'JUDGE_CORRECT');if(v.game.status!=='FINISHED')v=await act(pau,v,'NEXT_TURN');
 }
 check(Object.keys(pools).length===5,'MISSING_POOL');
 for(const p of[ pau,tecla ]){
  for(const table of['questions','game_question_usage']){const code=await p.evaluate(async({env,table})=>{const s=JSON.parse(localStorage.getItem('sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'));return (await fetch(env.VITE_SUPABASE_URL+'/rest/v1/'+table+'?limit=1',{headers:{apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+s.access_token}})).status;},{env,table});check(code===403,'CLIENT_BANK_OR_HISTORY_READ_ALLOWED');}
  const denied=await rpc(p,'admin_finalize_question_bank',{p_version:'canonical-5000-20261009-v1',p_checksum:'0'.repeat(64)});check(denied.status>=400,'CLIENT_IMPORT_ALLOWED');
 }
 check(!requests.some(path=>/questions_5000|reviewed_5000|questions_pack/.test(path)),'BANK_PREFETCH');
 for(const path of['/tecla_pau_5000_questions_pack.zip','/data/question-bank/questions_5000.jsonl','/data/question-bank/reviewed_5000.jsonl','/question_review_issues.csv'])check(!(await pau.request.get(origin+path)).ok(),'RAW_BANK_PUBLIC:'+path);
 checks.push('both users denied raw questions, descriptive history and admin import; no bank prefetch');
 if(v.game.status==='ACTIVE')await act(pau,v,'ABANDON_GAME');status=errors.length?'FAIL':'PASS';
}catch(e){errors.push(String(e.stack??e));}finally{
 for(const c of contexts)await c.close();await journal;await browser.close();
 const report={status,completedAt:new Date().toISOString(),checks,pools,captures,errors,scope:'Real canonical bank, two anonymous users, verified roles, safe RPCs, private Realtime and real App DOM; no mocks',qaUserIds:manifest.userIds,qaGameIds:manifest.gameIds,traceAndVideoDisabled:true};await writeFile(dir+'/BANK_BROWSER_REPORT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status,pools:Object.keys(pools),checks,errors}));if(status!=='PASS')process.exitCode=1;
}
