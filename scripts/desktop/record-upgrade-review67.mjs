import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('record scoped restricted-upgrade recovery qualification67');
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.supabase/desktop-scheduled-workspaces67'),checks={},sourceHashes={};
for(const [name,expected]of [['upgrade-review',21],['controls',41],['upgrade-review-ui',7],['maintenance-poll',22]]){
 const pointer=await json(path.join(directory,'current-'+name+'.json')),proof=await json(pointer.evidence);assert(proof.success,name);assert.equal(Array.isArray(proof.checks)?proof.checks.length:proof.passed,expected,name);for(const field of ['failed','skipped','cancelled'])if(proof[field]!==undefined)assert.equal(proof[field],0,name+': '+field);
 for(const [file,digest]of Object.entries(proof.sourceHashes)){
  // Backend tests compile Main and the UI, but execute Runtime/profile/controller
  // modules. The controls suite executes Main. Rendered tests execute the UI and
  // restricted controller through a controlled bridge, without executing Main.
  if(name==='upgrade-review'&&(file==='desktop/src/main.ts'||file.startsWith('desktop/ui/')))continue;
  if(name==='upgrade-review-ui'&&file==='desktop/src/main.ts')continue;
  assert.equal(await hash(path.join(root,file)),digest,name+': '+file+' changed after qualification');if(sourceHashes[file])assert.equal(sourceHashes[file],digest,'Conflicting executed source: '+file);sourceHashes[file]=digest;
 }
 checks[name]=pointer.evidence;
}
const installedArchive='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.66/resources/app.asar',installedImageSha256='74e4477cbbf3cbf3330e47ef5157646d0a113fd12fe786abdc776b654673d235',migration='desktop/database/0070-scheduled-project-workspaces.sql';assert.equal(await hash(installedArchive),installedImageSha256);assert.equal(await hash(path.join(root,migration)),'ec1184c71a43eefb6f51a52a1db89f46971ef2fb0203d2a59199ce07d7ae60a3');assert.equal((await json(path.join(root,'package.json'))).version,'0.44.66');
const installedUi=await json(path.join(root,'.supabase/desktop-agent-directory66/current.json')),overlay=await json(path.join(installedUi.out,'installed.json'));assert(overlay.success);for(const [name,digest]of Object.entries(overlay.uiFiles))assert.equal(await hash(path.join(path.dirname(installedArchive),'resources/ui',name)),digest,'The installed renderer changed: '+name);
sourceHashes['scripts/desktop/record-upgrade-review67.mjs']=await hash(import.meta.filename);
const pending=[
 'Exercise restricted unfinished-import review through the matching source67 archive and actual closed-profile maintenance driver, then verify real PostgreSQL/password/account/agent/memory/provider recovery and whole-app cold reopening with images disabled and no replay.',
 'Complete combined packaged multi-project scheduled Git/local workspace execution, revocation, cancellation and cold no-replay acceptance. Preserve completed goal68 and its request identities.',
 'Complete private native-scratch offered-file lookup beyond the current 200-message window.',
 'Continue full-page agent/plugin editor and remaining document/settings UI parity, editable agent-specific starters/avatars, home dictation, organization discovery/sharing and external agent channels.',
 'Live Composio authentication/catalog/tool verification requires the valid protected per-user project key; leave image generation disabled.',
 'Qualify the combined source/archive/installer and install only after required recovery and acceptance gates pass under standing close/reopen/update authorization.'
];
const evidence={success:true,at:new Date().toISOString(),checks,sourceHashes,installedArchive,installedImageSha256,installedVersion:'0.44.66',installedUiOverlay:overlay.evidence,migration,migrationSha256:await hash(path.join(root,migration)),sourceRecoveryCapability:12,installedRecoveryCapability:11,restrictedUpgradeReviewImplemented:true,restrictedUpgradeReviewSourceQualified:true,actualMainRouting:true,fullApplicationRenderer:true,actualWindowsEncryptedRecovery:true,controlledWslTransport:true,controlledAuthClients:true,actualPostgresRecovery:false,wholeAppColdRecovery:false,physicalReboot:false,sourceOnly:true,installed:false,eligibleForInstallation:false,providerRequests:0,productionWrites:0,fullGoalComplete:false,historicalBroadRecovery:path.join(directory,'copies-qualified.json'),scopes:'21 Runtime/profile/controller cases, 41 desktop admission/close controls, 7 rendered recovery workflows, and 22 maintenance/scheduler cases. Overlapping suites are not summed. Main is qualified by the controls proof; renderer source is qualified by the rendered proof.',pending};
const proof=path.join(directory,'upgrade-review-qualified.json');await writeFile(proof,JSON.stringify(evidence,null,2));
if(process.argv.includes('--without-ledger')){console.log(JSON.stringify({success:true,proof,sourceOnly:true,ledgerUnchanged:true,installed:false}));process.exit(0);}
const ledger=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),state=await json(ledger);state.sourceWork67.qualification=proof;state.sourceWork67.phase='Restricted unfinished-import upgrade review source-qualified; actual maintenance-driver/PostgreSQL and packaged cold acceptance remain';state.sourceWork67.unfinishedImportUpgradeReviewReachable=true;state.sourceWork67.unfinishedImportUpgradeReview={implemented:true,sourceOnly:true,installed:false,proof,backendCases:21,appControlCases:41,renderedWorkflows:7,actualMainRouting:true,wholeAppRenderer:true,actualRuntimeProcess:false,actualPostgresRecovery:false,providerRequests:0,productionWrites:0};state.sourceWork67.sourceHashes={...state.sourceWork67.sourceHashes,...sourceHashes};state.sourceWork67.checks={...state.sourceWork67.checks,...checks};state.sourceWork67.appControlCases=41;state.sourceWork67.profileWorkspaceCases=7;state.sourceWork67.currentNext=pending;state.sourceWork67.unfinishedImportInspectionUi='prepared finish and explicit separate copies, reachable through restricted pre-upgrade startup';state.latestGoalTurnOutcome={at:evidence.at,result:'progress',description:'Source-qualified restricted authenticated upgrade recovery without agent/provider construction, fresh complete-backup continuation, actual Main close/routing and full-renderer review. Installed66 and broader parity goal remain unchanged/incomplete.'};await writeFile(ledger,JSON.stringify(state,null,2));
console.log(JSON.stringify({success:true,proof,backendCases:21,appControlCases:41,renderedWorkflows:7,installed:false,eligibleForInstallation:false,fullGoalComplete:false}));
