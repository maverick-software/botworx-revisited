import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash,json} from './phased-backup-control.mjs';

desktopOperation('qualify document library source and maintenance barriers');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-library71',String(Date.now()));
const build=path.join(out,'build'),temp=path.join('F:/Agentopia-Acceptance','agent-library71-'+path.basename(out));await mkdir(out,{recursive:true});await mkdir(temp,{recursive:true});
const release=await json((await json(path.join(root,'.supabase/desktop-recovery70-release/current.json'))).proof);
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,AGENTOPIA_AGENT_DOCUMENT_BUILD:build,AGENTOPIA_DOCUMENT_TEST_RESOURCES:release.assets};
for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','OPENAI_API_KEY','OPENROUTER_API_KEY'])delete env[key];
const e={success:false,at:new Date().toISOString(),out,build,sourceOnly:true,productionAccess:false,providerRequests:0,sourceHashes:{},commands:[]};
for(const file of ['desktop/src/agent-documents.ts','desktop/src/agent-library-contracts.ts','desktop/src/broker.ts','desktop/src/settings.ts','desktop/ui/AgentDocumentsPanel.tsx','desktop/ui/style.css','desktop/database/0072-agent-document-library.sql','desktop/tests/agent-library.test.cjs'])e.sourceHashes[file]=await hash(path.join(root,file));
async function run(name,args){let text='';const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>text+=bytes);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),text);e.commands.push({name,code});if(code!==0)console.log(text.slice(-3000));assert.equal(code,0,name);return text;}
try{
 await run('backend-types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
 await run('interface-types',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const log=await run('library-tests',['--test','--test-timeout=120000','--test-concurrency=1','--test-reporter=tap','desktop/tests/agent-documents.test.cjs','desktop/tests/agent-library.test.cjs']);
 e.focusedCases=Number(log.match(/^# pass (\d+)/m)?.[1]);
 const loader=path.join(out,'loader.cjs');await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename,source=${JSON.stringify(path.join(root,'desktop/build')+path.sep)};Module._resolveFilename=function(request,parent,...args){if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(source))request=path.join(${JSON.stringify(build)},absolute.slice(source.length));}return resolve.call(this,request,parent,...args)};`);
 const regressions=await run('maintenance-regressions',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap','desktop/tests/backup-broker-barrier.test.cjs','desktop/tests/agent-policy.test.cjs','desktop/tests/portable-settings.test.cjs']);
 e.regressionCases=Number(regressions.match(/^# pass (\d+)/m)?.[1]);
 for(const [file,digest]of Object.entries(e.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,file);e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
const evidence=path.join(out,'evidence.json');await writeFile(evidence,JSON.stringify(e,null,2));await writeFile(path.join(root,'.supabase/desktop-agent-library71/current.json'),JSON.stringify({out,evidence},null,2));
console.log(JSON.stringify({success:e.success,out,focusedCases:e.focusedCases,regressionCases:e.regressionCases,sourceOnly:true,productionAccess:false}));
