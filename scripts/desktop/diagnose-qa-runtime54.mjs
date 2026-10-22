import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list,registration} from './phased-backup-control.mjs';

desktopOperation('inspect selected stopped QA runtime startup54');
const root=path.resolve(import.meta.dirname,'../..'),json=async file=>JSON.parse(await readFile(file,'utf8')),pointer=await json(path.join(root,'.supabase/desktop-profile-release54/current.json')),proof=await json(pointer.proof),retained=await json(path.join(proof.out,'restored-relocation-current.json')),cfg=await json(retained.intent),exec=promisify(execFile),out=path.join(cfg.out,'startup-diagnostic-'+Date.now());
assert(cfg.emptyRuntimeVerified&&cfg.registered);assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),proof.imageSha256);assert.equal(cfg.distribution,'AgentopiaRuntime-'+cfg.instance);assert(cfg.out.startsWith(proof.out+path.sep));assert.deepEqual(await registration(cfg.distribution),cfg.registration);await mkdir(out);
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'').trim(),e={success:false,at:new Date().toISOString(),out,intent:retained.intent,distribution:cfg.distribution,beforeRunning:await list(true),selectedRuntimeOnly:true,productionRuntimeRestarted:false,modelRequests:0};
try{
 assert(!e.beforeRunning.includes(cfg.distribution));const observed=await exec(path.join(process.env.SystemRoot,'System32/wsl.exe'),['--distribution',cfg.distribution,'--user','root','--cd','/','--exec','sh','-c','cat /opt/agentopia/runtime-identity; cat /opt/agentopia/runtime-instance'],{cwd:path.join(process.env.SystemRoot,'System32'),windowsHide:true,encoding:'buffer',timeout:85000,maxBuffer:1024*1024});
 const lines=decode(observed.stdout).split(/\r?\n/);assert.deepEqual(lines,['local.agentopia.desktop-runtime.v1',cfg.instance]);e.success=true;e.identityVerified=true;
}catch(error){e.error=String(error.message).split('\n')[0];e.stdout=decode(error.stdout??Buffer.alloc(0));e.stderr=decode(error.stderr??Buffer.alloc(0));e.processKilled=error.killed===true;e.code=error.code;}
e.afterRunning=await list(true);assert(e.afterRunning.includes(cfg.production));await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));await writeFile(path.join(proof.out,'qa-startup-diagnostic-current.json'),JSON.stringify({success:e.success,out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify(e));
