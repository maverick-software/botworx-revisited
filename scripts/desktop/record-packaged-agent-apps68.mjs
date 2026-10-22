import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {json,hash} from './phased-backup-control.mjs';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('record exact packaged68 app assignment and fresh process persistence');
const root=path.resolve(import.meta.dirname,'../..'),release=await json(path.join(root,'.supabase/desktop-agent-apps68-release/current.json')),proof=await json(release.proof),pointer=await json(path.join(root,'.supabase/desktop-agent-apps68-real/current.json')),cfg=await json(pointer.sourceIntent);
assert.equal(await hash(proof.image),proof.imageSha256);
const phases={};for(const phase of ['seed','cold']){
 const receipt=await json(path.join(cfg.out,phase+'-accepted.json')),evidence=await json(receipt.evidence);
 assert(receipt.success&&evidence.success&&evidence.actualPostgres&&evidence.actualCodexHarness&&evidence.runtimeStopped&&evidence.normalExit===0);
 assert.equal(evidence.imageSha256,proof.imageSha256);assert.equal(evidence.productionAccess,false);assert.equal(evidence.realProviderRequests,0);
 assert.equal(evidence.controlledResponses,phase==='seed'?1:0);phases[phase]={receipt:path.join(cfg.out,phase+'-accepted.json'),evidence:receipt.evidence,checks:evidence.checks,controlledResponses:evidence.controlledResponses};
}
const inherited=await json(path.join(release.out,'recovery-impact.json'));assert(inherited.success&&inherited.recoveryEvidenceInheritedOnIdenticalModules);
const receipt={success:true,at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,actualPostgres:true,actualCodexHarness:true,savedAccountColdReopening:true,scopedAppAssignment:true,peerGrantPreserved:true,privateAgentMemory:true,coldNoReplay:true,unsavedInstructionsAndSopPreserved:true,imagesDisabled:true,phases,recoveryImpact:path.join(release.out,'recovery-impact.json'),recoveryInheritedOnIdenticalModules:true,actualCurrentVersionWholeAppColdRecovery:false,realProviderRequests:0,liveComposioRequests:0,productionAccess:false,installed:false,fullGoalComplete:false};
await writeFile(path.join(release.out,'packaged-accepted.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify({success:true,version:proof.version,actualPostgres:true,savedAccountColdReopening:true,installed:false}));
