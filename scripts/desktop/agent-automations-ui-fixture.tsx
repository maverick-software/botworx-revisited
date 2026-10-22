import React from 'react';
import {createRoot} from 'react-dom/client';
import {AgentAutomations} from '../../desktop/ui/AgentAutomations';
import '../../desktop/ui/style.css';
import '../../desktop/ui/agent-directory.css';
declare const __AUTOMATION_FIXTURE__:any;
const config=__AUTOMATION_FIXTURE__,listeners=new Set<(event:any)=>void>();
Object.assign(window,{calls:[],agentopia:{onChat:(listener:any)=>{listeners.add(listener);return()=>listeners.delete(listener);},call:async(action:string,args:any={})=>{
 (window as any).calls.push({action,args:structuredClone(args)});
 const response=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,args})}),body=await response.json();if(!response.ok)throw Error(body.error);return body;
}}});
document.documentElement.dataset.theme='light';
function Fixture(){const[open,setOpen]=React.useState(true);return <main style={{maxWidth:768,margin:'50px auto',padding:24}}><h1>{config.agent.name}</h1>{open?<AgentAutomations dialog={new URLSearchParams(location.search).get('dialog')==='1'} close={()=>setOpen(false)} owner={config.owner} agent={config.agent} connections={null} administrator={false} configure={()=>{}} openChat={async()=>{}}/>:<button onClick={()=>setOpen(true)}>Open automations</button>}</main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
