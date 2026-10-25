import {pluginName} from './plugin-presentation';
import React,{useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {Plus,Paperclip,Folder,Target,Lightbulb,AtSign,Check,ArrowLeft,Plug,Globe,MessageSquare,Bot,Search,Monitor} from 'lucide-react';
import type {Agent,ChatOptions,Conversation,FileReference,Message} from '../src/contracts';
import type {ToolSource} from '../src/tool-contracts';
import type {SavedBrowserTab} from '../src/browser-tabs';
import {removeAgentMention,type AgentMention} from '../src/agent-mention';
import {selectedContexts,type SelectedContext} from '../src/selected-context';
import {call} from './ui';
import './composer-add-menu.css';

type ContextTab=Pick<SavedBrowserTab,'id'|'title'|'url'>&{status?:string;conversationTitle?:string;browser?:'chrome'};
type Props={agent:Agent|null;agents:Agent[];scope?:string;options:ChatOptions;change:(next:Partial<ChatOptions>)=>void;files:FileReference[];pick:(kind:'file'|'folder')=>Promise<void>;disabled:boolean;request:boolean;input:RefObject<HTMLTextAreaElement>;value:string;setValue:(value:string)=>void;selectAgent:(agent:Agent,mention?:AgentMention)=>void;goal:()=>void;shareWindows?:()=>void;onBusy?:(busy:boolean)=>void;mention?:AgentMention|null;dismissMention?:()=>void;menuId?:string;onActiveOption?:(id:string|undefined)=>void};

/** Add and typed @ share one catalog, selection path and pending-read boundary. */
export function ComposerAddMenu({agent,agents,scope,options,change,files,pick,disabled,request,input,value,setValue,selectAgent,goal,shareWindows,onBusy,mention,dismissMention,menuId,onActiveOption}:Props){
 const [buttonOpen,setButtonOpen]=useState(false),[view,setView]=useState<'add'|'context'>('add'),[search,setSearch]=useState(''),[sources,setSources]=useState<ToolSource[]>([]),[tabs,setTabs]=useState<ContextTab[]>([]),[chats,setChats]=useState<Conversation[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[width,setWidth]=useState(720),[active,setActive]=useState(0);
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement|null>(null),height=useRef<number|null>(null),generation=useRef(0),catalogGeneration=useRef(0);
 const open=buttonOpen||!!mention,typed=!!mention,query=typed?mention.query:search,currentView=typed?'context':view;
 const identityKey=JSON.stringify([scope,agent?.id,disabled,request,options.permission]),operationKey=identityKey+JSON.stringify(mention??null);
 const latest=useRef({value,identityKey,operationKey,onBusy,dismissMention,mention,options,change});latest.current={value,identityKey,operationKey,onBusy,dismissMention,mention,options,change};
 const pending=(next:boolean)=>{setBusy(next);latest.current.onBusy?.(next);};
 const close=()=>{generation.current++;setButtonOpen(false);pending(false);latest.current.dismissMention?.();};
 const finish=()=>{close();requestAnimationFrame(()=>input.current?.focus());};
 const baseDraft=()=>{const range=latest.current.mention,text=latest.current.value;return range&&text.slice(range.start,range.end).toLowerCase()==='@'+range.query?removeAgentMention(text,range):text;};
 const consume=()=>{if(latest.current.mention)setValue(baseDraft());};
 const matches=(text:string)=>text.toLowerCase().includes(query.toLowerCase().replace(/^@/,''));
 const attachMenu=useCallback((node:HTMLDivElement|null)=>{menu.current=node;if(node){if(height.current===null)height.current=node.getBoundingClientRect().height;node.style.height=height.current+'px';}},[]);
 useLayoutEffect(()=>{height.current=null;if(!open||!menu.current)return;menu.current.style.height='';height.current=menu.current.getBoundingClientRect().height;menu.current.style.height=height.current+'px';},[open,currentView,typed]);
 useLayoutEffect(()=>{if(open)setWidth(trigger.current?.closest('form')?.getBoundingClientRect().width??720);},[open]);
 useEffect(()=>{generation.current++;setButtonOpen(false);setView('add');setSearch('');pending(false);setSources([]);setTabs([]);setChats([]);},[identityKey]);
 useEffect(()=>{generation.current++;pending(false);setActive(0);},[operationKey]);
 useEffect(()=>{if(!open)return;const token=++catalogGeneration.current,key=identityKey;setError('');setSources([]);setTabs([]);setChats([]);
  const current=()=>token===catalogGeneration.current&&key===latest.current.identityKey;
  const load=<T,>(request:Promise<T>,apply:(value:T)=>void)=>{void request.then(value=>{if(current())apply(value);}).catch(()=>{if(current())setError('Some context sources could not be loaded. Close and reopen this menu to retry.');});};
  load(agent?call<ToolSource[]>('tools.catalog',{agentId:agent.id}):Promise.resolve([]),setSources);
  load(call<{tabs:ContextTab[]}>('browser.context.list'),value=>setTabs(old=>[...value.tabs,...old.filter(tab=>tab.browser==='chrome')]));
  load(call<Conversation[]>('conversations.list'),setChats);
  load(call<{tabs:ContextTab[]}>('chrome.context.list'),value=>setTabs(old=>[...old.filter(tab=>tab.browser!=='chrome'),...(value?.tabs??[])]));
  return()=>{catalogGeneration.current++;};
 },[open,identityKey]);
 useEffect(()=>()=>{generation.current++;catalogGeneration.current++;latest.current.onBusy?.(false);},[]);
 const available=sources.filter(source=>source.ready&&source.enabled),chosen=options.tools??available.map(source=>source.id);
 const attachSnapshot=(source:SelectedContext)=>{const next=selectedContexts([...(latest.current.options.sources??[]).filter(row=>row.kind!==source.kind||row.id!==source.id),source]);latest.current.change({sources:next});consume();finish();};
 async function readContext(read:()=>Promise<SelectedContext>){const token=generation.current,key=operationKey;pending(true);setError('');try{const source=await read();if(token===generation.current&&key===latest.current.operationKey)attachSnapshot(source);}catch(error){if(token===generation.current&&key===latest.current.operationKey)setError((error as Error).message);}finally{if(token===generation.current&&key===latest.current.operationKey)pending(false);}}
 const attachChat=(chat:Conversation)=>readContext(()=>call<SelectedContext>('context.chat',{conversationId:chat.conversation_id}));
 const attachTab=(tab:ContextTab)=>readContext(()=>call<SelectedContext>(tab.browser==='chrome'?'chrome.context':'browser.context',{id:tab.id,url:tab.url}));
 const filePicker=(kind:'file'|'folder')=>{consume();finish();void pick(kind);};
 const toggleFile=(id:string)=>{if(!options.files.includes(id)&&options.files.length>=20){setError('Attach up to 20 files or folders at a time.');return;}change({files:options.files.includes(id)?options.files.filter(value=>value!==id):[...options.files,id]});consume();finish();};
 const plugin=(source:ToolSource)=>{change({tools:[...new Set([...(options.tools??[]),source.id])]});consume();finish();};
 // The editor keeps keyboard focus while @ suggestions change. Native key handling
 // runs before React's send handler and prevents Enter from submitting the draft.
 useEffect(()=>{const editor=input.current;if(!typed||!open||!editor)return;const key=(event:KeyboardEvent)=>{
  if(event.isComposing||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
  if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();
  const rows=[...menu.current?.querySelectorAll<HTMLButtonElement>('[data-context-row]:not(:disabled)')??[]];if(!rows.length)return;
  const index=Math.min(active,rows.length-1);if(event.key==='Enter'){rows[index].click();return;}const next=(index+(event.key==='ArrowUp'?rows.length-1:1))%rows.length;setActive(next);rows[next].scrollIntoView({block:'nearest'});
 };editor.addEventListener('keydown',key);return()=>editor.removeEventListener('keydown',key);},[typed,open,active,query,busy,operationKey]);
 useLayoutEffect(()=>{const rows=[...menu.current?.querySelectorAll<HTMLButtonElement>('[data-context-row]:not(:disabled)')??[]],selected=rows[Math.min(active,Math.max(0,rows.length-1))];for(const row of rows)if(typed)row.setAttribute('aria-selected',String(row===selected));onActiveOption?.(typed?selected?.id:undefined);});
 let rowNumber=0,matchCount=0;
 const row=(icon:React.ReactNode,label:string,description:string,action:()=>void,selected?:boolean,blocked=false)=>{const id=(menuId??'composer-context')+'-option-'+rowNumber++;matchCount++;return <button key={id} id={id} type="button" data-context-row role={typed?'option':'menuitem'} className="composer-add-row" disabled={blocked||busy} onMouseDown={typed?event=>event.preventDefault():undefined} onClick={action}>{icon}<span className="add-row-name">{label}</span>{description&&<span className="add-row-description">{description}</span>}{selected&&<Check size={15} className="add-row-check"/>}</button>;};
 const addActions=()=><><div className="composer-add-label">Add</div>{row(<Paperclip size={16}/>,'Files and folders','',()=>filePicker('file'))}{!typed&&row(<AtSign size={16}/>,'Attach context','Files, chats, tabs and agents',()=>{setView('context');setSearch('');})}{!typed&&shareWindows&&row(<Monitor size={16}/>,'Application windows','Share a window for Computer Use',()=>{consume();close();shareWindows();},undefined,request||!['ask','full'].includes(options.permission))}{row(<Target size={16}/>,'Goal','Set a goal to keep pursuing',()=>{consume();finish();goal();},undefined,!agent||request)}{row(<Lightbulb size={16}/>,'Plan mode',options.mode==='plan'?'Turn plan mode off':'Turn plan mode on',()=>{change({mode:options.mode==='plan'?'chat':'plan'});consume();finish();},options.mode==='plan')}</>;
 const plugins=()=><><div className="composer-add-label">Plugins & apps</div>{available.filter(source=>matches(pluginName(source.name)+' '+source.name+' '+source.detail)).map(source=>row(source.kind==='web'?<Globe size={16}/>:<Plug size={16}/>,pluginName(source.name),source.detail,()=>plugin(source),chosen.includes(source.id)&&options.tools!==undefined))}</>;
 const context=()=><>
  <div className="composer-add-label">Files and folders</div>{!typed&&<>{row(<Paperclip size={16}/>,'Add files','',()=>filePicker('file'))}{row(<Folder size={16}/>,'Add folder','',()=>filePicker('folder'))}</>}
  {files.filter(file=>matches(file.name)).map(file=>row(file.kind==='folder'?<Folder size={16}/>:<Paperclip size={16}/>,file.name,file.kind==='folder'?'Folder':'File',()=>toggleFile(file.id),options.files.includes(file.id)))}
  {typed&&!query&&row(<Folder size={16}/>,'Add folder','',()=>filePicker('folder'))}
  <div className="composer-add-label">Agents</div>{agents.filter(peer=>peer.active!==false&&matches(peer.name+' '+(peer.handle??''))).map(peer=>row(<Bot size={16}/>,peer.name,peer.handle?'@'+peer.handle:peer.role||'',()=>{const range=mention??undefined;finish();selectAgent(peer,range);},peer.id===agent?.id,request))}
  {plugins()}<div className="composer-add-label">Tabs</div>{tabs.filter(tab=>matches(tab.title+' '+tab.url+' '+(tab.conversationTitle??''))).map(tab=>row(<Globe size={16}/>,tab.title||tab.url,(tab.status==='saved'?'Saved tab · open before attaching · ':tab.browser==='chrome'?'Chrome · ':'Agentopia · ')+tab.url,()=>void attachTab(tab),options.sources?.some(source=>source.kind==='browser'&&source.id===tab.id),tab.status==='saved'))}
  <div className="composer-add-label">Chats</div>{chats.filter(chat=>!chat.archived&&chat.conversation_id!==scope&&matches(chat.title||'Untitled chat')).slice(0,20).map(chat=>row(<MessageSquare size={16}/>,chat.title||'Untitled chat','Attach saved text snapshot',()=>void attachChat(chat),options.sources?.some(source=>source.kind==='chat'&&source.id===chat.conversation_id)))}
 </>;
 return <Popover.Root open={open} onOpenChange={next=>{if(!next){close();return;}setButtonOpen(true);setView('add');setSearch('');setActive(0);}}>
  <Popover.Anchor asChild><span className="composer-add-anchor"/></Popover.Anchor><Popover.Trigger asChild><button ref={trigger} type="button" className="icon-button add-context" aria-label="Add to chat" title="Add files and more" disabled={disabled}><Plus size={20}/></button></Popover.Trigger>
  <Popover.Portal><Popover.Content ref={attachMenu} className="composer-add-menu" side="top" align="start" sideOffset={10} collisionPadding={14} style={{width}} onOpenAutoFocus={event=>{if(typed)event.preventDefault();}} onInteractOutside={event=>{if(typed&&event.target===input.current)event.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();if(typed)input.current?.focus();else trigger.current?.focus();}} onKeyDown={event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||(event.target as HTMLElement).tagName==='INPUT')return;const items=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-context-row]:not(:disabled)')],index=items.indexOf(document.activeElement as HTMLButtonElement);if(!items.length)return;event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?items.length-1:1))%items.length].focus();}}>
   {!typed&&currentView==='context'&&<><div className="composer-add-heading"><button type="button" className="icon-button" aria-label="Back to Add" onClick={()=>{setView('add');setSearch('');}}><ArrowLeft size={16}/></button><span>Attach context</span></div><label className="composer-context-search"><Search size={16}/><input autoFocus aria-label="Search context" placeholder="Search files, chats, tabs or @agents" value={search} onChange={event=>{setSearch(event.target.value);setActive(0);}}/></label></>}
   <div id={menuId} role={typed?'listbox':'menu'} aria-label={typed?'Choose context':currentView==='add'?'Add to chat':'Context sources'}>{currentView==='add'?<>{addActions()}{plugins()}</>:<>{typed&&!query&&addActions()}{context()}{!matchCount&&<p className="composer-context-hint" role="status">No matching context.</p>}</>}</div>
   {error&&<p className="composer-context-error" role="alert">{error}</p>}{busy&&<p role="status" className="composer-context-hint">Reading selected context…</p>}
  </Popover.Content></Popover.Portal>
 </Popover.Root>;
}
