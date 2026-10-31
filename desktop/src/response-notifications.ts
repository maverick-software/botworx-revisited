import type {ChatEvent} from './contracts';
import type {NativeState} from './native-contracts';
import {questionKey} from './native-questions';
import type {ToolActivity} from './tool-contracts';
import {readNotificationPreferences,type NotificationStore} from './notification-preferences';
export type ResponseAlert={owner:string;conversationId:string;kind:'response'|'goal'|'permission'|'question';status:'completed'|'failed'|'interrupted'|'pending';child?:{requestId:string;threadId:string}};
type Candidate={id:string;scope:string;requestId:string;attention:boolean;alert:ResponseAlert};
type Host={owner:()=>string|null;foreground:()=>boolean;scheduled:(owner:string,requestId:string)=>Promise<boolean>;show:(alert:ResponseAlert)=>void};
/** Consume live broker events only. Receipts precede display; muted/foreground
 * events do not catch up later. Capture pending state synchronously so an answer
 * arriving during a receipt write suppresses its queued attention notification. */
export class ResponseNotifications{
 private tail=Promise.resolve();
 private pending=new Map<string,Set<string>>();
 private children=new Map<string,Set<string>>();
 constructor(private store:NotificationStore,private host:Host){}
 changed(event:ChatEvent){let candidates:Candidate[];try{candidates=this.capture(event);}catch(error){return Promise.reject(error);}const operation=this.tail.then(async()=>{for(const candidate of candidates)await this.deliver(candidate);});this.tail=operation.catch(()=>{});return operation;}
 private capture(event:ChatEvent):Candidate[]{
  const owner=event.ownerId,conversationId=event.conversationId;if(!owner||this.host.owner()!==owner)return [];
  const scope=JSON.stringify([owner,event.requestId]),result=new Map<string,Candidate>(),childIds=(event.kind==='native'||event.kind==='native-background')?new Set<string>():this.children.get(scope)??new Set<string>();
  const attention=(id:string,kind:'permission'|'question',threadId?:string)=>{if(!conversationId||!event.requestId)return;result.set(id,{id,scope,requestId:event.requestId,attention:true,alert:{owner,conversationId,kind,status:'pending',...(threadId&&childIds.has(threadId)?{child:{requestId:event.requestId,threadId}}:{})}});};
  const tool=(entry:ToolActivity)=>{if(entry.status==='awaiting_approval')attention('attention:tool:'+entry.id,'permission',entry.native_thread_id??undefined);};
  if((event.kind==='native'||event.kind==='native-background')&&event.native){
   const states:NativeState[]=[],seen=new Set<NativeState>();
   const visit=(state:NativeState)=>{if(seen.has(state))return;seen.add(state);states.push(state);for(const child of state.children??[]){childIds.add(child.threadId);visit(child.state);}for(const report of state.reports??[])visit(report.state);};visit(event.native);
   for(const state of states){for(const approval of state.approvals??[])if(approval.status==='pending')attention('attention:native:'+event.requestId+':'+approval.id,approval.kind==='input'?'question':'permission',approval.threadId);for(const entry of state.items??[])if(entry.item.type==='agentMessage'&&entry.item.questions?.length&&!entry.questionAnswer)attention('attention:question:'+event.requestId+':'+questionKey(entry),'question',entry.threadId);for(const entry of state.tools??[])tool(entry);}
   this.pending.set(scope,new Set(result.keys()));this.children.set(scope,childIds);
   if(!result.size){this.pending.delete(scope);if(!(event.native.children??[]).some(child=>child.status==='running'))this.children.delete(scope);}
  }else if(event.kind==='tool'&&event.tool){
   const keys=this.pending.get(scope)??new Set<string>(),id='attention:tool:'+event.tool.id;tool(event.tool);if(result.has(id))keys.add(id);else keys.delete(id);if(keys.size)this.pending.set(scope,keys);else this.pending.delete(scope);
  }
  if(event.kind==='goal'&&event.goal?.status==='completed'&&event.goal.conversation_id){const id='goal:'+event.goal.id+':'+event.goal.turns_used;result.set(id,{id,scope,requestId:event.requestId,attention:false,alert:{owner,conversationId:event.goal.conversation_id,kind:'goal',status:'completed'}});}
  else if(!event.kind&&!event.goalId&&event.requestId&&conversationId&&['completed','failed','interrupted'].includes(event.status??'')){const id='request:'+event.requestId;result.set(id,{id,scope,requestId:event.requestId,attention:false,alert:{owner,conversationId,kind:'response',status:event.status as ResponseAlert['status']}});}
  return [...result.values()];
 }
 private permitted(candidate:Candidate){
  const {alert}=candidate;if(this.host.owner()!==alert.owner)return false;const preferences=readNotificationPreferences(this.store,alert.owner);
  if(candidate.attention)return this.pending.get(candidate.scope)?.has(candidate.id)===true&&preferences[alert.kind==='permission'?'permissions':'questions']&&!this.host.foreground();
  return preferences.completion!=='never'&&(preferences.completion==='always'||!this.host.foreground());
 }
 private async deliver(candidate:Candidate){
  const {id,alert}=candidate;if(this.host.owner()!==alert.owner)return;const key='response-notifications:'+alert.owner,receipts=this.store.get<Record<string,true>>(key)??{};if(receipts[id])return;
  await this.store.set(key,{...receipts,[id]:true});if(!this.permitted(candidate))return;
  // Scheduled outcomes retain their individual important/all/off task policy.
  if(alert.kind==='response'&&await this.host.scheduled(alert.owner,candidate.requestId))return;
  if(this.permitted(candidate))this.host.show(alert);
 }
}
