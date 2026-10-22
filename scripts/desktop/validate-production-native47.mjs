// Read the actual staged histories through pinned Codex, without starting turns.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {extractFile} from '@electron/asar';
import {createServer} from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {closed} from './phased-backup-control.mjs';
desktopOperation('verify every actual staged47 native history without inference');await closed();
const attempt=process.argv[2]??'native-validation';assert(/^native-validation(?:-[0-9]+)?$/.test(attempt));
const root=path.resolve(import.meta.dirname,'../..'),pointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-profile-location/production47-current.json'),'utf8')),cfg=JSON.parse(await readFile(pointer.intent,'utf8')),plan=JSON.parse(await readFile(path.join(cfg.out,'plan.json'),'utf8')),out=path.join(cfg.out,attempt),exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=value=>path.resolve(value.startsWith(String.fromCharCode(92,92,63,92))?value.slice(4):value).toLowerCase();
assert.equal(plan.target,cfg.target);assert.equal(plan.runtimeInstanceId,cfg.runtimeInstanceId);await mkdir(out);
const resources=path.join(cfg.storageProgram,'resources/resources'),image=path.join(cfg.storageProgram,'resources/app.asar'),python=path.join(resources,'script-runtimes/python-3.14.8/python.exe');assert.equal(sha(await readFile(image)),cfg.installedArchiveSha256);
const recoveryPointer=JSON.parse(await readFile(path.join(root,'.supabase/desktop-platform-release/candidate-04447/profile-migration-backup.json'),'utf8'));assert(recoveryPointer.success);assert.equal(sha(await readFile(path.join(recoveryPointer.out,'evidence.json'))),plan.backupEvidenceSha256);
const inspect=path.join(out,'inspect.py');await writeFile(inspect,String.raw`from pathlib import Path
import sqlite3,json,hashlib,sys,tarfile,re
p=Path(sys.argv[1]);homes=[];rollouts={}
def relative_rollout(file,root):
 return str(Path(str(file).removeprefix(chr(92)*2+'?'+chr(92))).relative_to(root))
for db in sorted((p/'codex').glob('*/*/*/state_5.sqlite')):
 c=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True);assert c.execute('PRAGMA integrity_check').fetchone()==('ok',);rows=c.execute('SELECT id,rollout_path,archived FROM threads ORDER BY id').fetchall();c.close();entries=[]
 for identifier,file,archived in rows:
  f=Path(file);assert f.is_relative_to(db.parent) and f.is_file() and not f.is_symlink();digest=hashlib.file_digest(f.open('rb'),'sha256').hexdigest();rollouts[str(f.relative_to(p))]=digest;entries.append({'id':identifier,'path':str(f),'archived':bool(archived)})
 homes.append({'directory':str(db.parent),'relative':str(db.parent.relative_to(p)),'threads':entries})
# The fresh ordinary recovery is the authority for this profile's histories.
# Earlier Store-profile recovery sets can contain different native homes.
recovery=Path(sys.argv[2]);source=Path(sys.argv[3]);manifest=json.loads((recovery/'private-profile-ordinary.json').read_text(encoding='utf-8'));archive=recovery/'ordinary-current.tar'
with archive.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==manifest['archiveSha256']
files={name:record for name,record in manifest['manifest']['files'].items() if re.fullmatch(r'codex/[^/]+/[^/]+/[^/]+/state_5.sqlite(?:-wal|-shm)?',name)}
assert files;copied=Path(__file__).parent/'recovery-index';copied.mkdir();found=set()
with tarfile.open(archive) as tar:
 for member in tar:
  if member.name not in files:continue
  assert member.isfile() and not member.issym() and not member.islnk() and member.name not in found
  data=tar.extractfile(member).read();assert len(data)==files[member.name]['bytes'] and hashlib.sha256(data).hexdigest()==files[member.name]['sha256']
  f=copied/member.name;assert f.resolve().is_relative_to(copied.resolve());f.parent.mkdir(parents=True,exist_ok=True)
  with f.open('xb') as stream:stream.write(data)
  found.add(member.name)
assert found==set(files);expected={}
for db in sorted((copied/'codex').glob('*/*/*/state_5.sqlite')):
 c=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True);assert c.execute('PRAGMA integrity_check').fetchone()==('ok',);rows=c.execute('SELECT id,rollout_path,archived FROM threads ORDER BY id').fetchall();c.close()
 expected[str(db.parent.relative_to(copied))]=[{'id':identifier,'rollout':relative_rollout(file,source),'archived':bool(archived)} for identifier,file,archived in rows]
actual={h['relative']:[{'id':t['id'],'rollout':relative_rollout(t['path'],p),'archived':t['archived']} for t in h['threads']] for h in homes}
assert actual==expected,'Copied native indexes differ from the fresh ordinary recovery'
print(json.dumps({'homes':homes,'rollouts':rollouts,'freshRecoveryIndexesMatch':True,'recoveryHomes':len(expected),'recoveryThreads':sum(len(rows) for rows in expected.values())}))`);
const index=JSON.parse((await exec(python,['-B',inspect,plan.target,recoveryPointer.out,cfg.source],{windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024})).stdout),stage=JSON.parse(await readFile(plan.stageEvidence,'utf8'));
assert.equal(index.homes.length,stage.nativeRebase.homes);const expectedThreads=index.homes.reduce((n,h)=>n+h.threads.length,0);assert.equal(expectedThreads,stage.nativeRebase.threads);assert(expectedThreads>0&&index.freshRecoveryIndexesMatch&&index.recoveryThreads===expectedThreads&&index.recoveryHomes===index.homes.length);
const evidence={success:false,at:new Date().toISOString(),profile:plan.target,version:'0.44.47',imageSha256:cfg.installedArchiveSha256,freshRecoveryIndexesMatch:true,recovery:recoveryPointer.out,expectedThreads,expectedHomes:index.homes.length,threadReads:0,turnsStarted:0,realProviderRequests:0,localRequests:[],homes:[],savedRolloutsUnchanged:false};
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await save();
const executable=path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe');assert.equal(JSON.parse(await readFile(path.join(resources,'codex/manifest.json'),'utf8')).version,'0.163.0');
const clientFile=path.join(out,'codex-client.cjs');await writeFile(clientFile,extractFile(image,'build/codex-client.js'));const {CodexClient}=createRequire(import.meta.url)(clientFile);
const server=createServer((req,res)=>{evidence.localRequests.push(req.url);res.writeHead(503);res.end();});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let client;
try{
 for(const home of index.homes){const held=[],label=sha(Buffer.from(home.relative)).slice(0,16),backup=path.join(out,'held-config',label);await mkdir(backup,{recursive:true});
  try{
   for(const name of ['config.toml','auth.json','AGENTS.md']){const file=path.join(home.directory,name);try{const bytes=await readFile(file);held.push({file,bytes});await copyFile(file,path.join(backup,name));await writeFile(file,name==='auth.json'?'{}':name==='config.toml'?'# Staged history reads only; no external tools\n':'');}catch(error){if(error.code!=='ENOENT')throw error;}}
   const env={...process.env,CODEX_HOME:home.directory,HOME:path.join(out,'isolated-user'),USERPROFILE:path.join(out,'isolated-user'),APPDATA:path.join(out,'isolated-appdata'),LOCALAPPDATA:path.join(out,'isolated-localappdata')};for(const key of Object.keys(env))if(/^(OPENAI|OPENROUTER|CHATGPT|CODEX_API_KEY|AGENTOPIA_.*TOKEN)/i.test(key))delete env[key];
   const config={model_provider:'migration-history',model:'gpt-6.1-sol',model_catalog_json:path.join(resources,'codex/models.json'),'model_providers.migration-history.name':'Migration history read','model_providers.migration-history.base_url':'http://127.0.0.1:'+server.address().port+'/v1','model_providers.migration-history.wire_api':'responses','model_providers.migration-history.requires_openai_auth':false,'model_providers.migration-history.supports_websockets':false,web_search:'disabled',mcp_servers:{}};
   client=new CodexClient(executable,Object.entries(config).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)]),env,out);client.onRequest=async()=>{throw Error('Operations are disabled during saved-history validation');};client.onEvent=method=>{if(method==='turn/started')evidence.turnsStarted++;};await client.initialize();const row={home:home.relative,threads:0,success:false};
   for(const thread of home.threads){const read=await client.request('thread/read',{threadId:thread.id,includeTurns:true},20000);assert.equal(read.thread.id,thread.id);assert.equal(canonical(read.thread.path),canonical(thread.path));assert.equal(sha(await readFile(thread.path)),index.rollouts[path.relative(plan.target,thread.path)]);row.threads++;evidence.threadReads++;}
   row.success=true;evidence.homes.push(row);
  }finally{try{await client?.close();}finally{client=undefined;for(const item of held){await writeFile(item.file,item.bytes);assert.equal(sha(await readFile(item.file)),sha(item.bytes));}}}
  await save();if(evidence.homes.length%10===0)console.log(JSON.stringify({homesRead:evidence.homes.length,totalHomes:index.homes.length,threadsRead:evidence.threadReads}));
 }
 for(const [name,digest]of Object.entries(index.rollouts))assert.equal(sha(await readFile(path.join(plan.target,name))),digest);
 assert.equal(evidence.turnsStarted,0);assert.deepEqual(evidence.localRequests,[]);assert.equal(evidence.threadReads,expectedThreads);evidence.savedRolloutsUnchanged=true;evidence.success=true;await closed();
}catch(error){evidence.errorClass=error.name;evidence.error=error.message;process.exitCode=1;}finally{await client?.close();await new Promise(resolve=>server.close(resolve));await save();}
if(evidence.success)await writeFile(path.join(cfg.out,'nativeEvidence.json'),JSON.stringify({...evidence,evidence:path.join(out,'evidence.json'),evidenceSha256:sha(await readFile(path.join(out,'evidence.json')))},null,2),{flag:'wx'});
console.log(JSON.stringify({success:evidence.success,homesRead:evidence.homes.length,threadReads:evidence.threadReads,turnsStarted:evidence.turnsStarted,realProviderRequests:0,out,error:evidence.error}));
