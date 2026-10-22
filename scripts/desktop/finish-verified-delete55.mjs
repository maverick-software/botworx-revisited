import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,linux} from './phased-backup-control.mjs';
import {closeOrdinaryAgentopia,reopenOrdinaryAgentopia} from './normal-cleanup55-process.mjs';
desktopOperation('finish previously verified C-only obsolete-tree removal');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile),job=path.join(root,'.supabase/desktop-cleanup55/1792599907730');
const e=await json(path.join(job,'evidence.json')),eligible=await json(path.join(job,'eligible.json')),copy=await json(path.join(job,'legacy-copy.json')),proof=await json((await json(path.join(root,'.supabase/desktop-plugin-release55/current.json'))).proof);
assert(eligible.success&&eligible.everyDestinationByteVerifiedDuringCopy&&eligible.legacySourceRehashedIndependently&&eligible.destinationPathsSizesTimesLinksComparedIndependently&&eligible.programRollbackVerified);
assert.equal(await hash(copy.manifest),eligible.copyManifestSha256);assert.equal(await hash(path.join(job,'archive-metadata-seal.json')),eligible.archiveMetadataSealSha256);assert.equal(await hash('C:/Users/charl/.agentopia/desktop/profile-location.json'),eligible.selectorSha256);
const partial=await json(path.join(job,'cleanup.json'));assert(!partial.success&&partial.roots.some(r=>r.path==='C:\\Users\\charl\\.agentopia\\desktop\\profile'&&r.removed));
e.previousAttempts=[...(e.previousAttempts??[]),{at:new Date().toISOString(),error:e.error,ordinaryReopened:e.reopened,completedPerFileRemoval:partial}];delete e.error;delete e.reopeningError;e.success=false;const save=()=>writeFile(path.join(job,'evidence.json'),JSON.stringify(e,null,2));
const command=async(exe,args,timeout=120000)=>(await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout,maxBuffer:2*1024*1024})).stdout.trim();
const wsl=async script=>JSON.parse(await command('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop',script)),linux((await json(path.join(root,'.supabase/desktop-production-logical/current.json'))).out)]));
const exe=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.55/Agentopia.exe');
try{
 for(let attempt=0;;attempt++){
  try{await command(process.execPath,[path.join(root,'scripts/desktop/accept-installed55.mjs')]);break;}
  catch(error){if(attempt>=5)throw error;console.log('Waiting for the normally reopened app and existing database.');await new Promise(resolve=>setTimeout(resolve,15000));}
 }
 e.normalClose=await closeOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256,ensureIdle:async()=>{assert.equal((await wsl('runtime-maintenance-readiness54.py')).unfinishedRequests,0);}});await save();
 const script=path.join(root,'scripts/desktop/remove-verified-c-trees55.ps1'),shell=path.join(proof.assets,'code-tools/powershell-7.6.7/pwsh.exe');assert.equal(await hash(shell),proof.resourceFiles['code-tools/powershell-7.6.7/pwsh.exe']);e.bulkCleanupSourceSha256=await hash(script);await writeFile(path.join(job,'executed-remove-verified-c-trees55.ps1'),await readFile(script),{flag:'wx'});await save();
 await new Promise((resolve,reject)=>{const child=spawn(shell,['-NoLogo','-NoProfile','-NonInteractive','-File',script,'-Job',job],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;process.stdout.write(b);});child.once('error',reject);child.once('close',async code=>{await writeFile(path.join(job,'bulk-cleanup-console.txt'),output);code===0?resolve():reject(Error('Inspect bulk-cleanup.json: '+job));});});
 const bulk=await json(path.join(job,'bulk-cleanup.json'));assert(bulk.success);e.cleanup={...bulk,deletedFiles:bulk.deletedFiles+partial.deletedFiles,deletedBytes:bulk.deletedBytes+partial.deletedBytes,previousCompletedRoots:partial.roots,countsExcludeAnyUnrecordedPartialRootDeletion:true};e.removalComplete=true;await save();
}catch(error){e.error=error.message;process.exitCode=1;}finally{
 try{e.reopened=await reopenOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256});}catch(error){e.reopeningError=error.message;process.exitCode=1;}await save();
}
if(e.removalComplete&&e.reopened?.success){
 for(let attempt=0;attempt<8;attempt++){
  try{e.database=await wsl('audit-production-logical.py');assert(e.database.success);e.success=true;delete e.error;break;}
  catch(error){e.databaseWaiting=error.message;console.log('Waiting for the reopened app to start its existing database.');await new Promise(resolve=>setTimeout(resolve,15000));}
 }
 if(!e.success)process.exitCode=1;
}
e.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({success:e.success,job,deletedBytes:e.cleanup?.deletedBytes,deletedFiles:e.cleanup?.deletedFiles,ordinaryReopened:e.reopened?.success,error:e.error}));
