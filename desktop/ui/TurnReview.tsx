import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {FileText,RotateCcw,RefreshCw} from 'lucide-react';
import type {Message} from '../src/contracts';
import {changedFiles,changedFileCount,undoableEdits} from '../src/turn-presentation';
import {nativeChanges} from '../src/native-change-presentation';
import type {NativeState} from '../src/native-contracts';
import type {NativeChangeReview} from '../src/native-change-contracts';
import {FileDiff} from './ToolActivity';import {LineCounts} from './TurnActivity';import {WorkspaceLinks} from './WorkspaceLinks';import {flushEditors} from './editor-drafts';import {call,Modal} from './ui';
const readable=(error:unknown)=>String((error as Error).message??error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
const unsettled=(state?:NativeState)=>!!state?.children?.some(child=>child.status==='running'||child.delivery==='running'||child.delivery==='waiting'&&child.status!=='interrupted'&&child.reportedTurnId!==child.turnId)||!!state?.reports?.some(report=>report.status==='running');
export default function TurnReview({owner,conversation,messageId,working}:{owner:string;conversation:string;messageId:string;working:boolean}){
 const [message,setMessage]=useState<Message|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[retryId,setRetryId]=useState<string|null>(null),[native,setNative]=useState<NativeChangeReview>({receipts:[],issues:[]}),[nativeNote,setNativeNote]=useState('');
 const workspace=useContext(WorkspaceLinks),generation=useRef(0),alive=useRef(true),area=useRef<HTMLDivElement>(null),busyRef=useRef(false),retry=useRef<ReturnType<typeof setTimeout>>();
 const load=async()=>{clearTimeout(retry.current);const version=++generation.current,rows=await call<Message[]>('messages.list',{conversationId:conversation});if(!alive.current||version!==generation.current)return;const row=rows.find(row=>row.id===messageId&&row.role==='assistant');if(!row)throw new Error('This saved response is no longer available.');setMessage(row);
  if(!nativeChanges(row.metadata.native).length){setNative({receipts:[],issues:[]});return;}
  if(working||row.metadata.status==='running'||unsettled(row.metadata.native)){setNativeNote('Native work is still running. The recorded patches remain available for review.');return;}
  try{const result=await call<NativeChangeReview>('native.changes.prepare',{owner,requestId:row.metadata.timing?.requestId});if(alive.current&&version===generation.current){setNative(result);setNativeNote('');}}
  catch(error){if(alive.current&&version===generation.current){const text=readable(error);setNativeNote(text);if(/Finish or stop|Wait for this response/.test(text))retry.current=setTimeout(()=>{if(!busyRef.current)void load().catch(error=>setError(readable(error)));},500);}}
 };
 useEffect(()=>{alive.current=true;setMessage(null);setNative({receipts:[],issues:[]});setError('');setNativeNote('');void load().catch(error=>{if(alive.current)setError(readable(error));});const off=window.agentopia.onChat(event=>{if(event.ownerId===owner&&event.conversationId===conversation&&!busyRef.current&&(event.kind==='tool'||event.kind==='native-changes'||event.kind==='native'||event.kind==='native-background'||event.status))void load().catch(error=>{if(alive.current)setError(readable(error));});});return()=>{alive.current=false;generation.current++;clearTimeout(retry.current);off();};},[owner,conversation,messageId,working]);
 const files=useMemo(()=>changedFiles(message?.metadata.tools??[]),[message?.metadata.tools]),recorded=useMemo(()=>nativeChanges(message?.metadata.native),[message?.metadata.native]),active=working||message?.metadata.status==='running'||unsettled(message?.metadata.native),visible=recorded.filter(change=>!native.receipts.some(row=>row.key===change.key&&row.status==='restored'));
 const fileCount=new Set([...files.map(file=>file.path),...visible.map(file=>file.absoluteTo??file.absoluteFrom??file.path)].map(path=>path.replace(/\\/g,'/').toLowerCase())).size;
 const ready=native.receipts.some(row=>row.status==='ready'&&row.available!==false);
 const undo=async()=>{
  if(busyRef.current||active||!message)return;busyRef.current=true;setBusy(true);setError('');setNotice('');setConfirm(false);let completed=0;
  try{
   await flushEditors(owner);
   if(retryId){await call('native.changes.undo',{owner,id:retryId});completed++;}
   else{const host=undoableEdits(message.metadata.tools??[]),attempted=new Set<string>(),limit=host.length+recorded.length+1;for(let pass=0;pass<limit;pass++){
    if(!alive.current)throw new Error('The review closed before the next edit was undone.');
    const prepared=recorded.length?await call<NativeChangeReview>('native.changes.prepare',{owner,requestId:message.metadata.timing?.requestId}):{receipts:[],issues:[]};
    const next=recorded.slice().reverse().map(change=>prepared.receipts.find(row=>row.key===change.key)).find(row=>row&&row.status==='ready'&&row.available!==false&&!attempted.has(row.id));
    if(next){attempted.add(next.id);await call('native.changes.undo',{owner,id:next.id});completed++;continue;}
    const tool=host.shift();if(tool){await call('tools.revert',{id:tool.id});completed++;continue;}
    const remaining=recorded.find(change=>!prepared.receipts.some(row=>row.key===change.key&&row.status==='restored'));
    if(remaining)throw new Error(prepared.issues.find(issue=>issue.key===remaining.key)?.error??'Review the remaining native snapshot before retrying an interrupted undo.');break;
   }}
   if(alive.current)setNotice(`Undid ${completed} ${completed===1?'edit':'edits'}.`);
  }catch(error){if(alive.current)setError(`Undo stopped after ${completed} edits. ${readable(error)} Remaining files were preserved.`);}
  finally{setRetryId(null);busyRef.current=false;if(alive.current){await load().catch(error=>setError(readable(error)));setBusy(false);}}
 };
 return <div ref={area} className="turn-review" aria-label="Response file changes" aria-busy={busy}>
 <div className="turn-review-heading"><div><h2>Changes</h2><p>{fileCount} {fileCount===1?'file':'files'} with applied edits from this response</p></div><button type="button" className="secondary" disabled={active||busy||!files.length&&!ready} onClick={()=>{setRetryId(null);setConfirm(true);}}><RotateCcw size={14}/>Undo edits…</button></div>
 <p className="turn-review-note">Saved snapshots and recorded native patches. Native snapshots are checked against Codex content hashes. Undo preserves files that changed later.</p>
 {error&&<p className="pane-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{nativeNote&&<p role="status" className="turn-review-note">{nativeNote}</p>}
 {!!recorded.length&&<button className="subtle-link" disabled={active||busy} onClick={()=>void load().catch(error=>setError(readable(error)))}><RefreshCw size={13}/>Recheck files</button>}
 {!message&&!error&&<p>Loading saved changes…</p>}{message&&!files.length&&!recorded.length&&<p>No applied text-file edits remain in this response.</p>}
 {files.length>1&&<nav aria-label="Changed files">{files.map((file,index)=><button type="button" key={file.key} onClick={()=>{const target=area.current?.querySelector<HTMLElement>(`[data-review-index="${index}"]`);target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});}}><FileText size={14}/>{file.relativePath||file.path}<LineCounts file={file}/></button>)}</nav>}
 {files.map((file,index)=><section className="review-file" key={file.key} data-review-index={index} tabIndex={-1}><header><strong title={file.path}>{file.relativePath||file.path}</strong><LineCounts file={file}/><button type="button" className="subtle-link" onClick={()=>workspace.file(file.referenceId,file.relativePath)}>Open file</button></header><FileDiff before={file.before} after={file.after}/></section>)}
 {recorded.map(change=>{const receipt=native.receipts.find(row=>row.key===change.key),issue=native.issues.find(issue=>issue.key===change.key),before=receipt?.paths[0]?.before,after=receipt?.paths.at(-1)?.after,openPath=receipt?.status==='restored'?change.absoluteFrom:change.absoluteTo;return <section className="review-file native-review-file" key={change.key} data-native-change={change.key}><header><strong>{change.path}</strong><small>{!change.from?'Created':!change.to?'Deleted':change.from!==change.to?'Moved':'Modified'}</small><LineCounts file={change} unavailable="View diff"/>{receipt&&<small>{receipt.status==='restored'?'Restored':receipt.status==='uncertain'?'Interrupted undo':receipt.available===false?'File changed':'Verified snapshot'}</small>}{openPath&&<button type="button" className="subtle-link" onClick={()=>workspace.link(openPath)}>Open file</button>}{receipt?.status==='uncertain'&&<button className="secondary" disabled={active||busy||receipt.available===false} onClick={()=>{setRetryId(receipt.id);setConfirm(true);}}>Retry interrupted undo…</button>}</header>{issue&&<p className="pane-error">{issue.error}</p>}{receipt?<FileDiff before={before??null} after={after??''}/>:<pre className="native-recorded-patch">{change.patch}</pre>}</section>;})}
 {confirm&&<Modal title={retryId?'Retry interrupted undo?':'Undo this response’s edits?'} close={()=>setConfirm(false)}><p>{retryId?'Recheck this interrupted restoration and apply only its remaining verified file changes.':'Restore the verified contents before these changes. Each file is checked again before writing. If a file changed, undo stops and preserves remaining work; earlier successful restorations stay applied.'}</p><div className="editor-dialog-actions"><button type="button" className="secondary" onClick={()=>setConfirm(false)}>Keep edits</button><button type="button" onClick={()=>void undo()}>{retryId?'Retry undo':'Undo edits'}</button></div></Modal>}
 </div>;
}
