// Bind the conversational creator release to the completed installed83 delivery.
import assert from 'node:assert/strict';
import path from 'node:path';

export const accepted83Proof='F:/Agentopia/.supabase/desktop-release83/1793024450525/package-proof.json';
export const accepted83ImageSha256='8652fecd17e62b2e0a305a83e38a2c04703aed26fac4dbb528775dbe12021a46';
export function assertRelease84Base(installed,base,delivery,completion){
 assert(installed.success&&base.success&&delivery.success&&completion.success);
 assert(installed.deliveryComplete&&installed.nativeVisualInspectionPending===false&&completion.deliveryComplete&&completion.visual.nativeInstalledApp);
 assert.equal(installed.version,'0.44.83');assert.equal(base.version,'0.44.83');assert.equal(base.schema,89);
 assert.equal(path.resolve(installed.proof),path.resolve(accepted83Proof));
 assert.equal(path.resolve(base.out),path.resolve(path.dirname(accepted83Proof)));
 assert.equal(path.resolve(completion.proof),path.resolve(accepted83Proof));
 for(const receipt of [installed,base,delivery,completion])assert.equal(receipt.imageSha256,accepted83ImageSha256);
 assert.equal(delivery.version,'0.44.83');assert(delivery.installed);assert.equal(completion.version,'0.44.83');assert.equal(completion.schema,89);
}
export {verifyRelease82Native as verifyRelease84Native} from './release82-contract.mjs';
