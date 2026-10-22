import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash,list} from './phased-backup-control.mjs';

desktopOperation('record packaged Composio recovery and PostgreSQL dispatch');
const root=path.resolve(import.meta.dirname,'../..');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const pointer=await json(path.join(root,'.supabase/desktop-composio-candidate52/current.json'));
const proof=await json(pointer.proof);
const restored=await json(path.join(proof.out,'capability10-restore-accepted.json'));
const dispatched=await json(path.join(proof.out,'composio-postgres-dispatch-accepted.json'));
const recovery=await json(restored.evidence),dispatch=await json(dispatched.evidence);
const restoreConfig=await json(restored.retainedIntent);
assert(proof.success&&restored.success&&dispatched.success&&recovery.success&&dispatch.success);
assert.equal(proof.imageSha256,restored.imageSha256);
assert.equal(proof.imageSha256,dispatched.imageSha256);
assert.equal(await hash(proof.image),proof.imageSha256);
for(const [file,expected] of Object.entries(proof.sourceHashes)) assert.equal(await hash(path.join(root,'desktop',file)),expected,'Frozen source changed: '+file);
assert.equal(recovery.checks.length,6);assert.equal(dispatch.checks.length,5);
assert(recovery.firstNormalExit&&recovery.coldNormalExit&&dispatch.normalExit);
assert.equal(restored.completedActionsReplayed,0);
assert.equal(dispatch.observations.actions,2);
assert.deepEqual(dispatch.observations.errors,[]);
assert.deepEqual(dispatch.observations.negative,[{connectorWithheld:true}]);
assert.equal(dispatch.scheduledRun.status,'completed');assert.equal(dispatch.blockedRun.status,'completed');
const probes={};
for(const [name,file,calls] of [['restore',recovery.firstProbe,1],['cold',recovery.coldProbe,0],['dispatch',dispatch.probeEvidence,13]]) {
  const value=await json(file);assert(value.success);assert.equal(value.normalExit,0);
  assert.equal(value.controlledNetwork.calls.length,calls);assert.deepEqual(value.controlledNetwork.blocked,[]);assert.deepEqual(value.controlledNetwork.errors,[]);
  probes[name]={file,sha256:await hash(file),controlledModelResponses:calls};
}
assert(!(await list(true)).includes(restoreConfig.distribution),'Disposable runtime still running');
const screenshots={};
for(const [folder,names] of [[path.dirname(restored.evidence),['restored-composio-history.png','continued-restored-composio-history.png','cold-restored-composio.png']],[path.dirname(dispatched.evidence),['named-specialist-working.png','named-specialist-confirmed-result.png','postgres-scheduled-composio.png']]]) {
  for(const name of names){const file=path.join(folder,name),bytes=await readFile(file);assert((await lstat(file)).isFile()&&bytes.toString('ascii',1,4)==='PNG');screenshots[name]={file,sha256:await hash(file),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};}
}
const requestIds=[restored.controlledContinuation,dispatch.rootRequest,dispatch.statusRequest,dispatch.reportRequest,dispatch.invocation.requestId,dispatch.scheduledRun.requestId,dispatch.blockedRun.requestId];
assert(requestIds.every(id=>/^[a-f0-9-]{36}$/.test(id)));assert.equal(new Set(requestIds).size,7);
const remaining=['Administrator-managed versus per-account project design','Real Composio project, OAuth/API-key sign-ins and harmless external read','Release qualification, fresh production backup, installation and ordinary-profile acceptance','Broader desktop parity and persistent workspace-agent goal'];
const qualification={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,proof:pointer.proof,proofSha256:await hash(pointer.proof),restoreEvidence:restored.evidence,restoreEvidenceSha256:await hash(restored.evidence),dispatchEvidence:dispatched.evidence,dispatchEvidenceSha256:await hash(dispatched.evidence),probes,screenshots,reviewedActualPackagedCaptures:true,supportHashes:{},checks:11,actualPostgreSQL:true,actualCodex:true,actualWindowsEncryptedStorage:true,sameWindowsUser:true,freshWindowsUserAcceptancePending:true,freshCapability10RestorePassed:true,passwordsAndOwnerIsolationPassed:true,connectionIdsAndGrantsPreserved:true,restoredBindingsRequireRemoteVerification:true,savedNativeThreadContinued:true,completedActionsReplayed:0,namedAgentStatusAndResultReadPassed:true,scheduledSelectedConnectionPassed:true,scheduledRevokedGrantWithheld:true,controlledModelResponses:14,controlledExternalActions:2,controlledRequestsNeverReplay:requestIds,liveProviderRequests:0,liveComposioRequests:0,productionProfileChanged:false,installed:false,eligibleForProductionInstallation:false,remaining};
for(const name of ['prepare-capability10-restore52.mjs','test-capability10-restore52.mjs','test-composio-postgres-dispatch52.mjs','record-composio-recovery-dispatch52.mjs'])qualification.supportHashes['scripts/desktop/'+name]=await hash(path.join(root,'scripts/desktop',name));
const output=path.join(proof.out,'composio-recovery-dispatch-qualification.json');await writeFile(output,JSON.stringify(qualification,null,2));
const ledgerFile=path.join(root,'.supabase/desktop-recovery-bootstrap/next-acceptance.json'),ledger=await json(ledgerFile);assert.equal(ledger.installed,'0.44.51');
Object.assign(ledger.composioIntegration,{status:'isolated-packaged-postgresql-recovery-and-agent-dispatch-qualified',freshCapability10RestorePassed:true,freshCapability10RestoreQualification:output,postgresNamedAndScheduledDispatchPassed:true,postgresDispatchQualification:output,fullApplicationAcceptance:'Exact packaged application passed PostgreSQL-backed account isolation, encrypted persistence, native connected-tool execution, capability-10 backup/fresh restore, independent named-agent status/result reporting and scheduled connection use/revocation. Model and Composio responses were controlled.',remaining,controlledRequestsNeverReplay:[...new Set([...(ledger.composioIntegration.controlledRequestsNeverReplay||[]),...requestIds])],candidateEligibleForProductionInstallation:false,installed:false,liveConnectorTested:false});
ledger.fullGoalComplete=false;await writeFile(ledgerFile,JSON.stringify(ledger,null,2));
console.log(JSON.stringify({success:true,qualification:output,checks:11,installed:false,liveComposioRequests:0,fullGoalComplete:false}));
