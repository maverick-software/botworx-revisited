import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,linux} from './phased-backup-control.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';
import {closeOrdinaryAgentopia,reopenOrdinaryAgentopia} from './normal-cleanup55-process.mjs';
desktopOperation('resume completed profile copy verification and explicit C cleanup');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile);
const pointer=await json(path.join(root,'.supabase/desktop-cleanup55/current.json')),job=pointer.job;assert.equal(job,path.resolve('F:/Agentopia/.supabase/desktop-cleanup55/1792599907730'));
const e=await json(pointer.evidence),copy=await json(path.join(job,'legacy-copy.json'));assert(copy.success&&copy.phase==='completed'&&copy.files===284706&&copy.bytes===28740855050);assert(!e.cleanup);
e.previousAttempts=[...(e.previousAttempts??[]),{at:e.at,error:e.error,ordinaryReopened:e.reopened}];delete e.error;delete e.reopeningError;e.resumedAt=new Date().toISOString();e.success=false;const save=()=>writeFile(pointer.evidence,JSON.stringify(e,null,2));
const proof=await json((await json(path.join(root,'.supabase/desktop-plugin-release55/current.json'))).proof),exe=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.55/Agentopia.exe');
async function command(exe,args,timeout=120000){try{return (await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout,maxBuffer:2*1024*1024})).stdout.trim();}catch(error){await writeFile(path.join(job,'private-resume-command-'+Date.now()+'.json'),JSON.stringify({message:error.message,stdout:error.stdout,stderr:error.stderr}));throw Error('Resume command failed; private diagnostic retained in '+job);}}
const wsl=async script=>JSON.parse(await command('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop',script)),linux((await json(path.join(root,'.supabase/desktop-production-logical/current.json'))).out)]));
try{
 assert((await probeMaintenanceWindowsContext()).success);
 e.normalClose=await closeOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256,ensureIdle:async()=>{assert.equal((await wsl('runtime-maintenance-readiness54.py')).unfinishedRequests,0);}});await save();
 const script=path.join(root,'scripts/desktop/verify-cleanup55.py'),inventory=path.join(root,'scripts/desktop/closed-profile-inventory55.py');e.verificationSources={[script]:await hash(script),[inventory]:await hash(inventory)};await save();
 console.log('Reusing per-file destination byte verification; independently hashing originals and checking retained paths, sizes, times and links.');
 e.preservation=JSON.parse(await command(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',script,job],1200000));assert(e.preservation.success);await save();
 const psScript=path.join(root,'scripts/desktop/remove-obsolete-c-copies55.ps1');e.cleanupScriptSha256=await hash(psScript);e.eligibilitySha256=await hash(path.join(job,'eligible.json'));await save();
 console.log('Preservation passed. Removing the explicit obsolete C profile/build copies.');
 await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',psScript,'-Job',job],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;process.stdout.write(b);});child.once('error',reject);child.once('close',async code=>{await writeFile(path.join(job,'cleanup-console.txt'),output);code===0?resolve():reject(Error('Inspect the partial cleanup receipt: '+job));});});
 e.cleanup=await json(path.join(job,'cleanup.json'));assert(e.cleanup.success);e.removalComplete=true;
}catch(error){e.error=error.message;process.exitCode=1;}finally{
 try{e.reopened=await reopenOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256});}catch(error){e.reopeningError=error.message;process.exitCode=1;}
 await save();
}
if(e.removalComplete&&e.reopened?.success){
 for(let attempt=0;attempt<8;attempt++){
  try{e.database=await wsl('audit-production-logical.py');assert(e.database.success);e.success=true;delete e.error;break;}
  catch(error){e.databaseWaiting=error.message;console.log('Waiting for the normally reopened app to start its existing database.');await new Promise(resolve=>setTimeout(resolve,15000));}
 }
 if(!e.success)process.exitCode=1;
}
e.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify({success:e.success,job,deletedBytes:e.cleanup?.deletedBytes,deletedFiles:e.cleanup?.deletedFiles,ordinaryReopened:e.reopened?.success,error:e.error}));
