// One-time migration runner. Invoked by an owned Electron maintenance wrapper
// in the ordinary Windows shell, with an isolated helper profile. The renderer
// receives progress text only; database/provider credentials stay in this process.
const fs=require('node:fs/promises'),nativeFs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const exec=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),canonical=value=>path.win32.normalize(value.replace(/^\\\\\?\\/, '')).toLowerCase();
const contained=(value,root)=>{const relative=path.win32.relative(canonical(root),canonical(value));return relative&&!relative.startsWith('..')&&!path.win32.isAbsolute(relative);};
const insist=(condition,message)=>{if(!condition)throw new Error(message);};
async function json(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function exists(file){try{await fs.lstat(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
// Electron treats .asar paths as virtual directories. Checksums must read the
// actual archive bytes through its documented unpatched filesystem module.
async function fileHash(file){const digest=createHash('sha256');for await(const bytes of require('original-fs').createReadStream(file))digest.update(bytes);return digest.digest('hex');}
module.exports=async function adopt(config,appData,progress=()=>{}){
 const cfg=config,out=cfg.output,target=path.join(appData,'Agentopia'),record=path.join(out,'adoption.json'),wsl=path.join(process.env.SystemRoot,'System32/wsl.exe'),shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 insist(cfg.format===1&&cfg.version==='0.43.0','Unsupported migration configuration.');insist(canonical(appData)===canonical(cfg.appData),'The Windows user profile changed.');
 const requireImage=createRequire(path.join(cfg.image,'package.json')),{Runtime}=requireImage('./build/runtime.js'),{parseRuntimeBinding}=requireImage('./build/runtime-binding.js'),binding=parseRuntimeBinding(cfg.binding),resources=cfg.resources,python=path.join(resources,'script-runtimes/python-3.14.8/python.exe');
 insist(requireImage('./package.json').version===cfg.version,'The prepared application version is incorrect.');
 insist(await fileHash(cfg.image)===cfg.imageSha256,'The prepared application archive changed.');
 let state=await exists(record)?await json(record):{format:1,instanceId:binding.instanceId,source:cfg.stage,target,phase:'prepared',sourceRetained:true};
 insist(state.instanceId===binding.instanceId&&canonical(state.target)===canonical(target)&&canonical(state.source)===canonical(cfg.stage),'This checkpoint belongs to another migration.');
 insist(!state.success,'This adoption is already complete. Verify its installed result instead of running it again.');
 insist(!state.installerAttempted||state.installerExitCode===0,'An earlier installer attempt needs inspection before recovery.');
 const save=async(phase,extra={})=>{Object.assign(state,{phase,at:new Date().toISOString(),...extra});const temporary=record+'.tmp';await fs.writeFile(temporary,JSON.stringify(state,null,2));await fs.rename(temporary,record);progress(phase,state);};
 const execute=async(file,args,timeout=60000)=>{const r=await exec(file,args,{cwd:out,encoding:'utf8',windowsHide:true,timeout,maxBuffer:8*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'}});return r.stdout.replaceAll('\0','').replace(/^\uFEFF/,'').trim();};
 const wslRun=async(args,timeout=60000)=>{const r=await exec(wsl,args,{cwd:out,encoding:'buffer',windowsHide:true,timeout,maxBuffer:8*1024*1024});return (r.stdout.includes(0)?r.stdout.toString('utf16le'):r.stdout.toString('utf8')).replace(/^\uFEFF/,'').trim();};
 const running=async()=>(await wslRun(['--list','--running','--quiet'])).split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const plain=path.join(appData,'Agentopia-before-'+binding.instanceId);
 let runtime;
 try{
  insist(await execute(shell,['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count"])==='0','Close Agentopia normally before adopting its copy.');
  insist(!(await running()).includes('AgentopiaRuntime'),'Stop the original runtime before starting its copy.');
  insist((await json(cfg.exportRecord)).success,'The database export has not passed verification.');insist(await fileHash(cfg.archive)===cfg.archiveSha256,'The database export changed.');
  if(!state.plainProfilePreserved){
   await save('preserving-existing-profile',{retainedPlainProfile:plain});
   if(await exists(target)){
    insist(contained(target,appData)&&contained(plain,appData),'The retained-profile paths escaped Windows application data.');
    insist(!(await fs.lstat(target)).isSymbolicLink(),'The existing profile is linked.');
    insist(await fileHash(path.join(target,'credentials.bin'))===cfg.oldPlainCipherSha256,'The ordinary profile changed after discovery.');
    insist(!await exists(plain),'The retained-profile destination is already occupied.');
    await fs.rename(target,plain);
   }else if(await exists(plain))insist(await fileHash(path.join(plain,'credentials.bin'))===cfg.oldPlainCipherSha256,'The retained ordinary profile changed.');
   await save('ordinary-profile-preserved',{plainProfilePreserved:true});
  }
  if(!state.profileCopied){
   await save('copying-profile');
   const copyRecord=path.join(out,'promoted-profile-copy.json'),args=['-B',path.join(resources,'runtime/copy-desktop-profile.py'),cfg.stage,target,copyRecord];
   if(await exists(target))args.push('--resume');
   const copyTimer=setInterval(()=>{void json(copyRecord).then(row=>progress('Copying '+row.files.toLocaleString()+' profile files',state)).catch(()=>{});},3000);
   try{await execute(python,args,1800000);}finally{clearInterval(copyTimer);}const copied=await json(copyRecord);insist(copied.success,'The ordinary Windows profile copy is incomplete.');
   await save('profile-copied',{profileCopied:true,profileFiles:copied.files,profileBytes:copied.bytes});
  }
  if(!state.nativeRebased){
   await save('repairing-native-history');
   await fs.writeFile(path.join(target,'.agentopia-native-relocation.json'),JSON.stringify({format:1,codex:'0.163.0',sourceProfile:cfg.stage,destinationProfile:target,state:'copied'}));
   const repair=JSON.parse(await execute(python,['-B',path.join(resources,'runtime/relocate-native-profile.py'),target]));insist(repair.homes===91&&repair.threads===120,'The native-history inventory changed.');
   await save('native-history-rebased',{nativeRebased:true,nativeHomes:repair.homes,nativeThreads:repair.threads});
  }
  await fs.writeFile(path.join(target,'runtime-binding.json'),JSON.stringify(binding,null,2));
  const storage=path.join(target,'wsl'),names=(await wslRun(['--list','--quiet'])).split(/\r?\n/).map(v=>v.trim());
  if(!names.includes(binding.distribution)){
   insist(!state.runtimeImported,'The recorded migrated runtime registration is missing.');
   await save('importing-database');await wslRun(['--import',binding.distribution,storage,cfg.archive,'--version','2'],600000);await save('database-imported',{runtimeImported:true});
  }
  const registryScript="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();Get-ChildItem 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Lxss'|ForEach-Object {$r=Get-ItemProperty $_.PSPath;if($r.DistributionName -eq '"+binding.distribution+"'){@{name=$r.DistributionName;path=$r.BasePath;version=$r.Version}|ConvertTo-Json -Compress}}";
  const registration=JSON.parse(await execute(shell,['-NoProfile','-NonInteractive','-Command',registryScript]));insist(registration.name===binding.distribution&&canonical(registration.path)===canonical(storage)&&contained(storage,target),'The copied runtime registration has an unexpected location.');
  insist(await wslRun(['-d',binding.distribution,'-u','agentopia','--exec','cat','/opt/agentopia/runtime-identity'])==='local.agentopia.desktop-runtime.v1','The copied Linux environment is not Agentopia.');
  const instance=await wslRun(['-d',binding.distribution,'-u','root','--exec','python3','-c',"from pathlib import Path;p=Path('/opt/agentopia/runtime-instance');print(p.read_text() if p.exists() else '')"]);insist(!instance||instance===binding.instanceId,'The copied runtime belongs to another installation.');
  if(!instance)await wslRun(['-d',binding.distribution,'-u','root','--exec','python3','-c',"from pathlib import Path;Path('/opt/agentopia/runtime-instance').write_text("+JSON.stringify(binding.instanceId)+")"]);
  await save('starting-copied-services');runtime=new Runtime(resources,target,update=>progress(update.message,state));const started=await runtime.start();
  const {createClient}=requireImage('@supabase/supabase-js'),db=createClient(started.env.API_URL,started.env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),baseline=await json(cfg.baseline),check=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
  const accounts=check(await db.auth.admin.listUsers({perPage:1000})).users;insist(accounts.length===2,'The account inventory changed.');const owners=accounts.map(user=>user.id),accountHash=hash(Buffer.from(JSON.stringify(accounts.map(user=>({id:user.id,email:user.email})).sort((a,b)=>a.id.localeCompare(b.id)))));insist(accountHash===baseline.accounts,'Account IDs or emails changed.');
  const roles=check(await db.from('user_roles').select('*').in('user_id',owners).order('user_id').order('role_id'));insist(hash(Buffer.from(JSON.stringify(roles)))===baseline.roles,'Account roles changed.');
  const conversations=check(await db.from('conversation_sessions').select('conversation_id,user_id,agent_id,title').in('user_id',owners).order('conversation_id'));insist(conversations.length===Object.keys(baseline.conversations).length,'The conversation count changed.');for(const row of conversations)insist(hash(Buffer.from(JSON.stringify(row)))===baseline.conversations[row.conversation_id],'A saved conversation changed.');
  const messages=[];for(let offset=0;;offset+=500){const rows=check(await db.from('chat_messages_v2').select('id,conversation_id,role,content,metadata').in('conversation_id',conversations.map(row=>row.conversation_id)).order('id').range(offset,offset+499));messages.push(...rows);if(rows.length<500)break;}insist(messages.length===Object.keys(baseline.messages).length,'The message count changed.');for(const row of messages)insist(hash(Buffer.from(JSON.stringify(row)))===baseline.messages[row.id],'A saved message changed.');
  const sqlProof=String.raw`import glob,json,subprocess,hashlib
from urllib.parse import urlparse
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));d=urlparse(s['env']['DB_URL']);p=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
def sql(q):return subprocess.check_output([p,'-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',str(d.port),'-U','supabase_admin','-d','postgres','-c',q],text=True).strip()
passwords=sql("SELECT id::text||':'||encrypted_password FROM auth.users WHERE email IN ('admin@agentopia.local','user@agentopia.local') ORDER BY id")
print(json.dumps({'passwordFingerprint':hashlib.sha256(passwords.encode()).hexdigest(),'migrations':json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'))}))`;
  const proof=JSON.parse(await runtime.command(['python3','-c',sqlProof]));insist(proof.passwordFingerprint===baseline.passwordFingerprint,'Account passwords changed.');insist(JSON.stringify(Object.entries(proof.migrations).sort())===JSON.stringify(Object.entries(baseline.migrations).sort()),'Migration checksums changed.');
  const ownedBaseline=await json(cfg.ownedBaseline),owned=JSON.parse(await runtime.command(['python3','-c',await fs.readFile(path.join(resources,'runtime/audit-owned-data.py'),'utf8')]));
  insist(JSON.stringify(owned.tables)===JSON.stringify(ownedBaseline.tables),'Original-account data differs from its recorded source snapshot.');
  await save('database-verified',{databaseVerified:true,accounts:accounts.length,conversations:conversations.length,messages:messages.length,migrations:Object.keys(proof.migrations).length,passwordsPreserved:true,rolesPreserved:true,registration});
  // Provider values are deliberately not returned or written to the progress log.
  const {Secrets}=requireImage('./build/secrets.js'),store=new Secrets(target);await store.load();insist(store.get('session')&&store.get('openrouter')&&owners.some(owner=>store.get('openai:'+owner)),'The saved account or provider connections are unavailable.');
  await save('credentials-verified',{credentialsVerified:true});
  const inspectNative=String.raw`import pathlib,sqlite3,json
root=pathlib.Path(`+JSON.stringify(target)+String.raw`);homes=[]
for database in root.glob('codex/*/*/*/state_5.sqlite'):
 c=sqlite3.connect('file:'+database.as_posix()+'?mode=ro',uri=True)
 homes.append({'home':str(database.parent),'threads':[{'id':r[0],'path':r[1]} for r in c.execute('SELECT id,rollout_path FROM threads')],'edges':[list(r) for r in c.execute('SELECT parent_thread_id,child_thread_id FROM thread_spawn_edges')]});c.close()
print(json.dumps(homes))`;
  const homes=JSON.parse(await execute(python,['-B','-c',inspectNative])),{CodexClient}=requireImage('./build/codex-client.js'),{nativeToml}=requireImage('./build/native-patch-policy.js');let threads=0,childEdges=0,savedTurns=0;
  insist(homes.length===91,'Native homes are missing from the ordinary profile.');
  for(const home of homes){
   const config={model_provider:'agentopia',model:'gpt-6.1-sol',disable_response_storage:true,model_catalog_json:path.join(resources,'codex/models.json'),'model_providers.agentopia.name':'Offline migration verification','model_providers.agentopia.base_url':'http://127.0.0.1:1/v1','model_providers.agentopia.wire_api':'responses','model_providers.agentopia.requires_openai_auth':false,'features.apps':false,'features.shell_tool':false,'features.multi_agent':false,web_search:'disabled',mcp_servers:{}};
   const env={...process.env,CODEX_HOME:home.home};for(const name of Object.keys(env))if(/^(OPENAI_|OPENROUTER_|AGENTOPIA_)/.test(name))delete env[name];
   const client=new CodexClient(path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),Object.entries(config).flatMap(([key,value])=>['-c',key+'='+nativeToml(value)]),env,out);
   try{await client.initialize();for(const thread of home.threads){const read=await client.request('thread/read',{threadId:thread.id,includeTurns:true});insist(read.thread.id===thread.id&&canonical(read.thread.path)===canonical(thread.path)&&contained(read.thread.path,target),'A native thread still depends on its old location.');savedTurns+=read.thread.turns.length;threads++;}childEdges+=home.edges.length;}finally{await client.close();}
  }
  insist(threads===120,'Native threads are missing.');await save('native-history-verified',{nativeHistoryVerified:true,nativeHomesRead:homes.length,nativeThreadsRead:threads,savedNativeTurns:savedTurns,childEdges,newInference:false});
  await runtime.stop();runtime=undefined;insist(!(await running()).includes(binding.distribution),'The copied runtime did not stop.');insist(!(await running()).includes('AgentopiaRuntime'),'The original runtime restarted during migration.');await save('copied-runtime-stopped',{copiedRuntimeStopped:true});
  insist(await execute(shell,['-NoProfile','-NonInteractive','-Command',"@(Get-Process Agentopia -ErrorAction SilentlyContinue).Count"])==='0','Agentopia reopened during migration. Close it normally before installing.');
  insist(await fileHash(cfg.installer)===cfg.installerSha256,'The qualified installer changed.');await save('installing-application',{installerAttempted:true});await execute(cfg.installer,['--silent'],600000);await save('application-installed',{installerExitCode:0});
  const appDirectory=path.join(process.env.LOCALAPPDATA,'AgentopiaDesktop','app-'+cfg.version),installed=require(createRequire(path.join(appDirectory,'resources/app.asar/package.json')).resolve('./package.json'));insist(installed.version===cfg.version,'The ordinary installed version could not be verified.');
  const actual=path.join(appDirectory,'Agentopia.exe'),physical=nativeFs.realpathSync.native(actual);insist(canonical(physical)===canonical(actual)&&!physical.toLowerCase().includes('\\packages\\'),'The application is still in a host cache.');
  const active=JSON.parse(await execute(shell,['-NoProfile','-NonInteractive','-Command',"ConvertTo-Json -Compress -InputObject @(Get-Process Agentopia -ErrorAction SilentlyContinue | Select-Object Id,Path,MainWindowHandle)"]));
  await save('completed',{success:true,installedVersion:installed.version,installedExecutable:physical,ordinaryProfile:target,sourceApplicationRetained:true,sourceDatabaseRetained:true,productionLaunched:active.length>0,applicationProcesses:active});return state;
 }catch(error){await save('needs-inspection',{success:false,error:error.message});throw error;}
 finally{if(runtime)await runtime.stop().catch(()=>{});}
};
