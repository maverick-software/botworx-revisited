import type {TerminalRun,TerminalSession,CommandPermissions} from './terminal-contracts';
import type {TurnTiming} from './turn-presentation';
import type {ToolActivity} from './tool-contracts';
import type {FileOperationView,WorkspaceFileChange} from './file-operation-contracts';
import type {DocumentInfo} from './document-contracts';
import type {WorkspacePlan} from './plan-contracts';
export type Provider = 'openrouter' | 'openai-oauth';
export type DesktopLocation={view:'chat'|'agents'|'plugins'|'skills'|'tools'|'scheduled';conversationId?:string;agentId?:string;projectId?:string;child?:import('./native-contracts').NativeChildLocation};
export type DesktopPreferences={theme:'system'|'light'|'dark';textSize:'standard'|'large';sendWith:'enter'|'ctrl-enter';sidebarCollapsed:boolean;sidebarWidth?:number};
export const defaultDesktopPreferences:DesktopPreferences={theme:'system',textSize:'standard',sendWith:'enter',sidebarCollapsed:false,sidebarWidth:244};
export type Thinking='default'|'none'|'minimal'|'low'|'medium'|'high'|'xhigh'|'max'|'ultra';
export type Model = {id:string;name:string;thinking?:Thinking[];inputModalities?:string[];supportsTools?:boolean};
export type ModelChoice={model:string;thinking:Thinking};
export type ModelChoices=Partial<Record<Provider,ModelChoice>>;
export type ProviderStatus={openrouter:boolean;defaultModel:string;selections?:ModelChoices;preferChatGPT?:boolean;chatgpt:null|{email:string;workspace:string;authorized:boolean;welcome?:boolean;connectionIssue?:import('./oauth-recovery').ChatGPTConnectionIssue}};
export type ChatOptions={harness?:'codex'|'legacy';skills?:string[];windows?:string[];provider?:Provider;model?:string;thinking:Thinking;permission:'chat'|'ask'|'files'|'full';mode:'chat'|'plan';files:string[];goalId?:string;tools?:string[];sources?:import('./selected-context').SelectedContext[]};
export const defaultChatOptions:ChatOptions={thinking:'default',permission:'ask',mode:'chat',files:[]};
export type FileReference={id:string;name:string;kind:'file'|'folder';path:string;source?:'clipboard';bytes?:number;recoveryPaths?:string[]};
export type AttachmentInput={path:string}|{name:string;image:string};
export type FileSelection={references:FileReference[];selected:string[]};
export type WorkspaceTab={id:string;kind:'file'|'folder'|'browser'|'plan'|'goal'|'terminal'|'conversation'|'changes';name:string;referenceId?:string;path?:string;fragment?:string;url?:string;source?:boolean;canvas?:boolean;editing?:boolean;planId?:string;goalId?:string;runId?:string;sessionId?:string;conversationId?:string;messageId?:string};
export type WorkspaceTreeView={expanded:string[];filter:string;followActive:boolean};
export type PaneState={fileRevision?:number;treeViews?:Record<string,WorkspaceTreeView>;open:boolean;width:number;treeWidth:number;tree:boolean;tabs:WorkspaceTab[];active:string|null;referenceId:string|null};
export type Project={id:string;name:string;reference_id:string|null;instructions:string;file_ids:string[];revision:number;memory_enabled?:boolean;agent_memory_isolated?:boolean};
export type ProjectContext={id:string;name:string;instructions:string;file_ids:string[];revision:number;memory_enabled?:boolean;agent_memory_isolated?:boolean};
export type ProjectMemorySource={message_id:string;conversation_id:string;title:string;role:string;created_at:string;desktop_sequence:number;excerpt:string;citation:string;truncated?:boolean;rank?:number;offset?:number;next_offset?:number|null;total_characters?:number};
export type ProjectsState={projects:Project[];memberships:{conversation_id:string;project_id:string}[]};
export type FileContext={name:string;text?:string;image?:string;pageImages?:(import('./pdf-page-contracts').PdfPageImage&{source?:string})[];fileCount?:number;notice?:string;document?:DocumentInfo;source?:Pick<import('./selected-context').SelectedContext,'kind'|'id'|'url'|'capturedAt'>};
export type Goal={id:string;agent_id:string;conversation_id:string|null;project_id?:string|null;plan_id?:string|null;plan_snapshot?:WorkspacePlan|null;objective:string;status:'ready'|'running'|'paused'|'completed';max_turns:number|null;token_budget?:number|null;turns_used:number;note:string|null};
export type Agent = {presentation?:import('./agent-presentation-contracts').AgentPresentation;id:string;name:string;description:string;system_instructions:string;provider:Provider;model:string;active?:boolean;handle?:string;role?:string};
export type Conversation = {conversation_id:string;title:string;agent_id:string;last_active?:string;started_at?:string;pinned:boolean;archived:boolean;options?:ChatOptions};
export type Message = {id:string;role:string;sender_agent_id?:string|null;content:{text:string;files?:FileContext[]};metadata:{scheduled_task?:{task_id:string;run_id:string;name:string;scheduled_for:string};chat_delivery?:import('./chat-origin').ChatDeliveryProvenance;agent?:import('./agent-contracts').AgentAttribution;native?:import('./native-contracts').NativeState;timing?:TurnTiming;status?:string;error?:string;options?:ChatOptions;goal_id?:string;tools?:ToolActivity[];project?:ProjectContext|null;project_memory?:ProjectMemorySource[];plan?:WorkspacePlan|null}};
export type Identity = {id:string;email:string;admin:boolean};
export const agentSections=['general','identity','behavior','capabilities','memory','documents','channels','sources','team','contacts','mcp','schedule','workflows','automations'] as const;
export type AgentSection=typeof agentSections[number];
export const capabilityOptions=[
 {key:'voice',name:'Voice synthesis',description:'Text-to-speech through an ElevenLabs connection.',providers:['elevenlabs']},
 {key:'web_search',name:'Web search',description:'Search through the system Serper API key.',providers:[]},
 {key:'document_creation',name:'Document creation',description:'Create documents, code, and artifacts.',providers:[]},
 {key:'ocr_processing',name:'Read documents',description:'Extract text from PDFs and images through the system Mistral key.',providers:[]},
 {key:'temporary_chat_links',name:'Temporary chat links',description:'Share a time-limited conversation link.',providers:[]},
] as const;
export type Profile={username:string|null;first_name:string|null;last_name:string|null;company_name:string|null;title:string|null;mobile_number:string|null};
export type ChatEvent = {scope?:'agent-draft-preview';preview?:{sessionId:string;status?:string;event?:Omit<ChatEvent,'preview'>};requestId:string;conversationId?:string;delta?:string;status?:string;error?:string;kind?:'agent-draft-preview'|'schedule'|'queue'|'agent'|'native'|'native-background'|'native-changes'|'started'|'goal'|'tool'|'plan'|'terminal'|'terminal-session'|'command-permissions'|'workspace'|'workspace-operation';native?:import('./native-contracts').NativeState;fileOperation?:FileOperationView;workspaceChange?:WorkspaceFileChange;workspace?:{id:string;referenceId:string;path:string;error?:string};commandPermissions?:CommandPermissions;ownerId?:string;terminal?:TerminalRun;terminalSession?:TerminalSession;goal?:Goal;goalId?:string;text?:string;tool?:ToolActivity;plan?:WorkspacePlan};
export type RuntimeStatus = {phase:string;message:string;ready:boolean;recoveryOnly?:boolean};
export type PortableBackupStatus={phase:'idle'|'choosing'|'running';message:string};
export type PortableBackupResult={destination:string;accounts:number;privateFiles:number;publicFiles:number;publicReferences:number;clipboardImages:number};
export interface DesktopBridge {
 onNotification?(listener:(target:{owner:string;conversationId:string;child?:{requestId:string;threadId:string}})=>void):()=>void;
 attach(files:File[],owner:string):Promise<FileSelection>;
 call<T=unknown>(action:string,args?:Record<string,unknown>):Promise<T>;
 onChat(listener:(event:ChatEvent)=>void):()=>void;
 onRuntime(listener:(event:RuntimeStatus)=>void):()=>void;
 onBeforeClose(listener:()=>Promise<void>):()=>void;
 onCommand(listener:(command:string)=>void):()=>void;
}
