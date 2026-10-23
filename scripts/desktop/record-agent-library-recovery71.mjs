import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,lstat} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';

desktopOperation('qualify complete schema72 profile recovery including retained document versions');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json'));
const candidate=await json(pointer.candidateFile),source=await json(pointer.sourceIntent),target=await json(pointer.restoredIntent),packaged=await json(path.join(candidate.out,'packaged-accepted.json'));
const sourceReceipt=await json(path.join(source.out,'documents-recovery-source-accepted.json')),capture=await json(sourceReceipt.evidence),targetReceipt=await json(path.join(target.out,'documents-recovery-accepted.json')),restored=await json(targetReceipt.evidence);
const fixture=await json(sourceReceipt.checkpoint),unavailable=await json(restored.sourceUnavailableAudit),complete=await json(restored.completeDatabaseAudit);
assert(candidate.version==='0.44.71'&&candidate.runtimeVersion.schema===72&&candidate.runtimeVersion.desktopRecovery===12);
assert(capture.success&&restored.success&&packaged.success&&sourceReceipt.success&&targetReceipt.success);
for(const e of [capture,restored,packaged])assert.equal(e.imageSha256,candidate.imageSha256);
assert.equal(await hash(candidate.image),candidate.imageSha256);assert.equal(capture.normalExit,0);assert(capture.runtimeStopped&&capture.controlledResponses===0);
assert.equal(restored.checks.length,6);assert(restored.actualPasswordSignIn&&restored.sameWindowsUser&&!restored.physicalReboot);
assert(restored.restoredNormalExit===0&&restored.coldNormalExit===0&&restored.coldModelRequests===0&&restored.runtimeStopped);
assert(restored.restored.providersRequireReconnection&&restored.documents.imagesDisabled);
assert(complete.success&&complete.tablesCompared===128&&complete.schemaMigrations===72&&complete.allApplicationTablesCovered&&complete.retainedRevisionRowsCompared===2&&complete.savedRequestsCompared===8&&complete.encryptionRootBindingsVerified===4);
assert.deepEqual(restored.documents.originalHashes,fixture.originals);assert.deepEqual(restored.documents.retainedRevisions,fixture.library.history);assert.equal(restored.documents.pageSha256,fixture.pageSha256);
assert.equal(restored.continuation.nativeThread,restored.restored.stableNativeThread);assert.equal(restored.continuation.controlledResponses,2);assert(restored.continuation.unchangedSavedScope);
assert(restored.scopeChangedContinuation.savedReferenceScopeChanged&&restored.scopeChangedContinuation.freshNativeThreadRequired);assert.equal(restored.scopeChangedContinuation.controlledResponses,2);
assert(unavailable.phase==='complete'&&unavailable.home===source.home);await assert.rejects(lstat(unavailable.home),error=>error.code==='ENOENT');assert((await lstat(unavailable.retained)).isDirectory());
const running=await list(true);assert(!running.includes(source.distribution)&&!running.includes(target.distribution));assert.notEqual(source.distribution,target.distribution);
for(const[name,digest]of Object.entries(candidate.sourceHashes))assert.equal(await hash(path.join(root,'desktop',name)),digest,name);
const controllers={};for(const name of ['prepare-owned-runtime71.mjs','capture-agent-library-recovery71.mjs','prepare-agent-library-restore71.mjs','verify-agent-library-restore71.mjs','finish-agent-library-restore71.mjs','agent-library-recovery71-workflows.mjs','audit-owned-library-recovery71.py','audit_logical_snapshot71.py','logical_row_fingerprints71.py','record-agent-library-recovery71.mjs'])controllers[name]=await hash(path.join(root,'scripts/desktop',name));
const e={success:true,at:new Date().toISOString(),version:candidate.version,imageSha256:candidate.imageSha256,
 source:sourceReceipt.evidence,restored:targetReceipt.evidence,sourceBundle:sourceReceipt.bundle,sourceCheckpoint:sourceReceipt.checkpoint,controllers,
 actualPostgresBackup:true,actualPostgresRestore:true,wholeAppColdRecovery:true,actualPasswordSignIn:true,completeDatabaseAudit:restored.completeDatabaseAudit,
 allApplicationTablesCompared:true,tablesCompared:128,savedRowsCompared:complete.savedRowsCompared,selectedRecordsAlsoCompared:restored.restored.counts,accountPasswordAndRoleRowsPreserved:true,encryptionRootBindingsVerified:4,
 originalSourceHomeUnavailable:true,originalUploadPathsUnavailable:true,retainedCurrentOriginalsRestored:3,retainedPreviousOriginalsRestored:2,originalAndRevisionHashesMatch:true,pdfPageThreeIdentical:true,
 agentAssignmentsMatch:true,specialistReportAndScheduledHistoryMatch:true,sameNativeThreadWithUnchangedScope:true,changedDocumentScopeStartsFreshThread:true,sourceCaptureResponses:0,restoredControlledContinuationResponses:4,coldModelRequests:0,completedRequestsReplayed:0,
 coldCompletedRequests:8,coldExpectedRevokedRequests:2,realProviderRequests:0,productionAccess:false,sameWindowsUser:true,freshWindowsUser:false,physicalReboot:false,imagesDisabled:true,portableProviderReauthorizationRequired:true,modelComprehensionTested:false,
 priorWorkspaceRecovery:'Inherited unchanged workspace-specific behavior from qualified69; this test covers the complete schema72 snapshot and retained library revisions without repeating Git workspace scenarios.',
 installed:false,eligibleForInstallerConstruction:true,eligibleForProductionInstallation:false,fullGoalComplete:false,
 pending:['Construct and independently verify the exact71 installer.','Fresh ordinary70 recovery and rollback, normal update/reopening, saved-data and protected-connection comparison.','Native ordinary-window visual acceptance, physical reboot, different-Windows-user recovery and remaining parity.']};
const file=path.join(candidate.out,'whole-profile-recovery-qualified.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);ledger.agentLibrary71Recovery={...e,evidence:file};ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,wholeAppColdRecovery:true,tablesCompared:128,savedRowsCompared:e.savedRowsCompared,retainedCurrentOriginals:3,retainedPreviousOriginals:2,sameNativeThreadWithUnchangedScope:true,changedDocumentScopeStartsFreshThread:true,coldModelRequests:0,installed:false}));
