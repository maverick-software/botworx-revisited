import React,{useEffect,useState} from 'react';



import {SylvanaBrand} from './SylvanaBrand';
import loginArtwork from './assets/sylvana-login-art.webp';




import {ChatGPTConnectionStatus} from './ChatGPTConnectionStatus';



import {Bot,Trash2} from 'lucide-react';



import {SiOpenai} from 'react-icons/si';



import type {Agent,Model,Provider,ProviderStatus} from '../src/contracts';



import {Modal,call,type Connections} from './ui';



export type Run=(task:()=>Promise<unknown>)=>Promise<unknown>;



export function Auth({busy,onContinue,onCancel}:{busy:boolean;onContinue:()=>Promise<void>;onCancel:()=>Promise<void>}){

 return <main className="auth"><div className="auth-half"><div className="auth-intro"><img className="auth-artwork" src={loginArtwork} alt=""/><div className="auth-intro-copy"><h1>Legal intelligence.<br/>Amplified.</h1><p>Your firm’s AI workspace, with conversations saved on this computer and processing governed by your firm’s connections.</p></div></div></div><div className="auth-half"><div className="auth-login"><div className="wordmark"><SylvanaBrand/></div><div className="auth-card"><h2>Welcome back</h2><p>Sign in securely through the Sylvana website.</p><button type="button" className="chatgpt-button" disabled={busy} onClick={()=>void onContinue()}>Continue with Sylvana</button>{busy&&<><p role="status">Complete sign-in in your browser.</p><button type="button" className="link" onClick={()=>void onCancel()}>Cancel sign-in</button></>}</div></div></div></main>;

}



export {AgentEditor} from './AgentSettings';



export function ConnectionsPanel({owner,run}:{owner:string;voiceActive?:boolean;admin:boolean;run:Run;changed:()=>Promise<void>}){
 const [allowed,setAllowed]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;void call('providers.administrationStatus').then(()=>{if(live)setAllowed(true);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[owner]);
 if(!allowed)return <p role="status">{error||'Checking workspace administrator access…'}</p>;
 return <div className="settings-pane-body"><section className="connection"><h3>Managed on the web</h3><p>Your workspace settings apply to every firm user. Manage the AI service, models and voice in the Sylvana web app.</p><div className="form-actions"><button onClick={()=>void run(()=>call('account.openFirmSettings'))}>Workspace settings</button><button className="secondary" onClick={()=>void run(()=>call('account.openModelAdministration'))}>Model administration</button></div></section></div>;
}

export function UsersPanel({run}:{run:Run}){



 const [users,setUsers]=useState<any[]>([]),[busy]=useState(false);



 const refresh=async()=>{setUsers(await call<any[]>('admin.users'));};



 useEffect(()=>{void run(refresh);},[]);



 return <div className="settings-pane-body"><div className="user-list">{users.map(user=><div className="user-row" key={user.id}><div><strong>{user.email}</strong><small>{user.admin?'Administrator':'Standard user'} · {user.suspended?'Suspended':'Active'}</small></div><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await call('admin.role',{id:user.id,admin:!user.admin});await refresh();})}>{user.admin?'Make standard':'Make admin'}</button><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await call('admin.suspend',{id:user.id,suspended:!user.suspended});await refresh();})}>{user.suspended?'Reactivate':'Suspend'}</button></div>)}</div><p>Manage web accounts and firm membership on the Sylvana website.</p><button className="secondary" onClick={()=>void run(()=>call('providers.manageUsage',{provider:'sylvana'}))}>Open Sylvana dashboard</button><p className="hint">The last active administrator cannot be demoted or suspended.</p></div>;



}
