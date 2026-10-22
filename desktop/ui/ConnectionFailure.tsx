import React,{useContext} from 'react';
import type {Provider} from '../src/contracts';
import {WorkspaceLinks} from './WorkspaceLinks';
import {connectionFailure} from './connection-failure';
import './connection-failure.css';

export function ConnectionFailure({error,provider}:{error?:string;provider?:Provider}){
 const failure=connectionFailure(error,provider),workspace=useContext(WorkspaceLinks);
 if(!failure)return <small className="response-status" role="status">failed{error?' — '+error:''}</small>;
 return <div className="connection-failure" role="status"><strong>{failure.title}</strong><p>{failure.message}</p>{workspace.connections&&<button type="button" className="subtle-link" onClick={workspace.connections}>AI connections</button>}<details><summary>Technical details</summary><pre>{error}</pre></details></div>;
}
