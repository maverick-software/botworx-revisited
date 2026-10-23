import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('bind source library lifecycle, renderer workflows and streaming recovery qualification');
const root=path.resolve(import.meta.dirname,'../..');
const sourceFile=(await json(path.join(root,'.supabase/desktop-agent-library71/current.json'))).evidence,source=await json(sourceFile);
const uiFile=path.resolve(process.argv[2]),ui=await json(uiFile);
const databaseSourceFile=path.resolve(process.argv[3]),databaseSource=await json(databaseSourceFile);assert(databaseSource.success);
const databaseFile=(await json(path.join(root,'.supabase/desktop-agent-library71/postgres-current.json'))).evidence,database=await json(databaseFile);
const auditFile=(await json(path.join(root,'.supabase/desktop-logical-audit71/qualified-current.json'))).evidence,audit=await json(auditFile);
assert(source.success&&source.focusedCases===20&&source.regressionCases===21);
assert(ui.success&&ui.checks.length===15&&ui.rendererErrors.length===0);
assert(database.success&&database.checks.length===11&&database.previousRowsAndSchemaRestored&&database.qaServicesStopped);
assert(database.checks.some(text=>text.includes('scanned PDF replacement renders page three')));
assert(audit.success&&audit.unitCases===10&&audit.qaOriginals===3&&audit.production.tablesCompared===127&&audit.production.allApplicationTablesCovered);
for(const [file,digest]of Object.entries(source.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
for(const [file,digest]of Object.entries(ui.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);
for(const [file,digest]of Object.entries(audit.sourceHashes))assert.equal(await hash(path.join(root,'scripts/desktop',file)),digest,file);
const publishedModules={};for(const name of ['agent-documents.js','agent-library-contracts.js','broker.js','settings.js','documents.js','pdf-pages.js']){publishedModules[name]=await hash(path.join(source.build,name));assert.equal(publishedModules[name],await hash(path.join(databaseSource.build,name)),'Database-tested module changed: '+name);}
assert.equal(source.sourceHashes['desktop/database/0072-agent-document-library.sql'],databaseSource.sourceHashes['desktop/database/0072-agent-document-library.sql']);
const controllers={};for(const name of ['test-agent-library71.mjs','test-agent-library71-ui.mjs','test-agent-library71-client.cjs','test-agent-library71-electron.cjs','test-agent-library71-postgres.py','test-agent-library71-postgres.mjs'])controllers[name]=await hash(path.join(root,'scripts/desktop',name));
const out=path.join(root,'.supabase/desktop-agent-library71','qualified-'+Date.now());await mkdir(out);
const e={success:true,at:new Date().toISOString(),out,nextVersion:'0.44.71',sourceOnly:true,installed:false,ordinaryVersion:'0.44.70',
 sourceQualification:sourceFile,sourceHashes:{...source.sourceHashes,...ui.sourceHashes},compiledModules:publishedModules,build:source.build,publishedControllers:controllers,
 focusedCases:20,relatedRegressionCases:21,interfaceEvidence:uiFile,interfaceWorkflows:15,realDatabaseEvidence:databaseFile,realDatabaseSourceQualification:databaseSourceFile,databaseTestedModulesMatch:true,realDatabaseChecks:11,
 actualScopedTextAndPdfReplacement:true,originalsAndPreviousVersionsRetained:true,archiveRevokesAllAssignments:true,restoreDoesNotAssign:true,
 optimisticVersionAndTimestampChecks:true,accountIsolationAndBrokerOnlyHistory:true,previousQaRowsAndSchemaRestored:true,qaServicesStopped:true,
 streamingAuditQualification:auditFile,streamingAuditUnitCases:10,streamingAuditQaOriginals:3,streamingProductionTables:127,
 streamingProductionRows:audit.production.savedRowsCompared,ordinaryMaintenanceAndPackageUnchanged:true,
 providerRequests:0,imageGenerationEnabled:false,modelComprehensionTested:false,fullGoalComplete:false,
 pending:['Freeze version71 with schema72 and verify every changed archived module and interface.','Actual packaged lifecycle/native scope checks and retained-version whole-profile recovery.','Verified installer, fresh ordinary recovery/update and installed-data/native-UI acceptance.','Remaining desktop parity, reference comparisons, physical reboot and different-user recovery.']};
const file=path.join(out,'evidence.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-agent-library71/qualified-current.json'),JSON.stringify({success:true,evidence:file},null,2));
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
ledger.agentLibrary71Source={...e,evidence:file};ledger.logicalAudit71={success:true,evidence:auditFile,productionTables:127,productionRows:audit.production.savedRowsCompared,qaOriginals:3};
ledger.latestGoalTurnOutcome={at:e.at,outcome:'Schema-aware streaming recovery audit passes production/QA. Library organization, archive, file replacement/history and scope guards pass source, renderer and real database acceptance. Ordinary version remains70; package71 gates remain.',evidence:file,fullGoalComplete:false};
ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,sourceOnly:true,focusedCases:20,regressions:21,uiWorkflows:15,databaseChecks:11,ordinaryVersion:'0.44.70',providerRequests:0}));
