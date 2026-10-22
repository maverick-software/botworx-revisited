import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {extractFile} from '@electron/asar';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(root,'.supabase/desktop-fresh-recovery',id),bytes=await readFile(path.join(out,'evidence.json'));
const evidence=JSON.parse(bytes),intent=JSON.parse(await readFile(path.join(out,'intent.json'),'utf8'));
assert(evidence.success&&evidence.phase==='completed'&&evidence.disposableRuntimeRemoved);
assert.equal(evidence.checks.length,8);assert.equal(evidence.providerRequests,0);
assert(evidence.firstAudit.success&&evidence.secondAudit.success&&evidence.encryptionProbeAfter.probeRemoved);
assert.equal(evidence.firstAudit.existingRowsCompared,20134);assert.equal(evidence.secondAudit.existingRowsCompared,20134);
assert.equal(evidence.firstAudit.readableExistingVaultRows,190);assert.equal(evidence.secondAudit.readableExistingVaultRows,190);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>{const h=createHash('sha256');for await(const bytes of createReadStream(file))h.update(bytes);return h.digest('hex');};
const candidate=path.join(root,'.supabase/desktop-native-goals/candidate-0446');
const delivered=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/resources');
const image=path.join(candidate,'staging/out/Agentopia-win32-x64/resources/app.asar');
const release=JSON.parse(await readFile(path.join(candidate,'release-proof.json'),'utf8'));
assert.equal(await hashFile(image),release.imageSha256);assert.equal(release.imageSha256,evidence.imageSha256);
for(const file of ['runtime.js','runtime-binding.js','transfer.js']){
 assert.equal(hash(await readFile(path.join(out,'archived/build',file))),hash(extractFile(image,'build/'+file)));
}
const expectedFiles=[];
for(const directory of ['runtime','database'])for(const name of await readdir(path.join(delivered,directory),{recursive:true})){
 const relative=directory+'/'+name.replaceAll('\\','/');if((await stat(path.join(delivered,relative))).isFile())expectedFiles.push(relative);
}
expectedFiles.push('version.json');
for(const file of expectedFiles){
 const original=await readFile(path.join(delivered,file)),actual=await readFile(path.join(out,'resources',file));
 if(file==='runtime/config.toml'){
  let expected=original.toString('utf8');for(let offset=0;offset<6;offset++)expected=expected.replaceAll(String(57320+offset),String(intent.ports.shadow+offset));
  assert.equal(actual.toString('utf8'),expected);
 }else assert.equal(hash(actual),hash(original),'A delivered recovery resource differs: '+file);
}
const distribution=intent.production;
assert.equal(distribution,'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd');
const script=`import glob,json,os,subprocess
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_fresh_recovery_checkpoint')
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))"
result=json.loads(subprocess.check_output([binary,'-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,env=env))
result['services']=[{key:service[key] for key in ('service','state','health')} for service in state['services']]
print(json.dumps(result))
`;
const observation=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3','-c',script],{encoding:'utf8',windowsHide:true,timeout:30000}));
assert.equal(observation.users,2);assert.equal(observation.conversations,101);assert.equal(observation.messages,338);assert.equal(observation.migrations,45);
for(const name of ['database','rest','auth','realtime','storage','functions'])assert(observation.services.some(s=>s.service===name&&s.state==='running'&&s.health==='healthy'));
const list=running=>execFileSync('wsl.exe',['--list',...(running?['--running']:[]),'--quiet'],{encoding:'buffer',windowsHide:true})
 .toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
assert.deepEqual(list(false).sort(),[...evidence.before.registered].sort());
assert.deepEqual(list(true).sort(),[...evidence.before.running].sort());
const checkpoint={success:true,at:new Date().toISOString(),version:'0.44.6',imageSha256:evidence.imageSha256,
 evidence:path.join(out,'evidence.json'),evidenceSha256:hash(bytes),checks:8,existingTablesCompared:141,
 existingRowsCompared:20134,readableExistingVaultRows:190,controlledVaultColdDecryption:true,
 exactDeliveredResourceFiles:expectedFiles.length-1,resourceDifference:'Only test port numbers in runtime/config.toml',
 production:observation,ownedDistributionRemoved:true,installed:false,productionMigrated:false,providerRequests:0,
 scope:'Fresh bundled WSL 2 runtime, delivered backend startup and logical import, schema 56, owned-runtime termination and cold restart on this Windows account.',
 remaining:['fresh ChatGPT live acceptance','fresh full-profile backup and ordinary installer upgrade',
 'installed chat, browser, tools and native-session restart workflows','different Windows account and clean-machine acceptance',
 'full Windows reboot acceptance','broader desktop parity']};
await writeFile(path.join(out,'checkpoint.json'),JSON.stringify(checkpoint,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-fresh-recovery/latest.json'),JSON.stringify(checkpoint,null,2));
const latestFile=path.join(root,'.supabase/desktop-native-goals/latest-candidate.json'),latest=JSON.parse(await readFile(latestFile,'utf8'));
assert.equal(latest.version,'0.44.6');assert.equal(latest.promote,false);
latest.freshRuntimeRecovery={success:true,evidence:checkpoint.evidence,evidenceSha256:checkpoint.evidenceSha256,checks:8};
await writeFile(latestFile,JSON.stringify(latest,null,2));
const doc=[
 '# Fresh-runtime recovery for 0.44.6','',
 'October 17, 2026. Eight recovery checks pass with the delivered 0.44.6 runtime supervisor, bundled Linux archive and database resources. A new WSL 2 distribution restored the current database snapshot, applied schema 56, stopped normally, and recovered its data and encryption root after full termination. The test distribution was then removed. Production remains on installed 0.43.7 and schema45.','',
 '## Setup','',
 'The test extracts backend modules from the exact verified [0.44.6 application archive](native-routing-0.44.6.md). It imports the bundled Linux runtime into a newly generated distribution and uses a private Windows profile containing the checksum-verified [database snapshot](upgrade-rehearsal-0.44.6.md). Its Windows folder grants access to the current user and SYSTEM. No canonical application profile, provider connection, or installed executable is changed.','',
 'Only the Supabase test port numbers differ from delivered resources. This lets the production backend continue running. The delivered Runtime.start, resource transfers, first-run import, migration manager, shutdown and second startup execute normally against the new distribution and profile. The test verifies the generated instance binding and registered storage path before removing its own distribution.','',
 '## Results','',
 '- The bundled archive imports with cached software and no existing stack, database, accounts or encryption root.',
 '- Native PostgreSQL, REST, authentication, realtime, storage and functions become healthy after restoration and again after cold restart. No Docker engine is started.',
 '- All 20,134 compared rows across 141 public, authentication, vault and pgsodium tables preserve their existing values. Account password hashes, profiles, roles, agents, conversations and messages match the source snapshot.',
 '- All 190 existing encrypted vault records remain readable after restoration and after cold restart. Their values are processed inside the private audit and are never printed.',
 '- The restored key matches the database key file, private runtime settings, Supabase configuration and saved native stack binding. All 56 migration checksums match the delivered SQL.',
 '- A controlled vault record is created and verified before shutdown, decrypts to its exact expected value after restart, and is removed before the final original-data comparison.',
 '- Normal shutdown terminates only the recovery distribution. It is unregistered after its storage path is verified inside the test directory. The registered distributions and their running states return to their exact starting lists.',
 '- A separate read-only production check confirms two accounts, 101 conversations, 338 messages and 45 migrations, with all six required services still healthy. The retained original AgentopiaRuntime stays stopped.','',
 '## Evidence and remaining work','',
 'Repeatable command: `node scripts/desktop/test-fresh-runtime-recovery.mjs`. The test’s frozen scripts, private profile, resource copies, progress, data audits, intent and independent checkpoint are retained under .supabase/desktop-fresh-recovery/'+id+'. The application archive and original release proof are unchanged.','',
 'This establishes fresh native backend recovery and cold restart on the current Windows account with separate test ports. It does not establish an ordinary installer upgrade, a different Windows account or clean machine, Windows reboot, restored native Codex session files, a complete desktop chat/browser/tool workflow, or live inference. No account login was attempted through the copied authentication service and no provider request was made.','',
 'Actual installation still needs fresh ChatGPT live acceptance and a fresh backup of the complete normally closed application profile. The remaining installed workflows must use that exact qualified image. Broader desktop parity remains unfinished.',''
].join('\n');
await writeFile(path.join(root,'docs/desktop/fresh-runtime-recovery-0.44.6.md'),doc,{flag:'wx'});
const note=['## October 17 — fresh native runtime recovery','',
 'The exact 0.44.6 backend now passes eight checks in a new WSL 2 distribution: snapshot import, schema56 provisioning, all 20,134 existing row values across 141 tables, 190 readable encrypted vault records, independent shutdown and full cold restart. A controlled encrypted record also survives restart. The test distribution is removed; production remains healthy on installed 0.43.7/schema45. Test ports are the only changed runtime resource values. Live authorization, a full-profile backup, actual installation and complete installed/reboot acceptance remain open. [Setup, evidence and limits](fresh-runtime-recovery-0.44.6.md).',''].join('\n');
for(const name of ['implementation-status.md','parity-backlog.md','capability-acceptance-snapshot.md']){
 const file=path.join(root,'docs/desktop',name),text=await readFile(file,'utf8');assert(!text.includes('## October 17 — fresh native runtime recovery'));
 const end=text.indexOf('\n');await writeFile(file,text.slice(0,end+1)+'\n'+note+text.slice(end+1));
}
const releaseDoc=path.join(root,'docs/desktop/native-routing-0.44.6.md'),text=await readFile(releaseDoc,'utf8');
assert(!text.includes('## Fresh native runtime recovery'));
await writeFile(releaseDoc,text.replace('## Exact artifact','## Fresh native runtime recovery\n\nEight subsequent [fresh-runtime recovery checks](fresh-runtime-recovery-0.44.6.md) also pass: the bundled Linux runtime imports, restores the current snapshot, preserves all compared rows and 190 readable vault records, and retains them through full runtime termination and restart. The owned test distribution is removed and production remains healthy. The ordinary installer, full-profile and live workflows remain open.\n\n## Exact artifact'));
console.log(JSON.stringify({success:true,checks:8,version:'0.44.6',evidence:checkpoint.evidence,
 production:observation,installed:false,productionMigrated:false,providerRequests:0},null,2));
