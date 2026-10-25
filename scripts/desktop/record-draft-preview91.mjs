import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {json,hash} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('record source preview interface and ordinary recovery checkpoint91');
const root=path.resolve(import.meta.dirname,'../..');
const files={
 source:'.supabase/desktop-draft-preview76/source-1792787950655/evidence.json',
 previewUI:'.supabase/desktop-draft-preview76/1792788056656/evidence.json',
 applicationUI:'.supabase/desktop-agent-creation75-app/1792788077137/evidence.json',
 broker:'.supabase/desktop-draft-preview76/broker-1792788113460/evidence.json',
 nativeRetry:'.supabase/desktop-computer-retry76/1792788331098/evidence.json',
 ordinaryAudit:'.supabase/desktop-agent-health75/1792788329337/evidence.json'
};
const data={},qualifications={};
for(const[name,file]of Object.entries(files)){const absolute=path.join(root,file);data[name]=await json(absolute);assert.equal(data[name].success,true,name);qualifications[name]={file:absolute,sha256:await hash(absolute)};}
assert.equal(data.source.focusedCases,68);assert.equal(data.source.regressionCases,113);
assert.equal(data.previewUI.checks.length,17);assert.equal(data.applicationUI.checks.length,23);
assert.deepEqual(data.previewUI.rendererErrors,[]);assert.deepEqual(data.applicationUI.rendererErrors,[]);
assert.equal(data.broker.checks.length,12);assert.equal(data.broker.calls.length,4);assert(data.broker.qaServicesStopped);
assert.equal(data.broker.realProviderRequests,0);assert.equal(data.nativeRetry.providerRequests,0);
assert(data.nativeRetry.coldDraftExact&&data.nativeRetry.generatedDraftCleared&&!data.nativeRetry.draftWarningReproduced&&!data.nativeRetry.closeAnywayUsed);
for(const[file,digest]of Object.entries(data.source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
assert.deepEqual(data.source.sourceHashes,data.broker.sourceHashes);
for(const[file,digest]of Object.entries(data.previewUI.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
for(const[file,digest]of Object.entries(data.applicationUI.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
const oldAudit=await json(path.join(root,'.supabase/desktop-agent-health75/1792786370598/evidence.json'));
for(const key of ['counts','profiles','instanceStatuses','requestStatuses'])assert.deepEqual(data.ordinaryAudit[key],oldAudit[key],key);
const installed=await json((await json(path.join(root,'.supabase/desktop-computer-repair76/installed-current.json'))).proof);
assert.equal(await hash(installed.image),installed.imageSha256);assert.equal(data.ordinaryAudit.imageSha256,installed.imageSha256);
const result={success:true,at:new Date().toISOString(),fullGoalComplete:false,installedVersion:'0.44.75',installedImageSha256:installed.imageSha256,installedComponentsChanged:false,productionMigration:false,ordinaryNormalRestart:true,sourceHashes:data.source.sourceHashes,qualifications,focusedCases:68,regressionsPassed:113,optionalRegressionSkipped:1,previewUIWorkflows:17,applicationUIWorkflows:23,actualBrokerWorkflows:12,scriptedProviderReplies:4,realProviderRequests:0,qaServicesStopped:true,UIIntegratedInSource:true,completeLiveUIAcceptance:false,fullEditorColdRecovery:false,previewBackupRestoration:false,remaining:'All remaining preview tool/resource families and root-independent background leases; full editor/cache/database/native backup restoration; complete renderer-to-Broker/live comprehension; exact package/recovery/install; broader parity work.'};
const checkpoint=path.join(root,'.supabase/desktop-draft-preview76/checkpoint91.json');await writeFile(checkpoint,JSON.stringify(result,null,2));
const goalFile=path.join(root,'docs/desktop/active-goal-objective.json'),goal=await readFile(goalFile,'utf8');assert(goal.includes('F:/Agentopia/docs/desktop/continuation-brief90.md'));await writeFile(goalFile,goal.replace('F:/Agentopia/docs/desktop/continuation-brief90.md','F:/Agentopia/docs/desktop/continuation-brief91.md'));
console.log(JSON.stringify({success:true,checkpoint,fullGoalComplete:false,installedComponentsChanged:false,ordinaryDataPreserved:true}));
