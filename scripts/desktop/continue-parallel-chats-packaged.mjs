import {_electron,expect} from '@playwright/test';
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {run,list,registration,linux} from './phased-backup-control.mjs';
import {installCoordinationGuard} from './coordination-controlled-workflows.mjs';
import {observeParallelInputs,runParallelChats,verifyParallelReopen} from './parallel-chat-workflows.mjs';

desktopOperation('continue retained isolated simultaneous chat acceptance');
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'.supabase/desktop-packaged-coordination/1792371345282');
const json=async p=>JSON.parse(await readFile(p,'utf8')),cfg=await json(path.join(base,'intent.json')),prior=await json(path.join(base,'evidence.json'));
assert.equal(cfg.version,'0.44.29');assert.equal(cfg.schema,69);assert.equal(cfg.distribution,'AgentopiaRuntime-'+cfg.instanceId);
assert(prior.success===false&&prior.failureClosedNormally);
const out=path.join(base,'parallel-continuation-'+Date.now());await mkdir(out);
const hash=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const executable=path.join(base,'program/Agentopia.exe'),image=path.join(base,'program/resources/app.asar'),resources=path.join(base,'program/resources/resources');
assert.equal(await hash(image),cfg.imageSha256);
assert.equal((await realpath(cfg.profile)).toLowerCase(),cfg.profile.toLowerCase());assert.equal(path.basename(cfg.profile),'pc-'+cfg.instanceId);
const binding=await json(path.join(cfg.profile,'runtime-binding.json'));assert.equal(binding.distribution,cfg.distribution);assert.equal(binding.instanceId,cfg.instanceId);
const before={registered:await list(false),running:await list(true)};assert(before.registered.includes(cfg.distribution));assert(!before.running.includes(cfg.distribution));assert(before.running.includes(cfg.production));
async function owned(){const r=await registration(cfg.distribution);assert.equal(r.version,2);assert.equal(path.win32.normalize(r.path.replace(/^\\\\\?\\/,'' )).toLowerCase(),cfg.storage.toLowerCase());assert.equal(path.dirname(cfg.storage).toLowerCase(),base.toLowerCase());return r;}
await owned();
for(const name of ['continue-parallel-chats-packaged.mjs','parallel-chat-workflows.mjs','coordination-controlled-workflows.mjs'])await copyFile(path.join(root,'scripts/desktop',name),path.join(out,name));
const evidence={at:new Date().toISOString(),version:cfg.version,schema:69,imageSha256:cfg.imageSha256,phase:'prepared',out,profile:cfg.profile,distribution:cfg.distribution,priorEvidence:path.join(base,'evidence.json'),priorEvidenceSha256:await hash(path.join(base,'evidence.json')),before,checks:[],providerRequests:0,installed:false,productionMigrated:false};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
const check=async text=>{evidence.checks.push(text);await save();console.log('PASS: '+text);};await save();
const require=createRequire(path.join(base,'archived/package.json')),{Runtime}=require('./build/runtime.js'),runtime=new Runtime(resources,cfg.profile,()=>{});
let application,removed=false;
async function launch(label){
 const env={...process.env,AGENTOPIA_TEST_PROFILE:path.basename(cfg.profile),PATH:process.env.SystemRoot+'\\System32;'+process.env.SystemRoot};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:executable,cwd:os.tmpdir(),env,timeout:60000});
 await installCoordinationGuard(application);await observeParallelInputs(application);
 const info=await application.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,path:app.getAppPath(),exe:app.getPath('exe'),profile:app.getPath('userData')}));
 assert(info.packaged&&info.version===cfg.version);assert.equal(info.exe.toLowerCase(),executable.toLowerCase());assert.equal(info.path.toLowerCase(),image.toLowerCase());assert.equal((await realpath(info.profile)).toLowerCase(),cfg.profile.toLowerCase());
 const page=await application.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect.poll(()=>page.evaluate(()=>window.agentopia?.call('runtime.status')??{ready:false}),{timeout:180000}).toMatchObject({ready:true});
 await expect(page.getByRole('button',{name:'Account menu',exact:true})).toBeVisible({timeout:30000});
 assert.deepEqual(await application.evaluate(()=>globalThis.__coordination.calls),[]);
 evidence[label]={info,errors};await save();return page;
}
async function close(){
 const child=application.process(),exited=child.exitCode!==null?Promise.resolve():new Promise(r=>child.once('exit',r));
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 let t;try{await Promise.race([exited,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Normal QA closure timed out')),60000);})]);}finally{clearTimeout(t);}
 assert.equal(child.exitCode,0);application=undefined;assert(!(await list(true)).includes(cfg.distribution));
}
try{
 let page=await launch('firstLaunch');
 evidence.priorRequestOutcomes=await application.evaluate(async(_,ids)=>{const r=await globalThis.__coordination.broker.admin.from('desktop_requests').select('id,status').in('id',ids);if(r.error)throw Error(r.error.message);return r.data;},Object.values(prior.parallel.requests));
 assert.equal(evidence.priorRequestOutcomes.length,2);
 assert(evidence.priorRequestOutcomes.every(r=>['cancelled','interrupted'].includes(r.status)));await save();
 await page.evaluate(()=>window.agentopia.call('auth.signOut'));await page.goto('agentopia://app/login');await expect(page.getByLabel('Email address',{exact:true})).toBeVisible();
 evidence.phase='parallel-workflows';await save();await runParallelChats({application,page,runtime,out,evidence,save,check});
 assert(Object.values(evidence.parallel.requests).every(id=>!Object.values(prior.parallel.requests).includes(id)));
 assert(evidence.parallel.modelInputs.every(r=>!r.input.includes(evidence.parallel.markers.draftA)&&!r.input.includes(evidence.parallel.markers.draftB)));
 await expect.poll(()=>application.evaluate(()=>globalThis.__coordination.broker.active.size+globalThis.__coordination.broker.goals.size),{timeout:30000}).toBe(0);
 assert.deepEqual(evidence.firstLaunch.errors,[]);await close();
 evidence.phase='cold-reopen';await save();page=await launch('secondLaunch');await verifyParallelReopen({application,page,out,evidence,save,check});
 evidence.preservationAudit=JSON.parse(await runtime.command(['python3',linux(path.join(base,'audit-coordination-runtime.py')),linux(base)],60000));assert(evidence.preservationAudit.success);
 assert.deepEqual(evidence.secondLaunch.errors,[]);await close();
 evidence.phase='unpin-reopen';await save();page=await launch('thirdLaunch');await verifyParallelReopen({application,page,out,evidence,save,check,unpinned:true});assert.deepEqual(evidence.thirdLaunch.errors,[]);await close();
 await owned();await run(['--unregister',cfg.distribution],120000);removed=true;
 assert.deepEqual((await list(false)).sort(),before.registered.filter(n=>n!==cfg.distribution).sort());assert.deepEqual((await list(true)).sort(),before.running.sort());
 assert.equal(await hash(image),cfg.imageSha256);evidence.disposableRuntimeRemoved=true;
 await check('The tested archive remains unchanged, all original restored rows and readable vault entries survive, and only this owned QA runtime is removed.');
 evidence.phase='completed';evidence.success=true;await save();console.log(JSON.stringify({success:true,out,evidence:path.join(out,'evidence.json'),checks:evidence.checks,providerRequests:0},null,2));
}catch(error){
 evidence.success=false;evidence.error=error.message;
 if(application){try{evidence.failureRuntime=await application.evaluate(()=>({calls:globalThis.__coordination.calls,errors:globalThis.__coordination.errors,blocked:globalThis.__coordination.blocked,trace:globalThis.__coordination.trace}));const p=await application.firstWindow();await p.screenshot({path:path.join(out,'failure.png')});await writeFile(path.join(out,'failure-aria.txt'),await p.locator('body').ariaSnapshot());}catch{}}
 await save();throw error;
}finally{
 if(application){try{await close();evidence.closedNormally=true;}catch{await application?.close().catch(()=>{});evidence.closedNormally=false;}}
 if(!removed&&(await list(true)).includes(cfg.distribution)){await owned();await run(['-d',cfg.distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stop']).catch(()=>{});await run(['--terminate',cfg.distribution]);evidence.failureRuntimeStopped=true;}
 await save();
}
