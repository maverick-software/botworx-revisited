import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {json,hash} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('record exact clipboard-preview qualification and unchanged installed profile');
const root=path.resolve(import.meta.dirname,'../..');
assert.equal(process.argv.length,9,'Pass source, clipboard UI, native, preview UI, Broker, full application UI and ordinary audit evidence.');
const names=['source','clipboardUI','native','previewUI','broker','applicationUI','ordinaryAudit'],rows={},receipts={};
for(const [index,name] of names.entries()){
 const file=path.resolve(process.argv[index+2]),row=await json(file);assert(row.success,name);rows[name]=row;receipts[name]={file,sha256:await hash(file)};
 for(const [relative,digest] of Object.entries(row.sourceHashes??{}))assert.equal(await hash(path.join(root,relative)),digest,name+': '+relative);
}
assert.equal(rows.source.focusedCases,165);assert.equal(rows.source.regressionCases,116);assert.equal(rows.source.recoveryCases,51);assert(rows.source.commands.every(row=>row.code===0));
assert.equal(rows.clipboardUI.checks.length,9);assert.equal(rows.previewUI.checks.length,18);assert.equal(rows.applicationUI.checks.length,23);
for(const name of ['clipboardUI','previewUI','applicationUI']){assert.deepEqual(rows[name].rendererErrors,[]);assert.equal(rows[name].providerRequests,0);}
for(const name of ['native','broker']){assert.equal(rows[name].sourceQualification,receipts.source.file);assert.deepEqual(rows[name].sourceHashes,rows.source.sourceHashes);assert.equal(rows[name].realProviderRequests,0);assert(rows[name].qaServicesStopped);}
assert.equal(rows.native.checks.length,11);assert.equal(rows.native.calls.length,13);assert.equal(rows.native.clipboardRequests.length,2);assert.deepEqual(rows.native.clipboardRequests.map(row=>row.provider),['openai-oauth','openrouter']);
assert(rows.native.clipboardRequests.every(row=>row.forgottenNextTurnRefused&&row.completedRetryDidNotReplay));assert.equal(rows.native.imageShapes.length,2);assert(rows.native.imageShapes.every(row=>row.images.length===1&&row.images[0].type==='input_image'&&row.images[0].key==='image_url'));
assert.equal(rows.broker.checks.length,18);assert.equal(rows.broker.calls.length,4);
const controllers={source:'test-agent-draft-preview76-source.mjs',native:'test-draft-preview-model-tools76.mjs',previewUI:'test-agent-draft-preview76.mjs',broker:'test-draft-preview-broker76.mjs',applicationUI:'test-agent-creation75-app.mjs'};
for(const[name,file]of Object.entries(controllers))assert.equal(rows[name].controllerSha256,await hash(path.join(root,'scripts/desktop',file)),name+' controller');
const baseline=await json(path.join(root,'.supabase/desktop-agent-health75/1792804294384/evidence.json'));
for(const key of ['counts','profiles','requestStatuses','instanceStatuses','imageSha256','schemaMigration'])assert.deepEqual(rows.ordinaryAudit[key],baseline[key],key);
assert.equal(rows.ordinaryAudit.providerRequests,0);assert.equal(rows.ordinaryAudit.servicesStartedOrStopped,0);assert(rows.ordinaryAudit.databaseReadOnly);
assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.75/resources/app.asar'),baseline.imageSha256);
const checkpoint={success:true,at:new Date().toISOString(),receipts,controllerSha256:await hash(import.meta.filename),sourceOnly:true,installed:false,installedVersion:'0.44.75',installedImageSha256:baseline.imageSha256,ordinaryDataPreserved:true,counts:rows.ordinaryAudit.counts,realProviderRequests:0,controlledNativeRequests:17,clipboardImageExactNativeInputBothRoutes:true,clipboardDisplayPathGrantedAsFilesystem:false,originalDraftWarningCauseConfirmed:false,fullPreviewComplete:false,fullGoalComplete:false};
const output=path.join(root,'.supabase/desktop-draft-preview76/checkpoint104.json');await writeFile(output,JSON.stringify(checkpoint,null,2));
const objectiveFile=path.join(root,'docs/desktop/active-goal-objective.json'),objective=await json(objectiveFile);assert.equal(objective.fullGoalComplete,false);assert.equal(objective.checkpoint,'F:/Agentopia/docs/desktop/continuation-brief103.md');objective.checkpoint='F:/Agentopia/docs/desktop/continuation-brief104.md';await writeFile(objectiveFile,JSON.stringify(objective,null,2)+'\n');
console.log(JSON.stringify({success:true,evidence:output,installed:false,realProviderRequests:0,fullGoalComplete:false}));
