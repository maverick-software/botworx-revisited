import type {SupabaseClient} from '@supabase/supabase-js';
import {chatOptions} from './composer';
import {taskCadence,taskNext} from './task-cadence';
import {taskProjectTargets,taskWorkspace} from './scheduled-projects';
import type {ScheduledTask,ScheduledRun,ScheduledTaskStore,TaskSnapshot,TaskRunOutcome,TaskCadence,LegacyScheduledTask} from './scheduled-task-contracts';

const uuid=(value:unknown)=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value))throw Error('Invalid scheduled task identifier.');return value;};
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scheduled task record.');return value as Record<string,any>;};
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw Error('Enter valid task text.');return value.trim();};
const revision=(value:unknown)=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw Error('Invalid scheduled task revision.');return value;};
const date=(value:unknown)=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Invalid scheduled time.');return new Date(value).toISOString();};
const data=(result:any):any=>{if(result.error)throw Error(result.error.message);return result.data;};

export function taskSnapshot(value:unknown):TaskSnapshot{
 const input=object(value),options=chatOptions(input.options);
 if(input.notifications!==undefined&&!['important','all','off'].includes(input.notifications))throw Error('Choose a supported task notification setting.');
 if(!options.provider||!options.model||options.goalId||options.harness==='legacy')throw Error('Choose a connected model and native scheduled response settings.');
 if(!Array.isArray(input.files)||input.files.length>20)throw Error('Choose up to twenty files or folders.');
 const files=input.files.map((value:unknown)=>{const file=object(value);if(file.kind!=='file'&&file.kind!=='folder')throw Error('Invalid scheduled file kind.');text(file.path,32767);return {id:uuid(file.id),path:file.path as string,kind:file.kind as 'file'|'folder'};});
 if(new Set(files.map(file=>file.id)).size!==files.length||files.length!==options.files.length||files.some(file=>!options.files.includes(file.id)))throw Error('The scheduled file scope changed. Select its context again.');
 if(options.permission==='chat'&&files.length)throw Error('Chat only does not share files. Remove file context or select another permission.');
 const projectId=input.projectId===null?null:uuid(input.projectId),conversationId=input.conversationId===null?null:uuid(input.conversationId);
 if(projectId===null&&input.projectRevision!==null)throw Error('The scheduled project revision is invalid.');
 const snapshot:TaskSnapshot={name:text(input.name,200),instructions:text(input.instructions,50000),agentId:uuid(input.agentId),agentRevision:revision(input.agentRevision),projectId,projectRevision:projectId===null?null:revision(input.projectRevision),conversationId,options:{...options,harness:'codex'},files,...(input.notifications===undefined?{}:{notifications:input.notifications})};
 if(input.targets!==undefined){if(conversationId!==null||projectId!==null||input.workspace!==undefined)throw Error('Multiple scheduled projects need separate new chats and project workspace scopes.');snapshot.targets=taskProjectTargets(input.targets,files,options.permission);}
 if(input.workspace!==undefined){if(conversationId!==null||projectId===null||options.permission==='chat')throw Error('A scheduled worktree needs a new project chat with file access.');snapshot.workspace=taskWorkspace(input.workspace,files);}
 return snapshot;
}

function taskRecord(value:unknown):ScheduledTask{
 const row=object(value),status=row.status,missed=row.missed;
 if(!['active','paused','completed','deleted'].includes(status)||!['skip','latest'].includes(missed))throw Error('Invalid scheduled task state.');
 const legacy=row.legacyTaskId??row.legacy_task_id,updated=row.legacyUpdatedAt??row.legacy_updated_at;
 return {id:uuid(row.id),owner:uuid(row.owner??row.user_id),revision:revision(row.revision),status,cadence:taskCadence(row.cadence),anchor:date(row.anchor),nextAt:(row.nextAt??row.next_at)==null?null:date(row.nextAt??row.next_at),missed,snapshot:taskSnapshot(row.snapshot),note:typeof row.note==='string'?row.note:null,...(legacy?{legacyTaskId:uuid(legacy),legacyUpdatedAt:date(updated)}:{})};
}
function runRecord(value:unknown):ScheduledRun{
 const row=object(value),status=row.status,trigger=row.trigger;
 if(!['pending','starting','running','held','completed','failed','cancelled','skipped'].includes(status)||!['schedule','manual'].includes(trigger))throw Error('Invalid scheduled run state.');
 return {id:uuid(row.id),taskId:uuid(row.taskId??row.task_id),owner:uuid(row.owner??row.user_id),taskRevision:revision(row.taskRevision??row.task_revision),requestId:uuid(row.requestId??row.request_id),scheduledFor:date(row.scheduledFor??row.scheduled_for),trigger,status,snapshot:taskSnapshot(row.snapshot),conversationId:(row.conversationId??row.conversation_id)==null?null:uuid(row.conversationId??row.conversation_id),error:typeof row.error==='string'?row.error:null,unread:row.unread===true,requestCreatedAt:(row.requestCreatedAt??row.request_created_at)==null?null:date(row.requestCreatedAt??row.request_created_at),...((row.workspaceStartedAt??row.workspace_started_at)==null?{}:{workspaceStartedAt:date(row.workspaceStartedAt??row.workspace_started_at)})};
}

/** The service-role connection stays inside the trusted desktop broker. All
 * public methods require the broker's authenticated owner, never a model claim. */
export class PostgresScheduledTasks implements ScheduledTaskStore{
 constructor(private db:SupabaseClient){}
 async legacy(owner:string):Promise<LegacyScheduledTask[]>{
  uuid(owner);const imported=new Set<string>();for(let offset=0;;offset+=500){const rows=data(await this.db.from('desktop_scheduled_tasks').select('legacy_task_id').eq('user_id',owner).not('legacy_task_id','is',null).order('id').range(offset,offset+499));for(const row of rows)imported.add(row.legacy_task_id);if(rows.length<500)break;}
  const result:LegacyScheduledTask[]=[];for(let offset=0;;offset+=500){const rows=data(await this.db.from('agent_tasks').select('id,agent_id,name,instructions,cron_expression,timezone,updated_at').eq('user_id',owner).eq('status','paused').order('id').range(offset,offset+499));for(const row of rows)if(!imported.has(row.id))result.push({id:uuid(row.id),agentId:uuid(row.agent_id),name:text(row.name,200),instructions:text(row.instructions,50000),cadence:{kind:'cron',expression:row.cron_expression,timezone:row.timezone},updatedAt:date(row.updated_at)});if(rows.length<500)return result;}
 }
 async importLegacy(owner:string,legacyId:string,updatedAt:string,value:{snapshot:TaskSnapshot;cadence:TaskCadence;missed:'skip'|'latest'},now=new Date()){
  const cadence=taskCadence(value.cadence),snapshot=taskSnapshot(value.snapshot),anchor=now.toISOString(),next=taskNext(cadence,anchor,anchor);
  if(value.missed!=='skip'&&value.missed!=='latest')throw Error('Choose missed-run behavior.');
  return taskRecord(data(await this.db.rpc('desktop_import_legacy_schedule',{p_user:uuid(owner),p_legacy:uuid(legacyId),p_updated:date(updatedAt),p_value:{cadence,snapshot,anchor,missed:value.missed},p_next:next})));
 }
 async recover(){data(await this.db.rpc('desktop_recover_schedule_runs'));}
 async tasks(owner:string):Promise<ScheduledTask[]>{
  uuid(owner);const rows:ScheduledTask[]=[];for(let offset=0;;offset+=500){const batch=data(await this.db.from('desktop_scheduled_tasks').select('*').eq('user_id',owner).neq('status','deleted').order('created_at').order('id').range(offset,offset+499));rows.push(...batch.map(taskRecord));if(batch.length<500)return rows;}
 }
 async task(owner:string,id:string){return taskRecord(data(await this.db.from('desktop_scheduled_tasks').select('*').eq('user_id',uuid(owner)).eq('id',uuid(id)).single()));}
 async pending(owner:string):Promise<ScheduledRun[]>{
  uuid(owner);const rows:ScheduledRun[]=[];for(let offset=0;;offset+=500){const batch=data(await this.db.from('desktop_scheduled_runs').select('*').eq('user_id',owner).eq('status','pending').order('created_at').order('id').range(offset,offset+499));rows.push(...batch.map(runRecord));if(batch.length<500)return rows;}
 }
 async runs(owner:string,taskId?:string):Promise<ScheduledRun[]>{let query=this.db.from('desktop_scheduled_runs').select('*').eq('user_id',uuid(owner));if(taskId)query=query.eq('task_id',uuid(taskId));return data(await query.order('created_at',{ascending:false}).order('id').limit(200)).map(runRecord);}
 async run(owner:string,id:string):Promise<ScheduledRun|null>{const result=data(await this.db.from('desktop_scheduled_runs').select('*').eq('user_id',uuid(owner)).eq('id',uuid(id)).maybeSingle());return result?runRecord(result):null;}
 async requestExists(owner:string,id:string){return !!data(await this.db.from('desktop_requests').select('id').eq('user_id',uuid(owner)).eq('id',uuid(id)).maybeSingle());}
 async save(owner:string,id:string,expected:number|null,value:{snapshot:TaskSnapshot;cadence:TaskCadence;missed:'skip'|'latest';status:'active'|'paused'},now=new Date(),previous?:Pick<ScheduledTask,'status'|'nextAt'>|null):Promise<ScheduledTask>{
  uuid(owner);uuid(id);if(expected!==null)revision(expected);if(!['active','paused'].includes(value.status)||!['skip','latest'].includes(value.missed))throw Error('Choose task status and missed-run behavior.');
  const cadence=taskCadence(value.cadence),snapshot=taskSnapshot(value.snapshot),anchor=now.toISOString(),next=taskNext(cadence,anchor,anchor);
  if(value.status==='active'&&!next)throw Error('Choose a future time before enabling this task.');
  return taskRecord(data(await this.db.rpc(previous===undefined?'desktop_save_schedule':'desktop_save_reviewed_schedule',{p_user:owner,p_id:id,p_revision:expected,...(previous===undefined?{}:{p_previous:previous===null?null:{status:previous.status,nextAt:previous.nextAt}}),p_value:{cadence,snapshot,anchor,missed:value.missed},p_status:value.status,p_next:next})));
 }
 async stage(task:ScheduledTask,due:string,next:string|null,missed:boolean){const result=data(await this.db.rpc('desktop_stage_schedule_run',{p_user:uuid(task.owner),p_id:uuid(task.id),p_revision:revision(task.revision),p_due:date(due),p_next:next===null?null:date(next),p_skip:missed}));return result===null?null:runRecord(result);}
 async claim(owner:string,id:string){const result=data(await this.db.rpc('desktop_claim_schedule_run',{p_user:uuid(owner),p_run:uuid(id)}));return result===null?null:runRecord(result);}
 async defer(owner:string,id:string){return data(await this.db.rpc('desktop_defer_schedule_run',{p_user:uuid(owner),p_run:uuid(id)}))===true;}
 async activate(owner:string,id:string){data(await this.db.rpc('desktop_activate_scheduled_request',{p_user:uuid(owner),p_run:uuid(id)}));}
 async validateSnapshot(owner:string,snapshot:TaskSnapshot){data(await this.db.rpc('desktop_validate_schedule_snapshot',{p_user:uuid(owner),p_value:taskSnapshot(snapshot)}));}
 async beginWorkspace(owner:string,id:string){return runRecord(data(await this.db.rpc('desktop_begin_schedule_workspace',{p_user:uuid(owner),p_run:uuid(id)})));}
 async resolveWorkspace(owner:string,id:string,resolution:{files:TaskSnapshot['files'];resolved:NonNullable<NonNullable<TaskSnapshot['workspace']>['resolved']>}){return runRecord(data(await this.db.rpc('desktop_resolve_schedule_workspace',{p_user:uuid(owner),p_run:uuid(id),p_resolution:resolution})));}
 async finish(owner:string,id:string,outcome:TaskRunOutcome){if(!['completed','failed','cancelled','held'].includes(outcome.status))throw Error('Invalid scheduled response outcome.');data(await this.db.rpc('desktop_finish_schedule_run',{p_user:uuid(owner),p_run:uuid(id),p_status:outcome.status,p_conversation:outcome.conversationId?uuid(outcome.conversationId):null,p_error:outcome.error?.slice(0,4000)??null}));}
 async hold(owner:string,id:string,error:string){await this.finish(owner,id,{status:'held',error});}
 async control(owner:string,id:string,expected:number,action:'pause'|'resume'|'delete'|'manual'|'read'|'dismiss'|'cancel',runId?:string,now=new Date(),previous?:Pick<ScheduledTask,'status'|'nextAt'>){
  if(!['pause','resume','delete','manual','read','dismiss','cancel'].includes(action))throw Error('Choose a task operation.');
  const task=await this.task(owner,id),next=action==='resume'?taskNext(task.cadence,now.toISOString(),task.anchor):null;
  const result=object(data(await this.db.rpc(previous?'desktop_control_reviewed_schedule':'desktop_control_schedule',{p_user:uuid(owner),p_id:uuid(id),p_revision:revision(expected),...(previous?{p_previous:{status:previous.status,nextAt:previous.nextAt}}:{}),p_action:action,p_next:next,p_run:runId?uuid(runId):null})));
  return {task:taskRecord(result.task),run:result.run?runRecord(result.run):null};
 }
 async validate(owner:string,requestId:string):Promise<TaskSnapshot[]>{const result=data(await this.db.rpc('desktop_validate_scheduled_request',{p_user:uuid(owner),p_request:uuid(requestId)}));if(!Array.isArray(result))throw Error('The scheduled scope could not be validated.');return result.map(taskSnapshot);}
 async requestIds(owner:string,taskId:string,runId?:string):Promise<string[]>{const result=data(await this.db.rpc('desktop_schedule_request_ids',{p_user:uuid(owner),p_task:uuid(taskId),p_run:runId?uuid(runId):null}));if(!Array.isArray(result))throw Error('The scheduled execution scope is unavailable.');return result.map(uuid);}
}
