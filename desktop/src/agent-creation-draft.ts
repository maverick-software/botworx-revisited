import type {Provider} from './contracts';
import {agentIcons,agentColors,isLocalAgentAvatar,type AgentAppearance} from './agent-presentation-contracts';
import {draftPreviewId} from './agent-draft-preview-contracts';
import type {AgentDraftBehavior} from './agent-draft-preview-contracts';
import {agentBehaviorDraft} from './agent-behavior-draft';

/** Raw editing state. Blank names and unfinished starters are intentionally
 * retained; the normal creation API validates the final submitted agent. */
export type AgentCreationReceipt={agentId:string;reviewRequired:boolean};
export type CreationConnectionOptions=Record<string,{clientId:string;clientMetadataUrl:string}>;
export type AgentCreationDraft={format:'agent-creation-1';creationId:string;name:string;description:string;instructions:string;provider:Provider;model:string;appearance:AgentAppearance;image:string|null;dirty:boolean;behavior?:AgentDraftBehavior;created?:AgentCreationReceipt;connectionOptions?:CreationConnectionOptions};
const object=(value:unknown):Record<string,any>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('The new-agent draft has an invalid field.');return value as Record<string,any>;};
const keys=(value:Record<string,any>,allowed:string[])=>{if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('The new-agent draft uses unsupported fields.');};
const text=(value:unknown,limit:number)=>{if(typeof value!=='string'||value.length>limit||value.includes('\0'))throw Error('The new-agent draft has an invalid text field.');};
export function agentCreationDraft(value:unknown):AgentCreationDraft{
 const v=object(value);keys(v,['format','creationId','name','description','instructions','provider','model','appearance','image','dirty','behavior','created','connectionOptions']);
 if(v.format!=='agent-creation-1'||typeof v.dirty!=='boolean'||!['openrouter','openai-oauth'].includes(v.provider))throw Error('The new-agent draft uses an unsupported format.');
 draftPreviewId(v.creationId);text(v.name,100);text(v.description,4000);text(v.instructions,100000);text(v.model,1000);
 if(v.behavior!==undefined)agentBehaviorDraft(v.behavior);
 if(v.connectionOptions!==undefined){const options=object(v.connectionOptions);if(Object.keys(options).length>100)throw Error('The new-agent draft has too many connection settings.');for(const[id,raw]of Object.entries(options)){draftPreviewId(id);const row=object(raw);keys(row,['clientId','clientMetadataUrl']);text(row.clientId,2048);text(row.clientMetadataUrl,2048);}}
 if(v.created!==undefined){const receipt=object(v.created);keys(receipt,['agentId','reviewRequired']);draftPreviewId(receipt.agentId);if(typeof receipt.reviewRequired!=='boolean')throw Error('The creation receipt has an invalid review choice.');}
 const a=object(v.appearance);keys(a,['version','icon','color','starters']);if(a.version!==1||!agentIcons.includes(a.icon)||!agentColors.includes(a.color))throw Error('The new-agent draft has an invalid appearance.');
 if(a.starters!==null){if(!Array.isArray(a.starters)||a.starters.length>6)throw Error('The new-agent draft has too many starters.');const ids=new Set<string>();for(const raw of a.starters){const row=object(raw);keys(row,['id','title','prompt']);text(row.id,64);if(!/^[a-zA-Z0-9_-]{1,64}$/.test(row.id)||ids.has(row.id))throw Error('The new-agent draft has duplicate or invalid starters.');ids.add(row.id);text(row.title,80);text(row.prompt,2000);}}
 if(v.image!==null&&!isLocalAgentAvatar(v.image))throw Error('The new-agent draft image must be a prepared local image.');
 return structuredClone(v) as AgentCreationDraft;
}
