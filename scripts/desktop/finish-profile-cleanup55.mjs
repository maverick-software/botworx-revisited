import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access,realpath} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,linux} from './phased-backup-control.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';
import {closeOrdinaryAgentopia,reopenOrdinaryAgentopia} from './normal-cleanup55-process.mjs';
desktopOperation('finish verified production profile and obsolete-build cleanup on C');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-plugin-release55/current.json')),proof=await json(pointer.proof),update=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update55.json')),accepted=await json(path.join(update.job,'installed-data-accepted.json'));
assert(accepted.success&&accepted.version==='0.44.55'&&accepted.ordinaryFProfileSelected);
const job=path.join(root,'.supabase/desktop-cleanup55',String(Date.now()));await mkdir(job,{recursive:true});assert.equal(await realpath(job),job);
const command=async(exe,args,timeout=120000)=>{try{return (await exec(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout,maxBuffer:2*1024*1024})).stdout.trim();}catch(e){await writeFile(path.join(job,'private-command-error.json'),JSON.stringify({message:e.message,stdout:e.stdout,stderr:e.stderr}));throw Error('Cleanup paused; private diagnostic: '+job);}};
const sid=await command('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value']);assert(/^S-1-5-[0-9-]+$/.test(sid));
const protect=async dir=>command('icacls.exe',[dir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q']);await protect(job);
await writeFile(path.join(root,'.supabase/desktop-cleanup55/current.json'),JSON.stringify({job,evidence:path.join(job,'evidence.json')}));
const exe=path.resolve('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.55/Agentopia.exe'),e={success:false,at:new Date().toISOString(),job,providerRequests:0,fullGoalComplete:false};const save=()=>writeFile(path.join(job,'evidence.json'),JSON.stringify(e,null,2));await save();
const wsl=async script=>JSON.parse(await command('wsl.exe',['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3',linux(path.join(root,'scripts/desktop',script)),linux((await json(path.join(root,'.supabase/desktop-production-logical/current.json'))).out)]));
try{
 assert((await probeMaintenanceWindowsContext()).success);
 e.normalClose=await closeOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256,ensureIdle:async()=>{assert.equal((await wsl('runtime-maintenance-readiness54.py')).unfinishedRequests,0);}});await save();
 const parent='F:/Agentopia-Data/profiles/retained-roaming-20261021',archive=path.join(parent,'profile');await assert.rejects(access(parent),{code:'ENOENT'});await mkdir(parent);await protect(parent);
 console.log('Archiving applicable inactive Roaming profile data to protected F storage; old tests/caches/runtime redirect are excluded.');
 const python=path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),args=['-I','-B',path.join(root,'desktop/runtime/copy-desktop-profile.py'),'C:/Users/charl/AppData/Roaming/Agentopia',archive,path.join(job,'legacy-copy.json')];
 await new Promise((resolve,reject)=>{const child=spawn(python,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let tail='';child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>tail=(tail+b).slice(-4000));child.once('error',reject);child.once('close',async code=>{await writeFile(path.join(job,'copy-stderr.txt'),tail);code===0?resolve():reject(Error('Legacy archival stopped; source is retained: '+job));});});
 console.log('Independently comparing original seals, retained archive, recovery and previous program rollback.');
 e.preservation=JSON.parse(await command(python,['-I','-B',path.join(root,'scripts/desktop/verify-cleanup55.py'),job],1200000));assert(e.preservation.success);await save();
 const psScript=path.join(root,'scripts/desktop/remove-obsolete-c-copies55.ps1');e.cleanupScriptSha256=await hash(psScript);e.eligibilitySha256=await hash(path.join(job,'eligible.json'));await save();
 console.log('Removing only the explicit verified obsolete C copies; no redirected runtime is traversed.');
 await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',psScript,'-Job',job],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;process.stdout.write(b);});child.once('error',reject);child.once('close',async code=>{await writeFile(path.join(job,'cleanup-console.txt'),output);code===0?resolve():reject(Error('Cleanup stopped; inspect its partial receipt: '+job));});});
 e.cleanup=await json(path.join(job,'cleanup.json'));assert(e.cleanup.success);e.database=await wsl('audit-production-logical.py');assert(e.database.success);e.success=true;
}catch(error){e.error=error.message;process.exitCode=1;}finally{
 try{e.reopened=await reopenOrdinaryAgentopia({expectedExe:exe,expectedImageSha256:proof.imageSha256});}catch(error){e.reopeningError=error.message;e.success=false;process.exitCode=1;}
 await save();
}
console.log(JSON.stringify({success:e.success,job,deletedBytes:e.cleanup?.deletedBytes,deletedFiles:e.cleanup?.deletedFiles,ordinaryReopened:e.reopened?.success,error:e.error}));
