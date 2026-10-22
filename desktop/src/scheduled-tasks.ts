import {randomUUID} from 'node:crypto';
import type {Identity} from './contracts';
import type {ScheduledRun,TaskSnapshot,TaskDispatchOutcome,TaskCadence,ScheduledTask} from './scheduled-task-contracts';
import {PostgresScheduledTasks} from './scheduled-task-store';
import {taskCadence} from './task-cadence';
import {TaskScheduler} from './task-scheduler';

export type ScheduledTaskHost={
 owner:()=>string|null;
 canPoll?:()=>boolean;
 identity:()=>Promise<Identity>;
 prepare:(user:Identity,value:Record<string,unknown>)=>Promise<TaskSnapshot>;
 validate:(user:Identity,snapshot:TaskSnapshot)=>Promise<void>;
 available:(run:ScheduledRun)=>boolean;
 launch:(run:ScheduledRun,signal:AbortSignal)=>Promise<TaskDispatchOutcome>;
 stop:(owner:string,requests:Set<string>)=>Promise<void>;
 changed:(owner:string)=>void;
};
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter scheduled task settings.');return value as Record<string,unknown>;};

/** Authenticated application operations. The renderer supplies choices; the
 * host captures actual agent/project revisions and approved file references. */
export class ScheduledTasks{
 readonly scheduler:TaskScheduler;
 constructor(readonly store:PostgresScheduledTasks,private host:ScheduledTaskHost){this.scheduler=new TaskScheduler(store,host);}
 async initialize(){await this.scheduler.initialize();}
 start(){this.scheduler.start();}
 async accountChanged(owner:string){await this.scheduler.accountChanged(owner);}
 async close(){await this.scheduler.close();}
 private async same(user:Identity){if(this.host.owner()!==user.id||(await this.host.identity()).id!==user.id)throw Error('Your account changed while preparing scheduled work.');}
 async prepare(user:Identity,value:Record<string,unknown>){await this.same(user);const snapshot=await this.host.prepare(user,value);await this.same(user);await this.host.validate(user,snapshot);await this.same(user);return snapshot;}
 async saveReviewed(user:Identity,id:string,expected:number|null,value:{snapshot:TaskSnapshot;cadence:TaskCadence;status:'active'|'paused';missed:'skip'|'latest'},signal:AbortSignal,guard:()=>Promise<void>,previous:ScheduledTask|null){
  signal.throwIfAborted();await this.same(user);await this.host.validate(user,value.snapshot);await guard();await this.same(user);signal.throwIfAborted();
  const result=await this.store.save(user.id,id,expected,value,new Date(),previous);await this.same(user);this.host.changed(user.id);void this.scheduler.tick();return result;
 }
 async call(action:string,args:Record<string,unknown>,user:Identity){
  await this.same(user);
  if(action==='tasks.list'){
   const [tasks,runs,legacy]=await Promise.all([this.store.tasks(user.id),this.store.runs(user.id),this.store.legacy(user.id)]);await this.same(user);
   return {tasks:args.agentId?tasks.filter(task=>task.snapshot.agentId===args.agentId):tasks,runs:args.agentId?runs.filter(run=>run.snapshot.agentId===args.agentId):runs,legacy:args.agentId?legacy.filter(task=>task.agentId===args.agentId):legacy,error:this.scheduler.error,local:true,requiresRunningApp:true};
  }
  if(action==='tasks.import'){
   if(typeof args.legacyId!=='string'||typeof args.updatedAt!=='string')throw Error('Choose the earlier schedule to import.');
   const value=record(args.value),cadence=taskCadence(value.cadence);if(value.status!=='paused')throw Error('Import the earlier schedule paused, then review it before enabling.');
   if(value.missed!=='skip'&&value.missed!=='latest')throw Error('Choose missed-run behavior.');
   const snapshot=await this.host.prepare(user,value);await this.same(user);await this.host.validate(user,snapshot);await this.same(user);
   const result=await this.store.importLegacy(user.id,args.legacyId,args.updatedAt,{snapshot,cadence,missed:value.missed});await this.same(user);this.host.changed(user.id);return result;
  }
  if(action==='tasks.save'){
   const value=record(args.value),cadence=taskCadence(value.cadence);if(value.status!=='active'&&value.status!=='paused'||value.missed!=='skip'&&value.missed!=='latest')throw Error('Choose task status and missed-run behavior.');
   const snapshot=await this.host.prepare(user,value);await this.same(user);await this.host.validate(user,snapshot);await this.same(user);
   const result=await this.store.save(user.id,typeof args.id==='string'?args.id:randomUUID(),args.revision===undefined?null:args.revision as number,{snapshot,cadence,status:value.status,missed:value.missed});
   await this.same(user);
   this.host.changed(user.id);void this.scheduler.tick();return result;
  }
  if(action==='tasks.control'){
   const actions=['pause','resume','delete','manual','read','dismiss','cancel'] as const;if(typeof args.action!=='string'||!actions.includes(args.action as any)||typeof args.id!=='string'||typeof args.revision!=='number')throw Error('Choose an available task operation.');
   const action=args.action as typeof actions[number],runId=typeof args.runId==='string'?args.runId:undefined;
   if(['manual','read','dismiss','cancel'].includes(action)&&!runId)throw Error('Choose a stable scheduled run identifier.');
   const task=await this.store.task(user.id,args.id);await this.same(user);
   if(action==='manual'||action==='resume'){await this.host.validate(user,task.snapshot);await this.same(user);}
   const reviewed=args.reviewed===undefined?undefined:record(args.reviewed);
   if(reviewed&&(!['active','paused','completed','deleted'].includes(reviewed.status as string)||reviewed.nextAt!==null&&(typeof reviewed.nextAt!=='string'||!Number.isFinite(Date.parse(reviewed.nextAt)))))throw Error('The reviewed schedule state is unavailable.');
   const result=await this.store.control(user.id,task.id,args.revision,action,runId,new Date(),reviewed as Pick<ScheduledTask,'status'|'nextAt'>|undefined);this.host.changed(user.id);
   if(action==='delete'||action==='cancel'){
    const ids=new Set(await this.store.requestIds(user.id,task.id,action==='cancel'?runId:undefined));await this.host.stop(user.id,ids);
    const runs=await this.store.runs(user.id,task.id);for(const run of runs)if(action==='delete'||run.id===runId)await this.scheduler.stop(user.id,run.id);
   }
   await this.same(user);
   void this.scheduler.tick();return result;
  }
  throw Error('Unknown scheduled task operation.');
 }
}
