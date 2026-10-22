import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('isolated chat inspection and native ownership qualification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-inspection/check-'+Date.now()),build=path.join(out,'build');
await mkdir(out,{recursive:true});await writeFile(path.join(out,'package.json'),'{"type":"commonjs"}');
const resources='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.17/resources/resources';
const env={...process.env,AGENTOPIA_INSPECTION_BUILD:build,AGENTOPIA_AGENT_TEST_BUILD:build,AGENTOPIA_GOAL_BUILD:build,AGENTOPIA_GOAL_OUTPUT:out,AGENTOPIA_GOAL_RESOURCES:resources};
const evidence={success:false,at:new Date().toISOString(),installed:false,productionMigrations:0,liveInferenceRequests:0,build};
const sources=['desktop/src/chat-inspection.ts','desktop/src/project-memory.ts','desktop/src/tool-service.ts','desktop/src/broker.ts','desktop/src/codex-harness.ts','desktop/src/agent-policy.ts','desktop/ui/AgentDefinitionEditor.tsx','desktop/database/0060-chat-inspection.sql'];
sources.push('desktop/src/chat-delivery.ts','desktop/src/chat-delivery-queue.ts','desktop/tests/native-goal-broker.test.cjs');
const fingerprints=async()=>Object.fromEntries(await Promise.all(sources.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
async function run(name,args){const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});await writeFile(path.join(out,name+'.log'),(result.stdout??'')+(result.stderr??''));if(result.status!==0)throw Error(name+' failed. Inspect '+path.join(out,name+'.log'));return result.stdout;}
try{
 evidence.sourceSha256=await fingerprints();
 await run('backend',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);
 await run('renderer',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const loader=path.join(out,'network-guard.cjs');await writeFile(loader,`const original=global.fetch;global.fetch=(url,args)=>{const parsed=new URL(String(url));if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1')throw Error('Unplanned network in chat inspection qualification');return original(url,args);};`);
 const log=await run('tests',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap','desktop/tests/chat-inspection.test.cjs','desktop/tests/native-inference-routing.test.cjs','desktop/tests/agent-policy.test.cjs','desktop/tests/agent-native-policy.test.cjs','desktop/tests/native-goals.test.cjs','desktop/tests/native-goal-broker.test.cjs']);
 evidence.passed=Number(log.match(/^# pass (\d+)/m)?.[1]);evidence.mainTypecheck=true;evidence.rendererTypecheck=true;
 if(JSON.stringify(await fingerprints())!==JSON.stringify(evidence.sourceSha256))throw Error('Source changed during qualification. Inspect the saved build and rerun the affected checks.');
 evidence.success=true;
}catch(error){evidence.error=error.message;process.exitCode=1;}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,passed:evidence.passed,error:evidence.error,out},null,2));}
