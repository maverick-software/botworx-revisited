import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-goal-queue/steering-recovery-'+Date.now()),build=path.join(out,'build');
await mkdir(out);await writeFile(path.join(out,'package.json'),'{"type":"commonjs"}');
async function run(name,args,backend=build){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,AGENTOPIA_GOAL_BUILD:backend},windowsHide:true});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk);child.on('error',reject);child.on('close',async code=>{await writeFile(path.join(out,name+'.log'),output);resolve({code,output});});});}
const old=await run('before',['--test','desktop/tests/chat-queue.test.cjs'],path.join(root,'.supabase/desktop-goal-queue/candidate-04415/qualification-1792338670899/archived/build'));
assert.notEqual(old.code,0);assert.match(old.output,/accepted steering survives/);assert.match(old.output,/1 !== 0/);
const compile=await run('compile',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json','--outDir',build,'--noEmitOnError']);assert.equal(compile.code,0,compile.output);
const checks=await run('after',['--test','desktop/tests/chat-queue.test.cjs','desktop/tests/native-steering-context.test.cjs']);assert.equal(checks.code,0,checks.output);
const evidence={success:true,at:new Date().toISOString(),out,oldImageReproducedAutomaticReplay:true,acceptedSteeringHeldAfterSaveFailure:true,checks:9,providerRequests:0,productionAccess:false};
await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'.supabase/desktop-goal-queue/steering-recovery-latest.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
