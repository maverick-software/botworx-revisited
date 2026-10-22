import {readFile,writeFile,readdir,lstat,mkdir,cp,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),[goalId,skillId,uiId,storageId]=process.argv.slice(2);
assert(/^check-\d{13}$/.test(goalId)&&/^check-\d{13}$/.test(skillId)&&/^ui-\d{13}$/.test(uiId)&&/^storage-\d{13}$/.test(storageId));
const goalRun=path.join(root,'.supabase/desktop-native-goals',goalId),skillRun=path.join(root,'.supabase/desktop-plugin-skills',skillId),uiRun=path.join(root,'.supabase/desktop-goal-limits',uiId),storageRun=path.join(root,'.supabase/desktop-goal-limits',storageId);
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const goals=await json(path.join(goalRun,'evidence.json')),skills=await json(path.join(skillRun,'evidence.json')),ui=await json(path.join(uiRun,'evidence.json')),storage=await json(path.join(storageRun,'evidence.json'));
assert(goals.success&&skills.success&&ui.success&&storage.success);assert.equal(goals.passed,45);assert.equal(skills.passed,35);assert.equal(ui.checks.length,5);assert.equal(storage.checks.length,4);assert(storage.productionUnchanged&&storage.disposableDatabaseRemoved);
const unlimited=await json(path.join(goalRun,'unlimited-goal.json')),budget=await json(path.join(goalRun,'token-budget.json'));
assert(unlimited.success&&unlimited.actualCodex&&unlimited.nativeTurns===12&&budget.success&&budget.actualCodex&&budget.removalPreservedUsage);
assert.equal(budget.resumed.goalStatus??budget.resumed.status,'paused');assert(budget.resumed.tokensUsed>=budget.first.tokensUsed);
const base=path.join(root,'.supabase/desktop-native-goals/candidate-0446'),packaged=await json(path.join(base,'package-proof.json'));
assert.equal(hash(await readFile(packaged.image)),packaged.imageSha256);
const out=path.join(root,'.supabase/desktop-goal-limits/qualification-'+Date.now()),source=path.join(out,'source/desktop');await mkdir(source,{recursive:true});
const changed=[],added=[],sourceHashes={},compiled={};
for(const directory of ['src','ui','database']){
 await cp(path.join(root,'desktop',directory),path.join(source,directory),{recursive:true});
 for(const relative of await readdir(path.join(root,'desktop',directory),{recursive:true})){
  const file=path.join(root,'desktop',directory,relative);if(!(await lstat(file)).isFile())continue;
  const key=(directory+'/'+relative).replaceAll('\\','/'),bytes=await readFile(file);sourceHashes[key]=hash(bytes);
  assert.equal(hash(await readFile(path.join(source,key))),sourceHashes[key]);
  try{if(hash(await readFile(path.join(base,'source/desktop',key)))!==sourceHashes[key])changed.push(key);}catch(error){if(error.code!=='ENOENT')throw error;added.push(key);}
 }
}
assert.deepEqual(changed.sort(),['src/broker.ts','src/codex-harness.ts','src/contracts.ts','src/native-contracts.ts','ui/Composer.tsx','ui/DesktopApp.tsx']);
assert.deepEqual(added.sort(),['database/0057-goal-limits.sql','src/goal-settings.ts','ui/GoalDialog.tsx']);
for(const relative of await readdir(goals.build,{recursive:true})){
 const file=path.join(goals.build,relative);if(!(await lstat(file)).isFile())continue;
 const digest=hash(await readFile(file));assert.equal(hash(await readFile(path.join(skills.build,relative))),digest);
 compiled[relative.replaceAll('\\','/')]=digest;
}
assert.equal(Object.keys(compiled).length,1015);
await cp(goals.build,path.join(source,'build'),{recursive:true});
await cp(path.join(root,'desktop/tests'),path.join(source,'tests'),{recursive:true});
await copyFile(path.join(root,'desktop/tsconfig.json'),path.join(source,'tsconfig.json'));
const proof={success:true,at:new Date().toISOString(),phase:'source-goal-limits-qualified',sourceOnly:true,packaged:false,installed:false,
 mainTypecheck:true,rendererTypecheck:true,focusedChecks:45,pluginAndChildChecks:35,interfaceChecks:5,databaseChecks:4,
 actualCodex:true,unlimitedNativeTurns:12,budgetResumptionPreservesUsage:true,budgetRemovalPreservesUsage:true,
 spentBudgetPreventsInference:true,openRouterControlledBudget:true,existingDefaultTurns:3,maximumOptionalTurns:1000,
 newMigration:57,production:storage.after,productionMigrated:false,providerRequests:0,changed,added,
 compiledModules:1015,source,goalRun,skillRun,uiRun,storageRun,baseImageSha256:packaged.imageSha256,
 remaining:['separate image and installer qualification with migration 0057','fresh ChatGPT live goal/skill/browser acceptance',
 'fresh full-profile backup and coordinated installer upgrade','ordinary installed workflows and native-session restart checks',
 'Windows reboot and clean-machine acceptance','broader desktop parity']};
await writeFile(path.join(out,'evidence.json'),JSON.stringify(proof,null,2),{flag:'wx'});
await writeFile(path.join(out,'source-hashes.json'),JSON.stringify(sourceHashes,null,2),{flag:'wx'});
await writeFile(path.join(out,'compiled-modules.json'),JSON.stringify(compiled,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-goal-limits/latest-source.json'),JSON.stringify(proof,null,2));
await writeFile(path.join(root,'.supabase/desktop-native-goals/latest-source.json'),JSON.stringify({at:proof.at,qualification:out,sourceQualified:true,sourceOnly:true,packaged:false,installed:false,promote:false,migrationRequired:57,reason:'The new opt-in limits and budget controls require a separate qualified image; the frozen 0.44.6 installer is unchanged.'},null,2));
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const doc=[
 '# Goal limits and token budgets','',
 'Source qualification — October 17, 2026. These controls are implemented and controlled-tested in source. They are not packaged or installed. The frozen 0.44.6 installer remains unchanged at schema56; the current installation remains 0.43.7/schema45. This source requires additive migration 0057.','',
 '## User behavior','',
 '- Add to chat → Goal retains the existing three-response default. Keep working until complete explicitly removes the turn cap. An optional finite cap accepts 1–1,000 turns.',
 '- Use a token budget sets a total native Codex goal allowance. Earlier usage reported by Codex is retained when a paused goal is resumed with a revised budget. Removing the budget preserves that recorded usage.',
 '- A paused goal exposes Goal settings in the composer. It can save new limits or save and resume. Active executions must stop before settings can change. Editing limits retains the goal objective and saved turn count.',
 '- Native continuation keeps its existing streaming, steering, cancellation, tool permissions and child controls. Plan mode still authorizes one planning response. Unlimited and token-budget settings require the Codex harness; both ChatGPT and OpenRouter use that harness.',
 '- Native budget exhaustion pauses work. Raising a budget explicitly reactivates continuation, including the native budget-limited state. A spent allowance cannot start another provider request until settings change.',
 '- Creating a separate goal explicitly starts a distinct allowance, even if its objective text matches an earlier goal. Resuming the same goal preserves usage.',
 '- Failed saves retain the edited fields and show an inline error. The dialog and saved-goal rows fit the dark and narrow light layouts inspected in the component fixture.','',
 '## Native usage and boundaries','',
 'The goal token display follows Codex’s own accounting. Its active-goal counter can differ from provider response usage, particularly when pausing or applying a turn cap. In the controlled test, a budget of 10 allowed an in-flight response to finish and reported 14 tokens before further continuation stopped. This setting is not a dollar-spend estimate. Provider charges and account limits still apply.','',
 'A token-budget change does not itself restart inference. A user must choose Resume; the harness reactivates the native goal while retaining its usage. Work after runtime loss still requires an explicit new request. Agent, workspace and plugin permission checks remain enforced.','',
 '## Verification','',
 '- 45 focused checks compile the backend and renderer and use the real pinned Codex executable with controlled provider responses. They include twelve automatic native turns, native completion, budget exhaustion, budget revision/removal with retained usage, zero-turn refusals, a new goal with identical text, both provider routes, earlier steering/cancellation/ownership cases and account-scoped settings.',
 '- 35 plugin, skill, agent-policy and independent-child checks pass against byte-identical compiled backend modules.',
 '- Five Electron component-interface checks cover preserved defaults, explicit unlimited limits, budget creation, paused-goal editing, rejected-save drafts and narrow layout. These do not establish a complete installed workflow.',
 '- Four real PostgreSQL checks restore an owned copy of the current snapshot and apply all migrations through 57. All 20,134 original values across 141 tables remain unchanged. Constraints reject invalid settings. Recovery records twelve native turns, preserves zero for refused inference, keeps the one-turn legacy fallback and never reduces saved usage. The test database is removed.',
 '- No live provider request was made and no production migration was applied. Production remains at two accounts, 101 conversations, 338 messages and 45 migrations.','',
 'Evidence: '+relative(goalRun)+', '+relative(skillRun)+', '+relative(uiRun)+', '+relative(storageRun)+'. Frozen product sources, tests, compiled modules and hashes are in '+relative(out)+'.','',
 'An initial test incorrectly treated a paused one-turn goal as if it had active native goal accounting. The final refusal case uses an actual native budget-limited state. That distinction is retained in the earlier test evidence.','',
 '## Remaining release work','',
 'A separate image must include migration 0057 and pass delivered-interface and installer checks. Fresh ChatGPT live acceptance, a fresh complete profile backup, actual upgrade, native-session and installed workflow recovery, Windows reboot and clean-machine checks remain open. The 0.44.6 backend recovery and migration proofs retain their original schema56 scope. Broader desktop parity remains unfinished.','',
 '[Official OpenAI app-server documentation](https://learn.chatgpt.com/docs/app-server#manage-a-thread-goal) describes persisted goal state and budget changes that preserve usage. The pinned executable was also exercised directly for the behavior above.',''
].join('\n');
await writeFile(path.join(root,'docs/desktop/goal-limits.md'),doc,{flag:'wx'});
const note=['## October 17 — source goal limits and token budgets','',
 'The composer now has an explicit Keep working until complete option, optional native token budgets, and settings for paused goals. New goals retain the existing three-response default, and saved goals keep their current limits. Real Codex controlled tests continue through twelve turns, preserve usage through budget changes, refuse exhausted-budget inference and retain OpenRouter support. Forty-five focused checks, 35 plugin/child checks, five interface cases and four snapshot-based PostgreSQL cases pass. Migration 0057 is required; this source is not packaged or installed. [Behavior, evidence and limits](goal-limits.md).',''].join('\n');
for(const name of ['implementation-status.md','parity-backlog.md','capability-acceptance-snapshot.md']){
 const file=path.join(root,'docs/desktop',name),text=await readFile(file,'utf8');assert(!text.includes('## October 17 — source goal limits and token budgets'));const end=text.indexOf('\n');await writeFile(file,text.slice(0,end+1)+'\n'+note+text.slice(end+1));
}
const file=path.join(root,'docs/desktop/native-goals.md'),text=await readFile(file,'utf8'),end=text.indexOf('\n');
await writeFile(file,text.slice(0,end+1)+'\nA later [source goal-controls change](goal-limits.md) adds explicit unlimited turns and editable token budgets with migration 0057. It is not yet packaged. The 0.44.6 behavior and evidence below retain their original bounded-goal scope.\n'+text.slice(end+1));
console.log(JSON.stringify({success:true,focusedChecks:45,pluginChecks:35,interfaceChecks:5,storageChecks:4,changed,added,compiledModules:1015,migrationRequired:57,packaged:false,installed:false,out},null,2));
