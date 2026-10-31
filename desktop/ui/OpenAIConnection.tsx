import React,{useState} from 'react';import {call} from './ui';
export function OpenAIConnection({available,changed}:{available:boolean;changed:()=>Promise<void>}){
 const [key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{await call('providers.saveOpenAIKey',{key});setKey('');await changed();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="connection" aria-label="OpenAI API connection"><h3>OpenAI API key</h3><p>{available?'Key saved in Windows-protected storage. The saved key cannot be displayed or copied from Sylvana.':'Add the API key for your workspace’s OpenAI account.'}</p><label>{available?'Replace API key':'API key'}<input type="password" autoComplete="off" value={key} disabled={busy} onChange={e=>setKey(e.target.value)}/></label><button disabled={busy||!key.trim()} onClick={()=>void save()}>{busy?'Saving…':available?'Replace saved key':'Save key securely'}</button>{error&&<p role="alert">{error}</p>}</section>;
}
