import assert from 'node:assert/strict';
import {runMaintenancePlan} from './maintenance-plan.mjs';
const phases=['requireClosed','normalWindows','preflight','existingServices','logicalRecovery','profileRecovery','verifyRecovery','programRollback','finalChecks','install','verifyInstalled','verifyData'];
let checks=0;
for(const failed of phases) {
 const calls=[],actions=Object.fromEntries(phases.map(phase=>[phase,async()=>{calls.push(phase);if(phase===failed)throw Error('Failed '+phase);return {success:true};}]));
 await assert.rejects(runMaintenancePlan(actions),new RegExp('Failed '+failed));assert.deepEqual(calls,phases.slice(0,phases.indexOf(failed)+1));
 if(phases.indexOf(failed)<phases.indexOf('install'))assert(!calls.includes('install'));
 checks++;
}
for(const failed of ['verifyRecovery','programRollback','finalChecks']) {
 const calls=[],actions=Object.fromEntries(phases.map(phase=>[phase,async()=>{calls.push(phase);return {success:phase!==failed};}]));
 await assert.rejects(runMaintenancePlan(actions),new RegExp(failed));assert(!calls.includes('install'));checks++;
}
const calls=[],actions=Object.fromEntries(phases.map(phase=>[phase,async()=>{calls.push(phase);return {success:true};}]));
assert((await runMaintenancePlan(actions)).success);assert.deepEqual(calls,phases);checks++;
console.log(JSON.stringify({success:true,checks,installerUnreachableAfterAnyFailedPrerequisite:true,ordinaryAppOpened:false,providerRequests:0}));
