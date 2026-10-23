import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentEditor} from '../../desktop/ui/AgentSettings';
import '../../desktop/ui/style.css';
const agent={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Mira',description:'Generated document fixture',active:true,model:'fixture-model',provider:'openai-oauth' as const,system_instructions:'Review assigned evidence.'};
Object.assign(window,{agentopia:{call:async(action:string,args:unknown={})=>{const response=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,args})}),body=await response.json();if(!response.ok)throw Error(body.error);return body;}}});
function Fixture(){const [open,setOpen]=useState(true),[error,setError]=useState('');return <>{error&&<p role="alert">{error}</p>}{open?<AgentEditor agent={agent} initialSection="documents" defaultModel="fixture-model" connections={null} run={async task=>{try{await task();}catch(error){setError((error as Error).message);}}} close={()=>setOpen(false)} saved={async()=>{}} preview={()=>{}}/>:<button onClick={()=>setOpen(true)}>Reopen editor</button>}</>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
