// Read all copied native chats with the delivered Codex executable, without inference.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {extractFile} from '@electron/asar';
import path from 'node:path';
import {hash} from './phased-backup-control.mjs';

export async function auditRelocatedNative({profile,source,proof,out}){
 const root=path.resolve(import.meta.dirname,'../..'),exec=promisify(execFile),canonical=value=>path.resolve(value.replace(/^\\\\\?\\/,'')).toLowerCase();
 assert(/^F:\\Agentopia-Data\\profiles\\[a-f0-9-]{36}\\profile$/i.test(profile));assert(path.resolve(out).startsWith(path.join(root,'.supabase')+path.sep));assert(proof.success&&proof.version==='0.44.54');assert.equal(await hash(proof.image),proof.imageSha256);await mkdir(out,{recursive:true});
 const python=path.join(proof.assets,'script-runtimes/python-3.14.8/python.exe'),executable=path.join(proof.assets,'codex/x86_64-pc-windows-msvc/bin/codex.exe');for(const file of ['script-runtimes/python-3.14.8/python.exe','codex/x86_64-pc-windows-msvc/bin/codex.exe'])assert.equal(await hash(path.join(proof.assets,file)),proof.resourceFiles[file]);
 const temp=path.join(out,'temp');await mkdir(temp);const inspect=async directory=>JSON.parse((await exec(python,['-I','-B',path.join(root,'scripts/desktop/inspect-profile-native54.py'),directory],{windowsHide:true,encoding:'utf8',env:{...process.env,TEMP:temp,TMP:temp,TMPDIR:temp},timeout:120000,maxBuffer:4*1024*1024})).stdout),index=await inspect(profile),original=source?await inspect(source):undefined;
 const comparable=value=>({homes:value.homes.map(home=>({relative:home.relative,threads:home.threads.map(({id,relative,archived})=>({id,relative,archived}))})),rollouts:value.rollouts});if(original)assert.deepEqual(comparable(index),comparable(original),'Copied native histories differ from the retained source');
 const clientFile=path.join(out,'codex-client.cjs');await writeFile(clientFile,extractFile(proof.image,'build/codex-client.js'));const {CodexClient}=createRequire(import.meta.url)(clientFile),e={success:false,at:new Date().toISOString(),profile,imageSha256:proof.imageSha256,expectedThreads:index.homes.reduce((sum,home)=>sum+home.threads.length,0),threadReads:0,turnsStarted:0,realProviderRequests:0,localRequests:[],homes:[],sourceIndexesAndRolloutsCompared:!!original};
 const server=createServer((request,response)=>{e.localRequests.push(request.url);response.writeHead(503);response.end();});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let client;
 const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));
 try{for(const home of index.homes){const held=[],heldAt=path.join(out,'held-config',createHash('sha256').update(home.relative).digest('hex').slice(0,16));await mkdir(heldAt,{recursive:true});
  try{for(const name of ['config.toml','auth.json','AGENTS.md']){const file=path.join(home.directory,name);try{const bytes=await readFile(file);held.push({file,bytes});await copyFile(file,path.join(heldAt,name));await writeFile(file,name==='auth.json'?'{}':name==='config.toml'?'# Copied history audit; no external tools\n':'');}catch(error){if(error.code!=='ENOENT')throw error;}}
   const env={...process.env,CODEX_HOME:home.directory,HOME:path.join(out,'isolated-home'),USERPROFILE:path.join(out,'isolated-home'),APPDATA:path.join(out,'roaming'),LOCALAPPDATA:path.join(out,'local'),TEMP:temp,TMP:temp,TMPDIR:temp};for(const name of Object.keys(env))if(/^(OPENAI|OPENROUTER|CHATGPT|CODEX_API_KEY|AGENTOPIA_.*TOKEN)/i.test(name))delete env[name];
   const config={model_provider:'copied-history-audit',model:'gpt-6.1-sol',model_catalog_json:path.join(proof.assets,'codex/models.json'),'model_providers.copied-history-audit.name':'Copied history audit','model_providers.copied-history-audit.base_url':'http://127.0.0.1:'+server.address().port+'/v1','model_providers.copied-history-audit.wire_api':'responses','model_providers.copied-history-audit.requires_openai_auth':false,'model_providers.copied-history-audit.supports_websockets':false,web_search:'disabled',mcp_servers:{}};
   client=new CodexClient(executable,Object.entries(config).flatMap(([key,value])=>['-c',key+'='+JSON.stringify(value)]),env,out);client.onRequest=async()=>{throw Error('Native operations are disabled while reading copied histories');};client.onEvent=method=>{if(method==='turn/started')e.turnsStarted++;};await client.initialize();
   for(const thread of home.threads){const result=await client.request('thread/read',{threadId:thread.id,includeTurns:true},30000);assert.equal(result.thread.id,thread.id);assert.equal(canonical(result.thread.path),canonical(thread.path));assert.equal(await hash(thread.path),index.rollouts[thread.relative]);e.threadReads++;}e.homes.push({relative:home.relative,threads:home.threads.length});
  }finally{try{await client?.close();}finally{client=undefined;for(const item of held){await writeFile(item.file,item.bytes);assert.deepEqual(await readFile(item.file),item.bytes);}}}
  if(e.homes.length%10===0)console.log('Copied history: '+e.homes.length+'/'+index.homes.length+' native homes read.');await save();
 }
 for(const [name,digest]of Object.entries(index.rollouts))assert.equal(await hash(path.join(profile,name)),digest);if(original)assert.deepEqual(comparable(await inspect(source)),comparable(original));assert.equal(e.threadReads,e.expectedThreads);assert.equal(e.turnsStarted,0);assert.deepEqual(e.localRequests,[]);e.savedRolloutsUnchanged=true;e.success=true;
 }catch(error){e.error=error.stack;throw error;}finally{await client?.close();await new Promise(resolve=>server.close(resolve));await save();}return e;
}
