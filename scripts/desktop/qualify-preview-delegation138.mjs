import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
desktopOperation('bind preview delegation source, packaged, cold and OAuth evidence');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-preview-delegation138'),proofFile=(await json(path.join(records,'current.json'))).proof,p=await json(proofFile),cfg=await json(p.qaIntent),receipts={};
assert(!(await list(true)).includes(cfg.distribution));
for(const name of ['packaged','cold','live']){const file=(await json(path.join(records,name+'-current.json'))).evidence,value=await json(file);assert(value.success&&value.qaRuntimeStopped&&!value.diagnosticProbe,name);assert.equal(value.imageSha256,p.imageSha256);receipts[name]={file,sha256:await hash(file),value};}
const {packaged:{value:w},cold:{value:c},live:{value:l}}=receipts;
assert.equal(w.checks.length,7);assert(w.realChildProcessStopped&&w.normalUnchanged);assert.equal(w.realProviderRequests,0);assert(c.childTranscriptsRetained&&c.reportsRetained&&c.previewToolReceiptsRetained&&c.normalUnchanged);assert.equal(c.modelRequests,0);assert.equal(c.executionReplays,0);assert(l.initialReplyBeforeChildFinished&&l.normalUnchanged&&l.independent.exactReceipt&&l.independent.sourcePreserved&&l.independent.oneOwnedChild&&l.independent.automaticReport&&l.independent.reviewedWrite);assert.equal(l.realOpenRouterRequests,0);assert(l.cleanup.leaseRemoved&&l.cleanup.oauthCredentialRemoved&&l.cleanup.routerCredentialRemoved);assert.deepEqual(l.cleanup.blocked,[]);
if(l.priorReview){assert(l.priorReview.completedWithoutFileTools&&l.priorReview.noReceipt&&l.priorReview.inputUnchanged&&l.priorReview.oldRequestWillNotBeReplayed);assert.equal(await hash(l.priorReview.file),l.priorReview.sha256);receipts.priorTaskSetup={file:l.priorReview.file,sha256:l.priorReview.sha256};}
assert.match(await readFile(path.join(p.out,'tests.log'),'utf8'),/tests 129[\s\S]*pass 129[\s\S]*fail 0/);
for(const [name,digest]of Object.entries(p.sourceHashes))assert.equal(await hash(path.join(root,'desktop',name)),digest);
for(const [name,digest]of Object.entries(p.testHashes))assert.equal(await hash(path.join(root,'desktop/tests',name+'.test.cjs')),digest);
assert.equal(await hash(p.image),p.imageSha256);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.76/resources/app.asar'),p.baseImageSha256);
p.actualPackagedRun=true;p.eligibleForProductionInstallation=true;p.acceptance=Object.fromEntries(Object.entries(receipts).map(([name,{file,sha256}])=>[name,{file,sha256}]));p.acceptedAt=new Date().toISOString();await writeFile(proofFile,JSON.stringify(p,null,2));
await writeFile(path.join(p.out,'qualification.json'),JSON.stringify({success:true,proof:proofFile,imageSha256:p.imageSha256,sourceChecks:129,packagedChecks:7,coldRequestsRetained:c.requestsRetained,realOAuthResponseCalls:l.realOAuthResponseCalls,receipts:p.acceptance,installed:false,fullGoalComplete:false},null,2));console.log(JSON.stringify({success:true,out:p.out,eligibleForProductionInstallation:true,installed:false}));
