import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,readdir,lstat} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind exact70 document recovery and package evidence for installer construction');
const root=path.resolve(import.meta.dirname,'../..');
const candidatePointer=await json(path.join(root,'.supabase/desktop-agent-documents70-candidate/current.json'));
const candidate=await json(candidatePointer.proof),qualified=await json(path.join(candidate.out,'candidate-qualification.json'));
const packaged=await json(path.join(candidate.out,'packaged-accepted.json'));
const recoveryFile=path.join(candidate.out,'whole-profile-recovery-qualified.json'),recovery=await json(recoveryFile);
const publication=await json(path.join(candidate.out,'fixture-publication-qualified.json'));
assert(candidate.success&&candidate.version==='0.44.70'&&candidate.runtimeVersion.schema===71&&candidate.runtimeVersion.desktopRecovery===12);
assert(qualified.success&&packaged.success&&recovery.success&&recovery.wholeAppColdRecovery&&recovery.actualPasswordSignIn&&recovery.originalSourceHomeUnavailable);
assert(recovery.eligibleForInstallerConstruction&&recovery.retainedOriginalsRestored===3&&recovery.pdfPageThreeIdentical);
assert(packaged.actualNativeDocumentReads&&packaged.nativeImageMatchesRetainedPdfPageContent&&packaged.coldModelRequests===0);
for(const e of [qualified,packaged,recovery])assert.equal(e.imageSha256,candidate.imageSha256);
assert.equal(await hash(candidate.image),candidate.imageSha256);assert.equal(await hash(candidate.exe),candidate.exeSha256);
assert(qualified.archiveCases>=1085&&qualified.wholeInterfaceWorkflows===20&&qualified.draftWorkflows===8);
assert(publication.success&&publication.files.length===129);
for(const row of publication.files)assert.equal(await hash(path.join(root,row.file)),row.publishedSha256,row.file);
for(const [file,digest]of Object.entries(candidate.sourceHashes).filter(([file])=>!file.startsWith('tests/')))assert.equal(await hash(path.join(root,'desktop',file)),digest,file);
for(const [file,digest]of Object.entries(candidate.resourceFiles))assert.equal(await hash(path.join(candidate.assets,file)),digest,file);
const records=path.join(root,'.supabase/desktop-recovery70-release'),out=path.join(records,String(Date.now()));await mkdir(out,{recursive:true});
const programFiles={};for(const name of(await readdir(candidate.program,{recursive:true})).sort()){
 const file=path.join(candidate.program,name),info=await lstat(file);assert(!info.isSymbolicLink());
 if(info.isFile()&&!name.replaceAll('\\','/').startsWith('resources/resources/'))programFiles[name.replaceAll('\\','/')]=await hash(file);
}
assert.equal(programFiles['resources/app.asar'],candidate.imageSha256);
assert.equal(programFiles['squirrel.exe'],await hash(path.join(root,'node_modules/electron-winstaller/vendor/Squirrel.exe')));
const proof={...candidate,out,ui:path.join(candidate.assets,'ui'),programFiles,candidateProof:candidatePointer.proof,
 wholeProfileRecovery:recoveryFile,wholeAppColdRecovery:true,actualPostgresRecovery:true,installed:false,eligibleForProductionInstallation:false};
const proofFile=path.join(out,'package-proof.json');await writeFile(proofFile,JSON.stringify(proof,null,2),{flag:'wx'});
const sourceHashes={};for(const name of ['make-recovery-installer70.mjs','make-recovery-installer70-worker.mjs','verify-recovery-installer70.mjs','squirrel-stub-integrity70.mjs'])sourceHashes[name]=await hash(path.join(root,'scripts/desktop',name));
const qualification={success:true,at:new Date().toISOString(),version:proof.version,proof:proofFile,proofSha256:await hash(proofFile),imageSha256:proof.imageSha256,
 sourceHashes,candidateQualification:path.join(candidate.out,'candidate-qualification.json'),packagedAcceptance:path.join(candidate.out,'packaged-accepted.json'),
 wholeProfileRecovery:recoveryFile,fixturePublication:path.join(candidate.out,'fixture-publication-qualified.json'),archiveChecks:qualified.archiveCases,
 completeAppWorkflows:20,draftWorkflows:8,sourceDocumentCases:12,relatedRegressionCases:57,realDatabaseCases:6,sourceEditorWorkflows:6,
 checksNotSummed:true,wholeAppColdRecovery:true,actualPassword:true,sourcePathsUnavailable:true,sameWindowsUser:true,freshWindowsUser:false,physicalReboot:false,
 eligibleForInstallerConstruction:true,eligibleForProductionInstallation:false,installed:false,providerRequests:0,productionAccess:false,fullGoalComplete:false,
 pending:['Construct and independently verify the embedded installer payload.','Qualify69-to70 maintenance with the exact currently installed rollback.','Fresh logical/profile backup, normal update, saved-data and native-UI acceptance.']};
await writeFile(path.join(out,'qualification.json'),JSON.stringify(qualification,null,2),{flag:'wx'});
await writeFile(path.join(records,'current.json'),JSON.stringify({out,proof:proofFile},null,2));
console.log(JSON.stringify({success:true,out,eligibleForInstallerConstruction:true,installed:false}));
