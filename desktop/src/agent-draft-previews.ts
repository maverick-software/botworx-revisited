import type {SupabaseClient} from '@supabase/supabase-js';
import type {Identity,Model} from './contracts';
import {validateThinking} from './composer';
import type {NativeExecutionUsage} from './execution-budget';
import type {ToolSource} from './tool-contracts';
import {draftPreviewOutput,draftPreviewTables,draftPreviewId,agentDraftPreviewInput,draftPreviewChildControl,previewContinuationInput,type AgentDraftPreviewChildControl,type AgentDraftPreviewInput,type AgentDraftPreviewRequest,type AgentDraftPreviewStatus,type AgentDraftExecutionContext} from './agent-draft-preview-contracts';

export interface AgentDraftPreviewRepository{
 begin(owner:string,input:AgentDraftPreviewInput,context?:AgentDraftExecutionContext|null):Promise<AgentDraftPreviewRequest>;
 resume(owner:string,input:AgentDraftPreviewInput,child:AgentDraftPreviewChildControl):Promise<AgentDraftPreviewRequest>;
 lookup(owner:string,session:string,request:string):Promise<AgentDraftPreviewRequest|null>;
 read(owner:string,session:string):Promise<AgentDraftPreviewRequest[]>;
 finish(owner:string,request:string,status:Exclude<AgentDraftPreviewStatus,'running'>,output:string,error:string|null,continuationId?:string):Promise<void>;
 source(owner:string,agent:string):Promise<void>;
 recover():Promise<void>;
}
export interface AgentDraftPreviewRunner{
 readonly executionUsage?:NativeExecutionUsage;
 continueChild?(user:Identity,request:AgentDraftPreviewRequest,child:AgentDraftPreviewChildControl,signal:AbortSignal,validate:()=>Promise<void>,scope:{sourceAgentId:string|null}):Promise<string>;
 stopScope?(filter:PreviewScopeFilter):Promise<void>;
 prepare?(user:Identity,input:AgentDraftPreviewInput,signal:AbortSignal,validate:()=>Promise<void>):Promise<AgentDraftExecutionContext|null>;
 run(user:Identity,request:AgentDraftPreviewRequest,history:AgentDraftPreviewRequest[],signal:AbortSignal,validate:()=>Promise<void>,scope?:{sourceAgentId:string|null}):Promise<string>;
 stopOwner(owner:string):Promise<void>;
 recover():Promise<void>;
 close():Promise<void>;
}
export type PreviewRemoteSource=Pick<ToolSource,'id'|'plugin'>;
type Running={owner:string;input:AgentDraftPreviewInput;child?:AgentDraftPreviewChildControl;controller:AbortController;accepted:Promise<AgentDraftPreviewRequest>;done:Promise<void>;remoteSources?:PreviewRemoteSource[]};
export type PreviewScopeFilter={owner?:string;sessionId?:string;sourceAgentId?:string;creationId?:string;creationOnly?:boolean;provider?:AgentDraftPreviewInput['snapshot']['provider'];fileId?:string;pluginAgentIds?:string[];remoteOnly?:boolean;remoteConnectionId?:string;remotePlugin?:string;creationSkillPlugin?:string};
export function matchesPreviewPluginScope(source:string|null|undefined,permission:string|undefined,filter:PreviewScopeFilter,skills?:string[],discovery=false){return filter.pluginAgentIds===undefined||!!source&&filter.pluginAgentIds.includes(source)&&((permission??'chat')!=='chat'||!!skills?.length||discovery);}
export function matchesPreviewCreationSkills(creation:string|null|undefined,execution:AgentDraftPreviewInput['snapshot']['execution'],filter:PreviewScopeFilter,discovery=false){return !filter.creationSkillPlugin||!!creation&&(discovery||(execution?.permission??'chat')!=='chat'||!!execution?.skills?.some(skill=>skill.startsWith('agentopia-plugin:'+filter.creationSkillPlugin+':')));}
export function matchesPreviewRemoteScope(source:string|null|undefined,execution:AgentDraftPreviewInput['snapshot']['execution'],filter:PreviewScopeFilter,accepted?:PreviewRemoteSource[],creationId?:string|null){
 if(!filter.remoteOnly&&!filter.remoteConnectionId&&!filter.remotePlugin)return true;
 if((!source&&!creationId)||!['ask','full'].includes(execution?.permission??'chat'))return false;
 if(accepted!==undefined)return accepted.some(row=>(!filter.remoteConnectionId||row.id===filter.remoteConnectionId)&&(!filter.remotePlugin||row.plugin===filter.remotePlugin));
 return execution?.tools?.length!==0&&(!filter.remoteConnectionId||execution?.tools===undefined||execution.tools.includes(filter.remoteConnectionId));
}
function matches(row:Running,filter:PreviewScopeFilter){return (!filter.creationOnly||!!row.input.creationId)&&(!filter.owner||row.owner===filter.owner)&&(!filter.sessionId||row.input.sessionId===filter.sessionId)&&(!filter.creationId||row.input.creationId===filter.creationId)&&(!filter.sourceAgentId||row.input.sourceAgentId===filter.sourceAgentId)&&(!filter.provider||row.input.snapshot.provider===filter.provider)&&(!filter.fileId||row.input.snapshot.execution?.files.includes(filter.fileId)===true)&&matchesPreviewPluginScope(row.input.sourceAgentId,row.input.snapshot.execution?.permission,filter,row.input.snapshot.execution?.skills)&&matchesPreviewCreationSkills(row.input.creationId,row.input.snapshot.execution,filter)&&matchesPreviewRemoteScope(row.input.sourceAgentId,row.input.snapshot.execution,filter,row.remoteSources,row.input.creationId);}

/** Reserve before asynchronous reads; a duplicate accepted request never starts inference twice. */
export class AgentDraftPreviews{
 private active=new Map<string,Running>();private closing=false;
 constructor(private store:AgentDraftPreviewRepository,private runner:AgentDraftPreviewRunner,private guard:(owner:string,input?:AgentDraftPreviewInput)=>Promise<void>,private catalog:(owner:string,provider:AgentDraftPreviewInput['snapshot']['provider'],input?:AgentDraftPreviewInput)=>Promise<Model[]>,private available:(user:Identity,input:AgentDraftPreviewInput)=>boolean,private changed:(owner:string,request:AgentDraftPreviewRequest)=>void,private released:(owner:string)=>void=()=>{}){}
 get busy(){return this.active.size>0;}
 get activeCount(){return this.active.size;}
 get activeRequests(){return [...this.active.values()].map(row=>({owner:row.owner,requestId:row.input.requestId,sessionId:row.input.sessionId,cancelling:row.controller.signal.aborted}));}
 get executionUsage(){return this.runner.executionUsage??{requests:[],other:0};}
 owns(owner:string,request:string){return [...this.active.values()].some(row=>row.owner===owner&&row.input.requestId===request);}
 remoteSources(owner:string,session:string,request:string){const row=this.active.get(owner+':'+session);return row?.input.requestId===request&&row.remoteSources!==undefined?structuredClone(row.remoteSources):undefined;}
 async start(user:Identity,value:unknown):Promise<AgentDraftPreviewRequest>{return this.submit(user,value);}
 async continueChild(user:Identity,value:unknown,control:unknown):Promise<AgentDraftPreviewRequest>{return this.submit(user,value,draftPreviewChildControl(control));}
 private async submit(user:Identity,value:unknown,child?:AgentDraftPreviewChildControl):Promise<AgentDraftPreviewRequest>{
  const input=agentDraftPreviewInput(value),key=user.id+':'+input.sessionId,prior=this.active.get(key);
  if(prior){if(prior.input.requestId!==input.requestId)throw Error('This draft preview is already working. Stop it or wait for its result.');if(JSON.stringify(prior.input)!==JSON.stringify(input)||JSON.stringify(prior.child)!==JSON.stringify(child))throw Error('This preview request identifier was already used with different instructions or text.');return {...await prior.accepted,existing:true};}
  if(this.closing||!this.available(user,input))throw Error('Wait until Agentopia has a free execution slot before testing the draft.');
  const controller=new AbortController();let accept!:(row:AgentDraftPreviewRequest)=>void,refuse!:(error:unknown)=>void;
  const accepted=new Promise<AgentDraftPreviewRequest>((resolve,reject)=>{accept=resolve;refuse=reject;});void accepted.catch(()=>{});
  const entry:Running={owner:user.id,input,child,controller,accepted,done:Promise.resolve()};this.active.set(key,entry);
  const validate=async()=>{controller.signal.throwIfAborted();await this.guard(user.id,input);if(this.closing||this.active.get(key)!==entry)throw Error('This draft preview session closed.');if(input.sourceAgentId)await this.store.source(user.id,input.sourceAgentId);controller.signal.throwIfAborted();};
  entry.done=(async()=>{
   let request:AgentDraftPreviewRequest|undefined;
   try{
    await validate();const prior=await this.store.lookup(user.id,input.sessionId,input.requestId);await validate();
    if(child&&(!prior||JSON.stringify(previewContinuationInput(prior,input.sourceAgentId))!==JSON.stringify(input)))throw Error('The retained preview identity, original instructions or text changed.');
    let context=prior?.execution_context??null;
    if(!prior||child){const model=(await this.catalog(user.id,input.snapshot.provider,input)).find(row=>row.id===input.snapshot.model);if(!model)throw Error('Choose a model available to your connected account.');validateThinking(model,input.snapshot.thinking);await validate();if(!child)context=await this.runner.prepare?.(user,input,controller.signal,validate)??null;await validate();if(context?.definitions.length&&model.supportsTools===false)throw Error('Choose a model that supports tool calls before testing this draft with tools.');if(model.inputModalities&&!model.inputModalities.includes('image')&&(context?.inputFiles.some(file=>file.image||file.pageImages?.length)||context?.definitions.some(tool=>tool.name==='computer_windows')))throw Error('This model cannot read images. Choose an image-capable model before sending.');}
    entry.remoteSources=context?.remoteTools?.sources.map(({id,plugin})=>({id,...(plugin?{plugin}:{})}))??[];await validate();
    if(child&&!this.runner.continueChild)throw Error('Retained child continuation is unavailable.');
    request=child?await this.store.resume(user.id,input,child):await this.store.begin(user.id,input,context);accept(structuredClone(request));if(request.existing)return;
    this.changed(user.id,structuredClone(request));await validate();const history=child?[]:await this.store.read(user.id,input.sessionId);await validate();
    const output=child?await this.runner.continueChild!(user,request,child,controller.signal,validate,{sourceAgentId:input.sourceAgentId}):await this.runner.run(user,request,history,controller.signal,validate,{sourceAgentId:input.sourceAgentId});controller.signal.throwIfAborted();if(typeof output!=='string'||output.length>2*1024*1024)throw Error('The preview response exceeded its local size limit.');
    await this.store.finish(user.id,request.id,'completed',output,null,child?.id);this.changed(user.id,{...request,status:'completed',output_text:output});
   }catch(error){
    refuse(error);if(request&&!request.existing){const status=controller.signal.aborted?'cancelled':'failed',message=status==='cancelled'?null:error instanceof Error?error.message:String(error);await this.store.finish(user.id,request.id,status,'',message,child?.id);this.changed(user.id,{...request,status,error:message});}
   }finally{if(this.active.get(key)===entry){this.active.delete(key);this.released(user.id);}}
  })();void entry.done.catch(()=>{});return accepted;
 }
 async read(owner:string,session:string){await this.guard(owner);return this.store.read(owner,draftPreviewId(session));}
 async inspect(owner:string,session:string,preparing:()=>boolean=()=>false){session=draftPreviewId(session);await this.guard(owner);const rows=await this.store.read(owner,session);await this.guard(owner);for(const row of rows)if(row.status==='running'&&!preparing()&&!this.owns(owner,row.id)&&!this.executionUsage.requests.includes(row.id)){await this.store.finish(owner,row.id,'interrupted','', 'The preview is no longer executing. Its acceptance or result was not acknowledged. Inspect the saved activity and affected files before submitting a new message.');}return this.store.read(owner,session);}
 async stopLocally(owner:string,session:string){session=draftPreviewId(session);const running=this.active.get(owner+':'+session);if(!running||running.owner!==owner)throw Error('This preview is no longer running in your account.');running.controller.abort();await this.runner.stopScope?.({owner,sessionId:session});await Promise.allSettled([running.done]);}
 async stop(owner:string,session:string){await this.guard(owner);session=draftPreviewId(session);this.active.get(owner+':'+session)?.controller.abort();await this.runner.stopScope?.({owner,sessionId:session});}
 async stopScope(filter:PreviewScopeFilter){const rows=[...this.active.values()].filter(row=>matches(row,filter));for(const row of rows)row.controller.abort();try{await this.runner.stopScope?.(filter);}finally{await Promise.all(rows.map(row=>row.done));}}
 async stopOwner(owner:string){const rows=[...this.active.values()].filter(row=>row.owner===owner);for(const row of rows)row.controller.abort();try{await this.runner.stopOwner(owner);}finally{await Promise.all(rows.map(row=>row.done));}}
 async recover(){if(this.busy)throw Error('Finish draft previews before startup recovery.');await this.runner.recover();await this.store.recover();}
 async close(){this.closing=true;await Promise.all([...new Set([...this.active.values()].map(row=>row.owner))].map(owner=>this.stopOwner(owner)));await this.runner.close();}
}

function checked(result:any){if(result.error)throw Error(result.error.message);return result.data;}
export class PostgresAgentDraftPreviews implements AgentDraftPreviewRepository{
 constructor(private db:SupabaseClient){}
 async resume(owner:string,input:AgentDraftPreviewInput,control:AgentDraftPreviewChildControl){
  const row=await this.lookup(owner,input.sessionId,input.requestId),session=checked(await this.db.from('desktop_preview_sessions').select('source_agent_id,creation_id').eq('id',input.sessionId).eq('user_id',owner).single());
  if(!row||row.user_id!==owner||session.source_agent_id!==input.sourceAgentId||(session.creation_id??null)!==(input.creationId??null)||JSON.stringify(previewContinuationInput(row,session.source_agent_id))!==JSON.stringify(input))throw Error('The retained preview identity or original configuration changed.');
  const saved=checked(await this.db.from(draftPreviewTables.turns).select('state,updated_at').eq('request_id',row.id).eq('user_id',owner).single()),child=(saved.state as import('./native-contracts').NativeState).children?.find(child=>child.threadId===control.threadId);if(!child)throw Error('This child does not belong to the retained preview.');
  const intent=(saved.state as import('./native-contracts').NativeState).previewContinuations?.find(message=>message.id===control.id);if(intent){if(intent.threadId!==control.threadId||intent.turnId!==control.turnId||intent.action!==control.action||intent.text!==control.text)throw Error('This child continuation identifier already has different instructions.');return {...row,native:saved.state,existing:true};}
  const acknowledged=control.action==='send'&&child.state.steering.find(message=>message.id===control.id);if(acknowledged){if(acknowledged.text!==control.text)throw Error('This child message identifier already has different text.');return {...row,native:saved.state,existing:true};}
  if(row.status==='running')throw Error('This preview is already working. Stop it or wait for completion.');if(child.turnId!==control.turnId)throw Error('The child moved to a different turn. Refresh its controls.');if(child.status==='running')throw Error('Inspect this unfinished preview before continuing its child.');
  if(control.action==='retry-report'&&(child.status==='interrupted'||child.delivery!=='failed'))throw Error('There is no failed report to retry. Resume an interrupted child with a new instruction.');if(!row.updated_at||!saved.updated_at)throw Error('The retained preview revision is unavailable. Refresh its history.');
  const result=await this.db.from(draftPreviewTables.requests).update({status:'running',error:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',owner).eq('conversation_id',input.sessionId).eq('status',row.status).eq('updated_at',row.updated_at).select('*').maybeSingle();if(result.error?.code==='23505')throw Error('Another preview response is working. Stop it or wait for its result.');const claimed=checked(result);if(!claimed)throw Error('The preview changed while continuation was preparing. Refresh its history.');
  const state=structuredClone(saved.state) as import('./native-contracts').NativeState;(state.previewContinuations??=[]).push({...control,status:'pending',createdAt:new Date().toISOString()});try{const retained=checked(await this.db.from(draftPreviewTables.turns).update({state,updated_at:new Date().toISOString()}).eq('request_id',row.id).eq('user_id',owner).eq('updated_at',saved.updated_at).select('request_id').maybeSingle());if(!retained)throw Error('The native preview state changed before its follow-up was retained.');}catch(error){checked(await this.db.from(draftPreviewTables.requests).update({status:row.status,error:row.error,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',owner).eq('status','running').eq('updated_at',claimed.updated_at));throw Error('The child instruction was not started because it could not be retained. '+(error as Error).message);}
  return {...claimed,native:state} as AgentDraftPreviewRequest;
 }
 async begin(owner:string,input:AgentDraftPreviewInput,context?:AgentDraftExecutionContext|null){const principal=context?.version===2?context.creationResources:undefined;if((input.creationToolRevision!==undefined||context?.version===2)&&(input.sourceAgentId||input.creationId!==principal?.creationId||input.creationToolRevision!==principal?.revision))throw Error('The preview request identity was reused with a different creation app revision.');return checked(await this.db.rpc(input.creationId?'desktop_begin_creation_preview':'desktop_begin_agent_preview',{p_user:owner,p_session:input.sessionId,p_request:input.requestId,...(input.creationId?{p_creation:input.creationId}:{p_source:input.sourceAgentId}),p_snapshot:input.snapshot,p_text:input.text,p_context:context??null})) as AgentDraftPreviewRequest;}
 async lookup(owner:string,session:string,request:string){return checked(await this.db.from(draftPreviewTables.requests).select('*').eq('id',request).eq('conversation_id',session).eq('user_id',owner).maybeSingle()) as AgentDraftPreviewRequest|null;}
 async read(owner:string,session:string){
  const rows=checked(await this.db.from(draftPreviewTables.requests).select('*').eq('user_id',owner).eq('conversation_id',session).order('created_at').order('id')) as AgentDraftPreviewRequest[];
  for(let offset=0;offset<rows.length;offset+=100){const states=checked(await this.db.from(draftPreviewTables.turns).select('request_id,state').eq('user_id',owner).in('request_id',rows.slice(offset,offset+100).map(row=>row.id))) as Array<{request_id:string;state:import('./native-contracts').NativeState}>;for(const state of states){const row=rows.find(row=>row.id===state.request_id);if(row){row.native=state.state;if(!row.output_text)row.output_text=draftPreviewOutput(state.state);}}}
  if(rows.length)for(let offset=0;;offset+=100){const tools=checked(await this.db.from('desktop_preview_tool_calls').select('*').eq('user_id',owner).eq('conversation_id',session).order('created_at').order('id').range(offset,offset+99)) as import('./tool-contracts').ToolActivity[];for(const tool of tools){const row=rows.find(row=>row.id===tool.request_id);if(row)(row.tools??=[]).push(tool);}if(tools.length<100)break;}
  return rows;
 }
 async finish(owner:string,request:string,status:Exclude<AgentDraftPreviewStatus,'running'>,output:string,error:string|null,continuationId?:string){
  if(!output||continuationId||status==='interrupted'){const saved=checked(await this.db.from(draftPreviewTables.turns).select('state,updated_at').eq('request_id',request).eq('user_id',owner).maybeSingle());if(!output)output=draftPreviewOutput(saved?.state);if(saved?.state.previewContinuations?.length){const state=saved.state as import('./native-contracts').NativeState;let changed=false;state.previewContinuations=state.previewContinuations!.filter(message=>{if(message.id!==continuationId&&!(status==='interrupted'&&message.status==='pending'))return true;changed=true;const acknowledged=message.action==='send'&&state.children?.find(child=>child.threadId===message.threadId)?.state.steering.some(steering=>steering.id===message.id&&steering.text===message.text);if(acknowledged)return false;message.status=status;message.error=error;return true;});if(changed){const retained=checked(await this.db.from(draftPreviewTables.turns).update({state,updated_at:new Date().toISOString()}).eq('request_id',request).eq('user_id',owner).eq('updated_at',saved.updated_at).select('request_id').maybeSingle());if(!retained)throw Error('The retained child instruction changed during outcome storage. Inspect its saved activity.');}}}

  const saved=checked(await this.db.from(draftPreviewTables.requests).update({status,output_text:output,error,updated_at:new Date().toISOString()}).eq('id',request).eq('user_id',owner).eq('status','running').select('id').maybeSingle());if(!saved)throw Error('The preview outcome could not be updated. Inspect its saved result before sending another test.');
 }
 async source(owner:string,agent:string){checked(await this.db.from('agents').select('id').eq('id',agent).eq('user_id',owner).eq('active',true).single());}
 async recover(){checked(await this.db.from('desktop_preview_tool_calls').update({status:'interrupted',error:'Agentopia restarted during this preview tool. Inspect its saved activity and files before sending a new test.',updated_at:new Date().toISOString()}).in('status',['running','awaiting_approval']));checked(await this.db.from('desktop_preview_requests').update({status:'interrupted',error:'Agentopia restarted during this preview. Inspect its saved activity before sending a new test message.',updated_at:new Date().toISOString()}).eq('status','running'));}
}
