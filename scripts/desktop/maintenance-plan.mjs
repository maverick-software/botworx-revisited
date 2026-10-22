// Ordering is shared by the real launcher and failure-path tests. The installer
// can only be reached after fresh recovery and its independent verification.
import assert from 'node:assert/strict';

export async function runMaintenancePlan(actions, progress = () => {}) {
 const completed = [];
 for (const phase of ['requireClosed','normalWindows','preflight','existingServices','logicalRecovery','profileRecovery','verifyRecovery','programRollback','finalChecks','install','verifyInstalled','verifyData']) {
  progress(phase);
  const result = await actions[phase]();
  assert(result?.success === true, 'Maintenance phase did not pass: '+phase);
  completed.push(phase);
 }
 return {success:true, completed};
}
