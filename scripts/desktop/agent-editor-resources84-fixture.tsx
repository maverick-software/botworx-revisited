import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreationApps} from '../../desktop/ui/CreationApps';
import {AgentEditorResources,useAgentEditorResources} from '../../desktop/ui/AgentEditorResources';
import {SavedAgentResourcePicker} from '../../desktop/ui/SavedAgentResourcePicker';
import type {Agent} from '../../desktop/src/contracts';
import '../../desktop/ui/style.css';
declare const __RESOURCE_FIXTURE__:any;
const config=__RESOURCE_FIXTURE__;
Object.assign(window,{agentopia:{call:async(action:string,args:any={})=>{const response=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,args})}),body=await response.json();if(!response.ok)throw Error(body.error);return body;}}});
document.documentElement.dataset.theme='light';
function Fixture(){
 const [mode,setMode]=useState<'create'|'saved'>('create'),[owner,setOwner]=useState(config.owner),[picker,setPicker]=useState<{kind:'plugins'|'skills';id?:string}|null>(null),[revision,setRevision]=useState(0),[saves,setSaves]=useState(0),[connections,setConnections]=useState({});
 const resources=useAgentEditorResources(mode==='saved'?config.agent.id:undefined,revision,owner),agent=config.agent as Agent;
 return <main style={{maxWidth:760,padding:'25px 32px',margin:'0 auto'}}><nav style={{display:'flex',gap:10}}><button type="button" onClick={()=>{setMode('create');setPicker(null);}}>Create fixture</button><button type="button" onClick={()=>{setMode('saved');setPicker(null);}}>Saved fixture</button><button type="button" onClick={()=>setOwner(owner===config.owner?config.otherOwner:config.owner)}>Switch fixture account</button></nav><h1>{mode==='create'?'Create agent':'Edit agent'}</h1><form aria-label="Agent editor" onSubmit={event=>{event.preventDefault();setSaves(n=>n+1);}}><label>Name<input aria-label="Agent name" defaultValue="Mira"/></label>{mode==='create'?<CreationApps owner={owner} creationId={config.creationId} disabled={false} beforeWrite={async()=>{await window.agentopia.call('fixture.flush');}} changed={()=>{}} connectionOptions={connections} changeConnectionOptions={setConnections}/>:<AgentEditorResources resources={resources} apps={()=>setPicker({kind:'plugins'})} skill={id=>setPicker({kind:'skills',id})} files={()=>{}} memory={()=>{}}/>}<label>Instructions<textarea aria-label="Instructions" defaultValue="Keep my unsaved instructions." rows={6}/></label><button type="submit">Save agent</button><p aria-label="Save count">{saves}</p></form>{picker&&<SavedAgentResourcePicker key={owner} kind={picker.kind} initialSelection={picker.id} agent={agent} owner={owner} close={()=>setPicker(null)} changed={()=>setRevision(n=>n+1)}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
