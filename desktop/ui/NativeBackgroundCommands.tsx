import React,{useEffect,useState,useRef} from 'react';
import {TerminalSquare,ChevronRight} from 'lucide-react';
import type {NativeState,NativeBackgroundCommand} from '../src/native-contracts';
import {call} from './ui';
import './native-background-commands.css';

export function NativeBackgroundCommands({state,requestId,active=false,execute}:{state:NativeState;requestId:string;active?:boolean;execute?:(action:string,args:Record<string,unknown>)=>Promise<unknown>}){
 const [commands,setCommands]=useState<NativeBackgroundCommand[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const invoke=useRef(execute??call);invoke.current=execute??call;
 const pending=state.items.filter(entry=>entry.threadId===state.threadId&&entry.item.type==='commandExecution'&&entry.item.processId&&entry.item.status==='inProgress'&&!entry.completed&&entry.background!=='stopped'&&entry.background!=='exited'&&entry.background!=='interrupted').length;
 useEffect(()=>{
  let closed=false,inFlight=false;if(active||!pending||!requestId){setCommands([]);setError('');return;}
  const itemIds=new Set(state.items.filter(entry=>entry.threadId===state.threadId).map(entry=>entry.item.id));
  const refresh=async()=>{if(inFlight)return;inFlight=true;try{const next=await invoke.current('native.background.list',{requestId,threadId:state.threadId}) as NativeBackgroundCommand[];if(!closed){setCommands(next.filter(command=>itemIds.has(command.itemId)));setError('');}}catch{if(!closed)setError('Could not refresh background commands. Retrying…');}finally{inFlight=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>{closed=true;clearInterval(timer);};
 },[requestId,state.threadId,active,pending]);
 async function stop(command:NativeBackgroundCommand){
  setBusy(command.processId);setError('');try{await invoke.current('native.background.stop',{...command});setCommands(current=>current.filter(row=>row.itemId!==command.itemId||row.processId!==command.processId));}catch(e){setError((e as Error).message);}finally{setBusy('');}
 }
 if(!commands.length&&!error)return null;
 return <details className="native-background-commands"><summary><ChevronRight size={14}/><TerminalSquare size={14}/><span>{commands.length?commands.length+' background '+(commands.length===1?'command':'commands'):'Background commands'}</span></summary><p>Commands keep running after this response and stop when their session closes.</p>{commands.map(command=><div className="native-background-command" key={command.itemId+':'+command.processId}><div><code title={command.command}>{command.command}</code><small title={command.cwd}>{command.cwd}</small></div><button type="button" className="secondary" disabled={!!busy} aria-label={'Stop background command '+command.command} onClick={()=>void stop(command)}>{busy===command.processId?'Stopping…':'Stop'}</button></div>)}{error&&<p role="alert">{error}</p>}</details>;
}
