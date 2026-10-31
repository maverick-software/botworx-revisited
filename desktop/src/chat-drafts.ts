import {selectedContextFiles} from './selected-context';
import {chatOptions} from './composer';
import type {ChatOptions} from './contracts';
import type {Secrets} from './secrets';
export type ChatDraft={text:string;options:ChatOptions;updatedAt:string};
export function draftScope(value:unknown):string{
 if(typeof value!=='string'||!/^conversation:[a-f0-9-]{36}$|^child:[a-f0-9-]{36}:[a-f0-9-]{36}$|^new:(?:[a-f0-9-]{36}|unassigned):(?:[a-f0-9-]{36}|home)$/i.test(value))throw new Error('Invalid chat draft location.');return value;
}
export class ChatDrafts{
 private writes:Promise<unknown>=Promise.resolve();
 constructor(private secrets:Secrets){}
 get(owner:string,scope:unknown):ChatDraft|null{return this.secrets.get<Record<string,ChatDraft>>('chat-drafts:'+owner)?.[draftScope(scope)]??null;}
 remove(owner:string,scope:string){return this.save(owner,scope,{text:'',options:{files:[]}});}
 save(owner:string,scope:unknown,value:unknown){
  const key=draftScope(scope),raw=value as Partial<ChatDraft>;
  if(!raw||typeof raw.text!=='string'||raw.text.length>100000)throw new Error('A draft can contain up to 100,000 characters.');
  const options=chatOptions(raw.options);selectedContextFiles(options.sources,owner,'ask');delete options.goalId;
  const draft:ChatDraft={text:raw.text,options,updatedAt:new Date().toISOString()};
  const operation=this.writes.catch(()=>{}).then(async()=>{
   const drafts={...this.secrets.get<Record<string,ChatDraft>>('chat-drafts:'+owner)};
   // Keep only drafts with text or selected context. Never silently evict unsent work.
   const clearedWindows=key.startsWith('conversation:')&&draft.options.windows!==undefined;
   if(!draft.text&&!draft.options.files.length&&!draft.options.sources?.length&&!draft.options.windows?.length&&!draft.options.tools?.length&&!clearedWindows)delete drafts[key];else drafts[key]=draft;
   if(Object.keys(drafts).length>100||JSON.stringify(drafts).length>2000000)throw new Error('Local chat draft storage is full. Send or clear an existing draft before saving another.');
   await this.secrets.set('chat-drafts:'+owner,drafts);return draft;
  });this.writes=operation;return operation;
 }
}
