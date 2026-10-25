import React,{useEffect,useState} from 'react';
import {ArrowRight,Check,Plug,RefreshCw} from 'lucide-react';
import type {ComposioMcpStatus} from '../src/composio-mcp-contracts';
import {call} from './ui';

export function ComposioConnectionCard({open,compact=false}:{open:()=>void;compact?:boolean}){
 const [status,setStatus]=useState<ComposioMcpStatus|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;setStatus(null);setError('');
  void call<ComposioMcpStatus>('composio.mcp.status').then(value=>{if(current)setStatus(value);}).catch(error=>{if(current)setError((error as Error).message);});
  return()=>{current=false;};
 },[revision]);
 const configured=status?.connected===true,action=status===null?'Open':configured?'Manage':'Connect';
 if(compact)return <article className="plugin-catalog-row" aria-label="Composio connection"><span className="plugin-catalog-logo"><Plug size={23}/></span><button className="plugin-catalog-info" onClick={open}><strong>Composio</strong><small>{error?'Connection status unavailable':configured?'Composio account connected':'Connect your Composio account'}</small></button><button className="icon-button" aria-label={action+' Composio'} title={action+' Composio'} onClick={open}><ArrowRight size={18}/></button></article>;
 return <article className="plugin-card" aria-label="Composio connection">
  <div className="card-top"><span className="plugin-icon"><Plug size={26}/></span><span className={'connection-state '+(configured?'connected':'')} role="status">{configured&&<Check size={13}/>} {error?'Status unavailable':status===null?'Checking connection…':configured?'Account connected':'Not connected'}</span></div>
  <h2>Composio</h2><p>Sign in with your Composio account and choose which agents may use its connected apps.</p>
  <small>Connected separately for each user</small>
  {error&&<div><p role="alert">{error}</p><button className="subtle-link" onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14}/>Retry connection status</button></div>}
  <button className="secondary" aria-label={action+' Composio'} onClick={open}>{action}<ArrowRight size={16}/></button>
 </article>;
}
