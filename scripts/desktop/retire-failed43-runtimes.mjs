// Retire only the two stopped, failed 0.44.43 QA backends named below.
// Keep their profiles, diagnostics, source and receipts; ordinary recovery is verified separately.
import {readFile,writeFile,mkdir,lstat,statfs} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {hash,registration,list,run} from './phased-backup-control.mjs';
desktopOperation('retire two verified-terminal failed43 QA runtime disks');
const root=path.resolve(import.meta.dirname,'../..'),qaRoot='C:\\Users\\charl\\AgentopiaQA\\plugin-compatibility',jobs=['1792431624249','1792432538525'],out=path.join(root,'.supabase/desktop-maintenance/retired43');
const json=async file=>JSON.parse(await readFile(file,'utf8')),normal=value=>path.win32.normalize(value.replace(/^\\\\\?\\/, '')).toLowerCase();
const p=await json(path.join(root,'.supabase/desktop-platform-release/candidate-04446/workspace-navigation-proof.json'));
const data=await json(path.join(p.work,'data-before.json'));assert(data.success&&data.mode==='before');
assert.equal(await hash(path.join(p.work,'database.dump')),data.backupSha256);
const recovery=await json('C:/Users/charl/AgentopiaRecovery/before-04446/1792447705031/ordinary-recovery-acceptance.json');assert(recovery.success);
const before={registered:await list(),running:await list(true)},targets=[];
const apps=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue | Select-Object Id,Path)|ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true})).stdout||'[]');
for(const job of jobs){
 const directory=path.join(qaRoot,job),intentFile=path.join(directory,'intent.json'),evidenceFile=path.join(directory,'evidence.json'),intent=await json(intentFile),evidence=await json(evidenceFile);
 assert(evidence.success===false&&intent.version==='0.44.43'&&evidence.phase==='parallel-workflows');
 assert(evidence.pid===intent.pid&&intent.production==='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'&&intent.providerRequests===0&&intent.productionMigrated===false);
 let live=true;try{process.kill(intent.pid,0);}catch(error){if(error.code==='ESRCH')live=false;else throw error;}assert(!live,'The original QA process still exists; inspect it before retirement.');
 const distribution='AgentopiaRuntime-'+intent.instanceId;assert.equal(intent.distribution,distribution);assert(before.registered.includes(distribution)&&!before.running.includes(distribution));
 const reg=await registration(distribution),storage=path.join(directory,'wsl');assert.equal(normal(reg.path),normal(storage));assert.equal(normal(intent.storage),normal(storage));assert.equal(reg.version,2);
 assert((Array.isArray(apps)?apps:[apps]).every(app=>!normal(app.Path??'').startsWith(normal(directory)+path.sep)),'A QA app still uses this job');
 const binding=await json(path.join(intent.profile,'runtime-binding.json'));assert.equal(binding.distribution,distribution);assert.equal(binding.instanceId,intent.instanceId);
 for(let file=storage;;file=path.dirname(file)){assert(!(await lstat(file)).isSymbolicLink());if(file===path.parse(file).root)break;}
 const disk=path.join(storage,'ext4.vhdx'),info=await lstat(disk);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1);
 targets.push({job,distribution,storage,diskBytes:info.size,intentFile,intentSha256:await hash(intentFile),evidenceFile,evidenceSha256:await hash(evidenceFile),originalProcessMissing:true,registeredButStopped:true});
}
await mkdir(out,{recursive:true});
const plan={success:true,at:new Date().toISOString(),targets,before,sourceRecovery:'C:/Users/charl/AgentopiaRecovery/before-04446/1792447705031',latestLogicalRecovery:p.work,latestLogicalRecoverySha256:data.backupSha256,productionPreserved:true,providerRequests:0};
if(!process.argv.includes('--apply')){await writeFile(path.join(out,'plan.json'),JSON.stringify(plan,null,2));console.log(JSON.stringify(plan,null,2));}
else{
 const approved=await json(path.join(out,'plan.json'));assert.deepEqual(targets,approved.targets);assert.deepEqual(before,approved.before);
 for(const target of targets){assert(!(await list(true)).includes(target.distribution));assert.equal(normal((await registration(target.distribution)).path),normal(target.storage));await run(['--unregister',target.distribution],120000);}
 const after={registered:await list(),running:await list(true)};assert.deepEqual(after.running,before.running);assert.deepEqual(after.registered,before.registered.filter(name=>!targets.some(target=>target.distribution===name)));
 const disk=await statfs('C:/'),receipt={...plan,applied:true,after,freeBytes:disk.bavail*disk.bsize,diagnosticsAndProfilesRetained:true};await writeFile(path.join(out,'evidence.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify({success:true,retired:targets.map(target=>target.distribution),freeBytes:receipt.freeBytes,productionPreserved:true}));
}
