import {Plugins} from './plugins';
import type {ToolDefinition} from './tool-contracts';
import type {PluginPrincipal} from './plugin-resource-principal';
import {CreationToolResources} from './creation-tool-resources';
import {toolActivityTable,toolRequestTable,resolvePreviewToolScope,type ToolExecutionKind,type PreviewToolScope} from './tool-execution-scope';
import {PluginFiles,pluginFileTools,type PluginFileBinding} from './plugin-files';
import type {ImageGenerationService} from './image-generation-service';
import {imageGenerationToolName} from './image-generation-contracts';
import type {WorkspaceEditor} from './workspace-editor';
import {ComputerService} from './computer-service';
import {computerDefinitions} from './computer-definitions';
import {previewWorkspaceSkillTools,readPreviewWorkspaceSkill} from './preview-workspace-skills';
import {previewWorkspaceSkillDefinitions} from './preview-workspace-skills';
import {resolveChatWorkspaceSkillScope,type ChatWorkspaceSkillScope} from './chat-workspace-skills';
import {computerToolNames} from './computer-contracts';
import {chromeConnectionId} from './chrome-contracts';
import {AgentBrowser,browserDefinitions,browserToolNames} from './agent-browser';
import {sessionToolNames} from './interactive-terminal';
import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {WorkspaceTools,workspaceDefinitions} from './workspace-tools';
import type {ChatOptions,ChatEvent,Identity} from './contracts';
import type {ProviderCall,ToolActivity} from './tool-contracts';
import {RemoteTools,type RemotePlan} from './remote-tools';
import {Planning} from './planning';
import type {Terminal} from './terminal';
import {validateCommand} from './terminal-runner';
import type {Secrets} from './secrets';
import type {FileOperations} from './file-operations';
import {ProjectMemory,projectMemoryTools} from './project-memory';
import {AgentService} from './agent-service';
import {ChatInspection,chatInspectionTools} from './chat-inspection';
import {ChatDeliveryService,chatDeliveryReceipt,type ChatDelivery} from './chat-delivery';
import {agentToolNames} from './agent-contracts';
import {agentDocumentTools,type AgentDocuments} from './agent-documents';
import {allowsAgentTool} from './agent-policy';
import {scheduledToolNames,scheduledMutationNames,type ScheduledTaskTools} from './scheduled-task-tools';
function data(result:any):any{if(result.error)throw new Error(result.error.message);return result.data;}
export class ToolService{
 availableDefinitions(owner:string,agent:PluginPrincipal|undefined,definitions:ToolDefinition[]){return new Plugins(this.db).availableDefinitions(owner,agent,definitions);}
 hostEnabled(owner:string,agent:PluginPrincipal|undefined,family:import('./host-plugin-contracts').HostPluginFamily){return new Plugins(this.db).hostEnabled(owner,agent,family);}
 async assertCreationActive(owner:string,creationId:string){await new CreationToolResources(this.db).active(owner,creationId);}
 validateExecution?:(user:Identity,request:any)=>Promise<void>;
 images?:ImageGenerationService;
 imageDefinitions(owner:string,agent:string|undefined,options:ChatOptions){return this.images?.definitions(owner,agent,options)??Promise.resolve([]);}
 scheduled?:ScheduledTaskTools;
 scheduleDefinitions(options:ChatOptions){return this.scheduled?.definitions(options)??[];}
 browser?:AgentBrowser;
 computer?:ComputerService;
 computerDefinitions(user:Identity,options:ChatOptions){return this.computer?computerDefinitions(user,options):[];}
 revokeComputer(owner:string,id:string){this.computer?.revoke(owner,id);for(const pending of [...this.approvals.values()])if(pending.user===owner&&pending.name==='computer'&&pending.reference===id)pending.resolve(false);}
 async stopComputer(owner?:string){await this.computer?.stop(owner);for(const pending of [...this.approvals.values()])if(pending.name==='computer'&&(!owner||pending.user===owner))pending.resolve(false);}
 browserDefinitions(options:ChatOptions){return this.browser?browserDefinitions(options):[];}
 pluginDefinitions(owner:string,agent:PluginPrincipal|undefined,options:ChatOptions){return this.pluginFiles?.definitions(owner,agent,options)??Promise.resolve([]);}
 pluginFileBinding(owner:string,agent:PluginPrincipal){return this.pluginFiles?.capture(owner,agent);}
 async validatePluginFiles(binding:PluginFileBinding){if(!this.pluginFiles)throw Error('Plugin file access is unavailable.');await this.pluginFiles.validate(binding);}
 async validatePluginSkills(binding:PluginFileBinding,selected:string[]){if(!this.pluginFiles)throw Error('Plugin skill access is unavailable.');await this.pluginFiles.validateSkills(binding,selected);}
 readonly planning:Planning;
 readonly memory:ProjectMemory;
 readonly chats:ChatInspection;
 readonly deliveries:ChatDeliveryService;
 deliverChat?:(owner:string,delivery:ChatDelivery,signal:AbortSignal)=>Promise<unknown>;
 deliveryDefinitions(options:ChatOptions){return this.deliverChat?this.deliveries.definitions(options):[];}
 readonly agents:AgentService;
 agentDocuments?:AgentDocuments;
 private approvals=new Map<string,{user:string;kind?:ToolExecutionKind;name?:string;reference?:string;resolve:(approved:boolean)=>void;cancel:()=>void}>();
 constructor(private db:SupabaseClient,readonly workspace:WorkspaceTools,private emit:(owner:string,event:ChatEvent)=>void,private identity:()=>Promise<Identity>,readonly remote?:RemoteTools,secrets?:Secrets,readonly terminal?:Terminal,readonly fileOperations?:FileOperations,private editor?:WorkspaceEditor,private pluginFiles?:PluginFiles){this.planning=new Planning(db,secrets);this.memory=new ProjectMemory(db);this.chats=new ChatInspection(db);this.deliveries=new ChatDeliveryService(db);this.agents=new AgentService(db);}
 async authorizeExecution(owner:string,options:ChatOptions){const current=await this.identity();if(current.id!==owner)throw new Error('Your Agentopia account changed.');if(options.permission==='full'){if(!current.admin)throw Error('Full access is unavailable for this account.');this.terminal?.authorize(current,true);}return current;}
 async list(user:string,conversation:string,kind:ToolExecutionKind='chat'){return data(await this.db.from(toolActivityTable(kind)).select('id,native_thread_id,request_id,conversation_id,assistant_message_id,name,label,status,arguments,result,preview,approval,error,created_at').eq('user_id',user).eq('conversation_id',conversation).order('created_at',{ascending:true}));}
 async decide(user:string,id:string,approved:boolean,rememberChatPair=false){
  const pending=this.approvals.get(id);
  const row=data(await this.db.from(toolActivityTable(pending?.kind)).select('id,status').eq('id',id).eq('user_id',user).single());
  if(row.status!=='awaiting_approval'||pending?.user!==user)throw new Error('This approval is no longer active. Reopen the conversation to inspect the saved result.');
  if(rememberChatPair&&(!approved||pending.name!=='chat-delivery'))throw new Error('Pair authorization applies only to an approved chat coordination review.');
  if(pending.name==='chat-delivery'){
   await this.deliveries.authorize(user,pending.reference!,approved?rememberChatPair?'pair':'once':'deny');
   if(this.approvals.get(id)!==pending)throw new Error('This review ended while the decision was saved. Inspect its queued message before continuing.');
  }
  this.approvals.delete(id);pending.resolve(approved);
 }
 async decideDelivery(user:string,deliveryId:string,decision:'once'|'pair'|'deny'){
  const entry=[...this.approvals].find(([,pending])=>pending.user===user&&pending.name==='chat-delivery'&&pending.reference===deliveryId);
  if(!entry)return false;await this.decide(user,entry[0],decision!=='deny',decision==='pair');return true;
 }
 async revert(user:string,id:string,kind:ToolExecutionKind='chat'){
  const row=data(await this.db.from(toolActivityTable(kind)).select('*').eq('id',id).eq('user_id',user).eq('status','completed').single()) as ToolActivity;
  const request=data(await this.db.from(toolRequestTable(kind)).select('status').eq('id',row.request_id).eq('user_id',user).single());if(request.status==='running')throw new Error('Wait for this response to finish before undoing a file change.');
  if(row.name==='manage_file'&&this.fileOperations&&typeof (row.result as any)?.operation_id==='string')return this.fileOperations.restore(user,(row.result as any).operation_id,async()=>{if((await this.identity()).id!==user)throw new Error('Your Agentopia account changed.');});
  if(!row.preview||row.name!=='write_file')throw new Error('This activity has no completed file change to undo.');
  const task=()=>this.workspace.revert(user,row.preview!,async()=>{if((await this.identity()).id!==user)throw new Error('Your Agentopia account changed.');});const result=this.editor?await this.editor.fileOperation(user,[row.preview.path],task):await task();data(await this.db.from(toolActivityTable(kind)).update({status:'reverted',result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user));
  this.emit(user,{...(kind==='agent-draft-preview'?{scope:kind}:{}),kind:'tool',requestId:row.request_id,conversationId:row.conversation_id,tool:{...row,status:'reverted',result}});return result;
 }
 private awaitApproval(user:string,id:string,signal:AbortSignal,name?:string,reference?:string,kind:ToolExecutionKind='chat'){
  signal.throwIfAborted();return new Promise<boolean>((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);this.approvals.delete(id);signal.removeEventListener('abort',abort);};
   const abort=()=>{cleanup();reject(signal.reason??new DOMException('Cancelled','AbortError'));};
   const timer=setTimeout(()=>{cleanup();reject(new Error('This tool approval expired. Start a fresh request when ready.'));},15*60*1000);
   this.approvals.set(id,{user,kind,name,reference,resolve:value=>{cleanup();resolve(value);},cancel:abort});signal.addEventListener('abort',abort,{once:true});
  });
 }
 async execute(user:Identity,request:any,call:ProviderCall,options:ChatOptions,signal:AbortSignal,plan?:RemotePlan,agentId?:string,nativeThreadId?:string,previewScope?:PreviewToolScope,chatSkillScope?:ChatWorkspaceSkillScope){
  if(previewScope&&chatSkillScope)throw Error('Choose one tool execution scope.');const execution=previewScope?resolvePreviewToolScope(previewScope,user,request,options):undefined,chatSkills=chatSkillScope?resolveChatWorkspaceSkillScope(chatSkillScope,user,request,options):undefined,activityTable=toolActivityTable(execution?.kind);
  const remotePrincipal=execution?execution.remotePrincipal:agentId;if(execution){plan=execution.remotePlan;agentId=execution.remoteTools?.agentId;}
  const validateScope=async()=>{signal.throwIfAborted();if(execution)await execution.validate();else{await this.validateExecution?.(user,request);await chatSkills?.validate();}await this.authorizeExecution(user.id,options);await new Plugins(this.db).assertHostTool(user.id,execution?.resourceCreation??execution?.resourceAgentId??agentId??request.agent_id,call.name);signal.throwIfAborted();};await validateScope();
  const review=(id:string,name?:string,reference?:string)=>this.awaitApproval(user.id,id,signal,name,reference,execution?.kind);
  signal.throwIfAborted();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');
  const reviewRequired=options.permission!=='full';
  if(!reviewRequired){const current=await this.identity();if(!current.admin)throw Error('Full access is unavailable for this account.');this.terminal?.authorize(current,true);}
  if(!execution&&this.deliverChat)await this.deliveries.validateRequest(user.id,request.id);
  const agentContext=!execution&&request.agent_instance_id?await this.agents.context(user.id,request.id,nativeThreadId):null;
  const short=call.name.replace(/^(workspace|tools|planning)\./,''),external=!!plan?.definitions.some(tool=>tool.name===short),planning=execution?[]:await this.planning.definitions(user.id,request.conversation_id,options),definition=(await this.availableDefinitions(user.id,execution?.resourceCreation??execution?.resourceAgentId??agentContext?.profile.agent_id??agentId??request.agent_id,execution?.definitions??[...this.computerDefinitions(user,options),...this.browserDefinitions(options),...workspaceDefinitions(options),...previewWorkspaceSkillDefinitions(chatSkills?.workspaceSkills,options),...await this.pluginDefinitions(user.id,agentContext?.profile.agent_id??agentId??request.agent_id,options),...await this.imageDefinitions(user.id,agentContext?.profile.agent_id??agentId??request.agent_id,options),...(this.terminal?.definitions(user,options)??[]),...(plan?.definitions??[]),...planning,...this.memory.definitions(request,options),...this.chats.definitions(options),...(this.agentDocuments?.definitions(options)??[]),...this.deliveryDefinitions(options),...this.scheduleDefinitions(options),...(agentContext?this.agents.definitions(agentContext.profile,options):[])])).find(tool=>tool.name===short);
  if(definition&&execution&&!allowsAgentTool(execution.policy,definition))return {error:'This tool is disabled by the draft agent policy.'};
  if(definition&&chatSkills&&!allowsAgentTool(chatSkills.policy,definition))return {error:'This tool is disabled by the accepted agent policy.'};
  if(definition&&agentContext&&!allowsAgentTool(agentContext.profile.policy,definition))return {error:'This tool is disabled by the current agent policy.'};
  if(!definition||/^(workspace|tools|planning)\./.test(call.name)&&call.name.split('.')[0]!== (definition.namespace??'workspace')||call.namespace&&call.namespace!==(definition.namespace??'workspace')||external&&(!this.remote||!remotePrincipal))return {error:'This tool is not enabled by the current mode and permissions.'};
  let args:Record<string,unknown>;
  try{args=JSON.parse(call.arguments);if(!args||typeof args!=='object'||Array.isArray(args))throw new Error();const allowed=Object.keys(definition.parameters.properties as object);if(Object.keys(args).some(key=>!allowed.includes(key)))throw new Error();}catch{return {error:'The tool arguments must match the declared object schema.'};}
  if(short===imageGenerationToolName&&this.images){
   const actualAgent=agentContext?.profile.agent_id??agentId??request.agent_id;
   const guard=async()=>{await validateScope();const current=await this.identity();if(current.id!==user.id)throw new Error('Your Agentopia account changed.');if(options.permission==='full')this.terminal?.authorize(current,true);data(await this.db.from('agents').select('id').eq('id',actualAgent).eq('user_id',user.id).eq('active',true).single());if(!execution&&this.deliverChat)await this.deliveries.validateRequest(user.id,request.id);if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);};
   try{return await this.images.execute(args,{owner:user.id,agent:actualAgent,request,callId:call.id,nativeThreadId,options,signal,guard,review:(id)=>reviewRequired?review(id):Promise.resolve(true)});}catch(error){if(signal.aborted)throw error;return {error:(error as Error).message};}
  }
  const chromeTool=short==='mcp_call'&&args.connection_id===chromeConnectionId,browserTool=browserToolNames.includes(short),computerTool=(computerToolNames as readonly string[]).includes(short),deliveryTool=short==='send_message_to_chat',scheduleTool=scheduledToolNames.includes(short),scheduleMutation=scheduledMutationNames.includes(short),workspaceSkillTool=!!chatSkills&&previewWorkspaceSkillTools.includes(short),stableTool=!!execution||workspaceSkillTool||browserTool||chromeTool||computerTool||deliveryTool||scheduleMutation||external&&short!=='mcp_search',hostTool=short==='run_command'||sessionToolNames.includes(short);
  if(stableTool||hostTool||short==='manage_file'){
   try{if(stableTool||short==='manage_file'){}else if(short==='run_command')validateCommand(args.command,args.timeout_ms);else this.terminal!.sessions.validateTool(short,args);}catch(error){return {error:(error as Error).message};}
   if(typeof call.id!=='string'||!call.id||call.id.length>256)return {error:'This operation needs a stable provider tool-call identifier.'};
   let previousQuery=this.db.from(activityTable).select('name,arguments,status,result,error').eq('request_id',request.id).eq('user_id',user.id).eq('arguments->>provider_call_id',call.id);if(!execution)previousQuery=previousQuery.eq('name',short);if(stableTool)previousQuery=nativeThreadId?previousQuery.eq('native_thread_id',nativeThreadId):previousQuery.is('native_thread_id',null);const previous=data(await previousQuery.maybeSingle());
   if(previous){const canonical=(value:Record<string,unknown>)=>JSON.stringify(Object.keys(value).filter(k=>k!=='provider_call_id').sort().map(k=>[k,value[k]]));if(execution&&previous.name!==short||(stableTool?previous.arguments.provider_arguments_hash!==createHash('sha256').update(canonical(args)).digest('hex'):canonical(previous.arguments)!==canonical(args)))return {error:'This operation identifier was already used for different arguments. It cannot be reused.'};return previous.result?{...previous.result,duplicate:true}:{error:previous.error??'This operation was already attempted. Inspect its saved activity before retrying.',duplicate:true};}
  }
  const id=randomUUID(),label=previewWorkspaceSkillTools.includes(short)?(short==='list_workspace_skill_files'?'List selected skill files':'Read workspace skill file: '+String(args.path)):short==='diagnose_workspace_access'?'Check Windows write protection':scheduleTool?({list_scheduled_tasks:'List scheduled tasks',read_scheduled_task:'Read scheduled task',save_scheduled_task:'Propose scheduled task',control_scheduled_task:'Change scheduled task'} as Record<string,string>)[short]:computerTool?({computer_windows:'List shared windows',computer_snapshot:'Read shared window',computer_click:'Click shared window',computer_type:'Type in shared window',computer_key:'Send window key',computer_scroll:'Scroll shared window',computer_drag:'Drag in shared window'} as Record<string,string>)[short]:browserTool?({browser_list:'List browser tabs',browser_downloads:'Read browser downloads',browser_open:'Open browser page',browser_restore:'Restore browser tab',browser_close:'Close browser tab',browser_frames:'List embedded browser documents',browser_frame_snapshot:'Read embedded browser document',browser_snapshot:'Read browser page',browser_screenshot:'View browser screenshot',browser_action:'Use browser page',browser_select:'Select browser options',browser_press:'Send browser key',browser_click:'Click browser location',browser_move:'Move browser pointer',browser_drag:'Drag in browser page',browser_scroll:'Scroll browser location',browser_upload_folder:'Attach browser folder',browser_upload:Array.isArray(args.files)&&args.files.length===0?'Clear browser files':'Attach browser files'} as Record<string,string>)[short]:pluginFileTools.includes(short)?(short==='list_plugin_files'?'List plugin skill files':'Read plugin skill file: '+String(args.path)):hostTool?(short==='run_command'?'Run PowerShell: '+String(args.command).slice(0,120):({start_terminal:'Start interactive terminal',write_terminal:'Send terminal input',read_terminal:'Read terminal output',stop_terminal:'Stop terminal session'} as Record<string,string>)[short]):agentDocumentTools.includes(short)?({list_agent_documents:'List agent documents',search_agent_documents:'Search agent documents',read_agent_document:'Read agent document',read_agent_document_pages:'Read agent PDF pages'})[short]:agentToolNames.includes(short)?({list_agents:'List named agents',invoke_agent:'Assign named agent',list_agent_instances:'List agent assignments',read_agent_instance:'Read agent assignment',search_agent_memory:'Search agent memory',read_agent_memory:'Read agent memory',save_agent_memory:'Save agent memory'} as Record<string,string>)[short]:definition.namespace==='planning'?({get_plan:'Read plan',set_plan:'Save proposed plan',update_plan_progress:'Update plan progress'} as Record<string,string>)[short]:deliveryTool?'Message another chat':chatInspectionTools.includes(short)?(short==='list_chats'?'List saved chats':'Read saved chat'):projectMemoryTools.includes(short)?(short==='search_project_chats'?'Search project conversations':'Read project conversation'):external?short==='mcp_search'?'Discover agent tools':short==='web_search'?'Search the web':String(args.tool_name??'MCP tool'):({list_files:'List files',read_file:'Read file',write_file:'Edit file',inspect_path:'Inspect item',manage_file:'Manage item'} as Record<string,string>)[short]+': '+String(args.path||'selected file');
  let row:ToolActivity=data(await this.db.from(activityTable).insert({id,native_thread_id:nativeThreadId,user_id:user.id,request_id:request.id,conversation_id:request.conversation_id,assistant_message_id:request.assistant_message_id,name:short,label,status:'running',arguments:{...(chromeTool||external?{connection_id:args.connection_id,tool_name:args.tool_name,provider_call_id:call.id,provider_arguments_hash:createHash('sha256').update(JSON.stringify(Object.keys(args).sort().map(k=>[k,args[k]]))).digest('hex')}:browserTool||computerTool||deliveryTool||scheduleMutation?{...args,provider_arguments_hash:createHash('sha256').update(JSON.stringify(Object.keys(args).sort().map(k=>[k,args[k]]))).digest('hex'),...(['browser_action','computer_type'].includes(short)?{text:undefined,text_length:String(args.text??'').length}:{}),provider_call_id:call.id}:hostTool||short==='manage_file'?{...args,provider_call_id:call.id}:short==='mcp_call'?{connection_id:args.connection_id,tool_name:args.tool_name}:short==='write_file'?{reference_id:args.reference_id,path:args.path,reason:args.reason,expected_hash:args.expected_hash}:args),...(nativeThreadId||execution||workspaceSkillTool?{provider_call_id:call.id}:{}),...(execution||workspaceSkillTool?{provider_arguments_hash:createHash('sha256').update(JSON.stringify(Object.keys(args).sort().map(k=>[k,args[k]]))).digest('hex')}:{})}}).select('id,native_thread_id,request_id,conversation_id,assistant_message_id,name,label,status,arguments,created_at').single());
  if(nativeThreadId)row={...row,native_call_id:call.id};
  const update=async(patch:Partial<ToolActivity>)=>{if(patch.status==='running'){await validateScope();if(!execution&&this.deliverChat)await this.deliveries.validateRequest(user.id,request.id);if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);}data(await this.db.from(activityTable).update({...patch,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id));row={...row,...patch};this.emit(user.id,{...(execution?{scope:execution.kind}:{}),kind:'tool',requestId:request.id,conversationId:request.conversation_id,tool:row});};
  this.emit(user.id,{...(execution?{scope:execution.kind}:{}),kind:'tool',requestId:request.id,conversationId:request.conversation_id,tool:row});
  let result:unknown,fileOperationId:string|undefined;
  try{
   if(scheduleTool){
    const guard=async()=>{await validateScope();if((await this.identity()).id!==user.id)throw Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);if(!execution&&this.deliverChat)await this.deliveries.validateRequest(user.id,request.id);};
    const scope={...request,agent_id:agentContext?.profile.agent_id??agentId??request.agent_id};
    if(!scheduleMutation)result=await this.scheduled!.read(user,scope,options,short,args,guard);
    else{
     const proposal=await this.scheduled!.propose(user,scope,options,short,args,(nativeThreadId??'')+':'+call.id,guard);
     if(reviewRequired){
     const approved=review(id,'schedule');approved.catch(()=>{});await update({status:'awaiting_approval',label:proposal.approval.tool+': '+proposal.approval.schedule!.name,approval:proposal.approval});
     if(!await approved){const denied={denied:true,message:'The user declined this schedule change. No future work was authorized. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
     }
     await guard();await update({status:'running'});result=await proposal.commit(signal,guard);
    }
   }
   else if(computerTool){
    const guard=async()=>{await validateScope();const current=await this.identity();if(current.id!==user.id||!current.admin)throw new Error('Your computer-use permission changed.');if(!reviewRequired)this.terminal?.authorize(current,true);if(agentId&&!data(await this.db.from('agents').select('id').eq('id',agentId).eq('user_id',user.id).eq('active',true).maybeSingle()))throw new Error('This agent is no longer active.');if(execution){const row=data(await this.db.from('desktop_preview_requests').select('id,status').eq('id',request.id).eq('conversation_id',request.conversation_id).eq('user_id',user.id).maybeSingle());if(!row||row.status!=='running')throw new Error('This preview is no longer active.');}else if(!data(await this.db.from('conversation_sessions').select('conversation_id').eq('conversation_id',request.conversation_id).eq('user_id',user.id).maybeSingle()))throw new Error('This conversation is no longer available.');};
    await this.computer!.indicate(user,options,request.id,args);signal.throwIfAborted();const prepared=await this.computer!.prepare(user,options,short,args,guard);
    if(plan?.denied.has(prepared.key)){this.computer?.finishRequest(user.id,request.id);const denied={denied:true,message:'Computer use for this window was declined. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
    if(prepared.review&&reviewRequired){const approved=review(id,'computer',String(args.window_id));approved.catch(()=>{});await update({status:'awaiting_approval',approval:prepared.approval});if(!await approved){this.computer?.finishRequest(user.id,request.id);plan?.denied.add(prepared.key);const denied={denied:true,message:'This computer input was declined or its window access was revoked. Do not retry it.'};await update({status:'denied',result:denied});return denied;}}
    await guard();await update({status:'running'});result=await prepared.run(signal);signal.throwIfAborted();
   }
   else if(browserTool){
    const guard=async()=>{await validateScope();const current=await this.identity();if(current.id!==user.id)throw new Error('Your Agentopia account changed.');if(options.permission==='full')this.terminal?.authorize(current,true);if(agentId&&!data(await this.db.from('agents').select('id').eq('id',agentId).eq('user_id',user.id).eq('active',true).maybeSingle()))throw new Error('This agent is no longer active.');if(execution){const row=data(await this.db.from('desktop_preview_requests').select('id,status').eq('id',request.id).eq('conversation_id',request.conversation_id).eq('user_id',user.id).maybeSingle());if(!row||row.status!=='running')throw Error('This preview is no longer active.');}else if(!data(await this.db.from('conversation_sessions').select('conversation_id').eq('conversation_id',request.conversation_id).eq('user_id',user.id).maybeSingle()))throw new Error('This conversation is no longer available.');};
    const prepared=await this.browser!.prepare(user.id,request.conversation_id,short,args,options,signal,guard,file=>this.workspace.browserInput(user.id,options,file,signal),folder=>this.workspace.browserFolder(user.id,options,folder,signal),execution?.kind??'chat');
    if(plan?.denied.has(prepared.key)){const denied={denied:true,message:'This browser operation was declined or interrupted. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
    if(prepared.approval&&reviewRequired){const approved=review(id);approved.catch(()=>{});await update({status:'awaiting_approval',approval:prepared.approval});if(!await approved){plan?.denied.add(prepared.key);const denied={denied:true,message:'The user declined this browser operation. Do not retry it.'};await update({status:'denied',result:denied});return denied;}}
    await guard();await update({status:'running'});result=await prepared.run();signal.throwIfAborted();
   }
   else if(sessionToolNames.includes(short)){
    const prepared=await this.terminal!.sessions.prepare(user,request,options,short,args);if(plan?.denied.has(prepared.key)){const denied={denied:true,message:'This terminal operation was declined or interrupted. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
    if(prepared.review&&options.permission!=='full'){const approved=review(id);approved.catch(()=>{});await update({status:'awaiting_approval',approval:prepared.approval});if(!await approved){plan?.denied.add(prepared.key);const denied={denied:true,message:'The user declined this terminal input. Do not retry it.'};await update({status:'denied',result:denied});return denied;}}
    await validateScope();await this.terminal!.sessions.prepare(user,request,options,short,args);result=await this.terminal!.sessions.execute(user,request,options,short,args,signal,async session=>{await update({status:'running',result:{terminal_session_id:session}});});signal.throwIfAborted();
   }
   else if(short==='run_command'){
    const prepared=await this.terminal!.prepare(user,options,args);
    if(plan?.denied.has(prepared.key)){const denied={denied:true,message:'This command was already declined or interrupted. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
    if(options.permission!=='full'){const approved=review(id);approved.catch(()=>{});await update({status:'awaiting_approval',approval:prepared.approval});if(!await approved){plan?.denied.add(prepared.key);const denied={denied:true,message:'The user declined this Windows command. Do not retry it.'};await update({status:'denied',result:denied});return denied;}}
    await validateScope();const execution=await this.terminal!.start(user,options,args,'agent',{conversationId:request.conversation_id,requestId:request.id,toolId:id},signal,async run=>{await update({status:'running',result:{terminal_run_id:run.id}});});const run=await execution.done;
    result={terminal_run_id:run.id,working_directory:run.cwd,command:run.command,stdout:run.stdout,stderr:run.stderr,exit_code:run.exit_code,status:run.status,truncated:run.truncated,isError:run.status!=='completed',untrusted:true};if(run.status==='cancelled'||run.status==='timed_out')plan?.denied.add(prepared.key);signal.throwIfAborted();
   }
   else if(definition.namespace==='planning'){await validateScope();const saved=await this.planning.execute(user.id,request,short,args);result=saved;if(saved&&short!=='get_plan')this.emit(user.id,{kind:'plan',requestId:request.id,conversationId:request.conversation_id,plan:saved});}
   else if(agentDocumentTools.includes(short)){if(!this.agentDocuments||!request.agent_documents)throw Error('Start a fresh response to use this agent’s assigned documents.');result=await this.agentDocuments.execute(user.id,request.agent_documents,short,args,validateScope,signal);}
   else if(agentToolNames.includes(short)){await validateScope();result=await this.agents.execute(user.id,request,short,args,options,call.id,signal,nativeThreadId);}
   else if(deliveryTool){
    const guard=async()=>{await validateScope();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);};
    let delivery=await this.deliveries.prepare(user.id,request,args,options,call.id,guard,nativeThreadId);
    if(delivery.existing||!['awaiting_authorization','queued'].includes(delivery.status)){result=chatDeliveryReceipt(delivery);await update({status:delivery.status==='denied'||delivery.status==='cancelled'?'denied':'completed',result});return result;}
    try{
     if(delivery.status==='awaiting_authorization'&&!reviewRequired){delivery=await this.deliveries.authorize(user.id,delivery.id,'once');}
     if(delivery.status==='awaiting_authorization'){
      const approved=review(id,'chat-delivery',delivery.id);approved.catch(()=>{});
      await update({status:'awaiting_approval',label:'Message to '+delivery.snapshot.target_title,approval:this.deliveries.approval(delivery)});
      if(!await approved){delivery=await this.deliveries.read(user.id,delivery.id);result=chatDeliveryReceipt(delivery);await update({status:'denied',result});return result;}
      delivery=await this.deliveries.read(user.id,delivery.id);
     }
     if(delivery.status!=='queued')throw new Error('This chat message is no longer authorized for delivery.');
     await guard();await update({status:'running',label:'Message to '+delivery.snapshot.target_title});
     result=await this.deliverChat!(user.id,delivery,signal);
    }catch(error){
     const current=await this.deliveries.read(user.id,delivery.id).catch(()=>null);
     if(current&&!current.existing&&['awaiting_authorization','queued'].includes(current.status))await this.deliveries.change(user.id,delivery.id,'cancel').catch(()=>{});
     throw error;
    }
   }
   else if(chatInspectionTools.includes(short)){result=await this.chats.execute(user.id,request,short,args,options,async()=>{await validateScope();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);},nativeThreadId);}
   else if(projectMemoryTools.includes(short)){result=await this.memory.execute(user.id,request,short,args,options,async()=>{await validateScope();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);},nativeThreadId);}
   else if(external){
    if(short==='mcp_search'){await validateScope();result=await this.remote!.discover(user.id,remotePrincipal!,args,plan!,signal);await validateScope();}
    else{
     const prepared=await this.remote!.prepare(user.id,remotePrincipal!,short,args,plan!,signal,{conversationId:request.conversation_id,validate:async()=>{await validateScope();if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);},readChromeInput:async file=>{await validateScope();return this.workspace.chromeInput(user.id,options,file);}});signal.throwIfAborted();
     if(plan!.denied.has(prepared.key)){const denied={denied:true,message:'This tool was already declined for this response. Do not retry it.'};await update({status:'denied',result:denied});return denied;}
     if(reviewRequired){
     const approved=review(id);approved.catch(()=>{});await update({status:'awaiting_approval',label:prepared.approval.source+' · '+prepared.approval.tool,approval:prepared.approval});
     if(!await approved){plan!.denied.add(prepared.key);const denied={denied:true,message:'The user declined this external operation. Do not retry it unless asked.'};await update({status:'denied',result:denied});return denied;}
     }
     await validateScope();signal.throwIfAborted();const current=await this.identity();if(current.id!==user.id)throw new Error('Your Agentopia account changed.');if(!reviewRequired)this.terminal?.authorize(current,true);await update({status:'running'});result=await prepared.run(signal);await validateScope();
    }
   }
    else if(previewWorkspaceSkillTools.includes(short)){const workspaceSkills=execution?.workspaceSkills??chatSkills?.workspaceSkills;if(!workspaceSkills||workspaceSkills.owner!==user.id)throw Error('The accepted workspace skill context is unavailable.');await validateScope();if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);result=readPreviewWorkspaceSkill(workspaceSkills,short,args);await validateScope();if((await this.identity()).id!==user.id)throw Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);}
    else if(pluginFileTools.includes(short)){result=await this.pluginFiles!.execute(user.id,execution?.resourceCreation??execution?.resourceAgentId??agentContext?.profile.agent_id??agentId??request.agent_id,short,args,options,async()=>{await validateScope();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);});}
   else if(short==='list_files')result=await this.workspace.list(user.id,options,args);
   else if(short==='read_file')result=await this.workspace.read(user.id,options,args,{signal});
   else if(short==='inspect_path'){
    if(!this.fileOperations)throw new Error('Workspace file management is unavailable.');result=await this.fileOperations.inspect(user.id,String(args.reference_id),String(args.path),async()=>{if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');},signal);
   }
   else if(short==='diagnose_workspace_access'){
    if(!this.terminal)throw Error('Windows workspace diagnostics are unavailable.');
    const guard=async()=>{await validateScope();if((await this.identity()).id!==user.id)throw new Error('Your Agentopia account changed.');if(agentContext)await this.agents.validate(user.id,request.id,agentContext.profile.policy,nativeThreadId);};
    result=await this.workspace.diagnoseWriteFailure(user.id,options,args,(root,allowRelative)=>this.terminal!.diagnoseWorkspaceAccess(root,signal,allowRelative),guard);
   }
   else if(short==='manage_file'){
    if(!this.fileOperations)throw new Error('Workspace file management is unavailable.');
    const guard=async()=>{await validateScope();const current=await this.identity();if(current.id!==user.id)throw new Error('Your Agentopia account changed.');if(options.permission==='full'){if(!this.terminal)throw new Error('Full access is unavailable.');this.terminal.authorize(current,true);}};
    const operation=await this.fileOperations.prepare(user.id,args,guard,{signal,requestId:request.id,toolId:id,options});fileOperationId=operation.id;
    if(operation.status!=='prepared'){const previous=operation.result?{...operation.result,duplicate:true}:{denied:true,message:'This workspace operation was already declined or interrupted for this response. Inspect its saved activity before retrying.'};await update({status:operation.result?'completed':'denied',result:previous});return previous;}
    const preview=this.fileOperations.view(operation),action=({move:'Move or rename item',remove:'Move item to Local Recovery',create_folder:'Create folder'} as const)[preview.action];
    const approval={source:'Workspace',tool:action,arguments:{path:preview.path,...(preview.destination?{destination:preview.destination}:{}),files:preview.files,folders:preview.folders,bytes:preview.bytes,items:preview.sample},description:preview.reason+(preview.action==='remove'?' The item stays in this workspace’s Local Recovery folder until restored.':' Existing destination items are preserved.')};
    if(options.permission!=='full'){const approved=review(id);approved.catch(()=>{});await update({status:'awaiting_approval',label:action+': '+preview.path,approval});if(!await approved){await this.fileOperations.deny(user.id,operation.id);const denied={denied:true,message:'The user declined this workspace operation. Do not retry it for this response.'};await update({status:'denied',result:denied});return denied;}}
    await guard();await update({status:'running',label:action+': '+preview.path,approval,result:{operation_id:operation.id}});result=await this.fileOperations.apply(user.id,operation.id,guard,signal);if(signal.aborted)throw signal.reason;
   }

   else{
    const preview=await this.workspace.preview(user.id,options,args);signal.throwIfAborted();
    // Register before publishing the approval so a fast renderer response cannot be lost.
    if(options.permission==='full'){if(!this.terminal)throw new Error('Full access is unavailable.');this.terminal.authorize(user,true);await update({preview});}else{const approved=review(id);approved.catch(()=>{});
    await update({status:'awaiting_approval',preview});
    if(!await approved){const result={denied:true,message:'The user declined this file change. Do not retry it unless asked.'};await update({status:'denied',result});return result;}}
    signal.throwIfAborted();const current=await this.identity();if(current.id!==user.id)throw new Error('Your Agentopia account changed.');if(options.permission==='full')this.terminal!.authorize(current,true);await update({status:'running'});
    result=await this.workspace.apply(user.id,options,preview,signal,validateScope);
   }
   const toolError=(external||hostTool)&&!!result&&typeof result==='object'&&'isError' in result&&result.isError===true;await update({status:toolError?'failed':'completed',result,...(toolError?{error:short==='run_command'?'The command did not complete successfully. Inspect its exit status and output.':'The external tool reported an error.'}:{})});return result;
  }catch(error){if(computerTool)this.computer?.finishRequest(user.id,request.id);this.approvals.get(id)?.cancel();if(fileOperationId)await this.fileOperations?.interrupt(user.id,fileOperationId).catch(()=>{});if(fileOperationId&&this.fileOperations){const completed=await this.fileOperations.receipt(user.id,fileOperationId).catch(()=>null);if(completed?.result){await update({status:completed.status==='restored'?'reverted':'completed',result:completed.result,error:undefined});if(signal.aborted)throw error;return completed.result;}}const message=signal.aborted?(external?'Tool execution was cancelled. If a remote operation had started, check that service before retrying.':'Tool execution was cancelled.'):(error as Error).message;await update({status:signal.aborted?'interrupted':'failed',error:message,...(result!==undefined?{result}:{})});if(signal.aborted)throw error;return {error:message};}
 }
}
