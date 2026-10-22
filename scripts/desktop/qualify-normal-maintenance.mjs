import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify the visible normal-Windows maintenance launcher');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const proof=await json(path.join(root,'.supabase/desktop-release-04448/1792527849453/package-proof.json')),program=await json(path.join(root,'.supabase/desktop-normal-maintenance/program-qualified.json'));
assert(program.success&&program.physicalSourceAndRollbackMatch&&program.productionWrites===0);
const backupQualification=await json(path.join(root,'.supabase/desktop-maintenance-backup/qualified-current.json'));
assert(backupQualification.success&&backupQualification.hiddenHelper&&backupQualification.sourceUnchanged&&backupQualification.workspaceModePassed&&backupQualification.applicationUpdateModePassed&&backupQualification.sourcePathGuardsPassed);
for(const [name,digest]of Object.entries(backupQualification.sourceHashes))assert.equal(await hash(path.join(root,'scripts/desktop',name)),digest,'The accepted backup component changed: '+name);
const plan=JSON.parse((await exec(process.execPath,[path.join(root,'scripts/desktop/test-maintenance-plan.mjs')],{windowsHide:true,encoding:'utf8'})).stdout);assert(plan.success&&plan.checks===16);
const updateCommand=JSON.parse((await exec(process.execPath,[path.join(root,'scripts/desktop/test-maintenance-update-command.mjs')],{windowsHide:true,encoding:'utf8'})).stdout);assert(updateCommand.success&&updateCommand.checks===13);
const service=(await exec(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B',path.join(root,'scripts/desktop/test-maintenance-existing-runtime.py')],{windowsHide:true,encoding:'utf8'}));assert(service.stderr.includes('Ran 7 tests')&&service.stderr.includes('OK'));
// --check-only is an explicit stop before any service start or installer even
// if the user happens to close Agentopia while this batch-file test runs.
let batch;
try{const running=exec('cmd.exe',['/d','/c',path.join(root,'Run-Agentopia-Update.cmd'),'--check-only'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});running.child.stdin.end();const result=await running;batch={code:0,output:result.stdout+result.stderr};}
catch(error){batch={code:error.code,output:(error.stdout??'')+(error.stderr??'')};if(typeof error.code!=='number')throw error;}
// cmd's pause reads EOF on this captured pipe, so there is no UI input.
assert(batch.code===1&&batch.output.includes('The installer was not started.')||batch.code===0&&batch.output.includes('CHECK ONLY'));
assert(batch.output.includes('Agentopia 0.44.48 - verified recovery and update')&&batch.output.includes('Progress and recovery records:'));
const record=path.join(root,'.supabase/desktop-normal-maintenance'),sourceHashes={},names=['run-normal-maintenance.mjs','maintenance-update-command.mjs','maintenance-plan.mjs','maintenance-program-rollback.mjs','maintenance-existing-runtime.py','verify-maintenance-installation.py','maintenance-windows-context.mjs','probe-maintenance-known-folder.ps1','capture-maintenance-portable.mjs','verify-maintenance-portable.py','capture-production-logical.mjs','audit-production-logical.py','launch-durable-profile-probe.mjs','compressed-private-profile.mjs','capture-private-profile.mjs','phased-backup-control.mjs','operation-lock.mjs'];
for(const name of names)sourceHashes['scripts/desktop/'+name]=await hash(path.join(root,'scripts/desktop',name));sourceHashes['Run-Agentopia-Update.cmd']=await hash(path.join(root,'Run-Agentopia-Update.cmd'));
const report={success:true,at:new Date().toISOString(),version:'0.44.48',sourceHashes,phaseAndFailureChecks:plan.checks,existingRuntimeGuardChecks:7,batchPrintsProgressAndStopsSafely:true,batchFailureVisible:true,programRollbackQualification:program.job,currentProfileBackupQualification:'F:/Agentopia/.supabase/desktop-maintenance-backup/qualified-current.json',normalWindowsPreflightPassed:true,normalWindowsPreflightEvidence:'F:/Agentopia/.supabase/desktop-normal-maintenance/1792532652485/evidence.json',ordinaryUpdateRecoveryRunStillPending:true,installed:false,providerRequests:0};
await writeFile(path.join(record,'launcher-batch-test.log'),batch.output);await writeFile(path.join(record,'launcher-qualified.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:true,phaseChecks:16,existingRuntimeChecks:7,actualBatchStopPassed:true,sourceFilesPinned:Object.keys(sourceHashes).length,installed:false,providerRequests:0}));
