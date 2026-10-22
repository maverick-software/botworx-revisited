// Reset the shared WSL machine only when all distributions and Agentopia are closed.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {closed,list,run,registration} from './phased-backup-control.mjs';
desktopOperation('reset stopped WSL machine after verified production recovery');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),saved=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-closed54.json')),recovery=await json(saved.evidence),instance='a91a4800-e08f-4440-a4ec-588762d01bfd',distribution='AgentopiaRuntime-'+instance;
assert(recovery.success&&recovery.independent.success&&recovery.normalClose.exited&&!recovery.normalClose.forcedTermination);await closed();assert.deepEqual(await list(true),[]);
const registered=await registration(distribution);assert.equal(path.resolve(registered.path).replace(/^\\\\\?\\/,'').toLowerCase(),path.resolve('F:/Agentopia-Data/runtime/'+instance).toLowerCase());
const evidence={success:false,at:new Date().toISOString(),recovery:saved.evidence,beforeRunning:[],registration:registered,providerRequests:0};
try{await run(['--shutdown'],45000);evidence.sharedMachineShutdownCompleted=true;console.log('Stopped WSL machine reset completed. Starting original runtime identity check.');
 const identity=(await run(['-d',distribution,'-u','root','--cd','/','--exec','sh','-c','cat /opt/agentopia/runtime-identity; cat /opt/agentopia/runtime-instance'],85000)).split(/\r?\n/);assert.deepEqual(identity,['local.agentopia.desktop-runtime.v1',instance]);evidence.originalRuntimeIdentityVerified=true;evidence.afterRunning=await list(true);assert.deepEqual(evidence.afterRunning,[distribution]);evidence.success=true;
}catch(error){evidence.error=error.message;evidence.cause=error.cause?.message;process.exitCode=1;}
await writeFile(path.join(saved.out,'runtime-reset.json'),JSON.stringify(evidence,null,2),{flag:'wx'});console.log(JSON.stringify(evidence));
