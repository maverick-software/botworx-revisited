import React,{useContext} from 'react';
import {Globe,MessageSquare,X} from 'lucide-react';
import type {SelectedContext} from '../src/selected-context';
import {WorkspaceLinks} from './WorkspaceLinks';
import {compactLabel} from './composer-labels';

export function SelectedSourceCards({sources,disabled,remove}:{sources:SelectedContext[];disabled:boolean;remove:(source:SelectedContext)=>void}){
 const workspace=useContext(WorkspaceLinks);
 return <div className="attachment-cards" aria-label="Selected sources">{sources.map(source=><div className="attachment-card selected-source-card" key={source.kind+':'+source.id} title={source.url+'\nCaptured '+new Date(source.capturedAt).toLocaleString()+'\n'+source.notice}>
  <button type="button" className="attachment-file-icon" aria-label={'Open source '+source.title} disabled={disabled} onClick={()=>source.kind==='chat'?workspace.openChat(source.id):workspace.browser(source.url)}>{source.kind==='browser'?<Globe size={23}/>:<MessageSquare size={23}/>}</button>
  <div className="attachment-details"><strong>{compactLabel(source.title)}</strong><small>{source.kind==='browser'?'Web page':'Chat'} · Saved snapshot</small></div>
  <button type="button" className="attachment-remove" aria-label={'Remove source '+source.title} disabled={disabled} onClick={()=>remove(source)}><X size={14}/></button>
 </div>)}</div>;
}
