import {readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),id=process.argv[2];assert(/^\d{13}$/.test(id));
const out=path.join(root,'.supabase/desktop-packaged-live',id),intent=JSON.parse(await readFile(path.join(out,'intent.json'),'utf8')),exec=promisify(execFile);
assert(['0.44.8','0.44.9','0.44.10'].includes(intent.version));assert.equal(intent.distribution,'AgentopiaRuntime-'+intent.instanceId);assert(path.resolve(intent.storage)===path.join(out,'wsl'));
await copyFile(path.join(root,'scripts/desktop/capture-packaged-live-records.mjs'),path.join(out,'capture-packaged-live-records.mjs'));
let env,last,failures=0;const deadline=Date.now()+1200000;
while(Date.now()<deadline){
 let evidence;try{evidence=JSON.parse(await readFile(path.join(out,'evidence.json'),'utf8'));}catch{await new Promise(resolve=>setTimeout(resolve,500));continue;}
 if(evidence.fixtureUser){
  try{
   if(!env){const status=JSON.parse((await exec('wsl.exe',['-d',intent.distribution,'-u','agentopia','--cd','/home/agentopia/app','--exec','supabase','stack','status','--output-format','json'],{encoding:'utf8',windowsHide:true,timeout:15000})).stdout);assert.equal(new URL(status.env.API_URL).port,String(intent.ports.api));env=status.env;}
   const read=async(table,column='user_id')=>{const response=await fetch(env.API_URL+'/rest/v1/'+table+'?'+new URLSearchParams({select:'*',[column]:'eq.'+evidence.fixtureUser}),{headers:{apikey:env.SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SERVICE_ROLE_KEY},signal:AbortSignal.timeout(5000)});assert(response.ok,table+' read failed (HTTP '+response.status+')');return response.json();};
   const tables=['desktop_requests','desktop_codex_turns','desktop_tool_calls','desktop_agent_instances','desktop_agent_invocations','desktop_agent_memories','desktop_agent_profiles','desktop_project_chats','desktop_projects','conversation_sessions','agents'];
   const records=Object.fromEntries(await Promise.all(tables.map(async table=>[table,await read(table)])));
   const conversations=records.conversation_sessions.map(row=>row.conversation_id),messages=[];
   for(const conversation of conversations){const response=await fetch(env.API_URL+'/rest/v1/chat_messages_v2?'+new URLSearchParams({select:'*',conversation_id:'eq.'+conversation}),{headers:{apikey:env.SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SERVICE_ROLE_KEY},signal:AbortSignal.timeout(5000)});assert(response.ok);messages.push(...await response.json());}
   records.chat_messages_v2=messages;last={success:true,readOnly:true,at:new Date().toISOString(),version:intent.version,imageSha256:intent.imageSha256,fixtureUser:evidence.fixtureUser,phase:evidence.phase,markers:evidence.markers,agents:evidence.agents,projects:evidence.projects,authorization:evidence.authorization,liveRequests:evidence.liveRequests,records};
   const file=path.join(out,'private-live-records.json');await writeFile(file+'.tmp',JSON.stringify(last,null,2));await rename(file+'.tmp',file);failures=0;
   if(evidence.success&&evidence.phase==='completed')break;
  }catch(error){failures++;if(failures>=3||evidence.phase==='completed'||evidence.success===false){if(!last)throw error;break;}}
 }
 if(evidence.success===false&&evidence.error)break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
assert(last,'No live database records were captured');console.log(JSON.stringify({success:true,readOnly:true,out,phase:last.phase,requests:last.records.desktop_requests.length,capturedAt:last.at}));
