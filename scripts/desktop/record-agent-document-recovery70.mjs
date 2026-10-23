import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,lstat} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';

desktopOperation('record exact70 whole-profile recovery of persistent document originals');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'));
const candidate=await json(pointer.candidateFile),source=await json(pointer.sourceIntent),target=await json(pointer.restoredIntent);
const packaged=await json(path.join(candidate.out,'packaged-accepted.json'));
const sourceReceipt=await json(path.join(source.out,'documents-recovery-source-accepted.json')),capture=await json(sourceReceipt.evidence);
const targetReceipt=await json(path.join(target.out,'documents-recovery-accepted.json')),restored=await json(targetReceipt.evidence);
const fixture=await json(sourceReceipt.checkpoint),unavailable=await json(restored.sourceUnavailableAudit);
assert(candidate.version==='0.44.70'&&candidate.runtimeVersion.schema===71&&candidate.runtimeVersion.desktopRecovery===12);
assert(capture.success&&restored.success&&packaged.success&&sourceReceipt.success&&targetReceipt.success);
for(const e of [capture,restored,packaged])assert.equal(e.imageSha256,candidate.imageSha256);
assert.equal(await hash(candidate.image),candidate.imageSha256);
assert.equal(capture.normalExit,0);assert(capture.runtimeStopped&&capture.controlledResponses===0);
assert.equal(restored.checks.length,5);assert(restored.actualPasswordSignIn&&restored.sameWindowsUser&&!restored.physicalReboot);
assert(restored.restoredNormalExit===0&&restored.coldNormalExit===0&&restored.coldModelRequests===0&&restored.runtimeStopped);
assert(restored.restored.providersRequireReconnection&&restored.documents.imagesDisabled);
assert.deepEqual(restored.documents.originalHashes,fixture.originals);assert.equal(restored.documents.pageSha256,fixture.pageSha256);
assert.equal(restored.continuation.nativeThread,restored.restored.nativeThread);assert.equal(restored.continuation.controlledResponses,2);
assert(unavailable.phase==='complete'&&unavailable.home===source.home);
await assert.rejects(lstat(unavailable.home),error=>error.code==='ENOENT');assert((await lstat(unavailable.retained)).isDirectory());
const running=await list(true);assert(!running.includes(source.distribution)&&!running.includes(target.distribution));
assert.notEqual(source.distribution,target.distribution);
for(const [name,digest]of Object.entries(candidate.sourceHashes).filter(([name])=>!name.startsWith('tests/')))assert.equal(await hash(path.join(root,'desktop',name)),digest,name);
const publication=await json(path.join(candidate.out,'fixture-publication-qualified.json'));assert(publication.success&&publication.files.length===129);
for(const row of publication.files)assert.equal(await hash(path.join(root,row.file)),row.publishedSha256,row.file);
const e={success:true,at:new Date().toISOString(),version:candidate.version,imageSha256:candidate.imageSha256,
 source:sourceReceipt.evidence,restored:targetReceipt.evidence,sourceBundle:sourceReceipt.bundle,sourceCheckpoint:sourceReceipt.checkpoint,
 actualPostgresBackup:true,actualPostgresRestore:true,wholeAppColdRecovery:true,actualPasswordSignIn:true,
 savedRowsCompared:restored.restored.counts,selectedTableComparisonsOnly:true,originalSourceHomeUnavailable:true,
 originalUploadPathsUnavailable:true,retainedOriginalsRestored:3,originalHashesMatch:true,pdfPageThreeIdentical:true,
 agentAssignmentsMatch:true,specialistReportAndScheduledHistoryMatch:true,sameNativeThread:true,
 sourceCaptureResponses:0,restoredControlledContinuationResponses:2,coldModelRequests:0,completedRequestsReplayed:0,
 realProviderRequests:0,productionAccess:false,sameWindowsUser:true,freshWindowsUser:false,physicalReboot:false,
 imagesDisabled:true,portableProviderReauthorizationRequired:true,modelComprehensionTested:false,
 priorWorkspaceRecovery:'Inherited unchanged workspace-specific behavior from qualified69; this70 test adds the full schema71 document table and does not repeat Git workspace scenarios.',
 installed:false,eligibleForInstallerConstruction:true,eligibleForProductionInstallation:false,fullGoalComplete:false,
 pending:['Construct and independently verify the exact70 installer.','Fresh recoverable ordinary69-to70 upgrade and preserved-data audit.','Native ordinary-window visual acceptance and remaining parity work.']};
const file=path.join(candidate.out,'whole-profile-recovery-qualified.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
ledger.agentDocuments70Recovery={...e,evidence:file};ledger.latestGoalTurnOutcome={at:e.at,outcome:'Exact70 whole-profile recovery retains original documents, assignments, saved records and original-password sign-in. A new scoped document read continues the same native thread; cold reopening makes zero requests. Installer and ordinary upgrade remain.',evidence:file,fullGoalComplete:false};
ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,wholeAppColdRecovery:true,documents:3,sameNativeThread:true,coldModelRequests:0,installed:false}));
