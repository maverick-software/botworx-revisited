import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {_electron,expect} from '@playwright/test';
import {desktopOperation} from './operation-lock.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-workspace-agents'),candidate=path.join(work,'candidate-0440'),rollout=path.join(candidate,'rollout');
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=async file=>{const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');};
const prepared=await json(path.join(rollout,'preparation.json')),cfg=await json(path.join(rollout,'update-config.json'));assert(prepared.success);assert.equal(cfg.version,'0.44.0');
let live=null;try{live=await json(path.join(work,'live-acceptance.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const ready=live?.success===true&&live?.inference===true&&live?.version==='0.44.0'&&live?.imageSha256===cfg.imageSha256;
if(!process.argv.includes('--execute')){console.log(JSON.stringify({version:cfg.version,readyForCoordinatedInstallation:ready,liveAcceptancePresent:!!live,backupCreated:false,installed:false,productionMigrated:false},null,2));process.exit(0);}
assert(ready,'Live agent acceptance for this exact candidate is required before installation.');
assert(process.argv.includes('--coordinated-app-close'),'Coordinate normal app closure and the copied runtime before execution.');
assert.equal(await hash(cfg.image),cfg.imageSha256);assert.equal(await hash(cfg.installer),cfg.installerSha256);assert.equal(await hash(path.join(rollout,'update.cjs')),prepared.updateHelperSha256);
desktopOperation('backup and install verified persistent-agent release');let app;
try{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:require('electron'),args:[path.join(rollout,'update-helper.cjs')],cwd:root,env});await app.firstWindow();await expect.poll(()=>app.evaluate(()=>globalThis.updateDone),{timeout:900000,intervals:[1000]}).toBe(true);const result=await app.evaluate(()=>({error:globalThis.updateError,result:globalThis.updateResult}));assert(!result.error,result.error);assert(result.result.success);console.log(JSON.stringify(result.result,null,2));}
finally{if(app){const child=app.process(),exited=child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve));await app.evaluate(({app})=>app.quit()).catch(()=>{});let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The update helper did not close normally.')),30000);})]);}finally{clearTimeout(timer);}await app.close().catch(()=>{});}}
