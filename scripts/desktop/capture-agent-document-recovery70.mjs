import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('capture exact70 whole-profile document recovery with zero inference');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'));
const cfg=await json(pointer.sourceIntent),candidate=await json(pointer.candidateFile);
const packaged=await json(path.join(candidate.out,'packaged-accepted.json'));
const fixtureFile=path.join(cfg.out,'document-fixture.json'),f=await json(fixtureFile);
assert(packaged.success&&cfg.role==='source'&&f.inputsRemoved&&!f.recoveryBundle);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),candidate.imageSha256);
assert(!(await list(true)).includes(cfg.distribution));
const out=path.join(cfg.out,'recovery-capture-'+Date.now());await mkdir(out);
const backupParent=path.resolve('F:/Agentopia-Acceptance','document-recovery70-'+Date.now());await mkdir(backupParent);
const e={success:false,at:new Date().toISOString(),out,imageSha256:candidate.imageSha256,productionAccess:false,realProviderRequests:0};
try{
 const result=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'app')),testProfile:false,
  initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,
  evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,runReady:async({application,page})=>{
   const call=(action,args)=>page.evaluate(({action,args})=>window.agentopia.call(action,args),{action,args});
   assert.equal((await call('auth.state')).identity?.id,f.owner);
   await application.evaluate((_,parent)=>{globalThis.__durableProbeElectron.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[parent]});},backupParent);
   const capture=await call('runtime.backup',{display:{}});assert(capture?.destination&&capture.accounts===1);
   const descriptor=await json(path.join(capture.destination,'desktop-recovery.json'));assert.equal(descriptor.requiresDesktopRecoveryFormat,12);
   f.recoveryBundle=capture.destination;await writeFile(fixtureFile,JSON.stringify(f,null,2));
   const saved=await application.evaluate(async(_,f)=>{
    const b=globalThis.__coordination.broker,must=result=>{if(result.error)throw Error(result.error.message);return result.data;};
    const tables={};for(const name of ['agents','desktop_agent_profiles','desktop_agent_memories','media_library','agent_media_assignments',
     'desktop_requests','chat_messages_v2','conversation_sessions','desktop_scheduled_tasks','desktop_scheduled_runs','desktop_codex_turns']){
     tables[name]=must(await b.admin.from(name).select('*'));
    }
    tables.desktop_media_files=must(await b.admin.from('desktop_media_files').select('media_id,user_id,sha256'));
    return {tables,network:{calls:globalThis.__coordination.calls,blocked:globalThis.__coordination.blocked,errors:globalThis.__coordination.errors}};
   },f);
   assert.deepEqual(saved.network,{calls:[],blocked:[],errors:[]});
   assert.equal(saved.tables.desktop_media_files.length,3);
   const savedFile=path.join(out,'saved-records.json');await writeFile(savedFile,JSON.stringify(saved,null,2),{flag:'wx',mode:0o600});
   Object.assign(e,{capture,bundle:capture.destination,savedRecords:savedFile,tableCounts:Object.fromEntries(Object.entries(saved.tables).map(([name,rows])=>[name,rows.length]))});
   return {captured:true,documents:3,inferenceRequests:0};
  }});
 assert.equal(result.normalExit,0);assert.equal(result.controlledNetwork.calls.length,0);
 assert(!(await list(true)).includes(cfg.distribution));
 Object.assign(e,{success:true,normalExit:0,runtimeStopped:true,controlledResponses:0});
 const evidence=path.join(out,'evidence.json');await writeFile(evidence,JSON.stringify(e,null,2));
 await writeFile(path.join(cfg.out,'documents-recovery-source-accepted.json'),JSON.stringify({success:true,evidence,bundle:e.bundle,checkpoint:fixtureFile},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence,documents:3,controlledResponses:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.error('Inspect document recovery capture at '+out);process.exitCode=1;}
