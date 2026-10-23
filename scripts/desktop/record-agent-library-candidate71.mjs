import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind frozen71 archive, complete interface, library and draft qualification');
const root=path.resolve(import.meta.dirname,'../..');
const pointer=await json(path.join(root,'.supabase/desktop-agent-library71-candidate/current.json')),proof=await json(pointer.proof);
const archiveFile=(await json(path.join(root,'.supabase/desktop-agent-library71-controls/current.json'))).evidence,archive=await json(archiveFile);
const uiFile=path.resolve(process.argv[2]),ui=await json(uiFile),libraryFile=path.resolve(process.argv[3]),library=await json(libraryFile),draftFile=path.resolve(process.argv[4]),draft=await json(draftFile);
const source=await json(proof.sourceLibraryQualification),proofSha256=await hash(pointer.proof);
assert(proof.success&&proof.version==='0.44.71'&&proof.runtimeVersion.schema===72&&proof.runtimeVersion.desktopRecovery===12);
assert.equal(await hash(proof.image),proof.imageSha256);
assert(archive.success&&archive.completeSuite&&archive.actualArchivedModules&&archive.passed>=1093&&archive.failed===0&&archive.cancelled===0&&archive.skipped===0);
assert.equal(archive.imageSha256,proof.imageSha256);
assert(ui.success&&ui.checks.length===20&&ui.rendererErrors.length===0);assert.equal(ui.proofSha256,proofSha256);
assert(library.success&&library.checks.length===15&&library.rendererErrors.length===0&&library.rendererFromPackagedResources);assert.equal(library.proofSha256,proofSha256);
assert.equal(path.resolve(library.rendererResources),path.resolve(proof.assets,'ui'));
assert(draft.success&&draft.checks.length===8&&draft.inferenceRequests===0&&draft.rendererFromPackagedResources);
assert.equal(path.resolve(draft.rendererResources),path.resolve(proof.assets,'ui'));
assert(source.success&&source.sourceOnly&&source.focusedCases===20&&source.relatedRegressionCases===21&&source.realDatabaseChecks===11&&source.interfaceWorkflows===15);
for(const [name,digest]of Object.entries(proof.sourceHashes))assert.equal(await hash(path.join(root,'desktop',name)),digest,name);
for(const [name,digest]of Object.entries(proof.uiFiles))assert.equal(await hash(path.join(proof.assets,'ui',name)),digest,name);
for(const [name,digest]of Object.entries(source.compiledModules))assert.equal(proof.compiled[name],digest,name);
const controllers={};for(const name of ['prepare-agent-library-candidate71.mjs','qualify-agent-library-controls71.mjs','inspect-agent-library-interface71.mjs','test-agent-library71-packaged-ui.mjs','test-chat-acceptance-drafts-ui.mjs','record-agent-library-candidate71.mjs'])controllers[name]=await hash(path.join(root,'scripts/desktop',name));
const e={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,proof:pointer.proof,proofSha256,
 sourceLibraryQualification:proof.sourceLibraryQualification,archiveEvidence:archiveFile,archiveCases:archive.passed,archiveTestFiles:archive.testFiles,
 wholeInterface:uiFile,wholeInterfaceWorkflows:20,libraryInterface:libraryFile,libraryInterfaceWorkflows:15,draftEvidence:draftFile,draftWorkflows:8,checksNotSummed:true,controllers,
 eligibleForGeneratedRuntime:true,eligibleForInstallerConstruction:false,eligibleForProductionInstallation:false,installed:false,providerRequests:0,productionAccess:false,fullGoalComplete:false,
 pending:['Packaged lifecycle and native scope checks on both controlled provider adapters.','Exact-version whole-profile restoration with schema72 and retained original/history bytes.','Verified installer and fresh recoverable ordinary70-to71 update with preserved-data/credential checks.','Native ordinary-window visual acceptance, physical reboot, different-user recovery and remaining parity.']};
const file=path.join(proof.out,'candidate-qualification.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);ledger.agentLibrary71Candidate={...e,evidence:file};ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,qualification:file,archiveCases:e.archiveCases,archiveTestFiles:e.archiveTestFiles,wholeInterfaceWorkflows:20,libraryInterfaceWorkflows:15,draftWorkflows:8,eligibleForGeneratedRuntime:true,installed:false}));
