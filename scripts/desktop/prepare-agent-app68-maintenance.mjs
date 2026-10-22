import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';

const directory=import.meta.dirname;
const names=['run-normal-maintenance','normal-maintenance67-process','maintenance-program-rollback','maintenance-update-command','verify-maintenance-installation','verify-maintenance-ordinary','test-maintenance-update-command'];
const files=['run-normal-maintenance67.mjs','normal-maintenance67-process.mjs','maintenance-program-rollback67.mjs','maintenance-update-command67.mjs','verify-maintenance-installation67.py','verify-maintenance-ordinary67.py','test-maintenance-update-command67.mjs'];
const current='97798aceb695969bca2275a4f92ccbb7d6b8e0d492575a9ad1052c3dacda9e8b';
for(const file of files){
 let source=await readFile(path.join(directory,file),'utf8');
 source=source.replaceAll('0.44.66','__PREVIOUS_VERSION__').replaceAll('0.44.67','0.44.68').replaceAll('__PREVIOUS_VERSION__','0.44.67');
 for(const other of files)source=source.replaceAll(other,other.replace('67','68'));
 source=source.replaceAll('desktop-scheduled-workspaces67-release','desktop-agent-apps68-release')
  .replaceAll('desktop-agent-directory66','desktop-instruction-editor67')
  .replaceAll('launcher-qualified67','launcher-qualified68').replaceAll('current-update67','current-update68')
  .replaceAll('update67-','update68-').replaceAll('i67-','i68-').replaceAll('(?:66|67)','(?:67|68)')
  .replaceAll('Run-Agentopia-Scheduled-Workspaces-Update67.cmd','Run-Agentopia-Agent-Apps-Update68.cmd')
  .replaceAll('74e4477cbbf3cbf3330e47ef5157646d0a113fd12fe786abdc776b654673d235',current);
 if(file==='run-normal-maintenance67.mjs'){
  const before='qualification.actualClaimDeferral&&qualification.actualMultiProjectClock&&qualification.causalRevocation&&qualification.coldNoReplay&&qualification.recoveryInheritedOnIdenticalModules';
  assert(source.includes(before));
  source=source.replace(before,'qualification.controlledActualCodexPeerContinuation&&qualification.recoveryInheritedOnIdenticalModules&&upgrade.actualPostgres&&upgrade.savedAccountColdReopening&&upgrade.coldNoReplay&&upgrade.scopedAppAssignment');
  source=source.replace('Composio connection implementation is unchanged from accepted58; protected per-user keys and disabled portable bindings are preserved.','Scoped Composio authority is qualified with controlled transports. Protected per-user keys and portable bindings are preserved; live connector authentication remains unverified.');
  assert(source.includes("currentSha=\""+current+'"'));
 }
 if(file==='maintenance-program-rollback67.mjs'){
  assert(source.includes('desktop-instruction-editor67/current.json'));
  assert(source.includes("base.version==='0.44.67'&&proof.version==='0.44.68'"));
 }
 assert(!source.includes('0.44.66'),file);
 const target=file.replace('67','68');await writeFile(path.join(directory,target),source,{flag:'wx'});
 console.log('Prepared '+target);
}
