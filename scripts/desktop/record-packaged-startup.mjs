import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(root,'.supabase/desktop-packaged-startup',id);
const bytes=await readFile(path.join(out,'evidence.json')),e=JSON.parse(bytes);
assert(e.success&&e.phase==='completed'&&e.disposableRuntimeRemoved&&e.secondInstanceExit);
const candidates={'0.44.7':'desktop-goal-limits/candidate-0447','0.44.8':'desktop-plugin-updates/candidate-0448'};
assert(Object.hasOwn(candidates,e.version));const schema=e.version==='0.44.8'?58:57;
assert.equal(e.schema??57,schema);assert.equal(e.checks.length,7);assert.equal(e.providerRequests,0);
for(const launch of [e.firstLaunch,e.secondLaunch]){
 assert(launch.info.packaged&&launch.status.ready);assert.equal(launch.info.version,e.version);
 assert.equal(launch.url,'agentopia://app/login');assert.deepEqual(launch.rendererErrors,[]);
 assert.deepEqual(launch.network.blocked,[]);assert(launch.network.local>0);
 assert.equal(launch.info.physical.userData,e.profile);
}
for(const audit of [e.firstAudit,e.secondAudit]){
 assert(audit.success&&audit.rootRestoredInAllBindings);assert.equal(audit.schema,schema);
 assert.equal(audit.existingTablesCompared,141);assert.equal(audit.existingRowsCompared,20134);
 assert.equal(audit.readableExistingVaultRows,190);
 assert.deepEqual(audit.counts,{users:2,conversations:101,messages:338});
 for(const name of ['database','rest','auth','realtime','storage','functions'])
  assert(audit.services.some(s=>s.service===name&&s.state==='running'&&s.health==='healthy'));
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const hashFile=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const candidate=path.join(root,'.supabase',candidates[e.version]);
const release=JSON.parse(await readFile(path.join(candidate,'release-proof.json'),'utf8'));
assert(release.success&&!release.installed);assert.equal(release.version,e.version);assert.equal(release.migrations,schema);assert.equal(e.imageSha256,release.imageSha256);
const original=path.join(candidate,'staging/out/Agentopia-win32-x64'),actual=path.join(out,'program');
const files=[];
for(const name of await readdir(original,{recursive:true}))if((await stat(path.join(original,name))).isFile())files.push(name);
const actualFiles=[];
for(const name of await readdir(actual,{recursive:true}))if((await stat(path.join(actual,name))).isFile())actualFiles.push(name);
assert.deepEqual(actualFiles.sort(),[...files].sort());
for(const file of files){
 if(file.replaceAll('\\','/')==='resources/resources/runtime/config.toml'){
  let expected=await readFile(path.join(original,file),'utf8');
  for(let offset=0;offset<6;offset++)expected=expected.replaceAll(String(57320+offset),String(e.ports.shadow+offset));
  assert.equal(await readFile(path.join(actual,file),'utf8'),expected);
 }else assert.equal(await hashFile(path.join(actual,file)),await hashFile(path.join(original,file)),'Packaged bytes differ: '+file);
}
for(const name of ['test-packaged-startup.mjs','audit-packaged-startup.py'])
 assert.equal(hash(await readFile(path.join(out,name))),hash(await readFile(path.join(root,'scripts/desktop',name))));
const decode=bytes=>(bytes.includes(0)?bytes.toString('utf16le'):bytes.toString('utf8')).replace(/^\uFEFF/,'');
const list=running=>decode(execFileSync('wsl.exe',['--list',...(running?['--running']:[]),'--quiet'],{windowsHide:true}))
 .split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
assert.deepEqual(list(false),[...e.before.registered].sort());assert.deepEqual(list(true),[...e.before.running].sort());
assert(!list(false).includes(e.distribution));assert(!list(true).includes('AgentopiaRuntime'));
const script=`import glob,json,os,subprocess
from urllib.parse import urlparse,unquote
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_packaged_startup_checkpoint')
query="SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))"
result=json.loads(subprocess.check_output([binary,'-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres','-c',query],text=True,env=env))
result['services']=[{key:service[key] for key in ('service','state','health')} for service in state['services']]
print(json.dumps(result))
`;
const production=JSON.parse(execFileSync('wsl.exe',['-d',e.production,'-u','agentopia','--exec','python3','-c',script],{encoding:'utf8',windowsHide:true,timeout:30000}));
assert.equal(production.users,2);assert.equal(production.conversations,101);assert.equal(production.messages,338);assert.equal(production.migrations,45);
for(const name of ['database','rest','auth','realtime','storage','functions'])
 assert(production.services.some(s=>s.service===name&&s.state==='running'&&s.health==='healthy'));
const checkpoint={success:true,at:new Date().toISOString(),version:e.version,imageSha256:e.imageSha256,
 evidence:path.join(out,'evidence.json'),evidenceSha256:hash(bytes),checks:7,packagedFilesCompared:files.length,
 existingTablesCompared:141,existingRowsCompared:20134,readableExistingVaultRows:190,schema,
 originalEntryPoint:true,controlledIdentity:false,loginAttempted:false,providerRequests:0,
 testInstrumentation:'Playwright observes the actual packaged executable. A main-process fetch guard permits loopback HTTP only after firstWindow; no blocked calls were recorded. Test ports and an isolated profile are used.',
 production,installed:false,productionMigrated:false,ownedRuntimeRemoved:true,
 scope:`Actual packaged ${e.version} executable: snapshot restoration, sign-in screen, single instance, normal window shutdown, backend cold restart and complete original-column data comparison on this Windows account.`,
 remaining:['fresh ChatGPT live acceptance','fresh complete normally closed profile backup and ordinary installer upgrade',
 'authenticated chat, browser, tools and native-session restart workflows','full Windows reboot and clean-machine acceptance','broader desktop parity']};
await writeFile(path.join(out,'checkpoint.json'),JSON.stringify(checkpoint,null,2),{flag:'wx'});
await writeFile(path.join(root,'.supabase/desktop-packaged-startup/latest.json'),JSON.stringify(checkpoint,null,2));
for(const area of ['desktop-goal-limits','desktop-native-goals','desktop-plugin-updates']){
 const file=path.join(root,'.supabase',area,'latest-candidate.json'),latest=JSON.parse(await readFile(file,'utf8'));
 if(latest.version!==e.version)continue;assert.equal(latest.promote,false);
 latest.packagedStartup={success:true,evidence:checkpoint.evidence,evidenceSha256:checkpoint.evidenceSha256,checks:7,schema};
 await writeFile(file,JSON.stringify(latest,null,2));
}
console.log(JSON.stringify({success:true,version:e.version,checks:7,packagedFilesCompared:files.length,
 evidence:checkpoint.evidence,production,installed:false,productionMigrated:false,providerRequests:0},null,2));
