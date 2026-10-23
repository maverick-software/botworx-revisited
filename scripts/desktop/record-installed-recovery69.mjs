import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';

desktopOperation('record verified ordinary69 installation with visual acceptance pending');
const root=path.resolve(import.meta.dirname,'../..');
const release=await json(path.join(root,'.supabase/desktop-recovery69-release/current.json'));
const proof=await json(release.proof);
const maintenance=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update69.json'));
const installed=await json(maintenance.evidence);
const dataFile=path.join(maintenance.job,'installed-data-accepted.json'),data=await json(dataFile);
const restored=await json(proof.wholeProfileRecovery);
assert(installed.success&&installed.installed&&!installed.ordinaryReopeningPending);
assert(installed.currentRecoveryVerified&&installed.rollbackVerified);
assert(data.success&&data.version==='0.44.69'&&data.ordinaryFProfileSelected);
assert(data.database.mismatches.length===0&&data.database.accountPasswordAndRoleRowsPreserved);
assert(data.agentAudit.success&&data.agentAudit.problems.length===0);
assert(restored.success&&restored.wholeAppColdRecovery&&restored.actualPasswordSignIn);
assert.equal(data.imageSha256,proof.imageSha256);
assert.equal(await hash(path.join(path.dirname(data.ordinaryExecutable),'resources/app.asar')),proof.imageSha256);
const receipt={
 success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,
 scope:'installed-program-and-saved-data',maintenanceEvidence:maintenance.evidence,
 installedDataEvidence:dataFile,wholeProfileRecovery:proof.wholeProfileRecovery,
 installerVerification:path.join(release.out,'installer-verified.json'),
 ordinaryReopened:true,ordinaryFProfileSelected:true,database:data.database,agentAudit:data.agentAudit,
 freshRecoveryVerified:true,physicalProgramRollbackVerified:true,
 externalAttachmentContentsCopied:false,externalAttachmentLocationsRetainedInPlace:true,
 ordinaryVisualAcceptancePending:true,desktopLockedAtLastObservation:true,
 physicalWindowsRebootTested:false,differentWindowsUserRecoveryTested:false,
 providerRequests:0,liveComposioVerified:false,fullGoalComplete:false,
};
const file=path.join(release.out,'installed-verified-visual-pending.json');
await writeFile(file,JSON.stringify(receipt,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json');
const ledger=await json(ledgerFile);
Object.assign(ledger.releaseCandidate69,{
 wholeProfileRestoreVerified:true,wholeProfileRecovery:proof.wholeProfileRecovery,
 installerVerified:path.join(release.out,'installer-verified.json'),
 eligibleForProductionInstallation:true,installed:true,installedVerification:file,
 ordinaryVisualAcceptancePending:true,sourceFixtureOriginalPathsUnavailable:true,
 restoredRuntimeIntent:path.join(root,'.supabase/desktop-recovery69-real/1792735241177/restored/intent.json'),
});
ledger.latestGoalTurnOutcome={at:receipt.at,outcome:'Installed verified69 normally; all saved data matches; exact-version whole-profile recovery passes; visual acceptance awaits desktop unlock.',evidence:file,fullGoalComplete:false};
ledger.fullGoalComplete=false;
await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,version:receipt.version,evidence:file,savedRows:data.database.savedRowsCompared,visualAcceptancePending:true,fullGoalComplete:false}));
