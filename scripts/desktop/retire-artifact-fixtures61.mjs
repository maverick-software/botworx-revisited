import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
import {json,hash,list} from './phased-backup-control.mjs';
import {launchDurableProfileProbe} from './launch-durable-profile-probe.mjs';

desktopOperation('archive and retire only the completed generated artifact test agents');
const root=path.resolve(import.meta.dirname,'../..'),current=await json(path.join(root,'.supabase/desktop-live-artifacts61/current.json')),original=await json(current.evidence),accepted=await json(path.join(current.out,'artifact-content-accepted.json')),intent=await json(path.join(current.out,'intent.json'));
assert(accepted.success&&accepted.coldNoReplay&&accepted.cleanup.leaseRemoved&&accepted.totalModelRequests===8);
const out=path.join(current.out,'retire-'+Date.now());await mkdir(out);const cfg={...intent.cfg,out,temp:path.join(out,'temp')};assert(!(await list(true)).includes(cfg.distribution));
const result=await launchDurableProfileProbe(cfg,{testProfile:false,initialProfile:cfg.target,expectedProfile:cfg.target,expectedRuntime:'ready',resumeDebugWorkers:true,isolateOsHome:true,label:'retire-completed-artifact-fixtures',runReady:async({application})=>application.evaluate(async(_,{owner,pairs,marker})=>{
 const b=globalThis.__coordination.broker,must=result=>{if(result.error)throw Error(result.error.message);return result.data;},agents=must(await b.admin.from('agents').select('id,name,active').in('id',pairs.map(row=>row.agent)).eq('user_id',owner));
 if(agents.length!==2||agents.some(row=>!row.name.endsWith(marker)))throw Error('Only the two owned generated artifact fixtures may be retired');
 const requests=must(await b.admin.from('desktop_requests').select('id,status,conversation_id').in('id',pairs.map(row=>row.request)).eq('user_id',owner));if(requests.length!==2||requests.some(row=>row.status!=='completed'||row.conversation_id!==pairs.find(pair=>pair.request===row.id)?.conversation))throw Error('Both original requests must be completed');
 if(b.secrets.get('live-artifacts61-lease:'+owner))throw Error('Temporary access remains');
 for(const pair of pairs){await b.call('conversations.manage',{conversationId:pair.conversation,action:'archive'});await b.call('agents.delete',{id:pair.agent});}
 const after=must(await b.admin.from('agents').select('id,active').in('id',pairs.map(row=>row.agent)).eq('user_id',owner));if(after.length!==2||after.some(row=>row.active))throw Error('Generated agents did not retire');
 if(globalThis.__coordination.calls.length)throw Error('Retirement must not send model requests');return {generatedAgentsRetired:true,originalRequestRecordsRetained:true,conversationsArchived:true,newModelRequests:0};
},{owner:cfg.owner,marker:original.marker,pairs:[{agent:original.creatorAgent,request:original.creatorRequest,conversation:original.creatorConversation},{agent:original.readerAgent,request:original.readerRequest,conversation:accepted.readerConversation}]})});
assert(result.success&&result.normalExit===0);assert(!(await list(true)).includes(cfg.distribution));assert.equal(await hash('F:/Agentopia-Data/profiles/a91a4800-e08f-4440-a4ec-588762d01bfd/profile/credentials.bin'),original.sourceCredentialSha256Before);
const receipt={success:true,out,evidence:path.join(out,'evidence.json'),qaRuntimeStopped:true,...result.workflow};await writeFile(path.join(current.out,'fixtures-retired.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
