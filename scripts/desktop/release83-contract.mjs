// Bind release83 to the accepted installed82 compact Computer design.
import assert from 'node:assert/strict';
import path from 'node:path';

export const accepted82Proof='F:/Agentopia/.supabase/desktop-computer-design83/1793022817345/package-proof.json';
export const accepted82ImageSha256='31e6d351eb269a1a19e014d71ed49b3ea4c7cb6e8a5cf422b06966f59e34c007';
export function assertRelease83Base(installed,base,delivery){
 assert(installed.success&&base.success&&delivery.success);
 assert.equal(installed.version,'0.44.82');assert.equal(base.version,'0.44.82');assert.equal(base.schema,88);
 assert.equal(path.resolve(installed.proof),path.resolve(accepted82Proof));
 assert.equal(path.resolve(base.out),path.resolve(path.dirname(accepted82Proof)));
 assert.equal(installed.imageSha256,accepted82ImageSha256);assert.equal(base.imageSha256,accepted82ImageSha256);
 assert.equal(delivery.imageSha256,accepted82ImageSha256);assert.equal(delivery.version,'0.44.82');assert(delivery.installed);
}
export {verifyRelease82Native as verifyRelease83Native} from './release82-contract.mjs';
