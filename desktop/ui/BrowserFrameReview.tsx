import React from 'react';
import type {ToolApproval} from '../src/tool-contracts';

export function BrowserContextSite({args}:{args:Record<string,unknown>}){
 const url=String(args.url??''),frame=typeof args.frame_url==='string'?args.frame_url:'';
 return <>{frame&&<small className="browser-input-site" title={url}>Page · {url}</small>}<small className="browser-input-site" title={frame||url}>{frame?'Embedded document · ':''}{frame||url}</small></>;
}
export function BrowserFrameReview({approval}:{approval:ToolApproval}){
 const args=approval.arguments,element=args.element as {name?:string;role?:string}|undefined;
 return <section className="external-tool-review browser-frame-review" aria-label="Embedded browser review"><strong>{approval.source} · {approval.tool}</strong><BrowserContextSite args={args}/>{!!args.frame_name&&<div className="browser-input-target"><span>{String(args.frame_name)}</span></div>}{element&&<div className="browser-input-target"><span>{element.name||element.role||'Browser control'}</span></div>}{args.action==='fill'&&<pre className="tool-output" aria-label="Text to enter">{String(args.text??'')}</pre>}{args.action==='scroll'&&<p>Scroll {String(args.direction??'down')} inside this document.</p>}<p>{approval.description}</p></section>;
}
