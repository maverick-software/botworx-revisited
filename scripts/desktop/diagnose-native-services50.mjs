// Re-exercise the two failed native service cases against the frozen archive.
// All homes are generated, all provider responses are local, and the observer
// records protocol timing only. It leaves the native process environment intact.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('trace failed frozen native MCP and image service cases');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const proof=await json((await json(path.join(root,'.supabase/desktop-release-04450/current.json'))).proof);
assert(proof.success);assert.equal(await hash(proof.image),proof.imageSha256);
const binary='codex/x86_64-pc-windows-msvc/bin/codex.exe',exes=[path.join(proof.assets,binary),path.join(root,'desktop/resources',binary)];
for(const exe of exes)assert.equal(await hash(exe),proof.resourceFiles[binary]);
const stamp=String(Date.now()),out=path.join(proof.out,'native-service-diagnostic',stamp),home=path.join('F:/Agentopia-Acceptance','services50-'+stamp),temp=path.join(home,'temp');
await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
const base=path.join(root,'.supabase/desktop-agent-controls50/1792547034238'),observer=path.join(out,'observer.cjs'),trace=path.join(out,'private-startup.jsonl');
await writeFile(observer,`const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),original=cp.spawn,exes=${JSON.stringify(exes.map(p=>p.toLowerCase()))},trace=${JSON.stringify(trace)};cp.spawn=function(file,args){const child=original.apply(this,arguments);if(!exes.includes(path.resolve(file).toLowerCase())||!args.includes('app-server'))return child;const start=Date.now(),record=x=>fs.appendFileSync(trace,JSON.stringify({ms:Date.now()-start,pid:child.pid,...x})+'\\n');record({event:'spawn'});const write=child.stdin.write.bind(child.stdin);child.stdin.write=function(chunk,...rest){try{const v=JSON.parse(String(chunk));record({event:'client',id:v.id,method:v.method});}catch{}return write(chunk,...rest);};let pending='';child.stdout.on('data',chunk=>{pending+=chunk;let at;while((at=pending.indexOf('\\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);try{const v=JSON.parse(line);record({event:'server',id:v.id,method:v.method,error:v.error?.message});}catch{}}});child.stderr.on('data',chunk=>record({event:'private-stderr',text:String(chunk).slice(-4000)}));child.on('exit',(code,signal)=>record({event:'exit',code,signal}));return child;};`);
const env={...process.env,NODE_PATH:path.join(root,'node_modules'),TEMP:temp,TMP:temp,TMPDIR:temp,USERPROFILE:home,HOME:home,APPDATA:path.join(home,'roaming'),LOCALAPPDATA:path.join(home,'local'),CODEX_HOME:path.join(home,'codex'),AGENTOPIA_TEST_ROOT:root};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','OPENAI_API_KEY','OPENAI_BASE_URL','OPENROUTER_API_KEY','ANTHROPIC_API_KEY','AGENTOPIA_TEST_DISTRIBUTION'])delete env[key];
const cases=['codex-mcp','image-generation-service'],fixtureHashes={};
for(const name of cases)fixtureHashes[name]=await hash(path.join(base,'snapshot/desktop/tests',name+'.test.cjs'));
console.log(JSON.stringify({started:true,out}));let output='';
const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--require',path.join(base,'loader.cjs'),'--require',observer,'--test','--test-concurrency=1','--test-name-pattern','unmodified bundled Codex discovers|real PostgreSQL image journal',...cases.map(name=>path.join(base,'snapshot/desktop/tests',name+'.test.cjs'))],{cwd:root,env,windowsHide:true});for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);child.once('error',reject);child.once('close',resolve);});
await writeFile(path.join(out,'test.log'),output);
await writeFile(path.join(out,'evidence.json'),JSON.stringify({at:new Date().toISOString(),out,diagnosticOnly:true,imageSha256:proof.imageSha256,exitCode:code,fixtureHashes,providerRequests:0,productionChanged:false,argumentsAndEnvironmentPreserved:true},null,2));
console.log(JSON.stringify({out,exitCode:code}));process.exitCode=code;
