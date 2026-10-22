import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('record accepted ordinary68 delivery');
const root=path.resolve(import.meta.dirname,'../..');
const release=await json(path.join(root,'.supabase/desktop-agent-apps68-release/current.json'));
const proof=await json(release.proof),qualification=await json(path.join(release.out,'qualification.json'));
const maintenance=await json(path.join(root,'.supabase/desktop-normal-maintenance/current-update68.json'));
const data=await json(path.join(maintenance.job,'installed-data-accepted.json'));
const uiFile=path.join(maintenance.job,'ordinary-ui-accepted.json'),ui=await json(uiFile);
const cleanup=await json(path.join(maintenance.job,'obsolete-build67-cleanup.json'));
const physical=await json(path.join(maintenance.job,'obsolete-build67-physical.json'));
const readyPointer=await json(path.join(root,'.supabase/desktop-live-readiness68/current.json')),ready=await json(readyPointer.evidence);
const packaged=await json(path.join(release.out,'packaged-accepted.json')),installer=await json(path.join(release.out,'installer-verified.json'));
assert(qualification.success&&data.success&&ui.success&&packaged.success&&installer.success);
assert.equal(data.version,'0.44.68');assert.equal(ui.version,data.version);
assert.equal(await hash(proof.image),data.imageSha256);assert.equal(ready.imageSha256,data.imageSha256);
assert(cleanup.success&&cleanup.currentAppPreserved&&cleanup.rollbackOnFVerified&&physical.success&&physical.physicalOldBuildAbsent);
assert(ready.success&&ready.ordinarySourceUnchanged&&ready.providerRequests===0&&ready.networkRequests===0&&ready.sharedRouterCredentialPresent);
assert(ready.accounts.every(a=>!a.images.enabled)&&ready.accounts.some(a=>a.images.credentialAvailable));
assert(ui.publicCatalog.includes('Public')&&ui.personalCatalog.includes('tab panel Personal')&&ui.composioCatalog.includes('tab panel Composio'));
assert(ui.selectedAgentDetail.includes('Assign Chrome DevTools to ChatGPT Assistant'));
assert(!ui.grantsOrInstructionsEdited&&ui.messagesSubmitted===0);
const receipt={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:data.imageSha256,qualification:path.join(release.out,'qualification.json'),installer:path.join(release.out,'installer-verified.json'),packaged:path.join(release.out,'packaged-accepted.json'),maintenanceEvidence:maintenance.evidence,installedDataEvidence:path.join(maintenance.job,'installed-data-accepted.json'),ordinaryUiEvidence:uiFile,ordinaryReopened:true,ordinaryFProfileSelected:true,database:data.database,agentAudit:data.agentAudit,readiness:readyPointer.evidence,imageGenerationEnabled:false,imageCredentialRetained:true,retiredCBuildRemoved:true,reclaimedProgramBytes:cleanup.bytes,rollbackOnFVerified:true,providerRequests:0,liveComposioVerified:false,fresh68FullRestoredProfileRecovery:false,physicalWindowsRebootTested:false,fullGoalComplete:false};
const receiptFile=path.join(release.out,'delivery-accepted.json');await writeFile(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx'});
const accepted={...data,ordinaryVisualAcceptancePending:false,ordinaryVisualEvidence:uiFile};await writeFile(path.join(maintenance.job,'installed-data-accepted.json'),JSON.stringify(accepted,null,2));
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
Object.assign(ledger,{at:receipt.at,installed:'0.44.68',candidate:null,qualifiedCandidate:null,qualification:receipt.qualification,acceptedReceipt:receiptFile,deliveryComplete:true,fullGoalComplete:false,latestGoalTurnOutcome:'Ordinary68 startup/data/account/picker accepted; protected metadata checked without requests; exact retired C67 removed with verified F rollback.'});
ledger.agentApps68={installed:true,delivery:receiptFile,ordinaryUiAccepted:true,packagedColdAccepted:true,controlledCodexPeerContinuation:true,liveComposioVerified:false};
if(ledger.installedUiOverlay)ledger.installedUiOverlay={...ledger.installedUiOverlay,supersededByVersion:'0.44.68',supersededBy:receiptFile};
ledger.imageGeneration={enabled:false,userPreference:'Keep disabled and available to enable later',credentialRetained:true,verified:readyPointer.evidence};
ledger.next=[
 'Continue persistent agent file upload/runtime use, inline app mentions, editable avatars/starters and builder/unsaved-definition preview; ordinary68 delivery is complete and must not be repeated.',
 'Fix private native offered-file lookup beyond200 assistant messages, retaining account and chat ownership and safe-path checks.',
 'Continue organization/sharing/external channels, settings/documents/keyboard/scaling reference comparisons and longer unattended/default-window/reboot/different-Windows-user recovery. Preserve every completed or uncertain request; keep image generation disabled. Live Composio requires a valid protected per-user project key; do not repeat the rejected-key request.'
];await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
for(const name of ['package.json','package-lock.json']){const file=path.join(root,name),text=await readFile(file,'utf8');await writeFile(file,text.replace(/"version": "0\.44\.67"/g,'"version": "0.44.68"'));}
const docFile=path.join(root,'docs/desktop/agent-apps68.md');let doc=await readFile(docFile,'utf8');
doc=doc.replace('# Agent-specific app browser — candidate 0.44.68','# Agent-specific app browser — installed 0.44.68');
doc=doc.replace(doc.split('\n\n')[1],'Agentopia 0.44.68 is installed and reopened normally. The ordinary F-drive profile passed saved-data/account and native agent-home/editor/picker acceptance. The exact retired C67 build was removed with verified rollback retained on F:.');
doc=doc.replace('The report does not claim pixel-identical layouts or ordinary installed 68 behavior.','The later ordinary68 native inspection confirms the saved-agent picker and account/history/document startup. Pixel-identical layouts remain unverified.');
doc=doc.replace(/Next: Construct[^\n]+/,'Delivery is complete. All1,808 saved rows across126 tables, two accounts,120 chats,410 messages,191 readable encrypted records, four agent profiles and two memories passed read-only checks. Native inspection opened the saved agent home, formatted editor and all three picker tabs, reviewed selected-agent-only access, and closed without changing grants or instructions. Protected metadata confirms fresh ChatGPT access, retained OpenRouter credential and disabled image generation with zero provider requests. Cleanup reclaimed2,567,430,682 program bytes. A fresh68 full restored-profile recovery, physical Windows reboot and real authenticated Composio action remain unverified. Continue the remaining parity scope.');
doc+='\nDelivery receipt: `'+receiptFile.replaceAll('\\','/')+'`.\n\nOrdinary native observations: `'+uiFile.replaceAll('\\','/')+'`.\n';await writeFile(docFile,doc);
const matrixFile=path.join(root,'docs/desktop/parity-requirements57.md');let matrix=await readFile(matrixFile,'utf8');matrix=matrix.replace('# Current requirements and evidence — 0.44.67','# Current requirements and evidence — 0.44.68');matrix=matrix.replace(matrix.split('\n\n')[1],'Installed0.44.68 provides the agent-specific Public/Personal/Composio picker. Exact installer verification, generated-account cold reopening and ordinary saved-account/history/editor/picker acceptance passed. All1,808 saved rows, two accounts/passwords/roles,120 chats,410 messages, four agent profiles and two memories are preserved. The retired C67 build was removed, reclaiming2.57 GB with verified F rollback. Protected metadata confirms fresh ChatGPT access, retained OpenRouter and disabled image generation without requests. Fresh68 whole-profile restoration, physical Windows reboot and live Composio authentication remain open. [Current delivery and limits](agent-apps68.md).');matrix=matrix.replace('A complete agent-scoped app catalog, persistent file upload/execution, builder assistant and other requirements remain open.','The agent-scoped app catalog is now delivered in68. Persistent file upload/execution, builder assistant and other requirements remain open.');await writeFile(matrixFile,matrix);
console.log(JSON.stringify({success:true,receipt:receiptFile,savedRows:data.database.savedRowsCompared,reclaimedBytes:cleanup.bytes,fullGoalComplete:false}));
