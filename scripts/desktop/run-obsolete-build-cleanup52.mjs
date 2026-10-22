// Launched through normal Explorer so AppData operations reach physical files.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {probeMaintenanceWindowsContext} from './maintenance-windows-context.mjs';
import {hash,run} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??''),json=async f=>JSON.parse((await readFile(f,'utf8')).replace(/^\uFEFF/,'')),exec=promisify(execFile);assert.equal(path.dirname(out),path.join(root,'.supabase/desktop-obsolete-builds52'));
const e={success:false,at:new Date().toISOString(),out,providerRequests:0};
try{
 desktopOperation('delete the two checked inactive Windows builds while preserving current data and rollback');
 const accepted=await json(path.join(root,'.supabase/desktop-runtime-relocation52/accepted.json'));assert(accepted.success&&accepted.agentsPreserved&&accepted.originalProfileAndBindingPreserved);
 const context=await probeMaintenanceWindowsContext();await writeFile(path.join(out,'windows-context.json'),JSON.stringify(context,null,2));assert(context.success,'A normal Explorer-launched Windows process is required.');
 const script=path.join(root,'scripts/desktop/remove-inactive-windows-builds52.ps1'),args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-OutputDirectory',out];
 const first=await exec('powershell.exe',args,{windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:1024*1024});await writeFile(path.join(out,'plan.log'),first.stdout+first.stderr);const plan=await json(path.join(out,'plan.json'));assert(plan.success&&!plan.executed&&plan.targets.length===2&&plan.deleted.length===0&&plan.rollbackFilesVerified===7328);assert.equal(await hash(script),plan.scriptSha256);e.planVerified=true;await writeFile(path.join(out,'controller.json'),JSON.stringify(e,null,2));
 const second=await exec('powershell.exe',[...args,'-Execute'],{windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:1024*1024});await writeFile(path.join(out,'execution.log'),second.stdout+second.stderr);const result=await json(path.join(out,'evidence.json'));assert(result.success&&result.executed&&result.deleted.length===2&&result.rollbackFilesVerified===7328);
 const physical=JSON.parse(await run(['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','-c',"from pathlib import Path;import json;roots=[Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.51'),Path('/mnt/c/Users/charl/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local/AgentopiaDesktop/app-0.44.43')];print(json.dumps({'deletedAbsent':[not p.exists() for p in roots],'currentPresent':Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.52/resources/app.asar').is_file(),'profilePresent':Path('/mnt/c/Users/charl/.agentopia/desktop/profile/credentials.bin').is_file()}))"]));assert(physical.deletedAbsent.every(Boolean)&&physical.currentPresent&&physical.profilePresent);e.physical=physical;e.deletedFileBytes=result.deletedFileBytes;e.freeBytesIncrease=result.afterFreeBytes-result.beforeFreeBytes;e.success=true;
}catch(error){e.error=error.stack;if(error.stdout||error.stderr)await writeFile(path.join(out,'private-controller-error.json'),JSON.stringify({stdout:error.stdout,stderr:error.stderr},null,2));process.exitCode=1;}
await writeFile(path.join(out,'controller.json'),JSON.stringify(e,null,2));
