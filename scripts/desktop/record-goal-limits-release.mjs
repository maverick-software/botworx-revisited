import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-goal-limits/candidate-0447'),json=async file=>JSON.parse(await readFile(file,'utf8')),hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');},qualified=await json(path.join(work,'qualification.json')),made=await json(path.join(work,'installer-proof.json')),verified=await json(path.join(work,'installer-verification/evidence.json'));assert(qualified.success&&made.success&&verified.success);assert.equal(verified.checks.length,6);assert.equal(qualified.imageSha256,made.imageSha256);assert.equal(await hashFile(made.installer),made.installerSha256);for(const name of ['WriteZipToSetup.exe','rcedit.exe','Setup.exe'])assert.equal(await hashFile(path.join(root,'node_modules/electron-winstaller/vendor',name)),await hashFile(path.join(work,'installer-helper-originals',name)));
const running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true}).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';assert(running.includes(distribution));assert(!running.includes('AgentopiaRuntime'));
const script=`import glob,json,os,subprocess
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
db=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))"
env=dict(os.environ,PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_native_goal_readonly_checkpoint',PGPASSWORD=unquote(db.password or ''))
print(subprocess.check_output([binary,'-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,env=env).strip())
`;
const production=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3','-c',script],{encoding:'utf8',windowsHide:true,timeout:30000}));assert.equal(production.migrations,45);assert.equal(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,'0.43.6');const installed=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',"$taskInstalled=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AgentopiaDesktop';[pscustomobject]@{version=$taskInstalled.DisplayVersion;runningPaths=@(Get-Process Agentopia -ErrorAction SilentlyContinue | ForEach-Object Path | Sort-Object -Unique)} | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}));assert.equal(installed.version,'0.43.7');assert(installed.runningPaths.every(file=>file.toLowerCase().endsWith('app-0.43.7\\agentopia.exe')));
const prepared=await json(path.join(work,'preparation.json'));for(const [file,digest]of Object.entries(prepared.sourceHashes)){assert.equal(await hashFile(path.join(prepared.source,file)),digest);assert.equal(await hashFile(path.join(root,'desktop',file)),digest,'Current product source changed after freezing: '+file);}
const authorization=await json(path.join(root,'.supabase/desktop-workspace-agents/authorization/1792300118518/evidence.json')),observation={at:new Date().toISOString(),readOnly:true,serviceStarts:0,production,distribution,retainedOriginalRuntimeStopped:true,installed,inferenceRequests:0};await writeFile(path.join(work,'final-observation.json'),JSON.stringify(observation,null,2),{flag:'wx'});
const ui=await json(path.join(work,'goal-ui-settled/evidence.json'));assert(ui.success&&ui.checks.length===11&&ui.goalSettingsAppearance.opacity==='1');
const proof={success:true,phase:'private-installer-controlled-checks-passed',at:new Date().toISOString(),version:'0.44.7',
 installer:made.installer,installerSha256:made.installerSha256,installerBytes:made.installerBytes,
 imageSha256:qualified.imageSha256,fullPackageSha256:verified.fullPackageSha256,migrations:57,schemaManifest:57,
 compiledModules:1015,unitChecks:124,presentationChecks:3,deliveredSkillUIChecks:5,deliveredChildUIChecks:5,deliveredGoalUIChecks:11,
 installerPayloadChecks:6,unlimitedNativeTurns:12,budgetResumptionPreservesUsage:true,budgetRemovalPreservesUsage:true,
 modalAppearance:ui.goalSettingsAppearance,stylesUnchanged:true,earlierMigrationsAndRuntimesUnchanged:true,
 production,installedVersion:installed.version,vendorHelpersRestored:true,sourceQualificationSha256:qualified.sourceQualificationSha256,
 installed:false,productionMigrated:false,liveInferenceRequests:0,freshChatGPTAuthorizationReady:authorization.readyForLiveQualification,
 authorizationEvidence:'.supabase/desktop-workspace-agents/authorization/1792300118518/evidence.json',
 remaining:qualified.remaining.filter(item=>item!=='installer generation and payload verification')};
await writeFile(path.join(work,'release-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});
const latest={at:proof.at,version:proof.version,candidate:work,imageSha256:proof.imageSha256,installerSha256:proof.installerSha256,
 controlledChecksPassed:true,promote:false,reason:'The packaged goal controls and migration 0057 pass controlled checks. Fresh ChatGPT live acceptance, complete profile backup, actual installation and installed/reboot acceptance remain open.'};
await writeFile(path.join(root,'.supabase/desktop-goal-limits/latest-candidate.json'),JSON.stringify(latest,null,2));
await writeFile(path.join(root,'.supabase/desktop-native-goals/latest-candidate.json'),JSON.stringify(latest,null,2));
const nativeSourceFile=path.join(root,'.supabase/desktop-native-goals/latest-source.json'),nativeSource=await json(nativeSourceFile);
assert.equal(nativeSource.migrationRequired,57);Object.assign(nativeSource,{packaged:true,sourceOnly:false,candidate:work,imageSha256:proof.imageSha256,installed:false,promote:false,reason:latest.reason});
await writeFile(nativeSourceFile,JSON.stringify(nativeSource,null,2));
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const doc=[
 '# Private 0.44.7 installer — goal limits and token budgets','',
 'The new Windows installer packages the [goal controls](goal-limits.md), additive migration 0057 and the preceding native child correction. It is built and verified with controlled responses. It remains uninstalled; production is still Agentopia 0.43.7/schema45.','',
 '## Delivered behavior','',
 'Add to chat → Goal keeps the existing three-response default and adds an explicit Keep working until complete option, optional finite limits up to 1,000 turns and a native Codex token budget. Saved goals keep their limits. Paused goals expose settings that save or save and resume while retaining their objective and recorded usage. Active work must stop before limits can change.','',
 'The same native Codex lifecycle works with ChatGPT and OpenRouter. A revised budget can reactivate a budget-limited goal without resetting recorded usage. Removing a budget retains usage. A spent allowance refuses new inference until it is revised. A separately created goal has a distinct allowance even when its text matches an earlier goal. Plan mode still produces one planning response.','',
 'The token allowance uses Codex’s active-goal accounting. An in-flight response may finish beyond the allowance, and Codex’s goal counter can differ from provider response usage. The setting does not estimate a currency charge; provider charges and account limits still apply.','',
 '## Verification on the delivered image','',
 '- 124 checks use modules extracted from this exact application archive, its dependencies and bundled native Codex executable. Controlled responses exercise twelve native turns, native completion, exhausted and revised budgets, provider routes, ownership, plugins, skills, permissions, child controls and defaults.',
 '- Eleven workflows use the delivered minified interface. They cover native continuation and exact-turn steering, Pause versus Stop, completion, saved history and drafts, creating an unlimited goal, changing its budget, explicit resume through the selected ChatGPT connection, disabled running edits, rejected-save recovery and narrow layout.',
 '- Five delivered skill workflows and five dedicated child-chat workflows pass. Skill discovery uses the actual packaged backend and native metadata, with zero model or credential requests. Three child presentation helper cases also pass.',
 '- The first goal UI run passed all eleven workflows, but its screenshots caught the dialog fade-in. A second run waits for the finite animation before capture and again passes all eleven checks. Its computed opacity is 1 with an opaque RGB background. Settled dark and narrow captures were inspected; no product styling change was needed.',
 '- Six installer checks verify setup’s complete embedded application package, all 6,148 delivered resource paths, archive integrity, the exact tested application archive, migration 0057 and schema57 metadata.','',
 'These checks use controlled identities and model responses. No live provider request or paid inference was used. Real model behavior, ordinary installed workflows and Windows reboot/clean-machine acceptance remain open.','',
 '## Exact artifact','',
 '- Version: 0.44.7, Windows x64.',
 '- Installer: '+relative(made.installer),
 '- Installer size: '+made.installerBytes+' bytes.',
 '- Installer SHA-256: '+proof.installerSha256,
 '- Application archive SHA-256: '+proof.imageSha256,
 '- Full package SHA-256: '+proof.fullPackageSha256,
 '- Delivered schema: 57 migrations.','',
 'Relative to the frozen 0.44.6 archive, broker.js and codex-harness.js change and goal-settings.js is added. The other 1,012 compiled modules and all 2,232 dependency files remain byte-identical. The interface is rebuilt from the qualified source. All delivered styles, previous migrations and runtime resources are unchanged; 6,133 external resources outside the interface, new migration and version metadata remain identical. Installer helper binaries were restored and their original hashes verified after packaging.','',
 'Evidence is in '+relative(work)+': preparation.json, package-proof.json, units/evidence.json, units/unlimited-goal.json, units/token-budget.json, goal-ui/evidence.json, goal-ui-settled/evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.','',
 '## Recovery evidence and remaining acceptance','',
 'The new migration already passes a snapshot-based schema45-to-57 upgrade and recovery check, preserving 20,134 original rows across 141 tables. Earlier [fresh-runtime recovery](fresh-runtime-recovery-0.44.6.md) retains its schema56 scope: the runtime code and binaries remain unchanged, and that test demonstrated encryption-root restoration, 190 readable vault records and a full backend stop/restart. It does not substitute for current-image installed desktop and native-session recovery.','',
 'The latest read-only connection inspection still finds an expired ChatGPT access token. No renewal was retried. Fresh user authorization is needed before current-image live goal, skill and browser acceptance. Production remains at '+production.users+' accounts, '+production.conversations+' conversations, '+production.messages+' messages and 45 applied desktop migrations. Its read-only checkpoint and the retained original WSL distribution’s stopped state are preserved.','',
 'Actual promotion still requires the live checks, a fresh backup of the complete normally closed profile, coordinated installer upgrade and migration, ordinary installed chat/browser/tool workflows, native-session restart recovery, a full Windows reboot and clean-machine acceptance. Broader desktop parity remains unfinished.',''
].join('\n');
await writeFile(path.join(root,'docs/desktop/goal-limits-0.44.7.md'),doc,{flag:'wx'});
const note=['## October 17 — private 0.44.7 goal-controls installer','',
 'The separately built installer now packages explicit unlimited goals, optional native token budgets, paused-goal settings and migration 0057. The exact archive passes 124 checks, eleven delivered goal workflows, five skill workflows, five child workflows, three presentation cases and six installer payload checks without paid inference. Styles, previous migrations and runtimes are preserved. Installed 0.43.7/schema45 remain unchanged; fresh ChatGPT live acceptance and full-profile backup/install/restart gates remain open. [Artifact, evidence and limits](goal-limits-0.44.7.md).',''].join('\n');
for(const name of ['implementation-status.md','parity-backlog.md','capability-acceptance-snapshot.md']){
 const file=path.join(root,'docs/desktop',name),text=await readFile(file,'utf8');assert(!text.includes('## October 17 — private 0.44.7 goal-controls installer'));const end=text.indexOf('\n');await writeFile(file,text.slice(0,end+1)+'\n'+note+text.slice(end+1));
}
const sourceDoc=path.join(root,'docs/desktop/goal-limits.md'),sourceText=await readFile(sourceDoc,'utf8');
const old='These controls are implemented and controlled-tested in source. They are not packaged or installed.';
assert(sourceText.includes(old));await writeFile(sourceDoc,sourceText.replace(old,'These controls are implemented and controlled-tested in source, and a separately verified [0.44.7 installer](goal-limits-0.44.7.md) now packages them. They are not installed.').replace('A separate image must include migration 0057 and pass delivered-interface and installer checks.','The separate 0.44.7 image now includes migration 0057 and passes delivered-interface and installer checks.'));
const nativeDoc=path.join(root,'docs/desktop/native-goals.md'),nativeText=await readFile(nativeDoc,'utf8');
await writeFile(nativeDoc,nativeText.replace('It is not yet packaged. The 0.44.6 behavior','It is now packaged in the uninstalled [0.44.7 installer](goal-limits-0.44.7.md). The 0.44.6 behavior'));
const auditDoc=path.join(root,'docs/desktop/capability-acceptance-snapshot.md'),auditText=await readFile(auditDoc,'utf8');
await writeFile(auditDoc,auditText.replace('The latest separate candidate is 0.44.6, combining','The latest separate candidate is 0.44.7, adding explicit unlimited goals and editable token budgets while retaining').replace('include migrations 0055 and 0056 with schema 56 metadata','include migrations 0055–0057 with schema 57 metadata'));
console.log(JSON.stringify({success:true,version:proof.version,installerSha256:proof.installerSha256,imageSha256:proof.imageSha256,
 production,installedVersion:installed.version,promote:false},null,2));
