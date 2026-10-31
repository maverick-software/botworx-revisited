import {agentInstructionsLimit} from './agent-unified-instructions';
import type {CreationResourcePrincipal} from './creation-resource-principal';
import type {PreviewRemoteTools} from './preview-remote-tools';
import type {NativeState} from './native-contracts';
import type {Provider,Thinking,ChatOptions,FileReference,FileContext} from './contracts';
import type {AgentPolicy} from './agent-contracts';
import type {ToolDefinition,ToolActivity} from './tool-contracts';
import {profileInput} from './agent-contracts';
import {chatOptions} from './composer';
import type {PluginFileBinding} from './plugin-files';
import type {PreviewWorkspaceSkills} from './preview-workspace-skills';
import {builderConfiguration,builderSnapshot,legacyBuilderInstructions,legacyBuilderInstructions83,legacyBuilderInstructions85,type BuilderConfiguration} from './agent-builder';

export type AgentDraftBehavior=Omit<ReturnType<typeof profileInput>,'revision'>;
export type AgentDraftExecution=Omit<ChatOptions,'harness'|'provider'|'model'|'thinking'|'goalId'>;
export type AgentDraftExecutionContext={version:1|2;creationResources?:CreationResourcePrincipal;owner:string;key:string;options:ChatOptions;references:FileReference[];roots:Array<{id:string;path:string;device:string;inode:string}>;inputFiles:FileContext[];definitions:ToolDefinition[];policy:AgentPolicy;pluginFiles?:PluginFileBinding;workspaceSkills?:PreviewWorkspaceSkills;remoteTools?:PreviewRemoteTools};
export type AgentDraftSnapshot={name:string;description:string;instructions:string;personality:string;provider:Provider;model:string;thinking:Thinking;behavior:AgentDraftBehavior;execution?:AgentDraftExecution;builder?:BuilderConfiguration};
export type AgentDraftPreviewInput={sessionId:string;requestId:string;sourceAgentId:string|null;creationId?:string;creationToolRevision?:number;text:string;snapshot:AgentDraftSnapshot};
export type AgentDraftPreviewChildControl={action:'send'|'retry-report';threadId:string;turnId:string;id:string;text:string};
export type AgentDraftPreviewStatus='running'|'completed'|'cancelled'|'failed'|'interrupted';
export type AgentDraftPreviewRequest={id:string;user_id:string;conversation_id:string;creation_id?:string|null;snapshot:AgentDraftSnapshot;execution_context?:AgentDraftExecutionContext|null;native?:NativeState;tools?:ToolActivity[];input_text:string;output_text:string;status:AgentDraftPreviewStatus;error:string|null;created_at:string;updated_at?:string;existing?:boolean};
export const draftPreviewTables={threads:'desktop_preview_codex_threads',turns:'desktop_preview_codex_turns',requests:'desktop_preview_requests'} as const;

const record=(value:unknown)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter a draft preview.');return value as Record<string,unknown>;};
const text=(value:unknown,max:number,label:string)=>{if(typeof value!=='string'||value.length>max||value.includes('\0'))throw Error('Enter '+label+' within its length limit.');return value;};
export const draftPreviewId=(value:unknown)=>{const id=text(value,36,'a preview identifier');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('Use a valid draft preview identifier.');return id.toLowerCase();};
const keys=(value:Record<string,unknown>,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('This draft preview contains unsupported settings.');};
export function agentDraftExecution(value:unknown):AgentDraftExecution{
 const v=record(value);keys(v,['permission','mode','files','windows','skills','tools','sources']);
 const {thinking,...options}=chatOptions({...v,thinking:'default'});
 return {...options,files:options.files.map(draftPreviewId),...(options.windows?{windows:options.windows.map(draftPreviewId)}:{})};
}
export function draftPreviewOptions(snapshot:AgentDraftSnapshot):ChatOptions{return chatOptions({...snapshot.execution,permission:snapshot.execution?.permission??'chat',harness:'codex',provider:snapshot.provider,model:snapshot.model,thinking:snapshot.thinking});}
export function agentDraftBehavior(value:unknown):AgentDraftBehavior{
 const v=record(value);keys(v,['handle','role','sops','guardrails','skills','policy']);
 for(const [key,max]of Object.entries({handle:64,role:1000,sops:50000,guardrails:20000}))text(v[key],max,key);
 if(!Array.isArray(v.skills))throw Error('Choose the draft agent skills.');
 for(const value of v.skills){const skill=record(value);keys(skill,['id','name','description','content']);text(skill.name,100,'a skill name');text(skill.description,1000,'a skill description');text(skill.content,50000,'skill instructions');}
 const policy=record(v.policy);keys(policy,['tools','delegation','delegateAgents','memory','memoryWrite','maxDepth','maxTurns']);
 const {revision,...behavior}=profileInput({...v,revision:1});return behavior;
}
export function agentDraftSnapshot(value:unknown):AgentDraftSnapshot{
 const v=record(value),name=text(v.name,100,'an agent name'),description=text(v.description,4000,'a description'),instructions=text(v.instructions,agentInstructionsLimit,'instructions'),personality=text(v.personality??'',20000,'personality and tone'),model=text(v.model,200,'a model');
 if(!name.trim()||!model.trim())throw Error('Choose an agent name and connected model before testing its instructions.');
 if(v.provider!=='openai-oauth'&&v.provider!=='openrouter'&&v.provider!=='openai-api'&&v.provider!=='sylvana')throw Error('Choose a supported AI provider.');
 const thinking=v.thinking??'default';if(!['default','none','minimal','low','medium','high','xhigh','max','ultra'].includes(thinking as string))throw Error('Choose a supported thinking level.');
 keys(v,['name','description','instructions','personality','provider','model','thinking','behavior','execution','builder']);
 if(v.builder!==undefined){const canonical=builderSnapshot(builderConfiguration(v.builder),v.provider,model,thinking as Thinking),execution=agentDraftExecution(v.execution??canonical.execution);if(name!==canonical.name||description!==canonical.description||instructions!==canonical.instructions&&instructions!==legacyBuilderInstructions&&instructions!==legacyBuilderInstructions83&&instructions!==legacyBuilderInstructions85||personality!==''||JSON.stringify(agentDraftBehavior(v.behavior))!==JSON.stringify(canonical.behavior)||execution.permission!=='chat'||execution.mode!=='chat'||execution.files.length||execution.windows?.length||execution.skills?.length||execution.tools?.length||execution.sources?.length)throw Error('The agent builder can only discuss configuration without action tools.');return {...canonical,instructions};}
 return {name,description,instructions,personality,provider:v.provider,model,thinking:thinking as Thinking,behavior:agentDraftBehavior(v.behavior),...(v.execution!==undefined?{execution:agentDraftExecution(v.execution)}:{})};
}
export function agentDraftPreviewInput(value:unknown):AgentDraftPreviewInput{
 const v=record(value),message=text(v.text,100000,'a preview message');if(!message.trim())throw Error('Enter a preview message.');
 if(Object.keys(v).some(key=>!['sessionId','requestId','sourceAgentId','creationId','creationToolRevision','text','snapshot'].includes(key)))throw Error('This preview request contains unsupported context.');
 const source=v.sourceAgentId==null?null:draftPreviewId(v.sourceAgentId),creationId=v.creationId===undefined?undefined:draftPreviewId(v.creationId);if(source&&creationId)throw Error('A saved-agent preview cannot use a creation identity.');
 if(v.creationToolRevision!==undefined&&(!creationId||!Number.isSafeInteger(v.creationToolRevision)||Number(v.creationToolRevision)<1))throw Error('Choose the confirmed creation app revision before previewing connections.');
 return {sessionId:draftPreviewId(v.sessionId),requestId:draftPreviewId(v.requestId),sourceAgentId:source,...(creationId?{creationId}:{}),...(v.creationToolRevision===undefined?{}:{creationToolRevision:Number(v.creationToolRevision)}),text:message,snapshot:agentDraftSnapshot(v.snapshot)};
}

export function draftPreviewOutput(state:NativeState|null|undefined):string{if(!state)return '';const text=state.items.filter(row=>row.threadId===state.threadId&&row.item.type==='agentMessage').map(row=>row.item.type==='agentMessage'?row.item.text:'').join('\n\n');return [text,...(state.reports??[]).map(report=>draftPreviewOutput(report.state))].filter(Boolean).join('\n\n');}

export function draftPreviewChildControl(value:unknown):AgentDraftPreviewChildControl{
 const v=record(value);keys(v,['action','threadId','turnId','id','text']);if(v.action!=='send'&&v.action!=='retry-report')throw Error('Choose a child follow-up or report retry.');const message=text(v.text??'',100000,'a child instruction');if(v.action==='send'&&!message.trim())throw Error('Enter a child instruction.');return {action:v.action,threadId:draftPreviewId(v.threadId),turnId:draftPreviewId(v.turnId),id:draftPreviewId(v.id),text:v.action==='send'?message:''};
}
export function previewContinuationInput(request:AgentDraftPreviewRequest,sourceAgentId:string|null):AgentDraftPreviewInput{
 const context=request.execution_context;if(!context)throw Error('This older preview has no retained execution snapshot. Send a new preview message.');return agentDraftPreviewInput({sessionId:request.conversation_id,requestId:request.id,sourceAgentId,...(request.creation_id?{creationId:request.creation_id}:{}),...(context.version===2?{creationToolRevision:context.creationResources?.revision}:{}),text:request.input_text,snapshot:request.snapshot});
}
