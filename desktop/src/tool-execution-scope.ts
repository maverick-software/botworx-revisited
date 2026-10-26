import {ownHostTool} from './host-plugin-contracts';
import {creationResourcePrincipal,type CreationResourcePrincipal} from './creation-resource-principal';
import {previewRemotePlan,previewRemotePrincipal,previewRemoteToolNames,type PreviewRemoteTools} from './preview-remote-tools';
import type {RemotePlan} from './remote-tools';
import type {ChatOptions,Identity} from './contracts';
import type {AgentPolicy} from './agent-contracts';
import type {ToolDefinition} from './tool-contracts';
import {browserToolNames,browserDefinitions} from './agent-browser';
import {computerToolNames} from './computer-contracts';
import {previewWorkspaceSkillTools,validatePreviewWorkspaceSkillSnapshot,type PreviewWorkspaceSkills} from './preview-workspace-skills';

export type ToolExecutionKind='chat'|'agent-draft-preview';
export function toolActivityTable(kind:ToolExecutionKind='chat'){
 if(kind==='chat')return 'desktop_tool_calls';
 if(kind==='agent-draft-preview')return 'desktop_preview_tool_calls';
 throw Error('Unknown tool execution scope.');
}
export function toolRequestTable(kind:ToolExecutionKind='chat'){
 toolActivityTable(kind);return kind==='chat'?'desktop_requests':'desktop_preview_requests';
}

// Only families with a complete independent execution path can be declared.
// Add journal/terminal/agent integrations here as their preview scope is built.
export const previewScopedToolNames=['list_files','read_file','write_file','diagnose_workspace_access','list_plugin_files','read_plugin_file','list_workspace_skill_files','read_workspace_skill_file',...computerToolNames,...browserToolNames,...previewRemoteToolNames] as const;
export type PreviewToolScope={readonly kind:'agent-draft-preview'};
type ScopeData={owner:string;request:string;conversation:string;options:string;policy:AgentPolicy;definitions:ToolDefinition[];resourceAgentId?:string;resourceCreation?:CreationResourcePrincipal;workspaceSkills?:PreviewWorkspaceSkills;remoteTools?:PreviewRemoteTools;remotePlan?:RemotePlan;validate:()=>Promise<void>};
const scopes=new WeakMap<PreviewToolScope,ScopeData>();
const canonical=(value:unknown):string=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

/** A broker-created token; serialized interface input can never select storage. */
export function previewToolScope(input:{owner:string;request:string;conversation:string;options:ChatOptions;policy:AgentPolicy;definitions:ToolDefinition[];resourceAgentId?:string;resourceCreation?:CreationResourcePrincipal;workspaceSkills?:PreviewWorkspaceSkills;remoteTools?:PreviewRemoteTools;validate:()=>Promise<void>}):PreviewToolScope{
 if(input.resourceCreation){creationResourcePrincipal(input.resourceCreation);if(input.resourceAgentId||input.remoteTools&&(input.remoteTools.version!==2||canonical(input.remoteTools.principal)!==canonical(input.resourceCreation)))throw Error('The preview creation and skill resource identities changed.');}
 if(input.remoteTools&&input.resourceAgentId&&(input.remoteTools.version!==1||input.remoteTools.agentId!==input.resourceAgentId))throw Error('The preview connection and skill resource identities changed.');
 if(input.workspaceSkills){validatePreviewWorkspaceSkillSnapshot(input.workspaceSkills);if(input.workspaceSkills.owner!==input.owner||input.options.permission==='chat'||input.workspaceSkills.skills.some(skill=>!input.options.files.includes(skill.referenceId)||!input.options.skills?.includes(skill.selection)))throw Error('This workspace skill scope changed.');}
 for(const tool of input.definitions){const plugin=['list_plugin_files','read_plugin_file'].includes(tool.name),remote=previewRemoteToolNames.includes(tool.name),computer=(computerToolNames as readonly string[]).includes(tool.name),browser=browserToolNames.includes(tool.name);if((tool.namespace??'workspace')!==((plugin||remote||computer||browser)?'tools':'workspace')||browser&&!browserDefinitions(input.options).some(row=>canonical(ownHostTool(row))===canonical(tool))||computer&&(!input.options.windows?.length||!['ask','full'].includes(input.options.permission)||input.options.mode==='plan'&&!['computer_windows','computer_snapshot'].includes(tool.name))||remote&&(!input.remoteTools||!input.remoteTools.definitions.some(definition=>canonical(definition)===canonical(tool)))||plugin&&!input.resourceAgentId&&!input.resourceCreation||previewWorkspaceSkillTools.includes(tool.name)&&!input.workspaceSkills||!(previewScopedToolNames as readonly string[]).includes(tool.name))throw Error('Preview execution is not implemented for '+tool.name+'.');}
 if(typeof input.validate!=='function')throw Error('A preview needs an execution guard.');
 const token=Object.freeze({kind:'agent-draft-preview' as const});
 scopes.set(token,{owner:input.owner,request:input.request,conversation:input.conversation,options:canonical(input.options),policy:structuredClone(input.policy),definitions:structuredClone(input.definitions),resourceAgentId:input.resourceAgentId,resourceCreation:input.resourceCreation?structuredClone(input.resourceCreation):undefined,workspaceSkills:input.workspaceSkills?structuredClone(input.workspaceSkills):undefined,remoteTools:input.remoteTools?structuredClone(input.remoteTools):undefined,remotePlan:input.remoteTools?previewRemotePlan(input.owner,previewRemotePrincipal(input.remoteTools),input.options,input.remoteTools):{mode:input.options.mode,sources:[],definitions:[],denied:new Set()},validate:input.validate});return token;
}
export function resolvePreviewToolScope(token:PreviewToolScope,user:Identity,request:any,options:ChatOptions){
 const saved=scopes.get(token);if(!saved)throw Error('This preview execution scope was not created by the broker.');
 const check=()=>{if(user.id!==saved.owner||request.id!==saved.request||request.conversation_id!==saved.conversation||request.assistant_message_id!==saved.request+':assistant'||canonical(options)!==saved.options)throw Error('The preview account, request or permissions changed. Start a fresh preview response.');};
 check();return {kind:token.kind,policy:structuredClone(saved.policy),definitions:structuredClone(saved.definitions),resourceAgentId:saved.resourceAgentId,resourceCreation:saved.resourceCreation?structuredClone(saved.resourceCreation):undefined,workspaceSkills:saved.workspaceSkills?structuredClone(saved.workspaceSkills):undefined,remoteTools:saved.remoteTools?structuredClone(saved.remoteTools):undefined,remotePrincipal:saved.remoteTools?previewRemotePrincipal(saved.remoteTools):undefined,remotePlan:saved.remotePlan?{...saved.remotePlan,sources:structuredClone(saved.remotePlan.sources),definitions:structuredClone(saved.remotePlan.definitions)}:undefined,validate:async()=>{check();await saved.validate();check();}};
}
