import React,{useEffect,useState} from 'react';
import {Plug,BookOpen,Database,Plus} from 'lucide-react';
import type {AgentProfile} from '../src/agent-contracts';
import type {ToolSource} from '../src/tool-contracts';
import {call} from './ui';
import {pluginName} from './plugin-presentation';

export type AgentEditorResourceState={sources:ToolSource[]|null;skills:AgentProfile['skills']|null;errors:string[];reload:()=>void};
export function useAgentEditorResources(agentId:string|undefined,revision:number):AgentEditorResourceState{
 const [sources,setSources]=useState<ToolSource[]|null>(null),[skills,setSkills]=useState<AgentProfile['skills']|null>(null),[errors,setErrors]=useState<string[]>([]),[retry,setRetry]=useState(0);
 const scopeKey=(agentId??'')+':'+revision+':'+retry,[scope,setScope]=useState('');
 useEffect(()=>{if(!agentId){setSources([]);setSkills([]);setErrors([]);return;}let live=true;setScope(scopeKey);setSources(null);setSkills(null);setErrors([]);void Promise.allSettled([call<ToolSource[]>('tools.catalog',{agentId}),call<AgentProfile>('agents.profile',{agentId})]).then(([tools,profile])=>{if(!live)return;setSources(tools.status==='fulfilled'?tools.value:null);setSkills(profile.status==='fulfilled'?profile.value.skills:null);setErrors([tools.status==='rejected'?'Assigned apps could not be loaded.':'',profile.status==='rejected'?'Assigned skills could not be loaded.':''].filter(Boolean));});return()=>{live=false;};},[agentId,revision,retry]);
 return {sources:scope===scopeKey?sources:null,skills:scope===scopeKey?skills:null,errors:scope===scopeKey?errors:[],reload:()=>setRetry(n=>n+1)};
}
export function AgentEditorResources({resources,apps,skill,memory}:{resources:AgentEditorResourceState;apps:()=>void;skill:(id?:string)=>void;memory:()=>void}){
 const {sources,skills,errors,reload}=resources;
 return <section className="agent-editor-resources" aria-label="Assigned agent resources" data-independent-agent-settings><div className="agent-editor-resource-row"><span>Apps</span><div>{sources===null&&!errors.length&&<small>Loading apps…</small>}{sources?.filter(source=>source.enabled).map(source=><button key={source.id} type="button" className="secondary resource-chip" onClick={apps} title={source.ready?'Connected':'Connection required'}><Plug size={14}/>{pluginName(source.name.split(' · ')[0])}<span className={'resource-connection-dot '+(source.ready?'ready':'')} aria-label={source.ready?'Connected':'Connection required'}/></button>)}<button className="subtle-link" type="button" onClick={apps}><Plus size={14}/>Browse apps</button></div></div><div className="agent-editor-resource-row"><span>Skills</span><div>{skills===null&&!errors.length&&<small>Loading skills…</small>}{skills?.map(row=><button key={row.id} className="secondary resource-chip" type="button" onClick={()=>skill(row.id)}><BookOpen size={14}/>{row.name}</button>)}<button className="subtle-link" type="button" onClick={()=>skill()}><Plus size={14}/>Add skill</button></div></div><div className="agent-editor-resource-row"><span>Memory</span><div><button className="secondary resource-chip" type="button" onClick={memory}><Database size={14}/>Agent memory</button></div></div>{errors.length>0&&<div role="alert">{errors.map(error=><p key={error}>{error}</p>)}<button type="button" className="subtle-link" onClick={reload}>Retry assigned resources</button></div>}</section>;
}
