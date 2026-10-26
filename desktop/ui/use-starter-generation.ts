import {useEffect,useRef,useState} from 'react';
import type {Provider} from '../src/contracts';
import type {AgentAppearance} from '../src/agent-presentation-contracts';
import {applyStarterGeneration,builderSnapshot,starterGenerationRequest,type BuilderConfiguration} from '../src/agent-builder';
import {previewEditorScope} from '../src/agent-editor-draft-contracts';
import {acquireEditorDraft} from './durable-editor-draft';
import {AgentPreviewConversation,type PreviewView} from './agent-preview-state';

type Props={owner:string;source:string|null;creationId?:string;configuration:BuilderConfiguration|null;provider:Provider;model:string;beforeSend:()=>Promise<void>};
type Starters=NonNullable<AgentAppearance['starters']>;
/** Mount only while the starters modal owns the builder controls. Shares the
 * builder's durable request journal so closing/reopening never replays work. */
export function useStarterGeneration(props:Props){
 const latest=useRef(props);latest.current=props;
 const [view,setView]=useState<PreviewView|null>(null),[error,setError]=useState(''),[storageError,setStorageError]=useState('');
 const controller=useRef<AgentPreviewConversation|null>(null),preparing=useRef(false),waiter=useRef<{id?:string;basis:BuilderConfiguration;provider:Provider;model:string;resolve:(value:Starters)=>void;reject:(reason:Error)=>void}|null>(null);
 const scope=previewEditorScope(props.source,props.creationId,'builder'),key=props.owner+':'+scope;
 const fail=(message:string)=>{const pending=waiter.current;if(pending){waiter.current=null;pending.reject(Error(message));}setError(message);};
 useEffect(()=>{let live=true;setView(null);setError('');setStorageError('');const lease=acquireEditorDraft(props.owner,scope,window.agentopia,localStorage),draft=lease.draft,off=draft.subscribe(state=>{if(live)setStorageError(state.error);}),cache={getItem:()=>draft.state.value,setItem:(_key:string,value:string)=>draft.set(value),hydrate:()=>draft.initialize(),flush:()=>draft.flush(),retry:()=>draft.retry()},conversation=new AgentPreviewConversation(props.owner,props.source,scope,window.agentopia,cache,next=>{
  if(!live)return;setView(next);const pending=waiter.current;if(!pending)return;
  if(!pending.id&&next.pending)pending.id=next.pending.requestId;
  if(next.error&&(next.uncertain||!next.working)){fail(next.error);return;}
  const row=pending.id?next.rows.find(row=>row.id===pending.id):undefined;
  // Terminal stream events can arrive before their full output is stored.
  // Wait for the authoritative read to clear the persisted request journal.
  if(!row||row.status==='running'||next.pending||next.working)return;
  if(row.status!=='completed'){fail(row.error||'Conversation starter generation '+row.status+'.');return;}
  try{const current=latest.current;if(current.provider!==pending.provider||current.model!==pending.model||!current.configuration)throw Error('The selected model or agent draft changed. Generate starters again using the current configuration.');const checked=applyStarterGeneration(current.configuration,pending.basis,row.output_text);waiter.current=null;pending.resolve(checked.appearance.starters!);}catch(reason){fail((reason as Error).message);}
 },props.creationId);controller.current=conversation;conversation.start();return()=>{live=false;const pending=waiter.current;if(pending)void conversation.stop();waiter.current=null;pending?.reject(Error('The conversation starters editor closed. Its request remains available in builder history.'));controller.current=null;conversation.dispose();off();lease.release();};},[key]);
 async function generate():Promise<Starters>{
  const conversation=controller.current,current=latest.current,state=conversation?.state;
  if(!conversation||!state||state.loading||state.working||state.pending||state.uncertain||storageError||waiter.current||preparing.current)throw Error('Wait for generation to finish, or inspect its saved result before generating again.');
  if(!current.configuration||!current.model)throw Error('Choose a connected model and load the agent configuration first.');
  const basis=structuredClone(current.configuration),provider=current.provider,model=current.model;setError('');
  preparing.current=true;try{await current.beforeSend();}finally{preparing.current=false;}
  if(controller.current!==conversation||latest.current.provider!==provider||latest.current.model!==model||JSON.stringify(latest.current.configuration)!==JSON.stringify(basis))throw Error('The agent draft changed. Generate starters again using the current configuration.');
  const result=new Promise<Starters>((resolve,reject)=>{waiter.current={basis,provider,model,resolve,reject};});
  conversation.setPrompt(starterGenerationRequest);
  void conversation.send(builderSnapshot(basis,provider,model,state.thinking)).then(()=>{if(waiter.current&&!waiter.current.id)fail('The generation request was not sent. Inspect the saved builder state before trying again.');}).catch(reason=>fail((reason as Error).message));
  // send captures its request text synchronously. Keep the owner's unsent
  // builder message in the composer while this separate request completes.
  conversation.setPrompt(state.prompt);
  return result;
 }
 async function cancel(){const pending=waiter.current;waiter.current=null;pending?.reject(Error('Conversation starter generation cancelled.'));await controller.current?.stop();}
 return {generate,cancel,inspect:()=>controller.current?.refresh(true)??Promise.resolve(),working:!!view?.working,loading:!view||view.loading,uncertain:!!view?.uncertain,error:error||storageError||view?.error||''};
}
