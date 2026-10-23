import React,{useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,Bot,Eye,CalendarClock} from 'lucide-react';
import './agent-editor-page.css';

/** Keep live chats mounted behind a separate, focusable editing page. */
export function AgentEditorPage({title,create,unsaved,busy,close,preview,automations,metadata,avatar,children}:{title:string;create:boolean;unsaved:boolean;busy:boolean;close:()=>void;preview?:()=>void;automations?:()=>void;metadata:React.ReactNode;avatar?:React.ReactNode;children:React.ReactNode}){
 const page=useRef<HTMLElement>(null),[top,setTop]=useState(32);
 useLayoutEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const blocked=[...document.querySelectorAll<HTMLElement>('nav[aria-label="Application navigation"],aside[aria-label="Workspace sidebar"],.sidebar-resizer,.workspace-columns')].map(element=>({element,inert:element.inert}));
  for(const item of blocked)item.element.inert=true;
  const bar=document.querySelector<HTMLElement>('[aria-label="Desktop navigation"]'),measure=()=>setTop(bar?.getBoundingClientRect().bottom??0);measure();
  const observer=new ResizeObserver(measure);if(bar)observer.observe(bar);page.current?.focus();
  return()=>{observer.disconnect();for(const item of blocked)item.element.inert=item.inert;if(previous?.isConnected)previous.focus();};
 },[]);
 return <section ref={page} tabIndex={-1} className="agent-editor-page" style={{top}} aria-label={create?'Create an agent':'Edit agent'} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.stopPropagation();close();}}}>
  <header className="agent-editor-page-header"><button type="button" className="subtle-link" aria-label="Close agent editor" disabled={busy} onClick={close}><ArrowLeft size={17}/>Back</button><span className="agent-editor-page-title">{create?'Create an agent':title}</span><div className="agent-editor-page-actions"><span role="status">{unsaved?'Unsaved changes':create?'New agent':'Saved configuration'}</span>{automations&&<button type="button" className="secondary" disabled={busy} onClick={automations}><CalendarClock size={17}/>Automations</button>}{preview&&<button type="button" className="secondary" title={unsaved?'Save your changes before previewing the saved agent':'Preview the saved agent'} disabled={busy||unsaved} onClick={preview}><Eye size={17}/>Preview saved agent</button>}</div></header>
  <div className="agent-editor-page-scroll"><div className="agent-editor-page-identity"><span className="agent-editor-page-avatar" aria-hidden="true">{avatar??<Bot size={30}/>}</span>{metadata}</div>{children}</div>
 </section>;
}
