import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash} from './phased-backup-control.mjs';

desktopOperation('serialize the frozen purple repair interface regressions');
const root=path.resolve(import.meta.dirname,'../..'),pointer=await json(path.join(root,'.supabase/desktop-computer-repair76/current.json')),proof=await json(pointer.proof),out=path.join(proof.out,'interface-qualification-'+Date.now()),exec=promisify(execFile);await mkdir(out);assert.equal(await hash(proof.image),proof.imageSha256);
const e={success:false,out,proof:pointer.proof,imageSha256:proof.imageSha256,providerRequests:0,workflows:[]};
try{
 const reuse=process.argv[2]?await json(path.resolve(process.argv[2])):null;if(reuse){assert.equal(reuse.imageSha256,proof.imageSha256);assert.equal(reuse.workflows[0]?.script,'test-agent-parity76-app.mjs');const accepted=await json(reuse.workflows[0].evidence);assert(accepted.success&&accepted.checks.length===23&&path.resolve(accepted.rendererResources)===path.resolve(proof.ui));e.workflows.push(reuse.workflows[0]);}
 if(process.argv[3]){assert(reuse);const file=path.resolve(process.argv[3]),accepted=await json(file);assert(accepted.success&&accepted.checks.length===8&&path.resolve(accepted.rendererResources)===path.resolve(proof.ui)&&accepted.inferenceRequests===0);e.workflows.push({script:'test-chat-acceptance-drafts76-ui.mjs',evidence:file,checks:8});}
 for(const [name,extra]of [['test-agent-parity76-app.mjs',{AGENTOPIA_PARITY_SOURCE:proof.source,AGENTOPIA_PARITY_UI:proof.ui}],['test-chat-acceptance-drafts76-ui.mjs',{AGENTOPIA_DRAFT_UI_RESOURCES:proof.ui}],['test-new-chat-workspace76.mjs',{AGENTOPIA_NEW_CHAT_UI:proof.ui}]].slice(e.workflows.length)){
  console.log('Frozen interface: '+name);const run=await exec(process.execPath,[path.join(root,'scripts/desktop',name)],{cwd:root,env:{...process.env,...extra},windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:1024*1024});await writeFile(path.join(out,name+'.log'),run.stdout+run.stderr);
  const match=run.stdout.match(/\{[\s\S]*"success"[\s\S]*\}\s*$/);assert(match,'Missing interface result');const result=JSON.parse(match[0]),file=result.evidence??path.join(result.out,'evidence.json'),record=await json(file);assert(record.success&&record.rendererErrors.length===0);e.workflows.push({script:name,evidence:file,checks:record.checks.length});
 }
 assert.deepEqual(e.workflows.map(row=>row.checks),[23,8,5]);e.success=true;
}catch(error){e.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(e,null,2));console.log(JSON.stringify(e));
