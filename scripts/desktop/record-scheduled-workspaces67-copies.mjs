import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('record current separate-copy recovery source qualification');
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.supabase/desktop-scheduled-workspaces67'),checks={},sourceHashes={};
for(const [name,expected]of [['copies',6],['maintenance',156],['upgrade',10],['controls',36],['startup',35],['owner-records',15],['inspection-auth',4],['inspection-ui',7],['ui',10]]){
 const pointer=await json(path.join(directory,'current-'+name+'.json')),proof=await json(pointer.evidence);assert(proof.success,name);assert.equal(Array.isArray(proof.checks)?proof.checks.length:proof.passed,expected,name);
 for(const field of ['failed','skipped','cancelled'])if(proof[field]!==undefined)assert.equal(proof[field],0,name+': '+field);
 for(const [file,digest]of Object.entries(proof.sourceHashes)){assert.equal(await hash(path.join(root,file)),digest,name+': '+file+' changed after qualification');if(sourceHashes[file])assert.equal(sourceHashes[file],digest,'Conflicting source evidence: '+file);sourceHashes[file]=digest;}
 checks[name]=pointer.evidence;
}
const installedArchive='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66/resources/app.asar',installedImageSha256='74e4477cbbf3cbf3330e47ef5157646d0a113fd12fe786abdc776b654673d235',migration='desktop/database/0070-scheduled-project-workspaces.sql';assert.equal(await hash(installedArchive),installedImageSha256);assert.equal(await hash(path.join(root,migration)),'ec1184c71a43eefb6f51a52a1db89f46971ef2fb0203d2a59199ce07d7ae60a3');assert.equal((await json(path.join(root,'package.json'))).version,'0.44.66');
const directoryUi=await json(path.join(root,'.supabase/desktop-agent-directory66/current.json')),overlay=await json(path.join(directoryUi.out,'installed.json'));assert(overlay.success);for(const [name,digest]of Object.entries(overlay.uiFiles))assert.equal(await hash(path.join(path.dirname(installedArchive),'resources/ui',name)),digest,'The ordinary UI overlay changed: '+name);
sourceHashes['scripts/desktop/record-scheduled-workspaces67-copies.mjs']=await hash(import.meta.filename);
const pending=[
 'Provide a recoverable review path when unfinished owner imports hold automatic pre-upgrade graph capture. Runtime currently stops before the authenticated screen in that condition. Keep the complete-backup gate intact.',
 'Verify the actual closed-profile maintenance driver against a matching source67 archive, then real PostgreSQL/password/account/agent/memory/provider recovery and whole-app cold reopening with disabled images and no replay.',
 'Complete combined packaged multi-project scheduled Git/local workspace execution, revocation, cancellation and cold no-replay acceptance. Reuse completed goal68; do not resend its model/tool requests.',
 'Complete private native-scratch offered-file lookup beyond the current 200-message window.',
 'Continue native ordinary/reference comparisons. The supported Windows helper now works; catalog labels were verified. Reference plugin details use a full page while Agentopia still uses a modal. Document viewers, settings and remaining layouts still need their full comparison.',
 'Live Composio authentication/catalog/tool verification requires the valid per-user protected project key; do not enable image generation.',
 'Qualify a source/archive/installer and install only after the required recovery and combined acceptance gates pass. Standing Agentopia install/close/reopen authorization remains valid.'
];
const evidence={success:true,at:new Date().toISOString(),priorQualification:path.join(directory,'upgrade-qualified.json'),checks,sourceHashes,installedArchive,installedImageSha256,installedVersion:'0.44.66',installedUiOverlay:overlay.evidence,migration,migrationSha256:await hash(path.join(root,migration)),sourceRecoveryCapability:12,installedRecoveryCapability:11,explicitSeparateCopyRecoveryImplemented:true,privateEditedHistoryRoundTripDemonstrated:true,sourceOnly:true,installed:false,eligibleForInstallation:false,actualPostgresRecovery:false,wholeAppColdRecovery:false,unfinishedImportUpgradeReviewReachable:false,providerRequests:0,productionWrites:0,fullGoalComplete:false,pending};
const proof=path.join(directory,'copies-qualified.json');await writeFile(proof,JSON.stringify(evidence,null,2));
const ledger=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),state=await json(ledger);state.sourceWork67.qualification=proof;state.sourceWork67.earlyPartialSeparateCopyRecovery={implemented:true,sourceOnly:true,installed:false,proof,targetedCases:6,broadRecoveryCases:156,renderedRecoveryWorkflows:7,broadRecoveryRegressionPending:false,existingScheduledWorkflows:10,upgradeProfileCases:10,providerRequests:0,productionWrites:0};state.sourceWork67.unfinishedImportUpgradeReviewReachable=false;state.sourceWork67.currentNext=pending;state.sourceWork67.freshNativeComparison={working:true,at:state.nativeReferenceControl22?.at,pluginLabelsVerified:true,pluginDetailFullPagePending:true};await writeFile(ledger,JSON.stringify(state,null,2));
console.log(JSON.stringify({success:true,proof,recoveryCases:156,targetedCases:6,upgradeProfileCases:10,renderedRecoveryWorkflows:7,installed:false,eligibleForInstallation:false,fullGoalComplete:false}));
