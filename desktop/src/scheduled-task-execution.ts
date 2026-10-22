import type {SupabaseClient} from '@supabase/supabase-js';
import type {Identity,ChatOptions,Provider,Model} from './contracts';
import type {WorkspaceFiles} from './workspace';
import type {AgentService} from './agent-service';
import type {TaskFileBinding,TaskSnapshot,TaskWorkspace} from './scheduled-task-contracts';
import {chatOptions,validateThinking} from './composer';
import {taskSnapshot} from './scheduled-task-store';
import {expandScheduledProjects} from './scheduled-projects';

type CapturedProject={id:string;revision:number;reference_id:string|null;file_ids:string[]};

const data=(result:any):any=>{if(result.error)throw Error(result.error.message);return result.data;};
type Services={
 db:SupabaseClient;files:Pick<WorkspaceFiles,'list'>;agents:Pick<AgentService,'profile'>;
 defaults:(user:Identity,options:ChatOptions)=>Promise<ChatOptions>;
 models:(provider:Provider,owner:string)=>Promise<Model[]>;
 connection:(provider:Provider,owner:string)=>Promise<unknown>;
 full:(user:Identity)=>void;
 workspace?:(owner:string,project:CapturedProject,files:TaskFileBinding[])=>Promise<TaskWorkspace>;
};

/** Capture context from owned records. Revisions and paths are never accepted
 * as authority from a renderer form, task prompt or plugin response. */
export class ScheduledTaskExecution{
 constructor(private services:Services){}
 private async project(user:Identity,conversation:unknown,requested:unknown){
  const db=this.services.db;let projectId=requested??null;
  if(conversation){
   data(await db.from('conversation_sessions').select('conversation_id').eq('conversation_id',conversation).eq('user_id',user.id).single());
   const membership=data(await db.from('desktop_project_chats').select('project_id').eq('conversation_id',conversation).eq('user_id',user.id).maybeSingle());
   if(projectId&&projectId!==membership?.project_id)throw Error('The scheduled conversation moved to another project.');projectId=membership?.project_id??null;
  }
  return projectId?data(await db.from('desktop_projects').select('id,revision,reference_id,file_ids').eq('id',projectId).eq('user_id',user.id).single()) as CapturedProject:null;
 }
 async prepare(user:Identity,value:Record<string,unknown>):Promise<TaskSnapshot>{
  const agent=data(await this.services.db.from('agents').select('id,agent_llm_preferences(provider,model)').eq('id',value.agentId).eq('user_id',user.id).eq('active',true).single()),profile=await this.services.agents.profile(user.id,agent.id),pref=Array.isArray(agent.agent_llm_preferences)?agent.agent_llm_preferences[0]:agent.agent_llm_preferences;
  let options=chatOptions(value.options);if(options.permission==='full')this.services.full(user);
  if(!options.provider)options=await this.services.defaults(user,{...options,provider:pref?.provider,model:options.model??pref?.model});
  if(options.goalId||options.harness==='legacy')throw Error('Scheduled responses use native Codex without an inherited goal.');
  const references=this.services.files.list(user.id),capture=(ids:string[])=>ids.map(id=>{const file=references.find(reference=>reference.id===id);if(!file)throw Error('A scheduled file or folder is unavailable. Select it again.');return {id:file.id,path:file.path,kind:file.kind};});
  const common=()=>({name:value.name,instructions:value.instructions,agentId:agent.id,agentRevision:profile.revision,notifications:value.notifications});
  const workspace=async(project:CapturedProject,files:TaskFileBinding[])=>{if(!this.services.workspace)throw Error('Scheduled Git worktree preparation is unavailable. Choose local execution.');return this.services.workspace(user.id,project,files);};
  if(value.projects!==undefined){
   if(value.conversationId||value.projectId||value.workspace!==undefined||!Array.isArray(value.projects)||!value.projects.length||value.projects.length>20)throw Error('Choose up to twenty projects for separate new scheduled chats.');
   const requested=value.projects.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Choose a scheduled project.');const row=item as Record<string,unknown>;if(typeof row.projectId!=='string'||row.execution!==undefined&&row.execution!=='local'&&row.execution!=='worktree')throw Error('Choose a supported project execution mode.');return {id:row.projectId,execution:row.execution??'local'};});
   if(new Set(requested.map(row=>row.id)).size!==requested.length)throw Error('Choose each scheduled project once.');
   const targets=[];
   for(const selected of requested){
    const project=await this.project(user,null,selected.id);if(!project)throw Error('The scheduled project is unavailable.');
    if(selected.execution==='worktree'&&(options.permission==='chat'||!project.reference_id))throw Error('A scheduled worktree needs a selected project folder and file access.');
    const files=capture([...new Set([...(options.permission==='chat'?[]:project.reference_id?[project.reference_id]:[]),...options.files,...(options.permission==='chat'?[]:project.file_ids)])]);
    targets.push({projectId:project.id,projectRevision:project.revision,files,...(selected.execution==='worktree'?{workspace:await workspace(project,files)}:{})});
   }
   return taskSnapshot({...common(),conversationId:null,projectId:null,projectRevision:null,options:{...options,harness:'codex'},files:capture(options.files),targets});
  }
  if(value.workspace!==undefined&&value.workspace!=='local'&&value.workspace!=='worktree')throw Error('Choose a supported project execution mode.');
  const project=await this.project(user,value.conversationId,value.projectId);
  if(value.workspace==='worktree'&&(value.conversationId||!project?.reference_id||options.permission==='chat'))throw Error('A scheduled worktree needs a new project chat with a selected folder and file access.');
  if(value.workspace!==undefined&&project?.reference_id&&options.permission!=='chat'&&!value.conversationId)options={...options,files:[project.reference_id,...options.files]};
  options={...options,harness:'codex',files:[...new Set([...options.files,...(options.permission==='chat'?[]:project?.file_ids??[])])]};
  const files=capture(options.files);
  return taskSnapshot({...common(),conversationId:value.conversationId??null,projectId:project?.id??null,projectRevision:project?.revision??null,options,files,...(value.workspace==='worktree'?{workspace:await workspace(project!,files)}:{})});
 }
 bindings(owner:string,snapshot:TaskSnapshot){
  const references=this.services.files.list(owner),scopes=expandScheduledProjects(snapshot);
  for(const scope of scopes)for(const file of [...scope.files,...(scope.workspace?.sourceFiles??[])])if(!references.some(current=>current.id===file.id&&current.path===file.path&&current.kind===file.kind))throw Error('A scheduled file grant was removed or changed. Review the task context.');
 }
 async validate(user:Identity,input:TaskSnapshot){
  const snapshot=taskSnapshot(input);data(await this.services.db.from('agents').select('id').eq('id',snapshot.agentId).eq('user_id',user.id).eq('active',true).single());
  const profile=await this.services.agents.profile(user.id,snapshot.agentId);if(profile.revision!==snapshot.agentRevision)throw Error('The scheduled agent changed. Review the task before continuing.');
  for(const scope of expandScheduledProjects(snapshot)){
   const project=await this.project(user,scope.conversationId,scope.projectId);if((project?.revision??null)!==scope.projectRevision)throw Error('The scheduled project changed. Review the task before continuing.');
   if(scope.workspace&&project?.reference_id!==scope.workspace.source.id)throw Error('The scheduled project folder changed. Review the task before continuing.');
  }
  this.bindings(user.id,snapshot);if(snapshot.options.permission==='full')this.services.full(user);
  const provider=snapshot.options.provider!,model=(await this.services.models(provider,user.id)).find(row=>row.id===snapshot.options.model);if(!model)throw Error('The scheduled model is unavailable. Choose another model explicitly.');validateThinking(model,snapshot.options.thinking);await this.services.connection(provider,user.id);
 }
}
