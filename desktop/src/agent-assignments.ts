import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {ChatOptions} from './contracts';
import type {AgentInstance,AgentProfile,AgentPolicy} from './agent-contracts';
import {AgentQueue} from './agent-queue';
import {intersectAgentPolicies} from './agent-policy';
import type {AgentService} from './agent-service';

const data=(result:any):any=>{if(result.error)throw new Error(result.error.message);return result.data;};
export type NamedInvocation={user_id:string;request_id:string;child_instance_id:string;caller_instance_id:string;target_agent_id:string;target_revision:number;caller_revision:number;origin_request_id:string;status:string;payload:{assignment:string;options:ChatOptions;ceiling:AgentPolicy;origin_request_id:string};existing?:boolean;claimed?:boolean};
export type AgentLaunch={parentInstanceId:string;instanceId:string;expectedRevision:number;policyCeiling:AgentPolicy;authorityChain:NonNullable<AgentInstance['authority_chain']>;projectRevision:number|null};

export class AgentAssignments{
 readonly queue:AgentQueue;
 preparing=0;
 constructor(private db:SupabaseClient,private agents:AgentService,available:()=>boolean,private launch:(record:NamedInvocation,instance:AgentInstance,context:AgentLaunch,accepted:()=>void)=>Promise<void>,private finished?:(record:NamedInvocation)=>Promise<void>){this.queue=new AgentQueue(available);}
 async recover(){
  const rows=data(await this.db.from('desktop_agent_invocations').select('request_id,child_instance_id').in('status',['queued','starting','running']));
  if(!rows.length)return;
  data(await this.db.from('desktop_agent_invocations').update({status:'interrupted',error:'Agentopia restarted. Inspect the saved assignment and explicitly continue; no uncertain operation was replayed.',updated_at:new Date().toISOString()}).in('request_id',rows.map((row:any)=>row.request_id)).in('status',['queued','starting','running']));
  data(await this.db.from('desktop_agent_instances').update({status:'interrupted',updated_at:new Date().toISOString()}).in('id',rows.map((row:any)=>row.child_instance_id)).in('status',['queued','ready','running','awaiting_approval']));
 }
 private async interrupted(record:NamedInvocation,reason:string){
  const status=reason==='Cancelled by you.'?'cancelled':'interrupted';
  data(await this.db.from('desktop_agent_invocations').update({status,error:reason,updated_at:new Date().toISOString()}).eq('user_id',record.user_id).eq('request_id',record.request_id).in('status',['queued','starting','running']));
  data(await this.db.from('desktop_agent_instances').update({status,checkpoint:reason.slice(0,8000),updated_at:new Date().toISOString()}).eq('id',record.child_instance_id).eq('user_id',record.user_id).in('status',['queued','ready','running','awaiting_approval']));
  await this.finished?.(record);
 }
 private schedule(record:NamedInvocation,authorityAgents:string[],authorityInstances:string[],goalIds:string[]){
  this.queue.enqueue({id:record.request_id,owner:record.user_id,agentId:record.target_agent_id,instanceId:record.child_instance_id,authorityAgents,authorityInstances,goalIds,interrupted:reason=>this.interrupted(record,reason),run:async()=>{
   this.preparing++;let released=false;const accepted=()=>{if(!released){released=true;this.preparing--;}};
   try{
   const claimed=data(await this.db.rpc('desktop_claim_agent_invocation',{p_user:record.user_id,p_request:record.request_id})) as NamedInvocation;if(!claimed.claimed)return;
   const instance=data(await this.db.from('desktop_agent_instances').select('*').eq('id',claimed.child_instance_id).eq('user_id',record.user_id).single()) as AgentInstance;
   await this.agents.authorizeInstance(record.user_id,instance);
   const origin=data(await this.db.from('desktop_requests').select('user_message_id').eq('id',claimed.origin_request_id).eq('user_id',record.user_id).single());
   const message=data(await this.db.from('chat_messages_v2').select('metadata').eq('id',origin.user_message_id).single());
   await this.launch(claimed,instance,{parentInstanceId:instance.parent_instance_id!,instanceId:instance.id,expectedRevision:claimed.target_revision,policyCeiling:claimed.payload.ceiling,authorityChain:instance.authority_chain??[],projectRevision:message.metadata?.project?.revision??null},accepted);
   await this.finished?.(claimed);
   }finally{accepted();}
  }});
 }
 async invoke(user:string,context:{instance:AgentInstance;profile:AgentProfile},target:string,assignment:string,callId:string,signal:AbortSignal,request:any,options:ChatOptions,waitSeconds:number,nativeThreadId?:string){
  signal.throwIfAborted();const targetProfile=await this.agents.profile(user,target),ceiling=intersectAgentPolicies(targetProfile.policy,context.profile.policy);
  const scope={...options,files:[...options.files],windows:options.windows?[...options.windows]:undefined,skills:options.skills?[...options.skills]:undefined,tools:options.tools?[...options.tools]:undefined,goalId:undefined};
  signal.throwIfAborted();
  const record=data(await this.db.rpc('desktop_reserve_agent_invocation',{p_user:user,p_request:request.id,p_thread:nativeThreadId??null,p_call:callId,p_target:target,p_assignment:assignment,p_options:scope,p_ceiling:ceiling,p_target_revision:targetProfile.revision,p_child_request:randomUUID()})) as NamedInvocation;
  if(signal.aborted){if(!record.existing)await this.interrupted(record,'Cancelled by you.');signal.throwIfAborted();}
  if(!record.existing)this.schedule(record,[...(context.instance.authority_chain??[]).map(grant=>grant.agent_id),context.instance.agent_id],[...(context.instance.authority_chain??[]).map(grant=>grant.instance_id),context.instance.id],[...(context.instance.authority_chain??[]).flatMap(grant=>grant.goal_id?[grant.goal_id]:[]),...(options.goalId?[options.goalId]:[])]);
  if(waitSeconds>0&&!signal.aborted){
   const deadline=Date.now()+waitSeconds*1000;
   while(this.queue.has(record.request_id)&&Date.now()<deadline&&!signal.aborted){await new Promise<void>(resolve=>{const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,Math.min(400,deadline-Date.now()));signal.addEventListener('abort',finish,{once:true});});}
  }
  const instance=await this.agents.readInstance(user,record.child_instance_id,context.instance.project_id);
  return {instance,invocation_id:record.request_id,existing:record.existing===true,untrusted:true,notice:instance.status==='queued'?'The assignment is queued and has not started inference.':undefined};
 }
 async cancelQueued(user:string,instanceId:string){
  const row=data(await this.db.from('desktop_agent_invocations').select('*').eq('user_id',user).eq('child_instance_id',instanceId).maybeSingle()) as NamedInvocation|null;if(!row)return false;
  if(await this.queue.cancelQueued(row.request_id))return true;
  if(['queued','starting'].includes(row.status)){const changed=data(await this.db.from('desktop_agent_invocations').update({status:'cancelled',error:'Cancelled by you.',updated_at:new Date().toISOString()}).eq('user_id',user).eq('request_id',row.request_id).in('status',['queued','starting']).select('request_id').maybeSingle());if(changed){const request=data(await this.db.from('desktop_requests').select('id').eq('id',row.request_id).eq('user_id',user).maybeSingle());if(request)return false;data(await this.db.from('desktop_agent_instances').update({status:'cancelled',checkpoint:'Cancelled by you.',updated_at:new Date().toISOString()}).eq('id',instanceId).eq('user_id',user).in('status',['queued','ready']));return true;}}
  return false;
 }
 async interruptOwner(user:string,reason:string){await this.queue.interruptWhere(job=>job.owner===user,reason);}
 async interruptAgent(user:string,agentId:string,reason:string){await this.queue.interruptWhere(job=>job.owner===user&&(job.agentId===agentId||job.authorityAgents?.includes(agentId)===true),reason);}
 async interruptGoal(user:string,goalId:string){await this.queue.interruptWhere(job=>job.owner===user&&job.goalIds?.includes(goalId)===true,'The originating goal was paused or completed.');}
 async interruptInstance(user:string,instanceId:string){return this.queue.interruptWhere(job=>job.owner===user&&(job.instanceId===instanceId||job.authorityInstances?.includes(instanceId)===true),'Cancelled by you.');}
}
