import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDatabaseSnapshot,verifyExistingResumes} from './qualify-runtime-reconnect80.mjs';

const before={rootFingerprint:'unchanged-root',tables:[{table:'auth.users',rows:2,sha256:'users-fingerprint'},{table:'vault.secrets',rows:3,sha256:'encrypted-vault-fingerprint'}]};
test('database table summary order does not change the saved-data comparison',()=>{
 const after={...before,tables:[...before.tables].reverse()};assert.deepEqual(canonicalDatabaseSnapshot(after),canonicalDatabaseSnapshot(before));assert.equal(after.tables[0].table,'vault.secrets');
});
test('a changed row fingerprint still fails after normalizing table summary order',()=>{
 const after=structuredClone(before);after.tables.reverse();after.tables[0].sha256='changed-encrypted-vault-fingerprint';assert.throws(()=>assert.deepEqual(canonicalDatabaseSnapshot(after),canonicalDatabaseSnapshot(before)),assert.AssertionError);
});
const binding={instance:'11111111-1111-4111-8111-111111111111',port:60750},result={success:true,identityVerified:true,encryptionRootBindingsVerified:4,coreServicesHealthy:6,provisioned:false,sqlWrites:0};
const attempt=(startOrder,failed=false)=>({args:['python3','/opt/agentopia/database_state.py','--resume-existing',binding.instance,String(binding.port)],instance:binding.instance,port:String(binding.port),startOrder,endOrder:startOrder+1,concurrency:1,failed,outcome:failed?'failed':'succeeded',...(failed?{error:'Controlled service-start failure'}:{result:{...result}})});
test('one failed resume followed by one verified sequential success is accepted',()=>{
 assert.deepEqual(verifyExistingResumes({resumeAttempts:[attempt(1,true),attempt(3)],resumeMaxActive:1},binding),{attempts:2,successful:1,failed:1,maxConcurrency:1});
});
test('overlapping existing-service attempts are rejected',()=>{assert.throws(()=>verifyExistingResumes({resumeAttempts:[attempt(1,true),{...attempt(2),concurrency:2}],resumeMaxActive:2},binding));});
test('a resume for another instance or port is rejected',()=>{
 for(const replacement of [{instance:'22222222-2222-4222-8222-222222222222'},{port:57322}]){const changed={...binding,...replacement},entry=attempt(1);entry.args[3]=entry.instance=changed.instance;entry.args[4]=entry.port=String(changed.port);assert.throws(()=>verifyExistingResumes({resumeAttempts:[entry],resumeMaxActive:1},binding));}
});
test('a helper that reports provisioning or SQL writes is rejected',()=>{
 for(const replacement of [{provisioned:true},{sqlWrites:1}]){const entry=attempt(1);Object.assign(entry.result,replacement);assert.throws(()=>verifyExistingResumes({resumeAttempts:[entry],resumeMaxActive:1},binding));}
});
