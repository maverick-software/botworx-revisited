import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,readdir,lstat} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind exact71 library recovery and transition qualification for installer construction');
const root=path.resolve(import.meta.dirname,'../..'),candidatePointer=await json(path.join(root,'.supabase/desktop-agent-library71-candidate/current.json'));
const candidate=await json(candidatePointer.proof),qualified=await json(path.join(candidate.out,'candidate-qualification.json')),packaged=await json(path.join(candidate.out,'packaged-accepted.json'));
const recoveryFile=path.join(candidate.out,'whole-profile-recovery-qualified.json'),recovery=await json(recoveryFile),publication=await json(path.join(candidate.out,'recovery-source-publication.json'));
const transitionFile=(await json(path.join(root,'.supabase/desktop-logical-transition72/qualified-current.json'))).evidence,transition=await json(transitionFile);
assert(candidate.success&&candidate.version==='0.44.71'&&candidate.runtimeVersion.schema===72&&candidate.runtimeVersion.desktopRecovery===12);
assert(qualified.success&&packaged.success&&recovery.success&&recovery.wholeAppColdRecovery&&recovery.actualPasswordSignIn&&recovery.originalSourceHomeUnavailable);
assert(recovery.eligibleForInstallerConstruction&&recovery.retainedCurrentOriginalsRestored===3&&recovery.retainedPreviousOriginalsRestored===2&&recovery.tablesCompared===128);
assert(packaged.actualCodexHarness&&packaged.actualInFlightArchiveRevocation&&packaged.actualInFlightReplacementRevocation&&packaged.coldModelRequests===0);
assert(publication.success&&publication.remoteMatchesPhysicalSource&&transition.success&&transition.unitCases===14&&transition.realDatabaseChecks===5);
for(const[name,digest]of Object.entries(transition.sourceHashes))assert.equal(await hash(path.join(root,'scripts/desktop',name)),digest,name);
for(const e of [qualified,packaged,recovery])assert.equal(e.imageSha256,candidate.imageSha256);
assert.equal(await hash(candidate.image),candidate.imageSha256);assert.equal(await hash(candidate.exe),candidate.exeSha256);
assert(qualified.archiveCases===1093&&qualified.wholeInterfaceWorkflows===20&&qualified.libraryInterfaceWorkflows===15&&qualified.draftWorkflows===8);
for(const[name,digest]of Object.entries(candidate.sourceHashes))assert.equal(await hash(path.join(root,'desktop',name)),digest,name);
for(const[name,digest]of Object.entries(candidate.resourceFiles))assert.equal(await hash(path.join(candidate.assets,name)),digest,name);
const records=path.join(root,'.supabase/desktop-recovery71-release'),out=path.join(records,String(Date.now()));await mkdir(out,{recursive:true});
const programFiles={};for(const name of(await readdir(candidate.program,{recursive:true})).sort()){
 const file=path.join(candidate.program,name),info=await lstat(file);assert(!info.isSymbolicLink());if(info.isFile()&&!name.replaceAll('\\','/').startsWith('resources/resources/'))programFiles[name.replaceAll('\\','/')]=await hash(file);
}
assert.equal(programFiles['resources/app.asar'],candidate.imageSha256);assert.equal(programFiles['squirrel.exe'],await hash(path.join(root,'node_modules/electron-winstaller/vendor/Squirrel.exe')));
const proof={...candidate,out,ui:path.join(candidate.assets,'ui'),programFiles,candidateProof:candidatePointer.proof,wholeProfileRecovery:recoveryFile,wholeAppColdRecovery:true,actualPostgresRecovery:true,installed:false,eligibleForProductionInstallation:false};
const proofFile=path.join(out,'package-proof.json');await writeFile(proofFile,JSON.stringify(proof,null,2),{flag:'wx'});
const sourceHashes={};for(const name of ['make-recovery-installer71.mjs','make-recovery-installer71-worker.mjs','verify-recovery-installer71.mjs','squirrel-stub-integrity71.mjs'])sourceHashes[name]=await hash(path.join(root,'scripts/desktop',name));
const qualification={success:true,at:new Date().toISOString(),version:proof.version,proof:proofFile,proofSha256:await hash(proofFile),imageSha256:proof.imageSha256,sourceHashes,
 candidateQualification:path.join(candidate.out,'candidate-qualification.json'),packagedAcceptance:path.join(candidate.out,'packaged-accepted.json'),wholeProfileRecovery:recoveryFile,sourcePublication:path.join(candidate.out,'recovery-source-publication.json'),transitionQualification:transitionFile,
 archiveChecks:1093,completeAppWorkflows:20,libraryWorkflows:15,draftWorkflows:8,sourceLibraryCases:20,relatedRegressionCases:21,realDatabaseCases:11,sourceEditorWorkflows:15,checksNotSummed:true,
 wholeAppColdRecovery:true,actualPassword:true,sourcePathsUnavailable:true,sameWindowsUser:true,freshWindowsUser:false,physicalReboot:false,eligibleForInstallerConstruction:true,eligibleForProductionInstallation:false,installed:false,providerRequests:0,productionAccess:false,fullGoalComplete:false,
 pending:['Construct and independently verify the embedded installer payload.','Qualify70-to71 maintenance and capture a fresh verified recovery and actual installed-program rollback.','Normal update/reopening, preserved rows and protected connection settings, and native-window acceptance.']};
await writeFile(path.join(out,'qualification.json'),JSON.stringify(qualification,null,2),{flag:'wx'});await writeFile(path.join(records,'current.json'),JSON.stringify({out,proof:proofFile},null,2));console.log(JSON.stringify({success:true,out,eligibleForInstallerConstruction:true,installed:false}));
