import {createHash} from 'node:crypto';
import {selectedContextFiles} from './selected-context';
import {chatOptions,thinkingValues} from './composer';
import {draftScope,type ChatDraft} from './chat-drafts';
import {desktopLocation} from './desktop-location';
import {voicePreferences} from './voice-preferences';
import {notificationPreferences} from './notification-preferences';
import {composioState,portableComposioState} from './composio-contracts';
import {googleDocumentJournal} from './google-document-contracts';
import type {Secrets} from './secrets';

export const portableSettingKeys=['preferences','model-choices','prefer-chatgpt','composer','chat-drafts','desktop-location','voice-preferences','notification-preferences','composio-state','google-documents'] as const;
type Key=typeof portableSettingKeys[number];
export type PortableSettings=Partial<Record<Key,unknown>>;
export type PortableSettingsRecord={format:1;kind:'agentopia-portable-settings';databaseManifestSha256:string;accounts:{owner:string;settings:PortableSettings}[];indexSha256:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function object(value:unknown,keys?:readonly string[]):asserts value is Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value)||keys&&Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid portable settings fields.');}
function options(value:unknown){object(value,['thinking','permission','mode','files','windows','harness','skills','provider','model','goalId','tools','sources']);const result=chatOptions(value);delete result.windows;delete result.goalId;return result;}
export function cleanPortableSetting(key:Key,value:unknown):unknown{
 switch(key){
  case 'preferences':object(value,['theme','textSize','sendWith','sidebarCollapsed','sidebarWidth']);if(!['light','dark','system'].includes(value.theme)||!['standard','large'].includes(value.textSize)||!['enter','ctrl-enter'].includes(value.sendWith)||typeof value.sidebarCollapsed!=='boolean'||value.sidebarWidth!==undefined&&(!Number.isInteger(value.sidebarWidth)||value.sidebarWidth<200||value.sidebarWidth>400))throw Error('Invalid portable appearance settings.');return structuredClone(value);
  case 'prefer-chatgpt':if(typeof value!=='boolean')throw Error('Invalid portable provider preference.');return value;
  case 'model-choices':object(value,['openai-oauth','openrouter']);return Object.fromEntries(Object.entries(value).map(([provider,choice])=>{object(choice,['model','thinking']);if(typeof choice.model!=='string'||!choice.model||choice.model.length>200||!thinkingValues.includes(choice.thinking))throw Error('Invalid portable model choice.');return [provider,{model:choice.model,thinking:choice.thinking}];}));
  case 'composer':return options(value);
  case 'desktop-location':object(value,['view','conversationId','agentId','projectId','child']);if(value.child)object(value.child,['requestId','threadId']);return desktopLocation(value);
  case 'voice-preferences':object(value,['mode','spoken','deviceId','voice','rate','silenceMs','threshold']);return voicePreferences(value);
  case 'notification-preferences':return notificationPreferences(value);
  case 'composio-state':return portableComposioState(value);
  case 'google-documents':return googleDocumentJournal(value);
  case 'chat-drafts':{
   object(value);if(Object.keys(value).length>100||JSON.stringify(value).length>2000000)throw Error('Portable chat drafts exceed the saved-draft limit.');const result:Record<string,ChatDraft>={};
   for(const [scope,draft]of Object.entries(value)){draftScope(scope);object(draft,['text','options','updatedAt']);if(typeof draft.text!=='string'||draft.text.length>100000||typeof draft.updatedAt!=='string'||!Number.isFinite(Date.parse(draft.updatedAt)))throw Error('Invalid portable chat draft.');result[scope]={text:draft.text,options:options(draft.options),updatedAt:draft.updatedAt};}return result;
  }
 }
}
export function portableSettingsId(record:Omit<PortableSettingsRecord,'indexSha256'>|PortableSettingsRecord){return createHash('sha256').update(JSON.stringify({format:record.format,kind:record.kind,databaseManifestSha256:record.databaseManifestSha256,accounts:record.accounts})).digest('hex');}
export function validatePortableSettings(record:PortableSettingsRecord){
 object(record,['format','kind','databaseManifestSha256','accounts','indexSha256']);if(record.format!==1||record.kind!=='agentopia-portable-settings'||!/^[a-f0-9]{64}$/.test(record.databaseManifestSha256)||!Array.isArray(record.accounts)||record.accounts.length>10000||Buffer.byteLength(JSON.stringify(record),'utf8')>16*1024**2||record.indexSha256!==portableSettingsId(record))throw Error('The portable settings record is invalid or changed.');
 const owners=new Set<string>();for(const account of record.accounts){object(account,['owner','settings']);if(!uuid.test(account.owner)||owners.has(account.owner.toLowerCase()))throw Error('Invalid portable settings owner.');owners.add(account.owner.toLowerCase());object(account.settings,portableSettingKeys);for(const [key,value]of Object.entries(account.settings))cleanPortableSetting(key as Key,value);const settings=account.settings;if(settings['composio-state'])composioState(settings['composio-state'],true);if(settings.composer)selectedContextFiles((settings.composer as any).sources,account.owner,'ask');for(const draft of Object.values(settings['chat-drafts']??{}) as ChatDraft[])selectedContextFiles(draft.options.sources,account.owner,'ask');}return record;
}
export function capturePortableSettings(owners:string[],databaseManifestSha256:string,read:(owner:string)=>PortableSettings){
 const accounts=owners.map(owner=>{const input=read(owner);object(input,portableSettingKeys);return {owner,settings:Object.fromEntries(Object.entries(input).map(([key,value])=>[key,cleanPortableSetting(key as Key,value)]))};});
 const record={format:1 as const,kind:'agentopia-portable-settings' as const,databaseManifestSha256,accounts};return validatePortableSettings({...record,indexSha256:portableSettingsId(record)});
}
export function readPortableSettings(secrets:Secrets,owner:string):PortableSettings{const result:PortableSettings={};for(const key of portableSettingKeys){const value=secrets.get(key+':'+owner);if(value!==undefined)result[key]=structuredClone(value);}return result;}
export async function applyPortableSettings(secrets:Secrets,record:PortableSettingsRecord,owner:string,guard:()=>Promise<void>){
 validatePortableSettings(record);const account=record.accounts.find(account=>account.owner.toLowerCase()===owner.toLowerCase());if(!account)throw Error('The signed-in account is absent from settings recovery.');
 const key='portable-settings-recovery:'+owner,applied=secrets.get<string[]>(key)??[];if(applied.includes(record.indexSha256))return;if(applied.length>=256)throw Error('The settings recovery limit was reached.');
 const entries:(readonly [string,unknown])[]=[];for(const [name,value]of Object.entries(account.settings)){const setting=name+':'+owner,next=cleanPortableSetting(name as Key,value),existing=secrets.get(setting);if(existing!==undefined&&JSON.stringify(name==='notification-preferences'?notificationPreferences(existing):existing)!==JSON.stringify(next))throw Error('An existing saved setting conflicts with this recovery. Preserve both profiles before continuing.');entries.push([setting,next]);}
 await guard();await secrets.setMany([...entries,[key,[...applied,record.indexSha256]]]);await guard();
}
