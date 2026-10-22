import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {basicSetup,EditorView} from 'codemirror';
import {EditorState} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {openSearchPanel} from '@codemirror/search';
import {codeLanguage,codeHighlighting} from './code-language';
import {Save,Search,RotateCcw,Trash2} from 'lucide-react';
import {call,Modal} from './ui';
import type {EditorDraft,EditorSave,EditorSnapshot} from '../src/editor-contracts';
import {pendingEditors as pending} from './editor-drafts';
const normalized=(value:string|null)=>value?.replace(/\r\n/g,'\n')??'';

export type WorkspaceEditorHandle={flush:()=>Promise<void>};
export default forwardRef<WorkspaceEditorHandle,{owner:string;referenceId:string;path:string;done:()=>void;saved:()=>void}>(function WorkspaceEditor({owner,referenceId,path,done,saved},ref){
 const [draft,setDraft]=useState<EditorDraft|null>(null),[value,setValue]=useState(''),[status,setStatus]=useState('Opening protected draft…'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<'reload'|'discard'|null>(null),[conflict,setConflict]=useState<EditorSnapshot|null>(null);
 const record=useRef<EditorDraft|null>(null),latest=useRef(''),pumping=useRef<Promise<void>|null>(null),command=useRef<Promise<void>|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),alive=useRef(true),area=useRef<CodeHandle>(null),boot=useRef<Promise<void>>(Promise.resolve());
 const show=(fn:()=>void)=>{if(alive.current)fn();};
 const update=(next:EditorDraft)=>{record.current=next;show(()=>setDraft(next));};
 const flush=async():Promise<void>=>{
  clearTimeout(timer.current);try{await boot.current;}catch{if(!record.current)return;}if(!record.current)return;if(pumping.current){await pumping.current;if(record.current&&latest.current!==record.current.content)return flush();return;}
  const operation=(async()=>{if(!record.current)throw new Error('The editor has not opened this file.');while(latest.current!==record.current.content){show(()=>{setStatus('Saving draft…');setError('');});const content=latest.current,next=await call<EditorDraft>('workspace.editor.update',{owner,id:record.current.id,revision:record.current.revision,content});update(next);}show(()=>setStatus('Draft saved locally'));})();
  pumping.current=operation;try{await operation;}catch(e){show(()=>{setError((e as Error).message);setStatus('Latest edits are not saved locally');});throw e;}finally{if(pumping.current===operation)pumping.current=null;}
 };
 const settle=async()=>{await command.current;await flush();};
 useImperativeHandle(ref,()=>({flush:settle}));
 useEffect(()=>{
  alive.current=true;const lease=crypto.randomUUID();const previous=[...pending.values()].filter(item=>item.owner===owner).map(item=>item.flush());const token=Symbol();pending.set(token,{owner,flush:settle});
  boot.current=Promise.all(previous).then(()=>call<EditorDraft>('workspace.editor.open',{owner,referenceId,path,create:true,lease})).then(next=>{record.current=next;latest.current=next.content;show(()=>{setDraft(next);setValue(next.content);setStatus(next.content!==normalized(next.base)?'Recovered local draft':'File is saved');});}).catch(e=>{show(()=>setError(e.message));throw e;});void boot.current.catch(()=>{});
  return()=>{alive.current=false;clearTimeout(timer.current);void settle().catch(()=>{}).finally(async()=>{await call('workspace.editor.release',{owner,lease}).catch(()=>{});pending.delete(token);});};
 },[owner,referenceId,path]);
 const changed=(content:string)=>{latest.current=content;setValue(content);setConflict(null);setStatus('Saving draft…');clearTimeout(timer.current);timer.current=setTimeout(()=>void flush().catch(()=>{}),120);};
 const save=(expectedHash?:string|null)=>{if(command.current)return;command.current=(async()=>{setBusy(true);setError('');try{await flush();const result=await call<EditorSave>('workspace.editor.save',{owner,id:record.current!.id,revision:record.current!.revision,...(expectedHash!==undefined?{expectedHash}:{})});update(result.draft);if(result.conflict){setConflict(result.conflict);setStatus('File changed elsewhere — review before saving');}else{latest.current=result.draft.content;setValue(result.draft.content);setConflict(null);setStatus('File saved');saved();}}catch(e){setError((e as Error).message);}finally{command.current=null;show(()=>setBusy(false));}})();};
 const reset=()=>{if(command.current)return;command.current=(async()=>{setBusy(true);setError('');clearTimeout(timer.current);try{await pumping.current?.catch(()=>{});const next=await call<EditorDraft|undefined>('workspace.editor.'+confirm,{owner,id:record.current!.id,revision:record.current!.revision});if(next){update(next);latest.current=next.content;setValue(next.content);setConflict(null);setStatus('Reloaded saved file');saved();}else{record.current=null;done();}setConfirm(null);}catch(e){setError((e as Error).message);setConfirm(null);}finally{command.current=null;show(()=>setBusy(false));}})();};
 const dirty=!!draft&&(value!==normalized(draft.base)||draft.base===null);
 return <div className="workspace-editor"><div className="editor-toolbar"><span>{dirty?'Unsaved file changes':'Saved file'}</span><button className="icon-button" aria-label="Find and replace in file" title="Find / replace (Ctrl+F)" disabled={!draft} onClick={()=>area.current?.search()}><Search size={15}/></button><button className="icon-button" aria-label="Reload saved file" title="Reload saved file" disabled={!draft||busy} onClick={()=>setConfirm('reload')}><RotateCcw size={15}/></button><button className="icon-button" aria-label="Discard local draft" title="Discard local draft" disabled={!draft||busy} onClick={()=>setConfirm('discard')}><Trash2 size={15}/></button><button className="editor-save" disabled={!draft||busy} onClick={()=>void save()}><Save size={14}/>{busy?'Saving…':'Save'}<kbd>Ctrl S</kbd></button></div>
  {error&&<div className="pane-error" role="alert">{error}</div>}
  {draft&&<CodeArea ref={area} name={draft.name} value={value} change={changed} save={()=>void save()} disabled={busy}/>}
  <div className="editor-status" role="status"><span>{status}</span><span>UTF-8 · {value.split('\n').length} lines</span></div><p className="editor-privacy">Drafts stay on this computer. Save before using these edits in chat.</p>
  {confirm&&<Modal title={confirm==='reload'?'Reload saved file?':'Discard local draft?'} close={()=>!busy&&setConfirm(null)}><p>{confirm==='reload'?'Replace your local draft with the current file on disk.':'Remove this local draft. The saved file will stay as it is.'}</p><div className="editor-dialog-actions"><button className="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Keep editing</button><button disabled={busy} onClick={()=>void reset()}>{confirm==='reload'?'Reload file':'Discard draft'}</button></div></Modal>}
  {conflict&&<Modal title="File changed elsewhere" className="editor-conflict" close={()=>setConflict(null)}><p>Another program or an agent changed this file after you opened it. Review the latest saved file and your draft before replacing it.</p><div className="editor-conflict-columns"><section><h3>Latest saved file</h3><pre>{conflict.content??'[File does not exist]'}</pre></section><section><h3>Your draft</h3><pre>{value}</pre></section></div><div className="editor-dialog-actions"><button className="secondary" onClick={()=>setConflict(null)}>Keep draft</button><button className="secondary" disabled={busy} onClick={()=>{setConflict(null);setConfirm('reload');}}>Reload latest</button><button disabled={busy} onClick={()=>void save(conflict.sha256)}>Replace reviewed file</button></div></Modal>}
 </div>;
});
type CodeHandle={search:()=>void};
const CodeArea=forwardRef<CodeHandle,{name:string;value:string;change:(text:string)=>void;save:()=>void;disabled:boolean}>(function CodeArea({name,value,change,save,disabled},ref){
 const host=useRef<HTMLDivElement>(null),view=useRef<EditorView>(),callbacks=useRef({change,save});callbacks.current={change,save};
 useImperativeHandle(ref,()=>({search:()=>{if(view.current)openSearchPanel(view.current);}}));
 useEffect(()=>{const language=codeLanguage(name);
  const editor=new EditorView({parent:host.current!,state:EditorState.create({doc:value,extensions:[basicSetup,codeHighlighting,language,EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':'File editor','spellcheck':'false'}),keymap.of([{key:'Mod-s',run:()=>{callbacks.current.save();return true;}}]),EditorView.updateListener.of(update=>{if(update.docChanged)callbacks.current.change(update.state.doc.toString());}),EditorView.theme({'&':{height:'100%',fontSize:'13px',color:'var(--text)',backgroundColor:'var(--bg)'},'.cm-scroller':{overflow:'auto',fontFamily:'Consolas, monospace'},'.cm-gutters':{backgroundColor:'var(--sidebar)',color:'var(--muted)',borderRight:'1px solid var(--border)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'.cm-activeLine,.cm-activeLineGutter':{backgroundColor:'var(--soft)'},'.cm-selectionBackground':{backgroundColor:'color-mix(in srgb, var(--focus) 30%, transparent) !important'},'.cm-panels':{backgroundColor:'var(--surface)',color:'var(--text)'},'.cm-tooltip':{backgroundColor:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)'}})]})});view.current=editor;return()=>{view.current=undefined;editor.destroy();};
 },[name]);
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 useEffect(()=>{if(host.current)host.current.inert=disabled;},[disabled]);
 return <div ref={host} className={'code-editor-host '+(disabled?'editor-busy':'')}/>;
});
