import React,{useEffect,useState} from 'react';
import {ArrowUp,Pencil,Play,X} from 'lucide-react';
import type {QueuedChat} from '../src/chat-queue';
import {call} from './ui';
import {ChatOrigin} from './ChatOrigin';
import {ChatDeliveryReview} from './ChatDeliveryReview';

export function QueuedMessages({owner,conversation,request,turnId,error,openScheduled}:{owner:string;conversation:string|null;request:string|null;turnId?:string;error:(message:string)=>void;openScheduled?:()=>void}){
 const [rows,setRows]=useState<QueuedChat[]>([]),[editing,setEditing]=useState<string|null>(null),[text,setText]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true;setRows([]);setEditing(null);
  const load=()=>{if(conversation)void call<QueuedChat[]>('chat.queue.list',{conversationId:conversation}).then(rows=>{if(live)setRows(rows);}).catch(e=>{if(live)error(e.message);});};
  load();const off=window.agentopia.onChat(event=>{if(event.ownerId===owner&&event.kind==='queue'&&event.conversationId===conversation)load();});
  return()=>{live=false;off();};
 },[owner,conversation]);
 async function operate(task:()=>Promise<unknown>){
  if(busy)return;setBusy(true);
  try{await task();setRows(await call<QueuedChat[]>('chat.queue.list',{conversationId:conversation}));}
  catch(e){error((e as Error).message);}finally{setBusy(false);}
 }
 async function action(row:QueuedChat,kind:'remove'|'edit'|'resume'|'steer'|'stop'){
  await operate(async()=>{
   if(kind==='steer')await call('chat.queue.steer',{id:row.id,requestId:request,turnId});
   else if(kind==='stop')await call(row.scheduledRunId?'chat.queue.change':'chat.cancel',row.scheduledRunId?{id:row.id,action:'remove'}:{requestId:row.incoming?.receivingRequestId??row.id});
   else await call('chat.queue.change',{id:row.id,action:kind,...(kind==='edit'?{text}:{})});
   if(kind==='edit')setEditing(null);
  });
 }
 const authorize=(row:QueuedChat,decision:'once'|'pair'|'deny')=>operate(()=>call('chat.delivery.authorize',{id:row.deliveryId,decision}));
 if(!rows.length)return null;
 return <section className="queued-messages" aria-label="Queued messages"><small>Queued · {rows.length}</small>{rows.map(row=><div key={row.id} className="queued-message">
  {row.incoming?<ChatOrigin source={row.incoming.source}/>:null}
  {row.scheduled&&<small>Scheduled · {row.scheduled.name}</small>}
  {editing===row.id?<form onSubmit={event=>{event.preventDefault();void action(row,'edit');}}><textarea aria-label="Edit queued message" value={text} onChange={event=>setText(event.target.value)} autoFocus maxLength={100000}/><button disabled={busy||!text.trim()}>Save</button><button type="button" className="subtle-link" onClick={()=>setEditing(null)}>Cancel</button></form>:<>
   <span title={row.text}>{row.text}</span>
   <div className="queued-actions">
    {row.status==='starting'?<><small>Sending…</small><button aria-label="Stop sending queued message" disabled={busy} onClick={()=>void action(row,'stop')}><X size={14}/></button></>:<>
     {request&&turnId&&!row.scheduledRunId&&row.status==='queued'&&(!row.incoming||row.incoming.canSteer)?<button title="Steer the current turn with this message" aria-label="Steer queued message" disabled={busy} onClick={()=>void action(row,'steer')}><ArrowUp size={13}/>Steer</button>:null}
     {row.status==='held'&&!row.scheduledRunId&&!request&&!row.incoming?.uncertain&&!row.incoming?.requiresAuthorization?<button aria-label="Resume queued message" title="Resume queue" disabled={busy} onClick={()=>void action(row,'resume')}><Play size={14}/></button>:null}
     {!row.incoming&&!row.scheduledRunId?<button aria-label="Edit queued message" title={row.status==='queued'?'Edit queued message':'Review the saved conversation before editing an interrupted send'} disabled={busy||row.status!=='queued'} onClick={()=>{setEditing(row.id);setText(row.text);}}><Pencil size={14}/></button>:null}
     {row.scheduledRunId&&openScheduled&&<button disabled={busy} onClick={openScheduled}>Manage task</button>}
     <button aria-label="Remove queued message" disabled={busy} onClick={()=>void action(row,'remove')}><X size={14}/></button>
    </>}
   </div>
   {row.error?<small className="queue-error">{row.error}</small>:null}
   {row.incoming?.review&&row.incoming.requiresAuthorization&&!row.incoming.uncertain?<details className="queue-incoming-review"><summary>Review incoming message</summary><ChatDeliveryReview approval={row.incoming.review}/><div className="tool-actions chat-delivery-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>void authorize(row,'deny')}>Don't send</button><button type="button" className="secondary" disabled={busy} onClick={()=>void authorize(row,'once')}>Send once</button><button type="button" disabled={busy} onClick={()=>void authorize(row,'pair')}>Allow these chats</button></div></details>:null}
  </>}
 </div>)}</section>;
}
