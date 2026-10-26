// One reviewed recovery-reader correction over the already qualified85 application.
import assert from 'node:assert/strict';
import path from 'node:path';
import {json,hash} from './phased-backup-control.mjs';

export const qualified85Proof='F:/Agentopia/.supabase/desktop-release85/1793034289860/package-proof.json';
export const qualified85ProofSha256='964083e089068803d7d7e36f622d0dad0568b2f87a43f15fc1e24f6780481bac';
export const recoveryResource='runtime/prepare-desktop-recovery.py';
export const approvedRecoverySha256='42a637cf5436f7170e6a75ca13c8c4ee2e710d6be868e6da48bdb4e90a6c0352';
export async function assertRelease85Recovery(p){
 assert(p.success&&p.version==='0.44.85'&&p.schema===90&&p.desktopRecovery===18&&p.noNewMigrations);
 assert.equal(p.runtimeResourcesUnchanged,false);
 assert.equal(await hash(qualified85Proof),qualified85ProofSha256);
 const original=await json(qualified85Proof);
 assert.equal(path.resolve(p.qualifiedApplicationProof),path.resolve(qualified85Proof));
 assert.equal(p.qualifiedApplicationProofSha256,qualified85ProofSha256);
 assert.equal(p.imageSha256,original.imageSha256);assert.equal(await hash(p.image),original.imageSha256);
 for(const key of ['programFiles','compiled','uiFiles','productionDependencies','helperManifest','newMigration'])assert.deepEqual(p[key],original[key],key);
 assert.deepEqual(Object.keys(p.resourceFiles).sort(),Object.keys(original.resourceFiles).sort());
 for(const[name,digest]of Object.entries(original.resourceFiles))assert.equal(p.resourceFiles[name],name===recoveryResource?approvedRecoverySha256:digest,name);
 assert.deepEqual(p.runtimeResourceChanges,[{file:recoveryResource,before:original.resourceFiles[recoveryResource],after:approvedRecoverySha256}]);
 assert.equal(p.sourceHashes[recoveryResource],approvedRecoverySha256);
 assert.equal(await hash(path.join(p.assets,recoveryResource)),approvedRecoverySha256);
 return true;
}
