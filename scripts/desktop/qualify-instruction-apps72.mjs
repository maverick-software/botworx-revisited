import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind instruction app source, renderer, native adapter and draft evidence');
const root=path.resolve(import.meta.dirname,'../..'),family=path.join(root,'.supabase/desktop-instruction-apps72');
assert.equal(process.argv.length,7,'Pass UI, rich-editor, full-app, native and draft evidence files.');
const sourceFile=(await json(path.join(family,'current.json'))).evidence,source=await json(sourceFile);
const [uiFile,richFile,appFile,nativeFile,draftFile]=process.argv.slice(2).map(file=>path.resolve(file));
const [ui,rich,app,native,draft]=await Promise.all([uiFile,richFile,appFile,nativeFile,draftFile].map(json));
assert(source.success&&source.sourceOnly&&source.focusedCases===6&&source.regressionCases===13);
assert(source.commands.length===4&&source.commands.every(command=>command.code===0));
for(const [e,count]of [[ui,14],[rich,8],[app,20],[draft,8]])assert(e.success&&e.checks.length===count&&e.rendererErrors.length===0&&e.productionAccess===false);
assert(ui.externalRequests.length===0&&rich.externalRequests.length===0);
assert(native.success&&native.actualCodexHarness&&native.controlledResponses&&native.actualBroker===false&&native.actualPostgres===false);
assert(native.nativeTurns===3&&native.controlledModelSteps===5&&native.assignedSchemaDiscoveries===2&&native.providerRequests===0&&native.productionAccess===false);
assert.deepEqual(native.providerAdapters,['openai-oauth','openrouter']);
assert.equal(app.sourceQualification,sourceFile);assert.equal(native.sourceQualification,sourceFile);
assert.equal(path.resolve(draft.rendererResources),path.resolve(app.rendererResources));
// The draft runner calls any supplied renderer resources packaged. This run used a source Vite build.
assert(app.sourceOnly&&app.controlledBridge&&draft.controlledBridge&&draft.inferenceRequests===0);
for(const e of [source,ui,rich,app])assert.equal(e.providerRequests,0);
const sourceHashes={};
for(const [e,prefix,key]of [[source,'','sourceHashes'],[ui,'desktop/','sourceHashes'],[rich,'desktop/','sourceHashes'],[app,'','sourceHashes'],[draft,'','sourceSha256']]){
 for(const [file,digest]of Object.entries(e[key])){const relative=prefix+file;assert.equal(await hash(path.join(root,relative)),digest,relative);if(sourceHashes[relative])assert.equal(sourceHashes[relative],digest);sourceHashes[relative]=digest;}
}
assert.equal(await hash(path.join(root,'desktop/tests/instruction-app-native.test.cjs')),native.fixtureSha256);
assert.equal(await hash(path.join(root,'scripts/desktop/test-instruction-apps72-native.mjs')),native.controllerSha256);
const modules={};for(const name of ['instruction-app-references.js','broker.js','codex-harness.js','codex-mcp.js','codex-client.js','codex-gateway.js'])modules[name]=await hash(path.join(source.build,name));
const publishedControllers={};for(const name of ['test-instruction-apps72.mjs','test-instruction-apps72-ui.mjs','instruction-apps72-fixture.tsx','test-instruction-apps72-app.mjs','test-instruction-apps72-native.mjs','qualify-instruction-apps72.mjs','test-instruction-editor67.mjs','test-chat-acceptance-drafts-ui.mjs'])publishedControllers[name]=await hash(path.join(root,'scripts/desktop',name));
const rendererHashes={};async function tree(directory,relative=''){for(const entry of await readdir(directory,{withFileTypes:true})){const next=path.join(directory,entry.name),name=path.posix.join(relative,entry.name);if(entry.isDirectory())await tree(next,name);else if(entry.isFile())rendererHashes[name]=await hash(next);else throw Error('Unexpected renderer entry: '+name);}}await tree(app.rendererResources);
const evidenceFiles={source:sourceFile,instructionUi:uiFile,richEditor:richFile,fullApp:appFile,native:nativeFile,drafts:draftFile},evidenceHashes={};for(const [name,file]of Object.entries(evidenceFiles))evidenceHashes[name]=await hash(file);
const screenshots={};for(const name of ['app-picker-1200-light.png','app-picker-480-dark.png'])screenshots[name]=await hash(path.join(ui.out,name));
const packageVersion=(await json(path.join(root,'package.json'))).version,lockVersion=(await json(path.join(root,'package-lock.json'))).version;assert.equal(packageVersion,'0.44.71');assert.equal(lockVersion,packageVersion);
const out=path.join(family,'qualified-'+Date.now());await mkdir(out);
const e={success:true,at:new Date().toISOString(),out,nextVersion:'0.44.72',sourceOnly:true,installed:false,ordinaryVersion:'0.44.71',schemaVersion:72,recoveryVersion:12,fullGoalComplete:false,sourceHashes,compiledModules:modules,build:source.build,publishedControllers,controllerFingerprintsRecordedAtQualification:true,rendererResources:app.rendererResources,rendererHashes,evidenceFiles,evidenceHashes,screenshots,
 focusedCases:6,policyRegressions:13,instructionUiWorkflows:14,richEditorRegressions:8,fullAppWorkflows:20,draftWorkflows:8,nativeTurns:3,controlledModelSteps:5,actualNativeSchemaDispatches:2,actualCodexHarness:true,actualBroker:false,actualPostgres:false,controlledBridge:true,controlledProviderResponses:true,providerRequests:0,productionAccess:false,ordinaryProfileWrites:false,modelComprehensionTested:false,
 stableConnectionIdentity:true,referencesGrantNoPermissions:true,sourceBytesPreserved:true,newerDraftDuringSavePreserved:true,sharedEditorCatalog:true,packageAndInstalledVersionUnchanged:true,
 pending:['Freeze and qualify the version72 archive and all affected modules.','Exercise actual Broker, scoped catalog and save/reload using an owned PostgreSQL runtime, including foreign, revoked and policy-filtered apps.','Exact-version whole-profile recovery, installer verification and fresh ordinary-profile recovery/update.','Ordinary native-window visual acceptance after unlock; remaining parity, reference comparisons, physical reboot and different-user recovery.']};
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});await writeFile(path.join(family,'qualified-current.json'),JSON.stringify({success:true,evidence:file},null,2));
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);ledger.instructionApps72Source={...e,evidence:file};ledger.latestGoalTurnOutcome={at:e.at,outcome:'Instruction app references and pending-save draft preservation pass source, controlled renderer and actual Codex harness adapter checks. Installed app remains71; actual Broker/PostgreSQL, package72, recovery and installation remain.',evidence:file,fullGoalComplete:false};ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,sourceOnly:true,ordinaryVersion:e.ordinaryVersion,focusedCases:6,policyRegressions:13,uiWorkflows:14,richRegressions:8,fullAppWorkflows:20,draftWorkflows:8,nativeTurns:3,providerRequests:0}));
