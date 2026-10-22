// Read restored histories through the pinned client, with no turns or inference.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {extractFile} from '@electron/asar';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('read full restored native histories without inference');
const root=path.resolve(import.meta.dirname,'../..'),job=path.resolve(process.argv[2]??''),json=async f=>JSON.parse(await readFile(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(process.argv.length,3);assert.equal(path.dirname(job),path.resolve('D:/Users/charl/AgentopiaQA/full-recovery'));
const prepared=await json(path.join(job,'evidence.json'));assert(prepared.success&&prepared.status==='prepared'&&!prepared.databaseImported&&prepared.isolatedDestination);
const profile=prepared.profile,resources='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources/resources',python=path.join(root,'desktop/resources/script-runtimes/python-3.14.8/python.exe');
const inspect=path.join(job,'inspect-native.py');await writeFile(inspect,`from pathlib import Path\nimport hashlib,json,sqlite3,sys\np=Path(sys.argv[1]);homes=[];rollouts={}\nfor db in sorted((p/'codex').glob('*/*/*/state_5.sqlite')):\n c=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True);assert c.execute('PRAGMA integrity_check').fetchone()==('ok',);rows=c.execute('SELECT id,rollout_path,archived FROM threads ORDER BY id').fetchall();c.close();entries=[]\n for identifier,file,archived in rows:\n  f=Path(file);assert f.is_relative_to(db.parent) and f.is_file() and not f.is_symlink();rollouts[f.relative_to(p).as_posix()]=hashlib.file_digest(f.open('rb'),'sha256').hexdigest();entries.append({'id':identifier,'path':str(f),'archived':bool(archived)})\n homes.append({'directory':str(db.parent),'relative':db.parent.relative_to(p).as_posix(),'threads':entries})\nPath(sys.argv[2]).write_text(json.dumps({'homes':homes,'rollouts':rollouts}),encoding='utf-8')\nprint(json.dumps({'success':True,'homes':len(homes),'threads':sum(len(h['threads']) for h in homes)}))\n`,{flag:'wx'});
const inspected=spawnSync(python,['-B',inspect,profile,path.join(job,'native-read-index.json')],{windowsHide:true,encoding:'utf8'});await writeFile(path.join(job,'inspect-native.log'),inspected.stdout+inspected.stderr,{flag:'wx'});assert.equal(inspected.status,0);
const index=await json(path.join(job,'native-read-index.json'));assert.equal(index.homes.length,prepared.native.homes);assert.equal(index.homes.reduce((n,h)=>n+h.threads.length,0),prepared.native.threads);
const image='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.47/resources/app.asar',clientFile=path.join(job,'pinned-codex-client.cjs');await writeFile(clientFile,extractFile(image,'build/codex-client.js'),{flag:'wx'});const {CodexClient}=createRequire(import.meta.url)(clientFile);
const manifest=await json(path.join(resources,'codex/manifest.json'));assert.equal(manifest.version,'0.163.0');const executable=path.join(resources,'codex/x86_64-pc-windows-msvc/bin/codex.exe'),hasher=createHash('sha256');for await(const data of createReadStream(executable))hasher.update(data);
const evidence={success:false,at:new Date().toISOString(),job,profile,codexVersion:manifest.version,codexExecutableSha256:hasher.digest('hex'),homes:[],localRequests:[],turnsStarted:0,providerRequests:0,productionChanged:false,fullApplicationRestoreProven:false};
const server=http.createServer((req,res)=>{evidence.localRequests.push({method:req.method,path:req.url});res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":{"message":"Inference is disabled during recovery qualification"}}');});let client;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address='http://127.0.0.1:'+server.address().port+'/v1';
 for(const home of index.homes){
  const env={...process.env,CODEX_HOME:home.directory,HOME:path.join(job,'isolated-user'),USERPROFILE:path.join(job,'isolated-user'),APPDATA:path.join(job,'isolated-appdata'),LOCALAPPDATA:path.join(job,'isolated-localappdata')};for(const name of Object.keys(env))if(/^(OPENAI|OPENROUTER|CHATGPT|CODEX_API_KEY|AGENTOPIA_.*TOKEN)/i.test(name))delete env[name];
  const config={model_provider:'recovery-audit',model:'gpt-6.1-sol',model_catalog_json:path.join(resources,'codex/models.json'),'model_providers.recovery-audit.name':'Isolated recovery history audit','model_providers.recovery-audit.base_url':address,'model_providers.recovery-audit.wire_api':'responses','model_providers.recovery-audit.requires_openai_auth':false,'model_providers.recovery-audit.supports_websockets':false,web_search:'disabled',mcp_servers:{}};
  client=new CodexClient(executable,Object.entries(config).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)]),env,job);client.onRequest=async()=>{throw Error('Native actions are disabled during history reads');};client.onEvent=method=>{if(method==='turn/started')evidence.turnsStarted++;};
  try{await client.initialize();const completed={home:home.relative,threads:[],success:false};evidence.homes.push(completed);for(const row of home.threads){const result=await client.request('thread/read',{threadId:row.id,includeTurns:true},20000);assert.equal(result.thread.id,row.id);assert.equal(path.resolve(result.thread.path).toLowerCase(),path.resolve(row.path).toLowerCase());completed.threads.push({id:row.id,turns:result.thread.turns?.length??0,resultSha256:sha(Buffer.from(JSON.stringify(result.thread)))});}completed.success=true;}
  finally{await client.close();client=undefined;}
  if(evidence.homes.length%20===0)console.log(JSON.stringify({homesRead:evidence.homes.length,total:index.homes.length}));
 }
 for(const [name,digest]of Object.entries(index.rollouts))assert.equal(sha(await readFile(path.join(profile,name))),digest,'A restored rollout changed during reading');assert.equal(evidence.turnsStarted,0);assert.equal(evidence.localRequests.length,0);
 evidence.threadReads=evidence.homes.reduce((n,h)=>n+h.threads.length,0);assert.equal(evidence.threadReads,prepared.native.threads);evidence.savedRolloutsUnchanged=true;evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
finally{await client?.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(job,'native-read-qualification.json'),JSON.stringify(evidence,null,2),{flag:'wx'});console.log(JSON.stringify({success:evidence.success,homes:evidence.homes.length,threadReads:evidence.threadReads,turnsStarted:evidence.turnsStarted,providerRequests:0,job,error:evidence.error}));}
