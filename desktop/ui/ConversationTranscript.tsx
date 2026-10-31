import {failureProvider} from './connection-failure';
import React,{useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Message,Agent} from '../src/contracts';
import {messageTime,needsTranscriptAttention,transcriptDateLabel} from '../src/transcript-presentation';
import {ChatMessage} from './WorkspaceViews';

export function ConversationTranscript({messages,agentName,agents=[],citedMessage,onNavigate}:{messages:Message[];agentName:string;agents?:Agent[];citedMessage:string|null;onNavigate:()=>void}){
 const anchor=useRef<HTMLSpanElement>(null),[host,setHost]=useState<HTMLElement|null>(null),[rail,setRail]=useState({top:0,height:0}),[active,setActive]=useState('');
 let ordinal=0;const prompts=messages.flatMap((message,index)=>message.role==='user'?[{id:message.id,index,ordinal:++ordinal,label:message.content.text.replace(/\s+/g,' ').trim()||'Attached context',attention:needsTranscriptAttention(message)||!!messages[index+1]&&needsTranscriptAttention(messages[index+1])}]:[]);
 // The rail is an overview; all messages stay in the normal scrolling history.
 const landmarks=prompts.length<=64?prompts:Array.from({length:64},(_,index)=>prompts[Math.round(index*(prompts.length-1)/63)]),signature=messages.map(message=>message.id).join('|');
 const promptsRef=useRef(prompts);promptsRef.current=prompts;
 useLayoutEffect(()=>{
  const area=anchor.current?.closest<HTMLElement>('.messages'),stage=area?.closest<HTMLElement>('.chat-stage');if(!area||!stage)return;setHost(stage);
  const nodes=new Map([...area.querySelectorAll<HTMLElement>('[data-message-id]')].map(node=>[node.dataset.messageId!,node]));let frame=0;
  const update=()=>{frame=0;const bounds=area.getBoundingClientRect(),stageBounds=stage.getBoundingClientRect();setRail(previous=>{const next={top:bounds.top-stageBounds.top+8,height:Math.max(0,bounds.height-16)};return previous.top===next.top&&previous.height===next.height?previous:next;});let current=promptsRef.current[0]?.id??'';for(const prompt of promptsRef.current){const node=nodes.get(prompt.id);if(node&&node.getBoundingClientRect().top<=bounds.top+Math.min(120,bounds.height*.3))current=prompt.id;else if(node)break;}setActive(current);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};update();area.addEventListener('scroll',schedule,{passive:true});const observer=new ResizeObserver(schedule);observer.observe(area);observer.observe(stage);if(area.firstElementChild)observer.observe(area.firstElementChild);
  return()=>{area.removeEventListener('scroll',schedule);observer.disconnect();cancelAnimationFrame(frame);};
 },[signature]);
 const currentIndex=prompts.find(prompt=>prompt.id===active)?.index??-1,currentLandmark=landmarks.filter(prompt=>prompt.index<=currentIndex).at(-1)?.id;
 function jump(id:string){const area=anchor.current?.closest<HTMLElement>('.messages'),node=[...(area?.querySelectorAll<HTMLElement>('[data-message-id]')??[])].find(node=>node.dataset.messageId===id);if(!area||!node)return;onNavigate();area.scrollTo({top:area.scrollTop+node.getBoundingClientRect().top-area.getBoundingClientRect().top-30,behavior:'instant'});setActive(id);}
 const transcript=messages.map((message,index)=>{
  const authorName=message.metadata.agent?.name??agents.find(agent=>agent.id===message.sender_agent_id)?.name??agentName;
  const time=messageTime(messages,index),previous=index>0?messageTime(messages,index-1):undefined,divider=time&&(!previous||Date.parse(time)-Date.parse(previous)>=30*60*1000||new Date(time).toDateString()!==new Date(previous).toDateString());
  return <React.Fragment key={message.role==='assistant'?(message.metadata.timing?.requestId??message.id):message.id}>{divider&&<time className="transcript-date" dateTime={time}>{transcriptDateLabel(time)}</time>}<ChatMessage message={message} provider={failureProvider(message,messages[index-1])} agentName={authorName} cited={message.id===citedMessage}/></React.Fragment>;
 });
 return <><span ref={anchor} hidden/>{host&&landmarks.length>1&&createPortal(<nav className="conversation-timeline" aria-label="Conversation timeline" style={{top:rail.top,height:rail.height}}><div className="timeline-track">{landmarks.map(prompt=><button key={prompt.id} type="button" className={'timeline-stop'+(prompt.attention?' needs-attention':'')} aria-label={'Jump to message '+prompt.ordinal+': '+prompt.label.slice(0,160)} aria-current={currentLandmark===prompt.id?'location':undefined} title={prompt.label.slice(0,160)+(prompt.attention?' · Needs attention':'')} onClick={()=>jump(prompt.id)}><span aria-hidden="true"/></button>)}</div></nav>,host)}{transcript}</>;
}
