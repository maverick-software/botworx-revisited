import {useRef,useState} from 'react';
import {defaultChatOptions,type ChatOptions} from '../src/contracts';
import type {ChatDraft} from '../src/chat-drafts';
import {call} from './ui';
import {localSessionEnded} from '../src/session-end';
import {needsNewChatDefaults,type NewChatResolver} from '../src/new-chat-defaults';
type Value={owner:string;scope:string;text:string;options:ChatOptions;dirty:boolean};
export function useChatDrafts(error:(message:string)=>void){
 const [text,renderText]=useState(''),[options,renderOptions]=useState<ChatOptions>({...defaultChatOptions});
 const current=useRef<Value|null>(null),values=useRef({text:'',options:{...defaultChatOptions}}),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),writes=useRef<Promise<unknown>>(Promise.resolve()),generation=useRef(0);
 const acceptedRevisions=useRef(new Map<string,number>());
 const retained=useRef(new Map<string,Value>());
 function flush(){clearTimeout(timer.current);const value=current.current;if(value?.dirty){value.dirty=false;const snapshot={...value,options:{...value.options,files:[...value.options.files]}};const operation=writes.current.catch(()=>{}).then(()=>call('drafts.save',{owner:snapshot.owner,scope:snapshot.scope,draft:{text:snapshot.text,options:snapshot.options}}));writes.current=operation.catch(e=>{if(current.current===value)value.dirty=true;throw e;});}return writes.current;}
 function changed(){if(!current.current)return;current.current.dirty=true;clearTimeout(timer.current);timer.current=setTimeout(()=>{void flush().catch(e=>{if(!localSessionEnded(e))error(e.message);});},350);}
 function setText(next:string|((old:string)=>string)){const value=typeof next==='function'?next(values.current.text):next;values.current.text=value;if(current.current){current.current.text=value;changed();}renderText(value);}
 function setOptions(next:ChatOptions|((old:ChatOptions)=>ChatOptions)){const value=typeof next==='function'?next(values.current.options):next;values.current.options=value;if(current.current){current.current.options=value;changed();}renderOptions(value);}
 async function activate(owner:string,scope:string,defaults:ChatOptions,isCurrent=()=>true,resolveNew?:NewChatResolver){
  const token=++generation.current,key=owner+':'+scope;await flush();let draft:ChatDraft|null;
  // A send can be accepted while this read is in flight. Wait for its saved clear
  // and read again instead of restoring a snapshot of already-submitted text.
  for(;;){const revision=acceptedRevisions.current.get(key)??0;draft=await call<ChatDraft|null>('drafts.get',{owner,scope});await flush();if(token!==generation.current||!isCurrent())return false;if(revision===(acceptedRevisions.current.get(key)??0))break;}
  const pending=retained.current.get(key);let selected=pending?.options??draft?.options??defaults;if(!pending&&resolveNew&&needsNewChatDefaults(scope,draft))selected=await resolveNew(selected);if(token!==generation.current||!isCurrent())return false;
  const value={owner,scope,text:pending?.text??draft?.text??'',options:selected,dirty:false};current.current=value;values.current={text:value.text,options:value.options};renderText(value.text);renderOptions(value.options);if(pending){retained.current.delete(key);changed();}return true;
 }
 function reset(retain=false){if(retain){const value=current.current;if(value?.dirty)retained.current.set(value.owner+':'+value.scope,{...value,options:structuredClone(value.options)});writes.current=Promise.resolve();}generation.current++;acceptedRevisions.current.clear();clearTimeout(timer.current);current.current=null;values.current={text:'',options:{...defaultChatOptions}};renderText('');renderOptions({...defaultChatOptions});}
 async function clearSent(owner:string,scope:string,sentText:string){
  const key=owner+':'+scope;acceptedRevisions.current.set(key,(acceptedRevisions.current.get(key)??0)+1);
  const active=current.current;if(active?.owner===owner&&active.scope===scope){if(active.text===sentText){setText('');await flush();}return;}
  // Queue, steering and child sends can be accepted after navigation. Clear only the submitted scope and text.
  const operation=writes.current.catch(()=>{}).then(async()=>{const draft=await call<ChatDraft|null>('drafts.get',{owner,scope});if(draft?.text===sentText)await call('drafts.save',{owner,scope,draft:{...draft,text:''}});});writes.current=operation;await operation;
 }
 async function sent(conversationId:string,defaults:ChatOptions,preserveNewDraft=false){const previous=current.current;await flush();if(!preserveNewDraft&&previous&&previous.scope.startsWith('new:'))await call('drafts.save',{owner:previous.owner,scope:previous.scope,draft:{text:'',options:{...previous.options,files:[],sources:undefined,windows:undefined}}});if(previous)await activate(previous.owner,'conversation:'+conversationId,defaults);}
 async function goalConversation(conversationId:string){const previous=current.current;if(previous&&previous.scope!=='conversation:'+conversationId)await sent(conversationId,previous.options);}
 return {text,options,setText,setOptions,activate,flush,reset,sent,goalConversation,clearSent};
}
