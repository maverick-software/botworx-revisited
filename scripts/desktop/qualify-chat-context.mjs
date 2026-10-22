import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('qualify chat details and sidebar parity');
const root=path.resolve(import.meta.dirname,'../..'),json=async p=>JSON.parse(await readFile(p,'utf8')),pointer=await json(path.join(root,'.supabase/desktop-chat-details/current.json')),proof=await json(pointer.proof),sha=b=>createHash('sha256').update(b).digest('hex');
assert(proof.success&&!proof.installed&&proof.backendUnchanged);
let evidence={success:false,at:new Date().toISOString(),revision:proof.revision,proof:pointer.proof,proofSha256:sha(await readFile(pointer.proof)),receipts:{},totalChecks:0,providerRequests:0};
try{evidence=await json(path.join(proof.work,'qualification-progress.json'));assert.equal(evidence.proofSha256,sha(await readFile(pointer.proof)));}catch(e){if(e.code!=='ENOENT')throw e;}
for(const [name,script,env,count] of [
 ['details','test-chat-context-ui.mjs',{AGENTOPIA_READING_UI_RESOURCES:proof.ui},10],
 ['navigation','test-workspace-navigation-ui.mjs',{AGENTOPIA_READING_UI_RESOURCES:proof.ui},15],
 ['agents','test-workspace-navigation-agents.mjs',{AGENTOPIA_AGENT_UI_RESOURCES:proof.ui},6],
 ['viewer','test-menu-viewer-ui.mjs',{AGENTOPIA_PARITY_SOURCE:proof.source,AGENTOPIA_PARITY_UI:proof.ui},16],
]){
 if(evidence.receipts[name]){assert.equal(sha(await readFile(evidence.receipts[name].file)),evidence.receipts[name].sha256);continue;}
 let priorLog;try{priorLog=await readFile(path.join(proof.work,name+'.log'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 const result=priorLog?{status:0,stdout:priorLog,stderr:''}:spawnSync(process.execPath,['scripts/desktop/'+script],{cwd:root,env:{...process.env,...env},windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:8*1024**2});await writeFile(path.join(proof.work,name+'.log'),result.stdout+result.stderr);assert.equal(result.status,0,name+' failed; inspect retained log');
 const start=result.stdout.lastIndexOf('\n{'),receipt=JSON.parse(result.stdout.slice(start+1));assert(receipt.success&&(Array.isArray(receipt.checks)?receipt.checks.length:receipt.checks)===count);
 const file=path.join(receipt.out,'evidence.json');evidence.receipts[name]={file,sha256:sha(await readFile(file)),checks:count,script:'scripts/desktop/'+script,scriptSha256:sha(await readFile(path.join(root,'scripts/desktop',script)))};evidence.totalChecks+=count;await writeFile(path.join(proof.work,'qualification-progress.json'),JSON.stringify(evidence,null,2));console.log('PASS '+name+' '+count);
}
evidence.success=true;await writeFile(path.join(proof.work,'qualification.json'),JSON.stringify(evidence,null,2),{flag:'wx'});await writeFile(path.join(root,'.supabase/desktop-chat-details/current.json'),JSON.stringify({...pointer,qualification:path.join(proof.work,'qualification.json')},null,2));console.log(JSON.stringify({success:true,checks:evidence.totalChecks,work:proof.work}));
