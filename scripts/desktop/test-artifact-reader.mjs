import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.resolve(process.argv[2]),workerFile=path.resolve(process.argv[3]);
assert(directory.startsWith(path.join(root,'.supabase/desktop-artifact-authoring')+path.sep));assert(workerFile.startsWith(path.join(root,'.supabase')+path.sep));
const creation=JSON.parse(await readFile(path.join(directory,'creation-evidence.json'),'utf8')),reads=[];
for(const file of creation.files.filter(file=>/\.(docx|xlsx|pptx|pdf)$/.test(file.name))){
 const bytes=await readFile(path.join(directory,file.name));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
 const result=await new Promise((resolve,reject)=>{const worker=new Worker(workerFile,{workerData:{data:new Uint8Array(bytes),extension:path.extname(file.name)},stdout:true,stderr:true});worker.stdout.resume();worker.stderr.resume();const timer=setTimeout(()=>{worker.terminate();reject(Error('Document read timed out: '+file.name));},30000);worker.once('message',value=>{clearTimeout(timer);resolve(value);});worker.once('error',error=>{clearTimeout(timer);reject(error);});worker.once('exit',code=>{if(code){clearTimeout(timer);reject(Error('Document reader exited '+code));}});});
 assert(result.ok,result.error);assert(JSON.stringify(result.result).includes(creation.marker),file.name);if(file.name.endsWith('.xlsx'))assert(JSON.stringify(result.result).includes('SUM(B2:B3)'));if(file.name.endsWith('.pptx'))assert(JSON.stringify(result.result).includes('Generated speaker notes'));
 reads.push({file:file.name,kind:result.result.kind,sections:result.result.sections.length,markerFound:true});
}
assert.equal(reads.length,4);const evidence={at:new Date().toISOString(),success:true,workerFile,workerSha256:createHash('sha256').update(await readFile(workerFile)).digest('hex'),reads,providerRequests:0,scope:'Independent JavaScript document reader consumes Python-authored files. Visual rendering and agent-driven authoring are not established.'};await writeFile(path.join(directory,'reader-evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
