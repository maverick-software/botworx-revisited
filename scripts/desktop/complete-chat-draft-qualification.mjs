import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('complete41 provider-failure fixture after version allowlist correction');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04441'),json=async p=>JSON.parse(await readFile(p,'utf8')),hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const proof=await json(path.join(candidate,'package-proof.json')),prior=await json(path.join(candidate,'qualification.json'));
assert(proof.success&&proof.version==='0.44.41'&&!prior.success&&(prior.error.includes('connection-failures failed')||prior.error.includes('index>=0')));
assert.equal(proof.imageSha256,prior.imageSha256);assert.equal(await hash(proof.image),proof.imageSha256);
const failure=prior.evidence;assert.equal(path.dirname(path.dirname(failure)),proof.work);
const out=path.join(proof.work,'qualification-completion-'+Date.now());await mkdir(out);
await copyFile(path.join(candidate,'qualification.json'),path.join(out,'previous-failed-qualification.json'));
const record={...prior,at:new Date().toISOString(),success:false,continuedFrom:{evidence:failure,sha256:await hash(failure),reason:'Only provider-failure fixture startup rejected the new41 version; no application operation ran in that failed group.'}};
assert.equal(Object.values(prior.workflows).reduce((n,w)=>n+w.checks,0),47);
for(const w of Object.values(prior.workflows)){assert.equal(await hash(w.evidence),w.sha256);assert((await json(w.evidence)).success);}
for(const [name,digest] of Object.entries(proof.sourceHashes))assert.equal(await hash(path.join(proof.source,name)),digest);
for(const [name,digest] of Object.entries(proof.resourceFiles))assert.equal(await hash(path.join(proof.portableDirectory,'resources/resources',name)),digest);
const script=path.join(root,'scripts/desktop/test-provider-failure-chat-ui.mjs');await copyFile(script,path.join(out,'test-provider-failure-chat-ui.mjs'));
try{
 const env={...process.env,AGENTOPIA_FAILURE_UI_CANDIDATE:'04441'};delete env.ELECTRON_RUN_AS_NODE;
 let stdout,stderr='';
 if(process.argv[2]){const completed=path.resolve(process.argv[2]);assert.equal(path.dirname(completed),path.resolve('C:/Users/charl/AgentopiaQA/provider-failure-ui'));assert(/^\d{13}$/.test(path.basename(completed)));stdout=await readFile(path.join(path.dirname(failure),'connection-failures.log'),'utf8');assert.equal(JSON.parse(stdout.trim()).out,completed);record.adoptedCompletedProviderWorkflow=true;}
 else ({stdout,stderr}=await promisify(execFile)(process.execPath,[script,'--delivered'],{cwd:root,env,windowsHide:true,timeout:120000,maxBuffer:4*1024*1024}));
 await writeFile(path.join(out,'connection-failures.log'),stdout+stderr);console.log(stdout);
 const text=stdout.trim(),index=text.lastIndexOf('\n{'),summary=JSON.parse(index>=0?text.slice(index+1):text),file=path.join(summary.out,'evidence.json'),e=await json(file);
 assert(summary.success&&e.success&&e.delivered&&e.imageSha256===proof.imageSha256&&(Array.isArray(summary.checks)?summary.checks.length:summary.checks)===10);
 record.workflows['connection-failures']={evidence:file,sha256:await hash(file),checks:10};record.frontendChecks=57;record.allFrontendWorkflowsFresh=true;record.phase='exact-image-qualification-complete';record.success=true;delete record.error;
 assert.equal(await hash(proof.image),proof.imageSha256);
}catch(error){record.error=error.stack;process.exitCode=1;}
await writeFile(path.join(out,'evidence.json'),JSON.stringify(record,null,2));await writeFile(path.join(candidate,'qualification.json'),JSON.stringify({...record,evidence:path.join(out,'evidence.json')},null,2));console.log(JSON.stringify({success:record.success,frontendChecks:record.frontendChecks,out,error:record.error}));
