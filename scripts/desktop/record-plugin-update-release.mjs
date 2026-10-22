import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),work=path.join(root,'.supabase/desktop-plugin-updates/candidate-0448');
const authId=process.argv[2];assert(/^\d{13}$/.test(authId));
const json=async file=>JSON.parse(await readFile(file,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const qualified=await json(path.join(work,'qualification.json')),made=await json(path.join(work,'installer-proof.json')),verified=await json(path.join(work,'installer-verification/evidence.json'));
assert(qualified.success&&made.success&&verified.success);assert.equal(qualified.version,'0.44.8');assert.equal(verified.checks.length,6);
assert.equal(qualified.imageSha256,made.imageSha256);assert.equal(await hashFile(made.installer),made.installerSha256);
for(const name of ['WriteZipToSetup.exe','rcedit.exe','Setup.exe'])assert.equal(await hashFile(path.join(root,'node_modules/electron-winstaller/vendor',name)),await hashFile(path.join(work,'installer-helper-originals',name)));
const running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true}).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
assert(running.includes(distribution));assert(!running.includes('AgentopiaRuntime'));
const script=`import glob,json,os,subprocess
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
db=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))"
env=dict(os.environ,PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_plugin_release_readonly_checkpoint',PGPASSWORD=unquote(db.password or ''))
result=json.loads(subprocess.check_output([binary,'-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,env=env))
result['services']=[{key:service[key] for key in ('service','state','health')} for service in state['services']]
print(json.dumps(result))
`;
const production=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3','-c',script],{encoding:'utf8',windowsHide:true,timeout:30000}));
assert.equal(production.migrations,45);for(const name of ['database','rest','auth','realtime','storage','functions'])assert(production.services.some(s=>s.service===name&&s.state==='running'&&s.health==='healthy'));
assert.equal((await json(path.join(root,'package.json'))).version,'0.43.6');
const installed=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',"$taskInstalled=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AgentopiaDesktop';[pscustomobject]@{version=$taskInstalled.DisplayVersion;runningPaths=@(Get-Process Agentopia -ErrorAction SilentlyContinue | ForEach-Object Path | Sort-Object -Unique)} | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}));
assert.equal(installed.version,'0.43.7');assert(installed.runningPaths.every(file=>file.toLowerCase().endsWith('app-0.43.7\\agentopia.exe')));
const prepared=await json(path.join(work,'preparation.json'));
for(const [file,digest]of Object.entries(prepared.sourceHashes)){
 assert.equal(await hashFile(path.join(prepared.source,file)),digest);
 assert.equal(await hashFile(path.join(root,'desktop',file)),digest,'Current source changed after freezing: '+file);
}
const authorizationFile=path.join(root,'.supabase/desktop-workspace-agents/authorization',authId,'evidence.json'),authorization=await json(authorizationFile);
assert(authorization.success&&authorization.renewalAttempted===false&&authorization.inferenceRequests===0&&authorization.canonicalCredentialWrites===0);
assert(Date.now()-Date.parse(authorization.at)<60*60*1000,'Use a current read-only authorization checkpoint.');
const observation={at:new Date().toISOString(),readOnly:true,serviceStarts:0,production,distribution,retainedOriginalRuntimeStopped:true,installed,inferenceRequests:0};
await writeFile(path.join(work,'final-observation.json'),JSON.stringify(observation,null,2),{flag:'wx'});
const proof={success:true,phase:'private-installer-controlled-checks-passed',at:new Date().toISOString(),version:'0.44.8',
 installer:made.installer,installerSha256:made.installerSha256,installerBytes:made.installerBytes,imageSha256:qualified.imageSha256,fullPackageSha256:verified.fullPackageSha256,
 migrations:58,schemaManifest:58,compiledModules:1016,unitChecks:131,presentationChecks:3,deliveredSkillUIChecks:5,deliveredChildUIChecks:5,deliveredGoalUIChecks:11,deliveredPluginUpdateUIChecks:6,
 installerPayloadChecks:6,actualNativeSkillUpdateBothAdapters:true,actualChildInterruptedOnPackageUpdate:true,
 unlimitedNativeTurns:12,budgetResumptionPreservesUsage:true,budgetRemovalPreservesUsage:true,stylesUnchanged:true,earlierMigrationsAndRuntimesUnchanged:true,
 production,installedVersion:installed.version,vendorHelpersRestored:true,sourceQualificationSha256:qualified.sourceQualificationSha256,
 installed:false,productionMigrated:false,liveInferenceRequests:0,freshChatGPTAuthorizationReady:authorization.readyForLiveQualification,authorizationEvidence:authorizationFile,
 remaining:qualified.remaining.filter(item=>item!=='installer generation and payload verification')};
await writeFile(path.join(work,'release-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});
const latest={at:proof.at,version:proof.version,candidate:work,imageSha256:proof.imageSha256,installerSha256:proof.installerSha256,
 controlledChecksPassed:true,promote:false,reason:'Reviewed plugin updates and migration 0058 pass controlled delivered-image checks. Fresh ChatGPT live acceptance, complete profile backup, ordinary installation and installed/reboot acceptance remain open.'};
for(const area of ['desktop-plugin-updates','desktop-native-goals','desktop-goal-limits'])await writeFile(path.join(root,'.supabase',area,'latest-candidate.json'),JSON.stringify(latest,null,2));
const sourceFile=path.join(root,'.supabase/desktop-plugin-updates/latest-source.json'),source=await json(sourceFile);assert.equal(source.requiredSchema,58);
Object.assign(source,{packaged:true,sourceOnly:false,candidate:work,imageSha256:proof.imageSha256,installed:false,promote:false});await writeFile(sourceFile,JSON.stringify(source,null,2));
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const doc=[
 '# Private 0.44.8 installer — reviewed plugin updates','',
 'The separate Windows installer now packages [reviewed imported-plugin updates](plugin-updates.md) and additive migration 0058. The delivered archive and complete installer payload pass controlled checks. It is uninstalled; production remains on Agentopia 0.43.7/schema45.','',
 '## Delivered behavior','',
 'Plugins → Manage plugin → Update plugin accepts a reviewed folder, ZIP or JSON package with the same identity and a different version. Review identifies retained, changed, added and removed connections and skill resources. Editing the package clears the prior review. Applying it preserves account settings and agent assignments.','',
 'Exact server-name, URL and transport matches retain their connection identifiers and protected credentials. Changed or new servers begin without the earlier credential; removed connections have their owned secrets removed. Disabled assignments and retired agents receive no new connections. PostgreSQL applies replacement and credential reconciliation together and refuses stale revisions. The source database qualification also demonstrates rollback after an induced insertion failure and two overlapping updater sessions.','',
 'Actual native skill sessions using the earlier package close, including independent children whose parent has finished. Completed activity stays saved, and an old-configuration resume is refused before inference. New native turns receive the replacement instructions through either existing provider adapter. Derived cache cleanup retains the new digest and other accounts’ files. The update does not execute helpers.','',
 'The installer also retains explicit unlimited goals, editable native token budgets, independent child routing, persistent named agents, reviewed plugin skills, OAuth recovery and the earlier browser/composer controls.','',
 '## Checks against the exact delivered archive','',
 '- 131 checks use modules extracted from this application archive, its dependencies and the actual bundled Codex executable. Controlled model responses demonstrate replacement skill instructions under both adapters, interruption and saved activity for the background child, twelve native goal turns, token-budget changes, independent child routing, ownership, plugin schemas, references, permissions and connection defaults.',
 '- Six complete delivered-interface workflows cover plugin update review, edits and identity errors, dark/light/narrow layout, failure inspection and explicit retry with duplicate controls disabled. The bridge, picker and registry are controlled.',
 '- Eleven delivered goal workflows, five skill workflows and five child-chat workflows pass. The child chat reopens the actual saved package-update interruption, reference activity and separate draft. Skill discovery uses packaged native metadata without requesting models or credentials. Three child presentation helper cases also pass.',
 '- Six installer checks verify the setup hash, all 6,149 delivered resource paths and lengths, full archive integrity, the exact tested application archive, migration 0058/schema58 metadata and the complete embedded application package with its RELEASES record.','',
 'No live provider inference or paid request was used. These tests establish packaging, transport, lifecycle and interface behavior with controlled inputs. Actual model decisions and ordinary installed workflows retain their own release gates. The new database function separately passes eight [snapshot-based PostgreSQL checks](plugin-updates.md), preserving all 20,134 original rows across 141 tables before and after generated fixture cleanup.','',
 '## Artifact and preservation','',
 '- Version: 0.44.8, Windows x64.',
 '- Installer: '+relative(made.installer)+'.',
 '- Installer size: '+made.installerBytes+' bytes.',
 '- Installer SHA-256: '+made.installerSha256+'.',
 '- Application archive SHA-256: '+proof.imageSha256+'.',
 '- Full application package SHA-256: '+verified.fullPackageSha256+'.',
 '- Database metadata: 58 migrations.','',
 'Compared with 0.44.7, broker.js, native-plugin-skills.js and plugins.js change, and plugin-update.js is added. The remaining 1,012 compiled modules and all 2,232 dependency files are byte-identical. All styles, earlier migrations and native runtime resources remain unchanged; 6,134 resources outside the interface, new migration and version metadata match. The installer helpers’ original bytes are restored and independently checked.','',
 'Evidence is retained under '+relative(work)+': preparation.json, package-proof.json, units/evidence.json, units/update-child-evidence.json, update-ui/evidence.json, goal-ui-settled/evidence.json, built-ui/evidence.json, child-ui/evidence.json, qualification.json, installer-proof.json, installer-verification/evidence.json, final-observation.json and release-proof.json.','',
 '## Live and installed acceptance remain open','',
 'The current read-only authorization inspection finds a saved ChatGPT connection with plan scope and an expired access token. It does not renew credentials, change the canonical store or send inference. Fresh human authorization remains pending for current-image live checks; OpenRouter has not been used as a paid substitute.','',
 'The final read-only production observation records '+production.users+' accounts, '+production.conversations+' conversations, '+production.messages+' messages and 45 migrations, with the six required backend services healthy. Installed 0.43.7 remains unchanged and the retained original WSL distribution stays stopped.','',
 'The earlier [packaged 0.44.7 startup check](packaged-startup-0.44.7.md) retains its own version and schema57 scope. Current-image live behavior, a fresh complete backup of the normally closed profile, ordinary installer upgrade and schema58 migration, signed-in chat/browser/tool workflows, native-session restart recovery, Windows reboot and clean-machine acceptance remain open. Broader desktop parity is unfinished.',''
].join('\n');
await writeFile(path.join(root,'docs/desktop/plugin-updates-0.44.8.md'),doc,{flag:'wx'});
const note=['## October 17 — private 0.44.8 reviewed-plugin updates installer','',
 'The separately built installer now packages reviewed plugin updates and migration 0058. Its exact archive passes 131 checks, six delivered update workflows, eleven goal workflows, five skill workflows, five child workflows, three presentation cases and six installer payload checks without paid inference. Actual Codex controlled turns load updated instructions through both adapters, and a package update interrupts a background child with its completed activity preserved. Production remains on 0.43.7/schema45; fresh ChatGPT live, full-profile backup, ordinary installation and reboot gates remain open. [Artifact, evidence and scope](plugin-updates-0.44.8.md).',''].join('\n');
for(const name of ['implementation-status.md','parity-backlog.md','capability-acceptance-snapshot.md']){
 const file=path.join(root,'docs/desktop',name),text=await readFile(file,'utf8');assert(!text.includes('## October 17 — private 0.44.8 reviewed-plugin updates installer'));
 const end=text.indexOf('\n');await writeFile(file,text.slice(0,end+1)+'\n'+note+text.slice(end+1));
}
const sourceDoc=path.join(root,'docs/desktop/plugin-updates.md'),sourceText=await readFile(sourceDoc,'utf8');
assert(sourceText.includes('This change is qualified in isolation and has not been packaged or installed.'));
await writeFile(sourceDoc,sourceText.replace('This change is qualified in isolation and has not been packaged or installed.','This source checkpoint has since been packaged in the separate [0.44.8 installer](plugin-updates-0.44.8.md), which remains uninstalled.').replace('The next separately qualified package must include migration 0058.','The separately qualified 0.44.8 package now includes migration 0058.'));
const auditDoc=path.join(root,'docs/desktop/capability-acceptance-snapshot.md'),auditText=await readFile(auditDoc,'utf8');
await writeFile(auditDoc,auditText.replace('The latest separate candidate is 0.44.7, adding explicit unlimited goals and editable token budgets while retaining','The latest separate candidate is 0.44.8, adding reviewed plugin updates, explicit unlimited goals and editable token budgets while retaining').replace('Hooks, local-command MCP packages, OAuth-only plugins, signatures, marketplace and in-place updates remain incomplete.','The 0.44.8 candidate also passes reviewed update, credential reconciliation and updated native skill/child checks. Hooks, local-command MCP packages, OAuth-only plugins, signatures and marketplace remain incomplete.'));
console.log(JSON.stringify({success:true,version:proof.version,installerSha256:proof.installerSha256,imageSha256:proof.imageSha256,production,installedVersion:installed.version,freshChatGPTAuthorizationReady:proof.freshChatGPTAuthorizationReady,promote:false},null,2));
