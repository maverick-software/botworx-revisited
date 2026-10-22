import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {desktopOperation} from './operation-lock.mjs';
import {hash} from './phased-backup-control.mjs';
desktopOperation('qualify frozen startup reading and retained navigation/agent workflows');
const root=path.resolve(import.meta.dirname,'../..'),candidate=path.join(root,'.supabase/desktop-platform-release/candidate-04447'),proof=JSON.parse(await readFile(path.join(candidate,'startup-reading-proof.json'),'utf8'));
for(const [name,digest] of Object.entries(proof.sourceHashes).filter(([name])=>name.startsWith('ui/')))assert.equal(await hash(path.join(root,'desktop',name)),digest,'The source-agent fixture must use the same UI source as the frozen build');
async function run(label,script,environment={}){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{cwd:root,windowsHide:true,env:{...process.env,...environment}});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{output+=bytes;});child.once('error',reject);child.once('exit',async code=>{await writeFile(path.join(proof.work,label+'.log'),output);if(code!==0)return reject(Error(label+' failed; see '+path.join(proof.work,label+'.log')));console.log('PASS '+label);resolve(JSON.parse(output.slice(output.lastIndexOf('\n{')+1)));});});}
const evidence={at:new Date().toISOString(),success:false,version:'0.44.47',uiHotfixRevision:1,resourceManifestSha256:proof.resourceManifestSha256,productionAccess:false,providerRequests:0,unchangedBackend:true};
try{
 // Run visible-window keyboard checks sequentially so they cannot steal focus from one another.
 const reading=await run('navigation','scripts/desktop/test-workspace-navigation-ui.mjs',{AGENTOPIA_READING_UI_RESOURCES:proof.ui});assert(reading.success&&reading.checks===15);
 const startup=await run('startup-reading','scripts/desktop/test-chat-reading-startup-ui.mjs',{AGENTOPIA_READING_UI_RESOURCES:proof.ui});assert(startup.success&&startup.checks===5);
 const ui=await run('components','scripts/desktop/test-menu-viewer-ui.mjs',{AGENTOPIA_PARITY_SOURCE:proof.source,AGENTOPIA_PARITY_UI:proof.ui,AGENTOPIA_PARITY_WORD:'D:/Users/charl/Downloads/Sample_Document.docx'});assert(ui.success&&ui.checks===17);
 const agent=await run('built-agents','scripts/desktop/test-workspace-navigation-agents.mjs',{AGENTOPIA_AGENT_UI_RESOURCES:proof.ui});assert(agent.success&&agent.checks.length===5);
 const formsOut=path.join(root,'.supabase/desktop-workspace-agents','ui-startup-'+Date.now());const forms=await run('agent-forms','scripts/desktop/test-workspace-agent-ui.mjs',{AGENTOPIA_AGENT_FORMS_OUTPUT:formsOut});assert(forms.success&&forms.checks.length===15);
 evidence.startupChecks=5;evidence.readingChecks=15;evidence.uiChecks=17;evidence.agentChecks=5;evidence.agentFormChecks=15;
 for(const [key,file] of Object.entries({startupEvidence:path.join(startup.out,'evidence.json'),readingEvidence:path.join(reading.out,'evidence.json'),uiEvidence:path.join(ui.out,'evidence.json'),agentEvidence:path.join(agent.out,'evidence.json'),agentFormEvidence:path.join(formsOut,'evidence.json')})){evidence[key]=file;evidence[key+'Sha256']=await hash(file);}
 evidence.success=true;
}catch(error){evidence.error=error.stack;process.exitCode=1;}
await writeFile(path.join(candidate,'startup-reading-qualification.json'),JSON.stringify(evidence,null,2),{flag:'wx'});console.log(JSON.stringify(evidence,null,2));
