// Wait for the observed connection expiry, then use the normal renewal path.
// Every child inherits the operation lock; no completed inference is resubmitted.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {json} from './phased-backup-control.mjs';
desktopOperation('qualified browser-continuity acceptance after natural access expiry');
const root=path.resolve(import.meta.dirname,'../..'),current=path.join(root,'.supabase/desktop-live-browser-compaction67/current.json'),readiness=async()=>json((await json(path.join(root,'.supabase/desktop-live-readiness64/current.json'))).evidence),initial=await readiness();assert(initial.success&&initial.accounts.length===1);try{await lstat(current);throw Error('Inspect the existing browser-continuity intent without replay.');}catch(error){if(error.code!=='ENOENT')throw error;}
const run=name=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(import.meta.dirname,name)],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','inherit','inherit']});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(name+' stopped with '+code+'; inspect its existing evidence.')));});
const deadline=Date.parse(initial.accounts[0].chatgpt.expiresAt)+1500;assert(Number.isFinite(deadline)&&deadline<Date.now()+15*60000);console.log('Waiting for the observed ChatGPT access expiry at '+initial.accounts[0].chatgpt.expiresAt+'; no model request has started.');while(Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,Math.min(30000,deadline-Date.now())));
await run('inspect-live-readiness64.mjs');const observed=await readiness();assert.equal(observed.accounts[0].owner,initial.accounts[0].owner);if(observed.accounts[0].chatgpt.expired){await run('renew-primary-chatgpt65.mjs');await run('inspect-live-readiness64.mjs');}const fresh=await readiness();assert.equal(fresh.accounts[0].owner,initial.accounts[0].owner);assert(fresh.accounts[0].chatgpt.freshForTenMinutes);await run('test-live-browser-compaction67.mjs');
