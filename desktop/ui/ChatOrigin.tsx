import React,{useContext} from 'react';
import {MessageSquare} from 'lucide-react';
import type {ChatDeliveryProvenance} from '../src/chat-origin';
import {WorkspaceLinks} from './WorkspaceLinks';
import './chat-delivery.css';
export function ChatOrigin({source}:{source:ChatDeliveryProvenance}){
 const workspace=useContext(WorkspaceLinks);
 return <button type="button" className="inline-link chat-origin" aria-label={'Open message from '+source.sourceAgentName+' in its source chat'} title="Open source message" onClick={()=>workspace.link(source.citation)}><MessageSquare size={12}/><span>Sent by {source.sourceAgentName} from another chat</span></button>;
}
