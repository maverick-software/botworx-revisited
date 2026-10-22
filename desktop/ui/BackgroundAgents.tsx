import {ChildChats} from './ChildChats';
import React,{useContext,useEffect,useState} from 'react';
import {Workflow} from 'lucide-react';
import type {NativeChildView} from '../src/native-contracts';
import {NativeChildCard} from './NativeTurn';
import {call,Modal} from './ui';

export function BackgroundAgents({owner}:{owner?:string}){
 const chats=useContext(ChildChats);
 const [open,setOpen]=useState(false),[children,setChildren]=useState<NativeChildView[]>([]),[error,setError]=useState('');
 useEffect(()=>{setOpen(false);setChildren([]);setError('');if(!owner)return;let disposed=false,loading=false,again=false,eventTimer:ReturnType<typeof setTimeout>|undefined;
  const refresh=async()=>{if(loading){again=true;return;}loading=true;try{const rows=await call<NativeChildView[]>('native.children');if(!disposed){setChildren(rows);setError('');}}catch(e){if(!disposed)setError((e as Error).message);}finally{loading=false;if(again&&!disposed){again=false;void refresh();}}};
  void refresh();const off=window.agentopia.onChat(e=>{if(e.ownerId===owner&&(e.kind==='native-background'||e.kind==='native')){if(!eventTimer)eventTimer=setTimeout(()=>{eventTimer=undefined;void refresh();},400);}});const timer=setInterval(()=>void refresh(),10000);return()=>{disposed=true;off();clearInterval(timer);if(eventTimer)clearTimeout(eventTimer);};
 },[owner]);
 if(!owner)return null;const working=children.filter(c=>c.child.status==='running'||c.child.delivery==='running').length;
 return <><button className="background-agents-button" aria-label="Background agents" title="Background agents" onClick={()=>setOpen(true)}><Workflow size={19}/>{working>0&&<span>{working}</span>}</button>{open&&<Modal title="Background agents" className="background-agents-dialog" close={()=>setOpen(false)}><p className="hint">Subagents keep working after their parent response ends while Agentopia is open. Their results return to the main agent. Closing or signing out stops active work; saved transcripts remain available.</p>{error&&<p role="alert" className="danger">{error}</p>}{children.map(c=><div key={c.requestId+c.child.threadId}><small>{c.provider==='openrouter'?'OpenRouter':'ChatGPT'} · {c.model}</small><button className="subtle-link" onClick={()=>{setOpen(false);chats.open(c);}}>Open subagent chat</button><NativeChildCard child={c.child} requestId={c.requestId}/></div>)}{!children.length&&<p>No subagents yet. Ask an agent to delegate work in the background.</p>}</Modal>}</>;
}
