// Reuse actual completed model work without replay, and bind its evidence and
// component provenance to the exact new package plus its fresh control tests.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {extractFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';

desktopOperation('record current agent controls and retained live evidence');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-agent-controls48/current.json')),controls=await json(pointer.evidence),proof=await json(path.join(root,'.supabase/desktop-release-04448/1792527849453/package-proof.json'));
assert(controls.success&&controls.failed===0&&controls.cancelled===0&&controls.skipped===0);assert.equal(controls.imageSha256,proof.imageSha256);assert.equal(await hash(proof.image),proof.imageSha256);
const out=path.join(pointer.out,'retained-evidence');await mkdir(out);
const sid=(await promisify(execFile)('powershell.exe',['-NoProfile','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{windowsHide:true,encoding:'utf8'})).stdout.trim();assert(/^S-1-5-[0-9-]+$/.test(sid));await promisify(execFile)('icacls.exe',[out,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','/Q'],{windowsHide:true});
const priorRoot='D:/Users/charl/software/Agentopia',priorFile=path.join(priorRoot,'.supabase/desktop-workspace-agents/acceptance-04444-20261019/evidence.json'),prior=await json(priorFile);assert(prior.success&&prior.liveReassessment.success);
const sources=[['acceptance-04444.json',priorFile],['live-024.json',path.join(priorRoot,prior.liveReassessment.sourceEvidence)],['saved-live-records-024.json',path.join(priorRoot,prior.liveReassessment.savedRecordEvidence)],['concurrency.json',prior.controlledConcurrency.evidence],['restart.json',prior.controlledRestart.evidence],['production-live-047.json','C:/Users/charl/AgentopiaQA/profile-agent-live47/1792457767914/acceptance.json']];
assert.equal(await hash(sources[1][1]),prior.liveReassessment.sourceSha256);assert.equal(await hash(sources[2][1]),prior.liveReassessment.savedRecordSha256);assert.equal(await hash(sources[3][1]),prior.controlledConcurrency.sha256);assert.equal(await hash(sources[4][1]),prior.controlledRestart.sha256);
const receipts={};for(const [name,source]of sources){assert((await json(source)).success,'The retained receipt did not pass: '+name);const digest=await hash(source),target=path.join(out,name);await copyFile(source,target);assert.equal(await hash(target),digest);receipts[name]={original:source,copied:target,sha256:digest};}
const productionLive=await json(sources.at(-1)[1]);assert.equal(productionLive.completedRequests,3);assert(productionLive.sameIdentityRecallVerified&&productionLive.otherIdentityOwnMemorySearchEmpty&&productionLive.nativeCommandCompletedWithoutApproval&&productionLive.steeringAcceptedExactlyOnceInSameTurn&&productionLive.noRequestReplay);
const productionImage='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources/app.asar';assert.equal(await hash(productionImage),'cc3d18ff9db9404fa5479603248afb7ce5dd65067e27ec0977a86ce13152800d');
const modules={};for(const [name,record]of Object.entries(prior.moduleProvenance)) {
 const digest=createHash('sha256').update(extractFile(proof.image,'build/'+name)).digest('hex');assert.equal(digest,proof.compiled[name]);
 const currentProduction=createHash('sha256').update(extractFile(productionImage,'build/'+name)).digest('hex');
 modules[name]={current04448:digest,currentProduction047:currentProduction,live024:record.live024,delivered04444:record.delivered04444,identicalToCurrentProduction:digest===currentProduction,identicalToLive024:digest===record.live024,identicalTo04444:digest===record.delivered04444};
}
const agentCore=['agent-assignments.js','agent-contracts.js','agent-mention.js','agent-policy.js','agent-queue.js','agent-reference.js','agent-service.js'];
const report={success:true,at:new Date().toISOString(),version:'0.44.48',imageSha256:proof.imageSha256,recorderSha256:await hash(import.meta.filename),controlsEvidence:pointer.evidence,controlsEvidenceSha256:await hash(pointer.evidence),controlsLogSha256:await hash(path.join(pointer.out,'backend.log')),controlledChecks:controls.passed,testFiles:controls.testFiles,excludedBackendDependentFixture:{name:'provider-switch.test.cjs',reason:'This older legacy-adapter test needs a separately provisioned WSL database. It is outside the archive-only native-harness qualification; current native-format/provider cases and retained live outcomes cover their stated scopes.'},receipts,modules,unchangedProductionAgentCore:agentCore.filter(name=>modules[name].identicalToCurrentProduction),unchangedLiveAgentCore:agentCore.filter(name=>modules[name].identicalToLive024),changedLiveAgentCore:agentCore.filter(name=>!modules[name].identicalToLive024),savedLiveRequestsReplayed:0,newLiveProviderRequests:0,productionDataModified:false,ordinaryInstallationPassed:false,fullGoalComplete:false};
await writeFile(path.join(pointer.out,'agent-acceptance.json'),JSON.stringify(report,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-agent-controls48/accepted.json'),JSON.stringify({success:true,evidence:path.join(pointer.out,'agent-acceptance.json'),version:'0.44.48',installed:false},null,2));console.log(JSON.stringify({success:true,controlledChecks:report.controlledChecks,unchangedLiveCore:report.unchangedLiveAgentCore,changedLiveCore:report.changedLiveAgentCore,applicableReceiptsCopiedToF:sources.length,newLiveProviderRequests:0,installed:false}));
