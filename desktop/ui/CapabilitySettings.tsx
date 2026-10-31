import React,{useEffect,useRef,useState} from 'react';
import type {Agent,ChatOptions} from '../src/contracts';
import {commandDisclosure,type CommandPermissions} from '../src/terminal-contracts';
import {call} from './ui';

export type ChatSettingsContext={agent:Agent|null;options:ChatOptions;change:(next:Partial<ChatOptions>)=>void;disabled:boolean;terminal:()=>void;configure:()=>void};
export function TerminalSettings({owner}:{owner:string}){
 const [permissions,setPermissions]=useState<CommandPermissions|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),generation=useRef(0);
 useEffect(()=>{const token=++generation.current;void call<CommandPermissions>('terminal.permissions',{owner}).then(value=>{if(token===generation.current)setPermissions(value);}).catch(e=>{if(token===generation.current)setError(e.message);});const off=window.sylvana.onChat(event=>{if(event.ownerId===owner&&event.kind==='command-permissions'&&event.commandPermissions)setPermissions(event.commandPermissions);});return()=>{generation.current++;off();};},[owner]);
 async function update(action:string){const token=generation.current;setBusy(true);setError('');try{const value=await call<CommandPermissions>(action,{owner});if(token===generation.current)setPermissions(value);}catch(e){if(token===generation.current)setError((e as Error).message);}finally{if(token===generation.current)setBusy(false);}}
 return <><p className="pane-intro">Windows command authorization applies to every chat in this Sylvana account.</p><p>{commandDisclosure}</p>{permissions&&<div className="setting-row"><div><strong>Windows commands</strong><p>{permissions.enabled?'Enabled for selected workspace folders. '+(permissions.full?'Full access is available.':'Agent commands require review.'):'Disabled'}</p></div>{permissions.administrator?<button className="secondary" disabled={busy} onClick={()=>void update(permissions.enabled?'terminal.revoke':'permissions.commands')}>{permissions.enabled?'Disable commands':'Enable commands'}</button>:<span>Administrator required</span>}</div>}{error&&<p role="alert">{error}</p>}</>;
}
