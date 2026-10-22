import {mkdir,readFile,writeFile,copyFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),base=path.resolve('C:/Users/charl/AgentopiaQA/workspace-access'),id=String(Date.now()),out=path.join(base,id),build=path.join(root,'.supabase/desktop-workspace-access',id,'build'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(base,{recursive:true});assert.equal((await realpath(base)).toLowerCase(),base.toLowerCase());await mkdir(out);await mkdir(path.dirname(build),{recursive:true});await writeFile(path.join(path.dirname(build),'package.json'),'{"type":"commonjs"}');
const files=['desktop/src/workspace-access-diagnostics.ts','desktop/src/workspace-tools.ts','desktop/src/terminal.ts','desktop/src/tool-service.ts','desktop/src/codex-harness.ts','desktop/tests/workspace-access-diagnostics.test.cjs','desktop/tests/workspace-access-scope.test.cjs','desktop/tests/workspace-access-tool.test.cjs'];
const evidence={at:new Date().toISOString(),sourceOnly:true,installed:false,productionDatabaseChanged:false,realProviderRequests:0,sourceHashes:{},steps:[],success:false};
for(const file of files){const bytes=await readFile(path.join(root,file));evidence.sourceHashes[file]=sha(bytes);const target=path.join(out,'source',file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,file),target);}
const save=()=>writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await save();
function run(name,args,env={}){const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,...env}});return {name,status:result.status,log:(result.stdout??'')+(result.stderr??''),pass:Number(result.stdout?.match(/^# pass (\d+)/m)?.[1]??0),fail:Number(result.stdout?.match(/^# fail (\d+)/m)?.[1]??0)};}
async function step(name,args,env){const result=run(name,args,env);await writeFile(path.join(out,name+'.log'),result.log);assert.equal(result.status,0,name+' failed; inspect retained log');evidence.steps.push({name,status:result.status,pass:result.pass,fail:result.fail});await save();console.log(JSON.stringify(evidence.steps.at(-1)));}
try{
 await step('typecheck-compile',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);
 const env={AGENTOPIA_ACCESS_BUILD:build,AGENTOPIA_TOOL_RECEIPT_SERVICE:path.join(build,'tool-service.js'),AGENTOPIA_NATIVE_ACTIVITY_HELPER:path.join(build,'native-activity-presentation.js')};
 await step('diagnostic-scope-tool-regressions',['--test','--test-reporter=tap',...files.filter(file=>file.includes('/tests/')),path.join(root,'desktop/tests/native-tool-receipts.test.cjs')],env);
 const existing=['workspace-tools.test.cjs','terminal-namespace.test.cjs','native-background.test.cjs'],testDirectory=path.join(path.dirname(build),'tests');await mkdir(testDirectory);for(const name of existing){const file='desktop/tests/'+name,bytes=await readFile(path.join(root,file));evidence.sourceHashes[file]=sha(bytes);await copyFile(path.join(root,file),path.join(testDirectory,name));await copyFile(path.join(root,file),path.join(out,name));}await step('existing-workspace-command-background-regressions',['--test','--test-reporter=tap',...existing.map(name=>path.join(testDirectory,name))],env);
 const require=createRequire(import.meta.url),{WorkspaceAccessDiagnostics}=require(path.join(build,'workspace-access-diagnostics.js'));
 const resources='C:/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.31/resources/resources',selected='D:/Users/charl/Documents/ChatGPT/Internal Project - Agentopia/verification/Native child 1792389994099';
 evidence.actualWindowsDiagnostic=await new WorkspaceAccessDiagnostics(resources).inspect(selected,new AbortController().signal);await save();assert(['blocked','no_matching_event'].includes(evidence.actualWindowsDiagnostic.status),'The actual bounded Windows event read was unavailable.');if(evidence.actualWindowsDiagnostic.status==='blocked')assert(evidence.actualWindowsDiagnostic.evidence.length>0);assert.equal(evidence.actualWindowsDiagnostic.provesWritable,false);
 evidence.sourceUnchanged=(await Promise.all(Object.keys(evidence.sourceHashes).map(async file=>sha(await readFile(path.join(root,file)))===evidence.sourceHashes[file]))).every(Boolean);assert(evidence.sourceUnchanged);evidence.success=true;
}catch(error){evidence.error=error.message;process.exitCode=1;}
await save();console.log(JSON.stringify({success:evidence.success,out,checks:evidence.steps.reduce((n,s)=>n+s.pass,0),windowsDiagnostic:evidence.actualWindowsDiagnostic?.status,error:evidence.error}));
