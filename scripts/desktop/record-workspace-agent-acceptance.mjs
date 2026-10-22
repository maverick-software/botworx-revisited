import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';

const data=result=>{if(result.error)throw Error(result.error.message);return result.data;};
const citation=(conversation,message)=>'agentopia-chat://'+conversation+'/message/'+message;
const text=message=>message?.content?.text??'';
const tool=(rows,name,predicate=()=>true)=>rows.find(row=>row.name===name&&row.status==='completed'&&predicate(row));

// Pure assertions are kept separate from collection so malformed and incomplete
// saved evidence can be tested without a backend or provider connection.
export function assessWorkspaceAgentRecords(records,evidence,release){
 const {starter,mira,specialist}=evidence.agents,{marker,sop,skill,specialistCode}=evidence.markers,{first,switched,recalled,delegated,child}=records.turns;
 assert(release.success&&release.version===evidence.version&&/^[a-f0-9]{64}$/.test(release.imageSha256)&&release.imageSha256===evidence.imageSha256,'Evidence must identify the exact qualified packaged image.');
 const owner=evidence.fixtureUser,checks=[];
 for(const turn of [first,switched,recalled,delegated,child]){
  assert.equal(turn.request.user_id,owner,'Request belongs to another account');assert.equal(turn.request.status,'completed',turn.request.error??'Request is incomplete');
  assert.equal(turn.user.id,turn.request.user_message_id);assert.equal(turn.user.role,'user');assert.equal(turn.user.sender_user_id,owner);
  assert.equal(turn.user.conversation_id,turn.request.conversation_id);assert.equal(turn.reply.id,turn.request.assistant_message_id);assert.equal(turn.reply.conversation_id,turn.request.conversation_id);assert.equal(turn.reply.role,'assistant');
  assert.equal(turn.native.request_id,turn.request.id);assert.equal(turn.native.options.provider,'openai-oauth');assert.equal(turn.native.options.harness,'codex');assert.equal(turn.native.options.model,'gpt-6.1-sol');assert.equal(turn.native.runtime_version,'0.163.0');
 }
 assert.equal(first.request.agent_id,starter.id);assert.equal(first.reply.metadata.agent.id,starter.id);
 assert.equal(switched.request.agent_id,mira.id);assert.equal(switched.reply.metadata.agent.id,mira.id);assert.equal(switched.reply.metadata.agent.revision,mira.profile.revision);
 assert.equal(first.request.conversation_id,switched.request.conversation_id);assert.notEqual(first.request.id,switched.request.id);
 assert(text(switched.user).startsWith('@'+mira.profile.handle+','));assert(text(switched.reply).includes(sop)&&text(switched.reply).includes(skill)&&/release.*analyst/i.test(text(switched.reply)));
 const savedProfile=records.profiles.find(profile=>profile.agent_id===mira.id);assert(savedProfile);assert.equal(savedProfile.revision,mira.profile.revision);assert.equal(savedProfile.role,'Release research analyst');assert(savedProfile.sops.includes(sop));assert(savedProfile.skills.some(item=>item.content.includes(skill)));
 checks.push('The existing chat switches from Starter to Mira through @, retains both saved authors, and uses the persisted role, procedure and skill revision.');
 const memory=records.memories.find(row=>row.content.includes(marker));assert(memory,'The approved memory was not saved');assert.equal(records.memories.filter(row=>row.content.includes(marker)).length,1);
 assert.equal(memory.user_id,owner);assert.equal(memory.agent_id,mira.id);assert.equal(memory.project_id,evidence.projects.a);assert.equal(memory.authored_by,'agent');assert.equal(memory.source_message_id,switched.request.user_message_id);assert.equal(memory.source_conversation_id,switched.request.conversation_id);
 assert(tool(records.tools.switched,'save_agent_memory',row=>row.result?.memory?.id===memory.id),'No completed memory-save receipt matches the saved memory');
 assert.notEqual(evidence.projects.a,evidence.projects.b);assert.equal(recalled.request.agent_id,mira.id);assert.equal(recalled.reply.metadata.agent.id,mira.id);assert.notEqual(recalled.request.conversation_id,switched.request.conversation_id);assert.notEqual(recalled.native.thread_id,switched.native.thread_id);
 const membership=request=>records.memberships.find(row=>row.conversation_id===request.conversation_id&&row.user_id===owner)?.project_id;
 assert.equal(membership(switched.request),evidence.projects.a,'Source chat is not in project A');assert.equal(membership(recalled.request),evidence.projects.b,'Recall chat is not in project B');
 assert(!text(recalled.user).includes(marker),'The new prompt repeats the remembered content');assert(text(recalled.reply).includes(marker));
 assert(text(recalled.reply).includes(citation(memory.source_conversation_id,memory.source_message_id)),'Recall must cite the exact saved source message');
 checks.push('Mira saves an agent-authored memory linked to project A and its actual source message; a different native chat in project B recalls it and cites that exact message without receiving the marker again.');
 assert.equal(delegated.request.agent_id,mira.id);assert.equal(membership(delegated.request),evidence.projects.b);
 assert.equal(records.invocations.length,1);const invocation=records.invocations[0];assert.equal(invocation.user_id,owner);assert.equal(invocation.origin_request_id,delegated.request.id);assert.equal(invocation.target_agent_id,specialist.id);assert.equal(invocation.request_id,child.request.id);assert.equal(child.request.agent_id,specialist.id);assert.equal(invocation.child_instance_id,evidence.namedAssignment.instanceId);assert.equal(invocation.request_id,evidence.namedAssignment.requestId);
 const instance=records.instances.find(row=>row.id===invocation.child_instance_id),caller=records.instances.find(row=>row.id===invocation.caller_instance_id);assert(instance&&caller);assert.equal(instance.user_id,owner);assert.equal(instance.agent_id,specialist.id);assert.equal(instance.request_id,child.request.id);assert.equal(instance.status,'completed');assert.equal(instance.project_id,evidence.projects.b);assert.equal(caller.agent_id,mira.id);assert.equal(caller.request_id,delegated.request.id);assert.equal(instance.parent_instance_id,caller.id);
 const specialistProfile=records.profiles.find(profile=>profile.agent_id===specialist.id);assert(specialistProfile);assert.equal(specialistProfile.revision,specialist.profile.revision);assert.equal(child.reply.metadata.agent.id,specialist.id);assert.equal(child.reply.metadata.agent.revision,specialistProfile.revision);assert.equal(instance.agent_revision,specialistProfile.revision);assert.deepEqual(specialistProfile.policy.tools,['list_agent_instances']);assert.equal(specialistProfile.policy.delegation,false);assert.equal(specialistProfile.policy.memoryWrite,false);
 assert(text(child.reply).includes(specialistCode)&&text(delegated.reply).includes(specialistCode));
 assert(tool(records.tools.child,'list_agent_instances'));assert(records.tools.child.every(row=>row.name==='list_agent_instances'),'The specialist used an operation outside its saved allowlist');
 assert(tool(records.tools.delegated,'invoke_agent',row=>row.arguments?.agent_id===specialist.id&&row.result?.instance?.id===instance.id),'No completed parent invocation receipt matches this specialist instance');
 assert(tool(records.tools.delegated,'read_agent_instance',row=>row.arguments?.instance_id===instance.id&&row.result?.instance?.id===instance.id&&row.result.instance.status==='completed'&&row.result.transcript?.includes(specialistCode)),'No completed parent read receipt contains the completed specialist result');
 checks.push('Mira invokes the saved Inspector instance, the Inspector uses its saved restricted tools, and Mira separately reads its completed transcript before reporting the specialist result.');
 assert.equal(evidence.authorization.bothConfigured,true,'Both connections were not present in the fixture');assert.equal(records.connections.openrouter,true);assert.equal(records.connections.chatgptAuthorized,true);assert.equal(records.connections.preferChatGPT,true);assert.equal(evidence.authorization.refreshCredentialCopied,false);
 checks.push('Both configured connections remain available, ChatGPT is preferred, and all five saved native turns use ChatGPT without copying a usable refresh credential.');
 return {success:true,checks,requestIds:[first,switched,recalled,delegated,child].map(turn=>turn.request.id),sourceCitation:citation(memory.source_conversation_id,memory.source_message_id),memoryId:memory.id,instanceId:instance.id};
}

// Called only by the owner of the already-running private acceptance backend.
// This function uses SELECT and providers.status; it never dispatches inference,
// mutates a database record, loads credentials, renews a token or starts a runtime.
export async function recordWorkspaceAgentAcceptance({db,call,evidence,out,release}){
 const result={success:false,at:new Date().toISOString(),version:evidence.version,imageSha256:evidence.imageSha256,readOnly:true,inferenceDispatched:0,credentialReads:0,records:{}};
 const records=result.records,owner=evidence.fixtureUser;
 try{
  const digest=createHash('sha256');for await(const bytes of createReadStream(path.join(out,'program/resources/app.asar')))digest.update(bytes);result.observedImageSha256=digest.digest('hex');assert.equal(result.observedImageSha256,release.imageSha256,'The tested application archive does not match the release image');
  assert(owner&&evidence.agents&&evidence.projects&&evidence.markers&&evidence.namedAssignment,'Agent workflow evidence is not ready');
  const entry=predicate=>{const matches=evidence.liveRequests.filter(predicate);assert.equal(matches.length,1,'Expected exactly one saved workflow prompt; inspect existing outcomes instead of resubmitting');assert(matches[0].requestId,'The workflow prompt has no saved request ID');return matches[0];};
  const selected={first:entry(row=>row.text.startsWith('Reply with exactly STARTED-')),switched:entry(row=>row.text.startsWith('@'+evidence.agents.mira.profile.handle+',')),recalled:entry(row=>row.text.startsWith('What is the approved release marker saved by this agent?')),delegated:entry(row=>row.text.startsWith('Use invoke_agent to assign saved agent '+evidence.agents.specialist.id+' '))};
  const readTurn=async id=>{
   const request=data(await db.from('desktop_requests').select('id,user_id,agent_id,conversation_id,user_message_id,assistant_message_id,status,error').eq('user_id',owner).eq('id',id).single());
   const messages=data(await db.from('chat_messages_v2').select('id,conversation_id,role,sender_user_id,content,metadata').eq('conversation_id',request.conversation_id).in('id',[request.user_message_id,request.assistant_message_id]));
   const raw=data(await db.from('desktop_codex_turns').select('request_id,thread_id,context,runtime_version').eq('user_id',owner).eq('request_id',id).single());
   return {request,user:messages.find(row=>row.id===request.user_message_id),reply:messages.find(row=>row.id===request.assistant_message_id),native:{request_id:raw.request_id,thread_id:raw.thread_id,runtime_version:raw.runtime_version,options:{provider:raw.context?.options?.provider,model:raw.context?.options?.model,harness:raw.context?.options?.harness}}};
  };
  records.turns={};for(const [key,value] of Object.entries(selected)){records.turns[key]=await readTurn(value.requestId);assert.equal(text(records.turns[key].user),value.text,'Saved prompt differs from the recorded submission');}
  records.invocations=data(await db.from('desktop_agent_invocations').select('user_id,origin_request_id,target_agent_id,request_id,child_instance_id,caller_instance_id,status').eq('user_id',owner).eq('origin_request_id',selected.delegated.requestId).eq('target_agent_id',evidence.agents.specialist.id));assert.equal(records.invocations.length,1);
  const invocation=records.invocations[0];records.turns.child=await readTurn(invocation.request_id);
  records.instances=data(await db.from('desktop_agent_instances').select('id,user_id,agent_id,agent_revision,request_id,project_id,parent_instance_id,status').eq('user_id',owner).in('id',[invocation.child_instance_id,invocation.caller_instance_id]));
  records.memberships=data(await db.from('desktop_project_chats').select('user_id,project_id,conversation_id').eq('user_id',owner).in('conversation_id',[...new Set(Object.values(records.turns).map(turn=>turn.request.conversation_id))]));
  records.memories=data(await db.from('desktop_agent_memories').select('id,user_id,agent_id,project_id,content,authored_by,source_message_id,source_conversation_id').eq('user_id',owner).eq('agent_id',evidence.agents.mira.id).eq('source_message_id',records.turns.switched.request.user_message_id));
  records.profiles=data(await db.from('desktop_agent_profiles').select('agent_id,revision,role,sops,skills,policy').eq('user_id',owner).in('agent_id',[evidence.agents.mira.id,evidence.agents.specialist.id]));
  records.tools={};for(const key of ['switched','delegated','child'])records.tools[key]=data(await db.from('desktop_tool_calls').select('id,request_id,name,status,arguments,result').eq('user_id',owner).eq('request_id',records.turns[key].request.id));
  const connections=await call('providers.status');records.connections={openrouter:connections.openrouter,chatgptAuthorized:connections.chatgpt?.authorized===true,preferChatGPT:connections.preferChatGPT};
  Object.assign(result,assessWorkspaceAgentRecords(records,evidence,release));
 }catch(error){result.error=error.message;}
 await writeFile(path.join(out,'independent-agent-evidence.json'),JSON.stringify(result,null,2));
 assert(result.success,'Independent saved-record agent acceptance failed: '+result.error);return result;
}
