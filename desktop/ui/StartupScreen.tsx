import React,{useEffect,useState} from 'react';
import {Bot,ArrowRight} from 'lucide-react';
import type {RuntimeStatus} from '../src/contracts';
import {call} from './ui';
import './startup.css';

const welcomeMessages=[
 'Getting your workspace ready…',
 'Waking up your little helpers…',
 'Making room for bright ideas…',
];
const phaseMessages:Record<string,string[]>={
 installing:['Making this space your own…','Unpacking a little possibility…','Giving your ideas a place to land…'],
 database:['Waking up your workspace…','Getting your agents comfy…','A little prep for your next big idea…'],
 migration:['Bringing your conversations home…','Putting familiar things in place…','Keeping your ideas together…'],
 schema:['Adding a little polish…','Getting the details just right…','Setting the stage for your next idea…'],
 session:['Picking up where you left off…','Finding your familiar corner…','Getting your conversations ready…'],
};

export function StartupScreen({runtime}:{runtime:RuntimeStatus}){
 const [message,setMessage]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const failed=runtime.phase==='error',restoring=runtime.phase==='migration',messages=phaseMessages[runtime.phase]??welcomeMessages;
 useEffect(()=>{
  setMessage(0);setNotice('');
  if(failed||restoring)return;
  const timer=setInterval(()=>setMessage(value=>(value+1)%messages.length),4200);
  return()=>clearInterval(timer);
 },[runtime.phase,failed,restoring,messages]);
 async function action(name:string){
  setBusy(true);setNotice('');
  try{const result=await call<unknown>(name);if(name==='runtime.diagnostics'&&result)setNotice('Your support report is saved.');}
  catch{setNotice('That didn’t go through. Please try again.');}
  finally{setBusy(false);}
 }
 return <main className="startup-screen" aria-label="Starting Agentopia">
  <div className="startup-welcome">
   <div className="startup-mark" aria-hidden="true"><Bot size={30} strokeWidth={1.7}/></div>
   <h1>Agentopia</h1>
   <p className="startup-tagline">A little space for big ideas.</p>
   {failed?<div className="startup-recovery">
    <div role="alert"><h2>Let’s try that again</h2><p>Your workspace couldn’t finish opening. Try again, or use setup help for the next steps.</p></div>
    <div className="startup-actions"><button disabled={busy} onClick={()=>void action('runtime.retry')}>Try again<ArrowRight size={15}/></button><button className="secondary" disabled={busy} onClick={()=>void action('runtime.prerequisites')}>Setup help</button></div>
    <button className="startup-support" disabled={busy} onClick={()=>void action('runtime.diagnostics')}>Save a support report</button>
    <details className="startup-details"><summary>Technical details</summary><p>{runtime.message}</p></details>
   </div>:<div className="startup-loading">
    <div className="startup-dots" aria-hidden="true"><span/><span/><span/></div>
    <p className="startup-message" role="status" aria-live="polite" aria-atomic="true"><span key={runtime.phase+':'+message}>{restoring?runtime.message:messages[message%messages.length]}</span></p>
    {runtime.phase==='installing'&&<p className="startup-first-visit">The first hello takes a little longer.</p>}
   </div>}
   {notice&&<p className="startup-notice" role="status">{notice}</p>}
  </div>
  <p className="startup-footnote">Your private AI workspace</p>
 </main>;
}
