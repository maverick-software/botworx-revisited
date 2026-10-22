import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {WorkspaceImportRecovery} from '../../desktop/ui/WorkspaceImportRecovery';
import type {WorkspaceImportStatus} from '../../desktop/src/workspace-import-contracts';
import '../../desktop/ui/style.css';
const rpc=async(action:string,args:Record<string,unknown>={})=>{const response=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,args})}),value=await response.json();if(!response.ok)throw Error(value.error);return value;};
Object.assign(window,{agentopia:{call:rpc}});
function Fixture(){const [status,setStatus]=useState<WorkspaceImportStatus|null>(null),[ready,setReady]=useState(false),[signedOut,setSignedOut]=useState(false);const changed=async()=>{const state=await rpc('auth.state');setStatus(state.recovery??null);setReady(!!state.identity);};useEffect(()=>{void changed();Object.assign(window,{resetInspectionFixture:async(kind:string)=>{await rpc('fixture.reset',{kind});setReady(false);setSignedOut(false);await changed();}});},[]);return <div className="app-shell">{status?<WorkspaceImportRecovery status={status} changed={changed} signOut={async()=>{await rpc('fixture.signout');setStatus(null);setSignedOut(true);}}/>:<main style={{padding:40}}>{ready?<h1>Recovery complete</h1>:signedOut?<h1>Signed out</h1>:<p>Loading controlled recovery…</p>}</main>}</div>;}
document.documentElement.dataset.theme='dark';createRoot(document.getElementById('root')!).render(<Fixture/>);
