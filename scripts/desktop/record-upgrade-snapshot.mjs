import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];
assert(/^\d{13}$/.test(id),'Pass one completed rehearsal evidence directory name.');
const directory=path.join(root,'.supabase/desktop-upgrade-rehearsal',id);
const file=path.join(directory,'evidence.json'),bytes=await readFile(file),evidence=JSON.parse(bytes);
assert(evidence.success&&evidence.disposableDatabaseRemoved&&evidence.productionUnchanged);
assert.equal(evidence.checks.length,6);assert.equal(evidence.applied.length,11);
assert.equal(evidence.productionMigrations,0);assert.equal(evidence.providerRequests,0);
assert(/^agentopia_upgrade_[a-f0-9]{16}$/.test(evidence.database));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(path.join(directory,'test-upgrade-snapshot.py'))),evidence.fixtureSha256);
assert.equal(hash(await readFile(path.join(root,'scripts/desktop/test-upgrade-snapshot.py'))),evidence.fixtureSha256);
const candidate=path.join(root,'.supabase/desktop-native-goals/candidate-0446');
const release=JSON.parse(await readFile(path.join(candidate,'release-proof.json'),'utf8'));
assert(release.success&&!release.installed);assert.equal(release.imageSha256,evidence.imageSha256);
assert.equal(hash(await readFile(path.join(candidate,'resources/runtime/manage.py'))),evidence.managerSha256);
const distribution='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd';
const running=execFileSync('wsl.exe',['--list','--running','--quiet'],{encoding:'buffer',windowsHide:true})
 .toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
assert(running.includes(distribution)&&!running.includes('AgentopiaRuntime'));
const script=`import glob,hashlib,json,os,stat,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
backup=Path(${JSON.stringify(evidence.backupDirectory)})
assert str(backup)=='/home/agentopia/backups/upgrade-rehearsal-'+${JSON.stringify(evidence.database.slice('agentopia_upgrade_'.length))}
assert backup.stat().st_uid==os.getuid() and stat.S_IMODE(backup.stat().st_mode)==0o700
manifest=json.loads((backup/'manifest.json').read_text())
for item in manifest['files']:
 file=backup/item['name']
 assert file.stat().st_uid==os.getuid() and stat.S_IMODE(file.stat().st_mode)==0o600
 assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_upgrade_readonly_checkpoint')
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'ownedCopyRemoved',NOT EXISTS(SELECT 1 FROM pg_database WHERE datname='${evidence.database}'))"
result=json.loads(subprocess.check_output([binary,'-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres','-c',query],env=env,text=True))
result.update(privateBackupPermissionsVerified=True,backupChecksumsReverified=True,retainedOriginalRuntimeStopped=True)
print(json.dumps(result))
`;
const observation=JSON.parse(execFileSync('wsl.exe',['-d',distribution,'-u','agentopia','--exec','python3','-c',script],
 {encoding:'utf8',windowsHide:true,timeout:30000}));
assert(observation.ownedCopyRemoved&&observation.privateBackupPermissionsVerified);
for(const [key,value]of Object.entries(evidence.before))assert.equal(observation[key],value);
const checkpoint={success:true,at:new Date().toISOString(),version:'0.44.6',imageSha256:evidence.imageSha256,
 evidence:file,evidenceSha256:hash(bytes),checks:evidence.checks,existingTablesCompared:evidence.existingTablesCompared,
 existingRowsCompared:evidence.existingRowsCompared,observation,installed:false,productionMigrated:false,
 scope:'Logical database backup/restore and real migration execution in a secondary database on the existing native PostgreSQL cluster.',
 remaining:['fresh ChatGPT live acceptance','fresh backup of the complete closed application profile before actual upgrade',
 'ordinary installer and runtime upgrade','new-runtime encryption-root recovery','installed workflows and restart recovery',
 'Windows reboot and clean-machine acceptance','broader desktop parity']};
await writeFile(path.join(directory,'checkpoint.json'),JSON.stringify(checkpoint,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-upgrade-rehearsal/latest.json'),JSON.stringify(checkpoint,null,2));
const latestFile=path.join(root,'.supabase/desktop-native-goals/latest-candidate.json');
const latest=JSON.parse(await readFile(latestFile,'utf8'));assert.equal(latest.version,'0.44.6');assert.equal(latest.promote,false);
latest.databaseUpgradeRehearsal={success:true,evidence:file,evidenceSha256:checkpoint.evidenceSha256,checks:6};
await writeFile(latestFile,JSON.stringify(latest,null,2));
const doc=[
 '# Database upgrade rehearsal for 0.44.6','',
 'October 17, 2026. The current database was backed up, restored into a newly generated test database, upgraded through migration 56, and checked for data preservation and rollback. Installed Agentopia remains 0.43.7 and its database remains at migration 45.','',
 '## Setup and purpose','',
 'The test uses the maintenance script and SQL resources delivered with the verified [0.44.6 installer](native-routing-0.44.6.md). The backup script runs unchanged against the existing PostgreSQL/Supabase database in read-only mode. It exports one consistent database snapshot and creates the full database, account, application and vault archives plus the encryption-root recovery file. Checksums and private file permissions were verified. No provider requests were made.','',
 'The restore destination is a separate database in the already-running native PostgreSQL cluster. The test redirects only the provisioning script’s resource root and database destination; it does not modify the delivered maintenance script or migrations. The cluster-bound pg_cron scheduler, its jobs and permissions are omitted from the secondary database. The existing public schema is reused. All existing public, authentication, vault and pgsodium table data is restored and compared.','',
 '## Results','',
 '- The restored copy matched '+evidence.existingRowsCompared.toLocaleString('en-US')+' existing rows across '+evidence.existingTablesCompared+' tables. The comparison includes account password hashes, profiles, roles, agents, conversations, messages and stored encrypted records. Sensitive values stay inside the test process.',
 '- The delivered provisioning script applied all eleven migrations from 46 through 56. Every previously existing column value remained unchanged. Added columns and new tables were checked separately through the migration version records and required schema objects.',
 '- A second provisioning run validated the same 56 checksums and left both the version records and existing data unchanged.',
 '- A synthetic extra migration created a table and then deliberately failed. The table and its migration version record both rolled back. The preceding successful upgrade and original data remained intact.',
 '- The folder-call uniqueness index and native-goal recovery function were present. The generated test database was removed and its removal independently rechecked.',
 '- Production remained at two accounts, 101 conversations, 338 messages and 45 applied migrations. The retained original WSL distribution stayed stopped. No service was started or stopped.','',
 '## Failures retained and corrected','',
 'The first restore attempt omitted the scheduler extension and jobs but retained permissions referring to its absent schema. PostgreSQL refused that restore and the test database was removed. The test exclusion was extended to those permissions, after which the restore and upgrade passed. A later rollback assertion initially treated binary error output as text; the assertion was corrected and the complete six-check run passed. These were test-fixture corrections. The application package was unchanged.','',
 '## Evidence and limits','',
 'Run the repeatable check with `node scripts/desktop/test-upgrade-snapshot.mjs`. Its frozen fixture, intent, evidence and independent checkpoint are in .supabase/desktop-upgrade-rehearsal/'+id+'. Earlier attempts remain in their separate timestamped directories. The original 0.44.6 release proof and installer are unchanged.','',
 'This establishes logical data preservation, migration repeatability and failed-migration rollback on the current PostgreSQL runtime. It does not establish an installer upgrade, a restore into a fresh WSL runtime, transfer of the encryption root to another Windows account, an authenticated API workflow, or restart/reboot behavior. The existing authentication service remains pointed at production throughout; no account sign-in or provider request is made through the copied database.','',
 'The retained Linux backup is private to the Agentopia service account. The actual upgrade still needs a fresh complete application backup after normal closure so native session databases and workspace state are captured consistently. Fresh ChatGPT authorization remains necessary for the pending live goal, skill and browser checks.',''
].join('\n');
await writeFile(path.join(root,'docs/desktop/upgrade-rehearsal-0.44.6.md'),doc,{flag:'wx'});
const note=['## October 17 — current-data upgrade rehearsal','',
 'The delivered 0.44.6 maintenance script now passes a real snapshot/restore upgrade from production schema45 to schema56 in a separate database. All 20,134 existing rows across 141 tables retain their original values, repeat provisioning preserves the version records, and an intentionally failing migration rolls back its table and version together. The test copy was removed; installed 0.43.7 and production schema45 remain unchanged. This covers logical data and migration behavior; live authorization, full-profile backup, actual installation and restart acceptance remain open. [Setup, evidence and limits](upgrade-rehearsal-0.44.6.md).',''].join('\n');
for(const name of ['implementation-status.md','parity-backlog.md','capability-acceptance-snapshot.md']){
 const file=path.join(root,'docs/desktop',name),text=await readFile(file,'utf8');assert(!text.includes('current-data upgrade rehearsal'));
 const end=text.indexOf('\n');await writeFile(file,text.slice(0,end+1)+'\n'+note+text.slice(end+1));
}
const releaseDoc=path.join(root,'docs/desktop/native-routing-0.44.6.md'),releaseText=await readFile(releaseDoc,'utf8');
assert(!releaseText.includes('## Database upgrade rehearsal'));
await writeFile(releaseDoc,releaseText.replace('## Exact artifact',
 '## Database upgrade rehearsal\n\nA subsequent [current-data upgrade rehearsal](upgrade-rehearsal-0.44.6.md) passes six checks using the delivered maintenance script and all migrations through 56. It restores and preserves 20,134 existing rows across 141 tables, validates repeat provisioning and failed-migration rollback, then removes its separate database. This supplements the immutable release proof; installed and live acceptance remain open.\n\n## Exact artifact'));
console.log(JSON.stringify({success:true,version:'0.44.6',checks:6,productionMigrated:false,installed:false,
 evidence:file,observation},null,2));
