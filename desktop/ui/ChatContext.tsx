import React,{useContext,useEffect,useMemo,useState} from 'react';
import {FileDiff,FileText,FolderOpen,Globe,MessageSquare,Image as ImageIcon,Link,MoreHorizontal,Plus,SlidersHorizontal,X} from 'lucide-react';
import type {FileContext,FileReference,Message,Project} from '../src/contracts';
import {selectedContextFiles,type SelectedContext} from '../src/selected-context';
import {changedFiles} from '../src/turn-presentation';
import {nativeChanges} from '../src/native-change-presentation';
import {WorkspaceLinks} from './WorkspaceLinks';
import {MessageAttachments} from './Attachments';
import {call,Menu,MenuItem,Modal} from './ui';
import './chat-context.css';
import {scheduleChatSelected,useScheduledWorkspace} from './ScheduledTasks';

// Remember the roomy-layout preference; narrow layouts open details only on request.
export function useChatContext(owner?:string){
 const key='sylvana.chat-context.'+(owner??'session');
 const read=()=>{try{return localStorage.getItem(key);}catch{return null;}};
 const [choice,setChoice]=useState<{key:string;value:string|null}>(()=>({key,value:read()}));
 const roomy=()=>{const area=document.querySelector('.workspace-columns');return (area?.getBoundingClientRect().width??window.innerWidth-296)>=1120;};
 const [layout,setLayout]=useState(()=>({roomy:roomy(),requested:false}));
 useEffect(()=>{
  const area=document.querySelector('.workspace-columns'),measure=()=>{const next=roomy();setLayout(current=>current.roomy===next?current:{roomy:next,requested:false});};
  setLayout({roomy:roomy(),requested:false});
  const observer=area?new ResizeObserver(measure):null;if(area)observer?.observe(area);
  window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[owner]);
 const value=choice.key===key?choice.value:read(),open=layout.roomy?value!=='closed':layout.requested;
 return {open,setOpen:(next:boolean)=>{
  if(!layout.roomy){setLayout(current=>({...current,requested:next}));return;}
  setChoice({key,value:next?'open':'closed'});try{localStorage.setItem(key,next?'open':'closed');}catch{}
 }};
}
export function ChatContextToggle({open,toggle}:{open:boolean;toggle:()=>void}){
 const scheduled=useScheduledWorkspace();if(scheduleChatSelected(scheduled))return null;
 return <button className="icon-button" aria-label="Chat details" title="Chat details" aria-expanded={open} aria-controls="chat-context-panel" onClick={toggle}><SlidersHorizontal size={19}/></button>;
}
type Source={key:string;name:string;reference?:FileReference;saved?:FileContext};
export function chatSources(project:Project|null,files:FileReference[],selected:string[],messages:Message[],snapshots:SelectedContext[]=[]):Source[]{
 const ids=new Set([...(project?.file_ids??[]),...selected,...messages.flatMap(message=>message.metadata.options?.files??[])]);
 const result:Source[]=files.filter(file=>ids.has(file.id)).map(reference=>({key:reference.id,name:reference.name,reference}));
 // Historical attachment contents remain usable when their original registered path has gone away.
 const names=new Set(result.map(source=>source.name));
 const contexts=new Set<string>();
 const append=(saved:FileContext,key:string)=>{if(saved.source){key=saved.source.kind+':'+saved.source.id;if(contexts.has(key))return;contexts.add(key);}else{if(names.has(saved.name))return;names.add(saved.name);}result.push({key,name:saved.name,saved});};
 for(const snapshot of snapshots)append(selectedContextFiles([snapshot],snapshot.owner,'ask')[0],snapshot.kind+':'+snapshot.id);
 for(const message of [...messages].reverse())for(const saved of message.content.files??[])append(saved,message.id+':'+result.length);
 return result;
}
function SourceRow({source,open}:{source:Source;open:()=>void}){
 const [image,setImage]=useState(''),file=source.reference,isImage=!!source.saved?.image||file?.source==='clipboard'||/\.(png|jpe?g|webp)$/i.test(source.name);
 useEffect(()=>{let live=true;setImage(source.saved?.image??'');if(file&&isImage)void call<{image:string}>('files.preview',{id:file.id}).then(value=>{if(live)setImage(value.image);}).catch(()=>{});return()=>{live=false;};},[file?.id,isImage,source.saved?.image]);
 return <button className="chat-context-source" title={source.saved?.source?source.saved.source.url+' · Captured '+new Date(source.saved.source.capturedAt).toLocaleString():source.name} onClick={open}>{image?<img src={image} alt=""/>:source.saved?.source?.kind==='browser'?<Globe size={16}/>:source.saved?.source?.kind==='chat'?<MessageSquare size={16}/>:file?.kind==='folder'?<FolderOpen size={16}/>:isImage?<ImageIcon size={16}/>:<FileText size={16}/>}<span>{source.name}</span></button>;
}
export function ChatContextPanel({project,files,selected,messages,snapshots,add,edit,close}:{project:Project|null;files:FileReference[];selected:string[];messages:Message[];snapshots?:SelectedContext[];add:(kind:'file'|'folder')=>void;edit:()=>void;close:()=>void}){
 const scheduled=useScheduledWorkspace(),workspace=useContext(WorkspaceLinks),[all,setAll]=useState(false),[saved,setSaved]=useState<Source|null>(null),[review,setReview]=useState(false);
 const sources=useMemo(()=>chatSources(project,files,selected,messages,snapshots),[project,files,selected,messages,snapshots]);
 const changes=useMemo(()=>messages.filter(message=>changedFiles(message.metadata.tools??[]).length||nativeChanges(message.metadata.native).length).reverse(),[messages]);
 function open(source:Source){const file=source.reference,context=source.saved?.source;if(context)context.kind==='chat'?workspace.openChat(context.id):workspace.browser(context.url);else if(file)file.kind==='folder'?workspace.folder(file.id,''):workspace.file(file.id,'');else setSaved(source);}
 if(scheduleChatSelected(scheduled))return null;
 return <aside id="chat-context-panel" className="chat-context-panel" aria-label="Chat details">
  <div className="chat-context-heading"><span title={project?.name}>{project?.name??'Chat'}</span><Menu align="end" trigger={<button className="icon-button" aria-label="Chat details options"><MoreHorizontal size={16}/></button>}>{project&&<MenuItem onSelect={edit}>Project settings</MenuItem>}<MenuItem onSelect={close}>Hide chat details</MenuItem></Menu></div>
  <button className="chat-context-action" onClick={()=>changes.length===1&&workspace.conversation?workspace.review(workspace.conversation,changes[0].id):setReview(true)}><FileDiff size={16}/><span>Changes</span></button>
  <div className="chat-context-heading chat-context-sources"><span>Sources</span><Menu align="end" trigger={<button className="icon-button" aria-label="Add sources"><Plus size={17}/></button>}><MenuItem onSelect={()=>add('file')}>Files and folders</MenuItem><MenuItem onSelect={()=>add('folder')}>Add folder</MenuItem>{project&&<MenuItem onSelect={edit}>Manage project sources</MenuItem>}</Menu></div>
  <div className="chat-context-source-list">{(all?sources:sources.slice(0,3)).map(source=><SourceRow key={source.key} source={source} open={()=>open(source)}/>)}{!sources.length&&<p className="chat-context-empty">Add files or folders</p>}</div>
  {!!sources.length&&<button className="chat-context-view-all" aria-expanded={all} onClick={()=>setAll(!all)}><Link size={15}/>{all?'Show fewer':'View all'}{all&&<span className="chat-context-count">{sources.length}</span>}</button>}
  {saved&&<Modal title={saved.name} close={()=>setSaved(null)} className="chat-source-dialog"><MessageAttachments files={[saved.saved!]}/></Modal>}
  {review&&<Modal title="Changes" close={()=>setReview(false)} className="compact-dialog">{changes.length?changes.map((message,index)=><button className="chat-context-action" key={message.id} onClick={()=>{setReview(false);if(workspace.conversation)workspace.review(workspace.conversation,message.id);}}><FileDiff size={16}/><span>{index===0?'Latest changes':'Earlier changes'} · {changes.length-index}</span></button>):<p className="hint">File changes recorded in this chat will appear here.</p>}</Modal>}
 </aside>;
}
