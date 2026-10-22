import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify long-history private file links in isolated source build');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-file-history69',String(Date.now())),build=path.join(out,'build'),temp=path.join('F:/Agentopia-Acceptance','file-history69-'+path.basename(out));await mkdir(temp,{recursive:true});await mkdir(out,{recursive:true});
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_CHAT_OUTPUT_BUILD:build,AGENTOPIA_PROFILE_TEST_BUILD:build,AGENTOPIA_SCHEDULE_PROJECT_BUILD:build,AGENTOPIA_PRODUCT_SOURCE:root,AGENTOPIA_SCHEDULE_RECOVERY_FIXTURES:temp,AGENTOPIA_SCHEDULE_GIT_BINARY:'C:/Program Files/Git/cmd/git.exe'},commands=[];
for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
async function run(name,args){let log='';const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});for(const s of [child.stdout,child.stderr])s.on('data',b=>log+=b);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});await writeFile(path.join(out,name+'.log'),log);commands.push({name,code,log:path.join(out,name+'.log')});if(code!==0)console.log(log.slice(-6000));assert.equal(code,0,name);return log;}
const evidence={success:false,at:new Date().toISOString(),out,build,sourceOnly:true,installed:false,productionAccess:false,providerRequests:0,commands,sourceHashes:{}};
for(const file of ['desktop/src/chat-files.ts','desktop/tests/chat-file-history.test.cjs','scripts/desktop/test-chat-file-history69.mjs'])evidence.sourceHashes[file]=await hash(path.join(root,file));
try{await run('types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
const loader=path.join(out,'loader.cjs');await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename,source=${JSON.stringify(path.join(root,'desktop/build')+path.sep)};Module._resolveFilename=function(request,parent,...args){if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(source))request=path.join(${JSON.stringify(build)},absolute.slice(source.length));}return resolve.call(this,request,parent,...args)};global.fetch=()=>{throw Error('Network forbidden in local file-link checks')};`);
const suites=['chat-file-history','chat-polish','chat-output-edits','migrated-chat-output','external-recovery','public-file-recovery','relocated-profile-consumers'];
const log=await run('tests',['--require',loader,'--test','--test-timeout=90000','--test-reporter=tap','--test-concurrency=1',...suites.map(n=>'desktop/tests/'+n+'.test.cjs')]);assert(/# fail 0\b/.test(log));evidence.passed=Number(log.match(/^# pass (\d+)/m)?.[1]);
const restored=await run('restored-link-tests',['--require',loader,'--test','--test-timeout=90000','--test-reporter=tap','--test-name-pattern=Owned restored file','desktop/tests/scheduled-workspace-maintenance.test.cjs']);assert(/# fail 0\b/.test(restored));evidence.restoredLinkCases=Number(restored.match(/^# pass (\d+)/m)?.[1]);
for(const [file,digest] of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,'Source changed during qualification: '+file);evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-chat-file-history69/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:evidence.success,out,passed:evidence.passed,sourceOnly:true,installed:false}));
