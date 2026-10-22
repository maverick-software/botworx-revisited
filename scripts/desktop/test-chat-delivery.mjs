import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('isolated cross-chat delivery qualification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-chat-delivery/check-'+Date.now()),build=path.join(out,'build');
await mkdir(out,{recursive:true});await writeFile(path.join(out,'package.json'),'{"type":"commonjs"}');
const evidence={success:false,at:new Date().toISOString(),installed:false,productionMigrations:0,liveInferenceRequests:0,build};
const files=['desktop/src/chat-delivery.ts','desktop/src/chat-delivery-queue.ts','desktop/src/chat-origin.ts','desktop/src/chat-queue.ts','desktop/src/composer.ts','desktop/src/codex-harness.ts','desktop/src/contracts.ts','desktop/src/native-contracts.ts','desktop/src/agent-policy.ts','desktop/src/tool-service.ts','desktop/src/tool-contracts.ts','desktop/src/broker.ts','desktop/ui/ToolActivity.tsx','desktop/ui/ChatDeliveryReview.tsx','desktop/ui/ChatQueue.tsx','desktop/ui/ChatOrigin.tsx','desktop/ui/WorkspaceViews.tsx','desktop/ui/NativeTurn.tsx','desktop/ui/chat-delivery.css','desktop/database/0061-chat-delivery.sql','desktop/database/0062-chat-delivery-turns.sql','desktop/database/0063-chat-delivery-dispatch.sql','desktop/tests/chat-delivery.test.cjs','desktop/tests/chat-delivery-tools.test.cjs','desktop/tests/chat-delivery-queue.test.cjs','desktop/tests/chat-delivery-broker.test.cjs'];
files.push('desktop/ui/SettingsPanel.tsx','desktop/ui/ChatCoordinationSettings.tsx');
const fingerprints=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
async function run(name,args){const result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,AGENTOPIA_DELIVERY_BUILD:build,AGENTOPIA_GOAL_BUILD:build,AGENTOPIA_AGENT_TEST_BUILD:build,AGENTOPIA_DELIVERY_OUTPUT:out,AGENTOPIA_DELIVERY_RESOURCES:path.join(root,'desktop/resources')},encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});await writeFile(path.join(out,name+'.log'),(result.stdout??'')+(result.stderr??''));if(result.status!==0)throw Error(name+' failed. Inspect '+path.join(out,name+'.log'));return result.stdout;}
try{
 evidence.sourceSha256=await fingerprints();
 await run('backend',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);
 await run('renderer',['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json']);
 const loader=path.join(out,'network-guard.cjs');await writeFile(loader,"global.fetch=()=>{throw Error('Network requests are forbidden in delivery unit tests');};");
 const log=await run('tests',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap','desktop/tests/chat-delivery.test.cjs','desktop/tests/chat-delivery-tools.test.cjs','desktop/tests/chat-delivery-queue.test.cjs','desktop/tests/chat-delivery-broker.test.cjs','desktop/tests/chat-queue.test.cjs','desktop/tests/agent-policy.test.cjs','desktop/tests/agent-native-policy.test.cjs']);
 evidence.passed=Number(log.match(/^# pass (\d+)/m)?.[1]);evidence.mainTypecheck=true;evidence.rendererTypecheck=true;
 if(JSON.stringify(await fingerprints())!==JSON.stringify(evidence.sourceSha256))throw Error('Delivery sources changed during qualification.');
 evidence.success=true;
}catch(error){evidence.error=error.message;process.exitCode=1;}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,passed:evidence.passed,error:evidence.error,out},null,2));}
