import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify durable named-agent report delivery without inference');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-agent-reports56',String(Date.now())),build=path.join(out,'build'),exec=promisify(execFile);await mkdir(out,{recursive:true});
const evidence={success:false,at:new Date().toISOString(),out,scope:'Durable report delivery, source ownership, native continuation and broker integration with controlled fixtures; not installed',productionAccess:false,providerRequests:0,sourceHashes:{}};
const families=['queue','native','source','recovery','broker'],files=families.map(name=>'desktop/tests/agent-report-'+name+'.test.cjs');
for(const file of ['desktop/src/agent-report-queue.ts','desktop/src/agent-report-source.ts','desktop/src/agent-report-recovery.ts','desktop/src/broker.ts','desktop/src/agent-assignments.ts','desktop/src/agent-service.ts','desktop/src/codex-harness.ts','desktop/src/native-contracts.ts','desktop/ui/AgentReportStatus.tsx','desktop/ui/NativeTurn.tsx','desktop/ui/ChatActivity.tsx','desktop/ui/WorkspaceViews.tsx',...files])evidence.sourceHashes[file]=await hash(path.join(root,file));
try{
 const types=await exec(process.execPath,['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError'],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});await writeFile(path.join(out,'types.log'),types.stdout+types.stderr);
 await writeFile(path.join(build,'package.json'),JSON.stringify({type:'commonjs'}));
 const uiTypes=await exec(process.execPath,['node_modules/typescript/bin/tsc','-p','desktop/ui/tsconfig.json'],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});await writeFile(path.join(out,'ui-types.log'),uiTypes.stdout+uiTypes.stderr);
 const tests=await exec(process.execPath,['--test','--test-timeout=20000','--test-concurrency=1','--test-reporter=tap',...files],{cwd:root,windowsHide:true,timeout:60000,maxBuffer:2*1024*1024,env:{...process.env,AGENTOPIA_AGENT_REPORT_BUILD:build}});await writeFile(path.join(out,'tests.log'),tests.stdout+tests.stderr);const passed=Number(tests.stdout.match(/^# pass (\d+)/m)?.[1]);assert(passed>=87&&/^# fail 0$/m.test(tests.stdout));for(const [file,digest]of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,file)),digest,'Source changed during qualification: '+file);evidence.tests=passed;evidence.success=true;
}catch(error){evidence.error=error.message;await writeFile(path.join(out,'failure.log'),String(error.stdout??'')+String(error.stderr??''));process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-agent-reports56/current.json'),JSON.stringify({out,evidence:path.join(out,'evidence.json'),success:evidence.success},null,2));console.log(JSON.stringify(evidence));
