import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AgentInstructions} from '../../desktop/ui/AgentInstructions';
import {AgentEditor} from '../../desktop/ui/AgentSettings';
import type {ToolSource} from '../../desktop/src/tool-contracts';
import '../../desktop/ui/style.css';
const first='mcp:11111111-1111-4111-8111-111111111111',second='mcp:22222222-2222-4222-8222-222222222222';
const defaults:ToolSource[]=[{id:first,name:'Microsoft Learn',plugin:'Public Learn',kind:'mcp',ready:true,enabled:true,detail:''},{id:second,name:'Microsoft Learn',plugin:'Personal Learn',kind:'mcp',ready:false,enabled:true,detail:''},{id:'web_search',name:'Disabled search',kind:'web',ready:true,enabled:false,detail:''}];
let saveGate:Promise<void>|null=null;let releaseSave:(()=>void)|null=null;
(window as any).deferInstructionSave=()=>{saveGate=new Promise(resolve=>releaseSave=resolve);};(window as any).releaseInstructionSave=()=>releaseSave?.();
let catalog=structuredClone(defaults);const apiCalls:any[]=[];let catalogFailure=false;
(window as any).agentopia={call:async(action:string,args:any={})=>{
 apiCalls.push({action,args:structuredClone(args)});
 if(action==='providers.models')return [{id:'fixture-model',name:'Fixture model'}];
 if(action==='agentSettings.get')return {agent:{personality:'',settings:{}},documents:[],documentIds:[],datastores:[],datastoreIds:[],connections:[],connectionIds:[],teams:[],teamIds:[],contacts:[],contactMode:'no_access',contactIds:[],mcp:[],tasks:[]};
 if(action==='tools.catalog'){if(catalogFailure)throw Error('Controlled catalog failure');return structuredClone(catalog);}
 if(action==='agents.profile')return {skills:[]};
 if(action==='agents.save'){if(saveGate){await saveGate;saveGate=null;}return args.id;}
 throw Error('Unexpected instruction fixture action '+action);
}};
document.documentElement.dataset.theme='light';
function Fixture(){
 const [value,setValue]=useState('Use approved evidence.'),[key,setKey]=useState(0),[changes,setChanges]=useState(0),[saved,setSaved]=useState<string|null>(null),[sources,setSources]=useState<ToolSource[]|null>(structuredClone(defaults)),[error,setError]=useState(false),[refreshes,setRefreshes]=useState(0),[browsed,setBrowsed]=useState(0),[whole,setWhole]=useState(false);
 (window as any).instructionFixture={value,changes,saved,refreshes,browsed,apiCalls};
 (window as any).resetInstructions=(text:string)=>{setValue(text);setChanges(0);setSaved(null);setKey(n=>n+1);setWhole(false);};
 (window as any).replaceInstructionSources=(rows:ToolSource[]|null,failed=false)=>{setSources(rows);setError(failed);if(rows)catalog=structuredClone(rows);};
 (window as any).showInstructionAgent=()=>{apiCalls.length=0;setWhole(true);};
 const change=(text:string)=>{setValue(text);setChanges(n=>n+1);};
 return whole?<AgentEditor agent={{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Mira',description:'Generated app reference editor',system_instructions:value,provider:'openai-oauth',model:'fixture-model',active:true}} defaultModel="fixture-model" connections={null} run={async task=>{await task();}} close={()=>setWhole(false)} saved={async()=>{}} preview={()=>{}}/>:<main style={{maxWidth:800,margin:'20px auto',padding:20}}><label>Agent name<input aria-label="Agent name"/></label><form onSubmit={event=>{event.preventDefault();setSaved(value);}}><AgentInstructions key={key} value={value} onChange={change} sources={sources} sourcesError={error} refreshSources={()=>{setRefreshes(n=>n+1);setError(false);setSources(structuredClone(catalog));}} browseApps={()=>setBrowsed(n=>n+1)}/><button type="submit">Save fixture</button></form></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
