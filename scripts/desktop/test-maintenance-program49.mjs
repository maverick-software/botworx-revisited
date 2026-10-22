// Read the active program without closing it; write only a rollback on F:.
// The actual launcher separately requires normal closure before this step.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {captureMaintenanceProgram} from './maintenance-program-rollback49.mjs';
import {linux} from './phased-backup-control.mjs';
desktopOperation('qualify the active-program rollback and existing-runtime identity checks');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),packageProof=path.join(root,'.supabase/desktop-release-04449/1792536883499/package-proof.json'),proof=JSON.parse(await readFile(packageProof,'utf8'));
const job=path.join(root,'.supabase/desktop-normal-maintenance',String(Date.now()));await mkdir(job,{recursive:true});
const sid=(await exec('powershell.exe',['-NoProfile','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await exec('icacls.exe',[job,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
await writeFile(path.join(job,'intent.json'),JSON.stringify({out:job,packageProof,qualificationOnly:true,productionWrites:false},null,2));
console.log('Checking existing runtime identity without starting or stopping its services.');
const prefix=['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3'];
const observed=JSON.parse((await exec('wsl.exe',[...prefix,linux(path.join(root,'scripts/desktop/maintenance-existing-runtime49.py')),'observe',linux(path.join(proof.assets,'runtime/database_state.py')),linux(job)],{windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:1024*1024})).stdout);assert(observed.success&&!observed.existingServicesStarted);
console.log('Retaining and checking the applicable active program on F:.');
const rollback=await captureMaintenanceProgram({job,proof});
const physical=JSON.parse((await exec('wsl.exe',[...prefix,linux(path.join(root,'scripts/desktop/verify-maintenance-installation49.py')),'rollback',linux(job)],{windowsHide:true,encoding:'utf8',timeout:300000,maxBuffer:1024*1024})).stdout);assert(physical.success);
const report={success:true,at:new Date().toISOString(),job,programFiles:physical.physicalFilesVerified,reusedApplicableFiles:rollback.reusedApplicableFiles,copiedActiveFiles:rollback.copiedActiveFiles,physicalSourceAndRollbackMatch:true,identityAndRootBindingsVerified:true,productionWrites:0,providerRequests:0};
await writeFile(path.join(job,'qualification.json'),JSON.stringify(report,null,2));await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/program-qualified49.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
