import React,{useEffect,useState} from 'react';
import {ExternalLink} from 'lucide-react';
import {call,type Connections} from './ui';
import type {Run} from './Panels';

export function UsageSettings({run,connections}:{run:Run;connections:()=>void}){
 const [status,setStatus]=useState<Connections|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;void call<Connections>('providers.status').then(value=>{if(live)setStatus(value);}).catch(error=>{if(live)setError(error.message);});return()=>{live=false;};},[]);
 return <><p className="pane-intro">Review your plan allowance, requests and spending with your AI provider.</p>
 <h3>Your AI accounts</h3><div className="settings-card">
 <div className="setting-row"><div><strong>ChatGPT</strong><p>{status?.chatgpt?.authorized?'Using your ChatGPT plan':status?'Connect ChatGPT to use your plan':'Checking connection…'}</p></div><button className="secondary" onClick={()=>void run(()=>call('providers.manageUsage',{provider:'openai-oauth'}))}>Manage usage<ExternalLink size={14}/></button></div>
 <div className="setting-row"><div><strong>OpenRouter</strong><p>{status?.openrouter?'View requests, token usage and spending':status?'Connect an OpenRouter account':'Checking connection…'}</p></div><button className="secondary" onClick={()=>void run(()=>call('providers.manageUsage',{provider:'openrouter'}))}>View activity<ExternalLink size={14}/></button></div>
 </div><p className="hint">Usage dashboards open in your web browser. Your provider shows the current allowance and billing details for the account signed in there.</p>
 {error&&<p role="alert" className="pane-error">{error}</p>}
 <button className="secondary" onClick={connections}>Manage AI connections</button></>;
}
