import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
desktopOperation('bind retained child continuation source, packaged, interruption and OAuth evidence');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-preview-continuation140'),proofFile=(await json(path.join(records,'current.json'))).proof,p=await json(proofFile),cfg=await json(p.qaIntent),receipts={};
assert(!(await list(true)).includes(cfg.distribution));
for(const name of ['packaged','gap','live']){const file=(await json(path.join(records,name+'-current.json'))).evidence,value=await json(file);assert(value.success&&value.qaRuntimeStopped&&!value.diagnosticProbe,name);assert.equal(value.imageSha256,p.imageSha256);receipts[name]={file,sha256:await hash(file),value};}
const {packaged:{value:w},gap:{value:g},live:{value:l}}=receipts;
assert.equal(w.checks.length,9);assert(w.zeroColdReplay&&w.warmNormalUnchanged&&w.coldNormalUnchanged&&w.refusalBeforeInference);assert.equal(w.realProviderRequests,0);
assert(g.syntheticAcceptanceGap&&g.savedBeforeDispatch&&g.interruptedTextRetained&&g.duplicateCannotDispatch&&g.zeroReplay&&g.normalUnchanged);assert.equal(g.providerRequests,0);
assert(l.normalUnchanged&&l.independent.success&&Object.values(l.independent).every(value=>value===true));assert.equal(l.realOAuthResponseCalls,14);assert.equal(l.realOpenRouterRequests,0);assert.equal(l.reviews.length,2);assert(l.reviews.every(review=>review.exactReceipt&&review.defaultPermissions));assert(l.cleanup.leaseRemoved&&l.cleanup.oauthCredentialRemoved&&l.cleanup.routerCredentialRemoved);assert.deepEqual(l.cleanup.blocked,[]);
assert.match(await readFile(path.join(p.out,'tests-final.log'),'utf8'),/tests 138[\s\S]*pass 138[\s\S]*fail 0/);
for(const [name,digest]of Object.entries(p.sourceHashes))assert.equal(await hash(path.join(root,'desktop',name)),digest);
for(const [name,digest]of Object.entries(p.testHashes))assert.equal(await hash(path.join(root,'desktop/tests',name+'.test.cjs')),digest);
assert.equal(await hash(p.image),p.imageSha256);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.76/resources/app.asar'),p.baseImageSha256);
p.actualPackagedRun=true;p.eligibleForProductionInstallation=true;p.acceptance=Object.fromEntries(Object.entries(receipts).map(([name,{file,sha256}])=>[name,{file,sha256}]));p.acceptedAt=new Date().toISOString();await writeFile(proofFile,JSON.stringify(p,null,2));
await writeFile(path.join(p.out,'qualification.json'),JSON.stringify({success:true,proof:proofFile,imageSha256:p.imageSha256,sourceChecks:138,packagedChecks:9,interruptedInstructionRetained:true,realOAuthResponseCalls:l.realOAuthResponseCalls,receipts:p.acceptance,installed:false,fullGoalComplete:false},null,2));console.log(JSON.stringify({success:true,out:p.out,eligibleForProductionInstallation:true,installed:false}));
