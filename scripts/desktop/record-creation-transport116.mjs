import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('record creation-owned transport qualification without enabling preview execution');
const root=path.resolve(import.meta.dirname,'../..'),names=['source','transport','ordinaryAudit'];assert.equal(process.argv.length,names.length+2);
const files=Object.fromEntries(names.map((name,index)=>[name,path.resolve(process.argv[index+2])])),data={},receipts={};
for(const [name,file]of Object.entries(files)){
 data[name]=await json(file);assert(data[name].success,name);receipts[name]={file,sha256:await hash(file)};
 for(const [relative,digest]of Object.entries(data[name].sourceHashes??{}))assert.equal(await hash(path.join(root,relative)),digest,name+': '+relative);
}
const source=data.source,transport=data.transport,previousFile=path.join(root,'.supabase/desktop-draft-preview76/checkpoint115.json'),previous=await json(previousFile),base=await json(previous.receipts.source.file);
assert(previous.success&&!previous.fullGoalComplete&&!previous.installed);
assert.equal(source.controllerSha256,await hash(path.join(root,'scripts/desktop/test-creation-transport116-final-source.mjs')));
assert.equal(source.focusedCases,256);assert.equal(source.regressionCases,152);assert.equal(source.recoveryCases,51);assert(source.commands.every(row=>row.code===0));
assert(source.sourceOnly&&!source.productionAccess);assert.equal(source.providerRequests,0);
for(const file of ['desktop/src/creation-resource-principal.ts','desktop/src/creation-remote-resources.ts','desktop/tests/creation-remote-resources.test.cjs'])assert(source.sourceHashes[file]);
// The editor and its retained recovery implementation remain at checkpoint115.
for(const name of ['creationUI','savedUI','applicationUI']){const receipt=previous.receipts[name];assert.equal(await hash(receipt.file),receipt.sha256);const ui=await json(receipt.file);assert(ui.success);for(const[file,digest]of Object.entries(ui.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,name+': '+file);receipts['reused'+name]={...receipt,reused:true,currentCapturedSourcesUnchanged:true};}
const changed=Object.keys(base.sourceHashes).filter(file=>source.sourceHashes[file]&&source.sourceHashes[file]!==base.sourceHashes[file]);assert.deepEqual(changed,['desktop/src/remote-tools.ts']);
assert.equal(transport.sourceQualification,files.source);assert.deepEqual(transport.sourceHashes,source.sourceHashes);
assert.equal(transport.controllerSha256,await hash(path.join(root,'scripts/desktop/test-creation-transport116-postgres.mjs')));
assert(transport.actualPostgres&&transport.actualMcpTransport&&transport.qaServicesStopped&&!transport.productionAccess);
assert.equal(transport.checks.length,9);assert.equal(transport.actualHttpActions,1);assert.equal(transport.providerRequests,0);assert.equal(transport.previewAcceptanceIntegrated,false);
assert.equal(transport.databaseQualification,previous.receipts.postgres.file);
const previousAudit=await json(previous.receipts.ordinaryAudit.file),audit=data.ordinaryAudit;
for(const key of ['counts','profiles','requestStatuses','instanceStatuses','schemaMigration','imageSha256'])assert.deepEqual(audit[key],previousAudit[key],key);
assert(audit.databaseReadOnly);assert.deepEqual(audit.problems,[]);for(const key of ['providerRequests','replayedRequests','servicesStartedOrStopped'])assert.equal(audit[key],0);
assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.75/resources/app.asar'),previousAudit.imageSha256);
receipts.previousCheckpoint={file:previousFile,sha256:await hash(previousFile)};
const brief=await readFile(path.join(root,'docs/desktop/continuation-brief116.md'),'utf8');for(const name of names)assert(brief.includes(path.basename(path.dirname(files[name]))),name);
const result={success:true,at:new Date().toISOString(),receipts,controllerSha256:await hash(import.meta.filename),sourceHashes:source.sourceHashes,installed:false,installedVersion:'0.44.75',candidateSchema:77,explicitCreationRemotePrincipalVerified:true,creationMcpSharedTransportVerified:true,stableCreationSourceIdentityVerified:true,preparedActionRevocationVerified:true,saveHandoffInvalidatesCreationVerified:true,backendOnly:true,rendererTestsReused:true,rendererCapturedSourcesUnchanged:true,focusedCases:256,existingBehaviorCases:152,recoveryCases:51,actualPostgresWorkflows:9,actualHttpActions:1,providerRequests:0,creationOAuthComplete:false,creationChromeComposioComplete:false,creationPreviewAcceptedContextComplete:false,newAgentConnectionTransportComplete:false,fullPreviewComplete:false,originalDraftWarningCauseConfirmed:false,fullGoalComplete:false};
const output=path.join(root,'.supabase/desktop-draft-preview76/checkpoint116.json');
const objectiveFile=path.join(root,'docs/desktop/active-goal-objective.json'),objective=await json(objectiveFile);assert.equal(objective.fullGoalComplete,false);assert.equal(objective.checkpoint,'F:/Agentopia/docs/desktop/continuation-brief115.md');
await writeFile(output,JSON.stringify(result,null,2)+'\n');objective.checkpoint='F:/Agentopia/docs/desktop/continuation-brief116.md';await writeFile(objectiveFile,JSON.stringify(objective,null,2)+'\n');console.log(JSON.stringify({success:true,evidence:output,installed:false,providerRequests:0,fullGoalComplete:false}));
