import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile,lstat,realpath,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list,run,linux} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
import {inspectLibraryRecovery71 as inspectDocuments,finishNativeLibraryRecovery71,coldLibraryRecovery71} from './agent-library-recovery71-workflows.mjs';

desktopOperation('actual exact71 whole-profile document recovery and cold reopening');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json'));
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
  const expected=path.resolve('F:/Agentopia-Acceptance','library71-'+path.basename(pointer.parent)+'-source/home');
  assert.equal(path.resolve(source.home).toLowerCase(),expected.toLowerCase());
  const active=(await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',
   "@(Get-CimInstance Win32_Process -Filter \"Name='Agentopia.exe'\" | Where-Object { $_.ExecutablePath -eq '"+source.exe.replaceAll("'","''")+"' }).Count"],{encoding:'utf8',windowsHide:true})).stdout.trim();
  assert.equal(active,'0');assert.equal((await realpath(expected)).toLowerCase(),expected.toLowerCase());
  assert(!(await lstat(expected)).isSymbolicLink());
  audit={home:expected,retained:expected+'.retained-source71',phase:'pending'};
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
   const auditOut=path.join(out,'complete-database-audit');const auditResult=JSON.parse(await run(['-d',cfg.distribution,'-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop/audit-owned-library-recovery71.py')),linux(auditOut),linux(pointer.restoredIntent),linux(accepted.bundle)],180000));assert(auditResult.success);e.completeDatabaseAudit=path.join(auditOut,'evidence.json');await check('The complete restored snapshot matches all 128 application/account/vault tables, including both retained revisions, passwords and encryption-root bindings.');
   const observed=await application.evaluate(async(_,{f,saved})=>{
    const b=globalThis.__coordination.broker,assert=globalThis.__durableProbeRequire('node:assert/strict');
    const must=result=>{if(result.error)throw Error(result.error.message);return result.data;},counts={};
    for(const [table,rows]of Object.entries(saved.tables)){
     const key=table==='desktop_agent_profiles'?'agent_id':['desktop_media_files','desktop_media_revisions'].includes(table)?'media_id':table==='desktop_codex_turns'?'request_id':'id';
     const columns=table==='desktop_media_files'?'media_id,user_id,sha256':'*',actual=[];
     for(let offset=0;offset<rows.length;offset+=80)actual.push(...must(await b.admin.from(table).select(columns).in(key,rows.slice(offset,offset+80).map(row=>row[key]))));
     assert.equal(actual.length,rows.length,table+' saved row count');
     for(const row of rows)assert.deepEqual(actual.find(item=>item[key]===row[key]&&(table!=='desktop_media_revisions'||item.version===row.version)),row,table+' saved row '+row[key]);counts[table]=actual.length;
    }
    const providers=b.providers.status(f.owner);assert.equal(providers.chatgpt,null);assert.equal(providers.openrouter,false);
    assert.equal(globalThis.__coordination.calls.length,0);
    return {counts,providersRequireReconnection:true,nativeThread:saved.tables.desktop_codex_turns.find(row=>row.request_id===f.directRequest).thread_id};
   },{f,saved});e.restored=observed;
   const docs=await application.evaluate(inspectDocuments,f);await writeFile(path.join(out,'restored-page-three.jpg'),Buffer.from(docs.pageImage.split(',')[1],'base64'));
   e.documents={...docs,pageImage:undefined};await check('Saved definitions, assignments, originals, messages, native reports and scheduled history match all selected source rows; both agents read their own restored text and PDF page three renders identically.');
   return finishNativeLibraryRecovery71({application,page,f,saved,progress,checkpoint,e,out,check});
  }});
 assert.equal(restored.normalExit,0);assert(!(await list(true)).includes(cfg.distribution));e.restoredNormalExit=0;
 const cold=await launchDurableProfileProbe(cfg,{label:path.relative(cfg.out,path.join(out,'cold-app')),testProfile:false,
  initialProfile:cfg.profile,expectedProfile:cfg.profile,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,
  evaluationTimeoutMs:15*60000,normalCloseTimeoutMs:120000,runReady:async({application,page})=>{
   return coldLibraryRecovery71({application,page,f,progress,out});
  }});
 assert.equal(cold.normalExit,0);assert.equal(cold.controlledNetwork.calls.length,0);assert(!(await list(true)).includes(cfg.distribution));
 e.coldNormalExit=0;e.coldModelRequests=0;e.runtimeStopped=true;await check('A second cold reopening retains sign-in, eight completed requests, both intentionally revoked requests, all three originals and both retained versions, with no inference or replay; both app sessions close normally.');
 e.success=true;await save();await writeFile(path.join(cfg.out,'documents-recovery-accepted.json'),JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checkpoint},null,2),{flag:'wx'});
 console.log(JSON.stringify({success:true,evidence:path.join(out,'evidence.json'),checks:e.checks.length,documents:3,coldModelRequests:0}));
}catch(error){e.error=error.cause?.stack??error.stack;await save();console.error('Inspect document restore evidence at '+out);process.exitCode=1;}
