// Generated Windows encryption/cookies plus a retained real QA native thread.
// Runs the real staging and activation functions; never moves the ordinary profile.
import {mkdir,readFile,writeFile,readdir,link,copyFile,cp,access} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractFile} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';
desktopOperation('rehearse exact44 stopped-profile staging, validation, activation and reopening');
const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),json=async file=>JSON.parse(await readFile(file,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=await json(path.join(root,'.supabase/desktop-platform-release/candidate-04444/qualification.json')),compatFile=path.join(root,'.supabase/desktop-platform-release/candidate-04444/private-backend-acceptance.json'),compat=await json(compatFile);
assert(proof.success&&compat.success&&proof.imageSha256===compat.imageSha256);assert.equal(sha(await readFile(proof.image)),proof.imageSha256);
const out=path.resolve('C:/Users/charl/AgentopiaQA/profile-controller',String(Date.now())),home=path.join(out,'home'),roaming=path.join(home,'AppData/Roaming'),legacy=path.join(roaming,'Agentopia'),target=path.join(home,'.agentopia/desktop/profile'),program=path.join(home,'AppData/Local/AgentopiaDesktop/app-0.44.44'),instance=randomUUID(),binding={format:1,distribution:'AgentopiaRuntime-'+instance,instanceId:instance};
await mkdir(legacy,{recursive:true});await mkdir(program,{recursive:true});
for(const entry of await readdir(proof.portableDirectory,{recursive:true,withFileTypes:true})){assert(!entry.isSymbolicLink());const from=path.join(entry.parentPath,entry.name),relative=path.relative(proof.portableDirectory,from),to=path.join(program,relative);if(entry.isDirectory()){await mkdir(to,{recursive:true});continue;}assert(entry.isFile());await mkdir(path.dirname(to),{recursive:true});if(['resources/app.asar','resources/resources/runtime/config.toml'].includes(relative.replaceAll('\\','/')))await copyFile(from,to);else await link(from,to);}
await writeFile(path.join(legacy,'runtime-binding.json'),JSON.stringify(binding),{flag:'wx'});
const cfg={out,home,roaming,legacy,program,exe:path.join(program,'Agentopia.exe'),instance,binding,imageSha256:proof.imageSha256,generated:{owner:randomUUID(),marker:'CONTROLLER44-'+randomUUID()}},configFile=path.join(out,'config.json');await writeFile(configFile,JSON.stringify(cfg,null,2),{flag:'wx'});
const python=path.join(program,'resources/resources/script-runtimes/python-3.14.8/python.exe'),relocate=path.join(program,'resources/resources/runtime/relocate-native-profile.py'),resources=path.join(program,'resources/resources');
for(const name of ['test-profile-controller44.mjs','launch-durable-profile-probe.mjs','stage_durable_profile.py','profile_location_activation.py'])await copyFile(path.join(root,'scripts/desktop',name),path.join(out,name));
const evidence={at:new Date().toISOString(),out,version:'0.44.44',imageSha256:proof.imageSha256,generatedProfileOnly:true,noRegisteredFixtureDatabase:true,productionProfileChanged:false,productionTransition:false,providerRequests:0,checks:[],success:false};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)),check=async text=>{evidence.checks.push(text);await save();console.log('PASS: '+text);};await save();
async function command(label,binary,args){const r=await exec(binary,args,{cwd:root,windowsHide:true,encoding:'buffer',timeout:120000,maxBuffer:5*1024*1024});const decode=b=>(b.includes(0)?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'');await writeFile(path.join(out,label+'.log'),decode(r.stdout)+decode(r.stderr));return decode(r.stdout).trim();}
const ordinary=async()=>JSON.parse(await command('ordinary-processes','powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq 'C:\\Users\\charl\\AppData\\Local\\AgentopiaDesktop\\app-0.44.41\\Agentopia.exe'}|Select-Object -ExpandProperty Id)|ConvertTo-Json -Compress"])||'[]');
const list=async running=>(await command('wsl-'+(running?'running':'registered'),'wsl.exe',['--list',...(running?['--running']:[]),'--quiet'])).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
const before={processes:await ordinary(),registered:await list(false),running:await list(true)};assert(before.processes.length&&!before.registered.includes(binding.distribution));evidence.before=before;let client,server;
try{
 evidence.seed=await launchDurableProfileProbe(cfg,{testProfile:false,label:'source-seed',generatedMode:'seed'});assert(evidence.seed.success&&evidence.seed.generated.encryptedStorage);await check('Exact packaged startup writes generated encrypted values, an attachment and a persistent Chromium cookie into the isolated legacy profile, then closes normally.');
 const nativeOrigin=path.resolve('C:/Users/charl/AgentopiaQA/migration-compat-packaged/1792436190355/home/.agentopia/desktop/profile');
 for(const name of ['codex','workspaces'])await cp(path.join(nativeOrigin,name),path.join(legacy,name),{recursive:true,errorOnExist:true,force:false,dereference:false});
 await writeFile(path.join(legacy,'.agentopia-native-relocation.json'),JSON.stringify({format:1,codex:'0.163.0',sourceProfile:nativeOrigin,destinationProfile:legacy,state:'copied'}),{flag:'wx'});const sourceRebase=JSON.parse(await command('source-native-rebase',python,['-B',relocate,legacy]));assert(sourceRebase.success&&sourceRebase.threads===1);
 const wrapper=path.join(out,'controller.py');await writeFile(wrapper,String.raw`import json,sys,subprocess,hashlib,tarfile
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from profile_location_activation import inventory,digest,activate
from stage_durable_profile import stage,write_new
c=json.loads(Path(sys.argv[2]).read_text());out=Path(c['out']);source=Path(c['legacy']);target=Path(c['home'])/'.agentopia/desktop/profile';plan_file=out/'plan.json'
def closed():
 exe=c['exe'].replace("'","''");code="@(Get-Process Agentopia -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq '"+exe+"'}).Count";count=subprocess.check_output(['powershell.exe','-NoProfile','-NonInteractive','-Command',code],text=True,timeout=20).strip()
 if count!='0':raise ValueError('The owned QA application is still running.')
def repair(profile):
 result=subprocess.run([sys.executable,'-B',str(Path(c['program'])/'resources/resources/runtime/relocate-native-profile.py'),profile],text=True,capture_output=True,timeout=120,check=True);return json.loads(result.stdout)
mode=sys.argv[3];closed()
if mode=='backup':
 entries=inventory(source,retain_backups=True);archive=out/'source-profile.tar'
 with tarfile.open(archive,'x') as tar:
  for name in entries:tar.add(source/name,arcname=name,recursive=False)
 with tarfile.open(archive) as tar:
  assert len(tar.getmembers())==len(entries)
  for member in tar:
   assert member.isfile() and not member.issym() and not member.islnk();assert hashlib.sha256(tar.extractfile(member).read()).hexdigest()==entries[member.name]
 manifest={'success':True,'manifest':{'files':{name:{'sha256':entries[name]} for name in entries}}};write_new(out/'backup-manifest.json',manifest)
 write_new(out/'backup-evidence.json',{'success':True,'distribution':c['binding']['distribution'],'generatedOnly':True,'registeredDatabaseExists':False,'profileArchiveSha256':digest(archive),'filesVerified':len(entries)})
 print(json.dumps({'success':True,'files':len(entries),'archiveSha256':digest(archive)}))
elif mode=='stage':
 plan=json.loads(plan_file.read_text());result=stage(plan,closed,repair);write_new(out/'stage-result.json',result);print(json.dumps({'success':True,'files':result['filesCopied'],'threads':result['nativeRebase']['threads']}))
elif mode=='seal':
 plan=json.loads(plan_file.read_text());plan.update(json.loads((out/'stage-result.json').read_text()));plan['format']=1
 for key in ['encryptedEvidence','nativeEvidence']:
  file=out/(key+'.json');plan[key]=str(file);plan[key+'Sha256']=digest(file)
 seal=out/'target-seal.json';write_new(seal,inventory(target));plan.update(targetSeal=str(seal),targetSealSha256=digest(seal));plan_file.write_text(json.dumps(plan));print(json.dumps({'success':True,'sealedFiles':len(inventory(target))}))
elif mode in ['check','publish']:
 result=activate(json.loads(plan_file.read_text()),closed,mode=='publish');write_new(out/('activation-'+mode+'.json'),result);print(json.dumps({'success':True,'published':result['published']}))
elif mode=='verify-source':
 plan=json.loads(plan_file.read_text());assert inventory(source,retain_backups=True)==json.loads(Path(plan['sourceSeal']).read_text());print(json.dumps({'success':True,'sourceUnchanged':True}))
`);
 const scripts=path.join(root,'scripts/desktop'),controller=mode=>command('controller-'+mode,python,['-B',wrapper,scripts,configFile,mode]);evidence.backup=JSON.parse(await controller('backup'));
 const plan={format:1,windowsHome:home,source:legacy,target,out:path.join(out,'stage'),runtimeInstanceId:instance,targetVersion:'0.44.44',installedArchive:path.join(program,'resources/app.asar'),installedArchiveSha256:proof.imageSha256,selectorSha256:proof.selectorSha256,compatibilityEvidence:compatFile,compatibilityEvidenceSha256:sha(await readFile(compatFile)),backupEvidence:path.join(out,'backup-evidence.json'),backupEvidenceSha256:sha(await readFile(path.join(out,'backup-evidence.json'))),backupProfileManifest:path.join(out,'backup-manifest.json'),backupProfileManifestSha256:sha(await readFile(path.join(out,'backup-manifest.json')))};await writeFile(path.join(out,'plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
 evidence.stage=JSON.parse(await controller('stage'));assert(evidence.stage.success&&evidence.stage.threads===1);await assert.rejects(access(path.join(home,'.agentopia/desktop/profile-location.json')));await check('The actual stopped-copy controller verifies the recovery and exact44 compatibility proof, copies every eligible file, rebases one real QA native thread and leaves the target unpublished.');
 evidence.preflight=await launchDurableProfileProbe(cfg,{testProfile:false,label:'target-encryption-preflight',expectedProfile:target,initialProfile:target,generatedMode:'read'});assert(evidence.preflight.generated.encryptedStorage&&evidence.preflight.generated.cookiePreserved);await writeFile(path.join(out,'encryptedEvidence.json'),JSON.stringify({success:true,profile:target,credentialsDecrypted:true,providerRequests:0,probe:path.join(evidence.preflight.out,'evidence.json'),probeSha256:sha(await readFile(path.join(evidence.preflight.out,'evidence.json')))}),{flag:'wx'});
 const inspect=path.join(out,'inspect-native.py');await writeFile(inspect,String.raw`import sqlite3,json,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1]);rows=[]
for db in (p/'codex').glob('*/*/*/state_5.sqlite'):
 c=sqlite3.connect('file:'+str(db)+'?mode=ro',uri=True);assert c.execute('PRAGMA integrity_check').fetchone()==('ok',)
 for id,file in c.execute('SELECT id,rollout_path FROM threads'):
  f=Path(file);assert f.is_relative_to(db.parent) and f.is_file();rows.append({'home':str(db.parent),'id':id,'rollout':str(f),'sha256':hashlib.file_digest(f.open('rb'),'sha256').hexdigest()})
 c.close()
print(json.dumps(rows))`);const threads=JSON.parse(await command('native-index',python,['-B',inspect,target]));assert.equal(threads.length,1);
 const clientFile=path.join(out,'codex-client.cjs');await writeFile(clientFile,extractFile(proof.image,'build/codex-client.js'));const {CodexClient}=createRequire(import.meta.url)(clientFile),requests=[];server=createServer((req,res)=>{requests.push(req.url);res.writeHead(503);res.end();});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let turnsStarted=0;for(const row of threads){const held=[];try{for(const name of ['config.toml','auth.json','AGENTS.md']){const file=path.join(row.home,name);try{held.push({file,bytes:await readFile(file)});await writeFile(file,name==='auth.json'?'{}':name==='config.toml'?'# Controller QA read: no external tools\n':'');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const env={...process.env,CODEX_HOME:row.home,HOME:path.join(out,'isolated-native-user'),USERPROFILE:path.join(out,'isolated-native-user'),APPDATA:path.join(out,'isolated-native-data'),LOCALAPPDATA:path.join(out,'isolated-native-data')};for(const key of Object.keys(env))if(/^(OPENAI|OPENROUTER|CHATGPT|CODEX_API_KEY|AGENTOPIA_.*TOKEN)/i.test(key))delete env[key];
  const config={model_provider:'controller-audit',model:'gpt-6.1-sol',model_catalog_json:path.join(resources,'codex/models.json'),'model_providers.controller-audit.name':'Controller history audit','model_providers.controller-audit.base_url':'http://127.0.0.1:'+server.address().port+'/v1','model_providers.controller-audit.wire_api':'responses','model_providers.controller-audit.requires_openai_auth':false,'model_providers.controller-audit.supports_websockets':false,web_search:'disabled',mcp_servers:{}};
  client=new CodexClient(path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(config).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)]),env,out);client.onRequest=async()=>{throw Error('No native operations during copied-history reads');};client.onEvent=method=>{if(method==='turn/started')turnsStarted++;};await client.initialize();const read=await client.request('thread/read',{threadId:row.id,includeTurns:true},20000);assert.equal(read.thread.id,row.id);assert.equal(path.resolve(read.thread.path).toLowerCase(),row.rollout.toLowerCase());assert.equal(sha(await readFile(row.rollout)),row.sha256);
 }finally{await client?.close();client=undefined;for(const {file,bytes}of held)await writeFile(file,bytes);}}
 assert.equal(turnsStarted,0);assert.deepEqual(requests,[]);await new Promise(resolve=>server.close(resolve));server=undefined;await writeFile(path.join(out,'nativeEvidence.json'),JSON.stringify({success:true,profile:target,savedRolloutsUnchanged:true,threadReads:threads.length,expectedThreads:threads.length,turnsStarted,realProviderRequests:0,generatedRealQaThread:true,threads}),{flag:'wx'});await check('Before activation, the exact packaged encrypted store reads its copied values/cookie/attachment, and pinned Codex reads the copied real QA thread with unchanged rollout bytes and zero turns or provider requests.');
 await controller('seal');evidence.activationCheck=JSON.parse(await controller('check'));assert.equal(evidence.activationCheck.published,false);await assert.rejects(access(path.join(target,'profile-migration.json')));evidence.activation=JSON.parse(await controller('publish'));assert(evidence.activation.published);const receipt=await json(path.join(target,'profile-migration.json'));assert.equal(receipt.compatibilityEvidenceSha256,plan.compatibilityEvidenceSha256);await check('The actual activation controller first checks without publishing, then publishes the hashed completion/location record under its lock only after both copy validations and sealed-source checks.');
 evidence.first=await launchDurableProfileProbe(cfg,{testProfile:false,label:'normal-after-activation',expectedProfile:target,generatedMode:'write-followup'});assert(evidence.first.generated.success);const hostData=path.join(home,'AppData/Local/Packages/Generated.Host/LocalCache/Roaming');evidence.second=await launchDurableProfileProbe(cfg,{testProfile:false,label:'host-after-activation',expectedProfile:target,initialProfile:path.join(hostData,'Agentopia'),appData:hostData,generatedMode:'read-followup'});assert(evidence.second.generated.followupRead);await check('Separate normal and Store-style packaged startups select the controller-published profile, preserve its generated cookie/attachment and read the new encrypted write across a cold reopening.');
 await controller('verify-source');for(const row of threads)assert.equal(sha(await readFile(row.rollout)),row.sha256);assert.equal(sha(await readFile(proof.image)),proof.imageSha256);assert.equal(sha(await readFile(path.join(program,'resources/app.asar'))),proof.imageSha256);const after={processes:await ordinary(),registered:await list(false),running:await list(true)};assert.deepEqual(after,before);evidence.after=after;evidence.sourceUnchanged=true;evidence.copiedActualNativeThreads=threads.length;evidence.ordinaryProcessesUnchanged=true;evidence.otherRuntimesUnchanged=true;evidence.success=true;await check('The retained source inventory and native rollout bytes remain unchanged; every owned app closes normally, and ordinary processes and all runtime registrations/running states match their initial values.');
}catch(error){evidence.error=error.stack;process.exitCode=1;}finally{await client?.close();if(server)await new Promise(resolve=>server.close(resolve));await save();}
console.log(JSON.stringify({success:evidence.success,out,groups:evidence.checks.length,copiedActualNativeThreads:evidence.copiedActualNativeThreads,productionProfileChanged:false,providerRequests:0,error:evidence.error}));
