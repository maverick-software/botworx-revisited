import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {Workflow,ArrowLeft,X,MessageSquare} from 'lucide-react';
import type {NativeChildLocation,NativeChildView} from '../src/native-contracts';
import {NativeChildCard} from './NativeTurn';
import {call} from './ui';
import {mergeChildViews} from '../src/native-navigation';

export const childKey=(c:NativeChildLocation)=>c.requestId+':'+c.threadId;
export const ChildChats=createContext<{rows:NativeChildView[];current:NativeChildLocation|null;open:(c:NativeChildView)=>void}>({rows:[],current:null,open:()=>{}});

// Events carry complete snapshots. Ignore a database read that began before a newer event.
export function useChildChats(owner:string|undefined,conversation:string|null){
 const [snapshot,setSnapshot]=useState<{owner?:string;rows:NativeChildView[]}>({rows:[]}),[error,setError]=useState('');
 const active=useRef(owner),revision=useRef(0);active.current=owner;
 function merge(rows:NativeChildView[],expected=owner){if(!expected||active.current!==expected)return;setSnapshot(old=>({owner:expected,rows:mergeChildViews(old.owner===expected?old.rows:[],rows)}));}
 useEffect(()=>{setSnapshot({rows:[]});setError('');if(!owner)return;let disposed=false,pending=false,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{if(pending)return;pending=true;const version=revision.current;try{const rows=await call<NativeChildView[]>('native.children');if(!disposed&&version===revision.current){merge(rows,owner);setError('');}}catch(e){if(!disposed)setError((e as Error).message);}finally{pending=false;}};
  void refresh();const off=window.sylvana.onChat(e=>{if(e.ownerId!==owner||!e.native||!['native','native-background'].includes(e.kind??''))return;revision.current++;setSnapshot(old=>{const previous=old.owner===owner?old.rows:[],others=previous.filter(c=>c.requestId!==e.requestId),rows=(e.native!.children??[]).map(child=>{const existing=previous.find(c=>c.requestId===e.requestId&&c.child.threadId===child.threadId);return{requestId:e.requestId,conversationId:e.conversationId??existing?.conversationId??'',provider:existing?.provider??'',model:existing?.model??'',child};});return{owner,rows:[...others,...rows]};});if(!timer)timer=setTimeout(()=>{timer=undefined;void refresh();},500);});
  const interval=setInterval(()=>void refresh(),10000);return()=>{disposed=true;off();clearInterval(interval);clearTimeout(timer);};
 },[owner]);
 useEffect(()=>{if(!owner||!conversation)return;let disposed=false;const version=revision.current;void call<NativeChildView[]>('native.children',{conversationId:conversation}).then(rows=>{if(!disposed&&version===revision.current)merge(rows,owner);}).catch(e=>{if(!disposed)setError(e.message);});return()=>{disposed=true;};},[owner,conversation]);
 return {rows:snapshot.owner===owner?snapshot.rows:[],merge,error};
}

export function ConversationSubagents({conversationId,main,error}:{conversationId:string;main:()=>void;error?:string}){
 const chats=useContext(ChildChats),[expanded,setExpanded]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),children=chats.rows.filter(c=>c.conversationId===conversationId);
 useEffect(()=>setExpanded(false),[conversationId]);
 const close=()=>{setExpanded(false);trigger.current?.focus();};
 useEffect(()=>{if(!expanded)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!(event.target instanceof Element&&event.target.closest('[role="dialog"]'))){event.preventDefault();close();}};document.addEventListener('keydown',key);panel.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.scrollIntoView({block:'nearest'});return()=>document.removeEventListener('keydown',key);},[expanded]);
 if(!children.length&&!error)return null;
 const active=children.filter(c=>c.child.status==='running'||c.child.delivery==='running').length,needsInput=(c:NativeChildView)=>c.child.state.approvals.some(a=>a.status==='pending')||c.child.state.tools?.some(t=>t.status==='awaiting_approval');
 return <div className="conversation-subagents"><button ref={trigger} className="chat-subagents-trigger icon-button" aria-label="Subagents in this chat" title={children.length+' subagents in this chat'+(active?' · '+active+' working':'')} aria-expanded={expanded} aria-controls="conversation-subagents-panel" onClick={()=>setExpanded(value=>!value)}><Workflow size={18}/><span className="chat-subagents-caption">Subagents</span><span>{children.length}</span>{active>0&&<i className="native-running-dot"/>}</button>{expanded&&<aside ref={panel} id="conversation-subagents-panel" className="conversation-subagents-panel" aria-label="Subagents in this chat"><header><div><strong>Subagents</strong><small>{active?active+' working in this chat':'This conversation'}</small></div><button className="icon-button" aria-label="Close subagents" onClick={close}><X size={17}/></button></header><div className="chat-subagent-list"><button className={'chat-main-entry '+(!chats.current?'selected':'')} aria-current={!chats.current?'page':undefined} onClick={()=>{main();close();}}><MessageSquare size={16}/><span>Main chat</span></button>{error&&<p role="alert" className="danger">{error}</p>}{children.map(c=>{const selected=chats.current?.requestId===c.requestId&&chats.current.threadId===c.child.threadId;return <button key={childKey({requestId:c.requestId,threadId:c.child.threadId})} className={'chat-child-entry '+(selected?'selected':'')} data-chat-child={c.child.threadId} aria-current={selected?'page':undefined} title={c.child.prompt||c.child.name} onClick={()=>{chats.open(c);close();}}><Workflow size={16}/><span><strong>{c.child.name}</strong><small>{needsInput(c)?'Needs input':c.child.status==='running'?'Working':c.child.status}{c.child.delivery==='delivered'?' · Reported back':''}</small><span className="chat-child-assignment">{c.child.prompt}</span></span>{needsInput(c)?<b aria-label="Subagent needs input">!</b>:c.child.status==='running'?<i className="native-running-dot"/>:null}</button>;})}</div></aside>}</div>;
}

export function ChildChat({entry,parentTitle,main,draft,setDraft,clearDraft}:{entry:NativeChildView;parentTitle:string;main:()=>void;draft:string;setDraft:(text:string)=>void;clearDraft:(text:string)=>Promise<void>}){
 const area=useRef<HTMLDivElement>(null),follow=useRef(true),child=entry.child;
 useEffect(()=>{if(follow.current&&area.current)area.current.scrollTop=area.current.scrollHeight;},[child.state.items,child.result,child.state.steering]);
 return <section className="child-chat-stage" aria-label="Subagent chat" data-open-child={child.threadId}><div className="child-chat-heading"><button className="subtle-link" onClick={main}><ArrowLeft size={15}/>Main agent · {parentTitle}</button><small>{entry.provider==='openrouter'?'OpenRouter':entry.provider==='openai-oauth'?'ChatGPT':''}{entry.model?' · '+entry.model:''} · Inherited tools and permissions</small></div><div className="child-chat-scroll" ref={area} onScroll={()=>{const a=area.current;if(a)follow.current=a.scrollHeight-a.scrollTop-a.clientHeight<100;}}><div className="message-column"><NativeChildCard child={child} requestId={entry.requestId} chat compose={{text:draft,setText:setDraft,sent:clearDraft}}/></div></div></section>;
}
