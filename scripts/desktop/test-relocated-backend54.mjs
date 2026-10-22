import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,access,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list,registration} from './phased-backup-control.mjs';
import {capturePrivateProfile,inventoryPrivateProfile} from './capture-private-profile.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {installComposioFixture} from './composio-application52-workflows.mjs';

desktopOperation('verify complete 54 backend profile relocation and deliberate continuation');
const root=path.resolve(import.meta.dirname,'../..'),json=async f=>JSON.parse(await readFile(f,'utf8')),exec=promisify(execFile),pp=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),proof=await json(pp.proof),current=await json(path.join(proof.out,'backend-relocation-current.json')),cfg=await json(current.intent),account=await json(cfg.primaryAccountFile);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert(!(await list(true)).includes(cfg.distribution));
const evidenceFile=path.join(cfg.out,'evidence.json');let e;
try{e=await json(evidenceFile);assert(!e.success,'Completed relocation acceptance must not be replayed');}catch(error){if(error.code!=='ENOENT')throw error;e={success:false,at:new Date().toISOString(),out:cfg.out,version:'0.44.54',imageSha256:proof.imageSha256,checks:[],providerRequests:0,controlledModelResponses:0,productionProfileChanged:false,qaPortTemplateOnlyResourceDifference:true,sourceRequestId:cfg.sourceRequestId,relocatedRequestId:cfg.relocatedRequestId};}
if(e.error){(e.previousFailures??=[]).push({at:new Date().toISOString(),error:e.error,cause:e.cause});delete e.error;delete e.cause;}
const redact=value=>String(value).replaceAll(account.password,'[REDACTED GENERATED PASSWORD]'),save=()=>writeFile(evidenceFile,redact(JSON.stringify(e,null,2))),check=async text=>{e.checks.push(text);await save();console.log('PASS '+text);},exists=async f=>{try{await access(f);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const options={thinking:'default',permission:'full',mode:'chat',provider:'openai-oauth',model:'gpt-6.1-sol',files:[],tools:[]},sourceMarker='PROFILE-SOURCE54-'+cfg.marker,afterMarker='PROFILE-RELOCATED54-'+cfg.marker,labels={current:'Current Word54 '+cfg.marker,earlier:'Earlier Word54 '+cfg.marker,pdf:'PDF54 '+cfg.marker};
function api(application,page){
 const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
 const read=(table,columns,filters)=>application.evaluate(async(_,{table,columns,filters})=>{let query=globalThis.__coordination.broker.admin.from(table).select(columns);for(const [key,value]of Object.entries(filters))query=query.eq(key,value);const result=await query;if(result.error)throw Error(result.error.message);return result.data;},{table,columns,filters});
 const finished=id=>expect.poll(async()=>{const row=(await read('desktop_requests','status,error',{id}))[0];if(row&&['failed','cancelled','interrupted'].includes(row.status))throw Error(row.error??row.status);return row?.status;},{timeout:180000,intervals:[250,500,1000]}).toBe('completed');
 return {call,read,finished};
}
const toolCode=()=>"const tool=ALL_TOOLS.find(tool=>tool.name.endsWith('search_agent_memory'));if(!tool)throw Error('Memory search is unavailable');text(await tools[tool.name]({query:"+JSON.stringify(cfg.compact.title)+",limit:5}));";
async function identity(application,page){
 const {call}=api(application,page);await installComposioFixture(application,root,cfg.remoteSnapshot);let auth=await call('auth.state');
 if(!auth.identity){await call('auth.signIn',{email:account.email,password:account.password});await page.reload();auth=await call('auth.state');}
 assert.equal(auth.identity.id,cfg.owner);
 await application.evaluate(async({app},c)=>{const broker=globalThis.__coordination.broker,assert=globalThis.__durableProbeRequire('node:assert/strict');assert.equal(app.getVersion(),'0.44.54');assert.equal(new URL(broker.admin.supabaseUrl).port,String(c.portBase+1));const token=broker.secrets.get('openai:'+c.owner);assert.equal(token.access_token,'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL');if(token.expires_at<Date.now()+120000)await broker.secrets.set('openai:'+c.owner,{...token,expires_at:Date.now()+3600000});},{owner:cfg.owner,portBase:cfg.portBase});
 return api(application,page);
}
async function documents(page,call,phase){
 await page.goto('agentopia://app/conversations/'+cfg.compact.conversation);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible({timeout:60000});
 for(const [label,extension]of [[labels.current,'docx'],[labels.earlier,'docx'],[labels.pdf,'pdf']]){
  await page.getByRole('link',{name:label,exact:true}).last().click();const name='Relocation-'+cfg.marker+'.'+extension,frame=page.frameLocator('iframe[title="Formatted preview: '+name+'"]');
  if(extension==='docx'){await expect(frame.locator('section.docx').first()).toBeVisible({timeout:60000});await expect(frame.locator('table')).toHaveCount(1);}else{await expect(frame.locator('canvas').first()).toBeVisible({timeout:60000});assert(await frame.locator('canvas').first().evaluate(c=>c.width>100&&c.height>100));}
  const file=await call('workspace.link',{conversationId:cfg.compact.conversation,href:label===labels.current?e.paths.current:label===labels.earlier?e.paths.earlier:e.paths.pdf});assert.equal(file.kind,'file');
 }
 await page.screenshot({path:path.join(cfg.out,phase+'-documents.png')});
 await page.getByRole('button',{name:'Close workspace pane',exact:true}).click();await expect(page.getByRole('tablist',{name:'Workspace tabs',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:labels.current,exact:true}).last().click();await expect(page.frameLocator('iframe[title="Formatted preview: Relocation-'+cfg.marker+'.docx"]').locator('section.docx').first()).toBeVisible({timeout:60000});
}
async function nativeRequest(application,page,source){
 const {call,read,finished}=api(application,page),id=source?cfg.sourceRequestId:cfg.relocatedRequestId,marker=path.join(cfg.out,(source?'source-request-started-':'relocated-request-started-')+id+'.json'),existing=(await read('desktop_requests','id,status',{id}))[0];
 if(existing){assert.equal(existing.status,'completed','Inspect the saved request before any deliberate new attempt');assert(await exists(marker));return;}
 assert(!(await exists(marker)),'A request was dispatched without a terminal saved result; inspect it before proceeding');
 const steps=[{kind:'exec',code:toolCode(),...(source?{hold:'source54-memory'}:{requireInputs:[sourceMarker,cfg.compact.title]})},{text:source?'SOURCE54-PENDING':afterMarker,requireInputs:[cfg.compact.title]}];
 await application.evaluate((_,{id,steps})=>{globalThis.__coordination.requests[id]={steps};},{id,steps});await writeFile(marker,JSON.stringify({id,at:new Date().toISOString(),source,controlledOnly:true}),{flag:'wx'});
 try{
  await call('chat.start',{requestId:id,agentId:cfg.compact.agent,conversationId:cfg.compact.conversation,text:source?'Preserve this relocation task and its checkpoint. Read the existing checkpoint without changing it.':'Continue the saved relocation task. Keep its constraints and checkpoint unchanged; read the existing memory.',options});
  if(source){
   await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.streams.has('source54-memory')),{timeout:120000}).toBe(true);
   e.paths=await application.evaluate(async(_,{id,source,home,root,marker,labels,sourceMarker})=>{
    const {broker,requests}=globalThis.__coordination,r=broker.native.running.get(id),req=globalThis.__durableProbeRequire,path=req('node:path'),fs=req('node:fs/promises'),{pathToFileURL}=req('node:url'),assert=req('node:assert/strict');assert(r?.worker?.cwd);const mapping=await broker.admin.from('desktop_codex_threads').select('scope').eq('conversation_id',r.conversation).eq('user_id',r.owner).eq('thread_id',r.state.threadId).single();if(mapping.error)throw Error(mapping.error.message);assert(/^[a-f0-9]{16,64}$/.test(mapping.data.scope));const cwd=path.join(source,'workspaces',r.owner,r.conversation+'-'+mapping.data.scope),relative=path.relative(source,cwd);assert(relative.startsWith('workspaces'+path.sep));await fs.mkdir(cwd,{recursive:true});
    const word=path.join(cwd,'Relocation-'+marker+'.docx'),pdf=path.join(cwd,'Relocation-'+marker+'.pdf');await fs.copyFile(path.join(root,'desktop/tests/fixtures/documents/sample.docx'),word);await fs.copyFile(path.join(root,'desktop/tests/fixtures/documents/sample.pdf'),pdf);
    const current=pathToFileURL(word).href,earlier=pathToFileURL(path.join(home,'AppData/Roaming/Agentopia',relative,path.basename(word))).href,pdfUrl=pathToFileURL(pdf).href;requests[id].steps[1].text=sourceMarker+'\n\n['+labels.current+']('+current+')\n\n['+labels.earlier+']('+earlier+')\n\n['+labels.pdf+']('+pdfUrl+')';return {current,earlier,pdf:pdfUrl,word,pdfFile:pdf,cwd};
   },{id,source:cfg.source,home:cfg.home,root,marker:cfg.marker,labels,sourceMarker});await save();
   await application.evaluate(()=>globalThis.__coordination.streams.get('source54-memory').release());
  }
  await finished(id);
 }finally{const calls=await application.evaluate(()=>globalThis.__coordination.calls);if(source)e.sourceCalls=calls;else e.relocatedCalls=calls;await save();}
}
async function backup(application,page){
 const parent=path.join(cfg.out,'product-backup');await mkdir(parent,{recursive:true});const {call}=api(application,page);
 await application.evaluate(({dialog},parent)=>{globalThis.__relocationPicker=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[parent]});},parent);
 try{return await call('runtime.backup',{});}finally{await application.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__relocationPicker;delete globalThis.__relocationPicker;});}
}
await save();
try{
 if(!e.sourceDone){
  const result=await launchDurableProfileProbe(cfg,{label:'source-'+Date.now(),testProfile:false,initialProfile:cfg.source,expectedProfile:cfg.source,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,runReady:async({application,page})=>{
   const {call,read}=await identity(application,page);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);const memories=await read('desktop_agent_memories','id,title,content',{agent_id:cfg.compact.agent});e.memories=memories;e.agentProfile=await call('agents.profile',{agentId:cfg.compact.agent});e.providerChoices=await call('providers.status');await save();
   await nativeRequest(application,page,true);const turn=(await read('desktop_codex_turns','thread_id,state',{request_id:cfg.sourceRequestId}))[0];assert(turn?.thread_id);e.sourceThread=turn.thread_id;e.sourceReceipts=await read('desktop_tool_calls','id,name,status',{request_id:cfg.sourceRequestId});assert.equal(e.sourceReceipts.length,1);assert.equal(e.sourceReceipts[0].name,'search_agent_memory');assert.equal(e.sourceReceipts[0].status,'completed');await documents(page,call,'source');return {sourceThread:e.sourceThread,providerRequests:0};
  }});assert.equal(result.normalExit,0);e.sourceProbe=path.join(result.out,'evidence.json');e.sourceDone=true;await check('Exact 54 full backend opens the generated source profile, reads its existing agent memory and renders saved Word/PDF links before relocation.');
 }
 if(!e.copyDone){
  assert(!(await list(true)).includes(cfg.distribution));await mkdir(path.dirname(cfg.target),{recursive:true});const sid=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[path.dirname(cfg.target),'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});const before=await inventoryPrivateProfile(cfg.source);const copied=await capturePrivateProfile(cfg.source,cfg.target,{headroomBytes:512*1024**2});await writeFile(path.join(cfg.out,'relocation-copy.json'),JSON.stringify(copied,null,2));
  await writeFile(path.join(cfg.target,'.agentopia-native-relocation.json'),JSON.stringify({format:1,codex:'0.163.0',sourceProfile:cfg.source,destinationProfile:cfg.target,state:'copied'}));
  const python=path.join(cfg.assets,'script-runtimes/python-3.14.8/python.exe'),rebased=await exec(python,['-I','-B',path.join(cfg.assets,'runtime/relocate-native-profile.py'),cfg.target],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:1024*1024});assert(JSON.parse(rebased.stdout).success);await writeFile(path.join(cfg.out,'target-native-rebase.json'),rebased.stdout);
  const prior=await readFile(path.join(cfg.source,'profile-migration.json')),receipt=JSON.stringify({format:2,kind:'verified-profile-relocation',status:'complete',source:cfg.source,destination:cfg.target,runtimeInstanceId:cfg.instance,priorMigrationSha256:createHash('sha256').update(prior).digest('hex'),files:copied.fileCount,copyManifestSha256:await hash(path.join(cfg.out,'relocation-copy.json')),encryptedStorageVerified:true,nativeHistoryVerified:true,generatedCompatibilityFixtureOnly:true});await writeFile(path.join(cfg.target,'profile-migration.json'),receipt);assert.deepEqual(await inventoryPrivateProfile(cfg.source),before);
  await writeFile(path.join(cfg.home,'.agentopia/desktop/profile-location.json'),JSON.stringify({format:2,kind:'verified-profile-migration',installationRoot:path.dirname(cfg.program),profile:cfg.target,runtimeInstanceId:cfg.instance,migrationSha256:createHash('sha256').update(receipt).digest('hex')}));e.sourceRetained=path.join(cfg.out,'retained-source-profile');await rename(cfg.source,e.sourceRetained);assert(!(await exists(cfg.source)));e.copyDone=true;await check('The stopped generated profile is byte-verified, its native indexes are rebased, and its published new location no longer depends on the original private folder.');
 }
 if(!e.relocatedDone){
  const result=await launchDurableProfileProbe(cfg,{label:'relocated-'+Date.now(),testProfile:false,initialProfile:cfg.source,expectedProfile:cfg.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,runReady:async({application,page})=>{
   const {call,read}=await identity(application,page);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);assert.deepEqual(await call('agents.profile',{agentId:cfg.compact.agent}),e.agentProfile);assert.deepEqual(await read('desktop_agent_memories','id,title,content',{agent_id:cfg.compact.agent}),e.memories);
   await documents(page,call,'relocated');await nativeRequest(application,page,false);const turn=(await read('desktop_codex_turns','thread_id,state',{request_id:cfg.relocatedRequestId}))[0];assert.equal(turn.thread_id,e.sourceThread);e.relocatedReceipts=await read('desktop_tool_calls','id,name,status',{request_id:cfg.relocatedRequestId});assert.equal(e.relocatedReceipts.length,1);assert.equal(e.relocatedReceipts[0].name,'search_agent_memory');assert.equal(e.relocatedReceipts[0].status,'completed');assert.deepEqual(await read('desktop_agent_memories','id,title,content',{agent_id:cfg.compact.agent}),e.memories);
   e.productBackup=await backup(application,page);await save();return {sameNativeThread:true,productBackup:e.productBackup,liveProviderRequests:0};
  }});assert.equal(result.normalExit,0);e.relocatedProbe=path.join(result.out,'evidence.json');e.relocatedDone=true;await check('The full backend opens the relocated profile, resolves both former private output locations, resumes the same native thread and creates a product portable backup.');
 }
 const cold=await launchDurableProfileProbe(cfg,{label:'cold-'+Date.now(),testProfile:false,initialProfile:cfg.source,expectedProfile:cfg.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,redact,runReady:async({application,page})=>{
  const {call,read}=await identity(application,page);assert.equal(await application.evaluate(()=>globalThis.__coordination.calls.length),0);assert.equal((await read('desktop_requests','status',{id:cfg.sourceRequestId}))[0].status,'completed');assert.equal((await read('desktop_requests','status',{id:cfg.relocatedRequestId}))[0].status,'completed');assert.equal((await read('desktop_codex_turns','thread_id',{request_id:cfg.relocatedRequestId}))[0].thread_id,e.sourceThread);assert.deepEqual(await read('desktop_agent_memories','id,title,content',{agent_id:cfg.compact.agent}),e.memories);await documents(page,call,'cold');await page.screenshot({path:path.join(cfg.out,'cold-restored.png')});return {noReplay:true,liveProviderRequests:0};
 }});assert.equal(cold.normalExit,0);e.coldProbe=path.join(cold.out,'evidence.json');assert(!(await list(true)).includes(cfg.distribution));assert.deepEqual(await registration(cfg.distribution),cfg.registration);assert.equal(await hash(proof.image),proof.imageSha256);e.success=true;await check('Normal cold reopening preserves the saved results, memory and documents with zero automatic model calls; the QA runtime registration is unchanged.');
}catch(error){e.error=redact(error.stack);e.cause=redact(error.cause?.stack??'');process.exitCode=1;}await save();console.log(JSON.stringify({success:e.success,out:cfg.out,checks:e.checks.length,error:e.error,cause:e.cause,providerRequests:0}));
