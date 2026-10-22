import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractAll} from '@electron/asar';
import {desktopOperation} from './operation-lock.mjs';

desktopOperation('qualify exact cross-chat desktop image');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-chat-inspection/candidate-04418'),proof=JSON.parse(await readFile(path.join(candidate,'package-proof.json'),'utf8'));
assert(proof.success&&proof.version==='0.44.18'&&proof.migrations===60);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(await readFile(proof.image)),proof.imageSha256);
for(const [file,digest]of Object.entries(proof.sourceHashes))assert.equal(hash(await readFile(path.join(proof.source,file))),digest);
const out=path.join(candidate,'qualification-'+Date.now()),archived=path.join(out,'archived');await mkdir(out);extractAll(proof.image,archived);
await cp(path.join(proof.source,'tests'),path.join(out,'snapshot/desktop/tests'),{recursive:true});
const tests=path.join(out,'snapshot/desktop/tests'),loader=path.join(out,'loader.cjs');
await writeFile(loader,`const Module=require('node:module'),path=require('node:path'),original=Module._resolveFilename,roots=${JSON.stringify([path.join(root,'desktop/build')+path.sep,path.join(out,'snapshot/desktop/build')+path.sep])},build=${JSON.stringify(path.join(archived,'build')+path.sep)};Module._resolveFilename=function(request,parent,...args){let candidate=request;if(typeof request==='string'&&(request.startsWith('.')||path.isAbsolute(request))){const absolute=path.resolve(parent?.filename?path.dirname(parent.filename):process.cwd(),request),root=roots.find(root=>absolute.startsWith(root));if(root)candidate=build+absolute.slice(root.length);}return original.call(this,candidate,parent,...args);};const real=global.fetch;global.fetch=(url,args)=>{const parsed=new URL(String(url));if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1')throw Error('Unplanned network in exact-image qualification');return real(url,args);};`);
const resources=path.join(proof.portableDirectory,'resources/resources'),env={...process.env,AGENTOPIA_INSPECTION_BUILD:path.join(archived,'build'),AGENTOPIA_AGENT_TEST_BUILD:path.join(archived,'build'),AGENTOPIA_GOAL_BUILD:path.join(archived,'build'),AGENTOPIA_GOAL_OUTPUT:out,AGENTOPIA_GOAL_RESOURCES:resources,AGENTOPIA_GOAL_QUEUE_UI_RESOURCES:path.join(resources,'ui'),AGENTOPIA_READING_UI_RESOURCES:path.join(resources,'ui')};
const result={...proof,at:new Date().toISOString(),installed:false,productionAccess:false,inferenceRequests:0,exactArchivedBackend:true};
async function run(name,args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{output+=bytes;});child.once('error',reject);child.once('exit',async code=>{await writeFile(path.join(out,name+'.log'),output);console.log(name+': '+code+'\n'+output.slice(-1000));code===0?resolve(output):reject(Error(name+' failed'));});});}
const summary=output=>{const start=output.lastIndexOf('\n{');assert(start>=0,'Workflow did not return its evidence path');return JSON.parse(output.slice(start+1));};
try{
 const names=['chat-inspection','native-inference-routing','agent-policy','agent-native-policy','native-goals','native-goal-broker','chat-queue','native-steering-context'];
 const units=await run('backend',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap',...names.map(name=>path.join(tests,name+'.test.cjs'))]);result.unitChecks=Number(units.match(/^# pass (\d+)/m)?.[1]);assert(result.unitChecks>=59);
 for(const [name,script]of [['reading','test-chat-reading-ui.mjs'],['goal-queue','test-goal-queue-ui.mjs']]){
  const file=path.join(root,'scripts/desktop',script);await cp(file,path.join(out,script));
  const workflow=summary(await run(name,[file])),evidence=JSON.parse(await readFile(path.join(workflow.out,'evidence.json'),'utf8'));
  assert(workflow.success&&evidence.success);result[name]={evidence:path.join(workflow.out,'evidence.json'),checks:workflow.checks};
 }
 assert.equal(hash(await readFile(proof.image)),proof.imageSha256);result.success=true;result.phase='exact-image-controlled-qualification-complete';
}catch(error){result.success=false;result.error=error.message;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(result,null,2));await writeFile(path.join(candidate,'qualification.json'),JSON.stringify({...result,evidence:path.join(out,'evidence.json')},null,2));
console.log(JSON.stringify({success:result.success,unitChecks:result.unitChecks,out},null,2));
