import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const mode=process.argv.includes('--live')?'live':'controlled',runtime=path.join(root,'.supabase/desktop-workspace-agents/runtime');
let authorizationSnapshot='';
if(mode==='live'){
 try{await readFile(path.join(root,'.supabase/desktop-workspace-agents/live-acceptance.json'));throw Error('Live acceptance already exists. Inspect its saved outcomes; do not repeat completed inference.');}catch(error){if(error.code!=='ENOENT')throw error;}
 let previous=[];try{previous=await readdir(runtime);}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const name of previous.filter(name=>name.startsWith('live-'))){let evidence;try{evidence=JSON.parse(await readFile(path.join(runtime,name,'evidence.json'),'utf8'));}catch{throw Error('An earlier live qualification has no terminal evidence. Inspect its process and request IDs before dispatching another run: '+name);}if((evidence.liveProviderCalls??0)>0||(evidence.requests??[]).length)throw Error('Earlier live requests exist. Inspect their saved/native outcomes and use a targeted follow-up instead of repeating this suite: '+name);}
 const index=process.argv.indexOf('--authorization-snapshot');authorizationSnapshot=index<0?'':process.argv[index+1];
 require('./workspace-agent-physical-authorization.cjs').physicalAuthorization(root,authorizationSnapshot);
}
const out=path.join(runtime,mode+'-'+Date.now());await mkdir(out,{recursive:true});
const main=path.join(out,'main.cjs');await writeFile(main,`require(${JSON.stringify(path.join(root,'scripts/desktop/workspace-agent-runtime-fixture.cjs'))});`);
const env={...process.env,AGENTOPIA_AGENT_QUALIFICATION_ROOT:root,AGENTOPIA_AGENT_QUALIFICATION_OUTPUT:out,AGENTOPIA_AGENT_QUALIFICATION_MODE:mode,AGENTOPIA_AGENT_QUALIFICATION_READBACK:'',AGENTOPIA_AGENT_QUALIFICATION_AUTHORIZATION:authorizationSnapshot};delete env.ELECTRON_RUN_AS_NODE;
const run=variables=>new Promise((resolve,reject)=>{const child=spawn(require('electron'),[main],{cwd:root,env:variables,windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>resolve(code??1));});
let code=await run(env);console.log('Workspace-agent evidence: '+path.join(out,'evidence.json'));
if(code===0&&mode==='controlled'){const restart=path.join(out,'restart');await mkdir(restart,{recursive:true});code=await run({...env,AGENTOPIA_AGENT_QUALIFICATION_OUTPUT:restart,AGENTOPIA_AGENT_QUALIFICATION_READBACK:path.join(out,'evidence.json')});console.log('Fresh-process evidence: '+path.join(restart,'evidence.json'));}
process.exitCode=code;
