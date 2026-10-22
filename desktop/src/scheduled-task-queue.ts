import {ChatQueue,type QueuedChat} from './chat-queue';
import {PostgresScheduledTasks} from './scheduled-task-store';
import {ScheduledTaskNotSubmitted,type ScheduledRun,type TaskDispatchOutcome,type TaskRunOutcome} from './scheduled-task-contracts';

type Dispatch={owner:string;controller:AbortController;done:Promise<void>};
const terminal=new Set(['completed','failed','cancelled','skipped']);
/** Scheduled follow-ups share FIFO chat ordering and the existing goal-yield
 * boundary. PostgreSQL owns their prompt/scope; the local queue is only a cache. */
export class ScheduledTaskQueue{
 private dispatches=new Map<string,Dispatch>();
 constructor(private store:PostgresScheduledTasks,private queue:ChatQueue,
  private execute:(run:ScheduledRun,signal:AbortSignal)=>Promise<TaskRunOutcome>,
  private changed:(owner:string)=>void){}
 get busy(){return this.dispatches.size>0;}
 private view(run:ScheduledRun,status:QueuedChat['status'],error?:string):QueuedChat{
  if(!run.snapshot.conversationId)throw Error('This scheduled response has no existing chat.');
  return {id:run.requestId,scheduledRunId:run.id,scheduled:{taskId:run.taskId,name:run.snapshot.name,state:run.status},conversationId:run.snapshot.conversationId,agentId:run.snapshot.agentId,text:run.snapshot.instructions,options:run.snapshot.options,createdAt:run.scheduledFor,status,...(error?{error}:{})};
 }
 private async owned(owner:string,id:string){const run=await this.store.run(owner,id);if(!run||run.owner!==owner)throw Error('This scheduled run is unavailable for your account.');return run;}
 async submit(input:ScheduledRun,signal:AbortSignal):Promise<TaskDispatchOutcome>{
  signal.throwIfAborted();const run=await this.owned(input.owner,input.id);signal.throwIfAborted();
  if(run.status!=='starting'||run.requestId!==input.requestId)throw Error('This scheduled run has already started or needs inspection.');
  if(run.requestCreatedAt||await this.store.requestExists(run.owner,run.requestId))throw Error('Inspect the saved scheduled response before submitting it again.');
  if(!run.snapshot.conversationId)return this.execute(run,signal);
  const existing=this.queue.list(run.owner).find(row=>row.id===run.requestId);
  if(existing){
   if(existing.scheduledRunId!==run.id)throw Error('This queue identifier belongs to another message.');
   if(existing.status==='starting'||await this.store.requestExists(run.owner,run.requestId))throw Error('Inspect this scheduled response before sending anything again.');
   // Recovery/defer has proved that this run never created a chat request.
   // Re-append it after already queued human work using the authoritative scope.
   await this.queue.removeScheduled(run.owner,existing.id);
  }
  await this.queue.add(run.owner,this.view(run,'queued'));
  if(signal.aborted){await this.cancelRequests(run.owner,new Set([run.requestId]));signal.throwIfAborted();}
  this.changed(run.owner);this.queue.pump(run.owner,run.snapshot.conversationId);return {status:'queued'};
 }
 async dispatch(owner:string,row:QueuedChat):Promise<void>{
  if(!row.scheduledRunId||this.dispatches.has(row.id))throw Error('This scheduled message is already sending or unavailable.');
  const controller=new AbortController();let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve;});this.dispatches.set(row.id,{owner,controller,done});
  try{
   const run=await this.owned(owner,row.scheduledRunId);controller.signal.throwIfAborted();
   if(run.requestId!==row.id||run.snapshot.conversationId!==row.conversationId||run.status!=='starting')throw Error('The scheduled queue scope changed. Open Scheduled to inspect it.');
   if(run.requestCreatedAt||await this.store.requestExists(owner,run.requestId))throw Error('This scheduled response already has execution evidence. Inspect it before continuing.');
   // Cached text/model/attachments are deliberately ignored.
   const result=await this.execute(run,controller.signal);await this.store.finish(owner,run.id,result);
  }catch(error){
   if((error instanceof ScheduledTaskNotSubmitted||controller.signal.aborted)&&await this.store.defer(owner,row.scheduledRunId).catch(()=>false))throw error;
   await this.store.hold(owner,row.scheduledRunId,'Scheduled response needs inspection: '+(error as Error).message).catch(()=>{});throw error;
  }finally{this.dispatches.delete(row.id);finish();this.changed(owner);}
 }
 async list(owner:string,rows:QueuedChat[]):Promise<QueuedChat[]>{
  const result:QueuedChat[]=[];
  for(const row of rows){
   if(!row.scheduledRunId){result.push(row);continue;}
   const run=await this.store.run(owner,row.scheduledRunId);
   if(!run||run.owner!==owner||terminal.has(run.status)){
    if(row.status!=='starting'&&this.queue.list(owner).some(item=>item.id===row.id))await this.queue.removeScheduled(owner,row.id);
    if(row.status==='starting'&&run)result.push(this.view(run,'starting','Finishing or stopping this scheduled response.'));continue;
   }
   result.push(this.view(run,run.status==='held'?'held':row.status,run.error??row.error));
  }
  return result;
 }
 async recover(owner:string){
  for(const row of this.queue.list(owner).filter(row=>row.scheduledRunId)){
   const run=await this.store.run(owner,row.scheduledRunId!);
   if(!run||terminal.has(run.status)||run.status==='pending'){
    if(row.status==='starting')await this.queue.holdItem(owner,row.id,'Recovered scheduled queue entry.');
    await this.queue.removeScheduled(owner,row.id);
   }else await this.queue.holdItem(owner,row.id,run.error??'Inspect the interrupted run in Scheduled before continuing.');
  }
 }
 async cancelRequests(owner:string,ids:Set<string>){
  const active=[...this.dispatches].filter(([id,record])=>record.owner===owner&&ids.has(id));
  for(const [,record] of active)record.controller.abort(new DOMException('Scheduled response stopped.','AbortError'));
  await Promise.all(active.map(([,record])=>record.done));
  for(const row of this.queue.list(owner).filter(row=>row.scheduledRunId&&ids.has(row.id))){
   if(row.status==='starting')await this.queue.holdItem(owner,row.id,'Stopped scheduled response.');
   if(this.queue.list(owner).some(item=>item.id===row.id))await this.queue.removeScheduled(owner,row.id);
  }
 }
 async closeOwner(owner:string,reason='Signed out before this scheduled response started.'){
  const ids=new Set([...this.queue.list(owner).filter(row=>row.scheduledRunId).map(row=>row.id),...[...this.dispatches].filter(([,row])=>row.owner===owner).map(([id])=>id)]);
  const runs=await Promise.all(this.queue.list(owner).filter(row=>row.scheduledRunId).map(row=>this.store.run(owner,row.scheduledRunId!)));
  await this.cancelRequests(owner,ids);
  for(const run of runs)if(run&&run.owner===owner&&!run.requestCreatedAt&&!await this.store.requestExists(owner,run.requestId))await this.store.finish(owner,run.id,{status:'cancelled',error:reason});
 }
 async close(){for(const owner of new Set([...this.dispatches.values()].map(row=>row.owner)))await this.closeOwner(owner,'Agentopia closed before this scheduled response started.');}
}
