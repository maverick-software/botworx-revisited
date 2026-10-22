import React,{useContext,useState} from 'react';
import {MessageAttachments} from './Attachments';
import {WorkspaceLinks} from './WorkspaceLinks';
import type {ToolActivity} from '../src/tool-contracts';

const list=(value:unknown):any[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const bytes=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value>=1024*1024?(value/1024/1024).toFixed(1)+' MB':value>=1024?Math.ceil(value/1024)+' KB':value+' B':'Size unavailable';
function Disclosure({label,children}:{label:string;children:()=>React.ReactNode}){
 const [open,setOpen]=useState(false);
 return <details className="browser-result-disclosure" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{label}</summary>{open&&children()}</details>;
}
export function BrowserResult({name,result,status}:{name:string;result:unknown;status:ToolActivity['status']}){
 const workspace=useContext(WorkspaceLinks),value:Record<string,any>=result&&typeof result==='object'&&!Array.isArray(result)?result:{value:result};
 const {content:omitted,...metadata}=value,content=list(value.content),files=list(value.files),tabs=list(value.tabs),downloads=list(value.downloads);
 const interrupted=status==='interrupted'||status==='failed',declined=status==='denied'||value.denied===true,reading=name==='browser_snapshot'||name==='browser_frame_snapshot',capture=name==='browser_screenshot';
 const images=content.filter(part=>part?.type==='image'&&['image/png','image/jpeg','image/webp'].includes(part.mimeType)&&typeof part.data==='string').map((part,index)=>({name:'Browser screenshot'+(index?' '+(index+1):''),image:'data:'+part.mimeType+';base64,'+part.data}));
 const selection=name==='browser_upload'||name==='browser_upload_folder',cleared=value.status==='cleared'||value.action==='clear_files',site=text(value.frame_url)||text(value.url);
 const title=declined?'Browser action declined':interrupted?'Browser action incomplete':reading?'Page read':capture?images.length?'Screenshot saved':'Screenshot result':name==='browser_list'?'Browser tabs':name==='browser_frames'?'Embedded documents':name==='browser_downloads'?'Browser downloads':value.closed===true?'Tab closed':value.status==='restored'?'Tab restored':name==='browser_open'?'Page opened':selection?cleared?'File selection cleared':name==='browser_upload_folder'?'Folder selection sent':'File selection sent':({browser_click:'Click sent',browser_move:'Pointer moved',browser_drag:'Drag sent',browser_scroll:'Scroll sent',browser_select:'Options selected',browser_press:'Key sent'} as Record<string,string>)[name]??(value.action==='fill'?'Text sent':value.action==='click'?'Click sent':value.action==='scroll'?'Scroll sent':'Browser result');
 const counted=(count:number,label:string)=>count+' '+label+(count===1?'':'s');
 const counts=reading?[counted(list(value.elements).length,'control'),...(list(value.file_inputs).length?[counted(list(value.file_inputs).length,'upload field')]:[]),...(list(value.frames).length?[counted(list(value.frames).length,'embedded document')]:[])].join(' · '):'';
 let body:React.ReactNode=null;
 if(declined)body=<p>This browser operation was declined.</p>;
 else if(interrupted)body=<p>This action did not finish. Inspect the browser before continuing.</p>;
 else if(selection)body=<>
  <p>{cleared?'The current selection was cleared. Files already received by the website are unaffected.':'The selection was sent to this page. Check the site to confirm receipt.'}</p>
  {!!text(value.folder)&&<p className="browser-result-title" title={value.folder}>{value.folder}</p>}
  {!!files.length&&<Disclosure label={files.length+' '+(files.length===1?'file':'files')} children={()=><>
   <ul className="browser-result-files">{files.slice(0,100).map((file,index)=><li key={index}><span>{text(file.relativePath)||text(file.name)||'Attached file'}</span><small>{bytes(file.bytes)}</small></li>)}</ul>
   {files.length>100&&<p>Showing the first 100 files. The full record is in Technical result.</p>}
  </>}/>}
 </>;
 else if(reading)body=<><p>{counts}</p>{!!text(value.text)&&<Disclosure label="Page text" children={()=><pre className="tool-output browser-result-text">{value.text}</pre>}/>}</>;
 else if(name==='browser_list')body=tabs.length?<ul className="browser-result-tabs">{tabs.slice(0,16).map((tab,index)=><li key={index}>
  {typeof tab.tab_id==='string'&&typeof tab.url==='string'?<button className="subtle-link" onClick={()=>workspace.browserTab(tab.tab_id,tab.url)}><span title={text(tab.title)||tab.url}>{text(tab.title)||tab.url}</span><small>{tab.status==='saved'?'Saved tab':'Open tab'}</small></button>:<span>{text(tab.title)||text(tab.url)||'Browser tab'}</span>}
 </li>)}</ul>:<p>No browser tabs in this chat.</p>;
 else if(name==='browser_frames')body=<p>{list(value.frames).length} embedded documents in this result{value.next_frame_offset!==null&&value.next_frame_offset!==undefined?' · More are available':''}.</p>;
 else if(name==='browser_downloads')body=<>
  {downloads.length?<ul className="browser-result-files">{downloads.slice(0,50).map((download,index)=><li key={index}><span>{text(download.name)||'Download'}</span><small>{({choosing:'Choose save location',downloading:'Downloading',paused:'Paused',completed:'Completed',cancelled:'Cancelled',interrupted:'Interrupted'} as Record<string,string>)[download.state]??'Status unavailable'}</small></li>)}</ul>:<p>No downloads in this chat.</p>}
  {!!text(value.error)&&<p>{value.error}</p>}
 </>;
 else if(!capture){
  if(value.closed===true)body=<p>The browser tab was closed.</p>;
  else if(value.status==='restored')body=<p>The saved address was reloaded. Previous actions were not replayed.</p>;
  else if(value.status==='dispatched')body=<p>Input was sent. Check the page to confirm the outcome.</p>;
 }
 return <section className="browser-result" aria-label="Browser tool result">
  <strong>{title}</strong>
  {!!text(value.title)&&<p className="browser-result-title" title={value.title}>{value.title}</p>}
  {!!text(value.frame_url)&&!!text(value.url)&&<small className="browser-result-site" title={value.url}>Page · {value.url}</small>}
  {!!site&&<small className="browser-result-site" title={site}>{value.frame_url?'Embedded document · ':''}{site}</small>}
  {body}
  {!!images.length&&<MessageAttachments files={images}/>}
  <Disclosure label="Technical result" children={()=><><pre className="tool-output" aria-label="Browser result metadata">{JSON.stringify(metadata,null,2)}</pre>{content.filter(part=>part?.type==='text').map((part,index)=><pre className="tool-output" key={index}>{text(part.text)}</pre>)}</>}/>
 </section>;
}
