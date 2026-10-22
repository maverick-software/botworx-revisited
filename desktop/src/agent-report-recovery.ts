import type {SupabaseClient} from '@supabase/supabase-js';
import {agentId} from './agent-contracts';
import type {NativeState} from './native-contracts';
import type {AgentReportDelivery} from './agent-report-queue';
const data=(value:any):any=>{if(value.error)throw Error(value.error.message);return value.data;};
/** The encrypted outbox is operational state. SQL-native watch markers and
 * native report receipts preserve intent and at-most-once outcomes in portable
 * database recovery too. Restoration only produces held/terminal deliveries.
 */
export async function recoverNamedAgentReports(db:SupabaseClient,owner:string,requestId?:string):Promise<AgentReportDelivery[]>{
 agentId(owner);if(requestId)agentId(requestId);const recovered:AgentReportDelivery[]=[];
 for(let offset=0;;offset+=100){
  let query=db.from('desktop_codex_turns').select('request_id,state').eq('user_id',owner).not('state->namedAssignments','is',null).order('request_id');if(requestId)query=query.eq('request_id',requestId);
  const rows=data(await query.range(offset,offset+99));
  for(const row of rows){
   const state=row.state as NativeState;if(!Array.isArray(state.namedAssignments)||state.namedAssignments.length>16)throw Error('The recovered specialist watch metadata is invalid.');
   const parent=data(await db.from('desktop_requests').select('id,user_id,conversation_id,agent_instance_id,status').eq('id',row.request_id).eq('user_id',owner).maybeSingle());if(!parent)continue;if(parent.user_id!==owner||parent.id!==row.request_id)throw Error('Recovered specialist report parent belongs to another account.');agentId(parent.conversation_id);agentId(parent.agent_instance_id);
   const siblingRequests:any[]=[];for(let page=0;;page+=100){const batch=data(await db.from('desktop_requests').select('id').eq('agent_instance_id',parent.agent_instance_id).eq('user_id',owner).order('id').range(page,page+99));siblingRequests.push(...batch);if(batch.length<100)break;}
   const reads:any[]=[];for(let i=0;i<siblingRequests.length;i+=100){for(let page=0;;page+=100){const batch=data(await db.from('desktop_tool_calls').select('request_id,status,result').eq('user_id',owner).in('name',['read_agent_instance','tools.read_agent_instance']).eq('status','completed').in('request_id',siblingRequests.slice(i,i+100).map((request:any)=>request.id)).order('id').range(page,page+99));reads.push(...batch);if(batch.length<100)break;}}
   const seen=new Set<string>();
   for(const watch of state.namedAssignments){
    agentId(watch.childRequestId);agentId(watch.childInstanceId);if(seen.has(watch.childRequestId)||typeof watch.createdAt!=='string'||!Number.isFinite(Date.parse(watch.createdAt)))throw Error('The recovered specialist watch metadata is invalid.');seen.add(watch.childRequestId);
    const invocation=data(await db.from('desktop_agent_invocations').select('request_id,child_instance_id,caller_instance_id,origin_request_id,user_id').eq('user_id',owner).eq('request_id',watch.childRequestId).eq('child_instance_id',watch.childInstanceId).eq('origin_request_id',parent.id).eq('caller_instance_id',parent.agent_instance_id).maybeSingle());
    if(!invocation||invocation.user_id!==owner||invocation.request_id!==watch.childRequestId||invocation.child_instance_id!==watch.childInstanceId||invocation.origin_request_id!==parent.id||invocation.caller_instance_id!==parent.agent_instance_id)continue;
    const reports=(state.reports??[]).filter(report=>report.assignments?.some(source=>source.invocationId===watch.childRequestId&&source.instanceId===watch.childInstanceId));
    const completed=reports.find(report=>report.status==='completed'),attempt=completed??reports.at(-1),acknowledged=reads.some(receipt=>receipt.result?.instance?.id===watch.childInstanceId&&['completed','failed','cancelled','interrupted'].includes(receipt.result.instance.status)&&Array.isArray(receipt.result.agent_report_acknowledgements)&&receipt.result.agent_report_acknowledgements.some((mark:any)=>mark.parentRequestId===parent.id&&mark.childRequestId===watch.childRequestId&&mark.childInstanceId===watch.childInstanceId));
    const status:AgentReportDelivery['status']=completed?'delivered':acknowledged?'acknowledged':!['running','completed'].includes(parent.status)?'cancelled':'held';
    if(recovered.length>=5000)throw Error('The recovered specialist-report limit was reached. Inspect the saved assignment history.');
    recovered.push({childRequestId:watch.childRequestId,childInstanceId:watch.childInstanceId,parentRequestId:parent.id,parentConversationId:parent.conversation_id,status,createdAt:watch.createdAt,updatedAt:new Date().toISOString(),...(attempt?{attemptId:agentId(attempt.id),dispatchStarted:true}:{}),...(status==='held'?{error:attempt?'Recovered report attempt. Inspect its saved parent activity before retrying; it was not replayed.':'Recovered specialist result. Review it before continuing the parent report.'}:{})});
   }
  }
  if(rows.length<100)break;
 }
 return recovered;
}
