import React,{useEffect,useRef,useState} from 'react';
import type {UpgradeRecoveryState} from '../src/workspace-import-contracts';
import {Auth} from './Panels';
import {WorkspaceImportRecovery} from './WorkspaceImportRecovery';
import {call} from './ui';
import './workspace-import-recovery.css';

export function UpgradeRecoveryScreen(){
 const [state,setState]=useState<UpgradeRecoveryState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const active=useRef(false),mounted=useRef(true);
 const refresh=async()=>{const next=await call<UpgradeRecoveryState>('recovery.upgrade.state');if(mounted.current)setState(next);};
 async function run(work:()=>Promise<void>){if(active.current)return;active.current=true;setBusy(true);setError('');try{await work();}catch(error){if(mounted.current)setError((error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{active.current=false;if(mounted.current)setBusy(false);}}
 useEffect(()=>{mounted.current=true;void run(refresh);return()=>{mounted.current=false;};},[]);
 const signOut=async()=>{await call('recovery.upgrade.signOut');await refresh();};
 return <div className="upgrade-recovery-screen" aria-label="Upgrade workspace recovery">
  <div className="upgrade-recovery-banner" role="status">Finish workspace recovery before the upgrade. Agents, chats, schedules and tools remain paused.</div>
  {error&&<div className="workspace-recovery-card"><p role="alert" className="workspace-recovery-problem">{error}</p><div className="workspace-recovery-actions"><button disabled={busy} onClick={()=>void run(refresh)}>Retry recovery status</button><button className="secondary" disabled={busy} onClick={()=>void run(signOut)}>Use another local account</button></div></div>}
  {!state?<p role="status">Checking local recovery…</p>:!state.account?<Auth first={false} registration={false} busy={busy} onSubmit={async(_action,args)=>{await run(async()=>{await call('recovery.upgrade.signIn',args);await refresh();});}}/>:state.recovery?<WorkspaceImportRecovery key={state.account.id} status={state.recovery} changed={refresh} signOut={signOut}/>:<main className="workspace-import-recovery"><div className="workspace-recovery-card">
   <p className="workspace-recovery-eyebrow">Workspace recovery</p><h1>{state.canContinue?'Ready to finish the upgrade':'Remaining recovery needs review'}</h1><p>Signed in as {state.account.email}</p>
   <p>{state.canContinue?'Your retained workspace copies have been reviewed. Continue to create a fresh complete backup, then finish updating Agentopia.':'This account is ready. Another local account has unfinished workspace recovery. Sign out and use that account to review its retained copies.'}</p>
   <div className="workspace-recovery-actions">{state.canContinue&&<button disabled={busy} onClick={()=>void run(async()=>{await call('recovery.upgrade.continue');})}>Continue upgrade</button>}<button className="secondary" disabled={busy} onClick={()=>void run(refresh)}>Refresh recovery status</button><button className="secondary" disabled={busy} onClick={()=>void run(signOut)}>Sign out</button></div>
  </div></main>}
 </div>;
}
