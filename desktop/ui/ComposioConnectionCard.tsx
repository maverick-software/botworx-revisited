import React,{useEffect,useState} from 'react';
import {ArrowRight,Check,Plug,RefreshCw} from 'lucide-react';
import type {ComposioStatus} from '../src/composio-contracts';
import {call} from './ui';

export function ComposioConnectionCard({open,compact=false}:{open:()=>void;compact?:boolean}){
 const [status,setStatus]=useState<ComposioStatus|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;setStatus(null);setError('');
  void call<ComposioStatus>('composio.status').then(value=>{if(current)setStatus(value);}).catch(error=>{if(current)setError((error as Error).message);});
  return()=>{current=false;};
 },[revision]);
 const configured=status?.configured===true,connected=status?.connections.filter(connection=>connection.enabled&&connection.status==='ACTIVE').length??0,action=status===null?'Open':configured?'Manage':'Connect';
 if(compact)return <article className="plugin-catalog-row" aria-label="Composio connection"><span className="plugin-catalog-logo"><Plug size={23}/></span><button className="plugin-catalog-info" onClick={open}><strong>Composio</strong><small>{error?'Connection status unavailable':configured?connected+' connected apps · OAuth and API keys':'Connect apps with OAuth or API keys'}</small></button><button className="icon-button" aria-label={action+' Composio'} title={action+' Composio'} onClick={open}><ArrowRight size={18}/></button></article>;
 return <article className="plugin-card" aria-label="Composio connection">
  <div className="card-top"><span className="plugin-icon"><Plug size={26}/></span><span className={'connection-state '+(configured?'connected':'')} role="status">{configured&&<Check size={13}/>} {error?'Status unavailable':status===null?'Checking connection…':configured?'Project configured':'Not connected'}</span></div>
  <h2>Composio</h2><p>Connect apps with OAuth or API keys and give their tools to your agents.</p>
  <small>Configured separately for each user{configured?' · '+connected+' connected '+(connected===1?'app':'apps'):''}</small>
  {error&&<div><p role="alert">{error}</p><button className="subtle-link" onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14}/>Retry connection status</button></div>}
  <button className="secondary" aria-label={action+' Composio'} onClick={open}>{action}<ArrowRight size={16}/></button>
 </article>;
}
