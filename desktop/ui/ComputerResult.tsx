import React,{useState} from 'react';
import {MessageAttachments} from './Attachments';

export function ComputerResult({name,result}:{name:string;result:any}){
 const [expanded,setExpanded]=useState(false),value=result&&typeof result==='object'?result:{value:result};
 const content=Array.isArray(value.content)?value.content:[],{content:omitted,...metadata}=value;
 const capture=name==='computer_snapshot',listing=name==='computer_windows',window=value.observation?.window??value.window,windows=Array.isArray(value.windows)?value.windows:[];
 const title=listing?'Shared windows':capture?'Window captured':value.sent===true?'Input sent':value.denied===true?'Input declined':'Input result';
 const images=content.filter((part:any)=>part.type==='image'&&['image/png','image/jpeg','image/webp'].includes(part.mimeType)).map((part:any,index:number)=>({name:(capture?'Captured window':'Window after input')+(index?' '+(index+1):''),image:'data:'+part.mimeType+';base64,'+part.data}));
 return <section className="computer-result" aria-label="Windows tool result">
  <strong>{title}</strong>
  {window&&<p className="computer-result-window" title={String(window.title??window.app??'Shared window')}>{String(window.title??window.app??'Shared window')}</p>}
  {listing&&<ul className="computer-result-windows">{windows.map((item:any,index:number)=><li key={index}><span title={String(item.title??item.app??'Shared window')}>{String(item.title??item.app??'Shared window')}</span>{item.available===false&&<small>Unavailable</small>}</li>)}</ul>}
  {listing&&!windows.length&&<p>No windows are shared with this turn.</p>}
  {capture&&<p>Saved screenshot{Array.isArray(value.nodes)?' · '+value.nodes.length+' observed controls':''}{value.truncated?' · Control list shortened':''}.</p>}
  {value.sent===true&&<p className="computer-result-outcome">{value.observation_error?'A new window image is unavailable. Check the application before continuing.':'Review the resulting window to confirm the outcome.'}</p>}
  {!!images.length&&<MessageAttachments files={images}/>}
  <details className="computer-result-record" onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Technical result</summary>{expanded&&<><pre className="tool-output" aria-label="Windows result metadata">{JSON.stringify(metadata,null,2)}</pre>{content.filter((part:any)=>part.type==='text').map((part:any,index:number)=><pre className="tool-output" key={index}>{part.text}</pre>)}</>}</details>
 </section>;
}
