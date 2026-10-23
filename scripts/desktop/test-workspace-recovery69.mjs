import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';

desktopOperation('qualify streamed Git recovery with bundled Git and generated files');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-file-history69','recovery-'+Date.now()),build=path.join(out,'build'),temp=path.join('F:/Agentopia-Acceptance',path.basename(out));await mkdir(out);await mkdir(temp);
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_CHAT_OUTPUT_BUILD:build,AGENTOPIA_PROFILE_TEST_BUILD:build,AGENTOPIA_SCHEDULE_PROJECT_BUILD:build,AGENTOPIA_PRODUCT_SOURCE:root,AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES:temp,AGENTOPIA_SCHEDULE_GIT_BINARY:path.join(root,'desktop/resources/code-tools/git-2.56.0.windows.2/cmd/git.exe')};for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
const e={success:false,out,build,at:new Date().toISOString(),sourceHashes:{},commands:[],productionAccess:false,providerRequests:0,installed:false};
for(const name of ['scheduled-workspaces.ts','scheduled-workspace-maintenance.ts','workspace-git-bundle.ts','workspace-recovery-files.ts','workspace-backup-snapshot.ts','chat-files.ts'])e.sourceHashes['desktop/src/'+name]=await hash(path.join(root,'desktop/src',name));e.sourceHashes['desktop/tests/scheduled-workspace-maintenance.test.cjs']=await hash(path.join(root,'desktop/tests/scheduled-workspace-maintenance.test.cjs'));
async function run(name,args){let log='';const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});for(const stream of[child.stdout,child.stderr])stream.on('data',b=>log+=b);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),log);e.commands.push({name,code});assert.equal(code,0,name+' failed; inspect '+path.join(out,name+'.log'));return log;}
try{
 await run('types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
 const loader=path.join(out,'loader.cjs');await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename,source=${JSON.stringify(path.join(root,'desktop/build')+path.sep)};Module._resolveFilename=function(request,parent,...args){if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(source))request=path.join(${JSON.stringify(build)},absolute.slice(source.length));}return resolve.call(this,request,parent,...args)};global.fetch=()=>{throw Error('Network forbidden in generated recovery checks')};`);
 const filter=process.argv[2];e.filter=filter??null;
 const log=await run('recovery',['--require',loader,'--test','--test-reporter=tap','--test-timeout=90000','--test-concurrency=1',...(filter?['--test-name-pattern='+filter]:[]),'desktop/tests/scheduled-workspace-maintenance.test.cjs']);assert(/# fail 0\b/.test(log));e.passed=Number(log.match(/^# pass (\d+)/m)?.[1]);
 for(const [file,digest]of Object.entries(e.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify({success:e.success,out,passed:e.passed,error:e.error?.split('\n')[0]}));
