import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';
desktopOperation('bind persistent document source, restored database, native catalog and editor acceptance');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile);
const sourcePointer=await json(path.join(root,'.supabase/desktop-agent-documents70/current.json')),source=await json(sourcePointer.evidence);
const databaseFile=path.resolve(process.argv[2]),uiFile=path.resolve(process.argv[3]),database=await json(databaseFile),ui=await json(uiFile);
assert(source.success&&source.passed===12&&source.regressionCases===57&&source.actualCodexHarnessControlledAdapters&&source.controlledNativeResponses===3);
assert(database.success&&database.fullRestoredSchema&&database.existingRowsAndSchemaRestored&&database.qaServicesStopped&&database.checks.length===6);
assert(ui.success&&ui.checks.length===6&&ui.rendererErrors.length===0);
for(const e of [source,database,ui])assert.equal(e.providerRequests,0);
for(const [file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,'Qualified source changed: '+file);
for(const [file,digest]of Object.entries(ui.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,'Qualified interface changed: '+file);
const out=path.join(root,'.supabase/desktop-agent-documents70','qualified-'+Date.now());await mkdir(out);
const normalization={};
// Existing sources have mixed line endings. Preserve their tested preimages,
// normalize only those bytes, then prove that the compiled modules are equal.
for(const file of ['desktop/src/broker.ts','desktop/src/codex-harness.ts','desktop/src/tool-service.ts','desktop/ui/AgentSettings.tsx']){
 const before=await readFile(path.join(root,file),'utf8'),after=before.replaceAll('\r\n','\n');
 const saved=path.join(out,'before-'+path.basename(file));await writeFile(saved,before);
 const originalSha256=await hash(saved);assert.equal(originalSha256,source.sourceHashes[file]);
 await writeFile(path.join(root,file),after);normalization[file]={before:saved,originalSha256,normalizedSha256:await hash(path.join(root,file)),onlyCrLfRemoved:true};
}
const build=path.join(out,'build');
await exec(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError'],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
await exec(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p','desktop/ui/tsconfig.json'],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
const compiledModules={};
for(const file of ['agent-documents.js','broker.js','tool-service.js','codex-harness.js','documents.js']){
 const digest=await hash(path.join(build,file));assert.equal(digest,await hash(path.join(source.build,file)),file+' changed after line-ending normalization');compiledModules[file]=digest;
}
const sourceHashes={};for(const file of new Set([...Object.keys(source.sourceHashes),...Object.keys(ui.sourceHashes),'scripts/desktop/qualify-agent-documents70.mjs']))sourceHashes[file]=await hash(path.join(root,file));
const e={success:true,at:new Date().toISOString(),out,sourceOnly:true,installed:false,ordinaryVersion:'0.44.69',nextCandidateVersion:'0.44.70',databaseMigration:71,recoveryFormat:12,
 sourceAcceptance:sourcePointer.evidence,databaseAcceptance:databaseFile,interfaceAcceptance:uiFile,
 sourceCases:12,regressionCases:57,interfaceWorkflows:6,realDatabaseChecks:6,
 actualCodexCatalogAndPromptThroughBothAdapters:true,controlledNativeResponses:3,liveProviderRequests:0,
 retainedOriginalsInDatabaseRecovery:true,fullRestoredDatabaseSchemaTested:true,qaRowsAndSchemaRestored:true,
 sourceHashes,normalization,compiledBuild:build,compiledModules,
 actualPackagedDocumentReadStillPending:true,ordinaryUploadAndReadStillPending:true,
 pdfPageImagesThroughNewToolNotYetPackagedVerified:true,schedulingAndNamedChildDocumentUseStillPending:true,
 fullGoalComplete:false};
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-agent-documents70/qualified-current.json'),JSON.stringify({out,evidence:file},null,2));
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
ledger.agentDocuments70={...e,normalizationEvidence:file};ledger.latestGoalTurnOutcome={at:e.at,outcome:'Implemented persistent agent documents and qualified source, actual restored-database recovery, native catalog on both adapters and editor workflows. Ordinary app remains69; package/installed acceptance remains.',evidence:file,fullGoalComplete:false};ledger.fullGoalComplete=false;
await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,sourceCases:12,regressionCases:57,interfaceWorkflows:6,realDatabaseChecks:6,installed:false,providerRequests:0}));
