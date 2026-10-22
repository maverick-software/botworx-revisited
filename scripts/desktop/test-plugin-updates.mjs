import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('isolated reviewed plugin update qualification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-plugin-updates/check-'+Date.now()),build=path.join(out,'build');
await mkdir(out,{recursive:true});await writeFile(path.join(out,'package.json'),' {"type":"commonjs"}');
const sources={},files=['desktop/src/plugin-update.ts','desktop/src/plugins.ts','desktop/src/plugin-contracts.ts','desktop/src/broker.ts','desktop/src/native-plugin-skills.ts','desktop/ui/PluginManager.tsx','desktop/database/0058-plugin-updates.sql'];
for(const file of files)sources[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const env={...process.env,AGENTOPIA_PLUGIN_IMPORT_BUILD:build,AGENTOPIA_CHILD_BUILD:build,AGENTOPIA_AGENT_TEST_BUILD:build,AGENTOPIA_PLUGIN_SKILLS_RESOURCES:path.join(root,'.supabase/desktop-goal-limits/candidate-0447/staging/out/Agentopia-win32-x64/resources/resources'),AGENTOPIA_PLUGIN_SKILLS_OUTPUT:out};
async function run(name,args){const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});const log=(result.stdout??'')+(result.stderr??'');await writeFile(path.join(out,name+'.log'),log);assert.equal(result.status,0,name+' failed: '+path.join(out,name+'.log'));return log;}
await run('backend-typecheck',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);await run('renderer-typecheck',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
const loader=path.join(out,'loader.cjs');await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),original=Module._resolveFilename,shared=${JSON.stringify(path.join(root,'desktop/build')+path.sep)},isolated=${JSON.stringify(build+path.sep)};Module._resolveFilename=function(request,parent,...args){let candidate=request;if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request);if(absolute.startsWith(shared))candidate=isolated+absolute.slice(shared.length);}return original.call(this,candidate,parent,...args);};global.fetch=async()=>{throw Error('Unplanned external request in plugin update qualification');};`);
const tests=['plugin-update','plugin-import','plugin-skills','plugin-files','plugin-cache-removal','plugin-child-lifecycle','native-plugin-skill-turns','agent-native-policy'];
const log=await run('tests',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap',...tests.map(name=>'desktop/tests/'+name+'.test.cjs')]);const passed=Number(log.match(/^# pass (\d+)/m)?.[1]);assert(passed>=40);
for(const [file,hash]of Object.entries(sources))assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),hash);
const evidence={success:true,at:new Date().toISOString(),sourceOnly:true,installed:false,productionAccess:false,liveInferenceRequests:0,backendTypecheck:true,rendererTypecheck:true,passed,build,sources};await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,out},null,2));
