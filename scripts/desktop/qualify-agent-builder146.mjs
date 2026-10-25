import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
desktopOperation('bind agent builder source, rendered editor and real packaged/cold evidence');
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-agent-builder146'),proofFile=(await json(path.join(records,'current.json'))).proof,p=await json(proofFile),cfg=await json(p.qaIntent),source=await json(p.sourceQualification),uiFile=(await json(path.join(records,'ui-current.json'))).evidence,ui=await json(uiFile),liveFile=(await json(path.join(records,'live-schema83-current.json'))).evidence,live=await json(liveFile);
assert(source.success&&source.tests.includes('pass 89')&&source.tests.includes('fail 0'));
assert(ui.success&&ui.checks.length===7&&ui.rendererErrors.length===0&&ui.sourceImage===p.imageSha256);
assert(live.success&&live.warmNormalExit&&live.coldNoReplay&&live.qaRuntimeStopped&&live.checks.length===3&&live.requests.length===3&&live.rendererOwnerSynchronized);
assert(live.databaseBuilderChecks?.success&&live.databaseBuilderChecks.rejected===4);assert.equal(live.realOpenRouterRequests,0);assert(live.realOAuthResponseCalls>0&&live.realOAuthResponseCalls<=24);assert.equal(live.imageSha256,p.imageSha256);
assert(live.cleanup.calls.every(c=>c.provider==='openai-oauth')&&live.cleanup.tools.length===0&&live.cleanup.blocked.length===0);
assert(live.cleanup.leaseRemoved&&live.cleanup.oauthCredentialRemoved&&live.cleanup.routerCredentialRemoved);assert(!(await list(true)).includes(cfg.distribution));
for(const[name,digest]of Object.entries(p.sourceHashes)){assert.equal(await hash(path.join(root,'desktop',name)),digest);assert.equal(await hash(path.join(p.source,name)),digest);}
for(const[name,digest]of Object.entries(p.testHashes))assert.equal(await hash(path.join(root,'desktop/tests',name+'.test.cjs')),digest);
assert.equal(await hash(p.image),p.imageSha256);assert.equal(await hash('C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.76/resources/app.asar'),p.baseImageSha256);
p.acceptance={};for(const[name,file]of Object.entries({source:p.sourceQualification,ui:uiFile,live:liveFile,cold:live.coldEvidence}))p.acceptance[name]={file,sha256:await hash(file)};
p.actualPackagedRun=true;p.eligibleForProductionInstallation=true;p.acceptedAt=new Date().toISOString();p.installed=false;p.fullGoalComplete=false;await writeFile(proofFile,JSON.stringify(p,null,2));await writeFile(path.join(p.out,'qualification.json'),JSON.stringify({success:true,proof:proofFile,imageSha256:p.imageSha256,sourceChecks:89,renderedChecks:7,realOAuthResponseCalls:live.realOAuthResponseCalls,realOpenRouterRequests:0,warmNormalExit:true,coldNoReplay:true,sourceFilesChanged:p.sourceChanges.length,newDependencies:0,newDatabaseTables:0,receipts:p.acceptance,eligibleForProductionInstallation:true,installed:false,fullGoalComplete:false},null,2));console.log(JSON.stringify({success:true,proof:proofFile,eligibleForProductionInstallation:true,installed:false}));
