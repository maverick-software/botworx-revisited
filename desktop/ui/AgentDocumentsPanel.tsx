import React,{useState} from 'react';
import {Plus} from 'lucide-react';
import {call} from './ui';
import type {Run} from './Panels';

type LibraryDocument={id:string;display_name?:string;file_name:string;processing_status:string};
export function AgentDocumentsPanel({agentId,documents,selected,select,refresh,busy,setBusy,run,save}:{
 agentId:string;documents:LibraryDocument[];selected:string[];select:(ids:string[])=>void;
 refresh:()=>Promise<void>;busy:boolean;setBusy:(busy:boolean)=>void;run:Run;save:()=>void;
}){
 const [notice,setNotice]=useState('');
 const upload=()=>{setBusy(true);setNotice('');void run(async()=>{
  let result:{uploaded:{id:string;name:string;notice?:string;truncated:boolean}[];errors:string[]};
  try{result=await call('agentSettings.documents.pick',{agentId});}
  catch(error){await refresh();throw Error('The upload result could not be confirmed. The library was refreshed; check it before adding the same files again. '+(error as Error).message);}
  await refresh();
  if(result.uploaded.length)select([...new Set([...selected,...result.uploaded.map(row=>row.id)])]);
  setNotice([result.uploaded.length?`${result.uploaded.length} document${result.uploaded.length===1?'':'s'} added to your library. Save settings to assign them to this agent.`:'',...result.uploaded.filter(row=>row.notice||row.truncated).map(row=>row.name+': '+(row.notice||'Text extraction is incomplete.')), ...result.errors].filter(Boolean).join('\n'));
 }).finally(()=>setBusy(false));};
 return <>
  <p>Assign reference files this agent can read in future conversations and background assignments. Files stay in your local library when you remove an assignment.</p>
  <button className="secondary" disabled={busy} onClick={upload}><Plus size={16}/>{busy?'Adding documents…':'Add documents'}</button>
  <p className="hint">PDF, Word, Excel, PowerPoint and UTF-8 text files. Up to 20 MB per Office or PDF file, or 2 MB for text. Assigned files are shared with the agent’s selected AI connection when its document tools are used. Chat only mode excludes these tools.</p>
  {notice&&<p role="status" style={{whiteSpace:'pre-wrap'}}>{notice}</p>}
  <div className="resource-selection">{documents.length?documents.map(row=><label className="checkbox" key={row.id}>
   <input type="checkbox" disabled={busy} checked={selected.includes(row.id)} onChange={()=>select(selected.includes(row.id)?selected.filter(id=>id!==row.id):[...selected,row.id])}/>
   <span>{row.display_name||row.file_name}{row.processing_status!=='completed'?' · '+row.processing_status:''}</span>
  </label>):<p className="empty-hint">Add documents to build this agent’s reference library.</p>}</div>
  <div className="form-actions"><button disabled={busy} onClick={save}>Save settings</button></div>
 </>;
}
