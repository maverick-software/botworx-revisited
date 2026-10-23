import React,{useEffect,useState} from 'react';
import {Plus} from 'lucide-react';
import {call,Modal} from './ui';
import type {Run} from './Panels';

type LibraryDocument={id:string;display_name?:string;file_name:string;processing_status:string;file_extension?:string;file_size?:number;version?:number;updated_at?:string;is_archived?:boolean;category?:string;tags?:string[];description?:string;storage_bucket?:string};
type Details={name:string;category:string;tags:string;description:string};
type Version={version:number;file_name:string;file_extension:string;file_size:number;saved_at:string;current:boolean;has_original:boolean};
const title=(row:LibraryDocument)=>row.display_name||row.file_name;
const details=(row:LibraryDocument):Details=>({name:title(row),category:row.category||'general',tags:(row.tags??[]).join(', '),description:row.description||''});
const token=(row:LibraryDocument)=>({version:row.version??1,updatedAt:row.updated_at});
const size=(bytes?:number)=>bytes?Math.max(1,Math.round(bytes/1024))+' KB':'';
export function AgentDocumentsPanel({agentId,documents,selected,select,refresh,busy,setBusy,run,save}:{
 agentId:string;documents:LibraryDocument[];selected:string[];select:(value:string[]|((current:string[])=>string[]))=>void;
 refresh:()=>Promise<void>;busy:boolean;setBusy:(busy:boolean)=>void;run:Run;save:()=>void;
}){
 const [notice,setNotice]=useState(''),[adding,setAdding]=useState(false),[query,setQuery]=useState(''),[view,setView]=useState('active'),[collection,setCollection]=useState('');
 const [editing,setEditing]=useState<{row:LibraryDocument;draft:Details}|null>(null),[versions,setVersions]=useState<Version[]|null>(null),[libraryError,setLibraryError]=useState('');
 const [scopeNotice,setScopeNotice]=useState('');
 useEffect(()=>{const active=new Set(documents.filter(row=>!row.is_archived).map(row=>row.id)),removed=new Set(selected.filter(id=>!active.has(id)));if(removed.size){select(current=>current.filter(id=>!removed.has(id)));setScopeNotice('Selected documents that were archived or removed are no longer assignable. Your other unsaved choices are kept.');}},[documents,selected,select]);
 const dirty=!!editing&&JSON.stringify(editing.draft)!==JSON.stringify(details(editing.row));
 const close=()=>{if(!busy&&(!dirty||confirm('Discard unsaved document details?')))setEditing(null);};
 const upload=()=>{setBusy(true);setAdding(true);setNotice('');void run(async()=>{
  let result:{uploaded:{id:string;name:string;notice?:string;truncated:boolean}[];errors:string[]};
  try{result=await call('agentSettings.documents.pick',{agentId});}
  catch(error){await refresh();throw Error('The upload result could not be confirmed. The library was refreshed; check it before adding the same files again. '+(error as Error).message);}
  await refresh();
  if(result.uploaded.length)select([...new Set([...selected,...result.uploaded.map(row=>row.id)])]);
  setNotice([result.uploaded.length?result.uploaded.length+' document'+(result.uploaded.length===1?'':'s')+' added to your library. Save settings to assign them to this agent.':'',...result.uploaded.filter(row=>row.notice||row.truncated).map(row=>row.name+': '+(row.notice||'Text extraction is incomplete.')),...result.errors].filter(Boolean).join('\n'));
 }).finally(()=>{setBusy(false);setAdding(false);});};
 const change=(operation:string,value:unknown={},replace=false)=>{if(!editing)return;const row=editing.row;setBusy(true);setNotice('');setLibraryError('');void run(async()=>{
  let result:{cancelled?:boolean;notice?:string;truncated?:boolean};
  try{result=await call(replace?'agentSettings.documents.replace':'agentSettings.documents.update',{agentId,id:row.id,expected:token(row),operation,value});}
  catch(error){let refreshed=false;try{await refresh();refreshed=true;}catch{}const message=(refreshed?'The library was refreshed. Close and reopen Manage to review this document before trying again. ':'The library could not be refreshed. Reopen the editor and review this document. ')+(replace?'Do not repeat an unconfirmed replacement. ':'')+(error as Error).message;setLibraryError(message);throw Error(message);}
  if(result.cancelled)return;
  if(['archive','delete'].includes(operation)&&selected.includes(row.id))select(selected.filter(id=>id!==row.id));
  setEditing(null);setVersions(null);try{await refresh();}catch(error){setNotice('The library change was saved. Reopen the editor to refresh its list.');throw error;}
  setNotice(replace?'Replacement saved. Previous file versions are retained.'+(result.notice?' '+result.notice:result.truncated?' Text extraction is incomplete.':''):operation==='archive'?'Document archived and removed from all agents. Its originals and versions are retained.':operation==='restore'?'Document restored without assignments. Select it and save settings to grant this agent access.':operation==='delete'?'Archived document and its retained versions permanently deleted.':operation==='restore_version'?'Previous file restored as a new current version. The earlier current file is retained.':operation==='delete_version'?'Previous file version permanently deleted.':'Document details saved.');
 }).finally(()=>setBusy(false));};
 const loadVersions=()=>{if(!editing||versions||busy)return;const row=editing.row;setBusy(true);setLibraryError('');void run(async()=>{try{setVersions(await call<Version[]>('agentSettings.documents.versions',{agentId,id:row.id}));}catch(error){setLibraryError('File versions could not be loaded. '+(error as Error).message);throw error;}}).finally(()=>setBusy(false));};
 const reload=()=>{setBusy(true);setScopeNotice('');void run(refresh).finally(()=>setBusy(false));};
 const collections=[...new Set(documents.map(row=>row.category||'general'))].sort((a,b)=>a.localeCompare(b));
 const term=query.trim().toLowerCase(),visible=documents.filter(row=>!!row.is_archived===(view==='archived')&&(!collection||(row.category||'general')===collection)&&(!term||[title(row),row.file_name,row.category,...(row.tags??[])].join(' ').toLowerCase().includes(term))).sort((a,b)=>title(a).localeCompare(title(b)));
 return <>
  <p>Assign reference files this agent can read in future conversations and background assignments. Files stay in your local library when you remove an assignment.</p>
  <div className="document-library-toolbar"><button className="secondary" disabled={busy} onClick={upload}><Plus size={16}/>{adding?'Adding documents…':'Add documents'}</button><button className="secondary" disabled={busy} onClick={reload}>Refresh library</button></div>
  <p className="hint">PDF, Word, Excel, PowerPoint and UTF-8 text files. Up to 20 MB per Office or PDF file, or 2 MB for text. Assigned files are shared with the agent’s selected AI connection when its document tools are used. Chat only mode excludes these tools.</p>
  {notice&&<p role="status" style={{whiteSpace:'pre-wrap'}}>{notice}</p>}
  {scopeNotice&&<p role="status">{scopeNotice}</p>}
  <div className="document-library-filters"><label>Find documents<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label><label>View<select aria-label="View" value={view} onChange={event=>setView(event.target.value)}><option value="active">Active documents</option><option value="archived">Archived documents</option></select></label><label>Collection<select aria-label="Collection" value={collection} onChange={event=>setCollection(event.target.value)}><option value="">All collections</option>{collections.map(name=><option key={name} value={name}>{name==='general'?'General':name}</option>)}</select></label></div>
  <div className="resource-selection document-library-list">{visible.length?visible.map(row=><div className="document-library-row" key={row.id}>
   <div className="document-library-identity"><label className="checkbox"><input type="checkbox" disabled={busy||row.is_archived} checked={!row.is_archived&&selected.includes(row.id)} onChange={()=>select(selected.includes(row.id)?selected.filter(id=>id!==row.id):[...selected,row.id])}/><span>{title(row)}</span></label>
    <small>{[row.category&&row.category!=='general'?row.category:'',...(row.tags??[]),size(row.file_size),'Version '+(row.version??1),row.is_archived?'Archived':row.processing_status!=='completed'?row.processing_status:''].filter(Boolean).join(' · ')}</small>
   </div><button className="secondary" disabled={busy||!row.updated_at} aria-label={'Manage '+title(row)} onClick={()=>{setEditing({row,draft:details(row)});setVersions(null);setLibraryError('');}}>Manage</button>
  </div>):<p className="empty-hint">{query||collection?'No documents match these filters.':view==='archived'?'No archived documents.':'Add documents to build this agent’s reference library.'}</p>}</div>
  <div className="form-actions"><button disabled={busy} onClick={save}>Save settings</button></div>
  {editing&&<Modal title={'Manage '+title(editing.row)} className="document-library-modal" close={close}>
   <p className="hint">Library changes apply immediately across agents. Save settings in the editor controls which documents this agent can read.</p>
   {libraryError&&<p role="alert">{libraryError}</p>}
   <form onSubmit={event=>{event.preventDefault();change('metadata',{...editing.draft,tags:editing.draft.tags.split(',').map(tag=>tag.trim()).filter(Boolean)});}}>
    <label>Document name<input disabled={busy} required maxLength={255} value={editing.draft.name} onChange={event=>setEditing({...editing,draft:{...editing.draft,name:event.target.value}})}/></label>
    <label>Collection<input disabled={busy} required maxLength={50} list="agent-library-collections" value={editing.draft.category} onChange={event=>setEditing({...editing,draft:{...editing.draft,category:event.target.value}})}/><datalist id="agent-library-collections">{collections.map(name=><option key={name} value={name}/>)}</datalist></label>
    <label>Tags, separated by commas<input disabled={busy} maxLength={820} value={editing.draft.tags} onChange={event=>setEditing({...editing,draft:{...editing.draft,tags:event.target.value}})}/></label>
    <label>Description<textarea disabled={busy} rows={3} maxLength={4000} value={editing.draft.description} onChange={event=>setEditing({...editing,draft:{...editing.draft,description:event.target.value}})}/></label>
    <div className="form-actions"><button disabled={busy||!dirty}>Save details</button>{dirty&&<button type="button" className="secondary" disabled={busy} onClick={()=>setEditing({...editing,draft:details(editing.row)})}>Reset details</button>}</div>
   </form>
   {dirty&&<p className="hint">Save or reset these details before changing the file or its versions.</p>}
   <section aria-label="Library file actions"><h3>File</h3><p className="hint">{editing.row.file_name} · Version {editing.row.version??1}. Originals and previous versions share the library’s 256 MB limit.</p>
    <div className="form-actions">{editing.row.is_archived?<><button className="secondary" disabled={busy||dirty} onClick={()=>change('restore')}>Restore document</button>{editing.row.storage_bucket==='agentopia-desktop-database'&&<button className="danger secondary" disabled={busy||dirty} onClick={()=>{if(confirm('Permanently delete this archived document and all retained file versions? This cannot be undone.'))change('delete');}}>Delete permanently</button>}</>:<><button className="secondary" disabled={busy||dirty} onClick={()=>change('replace',{},true)}>Replace file</button><button className="secondary" disabled={busy||dirty} onClick={()=>change('archive')}>Archive document</button></>}</div>
   </section>
   <details onToggle={event=>{if(event.currentTarget.open)loadVersions();}}><summary>File versions</summary>{versions?versions.map(version=><div className="document-library-version" key={version.version}><div><strong>Version {version.version}{version.current?' · Current':''}</strong><small>{version.file_name} · {size(version.file_size)} · {new Date(version.saved_at).toLocaleString()}</small>{!version.has_original&&<small>The original was not retained for this version.</small>}</div>{!version.current&&<div className="form-actions"><button className="secondary" disabled={busy||dirty||editing.row.is_archived||!version.has_original} onClick={()=>change('restore_version',{version:version.version})}>Use version {version.version}</button><button className="danger secondary" disabled={busy||dirty} onClick={()=>{if(confirm('Permanently delete previous file version '+version.version+'? The current file stays in the library.'))change('delete_version',{version:version.version});}}>Delete version {version.version}</button></div>}</div>):<div><p className="hint">{busy?'Loading file versions…':'File versions are not loaded.'}</p>{!busy&&<button className="secondary" onClick={loadVersions}>Load file versions</button>}</div>}</details>
  </Modal>}
 </>;
}
