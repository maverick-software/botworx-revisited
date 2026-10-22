import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('qualify usage and documents45');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04446'),proof=JSON.parse(await readFile(path.join(candidate,'package-proof.json'),'utf8')),out=path.join(proof.work,'qualification-'+Date.now());await mkdir(out);
const evidence={at:new Date().toISOString(),version:proof.version,imageSha256:proof.imageSha256,out,providerRequests:0,productionAccess:false,success:false};
async function run(label,args,env={}){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},windowsHide:true});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>output+=bytes);child.once('error',reject);child.once('exit',async code=>{await writeFile(path.join(out,label+'.log'),output);code===0?resolve(output):reject(Error(label+' failed: '+path.join(out,label+'.log')));});});}
try{
 try{await writeFile(path.join(out,'previous-attempt.json'),await readFile(path.join(candidate,'qualification.json')));}catch(error){if(error.code!=='ENOENT')throw error;}
 const loader=path.join(out,'loopback-only.cjs');await writeFile(loader,"const real=global.fetch;global.fetch=(url,args)=>{const value=new URL(String(url));if(value.protocol!=='http:'||!['127.0.0.1','localhost'].includes(value.hostname))throw Error('Unplanned network during usage/document verification');return real(url,args);};");
 const tests=['providers','documents','document-find','workspace-links','workspace-tools','workspace-access-tool','workspace-access-scope','workspace-access-diagnostics','workspace-organization','workspace-editor','file-move','chat-polish'];
 const output=await run('backend',['--require',loader,'--test','--test-concurrency=1','--test-reporter=tap',...tests.map(name=>path.join(proof.source,'tests',name+'.test.cjs'))]);
 evidence.backendChecks=Number(output.match(/^# pass (\d+)/m)?.[1]);assert(evidence.backendChecks>50);assert.equal(Number(output.match(/^# fail (\d+)/m)?.[1]),0);assert.equal(Number(output.match(/^# skipped (\d+)/m)?.[1]),0);
 const ui=await run('ui',['scripts/desktop/test-menu-viewer-ui.mjs'],{AGENTOPIA_PARITY_UI:path.join(proof.resources,'ui'),AGENTOPIA_PARITY_SOURCE:proof.source,AGENTOPIA_PARITY_WORD:'D:/Users/charl/Downloads/Sample_Document.docx'});const result=JSON.parse(ui.slice(ui.lastIndexOf('\n{')+1));assert(result.success&&result.checks===16);evidence.uiChecks=result.checks;evidence.uiEvidence=path.join(result.out,'evidence.json');evidence.uiEvidenceSha256=createHash('sha256').update(await readFile(evidence.uiEvidence)).digest('hex');
 evidence.success=true;
}catch(error){evidence.error=error.stack;}
finally{await writeFile(path.join(candidate,'qualification.json'),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify(evidence,null,2));if(!evidence.success)process.exitCode=1;
