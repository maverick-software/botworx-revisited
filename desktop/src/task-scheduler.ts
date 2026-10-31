import type {ScheduledRun,ScheduledTaskStore,TaskDispatchOutcome} from './scheduled-task-contracts';
import {ScheduledTaskNotSubmitted} from './scheduled-task-contracts';
import {taskDue} from './task-cadence';

type Execution={owner:string;controller:AbortController;done:Promise<void>};
type SchedulerHost={
 owner:()=>string|null;
 canPoll?:()=>boolean;
 available:(run:ScheduledRun)=>boolean;
 launch:(run:ScheduledRun,signal:AbortSignal)=>Promise<TaskDispatchOutcome>;
 changed:(owner:string)=>void;
 now?:()=>Date;
};

/** The desktop host supplies the same owned execution path used by chat.
 * Scheduling never bypasses permission checks, selects another connection on
 * failure, or repeats a launch whose saved outcome is uncertain. */
export class TaskScheduler{
 private timer?:NodeJS.Timeout;
 private pumping?:Promise<void>;
 private requested=false;
 private executions=new Map<string,Execution>();
 private closed=false;
 private generation=0;
 private claiming=0;
 private staging=0;
 private fault:string|null=null;
 constructor(private store:ScheduledTaskStore,private host:SchedulerHost){}
 get error(){return this.fault;}
 get active(){return [...this.executions.keys()];}
 get busy(){return !!this.pumping||this.claiming>0||this.executions.size>0;}
 get recoveryBusy(){return this.staging>0||this.claiming>0||this.executions.size>0;}
 invalidatePolling(){if(this.recoveryBusy)throw Error('Finish scheduled task writes and executions before reconnecting.');this.generation++;this.requested=false;this.pumping=undefined;}
 private changed(owner:string){try{this.host.changed(owner);}catch(error){this.fault='The task display could not be refreshed: '+(error as Error).message;}}
 async initialize(){await this.store.recover();this.fault=null;}
 start(){if(this.closed||this.timer)return;this.timer=setInterval(()=>{void this.tick();},5000);this.timer.unref();void this.tick();}
 tick():Promise<void>{if(this.closed||this.host.canPoll?.()===false)return Promise.resolve();if(this.pumping){this.requested=true;return this.pumping;}this.requested=false;const generation=this.generation,operation=this.pump().catch(error=>{if(this.generation!==generation)return;this.fault=(error as Error).message;const owner=this.host.owner();if(owner)this.changed(owner);}).finally(()=>{if(this.pumping===operation)this.pumping=undefined;if(this.requested&&!this.closed)void this.tick();});this.pumping=operation;return operation;}
 private current(owner:string,generation:number){return !this.closed&&this.generation===generation&&this.host.owner()===owner;}
 private polling(owner:string,generation:number){return this.current(owner,generation)&&this.host.canPoll?.()!==false;}
 private async pump(){
  const owner=this.host.owner(),generation=this.generation;if(!owner)return;
  const now=(this.host.now?.()??new Date()).toISOString(),tasks=await this.store.tasks(owner);if(!this.polling(owner,generation))return;
  for(const task of tasks){
   if(!this.polling(owner,generation))return;if(task.owner!==owner)throw Error('A scheduled task belongs to another account.');if(task.status!=='active')continue;
   const occurrence=taskDue(task,now);if(!occurrence)continue;
   this.staging++;try{await this.store.stage(task,occurrence.due,occurrence.next,occurrence.skip);}finally{this.staging--;}if(!this.polling(owner,generation))return;this.changed(owner);
  }
  const pending=await this.store.pending(owner);if(!this.polling(owner,generation))return;
  for(const candidate of pending){
   if(!this.polling(owner,generation))return;
   if(candidate.owner!==owner)throw Error('A scheduled run belongs to another account.');
   if(candidate.status!=='pending'||this.executions.has(candidate.id)||[...this.executions.values()].some(run=>run.owner===owner)||!this.host.available(candidate))continue;
   this.claiming++;try{const run=await this.store.claim(owner,candidate.id);if(!run)continue;
   if(!this.current(owner,generation)){await this.store.hold(owner,run.id,'Your account changed before the scheduled response started. Inspect the saved run before continuing.');return;}
   if(run.owner!==owner||run.id!==candidate.id||run.requestId!==candidate.requestId)throw Error('The scheduled run ownership changed.');
   if(this.host.canPoll?.()===false){let deferred=false;try{deferred=await this.store.defer(owner,run.id);}catch{}if(!deferred)await this.store.hold(owner,run.id,'A scheduled response could not be deferred safely. Inspect its saved outcome before continuing.');return;}
   const controller=new AbortController();let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve;});this.executions.set(run.id,{owner,controller,done});
   void this.execute(run,controller).finally(()=>{this.executions.delete(run.id);finish();this.changed(owner);void this.tick();});this.changed(owner);
   }finally{this.claiming--;}
  }
 }
 private async execute(run:ScheduledRun,controller:AbortController){
  try{const outcome=await this.host.launch(run,controller.signal);if(outcome.status!=='queued')await this.store.finish(run.owner,run.id,outcome);}
  catch(error){
   if(error instanceof ScheduledTaskNotSubmitted||controller.signal.aborted){try{if(await this.store.defer(run.owner,run.id))return;}catch{}}
   await this.store.hold(run.owner,run.id,'This scheduled response needs review: '+(error as Error).message).catch(()=>{this.fault='The scheduled response outcome could not be saved. Inspect its conversation before running it again.';});
  }
 }
 async stop(owner:string,id:string){const run=this.executions.get(id);if(!run||run.owner!==owner)return false;run.controller.abort(new DOMException('Scheduled response stopped by you.','AbortError'));await run.done;return true;}
 async accountChanged(owner:string){this.generation++;const running=[...this.executions.values()].filter(run=>run.owner===owner);for(const run of running)run.controller.abort(new DOMException('The Sylvana account changed.','AbortError'));await Promise.all(running.map(run=>run.done));}
 async close(){this.closed=true;this.generation++;if(this.timer)clearInterval(this.timer);await this.pumping;for(const run of this.executions.values())run.controller.abort(new DOMException('Sylvana closed. Inspect the saved scheduled response before continuing.','AbortError'));await Promise.all([...this.executions.values()].map(run=>run.done));}
}
