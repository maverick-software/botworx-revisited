import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json} from './phased-backup-control.mjs';
desktopOperation('renew original access when due, then run one fresh useful-work endurance acceptance');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-endurance144');await mkdir(records,{recursive:true});
const file=path.join(records,'runner.json'),e={at:new Date().toISOString(),pid:process.pid,phase:'inspecting-access',submitted:false,finished:false},save=()=>writeFile(file,JSON.stringify(e,null,2));await save();
const run=(script,args=[])=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts/desktop',script),...args],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','inherit','inherit']});e.childPid=child.pid;e.childScript=script;void save();child.once('error',reject);child.once('exit',code=>{e.childPid=null;code===0?resolve():reject(Error(script+' stopped with code '+code+'; inspect its retained evidence before any retry.'));});});
try{
 await run('inspect-live-readiness76.mjs',['--installed']);let ready=await json((await json(path.join(root,'.supabase/desktop-live-readiness76/current.json'))).evidence);assert(ready.success&&ready.accounts.length===1&&ready.ordinarySourceUnchanged);
 const access=ready.accounts[0].chatgpt;assert(access.tokenPresent&&access.refreshTokenPresent&&!access.renewalReceiptPresent&&access.savedIssueKind===null);
 if(Date.parse(access.expiresAt)<=Date.now()+45*60000){
  e.phase='waiting-for-current-access-expiry';e.currentAccessExpiresAt=access.expiresAt;e.noInferenceSubmitted=true;await save();console.log('Waiting for the original OAuth access expiry at '+access.expiresAt+' before its qualified renewal; no task submitted.');
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(access.expiresAt)-Date.now()+2000)));
  e.phase='checking-expired-access';await save();await run('inspect-live-readiness76.mjs',['--installed']);ready=await json((await json(path.join(root,'.supabase/desktop-live-readiness76/current.json'))).evidence);
  if(ready.accounts[0].chatgpt.expired){e.phase='renewing-original-store';await save();await run('renew-primary-chatgpt76.mjs',['--installed']);await run('inspect-live-readiness76.mjs',['--installed']);}
 }
 ready=await json((await json(path.join(root,'.supabase/desktop-live-readiness76/current.json'))).evidence);assert(Date.parse(ready.accounts[0].chatgpt.expiresAt)>Date.now()+45*60000,'Current access still cannot cover this acceptance; no task was submitted.');
 e.phase='starting-fresh-work-controller';e.submitted=true;await save();await run('test-useful-endurance144.mjs');
 e.phase='controller-finished';e.finished=true;await save();
}catch(error){e.phase='stopped-inspect-without-replay';e.error=error.message;e.finished=true;await save();process.exitCode=1;console.error(e.error);}
