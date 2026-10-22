import React from 'react';
import {ArrowRight,MessageSquare} from 'lucide-react';
import type {ToolApproval} from '../src/tool-contracts';
import './chat-delivery.css';

export function ChatDeliveryReview({approval}:{approval:ToolApproval}){
 const value=(name:string)=>typeof approval.arguments[name]==='string'?approval.arguments[name] as string:'';
 const permission=({ask:'Default permissions',full:'Full access',files:'Selected files',chat:'Chat only'} as Record<string,string>)[value('permission')]??value('permission');
 return <section className="chat-delivery-review" aria-label="Chat message review">
  <div className="chat-delivery-destination"><MessageSquare size={16}/><span title={value('from')}>{value('from')}</span><ArrowRight size={14}/><strong title={value('to')}>{value('to')}</strong></div>
  <p>{approval.description}</p>
  <dl><div><dt>Agent</dt><dd>{value('agent')}</dd></div><div><dt>Connection</dt><dd>{value('connection')}</dd></div><div><dt>Model</dt><dd>{value('model')}</dd></div><div><dt>Delivery</dt><dd>{value('delivery')==='steer'?'Steer current turn':'Queued message'}</dd></div><div><dt>Permissions</dt><dd>{permission}</dd></div></dl>
  {value('cost_notice')?<p className="chat-delivery-cost">{value('cost_notice')}</p>:null}
  <div className="chat-delivery-message" role="region" aria-label="Message to send" tabIndex={0}>{value('message')}</div>
 </section>;
}
