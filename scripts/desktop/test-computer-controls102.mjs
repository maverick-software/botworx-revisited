import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('Computer Use helper-overlay host protection qualification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-computer-retry102','controls-'+Date.now()),build=path.join(out,'snapshot/desktop/build'),tests=path.join(out,'snapshot/desktop/tests');
await mkdir(tests,{recursive:true});
const evidence={success:false,out,providerRequests:0,actualWindowsInput:false,sourceHashes:{},checks:[]};
for(const file of ['desktop/src/computer-service.ts','desktop/tests/computer-service.test.cjs'])evidence.sourceHashes[file]=await hash(path.join(root,file));
async function run(name,args){let output='';const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,NODE_OPTIONS:'',ELECTRON_RUN_AS_NODE:''}});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>output+=data);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});await writeFile(path.join(out,name+'.log'),output);assert.equal(code,0,output.slice(-5000));evidence.checks.push(name);return output;}
try{
 await run('types',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);
 await writeFile(path.join(build,'package.json'),'{"type":"commonjs"}');
 await copyFile(path.join(root,'desktop/tests/computer-service.test.cjs'),path.join(tests,'computer-service.test.cjs'));
 const output=await run('computer-service',['--test','--test-reporter=tap','--test-concurrency=1',path.join(tests,'computer-service.test.cjs')]);
 evidence.passed=Number(output.match(/^# pass (\d+)/m)?.[1]);assert(evidence.passed>10);assert.match(output,/control overlays are unavailable/);
 for(const [file,digest]of Object.entries(evidence.sourceHashes))assert.equal(await hash(path.join(root,file)),digest);
 evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({success:evidence.success,out,passed:evidence.passed,error:evidence.error}));
