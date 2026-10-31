import React,{useContext} from 'react';
import type {Provider} from '../src/contracts';
import {WorkspaceLinks} from './WorkspaceLinks';
import {connectionFailure,sylvanaBillingURL,sylvanaResetURL} from './connection-failure';
import './connection-failure.css';

export function ConnectionFailure({error,provider}:{error?:string;provider?:Provider}){
 const failure=connectionFailure(error,provider),workspace=useContext(WorkspaceLinks);
 if(!failure)return <div className="connection-failure" role="status"><strong>Your message could not be completed</strong><p>Please try again. If this continues, contact Sylvana support.</p></div>;
 const open=(event:React.MouseEvent<HTMLAnchorElement>,url:string)=>{event.preventDefault();workspace.browser(url);};
 return <div className="connection-failure" role="status"><strong>{failure.title}</strong><p>{failure.message}</p>{failure.billing?<p><a href={sylvanaBillingURL} onClick={event=>open(event,sylvanaBillingURL)}>Manage your subscription</a> or <a href={sylvanaResetURL} onClick={event=>open(event,sylvanaResetURL)}>buy a usage reset</a>.</p>:provider!=='sylvana'&&<>{workspace.connections&&<button type="button" className="subtle-link" onClick={workspace.connections}>AI connections</button>}<details><summary>Technical details</summary><pre>{error}</pre></details></>}</div>;
}
