import React,{useEffect,useState} from 'react';
import {FolderOpen,Loader2,ShieldCheck,ArrowRight,RotateCw,LogOut} from 'lucide-react';
import type {WorkspaceImportStatus,WorkspaceImportInspection} from '../src/workspace-import-contracts';
import {call} from './ui';
import './workspace-import-recovery.css';
const size=(bytes:number)=>bytes<1024?bytes+' B':bytes<1024**2?(bytes/1024).toFixed(1)+' KB':bytes<1024**3?(bytes/1024**2).toFixed(1)+' MB':(bytes/1024**3).toFixed(1)+' GB';
export function WorkspaceImportRecovery({status,changed,signOut}:{status:WorkspaceImportStatus;changed:()=>Promise<void>;signOut:()=>Promise<void>}){
 const [inspection,setInspection]=useState<WorkspaceImportInspection|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setInspection(null);setError('');},[status.owner,status.id]);
 async function run(action:string,work:()=>Promise<void>){if(busy)return;setBusy(action);setError('');try{await work();}catch(error){setInspection(null);setError((error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{setBusy('');}}
 const inspect=()=>run('inspect',async()=>{setInspection(await call<WorkspaceImportInspection>('recovery.workspaces.inspect',{owner:status.owner}));});
 return <main className="workspace-import-recovery" aria-labelledby="workspace-recovery-title" aria-busy={!!busy}>
  <div className="workspace-recovery-card">
   <div className="workspace-recovery-heading"><div className="workspace-recovery-mark" aria-hidden="true"><ShieldCheck size={25}/></div><div><p className="workspace-recovery-eyebrow">Workspace recovery</p><h1 id="workspace-recovery-title">Review your retained workspace copies</h1><p>Signed in as {status.email}</p></div></div>
   <p>Your conversations are preserved. Review the retained workspace files to finish opening this account. Chats, schedules and tools remain paused until recovery finishes.</p>
   {status.problem&&<p className="workspace-recovery-problem">{status.problem}</p>}
   {error&&<p role="alert" className="workspace-recovery-problem">{error}</p>}
   <div className="workspace-recovery-actions"><button disabled={!!busy} onClick={()=>void inspect()}>{busy==='inspect'?<Loader2 className="spin" size={16}/>:<ShieldCheck size={16}/>}Inspect recovery</button><button className="secondary" disabled={!!busy} onClick={()=>void run('refresh',changed)}><RotateCw size={15}/>Refresh</button></div>
   {inspection&&<section className="workspace-recovery-inspection" aria-label="Recovery inspection">
    <h2>{inspection.canFinish?'Verified copies are ready to finish':'The partial copies need further recovery'}</h2><p>{inspection.summary}</p>
    <p className="workspace-recovery-counts">{inspection.files.toLocaleString()} retained files · {size(inspection.bytes)}</p>
    {!!inspection.problems.length&&<ul className="workspace-recovery-problems">{inspection.problems.map((problem,index)=><li key={index}>{problem}</li>)}</ul>}
    <div className="workspace-recovery-paths">{inspection.paths.filter(row=>row.location).map(row=>{const location=row;return <div key={location.location}><div><strong>{location.label}</strong><span>{row?.exists?`${row.files.toLocaleString()} files · ${size(row.bytes)}`:'Not present at this location'}</span><details><summary>Location</summary><code>{location.path}</code></details></div><button className="secondary" aria-label={'Open '+location.label+' folder'} disabled={!!busy||!row?.exists} onClick={()=>void run('open',async()=>{await call('recovery.workspaces.reveal',{owner:status.owner,location:location.location});})}><FolderOpen size={16}/>Open folder</button></div>;})}</div>
    {inspection.canFinish&&<div className="workspace-recovery-finish"><p>Finish restoring access to these copies. Previous agent work will not be repeated.</p><button disabled={!!busy} onClick={()=>void run('finish',async()=>{await call('recovery.workspaces.finish',{owner:status.owner,inspection:inspection.id});await changed();})}>{busy==='finish'?<Loader2 className="spin" size={16}/>:<ArrowRight size={16}/>}Finish verified recovery</button></div>}
    {inspection.canRestart&&<div className="workspace-recovery-finish"><p>Create new copies from the verified backup. Current attachments stay as they are. Partial files, edited copies and interrupted records are kept in private history. Previous agent work stays stopped.</p><button disabled={!!busy} onClick={()=>void run('copies',async()=>{await call('recovery.workspaces.copies',{owner:status.owner,inspection:inspection.id});await changed();})}>{busy==='copies'?<Loader2 className="spin" size={16}/>:<ArrowRight size={16}/>}Create separate recovery copies</button></div>}
   </section>}
   <button className="workspace-recovery-signout" disabled={!!busy} onClick={()=>void run('signout',signOut)}><LogOut size={15}/>Sign out</button>
  </div>
 </main>;
}
