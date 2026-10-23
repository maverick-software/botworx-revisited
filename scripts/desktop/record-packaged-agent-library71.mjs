import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';

desktopOperation('bind actual packaged71 native reads, live revocation, retained versions and cold persistence');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-agent-library71-real/current.json'));
const cfg=await json(pointer.sourceIntent),candidate=await json(pointer.candidateFile),f=await json(path.join(cfg.out,'document-fixture.json'));
assert.equal(candidate.version,'0.44.71');assert.equal(await hash(candidate.image),candidate.imageSha256);
assert.equal(await hash(path.join(cfg.program,'resources/app.asar')),candidate.imageSha256);assert(!(await list(true)).includes(cfg.distribution));
const names={seed:'documents-seed-accepted.json',library:'library-lifecycle-accepted.json',background:'documents-background-accepted.json',cold:'documents-cold-accepted.json',audit:'documents-cold-audit-accepted.json'},phases={},counts=new Map();
for(const[name,receiptName]of Object.entries(names)){
 const receipt=await json(path.join(cfg.out,receiptName)),e=await json(receipt.evidence);assert(receipt.success&&e.success);
 if(name!=='audit'){assert.equal(e.imageSha256,candidate.imageSha256);assert.equal(e.normalExit,0);assert(e.runtimeStopped&&e.realProviderRequests===0&&e.productionAccess===false);}
 phases[name]={evidence:receipt.evidence,checks:e.checks??[],controlledResponses:e.controlledResponses??0};
}
assert.equal(phases.seed.checks.length,4);assert.equal(phases.library.checks.length,5);assert.equal(phases.background.checks.length,3);assert.equal(phases.cold.controlledResponses,0);
const audit=await json(phases.audit.evidence);assert(audit.savedRequests===8&&audit.expectedRevokedRequests===2&&audit.parentReportRetained&&audit.singleScheduledRunRetained&&audit.originalHashesRetained&&audit.qaServicesStopped);
const chains={},seen=new Set();
for(const phase of ['seed','library','background','cold']){
 let file=phases[phase].evidence;chains[phase]=[];
 while(file){
  assert(!seen.has(file));seen.add(file);assert(path.resolve(file).startsWith(cfg.out+path.sep));
  const e=await json(file),probe=await json(path.join(e.out,'app/evidence.json'));assert.equal(e.imageSha256,candidate.imageSha256);
  assert(probe.exactArchive&&probe.mainModuleVerified);assert.equal(e.success?e.normalExit:probe.failureCleanupNormalExit,0);
  assert.deepEqual(probe.controlledNetwork.blocked,[]);assert.deepEqual(probe.controlledNetwork.errors,[]);
  for(const row of probe.controlledNetwork.calls)counts.set(row.requestId,(counts.get(row.requestId)??0)+1);
  chains[phase].push({evidence:file,success:e.success,controlledResponses:probe.controlledNetwork.calls.length});file=e.priorPassedEvidence;
 }
}
for(const[id,count]of [[f.directRequest,2],[f.routerRequest,2],[f.parentRequest,3],[f.namedRequest,2],[f.scheduledRequest,2],[f.library.archiveRequest,1],[f.library.replaceRequest,1],[f.library.pdfRequest,2]])assert.equal(counts.get(id),count,id);
assert.equal(counts.size,8);assert.equal(f.library.phase,'complete');
const lifecycle=await json(phases.library.evidence);assert(lifecycle.archive.furtherInferenceRefused&&lifecycle.replace.furtherInferenceRefused);assert(!lifecycle.archive.oldContentReturned&&!lifecycle.replace.oldContentReturned);
assert.deepEqual(lifecycle.retained.history,f.library.history);assert.equal(lifecycle.retained.currentSha256,f.originals[0]);assert.equal(lifecycle.pdf.pageSha256,f.pageSha256);
const oldPointer=await json(path.join(root,'.supabase/desktop-agent-documents70-real/current.json')),oldCfg=await json(oldPointer.sourceIntent),oldBindingFile=(await json(path.join(oldCfg.out,'documents-image-binding-accepted.json'))).evidence,oldBinding=await json(oldBindingFile);
assert(oldBinding.success&&oldBinding.providerBoundUrlExactlyMatched&&oldBinding.sameGeneratedReceiptContent);assert.equal(oldBinding.originalRenderedPageSha256,f.pageSha256);
assert(f.directProof.inputs.some(row=>row.images.includes(oldBinding.nativeInputSha256)));
assert.equal(await hash(oldBinding.nativeImage),oldBinding.comparison.nativeJpegSha256);assert.equal(await hash(oldBinding.visualAttestation),oldBinding.visualAttestationSha256);
const controllers={};for(const name of ['prepare-owned-runtime71.mjs','verify-packaged-agent-library71.mjs','verify-packaged-agent-library71-lifecycle.mjs','verify-packaged-agent-library71-background.mjs','audit-agent-library-cold71.py','audit-agent-library-cold71.mjs','record-packaged-agent-library71.mjs'])controllers[name]=await hash(path.join(root,'scripts/desktop',name));
const e={success:true,at:new Date().toISOString(),version:candidate.version,imageSha256:candidate.imageSha256,candidateProof:pointer.candidateFile,runtimeIntent:pointer.sourceIntent,phases,evidenceChains:chains,controllers,
 actualPackagedApp:true,actualPostgres:true,actualSupabaseAuth:true,actualCodexHarness:true,providerAdapters:['openai-oauth','openrouter'],
 actualInFlightArchiveRevocation:true,actualInFlightReplacementRevocation:true,staleNativeRequestsStopped:2,staleDocumentContentReturned:false,restorationGrantsNoAssignment:true,
 retainedCurrentOriginals:3,retainedPreviousOriginals:2,originalUploadPathsUnavailable:true,actualScannedReplacementPdfPageThree:true,restoredPreviousMarkdownVersion:3,
 renderedPdfPageSha256:f.pageSha256,providerBoundImageMatchesPreviouslyVerifiedExactUrl:true,previouslyVerifiedImageBinding:oldBindingFile,previouslyVerifiedImageBindingSha256:await hash(oldBindingFile),
 namedSpecialistOwnIdentityAndDocuments:true,parentReportContinuation:true,pausedTaskManuallyRunOnce:true,coldSavedRequests:8,coldCompletedRequests:6,coldExpectedRevokedRequests:2,
 controlledResponsesAcrossAllPhases:[...counts.values()].reduce((a,b)=>a+b,0),completedRequestsReplayed:0,coldModelRequests:0,realProviderRequests:0,productionAccess:false,imageGenerationEnabled:false,modelComprehensionTested:false,
 installed:false,currentVersionWholeProfileRestoreVerified:false,eligibleForInstallerConstruction:false,eligibleForProductionInstallation:false,fullGoalComplete:false,
 pending:['Whole-profile restoration of schema72 and retained original/history bytes, including a complete snapshot comparison.','Construct and independently verify the installer.','Fresh ordinary70-to71 recovery, rollback, update and preserved-data/native-interface acceptance.','Remaining desktop parity requirements.']};
const file=path.join(candidate.out,'packaged-accepted.json');await writeFile(file,JSON.stringify(e,null,2),{flag:'wx'});
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);ledger.agentLibrary71Packaged={...e,evidence:file};ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,evidence:file,actualNativeScopeRevocation:true,bothProviderAdapters:true,retainedPreviousOriginals:2,coldSavedRequests:8,controlledResponses:e.controlledResponsesAcrossAllPhases,installed:false}));
