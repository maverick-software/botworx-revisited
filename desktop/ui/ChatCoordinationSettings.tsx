import React,{useEffect,useState} from 'react';
import {ArrowLeftRight,MessageSquare} from 'lucide-react';
import type {ChatCoordinationGrant} from '../src/chat-delivery';
import {call} from './ui';
import './chat-delivery.css';

export function ChatCoordinationSettings({owner}:{owner:string}){
 const [rows,setRows]=useState<ChatCoordinationGrant[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;setLoading(true);setError('');void call<ChatCoordinationGrant[]>('chat.delivery.grants',{owner}).then(value=>{if(live)setRows(value);}).catch(error=>{if(live)setError(error.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[owner]);
 async function revoke(id:string){if(busy)return;setBusy(id);setError('');try{await call('chat.delivery.revoke',{owner,id});setRows(value=>value.filter(row=>row.id!==id));}catch(error){setError((error as Error).message);}finally{setBusy(null);}}
 return <section className="chat-coordination-settings" aria-label="Chat coordination permissions"><h3>Chat coordination</h3><p className="hint">These chat pairs can exchange messages within their current projects. Revoking a permission stops work using it; future messages need your approval.</p>{loading?<p role="status">Loading chat permissions…</p>:rows.length?rows.map(row=><div key={row.id} className="settings-list-row"><MessageSquare size={18}/><div><strong title={row.firstTitle}>{row.firstTitle}</strong><small><ArrowLeftRight size={12}/><span title={row.secondTitle}>{row.secondTitle}</span></small></div><button className="secondary" disabled={!!busy} onClick={()=>void revoke(row.id)}>{busy===row.id?'Revoking…':'Revoke'}</button></div>):<p className="hint">No chat pairs have ongoing permission.</p>}{error?<p role="alert" className="tool-error">{error}</p>:null}</section>;
}
