import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,readFile,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('qualify70-to71 maintenance with exact installed rollback and schema71 recovery');
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'scripts/desktop'),exec=promisify(execFile);
const pointer=await json(path.join(root,'.supabase/desktop-recovery71-release/current.json')),proof=await json(pointer.proof);
const qualification=await json(path.join(pointer.out,'qualification.json')),verified=await json(path.join(pointer.out,'installer-verified.json'));
const native=await json(path.join(path.dirname(proof.candidateProof),'packaged-accepted.json')),recovery=await json(proof.wholeProfileRecovery);
const prior=await json(path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified70.json'));
const driver=await json(path.join(root,'.supabase/desktop-scheduled-workspaces67/maintenance-driver-qualified.json'));
assert(proof.version==='0.44.71'&&qualification.success&&verified.success&&prior.success&&driver.success&&driver.actualClosedProfileMaintenanceDriver);
assert(native.success&&native.actualCodexHarness&&native.actualInFlightArchiveRevocation&&native.actualInFlightReplacementRevocation&&native.coldModelRequests===0&&native.providerBoundImageMatchesPreviouslyVerifiedExactUrl);
assert(recovery.success&&recovery.wholeAppColdRecovery&&recovery.actualPasswordSignIn&&recovery.retainedCurrentOriginalsRestored===3&&recovery.retainedPreviousOriginalsRestored===2&&recovery.originalSourceHomeUnavailable);
for(const e of [native,recovery,verified])assert.equal(e.imageSha256??proof.imageSha256,proof.imageSha256);
assert.equal(await hash(pointer.proof),qualification.proofSha256);assert.equal(await hash(proof.image),proof.imageSha256);
const installerEvidence=await json(verified.evidence);
assert(installerEvidence.success&&installerEvidence.checks.length===4&&installerEvidence.imageSha256===proof.imageSha256&&installerEvidence.pinnedUpdaterSha256===proof.programFiles['squirrel.exe']);
const names=['run-normal-maintenance71.mjs','normal-maintenance71-process.mjs','maintenance-program-rollback71.mjs','maintenance-update-command71.mjs',
 'verify-maintenance-installation71.py','verify-maintenance-ordinary71.py','test-maintenance-update-command71.mjs','accept-installed71.mjs','audit-agent-health71.mjs','audit-agent-health71.py','audit-installed-credentials71.mjs','audit-maintenance-logical71.py','audit_logical_transition72.py','audit_logical_snapshot71.py','logical_row_fingerprints71.py'];
const priorVersioned=new Set(names.map(name=>name.replace('71','70'))),sourceHashes={};
for(const [name,digest]of Object.entries(prior.sourceHashes)){
 assert(name.startsWith('scripts/desktop/'));if(priorVersioned.has(path.basename(name)))continue;
 assert.equal(await hash(path.join(root,name)),digest,'Accepted maintenance guard changed: '+name);sourceHashes[name]=digest;
}
for(const name of names){
 if(name.endsWith('.mjs'))await exec(process.execPath,['--check',path.join(dir,name)],{windowsHide:true,timeout:30000});
 else await exec(path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),['-I','-B','-c','import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8-sig").read())',path.join(dir,name)],{windowsHide:true,timeout:30000});
 sourceHashes['scripts/desktop/'+name]=await hash(path.join(dir,name));
}
assert.equal(await hash(path.join(dir,'verify-maintenance-ordinary71.py')),await hash(path.join(dir,'verify-maintenance-ordinary70.py')));
const tests=JSON.parse((await exec(process.execPath,[path.join(dir,'test-maintenance-update-command71.mjs')],{windowsHide:true,timeout:30000})).stdout);
assert(tests.success&&tests.checks===13);
const rollback=await readFile(path.join(dir,'maintenance-program-rollback71.mjs'),'utf8');
assert(rollback.includes("base.version==='0.44.70'")&&rollback.includes('rootFiles')&&!rollback.includes('desktop-agent-editor-alignment68'));
await copyFile(path.join(path.dirname(proof.candidateProof),'packaged-accepted.json'),path.join(pointer.out,'packaged-accepted.json'));
const transitionFile=(await json(path.join(root,'.supabase/desktop-logical-transition72/qualified-current.json'))).evidence,transition=await json(transitionFile);assert(transition.success&&transition.unitCases===14&&transition.realDatabaseChecks===5);for(const[name,digest]of Object.entries(transition.sourceHashes))assert.equal(await hash(path.join(dir,name)),digest,name);
const e={success:true,at:new Date().toISOString(),version:proof.version,previousVersion:'0.44.70',sourceHashes,transitionQualification:transitionFile,
 installerVerified:verified.evidence,wholeProfileRecovery:proof.wholeProfileRecovery,packagedAccepted:path.join(pointer.out,'packaged-accepted.json'),
 updateCommandChecks:13,reusedUnchangedPhaseFailureChecks:prior.reusedUnchangedPhaseFailureChecks,reusedUnchangedExistingRuntimeChecks:prior.reusedUnchangedExistingRuntimeChecks,
 capability12Driver:driver.checks,rollbackIncludesInstalledProgramAndRootLaunchers:true,standingUpdateAndRestartAuthorization:true,
 autonomousNormalClosure:true,freshRecoveryAndPhysicalRollbackRequiredBeforeInstall:true,ordinaryReopeningHandledByController:true,
 selectedProfile:'F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile',schema72LibraryAuditRequired:true,installed:false,fullGoalComplete:false};
const file=path.join(root,'.supabase/desktop-normal-maintenance/launcher-qualified71.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:e.version,sourceFiles:Object.keys(sourceHashes).length,updateCommandChecks:13,installed:false}));
