// Bind the builder correction to the completed installed84 interface and its full application provenance.
import assert from 'node:assert/strict';
import path from 'node:path';

export const accepted84Proof='F:/Agentopia/.supabase/desktop-builder-focus86/1793032496061/package-proof.json';
export const accepted84FullProof='F:/Agentopia/.supabase/desktop-release84/1793027490229/package-proof.json';
export const accepted84Completion='F:/Agentopia/.supabase/desktop-release84/1793027490229/installation-1793032555913/completion.json';
export const accepted84ImageSha256='a6d739387e5c434a724f274648eddfde97d3dce32f70dd8b8821847e2887f48c';
export const frozen84PreservationFiles=['protected_settings_policy81.cjs','protected_settings_policy80.cjs','composio_service_row_checks80.py','audit_logical_snapshot71.py','maintenance-existing-runtime52.py'];
export function assertRelease85Base(installed,base,delivery,completion,full){
 assert(installed.success&&base.success&&delivery.success&&completion.success&&full.success);
 assert(installed.deliveryComplete&&installed.nativeVisualInspectionPending===false&&delivery.deliveryComplete&&completion.deliveryComplete&&completion.nativeVisualInspection?.success);
 for(const receipt of [installed,base,delivery,completion,full]){assert.equal(receipt.version,'0.44.84');assert.equal(receipt.imageSha256,accepted84ImageSha256);}
 assert.equal(base.schema,90);assert.equal(full.schema,90);assert.equal(base.desktopRecovery,18);assert.equal(full.desktopRecovery,18);
 assert.equal(path.resolve(installed.proof),path.resolve(accepted84Proof));assert.equal(path.resolve(base.out),path.resolve(path.dirname(accepted84Proof)));
 assert.equal(path.resolve(installed.completion),path.resolve(accepted84Completion));assert.equal(path.resolve(completion.proof),path.resolve(accepted84Proof));
 assert.equal(path.resolve(installed.evidence),path.resolve(completion.evidence));assert.equal(path.resolve(delivery.proof),path.resolve(accepted84Proof));
 assert.equal(path.resolve(base.baseProof),path.resolve(accepted84FullProof));assert.equal(path.resolve(full.out),path.resolve(path.dirname(accepted84FullProof)));
 assert.equal(path.resolve(base.qaIntent),path.resolve(full.qaIntent));assert.deepEqual(base.newMigration,full.newMigration);assert.equal(base.newMigration.name,'0090-agent-builder-resources.sql');
 assert.equal(base.newMigration.sha256,base.resourceFiles['database/'+base.newMigration.name]);assert.equal(full.newMigration.sha256,full.resourceFiles['database/'+full.newMigration.name]);
 assert(base.backendByteIdentical&&full.fullApplicationBuild&&full.nativeHelperVerified&&full.runtimeResourcesUnchanged);
 assert.deepEqual(base.compiled,full.compiled);assert.deepEqual(base.helperManifest,full.helperManifest);assert.deepEqual(base.productionDependencies,full.productionDependencies);
 assert.deepEqual(base.programFiles,full.programFiles);for(const[name,digest]of Object.entries(full.resourceFiles))if(!name.startsWith('ui/'))assert.equal(base.resourceFiles[name],digest,name);
}
export {verifyRelease82Native as verifyRelease85Native} from './release82-contract.mjs';
