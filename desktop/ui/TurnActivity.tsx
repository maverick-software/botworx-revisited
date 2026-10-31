import {nativeChanges} from '../src/native-change-presentation';
import type {NativeState} from '../src/native-contracts';
import {call} from './ui';
import React,{useContext,useEffect,useMemo,useState} from 'react';
import {ChevronRight,ChevronDown,RotateCcw} from 'lucide-react';
import type {Message} from '../src/contracts';
import type {ToolActivity} from '../src/tool-contracts';
import {changedFiles,observedFileChanges,elapsedLabel,turnLabel,type ChangedFile,type TurnTiming} from '../src/turn-presentation';
import {nativeActivityReceipt,nativeActivityStatus} from './native-activity-status';
import {ToolTimeline} from './ToolActivity';
import {WorkspaceLinks} from './WorkspaceLinks';

export function LineCounts({file,unavailable='Large diff'}:{file:Pick<ChangedFile,'added'|'removed'>;unavailable?:string}){
 return file.added===null||file.removed===null?<span className="change-count-unavailable">{unavailable}</span>:<span className="change-line-counts"><span className="lines-added">+{file.added}</span><span className="lines-removed">−{file.removed}</span></span>;
}

export function TurnSummary({status,timing,children}:{status?:string;timing?:TurnTiming;children?:React.ReactNode}){
 const active=status==='running';
 const [expanded,setExpanded]=useState(false),[now,setNow]=useState(Date.now);
 useEffect(()=>{if(!active)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
 const label=turnLabel(status,elapsedLabel(timing,now),false).replace('Working · ','Working for ');
 return <div className="turn-work-summary">{children?<><button type="button" className="turn-work-toggle" aria-expanded={expanded} aria-label={label+' — '+(expanded?'hide':'show')+' activity'} onClick={()=>setExpanded(value=>!value)}><span>{label}</span><ChevronRight size={14} className={expanded?'expanded':''}/></button>{expanded&&children}</>:<div className="turn-work-label">{label}</div>}</div>;
}

export function currentTurnActivity(native?:NativeState,tools:ToolActivity[]=[],requestId?:string){
 const relevant=tools.filter(tool=>(!requestId||tool.request_id===requestId)&&(!native||!tool.native_thread_id||tool.native_thread_id===native.threadId));
 const pending=native?.approvals.find(a=>a.status==='pending'&&a.threadId===native.threadId&&a.turnId===native.turnId);
 if(pending)return pending.kind==='input'?'Waiting for your answer':'Waiting for your approval';
 if(relevant.some(tool=>tool.status==='awaiting_approval'))return 'Waiting for your approval';
 const tool=relevant.slice().reverse().find(tool=>tool.status==='running');if(tool)return tool.label||'Using an app';
 if(native){
  const entry=native.items.slice().reverse().find(entry=>entry.threadId===native.threadId&&entry.turnId===native.turnId&&!entry.completed&&nativeActivityStatus(entry,false,nativeActivityReceipt(entry,native.items,relevant,requestId??''))==='Working');
  if(entry){switch(entry.item.type){case 'commandExecution':return 'Running a command';case 'fileChange':return 'Editing files';case 'mcpToolCall':return 'Using '+entry.item.server+' · '+entry.item.tool;case 'dynamicToolCall':return 'Using '+entry.item.tool;case 'collabAgentToolCall':return 'Working with agents';}}
  if(native.children?.some(child=>child.status==='running'))return 'Waiting for agents';
 }
 return 'Thinking';
}

export function CurrentTurnActivity({active,native,tools,requestId,label}:{active:boolean;native?:NativeState;tools?:ToolActivity[];requestId?:string;label?:string}){
 return active?<div className="turn-current-activity" role="status" aria-live="polite" aria-atomic="true">{label??currentTurnActivity(native,tools,requestId)}</div>:null;
}

export function TurnActivity({message}:{message:Message}){
 const activities=message.metadata.tools??[],active=message.metadata.status==='running';
 const awaiting=activities.filter(tool=>tool.status==='awaiting_approval');
 if(!activities.length&&!message.metadata.timing)return null;
 return <div className="turn-work"><TurnSummary status={message.metadata.status} timing={message.metadata.timing}>
  <div className="turn-work-history"><p className="turn-work-note">Elapsed time includes model requests, tools, and approval waits. Activity shows recorded actions.</p><ToolTimeline activities={activities.filter(tool=>tool.status!=='awaiting_approval')} active={active}/>{!activities.length&&<p className="turn-work-note">No tool activity was recorded for this response.</p>}</div></TurnSummary>
  {!!awaiting.length&&<div className="turn-pending-approvals" aria-label="Pending approvals"><ToolTimeline activities={awaiting} active={active}/></div>}
 </div>;
}

export function ChangedFilesCard({activities,active,native,messageId,requestId}:{activities:ToolActivity[];active:boolean;native?:NativeState;messageId?:string;requestId?:string}){
 const workspace=useContext(WorkspaceLinks),host=useMemo(()=>changedFiles(activities),[activities]),recorded=useMemo(()=>nativeChanges(native),[native]),observed=useMemo(()=>observedFileChanges(native,activities),[native,activities]),[expanded,setExpanded]=useState(false),[restored,setRestored]=useState<string[]>([]),[error,setError]=useState('');
 useEffect(()=>{setRestored([]);if(!workspace.owner||!requestId||!native)return;let live=true;const refresh=()=>void call<{key:string;status:string}[]>('native.changes.status',{owner:workspace.owner,requestId}).then(rows=>{if(live)setRestored(rows.filter(row=>row.status==='restored').map(row=>row.key));}).catch(()=>{});refresh();const off=window.sylvana.onChat(event=>{if(event.ownerId===workspace.owner&&event.requestId===requestId&&event.kind==='native-changes')refresh();});return()=>{live=false;off();};},[workspace.owner,requestId,!!native]);
 const files=[...host.map(file=>({key:'host:'+file.key,path:file.path,label:file.path.replaceAll('\\','/'),added:file.added,removed:file.removed,reference:file.referenceId,kind:file.before===null?'Created':'Modified',text:true,binary:false})),...recorded.filter(file=>!restored.includes(file.key)).map(file=>({key:'native:'+file.key,path:file.absoluteTo??file.absoluteFrom??file.path,label:(file.absoluteTo??file.absoluteFrom??file.path).replaceAll('\\','/'),added:file.added,removed:file.removed,reference:undefined,kind:!file.from?'Created':!file.to?'Deleted':file.from!==file.to?'Moved':'Modified',text:true,binary:false})),...observed.map(file=>({key:file.key,path:file.path,label:file.path.replaceAll('\\','/'),added:file.added,removed:file.removed,reference:file.referenceId,kind:file.kind[0].toUpperCase()+file.kind.slice(1),text:file.text,binary:file.binary===true}))];
 if(!files.length)return null;
 const canonical=(file:typeof files[number])=>file.path.replace(/\\/g,'/').toLowerCase(),fileCount=new Set(files.map(canonical)).size,duplicate=fileCount!==files.length;
 const review=async()=>{setError('');try{const last=activities.find(tool=>tool.assistant_message_id);if(last)workspace.review(last.conversation_id,last.assistant_message_id,files[0].reference);else if(messageId&&workspace.conversation)workspace.review(workspace.conversation,messageId);else if(workspace.owner&&requestId){const location=await call<{conversation_id:string;assistant_message_id:string}>('native.changes.location',{owner:workspace.owner,requestId});workspace.review(location.conversation_id,location.assistant_message_id);}}catch(error){setError((error as Error).message);}};
 const textFiles=files.filter(file=>file.text),binary=files.filter(file=>file.binary).length,unavailable=files.length-textFiles.length-binary,canUndo=host.length>0||recorded.length>0||observed.some(file=>!!file.operationId),counts=duplicate?{added:null,removed:null}:textFiles.reduce((sum,file)=>({added:sum.added===null||file.added===null?null:sum.added+file.added,removed:sum.removed===null||file.removed===null?null:sum.removed+file.removed}),{added:0,removed:0} as Pick<ChangedFile,'added'|'removed'>);
 return <section className="changed-files-card" aria-label="Files changed in this response"><div className="changed-files-header"><span className="changed-files-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 7v6m-3-3h6m-6 7h6"/></svg></span><div><strong>Changed {fileCount} {fileCount===1?'file':'files'}</strong><div className="changed-files-totals">{!!textFiles.length&&<LineCounts file={counts} unavailable="View diff"/>}{!!binary&&<small>{binary} {binary===1?'binary file':'binary files'}</small>}{!!unavailable&&<small>{unavailable} {unavailable===1?'file without a text diff':'files without text diffs'}</small>}</div></div><div className="changed-files-actions">{canUndo&&<button type="button" disabled={active} onClick={()=>void review()} aria-label="Review changes to undo"><RotateCcw size={13}/>Undo…</button>}<button type="button" onClick={()=>void review()}>View changes</button></div></div>
 <div className="changed-files-list">{files.slice(0,expanded?files.length:3).map(file=><button type="button" className="changed-file-row" key={file.key} onClick={()=>void review()}><span className="changed-file-label" title={file.path}><span className="changed-file-directory">{file.label.slice(0,file.label.lastIndexOf('/')+1)}</span><span className="changed-file-name">{file.label.slice(file.label.lastIndexOf('/')+1)}</span></span><small className={'changed-file-kind '+file.kind.toLowerCase()}>{file.kind}</small><LineCounts file={duplicate?{added:null,removed:null}:file} unavailable={file.text?'View diff':file.binary?'Binary file':'Diff unavailable'}/></button>)}</div>
 {files.length>3&&<button type="button" className="changed-files-more" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer files':`Show ${files.length-3} more ${files.length-3===1?'file':'files'}`}<ChevronDown size={15}/></button>}{native?.workspaceChangesNote&&<p className="turn-work-note">{native.workspaceChangesNote}</p>}{error&&<p className="pane-error" role="alert">{error}</p>}
 </section>;
}
