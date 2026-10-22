import type {SupabaseClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import type {AgentService} from './agent-service';
import type {AgentInstance} from './agent-contracts';
import {agentId} from './agent-contracts';
import type {AgentReportDelivery} from './agent-report-queue';
import {AgentReportDeferred} from './agent-report-queue';
import type {NativeState,NamedAgentResult} from './native-contracts';
import {conversationCitation} from './conversation-links';
import {redactCredentialText} from './terminal-runner';
const data=(result:any):any=>{if(result.error)throw Error(result.error.message);return result.data;};
const terminal=new Set(['completed','failed','cancelled','interrupted']);
const text=(value:unknown,max=12000)=>redactCredentialText(typeof value==='string'?value:'').slice(0,max);
const reportText=(value:string,max=12000)=>{const clean=redactCredentialText(value),notice='\n[Saved output shortened. Open its source for the full text.]';return clean.length>max?clean.slice(0,max-notice.length)+notice:clean;};
/** Compare only public continuation results and pending work, so background
 * command output cannot invalidate a finished result read. Private reasoning
 * and execution credentials are never part of the observation. */
export function namedResultFingerprint(state:NativeState|undefined):string{
 const project=(value:NativeState|undefined,depth=0):unknown=>!value?null:depth>8?'depth-limit':{thread:value.threadId,goal:value.goal?.status??null,watches:(value.namedAssignments??[]).map(row=>[row.childRequestId,row.childInstanceId]),reports:(value.reports??[]).map(report=>({id:report.id,status:report.status,text:(report.state?.items??[]).filter(row=>row.item.type==='agentMessage').map(row=>row.item.type==='agentMessage'?row.item.text:''),state:project(report.state,depth+1)})),children:(value.children??[]).map(child=>({thread:child.threadId,turn:child.turnId,status:child.status,delivery:child.delivery,result:child.result,state:project(child.state,depth+1)}))};
 return createHash('sha256').update(JSON.stringify(project(state))).digest('hex');
}

/** Background servers do not prevent a final report. Nested agents and their
 * model continuations must settle before their specialist's result is final.
 */
export function namedAgentResultSettled(state:NativeState|undefined,depth=0):boolean{
 if(!state)return true;if(depth>8||state.goal?.status==='active')return false;
 for(const child of state.children??[])if(child.status==='running'||child.delivery==='running'||child.delivery==='waiting'&&child.status!=='interrupted'||!namedAgentResultSettled(child.state,depth+1))return false;
 for(const report of state.reports??[])if(report.status==='running'||!namedAgentResultSettled(report.state,depth+1))return false;
 return true;
}
export function namedContinuationText(state:NativeState|undefined){
 const notes:string[]=[];
 for(const report of [...(state?.reports??[])].reverse()){const saved=(report.state?.items??[]).filter(entry=>entry.item.type==='agentMessage').map(entry=>entry.item.type==='agentMessage'?entry.item.text:'').join('\n');if(saved)notes.push('Saved later continuation ('+report.status+'): '+reportText(saved,4000));else notes.push('Later continuation: '+report.status+(report.error?' — '+text(report.error,1000):' — no additional response text was saved.'));}
 for(const child of state?.children??[])if(child.status!=='completed')notes.push('Nested subagent '+text(child.name,100)+': '+child.status+(child.error?' — '+text(child.error,1000):''));
 return notes.join('\n\n');
}
/** Service-role reads bind owner, original caller, both request IDs, assignment,
 * conversation, definition revision and saved output. Queue metadata cannot
 * redirect a report or supply text/permissions of its own.
 */
export async function readNamedAgentReportSources(db:SupabaseClient,agents:Pick<AgentService,'authorizeInstance'>,owner:string,rows:ReadonlyArray<AgentReportDelivery>){
 agentId(owner);if(!rows.length||rows.length>16)throw Error('Choose 1–16 saved specialist reports.');
 const first=rows[0];if(new Set(rows.map(row=>row.childRequestId)).size!==rows.length)throw Error('Choose distinct specialist report sources.');for(const row of rows)if(row.parentRequestId!==first.parentRequestId||row.parentConversationId!==first.parentConversationId)throw Error('Specialist reports belong to different parent assignments.');
 const parent=data(await db.from('desktop_requests').select('*').eq('user_id',owner).eq('id',first.parentRequestId).single());
 if(!parent||parent.user_id!==owner||parent.conversation_id!==first.parentConversationId)throw Error('The parent report belongs to another account or conversation.');
 if(parent.status==='running'||parent.status==='queued')throw new AgentReportDeferred('The parent response has not finished.');
 if(parent.status!=='completed')throw Error('The parent assignment stopped. Its specialist report cannot restart it.');
 const caller=data(await db.from('desktop_agent_instances').select('*').eq('user_id',owner).eq('id',parent.agent_instance_id).single()) as AgentInstance;
 if(caller.user_id!==owner||caller.agent_id!==parent.agent_id||caller.conversation_id!==parent.conversation_id)throw Error('The original requesting identity changed.');
 await agents.authorizeInstance(owner,caller);
 const results:NamedAgentResult[]=[];
 for(const row of rows){
  for(const field of ['childRequestId','childInstanceId','parentRequestId','parentConversationId'] as const)agentId(row[field]);
  const invocation=data(await db.from('desktop_agent_invocations').select('*').eq('user_id',owner).eq('request_id',row.childRequestId).eq('child_instance_id',row.childInstanceId).eq('caller_instance_id',caller.id).eq('origin_request_id',parent.id).single());
  if(!invocation||invocation.user_id!==owner||invocation.request_id!==row.childRequestId||invocation.child_instance_id!==row.childInstanceId||invocation.caller_instance_id!==caller.id||invocation.origin_request_id!==parent.id||invocation.caller_revision!==caller.agent_revision)throw Error('This specialist was not invoked by the selected parent assignment.');
  const child=data(await db.from('desktop_agent_instances').select('*').eq('user_id',owner).eq('id',row.childInstanceId).single()) as AgentInstance;
  if(child.user_id!==owner||child.parent_instance_id!==caller.id||child.agent_id!==invocation.target_agent_id||child.agent_revision!==invocation.target_revision||child.project_id!==caller.project_id)throw Error('The specialist identity or project scope changed.');
  if(!terminal.has(invocation.status))throw new AgentReportDeferred('The specialist assignment has not finished.');
  const profile=await agents.authorizeInstance(owner,child);
  const request=data(await db.from('desktop_requests').select('*').eq('user_id',owner).eq('id',row.childRequestId).maybeSingle());
  if(request&&(request.user_id!==owner||request.conversation_id!==child.conversation_id||request.agent_instance_id!==child.id||request.agent_id!==child.agent_id))throw Error('The saved specialist response belongs to another assignment.');
  if(request&&!terminal.has(request.status))throw new AgentReportDeferred('The specialist response is still being saved.');
  if(!request&&!terminal.has(child.status))throw new AgentReportDeferred('The specialist assignment is still being saved.');
  if(request&&request.status!==invocation.status)throw new AgentReportDeferred('The specialist status update is still being saved.');
  const native=request?data(await db.from('desktop_codex_turns').select('state').eq('user_id',owner).eq('request_id',request.id).maybeSingle()):null;
  if(!namedAgentResultSettled(native?.state))throw new AgentReportDeferred('Nested specialist work is still finishing.');
  const message=request?data(await db.from('chat_messages_v2').select('id,role,content,conversation_id').eq('id',request.assistant_message_id).eq('conversation_id',child.conversation_id).single()):null;
  if(message&&(message.role!=='assistant'||message.id!==request.assistant_message_id||message.conversation_id!==child.conversation_id))throw Error('The specialist source message changed.');
  // A preflight failure can precede creation of a child model request. Cite the
  // original invocation instead of fabricating a child response or receipt.
  const citation=message?conversationCitation(child.conversation_id,message.id):conversationCitation(parent.conversation_id,parent.assistant_message_id);
  const summary=[namedContinuationText(native?.state),text(message?.content?.text)].filter(Boolean).join('\n\n');
  results.push({invocationId:row.childRequestId,instanceId:child.id,conversationId:child.conversation_id,messageId:message?.id??null,agentId:child.agent_id,name:text(profile.definition.name,100)||profile.handle,status:(request?.status??invocation.status) as NamedAgentResult['status'],text:reportText(summary)||'No specialist model response was saved. Inspect the confirmed assignment status.',citation,...(request?.error||invocation.error?{error:text(request?.error??invocation.error,2000)}:{})});
 }
 return {parent,caller,results};
}
