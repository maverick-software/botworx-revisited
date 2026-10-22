import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hash,json} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('qualify67-to68 controller with latest accepted instruction editor rollback');
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'scripts/desktop'),exec=promisify(execFile);
const pointer=await json(path.join(root,'.supabase/desktop-agent-apps68-release/current.json')),qualified=await json(path.join(pointer.out,'qualification.json')),verified=await json(path.join(pointer.out,'installer-verified.json')),proof=await json(pointer.proof),packaged=await json(path.join(pointer.out,'packaged-accepted.json')),impact=await json(path.join(pointer.out,'recovery-impact.json')),driver=await json(path.join(root,'.supabase/desktop-scheduled-workspaces67/maintenance-driver-qualified.json')),prior=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified67.json'));
assert(qualified.success&&verified.success&&qualified.version==='0.44.68'&&driver.success&&driver.actualClosedProfileMaintenanceDriver&&prior.success);
assert(packaged.success&&packaged.savedAccountColdReopening&&packaged.scopedAppAssignment&&packaged.coldNoReplay&&impact.recoveryEvidenceInheritedOnIdenticalModules);
assert.equal(packaged.imageSha256,proof.imageSha256);assert.equal(await hash(pointer.proof),qualified.proofSha256);
const verification=await json(verified.evidence);assert(verification.success&&verification.checks.length===4&&verification.imageSha256===proof.imageSha256);assert.equal(verification.pinnedUpdaterSha256,proof.programFiles['squirrel.exe']);
const sourceHashes={},helpers=['run-normal-maintenance68.mjs','normal-maintenance68-process.mjs','maintenance-program-rollback68.mjs','maintenance-update-command68.mjs','verify-maintenance-installation68.py','verify-maintenance-ordinary68.py','test-maintenance-update-command68.mjs'];
const previousHelpers=new Set(helpers.map(name=>name.replace('68','67')));
for(const [name,digest] of Object.entries(prior.sourceHashes)){
 assert(name.startsWith('scripts/desktop/'));if(previousHelpers.has(path.basename(name)))continue;
 assert.equal(await hash(path.join(root,name)),digest,'Accepted maintenance guard changed: '+name);sourceHashes[name]=digest;
}
for(const name of helpers){
 if(name.endsWith('.mjs'))await exec(process.execPath,['--check',path.join(dir,name)],{windowsHide:true,timeout:30000});
 else await exec(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B','-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8-sig").read())',path.join(dir,name)],{windowsHide:true,timeout:30000});
 sourceHashes['scripts/desktop/'+name]=await hash(path.join(dir,name));
}
assert.equal(await hash(path.join(dir,'verify-maintenance-ordinary68.py')),await hash(path.join(dir,'verify-maintenance-ordinary67.py')),'The accepted independent capability12 verifier is unchanged.');
const tests=JSON.parse((await exec(process.execPath,[path.join(dir,'test-maintenance-update-command68.mjs')],{windowsHide:true,timeout:30000})).stdout);assert(tests.success&&tests.checks===13);
const overlayPointer=await json(path.join(root,'.supabase/desktop-instruction-editor67/current.json')),overlayFile=path.join(overlayPointer.out,'installed.json'),overlay=await json(overlayFile);assert(overlay.success&&Object.keys(overlay.uiFiles).length===223);
const rollback=await readFile(path.join(dir,'maintenance-program-rollback68.mjs'),'utf8');assert(rollback.includes('desktop-instruction-editor67/current.json')&&rollback.includes("app-0.44.67"));
const result={success:true,at:new Date().toISOString(),version:'0.44.68',previousVersion:'0.44.67',sourceHashes,installerVerified:verified.evidence,packagedAccepted:path.join(pointer.out,'packaged-accepted.json'),updateCommandChecks:tests.checks,reusedUnchangedPhaseFailureChecks:prior.reusedUnchangedPhaseFailureChecks,reusedUnchangedExistingRuntimeChecks:prior.reusedUnchangedExistingRuntimeChecks,capability12Driver:driver.checks,recoveryImpact:path.join(pointer.out,'recovery-impact.json'),installedUiOverlay:overlayFile,standingUpdateAndRestartAuthorization:true,autonomousNormalClosure:true,freshRecoveryAndPhysicalRollbackRequiredBeforeInstall:true,ordinaryReopeningHandledByController:true,selectedProfile:'F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',installed:false,fullGoalComplete:false};
await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified68.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:result.version,sourceFiles:Object.keys(sourceHashes).length,updateCommandChecks:tests.checks,rollbackUiFiles:Object.keys(overlay.uiFiles).length,installed:false}));
