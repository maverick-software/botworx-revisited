import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('offline artifact runtime and command verification');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'.supabase/desktop-artifact-authoring','source-check-'+Date.now()),exec=promisify(execFile);await mkdir(out);const evidence={at:new Date().toISOString(),success:false,providerRequests:0,sourceHashes:{},checks:[]};
for(const file of ['desktop/src/script-runtimes.ts','desktop/src/artifact-runtime-manifest.json','desktop/artifact-runtime-pins.json','desktop/runtime/artifact-sitecustomize.py','scripts/desktop/prepare-artifact-runtime.mjs','scripts/desktop/unpack-artifact-wheels.py','scripts/desktop/artifact-authoring-fixture.py','desktop/tests/script-runtimes.test.cjs','scripts/desktop/build.mjs'])evidence.sourceHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
try{
 for(const [name,args] of [['resources',['scripts/desktop/prepare-artifact-runtime.mjs','--verify']],['compile',['node_modules/typescript/bin/tsc','-p','desktop/tsconfig.json']],['commands',['--test','--test-concurrency=1','--test-reporter=tap','desktop/tests/script-runtimes.test.cjs']]]){
  let result;try{result=await exec(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:4*1024*1024});}catch(error){await writeFile(path.join(out,name+'.log'),String(error.stdout??'')+'\n'+String(error.stderr??''));throw error;}await writeFile(path.join(out,name+'.log'),result.stdout+'\n'+result.stderr);evidence.checks.push(name);
  if(name==='commands'){assert(/# fail 0\b/.test(result.stdout));evidence.commandTests=Number(result.stdout.match(/# tests (\d+)/)?.[1]);assert.equal(evidence.commandTests,8);}
 }
 evidence.success=true;console.log(JSON.stringify({success:true,commandTests:evidence.commandTests,evidence:path.join(out,'evidence.json'),providerRequests:0},null,2));
}catch(error){evidence.error=error.message;throw error;}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
