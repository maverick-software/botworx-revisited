import {ChatQueue,type QueuedChat} from './chat-queue';
import {ChatDeliveryService,chatDeliveryReceipt,chatDeliveryScope,chatDeliveryProvenance,type ChatDelivery} from './chat-delivery';

/** One queue for user messages and authorized chat handoffs. SQL remains the
 * authority for a delivery; cached text/options are never trusted at dispatch.
 */
export class ChatDeliveryQueue{
 private operations=new Map<string,Promise<unknown>>();
 private async locked<T>(owner:string,id:string,work:()=>Promise<T>):Promise<T>{const key=owner+':'+id,prior=this.operations.get(key)??Promise.resolve(),result=prior.catch(()=>{}).then(work);this.operations.set(key,result);try{return await result;}finally{if(this.operations.get(key)===result)this.operations.delete(key);}}
 constructor(private service:ChatDeliveryService,private queue:ChatQueue,
  private steer:(owner:string,row:ChatDelivery,signal:AbortSignal,expected?:{requestId:string;turnId:string})=>Promise<unknown>,
  private decidePending:(owner:string,id:string,decision:'once'|'pair'|'deny')=>Promise<boolean>,
  private changed:(owner:string,conversation:string)=>void){}
 private queued(row:ChatDelivery,status:QueuedChat['status']='queued'):QueuedChat{
  const scope=chatDeliveryScope(row.snapshot);
  return {id:row.id,deliveryId:row.id,conversationId:row.target_chat,agentId:row.snapshot.target_agent,text:row.text,options:scope.options,createdAt:row.created_at,status,
   ...(row.error?{error:row.error}:{}),incoming:{source:chatDeliveryProvenance(row),requiresAuthorization:row.status==='awaiting_authorization',uncertain:!!row.dispatch_started_at,canSteer:scope.canSteer,...(row.target_request?{receivingRequestId:row.target_request}:{})}};
 }
 submit(owner:string,input:ChatDelivery,signal:AbortSignal){return this.locked(owner,input.id,()=>this.submitUnlocked(owner,input,signal));}
 private async submitUnlocked(owner:string,input:ChatDelivery,signal:AbortSignal){
  signal.throwIfAborted();const row=await this.service.read(owner,input.id);signal.throwIfAborted();
  if(row.user_id!==owner)throw new Error('This message belongs to another account.');
  if(row.status!=='queued')return chatDeliveryReceipt(row);
  if(row.delivery==='steer')return this.steer(owner,row,signal);
  const existing=this.queue.list(owner).find(item=>item.id===row.id);
  if(existing&&existing.deliveryId!==row.id)throw new Error('This queue identifier belongs to another message.');
  if(!existing)await this.queue.add(owner,this.queued(row));
  if(signal.aborted){if(!existing){await this.service.change(owner,row.id,'cancel');await this.queue.change(owner,row.id,'remove');}signal.throwIfAborted();}
  this.changed(owner,row.target_chat);this.queue.pump(owner,row.target_chat);return chatDeliveryReceipt(row);
 }
 async list(owner:string,conversation?:string):Promise<QueuedChat[]>{
  const local=this.queue.list(owner,conversation),pending=await this.service.pending(owner,conversation),records=new Map(pending.map(row=>[row.id,row]));
  await Promise.all(local.filter(row=>row.deliveryId&&!records.has(row.deliveryId)).map(async row=>{const saved=await this.service.maybeRead(owner,row.deliveryId!);if(saved)records.set(row.deliveryId!,saved);}));
  const grants=await this.service.validGrants(owner,[...records.values()]);
  const result:QueuedChat[]=[];
  for(const item of local){
   if(!item.deliveryId){result.push(item);continue;}
   const row=records.get(item.deliveryId);
   if(!row){if(item.status!=='starting')await this.queue.change(owner,item.id,'remove');continue;}
   if(['delivered','cancelled','denied'].includes(row.status)){
    if(item.status!=='starting')await this.queue.change(owner,item.id,'remove');
    continue;
   }
   const view=this.view(row,item,!!row.grant_id&&grants.get(row.grant_id)===row.grant_revision);result.push(view);records.delete(row.id);
  }
  for(const row of records.values())if(!['delivered','cancelled','denied'].includes(row.status))result.push(this.view(row,undefined,!!row.grant_id&&grants.get(row.grant_id)===row.grant_revision));
  return result;
 }
 private view(row:ChatDelivery,local?:QueuedChat,grantValid=false):QueuedChat{
  const sending=row.status==='dispatching'||local?.status==='starting',held=!sending&&(row.status==='held'||row.status==='awaiting_authorization'||!local),
   view=this.queued(row,sending?'starting':held?'held':local!.status);
  view.error=row.error??local?.error??(held?'Review this incoming message before continuing.':undefined);
  if(held&&!row.dispatch_started_at){view.incoming!.requiresAuthorization=row.status==='awaiting_authorization'||!row.authorized_once&&!grantValid;if(view.incoming!.requiresAuthorization)view.incoming!.review=this.service.approval(row);}
  return view;
 }
 async recover(owner:string){await this.service.recover(owner);await this.queue.recover(owner);}
 change(owner:string,id:string,action:'remove'|'edit'|'resume',text?:string){return this.locked(owner,id,()=>this.changeUnlocked(owner,id,action,text));}
 private async changeUnlocked(owner:string,id:string,action:'remove'|'edit'|'resume',text?:string){
  const local=this.queue.list(owner).find(row=>row.id===id);
  if(local&&!local.deliveryId)return this.queue.change(owner,id,action,text);
  if(local?.status==='starting')throw new Error('This message is already sending. Use Stop or inspect its receiving chat.');
  const row=await this.service.maybeRead(owner,local?.deliveryId??id);
  if(!row){if(local&&action==='remove')return this.queue.change(owner,local.id,'remove');throw new Error('This incoming message is no longer available.');}
  if(action==='edit')throw new Error('This message came from another chat. Open its source, or remove it and compose your own message.');
  if(action==='remove'){
   if(!await this.decidePending(owner,row.id,'deny'))await this.service.change(owner,row.id,'cancel');
   if(local)await this.queue.change(owner,local.id,'remove');this.changed(owner,row.target_chat);return;
  }
  if(row.status==='held')await this.service.change(owner,row.id,'resume');
  const current=await this.service.read(owner,row.id);
  if(current.status!=='queued')throw new Error('Review and authorize this message before resuming it.');
  if(current.delivery==='steer'){await this.steer(owner,current,new AbortController().signal);return;}
  if(!local)await this.queue.add(owner,this.queued(current,'held'));
  await this.queue.change(owner,row.id,'resume');this.changed(owner,row.target_chat);
 }
 authorize(owner:string,id:string,decision:'once'|'pair'|'deny'){return this.locked(owner,id,()=>this.authorizeUnlocked(owner,id,decision));}
 private async authorizeUnlocked(owner:string,id:string,decision:'once'|'pair'|'deny'){
  const row=await this.service.read(owner,id);
  if(await this.decidePending(owner,id,decision)){this.changed(owner,row.target_chat);return;}
  if(row.status==='held')await this.service.change(owner,id,'review');
  const saved=await this.service.authorize(owner,id,decision);
  if(saved.status==='queued'){
   const local=this.queue.list(owner).find(item=>item.id===id);
   if(local)await this.queue.change(owner,id,'remove');
   await this.submitUnlocked(owner,saved,new AbortController().signal);
  }
  this.changed(owner,row.target_chat);
 }
 steerQueued(owner:string,id:string,expected:{requestId:string;turnId:string}){return this.locked(owner,id,()=>this.steerQueuedUnlocked(owner,id,expected));}
 private async steerQueuedUnlocked(owner:string,id:string,expected:{requestId:string;turnId:string}){
  const local=this.queue.list(owner).find(item=>item.id===id);
  if(!local?.deliveryId)throw new Error('This incoming message is no longer in the queue.');
  const row=await this.service.read(owner,local.deliveryId);
  await this.queue.steer(owner,id,()=>this.steer(owner,row,new AbortController().signal,expected).then(()=>{}));
 }
}
