import {pluginResource} from './plugin-resource-principal';
import {creationResourcePrincipal} from './creation-resource-principal';
import {PreviewRemoteToolBindings,previewRemotePrincipal,type PreviewRemoteTools} from './preview-remote-tools';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {lstat,realpath} from 'node:fs/promises';
import type {Identity,FileReference,ChatOptions} from './contracts';
import type {WorkspaceFiles} from './workspace';
import type {ToolService} from './tool-service';
import {workspaceDefinitions} from './workspace-tools';
import {allowsAgentTool,intersectAgentPolicies} from './agent-policy';
import {previewToolScope,previewScopedToolNames} from './tool-execution-scope';
import {selectedContextFiles} from './selected-context';
import type {PluginFileBinding} from './plugin-files';
import {capturePreviewWorkspaceSkills,validatePreviewWorkspaceSkillSnapshot,previewWorkspaceSkillDefinitions,type PreviewWorkspaceSkills} from './preview-workspace-skills';
import {draftPreviewOptions,type AgentDraftPreviewInput,type AgentDraftExecutionContext,type AgentDraftPreviewRequest,type AgentDraftSnapshot} from './agent-draft-preview-contracts';

export const previewCanonical=(value:unknown)=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const previewDigest=(value:unknown)=>createHash('sha256').update(previewCanonical(value)).digest('hex');
export function previewExecutionIdentity(context:AgentDraftExecutionContext){const {key,inputFiles,...identity}=context;return previewDigest(identity);}
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

/** Captures broker-owned resources before acceptance and reuses the shared executor. */
export class DraftPreviewExecution{
 constructor(private files:WorkspaceFiles,private tools:ToolService){}
 async discoverWorkspaceSkills(user:Identity,options:ChatOptions,signal:AbortSignal,validate:()=>Promise<void>){
  const guard=async()=>{signal.throwIfAborted();await validate();await this.tools.authorizeExecution(user.id,options);};await guard();
  if(options.permission==='chat'&&options.files.length)throw Error('Chat only blocks preview attachments. Remove them or change permissions.');
  const references=options.files.map(id=>{const row=this.files.list(user.id).find(row=>row.id===id);if(!row)throw Error('A selected preview attachment is unavailable for this account.');return structuredClone(row);});
  const roots=await this.roots(user.id,references,signal),snapshot=await capturePreviewWorkspaceSkills(user.id,references,undefined,guard,file=>this.files.checkPath(file));
  const check=async()=>{await guard();if(previewCanonical(options.files.map(id=>this.files.list(user.id).find(row=>row.id===id)))!==previewCanonical(references)||previewCanonical(await this.roots(user.id,references,signal))!==previewCanonical(roots))throw Error('A selected preview resource changed.');const current=await capturePreviewWorkspaceSkills(user.id,references,undefined,guard,file=>this.files.checkPath(file));if(current.key!==snapshot.key)throw Error('Workspace skills changed during discovery. Refresh Skills.');};
  await check();return {snapshot,validate:check};
 }
 private windows(user:Identity,options:ChatOptions){
  if(!options.windows?.length)return;
  if(!user.admin||!['ask','full'].includes(options.permission))throw Error('Computer use requires administrator access and Default permissions or Full access.');
  const references=this.tools.computer?.references(user.id,options.windows);if(!references||references.length!==options.windows.length||references.some((row,index)=>row.id!==options.windows![index]||!row.available))throw Error('A shared window is unavailable or revoked. Select it again before testing the draft.');
 }
 private async capabilities(user:Identity,snapshot:AgentDraftSnapshot,options:ChatOptions,references:FileReference[],pluginFiles?:PluginFileBinding,workspaceSkills?:PreviewWorkspaceSkills,remoteTools?:PreviewRemoteTools){
  const workspaceOptions={...options,files:references.filter(reference=>reference.source!=='clipboard').map(reference=>reference.id)};
  const available=[...this.tools.computerDefinitions(user,options),...this.tools.browserDefinitions(options),...(remoteTools?.definitions??[]),...workspaceDefinitions(workspaceOptions),...previewWorkspaceSkillDefinitions(workspaceSkills,options),...(pluginFiles?await this.tools.pluginDefinitions(pluginFiles.owner,pluginResource(pluginFiles),options):[])].filter(tool=>(previewScopedToolNames as readonly string[]).includes(tool.name)&&(tool.name!=='diagnose_workspace_access'||typeof this.tools.terminal?.diagnoseWorkspaceAccess==='function'));
  const nativeCommands=user.admin&&snapshot.behavior.policy.tools===null&&this.tools.terminal?.permissions?.(user).enabled===true&&['ask','full'].includes(options.permission)&&options.mode!=='plan'&&references.some(reference=>reference.kind==='folder');
  const policy=intersectAgentPolicies(snapshot.behavior.policy,{tools:[...available.map(tool=>(tool.namespace??'workspace')+'.'+tool.name),...(nativeCommands?['workspace.run_command']:[])],delegation:snapshot.behavior.policy.tools===null&&snapshot.behavior.policy.delegation,delegateAgents:[],memory:false,memoryWrite:false,maxDepth:Math.min(2,snapshot.behavior.policy.maxDepth),maxTurns:1});return {policy,definitions:available.filter(tool=>allowsAgentTool(policy,tool))};
 }
 private async roots(owner:string,references:FileReference[],signal:AbortSignal,clipboard?:Map<string,string>){
  return Promise.all(references.map(async reference=>{
   signal.throwIfAborted();
   if(reference.source==='clipboard'){
    // This is a content binding, never a filesystem root or tool grant. Use
    // the exact image read into this message; later guards reread owned bytes.
    const image=clipboard?clipboard.get(reference.id):(await this.files.preview(owner,reference.id)).image;
    signal.throwIfAborted();if(!image)throw Error('The selected pasted image was not captured. Paste it again.');
    return {id:reference.id,path:reference.path,device:'clipboard-image-sha256',inode:previewDigest(image)};
   }
   this.files.checkPath(reference.path);const stat=await lstat(reference.path,{bigint:true});
   if(stat.isSymbolicLink()||(reference.kind==='folder'?!stat.isDirectory():!stat.isFile()||stat.nlink>1n))throw Error('A preview attachment changed or contains a link. Select it again.');
   if(!samePath(await realpath(reference.path),path.resolve(reference.path)))throw Error('A preview attachment path changed. Select it again.');
   const root=reference.kind==='folder'?reference.path:path.dirname(reference.path),rootStat=await lstat(root,{bigint:true});
   if(rootStat.isSymbolicLink()||!rootStat.isDirectory()||!samePath(await realpath(root),path.resolve(root)))throw Error('A preview attachment root changed.');
   return {id:reference.id,path:root,device:String(rootStat.dev),inode:String(rootStat.ino)};
  }));
 }
 async capture(user:Identity,input:AgentDraftPreviewInput,signal:AbortSignal,validate:()=>Promise<void>):Promise<AgentDraftExecutionContext>{
  signal.throwIfAborted();await validate();if(input.creationId)await this.tools.assertCreationActive(user.id,input.creationId);const options=draftPreviewOptions(input.snapshot),current=await this.tools.authorizeExecution(user.id,options);this.windows(current,options);
  if(options.tools?.length&&!input.sourceAgentId&&input.creationToolRevision===undefined)throw Error('Confirm this creation’s app selection before choosing preview connections.');
  if(options.permission==='chat'&&options.files.length)throw Error('Chat only blocks preview attachments. Remove them or change permissions.');
  if(options.permission==='full'){if(!user.admin)throw Error('Full access is unavailable for this account.');if(!this.tools.terminal)throw Error('Full access is unavailable.');this.tools.terminal.authorize(user,true);}
  const creationResources=input.creationToolRevision===undefined?undefined:await this.tools.remote?.creationPrincipal(user.id,input.creationId!,input.creationToolRevision);if(input.creationToolRevision!==undefined&&!creationResources)throw Error('Creation connection execution is unavailable.');
  const references=options.files.map(id=>{const reference=this.files.list(user.id).find(row=>row.id===id);if(!reference)throw Error('A selected preview attachment is unavailable for this account.');return structuredClone(reference);});
  await this.roots(user.id,references.filter(reference=>reference.source!=='clipboard'),signal);
  const clipboard=new Map<string,string>(),inputFiles=[...await this.files.context(user.id,options.files,options.permission,signal,(reference,image)=>clipboard.set(reference.id,image)),...selectedContextFiles(options.sources,user.id,options.permission)];
  const packageSkills=options.skills?.filter(skill=>skill.startsWith('agentopia-plugin:'))??[],workspaceSelections=options.skills?.filter(skill=>!skill.startsWith('agentopia-plugin:'))??[];
  const pluginTarget=creationResources??input.sourceAgentId,pluginFiles=pluginTarget&&(options.permission!=='chat'||packageSkills.length)?await this.tools.pluginFileBinding(user.id,pluginTarget):undefined;
  if(packageSkills.length){if(!pluginFiles)throw Error('Choose a native skill from this agent’s assigned plugins.');await this.tools.validatePluginSkills(pluginFiles,packageSkills);}
  const workspaceSkills=workspaceSelections.length?await capturePreviewWorkspaceSkills(user.id,references,workspaceSelections,async()=>{signal.throwIfAborted();await validate();},file=>this.files.checkPath(file)):undefined;
  const target=creationResources??input.sourceAgentId,remoteTools=target&&this.tools.remote?await new PreviewRemoteToolBindings(this.tools.remote).capture(user.id,target,options,signal,validate):undefined;const roots=await this.roots(user.id,references,signal,clipboard),{policy,definitions}=await this.capabilities(current,input.snapshot,options,references,pluginFiles,workspaceSkills,remoteTools);
  const value={version:creationResources?2 as const:1 as const,...(creationResources?{creationResources}:{}),owner:user.id,options,references,roots,inputFiles,definitions,policy,...(pluginFiles?{pluginFiles}:{}),...(workspaceSkills?{workspaceSkills}:{}),...(remoteTools?{remoteTools}:{})},context={...value,key:previewDigest(value)};
  await this.validate(user,{snapshot:input.snapshot,creation_id:input.creationId??null,execution_context:context} as AgentDraftPreviewRequest,signal,validate);return context;
 }
 async validate(user:Identity,request:AgentDraftPreviewRequest,signal:AbortSignal,validate:()=>Promise<void>){
  signal.throwIfAborted();await validate();if(request.creation_id)await this.tools.assertCreationActive(user.id,request.creation_id);const context=request.execution_context;if(!context)throw Error('This preview execution snapshot is unavailable.');const current=await this.tools.authorizeExecution(user.id,context.options);this.windows(current,context.options);
  const {key,...value}=context;if(![1,2].includes(context.version)||context.owner!==user.id||key!==previewDigest(value)||previewCanonical(context.options)!==previewCanonical(draftPreviewOptions(request.snapshot)))throw Error('The preview execution snapshot changed. Start a fresh preview response.');
  if(context.version===2){const principal=creationResourcePrincipal(context.creationResources);if(principal.creationId!==request.creation_id||context.pluginFiles&&previewCanonical(pluginResource(context.pluginFiles))!==previewCanonical(principal)||context.remoteTools&&context.remoteTools.version!==2)throw Error('The creation preview resource identity changed.');if(!this.tools.remote||previewCanonical(await this.tools.remote.creationPrincipal(user.id,principal.creationId,principal.revision))!==previewCanonical(principal))throw Error('The creation preview resource selection changed.');if(context.remoteTools&&previewCanonical(context.remoteTools.principal)!==previewCanonical(principal))throw Error('The preview connection has a different creation identity.');}else if(context.creationResources||context.pluginFiles?.creation||context.remoteTools?.version===2)throw Error('Creation resources require a versioned creation preview context.');
  if(context.pluginFiles){if(context.pluginFiles.owner!==user.id||context.options.permission==='chat'&&!context.options.skills?.length)throw Error('The preview plugin account or permissions changed.');await this.tools.validatePluginFiles(context.pluginFiles);}
  const packageSkills=context.options.skills?.filter(skill=>skill.startsWith('agentopia-plugin:'))??[],workspaceSelections=context.options.skills?.filter(skill=>!skill.startsWith('agentopia-plugin:'))??[];
  if(packageSkills.length){if(!context.pluginFiles)throw Error('The selected native skill binding is unavailable.');await this.tools.validatePluginSkills(context.pluginFiles,packageSkills);}
  if(workspaceSelections.length){if(!context.workspaceSkills||context.workspaceSkills.owner!==user.id)throw Error('The selected workspace skill binding is unavailable.');validatePreviewWorkspaceSkillSnapshot(context.workspaceSkills);const current=await capturePreviewWorkspaceSkills(user.id,context.references,workspaceSelections,async()=>{signal.throwIfAborted();await validate();},file=>this.files.checkPath(file));if(current.key!==context.workspaceSkills.key)throw Error('A selected workspace skill changed. Refresh Skills before sending.');}else if(context.workspaceSkills)throw Error('This preview has an unexpected workspace skill binding.');
  if(context.remoteTools){if(!this.tools.remote)throw Error('The accepted preview connection service is unavailable.');await new PreviewRemoteToolBindings(this.tools.remote).validate(user.id,previewRemotePrincipal(context.remoteTools),context.options,context.remoteTools,signal,validate);}const capabilities=await this.capabilities(current,request.snapshot,context.options,context.references,context.pluginFiles,context.workspaceSkills,context.remoteTools);if(previewCanonical(capabilities)!==previewCanonical({policy:context.policy,definitions:context.definitions}))throw Error('The preview tool declarations or policy changed. Start a fresh preview response.');
  const references=context.options.files.map(id=>this.files.list(user.id).find(row=>row.id===id));
  if(references.some(row=>!row)||previewCanonical(references)!==previewCanonical(context.references)||previewCanonical(await this.roots(user.id,context.references,signal))!==previewCanonical(context.roots))throw Error('A selected preview resource changed. Select it again before a new response.');
  selectedContextFiles(context.options.sources,user.id,context.options.permission);if(context.options.permission==='full'){if(!user.admin||!this.tools.terminal)throw Error('Full access is unavailable for this account.');this.tools.terminal.authorize(user,true);}await validate();signal.throwIfAborted();
 }
 async frame(user:Identity,request:AgentDraftPreviewRequest,signal:AbortSignal,validate:()=>Promise<void>){
  await this.validate(user,request,signal,validate);const context=structuredClone(request.execution_context!),nativeRequest={id:request.id,agent_id:request.conversation_id,conversation_id:request.conversation_id,user_message_id:request.id,assistant_message_id:request.id+':assistant'};
  const guard=()=>this.validate(user,request,signal,validate),scope=previewToolScope({owner:user.id,request:request.id,conversation:request.conversation_id,options:context.options,policy:context.policy,definitions:context.definitions,resourceAgentId:context.remoteTools?.agentId??context.pluginFiles?.agentId,resourceCreation:context.pluginFiles?.creation,workspaceSkills:context.workspaceSkills,remoteTools:context.remoteTools,validate:guard});
  const pending=new Set<Promise<unknown>>();
  return {...context,nativeCommands:request.snapshot.behavior.policy.tools===null&&context.policy.tools?.includes('workspace.run_command')===true,validate:guard,execute:async(name:string,args:unknown,id:string,toolSignal:AbortSignal,thread?:string)=>{const work=(async()=>{await guard();if(!context.definitions.some(tool=>tool.name===name))throw Error('This tool is not declared for the accepted preview.');return this.tools.execute(user,nativeRequest,{id,name,arguments:JSON.stringify(args)},context.options,toolSignal,undefined,undefined,thread,scope);})();pending.add(work);try{return await work;}finally{pending.delete(work);}},finish:async()=>{await Promise.allSettled([...pending]);this.tools.computer?.finishRequest(user.id,request.id);}};
 }
}
