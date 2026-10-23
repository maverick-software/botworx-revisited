// Reproduce one generated recovery workflow and retain the underlying Git error.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('diagnose one generated bundled Git restoration');
const root=path.resolve(import.meta.dirname,'../..'),qualified=await json((await json(path.join(root,'.supabase/desktop-chat-file-history69/current.json'))).evidence);
assert(qualified.success);for(const [file,digest]of Object.entries(qualified.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);
const out=path.join(root,'.supabase/desktop-chat-file-history69','restore-diagnostic-'+Date.now()),temp=path.join('F:/Agentopia-Acceptance',path.basename(out));await mkdir(out);await mkdir(temp);
const trace=path.join(out,'git-errors.jsonl'),preload=path.join(out,'trace.cjs');
await writeFile(preload,`const cp=require('node:child_process'),fs=require('node:fs'),util=require('node:util'),original=cp.execFile;
function traced(file,args,options,callback){
 if(typeof options==='function'){callback=options;options=undefined;}
 const wrapped=(error,stdout,stderr)=>{if(error&&/git\\.exe$/i.test(file))fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({file,args,code:error.code,stderr:String(stderr).slice(0,8000)})+'\\n');callback?.(error,stdout,stderr);};
 return original(file,args,options,wrapped);
}
traced[util.promisify.custom]=function(file,args,options){let child;const promise=new Promise((resolve,reject)=>{child=traced(file,args,options,(error,stdout,stderr)=>{if(error){error.stdout=stdout;error.stderr=stderr;reject(error);}else resolve({stdout,stderr});});});promise.child=child;return promise;};cp.execFile=traced;
`);
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_SCHEDULE_PROJECT_BUILD:path.resolve(process.argv[2]??qualified.build),AGENTOPIA_PRODUCT_SOURCE:root,AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES:temp,AGENTOPIA_SCHEDULE_GIT_BINARY:path.join(root,'desktop/resources/code-tools/git-2.56.0.windows.2/cmd/git.exe')};
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
const child=spawn(process.execPath,['--require',preload,'--require',path.join(qualified.out,'loader.cjs'),'--test','--test-concurrency=1','--test-name-pattern='+ (process.argv[3]??'^verified archive removes'),'desktop/tests/scheduled-workspace-maintenance.test.cjs'],{cwd:root,env,windowsHide:true});let log='';for(const stream of[child.stdout,child.stderr])stream.on('data',b=>log+=b);
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,'test.log'),log);
let errors=[];try{errors=(await readFile(trace,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify({at:new Date().toISOString(),out,code,errors,generatedFilesOnly:true,productionAccess:false,providerRequests:0},null,2));console.log(JSON.stringify({out,code,failedGitCommands:errors.length,errorsWithDiagnostics:errors.filter(row=>row.stderr).map(row=>({code:row.code,stderr:row.stderr.slice(0,1200)}))}));
