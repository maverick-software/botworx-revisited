import {BrowserContextSite} from './BrowserFrameReview';
import React from 'react';
import type {ToolApproval} from '../src/tool-contracts';
export function BrowserInputReview({approval,selection}:{approval:ToolApproval;selection:boolean}){
 const args=approval.arguments,element=args.element as {name?:string;role?:string}|undefined,labels=Array.isArray(args.labels)?args.labels.map(String):[];
 return <section className="external-tool-review browser-input-review" aria-label="Browser input review"><strong>{approval.source}</strong><BrowserContextSite args={args}/><div className="browser-input-target"><span>{element?.name||element?.role||'Browser control'}</span>{!selection&&<kbd>{args.shift?'Shift + ':''}{String(args.key??'')}</kbd>}</div>{selection&&<div className="browser-input-options" aria-label="Options to select">{labels.length?labels.map(label=><span key={label}>{label||'(empty label)'}</span>):<span>Clear selection</span>}</div>}<p>{approval.description}</p></section>;
}
