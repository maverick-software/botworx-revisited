import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {json,hash,save} from './phased-backup-control.mjs';
const root=path.resolve(import.meta.dirname,'../..'),records=path.join(root,'.supabase/desktop-scheduled-workspaces67'),pointers={},proofs={};
for(const name of ['independent-red','independent','maintenance','links','controls','foundation','ui']){
 pointers[name]=await json(path.join(records,'current-'+name+'.json'));
 proofs[name]=await json(pointers[name].evidence);assert(proofs[name].success);
}
assert.equal(proofs['independent-red'].expectedFailure,true);assert.equal(proofs['independent-red'].failed,1);
assert.equal(proofs.independent.passed,8);assert.equal(proofs.maintenance.passed,101);
assert.equal(proofs.links.passed,20);assert.equal(proofs.controls.passed,34);assert.equal(proofs.foundation.passed,114);
assert.equal(proofs.ui.checks.length,10);assert.deepEqual(proofs.ui.rendererErrors,[]);
const tap=await readFile(path.join(proofs.maintenance.out,'tests.tap'),'utf8');
assert.equal([...tap.matchAll(/^ok \d+ - Git storage layout /gm)].length,23);
assert.equal([...tap.matchAll(/^ok \d+ - Independent Git recovery /gm)].length,8);
const sourceHashes={};
for(const [kind,proof]of Object.entries(proofs)){
 if(kind==='independent-red')continue;
 for(const [name,digest]of Object.entries(proof.sourceHashes)){
  const file=kind==='foundation'?'desktop/'+name:name;
  assert.equal(await hash(path.join(root,file)),digest,file+' changed after qualification');
  if(sourceHashes[file])assert.equal(sourceHashes[file],digest);sourceHashes[file]=digest;
 }
}
sourceHashes['AGENTS.md']=await hash(path.join(root,'AGENTS.md'));
sourceHashes['scripts/desktop/record-scheduled-workspaces67-independent.mjs']=await hash(import.meta.filename);
const priorFile=path.join(records,'git-storage-qualified.json'),prior=await json(priorFile),database=await json(path.join(records,'database-qualified.json'));
assert.equal(await hash(prior.installedArchive),prior.installedImageSha256);
assert.equal(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,'0.44.66');
assert.equal(await hash(path.join(root,'desktop/database/0070-scheduled-project-workspaces.sql')),database.migrationSha256);
const pending=[
 'Implement and qualify full-profile and portable backup/restore coverage for recovery archives, owner journals, history, public workspaces and independent restored copies. Bind sealed archive ownership before extraction/removal; verify relocation rebinding, restored-profile cold startup and saved document links.',
 'Verify restored-owned file aliases inside documents and earlier in long chats. The current mapper still requires an offered link among only the latest 200 assistant messages; align ordinary owned-file navigation and private-scratch export checks with their actual permissions.',
 'Run combined packaged real PostgreSQL/Git/Codex per-project dispatch, grant revocation during tool review, cancellation and cold zero-replay recovery, including the source-qualified SHA-256 restoration path.',
 'Qualify complete source/archive/installer, capture fresh matching recovery, install under standing authorization and verify preserved accounts, data, connections, agents and disabled images after normal reopening.',
 'Obtain fresh ordinary/reference screenshot comparison when the supported Windows inspection runtime works. Live Composio and connected Google conversion still need the pending valid project API key.'
];
const record={success:true,at:new Date().toISOString(),sourceOnly:true,installed:'0.44.66',installedArchive:prior.installedArchive,installedImageSha256:prior.installedImageSha256,priorQualification:priorFile,checks:Object.fromEntries(Object.entries(pointers).map(([name,value])=>[name,value.evidence])),independentCases:8,maintenanceCases:101,includedGitStorageCases:23,priorOutputCases:20,controlsCases:34,foundationCases:114,renderedUiCases:10,actualGitAndFilesystem:true,missingHistoryReproducedBeforeFix:true,independentRebuildRequiredBeforeRemoval:true,sealedRebuildReceiptRequired:true,shallowHistoryPreserved:true,graftHistoryPreserved:true,binaryImportCancellationTested:true,incompletePrivateCopiesRetained:true,sourceCommonPointerRejected:true,controlledSecretsAndDatabase:true,actualProductionDatabase:false,actualProfileRelocation:false,productionMigrationApplied:false,lastVerifiedProductionSchema:69,migrationSha256:database.migrationSha256,sourceHashes,providerRequests:0,productionWrites:0,imageSettingsWritten:false,imagePreferencePreservedByThisWork:true,delivered:false,fullFeatureComplete:false,fullGoalComplete:false,pending};
const target=path.join(records,'independent-qualified.json');await save(target,record);
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);
Object.assign(ledger,{at:record.at,latestGoalTurnOutcome:'progress: qualified an independent Git rebuild before offering workspace archive removal. Eight targeted cases and the full101 recovery tests pass, including shallow/graft history, incomplete packs, interrupted binary import and sealed proof integrity. Controls34, scheduling114 and rendered workflows10 pass; unchanged output checks20 retained. Source-only; installed66 and disabled images unchanged.',fullGoalComplete:false});
Object.assign(ledger.sourceWork67,{phase:'Independent pre-removal Git reconstruction source-qualified; full/portable recovery and combined packaged acceptance remain',qualification:target,sourceOnly:true,installed:false,fullFeatureComplete:false,independent:pointers.independent.evidence,independentCases:8,independentRed:pointers['independent-red'].evidence,maintenance:pointers.maintenance.evidence,maintenanceCases:101,includedGitStorageCases:23,links:pointers.links.evidence,priorChatOutputCases:20,controls:pointers.controls.evidence,controlsCases:34,foundation:pointers.foundation.evidence,foundationCases:114,ui:pointers.ui.evidence,uiCases:10,independentReconstructionBeforeRemovalQualified:true,portableRecoveryOfNewWorkspacesComplete:false,sourceHashes,pending});
ledger.next[0]='Continue source67 from docs/desktop/scheduled-workspaces67-plan.md. independent-qualified.json covers8 independent-rebuild cases included in101 recovery cases, with23 Git storage cases also included;20 prior output checks,34 controls,114 scheduling checks and10 rendered workflows pass. The original workspace remains until independent reconstruction and matching sealed proof succeed. Finish sealed ownership checks/full portable backup graph, owned-link permissions, relocation/rebinding and actual cold recovery, then combined packaged PostgreSQL/Git/Codex acceptance and recoverable installation. Source/package and ordinary installed version remain66; production migration70 not applied. Keep images disabled and do not replay completed goal68 or uncertain/completed requests.';
await save(ledgerFile,ledger);
const file=path.join(root,'docs/desktop/scheduled-workspaces67-plan.md'),marker='\n## Independent reconstruction before archive removal\n';
let plan=await readFile(file,'utf8');assert(!plan.includes(marker),'Append this qualification once; retain existing history.');
plan+=marker+`
A generated two-commit repository exposed the remaining gap in checking a recovery bundle inside its source repository: a valid-looking bundle with a missing ancestor was accepted for review. The retained pre-fix reproduction is \`${pointers['independent-red'].evidence}\`. The experiment offered a review only; it did not remove the original workspace.

Before offering removal, the production capture path now builds a fresh private repository with no source/common-directory pointer or alternate object pool. It streams the captured pack into this empty repository and asks Git to verify the complete recorded history and both recorded commits. Only success produces a receipt tied to the bundle hash, checkout HEAD, captured commit, recovery reference and history rules. The receipt is sealed in the archive; removal checks it against the owned operation and verified archive. Missing, changed or forged proof holds the operation before any original-workspace rename. A failed or cancelled verification retains its unfinished private copy, original workspace and temporary recovery reference for inspection, with no automatic retry.

Repositories with only part of their history (shallow clones) and explicitly changed parent history (grafts) need their original history rules to rebuild the same Git view. Those bounded, validated rules are captured, hashed and installed only in the new private repository. They are checked again against the source before review and preserved through independent restoration. No source hooks or arbitrary configuration are copied. A changed history rule or an injected pointer back to the source holds the operation.

Eight targeted actual Git/filesystem cases pass: \`${pointers.independent.evidence}\`. The full101-case recovery suite includes those8 and the23 prior Git-storage cases: \`${pointers.maintenance.evidence}\`. It also retains dirty/staged work, cancellation, leases, failure inspection, saved links and long SHA-256 pack paths. The current-source app control checks34, scheduling checks114 and rendered workflows10 pass. The unchanged ChatFiles source retains20 prior output-link checks. Combined evidence is \`${target}\`. These tests used generated owned repositories, controlled owner/database records and no model requests or production writes. Installed Agentopia remains0.44.66; this source change is not yet delivered. Image generation remains disabled.

Remaining: ${pending.join(' ')}
`;
await writeFile(file,plan);
console.log(JSON.stringify({success:true,qualification:target,maintenanceCases:101,independentCases:8,sourceOnly:true,installed:'0.44.66',fullFeatureComplete:false}));
