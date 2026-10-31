import React,{useContext,useEffect,useRef,useState} from 'react';
import {FileText,Folder,Paperclip,X,Globe,MessageSquare,Image as ImageIcon} from 'lucide-react';
import type {FileReference,FileSelection,FileContext} from '../src/contracts';
import {call,Modal} from './ui';
import {WorkspaceLinks} from './WorkspaceLinks';
import {compactLabel} from './composer-labels';
import {documentCount} from './DocumentPreview';

export function useAttachmentInput({owner,scope,enabled,imported,error}:{owner:string|null;scope:string;enabled:boolean;imported:(selection:FileSelection)=>void;error:(message:string)=>void}){
 const [dragging,setDragging]=useState(false),[busy,setBusy]=useState(false),depth=useRef(0),working=useRef(false);
 const latest=useRef({owner,scope,enabled,imported,error});latest.current={owner,scope,enabled,imported,error};
 useEffect(()=>{depth.current=0;setDragging(false);},[owner,scope,enabled]);
 useEffect(()=>{const reset=()=>{depth.current=0;setDragging(false);},escape=(event:KeyboardEvent)=>{if(event.key==='Escape')reset();};window.addEventListener('blur',reset);window.addEventListener('dragend',reset);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('blur',reset);window.removeEventListener('dragend',reset);window.removeEventListener('keydown',escape);};},[]);
 useEffect(()=>{const prevent=(event:DragEvent)=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();};window.addEventListener('dragover',prevent);window.addEventListener('drop',prevent);return()=>{window.removeEventListener('dragover',prevent);window.removeEventListener('drop',prevent);};},[]);
 const attach=async(files:File[])=>{
  const start=latest.current;if(!start.owner||!start.enabled||working.current||!files.length)return;
  if(files.length>20){start.error('Attach up to 20 files or folders at a time.');return;}
  working.current=true;setBusy(true);
  try{const selection=await window.sylvana.attach(files,start.owner);if(latest.current.owner===start.owner&&latest.current.scope===start.scope&&latest.current.enabled)latest.current.imported(selection);}
  catch(failure){if(latest.current.owner===start.owner&&latest.current.scope===start.scope)latest.current.error((failure as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}
  finally{working.current=false;setBusy(false);}
 };
 const fileDrag=(event:React.DragEvent)=>event.dataTransfer.types.includes('Files');
 return {busy,dragging,handlers:{
  onDragEnter:(event:React.DragEvent)=>{if(!fileDrag(event))return;event.preventDefault();if(latest.current.enabled){depth.current++;setDragging(true);}},
  onDragOver:(event:React.DragEvent)=>{if(!fileDrag(event))return;event.preventDefault();event.dataTransfer.dropEffect=latest.current.enabled&&!working.current?'copy':'none';},
  onDragLeave:(event:React.DragEvent)=>{if(!fileDrag(event))return;event.preventDefault();if(--depth.current<=0){depth.current=0;setDragging(false);}},
  onDrop:(event:React.DragEvent)=>{if(!fileDrag(event))return;event.preventDefault();depth.current=0;setDragging(false);void attach(Array.from(event.dataTransfer.files));},
 },paste:(event:React.ClipboardEvent<HTMLTextAreaElement>)=>{const files=Array.from(event.clipboardData.files);if(!files.length)return;event.preventDefault();void attach(files);}};
}

export function AttachmentCards({files,disabled,remove}:{files:FileReference[];disabled:boolean;remove:(id:string)=>void}){
 const [preview,setPreview]=useState<{name:string;image:string}|null>(null);
 return <><div className="attachment-cards" aria-label="Message attachments">{files.map(file=><AttachmentCard key={file.id} file={file} disabled={disabled} remove={()=>remove(file.id)} preview={image=>setPreview({name:file.name,image})}/>)}</div>{preview&&<Modal title={preview.name} close={()=>setPreview(null)} className="attachment-preview-dialog"><img src={preview.image} alt={preview.name}/><p className="hint">This preview is local. Sharing follows the message’s permissions.</p></Modal>}</>;
}
function AttachmentCard({file,disabled,remove,preview}:{file:FileReference;disabled:boolean;remove:()=>void;preview:(image:string)=>void}){
 const workspace=useContext(WorkspaceLinks);
 const [image,setImage]=useState(''),[failure,setFailure]=useState('');
 const isImage=file.source==='clipboard'||/\.(png|jpe?g|webp)$/i.test(file.name);
 useEffect(()=>{let live=true;setImage('');setFailure('');if(isImage)void call<{image:string}>('files.preview',{id:file.id}).then(value=>{if(live)setImage(value.image);}).catch(error=>{if(live)setFailure((error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));});return()=>{live=false;};},[file.id,isImage]);
 return <div className={'attachment-card '+(isImage?'image-attachment':'')} title={failure||(isImage?file.name:file.path)}>
  {isImage?<button type="button" className="attachment-image" aria-label={'Preview '+file.name} disabled={!image} onClick={()=>preview(image)}>{image?<img src={image} alt={file.name}/>:<ImageIcon size={24}/>}</button>:<button type="button" className="attachment-file-icon" aria-label={'Preview '+file.name} disabled={file.kind==='folder'} onClick={()=>workspace.file(file.id,'')}>{file.kind==='folder'?<Folder size={23}/>:<FileText size={23}/>}</button>}
  <div className="attachment-details"><strong>{isImage?file.name:compactLabel(file.name)}</strong><small>{failure?'Image unavailable':file.source==='clipboard'?'Pasted image':file.kind==='folder'?'Folder':isImage?'Image':/\.pdf$/i.test(file.name)?'PDF':/\.docx$/i.test(file.name)?'Word':/\.xlsx$/i.test(file.name)?'Spreadsheet':/\.pptx$/i.test(file.name)?'Presentation':'Document'}</small></div>
  <button type="button" className="attachment-remove" aria-label={'Remove '+file.name} disabled={disabled} onClick={remove}><X size={14}/></button>
 </div>;
}
export function AttachmentDropOverlay(){return <div className="attachment-drop-overlay" role="status"><Paperclip size={30}/><strong>Add files to this chat</strong><span>Drop files, images, or a folder</span><small>Review attachments before sending</small></div>;}
export function MessageAttachments({files}:{files:FileContext[]}){
 const workspace=useContext(WorkspaceLinks);
 const [preview,setPreview]=useState<FileContext|null>(null);
 return <><div className="message-files">{files.map((file,index)=>file.image?<button type="button" className="message-image" key={index} aria-label={'View '+file.name} title={file.name} onClick={()=>setPreview(file)}><img src={file.image} alt={file.name}/><small>{file.name}</small></button>:<details key={index}><summary title={file.name}>{file.source?.kind==='browser'?<Globe size={14}/>:file.source?.kind==='chat'?<MessageSquare size={14}/>:<Paperclip size={14}/>}<span>{compactLabel(file.name)}</span></summary><small className="message-file-description">{file.name}{file.document?' · '+documentCount(file.document):file.fileCount?' · '+file.fileCount+' file'+(file.fileCount===1?'':'s'):''}</small>{file.source&&<><small>Captured {new Date(file.source.capturedAt).toLocaleString()}</small><button type="button" onClick={()=>file.source!.kind==='chat'?workspace.openChat(file.source!.id):workspace.browser(file.source!.url)}>Open source</button></>}{file.notice&&<small>{file.notice}</small>}{file.text&&<pre>{file.text}</pre>}</details>)}</div>{preview&&<Modal title={preview.name} close={()=>setPreview(null)} className="attachment-preview-dialog"><img src={preview.image} alt={preview.name}/><p className="hint">Original image saved with this message.</p></Modal>}</>;
}
