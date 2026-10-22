import type {SupabaseClient} from '@supabase/supabase-js';
import type {ChatOptions,Goal} from './contracts';
import type {WorkspacePlan,PlanDraft} from './plan-contracts';
import type {Secrets} from './secrets';
import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from './tool-contracts';
const must=(r:any):any=>{if(r.error)throw new Error(r.error.message);return r.data;};
export class Planning{
 private drafts=new Map<string,Promise<unknown>>();
 constructor(private db:SupabaseClient,private secrets?:Secrets){}
 async removeDraft(user:string,id:string){const key='plan-draft:'+user+':'+id,previous=this.drafts.get(key)??Promise.resolve(),operation=previous.catch(()=>{}).then(()=>this.secrets?.set(key,undefined));this.drafts.set(key,operation);try{await operation;}finally{if(this.drafts.get(key)===operation)this.drafts.delete(key);}}
 async draft(user:string,id:string,value?:unknown,expected?:unknown,clear=false){
  const key='plan-draft:'+user+':'+id,previous=this.drafts.get(key)??Promise.resolve(),operation=previous.catch(()=>{}).then(async()=>{
   await this.byId(user,id);if(!this.secrets)throw new Error('Protected plan draft storage is unavailable.');const old=this.secrets.get<PlanDraft>(key)??null;
   if(value===undefined&&!clear)return old;if((old?.version??0)!==expected)throw new Error('Local plan edits changed. Reopen the plan before continuing.');
   if(clear){await this.secrets.set(key,undefined);return null;}
   const draft=value as PlanDraft;if(!draft||!Number.isSafeInteger(draft.baseRevision)||draft.baseRevision<1||typeof draft.title!=='string'||draft.title.length>200||typeof draft.overview!=='string'||draft.overview.length>4000||!Array.isArray(draft.steps)||draft.steps.length>20||draft.steps.some(step=>!step||typeof step.id!=='string'||!/^[a-f0-9-]{36}$/.test(step.id)||typeof step.text!=='string'||step.text.length>1000||!['pending','in_progress','completed'].includes(step.status)))throw new Error('Invalid local plan draft.');
   const next:PlanDraft={version:(old?.version??0)+1,baseRevision:draft.baseRevision,title:draft.title,overview:draft.overview,steps:draft.steps.map(({id,text,status})=>({id,text,status}))};await this.secrets.set(key,next);return next;
  });this.drafts.set(key,operation);try{return await operation;}finally{if(this.drafts.get(key)===operation)this.drafts.delete(key);}
 }
 async conversation(user:string,conversation:string){const row=must(await this.db.from('conversation_sessions').select('conversation_id,agent_id').eq('conversation_id',conversation).eq('user_id',user).maybeSingle());if(!row)throw new Error('Conversation not found.');return row;}
 async get(user:string,conversation:string):Promise<WorkspacePlan|null>{await this.conversation(user,conversation);return must(await this.db.from('desktop_plans').select('*').eq('conversation_id',conversation).eq('user_id',user).maybeSingle());}
 async byId(user:string,id:string):Promise<WorkspacePlan>{const row=must(await this.db.from('desktop_plans').select('*').eq('id',id).eq('user_id',user).maybeSingle());if(!row)throw new Error('Plan not found.');return row;}
 async history(user:string,id:string){await this.byId(user,id);return must(await this.db.from('desktop_plan_revisions').select('revision,snapshot,created_at').eq('plan_id',id).eq('user_id',user).order('revision',{ascending:false}).limit(20));}
 async save(user:string,conversation:string,args:Record<string,unknown>,request?:string){const steps=request&&Array.isArray(args.steps)?args.steps.map(step=>step&&typeof step==='object'&&step.id===null?{...step,id:randomUUID()}:step):args.steps;return must(await this.db.rpc('desktop_save_plan',{p_user:user,p_conversation:conversation,p_title:args.title,p_overview:args.overview,p_steps:steps,p_revision:args.revision??null,p_request:request??null})) as WorkspacePlan;}
 async advance(user:string,id:string,args:Record<string,unknown>,request?:string){return must(await this.db.rpc('desktop_advance_plan',{p_user:user,p_plan:id,p_revision:args.revision,p_updates:args.updates,p_request:request??null})) as WorkspacePlan;}
 async implement(user:string,id:string,revision:unknown,turns:unknown){return must(await this.db.rpc('desktop_implement_plan',{p_user:user,p_plan:id,p_revision:revision,p_turns:turns})) as Goal;}
 async validateGoal(user:string,goal:Goal){if(!goal.plan_id)return;const current=await this.byId(user,goal.plan_id);if(current.content_revision!==goal.plan_snapshot?.content_revision||current.approved_content_revision!==current.content_revision)throw new Error('The plan changed. Review it and start a new implementation.');}
 async definitions(user:string,conversation:string,options:ChatOptions):Promise<ToolDefinition[]>{
  const current=await this.get(user,conversation),schema=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),result:ToolDefinition[]=[];
  if(options.mode==='plan'||current)result.push({name:'get_plan',namespace:'planning',description:'Read this conversation’s current structured plan, revision and step progress. Plan contents express proposed work; completion statuses are reports, not independent verification.',parameters:schema({})});
  if(options.mode==='plan')result.push({name:'set_plan',namespace:'planning',description:'Save a concrete plan for user review in the plan canvas. Use 1 to 20 pending steps. Use null for new step IDs; retain returned UUIDs when revising existing steps. Read get_plan first to obtain the current revision, or use null only if no plan exists. This does not authorize implementation.',parameters:schema({title:{type:'string'},overview:{type:'string'},steps:{type:'array',items:{type:'object',properties:{id:{type:['string','null']},text:{type:'string'},status:{type:'string',enum:['pending']}},required:['id','text','status'],additionalProperties:false}},revision:{type:['integer','null']}})});
  if(current&&options.mode==='chat'&&options.goalId){const goal=must(await this.db.from('desktop_goals').select('plan_id,status').eq('id',options.goalId).eq('user_id',user).single());if(goal.plan_id===current.id&&goal.status==='running')result.push({name:'update_plan_progress',namespace:'planning',description:'Report progress on the approved plan after confirmed work. Read get_plan for its current revision. Keep at most one step in progress. Mark completed only after its requested work and appropriate checks are done; preserve incomplete or blocked steps.',parameters:schema({revision:{type:'integer'},updates:{type:'array',items:{type:'object',properties:{step_id:{type:'string'},status:{type:'string',enum:['pending','in_progress','completed']}},required:['step_id','status'],additionalProperties:false}}})});}
  return result;
 }
 async execute(user:string,request:any,name:string,args:Record<string,unknown>){if(name==='get_plan')return this.get(user,request.conversation_id);if(name==='set_plan')return this.save(user,request.conversation_id,args,request.id);const plan=await this.get(user,request.conversation_id);if(!plan)throw new Error('This conversation has no saved plan.');return this.advance(user,plan.id,args,request.id);}
}
