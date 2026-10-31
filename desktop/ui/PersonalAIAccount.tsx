import React,{useEffect,useState} from 'react';import type {ProviderStatus} from '../src/contracts';import {call} from './ui';import {OpenAIConnection} from './OpenAIConnection';import {ChatGPTConnectionStatus} from './ChatGPTConnectionStatus';
export function PersonalAIAccount({owner,changed}:{owner:string;changed:()=>Promise<void>}){
 const [status,setStatus]=useState<ProviderStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=async()=>setStatus(await call<ProviderStatus>('providers.status'));
 useEffect(()=>{let live=true;void call<ProviderStatus>('providers.status').then(s=>{if(live)setStatus(s);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[owner]);
 async function connect(){setBusy(true);setError('');try{await call('providers.connectChatGPT');await refresh();await changed();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!status)return <p role="status">{error||'Checking your AI account…'}</p>;
 if(status.legalMode||status.workspaceAI?.provider==='sylvana')return <section className="connection"><h3>AI account</h3><p>Your workspace uses the Sylvana AI service. No additional connection is needed.</p></section>;
 if(status.connections?.openai_api)return <OpenAIConnection available={!!status.openaiApi} changed={async()=>{await refresh();await changed();}}/>;
 if(!status.connections?.chatgpt)return null;
 return <section className="connection"><h3>ChatGPT account</h3><ChatGPTConnectionStatus connection={status.chatgpt}/><button disabled={busy} onClick={()=>void connect()}>{busy?'Complete sign-in in your browser…':'Continue with ChatGPT'}</button>{error&&<p role="alert">{error}</p>}<p className="hint">Use the Business or Pro account selected for your workspace.</p></section>;
}
