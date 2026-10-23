import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';

desktopOperation('record verified ordinary70 installation with native visual acceptance pending');
const root=path.resolve(import.meta.dirname,'../..');
const release=await json(path.join(root,'.supabase/desktop-recovery70-release/current.json')),proof=await json(release.proof);
const maintenance=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update70.json')),installed=await json(maintenance.evidence);
const dataFile=path.join(maintenance.job,'installed-data-accepted.json'),data=await json(dataFile),restored=await json(proof.wholeProfileRecovery);
const agentHealth=await json(data.agentAudit.evidence);
assert(installed.success&&installed.installed&&!installed.ordinaryReopeningPending&&installed.currentRecoveryVerified&&installed.rollbackVerified);
assert(data.success&&data.version==='0.44.70'&&data.ordinaryFProfileSelected&&data.schema.schema===71&&data.schema.desktopRecovery===12);
assert(data.database.mismatches.length===0&&data.database.accountPasswordAndRoleRowsPreserved);
assert(data.agentAudit.success&&data.agentAudit.problems.length===0);
assert(agentHealth.success&&agentHealth.version==='0.44.70'&&agentHealth.schemaMigration.count===71);
assert(agentHealth.agentDocumentStorage.retainedOriginals===0&&agentHealth.agentDocumentStorage.invalidBindings===0);
assert(!agentHealth.agentDocumentStorage.authenticatedTableRead&&!agentHealth.agentDocumentStorage.anonTableRead);
assert(!agentHealth.agentDocumentStorage.authenticatedRpcRead&&!agentHealth.agentDocumentStorage.anonRpcRead);
assert(agentHealth.agentDocumentStorage.brokerTableRead&&agentHealth.agentDocumentStorage.brokerRpcRead);
assert(restored.success&&restored.wholeAppColdRecovery&&restored.actualPasswordSignIn&&restored.retainedOriginalsRestored===3);
assert.equal(data.imageSha256,proof.imageSha256);
assert.equal(await hash(path.join(path.dirname(data.ordinaryExecutable),'resources/app.asar')),proof.imageSha256);
const receipt={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,
 scope:'installed-program-and-saved-data',maintenanceEvidence:maintenance.evidence,installedDataEvidence:dataFile,
 wholeProfileRecovery:proof.wholeProfileRecovery,installerVerification:path.join(release.out,'installer-verified.json'),
 ordinaryReopened:true,ordinaryFProfileSelected:true,database:data.database,agentAudit:data.agentAudit,
 documentStorage:agentHealth.agentDocumentStorage,schemaMigration:agentHealth.schemaMigration,
 freshRecoveryVerified:true,physicalProgramAndRootLaunchersRollbackVerified:true,
 externalAttachmentContentsCopied:false,externalAttachmentLocationsRetainedInPlace:true,
 ordinaryVisualAcceptancePending:true,desktopLockedAtLastObservation:true,physicalWindowsRebootTested:false,
 differentWindowsUserRecoveryTested:false,providerRequests:0,liveComposioVerified:false,fullGoalComplete:false};
const file=path.join(release.out,'installed-verified-visual-pending.json');await writeFile(file,JSON.stringify(receipt,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
ledger.releaseCandidate70={...(ledger.releaseCandidate70??{}),version:proof.version,proof:release.proof,wholeProfileRestoreVerified:true,
 wholeProfileRecovery:proof.wholeProfileRecovery,installerVerified:path.join(release.out,'installer-verified.json'),
 eligibleForProductionInstallation:true,installed:true,installedVerification:file,ordinaryVisualAcceptancePending:true,
 sourceFixtureOriginalPathsUnavailable:true,restoredRuntimeIntent:(await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json'))).restoredIntent};
ledger.latestGoalTurnOutcome={at:receipt.at,outcome:'Installed verified70 normally; existing saved data matches and schema71 document storage is guarded. Exact-version whole-profile document restoration passes. Native ordinary-window visual acceptance remains pending.',evidence:file,fullGoalComplete:false};
ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,version:receipt.version,evidence:file,savedRows:data.database.savedRowsCompared,visualAcceptancePending:true,fullGoalComplete:false}));
