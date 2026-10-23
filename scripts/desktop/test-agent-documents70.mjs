import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';
desktopOperation('qualify persistent agent document source without production access');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-documents70',String(Date.now())),build=path.join(out,'build'),temp=path.join('F:/Agentopia-Acceptance','agent-documents70-'+path.basename(out));
await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_AGENT_DOCUMENT_BUILD:build,AGENTOPIA_GOAL_BUILD:build};
const release=await json((await json(path.join(root,'.supabase/desktop-recovery69-release/current.json'))).proof);
assert.equal(await hash(release.image),release.imageSha256);env.AGENTOPIA_DOCUMENT_TEST_RESOURCES=release.assets;
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
const evidence={success:false,at:new Date().toISOString(),out,build,sourceOnly:true,installed:false,productionAccess:false,providerRequests:0,sourceHashes:{},commands:[]};
for(const name of ['agent-documents.ts','broker.ts','tool-service.ts','codex-harness.ts'])evidence.sourceHashes['desktop/src/'+name]=await hash(path.join(root,'desktop/src',name));
for(const name of ['desktop/database/0071-agent-documents.sql','desktop/ui/AgentDocumentsPanel.tsx','desktop/ui/AgentSettings.tsx','desktop/tests/agent-documents.test.cjs','desktop/tests/agent-documents-native.test.cjs'])evidence.sourceHashes[name]=await hash(path.join(root,name));
async function run(name,args){let text='';const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>text+=bytes);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),text);evidence.commands.push({name,code});if(code!==0)console.log(text.slice(-4500));assert.equal(code,0,name);return text;}
try{
 await run('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
 await run('interface-types',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const log=await run('document-tests',['--test','--test-reporter=tap','desktop/tests/agent-documents.test.cjs']);evidence.passed=Number(log.match(/^# pass (\d+)/m)?.[1]);
 await run('native-document-tests',['--test','--test-reporter=tap','desktop/tests/agent-documents-native.test.cjs']);evidence.actualCodexHarnessControlledAdapters=true;evidence.controlledNativeResponses=3;
 const loader=path.join(out,'loader.cjs');await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename,source=${JSON.stringify(path.join(root,'desktop/build')+path.sep)};Module._resolveFilename=function(request,parent,...args){if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(source))request=path.join(${JSON.stringify(build)},absolute.slice(source.length));}return resolve.call(this,request,parent,...args)};`);
 const suites=['agent-policy','agent-native-policy','agent-report-native','agent-references','documents','native-steering-context','native-child-recovery-policy','native-goal-broker','fresh-agent-integrations'];
 const regressions=await run('regression-tests',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap',...suites.map(name=>'desktop/tests/'+name+'.test.cjs')]);evidence.regressionCases=Number(regressions.match(/^# pass (\d+)/m)?.[1]);
 for(const [file,digest]of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,'Source changed during qualification: '+file);evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-agent-documents70/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:evidence.success,out,passed:evidence.passed,sourceOnly:true,installed:false}));
