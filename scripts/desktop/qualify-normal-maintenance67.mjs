// Bind the ordinary updater to accepted shared guards, the current installer,
// and the capability12 maintenance driver; never operate the ordinary profile.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hash} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('qualify ordinary source67 maintenance controller');
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'scripts/desktop'),json=async p=>JSON.parse(await readFile(p,'utf8')),exec=promisify(execFile);
const pointer=await json(path.join(root,'.supabase/desktop-scheduled-workspaces67-release/current.json')),qualified=await json(path.join(pointer.out,'qualification.json')),verified=await json(path.join(pointer.out,'installer-verified.json')),proof=await json(pointer.proof),driver=await json(path.join(root,'.supabase/desktop-scheduled-workspaces67/maintenance-driver-qualified.json')),prior=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified66.json'));
assert(qualified.success&&verified.success&&qualified.version==='0.44.67'&&driver.success&&driver.actualClosedProfileMaintenanceDriver);assert.equal(await hash(pointer.proof),qualified.proofSha256);assert.equal(proof.programFiles['squirrel.exe'],'76359cd4b0349a83337b941332ad042c90351c2bb0a4628307740324c97984cc');
const verification=await json(verified.evidence);assert(verification.success&&verification.checks.length===4&&verification.imageSha256===proof.imageSha256);assert.equal(verification.pinnedUpdaterSha256,proof.programFiles['squirrel.exe']);
const sourceHashes={},replaced=new Set(['run-normal-maintenance66.mjs','normal-maintenance66-process.mjs','maintenance-program-rollback66.mjs','maintenance-update-command66.mjs','verify-maintenance-installation66.py','verify-maintenance-portable66.py']);
for(const [name,digest]of Object.entries(prior.sourceHashes)){
 if(!name.startsWith('scripts/desktop/')||replaced.has(path.basename(name)))continue;
 const accepted=driver.sourceHashes[name]??digest;assert.equal(await hash(path.join(root,name)),accepted,'Shared maintenance source drift: '+name);sourceHashes[name]=accepted;
}
for(const [name,digest]of Object.entries(driver.sourceHashes)){
 if(!['capture-maintenance-portable.mjs','launch-durable-profile-probe.mjs','capture-private-profile.mjs','compressed-private-profile.mjs'].includes(path.basename(name)))continue;
 assert.equal(await hash(path.join(root,name)),digest);sourceHashes[name]=digest;
}
const helpers=['run-normal-maintenance67.mjs','normal-maintenance67-process.mjs','maintenance-program-rollback67.mjs','maintenance-update-command67.mjs','verify-maintenance-installation67.py','verify-maintenance-ordinary67.py','test-maintenance-update-command67.mjs'];
for(const name of helpers){
 if(name.endsWith('.mjs'))await exec(process.execPath,['--check',path.join(dir,name)],{windowsHide:true,timeout:30000});
 else await exec(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B','-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8-sig").read())',path.join(dir,name)],{windowsHide:true,timeout:30000});
 sourceHashes['scripts/desktop/'+name]=await hash(path.join(dir,name));
}
const tests=JSON.parse((await exec(process.execPath,[path.join(dir,'test-maintenance-update-command67.mjs')],{windowsHide:true,timeout:30000})).stdout);assert(tests.success&&tests.checks===13);
// Preserve the earlier qualification before recording the corrected verifier.
const correction=path.join(pointer.out,'qualification-before-verifier-case-fix.json');
await writeFile(correction,JSON.stringify(qualified,null,2),{flag:'wx'});
qualified.sourceHashes['verify-scheduled-workspaces-installer67.mjs']=await hash(path.join(dir,'verify-scheduled-workspaces-installer67.mjs'));
qualified.verifierCaseCorrection={packagedUpdaterPath:'lib/net45/squirrel.exe',candidateUpdaterHashUnchanged:true,installerUnchanged:true,allFourVerificationChecksPassed:verified.evidence,priorQualification:correction};
await writeFile(path.join(pointer.out,'qualification.json'),JSON.stringify(qualified,null,2));
const result={success:true,at:new Date().toISOString(),version:'0.44.67',sourceHashes,installerVerified:verified.evidence,updateCommandChecks:tests.checks,reusedUnchangedPhaseFailureChecks:prior.reusedUnchangedPhaseFailureChecks,reusedUnchangedExistingRuntimeChecks:prior.reusedUnchangedExistingRuntimeChecks,capability12Driver:driver.checks,standingUpdateAndRestartAuthorization:true,autonomousNormalClosure:true,freshRecoveryAndPhysicalRollbackRequiredBeforeInstall:true,ordinaryReopeningHandledByController:true,selectedProfile:'F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',installed:false};
await writeFile(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified67.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:result.version,sourceFiles:Object.keys(sourceHashes).length,updateCommandChecks:tests.checks,installed:false}));
