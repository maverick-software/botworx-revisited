import React,{useEffect,useRef,useState} from 'react';
import {Modal,call} from './ui';
import type {GoogleDocumentResult,GoogleDocumentAccounts} from '../src/google-document-contracts';
type Result=GoogleDocumentResult|GoogleDocumentAccounts;
export function GoogleDocumentDialog({owner,conversation,href,open,close,configure}:{owner:string;conversation?:string;href:string;open:(url:string)=>void;close:()=>void;configure?:()=>void}){
 const live=useRef(true),started=useRef(false),working=useRef(false),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const run=async(action='google',connectionId?:string,operationId?:string)=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try{const value=await call<Result>('workspace.fileAction',{owner,conversationId:conversation,href,action,...(connectionId?{connectionId}:{}),...(operationId?{operationId}:{})});if(!live.current)return;setResult(value);if(value.kind==='opened'&&value.url&&!value.sourceChanged){open(value.url);close();}}
  catch(problem){if(live.current)setError((problem as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{working.current=false;if(live.current)setBusy(false);}
 };
 useEffect(()=>{live.current=true;if(!started.current){started.current=true;void run();}return()=>{live.current=false;};},[]);
 return <Modal title="Open in Google" close={close}><div className="google-document-opening">
  {busy?<p role="status">Opening the document through your connected Google account…</p>:<>
   {error&&<p role="alert">{error}</p>}
   {error&&configure&&<button className="secondary" onClick={()=>{close();configure();}}>Manage Composio connection</button>}
   {result?.kind==='accounts'&&(result.accounts.length?<><p>Choose the Google Drive account for this document.</p><div className="form-actions" style={{display:'grid',justifyContent:'stretch'}}>{result.accounts.map(account=><button className="secondary" style={{minWidth:0,maxWidth:'100%',justifyContent:'flex-start',textAlign:'left',overflowWrap:'anywhere'}} key={account.id} onClick={()=>void run('google',account.id)}>{account.name}</button>)}</div></>:<><p>Connect a Google Drive account in Composio to open this document in Google Docs, Sheets or Slides.</p>{configure&&<button onClick={()=>{close();configure();}}>Open Composio connections</button>}</>)}
   {result&&result.kind!=='accounts'&&result.notice&&<p role="status">{result.notice}</p>}
   {result?.kind==='held'&&<button onClick={()=>void run('google-check',undefined,result.operationId)}>Check existing upload</button>}
   {result?.kind==='retryable'&&<button onClick={()=>void run()}>Retry upload</button>}
   {result?.kind==='opened'&&result.sourceChanged&&<><p>The local file has changed since this Google copy was created.</p><button onClick={()=>{if(result.url)open(result.url);close();}}>Open saved Google copy</button></>}
   {error&&!result&&<button className="secondary" onClick={()=>void run()}>Check connection and try again</button>}
  </>}
  <p className="hint">This creates a Google copy. Your local file stays unchanged. Closing this window leaves a started upload recorded so it can be checked later.</p>
 </div></Modal>;
}
