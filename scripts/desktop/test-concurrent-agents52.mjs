import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('verify five concurrent packaged agent chats, scoped controls and reopening');
const root=path.resolve(import.meta.dirname,'../..'),json=async file=>JSON.parse(await readFile(file,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-composio-candidate52/current.json')),proof=await json(pointer.proof);
const restored=await json(path.join(proof.out,'capability10-restore-accepted.json')),cfg=await json(restored.retainedIntent),prior=await json(cfg.sourceApplicationEvidence);
const account=await json(path.join(path.dirname(cfg.sourceEvidence),'private-generated-account.json'));
const redact=value=>String(value).replaceAll(account.password,'[REDACTED GENERATED TEST PASSWORD]');
const out=path.join(proof.out,'concurrent-agents-'+Date.now()),marker=randomUUID().slice(0,8),ids=Array.from({length:5},()=>randomUUID());
const evidence={success:false,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,marker,out,requestIds:ids,checks:[],machine:{platform:os.platform(),release:os.release(),architecture:os.arch(),cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,totalMemoryBytes:os.totalmem(),freeMemoryBefore:os.freemem()},declaredWorkload:{independentChats:5,cancelled:1,steered:1,queuedFollowUps:1,normalCompletion:1,normalCloseDuringWork:1},thresholds:{allNativeTurnsStartedMs:90000,navigationMs:5000,controlMs:10000,completionMs:60000},liveProviderRequests:0,productionProfileChanged:false,installed:false};
assert(proof.success&&restored.success);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert.equal(await hash(cfg.configFile),cfg.testConfigSha256);
const started=path.join(proof.out,'concurrent-agents-started.json');
try{
 await lstat(started);assert(process.argv.includes('--retry-fixture'),'Inspect the existing attempt before another run');
 const previous=await json(started),failed=await json(previous.evidence);assert(!failed.success&&[1,3].includes(failed.checks.length)&&failed.error.includes('Owned startup probe failed'));
 const draftNavigation=failed.cause.includes('UNSENT-CONCURRENT-DRAFT-')&&failed.cause.includes('Received: undefined'),unloadedSidebar=failed.cause.includes('locator.click: Timeout 30000ms exceeded.')&&failed.cause.includes('CONCURRENT-ASSIGNMENT-');
 const steeredStream=failed.checks.length===3&&failed.cause.includes('This controlled stream is already closed'),queuePollRace=failed.checks.length===3&&failed.cause.includes("Cannot read properties of undefined (reading 'status')")&&failed.cause.includes('Promise.all (index 3)');assert(draftNavigation||unloadedSidebar||steeredStream||queuePollRace);
 evidence.priorAttempt={evidence:previous.evidence,requestIds:previous.requestIds,pointerSha256:await hash(started),marker:failed.marker,queuedRequest:failed.queuedRequest,completedAllowed:queuePollRace?failed.requestIds.slice(1,4):steeredStream?[failed.requestIds[1]]:[],reason:queuePollRace?'The verifier polled the queued request before asynchronous dispatch created its database row.':steeredStream?'Steering correctly aborted the original response stream; the verifier tried to release that already-closed stream.':draftNavigation?'The verifier used full-page navigation, bypassing the application sidebar and its draft flush.':'The broker-created fixture chats had not been loaded into the existing renderer history. The verifier must load that arranged state before measuring sidebar navigation.'};
}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(out);await writeFile(started,JSON.stringify({out,evidence:path.join(out,'evidence.json'),requestIds:ids,priorAttempt:evidence.priorAttempt}),{flag:evidence.priorAttempt?'w':'wx'});
const save=()=>writeFile(path.join(out,'evidence.json'),redact(JSON.stringify(evidence,null,2))),check=async text=>{evidence.checks.push(text);await save();console.log('PASS '+text);};await save();
const options={thinking:'default',permission:'full',mode:'chat',provider:'openai-oauth',model:'gpt-6.1-sol',files:[],tools:[]};
function helpers(application,page){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const read=async(table,columns,filters)=>application.evaluate(async(_,{table,columns,filters})=>{let q=globalThis.__coordination.broker.admin.from(table).select(columns);for(const [key,value] of Object.entries(filters))q=q.eq(key,value);const r=await q;if(r.error)throw Error(r.error.message);return r.data;},{table,columns,filters});
 const status=async id=>(await read('desktop_requests','status,error',{id}))[0];
 const finished=async id=>expect.poll(async()=>{const row=await status(id);if(!row)return 'awaiting request creation';if(['failed','cancelled','interrupted'].includes(row.status))throw Error(row.error??row.status);return row.status;},{timeout:60000,intervals:[100,250,500]}).toBe('completed');
 const opened=async conversation=>{const start=performance.now(),row=(await call('conversations.list')).find(row=>row.conversation_id===conversation);assert(row?.title);await page.locator('.history-open').and(page.getByTitle(row.title,{exact:true})).click();await expect(page).toHaveURL('agentopia://app/conversations/'+conversation,{timeout:5000});await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled({timeout:5000});return performance.now()-start;};
 return {call,read,status,finished,opened};
}
try{
 const first=await launchDurableProfileProbe(cfg,{label:'concurrent-first-'+Date.now(),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,runReady:async({application,page})=>{
  const {call,read,status,finished,opened}=helpers(application,page);assert.equal((await call('auth.state')).identity.id,prior.owner);
  if(evidence.priorAttempt){evidence.priorAttempt.savedStatuses=[];for(const id of evidence.priorAttempt.requestIds){const row=await status(id);assert(['cancelled','interrupted'].includes(row.status)||(evidence.priorAttempt.completedAllowed.includes(id)&&row.status==='completed'),'Prior request is still active or uncertain');assert.equal((await read('desktop_tool_calls','id',{request_id:id})).length,0);evidence.priorAttempt.savedStatuses.push({id,status:row.status});}
   if(evidence.priorAttempt.queuedRequest){const rows=await call('chat.queue.list'),queued=rows.find(row=>row.id===evidence.priorAttempt.queuedRequest);if(queued){assert.equal(queued.status,'held','An unfinished prior queue must remain held');assert.equal(queued.text,'QUEUED-FOLLOW-UP-'+evidence.priorAttempt.marker);evidence.priorAttempt.heldQueue={id:queued.id,status:queued.status};await call('chat.queue.change',{id:queued.id,action:'remove'});}else{const saved=await status(evidence.priorAttempt.queuedRequest);assert(saved&&['completed','cancelled','interrupted'].includes(saved.status));evidence.priorAttempt.savedQueuedRequest={id:evidence.priorAttempt.queuedRequest,status:saved.status};}}
   assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0,'Prior saved work must not restart automatically');await save();}
  await application.evaluate(async(_,owner)=>{const b=globalThis.__coordination.broker,credential=b.secrets.get('openai:'+owner);if(credential?.access_token!=='CONTROLLED-NOT-A-PROVIDER-CREDENTIAL')throw Error('This acceptance profile does not have its expected controlled connection');await b.secrets.set('openai:'+owner,{...credential,expires_at:Date.now()+3600000});},prior.owner);
  const agents=[];for(let i=0;i<5;i++){
   const id=await call('agents.save',{name:'Concurrent specialist '+marker+' '+i,description:'Disposable concurrent application acceptance',instructions:'Respond only for this isolated verification assignment.',provider:'openai-oauth',model:'gpt-6.1-sol'}),profile=await call('agents.profile',{agentId:id});
   await call('agents.profile.save',{agentId:id,value:{...profile,handle:'parallel-'+marker+'-'+i,role:'CONCURRENT-ROLE-'+marker+'-'+i,sops:'CONCURRENT-SOP-'+marker+'-'+i,policy:{...profile.policy,tools:[],delegation:false,memory:false,memoryWrite:false,maxDepth:0}}});agents.push(id);
  }evidence.agents=agents;await save();
  await application.evaluate((_,{ids,marker})=>{const s=globalThis.__coordination;for(let i=0;i<ids.length;i++)s.requests[ids[i]]={steps:[{text:'INITIAL-RESULT-'+marker+'-'+i,hold:'parallel-'+marker+'-'+i},...(i===1?[{text:'STEERED-RESULT-'+marker,requireInput:'STEERING-'+marker}]:[])]};}, {ids,marker});
  const starting=performance.now(),chats=await Promise.all(ids.map((requestId,i)=>call('chat.start',{requestId,agentId:agents[i],text:'CONCURRENT-ASSIGNMENT-'+marker+'-'+i,options})));
  evidence.conversations=chats.map(chat=>chat.conversation_id);await save();
  await expect.poll(()=>application.evaluate((_,keys)=>keys.every(key=>globalThis.__coordination.streams.has(key)),ids.map((_,i)=>'parallel-'+marker+'-'+i)),{timeout:90000,intervals:[100,250,500]}).toBe(true);
  evidence.allStartedMs=performance.now()-starting;
  const active=await call('native.active');evidence.active=active.filter(row=>ids.includes(row.requestId));assert.equal(evidence.active.length,5);assert.equal(new Set(evidence.active.map(row=>row.threadId)).size,5);assert(evidence.active.every(row=>row.turnId));assert(evidence.allStartedMs<90000);await check('Five owned specialist chats reach five distinct actual Codex threads concurrently through the packaged app and PostgreSQL.');
  // Fixture chats were arranged through the broker. Load them before the measured
  // UI workflow; subsequent navigation uses the same sidebar as an ordinary user.
  await page.goto('agentopia://app/conversations/'+evidence.conversations[0]);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeEnabled({timeout:30000});
  const navigation=[];for(const conversation of evidence.conversations)navigation.push(await opened(conversation));evidence.navigationMs=navigation;assert(navigation.every(ms=>ms<5000));
  await opened(evidence.conversations[3]);const draft='UNSENT-CONCURRENT-DRAFT-'+marker;await page.getByRole('textbox',{name:'Message',exact:true}).fill(draft);await opened(evidence.conversations[2]);await expect.poll(async()=>(await call('drafts.get',{owner:prior.owner,scope:'conversation:'+evidence.conversations[3]}))?.text,{timeout:10000}).toBe(draft);evidence.unsentDraft=draft;
  await page.screenshot({path:path.join(out,'five-working-agents.png')});await check('Navigation remains within the declared five-second limit and the inactive chat retains its own unsent draft while all five chats work.');
  let before=performance.now();await call('chat.cancel',{requestId:ids[0]});await expect.poll(async()=>(await status(ids[0])).status,{timeout:10000}).toBe('cancelled');evidence.cancelMs=performance.now()-before;
  const remaining=await call('native.active');assert(ids.slice(1).every(id=>remaining.some(row=>row.requestId===id)));assert(evidence.cancelMs<10000);await check('Stopping one request cancels that request while the four independently owned turns remain active.');
  const steerId=randomUUID(),turn=evidence.active.find(row=>row.requestId===ids[1]);evidence.steeringId=steerId;await save();before=performance.now();await call('native.steer',{id:steerId,requestId:ids[1],turnId:turn.turnId,text:'STEERING-'+marker,options});evidence.steerMs=performance.now()-before;assert(evidence.steerMs<10000);
  await opened(evidence.conversations[2]);await page.getByRole('textbox',{name:'Message',exact:true}).fill('QUEUED-FOLLOW-UP-'+marker);await page.getByRole('textbox',{name:'Message',exact:true}).press('Enter');await expect(page.getByLabel('Queued messages')).toContainText('QUEUED-FOLLOW-UP-'+marker);
  const queued=(await call('chat.queue.list',{conversationId:evidence.conversations[2]})).find(row=>row.text==='QUEUED-FOLLOW-UP-'+marker);assert(queued&&queued.agentId===agents[2]);evidence.queuedRequest=queued.id;await save();
  await application.evaluate((_,{id,marker})=>globalThis.__coordination.requests[id]={steps:[{text:'QUEUED-RESULT-'+marker,requireInput:'QUEUED-FOLLOW-UP-'+marker}]},{id:queued.id,marker});
  evidence.releasedStreams=await application.evaluate((_,{keys,steered})=>keys.map(key=>{const held=globalThis.__coordination.streams.get(key);if(held.aborted){if(held.requestId!==steered)throw Error('An unrelated response was interrupted');return {key,abortedBySteering:true};}held.release();return {key,released:true};}),{keys:[1,2,3].map(i=>'parallel-'+marker+'-'+i),steered:ids[1]});
  await save();
  await Promise.all([finished(ids[1]),finished(ids[2]),finished(ids[3]),finished(queued.id)]);
  await opened(evidence.conversations[1]);await expect(page.getByText('STEERED-RESULT-'+marker,{exact:true})).toBeVisible();
  const nativeState=await application.evaluate((_,id)=>globalThis.__coordination.broker.native.contexts.get(id)?.state,ids[1]);assert(nativeState.steering.some(row=>row.id===steerId&&row.text==='STEERING-'+marker));
  await opened(evidence.conversations[2]);await expect(page.getByText('QUEUED-RESULT-'+marker,{exact:true})).toBeVisible();assert.equal((await call('chat.queue.list',{conversationId:evidence.conversations[2]})).length,0);
  evidence.confirmedCalls=await application.evaluate(()=>globalThis.__coordination.calls);assert.equal(evidence.confirmedCalls.filter(row=>row.requestId===ids[1]).length,2);assert.equal(evidence.confirmedCalls.filter(row=>row.requestId===queued.id).length,1);
  await check('Steering reaches only its intended live thread; the third chat runs its queued follow-up once after its original response finishes.');
  await opened(evidence.conversations[3]);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(draft);await page.screenshot({path:path.join(out,'concurrent-draft-and-results.png')});
  const last=await call('native.active');assert.equal(last.filter(row=>ids.includes(row.requestId)).length,1);assert(last.some(row=>row.requestId===ids[4]));assert.equal((await status(ids[4])).status,'running');assert.equal((await read('desktop_tool_calls','id',{request_id:ids[4]})).length,0);
  evidence.closeWithRequest=ids[4];evidence.freeMemoryWhileRunning=os.freemem();await save();return {fiveConcurrentTurns:true,scopeControlsPassed:true,normalClosureWillInterrupt:ids[4]};
 }});
 assert.equal(first.normalExit,0);evidence.firstProbe=path.join(first.out,'evidence.json');assert.equal(first.controlledNetwork.calls.length,7);await save();
 const cold=await launchDurableProfileProbe(cfg,{label:'concurrent-cold-'+Date.now(),testProfile:false,initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,runReady:async({application,page})=>{
  const {call,read,status,opened}=helpers(application,page);assert.equal((await call('auth.state')).identity.id,prior.owner);assert.equal((await call('native.active')).length,0);evidence.afterReopenStatuses=[];
  for(let i=0;i<ids.length;i++){const row=await status(ids[i]);evidence.afterReopenStatuses.push(row);if(i===0)assert.equal(row.status,'cancelled');else if(i===4)assert(['cancelled','interrupted'].includes(row.status));else assert.equal(row.status,'completed');}
  assert.equal((await status(evidence.queuedRequest)).status,'completed');
  await opened(evidence.conversations[1]);await expect(page.getByText('STEERED-RESULT-'+marker,{exact:true})).toBeVisible();await opened(evidence.conversations[2]);await expect(page.getByText('QUEUED-RESULT-'+marker,{exact:true})).toBeVisible();
  await opened(evidence.conversations[3]);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue(evidence.unsentDraft);await opened(evidence.conversations[4]);await expect(page.getByText('INITIAL-RESULT-'+marker+'-4',{exact:true})).toHaveCount(0);await page.screenshot({path:path.join(out,'interrupted-chat-after-reopening.png')});
  assert.equal((await read('desktop_tool_calls','id',{request_id:ids[4]})).length,0);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);
  await check('Normal closure interrupts the unfinished chat; reopening preserves completed, steered and queued results plus the independent draft, with no automatic model replay.');return {coldReopenWithoutReplay:true};
 }});
 assert.equal(cold.normalExit,0);assert.equal(cold.controlledNetwork.calls.length,0);evidence.coldProbe=path.join(cold.out,'evidence.json');assert(!(await list(true)).includes(cfg.distribution));assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);evidence.machine.freeMemoryAfter=os.freemem();evidence.success=true;await save();await writeFile(path.join(proof.out,'concurrent-agents-accepted.json'),JSON.stringify({success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,evidence:path.join(out,'evidence.json'),checks:evidence.checks.length,controlledModelResponses:7,liveProviderRequests:0,productionProfileChanged:false,installed:false},null,2));console.log(JSON.stringify({success:true,out,checks:evidence.checks.length,controlledModelResponses:7,installed:false}));
}catch(error){evidence.error=redact(error.stack);if(error.cause)evidence.cause=redact(error.cause.stack);await save();console.error(redact(error.stack));if(error.cause)console.error(redact(error.cause.stack));process.exitCode=1;}
