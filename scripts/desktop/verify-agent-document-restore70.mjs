import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile,lstat,realpath,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('actual exact70 whole-profile document recovery and cold reopening');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'));
const source=await json(pointer.sourceIntent),cfg=await json(pointer.restoredIntent),candidate=await json(pointer.candidateFile);
const accepted=await json(path.join(source.out,'documents-recovery-source-accepted.json')),sourceProof=await json(accepted.evidence);
const f=await json(accepted.checkpoint),saved=await json(sourceProof.savedRecords);
assert(accepted.success&&sourceProof.success&&cfg.role==='restored'&&cfg.preparedRecovery&&cfg.registered);
assert.equal(cfg.sourceBundle,accepted.bundle);assert.equal(cfg.imageSha256,candidate.imageSha256);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),candidate.imageSha256);
assert(!(await list(true)).includes(source.distribution));assert(!(await list(true)).includes(cfg.distribution));
const out=path.join(cfg.out,'acceptance-'+Date.now());await mkdir(out);
const checkpoint=path.join(cfg.out,'restore-checkpoint.json');let progress;
try{progress=await json(checkpoint);}catch(error){if(error.code!=='ENOENT')throw error;progress={requestId:randomUUID()};await writeFile(checkpoint,JSON.stringify(progress,null,2),{flag:'wx',mode:0o600});}
const e={success:false,at:new Date().toISOString(),out,imageSha256:candidate.imageSha256,sourceEvidence:accepted.evidence,
 actualPostgres:true,actualPasswordSignIn:false,sameWindowsUser:true,physicalReboot:false,realProviderRequests:0,productionAccess:false,checks:[]};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
const check=async text=>{e.checks.push(text);await save();console.log('PASS '+text);};await save();

async function hideSource(){
 const auditFile=path.join(pointer.parent,'document-source-unavailable.json');let audit;
 try{audit=await json(auditFile);}catch(error){if(error.code!=='ENOENT')throw error;
  const expected=path.resolve('F:/Agentopia-Acceptance','documents70-'+path.basename(pointer.parent)+'-source/home');
  assert.equal(path.resolve(source.home).toLowerCase(),expected.toLowerCase());
  const active=(await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',
   "@(Get-CimInstance Win32_Process -Filter \"Name='Agentopia.exe'\" | Where-Object { $_.ExecutablePath -eq '"+source.exe.replaceAll("'","''")+"' }).Count"],{encoding:'utf8',windowsHide:true})).stdout.trim();
  assert.equal(active,'0');assert.equal((await realpath(expected)).toLowerCase(),expected.toLowerCase());
  assert(!(await lstat(expected)).isSymbolicLink());
  audit={home:expected,retained:expected+'.retained-source70',phase:'pending'};
  for(const target of [audit.home,audit.retained]){
   const relative=path.relative('F:/Agentopia-Acceptance',target);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
   assert(!path.resolve(accepted.bundle).toLowerCase().startsWith(target.toLowerCase()+path.sep));
  }
  await assert.rejects(lstat(audit.retained),error=>error.code==='ENOENT');
  await writeFile(auditFile,JSON.stringify(audit,null,2),{flag:'wx'});
 }
 assert.equal(audit.home,source.home);
 if(audit.phase==='pending'){audit.phase='moving';await writeFile(auditFile,JSON.stringify(audit,null,2));
  await rename(audit.home,audit.retained);audit.phase='complete';await writeFile(auditFile,JSON.stringify(audit,null,2));}
 assert.equal(audit.phase,'complete','Inspect interrupted source movement before resuming.');
 await assert.rejects(lstat(audit.home),error=>error.code==='ENOENT');assert((await lstat(audit.retained)).isDirectory());return auditFile;
}

async function inspectDocuments(_,f){
 const req=globalThis.__durableProbeRequire,assert=req('node:assert/strict'),crypto=req('node:crypto'),fs=req('node:fs/promises');
 const b=globalThis.__coordination.broker,owner=(await b.identity()).id;assert.equal(owner,f.owner);
 const main=await b.agentDocuments.snapshot(owner,f.agent),peer=await b.agentDocuments.snapshot(owner,f.peer);
 assert.deepEqual(main.documents.map(row=>row.id).sort(),f.documents.slice(0,2).sort());
 assert.deepEqual(peer.documents.map(row=>row.id),[f.documents[2]]);
 for(let index=0;index<3;index++){
  await assert.rejects(fs.lstat(f.inputPaths[index]),error=>error.code==='ENOENT');
  const result=await b.admin.rpc('desktop_read_agent_document',{p_user:owner,p_agent:index<2?f.agent:f.peer,p_id:f.documents[index],p_original:true});
  if(result.error)throw Error(result.error.message);
  assert.equal(crypto.createHash('sha256').update(Buffer.from(result.data.base64,'base64')).digest('hex'),f.originals[index]);
 }
 const guard=async()=>assert.equal((await b.identity()).id,owner),signal=new AbortController().signal;
 const text=await b.agentDocuments.execute(owner,main,'read_agent_document',{document_id:f.documents[0],offset:0,characters:16000},guard,signal);
 const peerText=await b.agentDocuments.execute(owner,peer,'read_agent_document',{document_id:f.documents[2],offset:0,characters:16000},guard,signal);
 assert(text.text.includes(f.marker)&&text.text.includes('74 apples'));assert(peerText.text.includes(f.peerMarker)&&peerText.text.includes('47 pears'));
 const pages=await b.agentDocuments.execute(owner,main,'read_agent_document_pages',{document_id:f.documents[1],pages:[3]},guard,signal);
 assert.equal(pages.pageImages[0].page,3);const image=pages.pageImages[0].image;
 const pageSha256=crypto.createHash('sha256').update(Buffer.from(image.split(',')[1],'base64')).digest('hex');assert.equal(pageSha256,f.pageSha256);
 assert.equal(b.imageConnections.status(owner).connection.enabled,false);
 return {originalHashes:f.originals,pageSha256,pageImage:image,documents:3,imagesDisabled:true};
}

try{
 e.sourceUnavailableAudit=await hideSource();await check('The stopped source home is retained under a different name; its original profile and upload paths are unavailable.');
 const restored=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'restored-app')),testProfile:false,
  initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,
  evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,runReady:async({application,page})=>{
   const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
   let auth=await call('auth.state');if(auth.identity){await call('auth.signOut');await page.reload();await page.waitForFunction(()=>window.agentopia?.call);auth=await call('auth.state');}
   assert.equal(auth.needsAdministrator,false);
   await page.getByLabel('Email address',{exact:true}).fill(f.email);await page.getByLabel('Password',{exact:true}).fill(f.password);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();
   await expect.poll(async()=>(await call('auth.state')).identity?.id,{timeout:180000,intervals:[200,500,1000]}).toBe(f.owner);
   e.actualPasswordSignIn=true;await check('A separate empty runtime restores the backup, and the original password signs in to the same administrator account.');
   const observed=await application.evaluate(async(_,{f,saved})=>{
    const b=globalThis.__coordination.broker,assert=globalThis.__durableProbeRequire('node:assert/strict');
    const must=result=>{if(result.error)throw Error(result.error.message);return result.data;},counts={};
    for(const [table,rows]of Object.entries(saved.tables)){
     const key=table==='desktop_agent_profiles'?'agent_id':table==='desktop_media_files'?'media_id':table==='desktop_codex_turns'?'request_id':'id';
     const columns=table==='desktop_media_files'?'media_id,user_id,sha256':'*',actual=[];
     for(let offset=0;offset<rows.length;offset+=80)actual.push(...must(await b.admin.from(table).select(columns).in(key,rows.slice(offset,offset+80).map(row=>row[key]))));
     assert.equal(actual.length,rows.length,table+' saved row count');
     for(const row of rows)assert.deepEqual(actual.find(item=>item[key]===row[key]),row,table+' saved row '+row[key]);counts[table]=actual.length;
    }
    const providers=b.providers.status(f.owner);assert.equal(providers.chatgpt,null);assert.equal(providers.openrouter,false);
    assert.equal(globalThis.__coordination.calls.length,0);
    return {counts,providersRequireReconnection:true,nativeThread:saved.tables.desktop_codex_turns.find(row=>row.request_id===f.directRequest).thread_id};
   },{f,saved});e.restored=observed;
   const docs=await application.evaluate(inspectDocuments,f);await writeFile(path.join(out,'restored-page-three.jpg'),Buffer.from(docs.pageImage.split(',')[1],'base64'));
   e.documents={...docs,pageImage:undefined};await check('Saved definitions, assignments, originals, messages, native reports and scheduled history match all selected source rows; both agents read their own restored text and PDF page three renders identically.');
   let request=await application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).maybeSingle();if(r.error)throw Error(r.error.message);return r.data;},progress.requestId);
   let submitted=false;
   if(!request){
    await application.evaluate(async(_,{f,id})=>{
     const b=globalThis.__coordination.broker;
     await b.secrets.setMany([['openai:'+f.owner,{client_id:'controlled-document-client',subject:'controlled-document-subject',email:'controlled@qa.invalid',id_token:'CONTROLLED',access_token:'CONTROLLED-NOT-A-PROVIDER-CREDENTIAL',refresh_token:'',scope:'chatgpt.tokens.use.direct',expires_at:Date.now()+3600000}],
      ['models:openai-oauth:'+f.owner,[{id:'gpt-6.1-sol',name:'GPT-6.1 Sol',thinking:['default','low'],supportsTools:true}]],['chatgpt-welcome:'+f.owner,true]]);
     const code='const t=ALL_TOOLS.find(t=>t.name.endsWith("read_agent_document"));if(!t)throw Error("Missing restored document reader");const r=await tools[t.name]('+JSON.stringify({document_id:f.documents[0],offset:0,characters:16000})+');for(const c of r.content??[])if(c.type==="text")text(c.text);';
     globalThis.__coordination.requests[id]={steps:[{kind:'exec',code},{text:f.marker+' restored document read complete.',requireInputs:[f.marker,'74 apples']}]};
    },{f,id:progress.requestId});
    submitted=true;await call('chat.start',{requestId:progress.requestId,conversationId:f.conversation,agentId:f.agent,text:'Read the assigned orchard reference again after recovery.',options:{provider:'openai-oauth',model:'gpt-6.1-sol',thinking:'low',permission:'files',mode:'chat',files:[]}});
    await expect.poll(async()=>application.evaluate(async(_,id)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('status,error').eq('id',id).single();if(r.error)throw Error(r.error.message);if(['failed','cancelled','interrupted'].includes(r.data.status))throw Error(r.data.error??r.data.status);return r.data.status;},progress.requestId),{timeout:120000,intervals:[200,500,1000]}).toBe('completed');
   }else assert.equal(request.status,'completed','Preserve uncertain requests instead of replaying them.');
   const continuation=await application.evaluate(async(_,id)=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_codex_turns').select('thread_id').eq('request_id',id).single();if(r.error)throw Error(r.error.message);return {thread:r.data.thread_id,calls:globalThis.__coordination.calls};},progress.requestId);
   assert.equal(continuation.thread,observed.nativeThread);assert.equal(continuation.calls.length,submitted?2:0);
   e.continuation={requestId:progress.requestId,nativeThread:continuation.thread,controlledResponses:continuation.calls.length};progress.continuationCompleted=true;await writeFile(checkpoint,JSON.stringify(progress,null,2));
   await page.goto('agentopia://app/conversations/'+f.conversation);await expect(page.getByText(f.marker+' restored document read complete.',{exact:true})).toBeVisible();await page.screenshot({path:path.join(out,'restored-conversation.png')});
   await check('After controlled reauthorization, a new two-step Codex continuation reads the retained document through its real tool bridge on the original native thread.');
   return {restored:true,controlledResponses:continuation.calls.length};
  }});
 assert.equal(restored.normalExit,0);assert(!(await list(true)).includes(cfg.distribution));e.restoredNormalExit=0;
 const cold=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'cold-app')),testProfile:false,
  initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,
  evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,runReady:async({application,page})=>{
   const auth=await page.evaluate(()=>window.agentopia.call('auth.state'));assert.equal(auth.identity?.id,f.owner);
   const docs=await application.evaluate(inspectDocuments,f);assert.equal(docs.pageSha256,f.pageSha256);
   const state=await application.evaluate(async(_,{f,id})=>{const b=globalThis.__coordination.broker,r=await b.admin.from('desktop_requests').select('id,status').in('id',[f.directRequest,f.routerRequest,f.parentRequest,f.namedRequest,f.scheduledRequest,id]);if(r.error)throw Error(r.error.message);return {requests:r.data,calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors};},{f,id:progress.requestId});
   assert.equal(state.requests.length,6);assert(state.requests.every(row=>row.status==='completed'));assert.deepEqual(state.calls,[]);assert.deepEqual(state.blocked,[]);assert.deepEqual(state.errors,[]);
   await page.goto('agentopia://app/conversations/'+f.conversation);await expect(page.getByText(f.marker+' restored document read complete.',{exact:true})).toBeVisible();
   await page.screenshot({path:path.join(out,'cold-restored-conversation.png')});return {documents:3,completedRequests:6,inferenceRequests:0};
  }});
 assert.equal(cold.normalExit,0);assert.equal(cold.controlledNetwork.calls.length,0);assert(!(await list(true)).includes(cfg.distribution));
 e.coldNormalExit=0;e.coldModelRequests=0;e.runtimeStopped=true;await check('A second cold reopening retains sign-in, all six completed requests and all three originals, with no inference or replay; both app sessions close normally.');
 e.success=true;await save();await writeFile(path.join(cfg.out,'documents-recovery-accepted.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checkpoint},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checks:e.checks.length,documents:3,coldModelRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await save();console.error('Inspect document restore evidence at '+out);process.exitCode=1;}
